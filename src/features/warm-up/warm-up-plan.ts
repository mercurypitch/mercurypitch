// ============================================================
// The Warm-up's plan: its stops, in order
// ============================================================
//
// The Warm-up has no engine of its own: it runs the premium rooms one
// after another, each in warm-up mode (room-kit routine-stop.ts), on a
// path of its own (DESIGN-warm-up.md). Which rooms, in which order, is
// data, as the web's daily routine is (src/features/routines/types.ts):
// a plan names any number of stops, and the path draws as many as it has.
//
// A stop is a room the Warm-up runs, or the song: the stop on top, which
// the end opens. The song opens the Sing room's song list today; it is a
// stop so that it can become another kind later (free singing, a karaoke
// tryout), without a new routine around it.
//
// The owner's routine (18 Oct 2026, pw-stops "song"): Lip roll, Ng
// slides, Long note and Echo, then the song. planWarmUp is where a later
// planner can vary it by day, level or history, deterministic per day as
// the web's buildDailySession is; today it returns the owner's routine.
// A day's plan is stored whole with its run (routine.ts), so a later
// build that plans differently never reorders a run in progress.

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'

/** The rooms that can run as a stop: the four with a warm-up mode. */
export type WarmUpRoomId = Extract<
  PremiumExerciseId,
  | typeof EXERCISE_LIP_ROLL_BAY
  | typeof EXERCISE_NG_SLIDES_BRIDGE
  | typeof EXERCISE_LONG_NOTE_LANTERN
  | typeof EXERCISE_ECHO_STARS
>

export const WARM_UP_ROOMS: readonly WarmUpRoomId[] = [
  EXERCISE_LIP_ROLL_BAY,
  EXERCISE_NG_SLIDES_BRIDGE,
  EXERCISE_LONG_NOTE_LANTERN,
  EXERCISE_ECHO_STARS,
]

const ROOMS: ReadonlySet<string> = new Set(WARM_UP_ROOMS)

export function isWarmUpRoomId(value: unknown): value is WarmUpRoomId {
  return typeof value === 'string' && ROOMS.has(value)
}

/** A room the Warm-up runs in warm-up mode: one take, its result, on. */
export interface RoomStop {
  readonly kind: 'room'
  readonly id: WarmUpRoomId
}

/** What the song stop opens. */
export type SongOpens = 'song-list'

/** The singer's song, on top: the end of the Warm-up opens it. */
export interface SongStop {
  readonly kind: 'song'
  readonly opens: SongOpens
}

export type WarmUpStop = RoomStop | SongStop

export interface WarmUpPlan {
  /** Names the routine, for a later planner with more than one. */
  readonly id: string
  /** In the order the path climbs them; a song stop only last. */
  readonly stops: readonly WarmUpStop[]
}

/** The owner's routine: four rooms, then the song. */
export const OWNER_ROUTINE: WarmUpPlan = {
  id: 'four-rooms-and-a-song',
  stops: [
    { kind: 'room', id: EXERCISE_LIP_ROLL_BAY },
    { kind: 'room', id: EXERCISE_NG_SLIDES_BRIDGE },
    { kind: 'room', id: EXERCISE_LONG_NOTE_LANTERN },
    { kind: 'room', id: EXERCISE_ECHO_STARS },
    { kind: 'song', opens: 'song-list' },
  ],
}

/** The day's plan. The seam a planner by day, level or history fills. */
export function planWarmUp(): WarmUpPlan {
  return OWNER_ROUTINE
}

export function isRoomStop(stop: WarmUpStop | undefined): stop is RoomStop {
  return stop?.kind === 'room'
}

/** How many of the plan's stops are rooms: the "4" of "1 of 4 today". */
export function roomCount(plan: WarmUpPlan): number {
  return plan.stops.filter(isRoomStop).length
}

function isStop(value: unknown): value is WarmUpStop {
  if (typeof value !== 'object' || value === null) return false
  const stop = value as Record<string, unknown>
  if (stop.kind === 'room') return isWarmUpRoomId(stop.id)
  return stop.kind === 'song' && stop.opens === 'song-list'
}

/**
 * A plan this build can run: a stored one is checked before it is used.
 * At least one room; a song stop, if any, is the last and the only one.
 */
export function isWarmUpPlan(value: unknown): value is WarmUpPlan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  if (typeof plan.id !== 'string' || !Array.isArray(plan.stops)) return false
  const stops: unknown[] = plan.stops
  if (!stops.every(isStop)) return false
  const songAt = stops.findIndex((stop) => stop.kind === 'song')
  if (songAt !== -1 && songAt !== stops.length - 1) return false
  return stops.some((stop) => stop.kind === 'room')
}
