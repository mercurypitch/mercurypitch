// ============================================================
// How the web puts each room on the screen
// ============================================================
//
// The native shell mounts each room from a screen of its own
// (apps/mercurypitch/src/shell/LongNoteScreen.tsx and its neighbours): the
// room, what ends it, and for the Ear rooms Merc's sung voice. These are the
// web's, with the same props. Each is lazy, so a room's code, its art and
// its voice load when the singer opens it and not with the tab.
//
// The Warm-up's path opens its stops' rooms over itself, in the same frame
// (`onOpenRoom`, WebRoomHost.tsx). A room that can be a stop asks the
// Warm-up whether it is one as it opens (warm-up-stop.ts), as the native
// screens do: opened by its own card it is the room as shipped. The
// Warm-up's code is lazy as a room's is: its path loads when its card is
// pressed, and the stop's hand-over beside a room that can be a stop.
// "Sing a song" at the path's end is the page's to answer (`onSong`).

import type { Component } from 'solid-js'
import { lazy } from 'solid-js'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { MERC_CALL, preloadMercVoice } from '@/features/echo/merc-sampler'
import { EXERCISE_ECHO_STARS, EXERCISE_HARMONY_LAKE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, EXERCISE_WARM_UP_PATH, } from '@/lib/domain/exercise-contracts'
import type { WebRoomId } from './web-room-ids'
import { isWebRoom } from './web-room-ids'

export interface WebRoomScreenProps {
  /** The singer leaves the room: Done at its result, or the bar's Back. */
  onDone: () => void
  /** Open a room over this one, in the same frame: a Warm-up stop. */
  onOpenRoom: (id: WebRoomId) => void
  /** The singer leaves for a song: "Sing a song", at the Warm-up's end. */
  onSong: () => void
}

/** A room's screen, and the way to start loading it before it opens. */
export type WebRoomScreen = Component<WebRoomScreenProps> & {
  preload: () => Promise<unknown>
}

/** A room, loaded when it is opened, with the props the web gives it. */
function screen<P extends object>(
  load: () => Promise<Component<P>>,
  props: (onDone: () => void) => P,
): WebRoomScreen {
  return lazy(async () => {
    const Room = await load()
    return {
      default: (own: WebRoomScreenProps) => (
        <Room {...props(() => own.onDone())} />
      ),
    }
  })
}

/** Merc sings the Ear rooms' calls in his own voice, once it has loaded. */
const withMerc = (onDone: () => void) => ({
  onDone,
  voice: MERC_CALL,
  voiceReady: preloadMercVoice,
})

/** The web's rooms that the Warm-up opens as its stops. */
type StopRoomId =
  | typeof EXERCISE_LIP_ROLL_BAY
  | typeof EXERCISE_NG_SLIDES_BRIDGE
  | typeof EXERCISE_LONG_NOTE_LANTERN
  | typeof EXERCISE_ECHO_STARS

/** What such a room takes: its Done, and its stop when it is one. */
interface StopRoomProps {
  onDone: () => void
  routine?: RoutineStop
}

/**
 * A room the Warm-up can open: handed its stop as it is made, if it is
 * one, and sent back to the path once the stop is finished or skipped.
 */
function stopScreen(
  id: StopRoomId,
  load: () => Promise<Component<StopRoomProps>>,
): WebRoomScreen {
  return lazy(async () => {
    const [Room, { warmUpStop }] = await Promise.all([
      load(),
      import('@/features/warm-up/warm-up-stop'),
    ])
    return {
      default: (own: WebRoomScreenProps) => {
        const onDone = (): void => own.onDone()
        // Asked once, as the room is made: the answer holds for its life.
        const routine = warmUpStop(id, onDone)
        return <Room onDone={onDone} routine={routine} />
      },
    }
  })
}

/** The Warm-up's path, whose stops open over it. */
const warmUpScreen: WebRoomScreen = lazy(async () => {
  const [{ WarmUpPath }, { leaveStop }] = await Promise.all([
    import('@/features/warm-up/WarmUpPath'),
    import('@/features/warm-up/warm-up-store'),
  ])
  return {
    default: (own: WebRoomScreenProps) => (
      <WarmUpPath
        onDone={() => own.onDone()}
        onSong={() => own.onSong()}
        onOpenRoom={(id) => {
          // Every stop of the web's routine is a room the web opens; a
          // stop it cannot open (First note, from a plan stored by another
          // build) is let go, and the path stays.
          if (isWebRoom(id)) own.onOpenRoom(id)
          else leaveStop()
        }}
        onPreload={(id) => {
          if (isWebRoom(id)) void WEB_ROOM_SCREENS[id].preload()
        }}
      />
    ),
  }
})

export const WEB_ROOM_SCREENS: Readonly<Record<WebRoomId, WebRoomScreen>> = {
  [EXERCISE_LONG_NOTE_LANTERN]: stopScreen(EXERCISE_LONG_NOTE_LANTERN, () =>
    import('@/features/long-note/LongNoteRoom').then((m) => m.LongNoteRoom),
  ),
  [EXERCISE_ECHO_STARS]: stopScreen(EXERCISE_ECHO_STARS, () =>
    import('@/features/echo/EchoRoom').then((m) => m.EchoRoom),
  ),
  [EXERCISE_WARM_UP_PATH]: warmUpScreen,
  [EXERCISE_LIP_ROLL_BAY]: stopScreen(EXERCISE_LIP_ROLL_BAY, () =>
    import('@/features/lip-roll/LipRollRoom').then((m) => m.LipRollRoom),
  ),
  [EXERCISE_NG_SLIDES_BRIDGE]: stopScreen(EXERCISE_NG_SLIDES_BRIDGE, () =>
    import('@/features/ng-slides/NgSlidesRoom').then((m) => m.NgSlidesRoom),
  ),
  [EXERCISE_HOME_NOTE_LIGHTHOUSE]: screen(
    () =>
      import('@/features/home-note/HomeNoteRoom').then((m) => m.HomeNoteRoom),
    withMerc,
  ),
  [EXERCISE_LEAP_CLIFFS]: screen(
    () => import('@/features/leap/LeapRoom').then((m) => m.LeapRoom),
    withMerc,
  ),
  [EXERCISE_HARMONY_LAKE]: screen(
    () => import('@/features/harmony/HarmonyRoom').then((m) => m.HarmonyRoom),
    withMerc,
  ),
}
