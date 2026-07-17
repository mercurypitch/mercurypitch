// ============================================================
// GlassRenderer — backend-agnostic seam for the mirror scene
// (plan §5.3). One imperative interface, swappable backends:
// TypeGPU/WebGPU is the PRIMARY (the mandate — decision 9), the
// Canvas2D "lite" renderer is the fallback for browsers without
// WebGPU or when GPU init fails. The whole module is loaded via
// dynamic import from GlassApp, and the TypeGPU backend is a
// further dynamic import — so non-WebGPU visitors never download
// typegpu, and the landing never downloads any renderer at all.
// ============================================================

import { isWebGpuSupported } from '@/lib/gpu/webgpu-device'
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
  /** Which backend this is — reported to the funnel (renderer: 1|0). */
  readonly backend: 'typegpu' | 'canvas2d'
  /** Create (or move) the scene canvas into `host`. */
  mount: (host: HTMLElement) => void
  /** Push the freshest state; the renderer draws on its own rAF clock. */
  update: (state: GlassSceneUpdate) => void
  /** A new take begins — clear the ribbon trail. */
  beginTake: () => void
  /**
   * Detonate the pane: snapshot its final pixels and burst them into
   * shards (deterministic per seed; drama scaled by epicness, §17.3).
   * The renderer animates autonomously from here; the app times the
   * results transition with computeShatterTimeline on the same inputs.
   */
  shatter: (options: { epicness: number; seed: number }) => void
  dispose: () => void
}

/**
 * Pick the rendering backend: TypeGPU when WebGPU is available and the
 * device + context come up; the Canvas2D mirror otherwise. Any GPU-side
 * failure falls back silently — the show must go on.
 */
export async function createGlassRenderer(options?: {
  /** Skip the GPU path (used after a mount-time GPU failure). */
  forceCanvas?: boolean
}): Promise<GlassRenderer> {
  if (options?.forceCanvas !== true && isWebGpuSupported()) {
    try {
      const { TypeGpuGlassRenderer } =
        await import('./typegpu/TypeGpuGlassRenderer')
      return await TypeGpuGlassRenderer.create()
    } catch (err) {
      console.warn('[glass] TypeGPU init failed — Canvas2D fallback:', err)
    }
  }
  return new CanvasGlassRenderer()
}
