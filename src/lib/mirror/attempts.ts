// ============================================================
// Voice Mirror — saved attempts ("takes") in localStorage.
//
// Every completed guided run is stored as take N so the results
// page survives navigation: /mirror#take-3 restores that run's
// card, stats and delta line. Only derived numbers and the glide
// pitch frames are stored — never audio (privacy stance §8).
// Frames are rounded (the trace is drawn at card scale, where
// sub-cent precision is invisible) to keep takes small; ~12 takes
// fit comfortably inside the localStorage budget.
// ============================================================

import type { F0Frame, MirrorResult } from './metrics'

const STORAGE_KEY = 'mirror.attempts.v1'
/** Oldest takes are pruned past this — numbering keeps counting up. */
export const MAX_ATTEMPTS = 12

export interface StoredAttempt {
  /** 1-based take number; the URL fragment is `take-<n>`. */
  n: number
  savedAt: number
  result: MirrorResult
  glides: F0Frame[][]
  /** The delta line shown when this take finished (vs. the take before). */
  deltaLine: string
}

const round = (value: number, places: number): number => {
  const f = 10 ** places
  return Math.round(value * f) / f
}

/** Storage-friendly frames: card-scale drawing can't see sub-ms/сent detail. */
function compactGlides(glides: readonly F0Frame[][]): F0Frame[][] {
  return glides.map((glide) =>
    glide.map((frame) => ({
      t: round(frame.t, 3),
      f0: round(frame.f0, 2),
      conf: round(frame.conf, 3),
    })),
  )
}

export function loadAttempts(storage: Storage): StoredAttempt[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a): a is StoredAttempt =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as StoredAttempt).n === 'number' &&
        typeof (a as StoredAttempt).savedAt === 'number' &&
        typeof (a as StoredAttempt).result === 'object' &&
        Array.isArray((a as StoredAttempt).glides),
    )
  } catch {
    return []
  }
}

/** Persist a finished run as the next take. Returns the stored attempt (its
 *  `n` feeds the URL), or null when storage is unavailable/full. */
export function saveAttempt(
  storage: Storage,
  input: {
    result: MirrorResult
    glides: readonly F0Frame[][]
    deltaLine: string
  },
  savedAt: number = Date.now(),
): StoredAttempt | null {
  const attempts = loadAttempts(storage)
  const n = attempts.reduce((max, a) => Math.max(max, a.n), 0) + 1
  const attempt: StoredAttempt = {
    n,
    savedAt,
    result: input.result,
    glides: compactGlides(input.glides),
    deltaLine: input.deltaLine,
  }
  const next = [...attempts, attempt]
    .sort((a, b) => a.n - b.n)
    .slice(-MAX_ATTEMPTS)
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
    return attempt
  } catch {
    return null // storage full/blocked — the run still shows results
  }
}

export function attemptByTake(
  storage: Storage,
  n: number,
): StoredAttempt | null {
  return loadAttempts(storage).find((a) => a.n === n) ?? null
}

/** URL fragment for a take, kept distinct from the cosmic + demo hashes. */
export const takeHash = (n: number): string => `take-${n}`

/** Parse `take-<n>` fragments (leading `#` optional); null for anything else. */
export function parseTakeHash(hash: string): number | null {
  const match = /^#?take-(\d+)$/.exec(hash)
  if (match === null) return null
  const n = Number(match[1])
  return Number.isInteger(n) && n > 0 ? n : null
}
