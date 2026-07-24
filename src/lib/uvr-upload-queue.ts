import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'

export const MAX_UVR_UPLOAD_QUEUE_ITEMS = 15

export type UvrUploadQueueStatus =
  | 'queued'
  | 'checking'
  | 'processing'
  | 'completed'
  | 'skipped'
  | 'omitted'
  | 'error'
  | 'cancelled'

export interface UvrUploadQueueItem {
  id: string
  file: File
  status: UvrUploadQueueStatus
  progress: number
  sessionId?: string
  message?: string
}

export interface UvrUploadQueueOutcome {
  status: Extract<
    UvrUploadQueueStatus,
    'completed' | 'skipped' | 'error' | 'cancelled'
  >
  sessionId?: string
  message?: string
}

export interface UvrUploadQueueWorkerContext {
  update: (
    patch: Partial<
      Pick<UvrUploadQueueItem, 'status' | 'progress' | 'sessionId' | 'message'>
    >,
  ) => void
  onCancel: (handler: () => void) => void
  cancelled: () => boolean
}

export type UvrUploadQueueWorker = (
  item: UvrUploadQueueItem,
  context: UvrUploadQueueWorkerContext,
) => Promise<UvrUploadQueueOutcome>

export interface UvrUploadQueue {
  items: Accessor<UvrUploadQueueItem[]>
  isRunning: Accessor<boolean>
  enqueue: (files: File[]) => { added: number; overflow: number }
  remove: (itemId: string) => void
  skipQueued: (itemId: string) => boolean
  skipRemaining: () => number
  cancelActive: () => void
  clearFinished: () => void
  clear: () => void
  run: (worker: UvrUploadQueueWorker) => Promise<void>
}

export function isTerminalUploadQueueStatus(
  status: UvrUploadQueueStatus,
): boolean {
  return (
    status === 'completed' ||
    status === 'skipped' ||
    status === 'omitted' ||
    status === 'error' ||
    status === 'cancelled'
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Processing failed'
}

export function createUvrUploadQueue(
  maxItems = MAX_UVR_UPLOAD_QUEUE_ITEMS,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): UvrUploadQueue {
  const [items, setItems] = createSignal<UvrUploadQueueItem[]>([])
  const [isRunning, setIsRunning] = createSignal(false)

  interface ActiveQueueItem {
    id: string
    cancelled: boolean
    cancelHandler: (() => void) | null
    resolveCancellation: () => void
  }

  let active: ActiveQueueItem | null = null

  const updateItem = (
    itemId: string,
    patch: Partial<
      Pick<UvrUploadQueueItem, 'status' | 'progress' | 'sessionId' | 'message'>
    >,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              ...(patch.progress !== undefined
                ? { progress: Math.max(0, Math.min(100, patch.progress)) }
                : {}),
            }
          : item,
      ),
    )
  }

  const enqueue = (files: File[]) => {
    if (isRunning() || files.length === 0) {
      return { added: 0, overflow: files.length }
    }
    const available = Math.max(0, maxItems - items().length)
    const accepted = files.slice(0, available)
    if (accepted.length > 0) {
      setItems((current) => [
        ...current,
        ...accepted.map((file) => ({
          id: createId(),
          file,
          status: 'queued' as const,
          progress: 0,
        })),
      ])
    }
    return { added: accepted.length, overflow: files.length - accepted.length }
  }

  const remove = (itemId: string) => {
    if (isRunning()) return
    setItems((current) =>
      current.filter((item) => item.id !== itemId || item.status !== 'queued'),
    )
  }

  const omitQueuedItems = (
    shouldOmit: (item: UvrUploadQueueItem) => boolean,
  ): number => {
    if (!isRunning()) return 0
    let omitted = 0
    setItems((current) =>
      current.map((item) => {
        if (item.status !== 'queued' || !shouldOmit(item)) return item
        omitted++
        return {
          ...item,
          status: 'omitted',
          progress: 0,
          message: 'Skipped by you',
        }
      }),
    )
    return omitted
  }

  const skipQueued = (itemId: string) =>
    omitQueuedItems((item) => item.id === itemId) === 1

  const skipRemaining = () => omitQueuedItems(() => true)

  const cancelActive = () => {
    const current = active
    if (current === null || current.cancelled) return
    current.cancelled = true
    updateItem(current.id, {
      status: 'cancelled',
      message: 'Cancelled',
    })
    // Settle the queue even when the underlying browser inference or network
    // request cannot acknowledge cancellation promptly. Its eventual result
    // is observed and ignored below, so it cannot overwrite this terminal row.
    current.resolveCancellation()
    try {
      current.cancelHandler?.()
    } catch (error) {
      console.error('[UvrUploadQueue] cancel handler failed:', error)
    }
  }

  const clearFinished = () => {
    if (isRunning()) return
    setItems((current) =>
      current.filter((item) => !isTerminalUploadQueueStatus(item.status)),
    )
  }

  const clear = () => {
    // cancelActive marks the row terminal synchronously, while run() releases
    // isRunning on the following microtask. Let Close dismiss that terminal
    // panel immediately; a genuinely active/queued batch remains protected.
    if (
      isRunning() &&
      items().some((item) => !isTerminalUploadQueueStatus(item.status))
    )
      return
    setItems([])
  }

  const run = async (worker: UvrUploadQueueWorker) => {
    if (isRunning()) return
    setIsRunning(true)
    try {
      while (true) {
        const next = items().find((item) => item.status === 'queued')
        if (next === undefined) break

        let resolveCancellation: () => void = () => undefined
        const cancellation = new Promise<void>((resolve) => {
          resolveCancellation = resolve
        })
        const activeItem: ActiveQueueItem = {
          id: next.id,
          cancelled: false,
          cancelHandler: null,
          resolveCancellation,
        }
        active = activeItem
        updateItem(next.id, {
          status: 'checking',
          progress: 0,
          message: 'Checking song…',
        })

        const context: UvrUploadQueueWorkerContext = {
          update: (patch) => {
            if (!activeItem.cancelled) updateItem(next.id, patch)
          },
          onCancel: (handler) => {
            if (activeItem.cancelled) {
              try {
                handler()
              } catch (error) {
                console.error(
                  '[UvrUploadQueue] late cancel handler failed:',
                  error,
                )
              }
            } else {
              activeItem.cancelHandler = handler
            }
          },
          cancelled: () => activeItem.cancelled,
        }

        try {
          const workerResult = Promise.resolve()
            .then(() => worker(next, context))
            .then(
              (outcome) => ({ kind: 'outcome' as const, outcome }),
              (error: unknown) => ({ kind: 'error' as const, error }),
            )
          const result = await Promise.race([
            workerResult,
            cancellation.then(() => ({ kind: 'cancelled' as const })),
          ])

          if (result.kind === 'outcome' && !activeItem.cancelled) {
            updateItem(next.id, {
              ...result.outcome,
              progress: result.outcome.status === 'completed' ? 100 : undefined,
            })
          } else if (result.kind === 'error' && !activeItem.cancelled) {
            updateItem(next.id, {
              status: 'error',
              message: errorMessage(result.error),
            })
          }
        } finally {
          if (active === activeItem) active = null
        }
      }
    } finally {
      setIsRunning(false)
    }
  }

  return {
    items,
    isRunning,
    enqueue,
    remove,
    skipQueued,
    skipRemaining,
    cancelActive,
    clearFinished,
    clear,
    run,
  }
}
