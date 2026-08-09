// ============================================================
// PianoProject compatibility projection — canonical events to legacy MidiSong
// ============================================================
//
// The canonical project remains untouched. This adapter deliberately mirrors
// the legacy Piano import boundary: PPQ beats, one initial tempo, and pitched
// tracks by default. Same-pitch overlaps pair FIFO instead of overwriting one
// another.

import type { MidiSong, MidiSongNote, MidiSongTrack } from '@/lib/midi-song'
import { gmInstrumentName } from '@/lib/midi-song'
import type { PianoProject, PianoProjectChannelEvent, PianoProjectTrack, } from './piano-project'
import { pianoProjectTicksPerQuarter } from './piano-project'

export interface ProjectedMidiSongNote extends MidiSongNote {
  velocity: number
  releaseVelocity: number
}

export interface ProjectedMidiSongTrack extends Omit<MidiSongTrack, 'notes'> {
  notes: ProjectedMidiSongNote[]
}

export interface ProjectedMidiSong extends Omit<MidiSong, 'tracks'> {
  tracks: ProjectedMidiSongTrack[]
  scoreTrackId: string | null
  backingTrackIds: string[]
}

export interface ProjectToMidiSongOptions {
  /** Legacy Piano excludes General MIDI channel 10 unless explicitly requested. */
  includePercussion?: boolean
}

interface ActiveNote {
  tick: number
  velocity: number
  order: number
}

function pairTrackNotes(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): ProjectedMidiSongNote[] {
  const active = new Map<number, ActiveNote[]>()
  const paired: Array<ProjectedMidiSongNote & { sourceOrder: number }> = []

  for (const event of track.events) {
    if (event.type === 'note-on') {
      const queue = active.get(event.note) ?? []
      queue.push({
        tick: event.tick,
        velocity: event.velocity,
        order: event.order,
      })
      active.set(event.note, queue)
      continue
    }
    if (event.type !== 'note-off') continue

    const queue = active.get(event.note)
    const started = queue?.shift()
    if (started === undefined) continue
    if (queue?.length === 0) active.delete(event.note)

    paired.push({
      midi: event.note,
      startBeat: started.tick / ticksPerQuarter,
      duration: Math.max(0.25, (event.tick - started.tick) / ticksPerQuarter),
      velocity: started.velocity,
      releaseVelocity: event.velocity,
      sourceOrder: started.order,
    })
  }

  paired.sort(
    (left, right) =>
      left.startBeat - right.startBeat || left.sourceOrder - right.sourceOrder,
  )
  return paired.map(({ sourceOrder: _sourceOrder, ...note }) => note)
}

function firstProgram(
  events: readonly PianoProjectChannelEvent[],
): number | null {
  for (const event of events) {
    if (event.type === 'program-change') return event.program
  }
  return null
}

function projectTrack(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): ProjectedMidiSongTrack | null {
  const notes = pairTrackNotes(track, ticksPerQuarter)
  if (notes.length === 0) return null

  const program = firstProgram(track.events)
  const instrumentName =
    track.instrumentName ??
    (program === null ? 'Unknown Instrument' : gmInstrumentName(program))
  const name =
    track.name ??
    (track.instrumentName !== null
      ? track.instrumentName
      : program === null
        ? `Track ${track.sourceTrackIndex + 1}, channel ${track.channel + 1}`
        : instrumentName)

  return {
    id: track.id,
    name,
    instrumentName,
    noteCount: notes.length,
    notes,
  }
}

function initialTempoBpm(project: PianoProject): number {
  const first = project.tempoMap[0]
  return first === undefined
    ? 120
    : Math.round(60_000_000 / first.microsecondsPerQuarter)
}

/** Project a canonical PianoProject into the in-memory legacy song DTO. */
export function projectToMidiSong(
  project: PianoProject,
  options: ProjectToMidiSongOptions = {},
): ProjectedMidiSong {
  const ticksPerQuarter = pianoProjectTicksPerQuarter(project)
  const projectedTracks: ProjectedMidiSongTrack[] = []

  for (const track of project.tracks) {
    if (track.isPercussion && options.includePercussion !== true) continue
    const projected = projectTrack(track, ticksPerQuarter)
    if (projected !== null) projectedTracks.push(projected)
  }

  const projectedIds = new Set(projectedTracks.map((track) => track.id))
  const selectedTrack = project.tracks.find(
    (track) => track.id === project.scoreTrackId,
  )
  const selectedIsPitched = selectedTrack?.isPercussion !== true
  let scoreTrackId =
    selectedIsPitched &&
    project.scoreTrackId !== null &&
    projectedIds.has(project.scoreTrackId)
      ? project.scoreTrackId
      : null

  if (scoreTrackId === null) {
    let bestCount = -1
    for (const track of projectedTracks) {
      const canonical = project.tracks.find(
        (candidate) => candidate.id === track.id,
      )
      if (canonical?.isPercussion === true) continue
      if (track.noteCount > bestCount) {
        scoreTrackId = track.id
        bestCount = track.noteCount
      }
    }
  }

  const seenBacking = new Set<string>()
  const backingTrackIds = project.backingTrackIds.filter((trackId) => {
    if (
      trackId === scoreTrackId ||
      !projectedIds.has(trackId) ||
      seenBacking.has(trackId)
    ) {
      return false
    }
    seenBacking.add(trackId)
    return true
  })

  return {
    bpm: initialTempoBpm(project),
    tracks: projectedTracks,
    scoreTrackId,
    backingTrackIds,
  }
}
