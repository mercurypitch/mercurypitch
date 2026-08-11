// ============================================================
// Piano composition stage — narrow local-library reader and performance projection
// ============================================================
//
// Piano Night can discover MercuryPitch compositions after an explicit
// library gesture without importing the App-owned melody store. Persisted JSON
// is untrusted: only bounded, pitched, non-rest notes cross this boundary.

import type { PianoProjectStage } from '@/features/piano/runtime/piano-project-stage'

export const PIANO_COMPOSITION_LIBRARY_KEY = 'pitchperfect_library'

const MAX_LIBRARY_CHARACTERS = 10 * 1024 * 1024
const MAX_COMPOSITIONS = 2_000
const MAX_ITEMS_PER_COMPOSITION = 100_000
const MAX_IDENTIFIER_LENGTH = 256
const MAX_NAME_LENGTH = 256
const MAX_BEAT = 1_000_000
const MIN_TEMPO_BPM = 40
const MAX_TEMPO_BPM = 280
const DEFAULT_VELOCITY = 100

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export interface PianoCompositionStorage {
  getItem(key: string): string | null
}

export interface PianoCompositionNote {
  /** Stable for repeated reads of the same persisted composition row. */
  readonly id: string
  readonly midi: number
  readonly startBeat: number
  readonly duration: number
  /** Normalized Web Audio strike velocity from 0 through 1. */
  readonly velocity: number
}

export interface PianoComposition {
  readonly id: string
  readonly name: string
  readonly bpm: number
  readonly notes: readonly PianoCompositionNote[]
}

interface PianoCompositionLibraryBase {
  readonly compositions: readonly PianoComposition[]
  readonly skippedRows: number
  readonly skippedItems: number
}

export type PianoCompositionLibraryResult =
  | (PianoCompositionLibraryBase & { readonly status: 'ready' })
  | (PianoCompositionLibraryBase & { readonly status: 'absent' | 'empty' })
  | (PianoCompositionLibraryBase & {
      readonly status: 'malformed' | 'unavailable'
      readonly error: unknown
    })

interface SanitizedRow {
  composition: PianoComposition | null
  skippedItems: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const identifier = value.trim()
  return identifier !== '' && identifier.length <= MAX_IDENTIFIER_LENGTH
    ? identifier
    : null
}

function boundedName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name !== '' ? name.slice(0, MAX_NAME_LENGTH) : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function stableItemToken(value: unknown, sourceIndex: number): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value)
  }
  if (typeof value === 'string') {
    const identifier = boundedIdentifier(value)
    if (identifier !== null) return identifier
  }
  return `index-${sourceIndex}`
}

function sanitizeNote(
  compositionId: string,
  value: unknown,
  sourceIndex: number,
): PianoCompositionNote | null {
  if (!isRecord(value)) return null
  if (value.isRest === true) return null
  if (value.isRest !== undefined && value.isRest !== false) return null

  const note = value.note
  if (!isRecord(note)) return null
  const midi = finiteNumber(note.midi)
  const startBeat = finiteNumber(value.startBeat)
  const duration = finiteNumber(value.duration)
  if (
    midi === null ||
    !Number.isInteger(midi) ||
    midi < 0 ||
    midi > 127 ||
    startBeat === null ||
    startBeat < 0 ||
    startBeat > MAX_BEAT ||
    duration === null ||
    duration <= 0 ||
    startBeat + duration > MAX_BEAT
  ) {
    return null
  }

  const sourceVelocity =
    value.velocity === undefined
      ? DEFAULT_VELOCITY
      : finiteNumber(value.velocity)
  if (sourceVelocity === null) return null
  const velocity = clamp(sourceVelocity, 0, 127) / 127
  const token = stableItemToken(value.id, sourceIndex)

  return Object.freeze({
    id: `${compositionId}:item-${token}:${sourceIndex}`,
    midi,
    startBeat,
    duration,
    velocity,
  })
}

function compareNotes(
  left: PianoCompositionNote,
  right: PianoCompositionNote,
): number {
  return (
    left.startBeat - right.startBeat ||
    left.midi - right.midi ||
    left.id.localeCompare(right.id)
  )
}

function sanitizeRow(libraryId: string, value: unknown): SanitizedRow | null {
  if (!isRecord(value)) return null
  const rowId = boundedIdentifier(value.id)
  const name = boundedName(value.name)
  const sourceBpm = finiteNumber(value.bpm)
  if (
    rowId === null ||
    rowId !== libraryId ||
    name === null ||
    sourceBpm === null ||
    sourceBpm <= 0 ||
    !Array.isArray(value.items) ||
    value.items.length > MAX_ITEMS_PER_COMPOSITION ||
    (value.kind !== undefined &&
      value.kind !== 'melody' &&
      value.kind !== 'drums')
  ) {
    return null
  }

  // Drum-grid rows are valid MercuryPitch library data, but they are not a
  // pitched Piano composition and must not become chromatic keyboard notes.
  if (value.kind === 'drums') {
    return { composition: null, skippedItems: 0 }
  }

  const notes: PianoCompositionNote[] = []
  let skippedItems = 0
  for (let index = 0; index < value.items.length; index++) {
    const item = value.items[index]
    if (isRecord(item) && item.isRest === true) continue
    const sanitized = sanitizeNote(libraryId, item, index)
    if (sanitized === null) skippedItems += 1
    else notes.push(sanitized)
  }
  notes.sort(compareNotes)
  if (notes.length === 0) return { composition: null, skippedItems }

  return {
    composition: Object.freeze({
      id: libraryId,
      name,
      bpm: clamp(sourceBpm, MIN_TEMPO_BPM, MAX_TEMPO_BPM),
      notes: Object.freeze(notes),
    }),
    skippedItems,
  }
}

function emptyResult(
  status: 'absent' | 'empty',
): PianoCompositionLibraryResult {
  return {
    status,
    compositions: Object.freeze([]),
    skippedRows: 0,
    skippedItems: 0,
  }
}

/** Read a bounded, stage-ready view of the device-local MercuryPitch library. */
export function readPianoCompositions(
  storage: PianoCompositionStorage,
): PianoCompositionLibraryResult {
  let serialized: string | null
  try {
    serialized = storage.getItem(PIANO_COMPOSITION_LIBRARY_KEY)
  } catch (error) {
    return {
      status: 'unavailable',
      compositions: Object.freeze([]),
      skippedRows: 0,
      skippedItems: 0,
      error,
    }
  }
  if (serialized === null) return emptyResult('absent')
  if (serialized.trim() === '' || serialized.length > MAX_LIBRARY_CHARACTERS) {
    return {
      status: 'malformed',
      compositions: Object.freeze([]),
      skippedRows: 0,
      skippedItems: 0,
      error: new TypeError(
        'The MercuryPitch composition library is malformed.',
      ),
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch (error) {
    return {
      status: 'malformed',
      compositions: Object.freeze([]),
      skippedRows: 0,
      skippedItems: 0,
      error,
    }
  }
  if (!isRecord(parsed) || !isRecord(parsed.melodies)) {
    return {
      status: 'malformed',
      compositions: Object.freeze([]),
      skippedRows: 0,
      skippedItems: 0,
      error: new TypeError('The MercuryPitch library has no melody catalogue.'),
    }
  }

  const rows = Object.entries(parsed.melodies)
  if (rows.length === 0) return emptyResult('empty')
  if (rows.length > MAX_COMPOSITIONS) {
    return {
      status: 'malformed',
      compositions: Object.freeze([]),
      skippedRows: rows.length,
      skippedItems: 0,
      error: new TypeError(
        'The MercuryPitch composition catalogue is too large.',
      ),
    }
  }

  const compositions: PianoComposition[] = []
  let acceptedRows = 0
  let skippedRows = 0
  let skippedItems = 0
  for (const [libraryId, row] of rows) {
    if (boundedIdentifier(libraryId) === null) {
      skippedRows += 1
      continue
    }
    const sanitized = sanitizeRow(libraryId, row)
    if (sanitized === null) {
      skippedRows += 1
      continue
    }
    acceptedRows += 1
    skippedItems += sanitized.skippedItems
    if (sanitized.composition !== null) {
      compositions.push(sanitized.composition)
    }
  }

  if (compositions.length > 0) {
    return {
      status: 'ready',
      compositions: Object.freeze(compositions),
      skippedRows,
      skippedItems,
    }
  }
  if (acceptedRows > 0) {
    return {
      status: 'empty',
      compositions: Object.freeze([]),
      skippedRows,
      skippedItems,
    }
  }
  return {
    status: 'malformed',
    compositions: Object.freeze([]),
    skippedRows,
    skippedItems,
    error: new TypeError(
      'The MercuryPitch library contains no valid composition rows.',
    ),
  }
}

function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Project one sanitized MercuryPitch composition onto the Piano runtime. */
export function pianoCompositionToStage(
  composition: PianoComposition,
): PianoProjectStage {
  const trackId = `composition:${composition.id}`
  const notes = [...composition.notes].sort(compareNotes).map((note) =>
    Object.freeze({
      id: note.id,
      midi: note.midi,
      name: NOTE_NAMES[note.midi % 12],
      startBeat: note.startBeat,
      duration: note.duration,
      targetFreq: midiFrequency(note.midi),
      isBacking: false,
      trackId,
      velocity: note.velocity,
      releaseVelocity: 0,
      channel: 0,
    }),
  )
  const totalBeats = notes.reduce(
    (latest, note) => Math.max(latest, note.startBeat + note.duration),
    0,
  )

  return Object.freeze({
    title: composition.name,
    notes: Object.freeze(notes),
    totalBeats,
    initialTempoBpm: composition.bpm,
  })
}
