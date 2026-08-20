// ============================================================
// MidiSong from a PianoProject — one SMF decoder, two views
// ============================================================
//
// There were two Standard MIDI readers in the tree. The Piano Project one is
// tick-native, validated, and keeps every meta event the file carried; the
// other was a compact scanner written for the track picker, which quietly
// assumed common time and dropped everything it did not immediately need.
// Two readers means two sets of bugs and two different answers for the same
// file, so the scanner is gone and this adapter projects the full parse down
// to the note-and-beat view the reading surfaces want.
//
// The projection is deliberately narrow: pair note-ons with note-offs, name
// the tracks, convert ticks to quarter beats. Everything else the project
// carries stays in the project, available the day a surface needs it.

import { parseMidiProject, PianoProjectParseError, } from '@/features/piano-project/parse-midi-project'
import type { PianoProject, PianoProjectTrack, } from '@/features/piano-project/piano-project'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import type { MidiSong, MidiSongNote, MidiSongPercussionHit, MidiSongPercussionTrack, MidiSongTrack, MidiTempoChange, } from '@/lib/midi-song'
import { generalMidiPercussionName, normalizeGeneralMidiPercussionKey, } from '@/lib/percussion'

/** SMF's own default until a set-tempo event says otherwise. */
const DEFAULT_BPM = 120

/**
 * A note shorter than this reads as a click rather than a pitch, and a
 * zero-length one cannot be drawn at all. The floor predates this adapter and
 * is kept so imports land where they always did.
 */
const MIN_NOTE_BEATS = 0.25

/**
 * `parseMidiProject` wants provenance it can store; a one-shot read has none.
 *
 * Nothing downstream reads these fields — the adapter throws the project away
 * once it has the notes — so they are named for what they are rather than
 * faked into looking like a real import.
 */
function transientIdentity(): Parameters<typeof parseMidiProject>[1] {
  return {
    id: 'transient-midi-song',
    name: 'Imported MIDI',
    fileName: 'imported.mid',
    sha256: '',
    importedAt: '1970-01-01T00:00:00.000Z',
  }
}

/** Pair note-ons with their note-offs, in source order, within one track. */
function trackNotes(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): MidiSongNote[] {
  const sounding = new Map<number, number>()
  const notes: MidiSongNote[] = []

  for (const event of track.events) {
    if (event.type !== 'note-on' && event.type !== 'note-off') continue
    const isOn = event.type === 'note-on' && event.velocity > 0
    if (isOn) {
      // A second on for a pitch already sounding restarts it, which is what
      // the old scanner did and what a sequencer hears.
      sounding.set(event.note, event.tick)
      continue
    }
    const startTick = sounding.get(event.note)
    if (startTick === undefined) continue
    sounding.delete(event.note)
    notes.push({
      midi: event.note,
      startBeat: startTick / ticksPerQuarter,
      duration: Math.max(
        MIN_NOTE_BEATS,
        Math.max(1, event.tick - startTick) / ticksPerQuarter,
      ),
    })
  }

  return notes.sort((left, right) => left.startBeat - right.startBeat)
}

/** Keep channel-10 note-ons as one-shots; a note-off is never required. */
function trackPercussionHits(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): { hits: MidiSongPercussionHit[]; droppedHitCount: number } {
  const hits: MidiSongPercussionHit[] = []
  let droppedHitCount = 0

  for (const event of track.events) {
    if (event.type !== 'note-on' || event.velocity <= 0) continue
    const gmKey = normalizeGeneralMidiPercussionKey(event.note)
    if (gmKey === null) {
      droppedHitCount += 1
      continue
    }
    hits.push({
      id: `midi-t${track.sourceTrackIndex}-e${event.order}`,
      gmKey,
      startBeat: event.tick / ticksPerQuarter,
      velocity: event.velocity,
      source: {
        format: 'midi',
        channel: event.channel,
        midiKey: event.note,
        label: generalMidiPercussionName(gmKey),
      },
    })
  }

  return {
    hits: hits.sort((left, right) => left.startBeat - right.startBeat),
    droppedHitCount,
  }
}

function percussionTrack(
  track: PianoProjectTrack,
  ticksPerQuarter: number,
): MidiSongPercussionTrack | null {
  const { hits, droppedHitCount } = trackPercussionHits(track, ticksPerQuarter)
  if (hits.length === 0 && droppedHitCount === 0) return null
  const name = track.name?.trim() ?? ''
  return {
    id: `t${track.sourceTrackIndex}c${track.channel}`,
    kind: 'percussion',
    name: name === '' ? 'Drums' : name,
    instrumentName: track.instrumentName ?? 'General MIDI Drum Kit',
    noteCount: hits.length,
    notes: [],
    percussionHits: hits,
    droppedHitCount,
  }
}

/** The first program change on a track, which is what names its instrument. */
function trackProgram(track: PianoProjectTrack): number | undefined {
  for (const event of track.events) {
    if (event.type === 'program-change') return event.program
  }
  return undefined
}

/**
 * Every time signature the file wrote, on the beat it takes effect.
 *
 * Conductor-track ordering is already settled by the parse, so this only has
 * to change the unit.
 */
export function timeSignaturesFromProject(
  project: PianoProject,
): MidiTimeSignature[] {
  const ticksPerQuarter = project.source.ticksPerQuarter
  return project.timeSignatures.map((signature) => ({
    beat: signature.tick / ticksPerQuarter,
    numerator: signature.numerator,
    denominator: signature.denominator,
  }))
}

/** Every set-tempo event the file wrote, on the beat it takes effect. */
export function tempoChangesFromProject(
  project: PianoProject,
): MidiTempoChange[] {
  const ticksPerQuarter = project.source.ticksPerQuarter
  return project.tempoMap
    .map((tempo) => ({
      beat: tempo.tick / ticksPerQuarter,
      usPerBeat: tempo.microsecondsPerQuarter,
    }))
    .filter((change) => change.usPerBeat > 0)
    .sort((left, right) => left.beat - right.beat)
}

/**
 * The note-and-beat view of a parsed project.
 *
 * Track ids stay `t{sourceTrack}c{channel}` because saved scores name the part
 * they are scored against by that id. A new id scheme would silently unpick
 * every reference a reader has already saved.
 */
export function midiSongFromProject(
  project: PianoProject,
  gmInstrumentName: (program: number) => string,
): MidiSong | null {
  const ticksPerQuarter = project.source.ticksPerQuarter
  const tracks: MidiSongTrack[] = []

  for (const track of project.tracks) {
    if (track.isPercussion) {
      const mapped = percussionTrack(track, ticksPerQuarter)
      if (mapped !== null) tracks.push(mapped)
      continue
    }
    const notes = trackNotes(track, ticksPerQuarter)
    if (notes.length === 0) continue

    const program = trackProgram(track)
    const instrumentName =
      program === undefined ? 'Unknown Instrument' : gmInstrumentName(program)
    const name =
      track.name !== null && track.name !== ''
        ? track.name
        : program === undefined
          ? `Track ${track.sourceTrackIndex + 1}`
          : instrumentName

    tracks.push({
      id: `t${track.sourceTrackIndex}c${track.channel}`,
      kind: 'pitched',
      name,
      instrumentName,
      noteCount: notes.length,
      notes,
    })
  }

  if (tracks.length === 0) return null

  const tempoChanges = tempoChangesFromProject(project)
  const opening = tempoChanges.find((change) => change.beat === 0)
  return {
    bpm:
      opening === undefined
        ? DEFAULT_BPM
        : Math.round(60000000 / opening.usPerBeat),
    tempoChanges,
    timeSignatures: timeSignaturesFromProject(project),
    tracks,
  }
}

/**
 * Read Standard MIDI bytes into a song, or answer null.
 *
 * Null now covers more than it did. The scanner this replaced would keep
 * whatever it had read before a file went wrong — a truncated track, trailing
 * bytes, an SMPTE division it could not represent — and hand back a song with
 * silently wrong timing. The project parser refuses the file instead. A reader
 * told "this file will not open" can re-export it; a reader given a score that
 * drifts has no way to know why.
 */
export function parseMidiSongViaProject(
  data: Uint8Array,
  gmInstrumentName: (program: number) => string,
): MidiSong | null {
  let project: PianoProject
  try {
    project = parseMidiProject(data, transientIdentity())
  } catch (error) {
    if (error instanceof PianoProjectParseError) return null
    throw error
  }
  return midiSongFromProject(project, gmInstrumentName)
}
