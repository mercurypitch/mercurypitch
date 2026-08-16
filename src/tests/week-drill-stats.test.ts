// ============================================================
// "Drills this week" tells one story on every device
// (CLAUDE-JOURNEY-009)
// ============================================================
//
// Repro: signed in on a second device, Home reported zero drills while
// Progress showed the full synced history — the strip counted only the
// device-local exercise mirror. It now reads the synced session records
// first and keeps the local mirror as the fallback when the record read
// lags, fails, or is still loading.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { weekDrillStats } from '@/features/home/week-drill-stats'

const NOW = Date.UTC(2026, 7, 17, 12, 0, 0)
const DAY = 86_400_000

function rec(daysAgo: number, score: number, source = 'exercise') {
  return { source, endedAt: new Date(NOW - daysAgo * DAY).toISOString(), score }
}

function loc(daysAgo: number, score: number) {
  return { completedAt: NOW - daysAgo * DAY, score }
}

describe('weekDrillStats', () => {
  it('reports the synced week on a device with no local history', () => {
    // THE second-device case: local mirror empty, records synced down.
    const stats = weekDrillStats(NOW, [], [rec(1, 80), rec(2, 90), rec(3, 70)])
    expect(stats).toEqual({ runs: 3, avgScore: 80 })
  })

  it('falls back to the local mirror while the record read is loading', () => {
    const stats = weekDrillStats(NOW, [loc(1, 60), loc(2, 80)], undefined)
    expect(stats).toEqual({ runs: 2, avgScore: 70 })
  })

  it('keeps the local mirror when it has seen more than the record read', () => {
    // A failed or lagging DB read must not zero a device that practised.
    const stats = weekDrillStats(NOW, [loc(1, 60), loc(2, 80)], [rec(1, 60)])
    expect(stats).toEqual({ runs: 2, avgScore: 70 })
  })

  it('counts only drill records, not challenge or melody sessions', () => {
    const stats = weekDrillStats(
      NOW,
      [],
      [
        rec(1, 80),
        rec(1, 95, 'challenge'),
        rec(2, 90, 'weekly'),
        rec(2, 88, 'practice'),
      ],
    )
    expect(stats).toEqual({ runs: 1, avgScore: 80 })
  })

  it('keeps the seven-day window on both sources', () => {
    const stats = weekDrillStats(
      NOW,
      [loc(8, 10)],
      [rec(1, 90), rec(8, 10), rec(30, 10)],
    )
    expect(stats).toEqual({ runs: 1, avgScore: 90 })
  })

  it('shows a dash-worthy null average for an empty week', () => {
    expect(weekDrillStats(NOW, [], [])).toEqual({ runs: 0, avgScore: null })
  })
})

describe('HomePage routes the strip through the shared source', () => {
  it('reads session records, not the local mirror alone', () => {
    // The strip lives deep in a page too heavy to render here; pin the
    // wiring in source (the export-filenames idiom). The page must build
    // its week stats from weekDrillStats fed by loadSessionRecords.
    const source = readFileSync('src/pages/HomePage.tsx', 'utf8')
    expect(source).toContain('weekDrillStats(')
    expect(source).toContain('loadSessionRecords')
  })
})
