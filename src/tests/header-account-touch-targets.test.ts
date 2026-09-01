// ============================================================
// The phone header keeps one big account target
// ============================================================
//
// At 390x844 the two account controls were 26x24 and 31x24, edge to edge with
// no gap, so a thumb aiming at the profile could sign the singer out
// mid-practice. The sizes are the finding, and a render test cannot see them
// — jsdom has no layout — so the contract is read off the stylesheets, which
// is where a future compaction pass would undo it. The behaviour half (the
// sign-out confirmation) lives with the component, in
// src/components/__tests__/HeaderAccount.test.tsx.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('the phone header keeps one big account target', () => {
  const css = readFileSync(
    'src/components/account/HeaderAccount.module.css',
    'utf8',
  )
  const mobileBlock = css.slice(css.indexOf('@media (max-width: 768px)'))

  it('gives the account and sign-in buttons a 44px target', () => {
    expect(mobileBlock).toMatch(/min-width:\s*44px/)
    expect(mobileBlock).toMatch(/min-height:\s*44px/)
  })

  it('takes sign-out off the phone header entirely', () => {
    expect(mobileBlock).toMatch(/\.logoutBtn\s*\{[^}]*display:\s*none/)
  })

  it('reserves the header corner the bigger target needs', () => {
    const header = readFileSync('src/components/AppHeader.css', 'utf8')
    const mobile = header.slice(header.lastIndexOf('@media (max-width: 768px)'))
    // 44px of button from a 4px inset fits the 50px band exactly, and the
    // right reserve is what keeps the row's own content out from under the
    // corner. Both are matched loosely enough to survive the safe-area
    // offsets added around them, and tightly enough that shrinking either
    // one fails. The reserve is a number rather than a pattern because it
    // has to cover whatever is pinned there — three controls once the voice
    // pill docked into the corner beside the account glyph, which is why it
    // is no longer 96.
    expect(mobile).toMatch(/top:\s*calc\(4px/)
    expect(mobile).toMatch(/padding:\s*calc\(8px/)
    const reserve = /max\((\d+)px,\s*calc\((\d+)px/.exec(mobile)
    expect(reserve, 'no right reserve on the phone header').not.toBe(null)
    expect(
      Number(reserve?.[1]),
      'the corner reserve is too narrow for what is pinned in it',
    ).toBeGreaterThanOrEqual(128)
  })

  it('keeps the corner clear of the iOS status bar', () => {
    // The pills are absolutely positioned, so the header's own safe-area
    // padding does not move them: without their own inset they render inside
    // the status bar, visible through it and impossible to tap. This is the
    // regression that shipped once already — the inset lived on a `padding-top`
    // in mobile-polish.css and AppHeader.css's `padding` shorthand reset it.
    const header = readFileSync('src/components/AppHeader.css', 'utf8')
    const mobile = header.slice(header.lastIndexOf('@media (max-width: 768px)'))
    expect(mobile).toMatch(/top:\s*calc\(4px\s*\+\s*var\(--safe-top/)
    expect(mobile).toMatch(/padding:\s*calc\(8px\s*\+\s*var\(--safe-top/)
  })
})
