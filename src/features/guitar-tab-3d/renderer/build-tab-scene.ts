// buildTabScene converts shared Guitar performance data into renderer-only scene data.
// ============================================================

import type { GuitarHitResult } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { TabDetected, TabScene } from './TabRenderer'
import { DEFAULT_DISPLAY } from './TabRenderer'

const MIN_STRING_COUNT = 6
const DEFAULT_OPEN: readonly number[] = [64, 59, 55, 50, 45, 40, 35, 30]

export interface TabSceneFeedback {
  hitResults: readonly GuitarHitResult[]
  detectedMidi: number | null
  detectedClarity: number
  showUserNotes: boolean
}

export interface BuildTabSceneOptions {
  notes: readonly GuitarNote[]
  playheadBeat: number
  visibleBeatWindow: number
  showNoteLabels: boolean
  showFretboard: boolean
  display?: TabScene['display']
  feedback?: TabSceneFeedback
  now?: number
}

export function buildTabScene(options: BuildTabSceneOptions): TabScene {
  let stringCount = MIN_STRING_COUNT
  let maxFret = 0
  const observedOpen: number[] = []
  for (const note of options.notes) {
    if (note.stringIndex + 1 > stringCount) stringCount = note.stringIndex + 1
    if (note.fret > maxFret) maxFret = note.fret
    observedOpen[note.stringIndex] = note.midi - note.fret
  }
  const openMidi: number[] = []
  for (let index = 0; index < stringCount; index += 1) {
    openMidi[index] = observedOpen[index] ?? DEFAULT_OPEN[index] ?? 40
  }
  const laidMaxFret = Math.min(24, Math.max(12, maxFret))
  const clampFret = (fret: number) => Math.max(0, Math.min(laidMaxFret, fret))
  const now = options.now ?? Date.now()
  const feedback = options.feedback

  const hits = (feedback?.hitResults ?? [])
    .filter((hit) => hit.timing !== 'miss' && now - hit.timestamp < 600)
    .map((hit) => ({
      stringIndex: hit.stringIndex,
      fret: clampFret(hit.midiNote - (openMidi[hit.stringIndex] ?? 40)),
      timing: hit.timing as 'perfect' | 'great' | 'good',
      at: hit.timestamp,
    }))

  let detected: TabDetected | null = null
  const detectedMidi = feedback?.detectedMidi ?? null
  if (detectedMidi !== null && (feedback?.showUserNotes ?? true)) {
    const matched = options.notes.find(
      (note) =>
        (note.isBacking ?? false) === false &&
        note.startBeat - options.playheadBeat <= 0.35 &&
        note.startBeat + note.duration - options.playheadBeat >= -0.35 &&
        detectedMidi % 12 === note.midi % 12,
    )
    const clarity = feedback?.detectedClarity ?? 1
    if (matched !== undefined) {
      detected = {
        stringIndex: matched.stringIndex,
        fret: clampFret(matched.fret),
        matchesTarget: true,
        clarity,
      }
    } else {
      let lane = stringCount - 1
      for (let stringIndex = 0; stringIndex < stringCount; stringIndex += 1) {
        const open = openMidi[stringIndex]
        if (
          open !== undefined &&
          detectedMidi >= open &&
          detectedMidi - open <= laidMaxFret
        ) {
          lane = stringIndex
          break
        }
      }
      detected = {
        stringIndex: lane,
        fret: clampFret(detectedMidi - (openMidi[lane] ?? 40)),
        matchesTarget: false,
        clarity,
      }
    }
  }

  return {
    notes: options.notes.map((note) => ({
      stringIndex: note.stringIndex,
      fret: note.fret,
      startBeat: note.startBeat,
      durationBeats: note.duration,
      noteName: midiToNoteNameOctave(note.midi),
      isBacking: note.isBacking ?? false,
    })),
    playheadBeat: options.playheadBeat,
    visibleBeatWindow: Math.max(1, options.visibleBeatWindow),
    stringCount,
    openMidi,
    maxFret: laidMaxFret,
    showNoteLabels: options.showNoteLabels,
    showFretboard: options.showFretboard,
    hits,
    detected,
    display: options.display ?? DEFAULT_DISPLAY,
  }
}
