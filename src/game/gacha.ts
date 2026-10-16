import { HATCHLINGS, PLAYABLE, PLAYABLE_IDS, isHatchling, type PlayableId } from '../data/hatchlings'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { generationOf } from '../data/catalogue'
import { hasShinySprite } from '../data/bodies'
import { chance, pick, weightedPick, type Rng } from '../engine/rng'
import { isRecord, wholeNumber } from './parse'
import type { Save } from './meta'
import type { RunSummary } from './tally'
import { markHatch } from './dex'
import { STARTER_IDS } from '../data/starters'

export const STARTING_POKEMON: readonly PlayableId[] = STARTER_IDS
export const BANNERS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'] as const
export const RATES = [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1.5]] as const
export const PITY = 70
export const SHINY_CHANCE = 0.01
export type Rarity = 1 | 2 | 3 | 4 | 5
export type Gacha = {
  earned: number; used: number; bundles: number; bundlesUsed: number
  owned: Partial<Record<PlayableId, number>>
  shiny: Partial<Record<PlayableId, true>>
  banners: Record<string, { pulls: number; pity: number }>
}
export const EMPTY_GACHA: Gacha = { earned: 10, used: 0, bundles: 0, bundlesUsed: 0, owned: {}, shiny: {}, banners: {} }
export const parseGacha = (raw: unknown): Gacha => {
  if (!isRecord(raw)) return { ...EMPTY_GACHA, owned: {}, shiny: {}, banners: {} }
  const owned = isRecord(raw.owned) ? raw.owned : {}
  const shiny = isRecord(raw.shiny) ? raw.shiny : {}
  const banners = isRecord(raw.banners) ? raw.banners : {}
  return {
    earned: Math.max(10, wholeNumber(raw.earned)), used: wholeNumber(raw.used), bundles: wholeNumber(raw.bundles), bundlesUsed: wholeNumber(raw.bundlesUsed),
    owned: Object.fromEntries(PLAYABLE_IDS.flatMap((id) => wholeNumber(owned[id]) > 0 ? [[id, wholeNumber(owned[id])]] : [])),
    shiny: Object.fromEntries(PLAYABLE_IDS.flatMap((id) => shiny[id] === true && hasShinySprite(PLAYABLE[id].line[0].dex) ? [[id, true]] : [])),
    banners: Object.fromEntries(BANNERS.map((_, i) => {
      const b = banners[i + 1]
      return isRecord(b) ? [[i + 1, { pulls: wholeNumber(b.pulls), pity: wholeNumber(b.pity, PITY - 1) }]] : []
    }).flat()),
  }
}
export const tickets = (g: Gacha) => Math.max(0, g.earned - g.used)
export const bundleTickets = (g: Gacha) => Math.max(0, g.bundles - g.bundlesUsed)
export const ownsPokemon = (s: Save, id: PlayableId) => STARTING_POKEMON.includes(id) || (s.gacha.owned[id] ?? 0) > 0 || (isHatchling(id) && !!s.hatched[id])
export const ownsShiny = (s: Save, id: PlayableId) => s.gacha.shiny[id] === true || id in s.shinyStarters || (isHatchling(id) && s.hatched[id]?.shiny === true)

const enemyByDex = new Map((Object.values(ENEMIES) as EnemyDef[]).map((e) => [e.dex, e]))
export const rarityOf = (id: PlayableId): Rarity => {
  const p = PLAYABLE[id]
  const enemy = enemyByDex.get(p.line[0].dex)
  if (enemy?.legendary || p.line[0].dex === 493) return 5
  if (isHatchling(id)) {
    const tier = ({ common: 1, rare: 3, ultra: 4, friend: 4 } as const)[HATCHLINGS[id].egg]
    return tier
  }
  return (enemy?.tier ?? (p.line.length === 1 ? 4 : 3)) as Rarity
}

export const bannerPool = (gen: number) => PLAYABLE_IDS.filter((id) => generationOf(PLAYABLE[id].line[0].dex) === gen)
/** Generations without a legendary use their highest available rarity as the top prize. */
export const bannerRarity = (id: PlayableId, gen: number): Rarity => {
  const pool = bannerPool(gen)
  const max = Math.max(...pool.map(rarityOf))
  return rarityOf(id) === max ? 5 : rarityOf(id)
}
export type Pull = { id: PlayableId; rarity: Rarity; shiny: boolean; fresh: boolean; refund: number }
export const pullGacha = (save: Save, count: 1 | 10, gen: number, rng: Rng, bundle = false): { save: Save; pulls: Pull[] } | null => {
  if ((count !== 1 && count !== 10) || !Number.isInteger(gen) || gen < 1 || gen > 9 || (bundle && count !== 10)) return null
  if (bundle ? bundleTickets(save.gacha) < 1 : tickets(save.gacha) < count) return null
  const pool = bannerPool(gen)
  if (!pool.length) return null
  const g: Gacha = { ...save.gacha, owned: { ...save.gacha.owned }, shiny: { ...save.gacha.shiny }, banners: { ...save.gacha.banners } }
  const state = { ...(g.banners[gen] ?? { pulls: 0, pity: 0 }) }
  const pulls: Pull[] = []
  let wallet = save.wallet
  let dex = save.dex
  const shinyStarters = { ...save.shinyStarters }
  for (let i = 0; i < count; i++) {
    const min = state.pity >= PITY - 1 ? 5 : count === 10 && i === 9 && !pulls.some((p) => p.rarity >= 4) ? 4 : 1
    const available = RATES.filter(([r]) => r >= min && pool.some((id) => bannerRarity(id, gen) === r))
    const rarity = weightedPick(rng, available)
    const id = pick(rng, pool.filter((id) => bannerRarity(id, gen) === rarity))
    const shiny = hasShinySprite(PLAYABLE[id].line[0].dex) && chance(rng, SHINY_CHANCE)
    const fresh = shiny ? !ownsShiny({ ...save, gacha: g }, id) : !ownsPokemon({ ...save, gacha: g }, id)
    const refund = fresh ? 0 : [0, 15, 30, 60, 120, 300][rarity]! * (shiny ? 3 : 1)
    g.owned[id] = (g.owned[id] ?? 0) + 1
    if (shiny) { g.shiny[id] = true; shinyStarters[id] = true }
    dex = markHatch(dex, PLAYABLE[id].line.map((s) => s.dex), shiny)
    wallet += refund
    state.pulls++; state.pity = rarity === 5 ? 0 : state.pity + 1
    pulls.push({ id, rarity, shiny, fresh, refund })
  }
  if (bundle) g.bundlesUsed++; else g.used += count
  g.banners[gen] = state
  return { save: { ...save, wallet, dex, shinyStarters, gacha: g }, pulls }
}

export const runTickets = (r: Pick<RunSummary, 'time' | 'bossKills' | 'victory'>) => Math.floor(r.time / 120) + r.bossKills * 2 + (r.victory ? 5 : 0)
export const mergeGacha = (a: Gacha, b: Gacha): Gacha => ({
  earned: Math.max(a.earned, b.earned), used: Math.max(a.used, b.used), bundles: Math.max(a.bundles, b.bundles), bundlesUsed: Math.max(a.bundlesUsed, b.bundlesUsed),
  owned: Object.fromEntries(PLAYABLE_IDS.flatMap((id) => Math.max(a.owned[id] ?? 0, b.owned[id] ?? 0) > 0 ? [[id, Math.max(a.owned[id] ?? 0, b.owned[id] ?? 0)]] : [])),
  shiny: { ...a.shiny, ...b.shiny },
  banners: Object.fromEntries(BANNERS.map((_, i) => {
    const x = a.banners[i + 1] ?? { pulls: 0, pity: 0 }, y = b.banners[i + 1] ?? { pulls: 0, pity: 0 }
    return [i + 1, x.pulls > y.pulls ? x : y.pulls > x.pulls ? y : { pulls: x.pulls, pity: Math.min(x.pity, y.pity) }]
  })),
})
