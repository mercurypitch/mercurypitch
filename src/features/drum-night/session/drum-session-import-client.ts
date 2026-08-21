// ============================================================
// Drum session import client — lazy, abortable one-shot Worker lifecycle
// ============================================================
//
// Every attempt owns one Worker and settles exactly once. Abort, timeout,
// malformed responses and browser Worker failures all terminate it, so route
// teardown and a newer file selection stop real work rather than only hiding a
// late result.

import type { DrumSessionImportWorkerRequest, DrumSessionWorkerSourceFormat, } from './drum-session-import-protocol'
import type { DrumSessionParserOutcome } from './import-drum-session'

export const DRUM_SESSION_IMPORT_TIMEOUT_MS = 10_000

export type DrumSessionImportErrorCode =
  | 'TOO_COMPLEX'
  | 'TIMED_OUT'
  | 'WORKER_FAILED'
  | 'IMPORT_FAILED'
  | string

export class DrumSessionImportError extends Error {
  readonly name = 'DrumSessionImportError'

  constructor(
    readonly code: DrumSessionImportErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export interface DrumSessionImportWorkerOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  /** Test seam; production creates the Vite module Worker lazily. */
  readonly workerFactory?: () => Worker
}

let requestSequence = 0

function createImportWorker(): Worker {
  return new Worker(
    new URL('../../../workers/drum-session-import.worker.ts', import.meta.url),
    { type: 'module' },
  )
}

function abortError(): DOMException {
  return new DOMException('Drum session import was cancelled.', 'AbortError')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parserOutcome(value: unknown): DrumSessionParserOutcome | null {
  if (!isRecord(value) || typeof value.status !== 'string') return null
  if (
    value.status === 'empty' ||
    value.status === 'unreadable' ||
    (value.status === 'malformed' &&
      (value.message === undefined || typeof value.message === 'string'))
  ) {
    return value as DrumSessionParserOutcome
  }
  if (
    value.status === 'parsed' &&
    isRecord(value.song) &&
    (value.name === undefined || typeof value.name === 'string')
  ) {
    return value as unknown as DrumSessionParserOutcome
  }
  return null
}

/** Parse one supported local score without reading its bytes on the UI thread. */
export function importDrumSessionInWorker(
  file: File,
  format: DrumSessionWorkerSourceFormat,
  options: DrumSessionImportWorkerOptions = {},
): Promise<DrumSessionParserOutcome> {
  if (options.signal?.aborted === true) return Promise.reject(abortError())

  return new Promise<DrumSessionParserOutcome>((resolve, reject) => {
    let worker: Worker
    try {
      worker = (options.workerFactory ?? createImportWorker)()
    } catch (error) {
      reject(
        new DrumSessionImportError(
          'WORKER_FAILED',
          error instanceof Error ? error.message : String(error),
        ),
      )
      return
    }

    const requestId = `drum-session-import-${++requestSequence}`
    const requestedTimeout = options.timeoutMs
    const timeoutMs =
      typeof requestedTimeout === 'number' &&
      Number.isFinite(requestedTimeout) &&
      requestedTimeout > 0
        ? Math.floor(requestedTimeout)
        : DRUM_SESSION_IMPORT_TIMEOUT_MS
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
          new DrumSessionImportError(
            'TIMED_OUT',
            `Drum session import exceeded ${timeoutMs.toLocaleString()} ms. Nothing was partially loaded; try a shorter file.`,
          ),
        ),
      )
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<unknown>): void => {
      const response = event.data
      if (!isRecord(response)) {
        settle(() =>
          reject(
            new DrumSessionImportError(
              'WORKER_FAILED',
              'Drum session import Worker returned a malformed response.',
            ),
          ),
        )
        return
      }
      if (response.requestId !== requestId) return
      if (response.type === 'DRUM_SESSION_IMPORTED') {
        const outcome = parserOutcome(response.outcome)
        if (outcome !== null) {
          settle(() => resolve(outcome))
          return
        }
      } else if (
        response.type === 'DRUM_SESSION_IMPORT_ERROR' &&
        typeof response.code === 'string' &&
        typeof response.message === 'string'
      ) {
        const { code, message } = response
        settle(() => reject(new DrumSessionImportError(code, message)))
        return
      }
      settle(() =>
        reject(
          new DrumSessionImportError(
            'WORKER_FAILED',
            'Drum session import Worker returned a malformed response.',
          ),
        ),
      )
    }
    worker.onerror = (event: ErrorEvent): void => {
      event.preventDefault?.()
      settle(() =>
        reject(
          new DrumSessionImportError(
            'WORKER_FAILED',
            event.message || 'Drum session import Worker failed.',
          ),
        ),
      )
    }
    worker.onmessageerror = (): void => {
      settle(() =>
        reject(
          new DrumSessionImportError(
            'WORKER_FAILED',
            'Drum session import Worker returned an unreadable response.',
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
      const request: DrumSessionImportWorkerRequest = {
        type: 'IMPORT_DRUM_SESSION',
        requestId,
        file,
        format,
      }
      worker.postMessage(request)
    } catch (error) {
      settle(() =>
        reject(
          new DrumSessionImportError(
            'WORKER_FAILED',
            error instanceof Error ? error.message : String(error),
          ),
        ),
      )
    }
  })
}
