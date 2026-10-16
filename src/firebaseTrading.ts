import { firebaseServices } from './firebase'
import { accountUserId, flushSave } from './account'
import { friendshipId } from './firebaseSocial'
import { PLAYABLE, type PlayableId } from './data/hatchlings'
import { mintedCopies, parseGacha, transferKey } from './game/gacha'
import { updateSave } from './ui/save'
import { markHatch } from './game/dex'

export type TradeOffer = { id: PlayableId; shiny: boolean; key: string }
export type Trade = { id: string; users: [string, string]; left: TradeOffer | null; right: TradeOffer | null; leftAccepted: boolean; rightAccepted: boolean; status: 'open' | 'done' | 'cancelled' }
type Stock = { id: PlayableId; shiny: boolean; earned: number; sent: number; received: number; lastTrade: string }
const emptyStock = (offer: TradeOffer): Stock => ({ id: offer.id, shiny: offer.shiny, earned: 0, sent: 0, received: 0, lastTrade: '' })
const myUid = () => { const uid = accountUserId(); if (!uid) throw new Error('auth-required'); return uid }

/** The ledger is independent of offline saves. A stale save cannot undo a transfer. */
export const watchTradeInventory = async (uid: string) => {
  const { firestore } = await firebaseServices(), { collection, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(collection(firestore, 'pkmTradeStock', uid, 'copies'), (snapshot) => {
    if (accountUserId() !== uid) return
    updateSave((save) => {
      const transfers = { ...save.gacha.transfers }
      let dex = save.dex
      const shinyStarters = { ...save.shinyStarters }
      for (const doc of snapshot.docs) {
        const stock = doc.data() as Stock
        transfers[doc.id] = { sent: Math.max(transfers[doc.id]?.sent ?? 0, stock.sent), received: Math.max(transfers[doc.id]?.received ?? 0, stock.received) }
        if (stock.received > 0 && Object.hasOwn(PLAYABLE, stock.id)) {
          dex = markHatch(dex, PLAYABLE[stock.id].line.map((s) => s.dex), stock.shiny)
          if (stock.shiny && !(stock.id in shinyStarters)) shinyStarters[stock.id] = true
        }
      }
      return { ...save, dex, shinyStarters, gacha: { ...save.gacha, transfers } }
    })
  }, () => { /* Reconnect resumes the authoritative ledger listener. */ })
}
export const watchTrades = async (next: (trades: Trade[]) => void, error: () => void) => {
  const uid = myUid(), { firestore } = await firebaseServices(), { collection, query, where, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(query(collection(firestore, 'pkmTrades'), where('users', 'array-contains', uid)), (snapshot) => {
    next([...snapshot.docs].sort((a, b) => Number(b.data().createdAt?.toMillis?.() ?? 0) - Number(a.data().createdAt?.toMillis?.() ?? 0)).map((d) => ({ ...d.data(), id: d.id }) as Trade))
  }, error)
}
export const offerTrade = async (other: string, offer: Omit<TradeOffer, 'key'>, current?: Trade) => {
  const uid = myUid()
  if (!Object.hasOwn(PLAYABLE, offer.id)) throw new Error('invalid-pokemon')
  // The server credits only gacha copies present in the already synchronized save.
  await flushSave()
  const { firestore } = await firebaseServices(), { collection, doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const value: TradeOffer = { ...offer, key: transferKey(offer.id, offer.shiny) }
  const tradeRef = current ? doc(firestore, 'pkmTrades', current.id) : doc(collection(firestore, 'pkmTrades'))
  await runTransaction(firestore, async (tx) => {
    const stockRef = doc(firestore, 'pkmTradeStock', uid, 'copies', value.key)
    const [save, stock, trade, friendship] = await Promise.all([tx.get(doc(firestore, 'pkmSaves', uid)), tx.get(stockRef), tx.get(tradeRef), tx.get(doc(firestore, 'pkmFriendships', friendshipId(uid, other)))])
    if (friendship.data()?.status !== 'accepted') throw new Error('friends-only')
    const before = (stock.data() as Stock | undefined) ?? emptyStock(value)
    const earned = Math.max(before.earned, mintedCopies(parseGacha(save.data()?.save?.gacha), offer.id, offer.shiny))
    if (earned + before.received - before.sent < 1) throw new Error('no-copies')
    const data = trade.data() as Omit<Trade, 'id'> | undefined
    if (data && (data.status !== 'open' || !data.users.includes(uid) || !data.users.includes(other))) throw new Error('closed-trade')
    tx.set(stockRef, { ...before, earned })
    if (data) tx.update(tradeRef, { [data.users[0] === uid ? 'left' : 'right']: value, leftAccepted: false, rightAccepted: false, updatedAt: serverTimestamp() })
    else tx.set(tradeRef, { users: [uid, other], left: value, right: null, leftAccepted: false, rightAccepted: false, status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
}
export const confirmTrade = async (trade: Trade) => {
  const uid = myUid(), { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'pkmTrades', trade.id), data = (await tx.get(ref)).data() as Trade | undefined
    if (!data || data.status !== 'open' || !data.users.includes(uid) || !data.left || !data.right) throw new Error('invalid-trade')
    // The confirmation applies to exactly the offer the trainer reviewed.
    if (data.left.key !== trade.left?.key || data.right.key !== trade.right?.key) throw new Error('offer-changed')
    tx.update(ref, { [data.users[0] === uid ? 'leftAccepted' : 'rightAccepted']: true, updatedAt: serverTimestamp() })
  })
  await finalizeTrade(trade.id)
}
export const cancelTrade = async (id: string) => {
  myUid()
  const { firestore } = await firebaseServices(), { doc, updateDoc, serverTimestamp } = await import('firebase/firestore')
  await updateDoc(doc(firestore, 'pkmTrades', id), { status: 'cancelled', updatedAt: serverTimestamp() })
}
/** Both users' debit and credit, plus the receipt, commit in one Firestore transaction. */
export const finalizeTrade = async (id: string) => {
  const uid = myUid(), { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'pkmTrades', id), data = (await tx.get(ref)).data() as Trade | undefined
    if (!data || data.status !== 'open' || !data.users.includes(uid) || !data.leftAccepted || !data.rightAccepted || !data.left || !data.right) return
    const updates = new Map<string, { uid: string; offer: TradeOffer; sent: number; received: number }>()
    for (const [index, owner] of data.users.entries()) {
      const outgoing = index === 0 ? data.left : data.right, incoming = index === 0 ? data.right : data.left
      for (const [offer, kind] of [[outgoing, 'sent'], [incoming, 'received']] as const) {
        const key = `${owner}/${offer.key}`, value = updates.get(key) ?? { uid: owner, offer, sent: 0, received: 0 }
        value[kind]++; updates.set(key, value)
      }
    }
    const snapshots = await Promise.all([...updates.values()].map((value) => tx.get(doc(firestore, 'pkmTradeStock', value.uid, 'copies', value.offer.key))))
    for (const [i, value] of [...updates.values()].entries()) {
      const before = (snapshots[i]!.data() as Stock | undefined) ?? emptyStock(value.offer)
      if (value.sent && before.earned + before.received - before.sent < 1) throw new Error('no-copies')
      tx.set(snapshots[i]!.ref, { ...before, sent: before.sent + value.sent, received: before.received + value.received, lastTrade: id })
    }
    tx.update(ref, { status: 'done', updatedAt: serverTimestamp() })
  })
}
