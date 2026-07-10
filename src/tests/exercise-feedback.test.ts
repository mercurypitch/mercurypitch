import { describe, expect, it } from 'vitest'
import { COMBO_THRESHOLD, gradeForScore, tierForScore, } from '@/features/exercises/feedback'

describe('tierForScore', () => {
  it('maps the four tiers at their boundaries', () => {
    expect(tierForScore(100).label).toBe('Perfect')
    expect(tierForScore(90).label).toBe('Perfect')
    expect(tierForScore(89).label).toBe('Great')
    expect(tierForScore(75).label).toBe('Great')
    expect(tierForScore(74).label).toBe('Close')
    expect(tierForScore(50).label).toBe('Close')
    expect(tierForScore(49).label).toBe('Missed')
    expect(tierForScore(0).label).toBe('Missed')
  })

  it('className mirrors the label for styling', () => {
    expect(tierForScore(95).className).toBe('perfect')
    expect(tierForScore(60).className).toBe('close')
  })

  it('combo threshold sits at the Great boundary', () => {
    expect(COMBO_THRESHOLD).toBe(75)
    expect(tierForScore(COMBO_THRESHOLD).label).toBe('Great')
  })
})

describe('gradeForScore (karaoke-aligned bands)', () => {
  it('matches the mic-scoring S/A/B/C/D thresholds', () => {
    expect(gradeForScore(100)).toBe('S')
    expect(gradeForScore(95)).toBe('S')
    expect(gradeForScore(94)).toBe('A')
    expect(gradeForScore(85)).toBe('A')
    expect(gradeForScore(84)).toBe('B')
    expect(gradeForScore(70)).toBe('B')
    expect(gradeForScore(69)).toBe('C')
    expect(gradeForScore(50)).toBe('C')
    expect(gradeForScore(49)).toBe('D')
    expect(gradeForScore(0)).toBe('D')
  })
})
