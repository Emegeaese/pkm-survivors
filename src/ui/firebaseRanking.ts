import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { readFirebaseBoard, type BoardOptions } from '../firebaseRanking'
import { accountUserId } from '../account'
import { firebaseText } from '../i18n/firebase'
import { t } from '../i18n'
import { h, later } from './dom'
import { portraitUrl } from '../render/sprites'
import { PLAYABLE } from '../data/hatchlings'
import type { Screen } from './screens'
import { DIFFICULTY_IDS } from '../game/difficulty'
import { BOARD_PERIODS } from '../game/ranking'
import { friendIds } from '../firebaseSocial'
import { profileScreen } from './profile'
import { scoreboardText } from '../i18n/leaderboards'
import { parseLineup, type ScoreEntry } from '../game/leaderboards'

/** Every Pokémon the team played (a co-op row), or the one Pokémon of a solo or versus row. */
const mons = (entry: ScoreEntry) => {
  const lineup = parseLineup(entry.lineup)
  const shown = lineup.length > 0 ? lineup : [{ starter: entry.starter, stage: entry.stage }]
  return h('span', { class: `rank-mons n${shown.length}` }, ...shown.map((p, i) => {
    const form = PLAYABLE[p.starter].line[Math.min(p.stage, PLAYABLE[p.starter].line.length - 1)]!
    const owner = lineup.length > 1 ? entry.names[i] : undefined
    return h('img', { src: portraitUrl(form.dex), alt: form.name, title: owner ? `${owner}: ${form.name}` : form.name })
  }))
}

export const firebaseRankingScreen = (root: HTMLElement, input: Input, back: () => void): Screen => {
  const f = firebaseText(), m = t().ranking, options: BoardOptions = { mode: 'solo', period: 'all', difficulty: 'normal', teamSize: 2 }
  const text = scoreboardText()
  const scope = h('select', { 'aria-label': text.player }, h('option', { value: 'all' }, text.all), h('option', { value: 'friends' }, text.friends))
  const mine = h('p', { class: 'rank-personal', 'aria-live': 'polite' })
  let sub: Screen | null = null
  const modes = ['solo', 'coop', 'versus'] as const
  const tabs = modes.map((mode) => h('button', { class: 'btn', onclick: () => { options.mode = mode; void refresh() } }, f[mode]))
  const period = h('select', { 'aria-label': m.title }, ...BOARD_PERIODS.map((p) => h('option', { value: p, selected: p === 'all' }, m.periods[p])))
  const difficulty = h('select', { 'aria-label': t().difficulty.label }, ...DIFFICULTY_IDS.map((d) => h('option', { value: d }, t().difficulty.names[d])))
  const size = h('select', { 'aria-label': f.teams }, ...[2, 3, 4].map((n) => h('option', { value: n }, `${n}`)))
  const status = h('p', { role: 'status' }), rows = h('div', { class: 'rank-list firebase-rank-list' })
  let request = 0, disposed = false
  const refresh = async () => {
    const token = ++request
    tabs.forEach((b, i) => b.classList.toggle('selected', modes[i] === options.mode))
    size.classList.toggle('hidden', options.mode !== 'coop'); difficulty.classList.toggle('hidden', options.mode === 'versus')
    status.textContent = m.loading
    rows.replaceChildren(); mine.textContent = ''
    let friends = new Set<string>()
    try { if (scope.value === 'friends') friends = await friendIds() } catch { if (!disposed && token === request) status.textContent = m.offline; return }
    const entries = await readFirebaseBoard({ ...options, difficulty: options.mode === 'versus' ? 'normal' : options.difficulty })
    if (disposed || token !== request) return
    status.textContent = entries === null ? m.offline : entries.length ? '' : m.empty
    const position = entries?.findIndex((e) => e.team.includes(accountUserId() ?? '')) ?? -1
    mine.textContent = entries === null ? '' : position >= 0 ? `${text.mine}: #${position + 1}` : text.outside
    const visible = (entries ?? []).map((entry, i) => ({ entry, rank: i + 1 })).filter(({ entry }) => scope.value !== 'friends' || entry.team.some((uid) => friends.has(uid) || uid === accountUserId()))
    if (entries && !visible.length) status.textContent = scope.value === 'friends' && !accountUserId() ? text.login : m.empty
    rows.replaceChildren(...visible.map(({ entry, rank }) => h('div', { class: `rank-row${rank <= 3 ? ` top${rank}` : ''}${entry.team.includes(accountUserId() ?? '') ? ' me' : ''}` },
      h('span', { class: 'rank-pos' }, `#${rank}`), mons(entry),
      h('span', { class: 'rank-who' }, h('button', { class: 'rank-profile', onclick: () => {
        if (sub) return
        el.classList.add('hidden'); sub = profileScreen(root, input, entry.handle, () => { sub = null; el.classList.remove('hidden') })
      } }, entry.name), h('small', {}, options.mode === 'coop' ? entry.names.join(' · ') : `@${entry.handle}`)),
      h('span', { class: 'rank-time' }, h('b', {}, options.mode === 'versus' ? `${entry.wins} ${f.wins}` : formatTime(entry.time)), h('small', {}, `${text.kills}: ${entry.kills} · ${t().level(entry.level)}`)))))
  }
  period.onchange = () => { options.period = BOARD_PERIODS.find((p) => p === period.value) ?? 'all'; void refresh() }
  difficulty.onchange = () => { options.difficulty = DIFFICULTY_IDS.find((d) => d === difficulty.value) ?? 'normal'; void refresh() }
  size.onchange = () => { options.teamSize = Number(size.value); void refresh() }
  scope.onchange = () => { void refresh() }
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.title), h('div', { class: 'buttons' }, ...tabs), h('div', { class: 'feature-tools' }, period, difficulty, size, scope), h('p', {}, f.info), h('small', {}, `${text.top} · ${text.tie}`), mine,
    h('button', { class: 'btn', onclick: () => rows.querySelector('.me')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, text.jump), status, rows,
    h('div', { class: 'buttons' }, h('button', { class: 'btn', onclick: () => { void refresh() } }, m.retry), h('button', { class: 'btn', onclick: back }, m.back))))
  const off = input.onKey((key) => { if (!sub && (key === 'Escape' || key === 'Backspace')) later(back) })
  root.append(el); void refresh()
  return { el, dispose: () => { disposed = true; sub?.dispose(); off(); el.remove() } }
}
