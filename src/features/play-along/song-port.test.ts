// Play-along song-port tests protect target-specific part plans and honest fallbacks.
// ============================================================

import { describe, expect, it } from 'vitest'
import { DRUM_PLAY_ALONG_POLICY, GUITAR_PLAY_ALONG_POLICY, planPlayAlongBacking, resolvePlayAlongDefaultMix, } from './song-port'

describe('play-along target policy', () => {
  it('proves every full-band part, then compacts Drum playback to three aligned stems', () => {
    const available = [
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'piano',
      'other',
    ] as const

    expect(planPlayAlongBacking(available, DRUM_PLAY_ALONG_POLICY)).toEqual({
      kind: 'parts',
      requested: ['vocal', 'instrumental', 'drums'],
    })
    expect(
      resolvePlayAlongDefaultMix(
        ['vocal', 'instrumental', 'drums'],
        DRUM_PLAY_ALONG_POLICY,
        { reconstructionProven: true },
      ),
    ).toEqual({
      kind: 'parts',
      audible: ['vocal', 'instrumental', 'drums'],
      muted: [],
    })
  })

  it('keeps drums honestly mixed when only two-stem accompaniment exists', () => {
    expect(
      planPlayAlongBacking(['vocal', 'instrumental'], DRUM_PLAY_ALONG_POLICY),
    ).toEqual({
      kind: 'mixed-instrumental',
      requested: ['vocal', 'instrumental'],
    })
    expect(
      resolvePlayAlongDefaultMix(
        ['vocal', 'instrumental'],
        DRUM_PLAY_ALONG_POLICY,
      ),
    ).toEqual({
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    })
  })

  it('never presents an incomplete 6s partition as separated Drum backing', () => {
    const missingDrums = [
      'vocal',
      'instrumental',
      'bass',
      'guitar',
      'piano',
      'other',
    ] as const
    const missingPiano = [
      'vocal',
      'instrumental',
      'drums',
      'bass',
      'guitar',
      'other',
    ] as const

    expect(planPlayAlongBacking(missingDrums, DRUM_PLAY_ALONG_POLICY)).toEqual({
      kind: 'mixed-instrumental',
      requested: ['vocal', 'instrumental'],
    })
    expect(planPlayAlongBacking(missingPiano, DRUM_PLAY_ALONG_POLICY)).toEqual({
      kind: 'mixed-instrumental',
      requested: ['vocal', 'instrumental'],
    })
    expect(
      resolvePlayAlongDefaultMix(missingPiano, DRUM_PLAY_ALONG_POLICY),
    ).toEqual({
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    })
  })

  it('preserves Guitar Night target behavior through the same policy seam', () => {
    expect(
      resolvePlayAlongDefaultMix(
        ['vocal', 'drums', 'bass', 'guitar'],
        GUITAR_PLAY_ALONG_POLICY,
      ),
    ).toEqual({
      kind: 'parts',
      audible: ['vocal', 'drums', 'bass'],
      muted: ['guitar'],
    })
  })
})
