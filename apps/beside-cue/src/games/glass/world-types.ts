// ============================================================
// World primitives shared by the stage engine (JourneyPrototype) and the
// level compiler. Pure data — no DOM, no audio, no rendering.
// ============================================================

export interface Platform {
  midi: number
  x0: number // world units
  x1: number
  kind: 'stone' | 'glass'
  lit: boolean
  dwell: number
  integrity: number
  broken: boolean
  respawnMs: number
  /** Hum this platform's note when it becomes the active objective. */
  hum?: boolean
  /** Karaoke syllable drawn under the slab (melody levels). */
  syllable?: string
}

export interface Pane {
  wx: number
  midi: number
  kind: 'gate' | 'wall' | 'hidden'
  res: number
  burstT: number // -1 until burst
  /** hidden panes: hot–cold proximity of the current voice, 0..1 */
  reveal: number
  shards: { x: number; y: number; vx: number; vy: number; r: number }[]
}

export interface WhisperZone {
  x0: number
  x1: number
  /** guardian world position */
  gx: number
  gyMidi: number
  stir: number // 0..1, loud singing raises it
  woken: boolean
  wokenMs: number
}

export interface BossCrystal {
  midi: number
  wx: number
  res: number
  broken: boolean
  brokenMs: number // time since broken (re-anneal clock)
}

export interface Boss {
  cx: number
  crystals: BossCrystal[]
  cleared: boolean
  shards: {
    x: number
    y: number
    vx: number
    vy: number
    r: number
    t: number
  }[]
}

export type Node =
  | { t: 'land'; p: Platform; hint: string; checkpoint?: boolean }
  | { t: 'pane'; pane: Pane; hint: string }
  | { t: 'whisper'; z: WhisperZone; hint: string }
  | { t: 'boss'; boss: Boss; hint: string }
