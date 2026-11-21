// ============================================================
// useStageNotices — the app's notices in Merc's bubble, and the order
// ============================================================
//
// The shell's half of the stage's notices (stage-notice.ts says what each
// looks like and which goes first). In the web build, while a drill's stage
// is on screen, the stage presents the app's notices in place of the
// toasts: one at a time, unlocks of one moment as one, and during a run,
// while an example plays, or while the take's question waits for its
// answer, only warnings and errors (notifications-store.ts,
// `presentNoticesOnStage` and `setStageQuiet`).
// When the drill is left, whatever is still waiting goes back to the
// toasts. The native app has its own place for notices, the shell's pill,
// so there the stage says only the take's.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, on, onCleanup, untrack } from 'solid-js'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { notificationPresenter, notifications, presentNoticesOnStage, removeNotification, setStageQuiet, unlockShown, } from '@/stores/notifications-store'
import type { StageNoticeModel } from './stage-notice'
import { bubbleNotice, noticeFromNotification } from './stage-notice'

export interface StageNoticesOptions {
  /** A run is under way, an example plays, or the take has the bubble:
   *  warnings and errors only. */
  quiet: () => boolean
  /** The example's line is in Merc's bubble. */
  example: () => boolean
  /** The voice take's notice, where the drill records one. */
  take: () => StageNoticeModel | null
}

export function useStageNotices(
  options: StageNoticesOptions,
): Accessor<StageNoticeModel | null> {
  if (!IS_NATIVE_BUILD) {
    onCleanup(presentNoticesOnStage())
    let alive = true
    onCleanup(() => {
      alive = false
    })
    createEffect(
      on(options.quiet, (quiet) => {
        if (quiet) {
          setStageQuiet(true)
          return
        }
        // The stage speaks again once the moment has settled. Try Again
        // ends a run and starts the next in one tap (the drill's reset,
        // then its start), and a notice let in between would pop out of
        // the bubble and straight back in, as the count-in quiets it.
        queueMicrotask(() => {
          if (alive && !untrack(options.quiet)) setStageQuiet(false)
        })
      }),
    )
  }

  // The one notice the store has on screen, while the stage draws them.
  const shown = createMemo(() =>
    notificationPresenter() === 'stage' ? notifications()[0] : undefined,
  )

  // An unlock that reaches the screen is a light tap where a device can
  // give one (onUnlockShown); the web has no listener today.
  createEffect(
    on(
      () => shown()?.id,
      (id, before) => {
        if (id !== undefined && id !== before && shown()?.unlocks !== undefined)
          unlockShown()
      },
    ),
  )

  const app = createMemo<StageNoticeModel | null>(() => {
    const notif = shown()
    return notif === undefined
      ? null
      : noticeFromNotification(notif, removeNotification)
  })

  const notice = createMemo(() =>
    bubbleNotice({
      app: app(),
      example: options.example(),
      take: options.take(),
    }),
  )
  return notice
}
