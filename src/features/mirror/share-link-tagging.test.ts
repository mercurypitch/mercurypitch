// ============================================================
// Share links — the printed URL and the shared URL are not the same string
// ============================================================
//
// These two constants sit next to each other and look like a duplication
// waiting to be tidied up. Unifying them breaks one of two things: either
// the card face grows a query string a human has to retype off an image,
// or card-driven traffic stops being separable in GA4.
//
// The third assertion is the one that matters most and is the easiest to
// undo by accident. Stamping a paid-acquisition source on the share link
// would credit that channel with every organic share downstream of it —
// a friend passing a card along is not paid traffic, whoever seeded the
// first one. See docs/plans/ugc-noise-integration.md §5.

import { describe, expect, it } from 'vitest'
import { CARD_URL, DEFAULT_SHARE_TEXT, twinShareText } from './card-renderer'

/** Acquisition sources that must never ride on an organic share link. */
const PAID_SOURCES = ['noise', 'ugc', 'gclid', 'cpc', 'paid']

describe('share link tagging', () => {
  it('prints a bare URL on the card face', () => {
    expect(CARD_URL).toBe('mercurypitch.com/mirror')
    expect(CARD_URL).not.toContain('?')
    expect(CARD_URL).not.toContain('utm_')
  })

  it('shares a clickable, tagged link', () => {
    for (const text of [DEFAULT_SHARE_TEXT, twinShareText('Freddie Mercury')]) {
      expect(text).toContain('https://mercurypitch.com/mirror')
      expect(text).toContain('utm_source=voiceprint')
      expect(text).toContain('utm_medium=share')
    }
  })

  it('never stamps a paid source on an organic share', () => {
    for (const text of [DEFAULT_SHARE_TEXT, twinShareText('Freddie Mercury')]) {
      for (const source of PAID_SOURCES) {
        expect(text).not.toContain(`utm_source=${source}`)
        expect(text).not.toContain(`utm_medium=${source}`)
      }
    }
  })

  it('names the twin it was built for', () => {
    expect(twinShareText('Freddie Mercury')).toContain('Freddie Mercury')
  })
})
