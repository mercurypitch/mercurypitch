// ============================================================
// What the run hands the bay each screen frame
// ============================================================
//
// The controller (useLipController.ts, on the glide rooms' core) keeps
// time and hears the voice; the scene (BayScene.tsx) draws. Between them,
// this: one call a screen frame while a run is on, with the camera and
// its zoom, the new lit strips, the voice's trace and Merc's place,
// written straight to the DOM and the canvases, never through a signal
// (ART-FIDELITY.md 4).

import type { GlideView } from '@/components/room-kit/glide/glide-room-contract'
import type { GlideContact, GlideTraceSample, } from '@/components/room-kit/glide/glide-take'
import type { LitStrip } from '@/components/room-kit/glide-reveal'

/** One sample of the voice's trace in the bay; its y in wave B's frame. */
export type TraceSample = GlideTraceSample

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

/** Where the voice meets the path now; its y in wave B's frame. */
export type BayContact = GlideContact

/** The bay a run draws on: the glide rooms' view, taking a BayFrame. */
export type BayView = GlideView<BayFrame>
