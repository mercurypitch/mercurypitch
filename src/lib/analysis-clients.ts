// ============================================================
// Analysis Clients — Worker lifecycle management for Phase 4 tools
// ============================================================

import type { AlignmentResult, OnsetResult } from '@/types'

// ── Onset Client ─────────────────────────────────────────────

type OnsetCallback = (result: {
  onsets: OnsetResult[]
  bpm: number
  confidence: number
}) => void

export class OnsetClient {
  private worker: Worker | null = null
  private callback: OnsetCallback | null = null
  private onError: (() => void) | null = null

  constructor(cb: OnsetCallback, onError?: () => void) {
    this.callback = cb
    this.onError = onError ?? null
    this.worker = new Worker(
      new URL('../workers/onset-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = (
      e: MessageEvent<{
        type: string
        onsets: OnsetResult[]
        bpm: number
        confidence: number
        error?: string
      }>,
    ) => {
      if (e.data.type === 'ONSET_RESULT') {
        this.callback?.({
          onsets: e.data.onsets,
          bpm: e.data.bpm,
          confidence: e.data.confidence,
        })
      } else if (e.data.type === 'ERROR') {
        console.warn('[OnsetClient] Worker error:', e.data.error)
        this.onError?.()
      }
    }
    this.worker.onerror = (e) => {
      console.warn('[OnsetClient] Worker error:', e.message)
      this.onError?.()
    }
  }

  detect(
    spectra: Float32Array[],
    sampleRate: number,
    hopSize: number,
    options?: { threshold?: number; minInterval?: number },
  ) {
    this.worker?.postMessage({
      type: 'DETECT_ONSETS',
      spectra,
      sampleRate,
      hopSize,
      ...options,
    })
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
  }
}

// ── Align Client ─────────────────────────────────────────────

type AlignCallback = (result: AlignmentResult) => void

export class AlignClient {
  private worker: Worker | null = null
  private callback: AlignCallback | null = null
  private onError: (() => void) | null = null

  constructor(cb: AlignCallback, onError?: () => void) {
    this.callback = cb
    this.onError = onError ?? null
    this.worker = new Worker(
      new URL('../workers/align-worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = (
      e: MessageEvent<{
        type: string
        result?: AlignmentResult
        error?: string
      }>,
    ) => {
      if (e.data.type === 'ALIGN_RESULT' && e.data.result) {
        this.callback?.(e.data.result)
      } else if (e.data.type === 'ERROR') {
        console.warn('[AlignClient] Worker error:', e.data.error)
        this.onError?.()
      }
    }
    this.worker.onerror = (e) => {
      console.warn('[AlignClient] Worker error:', e.message)
      this.onError?.()
    }
  }

  align(
    referenceChroma: Float32Array[],
    userChroma: Float32Array[],
    options?: { bandWidth?: number; hopSize?: number },
  ) {
    this.worker?.postMessage({
      type: 'ALIGN',
      referenceChroma,
      userChroma,
      ...options,
    })
  }

  destroy() {
    this.worker?.terminate()
    this.worker = null
  }
}
