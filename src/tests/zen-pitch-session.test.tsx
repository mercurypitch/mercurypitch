import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PracticeFrame } from '@/features/practice/usePracticeController'
import type { ZenExerciseDefinition, ZenPitchRun } from '@/features/zen/types'
import type { ZenPitchSession } from '@/features/zen/useZenPitchSession'
import { useZenPitchSession } from '@/features/zen/useZenPitchSession'
import { DEFAULT_ZEN_LOOP_SECONDS } from '@/features/zen/zen-model'
import type { PitchResult } from '@/types'

const DEFAULT_LOOP_MS = DEFAULT_ZEN_LOOP_SECONDS * 1000

const pitch = (midi: number): PitchResult => ({
  freq: 440 * 2 ** ((midi - 69) / 12),
  midi,
  note: 'C',
  noteName: 'C',
  targetMidi: midi,
  targetNote: 'C',
  cents: 0,
  frequency: 440 * 2 ** ((midi - 69) / 12),
  clarity: 0.95,
  octave: 4,
})

describe('Zen pitch session', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wraps at the right seam, retains the completed take and starts left', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null
    const onRunFinalized = vi.fn()
    const stopMic = vi.fn()

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => {
            listener = () => undefined
          }
        },
        micActive: () => false,
        startMic: async () => true,
        stopMic,
        onRunFinalized,
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(await session!.start()).toBe(true)

    for (const [atMs, midi] of [
      [1_100, 60],
      [1_200, 60.1],
      [1_300, 59.95],
    ] as const) {
      listener({
        atMs,
        beat: 0,
        pitch: pitch(midi),
        micActive: true,
      })
    }
    listener({
      atMs: 9_100,
      beat: 0,
      pitch: pitch(62),
      micActive: true,
    })

    expect(session!.runs()).toHaveLength(1)
    expect(session!.runs()[0]!.takeNumber).toBe(1)
    expect(session!.activePoints()).toHaveLength(1)
    expect(session!.activePoints()[0]!.timeSec).toBeCloseTo(0.1, 3)
    expect(session!.activePoints()[0]!.midi).toBeCloseTo(62, 3)
    expect(session!.takeNumber()).toBe(2)
    expect(onRunFinalized).toHaveBeenCalledTimes(1)

    dispose()
    expect(stopMic).toHaveBeenCalledTimes(1)
  })

  it('stores only one gap marker for a continuous silent interval', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(2_000)
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => undefined
        },
        micActive: () => true,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(await session!.start()).toBe(true)
    listener({
      atMs: 2_100,
      beat: 0,
      pitch: pitch(60),
      micActive: true,
    })
    listener({
      atMs: 2_200,
      beat: 0,
      pitch: null,
      micActive: true,
    })
    listener({
      atMs: 2_300,
      beat: 0,
      pitch: null,
      micActive: true,
    })

    expect(session!.activePoints()).toHaveLength(2)
    expect(session!.activePoints()[1]!.midi).toBeNull()
    dispose()
  })

  it('releases a mic whose permission prompt resolves after unmount', async () => {
    let resolveStart: ((started: boolean) => void) | undefined
    const startMic = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStart = resolve
        }),
    )
    const stopMic = vi.fn()
    let session: ZenPitchSession | null = null

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: () => () => undefined,
        micActive: () => false,
        startMic,
        stopMic,
      })
      return disposeRoot
    })

    const pendingStart = session!.start()
    dispose()
    resolveStart?.(true)

    await expect(pendingStart).resolves.toBe(false)
    expect(stopMic).toHaveBeenCalledTimes(1)
  })

  it('keeps a launch-scoped custom melody available in the exercise picker', () => {
    const custom: ZenExerciseDefinition = {
      id: 'weekly-challenge:custom',
      version: 1,
      title: 'Custom Legend line',
      category: 'scales',
      level: 'developing',
      summary: 'A custom line.',
      goal: 'Follow the notes.',
      instructions: 'Sing with the playhead.',
      bpm: 60,
      countInBeats: 0,
      loopBeats: 4,
      defaultRootMidi: 60,
      targets: [
        {
          id: 'note-1',
          startBeat: 1,
          durationBeats: 1,
          semitone: 0,
          cue: 'C4',
          showCue: true,
        },
      ],
      defaultTargetVisibility: 'on',
      defaultProgressCue: 'playhead',
      scoring: {
        pitchWeight: 0.6,
        coverageWeight: 0.3,
        steadinessWeight: 0.1,
        toleranceCents: 60,
      },
    }
    let session: ZenPitchSession | null = null
    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        initialExerciseDefinition: custom,
        subscribeFrames: () => () => undefined,
        micActive: () => false,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })

    expect(session!.exercise()).toBe(custom)
    session!.selectExercise(null)
    expect(session!.exercise()).toBeNull()
    session!.selectExercise(custom.id)
    expect(session!.exercise()).toBe(custom)
    dispose()
  })
})

describe('removeRun', () => {
  it('drops a finished take and moves selection to a neighbour', () => {
    let session: ZenPitchSession | null = null
    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: () => () => undefined,
        micActive: () => false,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })

    const run = (id: string, takeNumber: number): ZenPitchRun => ({
      id,
      takeNumber,
      completedAt: takeNumber,
      mode: 'monitor',
      durationSec: 8,
      points: [
        { timeSec: 0, midi: 60 },
        { timeSec: 1, midi: 61 },
      ],
      viewport: { minMidi: 48, maxMidi: 72 },
    })
    session!.hydrateRuns([run('r1', 1), run('r2', 2), run('r3', 3)])
    session!.previousRun() // select r3
    session!.previousRun() // select r2
    expect(session!.selectedRunId()).toBe('r2')

    expect(session!.removeRun('r2')).toBe(true)
    // Selection stays useful: the neighbour, not a dead id.
    expect(session!.selectedRunId()).toBe('r3')
    expect(session!.runs().map((r) => r.id)).toEqual(['r1', 'r3'])

    // Removing the rest falls back to live.
    session!.removeRun('r3')
    session!.removeRun('r1')
    expect(session!.selectedRunId()).toBeNull()
    expect(session!.removeRun('missing')).toBe(false)
    dispose()
  })
})

// ============================================================
// The transport state machine — REQ-ZENP-009..012, 024..028, 033..034
// ============================================================
//
// Owner testing on dev found five ways to get the Zen stage into a state it
// could not draw. These pin the state machine end of the fixes; the note
// scheduler's half is in zen-note-playback.test.ts. Spec:
// docs/specs/zen-exercise-playback.ears.md.

describe('Zen transport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mount(): {
    session: ZenPitchSession
    feed: (atMs: number, midi: number) => void
    dispose: () => void
  } {
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null
    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => undefined
        },
        micActive: () => true,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })
    return {
      session: session!,
      feed: (atMs, midi) => {
        listener({ atMs, beat: 0, pitch: pitch(midi), micActive: true })
      },
      dispose,
    }
  }

  /** Three voiced samples — the minimum `finalize` will keep as a take. */
  const sing = (
    feed: (atMs: number, midi: number) => void,
    fromMs: number,
  ): void => {
    feed(fromMs, 60)
    feed(fromMs + 100, 60.2)
    feed(fromMs + 200, 59.8)
  }

  // REQ-ZENP-013's root cause, pinned where it actually lives. The stage used
  // to derive its per-lap dedupe key from `floor(elapsed / loopDuration)`.
  // This is why that could only ever be 0: elapsed is reset at every seam, so
  // it never reaches a full lap, while the lap counter is the only thing that
  // actually distinguishes one pass from the next.
  it('never lets elapsed time distinguish one lap from the next', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, dispose } = mount()
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    const seen: number[] = []
    for (let atMs = 100; atMs <= DEFAULT_LOOP_MS * 2 + 400; atMs += 400) {
      feed(atMs, 60)
      seen.push(session.elapsedSec())
    }

    expect(Math.max(...seen)).toBeLessThan(session.loopDurationSec())
    expect(session.loopsCompleted()).toBe(2)
    dispose()
  })

  // REQ-ZENP-024, REQ-ZENP-025. Selecting a take freezes the canvas on it and
  // drops the playhead, while capture carries on invisibly behind it and each
  // seam appends a take the singer cannot see — "the playhead dissapears and
  // things break".
  it('refuses to move the take selection while running', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, dispose } = mount()
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    sing(feed, 100)
    feed(DEFAULT_LOOP_MS + 100, 60)
    expect(session.runs()).toHaveLength(1)
    expect(session.status()).toBe('running')

    expect(session.previousRun()).toBe(false)
    expect(session.selectedRunId()).toBeNull()
    expect(session.nextRun()).toBe(false)
    expect(session.removeRun(session.runs()[0]!.id)).toBe(false)
    expect(session.runs()).toHaveLength(1)

    // REQ-ZENP-027: going *to* live is where a running session belongs.
    session.followLive()
    expect(session.selectedRunId()).toBeNull()
    dispose()
  })

  // REQ-ZENP-026, REQ-ZENP-028.
  it('allows review while paused and returns to live on resume', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, dispose } = mount()
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    sing(feed, 100)
    feed(DEFAULT_LOOP_MS + 100, 60)
    session.pause()

    expect(session.previousRun()).toBe(true)
    expect(session.selectedRunId()).toBe(session.runs()[0]!.id)

    session.resume()
    expect(session.status()).toBe('running')
    // The playhead only draws on the live take; carrying a selection through
    // a resume is what made it vanish.
    expect(session.selectedRunId()).toBeNull()
    dispose()
  })

  // REQ-ZENP-010, REQ-ZENP-011. The guide button used to read "Restart
  // exercise" while paused and route through start(), which resets the live
  // points without finalizing — the take was binned with no record of it.
  it('restart finalizes the pass in progress instead of binning it', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, dispose } = mount()
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    sing(feed, 100)
    feed(DEFAULT_LOOP_MS + 100, 60)
    expect(session.loopsCompleted()).toBe(1)
    sing(feed, DEFAULT_LOOP_MS + 300)
    session.pause()
    expect(session.runs()).toHaveLength(1)

    expect(await session.restart()).toBe(true)

    expect(session.status()).toBe('running')
    expect(session.runs()).toHaveLength(2)
    expect(session.runs()[1]!.takeNumber).toBe(2)
    expect(session.loopsCompleted()).toBe(0)
    expect(session.selectedRunId()).toBeNull()
    expect(session.activePoints()).toHaveLength(0)
    dispose()
  })

  // REQ-ZENP-012.
  it('restart from stopped is a plain start and keeps no empty take', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, dispose } = mount()
    await Promise.resolve()

    expect(await session.restart()).toBe(true)
    expect(session.status()).toBe('running')
    expect(session.runs()).toHaveLength(0)
    expect(session.takeNumber()).toBe(1)
    dispose()
  })

  // REQ-ZENP-033, REQ-ZENP-034. Adopting a definition under a live pass would
  // score the singer against targets they never saw.
  it('changing exercise stops the pass and resets the lap counter', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, dispose } = mount()
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    sing(feed, 100)
    feed(DEFAULT_LOOP_MS + 100, 60)
    expect(session.loopsCompleted()).toBe(1)

    session.selectExercise(null)

    expect(session.status()).toBe('idle')
    expect(session.loopsCompleted()).toBe(0)
    expect(session.runs()).toHaveLength(0)
    expect(session.takeNumber()).toBe(1)
    expect(session.selectedRunId()).toBeNull()
    dispose()
  })
})

// ============================================================
// The step boundary
// ============================================================
//
// The Zen stage was built to loop until told to stop. A guided warm-up is the
// opposite shape: one authored exercise per step, run a fixed number of times,
// then control back to whatever is sequencing the steps. `loopLimit` is that
// difference, and these pin the two halves of it — that it stops on its own,
// and that stopping does not touch the mic, which the sequencer owns across
// the boundary.

describe('loopLimit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** A one-loop session with a mic it did not open. */
  function mountBounded(loopLimit: number): {
    session: ZenPitchSession
    feed: (atMs: number, midi: number) => void
    onLoopLimitReached: ReturnType<typeof vi.fn>
    stopMic: ReturnType<typeof vi.fn>
    dispose: () => void
  } {
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null
    const onLoopLimitReached = vi.fn()
    const stopMic = vi.fn()

    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => undefined
        },
        // Already open: a warm-up step inherits the mic rather than asking.
        micActive: () => true,
        startMic: async () => true,
        stopMic,
        loopLimit,
        onLoopLimitReached,
      })
      return disposeRoot
    })

    return {
      session: session!,
      feed: (atMs, midi) => {
        listener({ atMs, beat: 0, pitch: pitch(midi), micActive: true })
      },
      onLoopLimitReached,
      stopMic,
      dispose,
    }
  }

  it('stops itself at the limit and hands control back', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, onLoopLimitReached, stopMic, dispose } =
      mountBounded(1)
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    feed(100, 60)
    feed(200, 60.1)
    feed(300, 59.9)
    expect(session.status()).toBe('running')

    // Past the loop's end: the run finalizes and the session stands down.
    feed(DEFAULT_LOOP_MS + 100, 62)

    expect(session.status()).toBe('idle')
    expect(session.loopsCompleted()).toBe(1)
    expect(session.runs()).toHaveLength(1)
    expect(onLoopLimitReached).toHaveBeenCalledTimes(1)
    // The sequencer owns the mic across the boundary; closing it here is the
    // reopen cost holding it across segments was meant to remove.
    expect(stopMic).not.toHaveBeenCalled()

    // And it stays stopped — a late frame must not start loop two.
    feed(DEFAULT_LOOP_MS * 2 + 200, 62)
    expect(session.runs()).toHaveLength(1)
    dispose()
  })

  it('runs the whole count before stopping', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { session, feed, onLoopLimitReached, dispose } = mountBounded(2)
    await Promise.resolve()
    expect(await session.start()).toBe(true)

    feed(100, 60)
    feed(DEFAULT_LOOP_MS + 100, 60)
    expect(session.status()).toBe('running')
    expect(session.loopsCompleted()).toBe(1)
    expect(onLoopLimitReached).not.toHaveBeenCalled()

    feed(DEFAULT_LOOP_MS * 2 + 100, 60)
    expect(session.status()).toBe('idle')
    expect(session.loopsCompleted()).toBe(2)
    expect(onLoopLimitReached).toHaveBeenCalledTimes(1)
    dispose()
  })

  // Without a limit the stage behaves exactly as it did: this is the Zen tab,
  // where the loop ending is not an event, it is the point.
  it('loops forever when no limit is set', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0)
    let listener: (frame: PracticeFrame) => void = () => undefined
    let session: ZenPitchSession | null = null
    const dispose = createRoot((disposeRoot) => {
      session = useZenPitchSession({
        subscribeFrames: (next) => {
          listener = next
          return () => undefined
        },
        micActive: () => true,
        startMic: async () => true,
        stopMic: () => undefined,
      })
      return disposeRoot
    })
    await Promise.resolve()
    expect(await session!.start()).toBe(true)

    listener({ atMs: 100, beat: 0, pitch: pitch(60), micActive: true })
    listener({
      atMs: DEFAULT_LOOP_MS + 100,
      beat: 0,
      pitch: pitch(60),
      micActive: true,
    })
    listener({
      atMs: DEFAULT_LOOP_MS * 2 + 100,
      beat: 0,
      pitch: pitch(60),
      micActive: true,
    })

    expect(session!.status()).toBe('running')
    expect(session!.loopsCompleted()).toBe(2)
    dispose()
  })
})
