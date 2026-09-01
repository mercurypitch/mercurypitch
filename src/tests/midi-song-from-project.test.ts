// ============================================================
// MidiSong from a PianoProject — the projection, on its own
// ============================================================
//
// `midi-song.test.ts` covers the parser through its public door. These reach
// the corners of the projection that a well-formed file does not visit.

import { describe, expect, it, vi } from 'vitest'
import type * as ParseMidiProject from '@/features/piano-project/parse-midi-project'
import { gmInstrumentName, isPercussionMidiSongTrack } from '@/lib/midi-song'
import { parseMidiSongViaProject } from '@/lib/midi-song-from-project'

// ── Binary MIDI builders ───────────────────────────────────────

function varLen(value: number): number[] {
  if (value < 0x80) return [value]
  return [0x80 | (value >> 7), value & 0x7f]
}

function trackChunk(events: number[]): number[] {
  const body = [...events, 0x00, 0xff, 0x2f, 0x00]
  return [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (body.length >> 24) & 0xff,
    (body.length >> 16) & 0xff,
    (body.length >> 8) & 0xff,
    body.length & 0xff,
    ...body,
  ]
}

function buildMidi(...tracks: number[][]): Uint8Array {
  return new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    1,
    0,
    tracks.length,
    (480 >> 8) & 0xff,
    480 & 0xff,
    ...tracks.flatMap(trackChunk),
  ])
}

const noteOn = (
  midi: number,
  delta = 0,
  channel = 0,
  velocity = 100,
): number[] => [...varLen(delta), 0x90 | channel, midi, velocity]

const noteOff = (midi: number, delta: number, channel = 0): number[] => [
  ...varLen(delta),
  0x80 | channel,
  midi,
  0,
]

const parse = (data: Uint8Array) =>
  parseMidiSongViaProject(data, gmInstrumentName)

// ── Tests ──────────────────────────────────────────────────────

describe('parseMidiSongViaProject', () => {
  it('ignores a note-off for a pitch that was never struck', () => {
    const song = parse(
      buildMidi([...noteOff(64, 0), ...noteOn(60, 0), ...noteOff(60, 480)]),
    )
    expect(song?.tracks[0].notes.map((note) => note.midi)).toEqual([60])
  })

  it('restarts a pitch struck again before it was released', () => {
    const song = parse(
      buildMidi([
        ...noteOn(60, 0, 0, 55),
        ...noteOn(60, 480, 0, 113),
        ...noteOff(60, 480),
      ]),
    )
    expect(song?.tracks[0].notes).toEqual([
      { midi: 60, startBeat: 1, duration: 1, velocity: 113 },
    ])
  })

  it('leaves out a track that sounded nothing', () => {
    const song = parse(
      buildMidi(
        [0x00, 0xc0, 25], // a program change and no notes at all
        [...noteOn(60, 0), ...noteOff(60, 480)],
      ),
    )
    expect(song?.tracks.map((track) => track.id)).toEqual(['t1c0'])
  })

  it('gives a nameless track without a program a numbered name', () => {
    const song = parse(buildMidi([...noteOn(60, 0), ...noteOff(60, 480)]))
    expect(song?.tracks[0]).toMatchObject({
      name: 'Track 1',
      instrumentName: 'Unknown Instrument',
      instrumentFamily: 'neutral',
    })
    expect(song?.tracks[0].sourceProgram).toBeUndefined()
  })

  it('names a nameless track after its instrument when it has one', () => {
    const song = parse(
      buildMidi([0x00, 0xc0, 25, ...noteOn(60, 0), ...noteOff(60, 480)]),
    )
    expect(song?.tracks[0]).toMatchObject({
      name: 'Steel Guitar',
      instrumentName: 'Steel Guitar',
      sourceProgram: 25,
      instrumentFamily: 'acoustic-guitar',
    })
  })

  it('retains explicit GM programs and classifies only guitar and bass ranges', () => {
    const song = parse(
      buildMidi(
        [0x00, 0xc0, 30, ...noteOn(60), ...noteOff(60, 480)],
        [0x00, 0xc0, 33, ...noteOn(40), ...noteOff(40, 480)],
        [0x00, 0xc0, 48, ...noteOn(64), ...noteOff(64, 480)],
        [0x00, 0xc0, 52, ...noteOn(67), ...noteOff(67, 480)],
        [0x00, 0xc0, 80, ...noteOn(72), ...noteOff(72, 480)],
      ),
    )

    expect(
      song?.tracks.map((track) => ({
        sourceProgram: track.sourceProgram,
        instrumentFamily: track.instrumentFamily,
      })),
    ).toEqual([
      { sourceProgram: 30, instrumentFamily: 'electric-guitar' },
      { sourceProgram: 33, instrumentFamily: 'bass' },
      { sourceProgram: 48, instrumentFamily: 'neutral' },
      { sourceProgram: 52, instrumentFamily: 'neutral' },
      { sourceProgram: 80, instrumentFamily: 'neutral' },
    ])
  })

  it('treats an empty track name as no name at all', () => {
    const song = parse(
      buildMidi([
        0x00,
        0xff,
        0x03,
        0x00, // a track-name meta carrying nothing
        ...noteOn(60, 0),
        ...noteOff(60, 480),
      ]),
    )
    expect(song?.tracks[0].name).toBe('Track 1')
  })

  it('gives a note held to the end of the file no length at all, not a stuck one', () => {
    // Unclosed note-on: nothing pairs it, so it never becomes a note.
    const song = parse(
      buildMidi([...noteOn(60, 0), ...noteOff(60, 480), ...noteOn(67, 480)]),
    )
    expect(song?.tracks[0].notes.map((note) => note.midi)).toEqual([60])
  })

  it('floors a note too short to read', () => {
    const song = parse(buildMidi([...noteOn(60, 0), ...noteOff(60, 1)]))
    expect(song?.tracks[0].notes[0].duration).toBe(0.25)
  })

  it('keeps a percussion-only file as one-shot hits with velocity', () => {
    const song = parse(
      buildMidi([
        ...noteOn(38, 0, 9, 73),
        ...noteOff(38, 480, 9),
        // A one-shot remains valid without a matching note-off.
        ...noteOn(42, 240, 9, 41),
      ]),
    )
    const track = song?.tracks.find(isPercussionMidiSongTrack)

    expect(song).not.toBeNull()
    expect(track).toMatchObject({
      kind: 'percussion',
      noteCount: 2,
      notes: [],
      droppedHitCount: 0,
    })
    expect(track?.percussionHits).toEqual([
      expect.objectContaining({ gmKey: 38, startBeat: 0, velocity: 73 }),
      expect.objectContaining({ gmKey: 42, startBeat: 1.5, velocity: 41 }),
    ])
  })

  it('reports channel-10 keys it cannot map instead of inventing a snare', () => {
    const song = parse(
      buildMidi([...noteOn(32, 0, 9, 90), ...noteOn(91, 0, 9, 90)]),
    )
    const track = song?.tracks.find(isPercussionMidiSongTrack)

    expect(track).toMatchObject({
      noteCount: 0,
      percussionHits: [],
      droppedHitCount: 2,
    })
  })

  it('lets a failure that is not a parse error through', async () => {
    vi.resetModules()
    vi.doMock('@/features/piano-project/parse-midi-project', async () => {
      const actual = await vi.importActual<typeof ParseMidiProject>(
        '@/features/piano-project/parse-midi-project',
      )
      return {
        ...actual,
        parseMidiProject: () => {
          throw new RangeError('out of memory')
        },
      }
    })
    const { parseMidiSongViaProject: mocked } =
      await import('@/lib/midi-song-from-project')
    expect(() =>
      mocked(buildMidi([...noteOn(60, 0)]), gmInstrumentName),
    ).toThrow(RangeError)
    vi.doUnmock('@/features/piano-project/parse-midi-project')
    vi.resetModules()
  })
})
