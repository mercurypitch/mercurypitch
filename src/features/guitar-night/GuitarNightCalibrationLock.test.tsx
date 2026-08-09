// Calibration owns the room clock until its click run is cancelled or complete.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarNightRoom } from './GuitarNightRoom'
import { GuitarNightScoreRoom } from './GuitarNightScoreRoom'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightBackingLease } from './song-port'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'calibrating'),
  error: vi.fn(() => null),
  currentNote: vi.fn(() => null),
  detectedMidi: vi.fn(() => null),
  clarity: vi.fn(() => 0),
  events: vi.fn(() => []),
  observations: vi.fn(() => []),
  timingSource: vi.fn(() => 'audio-clock'),
  latencyMs: vi.fn(() => 0),
  health: vi.fn(() => null),
  start: vi.fn(async () => true),
  stop: vi.fn(),
  calibrate: vi.fn(async () => false),
  clearTake: vi.fn(),
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
}))

vi.mock('./useGuitarListeningController', () => ({
  useGuitarListeningController: () => listening,
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
    scoreRoom.status.mockReturnValue('quiet')
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
})
