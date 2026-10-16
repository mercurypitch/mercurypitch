// ============================================================
// The Lip roll demo's script: Merc's two waves, frame by frame
// ============================================================
//
// "How it works" for Lip roll (DESIGN-lip-roll.md 4): Merc buzzes one wave
// up an octave and back, twice, through the room's own glide engine.
//
//   take 1, not like this   he buzzes up the wave only five semitones and
//                           holds there while the crest rises away from
//                           him: the engine reads him off the path, and
//                           the top stays dark. When the wave comes back
//                           down to him he rides it again, and on the way
//                           down the buzz stops for half a second: `break`,
//                           and the light stops with it
//   take 2, like this       he rides the crest a breath behind it, all the
//                           way up, turns at the top and comes back down:
//                           the wave lights from end to end
//
// One wave a take, at Learning's timing (the designs' Beginner: 2.4 s up,
// 0.4 s at the top, 2.4 s down), the level a first visit starts at, with
// the room's own count-in before it: the root's tone, then a breath while
// the bay rolls in. Merc's voice moves at the wave's own pace in both
// takes; nothing is played fast, so the engine's clock (frame.t) and the
// screen's and the sound's are one.
//
// Learning does not judge the top, so its engine never fires `top`. The
// demo's rules are Learning's with the top checked as Pro checks it
// (DEMO_PRESET): the top check changes no coverage, no break and no jump,
// and it lets the "Turn at the top." tooltip wait for the engine's own
// `top`, as every other tooltip waits for its event.
//
// The camera follows the voice as a run's does, then slows to a stand
// (DEMO_HOLD) so the take's one wave stays whole on the screen while its
// tooltips are read: the dark top and the break of take 1, the lit wave
// of take 2. Merc and the voice ride on across the screen.
//
// Pure and seeded: the same root always gives the same frames, events and
// timings. A take's clock is the room's capture window: it reads zero as
// the count-in starts, and the path's clock is it less the count-in. The
// room plays these frames through its own take (room-kit glide-take.ts,
// by the demo's scripted take), so every tooltip is cued by a moment that
// really happened there, and the tests replay the same frames through
// tickGlide to prove what each tooltip says.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, DemoVoicePoint, } from '@/components/demo-kit/demo-plan'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { createGlideState, tickGlide } from '@/lib/glide/glide-engine'
import type { GlidePath } from '@/lib/glide/glide-path'
import { LIP_ROLL_SEMITONES, targetAt } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { CameraHold } from '../bay-scroll'
import type { LipPlan } from '../lip-run'
import { planLipRun } from '../lip-run'
import type { LipDemoMark } from '../scripted-take'

export type { DemoTakeId, DemoVoicePoint }

export type { LipDemoMark }

export type DemoEvent = KitDemoEvent<LipDemoMark>

/** The level Merc buzzes at, whatever the singer's own. */
export const DEMO_LEVEL: GlideLevelId = 'learning'

/**
 * Learning's rules, with the top checked as Pro checks it, so the engine
 * fires `top` for the tooltip that explains the turn.
 */
export const DEMO_PRESET: GlidePreset = {
  ...LIP_ROLL_LEVELS[DEMO_LEVEL],
  top: LIP_ROLL_LEVELS.professional.top,
}

/** How far take 1 gets up the wave, cents over the root: five semitones. */
export const STOP_SHORT_CENTS = 500
/** Take 1's buzz stops on the way down, path seconds, from and to. */
export const OFF_GAP = { from: 4.4, to: 4.9 } as const
/** Both takes trail the crest by this much, s: well inside Learning's lag. */
export const RIDE_LAG_SEC = 0.08
/**
 * The camera's stand, path seconds (bay-scroll.ts holdCamera): it slows
 * from before the top and stands just after the voice turns, with the
 * crest at 0.39 of the screen's width, so the whole wave and Merc at its
 * far foot stay on the screen while the last tooltips are read.
 */
export const DEMO_HOLD: CameraHold = { from: 1.6, to: 3.1 }
/** Each run of buzzing opens from this far under its note, cents. */
const ATTACK_CENTS = -25
const ATTACK_SEC = 0.08

const FRAME_SECONDS = 1 / 60
const VOICE_STEP = 0.025
const CONF = 0.92
const SILENT_RMS = 0.001
/** Merc's buzz, a little under a sung note's loudness. */
const BUZZ_LEVEL = 0.7
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2

/** What Merc buzzes at a path time: cents above the root, and its onset. */
interface Buzz {
  readonly cents: number
  /** When this run of buzzing began, path seconds. */
  readonly onset: number
}

/** A take's buzz: path seconds to cents above the root, null in silence. */
type BuzzScript = (tau: number, path: GlidePath) => Buzz | null

/** The path's note at `tau`, cents above the root. */
function pathCents(path: GlidePath, tau: number): number {
  const root = path.arches[0].rootMidi
  return ((targetAt(path, tau) ?? root) - root) * 100
}

/** The crest a breath behind: where a voice riding it is at `tau`. */
function ridden(path: GlidePath, tau: number): number {
  return pathCents(path, Math.max(path.arches[0].start, tau - RIDE_LAG_SEC))
}

/** The opening scoop of a run of buzzing, cents under its note. */
const attack = (tau: number, onset: number): number => {
  const k = Math.min(1, Math.max(0, (tau - onset) / ATTACK_SEC))
  return ATTACK_CENTS * (1 - k)
}

/**
 * Take 1: up the crest to five semitones, held there while the crest goes
 * over the top and comes back down to him, then down with it; the buzz
 * stops for half a second on the way.
 */
const shortBuzz: BuzzScript = (tau, path) => {
  const wave = path.arches[0]
  if (tau < wave.start || tau >= wave.landingEnd) return null
  if (tau >= OFF_GAP.from && tau < OFF_GAP.to) return null
  const onset = tau < OFF_GAP.from ? wave.start : OFF_GAP.to
  const cents = Math.min(ridden(path, tau), STOP_SHORT_CENTS)
  return { cents: cents + attack(tau, onset), onset }
}

/** Take 2: the crest itself, a breath behind it, from the root to the landing. */
const fullBuzz: BuzzScript = (tau, path) => {
  const wave = path.arches[0]
  if (tau < wave.start || tau >= wave.landingEnd) return null
  return {
    cents: ridden(path, tau) + attack(tau, wave.start),
    onset: wave.start,
  }
}

/** A slow, seeded wander of a few cents: a voice is never a sine. */
function wanderFor(seed: number): (t: number) => number {
  const rand = seeded(seed)
  const parts = [1.3, 0.8, 0.5].map((amp) => ({
    amp,
    hz: 0.25 + rand() * 0.55,
    phase: rand() * Math.PI * 2,
  }))
  return (t) =>
    parts.reduce(
      (sum, p) => sum + p.amp * Math.sin(2 * Math.PI * p.hz * t + p.phase),
      0,
    )
}

/** Merc's 0..1 loudness as an RMS level (the inverse of levelFromRms). */
function rmsForLevel(level: number): number {
  return Math.pow(10, (level * 40 - 50) / 20)
}

/** One of Merc's waves on a root (the demo kit's shape, demo-plan.ts). */
export interface LipDemoTake extends DemoTakeShape<LipDemoMark> {
  /** The root, MIDI: the wave starts and ends on it. */
  readonly root: number
  /** The room's plan for the take: one wave, its count-in. */
  readonly plan: LipPlan
  /** The rules it is sung under (DEMO_PRESET). */
  readonly preset: GlidePreset
  /** Where the room's camera stands (DEMO_HOLD). */
  readonly hold: CameraHold
  /** The wave's coverage at its end, 0..1, as the engine heard it. */
  readonly coverage: number
}

/** The room's plan for one demo wave on `root`, up an octave. */
export function demoPlan(root: number): LipPlan {
  return planLipRun(
    { roots: [root], semitones: LIP_ROLL_SEMITONES, source: 'voiceprint' },
    DEMO_PRESET,
  )
}

/** The two clocks of the demo kit, here one and the same. */
const ONE_CLOCK = {
  engineAt: (wall: number): number => wall,
  wallAt: (engine: number): number => engine,
} as const

const OFF_SEED = 0x11b0
const ON_SEED = 0x11b1

function buildTake(
  id: DemoTakeId,
  root: number,
  buzz: BuzzScript,
  seed: number,
): LipDemoTake {
  const plan = demoPlan(root)
  const { path, countIn } = plan
  const wander = wanderFor(seed)
  const grain = seeded(seed + 7)
  const state = createGlideState(path)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = []
  let coverage = 0
  for (let i = 0; !state.ended; i++) {
    const t = i * FRAME_SECONDS
    const tau = t - countIn
    const sung = buzz(tau, path)
    let frame: PitchFrame = { t, f0: 0, conf: 0, rms: SILENT_RMS }
    if (sung !== null) {
      const jitter = (grain() - 0.5 + (grain() - 0.5)) * JITTER_CENTS
      const cents = sung.cents + wander(t) + jitter
      frame = {
        t,
        f0: midiToFrequency(root + cents / 100),
        conf: CONF,
        rms: rmsForLevel(BUZZ_LEVEL),
      }
    }
    frames.push(frame)
    // The room's take ticks each frame on the path's clock (glide-take.ts).
    tickGlide(state, { ...frame, t: tau }, path, DEMO_PRESET)
    for (const event of state.events) {
      events.push({ type: event.type, at: t })
      if (event.type === 'archEnd') coverage = event.coverage
    }
  }
  const length = frames[frames.length - 1].t
  const points: DemoVoicePoint[] = []
  for (let i = 0; i * VOICE_STEP <= length + 1e-9; i++) {
    const t = i * VOICE_STEP
    const sung = buzz(t - countIn, path)
    points.push({
      t,
      cents: sung === null ? 0 : sung.cents + wander(t),
      level: sung === null ? 0 : BUZZ_LEVEL,
    })
  }
  return {
    id,
    root,
    plan,
    preset: DEMO_PRESET,
    hold: DEMO_HOLD,
    coverage,
    frames,
    events,
    fast: [],
    ...ONE_CLOCK,
    voice: points,
    length,
  }
}

/** One of Merc's waves on a root. */
export function demoTake(id: DemoTakeId, root: number): LipDemoTake {
  return id === 'off'
    ? buildTake('off', root, shortBuzz, OFF_SEED)
    : buildTake('on', root, fullBuzz, ON_SEED)
}
