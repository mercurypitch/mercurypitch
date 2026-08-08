// The tab room must open silent, on the tab's own terms, with no recording.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import { GuitarNightScoreRoom } from './GuitarNightScoreRoom'
import type { GuitarNightReference } from './reference-port'

const VELVET_RIFF: GuitarNightReference = {
  kind: 'authored',
  songId: 'gsong-1',
  title: 'Velvet Riff',
  trackId: 'track-lead',
  trackName: 'Lead guitar',
  tempoBpm: 90,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'track-lead', name: 'Lead guitar', noteCount: 1 }],
  notes: [
    {
      id: 'n1',
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

describe('GuitarNightScoreRoom', () => {
  afterEach(cleanup)

  it('opens silent, naming the tab and its own clock', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    expect(screen.getByTestId('guitar-night-score-room')).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Velvet Riff' }),
    ).toBeTruthy()
    // Nothing has started, and the surface says how to start it.
    expect(
      screen.getByText('Press Play or Space to start the count-in'),
    ).toBeTruthy()
    expect(screen.getByLabelText('Start the count-in')).toBeTruthy()
    // The tab's authored tempo, unaltered.
    expect(screen.getByLabelText('Tempo 90 BPM')).toBeTruthy()
  })

  it('offers the instrument picker in every view, not just the tab', () => {
    render(() => (
      <GuitarNightScoreRoom
        reference={() => ({ ...VELVET_RIFF, tuning: DEFAULT_BASS_TUNING })}
        tuning={() => DEFAULT_BASS_TUNING}
        onInstrument={vi.fn()}
        onStringCount={vi.fn()}
        onSongs={vi.fn()}
      />
    ))

    // The picker is only offered when the host can act on it.
    expect(screen.getByLabelText('Instrument shown')).toBeTruthy()
    expect(screen.getByLabelText('Strings')).toBeTruthy()
  })

  it('offers no instrument picker without handlers for it', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    expect(screen.queryByLabelText('Instrument shown')).toBeNull()
  })
})
