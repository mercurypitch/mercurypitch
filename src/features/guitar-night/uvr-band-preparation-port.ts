// UVR band preparation port reconnects standalone Guitar Night to the durable full-band split.
// ============================================================

import { startManagedStemSplit } from '@/lib/uvr-auto-resume'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'

export function createUvrGuitarNightBandPreparationPort(): GuitarNightBandPreparationPort {
  return {
    prepareBand: async (sessionId, options) => {
      if (!(await refreshUvrSessionFromDb(sessionId))) {
        throw new Error(
          'This prepared song could not be reconnected. Reopen it and try again.',
        )
      }
      if (options.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }

      const session = getUvrSession(sessionId)
      const result = await startManagedStemSplit(sessionId, {
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
      return { saved: result.saved }
    },
  }
}
