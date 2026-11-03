// ============================================================
// The words over a song that stopped by itself, by where its sound went
// ============================================================
//
// A Karaoke song stops by itself when its clock stops and will not start
// again (the stem mixer's watches on it, clock-watchdog.ts and
// playback-return-watch.ts). A room that just went quiet looks broken, so
// it says what happened, and where the sound was going decides what helps:
//
//   AIRPLAY. The owner's iPhone sent the room's sound to an LG C2 over
//   AirPlay (1 to 3 Nov 2026). The song stood still once; then the TV showed
//   the song's name and a spinner while the song's clock ran on the phone,
//   and no sound came from the TV or the phone. Screen Mirroring to the same
//   TV carried the room and its sound, the TV stage and the TV lyrics alike
//   (the owner: "works great"). Playing again sends the sound back to the
//   same place, so the words say plainly that AirPlay cannot carry the
//   room's sound to a TV, that Screen Mirroring can and how, and the way to
//   hear it on the device in hand. The receiver is named as the phone names
//   it, since it can be a speaker as well as a TV; this is the singer's own
//   screen, where the name is theirs to see. The notice can be closed.
//
//   AirPlay is said where the route says airplay, and where the room
//   suspects it (airplay-suspicion.ts, `airPlayAlone`): WebKit plays from a
//   session of its own, and the app's session, whose route this is, said
//   the speaker while the TV had the sound. Suspected, the receiver is not
//   named: the port the app's session gives is its own speaker, not the TV.
//
//   ANYWHERE ELSE. The sound stopped, and Play again is offered: its press
//   is the gesture iOS wants before a clock starts again.
//
// The two lines on AirPlay and Screen Mirroring are the ones a song started
// on AirPlay shows as well (KaraokeAirPlayHint.tsx). Pure, so the words are
// tested without a phone; KaraokeSoundStopped.tsx draws them. The shape is
// the premium rooms' volume hint (apps/mercurypitch/src/shell/volume-hint.ts
// and RoomVolumeHint.tsx), and the device is named as everywhere else in
// the app (device-noun.ts).

import { thisDeviceLower } from '@/lib/device-noun'

export const STOPPED_HERE = 'The sound stopped.'
export const PLAY_AGAIN = 'Play again'
export const CLOSE_NOTICE = 'Close'
/** What AirPlay alone does to the room's sound on a TV. */
export const AIRPLAY_CANNOT = "AirPlay cannot carry the room's sound to a TV."
/** What does, and how. */
export const MIRRORING_CAN =
  'Screen Mirroring can: open Control Center, tap Screen Mirroring, then choose your TV.'

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

/** The last: how to have it here again, on the device in hand. */
export function airPlayWayBack(): string {
  return `To hear it here, choose ${thisDeviceLower()} under AirPlay in Control Center.`
}

/**
 * What the room says over a song that stopped: with its sound on AirPlay
 * alone, at the port the phone names `receiver` (null where the route does
 * not say airplay, and AirPlay is suspected), or anywhere else.
 */
export function soundStoppedNotice(
  onAirPlay: boolean,
  receiver: string | null = null,
): SoundStoppedNotice {
  if (!onAirPlay) {
    return { lines: [STOPPED_HERE], playAgain: true, closable: false }
  }
  return {
    lines: [
      stoppedOnAirPlay(receiver),
      AIRPLAY_CANNOT,
      MIRRORING_CAN,
      airPlayWayBack(),
    ],
    playAgain: false,
    closable: true,
  }
}
