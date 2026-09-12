// ============================================================
// Sing takes — the summaries this phone keeps, and nothing else
// ============================================================
//
// A kept take is four numbers and two timestamps. NO AUDIO: the end card's
// footer promises "Keep stores it on this phone. Nothing uploaded", and the
// cheapest way to keep that promise is to have nothing to upload. Discard
// writes nothing at all, which is why keeping is a call and discarding is
// the absence of one.
//
// The store exists for one reader today — "Against your own history", the
// line the end card draws from the PREVIOUS kept take — and it is capped,
// because a list nobody reads that grows forever is a list that eventually
// costs somebody their storage quota.
//
// Persisted with `createPersistedSignal` rather than the storage port: the
// port is for the three identity keys whose loss orphans an account
// (`src/lib/storage-port.ts` says so in its own header), and a take summary
// is a preference-shaped thing — losing it costs one comparison line.

import { createPersistedSignal } from '@/lib/storage'

export interface SingTake {
  /** `${endedAt}-${takeNumber}` — unique enough for a list of fifty. */
  id: string
  /** Epoch ms, so the history line can say a date. */
  startedAt: number
  endedAt: number
  durationMs: number
  /** Which take of its own session this was. */
  takeNumber: number
  /** Null when nothing was held long enough to name a range. */
  lowNote: string | null
  highNote: string | null
  heldWithinCents: number
}

/** Older takes fall off the end; only the newest is ever read. */
export const SING_TAKES_KEPT = 50

const STORAGE_KEY = 'pitchperfect_sing_takes'

function isSingTake(value: unknown): value is SingTake {
  if (typeof value !== 'object' || value === null) return false
  const take = value as Partial<SingTake>
  return (
    typeof take.id === 'string' &&
    typeof take.startedAt === 'number' &&
    typeof take.endedAt === 'number' &&
    typeof take.durationMs === 'number' &&
    typeof take.takeNumber === 'number' &&
    typeof take.heldWithinCents === 'number'
  )
}

const [takes, setTakes] = createPersistedSignal<SingTake[]>(STORAGE_KEY, [], {
  validator: (value): value is SingTake[] =>
    Array.isArray(value) && value.every(isSingTake),
})

/** Every kept take, newest last. */
export const singTakes = takes

/** The take the end card compares against, or null on a first ever take. */
export function lastSingTake(): SingTake | null {
  const all = takes()
  return all.length === 0 ? null : all[all.length - 1]
}

/** Keep one. Returns it, so a caller can show what it stored. */
export function keepSingTake(take: SingTake): SingTake {
  setTakes((current) => [...current, take].slice(-SING_TAKES_KEPT))
  return take
}

/** Tests only — and the one place a "forget my takes" control would call. */
export function clearSingTakes(): void {
  setTakes([])
}
