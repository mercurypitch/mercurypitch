// ============================================================
// A blocked separation, kept across the Google sign-in redirect
// ============================================================
//
// Google sign-in leaves the document, so the in-memory intent behind a
// blocked "Separate" press cannot survive the round trip. A room writes down
// only what it needs to resume that one explicit action: the song's session
// and a fingerprint of its backing, which the room computes from its own
// lease shape. The lease is read once, expires quickly, and stays an intent
// rather than an authorization: account, credits and server admission are
// checked again before any billable work.
//
// Guitar Night and Drum Night each keep one under their own key. This module
// holds the parts that make keeping one safe, so the two rooms cannot drift
// apart on them.

/** Long enough for Google's consent screen, short enough to go stale. */
export const GOOGLE_SEPARATION_INTENT_TTL_MS = 15 * 60 * 1000

export interface GoogleSeparationIntent {
  version: 1
  sessionId: string
  backingFingerprint: string
  createdAt: number
  expiresAt: number
}

export interface GoogleSeparationIntentStore {
  clear(): void
  /**
   * Write the lease immediately before Google navigation. Returns an
   * exact-value rollback for the rare case where leaving the page fails.
   */
  prepare(
    sessionId: string,
    backingFingerprint: string,
    now?: number,
  ): () => void
  /**
   * The lease, removed before it is parsed: invalid, failed, expired and
   * successful returns are all single-use, so a later unrelated sign-in can
   * never replay one.
   */
  take(now?: number): GoogleSeparationIntent | null
}

function readIntent(
  serialized: string,
  now: number,
): GoogleSeparationIntent | null {
  try {
    const value = JSON.parse(serialized) as Partial<GoogleSeparationIntent>
    if (
      value.version !== 1 ||
      typeof value.sessionId !== 'string' ||
      value.sessionId.trim() === '' ||
      typeof value.backingFingerprint !== 'string' ||
      value.backingFingerprint === '' ||
      typeof value.createdAt !== 'number' ||
      !Number.isFinite(value.createdAt) ||
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      value.createdAt > now ||
      value.expiresAt <= now ||
      value.expiresAt - value.createdAt !== GOOGLE_SEPARATION_INTENT_TTL_MS
    ) {
      return null
    }
    return value as GoogleSeparationIntent
  } catch {
    return null
  }
}

export function googleSeparationIntentStore(
  storageKey: string,
): GoogleSeparationIntentStore {
  const clear = (): void => localStorage.removeItem(storageKey)
  return {
    clear,
    prepare(sessionId, backingFingerprint, now = Date.now()) {
      clear()
      const serialized = JSON.stringify({
        version: 1,
        sessionId,
        backingFingerprint,
        createdAt: now,
        expiresAt: now + GOOGLE_SEPARATION_INTENT_TTL_MS,
      } satisfies GoogleSeparationIntent)
      localStorage.setItem(storageKey, serialized)
      return () => {
        if (localStorage.getItem(storageKey) === serialized) clear()
      }
    },
    take(now = Date.now()) {
      const serialized = localStorage.getItem(storageKey)
      clear()
      return serialized === null ? null : readIntent(serialized, now)
    },
  }
}
