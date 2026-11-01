// First note's "?" sheet: what a round is, and what a song needs, with the
// rules' own numbers. The sheet says them in words, so the rules stay out of
// the room's load; this holds the two together.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENTRY_GAP_SEC, SHORT_BREATH_SEC } from './entry-rules'
import { OWN_SONG_MIN_ENTRIES } from './first-note-rules'
import { FirstNoteHelp } from './FirstNoteHelp'

afterEach(cleanup)

describe("First note's help", () => {
  it('says what a round is, in its order', () => {
    render(() => <FirstNoteHelp isOpen close={() => undefined} />)
    const sheet = screen.getByTestId('first-note-help-sheet')
    const steps = [...sheet.querySelectorAll('ol li')].map((step) =>
      step.textContent?.replace(/^\d/u, ''),
    )
    expect(steps).toEqual([
      'The band plays a song, without its singer.',
      'It counts in and stops where the singer comes in.',
      "Sing the singer's first note. Any octave counts.",
      'Hold it until it lands in the light, and the song carries on.',
    ])
  })

  it("says what a song needs, with the rules' own numbers", () => {
    render(() => <FirstNoteHelp isOpen close={() => undefined} />)
    const sheet = screen.getByTestId('first-note-help-sheet')
    expect(sheet.textContent).toContain(`${ENTRY_GAP_SEC} seconds or more`)
    expect(screen.getByTestId('first-note-help-few').textContent).toContain(
      `at least ${OWN_SONG_MIN_ENTRIES} such places`,
    )
    expect(screen.getByTestId('first-note-help-few').textContent).toContain(
      `${SHORT_BREATH_SEC} seconds or more`,
    )
  })

  it('closes from its close button', () => {
    const close = vi.fn()
    render(() => <FirstNoteHelp isOpen close={close} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(close).toHaveBeenCalledTimes(1)
  })
})
