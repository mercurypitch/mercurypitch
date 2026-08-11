// ============================================================
// TabRenderer — backend-agnostic seam for the 3D tab playback view
// ============================================================
//
// One imperative interface, swappable backends. The Canvas2D backend ships
// today (and is the fallback for browsers without WebGPU); a WebGPU/TypeGPU
// backend will slot in behind the same interface later.

import { isWebGpuSupported } from '@/lib/gpu/webgpu-device'
import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
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
  /** Surface palette; standalone rooms can reuse the renderer without its legacy blue world. */
  theme?: 'midnight' | 'velvet'
  /** Motion policy is resolved by the host, never queried in the render loop. */
  motion?: 'full' | 'reduced'
  /** Reduced effects preserve notation while dropping expensive glow/compositing. */
  effects?: 'full' | 'reduced'
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  stringColors: DEFAULT_STRING_COLORS,
  leftHanded: false,
  theme: 'midnight',
  motion: 'full',
  effects: 'full',
}

export const VELVET_DISPLAY: DisplaySettings = {
  stringColors: [
    '#f2c98f',
    '#dda969',
    '#bd8b58',
    '#89cfc4',
    '#6fb7ae',
    '#d8c8af',
  ],
  leftHanded: false,
  theme: 'velvet',
  motion: 'full',
  effects: 'full',
}

/** The same musical scene can be projected as a fret grid or string lanes. */
export type TabPresentation = 'fret-axis' | 'string-highway'

/** A single note to render, derived from the guitar engine's falling notes. */
export interface TabSceneNote {
  id: string
  midi: number
  stringIndex: number
  fret: number
  startBeat: number
  durationBeats: number
  /** Pre-formatted note name (e.g. "A#") for the note-name label mode. */
  noteName: string
  isBacking: boolean
  /** Authored score detail only; measured/plain MIDI notes leave this absent. */
  notation?: GuitarNoteNotation
}

/** One authored event; simultaneous notes share one semantic chord frame. */
export interface TabSceneEvent {
  id: string
  startBeat: number
  endBeat: number
  notes: readonly TabSceneNote[]
  chordLabel?: string
}

/** Static interval maxima let render frames skip expired score regions. */
export interface TabNoteIntervalIndex {
  maxEndTree: readonly number[]
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
  noteIntervalIndex: TabNoteIntervalIndex
  events: readonly TabSceneEvent[]
  noteById: ReadonlyMap<string, TabSceneNote>
  /** Longest note, used to binary-search sustained notes crossing the window. */
  maxNoteDurationBeats: number
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
  presentation: TabPresentation
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
