// Calibration owns the room clock until its click run is cancelled or complete.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarNightRoom } from './GuitarNightRoom'
import { GuitarNightScoreRoom } from './GuitarNightScoreRoom'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease } from './song-port'
import type { GuitarNightScoreAssessmentBoundary } from './useGuitarNightScoreRoomController'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'calibrating'),
  error: vi.fn(() => null),
  notice: vi.fn<() => string | null>(() => null),
  currentNote: vi.fn(() => null),
  detectedMidi: vi.fn(() => null),
  clarity: vi.fn(() => 0),
  take: vi.fn<() => GuitarTakeSnapshot | null>(() => null),
  events: vi.fn(() => []),
  observations: vi.fn(() => []),
  timingSource: vi.fn(() => 'audio-clock'),
  latencyMs: vi.fn(() => 0),
  health: vi.fn(() => null),
  canTakeOverInput: vi.fn(() => false),
  inputTakeoverPending: vi.fn(() => false),
  inputProfile: vi.fn(() => 'microphone'),
  inputProfileLabel: vi.fn(() => 'Room mic'),
  audioInputs: vi.fn(() => []),
  selectedAudioInputId: vi.fn(() => null),
  midiInputs: vi.fn(() => []),
  selectedMidiInputId: vi.fn(() => null),
  midiConnectionStatus: vi.fn(() => 'idle'),
  evidenceExportEnabled: vi.fn(() => false),
  canExportEvidence: vi.fn(() => false),
  start: vi.fn(async () => true),
  stop: vi.fn(),
  cancel: vi.fn(),
  armTakeAt: vi.fn(() => false),
  completeTakeAt: vi.fn(() => false),
  calibrate: vi.fn(async () => false),
  clearTake: vi.fn(),
  useInputHere: vi.fn(async () => true),
  selectInputProfile: vi.fn(async () => undefined),
  selectAudioInput: vi.fn(async () => undefined),
  selectMidiInput: vi.fn(async () => undefined),
  refreshAudioInputs: vi.fn(async () => undefined),
  refreshMidiInputs: vi.fn(async () => false),
  exportEvidenceReport: vi.fn(() => false),
}))

const scoreRoom = vi.hoisted(() => ({
  status: vi.fn(() => 'quiet'),
  setupLocked: vi.fn(() => false),
  countInRemaining: vi.fn(() => 0),
  positionSeconds: vi.fn(() => 0),
  displayPositionSeconds: vi.fn(() => 0),
  durationSeconds: vi.fn(() => 1),
  durationBeats: vi.fn(() => 1),
  playheadBeat: vi.fn(() => null),
  tempoBpm: vi.fn(() => 90),
  countInBeats: vi.fn(() => 4),
  hearScore: vi.fn(() => true),
  displayReference: vi.fn(() => REFERENCE),
  runningLoop: vi.fn(() => null),
  error: vi.fn(() => null),
  activateAudio: vi.fn(async () => true),
  getAudioGraph: vi.fn(() => null),
  toggle: vi.fn(),
  stop: vi.fn(),
  setTempoBpm: vi.fn(),
  setCountInBeats: vi.fn(),
  setHearScore: vi.fn(),
  startAssessment: vi.fn<
    (range: {
      start: number
      end: number
    }) => Promise<GuitarNightScoreAssessmentBoundary | null>
  >(async () => null),
}))

vi.mock('./useGuitarListeningController', () => ({
  useGuitarListeningController: () => listening,
}))

vi.mock('@/features/guitar/ui/Guitar3DStage', () => ({
  Guitar3DStage: () => <div role="img" aria-label="Guitar stage" />,
}))

vi.mock('./useGuitarNightScoreRoomController', () => ({
  SCORE_ROOM_MIN_TEMPO: 40,
  SCORE_ROOM_MAX_TEMPO: 220,
  useGuitarNightScoreRoomController: () => scoreRoom,
}))

const REFERENCE: GuitarNightReference = {
  kind: 'authored',
  songId: 'score-1',
  title: 'Calibration Riff',
  trackId: 'lead',
  trackName: 'Lead guitar',
  tempoBpm: 90,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'lead', name: 'Lead guitar', noteCount: 1 }],
  notes: [
    {
      id: 'note-1',
      midi: 64,
      noteName: 'E4',
      stringIndex: 0,
      fret: 0,
      startBeat: 0,
      duration: 1,
      targetFreq: 329.63,
    },
  ],
}

const BACKING: GuitarNightBackingLease = {
  sessionId: 'session-1',
  title: 'Calibration Band',
  stems: [
    {
      kind: 'instrumental',
      url: 'blob:instrumental',
      sizeBytes: 1024,
      durationSeconds: 60,
    },
  ],
  defaultMix: {
    kind: 'mixed-instrumental',
    audible: ['instrumental'],
    muted: [],
  },
  release: vi.fn(),
}

const REVIEW_REFERENCE: GuitarNightReference = {
  ...REFERENCE,
  title: 'Timing Study',
  notes: Array.from({ length: 4 }, (_, index) => ({
    ...REFERENCE.notes[0]!,
    id: `review-note-${index}`,
    startBeat: index,
  })),
}

function completedReviewTake(
  lifecycle: GuitarTakeSnapshot['lifecycle'],
): GuitarTakeSnapshot {
  const sampleRate = 1_000
  return {
    id: 'review-take',
    lifecycle,
    input: {
      kind: 'microphone',
      requestedDeviceId: null,
      activeDeviceId: 'room-mic',
      activeDeviceLabel: 'Room microphone',
    },
    clock: {
      startedAtFrame: 10_000,
      sampleRate,
      attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
      latency: {
        seconds: 0,
        frames: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    },
    events: Array.from({ length: 4 }, (_, index) => ({
      id: `review-event-${index}`,
      kind: 'attack' as const,
      source: 'microphone' as const,
      voiceId: null,
      at: 10 + index,
      capturedAt: 10 + index,
      rawTransportFrame: index * sampleRate,
      compensatedTransportFrame: index * sampleRate,
      level: 0.2,
      clock: {
        kind: 'audio-worklet' as const,
        atFrame: (10 + index) * sampleRate,
        sampleRate,
      },
      pitch: {
        midi: 64,
        noteName: 'E4',
        cents: 0,
        clarity: 0.9,
      },
    })),
    durationFrames: lifecycle === 'completed' ? 4_000 : null,
    filteredBeforeStart: 0,
    filteredAfterEnd: 0,
    truncated: false,
    droppedEventCount: 0,
    inputHealth: {
      readings: 4,
      states: {
        silent: 0,
        quiet: 0,
        good: 4,
        hot: 0,
        clipping: 0,
        noisy: 0,
        uncertain: 0,
      },
    },
  }
}

function createTransport(): GuitarBackingTransportController {
  return {
    status: () => 'armed',
    loadMode: () => null,
    positionSeconds: () => 0,
    durationSeconds: () => 60,
    playbackRate: () => 1,
    masterVolume: () => 0.78,
    tracks: () => [],
    error: () => null,
    configure: vi.fn(),
    activate: vi.fn(async () => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(async () => true),
    setMasterVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    getAudioGraph: vi.fn(() => null),
  }
}

describe('Guitar Night calibration lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listening.status.mockReturnValue('calibrating')
    listening.notice.mockReturnValue(null)
    listening.take.mockReturnValue(null)
    listening.armTakeAt.mockReturnValue(false)
    listening.completeTakeAt.mockReturnValue(false)
    listening.calibrate.mockResolvedValue(false)
    scoreRoom.status.mockReturnValue('quiet')
    scoreRoom.startAssessment.mockResolvedValue(null)
  })

  afterEach(cleanup)

  it('keeps Listening active and blocks backing transport', () => {
    const transport = createTransport()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const listeningButton = screen.getByRole('button', {
      name: 'Stop calibration',
    })
    expect(listeningButton.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(listeningButton)
    expect(listening.stop).toHaveBeenCalledOnce()
    expect(
      (screen.getByLabelText('Play backing') as HTMLButtonElement).disabled,
    ).toBe(true)

    fireEvent.keyDown(window, { code: 'Space' })
    expect(transport.play).not.toHaveBeenCalled()
  })

  it('keeps Listening active and blocks the score clock', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    const listeningButton = screen.getByRole('button', {
      name: 'Stop calibration',
    })
    expect(listeningButton.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(listeningButton)
    expect(listening.stop).toHaveBeenCalledOnce()
    expect(
      (screen.getByLabelText('Start the count-in') as HTMLButtonElement)
        .disabled,
    ).toBe(true)

    fireEvent.keyDown(window, { code: 'Space' })
    expect(scoreRoom.toggle).not.toHaveBeenCalled()
  })

  it('silences a completed score take before opening Listening', () => {
    listening.status.mockReturnValue('off')
    scoreRoom.status.mockReturnValue('complete')
    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Turn on Listening' }))

    expect(scoreRoom.stop).toHaveBeenCalledOnce()
    expect(listening.start).toHaveBeenCalledOnce()
    expect(
      scoreRoom.stop.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(
      listening.start.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
  })

  it('leaves Doctor recovery Space untouched and reopens after a failed calibration', async () => {
    const recording = completedReviewTake('recording')
    const completed = completedReviewTake('completed')
    listening.status.mockReturnValue('listening')
    listening.armTakeAt.mockImplementation(() => {
      listening.take.mockReturnValue(recording)
      return true
    })
    listening.completeTakeAt.mockImplementation(() => {
      listening.take.mockReturnValue(completed)
      return true
    })
    scoreRoom.startAssessment.mockResolvedValue({
      id: 'review-boundary',
      reference: REVIEW_REFERENCE,
      range: { start: 0, end: 4 },
      tempoBpm: 90,
      scoreTempoBpm: 90,
      countInBeats: 4,
      sampleRate: 1_000,
      startedAtSeconds: 10,
      completedAtSeconds: 14,
      beatToSeconds: (beat: number) => beat,
    })
    listening.calibrate.mockImplementation(async () => {
      listening.notice.mockReturnValue(
        'Timing calibration could not hear the return clicks.',
      )
      return false
    })

    render(() => (
      <GuitarNightScoreRoom
        reference={() => REVIEW_REFERENCE}
        onSongs={vi.fn()}
      />
    ))

    const sessionSummary = screen.getByLabelText('Listening is on')
    fireEvent.click(sessionSummary)
    fireEvent.click(
      screen.getByRole('button', { name: 'Review beat 1 for 4 beats' }),
    )
    const reviewCue = await screen.findByRole('button', {
      name: 'Review Beat 1 · 4 beats · 90 BPM: The pulse stayed together.',
    })
    fireEvent.click(reviewCue)
    const doctor = await screen.findByRole('dialog')
    const recovery = within(doctor).getByRole('button', {
      name: 'Calibrate timing',
    })
    const space = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    recovery.dispatchEvent(space)

    expect(space.defaultPrevented).toBe(false)
    expect(scoreRoom.toggle).not.toHaveBeenCalled()

    fireEvent.click(recovery)

    const failure = await screen.findByText(
      'Timing calibration could not hear the return clicks.',
    )
    expect(failure).toBeVisible()
    expect(failure).toHaveAttribute('role', 'status')
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(listening.calibrate).toHaveBeenCalledOnce()
    expect(listening.cancel).toHaveBeenCalledWith({ preserveNotice: true })
    expect(sessionSummary.closest('details')).not.toHaveAttribute('open')
  })
})
