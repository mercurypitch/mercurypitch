// ============================================================
// Pitch compare engine — mic-vs-reference comparison for scoring
// ============================================================
//
// Pure, frame-driven core behind the stem-mixer mic score. The RAF loop
// feeds it one (time, referenceFreq, micFreq) triple per frame; the engine
// decides which frames are fair to judge and aggregates them two ways:
//
//   - frame comparisons (ComparisonPoint) — drive the accuracy % and the
//     canvas diff bars, octave-agnostic so singing in your own octave is
//     scored on pitch class, not punished by ±1200 cents;
//   - reference note segments — contiguous stable stretches of the
//     reference vocal, each with a hit/miss verdict, so the score can say
//     "you hit 7 of 10 notes" the way a singer actually thinks about it.
//
// Fairness gates:
//   - a frame counts only after the reference has been stable for
//     `stableMs` (skips note-transition latency and detector scrapes);
//   - reference stretches shorter than `minNoteMs` never become notes
//     (un-singable blips don't judge anyone).
//
// Tests: src/tests/pitch-compare-engine.test.ts
// ============================================================

import type { ComparisonPoint } from './mic-scoring'
import { freqToMidiFloat } from './pitch-pipeline/log-pitch'
import { midiToNote } from './scale-data'

/** Fold a cents offset to the nearest octave: +1200 → 0, +700 → -500.
 *  Result is always in [-600, +600]. */
export function foldCentsToOctave(cents: number): number {
  const wrapped = ((cents % 1200) + 1200) % 1200
  return wrapped > 600 ? wrapped - 1200 : wrapped
}

export interface CompareEngineOptions {
  /** In-tolerance threshold on the folded cents offset. Default 50. */
  toleranceCents?: number
  /** Score pitch class only (fold octaves). Default true. */
  octaveAgnostic?: boolean
  /** Reference must hold a pitch this long before frames are judged —
   *  covers both note-transition latency and onset scrapes. Default 130. */
  stableMs?: number
  /** Reference stretches shorter than this are not notes. Default 150. */
  minNoteMs?: number
  /** A note is hit when at least this share of its judged frames are in
   *  tolerance. Default 0.5. */
  noteHitRatio?: number
  /** Reference pitch may wander this much (semitones) and still be the
   *  same note segment. Default 1. */
  segmentSemitones?: number
}

export interface NoteStats {
  /** Reference notes long enough to be singable during this run. */
  notesTotal: number
  /** Notes where the singer matched at least `noteHitRatio` of the judged
   *  frames. A note the singer never attempted counts as a miss. */
  notesHit: number
}

interface Segment {
  startSec: number
  lastSec: number
  /** Running mean of the reference pitch in fractional MIDI. */
  midiSum: number
  midiCount: number
  judged: number
  hits: number
}

export interface PitchCompareEngine {
  /**
   * Feed one frame. `referenceFreq`/`micFreq` <= 0 mean unvoiced.
   * Returns the comparison point recorded for this frame, or null when the
   * frame was gated (unstable reference, either side unvoiced).
   */
  push(
    timeSec: number,
    referenceFreq: number,
    micFreq: number,
  ): ComparisonPoint | null
  /** Per-note verdicts so far (the active segment is included). */
  noteStats(): NoteStats
  /** Total comparison points ever produced (survives external capping). */
  pointCount(): number
  /** Remember the current point count (start of a loop iteration). */
  mark(): void
  /** Points produced since the last mark() (or since reset). */
  pointsSinceMark(): number
  reset(): void
}

export function createPitchCompareEngine(
  opts: CompareEngineOptions = {},
): PitchCompareEngine {
  const tolerance = opts.toleranceCents ?? 50
  const octaveAgnostic = opts.octaveAgnostic ?? true
  const stableSec = (opts.stableMs ?? 130) / 1000
  const minNoteSec = (opts.minNoteMs ?? 150) / 1000
  const noteHitRatio = opts.noteHitRatio ?? 0.5
  const segmentSemitones = opts.segmentSemitones ?? 1

  let active: Segment | null = null
  let closed: { judged: number; hits: number; durationSec: number }[] = []
  let points = 0
  let markAt = 0

  const segmentDuration = (s: Segment): number => s.lastSec - s.startSec

  const closeActive = (): void => {
    if (active) {
      closed.push({
        judged: active.judged,
        hits: active.hits,
        durationSec: segmentDuration(active),
      })
      active = null
    }
  }

  const noteName = (midiFloat: number): string => {
    const { name, octave } = midiToNote(Math.round(midiFloat))
    return `${name}${octave}`
  }

  return {
    push(timeSec, referenceFreq, micFreq): ComparisonPoint | null {
      if (referenceFreq <= 0) {
        closeActive()
        return null
      }

      const refMidi = freqToMidiFloat(referenceFreq)
      if (
        active === null ||
        Math.abs(refMidi - active.midiSum / active.midiCount) > segmentSemitones
      ) {
        closeActive()
        active = {
          startSec: timeSec,
          lastSec: timeSec,
          midiSum: refMidi,
          midiCount: 1,
          judged: 0,
          hits: 0,
        }
      } else {
        active.midiSum += refMidi
        active.midiCount++
        active.lastSec = timeSec
      }

      // Grace: don't judge until the reference has settled on this note.
      if (timeSec - active.startSec < stableSec) return null
      if (micFreq <= 0) return null

      const micMidi = freqToMidiFloat(micFreq)
      const rawCents = (micMidi - refMidi) * 100
      const cents = octaveAgnostic ? foldCentsToOctave(rawCents) : rawCents
      const inTolerance = Math.abs(cents) <= tolerance

      active.judged++
      if (inTolerance) active.hits++
      points++

      return {
        time: timeSec,
        vocalNote: noteName(refMidi),
        micNote: noteName(micMidi),
        centsOff: cents,
        inTolerance,
      }
    },

    noteStats(): NoteStats {
      const all = [...closed]
      if (active) {
        all.push({
          judged: active.judged,
          hits: active.hits,
          durationSec: segmentDuration(active),
        })
      }
      let notesTotal = 0
      let notesHit = 0
      for (const seg of all) {
        if (seg.durationSec < minNoteSec) continue
        notesTotal++
        if (seg.judged > 0 && seg.hits / seg.judged >= noteHitRatio) {
          notesHit++
        }
      }
      return { notesTotal, notesHit }
    },

    pointCount(): number {
      return points
    },

    mark(): void {
      markAt = points
    },

    pointsSinceMark(): number {
      return points - markAt
    },

    reset(): void {
      active = null
      closed = []
      points = 0
      markAt = 0
    },
  }
}
