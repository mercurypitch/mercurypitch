// ============================================================
// Weekly Legend — pure client logic tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { weeklyTier } from '@/features/challenges/weekly-attempt'
import { hoursUntil } from '@/features/challenges/weekly-service'

describe('weeklyTier', () => {
  it('grades below target as attempted', () => {
    expect(weeklyTier(60, 70, null)).toBe('attempted')
  })

  it('grades meeting the target as completed', () => {
    expect(weeklyTier(70, 70, null)).toBe('completed')
    expect(weeklyTier(85, 70, null)).toBe('completed')
  })

  it('grades beating the founder as beat-founder (outranks completed)', () => {
    expect(weeklyTier(95, 70, 90)).toBe('beat-founder')
  })

  it('needs a strictly higher score than the founder', () => {
    // Tying the founder is not beating them.
    expect(weeklyTier(90, 70, 90)).toBe('completed')
  })

  it('ignores the founder when no seed score exists', () => {
    expect(weeklyTier(95, 70, null)).toBe('completed')
    expect(weeklyTier(95, 70, undefined)).toBe('completed')
  })
})

describe('hoursUntil', () => {
  it('floors at zero for a past deadline', () => {
    expect(hoursUntil('2000-01-01T00:00:00Z')).toBe(0)
  })

  it('returns a positive count for a future deadline', () => {
    const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(hoursUntil(inTwoDays)).toBeGreaterThanOrEqual(47)
  })
})
