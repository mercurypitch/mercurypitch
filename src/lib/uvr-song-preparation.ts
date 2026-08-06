// ============================================================
// UVR song preparation — durable file-to-session orchestration shared by every upload surface
// ============================================================
//
// UI remains outside this module. The workflow owns hash reuse, original-file
// retention, storage preflight, session transitions, provider cancellation,
// and terminal persistence so standalone rooms do not grow weaker copies.

import { hasRoomFor } from '@/db/durable-write'
import { findSessionByFileHash, getOriginalFileBlob, saveStemBlobDurable, } from '@/db/services/uvr-service'
import { audioUploadValidationError, LOCAL_MAX_UPLOAD_BYTES, SERVER_MAX_UPLOAD_BYTES, } from '@/lib/audio-upload-contract'
import { computeFileHash } from '@/lib/file-hash'
import type { ProcessingResult } from '@/lib/uvr-processing-pipeline'
import { cancelUvrPipeline, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import type { UvrProcessingMode, UvrSession } from '@/stores/uvr-store'
import { cancelUvrSession, completeUvrSession, getAllUvrSessions, getUvrSession, getUvrSessionByHash, initSessionStore, persistSessionDurable, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, startUvrSession, } from '@/stores/uvr-store'

export type UvrSongPreparationPhase =
  | 'checking-library'
  | 'saving-original'
  | 'preparing'
  | 'separating'
  | 'finalizing'

export interface UvrSongPreparationUpdate {
  phase: UvrSongPreparationPhase
  progress: number | null
}

export interface UvrSongPreparationWarning {
  code: 'low-storage' | 'original-not-saved' | 'session-not-saved'
  message: string
}

export type UvrSongPreparationResult =
  | { status: 'completed'; sessionId: string }
  | { status: 'existing'; sessionId: string }
  | {
      status: 'in-flight'
      sessionId: string
      requiresHydration?: boolean
    }
  | { status: 'cancelled'; sessionId?: string }
  | { status: 'error'; sessionId?: string; message: string }

export interface UvrSongPreparationOptions {
  mode: UvrProcessingMode
  bandSplit?: boolean
  focus?: boolean
  signal?: AbortSignal
  onUpdate?: (update: UvrSongPreparationUpdate) => void
  onWarning?: (warning: UvrSongPreparationWarning) => void
  onSessionCreated?: (sessionId: string) => void
  onCompleted?: (
    sessionId: string,
    result: ProcessingResult,
  ) => void | Promise<void>
}

export interface UvrSessionPreparationOptions extends UvrSongPreparationOptions {
  file?: File
}

const MISSING_FILE_MESSAGE =
  'The source file is no longer available. Choose the song again.'
const INCOMPLETE_MESSAGE =
  'Song preparation ended before its stems were saved. Try again.'
const SESSION_NOT_SAVED_MESSAGE =
  'The stems were created, but this device could not save the song record. Free up storage, then try again to open the saved result.'

function report(
  options: UvrSongPreparationOptions,
  phase: UvrSongPreparationPhase,
  progress: number | null,
): void {
  options.onUpdate?.({ phase, progress })
}

function warn(
  options: UvrSongPreparationOptions,
  warning: UvrSongPreparationWarning,
): void {
  options.onWarning?.(warning)
}

function markProcessing(sessionId: string, focus: boolean): UvrSession | null {
  const session = getUvrSession(sessionId)
  if (session === undefined) return null
  const updated: UvrSession = {
    ...session,
    status: 'processing',
    progress: 0,
    indeterminate: true,
    error: undefined,
  }
  saveAllUvrSessions(
    getAllUvrSessions().map((candidate) =>
      candidate.sessionId === sessionId ? updated : candidate,
    ),
  )
  if (focus) setCurrentUvrSession(updated)
  return updated
}

function abortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function signalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true
}

export function humanizeUvrPreparationError(
  message: string,
  mode: UvrProcessingMode,
): string {
  const internal =
    /is null|is undefined|is not a function|can(?:no|')t (?:read|access)|reading '|undefined is not|TypeError/i.test(
      message,
    )
  if (!internal) return message
  return mode === 'server'
    ? 'Studio processing hit an unexpected error. Try again in a moment.'
    : 'On-device processing hit an unexpected error. Reload and try again.'
}

function failSession(
  sessionId: string,
  message: string,
): Extract<UvrSongPreparationResult, { status: 'error' }> {
  setErrorUvrSession(sessionId, message)
  return { status: 'error', sessionId, message }
}

/**
 * Run a known session from its supplied or durably retained source file.
 * Retry surfaces can use this without creating another session record.
 */
export async function runUvrSessionPreparation(
  sessionId: string,
  options: UvrSessionPreparationOptions,
): Promise<UvrSongPreparationResult> {
  const focus = options.focus ?? false
  const cancelled = () => options.signal?.aborted === true
  let cancellationIssued = false
  const cancelRun = (): Extract<
    UvrSongPreparationResult,
    { status: 'cancelled' }
  > => {
    if (!cancellationIssued) {
      cancellationIssued = true
      const apiSessionId = getUvrSession(sessionId)?.apiSessionId
      cancelUvrPipeline(options.mode, apiSessionId)
      cancelUvrSession(sessionId, focus)
    }
    return { status: 'cancelled', sessionId }
  }
  let file = options.file ?? null

  if (file === null) {
    report(options, 'checking-library', null)
    file = await getOriginalFileBlob(sessionId)
  } else {
    report(options, 'saving-original', null)
    const originalSave = await saveStemBlobDurable(
      sessionId,
      'original',
      file,
      file.name,
    )
    if (!originalSave.ok) {
      console.warn(
        '[uvr-song-preparation] original-file save failed:',
        originalSave.error,
      )
      warn(options, {
        code: 'original-not-saved',
        message:
          'The song can continue, but retrying after a reload may require choosing the file again.',
      })
    }
  }

  if (cancelled()) return cancelRun()
  if (file === null) return failSession(sessionId, MISSING_FILE_MESSAGE)

  if (!(await hasRoomFor(file.size * 12))) {
    warn(options, {
      code: 'low-storage',
      message:
        'Storage is running low. Free up space so the separated stems can be saved.',
    })
  }
  if (cancelled()) return cancelRun()

  if (markProcessing(sessionId, focus) === null) {
    return {
      status: 'error',
      sessionId,
      message: 'This preparation session is no longer available.',
    }
  }

  let outcome: UvrSongPreparationResult | null = null
  let completionStarted = false
  const handleAbort = () => {
    // Once the pipeline has handed us completed stems, cancellation stops the
    // room handoff but must not overwrite a durable completed library record.
    outcome = completionStarted
      ? { status: 'cancelled', sessionId }
      : cancelRun()
  }
  options.signal?.addEventListener('abort', handleAbort, { once: true })

  try {
    report(options, 'preparing', null)
    await runUvrPipeline(
      file,
      sessionId,
      options.mode,
      {
        onProgress: (progress) => {
          if (cancelled()) return
          const normalized = Math.max(0, Math.min(100, progress))
          report(
            options,
            normalized <= 0
              ? 'preparing'
              : normalized >= 100
                ? 'finalizing'
                : 'separating',
            normalized,
          )
        },
        onComplete: async (result) => {
          if (cancelled()) {
            outcome = cancelRun()
            return
          }
          completionStarted = true
          report(options, 'finalizing', 100)
          const persisted = await completeUvrSession(
            sessionId,
            result.outputs,
            result.stemMeta,
          )
          if (cancelled()) {
            outcome = { status: 'cancelled', sessionId }
            return
          }
          if (!persisted) {
            warn(options, {
              code: 'session-not-saved',
              message: SESSION_NOT_SAVED_MESSAGE,
            })
            outcome = {
              status: 'error',
              sessionId,
              message: SESSION_NOT_SAVED_MESSAGE,
            }
            return
          }
          outcome = { status: 'completed', sessionId }
          try {
            await options.onCompleted?.(sessionId, result)
          } catch (error) {
            console.error(
              '[uvr-song-preparation] completion hook failed:',
              error,
            )
          }
        },
        onError: (rawMessage) => {
          if (cancelled()) {
            outcome = cancelRun()
            return
          }
          const message = humanizeUvrPreparationError(rawMessage, options.mode)
          outcome = failSession(sessionId, message)
        },
      },
      { signal: options.signal },
    )

    if (outcome !== null) return outcome
    return failSession(sessionId, INCOMPLETE_MESSAGE)
  } catch (error) {
    if (outcome !== null) return outcome
    if (cancelled() || abortError(error)) {
      return cancelRun()
    }
    const message = humanizeUvrPreparationError(
      error instanceof Error ? error.message : 'Song preparation failed.',
      options.mode,
    )
    return failSession(sessionId, message)
  } finally {
    options.signal?.removeEventListener('abort', handleAbort)
  }
}

/** Prepare one source file, reusing completed or recoverable matching work. */
export async function prepareUvrSong(
  file: File,
  options: UvrSongPreparationOptions,
): Promise<UvrSongPreparationResult> {
  const maxBytes =
    options.mode === 'server' ? SERVER_MAX_UPLOAD_BYTES : LOCAL_MAX_UPLOAD_BYTES
  const validationError = audioUploadValidationError(
    file,
    maxBytes,
    undefined,
    options.mode === 'server' ? 'studio' : 'on-device',
  )
  if (validationError !== null) {
    return { status: 'error', message: validationError }
  }

  try {
    await initSessionStore()
    if (signalAborted(options.signal)) return { status: 'cancelled' }

    report(options, 'checking-library', null)
    const hash = await computeFileHash(file)
    if (signalAborted(options.signal)) return { status: 'cancelled' }

    const existing = getUvrSessionByHash(hash)
    const dbMatch = await findSessionByFileHash(hash)
    if (dbMatch?.status === 'completed') {
      return { status: 'existing', sessionId: dbMatch.sessionId }
    }
    if (existing !== undefined) {
      const persisted = await persistSessionDurable(existing)
      if (signalAborted(options.signal)) {
        return { status: 'cancelled', sessionId: existing.sessionId }
      }
      if (persisted) {
        return { status: 'existing', sessionId: existing.sessionId }
      }
      warn(options, {
        code: 'session-not-saved',
        message: SESSION_NOT_SAVED_MESSAGE,
      })
      return {
        status: 'error',
        sessionId: existing.sessionId,
        message: SESSION_NOT_SAVED_MESSAGE,
      }
    }

    if (dbMatch !== null) {
      const stored = getUvrSession(dbMatch.sessionId)
      const persistedJobIsRecoverable =
        dbMatch.processingMode === 'server' &&
        dbMatch.apiSessionId !== undefined &&
        dbMatch.apiSessionId !== '' &&
        (dbMatch.status === 'processing' || dbMatch.status === 'finalizing')
      if (persistedJobIsRecoverable) {
        const cachedJobIsRecoverable =
          stored?.processingMode === 'server' &&
          stored.apiSessionId === dbMatch.apiSessionId &&
          (stored.status === 'processing' || stored.status === 'finalizing')
        return {
          status: 'in-flight',
          sessionId: dbMatch.sessionId,
          ...(cachedJobIsRecoverable ? {} : { requiresHydration: true }),
        }
      }
    }

    // Only a server job with its durable provider ID is safe to reuse after a
    // reload. A local `processing` record can be stale while startup repair is
    // still checking it, and treating that record as active would strand the
    // song with no worker capable of completing it.
    const inFlight = getAllUvrSessions().find(
      (session) =>
        session.fileHash === hash &&
        session.processingMode === 'server' &&
        session.apiSessionId !== undefined &&
        session.apiSessionId !== '' &&
        (session.status === 'processing' || session.status === 'finalizing'),
    )
    if (inFlight !== undefined) {
      return { status: 'in-flight', sessionId: inFlight.sessionId }
    }
    if (signalAborted(options.signal)) return { status: 'cancelled' }

    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      options.mode,
      hash,
      options.focus ?? false,
      options.mode === 'server' && options.bandSplit === true,
    )
    try {
      options.onSessionCreated?.(sessionId)
    } catch (error) {
      console.error('[uvr-song-preparation] session hook failed:', error)
    }

    return runUvrSessionPreparation(sessionId, { ...options, file })
  } catch (error) {
    if (signalAborted(options.signal) || abortError(error)) {
      return { status: 'cancelled' }
    }
    return {
      status: 'error',
      message: humanizeUvrPreparationError(
        error instanceof Error ? error.message : 'Song preparation failed.',
        options.mode,
      ),
    }
  }
}
