// ============================================================
// Offline re-segmentation for the take-review "cleanup amount" slider.
//
// Given the raw per-frame pitch contour retained during a recording, produce a
// melody at a chosen cleanup strength (0..1):
//   - 0 (gentle): exactly what the user heard live — the shared live pipeline
//     (octave correction + median + hysteresis), nothing more.
//   - 1 (strong): key-snapped to the song's scale, adjacent same-pitch notes
//     merged, and onsets/durations quantized to the beat grid.
// Everything in between scales the guard band / merge gap / quantize strength,
// so dragging the slider continuously morphs raw -> clean.
// ============================================================

import { quantizeBeat } from '@/lib/quantize'
import { midiToFreq, midiToNote, snapMidiToScale } from '@/lib/scale-data'
import type { MelodyItem, NoteName } from '@/types'
import { createLivePitchPipeline } from './live-pitch-pipeline'
import { freqToMidiFloat } from './log-pitch'
import { median } from './running-median'
import type { CompletedNote } from './types'

/** One retained frame of the recorded pitch contour. */
export interface RawPitchFrame {
  /** Musical position in beats. */
  beat: number
  /** Wall-clock seconds (for the smoothing/hysteresis timebase). */
  timeSec: number
  /** Detected frequency in Hz, or null when unvoiced. */
  freq: number | null
  /** Detector clarity (0-1). */
  clarity: number
}

export interface OfflineSegmentOptions {
  bpm: number
  key: string
  scaleType: string
  /** 0 = gentle (≈ what was heard live), 1 = strongly cleaned. */
  cleanupAmount: number
}

/** 1/8-note grid (a beat is a quarter note). */
const GRID_BEATS = 0.5

interface WorkNote {
  startBeat: number
  endBeat: number
  midi: number
  center: number
}

export function segmentContourToMelody(
  frames: RawPitchFrame[],
  opts: OfflineSegmentOptions,
): MelodyItem[] {
  if (frames.length === 0) return []
  const amount = Math.min(1, Math.max(0, opts.cleanupAmount))

  // 1. Base segmentation via the shared live pipeline so amount=0 reproduces
  //    exactly what the user saw while recording.
  const pipeline = createLivePitchPipeline()
  const base: CompletedNote[] = []
  let lastBeat = frames[0].beat
  for (const f of frames) {
    const res = pipeline.push(f.freq, f.clarity, f.timeSec, f.beat)
    base.push(...res.completed)
    lastBeat = f.beat
  }
  base.push(...pipeline.flush(lastBeat))

  // 2. Refine each note's center to a fractional MIDI (median over its voiced
  //    frames) so key-snap acts on the real sung pitch, not the rounded value.
  const notes: WorkNote[] = base.map((n) => {
    const inSpan: number[] = []
    for (const f of frames) {
      if (
        f.freq !== null &&
        f.freq > 0 &&
        f.beat >= n.startBeat &&
        f.beat <= n.endBeat
      ) {
        inSpan.push(freqToMidiFloat(f.freq))
      }
    }
    const center = inSpan.length > 0 ? median(inSpan) : n.midi
    return { startBeat: n.startBeat, endBeat: n.endBeat, midi: n.midi, center }
  })

  // 3. Key-snap: guard band widens with cleanup amount (0 => no snap, the
  //    rounded center; 1 => ~100 cents, forcing accidentals to the scale).
  const guardBandCents = amount * 100
  for (const n of notes) {
    n.midi =
      guardBandCents > 0
        ? snapMidiToScale(n.center, opts.key, opts.scaleType, guardBandCents)
            .midi
        : Math.round(n.center)
  }

  // 4. Merge adjacent same-pitch notes across a small gap (grows with amount).
  const mergeGap = amount * GRID_BEATS
  const merged: WorkNote[] = []
  for (const n of notes) {
    const prev = merged[merged.length - 1]
    if (
      prev !== undefined &&
      prev.midi === n.midi &&
      n.startBeat - prev.endBeat <= mergeGap
    ) {
      prev.endBeat = n.endBeat
    } else {
      merged.push({ ...n })
    }
  }

  // 5. Beat-quantize onsets (strong) and durations (gentler), scaled by amount.
  const melody: MelodyItem[] = []
  let id = 1
  for (const n of merged) {
    let startBeat = n.startBeat
    let duration = n.endBeat - n.startBeat
    if (amount > 0) {
      startBeat = quantizeBeat(
        n.startBeat,
        GRID_BEATS,
        amount * 0.85,
        GRID_BEATS * 0.25,
      )
      duration = quantizeBeat(
        n.endBeat - n.startBeat,
        GRID_BEATS,
        amount * 0.6,
        GRID_BEATS * 0.25,
      )
    }
    duration = Math.max(GRID_BEATS * 0.5, duration)
    const info = midiToNote(n.midi)
    melody.push({
      id: id++,
      note: {
        midi: n.midi,
        name: info.name as NoteName,
        octave: info.octave,
        freq: midiToFreq(n.midi),
      },
      duration,
      startBeat,
    })
  }
  return melody
}
