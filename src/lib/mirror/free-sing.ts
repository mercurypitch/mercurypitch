// ============================================================
// Voice Mirror — Free Sing analysis ("just sing for 40 seconds").
//
// Post-processing over one open take: no targets, no judgment —
// it measures what the singing *was*. Range-in-use and tessitura
// from the dwell histogram, the "home note" you gravitate to,
// phrase lengths between breaths, melodic agility (mover vs.
// sustainer), and vibrato on the longest sustained stretch.
// Pure functions over F0Frame[], like metrics.ts.
// ============================================================

import { midiToNoteNameOctave } from '@/lib/note-utils'
import { detectVibrato } from '@/lib/vocal-analyzer'
import type { F0Frame, RangeResult, VibratoInfo, VoicedFrame } from './metrics'
import { centsToMidi, computeRange, median, preprocess, VIBRATO_MAX_HZ, VIBRATO_MIN_HZ, } from './metrics'

/** A gap this long between voiced frames is a breath / phrase boundary. */
export const PHRASE_GAP_SEC = 0.35
/** Runs shorter than this are noise, not phrases. */
export const PHRASE_MIN_SEC = 0.5
/** Vibrato needs a sustained stretch at least this long. */
const VIBRATO_MIN_RUN_SEC = 2

export interface PhraseStats {
  count: number
  medianSec: number
  longestSec: number
}

export interface FreeSingResult {
  /** Range actually used in the take (same rails as the guided glide). */
  range: RangeResult | null
  /** The semitone with the most dwell — where this voice "lives". */
  homeMidi: number
  homeNote: string
  /** Dwell-weighted 25th–75th percentile notes: the comfortable middle. */
  tessituraLowMidi: number
  tessituraHighMidi: number
  tessituraLowNote: string
  tessituraHighNote: string
  phrases: PhraseStats | null
  /** Note changes per voiced second — high = mover, low = sustainer. */
  agilityMovesPerSec: number
  vibrato: VibratoInfo | null
  voicedSeconds: number
}

/** Split voiced frames into phrases at breath-sized gaps. */
export function splitPhrases(voiced: readonly VoicedFrame[]): VoicedFrame[][] {
  const runs: VoicedFrame[][] = []
  let start = 0
  for (let i = 1; i <= voiced.length; i++) {
    const gap = i < voiced.length ? voiced[i].t - voiced[i - 1].t : Infinity
    if (gap <= PHRASE_GAP_SEC) continue
    runs.push(voiced.slice(start, i))
    start = i
  }
  return runs.filter(
    (run) =>
      run.length > 1 && run[run.length - 1].t - run[0].t >= PHRASE_MIN_SEC,
  )
}

export function computeFreeSing(
  frames: readonly F0Frame[],
): FreeSingResult | null {
  const voiced = preprocess(frames)
  if (voiced.length < 30) return null

  // Dwell histogram per semitone (uniform-hop dwell is fine here — the
  // histogram is only compared against itself).
  const dwell = new Map<number, number>()
  for (const frame of voiced) {
    const midi = centsToMidi(frame.cents)
    dwell.set(midi, (dwell.get(midi) ?? 0) + 1)
  }
  let homeMidi = centsToMidi(voiced[0].cents)
  let best = 0
  for (const [midi, count] of dwell) {
    if (count > best) {
      best = count
      homeMidi = midi
    }
  }

  // Dwell-weighted tessitura: the notes between the 25th and 75th percentile
  // of sung time, i.e. the comfortable middle rather than the extremes.
  const bins = [...dwell.entries()].sort((a, b) => a[0] - b[0])
  const total = bins.reduce((sum, [, count]) => sum + count, 0)
  const quantileBin = (q: number): number => {
    let acc = 0
    for (const [midi, count] of bins) {
      acc += count
      if (acc >= total * q) return midi
    }
    return bins[bins.length - 1][0]
  }
  const tessituraLowMidi = quantileBin(0.25)
  const tessituraHighMidi = quantileBin(0.75)

  // Phrases between breaths.
  const runs = splitPhrases(voiced)
  const durations = runs.map((run) => run[run.length - 1].t - run[0].t)
  const phrases: PhraseStats | null =
    durations.length > 0
      ? {
          count: durations.length,
          medianSec: median(durations),
          longestSec: Math.max(...durations),
        }
      : null

  // Agility: quantized note changes that persist (3+ frames), per voiced
  // second — separates melody "movers" from long-note "sustainers".
  let moves = 0
  let currentMidi = centsToMidi(voiced[0].cents)
  let pendingMidi = currentMidi
  let pendingCount = 0
  for (const frame of voiced) {
    const midi = centsToMidi(frame.cents)
    if (midi === currentMidi) {
      pendingCount = 0
      continue
    }
    if (midi === pendingMidi) {
      pendingCount++
    } else {
      pendingMidi = midi
      pendingCount = 1
    }
    if (pendingCount >= 3) {
      currentMidi = pendingMidi
      moves++
      pendingCount = 0
    }
  }
  const voicedSeconds = runs.reduce(
    (sum, run) => sum + (run[run.length - 1].t - run[0].t),
    0,
  )
  const agilityMovesPerSec = voicedSeconds > 0 ? moves / voicedSeconds : 0

  // Vibrato on the longest sustained stretch, if there is one.
  let vibrato: VibratoInfo | null = null
  const longest =
    runs.length > 0
      ? runs.reduce((a, b) =>
          a[a.length - 1].t - a[0].t >= b[b.length - 1].t - b[0].t ? a : b,
        )
      : null
  if (
    longest !== null &&
    longest[longest.length - 1].t - longest[0].t >= VIBRATO_MIN_RUN_SEC
  ) {
    const vib = detectVibrato(
      longest.map((f) => ({ time: f.t, freq: 0, midi: f.cents / 100 })),
    )
    if (
      vib.detected &&
      vib.rateHz >= VIBRATO_MIN_HZ &&
      vib.rateHz <= VIBRATO_MAX_HZ
    ) {
      vibrato = {
        rateHz: vib.rateHz,
        extentCents: Math.round(vib.depthCents / Math.SQRT2),
      }
    }
  }

  return {
    range: computeRange([[...frames]]),
    homeMidi,
    homeNote: midiToNoteNameOctave(homeMidi),
    tessituraLowMidi,
    tessituraHighMidi,
    tessituraLowNote: midiToNoteNameOctave(tessituraLowMidi),
    tessituraHighNote: midiToNoteNameOctave(tessituraHighMidi),
    phrases,
    agilityMovesPerSec,
    vibrato,
    voicedSeconds,
  }
}
