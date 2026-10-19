// ============================================================
// Lesson 5 Push tests — one slider, a note's loudness and pitch together
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { crossingWords, loudWord, nextPush, pushCents, pushDb, pushGain, pushHz, pushLevel, pushValueText, pushWords, sideOf, } from './toy-push'

describe('Push (FACTS 73)', () => {
  it('moves the note 1.2 cents and 0.12 dB a step from 50: ±60 cents and ±6 dB at the ends', () => {
    expect([pushCents(0), pushCents(50), pushCents(100)]).toEqual([-60, 0, 60])
    expect(pushDb(0)).toBeCloseTo(-6, 9)
    expect(pushDb(100)).toBeCloseTo(6, 9)
    // 6 dB is twice the level, on the strip as in the sound
    expect(pushLevel(100) / pushLevel(50)).toBeCloseTo(1.995, 3)
    expect(pushGain(100) / pushGain(50)).toBeCloseTo(1.995, 3)
    expect(pushHz(50)).toBeCloseTo(220, 9)
    expect(pushHz(100)).toBeCloseTo(220 * 2 ** (60 / 1200), 9)
  })

  it('leaves the 35-cent band below 21 and above 79', () => {
    expect([20, 21, 50, 79, 80].map((p) => sideOf(pushCents(p)))).toEqual([
      'below',
      'in',
      'in',
      'in',
      'above',
    ])
  })

  it('says its value in words, as WEB-SPEC words it', () => {
    expect(pushValueText(70)).toBe(
      'Push 70 percent: louder; the note above the middle, still in the band',
    )
    expect(pushValueText(50)).toBe(
      'Push 50 percent: as it started; the note in the middle of the band',
    )
    expect(pushValueText(10)).toBe(
      'Push 10 percent: quieter; the note below the band',
    )
    expect(pushWords(90)).toBe('louder · above the band')
    expect([loudWord(49), loudWord(50), loudWord(51)]).toEqual([
      'quieter',
      'as it started',
      'louder',
    ])
  })

  it('announces the note leaving the band and coming back, and nothing else', () => {
    expect(crossingWords('in', 'above')).toBe(
      'The note left the band: above it.',
    )
    expect(crossingWords('above', 'in')).toBe('The note is back in the band.')
    expect(crossingWords('below', 'below')).toBeNull()
  })

  it('takes arrows in fives, Page Up and Page Down in twenties, within 0 to 100', () => {
    expect(nextPush(50, 'ArrowUp')).toBe(55)
    expect(nextPush(50, 'ArrowLeft')).toBe(45)
    expect(nextPush(50, 'PageUp')).toBe(70)
    expect(nextPush(10, 'PageDown')).toBe(0)
    expect(nextPush(98, 'ArrowRight')).toBe(100)
    expect([nextPush(40, 'Home'), nextPush(40, 'End')]).toEqual([0, 100])
    // Space and Enter belong to Hold the note, never to the slider
    expect(nextPush(50, ' ')).toBeNull()
    expect(nextPush(50, 'Enter')).toBeNull()
  })
})
