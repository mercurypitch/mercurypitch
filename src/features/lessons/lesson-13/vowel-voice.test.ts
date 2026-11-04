// Merc's vowel voice on a recording AudioContext (Lesson 13 WEB-SPEC,
// Audio; Tests 2 and 14): the source as its wave, three resonators in
// series gliding at the line's points with Q in decibels, the note never
// moving, and the source alone through no resonance. A voice with no
// timbre is built as before: kit/sound.test.ts holds that.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { soundOn } from '@/features/lessons/kit/run.test-fixtures'
import { eeThenAh, sourceLine } from './plays'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Sound on, and this page's voice from the same module graph. */
async function voiceOn() {
  const on = await soundOn()
  const waves: number[][] = []
  vi.spyOn(on.ctx, 'createPeriodicWave').mockImplementation(
    (_real: unknown, imag: unknown) => {
      waves.push(Array.from(imag as Float32Array))
      return {}
    },
  )
  const voice = await import('./vowel-voice')
  return { ...on, voice, waves }
}

describe("Merc's vowel voice (WEB-SPEC, Audio)", () => {
  it("sings 'ee', then 'ah' through three lowpass resonators in series, gliding to 'ah''s over the change", async () => {
    // Arrange
    vi.useFakeTimers()
    const { ctx, voice, waves } = await voiceOn()

    // Act
    voice.singLine(eeThenAh('lower', 57), true)

    // Assert: the kit's lowpass is the first of them
    expect(ctx.filters.map((f) => f.type)).toEqual([
      'lowpass',
      'lowpass',
      'lowpass',
    ])
    const [r1, r2, r3] = ctx.filters
    expect(r1.frequency.events).toEqual([
      ['setValueAtTime', 279.8, 0],
      ['exponentialRampToValueAtTime', 279.8, 2],
      ['exponentialRampToValueAtTime', 645.4, 2.5],
      ['exponentialRampToValueAtTime', 645.4, 4.5],
    ])
    expect(r1.Q.events[0]).toEqual([
      'setValueAtTime',
      expect.closeTo(20 * Math.log10(279.8 / 80), 9),
      0,
    ])
    expect(r2.Q.events.at(-1)).toEqual([
      'linearRampToValueAtTime',
      expect.closeTo(20 * Math.log10(1155.5 / 80), 9),
      4.5,
    ])
    expect(r3.frequency.events.at(-1)?.[1]).toBe(2490.3)
    // the wave: 18 harmonics at 1/k, after the kit's two
    const wave = waves.at(-1) ?? []
    expect(wave).toHaveLength(19)
    expect(wave[0]).toBe(0)
    expect(wave[3]).toBeCloseTo(1 / 3, 6)
  })

  it('keeps the note where it is: the oscillator holds 220 Hz at every point', async () => {
    // Arrange
    vi.useFakeTimers()
    const { ctx, voice } = await voiceOn()

    // Act
    voice.singLine(eeThenAh('lower', 57), true)

    // Assert
    const freqs = ctx.oscillators[0].frequency.events.map((e) => e[1])
    expect(new Set(freqs)).toEqual(new Set([220]))
  })

  it('passes the source alone through no resonance', async () => {
    // Arrange
    vi.useFakeTimers()
    const { ctx, voice, waves } = await voiceOn()

    // Act
    voice.singLine(sourceLine('lower', 57, 4, 1.5), true)

    // Assert
    expect(ctx.filters.map((f) => f.type)).toEqual(['allpass'])
    expect(waves.at(-1)).toHaveLength(5)
  })

  it('sounds nothing for a silent play, and its run still ends on time, heard', async () => {
    // Arrange
    vi.useFakeTimers()
    const { ctx, voice } = await voiceOn()

    // Act
    const run = voice.singLine(eeThenAh('lower', 57), false)
    vi.advanceTimersByTime(4500)

    // Assert
    await expect(run.done).resolves.toBe(true)
    expect(ctx.filters).toHaveLength(0)
  })
})
