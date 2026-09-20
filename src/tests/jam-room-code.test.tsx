// ============================================================
// The room code is the button that copies the way in
// ============================================================
//
// Owner request, 2026-09-20: the header carried a pill with the room's code
// and a "Copy link" button beside it -- one fact, said twice, in the row of
// the room with the least width to spare. Now the code is the label and a
// press copies the link; the invite dialog still offers the two apart.
//
// What these pin is that it is honest: it copies the address that unfurls
// with the Jam card, and it says "copied" only when the clipboard took it.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamRoomCode } from '@/components/jam/JamRoomCode'
import { jamRoomLink } from '@/lib/jam/jam-room-link'

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  vi.useFakeTimers()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Let the clipboard's promise settle without running the 2 s timer. */
const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('jamRoomLink', () => {
  it('opens the room on the path that serves the Jam card', () => {
    expect(jamRoomLink('LUNAR7', 'https://mercurypitch.com')).toBe(
      'https://mercurypitch.com/jam#/jam:LUNAR7',
    )
  })

  it('uses the origin the app is served from', () => {
    expect(jamRoomLink('LUNAR7')).toBe(
      `${window.location.origin}/jam#/jam:LUNAR7`,
    )
  })
})

describe('JamRoomCode', () => {
  it('shows the code, on a button that says what a press does', () => {
    const { getByTestId } = render(() => <JamRoomCode roomId="LUNAR7" />)
    const button = getByTestId('jam-room-code')

    expect(button.tagName).toBe('BUTTON')
    // The code stays readable: it is what people say aloud.
    expect(button.textContent).toContain('LUNAR7')
    expect(button.getAttribute('aria-label')).toBe(
      'Room code LUNAR7. Copy the link to this room.',
    )
    // The mark that says "this copies", drawn rather than typed.
    expect(button.querySelector('svg')).not.toBeNull()
  })

  it('copies the link to the room, not the bare code', async () => {
    const { getByTestId } = render(() => <JamRoomCode roomId="LUNAR7" />)

    fireEvent.click(getByTestId('jam-room-code'))
    await settle()

    expect(writeText).toHaveBeenCalledExactlyOnceWith(jamRoomLink('LUNAR7'))
  })

  it('says so once the clipboard has it, and stops saying so', async () => {
    const { getByTestId, getByRole } = render(() => (
      <JamRoomCode roomId="LUNAR7" />
    ))
    const button = getByTestId('jam-room-code')
    expect(getByRole('status').textContent).toBe('')

    fireEvent.click(button)
    await settle()

    expect(button).toHaveAttribute('data-copied')
    expect(getByRole('status').textContent).toBe('Link copied')
    // Still the code: "Copied" must not replace the thing people read out.
    expect(button.textContent).toContain('LUNAR7')

    vi.advanceTimersByTime(2000)
    expect(button).not.toHaveAttribute('data-copied')
    expect(getByRole('status').textContent).toBe('')
  })

  it('claims nothing when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'))
    const { getByTestId, getByRole } = render(() => (
      <JamRoomCode roomId="LUNAR7" />
    ))

    fireEvent.click(getByTestId('jam-room-code'))
    await settle()

    expect(getByTestId('jam-room-code')).not.toHaveAttribute('data-copied')
    expect(getByRole('status').textContent).toBe('')
  })

  it('is told apart from the sidebar’s copy of itself', () => {
    // With the sidebar open both are on screen, and a test (or a tour) that
    // asks for "the room code" has to get one answer.
    const { getByTestId } = render(() => (
      <>
        <JamRoomCode roomId="LUNAR7" />
        <JamRoomCode roomId="LUNAR7" skin="card" />
      </>
    ))

    expect(getByTestId('jam-room-code')).not.toBe(
      getByTestId('jam-room-code-card'),
    )
  })

  it('draws the note from the page, where no row can cover it', async () => {
    // Owner report, 2026-09-20: the note hung under the pill from inside
    // the header, and the playback row below is a later layer -- it was
    // painted over. A z-index could not help: it only orders the header's
    // own children.
    // `screen`, not the render's own queries: those look inside the
    // component's container, and the point is that the note is not in it.
    const { getByTestId } = render(() => <JamRoomCode roomId="LUNAR7" />)
    const button = getByTestId('jam-room-code')
    expect(screen.queryByTestId('jam-room-code-note')).toBeNull()

    fireEvent.click(button)
    await settle()

    const note = screen.getByTestId('jam-room-code-note')
    expect(note.textContent).toBe('Link copied')
    expect(button.contains(note)).toBe(false)
    expect(document.body.contains(note)).toBe(true)
    // Said once: the one people see is not the one that is read out.
    expect(note).toHaveAttribute('aria-hidden', 'true')
    expect(note.style.left).toMatch(/px$/)
    expect(note.style.top).toMatch(/px$/)

    vi.advanceTimersByTime(2000)
    expect(screen.queryByTestId('jam-room-code-note')).toBeNull()
  })

  it('takes the note away with the pill', async () => {
    // Leaving the room inside the two seconds must not strand it on the
    // next screen.
    const { getByTestId, unmount } = render(() => (
      <JamRoomCode roomId="LUNAR7" />
    ))
    fireEvent.click(getByTestId('jam-room-code'))
    await settle()
    expect(screen.queryByTestId('jam-room-code-note')).not.toBeNull()

    unmount()
    expect(screen.queryByTestId('jam-room-code-note')).toBeNull()
  })

  it('survives a browser with no clipboard at all', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const { getByTestId } = render(() => <JamRoomCode roomId="LUNAR7" />)

    expect(() => fireEvent.click(getByTestId('jam-room-code'))).not.toThrow()
  })
})

describe('the room header', () => {
  const repo = resolve(__dirname, '../..')
  const read = (file: string): string =>
    readFileSync(resolve(repo, file), 'utf8')

  it('has one control for the code and the link, not two', () => {
    const panel = read('src/components/jam/JamPanel.tsx')
    expect(panel).toContain('<JamRoomCode')
    expect(panel).not.toContain('Copy link')

    const rail = read('src/features/sidebar/panels/JamRoomPanel.tsx')
    expect(rail).toContain('<JamRoomCode')
    expect(rail).not.toContain('Copy link')
  })

  it('puts the note on the layer of the app’s other floating notes', () => {
    const css = read('src/components/jam/JamRoomCode.module.css').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const toast = /\.toast \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(toast).toContain('position: fixed')
    expect(toast).toContain('z-index: 9000')
    // It must never take a press meant for what is under it.
    expect(toast).toContain('pointer-events: none')
  })

  it('keeps the hover look for a mouse', () => {
    // A tablet leaves :hover on the last thing tapped, so an ungated hover
    // rule would leave the pill lit after every copy.
    const css = read('src/components/jam/JamRoomCode.module.css').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const gated = css.slice(css.indexOf('@media (hover: hover)'))
    const before = css.slice(0, css.indexOf('@media (hover: hover)'))
    expect(gated).toContain('.code:hover')
    expect(before).not.toContain(':hover')
  })
})
