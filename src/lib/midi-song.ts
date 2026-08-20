// ============================================================
// MIDI Song Parser — multi-track import with instrument names
// ============================================================
//
// Unlike importMelodyFromMIDI (which flattens everything into one
// melody), this parser keeps tracks separate so the user can choose
// which track to practice against and which to hear as backing.

import type { GuitarNoteNotation } from '@/lib/guitar/guitar-notation'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { parseMidiSongViaProject } from '@/lib/midi-song-from-project'

/** A single note within a parsed MIDI track. */
export interface MidiSongNote {
  /** Stable score-local id when the source exposes note relationships. */
  id?: string
  midi: number
  startBeat: number
  duration: number
  /** Original tab fingering (Guitar Pro imports only): 0-based, high string first. */
  stringIndex?: number
  /** Original tab fret (Guitar Pro imports only). */
  fret?: number
  /** The source explicitly authored this row/fret, even if sounding pitch differs. */
  authoredFingering?: boolean
  /**
   * Guitar Pro "let ring": the note keeps sounding past its notated length
   * until the same string is struck again. Realised at import by extending
   * `duration` to the next same-string note (see gp-to-midi-song.ts); the flag
   * is preserved for a future visual cue / honor-toggle.
   */
  letRing?: boolean
  /** Guitar Pro notation retained verbatim enough for every stage renderer. */
  notation?: GuitarNoteNotation
}

/** One playable track (drum channels are filtered out). */
export interface MidiSongTrack {
  /** Stable id within the song (track index + channel) */
  id: string
  /** Track name from meta events, or a GM instrument fallback */
  name: string
  /** General MIDI instrument name from the first program change */
  instrumentName: string
  noteCount: number
  notes: MidiSongNote[]
  /** Authored open pitches before capo, highest string first. */
  sourceTuning?: readonly number[]
  /** Authored tuning name when the file carried one. */
  sourceTuningName?: string
  /** Authored capo fret. Zero is meaningful and may be present. */
  sourceCapo?: number
}

/** One set-tempo event, placed on the beat it takes effect. */
export interface MidiTempoChange {
  beat: number
  /** Microseconds per quarter note — the value the file actually stores. */
  usPerBeat: number
}

export interface MidiSong {
  /** Tempo in force at beat zero (SMF default 120 until a later event). */
  bpm: number
  /**
   * Every set-tempo event in the file, not just the first.
   *
   * Optional because songs saved before this field existed do not have one,
   * and callers may still construct a constant-tempo song directly. Absent
   * means "no map recorded" — `createBeatClock` then runs at `bpm` throughout,
   * which is what those callers already assumed.
   *
   * It matters wherever a beat has to become a real second. Dance of Death
   * changes tempo ten times, and reading only the first puts its last note
   * minutes from where it is actually played.
   */
  tempoChanges?: MidiTempoChange[]
  /**
   * Every time signature in the file, on the beat it takes effect.
   *
   * Optional for the same reason `tempoChanges` is: songs saved before the
   * field existed do not have one, and a caller building a song by hand need
   * not care. Absent means "the file said nothing", which `buildBars` reads as
   * common time throughout — the assumption every reading surface used to make
   * silently.
   */
  timeSignatures?: MidiTimeSignature[]
  tracks: MidiSongTrack[]
}

/**
 * Beats to seconds through the whole tempo map.
 *
 * Returns a function rather than converting one beat at a time: the anchors
 * are accumulated once, so converting a few thousand notes stays linear
 * instead of rescanning the map per note.
 */
type MidiTempoSource = {
  bpm: number
  tempoChanges?: readonly MidiTempoChange[]
  /** Accepted for whole-song object literals; timing itself does not read it. */
  tracks?: readonly unknown[]
}

interface TempoAnchor {
  beat: number
  seconds: number
  usPerBeat: number
}

function tempoAnchors(song: MidiTempoSource): TempoAnchor[] {
  const changes = [...(song.tempoChanges ?? [])].sort(
    (left, right) => left.beat - right.beat,
  )
  const opening = 60000000 / Math.max(1, song.bpm)
  if (changes.length === 0 || (changes[0]?.beat ?? 0) > 0) {
    changes.unshift({ beat: 0, usPerBeat: opening })
  }

  // Seconds elapsed at each change, accumulated at the tempo in force before it.
  const anchors: TempoAnchor[] = [
    { beat: 0, seconds: 0, usPerBeat: changes[0]?.usPerBeat ?? opening },
  ]
  for (let index = 1; index < changes.length; index += 1) {
    const change = changes[index]
    const previous = anchors[index - 1]
    if (change === undefined || previous === undefined) continue
    anchors.push({
      beat: change.beat,
      seconds:
        previous.seconds +
        ((change.beat - previous.beat) * previous.usPerBeat) / 1e6,
      usPerBeat: change.usPerBeat,
    })
  }
  return anchors
}

export function createBeatClock(
  song: MidiTempoSource,
): (beat: number) => number {
  const anchors = tempoAnchors(song)

  return (beat: number): number => {
    let anchor = anchors[0]
    if (anchor === undefined) return 0
    // Linear rather than binary: a tempo map is a handful of entries, and the
    // scan is cheaper than the branchy search it would replace.
    for (const candidate of anchors) {
      if (candidate.beat <= beat) anchor = candidate
      else break
    }
    return anchor.seconds + ((beat - anchor.beat) * anchor.usPerBeat) / 1e6
  }
}

/** Seconds back to authored beat time through the same complete tempo map. */
export function createSecondsToBeatClock(
  song: MidiTempoSource,
): (seconds: number) => number {
  const anchors = tempoAnchors(song)

  return (seconds: number): number => {
    let anchor = anchors[0]
    if (anchor === undefined) return 0
    for (const candidate of anchors) {
      if (candidate.seconds <= seconds) anchor = candidate
      else break
    }
    return anchor.beat + ((seconds - anchor.seconds) * 1e6) / anchor.usPerBeat
  }
}

/** General MIDI program names (programs 0–127). */
const GM_INSTRUMENTS = [
  'Acoustic Grand Piano',
  'Bright Piano',
  'Electric Grand Piano',
  'Honky-tonk Piano',
  'Electric Piano 1',
  'Electric Piano 2',
  'Harpsichord',
  'Clavinet',
  'Celesta',
  'Glockenspiel',
  'Music Box',
  'Vibraphone',
  'Marimba',
  'Xylophone',
  'Tubular Bells',
  'Dulcimer',
  'Drawbar Organ',
  'Percussive Organ',
  'Rock Organ',
  'Church Organ',
  'Reed Organ',
  'Accordion',
  'Harmonica',
  'Tango Accordion',
  'Nylon Guitar',
  'Steel Guitar',
  'Jazz Guitar',
  'Clean Guitar',
  'Muted Guitar',
  'Overdriven Guitar',
  'Distortion Guitar',
  'Guitar Harmonics',
  'Acoustic Bass',
  'Fingered Bass',
  'Picked Bass',
  'Fretless Bass',
  'Slap Bass 1',
  'Slap Bass 2',
  'Synth Bass 1',
  'Synth Bass 2',
  'Violin',
  'Viola',
  'Cello',
  'Contrabass',
  'Tremolo Strings',
  'Pizzicato Strings',
  'Orchestral Harp',
  'Timpani',
  'String Ensemble 1',
  'String Ensemble 2',
  'Synth Strings 1',
  'Synth Strings 2',
  'Choir Aahs',
  'Voice Oohs',
  'Synth Voice',
  'Orchestra Hit',
  'Trumpet',
  'Trombone',
  'Tuba',
  'Muted Trumpet',
  'French Horn',
  'Brass Section',
  'Synth Brass 1',
  'Synth Brass 2',
  'Soprano Sax',
  'Alto Sax',
  'Tenor Sax',
  'Baritone Sax',
  'Oboe',
  'English Horn',
  'Bassoon',
  'Clarinet',
  'Piccolo',
  'Flute',
  'Recorder',
  'Pan Flute',
  'Blown Bottle',
  'Shakuhachi',
  'Whistle',
  'Ocarina',
  'Square Lead',
  'Sawtooth Lead',
  'Calliope Lead',
  'Chiff Lead',
  'Charang Lead',
  'Voice Lead',
  'Fifths Lead',
  'Bass + Lead',
  'New Age Pad',
  'Warm Pad',
  'Polysynth Pad',
  'Choir Pad',
  'Bowed Pad',
  'Metallic Pad',
  'Halo Pad',
  'Sweep Pad',
  'Rain FX',
  'Soundtrack FX',
  'Crystal FX',
  'Atmosphere FX',
  'Brightness FX',
  'Goblins FX',
  'Echoes FX',
  'Sci-Fi FX',
  'Sitar',
  'Banjo',
  'Shamisen',
  'Koto',
  'Kalimba',
  'Bag Pipe',
  'Fiddle',
  'Shanai',
  'Tinkle Bell',
  'Agogo',
  'Steel Drums',
  'Woodblock',
  'Taiko Drum',
  'Melodic Tom',
  'Synth Drum',
  'Reverse Cymbal',
  'Guitar Fret Noise',
  'Breath Noise',
  'Seashore',
  'Bird Tweet',
  'Telephone Ring',
  'Helicopter',
  'Applause',
  'Gunshot',
]

/** General MIDI program (0–127) → instrument name. */
export function gmInstrumentName(program: number): string {
  return GM_INSTRUMENTS[program] ?? `Program ${program}`
}

/**
 * Read Standard MIDI bytes into a song, or answer null when the file will not
 * open.
 *
 * The decoding itself belongs to the Piano Project parser — one reader for the
 * format, validated and tick-native — and `midi-song-from-project.ts` projects
 * its output down to notes on beats. See that module for what "will not open"
 * now covers.
 */
export function parseMidiSong(data: Uint8Array): MidiSong | null {
  return parseMidiSongViaProject(data, gmInstrumentName)
}

/** Pick a sensible default track to score against: most notes wins. */
export function defaultScoreTrack(song: MidiSong): MidiSongTrack {
  let best = song.tracks[0]
  for (const t of song.tracks) {
    if (t.noteCount > best.noteCount) best = t
  }
  return best
}
