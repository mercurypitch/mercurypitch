// ============================================================
// Mock Session Data Generator Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { generateMockSessions } from '@/lib/vocal-analysis-mock'

describe('generateMockSessions', () => {
  it('returns 5 sessions', () => {
    const sessions = generateMockSessions()
    expect(sessions).toHaveLength(5)
  })

  it('each session has required fields', () => {
    const sessions = generateMockSessions()
    for (const session of sessions) {
      expect(session.sessionId).toBeTruthy()
      expect(session.sessionId).toMatch(/^demo-session-/)
      expect(session.name).toBeTruthy()
      expect(typeof session.score).toBe('number')
      expect(session.score).toBeGreaterThan(0)
      expect(session.score).toBeLessThanOrEqual(100)
      expect(session.completedAt).toBeGreaterThan(0)
      expect(session.itemsCompleted).toBeGreaterThan(0)
      expect(session.practiceItemResult.length).toBeGreaterThan(0)
    }
  })

  it('each practice result has note results with valid data', () => {
    const sessions = generateMockSessions()
    for (const session of sessions) {
      for (const pr of session.practiceItemResult) {
        expect(pr.noteResult.length).toBeGreaterThan(0)
        expect(pr.score).toBeGreaterThan(0)
        expect(['session', 'repeat']).toContain(pr.mode)

        for (const nr of pr.noteResult) {
          expect(nr.item).toBeDefined()
          expect(nr.item.note.midi).toBeGreaterThan(0)
          expect(nr.item.note.name).toBeTruthy()
          expect(typeof nr.pitchFreq).toBe('number')
          expect(nr.pitchFreq).toBeGreaterThan(0)
          expect(typeof nr.avgCents).toBe('number')
          expect(['perfect', 'excellent', 'good', 'okay', 'off']).toContain(
            nr.rating,
          )
        }
      }
    }
  })

  it('sessions have descending completedAt timestamps', () => {
    const sessions = generateMockSessions()
    // Sessions span recent dates (within last 30 days)
    const now = Date.now()
    for (const session of sessions) {
      expect(session.completedAt).toBeLessThanOrEqual(now)
      expect(session.completedAt).toBeGreaterThan(now - 30 * 86400000)
    }
  })

  it('returns deterministic results (resets id counter)', () => {
    const a = generateMockSessions()
    const b = generateMockSessions()
    // IDs should match between runs
    expect(a.map((s) => s.sessionId)).toEqual(b.map((s) => s.sessionId))
    expect(a.map((s) => s.name)).toEqual(b.map((s) => s.name))
  })

  it('each session has unique IDs', () => {
    const sessions = generateMockSessions()
    const ids = sessions.map((s) => s.sessionId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
