// ============================================================
// The premium exercises' half of the shell: opening one by id
// ============================================================
//
// The Sing room opens an exercise from its row, its picker and its options
// (premium exercises, the exercise entry), always by id. This turns the id
// into the screen the shell pushes, so the room never names a screen and the
// shell needs no method per exercise.
//
// The tap that opens a room is also where its heaviest art starts loading:
// Echo's sky plate is decoded while the screen pushes in (plate-loader.ts),
// so the room shows it at once instead of a frame later; Long note's
// lantern plates the same way; Ng slides' river and its glass start
// loading on the same tap. The Warm-up's path opens its stops' rooms the
// same way, by id (WarmUpScreen.tsx). Home note has no plates (its harbour
// is drawn); its tap starts Merc's voice set loading, which it sings with.
// First note's tap does the same: its theatre and its songs ship with the
// app and load as the room opens. So does Leap's: its cliffs are drawn.
//
// In those three Ear rooms Merc says his opening line aloud as the room
// opens (room-kit merc-speech.ts), through the app's one AudioContext,
// which iOS starts only inside a tap. The room opens a frame or more after
// the tap that opened it, so the tap starts the clock (startRoomClock).
//
// A build without the premium exercises (the store build, until the V1
// flip) gets nothing. PREMIUM_EXERCISES is a compile-time constant there, so
// the conditional below folds to `{}` and `install` is dead code in that
// bundle, and with it the opener, the id map and the preloads, which
// nothing else in it reaches: the room then finds no `openExercise` and
// draws no way in (assert-bundle.mjs STAGE 2 holds the output to it).

import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import { EXERCISE_ECHO_STARS, EXERCISE_FIRST_NOTE_STAGE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import { PREMIUM_EXERCISES } from '@/lib/native-build'
import type { NativeShellApi } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import type { PushedScreen } from './pushed-screen-ids'
import { pushScreen } from './run-shell-store'

/** What the shell adds to the API it registers for the rooms. */
export type PremiumExerciseApi = Pick<NativeShellApi, 'openExercise'>

/** The screen each exercise opens on. */
const SCREENS: Readonly<Record<PremiumExerciseId, PushedScreen>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: 'long-note',
  [EXERCISE_ECHO_STARS]: 'echo',
  [EXERCISE_LIP_ROLL_BAY]: 'lip-roll',
  [EXERCISE_NG_SLIDES_BRIDGE]: 'ng-slides',
  [EXERCISE_WARM_UP_PATH]: 'warm-up',
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: 'home-note',
  [EXERCISE_FIRST_NOTE_STAGE]: 'first-note',
  [EXERCISE_LEAP_CLIFFS]: 'leap',
}

/**
 * Start loading what an exercise shows first, on the tap that opens it.
 * The Warm-up's path loads its night and its orbs, and the room of the
 * stop it opens next, so Start finds that room's art on its way.
 */
export function preloadExercise(id: PremiumExerciseId): void {
  switch (id) {
    case EXERCISE_LONG_NOTE_LANTERN:
      void import('@/features/long-note/long-note-art').then((art) => {
        art.preloadLongNoteArt()
      })
      return
    case EXERCISE_ECHO_STARS:
      void import('@/features/echo/echo-art').then((art) => {
        art.preloadEchoArt()
      })
      return
    case EXERCISE_LIP_ROLL_BAY:
      void import('@/features/lip-roll/bay-art').then((art) => {
        art.preloadLipArt()
      })
      return
    case EXERCISE_NG_SLIDES_BRIDGE:
      void import('@/features/ng-slides/bridge-art').then((art) => {
        art.preloadNgArt()
      })
      return
    case EXERCISE_WARM_UP_PATH:
      void import('@/features/warm-up/path-art').then((art) => {
        art.preloadWarmUpArt()
      })
      void import('@/features/warm-up/warm-up-store').then((store) => {
        const next = store.nextWarmUpRoom()
        if (next !== null) preloadExercise(next)
      })
      return
    case EXERCISE_HOME_NOTE_LIGHTHOUSE:
    case EXERCISE_FIRST_NOTE_STAGE:
    case EXERCISE_LEAP_CLIFFS:
      void import('@/features/echo/merc-sampler').then((voice) => {
        void voice.preloadMercVoice()
      })
  }
}

/** The rooms whose Merc says his opening line aloud as they open. */
const SPEAKS_AS_IT_OPENS: ReadonlySet<PremiumExerciseId> = new Set([
  EXERCISE_HOME_NOTE_LIGHTHOUSE,
  EXERCISE_FIRST_NOTE_STAGE,
  EXERCISE_LEAP_CLIFFS,
])

/**
 * How long the opening tap holds the clock, ms. The room takes a lease of
 * its own as it mounts (useExerciseCapture), well inside it.
 */
export const DOOR_HOLD_MS = 5000

/**
 * Start the app's clock on the tap that opens a room Merc speaks in, so
 * his opening line finds it running. The tap holds it under a lease of its
 * own until the room has taken one, then lets go: a room that never opened
 * leaves it to park. Outside the native app there is no shared clock, and
 * a browser's room starts its own.
 */
function startRoomClock(): void {
  const lease = nativeDeviceApi()?.acquireAudio('room-door')
  if (lease === undefined) return
  void lease.unlock()
  setTimeout(() => lease.release(), DOOR_HOLD_MS)
}

/** Open an exercise: its art starts loading and the shell pushes its screen. */
export function openPremiumExercise(id: PremiumExerciseId): void {
  if (SPEAKS_AS_IT_OPENS.has(id)) startRoomClock()
  preloadExercise(id)
  pushScreen(SCREENS[id])
}

function install(): PremiumExerciseApi {
  return { openExercise: openPremiumExercise }
}

export function installPremiumExercises(): PremiumExerciseApi {
  return PREMIUM_EXERCISES ? install() : {}
}
