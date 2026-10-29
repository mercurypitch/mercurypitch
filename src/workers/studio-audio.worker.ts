// ============================================================
// Studio audio worker — checks a take's canonical PCM, builds its waveform peaks and checks a restore's audio away from the page's thread
//
// Reading a take, hashing it and scanning every sample took the main thread
// a second and more on a large song's open, and a restore's hashes held it
// for seconds. Here the page hands over the stored Blob (no copy), or a
// restore's bytes (transferred both ways), and gets back the checked bytes,
// or the take's encoded peaks. The work lives in
// lib/studio/audio/studio-audio-jobs.ts, so it is tested without a worker;
// this file only moves messages.
// ============================================================

import type { StudioAudioReady, StudioAudioRequest, StudioAudioResponse, } from '@/lib/studio/audio/studio-audio-jobs'
import { answerStudioAudioJob } from '@/lib/studio/audio/studio-audio-jobs'

self.onmessage = (event: MessageEvent<StudioAudioRequest>) => {
  const { id } = event.data
  answerStudioAudioJob(event.data).then(
    (bytes) =>
      self.postMessage({ id, ok: true, bytes } satisfies StudioAudioResponse, {
        transfer: bytes,
      }),
    (error: unknown) =>
      self.postMessage({
        id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      } satisfies StudioAudioResponse),
  )
}

self.postMessage({ ready: true } satisfies StudioAudioReady)
