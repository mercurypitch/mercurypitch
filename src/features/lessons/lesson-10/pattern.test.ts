// ============================================================
// Lesson 10 pattern tests — Step 4's quavers, and a switch from the next one
// ============================================================
//
// WEB-SPEC Toys 1's pattern, on the kit's own runs and fake timers: root,
// fifth, third, fifth four times over in quavers, then the chord together
// for 1.0 s, 7.857 s at Slow and 4.0 s at Fast (FACTS 76); a change of
// tempo or quality while it plays takes effect from the next quaver, never
// the one sounding; a stop ends it where it stands, and so does every
// sound stopping, between two quavers too; its notes sound at the run's
// level, and the chord's at a chord voice's, 0.075 each (FACTS 81).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { RunNote } from '@/features/lessons/kit/run'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { PatternSet } from './pattern'
import { patternPart, playPattern } from './pattern'

/** A note heard, with when it started, ms from the press. */
interface Heard {
  readonly at: number
  readonly midi: number
  readonly dur: number
}

/**
 * A time within the timers' whole-millisecond grain of `want` ms: each
 * quaver is timed from the press, so the grain never adds up.
 */
function expectAt(at: number | null, want: number): void {
  expect(Math.abs((at ?? Number.NaN) - want)).toBeLessThan(1.5)
}

const SLOW_Q = 30 / 70
const FAST_Q = 30 / 160
const ROLES = [60, 67, 64, 67]

/** The pattern played silently on `set`, each note heard with its start. */
function playOn(set: { current: PatternSet }) {
  const heard: Heard[] = []
  let ended: number | null = null
  const run = playPattern({
    audible: false,
    set: () => set.current,
    onNote: (n: RunNote) =>
      heard.push({ at: performance.now(), midi: n.midi, dur: n.dur }),
  })
  void run.done.then(() => {
    ended = performance.now()
  })
  return { run, heard, ended: () => ended }
}

/** The clock on by `ms`, the promises the player awaits settling as it goes. */
const later = (ms: number): Promise<void> =>
  vi.advanceTimersByTimeAsync(ms).then(() => undefined)

const C_MAJOR = (tempo: PatternSet['tempo']): { current: PatternSet } => ({
  current: { root: 60, quality: 'major', tempo },
})

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'performance'],
    now: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("Lesson 10's pattern", () => {
  it('plays root, fifth, third, fifth four times in quavers, then the chord for 1.0 s: 7.857 s at Slow', async () => {
    // Arrange
    const p = playOn(C_MAJOR('slow'))

    // Act
    await later(10_000)

    // Assert: FACTS 76
    expect(p.heard.map((h) => h.midi)).toEqual([
      ...ROLES,
      ...ROLES,
      ...ROLES,
      ...ROLES,
      60,
      64,
      67,
    ])
    p.heard.slice(0, 16).forEach((h, i) => {
      expectAt(h.at, i * SLOW_Q * 1000)
      expect(h.dur).toBeCloseTo(0.9 * SLOW_Q, 9)
    })
    expect(p.heard.slice(16).map((h) => h.dur)).toEqual([1, 1, 1])
    expectAt(p.heard[16].at, 16 * SLOW_Q * 1000)
    expectAt(p.ended(), (16 * SLOW_Q + 1) * 1000)
    await expect(p.run.done).resolves.toBe(true)
  })

  it('lasts 4.0 s at Fast', async () => {
    // Arrange
    const p = playOn(C_MAJOR('fast'))

    // Act
    await later(10_000)

    // Assert: the same sixteen quavers and chord, at 160 a minute (FACTS 76)
    expect(p.heard).toHaveLength(19)
    expectAt(p.heard[1].at, FAST_Q * 1000)
    expect(p.heard[0].dur).toBeCloseTo(0.9 * FAST_Q, 9)
    expectAt(p.ended(), 4000)
    await expect(p.run.done).resolves.toBe(true)
  })

  it('takes a change of tempo from the next quaver, never the one sounding', async () => {
    // Arrange: Slow, halfway through the first quaver
    const set = C_MAJOR('slow')
    const p = playOn(set)
    await later(200)

    // Act
    set.current = { ...set.current, tempo: 'fast' }
    await later(10_000)

    // Assert: the first quaver keeps its slow length, the rest go fast
    expect(p.heard[0].dur).toBeCloseTo(0.9 * SLOW_Q, 9)
    expectAt(p.heard[1].at, SLOW_Q * 1000)
    expect(p.heard[1].dur).toBeCloseTo(0.9 * FAST_Q, 9)
    expectAt(p.heard[2].at, (SLOW_Q + FAST_Q) * 1000)
    expectAt(p.ended(), (SLOW_Q + 15 * FAST_Q + 1) * 1000)
  })

  it('takes a change of quality from the next quaver, the chord with it', async () => {
    // Arrange: Fast, the third of the first four sounding
    const set = C_MAJOR('fast')
    const p = playOn(set)
    await later((2 * FAST_Q + 0.05) * 1000)

    // Act
    set.current = { ...set.current, quality: 'minor' }
    await later(10_000)

    // Assert: E4 as it sounds, E flat 4 from the next third on
    expect(p.heard.map((h) => h.midi)).toEqual([
      60, 67, 64, 67, 60, 67, 63, 67, 60, 67, 63, 67, 60, 67, 63, 67, 60, 63,
      67,
    ])
  })

  it('stops where it stands: no quaver after the stop, and not heard', async () => {
    // Arrange
    const p = playOn(C_MAJOR('slow'))
    await later(1000)
    const before = p.heard.length

    // Act
    p.run.stop()
    await later(10_000)

    // Assert
    expect(before).toBe(3)
    expect(p.heard).toHaveLength(3)
    await expect(p.run.done).resolves.toBe(false)
  })

  it('stops, not heard, when every sound stops between two quavers', async () => {
    // Arrange: sound on, every voice heard; the first quaver over, the second not yet begun
    vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
    const voices: { midi: number; stopped: boolean }[] = []
    vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
      const v = {
        midi: Math.round(69 + 12 * Math.log2(freq / 440)),
        stopped: false,
      }
      voices.push(v)
      const voice: Voice = {
        alive: true,
        setFreq: () => undefined,
        setGain: () => undefined,
        stop: () => {
          v.stopped = true
        },
      }
      return voice
    })
    const run = playPattern({
      audible: true,
      set: () => C_MAJOR('slow').current,
    })
    await later(0.95 * SLOW_Q * 1000)

    // Act
    Sound.stopAll()
    await later(10_000)

    // Assert
    expect(voices.map((v) => v.midi)).toEqual([60])
    await expect(run.done).resolves.toBe(false)
  })

  it('plays a quaver at the run’s level, and the chord’s three at a chord voice’s, 0.075 each', () => {
    // Act
    const quaver = patternPart(C_MAJOR('fast').current, 2)
    const chord = patternPart({ root: 60, quality: 'minor', tempo: 'slow' }, 16)

    // Assert: FACTS 76 and 81
    expect(quaver).toEqual([{ t: 0, midi: 64, dur: 0.9 * FAST_Q }])
    expect(chord).toEqual([
      { t: 0, midi: 60, dur: 1, gain: 0.075 },
      { t: 0, midi: 63, dur: 1, gain: 0.075 },
      { t: 0, midi: 67, dur: 1, gain: 0.075 },
    ])
  })
})
