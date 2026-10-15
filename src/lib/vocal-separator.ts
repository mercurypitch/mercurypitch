// ============================================================
// Vocal Separator — Main-thread API wrapping the Web Worker
// ============================================================

import type { WorkerCancelMessage, WorkerDestroyMessage, WorkerInitMessage, WorkerOutMessage, WorkerSeparateMessage, } from '../workers/vocal-separator.worker'

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

/**
 * How long the graphics card gets to set the model up, counted from the end
 * of the download. A GPU that hangs without reporting a lost device left the
 * separator loading forever; past this the worker is replaced and the model
 * set up on the CPU. A crashed GPU process reports a lost device and moves at
 * once, so this only backs up a silent hang, and is generous enough that a
 * slow but healthy GPU never meets it.
 */
export const GPU_SETUP_LIMIT_MS = 60_000

/**
 * After the device is lost mid-run, how long the worker gets to report that
 * it moved to the CPU by itself before the run is called off.
 */
export const GPU_LOST_GRACE_MS = 20_000

export const GPU_FALLBACK_NOTICE =
  "The graphics card didn't answer in time, so the separator switched to the CPU. It's slower, but it will finish."

export const GPU_LOST_RUN_MESSAGE =
  'The graphics card stopped answering mid-separation. Try again and it will run on the CPU.'

// Once the graphics card has hung in this page, every separator after it
// starts on the CPU: trying it again would only repeat the wait.
let gpuUnavailable = false

export class VocalSeparator {
  private worker: Worker | null = null
  private _status: SeparatorStatus = 'idle'
  private _error: string | null = null
  private _provider: string | null = null
  private readyResolve: (() => void) | null = null
  private readyReject: ((reason?: unknown) => void) | null = null
  private readyPromise: Promise<void> | null = null
  private pendingRequest: {
    resolve: (result: SeparationResult) => void
    reject: (err: Error) => void
    requestId: number
  } | null = null
  private nextRequestId = 1
  private modelPath = ''
  private gpuTimer: ReturnType<typeof setTimeout> | null = null
  private gpuLost = false

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

  /** Receives one sentence for the user when the separator leaves the GPU. */
  onNotice: ((message: string) => void) | null = null

  constructor() {
    this._initWorker()
  }

  private _initWorker(): void {
    const worker = new Worker(
      new URL('../workers/vocal-separator.worker.ts', import.meta.url),
      { type: 'module' },
    )

    // A replaced worker can still have messages in flight: only the current
    // one is listened to.
    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (worker === this.worker) this._handleMessage(e.data)
    }

    worker.onerror = (err) => {
      if (worker !== this.worker) return
      this._status = 'error'
      this._error = `Worker error: ${err.message}`
    }

    this.worker = worker
  }

  private _handleMessage(msg: WorkerOutMessage): void {
    switch (msg.type) {
      case 'ready': {
        this._clearGpuTimer()
        this._status = 'ready'
        this._error = null
        this._provider = msg.provider
        if (this.readyResolve) {
          this.readyResolve()
          this.readyResolve = null
          this.readyReject = null
        }
        break
      }

      case 'gpu-start': {
        if (this._status === 'initializing') {
          this._armGpuTimer(GPU_SETUP_LIMIT_MS)
        }
        break
      }

      case 'gpu-lost': {
        // Already off the GPU: the loss changes nothing.
        if (this._provider === 'wasm') break
        this.gpuLost = true
        if (this._status === 'initializing') {
          this._moveToCpu()
        } else if (this._status === 'processing') {
          this._armGpuTimer(GPU_LOST_GRACE_MS)
        } else if (this._status === 'ready') {
          // Nothing is running, so start over on the next use. Nothing hung
          // either, and that setup may try the GPU again.
          this._replaceWorker()
          this._status = 'idle'
        }
        break
      }

      case 'provider': {
        // The worker moved to the CPU by itself, after a GPU error.
        this._clearGpuTimer()
        this._provider = msg.provider
        if (this.gpuLost) {
          gpuUnavailable = true
          this.onNotice?.(GPU_FALLBACK_NOTICE)
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
          this._clearGpuTimer()
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
          this._clearGpuTimer()
          const isCancel = msg.message === 'Cancelled'
          this._status = isCancel ? 'ready' : 'error'
          this._error = isCancel ? null : msg.message
          this.pendingRequest.reject(new Error(msg.message))
          this.pendingRequest = null
        } else if (msg.requestId === -1) {
          // Init error
          this._clearGpuTimer()
          this._status = 'error'
          this._error = msg.message
          if (this.readyResolve) {
            this.readyResolve() // resolve anyway to unblock, error is stored
            this.readyResolve = null
            this.readyReject = null
          }
        }
        break
      }
    }
  }

  private _armGpuTimer(ms: number): void {
    this._clearGpuTimer()
    this.gpuTimer = setTimeout(() => {
      this.gpuTimer = null
      this._moveToCpu()
    }, ms)
  }

  private _clearGpuTimer(): void {
    if (this.gpuTimer !== null) {
      clearTimeout(this.gpuTimer)
      this.gpuTimer = null
    }
  }

  /** A fresh worker. A hung one may never answer a polite 'destroy'. */
  private _replaceWorker(): void {
    this._clearGpuTimer()
    this.worker?.terminate()
    this.worker = null
    this._provider = null
    this.gpuLost = false
    this._initWorker()
  }

  /** Give up on the graphics card for the rest of the page. */
  private _moveToCpu(): void {
    gpuUnavailable = true
    const wasProcessing = this._status === 'processing'
    this._replaceWorker()

    if (wasProcessing) {
      // The audio went to the hung worker, so the run cannot be resumed.
      this._status = 'idle'
      this.pendingRequest?.reject(new Error(GPU_LOST_RUN_MESSAGE))
      this.pendingRequest = null
      return
    }

    // Still initializing: the caller keeps waiting on the same promise, which
    // the CPU worker's 'ready' resolves.
    this.onNotice?.(GPU_FALLBACK_NOTICE)
    const msg: WorkerInitMessage = {
      type: 'init',
      modelPath: this.modelPath,
      forceWebGpu: false,
    }
    this.worker?.postMessage(msg)
  }

  /** Initialize the ONNX model. Must be called before `separate()`. */
  async initialize(modelPath: string, forceWebGpu?: boolean): Promise<void> {
    if (this._status === 'ready') return
    if (this._status === 'initializing') {
      await this.readyPromise
      return
    }

    this._status = 'initializing'
    this._error = null
    this._provider = null
    this.modelPath = modelPath
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })

    const msg: WorkerInitMessage = {
      type: 'init',
      modelPath,
      forceWebGpu: forceWebGpu === true && !gpuUnavailable,
    }
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
    const abortError = new DOMException(
      'Vocal separator was destroyed',
      'AbortError',
    )

    this._clearGpuTimer()
    this.readyReject?.(abortError)
    this.pendingRequest?.reject(abortError)

    if (this.worker) {
      const worker = this.worker
      // Request graceful teardown so the worker can release the WebGPU ONNX session
      const msg: WorkerDestroyMessage = { type: 'destroy' }
      worker.postMessage(msg)

      // The worker will close itself after releasing resources, but we set a
      // fallback timeout to forcefully terminate if it hangs
      setTimeout(() => worker.terminate(), 1000)

      this.worker = null
    }
    this._status = 'idle'
    this._error = null
    this.pendingRequest = null
    this.readyResolve = null
    this.readyReject = null
    this.readyPromise = null
  }
}
