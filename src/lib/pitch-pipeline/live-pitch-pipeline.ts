// ============================================================
// Live (causal, low-latency) pitch -> notes pipeline.
//
// Stages, per frame:
//   0. confidence/voicing gate
//   1. octave / gross-error correction (temporal continuity snap)
//   2. causal smoothing: running median -> One-Euro
//   3. hysteresis note on/off state machine
//   4. incremental segmentation (committed notes + one open note)
//
// Shared by the Compose recorder and (Phase 2) the live tracking preview. The
// heavier finalize path (Viterbi, key-snap, beat-quantize) is built on the
// same stages in offline-pitch-pipeline.ts.
// ============================================================

import { freqToMidiFloat } from './log-pitch'
import type { NoteStateMachineOptions } from './note-state-machine'
import { createNoteStateMachine } from './note-state-machine'
import type { OctaveCorrectorOptions } from './octave-corrector'
import { createOctaveCorrector } from './octave-corrector'
import type { OneEuroOptions } from './one-euro'
import { createOneEuro } from './one-euro'
import { createRunningMedian } from './running-median'
import type { CompletedNote, LiveFrameResult } from './types'

export interface LivePipelineOptions {
  /** Minimum detector clarity (0-1) for a frame to count as voiced. Default 0.35. */
  minClarity?: number
  /** Running-median window in frames (odd is best). Default 5. */
  medianWindow?: number
  oneEuro?: OneEuroOptions
  octave?: OctaveCorrectorOptions
  note?: NoteStateMachineOptions
}

export interface LivePitchPipeline {
  /**
   * Feed one realtime frame.
   * @param freq    Detected frequency in Hz, or null when no pitch.
   * @param clarity Detector clarity / confidence (0-1).
   * @param timeSec Monotonic wall-clock seconds (e.g. performance.now()/1000).
   * @param beat    Current musical beat, for note coordinates.
   */
  push(
    freq: number | null,
    clarity: number,
    timeSec: number,
    beat: number,
  ): LiveFrameResult
  /** Close any open note at the given beat (on stop). */
  flush(endBeat: number): CompletedNote[]
  reset(): void
}

export function createLivePitchPipeline(
  opts: LivePipelineOptions = {},
): LivePitchPipeline {
  const minClarity = opts.minClarity ?? 0.35
  const medianWindow = opts.medianWindow ?? 5
  const offsetFrames = opts.note?.offsetFrames ?? 8

  const corrector = createOctaveCorrector(opts.octave)
  const med = createRunningMedian(medianWindow)
  const euro = createOneEuro(opts.oneEuro)
  const note = createNoteStateMachine(opts.note)

  let unvoicedRun = 0

  return {
    push(freq, clarity, timeSec, beat): LiveFrameResult {
      const voiced =
        freq !== null &&
        freq > 0 &&
        Number.isFinite(freq) &&
        clarity >= minClarity

      if (!voiced || freq === null) {
        unvoicedRun++
        // On a real rest, clear the smoothers so the next phrase starts fresh
        // and can't inherit the previous note's octave reference.
        if (unvoicedRun === offsetFrames) {
          corrector.reset()
          med.reset()
          euro.reset()
        }
        const upd = note.update(null, timeSec, beat)
        return {
          completed: upd.completed === null ? [] : [upd.completed],
          open: upd.open,
          smoothedMidi: null,
        }
      }

      unvoicedRun = 0
      const raw = freqToMidiFloat(freq)
      const corrected = corrector.correct(raw)
      // Median output is spike-free and step-like — ideal for note-boundary
      // decisions. One-Euro adds a smooth, continuous line for the display
      // needle only; feeding its ramp into the state machine would smear
      // onset/offset timing.
      const med1 = med.push(corrected)
      const smoothed = euro.filter(med1, timeSec)
      const upd = note.update(med1, timeSec, beat)
      return {
        completed: upd.completed === null ? [] : [upd.completed],
        open: upd.open,
        smoothedMidi: smoothed,
      }
    },
    flush(endBeat): CompletedNote[] {
      const completed = note.flush(endBeat)
      return completed === null ? [] : [completed]
    },
    reset(): void {
      corrector.reset()
      med.reset()
      euro.reset()
      note.reset()
      unvoicedRun = 0
    },
  }
}
