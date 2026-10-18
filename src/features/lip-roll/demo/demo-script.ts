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
import { ONE_CLOCK } from '@/components/demo-kit/demo-plan'
import type { GlideDemoScript } from '@/components/room-kit/glide/glide-demo-take'
import { attack, pathCents, singGlideDemo, } from '@/components/room-kit/glide/glide-demo-take'
import type { GlidePath } from '@/lib/glide/glide-path'
import { LIP_ROLL_SEMITONES } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
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
/** Merc's buzz, a little under a sung note's loudness. */
const BUZZ_LEVEL = 0.7

/** The crest a breath behind: where a voice riding it is at `tau`. */
function ridden(path: GlidePath, tau: number): number {
  return pathCents(path, Math.max(path.arches[0].start, tau - RIDE_LAG_SEC))
}

/**
 * Take 1: up the crest to five semitones, held there while the crest goes
 * over the top and comes back down to him, then down with it; the buzz
 * stops for half a second on the way.
 */
const shortBuzz: GlideDemoScript = (tau, path) => {
  const wave = path.arches[0]
  if (tau < wave.start || tau >= wave.landingEnd) return null
  if (tau >= OFF_GAP.from && tau < OFF_GAP.to) return null
  const onset = tau < OFF_GAP.from ? wave.start : OFF_GAP.to
  const cents = Math.min(ridden(path, tau), STOP_SHORT_CENTS)
  return { cents: cents + attack(tau, onset), onset }
}

/** Take 2: the crest itself, a breath behind it, from the root to the landing. */
const fullBuzz: GlideDemoScript = (tau, path) => {
  const wave = path.arches[0]
  if (tau < wave.start || tau >= wave.landingEnd) return null
  return {
    cents: ridden(path, tau) + attack(tau, wave.start),
    onset: wave.start,
  }
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

const OFF_SEED = 0x11b0
const ON_SEED = 0x11b1

/** One wave buzzed through the glide engine (room-kit glide-demo-take.ts). */
function buildTake(
  id: DemoTakeId,
  root: number,
  buzz: GlideDemoScript,
  seed: number,
): LipDemoTake {
  const plan = demoPlan(root)
  const sung = singGlideDemo(
    root,
    plan,
    buzz,
    { seed, level: BUZZ_LEVEL },
    DEMO_PRESET,
  )
  return {
    id,
    root,
    plan,
    preset: DEMO_PRESET,
    hold: DEMO_HOLD,
    coverage: sung.coverage,
    frames: sung.frames,
    events: sung.events,
    fast: [],
    ...ONE_CLOCK,
    voice: sung.voice,
    length: sung.length,
  }
}

/** One of Merc's waves on a root. */
export function demoTake(id: DemoTakeId, root: number): LipDemoTake {
  return id === 'off'
    ? buildTake('off', root, shortBuzz, OFF_SEED)
    : buildTake('on', root, fullBuzz, ON_SEED)
}
