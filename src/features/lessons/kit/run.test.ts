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
//
// Chords: notes that share an onset start in one timer task. A task shows
// itself through a microtask (`taskCounter`), which runs only once the task
// that queued it is over, and the async timer advances let microtasks run
// between two timers. A note's own tone and level win over the run's. Several
// runs join as one through `allOf`, and every sound stopping (the Sound
// switch, the hush, a hidden page) ends an audible run unheard.
//
// Past 600 lines (TESTING.md § 3.5): this is the one place each kind of run
// is held to each way it can end, by itself, stopped, cut short by every
// sound stopping, or as part of a run made of several.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hz } from './notes'
import type * as RunKit from './run'
import type { Run, RunNote } from './run'
import { allOf, playLine, playNote, playNotes } from './run'
import type { Voice } from './sound'
import { contourOf, Sound } from './sound'
import { FakeContext } from './sound-doubles.test-fixtures'

/** The release a stop gives each voice, seconds: the kit's short release, as kit/tune-line.ts's stop uses. */
const SHORT_RELEASE = 0.08

/** A two-note tune: C4 for half a second, then D4 for a second, 1.5 s in all. */
const TUNE: readonly RunNote[] = [
  { t: 0, midi: 60, dur: 0.5 },
  { t: 0.5, midi: 62, dur: 1 },
]

/** A chord: C3 held for 2 s under an E3 of half a second, listed last, so the list's last note ends first. */
const CHORD: readonly RunNote[] = [
  { t: 0, midi: 48, dur: 2 },
  { t: 0, midi: 52, dur: 0.5 },
]

/** Two notes listed out of order: C4 from 1 s to 2 s, then D4 for the first half second. */
const UNSORTED: readonly RunNote[] = [
  { t: 1, midi: 60, dur: 1 },
  { t: 0, midi: 62, dur: 0.5 },
]

/** A C major chord at 0 in the soft tone at 0.05, under the tune's E5 in Merc's "ooh" at 0.2 (Lesson 12's tunes). */
const CHORD_UNDER_TUNE: readonly RunNote[] = [
  { t: 0, midi: 48, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 52, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 55, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 76, dur: 0.5, kind: 'merc', gain: 0.2 },
]

/** A sung line: A3 held for a second, then a glide up to C4 over a second, 2 s in all. */
const LINE = contourOf(220, [{ hold: 1 }, { glide: 1, to: hz(60) }])

/** Each kind of run, silent, and how long it lasts, milliseconds. */
const RUNS: readonly { kind: string; start: () => Run; ms: number }[] = [
  {
    kind: 'a sung line',
    start: () => playLine(LINE, { audible: false }),
    ms: 2000,
  },
  {
    kind: 'a tune',
    start: () => playNotes(TUNE, { audible: false }),
    ms: 1500,
  },
  {
    kind: 'one note',
    start: () => playNote(57, 0.75, { audible: false }),
    ms: 750,
  },
]

/** Each kind of run, as RUNS has them, but sounding. */
const SOUNDING: readonly { kind: string; start: () => Run; ms: number }[] = [
  {
    kind: 'a sung line',
    start: () => playLine(LINE, { audible: true }),
    ms: 2000,
  },
  { kind: 'a tune', start: () => playNotes(TUNE, { audible: true }), ms: 1500 },
  {
    kind: 'one note',
    start: () => playNote(57, 0.75, { audible: true }),
    ms: 750,
  },
]

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** What a run's promise has said so far: nothing while it runs. */
function outcome(run: Run): { heard?: boolean } {
  const seen: { heard?: boolean } = {}
  void run.done.then((heard) => {
    seen.heard = heard
  })
  return seen
}

/** A voice a run started: its MIDI note, and the release of each stop it was given. */
interface HeardVoice {
  readonly midi: number
  readonly stops: (number | undefined)[]
}

/** Every voice a run starts from now on, in order, heard through a spy on `Sound.voice`. */
function listen(): HeardVoice[] {
  const heard: HeardVoice[] = []
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const v: HeardVoice = {
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      stops: [],
    }
    heard.push(v)
    const voice: Voice = {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: (release?: number) => {
        v.stops.push(release)
      },
    }
    return voice
  })
  return heard
}

/** Numbers the tasks its callers run in, from 0: its microtask runs once the caller's task is over, so one task shares a number. */
function taskCounter(): () => number {
  let task = 0
  let queued = false
  return () => {
    if (!queued) {
      queued = true
      queueMicrotask(() => {
        queued = false
        task += 1
      })
    }
    return task
  }
}

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

  it("starts a chord's soft notes and the tune's Merc note over it in one task, each at its own tone and level, onNote hearing all four there", async () => {
    // Arrange: four notes that share an onset, so one timer task starts them all
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const task = taskCounter()
    const voiceTasks: number[] = []
    const voice = vi.spyOn(Sound, 'voice').mockImplementation(() => {
      voiceTasks.push(task())
      return null
    })
    const noteTasks: number[] = []
    playNotes(CHORD_UNDER_TUNE, {
      audible: true,
      gain: 0.13,
      onNote: () => noteTasks.push(task()),
    })

    // Act
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(voice.mock.calls).toEqual([
      [hz(48), { kind: 'soft', dur: 1, gain: 0.05 }],
      [hz(52), { kind: 'soft', dur: 1, gain: 0.05 }],
      [hz(55), { kind: 'soft', dur: 1, gain: 0.05 }],
      [hz(76), { kind: 'merc', dur: 0.5, gain: 0.2 }],
    ])
    expect(voiceTasks).toEqual([0, 0, 0, 0])
    expect(noteTasks).toEqual([0, 0, 0, 0])
  })

  it("gives a note with no tone or level of its own the run's", async () => {
    // Arrange: a soft run at 0.13; C4 in Merc's "ooh" at 0.2 of its own, then D4 with neither
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const voice = vi.spyOn(Sound, 'voice').mockReturnValue(null)
    playNotes(
      [
        { t: 0, midi: 60, dur: 0.5, kind: 'merc', gain: 0.2 },
        { t: 0.5, midi: 62, dur: 0.5 },
      ],
      { audible: true, kind: 'soft', gain: 0.13 },
    )

    // Act
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(voice.mock.calls).toEqual([
      [hz(60), { kind: 'merc', dur: 0.5, gain: 0.2 }],
      [hz(62), { kind: 'soft', dur: 0.5, gain: 0.13 }],
    ])
  })

  it('calls onNote for the notes at time 0 only once playNotes has returned', async () => {
    // Arrange: Lesson 7 compares its run with `run !== r` before it has assigned `r`
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const onNote = vi.fn()

    // Act
    playNotes(CHORD, { audible: false, onNote })
    const atReturn = onNote.mock.calls.length
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(atReturn).toBe(0)
    expect(onNote.mock.calls).toEqual([
      [CHORD[0], 0],
      [CHORD[1], 1],
    ])
  })
})

describe('allOf', () => {
  it('resolves true once every part has ended by itself, and not before', async () => {
    // Arrange: a move's shape, a held note of a second and a line of two
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const seen = outcome(
      allOf([
        playNote(60, 1, { audible: false }),
        playLine(LINE, { audible: false }),
      ]),
    )

    // Act
    await vi.advanceTimersByTimeAsync(1999)
    const early = seen.heard
    await vi.advanceTimersByTimeAsync(1)

    // Assert
    expect(early).toBeUndefined()
    expect(seen.heard).toBe(true)
  })

  it('resolves false at once when one part is stopped, and stops the rest where they stand', async () => {
    // Arrange: C4 and E4 held for 2 s, half a second in
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const held = playNote(60, 2, { audible: true })
    const seen = outcome(allOf([held, playNote(64, 2, { audible: true })]))
    await vi.advanceTimersByTimeAsync(500)

    // Act
    held.stop()
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(seen.heard).toBe(false)
    expect(heard).toEqual([
      { midi: 60, stops: [SHORT_RELEASE] },
      { midi: 64, stops: [SHORT_RELEASE] },
    ])
  })

  it('stops every part with its own stop, and resolves false', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const both = allOf([
      playNote(60, 2, { audible: true }),
      playNote(64, 2, { audible: true }),
    ])
    const seen = outcome(both)
    await vi.advanceTimersByTimeAsync(500)

    // Act
    both.stop()
    await vi.advanceTimersByTimeAsync(2000)

    // Assert
    expect(seen.heard).toBe(false)
    expect(heard).toEqual([
      { midi: 60, stops: [SHORT_RELEASE] },
      { midi: 64, stops: [SHORT_RELEASE] },
    ])
  })
})

describe('every sound stopping', () => {
  afterEach(() => {
    Sound.hush(false)
    Sound.set('unset')
    Reflect.deleteProperty(document, 'hidden')
  })

  it.each(SOUNDING)(
    'resolves false for $kind that sounds, even once its end has passed',
    async ({ start, ms }) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const seen = outcome(start())
      await vi.advanceTimersByTimeAsync(ms / 2)

      // Act
      Sound.stopAll()
      await vi.advanceTimersByTimeAsync(ms)

      // Assert
      expect(seen.heard).toBe(false)
    },
  )

  it.each([
    { when: 'the Sound switch turns off', stop: () => Sound.set('off') },
    { when: 'a microphone take hushes the page', stop: () => Sound.hush(true) },
    {
      when: 'the page is hidden',
      stop: () => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      },
    },
  ])(
    'ends a tune unheard when $when, starting no note still to come',
    async ({ stop }) => {
      // Arrange: C4 has started, D4 is still to come
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const heard = listen()
      const seen = outcome(playNotes(TUNE, { audible: true }))
      await vi.advanceTimersByTimeAsync(250)

      // Act
      stop()
      await vi.advanceTimersByTimeAsync(1500)

      // Assert
      expect(seen.heard).toBe(false)
      expect(heard.map((v) => v.midi)).toEqual([60])
    },
  )

  it.each(RUNS)(
    'lets $kind that is silent run on to its end, and resolve true',
    async ({ start, ms }) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const seen = outcome(start())
      await vi.advanceTimersByTimeAsync(ms / 2)

      // Act
      Sound.stopAll()
      await vi.advanceTimersByTimeAsync(ms / 2)

      // Assert
      expect(seen.heard).toBe(true)
    },
  )
})

describe('playLine', () => {
  beforeEach(() => {
    // a fresh sound module, so the fake AudioContext is the one it makes
    vi.resetModules()
    FakeContext.last = null
    vi.stubGlobal('AudioContext', FakeContext)
  })

  /** Sound on, as after a first tap: fresh run and sound modules, and the fake AudioContext they made. */
  async function soundOn(): Promise<{
    runs: typeof RunKit
    slack: number
    ctx: FakeContext
  }> {
    const kit = await import('./sound')
    const runs = await import('./run')
    kit.Sound.set('on')
    const ctx = FakeContext.last
    if (ctx === null) throw new Error('no context was made')
    return { runs, slack: kit.SLACK, ctx }
  }

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

  it("sings the line at the caller's level", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { runs, ctx } = await soundOn()

    // Act
    runs.playLine(LINE, { audible: true, gain: 0.05 })

    // Assert: the level gain is the voice's second gain, held at 0.05 along the line
    expect(ctx.gains[2].gain.events).toEqual([
      ['setValueAtTime', 0.05, 0],
      ['exponentialRampToValueAtTime', 0.05, 1],
      ['exponentialRampToValueAtTime', 0.05, 2],
    ])
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
