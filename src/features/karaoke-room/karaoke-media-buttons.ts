// ============================================================
// The Karaoke room's media buttons — the system's controls, and who pressed
// ============================================================
//
// The notification's buttons, the lock screen's, Control Center's, a
// headset's, a remote's (an AirPlay receiver's) and iOS's lyrics window's
// reach the run's own play, pause and stop; the system's progress bar and
// iOS's 10 s skips move the song. Each checks the song first: play on a
// playing song would start it over from where it was last paused. A skip
// counts from where the song is by the audio clock, which behind the app is
// ahead of the last tick. Wherever the bar is let go, the song lands inside
// itself and keeps playing or stays paused; the mixer moves the lyrics as a
// tapped line does, and its jump tells the bar where the song went.
//
// Each press is made as its source's doing (playback-cause.ts), so the
// song's line says who paused or played it: `media-session(pause)` for a
// press, `system` for iOS taking the sound or giving it back,
// `lyrics-window(play)` for the window. On the owner's iPhone, with the
// sound on a TV over AirPlay, the song paused itself a second or two after
// Play and nothing said who (3 Nov 2026).

import type { Accessor } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { asPlaybackCause } from '@/lib/playback-cause'
import type { NativeMediaAction, NativeMediaActionSource, } from '@/stores/native-shell-store'

/** What the buttons reach in the room. */
export interface MediaButtonsHost {
  readonly mixer: Accessor<HostedMixerControls | null>
  /** A run: a song has started and has neither been stopped nor run out. */
  readonly runOn: Accessor<boolean>
  readonly isPlaying: () => boolean
  /** The run's own play, pause and stop. */
  readonly resume: () => void
  readonly pause: () => void
  readonly stop: () => void
}

/**
 * Who the song's line says asked: the source, with the button's name. The
 * system taking the sound or giving it back is one cause either way.
 */
export function mediaCause(
  action: NativeMediaAction,
  source: NativeMediaActionSource = 'media-session',
): string {
  if (source === 'system') return 'system'
  if (typeof action === 'string') return `${source}(${action})`
  return `${source}(${'seekTo' in action ? 'seek' : 'skip'})`
}

/** The handler the device's media buttons are heard with. */
export function createMediaButtons(
  host: MediaButtonsHost,
): (action: NativeMediaAction, source?: NativeMediaActionSource) => void {
  const seekFromSystem = (seconds: number): void => {
    const controls = host.mixer()
    if (controls === null || controls.loading() || !host.runOn()) return
    const length = controls.duration()
    if (!(length > 0)) return
    controls.seek(Math.min(length, Math.max(0, seconds)))
  }

  const press = (action: NativeMediaAction): void => {
    if (typeof action === 'object') {
      if ('skipBy' in action) {
        const controls = host.mixer()
        if (controls !== null) {
          seekFromSystem(controls.positionNow() + action.skipBy)
        }
        return
      }
      seekFromSystem(action.seekTo)
    } else if (action === 'play') {
      if (!host.isPlaying()) host.resume()
    } else if (action === 'pause') {
      if (host.isPlaying()) host.pause()
    } else if (host.runOn()) {
      host.stop()
    }
  }

  return (action, source) => {
    asPlaybackCause(mediaCause(action, source), () => {
      press(action)
    })
  }
}
