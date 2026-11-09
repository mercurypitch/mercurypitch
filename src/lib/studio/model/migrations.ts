// Studio migrations — an older song document stepped up to the current schema as it is read, one pure step per version, and a newer one refused in plain words.
//
// Every read of a song migrates it first: storage, backups, copies and
// validateStudioProject itself (validation.ts). A step takes a version-v
// document to v + 1 and changes nothing else; each version has a fixture
// and a test (migrations.test.ts). A song from a newer build is refused,
// never half-read: this build's validator refuses fields it does not know.
import { STUDIO_SCHEMA_VERSION } from './types'

/** What a song saved by a newer build says when this one opens it. */
export const STUDIO_NEWER_SONG =
  'This song was saved by a newer MercuryPitch. Update the app to open it.'

/** A song saved by a build newer than this one. */
export class StudioNewerSongError extends Error {
  constructor(readonly version: number) {
    super(STUDIO_NEWER_SONG)
    this.name = 'StudioNewerSongError'
  }
}

type SongDocument = Readonly<Record<string, unknown>>
type MigrationStep = (song: SongDocument) => SongDocument

/** STEPS[v - 1] takes a version-v song to version v + 1. */
const STEPS: readonly MigrationStep[] = [
  // 1 to 2: a song may hold MIDI sequences, and clips that play them. A
  // version 1 song holds none, and leaves `sequences` out as an empty one does.
  (song) => ({ ...song, schemaVersion: 2 }),
]

/** How many steps this build knows: one fewer than its versions. */
export const STUDIO_MIGRATION_STEPS = STEPS.length

function songDocument(value: unknown): value is SongDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A song's version, when it names one this build could step from or refuse: a whole number from 1. */
export function studioSongVersion(raw: unknown): number | null {
  if (!songDocument(raw)) return null
  const version = raw.schemaVersion
  return typeof version === 'number' &&
    Number.isSafeInteger(version) &&
    version >= 1
    ? version
    : null
}

/**
 * `raw` at the current version: stepped up from an older one, as it is when
 * current. Anything that names no version is handed back for the validator
 * to refuse; a newer version throws StudioNewerSongError. Never changes
 * `raw` itself.
 */
export function migrateStudioProject(raw: unknown): unknown {
  const version = studioSongVersion(raw)
  if (version === null) return raw
  if (version > STUDIO_SCHEMA_VERSION) throw new StudioNewerSongError(version)
  let song = raw as SongDocument
  for (let from = version; from < STUDIO_SCHEMA_VERSION; from++)
    song = STEPS[from - 1](song)
  return song
}
