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
  public progress = 0
  public onStatusChange?: (status: string) => void
  public onProgressChange?: (progress: number) => void

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
      } else if (type === 'progress') {
        const { progressInfo } = e.data
        if (progressInfo != null && typeof progressInfo.progress === 'number') {
          this.progress = progressInfo.progress
          this.onProgressChange?.(this.progress)
        }
      }
    })
  }

  async init(): Promise<void> {
    if (this.status === 'ready' || this.status === 'processing') return
    if (this.status === 'idle') {
      this.status = 'loading'
      this.worker.postMessage({ type: 'load' })
    }

    return new Promise((resolve, reject) => {
      const startedAt = Date.now()

      const onMessage = (e: MessageEvent) => {
        const { type, status } = e.data
        if (type === 'status') {
          if (status === 'ready' || status === 'processing') {
            cleanup()
            resolve()
          } else if (status === 'error') {
            cleanup()
            reject(new Error('Whisper model failed to load'))
          }
        }
      }

      const checkTimeout = setInterval(() => {
        if (Date.now() - startedAt > 300_000) {
          cleanup()
          reject(new Error('Whisper model load timed out (300s)'))
        }
      }, 1000)

      const cleanup = () => {
        clearInterval(checkTimeout)
        this.worker.removeEventListener('message', onMessage)
      }

      this.worker.addEventListener('message', onMessage)
    })
  }

  async transcribe(
    audioData: Float32Array,
    language: string = 'en',
  ): Promise<{ text: string; chunks: WhisperSegment[] }> {
    const id = this.messageId++

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.resolves.delete(id)
        this.rejects.delete(id)
        reject(new Error('Whisper transcription timed out (300s)'))
      }, 300_000)

      this.resolves.set(id, (val) => {
        clearTimeout(timeout)
        resolve(val)
      })
      this.rejects.set(id, (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.worker.postMessage({
        type: 'transcribe',
        id,
        audioData,
        language,
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
