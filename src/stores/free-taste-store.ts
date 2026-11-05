// ============================================================
// The premium rooms' free taste, as it stands on this phone: the runs
// each room has given, whether the gate is on, and whether a room may
// open now (src/lib/free-taste.ts holds the rules).
//
// The gate is on in a build with the premium exercises once the V1 flip
// turns `PREMIUM_GATE` on, or before then while the Developer screen's
// Free taste switch is on, so a test build can try it. Runs are counted
// only while it is on: the taste starts when the gate does.
//
// The counts stay on this phone (`mp:` keys; settings sync carries only
// `pitchperfect_` ones), unlike the Karaoke import's free song, which the
// server counts. Whether the singer has the subscription is the Karaoke
// room's to say: the native shell hands that answer in
// (`provideTasteSubscription`), as this layer imports no feature.
// ============================================================

import { createSignal, untrack } from 'solid-js'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { FREE_RUNS, isPremiumExercise, runsLeft } from '@/lib/free-taste'
import { PREMIUM_EXERCISES, PREMIUM_GATE } from '@/lib/native-build'
import { createPersistedSignal } from '@/lib/storage'

/** Runs given so far, by room. */
export const FREE_TASTE_RUNS_KEY = 'mp:free-taste-runs'
/** The Developer screen's switch: try the gate before the flip. */
export const FREE_TASTE_TRY_KEY = 'mp:free-taste-try'

function isCounts(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0,
    )
  )
}

const [runs, setRuns] = createPersistedSignal<Record<string, number>>(
  FREE_TASTE_RUNS_KEY,
  {},
  { validator: isCounts },
)

const [trying, setTrying] = createPersistedSignal<boolean>(
  FREE_TASTE_TRY_KEY,
  false,
  { validator: (value): value is boolean => typeof value === 'boolean' },
)

/** The Developer screen's switch is on. Reactive. */
export const freeTasteTrying = trying

/** Turn the Developer screen's switch on or off. */
export function tryFreeTaste(on: boolean): void {
  setTrying(on)
}

/** The gate holds rooms back after their taste. Reactive. */
export function freeTasteOn(): boolean {
  return PREMIUM_EXERCISES && (PREMIUM_GATE || trying())
}

const [subscribedProbe, setSubscribedProbe] = createSignal<() => boolean>(
  () => false,
)

/**
 * The shell's answer to "has the singer the subscription?", read
 * reactively wherever the taste is. Returns the release.
 */
export function provideTasteSubscription(probe: () => boolean): () => void {
  setSubscribedProbe(() => probe)
  return () => {
    if (untrack(subscribedProbe) === probe) {
      setSubscribedProbe(() => () => false)
    }
  }
}

/** The singer has the subscription, as far as the phone knows. Reactive. */
export function tasteSubscribed(): boolean {
  return subscribedProbe()()
}

/** Runs a room has given so far. Reactive. */
export function tasteRunsUsed(id: PremiumExerciseId): number {
  return runs()[id] ?? 0
}

/** Runs left of a room's taste. Reactive. */
export function tasteRunsLeft(id: PremiumExerciseId): number {
  return runsLeft(id, tasteRunsUsed(id))
}

/**
 * Whether the taste has a word on the room's card: only while the gate is
 * on and the singer has no subscription. Reactive.
 */
export function tasteShows(): boolean {
  return freeTasteOn() && !tasteSubscribed()
}

/** Whether `id` may open now: the gate off, the subscription, or a run left. */
export function tasteAllows(id: PremiumExerciseId): boolean {
  return !tasteShows() || tasteRunsLeft(id) > 0
}

/** The room a card opened last, or null: its screen asks before a run. */
let cardRoom: PremiumExerciseId | null = null
/** Opens the offer in a room's place: the shell's (free-taste-gate.ts). */
let offerFor: ((id: PremiumExerciseId) => void) | null = null

/** A card opened `id` (free-taste-gate.ts). */
export function noteRoomOpened(id: PremiumExerciseId): void {
  cardRoom = id
}

/** The shell's way to the offer, for a run held back. Returns the release. */
export function provideTasteOffer(
  open: (id: PremiumExerciseId) => void,
): () => void {
  offerFor = open
  return () => {
    if (offerFor === open) offerFor = null
  }
}

/**
 * Before another run in a room a card opened (its Start or Again, the room
 * kit's dock): the taste used, the offer opens in its place and the run is
 * held back. A Warm-up stop never asks: its runs are the Warm-up's.
 */
export function holdAnotherRun(): boolean {
  if (cardRoom === null || tasteAllows(cardRoom)) return false
  offerFor?.(cardRoom)
  return true
}

/** The room whose screen is up as a Warm-up stop, or null. */
let stopRoom: string | null = null

/**
 * A room's screen is up as a Warm-up stop: its runs are the Warm-up's, not
 * the room's own taste. Returns the release, for the screen's cleanup.
 */
export function holdTasteForStop(id: PremiumExerciseId): () => void {
  stopRoom = id
  return () => {
    if (stopRoom === id) stopRoom = null
  }
}

/**
 * A run reached its end and kept a result (exercise-history-store.ts), or
 * a Warm-up run reached its end with a stop finished (warm-up-store.ts):
 * one run of the room's taste, while the gate is on.
 */
export function noteTasteRun(id: string): void {
  if (!freeTasteOn() || !isPremiumExercise(id) || id === stopRoom) return
  setRuns((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
}

/** Every room's taste whole again (the Developer screen). */
export function resetFreeTaste(): void {
  setRuns({})
}

/** Every room, its free runs and the runs given, for the Developer screen. */
export function tasteTable(): {
  id: PremiumExerciseId
  free: number
  used: number
}[] {
  return (Object.keys(FREE_RUNS) as PremiumExerciseId[]).map((id) => ({
    id,
    free: FREE_RUNS[id],
    used: tasteRunsUsed(id),
  }))
}

/** Back to a first launch: no runs, the switch off, no shell. */
export function resetFreeTasteForTests(): void {
  setRuns({})
  setTrying(false)
  stopRoom = null
  cardRoom = null
  offerFor = null
  setSubscribedProbe(() => () => false)
}
