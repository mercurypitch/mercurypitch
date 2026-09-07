// Guitar Night room tests keep controls bound to route-owned transport truth.
// ============================================================
// Kept together because every assertion exercises the same prepared-song room
// boundary and its route-owned transport double.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { batch, createSignal, untrack } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportStatus } from '@/features/guitar/backing/guitar-backing-transport'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { activeVoiceCommands } from '@/features/voice-control/voice-command-registry'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import { GuitarNightRoom } from './GuitarNightRoom'
import { GUITAR_NIGHT_FREE_PLAY_NOTE_KEY } from './GuitarNightStage'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease } from './song-port'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'off'),
  error: vi.fn(() => null),
  notice: vi.fn<() => string | null>(() => null),
  canTakeOverInput: vi.fn(() => false),
  inputTakeoverPending: vi.fn(() => false),
  currentNote: vi.fn(() => null),
  detectedFrequency: vi.fn(() => null),
  detectedCents: vi.fn(() => null),
  pitchRevision: vi.fn(() => 0),
  clarity: vi.fn(() => 0),
  take: vi.fn<() => GuitarTakeSnapshot | null>(() => null),
  events: vi.fn(() => []),
  observations: vi.fn(() => []),
  inputProfile: vi.fn(() => 'microphone'),
  inputProfileLabel: vi.fn(() => 'Room mic'),
  audioInputs: vi.fn(() => []),
  selectedAudioInputId: vi.fn(() => null),
  midiInputs: vi.fn(() => []),
  selectedMidiInputId: vi.fn(() => null),
  midiConnectionStatus: vi.fn(() => 'idle'),
  evidenceExportEnabled: vi.fn(() => false),
  canExportEvidence: vi.fn(() => false),
  timingSource: vi.fn(() => 'audio-clock'),
  latencyMs: vi.fn(() => 0),
  health: vi.fn(() => null),
  canAmpMonitor: vi.fn(() => false),
  ampMonitoringEnabled: vi.fn(() => false),
  ampMonitoringActive: vi.fn(() => false),
  setAmpMonitoringEnabled: vi.fn(() => false),
  start: vi.fn(async () => true),
  useInputHere: vi.fn(async () => true),
  stop: vi.fn(),
  cancel: vi.fn(),
  calibrate: vi.fn(async () => false),
  clearTake: vi.fn(),
  selectInputProfile: vi.fn(async (): Promise<void> => undefined),
  selectAudioInput: vi.fn(async () => undefined),
  selectMidiInput: vi.fn(),
  refreshAudioInputs: vi.fn(async () => undefined),
  refreshMidiInputs: vi.fn(async () => false),
  exportEvidenceReport: vi.fn(() => false),
}))

vi.mock('./useGuitarListeningController', () => ({
  useGuitarListeningController: () => listening,
}))

const BACKING: GuitarNightBackingLease = {
  sessionId: 'volume-room',
  title: 'Pocket Groove',
  stems: [
    {
      kind: 'drums',
      url: 'blob:drums',
      sizeBytes: 1024,
      durationSeconds: 60,
    },
  ],
  defaultMix: {
    kind: 'parts',
    audible: ['drums'],
    muted: [],
  },
  release: vi.fn(),
}

/** A tab brought in from a file: its own tempo, not this recording's. */
const AUTHORED_TAB: GuitarNightReference = {
  kind: 'authored',
  songId: 'velvet-study',
  title: 'Velvet pointer study',
  trackId: 'track-lead',
  trackName: 'Lead guitar',
  tempoBpm: 120,
  tuning: standardTuning('guitar', 6),
  notes: [
    {
      id: 'velvet-note-1',
      midi: 64,
      noteName: 'E4',
      targetFreq: 329.63,
      startBeat: 0,
      duration: 1,
      stringIndex: 0,
      fret: 0,
    },
  ],
  tracks: [{ id: 'track-lead', name: 'Lead guitar', noteCount: 1 }],
  outOfRangeNotes: 0,
}

const COMPLETED_FREE_PLAY_TAKE: GuitarTakeSnapshot = {
  id: 'free-play-take',
  lifecycle: 'completed',
  input: {
    kind: 'microphone',
    requestedDeviceId: null,
    activeDeviceId: 'room-mic',
    activeDeviceLabel: 'Room microphone',
  },
  clock: {
    startedAtFrame: 10_000,
    sampleRate: 1_000,
    attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
    latency: {
      seconds: 0,
      frames: 0,
      provenance: 'none',
      uncertaintySeconds: null,
    },
  },
  events: [
    {
      id: 'free-play-attack',
      kind: 'attack',
      source: 'microphone',
      voiceId: null,
      at: 10,
      capturedAt: 10,
      rawTransportFrame: 0,
      compensatedTransportFrame: 0,
      level: 0.2,
      clock: {
        kind: 'audio-worklet',
        atFrame: 10_000,
        sampleRate: 1_000,
      },
      pitch: {
        midi: 64,
        noteName: 'E4',
        cents: 0,
        clarity: 0.9,
      },
    },
  ],
  durationFrames: 1_000,
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
  },
}

function createTransport(): GuitarBackingTransportController {
  let masterVolume = 0.78

  return {
    status: () => 'armed',
    loadMode: () => null,
    loadProgress: () => null,
    positionSeconds: () => 0,
    durationSeconds: () => 60,
    playbackRate: () => 1,
    masterVolume: () => masterVolume,
    backingMuted: () => false,
    setBackingMuted: vi.fn(),
    tracks: () => [],
    soloedTrackId: () => null,
    loopRange: () => null,
    loopMode: () => null,
    loopError: () => null,
    setLoopRange: vi.fn(() => true),
    error: () => null,
    configure: vi.fn(),
    activate: vi.fn(async () => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setPlaybackRate: vi.fn(async () => true),
    setMasterVolume: vi.fn((position: number) => {
      masterVolume = position
    }),
    setElectricAmpParameters: vi.fn(),
    setTrackMuted: vi.fn(),
    setTrackLevelDb: vi.fn(),
    toggleTrackSolo: vi.fn(),
    resetTrackLevels: vi.fn(),
    getAudioGraph: vi.fn(() => null),
  }
}

describe('GuitarNightRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The free-play note persists its dismissal, so without this the tests
    // after the dismissal one would pass because nothing rendered at all.
    localStorage.clear()
    listening.status.mockReturnValue('off')
    listening.stop.mockReset()
    listening.start.mockReset().mockResolvedValue(true)
    listening.selectInputProfile.mockReset().mockResolvedValue(undefined)
    listening.error.mockReturnValue(null)
    listening.notice.mockReturnValue(null)
    listening.take.mockReturnValue(null)
    listening.inputProfile.mockReturnValue('microphone')
    listening.inputProfileLabel.mockReturnValue('Room mic')
    listening.canAmpMonitor.mockReturnValue(false)
    listening.ampMonitoringEnabled.mockReturnValue(false)
    listening.ampMonitoringActive.mockReturnValue(false)
  })

  afterEach(cleanup)

  it.each(['button', 'Space', 'voice'] as const)(
    'uses the same Direct-input coexistence policy for %s playback',
    async (trigger) => {
      const [status, setStatus] =
        createSignal<GuitarBackingTransportStatus>('armed')
      const [inputStatus, setInputStatus] = createSignal('listening')
      // The room reads this mocked accessor inside its reactive memos.
      // eslint-disable-next-line solid/reactivity
      listening.status.mockImplementation(inputStatus)
      listening.inputProfile.mockReturnValue('interface')
      listening.stop.mockImplementation(() => setInputStatus('off'))
      const transport = createTransport()
      transport.status = status
      transport.play = vi.fn(async () => {
        setStatus('playing')
        return true
      })
      transport.pause = vi.fn(() => setStatus('paused'))
      render(() => (
        <GuitarNightRoom
          backing={BACKING}
          transport={transport}
          onSongs={vi.fn()}
        />
      ))
      if (trigger === 'button')
        fireEvent.click(screen.getByRole('button', { name: 'Play backing' }))
      if (trigger === 'Space')
        fireEvent.keyDown(document, { key: ' ', code: 'Space' })
      if (trigger === 'voice')
        await activeVoiceCommands()
          .find((command) => command.id === 'guitarNight.play')
          ?.run({})
      expect(untrack(status)).toBe('playing')
      expect(untrack(inputStatus)).toBe('listening')
      expect(listening.setAmpMonitoringEnabled).not.toHaveBeenCalled()
    },
  )

  it('ends Room-mic Listening before a spoken Play can start the song', async () => {
    const [inputStatus, setInputStatus] = createSignal('listening')
    // The room reads this mocked accessor inside its reactive memos.
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(inputStatus)
    listening.stop.mockImplementation(() => setInputStatus('off'))
    const transport = createTransport()
    const [status, setStatus] =
      createSignal<GuitarBackingTransportStatus>('armed')
    transport.status = status
    transport.play = vi.fn(async () => {
      setStatus('playing')
      return true
    })
    transport.pause = vi.fn(() => setStatus('paused'))
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    await activeVoiceCommands()
      .find((command) => command.id === 'guitarNight.play')
      ?.run({})
    expect(untrack(inputStatus)).toBe('off')
    expect(untrack(status)).toBe('playing')
  })

  it('sends committed song marks to the loop backend without a frame-driven seek', () => {
    const transport = createTransport()
    const [position, setPosition] = createSignal(1)
    const [range, setRange] = createSignal<{
      start: number
      end: number
    } | null>(null)
    transport.positionSeconds = position
    transport.loopRange = range
    transport.setLoopRange = vi.fn((next) => {
      setRange(next)
      return true
    })
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'A — start the loop at the playhead',
      }),
    )
    setPosition(3)
    fireEvent.click(
      screen.getByRole('button', { name: 'B — end the loop at the playhead' }),
    )
    expect(untrack(range)).toEqual({ start: 1, end: 3 })
    setPosition(3.2)
    expect(transport.seek).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(untrack(range)).toBeNull()
  })

  it('retains a backend loop error when decoded duration invalidates both marks', () => {
    const transport = createTransport()
    const [position, setPosition] = createSignal(8)
    const [duration, setDuration] = createSignal(12)
    const [range, setRange] = createSignal<{
      start: number
      end: number
    } | null>(null)
    const [loopError, setLoopError] = createSignal<string | null>(null)
    transport.positionSeconds = position
    transport.durationSeconds = duration
    transport.loopRange = range
    transport.loopError = loopError
    transport.setLoopRange = vi.fn((next) => {
      batch(() => {
        setRange(next)
        setLoopError(null)
      })
      return true
    })
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'A — start the loop at the playhead',
      }),
    )
    setPosition(12)
    fireEvent.click(
      screen.getByRole('button', { name: 'B — end the loop at the playhead' }),
    )
    expect(untrack(range)).toEqual({ start: 8, end: 12 })
    vi.mocked(transport.setLoopRange).mockClear()
    batch(() => {
      setRange(null)
      setLoopError(
        'The loop is outside this recording. Set A and B within the song.',
      )
      setDuration(6)
    })
    expect(transport.setLoopRange).not.toHaveBeenCalled()
    expect(screen.getByText('Loop unavailable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The loop is outside this recording.',
    )
    expect(screen.queryByText('Mark the other end')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(untrack(loopError)).toBeNull()
  })

  it('explains a too-short committed pair rather than asking for a missing mark', () => {
    const transport = createTransport()
    const [position, setPosition] = createSignal(1)
    transport.positionSeconds = position
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'A — start the loop at the playhead',
      }),
    )
    setPosition(1.1)
    fireEvent.click(
      screen.getByRole('button', { name: 'B — end the loop at the playhead' }),
    )
    expect(
      screen.getByText('Set A and B at least 0.25 s apart'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Mark the other end')).not.toBeInTheDocument()
  })

  it('keeps Stop Listening reachable while the backing is loading', () => {
    const [inputStatus, setInputStatus] = createSignal('listening')
    // The rendered Listening control owns this reactive read.
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(inputStatus)
    listening.inputProfile.mockReturnValue('interface')
    listening.stop.mockImplementation(() => setInputStatus('off'))
    const transport = createTransport()
    transport.status = () => 'loading'
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    const stop = screen.getByRole('button', { name: 'Stop Listening' })
    expect(stop).toBeEnabled()
    fireEvent.click(stop)
    expect(untrack(inputStatus)).toBe('off')
    expect(transport.pause).not.toHaveBeenCalled()
  })

  it('keeps input configuration passive and offers an explicit Session restart', async () => {
    const [profile, setProfile] = createSignal('microphone')
    const [status, setStatus] = createSignal('off')
    // These accessors are read by rendered components, not at mock setup.
    // eslint-disable-next-line solid/reactivity
    listening.inputProfile.mockImplementation(profile)
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(status)
    listening.selectInputProfile.mockImplementationOnce(async () => {
      setProfile('interface')
    })
    listening.start.mockImplementationOnce(async () => {
      setStatus('listening')
      return true
    })
    const transport = createTransport()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    const input = screen.getByRole('region', { name: 'Listening input' })
    expect(input.closest('details')).toBeNull()
    fireEvent.click(within(input).getByRole('button', { name: 'Direct input' }))
    await waitFor(() =>
      expect(listening.selectInputProfile).toHaveBeenCalledWith('interface'),
    )
    expect(listening.start).not.toHaveBeenCalled()
    expect(listening.setAmpMonitoringEnabled).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Listening' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Stop Listening' }),
      ).toBeEnabled(),
    )
    expect(listening.start).toHaveBeenCalledOnce()
    expect(listening.setAmpMonitoringEnabled).not.toHaveBeenCalled()
    expect(transport.play).not.toHaveBeenCalled()
  })

  it('routes the reused primary cycle through song input coexistence', async () => {
    const [profile, setProfile] = createSignal('microphone')
    const [status, setStatus] = createSignal('off')
    // Rendered controls own the reactive reads of these mocked accessors.
    // eslint-disable-next-line solid/reactivity
    listening.inputProfile.mockImplementation(profile)
    // eslint-disable-next-line solid/reactivity
    listening.status.mockImplementation(status)
    listening.start.mockImplementationOnce(async () => {
      setStatus('listening')
      return true
    })
    const transport = createTransport()
    const [transportStatus, setTransportStatus] =
      createSignal<GuitarBackingTransportStatus>('playing')
    transport.status = transportStatus
    transport.pause = vi.fn(() => setTransportStatus('paused'))
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    const cycle = screen.getByTestId('guitar-night-listening-cycle')
    fireEvent.click(cycle)
    await waitFor(() =>
      expect(cycle).toHaveAttribute('data-state', 'microphone'),
    )
    await waitFor(() => expect(listening.start).toHaveBeenCalledOnce())
    expect(transport.pause).toHaveBeenCalledOnce()
    listening.selectInputProfile.mockImplementationOnce(async () => {
      setStatus('off')
      setProfile('interface')
    })
    listening.start.mockImplementationOnce(async () => {
      setStatus('listening')
      return true
    })
    await waitFor(() => expect(cycle).toHaveAttribute('aria-disabled', 'false'))
    fireEvent.click(cycle)
    await waitFor(() =>
      expect(cycle).toHaveAttribute('data-state', 'interface'),
    )
    expect(listening.selectInputProfile).toHaveBeenLastCalledWith('interface')
    await waitFor(() => expect(listening.start).toHaveBeenCalledTimes(2))
    expect(listening.setAmpMonitoringEnabled).not.toHaveBeenCalled()
  })

  it('does not start a selected input after its song room unmounts', async () => {
    let finishSelection!: () => void
    listening.selectInputProfile.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSelection = resolve
        }),
    )
    const view = render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
      />
    ))
    fireEvent.click(screen.getByTestId('guitar-night-listening-cycle'))
    expect(listening.start).not.toHaveBeenCalled()
    view.unmount()
    finishSelection()
    await Promise.resolve()
    expect(listening.start).not.toHaveBeenCalled()
  })

  it.each([
    ['Align Bass by hand', false],
    ['Mark Bass', false],
    ['Adjust Bass', true],
  ] as const)(
    'opens Session at hand placement from %s without starting audio',
    async (label, placed) => {
      const transport = createTransport()
      render(() => (
        <GuitarNightRoom
          backing={BACKING}
          transport={transport}
          onSongs={vi.fn()}
          handSync={() => ({
            partName: 'Bass',
            firstMarkSeconds: placed ? 4 : null,
            lastMarkSeconds: null,
            placed,
            onMark: vi.fn(),
            onClear: vi.fn(),
            onNudge: vi.fn(),
          })}
        />
      ))
      const trigger = screen.getByRole('button', { name: label })
      trigger.focus()

      fireEvent.click(trigger)
      await Promise.resolve()

      const session = within(screen.getByRole('dialog', { name: 'Session' }))
      expect(
        session.getByRole('button', { name: 'First note here' }),
      ).toHaveFocus()
      expect(transport.activate).not.toHaveBeenCalled()
      expect(transport.play).not.toHaveBeenCalled()
      expect(listening.start).not.toHaveBeenCalled()

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: 'Session' })).toBeNull()
      expect(trigger).toHaveFocus()

      fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
      await Promise.resolve()
      expect(
        screen.getByRole('button', { name: 'Close Session' }),
      ).toHaveFocus()
    },
  )

  it('turns a hand-sync mark into the moment the recording is at', () => {
    // The room is the only place that knows where the recording is, so it is
    // the room that turns "here" into a number. Everything else is the
    // controller's, and gets handed straight through.
    const onMark = vi.fn()
    const onClear = vi.fn()
    const onNudge = vi.fn()

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        handSync={() => ({
          partName: 'Bass',
          firstMarkSeconds: 4,
          lastMarkSeconds: null,
          placed: true,
          onMark,
          onClear,
          onNudge,
        })}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'First note here' }))
    fireEvent.click(screen.getByRole('button', { name: 'Last note here' }))
    expect(onMark).toHaveBeenNthCalledWith(1, 'first', 0)
    expect(onMark).toHaveBeenNthCalledWith(2, 'last', 0)

    fireEvent.click(
      screen.getByRole('button', { name: 'Move the tab 0.5 seconds later' }),
    )
    expect(onNudge).toHaveBeenCalledWith(0.5)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('offers no hand sync when no part is being placed', () => {
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
      />
    ))

    expect(screen.queryByRole('button', { name: 'First note here' })).toBeNull()
  })

  it('keeps input health available after a successful route fallback', () => {
    listening.status.mockReturnValue('listening')
    listening.notice.mockReturnValue(
      'The saved input is unavailable. Listening through Built-in input.',
    )

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
      />
    ))

    const notice = screen.getByText(/Listening through Built-in input/)
    expect(notice).toHaveAttribute('role', 'status')
    expect(notice.closest('details')).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Session' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    expect(
      screen.getByRole('button', { name: 'Calibrate timing' }),
    ).toBeEnabled()
  })

  it('restores the route transport volume when the room is reopened', () => {
    const transport = createTransport()
    const firstRoom = render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.input(screen.getByLabelText('Backing volume'), {
      target: { value: '0.31' },
    })
    expect(transport.setMasterVolume).toHaveBeenCalledWith(0.31)
    firstRoom.unmount()

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    expect(
      (screen.getByLabelText('Backing volume') as HTMLInputElement).value,
    ).toBe('0.31')
  })

  it('shares the Session amp without starting playback or Direct-input monitoring', () => {
    listening.status.mockReturnValue('listening')
    listening.inputProfile.mockReturnValue('interface')
    listening.inputProfileLabel.mockReturnValue('Direct input')
    listening.canAmpMonitor.mockReturnValue(true)
    const transport = createTransport()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    const amp = within(screen.getByRole('region', { name: 'Guitar amp' }))
    expect(amp.queryByText('Shared electric tone')).toBeNull()
    expect(
      screen.getByText(
        'The amp shapes your live guitar, not the recorded tracks.',
      ),
    ).toBeInTheDocument()
    fireEvent.change(amp.getByLabelText('Guitar amp preset'), {
      target: { value: 'crunch' },
    })
    fireEvent.click(amp.getByRole('button', { name: 'Bypass guitar amp' }))
    fireEvent.click(amp.getByText('Shape tone & cabinet'))
    fireEvent.input(amp.getByRole('slider', { name: 'Guitar amp treble' }), {
      target: { value: '0.25' },
    })

    expect(
      amp.getByRole('button', { name: 'Turn monitoring on' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(transport.setElectricAmpParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, treble: 0.25 }),
    )
    expect(transport.activate).not.toHaveBeenCalled()
    expect(transport.play).not.toHaveBeenCalled()
    expect(listening.start).not.toHaveBeenCalled()
    expect(listening.setAmpMonitoringEnabled).not.toHaveBeenCalled()
  })

  it('opens Tune silently, pauses the room, and suspends the Space transport', async () => {
    const transport = createTransport()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const tune = screen.getByRole('button', { name: 'Tune guitar' })
    fireEvent.click(tune)

    expect(transport.pause).toHaveBeenCalledOnce()
    expect(listening.start).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: 'Tune before the room.' }),
    ).toBeInTheDocument()

    const space = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(space)
    expect(transport.play).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(listening.start).toHaveBeenCalledWith({ purpose: 'tuner' })

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()
    expect(screen.queryByTestId('guitar-night-tuner')).toBeNull()
    expect(document.activeElement).toBe(tune)
  })

  it('parks the embedded tuner and releases Space while a room sheet is open', async () => {
    const transport = createTransport()
    const [suspended, setSuspended] = createSignal(false)
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        suspended={suspended}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Tune guitar' }))
    expect(screen.getByTestId('guitar-night-tuner')).toBeInTheDocument()

    setSuspended(true)
    await Promise.resolve()
    expect(screen.queryByTestId('guitar-night-tuner')).toBeNull()
    expect(listening.stop).toHaveBeenCalled()
    expect(transport.pause).toHaveBeenCalled()

    const space = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(false)
    expect(transport.play).not.toHaveBeenCalled()
  })

  it('leaves Doctor recovery Space untouched and recovers once on click', () => {
    const transport = createTransport()
    listening.take.mockReturnValue(COMPLETED_FREE_PLAY_TAKE)
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', {
        name: /Review Free play.*One fresh note start came through/,
      }),
    )
    const recovery = screen.getByRole('button', {
      name: 'Listen to another take',
    })
    const space = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    recovery.dispatchEvent(space)

    expect(space.defaultPrevented).toBe(false)
    expect(transport.play).not.toHaveBeenCalled()

    fireEvent.click(recovery)
    expect(listening.clearTake).toHaveBeenCalledOnce()
    expect(listening.start).toHaveBeenCalledOnce()
  })

  it('opens named stem rows with independent mute, solo and level controls', () => {
    const transport = createTransport()
    transport.tracks = () => [
      {
        id: 'vocal',
        label: 'Vocals',
        muted: false,
        effectiveMuted: false,
        available: true,
        level: 1,
        levelDb: 0,
      },
      {
        id: 'instrumental',
        label: 'Backing',
        muted: true,
        effectiveMuted: true,
        available: true,
        level: 1,
        levelDb: 0,
      },
    ]

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open track mixer for Pocket Groove',
      }),
    )
    const backing = within(screen.getByRole('group', { name: 'Backing track' }))
    expect(backing.getByText('Backing')).toBeInTheDocument()
    expect(backing.getByText('Muted')).toBeInTheDocument()
    fireEvent.click(backing.getByRole('button', { name: 'Unmute Backing' }))
    expect(transport.setTrackMuted).toHaveBeenLastCalledWith(
      'instrumental',
      false,
    )
    fireEvent.click(backing.getByRole('button', { name: 'Solo Backing' }))
    expect(transport.toggleTrackSolo).toHaveBeenLastCalledWith('instrumental')
    fireEvent.input(backing.getByRole('slider', { name: 'Backing level' }), {
      target: { value: '3' },
    })
    expect(transport.setTrackLevelDb).toHaveBeenLastCalledWith(
      'instrumental',
      3,
    )
    expect(
      within(screen.getByRole('group', { name: 'Vocals track' })).getByText(
        'In mix',
      ),
    ).toBeInTheDocument()
    expect(transport.play).not.toHaveBeenCalled()
  })

  it('keeps Space inside Session and returns focus without starting audio', async () => {
    const transport = createTransport()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))
    const trigger = screen.getByRole('button', { name: 'Session controls' })
    trigger.focus()
    fireEvent.click(trigger)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close Session' })
    fireEvent.keyDown(close, { code: 'Space', key: ' ' })
    expect(transport.play).not.toHaveBeenCalled()
    fireEvent.keyDown(close, { key: 'Escape' })
    await Promise.resolve()
    expect(screen.queryByRole('dialog', { name: 'Session' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('parks spoken transport while either settings overlay is focused', () => {
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
      />
    ))
    expect(activeVoiceCommands().length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Session controls' }))
    expect(activeVoiceCommands()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Close Session' }))
    expect(activeVoiceCommands().length).toBeGreaterThan(0)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open track mixer for Pocket Groove',
      }),
    )
    expect(activeVoiceCommands()).toEqual([])
    fireEvent.click(
      screen.getByRole('button', { name: 'Close the track mixer' }),
    )
    expect(activeVoiceCommands().length).toBeGreaterThan(0)
  })

  // ------------------------------------------------------------
  // The song that is still arriving
  // ------------------------------------------------------------
  //
  // Pressing Play on an uncached demo starts an eight-megabyte download.
  // All the room did was dim the button, which is also what a button that
  // has stopped working looks like.

  it('turns the play button into the download meter', () => {
    const transport = createTransport()
    transport.status = () => 'loading'
    transport.loadProgress = () => ({
      loadedTracks: 0,
      totalTracks: 2,
      receivedBytes: 2_097_152,
      totalBytes: 8_388_608,
      fraction: 0.25,
    })

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const play = screen.getByRole('button', { name: 'Cancel backing start' })
    expect(play).toBeEnabled()
    expect(play).toHaveAttribute('data-loading-percent', '25')
    expect(play).toHaveTextContent('25%')
    // And the footer says what the wait is for, in megabytes.
    expect(screen.getByText('2.0 MB of 8.0 MB')).toBeInTheDocument()
    expect(screen.getByText('Getting the song ready')).toBeInTheDocument()

    fireEvent.click(play)
    expect(transport.pause).toHaveBeenCalledTimes(1)
    expect(transport.play).not.toHaveBeenCalled()
  })

  it('shows a turning ring rather than a percentage nobody stated', () => {
    const transport = createTransport()
    transport.status = () => 'loading'
    // A streamed room, or a server that sent no content-length.
    transport.loadProgress = () => ({
      loadedTracks: 0,
      totalTracks: 2,
      receivedBytes: 0,
      totalBytes: 0,
      fraction: 0,
    })

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const play = screen.getByRole('button', { name: 'Cancel backing start' })
    expect(play).toHaveAttribute('data-loading-percent', '')
    expect(play).not.toHaveTextContent('%')
    expect(screen.getByText('Stem 1 of 2')).toBeInTheDocument()
  })

  it('shows the play icon again the moment the song is ready', () => {
    const transport = createTransport()
    transport.status = () => 'ready'

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const play = screen.getByRole('button', { name: 'Play backing' })
    expect(play).toBeEnabled()
    expect(play).not.toHaveAttribute('data-loading-percent', '0')
    expect(play.querySelector('svg')).not.toBeNull()
  })

  // ============================================================
  // The free-play note
  // ============================================================
  //
  // Reported together: "in the room itself, it says, attach tab to play
  // along, but I don't have any option to attach it afterwards" — from a
  // player who HAD attached one — and "that note needs to be closeable,
  // especially on the mobile. Its hiding half the screen."

  it('names the attached tab instead of asking for one again', () => {
    // The play-along room guides only with a line measured from the
    // recording, so an authored tab really cannot drive it. What was wrong is
    // that the note asked for a tab that was already there and said nothing
    // about where it does play.
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        authoredReference={() => AUTHORED_TAB}
        onRehearseTab={vi.fn()}
      />
    ))

    const note = screen.getByTestId('guitar-night-free-play-note')
    expect(note.textContent).toContain('Velvet pointer study')
    expect(note.textContent).toContain('keeps its own tempo')
    expect(note.textContent).not.toContain('Attach a tab or turn on Listening')
  })

  it('sends the attached tab to the room that can play it', () => {
    const onRehearseTab = vi.fn()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        authoredReference={() => AUTHORED_TAB}
        onRehearseTab={onRehearseTab}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Practice with tab' }))
    expect(onRehearseTab).toHaveBeenCalledTimes(1)
  })

  it('offers to go and get a tab when none is attached', () => {
    const onAttachTab = vi.fn()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        onAttachTab={onAttachTab}
      />
    ))

    const note = screen.getByTestId('guitar-night-free-play-note')
    expect(note.textContent).toContain('Attach a tab or turn on Listening')
    expect(
      screen.queryByRole('button', { name: 'Practice with tab' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Attach a tab' }))
    expect(onAttachTab).toHaveBeenCalledTimes(1)
  })

  it('closes the note, and remembers that it was closed', () => {
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        onAttachTab={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss the free play note' }),
    )
    expect(screen.queryByTestId('guitar-night-free-play-note')).toBeNull()
    // Persisted, not merely hidden: a hint that returns on the next visit is
    // the same complaint again.
    expect(localStorage.getItem(GUITAR_NIGHT_FREE_PLAY_NOTE_KEY)).toContain(
      'true',
    )

    cleanup()
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        onAttachTab={vi.fn()}
      />
    ))
    expect(screen.queryByTestId('guitar-night-free-play-note')).toBeNull()
  })

  it('leaves the note alone while a guide is already up', () => {
    // A measured reference guides the room, so there is nothing to invite.
    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={createTransport()}
        onSongs={vi.fn()}
        reference={() => ({
          ...AUTHORED_TAB,
          kind: 'measured',
          backingSessionId: BACKING.sessionId,
        })}
        onAttachTab={vi.fn()}
      />
    ))

    expect(screen.queryByTestId('guitar-night-free-play-note')).toBeNull()
  })
})
