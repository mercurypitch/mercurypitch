// ============================================================
// Where the focus goes when the singer sheet closes
// ============================================================
//
// WCAG 2.4.3: a sheet gives the focus back to what opened it. The "..."
// that opened this one may be gone by then: a block takes its row off the
// board at once, and the board's read after it draws every row anew. So the
// opener is kept as its board and its place there too (`openerOf`), and the
// focus goes to the "..." at that place now, else the one before it, else
// the board's heading (`landingFor`). A board marks itself with
// `data-singer-board="<name>"`, a plain word, and its heading with
// `data-singer-board-heading="<name>"` and `tabindex="-1"`. A heading in
// the board is taken first; one outside it may stand for several boards
// (its attribute a list of names), and serves one that has gone, as the
// friend requests go with the last of them.
//
// A board that draws its rows anew once the focus is back takes the
// focused "..." with it, and the focus falls to the page. So for a while
// after a close (`returnFocus`), a change to the page that leaves the focus
// there puts it back the same way, without scrolling, and moves it on from
// the heading to a "..." once the rows are drawn. The while ends when the
// singer moves the focus or presses anywhere on the page themselves, after
// a minute, or when another sheet opens. A sheet opened over the board
// meanwhile (the sign-in the account pane offers) does not end it: the
// focus comes back from that sheet to a board that may have been drawn
// anew under it.

import type { SingerSheetOpener } from '@/stores/singer-sheet-store'

const BOARD = 'data-singer-board'
const HEADING = 'data-singer-board-heading'
const MORE = '[data-singer-more]'

/** How long after a close a redraw may still take the focus back. */
export const RETURN_WATCH_MS = 60_000

function buttonsOn(board: Element | null): HTMLElement[] {
  return board === null ? [] : [...board.querySelectorAll<HTMLElement>(MORE)]
}

/** The "..." pressed, its board and its place on that board. */
export function openerOf(button: HTMLElement): SingerSheetOpener {
  const board = button.closest<HTMLElement>(`[${BOARD}]`)
  return {
    button,
    board,
    boardName: board?.getAttribute(BOARD) ?? null,
    index: Math.max(buttonsOn(board).indexOf(button), 0),
  }
}

/** The board as it is now: the one pressed on, or the one drawn in its place. */
function boardNow(opener: SingerSheetOpener): HTMLElement | null {
  if (opener.board?.isConnected === true) return opener.board
  return document.querySelector<HTMLElement>(`[${BOARD}="${opener.boardName}"]`)
}

/**
 * Where the focus belongs now: the opener while it is on the page, else
 * the "..." at its place on its board, else the last one before it, else
 * the board's heading. Null when there is none of those.
 */
export function landingFor(opener: SingerSheetOpener): HTMLElement | null {
  if (opener.button.isConnected) return opener.button
  if (opener.boardName === null) return null
  const board = boardNow(opener)
  const buttons = buttonsOn(board)
  if (buttons.length > 0) {
    return buttons[Math.min(opener.index, buttons.length - 1)]
  }
  const heading = `[${HEADING}~="${opener.boardName}"]`
  return (
    board?.querySelector<HTMLElement>(heading) ??
    document.querySelector<HTMLElement>(heading)
  )
}

function inSheet(element: Element | null): boolean {
  return element?.closest('[aria-modal="true"]') != null
}

let endWatch: (() => void) | null = null

/** Stop putting the focus back: another sheet has opened. */
export function stopReturningFocus(): void {
  endWatch?.()
}

/** Give the focus back to the board, and keep it there through a redraw. */
export function returnFocus(opener: SingerSheetOpener): void {
  stopReturningFocus()
  let landed = landingFor(opener)
  landed?.focus()

  const observer = new MutationObserver(() => {
    const active = document.activeElement
    // On its "...": nothing to do. On the heading: a "..." may be back.
    if (active === landed && landed?.hasAttribute(HEADING) !== true) return
    if (active !== landed && active !== null && active !== document.body) {
      // Moved on by the singer, unless it is in a sheet over the board.
      if (!inSheet(active)) end()
      return
    }
    const next = landingFor(opener)
    if (next === null || next === active) return
    landed = next
    // The same place on the board: nothing to scroll to.
    next.focus({ preventScroll: true })
  })
  // A press on the page is the singer moving on, even where it leaves the
  // focus on the page; one in a sheet over the board is not.
  const onPress = (event: PointerEvent): void => {
    if (!inSheet(event.target instanceof Element ? event.target : null)) end()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = (): void => {
    timer = setTimeout(() => {
      if (inSheet(document.activeElement)) arm()
      else end()
    }, RETURN_WATCH_MS)
  }
  const end = (): void => {
    observer.disconnect()
    document.removeEventListener('pointerdown', onPress, true)
    clearTimeout(timer)
    if (endWatch === end) endWatch = null
  }
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('pointerdown', onPress, true)
  arm()
  endWatch = end
}
