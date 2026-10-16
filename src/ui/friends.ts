import type { Input } from '../engine/input'
import { accountHandle, accountUserId } from '../account'
import { readTrainer, requestFriend, respondFriend, watchFriends, type FriendProfile, type Friendship } from '../firebaseSocial'
import { socialText } from '../i18n/social'
import { h, later } from './dom'
import { profileScreen } from './profile'
import { tradingScreen } from './trading'
import type { Screen } from './screens'

export const friendsScreen = (root: HTMLElement, input: Input, back: () => void): Screen => {
  const m = socialText(), uid = accountUserId()!
  let disposed = false, busy = false, revision = 0, stop = () => {}, sub: Screen | null = null
  const profiles = new Map<string, FriendProfile>()
  const handle = h('input', { 'aria-label': m.handle, placeholder: '@usuario', maxlength: 21, autocapitalize: 'none' }), status = h('p', { role: 'status' })
  const list = h('div', { class: 'friends-list' })
  const run = async (action: () => Promise<unknown>) => {
    if (busy || disposed) return
    busy = true; status.textContent = m.loading
    try { await action(); if (!disposed && status.textContent === m.loading) status.textContent = '' } catch { if (!disposed) status.textContent = m.error } finally { busy = false }
  }
  const add = h('button', { class: 'btn', type: 'submit' }, m.add)
  const form = h('form', { class: 'feature-tools', onsubmit: (e) => {
    e.preventDefault(); void run(async () => {
      add.disabled = true
      try { const sent = await requestFriend(handle.value); if (!disposed) { status.textContent = sent ? m.sent : m.missing; if (sent) handle.value = '' } } finally { add.disabled = false }
    })
  } }, handle, add)
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.friends), h('p', {}, `${m.myHandle}: @${accountHandle() ?? ''}`), form, status, list,
    h('button', { class: 'btn', onclick: () => later(close) }, m.back)))
  const open = (create: (close: () => void) => Screen) => {
    if (sub) return
    el.classList.add('hidden')
    sub = create(() => { sub?.dispose(); sub = null; el.classList.remove('hidden') })
  }
  const render = async (friends: Friendship[]) => {
    const token = ++revision
    const ids = friends.map((f) => f.users.find((id) => id !== uid)!)
    await Promise.all(ids.filter((id) => !profiles.has(id)).map(async (id) => { const p = await readTrainer(id); if (p) profiles.set(id, p) }))
    if (disposed || token !== revision) return
    list.replaceChildren(...friends.map((friend, i) => {
      const p = profiles.get(ids[i]!), incoming = friend.to === uid
      return h('div', { class: 'box friend-row' }, h('b', {}, p?.name ?? ids[i]!), h('span', {}, p ? `@${p.handle}` : ''),
        h('span', {}, friend.status === 'accepted' ? '✓' : incoming ? m.incoming : m.pending), h('div', { class: 'buttons' },
          ...(friend.status === 'pending' && incoming ? [h('button', { class: 'btn', onclick: () => { void run(() => respondFriend(friend, true)) } }, m.accept)] : []),
          ...(p ? [h('button', { class: 'btn', onclick: () => open((close) => profileScreen(root, input, p.handle, close)) }, m.profile)] : []),
          ...(p && friend.status === 'accepted' ? [h('button', { class: 'btn', onclick: () => open((close) => tradingScreen(root, input, p, close)) }, m.trade)] : []),
          h('button', { class: 'btn', onclick: () => { void run(() => respondFriend(friend, false)) } }, friend.status === 'accepted' ? m.remove : incoming ? m.reject : m.cancel)))
    }))
    if (!friends.length) list.append(h('p', {}, m.empty))
  }
  const dispose = () => { if (disposed) return; disposed = true; revision++; stop(); off(); sub?.dispose(); el.remove() }
  const close = () => { dispose(); back() }
  const off = input.onKey((key) => { if (!sub && key === 'Escape') later(close) })
  root.append(el)
  void watchFriends((next) => { void render(next).catch(() => { if (!disposed) status.textContent = m.error }) }, () => { if (!disposed) status.textContent = m.error })
    .then((off) => { if (disposed) off(); else stop = off }).catch(() => { if (!disposed) status.textContent = m.error })
  return { el, dispose, tick: (time) => sub?.tick?.(time) }
}
