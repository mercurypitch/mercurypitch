import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * REQ-TMV-001..003 — Toast & Banner Mobile Visibility
 *
 * These tests statically verify the CSS source files contain the required
 * mobile-viewport rules so toasts and the verify-email banner are never
 * occluded by the bottom tab bar.  We parse the raw CSS because the JSDOM
 * test environment does not evaluate CSS modules into computed styles.
 */

const NOTIFICATIONS_CSS = readFileSync(
  resolve(__dirname, '../styles/Notifications.module.css'),
  'utf-8',
)

const BANNER_CSS = readFileSync(
  resolve(__dirname, '../components/account/VerifyEmailBanner.module.css'),
  'utf-8',
)

/** Extract the body of the first `@media (max-width: …)` block whose
 *  breakpoint is at most `maxPx`. Handles single-level nesting only. */
function extractMobileBlock(css: string, maxPx: number): string {
  const re = new RegExp(`@media\\s*\\(max-width:\\s*(\\d+)px\\)\\s*\\{`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const bp = parseInt(m[1], 10)
    if (bp > maxPx) continue
    // Walk braces to find matching close.
    let depth = 1
    let i = re.lastIndex
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    return css.slice(re.lastIndex, i - 1)
  }
  return ''
}

describe('REQ-TMV-001 — Mobile toast container respects tab bar clearance', () => {
  const block = extractMobileBlock(NOTIFICATIONS_CSS, 768)

  it('has a max-width 768px media query for the notification container', () => {
    expect(block).toBeTruthy()
  })

  it('sets max-height using --tabbar-total', () => {
    expect(block).toMatch(/max-height\s*:.*--tabbar-total/)
  })

  it('uses dynamic viewport height (dvh)', () => {
    expect(block).toMatch(/100dvh/)
  })
})

describe('REQ-TMV-002 — Overflowing toasts are scrollable', () => {
  const block = extractMobileBlock(NOTIFICATIONS_CSS, 768)

  it('enables vertical scrolling', () => {
    expect(block).toMatch(/overflow-y\s*:\s*auto/)
  })

  it('contains scroll overscroll behaviour', () => {
    expect(block).toMatch(/overscroll-behavior\s*:\s*contain/)
  })
})

describe('REQ-TMV-003 — Banner sits above the tab bar on mobile', () => {
  const block = extractMobileBlock(BANNER_CSS, 600)

  it('has a max-width 600px media query for the banner', () => {
    expect(block).toBeTruthy()
  })

  it('offsets bottom by --tabbar-total', () => {
    expect(block).toMatch(/bottom\s*:.*--tabbar-total/)
  })

  it('caps height so buttons remain visible', () => {
    expect(block).toMatch(/max-height\s*:.*--tabbar-total/)
  })

  it('enables vertical scrolling for long content', () => {
    expect(block).toMatch(/overflow-y\s*:\s*auto/)
  })
})
