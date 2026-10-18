// ============================================================
// The Warm-up path's fixtures: one pinned run per state
// ============================================================
//
// `?warmFixture=<name>` on the dev server (mount-warm-fixture.tsx) draws
// the path as one of its states, from a run handed in rather than the
// singer's own (path-source.ts, pinnedSource): Codex's frames, F1 to F4.
//
//   start     the first visit: "3 min", Lip roll next, Start warm-up
//   between   back from Lip roll: its card "Lip roll: 86% lit", Again,
//             Skip and "Next: Ng slides"
//   resume    the same day, later: "1 of 4 today", Ng slides skipped,
//             "Next: Long note"
//   end       the run's end: "Warmed up", "4 of 4 today", every result
//   done      opened again that day: "Warmed up today", Warm up again
//   locked    the free run used: the padlocked "Warm up with Premium"
//
// The results are the frames' own lines, from the rooms' result screens.

import type { PinnedRun } from '../path-source'
import type { StopMark, WarmUpDay } from '../routine'
import { freshDay } from '../routine'
import { OWNER_ROUTINE } from '../warm-up-plan'

export const WARM_FIXTURES = [
  'start',
  'between',
  'resume',
  'end',
  'done',
  'locked',
] as const

export type WarmFixtureName = (typeof WARM_FIXTURES)[number]

export function isWarmFixtureName(
  name: string | null,
): name is WarmFixtureName {
  return name !== null && (WARM_FIXTURES as readonly string[]).includes(name)
}

/** The fixtures' day: fixed, so a capture never depends on the clock. */
const DATE = '2026-10-19'

const WAITING: StopMark = { state: 'waiting' }
const SKIPPED: StopMark = { state: 'skipped' }
const done = (line: string): StopMark => ({ state: 'done', line })

/** The four rooms' results in the frames: Lip roll, Ng slides, Long note, Echo. */
const RESULTS = [
  done('86% lit'),
  done('92% lit'),
  done('12.6 s'),
  done('8 of 9 on pitch'),
] as const

function dayWith(marks: readonly StopMark[], warmedUp = false): WarmUpDay {
  return {
    ...freshDay(OWNER_ROUTINE, DATE, 0),
    marks: [...marks, WAITING],
    warmedUp,
  }
}

export function fixtureRun(name: WarmFixtureName): PinnedRun {
  switch (name) {
    case 'start':
      return {
        day: freshDay(OWNER_ROUTINE, DATE, 0),
        last: null,
        canStart: true,
      }
    case 'locked':
      return {
        day: freshDay(OWNER_ROUTINE, DATE, 0),
        last: null,
        canStart: false,
      }
    case 'between':
      return {
        day: dayWith([RESULTS[0], WAITING, WAITING, WAITING]),
        last: { index: 0, state: 'done' },
        canStart: true,
      }
    case 'resume':
      return {
        day: dayWith([RESULTS[0], SKIPPED, WAITING, WAITING]),
        last: null,
        canStart: true,
      }
    case 'end':
      return {
        day: dayWith(RESULTS, true),
        last: { index: 3, state: 'done' },
        canStart: true,
      }
    case 'done':
      return { day: dayWith(RESULTS, true), last: null, canStart: true }
  }
}
