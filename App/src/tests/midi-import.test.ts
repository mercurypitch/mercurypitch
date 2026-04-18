// ============================================================
// MIDI Import Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { importMelodyFromMIDI } from '@/lib/piano-roll'

function encodeVLQ(value: number): number[] {
  if (value < 0) return [0]
  const bytes: number[] = []
  let v = value
  // Extract 7-bit chunks from LSB upward
  bytes.push(v & 0x7f) // first chunk (may be the only byte)
  v >>= 7
  while (v > 0) {
    bytes.push((v & 0x7f) | 0x80) // continuation byte
    v >>= 7
  }
  // VLQ is big-endian: first byte has MSB clear, subsequent bytes have MSB set
  // Reverse so the most-significant chunk comes first
  return bytes.reverse()
}

function buildMidiFile(
  notes: Array<{
    pitch: number
    startTick: number
    endTick: number
    velocity?: number
  }>,
  ticksPerBeat = 480,
): Uint8Array {
  const velocity = 80
  const header = new Uint8Array(14)
  header[0] = 0x4d
  header[1] = 0x54
  header[2] = 0x68
  header[3] = 0x64 // "MThd"
  header[4] = 0
  header[5] = 0
  header[6] = 0
  header[7] = 6 // length = 6
  header[8] = 0
  header[9] = 0 // format = 0
  header[10] = 0
  header[11] = 1 // ntracks = 1
  header[12] = (ticksPerBeat >> 8) & 0xff
  header[13] = ticksPerBeat & 0xff

  interface AbsEvent {
    tick: number
    type: 'on' | 'off'
    pitch: number
    vel: number
  }
  const absEvents: AbsEvent[] = []
  for (const { pitch, startTick, endTick, velocity: vel = velocity } of notes) {
    absEvents.push({ tick: startTick, type: 'on', pitch, vel })
    absEvents.push({ tick: endTick, type: 'off', pitch, vel })
  }
  absEvents.sort((a, b) => a.tick - b.tick)

  const trackBytes: number[] = []
  let prevTick = 0
  for (const ev of absEvents) {
    const delta = ev.tick - prevTick
    for (const b of encodeVLQ(delta)) trackBytes.push(b)
    if (ev.type === 'on') {
      trackBytes.push(0x90, ev.pitch, ev.vel)
    } else {
      trackBytes.push(0x80, ev.pitch, 0)
    }
    prevTick = ev.tick
  }
  // End of track
  trackBytes.push(0, 0xff, 0x2f, 0)

  const totalLen = 8 + trackBytes.length // MTrk (4) + len (4) + data
  const result = new Uint8Array(totalLen)
  result[0] = 0x4d
  result[1] = 0x54
  result[2] = 0x72
  result[3] = 0x6b // "MTrk"
  result[4] = (trackBytes.length >> 24) & 0xff
  result[5] = (trackBytes.length >> 16) & 0xff
  result[6] = (trackBytes.length >> 8) & 0xff
  result[7] = trackBytes.length & 0xff
  for (let i = 0; i < trackBytes.length; i++) result[8 + i] = trackBytes[i]

  // Concatenate header + track chunk
  const midi = new Uint8Array(header.length + result.length)
  midi.set(header, 0)
  midi.set(result, header.length)
  return midi
}

function buildMidiFormat1(
  tracks: Array<
    Array<{ tick: number; type: 'on' | 'off'; pitch: number; vel: number }>
  >,
  ticksPerBeat = 480,
): Uint8Array {
  const velocity = 80
  const header = new Uint8Array(14)
  header[0] = 0x4d
  header[1] = 0x54
  header[2] = 0x68
  header[3] = 0x64 // "MThd"
  header[4] = 0
  header[5] = 0
  header[6] = 0
  header[7] = 6 // length = 6
  header[8] = 0
  header[9] = 1 // format = 1
  header[10] = 0
  header[11] = tracks.length // ntracks
  header[12] = (ticksPerBeat >> 8) & 0xff
  header[13] = ticksPerBeat & 0xff

  const trackChunks: Uint8Array[] = []
  for (const trackEvents of tracks) {
    const absEvents = trackEvents.map((e) => ({
      tick: e.tick,
      type: e.type,
      pitch: e.pitch,
      vel: e.vel ?? velocity,
    }))
    absEvents.sort((a, b) => a.tick - b.tick)

    const trackBytes: number[] = []
    let prevTick = 0
    for (const ev of absEvents) {
      const delta = ev.tick - prevTick
      for (const b of encodeVLQ(delta)) trackBytes.push(b)
      if (ev.type === 'on') {
        trackBytes.push(0x90, ev.pitch, ev.vel)
      } else {
        trackBytes.push(0x80, ev.pitch, 0)
      }
      prevTick = ev.tick
    }
    trackBytes.push(0, 0xff, 0x2f, 0)

    const chunk = new Uint8Array(8 + trackBytes.length)
    chunk[0] = 0x4d
    chunk[1] = 0x54
    chunk[2] = 0x72
    chunk[3] = 0x6b // "MTrk"
    chunk[4] = (trackBytes.length >> 24) & 0xff
    chunk[5] = (trackBytes.length >> 16) & 0xff
    chunk[6] = (trackBytes.length >> 8) & 0xff
    chunk[7] = trackBytes.length & 0xff
    for (let i = 0; i < trackBytes.length; i++) chunk[8 + i] = trackBytes[i]
    trackChunks.push(chunk)
  }

  const totalLen = header.length + trackChunks.reduce((s, c) => s + c.length, 0)
  const result = new Uint8Array(totalLen)
  result.set(header, 0)
  let pos = header.length
  for (const chunk of trackChunks) {
    result.set(chunk, pos)
    pos += chunk.length
  }
  return result
}

function buildMidiWithRunningStatus(
  notes: Array<{ pitch: number; startTick: number; endTick: number }>,
  ticksPerBeat = 480,
): Uint8Array {
  const velocity = 80
  const header = new Uint8Array(14)
  header[0] = 0x4d
  header[1] = 0x54
  header[2] = 0x68
  header[3] = 0x64
  header[4] = 0
  header[5] = 0
  header[6] = 0
  header[7] = 6
  header[8] = 0
  header[9] = 0
  header[10] = 0
  header[11] = 1
  header[12] = (ticksPerBeat >> 8) & 0xff
  header[13] = ticksPerBeat & 0xff

  interface AbsEvent {
    tick: number
    type: 'on' | 'off'
    pitch: number
    vel: number
  }
  const absEvents: AbsEvent[] = []
  for (const { pitch, startTick, endTick } of notes) {
    absEvents.push({ tick: startTick, type: 'on', pitch, vel: velocity })
    absEvents.push({ tick: endTick, type: 'off', pitch, vel: 0 })
  }
  absEvents.sort((a, b) => a.tick - b.tick)

  const trackBytes: number[] = []
  let prevTick = 0
  let lastStatus = 0
  for (const ev of absEvents) {
    const delta = ev.tick - prevTick
    for (const b of encodeVLQ(delta)) trackBytes.push(b)
    const status = ev.type === 'on' ? 0x90 : 0x80
    if (status !== lastStatus) {
      trackBytes.push(status, ev.pitch, ev.vel)
      lastStatus = status
    } else {
      // Running status: omit status byte
      trackBytes.push(ev.pitch, ev.vel)
    }
    prevTick = ev.tick
  }
  trackBytes.push(0, 0xff, 0x2f, 0)

  const chunk = new Uint8Array(8 + trackBytes.length)
  chunk[0] = 0x4d
  chunk[1] = 0x54
  chunk[2] = 0x72
  chunk[3] = 0x6b
  chunk[4] = (trackBytes.length >> 24) & 0xff
  chunk[5] = (trackBytes.length >> 16) & 0xff
  chunk[6] = (trackBytes.length >> 8) & 0xff
  chunk[7] = trackBytes.length & 0xff
  for (let i = 0; i < trackBytes.length; i++) chunk[8 + i] = trackBytes[i]

  const midi = new Uint8Array(header.length + chunk.length)
  midi.set(header, 0)
  midi.set(chunk, header.length)
  return midi
}

function buildMidiWithTempo(
  tempo: number,
  notes: Array<{ pitch: number; startTick: number; endTick: number }>,
): Uint8Array {
  // Format 1 MIDI with track 0 = tempo, track 1 = notes
  const tempoTrack: number[] = []
  // Delta 0, tempo meta event 0xFF 0x51 0x03 [usPerBeat]
  tempoTrack.push(0, 0xff, 0x51, 0x03)
  tempoTrack.push((tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff)
  tempoTrack.push(0, 0xff, 0x2f, 0)

  const tempoChunk = new Uint8Array(8 + tempoTrack.length)
  tempoChunk[0] = 0x4d
  tempoChunk[1] = 0x54
  tempoChunk[2] = 0x72
  tempoChunk[3] = 0x6b
  tempoChunk[4] = (tempoTrack.length >> 24) & 0xff
  tempoChunk[5] = (tempoTrack.length >> 16) & 0xff
  tempoChunk[6] = (tempoTrack.length >> 8) & 0xff
  tempoChunk[7] = tempoTrack.length & 0xff
  for (let i = 0; i < tempoTrack.length; i++) tempoChunk[8 + i] = tempoTrack[i]

  const velocity = 80
  const noteTrack: number[] = []
  let prevTick = 0
  for (const { pitch, startTick, endTick } of notes) {
    let delta = startTick - prevTick
    for (const b of encodeVLQ(delta)) noteTrack.push(b)
    noteTrack.push(0x90, pitch, velocity)
    delta = endTick - startTick
    for (const b of encodeVLQ(delta)) noteTrack.push(b)
    noteTrack.push(0x80, pitch, 0)
    prevTick = endTick
  }
  noteTrack.push(0, 0xff, 0x2f, 0)

  const noteChunk = new Uint8Array(8 + noteTrack.length)
  noteChunk[0] = 0x4d
  noteChunk[1] = 0x54
  noteChunk[2] = 0x72
  noteChunk[3] = 0x6b
  noteChunk[4] = (noteTrack.length >> 24) & 0xff
  noteChunk[5] = (noteTrack.length >> 16) & 0xff
  noteChunk[6] = (noteTrack.length >> 8) & 0xff
  noteChunk[7] = noteTrack.length & 0xff
  for (let i = 0; i < noteTrack.length; i++) noteChunk[8 + i] = noteTrack[i]

  const header = new Uint8Array(14)
  header[0] = 0x4d
  header[1] = 0x54
  header[2] = 0x68
  header[3] = 0x64
  header[4] = 0
  header[5] = 0
  header[6] = 0
  header[7] = 6
  header[8] = 0
  header[9] = 1
  header[10] = 0
  header[11] = 2
  header[12] = 0
  header[13] = 96 // 480 TPB

  const midi = new Uint8Array(
    header.length + tempoChunk.length + noteChunk.length,
  )
  midi.set(header, 0)
  midi.set(tempoChunk, header.length)
  midi.set(noteChunk, header.length + tempoChunk.length)
  return midi
}

describe('MIDI Import', () => {
  it('returns null for null/invalid data', () => {
    expect(importMelodyFromMIDI(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(importMelodyFromMIDI(new Uint8Array([]))).toBeNull()
  })

  it('returns null for data too short', () => {
    expect(
      importMelodyFromMIDI(
        new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6]),
      ),
    ).toBeNull()
  })

  it('returns null for format 2 (reserved)', () => {
    const header = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 2, 0, 1, 0, 96,
    ])
    const trackBytes = [0, 0xff, 0x2f, 0]
    const trackChunk = new Uint8Array(8 + trackBytes.length)
    trackChunk[0] = 0x4d
    trackChunk[1] = 0x54
    trackChunk[2] = 0x72
    trackChunk[3] = 0x6b
    trackChunk[4] = 0
    trackChunk[5] = 0
    trackChunk[6] = 0
    trackChunk[7] = trackBytes.length
    for (let i = 0; i < trackBytes.length; i++)
      trackChunk[8 + i] = trackBytes[i]
    const midi = new Uint8Array(header.length + trackChunk.length)
    midi.set(header, 0)
    midi.set(trackChunk, header.length)
    expect(importMelodyFromMIDI(midi)).toBeNull()
  })

  it('returns null when no note pairs found', () => {
    // Build a track with only a tempo meta event (no note events)
    const header = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    ])
    const trackBytes = [
      0, 0xff, 0x03, 3, 0x74, 0x65, 0x73, 0x74, 0, 0xff, 0x2f, 0,
    ]
    const trackChunk = new Uint8Array(8 + trackBytes.length)
    trackChunk[0] = 0x4d
    trackChunk[1] = 0x54
    trackChunk[2] = 0x72
    trackChunk[3] = 0x6b
    trackChunk[4] = 0
    trackChunk[5] = 0
    trackChunk[6] = 0
    trackChunk[7] = trackBytes.length
    for (let i = 0; i < trackBytes.length; i++)
      trackChunk[8 + i] = trackBytes[i]
    const midi = new Uint8Array(header.length + trackChunk.length)
    midi.set(header, 0)
    midi.set(trackChunk, header.length)
    expect(importMelodyFromMIDI(midi)).toBeNull()
  })

  it('parses a single note correctly', () => {
    const midi = buildMidiFile([{ pitch: 60, startTick: 0, endTick: 480 }])
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(1)
    expect(melody![0].note.midi).toBe(60)
    expect(melody![0].note.name).toBe('C')
    expect(melody![0].note.octave).toBe(4)
    expect(melody![0].startBeat).toBeCloseTo(0, 5)
    expect(melody![0].duration).toBeCloseTo(1, 5)
  })

  it('parses multiple notes with correct timing', () => {
    const midi = buildMidiFile([
      { pitch: 60, startTick: 0, endTick: 480 },
      { pitch: 64, startTick: 480, endTick: 960 },
      { pitch: 67, startTick: 960, endTick: 1440 },
    ])
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(3)
    expect(melody![0].note.midi).toBe(60)
    expect(melody![0].startBeat).toBeCloseTo(0, 5)
    expect(melody![1].note.midi).toBe(64)
    expect(melody![1].startBeat).toBeCloseTo(1, 5)
    expect(melody![2].note.midi).toBe(67)
    expect(melody![2].startBeat).toBeCloseTo(2, 5)
  })

  it('handles notes shorter than 1 beat', () => {
    const midi = buildMidiFile([{ pitch: 60, startTick: 0, endTick: 240 }], 480)
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    expect(melody![0].duration).toBeCloseTo(0.5, 5)
  })

  it('handles notes with non-zero velocity', () => {
    // A normal note with velocity 80 (not 0) should be parsed
    const midi = buildMidiFile([
      { pitch: 60, startTick: 0, endTick: 480, velocity: 100 },
    ])
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(1)
    expect(melody![0].note.midi).toBe(60)
  })

  it('handles overlapping notes on different pitches', () => {
    const midi = buildMidiFile([
      { pitch: 60, startTick: 0, endTick: 960 },
      { pitch: 64, startTick: 0, endTick: 960 },
    ])
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(2)
  })

  it('round-trips through export format (notes have correct structure)', () => {
    const midi = buildMidiFile([
      { pitch: 69, startTick: 0, endTick: 480 },
      { pitch: 72, startTick: 480, endTick: 960 },
      { pitch: 67, startTick: 960, endTick: 1440 },
    ])
    const melody = importMelodyFromMIDI(midi)

    expect(melody).not.toBeNull()
    for (const item of melody!) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('note')
      expect(item.note).toHaveProperty('name')
      expect(item.note).toHaveProperty('octave')
      expect(item.note).toHaveProperty('midi')
      expect(item.note).toHaveProperty('freq')
      expect(item).toHaveProperty('startBeat')
      expect(item).toHaveProperty('duration')
    }
  })

  it('parses format 1 multi-track MIDI', () => {
    const midi = buildMidiFormat1([
      // Track 0: notes
      [
        { tick: 0, type: 'on', pitch: 60, vel: 80 },
        { tick: 480, type: 'off', pitch: 60, vel: 0 },
        { tick: 480, type: 'on', pitch: 64, vel: 80 },
        { tick: 960, type: 'off', pitch: 64, vel: 0 },
      ],
    ])
    const melody = importMelodyFromMIDI(midi)
    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(2)
    expect(melody![0].note.midi).toBe(60)
    expect(melody![1].note.midi).toBe(64)
  })

  it('parses MIDI with notes in a separate track (format 1)', () => {
    // Format 1 with tempo track (empty notes) + note track
    const midi = buildMidiFormat1([
      [], // tempo track — empty (no notes)
      [
        { tick: 0, type: 'on', pitch: 60, vel: 80 },
        { tick: 480, type: 'off', pitch: 60, vel: 0 },
        { tick: 480, type: 'on', pitch: 67, vel: 80 },
        { tick: 960, type: 'off', pitch: 67, vel: 0 },
      ],
    ])
    const melody = importMelodyFromMIDI(midi)
    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(2)
  })

  it('handles running status (status byte omitted for same-channel events)', () => {
    const midi = buildMidiWithRunningStatus([
      { pitch: 60, startTick: 0, endTick: 480 },
      { pitch: 64, startTick: 480, endTick: 960 },
      { pitch: 67, startTick: 960, endTick: 1440 },
    ])
    const melody = importMelodyFromMIDI(midi)
    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(3)
    expect(melody![0].note.midi).toBe(60)
    expect(melody![1].note.midi).toBe(64)
    expect(melody![2].note.midi).toBe(67)
  })

  it('handles format 1 with tempo track followed by note track', () => {
    const midi = buildMidiWithTempo(500000, [
      { pitch: 60, startTick: 0, endTick: 480 },
      { pitch: 64, startTick: 480, endTick: 960 },
    ])
    const melody = importMelodyFromMIDI(midi)
    expect(melody).not.toBeNull()
    expect(melody!.length).toBe(2)
    expect(melody![0].note.midi).toBe(60)
    expect(melody![1].note.midi).toBe(64)
  })
})
