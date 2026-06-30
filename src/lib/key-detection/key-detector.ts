// ============================================================
// Krumhansl-Schmuckler key detection.
//
// Build a duration-weighted 12-bin pitch-class histogram, correlate it against
// the 24 rotated key templates (Pearson), and take the argmax — that names the
// tonic and mode in one shot. Per-region detection slides a window over the
// note timeline and merges consecutive same-key windows into regions, so a
// song that modulates yields a key per part.
// ============================================================

import { NOTE_NAMES } from '@/lib/scale-data'
import type { KeyProfileSet, Mode } from './key-profiles'
import { AARDEN_ESSEN } from './key-profiles'

/** A note for key detection — only pitch and duration matter. */
export interface KeyNote {
  midi: number
  startSec: number
  endSec: number
}

export interface KeyEstimate {
  /** Tonic pitch class, 0 = C .. 11 = B. */
  tonic: number
  mode: Mode
  /** 0..1 — the top template's correlation minus the runner-up's. */
  confidence: number
  /** App key string, e.g. 'C', 'F#'. */
  keyName: string
  /** App scale type: 'major' or 'natural-minor'. */
  scaleType: string
}

export interface KeyRegion extends KeyEstimate {
  startSec: number
  endSec: number
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += a[i]
    mb += b[i]
  }
  ma /= n
  mb /= n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma
    const xb = b[i] - mb
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

/** Rotate a tonic-relative profile so index 0 lands on pitch class `tonic`. */
function rotate(profile: number[], tonic: number): number[] {
  const out = new Array<number>(12)
  for (let i = 0; i < 12; i++) out[i] = profile[(((i - tonic) % 12) + 12) % 12]
  return out
}

/** Duration-weighted pitch-class histogram (index 0 = C .. 11 = B). */
export function pitchClassHistogram(notes: KeyNote[]): number[] {
  const h = new Array<number>(12).fill(0)
  for (const n of notes) {
    const dur = n.endSec - n.startSec
    if (dur <= 0) continue
    h[((n.midi % 12) + 12) % 12] += dur
  }
  return h
}

function toEstimate(
  tonic: number,
  mode: Mode,
  confidence: number,
): KeyEstimate {
  return {
    tonic,
    mode,
    confidence,
    keyName: NOTE_NAMES[tonic],
    scaleType: mode === 'major' ? 'major' : 'natural-minor',
  }
}

export function detectKeyFromHistogram(
  hist: number[],
  profiles: KeyProfileSet = AARDEN_ESSEN,
): KeyEstimate {
  const total = hist.reduce((a, b) => a + b, 0)
  if (total === 0) return toEstimate(0, 'major', 0)

  let bestScore = -Infinity
  let bestTonic = 0
  let bestMode: Mode = 'major'
  let secondScore = -Infinity
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as Mode[]) {
      const tmpl = rotate(
        mode === 'major' ? profiles.major : profiles.minor,
        tonic,
      )
      const r = pearson(hist, tmpl)
      if (r > bestScore) {
        secondScore = bestScore
        bestScore = r
        bestTonic = tonic
        bestMode = mode
      } else if (r > secondScore) {
        secondScore = r
      }
    }
  }
  const confidence = Math.max(0, Math.min(1, bestScore - secondScore))
  return toEstimate(bestTonic, bestMode, confidence)
}

export function detectKeyFromNotes(
  notes: KeyNote[],
  profiles: KeyProfileSet = AARDEN_ESSEN,
): KeyEstimate {
  return detectKeyFromHistogram(pitchClassHistogram(notes), profiles)
}

export interface RegionalKeyOptions {
  /** Analysis window length, seconds. Default 8. */
  windowSec?: number
  /** Window hop, seconds. Default 4. */
  hopSec?: number
  /** Regions shorter than this are merged into a neighbour. Default 6. */
  minRegionSec?: number
  profiles?: KeyProfileSet
}

/**
 * Detect a key per region of the song. Slides a window over the note timeline,
 * estimates a key per window, and merges consecutive same-key windows. Short
 * regions are absorbed into the previous region to avoid jitter.
 */
export function detectRegionalKeys(
  notes: KeyNote[],
  opts: RegionalKeyOptions = {},
): KeyRegion[] {
  if (notes.length === 0) return []
  const windowSec = opts.windowSec ?? 8
  const hopSec = opts.hopSec ?? 4
  const minRegionSec = opts.minRegionSec ?? 6
  const profiles = opts.profiles ?? AARDEN_ESSEN

  let start = Infinity
  let end = -Infinity
  for (const n of notes) {
    if (n.startSec < start) start = n.startSec
    if (n.endSec > end) end = n.endSec
  }

  const regions: KeyRegion[] = []
  for (let t = start; t < end; t += hopSec) {
    const wEnd = Math.min(end, t + windowSec)
    const inWin: KeyNote[] = []
    for (const n of notes) {
      if (n.endSec <= t || n.startSec >= wEnd) continue
      inWin.push({
        midi: n.midi,
        startSec: Math.max(n.startSec, t),
        endSec: Math.min(n.endSec, wEnd),
      })
    }
    if (inWin.length === 0) continue
    const est = detectKeyFromNotes(inWin, profiles)
    const prev = regions[regions.length - 1]
    if (
      prev !== undefined &&
      prev.tonic === est.tonic &&
      prev.mode === est.mode
    ) {
      prev.endSec = wEnd
      prev.confidence = Math.max(prev.confidence, est.confidence)
    } else {
      regions.push({ ...est, startSec: t, endSec: wEnd })
    }
  }

  if (regions.length === 0) {
    return [
      { ...detectKeyFromNotes(notes, profiles), startSec: start, endSec: end },
    ]
  }

  // Absorb too-short regions into the previous region (simple smoothing).
  const merged: KeyRegion[] = []
  for (const r of regions) {
    const prev = merged[merged.length - 1]
    if (prev !== undefined && r.endSec - r.startSec < minRegionSec) {
      prev.endSec = r.endSec
    } else {
      merged.push(r)
    }
  }
  return merged
}
