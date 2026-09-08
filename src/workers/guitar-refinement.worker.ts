// Disposable post-stop Basic Pitch worker self-hosts pinned model/WASM and leaves live monitoring alone.
import { transcribeBasicPitch } from '../lib/transcription/basic-pitch-inference'
import { loadBasicPitchModel } from '../lib/transcription/basic-pitch-model'
import type { GuitarRefinementMessage, GuitarRefinementProgress, } from '../lib/transcription/guitar-recording-refinement'
import { decodeGuitarRefinementAudio } from '../lib/transcription/guitar-refinement-audio'

function post(message: GuitarRefinementMessage) {
  self.postMessage(message)
}

function progress(stage: GuitarRefinementProgress['stage'], fraction: number) {
  post({ type: 'progress', progress: { stage, fraction } })
}

// A worker is one job. Ignore duplicate requests instead of running multiple
// full PCM/model allocations concurrently inside the same memory owner.
let started = false
self.onmessage = async ({ data }: MessageEvent<{ blob: Blob }>) => {
  if (started) return
  started = true
  const start = performance.now()
  let model: Awaited<ReturnType<typeof loadBasicPitchModel>> | undefined
  try {
    const audio = await decodeGuitarRefinementAudio(data.blob, (fraction) =>
      progress('decoding', fraction),
    )
    progress('loading', 0)
    model = await loadBasicPitchModel()
    progress('loading', 1)
    const result = await transcribeBasicPitch(audio.samples, model.predict, {
      onProgress: (fraction) => progress('analysing', fraction),
    })
    await model.dispose()
    model = undefined
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
    await model?.dispose()
  }
}
