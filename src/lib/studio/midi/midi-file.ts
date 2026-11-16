// ============================================================
// Studio MIDI file — a Standard MIDI File written from tracks of notes: format 1 at 960 PPQ, one tempo, 4/4, a named track each
// ============================================================
//
// Pure: notes in the file's own ticks in, the file's bytes out. Where the
// notes come from, and how a song's clips become them, is song-midi-file.ts.
//
// The first track holds no notes. It names the file's sequence (the song's
// title, as the format names a format 1 file's sequence by its first track)
// and carries the tempo and the time signature, the conductor's track every
// reader looks for. Each track after it is one lane: its name, a program
// change when it has one, and its notes on one channel.
//
// At a tick, a note-off goes before a note-on, so a note that ends where the
// next one of its pitch starts is not ended by it. Every status byte is
// written out, without running status, so the file reads the same in a
// reader that mishandles it. Names are UTF-8, as today's DAWs write them; a
// name in plain ASCII reads the same as Latin-1.
//
// Each track ends at its `endTick`: a clip's rests after its last note stay
// in the file, and a reader that takes a clip's length from its track's end
// keeps it. The first track ends with the last, in one gap from its start,
// and a gap holds 268,435,455 ticks at most, so a longer song is refused.
import { STUDIO_PPQ } from '../model/types'

/** A note in the file's ticks, its velocities as MIDI carries them. */
export interface StudioMidiFileNote {
  /** 0 to 127. */
  readonly pitch: number
  readonly startTick: number
  /** After `startTick`. */
  readonly endTick: number
  /** The note-on's, 1 to 127. */
  readonly velocity: number
  /** The note-off's, 0 to 127. */
  readonly releaseVelocity: number
}

/** One track of notes, all on one channel. */
export interface StudioMidiFileTrack {
  readonly name: string
  /** 0 to 15: the tenth, 9, is General MIDI's drum kit. */
  readonly channel: number
  /** A program change at the track's start, 0 to 127; none when absent. */
  readonly program?: number
  /** Where the track ends: no sooner than its last note does. */
  readonly endTick: number
  readonly notes: readonly StudioMidiFileNote[]
}

export interface StudioMidiFile {
  /** The sequence's name, its first track's: the song's title. */
  readonly name: string
  /** The one tempo, in quarter notes a minute. */
  readonly tempoBpm: number
  readonly tracks: readonly StudioMidiFileTrack[]
}

/** The most a variable-length quantity holds in its four bytes: a gap of about 15 hours at 300 bpm. */
const MAX_VAR_LEN = 0x0fffffff

const NOTE_OFF = 0x80
const NOTE_ON = 0x90
const PROGRAM_CHANGE = 0xc0
const META = 0xff
const META_TRACK_NAME = 0x03
const META_END_OF_TRACK = 0x2f
const META_TEMPO = 0x51
const META_TIME_SIGNATURE = 0x58
/** 4/4: four quarters, a quarter as 2 to the 2nd, 24 clocks a click, 8 thirty-seconds a quarter. */
const COMMON_TIME = [4, 2, 24, 8] as const

function check(ok: boolean, what: string): void {
  if (!ok) throw new RangeError(`A MIDI file cannot hold ${what}.`)
}

function whole(value: number, low: number, high: number): boolean {
  return Number.isSafeInteger(value) && value >= low && value <= high
}

/** `value` as a variable-length quantity: seven bits a byte, the high bit set on all but the last. */
function varLen(value: number): number[] {
  check(value <= MAX_VAR_LEN, 'a gap of more than 268,435,455 ticks')
  const bytes = [value & 0x7f]
  for (let rest = value >>> 7; rest > 0; rest >>>= 7)
    bytes.unshift((rest & 0x7f) | 0x80)
  return bytes
}

function uint32(value: number): number[] {
  return [
    value >>> 24,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0))
}

function meta(type: number, data: readonly number[]): number[] {
  return [META, type, ...varLen(data.length), ...data]
}

function nameEvent(name: string): number[] {
  return meta(META_TRACK_NAME, [...new TextEncoder().encode(name)])
}

/** One event of a track, at its tick: the order its kind takes at that tick, then pitch. */
interface TimedEvent {
  readonly tick: number
  readonly rank: number
  readonly pitch: number
  readonly bytes: readonly number[]
}

/** A track chunk: each event after the time since the one before it, then End of Track at `endTick` or after the last event. */
function chunk(events: readonly TimedEvent[], endTick: number): number[] {
  const data: number[] = []
  let at = 0
  for (const event of events) {
    data.push(...varLen(event.tick - at), ...event.bytes)
    at = event.tick
  }
  const end = Math.max(at, endTick)
  data.push(...varLen(end - at), ...meta(META_END_OF_TRACK, []))
  return [...ascii('MTrk'), ...uint32(data.length), ...data]
}

function conductor(file: StudioMidiFile, endTick: number): number[] {
  check(
    Number.isFinite(file.tempoBpm) && file.tempoBpm > 0,
    `a tempo of ${file.tempoBpm} bpm`,
  )
  const perQuarter = Math.round(60_000_000 / file.tempoBpm)
  check(whole(perQuarter, 1, 0xffffff), `a tempo of ${file.tempoBpm} bpm`)
  const tempo = [
    perQuarter >>> 16,
    (perQuarter >>> 8) & 0xff,
    perQuarter & 0xff,
  ]
  return chunk(
    [
      { tick: 0, rank: 0, pitch: 0, bytes: nameEvent(file.name) },
      { tick: 0, rank: 0, pitch: 0, bytes: meta(META_TEMPO, tempo) },
      {
        tick: 0,
        rank: 0,
        pitch: 0,
        bytes: meta(META_TIME_SIGNATURE, COMMON_TIME),
      },
    ],
    endTick,
  )
}

function noteEvents(
  note: StudioMidiFileNote,
  channel: number,
): [TimedEvent, TimedEvent] {
  check(whole(note.pitch, 0, 127), `a note of pitch ${note.pitch}`)
  check(
    whole(note.startTick, 0, Number.MAX_SAFE_INTEGER),
    'a note before its start',
  )
  check(
    whole(note.endTick, note.startTick + 1, Number.MAX_SAFE_INTEGER),
    'a note that ends before it starts',
  )
  check(whole(note.velocity, 1, 127), `a velocity of ${note.velocity}`)
  check(
    whole(note.releaseVelocity, 0, 127),
    `a release velocity of ${note.releaseVelocity}`,
  )
  return [
    {
      tick: note.startTick,
      rank: 2,
      pitch: note.pitch,
      bytes: [NOTE_ON | channel, note.pitch, note.velocity],
    },
    {
      tick: note.endTick,
      rank: 1,
      pitch: note.pitch,
      bytes: [NOTE_OFF | channel, note.pitch, note.releaseVelocity],
    },
  ]
}

function laneChunk(track: StudioMidiFileTrack): number[] {
  check(whole(track.channel, 0, 15), `channel ${track.channel}`)
  const opening: TimedEvent[] = [
    { tick: 0, rank: 0, pitch: 0, bytes: nameEvent(track.name) },
  ]
  if (track.program !== undefined) {
    check(whole(track.program, 0, 127), `program ${track.program}`)
    opening.push({
      tick: 0,
      rank: 0,
      pitch: 0,
      bytes: [PROGRAM_CHANGE | track.channel, track.program],
    })
  }
  const events = track.notes
    .flatMap((note) => noteEvents(note, track.channel))
    .sort((a, b) => a.tick - b.tick || a.rank - b.rank || a.pitch - b.pitch)
  check(
    whole(track.endTick, 0, Number.MAX_SAFE_INTEGER),
    'a track before its start',
  )
  return chunk([...opening, ...events], track.endTick)
}

/** `file` as a Standard MIDI File's bytes. Throws a RangeError for a value the format cannot hold. */
export function writeStudioMidiFile(
  file: StudioMidiFile,
): Uint8Array<ArrayBuffer> {
  const count = file.tracks.length + 1
  check(count <= 0xffff, `${count} tracks`)
  // A loop, not a spread: a lane may hold more notes than a call takes arguments.
  let endTick = 0
  for (const track of file.tracks) {
    endTick = Math.max(endTick, track.endTick)
    for (const note of track.notes) endTick = Math.max(endTick, note.endTick)
  }
  const header = [
    ...ascii('MThd'),
    ...uint32(6),
    0,
    1,
    count >>> 8,
    count & 0xff,
    STUDIO_PPQ >>> 8,
    STUDIO_PPQ & 0xff,
  ]
  const tracks = [conductor(file, endTick), ...file.tracks.map(laneChunk)]
  const bytes = new Uint8Array(
    header.length + tracks.reduce((total, track) => total + track.length, 0),
  )
  bytes.set(header, 0)
  let at = header.length
  for (const track of tracks) {
    bytes.set(track, at)
    at += track.length
  }
  return bytes
}
