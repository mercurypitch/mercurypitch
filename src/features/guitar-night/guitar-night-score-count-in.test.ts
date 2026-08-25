import { describe, expect, it } from 'vitest'
import { GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES, GUITAR_NIGHT_SCORE_MAX_COUNT_IN_BEATS, isGuitarNightScoreCountInBeats, nextGuitarNightScoreCountIn, } from './guitar-night-score-count-in'

describe('Guitar Night score count-in', () => {
  it('cycles the one shared off, 1, 2, 4 ladder', () => {
    expect(GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES).toEqual([0, 1, 2, 4])
    expect(GUITAR_NIGHT_SCORE_MAX_COUNT_IN_BEATS).toBe(4)
    expect(nextGuitarNightScoreCountIn(0)).toBe(1)
    expect(nextGuitarNightScoreCountIn(1)).toBe(2)
    expect(nextGuitarNightScoreCountIn(2)).toBe(4)
    expect(nextGuitarNightScoreCountIn(4)).toBe(0)
  })

  it('recovers an unknown stored value at the start of the ladder', () => {
    expect(isGuitarNightScoreCountInBeats(3)).toBe(false)
    expect(nextGuitarNightScoreCountIn(3)).toBe(0)
  })
})
