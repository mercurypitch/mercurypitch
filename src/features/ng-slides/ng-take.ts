// ============================================================
// One take on the bridge: every captured frame through the engine
// ============================================================
//
// The engine is ticked once per CAPTURED frame, on the frames' own clock
// (shifted so the first slide starts at 0 and the count-in is t < 0),
// never once per screen frame. Each tick credits the reveal the same
// stretch it credits the arch's coverage (bridge-reveal.ts), adds the
// voice to the trace where it was sung, and reports a slide's end and the
// path's end. The screen frame (useNgController.ts) reads what this left.
//
// While the room's own tone sounds (`mute`), the voice is still heard by
// the engine (the count-in and the breaths are not judged) but not drawn:
// the speaker is not the singer.

import type { GlideEvent, GlideState } from '@/lib/glide/glide-engine'
import { createGlideState, tickGlide } from '@/lib/glide/glide-engine'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { computeGlideResult } from '@/lib/glide/glide-metrics'
import type { GlidePath } from '@/lib/glide/glide-path'
import { segmentAt } from '@/lib/glide/glide-path'
import type { GlidePreset } from '@/lib/glide/glide-presets'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { PLAYHEAD_X } from './bridge-geometry'
import { pitchY } from './bridge-layout'
import type { BridgeReveal } from './bridge-reveal'
import { createBridgeReveal } from './bridge-reveal'
import type { BridgeScroll } from './bridge-scroll'
import type { TraceSample } from './bridge-view'
import type { SlideHeard } from './ng-run'
import { slideHeard } from './ng-run'

/** Samples kept behind the screen's left edge before they are dropped. */
const TRACE_SLACK_W = 0.15

export interface NgTakeDeps {
  readonly path: GlidePath
  readonly preset: GlidePreset
  readonly scroll: BridgeScroll
  /** A slide's sung part ended (its archEnd), as the engine heard it. */
  readonly onSlideEnd: (heard: SlideHeard) => void
  /** The path ended: the run's result. */
  readonly onEnd: (result: GlideResult) => void
  /**
   * Every engine event, as it fires and before the two above (the demo's
   * tooltips wait for them).
   */
  readonly onEvent?: (event: GlideEvent) => void
}

export interface NgTake {
  /** The window's frames so far (frames' clock, s); new ones are heard. */
  hear: (frames: readonly PitchFrame[], countIn: number) => void
  /** End the path where the frames stopped short of it (a silent frame). */
  finish: () => void
  /** Draw no voice until path time `until`: the room's own tone sounds. */
  mute: (until: number) => void
  /** Strips lit since the last call. */
  drain: BridgeReveal['drain']
  /** The voice's trace, oldest first; old samples are dropped as it grows. */
  readonly trace: readonly TraceSample[]
  readonly state: GlideState
  readonly reveal: BridgeReveal
  /** The arch a time belongs to (a breath to the slide it leads into). */
  rootAt: (t: number) => number
}

export function createNgTake(deps: NgTakeDeps): NgTake {
  const { path, preset } = deps
  const state = createGlideState(path)
  const reveal = createBridgeReveal(path)
  const trace: TraceSample[] = []
  let processed = 0
  let mutedUntil = Number.NEGATIVE_INFINITY
  let lastVoiced = false
  let lagMark = { sum: 0, count: 0 }

  const rootAt = (t: number): number => {
    const segment = segmentAt(path, t)
    const arch =
      segment === null ? (t < 0 ? 0 : path.arches.length - 1) : segment.arch
    return path.arches[arch].rootMidi
  }

  const noteTrace = (t: number): void => {
    const midi = state.voiceMidi
    if (midi === null || t < mutedUntil) {
      lastVoiced = false
      return
    }
    trace.push({
      x: deps.scroll.at(t),
      y: pitchY(midi, rootAt(t)),
      filling: state.following,
      gap: !lastVoiced,
    })
    lastVoiced = true
    // Drop what has scrolled off: the trace stays the screen's length.
    const left = deps.scroll.at(t) - PLAYHEAD_X - TRACE_SLACK_W
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
        deps.onSlideEnd(
          slideHeard(state, event.arch, event.coverage, event.lit, lag, preset),
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
    rootAt,
  }
}
