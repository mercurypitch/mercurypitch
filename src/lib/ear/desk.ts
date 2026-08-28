// ============================================================
// desk — the mixing desk's bands, faults and drills.
//
// Three drills on one source — the user's separated song when there
// is one, the house loop otherwise — each trial rendered offline
// through the fault under test. Colour asks which octave band was
// boosted, with the boost shrinking on the catalogue's staircase;
// Weight asks which of two renders carries the heavier low end;
// Critique asks the name of a fault from a bank at frozen strength.
//
// The desk reads on its own plate. Its drills take Colour's settings
// from the catalogue but record under desk ids, so the Column's
// estimate — which reads every catalogue drill — never sees them.
// ============================================================

import type { EarBankItem } from './banks'
import type { IdentificationDrill, ThresholdDrill } from './drills'
import { findIdentificationDrill, findThresholdDrill } from './drills'

export interface DeskBand {
  id: string
  hz: number
  label: string
  /** The word a mixer would use. */
  word: string
}

/** Six octave bands, low to air. */
export const DESK_BANDS: readonly DeskBand[] = [
  { id: 'b125', hz: 125, label: '125 Hz', word: 'low' },
  { id: 'b250', hz: 250, label: '250 Hz', word: 'low-mid' },
  { id: 'b500', hz: 500, label: '500 Hz', word: 'mid' },
  { id: 'b1k', hz: 1000, label: '1 kHz', word: 'upper-mid' },
  { id: 'b2k', hz: 2000, label: '2 kHz', word: 'presence' },
  { id: 'b4k', hz: 4000, label: '4 kHz', word: 'air' },
]

export type FaultSpec =
  | { kind: 'peak'; hz: number; q: number; db: number }
  | { kind: 'shelf'; hz: number; db: number }
  | { kind: 'pump' }
  | { kind: 'narrow' }

/** A boost on one octave band at the staircase's level. */
export function bandBoost(band: DeskBand, db: number): FaultSpec {
  return { kind: 'peak', hz: band.hz, q: 1.1, db }
}

/** The low shelf Weight adds below 120 Hz. */
export function lowShelf(db: number): FaultSpec {
  return { kind: 'shelf', hz: 120, db }
}

export function pickBand(random: () => number = Math.random): DeskBand {
  return DESK_BANDS[
    Math.min(DESK_BANDS.length - 1, Math.floor(random() * DESK_BANDS.length))
  ]
}

export interface DeskFault {
  id: string
  label: string
  /** Reveal copy. */
  name: string
  spec: FaultSpec
  seed: number
}

/** The faults Critique names, at frozen strengths. */
export const DESK_FAULTS: readonly DeskFault[] = [
  {
    id: 'mud',
    label: 'Mud',
    name: 'Mud — a build-up around 250 Hz',
    spec: { kind: 'peak', hz: 250, q: 1, db: 7 },
    seed: 1000,
  },
  {
    id: 'box',
    label: 'Box',
    name: 'Box — a hump around 500 Hz',
    spec: { kind: 'peak', hz: 500, q: 1.2, db: 7 },
    seed: 1150,
  },
  {
    id: 'harsh',
    label: 'Harsh',
    name: 'Harsh — a peak around 3 kHz',
    spec: { kind: 'peak', hz: 3000, q: 1.2, db: 7 },
    seed: 1050,
  },
  {
    id: 'sibilance',
    label: 'Sibilance',
    name: 'Sibilance — a shelf of air from 8 kHz',
    spec: { kind: 'peak', hz: 8000, q: 0.9, db: 8 },
    seed: 1100,
  },
  {
    id: 'pumping',
    label: 'Pumping',
    name: 'Pumping — a compressor breathing on the beat',
    spec: { kind: 'pump' },
    seed: 1250,
  },
  {
    id: 'narrow',
    label: 'Narrow',
    name: 'Narrow — the stereo folded to the middle',
    spec: { kind: 'narrow' },
    seed: 1300,
  },
]

export const CRITIQUE_BANK: EarBankItem[] = DESK_FAULTS.map((fault, i) => ({
  itemId: `critique:${fault.id}`,
  label: fault.label,
  name: fault.name,
  seed: fault.seed,
  payload: [i],
}))

export function faultOf(itemId: string): DeskFault | undefined {
  return DESK_FAULTS.find((fault) => `critique:${fault.id}` === itemId)
}

// ── The desk's drills ─────────────────────────────────────────

export type DeskTrack = 'desk-colour' | 'desk-weight' | 'desk-critique'

function colourBase(): ThresholdDrill {
  const base = findThresholdDrill('colour')
  if (base === undefined) throw new Error('colour missing from catalogue')
  return base
}

function eloScale(): IdentificationDrill['scale'] {
  const base = findIdentificationDrill('stack')
  if (base === undefined) throw new Error('stack missing from catalogue')
  return base.scale
}

/** Colour is the catalogue's drill under the desk's id; Weight and
 *  Critique are the desk's own, on the same faculty. */
export const DESK_DRILLS: {
  colour: ThresholdDrill
  weight: ThresholdDrill
  critique: IdentificationDrill
} = {
  colour: { ...colourBase(), id: 'desk-colour' },
  weight: {
    ...colourBase(),
    id: 'desk-weight',
    name: 'Weight',
    unit: 'dB shelf',
    unitShort: 'dB',
    staircase: { ...colourBase().staircase, start: 6, min: 0.25, max: 12 },
    scale: { novice: 6, expert: 1, curve: 'log' },
  },
  critique: {
    id: 'desk-critique',
    faculty: 'colour',
    name: 'Critique',
    choices: DESK_FAULTS.length,
    scale: eloScale(),
  },
}

export const DESK_TRACKS: readonly DeskTrack[] = [
  'desk-colour',
  'desk-weight',
  'desk-critique',
]
