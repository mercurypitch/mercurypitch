import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoundOutcome } from './home-note-machine'

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

const { resetHomeNoteStoreForTests, homeNoteBest } =
  await import('@/stores/home-note-store')
const { detailLine, isQuick, keepHomeNoteRun, resultMoment, summarizeRun } =
  await import('./home-note-run')

function found(home: number, seconds: number, cents: number): RoundOutcome {
  return {
    round: { index: 0, home },
    landed: true,
    cents,
    seconds,
    voiced: true,
    heardAgain: false,
  }
}

function missed(home: number, voiced = true): RoundOutcome {
  return {
    round: { index: 0, home },
    landed: false,
    cents: null,
    seconds: null,
    voiced,
    heardAgain: false,
  }
}

describe('a finished Home note run', () => {
  beforeEach(() => {
    recorded.calls = []
    localStorage.clear()
    resetHomeNoteStoreForTests()
  })

  it('counts the keys found, and how quickly and how close they were', () => {
    const summary = summarizeRun([
      found(60, 1.2, -10),
      missed(62),
      found(64, 2.4, 20),
    ])
    expect(summary).toMatchObject({
      found: 2,
      rounds: 3,
      cents: 15,
      voiced: true,
    })
    expect(summary.seconds).toBeCloseTo(1.8)
    expect(detailLine(summary)).toBe('Found in 1.8 s on average')
  })

  it('has no time or distance when nothing was found', () => {
    const summary = summarizeRun([missed(60), missed(62)])
    expect(summary.seconds).toBeNull()
    expect(summary.cents).toBeNull()
    expect(detailLine(summary)).toBeNull()
  })

  it('keeps a run in the history, scored as the share of keys found', () => {
    const summary = summarizeRun([
      found(60, 1.2, -10),
      missed(62),
      found(64, 2.4, 20),
      found(65, 0.9, 4),
    ])
    expect(keepHomeNoteRun('singer', summary, 1000)).toEqual({
      kept: true,
      improved: false,
    })
    expect(recorded.calls).toEqual([
      {
        type: 'home-note-lighthouse',
        score: 75,
        metrics: {
          roundsFound: 3,
          rounds: 4,
          secondsToHome: 1.5,
          centsFromHome: 34 / 3,
        },
        completedAt: 1000,
      },
    ])
    expect(homeNoteBest('singer')).toEqual({
      found: 3,
      rounds: 4,
      seconds: 1.5,
      at: 1000,
    })
  })

  it('keeps nothing of a run in which no voice was heard', () => {
    const summary = summarizeRun([missed(60, false), missed(62, false)])
    expect(keepHomeNoteRun('singer', summary)).toEqual({
      kept: false,
      improved: false,
    })
    expect(recorded.calls).toEqual([])
    expect(resultMoment(summary, { kept: false, improved: false })).toBe(
      'silentRun',
    )
  })

  it('says a new best only when it beats one the level had', () => {
    const first = summarizeRun([found(60, 2, 0), missed(62)])
    expect(keepHomeNoteRun('learning', first).improved).toBe(false)
    const better = summarizeRun([found(60, 2, 0), found(62, 1, 0)])
    const kept = keepHomeNoteRun('learning', better)
    expect(kept.improved).toBe(true)
    expect(resultMoment(better, kept)).toBe('newBest')
    // Another level's best is its own.
    expect(homeNoteBest('professional')).toBeNull()
  })

  it("picks Merc's result line from how many keys were found", () => {
    const kept = { kept: true, improved: false }
    const all = summarizeRun([found(60, 1, 0), found(62, 1, 0)])
    expect(resultMoment(all, kept)).toBe('resultAll')
    const most = summarizeRun([found(60, 1, 0), missed(62)])
    expect(resultMoment(most, kept)).toBe('resultMost')
    const some = summarizeRun([found(60, 1, 0), missed(62), missed(64)])
    expect(resultMoment(some, kept)).toBe('resultSome')
    const none = summarizeRun([missed(60), missed(62)])
    expect(resultMoment(none, kept)).toBe('resultNone')
  })

  it('calls a landing quick only on the first hearing, inside 1.2 s', () => {
    expect(isQuick(found(60, 1.1, 0))).toBe(true)
    expect(isQuick(found(60, 1.3, 0))).toBe(false)
    expect(isQuick({ ...found(60, 0.8, 0), heardAgain: true })).toBe(false)
    expect(isQuick(missed(60))).toBe(false)
  })
})
