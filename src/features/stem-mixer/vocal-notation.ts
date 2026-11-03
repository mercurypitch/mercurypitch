// ============================================================
// Vocal notation — the mixer's shown vocal notes as a score and as MIDI
// ============================================================
//
// The mixer keeps sung notes in SECONDS: Pitch Studio's `EditableNote` holds
// seconds in `startBeat`/`endBeat` (see useStemMixerPitchAnalysisController).
// A score needs beats on a grid and one note at a time, so the notation copy
// snaps to sixteenths and clips overlaps. A MIDI file keeps the sung timing
// instead, and only refuses to start a pitch that is still sounding: a split
// note's halves, or an edit that drags one note over the next.
//
// Both read the tempo through `safeBpm`, so a song whose tempo is unknown is
// written at 120 everywhere rather than at NaN somewhere.

import type { MidiNoteEvent } from '@/lib/midi-generator'
import { DEFAULT_BPM, TICKS_PER_BEAT } from '@/lib/midi-generator'
import { midiToNote } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'
import type { EditableNote } from './pitch-edit-model'

/** A sixteenth note: the finest step the score writes. */
export const NOTATION_GRID_BEATS = 0.25

/** The tempo to write at: the song's own when it is a real number, else 120. */
export function safeBpm(bpm: number | null | undefined): number {
  return typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0
    ? bpm
    : DEFAULT_BPM
}

const isTimed = (note: EditableNote): boolean =>
  Number.isFinite(note.startBeat) &&
  Number.isFinite(note.endBeat) &&
  Number.isFinite(note.midi)

const snapToGrid = (beats: number): number =>
  Math.round(beats / NOTATION_GRID_BEATS) * NOTATION_GRID_BEATS

/**
 * The notes as a score: beats at `bpm`, starts and ends on the sixteenth grid,
 * and one note at a time. A note the grid squeezes to nothing keeps one step;
 * a note whose neighbour starts on the same step gives way to it.
 */
export function shownNotesToMelody(
  notes: readonly EditableNote[],
  bpm: number,
): MelodyItem[] {
  const beatsPerSecond = safeBpm(bpm) / 60
  const placed = notes
    .filter(isTimed)
    .map((note) => {
      const midi = Math.round(note.midi)
      const start = Math.max(0, snapToGrid(note.startBeat * beatsPerSecond))
      const end = Math.max(
        start + NOTATION_GRID_BEATS,
        snapToGrid(note.endBeat * beatsPerSecond),
      )
      return { midi, start, end }
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi)

  const melody: MelodyItem[] = []
  placed.forEach((note, index) => {
    const next = placed[index + 1]
    const end = next === undefined ? note.end : Math.min(note.end, next.start)
    if (end - note.start < NOTATION_GRID_BEATS) return
    const { name, octave } = midiToNote(note.midi)
    melody.push({
      id: melody.length + 1,
      note: {
        midi: note.midi,
        name,
        octave,
        freq: 440 * 2 ** ((note.midi - 69) / 12),
      },
      startBeat: note.start,
      duration: end - note.start,
    })
  })
  return melody
}

/**
 * The notes as MIDI events at `bpm`, with the sung timing kept. Every event
 * lasts at least one tick, and a note ends no later than the next attack of
 * its own pitch, so no player is asked to restart a key that is still down.
 */
export function shownNotesToMidiEvents(
  notes: readonly EditableNote[],
  bpm: number,
): MidiNoteEvent[] {
  const ticksPerSecond = (safeBpm(bpm) / 60) * TICKS_PER_BEAT
  const events = notes
    .filter(isTimed)
    .map((note) => {
      const tickOn = Math.max(0, Math.round(note.startBeat * ticksPerSecond))
      const tickOff = Math.max(
        tickOn + 1,
        Math.round(note.endBeat * ticksPerSecond),
      )
      return { midi: Math.round(note.midi), tickOn, tickOff }
    })
    .sort((a, b) => a.tickOn - b.tickOn || a.midi - b.midi)

  // Walk backwards so each note already knows where its pitch next starts.
  const nextAttack = new Map<number, number>()
  const kept: MidiNoteEvent[] = []
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const next = nextAttack.get(event.midi)
    const tickOff =
      next === undefined ? event.tickOff : Math.min(event.tickOff, next)
    if (tickOff > event.tickOn) {
      kept.push({ midi: event.midi, tickOn: event.tickOn, tickOff })
    }
    nextAttack.set(event.midi, event.tickOn)
  }
  return kept.reverse()
}
