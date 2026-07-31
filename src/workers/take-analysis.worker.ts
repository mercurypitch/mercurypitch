// ============================================================
// Take analysis worker — message shim around lib/take-analysis
//
// All the DSP lives in `@/lib/take-analysis` so it can be tested without a
// worker harness. This file only moves messages.
// ============================================================

import type { TakeAnalysisResult } from '@/lib/take-analysis'
import { analyzeTake } from '@/lib/take-analysis'

export type { TakeAnalysisResult }

export type TakeAnalysisMessage = {
  type: 'ANALYZE'
  samples: Float32Array
  sampleRate: number
  /** Known f0 (e.g. median of cached detected notes). Estimated when absent. */
  fundamentalHz?: number
}

export type TakeAnalysisResponse =
  | { type: 'PROGRESS'; pct: number }
  | { type: 'RESULT'; result: TakeAnalysisResult }
  | { type: 'ERROR'; error: string }

self.onmessage = (e: MessageEvent<TakeAnalysisMessage>) => {
  if (e.data.type !== 'ANALYZE') return
  try {
    const result = analyzeTake(e.data, (pct) => {
      self.postMessage({ type: 'PROGRESS', pct } satisfies TakeAnalysisResponse)
    })
    self.postMessage(
      { type: 'RESULT', result } satisfies TakeAnalysisResponse,
      {
        transfer: [result.image.buffer],
      },
    )
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    } satisfies TakeAnalysisResponse)
  }
}
