// ============================================================
// One take in the bay: every captured frame through the engine
// ============================================================
//
// The engine is ticked once per CAPTURED frame, on the frames' own clock
// (shifted so the first wave starts at 0 and the count-in is t < 0),
// never once per screen frame. Each tick credits the reveal the same
// stretch it credits the wave's coverage (room-kit glide-reveal.ts), adds
// the voice to the trace where it was sung, and reports a wave's end and
// the path's end. The screen frame (useLipController.ts) reads what this
// left. Ng slides' ng-take.ts, on the bay's scale: a wave's pitch is drawn
// with its own height in semitones (bay-layout.ts pitchY).
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
import type { GlidePath } from '@/lib/glide/glide-path'
import { segmentAt, targetAt } from '@/lib/glide/glide-path'
import type { GlidePreset } from '@/lib/glide/glide-presets'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { PLAYHEAD_X } from './bay-geometry'
import { pitchY } from './bay-layout'
import type { BayScroll } from './bay-scroll'
import type { BayContact, TraceSample } from './bay-view'
import type { WaveHeard } from './lip-run'
import { waveHeard } from './lip-run'

/** Samples kept behind the screen's left edge before they are dropped. */
const TRACE_SLACK_W = 0.15

export interface LipTakeDeps {
  readonly path: GlidePath
  readonly preset: GlidePreset
  readonly scroll: BayScroll
  /** A wave's sung part ended (its archEnd), as the engine heard it. */
  readonly onWaveEnd: (heard: WaveHeard) => void
  /** The path ended: the run's result. */
  readonly onEnd: (result: GlideResult) => void
  /**
   * Every engine event, as it fires and before the two above (the demo's
   * tooltips wait for them).
   */
  readonly onEvent?: (event: GlideEvent) => void
}

export interface LipTake {
  /** The window's frames so far (frames' clock, s); new ones are heard. */
  hear: (frames: readonly PitchFrame[], countIn: number) => void
  /** End the path where the frames stopped short of it (a silent frame). */
  finish: () => void
  /** Draw no voice until path time `until`: the room's own tone sounds. */
  mute: (until: number) => void
  /** Strips lit since the last call. */
  drain: GlideReveal['drain']
  /** The voice's trace, oldest first; old samples are dropped as it grows. */
  readonly trace: readonly TraceSample[]
  readonly state: GlideState
  readonly reveal: GlideReveal
  /** The wave a time belongs to (a breath to the wave it leads into). */
  waveAt: (t: number) => number
  /** That wave's root, MIDI. */
  rootAt: (t: number) => number
  /** The voice sounds now, and is drawn (not the room's own tone). */
  readonly voiced: () => boolean
  /**
   * The contact light at screen time `t`: the target's world y and the
   * engine's onPath, while its last frame is in a wave's sung part.
   */
  contact: (t: number) => BayContact | null
}

export function createLipTake(deps: LipTakeDeps): LipTake {
  const { path, preset } = deps
  const state = createGlideState(path)
  const reveal = createGlideReveal(path)
  const trace: TraceSample[] = []
  let processed = 0
  let mutedUntil = Number.NEGATIVE_INFINITY
  let lastVoiced = false
  let lagMark = { sum: 0, count: 0 }

  const waveAt = (t: number): number => {
    const segment = segmentAt(path, t)
    return segment === null
      ? t < 0
        ? 0
        : path.arches.length - 1
      : segment.arch
  }
  const rootAt = (t: number): number => path.arches[waveAt(t)].rootMidi
  const semitonesAt = (t: number): number => {
    const wave = path.arches[waveAt(t)]
    return wave.topMidi - wave.rootMidi
  }

  const noteTrace = (t: number): void => {
    const midi = state.voiceMidi
    if (midi === null || t < mutedUntil) {
      lastVoiced = false
      return
    }
    trace.push({
      x: deps.scroll.at(t),
      y: pitchY(midi, rootAt(t), semitonesAt(t)),
      filling: state.following,
      gap: !lastVoiced,
    })
    lastVoiced = true
    // Drop what has scrolled off: the trace stays the screen's length.
    const left = deps.scroll.camera(t) - PLAYHEAD_X - TRACE_SLACK_W
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
        deps.onWaveEnd(
          waveHeard(state, event.arch, event.coverage, event.lit, lag, preset),
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
    waveAt,
    rootAt,
    voiced: () => lastVoiced,
    contact: (t) => {
      const target = state.arch < 0 ? null : targetAt(path, t)
      if (target === null) return null
      return { y: pitchY(target, rootAt(t), semitonesAt(t)), on: state.onPath }
    },
  }
}
