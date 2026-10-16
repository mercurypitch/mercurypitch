// ============================================================
// What the run hands the bridge each screen frame
// ============================================================
//
// The controller (useNgController.ts) keeps time and hears the voice; the
// scene (BridgeScene.tsx) draws. Between them, this: one call a screen
// frame while a run is on, with the camera, the new lit strips, the
// voice's trace and Merc's place, written straight to the DOM and the
// canvases, never through a signal (ART-FIDELITY.md 4: the scroll is one
// transform a frame, the reveal one drawImage a strip).

import type { LitStrip } from '@/components/room-kit/glide-reveal'

/** One sample of the voice's trace on the bridge. */
export interface TraceSample {
  /** World X (W): where on the bridge the voice was sung. */
  readonly x: number
  /** Storyboard y (W): its pitch on that arch's scale. */
  readonly y: number
  /** On the path here: cyan; off it: amber. */
  readonly filling: boolean
  /** The voice was silent just before this sample: a new stroke starts. */
  readonly gap: boolean
}

export interface BridgeFrame {
  /** World X under the playhead (bridge-scroll.ts). */
  readonly camera: number
  /** Strips lit since the last frame. */
  readonly strips: readonly LitStrip[]
  /** The voice's trace, oldest first; the room draws what is on screen. */
  readonly trace: readonly TraceSample[]
  /** Merc's feet: world-independent x (W of the screen) and storyboard y. */
  readonly merc: { readonly x: number; readonly feetY: number }
  /**
   * The contact light at Merc's x (room-kit ContactLight): the target's
   * storyboard y now, and the voice on it. Null where nothing is judged
   * (the count-in, a landing, a rest) and in the demo's takes.
   */
  readonly contact: BridgeContact | null
}

/** Where the voice meets the path now, for the contact light. */
export interface BridgeContact {
  /** The target's storyboard y (W). */
  readonly y: number
  /** The engine has the voice on the path. */
  readonly on: boolean
}

export interface BridgeView {
  /** One screen frame of a run. */
  frame: (frame: BridgeFrame) => void
  /** A new run or the intro: every arch unlit, no trace, the camera here. */
  reset: (camera: number) => void
  /**
   * The last slide has begun: the result's lit band is decoded and its
   * canvas sized now, so the result's frame does not decode it.
   */
  prepareResult: () => void
  /**
   * The run is over: the pulled-back view, each arch lit over the ranges
   * (its u) the take lit.
   */
  result: (lit: readonly (readonly (readonly [number, number])[])[]) => void
}
