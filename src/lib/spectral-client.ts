import type { WindowType } from '@/lib/stft-engine'
import type { SpectralAnalysisResult, SpectralWorkerResponse, } from '@/workers/spectral.worker'

type WorkerCallback = (result: SpectralAnalysisResult) => void

export class SpectralClient {
  private worker: Worker | null = null
  private onResult: WorkerCallback | null = null
  private selectedWindow: WindowType = 'hann'

  constructor(windowType?: WindowType) {
    this.selectedWindow = windowType ?? 'hann'
    this.initWorker()
  }

  private initWorker() {
    this.worker = new Worker(
      new URL('../workers/spectral.worker.ts', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = (e: MessageEvent<SpectralWorkerResponse>) => {
      if (e.data.type === 'RESULT') {
        this.onResult?.(e.data.result)
      } else if (e.data.type === 'ERROR') {
        console.error('SpectralWorker error:', e.data.error)
      }
    }
  }

  public setCallback(callback: WorkerCallback) {
    this.onResult = callback
  }

  public setWindowType(windowType: WindowType) {
    this.selectedWindow = windowType
  }

  public analyzeFrame(
    audio: Float32Array,
    sampleRate: number,
    fundamentalFreq: number,
  ) {
    if (!this.worker) return

    const audioCopy = new Float32Array(audio)

    this.worker.postMessage(
      {
        type: 'ANALYZE',
        audio: audioCopy,
        sampleRate,
        fundamentalFreq,
        windowType: this.selectedWindow,
      },
      { transfer: [audioCopy.buffer] },
    )
  }

  public destroy() {
    this.worker?.terminate()
    this.worker = null
    this.onResult = null
  }
}
