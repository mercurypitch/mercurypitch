// ============================================================
// The Karaoke room's clock, as a report tells it
// ============================================================
//
// Where the song is, for whatever runs on from a report rather than from
// every frame: the lock screen's Now Playing, which also carries the iOS
// window's and a TV's lyrics their clock, and, while there is no report, a
// TV's lyrics alone (useKaraokeTvLyricsClock.ts). One reading for both, so
// the two can never disagree about what a report holds or when one is due.
//
// Read inside an effect, it runs the effect again on each moment a report
// is due: play and pause, a jump (a seek, a line tapped, a loop going
// round), the song's clock starting, a new speed and a length arriving. The
// clock starting matters on iOS: it puts the clock in front of the lock
// screen's carrier, and the bar and skips stop working until a report plays
// the carrier again (carrier-in-front.ts). The position is read untracked,
// so a report is never sent per frame: whatever shows it runs on by itself.
//
// Tests: KaraokeRoomStage.test.tsx ("behind another app", "a TV showing the
// lyrics").

import { untrack } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import type { NativeLyricsClock } from '@/stores/native-shell-store'

/**
 * The song's clock as a report carries it. Between two songs there is no
 * mixer yet: the top, standing, with no length, so no bar rather than the
 * last song's.
 */
export function karaokeClockReport(
  controls: HostedMixerControls | null,
): Required<NativeLyricsClock> {
  if (controls === null) {
    return { playing: false, position: 0, duration: 0, rate: 1 }
  }
  const playing = controls.playing() === true
  controls.jumps()
  controls.clockStarts()
  return {
    playing,
    position: untrack(controls.audibleElapsed),
    duration: controls.duration(),
    rate: controls.speed(),
  }
}
