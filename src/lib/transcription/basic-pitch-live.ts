// Latest-only rolling inference bounds live PCM/history and keeps model work off the audio thread.
import { createBasicPitchDecoder } from './basic-pitch-decoder'
import type { BasicPitchPredict } from './basic-pitch-inference'
import { BASIC_PITCH } from './basic-pitch-inference'
import { basicPitchResamplingKernel, RESAMPLING_PHASES, } from './basic-pitch-resampling'

export const LIVE_CHORD_INTERVAL_MS = 330
export const LIVE_CHORD_HISTORY_SECONDS = 6

export function createBasicPitchLive(
  sampleRate: number,
  predict: BasicPitchPredict,
) {
  const kernel = basicPitchResamplingKernel(sampleRate)
  const ratio = sampleRate / BASIC_PITCH.sampleRate
  const ring = new Float32Array(Math.ceil(sampleRate * 2.1) + kernel.width)
  const input = new Float32Array(BASIC_PITCH.windowSamples)
  const decoder = createBasicPitchDecoder()
  let total = 0
  let busy = false
  let previousStart = -Infinity
  let lastFrame = -1
  let slowRuns = 0

  function sampleAt(frame: number) {
    if (frame < 0) return 0
    if (frame < total - ring.length || frame >= total)
      throw new Error(
        'Live chords fell behind. Use Refine after Stop for this take.',
      )
    return ring[frame % ring.length]
  }

  return {
    /** Caller recycles the transferred block immediately; no PCM is queued for inference. */
    append(firstFrame: number, samples: Float32Array, frames = samples.length) {
      if (
        firstFrame !== total ||
        !Number.isInteger(frames) ||
        frames < 1 ||
        frames > samples.length ||
        frames > 16384
      )
        throw new Error(
          'Live chord audio was interrupted. Toggle Live chords off and on to retry.',
        )
      for (let index = 0; index < frames; index++) {
        const value = samples[index]
        if (!Number.isFinite(value))
          throw new Error('Live chord audio contains invalid samples.')
        ring[(total + index) % ring.length] = value
      }
      total += frames
    },
    async analyse() {
      if (busy || total < sampleRate * 0.55) return null
      // Quantize the sliding origin to model frames, not the arrival time of PCM
      // messages. Overlapping windows can then contribute each frame exactly once.
      const end = Math.floor((total - kernel.radius - 1) / ratio)
      const start =
        Math.floor((end - input.length) / BASIC_PITCH.frameHop) *
        BASIC_PITCH.frameHop
      if (
        (start - previousStart) / BASIC_PITCH.sampleRate <
        LIVE_CHORD_INTERVAL_MS / 1000
      )
        return null
      const firstKept =
        start + (BASIC_PITCH.overlapFrames / 2) * BASIC_PITCH.frameHop
      if (lastFrame >= 0 && firstKept > lastFrame + BASIC_PITCH.frameHop)
        throw new Error(
          'Live chords fell behind. Use Refine after Stop for this take.',
        )
      busy = true
      previousStart = start
      const started = performance.now()
      try {
        for (let index = 0; index < input.length; index++) {
          const position = (start + index) * ratio
          const frame = Math.floor(position)
          if (sampleRate === BASIC_PITCH.sampleRate) {
            input[index] = sampleAt(frame)
            continue
          }
          const phase = Math.min(
            RESAMPLING_PHASES - 1,
            Math.floor((position - frame) * RESAMPLING_PHASES),
          )
          let sum = 0
          for (let tap = 0; tap < kernel.width; tap++)
            sum +=
              sampleAt(frame - kernel.radius + tap) *
              kernel.phases[phase * kernel.width + tap]
          input[index] = sum
        }
        const output = await predict(input)
        const count = BASIC_PITCH.outputFrames * BASIC_PITCH.pitches
        if (
          [output.notes, output.onsets].some(
            (values) =>
              values.length !== count ||
              values.some(
                (value) => !Number.isFinite(value) || value < 0 || value > 1,
              ),
          )
        )
          throw new Error('Unexpected live chord model output.')
        for (
          let frame = BASIC_PITCH.overlapFrames / 2;
          frame < BASIC_PITCH.outputFrames - BASIC_PITCH.overlapFrames / 2;
          frame++
        ) {
          const sourceFrame = start + frame * BASIC_PITCH.frameHop
          if (sourceFrame < 0 || sourceFrame <= lastFrame) continue
          const offset = frame * BASIC_PITCH.pitches
          decoder.push(
            sourceFrame / BASIC_PITCH.sampleRate,
            output.notes.subarray(offset, offset + 88),
            output.onsets.subarray(offset, offset + 88),
          )
          lastFrame = sourceFrame
        }
        const processingMs = performance.now() - started
        slowRuns = processingMs > 500 ? slowRuns + 1 : 0
        if (slowRuns >= 3)
          throw new Error(
            'Live chords are too slow on this device. Refine after Stop is still available.',
          )
        const analysedSeconds = lastFrame / BASIC_PITCH.sampleRate
        return {
          notes: decoder.recent(analysedSeconds - LIVE_CHORD_HISTORY_SECONDS),
          analysedSeconds,
          processingMs,
        }
      } finally {
        busy = false
      }
    },
  }
}

export type LiveChordResult = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createBasicPitchLive>['analyse']>>
>
