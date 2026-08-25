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
    label: 'Classic',
    description:
      'A familiar two-and-four backbeat with a lifted open-hat turnaround.',
  },
  {
    id: 'tight',
    label: 'Funk',
    description:
      'Syncopated kicks, ghost notes, and accented sixteenths on a tight grid.',
  },
  {
    id: 'loose',
    label: 'Driving',
    description:
      'Four-on-the-floor momentum, bright ride motion, and a short tom arrival.',
  },
  {
    id: 'half-time',
    label: 'Half-time',
    description:
      'A spacious rock pocket with the strong backbeat on beat three.',
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

const FIRST_POCKET_BPM = 84
const FIRST_POCKET_DURATION_BEATS = 8
const POCKET_SUBDIVISION_BEATS = 0.25

const EIGHTH_HAT_VELOCITIES = [
  92, 64, 78, 60, 86, 66, 80, 58, 94, 65, 80, 62, 88, 68, 82, 72,
] as const

function numberedId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`
}

function hit(
  id: string,
  gmKey: number,
  velocity: number,
  startBeat: number,
  writtenDuration = 0.25,
): MidiSongPercussionHit {
  return { id, gmKey, velocity, startBeat, writtenDuration }
}

function orderedHits(
  hits: readonly MidiSongPercussionHit[],
): MidiSongPercussionHit[] {
  return [...hits].sort(
    (left, right) =>
      left.startBeat - right.startBeat ||
      (left.id ?? '').localeCompare(right.id ?? ''),
  )
}

function eighthHats(
  options: {
    readonly prefix?: string
    readonly openIndexes?: readonly number[]
    readonly gmKey?: number
    readonly offsets?: readonly number[]
  } = {},
): MidiSongPercussionHit[] {
  const openIndexes = options.openIndexes ?? []
  return EIGHTH_HAT_VELOCITIES.map((velocity, index) =>
    hit(
      numberedId(options.prefix ?? 'hat', index),
      openIndexes.includes(index) ? 46 : (options.gmKey ?? 42),
      velocity,
      index * 0.5 + (options.offsets?.[index] ?? 0),
      options.gmKey === 51 ? 0.25 : 0.5,
    ),
  )
}

function classicHits(): MidiSongPercussionHit[] {
  const hats = eighthHats({
    openIndexes: [7, 15],
    offsets: [
      0, 0.035, 0, 0.03, -0.012, 0.04, 0, 0.025, -0.01, 0.038, 0, 0.032, -0.014,
      0.042, 0, 0,
    ],
  })
  const kicks = [0, 1.5, 2.75, 3.5, 4, 5.25, 6.5, 7.25].map((beat, index) =>
    hit(
      numberedId('kick', index),
      36,
      [112, 86, 101, 79, 115, 92, 106, 84][index] ?? 84,
      beat + [0, -0.018, 0.012, -0.015, 0, -0.02, 0.014, -0.016][index]!,
    ),
  )
  const snares = [1, 3, 5, 7].map((beat, index) =>
    hit(
      numberedId('snare', index),
      38,
      [112, 118, 110, 121][index] ?? 110,
      beat + [0.028, 0.034, 0.026, 0.036][index]!,
    ),
  )
  const ghosts = [2.5, 6.25].map((beat, index) =>
    hit(
      numberedId('ghost', index),
      38,
      [44, 48][index] ?? 44,
      beat + [0.055, 0.045][index]!,
    ),
  )
  return orderedHits([
    hit('crash-01', 49, 120, 0, 1),
    ...hats,
    ...kicks,
    ...snares,
    ...ghosts,
  ])
}

function funkHits(): MidiSongPercussionHit[] {
  const hats = Array.from({ length: 32 }, (_, index) =>
    hit(
      numberedId('hat', index),
      index === 15 || index === 31 ? 46 : 42,
      index % 4 === 0 ? 96 : index % 2 === 0 ? 74 : index % 8 === 7 ? 62 : 50,
      index * 0.25,
      0.25,
    ),
  )
  const kicks = [0, 0.75, 1.75, 2.5, 3.75, 4, 4.75, 5.5, 6.75].map(
    (beat, index) =>
      hit(
        numberedId('kick', index),
        36,
        [112, 84, 96, 88, 80, 116, 90, 98, 86][index] ?? 86,
        beat,
      ),
  )
  const snares = [1, 3, 5, 7].map((beat, index) =>
    hit(
      numberedId('snare', index),
      38,
      [114, 119, 112, 121][index] ?? 112,
      beat,
    ),
  )
  const ghosts = [0.5, 1.75, 2.75, 4.5, 5.75, 6.5].map((beat, index) =>
    hit(
      numberedId('ghost', index),
      38,
      [38, 46, 42, 40, 48, 44][index] ?? 42,
      beat,
    ),
  )
  return orderedHits([...hats, ...kicks, ...snares, ...ghosts])
}

function drivingHits(): MidiSongPercussionHit[] {
  const rides = eighthHats({
    prefix: 'ride',
    gmKey: 51,
    offsets: [
      0, 0.025, -0.01, 0.03, -0.012, 0.026, -0.008, 0.032, 0, 0.024, -0.012,
      0.03, -0.01, 0.026, -0.008, 0,
    ],
  })
  const kicks = [0, 1, 2, 3, 4, 5, 6, 7].map((beat, index) =>
    hit(
      numberedId('kick', index),
      36,
      [116, 90, 104, 92, 118, 94, 108, 96][index] ?? 96,
      beat + [0, -0.018, 0.012, -0.015, 0, -0.016, 0.01, -0.012][index]!,
    ),
  )
  const snares = [1, 3, 5, 7].map((beat, index) =>
    hit(
      numberedId('snare', index),
      38,
      [114, 121, 116, 123][index] ?? 114,
      beat + [0.026, 0.034, 0.028, 0.036][index]!,
    ),
  )
  const tomFill = [
    hit('tom-high-01', 48, 100, 7.25),
    hit('tom-mid-01', 47, 106, 7.5),
    hit('tom-low-01', 45, 116, 7.75),
  ]
  return orderedHits([
    hit('crash-01', 49, 122, 0, 1),
    hit('crash-02', 49, 116, 4, 1),
    ...rides,
    ...kicks,
    ...snares,
    ...tomFill,
  ])
}

function halfTimeHits(): MidiSongPercussionHit[] {
  const hats = eighthHats({ openIndexes: [7, 15] })
  const kicks = [0, 0.75, 1.5, 3.25, 4, 4.75, 5.5, 7.25].map((beat, index) =>
    hit(
      numberedId('kick', index),
      36,
      [114, 82, 96, 88, 117, 86, 101, 92][index] ?? 88,
      beat,
    ),
  )
  const snares = [2, 6].map((beat, index) =>
    hit(numberedId('snare', index), 38, [120, 123][index] ?? 120, beat),
  )
  const ghosts = [1.75, 5.75].map((beat, index) =>
    hit(numberedId('ghost', index), 38, [42, 46][index] ?? 42, beat),
  )
  return orderedHits([
    hit('crash-01', 49, 118, 0, 1),
    ...hats,
    ...kicks,
    ...snares,
    ...ghosts,
    hit('tom-high-01', 48, 98, 7.5),
    hit('tom-low-01', 45, 112, 7.75),
  ])
}

function preparedHits(
  variantId: FirstPocketVariantId,
): MidiSongPercussionHit[] {
  if (variantId === 'source') return classicHits()
  if (variantId === 'tight') return funkHits()
  if (variantId === 'loose') return drivingHits()
  return halfTimeHits()
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
