// ============================================================
// Which Drum Night backing a Google return may resume a separation for
// ============================================================
//
// The return lease names the song by a fingerprint, so a song reopened after
// the redirect still matches while a different recording under the same id
// does not. The room-level round trip is pinned in DrumNightApp.test.tsx.

import { describe, expect, it } from 'vitest'
import type { DrumSeparationBacking } from './useDrumNightGoogleSeparationReturn'
import { drumNightBackingFingerprint } from './useDrumNightGoogleSeparationReturn'

function backing(
  overrides: Partial<DrumSeparationBacking> = {},
): DrumSeparationBacking {
  return {
    sessionId: 'session-google',
    title: 'Night Drive.wav',
    source: 'device',
    stemKinds: ['vocal', 'instrumental'],
    plannedMix: {
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    },
    durationSeconds: 210,
    ...overrides,
  }
}

describe('a Drum Night backing fingerprint', () => {
  it('matches the same song reopened, whatever order its parts arrive in', () => {
    const reopened = backing({
      stemKinds: ['instrumental', 'vocal'],
      plannedMix: {
        kind: 'mixed-instrumental',
        audible: ['instrumental', 'vocal'],
        muted: [],
      },
    })

    expect(drumNightBackingFingerprint(reopened)).toBe(
      drumNightBackingFingerprint(backing()),
    )
  })

  it('tells a different recording under the same id apart', () => {
    expect(
      drumNightBackingFingerprint(backing({ durationSeconds: 211 })),
    ).not.toBe(drumNightBackingFingerprint(backing()))
    expect(
      drumNightBackingFingerprint(backing({ title: 'Other.wav' })),
    ).not.toBe(drumNightBackingFingerprint(backing()))
  })
})
