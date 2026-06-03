import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { env, pipeline } from '@huggingface/transformers'

// Disable local models to fetch from HF hub
env.allowLocalModels = false

let whisperPipeline: AutomaticSpeechRecognitionPipeline | null = null
let loadingPromise: Promise<void> | null = null

// Set to true to run a warm-up inference after model load.
// This pre-compiles WebGPU/WASM shaders so the first real chunk is faster,
// but it spins up CPU/GPU before the user clicks Transcribe.
const ENABLE_WARMUP = false

/**
 * Tracks per-file download progress and computes a smoothed aggregate.
 * The HF progress_callback fires per-file (config.json, tokenizer.json,
 * model.onnx, etc.), each with its own 0-100 range, which causes the
 * progress bar to jump around if we naively forward the raw value.
 */
const fileProgress = new Map<string, number>()
let maxReportedProgress = 0

function computeAggregateProgress(): number {
  if (fileProgress.size === 0) return 0
  let sum = 0
  for (const pct of fileProgress.values()) {
    sum += pct
  }
  const avg = sum / fileProgress.size
  // Never go backwards -- monotonically increasing
  maxReportedProgress = Math.max(maxReportedProgress, avg)
  return maxReportedProgress
}

function handleProgressCallback(progressInfo: Record<string, unknown>): void {
  // progressInfo has: { status, file, progress, loaded, total, ... }
  const file = (progressInfo.file as string) ?? 'unknown'
  const status = progressInfo.status as string

  if (status === 'progress' && typeof progressInfo.progress === 'number') {
    fileProgress.set(file, progressInfo.progress)
  } else if (status === 'done') {
    fileProgress.set(file, 100)
  } else if (status === 'initiate') {
    fileProgress.set(file, 0)
  }

  const aggregate = computeAggregateProgress()
  self.postMessage({
    type: 'progress',
    progressInfo: { ...progressInfo, progress: aggregate },
  })
}

// Load the model
async function loadModel() {
  if (whisperPipeline != null) return
  if (loadingPromise != null) return loadingPromise

  loadingPromise = (async () => {
    try {
      self.postMessage({ type: 'status', status: 'loading' })

      // Reset progress tracking
      fileProgress.clear()
      maxReportedProgress = 0

      // Use Xenova/whisper-tiny which is multilingual
      whisperPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          device: 'webgpu', // Try WebGPU first if supported
          dtype: 'fp16',
          progress_callback: handleProgressCallback,
        },
      )

      // Warm-up: run a tiny silent buffer so WebGPU/WASM JIT-compiles
      // shaders now (during "loading") rather than on the first real chunk.
      if (ENABLE_WARMUP) {
        try {
          await whisperPipeline(new Float32Array(16000), {
            language: 'en',
            task: 'transcribe',
          })
        } catch {
          // Warm-up failure is non-fatal
        }
      }

      self.postMessage({ type: 'status', status: 'ready' })
    } catch (err) {
      console.error(
        'Failed to load whisper pipeline with WebGPU, falling back to WASM',
        err,
      )
      try {
        // Reset progress for second attempt
        fileProgress.clear()
        maxReportedProgress = 0

        // Fallback to WASM
        whisperPipeline = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-tiny',
          {
            device: 'wasm',
            dtype: 'q8',
            progress_callback: handleProgressCallback,
          },
        )

        // Warm-up for WASM path too
        if (ENABLE_WARMUP) {
          try {
            await whisperPipeline(new Float32Array(16000), {
              language: 'en',
              task: 'transcribe',
            })
          } catch {
            // Warm-up failure is non-fatal
          }
        }

        self.postMessage({ type: 'status', status: 'ready' })
      } catch (wasmErr) {
        console.error('Failed to load whisper pipeline with WASM', wasmErr)
        self.postMessage({ type: 'status', status: 'error' })
        loadingPromise = null
      }
    }
  })()

  return loadingPromise
}

/**
 * Run transcription with a timeout guard.
 * Firefox WebGPU inference can hang silently; this ensures we don't
 * wait forever and can report the error back.
 */
async function transcribeWithTimeout(
  pipe: AutomaticSpeechRecognitionPipeline,
  audioData: Float32Array,
  language: string = 'en',
  timeoutMs: number = 200_000,
): Promise<{ text: string; chunks: unknown[] }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Transcription timed out after ${String(timeoutMs / 1000)}s (chunk may be too large or inference is stuck)`,
        ),
      )
    }, timeoutMs)

    const inferencePromise = pipe(audioData, {
      language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    })

    inferencePromise
      .then((result) => {
        clearTimeout(timer)
        resolve({
          text: (result as { text: string }).text,
          chunks: (result as { chunks: unknown[] }).chunks,
        })
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}

self.addEventListener('message', (e) => {
  void (async () => {
    const { type, id, audioData, language } = e.data

    if (type === 'load') {
      await loadModel()
      return
    }

    if (type === 'transcribe') {
      try {
        await loadModel()
        if (whisperPipeline == null) throw new Error('Pipeline not loaded')

        self.postMessage({ type: 'status', status: 'processing' })

        const { text, chunks } = await transcribeWithTimeout(
          whisperPipeline,
          audioData,
          (language as string) ?? 'en',
        )

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
