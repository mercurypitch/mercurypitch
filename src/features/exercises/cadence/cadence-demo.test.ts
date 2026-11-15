// ============================================================
// Name the Cadence's example: what it plays, when, and how it ends
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCadenceDemo, EXAMPLE_CADENCE, exampleLine } from './cadence-demo'
import { stepsOf } from './cadence-rounds'
import { CHORD_MS, GAP_MS, LAST_CHORD_MS, playbackMs, } from './use-cadence-controller'

function demoWithEngine() {
  const playChord = vi.fn<(midis: readonly number[], ms: number) => void>()
  const stopSound = vi.fn<() => void>()
  return {
    demo: createCadenceDemo({ playChord, stopSound }),
    playChord,
    stopSound,
  }
}

describe("Name the Cadence's example", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a perfect cadence in C: the key, then V to I', () => {
    const [home, first, last] = stepsOf(EXAMPLE_CADENCE)
    // C major over its root an octave down, as every round voices a chord.
    expect(home?.midis).toEqual([48, 60, 64, 67])
    expect(first?.degree).toBe(5)
    expect(last?.midis).toEqual(home?.midis)
    expect(exampleLine()).toBe(
      'Listen: home, then V to I. A perfect cadence: it comes home.',
    )
  })

  it('strikes the first chord at once and the others as a round does', async () => {
    const { demo, playChord } = demoWithEngine()
    const steps = stepsOf(EXAMPLE_CADENCE)
    let ended = false
    void demo.play().then(() => {
      ended = true
    })

    // Inside the tap: a browser lets a page make its first sound only there.
    expect(playChord).toHaveBeenCalledTimes(1)
    expect(playChord).toHaveBeenLastCalledWith(steps[0]?.midis, CHORD_MS)

    await vi.advanceTimersByTimeAsync(CHORD_MS + GAP_MS)
    expect(playChord).toHaveBeenCalledTimes(2)
    expect(playChord).toHaveBeenLastCalledWith(steps[1]?.midis, CHORD_MS)

    await vi.advanceTimersByTimeAsync(CHORD_MS + GAP_MS)
    expect(playChord).toHaveBeenCalledTimes(3)
    expect(playChord).toHaveBeenLastCalledWith(steps[2]?.midis, LAST_CHORD_MS)
    expect(ended).toBe(false)

    // It lasts as long as a round's playback, to the millisecond.
    await vi.advanceTimersByTimeAsync(LAST_CHORD_MS - 1)
    expect(ended).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(ended).toBe(true)
    expect(2 * (CHORD_MS + GAP_MS) + LAST_CHORD_MS).toBe(
      playbackMs(EXAMPLE_CADENCE),
    )
  })

  it('cut short, goes quiet, strikes nothing more and still ends', async () => {
    const { demo, playChord, stopSound } = demoWithEngine()
    let ended = false
    void demo.play().then(() => {
      ended = true
    })
    await vi.advanceTimersByTimeAsync(200)

    demo.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(stopSound).toHaveBeenCalledTimes(1)
    expect(ended).toBe(true)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(playChord).toHaveBeenCalledTimes(1)
  })

  it('says which chord is sounding, and when the ending has been heard', async () => {
    const seen: [number, boolean][] = []
    const demo = createCadenceDemo({
      playChord: () => {},
      stopSound: () => {},
      onSounding: (index, last) => seen.push([index, last]),
    })
    void demo.play()
    await vi.advanceTimersByTimeAsync(playbackMs(EXAMPLE_CADENCE))
    expect(seen).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [-1, false],
    ])
  })

  it('cut short, says nothing is sounding', async () => {
    const seen: number[] = []
    const demo = createCadenceDemo({
      playChord: () => {},
      stopSound: () => {},
      onSounding: (index) => seen.push(index),
    })
    void demo.play()
    await vi.advanceTimersByTimeAsync(100)
    demo.stop()
    expect(seen).toEqual([0, -1])
  })

  it('leaves the engine alone when nothing was playing', () => {
    const { demo, stopSound } = demoWithEngine()
    demo.stop()
    expect(stopSound).not.toHaveBeenCalled()
  })
})
