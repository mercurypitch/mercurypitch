// ============================================================
// Focus hand-off: focus never falls to the page when a control goes
// ============================================================
//
// A premium room swaps its controls as a take moves on (in Long note: the
// mic button goes at the result, Again when the next take starts, the
// demo's cards when they close). A focused control that leaves the page
// drops focus to <body>, and a keyboard or screen-reader user has to find
// their way back (review B of PR 973, minor 12). The room notes the last
// control focused in it, and when a change of screen has taken that
// control away and left focus on nothing, hands focus to the control that
// took its place.

export interface FocusHandoff {
  /** The room's focusin: the control that has focus now. */
  noteFocus: (event: FocusEvent) => void
  /** After a change of screen: focus `next` if focus went with a control. */
  handOff: (next: () => HTMLElement | null) => void
}

export function createFocusHandoff(): FocusHandoff {
  let last: Element | null = null
  return {
    noteFocus: (event) => {
      last = event.target instanceof Element ? event.target : null
    },
    handOff: (next) => {
      if (last === null || last.isConnected) return
      const active = document.activeElement
      if (active !== null && active !== document.body) return
      next()?.focus({ preventScroll: true })
    },
  }
}
