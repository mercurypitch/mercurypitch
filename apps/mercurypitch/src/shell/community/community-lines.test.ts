// ============================================================
// Community's words: the rows, the profile's figures and the states
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'
import type { ProgressRun } from '@/features/progress/run-kinds'
import type { MelodyItem } from '@/types'
import { melodyFacts, memberSince, noteCount, profileFigures, publishedLine, resultAverage, resultFacts, sharedOn, } from './community-lines'

const NOW = Date.parse('2026-11-02T12:00:00Z')

function note(id: number, isRest = false): MelodyItem {
  return {
    id,
    note: { midi: 60, name: 'C', octave: 4, freq: 261.63 },
    startBeat: id,
    duration: 1,
    ...(isRest ? { isRest: true } : {}),
  }
}

function melody(patch: Partial<SharedMelodyView> = {}): SharedMelodyView {
  return {
    id: 'm1',
    userId: 'ada',
    name: 'Moon River',
    items: [note(1), note(2), note(3, true)],
    author: 'Ada',
    tags: [],
    date: Date.parse('2026-10-30T10:00:00Z'),
    ...patch,
  }
}

function result(patch: Partial<SharedSessionView> = {}): SharedSessionView {
  return {
    id: 'r1',
    userId: 'ben',
    name: 'Morning scales',
    items: [],
    author: 'Ben',
    results: [80, 71, 90],
    date: Date.parse('2026-10-31T10:00:00Z'),
    ...patch,
  }
}

function run(score: number, completedAt: number): ProgressRun {
  return { kind: 'practice', score, completedAt, hasNoteDetail: false }
}

describe('a share’s row', () => {
  it('says who shared a melody, how many notes it holds, and when', () => {
    expect(noteCount(melody())).toBe(2)
    const [by, notes, when] = melodyFacts(melody(), NOW)
    expect([by, notes]).toEqual(['by Ada', '2 notes'])
    expect(when).toMatch(/^(?:30 Oct|Oct 30)$/u)
  })

  it('says who shared a result, how many runs, and when', () => {
    const [by, runs, when] = resultFacts(result(), NOW)
    expect([by, runs]).toEqual(['by Ben', '3 runs'])
    expect(when).toMatch(/^(?:31 Oct|Oct 31)$/u)
    expect(resultFacts(result({ results: [64] }), NOW)[1]).toBe('1 run')
  })

  it('says nothing of a day it cannot read', () => {
    expect(resultFacts(result({ date: Number.NaN }), NOW)).toEqual([
      'by Ben',
      '3 runs',
    ])
  })

  it('names the year of a share from another year', () => {
    expect(sharedOn(Date.parse('2025-03-04T10:00:00Z'), NOW)).toMatch(/2025/u)
    expect(sharedOn(Date.parse('2026-03-04T10:00:00Z'), NOW)).not.toMatch(
      /2026/u,
    )
  })

  it('averages a result’s runs, rounded', () => {
    expect(resultAverage(result())).toBe(80)
    expect(resultAverage(result({ results: [] }))).toBe(0)
  })
})

describe('the profile’s figures', () => {
  it('shows nothing, never a confident zero, for a singer with no runs', () => {
    expect(profileFigures([], 0, 3)).toEqual([])
  })

  it('counts the runs and reads the best and the recent average', () => {
    const runs = [70, 90, 60, 80, 50, 40].map((score, i) => run(score, i))
    expect(profileFigures(runs, runs.length, 0)).toEqual([
      { id: 'runs', value: '6', label: 'runs' },
      { id: 'best', value: '90%', label: 'best' },
      // The last five in time: 90, 60, 80, 50, 40.
      { id: 'recent', value: '64%', label: 'recent average' },
    ])
  })

  it('counts every run the account holds, and adds the streak once there is one', () => {
    const figures = profileFigures([run(70, 1)], 240, 1)
    expect(figures[0]).toEqual({ id: 'runs', value: '240', label: 'runs' })
    expect(figures.at(-1)).toEqual({
      id: 'streak',
      value: '1',
      label: 'day streak',
    })
    expect(profileFigures([run(70, 1)], 1, 5).at(-1)?.label).toBe(
      'days running',
    )
  })

  it('says what the singer shared, and nothing when that is nothing', () => {
    expect(publishedLine({ melodies: 2, sessions: 1 })).toBe(
      'You shared 2 melodies and 1 result',
    )
    expect(publishedLine({ melodies: 0, sessions: 3 })).toBe(
      'You shared 3 results',
    )
    expect(publishedLine({ melodies: 0, sessions: 0 })).toBeNull()
    expect(publishedLine(null)).toBeNull()
  })

  it('says since when the singer has been a member, once it is known', () => {
    expect(memberSince(Date.parse('2026-10-05T10:00:00Z'))).toMatch(
      /^Member since .*2026$/u,
    )
    expect(memberSince(null)).toBeNull()
  })
})
