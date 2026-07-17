// ============================================================
// TabRenderer — backend-agnostic seam for the 3D tab playback view
// ============================================================
//
// One imperative interface, swappable backends. The Canvas2D backend ships
// today (and is the fallback for browsers without WebGPU); a WebGPU/TypeGPU
// backend will slot in behind the same interface later.

import { isWebGpuSupported } from '@/lib/gpu/webgpu-device'
import type { CameraState } from './camera'
import { Canvas2dTabRenderer } from './canvas2d/Canvas2dTabRenderer'

/** Per-string colours, high-e (index 0) to low-E (index 5). */
export const DEFAULT_STRING_COLORS: readonly string[] = [
  '#ff5d5d',
  '#ffa53d',
  '#ffe14d',
  '#5dff8f',
  '#4dd2ff',
  '#b88cff',
]

export interface DisplaySettings {
  /** Per-string lane colours, indexed by stringIndex. */
  stringColors: readonly string[]
  /** Mirror the board for left-handed players. */
  leftHanded: boolean
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  stringColors: DEFAULT_STRING_COLORS,
  leftHanded: false,
}

/** A single note to render, derived from the guitar engine's falling notes. */
export interface TabSceneNote {
  stringIndex: number
  fret: number
  startBeat: number
  durationBeats: number
  /** Pre-formatted note name (e.g. "A#") for the note-name label mode. */
  noteName: string
  isBacking: boolean
}

/** A scored hit to flash on its cell, coloured by accuracy. */
export interface TabHit {
  stringIndex: number
  fret: number
  timing: 'perfect' | 'great' | 'good'
  /** Date.now() when the hit was recorded (for fade-out). */
  at: number
}

/** The player's currently-detected input pitch, placed on the neck. */
export interface TabDetected {
  stringIndex: number
  fret: number
  /** True when the pitch matches a hittable target right now. */
  matchesTarget: boolean
  /** Detection confidence 0–1 (mic); 1 for MIDI. */
  clarity: number
}

/** Everything a renderer needs for one frame. Pure data, no engine coupling. */
export interface TabScene {
  notes: readonly TabSceneNote[]
  playheadBeat: number
  /** How many beats ahead are visible (depth of the highway). */
  visibleBeatWindow: number
  stringCount: number
  /** Open-string MIDI per string index (0 = highest), for the neck note names. */
  openMidi: readonly number[]
  /** Highest fret to lay out on the neck. */
  maxFret: number
  /** Show note names on blocks instead of fret numbers. */
  showNoteLabels: boolean
  /** Draw the neck (fretboard) at the hit line. */
  showFretboard: boolean
  /** Recent scored hits to flash on their cells (input scoring feedback). */
  hits: readonly TabHit[]
  /** The player's detected input note on the neck, or null. */
  detected: TabDetected | null
  display: DisplaySettings
}

export interface TabRenderer {
  /** Attach to a canvas. May be async for backends that acquire a GPU device. */
  mount(canvas: HTMLCanvasElement): void | Promise<void>
  /** Draw one frame. */
  render(scene: TabScene): void
  /** Update the orbit camera (yaw/pitch/zoom/pan). */
  setCamera(camera: CameraState): void
  /** Resize the drawing surface (CSS pixels + device pixel ratio). */
  resize(width: number, height: number, dpr: number): void
  /** Release all resources. */
  dispose(): void
}

/**
 * Pick the rendering backend. WebGPU/TypeGPU is the planned primary backend;
 * until it lands the Canvas2D perspective renderer is used everywhere (and
 * remains the fallback for browsers without WebGPU thereafter).
 */
export function createTabRenderer(): TabRenderer {
  if (isWebGpuSupported()) {
    // TODO(webgpu): return new WebGpuTabRenderer() once the TypeGPU backend ships.
    console.info(
      '[tab-3d] WebGPU available; using Canvas2D renderer until the GPU backend ships.',
    )
  }
  return new Canvas2dTabRenderer()
}
