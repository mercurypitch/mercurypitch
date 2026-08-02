// ============================================================
// Practice activity
// ============================================================
//
// The activity calendar and heatmap read `sessionResults`, a local signal
// that ONLY session mode appends to. Exercises and challenges write
// SessionRecords and nothing else, so a singer could practise every day
// through the drills and the tracker stayed blank — which is what the
// owner reported. These pin the union.

import { describe, expect, it } from 'vitest'
import type { SessionRecord } from '@/db/entities'
import { activityByDay, describeDay, localDayKey, } from '@/features/practice-intelligence/practice-activity'

const record = (over: Partial<SessionRecord>): SessionRecord =>
  ({
    id: 'r1',
    userId: 'u1',
    melodyName: 'Scale',
    startedAt: '2026-08-01T10:00:00.000Z',
    endedAt: '2026-08-01T10:05:00.000Z',
    score: 80,
    accuracy: 80,
    notesHit: 8,
    notesTotal: 10,
    streak: 1,
    results: [],
    ...over,
  }) as SessionRecord

describe('activityByDay', () => {
  it('counts every source, not just session mode', () => {
    // THE REGRESSION: the tracker only ever saw 'practice'.
    const day = '2026-08-01T12:00:00.000Z'
    const map = activityByDay([
      record({ id: '1', endedAt: day, source: 'practice' }),
      record({ id: '2', endedAt: day, source: 'exercise' }),
      record({ id: '3', endedAt: day, source: 'challenge' }),
      record({ id: '4', endedAt: day, source: 'weekly' }),
    ])
    const entry = map.get(localDayKey(day))!
    expect(entry.count).toBe(4)
    expect([...entry.sources].sort()).toEqual([
      'challenge',
      'exercise',
      'practice',
      'weekly',
    ])
  })

  it('treats a row with no source as free practice', () => {
    // Rows predate the column; they must not vanish from the calendar.
    const map = activityByDay([record({ source: undefined })])
    const entry = [...map.values()][0]!
    expect(entry.count).toBe(1)
    expect([...entry.sources]).toEqual(['practice'])
  })

  it('keeps the best score of the day', () => {
    const day = '2026-08-01T12:00:00.000Z'
    const map = activityByDay([
      record({ id: '1', endedAt: day, score: 62 }),
      record({ id: '2', endedAt: day, score: 91 }),
      record({ id: '3', endedAt: day, score: 44 }),
    ])
    expect(map.get(localDayKey(day))!.bestScore).toBe(91)
  })

  it('separates different days', () => {
    const map = activityByDay([
      record({ id: '1', endedAt: '2026-08-01T12:00:00.000Z' }),
      record({ id: '2', endedAt: '2026-08-02T12:00:00.000Z' }),
    ])
    expect(map.size).toBe(2)
  })

  it('falls back to startedAt when a run never ended cleanly', () => {
    const map = activityByDay([
      record({
        startedAt: '2026-08-01T12:00:00.000Z',
        endedAt: undefined as never,
      }),
    ])
    expect(map.size).toBe(1)
  })

  it('skips a record whose timestamp is unusable rather than throwing', () => {
    expect(activityByDay([record({ endedAt: 'not-a-date' })]).size).toBe(0)
  })

  it('is empty for no records', () => {
    expect(activityByDay([]).size).toBe(0)
  })
})

describe('localDayKey', () => {
  it('buckets by the singer local day, not by UTC', () => {
    // A 23:30 run east of UTC would land on tomorrow under toISOString(),
    // putting the square on a day the singer had not reached yet.
    const late = new Date(2026, 7, 1, 23, 30, 0)
    expect(localDayKey(late.toISOString())).toBe('2026-08-01')

    const early = new Date(2026, 7, 1, 0, 30, 0)
    expect(localDayKey(early.toISOString())).toBe('2026-08-01')
  })

  it('pads month and day so keys sort and compare as strings', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12).toISOString())).toBe(
      '2026-01-05',
    )
  })

  it('returns empty for an unparseable timestamp', () => {
    expect(localDayKey('nonsense')).toBe('')
  })
})

describe('describeDay', () => {
  it('names what was practised and how it went', () => {
    const map = activityByDay([
      record({ id: '1', source: 'exercise', score: 70 }),
      record({ id: '2', source: 'challenge', score: 88 }),
    ])
    const text = describeDay([...map.values()][0])
    expect(text).toContain('2 runs')
    expect(text).toContain('challenge')
    expect(text).toContain('exercise')
    expect(text).toContain('88%')
  })

  it('says so plainly on a rest day', () => {
    expect(describeDay(undefined)).toBe('No practice')
  })

  it('does not say "1 runs"', () => {
    const map = activityByDay([record({ source: 'practice' })])
    expect(describeDay([...map.values()][0])).toContain('1 run (')
  })
})
