import { firebaseServices } from './firebase'
import { accountUserId, onAccountChange } from './account'

let started = false

/** Signed-in players mark themselves online; the entry disappears when the tab closes or the connection drops. */
export const startPresence = () => {
  if (started) return
  started = true
  let release = () => {}, active: string | null = null
  onAccountChange((state) => {
    const uid = state.kind === 'signedIn' ? accountUserId() : null
    if (uid === active) return
    release(); release = () => {}; active = uid
    if (!uid) return
    void firebaseServices().then(async ({ database }) => {
      const sdk = await import('firebase/database')
      if (active !== uid) return
      const mine = sdk.ref(database, `pkmPresence/${uid}`)
      const off = sdk.onValue(sdk.ref(database, '.info/connected'), (snap) => {
        if (snap.val() !== true) return
        void sdk.onDisconnect(mine).remove().then(() => sdk.set(mine, true)).catch(() => {})
      })
      release = () => { off(); void sdk.remove(mine).catch(() => {}) }
    }).catch(() => {})
  })
}

/** Calls `next` with the number of trainers online now; returns the unsubscribe. Silent when offline. */
export const watchOnline = (next: (count: number) => void) => {
  let off = () => {}, closed = false
  void firebaseServices().then(async ({ database }) => {
    const sdk = await import('firebase/database')
    if (closed) return
    off = sdk.onValue(sdk.ref(database, 'pkmPresence'), (snap) => next(snap.size), () => {})
  }).catch(() => {})
  return () => { closed = true; off() }
}
