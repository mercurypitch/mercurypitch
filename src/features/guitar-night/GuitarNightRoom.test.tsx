// Guitar Night room tests keep controls bound to route-owned transport truth.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
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
    // The free-play note persists its dismissal, so without this the tests
    // after the dismissal one would pass because nothing rendered at all.
    localStorage.clear()
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

  // "Backing" — an eight-letter word — ran past the right edge of its own
  // card on the owner's iPhone, because the speaker icon, the name and the
  // state all shared one line. The name now owns the first line and the icon
  // plus its state read as a caption underneath.
  it('gives each stem card its name on the first line', () => {
    const transport = createTransport()
    transport.tracks = () => [
      { id: 'vocal', label: 'Vocals', muted: false, available: true, level: 1 },
      {
        id: 'instrumental',
        label: 'Backing',
        muted: true,
        available: true,
        level: 1,
      },
    ]

    render(() => (
      <GuitarNightRoom
        backing={BACKING}
        transport={transport}
        onSongs={vi.fn()}
      />
    ))

    const backing = screen.getByRole('button', { name: 'Backing muted' })
    const parts = [...backing.children].map((child) => child.tagName)
    expect(parts).toEqual(['STRONG', 'SPAN', 'SMALL'])
    expect(backing.querySelector('strong')).toHaveTextContent('Backing')
    expect(backing.querySelector('small')).toHaveTextContent('Muted')

    const vocals = screen.getByRole('button', { name: 'Vocals on' })
    expect(vocals.querySelector('small')).toHaveTextContent('In mix')
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

    const play = screen.getByRole('button', { name: 'Starting backing' })
    expect(play).toBeDisabled()
    expect(play).toHaveAttribute('data-loading-percent', '25')
    expect(play).toHaveTextContent('25%')
    // And the footer says what the wait is for, in megabytes.
    expect(screen.getByText('2.0 MB of 8.0 MB')).toBeInTheDocument()
    expect(screen.getByText('Getting the song ready')).toBeInTheDocument()
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

    const play = screen.getByRole('button', { name: 'Starting backing' })
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

    fireEvent.click(screen.getByRole('button', { name: 'Rehearse the tab' }))
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
      screen.queryByRole('button', { name: 'Rehearse the tab' }),
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
