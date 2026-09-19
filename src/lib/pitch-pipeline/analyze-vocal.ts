// ── Offline vocal analysis ───────────────────────────────────────────
// Samples in, a melody out. The whole of it: detection, the 'auto' race
// between YIN and MPM, and the shared denoise pass that turns a per-frame
// contour into notes.
//
// This used to live inside the stem mixer's Solid controller, wired to a
// dozen signals and three setters, which meant exactly one surface in the
// app could produce a vocal line. Karaoke Night's zen stage already had
// to reach back into the mixer to get one, and a jam room -- the third
// place that wants the same melody -- had no route at all and simply drew
// nothing.
//
// So it is a function, and it takes its settings rather than reading
// them. No Solid, no DOM, no database: the caller decides what to do with
// the result, and the mixer's controller is now one such caller.
//
// Still on the main thread, still yielding cooperatively. Moving it to a
// worker is a separate change with its own transfer-cost question; doing
// both at once would make the behaviour-neutral half unreviewable.

import type { MergedNote } from '@/lib/midi-generator'
import { mergeConsecutiveNotes, MIDI_NOTE_RANGE, WINDOW_STEP_SEC, } from '@/lib/midi-generator'
import { melodyItemsToMergedNotes } from '@/lib/note-display-utils'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import type { OfflineSegmentSecondsFrame } from '@/lib/pitch-pipeline/offline-segment'
import { segmentSecondsContourToMelody } from '@/lib/pitch-pipeline/offline-segment'
import { freqToMidi } from '@/lib/scale-data'

/**
 * Offline analysis algorithm choice: a concrete detector, or 'auto' which
 * runs YIN and MPM over the same frames and keeps whichever produces more
 * cleaned-note coverage. Belted/layered passages that YIN rejects outright
 * are usually tracked fine by MPM, and vice versa for breathy solo takes.
 */
export type AnalysisAlgorithm = PitchAlgorithm | 'auto'

/**
 * The pipeline's frame-count thresholds are tuned for the live ~10ms
 * cadence; offline analysis detects at a coarse 100ms hop
 * (WINDOW_STEP_SEC), so the frame counts shrink proportionally or notes
 * will not register / break correctly.
 */
export const COARSE_HOP_PIPELINE = {
  note: {
    debounceFrames: 1,
    offsetFrames: 2,
    minHoldSec: 0.1,
    minNoteDurationSec: 0.12,
  },
  octave: { confirmFrames: 2 },
} as const

/** How the contour is cleaned into notes. The mixer's cleanup slider. */
export interface VocalDenoiseOptions {
  bpm: number
  key: string
  scaleType: string
  /** 0 = as detected, 1 = strongly cleaned (key-snapped + quantized). */
  cleanupAmount: number
}

/** How the samples are turned into per-frame pitches. */
export interface VocalDetectionOptions {
  algorithm: AnalysisAlgorithm
  bufferSize: number
  sensitivity: number
  minConfidence: number
  minAmplitude: number
}

export interface VocalAnalysisOptions
  extends VocalDetectionOptions, VocalDenoiseOptions {}

/**
 * The one place these numbers live.
 *
 * They were the initial values of five `createSignal` calls in the mixer's
 * controller, which made "what does the app analyse with by default" a
 * question you could only answer by reading a Solid hook. Every caller now
 * starts here -- including that controller, whose signals are seeded from
 * it -- so a jam room and the mixer cannot drift apart by accident.
 */
export const VOCAL_ANALYSIS_DEFAULTS: VocalAnalysisOptions = {
  algorithm: 'auto',
  bufferSize: 1024,
  sensitivity: 7,
  minConfidence: 0.3,
  minAmplitude: 0.02,
  bpm: 120,
  key: 'C',
  scaleType: 'major',
  cleanupAmount: 0.3,
}

/** One frame's accepted detection, before anything is merged. */
export interface RawDetection {
  midi: number
  noteName: string
  timeSec: number
}

export interface VocalAnalysis {
  /** Which detector's run was kept. Equal to the request unless 'auto'. */
  algo: PitchAlgorithm
  rawDetections: RawDetection[]
  /**
   * Full per-frame contour INCLUDING unvoiced frames (freq: null) -- the
   * pipeline needs the silences to break held notes, and the caller needs
   * the contour to re-clean at a different amount without re-detecting.
   */
  contour: OfflineSegmentSecondsFrame[]
  /** Raw merge of the accepted detections. No denoise. */
  mergedNotes: MergedNote[]
  /** The denoised melody: what a singer is actually shown. */
  segmentedNotes: MergedNote[]
}

export interface VocalAnalysisRun {
  /** 0-100, monotonic, and 100 exactly once at the end. */
  onProgress?: (pct: number) => void
  /** Checked at every yield. Aborting rejects with an AbortError. */
  signal?: AbortSignal
}

/** True for the rejection an aborted run produces, and nothing else. */
export function isAnalysisAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function abortError(): Error {
  const error = new Error('Pitch analysis was cancelled')
  error.name = 'AbortError'
  return error
}

/**
 * Clean a per-frame contour into notes.
 *
 * Cheap, and deliberately separate from detection: the mixer's cleanup
 * slider re-runs only this, over a contour it already holds.
 */
export function segmentVocalContour(
  contour: OfflineSegmentSecondsFrame[],
  options: VocalDenoiseOptions,
): MergedNote[] {
  const items = segmentSecondsContourToMelody(contour, {
    bpm: options.bpm,
    key: options.key,
    scaleType: options.scaleType,
    cleanupAmount: options.cleanupAmount,
    pipeline: COARSE_HOP_PIPELINE,
  })
  return melodyItemsToMergedNotes(items, options.bpm)
}

/**
 * One point on the drawn pitch trace.
 *
 * Structurally the stem mixer's `PitchNote`, declared here so the shared
 * pipeline does not have to reach up into a feature for a four-field
 * record. The two are assignable in both directions.
 */
export interface VocalPitchPoint {
  time: number
  noteName: string
  frequency: number
  octave: number
}

/**
 * The canvas trace for a list of cleaned notes.
 *
 * Part of the stored analysis record rather than a view concern: whoever
 * produced the melody writes the trace with it, so a session analysed by
 * a jam room opens in the mixer looking exactly like one analysed there.
 */
export function pitchHistoryFromNotes(
  notes: readonly MergedNote[],
): VocalPitchPoint[] {
  const history: VocalPitchPoint[] = []
  for (const note of notes) {
    const points = Math.max(
      1,
      Math.floor((note.endSec - note.startSec) / WINDOW_STEP_SEC),
    )
    const frequency = 440 * Math.pow(2, (note.midi - 69) / 12)
    for (let j = 0; j < points; j++) {
      history.push({
        time: note.startSec + j * WINDOW_STEP_SEC,
        noteName: note.noteName,
        frequency,
        octave: parseInt(note.noteName.slice(-1)) || 4,
      })
    }
  }
  return history
}

/** Frames between cooperative yields. Fewer and the detection crawls. */
const YIELD_EVERY = 50

/**
 * Analyse a mono vocal take.
 *
 * Throws 'Buffer too short' when there is not even one detector frame in
 * the samples -- a caller handing over a quarter second of audio has a
 * bug, and returning an empty melody would hide it.
 */
export async function analyzeVocalSamples(
  samples: Float32Array,
  sampleRate: number,
  options: Partial<VocalAnalysisOptions> = {},
  run: VocalAnalysisRun = {},
): Promise<VocalAnalysis> {
  const opts: VocalAnalysisOptions = { ...VOCAL_ANALYSIS_DEFAULTS, ...options }
  const { onProgress, signal } = run
  // A method rather than an inline check: TypeScript narrows `signal.aborted`
  // at the first read and keeps the narrowing across the awaits, so an inline
  // second check reads as dead code to the compiler -- while being the whole
  // point of the signal.
  const throwIfAborted = (): void => {
    if (signal !== undefined && signal.aborted) throw abortError()
  }
  throwIfAborted()

  // 'auto' runs YIN and MPM over the same frames and keeps whichever
  // yields more cleaned-note coverage; a concrete choice runs alone.
  const algos: PitchAlgorithm[] =
    opts.algorithm === 'auto' ? ['yin', 'mpm'] : [opts.algorithm]
  const detectors = algos.map(
    (algo) =>
      new PitchDetector({
        sampleRate,
        bufferSize: opts.bufferSize,
        algorithm: algo,
        sensitivity: opts.sensitivity,
        minConfidence: opts.minConfidence,
        minAmplitude: opts.minAmplitude,
      }),
  )

  const stepSamples = Math.floor(WINDOW_STEP_SEC * sampleRate)
  const totalFrames =
    Math.floor((samples.length - opts.bufferSize) / stepSamples) + 1
  if (totalFrames <= 0) throw new Error('Buffer too short')

  interface DetectionRun {
    rawDetections: RawDetection[]
    contour: OfflineSegmentSecondsFrame[]
  }
  const runs: DetectionRun[] = algos.map(() => ({
    rawDetections: [],
    contour: [],
  }))

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * stepSamples
    const chunk = samples.slice(offset, offset + opts.bufferSize)
    const timeSec = offset / sampleRate + opts.bufferSize / sampleRate / 2

    for (let a = 0; a < detectors.length; a++) {
      const pitch = detectors[a]!.detect(chunk)
      const midi = pitch.frequency > 0 ? freqToMidi(pitch.frequency) : -1
      const inRange = midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max

      runs[a]!.contour.push({
        timeSec,
        freq: inRange ? pitch.frequency : null,
        clarity: inRange ? pitch.clarity : 0,
      })
      if (inRange) {
        runs[a]!.rawDetections.push({
          midi,
          noteName: pitch.noteName,
          timeSec,
        })
      }
    }

    if (i % YIELD_EVERY === 0 && i > 0) {
      onProgress?.(Math.round((i / totalFrames) * 100))
      await new Promise((resolve) => setTimeout(resolve, 0))
      throwIfAborted()
    }
  }

  onProgress?.(100)

  // Pick the run whose cleaned notes cover the most sung time.
  const candidates = runs.map((detected, a) => {
    const segmented = segmentVocalContour(detected.contour, opts)
    const coverage = segmented.reduce(
      (sum, n) => sum + (n.endSec - n.startSec),
      0,
    )
    return { algo: algos[a]!, detected, segmented, coverage }
  })
  let best = candidates[0]!
  for (const candidate of candidates) {
    if (candidate.coverage > best.coverage) best = candidate
  }
  if (candidates.length > 1) {
    console.log(
      `[PitchAnalysis] auto pick: ${candidates
        .map((c) => `${c.algo} ${c.coverage.toFixed(1)}s`)
        .join(' vs ')} -> ${best.algo}`,
    )
  }

  return {
    algo: best.algo,
    rawDetections: best.detected.rawDetections,
    contour: best.detected.contour,
    // Raw (un-cleaned) merged notes, for reference and for the record a
    // caller persists.
    mergedNotes: mergeConsecutiveNotes(
      best.detected.rawDetections,
      WINDOW_STEP_SEC + 0.05,
      0.05,
    ),
    segmentedNotes: best.segmented,
  }
}
