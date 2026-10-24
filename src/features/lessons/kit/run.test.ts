// ============================================================
// Lesson sound run tests — heard to its end, or stopped where it stands
// ============================================================
//
// A run's promise is what a page reads to know whether a sound was heard to
// its end: kit/predict.ts reveals nothing after a play cut short. So each
// run here goes on fake timers, and must resolve true only at its own end,
// and false once stopped. A tune's voices are heard through a spy on
// `Sound.voice`. A sung line's voice does not go through `Sound`, so it is
// built for real on the fake AudioContext the sound tests use
// (sound-doubles.test-fixtures.ts), and read from what that context holds:
// its timbre, its release, and no voice at all for a silent line. A stop
// starts nothing still to come and releases what sounds with the kit's
// short release (CONVENTIONS.md § 5b); a silent run starts no voice, but
// keeps the visuals' time as if it were heard.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hz } from './notes'
import type { RunNote } from './run'
import { playNotes } from './run'
import { CHORD, LINE, listen, outcome, RUNS, SHORT_RELEASE, soundOn, TUNE, } from './run.test-fixtures'
import { Sound } from './sound'

/** Two notes listed out of order: C4 from 1 s to 2 s, then D4 for the first half second. */
const UNSORTED: readonly RunNote[] = [
  { t: 1, midi: 60, dur: 1 },
  { t: 0, midi: 62, dur: 0.5 },
]

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("a run's promise", () => {
  it.each(RUNS)(
    'resolves true for $kind once it ends by itself, and not before',
    async ({ start, ms }) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const seen = outcome(start())

      // Act
      await vi.advanceTimersByTimeAsync(ms - 1)
      const early = seen.heard
      await vi.advanceTimersByTimeAsync(1)

      // Assert
      expect(early).toBeUndefined()
      expect(seen.heard).toBe(true)
    },
  )

  it.each(RUNS)(
    'resolves false for $kind stopped halfway, even once its end has passed',
    async ({ start, ms }) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const run = start()
      const seen = outcome(run)
      await vi.advanceTimersByTimeAsync(ms / 2)

      // Act
      run.stop()
      await vi.advanceTimersByTimeAsync(ms)

      // Assert
      expect(seen.heard).toBe(false)
    },
  )
})

describe('playNotes', () => {
  it('gives each note its own voice, at its pitch, for its own length and at the caller\'s level, in Merc\'s "ooh" by default', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const voice = vi.spyOn(Sound, 'voice').mockReturnValue(null)
    playNotes(TUNE, { audible: true, gain: 0.13 })

    // Act
    await vi.advanceTimersByTimeAsync(1500)

    // Assert
    expect(voice.mock.calls).toEqual([
      [hz(60), { kind: 'merc', dur: 0.5, gain: 0.13 }],
      [hz(62), { kind: 'merc', dur: 1, gain: 0.13 }],
    ])
  })

  it('starts no voice and fires no onNote for a note whose onset comes after a stop', async () => {
    // Arrange: C4 has started, D4 is still to come
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const onNote = vi.fn()
    const run = playNotes(TUNE, { audible: true, onNote })
    await vi.advanceTimersByTimeAsync(250)

    // Act
    run.stop()
    await vi.advanceTimersByTimeAsync(1500)

    // Assert
    expect(heard.map((v) => v.midi)).toEqual([60])
    expect(onNote.mock.calls).toEqual([[TUNE[0], 0]])
  })

  it('starts no voice when silent, yet fires onNote for each note at its onset and resolves true', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const onNote = vi.fn()
    const seen = outcome(playNotes(TUNE, { audible: false, onNote }))

    // Act
    await vi.advanceTimersByTimeAsync(250)
    const atFirst = onNote.mock.calls.length
    await vi.advanceTimersByTimeAsync(1250)

    // Assert
    expect(heard).toEqual([])
    expect(atFirst).toBe(1)
    expect(onNote.mock.calls).toEqual([
      [TUNE[0], 0],
      [TUNE[1], 1],
    ])
    expect(seen.heard).toBe(true)
  })

  it("releases every voice it started with the kit's short release when stopped", async () => {
    // Arrange: C4, and an E4 that comes in under it, both sounding
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const run = playNotes(
      [
        { t: 0, midi: 60, dur: 1 },
        { t: 0.5, midi: 64, dur: 1 },
      ],
      { audible: true },
    )
    await vi.advanceTimersByTimeAsync(750)

    // Act
    run.stop()

    // Assert
    expect(heard).toEqual([
      { midi: 60, stops: [SHORT_RELEASE] },
      { midi: 64, stops: [SHORT_RELEASE] },
    ])
  })

  it.each([
    { kind: 'a chord whose last-listed note ends first', notes: CHORD },
    { kind: 'notes listed out of order', notes: UNSORTED },
  ])(
    'resolves true for $kind only once its last-ending note has ended',
    async ({ notes }) => {
      // Arrange: both end at 2 s, and the list's last note at 0.5 s
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const seen = outcome(playNotes(notes, { audible: false }))

      // Act
      await vi.advanceTimersByTimeAsync(1999)
      const early = seen.heard
      await vi.advanceTimersByTimeAsync(1)

      // Assert
      expect(early).toBeUndefined()
      expect(seen.heard).toBe(true)
    },
  )

  it("releases a chord's long note when stopped after the list's last note has ended", async () => {
    // Arrange: 1 s in, E3 is over and C3 still sounds
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const run = playNotes(CHORD, { audible: true })
    await vi.advanceTimersByTimeAsync(1000)

    // Act
    run.stop()

    // Assert: in a browser E3's voice has already ended by itself, and its stop does nothing
    expect(heard).toEqual([
      { midi: 48, stops: [SHORT_RELEASE] },
      { midi: 52, stops: [SHORT_RELEASE] },
    ])
  })
})

describe('playLine', () => {
  it("releases its voice with the kit's short release when stopped", async () => {
    // Arrange: the line 1 s in on the fake context's clock
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, slack, ctx } = await soundOn()
    const run = runs.playLine(LINE, { audible: true })
    ctx.currentTime = 1

    // Act
    run.stop()

    // Assert: the envelope falls from where it stands, and the tone and its vibrato stop once it has died away
    const releases = ctx.gains
      .flatMap((g) => g.gain.events)
      .filter(([method, , at]) => method === 'setTargetAtTime' && at === 1)
    expect(releases).toEqual([['setTargetAtTime', 0, 1, SHORT_RELEASE / 5]])
    const after = 1 + SHORT_RELEASE + slack
    expect(ctx.oscillators.map((o) => o.stops.at(-1))).toEqual([
      expect.closeTo(after, 6),
      expect.closeTo(after, 6),
    ])
  })

  it('builds no voice for a silent line with sound on, and still resolves true at its end', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()
    const seen = outcome(runs.playLine(LINE, { audible: false }))

    // Act
    await vi.advanceTimersByTimeAsync(2000)

    // Assert
    expect(ctx.oscillators).toEqual([])
    expect(seen.heard).toBe(true)
  })

  it("shapes the line's voice with the caller's timbre", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()
    const timbre = vi.fn((filter: BiquadFilterNode, envelope: GainNode) => {
      filter.connect(envelope)
    })

    // Act
    runs.playLine(LINE, { audible: true, timbre })

    // Assert: the timbre was handed the line's one voice, at its filter
    expect(timbre.mock.calls.map(([filter]) => filter)).toEqual([
      ctx.filters[0],
    ])
  })
})
