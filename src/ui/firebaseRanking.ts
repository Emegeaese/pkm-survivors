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

export const firebaseRankingScreen = (root: HTMLElement, input: Input, back: () => void): Screen => {
  const f = firebaseText(), m = t().ranking, options: BoardOptions = { mode: 'solo', period: 'all', difficulty: 'normal', teamSize: 2 }
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
    const entries = await readFirebaseBoard({ ...options, difficulty: options.mode === 'versus' ? 'normal' : options.difficulty })
    if (disposed || token !== request) return
    status.textContent = entries === null ? m.offline : entries.length ? '' : m.empty
    rows.replaceChildren(...(entries ?? []).map((entry, i) => h('div', { class: `rank-row${entry.team.includes(accountUserId() ?? '') ? ' me' : ''}` },
      h('span', { class: 'rank-pos' }, `#${i + 1}`), h('img', { src: portraitUrl(PLAYABLE[entry.starter].line[entry.stage]!.dex), alt: PLAYABLE[entry.starter].name }),
      h('span', { class: 'rank-who' }, h('b', {}, entry.name), h('small', {}, entry.names.join(' · '))),
      h('span', { class: 'rank-time' }, h('b', {}, options.mode === 'versus' ? `${entry.wins} ${f.wins}` : formatTime(entry.time)), h('small', {}, `${entry.kills} · ${t().level(entry.level)}`)))))
  }
  period.onchange = () => { options.period = BOARD_PERIODS.find((p) => p === period.value) ?? 'all'; void refresh() }
  difficulty.onchange = () => { options.difficulty = DIFFICULTY_IDS.find((d) => d === difficulty.value) ?? 'normal'; void refresh() }
  size.onchange = () => { options.teamSize = Number(size.value); void refresh() }
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.title), h('div', { class: 'buttons' }, ...tabs), h('div', { class: 'feature-tools' }, period, difficulty, size), h('p', {}, f.info), status, rows,
    h('div', { class: 'buttons' }, h('button', { class: 'btn', onclick: () => { void refresh() } }, m.retry), h('button', { class: 'btn', onclick: back }, m.back))))
  const off = input.onKey((key) => { if (key === 'Escape' || key === 'Backspace') later(back) })
  root.append(el); void refresh()
  return { el, dispose: () => { disposed = true; off(); el.remove() } }
}
