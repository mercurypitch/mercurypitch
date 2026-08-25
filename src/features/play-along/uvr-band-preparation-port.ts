// Shared UVR band preparation reconnects or runs one durable full-band split.
// ============================================================

import { readUvrStemManifest } from '@/db/services/uvr-read-service'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import type { PlayAlongBandPreparationPort, PlayAlongBandPreparationResult, } from './band-preparation-port'
import type { PlayAlongStemKind, PlayAlongTargetPolicy } from './song-port'
import { GUITAR_PLAY_ALONG_POLICY, hasUsablePlayAlongParts, isPlayAlongStemKind, } from './song-port'

const BAND_PART_KINDS = new Set(['drums', 'bass', 'guitar', 'piano', 'other'])

function savedPartKinds(
  available: readonly string[],
): readonly PlayAlongStemKind[] {
  return available.filter(
    (kind): kind is PlayAlongStemKind =>
      isPlayAlongStemKind(kind) && BAND_PART_KINDS.has(kind),
  )
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
}

async function reusePreparedBand(
  sessionId: string,
  signal: AbortSignal,
  policy: PlayAlongTargetPolicy,
): Promise<PlayAlongBandPreparationResult | null> {
  if (!(await refreshUvrSessionFromDb(sessionId))) {
    throw new Error(
      'This prepared song could not be reconnected. Reopen it and try again.',
    )
  }
  throwIfAborted(signal)

  const savedKinds = await readUvrStemManifest(sessionId)
  throwIfAborted(signal)
  return hasUsablePlayAlongParts(savedKinds, policy)
    ? { saved: savedPartKinds(savedKinds) }
    : null
}

export function createUvrPlayAlongBandPreparationPort(
  policy: PlayAlongTargetPolicy = GUITAR_PLAY_ALONG_POLICY,
): PlayAlongBandPreparationPort {
  return {
    reusePreparedBand: (sessionId, options) =>
      reusePreparedBand(sessionId, options.signal, policy),
    prepareBand: async (sessionId, options) => {
      // A paid result may already be durable even when the prior surface
      // failed during refresh or restaging. Reuse it before any new job.
      const reusable = await reusePreparedBand(
        sessionId,
        options.signal,
        policy,
      )
      if (reusable !== null) return reusable

      const session = getUvrSession(sessionId)
      const { startManagedStemSplit } = await import('@/lib/uvr-auto-resume')
      throwIfAborted(options.signal)
      await startManagedStemSplit(sessionId, {
        reuseApiSessionId: session?.apiSessionId,
        durationSeconds: session?.stemMeta?.instrumental?.duration,
        signal: options.signal,
        onProgress: (progress) =>
          options.onUpdate({
            phase: progress.phase,
            progress: progress.pct,
            detail:
              progress.phase === 'saving' && progress.part !== undefined
                ? `Saving ${progress.part}`
                : undefined,
          }),
      })
      throwIfAborted(options.signal)
      const reconciledKinds = await readUvrStemManifest(sessionId)
      if (!hasUsablePlayAlongParts(reconciledKinds, policy)) {
        throw new Error(
          'The full-band separation did not save every required part. Your original mix is still ready; try again.',
        )
      }
      return { saved: savedPartKinds(reconciledKinds) }
    },
  }
}
