import type { Input } from '../engine/input'
import { dismissInvite, watchInvites, type Invite } from '../firebaseInvites'
import { featureText } from '../i18n/features'
import { socialText } from '../i18n/social'
import { h, later } from './dom'
import type { Screen } from './screens'

/** The invitations friends sent: join the room from here, or decline. `onJoin` gets the room code. */
export const invitesScreen = (root: HTMLElement, input: Input, onJoin: (code: string) => void, back: () => void): Screen => {
  const s = socialText(), m = featureText()
  let disposed = false, stop = () => {}
  const status = h('p', { role: 'status' }, s.noInvites), list = h('div', { class: 'friends-list' })
  const render = (invites: Invite[]) => {
    status.classList.toggle('hidden', invites.length > 0)
    list.replaceChildren(...invites.map((i) => h('div', { class: 'box friend-row invite-row' },
      h('b', {}, i.name), h('span', {}, s.invitedYou(i.name, i.mode === 'coop' ? m.coop : m.versus)),
      h('div', { class: 'buttons' },
        h('button', { class: 'btn', onclick: () => { void dismissInvite(i.id).catch(() => {}); later(() => onJoin(i.code)) } }, s.joinInvite),
        h('button', { class: 'btn', onclick: () => { void dismissInvite(i.id).catch(() => {}) } }, s.decline)))))
  }
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, s.invitations(0)), status, list, h('button', { class: 'btn', onclick: () => later(close) }, s.back)))
  root.append(el)
  void watchInvites(render, () => { if (!disposed) status.textContent = s.error }).then((off) => { if (disposed) off(); else stop = off }).catch(() => { if (!disposed) status.textContent = s.error })
  const off = input.onKey((key) => { if (key === 'Escape') later(close) })
  const dispose = () => { if (disposed) return; disposed = true; stop(); off(); el.remove() }
  function close() { dispose(); back() }
  return { el, dispose }
}
