import { firebaseServices } from './firebase'
import { accountState, accountUserId } from './account'
import type { MatchMode } from './game/multiplayer'

/** An invitation to a room: the code and mode, from a friend. Only fresh ones are kept. */
export type Invite = { id: string; from: string; name: string; code: string; mode: MatchMode; at: number }

/** An invitation older than this is stale: the room it points to is gone by then. */
const MAX_AGE_MS = 20 * 60_000

/** Invites a friend (one invitation per pair: a new code replaces the old one). */
export const sendInvite = async (to: string, code: string, mode: MatchMode) => {
  const from = accountUserId(), state = accountState()
  if (!from || state.kind !== 'signedIn') return false
  const { firestore } = await firebaseServices(), { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
  await setDoc(doc(firestore, 'pkmInvites', `${from}_${to}`), { from, to, name: state.name.slice(0, 24) || 'Trainer', code, mode, createdAt: serverTimestamp() })
  return true
}

/** Calls `next` with the invitations waiting for the player; returns the unsubscribe. */
export const watchInvites = async (next: (invites: Invite[]) => void, error: () => void) => {
  const uid = accountUserId()
  if (!uid) throw new Error('auth-required')
  const { firestore } = await firebaseServices(), { collection, query, where, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(query(collection(firestore, 'pkmInvites'), where('to', '==', uid)), (snap) => {
    const now = Date.now()
    next(snap.docs.flatMap((d): Invite[] => {
      const data = d.data()
      const at = typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : now
      const mode = data.mode === 'coop' || data.mode === 'versus' ? data.mode : null
      return mode && typeof data.code === 'string' && typeof data.name === 'string' && typeof data.from === 'string' && now - at < MAX_AGE_MS ? [{ id: d.id, from: data.from, name: data.name, code: data.code, mode, at }] : []
    }).sort((a, b) => b.at - a.at))
  }, error)
}

export const dismissInvite = async (id: string) => {
  const { firestore } = await firebaseServices(), { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(firestore, 'pkmInvites', id))
}
