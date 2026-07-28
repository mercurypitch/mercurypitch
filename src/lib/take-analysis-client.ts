// ============================================================
// Take analysis client — worker lifecycle for offline take analysis
//
// Follows the OnsetClient / AlignClient pattern in analysis-clients.ts.
// ============================================================

import type { TakeAnalysisResponse, TakeAnalysisResult, } from '@/workers/take-analysis.worker'

export type { TakeAnalysisResult }

export class TakeAnalysisClient {
  private worker: Worker | null = null

  constructor(
    private onResult: (result: TakeAnalysisResult) => void,
    private onProgress?: (pct: number) => void,
    private onError?: (message: string) => void,
  ) {
    this.worker = new Worker(
      new URL('../workers/take-analysis.worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = (e: MessageEvent<TakeAnalysisResponse>) => {
      if (e.data.type === 'RESULT') this.onResult(e.data.result)
      else if (e.data.type === 'PROGRESS') this.onProgress?.(e.data.pct)
      else if (e.data.type === 'ERROR') this.onError?.(e.data.error)
    }
    this.worker.onerror = (e) => this.onError?.(e.message)
  }

  /**
   * @param samples mono audio
   * @param sampleRate source rate; the worker decimates internally
   * @param fundamentalHz known f0 (median of cached notes), if any
   */
  analyze(
    samples: Float32Array,
    sampleRate: number,
    fundamentalHz?: number,
  ): void {
    if (!this.worker) return
    // Copy before transferring — the caller's buffer may be a view onto an
    // AudioBuffer channel it still needs.
    const copy = new Float32Array(samples)
    this.worker.postMessage(
      { type: 'ANALYZE', samples: copy, sampleRate, fundamentalHz },
      { transfer: [copy.buffer] },
    )
  }

  destroy(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
