// ============================================================
// Whether the focus has fallen to the page
// ============================================================
//
// A focused button that is taken off the page takes the focus with it, and
// the page holds it then: the body, or nothing at all. A screen that just
// replaced what the focus was on (a Sign in gone with the sign-in, a row
// gone with its block) asks this before it gives the focus somewhere, so
// it never takes it from where the singer has since put it.

/** True when nothing on the page holds the focus. */
export function focusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body
}
