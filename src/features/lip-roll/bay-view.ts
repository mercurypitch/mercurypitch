// ============================================================
// What the run hands the bay each screen frame
// ============================================================
//
// The controller (useLipController.ts) keeps time and hears the voice; the
// scene (BayScene.tsx) draws. Between them, this: one call a screen frame
// while a run is on, with the camera and its zoom, the new lit strips, the
// voice's trace and Merc's place, written straight to the DOM and the
// canvases, never through a signal (ART-FIDELITY.md 4).

import type { LitStrip } from '@/components/room-kit/glide-reveal'

/** One sample of the voice's trace in the bay. */
export interface TraceSample {
  /** World X (W): where in the bay the voice was sung. */
  readonly x: number
  /** World y (wave B's frame): its pitch on that wave's scale. */
  readonly y: number
  /** On the path here: cyan; off it: amber. */
  readonly filling: boolean
  /** The voice was silent just before this sample: a new stroke starts. */
  readonly gap: boolean
}

export interface BayFrame {
  /** World X under the playhead (bay-scroll.ts). */
  readonly camera: number
  /** The camera's zoom, 0 (the intro's, wave A) to 1 (the run's, wave B). */
  readonly zoom: number
  /** Strips lit since the last frame. */
  readonly strips: readonly LitStrip[]
  /** The voice's trace, oldest first; the room draws what is on screen. */
  readonly trace: readonly TraceSample[]
  /** Merc's feet: x of the screen (W) and world y. */
  readonly merc: { readonly x: number; readonly feetY: number }
  /** The voice sounds now: bubbles stream from the ribbon's head. */
  readonly voiced: boolean
  /**
   * The contact light at Merc's x (room-kit ContactLight): the target's
   * world y now, and the voice on it. Null where nothing is judged (the
   * count-in, a landing, a rest) and in the demo's takes.
   */
  readonly contact: BayContact | null
}

/** Where the voice meets the path now, for the contact light. */
export interface BayContact {
  /** The target's world y (wave B's frame). */
  readonly y: number
  /** The engine has the voice on the path. */
  readonly on: boolean
}

export interface BayView {
  /** One screen frame of a run. */
  frame: (frame: BayFrame) => void
  /** A new run or the intro: every wave unlit, no trace, the intro's camera. */
  reset: (camera: number) => void
  /**
   * The last wave has begun: the result's lit band is decoded and its
   * canvas sized now, so the result's frame does not decode it.
   */
  prepareResult: () => void
  /**
   * The run is over: the pulled-back view, each wave lit over the ranges
   * (its u) the take lit.
   */
  result: (lit: readonly (readonly (readonly [number, number])[])[]) => void
}
