// ============================================================
// MIDI Song Parser — multi-track import with instrument names
// ============================================================
//
// Unlike importMelodyFromMIDI (which flattens everything into one
// melody), this parser keeps tracks separate so the user can choose
// which track to practice against and which to hear as backing.

/** A single note within a parsed MIDI track. */
export interface MidiSongNote {
  midi: number
  startBeat: number
  duration: number
  /** Original tab fingering (Guitar Pro imports only): 0-based, high string first. */
  stringIndex?: number
  /** Original tab fret (Guitar Pro imports only). */
  fret?: number
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
}

export interface MidiSong {
  /** Tempo from the first set-tempo meta event (default 120) */
  bpm: number
  tracks: MidiSongTrack[]
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

const DRUM_CHANNEL = 9

interface RawNote {
  midi: number
  startTick: number
  durationTicks: number
}

/**
 * Parse a Standard MIDI File (format 0 or 1) into per-track note lists.
 * Returns null if the data is not a valid MIDI file or has no notes.
 */
export function parseMidiSong(data: Uint8Array): MidiSong | null {
  try {
    if (data.length < 14) return null
    if (
      data[0] !== 0x4d ||
      data[1] !== 0x54 ||
      data[2] !== 0x68 ||
      data[3] !== 0x64
    ) {
      return null
    }
    const format = (data[8] << 8) | data[9]
    if (format !== 0 && format !== 1) return null
    const ticksPerBeat = (data[12] << 8) | data[13]
    if (ticksPerBeat === 0) return null

    let bpm = 120
    let bpmFound = false

    const tracks: MidiSongTrack[] = []
    let offset = 14
    let trackIndex = 0

    while (offset + 8 <= data.length) {
      if (
        data[offset] !== 0x4d ||
        data[offset + 1] !== 0x54 ||
        data[offset + 2] !== 0x72 ||
        data[offset + 3] !== 0x6b
      ) {
        break
      }
      const trackLen =
        (data[offset + 4] << 24) |
        (data[offset + 5] << 16) |
        (data[offset + 6] << 8) |
        data[offset + 7]
      offset += 8
      const trackEnd = offset + trackLen

      let tick = 0
      let trackName = ''
      let runningStatus = 0
      // Per-channel state within this track
      const programByChannel = new Map<number, number>()
      const notesByChannel = new Map<number, RawNote[]>()
      const activeByChannel = new Map<string, { tick: number }>()

      while (offset < trackEnd && offset < data.length) {
        // Variable-length delta time
        let delta = 0
        let vlqBytes = 0
        while (offset < data.length && vlqBytes < 4) {
          const b = data[offset++]
          vlqBytes++
          delta = (delta << 7) | (b & 0x7f)
          if (!(b & 0x80)) break
        }
        tick += delta
        if (offset >= data.length) break

        let status = data[offset]
        if (status & 0x80) {
          offset++
          if (status < 0xf0) runningStatus = status
        } else {
          // Running status — reuse the previous status byte
          status = runningStatus
          if (!(status & 0x80)) break // malformed
        }

        if (status === 0xff) {
          // Meta event (cancels running status per SMF spec)
          runningStatus = 0
          if (offset >= data.length) break
          const metaType = data[offset++]
          // Meta length is a VLQ too
          let len = 0
          let lb = 0
          while (offset < data.length && lb < 4) {
            const b = data[offset++]
            lb++
            len = (len << 7) | (b & 0x7f)
            if (!(b & 0x80)) break
          }
          if (metaType === 0x2f) break // end of track
          if (metaType === 0x03 && trackName === '') {
            trackName = new TextDecoder()
              .decode(data.slice(offset, offset + len))
              .trim()
          }
          if (metaType === 0x51 && len === 3 && !bpmFound) {
            const usPerBeat =
              (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
            if (usPerBeat > 0) {
              bpm = Math.round(60000000 / usPerBeat)
              bpmFound = true
            }
          }
          offset += len
          continue
        }

        if (status === 0xf0 || status === 0xf7) {
          // Sysex — VLQ length (also cancels running status)
          runningStatus = 0
          let len = 0
          let lb = 0
          while (offset < data.length && lb < 4) {
            const b = data[offset++]
            lb++
            len = (len << 7) | (b & 0x7f)
            if (!(b & 0x80)) break
          }
          offset += len
          continue
        }

        const channel = status & 0x0f
        const msgType = status & 0xf0

        if (msgType === 0x90 || msgType === 0x80) {
          if (offset + 2 > data.length) break
          const note = data[offset++]
          const velocity = data[offset++]
          const key = `${channel}:${note}`
          const isOn = msgType === 0x90 && velocity > 0
          if (isOn) {
            activeByChannel.set(key, { tick })
          } else {
            const on = activeByChannel.get(key)
            if (on) {
              activeByChannel.delete(key)
              let list = notesByChannel.get(channel)
              if (!list) {
                list = []
                notesByChannel.set(channel, list)
              }
              list.push({
                midi: note,
                startTick: on.tick,
                durationTicks: Math.max(1, tick - on.tick),
              })
            }
          }
        } else if (msgType === 0xc0) {
          if (offset + 1 > data.length) break
          const program = data[offset++]
          if (!programByChannel.has(channel)) {
            programByChannel.set(channel, program)
          }
        } else if (msgType === 0xd0) {
          offset += 1
        } else if (msgType === 0xa0 || msgType === 0xb0 || msgType === 0xe0) {
          offset += 2
        } else {
          break // unknown status — bail out of this track
        }
      }
      offset = Math.max(offset, trackEnd)

      // Emit one MidiSongTrack per channel that produced notes
      for (const [channel, rawNotes] of notesByChannel) {
        if (channel === DRUM_CHANNEL) continue // pitched playback of drums sounds wrong
        const program = programByChannel.get(channel)
        const instrumentName =
          program !== undefined
            ? (GM_INSTRUMENTS[program] ?? `Program ${program}`)
            : 'Unknown Instrument'
        const name =
          trackName !== ''
            ? trackName
            : program !== undefined
              ? instrumentName
              : `Track ${trackIndex + 1}`
        rawNotes.sort((a, b) => a.startTick - b.startTick)
        tracks.push({
          id: `t${trackIndex}c${channel}`,
          name,
          instrumentName,
          noteCount: rawNotes.length,
          notes: rawNotes.map((n) => ({
            midi: n.midi,
            startBeat: n.startTick / ticksPerBeat,
            duration: Math.max(0.25, n.durationTicks / ticksPerBeat),
          })),
        })
      }
      trackIndex++
    }

    if (tracks.length === 0) return null
    return { bpm, tracks }
  } catch {
    return null
  }
}

/** Pick a sensible default track to score against: most notes wins. */
export function defaultScoreTrack(song: MidiSong): MidiSongTrack {
  let best = song.tracks[0]
  for (const t of song.tracks) {
    if (t.noteCount > best.noteCount) best = t
  }
  return best
}
