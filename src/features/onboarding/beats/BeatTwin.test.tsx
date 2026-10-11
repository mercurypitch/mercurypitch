// ============================================================
// The twin's two buttons: where the thumb is, and what Tab meets
// ============================================================
//
// Owner testing on a phone, 11 Oct 2026: Continue belongs on the right,
// under the thumb. Tab has to meet the buttons in the order the eye does,
// so the row is not reversed in CSS: Share comes first in the DOM and the
// phone row runs left to right.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MirrorResult, SteadinessResult } from '@/lib/mirror/metrics'
import { BeatTwin } from './BeatTwin'

const RESULT: MirrorResult = {
  range: {
    lowMidi: 45,
    highMidi: 69,
    lowNote: 'A2',
    highNote: 'A4',
    semitones: 24,
    qualifyingMidis: [],
    voiceHint: 'Baritone',
  },
  accuracy: { score: 74, takes: [], scoopMedianMs: null },
  steadiness: {
    referenceCents: 0,
    referenceNote: 'A3',
    driftCentsPerSec: 0,
    wobbleSdCents: 12,
    vibrato: null,
    score: 82,
    voicedSeconds: 5,
  } as SteadinessResult,
}

const noop = (): void => {}

afterEach(cleanup)

describe('the twin beat buttons', () => {
  it('puts Share before Continue, so Tab reaches Continue last', () => {
    render(() => (
      <BeatTwin
        result={RESULT}
        onShare={() => Promise.resolve(null)}
        onContinue={noop}
      />
    ))

    const share = screen.getByRole('button', { name: 'Share now' })
    const next = screen.getByRole('button', { name: 'Continue' })

    expect(share.parentElement).toBe(next.parentElement)
    expect(
      share.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('lays the phone row out in DOM order, never reversed', () => {
    const css = readFileSync(
      resolve(__dirname, '../onboarding.module.css'),
      'utf8',
    )
    const rule = /\.twinBeat \.actions \{([^}]*)\}/.exec(css)?.[1] ?? ''

    expect(rule).toMatch(/flex-direction:\s*row;/)
    expect(rule).not.toMatch(/row-reverse/)
  })
})
