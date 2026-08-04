// ============================================================
// Resuming a half-finished routine
// ============================================================
//
// `completedSegments` has always survived a reload; what did not was any sign
// that it had. The singer came back to a page that quietly remembered three of
// four segments and said nothing about it.
//
// `resumable` is what Home asks before offering to pick the session back up,
// and every clause of it is a way of not lying: mid-session, not finished, and
// recent enough that "where you left off" means today's session rather than
// this morning's abandoned one.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_LONG_NOTE, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import type { RoutineTemplate } from '@/features/routines/types'
import { autoAdvanceRoutineSegment, loadSharedRoutine, RESUME_WINDOW_MS, useDailyRoutine, } from '@/features/routines/use-daily-routine'

// Midday UTC, so advancing the clock by an hour never crosses into tomorrow
// and invalidates the routine for the wrong reason.
const NOON = new Date('2026-08-04T12:00:00.000Z')

const drill = (
  exercise: typeof EXERCISE_LONG_NOTE | typeof EXERCISE_SCALE_RUNNER,
): RoutineTemplate['segments'][number] => ({
  type: 'exercise',
  durationSec: 120,
  config: { exercise },
})

const TEMPLATE: RoutineTemplate = {
  id: 'resume-test',
  name: "Today's Session",
  description: 'three drills',
  segments: [
    drill(EXERCISE_LONG_NOTE),
    drill(EXERCISE_SCALE_RUNNER),
    drill(EXERCISE_LONG_NOTE),
  ],
}

/** Read the routine's derived state inside a root, then throw the root away. */
function readRoutine<T>(read: (r: ReturnType<typeof useDailyRoutine>) => T): T {
  return createRoot((dispose) => {
    const value = read(useDailyRoutine())
    dispose()
    return value
  })
}

const resumable = (): boolean => readRoutine((r) => r.resumable())
const at = (offsetMs: number): void => {
  vi.setSystemTime(new Date(NOON.getTime() + offsetMs))
}

describe('resumable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOON)
    loadSharedRoutine(TEMPLATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // A routine nobody has started is something to begin, and the card's own
  // Start button already says so. "Pick up where you left off" would be
  // offering to resume a session that never happened.
  it('is false for a routine with nothing done yet', () => {
    expect(resumable()).toBe(false)
  })

  it('is true once a segment is behind them', () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    expect(resumable()).toBe(true)
  })

  it('goes quiet once the whole session is done', () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)
    autoAdvanceRoutineSegment(EXERCISE_SCALE_RUNNER)
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    expect(readRoutine((r) => r.isComplete())).toBe(true)
    expect(resumable()).toBe(false)
  })

  it('goes quiet once the session is stale', () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    at(RESUME_WINDOW_MS - 1000)
    expect(resumable()).toBe(true)

    at(RESUME_WINDOW_MS + 1000)
    expect(resumable()).toBe(false)
  })

  // Every tick restarts the clock: someone working through a long session is
  // resuming it each time, however long the whole thing takes end to end.
  it('measures from the last segment, not from the first', () => {
    autoAdvanceRoutineSegment(EXERCISE_LONG_NOTE)

    at(RESUME_WINDOW_MS - 1000)
    autoAdvanceRoutineSegment(EXERCISE_SCALE_RUNNER)

    // Well past an hour since the routine began, seconds since it last moved.
    at(RESUME_WINDOW_MS + 1000)
    expect(readRoutine((r) => r.completedSegments().length)).toBe(2)
    expect(resumable()).toBe(true)
  })
})
