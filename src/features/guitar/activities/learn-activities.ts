// Guitar Learn activities keep ear, phrase, and shape rules independent from room chrome.
// ============================================================

import type { CagedShapeName, FretNote } from '@/lib/guitar/caged-shapes'
import {
  CAGED_SHAPES,
  computeShapeFrets,
  findRootForShape,
  isCagedCompatibleTuning,
  viewRangeForFrets,
} from '@/lib/guitar/caged-shapes'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { soundingOpenMidi } from '@/lib/guitar/instrument-tuning'
import { midiToNoteName, midiToNoteNameOctave } from '@/lib/note-utils'

export interface LearnNeckPosition {
  id: `${number}:${number}`
  stringIndex: number
  fret: number
  midi: number
  pitchClass: number
}

export interface LearnFretRange {
  firstFret: number
  lastFret: number
}

function clampPitchClass(value: number): number {
  return ((Math.round(value) % 12) + 12) % 12
}

/** Enumerate a small, explicit neck window using the room's sounding tuning. */
export function learnNeckPositions(
  tuning: InstrumentTuning,
  range: LearnFretRange,
): readonly LearnNeckPosition[] {
  if (
    !Number.isInteger(range.firstFret) ||
    !Number.isInteger(range.lastFret) ||
    range.firstFret < 0 ||
    range.lastFret < range.firstFret ||
    range.lastFret > 24
  ) {
    throw new RangeError('A Learn fret window must stay between frets 0 and 24.')
  }

  return soundingOpenMidi(tuning).flatMap((openMidi, stringIndex) =>
    Array.from(
      { length: range.lastFret - range.firstFret + 1 },
      (_, index): LearnNeckPosition => {
        const fret = range.firstFret + index
        const midi = openMidi + fret
        return {
          id: `${stringIndex}:${fret}`,
          stringIndex,
          fret,
          midi,
          pitchClass: midi % 12,
        }
      },
    ),
  )
}

export const HEAR_FIND_LEVELS = [
  {
    id: 'near-nut',
    label: 'Near the nut',
    detail: 'Frets 0–3',
    range: { firstFret: 0, lastFret: 3 },
  },
  {
    id: 'first-position',
    label: 'First position',
    detail: 'Frets 0–5',
    range: { firstFret: 0, lastFret: 5 },
  },
  {
    id: 'wider-neck',
    label: 'Wider neck',
    detail: 'Frets 0–7',
    range: { firstFret: 0, lastFret: 7 },
  },
] as const

export type HearFindLevelId = (typeof HEAR_FIND_LEVELS)[number]['id']

export interface HearFindRound {
  level: HearFindLevelId
  range: LearnFretRange
  positions: readonly LearnNeckPosition[]
  targetMidi: number
  targetNoteName: string
  acceptedPositionIds: ReadonlySet<LearnNeckPosition['id']>
}

export interface HearFindState {
  round: HearFindRound
  phase: 'ready' | 'answering' | 'complete'
  lastAttempt: {
    positionId: LearnNeckPosition['id'] | null
    outcome: 'correct' | 'wrong' | 'hear-first'
    heardMidi: number
  } | null
}

export function createHearFindRound(
  tuning: InstrumentTuning,
  level: HearFindLevelId = 'near-nut',
  roundIndex = 0,
): HearFindRound {
  const levelConfig =
    HEAR_FIND_LEVELS.find((candidate) => candidate.id === level) ??
    HEAR_FIND_LEVELS[0]
  const positions = learnNeckPositions(tuning, levelConfig.range)
  const playableMidi = [...new Set(positions.map((position) => position.midi))].sort(
    (left, right) => left - right,
  )
  if (playableMidi.length === 0) {
    throw new Error('Hear & Find needs at least one playable neck position.')
  }
  const targetIndex =
    ((Math.round(roundIndex) * 7 + 3) % playableMidi.length + playableMidi.length) %
    playableMidi.length
  const targetMidi = playableMidi[targetIndex] ?? playableMidi[0]!

  return {
    level: levelConfig.id,
    range: { ...levelConfig.range },
    positions,
    targetMidi,
    targetNoteName: midiToNoteNameOctave(targetMidi),
    acceptedPositionIds: new Set(
      positions
        .filter((position) => position.midi === targetMidi)
        .map((position) => position.id),
    ),
  }
}

export function createHearFindState(round: HearFindRound): HearFindState {
  return { round, phase: 'ready', lastAttempt: null }
}

export type HearFindAction =
  | { type: 'reference-played' }
  | {
      type: 'answer'
      heardMidi: number
      positionId?: LearnNeckPosition['id']
    }

export function reduceHearFind(
  state: HearFindState,
  action: HearFindAction,
): HearFindState {
  if (action.type === 'reference-played') {
    return { ...state, phase: 'answering', lastAttempt: null }
  }
  if (state.phase === 'ready') {
    return {
      ...state,
      lastAttempt: {
        positionId: action.positionId ?? null,
        outcome: 'hear-first',
        heardMidi: action.heardMidi,
      },
    }
  }
  if (state.phase === 'complete') return state

  const correct = action.heardMidi === state.round.targetMidi
  return {
    ...state,
    phase: correct ? 'complete' : 'answering',
    lastAttempt: {
      positionId: action.positionId ?? null,
      outcome: correct ? 'correct' : 'wrong',
      heardMidi: action.heardMidi,
    },
  }
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const
const ECHO_PATTERNS = [
  [0, 1, 2, 1, 0],
  [0, 2, 1, 3, 2],
  [0, 1, 3, 2, 4],
  [0, 3, 2, 1, 0],
] as const

export interface EchoPhraseNote {
  midi: number
  pitchClass: number
  noteName: string
}

export interface EchoPhrase {
  rootPitchClass: number
  length: number
  range: LearnFretRange
  positions: readonly LearnNeckPosition[]
  notes: readonly EchoPhraseNote[]
}

export interface EchoPhraseState {
  phrase: EchoPhrase
  phase: 'ready' | 'answering' | 'repair' | 'complete'
  currentIndex: number
  lastAttempt: {
    positionId: LearnNeckPosition['id'] | null
    pitchClass: number
    outcome: 'correct' | 'wrong'
  } | null
}

function closestMidi(
  positions: readonly LearnNeckPosition[],
  pitchClass: number,
  preferredMidi: number,
): number {
  const candidates = positions.filter(
    (position) => position.pitchClass === pitchClass,
  )
  const best = candidates.reduce<LearnNeckPosition | null>((closest, candidate) => {
    if (closest === null) return candidate
    return Math.abs(candidate.midi - preferredMidi) <
      Math.abs(closest.midi - preferredMidi)
      ? candidate
      : closest
  }, null)
  if (best === null) {
    throw new Error('Echo a Phrase could not place a scale note on this neck.')
  }
  return best.midi
}

export function createEchoPhrase(
  tuning: InstrumentTuning,
  options: {
    rootPitchClass?: number
    length?: number
    phraseIndex?: number
  } = {},
): EchoPhrase {
  const rootPitchClass = clampPitchClass(options.rootPitchClass ?? 7)
  const length = Math.min(5, Math.max(3, Math.round(options.length ?? 3)))
  const phraseIndex = Math.max(0, Math.round(options.phraseIndex ?? 0))
  const range = { firstFret: 0, lastFret: 5 }
  const positions = learnNeckPositions(tuning, range)
  const pattern = ECHO_PATTERNS[phraseIndex % ECHO_PATTERNS.length] ?? ECHO_PATTERNS[0]
  const rootCandidates = positions.filter(
    (position) => position.pitchClass === rootPitchClass,
  )
  const center = rootCandidates[Math.floor(rootCandidates.length / 2)]
  if (center === undefined) {
    throw new Error('Echo a Phrase needs its root inside the visible neck.')
  }

  let preferredMidi = center.midi
  const notes = Array.from({ length }, (_, index): EchoPhraseNote => {
    const degree = pattern[index] ?? 0
    const interval = MAJOR_SCALE[degree] ?? 0
    const pitchClass = (rootPitchClass + interval) % 12
    const midi = closestMidi(positions, pitchClass, preferredMidi + (index === 0 ? 0 : 2))
    preferredMidi = midi
    return { midi, pitchClass, noteName: midiToNoteName(midi) }
  })

  return { rootPitchClass, length, range, positions, notes }
}

export function createEchoPhraseState(phrase: EchoPhrase): EchoPhraseState {
  return {
    phrase,
    phase: 'ready',
    currentIndex: 0,
    lastAttempt: null,
  }
}

export type EchoPhraseAction =
  | { type: 'phrase-played'; restart?: boolean }
  | { type: 'repair-played' }
  | {
      type: 'answer'
      pitchClass: number
      positionId?: LearnNeckPosition['id']
    }

export function reduceEchoPhrase(
  state: EchoPhraseState,
  action: EchoPhraseAction,
): EchoPhraseState {
  if (action.type === 'phrase-played') {
    return {
      ...state,
      phase: 'answering',
      currentIndex: action.restart === true ? 0 : state.currentIndex,
      lastAttempt: null,
    }
  }
  if (action.type === 'repair-played') {
    if (state.phase !== 'repair') return state
    return { ...state, phase: 'answering', lastAttempt: null }
  }
  if (state.phase !== 'answering') return state

  const expected = state.phrase.notes[state.currentIndex]
  if (expected === undefined) return { ...state, phase: 'complete' }
  const pitchClass = clampPitchClass(action.pitchClass)
  const correct = pitchClass === expected.pitchClass
  if (!correct) {
    return {
      ...state,
      phase: 'repair',
      lastAttempt: {
        positionId: action.positionId ?? null,
        pitchClass,
        outcome: 'wrong',
      },
    }
  }

  const currentIndex = state.currentIndex + 1
  return {
    ...state,
    currentIndex,
    phase: currentIndex >= state.phrase.notes.length ? 'complete' : 'answering',
    lastAttempt: {
      positionId: action.positionId ?? null,
      pitchClass,
      outcome: 'correct',
    },
  }
}

export interface ShapeWalk {
  compatible: boolean
  rootPitchClass: number
  rootName: string
  shapeName: CagedShapeName
  notes: readonly FretNote[]
  range: LearnFretRange
}

export function createShapeWalk(
  tuning: InstrumentTuning,
  rootPitchClass: number,
  shapeName: CagedShapeName,
): ShapeWalk {
  const root = clampPitchClass(rootPitchClass)
  if (!isCagedCompatibleTuning(tuning)) {
    return {
      compatible: false,
      rootPitchClass: root,
      rootName: midiToNoteName(root),
      shapeName,
      notes: [],
      range: { firstFret: 0, lastFret: 4 },
    }
  }

  const shape = CAGED_SHAPES[shapeName]
  const rootMidi = findRootForShape(shape, 48 + root, tuning)
  const notes = computeShapeFrets(shape, rootMidi, tuning)
  const [firstFret, lastFret] = viewRangeForFrets(
    notes.map((note) => note.fret),
  )
  return {
    compatible: true,
    rootPitchClass: root,
    rootName: midiToNoteName(root),
    shapeName,
    notes,
    range: { firstFret, lastFret },
  }
}
