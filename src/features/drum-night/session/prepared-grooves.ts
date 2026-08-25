// ============================================================
// Prepared Drum Night grooves — deterministic first-play sessions
// ============================================================
//
// These grooves are canonical percussion documents, not decorative lane data.
// The injected DrumSession scheduler can therefore play the same authored hits
// that Pocket, Score, Seat, and Coach read, without another clock or audio path.

import type { MidiSong, MidiSongPercussionHit, MidiSongPercussionTrack, } from '@/lib/midi-song'
import type { DrumSeatAnchor } from './drum-score'
import { projectDrumGroove } from './drum-score'
import type { DrumSessionDocument } from './drum-session'
import { drumSessionStateFromSong } from './drum-session'

export const FIRST_POCKET_DEFAULT_VARIANT = 'source' as const

export const FIRST_POCKET_VARIANTS = [
  {
    id: 'source',
    label: 'Source',
    description: 'The authored pocket, with a restrained push and pull.',
  },
  {
    id: 'tight',
    label: 'Tight',
    description: 'The same voices and dynamics locked to the sixteenth grid.',
  },
  {
    id: 'loose',
    label: 'Loose',
    description: 'The same phrase with a wider, deliberate laid-back feel.',
  },
  {
    id: 'half-time',
    label: 'Half-time',
    description:
      'A reauthored two-bar pocket with one strong backbeat per bar.',
  },
] as const

export type FirstPocketVariantId = (typeof FIRST_POCKET_VARIANTS)[number]['id']

export interface FirstPocketVariant {
  readonly id: FirstPocketVariantId
  readonly label: string
  readonly description: string
}

export interface PreparedPocketHit {
  readonly id: string
  readonly gmKey: number
  readonly velocity: number
  /** Exact authored beat, including any intentional feel offset. */
  readonly beat: number
  /** Zero-based sixteenth-note cell used by the compact Pocket projection. */
  readonly stepIndex: number
  /** Authored displacement from that cell in quarter-note beats. */
  readonly offsetBeats: number
  /** Normalized position in the two-bar loop, always in [0, 1). */
  readonly phase: number
  readonly seatAnchor: DrumSeatAnchor
}

export interface PreparedPocketProjection {
  readonly startBeat: number
  readonly durationBeats: number
  readonly subdivisionBeats: number
  readonly stepCount: number
  readonly hitCount: number
  readonly offGridHitCount: number
  readonly peakVelocity: number
  /** Active hits only; empty grid cells never inflate the UI model. */
  readonly hits: readonly PreparedPocketHit[]
}

export interface PreparedDrumGroove {
  readonly id: 'first-pocket'
  readonly variant: FirstPocketVariant
  readonly document: DrumSessionDocument
  readonly pocket: PreparedPocketProjection
}

interface PreparedHitSeed {
  readonly id: string
  readonly gmKey: number
  readonly velocity: number
  readonly gridBeat: number
  readonly writtenDuration: number
}

const FIRST_POCKET_BPM = 84
const FIRST_POCKET_DURATION_BEATS = 8
const POCKET_SUBDIVISION_BEATS = 0.25

const HAT_VELOCITIES = [
  92, 64, 78, 60, 86, 66, 80, 58, 94, 65, 80, 62, 88, 68, 82, 72,
] as const

const KICK_BEATS = [0, 1.5, 2.75, 3.5, 4, 5.25, 6.5, 7.25] as const
const KICK_VELOCITIES = [112, 86, 101, 79, 115, 92, 106, 84] as const
const SNARE_BEATS = [1, 3, 5, 7] as const
const SNARE_VELOCITIES = [112, 118, 110, 121] as const
const GHOST_SNARE_BEATS = [2.5, 6.25] as const
const GHOST_SNARE_VELOCITIES = [44, 48] as const

const SOURCE_HAT_OFFSETS = [
  0, 0.035, 0, 0.03, -0.012, 0.04, 0, 0.025, -0.01, 0.038, 0, 0.032, -0.014,
  0.042, 0, 0,
] as const
const SOURCE_KICK_OFFSETS = [
  0, -0.018, 0.012, -0.015, 0, -0.02, 0.014, -0.016,
] as const
const SOURCE_SNARE_OFFSETS = [0.028, 0.034, 0.026, 0.036] as const
const SOURCE_GHOST_OFFSETS = [0.055, 0.045] as const

const LOOSE_HAT_OFFSETS = [
  0, 0.075, -0.018, 0.068, -0.02, 0.082, -0.016, 0.07, -0.022, 0.084, -0.018,
  0.074, -0.024, 0.088, -0.016, 0,
] as const
const LOOSE_KICK_OFFSETS = [
  0, -0.042, 0.025, -0.038, -0.012, -0.046, 0.028, -0.04,
] as const
const LOOSE_SNARE_OFFSETS = [0.068, 0.076, 0.064, 0.08] as const
const LOOSE_GHOST_OFFSETS = [0.095, 0.088] as const

function numberedId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`
}

function straightPocketSeeds(): PreparedHitSeed[] {
  const hats = HAT_VELOCITIES.map(
    (velocity, index): PreparedHitSeed => ({
      id: numberedId('hat', index),
      gmKey: index === 7 || index === 15 ? 46 : 42,
      velocity,
      gridBeat: index * 0.5,
      writtenDuration: 0.5,
    }),
  )
  const kicks = KICK_BEATS.map(
    (gridBeat, index): PreparedHitSeed => ({
      id: numberedId('kick', index),
      gmKey: 36,
      velocity: KICK_VELOCITIES[index] ?? 80,
      gridBeat,
      writtenDuration: 0.25,
    }),
  )
  const snares = SNARE_BEATS.map(
    (gridBeat, index): PreparedHitSeed => ({
      id: numberedId('snare', index),
      gmKey: 38,
      velocity: SNARE_VELOCITIES[index] ?? 110,
      gridBeat,
      writtenDuration: 0.25,
    }),
  )
  const ghosts = GHOST_SNARE_BEATS.map(
    (gridBeat, index): PreparedHitSeed => ({
      id: numberedId('ghost', index),
      gmKey: 38,
      velocity: GHOST_SNARE_VELOCITIES[index] ?? 44,
      gridBeat,
      writtenDuration: 0.25,
    }),
  )
  return [...hats, ...kicks, ...snares, ...ghosts]
}

function offsetFor(
  seed: PreparedHitSeed,
  variantId: 'source' | 'loose',
): number {
  const index =
    Number.parseInt(seed.id.slice(seed.id.lastIndexOf('-') + 1), 10) - 1
  const arrays =
    variantId === 'source'
      ? {
          hat: SOURCE_HAT_OFFSETS,
          kick: SOURCE_KICK_OFFSETS,
          snare: SOURCE_SNARE_OFFSETS,
          ghost: SOURCE_GHOST_OFFSETS,
        }
      : {
          hat: LOOSE_HAT_OFFSETS,
          kick: LOOSE_KICK_OFFSETS,
          snare: LOOSE_SNARE_OFFSETS,
          ghost: LOOSE_GHOST_OFFSETS,
        }
  const family = seed.id.slice(0, seed.id.indexOf('-')) as keyof typeof arrays
  return arrays[family][index] ?? 0
}

function feelHits(
  variantId: 'source' | 'tight' | 'loose',
): MidiSongPercussionHit[] {
  return straightPocketSeeds()
    .map(
      (seed): MidiSongPercussionHit => ({
        id: seed.id,
        gmKey: seed.gmKey,
        velocity: seed.velocity,
        startBeat:
          seed.gridBeat +
          (variantId === 'tight' ? 0 : offsetFor(seed, variantId)),
        writtenDuration: seed.writtenDuration,
      }),
    )
    .sort((left, right) => left.startBeat - right.startBeat)
}

function halfTimeHits(): MidiSongPercussionHit[] {
  const hats = HAT_VELOCITIES.map(
    (velocity, index): MidiSongPercussionHit => ({
      id: numberedId('hat', index),
      gmKey: index === 7 || index === 15 ? 46 : 42,
      velocity,
      startBeat: index * 0.5,
      writtenDuration: 0.5,
    }),
  )
  const kicks = [0, 1.5, 2.5, 3.5, 4, 5.5, 6.5, 7.5].map(
    (startBeat, index): MidiSongPercussionHit => ({
      id: numberedId('kick', index),
      gmKey: 36,
      velocity: KICK_VELOCITIES[index] ?? 80,
      startBeat,
      writtenDuration: 0.25,
    }),
  )
  const snares = [3, 7].map(
    (startBeat, index): MidiSongPercussionHit => ({
      id: numberedId('snare', index),
      gmKey: 38,
      velocity: [118, 121][index] ?? 110,
      startBeat,
      writtenDuration: 0.25,
    }),
  )
  const ghosts = [2.75, 6.75].map(
    (startBeat, index): MidiSongPercussionHit => ({
      id: numberedId('ghost', index),
      gmKey: 38,
      velocity: GHOST_SNARE_VELOCITIES[index] ?? 44,
      startBeat,
      writtenDuration: 0.25,
    }),
  )
  return [...hats, ...kicks, ...snares, ...ghosts].sort(
    (left, right) => left.startBeat - right.startBeat,
  )
}

function preparedHits(
  variantId: FirstPocketVariantId,
): MidiSongPercussionHit[] {
  return variantId === 'half-time' ? halfTimeHits() : feelHits(variantId)
}

function preparedSong(variantId: FirstPocketVariantId): MidiSong {
  const hits = preparedHits(variantId)
  const track: MidiSongPercussionTrack = {
    id: 'first-pocket',
    kind: 'percussion',
    name: 'First Pocket',
    instrumentName: 'General MIDI Drum Kit',
    noteCount: hits.length,
    notes: [],
    percussionHits: hits,
    droppedHitCount: 0,
  }
  return {
    bpm: FIRST_POCKET_BPM,
    tempoChanges: [{ beat: 0, usPerBeat: 60_000_000 / FIRST_POCKET_BPM }],
    timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
    tracks: [track],
  }
}

export function projectDrumPocket(
  document: DrumSessionDocument,
  options: {
    readonly startBeat?: number
    readonly durationBeats?: number
  } = {},
): PreparedPocketProjection {
  const startBeat = Math.max(0, options.startBeat ?? 0)
  const availableDuration = Math.max(0.25, document.durationBeats - startBeat)
  const durationBeats = Math.min(
    16,
    Math.max(0.25, options.durationBeats ?? Math.min(8, availableDuration)),
  )
  const projection = projectDrumGroove(document, {
    startBeat,
    endBeat: startBeat + durationBeats,
    subdivisionBeats: POCKET_SUBDIVISION_BEATS,
  })
  const hits = projection.steps.flatMap((step) =>
    step.hits.map(
      ({ event, offsetBeats }): PreparedPocketHit => ({
        id: event.hit.id ?? event.id,
        gmKey: event.hit.gmKey,
        velocity: event.hit.velocity,
        beat: event.hit.startBeat,
        stepIndex: step.index,
        offsetBeats,
        phase: (event.hit.startBeat - startBeat) / durationBeats,
        seatAnchor: event.voice.seatAnchor,
      }),
    ),
  )
  return {
    startBeat,
    durationBeats,
    subdivisionBeats: projection.subdivisionBeats,
    stepCount: projection.steps.length,
    hitCount: hits.length,
    offGridHitCount: projection.offGridHitCount,
    peakVelocity: hits.reduce((peak, hit) => Math.max(peak, hit.velocity), 0),
    hits,
  }
}

export function isFirstPocketVariantId(
  value: unknown,
): value is FirstPocketVariantId {
  return FIRST_POCKET_VARIANTS.some((variant) => variant.id === value)
}

/** Build a fresh canonical two-bar document plus its bounded Pocket reading. */
export function createFirstPocketGroove(
  variantId: FirstPocketVariantId = FIRST_POCKET_DEFAULT_VARIANT,
): PreparedDrumGroove {
  const variant = FIRST_POCKET_VARIANTS.find((item) => item.id === variantId)
  if (variant === undefined) {
    throw new Error(`Unknown First Pocket variant: ${String(variantId)}`)
  }
  const state = drumSessionStateFromSong({
    song: preparedSong(variantId),
    title:
      variantId === FIRST_POCKET_DEFAULT_VARIANT
        ? 'First Pocket'
        : `First Pocket — ${variant.label}`,
    fileName: 'first-pocket.prepared',
    sourceFormat: 'prepared',
  })
  if (state.status !== 'ready') {
    throw new Error('The built-in First Pocket groove is not playable.')
  }
  return {
    id: 'first-pocket',
    variant,
    document: state.document,
    pocket: projectDrumPocket(state.document, {
      durationBeats: FIRST_POCKET_DURATION_BEATS,
    }),
  }
}
