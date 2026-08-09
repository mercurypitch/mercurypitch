// ============================================================
// PianoProject SMF parser tests — expressive round-trip and hard bounds
// ============================================================

import { describe, expect, it } from 'vitest'
import { parseMidiProject, PIANO_PROJECT_PARSE_LIMITS, PianoProjectParseError, } from './parse-midi-project'
import { validatePianoProject } from './piano-project'
import { projectToMidiSong } from './project-to-midi-song'

const IDENTITY = {
  id: 'piano-project-fixture',
  name: 'Nocturne fixture',
  fileName: 'nocturne.mid',
  sha256: 'a'.repeat(64),
  importedAt: '2026-08-09T12:00:00.000Z',
}

function ascii(value: string): number[] {
  return [...value].map((character) => character.charCodeAt(0))
}

function uint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff]
}

function uint32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]
}

function vlq(value: number): number[] {
  const bytes = [value & 0x7f]
  for (let remaining = Math.floor(value / 0x80); remaining > 0; ) {
    bytes.unshift((remaining & 0x7f) | 0x80)
    remaining = Math.floor(remaining / 0x80)
  }
  return bytes
}

function meta(delta: number, type: number, data: number[]): number[] {
  return [...vlq(delta), 0xff, type, ...vlq(data.length), ...data]
}

function channel(delta: number, status: number, ...data: number[]): number[] {
  return [...vlq(delta), status, ...data]
}

function sysEx(delta: number, data: number[]): number[] {
  return [...vlq(delta), 0xf0, ...vlq(data.length), ...data]
}

function track(...events: number[][]): Uint8Array {
  const body = events.flat()
  return new Uint8Array([...ascii('MTrk'), ...uint32(body.length), ...body])
}

function smf(
  format: number,
  division: number,
  tracks: readonly Uint8Array[],
  declaredTracks = tracks.length,
): Uint8Array {
  return new Uint8Array([
    ...ascii('MThd'),
    ...uint32(6),
    ...uint16(format),
    ...uint16(declaredTracks),
    ...uint16(division),
    ...tracks.flatMap((value) => [...value]),
  ])
}

function expressiveFixture(): Uint8Array {
  const conductor = track(
    meta(0, 0x03, ascii('Conductor')),
    meta(0, 0x51, [0x07, 0xa1, 0x20]),
    meta(0, 0x58, [4, 2, 24, 8]),
    meta(0, 0x59, [0xff, 1]),
    meta(0, 0x09, [1, 2, 3]),
    sysEx(0, [0x7d, 1, 2]),
    meta(480, 0x58, [3, 2, 24, 8]),
    meta(0, 0x59, [2, 0]),
    meta(480, 0x51, [0x09, 0x27, 0xc0]),
    meta(0, 0x2f, []),
  )
  const music = track(
    meta(0, 0x03, ascii('Piano ensemble')),
    meta(0, 0x04, ascii('Concert Grand')),
    channel(0, 0xc0, 0),
    channel(0, 0xb0, 64, 127),
    channel(0, 0xa0, 60, 55),
    channel(0, 0xd0, 33),
    channel(0, 0xe0, 0, 96),
    channel(0, 0xe0, 0, 32),
    channel(0, 0x90, 60, 90),
    // Running status: a second note-on for the same pitch.
    [...vlq(120), 60, 80],
    channel(120, 0x80, 60, 40),
    channel(120, 0x90, 60, 0),
    channel(0, 0xc0, 40),
    channel(0, 0xc1, 48),
    channel(0, 0x91, 48, 70),
    channel(480, 0x81, 48, 12),
    channel(0, 0x99, 36, 100),
    channel(120, 0x89, 36, 20),
    meta(0, 0x2f, []),
  )
  return smf(1, 480, [conductor, music])
}

function parseErrorCode(data: Uint8Array): string {
  try {
    parseMidiProject(data, IDENTITY)
  } catch (error) {
    expect(error).toBeInstanceOf(PianoProjectParseError)
    return (error as PianoProjectParseError).code
  }
  throw new Error('Expected the MIDI fixture to be rejected.')
}

describe('parseMidiProject', () => {
  it('preserves expressive source events and derives stable playable lanes', () => {
    const project = parseMidiProject(expressiveFixture(), IDENTITY)

    expect(validatePianoProject(project)).toBe(project)
    expect(project.source).toMatchObject({
      kind: 'midi',
      format: 1,
      ticksPerQuarter: 480,
    })
    expect(
      project.tempoMap.map((event) => event.microsecondsPerQuarter),
    ).toEqual([500_000, 600_000])
    expect(project.timeSignatures.map((event) => event.numerator)).toEqual([
      4, 3,
    ])
    expect(
      project.keySignatures.map(({ sharpsFlats, mode }) => ({
        sharpsFlats,
        mode,
      })),
    ).toEqual([
      { sharpsFlats: -1, mode: 1 },
      { sharpsFlats: 2, mode: 0 },
    ])
    expect(project.tracks.map((value) => value.id)).toEqual([
      'smf-t1-c0',
      'smf-t1-c1',
      'smf-t1-c9',
    ])
    expect(project.scoreTrackId).toBe('smf-t1-c0')
    expect(project.backingTrackIds).toEqual(['smf-t1-c1'])
    expect(project.tracks[2].isPercussion).toBe(true)

    const pianoEvents = project.tracks[0].events
    expect(
      pianoEvents.filter((event) => event.type === 'program-change'),
    ).toEqual([
      expect.objectContaining({ program: 0 }),
      expect.objectContaining({ program: 40 }),
    ])
    expect(pianoEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'control-change',
          controller: 64,
          value: 127,
        }),
        expect.objectContaining({ type: 'poly-aftertouch', pressure: 55 }),
        expect.objectContaining({ type: 'channel-pressure', pressure: 33 }),
        expect.objectContaining({ type: 'pitch-bend', value: 4096 }),
        expect.objectContaining({ type: 'pitch-bend', value: -4096 }),
        expect.objectContaining({
          type: 'note-off',
          velocity: 0,
          encodedAsNoteOn: true,
        }),
      ]),
    )
    expect(project.metaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unknown-meta', metaType: 0x09 }),
        expect.objectContaining({
          type: 'text',
          kind: 'instrument-name',
          text: 'Concert Grand',
        }),
      ]),
    )
    expect(project.systemEvents[0]).toMatchObject({
      type: 'sys-ex',
      data: new Uint8Array([0x7d, 1, 2]),
    })
  })

  it('projects overlapping same-pitch notes FIFO while retaining dynamics', () => {
    const song = projectToMidiSong(
      parseMidiProject(expressiveFixture(), IDENTITY),
    )

    expect(song.bpm).toBe(120)
    expect(song.tracks.map((value) => value.id)).toEqual([
      'smf-t1-c0',
      'smf-t1-c1',
    ])
    expect(song.scoreTrackId).toBe('smf-t1-c0')
    expect(song.backingTrackIds).toEqual(['smf-t1-c1'])
    expect(song.tracks[0].notes).toEqual([
      {
        midi: 60,
        startBeat: 0,
        duration: 0.5,
        velocity: 90,
        releaseVelocity: 40,
      },
      {
        midi: 60,
        startBeat: 0.25,
        duration: 0.5,
        velocity: 80,
        releaseVelocity: 0,
      },
    ])
  })

  it('rejects unsupported structures and bounded-resource violations', () => {
    expect(parseErrorCode(smf(2, 480, [], 1))).toBe('UNSUPPORTED_FORMAT')
    expect(parseErrorCode(smf(1, 0xe728, [], 1))).toBe(
      'UNSUPPORTED_TIME_DIVISION',
    )
    expect(parseErrorCode(smf(1, 480, [], 257))).toBe('TOO_MANY_TRACKS')

    const invalidVlq = track([0x81, 0x81, 0x81, 0x81, 0x00])
    expect(parseErrorCode(smf(0, 480, [invalidVlq]))).toBe('INVALID_VLQ')

    const truncated = expressiveFixture().slice(0, -1)
    expect(parseErrorCode(truncated)).toBe('INVALID_CHUNK')

    const oversizedPayload = new Array(
      PIANO_PROJECT_PARSE_LIMITS.maxEventPayloadBytes + 1,
    ).fill(0)
    const oversizedMeta = track(
      meta(0, 0x01, oversizedPayload),
      meta(0, 0x2f, []),
    )
    expect(parseErrorCode(smf(0, 480, [oversizedMeta]))).toBe(
      'EVENT_PAYLOAD_TOO_LARGE',
    )
  })
})
