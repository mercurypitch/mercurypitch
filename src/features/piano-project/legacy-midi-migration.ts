// ============================================================
// Legacy MIDI migration — validated, non-destructive Piano project source
// ============================================================
//
// Guitar and the current Piano tab still own this localStorage collection.
// This module reads it afresh, never mutates it, and hashes only normalized
// musical/selection content so random legacy ids and timestamps cannot create
// duplicate canonical projects.

import type { PianoProject } from './piano-project'
import { PIANO_PROJECT_SCHEMA_VERSION } from './piano-project'

export const LEGACY_MIDI_STORAGE_KEY = 'pitchperfect_guitar_songs'
export const LEGACY_MIDI_MIGRATION_VERSION = 1 as const

const MAX_LEGACY_SONGS = 30
const MAX_LEGACY_TRACKS = 128
const MAX_LEGACY_NOTES = 200_000
const MAX_NAME_LENGTH = 256
const MAX_ID_LENGTH = 256
const LEGACY_TICKS_PER_QUARTER = 480
const DEFAULT_LEGACY_VELOCITY = 80
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000
const MAX_PROJECT_TICK = 0x7fffffff
const MAX_LEGACY_BEAT = MAX_PROJECT_TICK / LEGACY_TICKS_PER_QUARTER

export interface LegacyMidiNote {
  midi: number
  startBeat: number
  duration: number
  stringIndex?: number
  fret?: number
  letRing?: boolean
}

export interface LegacyMidiTrack {
  id: string
  name: string
  instrumentName: string
  noteCount: number
  notes: LegacyMidiNote[]
}

export interface LegacyMidiSong {
  id: string
  name: string
  bpm: number
  tracks: LegacyMidiTrack[]
  scoreTrackId: string
  backingTrackIds: string[]
  importedAt: number
}

export type LegacyMidiReadStatus =
  | 'ready'
  | 'absent'
  | 'malformed'
  | 'unavailable'

export interface LegacyMidiReadResult {
  status: LegacyMidiReadStatus
  songs: LegacyMidiSong[]
  skippedRows: number
  error?: unknown
}

export interface LegacyMidiMigrationCandidate {
  sourceHash: string
  migrationKey: string
  project: PianoProject
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  )
}

function isFiniteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function optionalIntegerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | undefined {
  return (
    value === undefined ||
    (Number.isInteger(value) &&
      typeof value === 'number' &&
      value >= minimum &&
      value <= maximum)
  )
}

function parseNote(value: unknown): LegacyMidiNote | null {
  if (!isRecord(value)) return null
  if (!Number.isInteger(value.midi) || !isFiniteBetween(value.midi, 0, 127)) {
    return null
  }
  if (!isFiniteBetween(value.startBeat, 0, MAX_LEGACY_BEAT)) {
    return null
  }
  if (!isFiniteBetween(value.duration, Number.EPSILON, MAX_LEGACY_BEAT)) {
    return null
  }
  const startTick = Math.round(value.startBeat * LEGACY_TICKS_PER_QUARTER)
  const durationTicks = Math.max(
    1,
    Math.round(value.duration * LEGACY_TICKS_PER_QUARTER),
  )
  if (
    !Number.isSafeInteger(startTick) ||
    !Number.isSafeInteger(durationTicks) ||
    startTick + durationTicks > MAX_PROJECT_TICK
  ) {
    return null
  }
  if (!optionalIntegerBetween(value.stringIndex, 0, 127)) return null
  if (!optionalIntegerBetween(value.fret, 0, 255)) return null
  if (value.letRing !== undefined && typeof value.letRing !== 'boolean') {
    return null
  }

  const note: LegacyMidiNote = {
    midi: value.midi,
    startBeat: value.startBeat,
    duration: value.duration,
  }
  if (value.stringIndex !== undefined) note.stringIndex = value.stringIndex
  if (value.fret !== undefined) note.fret = value.fret
  if (value.letRing !== undefined) note.letRing = value.letRing
  return note
}

function parseTrack(value: unknown): LegacyMidiTrack | null {
  if (!isRecord(value)) return null
  if (!isBoundedString(value.id, MAX_ID_LENGTH)) return null
  if (!isBoundedString(value.name, MAX_NAME_LENGTH)) return null
  if (!isBoundedString(value.instrumentName, MAX_NAME_LENGTH)) return null
  if (!Array.isArray(value.notes) || value.notes.length > MAX_LEGACY_NOTES) {
    return null
  }
  if (
    !Number.isInteger(value.noteCount) ||
    value.noteCount !== value.notes.length
  ) {
    return null
  }
  const notes: LegacyMidiNote[] = []
  for (const rawNote of value.notes) {
    const note = parseNote(rawNote)
    if (note === null) return null
    notes.push(note)
  }
  return {
    id: value.id,
    name: value.name,
    instrumentName: value.instrumentName,
    noteCount: value.noteCount,
    notes,
  }
}

function parseSong(value: unknown): LegacyMidiSong | null {
  if (!isRecord(value)) return null
  if (!isBoundedString(value.id, MAX_ID_LENGTH)) return null
  if (!isBoundedString(value.name, MAX_NAME_LENGTH)) return null
  if (!isFiniteBetween(value.bpm, 1, 1_000)) return null
  if (!isFiniteBetween(value.importedAt, 0, MAX_DATE_MILLISECONDS)) return null
  if (
    !Array.isArray(value.tracks) ||
    value.tracks.length === 0 ||
    value.tracks.length > MAX_LEGACY_TRACKS
  ) {
    return null
  }

  const tracks: LegacyMidiTrack[] = []
  const trackIds = new Set<string>()
  let noteCount = 0
  for (const rawTrack of value.tracks) {
    const track = parseTrack(rawTrack)
    if (track === null || trackIds.has(track.id)) return null
    noteCount += track.notes.length
    if (noteCount > MAX_LEGACY_NOTES) return null
    trackIds.add(track.id)
    tracks.push(track)
  }

  if (
    !isBoundedString(value.scoreTrackId, MAX_ID_LENGTH) ||
    !trackIds.has(value.scoreTrackId) ||
    !Array.isArray(value.backingTrackIds)
  ) {
    return null
  }
  const backingTrackIds: string[] = []
  const seenBacking = new Set<string>()
  for (const id of value.backingTrackIds) {
    if (
      !isBoundedString(id, MAX_ID_LENGTH) ||
      !trackIds.has(id) ||
      id === value.scoreTrackId ||
      seenBacking.has(id)
    ) {
      return null
    }
    seenBacking.add(id)
    backingTrackIds.push(id)
  }

  return {
    id: value.id,
    name: value.name,
    bpm: value.bpm,
    tracks,
    scoreTrackId: value.scoreTrackId,
    backingTrackIds,
    importedAt: value.importedAt,
  }
}

/** Read the shared collection now; never cache it and never write through it. */
export function readLegacyMidiSongs(storage: Storage): LegacyMidiReadResult {
  let raw: string | null
  try {
    raw = storage.getItem(LEGACY_MIDI_STORAGE_KEY)
  } catch (error) {
    return { status: 'unavailable', songs: [], skippedRows: 0, error }
  }
  if (raw === null) return { status: 'absent', songs: [], skippedRows: 0 }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    return { status: 'malformed', songs: [], skippedRows: 1, error }
  }
  if (!Array.isArray(parsed)) {
    return { status: 'malformed', songs: [], skippedRows: 1 }
  }

  const songs: LegacyMidiSong[] = []
  let skippedRows = Math.max(0, parsed.length - MAX_LEGACY_SONGS)
  for (const rawSong of parsed.slice(0, MAX_LEGACY_SONGS)) {
    const song = parseSong(rawSong)
    if (song === null) skippedRows += 1
    else songs.push(song)
  }
  return { status: 'ready', songs, skippedRows }
}

function normalizedSong(song: LegacyMidiSong): unknown {
  return {
    name: song.name,
    bpm: song.bpm,
    tracks: song.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      instrumentName: track.instrumentName,
      noteCount: track.noteCount,
      notes: track.notes.map((note) => ({
        midi: note.midi,
        startBeat: note.startBeat,
        duration: note.duration,
        stringIndex: note.stringIndex ?? null,
        fret: note.fret ?? null,
        letRing: note.letRing ?? null,
      })),
    })),
    scoreTrackId: song.scoreTrackId,
    backingTrackIds: [...song.backingTrackIds].sort(),
  }
}

/** Stable source identity excluding the random legacy id and import time. */
export async function hashLegacyMidiSong(
  song: LegacyMidiSong,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizedSong(song)))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function legacyTrackChannel(trackId: string): number {
  const match = /c(\d+)$/.exec(trackId)
  if (match === null) return 0
  const channel = Number(match[1])
  return Number.isInteger(channel) && channel >= 0 && channel <= 15
    ? channel
    : 0
}

/** Convert validated beat-native legacy data into the explicit compatibility project. */
export function legacyMidiSongToProject(
  song: LegacyMidiSong,
  sourceHash: string,
): PianoProject {
  const tracks = song.tracks.map((track, sourceTrackIndex) => {
    const channel = legacyTrackChannel(track.id)
    const pending = track.notes.flatMap((note, noteIndex) => {
      const tick = Math.round(note.startBeat * LEGACY_TICKS_PER_QUARTER)
      const durationTicks = Math.max(
        1,
        Math.round(note.duration * LEGACY_TICKS_PER_QUARTER),
      )
      return [
        {
          type: 'note-on' as const,
          channel,
          note: note.midi,
          velocity: DEFAULT_LEGACY_VELOCITY,
          tick,
          noteIndex,
          off: false,
        },
        {
          type: 'note-off' as const,
          channel,
          note: note.midi,
          velocity: 0,
          tick: tick + durationTicks,
          noteIndex,
          off: true,
        },
      ]
    })
    pending.sort(
      (left, right) =>
        left.tick - right.tick ||
        Number(right.off) - Number(left.off) ||
        left.noteIndex - right.noteIndex,
    )
    return {
      id: track.id,
      sourceTrackIndex,
      channel,
      isPercussion: channel === 9,
      name: track.name,
      instrumentName: track.instrumentName,
      events: pending.map((event, order) => ({
        type: event.type,
        channel: event.channel,
        note: event.note,
        velocity: event.velocity,
        sourceTrackIndex,
        order,
        tick: event.tick,
      })),
    }
  })
  const durationTicks = tracks.reduce(
    (maximum, track) =>
      track.events.reduce(
        (trackMaximum, event) => Math.max(trackMaximum, event.tick),
        maximum,
      ),
    0,
  )
  const importedAt = new Date(Math.floor(song.importedAt)).toISOString()
  return {
    schemaVersion: PIANO_PROJECT_SCHEMA_VERSION,
    id: `piano-legacy-${sourceHash}`,
    name: song.name,
    createdAt: importedAt,
    updatedAt: importedAt,
    source: {
      kind: 'legacy-midi',
      storageKey: LEGACY_MIDI_STORAGE_KEY,
      sourceHash,
      ticksPerQuarter: LEGACY_TICKS_PER_QUARTER,
    },
    durationTicks,
    tempoMap: [
      {
        sourceTrackIndex: 0,
        order: 0,
        tick: 0,
        microsecondsPerQuarter: Math.round(60_000_000 / song.bpm),
      },
    ],
    timeSignatures: [],
    keySignatures: [],
    tracks,
    metaEvents: [],
    systemEvents: [],
    scoreTrackId: song.scoreTrackId,
    backingTrackIds: [...song.backingTrackIds],
  }
}

/** Validate, hash, de-duplicate and convert every current legacy row. */
export async function createLegacyMidiMigrationCandidates(
  songs: readonly LegacyMidiSong[],
): Promise<LegacyMidiMigrationCandidate[]> {
  const candidates = new Map<string, LegacyMidiMigrationCandidate>()
  for (const song of songs) {
    const sourceHash = await hashLegacyMidiSong(song)
    if (candidates.has(sourceHash)) continue
    candidates.set(sourceHash, {
      sourceHash,
      migrationKey: `legacy-midi-v${LEGACY_MIDI_MIGRATION_VERSION}:${sourceHash}`,
      project: legacyMidiSongToProject(song, sourceHash),
    })
  }
  return [...candidates.values()]
}
