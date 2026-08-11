// ============================================================
// Share links — printed URLs and shared URLs are not the same string
// ============================================================
//
// Every shareable card carries the destination twice: drawn on the card
// face, and again in the share text. They look like a duplication waiting
// to be tidied into one constant. Unifying them breaks one of two things —
// either the card face grows a query string a human has to retype off an
// image, or card-driven traffic stops being separable in GA4.
//
// The paid-source assertion is the one that matters most and is the
// easiest to undo by accident. A card reaching someone through a friend is
// organic however the first one was seeded, so stamping an acquisition
// source on the share link would credit that campaign with the entire loop
// downstream of it — permanently, invisibly, and precisely when the
// question being asked is whether the campaign is worth its spend.
//
// One rule, every card, so a new card surface has somewhere obvious to
// register itself. See docs/plans/ugc-noise-integration.md §5.

import { describe, expect, it } from 'vitest'
import { CARD_URL as GLASS_CARD_URL, glassShareText, } from '@/features/glass/card-renderer'
import { CARD_URL as MIRROR_CARD_URL, DEFAULT_SHARE_TEXT, twinShareText, } from '@/features/mirror/card-renderer'

/** Acquisition sources that must never ride on an organic share link. */
const PAID_SOURCES = ['noise', 'ugc', 'gclid', 'cpc', 'paid']

/** Every card surface: what it prints, and every share text it can emit. */
const CARDS = [
  {
    name: 'voiceprint',
    printed: MIRROR_CARD_URL,
    destination: 'https://mercurypitch.com/mirror',
    source: 'voiceprint',
    shareTexts: [DEFAULT_SHARE_TEXT, twinShareText('Freddie Mercury')],
  },
  {
    name: 'glass',
    printed: GLASS_CARD_URL,
    destination: 'https://mercurypitch.com/glass',
    source: 'glasscard',
    shareTexts: [glassShareText(true), glassShareText(false)],
  },
]

describe.each(CARDS)('$name card', (card) => {
  it('prints a bare URL on the card face', () => {
    expect(card.printed).not.toContain('?')
    expect(card.printed).not.toContain('utm_')
  })

  it('shares a clickable link tagged to this card', () => {
    for (const text of card.shareTexts) {
      expect(text).toContain(card.destination)
      expect(text).toContain(`utm_source=${card.source}`)
      expect(text).toContain('utm_medium=share')
    }
  })

  it('never stamps a paid source on an organic share', () => {
    for (const text of card.shareTexts) {
      for (const source of PAID_SOURCES) {
        expect(text).not.toContain(`utm_source=${source}`)
        expect(text).not.toContain(`utm_medium=${source}`)
      }
    }
  })
})

describe('across cards', () => {
  it('shares one bucket, distinguished by source', () => {
    const sources = new Set(CARDS.map((c) => c.source))
    expect(sources.size).toBe(CARDS.length)
    for (const card of CARDS) {
      for (const text of card.shareTexts) {
        expect(text).toContain('utm_medium=share')
      }
    }
  })
})
