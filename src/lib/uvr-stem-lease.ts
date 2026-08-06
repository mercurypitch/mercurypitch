// ============================================================
// UVR Stem Lease — route-owned playable URLs for durable stem blobs
// ============================================================
//
// Durable stem rows belong to the UVR database. The object URLs minted while
// hydrating them belong to the caller and must not leak across route changes.

import type { UvrStemType } from '@/db/entities'
import type { UvrStemSnapshotEntry } from '@/db/services/uvr-read-service'
import { readUvrStemSnapshot } from '@/db/services/uvr-read-service'
import { wavDurationSeconds } from '@/lib/wav-meta'

export type UvrStemLeaseAsset = {
  kind: UvrStemType
  url: string
  sizeBytes: number
  durationSeconds?: number
}

export interface UvrStemLease {
  assets: readonly UvrStemLeaseAsset[]
  release(): void
}

export interface OpenUvrStemLeaseOptions {
  signal?: AbortSignal
  /** Reuse the caller's strict stem snapshot so each large durable row is read
   * only once across planning and URL hydration. */
  snapshot?: readonly UvrStemSnapshotEntry[]
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal !== undefined && signal.aborted) throw abortError()
}

/**
 * Mint a caller-owned lease for the requested stems that exist on this
 * device. Aborting the load (or the returned lease's signal) releases every
 * URL minted by this call; durable UVR state is never changed.
 */
export async function openUvrStemLease(
  sessionId: string,
  requested: readonly UvrStemType[],
  options: OpenUvrStemLeaseOptions = {},
): Promise<UvrStemLease | null> {
  const signal = options.signal
  const requestedKinds = [...new Set(requested)]
  const ownedUrls = new Set<string>()
  let released = false

  const release = (): void => {
    if (released) return
    released = true
    signal?.removeEventListener('abort', release)

    for (const url of ownedUrls) URL.revokeObjectURL(url)
    ownedUrls.clear()
  }

  try {
    throwIfAborted(signal)
    if (requestedKinds.length === 0) return null

    const snapshot = options.snapshot ?? (await readUvrStemSnapshot(sessionId))
    const availableByKind = new Map(snapshot.map((stem) => [stem.kind, stem]))
    throwIfAborted(signal)

    const assets: UvrStemLeaseAsset[] = []
    for (const kind of requestedKinds) {
      const entry = availableByKind.get(kind)
      if (entry === undefined) continue

      throwIfAborted(signal)
      const url = URL.createObjectURL(
        new Blob([entry.data], { type: entry.mimeType }),
      )
      ownedUrls.add(url)
      assets.push({
        kind,
        url,
        sizeBytes: entry.sizeBytes,
        durationSeconds: wavDurationSeconds(
          entry.data.slice(0, 4096),
          entry.sizeBytes,
        ),
      })
      throwIfAborted(signal)
    }

    if (assets.length === 0) {
      release()
      return null
    }

    throwIfAborted(signal)
    signal?.addEventListener('abort', release, { once: true })

    return {
      assets: Object.freeze(assets),
      release,
    }
  } catch (error) {
    release()
    throw error
  }
}
