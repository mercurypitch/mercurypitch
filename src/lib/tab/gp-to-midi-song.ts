// ============================================================
// Guitar Pro (.gp/.gp3/.gp4/.gp5/.gpx) → MidiSong mapping
// ============================================================
//
// Pure mapping from an alphaTab Score into the app's existing MidiSong shape, so
// imported tabs flow through the SAME pipeline as imported MIDI (saveMidiSong →
// track mixer → loadSong). alphaTab is imported as a TYPE only here, so this
// module carries no runtime dependency on it — the actual library is loaded
// on demand by gp-import.ts when a file is opened.

import type * as alphaTab from '@coderline/alphatab'
import type { MidiSong, MidiSongNote, MidiSongTrack } from '@/lib/midi-song'
import { gmInstrumentName } from '@/lib/midi-song'

/** alphaTab playback ticks per quarter note. */
const TICKS_PER_QUARTER = 960

function trackToMidiSongTrack(
  track: alphaTab.model.Track,
  index: number,
): MidiSongTrack | null {
  if (track.isPercussion) return null
  const info = track.playbackInfo

  const notes: MidiSongNote[] = []
  for (const staff of track.staves) {
    // Tuning is high string first (e.g. [64,59,55,50,45,40]); its length is the
    // string count, so 7/8-string tabs resolve to the right lane.
    const tuning = staff.tuning
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          if (beat.isRest) continue
          const startBeat = beat.absolutePlaybackStart / TICKS_PER_QUARTER
          const duration = beat.playbackDuration / TICKS_PER_QUARTER
          if (duration <= 0) continue
          for (const note of beat.notes) {
            if (note.isDead || note.isTieDestination) continue
            const midi = note.realValue
            if (!Number.isFinite(midi)) continue
            // Preserve the tab's real fingering when the open string resolves
            // unambiguously; otherwise leave it for auto-placement downstream.
            const fret = note.fret
            const stringIndex = fret >= 0 ? tuning.indexOf(midi - fret) : -1
            if (stringIndex >= 0) {
              notes.push({ midi, startBeat, duration, stringIndex, fret })
            } else {
              notes.push({ midi, startBeat, duration })
            }
          }
        }
      }
    }
  }

  if (notes.length === 0) return null
  notes.sort((a, b) => a.startBeat - b.startBeat)

  const program = info?.program ?? 0
  const instrumentName = gmInstrumentName(program)
  const name = track.name.trim() !== '' ? track.name.trim() : instrumentName
  return {
    id: `gp-t${index}`,
    name,
    instrumentName,
    noteCount: notes.length,
    notes,
  }
}

/** Convert an alphaTab Score into a MidiSong (percussion tracks dropped). */
export function scoreToMidiSong(score: alphaTab.model.Score): MidiSong {
  const tracks: MidiSongTrack[] = []
  score.tracks.forEach((track, i) => {
    const mapped = trackToMidiSongTrack(track, i)
    if (mapped !== null) tracks.push(mapped)
  })
  const bpm = score.tempo > 0 ? Math.round(score.tempo) : 120
  return { bpm, tracks }
}

/** Human-readable song name from score metadata, falling back to file name. */
export function scoreName(
  score: alphaTab.model.Score,
  fileName: string,
): string {
  const title = score.title.trim()
  const artist = score.artist.trim()
  if (title !== '' && artist !== '') return `${artist} - ${title}`
  if (title !== '') return title
  return fileName.replace(/\.[^.]+$/, '')
}
