// ============================================================
// Voice STT worker — short-utterance transcription for voice control
// ============================================================
//
// Separate from whisper-worker on purpose: that one transcribes whole songs
// in overlapping chunks with WORD timestamps (which pins it to fp32 DTW);
// this one turns a 1-3 s spoken command into text as fast as possible — no
// timestamps needed. It loads the same Xenova/whisper-tiny weights the
// karaoke transcription already caches, so enabling the local voice engine
// usually costs no second download. A warm-up inference runs during load so
// the FIRST spoken command does not pay WebGPU shader compilation.

import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false

const DEFAULT_MODEL_ID = 'Xenova/whisper-tiny'

let asrPipeline: AutomaticSpeechRecognitionPipeline | null = null
let loadingPromise: Promise<void> | null = null
/** Whisper needs language/task generate kwargs; Moonshine and other
 *  English-only models reject them — pick per loaded model. */
let generateKwargs: Record<string, unknown> = {}

async function loadModel(modelId: string): Promise<void> {
  if (asrPipeline != null) return
  if (loadingPromise != null) return loadingPromise
  generateKwargs = modelId.toLowerCase().includes('whisper')
    ? { language: 'en', task: 'transcribe' }
    : {}

  loadingPromise = (async () => {
    self.postMessage({ type: 'status', status: 'loading' })
    try {
      asrPipeline = await pipeline('automatic-speech-recognition', modelId, {
        device: 'webgpu',
        dtype: 'fp32',
      })
    } catch (err) {
      console.error('[voice-stt] WebGPU load failed, falling back to WASM', err)
      try {
        asrPipeline = await pipeline('automatic-speech-recognition', modelId, {
          device: 'wasm',
          dtype: 'q8',
        })
      } catch (wasmErr) {
        console.error('[voice-stt] WASM load failed', wasmErr)
        self.postMessage({ type: 'status', status: 'error' })
        loadingPromise = null
        return
      }
    }

    try {
      // Half a second of silence pre-compiles the whole inference path.
      await asrPipeline(new Float32Array(8000), generateKwargs)
    } catch {
      // Warm-up failure is non-fatal.
    }

    self.postMessage({ type: 'status', status: 'ready' })
  })()

  return loadingPromise
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data as {
    type: string
    id?: number
    modelId?: string
    audioData?: Float32Array
  }

  if (data.type === 'load') {
    void loadModel(data.modelId ?? DEFAULT_MODEL_ID)
    return
  }

  if (data.type === 'transcribe') {
    const id = data.id ?? -1
    const audioData = data.audioData
    void (async () => {
      if (asrPipeline == null || audioData == null) {
        self.postMessage({ type: 'error', id, message: 'Model not loaded' })
        return
      }
      try {
        const result = await asrPipeline(audioData, generateKwargs)
        const single = (Array.isArray(result) ? result[0] : result) as {
          text?: string
        }
        self.postMessage({ type: 'result', id, text: single.text ?? '' })
      } catch (err) {
        self.postMessage({
          type: 'error',
          id,
          message: err instanceof Error ? err.message : 'Transcription failed',
        })
      }
    })()
  }
}
