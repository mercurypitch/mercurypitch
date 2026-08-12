// ============================================================
// Note Hunt progress — one versioned, local, resumable fretboard round
// ============================================================
//
// A saved pitch is not enough to resume a guitar exercise: the same pitch can
// live at several physical positions. This boundary therefore persists exact
// `stringIndex:fret` identities and rejects records from another tuning or
// lesson range instead of silently placing old progress on a different neck.

import type { NoteHuntFretRange, NoteHuntPositionId, NoteHuntState, } from '@/features/guitar/activities/note-hunt'
import { createNoteHuntRound, DEFAULT_NOTE_HUNT_FRET_RANGE, } from '@/features/guitar/activities/note-hunt'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'

export const NOTE_HUNT_PROGRESS_SCHEMA_VERSION = 1
export const NOTE_HUNT_PROGRESS_STORAGE_KEY =
  'mercurypitch:guitar-night:note-hunt:v1'

export interface NoteHuntProgressV1 {
  schemaVersion: typeof NOTE_HUNT_PROGRESS_SCHEMA_VERSION
  targetPitchClass: number
  foundPositionIds: NoteHuntPositionId[]
  completedRoundCount: number
  fretRange: NoteHuntFretRange
  tuningSignature: string
}

export interface RestoredNoteHuntProgress {
  state: NoteHuntState
  completedRoundCount: number
}

export interface NoteHuntProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameFretRange(
  left: NoteHuntFretRange,
  right: NoteHuntFretRange,
): boolean {
  return left.firstFret === right.firstFret && left.lastFret === right.lastFret
}

function samePositions(
  left: readonly { id: NoteHuntPositionId; midi: number }[],
  right: readonly { id: NoteHuntPositionId; midi: number }[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (position, index) =>
        position.id === right[index]?.id &&
        position.midi === right[index]?.midi,
    )
  )
}

/** Identity for every tuning property that changes a playable neck pitch. */
export function noteHuntTuningSignature(tuning: InstrumentTuning): string {
  return [
    'v1',
    tuning.instrument,
    tuning.stringCount,
    tuning.openMidi.join(','),
    tuning.capo ?? 0,
  ].join('|')
}

function removeStoredProgress(storage: NoteHuntProgressStorage): void {
  try {
    storage.removeItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)
  } catch {
    // Storage availability must never block the playable lesson.
  }
}

function isStoredFretRange(value: unknown): value is NoteHuntFretRange {
  return (
    isRecord(value) &&
    Number.isInteger(value.firstFret) &&
    Number.isInteger(value.lastFret)
  )
}

function readFoundPositionIds(
  value: unknown,
  allowedIds: ReadonlySet<NoteHuntPositionId>,
): NoteHuntPositionId[] | null {
  if (!Array.isArray(value)) return null

  const foundIds: NoteHuntPositionId[] = []
  const uniqueIds = new Set<NoteHuntPositionId>()
  for (const candidate of value) {
    if (
      typeof candidate !== 'string' ||
      !allowedIds.has(candidate as NoteHuntPositionId) ||
      uniqueIds.has(candidate as NoteHuntPositionId)
    ) {
      return null
    }
    const positionId = candidate as NoteHuntPositionId
    uniqueIds.add(positionId)
    foundIds.push(positionId)
  }
  return foundIds
}

/**
 * Build the only shape allowed across the Note Hunt storage boundary. Invalid
 * caller state is refused rather than being rebound to the supplied tuning.
 */
export function createNoteHuntProgress(
  state: NoteHuntState,
  tuning: InstrumentTuning,
  completedRoundCount: number,
): NoteHuntProgressV1 | null {
  if (!Number.isSafeInteger(completedRoundCount) || completedRoundCount < 0) {
    return null
  }

  try {
    const round = createNoteHuntRound(tuning, {
      fretRange: state.round.fretRange,
      targetPitchClass: state.round.targetPitchClass,
    })
    if (!samePositions(round.neckPositions, state.round.neckPositions)) {
      return null
    }

    const foundPositionIds = round.targetPositions
      .filter((position) => state.marks[position.id] === 'correct')
      .map((position) => position.id)

    return {
      schemaVersion: NOTE_HUNT_PROGRESS_SCHEMA_VERSION,
      targetPitchClass: round.targetPitchClass,
      foundPositionIds,
      completedRoundCount,
      fretRange: { ...round.fretRange },
      tuningSignature: noteHuntTuningSignature(tuning),
    }
  } catch {
    return null
  }
}

/** Persist one compact round. A blocked or full store leaves play unaffected. */
export function saveNoteHuntProgress(
  state: NoteHuntState,
  tuning: InstrumentTuning,
  completedRoundCount: number,
  storage: NoteHuntProgressStorage = localStorage,
): NoteHuntProgressV1 | null {
  const progress = createNoteHuntProgress(state, tuning, completedRoundCount)
  if (progress === null) return null

  try {
    storage.setItem(NOTE_HUNT_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    return progress
  } catch {
    return null
  }
}

/**
 * Restore a round only when its schema, tuning, range, target, and exact found
 * cells are mutually compatible. Any untrusted record resets to a fresh round.
 */
export function loadNoteHuntProgress(
  tuning: InstrumentTuning,
  fretRange: NoteHuntFretRange = DEFAULT_NOTE_HUNT_FRET_RANGE,
  storage: NoteHuntProgressStorage = localStorage,
): RestoredNoteHuntProgress | null {
  let parsed: unknown
  try {
    const stored = storage.getItem(NOTE_HUNT_PROGRESS_STORAGE_KEY)
    if (stored === null) return null
    parsed = JSON.parse(stored) as unknown
  } catch {
    removeStoredProgress(storage)
    return null
  }

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== NOTE_HUNT_PROGRESS_SCHEMA_VERSION ||
    !Number.isInteger(parsed.targetPitchClass) ||
    (parsed.targetPitchClass as number) < 0 ||
    (parsed.targetPitchClass as number) > 11 ||
    !Number.isSafeInteger(parsed.completedRoundCount) ||
    (parsed.completedRoundCount as number) < 0 ||
    !isStoredFretRange(parsed.fretRange) ||
    !sameFretRange(parsed.fretRange, fretRange) ||
    parsed.tuningSignature !== noteHuntTuningSignature(tuning)
  ) {
    removeStoredProgress(storage)
    return null
  }

  try {
    const round = createNoteHuntRound(tuning, {
      fretRange,
      targetPitchClass: parsed.targetPitchClass as number,
    })
    const allowedIds = new Set(
      round.targetPositions.map((position) => position.id),
    )
    const foundPositionIds = readFoundPositionIds(
      parsed.foundPositionIds,
      allowedIds,
    )
    if (foundPositionIds === null) {
      removeStoredProgress(storage)
      return null
    }

    const marks: NoteHuntState['marks'] = Object.fromEntries(
      foundPositionIds.map((positionId) => [positionId, 'correct' as const]),
    )
    const foundCount = foundPositionIds.length
    return {
      state: {
        round,
        marks,
        foundCount,
        phase:
          foundCount === round.targetPositions.length ? 'complete' : 'active',
        lastAttempt: null,
      },
      completedRoundCount: parsed.completedRoundCount as number,
    }
  } catch {
    removeStoredProgress(storage)
    return null
  }
}

export function clearNoteHuntProgress(
  storage: NoteHuntProgressStorage = localStorage,
): void {
  removeStoredProgress(storage)
}
