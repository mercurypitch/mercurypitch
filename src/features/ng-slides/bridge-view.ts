// ============================================================
// What the run hands the bridge each screen frame
// ============================================================
//
// The controller (useNgController.ts, on the glide rooms' core) keeps
// time and hears the voice; the scene (BridgeScene.tsx) draws. Between
// them, this: one call a screen frame while a run is on, with the camera,
// the new lit strips, the voice's trace and Merc's place, written straight
// to the DOM and the canvases, never through a signal (ART-FIDELITY.md 4:
// the scroll is one transform a frame, the reveal one drawImage a strip).

import type { GlideView } from '@/components/room-kit/glide/glide-room-contract'
import type { GlideContact, GlideTraceSample, } from '@/components/room-kit/glide/glide-take'
import type { LitStrip } from '@/components/room-kit/glide-reveal'

/** One sample of the voice's trace on the bridge; its y the storyboard's. */
export type TraceSample = GlideTraceSample

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

/** Where the voice meets the path now; its y the storyboard's. */
export type BridgeContact = GlideContact

/** The bridge a run draws on: the glide rooms' view, taking a BridgeFrame. */
export type BridgeView = GlideView<BridgeFrame>
