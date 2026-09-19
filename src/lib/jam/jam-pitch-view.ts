// ── jam-pitch-view ───────────────────────────────────────────────────
// Pure geometry and judgement for the jam canvases.
//
// Why this exists: all three jam canvases plotted `sample.midi`, which
// is the detector's ROUNDED semitone. A held note could therefore only
// land on one of a few dozen rows, so the trace stepped between grid
// lines instead of riding between them -- the "clamping" singers see.
// The sub-semitone was never missing: `cents` is measured against that
// same rounded midi, rides on every sample and crosses the wire to
// peers. `sampleMidi` simply puts the two back together.
//
// The judgement bands are the app's existing ones rather than new ones,
// so the colour a singer sees agrees with the score they are given.
// Deliberately NOT octave-folded, because jam scoring is not either
// (JamExerciseCanvas counts `(s.midi - note.midi) * 100 + s.cents`);
// a colour that forgave an octave would promise points that never come.

import { ribbonBand } from '@/features/stem-mixer/zen-pitch-ribbon'
import { CENTS_EXCELLENT, CENTS_GOOD } from '@/lib/practice-engine'

/** The part of a jam pitch sample this module needs. */
export interface JamPitchView {
  midi: number
  cents: number
  frequency: number
  clarity: number
  timestamp: number
}

/**
 * Exact MIDI of a sample, sub-semitone included.
 *
 * `cents` is the detector's offset from the rounded `midi`
 * (freq-note.ts: `round((exactMidi - midi) * 100)`), so the two add
 * back to the pitch actually heard, to within half a cent.
 */
export function sampleMidi(s: Pick<JamPitchView, 'midi' | 'cents'>): number {
  return s.midi + s.cents / 100
}

// ── Judgement ────────────────────────────────────────────────────────

/** How well a frame sat on the note it was aimed at. */
export type JamHitQuality = 'perfect' | 'close' | 'miss'

/**
 * Tuning knobs, kept together because this is what gets adjusted after
 * singing with it rather than reading it.
 */
/** Within this, the app counts a clean hit everywhere else too. */
export const JAM_PERFECT_CENTS = CENTS_EXCELLENT
/** Within this, the jam scoreboard still counts the frame. */
export const JAM_CLOSE_CENTS = CENTS_GOOD
/** How far the pill's own colour is pulled towards the verdict (0..1). */
export const JAM_TINT_AMOUNT = 0.5
/** Clarity below this is not singing, so it cannot be a hit. */
export const JAM_MIN_CLARITY = 0.2
/** A sample older than this is not about the note under the playhead. */
export const JAM_SAMPLE_MAX_AGE_MS = 250

/** Green, amber, red -- the palette already used by the scoreboard. */
export const JAM_QUALITY_COLOR: Record<JamHitQuality, string> = {
  perfect: '#3fb950',
  close: '#e3a221',
  miss: '#f85149',
}

/** Band a cents offset falls in. Sign is ignored; sharp and flat read alike. */
export function qualityForCents(centsOff: number): JamHitQuality {
  const off = Math.abs(centsOff)
  if (!Number.isFinite(off)) return 'miss'
  if (off <= JAM_PERFECT_CENTS) return 'perfect'
  if (off <= JAM_CLOSE_CENTS) return 'close'
  return 'miss'
}

/** Signed cents from a target note. Positive is sharp. */
export function centsFromTarget(
  s: Pick<JamPitchView, 'midi' | 'cents'>,
  targetMidi: number,
): number {
  return (sampleMidi(s) - targetMidi) * 100
}

/**
 * Judge one frame against the note under the playhead.
 *
 * Silence is a miss, not an absence: a note nobody sang is a note
 * nobody hit, and that is exactly the case a singer needs to see. The
 * caller decides whether there IS a note to aim at -- with no target,
 * do not call this, because resting is not failing.
 */
export function judgeAgainstNote(
  s: JamPitchView | null | undefined,
  targetMidi: number,
  now: number,
): JamHitQuality {
  if (s === null || s === undefined) return 'miss'
  if (!(s.frequency > 0) || s.midi <= 0) return 'miss'
  if (s.clarity < JAM_MIN_CLARITY) return 'miss'
  if (now - s.timestamp > JAM_SAMPLE_MAX_AGE_MS) return 'miss'
  return qualityForCents(centsFromTarget(s, targetMidi))
}

// ── Per-note verdict ─────────────────────────────────────────────────
//
// Judging frame by frame strobes: at 60 fps a singer sitting on the
// line between two bands flickers green/amber several times a second.
// Accumulating instead means the pill settles, and the settled value is
// still live -- it keeps moving while the note is under the playhead
// and simply stops when the note passes.

export interface NoteAccuracy {
  frames: number
  perfect: number
  close: number
}

export function blankNoteAccuracy(): NoteAccuracy {
  return { frames: 0, perfect: 0, close: 0 }
}

export function observeNoteFrame(
  acc: NoteAccuracy,
  quality: JamHitQuality,
): void {
  acc.frames++
  if (quality === 'perfect') acc.perfect++
  else if (quality === 'close') acc.close++
}

/**
 * The verdict so far: the best band the singer held for most of the
 * note. Null before the note has been live for a single frame, which
 * is what keeps notes that have not arrived yet uncoloured.
 */
export function noteVerdict(acc: NoteAccuracy): JamHitQuality | null {
  if (acc.frames === 0) return null
  if (acc.perfect / acc.frames >= 0.5) return 'perfect'
  if ((acc.perfect + acc.close) / acc.frames >= 0.5) return 'close'
  return 'miss'
}

// ── Vertical band ────────────────────────────────────────────────────

/** Semitones a canvas shows at minimum, matching the zen ribbon. */
export const JAM_BAND_MIN_SPAN = 10
/** Fraction of the remaining distance a band closes each frame. */
export const JAM_BAND_EASE = 0.08
/** Where a canvas sits until anyone sings: a comfortable middle. */
export const JAM_BAND_FALLBACK = { minMidi: 55, maxMidi: 67 } as const

export interface JamBand {
  minMidi: number
  maxMidi: number
}

/**
 * The band a canvas should show for a set of pitches.
 *
 * Delegates to the zen ribbon's `ribbonBand` so there is one policy for
 * how much air a melody gets (two semitones either side, widened to a
 * ten-semitone minimum) rather than one per canvas. The jam canvases
 * hold plain MIDI numbers, not ribbon notes, hence the mapping.
 */
export function jamPitchBand(
  midis: readonly number[],
  minSpan = JAM_BAND_MIN_SPAN,
): JamBand | null {
  const usable = midis.filter((m) => Number.isFinite(m) && m > 0)
  if (usable.length === 0) return null
  return ribbonBand(
    usable.map((midi) => ({ startBeat: 0, endBeat: 0, midi })),
    minSpan,
  )
}

/**
 * Move one edge of a band towards where it wants to be.
 *
 * Bands are recomputed every frame because the pitches they cover come
 * and go; jumping straight to the new value makes the whole canvas
 * pump as people sing. Snapping at the end stops it creeping forever.
 */
export function easeToward(
  current: number,
  target: number,
  factor = JAM_BAND_EASE,
): number {
  if (!Number.isFinite(current)) return target
  const next = current + (target - current) * factor
  return Math.abs(target - next) < 0.01 ? target : next
}

// ── Axis labels ──────────────────────────────────────────────────────

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

/** Scientific pitch name for a whole MIDI number, e.g. 60 -> C4. */
export function midiLabel(midi: number): string {
  const rounded = Math.round(midi)
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12] ?? '?'
  return `${name}${Math.floor(rounded / 12) - 1}`
}

/**
 * How many semitones apart to label an axis.
 *
 * One label per octave was right when a canvas showed five of them and
 * useless now that a band can be ten semitones wide and contain no C at
 * all. Label as densely as there is room for, and no denser.
 */
export function labelStepForPixels(pxPerSemitone: number): number {
  if (pxPerSemitone >= 12) return 1
  if (pxPerSemitone >= 6) return 2
  if (pxPerSemitone >= 3) return 4
  return 12
}

// ── Colour ───────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (m === null) return null
  return [
    parseInt(m[1] ?? '0', 16),
    parseInt(m[2] ?? '0', 16),
    parseInt(m[3] ?? '0', 16),
  ]
}

/**
 * Blend two hex colours. Canvas has no colour-mix, and the pill has to
 * stay recognisably the singer's own colour while it reports -- a pill
 * repainted flat green would read as somebody else's lane.
 */
export function mixHex(base: string, tint: string, amount: number): string {
  const a = parseHex(base)
  const b = parseHex(tint)
  if (a === null || b === null) return base
  const t = Math.min(1, Math.max(0, amount))
  const out = a.map((channel, i) =>
    Math.round(channel + ((b[i] ?? channel) - channel) * t),
  )
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** The pill colour for a verdict, or the untouched base when there is none. */
export function tintForVerdict(
  base: string,
  verdict: JamHitQuality | null,
  amount = JAM_TINT_AMOUNT,
): string {
  if (verdict === null) return base
  return mixHex(base, JAM_QUALITY_COLOR[verdict], amount)
}
