// ============================================================
// MIDI Song Parser Tests — multi-track import
// ============================================================

import { describe, expect, it } from 'vitest'
import { createBeatClock, createSecondsToBeatClock, defaultScoreTrack, gmInstrumentName, isPercussionMidiSongTrack, normalizeMidiSong, parseMidiSong, } from '@/lib/midi-song'

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

function timeSignature(
  numerator: number,
  denominator: number,
  delta = 0,
): number[] {
  // Denominator is stored as its power of two: 8 is written as 3.
  return [
    ...varLen(delta),
    0xff,
    0x58,
    0x04,
    numerator,
    Math.log2(denominator),
    24,
    8,
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
    expect(notes[0]).toEqual({
      midi: 60,
      startBeat: 0,
      duration: 1,
      velocity: 100,
    })
    expect(notes[1]).toEqual({
      midi: 64,
      startBeat: 2,
      duration: 1,
      velocity: 100,
    })
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
    expect(song!.tracks[0]).toMatchObject({
      sourceProgram: 30,
      instrumentFamily: 'electric-guitar',
    })
    expect(song!.tracks[0].noteCount).toBe(1)
    expect(song!.tracks[1].name).toBe('Bass')
    expect(song!.tracks[1].instrumentName).toBe('Fingered Bass')
    expect(song!.tracks[1]).toMatchObject({
      sourceProgram: 33,
      instrumentFamily: 'bass',
    })
    expect(song!.tracks[1].noteCount).toBe(2)
  })

  it('keeps channel-10 hits separate from pitched notes', () => {
    const data = buildMidi(
      [...quarterNote(0, 60, 0)],
      [...quarterNote(9, 36, 0)], // kick drum on channel 10
    )
    const song = parseMidiSong(data)
    expect(song!.tracks).toHaveLength(2)
    const pitched = song!.tracks.find((track) => track.kind !== 'percussion')
    const drums = song!.tracks.find(isPercussionMidiSongTrack)
    expect(pitched?.notes[0].midi).toBe(60)
    expect(drums?.notes).toEqual([])
    expect(drums?.percussionHits).toEqual([
      expect.objectContaining({
        gmKey: 36,
        startBeat: 0,
        velocity: 100,
        source: expect.objectContaining({ channel: 9, midiKey: 36 }),
      }),
    ])
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

describe('time signatures', () => {
  it('reads the signature the file wrote', () => {
    const song = parseMidiSong(
      buildMidi([...timeSignature(3, 4), ...quarterNote(0, 60, 0)]),
    )
    expect(song?.timeSignatures).toEqual([
      { beat: 0, numerator: 3, denominator: 4 },
    ])
  })

  it('reads a compound signature with its written denominator', () => {
    const song = parseMidiSong(
      buildMidi([...timeSignature(6, 8), ...quarterNote(0, 60, 0)]),
    )
    expect(song?.timeSignatures).toEqual([
      { beat: 0, numerator: 6, denominator: 8 },
    ])
  })

  it('places a later signature on the beat it takes effect', () => {
    const song = parseMidiSong(
      buildMidi([
        ...timeSignature(4, 4),
        ...quarterNote(0, 60, 0),
        ...timeSignature(7, 8, 480 * 7),
      ]),
    )
    expect(song?.timeSignatures).toEqual([
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 8, numerator: 7, denominator: 8 },
    ])
  })

  it('records an empty list when the file wrote none', () => {
    const song = parseMidiSong(buildMidi([...quarterNote(0, 60, 0)]))
    expect(song?.timeSignatures).toEqual([])
  })
})

describe('files that will not open', () => {
  // The compact scanner this parser replaced kept whatever it had read before
  // a file went wrong and returned a song with silently wrong timing. These
  // record the stricter answer, so the change is visible rather than assumed.

  it('refuses a file whose track is shorter than it claims', () => {
    const whole = [...buildMidi([...quarterNote(0, 60, 0)])]
    expect(
      parseMidiSong(new Uint8Array(whole.slice(0, whole.length - 4))),
    ).toBe(null)
  })

  it('refuses a file with bytes after its last track', () => {
    const whole = [...buildMidi([...quarterNote(0, 60, 0)])]
    expect(parseMidiSong(new Uint8Array([...whole, 0x00, 0x00]))).toBe(null)
  })

  it('refuses an SMPTE time division it cannot count beats in', () => {
    const bytes = [...buildMidi([...quarterNote(0, 60, 0)])]
    bytes[12] = 0xe8 // negative frames-per-second marks SMPTE
    bytes[13] = 0x50
    expect(parseMidiSong(new Uint8Array(bytes))).toBe(null)
  })

  it('refuses a format 2 file', () => {
    const bytes = [...buildMidi([...quarterNote(0, 60, 0)])]
    bytes[9] = 2
    expect(parseMidiSong(new Uint8Array(bytes))).toBe(null)
  })
})

describe('gmInstrumentName', () => {
  it('names a General MIDI program', () => {
    expect(gmInstrumentName(25)).toBe('Steel Guitar')
  })

  it('says which program it was when the number names nothing', () => {
    expect(gmInstrumentName(200)).toBe('Program 200')
  })
})

describe('normalizeMidiSong', () => {
  it('upgrades legacy pitch tracks and drops malformed percussion rows explicitly', () => {
    const normalized = normalizeMidiSong({
      bpm: 120,
      tracks: [
        {
          id: 'legacy-guitar',
          name: 'Guitar',
          instrumentName: 'Steel Guitar',
          noteCount: 2,
          notes: [
            { midi: 64, startBeat: 0, duration: 1, velocity: 94 },
            { midi: 67, startBeat: 1, duration: 1, velocity: 0 },
          ],
        },
        {
          id: 'drums',
          kind: 'percussion',
          name: 'Drums',
          instrumentName: 'General MIDI Drum Kit',
          noteCount: 4,
          notes: [],
          percussionHits: [
            { gmKey: 38, startBeat: 0, velocity: 96 },
            { gmKey: 34, startBeat: 1, velocity: 80 },
            { gmKey: 42, startBeat: 2, velocity: 0 },
            { gmKey: 36, startBeat: -1, velocity: 90 },
          ],
          droppedHitCount: 2,
        },
      ],
    })

    expect(normalized.tracks[0]).toMatchObject({
      kind: 'pitched',
      instrumentFamily: 'acoustic-guitar',
      notes: [
        { midi: 64, startBeat: 0, duration: 1, velocity: 94 },
        { midi: 67, startBeat: 1, duration: 1 },
      ],
    })
    const drums = normalized.tracks.find(isPercussionMidiSongTrack)
    expect(drums).toMatchObject({
      notes: [],
      noteCount: 1,
      percussionHits: [{ gmKey: 38, startBeat: 0, velocity: 96 }],
      droppedHitCount: 5,
    })
  })

  it('lets a retained GM program override misleading legacy labels', () => {
    const normalized = normalizeMidiSong({
      bpm: 120,
      tracks: [
        {
          id: 'strings-called-guitar',
          name: 'Lead guitar',
          instrumentName: 'Electric Guitar',
          sourceProgram: 48,
          instrumentFamily: 'electric-guitar',
          noteCount: 1,
          notes: [{ midi: 64, startBeat: 0, duration: 1 }],
        },
      ],
    })

    expect(normalized.tracks[0]).toMatchObject({
      sourceProgram: 48,
      instrumentFamily: 'neutral',
    })
  })
})

describe('defaultScoreTrack', () => {
  it('picks the track with the most notes', () => {
    const data = buildMidi(
      [...quarterNote(0, 60, 0)],
      [...quarterNote(1, 40, 0), ...quarterNote(1, 43, 0)],
    )
    const song = parseMidiSong(data)!
    expect(defaultScoreTrack(song)?.id).toBe(song.tracks[1].id)
  })

  it('never picks a denser percussion track for pitch scoring', () => {
    const song = parseMidiSong(
      buildMidi(
        [...quarterNote(0, 60, 0)],
        [
          ...quarterNote(9, 36, 0),
          ...quarterNote(9, 38, 0),
          ...quarterNote(9, 42, 0),
        ],
      ),
    )!

    expect(defaultScoreTrack(song)?.kind).toBe('pitched')
    expect(defaultScoreTrack(song)?.notes[0].midi).toBe(60)
  })

  it('answers null for a percussion-only song', () => {
    const song = parseMidiSong(buildMidi([...quarterNote(9, 36, 0)]))!
    expect(defaultScoreTrack(song)).toBeNull()
  })
})

// ── Tempo map ──────────────────────────────────────────────────

/** A set-tempo event at an arbitrary delta, so a map can have more than one. */
function setTempoAt(delta: number, usPerBeat: number): number[] {
  return [
    ...varLen(delta),
    0xff,
    0x51,
    0x03,
    (usPerBeat >> 16) & 0xff,
    (usPerBeat >> 8) & 0xff,
    usPerBeat & 0xff,
  ]
}

describe('tempo map', () => {
  /** 120 bpm for four beats, then 240 bpm for four more. */
  function twoTempoSong() {
    const data = buildMidi([
      ...setTempo(500000),
      ...quarterNote(0, 60, 0),
      ...quarterNote(0, 62, 0),
      ...quarterNote(0, 64, 0),
      ...quarterNote(0, 65, 0),
      ...setTempoAt(0, 250000),
      ...quarterNote(0, 67, 0),
      ...quarterNote(0, 69, 0),
    ])
    return parseMidiSong(data)!
  }

  it('keeps every tempo change, not only the first', () => {
    const song = twoTempoSong()
    expect(song.bpm).toBe(120)
    expect(song.tempoChanges).toEqual([
      { beat: 0, usPerBeat: 500000 },
      { beat: 4, usPerBeat: 250000 },
    ])
  })

  it('converts beats through the whole map', () => {
    const clock = createBeatClock(twoTempoSong())
    expect(clock(0)).toBeCloseTo(0, 6)
    expect(clock(2)).toBeCloseTo(1, 6)
    // The change lands here: four beats at half a second each.
    expect(clock(4)).toBeCloseTo(2, 6)
    // Four more at a quarter second each — three seconds, not four.
    expect(clock(8)).toBeCloseTo(3, 6)
  })

  it('converts elapsed seconds back through the whole map', () => {
    const clock = createSecondsToBeatClock(twoTempoSong())
    expect(clock(0)).toBeCloseTo(0, 6)
    expect(clock(1)).toBeCloseTo(2, 6)
    expect(clock(2)).toBeCloseTo(4, 6)
    expect(clock(3)).toBeCloseTo(8, 6)
  })

  it('runs at the song tempo when no map was recorded', () => {
    // What a Guitar Pro import or a song saved before the field looks like.
    const clock = createBeatClock({ bpm: 60, tracks: [] })
    expect(clock(4)).toBeCloseTo(4, 6)
  })

  it('holds the opening tempo until the first change that is not at zero', () => {
    const clock = createBeatClock({
      bpm: 120,
      tempoChanges: [{ beat: 4, usPerBeat: 250000 }],
      tracks: [],
    })
    expect(clock(4)).toBeCloseTo(2, 6)
    expect(clock(8)).toBeCloseTo(3, 6)
  })

  it('keeps the SMF default tempo before a parsed delayed first event', () => {
    const song = parseMidiSong(
      buildMidi([...setTempoAt(4 * 480, 250000), ...quarterNote(0, 60, 0)]),
    )

    expect(song?.bpm).toBe(120)
    expect(song?.tempoChanges).toEqual([{ beat: 4, usPerBeat: 250000 }])
    const clock = createBeatClock(song!)
    expect(clock(4)).toBeCloseTo(2, 6)
    expect(clock(8)).toBeCloseTo(3, 6)
  })

  it('does not depend on the order the changes were found in', () => {
    const clock = createBeatClock({
      bpm: 120,
      tempoChanges: [
        { beat: 4, usPerBeat: 250000 },
        { beat: 0, usPerBeat: 500000 },
      ],
      tracks: [],
    })
    expect(clock(8)).toBeCloseTo(3, 6)
  })
})
