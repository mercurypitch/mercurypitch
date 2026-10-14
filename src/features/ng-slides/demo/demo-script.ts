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
// room plays these frames through its own take (ng-take.ts, by the demo's
// scripted take), so every tooltip is cued by a moment that really
// happened there, and the tests replay the same frames through tickGlide
// to prove what each tooltip says.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, DemoVoicePoint, } from '@/components/demo-kit/demo-plan'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { createGlideState, tickGlide } from '@/lib/glide/glide-engine'
import type { GlidePath } from '@/lib/glide/glide-path'
import { NG_SLIDE_SEMITONES, targetAt } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
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
/** Each run of humming opens from this far under its note, cents. */
const ATTACK_CENTS = -25
const ATTACK_SEC = 0.08

const FRAME_SECONDS = 1 / 60
const VOICE_STEP = 0.025
const CONF = 0.92
const SILENT_RMS = 0.001
/** Merc's hum, a little under a sung note's loudness. */
const HUM_LEVEL = 0.7
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2

/** What Merc hums at a path time: cents above the root, and when it began. */
interface Hum {
  readonly cents: number
  /** When this run of humming began, path seconds. */
  readonly onset: number
}

/** A take's hum: path seconds to cents above the root, null in silence. */
type HumScript = (tau: number, path: GlidePath) => Hum | null

/** The path's note at `tau`, cents above the root. */
function pathCents(path: GlidePath, tau: number): number {
  const root = path.arches[0].rootMidi
  return ((targetAt(path, tau) ?? root) - root) * 100
}

/** The opening scoop of a run of humming, cents under its note. */
const attack = (tau: number, onset: number): number => {
  const k = Math.min(1, Math.max(0, (tau - onset) / ATTACK_SEC))
  return ATTACK_CENTS * (1 - k)
}

/**
 * Take 1: the root held past the moment the line left it, a jump to the
 * third held past the line again, a jump to the fifth; then down the line
 * on time, with the hum stopping for half a second on the way.
 */
const offHum: HumScript = (tau, path) => {
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
const onHum: HumScript = (tau, path) => {
  const arch = path.arches[0]
  if (tau < arch.start || tau >= arch.landingEnd) return null
  const cents = pathCents(path, Math.max(arch.start, tau - ON_LAG_SEC))
  return { cents: cents + attack(tau, arch.start), onset: arch.start }
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

/** The vibrato's swing at take time t of a run that began at `onset`. */
export function demoVibratoCents(t: number, onset: number): number {
  const grown = Math.min(1, Math.max(0, (t - onset) / DEMO_VIBRATO.rampSec))
  return (
    DEMO_VIBRATO.cents * grown * Math.sin(2 * Math.PI * DEMO_VIBRATO.hz * t)
  )
}

/** Merc's 0..1 loudness as an RMS level (the inverse of levelFromRms). */
function rmsForLevel(level: number): number {
  return Math.pow(10, (level * 40 - 50) / 20)
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

/** The two clocks of the demo kit, here one and the same. */
const ONE_CLOCK = {
  engineAt: (wall: number): number => wall,
  wallAt: (engine: number): number => engine,
} as const

const OFF_SEED = 0x4e40
const ON_SEED = 0x4e41

function buildTake(
  id: DemoTakeId,
  root: number,
  hum: HumScript,
  seed: number,
): NgDemoTake {
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
    const sung = hum(tau, path)
    let frame: PitchFrame = { t, f0: 0, conf: 0, rms: SILENT_RMS }
    if (sung !== null) {
      const jitter = (grain() - 0.5 + (grain() - 0.5)) * JITTER_CENTS
      const cents =
        sung.cents + wander(t) + demoVibratoCents(tau, sung.onset) + jitter
      frame = {
        t,
        f0: midiToFrequency(root + cents / 100),
        conf: CONF,
        rms: rmsForLevel(HUM_LEVEL),
      }
    }
    frames.push(frame)
    // The room's take ticks each frame on the path's clock (ng-take.ts).
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
    const tau = t - countIn
    const sung = hum(tau, path)
    points.push({
      t,
      cents: sung === null ? 0 : sung.cents + wander(t),
      level: sung === null ? 0 : HUM_LEVEL,
    })
  }
  return {
    id,
    root,
    plan,
    preset: DEMO_PRESET,
    coverage,
    frames,
    events,
    fast: [],
    ...ONE_CLOCK,
    voice: points,
    length,
  }
}

/** One of Merc's slides on a root. */
export function demoTake(id: DemoTakeId, root: number): NgDemoTake {
  return id === 'off'
    ? buildTake('off', root, offHum, OFF_SEED)
    : buildTake('on', root, onHum, ON_SEED)
}
