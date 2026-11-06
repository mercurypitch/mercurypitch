// ============================================================
// Studio storage ask — the question the first import on a device waits on, answered by the page's dialog
// ============================================================
//
// The controller asks (useStudioController's askStorage) and the import
// waits; StudioStorageAsk shows the question while one is open. An answer
// settles it; Cancel, Escape, the backdrop, or the import being cancelled
// some other way settles it with null, and the import stops without a word.
import { createSignal } from 'solid-js'
import type { StudioStorageQuality } from '@/lib/studio/audio/storage-quality'

export interface StudioStorageAnswer {
  readonly quality: StudioStorageQuality
  /** Keep the choice on this device and never ask again. */
  readonly remember: boolean
}

export function createStudioStorageAsk() {
  const [open, setOpen] = createSignal(false)
  let settle: ((answer: StudioStorageAnswer | null) => void) | null = null

  function finish(answer: StudioStorageAnswer | null): void {
    const done = settle
    settle = null
    setOpen(false)
    done?.(answer)
  }

  return {
    /** Whether a question is waiting for its answer. */
    open,
    /** Ask, and wait: null when the person cancels or `signal` aborts first. */
    request(signal?: AbortSignal): Promise<StudioStorageAnswer | null> {
      // A question still open is not answered twice: the earlier asker gives up.
      finish(null)
      if (signal?.aborted === true) return Promise.resolve(null)
      return new Promise((resolve) => {
        settle = resolve
        setOpen(true)
        signal?.addEventListener(
          'abort',
          () => {
            if (settle === resolve) finish(null)
          },
          { once: true },
        )
      })
    },
    answer: (answer: StudioStorageAnswer) => finish(answer),
    cancel: () => finish(null),
  }
}

export type StudioStorageAskState = ReturnType<typeof createStudioStorageAsk>
