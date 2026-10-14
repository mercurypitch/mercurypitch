// ============================================================
// Ng slides' fixtures: storyboard 02-ng-slides, screens 1 to 4, pinned
// ============================================================
//
// ART-FIDELITY.md 3.6, as Echo's: a fixed picture with every element at
// the storyboard's place, so the art is compared and not the pitch
// layout. Hand-written, unlike Echo's: the N0 measures give the bridge
// (ng-geometry.json, ng-storyboard-geometry.json), and the rest is read
// off the storyboard's screens by eye where N0 did not measure it; each
// such number says so.
//
// Where the storyboard and the live room part, the fixture keeps the
// storyboard. Screen 2 draws the ribbon's head and the lit front at 0.55
// to 0.58 W, ahead of Merc at 0.37 W; the room draws both at the playhead
// (0.35 W, DESIGN-ng-slides.md 1). Screen 3 is the demo's "not like this"
// take, drawn across the whole arch; the room draws a voice only up to
// the playhead, and the demo itself is PR 9.

import type { MercState } from '@/lib/merc/constants'
import { ARCH, STORYBOARD_ASPECT } from '../bridge-geometry'
import { archG, MERC_INTRO_X } from '../bridge-layout'
import { apexX, INTRO_CAMERA } from '../bridge-scroll'
import type { TraceSample } from '../bridge-view'
import type { NgPhase } from '../ng-machine'
import type { NgSummary } from '../ng-run'

/** The first slide's root in every fixture: A2, as screen 1 names it. */
export const FIXTURE_ROOT = 45

type Ranges = readonly (readonly [number, number])[]

export interface NgFixtureScene {
  readonly phase: NgPhase
  /** World X under the playhead. */
  readonly camera: number
  /** Each arch's lit ranges, in its u. */
  readonly lit: readonly Ranges[]
  readonly trace: readonly TraceSample[]
  /** Merc's feet: x of the screen (W) and storyboard y (W). */
  readonly merc: { readonly x: number; readonly feetY: number }
  readonly mercState: MercState
  /**
   * What he hears: nothing, his own hum (the intro), or a voice on its way
   * up a slide (5 semitones a second, so `ride` leans him as on screen 2).
   */
  readonly voice: 'silent' | 'hum' | 'rise'
  readonly chip: string | null
  /** Merc's line moment's first line, as the room would say it. */
  readonly line: string
  /** The note names on the first arch. */
  readonly names: boolean
  readonly summary: NgSummary | null
}

const H = STORYBOARD_ASPECT
/** The camera that puts arch k's apex at screen x `apex` (W). */
const cameraFor = (k: number, apex: number): number => apexX(k) - (apex - 0.35)
/** World X of screen x `x` under camera `camera`. */
const worldX = (camera: number, x: number): number => camera - 0.35 + x
/** The fitted rim's height at world X on arch k (screen 1's arch). */
const rimY = (k: number, x: number): number =>
  ARCH.deckY - ARCH.h * archG((x - apexX(k)) / ARCH.a, ARCH.f)

/** A ribbon along the fitted rim (and the deck between arches). */
function alongRim(from: number, to: number, filling: boolean): TraceSample[] {
  const out: TraceSample[] = []
  const steps = Math.max(2, Math.ceil((to - from) / 0.004))
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps
    const k = Math.round(x / apexX(1))
    out.push({ x, y: rimY(k, x), filling, gap: i === 0 })
  }
  return out
}

/** A stepped voice: flat stretches at storyboard heights (fractions of H). */
function stepped(
  camera: number,
  steps: readonly (readonly [number, number, number])[],
): TraceSample[] {
  const out: TraceSample[] = []
  for (const [from, to, yH] of steps) {
    for (const x of [from, (from + to) / 2, to]) {
      out.push({
        x: worldX(camera, x),
        y: yH * H,
        filling: false,
        gap: out.length === 0,
      })
    }
  }
  return out
}

const NONE: readonly Ranges[] = [[], [], [], [], []]

/** Screen 2: arch 2's apex at 0.6601 W (ng-geometry storyboard_variation). */
const MID_CAMERA = cameraFor(1, 0.6601)
/** Screen 3: the arch's apex at 0.6824 W (ng-geometry storyboard_variation). */
const DEMO_CAMERA = cameraFor(0, 0.6824)
/** Screen 4's coverages: 92% lit (its big number), each arch lit late. */
const RESULT_COVERAGE = [0.95, 0.9, 0.88, 0.94, 0.93]

export const FIXTURE_SCENES = {
  intro: {
    phase: 'intro',
    camera: INTRO_CAMERA,
    lit: NONE,
    trace: [],
    // Merc stands at the arch's left foot, on the pier (the room's place).
    merc: { x: MERC_INTRO_X, feetY: ARCH.deckY },
    mercState: 'hum',
    voice: 'hum',
    chip: null,
    line: 'Hum ng, like the end of sing. Slide up to E3 and back.',
    names: true,
    summary: null,
  },
  'mid-take': {
    phase: 'run',
    camera: MID_CAMERA,
    // Arch 1 lit through; arch 2 lit to about 0.535 W (by eye, 0.52 to 0.55).
    lit: [
      [[-1, 1]],
      [[-1, (worldX(MID_CAMERA, 0.535) - apexX(1)) / ARCH.a]],
      [],
      [],
      [],
    ],
    // By eye: the ribbon runs on the line from the left edge to 0.58 W.
    trace: alongRim(worldX(MID_CAMERA, 0), worldX(MID_CAMERA, 0.58), true),
    // By eye: Merc's centre at 0.37 W, his feet on the rim (0.515 H).
    merc: { x: 0.37, feetY: rimY(1, worldX(MID_CAMERA, 0.37)) },
    mercState: 'ride',
    voice: 'rise',
    chip: 'Slide 2 of 5',
    line: '',
    names: false,
    summary: null,
  },
  'demo-off': {
    phase: 'run',
    camera: DEMO_CAMERA,
    // By eye: a short lit patch at the foot, and one where a step met the line.
    lit: [
      [
        [-1, -0.93],
        [-0.42, -0.37],
      ],
      [],
      [],
      [],
      [],
    ],
    // By eye: the amber steps, x from and to (W) at a height (H).
    trace: stepped(DEMO_CAMERA, [
      [0.33, 0.47, 0.505],
      [0.47, 0.735, 0.445],
      [0.735, 0.92, 0.48],
      [0.92, 1.0, 0.515],
    ]),
    merc: { x: 0.25, feetY: ARCH.deckY },
    mercState: 'listen',
    voice: 'silent',
    chip: null,
    line: '',
    names: false,
    summary: null,
  },
  result: {
    phase: 'result',
    camera: INTRO_CAMERA,
    lit: RESULT_COVERAGE.map((c) => [[-1 + 2 * (1 - c), 1]] as const),
    trace: [],
    merc: { x: 0.89, feetY: ARCH.deckY },
    mercState: 'idle',
    voice: 'silent',
    chip: null,
    line: 'Five slides, no jumps.',
    names: false,
    summary: {
      litPct: 92,
      arches: RESULT_COVERAGE,
      archesLit: 5,
      jumps: 0,
      jumpNote: null,
      breaks: 0,
      tops: null,
      slides: 5,
      improved: false,
      previousBest: null,
      levelName: 'Singer',
    },
  },
} satisfies Record<string, NgFixtureScene>

export type NgFixtureName = keyof typeof FIXTURE_SCENES
