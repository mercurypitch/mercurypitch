import { createEffect } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { removeNotification, showActionNotification, } from '@/stores/notifications-store'

interface PlaybackMicNudgeOptions {
  /** Is playback currently running on the relevant tab. */
  isPlaying: () => boolean
  /** Is the microphone that surface scores with currently on. */
  micActive: () => boolean
  /** True only on a tab where singing into the mic is the point. */
  isRelevantTab: () => boolean
  /** Enable the microphone (e.g. the tab's mic toggle). */
  onEnableMic: () => void
}

/**
 * One persisted flag, not once-per-session: the offer exists so a new user
 * does not have to discover the mic button on their own — after they have
 * seen it once they know where the button is, and re-asking every session
 * punishes people who deliberately practice silently. Ignoring the toast IS
 * the "no thanks"; there is no second prompt to dismiss.
 */
export const [micPracticeOffered, setMicPracticeOffered] =
  createPersistedSignal<boolean>('pitchperfect_mic_practice_offered', false)

/**
 * Offer the microphone the FIRST time practice starts with the mic off —
 * otherwise the user sings (or plays) along and nothing is tracked or scored.
 *
 * Fires once ever (persisted), only on a mic-relevant surface, and never when
 * the mic is already on. Accepting enables the mic right there; ignoring it
 * counts as declining and it does not come back.
 */
export function usePlaybackMicNudge(opts: PlaybackMicNudgeOptions): void {
  createEffect(() => {
    if (!opts.isPlaying()) return
    if (!opts.isRelevantTab()) return
    if (opts.micActive()) return
    if (micPracticeOffered()) return

    setMicPracticeOffered(true)
    const id = showActionNotification(
      'Your mic is off — enable it so your practice is heard and scored. You can always toggle it with the mic button.',
      'info',
      {
        label: 'Enable mic',
        onClick: () => {
          removeNotification(id)
          opts.onEnableMic()
        },
      },
      // A first-run decision, not a status blip: give it longer than the
      // default toast lifetime, but let it go quietly if ignored.
      { durationMs: 15_000 },
    )
  })
}
