// Google separation intent tests protect exact identity, expiry, and single-use return semantics.
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS, guitarNightBackingFingerprint, prepareGuitarNightGoogleSeparationIntent, takeGuitarNightGoogleSeparationIntent, } from './guitar-night-google-separation-intent'
import type { GuitarNightBackingLease } from './song-port'

function backing(
  overrides: Partial<GuitarNightBackingLease> = {},
): GuitarNightBackingLease {
  return {
    sessionId: 'session-google',
    title: 'Night Drive.wav',
    stems: [
      {
        kind: 'vocal',
        url: 'blob:first-vocal',
        sizeBytes: 64,
        durationSeconds: 120,
      },
      {
        kind: 'instrumental',
        url: 'blob:first-instrumental',
        sizeBytes: 128,
        durationSeconds: 120,
      },
    ],
    defaultMix: {
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    },
    release: () => undefined,
    ...overrides,
  }
}

afterEach(() => localStorage.clear())

describe('Guitar Night Google separation intent', () => {
  it('survives regenerated object URLs but rejects a changed backing asset', () => {
    const original = backing()
    const reopened = backing({
      stems: [...original.stems]
        .reverse()
        .map((stem) => ({ ...stem, url: `blob:reopened-${stem.kind}` })),
    })
    const changed = backing({
      stems: original.stems.map((stem) =>
        stem.kind === 'instrumental' ? { ...stem, sizeBytes: 129 } : stem,
      ),
    })

    expect(guitarNightBackingFingerprint(reopened)).toBe(
      guitarNightBackingFingerprint(original),
    )
    expect(guitarNightBackingFingerprint(changed)).not.toBe(
      guitarNightBackingFingerprint(original),
    )
  })

  it('is single-use and expires at the short return boundary', () => {
    const now = Date.UTC(2026, 7, 25, 12)
    prepareGuitarNightGoogleSeparationIntent(backing(), now)

    expect(
      takeGuitarNightGoogleSeparationIntent(
        now + GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS - 1,
      ),
    ).toMatchObject({ sessionId: 'session-google', createdAt: now })
    expect(takeGuitarNightGoogleSeparationIntent(now)).toBeNull()

    prepareGuitarNightGoogleSeparationIntent(backing(), now)
    expect(
      takeGuitarNightGoogleSeparationIntent(
        now + GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS,
      ),
    ).toBeNull()
    expect(takeGuitarNightGoogleSeparationIntent(now)).toBeNull()
  })

  it('rolls back only the exact prepared value', () => {
    const rollbackFirst = prepareGuitarNightGoogleSeparationIntent(backing(), 1)
    prepareGuitarNightGoogleSeparationIntent(
      backing({ sessionId: 'session-newer' }),
      2,
    )

    rollbackFirst()

    expect(takeGuitarNightGoogleSeparationIntent(3)).toMatchObject({
      sessionId: 'session-newer',
    })
  })
})
