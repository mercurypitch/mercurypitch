// The Sorting Line's grade, in real units.
// ============================================================
//
// Two units, no points, and the vocal one leads (docs/games/
// sorting-line.md §9). Per gate the run records THE SLIDE, not the
// pitch: a slide starts when the voice leaves where it last settled by
// more than half a semitone, and ends when it settles again -- held
// within a few cents for 150 ms. OVERSHOOT is how far past the nearest
// edge of the gate's band that stop landed, in cents, and 0 when it
// landed inside. FIRST-TRY means the first stop did.
//
// Cents is the unit the codebase already speaks, it stays comparable
// across sessions, and it measures the thing this world trains: where
// a glide stops, which is a siren with a target. First-try is per run
// and per room, has listen mode's "N of M first-try" as precedent, is
// not a streak, and carries nothing between sessions.
//
// This grade is NOT comparable with a chamber's. A chamber divides
// accumulated cents error by its ring tolerance; this world has its
// own accumulator and its own ScoreConfig, and the number sits beside
// a chamber's rather than against it (§9).

import type { ScoreConfig } from '../../glass/score'
import { qualityFromCents } from '../../glass/score'
import type { Band, Range } from './tension3d'

/** A band in MIDI rather than in `t`: what the voice has to do. */
export interface MidiBand {
  readonly lo: number
  readonly hi: number
}

export const midiBandFor = (band: Band, range: Range): MidiBand => {
  const span = range.highMidi - range.lowMidi
  return {
    lo: range.lowMidi + band.lo * span,
    hi: range.lowMidi + band.hi * span,
  }
}

/** How far past the nearest edge, in cents. 0 inside. */
export const overshootCents = (midi: number, band: MidiBand): number => {
  if (midi < band.lo) return (band.lo - midi) * 100
  if (midi > band.hi) return (midi - band.hi) * 100
  return 0
}

// ------------------------------------------------------------
// The slide.
// ------------------------------------------------------------

/** Leaving the last settled note by this much starts a slide. */
export const SLIDE_SEMIS = 0.5
/** Staying within this of one note is being still... */
export const STILL_SEMIS = 0.1
/** ...and being still this long is a stop. */
export const STOP_HOLD_SECONDS = 0.15

export interface SlideState {
  /** Where the voice last settled, or null before its first stop. */
  settled: number | null
  /** Whether it has left that note and is on its way somewhere. */
  moving: boolean
  /** The note the stillness window is measured against. */
  anchor: number | null
  stillFor: number
}

export const emptySlide = (): SlideState => ({
  settled: null,
  moving: false,
  anchor: null,
  stillFor: 0,
})

/**
 * Feed one frame's voice. Returns the note a slide stopped at, on the
 * frame it stops, and null on every other frame. Silence is not
 * motion: it clears the stillness window and nothing else, so a
 * breath in the middle of a held note does not make a second stop.
 *
 * Stillness is a window, not a velocity: pitch trackers jitter by a
 * few cents a frame, which at 60 Hz is a "velocity" of a semitone a
 * second, so a velocity threshold would never see a stop.
 */
export const slideStep = (
  s: SlideState,
  midi: number | null,
  dt: number,
): number | null => {
  if (midi === null) {
    s.anchor = null
    s.stillFor = 0
    return null
  }
  if (!s.moving) {
    if (s.settled !== null && Math.abs(midi - s.settled) <= SLIDE_SEMIS) {
      return null
    }
    s.moving = true
    s.anchor = null
    s.stillFor = 0
  }
  if (s.anchor === null || Math.abs(midi - s.anchor) > STILL_SEMIS) {
    s.anchor = midi
    s.stillFor = 0
    return null
  }
  s.stillFor += dt
  if (s.stillFor < STOP_HOLD_SECONDS) return null
  s.moving = false
  s.settled = midi
  s.anchor = null
  s.stillFor = 0
  return midi
}

// ------------------------------------------------------------
// The gates, the room, the walk.
// ------------------------------------------------------------

export interface GateGrade {
  /** How many stops were aimed at this gate. */
  readonly stops: number
  /** Whether the first stop landed inside its band. A gate walked
   * through with no stop at all counts as first-try: he was already
   * where he had to be. */
  readonly firstTry: boolean
  /** The first stop's overshoot, in cents. Later stops correct it;
   * they do not change what the glide did. */
  readonly overshootCents: number
}

export const NO_STOPS: GateGrade = {
  stops: 0,
  firstTry: true,
  overshootCents: 0,
}

export const withStop = (
  g: GateGrade,
  midi: number,
  band: MidiBand,
): GateGrade => {
  if (g.stops > 0) return { ...g, stops: g.stops + 1 }
  const over = overshootCents(midi, band)
  return { stops: 1, firstTry: over === 0, overshootCents: over }
}

/** The app's thresholds, as the journey has them; a drop costs what a
 * fall costs there. `centsZero` is replaced per gate by the gate's own
 * band, which is the whole point of grading against the band. */
export const LINE_SCORE: ScoreConfig = {
  passPct: 75,
  greatPct: 90,
  bronzePct: 55,
  centsPerfect: 0,
  centsZero: 100,
  fallPenaltyPct: 4,
  listenWrongPenalty: 0,
}

/** Per-gate quality: `clamp01(1 - overshoot / bandCents)`, which is
 * `qualityFromCents` with the gate's own band as the zero point. */
export const gateQuality = (g: GateGrade, band: MidiBand): number =>
  qualityFromCents(g.overshootCents, {
    ...LINE_SCORE,
    centsZero: Math.max(1, (band.hi - band.lo) * 100),
  })

export interface RoomGrade {
  readonly gates: readonly GateGrade[]
  readonly bands: readonly MidiBand[]
  readonly drops: number
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

export const roomPct = (r: RoomGrade, S: ScoreConfig = LINE_SCORE): number => {
  const qs = r.gates.map((g, i) => gateQuality(g, r.bands[i]!))
  const base = mean(qs) * 100 - r.drops * S.fallPenaltyPct
  return Math.round(Math.min(100, Math.max(0, base)))
}

export type Medal = 'gold' | 'silver' | 'bronze'

export const medalFor = (
  pct: number,
  S: ScoreConfig = LINE_SCORE,
): Medal | null =>
  pct >= S.greatPct
    ? 'gold'
    : pct >= S.passPct
      ? 'silver'
      : pct >= S.bronzePct
        ? 'bronze'
        : null

/** What a room keeps of a run. The best run's, by `pct`. */
export interface RoomStats {
  readonly pct: number
  /** Mean first-stop overshoot across the room's gates, in cents. */
  readonly overshootCents: number
  readonly firstTry: number
  readonly gates: number
  readonly drops: number
}

export const statsOf = (r: RoomGrade): RoomStats => ({
  pct: roomPct(r),
  overshootCents: Math.round(mean(r.gates.map((g) => g.overshootCents))),
  firstTry: r.gates.filter((g) => g.firstTry).length,
  gates: r.gates.length,
  drops: r.drops,
})

const dropped = (n: number): string =>
  n === 1
    ? 'dropped once'
    : n === 2
      ? 'dropped twice'
      : `dropped ${String(n)} times`

/** The room card: `62¢ past the gate · 2 of 3 first time · dropped once`. */
export const roomLine = (s: RoomStats): string => {
  const parts = [
    `${String(s.overshootCents)}¢ past the gate`,
    `${String(s.firstTry)} of ${String(s.gates)} first time`,
  ]
  if (s.drops > 0) parts.push(dropped(s.drops))
  return parts.join(' · ')
}

/** The walk card: `84¢ past the gate on average · 11 of 14 gates first
 * time`, over every room's best. */
export const walkLine = (rooms: readonly RoomStats[]): string => {
  const gates = rooms.reduce((n, r) => n + r.gates, 0)
  if (gates === 0) return ''
  const cents = Math.round(
    rooms.reduce((n, r) => n + r.overshootCents * r.gates, 0) / gates,
  )
  const first = rooms.reduce((n, r) => n + r.firstTry, 0)
  return `${String(cents)}¢ past the gate on average · ${String(first)} of ${String(gates)} gates first time`
}
