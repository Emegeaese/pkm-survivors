import { accountRealName, accountState, saveProfile, signOut, syncSave } from '../account'
import { ONLINE_STATS, readTrainer, requestFriend, setProfileLook, type FriendProfile } from '../firebaseSocial'
import { socialText } from '../i18n/social'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { styleIds, type WallpaperId } from '../data/style'
import { MEDAL_TITLE_IDS, type TitleId } from '../data/achievements'
import { ownsPokemon } from '../game/gacha'
import { ownsStyle } from '../game/style'
import { wallpaperUrl } from '../render/cosmetics'
import { friendsScreen } from './friends'
import { loadSave } from './save'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { handleProblem, normalizeHandle, parseDisplayName, suggestHandle, type ProfileRun, type PublicProfile } from '../game/ranking'
import { RIBBON_TIERS, type RibbonTier } from '../game/ribbons'
import { pokeballIcon, ribbonIcon } from '../render/art'
import { portraitUrl } from '../render/sprites'
import { fetchProfile, profileUrl } from '../ranking'
import { pokedex } from '../site/pokedex'
import { LOCALES, locale, t } from '../i18n'
import { h, later } from './dom'
import { titleBadge } from './missions'
import { sharePreview, trainerShare } from './share'
import { difficultyTag, hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/** The form a run's Pokémon ended in. */
export const runForm = (starter: PlayableId, stage: number) => {
  const line = PLAYABLE[starter].line
  return line[Math.min(stage, line.length - 1)]!
}

export const runPortrait = (starter: PlayableId, stage: number) => portraitUrl(runForm(starter, stage).dex)

/** Day and month of a run, in the current language (`14/10`, `10/14`). */
const runDay = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit' })

type Action = { label: string; run: () => void }

/** A line of status text inside a dialog (loading, offline, not found). */
const note = (text: string, cls = '') => h('p', { class: `profile-note ${cls}` }, text)

const section = (title: string, ...body: Node[]) => h('section', { class: 'profile-section' }, h('h3', {}, title), ...body)

const recordCell = (d: Difficulty, run: ProfileRun | undefined) =>
  h(
    'div',
    { class: run ? 'profile-record' : 'profile-record empty' },
    difficultyTag(d),
    run ? h('img', { src: runPortrait(run.starter, run.stage), alt: runForm(run.starter, run.stage).name, title: runForm(run.starter, run.stage).name }) : null,
    h('b', {}, run ? formatTime(run.time) : t().profile.noRecord),
  )

const recentRow = (run: ProfileRun) =>
  h(
    'div',
    { class: `profile-run ${run.outcome}` },
    h('img', { src: runPortrait(run.starter, run.stage), alt: '' }),
    h('span', { class: 'profile-run-name' }, runForm(run.starter, run.stage).name),
    difficultyTag(run.difficulty),
    h('b', {}, formatTime(run.time)),
    h('small', {}, `${run.mode === 'coop' ? 'Co-op · ' : run.mode === 'versus' ? 'Versus · ' : ''}${run.verified === null ? t().ranking.pending : t().ranking.outcomes[run.outcome]} · ${runDay(run.at)}`),
  )

/** The Desafio do dia ribbons won, gold first, or null before the first one (or from an older API). */
const ribbonRow = (ribbons: Record<RibbonTier, number> | undefined) => {
  if (!ribbons || RIBBON_TIERS.every((tier) => ribbons[tier] === 0)) return null
  const names = t().ribbons.names
  return section(
    t().ribbons.section,
    h(
      'div',
      { class: 'profile-ribbons' },
      ...RIBBON_TIERS.map((tier) =>
        h('div', { class: ribbons[tier] > 0 ? 'profile-ribbon' : 'profile-ribbon empty', title: names[tier] }, h('img', { src: ribbonIcon(tier), alt: names[tier] }), h('b', {}, `×${ribbons[tier]}`)),
      ),
    ),
  )
}

/** A family's last form: what a profile shows for a Pokémon the player picked. */
const finalForm = (id: PlayableId) => PLAYABLE[id].line[PLAYABLE[id].line.length - 1]!

/** The profile's face: the picked photo, else the Pokémon of its longest record, or a Poké Ball before any. */
const headPortrait = (p: PublicProfile) => {
  if (p.photo) return portraitUrl(finalForm(p.photo).dex)
  const best = Object.values(p.records).sort((a, b) => b.time - a.time)[0]
  return best ? runPortrait(best.starter, best.stage) : pokeballIcon()
}

/** The three favourites the player picked, or else the three Pokémon they used most in their recent runs. */
const favourites = (p: PublicProfile): { ids: PlayableId[]; picked: boolean } => {
  if (p.favs?.length) return { ids: p.favs, picked: true }
  const counts = new Map<PlayableId, number>()
  for (const run of p.recent) counts.set(run.starter, (counts.get(run.starter) ?? 0) + 1)
  return { ids: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id), picked: false }
}

/** The longest recent run of a mode and difficulty (co-op records come from the runs the profile lists). */
const bestOf = (runs: readonly ProfileRun[], mode: 'coop' | 'versus', difficulty: Difficulty) =>
  runs.filter((r) => r.mode === mode && r.difficulty === difficulty).sort((a, b) => b.time - a.time)[0]

/** Totals over the recent runs the profile lists. */
const historyTiles = (p: PublicProfile) => {
  const s = socialText(), runs = p.recent
  const wins = runs.filter((r) => r.outcome === 'victory').length, best = Math.max(0, ...runs.map((r) => r.time))
  const total = runs.reduce((sum, r) => sum + r.time, 0)
  const tile = (label: string, value: string) => h('div', { class: 'history-tile' }, h('b', {}, value), h('span', {}, label))
  return h('div', { class: 'history-tiles' }, tile(s.historyRuns, String(runs.length)), tile(s.historyWins, String(wins)), tile(s.historyBest, runs.length ? formatTime(best) : '—'), tile(s.historyAverage, runs.length ? formatTime(total / runs.length) : '—'))
}

/** Shares a profile link: the share sheet on phones, the clipboard elsewhere. */
const share = async (root: HTMLElement, p: PublicProfile) => {
  const url = profileUrl(p.handle)
  try {
    if (navigator.share) return await navigator.share({ title: `${p.name} (@${p.handle}) · Pokémon Survivors`, url })
    await navigator.clipboard.writeText(url)
    toast(root, t().profile.copied, 2200)
  } catch {
    // Share sheet dismissed, or no clipboard: nothing to undo.
  }
}

/**
 * A public profile (`/?u=handle` opens it straight away): photo and wallpaper, name, handle, the
 * equipped title, favourite (or most used) Pokémon, friends, records per difficulty, a summary of
 * recent runs, Desafio do dia ribbons, Pokédex progress and recent ranked runs. Signed in, it
 * offers Add friend; on one's own it is the account page: Edit, Friends, Trainer Card, Sync and Sign out.
 * Back, Esc or Backspace close it and call `onClose` after the key dispatch.
 */
export const profileScreen = (root: HTMLElement, input: Input, handle: string, onClose: () => void): Screen => {
  const el = h('div', { class: 'screen dim profile-screen' })
  let nav: ReturnType<typeof menu> | null = null
  /** The editor, the card or the friends, open over the profile. */
  let sub: Screen | null = null
  let current = handle
  let request = 0
  let closed = false

  const frame = (body: Node[], actions: Action[], opening = false) => {
    const m = t().profile
    const buttons = actions.map((a) => h('button', { class: 'btn' }, a.label))
    const at = Math.min(nav?.index ?? 0, buttons.length - 1)
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actions[i]!.run)), { horizontal: true, initial: at })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop profile' : 'dialog box profile' },
        h('div', { class: 'dialog-title' }, m.title),
        ...body,
        h('div', { class: 'buttons' }, ...buttons),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  const back = (): Action => ({ label: t().profile.back, run: close })

  const show = (p: PublicProfile) => {
    const m = t().profile
    const total = pokedex().length
    const signedIn = accountState().kind === 'signedIn'
    const s = socialText()
    const addFriend: Action = {
      label: s.addFriend,
      run: async () => {
        const sent = await requestFriend(p.handle).catch(() => false)
        if (closed) return
        playSfx(sent ? 'unlock' : 'hurt')
        toast(root, sent ? s.requested : s.missing, 2200)
      },
    }
    const shareAction: Action = { label: m.share, run: () => void share(root, p) }
    const actions: Action[] = p.self
      ? [{ label: m.edit, run: openEditor }, { label: s.friends, run: openFriends }, { label: m.card, run: () => openCard(p) }, shareAction, { label: t().account.syncNow, run: () => void syncSave() }, { label: t().account.signOut, run: () => void signOut().then(close) }, back()]
      : [...(signedIn ? [addFriend] : []), shareAction, back()]
    const friendsBox = h('div', { class: 'profile-friends' })
    void fillFriends(friendsBox, p.friends ?? [])
    const fav = favourites(p)
    frame(
      [
        h(
          'div',
          { class: 'profile-head', style: `--wallpaper:url(${wallpaperUrl(p.wall)})` },
          h('img', { class: 'profile-portrait', src: headPortrait(p), alt: '' }),
          h('div', { class: 'profile-id' }, h('b', { class: 'profile-name' }, p.name), h('span', { class: 'profile-handle' }, `@${p.handle}`), titleBadge(p.title)),
        ),
        ...(p.brought ? [h('p', { class: 'profile-social' }, m.brought(p.brought))] : []),
        !p.self && !signedIn ? note(m.followGuest) : null,
        ...(fav.ids.length
          ? [section(fav.picked ? s.favorites : s.mostUsed, h('div', { class: 'profile-favs' }, ...fav.ids.map((id) => h('div', { class: 'profile-fav', title: finalForm(id).name }, h('img', { src: portraitUrl(finalForm(id).dex), alt: finalForm(id).name }), h('span', {}, finalForm(id).name)))))]
          : []),
        section(s.friends, friendsBox),
        section(s.matchHistory, historyTiles(p)),
        section(
          m.records,
          h('small', { class: 'profile-subhead' }, s.recordsSolo),
          h('div', { class: 'profile-records' }, ...DIFFICULTY_IDS.map((d) => recordCell(d, p.records[d]))),
          h('small', { class: 'profile-subhead' }, s.recordsCoop),
          h('div', { class: 'profile-records' }, ...DIFFICULTY_IDS.map((d) => recordCell(d, bestOf(p.recent, 'coop', d)))),
          h('small', { class: 'profile-subhead' }, s.recordsVersus),
          h('p', { class: 'profile-versus' }, p.online ? s.versusTally(p.online.versusWins, p.online.versusRuns) : '—'),
        ),
        ...(p.online ? [section(s.onlineStats, h('div', { class: 'online-stats' }, ...ONLINE_STATS.map((key) => h('div', {}, h('span', {}, s[key]), h('b', {}, p.online![key])))))] : []),
        ribbonRow(p.ribbons),
        section(
          m.dex,
          h('div', { class: 'profile-dex' }, h('span', { class: 'progress' }, h('span', { style: `width:${Math.min(100, Math.round((p.dex.caught / Math.max(1, total)) * 100))}%` })), h('span', {}, m.dexLine(p.dex.caught, p.dex.seen, total))),
        ),
        section(m.recent, ...(p.recent.length > 0 ? [h('div', { class: 'profile-runs' }, ...p.recent.map(recentRow))] : [note(m.noRuns)])),
      ].filter((n) => n !== null),
      actions,
    )
  }

  /** The friends' names, a dozen at most; each chip opens that trainer's profile. */
  const fillFriends = async (box: HTMLElement, uids: string[]) => {
    const s = socialText()
    if (!uids.length) return box.append(note(s.noFriendsYet))
    const found = (await Promise.all(uids.slice(0, 12).map((id) => readTrainer(id).catch(() => null)))).filter((f): f is FriendProfile => f !== null)
    if (closed) return
    box.replaceChildren(...found.map((f) => h('button', { class: 'friend-chip', onclick: () => { current = f.handle; void load() } }, f.name)),
      ...(uids.length > 12 ? [h('small', {}, s.more(uids.length - 12))] : []))
  }

  const load = async (opening = false) => {
    const m = t().profile
    const id = ++request
    frame([note(m.loading, 'blink')], [back()], opening)
    const p = await fetchProfile(current)
    if (id !== request || closed) return
    if (p === 'missing') return frame([note(m.missing(current))], [back()])
    if (!p) return frame([note(m.offline)], [{ label: m.retry, run: () => void load() }, back()])
    show(p)
  }

  /**
   * The Trainer Card's share preview over one's own profile: drawn from this
   * device's save, with the Pokémon of the longest record as the partner.
   */
  const openCard = (p: PublicProfile) => {
    nav?.off()
    el.classList.add('hidden')
    const best = Object.values(p.records).sort((a, b) => b.time - a.time)[0]
    sub = sharePreview(root, input, trainerShare(best?.starter ?? 'charmander'), () => {
      sub = null
      el.classList.remove('hidden')
      show(p)
    })
  }

  /** The friends screen over one's own profile; the list shown here is reloaded when it closes. */
  const openFriends = () => {
    nav?.off()
    el.classList.add('hidden')
    sub = friendsScreen(root, input, () => {
      sub = null
      el.classList.remove('hidden')
      void load()
    })
  }

  /** The editor replaces the profile until it closes; a saved one may have a new handle. */
  const openEditor = () => {
    nav?.off()
    el.classList.add('hidden')
    sub = profileEditor(root, input, (saved) => {
      sub = null
      el.classList.remove('hidden')
      const s = accountState()
      if (saved && s.kind === 'signedIn' && s.handle) current = s.handle
      void load()
    })
  }

  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  const dispose = () => {
    request++
    sub?.dispose()
    nav?.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  void load(true)
  return { el, dispose, dim: 0.5 }
}

/**
 * Picks the public handle and display name, on the first sign in and from the
 * profile. Starts from the current ones, or a suggestion from the Google name.
 * Checks the handle as it's typed; a taken one comes back with a free
 * suggestion. `onClose(saved)` runs after the key dispatch.
 */
export const profileEditor = (root: HTMLElement, input: Input, onClose: (saved: boolean) => void): Screen => {
  const m = t().profile
  const s = accountState()
  const known = s.kind === 'signedIn' && s.handle ? s.handle : null
  const nameInput = h('input', { class: 'field-input', type: 'text', maxlength: 24, autocomplete: 'nickname', spellcheck: 'false', enterkeyhint: 'next' })
  const handleInput = h('input', { class: 'field-input', type: 'text', maxlength: 21, autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done' })
  nameInput.value = s.kind === 'signedIn' ? s.name : ''
  handleInput.value = known ?? ''
  const message = h('p', { class: 'field-message' }, m.handleHint)
  const suggestion = h('button', { class: 'btn hidden', type: 'button' })
  const save = h('button', { class: 'btn confirm', type: 'submit' }, m.save)
  const skip = h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, m.later)
  let busy = false
  let closed = false
  // How the profile looks (photo, favourites, wallpaper): saved only when the player touches a picker.
  const so = socialText(), mine = loadSave()
  const owned = PLAYABLE_IDS.filter((id) => ownsPokemon(mine, id)).sort((x, y) => PLAYABLE[x].line[0].dex - PLAYABLE[y].line[0].dex)
  const walls = styleIds('wallpaper').filter((id) => ownsStyle(mine.style, 'wallpaper', id))
  const { unlocked } = mine.achievements
  const titles: TitleId[] = [...mine.titles, ...MEDAL_TITLE_IDS.filter((id) => unlocked.includes(id))]
  let photo: PlayableId | null = null, wall: WallpaperId | null = null, favs: PlayableId[] = [], title: TitleId | null = null, touched = false, loaded = !known
  const search = h('input', { class: 'field-input look-search', type: 'search', placeholder: so.searchPokemon, 'aria-label': so.searchPokemon, autocomplete: 'off', spellcheck: 'false' })
  const titleList = h('div', { class: 'title-list' })
  const photoGrid = h('div', { class: 'bg-grid' }), favGrid = h('div', { class: 'bg-grid' }), wallGrid = h('div', { class: 'wall-grid' })
  const cell = (id: PlayableId, on: boolean, pick: () => void) =>
    h('button', { class: on ? 'bg-cell selected' : 'bg-cell', type: 'button', title: finalForm(id).name, 'aria-label': finalForm(id).name, 'aria-pressed': String(on), onclick: () => { if (!loaded) return; touched = true; pick(); renderLook() } },
      h('img', { src: portraitUrl(finalForm(id).dex), alt: '', loading: 'lazy' }))
  const renderLook = () => {
    const q = search.value.trim().toLowerCase()
    const list = owned.filter((id) => !q || PLAYABLE[id].line.some((form) => form.name.toLowerCase().includes(q)) || String(PLAYABLE[id].line[0].dex) === q).slice(0, 90)
    photoGrid.replaceChildren(...list.map((id) => cell(id, photo === id, () => { photo = photo === id ? null : id })))
    favGrid.replaceChildren(...list.map((id) => cell(id, favs.includes(id), () => { favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id].slice(-3) })))
    titleList.replaceChildren(
      h('button', { class: title === null ? 'title-chip selected' : 'title-chip', type: 'button', onclick: () => { if (!loaded) return; touched = true; title = null; renderLook() } }, so.noTitle),
      ...titles.map((id) => h('button', { class: title === id ? 'title-chip selected' : 'title-chip', type: 'button', onclick: () => { if (!loaded) return; touched = true; title = id; renderLook() } }, t().achievements.titles[id])))
    wallGrid.replaceChildren(...walls.map((id) => h('button', { class: (wall ?? 'classic') === id ? 'wall-cell selected' : 'wall-cell', type: 'button', style: `--wallpaper:url(${wallpaperUrl(id)})`, 'aria-label': t().mart.styles.wallpaper[id], onclick: () => { if (!loaded) return; touched = true; wall = id === 'classic' ? null : id; renderLook() } }, h('span', {}, t().mart.styles.wallpaper[id]))))
  }
  search.addEventListener('input', renderLook)
  if (known) void fetchProfile(known).then((p) => { if (p && p !== 'missing' && !touched) { photo = p.photo ?? null; wall = p.wall ?? null; favs = p.favs ?? []; title = p.title; renderLook() } }).finally(() => { loaded = true })
  renderLook()

  const setMessage = (text: string, error = false) => {
    message.textContent = text
    message.classList.toggle('error', error)
  }

  /** What's wrong with the fields right now, or null. */
  const problem = () => {
    const handle = normalizeHandle(handleInput.value)
    const why = handleProblem(handle)
    if (why) return m.problems[why]
    return parseDisplayName(nameInput.value) ? null : m.problems.name
  }

  const check = () => {
    suggestion.classList.add('hidden')
    const why = handleInput.value.trim() ? problem() : null
    setMessage(why ?? m.handleHint, why !== null)
  }

  const offerSuggestion = (handle: string | null) => {
    suggestion.classList.toggle('hidden', !handle)
    if (!handle) return
    suggestion.textContent = m.useSuggestion(handle)
    suggestion.onclick = () => ((handleInput.value = handle), check(), handleInput.focus())
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    const why = problem()
    if (why) return setMessage(why, true)
    busy = true
    save.textContent = m.saving
    const result = await saveProfile({ handle: normalizeHandle(handleInput.value), name: parseDisplayName(nameInput.value)! })
    busy = false
    save.textContent = m.save
    if (closed) return
    if (result.ok) {
      if (touched) await setProfileLook({ photo, wall, favs: favs.length ? favs : null, title }).catch(() => false)
      return (playSfx('unlock'), close(true))
    }
    playSfx('hurt')
    if (result.reason === 'taken') return (setMessage(m.problems.taken, true), offerSuggestion(result.suggestion))
    setMessage(result.reason === 'invalid' ? (problem() ?? m.saveFailed) : m.saveFailed, true)
  }

  nameInput.addEventListener('input', check)
  handleInput.addEventListener('input', check)

  const field = (label: string, control: HTMLElement, prefix?: string) =>
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-box' }, prefix && h('span', { class: 'field-prefix' }, prefix), control))

  const form = h(
    'form',
    { class: 'dialog box pop profile-editor', novalidate: true, onsubmit: (e: Event) => void submit(e) },
    h('div', { class: 'dialog-title' }, m.editTitle),
    h('p', { class: 'profile-note' }, m.editIntro),
    field(m.name, nameInput),
    field(m.handle, handleInput, '@'),
    message,
    suggestion,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, so.titleLabel), titleList, h('small', { class: 'profile-note small' }, so.titleNote)),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, so.photo), search, photoGrid),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, so.favoritesPick), favGrid),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, so.wallpaper), wallGrid, h('small', { class: 'profile-note small' }, so.wallpaperNote)),
    h('p', { class: 'profile-note small' }, m.publicNote),
    h('div', { class: 'buttons' }, save, skip),
    h('p', { class: 'hint keys-only' }, m.editHintKeys),
  )
  // Inside the fields the game's keys are off (see `createInput`), so Esc is caught here.
  form.addEventListener('keydown', (e) => e.key === 'Escape' && close(false))
  const offKeys = input.onKey((key) => key === 'Escape' && close(false))

  // First profile: suggest a handle from the Google name, unless the player started typing.
  if (!known) {
    void accountRealName().then((real) => {
      if (closed || handleInput.value) return
      handleInput.value = suggestHandle(real || nameInput.value)
      if (!nameInput.value) nameInput.value = parseDisplayName(real) ?? ''
      check()
    })
  }

  const el = h('div', { class: 'screen dim' }, form)
  const dispose = () => (offKeys(), el.remove())

  function close(saved: boolean) {
    if (closed) return
    closed = true
    if (!saved) playSfx('select')
    dispose()
    later(() => onClose(saved))
  }

  root.append(el)
  // A keyboard pops up on its own only where there's a physical one to type with.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) nameInput.focus()
  return { el, dispose, dim: 0.5 }
}
