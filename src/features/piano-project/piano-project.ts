// ============================================================
// PianoProject — lossless-enough, tick-native Standard MIDI authority
// ============================================================
//
// Source-track order and absolute ticks stay authoritative. Playable tracks
// are split only as a projection by source track + MIDI channel; conductor,
// meta and system events keep their original source coordinates so an editor
// can reconstruct ordering without depending on the legacy Piano runtime.

export const PIANO_PROJECT_SCHEMA_VERSION = 1 as const

export interface PianoProjectMidiSource {
  kind: 'midi'
  fileName: string
  byteLength: number
  sha256: string
  format: 0 | 1
  ticksPerQuarter: number
}

/** Truthful source identity for compatibility records that retained no SMF bytes. */
export interface PianoProjectLegacyMidiSource {
  kind: 'legacy-midi'
  storageKey: string
  sourceHash: string
  /** Explicit compatibility grid chosen by the migration, not original evidence. */
  ticksPerQuarter: number
}

/** Stable identity for a first-party project shipped with MercuryPitch. */
export interface PianoProjectBundledSource {
  kind: 'bundled'
  catalogId: string
  revision: number
  contentHash: string
  ticksPerQuarter: number
}

export type PianoProjectSource =
  | PianoProjectMidiSource
  | PianoProjectLegacyMidiSource
  | PianoProjectBundledSource

export interface PianoProjectEventPosition {
  /** Zero-based MTrk index in the source file. */
  sourceTrackIndex: number
  /** Zero-based event order within the source MTrk. */
  order: number
  /** Absolute source tick within the MTrk. */
  tick: number
}

export interface PianoProjectTempoEvent extends PianoProjectEventPosition {
  microsecondsPerQuarter: number
}

export interface PianoProjectTimeSignatureEvent extends PianoProjectEventPosition {
  numerator: number
  denominator: number
  clocksPerClick: number
  notatedThirtySecondsPerQuarter: number
}

export interface PianoProjectKeySignatureEvent extends PianoProjectEventPosition {
  /** -7 flats through +7 sharps. */
  sharpsFlats: number
  mode: 0 | 1
}

export type PianoProjectTextKind =
  | 'text'
  | 'copyright'
  | 'track-name'
  | 'instrument-name'
  | 'lyrics'
  | 'marker'
  | 'cue-point'

export interface PianoProjectTextEvent extends PianoProjectEventPosition {
  type: 'text'
  kind: PianoProjectTextKind
  text: string
}

export type PianoProjectMetaEvent =
  | PianoProjectTextEvent
  | (PianoProjectEventPosition & {
      type: 'sequence-number'
      value: number
    })
  | (PianoProjectEventPosition & {
      type: 'channel-prefix'
      channel: number
    })
  | (PianoProjectEventPosition & {
      type: 'port-prefix'
      port: number
    })
  | (PianoProjectEventPosition & {
      type: 'smpte-offset'
      frameRate: 24 | 25 | 29 | 30
      hour: number
      minute: number
      second: number
      frame: number
      subFrame: number
    })
  | (PianoProjectEventPosition & {
      type: 'sequencer-specific' | 'unknown-meta'
      metaType: number
      data: Uint8Array
    })
  | (PianoProjectEventPosition & {
      type: 'end-of-track'
    })

export type PianoProjectSystemEvent = PianoProjectEventPosition & {
  type: 'sys-ex' | 'end-sys-ex'
  data: Uint8Array
}

export type PianoProjectChannelEvent =
  | (PianoProjectEventPosition & {
      type: 'note-on' | 'note-off'
      channel: number
      note: number
      velocity: number
      /** True when a semantic note-off used MIDI's note-on/velocity-zero form. */
      encodedAsNoteOn?: true
    })
  | (PianoProjectEventPosition & {
      type: 'poly-aftertouch'
      channel: number
      note: number
      pressure: number
    })
  | (PianoProjectEventPosition & {
      type: 'control-change'
      channel: number
      controller: number
      value: number
    })
  | (PianoProjectEventPosition & {
      type: 'program-change'
      channel: number
      program: number
    })
  | (PianoProjectEventPosition & {
      type: 'channel-pressure'
      channel: number
      pressure: number
    })
  | (PianoProjectEventPosition & {
      type: 'pitch-bend'
      channel: number
      /** Signed 14-bit value: -8192 through +8191. */
      value: number
    })

export interface PianoProjectTrack {
  /** Stable across repeated imports of the same SMF structure. */
  id: string
  sourceTrackIndex: number
  channel: number
  isPercussion: boolean
  /** First source track-name meta value, when present. */
  name: string | null
  /** First source instrument-name meta value, when present. */
  instrumentName: string | null
  events: PianoProjectChannelEvent[]
}

export interface PianoProject {
  schemaVersion: typeof PIANO_PROJECT_SCHEMA_VERSION
  id: string
  name: string
  createdAt: string
  updatedAt: string
  source: PianoProjectSource
  durationTicks: number
  tempoMap: PianoProjectTempoEvent[]
  timeSignatures: PianoProjectTimeSignatureEvent[]
  keySignatures: PianoProjectKeySignatureEvent[]
  tracks: PianoProjectTrack[]
  /** Stable playable-track id selected for scoring, or null without pitched notes. */
  scoreTrackId: string | null
  /** Stable playable-track ids selected for accompaniment. */
  backingTrackIds: string[]
  metaEvents: PianoProjectMetaEvent[]
  systemEvents: PianoProjectSystemEvent[]
}

export interface PianoProjectIdentity {
  id: string
  name: string
  fileName: string
  sha256: string
  importedAt: string
}

const PROJECT_VALIDATION_LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  maxSourceTracks: 256,
  maxPlayableTracks: 256 * 16,
  maxEvents: 500_000,
  maxPayloadBytes: 64 * 1024,
  maxAggregatePayloadBytes: 1024 * 1024,
  maxTick: 0x7fffffff,
} as const

interface ValidationState {
  eventCount: number
  aggregatePayloadBytes: number
}

function invalidProject(path: string, reason: string): never {
  throw new TypeError(`Invalid PianoProject at ${path}: ${reason}`)
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidProject(path, 'expected an object.')
  }
  return value as Record<string, unknown>
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalidProject(path, 'expected an array.')
  return value
}

function stringAt(
  value: unknown,
  path: string,
  maximumLength = PROJECT_VALIDATION_LIMITS.maxPayloadBytes,
): string {
  if (typeof value !== 'string' || value.length > maximumLength) {
    invalidProject(
      path,
      `expected a string of at most ${maximumLength} characters.`,
    )
  }
  return value
}

function nonEmptyStringAt(
  value: unknown,
  path: string,
  maximumLength = 1024,
): string {
  const result = stringAt(value, path, maximumLength)
  if (result.trim() === '') invalidProject(path, 'expected a non-empty string.')
  return result
}

function integerAt(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalidProject(
      path,
      `expected an integer from ${minimum} through ${maximum}.`,
    )
  }
  return value
}

function isoTimestampAt(value: unknown, path: string): string {
  const result = stringAt(value, path, 64)
  const timestamp = Date.parse(result)
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== result
  ) {
    invalidProject(path, 'expected a canonical ISO-8601 timestamp.')
  }
  return result
}

function positionAt(
  value: Record<string, unknown>,
  path: string,
  durationTicks: number,
): void {
  integerAt(
    value.sourceTrackIndex,
    `${path}.sourceTrackIndex`,
    0,
    PROJECT_VALIDATION_LIMITS.maxSourceTracks - 1,
  )
  integerAt(
    value.order,
    `${path}.order`,
    0,
    PROJECT_VALIDATION_LIMITS.maxEvents - 1,
  )
  integerAt(value.tick, `${path}.tick`, 0, durationTicks)
}

function countEvent(state: ValidationState, path: string): void {
  state.eventCount += 1
  if (state.eventCount > PROJECT_VALIDATION_LIMITS.maxEvents) {
    invalidProject(
      path,
      `projects may contain at most ${PROJECT_VALIDATION_LIMITS.maxEvents} events.`,
    )
  }
}

function payloadAt(
  value: unknown,
  path: string,
  state: ValidationState,
): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    invalidProject(path, 'expected a Uint8Array.')
  }
  if (value.byteLength > PROJECT_VALIDATION_LIMITS.maxPayloadBytes) {
    invalidProject(path, 'payload exceeds the per-event byte limit.')
  }
  state.aggregatePayloadBytes += value.byteLength
  if (
    state.aggregatePayloadBytes >
    PROJECT_VALIDATION_LIMITS.maxAggregatePayloadBytes
  ) {
    invalidProject(
      path,
      'aggregate text and binary payloads exceed the project limit.',
    )
  }
  return value
}

function textPayloadAt(
  value: unknown,
  path: string,
  state: ValidationState,
): string {
  const result = stringAt(value, path)
  const byteLength = new TextEncoder().encode(result).byteLength
  if (byteLength > PROJECT_VALIDATION_LIMITS.maxPayloadBytes) {
    invalidProject(path, 'encoded text exceeds the per-event byte limit.')
  }
  state.aggregatePayloadBytes += byteLength
  if (
    state.aggregatePayloadBytes >
    PROJECT_VALIDATION_LIMITS.maxAggregatePayloadBytes
  ) {
    invalidProject(
      path,
      'aggregate text and binary payloads exceed the project limit.',
    )
  }
  return result
}

function validateSource(value: unknown): void {
  const source = recordAt(value, 'source')
  integerAt(source.ticksPerQuarter, 'source.ticksPerQuarter', 1, 0x7fff)
  if (source.kind === 'midi') {
    nonEmptyStringAt(source.fileName, 'source.fileName', 4096)
    integerAt(
      source.byteLength,
      'source.byteLength',
      0,
      PROJECT_VALIDATION_LIMITS.maxFileBytes,
    )
    if (source.format !== 0 && source.format !== 1) {
      invalidProject(
        'source.format',
        'expected Standard MIDI File format 0 or 1.',
      )
    }
    if (
      typeof source.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(source.sha256)
    ) {
      invalidProject('source.sha256', 'expected a lowercase SHA-256 digest.')
    }
    return
  }
  if (source.kind === 'legacy-midi') {
    nonEmptyStringAt(source.storageKey, 'source.storageKey', 1024)
    if (
      typeof source.sourceHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(source.sourceHash)
    ) {
      invalidProject(
        'source.sourceHash',
        'expected a lowercase SHA-256 digest.',
      )
    }
    return
  }
  if (source.kind === 'bundled') {
    nonEmptyStringAt(source.catalogId, 'source.catalogId', 1024)
    integerAt(source.revision, 'source.revision', 1, 0x7fffffff)
    if (
      typeof source.contentHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(source.contentHash)
    ) {
      invalidProject(
        'source.contentHash',
        'expected a lowercase SHA-256 digest.',
      )
    }
    return
  }
  invalidProject('source.kind', 'expected "midi", "legacy-midi", or "bundled".')
}

function validateChannelEvent(
  value: unknown,
  path: string,
  track: { sourceTrackIndex: number; channel: number },
  durationTicks: number,
): void {
  const event = recordAt(value, path)
  positionAt(event, path, durationTicks)
  if (event.sourceTrackIndex !== track.sourceTrackIndex) {
    invalidProject(`${path}.sourceTrackIndex`, 'must match its playable track.')
  }
  integerAt(event.channel, `${path}.channel`, 0, 15)
  if (event.channel !== track.channel) {
    invalidProject(`${path}.channel`, 'must match its playable track.')
  }

  if (event.type === 'note-on' || event.type === 'note-off') {
    integerAt(event.note, `${path}.note`, 0, 127)
    integerAt(
      event.velocity,
      `${path}.velocity`,
      event.type === 'note-on' ? 1 : 0,
      127,
    )
    if (
      event.encodedAsNoteOn !== undefined &&
      (event.type !== 'note-off' || event.encodedAsNoteOn !== true)
    ) {
      invalidProject(
        `${path}.encodedAsNoteOn`,
        'may only be true on a note-off event.',
      )
    }
    return
  }
  if (event.type === 'poly-aftertouch') {
    integerAt(event.note, `${path}.note`, 0, 127)
    integerAt(event.pressure, `${path}.pressure`, 0, 127)
    return
  }
  if (event.type === 'control-change') {
    integerAt(event.controller, `${path}.controller`, 0, 127)
    integerAt(event.value, `${path}.value`, 0, 127)
    return
  }
  if (event.type === 'program-change') {
    integerAt(event.program, `${path}.program`, 0, 127)
    return
  }
  if (event.type === 'channel-pressure') {
    integerAt(event.pressure, `${path}.pressure`, 0, 127)
    return
  }
  if (event.type === 'pitch-bend') {
    integerAt(event.value, `${path}.value`, -8192, 8191)
    return
  }
  invalidProject(`${path}.type`, 'unknown channel-event type.')
}

function validateMapEvent(
  value: unknown,
  path: string,
  kind: 'tempo' | 'time-signature' | 'key-signature',
  durationTicks: number,
): void {
  const event = recordAt(value, path)
  positionAt(event, path, durationTicks)
  if (kind === 'tempo') {
    integerAt(
      event.microsecondsPerQuarter,
      `${path}.microsecondsPerQuarter`,
      1,
      0x7fffffff,
    )
    return
  }
  if (kind === 'time-signature') {
    integerAt(event.numerator, `${path}.numerator`, 1, 255)
    const denominator = integerAt(
      event.denominator,
      `${path}.denominator`,
      1,
      128,
    )
    if ((denominator & (denominator - 1)) !== 0) {
      invalidProject(`${path}.denominator`, 'expected a power of two.')
    }
    integerAt(event.clocksPerClick, `${path}.clocksPerClick`, 0, 255)
    integerAt(
      event.notatedThirtySecondsPerQuarter,
      `${path}.notatedThirtySecondsPerQuarter`,
      0,
      255,
    )
    return
  }
  integerAt(event.sharpsFlats, `${path}.sharpsFlats`, -7, 7)
  if (event.mode !== 0 && event.mode !== 1) {
    invalidProject(`${path}.mode`, 'expected 0 (major) or 1 (minor).')
  }
}

const TEXT_KINDS = new Set<PianoProjectTextKind>([
  'text',
  'copyright',
  'track-name',
  'instrument-name',
  'lyrics',
  'marker',
  'cue-point',
])

function validateMetaEvent(
  value: unknown,
  path: string,
  durationTicks: number,
  state: ValidationState,
): void {
  const event = recordAt(value, path)
  positionAt(event, path, durationTicks)
  if (event.type === 'text') {
    if (!TEXT_KINDS.has(event.kind as PianoProjectTextKind)) {
      invalidProject(`${path}.kind`, 'unknown MIDI text kind.')
    }
    textPayloadAt(event.text, `${path}.text`, state)
    return
  }
  if (event.type === 'sequence-number') {
    integerAt(event.value, `${path}.value`, 0, 0xffff)
    return
  }
  if (event.type === 'channel-prefix') {
    integerAt(event.channel, `${path}.channel`, 0, 15)
    return
  }
  if (event.type === 'port-prefix') {
    integerAt(event.port, `${path}.port`, 0, 127)
    return
  }
  if (event.type === 'smpte-offset') {
    if (![24, 25, 29, 30].includes(event.frameRate as number)) {
      invalidProject(`${path}.frameRate`, 'expected 24, 25, 29, or 30 fps.')
    }
    integerAt(event.hour, `${path}.hour`, 0, 23)
    integerAt(event.minute, `${path}.minute`, 0, 59)
    integerAt(event.second, `${path}.second`, 0, 59)
    integerAt(event.frame, `${path}.frame`, 0, 29)
    integerAt(event.subFrame, `${path}.subFrame`, 0, 99)
    return
  }
  if (event.type === 'sequencer-specific' || event.type === 'unknown-meta') {
    integerAt(event.metaType, `${path}.metaType`, 0, 255)
    payloadAt(event.data, `${path}.data`, state)
    return
  }
  if (event.type === 'end-of-track') return
  invalidProject(`${path}.type`, 'unknown meta-event type.')
}

/** Validate untrusted persisted or worker-returned data without coercing it. */
export function validatePianoProject(value: unknown): PianoProject {
  const project = recordAt(value, 'project')
  if (project.schemaVersion !== PIANO_PROJECT_SCHEMA_VERSION) {
    invalidProject('schemaVersion', `expected ${PIANO_PROJECT_SCHEMA_VERSION}.`)
  }
  nonEmptyStringAt(project.id, 'id')
  nonEmptyStringAt(project.name, 'name', 4096)
  const createdAt = isoTimestampAt(project.createdAt, 'createdAt')
  const updatedAt = isoTimestampAt(project.updatedAt, 'updatedAt')
  if (updatedAt < createdAt) {
    invalidProject('updatedAt', 'must not precede createdAt.')
  }
  validateSource(project.source)
  const durationTicks = integerAt(
    project.durationTicks,
    'durationTicks',
    0,
    PROJECT_VALIDATION_LIMITS.maxTick,
  )
  const state: ValidationState = { eventCount: 0, aggregatePayloadBytes: 0 }

  const validateMap = (
    key: 'tempoMap' | 'timeSignatures' | 'keySignatures',
    kind: 'tempo' | 'time-signature' | 'key-signature',
  ): void => {
    for (const [index, event] of arrayAt(project[key], key).entries()) {
      countEvent(state, `${key}[${index}]`)
      validateMapEvent(event, `${key}[${index}]`, kind, durationTicks)
    }
  }
  validateMap('tempoMap', 'tempo')
  validateMap('timeSignatures', 'time-signature')
  validateMap('keySignatures', 'key-signature')

  const tracks = arrayAt(project.tracks, 'tracks')
  if (tracks.length > PROJECT_VALIDATION_LIMITS.maxPlayableTracks) {
    invalidProject('tracks', 'too many playable source-track/channel lanes.')
  }
  const trackIds = new Set<string>()
  const percussionIds = new Set<string>()
  for (const [trackIndex, rawTrack] of tracks.entries()) {
    const path = `tracks[${trackIndex}]`
    const track = recordAt(rawTrack, path)
    const id = nonEmptyStringAt(track.id, `${path}.id`)
    if (trackIds.has(id)) invalidProject(`${path}.id`, 'duplicate track id.')
    trackIds.add(id)
    const sourceTrackIndex = integerAt(
      track.sourceTrackIndex,
      `${path}.sourceTrackIndex`,
      0,
      PROJECT_VALIDATION_LIMITS.maxSourceTracks - 1,
    )
    const channel = integerAt(track.channel, `${path}.channel`, 0, 15)
    if (typeof track.isPercussion !== 'boolean') {
      invalidProject(`${path}.isPercussion`, 'expected a boolean.')
    }
    if (track.isPercussion !== (channel === 9)) {
      invalidProject(
        `${path}.isPercussion`,
        'must identify General MIDI channel 10 exactly.',
      )
    }
    if (track.isPercussion) percussionIds.add(id)
    if (track.name !== null) stringAt(track.name, `${path}.name`)
    if (track.instrumentName !== null) {
      stringAt(track.instrumentName, `${path}.instrumentName`)
    }
    let previousOrder = -1
    let previousTick = -1
    for (const [eventIndex, event] of arrayAt(
      track.events,
      `${path}.events`,
    ).entries()) {
      const eventPath = `${path}.events[${eventIndex}]`
      countEvent(state, eventPath)
      validateChannelEvent(
        event,
        eventPath,
        { sourceTrackIndex, channel },
        durationTicks,
      )
      const eventRecord = event as Record<string, number>
      if (
        eventRecord.order <= previousOrder ||
        eventRecord.tick < previousTick
      ) {
        invalidProject(
          eventPath,
          'events must retain increasing source order and tick order.',
        )
      }
      previousOrder = eventRecord.order
      previousTick = eventRecord.tick
    }
  }

  for (const [index, event] of arrayAt(
    project.metaEvents,
    'metaEvents',
  ).entries()) {
    const path = `metaEvents[${index}]`
    countEvent(state, path)
    validateMetaEvent(event, path, durationTicks, state)
  }
  for (const [index, rawEvent] of arrayAt(
    project.systemEvents,
    'systemEvents',
  ).entries()) {
    const path = `systemEvents[${index}]`
    const event = recordAt(rawEvent, path)
    countEvent(state, path)
    positionAt(event, path, durationTicks)
    if (event.type !== 'sys-ex' && event.type !== 'end-sys-ex') {
      invalidProject(`${path}.type`, 'unknown system-event type.')
    }
    payloadAt(event.data, `${path}.data`, state)
  }

  if (project.scoreTrackId !== null) {
    const scoreTrackId = nonEmptyStringAt(project.scoreTrackId, 'scoreTrackId')
    if (!trackIds.has(scoreTrackId) || percussionIds.has(scoreTrackId)) {
      invalidProject(
        'scoreTrackId',
        'expected a valid pitched playable track id.',
      )
    }
  }
  const backingIds = new Set<string>()
  for (const [index, rawId] of arrayAt(
    project.backingTrackIds,
    'backingTrackIds',
  ).entries()) {
    const path = `backingTrackIds[${index}]`
    const id = nonEmptyStringAt(rawId, path)
    if (
      !trackIds.has(id) ||
      id === project.scoreTrackId ||
      backingIds.has(id)
    ) {
      invalidProject(path, 'expected a unique non-score playable track id.')
    }
    backingIds.add(id)
  }

  return value as PianoProject
}

export function pianoProjectTicksPerQuarter(project: PianoProject): number {
  return project.source.ticksPerQuarter
}
