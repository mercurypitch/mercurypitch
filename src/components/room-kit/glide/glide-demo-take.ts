// ============================================================
// A glide room's demo take: Merc's voice through the glide engine
// ============================================================
//
// Lip roll's and Ng slides' demo scripts (each room's demo-script.ts) say
// what Merc does along one arch: a buzz that stops short, a hum that jumps
// by steps, the arch ridden whole. This sings such a script through the
// room's own engine: a frame at the tracker's rate (demo-kit
// demo-voice.ts), each ticked through the glide engine on the path's
// clock, as the room's take ticks it (glide-take.ts); the events it fired,
// on the take's clock; the arch's coverage at its end; and the voice line
// the demo's sound sings.
//
// A take's clock is the room's capture window: it reads zero as the
// count-in starts, and the path's clock (tau) is it less the count-in.

import type { DemoEvent, DemoVoicePoint } from '@/components/demo-kit/demo-plan'
import type { DemoVibrato } from '@/components/demo-kit/demo-voice'
import { FRAME_SECONDS, grainFor, silentFrame, vibratoCents, VOICE_STEP, voicedFrame, wanderFor, } from '@/components/demo-kit/demo-voice'
import { createGlideState, tickGlide } from '@/lib/glide/glide-engine'
import type { GlidePath } from '@/lib/glide/glide-path'
import { targetAt } from '@/lib/glide/glide-path'
import type { GlidePreset } from '@/lib/glide/glide-presets'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { GlideDemoMark } from './glide-room-contract'

/** Each run of Merc's voice opens from this far under its note, cents. */
const ATTACK_CENTS = -25
const ATTACK_SEC = 0.08

/** What Merc sings at a path time: cents above the root, and its onset. */
export interface GlideVoicing {
  readonly cents: number
  /** When this run of voice began, path seconds. */
  readonly onset: number
}

/** A take's script: path seconds to what Merc sings, null in silence. */
export type GlideDemoScript = (
  tau: number,
  path: GlidePath,
) => GlideVoicing | null

/** The path's note at `tau`, cents above the root. */
export function pathCents(path: GlidePath, tau: number): number {
  const root = path.arches[0].rootMidi
  return ((targetAt(path, tau) ?? root) - root) * 100
}

/** The opening scoop of a run of voice, cents under its note. */
export function attack(tau: number, onset: number): number {
  const k = Math.min(1, Math.max(0, (tau - onset) / ATTACK_SEC))
  return ATTACK_CENTS * (1 - k)
}

/** Merc's voice in a room's demo: as the tracker hears it. */
export interface GlideDemoVoicing {
  /** The take's wander and grain (demo-voice.ts). */
  readonly seed: number
  /** Merc's loudness, 0..1, the whole take through. */
  readonly level: number
  /** The vibrato on the path's clock, or none (Lip roll's buzz has none). */
  readonly vibrato?: DemoVibrato
}

/** One take, sung through the glide engine. */
export interface SungGlideDemo {
  /** The frames, take clock, to the engine's end. */
  readonly frames: readonly PitchFrame[]
  /** The engine's events, take clock. */
  readonly events: readonly DemoEvent<GlideDemoMark>[]
  /** The arch's coverage at its end, 0..1, as the engine heard it. */
  readonly coverage: number
  /** The voice line, take clock. */
  readonly voice: readonly DemoVoicePoint[]
  /** The take's last frame, s. */
  readonly length: number
}

/**
 * `script` on `root`, sung through the glide engine under `preset`, along
 * the plan's path and after its count-in.
 */
export function singGlideDemo(
  root: number,
  plan: { readonly path: GlidePath; readonly countIn: number },
  script: GlideDemoScript,
  voicing: GlideDemoVoicing,
  preset: GlidePreset,
): SungGlideDemo {
  const { path, countIn } = plan
  const { level, vibrato } = voicing
  const wander = wanderFor(voicing.seed)
  const grain = grainFor(voicing.seed)
  const state = createGlideState(path)
  const frames: PitchFrame[] = []
  const events: DemoEvent<GlideDemoMark>[] = []
  let coverage = 0
  for (let i = 0; !state.ended; i++) {
    const t = i * FRAME_SECONDS
    const tau = t - countIn
    const sung = script(tau, path)
    let frame = silentFrame(t)
    if (sung !== null) {
      const jitter = grain()
      const cents =
        vibrato === undefined
          ? sung.cents + wander(t) + jitter
          : sung.cents +
            wander(t) +
            vibratoCents(vibrato, tau, sung.onset) +
            jitter
      frame = voicedFrame(t, root, cents, level)
    }
    frames.push(frame)
    // The room's take ticks each frame on the path's clock (glide-take.ts).
    tickGlide(state, { ...frame, t: tau }, path, preset)
    for (const event of state.events) {
      events.push({ type: event.type, at: t })
      if (event.type === 'archEnd') coverage = event.coverage
    }
  }
  const length = frames[frames.length - 1].t
  const voice = voiceLine(plan, script, wander, level, length)
  return { frames, events, coverage, voice, length }
}

/**
 * The voice line the demo's sound sings, take clock, to `length`: the
 * script and the take's wander. The sound adds its own vibrato
 * (demo-sound.ts), and the grain is the tracker's alone.
 */
function voiceLine(
  plan: { readonly path: GlidePath; readonly countIn: number },
  script: GlideDemoScript,
  wander: (t: number) => number,
  level: number,
  length: number,
): DemoVoicePoint[] {
  const { path, countIn } = plan
  const voice: DemoVoicePoint[] = []
  for (let i = 0; i * VOICE_STEP <= length + 1e-9; i++) {
    const t = i * VOICE_STEP
    const sung = script(t - countIn, path)
    voice.push({
      t,
      cents: sung === null ? 0 : sung.cents + wander(t),
      level: sung === null ? 0 : level,
    })
  }
  return voice
}
