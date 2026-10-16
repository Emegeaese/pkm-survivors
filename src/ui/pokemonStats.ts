import type { PlayableId } from '../data/hatchlings'
import { PLAYABLE, PLAYABLE_IDS } from '../data/hatchlings'
import { starterStats } from '../game/leveling'
import { t } from '../i18n'
import { STAT_BARS, statRatio } from './statBars'
import { h } from './dom'

export const playableFormOf = (dex: number) => {
  for (const id of PLAYABLE_IDS) {
    const stage = PLAYABLE[id].line.findIndex((form) => form.dex === dex)
    if (stage >= 0) return { id, stage }
  }
  return null
}
export const pokemonStats = (id: PlayableId, stage = 0) => {
  const stats = starterStats(id, stage)
  return h('div', { class: 'stat-bars pokemon-stats' }, ...STAT_BARS.map((b) => h('div', { class: 'stat-bar' }, h('span', { class: 'stat-label' }, t().stats[b.label]),
    h('div', { class: 'bar' }, h('div', { class: 'bar-base', style: `width:${statRatio(b.get(stats), b.min, b.max) * 100}%` })), h('b', {}, b.fmt(b.get(stats))))))
}
