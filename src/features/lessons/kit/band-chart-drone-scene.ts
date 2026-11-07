// ============================================================
// Band chart drone scene — the drone, the band, the beads, the ticks and the top notes, as data
// ============================================================
//
// The scene a chart given band-chart-drone.ts's painter draws (BandScene
// `drone`), Lesson 24's drone chart (WEB-SPEC, Look; Toys 1, 2 and 6; What
// the kit and the app still need, item 9). Its own module, as the wave's
// scene is, so the chart can name it without importing the painter.
//
// Amber is the note being tuned to. In the hero and Steps 1 and 2 the drone
// itself is the amber band, 15 cents either side, labelled "drone · A3": a
// drawing of one held note, with no tolerance and no edges named. In Step 3
// and in Sing it the amber band is Lesson 5's, 35 cents either side of the
// note to tune or to sing, and the drone is a chrome line, or a chrome
// marker pinned to the chart's foot where it lies below the window; in Step
// 4 no band is drawn. The top notes are chrome and thin, at their true
// pitch, drawn from the schedules their plays sound as the wave's stretches
// are (band-chart-wave-scene.ts): a level note, Step 4's wave, and the
// cold open's slide, whose exponential glide is a straight slope in cents.
// The piano's note is a solid chrome tick labelled "piano", the pure one a
// dashed ink tick labelled "pure"; Lesson 10's beads are chrome, the
// sounding one ink and lit (FACTS 29). A beat is brightness, never a new
// colour: the page works it out from the same schedules each frame
// (drone-beats.ts, `brightness`) and writes it here, its slow part and its
// fast part apart.

import type { WaveLine, WaveStretch } from './band-chart-wave-scene'
import type { Brightness, SlideParts } from './drone-beats'

/** The drone: where it is, cents from the chart's note, how it is drawn, and its label. */
export interface DroneMark {
  readonly c: number
  /**
   * 'band': the amber band, 15 cents either side (the hero, Steps 1 and 2);
   * 'line': a chrome line, pinned to the chart's foot with an arrow where
   * it lies below the window (Step 3 on, and Sing it).
   */
  readonly as: 'band' | 'line'
  /** "drone · A3", "drone × 2 · 440 Hz", "drone". */
  readonly label: string
}

/** A tick at the chart's right edge: the piano's note, solid chrome; the pure one, dashed ink. */
export interface DroneTick {
  readonly c: number
  readonly kind: 'piano' | 'pure'
}

/** One of Lesson 10's beads at the chart's left edge. */
export interface DroneBead {
  readonly c: number
  /** "do", "mi", "so". */
  readonly name: string
  /** Sounding now: ink and lit. */
  readonly lit: boolean
}

/** What the drone chart shows this frame, on a chart given its painter. */
export interface DroneScene {
  readonly drone: DroneMark
  /**
   * Lesson 5's band, 35 cents either side of the note to tune or to sing
   * (Step 3, Sing it), and whether Merc's steady line marks its centre;
   * null for none.
   */
  readonly band: { readonly c: number; readonly line: boolean } | null
  readonly ticks: readonly DroneTick[]
  readonly beads: readonly DroneBead[]
  /** The top notes' lines, from their schedules, each drawn up to its `upTo`. */
  readonly tops: readonly WaveLine[]
  /** How bright the beats are now; null while nothing sounds, the figure at rest. */
  readonly bright: Brightness | null
}

/** The drone chart's colourings, which the figure's spoken summary follows (WEB-SPEC, Toys 2). */
export type DroneColours = 'drone-band' | 'note-band' | 'no-band'

/** Which colouring a scene draws: the drone as the amber band, a band on the note, or no band. */
export function coloursOf(s: DroneScene): DroneColours {
  if (s.drone.as === 'band') return 'drone-band'
  return s.band === null ? 'no-band' : 'note-band'
}

/** The line the figure's spoken summary adds when the colours change, or null when they do not (Lesson 24 FACTS 40). */
export function colourLine(
  from: DroneColours,
  to: DroneColours,
): string | null {
  if (from === to) return null
  if (to === 'note-band')
    return "The amber band is now mi's; the drone is the chrome line below."
  if (to === 'no-band')
    return 'No band now: the top note is the chrome line, the drone pinned below.'
  return 'The amber band is the drone again.'
}

/** Cents of `hz` above `ref` (below it when negative). */
export const centsAbove = (hz: number, ref: number): number =>
  1200 * Math.log2(hz / ref)

/** A note held at `hz` from `from` to `to` seconds on the window's clock, in cents from `ref`. */
export const levelStretch = (
  hz: number,
  ref: number,
  from: number,
  to: number,
): WaveStretch => ({ kind: 'level', from, to, c: centsAbove(hz, ref) })

/**
 * The cold open's slide on the window's clock from `at`, in cents from
 * `ref`: its first note held, its glide, a straight slope in cents since it
 * is exponential in hertz (a stretch with no swing whose middle drifts),
 * then its last note held (Lesson 24 FACTS 44).
 */
export function slideStretches(
  p: SlideParts,
  ref: number,
  at = 0,
): WaveStretch[] {
  const a = centsAbove(p.from, ref)
  const b = centsAbove(p.to, ref)
  const glide = at + p.hold
  const after = glide + p.glide
  return [
    { kind: 'level', from: at, to: glide, c: a },
    {
      kind: 'wave',
      from: glide,
      to: after,
      rate: 0,
      extent: 0,
      growIn: 0,
      base: a,
      drift: (b - a) / p.glide,
    },
    { kind: 'level', from: after, to: after + p.after, c: b },
  ]
}
