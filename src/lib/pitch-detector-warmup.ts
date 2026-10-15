// ============================================================
// The pitch detector, warmed before a take's first voiced frame
// ============================================================
//
// The detector's YIN pass (PitchDetector.analyzeYIN) runs only on a buffer
// loud enough to pass its gate, so a room's first voiced frame is the first
// time the JavaScript engine meets that code at all. It starts in the
// interpreter, compiles the pass's 1024 x 1024 difference loop part way
// through the call, then drops back out of the compiled code each time a
// later step meets values it has no type information for yet. Chromium's
// own trace (--trace-opt --trace-osr --trace-deopt, 2026-10-15) shows that
// chain on the first voiced frames: 45-54 ms of script in that frame at 4x
// CPU, then frames of about 20 ms, in Lip roll and Ng slides.
//
// So a room warms the pass as its capture opens (useExerciseCapture.ts), in
// the count-in, before anyone sings: throwaway detectors, with the
// stream's settings, run it over a few synthetic buffers, a few passes a
// task, in two stages. First 96-sample buffers at 9600 Hz (a 48-lag pass,
// about 1/450 of a real one): small enough that every step of the pass
// runs many times before the engine compiles any of it, so the compiled
// code has seen every step. A first pass big enough to be compiled part
// way through (256 samples was) leaves steps that the real frames then
// drop out of. Then 256-sample buffers at 24 kHz, enough work for the
// engine to finish compiling the pass in its optimizing tier.
//
// The engine keeps compiled code and type information per function, not
// per detector, so the stream's own detector then starts in compiled code.
// They are separate detectors: the stream's detector's history, settings
// and output are untouched. (The detector's history starts as a list of
// doubles for the same reason: pitch-engine's pitch-detector.ts.)

import { F0_DETECTOR_OPTIONS } from '@/lib/f0-detector-options'
import { PitchDetector } from '@/lib/pitch-detector'

/** Passes a task. */
export const WARM_PASSES_PER_TASK = 4

/** One stage: its buffers' size and rate, and how many passes it runs. */
interface WarmStage {
  readonly size: number
  readonly rate: number
  readonly passes: number
}

/**
 * The stages, in order. At 9600 Hz the shortest period the range allows
 * is 6 samples, so a pitch above the range still has a shorter period in
 * view (below); at 24 kHz, 15.
 */
const STAGES: readonly WarmStage[] = [
  { size: 96, rate: 9600, passes: 48 },
  { size: 256, rate: 24000, passes: 48 },
]

/** Passes in all. */
export const WARM_PASSES = STAGES.reduce((sum, stage) => sum + stage.passes, 0)

/** A voiced buffer: a period of `period` samples, with its octave above. */
function voiced(size: number, period: number): Float32Array {
  const buffer = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const phase = (2 * Math.PI * i) / period
    buffer[i] = 0.3 * Math.sin(phase) + 0.1 * Math.sin(2 * phase)
  }
  return buffer
}

/** Loud, unpitched: the pass finds no period and the frame is rejected. */
function noise(size: number): Float32Array {
  const buffer = new Float32Array(size)
  let seed = 0x2f6b
  for (let i = 0; i < size; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    buffer[i] = (seed / 0x7fffffff - 0.5) * 0.6
  }
  return buffer
}

/**
 * The order a stage runs them in, each a path a real voice's frames take:
 * a held pitch (the history's median filter, then its window full); a jump
 * of a fifth or so (an outlier, then a confirmed change) to a pitch a hair
 * flat of a note (its cents round to -0); a pitch above the range (the
 * pass's out-of-range answer); noise and silence (the two rejections). In
 * the first stage the held pitch's period comes out at an odd lag, the
 * jump's at an even one: the pass halves the lag, and a step that has only
 * ever seen whole halves is compiled for whole numbers. The second stage
 * plays the same periods, scaled to its size.
 */
function warmBuffers(stage: WarmStage): Float32Array[] {
  const scale = stage.size / 96
  const held = voiced(stage.size, 31.3 * scale)
  const jump = voiced(stage.size, 21.825 * scale)
  const above = voiced(stage.size, 3.05 * scale)
  return [
    held,
    held,
    held,
    held,
    held,
    held,
    jump,
    jump,
    jump,
    above,
    noise(stage.size),
    new Float32Array(stage.size),
  ]
}

/**
 * Warm the detector's code in short tasks from now on. Returns a stop for
 * the passes not yet run.
 */
export function warmPitchDetector(): () => void {
  const stages = STAGES.map((stage) => ({
    passes: stage.passes,
    buffers: warmBuffers(stage),
    detector: new PitchDetector({
      ...F0_DETECTOR_OPTIONS,
      sampleRate: stage.rate,
      bufferSize: stage.size,
    }),
  }))
  let stageAt = 0
  let run = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const task = (): void => {
    timer = null
    for (let i = 0; i < WARM_PASSES_PER_TASK; i++) {
      const stage = stages[stageAt]
      if (stage === undefined) return
      stage.detector.detect(
        stage.buffers[run % stage.buffers.length] as Float32Array,
      )
      run += 1
      if (run === stage.passes) {
        stageAt += 1
        run = 0
      }
    }
    if (stageAt < stages.length) timer = setTimeout(task, 0)
  }
  timer = setTimeout(task, 0)
  return () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
}
