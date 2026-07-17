// ============================================================
// GlassRenderer — backend-agnostic seam for the mirror scene
// (plan §5.3). One imperative interface, swappable backends:
// the Canvas2D "lite" renderer ships in P2; the TypeGPU/WebGPU
// primary backend slots in behind this same interface in P3
// (factory switches on isWebGpuSupported + device acquisition,
// mirroring the guitar-tab-3d TabRenderer pattern).
// ============================================================

import { CanvasGlassRenderer } from './canvas2d/CanvasGlassRenderer'

export interface GlassSceneUpdate {
  mode: 'idle' | 'calibrate' | 'live' | 'playback'
  /** Offset from the target in cents (live/playback), or the absolute
   *  MIDI-cents value while calibrating (no target yet). Null = unvoiced. */
  offCents: number | null
  /** Input RMS level 0..1 — drives the ribbon head. */
  level: number
  resonance: number
  fatigue: number
  /** How many cracks the physics has spawned (renderer grows them in). */
  crackStep: number
  /** Note name to etch beside the target line ('' while calibrating). */
  targetLabel: string
}

export interface GlassRenderer {
  /** Create (or move) the scene canvas into `host`. */
  mount: (host: HTMLElement) => void
  /** Push the freshest state; the renderer draws on its own rAF clock. */
  update: (state: GlassSceneUpdate) => void
  /** A new take begins — clear the ribbon trail. */
  beginTake: () => void
  dispose: () => void
}

/**
 * Pick the rendering backend. TypeGPU/WebGPU is the planned primary
 * (P3); until it lands the Canvas2D mirror is used everywhere — and
 * remains the fallback for browsers without WebGPU thereafter.
 */
export function createGlassRenderer(): GlassRenderer {
  // TODO(P3): isWebGpuSupported() && acquireWebGpuDevice() →
  //           new TypeGpuGlassRenderer(device), funnel metric renderer:1.
  return new CanvasGlassRenderer()
}
