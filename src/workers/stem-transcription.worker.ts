// ============================================================
// Stem transcription worker — keeps note extraction off the UI thread
// ============================================================
//
// Decoding stays on the main thread (it needs an AudioContext); only the
// sample buffer crosses, transferred rather than copied. Everything expensive
// — the per-frame pitch detection — runs here.

import type { StemTranscription, TranscriptionProfile, } from '@/lib/transcription/stem-transcription'
import { transcribeStemSamples } from '@/lib/transcription/stem-transcription'

export interface StemTranscriptionRequest {
  type: 'TRANSCRIBE'
  samples: Float32Array
  sampleRate: number
  profile?: TranscriptionProfile
}

export type StemTranscriptionResponse =
  | { type: 'PROGRESS'; fraction: number }
  | { type: 'RESULT'; result: StemTranscription }
  | { type: 'ERROR'; error: string }

const post = (message: StemTranscriptionResponse): void => {
  self.postMessage(message)
}

self.onmessage = (event: MessageEvent<StemTranscriptionRequest>): void => {
  if (event.data.type !== 'TRANSCRIBE') return
  const { samples, sampleRate, profile } = event.data

  void transcribeStemSamples(samples, sampleRate, {
    profile,
    onProgress: (fraction) => post({ type: 'PROGRESS', fraction }),
  })
    .then((result) => post({ type: 'RESULT', result }))
    .catch((caught: unknown) => {
      post({
        type: 'ERROR',
        error:
          caught instanceof Error
            ? caught.message
            : 'That stem could not be transcribed.',
      })
    })
}
