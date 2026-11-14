// ============================================================
// Studio MIDI preview audio — a render held in memory as an asset the transport plays, named by its render key
// ============================================================
//
// A preview stands in for the asset a render becomes once it is kept, so it
// is prepared as that asset will be: the same loudness gain, measured over
// the same samples (preparation-gain.ts), so keeping it changes nothing
// heard. Its canonical copy is 32-bit floats, hashed, as every reader of a
// take checks (canonical-pcm.ts). The bytes are held, and each read gets a
// Blob of them: the reader lets it go once it has its buffer.
//
// Its id names its render key. The transport's graph holds buffers by asset
// id (graph-replan.ts), so an id used again for other audio would play the
// old buffer on; a new key is a new id, and new audio to the transport.
//
// A render runs a tail past its sequence. A take can be as long as the
// Studio's import limit, so the tail is cut where the limit ends, which is
// past every clip's window: the take was no longer than that.
import { CANONICAL_PCM_HEADER_BYTES, CANONICAL_PCM_MIME, encodeCanonicalPcmBytes, } from '@/lib/studio/audio/canonical-pcm'
import { DEFAULT_STUDIO_IMPORT_LIMITS } from '@/lib/studio/audio/import-limits'
import { sourcePreparation } from '@/lib/studio/audio/preparation-gain'
import { sha256InPlace } from '@/lib/studio/audio/sha256'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioAsset } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'

/** A render ready to play, held until no stale clip needs it. */
export interface StudioMidiPreview {
  readonly key: string
  readonly asset: StudioAsset
  /** Its canonical copy. */
  readonly bytes: ArrayBuffer
  /** Give back the memory it holds. */
  release(): void
}

/** A preview's canonical copy, as a reader of a take's reads it. */
export function studioMidiPreviewBlob(preview: StudioMidiPreview): Blob {
  return new Blob([preview.bytes], { type: CANONICAL_PCM_MIME })
}

/** The asset id of the preview of render `key`. */
export function studioMidiPreviewId(key: string): string {
  return `midi-render-${key}`
}

/** A render's samples, cut to the longest audio the Studio keeps. */
export function studioMidiKeptLength(samples: Float32Array): Float32Array {
  const most = DEFAULT_STUDIO_IMPORT_LIMITS.maxFrames
  return samples.length > most ? samples.subarray(0, most) : samples
}

/**
 * The preview of render `key` from its samples, mono at 48 kHz, for song
 * `projectId`. Its canonical copy counts against the Studio's memory until
 * it is released; a render the memory cannot hold is refused.
 */
export async function createStudioMidiPreview(
  rendered: Float32Array,
  key: string,
  projectId: string,
  importedAt: string,
  signal?: AbortSignal,
): Promise<StudioMidiPreview> {
  const samples = studioMidiKeptLength(rendered)
  const audio = {
    sampleRate: STUDIO_SAMPLE_RATE,
    numberOfChannels: 1,
    length: samples.length,
    getChannelData: () => samples,
  }
  const held = reserveStudioMemory(
    CANONICAL_PCM_HEADER_BYTES + samples.length * 4,
  )
  try {
    const preparation = await sourcePreparation(audio, signal)
    const bytes = await encodeCanonicalPcmBytes(audio, { signal })
    const sha256 = await sha256InPlace(bytes, signal)
    const id = studioMidiPreviewId(key)
    const asset: StudioAsset = {
      id,
      projectId,
      sha256,
      mimeType: CANONICAL_PCM_MIME,
      byteLength: bytes.byteLength,
      channels: 1,
      normalizedSampleRate: STUDIO_SAMPLE_RATE,
      normalizedFrameCount: samples.length,
      importVersion: 1,
      canonicalPcmId: `${id}-pcm`,
      canonicalPcmSha256: sha256,
      canonicalPcmByteLength: bytes.byteLength,
      preparation,
      provenance: { kind: 'recording', importedAt },
    }
    return { key, asset, bytes, release: held }
  } catch (error) {
    held()
    throw error
  }
}

/** A preview's samples, to keep it: a view of its canonical copy. */
export function studioMidiPreviewSamples(
  preview: StudioMidiPreview,
): Float32Array {
  return new Float32Array(
    preview.bytes,
    CANONICAL_PCM_HEADER_BYTES,
    preview.asset.normalizedFrameCount,
  )
}
