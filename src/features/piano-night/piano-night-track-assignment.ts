// ============================================================
// Piano Night track assignment — canonical project selection projection
// ============================================================
//
// Track choice stays on PianoProject ids. This adapter supplies the small,
// display-ready vocabulary the standalone room needs without manufacturing a
// SavedMidiSong compatibility clone or allowing percussion through Hear.

import type { PianoProject, PianoProjectChannelEvent, PianoProjectTrack, } from '@/features/piano-project/piano-project'
import { gmInstrumentName } from '@/lib/midi-song'

export interface PianoNightTrackOption {
  readonly id: string
  readonly name: string
  readonly instrumentName: string
  readonly noteCount: number
  readonly isPercussion: boolean
  readonly sourceTrackIndex: number
  readonly channel: number
}

export interface PianoNightTrackAssignment {
  readonly tracks: readonly PianoNightTrackOption[]
  readonly scoreTrackId: string | null
  readonly backingTrackIds: readonly string[]
  readonly pitchedTrackCount: number
  readonly percussionTrackCount: number
}

function completedNoteCount(track: PianoProjectTrack): number {
  const active = new Map<number, number>()
  let completed = 0
  for (const event of track.events) {
    if (event.type === 'note-on' && event.velocity > 0) {
      active.set(event.note, (active.get(event.note) ?? 0) + 1)
      continue
    }
    if (
      event.type !== 'note-off' &&
      !(event.type === 'note-on' && event.velocity === 0)
    ) {
      continue
    }
    const count = active.get(event.note) ?? 0
    if (count === 0) continue
    completed += 1
    if (count === 1) active.delete(event.note)
    else active.set(event.note, count - 1)
  }
  return completed
}

function firstProgram(
  events: readonly PianoProjectChannelEvent[],
): number | null {
  for (const event of events) {
    if (event.type === 'program-change') return event.program
  }
  return null
}

function trackOption(track: PianoProjectTrack): PianoNightTrackOption | null {
  const noteCount = completedNoteCount(track)
  if (noteCount === 0) return null
  const program = firstProgram(track.events)
  const instrumentName =
    track.instrumentName ??
    (program === null ? 'Unknown instrument' : gmInstrumentName(program))
  const name =
    track.name ??
    (track.instrumentName !== null
      ? track.instrumentName
      : program === null
        ? `Track ${track.sourceTrackIndex + 1}, channel ${track.channel + 1}`
        : instrumentName)
  return Object.freeze({
    id: track.id,
    name,
    instrumentName,
    noteCount,
    isPercussion: track.isPercussion,
    sourceTrackIndex: track.sourceTrackIndex,
    channel: track.channel,
  })
}

/** Project a canonical project's playable lanes into Piano Night controls. */
export function pianoProjectToTrackAssignment(
  project: PianoProject,
): PianoNightTrackAssignment {
  const tracks = Object.freeze(
    project.tracks
      .map(trackOption)
      .filter((track): track is PianoNightTrackOption => track !== null),
  )
  const pitchedIds = new Set(
    tracks.filter((track) => !track.isPercussion).map((track) => track.id),
  )
  let fallbackScoreTrackId: string | null = null
  let fallbackNoteCount = -1
  for (const track of tracks) {
    if (track.isPercussion || track.noteCount <= fallbackNoteCount) continue
    fallbackScoreTrackId = track.id
    fallbackNoteCount = track.noteCount
  }
  const scoreTrackId =
    project.scoreTrackId !== null && pitchedIds.has(project.scoreTrackId)
      ? project.scoreTrackId
      : fallbackScoreTrackId
  const backingTrackIds = Object.freeze(
    project.backingTrackIds.filter(
      (trackId) => trackId !== scoreTrackId && pitchedIds.has(trackId),
    ),
  )

  return Object.freeze({
    tracks,
    scoreTrackId,
    backingTrackIds,
    pitchedTrackCount: pitchedIds.size,
    percussionTrackCount: tracks.length - pitchedIds.size,
  })
}

/** More than one eligible pitched lane merits an explicit import stop. */
export function pianoProjectNeedsTrackAssignment(
  project: PianoProject,
): boolean {
  const assignment = pianoProjectToTrackAssignment(project)
  return (
    assignment.scoreTrackId !== null &&
    (assignment.pitchedTrackCount > 1 ||
      project.scoreTrackId !== assignment.scoreTrackId)
  )
}
