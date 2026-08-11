// buildTabScene converts shared Guitar performance data into renderer-only scene data.
// ============================================================

import type { GuitarHitResult } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { compileTabNotes, matchingTabNoteAtPlayhead } from './compile-tab-notes'
import type { TabDetected, TabPresentation, TabScene } from './TabRenderer'
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
  /** Visual projection only; timing, score, input, and feedback stay shared. */
  presentation?: TabPresentation
  feedback?: TabSceneFeedback
  /**
   * The instrument the notes were placed on, when the host knows it. Without
   * it the neck is inferred from the notes, which cannot tell a four-string
   * bass from a guitar whose top two strings happen to be silent.
   */
  tuning?: {
    stringCount: number
    openMidi: readonly number[]
    capo?: number
  }
  now?: number
}

export function buildTabScene(options: BuildTabSceneOptions): TabScene {
  const compiled = compileTabNotes(options.notes)
  let stringCount = options.tuning?.stringCount ?? MIN_STRING_COUNT
  stringCount = Math.max(stringCount, compiled.inferredStringCount)
  const declaredOpen = options.tuning?.openMidi
  const capo = options.tuning?.capo ?? 0
  const openMidi: number[] = []
  for (let index = 0; index < stringCount; index += 1) {
    openMidi[index] =
      declaredOpen?.[index] === undefined
        ? (compiled.observedOpenMidi[index] ?? DEFAULT_OPEN[index] ?? 40)
        : declaredOpen[index]! + capo
  }
  const laidMaxFret = Math.min(24, Math.max(12, compiled.maxFret))
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
    const matched = matchingTabNoteAtPlayhead(
      compiled,
      options.playheadBeat,
      detectedMidi,
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
    notes: compiled.notes,
    noteIntervalIndex: compiled.noteIntervalIndex,
    events: compiled.events,
    noteById: compiled.noteById,
    maxNoteDurationBeats: compiled.maxNoteDurationBeats,
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
    presentation: options.presentation ?? 'fret-axis',
  }
}
