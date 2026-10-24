// ============================================================
// Lesson sound run tests — chords, a note's own tone, runs joined, all stopped
// ============================================================
//
// What Lessons 10 and 12 ask of the kit's runs (kit/run.ts), on fake timers
// and a spy on `Sound.voice`, with kit/run.test.ts's tunes and helpers
// (run.test-fixtures.ts). Notes that share an onset start in one timer task.
// A task shows itself through a microtask (`taskCounter`), which runs only
// once the task that queued it is over, and the async timer advances let
// microtasks run between two timers. A note's own tone and level win over
// the run's, and a sung line takes the run's level. Several runs join as one
// through `allOf`, and every sound stopping (the Sound switch, the hush, a
// hidden page) ends an audible run unheard, while a silent run goes on.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hz } from './notes'
import type { Run, RunNote } from './run'
import { allOf, playLine, playNote, playNotes } from './run'
import { CHORD, LINE, listen, outcome, RUNS, SHORT_RELEASE, soundOn, TUNE, } from './run.test-fixtures'
import { Sound } from './sound'

/** A C major chord at 0 in the soft tone at 0.05, under the tune's E5 in Merc's "ooh" at 0.2 (Lesson 12's tunes). */
const CHORD_UNDER_TUNE: readonly RunNote[] = [
  { t: 0, midi: 48, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 52, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 55, dur: 1, kind: 'soft', gain: 0.05 },
  { t: 0, midi: 76, dur: 0.5, kind: 'merc', gain: 0.2 },
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

describe("playNotes: chords, and a note's own tone and level", () => {
  it('starts three notes that share an onset in one task, and a later onset in a task of its own', async () => {
    // Arrange: a C major chord at 0, then C4 at half a second
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const task = taskCounter()
    const started: [midi: number, task: number][] = []
    vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
      started.push([Math.round(69 + 12 * Math.log2(freq / 440)), task()])
      return null
    })
    playNotes(
      [
        { t: 0, midi: 48, dur: 1 },
        { t: 0, midi: 52, dur: 1 },
        { t: 0, midi: 55, dur: 1 },
        { t: 0.5, midi: 60, dur: 0.5 },
      ],
      { audible: true },
    )

    // Act
    await vi.advanceTimersByTimeAsync(500)

    // Assert
    expect(started).toEqual([
      [48, 0],
      [52, 0],
      [55, 0],
      [60, 1],
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

describe('playLine: a level', () => {
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
