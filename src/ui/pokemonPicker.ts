import type { Input } from '../engine/input'
import type { PlayableId } from '../data/hatchlings'
import type { Screen } from './screens'
import { starterSelect } from './starterSelect'

/**
 * The partner select (starters, eggs and every Pokémon, difficulty, details) reused to pick a Pokémon
 * for a friends room: no wallet, settings or incubator, just the pick. `onPick` gets the id;
 * `onBack` runs when the player leaves without one.
 */
export const pokemonPicker = (root: HTMLElement, input: Input, initial: PlayableId, onPick: (id: PlayableId) => void, onBack: () => void): Screen =>
  starterSelect(root, input, { pick: onPick, back: onBack }, initial)
