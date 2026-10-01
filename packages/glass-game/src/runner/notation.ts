// ============================================================
// Runner notation geometry — one pitch layout for SVG and Canvas renderers.
// ============================================================

import type { CompiledRunnerNote, RunnerTargetSnapshot } from './contracts'

export type RunnerRhythmGlyph =
  | 'whole'
  | 'dotted-half'
  | 'half'
  | 'dotted-quarter'
  | 'quarter'
  | 'eighth'
  | 'sustained'
  | 'custom'

export interface RunnerNotationNote {
  readonly index: number
  readonly startBeat: number
  readonly endBeat: number
  readonly startMidi: number
  readonly endMidi: number
  readonly connection: 'separate' | 'glide'
  readonly fillProgress: number
  readonly state: 'hollow' | 'filling' | 'filled'
}

export interface RunnerMidiName {
  readonly letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  readonly accidental: 'sharp' | null
  readonly octave: number
  readonly text: string
}

export interface RunnerNotationGlyph {
  readonly index: number
  readonly connection: RunnerNotationNote['connection']
  readonly label: string
  readonly pitch: RunnerMidiName
  readonly rhythm: RunnerRhythmGlyph
  readonly active: boolean
  readonly state: RunnerNotationNote['state']
  readonly fillProgress: number
  readonly x: number
  readonly startX: number
  readonly endX: number
  readonly startY: number
  readonly endY: number
  readonly writtenStartStep: number
  readonly writtenEndStep: number
  readonly ledgerLineYs: readonly number[]
  readonly stemDirection: 'up' | 'down' | null
  readonly flagCount: 0 | 1
  readonly dotted: boolean
}

export interface RunnerNotationLayout {
  readonly width: number
  readonly height: number
  readonly staff: {
    readonly left: number
    readonly right: number
    readonly lineYs: readonly [number, number, number, number, number]
    /** Sounding-octave displacement carried by the treble clef. */
    readonly octaveShift: number
    readonly octaveLabel: string | null
  }
  readonly labelY: number
  readonly notes: readonly RunnerNotationGlyph[]
}

export interface RunnerNotationLayoutOptions {
  readonly width?: number
  readonly height?: number
  readonly activeNoteIndex?: number | null
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 184
const MINIMUM_WIDTH = 240
const MINIMUM_HEIGHT = 128
const PITCH_CLASSES = [
  { letter: 'C', accidental: null, diatonic: 0 },
  { letter: 'C', accidental: 'sharp', diatonic: 0 },
  { letter: 'D', accidental: null, diatonic: 1 },
  { letter: 'D', accidental: 'sharp', diatonic: 1 },
  { letter: 'E', accidental: null, diatonic: 2 },
  { letter: 'F', accidental: null, diatonic: 3 },
  { letter: 'F', accidental: 'sharp', diatonic: 3 },
  { letter: 'G', accidental: null, diatonic: 4 },
  { letter: 'G', accidental: 'sharp', diatonic: 4 },
  { letter: 'A', accidental: null, diatonic: 5 },
  { letter: 'A', accidental: 'sharp', diatonic: 5 },
  { letter: 'B', accidental: null, diatonic: 6 },
] as const
const RHYTHM_EPSILON = 0.000001

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

function positiveDimension(
  value: number | undefined,
  fallback: number,
  minimum: number,
): number {
  return Math.max(minimum, finiteOr(value, fallback))
}

export function clampRunnerNotationFill(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

export function runnerMidiName(midi: number): RunnerMidiName {
  const rounded = Number.isFinite(midi) ? Math.round(midi) : 60
  const pitchClass = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  const named = PITCH_CLASSES[pitchClass]
  const accidental = named.accidental
  return {
    letter: named.letter,
    accidental,
    octave,
    text: `${named.letter}${accidental === 'sharp' ? '#' : ''}${octave}`,
  }
}

/** Diatonic steps above C4. Sharps stay on their natural staff position. */
export function runnerStaffStep(midi: number): number {
  const rounded = Number.isFinite(midi) ? Math.round(midi) : 60
  const pitchClass = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return (octave - 4) * 7 + PITCH_CLASSES[pitchClass].diatonic
}

/** Treble-staff ledger steps, ordered from the staff outwards. */
export function runnerLedgerSteps(midi: number): readonly number[] {
  return ledgerStepsForStaffStep(runnerStaffStep(midi))
}

function ledgerStepsForStaffStep(step: number): readonly number[] {
  if (step <= 0) {
    const lines: number[] = []
    for (let ledger = 0; ledger >= step; ledger -= 2) lines.push(ledger)
    return lines
  }
  if (step >= 12) {
    const lines: number[] = []
    for (let ledger = 12; ledger <= step; ledger += 2) lines.push(ledger)
    return lines
  }
  return []
}

function chooseNotationOctaveShift(steps: readonly number[]): number {
  if (steps.length === 0) return 0

  let bestShift = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let shift = -2; shift <= 2; shift += 1) {
    const written = steps.map((step) => step - shift * 7)
    const minimum = Math.min(...written)
    const maximum = Math.max(...written)
    const below = Math.max(0, -1 - minimum)
    const above = Math.max(0, maximum - 13)
    const center = (minimum + maximum) / 2
    const score =
      (below + above) * 100 + Math.abs(shift) * 2 + Math.abs(center - 6) * 0.1
    if (score < bestScore) {
      bestScore = score
      bestShift = shift
    }
  }
  return bestShift
}

function notationOctaveLabel(octaveShift: number): string | null {
  if (octaveShift === 0) return null
  const interval = Math.abs(octaveShift) === 1 ? '8' : '15'
  return `${interval}${octaveShift < 0 ? 'vb' : 'va'}`
}

export function runnerRhythm(durationBeats: number): RunnerRhythmGlyph {
  if (!Number.isFinite(durationBeats) || durationBeats <= 0) return 'custom'
  if (durationBeats > 4 + RHYTHM_EPSILON) return 'sustained'
  if (Math.abs(durationBeats - 4) <= RHYTHM_EPSILON) return 'whole'
  if (Math.abs(durationBeats - 3) <= RHYTHM_EPSILON) return 'dotted-half'
  if (Math.abs(durationBeats - 2) <= RHYTHM_EPSILON) return 'half'
  if (Math.abs(durationBeats - 1.5) <= RHYTHM_EPSILON) return 'dotted-quarter'
  if (Math.abs(durationBeats - 1) <= RHYTHM_EPSILON) return 'quarter'
  if (durationBeats <= 0.5 + RHYTHM_EPSILON) return 'eighth'
  return 'custom'
}

export function runnerNotationNotes(
  compiledNotes: readonly CompiledRunnerNote[],
  snapshotNotes: RunnerTargetSnapshot['notes'],
): readonly RunnerNotationNote[] {
  const resolvedByIndex = new Map(
    snapshotNotes.map((note) => [note.index, note] as const),
  )
  return compiledNotes.flatMap((compiled) => {
    const resolved = resolvedByIndex.get(compiled.index)
    if (resolved === undefined) return []
    return [
      {
        index: compiled.index,
        startBeat: compiled.startBeat,
        endBeat: compiled.endBeat,
        startMidi: resolved.startMidi,
        endMidi: resolved.endMidi,
        connection: compiled.connection,
        fillProgress: clampRunnerNotationFill(resolved.fillProgress),
        state: resolved.state,
      },
    ]
  })
}

export function layoutRunnerNotation(
  sourceNotes: readonly RunnerNotationNote[],
  options: RunnerNotationLayoutOptions = {},
): RunnerNotationLayout {
  const width = positiveDimension(options.width, DEFAULT_WIDTH, MINIMUM_WIDTH)
  const height = positiveDimension(
    options.height,
    DEFAULT_HEIGHT,
    MINIMUM_HEIGHT,
  )
  const left = Math.max(28, width * 0.075)
  const right = width - left
  const notes = sourceNotes.filter(
    (note) =>
      Number.isFinite(note.startBeat) &&
      Number.isFinite(note.endBeat) &&
      note.endBeat > note.startBeat,
  )
  const soundingSteps = notes.flatMap((note) => [
    runnerStaffStep(note.startMidi),
    runnerStaffStep(note.endMidi),
  ])
  const octaveShift = chooseNotationOctaveShift(soundingSteps)
  const writtenStep = (midi: number): number =>
    runnerStaffStep(midi) - octaveShift * 7
  const writtenSteps = notes.flatMap((note) => [
    writtenStep(note.startMidi),
    writtenStep(note.endMidi),
  ])
  const minimumStep = Math.min(2, ...writtenSteps)
  const maximumStep = Math.max(10, ...writtenSteps)
  const labelY = height - 14
  const pitchTop = 12
  const pitchBottom = labelY - 24
  const availableHeight = Math.max(20, pitchBottom - pitchTop)
  const halfGap = Math.min(
    8,
    availableHeight / Math.max(2, maximumStep - minimumStep + 2),
  )
  const usedHeight = (maximumStep - minimumStep + 2) * halfGap
  const topY =
    pitchTop + halfGap + Math.max(0, availableHeight - usedHeight) / 2
  const pitchYForStep = (step: number): number =>
    topY + (maximumStep - step) * halfGap
  const lineYs = [10, 8, 6, 4, 2].map((step) => pitchYForStep(step)) as [
    number,
    number,
    number,
    number,
    number,
  ]
  const phraseStart =
    notes.length === 0 ? 0 : Math.min(...notes.map((note) => note.startBeat))
  const phraseEnd =
    notes.length === 0 ? 1 : Math.max(...notes.map((note) => note.endBeat))
  const phraseDuration = Math.max(RHYTHM_EPSILON, phraseEnd - phraseStart)
  const horizontalInset = Math.min(42, (right - left) * 0.1)
  const noteLeft = left + horizontalInset
  const noteRight = right - horizontalInset
  const beatX = (beat: number): number =>
    noteLeft + ((beat - phraseStart) / phraseDuration) * (noteRight - noteLeft)

  return {
    width,
    height,
    staff: {
      left,
      right,
      lineYs,
      octaveShift,
      octaveLabel: notationOctaveLabel(octaveShift),
    },
    labelY,
    notes: notes.map((note) => {
      const rhythm = runnerRhythm(note.endBeat - note.startBeat)
      const startX = beatX(note.startBeat)
      const endX = beatX(note.endBeat)
      const x =
        note.connection === 'glide' ? endX : startX + (endX - startX) / 2
      const startStep = writtenStep(note.startMidi)
      const endStep = writtenStep(note.endMidi)
      const stemDirection =
        rhythm === 'whole' || rhythm === 'sustained'
          ? null
          : endStep >= 6
            ? 'down'
            : 'up'
      const pitch = runnerMidiName(note.endMidi)
      const startPitch = runnerMidiName(note.startMidi)
      return {
        index: note.index,
        connection: note.connection,
        label:
          note.connection === 'glide' && startPitch.text !== pitch.text
            ? `${startPitch.text} to ${pitch.text}`
            : pitch.text,
        pitch,
        rhythm,
        active: options.activeNoteIndex === note.index,
        state: note.state,
        fillProgress: clampRunnerNotationFill(note.fillProgress),
        x,
        startX,
        endX,
        startY: pitchYForStep(startStep),
        endY: pitchYForStep(endStep),
        writtenStartStep: startStep,
        writtenEndStep: endStep,
        ledgerLineYs: ledgerStepsForStaffStep(endStep).map(pitchYForStep),
        stemDirection,
        flagCount: rhythm === 'eighth' ? 1 : 0,
        dotted: rhythm === 'dotted-half' || rhythm === 'dotted-quarter',
      }
    }),
  }
}
