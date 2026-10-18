// ============================================================
// What the Warm-up path reads and does: the store's run, or a pinned one
// ============================================================
//
// The path (WarmUpPath.tsx) draws a day and a last move and asks for four
// moves: open a stop, skip the next one, warm up again, leave. On the phone
// they are the store's (warm-up-store.ts); a fixture or a test hands the
// path a pinned day instead, so a picture of a state never writes the
// singer's own run.
//
// The store reads the date when it is asked (warmUpDay), so a path left
// open past midnight would keep yesterday's run. `refresh` reads it again:
// the path calls it when the app comes back to the front.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import { localDayString } from '@/lib/local-day'
import type { UnlockItem } from '@/stores/notifications-store'
import type { WarmUpDay } from './routine'
import type { LastMove } from './warm-up-store'
import { canStartWarmUp, claimPathUnlocks, enterStop, leavePath, openStop, routineUnlocks, skipNextStop, warmUpAgain, warmUpDay, warmUpLastMove, } from './warm-up-store'

export interface PathSource {
  readonly day: Accessor<WarmUpDay>
  readonly last: Accessor<LastMove | null>
  /** A run may start: the Warm-up's free run is not used (N3). */
  readonly canStart: Accessor<boolean>
  /** What the routine unlocked while the path was open. */
  readonly unlocks: Accessor<readonly UnlockItem[]>
  /** Read the date again: the app came back, perhaps on a new day. */
  readonly refresh: () => void
  /** Open a stop: false for one that cannot open. */
  readonly enter: (index: number) => boolean
  /** Skip, beside Next: the next stop goes unsung. */
  readonly skipNext: () => void
  /** Warm up again: a fresh run, the day still warmed up. */
  readonly again: () => void
  /** Hold the routine's unlocks while the path is up; returns the release. */
  readonly claim: () => () => void
  /** The path is going, and not for a stop's room. */
  readonly leave: () => void
  /** A stop's room is open: the path went for it. */
  readonly inRoom: () => boolean
}

/** The singer's own run, from the store. Call inside the path's owner. */
export function storeSource(): PathSource {
  const [today, setToday] = createSignal(localDayString())
  const day = createMemo(() => {
    today()
    return warmUpDay()
  })
  return {
    day,
    last: warmUpLastMove,
    canStart: canStartWarmUp,
    unlocks: routineUnlocks,
    refresh: () => setToday(localDayString()),
    enter: enterStop,
    skipNext: skipNextStop,
    again: warmUpAgain,
    claim: claimPathUnlocks,
    leave: leavePath,
    inRoom: () => openStop() !== null,
  }
}

export interface PinnedRun {
  readonly day: WarmUpDay
  readonly last: LastMove | null
  readonly canStart: boolean
  readonly unlocks?: readonly UnlockItem[]
}

/** A run that stays as it is handed in: its moves change nothing. */
export function pinnedSource(run: PinnedRun): PathSource {
  const unlocks = run.unlocks ?? []
  return {
    day: () => run.day,
    last: () => run.last,
    canStart: () => run.canStart,
    unlocks: () => unlocks,
    refresh: () => undefined,
    enter: () => false,
    skipNext: () => undefined,
    again: () => undefined,
    claim: () => () => undefined,
    leave: () => undefined,
    inRoom: () => false,
  }
}
