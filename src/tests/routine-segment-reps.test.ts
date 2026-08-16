// ============================================================
// Routine reps — the prescribed session is worth five minutes
// ============================================================
//
// The seven-day run found the beginner loop unwinnable by doing what the app
// says: the length picker sells "~5 min", the streak wants five scored
// minutes, and the routine handed out a session that was over in about two
// and a half. A segment ticked off after ONE run of the right drill, and a
// long note takes five seconds.
//
// So these tests hold two promises at once. Every prescribed route — every
// generated day, every focus template, every length — has to ask for at least
// MIN_SESSION_SEC of drilling. And a segment has to bank its runs rather than
// close on the first, without moving the finish line under a routine that was
// persisted before reps existed.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyRoutines } from '@/data/routine-templates'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, EXERCISE_VIBRATO, EXERCISE_WARMUP, } from '@/features/exercises/types'
import { applyReps, DEFAULT_TYPICAL_RUN_SEC, MAX_REPS, MAX_REPS_FLOOR, MIN_SESSION_SEC, repsForSegment, segmentReps, totalRepDurationSec, typicalRunSec, withReps, } from '@/features/routines/segment-reps'
import type { RoutineSegment, RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, buildDailySession, loadSharedRoutine, materializeRoutine, useDailyRoutine, } from '@/features/routines/use-daily-routine'

const LENGTHS = ['short', 'standard', 'long'] as const

const drill = (
  exercise: string,
  durationSec: number,
  reps?: number,
): RoutineSegment => ({
  type: 'exercise',
  durationSec,
  ...(reps === undefined ? {} : { reps }),
  config: { exercise: exercise as RoutineSegment['config']['exercise'] },
})

const warmup = (durationSec: number): RoutineSegment => ({
  type: 'warmup',
  durationSec,
  config: { pattern: 'sirens' },
})

describe('repsForSegment', () => {
  // Two and a half minutes of long notes is five held notes with a breath
  // between them. It was one.
  it('fills a drill segment with runs of that drill', () => {
    expect(repsForSegment(drill(EXERCISE_LONG_NOTE, 150))).toBe(5)
  })

  // A warm-up runs its own scripted steps and takes its planned minute;
  // repeating it would be asking the singer to warm up twice.
  it('asks for one warm-up, however long it is budgeted', () => {
    expect(repsForSegment(warmup(60))).toBe(1)
    expect(repsForSegment(warmup(300))).toBe(1)
  })

  // A drill with no measured shape yet — the guided warm-up is one, and any
  // exercise added after this table is another. The default is long enough
  // that an unmeasured drill asks for few runs rather than many.
  it('falls back to the default for a drill the table has no time for', () => {
    expect(typicalRunSec(EXERCISE_WARMUP)).toBe(DEFAULT_TYPICAL_RUN_SEC)
    expect(typicalRunSec(undefined)).toBe(DEFAULT_TYPICAL_RUN_SEC)
  })

  it('falls back to the default run length for an unknown drill', () => {
    const unknown: RoutineSegment = {
      type: 'exercise',
      durationSec: 120,
      config: {},
    }
    expect(repsForSegment(unknown)).toBe(2)
  })

  it('never asks for less than one run', () => {
    expect(repsForSegment(drill(EXERCISE_LONG_NOTE, 5))).toBe(1)
  })

  it('stops at the comfortable cap', () => {
    expect(repsForSegment(drill(EXERCISE_LONG_NOTE, 3600))).toBe(MAX_REPS)
  })
})

describe('withReps', () => {
  // The budget was a guess at what the singer would spend; the reps are what
  // the app asks for. The panel prints these minutes, so they have to agree.
  it('makes a drill last as long as the runs it asks for', () => {
    const out = withReps(drill(EXERCISE_LONG_NOTE, 150))
    expect(out.reps).toBe(5)
    expect(out.durationSec).toBe(150)
  })

  it('rewrites a budget that no whole number of runs fits', () => {
    const out = withReps(drill(EXERCISE_LONG_NOTE, 100))
    expect(out.reps).toBe(3)
    expect(out.durationSec).toBe(90)
  })

  it('leaves a warm-up its planned minutes', () => {
    const out = withReps(warmup(90))
    expect(out.reps).toBe(1)
    expect(out.durationSec).toBe(90)
  })
})

describe('segmentReps', () => {
  // The migration case, and the reason reps are optional rather than
  // defaulted: a routine stored before this shipped is half-run on somebody's
  // device, and recomputing would move their finish line mid-session.
  it('reads a segment with no reps as one run', () => {
    expect(segmentReps(drill(EXERCISE_LONG_NOTE, 150))).toBe(1)
  })

  it('reads the stored count', () => {
    expect(segmentReps(drill(EXERCISE_LONG_NOTE, 150, 4))).toBe(4)
  })

  // A shared routine arrives as JSON from a link, so the field is whatever
  // was in the URL.
  it('refuses nonsense from a shared link', () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(segmentReps(drill(EXERCISE_LONG_NOTE, 150, bad))).toBe(1)
    }
    expect(segmentReps(drill(EXERCISE_LONG_NOTE, 150, 2.9))).toBe(2)
  })
})

describe('applyReps', () => {
  it('tops a thin session up to the five-minute floor', () => {
    const out = applyReps([warmup(30), drill(EXERCISE_SCALE_RUNNER, 45)])
    expect(totalRepDurationSec(out)).toBeGreaterThanOrEqual(MIN_SESSION_SEC)
    expect(segmentReps(out[1]!)).toBeGreaterThan(1)
  })

  // The ceiling wins over the floor. A thirty-second warm-up and one drill
  // that answers in thirty seconds cannot make five minutes without asking
  // for ten runs of the same thing, and that is a worse session than a short
  // one — so it comes back short, and bounded.
  it('stops at the ceiling rather than ask for a wall of runs', () => {
    const out = applyReps([warmup(30), drill(EXERCISE_LONG_NOTE, 60)])
    expect(segmentReps(out[1]!)).toBe(MAX_REPS_FLOOR)
    expect(totalRepDurationSec(out)).toBeLessThan(MIN_SESSION_SEC)
  })

  // Spread before doubling down: a session with somewhere else to put the
  // minutes should never turn one drill into a marathon.
  it('spreads the top-up across the drills it has', () => {
    const out = applyReps([
      warmup(30),
      drill(EXERCISE_LONG_NOTE, 60),
      drill(EXERCISE_SCALE_RUNNER, 45),
      drill(EXERCISE_VIBRATO, 30),
    ])
    expect(totalRepDurationSec(out)).toBeGreaterThanOrEqual(MIN_SESSION_SEC)
    for (const seg of out)
      expect(segmentReps(seg)).toBeLessThanOrEqual(MAX_REPS)
  })

  // A focus template is a warm-up, one drill and a cool-down. Held to the
  // comfortable cap it came out at four and a half minutes.
  it('pushes past the cap only when there is nowhere else to put the runs', () => {
    const out = applyReps([warmup(30), drill(EXERCISE_VIBRATO, 60), warmup(30)])
    const reps = segmentReps(out[1]!)
    expect(reps).toBeGreaterThan(MAX_REPS)
    expect(reps).toBeLessThanOrEqual(MAX_REPS_FLOOR)
    expect(totalRepDurationSec(out)).toBeGreaterThanOrEqual(MIN_SESSION_SEC)
  })

  // Nothing to repeat, so it cannot reach the floor. Returning short is the
  // only honest answer; looping forever is the bug this guards.
  it('gives up rather than hang on a routine with no drills', () => {
    const out = applyReps([warmup(60), warmup(60)])
    expect(out).toHaveLength(2)
    expect(totalRepDurationSec(out)).toBe(120)
  })
})

describe('every prescribed route is worth the streak', () => {
  // The finding itself: follow the app's own plan and you should end the day
  // having practised the five minutes the same app asks for.
  it('generates a daily session of at least five minutes at every length', () => {
    for (const length of LENGTHS) {
      for (let day = 0; day < 7; day++) {
        const routine = materializeRoutine(buildDailySession(day), length)
        expect(totalRepDurationSec(routine.segments)).toBeGreaterThanOrEqual(
          MIN_SESSION_SEC,
        )
      }
    }
  })

  it('materializes every library template to at least five minutes', () => {
    for (const template of dailyRoutines) {
      for (const length of LENGTHS) {
        const routine = materializeRoutine(template, length)
        expect(totalRepDurationSec(routine.segments)).toBeGreaterThanOrEqual(
          MIN_SESSION_SEC,
        )
      }
    }
  })

  it('asks for more than one run of a generated session‘s drills', () => {
    const routine = materializeRoutine(buildDailySession(0), 'standard')
    const drills = routine.segments.filter((s) => s.type === 'exercise')
    expect(drills.length).toBeGreaterThan(0)
    for (const seg of drills) expect(segmentReps(seg)).toBeGreaterThan(1)
  })

  it('still drops the challenge detour', () => {
    const withChallenge: RoutineTemplate = {
      id: 'reps-test',
      name: 'Test',
      description: '',
      segments: [
        warmup(60),
        drill(EXERCISE_LONG_NOTE, 150),
        {
          type: 'challenge-prep',
          durationSec: 120,
          config: { challengeCategory: 'perfect' },
        },
      ],
    }
    const kinds = materializeRoutine(withChallenge, 'standard').segments.map(
      (s) => s.type,
    )
    expect(kinds).toEqual(['warmup', 'exercise'])
  })
})

describe('banking runs against a segment', () => {
  const readRoutine = <T>(
    read: (r: ReturnType<typeof useDailyRoutine>) => T,
  ): T =>
    createRoot((dispose) => {
      const value = read(useDailyRoutine())
      dispose()
      return value
    })

  const done = (): number => readRoutine((r) => r.completedSegments().length)
  const runs = (): number => readRoutine((r) => r.currentSegmentRuns())
  const reps = (): number => readRoutine((r) => r.currentSegmentReps())

  const load = (segments: RoutineSegment[]): void => {
    loadSharedRoutine({
      id: 'reps-banking',
      name: "Today's Session",
      description: '',
      segments,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds the segment open until it has the runs it asked for', () => {
    load([
      drill(EXERCISE_LONG_NOTE, 150, 3),
      drill(EXERCISE_SCALE_RUNNER, 90, 2),
    ])

    expect(reps()).toBe(3)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(done()).toBe(0)
    expect(runs()).toBe(1)

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(done()).toBe(0)
    expect(runs()).toBe(2)

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(done()).toBe(1)
  })

  // Runs are banked against the segment in progress, not against the day: the
  // next drill starts from zero however many the last one took.
  it('starts the next segment with an empty count', () => {
    load([
      drill(EXERCISE_LONG_NOTE, 150, 2),
      drill(EXERCISE_SCALE_RUNNER, 90, 2),
    ])

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(done()).toBe(1)
    expect(runs()).toBe(0)
    expect(reps()).toBe(2)

    autoAdvanceRoutineSegment(EXERCISE_SCALE_RUNNER)
    expect(done()).toBe(1)
    expect(runs()).toBe(1)
  })

  // Another drill entirely: it should neither tick the segment off nor bank
  // a run against it.
  it('banks nothing for a drill this segment does not run', () => {
    load([drill(EXERCISE_LONG_NOTE, 150, 3)])

    autoAdvanceRoutineSegment(EXERCISE_SCALE_RUNNER)
    expect(runs()).toBe(0)
    expect(done()).toBe(0)
  })

  // The migration case, end to end: a routine stored before reps existed
  // finishes on one run per segment, exactly as it did when it was written.
  it('finishes a routine that predates reps on one run per segment', () => {
    load([drill(EXERCISE_LONG_NOTE, 150), drill(EXERCISE_SCALE_RUNNER, 90)])

    expect(reps()).toBe(1)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(done()).toBe(1)
    autoAdvanceRoutineSegment(EXERCISE_SCALE_RUNNER)
    expect(done()).toBe(2)
    expect(readRoutine((r) => r.isComplete())).toBe(true)
  })

  // Marking a segment done by hand is a decision about the segment, so the
  // runs banked against it go with it.
  it('clears the count when a segment is marked done by hand', () => {
    load([
      drill(EXERCISE_LONG_NOTE, 150, 3),
      drill(EXERCISE_SCALE_RUNNER, 90, 3),
    ])

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(runs()).toBe(1)

    readRoutine((r) => r.completeSegment())
    expect(done()).toBe(1)
    expect(runs()).toBe(0)
  })

  it('reports rep progress for the panel and the ribbon', () => {
    load([drill(EXERCISE_LONG_NOTE, 150, 3)])

    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    const status = readRoutine((r) => r.segmentStatuses()[0])
    expect(status?.reps).toBe(3)
    expect(status?.runs).toBe(1)
    expect(status?.current).toBe(true)
  })
})
