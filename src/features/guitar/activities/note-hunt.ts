// ============================================================
// Note Hunt — exact fretboard positions with pitch-only listening evidence
// ============================================================
//
// A pitch is not a place on a guitar: unison notes can live on two different
// strings at two different frets. Note Hunt therefore marks positions by
// `stringIndex:fret`. Listening can confirm what pitch was heard, but only an
// explicit neck selection can identify where the player found it.

import type { GuitarInputEventKind, GuitarInputPitch, } from '@/lib/guitar/input-events'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { MAX_PLAYABLE_FRET, MAX_STRING_COUNT, MIN_STRING_COUNT, soundingOpenMidi, } from '@/lib/guitar/instrument-tuning'
import { midiToNoteName } from '@/lib/note-utils'

export const DEFAULT_NOTE_HUNT_FRET_RANGE = {
  firstFret: 0,
  lastFret: 4,
} as const

/** Keeps one round readable on compact and touch-sized fretboards. */
export const MAX_NOTE_HUNT_FRETS = 6

export interface NoteHuntFretRange {
  /** Inclusive, counted from the capo when one is fitted. */
  firstFret: number
  /** Inclusive, counted from the capo when one is fitted. */
  lastFret: number
}

export type NoteHuntPositionId = `${number}:${number}`

export interface NoteHuntPosition {
  id: NoteHuntPositionId
  /** Highest-pitched string is index zero, matching InstrumentTuning rows. */
  stringIndex: number
  fret: number
  /** Sounding pitch after applying the tuning's capo. */
  midi: number
  pitchClass: number
}

export interface NoteHuntRound {
  fretRange: NoteHuntFretRange
  targetPitchClass: number
  targetNoteName: string
  /** Every selectable physical position in this round's bounded neck. */
  neckPositions: readonly NoteHuntPosition[]
  /** Exact target positions; deliberately not deduplicated by MIDI pitch. */
  targetPositions: readonly NoteHuntPosition[]
}

export interface NoteHuntRoundOptions {
  fretRange?: NoteHuntFretRange
  /** Supplies an exact target for lessons and deterministic tests. */
  targetPitchClass?: number
  /** Supplies a deterministic target selection when no exact target is set. */
  random?: () => number
}

export type NoteHuntCellMark = 'correct' | 'wrong'
export type NoteHuntPhase = 'active' | 'complete'
export type NoteHuntAttemptOutcome =
  | 'correct'
  | 'wrong'
  | 'already-found'
  | 'outside-round'
  | 'round-complete'

export interface NoteHuntAttempt {
  positionId: NoteHuntPositionId
  outcome: NoteHuntAttemptOutcome
}

export interface NoteHuntState {
  round: NoteHuntRound
  marks: Readonly<Partial<Record<NoteHuntPositionId, NoteHuntCellMark>>>
  foundCount: number
  phase: NoteHuntPhase
  lastAttempt: NoteHuntAttempt | null
}

export type NoteHuntAction = {
  type: 'mark-position'
  stringIndex: number
  fret: number
}

export interface NoteHuntListeningEvent {
  id: string
  kind: GuitarInputEventKind
  pitch: GuitarInputPitch | null
}

/** Pitch-only evidence. Physical position is intentionally absent. */
export interface NoteHuntPitchEvidence {
  eventId: string
  kind: Exclude<GuitarInputEventKind, 'release'>
  midi: number
  pitchClass: number
  noteName: string
  cents: number
  clarity: number
}

export interface NoteHuntPitchEvidenceAdapter {
  /** Returns only newly identified events, in input order. */
  consume(
    events: readonly NoteHuntListeningEvent[],
  ): readonly NoteHuntPitchEvidence[]
  reset(): void
}

function assertFretRange(range: NoteHuntFretRange): void {
  const fretCount = range.lastFret - range.firstFret + 1
  if (
    !Number.isInteger(range.firstFret) ||
    !Number.isInteger(range.lastFret) ||
    range.firstFret < 0 ||
    range.lastFret > MAX_PLAYABLE_FRET ||
    range.firstFret > range.lastFret
  ) {
    throw new RangeError(
      `Note Hunt frets must be an inclusive range from 0 to ${MAX_PLAYABLE_FRET}.`,
    )
  }
  if (fretCount > MAX_NOTE_HUNT_FRETS) {
    throw new RangeError(
      `Note Hunt rounds can span at most ${MAX_NOTE_HUNT_FRETS} frets.`,
    )
  }
}

function assertTuning(tuning: InstrumentTuning): readonly number[] {
  const sounding = soundingOpenMidi(tuning)
  if (
    !Number.isInteger(tuning.stringCount) ||
    tuning.stringCount < MIN_STRING_COUNT ||
    tuning.stringCount > MAX_STRING_COUNT ||
    sounding.length !== tuning.stringCount ||
    sounding.some((midi) => !Number.isInteger(midi) || midi < 0 || midi > 127)
  ) {
    throw new RangeError(
      `Note Hunt requires a valid ${MIN_STRING_COUNT}–${MAX_STRING_COUNT} string tuning.`,
    )
  }
  return sounding
}

function assertPitchClass(pitchClass: number): void {
  if (!Number.isInteger(pitchClass) || pitchClass < 0 || pitchClass > 11) {
    throw new RangeError(
      'A target pitch class must be an integer from 0 to 11.',
    )
  }
}

export function noteHuntPositionId(
  stringIndex: number,
  fret: number,
): NoteHuntPositionId {
  if (
    !Number.isInteger(stringIndex) ||
    stringIndex < 0 ||
    !Number.isInteger(fret) ||
    fret < 0
  ) {
    throw new RangeError(
      'A Note Hunt position needs a non-negative string index and fret.',
    )
  }
  return `${stringIndex}:${fret}`
}

/** Enumerate physical cells without collapsing positions that sound alike. */
export function noteHuntPositions(
  tuning: InstrumentTuning,
  fretRange: NoteHuntFretRange = DEFAULT_NOTE_HUNT_FRET_RANGE,
): readonly NoteHuntPosition[] {
  assertFretRange(fretRange)
  const sounding = assertTuning(tuning)
  const positions: NoteHuntPosition[] = []

  for (let stringIndex = 0; stringIndex < sounding.length; stringIndex += 1) {
    const openMidi = sounding[stringIndex]
    if (openMidi === undefined) continue
    for (
      let fret = fretRange.firstFret;
      fret <= fretRange.lastFret;
      fret += 1
    ) {
      const midi = openMidi + fret
      if (midi > 127) continue
      positions.push({
        id: noteHuntPositionId(stringIndex, fret),
        stringIndex,
        fret,
        midi,
        pitchClass: midi % 12,
      })
    }
  }

  return positions
}

export function createNoteHuntRound(
  tuning: InstrumentTuning,
  options: NoteHuntRoundOptions = {},
): NoteHuntRound {
  const fretRange = options.fretRange ?? DEFAULT_NOTE_HUNT_FRET_RANGE
  const neckPositions = noteHuntPositions(tuning, fretRange)
  const pitchClasses = [
    ...new Set(neckPositions.map((position) => position.pitchClass)),
  ].sort((left, right) => left - right)

  if (pitchClasses.length === 0) {
    throw new Error('Note Hunt needs at least one playable position.')
  }

  let targetPitchClass = options.targetPitchClass
  if (targetPitchClass === undefined) {
    const random = options.random ?? Math.random
    const roll = random()
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new RangeError('Note Hunt random selection must return [0, 1).')
    }
    targetPitchClass = pitchClasses[Math.floor(roll * pitchClasses.length)]
  }
  if (targetPitchClass === undefined) {
    throw new Error('Note Hunt could not select a target pitch class.')
  }
  assertPitchClass(targetPitchClass)
  if (!pitchClasses.includes(targetPitchClass)) {
    throw new RangeError(
      'The selected target does not exist in this fret range.',
    )
  }

  return {
    fretRange: { ...fretRange },
    targetPitchClass,
    targetNoteName: midiToNoteName(targetPitchClass),
    neckPositions,
    targetPositions: neckPositions.filter(
      (position) => position.pitchClass === targetPitchClass,
    ),
  }
}

export function createNoteHuntState(round: NoteHuntRound): NoteHuntState {
  return {
    round,
    marks: {},
    foundCount: 0,
    phase: 'active',
    lastAttempt: null,
  }
}

export function reduceNoteHunt(
  state: NoteHuntState,
  action: NoteHuntAction,
): NoteHuntState {
  const positionId = noteHuntPositionId(action.stringIndex, action.fret)
  if (state.phase === 'complete') {
    return {
      ...state,
      lastAttempt: { positionId, outcome: 'round-complete' },
    }
  }

  const position = state.round.neckPositions.find(
    (candidate) => candidate.id === positionId,
  )
  if (position === undefined) {
    return {
      ...state,
      lastAttempt: { positionId, outcome: 'outside-round' },
    }
  }

  if (state.marks[positionId] === 'correct') {
    return {
      ...state,
      lastAttempt: { positionId, outcome: 'already-found' },
    }
  }

  const correct = position.pitchClass === state.round.targetPitchClass
  const marks = {
    ...state.marks,
    [positionId]: correct ? ('correct' as const) : ('wrong' as const),
  }
  const foundCount = correct ? state.foundCount + 1 : state.foundCount

  return {
    ...state,
    marks,
    foundCount,
    phase:
      foundCount === state.round.targetPositions.length ? 'complete' : 'active',
    lastAttempt: {
      positionId,
      outcome: correct ? 'correct' : 'wrong',
    },
  }
}

export function noteHuntEvidenceMatchesTarget(
  evidence: NoteHuntPitchEvidence,
  round: NoteHuntRound,
): boolean {
  return evidence.pitchClass === round.targetPitchClass
}

/**
 * Consume the listening controller's replace-in-place event snapshots. A
 * provisional `pitch: null` event remains eligible; its later enriched form is
 * emitted once, and clearer revisions with the same stable id are ignored.
 */
export function createNoteHuntPitchEvidenceAdapter(): NoteHuntPitchEvidenceAdapter {
  const consumedEventIds = new Set<string>()

  return {
    consume(events) {
      const evidence: NoteHuntPitchEvidence[] = []
      for (const event of events) {
        if (
          event.kind === 'release' ||
          event.pitch === null ||
          consumedEventIds.has(event.id) ||
          !Number.isInteger(event.pitch.midi) ||
          event.pitch.midi < 0 ||
          event.pitch.midi > 127
        ) {
          continue
        }
        consumedEventIds.add(event.id)
        evidence.push({
          eventId: event.id,
          kind: event.kind,
          midi: event.pitch.midi,
          pitchClass: event.pitch.midi % 12,
          noteName: event.pitch.noteName,
          cents: event.pitch.cents,
          clarity: event.pitch.clarity,
        })
      }
      return evidence
    },
    reset() {
      consumedEventIds.clear()
    },
  }
}
