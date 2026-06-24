// ============================================================
// Onset Worker — Detect onsets & beats off the main thread
// ============================================================

import { analyzeOnsetsAndBeats } from '../lib/onset-detector'

export type OnsetWorkerMessage = {
  type: 'DETECT_ONSETS'
  spectra: Float32Array[]
  sampleRate: number
  hopSize: number
  threshold?: number
  minInterval?: number
}

export type OnsetWorkerResponse =
  | {
      type: 'ONSET_RESULT'
      onsets: Array<{
        time: number
        strength: number
        isBeat: boolean
        beatPosition?: number
      }>
      bpm: number
      confidence: number
    }
  | {
      type: 'ERROR'
      error: string
    }

self.onmessage = (event: MessageEvent<OnsetWorkerMessage>) => {
  if (event.data.type === 'DETECT_ONSETS') {
    try {
      const { spectra, sampleRate, hopSize, threshold, minInterval } =
        event.data
      const result = analyzeOnsetsAndBeats(spectra, sampleRate, hopSize, {
        threshold,
        minInterval,
      })
      // Transfer onsets (they're plain objects, not transferable buffers)
      self.postMessage({
        type: 'ONSET_RESULT',
        onsets: result.onsets,
        bpm: result.bpm,
        confidence: result.confidence,
      })
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
