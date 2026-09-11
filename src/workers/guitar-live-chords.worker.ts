// Optional live chord worker consumes a fixed PCM pool and never queues stale model windows.
import type { GuitarCaptureMessage } from '../lib/guitar/recording-types'
import { createBasicPitchLive, LIVE_CHORD_INTERVAL_MS, } from '../lib/transcription/basic-pitch-live'
import { loadBasicPitchModel } from '../lib/transcription/basic-pitch-model'

let initialised = false
let failed = false
let stream: ReturnType<typeof createBasicPitchLive> | undefined
let running = false
let nextRun = 0

function fail(error: unknown) {
  if (failed) return
  failed = true
  self.postMessage({
    type: 'error',
    message:
      error instanceof Error
        ? error.message
        : 'Live chord preview failed. Refine after Stop is still available.',
  })
}

async function analyse() {
  if (running || failed || performance.now() < nextRun || stream === undefined)
    return
  running = true
  nextRun = performance.now() + LIVE_CHORD_INTERVAL_MS
  try {
    const result = await stream.analyse()
    if (result !== null && !failed) self.postMessage({ type: 'result', result })
  } catch (error) {
    fail(error)
  } finally {
    running = false
  }
}

self.onmessage = async ({
  data,
}: MessageEvent<
  | { type: 'init'; sampleRate: number }
  | Extract<GuitarCaptureMessage, { type: 'pcm' }>
>) => {
  if (failed) return
  try {
    if (data.type === 'init') {
      if (initialised) return
      initialised = true
      // Load before starting the side tap so startup cannot starve its PCM pool.
      const model = await loadBasicPitchModel()
      stream = createBasicPitchLive(data.sampleRate, model.predict)
      self.postMessage({ type: 'ready' })
    } else if (stream !== undefined) {
      stream.append(data.firstFrame, new Float32Array(data.buffer), data.frames)
      self.postMessage(
        { type: 'buffer', buffer: data.buffer },
        { transfer: [data.buffer] },
      )
      void analyse()
    }
  } catch (error) {
    fail(error)
  }
}
