import { firebaseServices } from './firebase'
import { applyPush, type Stored } from './game/sync'
import { parseSave, parseSaveData } from './game/meta'
import { applyGift, type Gift } from './game/gifts'
import type { Hatch } from './game/eggs'
import { parseHandle, suggestHandle, type ProfileName } from './game/ranking'
import { loadSave, onSaveChange, writeSave } from './ui/save'
import type { User } from 'firebase/auth'

export const accountsEnabled = true
export const backFromSignIn = () => false
export type SyncStatus = 'syncing' | 'synced' | 'offline'
export type AccountState = { kind: 'guest'; failed?: boolean } | { kind: 'busy' } | { kind: 'signedIn'; name: string; sync: SyncStatus; handle: string | null | undefined }
export type ProfileSaved = { ok: true } | { ok: false; reason: 'taken'; suggestion: string | null } | { ok: false; reason: 'invalid' | 'offline' }
export type GiftArrival = { gift: Gift; hatch: Hatch | null }
let state: AccountState = { kind: 'guest' }, current: User | null = null, started = false, switching = false, profileVersion = 0
let syncing: Promise<void> | null = null, syncAgain = false, timer: ReturnType<typeof setTimeout> | null = null
let stopTradeInventory: (() => void) | null = null
const listeners = new Set<(s: AccountState) => void>(), giftListeners = new Set<(g: readonly GiftArrival[], n: number) => void>()
const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const store = (key: string, value: string | null) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* Local play remains usable. */ } }
const emit = (next: AccountState) => { state = next; for (const fn of listeners) fn(next) }
const syncState = (sync: SyncStatus) => { if (state.kind === 'signedIn') emit({ ...state, sync }) }
export const accountState = () => state
export const accountUserId = () => current?.uid ?? null
export const accountHandle = () => state.kind === 'signedIn' ? state.handle ?? null : null
export const accountRealName = async () => current?.displayName || current?.email?.split('@')[0] || ''
export const sessionToken = async () => current ? current.getIdToken() : null
export const onAccountChange = (fn: (s: AccountState) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const storedRef = () => read('ps:ref')
export const storeRef = (handle: string) => store('ps:ref', handle)
export const onGifts = (fn: (g: readonly GiftArrival[], n: number) => void) => { giftListeners.add(fn); return () => { giftListeners.delete(fn) } }
export const receiveGifts = (gifts: readonly Gift[]) => {
  const arrived: GiftArrival[] = [], claim: string[] = []; let waiting = 0
  for (const gift of gifts) {
    const out = applyGift(loadSave(), gift)
    if (out.status === 'wait') waiting++; else claim.push(gift.id)
    if (out.status === 'applied') { writeSave(out.save); arrived.push({ gift, hatch: out.hatch }) }
  }
  if (arrived.length || waiting) for (const fn of giftListeners) fn(arrived, waiting)
  return { claim, landed: arrived.length > 0 }
}

export const saveProfile = async (profile: ProfileName): Promise<ProfileSaved> => {
  if (!current || !parseHandle(profile.handle) || !profile.name.trim() || profile.name.length > 24) return { ok: false, reason: 'invalid' }
  const uid = current.uid
  try {
    const { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
    const free = await runTransaction(firestore, async (tx) => {
      const handleRef = doc(firestore, 'pkmHandles', profile.handle), profileRef = doc(firestore, 'pkmProfiles', uid)
      const [reserved, old] = await Promise.all([tx.get(handleRef), tx.get(profileRef)])
      if (reserved.exists() && reserved.data().uid !== uid) return false
      const previous = old.data()?.handle
      if (typeof previous === 'string' && previous !== profile.handle) tx.delete(doc(firestore, 'pkmHandles', previous))
      tx.set(handleRef, { uid })
      const keep = old.data()
      tx.set(profileRef, { uid, name: profile.name.trim(), handle: profile.handle, updatedAt: serverTimestamp(), ...(typeof keep?.photo === 'string' ? { photo: keep.photo } : {}), ...(typeof keep?.wall === 'string' ? { wall: keep.wall } : {}), ...(typeof keep?.title === 'string' ? { title: keep.title } : {}), ...(Array.isArray(keep?.favs) ? { favs: keep.favs } : {}), ...(Array.isArray(keep?.friends) ? { friends: keep.friends } : {}) })
      return true
    })
    if (!free) return { ok: false, reason: 'taken', suggestion: `${profile.handle.slice(0, 14)}_${uid.slice(0, 4).toLowerCase()}` }
    if (current?.uid === uid) { profileVersion++; emit({ kind: 'signedIn', name: profile.name.trim(), handle: profile.handle, sync: state.kind === 'signedIn' ? state.sync : 'offline' }) }
    return { ok: true }
  } catch { return { ok: false, reason: 'offline' } }
}

const syncOnce = async () => {
  if (!current || switching) return
  const uid = current.uid, sent = JSON.stringify(loadSave()), revision = read(`pkm:revision:${uid}`)
  syncState('syncing')
  try {
    const { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
    const merged = await runTransaction(firestore, async (tx) => {
      const ref = doc(firestore, 'pkmSaves', uid), snapshot = await tx.get(ref), raw = snapshot.data()
      const stored: Stored | null = raw ? { save: parseSaveData(raw.save), revision: typeof raw.revision === 'number' ? raw.revision : 0 } : null
      const out = applyPush(stored, { save: parseSave(sent), base: revision === null ? null : Number(revision) })
      tx.set(ref, { save: JSON.parse(JSON.stringify(out.save)), revision: out.revision, updatedAt: serverTimestamp() })
      return out
    })
    if (current?.uid !== uid) return
    store(`pkm:revision:${uid}`, String(merged.revision))
    if (JSON.stringify(loadSave()) === sent) writeSave(merged.save); else syncAgain = true
    store(`pkm:save:${uid}`, JSON.stringify(loadSave())); syncState('synced')
  } catch { if (current?.uid === uid) syncState('offline') }
}
export const syncSave = async (): Promise<void> => {
  if (!navigator.onLine) { if (current) { store(`pkm:save:${current.uid}`, JSON.stringify(loadSave())); syncState('offline') } return }
  if (syncing) { syncAgain = true; return syncing }
  syncing = syncOnce().finally(() => { syncing = null; if (syncAgain) { syncAgain = false; scheduleSync() } })
  return syncing
}
/** Finish an older push, then explicitly push the current inventory before trading. */
export const flushSave = async () => {
  const uid = current?.uid
  if (!uid || !navigator.onLine) throw new Error('offline')
  if (syncing) await syncing
  await syncSave()
  if (current?.uid !== uid || state.kind !== 'signedIn' || state.sync !== 'synced') throw new Error('offline')
}
const scheduleSync = () => { if (timer) clearTimeout(timer); if (current && !switching) timer = setTimeout(() => { void syncSave() }, 5000) }

const sessionChanged = async (user: User | null) => {
  stopTradeInventory?.(); stopTradeInventory = null
  const before = current?.uid ?? read('pkm:active-user')
  if (current) store(`pkm:save:${current.uid}`, JSON.stringify(loadSave()))
  switching = true; current = user
  if (before !== user?.uid) {
    if (before) writeSave(parseSave(read(user ? `pkm:save:${user.uid}` : 'pkm:guest-save')))
    else if (user) { store('pkm:guest-save', JSON.stringify(loadSave())); const cached = read(`pkm:save:${user.uid}`); if (cached) writeSave(parseSave(cached)) }
  }
  store('pkm:active-user', user?.uid ?? null)
  switching = false
  if (user) void import('./firebaseTrading').then((m) => m.watchTradeInventory(user.uid)).then((off) => {
    if (current?.uid !== user.uid) off(); else stopTradeInventory = off
  }).catch(() => {})
  if (!user) { emit({ kind: 'guest' }); return }
  const uid = user.uid, name = user.displayName || user.email?.split('@')[0] || 'Trainer', initialProfileVersion = profileVersion
  emit({ kind: 'signedIn', name, handle: undefined, sync: 'syncing' })
  try {
    const { firestore } = await firebaseServices(), { doc, getDoc } = await import('firebase/firestore')
    const profile = (await getDoc(doc(firestore, 'pkmProfiles', uid))).data()
    if (current?.uid !== uid) return
    // Registration can save the profile while this initial read is still in flight.
    if (profileVersion === initialProfileVersion) {
      if (profile && typeof profile.handle === 'string' && typeof profile.name === 'string') emit({ kind: 'signedIn', name: profile.name, handle: profile.handle, sync: 'syncing' })
      else emit({ kind: 'signedIn', name, handle: null, sync: 'syncing' })
    }
  } catch { if (current?.uid === uid && profileVersion === initialProfileVersion) emit({ kind: 'signedIn', name, handle: null, sync: 'offline' }) }
  if (current?.uid === uid) void syncSave()
}

export const signIn = async (email: string, password: string) => {
  const { auth } = await firebaseServices(), sdk = await import('firebase/auth')
  await sdk.signInWithEmailAndPassword(auth, email.trim(), password)
}
export const registerAccount = async (email: string, password: string, name: string) => {
  const { auth } = await firebaseServices(), sdk = await import('firebase/auth')
  const credential = await sdk.createUserWithEmailAndPassword(auth, email.trim(), password)
  if (name.trim()) await sdk.updateProfile(credential.user, { displayName: name.trim().slice(0, 24) })
  const base = suggestHandle(name || email.split('@')[0] || 'trainer')
  const result = await saveProfile({ name: name.trim().slice(0, 24) || base, handle: base })
  if (!result.ok && result.reason === 'taken' && result.suggestion) await saveProfile({ name: name.trim().slice(0, 24) || base, handle: result.suggestion })
}
export const resetPassword = async (email: string) => {
  const { auth } = await firebaseServices(), sdk = await import('firebase/auth')
  await sdk.sendPasswordResetEmail(auth, email.trim())
}
export const signOut = async () => {
  // An offline Firestore operation must not trap the player in their account.
  if (current) store(`pkm:save:${current.uid}`, JSON.stringify(loadSave()))
  await Promise.race([syncSave(), new Promise<void>((resolve) => setTimeout(resolve, 2500))])
  const { auth } = await firebaseServices(), sdk = await import('firebase/auth')
  await sdk.signOut(auth)
}
export const startAccount = () => {
  if (started) return
  started = true
  void firebaseServices().then(async ({ auth }) => {
    const { onAuthStateChanged } = await import('firebase/auth')
    onAuthStateChanged(auth, (user) => { void sessionChanged(user) }, () => emit({ kind: 'guest', failed: true }))
  }).catch(() => emit({ kind: 'guest', failed: true }))
  onSaveChange(scheduleSync)
  window.addEventListener('online', () => { void syncSave() })
  document.addEventListener('visibilitychange', () => { if (document.hidden) void syncSave() })
}
