// ============================================================
// How the web puts each room on the screen
// ============================================================
//
// The native shell mounts each room from a screen of its own
// (apps/mercurypitch/src/shell/LongNoteScreen.tsx and its neighbours): the
// room, what ends it, and for the Ear rooms Merc's sung voice. These are the
// web's, with the same props. Each is lazy, so a room's code, its art and
// its voice load when the singer opens it and not with the tab.

import type { Component } from 'solid-js'
import { lazy } from 'solid-js'
import { MERC_CALL, preloadMercVoice } from '@/features/echo/merc-sampler'
import { EXERCISE_ECHO_STARS, EXERCISE_HARMONY_LAKE, EXERCISE_HOME_NOTE_LIGHTHOUSE, EXERCISE_LEAP_CLIFFS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { WebRoomId } from './web-room-ids'

export interface WebRoomScreenProps {
  /** The singer leaves the room: Done at its result, or the bar's Back. */
  onDone: () => void
}

/** A room, loaded when it is opened, with the props the web gives it. */
function screen<P extends object>(
  load: () => Promise<Component<P>>,
  props: (onDone: () => void) => P,
): Component<WebRoomScreenProps> {
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

export const WEB_ROOM_SCREENS: Readonly<
  Record<WebRoomId, Component<WebRoomScreenProps>>
> = {
  [EXERCISE_LONG_NOTE_LANTERN]: screen(
    () =>
      import('@/features/long-note/LongNoteRoom').then((m) => m.LongNoteRoom),
    (onDone) => ({ onDone }),
  ),
  [EXERCISE_ECHO_STARS]: screen(
    () => import('@/features/echo/EchoRoom').then((m) => m.EchoRoom),
    (onDone) => ({ onDone }),
  ),
  [EXERCISE_LIP_ROLL_BAY]: screen(
    () => import('@/features/lip-roll/LipRollRoom').then((m) => m.LipRollRoom),
    (onDone) => ({ onDone }),
  ),
  [EXERCISE_NG_SLIDES_BRIDGE]: screen(
    () =>
      import('@/features/ng-slides/NgSlidesRoom').then((m) => m.NgSlidesRoom),
    (onDone) => ({ onDone }),
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
