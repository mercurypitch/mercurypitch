// ============================================================
// RoutineStop: a room as one stop of the Warm-up
// ============================================================
//
// The Warm-up runs the exercise rooms one after another, from a path of
// its own (DESIGN-warm-up.md, sections 5 and 6). A room it opens is the
// room as shipped, in warm-up mode:
//
//   before the take   the chip "Warm-up 2 of 4" (routineChip), Merc's cue
//                     for his intro, "Skip stop" where the level pill was
//                     (the path carries the level), and "?", which still
//                     plays the demo; the demo never starts by itself
//   during the take   unchanged
//   at the result     the room's own result without Again and Done. It
//                     holds ROUTINE_RESULT_HOLD_MS once the room's result
//                     sequence has settled, or until a tap anywhere, and
//                     then the room hands its result to the routine
//                     (`finish`), once
//
// The shell's parts read the stop (RoomShell.tsx). Each room says what its
// result is for the routine: the card's words after its name ("86% lit",
// "12.6 s") and the note its run started from, so a later room need not
// ask the singer for an easy note again.

import type { Accessor } from 'solid-js'
import { createEffect, on, onCleanup, untrack } from 'solid-js'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'

/** A room's place in the Warm-up, and the way back to it. */
export interface RoutineStop {
  /** The stop's place in the routine, from 0: index 1 of 4 is "Warm-up 2 of 4". */
  readonly index: number
  /** How many stops the routine has. */
  readonly count: number
  /** A note an earlier stop started from (MIDI), or null. */
  readonly settledNote: number | null
  /** The take ended and its result has been shown: on to the routine. */
  finish(result: StopResult): void
  /** "Skip stop", before the take. */
  skip(): void
}

/** What a stop hands the routine at its end. */
export interface StopResult {
  readonly id: PremiumExerciseId
  /** The card's words after the stop's name: "86% lit", "12.6 s". */
  readonly line: string
  /** The note the room's run started from (MIDI), for a later stop; null for none. */
  readonly settledNote: number | null
}

/** What a room in warm-up mode tells its shell (RoomShellConfig.routine). */
export interface ShellRoutine {
  readonly stop: RoutineStop
  /** The room's result sequence has settled this long after it shows, ms. */
  readonly settleMs: number
  /** The result for the routine, read as the hold ends; null with none. */
  readonly result: () => StopResult | null
}

/** What a room's run takes from its stop (its controller's options). */
export interface RoutineRunOptions {
  /**
   * A note an earlier stop started from (MIDI). With no voiceprint, a run
   * starts from it when the room keeps no note of its own, so the singer
   * is not asked for an easy note twice.
   */
  readonly root?: number | null
  /** Merc opens on the Warm-up's cue: his intro, without its detail. */
  readonly routine?: boolean
}

/** A room's run options from its stop: none outside the Warm-up. */
export function routineRun(stop: RoutineStop | undefined): RoutineRunOptions {
  return stop === undefined ? {} : { root: stop.settledNote, routine: true }
}

/** The result holds this long once its sequence has settled, ms. */
export const ROUTINE_RESULT_HOLD_MS = 2400

/**
 * A tap this soon after the result shows does not go on: it is the tap
 * that ended the take, landing twice.
 */
export const ROUTINE_TAP_GRACE_MS = 600

/** The words warm-up mode adds to a room. */
export const ROUTINE_WORDS = {
  skip: 'Skip stop',
  /** The tap anywhere at the held result, as a screen reader hears it. */
  onward: 'Back to the warm-up',
} as const

/** "Warm-up 2 of 4": the chip before the take. */
export function routineChip(
  stop: Pick<RoutineStop, 'index' | 'count'>,
): string {
  return `Warm-up ${stop.index + 1} of ${stop.count}`
}

export interface RoutineHoldSetup {
  readonly routine: ShellRoutine
  /** The room shows its own take's result (not the demo's). */
  readonly atResult: Accessor<boolean>
}

export interface RoutineHold {
  /** A tap at the held result: on to the routine, unless it came too soon. */
  tap: () => void
}

/**
 * The held result: on to the routine when the hold ends or at a tap,
 * whichever comes first, and only once in the room's life. A room left
 * before then hands nothing on: its timer goes with it.
 */
export function createRoutineHold(setup: RoutineHoldSetup): RoutineHold {
  const { routine } = setup
  let timer: ReturnType<typeof setTimeout> | undefined
  let shownAt = 0
  let handed = false
  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const goOn = (): void => {
    clear()
    if (handed || !untrack(setup.atResult)) return
    const result = routine.result()
    if (result === null) return
    handed = true
    routine.stop.finish(result)
  }
  createEffect(
    on(setup.atResult, (at) => {
      clear()
      if (!at) return
      shownAt = performance.now()
      timer = setTimeout(goOn, routine.settleMs + ROUTINE_RESULT_HOLD_MS)
    }),
  )
  onCleanup(clear)
  return {
    tap: () => {
      if (performance.now() - shownAt < ROUTINE_TAP_GRACE_MS) return
      goOn()
    },
  }
}
