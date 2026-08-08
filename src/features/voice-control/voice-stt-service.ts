// ============================================================
// Voice STT service — promise wrapper over the voice-stt worker
// ============================================================
//
// A deliberately smaller sibling of WhisperService: one short utterance in,
// one string out, no chunk plans or timestamps. The shared instance lives
// for the page's lifetime so toggling voice control off and on does not
// reload the model.

import Worker from '@/workers/voice-stt-worker?worker'

export type VoiceSttStatus = 'idle' | 'loading' | 'ready' | 'error'

const TRANSCRIBE_TIMEOUT_MS = 20_000
const LOAD_TIMEOUT_MS = 300_000

export class VoiceSttService {
  private worker: Worker
  private messageId = 0
  private destroyed = false
  private resolves = new Map<number, (text: string) => void>()
  private rejects = new Map<number, (err: Error) => void>()

  public status: VoiceSttStatus = 'idle'

  constructor() {
    this.worker = new Worker()
    this.worker.addEventListener('message', (e) => {
      const { type, id, status, text, message } = e.data as {
        type: string
        id?: number
        status?: VoiceSttStatus
        text?: string
        message?: string
      }
      if (type === 'status' && status !== undefined) {
        this.status = status
      } else if (type === 'result' && id !== undefined) {
        this.resolves.get(id)?.(text ?? '')
        this.resolves.delete(id)
        this.rejects.delete(id)
      } else if (type === 'error' && id !== undefined) {
        this.rejects.get(id)?.(new Error(message ?? 'Transcription failed'))
        this.resolves.delete(id)
        this.rejects.delete(id)
      }
    })
  }

  async init(): Promise<void> {
    if (this.destroyed) throw new Error('Voice STT service destroyed')
    if (this.status === 'ready') return
    if (this.status === 'idle') {
      this.status = 'loading'
      this.worker.postMessage({ type: 'load' })
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const onMessage = (e: MessageEvent) => {
        const { type, status } = e.data as { type: string; status?: string }
        if (type !== 'status') return
        if (status === 'ready') {
          cleanup()
          resolve()
        } else if (status === 'error') {
          cleanup()
          reject(new Error('Voice model failed to load'))
        }
      }
      const watchdog = setInterval(() => {
        if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
          cleanup()
          reject(new Error('Voice model load timed out'))
        }
      }, 1000)
      const cleanup = () => {
        clearInterval(watchdog)
        this.worker.removeEventListener('message', onMessage)
      }
      this.worker.addEventListener('message', onMessage)
    })
  }

  async transcribe(audioData: Float32Array): Promise<string> {
    if (this.destroyed) throw new Error('Voice STT service destroyed')
    const id = this.messageId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.resolves.delete(id)
        this.rejects.delete(id)
        reject(new Error('Voice transcription timed out'))
      }, TRANSCRIBE_TIMEOUT_MS)
      this.resolves.set(id, (text) => {
        clearTimeout(timeout)
        resolve(text)
      })
      this.rejects.set(id, (err) => {
        clearTimeout(timeout)
        reject(err)
      })
      // Transfer the buffer: a copy would double the utterance's memory for
      // no reason, and the caller never reuses it.
      this.worker.postMessage({ type: 'transcribe', id, audioData }, [
        audioData.buffer,
      ])
    })
  }

  destroy(): void {
    this.destroyed = true
    const pending = [...this.rejects.values()]
    this.resolves.clear()
    this.rejects.clear()
    this.worker.terminate()
    for (const reject of pending) {
      reject(new Error('Voice STT service destroyed'))
    }
  }
}

let shared: VoiceSttService | null = null

/** Page-lifetime instance so re-enabling voice control reuses the loaded
 *  model instead of paying the download and warm-up again. */
export function sharedVoiceSttService(): VoiceSttService {
  shared ??= new VoiceSttService()
  return shared
}
