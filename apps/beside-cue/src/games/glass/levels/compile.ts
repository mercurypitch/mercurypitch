// ============================================================
// compileLevel — the bridge from content to stage.
//
// A pure function: LevelDef + (mode, calibrated ground note) → the world
// the stage engine runs (platforms, panes, node chain, pitch window).
// The same level compiles for any mode; only geometry pacing changes —
// intervals stay the path. Rhythm-game precedent: one beatmap, many
// rulesets, converted per ruleset (osu!lazer's IBeatmapConverter).
//
// Purity matters: no engine, no DOM, no audio — unit-testable, and the
// output shape is plain data so a remote songbook stays a fetch away.
// ============================================================

import { midiToNoteNameOctave } from '@irchiinnuss/pitch-engine'
import { JOURNEY_CONFIG } from '../journey-config'
import type { Node, Pane, Platform } from '../world-types'
import type { LevelDef, MelodyDef } from './types'

export type PlayMode = 'flow' | 'platformer'

export interface CompileOpts {
  mode: PlayMode
  groundMidi: number
}

export interface CompiledStage {
  platforms: Platform[]
  panes: Pane[]
  nodes: Node[]
  worldMax: number
  /** Pitch window, semitone offsets relative to the ground note — derived
   * from the melody's range instead of the fixed default window. */
  windowLo: number
  windowHi: number
  /** Merc's starting world x (on the lit ground slab). */
  startX: number
}

const M = JOURNEY_CONFIG.melody

const platform = (
  midi: number,
  x0: number,
  x1: number,
  extra?: Partial<Platform>,
): Platform => ({
  midi,
  x0,
  x1,
  kind: 'stone',
  lit: false,
  dwell: 0,
  integrity: 1,
  broken: false,
  respawnMs: 0,
  ...extra,
})

const melodyRange = (m: MelodyDef): { lo: number; hi: number } => {
  let lo = 0
  let hi = 0
  for (const d of m.degrees) {
    if (d < lo) lo = d
    if (d > hi) hi = d
  }
  return { lo, hi }
}

export const compileLevel = (
  level: LevelDef,
  opts: CompileOpts,
): CompiledStage => {
  const { mode, groundMidi } = opts
  const name = (deg: number): string => midiToNoteNameOctave(groundMidi + deg)

  const platforms: Platform[] = []
  const panes: Pane[] = []
  const nodes: Node[] = []

  const ground = platform(groundMidi, 0.5, 0.5 + M.groundWidth, {
    lit: true,
    dwell: 9999,
  })
  platforms.push(ground)
  let cursor = ground.x1

  let lo = 0
  let hi = 0
  let melodiesSeen = 0
  let afterBoundary = false // wider first gap after a segment boundary

  for (const seg of level.segments) {
    if (seg.type === 'rest') {
      cursor += (seg.beats ?? 1) * M.restUnit[mode]
      afterBoundary = true
      continue
    }

    if (seg.type === 'encounter') {
      const wx = cursor + M.paneGap[mode]
      const pane: Pane = {
        wx,
        midi: groundMidi + seg.at,
        kind: seg.kind,
        res: 0,
        burstT: -1,
        reveal: 0,
        shards: [],
      }
      panes.push(pane)
      nodes.push({
        t: 'pane',
        pane,
        hint:
          seg.hint ??
          (mode === 'platformer'
            ? `A glass wall rings at ${name(seg.at)} — press close and sing it open.`
            : `The ${seg.kind} rings at ${name(seg.at)}. Hold its note.`),
      })
      if (seg.at < lo) lo = seg.at
      if (seg.at > hi) hi = seg.at
      cursor = wx + M.paneAfter
      afterBoundary = true
      continue
    }

    // melody segment: one platform per note, width from duration
    const m = seg.melody
    const r = melodyRange(m)
    if (r.lo < lo) lo = r.lo
    if (r.hi > hi) hi = r.hi
    melodiesSeen += 1
    for (let i = 0; i < m.degrees.length; i++) {
      const deg = m.degrees[i]
      const gap = i === 0 && afterBoundary ? M.phraseGap[mode] : M.noteGap[mode]
      const x0 = cursor + gap
      const width = Math.max(M.minWidth, m.durations[i] * M.unitsPerBeat[mode])
      const p = platform(groundMidi + deg, x0, x0 + width, {
        syllable: m.syllables?.[i],
      })
      platforms.push(p)
      const syl = m.syllables?.[i]
      nodes.push({
        t: 'land',
        p,
        hint:
          syl !== undefined
            ? `Sing "${syl}" — ${name(deg)}.`
            : `Sing ${name(deg)}.`,
        // each later phrase starts a checkpoint; the ground is the first
        checkpoint: i === 0 && melodiesSeen > 1 ? true : undefined,
      })
      cursor = x0 + width
      afterBoundary = false
    }
    afterBoundary = true
  }

  return {
    platforms,
    panes,
    nodes,
    worldMax: cursor + M.endPad,
    windowLo: lo - M.windowLoPad,
    windowHi: hi + M.windowHiPad,
    startX: ground.x0 + 0.9,
  }
}
