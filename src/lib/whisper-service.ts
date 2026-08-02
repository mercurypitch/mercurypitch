import Worker from '@/workers/whisper-worker?worker'

/**
 * One recognized span of audio.
 *
 * In practice that is ONE WORD, not a sentence: the worker asks the pipeline
 * for `return_timestamps: 'word'` because the pitch canvas aligns per word.
 * Anything that wants sentences has to group them itself — treating a segment
 * as a lyric line is what once turned the "From vocal" draft into one word per
 * line. `whisper-lyrics.groupWhisperWordsIntoLines` does the grouping.
 */
export interface WhisperSegment {
  text: string
  timestamp: [number, number]
}

/**
 * Rejection reason for work that was still in flight when the service was
 * destroyed, and for anything asked of it afterwards. Callers use it to tell a
 * torn-down run apart from a model failure — a destroyed service is not a
 * transcription result, and must not be reported as one.
 */
export const WHISPER_SERVICE_DESTROYED_MESSAGE = 'Whisper service destroyed'

export class WhisperService {
  private worker: Worker
  private messageId = 0
  private destroyed = false
  private resolves = new Map<
    number,
    (val: { text: string; chunks: WhisperSegment[] }) => void
  >()
  private rejects = new Map<number, (err: Error) => void>()
  /** Cancels an `init()` still waiting on the worker (see `destroy`). */
  private initAborts = new Set<(err: Error) => void>()

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
    if (this.destroyed) {
      throw new Error(WHISPER_SERVICE_DESTROYED_MESSAGE)
    }
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
        this.initAborts.delete(abort)
        this.worker.removeEventListener('message', onMessage)
      }

      // Without this, destroying the service mid-load left the 1 Hz watchdog
      // ticking for the full 300s before anyone learned the load was over.
      const abort = (err: Error) => {
        cleanup()
        reject(err)
      }
      this.initAborts.add(abort)

      this.worker.addEventListener('message', onMessage)
    })
  }

  async transcribe(
    audioData: Float32Array,
    language: string = 'en',
  ): Promise<{ text: string; chunks: WhisperSegment[] }> {
    if (this.destroyed) {
      throw new Error(WHISPER_SERVICE_DESTROYED_MESSAGE)
    }
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

  /**
   * Terminating the worker does not settle the promises waiting on it, so a
   * teardown mid-chunk used to leave the caller awaiting a reply that could
   * never come — the whole song's PCM stayed alive until the 300s timeout
   * finally rejected it. Reject them here instead: callers already treat a
   * failed chunk as a failed chunk, and the abort lands immediately.
   */
  destroy() {
    this.destroyed = true
    const pending = [...this.rejects.values(), ...this.initAborts]
    this.resolves.clear()
    this.rejects.clear()
    this.initAborts.clear()
    this.worker.terminate()
    for (const reject of pending) {
      reject(new Error(WHISPER_SERVICE_DESTROYED_MESSAGE))
    }
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
