// Disposable post-stop Basic Pitch worker self-hosts pinned model/WASM and leaves live monitoring alone.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import * as ort from 'onnxruntime-web/wasm'
import { BASIC_PITCH, transcribeBasicPitch, } from '../lib/transcription/basic-pitch-inference'
import type { GuitarRefinementMessage, GuitarRefinementProgress, } from '../lib/transcription/guitar-recording-refinement'
import { decodeGuitarRefinementAudio } from '../lib/transcription/guitar-refinement-audio'

function post(message: GuitarRefinementMessage) {
  self.postMessage(message)
}

function progress(stage: GuitarRefinementProgress['stage'], fraction: number) {
  post({ type: 'progress', progress: { stage, fraction } })
}

async function loadModel(): Promise<ort.InferenceSession> {
  progress('loading', 0)
  const response = await fetch(
    `${import.meta.env.BASE_URL}models/basic-pitch/nmp.onnx`,
  )
  if (!response.ok)
    throw new Error(`Chord model could not load (${response.status}).`)
  // Stream into an exact-size buffer: a bad/misconfigured endpoint cannot make
  // arrayBuffer() allocate an unbounded response before the checksum check.
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('Chord model response is empty.')
  const bytes = new Uint8Array(BASIC_PITCH.modelBytes)
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (length + value.length > bytes.length)
        throw new Error('Chord model size differs from the audited artifact.')
      bytes.set(value, length)
      length += value.length
    }
  } finally {
    await reader.cancel()
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  if (length !== bytes.length || sha256 !== BASIC_PITCH.modelSha256)
    throw new Error('Chord model checksum differs from the audited artifact.')
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href }
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
  })
  progress('loading', 1)
  return session
}

// A worker is one job. Ignore duplicate requests instead of running multiple
// full PCM/model allocations concurrently inside the same memory owner.
let started = false
self.onmessage = async ({ data }: MessageEvent<{ blob: Blob }>) => {
  if (started) return
  started = true
  const start = performance.now()
  let session: ort.InferenceSession | undefined
  try {
    const audio = await decodeGuitarRefinementAudio(data.blob, (fraction) =>
      progress('decoding', fraction),
    )
    session = await loadModel()
    const model = session
    const result = await transcribeBasicPitch(
      audio.samples,
      async (samples) => {
        const input = new ort.Tensor('float32', samples, [
          1,
          BASIC_PITCH.windowSamples,
          1,
        ])
        let output: ort.InferenceSession.ReturnType | undefined
        try {
          output = await model.run({ 'serving_default_input_2:0': input })
          const notes = output['StatefulPartitionedCall:1']
          const onsets = output['StatefulPartitionedCall:2']
          for (const tensor of [notes, onsets]) {
            if (
              tensor?.type !== 'float32' ||
              tensor.dims.join(',') !== '1,172,88'
            )
              throw new Error('Unexpected chord model tensor contract.')
          }
          return {
            notes: (notes.data as Float32Array).slice(),
            onsets: (onsets.data as Float32Array).slice(),
          }
        } finally {
          input.dispose()
          for (const tensor of Object.values(output ?? {})) tensor.dispose()
        }
      },
      { onProgress: (fraction) => progress('analysing', fraction) },
    )
    await session.release()
    session = undefined
    post({
      type: 'result',
      result: {
        ...result,
        duration: audio.duration,
        processingMs: performance.now() - start,
      },
    })
  } catch (error) {
    post({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Chord refinement failed.',
    })
  } finally {
    await session?.release()
  }
}
