// Live-score controller tests pin room boundaries without involving Jam Doctor.
// ============================================================

import { createEffect, createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeGuitarScoreTake } from '@/lib/guitar/guitar-score-history'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from '@/lib/guitar/guitar-take-recorder'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { GuitarNightReference } from './reference-port'
import type { GuitarListeningStatus } from './useGuitarListeningController'
import { liveGradeWithHysteresis, useGuitarNightLiveScoreController, } from './useGuitarNightLiveScoreController'
import type { GuitarNightScoreRoomStatus } from './useGuitarNightScoreRoomController'

const SAMPLE_RATE = 1_000
const REFERENCE: GuitarNightReference = {
  kind: 'authored',
  songId: 'score-1',
  title: 'Four notes',
  trackId: 'lead',
  trackName: 'Lead',
  tempoBpm: 60,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'lead', name: 'Lead', noteCount: 4 }],
  notes: [0, 1, 2, 3].map((startBeat, index) => ({
    id: `note-${index}`,
    midi: 60 + index,
    noteName: `note ${index}`,
    stringIndex: 0,
    fret: index,
    startBeat,
    duration: 0.5,
    targetFreq: 261.63,
  })),
}
const END_BOUNDARY_REFERENCE: GuitarNightReference = {
  ...REFERENCE,
  title: 'Boundary notes',
  tracks: [{ id: 'lead', name: 'Lead', noteCount: 5 }],
  notes: [
    ...REFERENCE.notes,
    {
      id: 'note-end',
      midi: 64,
      noteName: 'note end',
      stringIndex: 0,
      fret: 4,
      startBeat: 3.9,
      duration: 0.1,
      targetFreq: 329.63,
    },
  ],
}

function attack(index: number): GuitarTakeEvent {
  const frame = index * SAMPLE_RATE
  return {
    id: `event-${index}`,
    kind: 'attack',
    source: 'microphone',
    voiceId: null,
    at: 10 + index,
    capturedAt: 10 + index,
    rawTransportFrame: frame,
    compensatedTransportFrame: frame,
    level: 0.4,
    clock: {
      kind: 'audio-worklet',
      atFrame: 10_000 + frame,
      sampleRate: SAMPLE_RATE,
    },
    pitch: {
      midi: 60 + index,
      noteName: `note ${index}`,
      cents: 0,
      clarity: 0.95,
    },
  }
}

function take(
  events: readonly GuitarTakeEvent[],
  lifecycle: GuitarTakeSnapshot['lifecycle'] = 'recording',
  completedDurationFrames = 4_000,
  health: Partial<GuitarTakeSnapshot['inputHealth']> = {},
): GuitarTakeSnapshot {
  return {
    id: 'take-1',
    lifecycle,
    input: {
      kind: 'microphone',
      requestedDeviceId: null,
      activeDeviceId: 'mic-1',
      activeDeviceLabel: 'Test mic',
    },
    clock: {
      startedAtFrame: 10_000,
      sampleRate: SAMPLE_RATE,
      attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
      latency: {
        seconds: 0,
        frames: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    },
    events,
    durationFrames: lifecycle === 'recording' ? null : completedDurationFrames,
    filteredBeforeStart: 0,
    filteredAfterEnd: 0,
    rejectedAfterEnd: 0,
    retractedAfterEnd: 0,
    truncated: false,
    droppedEventCount: 0,
    inputHealth: {
      readings: 1,
      states: {
        silent: 0,
        quiet: 0,
        good: 1,
        hot: 0,
        clipping: 0,
        noisy: 0,
        uncertain: 0,
      },
      ...health,
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('useGuitarNightLiveScoreController', () => {
  it('keeps scoring after one clipped level reading in an otherwise clean take', async () => {
    // Regression: the health counters accumulate for the whole take, so a
    // `clipping > 0` test made one transient peak skip every remaining target
    // for the rest of the run — the take stopped scoring halfway through and
    // reported that it could not prove the notes.
    await createRoot(async (dispose) => {
      const [listeningStatus] = createSignal<GuitarListeningStatus>('listening')
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const clipped = {
        readings: 200,
        states: {
          silent: 0,
          quiet: 0,
          good: 199,
          hot: 0,
          clipping: 1,
          noisy: 0,
          uncertain: 0,
        },
      }
      const controller = useGuitarNightLiveScoreController({
        listeningStatus,
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus: () => 'playing',
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () => ({
          id: 'live-clip',
          reference: REFERENCE,
          range: { start: 0, end: 4 },
          tempoBpm: 60,
          scoreTempoBpm: 60,
          countInBeats: 0,
          sampleRate: SAMPLE_RATE,
          startedAtSeconds: 10,
          completedAtSeconds: 14,
          beatToSeconds: (beat: number) => beat,
        }),
        stopRoom: vi.fn(),
        pauseRoom: vi.fn(),
        stopInput: vi.fn(),
        armTakeAt: () => {
          setCurrentTake(take([], 'recording', 4_000, clipped))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow: () => false,
      })

      expect(await controller.start({ start: 0, end: 4 })).toBe(true)
      setCurrentTake(
        take(
          [attack(0), attack(1), attack(2), attack(3)],
          'recording',
          4_000,
          clipped,
        ),
      )
      setPlayheadBeat(3.4)
      await Promise.resolve()

      expect(controller.display()?.totals).toMatchObject({
        judgedTargets: 4,
        hitTargets: 4,
        skippedTargets: 0,
      })
      dispose()
    })
  })

  it('moves from explicit Listening through warming, active, and complete', async () => {
    await createRoot(async (dispose) => {
      const [listeningStatus] = createSignal<GuitarListeningStatus>('listening')
      const [roomStatus, setRoomStatus] =
        createSignal<GuitarNightScoreRoomStatus>('quiet')
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const startRoom = vi.fn(async () => ({
        id: 'live-1',
        reference: REFERENCE,
        range: { start: 0, end: 4 },
        tempoBpm: 60,
        scoreTempoBpm: 60,
        countInBeats: 4,
        sampleRate: SAMPLE_RATE,
        startedAtSeconds: 10,
        completedAtSeconds: 14,
        beatToSeconds: (beat: number) => beat,
      }))
      const armTakeAt = vi.fn(() => {
        setCurrentTake(take([]))
        return true
      })
      const completeTakeAt = vi.fn(() => true)
      const controller = useGuitarNightLiveScoreController({
        listeningStatus,
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus,
        countInRemaining: () => 4,
        playheadBeat,
        startRoom,
        stopRoom: vi.fn(),
        pauseRoom: vi.fn(),
        stopInput: vi.fn(),
        armTakeAt,
        completeTakeAt,
        completeTakeNow: () => false,
      })
      let observedCaptureActive = false
      createEffect(() => {
        observedCaptureActive = controller.captureActive()
      })

      expect(controller.state()).toBe('ready')
      expect(observedCaptureActive).toBe(false)
      expect(await controller.start({ start: 0, end: 4 })).toBe(true)
      expect(startRoom).toHaveBeenCalledWith({ start: 0, end: 4 })
      expect(armTakeAt).toHaveBeenCalledWith(10)
      expect(completeTakeAt).toHaveBeenCalledWith(14)
      expect(controller.boundary()?.id).toBe('live-1')
      expect(observedCaptureActive).toBe(true)
      expect(controller.display()?.phase).toBe('active')
      expect(controller.inputKind()).toBe('microphone')
      expect(controller.startedAt()).toEqual(expect.any(Number))

      setRoomStatus('playing')
      setCurrentTake(take([attack(0), attack(1), attack(2)]))
      setPlayheadBeat(2.2)
      await Promise.resolve()
      expect(controller.state()).toBe('warming')
      expect(controller.grade()).toBeNull()

      setCurrentTake(take([attack(0), attack(1), attack(2), attack(3)]))
      setPlayheadBeat(3.4)
      await Promise.resolve()
      expect(controller.state()).toBe('active')
      expect(controller.score()).toBe(100)
      expect(controller.grade()).toBe('S')

      setCurrentTake(
        take([attack(0), attack(1), attack(2), attack(3)], 'completed'),
      )
      setRoomStatus('complete')
      await Promise.resolve()
      expect(controller.state()).toBe('complete')
      expect(controller.score()).toBe(100)
      expect(controller.grade()).toBe('S')
      expect(controller.announcement()).toBe(
        'Take complete, live score 100 out of 100, grade S',
      )
      dispose()
    })
  })

  it('retains the earned result when a take is held', async () => {
    await createRoot(async (dispose) => {
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const controller = useGuitarNightLiveScoreController({
        listeningStatus: () => 'listening',
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus: () => 'playing',
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () => ({
          id: 'live-1',
          reference: REFERENCE,
          range: { start: 0, end: 4 },
          tempoBpm: 60,
          scoreTempoBpm: 60,
          countInBeats: 4,
          sampleRate: SAMPLE_RATE,
          startedAtSeconds: 10,
          completedAtSeconds: 14,
          beatToSeconds: (beat) => beat,
        }),
        stopRoom: vi.fn(),
        pauseRoom: vi.fn(),
        stopInput: vi.fn(),
        armTakeAt: () => {
          setCurrentTake(take([]))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow: () => false,
      })

      await controller.start({ start: 0, end: 4 })
      setCurrentTake(take([attack(0), attack(1), attack(2)]))
      setPlayheadBeat(3.1)
      await Promise.resolve()
      expect(controller.score()).toBe(100)
      expect(controller.grade()).toBeNull()

      controller.hold()
      expect(controller.state()).toBe('paused')
      expect(controller.captureActive()).toBe(false)
      expect(controller.score()).toBe(100)
      expect(controller.display()).toMatchObject({
        phase: 'active',
        basis: 'rolling-16',
      })
      expect(
        summarizeGuitarScoreTake(
          controller.display()!,
          {
            pieceLabel: REFERENCE.title,
            trackLabel: REFERENCE.trackName,
            range: { startBeat: 0, endBeat: 4 },
            inputKind: 'microphone',
            status: 'partial',
          },
          10,
        ),
      ).not.toBeNull()

      setCurrentTake(take([attack(0), attack(1), attack(2)], 'completed'))
      setPlayheadBeat(4)
      await Promise.resolve()
      expect(controller.score()).toBe(100)
      expect(controller.state()).toBe('paused')

      expect(controller.finish()).toBe(true)
      expect(controller.state()).toBe('complete')
      expect(controller.display()).toMatchObject({
        phase: 'completed',
        basis: 'cumulative',
        score: 75,
      })
      expect(
        summarizeGuitarScoreTake(
          controller.display()!,
          {
            pieceLabel: REFERENCE.title,
            trackLabel: REFERENCE.trackName,
            range: { startBeat: 0, endBeat: 4 },
            inputKind: 'microphone',
            status: 'completed',
          },
          10,
        ),
      ).toMatchObject({ status: 'completed', basis: 'cumulative', score: 75 })
      dispose()
    })
  })

  it('settles an explicitly stopped take without judging post-End evidence', async () => {
    vi.useFakeTimers()
    await createRoot(async (dispose) => {
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const stopInput = vi.fn()
      const completeTakeNow = vi.fn(() => {
        // pinEnd publishes before completion, and a rejected attack may update
        // recorder diagnostics while the transport advances in the same turn.
        setCurrentTake((snapshot) =>
          snapshot === null
            ? null
            : {
                ...snapshot,
                filteredAfterEnd: 1,
                rejectedAfterEnd: 1,
              },
        )
        setPlayheadBeat(4)
        window.setTimeout(() => {
          setCurrentTake((snapshot) =>
            snapshot === null
              ? null
              : {
                  ...snapshot,
                  lifecycle: 'completed',
                  durationFrames: 3_250,
                },
          )
        }, 120)
        return true
      })
      const controller = useGuitarNightLiveScoreController({
        listeningStatus: () => 'listening',
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus: () => 'playing',
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () => ({
          id: 'live-stopped',
          reference: END_BOUNDARY_REFERENCE,
          range: { start: 0, end: 4 },
          tempoBpm: 60,
          scoreTempoBpm: 60,
          countInBeats: 0,
          sampleRate: SAMPLE_RATE,
          startedAtSeconds: 10,
          completedAtSeconds: 14,
          beatToSeconds: (beat) => beat,
        }),
        stopRoom: vi.fn(),
        pauseRoom: vi.fn(),
        stopInput,
        armTakeAt: () => {
          setCurrentTake(take([]))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow,
      })

      expect(await controller.start({ start: 0, end: 4 })).toBe(true)
      setCurrentTake(take([attack(0), attack(1), attack(2), attack(3)]))
      setPlayheadBeat(3.4)
      await Promise.resolve()
      expect(controller.display()).toMatchObject({
        phase: 'active',
        basis: 'rolling-16',
        score: 100,
      })

      expect(controller.finish()).toBe(true)

      expect(completeTakeNow).toHaveBeenCalledOnce()
      expect(stopInput).not.toHaveBeenCalled()
      expect(controller.finishing()).toBe(true)
      expect(controller.captureActive()).toBe(true)
      expect(controller.display()?.phase).toBe('active')
      expect(controller.display()).toMatchObject({
        targetCount: 5,
        totals: { judgedTargets: 4, hitTargets: 4 },
      })
      await vi.advanceTimersByTimeAsync(120)

      expect(controller.finishing()).toBe(false)
      expect(controller.captureActive()).toBe(false)
      expect(controller.state()).toBe('complete')
      expect(controller.display()).toMatchObject({
        phase: 'completed',
        basis: 'cumulative',
        score: 100,
        grade: 'S',
        evidenceStatus: 'complete',
        targetCount: 5,
        totals: {
          judgedTargets: 4,
          hitTargets: 4,
          missedTargets: 0,
          skippedTargets: 0,
          points: 400,
          possiblePoints: 400,
        },
      })
      expect(
        summarizeGuitarScoreTake(
          controller.display()!,
          {
            pieceLabel: END_BOUNDARY_REFERENCE.title,
            trackLabel: END_BOUNDARY_REFERENCE.trackName,
            range: { startBeat: 0, endBeat: 4 },
            inputKind: 'microphone',
            status: 'completed',
          },
          10,
        ),
      ).not.toBeNull()
      expect(controller.announcement()).toBe(
        'Take complete, live score 100 out of 100, grade S',
      )
      dispose()
    })
  })

  it('keeps a held result when a replacement run cannot be admitted', async () => {
    await createRoot(async (dispose) => {
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      let admitRun = true
      const controller = useGuitarNightLiveScoreController({
        listeningStatus: () => 'listening',
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus: () => 'playing',
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () =>
          admitRun
            ? {
                id: 'live-retained',
                reference: REFERENCE,
                range: { start: 0, end: 4 },
                tempoBpm: 60,
                scoreTempoBpm: 60,
                countInBeats: 0,
                sampleRate: SAMPLE_RATE,
                startedAtSeconds: 10,
                completedAtSeconds: 14,
                beatToSeconds: (beat) => beat,
              }
            : null,
        stopRoom: vi.fn(),
        pauseRoom: vi.fn(),
        stopInput: vi.fn(),
        armTakeAt: () => {
          setCurrentTake(take([]))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow: () => false,
      })

      expect(await controller.start({ start: 0, end: 4 })).toBe(true)
      setCurrentTake(take([attack(0), attack(1), attack(2)]))
      setPlayheadBeat(3.1)
      await Promise.resolve()
      controller.hold()

      const retainedBoundary = controller.boundary()
      const retainedDisplay = controller.display()
      admitRun = false

      expect(await controller.start({ start: 0, end: 4 })).toBe(false)
      expect(controller.boundary()).toBe(retainedBoundary)
      expect(controller.display()).toBe(retainedDisplay)
      expect(controller.state()).toBe('paused')
      expect(controller.score()).toBe(100)
      dispose()
    })
  })

  it('holds the score and pauses the room when the input disconnects', async () => {
    await createRoot(async (dispose) => {
      const [listeningStatus, setListeningStatus] =
        createSignal<GuitarListeningStatus>('listening')
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const [roomStatus] = createSignal<GuitarNightScoreRoomStatus>('playing')
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const pauseRoom = vi.fn()
      const controller = useGuitarNightLiveScoreController({
        listeningStatus,
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus,
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () => ({
          id: 'live-1',
          reference: REFERENCE,
          range: { start: 0, end: 4 },
          tempoBpm: 60,
          scoreTempoBpm: 60,
          countInBeats: 4,
          sampleRate: SAMPLE_RATE,
          startedAtSeconds: 10,
          completedAtSeconds: 14,
          beatToSeconds: (beat) => beat,
        }),
        stopRoom: vi.fn(),
        pauseRoom,
        stopInput: vi.fn(),
        armTakeAt: () => {
          setCurrentTake(take([]))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow: () => false,
      })

      await controller.start({ start: 0, end: 4 })
      setCurrentTake(take([attack(0), attack(1), attack(2)]))
      setPlayheadBeat(3.1)
      await Promise.resolve()
      expect(controller.score()).toBe(100)

      // The production listener publishes its completed recorder snapshot
      // before it reports the device error. That partial take must not be
      // mistaken for an ordinary end-of-room completion.
      setCurrentTake(take([attack(0), attack(1), attack(2)], 'completed'))
      await Promise.resolve()
      expect(controller.state()).toBe('warming')
      expect(controller.score()).toBe(100)

      setListeningStatus('error')
      await Promise.resolve()

      expect(controller.state()).toBe('paused')
      expect(controller.detail()).toBe('Input disconnected')
      expect(controller.captureActive()).toBe(false)
      expect(controller.score()).toBe(100)
      expect(controller.grade()).toBeNull()
      expect(pauseRoom).toHaveBeenCalledOnce()
      dispose()
    })
  })

  it('excludes post-boundary evidence when input drops during pitch settle', async () => {
    await createRoot(async (dispose) => {
      const [listeningStatus, setListeningStatus] =
        createSignal<GuitarListeningStatus>('listening')
      const [currentTake, setCurrentTake] =
        createSignal<GuitarTakeSnapshot | null>(null)
      const [roomStatus, setRoomStatus] =
        createSignal<GuitarNightScoreRoomStatus>('playing')
      const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
      const pauseRoom = vi.fn()
      const controller = useGuitarNightLiveScoreController({
        listeningStatus,
        inputKind: () => 'microphone',
        take: currentTake,
        health: () => ({ state: 'good', hint: 'Good' }),
        roomStatus,
        countInRemaining: () => 0,
        playheadBeat,
        startRoom: async () => ({
          id: 'live-boundary',
          reference: END_BOUNDARY_REFERENCE,
          range: { start: 0, end: 4 },
          tempoBpm: 60,
          scoreTempoBpm: 60,
          countInBeats: 0,
          sampleRate: SAMPLE_RATE,
          startedAtSeconds: 10,
          completedAtSeconds: 14,
          beatToSeconds: (beat) => beat,
        }),
        stopRoom: vi.fn(),
        pauseRoom,
        stopInput: vi.fn(),
        armTakeAt: () => {
          setCurrentTake(take([]))
          return true
        },
        completeTakeAt: () => true,
        completeTakeNow: () => false,
      })

      await controller.start({ start: 0, end: 4 })
      const earned = [attack(0), attack(1), attack(2), attack(3)]
      setCurrentTake(take(earned))
      setPlayheadBeat(3.4)
      await Promise.resolve()
      expect(controller.score()).toBe(100)
      expect(controller.grade()).toBe('S')

      const afterEnd = {
        ...attack(4),
        id: 'event-after-end',
        at: 14.05,
        capturedAt: 14.05,
        rawTransportFrame: 4_050,
        compensatedTransportFrame: 4_050,
        clock: {
          kind: 'audio-worklet' as const,
          atFrame: 14_050,
          sampleRate: SAMPLE_RATE,
        },
      }
      setRoomStatus('complete')
      setPlayheadBeat(4)
      setCurrentTake(take([...earned, afterEnd], 'completed', 4_150))
      await Promise.resolve()

      expect(controller.state()).toBe('complete')
      expect(controller.score()).toBe(80)
      expect(controller.grade()).toBe('B')

      setListeningStatus('error')
      await Promise.resolve()
      expect(controller.state()).toBe('paused')
      expect(controller.detail()).toBe('Input disconnected')
      expect(controller.score()).toBe(80)
      expect(controller.grade()).toBe('B')
      expect(pauseRoom).toHaveBeenCalledOnce()
      dispose()
    })
  })
})

describe('liveGradeWithHysteresis', () => {
  it('holds a letter inside a two-point threshold band', () => {
    expect(liveGradeWithHysteresis(84, 'B', 'A')).toBe('A')
    expect(liveGradeWithHysteresis(82, 'B', 'A')).toBe('B')
    expect(liveGradeWithHysteresis(86, 'A', 'B')).toBe('B')
    expect(liveGradeWithHysteresis(87, 'A', 'B')).toBe('A')
  })
})
