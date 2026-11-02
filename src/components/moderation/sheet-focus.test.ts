// ============================================================
// Where the focus goes when the singer sheet closes
// ============================================================
//
// sheet-focus.ts against a board drawn by hand: the opener while it stands,
// else the "..." at its place, else the one before, else the heading; and,
// for a while after, back to the board through a redraw that took the
// focused "..." with it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { landingFor, openerOf, RETURN_WATCH_MS, returnFocus, stopReturningFocus, } from './sheet-focus'

/** A board of "..." buttons, one a singer, under a heading outside it. */
function drawBoard(singers: string[], name = 'standings'): HTMLElement {
  let board = document.querySelector<HTMLElement>(`[data-singer-board]`)
  if (board === null) {
    const heading = document.createElement('h2')
    heading.tabIndex = -1
    heading.dataset.singerBoardHeading = `${name} other-board`
    heading.textContent = 'Your league'
    board = document.createElement('div')
    board.dataset.singerBoard = name
    document.body.append(heading, board)
  }
  board.replaceChildren(
    ...singers.map((singer) => {
      const button = document.createElement('button')
      button.dataset.singerMore = singer
      button.textContent = `More about ${singer}`
      return button
    }),
  )
  return board
}

const more = (singer: string): HTMLElement =>
  document.querySelector<HTMLElement>(
    `[data-singer-more="${singer}"]`,
  ) as HTMLElement

const heading = (): HTMLElement =>
  document.querySelector<HTMLElement>('h2') as HTMLElement

/** MutationObserver callbacks are microtasks. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(() => {
  stopReturningFocus()
  vi.useRealTimers()
})

describe('where the focus lands', () => {
  it('is the opener while it is on the page', () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('ben'))

    expect(opener).toMatchObject({ boardName: 'standings', index: 1 })
    expect(landingFor(opener)).toBe(more('ben'))
  })

  it('is the "..." now at the opener’s place once its row has gone', () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('ben'))

    drawBoard(['ada', 'cleo'])

    expect(landingFor(opener)).toBe(more('cleo'))
  })

  it('is the one before it when the opener’s row was the last', () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('cleo'))

    drawBoard(['ada', 'ben'])

    expect(landingFor(opener)).toBe(more('ben'))
  })

  it('is the board’s heading once no "..." is left', () => {
    drawBoard(['ada'])
    const opener = openerOf(more('ada'))

    drawBoard([])

    expect(landingFor(opener)).toBe(heading())
  })

  it('finds the board drawn in place of the one pressed on', () => {
    const first = drawBoard(['ada', 'ben'])
    const opener = openerOf(more('ben'))
    first.remove()
    const again = document.createElement('div')
    again.dataset.singerBoard = 'standings'
    document.body.append(again)

    drawBoard(['ada', 'cleo'])

    expect(landingFor(opener)).toBe(more('cleo'))
  })

  it('is nowhere for a "..." on no board, once it has gone', () => {
    const loose = document.createElement('button')
    loose.dataset.singerMore = 'ada'
    document.body.append(loose)
    const opener = openerOf(loose)

    loose.remove()

    expect(opener.boardName).toBeNull()
    expect(landingFor(opener)).toBeNull()
  })
})

describe('giving the focus back', () => {
  it('lands at once, and comes back through a redraw that took the focused "..."', async () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('ben'))
    drawBoard(['ada', 'cleo'])

    returnFocus(opener)
    expect(document.activeElement).toBe(more('cleo'))

    // The board's read lands: every row drawn anew.
    drawBoard(['ada', 'cleo'])
    await settle()

    expect(document.activeElement).toBe(more('cleo'))
  })

  it('moves on from the heading to a "..." once the rows are back', async () => {
    drawBoard(['ada', 'ben'])
    const opener = openerOf(more('ben'))
    drawBoard([])

    returnFocus(opener)
    expect(document.activeElement).toBe(heading())

    drawBoard(['ada', 'cleo'])
    await settle()

    expect(document.activeElement).toBe(more('cleo'))
  })

  it('leaves the focus where the singer has put it since', async () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('ben'))
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    returnFocus(opener)

    elsewhere.focus()
    drawBoard(['ada', 'cleo'])
    await settle()

    expect(document.activeElement).toBe(elsewhere)
    // And the while is over: a later redraw moves nothing.
    elsewhere.remove()
    drawBoard(['ada', 'cleo'])
    await settle()
    expect(document.activeElement).toBe(document.body)
  })

  it('stops at a press on the page, which leaves the focus there', async () => {
    drawBoard(['ada', 'ben', 'cleo'])
    returnFocus(openerOf(more('ben')))
    const words = document.createElement('p')
    document.body.append(words)

    words.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    more('ben').blur()
    drawBoard(['ada', 'cleo'])
    await settle()

    expect(document.activeElement).toBe(document.body)
  })

  it('waits out a sheet opened over the board, and lands when it closes', async () => {
    drawBoard(['ada', 'ben', 'cleo'])
    const opener = openerOf(more('ben'))
    returnFocus(opener)
    const sheet = document.createElement('div')
    sheet.setAttribute('aria-modal', 'true')
    const field = document.createElement('input')
    sheet.append(field)
    document.body.append(sheet)
    field.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    field.focus()

    // Under the sheet, the board is drawn anew; then the sheet closes.
    drawBoard(['ada', 'cleo'])
    await settle()
    expect(document.activeElement).toBe(field)
    sheet.remove()
    await settle()

    expect(document.activeElement).toBe(more('cleo'))
  })

  it('stops after a while, and when another sheet opens', async () => {
    vi.useFakeTimers()
    drawBoard(['ada', 'ben', 'cleo'])
    returnFocus(openerOf(more('ben')))

    vi.advanceTimersByTime(RETURN_WATCH_MS)
    drawBoard(['ada', 'cleo'])
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(document.body)

    returnFocus(openerOf(more('cleo')))
    stopReturningFocus()
    drawBoard(['ada'])
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(document.body)
  })
})
