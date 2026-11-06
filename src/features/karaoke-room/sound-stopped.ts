// ============================================================
// The words over a song that stopped by itself, by where its sound went
// ============================================================
//
// A Karaoke song stops by itself when its clock stops and will not start
// again (the stem mixer's watches on it, clock-watchdog.ts and
// playback-return-watch.ts). A room that just went quiet looks broken, so
// it says what happened, and every notice offers Play again: its press is
// the gesture iOS wants before a clock starts again.
//
//   AIRPLAY. The sound went to a TV or speaker over AirPlay alone. Up to
//   mp-v0.8.55 the room's sound reached neither the TV nor the phone that
//   way, and this notice said AirPlay could not carry it. The Developer
//   screen's AirPlay sound check (6 Nov 2026) found that Web Audio alone
//   does reach the TV, and Web Audio beside a silent element does not, so
//   the lock screen's carrier and the unlock clip now stand aside on
//   AirPlay (native-device.ts in the app). A stop there is a stop like any
//   other: the notice says where the sound went, offers Play again, which
//   sends it back to the same place, and says how to hear it on the device
//   in hand instead. The receiver is named as the phone names it, since it
//   can be a speaker as well as a TV; this is the singer's own screen,
//   where the name is theirs to see.
//
//   AirPlay is said where the route says airplay, and where the room
//   suspects it (airplay-suspicion.ts, `airPlayAlone`): WebKit plays from a
//   session of its own, and the app's session, whose route this is, said
//   the speaker while the TV had the sound. Suspected, the receiver is not
//   named: the port the app's session gives is its own speaker, not the TV.
//
//   ANYWHERE ELSE. The sound stopped.
//
// Pure, so the words are tested without a phone; KaraokeSoundStopped.tsx
// draws them. The shape is the premium rooms' volume hint
// (apps/mercurypitch/src/shell/volume-hint.ts and RoomVolumeHint.tsx), and
// the device is named as everywhere else in the app (device-noun.ts).

import { thisDeviceLower } from '@/lib/device-noun'

export const STOPPED_HERE = 'The sound stopped.'
export const PLAY_AGAIN = 'Play again'
export const CLOSE_NOTICE = 'Close'

export interface SoundStoppedNotice {
  /** What the notice says, a line each. Play again follows them. */
  readonly lines: readonly string[]
}

/** The first line on AirPlay: where the sound went, by the receiver's name. */
export function stoppedOnAirPlay(receiver: string | null): string {
  return receiver === null || receiver.trim() === ''
    ? 'The sound went over AirPlay and stopped.'
    : `The sound went to ${receiver} over AirPlay and stopped.`
}

/** The last: how to have it here instead, on the device in hand. */
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
  if (!onAirPlay) return { lines: [STOPPED_HERE] }
  return { lines: [stoppedOnAirPlay(receiver), airPlayWayBack()] }
}
