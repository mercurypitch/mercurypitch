// ============================================================
// Studio MIDI file clips — a MIDI file as new lanes of a song: a lane for each track and channel that holds notes, each with one clip from the song's start, its notes in seconds through the file's tempo map
// ============================================================
//
// docs/plans/studio-midi-clips.md, 1.5. The file comes as the app's strict
// parser reads it (parse-midi-project.ts); this module reads only the parts
// it names below, so lib does not depend on the feature that parses. What
// it gives back is the new-clip builder's input (new-midi-clips.ts), which
// makes the lanes, their sequences and their clips in one undo step.
//
// LANES — one for each track and channel that holds notes, in the file's
// order. Channel 10 (index 9) is a Drums lane, which plays the kit; every
// other channel a Piano lane, named after its track, or after its General
// MIDI program when the track has no name. A track whose notes spread over
// several channels (a format 0 file's one track) names each lane after its
// program instead, since its name is the song's. Names are UTF-8, as the
// Studio writes them (midi-file.ts); a name that is not valid UTF-8 reads as
// the parser read it.
//
// TIME — a note keeps its time in seconds through the file's tempo map, and
// its sequence lays it in ticks at the song's tempo. A song with no clips
// yet takes the file's first tempo first, so a file of one tempo keeps its
// beats on the song's bars.
//
// CLIPS — one a lane, from the song's start, all as long as the file's last
// note's end rounded up to a bar. A MIDI clip runs five minutes at most
// (midi-window.ts), so a longer file keeps its first five minutes, in whole
// bars, and says so.
//
// NOTES — paired note-on to note-off first in, first out for each pitch, as
// the app reads a file elsewhere (project-to-midi-song.ts), so two of one
// pitch that overlap stay two notes, as two keys held on a keyboard are
// recorded. What the song's validator would refuse is made valid as a
// recording does it (take-notes.ts): a note at least a tick long, a note
// never ended ending at the file's end, a velocity kept to 4 decimals and
// above 0. A note-off velocity of 0 or 64 is MIDI's for "none" (a note-on of
// velocity 0; a keyboard without release velocity), so it is the song's
// default, left out; any other is kept. Each note keeps its channel. A
// lane whose clip would hold more notes than a sequence holds is left out,
// and named.
import { gmInstrumentName } from '@/lib/midi-song'
import type { StudioNewMidiClip, StudioNewMidiNote, } from '../model/new-midi-clips'
import type { StudioProject } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import { STUDIO_MAX_SEQUENCE_NOTES } from '../model/validation-midi'
import { studioNoteVelocity } from './notes'
import { studioFramesToTicks } from './time'

/** A note-on, a note-off (a note-on of velocity 0 among them), as the parser reads them. */
interface FileNoteEvent {
  readonly type: 'note-on' | 'note-off'
  readonly tick: number
  readonly note: number
  readonly velocity: number
}

interface FileProgramEvent {
  readonly type: 'program-change'
  readonly tick: number
  readonly program: number
}

interface FileOtherEvent {
  readonly type:
    | 'poly-aftertouch'
    | 'control-change'
    | 'channel-pressure'
    | 'pitch-bend'
  readonly tick: number
}

/** One track and channel of the file. */
export interface StudioMidiFileReadTrack {
  /** The MTrk it came from: a format 0 file's channels share one. */
  readonly sourceTrackIndex: number
  readonly channel: number
  /** Its track's name, a character a byte, as the parser keeps text. */
  readonly name: string | null
  /** In the file's order. */
  readonly events: readonly (
    | FileNoteEvent
    | FileProgramEvent
    | FileOtherEvent
  )[]
}

/** A MIDI file as the app's parser reads it (parse-midi-project.ts): the parts the import reads. */
export interface StudioMidiFileRead {
  readonly source: { readonly ticksPerQuarter: number }
  /** By tick; of two on one tick, the later rules. */
  readonly tempoMap: readonly {
    readonly tick: number
    readonly microsecondsPerQuarter: number
  }[]
  /** The file's last tick: where a note never ended ends. */
  readonly durationTicks: number
  readonly tracks: readonly StudioMidiFileReadTrack[]
}

/** A MIDI file's new lanes, ready for the new-clip builder (new-midi-clips.ts). */
export interface StudioMidiFileClips {
  /** The tempo the song takes before the clips go in: present only for a song with no clips yet. */
  readonly songTempoBpm?: number
  /** One a lane, each on a new lane, in the file's order. */
  readonly clips: readonly StudioNewMidiClip[]
  /** The names of the lanes left out: their clips would hold more than a sequence holds. */
  readonly leftOut: readonly string[]
  /** The file's length in seconds, when it ran past what a clip holds and was cut. */
  readonly cutFrom?: number
}

/** The furthest a MIDI clip's window reaches: five minutes (midi-window.ts). */
const MOST_SECONDS = 300
/** MIDI's tempo until a file sets one: 120 bpm. */
const DEFAULT_MICROSECONDS = 500_000
/** The song's tempo range (validation.ts). */
const LOWEST_BPM = 20
const HIGHEST_BPM = 300
const DRUM_CHANNEL = 9
/** A lane's name, at most: a track's name can be a paragraph. */
const NAME_LENGTH = 64

interface TempoPoint {
  readonly tick: number
  readonly seconds: number
  readonly secondsPerTick: number
}

/** Each tempo's start, in ticks and seconds: the second of two on one tick replaces the first. */
function tempoPoints(file: StudioMidiFileRead): TempoPoint[] {
  const ppq = file.source.ticksPerQuarter
  const points: TempoPoint[] = [
    { tick: 0, seconds: 0, secondsPerTick: DEFAULT_MICROSECONDS / 1e6 / ppq },
  ]
  for (const tempo of file.tempoMap) {
    const last = points[points.length - 1]
    const secondsPerTick = tempo.microsecondsPerQuarter / 1e6 / ppq
    if (tempo.tick === last.tick)
      points[points.length - 1] = { ...last, secondsPerTick }
    else
      points.push({
        tick: tempo.tick,
        seconds: last.seconds + (tempo.tick - last.tick) * last.secondsPerTick,
        secondsPerTick,
      })
  }
  return points
}

/** Tick `tick` of the file in seconds, through its tempo map. */
function secondsAt(points: readonly TempoPoint[], tick: number): number {
  let low = 0
  let high = points.length - 1
  while (low < high) {
    const middle = (low + high + 1) >>> 1
    if (points[middle].tick <= tick) low = middle
    else high = middle - 1
  }
  const point = points[low]
  return point.seconds + (tick - point.tick) * point.secondsPerTick
}

/** A track's name as written: UTF-8 when it reads as UTF-8, else as the parser read it; control characters gone, and null when nothing is left. */
export function studioMidiTrackName(read: string | null): string | null {
  if (read === null) return null
  let text = read
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(read, (char) => char.charCodeAt(0) & 0xff),
    )
  } catch {
    // Not UTF-8: a byte a character, as Latin-1 reads it.
  }
  // eslint-disable-next-line no-control-regex
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, ' ')
  const name = [...clean.replace(/\s+/g, ' ').trim()]
    .slice(0, NAME_LENGTH)
    .join('')
    .trim()
  return name === '' ? null : name
}

/** A velocity of 1 to 127 as a sequence keeps it: 0 to 1, to 4 decimals, above 0. */
function noteVelocity(velocity: number): number {
  return studioNoteVelocity(velocity / 127)
}

/** A note-off's velocity as a sequence keeps it: none for MIDI's 0 and 64, else 0 to 1 to 4 decimals. */
function releaseVelocity(velocity: number): number | undefined {
  if (velocity === 0 || velocity === 64) return undefined
  return Math.round((velocity / 127) * 10_000) / 10_000
}

/** A note of the file, in its ticks: its velocities as MIDI's 0 to 127. */
interface FileNote {
  readonly pitch: number
  readonly startTick: number
  readonly endTick: number
  readonly velocity: number
  readonly releaseVelocity: number
}

/** A track's notes, each note-on ended by the next note-off of its pitch not yet used, first in, first out; one never ended ends at `fileEnd`. */
function pairedNotes(
  track: StudioMidiFileReadTrack,
  fileEnd: number,
): FileNote[] {
  const sounding = new Map<number, { tick: number; velocity: number }[]>()
  const notes: FileNote[] = []
  for (const event of track.events) {
    if (event.type !== 'note-on' && event.type !== 'note-off') continue
    const queue = sounding.get(event.note) ?? []
    if (event.type === 'note-on') {
      queue.push({ tick: event.tick, velocity: event.velocity })
      sounding.set(event.note, queue)
      continue
    }
    const held = queue.shift()
    if (held === undefined) continue
    notes.push({
      pitch: event.note,
      startTick: held.tick,
      endTick: event.tick,
      velocity: held.velocity,
      releaseVelocity: event.velocity,
    })
  }
  for (const [pitch, queue] of sounding)
    for (const held of queue)
      notes.push({
        pitch,
        startTick: held.tick,
        endTick: Math.max(held.tick, fileEnd),
        velocity: held.velocity,
        releaseVelocity: 0,
      })
  return notes
}

/** The program a track plays: its first program change, else General MIDI's first, the grand. */
function programOf(track: StudioMidiFileReadTrack): number {
  for (const event of track.events)
    if (event.type === 'program-change') return event.program
  return 0
}

/** Each lane's name: its track's, or its program's when its track has none or is split by channel; repeats numbered. */
function laneNames(
  lanes: readonly { track: StudioMidiFileReadTrack; split: boolean }[],
): string[] {
  const used = new Map<string, number>()
  return lanes.map(({ track, split }) => {
    const own = split ? null : studioMidiTrackName(track.name)
    const base =
      own ??
      (track.channel === DRUM_CHANNEL
        ? 'Drums'
        : gmInstrumentName(programOf(track)))
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return count === 1 ? base : `${base} ${count}`
  })
}

/** The file's first tempo, as the song may take it: to 4 decimals, inside the song's range, else null. */
function firstTempo(points: readonly TempoPoint[], ppq: number): number | null {
  const bpm = 60 / (points[0].secondsPerTick * ppq)
  const kept = Math.round(bpm * 10_000) / 10_000
  return kept >= LOWEST_BPM && kept <= HIGHEST_BPM ? kept : null
}

/**
 * `file`'s tracks as new lanes of `song`, each with one clip from the
 * song's start: the builder's input, the tempo the song takes first when it
 * has no clips yet, the lanes left out for holding too many notes, and
 * where a file too long for a clip was cut.
 */
export function studioMidiFileClips(
  file: StudioMidiFileRead,
  song: Pick<StudioProject, 'tempoBpm' | 'clips'>,
): StudioMidiFileClips {
  const points = tempoPoints(file)
  const takes =
    song.clips.length === 0
      ? firstTempo(points, file.source.ticksPerQuarter)
      : null
  const tempoBpm = takes ?? song.tempoBpm
  const withNotes = file.tracks
    .map((track) => ({ track, notes: pairedNotes(track, file.durationTicks) }))
    .filter((lane) => lane.notes.length > 0)
  const channels = new Map<number, number>()
  for (const { track } of withNotes)
    channels.set(
      track.sourceTrackIndex,
      (channels.get(track.sourceTrackIndex) ?? 0) + 1,
    )
  const names = laneNames(
    withNotes.map(({ track }) => ({
      track,
      split: (channels.get(track.sourceTrackIndex) ?? 0) > 1,
    })),
  )
  const seconds = (tick: number) => secondsAt(points, tick)

  // The clips' length: the last note's end, rounded up to a bar, five
  // minutes at most. Lanes over a sequence's notes are left out first, then
  // the length follows the lanes kept: a shorter clip holds fewer notes, so
  // no lane kept goes over.
  const bar = (4 * 60) / tempoBpm
  const most = Math.max(1, Math.floor(MOST_SECONDS / bar + 1e-9))
  const span = (lanes: readonly { notes: readonly FileNote[] }[]) => {
    const lastEnd = Math.max(
      0,
      ...lanes.map(({ notes }) =>
        notes.reduce((end, note) => Math.max(end, seconds(note.endTick)), 0),
      ),
    )
    const wanted = Math.max(1, Math.ceil(lastEnd / bar - 1e-9))
    const bars = Math.min(wanted, most)
    return {
      lastEnd,
      cut: wanted > most,
      frames: Math.round(bars * bar * STUDIO_SAMPLE_RATE),
    }
  }
  const heard = (notes: readonly FileNote[], frames: number) =>
    notes.filter(
      (note) => seconds(note.startTick) * STUDIO_SAMPLE_RATE < frames,
    )
  const all = span(withNotes)
  const leftOut: string[] = []
  const kept = withNotes.filter(({ notes }, index) => {
    const over = heard(notes, all.frames).length > STUDIO_MAX_SEQUENCE_NOTES
    if (over) leftOut.push(names[index])
    return !over
  })
  const { lastEnd, cut, frames } = span(kept)
  const tick = (secondsIn: number) =>
    Math.max(0, studioFramesToTicks(secondsIn * STUDIO_SAMPLE_RATE, tempoBpm))

  const clips = kept.map(({ track, notes }): StudioNewMidiClip => {
    const sequenceNotes: StudioNewMidiNote[] = heard(notes, frames)
      .map((note) => {
        const startTick = tick(seconds(note.startTick))
        const release = releaseVelocity(note.releaseVelocity)
        return {
          pitch: note.pitch,
          startTick,
          lengthTicks: Math.max(1, tick(seconds(note.endTick)) - startTick),
          velocity: noteVelocity(note.velocity),
          ...(release !== undefined && { releaseVelocity: release }),
          ...(track.channel !== 0 && { channel: track.channel }),
        }
      })
      .sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
    return {
      lane: {
        name: names[withNotes.findIndex((lane) => lane.track === track)],
        role: track.channel === DRUM_CHANNEL ? 'drums' : 'keys',
      },
      startFrame: 0,
      frames,
      notes: sequenceNotes,
      tempoBpm,
    }
  })
  return {
    ...(takes !== null && takes !== song.tempoBpm && { songTempoBpm: takes }),
    clips,
    leftOut,
    ...(cut && { cutFrom: lastEnd }),
  }
}
