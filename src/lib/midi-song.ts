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

export {
  createBeatClock,
  createSecondsToBeatClock,
} from '@/lib/midi-tempo-clock'

/** A single pitched note within a parsed MIDI track. */
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

/** Source evidence retained for a percussion articulation. */
export interface MidiSongPercussionSource {
  format: 'midi' | 'guitar-pro'
  /** Original MIDI channel when the source was an SMF (zero based). */
  channel?: number
  /** Original MIDI key before a documented fold onto the GM map. */
  midiKey?: number
  /** Direct legacy GP articulation id, or the modern articulation's own id. */
  articulationId?: number
  /** Modern GP index into track.percussionArticulations; zero is meaningful. */
  articulationIndex?: number
  label?: string
  staffLine?: number
  noteHead?: number
  technique?: number
}

/** A one-shot drum articulation. Duration is notation, never sound length. */
export interface MidiSongPercussionHit {
  id?: string
  /** Bounded General MIDI percussion key (35–81), not a pitch. */
  gmKey: number
  startBeat: number
  /** Authored attack intensity, 1–127. */
  velocity: number
  /** Written duration for a future staff renderer; playback stays one-shot. */
  writtenDuration?: number
  source?: MidiSongPercussionSource
}

interface MidiSongTrackBase {
  /** Stable id within the song (track index + channel) */
  id: string
  /** Track name from meta events, or a GM instrument fallback */
  name: string
  /** General MIDI instrument name from the first program change */
  instrumentName: string
  noteCount: number
}

/** A scoreable pitched track in the canonical in-memory song model. */
export interface MidiSongPitchedTrack extends MidiSongTrackBase {
  kind: 'pitched'
  notes: MidiSongNote[]
  /** Authored open pitches before capo, highest string first. */
  sourceTuning?: readonly number[]
  /** Authored tuning name when the file carried one. */
  sourceTuningName?: string
  /** Authored capo fret. Zero is meaningful and may be present. */
  sourceCapo?: number
}

/** A percussion track whose events can never enter a pitch renderer. */
export interface MidiSongPercussionTrack extends MidiSongTrackBase {
  kind: 'percussion'
  /** Compatibility seam for pitch-only readers; always empty by invariant. */
  notes: never[]
  sourceTuning?: never
  sourceTuningName?: never
  sourceCapo?: never
  percussionHits: MidiSongPercussionHit[]
  /** Source articulations dropped because no honest GM mapping existed. */
  droppedHitCount: number
}

export type MidiSongTrack = MidiSongPitchedTrack | MidiSongPercussionTrack

/** Pre-percussion saved rows had no track discriminator. Normalize at ingress. */
export interface LegacyMidiSongPitchedTrack extends Omit<
  MidiSongPitchedTrack,
  'kind'
> {
  kind?: 'pitched'
}

export interface MidiSongNormalizationInput extends Omit<MidiSong, 'tracks'> {
  tracks: Array<MidiSongTrack | LegacyMidiSongPitchedTrack>
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

export function isPercussionMidiSongTrack(
  track: MidiSongTrack,
): track is MidiSongPercussionTrack {
  return track.kind === 'percussion'
}

export function isPitchedMidiSongTrack(
  track: MidiSongTrack,
): track is MidiSongPitchedTrack {
  return track.kind === 'pitched'
}

/**
 * Upgrade trusted in-memory or persisted legacy DTOs at their boundary.
 * Missing `kind` means pitched because old MercuryPitch versions never saved
 * percussion. A malformed percussion row is dropped, never reinterpreted as
 * pitch data.
 */
export function normalizeMidiSong(song: MidiSongNormalizationInput): MidiSong {
  return {
    ...song,
    tracks: song.tracks.map((track) => {
      if (track.kind !== 'percussion') {
        return { ...track, kind: 'pitched' as const }
      }
      const hits = (track.percussionHits ?? []).filter(
        (hit) =>
          Number.isInteger(hit.gmKey) &&
          hit.gmKey >= 35 &&
          hit.gmKey <= 81 &&
          Number.isFinite(hit.startBeat) &&
          hit.startBeat >= 0 &&
          Number.isInteger(hit.velocity) &&
          hit.velocity >= 1 &&
          hit.velocity <= 127,
      )
      return {
        ...track,
        kind: 'percussion' as const,
        notes: [],
        percussionHits: hits,
        noteCount: hits.length,
        droppedHitCount:
          Math.max(0, track.droppedHitCount ?? 0) +
          ((track.percussionHits?.length ?? 0) - hits.length),
      }
    }),
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

/** Pick the densest pitched track; percussion is never a neck/keyboard score. */
export function defaultScoreTrack(song: MidiSong): MidiSongPitchedTrack | null {
  let best: MidiSongPitchedTrack | null = null
  for (const track of song.tracks) {
    if (!isPitchedMidiSongTrack(track) || track.notes.length === 0) continue
    if (best === null || track.noteCount > best.noteCount) best = track
  }
  return best
}
