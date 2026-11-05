// ============================================================
// The premium rooms' free taste: how many runs each room gives before
// Mercury Pitch Cloud, what a card says about them, and the names the
// funnel counts each room's way to the offer by.
//
// Decided by the owner: the Ear rooms give three runs each (28 Oct 2026,
// confirmed 1 Nov), the Warm-up one run of its own (pw-free "own"), and
// the first rooms one each (native-build.ts, PREMIUM_EXERCISES). A run is
// one that reached its end and kept a result; a room run as a Warm-up stop
// is the Warm-up's, not the room's. Pure: the counts and the switch are in
// src/stores/free-taste-store.ts.
// ============================================================

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_FIRST_NOTE_STAGE, EXERCISE_HARMONY_LAKE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import type { AppFunnelEventName } from '@/lib/funnel-event-catalog'

/** Free runs a room gives before the offer. */
export const FREE_RUNS: Readonly<Record<PremiumExerciseId, number>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: 1,
  [EXERCISE_ECHO_STARS]: 1,
  [EXERCISE_NG_SLIDES_BRIDGE]: 1,
  [EXERCISE_LIP_ROLL_BAY]: 1,
  [EXERCISE_WARM_UP_PATH]: 1,
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: 3,
  [EXERCISE_FIRST_NOTE_STAGE]: 3,
  [EXERCISE_LEAP_CLIFFS]: 3,
  [EXERCISE_HARMONY_LAKE]: 3,
}

/** Whether `id` names a premium room. */
export function isPremiumExercise(id: string): id is PremiumExerciseId {
  return Object.prototype.hasOwnProperty.call(FREE_RUNS, id)
}

/** Runs left of a room's taste, never below none. */
export function runsLeft(id: PremiumExerciseId, used: number): number {
  return Math.max(0, FREE_RUNS[id] - used)
}

/**
 * What a room's card says while the taste is on and the singer has no
 * subscription: "3 free runs", "1 free run left", "Free runs used". The
 * Warm-up's single run is "Your free warm-up".
 */
export function tasteLine(id: PremiumExerciseId, used: number): string {
  const left = runsLeft(id, used)
  if (id === EXERCISE_WARM_UP_PATH) {
    return left > 0 ? 'Your free warm-up' : 'Free warm-up used'
  }
  if (left === 0) return 'Free runs used'
  const runs = left === 1 ? 'free run' : 'free runs'
  return used === 0 ? `${left} ${runs}` : `${left} ${runs} left`
}

/** One room's funnel names, in the order a singer meets them. */
export interface RoomEvents {
  /** The room's card tapped. */
  readonly tap: AppFunnelEventName
  /** The room opened by that tap. */
  readonly open: AppFunnelEventName
  /** The Cloud offer shown in its place. */
  readonly offer: AppFunnelEventName
  /** A subscription bought from that offer. */
  readonly trial: AppFunnelEventName
}

/** Written out whole: the catalogue holds each name as a plain literal. */
export const ROOM_EVENTS: Readonly<Record<PremiumExerciseId, RoomEvents>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: {
    tap: 'room_tap_long_note',
    open: 'room_open_long_note',
    offer: 'room_offer_long_note',
    trial: 'room_trial_long_note',
  },
  [EXERCISE_ECHO_STARS]: {
    tap: 'room_tap_echo',
    open: 'room_open_echo',
    offer: 'room_offer_echo',
    trial: 'room_trial_echo',
  },
  [EXERCISE_NG_SLIDES_BRIDGE]: {
    tap: 'room_tap_ng_slides',
    open: 'room_open_ng_slides',
    offer: 'room_offer_ng_slides',
    trial: 'room_trial_ng_slides',
  },
  [EXERCISE_LIP_ROLL_BAY]: {
    tap: 'room_tap_lip_roll',
    open: 'room_open_lip_roll',
    offer: 'room_offer_lip_roll',
    trial: 'room_trial_lip_roll',
  },
  [EXERCISE_WARM_UP_PATH]: {
    tap: 'room_tap_warm_up',
    open: 'room_open_warm_up',
    offer: 'room_offer_warm_up',
    trial: 'room_trial_warm_up',
  },
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: {
    tap: 'room_tap_home_note',
    open: 'room_open_home_note',
    offer: 'room_offer_home_note',
    trial: 'room_trial_home_note',
  },
  [EXERCISE_FIRST_NOTE_STAGE]: {
    tap: 'room_tap_first_note',
    open: 'room_open_first_note',
    offer: 'room_offer_first_note',
    trial: 'room_trial_first_note',
  },
  [EXERCISE_LEAP_CLIFFS]: {
    tap: 'room_tap_leap',
    open: 'room_open_leap',
    offer: 'room_offer_leap',
    trial: 'room_trial_leap',
  },
  [EXERCISE_HARMONY_LAKE]: {
    tap: 'room_tap_harmony',
    open: 'room_open_harmony',
    offer: 'room_offer_harmony',
    trial: 'room_trial_harmony',
  },
}

/** A room's name as the offer says it: "Leap", "the Warm-up". */
export const ROOM_NAMES: Readonly<Record<PremiumExerciseId, string>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: 'Long note',
  [EXERCISE_ECHO_STARS]: 'Echo',
  [EXERCISE_NG_SLIDES_BRIDGE]: 'Ng slides',
  [EXERCISE_LIP_ROLL_BAY]: 'Lip roll',
  [EXERCISE_WARM_UP_PATH]: 'the Warm-up',
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: 'Home note',
  [EXERCISE_FIRST_NOTE_STAGE]: 'First note',
  [EXERCISE_LEAP_CLIFFS]: 'Leap',
  [EXERCISE_HARMONY_LAKE]: 'Harmony',
}

/** The offer's title when a room opened it. */
export const ROOM_OFFER_TITLE = 'Keep training with Merc'

/**
 * The offer's line under that title: the taste just used, and what the
 * subscription opens.
 */
export function roomOfferLine(id: PremiumExerciseId): string {
  const had =
    id === EXERCISE_WARM_UP_PATH
      ? "You've had your free warm-up."
      : `You've had your free ${FREE_RUNS[id] === 1 ? 'run' : 'runs'} of ${ROOM_NAMES[id]}.`
  return `${had} Every Merc room, as often as you like, and your own songs to sing.`
}
