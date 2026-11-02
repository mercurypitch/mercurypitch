import { describe, expect, it } from 'vitest'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { LeapRound } from './leap-round'
import { readLeapVoice } from './voice-reading'

const ROUND: LeapRound = {
  index: 0,
  kind: { size: 7, up: true },
  from: 57,
  to: 64,
}

const voiced = (midi: number) => ({
  t: 1,
  f0: midiToF0(midi),
  conf: 0.9,
  rms: 0.3,
})

describe("the singer's voice against a leap", () => {
  it('reads no voice as none: no face, nothing on either note', () => {
    const read = readLeapVoice({ t: 1, f0: 0, conf: 0, rms: 0.001 }, ROUND, 35)
    expect(read).toEqual({
      point: { t: 1, cents: null },
      voice: null,
      onFrom: false,
      inTarget: false,
    })
  })

  it("sits on Merc's note, half the leap under the trail's line", () => {
    const read = readLeapVoice(voiced(57), ROUND, 35)
    expect(read.onFrom).toBe(true)
    expect(read.inTarget).toBe(false)
    expect(read.point.cents).toBeCloseTo(-350, 0)
  })

  it("sits in the target's band: the lantern warms, Merc's face follows", () => {
    const read = readLeapVoice(voiced(64.2), ROUND, 35)
    expect(read.inTarget).toBe(true)
    expect(read.voice).toMatchObject({ voiced: true })
    expect(read.voice?.cents).toBeCloseTo(20, 0)
    expect(read.voice?.midi).toBeCloseTo(64.2, 2)
  })

  it('leaves the band past its edge', () => {
    expect(readLeapVoice(voiced(63.5), ROUND, 35).inTarget).toBe(false)
  })
})
