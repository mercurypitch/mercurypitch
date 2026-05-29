import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { env, pipeline } from '@huggingface/transformers'

// Disable local models to fetch from HF hub
env.allowLocalModels = false

let whisperPipeline: AutomaticSpeechRecognitionPipeline | null = null
let loadingPromise: Promise<void> | null = null

// Load the model
async function loadModel() {
  if (whisperPipeline != null) return
  if (loadingPromise != null) return loadingPromise

  loadingPromise = (async () => {
    try {
      self.postMessage({ type: 'status', status: 'loading' })

      // Use Xenova/whisper-tiny which is multilingual
      whisperPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'webgpu', // Try WebGPU first if supported
          dtype: 'fp32',
        },
      )

      self.postMessage({ type: 'status', status: 'ready' })
    } catch (err) {
      console.error(
        'Failed to load whisper pipeline with WebGPU, falling back to WASM',
        err,
      )
      // Fallback to WASM
      whisperPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'wasm',
          dtype: 'q8',
        },
      )
      self.postMessage({ type: 'status', status: 'ready' })
    }
  })()

  return loadingPromise
}

self.addEventListener('message', (e) => {
  void (async () => {
    const { type, id, audioData } = e.data

    if (type === 'load') {
      await loadModel()
      return
    }

    if (type === 'transcribe') {
      try {
        await loadModel()
        if (whisperPipeline == null) throw new Error('Pipeline not loaded')

        self.postMessage({ type: 'status', status: 'processing' })

        // audioData should be a Float32Array containing 16kHz audio
        const result = await whisperPipeline(audioData, {
          language: 'en', // Can be auto-detected, but let's default to english or let it detect
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: true,
        })

        const text = (result as { text: string }).text
        const chunks = (result as { chunks: unknown[] }).chunks

        self.postMessage({
          type: 'result',
          id,
          text,
          chunks,
        })

        self.postMessage({ type: 'status', status: 'ready' })
      } catch (err: unknown) {
        self.postMessage({
          type: 'error',
          id,
          message: err instanceof Error ? err.message : String(err),
        })
        self.postMessage({ type: 'status', status: 'ready' })
      }
    }
  })()
})
