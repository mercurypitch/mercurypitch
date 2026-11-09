// ============================================================
// Studio take notes — the notes a MIDI lane's player played into a take, as the sequence its clip plays
// ============================================================
//
// A MIDI lane keeps the sound of its instrument as an ordinary take, and
// the notes that made the sound go into the song with its clip, as a
// sequence (docs/plans/studio-midi.md). Each note is logged at the clock
// time its sound started and stopped: the instrument's own times, so the
// notes line up with the audio. A sequence counts ticks from the take's
// first sample, which is where its clip's source frames count from too, at
// the song's tempo as the take is kept (midi/time.ts). A loop's passes are
// windows of one take, so a note in a later pass sits past the clip's
// window, where the take's audio does before its clip moves to it.
import { studioNoteVelocity } from '../midi/notes'
import { studioFramesToTicks, studioTicksCovering } from '../midi/time'
import type { StudioNote, StudioSequence } from '../model/types'
import { STUDIO_PPQ, STUDIO_SAMPLE_RATE } from '../model/types'
import { STUDIO_MAX_SEQUENCE_NOTES } from '../model/validation-midi'

/** A note as it sounded, on the clock, in seconds; `end` null while it sounds. */
export interface StudioPlayedNote {
  readonly midi: number
  /** As the port gave it: above 0, up to 1, kept to 4 decimals. */
  readonly velocity: number
  readonly start: number
  readonly end: number | null
}

/** When a take captured: its first sample's clock time, and how long it ran. */
export interface StudioNotedTake {
  readonly capturedFrom: number
  readonly seconds: number
}

/** How long a log keeps a note: a take's five minutes, its count-in, and room. */
const LOG_SECONDS = 400

/** The notes played on an armed MIDI lane, as they sound, for the takes recorded meanwhile. */
export function createStudioNoteLog() {
  let played: {
    midi: number
    velocity: number
    start: number
    end: number | null
  }[] = []
  const sounding = new Map<string, (typeof played)[number]>()
  return {
    /** Voice `id` began to sound at `at`, `velocity` as the port gives it, 0 to 1. */
    started(id: string, midi: number, velocity: number, at: number): void {
      // A note this old belongs to no take the recorder can still keep.
      played = played.filter(
        (note) => note.end === null || note.end > at - LOG_SECONDS,
      )
      const note = {
        midi,
        velocity: studioNoteVelocity(velocity),
        start: at,
        end: null,
      }
      played.push(note)
      sounding.set(id, note)
    },
    /** Voice `id` stopped sounding at `at`. */
    stopped(id: string, at: number): void {
      const note = sounding.get(id)
      if (note === undefined) return
      sounding.delete(id)
      note.end = Math.max(note.start, at)
    },
    /** Every note kept, oldest first. */
    notes(): readonly StudioPlayedNote[] {
      return played.map((note) => ({ ...note }))
    },
  }
}

export type StudioNoteLog = ReturnType<typeof createStudioNoteLog>

/**
 * A take's notes in ticks from its first sample, at `tempoBpm`: the ones
 * that began while it captured, each ending by the take's end at the
 * latest and a tick long at the least, numbered from 1 in the order they
 * began.
 */
export function studioTakeNotes(
  played: readonly StudioPlayedNote[],
  take: StudioNotedTake,
  tempoBpm: number,
): StudioNote[] {
  const end = take.capturedFrom + take.seconds
  const tickOf = (time: number) =>
    studioFramesToTicks(
      (time - take.capturedFrom) * STUDIO_SAMPLE_RATE,
      tempoBpm,
    )
  const captured = played
    .filter((note) => note.start >= take.capturedFrom && note.start < end)
    .slice(0, STUDIO_MAX_SEQUENCE_NOTES)
  return captured.map((note, index) => {
    const startTick = tickOf(note.start)
    const endTick = Math.max(
      startTick + 1,
      tickOf(Math.min(note.end ?? end, end)),
    )
    return {
      id: index + 1,
      pitch: note.midi,
      startTick,
      lengthTicks: endTick - startTick,
      velocity: note.velocity,
    }
  })
}

/** A take's sequence: its notes, over its whole stored audio of `frames` frames, at `tempoBpm`. */
export function studioTakeSequence(take: {
  readonly id: string
  readonly notes: readonly StudioNote[]
  readonly tempoBpm: number
  readonly frames: number
}): StudioSequence {
  return {
    id: take.id,
    ppq: STUDIO_PPQ,
    tempoBpm: take.tempoBpm,
    lengthTicks: studioTicksCovering(take.frames, take.tempoBpm),
    nextNoteId:
      take.notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1,
    notes: take.notes,
  }
}
