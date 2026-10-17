import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { loadSave } from './save'

/** The dex number a menu portrait shows for a Pokémon: its final evolution once the player has played that starter, else its first form. */
export const showcaseDex = (id: PlayableId, played: readonly string[] = loadSave().achievements.lifetime.starters) => {
  const line = PLAYABLE[id].line
  return (played.includes(id) ? line[line.length - 1]! : line[0]).dex
}
