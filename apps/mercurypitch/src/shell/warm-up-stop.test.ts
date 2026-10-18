// ============================================================
// A room's stop in the Warm-up: read once, ended by the room, let go
// ============================================================
//
// What each room's screen hands its room (warm-up-stop.ts), against the
// real store: a room the Warm-up did not open is no stop; a stop finished
// or skipped goes back to the path; a room left before its result lets
// its stop go, so the next visit from the picker is the room on its own.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { enterStop, openStop, resetWarmUpForTests, routineStopFor, warmUpDay, warmUpLastMove, } from '@/features/warm-up/warm-up-store'
import { EXERCISE_LIP_ROLL_BAY, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import { warmUpStop } from './warm-up-stop'

interface Screen {
  stop: RoutineStop | undefined
  back: ReturnType<typeof vi.fn>
  /** The room's screen goes: Back, or the pop after its stop. */
  close: () => void
}

function open(
  id: typeof EXERCISE_LIP_ROLL_BAY | typeof EXERCISE_NG_SLIDES_BRIDGE,
): Screen {
  const back = vi.fn()
  return createRoot((dispose) => ({
    stop: warmUpStop(id, back),
    back,
    close: dispose,
  }))
}

beforeEach(() => {
  localStorage.clear()
  resetWarmUpForTests()
})

afterEach(() => {
  resetWarmUpForTests()
})

describe('a room the Warm-up did not open', () => {
  it('is no stop, and closing it touches nothing', () => {
    const screen = open(EXERCISE_LIP_ROLL_BAY)
    expect(screen.stop).toBeUndefined()
    screen.close()
    expect(screen.back).not.toHaveBeenCalled()
  })
})

describe("a stop's room", () => {
  it('is handed its place, and its result goes back to the path', () => {
    expect(enterStop(0)).toBe(true)
    const screen = open(EXERCISE_LIP_ROLL_BAY)
    expect([screen.stop?.index, screen.stop?.count]).toEqual([0, 4])

    screen.stop?.finish({
      id: EXERCISE_LIP_ROLL_BAY,
      line: '86% lit',
      settledNote: 52,
    })
    expect(screen.back).toHaveBeenCalledTimes(1)
    expect(warmUpDay().marks[0]).toEqual({ state: 'done', line: '86% lit' })
    expect(warmUpLastMove()).toEqual({ index: 0, state: 'done' })
    screen.close()
    expect(warmUpLastMove()).toEqual({ index: 0, state: 'done' })
  })

  it('keeps the stop it was handed, though the store lets go as it finishes', () => {
    expect(enterStop(0)).toBe(true)
    const screen = open(EXERCISE_LIP_ROLL_BAY)
    screen.stop?.finish({
      id: EXERCISE_LIP_ROLL_BAY,
      line: '86% lit',
      settledNote: null,
    })
    expect(routineStopFor(EXERCISE_LIP_ROLL_BAY)).toBeUndefined()
    expect(screen.stop?.index).toBe(0)
  })

  it('Skip stop goes back to the path too', () => {
    expect(enterStop(0)).toBe(true)
    const screen = open(EXERCISE_LIP_ROLL_BAY)
    screen.stop?.skip()
    expect(screen.back).toHaveBeenCalledTimes(1)
    expect(warmUpDay().marks[0]).toEqual({ state: 'skipped' })
  })

  it('left before its result, lets its stop go: the picker opens the room on its own', () => {
    expect(enterStop(0)).toBe(true)
    const screen = open(EXERCISE_LIP_ROLL_BAY)
    screen.close()
    expect(openStop()).toBeNull()
    expect(screen.back).not.toHaveBeenCalled()
    expect(open(EXERCISE_LIP_ROLL_BAY).stop).toBeUndefined()
    expect(warmUpDay().marks[0]).toEqual({ state: 'waiting' })
  })

  it('is no stop for another room', () => {
    expect(enterStop(0)).toBe(true)
    expect(open(EXERCISE_NG_SLIDES_BRIDGE).stop).toBeUndefined()
  })
})
