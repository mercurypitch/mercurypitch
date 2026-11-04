// ============================================================
// Lesson 11 lines — every line Merc sings, in the model's two gears
// ============================================================
//
// The gear model (WEB-SPEC, Audio; FACTS 74): each line Merc sings is two
// voices on one pitch path, the lower gear and the upper, whose levels add
// to one at every point. A line is built from three paths of knots, each
// joined straight: its pitch in semitones (so a glide runs even in
// semitones, as the kit's exponential pitch ramps do), the lower gear's
// share of the sound, and an overall level for the silences between a
// sequence's parts. Where the share or the level changes, a point every
// 10 ms keeps the sum near one through the kit's exponential level ramps,
// which would leave both gears 40 dB down in the middle of a crossfade
// written as two points. The extra points sit on the same pitch path, so
// the glide is unchanged.
//
// The times, rates and jumps are FACTS 75 to 81's: the cold open's sirens,
// 8.5 s with a 2-semitone jump at 1.697 s and back at 6.763 s; Step 1's
// note in each gear; Step 2's slide, slowed to 8.0 s; Step 3's three model
// slides; Step 4's five two-note slides, their jumps narrowing from 2 to a
// quarter of a semitone while the crossfade lengthens; Step 5's figure,
// flipped on purpose or hidden in one even blend; and Sing it's siren in
// one gear. The lower voice is Merc's and the higher Tavi's (FACTS 76 to
// 81). Nothing here sounds or draws: the toys do (registers-toy.ts).

import { hz } from '@/features/lessons/kit/notes'
import type { LinePoint } from '@/features/lessons/kit/range-chart'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** The notes the lesson plays, MIDI (FACTS 73). */
export const N = {
  C3: 48,
  E3: 52,
  F3: 53,
  Fs3: 54,
  G3: 55,
  Gs3: 56,
  A3: 57,
  As3: 58,
  B3: 59,
  C4: 60,
  Cs4: 61,
  D4: 62,
  E4: 64,
  F4: 65,
  Fs4: 66,
  G4: 67,
  Gs4: 68,
  A4: 69,
  As4: 70,
  B4: 71,
  C5: 72,
  Cs5: 73,
  E5: 76,
} as const

/** The steps' window, either voice: C3 to E5 (FACTS 73 to 80). */
export const STEPS_WINDOW = { lo: N.C3, hi: N.E5 } as const

/** The jump at a flip, semitones, and how long it takes, seconds (FACTS 75). */
export const JUMP = 2
export const JUMP_SEC = 0.04
/** A crossfade's points are this far apart, seconds. */
export const XFADE_STEP = 0.01

/** The cold open's siren: 4.0 s up, a 0.5 s turn, 4.0 s down. */
export const SIREN_UP = 4
export const SIREN_TURN = 0.5
export const SIREN_SEC = 8.5
/** The siren's glide: 7 of its 9 semitones in 3.96 s (FACTS 75). */
export const SIREN_RATE = 7 / (SIREN_UP - JUMP_SEC)

/** Step 1's note and the four words' notes in each gear, seconds, and Register's gap between them. */
export const NOTE_SEC = 2
export const PAIR_GAP = 0.3

/** Step 4: five slides of 3.9 s, 0.6 s apart (FACTS 79). */
export const SLIDE_SEC = 3.9
export const SLIDE_GAP = 0.6
export const SMOOTHER_JUMPS = [2, 1.5, 1, 0.5, 0.25] as const
export const SMOOTHER_XFADES = [0.04, 0.12, 0.25, 0.4, 0.6] as const
export const SMOOTHER_SEC =
  SMOOTHER_JUMPS.length * SLIDE_SEC + (SMOOTHER_JUMPS.length - 1) * SLIDE_GAP

/** Step 5's figure: six notes of 0.4 s and the last of 1.2 s (FACTS 80). */
export const FIGURE_NOTE = 0.4
export const FIGURE_LAST = 1.2
export const FIGURE_SEC = 6 * FIGURE_NOTE + FIGURE_LAST

/** A silence's fade, in and out, seconds. */
const FADE = 0.04

/** A point of a line in gears: seconds, its note, the lower gear's share (1 to 0) and its overall level (1 to 0). */
export interface GearPoint {
  readonly t: number
  readonly midi: number
  readonly share: number
  readonly level: number
}

export type GearLine = readonly GearPoint[]

/** A knot of a path: seconds, and its value there. */
type Knot = readonly [number, number]

/** A path's value at `t`, straight between its knots, held beyond its ends. */
function at(path: readonly Knot[], t: number): number {
  if (t <= path[0][0]) return path[0][1]
  for (let i = 1; i < path.length; i++) {
    const [t1, v1] = path[i]
    if (t <= t1) {
      const [t0, v0] = path[i - 1]
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return path[path.length - 1][1]
}

/** The times a path changes between: each pair of knots whose values differ. */
const changes = (path: readonly Knot[]): [number, number][] =>
  path
    .slice(1)
    .map((k, i): [number, number, boolean] => [
      path[i][0],
      k[0],
      k[1] !== path[i][1],
    ])
    .filter(([, , moves]) => moves)
    .map(([t0, t1]) => [t0, t1])

/**
 * A line from its three paths: a point at every knot, and every 10 ms
 * wherever the share or the level moves.
 */
export function buildLine(
  pitch: readonly Knot[],
  share: readonly Knot[],
  level: readonly Knot[] = [[0, 1]],
): GearLine {
  // keyed to the microsecond, so a knot and a crossfade's point on it are one
  const times = new Map<number, number>()
  const add = (t: number): void => {
    const key = Math.round(t * 1e6)
    if (!times.has(key)) times.set(key, t)
  }
  for (const path of [pitch, share, level]) for (const [t] of path) add(t)
  for (const [t0, t1] of [...changes(share), ...changes(level)])
    for (let t = t0; t < t1 - 1e-9; t += XFADE_STEP) add(t)
  const end = pitch[pitch.length - 1][0]
  return [...times.values()]
    .filter((t) => t >= 0 && t <= end + 1e-9)
    .sort((a, b) => a - b)
    .map((t) => ({
      t,
      midi: at(pitch, t),
      share: at(share, t),
      level: at(level, t),
    }))
}

/** A line's length, seconds. */
export const lineLength = (line: GearLine): number =>
  line.length === 0 ? 0 : line[line.length - 1].t

/** Every length of a line doubled, or as `factor` says: Slow (the pitches never change). */
export const stretched = (line: GearLine, factor: number): GearLine =>
  line.map((p) => ({ ...p, t: p.t * factor }))

/** A line from `t0` on, its times counted from there: a play that carries on where it stood. */
export function lineFrom(line: GearLine, t0: number): GearLine {
  if (t0 <= 0 || line.length === 0) return line
  const i = line.findIndex((p) => p.t > t0)
  if (i === -1) return [{ ...line[line.length - 1], t: 0 }]
  const a = line[i - 1]
  const b = line[i]
  const u = (t0 - a.t) / (b.t - a.t)
  const first: GearPoint = {
    t: 0,
    midi: a.midi + (b.midi - a.midi) * u,
    share: a.share + (b.share - a.share) * u,
    level: a.level + (b.level - a.level) * u,
  }
  return [first, ...line.slice(i).map((p) => ({ ...p, t: p.t - t0 }))]
}

/** A line moved `by` seconds along the time area: a slot of the chart. */
export const shifted = (line: GearLine, by: number): GearLine =>
  line.map((p) => ({ ...p, t: p.t + by }))

/** The lowest note of the voice's cold-open siren: Merc's E3, Tavi's D4. */
export const sirenFloor = (v: Voice): number => (v === 'lower' ? N.E3 : N.D4)

/** The note each voice's flips jump from: Merc's G3, Tavi's F4 (FACTS 75). */
export const flipFrom = (v: Voice): number => sirenFloor(v) + 3

/** The cold open's siren in a voice, 8.5 s up and back, flipping at the same notes both ways (FACTS 75). */
export function sirenLine(v: Voice): GearLine {
  const lo = sirenFloor(v)
  const up = 3 / SIREN_RATE
  const back = SIREN_UP + SIREN_TURN + 4 / SIREN_RATE
  return buildLine(
    [
      [0, lo],
      [up, lo + 3],
      [up + JUMP_SEC, lo + 5],
      [SIREN_UP, lo + 9],
      [SIREN_UP + SIREN_TURN, lo + 9],
      [back, lo + 5],
      [back + JUMP_SEC, lo + 3],
      [SIREN_SEC, lo],
    ],
    [
      [0, 1],
      [up, 1],
      [up + JUMP_SEC, 0],
      [back, 0],
      [back + JUMP_SEC, 1],
      [SIREN_SEC, 1],
    ],
  )
}

/** The siren's up half, 4.0 s: Step 2's slide, Step 3's first slide and Flip's play (FACTS 76 to 78). */
export function upHalf(v: Voice): GearLine {
  return sirenLine(v).filter((p) => p.t <= SIREN_UP + 1e-9)
}

/** Step 3's second slide: the switch later, 5 semitones up by 2.829 s (FACTS 78). */
export function laterSlide(v: Voice): GearLine {
  const lo = sirenFloor(v)
  const up = 5 / SIREN_RATE
  return buildLine(
    [
      [0, lo],
      [up, lo + 5],
      [up + JUMP_SEC, lo + 7],
      [SIREN_UP, lo + 9],
    ],
    [
      [0, 1],
      [up, 1],
      [up + JUMP_SEC, 0],
      [SIREN_UP, 0],
    ],
  )
}

/** Step 3's third slide: one gear the whole way, the voice's own, at 2.25 semitones a second (FACTS 78). */
export function oneGearSlide(v: Voice): GearLine {
  const lo = sirenFloor(v)
  const gear = v === 'lower' ? 1 : 0
  return buildLine(
    [
      [0, lo],
      [SIREN_UP, lo + 9],
    ],
    [[0, gear]],
  )
}

/** Step 3's three slides, in order. */
export const threeSlides = (v: Voice): readonly GearLine[] => [
  upHalf(v),
  laterSlide(v),
  oneGearSlide(v),
]

/** The note Step 1 and the four words sing in each gear: G♯3, or F♯4 (FACTS 76). */
export const gearNoteOf = (v: Voice): number => (v === 'lower' ? N.Gs3 : N.Fs4)

/** One note, 2.0 s, all in one gear (1 the lower, 0 the upper). */
export function gearNote(v: Voice, share: 0 | 1): GearLine {
  const m = gearNoteOf(v)
  return buildLine(
    [
      [0, m],
      [NOTE_SEC, m],
    ],
    [[0, share]],
  )
}

/** The four words' Register: the note in the lower gear, 0.3 s of quiet, then in the upper (FACTS 76). */
export function gearPair(v: Voice): GearLine {
  const m = gearNoteOf(v)
  const end = NOTE_SEC * 2 + PAIR_GAP
  return buildLine(
    [
      [0, m],
      [end, m],
    ],
    [
      [0, 1],
      [NOTE_SEC, 1],
      [NOTE_SEC + PAIR_GAP, 0],
      [end, 0],
    ],
    [
      [0, 1],
      [NOTE_SEC - FADE, 1],
      [NOTE_SEC, 0],
      [NOTE_SEC + PAIR_GAP - FADE, 0],
      [NOTE_SEC + PAIR_GAP, 1],
      [end, 1],
    ],
  )
}

/** Where Step 4's slides centre their jump, and their two notes: F3 to B3 round G♯3, or E4 to A4 round F♯4. */
export function smootherNotes(v: Voice): {
  lo: number
  hi: number
  centre: number
} {
  return v === 'lower'
    ? { lo: N.F3, hi: N.B3, centre: N.Gs3 }
    : { lo: N.E4, hi: N.A4, centre: N.Fs4 }
}

/** The jump's two notes in Step 4's slide `k` (0 to 4): its seam. */
export function smootherSeam(v: Voice, k: number): { lo: number; hi: number } {
  const { centre } = smootherNotes(v)
  const j = SMOOTHER_JUMPS[k] ?? JUMP
  return { lo: centre - j / 2, hi: centre + j / 2 }
}

/** How a slide begins and ends inside a sequence: faded in from quiet, faded out to it. */
interface Fades {
  readonly fadeIn?: boolean
  readonly fadeOut?: boolean
}

/**
 * Step 4's slide `k`: a 0.5 s hold, a 1.2 s glide up with its jump, 0.5 s,
 * the glide back with its jump at the same notes, 0.5 s; its crossfade
 * centred on each jump (FACTS 79). Inside Play the five slides it fades in
 * from the quiet before it and out to the quiet after it.
 */
export function smootherSlide(
  v: Voice,
  k: number,
  fades: Fades = {},
): GearLine {
  const { lo, hi } = smootherNotes(v)
  const seam = smootherSeam(v, k)
  const j = seam.hi - seam.lo
  const x = SMOOTHER_XFADES[k] ?? JUMP_SEC
  const rate = (hi - lo - j) / (1.2 - JUMP_SEC)
  const up = 0.5 + (seam.lo - lo) / rate
  const down = 2.2 + (hi - seam.hi) / rate
  const mid = [up + JUMP_SEC / 2, down + JUMP_SEC / 2]
  const level: Knot[] = [
    ...(fades.fadeIn === true
      ? ([
          [0, 0],
          [FADE, 1],
        ] as Knot[])
      : ([[0, 1]] as Knot[])),
    ...(fades.fadeOut === true
      ? ([
          [SLIDE_SEC - FADE, 1],
          [SLIDE_SEC, 0],
        ] as Knot[])
      : ([[SLIDE_SEC, 1]] as Knot[])),
  ]
  return buildLine(
    [
      [0, lo],
      [0.5, lo],
      [up, seam.lo],
      [up + JUMP_SEC, seam.hi],
      [1.7, hi],
      [2.2, hi],
      [down, seam.hi],
      [down + JUMP_SEC, seam.lo],
      [3.4, lo],
      [SLIDE_SEC, lo],
    ],
    [
      [0, 1],
      [mid[0] - x / 2, 1],
      [mid[0] + x / 2, 0],
      [mid[1] - x / 2, 0],
      [mid[1] + x / 2, 1],
      [SLIDE_SEC, 1],
    ],
    level,
  )
}

/** Where slide `k` starts in Play the five slides, seconds. */
export const smootherStart = (k: number): number => k * (SLIDE_SEC + SLIDE_GAP)

/** Play the five slides: each in turn, 0.6 s of quiet between, 21.9 s in all. */
export function smootherRun(v: Voice): GearLine {
  const last = SMOOTHER_JUMPS.length - 1
  return SMOOTHER_JUMPS.flatMap((_, k) =>
    shifted(
      smootherSlide(v, k, { fadeIn: k > 0, fadeOut: k < last }),
      smootherStart(k),
    ),
  )
}

/** Step 5's figure in a voice: G3 C4 B3, G3 E3 G3, C4, or ten semitones up (FACTS 38, 80). */
export function figureNotes(v: Voice): number[] {
  const base = [N.G3, N.C4, N.B3, N.G3, N.E3, N.G3, N.C4]
  return base.map((m) => m + (v === 'lower' ? 0 : 10))
}

/** When each of the figure's notes starts, seconds. */
export const figureStart = (i: number): number => i * FIGURE_NOTE

/** A figure note's gear when flipped on purpose: the lower at or under the seam's foot, the upper above it. */
export const figureShare = (v: Voice, midi: number): 0 | 1 =>
  midi <= flipFrom(v) ? 1 : 0

/** The figure's pitch moves between notes in this long, seconds. */
const STEP_SEC = 0.03

/**
 * Step 5's figure: "Flip on purpose" changes gear abruptly, in a 40 ms
 * crossfade, at each leap across the seam; "Hide the switch" holds both
 * gears at half the sound the whole way (FACTS 80).
 */
export function figureLine(v: Voice, way: 'flip' | 'hide'): GearLine {
  const notes = figureNotes(v)
  const pitch: Knot[] = []
  const share: Knot[] = []
  notes.forEach((m, i) => {
    const t0 = figureStart(i)
    const s = way === 'hide' ? 0.5 : figureShare(v, m)
    if (i === 0) {
      pitch.push([0, m])
      share.push([0, s])
      return
    }
    const prev = notes[i - 1]
    const was = way === 'hide' ? 0.5 : figureShare(v, prev)
    pitch.push([t0 - STEP_SEC / 2, prev], [t0 + STEP_SEC / 2, m])
    if (s !== was) share.push([t0 - JUMP_SEC / 2, was], [t0 + JUMP_SEC / 2, s])
  })
  pitch.push([FIGURE_SEC, notes[notes.length - 1]])
  share.push([FIGURE_SEC, share[share.length - 1][1]])
  return buildLine(pitch, share)
}

/**
 * The figure as the chart draws it: each note a short line at its height,
 * thick or thin by its gear (one width, 4 px, when hidden), with a gap
 * between notes, drawn to `upTo` seconds.
 */
export function figureDrawn(
  v: Voice,
  way: 'flip' | 'hide',
  upTo = Infinity,
): LinePoint[] {
  const out: LinePoint[] = []
  figureNotes(v).forEach((m, i) => {
    const t0 = figureStart(i) + STEP_SEC
    if (t0 > upTo) return
    const end = i === 6 ? FIGURE_SEC : figureStart(i + 1) - STEP_SEC
    const share = way === 'hide' ? 0.5 : figureShare(v, m)
    out.push(
      { t: t0, midi: m, share },
      { t: Math.min(end, upTo), midi: m, share },
      { t: Math.min(end, upTo), midi: null, share },
    )
  })
  return out
}

/** Sing it's siren: one gear, E3 to C♯4 in the lower or E4 to C♯5 in the upper, 8.5 s at 2.25 semitones a second (FACTS 81). */
export function singSirenLine(v: Voice): GearLine {
  const lo = v === 'lower' ? N.E3 : N.E4
  const gear = v === 'lower' ? 1 : 0
  return buildLine(
    [
      [0, lo],
      [SIREN_UP, lo + 9],
      [SIREN_UP + SIREN_TURN, lo + 9],
      [SIREN_SEC, lo],
    ],
    [[0, gear]],
  )
}

/** The upper gear's level against the lower's, so the two sound equally loud (WEB-SPEC, Audio; tuned by ear). */
export const UPPER_TRIM = 0.75

/** A line's two gears as the kit's contours: the lower's level its share, the upper's the rest, each times the line's level. */
export function gearContours(line: GearLine): {
  lower: ContourPoint[]
  upper: ContourPoint[]
} {
  return {
    lower: line.map((p) => ({
      t: p.t,
      hz: hz(p.midi),
      level: p.share * p.level,
    })),
    upper: line.map((p) => ({
      t: p.t,
      hz: hz(p.midi),
      level: (1 - p.share) * p.level,
    })),
  }
}

/** Whether a gear sounds at all in a line: a gear silent throughout is never built. */
export const sounds = (points: readonly ContourPoint[]): boolean =>
  points.some((p) => (p.level ?? 1) > 0)

/** The line drawn to `upTo` seconds, its share kept for the width; a silence is a gap. */
export function drawn(line: GearLine, upTo = Infinity): LinePoint[] {
  const out: LinePoint[] = []
  for (let i = 0; i < line.length; i++) {
    const p = line[i]
    if (p.t > upTo) {
      const a = line[i - 1]
      if (a !== undefined && upTo > a.t) {
        const u = (upTo - a.t) / (p.t - a.t)
        out.push({
          t: upTo,
          midi: a.midi + (p.midi - a.midi) * u,
          share: a.share + (p.share - a.share) * u,
        })
      }
      break
    }
    out.push({ t: p.t, midi: p.level > 0 ? p.midi : null, share: p.share })
  }
  return out
}

/** Where a line is at `t`: its note and its share, for a head or a scrub's words. */
export function lineAt(
  line: GearLine,
  t: number,
): { midi: number; share: number } {
  const last = line[line.length - 1]
  if (t >= last.t) return { midi: last.midi, share: last.share }
  const pts = drawn(line, t)
  const p = pts[pts.length - 1]
  return { midi: p.midi ?? line[0].midi, share: p.share ?? 1 }
}

/** A note in spoken words: "G 3", "C sharp 4", or a quarter of a semitone off it: never a sign. */
export function spoken(midi: number): string {
  const names = [
    'C',
    'C sharp',
    'D',
    'D sharp',
    'E',
    'F',
    'F sharp',
    'G',
    'G sharp',
    'A',
    'A sharp',
    'B',
  ]
  const m = Math.round(midi)
  return `${names[((m % 12) + 12) % 12]} ${Math.floor(m / 12) - 1}`
}
