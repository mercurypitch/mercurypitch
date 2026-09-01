// Guitar Night room mute handlers must never mistake Solo masking for retained M state.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as GuitarRoomBandModule from '@/features/guitar/backing/guitar-room-band'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { GuitarNightPercussionRoom } from './GuitarNightPercussionRoom'
import { GuitarNightScoreRoom } from './GuitarNightScoreRoom'
import type { GuitarNightReference } from './reference-port'

const bandSpies = vi.hoisted(() => ({
  setPercussionTrackAudible: vi.fn(),
}))

vi.mock(
  '@/features/guitar/backing/guitar-room-band',
  async (importOriginal) => {
    const actual = await importOriginal<typeof GuitarRoomBandModule>()
    return {
      ...actual,
      createGuitarRoomBand: () => ({
        activate: vi.fn(async () => null),
        dispose: vi.fn(async () => undefined),
        getAudioGraph: () => null,
        setMasterLevel: vi.fn(),
        setMelodyChannelLevel: vi.fn(),
        setPercussionTrackAudible: bandSpies.setPercussionTrackAudible,
        start: vi.fn(async () => ({
          completedAtSeconds: null,
          exerciseStartedAtSeconds: null,
          expectedHitTimesMs: [],
        })),
        stop: vi.fn(),
      }),
    }
  },
)

const TRACK_A = 'track-drums-a'
const TRACK_B = 'track-drums-b'
const PERCUSSION_TRACKS: GuitarNightReference['tracks'] = [
  {
    id: TRACK_A,
    name: 'Drums A',
    kind: 'percussion',
    hitCount: 1,
    supportedHitCount: 1,
    droppedHitCount: 0,
  },
  {
    id: TRACK_B,
    name: 'Drums B',
    kind: 'percussion',
    hitCount: 1,
    supportedHitCount: 1,
    droppedHitCount: 0,
  },
]
const PERCUSSION_HITS = [
  { trackId: TRACK_A, gmKey: 36, startBeat: 0, velocity: 100 },
  { trackId: TRACK_B, gmKey: 38, startBeat: 1, velocity: 96 },
] as const

const backingOnlyReference: GuitarNightReference = {
  kind: 'authored',
  scoreMode: 'backing-only',
  songId: 'drum-room',
  title: 'Two drum room',
  trackId: '',
  trackName: 'No scored part',
  tempoBpm: 100,
  tuning: DEFAULT_GUITAR_TUNING,
  notes: [],
  tracks: PERCUSSION_TRACKS,
  outOfRangeNotes: 0,
}

const scoredReference: GuitarNightReference = {
  ...backingOnlyReference,
  scoreMode: 'pitched',
  songId: 'score-room',
  title: 'Lead with two drums',
  trackId: 'track-lead',
  trackName: 'Lead guitar',
  tracks: [
    { id: 'track-lead', name: 'Lead guitar', noteCount: 1 },
    ...PERCUSSION_TRACKS,
  ],
  notes: [
    {
      id: 'lead-1',
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

function expectMaskedBClickKeepsGateClosed(): void {
  fireEvent.click(screen.getByTestId('guitar-night-session-trigger'))
  bandSpies.setPercussionTrackAudible.mockClear()
  fireEvent.click(screen.getByLabelText('Mute Drums B'))
  expect(bandSpies.setPercussionTrackAudible).toHaveBeenLastCalledWith(
    TRACK_B,
    false,
  )
}

describe('Guitar Night percussion mute handlers', () => {
  afterEach(() => {
    cleanup()
    bandSpies.setPercussionTrackAudible.mockClear()
    globalThis.localStorage.clear()
  })

  it('keeps masked B closed in the backing-only percussion room', () => {
    render(() => (
      <GuitarNightPercussionRoom
        reference={() => backingOnlyReference}
        onSongs={vi.fn()}
        sheetLanes={() => []}
        sheetVisibleTrackIds={() => [TRACK_A, TRACK_B]}
        onToggleSheetTrack={vi.fn()}
        backingPercussion={() => PERCUSSION_HITS}
        audibleBackingTrackIds={() => [TRACK_A]}
        mutedBackingTrackIds={() => []}
        onToggleBackingTrack={vi.fn()}
        soloedBackingTrackId={() => TRACK_A}
        onToggleSoloBackingTrack={vi.fn()}
      />
    ))

    expectMaskedBClickKeepsGateClosed()
  })

  it('keeps masked B closed in the scored room', () => {
    render(() => (
      <GuitarNightScoreRoom
        reference={() => scoredReference}
        onSongs={vi.fn()}
        backingPercussion={() => PERCUSSION_HITS}
        audibleBackingTrackIds={() => [TRACK_A]}
        mutedBackingTrackIds={() => []}
        onToggleBackingTrack={vi.fn()}
        soloedBackingTrackId={() => TRACK_A}
        onToggleSoloBackingTrack={vi.fn()}
      />
    ))

    expectMaskedBClickKeepsGateClosed()
  })
})
