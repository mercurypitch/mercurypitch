// ── Jam catalogue tests ───────────────────────────────────────────────
// The adapter that lets a jam room run exercises, the weekly challenge and
// an Ascent week, not just saved melodies. What matters here is that the
// notes it builds land in the host's range, on the right beats, in the
// shape MelodyItem actually wants.

import { describe, expect, it } from 'vitest'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, EXERCISE_VIBRATO, EXERCISE_WARMUP, } from '@/features/exercises/types'
import type { PathWeek } from '@/features/path/path-content'
import { jamAscentEntries, jamExerciseEntries, jamMelodyEntries, jamWeeklyEntry, } from '@/lib/jam/jam-catalog'
import type { MelodyData, MelodyItem } from '@/types'

function entryNamed(octave: number, name: string) {
  const found = jamExerciseEntries(octave).find((e) => e.name === name)
  if (found === undefined) throw new Error(`no jam entry named ${name}`)
  return found
}

describe('jamExerciseEntries', () => {
  it('builds the scale runner at the requested octave', () => {
    // Alto's default octave is 3, so a C4-written drill lands on C3.
    const melody = entryNamed(3, 'Scale Runner').build()
    expect(melody.items).toHaveLength(8)
    expect(melody.items[0]!.note.octave).toBe(3)
    expect(melody.items[0]!.note.name).toBe('C')
    // Last note of the C-major run is the octave above the first.
    expect(melody.items[7]!.note.midi - melody.items[0]!.note.midi).toBe(12)
  })

  it('transposes down for a bass and up for a soprano', () => {
    const low = entryNamed(2, 'Scale Runner').build()
    const high = entryNamed(4, 'Scale Runner').build()
    expect(high.items[0]!.note.midi - low.items[0]!.note.midi).toBe(24)
  })

  it('stores a bare note letter, never one carrying its own octave', () => {
    // Storing "G4" as the name renders "G44" -- the trap weekly-service
    // documents. Guard it here too, since this builder is a second source.
    for (const entry of jamExerciseEntries(4)) {
      for (const item of entry.build().items) {
        expect(item.note.name).toMatch(/^[A-G]#?$/)
      }
    }
  })

  it('lays notes out sequentially, scaled by the drill beat length', () => {
    // Long Note is a single 8-beat note; Scale Runner is 8 one-beat notes.
    const long = entryNamed(4, 'Long Note').build()
    expect(long.items).toHaveLength(1)
    expect(long.items[0]!.duration).toBe(8)
    expect(long.items[0]!.startBeat).toBe(0)

    const scale = entryNamed(4, 'Scale Runner').build()
    scale.items.forEach((item: MelodyItem, i: number) => {
      expect(item.startBeat).toBe(i)
      expect(item.duration).toBe(1)
    })
  })

  it('leaves out the drills a piano roll cannot express', () => {
    // Vibrato scores a rate and the warmup is a coached multi-block flow;
    // neither reduces to a target contour, so neither may appear.
    const ids = jamExerciseEntries(4).map((e) => e.id)
    expect(ids).not.toContain(`exercise:${EXERCISE_VIBRATO}`)
    expect(ids).not.toContain(`exercise:${EXERCISE_WARMUP}`)
    expect(ids).toContain(`exercise:${EXERCISE_SCALE_RUNNER}`)
  })
})

describe('jamWeeklyEntry', () => {
  const items: MelodyItem[] = [
    {
      id: 1,
      note: { midi: 67, name: 'G', octave: 4, freq: 392 },
      duration: 1,
      startBeat: 0,
    },
  ]

  const weekly = {
    id: 'w1',
    title: 'Sing the Legend',
    targetItems: items,
    targetScore: 80,
    startsAt: '2026-07-27T00:00:00.000Z',
  } as WeeklyChallenge

  it('passes the challenge notes through untransposed', () => {
    // A shared board only means something if everyone sang the same notes,
    // so the weekly is the one shelf the host's range must not touch.
    const entry = jamWeeklyEntry(weekly)
    expect(entry?.build().items).toEqual(items)
  })

  it('is absent when no challenge is running or the API is unreachable', () => {
    expect(jamWeeklyEntry(null)).toBeNull()
  })

  it('is absent when the challenge carries no notes', () => {
    expect(jamWeeklyEntry({ ...weekly, targetItems: [] })).toBeNull()
  })
})

describe('jamAscentEntries', () => {
  const week = {
    order: 2,
    title: 'Breath & Power',
    exercises: [EXERCISE_LONG_NOTE, EXERCISE_VIBRATO, EXERCISE_SCALE_RUNNER],
  } as PathWeek

  it("keeps the week's runnable drills and drops the rest", () => {
    const entries = jamAscentEntries(week, 4)
    expect(entries.map((e) => e.name)).toEqual(['Long Note', 'Scale Runner'])
  })

  it('names the week in the detail line', () => {
    expect(jamAscentEntries(week, 4)[0]!.detail).toContain('Week 2')
  })

  it('is empty when no path is running', () => {
    expect(jamAscentEntries(null, 4)).toEqual([])
  })
})

describe('jamMelodyEntries', () => {
  it('hands back the saved melody itself, not a copy', () => {
    const melody = {
      id: 'm1',
      name: 'My Tune',
      bpm: 120,
      key: 'G',
      scaleType: 'minor',
      createdAt: 0,
      updatedAt: 0,
      items: [],
    } as MelodyData
    const entry = jamMelodyEntries([melody])[0]!
    expect(entry.build()).toBe(melody)
    expect(entry.detail).toBe('120 bpm · G minor')
  })
})
