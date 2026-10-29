// Studio waveform resources — stored peaks first, built once in the audio worker when a take has none, two takes at a time.
//
// Opening a song used to read every take's canonical PCM, hash it, scan it
// and rebuild a 4,096-bucket envelope on the main thread, one take at a
// time. Now a take's peak pyramid is read from where it was stored the
// first time it was drawn (a few hundred kilobytes, not tens of megabytes),
// and a take without one, from before peaks were kept or not yet saved, is
// built in the Studio audio worker from its checked PCM and stored for next
// time.
import { buildStudioPeaksBytes } from '@/lib/studio/audio/studio-audio-client'
import type { StudioPeaks } from '@/lib/studio/audio/waveform-peaks'
import { decodeStudioPeaks, studioPeaksByteLength, } from '@/lib/studio/audio/waveform-peaks'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset } from '@/lib/studio/model/types'

export const STUDIO_WAVEFORM_CACHE_ENTRIES = 128
/** Takes read or built at once: enough to overlap a read with a build, few enough to keep memory flat. */
export const STUDIO_WAVEFORM_CONCURRENCY = 2

export class StudioWaveformBusyError extends Error {
  constructor(cause: unknown) {
    super(
      'Waveform unavailable while Studio is using memory for other audio.',
      { cause },
    )
    this.name = 'StudioWaveformBusyError'
  }
}

/** What a waveform draws from: the take's peak pyramid. */
export type StudioWaveformEnvelope = StudioPeaks

/** Where a take's peaks are kept between visits. */
export interface StudioWaveformPeaksStore {
  read(asset: StudioAsset): Promise<ArrayBuffer | null>
  write(asset: StudioAsset, bytes: ArrayBuffer): Promise<void>
}

function reserve(bytes: number): () => void {
  try {
    return reserveStudioMemory(bytes)
  } catch (cause) {
    throw new StudioWaveformBusyError(cause)
  }
}

/** A gate that lets `limit` jobs run at once, in the order they asked. */
function createLimit(limit: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (active >= limit)
      await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      return await job()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}

export function createStudioWaveformResource(
  read: (id: string) => Promise<Blob>,
  store?: StudioWaveformPeaksStore,
) {
  const abort = new AbortController()
  const entries = new Map<string, Promise<StudioWaveformEnvelope>>()
  const releaseEnvelopes = new Map<string, () => void>()
  const limit = createLimit(STUDIO_WAVEFORM_CONCURRENCY)

  async function stored(asset: StudioAsset): Promise<StudioPeaks | null> {
    if (!store) return null
    try {
      const bytes = await store.read(asset)
      return bytes ? decodeStudioPeaks(bytes, asset) : null
    } catch {
      // A failed read of the cache builds the peaks again.
      return null
    }
  }

  async function build(asset: StudioAsset): Promise<StudioPeaks> {
    // The worker holds one copy of the take while it checks and scans it.
    const releaseRead = reserve(asset.canonicalPcmByteLength)
    try {
      const blob = await read(asset.id)
      abort.signal.throwIfAborted()
      const bytes = await buildStudioPeaksBytes(blob, asset, abort.signal)
      const peaks = decodeStudioPeaks(bytes, asset)
      if (!peaks) throw new Error('Studio waveform peaks did not match.')
      // Kept for the next visit; a take that is not saved yet builds again.
      void store?.write(asset, bytes).catch(() => undefined)
      return peaks
    } finally {
      releaseRead()
    }
  }

  return {
    get(asset: StudioAsset): Promise<StudioWaveformEnvelope> {
      const key = `${asset.id}:${asset.canonicalPcmSha256}`
      const cached = entries.get(key)
      if (cached) return cached
      if (entries.size >= STUDIO_WAVEFORM_CACHE_ENTRIES)
        return Promise.reject(
          new Error('This project has too many waveform assets.'),
        )
      const job = limit(async () => {
        abort.signal.throwIfAborted()
        let releaseEnvelope: (() => void) | undefined = reserve(
          studioPeaksByteLength(asset.normalizedFrameCount),
        )
        try {
          const peaks = (await stored(asset)) ?? (await build(asset))
          abort.signal.throwIfAborted()
          releaseEnvelopes.set(key, releaseEnvelope)
          releaseEnvelope = undefined
          return peaks
        } finally {
          releaseEnvelope?.()
        }
      })
      entries.set(key, job)
      void job.catch(() => entries.delete(key))
      return job
    },
    dispose(): void {
      abort.abort()
      entries.clear()
      for (const release of releaseEnvelopes.values()) release()
      releaseEnvelopes.clear()
    },
  }
}

export type StudioWaveformResource = ReturnType<
  typeof createStudioWaveformResource
>
