// Musical memory scorecard — describe a local take without inventing grades or changing its bytes.

import type { MercEncoreAvailability } from '../content/encore-examples'
import { mercEncoreAvailability } from '../content/encore-examples'
import type { GlassMelodyId } from '../content/melodies'
import { GLASS_MELODIES } from '../content/melodies'
import { compileMelody } from '../core/melody-contour'
import type { MusicalMemory } from '../core/musical-memory'

export interface MusicalMemoryScorecard {
  melodyTitle: string
  noteCount: number | null
  startingNote: string
  pace: string
  duration: string
  recordedAt: number
  merc: Extract<MercEncoreAvailability, { kind: 'voice' }> | null
}

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const

function noteName(midi: number): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) return 'Unknown'
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

function durationLabel(seconds: number): string {
  const rounded = Math.max(1, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, '0')}`
    : `${remainder}s`
}

export function describeMusicalMemory(
  memory: MusicalMemory,
): MusicalMemoryScorecard {
  const melody = GLASS_MELODIES.find(
    (candidate) =>
      candidate.id === memory.melodyId &&
      candidate.version === memory.melodyVersion,
  )
  let noteCount: number | null = null
  let startingMidi = memory.rootMidi + memory.transposeSemitones
  let merc: MusicalMemoryScorecard['merc'] = null

  if (melody !== undefined) {
    noteCount = melody.phrases.reduce(
      (count, phrase) => count + phrase.anchors.length,
      0,
    )
    try {
      const contour = compileMelody(melody, {
        rootMidi: memory.rootMidi,
        pace: memory.pace,
        transposeSemitones: memory.transposeSemitones,
      })
      startingMidi = contour.anchors[0]?.midi ?? startingMidi
      const availability = mercEncoreAvailability(
        melody.id as GlassMelodyId,
        contour,
      )
      if (availability.kind === 'voice') merc = availability
    } catch {
      // Old or corrupt metadata remains deletable/exportable without claiming a match.
    }
  }

  return {
    melodyTitle: melody?.title ?? memory.title,
    noteCount,
    startingNote: noteName(startingMidi),
    pace: `${Number(memory.pace.toFixed(2))}×`,
    duration: durationLabel(memory.durationSeconds),
    recordedAt: memory.recordedAt,
    merc,
  }
}
