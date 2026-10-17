import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { watchInvites } from '../firebaseInvites'
import { accountUserId } from '../account'
import { socialText } from '../i18n/social'
import { t } from '../i18n'
import { eggIcon, giftIcon, pokeballIcon, medalIcon } from '../render/art'
import { h, later } from './dom'
import type { Screen } from './screens'
import { backButton, shellScreen, topBar } from './shell'
import { nearestInDirection, type Direction } from './spatial'

/** What JOGAR leads to: solo, a co-op or versus room with friends, or the invitations and the room code. */
export type PlayMode = 'solo' | 'coop' | 'versus' | 'invites' | 'join'

const DIRECTIONS: Readonly<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }

/**
 * "How do you want to play?": three big cards (Solo, Co-op, Versus) and, below,
 * the invitations from friends and the room code. Arrows move, Enter picks,
 * Esc/Backspace and ◀ go back. `pick` runs after this press is done.
 */
export const playModesScreen = (root: HTMLElement, input: Input, actions: { pick: (mode: PlayMode) => void; back: () => void }): Screen => {
  const s = socialText()
  let closed = false
  let at = 0
  const card = (mode: PlayMode, icon: string, label: string, blurb: string, big: boolean) =>
    h(
      'button',
      { class: big ? `mode-card box ${mode}` : `mode-row box ${mode}`, type: 'button', onclick: () => choose(mode) },
      h('img', { src: icon, alt: '' }),
      h('span', { class: 'mode-text' }, h('b', {}, label), h('small', {}, blurb)),
    )
  const invites = card('invites', giftIcon(), s.invitations(0), s.modeInvitesBlurb, false)
  const items: { mode: PlayMode; el: HTMLElement }[] = [
    { mode: 'solo', el: card('solo', pokeballIcon(), s.modeSolo, s.modeSoloBlurb, true) },
    { mode: 'coop', el: card('coop', eggIcon('friend'), s.modeCoop, s.modeCoopBlurb, true) },
    { mode: 'versus', el: card('versus', medalIcon('gold'), s.modeVersus, s.modeVersusBlurb, true) },
    { mode: 'invites', el: invites },
    { mode: 'join', el: card('join', giftIcon(), s.modeJoin, s.modeJoinBlurb, false) },
  ]
  const labelOf = invites.querySelector('b')!
  let stopInvites = () => {}
  if (accountUserId()) void watchInvites((list) => { labelOf.textContent = s.invitations(list.length); invites.classList.toggle('waiting', list.length > 0) }, () => {}).then((off) => { if (closed) off(); else stopInvites = off }).catch(() => {})

  const select = (i: number, sound = true) => {
    if (i < 0 || i >= items.length) return
    if (i !== at && sound) playSfx('move')
    at = i
    items.forEach((item, j) => item.el.classList.toggle('selected', j === at))
  }
  const choose = (mode: PlayMode) => {
    if (closed) return
    playSfx('select')
    select(items.findIndex((item) => item.mode === mode), false)
    later(() => actions.pick(mode))
  }
  const back = () => {
    if (closed) return
    playSfx('move')
    later(actions.back)
  }
  const off = input.onKey((key) => {
    const dir = DIRECTIONS[key]
    if (dir) return select(nearestInDirection(items.map((item) => item.el.getBoundingClientRect()), at, dir) >= 0 ? nearestInDirection(items.map((item) => item.el.getBoundingClientRect()), at, dir) : at)
    if (key === 'Enter' || key === 'Space') return choose(items[at]!.mode)
    if (key === 'Escape' || key === 'Backspace') back()
  })
  const el = shellScreen({
    class: 'modes-screen',
    top: topBar({ left: backButton(back), title: s.modeTitle }),
    body: [h('div', { class: 'modes' }, h('div', { class: 'mode-cards' }, ...items.slice(0, 3).map((i) => i.el)), h('div', { class: 'mode-rows' }, ...items.slice(3).map((i) => i.el)), h('p', { class: 'modes-hint' }, t().shell.back))],
  })
  root.append(el)
  select(0, false)
  return { el, dispose: () => { closed = true; off(); stopInvites(); el.remove() } }
}
