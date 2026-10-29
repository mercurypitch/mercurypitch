// The Developer screen's Read my songs again row: a press lets go of First
// note's reads of the singer's own songs, so they are read and logged again.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const again = vi.hoisted(() => vi.fn())

vi.mock('@/features/first-note/first-note-own-songs', () => ({
  readOwnSongsAgain: again,
}))

const { FirstNoteReadPanel } = await import('./FirstNoteReadPanel')

afterEach(() => {
  cleanup()
  again.mockClear()
})

describe('the Read my songs again row', () => {
  it('lets the reads go once pressed, and says so', () => {
    const { container } = render(() => <FirstNoteReadPanel />)
    const row = container.querySelector<HTMLElement>(
      '[data-settings-row="first-note-read-again"]',
    )
    expect(row?.textContent).not.toContain('Done')
    fireEvent.click(row as HTMLElement)
    expect(again).toHaveBeenCalledTimes(1)
    expect(row?.textContent).toContain('Done')
  })
})
