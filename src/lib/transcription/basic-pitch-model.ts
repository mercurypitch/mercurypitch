// Worker-owned Basic Pitch sessions share one audited model loader and tensor contract.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import * as ort from 'onnxruntime-web/wasm'
import type { BasicPitchPredict } from './basic-pitch-inference'
import { BASIC_PITCH } from './basic-pitch-inference'

export async function loadBasicPitchModel() {
  const response = await fetch(
    `${import.meta.env.BASE_URL}models/basic-pitch/nmp.onnx`,
  )
  if (!response.ok)
    throw new Error(`Chord model could not load (${response.status}).`)
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('Chord model response is empty.')
  // Never allocate an unbounded response before checking the audited artifact.
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
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  if (length !== bytes.length || sha256 !== BASIC_PITCH.modelSha256)
    throw new Error('Chord model checksum differs from the audited artifact.')
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  ort.env.wasm.wasmPaths = {
    wasm: new URL(wasmUrl, globalThis.location.href).href,
  }
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
  })
  const predict: BasicPitchPredict = async (samples) => {
    const input = new ort.Tensor('float32', samples, [
      1,
      BASIC_PITCH.windowSamples,
      1,
    ])
    let output: ort.InferenceSession.ReturnType | undefined
    try {
      output = await session.run({ 'serving_default_input_2:0': input })
      const notes = output['StatefulPartitionedCall:1']
      const onsets = output['StatefulPartitionedCall:2']
      for (const tensor of [notes, onsets]) {
        if (tensor?.type !== 'float32' || tensor.dims.join(',') !== '1,172,88')
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
  }
  return { predict, dispose: () => session.release() }
}
