// ============================================================
// The words over a song that stopped by itself, by where its sound went
// ============================================================
//
// A Karaoke song stops by itself when its clock stops and will not start
// again (the stem mixer's clock watchdog). A room that just went quiet looks
// broken, so it says what happened, and where the sound was going decides
// what helps:
//
//   AIRPLAY. The owner's iPhone sent the room's sound to an LG TV over
//   AirPlay and the song stood still (2 Nov 2026). Playing again sends it
//   back to the same place, so the words say what does help: the phone's
//   own speaker, chosen in Control Center, or Screen Mirroring, which puts
//   the room itself on the TV and keeps its sound on the phone.
//
//   ANYWHERE ELSE. The sound stopped, and Play again is offered: its press
//   is the gesture iOS wants before a clock starts again.
//
// Pure, so the words are tested without a phone; KaraokeSoundStopped.tsx
// draws them. The shape is the premium rooms' volume hint
// (apps/mercurypitch/src/shell/volume-hint.ts and RoomVolumeHint.tsx).

import type { NativeAudioRoute } from '@/stores/native-shell-store'

export const STOPPED_ON_AIRPLAY =
  'The sound went to the TV over AirPlay and stopped.'
export const AIRPLAY_WAY_BACK =
  'Choose iPhone under AirPlay in Control Center, or use Screen Mirroring to put the room on the TV.'
export const STOPPED_HERE = 'The sound stopped.'
export const PLAY_AGAIN = 'Play again'

export interface SoundStoppedNotice {
  /** What the notice says, a line each. */
  readonly lines: readonly string[]
  /** Whether a press of play can help: not while the sound goes to AirPlay. */
  readonly playAgain: boolean
}

/** What the room says over a song that stopped, with its sound on `route`. */
export function soundStoppedNotice(
  route: NativeAudioRoute | null,
): SoundStoppedNotice {
  return route === 'airplay'
    ? { lines: [STOPPED_ON_AIRPLAY, AIRPLAY_WAY_BACK], playAgain: false }
    : { lines: [STOPPED_HERE], playAgain: true }
}
