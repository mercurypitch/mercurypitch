// ============================================================
// PianoProject SMF parser — strict, bounded Format 0/1 PPQ import
// ============================================================
//
// The parser is pure and performs every allocation only after validating its
// declared length. It keeps source event coordinates while projecting channel
// events into stable source-track/channel lanes; no audio or browser capability
// is touched here.

import type { PianoProject, PianoProjectChannelEvent, PianoProjectIdentity, PianoProjectKeySignatureEvent, PianoProjectMetaEvent, PianoProjectSystemEvent, PianoProjectTempoEvent, PianoProjectTextKind, PianoProjectTimeSignatureEvent, PianoProjectTrack, } from './piano-project'
import { PIANO_PROJECT_SCHEMA_VERSION } from './piano-project'

export const PIANO_PROJECT_PARSE_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  maxTracks: 256,
  maxEvents: 500_000,
  maxEventPayloadBytes: 64 * 1024,
  maxAggregatePayloadBytes: 1024 * 1024,
  maxVlqBytes: 4,
  maxTick: 0x7fffffff,
} as const

export type PianoProjectParseErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_HEADER'
  | 'UNSUPPORTED_FORMAT'
  | 'UNSUPPORTED_TIME_DIVISION'
  | 'TOO_MANY_TRACKS'
  | 'TOO_MANY_EVENTS'
  | 'EVENT_PAYLOAD_TOO_LARGE'
  | 'AGGREGATE_PAYLOAD_TOO_LARGE'
  | 'INVALID_CHUNK'
  | 'INVALID_EVENT'
  | 'INVALID_VLQ'
  | 'TICK_LIMIT_EXCEEDED'

export class PianoProjectParseError extends Error {
  readonly name = 'PianoProjectParseError'

  constructor(
    readonly code: PianoProjectParseErrorCode,
    message: string,
    readonly offset: number | null = null,
  ) {
    super(message)
  }
}

class MidiCursor {
  position: number

  constructor(
    private readonly data: Uint8Array,
    start = 0,
    readonly end = data.length,
  ) {
    this.position = start
  }

  get remaining(): number {
    return this.end - this.position
  }

  get done(): boolean {
    return this.position >= this.end
  }

  ensure(length: number, context: string): void {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      this.position + length > this.end
    ) {
      throw new PianoProjectParseError(
        'INVALID_CHUNK',
        `Truncated MIDI data while reading ${context}.`,
        this.position,
      )
    }
  }

  peekUint8(): number {
    this.ensure(1, 'event status')
    return this.data[this.position]
  }

  readUint8(context = 'byte'): number {
    this.ensure(1, context)
    return this.data[this.position++]
  }

  readUint16(context = '16-bit value'): number {
    this.ensure(2, context)
    const value =
      this.data[this.position] * 0x100 + this.data[this.position + 1]
    this.position += 2
    return value
  }

  readUint24(context = '24-bit value'): number {
    this.ensure(3, context)
    const value =
      this.data[this.position] * 0x10000 +
      this.data[this.position + 1] * 0x100 +
      this.data[this.position + 2]
    this.position += 3
    return value
  }

  readUint32(context = '32-bit value'): number {
    this.ensure(4, context)
    const value =
      this.data[this.position] * 0x1000000 +
      this.data[this.position + 1] * 0x10000 +
      this.data[this.position + 2] * 0x100 +
      this.data[this.position + 3]
    this.position += 4
    return value
  }

  readBytes(length: number, context: string): Uint8Array {
    this.ensure(length, context)
    const bytes = this.data.slice(this.position, this.position + length)
    this.position += length
    return bytes
  }

  readAscii(length: number, context: string): string {
    const bytes = this.readBytes(length, context)
    let result = ''
    for (const byte of bytes) result += String.fromCharCode(byte)
    return result
  }

  readVlq(): number {
    let value = 0
    for (
      let index = 0;
      index < PIANO_PROJECT_PARSE_LIMITS.maxVlqBytes;
      index++
    ) {
      const byte = this.readUint8('variable-length quantity')
      value = value * 0x80 + (byte & 0x7f)
      if ((byte & 0x80) === 0) return value
    }
    throw new PianoProjectParseError(
      'INVALID_VLQ',
      'MIDI variable-length quantities may contain at most four bytes.',
      this.position,
    )
  }
}

interface ParseState {
  eventCount: number
  aggregatePayloadBytes: number
  durationTicks: number
  tempoMap: PianoProjectTempoEvent[]
  timeSignatures: PianoProjectTimeSignatureEvent[]
  keySignatures: PianoProjectKeySignatureEvent[]
  metaEvents: PianoProjectMetaEvent[]
  systemEvents: PianoProjectSystemEvent[]
}

interface SourceTrackState {
  name: string | null
  instrumentName: string | null
  channels: Map<number, PianoProjectChannelEvent[]>
}

function parseError(
  code: PianoProjectParseErrorCode,
  message: string,
  cursor: MidiCursor,
): never {
  throw new PianoProjectParseError(code, message, cursor.position)
}

function countEvent(state: ParseState, cursor: MidiCursor): void {
  state.eventCount += 1
  if (state.eventCount > PIANO_PROJECT_PARSE_LIMITS.maxEvents) {
    parseError(
      'TOO_MANY_EVENTS',
      `MIDI files may contain at most ${PIANO_PROJECT_PARSE_LIMITS.maxEvents.toLocaleString()} events.`,
      cursor,
    )
  }
}

function reservePayload(
  state: ParseState,
  length: number,
  cursor: MidiCursor,
): void {
  if (length > PIANO_PROJECT_PARSE_LIMITS.maxEventPayloadBytes) {
    parseError(
      'EVENT_PAYLOAD_TOO_LARGE',
      `A MIDI text, SysEx, or opaque meta payload may contain at most ${PIANO_PROJECT_PARSE_LIMITS.maxEventPayloadBytes.toLocaleString()} bytes.`,
      cursor,
    )
  }
  state.aggregatePayloadBytes += length
  if (
    state.aggregatePayloadBytes >
    PIANO_PROJECT_PARSE_LIMITS.maxAggregatePayloadBytes
  ) {
    parseError(
      'AGGREGATE_PAYLOAD_TOO_LARGE',
      `MIDI text, SysEx, and opaque meta payloads may total at most ${PIANO_PROJECT_PARSE_LIMITS.maxAggregatePayloadBytes.toLocaleString()} bytes.`,
      cursor,
    )
  }
}

function decodeMidiText(bytes: Uint8Array): string {
  let result = ''
  for (const byte of bytes) result += String.fromCharCode(byte)
  return result
}

function readDataByte(cursor: MidiCursor, context: string): number {
  const value = cursor.readUint8(context)
  if (value > 0x7f) {
    parseError(
      'INVALID_EVENT',
      `${context} must be a 7-bit MIDI value.`,
      cursor,
    )
  }
  return value
}

function checkedTick(
  current: number,
  delta: number,
  cursor: MidiCursor,
): number {
  const tick = current + delta
  if (
    !Number.isSafeInteger(tick) ||
    tick > PIANO_PROJECT_PARSE_LIMITS.maxTick
  ) {
    parseError(
      'TICK_LIMIT_EXCEEDED',
      `MIDI absolute ticks may not exceed ${PIANO_PROJECT_PARSE_LIMITS.maxTick}.`,
      cursor,
    )
  }
  return tick
}

function channelEventsFor(
  source: SourceTrackState,
  channel: number,
): PianoProjectChannelEvent[] {
  let events = source.channels.get(channel)
  if (events === undefined) {
    events = []
    source.channels.set(channel, events)
  }
  return events
}

const TEXT_META_KINDS: Partial<Record<number, PianoProjectTextKind>> = {
  0x01: 'text',
  0x02: 'copyright',
  0x03: 'track-name',
  0x04: 'instrument-name',
  0x05: 'lyrics',
  0x06: 'marker',
  0x07: 'cue-point',
}

function exactMetaLength(
  actual: number,
  expected: number,
  label: string,
  cursor: MidiCursor,
): void {
  if (actual !== expected) {
    parseError(
      'INVALID_EVENT',
      `${label} metadata must contain exactly ${expected} byte${expected === 1 ? '' : 's'}.`,
      cursor,
    )
  }
}

function parseMetaEvent(
  cursor: MidiCursor,
  source: SourceTrackState,
  state: ParseState,
  position: { sourceTrackIndex: number; order: number; tick: number },
): boolean {
  const metaType = cursor.readUint8('meta-event type')
  const length = cursor.readVlq()
  cursor.ensure(length, 'meta-event payload')

  const textKind = TEXT_META_KINDS[metaType]
  if (textKind !== undefined) {
    reservePayload(state, length, cursor)
    const text = decodeMidiText(
      cursor.readBytes(length, `${textKind} metadata`),
    )
    state.metaEvents.push({ ...position, type: 'text', kind: textKind, text })
    if (textKind === 'track-name' && source.name === null) source.name = text
    if (textKind === 'instrument-name' && source.instrumentName === null) {
      source.instrumentName = text
    }
    return false
  }

  if (metaType === 0x00) {
    exactMetaLength(length, 2, 'Sequence number', cursor)
    state.metaEvents.push({
      ...position,
      type: 'sequence-number',
      value: cursor.readUint16('sequence number'),
    })
    return false
  }
  if (metaType === 0x20) {
    exactMetaLength(length, 1, 'Channel prefix', cursor)
    const channel = readDataByte(cursor, 'Channel prefix')
    if (channel > 15) {
      parseError(
        'INVALID_EVENT',
        'Channel prefixes must be 0 through 15.',
        cursor,
      )
    }
    state.metaEvents.push({ ...position, type: 'channel-prefix', channel })
    return false
  }
  if (metaType === 0x21) {
    exactMetaLength(length, 1, 'Port prefix', cursor)
    state.metaEvents.push({
      ...position,
      type: 'port-prefix',
      port: readDataByte(cursor, 'Port prefix'),
    })
    return false
  }
  if (metaType === 0x2f) {
    exactMetaLength(length, 0, 'End of track', cursor)
    state.metaEvents.push({ ...position, type: 'end-of-track' })
    return true
  }
  if (metaType === 0x51) {
    exactMetaLength(length, 3, 'Set tempo', cursor)
    const microsecondsPerQuarter = cursor.readUint24('tempo')
    if (microsecondsPerQuarter === 0) {
      parseError(
        'INVALID_EVENT',
        'Set-tempo values must be greater than zero.',
        cursor,
      )
    }
    state.tempoMap.push({ ...position, microsecondsPerQuarter })
    return false
  }
  if (metaType === 0x54) {
    exactMetaLength(length, 5, 'SMPTE offset', cursor)
    const hourAndRate = cursor.readUint8('SMPTE hour and frame rate')
    const frameRates = [24, 25, 29, 30] as const
    state.metaEvents.push({
      ...position,
      type: 'smpte-offset',
      frameRate: frameRates[(hourAndRate >> 5) & 0x03],
      hour: hourAndRate & 0x1f,
      minute: cursor.readUint8('SMPTE minute'),
      second: cursor.readUint8('SMPTE second'),
      frame: cursor.readUint8('SMPTE frame'),
      subFrame: cursor.readUint8('SMPTE sub-frame'),
    })
    return false
  }
  if (metaType === 0x58) {
    exactMetaLength(length, 4, 'Time signature', cursor)
    const numerator = cursor.readUint8('time-signature numerator')
    const denominatorPower = cursor.readUint8('time-signature denominator')
    if (numerator === 0 || denominatorPower > 7) {
      parseError('INVALID_EVENT', 'Unsupported MIDI time signature.', cursor)
    }
    state.timeSignatures.push({
      ...position,
      numerator,
      denominator: 2 ** denominatorPower,
      clocksPerClick: cursor.readUint8('MIDI clocks per metronome click'),
      notatedThirtySecondsPerQuarter: cursor.readUint8(
        'notated thirty-seconds per quarter',
      ),
    })
    return false
  }
  if (metaType === 0x59) {
    exactMetaLength(length, 2, 'Key signature', cursor)
    const rawSharpsFlats = cursor.readUint8('key signature')
    const sharpsFlats =
      rawSharpsFlats >= 0x80 ? rawSharpsFlats - 0x100 : rawSharpsFlats
    const mode = cursor.readUint8('key-signature mode')
    if (sharpsFlats < -7 || sharpsFlats > 7 || (mode !== 0 && mode !== 1)) {
      parseError('INVALID_EVENT', 'Unsupported MIDI key signature.', cursor)
    }
    state.keySignatures.push({ ...position, sharpsFlats, mode })
    return false
  }

  reservePayload(state, length, cursor)
  const data = cursor.readBytes(length, 'opaque meta-event payload')
  state.metaEvents.push({
    ...position,
    type: metaType === 0x7f ? 'sequencer-specific' : 'unknown-meta',
    metaType,
    data,
  })
  return false
}

function parseChannelEvent(
  cursor: MidiCursor,
  source: SourceTrackState,
  position: { sourceTrackIndex: number; order: number; tick: number },
  status: number,
  firstDataByte: number | null,
): void {
  const channel = status & 0x0f
  const message = status & 0xf0
  const readFirst = (context: string): number =>
    firstDataByte ?? readDataByte(cursor, context)
  const events = channelEventsFor(source, channel)

  if (message === 0x80 || message === 0x90) {
    const note = readFirst('note number')
    const velocity = readDataByte(cursor, 'note velocity')
    if (message === 0x90 && velocity > 0) {
      events.push({ ...position, type: 'note-on', channel, note, velocity })
    } else {
      events.push({
        ...position,
        type: 'note-off',
        channel,
        note,
        velocity,
        ...(message === 0x90 ? { encodedAsNoteOn: true as const } : {}),
      })
    }
    return
  }
  if (message === 0xa0) {
    events.push({
      ...position,
      type: 'poly-aftertouch',
      channel,
      note: readFirst('poly-aftertouch note'),
      pressure: readDataByte(cursor, 'poly-aftertouch pressure'),
    })
    return
  }
  if (message === 0xb0) {
    events.push({
      ...position,
      type: 'control-change',
      channel,
      controller: readFirst('controller number'),
      value: readDataByte(cursor, 'controller value'),
    })
    return
  }
  if (message === 0xc0) {
    events.push({
      ...position,
      type: 'program-change',
      channel,
      program: readFirst('program number'),
    })
    return
  }
  if (message === 0xd0) {
    events.push({
      ...position,
      type: 'channel-pressure',
      channel,
      pressure: readFirst('channel pressure'),
    })
    return
  }
  if (message === 0xe0) {
    const leastSignificant = readFirst('pitch-bend least-significant byte')
    const mostSignificant = readDataByte(
      cursor,
      'pitch-bend most-significant byte',
    )
    events.push({
      ...position,
      type: 'pitch-bend',
      channel,
      value: leastSignificant + mostSignificant * 0x80 - 0x2000,
    })
    return
  }
  parseError(
    'INVALID_EVENT',
    `Unsupported MIDI status 0x${status.toString(16)}.`,
    cursor,
  )
}

function parseTrack(
  data: Uint8Array,
  start: number,
  end: number,
  sourceTrackIndex: number,
  state: ParseState,
): SourceTrackState {
  const cursor = new MidiCursor(data, start, end)
  const source: SourceTrackState = {
    name: null,
    instrumentName: null,
    channels: new Map(),
  }
  let tick = 0
  let order = 0
  let runningStatus: number | null = null
  let foundEndOfTrack = false

  while (!cursor.done) {
    tick = checkedTick(tick, cursor.readVlq(), cursor)
    state.durationTicks = Math.max(state.durationTicks, tick)
    countEvent(state, cursor)

    let status = cursor.peekUint8()
    let firstDataByte: number | null = null
    if (status < 0x80) {
      if (runningStatus === null) {
        parseError(
          'INVALID_EVENT',
          'Running status appeared before a channel status byte.',
          cursor,
        )
      }
      status = runningStatus
      firstDataByte = readDataByte(cursor, 'running-status data')
    } else {
      status = cursor.readUint8('event status')
    }

    const position = { sourceTrackIndex, order, tick }
    order += 1

    if (status >= 0x80 && status <= 0xef) {
      runningStatus = status
      parseChannelEvent(cursor, source, position, status, firstDataByte)
      continue
    }

    runningStatus = null
    if (status === 0xff) {
      foundEndOfTrack = parseMetaEvent(cursor, source, state, position)
      if (foundEndOfTrack) {
        if (!cursor.done) {
          parseError(
            'INVALID_EVENT',
            'MIDI track contains data after End of Track.',
            cursor,
          )
        }
        break
      }
      continue
    }
    if (status === 0xf0 || status === 0xf7) {
      const length = cursor.readVlq()
      reservePayload(state, length, cursor)
      const event: PianoProjectSystemEvent = {
        ...position,
        type: status === 0xf0 ? 'sys-ex' : 'end-sys-ex',
        data: cursor.readBytes(length, 'SysEx payload'),
      }
      state.systemEvents.push(event)
      continue
    }
    parseError(
      'INVALID_EVENT',
      `System status 0x${status.toString(16)} is not valid in an SMF track.`,
      cursor,
    )
  }

  if (!foundEndOfTrack) {
    parseError(
      'INVALID_EVENT',
      'MIDI track is missing End of Track metadata.',
      cursor,
    )
  }
  return source
}

function completedNoteCount(track: PianoProjectTrack): number {
  const active = new Map<number, number>()
  let completed = 0
  for (const event of track.events) {
    if (event.type === 'note-on') {
      active.set(event.note, (active.get(event.note) ?? 0) + 1)
    } else if (event.type === 'note-off') {
      const count = active.get(event.note) ?? 0
      if (count > 0) {
        completed += 1
        if (count === 1) active.delete(event.note)
        else active.set(event.note, count - 1)
      }
    }
  }
  return completed
}

function compareSourcePosition(
  left: { tick: number; sourceTrackIndex: number; order: number },
  right: { tick: number; sourceTrackIndex: number; order: number },
): number {
  return (
    left.tick - right.tick ||
    left.sourceTrackIndex - right.sourceTrackIndex ||
    left.order - right.order
  )
}

/** Parse a complete Standard MIDI File into the canonical project model. */
export function parseMidiProject(
  data: Uint8Array,
  identity: PianoProjectIdentity,
): PianoProject {
  if (data.byteLength > PIANO_PROJECT_PARSE_LIMITS.maxFileBytes) {
    throw new PianoProjectParseError(
      'FILE_TOO_LARGE',
      `MIDI files may contain at most ${PIANO_PROJECT_PARSE_LIMITS.maxFileBytes.toLocaleString()} bytes.`,
    )
  }

  const cursor = new MidiCursor(data)
  if (cursor.readAscii(4, 'header id') !== 'MThd') {
    parseError(
      'INVALID_HEADER',
      'MIDI file must begin with an MThd header.',
      cursor,
    )
  }
  const headerLength = cursor.readUint32('header length')
  if (headerLength !== 6) {
    parseError(
      'INVALID_HEADER',
      'MIDI MThd length must be exactly 6 bytes.',
      cursor,
    )
  }
  const format = cursor.readUint16('MIDI format')
  if (format === 2) {
    parseError('UNSUPPORTED_FORMAT', 'MIDI Format 2 is not supported.', cursor)
  }
  if (format !== 0 && format !== 1) {
    parseError('INVALID_HEADER', `Unknown MIDI format ${format}.`, cursor)
  }
  const trackCount = cursor.readUint16('track count')
  if (trackCount === 0 || (format === 0 && trackCount !== 1)) {
    parseError(
      'INVALID_HEADER',
      'MIDI header declares an invalid track count.',
      cursor,
    )
  }
  if (trackCount > PIANO_PROJECT_PARSE_LIMITS.maxTracks) {
    parseError(
      'TOO_MANY_TRACKS',
      `MIDI files may contain at most ${PIANO_PROJECT_PARSE_LIMITS.maxTracks} tracks.`,
      cursor,
    )
  }
  const division = cursor.readUint16('time division')
  if ((division & 0x8000) !== 0) {
    parseError(
      'UNSUPPORTED_TIME_DIVISION',
      'SMPTE time division is not supported; import a PPQ MIDI file.',
      cursor,
    )
  }
  if (division === 0) {
    parseError('INVALID_HEADER', 'MIDI PPQ must be greater than zero.', cursor)
  }

  const state: ParseState = {
    eventCount: 0,
    aggregatePayloadBytes: 0,
    durationTicks: 0,
    tempoMap: [],
    timeSignatures: [],
    keySignatures: [],
    metaEvents: [],
    systemEvents: [],
  }
  const sourceTracks: SourceTrackState[] = []

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
    if (cursor.readAscii(4, 'track id') !== 'MTrk') {
      parseError(
        'INVALID_CHUNK',
        `Expected MTrk chunk ${trackIndex + 1}.`,
        cursor,
      )
    }
    const trackLength = cursor.readUint32('track length')
    cursor.ensure(trackLength, `track ${trackIndex + 1}`)
    const trackStart = cursor.position
    const trackEnd = trackStart + trackLength
    sourceTracks.push(parseTrack(data, trackStart, trackEnd, trackIndex, state))
    cursor.position = trackEnd
  }
  if (!cursor.done) {
    parseError(
      'INVALID_CHUNK',
      'MIDI file contains trailing bytes after its tracks.',
      cursor,
    )
  }

  const tracks: PianoProjectTrack[] = []
  for (
    let sourceTrackIndex = 0;
    sourceTrackIndex < sourceTracks.length;
    sourceTrackIndex++
  ) {
    const source = sourceTracks[sourceTrackIndex]
    for (const channel of [...source.channels.keys()].sort(
      (left, right) => left - right,
    )) {
      tracks.push({
        id: `smf-t${sourceTrackIndex}-c${channel}`,
        sourceTrackIndex,
        channel,
        isPercussion: channel === 9,
        name: source.name,
        instrumentName: source.instrumentName,
        events: source.channels.get(channel) ?? [],
      })
    }
  }

  let scoreTrackId: string | null = null
  let bestNoteCount = 0
  const noteCounts = new Map<string, number>()
  for (const track of tracks) {
    const noteCount = completedNoteCount(track)
    noteCounts.set(track.id, noteCount)
    if (!track.isPercussion && noteCount > bestNoteCount) {
      scoreTrackId = track.id
      bestNoteCount = noteCount
    }
  }
  const backingTrackIds = tracks
    .filter(
      (track) =>
        !track.isPercussion &&
        track.id !== scoreTrackId &&
        (noteCounts.get(track.id) ?? 0) > 0,
    )
    .map((track) => track.id)

  state.tempoMap.sort(compareSourcePosition)
  state.timeSignatures.sort(compareSourcePosition)
  state.keySignatures.sort(compareSourcePosition)

  return {
    schemaVersion: PIANO_PROJECT_SCHEMA_VERSION,
    id: identity.id,
    name: identity.name,
    createdAt: identity.importedAt,
    updatedAt: identity.importedAt,
    source: {
      kind: 'midi',
      fileName: identity.fileName,
      byteLength: data.byteLength,
      sha256: identity.sha256,
      format,
      ticksPerQuarter: division,
    },
    durationTicks: state.durationTicks,
    tempoMap: state.tempoMap,
    timeSignatures: state.timeSignatures,
    keySignatures: state.keySignatures,
    tracks,
    scoreTrackId,
    backingTrackIds,
    metaEvents: state.metaEvents,
    systemEvents: state.systemEvents,
  }
}
