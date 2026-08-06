// Guitar Night first-win configuration keeps the beginner path versioned and safely overridable.
// ============================================================

export type GuitarFirstWinInputKind =
  | 'microphone'
  | 'midi'
  | 'keyboard'
  | 'touch'

export type GuitarFirstWinCompletionAction =
  | 'keep-jamming'
  | 'another-riff'
  | 'load-song'

export type GuitarFirstWinExerciseStepV1 = {
  id: string
  kind: 'open-string-groove' | 'one-string-tab'
  stringIndex: number
  stringLabel: string
  frets: number[]
  phraseChunks: Array<{ id: string; frets: number[] }>
  expectedMidi: number[] | 'from-tuning-and-frets'
  guide: 'count-in-only' | 'percussion-only'
}

export type GuitarFirstWinConfigV1 = {
  schemaVersion: 1
  flowVersion: 'first-win-v1'
  configVersion: string
  enabled: boolean
  tempoBpm: number
  countInBeats: number
  freshHitsRequested: number
  passHits: number
  timingToleranceMs: number
  tuningMidiHighToLow: [number, number, number, number, number, number]
  percussionPreset: string
  exerciseSteps: GuitarFirstWinExerciseStepV1[]
  inputFallbacks: GuitarFirstWinInputKind[]
  completionActions: GuitarFirstWinCompletionAction[]
  skipDestination: 'quick-jam'
  returnEntry: 'learn:first-win'
}

const DEFAULT_TUNING: GuitarFirstWinConfigV1['tuningMidiHighToLow'] = [
  64, 59, 55, 50, 45, 40,
]

export const DEFAULT_GUITAR_FIRST_WIN_CONFIG: GuitarFirstWinConfigV1 = {
  schemaVersion: 1,
  flowVersion: 'first-win-v1',
  configVersion: '2026.08.1',
  enabled: true,
  tempoBpm: 78,
  countInBeats: 4,
  freshHitsRequested: 4,
  passHits: 3,
  timingToleranceMs: 180,
  tuningMidiHighToLow: DEFAULT_TUNING,
  percussionPreset: 'first-win-rock',
  exerciseSteps: [
    {
      id: 'open-low-e',
      kind: 'open-string-groove',
      stringIndex: 5,
      stringLabel: 'low E',
      frets: [0, 0, 0, 0],
      phraseChunks: [{ id: 'four-open-low-e', frets: [0, 0, 0, 0] }],
      expectedMidi: 'from-tuning-and-frets',
      guide: 'percussion-only',
    },
    {
      id: 'first-one-string-tab',
      kind: 'one-string-tab',
      stringIndex: 0,
      stringLabel: 'high e',
      frets: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2],
      phraseChunks: [
        { id: 'phrase-a', frets: [4, 4, 5, 7] },
        { id: 'phrase-b', frets: [7, 5, 4, 2] },
        { id: 'phrase-c', frets: [0, 0, 2, 4] },
        { id: 'phrase-d', frets: [4, 2, 2] },
      ],
      expectedMidi: 'from-tuning-and-frets',
      guide: 'percussion-only',
    },
  ],
  inputFallbacks: ['microphone', 'midi', 'keyboard', 'touch'],
  completionActions: ['keep-jamming', 'another-riff', 'load-song'],
  skipDestination: 'quick-jam',
  returnEntry: 'learn:first-win',
}

type UnknownRecord = Record<string, unknown>

const INPUT_KINDS = new Set<GuitarFirstWinInputKind>([
  'microphone',
  'midi',
  'keyboard',
  'touch',
])
const COMPLETION_ACTIONS = new Set<GuitarFirstWinCompletionAction>([
  'keep-jamming',
  'another-riff',
  'load-song',
])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberWithin(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fallback
}

function integerWithin(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return Number.isInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
    ? (value as number)
    : fallback
}

function safeIdentifier(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,48}$/.test(value)
    ? value
    : fallback
}

function safeStringLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z0-9 #b-]{1,16}$/.test(value)
    ? value
    : fallback
}

function safeFrets(value: unknown, fallback: number[]): number[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 64 ||
    !value.every((fret) => Number.isInteger(fret) && fret >= 0 && fret <= 24)
  ) {
    return [...fallback]
  }
  return value as number[]
}

function safeTuning(
  value: unknown,
): GuitarFirstWinConfigV1['tuningMidiHighToLow'] {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    !value.every((midi) => Number.isInteger(midi) && midi >= 0 && midi <= 127)
  ) {
    return [...DEFAULT_TUNING]
  }
  return value as GuitarFirstWinConfigV1['tuningMidiHighToLow']
}

function safeEnumArray<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fallback: T[],
): T[] {
  if (!Array.isArray(value)) return [...fallback]
  const resolved = [
    ...new Set(value.filter((item): item is T => allowed.has(item as T))),
  ]
  return resolved.length > 0 ? resolved : [...fallback]
}

function resolvePhraseChunks(
  value: unknown,
  fallback: GuitarFirstWinExerciseStepV1['phraseChunks'],
): GuitarFirstWinExerciseStepV1['phraseChunks'] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) {
    return fallback.map((chunk) => ({ ...chunk, frets: [...chunk.frets] }))
  }

  return value.map((candidate, index) => {
    const safeFallback = fallback[index] ?? fallback[0]
    if (!isRecord(candidate) || safeFallback === undefined) {
      return {
        id: `phrase-${index + 1}`,
        frets: [0],
      }
    }
    return {
      id: safeIdentifier(candidate.id, safeFallback.id),
      frets: safeFrets(candidate.frets, safeFallback.frets),
    }
  })
}

function resolveExerciseStep(
  value: unknown,
  fallback: GuitarFirstWinExerciseStepV1,
): GuitarFirstWinExerciseStepV1 {
  if (!isRecord(value)) {
    return {
      ...fallback,
      frets: [...fallback.frets],
      phraseChunks: fallback.phraseChunks.map((chunk) => ({
        ...chunk,
        frets: [...chunk.frets],
      })),
      expectedMidi: Array.isArray(fallback.expectedMidi)
        ? [...fallback.expectedMidi]
        : fallback.expectedMidi,
    }
  }

  const frets = safeFrets(value.frets, fallback.frets)
  const explicitMidi =
    Array.isArray(value.expectedMidi) &&
    value.expectedMidi.length === frets.length &&
    value.expectedMidi.every(
      (midi) => Number.isInteger(midi) && midi >= 0 && midi <= 127,
    )
      ? (value.expectedMidi as number[])
      : null

  return {
    id: safeIdentifier(value.id, fallback.id),
    kind:
      value.kind === 'open-string-groove' || value.kind === 'one-string-tab'
        ? value.kind
        : fallback.kind,
    stringIndex: integerWithin(value.stringIndex, 0, 5, fallback.stringIndex),
    stringLabel: safeStringLabel(value.stringLabel, fallback.stringLabel),
    frets,
    phraseChunks: resolvePhraseChunks(
      value.phraseChunks,
      fallback.phraseChunks,
    ),
    expectedMidi:
      value.expectedMidi === 'from-tuning-and-frets'
        ? value.expectedMidi
        : (explicitMidi ?? fallback.expectedMidi),
    guide:
      value.guide === 'count-in-only' || value.guide === 'percussion-only'
        ? value.guide
        : fallback.guide,
  }
}

function cloneDefaults(): GuitarFirstWinConfigV1 {
  return {
    ...DEFAULT_GUITAR_FIRST_WIN_CONFIG,
    tuningMidiHighToLow: [...DEFAULT_TUNING],
    exerciseSteps: DEFAULT_GUITAR_FIRST_WIN_CONFIG.exerciseSteps.map((step) =>
      resolveExerciseStep(null, step),
    ),
    inputFallbacks: [...DEFAULT_GUITAR_FIRST_WIN_CONFIG.inputFallbacks],
    completionActions: [...DEFAULT_GUITAR_FIRST_WIN_CONFIG.completionActions],
  }
}

/** Resolve untrusted persisted or remote values against the bundled safe V1. */
export function resolveGuitarFirstWinConfig(
  value: unknown,
): GuitarFirstWinConfigV1 {
  if (!isRecord(value)) return cloneDefaults()

  const defaults = DEFAULT_GUITAR_FIRST_WIN_CONFIG
  const requestedHits = integerWithin(
    value.freshHitsRequested,
    1,
    16,
    defaults.freshHitsRequested,
  )
  const sourceSteps =
    Array.isArray(value.exerciseSteps) &&
    value.exerciseSteps.length > 0 &&
    value.exerciseSteps.length <= 16
      ? value.exerciseSteps
      : defaults.exerciseSteps

  return {
    schemaVersion: 1,
    flowVersion: 'first-win-v1',
    configVersion: safeIdentifier(value.configVersion, defaults.configVersion),
    enabled:
      typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    tempoBpm: numberWithin(value.tempoBpm, 40, 160, defaults.tempoBpm),
    countInBeats: integerWithin(
      value.countInBeats,
      0,
      8,
      defaults.countInBeats,
    ),
    freshHitsRequested: requestedHits,
    passHits: integerWithin(
      value.passHits,
      1,
      requestedHits,
      Math.min(defaults.passHits, requestedHits),
    ),
    timingToleranceMs: numberWithin(
      value.timingToleranceMs,
      50,
      500,
      defaults.timingToleranceMs,
    ),
    tuningMidiHighToLow: safeTuning(value.tuningMidiHighToLow),
    percussionPreset: safeIdentifier(
      value.percussionPreset,
      defaults.percussionPreset,
    ),
    exerciseSteps: sourceSteps.map((step, index) =>
      resolveExerciseStep(
        step,
        defaults.exerciseSteps[index] ?? defaults.exerciseSteps[0],
      ),
    ),
    inputFallbacks: safeEnumArray(
      value.inputFallbacks,
      INPUT_KINDS,
      defaults.inputFallbacks,
    ),
    completionActions: safeEnumArray(
      value.completionActions,
      COMPLETION_ACTIONS,
      defaults.completionActions,
    ),
    skipDestination: 'quick-jam',
    returnEntry: 'learn:first-win',
  }
}
