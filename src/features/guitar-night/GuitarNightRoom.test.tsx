// Guitar Night room tests keep controls bound to route-owned transport truth.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import { GuitarNightRoom } from './GuitarNightRoom'
import type { GuitarNightBackingLease } from './song-port'

const listening = vi.hoisted(() => ({
  status: vi.fn(() => 'off'),
  error: vi.fn(() => null),
  currentNote: vi.fn(() => null),
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
  afterEach(cleanup)

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
})
