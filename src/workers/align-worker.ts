// ============================================================
// Align Worker — DTW alignment off the main thread
// ============================================================

import { alignRecordings } from '../lib/dtw-aligner'

export type AlignWorkerMessage = {
  type: 'ALIGN'
  referenceChroma: Float32Array[]
  userChroma: Float32Array[]
  bandWidth?: number
  hopSize?: number
}

export type AlignWorkerResponse =
  | {
      type: 'ALIGN_RESULT'
      result: {
        timeMap: Float32Array
        similarityScore: number
        tempoRatio: number
        frameDistance: Float32Array
      }
    }
  | {
      type: 'PROGRESS'
      percent: number
    }
  | {
      type: 'ERROR'
      error: string
    }

self.onmessage = (event: MessageEvent<AlignWorkerMessage>) => {
  if (event.data.type === 'ALIGN') {
    try {
      const { referenceChroma, userChroma, bandWidth, hopSize } = event.data
      const result = alignRecordings(referenceChroma, userChroma, {
        bandWidth,
        hopSize,
      })

      // Transfer Float32Array buffers back (zero-copy)
      const transfers: Transferable[] = []
      if (result.timeMap.buffer instanceof ArrayBuffer) {
        transfers.push(result.timeMap.buffer)
      }
      if (result.frameDistance.buffer instanceof ArrayBuffer) {
        transfers.push(result.frameDistance.buffer)
      }

      self.postMessage(
        {
          type: 'ALIGN_RESULT',
          result: {
            timeMap: result.timeMap,
            similarityScore: result.similarityScore,
            tempoRatio: result.tempoRatio,
            frameDistance: result.frameDistance,
          },
        },
        transfers,
      )
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
