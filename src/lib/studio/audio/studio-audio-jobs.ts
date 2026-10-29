// Studio audio jobs — what the Studio audio worker does with each request: check a take, build its peaks, check a restore's bytes.
//
// The worker file only moves messages; the work is here so it is tested
// without a worker. A job gets the stored Blob of a take (no copy) or the
// bytes a restore read from its backup (transferred), and answers with
// buffers to transfer back.
import type { CanonicalPcmMetadata } from './canonical-pcm'
import { CANONICAL_PCM_HEADER_BYTES, checkCanonicalPcm, checkCanonicalPcmHash, validateCanonicalPcmBytes, } from './canonical-pcm'
import { sha256InPlace } from './sha256'
import { buildStudioPeaks, encodeStudioPeaks } from './waveform-peaks'

export type StudioAudioRequest =
  | {
      readonly id: number
      /** `verify`: the checked bytes back. `peaks`: the take's encoded waveform peaks. */
      readonly kind: 'verify' | 'peaks'
      readonly blob: Blob
      readonly metadata: CanonicalPcmMetadata
    }
  | {
      readonly id: number
      /** A take's two files, checked and handed back as they came. */
      readonly kind: 'bytes'
      readonly original: ArrayBuffer
      readonly canonical: ArrayBuffer
      readonly sha256: string
      readonly metadata: CanonicalPcmMetadata
    }

export type StudioAudioResponse =
  | {
      readonly id: number
      readonly ok: true
      readonly bytes: readonly ArrayBuffer[]
    }
  | { readonly id: number; readonly ok: false; readonly message: string }

/**
 * Posted once, when the worker's code has loaded. Bytes sent to a worker
 * that never loads are lost, so the page holds them back until this comes.
 */
export interface StudioAudioReady {
  readonly ready: true
}

/** The buffers that answer `request`, for the worker to transfer back. */
export async function answerStudioAudioJob(
  request: StudioAudioRequest,
): Promise<ArrayBuffer[]> {
  const { metadata } = request
  if (request.kind === 'bytes') {
    // In place, as on the page: a restore holds the song's audio once.
    if ((await sha256InPlace(request.original)) !== request.sha256)
      throw new Error('Original audio checksum failed')
    await validateCanonicalPcmBytes(request.canonical, metadata)
    return [request.original, request.canonical]
  }
  const bytes = await request.blob.arrayBuffer()
  if (request.kind === 'verify') {
    await checkCanonicalPcm(bytes, metadata)
    return [bytes]
  }
  await checkCanonicalPcmHash(bytes, metadata)
  // Building the peaks scans every sample, and refuses one that is not finite.
  const channels = Array.from(
    { length: metadata.channels },
    (_, channel) =>
      new Float32Array(
        bytes,
        CANONICAL_PCM_HEADER_BYTES +
          channel * metadata.normalizedFrameCount * 4,
        metadata.normalizedFrameCount,
      ),
  )
  return [
    encodeStudioPeaks(
      buildStudioPeaks(channels, metadata.normalizedFrameCount),
      metadata.canonicalPcmSha256,
    ),
  ]
}
