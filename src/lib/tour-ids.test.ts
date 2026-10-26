// ============================================================
// Tour ids — a tour keeps the number it was given
// ============================================================

import { describe, expect, it } from 'vitest'
import { TOUR_IDS } from './tour-ids'

describe('TOUR_IDS', () => {
  it('keeps every tour on the number it was first given', () => {
    expect(TOUR_IDS).toEqual({
      guide: 1,
      home: 2,
      path: 3,
      'ear-lab': 4,
      guitar: 5,
      piano: 6,
      analysis: 7,
      exercises: 8,
      jam: 9,
      'jam-room': 10,
      community: 11,
      leaderboard: 12,
      challenges: 13,
      voice: 14,
      mixer: 15,
      'practice-modes': 16,
      sing: 17,
      'karaoke-night': 18,
      'sing-more': 19,
      studio: 20,
    })
  })

  it('never gives two tours the same number', () => {
    const ids = Object.values(TOUR_IDS)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
