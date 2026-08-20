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

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Close the session details' })[0],
    )
    expect(onClose).toHaveBeenCalledTimes(2)
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
})
