// A station's sheet: a tap on a row starts that drill, and Wild with no
// songs says how to get one. The native app seeds the Karaoke Night demo
// songs on first boot, so a browser walk never reaches the empty Field
// Book; this file does. Where a drill here can be sung, the sheet asks
// Tap or Sing or play before the run, and the rows to be sung say so.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FacultyId } from '@/lib/ear/drills'
import { earAnswerMode, homeAnswerMode, resetEarLabStore, setEarAnswerMode, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { voiceLine } from './answer-choice'
import { FIELD_BOOK_EMPTY } from './merc-lines'
import { StationSheet } from './StationSheet'

afterEach(cleanup)

function sheet(faculty: FacultyId): void {
  render(() => (
    <StationSheet
      faculty={faculty}
      lit={null}
      onStart={() => undefined}
      onOpenFieldBook={() => undefined}
      onClose={() => undefined}
    />
  ))
}

describe('the station sheet', () => {
  it('starts the drill a row names, with no Start pinned under the list', () => {
    const onStart = vi.fn()
    render(() => (
      <StationSheet
        faculty="function"
        lit={null}
        onStart={onStart}
        onOpenFieldBook={() => undefined}
        onClose={() => undefined}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: /^Start Gravity:/u }))
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'gravity' }),
    )
    // One Start per instrument, each its own row, and none besides.
    expect(screen.getAllByRole('button', { name: /^Start/u })).toHaveLength(3)
  })

  it('says how to get a song when the Field Book has none', () => {
    render(() => (
      <StationSheet
        faculty="wild"
        lit={null}
        onStart={() => undefined}
        onOpenFieldBook={() => undefined}
        onClose={() => undefined}
      />
    ))
    expect(screen.getByTestId('merc-field-book-empty').textContent).toBe(
      FIELD_BOOK_EMPTY,
    )
    expect(
      screen.getByRole('button', { name: 'Open the Karaoke room' }),
    ).toBeTruthy()
  })
})

describe('tap or sing, on the sheet before the run', () => {
  beforeEach(() => {
    localStorage.clear()
    resetEarLabStore()
    setHomeAnswerMode('tap')
  })

  it('asks where a drill here can be sung, names which, and remembers', () => {
    sheet('shape')
    const voice = screen.getByTestId('merc-station-voice')
    const tap = within(voice).getByRole('radio', { name: 'Tap' })
    expect(tap.getAttribute('aria-checked')).toBe('true')
    expect(voice.textContent).toContain(
      'Echo and Span take your voice. Leap and Contour stay tapped.',
    )

    fireEvent.click(within(voice).getByRole('radio', { name: 'Sing or play' }))
    expect(earAnswerMode('echo')).toBe('mic')
    expect(earAnswerMode('span')).toBe('mic')
    // The rows to be sung say so, in their own words, and start on a mic;
    // the rest are tapped.
    expect(
      screen.getByRole('button', {
        name: /^Start Echo, sung: Sing the phrase back\./u,
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Start Span, sung:/u }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Start Leap:/u })).toBeTruthy()
  })

  it("sets Home's choice, which Gravity shares", () => {
    sheet('function')
    const voice = screen.getByTestId('merc-station-voice')
    expect(voice.textContent).toContain(
      'Home and Gravity take your voice. The Pull stays tapped.',
    )
    fireEvent.click(within(voice).getByRole('radio', { name: 'Sing or play' }))
    expect(homeAnswerMode()).toBe('mic')
    expect(
      screen.getByRole('button', { name: /^Start Gravity, sung:/u }),
    ).toBeTruthy()
  })

  it('checks neither while the drills it sets differ', () => {
    setEarAnswerMode('echo', 'mic')
    sheet('shape')
    const voice = screen.getByTestId('merc-station-voice')
    for (const radio of within(voice).getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false')
    }
    expect(
      screen.getByRole('button', { name: /^Start Echo, sung:/u }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Start Span:/u })).toBeTruthy()
  })

  it('asks nothing where nothing can be sung, or no song is listed', () => {
    sheet('resolution')
    expect(screen.queryByTestId('merc-station-voice')).toBeNull()
    cleanup()
    sheet('wild')
    expect(screen.queryByTestId('merc-station-voice')).toBeNull()
  })

  it('names the Wild its own drill', () => {
    expect(voiceLine('wild')).toBe('Echo in the Wild takes your voice.')
  })
})
