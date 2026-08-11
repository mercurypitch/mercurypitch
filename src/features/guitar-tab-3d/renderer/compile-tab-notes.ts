// Compiled tab notes keep static score work out of the renderer's frame loop.
// ============================================================

import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { TabNoteIntervalIndex, TabScene, TabSceneEvent, TabSceneNote, } from './TabRenderer'

const EVENT_TOLERANCE_BEATS = 0.0625

export interface CompiledTabNotes {
  notes: readonly TabSceneNote[]
  noteIntervalIndex: TabNoteIntervalIndex
  events: readonly TabSceneEvent[]
  inferredStringCount: number
  observedOpenMidi: readonly (number | undefined)[]
  maxFret: number
  maxNoteDurationBeats: number
  noteById: ReadonlyMap<string, TabSceneNote>
}

const compiledBySource = new WeakMap<readonly GuitarNote[], CompiledTabNotes>()

function fillNoteEndTree(
  notes: readonly TabSceneNote[],
  tree: number[],
  node: number,
  left: number,
  right: number,
): number {
  if (left === right) {
    const note = notes[left]
    const endBeat =
      note === undefined ? -Infinity : note.startBeat + note.durationBeats
    tree[node] = endBeat
    return endBeat
  }
  const middle = Math.floor((left + right) / 2)
  const endBeat = Math.max(
    fillNoteEndTree(notes, tree, node * 2, left, middle),
    fillNoteEndTree(notes, tree, node * 2 + 1, middle + 1, right),
  )
  tree[node] = endBeat
  return endBeat
}

function buildNoteIntervalIndex(
  notes: readonly TabSceneNote[],
): TabNoteIntervalIndex {
  const maxEndTree = Array.from(
    { length: Math.max(1, notes.length * 4) },
    () => -Infinity,
  )
  if (notes.length > 0) {
    fillNoteEndTree(notes, maxEndTree, 1, 0, notes.length - 1)
  }
  return { maxEndTree }
}

export function compileTabNotes(
  sourceNotes: readonly GuitarNote[],
): CompiledTabNotes {
  const cached = compiledBySource.get(sourceNotes)
  if (cached !== undefined) return cached

  let inferredStringCount = 0
  let maxFret = 0
  let maxNoteDurationBeats = 0
  const observedOpenMidi: (number | undefined)[] = []
  const notes = sourceNotes
    .map<TabSceneNote>((note) => {
      inferredStringCount = Math.max(inferredStringCount, note.stringIndex + 1)
      maxFret = Math.max(maxFret, note.fret)
      maxNoteDurationBeats = Math.max(maxNoteDurationBeats, note.duration)
      observedOpenMidi[note.stringIndex] = note.midi - note.fret
      return {
        id: note.id,
        midi: note.midi,
        stringIndex: note.stringIndex,
        fret: note.fret,
        startBeat: note.startBeat,
        durationBeats: note.duration,
        noteName: midiToNoteNameOctave(note.midi),
        isBacking: note.isBacking ?? false,
        ...(note.notation === undefined ? {} : { notation: note.notation }),
      }
    })
    .sort((left, right) => left.startBeat - right.startBeat)

  const eventGroups: TabSceneNote[][] = []
  for (const note of notes) {
    if (note.isBacking) continue
    const group = eventGroups.at(-1)
    const anchor = group?.[0]
    if (
      group === undefined ||
      anchor === undefined ||
      note.startBeat - anchor.startBeat > EVENT_TOLERANCE_BEATS
    ) {
      eventGroups.push([note])
    } else {
      group.push(note)
    }
  }
  const events = eventGroups
    .map<TabSceneEvent>((eventNotes) => {
      const chordLabel = eventNotes.find(
        (note) => note.notation?.chordLabel !== undefined,
      )?.notation?.chordLabel
      const base = {
        id: `event-${eventNotes[0]?.id ?? 'empty'}`,
        startBeat: Math.min(...eventNotes.map((note) => note.startBeat)),
        endBeat: Math.max(
          ...eventNotes.map((note) => note.startBeat + note.durationBeats),
        ),
        notes: eventNotes,
      }
      return chordLabel === undefined ? base : { ...base, chordLabel }
    })
    .sort((left, right) => left.startBeat - right.startBeat)

  const compiled: CompiledTabNotes = {
    notes,
    noteIntervalIndex: buildNoteIntervalIndex(notes),
    events,
    inferredStringCount,
    observedOpenMidi,
    maxFret,
    maxNoteDurationBeats,
    noteById: new Map(notes.map((note) => [note.id, note])),
  }
  compiledBySource.set(sourceNotes, compiled)
  return compiled
}

function overlappingTabNotes(
  source: Pick<CompiledTabNotes, 'notes' | 'noteIntervalIndex'>,
  startBeat: number,
  endBeat: number,
): TabSceneNote[] {
  const visible: TabSceneNote[] = []
  if (source.notes.length === 0) return visible

  const visit = (node: number, left: number, right: number) => {
    if ((source.noteIntervalIndex.maxEndTree[node] ?? -Infinity) < startBeat) {
      return
    }
    const first = source.notes[left]
    if (first === undefined || first.startBeat > endBeat) return
    if (left === right) {
      if (first.startBeat + first.durationBeats >= startBeat) {
        visible.push(first)
      }
      return
    }
    const middle = Math.floor((left + right) / 2)
    visit(node * 2, left, middle)
    visit(node * 2 + 1, middle + 1, right)
  }

  visit(1, 0, source.notes.length - 1)
  return visible
}

function lowerBoundStart<T extends { startBeat: number }>(
  values: readonly T[],
  target: number,
): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if ((values[middle]?.startBeat ?? Infinity) < target) low = middle + 1
    else high = middle
  }
  return low
}

/** Only the notes that can intersect this frame's temporal window. */
export function visibleTabNotes(scene: TabScene): readonly TabSceneNote[] {
  const start = scene.playheadBeat - 0.05
  const end = scene.playheadBeat + scene.visibleBeatWindow * 1.04
  return overlappingTabNotes(scene, start, end)
}

export function visibleTabEvents(scene: TabScene): readonly TabSceneEvent[] {
  const start = scene.playheadBeat - scene.visibleBeatWindow * 0.05
  const end = scene.playheadBeat + scene.visibleBeatWindow * 1.04
  const first = lowerBoundStart(scene.events, start)
  const visible: TabSceneEvent[] = []
  for (let index = first; index < scene.events.length; index += 1) {
    const event = scene.events[index]
    if (event === undefined || event.startBeat > end) break
    visible.push(event)
  }
  return visible
}

/** Match live pitch feedback against only notes that can overlap the playhead. */
export function matchingTabNoteAtPlayhead(
  compiled: CompiledTabNotes,
  playheadBeat: number,
  detectedMidi: number,
  toleranceBeats = 0.35,
): TabSceneNote | undefined {
  const start = playheadBeat - toleranceBeats
  const end = playheadBeat + toleranceBeats
  for (const note of overlappingTabNotes(compiled, start, end)) {
    if (!note.isBacking && detectedMidi % 12 === note.midi % 12) {
      return note
    }
  }
  return undefined
}

export function nextTabEvent(scene: TabScene): TabSceneEvent | null {
  const index = lowerBoundStart(scene.events, scene.playheadBeat - 0.02)
  return scene.events[index] ?? null
}
