// ============================================================
// One take in a glide room: every captured frame through the engine
// ============================================================
//
// The engine is ticked once per CAPTURED frame, on the frames' own clock
// (shifted so the first arch starts at 0 and the count-in is t < 0),
// never once per screen frame. Each tick credits the reveal the same
// stretch it credits the arch's coverage (room-kit glide-reveal.ts), adds
// the voice to the trace where it was sung, and reports an arch's end and
// the path's end. The screen frame (useGlideRoom.ts) reads what this left.
// The room says where a pitch stands on its scale (`pitchY`: Lip roll's
// waves each have their own height in semitones, Ng slides' arches one)
// and what an arch's end means for its line (`heard`).
//
// While the room's own tone sounds (`mute`), the voice is still heard by
// the engine (the count-in and the breaths are not judged) but not drawn:
// the speaker is not the singer.

import type { GlideReveal } from '@/components/room-kit/glide-reveal'
import { createGlideReveal } from '@/components/room-kit/glide-reveal'
import type { GlideEvent, GlideState } from '@/lib/glide/glide-engine'
import { createGlideState, tickGlide } from '@/lib/glide/glide-engine'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { computeGlideResult } from '@/lib/glide/glide-metrics'
import type { GlideArch, GlidePath } from '@/lib/glide/glide-path'
import { segmentAt, targetAt } from '@/lib/glide/glide-path'
import type { GlidePreset } from '@/lib/glide/glide-presets'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** Samples kept behind the screen's left edge before they are dropped. */
const TRACE_SLACK_W = 0.15

/** One sample of the voice's trace, in the room's world. */
export interface GlideTraceSample {
  /** World X (W): where the voice was sung. */
  readonly x: number
  /** World y: its pitch on that arch's scale. */
  readonly y: number
  /** On the path here: cyan; off it: amber. */
  readonly filling: boolean
  /** The voice was silent just before this sample: a new stroke starts. */
  readonly gap: boolean
}

/** Where the voice meets the path now, for the contact light. */
export interface GlideContact {
  /** The target's world y. */
  readonly y: number
  /** The engine has the voice on the path. */
  readonly on: boolean
}

/** The voice's lag over one arch: its sum and how many readings, s. */
export interface GlideLag {
  readonly sum: number
  readonly count: number
}

/** What the take reads of the room's scroll. */
export interface GlideScroll {
  /** Where time `t` on the path's clock is sung, world X. */
  at: (t: number) => number
  /** The camera at `t`: `at`, unless the room stops it (a demo's hold). */
  camera: (t: number) => number
}

export interface GlideTakeDeps<H> {
  readonly path: GlidePath
  readonly preset: GlidePreset
  readonly scroll: GlideScroll
  /** The playhead's screen X, W: the trace is kept to what is on screen. */
  readonly playheadX: number
  /** A pitch's world y on `arch`'s scale. */
  readonly pitchY: (midi: number, arch: GlideArch) => number
  /** What the engine knows of an arch at its end, for its line. */
  readonly heard: (
    state: GlideState,
    arch: number,
    coverage: number,
    lit: boolean,
    lag: GlideLag,
    preset: GlidePreset,
  ) => H
  /** Arch `arch`'s sung part ended (its archEnd), as the engine heard it. */
  readonly onArchEnd: (arch: number, heard: H) => void
  /** The path ended: the run's result. */
  readonly onEnd: (result: GlideResult) => void
  /**
   * Every engine event, as it fires and before the two above (the demo's
   * tooltips wait for them).
   */
  readonly onEvent?: (event: GlideEvent) => void
}

export interface GlideTake {
  /** The window's frames so far (frames' clock, s); new ones are heard. */
  hear: (frames: readonly PitchFrame[], countIn: number) => void
  /** End the path where the frames stopped short of it (a silent frame). */
  finish: () => void
  /** Draw no voice until path time `until`: the room's own tone sounds. */
  mute: (until: number) => void
  /** Strips lit since the last call. */
  drain: GlideReveal['drain']
  /** The voice's trace, oldest first; old samples are dropped as it grows. */
  readonly trace: readonly GlideTraceSample[]
  readonly state: GlideState
  readonly reveal: GlideReveal
  /** The arch a time belongs to (a breath to the arch it leads into). */
  archAt: (t: number) => number
  /** The voice sounds now, and is drawn (not the room's own tone). */
  readonly voiced: () => boolean
  /**
   * The contact light at screen time `t`: the target's world y and the
   * engine's onPath, while its last frame is in an arch's sung part.
   */
  contact: (t: number) => GlideContact | null
}

export function createGlideTake<H>(deps: GlideTakeDeps<H>): GlideTake {
  const { path, preset } = deps
  const state = createGlideState(path)
  const reveal = createGlideReveal(path)
  const trace: GlideTraceSample[] = []
  let processed = 0
  let mutedUntil = Number.NEGATIVE_INFINITY
  let lastVoiced = false
  let lagMark = { sum: 0, count: 0 }

  const archAt = (t: number): number => {
    const segment = segmentAt(path, t)
    return segment === null
      ? t < 0
        ? 0
        : path.arches.length - 1
      : segment.arch
  }
  const yAt = (midi: number, t: number): number =>
    deps.pitchY(midi, path.arches[archAt(t)])

  const noteTrace = (t: number): void => {
    const midi = state.voiceMidi
    if (midi === null || t < mutedUntil) {
      lastVoiced = false
      return
    }
    trace.push({
      x: deps.scroll.at(t),
      y: yAt(midi, t),
      filling: state.following,
      gap: !lastVoiced,
    })
    lastVoiced = true
    // Drop what has scrolled off: the trace stays the screen's length.
    const left = deps.scroll.camera(t) - deps.playheadX - TRACE_SLACK_W
    let old = 0
    while (old < trace.length && trace[old].x < left) old++
    if (old > 64) trace.splice(0, old)
  }

  const onEvents = (): void => {
    for (const event of state.events) {
      deps.onEvent?.(event)
      if (event.type === 'archEnd') {
        const lag = {
          sum: state.lagSum - lagMark.sum,
          count: state.lagCount - lagMark.count,
        }
        lagMark = { sum: state.lagSum, count: state.lagCount }
        deps.onArchEnd(
          event.arch,
          deps.heard(state, event.arch, event.coverage, event.lit, lag, preset),
        )
      } else if (event.type === 'end') {
        deps.onEnd(computeGlideResult(state, path, preset))
      }
    }
  }

  const tick = (frame: PitchFrame): void => {
    if (state.ended) return
    const previous = state.previousT ?? frame.t
    tickGlide(state, frame, path, preset)
    reveal.credit(previous, frame.t, state.following)
    noteTrace(frame.t)
    onEvents()
  }

  return {
    hear: (frames, countIn) => {
      for (let i = processed; i < frames.length; i++) {
        const frame = frames[i]
        tick({ ...frame, t: frame.t - countIn })
      }
      processed = frames.length
    },
    finish: () => {
      if (state.ended) return
      tick({ t: path.duration, f0: 0, conf: 0, rms: 0 })
    },
    mute: (until) => {
      mutedUntil = Math.max(mutedUntil, until)
    },
    drain: reveal.drain,
    trace,
    state,
    reveal,
    archAt,
    voiced: () => lastVoiced,
    contact: (t) => {
      const target = state.arch < 0 ? null : targetAt(path, t)
      if (target === null) return null
      return { y: yAt(target, t), on: state.onPath }
    },
  }
}
