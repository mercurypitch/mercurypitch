// The session panel is the room's answer to "which part am I being scored on?"
// ============================================================
//
// Reported 2026-08-19: "the guitar night room, doesn't seem to have a easy way
// to change what is being scored against? what track?" Switching existed, but
// only in the lobby, so the answer was "leave the room".

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import { GuitarNightSessionPanel } from './GuitarNightSessionPanel'
import type { GuitarNightReference } from './reference-port'

function reference(trackId = 'track-lead'): GuitarNightReference {
  return {
    kind: 'authored',
    songId: 'velvet-study',
    title: 'Velvet pointer study',
    trackId,
    trackName: trackId === 'track-lead' ? 'Lead guitar' : 'Rhythm guitar',
    tempoBpm: 135,
    tuning: standardTuning('guitar', 6),
    notes: [],
    tracks: [
      { id: 'track-lead', name: 'Lead guitar', noteCount: 412 },
      { id: 'track-rhythm', name: 'Rhythm guitar', noteCount: 388 },
      { id: 'track-bass', name: 'Bass', noteCount: 1 },
    ],
    outOfRangeNotes: 0,
  }
}

describe('GuitarNightSessionPanel', () => {
  afterEach(cleanup)

  it('lists every part in the loaded file with its size', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(screen.getByText('Velvet pointer study')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Lead guitar/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Rhythm guitar/ }),
    ).toBeInTheDocument()
    // Singular counts read as counts, not as "1 notes".
    expect(screen.getByRole('button', { name: /Bass/ }).textContent).toContain(
      '1 note',
    )
    expect(screen.getByText(/3 parts/)).toBeInTheDocument()
  })

  it('says outright which part is being scored', () => {
    // The highlight alone is not an answer to "what am I graded against?".
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference('track-rhythm')}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    const rhythm = screen.getByRole('button', { name: /Rhythm guitar/ })
    expect(rhythm.textContent).toContain('scored')
    expect(rhythm).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Lead guitar/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('hands the chosen part back and does not choose on its own', () => {
    const onSelectTrack = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={onSelectTrack}
        onClose={vi.fn()}
      />
    ))

    expect(onSelectTrack).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Rhythm guitar/ }))
    expect(onSelectTrack).toHaveBeenCalledWith('track-rhythm')
  })

  it('closes on Escape and on the scrim', () => {
    const onClose = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={vi.fn()}
        onClose={onClose}
      />
    ))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('guitar-night-session-scrim'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes on an outside pointer start without swallowing the stage gesture', () => {
    const onClose = vi.fn()
    const onHighwayPointerDown = vi.fn()
    render(() => (
      <>
        <button type="button" onPointerDown={onHighwayPointerDown}>
          Guitar highway
        </button>
        <GuitarNightSessionPanel
          reference={() => reference()}
          onSelectTrack={vi.fn()}
          onClose={onClose}
        />
      </>
    ))

    expect(
      screen.getByRole('button', { name: 'Close the session details' }),
    ).toHaveFocus()
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Guitar highway' }),
    )

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onHighwayPointerDown).toHaveBeenCalledTimes(1)
  })

  it('does not close when the pointer starts inside the dialog', () => {
    const onClose = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={vi.fn()}
        onClose={onClose}
      />
    ))

    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Loaded score' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('explains a single-part file instead of showing a pointless list', () => {
    const single = reference()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => ({
          ...single,
          tracks: [{ id: 'track-lead', name: 'Lead guitar', noteCount: 412 }],
        })}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(screen.getByText(/carries one part/)).toBeInTheDocument()
    expect(screen.getByText(/1 part/)).toBeInTheDocument()
  })

  it('offers no sheet controls when the room has no sheet', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))
    expect(screen.queryByLabelText(/on the sheet/)).toBeNull()
  })

  it('shows which parts the sheet is drawing', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        visibleTrackIds={() => ['track-lead', 'track-rhythm']}
        onToggleTrackVisible={vi.fn()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(
      screen
        .getByLabelText('Hide Rhythm guitar on the sheet')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByLabelText('Show Bass on the sheet')
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('asks to hide or show a part when its control is used', () => {
    const onToggleTrackVisible = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        visibleTrackIds={() => ['track-lead']}
        onToggleTrackVisible={onToggleTrackVisible}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText('Show Bass on the sheet'))
    expect(onToggleTrackVisible).toHaveBeenCalledWith('track-bass')
  })

  it('holds the scored part on the sheet rather than hiding the rule', () => {
    const onToggleTrackVisible = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        visibleTrackIds={() => []}
        onToggleTrackVisible={onToggleTrackVisible}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    const scored = screen.getByLabelText('Hide Lead guitar on the sheet')
    expect(scored).toBeDisabled()
    expect(scored.getAttribute('aria-pressed')).toBe('true')
    expect(scored.getAttribute('title')).toBe(
      'Lead guitar is scored, so it always shows on the sheet',
    )
  })

  it('offers no sound controls when the room has no band', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))
    expect(screen.queryByLabelText(/^Mute /)).toBeNull()
    expect(screen.queryByLabelText(/^Hear /)).toBeNull()
  })

  it('shows which parts are playing under the player', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        audibleTrackIds={() => ['track-rhythm']}
        onToggleTrackAudible={vi.fn()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(
      screen.getByLabelText('Mute Rhythm guitar').getAttribute('aria-pressed'),
    ).toBe('false')
    expect(
      screen.getByLabelText('Unmute Bass').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('asks to mute or hear a part when its control is used', () => {
    const onToggleTrackAudible = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        audibleTrackIds={() => ['track-rhythm']}
        onToggleTrackAudible={onToggleTrackAudible}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByLabelText('Unmute Bass'))
    expect(onToggleTrackAudible).toHaveBeenCalledWith('track-bass')
  })

  it('offers a live solo control for backing parts', () => {
    const onToggleTrackSolo = vi.fn()
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        soloedTrackId={() => 'track-rhythm'}
        onToggleTrackSolo={onToggleTrackSolo}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(
      screen
        .getByLabelText('Turn off solo for Rhythm guitar')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByLabelText('Solo Bass'))
    expect(onToggleTrackSolo).toHaveBeenCalledWith('track-bass')
    expect(screen.getByLabelText('Solo Lead guitar')).toBeDisabled()
  })

  it('reports the scored part rather than owning its sound', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        audibleTrackIds={() => []}
        onToggleTrackAudible={vi.fn()}
        scoredPartSounds={() => false}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    const scored = screen.getByLabelText('Unmute Lead guitar')
    expect(scored).toBeDisabled()
    expect(scored.getAttribute('aria-pressed')).toBe('true')
    expect(scored.getAttribute('title')).toBe(
      'Use Tab sounds to hear or mute Lead guitar',
    )
  })

  it('says what the band is doing when a file has several parts', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        audibleTrackIds={() => ['track-rhythm']}
        onToggleTrackAudible={vi.fn()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))
    expect(screen.getByText(/1 backing part is muted/)).toBeInTheDocument()
  })

  it('distinguishes an underlying mute from a track masked by Solo', () => {
    render(() => (
      <GuitarNightSessionPanel
        reference={() => reference()}
        audibleTrackIds={() => ['track-rhythm']}
        mutedTrackIds={() => ['track-bass']}
        soloedTrackId={() => 'track-rhythm'}
        onToggleTrackAudible={vi.fn()}
        onToggleTrackSolo={vi.fn()}
        onSelectTrack={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    expect(screen.getByLabelText('Mute Rhythm guitar')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText('Unmute Bass')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByText(/Only Rhythm guitar is playing/),
    ).toBeInTheDocument()
  })
})
