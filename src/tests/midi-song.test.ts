// ============================================================
// MIDI Song Parser Tests — multi-track import
// ============================================================

import { describe, expect, it } from 'vitest'
import { defaultScoreTrack, parseMidiSong } from '@/lib/midi-song'

// ── Binary MIDI builders ───────────────────────────────────────

function header(format: number, numTracks: number, division = 480): number[] {
  return [
    0x4d,
    0x54,
    0x68,
    0x64, // MThd
    0,
    0,
    0,
    6,
    (format >> 8) & 0xff,
    format & 0xff,
    (numTracks >> 8) & 0xff,
    numTracks & 0xff,
    (division >> 8) & 0xff,
    division & 0xff,
  ]
}

function trackChunk(events: number[]): number[] {
  const body = [...events, 0x00, 0xff, 0x2f, 0x00] // append end-of-track
  return [
    0x4d,
    0x54,
    0x72,
    0x6b, // MTrk
    (body.length >> 24) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
    ...body,
  ]
}

function varLen(value: number): number[] {
  // Sufficient for test values < 2^14
  if (value < 0x80) return [value]
  return [0x80 | (value >> 7), value & 0x7f]
}

/** delta, note-on, then delta, note-off — one quarter note */
function quarterNote(
  channel: number,
  midi: number,
  deltaBefore: number,
): number[] {
  return [
    ...varLen(deltaBefore),
    0x90 | channel,
    midi,
    100,
    ...varLen(480),
    0x80 | channel,
    midi,
    0,
  ]
}

function trackName(name: string): number[] {
  const bytes = [...name].map((c) => c.charCodeAt(0))
  return [0x00, 0xff, 0x03, bytes.length, ...bytes]
}

function setTempo(usPerBeat: number): number[] {
  return [
    0x00,
    0xff,
    0x51,
    0x03,
    (usPerBeat >> 16) & 0xff,
    (usPerBeat >> 8) & 0xff,
    usPerBeat & 0xff,
  ]
}

function programChange(channel: number, program: number): number[] {
  return [0x00, 0xc0 | channel, program]
}

function buildMidi(...tracks: number[][]): Uint8Array {
  const bytes = [
    ...header(1, tracks.length),
    ...tracks.flatMap((t) => trackChunk(t)),
  ]
  return new Uint8Array(bytes)
}

// ── Tests ──────────────────────────────────────────────────────

describe('parseMidiSong', () => {
  it('returns null for invalid data', () => {
    expect(parseMidiSong(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('returns null for a MIDI file with no notes', () => {
    const data = buildMidi([...setTempo(500000)])
    expect(parseMidiSong(data)).toBeNull()
  })

  it('parses a single-track file with correct beats and durations', () => {
    const data = buildMidi([
      ...quarterNote(0, 60, 0),
      ...quarterNote(0, 64, 480),
    ])
    const song = parseMidiSong(data)
    expect(song).not.toBeNull()
    expect(song!.tracks).toHaveLength(1)
    const notes = song!.tracks[0].notes
    expect(notes).toHaveLength(2)
    expect(notes[0]).toEqual({ midi: 60, startBeat: 0, duration: 1 })
    expect(notes[1]).toEqual({ midi: 64, startBeat: 2, duration: 1 })
  })

  it('reads tempo from the set-tempo meta event', () => {
    const data = buildMidi(
      [...setTempo(600000)], // 100 BPM
      [...quarterNote(0, 60, 0)],
    )
    const song = parseMidiSong(data)
    expect(song!.bpm).toBe(100)
  })

  it('defaults to 120 BPM without a tempo event', () => {
    const data = buildMidi([...quarterNote(0, 60, 0)])
    expect(parseMidiSong(data)!.bpm).toBe(120)
  })

  it('keeps tracks separate with names and GM instrument names', () => {
    const data = buildMidi(
      [
        ...trackName('Lead Guitar'),
        ...programChange(0, 30), // Distortion Guitar
        ...quarterNote(0, 60, 0),
      ],
      [
        ...trackName('Bass'),
        ...programChange(1, 33), // Fingered Bass
        ...quarterNote(1, 40, 0),
        ...quarterNote(1, 43, 0),
      ],
    )
    const song = parseMidiSong(data)
    expect(song!.tracks).toHaveLength(2)
    expect(song!.tracks[0].name).toBe('Lead Guitar')
    expect(song!.tracks[0].instrumentName).toBe('Distortion Guitar')
    expect(song!.tracks[0].noteCount).toBe(1)
    expect(song!.tracks[1].name).toBe('Bass')
    expect(song!.tracks[1].instrumentName).toBe('Fingered Bass')
    expect(song!.tracks[1].noteCount).toBe(2)
  })

  it('filters out drum-channel notes (channel 10)', () => {
    const data = buildMidi(
      [...quarterNote(0, 60, 0)],
      [...quarterNote(9, 36, 0)], // kick drum on channel 10
    )
    const song = parseMidiSong(data)
    expect(song!.tracks).toHaveLength(1)
    expect(song!.tracks[0].notes[0].midi).toBe(60)
  })

  it('splits multi-channel format-0 files into per-channel tracks', () => {
    const data = new Uint8Array([
      ...header(0, 1),
      ...trackChunk([...quarterNote(0, 60, 0), ...quarterNote(3, 45, 0)]),
    ])
    const song = parseMidiSong(data)
    expect(song!.tracks).toHaveLength(2)
  })

  it('handles running status', () => {
    // Note-on with status, then a second note-on reusing running status
    const data = buildMidi([
      0x00,
      0x90,
      60,
      100, // C4 on
      0x00,
      64,
      100, // E4 on (running status)
      ...varLen(480),
      60,
      0, // C4 off via velocity-0 (running status)
      0x00,
      64,
      0, // E4 off (running status)
    ])
    const song = parseMidiSong(data)
    expect(song!.tracks[0].noteCount).toBe(2)
  })
})

describe('defaultScoreTrack', () => {
  it('picks the track with the most notes', () => {
    const data = buildMidi(
      [...quarterNote(0, 60, 0)],
      [...quarterNote(1, 40, 0), ...quarterNote(1, 43, 0)],
    )
    const song = parseMidiSong(data)!
    expect(defaultScoreTrack(song).id).toBe(song.tracks[1].id)
  })
})
