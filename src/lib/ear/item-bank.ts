// ============================================================
// Ear Lab — the Home item bank (Faculty II, the spine).
//
// Home's items are the seven diatonic degrees. A key is planted by
// an I-IV-V-I cadence, a probe note sounds, and the answer is the
// degree — trained in context, because context is what transfers
// to real music (plan §1.2). The key itself is roved per round and
// is deliberately NOT part of an item's identity: the skill being
// rated is degree-hearing, not C-major-hearing.
//
// Seed difficulties are authored (tonic easiest, leading tone
// hardest) and self-calibrate through the Elo item updates until
// frozen; the picker serves whatever sits nearest the player's
// desirable-difficulty band.
// ============================================================

import type { Rating } from './elo'
import { targetDifficulty } from './elo'

export const HOME_DRILL_ID = 'home'

/** The sung/played answer mode rates under its own id: the same
 *  frozen item yardsticks, but a separate player rating, so "ear
 *  (tap) vs voice (sing)" is a real comparison instead of one
 *  blurred number. */
export const HOME_SING_DRILL_ID = 'home-sing'

/** Guess floor for a 7-button answer, kept next to the items so the
 *  store and the drill cannot drift apart on it. Sung answers have
 *  no menu to guess from — their floor is zero. */
export const HOME_CHOICES = 7

export interface HomeDegree {
  /** 1-based scale degree. */
  degree: number
  /** Semitones above the tonic (major scale). */
  semitone: number
  solfege: string
  /** Authored starting difficulty on the Elo scale. */
  seed: number
  /** Pad label where the number alone misleads (♭2, ♯4). */
  label?: string
}

/** Ordered by degree. Seeds follow the pedagogy consensus: the tonal
 *  anchors (1, 5, 3) come easiest, the tendency tones (4, 7) hardest
 *  because they are heard as pulls toward their neighbours. */
export const HOME_DEGREES: readonly HomeDegree[] = [
  { degree: 1, semitone: 0, solfege: 'Do', seed: 950 },
  { degree: 2, semitone: 2, solfege: 'Re', seed: 1150 },
  { degree: 3, semitone: 4, solfege: 'Mi', seed: 1050 },
  { degree: 4, semitone: 5, solfege: 'Fa', seed: 1250 },
  { degree: 5, semitone: 7, solfege: 'Sol', seed: 1000 },
  { degree: 6, semitone: 9, solfege: 'La', seed: 1200 },
  { degree: 7, semitone: 11, solfege: 'Ti', seed: 1300 },
]

/** The chromatic twelve for Gravity, numbered 1..12 by semitone. The
 *  diatonic seven keep Home's seeds plus a hundred for the wider menu;
 *  the five between them start harder still. */
export const GRAVITY_DEGREES: readonly HomeDegree[] = [
  { degree: 1, semitone: 0, solfege: 'Do', seed: 1050, label: '1' },
  { degree: 2, semitone: 1, solfege: 'Ra', seed: 1350, label: '♭2' },
  { degree: 3, semitone: 2, solfege: 'Re', seed: 1250, label: '2' },
  { degree: 4, semitone: 3, solfege: 'Me', seed: 1300, label: '♭3' },
  { degree: 5, semitone: 4, solfege: 'Mi', seed: 1150, label: '3' },
  { degree: 6, semitone: 5, solfege: 'Fa', seed: 1350, label: '4' },
  { degree: 7, semitone: 6, solfege: 'Fi', seed: 1350, label: '♯4' },
  { degree: 8, semitone: 7, solfege: 'Sol', seed: 1100, label: '5' },
  { degree: 9, semitone: 8, solfege: 'Le', seed: 1300, label: '♭6' },
  { degree: 10, semitone: 9, solfege: 'La', seed: 1300, label: '6' },
  { degree: 11, semitone: 10, solfege: 'Te', seed: 1250, label: '♭7' },
  { degree: 12, semitone: 11, solfege: 'Ti', seed: 1400, label: '7' },
]

/** What a degree drill runs over: its degrees, its two rating tracks
 *  and its item namespace. Home is the diatonic seven; Gravity the
 *  chromatic twelve. */
export interface DegreeSet {
  tapDrillId: string
  micDrillId: string
  degrees: readonly HomeDegree[]
  /** Guess floor for the tap menu: 1 / choices. */
  choices: number
  itemId: (degree: number) => string
}

export const HOME_SET: DegreeSet = {
  tapDrillId: HOME_DRILL_ID,
  micDrillId: HOME_SING_DRILL_ID,
  degrees: HOME_DEGREES,
  choices: HOME_CHOICES,
  itemId: homeItemId,
}

export const GRAVITY_SET: DegreeSet = {
  tapDrillId: 'gravity',
  micDrillId: 'gravity-sing',
  degrees: GRAVITY_DEGREES,
  choices: GRAVITY_DEGREES.length,
  itemId: (degree) => `gravity:deg-${degree}`,
}

/** The pad's word for a degree: its label when it has one, else the
 *  number. */
export function degreeLabel(degree: HomeDegree | null | undefined): string {
  if (!degree) return ''
  return degree.label ?? String(degree.degree)
}

/** Stable item id — Elo state and confusion counts key off this, so
 *  it must never change once user data exists. */
export function homeItemId(degree: number): string {
  return `home:deg-${degree}`
}

export function homeDegree(degree: number): HomeDegree | undefined {
  return HOME_DEGREES.find((d) => d.degree === degree)
}

/** An item's current rating: the stored override when one exists,
 *  else a fresh rating at the authored seed. */
export function homeItemState(
  states: Readonly<Record<string, Rating>>,
  degree: number,
  set: DegreeSet = HOME_SET,
): Rating {
  const stored = states[set.itemId(degree)]
  if (stored !== undefined) return stored
  const seed = set.degrees.find((d) => d.degree === degree)?.seed ?? 1100
  return { rating: seed, attempts: 0 }
}

// ── Audio material ──────────────────────────────────────────────

/** I-IV-V-I in compact voicings that stay within one octave of the
 *  tonic, so the cadence sounds like one hand at a keyboard rather
 *  than three leaps. The V voicing puts the leading tone a semitone
 *  under the tonic — the pull the whole drill is teaching. */
export function cadenceChordMidis(rootMidi: number): number[][] {
  return [
    [rootMidi, rootMidi + 4, rootMidi + 7], // I
    [rootMidi, rootMidi + 5, rootMidi + 9], // IV (6-4 over the tonic bass)
    [rootMidi - 1, rootMidi + 2, rootMidi + 7], // V (leading tone below)
    [rootMidi, rootMidi + 4, rootMidi + 7], // I
  ]
}

/** Where the probe note for a degree sounds, relative to the roved
 *  root. Kept inside the octave above the tonic in v1 — register
 *  roving is a difficulty layer for later, not a different item. */
export function probeMidi(
  rootMidi: number,
  degree: number,
  set: DegreeSet = HOME_SET,
): number {
  const semitone = set.degrees.find((d) => d.degree === degree)?.semitone ?? 0
  return rootMidi + semitone
}

/** Rove the key: an integer tonic in C3..B3, log-uniform enough at
 *  this width. Roving denies the ear a fixed reference pitch, so
 *  absolute memory cannot stand in for functional hearing. */
export function roveRootMidi(random: () => number = Math.random): number {
  return 48 + Math.floor(random() * 12)
}

// ── Selection ───────────────────────────────────────────────────

export interface PickedHomeItem {
  itemId: string
  degree: HomeDegree
  difficulty: number
}

/** Softmax temperature over |difficulty − target|, in Elo points.
 *  Wide enough that neighbours of the ideal item still appear (the
 *  drill must not loop one degree), narrow enough that a beginner
 *  is not fed the leading tone on round two. */
const PICK_TEMPERATURE = 180

/**
 * Pick the next Home item: aim at the player's ~75% band, weight
 * degrees by closeness to it, and never repeat the previous item
 * back-to-back.
 */
export function pickHomeItem(
  itemStates: Readonly<Record<string, Rating>>,
  playerRating: number,
  options?: { random?: () => number; avoidItemId?: string; set?: DegreeSet },
): PickedHomeItem {
  const random = options?.random ?? Math.random
  const set = options?.set ?? HOME_SET
  const target = targetDifficulty(playerRating, 0.75, 1 / set.choices)

  const candidates = set.degrees
    .map((degree) => ({
      degree,
      itemId: set.itemId(degree.degree),
      difficulty: homeItemState(itemStates, degree.degree, set).rating,
    }))
    .filter(
      (c) =>
        options?.avoidItemId === undefined ||
        c.itemId !== options.avoidItemId ||
        set.degrees.length === 1,
    )

  const weights = candidates.map((c) =>
    Math.exp(-Math.abs(c.difficulty - target) / PICK_TEMPERATURE),
  )
  const total = weights.reduce((a, b) => a + b, 0)

  let roll = random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
