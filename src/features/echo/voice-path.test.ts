// ============================================================
// The voice's path: from the last star to the note being sung
// ============================================================

import { describe, expect, it } from 'vitest'
import { voiceV } from './sky-layout'
import type { VoiceSample } from './voice-path'
import { LEAD_IN_W, VOICE_PATH_POINTS, voicePath } from './voice-path'

const MIDIS = [60, 64, 67]
const on = (midi: number): VoiceSample => ({ midi, filling: true })

describe('the voice path', () => {
  it('is empty with no voice yet', () => {
    expect(voicePath([], null, 0.5, MIDIS)).toEqual([])
  })

  it('runs from the last star to the note column, spread evenly across the gap', () => {
    const star = { u: 0.2, v: 0.4 }
    const points = voicePath([on(62), on(63), on(64)], star, 0.5, MIDIS)

    expect(points.map((p) => +p.u.toFixed(6))).toEqual([0.2, 0.3, 0.4, 0.5])
    expect(points[0]).toEqual({ u: 0.2, v: 0.4, filling: true })
    expect(points.slice(1).map((p) => p.v)).toEqual(
      [62, 63, 64].map((midi) => voiceV(midi, MIDIS)),
    )
  })

  it('starts a little short of the first ring when no star is lit yet', () => {
    const points = voicePath([on(60), on(60.5)], null, 0.17, MIDIS)

    expect(points.map((p) => +p.u.toFixed(6))).toEqual([
      +(0.17 - LEAD_IN_W).toFixed(6),
      0.17,
    ])
  })

  it('keeps each sample on or off the note', () => {
    const points = voicePath(
      [on(60), { midi: 61.2, filling: false }],
      null,
      0.17,
      MIDIS,
    )

    expect(points.map((p) => p.filling)).toEqual([true, false])
  })

  it('thins a long wait to its most points, ending on the newest sample', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => on(60 + i / 1000))
    const points = voicePath(samples, null, 0.5, MIDIS)

    expect(points).toHaveLength(VOICE_PATH_POINTS)
    expect(points[points.length - 1].v).toBe(voiceV(60 + 999 / 1000, MIDIS))
    expect(points[points.length - 1].u).toBe(0.5)
  })
})
