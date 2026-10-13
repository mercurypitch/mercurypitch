// ============================================================
// An Echo run: Merc's line about each phrase and the result, and what is kept
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LandedNote, MissedNote, NoteOutcome, Phrase, } from '@/lib/sequence/sequence-engine'
import type { SequenceMetrics, Tendency } from '@/lib/sequence/sequence-metrics'

const kept = vi.hoisted(() => ({
  history: [] as unknown[],
  roots: [] as number[],
  bests: [] as { level: string; run: unknown }[],
  improved: false,
}))

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => kept.history.push(entry),
}))

vi.mock('@/stores/echo-store', () => ({
  rememberEchoRoot: (midi: number) => kept.roots.push(midi),
  recordEchoBest: (level: string, run: unknown) => {
    kept.bests.push({ level, run })
    return { improved: kept.improved }
  },
}))

const { keepEchoRun, phraseLine, resultLine } = await import('./echo-run')

const phrase: Phrase = {
  notes: [60, 64, 67, 72].map((midi, i) => ({
    midi,
    at: i * 0.65,
    seconds: 0.65,
  })),
}

const landed = (index: number): LandedNote => ({
  index,
  landed: true,
  cents: 0,
  onset: index,
  landedAt: index + 0.25,
  timeToLandMs: 250,
})

const missed = (index: number, over: Partial<MissedNote> = {}): MissedNote => ({
  index,
  landed: false,
  missedAt: index + 3,
  cause: 'deadline',
  voiced: true,
  closest: null,
  ...over,
})

const take = (outcomes: NoteOutcome[]) => ({ phrase, outcomes })
const TOL = 35

describe("Merc's line about a phrase", () => {
  it('counts a phrase sung through', () => {
    expect(
      phraseLine(take([landed(0), landed(1), landed(2), landed(3)]), TOL),
    ).toEqual({ moment: 'phraseAll', fields: { count: 4 } })
  })

  it('says it heard nothing when no note had a voice', () => {
    const silent = [0, 1, 2, 3].map((i) =>
      missed(i, { voiced: false, cause: 'deadline' }),
    )

    expect(phraseLine(take(silent), TOL)).toEqual({
      moment: 'silent',
      fields: {},
    })
  })

  it('names a note held near its pitch but flat, or sharp, by its place', () => {
    const flat = take([
      landed(0),
      missed(1, { closest: { midi: 64, cents: -48 } }),
      landed(2),
      landed(3),
    ])
    const sharp = take([
      landed(0),
      landed(1),
      landed(2),
      missed(3, { closest: { midi: 72, cents: 41 } }),
    ])

    expect(phraseLine(flat, TOL)).toEqual({
      moment: 'flatNote',
      fields: { nth: 'second' },
    })
    expect(phraseLine(sharp, TOL)).toEqual({
      moment: 'sharpNote',
      fields: { nth: 'fourth' },
    })
  })

  it('names the note sung and the note asked for when the voice sat on another', () => {
    const other = take([
      landed(0),
      missed(1, { closest: { midi: 62, cents: -200 } }),
      landed(2),
      landed(3),
    ])

    expect(phraseLine(other, TOL)).toEqual({
      moment: 'otherNote',
      fields: { sung: 'D4', target: 'E4' },
    })
  })

  it('prefers the flat or sharp note to another note, wherever it falls', () => {
    const both = take([
      missed(0, { closest: { midi: 63, cents: 300 } }),
      landed(1),
      missed(2, { closest: { midi: 67, cents: -60 } }),
      landed(3),
    ])

    expect(phraseLine(both, TOL)).toEqual({
      moment: 'flatNote',
      fields: { nth: 'third' },
    })
  })

  it('tells a voice that moved on before it landed to land on each note', () => {
    const slid = take([landed(0), missed(1), landed(2), landed(3)])
    const inBand = take([
      landed(0),
      missed(1, { closest: { midi: 64, cents: 12 } }),
      landed(2),
      landed(3),
    ])

    expect(phraseLine(slid, TOL).moment).toBe('slid')
    expect(phraseLine(inBand, TOL).moment).toBe('slid')
  })

  it('counts the notes when the voice stopped before them', () => {
    // The note after the last one landed heard that note still sounding:
    // voiced, but no try at its own pitch.
    const stopped = take([
      landed(0),
      missed(1, { voiced: true, cause: 'silence' }),
      missed(2, { voiced: false, cause: 'silence' }),
      missed(3, { voiced: false, cause: 'silence' }),
    ])

    expect(phraseLine(stopped, TOL)).toEqual({
      moment: 'phraseSome',
      fields: { landed: 1, count: 4 },
    })
  })

  it('counts the notes when the misses had no voice at all', () => {
    const someSilent = take([
      landed(0),
      landed(1),
      missed(2, { voiced: false, cause: 'silence' }),
      missed(3, { voiced: false, cause: 'silence' }),
    ])

    expect(phraseLine(someSilent, TOL)).toEqual({
      moment: 'phraseSome',
      fields: { landed: 2, count: 4 },
    })
  })
})

const tendency = (over: Partial<Tendency> = {}): Tendency => ({
  notes: 0,
  landed: 0,
  meanCents: null,
  ...over,
})

const metrics = (over: Partial<SequenceMetrics> = {}): SequenceMetrics => ({
  notes: 20,
  landed: 15,
  missed: 5,
  accuracy: 84,
  tendencies: {
    leapsUp: tendency(),
    stepsDown: tendency(),
    lastNotes: tendency({ notes: 5, landed: 4 }),
  },
  rhythm: null,
  ...over,
})

describe("Merc's line over the result", () => {
  it('names every note on pitch first, even over a new best', () => {
    expect(
      resultLine(metrics({ landed: 20, missed: 0 }), true, 'Singer'),
    ).toEqual({
      moment: 'resultAll',
      fields: { landed: 20, total: 20 },
    })
  })

  it('names a new best at its level', () => {
    expect(resultLine(metrics(), true, 'Singer')).toEqual({
      moment: 'newBest',
      fields: { landed: 15, total: 20, level: 'Singer' },
    })
  })

  it('names the clearest tendency: flat leaps, then sharp steps down, then the ends', () => {
    const leaps = metrics({
      tendencies: {
        ...metrics().tendencies,
        leapsUp: tendency({ notes: 4, landed: 3, meanCents: -22 }),
        stepsDown: tendency({ notes: 4, landed: 4, meanCents: 30 }),
      },
    })
    const steps = metrics({
      tendencies: {
        ...metrics().tendencies,
        stepsDown: tendency({ notes: 4, landed: 4, meanCents: 18 }),
      },
    })
    const ends = metrics({
      tendencies: {
        ...metrics().tendencies,
        lastNotes: tendency({ notes: 5, landed: 1 }),
      },
    })

    expect(resultLine(leaps, false, 'Singer').moment).toBe('resultLeapsFlat')
    expect(resultLine(steps, false, 'Singer').moment).toBe('resultStepsSharp')
    expect(resultLine(ends, false, 'Singer').moment).toBe('resultEnds')
  })

  it('needs two landed notes of a kind before it calls it a tendency', () => {
    const one = metrics({
      tendencies: {
        ...metrics().tendencies,
        leapsUp: tendency({ notes: 3, landed: 1, meanCents: -40 }),
      },
    })

    expect(resultLine(one, false, 'Singer')).toEqual({
      moment: 'result',
      fields: { landed: 15, total: 20 },
    })
  })
})

describe('keeping a run', () => {
  beforeEach(() => {
    kept.history = []
    kept.roots = []
    kept.bests = []
    kept.improved = false
  })

  it('keeps the run in the history, its root, and its best at the level', () => {
    kept.improved = true
    const result = keepEchoRun(
      'professional',
      metrics({ rhythm: { inTime: 12, notes: 20 } }),
      62,
      1_000,
    )

    expect(result).toEqual({ improved: true })
    expect(kept.history).toEqual([
      {
        type: 'echo-stars',
        score: 75,
        metrics: { landed: 15, notes: 20, accuracy: 84, inTime: 12 },
        completedAt: 1_000,
      },
    ])
    expect(kept.roots).toEqual([62])
    expect(kept.bests).toEqual([
      {
        level: 'professional',
        run: { landed: 15, notes: 20, accuracy: 84, at: 1_000 },
      },
    ])
  })

  it('keeps a run that landed nothing in the history, but never as a best', () => {
    const result = keepEchoRun(
      'learning',
      metrics({ landed: 0, missed: 20, accuracy: null }),
      57,
      2_000,
    )

    expect(result).toEqual({ improved: false })
    expect(kept.history).toEqual([
      {
        type: 'echo-stars',
        score: 0,
        metrics: { landed: 0, notes: 20 },
        completedAt: 2_000,
      },
    ])
    expect(kept.bests).toEqual([])
  })
})
