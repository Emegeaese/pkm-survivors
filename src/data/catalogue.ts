import { ENEMIES, type EnemyDef } from './enemies'
import { TYPE_COLORS, type PokeType } from './types'
import type { EvolutionStage, PlayableDef } from './starters'
import type { MoveId } from '../game/moves'
import { CATALOGUE_IDS } from './catalogue-ids'

export type CatalogueId = (typeof CATALOGUE_IDS)[number]
const SIGNATURE: Record<PokeType, MoveId> = {
  normal: 'swift', fire: 'ember', water: 'waterGun', grass: 'razorLeaf', electric: 'thunder',
  ice: 'iceShard', fighting: 'machPunch', poison: 'sludgeBomb', ground: 'earthquake',
  flying: 'gust', psychic: 'psyshock', bug: 'pinMissile', rock: 'rockTomb', ghost: 'hex',
  dragon: 'dragonBreath', dark: 'crunch', steel: 'flashCannon', fairy: 'disarmingVoice',
}

/** All species with shipped art can be played; existing families keep their authored evolution lines. */
export const catalogueOf = (families: Record<string, PlayableDef>): Record<CatalogueId, PlayableDef> => {
  const first = new Set(Object.values(families).map((p) => p.line[0].dex))
  const stages = new Map<number, EvolutionStage>()
  for (const p of Object.values(families)) for (const stage of p.line) stages.set(stage.dex, stage)
  for (const e of Object.values(ENEMIES) as EnemyDef[]) if (!stages.has(e.dex)) stages.set(e.dex, { dex: e.dex, name: e.name, types: e.types, bonus: {} })
  return Object.fromEntries([...stages.values()].filter((p) => !first.has(p.dex)).map((p) => {
    const signature = SIGNATURE[p.types[0] ?? 'normal']
    const learnset = [...new Set([signature, ...p.types.map((t) => SIGNATURE[t]), 'swift', 'quickAttack', 'rockTomb'] as MoveId[])]
    return [`dex${p.dex}`, {
      name: p.name, color: TYPE_COLORS[p.types[0] ?? 'normal'], stats: {}, signature, learnset,
      line: [{ dex: p.dex, name: p.name, types: p.types, bonus: {} }],
    } satisfies PlayableDef]
  })) as unknown as Record<CatalogueId, PlayableDef>
}

export const generationOf = (dex: number) => 1 + [151, 251, 386, 493, 649, 721, 809, 905].filter((last) => dex > last).length
