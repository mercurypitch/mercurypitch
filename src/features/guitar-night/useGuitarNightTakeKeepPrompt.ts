// Guitar Night take-keep prompt — a quiet, optional first-use discovery cue.
// ============================================================
//
// A completed replay already waits behind Score. This hook makes that action
// discoverable without opening the ledger or saving anything automatically.

import type { Accessor } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'
import type { PerformanceTakeKeepState } from '@/lib/use-performance-take-keep'
import { removeNotificationsByChannel, showDecisionNotification, showNotification, } from '@/stores/notifications-store'

export const GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY =
  'pitchperfect_guitar_take_keep_prompt_disabled_v1'

const PROMPT_CHANNEL = 'guitar-night-take-keep-prompt'
const RESULT_CHANNEL = 'guitar-night-take-keep-result'

interface GuitarNightTakeKeepPromptOptions {
  state: Accessor<PerformanceTakeKeepState>
  boundaryId: Accessor<string | null>
  scoreOpen: Accessor<boolean>
  onKeep(): Promise<boolean>
  onOpenScore(): void
}

/** Offer a prepared replay until the player keeps one or opts out. */
export function useGuitarNightTakeKeepPrompt(
  options: GuitarNightTakeKeepPromptOptions,
): void {
  let lastOfferedBoundaryId: string | null = null
  let disabledForSession = false
  let disposed = false

  const promptDisabled = (): boolean => {
    if (disabledForSession) return true
    try {
      return (
        globalThis.localStorage?.getItem(
          GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY,
        ) === 'true'
      )
    } catch {
      return false
    }
  }

  const disablePrompt = (): void => {
    disabledForSession = true
    try {
      globalThis.localStorage?.setItem(
        GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY,
        'true',
      )
    } catch {
      // Storage can be unavailable in a private context; this session still
      // honours the choice.
    }
  }

  const keepFromPrompt = (): void => {
    disablePrompt()
    void options
      .onKeep()
      .then((kept) => {
        if (disposed) return
        if (kept) {
          showNotification('Guitar take kept in Hear Yourself.', 'success', {
            channel: RESULT_CHANNEL,
          })
          return
        }
        options.onOpenScore()
      })
      .catch(() => {
        if (disposed) return
        options.onOpenScore()
      })
  }

  createEffect(() => {
    const state = options.state()
    const boundaryId = options.boundaryId()
    const scoreIsOpen = options.scoreOpen()

    if (state !== 'ready' || boundaryId === null || scoreIsOpen) {
      removeNotificationsByChannel(PROMPT_CHANNEL)
      return
    }
    if (lastOfferedBoundaryId === boundaryId || promptDisabled()) return

    lastOfferedBoundaryId = boundaryId
    showDecisionNotification(
      'Your guitar replay is ready. Keep it in Hear Yourself?',
      'info',
      { label: 'Keep take', onClick: keepFromPrompt },
      { label: 'Don’t ask again', onClick: disablePrompt },
      { channel: PROMPT_CHANNEL, durationMs: 20_000 },
    )
  })

  onCleanup(() => {
    disposed = true
    removeNotificationsByChannel(PROMPT_CHANNEL)
  })
}
