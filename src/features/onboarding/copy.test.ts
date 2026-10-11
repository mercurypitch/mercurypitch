// ============================================================
// The launch gift's count, one and many
// ============================================================
//
// The count is the server's (promo-store), so a code granting one credit
// is one setting away. "Up to 1 free song separations" is what the
// plural-only copy said for it (review of PR 977).

import { describe, expect, it } from 'vitest'
import { giftTitle, mapGiftJoin, mapGiftWaiting } from './copy'

describe('the launch gift count', () => {
  it.each<[string, (credits: number) => string, string]>([
    ['Keep', giftTitle, '1 free song separation'],
    [
      'the Map, waiting',
      mapGiftWaiting,
      'Your launch gift is waiting: 1 free song separation.',
    ],
    [
      'the Map, joining',
      mapGiftJoin,
      'Launch gift: 1 free song separation with a free account.',
    ],
  ])(
    'reads one separation on %s when the gift is one credit',
    (_, line, one) => {
      expect(line(1)).toBe(one)
    },
  )

  it.each<[string, (credits: number) => string, string]>([
    ['Keep', giftTitle, 'Up to 5 free song separations'],
    [
      'the Map, waiting',
      mapGiftWaiting,
      'Your launch gift is waiting: up to 5 free song separations.',
    ],
    [
      'the Map, joining',
      mapGiftJoin,
      'Launch gift: up to 5 free song separations with a free account.',
    ],
  ])(
    'keeps "up to" and the plural on %s for more than one',
    (_, line, many) => {
      expect(line(5)).toBe(many)
    },
  )
})
