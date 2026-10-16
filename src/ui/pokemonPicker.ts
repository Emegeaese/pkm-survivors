import type { Input } from '../engine/input'
import type { PlayableId } from '../data/hatchlings'
import { firebaseText } from '../i18n/firebase'
import { h } from './dom'
import { catalogueSelect } from './catalogue'
import type { Screen } from './screens'
import { starterSelect } from './starterSelect'
import { titleButton } from './title'

/**
 * The solo Pokémon select (regions, difficulty, inspect sheet, "all Pokémon") reused to pick a
 * Pokémon for a friends room. `onPick` gets the id; `onBack` runs when the player leaves without one.
 */
export const pokemonPicker = (root: HTMLElement, input: Input, initial: PlayableId, onPick: (id: PlayableId) => void, onBack: () => void): Screen => {
  let current: (Screen & { selected: () => PlayableId }) | null = null, closeBack: (() => void) | null = null, disposed = false
  const show = (build: () => Screen & { selected: () => PlayableId }, decorate?: (screen: Screen & { selected: () => PlayableId }) => void) => {
    current?.dispose(); closeBack?.()
    const screen = build()
    decorate?.(screen)
    closeBack = titleButton(root, input, () => onBack())
    current = screen
  }
  const regions = (start: PlayableId) => show(
    () => starterSelect(root, input, { pick: onPick }, start),
    (select) => {
      const all = h('button', { class: 'btn all-pokemon-entry', onclick: () => catalogue(select.selected()) }, firebaseText().catalogue)
      select.el.querySelector('.select-footer')?.append(all)
    },
  )
  const catalogue = (start: PlayableId) => show(() => catalogueSelect(root, input, { pick: onPick }, start))
  regions(initial)
  return { el: root, dispose: () => { if (disposed) return; disposed = true; current?.dispose(); closeBack?.() } }
}
