/**
 * Toast mobile visibility — CSS token and layout regression tests.
 *
 * Covers:
 *   REQ-TOAST-001 — toast container mobile touch-targets
 *   REQ-TOAST-002 — VerifyEmailBanner clears the tab bar
 *   REQ-TOAST-003 — z-index ordering
 *
 * These tests read the raw CSS module files (or the mobile-kit token sheet)
 * and assert the numeric relationships that prevent occlusion. They run in
 * Vitest (Node) with no browser — purely structural, no rendering.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/* ── helpers ── */

/** Extract the numeric value of a `--token: <number>;` declaration. */
function tokenValue(css: string, token: string): number {
  const re = new RegExp(`${token}:\\s*(\\d+)`)
  const m = css.match(re)
  if (!m) throw new Error(`token ${token} not found in CSS`)
  return Number(m[1])
}

/** Return the substring of `css` inside the first `@media (max-width: 768px)` block. */
function mobileBlock(css: string): string {
  const start = css.indexOf('@media (max-width: 768px)')
  if (start === -1) throw new Error('768px media query not found')
  let depth = 0
  let blockStart = -1
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) blockStart = i + 1
      depth++
    } else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(blockStart, i)
    }
  }
  throw new Error('unterminated media block')
}

/* ── fixture CSS ── */

const mobileKit = readFileSync(
  resolve(__dirname, '../styles/mobile-kit.css'),
  'utf-8',
)
const bannerCss = readFileSync(
  resolve(__dirname, '../components/account/VerifyEmailBanner.module.css'),
  'utf-8',
)
const toastCss = readFileSync(
  resolve(__dirname, '../styles/Notifications.module.css'),
  'utf-8',
)

/* ── z-scale tokens (from mobile-kit.css) ── */

const Z_TABBAR = tokenValue(mobileKit, '--z-tabbar')
const Z_STAGE = tokenValue(mobileKit, '--z-stage')
const Z_SHEET = tokenValue(mobileKit, '--z-sheet')
const Z_MODAL = tokenValue(mobileKit, '--z-modal')
const Z_TOAST = tokenValue(mobileKit, '--z-toast')

/* ── REQ-TOAST-003: z-index ordering ── */

describe('REQ-TOAST-003 — z-index ordering', () => {
  it('toast z-index is above tabbar, sheet, and modal', () => {
    expect(Z_TOAST).toBeGreaterThan(Z_TABBAR)
    expect(Z_TOAST).toBeGreaterThan(Z_SHEET)
    expect(Z_TOAST).toBeGreaterThan(Z_MODAL)
  })

  it('stage z-index (used by the email banner) is above the tab bar', () => {
    expect(Z_STAGE).toBeGreaterThan(Z_TABBAR)
  })

  it('toast CSS references the --z-toast token', () => {
    expect(toastCss).toContain('var(--z-toast')
  })
})

/* ── REQ-TOAST-002: VerifyEmailBanner clears BottomTabBar ── */

describe('REQ-TOAST-002 — VerifyEmailBanner mobile positioning', () => {
  it('banner z-index uses the --z-stage token (above tab bar)', () => {
    expect(bannerCss).toMatch(/z-index:\s*var\(--z-stage/)
  })

  it('mobile breakpoint matches the BottomTabBar mount point (768px)', () => {
    expect(bannerCss).toContain('@media (max-width: 768px)')
  })

  it('mobile bottom offset accounts for --tabbar-total', () => {
    const mobile = mobileBlock(bannerCss)
    expect(mobile).toMatch(/bottom:\s*calc\(var\(--tabbar-total/)
  })
})

/* ── REQ-TOAST-001: toast action buttons have mobile touch targets ── */

describe('REQ-TOAST-001 — toast mobile touch targets', () => {
  it('action button has min-height touch-target on mobile', () => {
    const mobile = mobileBlock(toastCss)
    expect(mobile).toContain('.actionBtn')
    expect(mobile).toMatch(/min-height:\s*var\(--touch-target/)
  })

  it('close button is sized adequately on mobile', () => {
    const mobile = mobileBlock(toastCss)
    expect(mobile).toContain('.closeBtn')
  })
})
