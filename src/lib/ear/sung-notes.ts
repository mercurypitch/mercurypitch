// ============================================================
// sung-notes — a sung (or played) answer read in free time.
//
// The player answers at their own pace: no grid, no count-in. The
// frames from the pitch stream are cut into notes — a voiced run of
// at least 120 ms, split wherever the pitch steps more than 70 cents,
// bridged over the short unvoiced gaps consonants and breaths leave —
// and the median MIDI of each run names its note. scorePhraseFree
// then judges the notes position by position against the phrase,
// octave-folded within 60 cents; a missing or an extra note is a
// miss, never a crash.
//
// Pure. Nothing here opens a microphone.
// ============================================================

import type { F0Frame } from '@/lib/pitch-measurements'
import { degreeSemitone, nearestDegree } from './phrase'

export interface SungNote {
  /** Median MIDI (fractional) of the run. */
  midi: number
  startS: number
  endS: number
  frames: number
}

export interface SegmentOptions {
  minConf?: number
  /** A run shorter than this is a blip, not a note. */
  minRunMs?: number
  /** A pitch step larger than this starts a new note. */
  splitCents?: number
  /** Unvoiced gaps up to this long stay inside a note. */
  bridgeMs?: number
}

export const SEGMENT_DEFAULTS: Required<SegmentOptions> = {
  minConf: 0.5,
  minRunMs: 120,
  splitCents: 70,
  bridgeMs: 80,
}

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The stream's hop, so a run's length counts its last frame too. */
function hopSeconds(frames: readonly F0Frame[]): number {
  const deltas: number[] = []
  for (let i = 1; i < frames.length; i++) {
    const delta = frames[i].t - frames[i - 1].t
    if (delta > 0) deltas.push(delta)
  }
  return deltas.length > 0 ? median(deltas) : 1 / 60
}

export function segmentSungNotes(
  frames: readonly F0Frame[],
  options?: SegmentOptions,
): SungNote[] {
  const opts = { ...SEGMENT_DEFAULTS, ...options }
  const hop = hopSeconds(frames)
  const notes: SungNote[] = []
  let run: { midis: number[]; startS: number; endS: number } | null = null

  const close = (): void => {
    if (run && (run.endS - run.startS + hop) * 1000 >= opts.minRunMs) {
      notes.push({
        midi: median(run.midis),
        startS: run.startS,
        endS: run.endS,
        frames: run.midis.length,
      })
    }
    run = null
  }

  for (const frame of frames) {
    const voiced = frame.f0 > 0 && frame.conf >= opts.minConf
    if (!voiced) {
      if (run && (frame.t - run.endS) * 1000 > opts.bridgeMs) close()
      continue
    }
    const midi = freqToMidi(frame.f0)
    if (run) {
      const step = Math.abs(midi - median(run.midis)) * 100
      const gap = (frame.t - run.endS) * 1000
      if (step > opts.splitCents || gap > opts.bridgeMs) close()
    }
    if (!run) run = { midis: [], startS: frame.t, endS: frame.t }
    run.midis.push(midi)
    run.endS = frame.t
  }
  close()
  return notes
}

/** Signed semitones from `midi` to the nearest octave of `target`. */
function foldedSemitones(midi: number, target: number): number {
  let d = ((midi - target) % 12) + 0
  if (d > 6) d -= 12
  if (d < -6) d += 12
  return d
}

export interface ScoredSungNote {
  degree: number
  /** The note sung at this position; null when none was. */
  sungMidi: number | null
  /** Signed cents from the target, octave-folded; null when none was. */
  centsOff: number | null
  met: boolean
}

export interface SungPhraseScore {
  notes: ScoredSungNote[]
  correct: boolean
  /** 0-based index of the first note not met — the phrase's length
   *  when every note was met but more were sung — or null. */
  firstMiss: number | null
  /** Notes sung beyond the phrase. */
  extra: number
  /** Notes the mic heard in all. */
  sung: number
}

/** Position by position, in order: the i-th note sung must be the
 *  i-th note of the phrase, in any octave. */
export function scorePhraseFree(
  sung: readonly SungNote[],
  expected: readonly number[],
  rootMidi: number,
  maxCents = 60,
): SungPhraseScore {
  const notes: ScoredSungNote[] = expected.map((degree, i) => {
    const note = i < sung.length ? sung[i] : undefined
    if (note === undefined) {
      return { degree, sungMidi: null, centsOff: null, met: false }
    }
    const target = rootMidi + degreeSemitone(degree)
    const centsOff = Math.round(foldedSemitones(note.midi, target) * 100)
    return {
      degree,
      sungMidi: note.midi,
      centsOff,
      met: Math.abs(centsOff) <= maxCents,
    }
  })
  const extra = Math.max(0, sung.length - expected.length)
  let firstMiss: number | null = notes.findIndex((note) => !note.met)
  if (firstMiss === -1) firstMiss = extra > 0 ? expected.length : null
  return {
    notes,
    correct: firstMiss === null,
    firstMiss,
    extra,
    sung: sung.length,
  }
}

/** What each sung note is heard as: the degree nearest to it above the
 *  root, octave-folded — the live strip's words and a slip's record. */
export function sungDegrees(
  sung: readonly SungNote[],
  rootMidi: number,
): number[] {
  return sung.map((note) => nearestDegree(note.midi - rootMidi))
}
