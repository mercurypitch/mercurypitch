// Guitar Night room tests keep controls bound to route-owned transport truth.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { GuitarNightRoom } from './GuitarNightRoom'
import type { GuitarNightBackingLease } from './song-port'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'off'),
  error: vi.fn(() => null),
  notice: vi.fn<() => string | null>(() => null),
  canTakeOverInput: vi.fn(() => false),
  inputTakeoverPending: vi.fn(() => false),
  currentNote: vi.fn(() => null),
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
  start: vi.fn(async () => true),
  useInputHere: vi.fn(async () => true),
  stop: vi.fn(),
  cancel: vi.fn(),
  calibrate: vi.fn(async () => false),
  clearTake: vi.fn(),
  selectInputProfile: vi.fn(async () => undefined),
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
    positionSeconds: () => 0,
    durationSeconds: () => 60,
    playbackRate: () => 1,
    masterVolume: () => masterVolume,
    tracks: () => [],
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
    setTrackMuted: vi.fn(),
    getAudioGraph: vi.fn(() => null),
  }
}

describe('GuitarNightRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listening.status.mockReturnValue('off')
    listening.error.mockReturnValue(null)
    listening.notice.mockReturnValue(null)
    listening.take.mockReturnValue(null)
  })

  afterEach(cleanup)

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
    expect(
      screen.getByTestId('guitar-night-band-panel').closest('details'),
    ).not.toHaveAttribute('open')
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
})
