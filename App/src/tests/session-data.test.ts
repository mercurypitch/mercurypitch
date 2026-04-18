// ============================================================
// Session Data Tests — validate static session templates
// ============================================================

import { describe, expect, it } from 'vitest'
import { PRACTICE_SESSIONS } from '@/data/sessions'

describe('PRACTICE_SESSIONS — static data integrity', () => {
  it('has at least 5 session templates', () => {
    expect(PRACTICE_SESSIONS.length).toBeGreaterThanOrEqual(5)
  })

  it('every session has a unique id', () => {
    const ids = PRACTICE_SESSIONS.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('every session has non-empty name and description', () => {
    for (const session of PRACTICE_SESSIONS) {
      expect(session.name.trim().length).toBeGreaterThan(0)
      expect(session.description.trim().length).toBeGreaterThan(0)
    }
  })

  it('every session has at least 3 items', () => {
    for (const session of PRACTICE_SESSIONS) {
      expect(session.items.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('every item has a label', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        expect(item.label?.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('rest items have positive restMs', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'rest') {
          expect(item.restMs).toBeDefined()
          expect(item.restMs!).toBeGreaterThan(0)
        }
      }
    }
  })

  it('scale items have valid scaleType and positive beats', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'scale') {
          expect(item.scaleType?.trim().length).toBeGreaterThan(0)
          expect(item.beats).toBeDefined()
          expect(item.beats!).toBeGreaterThan(0)
        }
      }
    }
  })

  it('every session has valid difficulty and category', () => {
    const validDifficulties = ['beginner', 'intermediate', 'advanced']
    const validCategories = ['vocal', 'instrumental', 'ear-training', 'general']
    for (const session of PRACTICE_SESSIONS) {
      expect(validDifficulties).toContain(session.difficulty)
      expect(validCategories).toContain(session.category)
    }
  })

  it('contains expected session IDs', () => {
    const ids = PRACTICE_SESSIONS.map((s) => s.id)
    expect(ids).toContain('warmup-2min')
    expect(ids).toContain('deep-20min')
    expect(ids).toContain('vocal-5min')
  })

  it('advanced sessions have at least 8 items', () => {
    for (const session of PRACTICE_SESSIONS) {
      if (session.difficulty === 'advanced') {
        expect(session.items.length).toBeGreaterThanOrEqual(8)
      }
    }
  })

  /**
   * Estimate session duration in seconds based on BPM and item parameters.
   * Assumes BPM=120, scales play at 1 beat per note, rests use restMs.
   */
  const estimateDuration = (
    session: (typeof PRACTICE_SESSIONS)[0],
    bpm = 120,
  ) => {
    let total = 0
    for (const item of session.items) {
      const repeat = item.repeat ?? 1
      if (item.type === 'scale') {
        total += (item.beats ?? 8) * (60 / bpm) * repeat
      } else if (item.type === 'rest') {
        total += ((item.restMs ?? 2000) * repeat) / 1000
      }
    }
    return total
  }

  it('2-minute session should last at least 90 seconds', () => {
    const warmup = PRACTICE_SESSIONS.find((s) => s.id === 'warmup-2min')
    expect(warmup).toBeDefined()
    const duration = estimateDuration(warmup!)
    expect(duration).toBeGreaterThanOrEqual(90)
  })

  it('5-minute sessions should last at least 240 seconds', () => {
    const fiveMin = PRACTICE_SESSIONS.filter(
      (s) => s.name.includes('5-Minute') || s.name.includes('5 minute'),
    )
    expect(fiveMin.length).toBeGreaterThanOrEqual(2)
    for (const s of fiveMin) {
      const duration = estimateDuration(s)
      expect(duration).toBeGreaterThanOrEqual(240)
    }
  })

  it('all scale items have repeat >= 1', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'scale') {
          expect(item.repeat).toBeDefined()
          expect(item.repeat!).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  it('all rest items have repeat >= 1', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'rest') {
          expect(item.repeat).toBeDefined()
          expect(item.repeat!).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })
})
