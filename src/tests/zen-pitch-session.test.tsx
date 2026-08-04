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
