// Live-score controller tests pin room boundaries without involving Jam Doctor.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
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
    },
  }
}

describe('useGuitarNightLiveScoreController', () => {
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
      })

      expect(controller.state()).toBe('ready')
      expect(await controller.start({ start: 0, end: 4 })).toBe(true)
      expect(startRoom).toHaveBeenCalledWith(
        { start: 0, end: 4 },
        { audibleGuide: false },
      )
      expect(armTakeAt).toHaveBeenCalledWith(10)
      expect(completeTakeAt).toHaveBeenCalledWith(14)

      setRoomStatus('playing')
      setCurrentTake(take([attack(0), attack(1), attack(2)]))
      setPlayheadBeat(2.2)
      await Promise.resolve()
      expect(controller.state()).toBe('warming')
      expect(controller.grade()).toBeNull()

      setCurrentTake(take([attack(0), attack(1), attack(2), attack(3)]))
      setPlayheadBeat(3.25)
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

      setCurrentTake(take([attack(0), attack(1), attack(2)], 'completed'))
      setPlayheadBeat(4)
      await Promise.resolve()
      expect(controller.score()).toBe(100)
      expect(controller.state()).toBe('paused')
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
      })

      await controller.start({ start: 0, end: 4 })
      const earned = [attack(0), attack(1), attack(2), attack(3)]
      setCurrentTake(take(earned))
      setPlayheadBeat(3.25)
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
