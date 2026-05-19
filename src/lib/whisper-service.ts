import Worker from '@/workers/whisper-worker?worker'

export interface WhisperSegment {
  text: string
  timestamp: [number, number]
}

export class WhisperService {
  private worker: Worker
  private messageId = 0
  private resolves = new Map<
    number,
    (val: { text: string; chunks: WhisperSegment[] }) => void
  >()
  private rejects = new Map<number, (err: Error) => void>()

  public status: 'idle' | 'loading' | 'ready' | 'processing' | 'error' = 'idle'
  public onStatusChange?: (status: string) => void

  constructor() {
    this.worker = new Worker()

    this.worker.addEventListener('message', (e) => {
      const { type, id, status, text, chunks, message } = e.data

      if (type === 'status') {
        this.status = status
        this.onStatusChange?.(status)
      } else if (type === 'result') {
        if (this.resolves.has(id)) {
          this.resolves.get(id)!({ text, chunks })
          this.resolves.delete(id)
          this.rejects.delete(id)
        }
      } else if (type === 'error') {
        if (this.rejects.has(id)) {
          this.rejects.get(id)!(new Error(message))
          this.resolves.delete(id)
          this.rejects.delete(id)
        }
      }
    })
  }

  async init(): Promise<void> {
    if (this.status !== 'idle') return

    this.worker.postMessage({ type: 'load' })

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.status === 'ready') {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }

  async transcribe(
    audioData: Float32Array,
  ): Promise<{ text: string; chunks: WhisperSegment[] }> {
    const id = this.messageId++

    return new Promise((resolve, reject) => {
      this.resolves.set(id, resolve)
      this.rejects.set(id, reject)

      this.worker.postMessage({
        type: 'transcribe',
        id,
        audioData,
      })
    })
  }

  destroy() {
    this.worker.terminate()
  }
}

/**
 * Helper to resample an AudioBuffer to 16kHz Float32Array required by Whisper
 */
export async function resampleTo16kHz(
  audioBuffer: AudioBuffer,
): Promise<Float32Array> {
  const offlineCtx = new OfflineAudioContext(
    1,
    audioBuffer.duration * 16000,
    16000,
  )
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  return rendered.getChannelData(0)
}
