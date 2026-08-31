// Calibration owns the room clock until its click run is cancelled or complete.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarNightRoom } from './GuitarNightRoom'
import { GuitarNightScoreRoom } from './GuitarNightScoreRoom'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease } from './song-port'
import type { GuitarNightScoreAssessmentBoundary, GuitarNightScoreLiveBoundary, } from './useGuitarNightScoreRoomController'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'calibrating'),
  error: vi.fn(() => null),
  notice: vi.fn<() => string | null>(() => null),
  currentNote: vi.fn(() => null),
  detectedMidi: vi.fn(() => null),
  detectedFrequency: vi.fn(() => null),
  detectedCents: vi.fn(() => null),
  pitchRevision: vi.fn(() => 0),
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
  completeTakeNow: vi.fn(() => false),
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
  playheadBeat: vi.fn<() => number | null>(() => null),
  tempoBpm: vi.fn(() => 90),
  countInBeats: vi.fn(() => 4),
  configuredCountInBeats: vi.fn(() => 4),
  hearScore: vi.fn(() => true),
  hearBacking: vi.fn(() => true),
  hearClick: vi.fn(() => true),
  displayReference: vi.fn(() => REFERENCE),
  runningLoop: vi.fn(() => null),
  error: vi.fn(() => null),
  masterVolume: vi.fn(() => 0.76),
  activateAudio: vi.fn(async () => true),
  getAudioGraph: vi.fn(() => null),
  parkForConfiguration: vi.fn(),
  start: vi.fn(async () => true),
  startLiveScore: vi.fn<
    (range: {
      start: number
      end: number
    }) => Promise<GuitarNightScoreLiveBoundary | null>
  >(async () => null),
  pause: vi.fn(),
  toggle: vi.fn(),
  stop: vi.fn(),
  seekSeconds: vi.fn(),
  seekBeat: vi.fn(),
  secondsForBeat: vi.fn((beat: number) => beat),
  beatForSeconds: vi.fn((seconds: number) => seconds),
  applyLoopSpan: vi.fn(async () => true),
  setTempoBpm: vi.fn(),
  setCountInBeats: vi.fn(),
  setMasterVolume: vi.fn(),
  setHearScore: vi.fn(),
  setHearBacking: vi.fn(),
  setHearClick: vi.fn(),
  startAssessment: vi.fn<
    (range: {
      start: number
      end: number
    }) => Promise<GuitarNightScoreAssessmentBoundary | null>
  >(async () => null),
}))

const takeCapture = vi.hoisted(() => ({
  state: vi.fn(() => 'idle'),
  message: vi.fn(() => ''),
  boundaryId: vi.fn(() => null),
  begin: vi.fn(() => true),
  finish: vi.fn(() => true),
  attachCompletedSummary: vi.fn(() => true),
  discard: vi.fn(() => true),
  keep: vi.fn(async () => true),
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

vi.mock('./useGuitarNightTakeCapture', () => ({
  useGuitarNightTakeCapture: () => takeCapture,
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

const SCORE_RESTART_REFERENCE: GuitarNightReference = {
  ...REVIEW_REFERENCE,
  title: 'Six-note restart study',
  tracks: [{ id: 'lead', name: 'Lead guitar', noteCount: 6 }],
  notes: Array.from({ length: 6 }, (_, index) => ({
    ...REFERENCE.notes[0]!,
    id: `score-note-${index}`,
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
    rejectedAfterEnd: 0,
    retractedAfterEnd: 0,
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
    loadProgress: () => null,
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
    listening.inputProfile.mockReturnValue('microphone')
    listening.notice.mockReturnValue(null)
    listening.take.mockReturnValue(null)
    listening.armTakeAt.mockReturnValue(false)
    listening.completeTakeAt.mockReturnValue(false)
    listening.completeTakeNow.mockReturnValue(false)
    listening.calibrate.mockResolvedValue(false)
    listening.start.mockResolvedValue(true)
    listening.selectInputProfile.mockResolvedValue(undefined)
    scoreRoom.status.mockReturnValue('quiet')
    scoreRoom.setupLocked.mockReturnValue(false)
    scoreRoom.hearScore.mockReturnValue(true)
    scoreRoom.hearBacking.mockReturnValue(true)
    scoreRoom.start.mockResolvedValue(true)
    scoreRoom.startLiveScore.mockResolvedValue(null)
    scoreRoom.pause.mockImplementation(() => undefined)
    scoreRoom.toggle.mockImplementation(() => undefined)
    scoreRoom.stop.mockImplementation(() => undefined)
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

  it('warns about speaker bleed without muting a Room mic rehearsal mix', () => {
    listening.status.mockReturnValue('listening')
    listening.inputProfile.mockReturnValue('microphone')

    render(() => (
      <GuitarNightScoreRoom
        reference={() => REFERENCE}
        backingMelody={() => [
          {
            midi: 40,
            startBeat: 0,
            durationBeats: 1,
            variant: 'bass',
            channelId: 'track-bass',
          },
        ]}
        onSongs={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('note', {
        name: /Room mic may score speaker playback/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mute backing parts' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Mute target guide' }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Mute backing parts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute target guide' }))

    expect(scoreRoom.setHearBacking).toHaveBeenCalledOnce()
    expect(scoreRoom.setHearScore).toHaveBeenCalledOnce()
  })

  it('keeps every room tool locked through an asynchronous route change', async () => {
    let routeStatus = 'listening'
    let resolveRoute!: () => void
    const routeReady = new Promise<undefined>((resolve) => {
      resolveRoute = () => resolve(undefined)
    })
    listening.status.mockImplementation(() => routeStatus)
    listening.selectInputProfile.mockReturnValue(routeReady)

    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Listening with Room mic. Switch to Direct input',
      }),
    )

    expect(listening.selectInputProfile).toHaveBeenCalledWith('interface')
    expect(screen.getByLabelText('Start the count-in')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tune guitar' })).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Review beat 1 for 1 beat',
        hidden: true,
      }),
    ).toBeDisabled()
    fireEvent.keyDown(window, { code: 'Space' })
    expect(scoreRoom.toggle).not.toHaveBeenCalled()
    expect(listening.start).not.toHaveBeenCalled()

    routeStatus = 'off'
    resolveRoute()
    await Promise.resolve()
    await Promise.resolve()

    expect(listening.start).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Start the count-in')).toBeEnabled()
  })

  it('cancels a pending route continuation when the room is suspended', async () => {
    let resolveRoute!: () => void
    const routeReady = new Promise<undefined>((resolve) => {
      resolveRoute = () => resolve(undefined)
    })
    listening.status.mockReturnValue('listening')
    listening.selectInputProfile.mockReturnValue(routeReady)
    const [suspended, setSuspended] = createSignal(false)

    render(() => (
      <GuitarNightScoreRoom
        reference={() => REFERENCE}
        suspended={suspended}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Listening with Room mic. Switch to Direct input',
      }),
    )
    setSuspended(true)
    resolveRoute()
    await Promise.resolve()
    await Promise.resolve()

    expect(listening.start).not.toHaveBeenCalled()
    setSuspended(false)
    await Promise.resolve()
    expect(screen.getByLabelText('Start the count-in')).toBeEnabled()
  })

  it('keeps Cancel opening input available during a pending permission prompt', async () => {
    const [routeStatus, setRouteStatus] = createSignal('off')
    let resolveStart!: (ready: boolean) => void
    const startReady = new Promise<boolean>((resolve) => {
      resolveStart = resolve
    })
    // Vitest invokes the accessor only when the component reads status, so the
    // signal remains inside the component's tracked scope.
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(routeStatus)
    listening.start.mockImplementation(() => {
      setRouteStatus('requesting')
      return startReady
    })
    listening.stop.mockImplementation(() => setRouteStatus('off'))

    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Listening is off. Switch to Room mic',
      }),
    )
    expect(listening.start).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByLabelText('Listening is on'))
    const cancel = screen.getByRole('button', {
      name: 'Cancel opening input',
    })
    expect(cancel).toBeEnabled()
    fireEvent.click(cancel)

    expect(listening.stop).toHaveBeenCalledOnce()
    resolveStart(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(listening.start).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Start the count-in')).toBeEnabled()
  })

  it('does not resume a scrub after the room becomes suspended', async () => {
    scoreRoom.status.mockReturnValue('playing')
    const [suspended, setSuspended] = createSignal(false)
    render(() => (
      <GuitarNightScoreRoom
        reference={() => REFERENCE}
        suspended={suspended}
        onSongs={vi.fn()}
      />
    ))

    const rail = screen.getByLabelText('Score position')
    fireEvent.pointerDown(rail)
    setSuspended(true)
    await Promise.resolve()
    fireEvent.pointerUp(rail)

    expect(scoreRoom.pause).toHaveBeenCalled()
    expect(scoreRoom.start).not.toHaveBeenCalled()
  })

  it('does not resume a scrub behind a room modal', () => {
    listening.status.mockReturnValue('off')
    scoreRoom.status.mockReturnValue('playing')
    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    const rail = screen.getByLabelText('Score position')
    fireEvent.pointerDown(rail)
    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    expect(screen.getByRole('dialog', { name: 'Score' })).toBeInTheDocument()
    fireEvent.pointerUp(rail)

    expect(scoreRoom.pause).toHaveBeenCalled()
    expect(scoreRoom.start).not.toHaveBeenCalled()
  })

  it('does not let scrub release undo an explicit Stop', () => {
    const [status, setStatus] = createSignal('playing')
    listening.status.mockReturnValue('off')
    // eslint-disable-next-line solid/reactivity -- called from the component's tracked scope
    scoreRoom.status.mockImplementation(status)
    scoreRoom.setupLocked.mockReturnValue(true)
    scoreRoom.pause.mockImplementation(() => setStatus('paused'))
    scoreRoom.stop.mockImplementation(() => setStatus('quiet'))

    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    const rail = screen.getByLabelText('Score position')
    fireEvent.pointerDown(rail)
    fireEvent.click(screen.getByRole('button', { name: 'End the take' }))
    fireEvent.pointerUp(rail)

    expect(scoreRoom.stop).toHaveBeenCalledOnce()
    expect(scoreRoom.start).not.toHaveBeenCalled()
  })

  it('does not double-start when Play is pressed during a scrub', () => {
    const [status, setStatus] = createSignal('playing')
    listening.status.mockReturnValue('off')
    // eslint-disable-next-line solid/reactivity -- called from the component's tracked scope
    scoreRoom.status.mockImplementation(status)
    scoreRoom.setupLocked.mockReturnValue(true)
    scoreRoom.pause.mockImplementation(() => setStatus('paused'))
    scoreRoom.toggle.mockImplementation(() => setStatus('playing'))

    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    const rail = screen.getByLabelText('Score position')
    fireEvent.pointerDown(rail)
    fireEvent.click(screen.getByRole('button', { name: 'Resume score' }))
    fireEvent.pointerUp(rail)

    expect(scoreRoom.toggle).toHaveBeenCalledOnce()
    expect(scoreRoom.start).not.toHaveBeenCalled()
  })

  it('requires an explicit Room mic bleed acknowledgement before scoring', async () => {
    listening.status.mockReturnValue('listening')
    listening.inputProfile.mockReturnValue('microphone')
    listening.armTakeAt.mockImplementation(() => {
      listening.take.mockReturnValue(completedReviewTake('recording'))
      return true
    })
    listening.completeTakeAt.mockReturnValue(true)
    scoreRoom.startLiveScore.mockResolvedValue({
      id: 'room-mic-score',
      reference: SCORE_RESTART_REFERENCE,
      range: { start: 0, end: 6 },
      tempoBpm: 90,
      scoreTempoBpm: 90,
      countInBeats: 4,
      sampleRate: 1_000,
      startedAtSeconds: 10,
      completedAtSeconds: 16,
      beatToSeconds: (beat: number) => beat,
    })

    render(() => (
      <GuitarNightScoreRoom
        reference={() => SCORE_RESTART_REFERENCE}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText('Start the count-in'))

    const warning = await screen.findByRole('alertdialog', {
      name: 'Keep this take honest.',
    })
    expect(warning).toHaveTextContent('Speakers can enter the Room mic')
    expect(scoreRoom.startLiveScore).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Continue with this mix' }),
    ).toHaveFocus()

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with this mix' }),
    )

    await vi.waitFor(() =>
      expect(scoreRoom.startLiveScore).toHaveBeenCalledWith({
        start: 0,
        end: 6,
      }),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('reopens the selected route after scored Pause and completed Replay', async () => {
    listening.inputProfile.mockReturnValue('interface')
    const [listeningStatus, setListeningStatus] = createSignal('listening')
    const [take, setTake] = createSignal<GuitarTakeSnapshot | null>(null)
    const [roomStatus, setRoomStatus] = createSignal('quiet')
    const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
    const [suspended, setSuspended] = createSignal(false)
    let takeNumber = 0
    let rejectInput!: (ready: boolean) => void
    const rejectedInput = new Promise<boolean>((resolve) => {
      rejectInput = resolve
    })

    // Accessors are invoked from the component's tracked owner.
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(listeningStatus)
    // eslint-disable-next-line solid/reactivity
    listening.take.mockImplementation(take)
    listening.armTakeAt.mockImplementation(() => {
      takeNumber += 1
      setTake({
        ...completedReviewTake('recording'),
        id: `score-take-${takeNumber}`,
        input: {
          ...completedReviewTake('recording').input,
          kind: 'interface',
        },
      })
      return true
    })
    listening.completeTakeAt.mockReturnValue(true)
    listening.stop.mockImplementation(() => {
      setListeningStatus('off')
      setTake((current) =>
        current === null
          ? null
          : {
              ...current,
              lifecycle: 'completed',
              durationFrames: 6_000,
            },
      )
    })
    listening.start.mockImplementationOnce(() => rejectedInput)

    // Accessors are invoked from the component's tracked owner.
    // eslint-disable-next-line solid/reactivity
    scoreRoom.status.mockImplementation(roomStatus)
    // eslint-disable-next-line solid/reactivity
    scoreRoom.playheadBeat.mockImplementation(playheadBeat)
    // eslint-disable-next-line solid/reactivity
    scoreRoom.setupLocked.mockImplementation(() =>
      ['starting', 'count-in', 'playing'].includes(roomStatus()),
    )
    scoreRoom.pause.mockImplementation(() => setRoomStatus('paused'))
    scoreRoom.stop.mockImplementation(() => setRoomStatus('quiet'))
    scoreRoom.startLiveScore.mockImplementation(async (range) => {
      setRoomStatus('playing')
      return {
        id: `score-run-${scoreRoom.startLiveScore.mock.calls.length}`,
        reference: SCORE_RESTART_REFERENCE,
        range,
        tempoBpm: 90,
        scoreTempoBpm: 90,
        countInBeats: 4,
        sampleRate: 1_000,
        startedAtSeconds: 10,
        completedAtSeconds: 10 + range.end - range.start,
        beatToSeconds: (beat: number) => beat,
      }
    })

    render(() => (
      <GuitarNightScoreRoom
        reference={() => SCORE_RESTART_REFERENCE}
        suspended={suspended}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText('Start the count-in'))
    await Promise.resolve()
    await Promise.resolve()
    expect(scoreRoom.startLiveScore).toHaveBeenNthCalledWith(1, {
      start: 0,
      end: 6,
    })

    setPlayheadBeat(3.4)
    const pause = screen.getByLabelText('Pause score')
    await vi.waitFor(() => expect(pause).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Pause score'))
    await Promise.resolve()

    const liveScore = screen.getByTestId('guitar-night-live-score')
    expect(scoreRoom.toggle).not.toHaveBeenCalled()
    expect(listening.stop).toHaveBeenCalledOnce()
    expect(scoreRoom.pause).toHaveBeenCalledOnce()
    expect(liveScore).toHaveAttribute('data-state', 'paused')
    expect(within(liveScore).getByText('Score held')).toBeInTheDocument()
    expect(screen.getByLabelText('Resume score')).toBeEnabled()
    expect(screen.getByLabelText('End the take')).toBeEnabled()

    fireEvent.click(screen.getByLabelText('Resume score'))
    expect(screen.getByLabelText('Starting a fresh live score')).toBeDisabled()
    expect(screen.getByLabelText('Cancel score start')).toBeEnabled()
    expect(liveScore).toHaveAttribute('data-state', 'paused')

    fireEvent.click(screen.getByLabelText('Cancel score start'))
    expect(listening.cancel).toHaveBeenCalledOnce()
    expect(liveScore).toHaveAttribute('data-state', 'paused')
    expect(screen.getByLabelText('Resume score')).toBeEnabled()
    rejectInput(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(scoreRoom.startLiveScore).toHaveBeenCalledOnce()
    expect(liveScore).toHaveAttribute('data-state', 'paused')

    listening.start.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByLabelText('Resume score'))
    await Promise.resolve()
    await Promise.resolve()
    expect(scoreRoom.startLiveScore).toHaveBeenCalledOnce()
    expect(liveScore).toHaveAttribute('data-state', 'paused')
    expect(screen.getByLabelText('Resume score')).toBeEnabled()

    listening.start.mockImplementationOnce(async () => {
      setListeningStatus('listening')
      return true
    })
    fireEvent.click(screen.getByLabelText('Resume score'))
    await Promise.resolve()
    await Promise.resolve()

    expect(scoreRoom.startLiveScore).toHaveBeenNthCalledWith(2, {
      start: 3.4,
      end: 6,
    })
    expect(listening.start).toHaveBeenCalledTimes(3)
    expect(listening.selectInputProfile).not.toHaveBeenCalled()
    expect(listening.armTakeAt).toHaveBeenCalledTimes(2)
    expect(scoreRoom.toggle).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Pause score')).toBeEnabled(),
    )

    setPlayheadBeat(6)
    setRoomStatus('complete')
    setListeningStatus('off')
    setTake((current) =>
      current === null
        ? null
        : {
            ...current,
            lifecycle: 'completed',
            durationFrames: 2_600,
          },
    )
    await Promise.resolve()
    expect(liveScore).toHaveAttribute('data-state', 'complete')
    expect(screen.getByLabelText('Replay score')).toBeEnabled()

    const cancelledReplay = Promise.withResolvers<boolean>()
    listening.start.mockImplementationOnce(() => cancelledReplay.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    takeCapture.discard.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(takeCapture.discard).toHaveBeenCalledWith('score-run-2')
    expect(screen.queryByRole('dialog', { name: 'Score' })).toBeNull()
    expect(screen.getByLabelText('Cancel replay')).toBeEnabled()
    fireEvent.click(screen.getByLabelText('Cancel replay'))
    cancelledReplay.resolve(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(scoreRoom.startLiveScore).toHaveBeenCalledTimes(2)

    listening.start.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    takeCapture.discard.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(takeCapture.discard).toHaveBeenCalledWith('score-run-2')
    expect(liveScore).toHaveAttribute('data-state', 'complete')
    await Promise.resolve()
    await Promise.resolve()
    expect(scoreRoom.startLiveScore).toHaveBeenCalledTimes(2)
    expect(liveScore).toHaveAttribute('data-state', 'complete')

    listening.start.mockImplementationOnce(async () => {
      setListeningStatus('listening')
      return true
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Pause score')).toBeEnabled(),
    )

    expect(scoreRoom.startLiveScore).toHaveBeenNthCalledWith(3, {
      start: 3.4,
      end: 6,
    })
    expect(listening.start).toHaveBeenCalledTimes(6)
    expect(listening.selectInputProfile).not.toHaveBeenCalled()
    expect(listening.armTakeAt).toHaveBeenCalledTimes(3)
    expect(scoreRoom.toggle).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Pause score'))
    await Promise.resolve()
    expect(screen.getByLabelText('End the take')).toBeEnabled()
    fireEvent.click(screen.getByLabelText('End the take'))
    await vi.waitFor(() =>
      expect(liveScore).toHaveAttribute('data-state', 'complete'),
    )
    expect(scoreRoom.stop).toHaveBeenCalled()

    takeCapture.discard.mockClear()
    setSuspended(true)
    await Promise.resolve()
    expect(takeCapture.discard).toHaveBeenCalledWith('score-run-3')
  })

  it('discards a completed replay before reopening a cached phrase review', async () => {
    listening.inputProfile.mockReturnValue('interface')
    listening.status.mockReturnValue('listening')
    const [take, setTake] = createSignal<GuitarTakeSnapshot | null>(
      completedReviewTake('completed'),
    )
    const [roomStatus, setRoomStatus] = createSignal('quiet')
    const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(0)
    let armCount = 0

    // Accessors are invoked from the component's tracked owner.
    // eslint-disable-next-line solid/reactivity
    listening.take.mockImplementation(take)
    listening.armTakeAt.mockImplementation(() => {
      armCount += 1
      if (armCount === 2) {
        setTake({
          ...completedReviewTake('recording'),
          input: {
            ...completedReviewTake('recording').input,
            kind: 'interface',
          },
        })
      }
      return true
    })
    listening.completeTakeAt.mockReturnValue(true)
    // Accessors are invoked from the component's tracked owner.
    // eslint-disable-next-line solid/reactivity
    scoreRoom.status.mockImplementation(roomStatus)
    // eslint-disable-next-line solid/reactivity
    scoreRoom.playheadBeat.mockImplementation(playheadBeat)
    // eslint-disable-next-line solid/reactivity
    scoreRoom.setupLocked.mockImplementation(() =>
      ['starting', 'count-in', 'playing'].includes(roomStatus()),
    )
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
    scoreRoom.startLiveScore.mockImplementation(async (range) => {
      setRoomStatus('playing')
      return {
        id: 'live-cached-review',
        reference: REVIEW_REFERENCE,
        range,
        tempoBpm: 90,
        scoreTempoBpm: 90,
        countInBeats: 4,
        sampleRate: 1_000,
        startedAtSeconds: 10,
        completedAtSeconds: 14,
        beatToSeconds: (beat: number) => beat,
      }
    })

    render(() => (
      <GuitarNightScoreRoom
        reference={() => REVIEW_REFERENCE}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText('Listening is on'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Review beat 1 for 4 beats' }),
    )
    const reviewCue = await screen.findByRole('button', {
      name: 'Review Beat 1 · 4 beats · 90 BPM: The pulse stayed together.',
    })
    fireEvent.click(reviewCue)
    fireEvent.click(screen.getByRole('button', { name: 'Close Jam Doctor' }))

    fireEvent.click(screen.getByLabelText('Start the count-in'))
    await vi.waitFor(() =>
      expect(scoreRoom.startLiveScore).toHaveBeenCalledOnce(),
    )
    setPlayheadBeat(4)
    setRoomStatus('complete')
    setTake({
      ...completedReviewTake('completed'),
      input: {
        ...completedReviewTake('completed').input,
        kind: 'interface',
      },
    })
    await vi.waitFor(() =>
      expect(screen.getByTestId('guitar-night-live-score')).toHaveAttribute(
        'data-state',
        'complete',
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    takeCapture.discard.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Review a phrase' }))

    expect(takeCapture.discard).toHaveBeenCalledWith('live-cached-review')
    expect(scoreRoom.startAssessment).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'The pulse stayed together.',
    )
  })

  it('parks a completed score take before opening Listening', () => {
    listening.status.mockReturnValue('off')
    scoreRoom.status.mockReturnValue('complete')
    render(() => (
      <GuitarNightScoreRoom reference={() => REFERENCE} onSongs={vi.fn()} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Turn on Listening' }))

    expect(scoreRoom.parkForConfiguration).toHaveBeenCalledOnce()
    expect(scoreRoom.stop).not.toHaveBeenCalled()
    expect(listening.start).toHaveBeenCalledOnce()
    expect(
      scoreRoom.parkForConfiguration.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
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
