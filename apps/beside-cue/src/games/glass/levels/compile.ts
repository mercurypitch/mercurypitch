// ============================================================
// compileLevel — the bridge from content to stage.
//
// A pure function: LevelDef + (mode, calibrated ground note) → the world
// the stage engine runs (platforms, panes, node chain, pitch window).
// The same level compiles for any mode; only geometry pacing changes —
// intervals stay the path. Rhythm-game precedent: one beatmap, many
// rulesets, converted per ruleset (osu!lazer's IBeatmapConverter).
//
// Range fit: with melody.centerRange the song's midpoint lands ON the
// hummed note (a 0..+9 tune becomes −5..+4 around the voice), and
// rangeBias shifts the whole song lower/higher — the "Songs sit"
// setting. A later guided range-finder (sing your lowest, sing your
// highest) plugs into the same shift: it just computes the bias from a
// measured range instead of a preference.
//
// Purity matters: no engine, no DOM, no audio — unit-testable, and the
// output shape is plain data so a remote songbook stays a fetch away.
// ============================================================

import { midiToNoteNameOctave } from '@irchiinnuss/pitch-engine'
import { JOURNEY_CONFIG } from '../journey-config'
import type { AtriumZone, BeamZone, Node, Pane, Platform } from '../world-types'
import type { GameFeel } from './feel'
import type { LevelDef, MelodyDef } from './types'

export type PlayMode = 'flow' | 'platformer' | 'rhythm' | 'listen'

export interface CompileOpts {
  mode: PlayMode
  groundMidi: number
  /** Extra semitones to shift the whole song (the range setting):
   * negative sits the song lower, positive higher. Default 0. */
  rangeBias?: number
  /** Merged per-level config (applyFeel) — pacing geometry can differ
   * per level too. Defaults to JOURNEY_CONFIG when omitted. */
  feel?: GameFeel
}

export interface CompiledStage {
  platforms: Platform[]
  panes: Pane[]
  beams: BeamZone[]
  atriums: AtriumZone[]
  nodes: Node[]
  worldMax: number
  /** Pitch window, semitone offsets relative to the ground note — derived
   * from the melody's range instead of the fixed default window. */
  windowLo: number
  windowHi: number
  /** Merc's starting world x (on the lit ground slab). */
  startX: number
  /** Semitones the song was shifted relative to a ground-note tonic
   * (range centering + bias) — for debugging and future range tools. */
  shift: number
}

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

/** Degree range across every segment (melody notes and pane notes). */
const levelRange = (level: LevelDef): { lo: number; hi: number } => {
  let lo = 0
  let hi = 0
  const eat = (d: number): void => {
    if (d < lo) lo = d
    if (d > hi) hi = d
  }
  for (const seg of level.segments) {
    if (seg.type === 'encounter') eat(seg.at)
    else if (seg.type === 'melody') for (const d of seg.melody.degrees) eat(d)
  }
  return { lo, hi }
}

export const compileLevel = (
  level: LevelDef,
  opts: CompileOpts,
): CompiledStage => {
  const { mode, groundMidi } = opts
  const M = (opts.feel ?? JOURNEY_CONFIG).melody

  // range fit: center the song on the hummed note, then apply the bias
  const range = levelRange(level)
  const shift =
    (M.centerRange ? -Math.round((range.lo + range.hi) / 2) : 0) +
    (opts.rangeBias ?? 0)
  const midiFor = (deg: number): number => groundMidi + shift + deg
  const name = (deg: number): string => midiToNoteNameOctave(midiFor(deg))

  const platforms: Platform[] = []
  const panes: Pane[] = []
  const beams: BeamZone[] = []
  const atriums: AtriumZone[] = []
  const nodes: Node[] = []

  // The starting slab sits at the SONG'S FIRST NOTE, not the hummed note
  // (the hummed note only anchors the transposition). It is already lit —
  // calibration was its singing — and captioned so that reads as given.
  // Merc starts standing on the melody's opening pitch; the first
  // objective is one step ahead at the same height.
  const firstMelody = level.segments.find((s) => s.type === 'melody')
  const firstDeg =
    firstMelody?.type === 'melody' ? firstMelody.melody.degrees[0] : 0
  const ground = platform(midiFor(firstDeg), 0.5, 0.5 + M.groundWidth, {
    lit: true,
    dwell: 9999,
    syllable: 'start',
  })
  platforms.push(ground)
  let cursor = ground.x1

  let melodiesSeen = 0
  let afterBoundary = false // wider first gap after a segment boundary

  for (const seg of level.segments) {
    if (seg.type === 'rest') {
      cursor += (seg.beats ?? 1) * M.restUnit[mode]
      afterBoundary = true
      continue
    }

    if (seg.type === 'encounter') {
      if (mode === 'rhythm' || mode === 'listen') {
        // no held notes in tap play, no pane questions yet in listen:
        // an encounter is a two-beat rest
        cursor += 2 * M.restUnit[mode]
        afterBoundary = true
        continue
      }
      const wx = cursor + M.paneGap[mode]
      const pane: Pane = {
        wx,
        midi: midiFor(seg.at),
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
          (seg.kind === 'ring'
            ? `The round pane hums at ${name(seg.at)}. Hold its note steady — then let your voice WAVE.`
            : mode === 'platformer'
              ? `A glass wall rings at ${name(seg.at)} — press close and sing it open.`
              : `The ${seg.kind} rings at ${name(seg.at)}. Hold its note.`),
      })
      cursor = wx + M.paneAfter
      afterBoundary = true
      continue
    }

    if (seg.type === 'beam') {
      const beats = seg.beats ?? 4
      if (mode === 'rhythm' || mode === 'listen') {
        cursor += beats * M.restUnit[mode]
        afterBoundary = true
        continue
      }
      const bm = midiFor(seg.at)
      const x0 = cursor + M.noteGap[mode]
      const x1 = x0 + beats * M.unitsPerBeat[mode]
      if (mode === 'platformer') {
        // keys walk — the beam is frozen solid here
        platforms.push(platform(bm, x0, x1, { syllable: 'beam' }))
        nodes.push({
          t: 'land',
          p: platforms[platforms.length - 1],
          hint: `A frozen light-bridge — walk it at ${name(seg.at)}.`,
        })
      } else {
        const beam: BeamZone = { x0, x1, midi: bm, done: false }
        beams.push(beam)
        nodes.push({
          t: 'beam',
          beam,
          hint:
            seg.hint ??
            `A light-bridge, only as steady as your note — hold ${name(seg.at)} all the way across.`,
        })
      }
      cursor = x1
      afterBoundary = true
      continue
    }

    if (seg.type === 'atrium') {
      const beats = seg.beats ?? 8
      if (mode === 'rhythm' || mode === 'listen') {
        cursor += beats * M.restUnit[mode]
        afterBoundary = true
        continue
      }
      const x0 = cursor + M.phraseGap[mode]
      const x1 = x0 + beats * M.unitsPerBeat[mode]
      const A = (opts.feel ?? JOURNEY_CONFIG).atrium
      const a: AtriumZone = {
        x0,
        x1,
        tonicMidi: midiFor(0),
        scaleMidis: A.scaleDegrees.map((d) => midiFor(d)),
      }
      atriums.push(a)
      nodes.push({
        t: 'atrium',
        a,
        hint:
          seg.hint ??
          'The open room — only notes in its key carry you on, and each raises a step. Walk your own melody out.',
      })
      cursor = x1
      afterBoundary = true
      continue
    }

    // melody segment: one platform per note, width from duration
    const m: MelodyDef = seg.melody
    melodiesSeen += 1
    const glass = new Set(mode === 'rhythm' ? [] : (m.glassAt ?? []))
    for (let i = 0; i < m.degrees.length; i++) {
      const deg = m.degrees[i]
      const gap = i === 0 && afterBoundary ? M.phraseGap[mode] : M.noteGap[mode]
      const x0 = cursor + gap
      const width = Math.max(M.minWidth, m.durations[i] * M.unitsPerBeat[mode])
      const p = platform(midiFor(deg), x0, x0 + width, {
        syllable: m.syllables?.[i],
        kind: glass.has(i) ? 'glass' : 'stone',
      })
      platforms.push(p)
      const syl = m.syllables?.[i]
      nodes.push({
        t: 'land',
        p,
        hint:
          mode === 'listen'
            ? 'Listen — then tap the slab you heard.'
            : mode === 'rhythm'
              ? syl !== undefined
                ? `Tap "${syl}".`
                : 'Tap the slab.'
              : syl !== undefined
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

  // the window covers the shifted song (the start slab is inside it by
  // construction — its pitch is the song's first note). Listen adds the
  // candidate fan's reach: phantom rungs sit gapSemis*(fanSize−1) beyond
  // any melody note, and the window must hold every rung.
  const L = (opts.feel ?? JOURNEY_CONFIG).listen
  const fanPad = mode === 'listen' ? L.gapSemis * (L.fanSize - 1) : 0
  // an atrium offers scale steps that can top the melody's own range
  const atriumTop =
    atriums.length > 0
      ? Math.max(
          0,
          ...atriums.flatMap((a) =>
            a.scaleMidis.map((m2) => m2 - groundMidi - shift),
          ),
        )
      : 0
  const winLo = range.lo + shift - M.windowLoPad - fanPad
  const winHi = Math.max(range.hi, atriumTop) + shift + M.windowHiPad + fanPad

  return {
    platforms,
    panes,
    beams,
    atriums,
    nodes,
    worldMax: cursor + M.endPad,
    windowLo: winLo,
    windowHi: winHi,
    startX: ground.x0 + 0.9,
    shift,
  }
}
