import { accountState, onAccountChange, registerAccount, resetPassword, signIn, type AccountState } from '../account'
import { firebaseErrorCode } from '../firebase'
import { firebaseText } from '../i18n/firebase'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import { h, later } from './dom'
import { profileEditor, profileScreen } from './profile'
import type { Screen } from './screens'

/** Names longer than this are cut on the title's chip (the dialog shows them whole). */
const CHIP_NAME = 10

const chipLabel = (s: AccountState) => {
  if (s.kind !== 'signedIn') return s.kind === 'busy' ? '…' : t().account.signIn
  return s.name.length > CHIP_NAME ? `${s.name.slice(0, CHIP_NAME - 1)}…` : s.name || 'OK'
}

/**
 * Account entry in the title screen's top-right corner (twin of the language
 * switch): "Sign in" for guests, the player's name and a sync dot once signed
 * in. A tap or `C` opens the account dialog. Returns a disposer.
 */
export const accountChip = (root: HTMLElement, input: Input, onOpen: () => void) => {
  const label = h('span', { class: 'account-name' })
  const dot = h('span', { class: 'sync-dot', 'aria-hidden': 'true' })
  const open = () => (playSfx('select'), later(onOpen))
  const el = h('button', { class: 'account-chip box', onclick: open }, dot, label, h('span', { class: 'key-hint' }, 'C'))
  const draw = (s: AccountState) => {
    label.textContent = chipLabel(s)
    dot.dataset.sync = s.kind === 'signedIn' ? s.sync : 'guest'
    el.setAttribute('aria-label', `${t().account.title}: ${chipLabel(s)}`)
  }
  draw(accountState())
  const offState = onAccountChange(draw)
  const offKey = input.onKey((key) => key === 'KeyC' && open())
  root.append(el)
  return () => (offState(), offKey(), el.remove())
}

export const accountScreen = (root: HTMLElement, input: Input, onClose: () => void, options: { guest?: () => void; signedIn?: () => void } = {}): Screen => {
  const m = t().account, f = firebaseText()
  const el = h('div', { class: 'screen dim' }), panel = h('div', { class: 'dialog box account firebase-account' })
  el.append(panel); root.append(el)
  let register = false, pending = false, sub: Screen | null = null, disposed = false
  const error = h('p', { class: 'account-error', role: 'status', 'aria-live': 'polite' })
  const email = h('input', { type: 'email', autocomplete: 'email', required: true, 'aria-label': f.email })
  const password = h('input', { type: 'password', autocomplete: 'current-password', minlength: 6, required: true, 'aria-label': f.password })
  const name = h('input', { type: 'text', autocomplete: 'nickname', maxlength: 24, 'aria-label': f.name })
  const showError = (e: unknown) => {
    const code = firebaseErrorCode(e)
    error.textContent = code.includes('email-already-in-use') ? f.exists : code.includes('weak-password') ? f.weak : code.includes('operation-not-allowed') ? f.disabled : /invalid|wrong-password|user-not-found/.test(code) ? f.invalid : f.error
  }
  const close = () => { dispose(); later(onClose) }
  const openProfile = (editor: boolean) => {
    panel.classList.add('hidden')
    // Signed in, the profile is the account page: leaving it leaves the account screen.
    const back = () => { sub = null; if (accountState().kind === 'signedIn') { close(); return } panel.classList.remove('hidden'); build() }
    const s = accountState()
    sub = editor || s.kind !== 'signedIn' || !s.handle ? profileEditor(root, input, back) : profileScreen(root, input, s.handle, back)
  }
  const submit = async (event: Event) => {
    event.preventDefault()
    if (pending) return
    pending = true; error.textContent = m.busy
    panel.querySelectorAll('button').forEach((b) => { b.disabled = true })
    try {
      if (register) await registerAccount(email.value, password.value, name.value); else await signIn(email.value, password.value)
      password.value = ''
      if (options.signedIn) { dispose(); later(options.signedIn); return }
      error.textContent = ''
    } catch (e) { showError(e) }
    finally { pending = false; if (!disposed) build() }
  }
  const build = () => {
    if (disposed || sub || pending) return
    const s = accountState()
    if (s.kind === 'signedIn') { openProfile(!s.handle); return }
    const button = h('button', { class: 'btn', type: 'submit' }, register ? f.register : f.login)
    const form = h('form', { onsubmit: (e) => { void submit(e) } }, h('label', {}, f.email, email), h('label', {}, f.password, password), ...(register ? [h('label', {}, f.name, name)] : []), error, button)
    password.autocomplete = register ? 'new-password' : 'current-password'
    panel.replaceChildren(h('h2', {}, register ? f.register : f.login), h('p', {}, register ? f.registerInfo : f.loginInfo), form,
      h('div', { class: 'buttons' }, h('button', { class: 'btn', onclick: () => { register = !register; error.textContent = ''; build() } }, register ? f.login : f.register),
        h('button', { class: 'btn', onclick: () => {
          if (!email.validity.valid || !email.value) { email.reportValidity(); return }
          void resetPassword(email.value).then(() => { error.textContent = f.resetSent }).catch(showError)
        } }, f.reset), ...(options.guest ? [h('button', { class: 'btn', onclick: () => { dispose(); later(options.guest!) } }, m.playAsGuest)] : []), h('button', { class: 'btn', onclick: close }, m.back)))
  }
  const offState = onAccountChange(() => { if (!pending) build() })
  const offKey = input.onKey((key) => { if ((key === 'Escape' || key === 'Backspace') && !sub && !pending) close() })
  const dispose = () => { if (disposed) return; disposed = true; offState(); offKey(); sub?.dispose(); el.remove() }
  build()
  return { el, dispose }
}

export const playGate = (root: HTMLElement, input: Input, actions: { play: () => void; guest: () => void; back: () => void }) => accountScreen(root, input, actions.back, { guest: actions.guest, signedIn: actions.play })
