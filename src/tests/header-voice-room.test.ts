// ============================================================
// The phone header lends its row to the voice transcript
// ============================================================
//
// The docked pill and the app title share one row, and a phone's row is about
// three hundred pixels wide. Expanded, the pill ran straight across
// "MercuryPitch" and the two read as one smeared line. While there are words
// to show the title steps aside; a few seconds of quiet gives it back.
//
// Read off the stylesheet, because jsdom has no layout and this is a set of
// rules a later compaction pass would quietly undo. The behaviour half — when
// `data-voice` is set at all — is in
// src/features/voice-control/voice-hud-presence.test.ts.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the phone header lends its row to the voice transcript', () => {
  const header = readFileSync('src/components/AppHeader.css', 'utf8')
  const mobile = header.slice(header.lastIndexOf('@media (max-width: 768px)'))
  const talking = mobile.slice(mobile.indexOf("header[data-voice='talking']"))

  it('only fires on a phone', () => {
    // On a desktop the pill floats and takes nothing from this row, so the
    // rules must not exist outside the mobile block.
    const beforeMobile = header.slice(
      0,
      header.lastIndexOf('@media (max-width: 768px)'),
    )
    expect(beforeMobile).not.toContain("data-voice='talking'")
    expect(talking).not.toBe('')
  })

  it('takes the title, the tagline and the loaded-song pill out of the row', () => {
    const hidden = /([^{]*)\{\s*display:\s*none/.exec(talking)
    expect(hidden, 'nothing is hidden while the pill is talking').not.toBe(null)
    const selectors = hidden?.[1] ?? ''
    expect(selectors).toContain('.logo-btn')
    expect(selectors).toContain('.subtitle')
    expect(selectors).toContain('.header-melody-context')
  })

  it('leaves the menu button, which is the way out of any screen', () => {
    expect(talking).not.toContain('.sidebar-toggle-btn')
    expect(talking).not.toMatch(/\.header-left\s*\{\s*display:\s*none/)
  })

  it('gives the width to the support group rather than the corner', () => {
    // Absolutely positioned in a reserved corner is exactly what stops the
    // pill from growing; talking, it comes back into the flow and flexes.
    expect(talking).toMatch(
      /\.header-support\s*\{[^}]*position:\s*static[^}]*\}/,
    )
    expect(talking).toMatch(/\.header-support\s*\{[^}]*flex:\s*1[^}]*\}/)
    expect(talking).toMatch(/\.header-support\s*\{[^}]*min-width:\s*0[^}]*\}/)
  })

  it('releases the corner reserve the row no longer needs', () => {
    // The reserve holds ~128px for what is pinned in the corner. With the
    // support group back in the flow it is dead space at the right of the
    // transcript.
    expect(talking).toMatch(/padding-right:\s*max\(12px/)
  })
})
