import { firebaseServices } from './firebase'
import { accountUserId } from './account'
import { parseHandle } from './game/ranking'
import { loadSave } from './ui/save'

export type Friendship = { id: string; users: string[]; from: string; to: string; status: 'pending' | 'accepted' }
export type FriendProfile = { uid: string; handle: string; name: string }
export const friendshipId = (a: string, b: string) => [a, b].sort().join('_')
export const findTrainer = async (handle: string): Promise<FriendProfile | null> => {
  const normalized = handle.trim().replace(/^@/, '').toLowerCase()
  if (!parseHandle(normalized)) return null
  const { firestore } = await firebaseServices(), { doc, getDoc } = await import('firebase/firestore')
  const uid = (await getDoc(doc(firestore, 'pkmHandles', normalized))).data()?.uid
  if (typeof uid !== 'string') return null
  return readTrainer(uid)
}
export const readTrainer = async (uid: string): Promise<FriendProfile | null> => {
  const { firestore } = await firebaseServices(), { doc, getDoc } = await import('firebase/firestore')
  const data = (await getDoc(doc(firestore, 'pkmProfiles', uid))).data()
  return typeof data?.handle === 'string' && typeof data.name === 'string' ? { uid, handle: data.handle, name: data.name } : null
}
export const watchFriends = async (next: (friends: Friendship[]) => void, error: () => void) => {
  const uid = accountUserId()
  if (!uid) throw new Error('auth-required')
  const { firestore } = await firebaseServices(), { collection, query, where, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(query(collection(firestore, 'pkmFriendships'), where('users', 'array-contains', uid)), (snap) => next(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Friendship)), error)
}
export const friendIds = async (): Promise<Set<string>> => {
  const uid = accountUserId()
  if (!uid) return new Set()
  const { firestore } = await firebaseServices(), { collection, query, where, getDocs } = await import('firebase/firestore')
  const snapshot = await getDocs(query(collection(firestore, 'pkmFriendships'), where('users', 'array-contains', uid)))
  return new Set(snapshot.docs.filter((d) => d.data().status === 'accepted').flatMap((d) => (d.data().users as string[]).filter((id) => id !== uid)))
}
/** Publishes the accepted friends on the player's own profile so others can see them, and only when the list changed. */
let publishedFriends = ''
export const publishFriends = async (ids: string[]) => {
  const uid = accountUserId(), list = [...ids].sort().slice(0, 100), key = `${uid}:${list.join(',')}`
  if (!uid || key === publishedFriends) return
  const { firestore } = await firebaseServices(), { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  await updateDoc(doc(firestore, 'pkmProfiles', uid), { friends: list, updatedAt: serverTimestamp() })
  publishedFriends = key
}
/** How the player looks on their public profile: the Pokémon photo, the wallpaper and up to three favourites. null clears a field. */
export type ProfileLook = { photo: string | null; wall: string | null; favs: string[] | null }
export const setProfileLook = async (look: ProfileLook) => {
  const uid = accountUserId()
  if (!uid) return false
  const { firestore } = await firebaseServices(), { doc, updateDoc, deleteField, serverTimestamp } = await import('firebase/firestore')
  await updateDoc(doc(firestore, 'pkmProfiles', uid), { photo: look.photo ?? deleteField(), wall: look.wall ?? deleteField(), favs: look.favs?.length ? look.favs.slice(0, 3) : deleteField(), updatedAt: serverTimestamp() })
  return true
}
export const requestFriend = async (handle: string) => {
  const uid = accountUserId(), other = await findTrainer(handle)
  if (!uid || !other || uid === other.uid) return false
  const { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'pkmFriendships', friendshipId(uid, other.uid)), current = await tx.get(ref)
    if (current.exists()) return
    tx.set(ref, { users: [uid, other.uid].sort(), from: uid, to: other.uid, status: 'pending', updatedAt: serverTimestamp() })
  })
  return true
}
export const respondFriend = async (friend: Friendship, accept: boolean) => {
  const { firestore } = await firebaseServices(), { doc, updateDoc, deleteDoc, serverTimestamp } = await import('firebase/firestore')
  const ref = doc(firestore, 'pkmFriendships', friend.id)
  if (accept) await updateDoc(ref, { status: 'accepted', updatedAt: serverTimestamp() })
  else await deleteDoc(ref)
}
export const ONLINE_STATS = ['coopRuns', 'coopWins', 'coopMinutes', 'coopRevivals', 'versusRuns', 'versusWins'] as const
export const publishSocialStats = async () => {
  const uid = accountUserId()
  if (!uid) return
  const stats = loadSave().achievements.lifetime
  const { firestore } = await firebaseServices(), { doc, setDoc } = await import('firebase/firestore')
  if (accountUserId() !== uid) return
  await setDoc(doc(firestore, 'pkmStats', uid), Object.fromEntries(ONLINE_STATS.map((k) => [k, stats[k]])), { merge: true })
}
export const readSocialStats = async (uid: string) => {
  const { firestore } = await firebaseServices(), { doc, getDoc } = await import('firebase/firestore')
  const data = (await getDoc(doc(firestore, 'pkmStats', uid))).data()
  return Object.fromEntries(ONLINE_STATS.map((k) => [k, Number(data?.[k] ?? 0)])) as Record<(typeof ONLINE_STATS)[number], number>
}
