import { createEffect } from 'solid-js'
import { removeNotification, showActionNotification, } from '@/stores/notifications-store'

interface PlaybackMicNudgeOptions {
  /** Is playback currently running on the relevant tab. */
  isPlaying: () => boolean
  /** Is the (shared engine) microphone currently on. */
  micActive: () => boolean
  /** True only on a tab where singing into the mic is the point (e.g. Singing). */
  isRelevantTab: () => boolean
  /** Enable the microphone (e.g. the tab's mic toggle). */
  onEnableMic: () => void
}

/**
 * Nudge the user once per session when playback starts on a mic-relevant tab
 * while the microphone is off — otherwise they sing along but nothing is
 * tracked/scored. Shows a single dismissible toast with an "Enable mic" action;
 * never nags again after it has fired or once the mic is on.
 */
export function usePlaybackMicNudge(opts: PlaybackMicNudgeOptions): void {
  let nudged = false

  createEffect(() => {
    if (!opts.isPlaying()) return
    if (!opts.isRelevantTab()) return
    if (opts.micActive()) return
    if (nudged) return

    nudged = true
    const id = showActionNotification(
      'Your mic is off — enable it so we can hear and score your singing.',
      'info',
      {
        label: 'Enable mic',
        onClick: () => {
          removeNotification(id)
          opts.onEnableMic()
        },
      },
    )
  })
}
