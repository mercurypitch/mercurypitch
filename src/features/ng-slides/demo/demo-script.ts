// ============================================================
// The Ng slides demo's script: Merc's two slides, frame by frame
// ============================================================
//
// "How it works" for Ng slides (DESIGN-ng-slides.md 4): Merc hums one
// slide up a fifth and back, twice, through the room's own glide engine.
//
//   take 1, not like this   he hums the slide in three steps (the root, a
//                           third up, the fifth), each held too long and
//                           left with a sudden jump: the engine fires
//                           `jump` twice and the glass goes dark between
//                           the steps. On the way down the hum stops for
//                           half a second: `break`, and the light stops
//                           with it
//   take 2, like this       he slides along the line, a breath behind it,
//                           turns at the top note and comes back down: the
//                           arch lights from end to end
//
// One slide a take, at Beginner's timing (the `learning` level: 1.5 s up,
// 0.5 s at the top, 1.5 s down), the level a first visit starts at, with
// the room's own count-in before it: the root's tone, then a breath while
// the bridge rolls in. Merc's voice moves at the slide's own pace in both
// takes; nothing is played fast, so the engine's clock (frame.t) and the
// screen's and the sound's are one.
//
// Beginner does not judge the top note, so its engine never fires `top`.
// The demo's rules are Beginner's with the top note checked as Pro checks
// it (DEMO_PRESET): the top check changes no coverage, no break and no
// jump, and it lets the "Turn at the top note" tooltip wait for the
// engine's own `top`, as every other tooltip waits for its event.
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
import { NG_SLIDE_SEMITONES } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import type { NgPlan } from '../ng-run'
import { planNgRun } from '../ng-run'
import type { NgDemoMark } from '../scripted-take'

export type { DemoTakeId, DemoVoicePoint }

export type { NgDemoMark }

export type DemoEvent = KitDemoEvent<NgDemoMark>

/** The level Merc hums at, whatever the singer's own. */
export const DEMO_LEVEL: GlideLevelId = 'learning'

/**
 * Beginner's rules, with the top note checked as Pro checks it, so the
 * engine fires `top` for the tooltip that explains the turn.
 */
export const DEMO_PRESET: GlidePreset = {
  ...NG_SLIDES_LEVELS[DEMO_LEVEL],
  top: NG_SLIDES_LEVELS.professional.top,
}

/** The vibrato both the frames and the synth carry on Merc's hum. */
export const DEMO_VIBRATO = {
  hz: 5.2,
  /** Half the swing: the pitch moves this far either side. */
  cents: 8,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.4,
} as const

/** Take 1's steps: the third and the fifth come in at these path times, s. */
export const OFF_STEPS = { third: 1.0, fifth: 1.75 } as const
/** Take 1's hum stops on the way down, path seconds, from and to. */
export const OFF_GAP = { from: 2.6, to: 3.1 } as const
/** Take 2 trails the line by this much, s: well inside Beginner's lag. */
export const ON_LAG_SEC = 0.08
/** Merc's hum, a little under a sung note's loudness. */
const HUM_LEVEL = 0.7

/**
 * Take 1: the root held past the moment the line left it, a jump to the
 * third held past the line again, a jump to the fifth; then down the line
 * on time, with the hum stopping for half a second on the way.
 */
const offHum: GlideDemoScript = (tau, path) => {
  const arch = path.arches[0]
  if (tau < arch.start || tau >= arch.landingEnd) return null
  if (tau >= OFF_GAP.from && tau < OFF_GAP.to) return null
  const onset = tau < OFF_GAP.from ? arch.start : OFF_GAP.to
  let cents: number
  if (tau < OFF_STEPS.third) cents = 0
  else if (tau < OFF_STEPS.fifth) cents = 400
  else if (tau < arch.topEnd) cents = NG_SLIDE_SEMITONES * 100
  else cents = pathCents(path, tau)
  return { cents: cents + attack(tau, onset), onset }
}

/** Take 2: the line itself, a breath behind it, from the root to the landing. */
const onHum: GlideDemoScript = (tau, path) => {
  const arch = path.arches[0]
  if (tau < arch.start || tau >= arch.landingEnd) return null
  const cents = pathCents(path, Math.max(arch.start, tau - ON_LAG_SEC))
  return { cents: cents + attack(tau, arch.start), onset: arch.start }
}

/** One of Merc's slides on a root (the demo kit's shape, demo-plan.ts). */
export interface NgDemoTake extends DemoTakeShape<NgDemoMark> {
  /** The root, MIDI: the slide starts and ends on it. */
  readonly root: number
  /** The room's plan for the take: one slide, its count-in. */
  readonly plan: NgPlan
  /** The rules it is sung under (DEMO_PRESET). */
  readonly preset: GlidePreset
  /** The arch's coverage at its end, 0..1, as the engine heard it. */
  readonly coverage: number
}

/** The room's plan for one demo slide on `root`. */
export function demoPlan(root: number): NgPlan {
  return planNgRun(
    { roots: [root], semitones: NG_SLIDE_SEMITONES, source: 'voiceprint' },
    DEMO_PRESET,
  )
}

const OFF_SEED = 0x4e40
const ON_SEED = 0x4e41

/**
 * One slide hummed through the glide engine (room-kit glide-demo-take.ts),
 * its vibrato on the path's clock.
 */
function buildTake(
  id: DemoTakeId,
  root: number,
  hum: GlideDemoScript,
  seed: number,
): NgDemoTake {
  const plan = demoPlan(root)
  const sung = singGlideDemo(
    root,
    plan,
    hum,
    { seed, level: HUM_LEVEL, vibrato: DEMO_VIBRATO },
    DEMO_PRESET,
  )
  return {
    id,
    root,
    plan,
    preset: DEMO_PRESET,
    coverage: sung.coverage,
    frames: sung.frames,
    events: sung.events,
    fast: [],
    ...ONE_CLOCK,
    voice: sung.voice,
    length: sung.length,
  }
}

/** One of Merc's slides on a root. */
export function demoTake(id: DemoTakeId, root: number): NgDemoTake {
  return id === 'off'
    ? buildTake('off', root, offHum, OFF_SEED)
    : buildTake('on', root, onHum, ON_SEED)
}
