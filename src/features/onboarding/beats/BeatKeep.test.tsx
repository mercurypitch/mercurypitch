// ============================================================
// Keep — what an account keeps leads with the weekly Check-up
// ============================================================
//
// The first row says what an account keeps that this browser does not: every
// weekly Check-up (docs/specs/weekly-check-up.ears.md), where the browser
// holds the latest twelve. It names no range, so it reads the same after a
// clean read and after one that was not clean (A3 to A3, a steady tone), where
// the old "Your voiceprint and range, saved" claimed a range nobody measured.
// The rest of Keep's states are onboarding-launch-gift-beats.test.tsx's.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { BeatKeep } from './BeatKeep'

afterEach(cleanup)

function result(lowMidi: number, highMidi: number): MirrorResult {
  return {
    range: {
      lowMidi,
      highMidi,
      lowNote: '',
      highNote: '',
      semitones: highMidi - lowMidi,
      qualifyingMidis: [lowMidi, highMidi],
      voiceHint: null,
    },
    accuracy: null,
    steadiness: null,
  }
}

function firstRow(voiceprint: MirrorResult): HTMLElement {
  const { container } = render(() => (
    <BeatKeep
      twin={null}
      voiceprint={voiceprint}
      gift={null}
      onCreateAccount={() => undefined}
    />
  ))
  const row = container.querySelector<HTMLElement>('[data-beat="keep"] li')
  if (row === null) throw new Error('no first row')
  return row
}

describe("Keep's first row", () => {
  it.each([
    ['a clean read', result(43, 67)],
    ['a read that was not clean', result(57, 57)],
  ])(
    'offers every weekly Check-up after %s, and claims no range',
    (_read, voiceprint) => {
      // Act
      const row = firstRow(voiceprint)

      // Assert
      expect(row).toHaveTextContent('Every weekly Check-up, kept')
      expect(row).not.toHaveTextContent(/range/i)
    },
  )
})
