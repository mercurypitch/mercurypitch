// Pitch Testing UVR cancellation — maps a local session to its provider job.

import { cancelUvrPipeline } from '@/lib/uvr-processing-pipeline'
import type { UvrProcessingMode } from '@/stores/uvr-store'
import { cancelUvrSession, getUvrSession } from '@/stores/uvr-store'

/** Abort one Pitch Testing separation and mark its local record cancelled. */
export function cancelPitchTestingUvrSession(
  sessionId: string,
  mode: UvrProcessingMode,
  controller: AbortController,
): void {
  // Read before aborting: abort listeners may synchronously update the store,
  // while server deletion needs the provider id rather than our local id.
  const apiSessionId =
    mode === 'server' ? getUvrSession(sessionId)?.apiSessionId : undefined
  controller.abort()
  cancelUvrPipeline(mode, apiSessionId)
  cancelUvrSession(sessionId)
}

/** Restore the Lab-owned cancelled state if a local worker completes late. */
export function preservePitchTestingUvrCancellation(
  sessionId: string,
  signal: AbortSignal,
): boolean {
  if (!signal.aborted) return false
  cancelUvrSession(sessionId)
  return true
}

interface SettlePitchTestingUvrErrorOptions {
  sessionId: string
  signal: AbortSignal
  error: string
  disposed: boolean
  onReportError: (error: string) => void
  onSettleUi: () => void
}

/** Settle a provider error while preserving cancellation after teardown. */
export function settlePitchTestingUvrError(
  options: SettlePitchTestingUvrErrorOptions,
): void {
  const wasCancelled = options.signal.aborted || options.error === 'Cancelled'
  if (options.signal.aborted) {
    preservePitchTestingUvrCancellation(options.sessionId, options.signal)
  }
  if (options.disposed) return
  if (!wasCancelled) options.onReportError(options.error)
  options.onSettleUi()
}
