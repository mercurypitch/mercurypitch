// ============================================================
// Test glides — synthetic voices along a glide path, for tests
// ============================================================
//
// A voice is a function from time to a pitch (MIDI) or null when it does
// not sound; framesOf samples it as the pitch stream would, 60 frames a
// second from the path's start to its end, voiced frames at confidence 0.9.
// Building voices from the path itself keeps every expected number in the
// tests exact: a voice "trailing by 250 ms" is the path read 250 ms late.

import { FPS, midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { GlideEvent, GlideState } from './glide-engine'
import { createGlideState, tickGlide } from './glide-engine'
import type { GlideArch, GlidePath } from './glide-path'
import { segmentAt, targetAt } from './glide-path'
import type { GlidePreset } from './glide-presets'

/** A sung pitch at `t`, MIDI, or null when the voice is silent. */
export type Voice = (t: number) => number | null

/** The frame at `t` for a voice. */
function frameAt(t: number, midi: number | null): PitchFrame {
  return midi === null
    ? { t, f0: 0, conf: 0, rms: 0.001 }
    : { t, f0: midiToF0(midi), conf: 0.9, rms: 0.6 }
}

/** A voice's frames from `from` to the path's end, 60 a second. */
export function framesOf(
  path: GlidePath,
  voice: Voice,
  from = 0,
): PitchFrame[] {
  const count = Math.ceil((path.duration - from) * FPS - 1e-9)
  const frames: PitchFrame[] = []
  for (let i = 0; i <= count; i++) {
    const t = from + i / FPS
    frames.push(frameAt(t, voice(t)))
  }
  return frames
}

/** The path itself, `lagSec` late: silent where the path rests. */
export function follow(path: GlidePath, lagSec = 0): Voice {
  return (t) => targetAt(path, t - lagSec)
}

/** A voice with `cents` added wherever it sounds. */
export function offset(voice: Voice, cents: (t: number) => number): Voice {
  return (t) => {
    const midi = voice(t)
    return midi === null ? null : midi + cents(t) / 100
  }
}

/** A voice silent wherever `silent` says. */
export function silentWhen(
  voice: Voice,
  silent: (t: number) => boolean,
): Voice {
  return (t) => (silent(t) ? null : voice(t))
}

/** The frame index nearest `t`. */
export const frameIndex = (t: number): number => Math.round(t * FPS)

/** The arch a time belongs to (its breath, sung part or landing). */
export function archAt(path: GlidePath, t: number): GlideArch | null {
  const segment = segmentAt(path, t)
  return segment === null ? null : path.arches[segment.arch]
}

export interface Played {
  state: GlideState
  /** Every event, with the time of the frame that fired it. */
  events: Array<{ t: number; event: GlideEvent }>
}

/** Ticks every frame through a fresh state, keeping each tick's events. */
export function playGlide(
  frames: readonly PitchFrame[],
  path: GlidePath,
  preset: GlidePreset,
): Played {
  const state = createGlideState(path)
  const events: Played['events'] = []
  for (const frame of frames) {
    tickGlide(state, frame, path, preset)
    for (const event of state.events) events.push({ t: frame.t, event })
  }
  return { state, events }
}

/** The events' types, in order. */
export const typesOf = (played: Played): string[] =>
  played.events.map((e) => e.event.type)
