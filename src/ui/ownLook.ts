import { accountState } from '../account'
import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { TITLE_IDS, type TitleId } from '../data/achievements'
import { fetchProfile } from '../ranking'

/** The photo and title the player published on their profile: the Trainer chip and card show them. */
export type OwnLook = { photo?: PlayableId; title?: TitleId }

const KEY = 'pkm:own-look'
const listeners = new Set<() => void>()

const read = (): OwnLook => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const photo = PLAYABLE_IDS.find((id) => id === data.photo), title = TITLE_IDS.find((id) => id === data.title)
    return { ...(photo ? { photo } : {}), ...(title ? { title } : {}) }
  } catch {
    return {}
  }
}

let look: OwnLook = read()

export const ownLook = () => look

export const onLookChange = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))

/** Remembers the look (a saved profile, or what the server answered) and tells whoever draws it. */
export const setOwnLook = (next: OwnLook) => {
  look = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private modes: the look is read again from the profile next time.
  }
  listeners.forEach((fn) => fn())
}

let askedFor: string | null = null

/** Reads the player's own profile once per sign in, so a photo and title set on another device show here too. */
export const refreshOwnLook = async () => {
  const s = accountState()
  if (s.kind !== 'signedIn' || !s.handle) {
    if (s.kind === 'guest') { askedFor = null; setOwnLook({}) }
    return
  }
  if (askedFor === s.handle) return
  askedFor = s.handle
  const p = await fetchProfile(s.handle)
  if (p && p !== 'missing') setOwnLook({ ...(p.photo ? { photo: p.photo } : {}), ...(p.title ? { title: p.title } : {}) })
  else askedFor = null
}
