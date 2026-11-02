import { describe, expect, it } from 'vitest'
import { midiToF0 } from '@/lib/glass/test-frames'
import { readHarmonyVoice, togetherIndex, togetherPos, turnPos, } from './harmony-ear'

const voiced = (midi: number) => ({
  t: 2,
  f0: midiToF0(midi),
  conf: 0.9,
  rms: 0.3,
})

describe("the singer's voice against the harmony", () => {
  it('walks a note from just before its lamp to just past it, taking turns', () => {
    expect(turnPos(2, 10, 10)).toBeCloseTo(1.55)
    expect(turnPos(2, 10, 10.7)).toBeCloseTo(1.975)
    expect(turnPos(2, 10, 20)).toBeCloseTo(2.4)
  })

  it("walks on Merc's clock together, a lamp at the middle of his note", () => {
    expect(togetherPos(1.5, 1, 1, 4)).toBeCloseTo(0)
    expect(togetherPos(3, 1, 1, 4)).toBeCloseTo(1.5)
    expect(togetherPos(0, 1, 1, 4)).toBe(-0.5)
    expect(togetherPos(99, 1, 1, 4)).toBe(3.5)
    expect(togetherIndex(2.2, 1, 1, 4)).toBe(1)
    expect(togetherIndex(99, 1, 1, 4)).toBe(3)
  })

  it('reads the voice in the band of its note, its face following it', () => {
    const read = readHarmonyVoice(voiced(62.2), 62, 35, 1.3)
    expect(read.inBand).toBe(true)
    expect(read.point).toMatchObject({ t: 2, pos: 1.3 })
    expect(read.point.midi).toBeCloseTo(62.2, 2)
    expect(read.voice?.cents).toBeCloseTo(20, 0)
  })

  it('reads a voice past the band, and silence as none', () => {
    expect(readHarmonyVoice(voiced(62.5), 62, 35, 0).inBand).toBe(false)
    const quiet = readHarmonyVoice(
      { t: 3, f0: 0, conf: 0, rms: 0.001 },
      62,
      35,
      0,
    )
    expect(quiet).toEqual({
      point: { t: 3, pos: 0, midi: null },
      voice: null,
      inBand: false,
    })
  })
})
