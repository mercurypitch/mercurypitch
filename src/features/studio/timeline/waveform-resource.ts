// Studio waveform resources — sequential validated PCM reads retain bounded envelopes, never source buffers.
import { decodeCanonicalPcm } from '@/lib/studio/audio/canonical-pcm'
import type { PcmAudio } from '@/lib/studio/audio/import-limits'
import { importCheckpoint } from '@/lib/studio/audio/import-limits'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset } from '@/lib/studio/model/types'

export const STUDIO_WAVEFORM_BUCKETS = 4096
export const STUDIO_WAVEFORM_CACHE_ENTRIES = 128
export class StudioWaveformBusyError extends Error {
  constructor(cause: unknown) {
    super(
      'Waveform unavailable while Studio is using memory for other audio.',
      { cause },
    )
    this.name = 'StudioWaveformBusyError'
  }
}
export interface StudioWaveformEnvelope {
  frameCount: number
  framesPerBucket: number
  minima: Float32Array
  maxima: Float32Array
  /** Loudness body per bucket, across all channels: drawn inside the peaks. */
  rms: Float32Array
}

/** Preserve actual amplitude, including silence; no per-clip visual normalization. */
export async function buildStudioWaveform(
  audio: PcmAudio,
  signal?: AbortSignal,
): Promise<StudioWaveformEnvelope> {
  const framesPerBucket = Math.max(
    1,
    Math.ceil(audio.length / STUDIO_WAVEFORM_BUCKETS),
  )
  const buckets = Math.ceil(audio.length / framesPerBucket)
  const minima = new Float32Array(buckets)
  const maxima = new Float32Array(buckets)
  const rms = new Float32Array(buckets)
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = audio.getChannelData(channel)
    for (let start = 0; start < samples.length; start += 65_536) {
      const end = Math.min(samples.length, start + 65_536)
      for (let frame = start; frame < end; frame++) {
        const value = samples[frame]
        if (!Number.isFinite(value))
          throw new Error('This audio contains invalid samples.')
        const bucket = Math.floor(frame / framesPerBucket)
        minima[bucket] = Math.min(minima[bucket], value)
        maxima[bucket] = Math.max(maxima[bucket], value)
        rms[bucket] += value * value
      }
      await importCheckpoint(signal)
    }
  }
  for (let bucket = 0; bucket < buckets; bucket++) {
    const frames = Math.min(
      framesPerBucket,
      audio.length - bucket * framesPerBucket,
    )
    rms[bucket] = Math.sqrt(
      rms[bucket] / Math.max(1, frames * audio.numberOfChannels),
    )
  }
  return { frameCount: audio.length, framesPerBucket, minima, maxima, rms }
}

export function createStudioWaveformResource(
  read: (id: string) => Promise<Blob>,
) {
  const abort = new AbortController()
  const entries = new Map<string, Promise<StudioWaveformEnvelope>>()
  const releaseEnvelopes = new Map<string, () => void>()
  let queue: Promise<unknown> = Promise.resolve()
  return {
    get(asset: StudioAsset): Promise<StudioWaveformEnvelope> {
      const key = `${asset.id}:${asset.canonicalPcmSha256}`
      const cached = entries.get(key)
      if (cached) return cached
      if (entries.size >= STUDIO_WAVEFORM_CACHE_ENTRIES)
        return Promise.reject(
          new Error('This project has too many waveform assets.'),
        )
      const job = queue.then(async () => {
        abort.signal.throwIfAborted()
        const bucketSize = Math.max(
          1,
          Math.ceil(asset.normalizedFrameCount / STUDIO_WAVEFORM_BUCKETS),
        )
        const envelopeBytes =
          Math.ceil(asset.normalizedFrameCount / bucketSize) * 12
        let releaseEnvelope: (() => void) | undefined
        let releaseRead: (() => void) | undefined
        try {
          try {
            releaseEnvelope = reserveStudioMemory(envelopeBytes)
            // Canonical Blob, its read/digest copies or decoded channels.
            // A DB read is admitted here, before asking the caller for bytes.
            releaseRead = reserveStudioMemory(asset.canonicalPcmByteLength * 3)
          } catch (cause) {
            throw new StudioWaveformBusyError(cause)
          }
          const blob = await read(asset.id)
          const audio = await decodeCanonicalPcm(blob, asset, {
            signal: abort.signal,
          })
          const envelope = await buildStudioWaveform(audio, abort.signal)
          abort.signal.throwIfAborted()
          releaseEnvelopes.set(key, releaseEnvelope)
          releaseEnvelope = undefined
          return envelope
        } finally {
          releaseRead?.()
          releaseEnvelope?.()
        }
      })
      queue = job.catch(() => undefined)
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
