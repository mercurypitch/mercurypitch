import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { createNoteDemo } from './note-demo'

function demo() {
  const tones: [number, number | undefined][] = []
  let stops = 0
  const player = createNoteDemo({
    playTone: (frequency, durationMs) => {
      tones.push([frequency, durationMs])
      return Promise.resolve()
    },
    stopTone: () => {
      stops += 1
    },
  })
  return { player, tones, stops: () => stops }
}

describe("a drill's example as a row of notes", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('strikes the first note at once, from inside the tap that asked for it', () => {
    const { player, tones } = demo()
    void player.play([60, 67])
    expect(tones).toEqual([[midiToFrequency(60), 800]])
  })

  it('strikes each note after the last, with a gap between', () => {
    const { player, tones } = demo()
    void player.play([60, 67, 72], { noteMs: 400, gapMs: 100 })
    vi.advanceTimersByTime(499)
    expect(tones).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(tones).toHaveLength(2)
    vi.advanceTimersByTime(500)
    expect(tones.map(([frequency]) => frequency)).toEqual(
      [60, 67, 72].map(midiToFrequency),
    )
  })

  it('says it is done when the last note has finished sounding', async () => {
    const { player } = demo()
    let done = false
    void player.play([60, 67], { noteMs: 400, gapMs: 100 }).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(899)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('stopped, falls silent, strikes nothing more and still says it is done', async () => {
    const { player, tones, stops } = demo()
    let done = false
    void player.play([60, 67, 72]).then(() => {
      done = true
    })
    const before = stops()
    player.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
    expect(stops()).toBeGreaterThan(before)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(tones).toHaveLength(1)
  })

  it('asked again while it plays, starts over from its first note', () => {
    const { player, tones } = demo()
    void player.play([60, 67])
    vi.advanceTimersByTime(300)
    void player.play([62, 69])
    expect(tones.map(([frequency]) => frequency)).toEqual(
      [60, 62].map(midiToFrequency),
    )
    vi.advanceTimersByTime(5_000)
    // The first example's second note never sounds.
    expect(tones.map(([frequency]) => frequency)).toEqual(
      [60, 62, 69].map(midiToFrequency),
    )
  })
})
