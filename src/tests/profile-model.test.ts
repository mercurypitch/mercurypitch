// ============================================================
// Profile model — the arithmetic behind the profile cards
// ============================================================
//
// The interesting cases are the empty and near-empty ones. A profile is
// most often looked at by someone who has just arrived, and a confident
// "best score: 0%" is worse than saying there is nothing yet.

import { describe, expect, it } from 'vitest'
import type { ProfileSession } from '@/features/community/profile-model'
import { accuracySeries, profileStats, scoreSeries, sparklinePoints, trend, } from '@/features/community/profile-model'

const session = (
  score: number,
  over: Partial<ProfileSession> = {},
): ProfileSession => ({ score, completedAt: 1_700_000_000_000, ...over })

describe('profileStats', () => {
  it('says nothing rather than zero when there is no history', () => {
    expect(profileStats([])).toBeNull()
  })

  it('summarises a real history', () => {
    const stats = profileStats([
      session(60, { completedAt: 100 }),
      session(80, { completedAt: 200 }),
      session(100, { completedAt: 300 }),
    ])!
    expect(stats.sessions).toBe(3)
    expect(stats.best).toBe(100)
    expect(stats.average).toBe(80)
    expect(stats.firstAt).toBe(100)
  })

  it('reads recent form from the last five, not the whole history', () => {
    // Six poor sessions then five good ones: the average stays low while
    // recent form has clearly moved.
    const sessions = [
      ...Array.from({ length: 6 }, () => session(40)),
      ...Array.from({ length: 5 }, () => session(90)),
    ]
    const stats = profileStats(sessions)!
    expect(stats.recentAverage).toBe(90)
    expect(stats.average).toBeLessThan(70)
  })

  it('treats a session with no score as zero rather than crashing', () => {
    const stats = profileStats([session(80), { completedAt: 1 }])!
    expect(stats.sessions).toBe(2)
    expect(stats.best).toBe(80)
  })
})

describe('series', () => {
  it('returns scores oldest first, capped to the window', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => session(i))
    expect(scoreSeries(sessions, 5)).toEqual([15, 16, 17, 18, 19])
  })

  it('inverts cents-off into an accuracy percentage', () => {
    expect(accuracySeries([session(50, { avgCents: 30 })])).toEqual([70])
    // Wildly off pitch floors at 0 rather than going negative.
    expect(accuracySeries([session(50, { avgCents: 250 })])).toEqual([0])
  })

  it('falls back to the score when cents were never measured', () => {
    expect(accuracySeries([session(64)])).toEqual([64])
  })
})

describe('trend', () => {
  it('stays quiet until there is enough to compare', () => {
    expect(trend([])).toBeNull()
    expect(trend([50, 90, 50])).toBeNull()
  })

  it('reports the move between the two halves', () => {
    expect(trend([40, 40, 60, 60])).toBe(20)
    expect(trend([80, 80, 60, 60])).toBe(-20)
  })
})

describe('sparklinePoints', () => {
  it('draws nothing from nothing', () => {
    expect(sparklinePoints([], 100, 20)).toBe('')
  })

  it('draws a flat line through the middle for a single point', () => {
    expect(sparklinePoints([70], 100, 20)).toBe('0,10 100,10')
  })

  it('spans the full width and stays inside the box', () => {
    const points = sparklinePoints([10, 90, 50], 100, 20).split(' ')
    expect(points).toHaveLength(3)
    expect(Number(points[0]!.split(',')[0])).toBe(0)
    expect(Number(points[2]!.split(',')[0])).toBe(100)
    for (const point of points) {
      const y = Number(point.split(',')[1])
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(20)
    }
  })

  it('does not turn a steady singer into dramatic noise', () => {
    // Three sessions within a point of each other should read as flat,
    // not as a mountain range — the range is floored before scaling.
    const ys = sparklinePoints([80, 81, 80], 100, 20)
      .split(' ')
      .map((p) => Number(p.split(',')[1]))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(6)
  })
})
