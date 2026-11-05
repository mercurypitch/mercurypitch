// ============================================================
// The premium rooms' free taste, at the tap that opens one
// ============================================================
//
// A room's card (the Sing room's picker and row, the Ear Lab's Ear rooms
// row) asks the shell to open the room by id (premium-exercise-wiring.ts).
// While the gate is on (free-taste-store.ts) and the singer has no
// subscription, a room whose free runs are used opens the Cloud offer in
// its place instead, named for the room (CloudOffer.tsx). The Warm-up
// always opens: its taste is held on its own path, whose padlocked "Warm up
// with Premium" asks for the offer here too (WarmUpScreen.tsx). A Warm-up
// stop's room is opened by the path, not by a card, and never comes here.
//
// Inside a room a card opened, the room kit's dock asks the same before each
// new run (holdAnotherRun): a singer who stays in the room after the last
// free run meets the offer at Again, not a fourth run.
//
// Before an offer opens, the phone asks the server and the store, as the
// Karaoke import does (askBeforeOffering): a singer the server knows has
// the subscription goes into the room; one the store holds and the server
// has not heard of yet sees "You're subscribed" while it hears. Each step
// is counted for the room (ROOM_EVENTS): the tap, the room opened, the
// offer shown, and a subscription bought from it.
//
// Reached only from the wiring's `install`, which the store build folds
// away with everything here (assert-bundle.mjs STAGE 2).

import { askBeforeOffering, openCloudOffer, openRoomOffer, } from '@/features/karaoke-room/cloud-offer-store'
import { karaokeSongs, songsOnTheWay, } from '@/features/karaoke-room/karaoke-songs'
import { trackEvent } from '@/lib/analytics'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_WARM_UP_PATH } from '@/lib/domain/exercise-contracts'
import { ROOM_EVENTS } from '@/lib/free-taste'
import { noteRoomOpened, tasteAllows } from '@/stores/free-taste-store'

/**
 * The singer has the subscription, as the phone knows it now: the server
 * says so, or the store's yes is on its way to it. Reactive.
 */
export function cloudSubscribed(): boolean {
  return karaokeSongs().subscribed || songsOnTheWay()
}

/** An ask before an offer is in flight: a second tap waits for it. */
let asking = false

/**
 * The offer in the room's place, once the server and the store have had
 * their say: `open` runs instead for a singer the server knows has the
 * subscription. Answers once the offer (or the room) is up.
 */
export async function offerForRoom(
  id: PremiumExerciseId,
  open?: () => void,
): Promise<void> {
  if (asking) return
  asking = true
  try {
    const facts = await askBeforeOffering().catch(() => null)
    if (facts?.songs.subscribed === true) {
      open?.()
      return
    }
    if (facts?.storeHolds === true) {
      openCloudOffer('room', 'subscribed')
      return
    }
    openRoomOffer(id)
  } finally {
    asking = false
  }
}

/**
 * A room's card tapped: the room, or the offer in its place once its free
 * taste is used. `open` pushes the room's screen.
 */
export function openRoomFromCard(
  id: PremiumExerciseId,
  open: (id: PremiumExerciseId) => void,
): void {
  const events = ROOM_EVENTS[id]
  trackEvent(events.tap)
  const enter = (): void => {
    trackEvent(events.open)
    // Its Again and its Start ask the taste again before each run (the
    // room kit's dock, holdAnotherRun).
    noteRoomOpened(id)
    open(id)
  }
  if (id === EXERCISE_WARM_UP_PATH || tasteAllows(id)) {
    enter()
    return
  }
  void offerForRoom(id, enter)
}

/** The padlocked "Warm up with Premium" on the Warm-up's path. */
export function offerWarmUp(): void {
  void offerForRoom(EXERCISE_WARM_UP_PATH)
}

/** Forget an ask left in flight by a test. */
export function resetFreeTasteGateForTests(): void {
  asking = false
}
