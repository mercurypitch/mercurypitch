// ============================================================
// Vocal Separator — Main-thread API wrapping the Web Worker
// ============================================================

import type { WorkerCancelMessage, WorkerInitMessage, WorkerOutMessage, WorkerSeparateMessage, } from '../workers/vocal-separator.worker'

export interface SeparateOptions {
  /** If true, returns instrumental instead of vocals as primary output. */
  instrumental?: boolean
}

export interface SeparationResult {
  vocals: Float32Array
  instrumental: Float32Array
  sampleRate: number
  durationSec: number
}

export type SeparatorStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'processing'
  | 'error'

export class VocalSeparator {
  private worker: Worker | null = null
  private _status: SeparatorStatus = 'idle'
  private _error: string | null = null
  private _provider: string | null = null
  private readyResolve: (() => void) | null = null
  private readyPromise: Promise<void> | null = null
  private pendingRequest: {
    resolve: (result: SeparationResult) => void
    reject: (err: Error) => void
    requestId: number
  } | null = null
  private nextRequestId = 1

  get status(): SeparatorStatus {
    return this._status
  }

  get error(): string | null {
    return this._error
  }

  get provider(): string | null {
    return this._provider
  }

  /** Progress callback — receives 0-100 percentage. */
  onProgress: ((pct: number) => void) | null = null

  constructor() {
    this._initWorker()
  }

  private _initWorker(): void {
    this.worker = new Worker(
      new URL('../workers/vocal-separator.worker.ts', import.meta.url),
      { type: 'module' },
    )

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      this._handleMessage(e.data)
    }

    this.worker.onerror = (err) => {
      this._status = 'error'
      this._error = `Worker error: ${err.message}`
    }
  }

  private _handleMessage(msg: WorkerOutMessage): void {
    switch (msg.type) {
      case 'ready': {
        this._status = 'ready'
        this._error = null
        this._provider = msg.provider
        if (this.readyResolve) {
          this.readyResolve()
          this.readyResolve = null
        }
        break
      }

      case 'progress': {
        if (
          this.onProgress &&
          msg.requestId === this.pendingRequest?.requestId
        ) {
          this.onProgress(msg.pct)
        }
        break
      }

      case 'complete': {
        if (msg.requestId === this.pendingRequest?.requestId) {
          this._status = 'ready'
          this.pendingRequest.resolve({
            vocals: msg.vocals,
            instrumental: msg.instrumental,
            sampleRate: msg.metadata.sampleRate,
            durationSec: msg.metadata.durationSec,
          })
          this.pendingRequest = null
        }
        break
      }

      case 'error': {
        if (msg.requestId === this.pendingRequest?.requestId) {
          const isCancel = msg.message === 'Cancelled'
          this._status = isCancel ? 'ready' : 'error'
          this._error = isCancel ? null : msg.message
          this.pendingRequest.reject(new Error(msg.message))
          this.pendingRequest = null
        } else if (msg.requestId === -1) {
          // Init error
          this._status = 'error'
          this._error = msg.message
          if (this.readyResolve) {
            this.readyResolve() // resolve anyway to unblock, error is stored
            this.readyResolve = null
          }
        }
        break
      }
    }
  }

  /** Initialize the ONNX model. Must be called before `separate()`. */
  async initialize(modelPath: string): Promise<void> {
    if (this._status === 'ready') return
    if (this._status === 'initializing') {
      await this.readyPromise
      return
    }

    this._status = 'initializing'
    this._error = null
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const msg: WorkerInitMessage = { type: 'init', modelPath }
    this.worker?.postMessage(msg)

    await this.readyPromise

    if ((this._status as SeparatorStatus) === 'error') {
      throw new Error(this._error ?? 'Initialization failed')
    }
  }

  /** Process audio through the ONNX model. Resolves with separated stems. */
  async separate(
    audio: Float32Array,
    sampleRate: number,
  ): Promise<SeparationResult> {
    if (this._status !== 'ready') {
      throw new Error('Separator not ready. Call initialize() first.')
    }

    this._status = 'processing'
    this._error = null

    return new Promise((resolve, reject) => {
      this.pendingRequest = {
        resolve,
        reject,
        requestId: this.nextRequestId++,
      }

      const msg: WorkerSeparateMessage = {
        type: 'separate',
        audio,
        sampleRate,
        requestId: this.pendingRequest.requestId,
      }
      // Transfer audio buffer to worker (zero-copy)
      this.worker?.postMessage(msg, [audio.buffer])
    })
  }

  /** Cancel in-progress separation. */
  cancel(): void {
    if (this._status !== 'processing') return
    const msg: WorkerCancelMessage = { type: 'cancel' }
    this.worker?.postMessage(msg)
  }

  /** Check if the separator is initialized and ready. */
  isReady(): boolean {
    return this._status === 'ready'
  }

  /** Terminate the worker and release all resources. */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this._status = 'idle'
    this._error = null
    this.pendingRequest = null
    this.readyResolve = null
    this.readyPromise = null
  }
}
