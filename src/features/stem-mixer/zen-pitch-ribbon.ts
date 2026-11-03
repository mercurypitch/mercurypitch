// ============================================================
// Zen pitch ribbon — pure geometry + judgement helpers
// ============================================================
//
// The ribbon is the zen stage's live coach: target notes flow left
// through a fixed "now" marker while the singer's pitch rides it as a
// glowing dot — green while the note is held, warm rose when off the
// pitch, a dim ghost while not singing. All decisions live here as
// plain data-in/data-out so they are unit-testable; the canvas
// component only draws what these return. Judgement is octave-agnostic
// via the same folding the score uses.

import { foldCentsToOctave } from '@/lib/pitch-compare-engine'
import { midiToFreq } from '@/lib/scale-data'

/** Seconds of song visible behind / ahead of the "now" marker. */
export const RIBBON_BEHIND_SEC = 1.5
export const RIBBON_AHEAD_SEC = 5.5
/** The now-marker's horizontal position as a fraction of the width. */
export const RIBBON_NOW_RATIO =
  RIBBON_BEHIND_SEC / (RIBBON_BEHIND_SEC + RIBBON_AHEAD_SEC)

/** Same tolerance the score uses — the ribbon must judge identically. */
export const RIBBON_TOLERANCE_CENTS = 50

/** How far the band eases toward the notes in view each sixtieth of a second. */
export const RIBBON_BAND_EASE = 0.1

/** Minimal note shape the ribbon needs (seconds + MIDI). */
export interface RibbonNote {
  startBeat: number
  endBeat: number
  midi: number
}

export interface RibbonBand {
  minMidi: number
  maxMidi: number
}

/** Notes overlapping the visible window, in start order. */
export function notesInWindow(
  notes: readonly RibbonNote[],
  windowStart: number,
  windowEnd: number,
): RibbonNote[] {
  return notes.filter(
    (note) => note.endBeat > windowStart && note.startBeat < windowEnd,
  )
}

/**
 * Vertical MIDI band for the visible notes: their range padded by two
 * semitones, widened symmetrically to at least `minSpan` so a flat
 * phrase doesn't zoom into a wall of pixels. Null when nothing is
 * visible — the caller keeps its previous band so the ribbon doesn't
 * jump during instrumental gaps.
 */
export function ribbonBand(
  visible: readonly RibbonNote[],
  minSpan = 10,
): RibbonBand | null {
  if (visible.length === 0) return null
  let min = Infinity
  let max = -Infinity
  for (const note of visible) {
    if (note.midi < min) min = note.midi
    if (note.midi > max) max = note.midi
  }
  min -= 2
  max += 2
  const missing = minSpan - (max - min)
  if (missing > 0) {
    min -= missing / 2
    max += missing / 2
  }
  return { minMidi: min, maxMidi: max }
}

/**
 * The share of the way the band moves toward the notes in view over a frame
 * `frameSec` long: a tenth for every sixtieth of a second, whatever the frame
 * rate, so it glides alike on a phone, a laptop and a television. It was a
 * tenth per frame scaled by the tier's frame cap, and an uncapped device's
 * cap is Infinity, which made it nothing: the band never left where it
 * started, 55 to 79, and a low voice's notes sat on its bottom edge.
 * The first frame, with no frame before it, takes the band whole.
 */
export function ribbonBandEase(frameSec: number): number {
  // A clock that went back moves the band nowhere.
  if (!(frameSec > 0)) return 0
  return 1 - (1 - RIBBON_BAND_EASE) ** (frameSec * 60)
}

export function timeToX(
  timeSec: number,
  windowStart: number,
  windowEnd: number,
  width: number,
): number {
  return ((timeSec - windowStart) / (windowEnd - windowStart)) * width
}

/** MIDI → y with a little vertical padding; higher notes sit higher. */
export function midiToRibbonY(
  midi: number,
  band: RibbonBand,
  height: number,
  pad = 6,
): number {
  const span = band.maxMidi - band.minMidi
  const frac = (midi - band.minMidi) / span
  const clamped = Math.max(0, Math.min(1, frac))
  return height - pad - clamped * (height - pad * 2)
}

/** The target note under the playhead, if any. */
export function targetNoteAt(
  notes: readonly RibbonNote[],
  timeSec: number,
): RibbonNote | null {
  for (const note of notes) {
    if (timeSec >= note.startBeat && timeSec < note.endBeat) return note
  }
  return null
}

export type SingerState = 'hit' | 'off' | 'free' | 'silent'

export interface SingerReading {
  state: SingerState
  /** Display MIDI, folded to the target's octave when judging. */
  displayMidi: number | null
  /** Folded cents offset from the target (null without a target). */
  centsOff: number | null
}

/**
 * Judge the live mic pitch against the current target, octave-agnostic
 * (matching the score): 'hit' within tolerance, 'off' beyond it, 'free'
 * when singing with no target under the playhead (never judged — red
 * means wrong, not resting), 'silent' when no pitch is detected. The
 * display MIDI folds the sung pitch to the target's octave so the dot
 * rides the pill it is judged against.
 */
export function judgeSinger(
  micFrequency: number,
  target: RibbonNote | null,
  toleranceCents = RIBBON_TOLERANCE_CENTS,
): SingerReading {
  if (!(micFrequency > 0)) {
    return { state: 'silent', displayMidi: null, centsOff: null }
  }
  const micMidi = 69 + 12 * Math.log2(micFrequency / 440)
  if (target === null) {
    return { state: 'free', displayMidi: micMidi, centsOff: null }
  }
  const centsOff = foldCentsToOctave(
    1200 * Math.log2(micFrequency / midiToFreq(target.midi)),
  )
  return {
    state: Math.abs(centsOff) <= toleranceCents ? 'hit' : 'off',
    displayMidi: target.midi + centsOff / 100,
    centsOff,
  }
}
