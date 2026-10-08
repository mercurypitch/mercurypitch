// ============================================================
// A blocked separation's return lease: single use, short life, exact rollback
// ============================================================
//
// Guitar Night and Drum Night both keep a blocked "Separate" press across the
// Google sign-in redirect through this store. These pin the parts that make
// it safe to keep: it is read once, it expires, a rollback removes only the
// value it wrote, a damaged value reads as nothing, and each room's key is
// its own.

import { afterEach, describe, expect, it } from 'vitest'
import { GOOGLE_SEPARATION_INTENT_TTL_MS, googleSeparationIntentStore, } from './google-separation-intent'

const store = googleSeparationIntentStore('mp:testGoogleSeparationIntent')

afterEach(() => localStorage.clear())

describe('a Google separation return lease', () => {
  it('is single-use and expires at the short return boundary', () => {
    const now = Date.UTC(2026, 9, 8, 21)
    store.prepare('session-google', 'fingerprint-a', now)

    expect(store.take(now + GOOGLE_SEPARATION_INTENT_TTL_MS - 1)).toEqual({
      version: 1,
      sessionId: 'session-google',
      backingFingerprint: 'fingerprint-a',
      createdAt: now,
      expiresAt: now + GOOGLE_SEPARATION_INTENT_TTL_MS,
    })
    expect(store.take(now)).toBeNull()

    store.prepare('session-google', 'fingerprint-a', now)
    expect(store.take(now + GOOGLE_SEPARATION_INTENT_TTL_MS)).toBeNull()
    expect(store.take(now)).toBeNull()
  })

  it('rolls back only the exact value it prepared', () => {
    const rollbackFirst = store.prepare('session-first', 'fingerprint-a', 1)
    store.prepare('session-newer', 'fingerprint-b', 2)

    rollbackFirst()

    expect(store.take(3)).toMatchObject({ sessionId: 'session-newer' })
  })

  it('reads a damaged or forged value as nothing, and removes it', () => {
    const key = 'mp:testGoogleSeparationIntent'
    const now = 1_000
    for (const stored of [
      'not json',
      JSON.stringify({ version: 2, sessionId: 's', backingFingerprint: 'f' }),
      JSON.stringify({
        version: 1,
        sessionId: ' ',
        backingFingerprint: 'f',
        createdAt: now,
        expiresAt: now + GOOGLE_SEPARATION_INTENT_TTL_MS,
      }),
      // A lease that claims to live longer than any this store writes.
      JSON.stringify({
        version: 1,
        sessionId: 's',
        backingFingerprint: 'f',
        createdAt: now,
        expiresAt: now + GOOGLE_SEPARATION_INTENT_TTL_MS * 10,
      }),
    ]) {
      localStorage.setItem(key, stored)
      expect(store.take(now + 1)).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it("keeps each room's lease under its own key", () => {
    const other = googleSeparationIntentStore('mp:otherGoogleSeparationIntent')
    store.prepare('session-guitar', 'fingerprint-a', 1)
    other.prepare('session-drums', 'fingerprint-b', 1)

    other.clear()

    expect(other.take(2)).toBeNull()
    expect(store.take(2)).toMatchObject({ sessionId: 'session-guitar' })
  })
})
