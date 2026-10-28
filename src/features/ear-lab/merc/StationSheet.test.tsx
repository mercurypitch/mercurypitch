// A station's sheet: a tap on a row starts that drill, and Wild with no
// songs says how to get one. The native app seeds the Karaoke Night demo
// songs on first boot, so a browser walk never reaches the empty Field
// Book; this file does.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIELD_BOOK_EMPTY } from './merc-lines'
import { StationSheet } from './StationSheet'

afterEach(cleanup)

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
