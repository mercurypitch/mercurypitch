// ============================================================
// Piano Night music source — lazy, failure-bearing local catalogue boundary
// ============================================================
//
// Piano Night discovers canonical projects and lightweight compositions only
// after an explicit library gesture. MIDI parsing and device persistence stay
// behind dynamic imports so opening the standalone room keeps its small boot
// path, while successful imports are never exposed before their durable save.

import type { LegacyPianoMigrationResult, LegacyPianoMigrationStatus, PianoLibraryResult, } from '@/db/services/piano-library-service'
import type { PianoComposition, PianoCompositionLibraryResult, PianoCompositionStorage, } from '@/features/piano-project/piano-composition-stage'
import type { PianoProject } from '@/features/piano-project/piano-project'

export type PianoNightMusicCatalogIssueCode =
  | 'legacy-rows-skipped'
  | 'legacy-duplicates-skipped'
  | 'legacy-library-malformed'
  | 'legacy-library-unavailable'
  | 'legacy-migration-storage-full'
  | 'legacy-migration-failed'
  | 'project-records-skipped'
  | 'project-library-unavailable'
  | 'composition-rows-skipped'
  | 'composition-notes-skipped'
  | 'composition-library-malformed'
  | 'composition-library-unavailable'

export interface PianoNightMusicCatalogIssue {
  readonly code: PianoNightMusicCatalogIssueCode
  readonly message: string
  readonly count: number
}

export interface PianoNightMusicProjectEntry {
  readonly project: PianoProject
  /** Session-only projects remain playable when legacy persistence failed. */
  readonly persistence: 'saved' | 'session-only'
}

export interface PianoNightMusicSkippedCounts {
  readonly projectRecords: number
  readonly legacyRows: number
  readonly legacyDuplicates: number
  readonly compositionRows: number
  readonly compositionNotes: number
}

export interface PianoNightMusicSourceStatus {
  readonly migration: LegacyPianoMigrationStatus
  readonly projects: 'ready' | 'unavailable'
  readonly compositions: PianoCompositionLibraryResult['status']
}

export interface PianoNightMusicCatalog {
  readonly projects: readonly PianoNightMusicProjectEntry[]
  readonly compositions: readonly PianoComposition[]
  readonly issues: readonly PianoNightMusicCatalogIssue[]
  readonly skipped: PianoNightMusicSkippedCounts
  readonly sourceStatus: PianoNightMusicSourceStatus
}

export type PianoNightMusicCatalogResult =
  | {
      readonly ok: true
      readonly status: 'ready' | 'empty' | 'partial'
      readonly value: PianoNightMusicCatalog
    }
  | {
      readonly ok: false
      readonly status: 'unavailable'
      readonly code: 'music-library-unavailable'
      readonly message: string
      readonly value: PianoNightMusicCatalog
    }

export type PianoNightMidiImportFailureCode =
  | 'cancelled'
  | 'no-notes'
  | 'file-too-large'
  | 'unsupported-format'
  | 'unsupported-timing'
  | 'too-complex'
  | 'timed-out'
  | 'worker-unavailable'
  | 'invalid-midi'
  | 'invalid-project'
  | 'storage-full'
  | 'storage-unavailable'

export type PianoNightMidiImportResult =
  | { readonly ok: true; readonly project: PianoProject }
  | {
      readonly ok: false
      readonly code: PianoNightMidiImportFailureCode
      readonly message: string
    }

export type PianoNightTrackSelectionResult =
  | { readonly ok: true; readonly project: PianoProject }
  | {
      readonly ok: false
      readonly code:
        | 'invalid-selection'
        | 'project-not-found'
        | 'storage-full'
        | 'storage-unavailable'
      readonly message: string
    }

export interface PianoNightMidiImportOptions {
  readonly signal?: AbortSignal
}

export interface PianoNightMusicCatalogOptions {
  /** Null explicitly represents a browser where localStorage is unavailable. */
  readonly storage?: Storage | null
}

export interface PianoNightMusicSourceDependencies {
  migrateLegacyProjects(storage: Storage): Promise<LegacyPianoMigrationResult>
  listProjects(): Promise<PianoLibraryResult<PianoProject[]>>
  readCompositions(
    storage: PianoCompositionStorage,
  ): PianoCompositionLibraryResult | Promise<PianoCompositionLibraryResult>
  importProject(
    file: File,
    options: PianoNightMidiImportOptions,
  ): Promise<PianoProject>
  saveProject(project: PianoProject): Promise<PianoLibraryResult<PianoProject>>
  updateProjectSelection(
    id: string,
    scoreTrackId: string,
    backingTrackIds: readonly string[],
  ): Promise<PianoLibraryResult<PianoProject>>
}

export interface PianoNightMusicSource {
  loadCatalog(
    options?: PianoNightMusicCatalogOptions,
  ): Promise<PianoNightMusicCatalogResult>
  importMidi(
    file: File,
    options?: PianoNightMidiImportOptions,
  ): Promise<PianoNightMidiImportResult>
  updateProjectSelection(
    projectId: string,
    scoreTrackId: string,
    backingTrackIds: readonly string[],
  ): Promise<PianoNightTrackSelectionResult>
}

const CATALOG_UNAVAILABLE_MESSAGE =
  'Your Piano music library could not be read on this device.'

const DEFAULT_DEPENDENCIES: PianoNightMusicSourceDependencies = {
  async migrateLegacyProjects(storage) {
    const { migrateLegacyMidiProjects } =
      await import('@/db/services/piano-library-service')
    return migrateLegacyMidiProjects(storage)
  },
  async listProjects() {
    const { listPianoProjects } =
      await import('@/db/services/piano-library-service')
    return listPianoProjects()
  },
  async readCompositions(storage) {
    const { readPianoCompositions } =
      await import('@/features/piano-project/piano-composition-stage')
    return readPianoCompositions(storage)
  },
  async importProject(file, options) {
    const { importPianoProject } =
      await import('@/features/piano-project/piano-project-import-client')
    return importPianoProject(file, options)
  },
  async saveProject(project) {
    const { savePianoProject } =
      await import('@/db/services/piano-library-service')
    return savePianoProject(project)
  },
  async updateProjectSelection(id, scoreTrackId, backingTrackIds) {
    const { updatePianoProjectSelection } =
      await import('@/db/services/piano-library-service')
    return updatePianoProjectSelection(id, scoreTrackId, backingTrackIds)
  },
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function unavailableMigration(): LegacyPianoMigrationResult {
  return {
    status: 'unavailable',
    imported: 0,
    alreadyPresent: 0,
    skippedRows: 0,
    duplicateRows: 0,
    fallbackProjects: [],
    quotaExceeded: false,
  }
}

function unavailableCompositions(): PianoCompositionLibraryResult {
  return {
    status: 'unavailable',
    compositions: [],
    skippedRows: 0,
    skippedItems: 0,
    error: undefined,
  }
}

async function migrateLegacySafely(
  dependencies: PianoNightMusicSourceDependencies,
  storage: Storage | null,
): Promise<LegacyPianoMigrationResult> {
  if (storage === null) return unavailableMigration()
  try {
    return await dependencies.migrateLegacyProjects(storage)
  } catch {
    return unavailableMigration()
  }
}

async function listProjectsSafely(
  dependencies: PianoNightMusicSourceDependencies,
): Promise<PianoLibraryResult<PianoProject[]>> {
  try {
    return await dependencies.listProjects()
  } catch {
    return { ok: false, code: 'storage-unavailable' }
  }
}

async function readCompositionsSafely(
  dependencies: PianoNightMusicSourceDependencies,
  storage: Storage | null,
): Promise<PianoCompositionLibraryResult> {
  if (storage === null) return unavailableCompositions()
  try {
    return await dependencies.readCompositions(storage)
  } catch {
    return unavailableCompositions()
  }
}

function issue(
  code: PianoNightMusicCatalogIssueCode,
  message: string,
  count = 1,
): PianoNightMusicCatalogIssue {
  return Object.freeze({ code, message, count })
}

function migrationIssues(
  migration: LegacyPianoMigrationResult,
): PianoNightMusicCatalogIssue[] {
  const issues: PianoNightMusicCatalogIssue[] = []
  if (migration.status === 'malformed') {
    issues.push(
      issue(
        'legacy-library-malformed',
        'Some older MIDI library data could not be read.',
      ),
    )
  } else if (migration.status === 'unavailable') {
    issues.push(
      issue(
        'legacy-library-unavailable',
        'The older MIDI library is unavailable on this device.',
      ),
    )
  } else if (migration.status === 'failed') {
    issues.push(
      migration.quotaExceeded
        ? issue(
            'legacy-migration-storage-full',
            'Older MIDI projects are available for this session but device storage is full.',
          )
        : issue(
            'legacy-migration-failed',
            'Older MIDI projects could not be saved to the Piano library.',
          ),
    )
  }
  if (migration.skippedRows > 0) {
    issues.push(
      issue(
        'legacy-rows-skipped',
        'Some older MIDI projects were skipped because their data was invalid.',
        migration.skippedRows,
      ),
    )
  }
  if (migration.duplicateRows > 0) {
    issues.push(
      issue(
        'legacy-duplicates-skipped',
        'Duplicate older MIDI projects were skipped.',
        migration.duplicateRows,
      ),
    )
  }
  return issues
}

function projectIssues(
  result: PianoLibraryResult<PianoProject[]>,
): PianoNightMusicCatalogIssue[] {
  if (!result.ok) {
    return [
      issue(
        'project-library-unavailable',
        'Saved Piano projects are unavailable on this device.',
      ),
    ]
  }
  const skipped = result.skippedRecords ?? 0
  return skipped > 0
    ? [
        issue(
          'project-records-skipped',
          'Some saved Piano projects were skipped because their data was invalid.',
          skipped,
        ),
      ]
    : []
}

function compositionIssues(
  result: PianoCompositionLibraryResult,
): PianoNightMusicCatalogIssue[] {
  const issues: PianoNightMusicCatalogIssue[] = []
  if (result.status === 'malformed') {
    issues.push(
      issue(
        'composition-library-malformed',
        'The MercuryPitch composition library contains unreadable data.',
      ),
    )
  } else if (result.status === 'unavailable') {
    issues.push(
      issue(
        'composition-library-unavailable',
        'The MercuryPitch composition library is unavailable on this device.',
      ),
    )
  }
  if (result.skippedRows > 0) {
    issues.push(
      issue(
        'composition-rows-skipped',
        'Some MercuryPitch compositions were skipped because their data was invalid.',
        result.skippedRows,
      ),
    )
  }
  if (result.skippedItems > 0) {
    issues.push(
      issue(
        'composition-notes-skipped',
        'Some invalid notes were skipped while loading MercuryPitch compositions.',
        result.skippedItems,
      ),
    )
  }
  return issues
}

function projectSourceHash(project: PianoProject): string {
  if (project.source.kind === 'midi') return project.source.sha256
  if (project.source.kind === 'legacy-midi') return project.source.sourceHash
  return project.source.contentHash
}

function mergeProjects(
  savedProjects: readonly PianoProject[],
  fallbackProjects: readonly PianoProject[],
): PianoNightMusicProjectEntry[] {
  const entries: PianoNightMusicProjectEntry[] = []
  const ids = new Set<string>()
  const sourceHashes = new Set<string>()

  const append = (
    project: PianoProject,
    persistence: PianoNightMusicProjectEntry['persistence'],
  ): void => {
    const sourceHash = projectSourceHash(project)
    if (ids.has(project.id) || sourceHashes.has(sourceHash)) return
    ids.add(project.id)
    sourceHashes.add(sourceHash)
    entries.push(Object.freeze({ project, persistence }))
  }

  for (const project of savedProjects) append(project, 'saved')
  for (const project of fallbackProjects) append(project, 'session-only')
  return entries
}

function skippedCounts(
  migration: LegacyPianoMigrationResult,
  projects: PianoLibraryResult<PianoProject[]>,
  compositions: PianoCompositionLibraryResult,
): PianoNightMusicSkippedCounts {
  return Object.freeze({
    projectRecords: projects.ok ? (projects.skippedRecords ?? 0) : 0,
    legacyRows: migration.skippedRows,
    legacyDuplicates: migration.duplicateRows,
    compositionRows: compositions.skippedRows,
    compositionNotes: compositions.skippedItems,
  })
}

function isCompositionReadAvailable(
  result: PianoCompositionLibraryResult,
): boolean {
  return (
    result.status === 'ready' ||
    result.status === 'empty' ||
    result.status === 'absent'
  )
}

function importFailure(
  code: PianoNightMidiImportFailureCode,
  message: string,
): PianoNightMidiImportResult {
  return { ok: false, code, message }
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null
  }
  return typeof error.code === 'string' ? error.code : null
}

function errorName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return null
  }
  return typeof error.name === 'string' ? error.name : null
}

function mapImportFailure(error: unknown): PianoNightMidiImportResult {
  if (errorName(error) === 'AbortError') {
    return importFailure('cancelled', 'MIDI import was cancelled.')
  }

  const code = errorCode(error)
  if (code === 'NO_NOTES') {
    return importFailure(
      'no-notes',
      'This MIDI file has no playable piano notes.',
    )
  }
  if (code === 'FILE_TOO_LARGE') {
    return importFailure(
      'file-too-large',
      'This MIDI file is too large. Choose a file smaller than 20 MB.',
    )
  }
  if (code === 'UNSUPPORTED_FORMAT') {
    return importFailure(
      'unsupported-format',
      'MIDI Format 2 is not supported. Export Format 0 or 1.',
    )
  }
  if (code === 'UNSUPPORTED_TIME_DIVISION') {
    return importFailure(
      'unsupported-timing',
      'This MIDI uses SMPTE timing. Export it with PPQ timing.',
    )
  }
  if (
    code === 'TOO_MANY_TRACKS' ||
    code === 'TOO_MANY_EVENTS' ||
    code === 'EVENT_PAYLOAD_TOO_LARGE' ||
    code === 'AGGREGATE_PAYLOAD_TOO_LARGE' ||
    code === 'TICK_LIMIT_EXCEEDED'
  ) {
    return importFailure(
      'too-complex',
      'This MIDI file is too complex to import safely.',
    )
  }
  if (code === 'TIMED_OUT') {
    return importFailure(
      'timed-out',
      'MIDI import took too long. Try a smaller file.',
    )
  }
  if (code === 'WORKER_FAILED') {
    return importFailure(
      'worker-unavailable',
      'MIDI import could not start in this browser.',
    )
  }
  return importFailure(
    'invalid-midi',
    'This file is not a supported or complete MIDI file.',
  )
}

function mapSaveFailure(
  result: Extract<PianoLibraryResult<PianoProject>, { ok: false }>,
): PianoNightMidiImportResult {
  if (result.code === 'quota-exceeded') {
    return importFailure(
      'storage-full',
      'The MIDI was read but could not be saved because device storage is full.',
    )
  }
  if (result.code === 'invalid-project') {
    return importFailure(
      'invalid-project',
      'The imported MIDI did not produce a valid Piano project.',
    )
  }
  return importFailure(
    'storage-unavailable',
    'The MIDI was read but could not be saved on this device.',
  )
}

function mapSelectionFailure(
  result: Extract<PianoLibraryResult<PianoProject>, { ok: false }>,
): PianoNightTrackSelectionResult {
  if (result.code === 'quota-exceeded') {
    return {
      ok: false,
      code: 'storage-full',
      message:
        'Track choices could not be saved because device storage is full.',
    }
  }
  if (result.code === 'invalid-project') {
    return {
      ok: false,
      code: 'invalid-selection',
      message: 'Choose one playable Score track and pitched Hear tracks only.',
    }
  }
  if (result.code === 'not-found') {
    return {
      ok: false,
      code: 'project-not-found',
      message: 'This project is no longer in the Piano library.',
    }
  }
  return {
    ok: false,
    code: 'storage-unavailable',
    message: 'Track choices could not be saved on this device.',
  }
}

/** Create an injectable, route-neutral source for Piano Night music data. */
export function createPianoNightMusicSource(
  overrides: Partial<PianoNightMusicSourceDependencies> = {},
): PianoNightMusicSource {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }

  const loadCatalog = async (
    options: PianoNightMusicCatalogOptions = {},
  ): Promise<PianoNightMusicCatalogResult> => {
    const storage =
      options.storage === undefined ? browserStorage() : options.storage

    // Listing follows migration so newly migrated projects are included in
    // the canonical IndexedDB result rather than being shown twice.
    const migration = await migrateLegacySafely(dependencies, storage)
    const projects = await listProjectsSafely(dependencies)
    const compositions = await readCompositionsSafely(dependencies, storage)
    const entries = mergeProjects(
      projects.ok ? projects.value : [],
      migration.fallbackProjects,
    )
    const issues = [
      ...migrationIssues(migration),
      ...projectIssues(projects),
      ...compositionIssues(compositions),
    ]
    const catalog: PianoNightMusicCatalog = Object.freeze({
      projects: Object.freeze(entries),
      compositions: Object.freeze([...compositions.compositions]),
      issues: Object.freeze(issues),
      skipped: skippedCounts(migration, projects, compositions),
      sourceStatus: Object.freeze({
        migration: migration.status,
        projects: projects.ok ? 'ready' : 'unavailable',
        compositions: compositions.status,
      }),
    })
    const itemCount = entries.length + compositions.compositions.length
    const allPrimarySourcesUnavailable =
      !projects.ok && !isCompositionReadAvailable(compositions)

    if (allPrimarySourcesUnavailable && itemCount === 0) {
      return {
        ok: false,
        status: 'unavailable',
        code: 'music-library-unavailable',
        message: CATALOG_UNAVAILABLE_MESSAGE,
        value: catalog,
      }
    }
    if (issues.length > 0) {
      return { ok: true, status: 'partial', value: catalog }
    }
    return {
      ok: true,
      status: itemCount === 0 ? 'empty' : 'ready',
      value: catalog,
    }
  }

  const importMidi = async (
    file: File,
    options: PianoNightMidiImportOptions = {},
  ): Promise<PianoNightMidiImportResult> => {
    if (isSignalAborted(options.signal)) {
      return importFailure('cancelled', 'MIDI import was cancelled.')
    }

    let project: PianoProject
    try {
      project = await dependencies.importProject(file, options)
    } catch (error) {
      return mapImportFailure(error)
    }
    if (isSignalAborted(options.signal)) {
      return importFailure('cancelled', 'MIDI import was cancelled.')
    }

    let saved: PianoLibraryResult<PianoProject>
    try {
      saved = await dependencies.saveProject(project)
    } catch {
      return importFailure(
        'storage-unavailable',
        'The MIDI was read but could not be saved on this device.',
      )
    }
    return saved.ok ? { ok: true, project: saved.value } : mapSaveFailure(saved)
  }

  const updateProjectSelection = async (
    projectId: string,
    scoreTrackId: string,
    backingTrackIds: readonly string[],
  ): Promise<PianoNightTrackSelectionResult> => {
    let updated: PianoLibraryResult<PianoProject>
    try {
      updated = await dependencies.updateProjectSelection(
        projectId,
        scoreTrackId,
        backingTrackIds,
      )
    } catch {
      return {
        ok: false,
        code: 'storage-unavailable',
        message: 'Track choices could not be saved on this device.',
      }
    }
    return updated.ok
      ? { ok: true, project: updated.value }
      : mapSelectionFailure(updated)
  }

  return { loadCatalog, importMidi, updateProjectSelection }
}

const defaultMusicSource = createPianoNightMusicSource()

/** Load Piano Night's local catalogue without eagerly loading its readers. */
export function loadPianoNightMusicCatalog(
  options?: PianoNightMusicCatalogOptions,
): Promise<PianoNightMusicCatalogResult> {
  return defaultMusicSource.loadCatalog(options)
}

/** Parse and durably save one MIDI before making it available to Piano Night. */
export function importPianoNightMidi(
  file: File,
  options?: PianoNightMidiImportOptions,
): Promise<PianoNightMidiImportResult> {
  return defaultMusicSource.importMidi(file, options)
}
