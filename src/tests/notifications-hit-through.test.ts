// ============================================================
// The toast stack lets taps through (CLAUDE-JOURNEY-012)
// ============================================================
//
// The finding: toasts rendered as a near-full-width stack over the app
// header and swallowed taps on Back and the mic toggle for about five
// seconds. The fix (the 7e10ac84..6946bc56 toast series) is a CSS
// contract: the fixed container is pointer-events: none, so the stack
// region passes taps to what is under it, and each toast body is
// pointer-events: auto, so its dismiss and action buttons still work.
// Verified live at 390x844: a tap inside the container box but below
// the last toast lands on page content. jsdom applies no CSS modules,
// so the contract is pinned in the stylesheet source itself.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/styles/Notifications.module.css', 'utf8')

/** The declarations of one top-level rule, brace-matched. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} rule exists`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

describe('toast hit-through contract', () => {
  it('the stack container passes taps through', () => {
    expect(block('.notificationContainer')).toContain('pointer-events: none')
  })

  it('each toast keeps its own buttons tappable', () => {
    expect(block('.notification')).toContain('pointer-events: auto')
  })
})
