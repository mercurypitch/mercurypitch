// ============================================================
// Piano Night arrangement — one score lane plus audible pitched backing lanes
// ============================================================
//
// PianoProject keeps every source lane authoritative. This projection only
// decides which already-selected pitched lanes reach the lightweight fallback
// synth; percussion stays preserved for the future drum renderer.

import type { PianoProjectStageNote } from '@/features/piano/runtime/piano-project-stage'
import { pianoProjectTrackToStageNotes } from '@/features/piano/runtime/piano-project-stage'
import { pianoProjectTicksPerQuarter } from '@/features/piano-project/piano-project'
import type { PianoNightSource } from './piano-night-source'

export interface PianoNightArrangement {
  readonly scoreNotes: readonly PianoProjectStageNote[]
  readonly backingNotes: readonly PianoProjectStageNote[]
  readonly audibleNotes: readonly PianoProjectStageNote[]
  readonly backingTrackIds: readonly string[]
}

const BACKING_VELOCITY_SCALE = 0.58

function compareNotes(
  left: PianoProjectStageNote,
  right: PianoProjectStageNote,
): number {
  return (
    left.startBeat - right.startBeat ||
    left.midi - right.midi ||
    String(left.id).localeCompare(String(right.id))
  )
}

/** Build the audible fallback-synth arrangement for one staged source. */
export function createPianoNightArrangement(
  source: PianoNightSource,
): PianoNightArrangement {
  const scoreNotes = source.stage.notes
  const project = source.project
  if (project === undefined || project.backingTrackIds.length === 0) {
    return Object.freeze({
      scoreNotes,
      backingNotes: Object.freeze([]),
      audibleNotes: scoreNotes,
      backingTrackIds: Object.freeze([]),
    })
  }

  const selectedIds = new Set(project.backingTrackIds)
  const backingTrackIds: string[] = []
  const backingNotes: PianoProjectStageNote[] = []
  const ticksPerQuarter = pianoProjectTicksPerQuarter(project)

  for (const track of project.tracks) {
    if (
      track.isPercussion ||
      track.id === project.scoreTrackId ||
      !selectedIds.has(track.id)
    ) {
      continue
    }
    const notes = pianoProjectTrackToStageNotes(track, ticksPerQuarter)
    if (notes.length === 0) continue
    backingTrackIds.push(track.id)
    for (const note of notes) {
      backingNotes.push(
        Object.freeze({
          ...note,
          id: `backing:${String(note.id)}`,
          isBacking: true,
          velocity: note.velocity * BACKING_VELOCITY_SCALE,
        }),
      )
    }
  }

  if (backingNotes.length === 0) {
    return Object.freeze({
      scoreNotes,
      backingNotes: Object.freeze([]),
      audibleNotes: scoreNotes,
      backingTrackIds: Object.freeze([]),
    })
  }

  backingNotes.sort(compareNotes)
  const audibleNotes = [...scoreNotes, ...backingNotes].sort(compareNotes)
  return Object.freeze({
    scoreNotes,
    backingNotes: Object.freeze(backingNotes),
    audibleNotes: Object.freeze(audibleNotes),
    backingTrackIds: Object.freeze(backingTrackIds),
  })
}
