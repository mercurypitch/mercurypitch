// The tab room must open silent, on the tab's own terms, with no recording.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import { GuitarNightScoreRoom, scoreAssessmentRange, scoreLoopPendingRestart, } from './GuitarNightScoreRoom'
import { GuitarNightStage } from './GuitarNightStage'
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

  it('returns focus to Session when Escape closes its controls', async () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    const summary = screen.getByLabelText('Session controls')
    fireEvent.click(summary)
    const countIn = screen.getByLabelText('Count-in beats')
    countIn.focus()

    fireEvent.keyDown(countIn, { key: 'Escape' })
    await Promise.resolve()

    expect(summary.closest('details')?.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })

  it('keeps phrase review inside the compact Session layer', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    fireEvent.click(screen.getByLabelText('Session controls'))
    expect(
      screen.getByRole('button', {
        name: 'Review beat 1 for 1 beat',
      }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Count in, then play the next written range without the guide.',
      ),
    ).toBeTruthy()
  })
})

describe('scoreAssessmentRange', () => {
  it('uses quantized A/B marks as the explicit one-pass range', () => {
    expect(
      scoreAssessmentRange({ start: 1.2, end: 5.7 }, 0, 12, [0, 4, 8]),
    ).toEqual({ start: 1, end: 6 })
  })

  it('starts a four-beat range at the next authored note', () => {
    expect(scoreAssessmentRange(null, 2.4, 12, [0, 4.5, 9])).toEqual({
      start: 4,
      end: 8,
    })
  })

  it('backs up from the score end instead of creating a zero-length review', () => {
    expect(scoreAssessmentRange(null, 7.95, 8, [0, 4])).toEqual({
      start: 4,
      end: 8,
    })
  })
})

describe('scoreLoopPendingRestart', () => {
  it('compares the whole-beat loop the scheduler actually receives', () => {
    expect(
      scoreLoopPendingRestart(
        { start: 1.2, end: 4.8 },
        { start: 1, end: 5 },
        true,
      ),
    ).toBe(false)
  })

  it('reports clearing an already scheduled loop as a next-take change', () => {
    expect(scoreLoopPendingRestart(null, { start: 1, end: 5 }, true)).toBe(true)
    expect(scoreLoopPendingRestart(null, { start: 1, end: 5 }, false)).toBe(
      false,
    )
  })
})

describe('scheduled score setup', () => {
  it('keeps instrument controls visible but inert during a pinned take', () => {
    render(() => (
      <GuitarNightStage
        source={{
          title: () => VELVET_RIFF.title,
          notes: () => VELVET_RIFF.notes,
          timeline: {
            positionSeconds: () => 0,
            durationSeconds: () => 1,
            playheadBeat: () => null,
            tempoBpm: () => 90,
          },
        }}
        tuning={() => DEFAULT_GUITAR_TUNING}
        onInstrument={vi.fn()}
        onStringCount={vi.fn()}
        instrumentSetupDisabled={() => true}
        active={() => true}
        initialMode="tab"
      />
    ))

    const setup = screen.getByText('6-string guitar')
    expect(setup.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(setup)
    expect(setup.closest('details')?.open).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Guitar', hidden: true }),
    ).toBeDisabled()
    expect(
      screen.getByLabelText('Strings', { selector: 'select' }),
    ).toBeDisabled()
  })
})
