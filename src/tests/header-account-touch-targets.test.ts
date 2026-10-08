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

  it('shows the promo as its glyph, with the same 44px target', () => {
    // With its word, the promo pill made the group about 30px wider than the
    // phone row had room for.
    expect(mobileBlock).toMatch(/\.promoPill span[^{]*\{\s*display:\s*none/)
    expect(mobileBlock).toMatch(/\.promoPill,[^{]*\{[^}]*min-width:\s*44px/)
  })

  it('takes sign-out off the phone header entirely', () => {
    expect(mobileBlock).toMatch(/\.logoutBtn\s*\{[^}]*display:\s*none/)
  })

  it('gives the bigger target a place in the row, not a corner over it', () => {
    const header = readFileSync('src/components/AppHeader.css', 'utf8')
    const mobile = header.slice(header.lastIndexOf('@media (max-width: 768px)'))
    // Pinned over the row behind a fixed 128px reserve, the group slid
    // across "MercuryPitch" whenever it held more than the reserve allowed
    // for: a promo pill, the Install glyph. In the row it takes its real
    // width, and the wordmark is what gives way.
    const support =
      /\n {2}\.header-support\s*\{([^}]*)\}/.exec(mobile)?.[1] ?? ''
    expect(support, 'no phone rule for the account group').not.toBe('')
    expect(support).not.toMatch(/position:\s*absolute/)
    // 44px of button in the 34px line: the -6px block margins let it
    // overhang into the header's 8px padding instead of growing the 50px
    // band.
    expect(support).toMatch(/margin:\s*-6px 0 -6px auto/)
    expect(mobile).toMatch(/padding:\s*calc\(8px/)
    expect(mobile).toMatch(/flex-wrap:\s*nowrap/)
    expect(mobile).toMatch(/header \.header-left\s*\{[^}]*min-width:\s*0/)
    expect(mobile).toMatch(
      /\.logo-btn \.app-title\s*\{[^}]*text-overflow:\s*ellipsis/,
    )
    expect(mobile, 'a fixed corner reserve is back').not.toMatch(
      /max\(\d+px,\s*calc\(\d+px\s*\+\s*var\(--safe-right/,
    )
  })

  it('keeps the corner clear of the iOS status bar', () => {
    // In the row, the group moves with the header's own safe-area padding.
    // Absolutely positioned it ignored that padding and rendered inside the
    // status bar, visible through it and impossible to tap. The inset itself
    // has been lost once already: it lived on a `padding-top` in
    // mobile-polish.css, and AppHeader.css's `padding` shorthand reset it.
    // src/e2e/header-safe-area.spec.ts measures the result.
    const header = readFileSync('src/components/AppHeader.css', 'utf8')
    const mobile = header.slice(header.lastIndexOf('@media (max-width: 768px)'))
    expect(mobile).toMatch(/padding:\s*calc\(8px\s*\+\s*var\(--safe-top/)
    expect(mobile).not.toMatch(/\.header-support\s*\{[^}]*position:\s*absolute/)
  })
})
