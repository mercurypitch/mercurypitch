// ============================================================
// Ear Lab — sung-degree classification (Phase 2's mic answers).
//
// Home's mic mode records a short pitch-frame window after the
// probe and has to answer two different questions from it:
//
//   1. WHICH degree did the ear choose?  (perception)
//   2. How far off was the voice from that degree?  (production)
//
// Separating the two is the ear-vs-voice diagnostic: a clean Fa
// sung 30 cents flat is a right answer with an intonation note,
// not a wrong answer. Classification is octave-folded (singing
// Sol an octave down is still Sol — register is a range issue,
// not a hearing issue) and scored against each diatonic degree
// by circular distance, so a tonic sung slightly flat does not
// wrap around to read as Ti.
// ============================================================

import type { HomeDegree } from './item-bank'
import { HOME_DEGREES } from './item-bank'

/** A pitch frame as the f0 stream reports it. */
export interface SungFrame {
  /** Fundamental in Hz; 0 when unvoiced. */
  f0: number
  /** Detector confidence 0..1. */
  conf: number
}

export interface SungDegree {
  degree: HomeDegree
  /** Signed cents from the degree's exact pitch (octave-folded);
   *  positive is sharp. The production half of the diagnostic. */
  centsOff: number
  /** Voiced, confident frames the reading is built on. */
  voicedFrames: number
}

export const MIN_CONF = 0.5
/** Frames of confident voicing needed before classifying (~200 ms
 *  at the stream's cadence) — a cough must not become an answer. */
export const MIN_VOICED_FRAMES = 6
/** A sung note further than this from EVERY diatonic degree is not
 *  an answer — it is scooping, noise, or a chromatic in-between.
 *  The drill re-prompts instead of guessing. */
export const MAX_CENTS_FROM_DEGREE = 60

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

/** Signed circular distance in semitones from `rel` (0..12) to a
 *  degree's semitone, the short way round the octave. */
function circularSemitones(rel: number, target: number): number {
  let d = rel - target
  if (d > 6) d -= 12
  if (d < -6) d += 12
  return d
}

/**
 * Classify a sung window against the seven diatonic degrees of the
 * key rooted at `rootMidi`. Returns null when there is not enough
 * confident voicing, or when the settled pitch is too far from every
 * degree to count as an answer.
 */
export function detectSungDegree(
  frames: readonly SungFrame[],
  rootMidi: number,
): SungDegree | null {
  const voiced = frames.filter((f) => f.f0 > 0 && f.conf >= MIN_CONF)
  if (voiced.length < MIN_VOICED_FRAMES) return null

  // Drop the first 40% of the voiced window: the scoop into the note
  // is production noise, and classifying it would punish a perfectly
  // heard degree for an untrained onset.
  const settled = voiced.slice(Math.floor(voiced.length * 0.4))
  if (settled.length < Math.ceil(MIN_VOICED_FRAMES / 2)) return null

  const rels = settled.map((f) => {
    const rel = (freqToMidiFloat(f.f0) - rootMidi) % 12
    return rel < 0 ? rel + 12 : rel
  })

  // Score every degree by the median circular distance of the settled
  // frames; the winner is the degree the ear chose, and its median
  // signed distance is the voice's intonation error.
  let best: SungDegree | null = null
  let bestAbs = Number.POSITIVE_INFINITY
  for (const degree of HOME_DEGREES) {
    const signed = rels.map((rel) => circularSemitones(rel, degree.semitone))
    const med = median(signed)
    const abs = Math.abs(med)
    if (abs < bestAbs) {
      bestAbs = abs
      best = {
        degree,
        centsOff: Math.round(med * 100),
        voicedFrames: settled.length,
      }
    }
  }

  if (best === null || Math.abs(best.centsOff) > MAX_CENTS_FROM_DEGREE) {
    return null
  }
  return best
}
