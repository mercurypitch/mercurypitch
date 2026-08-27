// ============================================================
// Ear Lab — identification item banks (Leap, Stack, Contour).
//
// Home has its own bespoke bank (item-bank.ts) because of the
// cadence machinery; every other identification drill shares this
// generic shape: items with stable ids, authored seed difficulties
// that self-calibrate until frozen, and one picker that serves the
// player's desirable-difficulty band without back-to-back repeats.
//
// Item payloads are plain numbers (semitones, chord intervals,
// gap cents) so the banks stay data — the drill specs turn them
// into sound.
// ============================================================

import type { Rating } from './elo'
import { targetDifficulty } from './elo'

export interface EarBankItem {
  /** Stable id — Elo state and confusion counts key off this. */
  itemId: string
  /** Short label (button face, confusion axes). */
  label: string
  /** Longer name (button subtitle, reveal copy). */
  name: string
  /** Authored starting difficulty on the Elo scale. */
  seed: number
  /** Drill-specific numbers (semitones, intervals, cents…). */
  payload: readonly number[]
}

// ── Leap: interval identification (the supporting drill) ────────

/** Seeds follow the well-worn difficulty ladder: the frame intervals
 *  (octave, fifth, fourth) come easiest, the tritone and the wide
 *  minor intervals hardest. */
export const LEAP_BANK: readonly EarBankItem[] = [
  {
    itemId: 'leap:m2',
    label: 'm2',
    name: 'Minor 2nd',
    seed: 1150,
    payload: [1],
  },
  {
    itemId: 'leap:M2',
    label: 'M2',
    name: 'Major 2nd',
    seed: 1100,
    payload: [2],
  },
  {
    itemId: 'leap:m3',
    label: 'm3',
    name: 'Minor 3rd',
    seed: 1150,
    payload: [3],
  },
  {
    itemId: 'leap:M3',
    label: 'M3',
    name: 'Major 3rd',
    seed: 1100,
    payload: [4],
  },
  {
    itemId: 'leap:P4',
    label: 'P4',
    name: 'Perfect 4th',
    seed: 1050,
    payload: [5],
  },
  { itemId: 'leap:TT', label: 'TT', name: 'Tritone', seed: 1400, payload: [6] },
  {
    itemId: 'leap:P5',
    label: 'P5',
    name: 'Perfect 5th',
    seed: 1000,
    payload: [7],
  },
  {
    itemId: 'leap:m6',
    label: 'm6',
    name: 'Minor 6th',
    seed: 1350,
    payload: [8],
  },
  {
    itemId: 'leap:M6',
    label: 'M6',
    name: 'Major 6th',
    seed: 1250,
    payload: [9],
  },
  {
    itemId: 'leap:m7',
    label: 'm7',
    name: 'Minor 7th',
    seed: 1300,
    payload: [10],
  },
  {
    itemId: 'leap:M7',
    label: 'M7',
    name: 'Major 7th',
    seed: 1350,
    payload: [11],
  },
  { itemId: 'leap:P8', label: 'P8', name: 'Octave', seed: 950, payload: [12] },
]

// ── Stack: chord quality ────────────────────────────────────────

/** Payload = intervals above the root. Major/minor anchor the scale;
 *  augmented is famously the last quality ears untangle. */
export const STACK_BANK: readonly EarBankItem[] = [
  {
    itemId: 'stack:maj',
    label: 'Maj',
    name: 'Major',
    seed: 950,
    payload: [4, 7],
  },
  {
    itemId: 'stack:min',
    label: 'Min',
    name: 'Minor',
    seed: 1000,
    payload: [3, 7],
  },
  {
    itemId: 'stack:dim',
    label: 'Dim',
    name: 'Diminished',
    seed: 1300,
    payload: [3, 6],
  },
  {
    itemId: 'stack:aug',
    label: 'Aug',
    name: 'Augmented',
    seed: 1400,
    payload: [4, 8],
  },
  {
    itemId: 'stack:sus4',
    label: 'Sus4',
    name: 'Suspended 4th',
    seed: 1200,
    payload: [5, 7],
  },
  {
    itemId: 'stack:dom7',
    label: '7',
    name: 'Dominant 7th',
    seed: 1150,
    payload: [4, 7, 10],
  },
]

// ── Contour: up / down / same, at speed ─────────────────────────

/** Items are gap tiers, not answers: every trial draws its direction
 *  fresh (up, down or same at equal odds) and the tier only sets how
 *  far apart the two tones sit. The 25-cent tier deliberately dips
 *  toward Hairline territory — the drills meet where discrimination
 *  becomes contour. Payload = [gap in cents]. */
export const CONTOUR_BANK: readonly EarBankItem[] = [
  {
    itemId: 'contour:400',
    label: '400¢',
    name: 'Wide leaps',
    seed: 900,
    payload: [400],
  },
  {
    itemId: 'contour:200',
    label: '200¢',
    name: 'Whole steps',
    seed: 1050,
    payload: [200],
  },
  {
    itemId: 'contour:100',
    label: '100¢',
    name: 'Half steps',
    seed: 1200,
    payload: [100],
  },
  {
    itemId: 'contour:50',
    label: '50¢',
    name: 'Quarter tones',
    seed: 1350,
    payload: [50],
  },
  {
    itemId: 'contour:25',
    label: '25¢',
    name: 'Hairline gaps',
    seed: 1500,
    payload: [25],
  },
]

// ── Pulse: rhythm dictation, tapped back ────────────────────────

/** Onsets in beats within one bar of four. Seeds climb with the
 *  finest subdivision in the pattern (quarters, eighths, triplets,
 *  sixteenths) and with the count of onsets; `rhythm-take.ts` reads
 *  the tolerance tier straight off the payload. */
export const PULSE_BANK: readonly EarBankItem[] = [
  {
    itemId: 'p-q3',
    label: '3 quarters',
    name: 'Three quarters',
    seed: 900,
    payload: [0, 1, 2],
  },
  {
    itemId: 'p-q4',
    label: '4 quarters',
    name: 'Four quarters',
    seed: 950,
    payload: [0, 1, 2, 3],
  },
  {
    itemId: 'p-q-rest',
    label: 'rest on 2',
    name: 'A rest on two',
    seed: 1000,
    payload: [0, 2, 3],
  },
  {
    itemId: 'p-e-and',
    label: 'and of 2',
    name: 'The and of two',
    seed: 1100,
    payload: [0, 1, 1.5, 2],
  },
  {
    itemId: 'p-e-one',
    label: 'eighths on 1',
    name: 'Eighths on one',
    seed: 1150,
    payload: [0, 0.5, 1, 2, 3],
  },
  {
    itemId: 'p-e-off',
    label: 'off the beat',
    name: 'Off the beat',
    seed: 1250,
    payload: [0.5, 1, 2.5, 3],
  },
  {
    itemId: 'p-e-run',
    label: 'eighth run',
    name: 'An eighth run',
    seed: 1300,
    payload: [0, 0.5, 1, 1.5, 2, 3],
  },
  {
    itemId: 'p-t-one',
    label: 'triplet on 1',
    name: 'A triplet on one',
    seed: 1400,
    payload: [0, 1 / 3, 2 / 3, 1],
  },
  {
    itemId: 'p-t-two',
    label: 'triplet on 2',
    name: 'A triplet on two',
    seed: 1500,
    payload: [0, 1, 4 / 3, 5 / 3, 2],
  },
  {
    itemId: 'p-s-one',
    label: '16ths on 1',
    name: 'Sixteenths on one',
    seed: 1550,
    payload: [0, 0.25, 0.5, 1],
  },
  {
    itemId: 'p-s-gallop',
    label: 'gallop',
    name: 'A gallop',
    seed: 1600,
    payload: [0, 0.75, 1, 2],
  },
  {
    itemId: 'p-s-mixed',
    label: 'mixed',
    name: 'Mixed subdivisions',
    seed: 1700,
    payload: [0, 0.5, 0.75, 1, 2.5],
  },
]

// ── Generic state + picker ──────────────────────────────────────

/** An item's current rating: stored override or fresh at the seed. */
export function bankItemState(
  states: Readonly<Record<string, Rating>>,
  item: EarBankItem,
): Rating {
  return states[item.itemId] ?? { rating: item.seed, attempts: 0 }
}

/** Same softmax temperature as Home's picker: neighbours of the
 *  ideal item still appear, but a beginner is not fed the tritone
 *  on round two. */
const PICK_TEMPERATURE = 180

export function pickBankItem(
  bank: readonly EarBankItem[],
  itemStates: Readonly<Record<string, Rating>>,
  playerRating: number,
  options?: {
    random?: () => number
    avoidItemId?: string
    guessRate?: number
  },
): EarBankItem {
  const random = options?.random ?? Math.random
  const target = targetDifficulty(playerRating, 0.75, options?.guessRate ?? 0)

  const candidates = bank.filter(
    (item) => bank.length === 1 || item.itemId !== options?.avoidItemId,
  )
  const weights = candidates.map((item) =>
    Math.exp(
      -Math.abs(bankItemState(itemStates, item).rating - target) /
        PICK_TEMPERATURE,
    ),
  )
  const total = weights.reduce((a, b) => a + b, 0)

  let roll = random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
