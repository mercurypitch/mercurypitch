// ============================================================
// The words over a song that stopped by itself, by where its sound went
// ============================================================
//
// A Karaoke song stops by itself when its clock stops and will not start
// again (the stem mixer's watches on it, clock-watchdog.ts and
// playback-return-watch.ts). A room that just went quiet looks broken, so
// it says what happened, and where the sound was going decides what helps:
//
//   AIRPLAY. The owner's iPhone sent the room's sound to an LG TV over
//   AirPlay and the song stood still (2 Nov 2026). Playing again sends it
//   back to the same place, so the words say what does help: the device in
//   hand, chosen under AirPlay in Control Center. The receiver is named as
//   the phone names it, since it can be a speaker as well as a TV; this is
//   the singer's own screen, where the name is theirs to see. Screen
//   Mirroring is not offered: it sends the sound to the TV too, and is
//   likely the same AirPlay route, which no device has yet said otherwise.
//   The notice can be closed.
//
//   ANYWHERE ELSE. The sound stopped, and Play again is offered: its press
//   is the gesture iOS wants before a clock starts again.
//
// Pure, so the words are tested without a phone; KaraokeSoundStopped.tsx
// draws them. The shape is the premium rooms' volume hint
// (apps/mercurypitch/src/shell/volume-hint.ts and RoomVolumeHint.tsx), and
// the device is named as everywhere else in the app (device-noun.ts).

import { thisDeviceLower } from '@/lib/device-noun'
import type { NativeAudioRoute } from '@/stores/native-shell-store'

export const STOPPED_HERE = 'The sound stopped.'
export const PLAY_AGAIN = 'Play again'
export const CLOSE_NOTICE = 'Close'

export interface SoundStoppedNotice {
  /** What the notice says, a line each. */
  readonly lines: readonly string[]
  /** Whether a press of play can help: not while the sound goes to AirPlay. */
  readonly playAgain: boolean
  /** Whether it can be closed: the AirPlay notice, which offers no press. */
  readonly closable: boolean
}

/** The first line on AirPlay: where the sound went, by the receiver's name. */
export function stoppedOnAirPlay(receiver: string | null): string {
  return receiver === null || receiver.trim() === ''
    ? 'The sound went over AirPlay and stopped.'
    : `The sound went to ${receiver} over AirPlay and stopped.`
}

/** The second: how to have it here again, on the device in hand. */
export function airPlayWayBack(): string {
  return `To hear it here, choose ${thisDeviceLower()} under AirPlay in Control Center.`
}

/**
 * What the room says over a song that stopped, with its sound on `route`,
 * at the port the phone names `receiver`.
 */
export function soundStoppedNotice(
  route: NativeAudioRoute | null,
  receiver: string | null = null,
): SoundStoppedNotice {
  return route === 'airplay'
    ? {
        lines: [stoppedOnAirPlay(receiver), airPlayWayBack()],
        playAgain: false,
        closable: true,
      }
    : { lines: [STOPPED_HERE], playAgain: true, closable: false }
}
