import { track } from './analytics'
import { accountHandle, storedRef, storeRef } from './account'
import { firebaseBoard, firebaseChallengeBoard, firebaseProfile, firebaseRankedRun, flushFirebaseRuns, firebaseFollow } from './firebaseRanking'
import type { DayKey } from './game/day'
import type { BoardFilter as Filter } from './firebaseRanking'
import type { Board, ChallengeBoard, ChallengePlace, PublicProfile, RunRanks, RunResult } from './game/ranking'
import type { Replay } from './game/replay'
import { firstTouch, landingRef, REF_PARAM } from './game/referral'
import { SITE_URL } from './site/routes'
import { locale, type Locale } from './i18n'
export const rankingEnabled = true
export type BoardFilter = Filter
export type RankOutcome = { kind: 'ranked'; ranks: RunRanks; challenge: ChallengePlace | null } | { kind: 'queued' | 'rejected' | 'unranked' }
export type RankedRun = { submit: (result: RunResult, replay: Replay) => Promise<RankOutcome> }
export const startRanked = (challenge: DayKey | null = null): RankedRun | null => firebaseRankedRun(challenge)
export const flushRuns = flushFirebaseRuns
export const fetchBoard = (f: BoardFilter): Promise<Board | null> => firebaseBoard(f)
export const fetchChallengeBoard = (day: DayKey, _friends = false): Promise<ChallengeBoard | null> => firebaseChallengeBoard(day)
/** Dev builds only: `?u=demo` opens a made-up profile, to look at the layout without an account. */
const demoProfile = (): PublicProfile => ({
  handle: 'demo', name: 'Ash Ketchum', title: 'veteran', self: true, followers: 0, following: 0, followed: false, brought: 2,
  photo: 'charmander', wall: 'forest', favs: ['charmander', 'squirtle', 'bulbasaur'], friends: [],
  dex: { seen: 120, caught: 64 },
  records: { normal: { starter: 'charmander', stage: 2, difficulty: 'normal', time: 1260, outcome: 'victory', at: '2026-10-10T12:00:00Z', verified: true } },
  recent: [
    { starter: 'charmander', stage: 2, difficulty: 'normal', time: 1260, outcome: 'victory', at: '2026-10-10T12:00:00Z', verified: true },
    { starter: 'squirtle', stage: 1, difficulty: 'hard', time: 640, outcome: 'death', at: '2026-10-09T12:00:00Z', verified: true },
    { starter: 'charmander', stage: 1, difficulty: 'normal', time: 410, outcome: 'death', at: '2026-10-08T12:00:00Z', verified: null },
  ],
  online: { coopRuns: 5, coopWins: 3, coopMinutes: 74, coopRevivals: 6, versusRuns: 4, versusWins: 2 },
})
export const fetchProfile = (handle: string): Promise<PublicProfile | 'missing' | null> => (import.meta.env.DEV && handle === 'demo' ? Promise.resolve(demoProfile()) : firebaseProfile(handle))
export const setFollow = firebaseFollow

/* ---------------- Links ---------------- */

/** The game's page per language: a profile link opens the game in the language it was shared in. */
const PLAY_PATH = { pt: '/', en: '/en/', es: '/es/' } as const satisfies Record<Locale, string>

/** Query parameter of a shared profile link (`/?u=handle`). */
export const PROFILE_PARAM = 'u'

/** The shareable link to a profile: the game opens straight on it, crediting whoever shares it when that's someone else (`?ref=`). */
export const profileUrl = (handle: string) => {
  const own = accountHandle()
  const ref = own && own !== handle ? `&${REF_PARAM}=${encodeURIComponent(own)}` : ''
  return `${location.origin}${PLAY_PATH[locale()]}?${PROFILE_PARAM}=${encodeURIComponent(handle)}${ref}`
}

/**
 * The game's link for a share card or its text, crediting `handle` (`?ref=`)
 * when the player has one. Always the public site, so a card shared from a
 * preview build still sends people to the game.
 */
export const gameUrl = (handle: string | null) => `${SITE_URL}${PLAY_PATH[locale()]}${handle ? `?${REF_PARAM}=${encodeURIComponent(handle)}` : ''}`

/* ---------------- Invites ---------------- */

const inviters = new Map<string, Promise<string | null>>()

/**
 * The display name of the device's inviter (`storedRef`), for the title's
 * invite banner: asked once per page, null offline or when nobody has that handle.
 */
export const inviterName = (): Promise<string | null> => {
  const ref = storedRef()
  if (!ref || !rankingEnabled) return Promise.resolve(null)
  let name = inviters.get(ref)
  if (!name) inviters.set(ref, (name = fetchProfile(ref).then((p) => (p && p !== 'missing' ? p.name : null))))
  return name
}

/** Dev: lands as if invited by `handle` (shown as `name`), without asking the API. */
export const stageInvite = (handle: string, name: string = handle) => {
  storeRef(handle)
  inviters.set(handle, Promise.resolve(name))
}

/**
 * On boot: a link with `?ref=` (or a profile's `?u=`) keeps its handle as the
 * device's inviter, first touch only and never the player's own, and counts
 * the landing. `?ref=` then leaves the address bar, so a reload isn't counted again.
 */
export const captureRef = () => {
  const params = new URLSearchParams(location.search)
  const landed = landingRef(params, PROFILE_PARAM)
  if (!landed) return
  const own = accountHandle()
  const stored = storedRef()
  const keep = firstTouch(stored, landed, own)
  if (keep !== stored && keep !== null) storeRef(keep)
  if (landed !== own) track('ref_land', { ref: landed, via: params.has(REF_PARAM) ? 'ref' : 'profile', first: stored === null ? 1 : 0 })
  if (params.has(REF_PARAM)) {
    params.delete(REF_PARAM)
    const query = params.toString()
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }
}
