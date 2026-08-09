// ============================================================
// PianoProject import client — lazy, abortable one-shot Worker lifecycle
// ============================================================
//
// Each import owns exactly one Worker and one promise. Every terminal path,
// including abort, timeout, malformed responses and browser Worker errors,
// settles once and terminates that Worker so cancellation cannot leave callers
// hanging.

import type { PianoProjectImportWorkerRequest } from '@/workers/piano-project-import.worker'
import type { PianoProject } from './piano-project'
import { validatePianoProject } from './piano-project'

export const PIANO_PROJECT_IMPORT_TIMEOUT_MS = 10_000

export type PianoProjectImportErrorCode =
  | 'NO_NOTES'
  | 'TIMED_OUT'
  | 'WORKER_FAILED'
  | 'IMPORT_FAILED'
  | string

export class PianoProjectImportError extends Error {
  readonly name = 'PianoProjectImportError'

  constructor(
    readonly code: PianoProjectImportErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export interface PianoProjectImportOptions {
  signal?: AbortSignal
  timeoutMs?: number
  /** Test seam; production creates the Vite module Worker lazily. */
  workerFactory?: () => Worker
}

let requestSequence = 0

function createImportWorker(): Worker {
  return new Worker(
    new URL('../../workers/piano-project-import.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

function abortError(): DOMException {
  return new DOMException('Piano project import was cancelled.', 'AbortError')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Import one local MIDI file without loading its parser on the UI thread. */
export function importPianoProject(
  file: File,
  options: PianoProjectImportOptions = {},
): Promise<PianoProject> {
  if (options.signal?.aborted === true) return Promise.reject(abortError())

  return new Promise<PianoProject>((resolve, reject) => {
    let worker: Worker
    try {
      worker = (options.workerFactory ?? createImportWorker)()
    } catch (error) {
      reject(
        new PianoProjectImportError(
          'WORKER_FAILED',
          error instanceof Error ? error.message : String(error),
        ),
      )
      return
    }

    const requestId = `piano-project-import-${++requestSequence}`
    const requestedTimeout = options.timeoutMs
    const timeoutMs =
      typeof requestedTimeout === 'number' &&
      Number.isFinite(requestedTimeout) &&
      requestedTimeout > 0
        ? Math.floor(requestedTimeout)
        : PIANO_PROJECT_IMPORT_TIMEOUT_MS
    let settled = false

    const cleanup = (): void => {
      clearTimeout(timeoutId)
      options.signal?.removeEventListener('abort', handleAbort)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
    }
    const settle = (callback: () => void): void => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const handleAbort = (): void => settle(() => reject(abortError()))

    const timeoutId = setTimeout(() => {
      settle(() =>
        reject(
          new PianoProjectImportError(
            'TIMED_OUT',
            `Piano project import exceeded ${timeoutMs.toLocaleString()} ms.`,
          ),
        ),
      )
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<unknown>): void => {
      const response = event.data
      if (!isRecord(response)) {
        settle(() =>
          reject(
            new PianoProjectImportError(
              'WORKER_FAILED',
              'Piano project import Worker returned a malformed response.',
            ),
          ),
        )
        return
      }
      if (response.requestId !== requestId) return
      if (response.type === 'PIANO_PROJECT_IMPORTED') {
        try {
          const project = validatePianoProject(response.project)
          settle(() => resolve(project))
        } catch (error) {
          settle(() =>
            reject(
              new PianoProjectImportError(
                'IMPORT_FAILED',
                error instanceof Error ? error.message : String(error),
              ),
            ),
          )
        }
      } else if (
        response.type === 'PIANO_PROJECT_IMPORT_ERROR' &&
        typeof response.code === 'string' &&
        typeof response.message === 'string'
      ) {
        const { code, message } = response
        settle(() => reject(new PianoProjectImportError(code, message)))
      } else {
        settle(() =>
          reject(
            new PianoProjectImportError(
              'WORKER_FAILED',
              'Piano project import Worker returned a malformed response.',
            ),
          ),
        )
      }
    }
    worker.onerror = (event: ErrorEvent): void => {
      event.preventDefault?.()
      settle(() =>
        reject(
          new PianoProjectImportError(
            'WORKER_FAILED',
            event.message || 'Piano project import Worker failed.',
          ),
        ),
      )
    }
    worker.onmessageerror = (): void => {
      settle(() =>
        reject(
          new PianoProjectImportError(
            'WORKER_FAILED',
            'Piano project import Worker returned an unreadable response.',
          ),
        ),
      )
    }
    options.signal?.addEventListener('abort', handleAbort, { once: true })
    if (options.signal?.aborted === true) {
      handleAbort()
      return
    }

    try {
      const request: PianoProjectImportWorkerRequest = {
        type: 'IMPORT_PIANO_PROJECT',
        requestId,
        file,
      }
      worker.postMessage(request)
    } catch (error) {
      settle(() =>
        reject(
          new PianoProjectImportError(
            'WORKER_FAILED',
            error instanceof Error ? error.message : String(error),
          ),
        ),
      )
    }
  })
}
