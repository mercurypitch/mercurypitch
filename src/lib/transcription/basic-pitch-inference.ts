// Post-stop polyphonic inference is sample-anchored, bounded and independent of the live audio graph.
import type { BasicPitchDecoderOptions } from './basic-pitch-decoder'
import { createBasicPitchDecoder } from './basic-pitch-decoder'

/** Contract of Spotify's unmodified ICASSP 2022 ONNX model; see the chord plan for provenance. */
export const BASIC_PITCH = {
  sampleRate: 22050,
  windowSamples: 43844,
  hopSamples: 36164,
  outputFrames: 172,
  overlapFrames: 30,
  frameHop: 256,
  pitches: 88,
  maxSamples: 300 * 22050,
  modelBytes: 230444,
  modelSha256:
    '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec',
  modelUrl:
    'https://raw.githubusercontent.com/spotify/basic-pitch/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/saved_models/icassp_2022/nmp.onnx',
  decoderVersion: 'mp-basic-pitch-hysteresis/1',
} as const

export interface BasicPitchPrediction {
  notes: Float32Array
  onsets: Float32Array
}

export type BasicPitchPredict = (
  samples: Float32Array,
) => Promise<BasicPitchPrediction>

/** Input is mono PCM already resampled to 22,050 Hz, never an encoded file or live source. */
export async function transcribeBasicPitch(
  samples: Float32Array,
  predict: BasicPitchPredict,
  options: {
    signal?: AbortSignal
    onProgress?: (fraction: number) => void
    decoder?: Partial<BasicPitchDecoderOptions>
  } = {},
) {
  options.signal?.throwIfAborted()
  if (samples.length > BASIC_PITCH.maxSamples)
    throw new Error('Chord analysis is limited to five minutes.')
  if (samples.some((value) => !Number.isFinite(value)))
    throw new Error('Audio samples must be finite.')
  const decoder = createBasicPitchDecoder(options.decoder)
  const duration = samples.length / BASIC_PITCH.sampleRate
  const pad = (BASIC_PITCH.overlapFrames / 2) * BASIC_PITCH.frameHop
  // The first retained frame of window i is at i * hopSamples. Including the
  // leading padding here can schedule a whole extra window past the clip's end.
  const windows = Math.ceil(samples.length / BASIC_PITCH.hopSamples)
  const input = new Float32Array(BASIC_PITCH.windowSamples)
  const started = performance.now()
  let frames = 0
  options.onProgress?.(0)
  for (let index = 0; index < windows; index++) {
    options.signal?.throwIfAborted()
    const start = index * BASIC_PITCH.hopSamples - pad
    input.fill(0)
    input.set(
      samples.subarray(
        Math.max(0, start),
        Math.min(samples.length, start + input.length),
      ),
      Math.max(0, -start),
    )
    const output = await predict(input)
    // Cooperative cancellation drops late results. A UI worker owner must also
    // terminate its worker to interrupt an in-flight model call immediately.
    options.signal?.throwIfAborted()
    const count = BASIC_PITCH.outputFrames * BASIC_PITCH.pitches
    if (output.notes.length !== count || output.onsets.length !== count)
      throw new Error('Unexpected chord model output shape.')
    if (
      [output.notes, output.onsets].some((values) =>
        values.some(
          (value) => !Number.isFinite(value) || value < 0 || value > 1,
        ),
      )
    )
      throw new Error('Chord model output must contain finite probabilities.')
    for (
      let frame = BASIC_PITCH.overlapFrames / 2;
      frame < BASIC_PITCH.outputFrames - BASIC_PITCH.overlapFrames / 2;
      frame++
    ) {
      // Anchor to the actual source window instead of accumulating a nominal
      // frame clock. 142 retained frames do not equal the 36,164-sample hop.
      const time =
        (start + frame * BASIC_PITCH.frameHop) / BASIC_PITCH.sampleRate
      if (time >= duration) break
      const offset = frame * BASIC_PITCH.pitches
      decoder.push(
        time,
        output.notes.subarray(offset, offset + 88),
        output.onsets.subarray(offset, offset + 88),
      )
      frames++
    }
    if (index < windows - 1) options.onProgress?.((index + 1) / windows)
  }
  const notes = decoder.finish(duration)
  options.signal?.throwIfAborted()
  options.onProgress?.(1)
  return {
    notes,
    windows,
    frames,
    duration,
    processingMs: performance.now() - started,
    decoderVersion: BASIC_PITCH.decoderVersion,
    modelSha256: BASIC_PITCH.modelSha256,
  }
}
