import type { Input } from '../engine/input'
import { PLAYABLE, PLAYABLE_IDS, playableDex, type PlayableId } from '../data/hatchlings'
import { DIFFICULTY_IDS } from '../game/difficulty'
import { pokemonPicker } from './pokemonPicker'
import { showcaseDex } from './showcase'
import { difficultyPicker } from './starterSelect'
import { ownsPokemon, ownsShiny } from '../game/gacha'
import { createMatch, matchHash, NETWORK_VERSION, REVIVE_SECONDS, selectMember, spectatorTarget, stepMatch, versusRadius, type Match, type MatchMode, type Trainer } from '../game/multiplayer'
import { toSteps } from '../game/eggs'
import type { RunSummary } from '../game/tally'
import { runEarnings } from '../game/meta'
import { recordRun, mergeDex } from '../game/dex'
import { summarizeRun } from '../game/tally'
import { rosterSchedule } from '../game/roster'
import { render } from '../render/draw'
import { progressArc } from '../render/mapEvents'
import { drawJoystick } from '../render/joystick'
import { drawPokemon, portraitUrl, loadAll, preloadShinies, sprites, streamSpecies } from '../render/sprites'
import { playSfx, unlockAudio } from '../engine/audio'
import { accountState, accountUserId } from '../account'
import { accountScreen } from './account'
import { friendsScreen } from './friends'
import { socialText } from '../i18n/social'
import { publishSocialStats } from '../firebaseSocial'
import { createFirebaseRoomConnection, type RoomConnection } from '../network/firebaseRooms'
import { createDevRoomConnection } from '../network/devRoom'
import { firebaseText } from '../i18n/firebase'
import { startTeamRanking, finishTeamRanking } from '../firebaseRanking'
import { runResult } from '../game/ranking'
import { t } from '../i18n'
import { featureText } from '../i18n/features'
import { h, later } from './dom'
import { bankEggs, depositPokeDollars, loadSave, recordRunProgress, updateSave } from './save'
import { settings } from './settings'
import { createHud, type Hud } from './hud'
import { levelUp, type Screen } from './screens'

type Lobby = { code: string; mode: MatchMode; difficulty?: string; seed: number; host: string; players: Array<Trainer & { ready: boolean }> }
const readStorage = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const store = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* Session only. */ } }

/** The lobby owns its socket, input handlers, HUD and overlays; leaving tears down all of them. */
export const multiplayerScreen = (root: HTMLElement, input: Input, ctx: CanvasRenderingContext2D, view: { w: number; h: number }, back: () => void): Screen => {
  const m = featureText(), save = loadSave(), params = new URLSearchParams(location.search)
  const f = firebaseText()
  const devRoom = import.meta.env.DEV ? params.get('devroom') : null
  // The trainer's name is the account's: it is the one friends and the ranking already know.
  const name = { get value() { const s = accountState(); return (s.kind === 'signedIn' && s.name ? s.name : readStorage('pkm:trainer', 'Trainer')).slice(0, 24) } }
  const code = h('input', { value: params.get('room')?.slice(0, 6) ?? '', maxlength: 6, placeholder: m.code, 'aria-label': m.code, autocapitalize: 'characters' })
  const owned = PLAYABLE_IDS.filter((id) => ownsPokemon(save, id)).sort((a, b) => PLAYABLE[a].line[0].dex - PLAYABLE[b].line[0].dex)
  const remembered = readStorage('pkm:friend-starter', 'charmander')
  let chosen: PlayableId = owned.find((id) => id === remembered) ?? owned[0] ?? 'charmander'
  const chosenImg = h('img', { alt: '' }), chosenName = h('b')
  const pokemon = h('button', { class: 'btn pokemon-choice', type: 'button', 'aria-label': m.collection, onclick: () => openPicker() }, chosenImg, chosenName)
  const drawChosen = () => { chosenImg.src = portraitUrl(showcaseDex(chosen)); chosenName.textContent = PLAYABLE[chosen].name }
  const shiny = h('input', { type: 'checkbox' })
  const difficulty = difficultyPicker(save.difficulty)
  const mode = h('select', { 'aria-label': m.friends }, h('option', { value: 'coop' }, m.coop), h('option', { value: 'versus' }, m.versus), h('option', { value: 'duel' }, m.duel))
  // Difficulty only matters against the horde.
  mode.onchange = () => difficulty.el.classList.toggle('hidden', mode.value !== 'coop')
  const status = h('p', { role: 'status', 'aria-live': 'polite' }), players = h('div', { class: 'room-players' })
  const actions = h('div', { class: 'buttons' }), joinActions = h('div', { class: 'buttons' })
  const config = h('div', { class: 'room-config' }, h('label', {}, m.collection, pokemon), h('label', {}, shiny, m.shiny), h('label', {}, m.friends, mode), difficulty.el, h('label', {}, m.code, code))
  const panel = h('div', { class: 'feature-panel box room-panel' }, h('h1', {}, m.friends), h('p', {}, m.lobbyInfo), config, status, players, joinActions, actions)
  const el = h('div', { class: 'screen feature-screen room-screen' }, panel)
  root.append(el)
  let ws: RoomConnection | null = null, self = '', lobby: Lobby | null = null, match: Match | null = null, hud: Hud | null = null, overlay: Screen | null = null, authScreen: Screen | null = null
  let ranking: ReturnType<typeof startTeamRanking> | null = null
  let disposed = false, paid = false, ended = false, victoryShown = false, sequence = 0, sendAt = 0, timeout: ReturnType<typeof setTimeout> | null = null
  let paidCoins = 0, paidSummary: RunSummary | null = null, paidSteps = 0, paidEggs = 0
  let paidTickets = 0
  let special = false, mega = false, lunge = false
  let overlayKey: unknown = null
  let watching: string | null = null
  const watchName = h('span')
  const cycleWatch = (direction: number) => { if (match) watching = spectatorTarget(match, self, watching, direction)?.trainer.id ?? null }
  const spectator = h('div', { class: 'room-spectator box hidden' },
    h('button', { class: 'btn', 'aria-label': m.previousPlayer, onclick: () => cycleWatch(-1) }, '◀'),
    watchName, h('button', { class: 'btn', 'aria-label': m.nextPlayer, onclick: () => cycleWatch(1) }, '▶'))
  const cards = new Map<string, { card: HTMLElement; fill: HTMLElement; hp: HTMLElement }>()
  const team = h('div', { class: 'room-team hidden' }), notice = h('p', { class: 'room-notice hidden', role: 'status' })
  root.append(team, notice, spectator)
  const send = (data: object) => { if (ws?.readyState === 1) ws.send(JSON.stringify(data)) }
  const disconnect = () => { const old = ws; ws = null; old?.close(); if (timeout) clearTimeout(timeout); timeout = null }
  const selected = () => chosen
  const refreshShiny = () => { shiny.disabled = !ownsShiny(save, selected()); if (shiny.disabled) shiny.checked = false }
  drawChosen(); refreshShiny()
  /** The solo select (regions, difficulty, inspect sheet, every Pokémon) over the room screen. */
  let picker: Screen | null = null
  const openPicker = () => {
    if (picker) return
    panel.classList.add('hidden')
    const close = () => { picker?.dispose(); picker = null; panel.classList.remove('hidden'); drawChosen(); refreshShiny(); difficulty.sync() }
    picker = pokemonPicker(root, input, chosen, (id) => { chosen = id; store('pkm:friend-starter', id); later(close) }, () => later(close))
  }
  const finish = (interrupted = false) => {
    if (!match || (paid && match.mode === 'versus')) return
    const beforeTickets = loadSave().gacha.earned
    const local = match.members.find((p) => p.trainer.id === self)!
    const online = { mode: match.mode, finished: paidSummary?.online?.finished === true || (!interrupted && match.result !== null), won: paidSummary?.online?.won === true || match.result === 'victory' || match.result === self, revivals: local.revivals }
    if (match.mode === 'coop') {
      const g = selectMember(match, self)
      const phase = g.phase
      if (match.result === 'victory') g.phase = 'victory'
      const earnings = runEarnings(g).coins + (match.result === 'victory' || g.endless ? runEarnings(g).bonus : 0)
      depositPokeDollars(Math.max(0, earnings - paidCoins)); paidCoins = Math.max(paidCoins, earnings)
      updateSave((s) => ({ ...s, dex: mergeDex(s.dex, recordRun(save.dex, g.dexLog)) }))
      const steps = toSteps(g.player.walked)
      bankEggs(Math.max(0, steps - paidSteps), g.eggs.found.slice(paidEggs).map((e) => ({ tier: e.tier, steps: Math.max(0, steps - toSteps(e.at)) })))
      paidSteps = steps; paidEggs = g.eggs.found.length
      const summary = summarizeRun(g)
      summary.online = online
      recordRunProgress(summary, paidSummary, 0); paidSummary = summary
      g.phase = phase
    } else if (!interrupted && match.result && match.game.time >= 60) {
      // A full versus match pays participation; immediate forfeits cannot farm tickets.
      const summary = { ...summarizeRun(selectMember(match, self)), victory: false, online }
      recordRunProgress(summary, paidSummary, 0); paidSummary = summary
    }
    paidTickets += Math.max(0, loadSave().gacha.earned - beforeTickets)
    void publishSocialStats().catch(() => {})
    paid = true
    if (ranking && (match.result || (match.mode === 'coop' && match.game.time >= 60))) {
      const g = selectMember(match, self), result = runResult(g, __GAME_VERSION__)
      if (match.mode === 'versus') result.outcome = match.result === self ? 'victory' : 'death'
      if (match.result === 'victory') result.outcome = 'victory'
      if (!match.result) result.outcome = 'quit'
      const lineup = match.members.map((p) => ({ starter: p.state.starter, stage: p.state.player.stage }))
      void ranking.then((session) => finishTeamRanking(session, result, lineup))
    }
  }
  const showEnd = (message: string, interrupted = false) => {
    if (ended) return
    ended = true
    finish(interrupted)
    overlay?.dispose(); overlay = null; hud?.dispose(); hud = null
    notice.classList.add('hidden'); team.classList.add('hidden'); spectator.classList.add('hidden')
    panel.replaceChildren(h('h1', {}, m.results), h('p', {}, message), h('p', {}, `🎟 ${m.reward}: ${paidTickets}`), h('button', { class: 'btn', onclick: () => later(back) }, m.again))
    panel.classList.remove('hidden'); el.classList.remove('room-playing')
    send({ type: 'finish' })
  }
  const fail = (message = m.error) => {
    if (disposed) return
    if (match) { showEnd(message, true); disconnect(); return }
    disconnect(); lobby = null; status.textContent = message; config.classList.remove('hidden'); players.replaceChildren(); actions.replaceChildren(); showJoin()
  }
  const command = (kind: string, index?: number) => send({ type: 'command', kind, index })
  const leave = () => { finish(true); disconnect(); later(back) }
  const showJoin = () => joinActions.replaceChildren(h('button', { class: 'btn', onclick: () => connect('create') }, m.create), h('button', { class: 'btn', onclick: () => connect('join') }, m.join),
    ...(accountUserId() ? [h('button', { class: 'btn', onclick: () => {
      panel.classList.add('hidden'); authScreen = friendsScreen(root, input, () => { authScreen = null; panel.classList.remove('hidden'); showJoin() })
    } }, socialText().friends)] : []),
    ...(!accountUserId() ? [h('button', { class: 'btn', onclick: () => {
      panel.classList.add('hidden'); authScreen = accountScreen(root, input, () => { authScreen = null; panel.classList.remove('hidden'); showJoin() })
    } }, f.login)] : []), h('button', { class: 'btn', onclick: leave }, m.back))
  const ready = async () => {
    if (!lobby || !ws) return
    const snapshot = lobby, socket = ws
    status.textContent = m.loading
    actions.querySelectorAll('button').forEach((b) => { b.disabled = true })
    try {
      const preview = createMatch(lobby.players.length >= 2 ? lobby.players : [...lobby.players, { ...lobby.players[0]!, id: 'preview' }], lobby.mode, lobby.seed, DIFFICULTY_IDS.find((d) => d === snapshot.difficulty) ?? 'normal')
      const dex = [...lobby.players.flatMap((p) => playableDex(p.starter)), ...rosterSchedule(preview.game.roster).filter((s) => s.at === 0).map((s) => s.dex)]
      await loadAll(dex)
      await Promise.all(lobby.players.filter((p) => p.shiny).map((p) => preloadShinies(playableDex(p.starter))))
      if (disposed || ws !== socket || lobby?.players.map((p) => p.id).join() !== snapshot.players.map((p) => p.id).join()) return
      send({ type: 'ready', ready: true })
    } catch { fail(m.error) }
  }
  const showLobby = () => {
    if (!lobby) return
    const snapshot = lobby
    config.classList.add('hidden'); joinActions.replaceChildren()
    status.textContent = `${lobby.code} · ${lobby.mode === 'coop' ? m.coop : m.versus}${snapshot.mode === 'coop' ? ` · ${t().difficulty.names[DIFFICULTY_IDS.find((d) => d === snapshot.difficulty) ?? 'normal']}` : ''}`
    players.replaceChildren(...lobby.players.map((p) => h('div', { class: 'room-player box' }, h('img', { src: `/assets/pokemon/${PLAYABLE[p.starter].line[0].dex}/portrait.png`, alt: '' }), h('b', {}, p.name), h('span', {}, PLAYABLE[p.starter].name), h('span', {}, p.ready ? '✓' : '…'))))
    const myself = lobby.players.find((p) => p.id === self)
    actions.replaceChildren(h('button', { class: 'btn', disabled: myself?.ready, onclick: ready }, m.ready),
      ...(lobby.host === self ? [h('button', { class: 'btn', disabled: lobby.players.length < 2 || !lobby.players.every((p) => p.ready), onclick: () => send({ type: 'start' }) }, m.start)] : []),
      h('button', { class: 'btn', onclick: () => { const url = new URL(location.href); url.searchParams.set('room', lobby!.code); void navigator.clipboard?.writeText(url.toString()).then(() => { status.textContent = m.copied }).catch(() => { status.textContent = url.toString() }) } }, m.copy),
      h('button', { class: 'btn', onclick: leave }, m.leave))
  }
  const connect = (kind: 'create' | 'join') => {
    if (ws) return
    if (!devRoom && !accountUserId()) { status.textContent = f.loginRequired; return }
    if (!devRoom && kind === 'join' && !/^[A-Fa-f0-9]{6}$/.test(code.value.trim())) { status.textContent = m.unavailable; return }
    status.textContent = m.connecting
    joinActions.querySelectorAll('button').forEach((b) => { b.disabled = true })
    try { ws = devRoom ? createDevRoomConnection(devRoom) : createFirebaseRoomConnection() } catch { fail(); return }
    const socket = ws
    timeout = setTimeout(() => { if (!lobby) fail() }, 10000)
    ws.onopen = () => send({ type: kind, name: name.value, starter: selected(), shiny: shiny.checked && ownsShiny(save, selected()), mode: mode.value === 'duel' ? 'versus' : mode.value, difficulty: loadSave().difficulty, size: mode.value === 'duel' ? 2 : 4, code: code.value.trim().toUpperCase(), version: `${NETWORK_VERSION}:${__GAME_VERSION__}` })
    ws.onerror = (code) => { if (ws === socket) fail(code === 'auth-required' ? f.loginRequired : code.includes('permission') || code.includes('PERMISSION') ? f.rules : f.error) }
    ws.onclose = () => { if (ws === socket && !ended) fail(m.disconnected) }
    ws.onmessage = (event) => {
      if (disposed || ws !== socket) return
      try {
        const msg = JSON.parse(String(event.data))
        if (msg.type === 'hello') self = msg.id
        else if (msg.type === 'error') fail(m.unavailable)
        else if (msg.type === 'lobby') { lobby = msg; if (timeout) clearTimeout(timeout); showLobby() }
        else if (msg.type === 'start') {
          if (timeout) clearTimeout(timeout)
          ranking = startTeamRanking(msg.mode, msg.players.map((p: Trainer) => p.id), msg.players.map((p: Trainer) => p.name))
          match = createMatch(msg.players, msg.mode, msg.seed, DIFFICULTY_IDS.find((d) => d === msg.difficulty) ?? 'normal')
          panel.classList.add('hidden'); el.classList.add('room-playing'); team.classList.remove('hidden'); notice.classList.remove('hidden')
          hud = createHud(root, () => { special = true }, () => { mega = true }, () => { lunge = true }, () => { if (match?.mode === 'coop') command('pause') })
          cards.clear()
          team.replaceChildren(...match.members.map((p) => {
            const fill = h('span', { class: 'team-hp-fill' }), hp = h('span', { class: 'team-hp-text' })
            cards.set(p.trainer.id, { card: h('div', { class: 'team-card' }), fill, hp })
            const card = cards.get(p.trainer.id)!.card
            card.append(h('img', { src: portraitUrl(PLAYABLE[p.trainer.starter].line[0].dex), alt: '' }), h('div', { class: 'team-info' }, h('b', {}, p.trainer.name), h('span', { class: 'team-hp' }, fill), hp))
            return card
          }), h('button', { class: 'btn room-exit', onclick: leave }, m.leave))
          const schedule = rosterSchedule(match.game.roster).map((s) => s.dex)
          void streamSpecies(schedule)
          unlockAudio()
        } else if (msg.type === 'tick' && match && !ended) {
          if (msg.tick !== sequence + 1) { fail(m.disconnected); return }
          sequence = msg.tick
          stepMatch(match, msg.inputs, msg.commands)
          const held = Object.fromEntries(Object.entries(msg.inputs as Record<string, { move: { x: number; y: number } }>).map(([id, state]) => [id, { move: state.move, special: false, mega: false, lunge: false }]))
          stepMatch(match, held)
          // Simulation events are presentation-only and must never accumulate.
          if (match.game.events.some((e) => e.kind === 'hit')) playSfx('hit')
          match.game.events.length = 0
          if (sequence % 90 === 0) send({ type: 'ack', tick: sequence, hash: matchHash(match) })
          if (match.result) {
            const winner = match.members.find((p) => p.trainer.id === match!.result)
            if (match.result === 'victory' && match.mode === 'coop') {
              if (!victoryShown) {
                victoryShown = true; finish(); overlay?.dispose(); overlay = null; overlayKey = null
                panel.replaceChildren(h('h1', {}, m.teamWin), h('p', {}, `🎟 ${m.reward}: ${paidTickets}`), ...(lobby?.host === self ? [h('button', { class: 'btn', onclick: () => command('endless') }, tEndless())] : [h('p', {}, m.waiting)]), h('button', { class: 'btn', onclick: leave }, m.leave))
                panel.classList.remove('hidden'); el.classList.remove('room-playing')
              }
            } else showEnd(match.mode === 'coop' ? m.defeat : winner ? `${m.winner}: ${winner.trainer.name}` : m.draw)
          } else if (victoryShown) {
            victoryShown = false; panel.classList.add('hidden'); el.classList.add('room-playing')
          }
        } else if (msg.type === 'ended' && !ended) fail(m.disconnected)
      } catch { fail(m.error) }
    }
  }
  const off = input.onKey((key) => {
    if (!match || ended) return
    const fallen = match.members.find((p) => p.trainer.id === self)!.state.player.hp <= 0
    if (fallen && (key === 'KeyQ' || key === 'KeyE')) { cycleWatch(key === 'KeyQ' ? -1 : 1); return }
    if (key === 'Space') special = true
    if (key === 'KeyE') mega = true
    if (key === 'ShiftLeft' || key === 'ShiftRight') lunge = true
    if (key === 'Escape' && match.mode === 'coop') command('pause')
  })
  const tick = (time: number) => {
    picker?.tick?.(time)
    if (!match || ended) return
    if (time - sendAt > 1 / 30) {
      sendAt = time
      send({ type: 'input', move: document.hidden ? { x: 0, y: 0 } : input.readMove(), special, mega, lunge }); special = mega = lunge = false
    }
    const member = match.members.find((p) => p.trainer.id === self)!
    const target = spectatorTarget(match, self, watching)
    watching = target?.trainer.id ?? null
    const spectating = member.state.player.hp <= 0 && target !== undefined && target !== member
    spectator.classList.toggle('hidden', !spectating)
    watchName.textContent = spectating ? `${m.spectating}: ${target.trainer.name}` : ''
    const g = selectMember(match, self)
    // Render in the local viewport, then restore the canonical simulation dimensions.
    const oldView = g.view, oldCamera = g.camera, attacks = g.attacks
    const focus = target?.state.player ?? g.player
    g.view = view; g.camera = { x: focus.x - view.w / 2, y: focus.y - 10 - view.h / 2 }
    g.attacks = match.members.flatMap((p) => p.state.attacks)
    render(ctx, g, time, settings())
    for (const other of match.members) if (other !== member) {
      const p = other.state.player, x = Math.round(p.x - g.camera.x), y = Math.round(p.y - g.camera.y)
      ctx.save(); ctx.globalAlpha = p.hp > 0 ? 1 : 0.35
      drawPokemon(ctx, sprites(PLAYABLE[other.state.starter].line[p.stage]!.dex, p.shiny), p.moving ? 'Walk' : 'Idle', p.dir, p.animTime, x, y)
      const ratio = Math.max(0, p.hp / p.stats.maxHp)
      ctx.fillStyle = '#000'; ctx.fillRect(x - 13, y - 26, 26, 6)
      ctx.fillStyle = '#3b4252'; ctx.fillRect(x - 12, y - 25, 24, 4)
      ctx.fillStyle = hpColor(ratio); ctx.fillRect(x - 12, y - 25, Math.round(24 * ratio), 4)
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
      outlined(ctx, other.trainer.name.slice(0, 12), x, y - 29, match.mode === 'coop' ? '#9dffc0' : '#ff9aa6')
      ctx.restore()
      if (match.mode === 'coop' && other.connected && (x < 0 || y < 0 || x > view.w || y > view.h)) allyArrow(ctx, view, x, y, other.trainer.name, p.hp > 0)
    }
    if (match.mode === 'coop') for (const fallen of match.members) {
      if (!fallen.connected || fallen.state.player.hp > 0 || fallen.revive <= 0) continue
      const p = fallen.state.player, x = Math.round(p.x - g.camera.x), y = Math.round(p.y - 4 - g.camera.y)
      progressArc(ctx, x, y, 19, Math.min(1, fallen.revive / REVIVE_SECONDS), '#80ffad')
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.font = '7px monospace'; ctx.textAlign = 'center'
      ctx.fillText(`${Math.floor(fallen.revive / REVIVE_SECONDS * 100)}%`, x, y + 29); ctx.restore()
    }
    if (match.mode === 'versus') {
      ctx.strokeStyle = '#ff6070'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-g.camera.x, -g.camera.y, versusRadius(g.time), 0, Math.PI * 2); ctx.stroke()
    }
    const stick = input.readStick(); if (stick) drawJoystick(ctx, stick, canvasScale(ctx, view))
    hud?.update(g)
    g.view = oldView; g.camera = oldCamera; g.attacks = attacks
    for (const p of match.members) {
      const view = cards.get(p.trainer.id)
      if (!view) continue
      const ratio = Math.max(0, p.state.player.hp / p.state.player.stats.maxHp), down = !p.connected || p.state.player.hp <= 0
      view.fill.style.width = `${Math.round(ratio * 100)}%`; view.fill.style.background = hpColor(ratio)
      view.hp.textContent = down ? m.down : `${Math.ceil(p.state.player.hp)}/${Math.ceil(p.state.player.stats.maxHp)}`
      view.card.classList.toggle('down', down); view.card.classList.toggle('me', p.trainer.id === self)
    }
    const choosing = match.members.some((p) => p.state.phase === 'levelup' || p.state.phase === 'evolving')
    notice.textContent = match.paused ? m.paused : choosing ? m.waiting : match.mode === 'coop' ? m.revive : ''
    const key = match.paused ? 'paused' : member.state.phase === 'levelup' ? member.state.offers : null
    if (key !== overlayKey) {
      overlayKey = key; overlay?.dispose(); overlay = null
      if (key === 'paused') {
        const pause = h('div', { class: 'screen dim' }, h('div', { class: 'dialog box' }, h('p', {}, m.paused), h('button', { class: 'btn', onclick: () => command('pause') }, m.resume), h('button', { class: 'btn', onclick: leave }, m.leave)))
        root.append(pause); overlay = { el: pause, dispose: () => pause.remove() }
      } else if (key) {
        const offers = member.state.offers
        overlay = levelUp(root, input, g, (offer) => {
          command('pick', offers.indexOf(offer)); overlay?.el.querySelectorAll('button').forEach((b) => { b.disabled = true })
        })
      }
    }
  }
  showJoin()
  if (devRoom) later(() => connect('create'))
  const onVisibility = () => { if (document.hidden) send({ type: 'input', move: { x: 0, y: 0 } }) }
  document.addEventListener('visibilitychange', onVisibility)
  return { el, tick, debug: () => match, playing: () => match && !ended ? selectMember(match, self) : null, dispose: () => { disposed = true; finish(true); disconnect(); off(); document.removeEventListener('visibilitychange', onVisibility); authScreen?.dispose(); overlay?.dispose(); hud?.dispose(); team.remove(); notice.remove(); spectator.remove(); el.remove() } }
}

const hpColor = (ratio: number) => ratio > 0.5 ? '#5fe08a' : ratio > 0.25 ? '#ffd23f' : '#ff5a5a'

/** Text with a dark outline so teammates' names read over any ground. */
const outlined = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) => {
  ctx.fillStyle = '#000'
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.fillText(text, x + dx, y + dy)
  ctx.fillStyle = color; ctx.fillText(text, x, y)
}

/** A marker on the screen edge pointing at a teammate who is out of view (red when they are down). */
const allyArrow = (ctx: CanvasRenderingContext2D, view: { w: number; h: number }, x: number, y: number, name: string, standing: boolean) => {
  const cx = view.w / 2, cy = view.h / 2, dx = x - cx, dy = y - cy
  const k = Math.min((cx - 14) / Math.max(1e-6, Math.abs(dx)), (cy - 14) / Math.max(1e-6, Math.abs(dy)))
  const ex = Math.round(cx + dx * k), ey = Math.round(cy + dy * k), angle = Math.atan2(dy, dx), color = standing ? '#9dffc0' : '#ff6a6a'
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(angle)
  ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.stroke(); ctx.fill()
  ctx.restore()
  ctx.save(); ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'
  outlined(ctx, name.slice(0, 8), Math.min(view.w - 22, Math.max(22, ex - Math.cos(angle) * 20)), Math.min(view.h - 6, Math.max(10, ey - Math.sin(angle) * 14 + 3)), color)
  ctx.restore()
}

const canvasScale = (ctx: CanvasRenderingContext2D, view: { w: number }) => ctx.canvas.getBoundingClientRect().width / view.w
const tEndless = () => t().rifts.continue
