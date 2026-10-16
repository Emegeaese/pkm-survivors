import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { EXTRA_PLAYABLE, PLAYABLE, PLAYABLE_IDS } from '../data/hatchlings'
import { CATALOGUE_IDS } from '../data/catalogue-ids'
import { STARTER_IDS } from '../data/starters'
import { bannerPool, bannerRarity, bundleTickets, mergeGacha, ownsPokemon, parseGacha, pullGacha, runTickets, tickets } from './gacha'
import { EMPTY_SAVE, parseSave } from './meta'
import { mergeSaves } from './sync'
import { createGame } from './game'

describe('ticket gacha and catalogue', () => {
  it('keeps all 27 starters free and all shipped species playable after unlocking', () => {
    expect(PLAYABLE_IDS.filter((id) => ownsPokemon(EMPTY_SAVE, id))).toEqual(STARTER_IDS)
    expect([...CATALOGUE_IDS].sort()).toEqual(Object.keys(EXTRA_PLAYABLE).sort())
    for (const id of PLAYABLE_IDS) {
      const g = createGame(id, { w: 480, h: 270 }, 1)
      expect(g.player.hp).toBeGreaterThan(0)
      expect(g.player.moves[0]?.id).toBe(PLAYABLE[id].signature)
    }
  })
  it('charges only the chosen ticket currency, never overspends or mutates the input', () => {
    const before = JSON.stringify(EMPTY_SAVE)
    const result = pullGacha(EMPTY_SAVE, 10, 1, createRng(44))!
    expect(tickets(result.save.gacha)).toBe(0)
    expect(result.pulls.some((p) => p.rarity >= 4)).toBe(true)
    expect(pullGacha(result.save, 1, 1, createRng(2))).toBeNull()
    expect(JSON.stringify(EMPTY_SAVE)).toBe(before)
    const bundled = pullGacha({ ...EMPTY_SAVE, gacha: { ...EMPTY_SAVE.gacha, bundles: 1 } }, 10, 1, createRng(2), true)!
    expect(tickets(bundled.save.gacha)).toBe(10)
    expect(bundleTickets(bundled.save.gacha)).toBe(0)
  })
  it('guarantees a real top prize on the 70th draw in every generation', () => {
    for (let gen = 1; gen <= 9; gen++) {
      const save = { ...EMPTY_SAVE, gacha: { ...EMPTY_SAVE.gacha, banners: { [gen]: { pity: 69, pulls: 69 } } } }
      const result = pullGacha(save, 1, gen, createRng(gen))!
      expect(result.pulls[0]!.rarity).toBe(5)
      expect(result.save.gacha.banners[gen]!.pity).toBe(0)
      expect(bannerPool(gen)).toContain(result.pulls[0]!.id)
      expect(bannerPool(gen).some((id) => bannerRarity(id, gen) === 5)).toBe(true)
    }
  })
  it('persists playable shiny unlocks and gives refunds only for duplicates', () => {
    const result = pullGacha(EMPTY_SAVE, 10, 1, () => 0)!
    expect(result.pulls[0]!.fresh).toBe(true)
    expect(result.pulls[0]!.shiny).toBe(true)
    expect(result.pulls[1]!.fresh).toBe(false)
    const id = result.pulls[0]!.id
    const restored = parseSave(JSON.stringify(result.save))
    expect(restored.gacha.shiny[id]).toBe(true)
    expect(restored.shinyStarters[id]).toBe(true)
    expect(ownsPokemon(restored, id)).toBe(true)
    expect(restored.wallet).toBeGreaterThan(0)
  })
  it('rejects corrupt fields and merges spent tickets without restoring purchases', () => {
    const parsed = parseGacha({ earned: Infinity, used: -100, shiny: { evil: true }, owned: { evil: 5 }, banners: { 1: { pulls: 10, pity: 900 } } })
    expect(parsed.earned).toBe(10); expect(parsed.used).toBe(0); expect(parsed.owned).toEqual({}); expect(parsed.banners[1]!.pity).toBe(69)
    const spent = pullGacha(EMPTY_SAVE, 10, 1, createRng(2))!.save
    const merged = mergeSaves(EMPTY_SAVE, spent)
    expect(tickets(merged.gacha)).toBe(0)
    expect(mergeGacha(merged.gacha, spent.gacha)).toEqual(merged.gacha)
    expect(mergeGacha(spent.gacha, EMPTY_SAVE.gacha)).toEqual(mergeGacha(EMPTY_SAVE.gacha, spent.gacha))
    expect(runTickets({ time: 360, bossKills: 2, victory: true })).toBe(12)
  })
})
