// UVR band preparation port reconnects standalone Guitar Night to the durable full-band split.
// ============================================================

import { readUvrStemManifest } from '@/db/services/uvr-read-service'
import { startManagedStemSplit } from '@/lib/uvr-auto-resume'
import { getUvrSession, refreshUvrSessionFromDb } from '@/stores/uvr-store'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'

const BAND_PART_KINDS = new Set(['drums', 'bass', 'guitar', 'piano', 'other'])

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

      // A split that saved its parts but failed afterwards (library refresh,
      // reload mid-restage) left the PAID result durable in IndexedDB —
      // reconnect to it instead of resubmitting a second billable split.
      const savedKinds = await readUvrStemManifest(sessionId)
      const savedParts = savedKinds.filter((kind) => BAND_PART_KINDS.has(kind))
      if (savedParts.length > 0) {
        return { saved: savedParts }
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
