import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundOutcome } from './first-note-machine'
import { foundLine, keepFirstNoteRun, resultMoment, resultsBySong, summarizeRun, } from './first-note-run'
import type { FirstNoteRound } from './first-note-songs'
import { FIRST_NOTE_SONGS, planRun } from './first-note-songs'

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

const { firstNoteBest, resetFirstNoteStoreForTests } =
  await import('@/stores/first-note-store')

const ROUNDS: readonly FirstNoteRound[] = planRun(FIRST_NOTE_SONGS, () => 0.5)

/** A round's outcome: where the singer came in, and whether they landed. */
function round(
  index: number,
  entryCents: number | null,
  landed: boolean,
  seconds: number | null = landed ? 1 : null,
): RoundOutcome {
  return {
    round: ROUNDS[index],
    entry:
      entryCents === null
        ? null
        : { cents: entryCents, onNote: Math.abs(entryCents) <= 35 },
    landed,
    seconds,
    voiced: entryCents !== null || landed,
    heardAgain: false,
  }
}

beforeEach(() => {
  recorded.calls = []
  localStorage.removeItem('mp_first_note_bests')
  resetFirstNoteStoreForTests()
})

describe('a finished First note run', () => {
  it('counts entries on the note, notes found, and how far off the entries sat', () => {
    const summary = summarizeRun([
      round(0, 10, true, 0.6),
      round(1, -200, true, 2.2),
      round(2, 30, true, 0.8),
      round(3, null, false),
    ])
    expect(summary.onNote).toBe(2)
    expect(summary.found).toBe(3)
    expect(summary.rounds).toBe(4)
    expect(summary.cents).toBeCloseTo((10 + 200 + 30) / 3)
    expect(summary.seconds).toBeCloseTo((0.6 + 2.2 + 0.8) / 3)
    expect(summary.voiced).toBe(true)
  })

  it('says the notes found, and at which level', () => {
    const all = summarizeRun([round(0, 0, true), round(1, 50, true)])
    expect(foundLine(all, 'Singer')).toBe('All 2 found, at Singer')
    const some = summarizeRun([round(0, 0, true), round(1, null, false)])
    expect(foundLine(some, 'Singer')).toBe('1 of 2 found, at Singer')
    expect(foundLine(some, '')).toBe('1 of 2 found')
  })

  it('keeps a run with a voice: the history, and the level best', () => {
    const summary = summarizeRun([
      round(0, 10, true),
      round(1, -60, true),
      round(2, null, false),
      round(3, 0, true),
      round(4, null, false),
      round(5, 20, true),
    ])
    const kept = keepFirstNoteRun('singer', summary, 1000)
    expect(kept).toEqual({ kept: true, improved: false })
    expect(recorded.calls).toHaveLength(1)
    expect(recorded.calls[0]).toMatchObject({
      type: 'first-note-stage',
      score: 50,
      metrics: { entriesOnNote: 3, entriesFound: 4, rounds: 6 },
    })
    expect(firstNoteBest('singer')).toMatchObject({
      onNote: 3,
      found: 4,
      rounds: 6,
    })
  })

  it('keeps a shorter run in the history, against its own entries, and never as a best', () => {
    // The singer's own songs, with two entries between them.
    const summary = summarizeRun([round(0, 10, true), round(1, 0, true)])
    expect(keepFirstNoteRun('singer', summary, 1000)).toEqual({
      kept: true,
      improved: false,
    })
    expect(recorded.calls[0]).toMatchObject({
      score: 100,
      metrics: { entriesOnNote: 2, rounds: 2 },
    })
    expect(firstNoteBest('singer')).toBeNull()
  })

  it('keeps nothing from a run with no voice in it', () => {
    const summary = summarizeRun([round(0, null, false), round(1, null, false)])
    expect(keepFirstNoteRun('singer', summary)).toEqual({
      kept: false,
      improved: false,
    })
    expect(recorded.calls).toEqual([])
    expect(firstNoteBest('singer')).toBeNull()
  })

  it('tells each song apart: its entries on the note, and where it began', () => {
    // The run plays a song's two entries together, in its own order.
    const outcomes = ROUNDS.map((_, i) => round(i, i % 2 === 0 ? 5 : 80, true))
    const songs = resultsBySong(outcomes)
    expect(songs).toHaveLength(3)
    for (const [i, result] of songs.entries()) {
      expect(result.song).toBe(ROUNDS[i * 2].song)
      expect(result.rounds).toBe(2)
      expect(result.onNote).toBe(1)
      expect(result.first).toBe(ROUNDS[i * 2].entry)
    }
  })

  it('gives Merc the moment the run earned', () => {
    const kept = { kept: true, improved: false }
    const all = summarizeRun([round(0, 0, true), round(1, 5, true)])
    expect(resultMoment(all, kept)).toBe('resultAll')
    const none = summarizeRun([round(0, -300, true), round(1, 400, false)])
    expect(resultMoment(none, kept)).toBe('resultNone')
    const most = summarizeRun([
      round(0, 0, true),
      round(1, 0, true),
      round(2, 300, true),
    ])
    expect(resultMoment(most, kept)).toBe('resultMost')
    const some = summarizeRun([
      round(0, 0, true),
      round(1, 300, true),
      round(2, 300, true),
    ])
    expect(resultMoment(some, kept)).toBe('resultSome')
    expect(resultMoment(all, { kept: true, improved: true })).toBe('newBest')
    expect(resultMoment(all, { kept: false, improved: false })).toBe(
      'silentRun',
    )
  })
})
