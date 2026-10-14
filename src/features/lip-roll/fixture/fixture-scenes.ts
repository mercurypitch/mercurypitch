// ============================================================
// Lip roll's fixtures: storyboard 03-lip-roll, screens 1 to 4, pinned
// ============================================================
//
// ART-FIDELITY.md 3.6, as Ng's: a fixed picture with every element at the
// storyboard's place, so the art is compared and not the pitch layout.
// Hand-written: the L0 measures give the waves and Merc's places
// (lip-l0/geometry/lip-geometry.json), and the ribbons are measured off
// the storyboard's pixels (03-lip-roll.png, screens 2 and 3); each number
// says where it came from.
//
// Where the storyboard and the live room part, the fixture keeps the
// storyboard, as Ng's does, with two exceptions the L0 report settled:
// screen 1's Merc stands at the first wave's root (the storyboard puts
// him where the microphone is, L0 finding 4), and the result's Merc is
// the room's (screen 4's place in the equal crop, bay-layout.ts). Screen
// 2 draws the ribbon's head at 0.60 W, ahead of Merc at 0.28 W; the room
// draws both at the playhead (0.35 W). Screen 3 is the demo's "not like
// this" take (PR 12): the voice holds flat while the crest rises away.

import type { MercState } from '@/lib/merc/constants'
import { WAVE } from '../bay-geometry'
import { MERC_INTRO_X, MERC_SINK_W, waveG } from '../bay-layout'
import { crestX, INTRO_CAMERA } from '../bay-scroll'
import type { TraceSample } from '../bay-view'
import type { LipPhase } from '../lip-machine'
import type { LipSummary } from '../lip-run'

/** The first wave's root in every fixture: C3. */
export const FIXTURE_ROOT = 48

type Ranges = readonly (readonly [number, number])[]

export interface LipFixtureScene {
  readonly phase: LipPhase
  /** World X under the playhead. */
  readonly camera: number
  /** The camera's zoom: 0 the intro's (wave A), 1 the run's (wave B). */
  readonly zoom: number
  /** Each wave's lit ranges, in its u. */
  readonly lit: readonly Ranges[]
  readonly trace: readonly TraceSample[]
  /** Merc: x of the screen (W) and the world y he rides. */
  readonly merc: { readonly x: number; readonly feetY: number }
  readonly mercState: MercState
  /**
   * What he hears: nothing, his own buzz (the intro), or a voice on its
   * way up a wave (6 semitones a second, so `ride` leans him).
   */
  readonly voice: 'silent' | 'hum' | 'rise'
  /** The voice sounds: bubbles and the buzz beside his mouth. */
  readonly voiced: boolean
  readonly chip: string | null
  /** Merc's line, as the room would say it. */
  readonly line: string
  readonly summary: LipSummary | null
}

/** The camera that puts wave k's crest at screen x `crest` (W), at zoom 1. */
const cameraFor = (k: number, crest: number): number =>
  crestX(k) - (crest - 0.35)
/** World X of screen x `x` under camera `camera` (zoom 1). */
const worldX = (camera: number, x: number): number => camera - 0.35 + x
/** The wave's crest line (the path) at world X, wave k. */
const pathY = (k: number, x: number): number =>
  WAVE.rootY - WAVE.h * waveG((x - crestX(k)) / WAVE.a, WAVE.f)

/** A ribbon along the path from screen x `from` to `to` (W). */
function alongPath(
  camera: number,
  from: number,
  to: number,
  filling: boolean,
): TraceSample[] {
  const out: TraceSample[] = []
  const steps = Math.max(2, Math.ceil((to - from) / 0.004))
  for (let i = 0; i <= steps; i++) {
    const x = worldX(camera, from + ((to - from) * i) / steps)
    out.push({ x, y: pathY(0, x), filling, gap: i === 0 })
  }
  return out
}

/** A flat voice at world y `y`, from screen x `from` to `to` (W). */
function flat(
  camera: number,
  from: number,
  to: number,
  y: number,
): TraceSample[] {
  const out: TraceSample[] = []
  const steps = Math.max(2, Math.ceil((to - from) / 0.004))
  for (let i = 0; i <= steps; i++) {
    const x = worldX(camera, from + ((to - from) * i) / steps)
    out.push({ x, y, filling: false, gap: false })
  }
  return out
}

/** u on wave 0 of screen x `x` under `camera`. */
const uOf = (camera: number, x: number): number =>
  (worldX(camera, x) - crestX(0)) / WAVE.a

const NONE: readonly Ranges[] = [[], [], []]

/** Screen 2: the first wave's crest at 0.7927 W (lip-geometry, wave B). */
const MID_CAMERA = cameraFor(0, 0.7927)
/** Screen 3: the crest at 0.7944 W (lip-geometry, wave B). */
const DEMO_CAMERA = cameraFor(0, 0.7944)
/** Screen 2's ribbon head and the lit water's front, by pixel: 0.60 W. */
const MID_HEAD = 0.6
/** Screen 3's amber hold, by pixel: 0.475 to 0.731 W at 1.351 W. */
const DEMO_HOLD = { from: 0.475, to: 0.731, y: 1.351 } as const
/** Screen 4's waves, each lit late: 88% lit (its big number). */
const RESULT_COVERAGE = [0.9, 0.86, 0.88]

export const FIXTURE_SCENES = {
  intro: {
    phase: 'intro',
    camera: INTRO_CAMERA,
    zoom: 0,
    lit: NONE,
    trace: [],
    // The room's place: at the first wave's root (L0 finding 4).
    merc: { x: MERC_INTRO_X, feetY: WAVE.rootY },
    mercState: 'hum',
    voice: 'hum',
    voiced: true,
    chip: null,
    line: 'Roll your lips, brrr, and ride the wave up to C4 and back.',
    summary: null,
  },
  'mid-take': {
    phase: 'run',
    camera: MID_CAMERA,
    zoom: 1,
    lit: [[[-1, uOf(MID_CAMERA, MID_HEAD)]], [], []],
    trace: alongPath(MID_CAMERA, 0, MID_HEAD, true),
    // lip-geometry merc 2: centre 0.277 W, feet 1.5578 W.
    merc: { x: 0.277, feetY: 1.5578 - MERC_SINK_W },
    mercState: 'ride',
    voice: 'rise',
    voiced: true,
    chip: 'Wave 1 of 3',
    line: '',
    summary: null,
  },
  'demo-off': {
    phase: 'run',
    camera: DEMO_CAMERA,
    zoom: 1,
    lit: [[[-1, uOf(DEMO_CAMERA, DEMO_HOLD.from)]], [], []],
    trace: [
      ...alongPath(DEMO_CAMERA, 0, DEMO_HOLD.from, true),
      ...flat(DEMO_CAMERA, DEMO_HOLD.from, DEMO_HOLD.to, DEMO_HOLD.y),
    ],
    // lip-geometry merc 3: centre 0.179 W, feet 1.6033 W.
    merc: { x: 0.179, feetY: 1.6033 - MERC_SINK_W },
    mercState: 'ride',
    voice: 'silent',
    voiced: true,
    chip: null,
    line: 'Stop short and the top stays dark.',
    summary: null,
  },
  result: {
    phase: 'result',
    camera: INTRO_CAMERA,
    zoom: 0,
    lit: RESULT_COVERAGE.map((c) => [[-1 + 2 * (1 - c), 1]] as const),
    trace: [],
    merc: { x: MERC_INTRO_X, feetY: WAVE.rootY },
    mercState: 'idle',
    voice: 'silent',
    voiced: false,
    chip: null,
    // Screen 4 shows no line.
    line: '',
    summary: {
      litPct: 88,
      waves: RESULT_COVERAGE,
      wavesLit: 3,
      jumps: 0,
      jumpNote: null,
      breaks: 0,
      breakNote: null,
      tops: null,
      waveCount: 3,
      improved: false,
      previousBest: null,
      levelName: 'Singer',
    },
  },
} satisfies Record<string, LipFixtureScene>

export type LipFixtureName = keyof typeof FIXTURE_SCENES
