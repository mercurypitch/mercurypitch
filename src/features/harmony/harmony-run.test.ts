import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARMONY_BESTS_KEY, harmonyBest, resetHarmonyStoreForTests, } from '@/stores/harmony-store'
import type { HarmonyLine } from './harmony-line'
import type { LineOutcome } from './harmony-machine'
import { callMoment, detailLine, harmonyRows, keepHarmonyRun, landedMoment, missedFields, missedMoment, resultMoment, summarizeRun, } from './harmony-run'

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recorded.calls.push(entry),
}))

const line = (index: number, below = false): HarmonyLine => ({
  index,
  tonic: 48,
  merc: [55, 57, 59, 57],
  harmony: below ? [52, 53, 55, 53] : [59, 60, 62, 60],
  below,
})

const outcome = (
  index: number,
  notes: boolean[],
  extra: Partial<LineOutcome> = {},
): LineOutcome => {
  const miss = notes.indexOf(false)
  return {
    line: line(index),
    notes,
    inHarmony: miss < 0,
    firstMiss: miss < 0 ? null : miss,
    short: null,
    voiced: true,
    heardAgain: false,
    ...extra,
  }
}

const RUN: LineOutcome[] = [
  outcome(0, [true, true, true, true]),
  outcome(1, [true, true, true, true]),
  outcome(2, [true, true, false, true]),
  outcome(3, [true, true, true, true]),
  outcome(4, [true, false, false, true]),
  outcome(5, [true, true, true, true]),
]

describe('a Harmony run', () => {
  beforeEach(() => {
    recorded.calls = []
    localStorage.removeItem(HARMONY_BESTS_KEY)
    resetHarmonyStoreForTests()
  })
  afterEach(() => vi.restoreAllMocks())

  it('counts lines in harmony and notes, as the result card says them', () => {
    const summary = summarizeRun(RUN)
    expect(summary).toMatchObject({
      inHarmony: 4,
      lines: 6,
      notesLanded: 21,
      notes: 24,
      anyBelow: false,
      voiced: true,
    })
    expect(detailLine(summary)).toBe('21 of 24 notes a third above')
    const mixed = summarizeRun([
      ...RUN.slice(0, 5),
      { ...RUN[5], line: line(5, true) },
    ])
    expect(detailLine(mixed)).toBe('21 of 24 notes a third away')
  })

  it("lists each line by its harmony's notes and how many it sang", () => {
    const rows = harmonyRows(RUN)
    expect(rows[0]).toMatchObject({
      label: 'Line 1',
      names: 'B3 C4 D4 C4',
      landed: 4,
    })
    expect(rows[4]).toMatchObject({ label: 'Line 5', landed: 2 })
  })

  it('keeps a voiced run: the history once, and the best', () => {
    const kept = keepHarmonyRun('singer', 'together', summarizeRun(RUN), 5)
    expect(kept).toEqual({ kept: true, improved: false })
    expect(recorded.calls).toEqual([
      {
        type: 'harmony-lake',
        score: 88,
        metrics: {
          linesInHarmony: 4,
          lines: 6,
          notesInHarmony: 21,
          notes: 24,
          sungTogether: 1,
        },
        completedAt: 5,
      },
    ])
    expect(harmonyBest('singer')).toMatchObject({ inHarmony: 4, notes: 24 })
    const better = summarizeRun(
      RUN.map((o) => ({
        ...o,
        notes: [true, true, true, true],
        inHarmony: true,
      })),
    )
    expect(keepHarmonyRun('singer', 'turns', better, 6).improved).toBe(true)
  })

  it('keeps nothing of a run with no voice in it', () => {
    const silent = summarizeRun(RUN.map((o) => ({ ...o, voiced: false })))
    expect(keepHarmonyRun('singer', 'turns', silent)).toEqual({
      kept: false,
      improved: false,
    })
    expect(recorded.calls).toEqual([])
    expect(resultMoment(silent, { kept: false, improved: false })).toBe(
      'silentRun',
    )
  })

  it("picks Merc's lines for the call, the line and the result", () => {
    expect(callMoment(line(0), 'turns', true)).toBe('callBoth')
    expect(callMoment(line(0), 'turns', false)).toBe('call')
    expect(callMoment(line(0), 'together', false)).toBe('callTogether')
    expect(callMoment(line(0, true), 'turns', false)).toBe('callBelow')
    expect(landedMoment(line(0, true))).toBe('landedBelow')
    expect(missedMoment(outcome(0, [false], { voiced: false }))).toBe(
      'missedSilent',
    )
    expect(missedMoment(outcome(0, [false], { short: true }))).toBe(
      'missedShort',
    )
    expect(missedMoment(outcome(0, [false], { short: false }))).toBe(
      'missedOver',
    )
    const summary = summarizeRun(RUN)
    const kept = { kept: true, improved: false }
    expect(resultMoment(summary, kept)).toBe('resultMost')
    expect(resultMoment(summary, { kept: true, improved: true })).toBe(
      'newBest',
    )
  })

  it('names the missed pair: his note, then the third from it', () => {
    expect(missedFields(RUN[2])).toEqual({
      from: 'B3',
      note: 'D4',
      way: 'above',
    })
    expect(missedFields(RUN[0])).toBeNull()
  })
})
