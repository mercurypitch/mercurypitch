// ============================================================
// Lesson 24 drone picture — what the drone chart shows, state by state
// ============================================================
//
// The scenes the kit's drone painter draws (kit/band-chart-drone.ts) for
// the steps' figure and free play (WEB-SPEC, Toys 2) and the hero (Toys
// 1): pure, from the state, the controls' settings, the choices made and
// the play sounding, so the toy only writes what this works out.
//
// Each state has its own window. In Steps 1 and 2 the drone is the amber
// band (Step 1's octave view marks its second harmonic, an octave up); in
// Step 3 the amber band is Lesson 5's on mi and the drone a chrome line;
// in Step 4 there is no band and the drone is pinned below. A state waits
// for the choices that would answer: before the cold open's choice every
// state draws the drone's band alone, as Steps 3 and 4 do until Step 2's
// choice; Step 2 shows its beads at once, its pure ticks only from its own
// choice, since they mark where the harmonics meet (FACTS 46). A play's
// lines draw from its schedule as far as it has sounded, whole at once
// under reduced motion, and its brightness follows the envelope of the
// harmonics that nearly meet, held still under reduced motion; once it
// ends, its lines stay as they last drew and nothing glows.

import type { DroneBead, DroneMark, DroneScene, DroneTick, } from '@/features/lessons/kit/band-chart-drone-scene'
import { centsAbove, levelStretch, slideStretches, } from '@/features/lessons/kit/band-chart-drone-scene'
import type { WaveLine, WaveStretch, } from '@/features/lessons/kit/band-chart-wave-scene'
import { brightness } from '@/features/lessons/kit/drone-beats'
import { hz } from '@/features/lessons/kit/notes'
import type { Play, PlayKey, PlayNote, Tuning } from './sounds'
import { DRONE_HZ, PIANO, PURE, schedulesOf, WIDE_WAVE } from './sounds'

export type DroneState = 1 | 2 | 3 | 4

/** A window: its note, MIDI, and cents from it to the chart's foot and top. */
export interface View {
  readonly target: number
  readonly span: readonly [number, number]
}

/** Each state's window (WEB-SPEC, Toys 2). */
export const VIEWS: Readonly<Record<DroneState, View>> = {
  1: { target: 57, span: [-40, 40] },
  2: { target: 57, span: [-50, 760] },
  3: { target: 61, span: [-440, 60] },
  4: { target: 64, span: [-80, 80] },
}
/** Step 1's octave view: the window up an octave, on the drone's second harmonic. */
export const OCTAVE_VIEW: View = { target: 69, span: [-40, 40] }
/** The hero's window: 20 cents under A3 to 45 over it (Toys 1). */
export const HERO_VIEW: View = { target: 57, span: [-20, 45] }

/** The controls' settings, which the stills follow. */
export interface Settings {
  /** Step 1's top note, Hz: 216 to 224, or 432 to 448 in the octave view. */
  readonly top: number
  readonly octave: boolean
  readonly tuning: Tuning
  /** Step 3's mi, cents from the piano's. */
  readonly mi: number
}

export const START: Settings = {
  top: 224,
  octave: false,
  tuning: 'piano',
  mi: 0,
}

/** The choices made: the cold open's, then Step 2's. */
export interface Choices {
  readonly cold: boolean
  readonly step2: boolean
}

/** What a state shows before the choices that would answer it: the drone's band alone. */
export const heldBack = (n: DroneState, c: Choices): boolean =>
  !c.cold || (n >= 3 && !c.step2)

/** The window a state draws on: Step 1's octave view when its switch is on; Step 1's own while held back. */
export function viewOf(n: DroneState, s: Settings, c: Choices): View {
  if (heldBack(n, c)) return VIEWS[1]
  if (n === 1 && s.octave) return OCTAVE_VIEW
  return VIEWS[n]
}

const refHz = (v: View): number => hz(v.target)

/** The drone as each state draws it: the amber band, a chrome line, or pinned below. */
export function droneOf(n: DroneState, s: Settings, v: View): DroneMark {
  const c = centsAbove(DRONE_HZ, refHz(v))
  if (n <= 2) {
    // the octave view's band is the drone's second harmonic, at the window's note
    if (n === 1 && s.octave)
      return { c: 0, as: 'band', label: 'drone × 2 · 440 Hz' }
    return { c, as: 'band', label: 'drone · A3' }
  }
  return { c, as: 'line', label: n === 3 ? 'drone' : 'drone · A3' }
}

/** Mi and so in the switch's tuning. */
const tuned = (t: Tuning): { readonly mi: number; readonly so: number } =>
  t === 'pure' ? PURE : PIANO

/** Step 3's mi, `cents` from the piano's, Hz. */
export const miHz = (cents: number): number => PIANO.mi * 2 ** (cents / 1200)

/** The ticks a state shows: Step 2's pure ones from its choice; Step 3's piano and pure mi; Step 4's piano so. */
function ticksOf(n: DroneState, c: Choices, v: View): DroneTick[] {
  const r = refHz(v)
  if (n === 2)
    return c.step2
      ? [
          { c: centsAbove(PURE.mi, r), kind: 'pure' },
          { c: centsAbove(PURE.so, r), kind: 'pure' },
        ]
      : []
  if (n === 3)
    return [
      { c: 0, kind: 'piano' },
      { c: centsAbove(PURE.mi, r), kind: 'pure' },
    ]
  if (n === 4) return [{ c: 0, kind: 'piano' }]
  return []
}

/** The beads that sound in a play: do under every play (it is the drone), and mi or so where the play sets them. */
export function litOf(key: PlayKey | null): readonly string[] {
  if (key === null) return []
  if (key === 'mi' || key === 'third') return ['do', 'mi']
  if (key === 'so' || key === 'fifth') return ['do', 'so']
  if (key === 'chord') return ['do', 'mi', 'so']
  return ['do']
}

/** Step 2's beads, do, mi and so on A3, in the switch's tuning. */
function beadsOf(s: Settings, v: View, lit: readonly string[]): DroneBead[] {
  const r = refHz(v)
  const t = tuned(s.tuning)
  return [
    { c: centsAbove(DRONE_HZ, r), name: 'do', lit: lit.includes('do') },
    { c: centsAbove(t.mi, r), name: 'mi', lit: lit.includes('mi') },
    { c: centsAbove(t.so, r), name: 'so', lit: lit.includes('so') },
  ]
}

/** A level line across the whole window, at `f` Hz. */
const across = (f: number, v: View, window: number): WaveLine => ({
  stretches: [levelStretch(f, refHz(v), 0, window)],
  upTo: window,
})

/** The state's still: its band, ticks and beads, and the top note where the state sets one at rest. */
export function stillOf(
  n: DroneState,
  s: Settings,
  c: Choices,
  window: number,
): DroneScene {
  if (heldBack(n, c))
    return {
      drone: droneOf(1, START, VIEWS[1]),
      band: null,
      ticks: [],
      beads: [],
      tops: [],
      bright: null,
    }
  const v = viewOf(n, s, c)
  const tops: WaveLine[] = []
  if (n === 1) tops.push(across(s.top, v, window))
  if (n === 3) tops.push(across(miHz(s.mi), v, window))
  if (n === 4) tops.push(across(PIANO.so, v, window))
  return {
    drone: droneOf(n, s, v),
    band: n === 3 ? { c: 0, line: false } : null,
    ticks: ticksOf(n, c, v),
    beads: n === 2 ? beadsOf(s, v, []) : [],
    tops,
    bright: null,
  }
}

/** A note's line on the window's clock, in cents from the window's note. */
export function stretchesOf(
  note: PlayNote,
  sec: number,
  v: View,
): WaveStretch[] {
  const r = refHz(v)
  if (note.kind === 'slide') return slideStretches(note.parts, r)
  if (note.kind === 'wave')
    return [
      {
        kind: 'wave',
        from: 0,
        to: sec,
        ...WIDE_WAVE,
        base: centsAbove(note.hz, r),
      },
    ]
  return [levelStretch(note.hz, r, 0, sec)]
}

/** A play as it stands `t` seconds in: its lines drawn that far, or whole under reduced motion, and its brightness while it sounds. */
export interface PlayMoment {
  readonly key: PlayKey | null
  readonly play: Play
  /** Seconds since it started; at its length or more once it has ended. */
  readonly t: number
  /** Still sounding: its brightness shows. */
  readonly sounding: boolean
  readonly reduced: boolean
}

/** The state's scene during a play, or after it as it last drew. */
export function playOf(
  n: DroneState,
  s: Settings,
  c: Choices,
  m: PlayMoment,
): DroneScene {
  const still = stillOf(n, s, c, m.play.sec)
  const v = viewOf(n, s, c)
  const upTo = m.reduced ? m.play.sec : Math.min(m.t, m.play.sec)
  const tops = m.play.notes.map((note) => ({
    stretches: stretchesOf(note, m.play.sec, v),
    upTo,
  }))
  let bright: DroneScene['bright'] = null
  if (m.sounding)
    bright = m.reduced
      ? { slow: null, fast: null }
      : brightness(schedulesOf(m.play), Math.min(m.t, m.play.sec))
  return {
    ...still,
    beads: n === 2 ? beadsOf(s, v, m.sounding ? litOf(m.key) : []) : [],
    tops,
    bright,
  }
}
