// The tab room must open silent, on the tab's own terms, with no recording.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activeVoiceCommands } from '@/features/voice-control/voice-command-registry'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import { GuitarNightScoreRoom, nextScoreCountIn, scoreAssessmentRange, scoreLiveRange, scoreLoopPendingRestart, scoreResultIsSettling, scoreVoiceTransportIsPlaying, } from './GuitarNightScoreRoom'
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
  afterEach(() => {
    cleanup()
    globalThis.localStorage.clear()
  })

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
    const deck = within(screen.getByTestId('guitar-night-score-deck'))
    expect(deck.getByLabelText('Tempo 90 BPM')).toBeTruthy()
    expect(deck.getByLabelText('Rehearsal mix volume')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Listening is off. Switch to Room mic',
      }),
    ).toBeTruthy()
    expect(screen.getByText('Score clock')).toBeTruthy()
    expect(
      screen.queryByText('Authored score clock · no recording attached'),
    ).toBeNull()
  })

  it('keeps mobile Session tempo and volume on the same rehearsal controls', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    const summary = screen.getByLabelText('Session controls')
    fireEvent.click(summary)
    const details = summary.closest('details')
    expect(details).toBeTruthy()
    if (details === null) return

    const session = within(details)
    const deck = within(screen.getByTestId('guitar-night-score-deck'))
    const sessionVolume = session.getByLabelText('Session rehearsal mix volume')
    fireEvent.input(sessionVolume, { target: { value: '0.42' } })

    expect(sessionVolume).toHaveValue('0.42')
    expect(deck.getByLabelText('Rehearsal mix volume')).toHaveValue('0.42')

    fireEvent.click(
      session.getByRole('button', { name: 'Slow down from 90 BPM' }),
    )
    expect(session.getByLabelText('Tempo 86 BPM')).toBeInTheDocument()
    expect(deck.getByLabelText('Tempo 86 BPM')).toBeInTheDocument()
  })

  it('sets zero-safe A/B marks beside the rail and clears them again', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    const deck = within(screen.getByTestId('guitar-night-score-deck'))
    const loop = deck.getByRole('group', { name: 'Section loop' })
    fireEvent.click(within(loop).getByRole('button', { name: 'A' }))
    fireEvent.click(within(loop).getByRole('button', { name: 'B' }))

    expect(deck.getByLabelText('Loop start marker')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(deck.getByLabelText('Loop end marker')).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    fireEvent.click(within(loop).getByRole('button', { name: 'Clear' }))
    expect(deck.queryByLabelText('Loop start marker')).toBeNull()
    expect(deck.queryByLabelText('Loop end marker')).toBeNull()
  })

  it('registers the useful hands-free Rehearse commands', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    const ids = new Set(activeVoiceCommands().map((command) => command.id))
    expect(ids).toContain('guitarNight.score.play')
    expect(ids).toContain('guitarNight.score.loopSetA')
    expect(ids).toContain('guitarNight.score.loopSetB')
    expect(ids).toContain('guitarNight.score.clickToggle')
    expect(ids).toContain('guitarNight.score.listeningToggle')
    expect(ids).toContain('guitarNight.score.showScore')
  })

  it('opens an honest empty Score sheet before the first take', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    expect(screen.getByRole('dialog', { name: 'Score' })).toBeInTheDocument()
    expect(screen.getByText('No scored take yet')).toBeInTheDocument()
  })

  it('keeps modal ownership exclusive and pauses voice commands behind it', () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    fireEvent.click(screen.getByTestId('guitar-night-session-trigger'))
    expect(
      screen.getByRole('dialog', { name: 'Loaded score' }),
    ).toBeInTheDocument()
    expect(
      activeVoiceCommands()
        .find((command) => command.id === 'guitarNight.score.play')
        ?.available?.(),
    ).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Open score' }))
    expect(screen.queryByRole('dialog', { name: 'Loaded score' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Score' })).toBeInTheDocument()
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
    const countIn = summary
      .closest('details')
      ?.querySelector<HTMLButtonElement>('button[aria-label^="Count-in"]')
    expect(countIn).toBeTruthy()
    if (countIn === undefined || countIn === null) return
    countIn.focus()

    fireEvent.keyDown(countIn, { key: 'Escape' })
    await Promise.resolve()

    expect(summary.closest('details')?.open).toBe(false)
    expect(document.activeElement).toBe(summary)
  })

  it('opens Tune without starting the score clock and restores its trigger', async () => {
    render(() => (
      <GuitarNightScoreRoom reference={() => VELVET_RIFF} onSongs={vi.fn()} />
    ))

    const tune = screen.getByRole('button', { name: 'Tune guitar' })
    fireEvent.click(tune)

    expect(
      screen.getByRole('dialog', { name: 'Tune before the room.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start listening' }),
    ).toBeEnabled()

    fireEvent.keyDown(document, {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    expect(
      screen.getByText('Press Play or Space to start the count-in'),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()
    expect(screen.queryByTestId('guitar-night-tuner')).toBeNull()
    expect(document.activeElement).toBe(tune)
  })

  it('parks the embedded tuner and releases Space while a room sheet is open', async () => {
    const [suspended, setSuspended] = createSignal(false)
    render(() => (
      <GuitarNightScoreRoom
        reference={() => VELVET_RIFF}
        suspended={suspended}
        onSongs={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Tune guitar' }))
    expect(screen.getByTestId('guitar-night-tuner')).toBeInTheDocument()

    setSuspended(true)
    await Promise.resolve()
    expect(screen.queryByTestId('guitar-night-tuner')).toBeNull()

    const space = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(false)
    expect(
      screen.getByText('Press Play or Space to start the count-in'),
    ).toBeInTheDocument()
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

describe('nextScoreCountIn', () => {
  it('cycles Off, 1, 2 and 4 beats without a dropdown', () => {
    expect(nextScoreCountIn(0)).toBe(1)
    expect(nextScoreCountIn(1)).toBe(2)
    expect(nextScoreCountIn(2)).toBe(4)
    expect(nextScoreCountIn(4)).toBe(0)
    expect(nextScoreCountIn(8)).toBe(0)
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

describe('scoreLiveRange', () => {
  it('scores one explicit loop pass on whole-beat boundaries', () => {
    expect(scoreLiveRange({ start: 1.2, end: 5.7 }, 3, 12)).toEqual({
      start: 1,
      end: 6,
    })
  })

  it('continues from an exact parked beat through the score end', () => {
    expect(scoreLiveRange(null, 2.4, 12)).toEqual({ start: 2.4, end: 12 })
  })

  it('replays from the beginning when parked at the score end', () => {
    expect(scoreLiveRange(null, 12, 12)).toEqual({ start: 0, end: 12 })
  })

  it('replays instead of opening an empty take after the final onset', () => {
    expect(scoreLiveRange(null, 11.5, 12, [0, 4, 8])).toEqual({
      start: 0,
      end: 12,
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

describe('scoreResultIsSettling', () => {
  it('holds result actions only during the completed take settle window', () => {
    expect(scoreResultIsSettling('complete', true)).toBe(true)
    expect(scoreResultIsSettling('playing', true)).toBe(false)
    expect(scoreResultIsSettling('complete', false)).toBe(false)
  })
})

describe('scoreVoiceTransportIsPlaying', () => {
  it('treats async room startup as active transport for honest voice feedback', () => {
    expect(scoreVoiceTransportIsPlaying('starting')).toBe(true)
    expect(scoreVoiceTransportIsPlaying('count-in')).toBe(true)
    expect(scoreVoiceTransportIsPlaying('playing')).toBe(true)
    expect(scoreVoiceTransportIsPlaying('paused')).toBe(false)
    expect(scoreVoiceTransportIsPlaying('quiet')).toBe(false)
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
