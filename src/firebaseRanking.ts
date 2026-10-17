import { firebaseServices } from './firebase'
import { accountHandle, accountState, accountUserId } from './account'
import { boardId, compareScores, periodKey, teamEntryId, validModeResult, type Lineup, type RankingMode, type ScoreEntry } from './game/leaderboards'
import { BOARD_PERIODS, parseHandle, type Board, type BoardPeriod, type ChallengeBoard, type PublicProfile, type RunRanks, type RunResult } from './game/ranking'
import type { Difficulty } from './game/difficulty'
import type { DayKey } from './game/day'
import type { RankOutcome, RankedRun } from './ranking'
import { loadSave } from './ui/save'
import { dexCounts } from './game/dex'
import { PLAYABLE, PLAYABLE_IDS } from './data/hatchlings'
import { DIFFICULTY_IDS } from './game/difficulty'
import { ONLINE_STATS } from './firebaseSocial'
import { styleIds } from './data/style'
import { TITLE_IDS } from './data/achievements'

export type BoardFilter = { difficulty: Difficulty; period: BoardPeriod; starter: import('./data/hatchlings').PlayableId | null; friends: boolean }
export type BoardOptions = { mode: RankingMode; difficulty: Difficulty; period: BoardPeriod; teamSize: number }
export const readFirebaseBoard = async (options: BoardOptions): Promise<ScoreEntry[] | null> => {
  try {
    const { firestore } = await firebaseServices(), { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore')
    const id = boardId(options.mode, options.difficulty, options.period, new Date(), options.teamSize)
    const snapshot = await getDocs(query(collection(firestore, 'pkmBoards', id, 'entries'), orderBy('score', 'desc'), limit(100)))
    return snapshot.docs.map((d) => d.data() as ScoreEntry).filter((e) => validModeResult(options.mode, e) && typeof e.name === 'string' && typeof e.score === 'number').sort(compareScores).slice(0, 50)
  } catch { return null }
}

type Start = { lineup?: Lineup; id: string; uid: string; mode: RankingMode; names: string[]; team: string[]; teamSize: number; teamId: string; challenge: DayKey | null }
const start = async (mode: RankingMode, team?: { ids: string[]; names: string[] }, challenge: DayKey | null = null): Promise<Start | null> => {
  const uid = accountUserId()
  if (!uid) return null
  const { firestore } = await firebaseServices(), { collection, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
  const ref = doc(collection(firestore, 'pkmStarts')), state = accountState()
  const ids = team?.ids ?? [uid]
  const session: Start = { id: ref.id, uid, mode, team: ids, names: team?.names ?? [state.kind === 'signedIn' ? state.name : 'Trainer'], teamSize: ids.length, teamId: teamEntryId(ids), challenge }
  await setDoc(ref, { ...session, startedAt: serverTimestamp() })
  return session
}
const publish = async (session: Start, result: RunResult, finishedAt = new Date().toISOString()): Promise<RankOutcome> => {
  if (accountUserId() !== session.uid || !validModeResult(session.mode, result)) return { kind: 'unranked' }
  const { firestore } = await firebaseServices(), { doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const now = new Date(finishedAt), handle = accountHandle() ?? session.uid.slice(0, 12).toLowerCase(), state = accountState()
  const name = session.mode === 'coop' ? session.names.join(' + ') : state.kind === 'signedIn' ? state.name : session.names[0]!
  const entryId = session.mode === 'coop' ? teamEntryId(session.team) : session.uid
  const boards = BOARD_PERIODS.map((period) => ({ period, id: boardId(session.mode, result.difficulty, period, now, session.teamSize) }))
  let official = false
  await runTransaction(firestore, async (tx) => {
    const runRef = doc(firestore, 'pkmRuns', session.id), prior = await tx.get(runRef)
    const records = await Promise.all(boards.map((b) => tx.get(doc(firestore, 'pkmBoards', b.id, 'entries', entryId))))
    const dailyRef = session.challenge ? doc(firestore, 'pkmBoards', `challenge_${session.challenge}`, 'entries', session.uid) : null
    const daily = dailyRef ? await tx.get(dailyRef) : null
    official = !!dailyRef && (!daily?.exists() || daily.data()?.runId === session.id)
    const old = prior.data()
    if (old && Number(old.time) >= result.time) return
    const entry: ScoreEntry = { ...result, runId: session.id, uid: session.uid, name, handle, team: session.team, names: session.names, ...(session.lineup?.length ? { lineup: session.lineup } : {}), score: result.time, wins: 0, at: now.toISOString(), verified: false }
    for (const [i] of boards.entries()) {
      const before = records[i]!.data()
      const won = result.outcome === 'victory'
      const wins = Number(before?.wins ?? 0) + (session.mode === 'versus' && won && !old ? 1 : 0)
      if (session.mode === 'versus') tx.set(records[i]!.ref, { ...entry, wins, score: wins })
      else if (!before || result.time > Number(before.time)) tx.set(records[i]!.ref, entry)
      else if (session.mode === 'coop' && session.lineup?.length && !before.lineup) tx.update(records[i]!.ref, { lineup: session.lineup })
    }
    if (dailyRef && official) tx.set(dailyRef, entry)
    tx.set(runRef, { ...entry, mode: session.mode, startId: session.id, updatedAt: serverTimestamp() })
  })
  const ranks = Object.fromEntries(await Promise.all(boards.map(async ({ period }) => {
    const rows = await readFirebaseBoard({ mode: session.mode, difficulty: result.difficulty, period, teamSize: session.teamSize })
    const index = rows?.findIndex((e) => session.mode === 'coop' ? teamEntryId(e.team) === entryId : e.uid === session.uid) ?? -1
    return [period, index >= 0 ? index + 1 : null]
  }))) as RunRanks
  // Save public collection counts without publishing the private save or email.
  const counts = dexCounts(loadSave().dex, [...new Set(PLAYABLE_IDS.map((id) => PLAYABLE[id].line[0].dex))])
  const profile = doc(firestore, 'pkmStats', session.uid)
  const { setDoc } = await import('firebase/firestore')
  await setDoc(profile, { seen: counts.seen, caught: counts.caught }, { merge: true }).catch(() => {})
  const daily = session.challenge ? await firebaseChallengeBoard(session.challenge) : null
  return { kind: 'ranked', ranks, challenge: session.challenge ? { day: session.challenge, official, rank: daily?.me?.rank ?? null, total: daily?.total ?? 0 } : null }
}

type Pending = { session: Start; result: RunResult; at: string }
const queueKey = (uid: string) => `pkm:pending-runs:${uid}`
const pendingRuns = (uid: string): Pending[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(queueKey(uid)) ?? '[]')
    return Array.isArray(data) ? data.filter((p): p is Pending => !!p?.session && p.session.uid === uid && validModeResult(p.session.mode, p.result) && Number.isFinite(Date.parse(p.at))).slice(-20) : []
  } catch { return [] }
}
const putPending = (uid: string, runs: Pending[]) => { try { localStorage.setItem(queueKey(uid), JSON.stringify(runs.slice(-20))) } catch { /* Gameplay remains available. */ } }
const submitting = new Map<string, { time: number; promise: Promise<RankOutcome> }>()
const sendResult = async (session: Start, result: RunResult, at = new Date().toISOString()): Promise<RankOutcome> => {
  if (session.uid !== accountUserId() || !validModeResult(session.mode, result)) return { kind: 'unranked' }
  const active = submitting.get(session.id)
  if (active) return result.time <= active.time ? active.promise : active.promise.then(() => sendResult(session, result, at))
  putPending(session.uid, [...pendingRuns(session.uid).filter((r) => r.session.id !== session.id), { session, result, at }])
  if (!navigator.onLine) return { kind: 'queued' }
  const operation = (async (): Promise<RankOutcome> => { try {
    const outcome = await publish(session, result, at)
    putPending(session.uid, pendingRuns(session.uid).filter((r) => r.session.id !== session.id || r.result.time > result.time))
    return outcome
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && ['permission-denied', 'invalid-argument'].includes(String(error.code))) {
      putPending(session.uid, pendingRuns(session.uid).filter((r) => r.session.id !== session.id))
      return { kind: 'rejected' }
    }
    return { kind: 'queued' }
  } })()
  submitting.set(session.id, { time: result.time, promise: operation })
  void operation.finally(() => { if (submitting.get(session.id)?.promise === operation) submitting.delete(session.id) })
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([operation, new Promise<RankOutcome>((resolve) => { timer = setTimeout(() => resolve({ kind: 'queued' }), 8000) })]).finally(() => clearTimeout(timer))
}
const flushing = new Map<string, Promise<Map<string, RankOutcome>>>()
export const flushFirebaseRuns = async (): Promise<Map<string, RankOutcome>> => {
  const uid = accountUserId()
  if (!uid) return new Map()
  const active = flushing.get(uid)
  if (active) return active
  const operation = (async () => {
    const outcomes = new Map<string, RankOutcome>()
    for (const pending of pendingRuns(uid)) outcomes.set(pending.session.id, await sendResult(pending.session, pending.result, pending.at))
    return outcomes
  })().finally(() => { flushing.delete(uid) })
  flushing.set(uid, operation)
  return operation
}
const startWithDeadline = (...args: Parameters<typeof start>) => Promise.race([start(...args).catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000))])

export const firebaseRankedRun = (challenge: DayKey | null): RankedRun | null => {
  if (!accountUserId()) return null
  const token = startWithDeadline('solo', undefined, challenge)
  let sent = -1, last: Promise<RankOutcome> = Promise.resolve({ kind: 'unranked' })
  return { submit: (result) => {
    if (result.time <= sent) return last
    sent = result.time
    last = token.then((s) => s ? sendResult(s, result) : { kind: 'unranked' as const })
    return last
  } }
}
export const startTeamRanking = (mode: 'coop' | 'versus', ids: string[], names: string[]) => startWithDeadline(mode, { ids, names })
export const finishTeamRanking = async (session: Start | null, result: RunResult, lineup?: Lineup) => session ? sendResult(lineup ? { ...session, lineup } : session, result) : { kind: 'unranked' as const }

export const firebaseBoard = async (filter: BoardFilter): Promise<Board | null> => {
  const rows = await readFirebaseBoard({ mode: 'solo', difficulty: filter.difficulty, period: filter.period, teamSize: 1 })
  if (!rows) return null
  const follows = filter.friends ? await followingHandles(accountUserId()) : null
  const entries = rows.filter((e) => (!filter.starter || e.starter === filter.starter) && (!follows || follows.has(e.handle) || e.uid === accountUserId())).map((e, i) => ({ ...e, rank: i + 1 }))
  return { entries, me: entries.find((e) => e.uid === accountUserId()) ?? null }
}
export const firebaseChallengeBoard = async (day: DayKey): Promise<ChallengeBoard | null> => {
  try {
    const { firestore } = await firebaseServices(), { collection, query, orderBy, limit, getDocs, doc, getDoc, getCountFromServer } = await import('firebase/firestore')
    const entriesRef = collection(firestore, 'pkmBoards', `challenge_${day}`, 'entries'), uid = accountUserId()
    const [docs, own, count] = await Promise.all([getDocs(query(entriesRef, orderBy('time', 'desc'), limit(50))), uid ? getDoc(doc(entriesRef, uid)) : null, getCountFromServer(entriesRef)])
    const entries = docs.docs.map((d) => d.data() as ScoreEntry).filter((entry) => validModeResult('solo', entry)).map((entry, i) => ({ ...entry, rank: i + 1 }))
    return { entries, me: entries.find((e) => e.uid === uid) ?? null, day, total: count.data().count, attempted: uid ? !!own?.exists() : null }
  } catch { return null }
}
export const firebaseProfile = async (handle: string): Promise<PublicProfile | 'missing' | null> => {
  try {
    const { firestore } = await firebaseServices(), { doc, getDoc, collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore')
    const reservation = await getDoc(doc(firestore, 'pkmHandles', handle))
    if (!reservation.exists()) return 'missing'
    const uid = String(reservation.data().uid)
    const [profile, stats, runs, following, fans, ownFollowing, best] = await Promise.all([getDoc(doc(firestore, 'pkmProfiles', uid)), getDoc(doc(firestore, 'pkmStats', uid)), getDocs(query(collection(firestore, 'pkmRuns'), where('uid', '==', uid), orderBy('at', 'desc'), limit(20))), followingHandles(uid), getDocs(collection(firestore, 'pkmFans', handle, 'uids')), followingHandles(accountUserId()), Promise.all(DIFFICULTY_IDS.map((difficulty) => getDoc(doc(firestore, 'pkmBoards', boardId('solo', difficulty, 'all', new Date()), 'entries', uid))))])
    if (!profile.exists()) return 'missing'
    const data = profile.data(), recent = runs.docs.map((d) => d.data() as ScoreEntry).sort((a, b) => b.at.localeCompare(a.at))
    const records: PublicProfile['records'] = {}
    for (const record of best) { const r = record.data() as ScoreEntry | undefined; if (r && validModeResult('solo', r)) records[r.difficulty] = r }
    const online = Object.fromEntries(ONLINE_STATS.map((k) => [k, Number(stats.data()?.[k] ?? 0)])) as NonNullable<PublicProfile['online']>
    return { handle, name: String(data.name), online, dex: { seen: Number(stats.data()?.seen ?? 0), caught: Number(stats.data()?.caught ?? 0) }, records, recent, followers: fans.size, following: following.size, followed: ownFollowing.has(handle), ...lookOf(data), friends: Array.isArray(data.friends) ? data.friends.filter((id): id is string => typeof id === 'string') : [], self: uid === accountUserId() }
  } catch { return null }
}
/** The public look fields of a profile document, keeping only ids this version knows. */
const lookOf = (data: Record<string, unknown>): Pick<PublicProfile, 'photo' | 'wall' | 'favs' | 'title'> => {
  const title = TITLE_IDS.find((id) => id === data.title)
  const photo = PLAYABLE_IDS.find((id) => id === data.photo), wall = styleIds('wallpaper').find((id) => id === data.wall)
  const favs = Array.isArray(data.favs) ? data.favs.flatMap((raw) => PLAYABLE_IDS.find((id) => id === raw) ?? []).slice(0, 3) : []
  return { title: title ?? null, ...(photo ? { photo } : {}), ...(wall ? { wall } : {}), ...(favs.length ? { favs } : {}) }
}
const followingHandles = async (uid: string | null) => {
  if (!uid) return new Set<string>()
  const { firestore } = await firebaseServices(), { collection, getDocs } = await import('firebase/firestore')
  return new Set((await getDocs(collection(firestore, 'pkmFollows', uid, 'targets'))).docs.map((d) => d.id))
}
export const firebaseFollow = async (handle: string, follow: boolean): Promise<{ followed: boolean; followers: number } | null> => {
  const uid = accountUserId()
  if (!uid || !parseHandle(handle) || handle === accountHandle()) return null
  try {
    const { firestore } = await firebaseServices(), { doc, collection, getDocs, writeBatch } = await import('firebase/firestore')
    const batch = writeBatch(firestore), target = doc(firestore, 'pkmFollows', uid, 'targets', handle), fan = doc(firestore, 'pkmFans', handle, 'uids', uid)
    if (follow) { batch.set(target, { handle }); batch.set(fan, { uid }) } else { batch.delete(target); batch.delete(fan) }
    await batch.commit()
    return { followed: follow, followers: (await getDocs(collection(firestore, 'pkmFans', handle, 'uids'))).size }
  } catch { return null }
}
export { periodKey }
