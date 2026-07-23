import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'

export const MAX_UVR_UPLOAD_QUEUE_ITEMS = 15

export type UvrUploadQueueStatus =
  | 'queued'
  | 'checking'
  | 'processing'
  | 'completed'
  | 'skipped'
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

  let activeId: string | null = null
  let activeCancel: (() => void) | null = null
  let activeCancelled = false

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

  const cancelActive = () => {
    if (activeId === null) return
    activeCancelled = true
    updateItem(activeId, {
      status: 'cancelled',
      message: 'Cancelled',
    })
    activeCancel?.()
  }

  const clearFinished = () => {
    if (isRunning()) return
    setItems((current) =>
      current.filter((item) => !isTerminalUploadQueueStatus(item.status)),
    )
  }

  const clear = () => {
    if (isRunning()) return
    setItems([])
  }

  const run = async (worker: UvrUploadQueueWorker) => {
    if (isRunning()) return
    setIsRunning(true)
    try {
      while (true) {
        const next = items().find((item) => item.status === 'queued')
        if (next === undefined) break

        activeId = next.id
        activeCancel = null
        activeCancelled = false
        updateItem(next.id, {
          status: 'checking',
          progress: 0,
          message: 'Checking song…',
        })

        const context: UvrUploadQueueWorkerContext = {
          update: (patch) => updateItem(next.id, patch),
          onCancel: (handler) => {
            activeCancel = handler
            if (activeCancelled) handler()
          },
          cancelled: () => activeCancelled,
        }

        try {
          const outcome = await worker(next, context)
          if (!activeCancelled) {
            updateItem(next.id, {
              ...outcome,
              progress: outcome.status === 'completed' ? 100 : undefined,
            })
          }
        } catch (error) {
          if (!activeCancelled) {
            updateItem(next.id, {
              status: 'error',
              message: errorMessage(error),
            })
          }
        } finally {
          activeId = null
          activeCancel = null
          activeCancelled = false
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
    cancelActive,
    clearFinished,
    clear,
    run,
  }
}
