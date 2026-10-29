// ============================================================
// Studio audio worker — checks a take's canonical PCM and builds its waveform peaks away from the page's thread
//
// Reading a take, hashing it and scanning every sample took the main thread
// a second and more on a large song's open. Here the page hands over the
// stored Blob (no copy), and gets back either the checked bytes, transferred,
// or the take's encoded peaks. The checks and the peaks live in
// lib/studio/audio, so they are tested without a worker; this file only
// moves messages.
// ============================================================

import type { CanonicalPcmMetadata } from '@/lib/studio/audio/canonical-pcm'
import { CANONICAL_PCM_HEADER_BYTES, checkCanonicalPcm, checkCanonicalPcmHash, } from '@/lib/studio/audio/canonical-pcm'
import { buildStudioPeaks, encodeStudioPeaks, } from '@/lib/studio/audio/waveform-peaks'

export interface StudioAudioRequest {
  readonly id: number
  /** `verify`: the checked bytes back. `peaks`: the take's encoded waveform peaks. */
  readonly kind: 'verify' | 'peaks'
  readonly blob: Blob
  readonly metadata: CanonicalPcmMetadata
}

export type StudioAudioResponse =
  | { readonly id: number; readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly ok: false; readonly message: string }

async function answer(request: StudioAudioRequest): Promise<ArrayBuffer> {
  const bytes = await request.blob.arrayBuffer()
  const { metadata } = request
  if (request.kind === 'verify') {
    await checkCanonicalPcm(bytes, metadata)
    return bytes
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
  return encodeStudioPeaks(
    buildStudioPeaks(channels, metadata.normalizedFrameCount),
    metadata.canonicalPcmSha256,
  )
}

self.onmessage = (event: MessageEvent<StudioAudioRequest>) => {
  const { id } = event.data
  answer(event.data).then(
    (bytes) =>
      self.postMessage({ id, ok: true, bytes } satisfies StudioAudioResponse, {
        transfer: [bytes],
      }),
    (error: unknown) =>
      self.postMessage({
        id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      } satisfies StudioAudioResponse),
  )
}
