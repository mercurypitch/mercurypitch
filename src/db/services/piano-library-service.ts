// ============================================================
// Piano Library Service — strict device-local project persistence
// ============================================================
//
// Piano projects never route through the cloud adapter. Reads remain
// failure-bearing, and a migrated project plus its unique completion marker
// share one IndexedDB transaction so neither can outlive a failed counterpart.

import type { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { durableWrite } from '@/db/durable-write'
import type { PianoProjectMigrationRecord, PianoProjectRecord, } from '@/db/entities'
import { getLocalDatabase } from '@/db/local-database'
import type { LegacyMidiMigrationCandidate } from '@/features/piano-project/legacy-midi-migration'
import { createLegacyMidiMigrationCandidates, readLegacyMidiSongs, } from '@/features/piano-project/legacy-midi-migration'
import type { PianoProject } from '@/features/piano-project/piano-project'
import { validatePianoProject } from '@/features/piano-project/piano-project'

const PROJECT_STORE = 'pianoProjects'
const MIGRATION_STORE = 'pianoProjectMigrations'

export type PianoLibraryFailureCode =
  | 'invalid-project'
  | 'not-found'
  | 'quota-exceeded'
  | 'storage-unavailable'

export type PianoLibraryResult<T> =
  | { ok: true; value: T; skippedRecords?: number }
  | { ok: false; code: PianoLibraryFailureCode; error?: unknown }

export type LegacyPianoMigrationStatus =
  | 'complete'
  | 'complete-with-skips'
  | 'absent'
  | 'malformed'
  | 'unavailable'
  | 'failed'

export interface LegacyPianoMigrationResult {
  status: LegacyPianoMigrationStatus
  imported: number
  alreadyPresent: number
  skippedRows: number
  duplicateRows: number
  fallbackProjects: PianoProject[]
  quotaExceeded: boolean
  error?: unknown
}

export interface PianoLibraryService {
  listProjects(): Promise<PianoLibraryResult<PianoProject[]>>
  readProject(id: string): Promise<PianoLibraryResult<PianoProject>>
  saveProject(project: PianoProject): Promise<PianoLibraryResult<PianoProject>>
  updateProjectSelection(
    id: string,
    scoreTrackId: string,
    backingTrackIds: readonly string[],
  ): Promise<PianoLibraryResult<PianoProject>>
  deleteProject(id: string): Promise<PianoLibraryResult<void>>
  migrateLegacyProjects(storage: Storage): Promise<LegacyPianoMigrationResult>
}

export interface PianoLibraryServiceDependencies {
  database: () => DexieAdapter
  now: () => Date
}

function sourceHash(project: PianoProject): string {
  return project.source.kind === 'midi'
    ? project.source.sha256
    : project.source.sourceHash
}

function toRecord(project: PianoProject): PianoProjectRecord<PianoProject> {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    sourceHash: sourceHash(project),
    project,
  }
}

function projectFromRecord(record: PianoProjectRecord): PianoProject | null {
  try {
    const project = validatePianoProject(record.project)
    if (
      record.id !== project.id ||
      record.createdAt !== project.createdAt ||
      record.updatedAt !== project.updatedAt ||
      record.sourceKind !== project.source.kind ||
      record.sourceHash !== sourceHash(project)
    ) {
      return null
    }
    return project
  } catch {
    return null
  }
}

function failureCode(quotaExceeded: boolean): PianoLibraryFailureCode {
  return quotaExceeded ? 'quota-exceeded' : 'storage-unavailable'
}

function orderedProjects(records: readonly PianoProjectRecord[]): {
  projects: PianoProject[]
  skipped: number
} {
  const projects: PianoProject[] = []
  let skipped = 0
  for (const record of records) {
    const project = projectFromRecord(record)
    if (project === null) skipped += 1
    else projects.push(project)
  }
  projects.sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  )
  return { projects, skipped }
}

export function createPianoLibraryService(
  dependencies: PianoLibraryServiceDependencies = {
    database: getLocalDatabase,
    now: () => new Date(),
  },
): PianoLibraryService {
  const listProjects = async (): Promise<
    PianoLibraryResult<PianoProject[]>
  > => {
    try {
      const records = await dependencies
        .database()
        .readAllStrict<PianoProjectRecord>(PROJECT_STORE)
      const { projects, skipped } = orderedProjects(records)
      return { ok: true, value: projects, skippedRecords: skipped }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }
  }

  const readProject = async (
    id: string,
  ): Promise<PianoLibraryResult<PianoProject>> => {
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'not-found' }
    }
    try {
      const record = await dependencies
        .database()
        .readByIdStrict<PianoProjectRecord>(PROJECT_STORE, id)
      if (record === undefined) return { ok: false, code: 'not-found' }
      const project = projectFromRecord(record)
      return project === null
        ? { ok: false, code: 'invalid-project' }
        : { ok: true, value: project }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }
  }

  const saveProject = async (
    untrustedProject: PianoProject,
  ): Promise<PianoLibraryResult<PianoProject>> => {
    let project: PianoProject
    try {
      project = validatePianoProject(untrustedProject)
    } catch (error) {
      return { ok: false, code: 'invalid-project', error }
    }
    const write = await durableWrite('save Piano project', () =>
      dependencies.database().putStrict(PROJECT_STORE, toRecord(project)),
    )
    return write.ok
      ? { ok: true, value: project }
      : {
          ok: false,
          code: failureCode(write.quotaExceeded),
          error: write.error,
        }
  }

  const updateProjectSelection = async (
    id: string,
    scoreTrackId: string,
    backingTrackIds: readonly string[],
  ): Promise<PianoLibraryResult<PianoProject>> => {
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'not-found' }
    }
    const database = dependencies.database()
    const write = await durableWrite('update Piano project selection', () =>
      database.transaction(async () => {
        const record = await database.readByIdStrict<PianoProjectRecord>(
          PROJECT_STORE,
          id,
        )
        if (record === undefined) {
          return { status: 'not-found' as const }
        }
        const project = projectFromRecord(record)
        if (project === null) {
          return { status: 'invalid-project' as const }
        }

        const now = dependencies.now().toISOString()
        const candidate = {
          ...project,
          updatedAt: now < project.updatedAt ? project.updatedAt : now,
          scoreTrackId,
          backingTrackIds: [...backingTrackIds],
        }
        let updated: PianoProject
        try {
          updated = validatePianoProject(candidate)
        } catch {
          return { status: 'invalid-project' as const }
        }
        await database.putStrict(PROJECT_STORE, toRecord(updated))
        return { status: 'updated' as const, project: updated }
      }),
    )

    if (!write.ok || write.value === undefined) {
      return {
        ok: false,
        code: failureCode(write.quotaExceeded),
        error: write.error,
      }
    }
    if (write.value.status !== 'updated') {
      return { ok: false, code: write.value.status }
    }
    return { ok: true, value: write.value.project }
  }

  const deleteProject = async (
    id: string,
  ): Promise<PianoLibraryResult<void>> => {
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'not-found' }
    }
    const database = dependencies.database()
    try {
      if (
        (await database.readByIdStrict<PianoProjectRecord>(
          PROJECT_STORE,
          id,
        )) === undefined
      ) {
        return { ok: false, code: 'not-found' }
      }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }

    const write = await durableWrite('delete Piano project', async () => {
      await database.transaction(async () => {
        const markers =
          await database.readAllStrict<PianoProjectMigrationRecord>(
            MIGRATION_STORE,
          )
        await database.deleteByIdStrict(PROJECT_STORE, id)
        for (const marker of markers) {
          if (marker.projectId === id) {
            await database.deleteByIdStrict(MIGRATION_STORE, marker.id)
          }
        }
      })
    })
    return write.ok
      ? { ok: true, value: undefined }
      : {
          ok: false,
          code: failureCode(write.quotaExceeded),
          error: write.error,
        }
  }

  const migrateLegacyProjects = async (
    storage: Storage,
  ): Promise<LegacyPianoMigrationResult> => {
    const legacy = readLegacyMidiSongs(storage)
    const empty = {
      imported: 0,
      alreadyPresent: 0,
      skippedRows: legacy.skippedRows,
      duplicateRows: 0,
      fallbackProjects: [] as PianoProject[],
      quotaExceeded: false,
    }
    if (legacy.status === 'absent') return { ...empty, status: 'absent' }
    if (legacy.status === 'malformed') {
      return { ...empty, status: 'malformed', error: legacy.error }
    }
    if (legacy.status === 'unavailable') {
      return { ...empty, status: 'unavailable', error: legacy.error }
    }

    let candidates: LegacyMidiMigrationCandidate[]
    try {
      candidates = await createLegacyMidiMigrationCandidates(legacy.songs)
      for (const candidate of candidates) {
        validatePianoProject(candidate.project)
      }
    } catch (error) {
      return { ...empty, status: 'failed', error }
    }
    const duplicateRows = legacy.songs.length - candidates.length
    const database = dependencies.database()

    const write = await durableWrite(
      'migrate legacy Piano projects',
      async () => {
        // These reads belong inside the retry operation. A competing tab may
        // commit after attempt one; attempt two must observe its markers.
        const [records, markers] = await Promise.all([
          database.readAllStrict<PianoProjectRecord>(PROJECT_STORE),
          database.readAllStrict<PianoProjectMigrationRecord>(MIGRATION_STORE),
        ])
        const validRecords = records.flatMap((record) => {
          const project = projectFromRecord(record)
          return project === null ? [] : [{ record, project }]
        })
        const recordByHash = new Map<
          string,
          { record: PianoProjectRecord; project: PianoProject }
        >()
        for (const record of validRecords) {
          if (!recordByHash.has(record.record.sourceHash)) {
            recordByHash.set(record.record.sourceHash, record)
          }
        }
        const markerByKey = new Map(
          markers.map((marker) => [marker.migrationKey, marker]),
        )
        const recordById = new Map(
          validRecords.map((entry) => [entry.record.id, entry.record]),
        )
        let imported = 0
        let alreadyPresent = 0

        await database.transaction(async () => {
          for (const candidate of candidates) {
            const existingMarker = markerByKey.get(candidate.migrationKey)
            if (
              existingMarker !== undefined &&
              recordById.get(existingMarker.projectId)?.sourceHash ===
                candidate.sourceHash
            ) {
              alreadyPresent += 1
              continue
            }
            if (existingMarker !== undefined) {
              // Repair an impossible/stale marker without ever exposing a marker
              // that points at no committed project.
              await database.deleteByIdStrict(
                MIGRATION_STORE,
                existingMarker.id,
              )
            }

            const existingProject = recordByHash.get(candidate.sourceHash)
            const project = existingProject?.project ?? candidate.project
            if (existingProject === undefined) {
              await database.putStrict(PROJECT_STORE, toRecord(project))
              imported += 1
            } else {
              alreadyPresent += 1
            }

            const completedAt = dependencies.now().toISOString()
            await database.addStrict<PianoProjectMigrationRecord>(
              MIGRATION_STORE,
              {
                id: `piano-migration-${candidate.sourceHash}`,
                createdAt: completedAt,
                updatedAt: completedAt,
                migrationKey: candidate.migrationKey,
                projectId: project.id,
                sourceHash: candidate.sourceHash,
                completedAt,
              },
            )
          }
        })
        return { imported, alreadyPresent }
      },
    )

    if (!write.ok || write.value === undefined) {
      let persistedHashes = new Set<string>()
      try {
        const persisted =
          await database.readAllStrict<PianoProjectRecord>(PROJECT_STORE)
        persistedHashes = new Set(
          persisted
            .filter((record) => projectFromRecord(record) !== null)
            .map((record) => record.sourceHash),
        )
      } catch {
        // The validated legacy projects remain an honest load-only fallback.
      }
      return {
        ...empty,
        status: 'failed',
        skippedRows: legacy.skippedRows,
        duplicateRows,
        fallbackProjects: candidates
          .filter((candidate) => !persistedHashes.has(candidate.sourceHash))
          .map((candidate) => candidate.project),
        quotaExceeded: write.quotaExceeded,
        error: write.error,
      }
    }

    const hasSkips = legacy.skippedRows > 0 || duplicateRows > 0
    return {
      ...empty,
      status: hasSkips ? 'complete-with-skips' : 'complete',
      imported: write.value.imported,
      alreadyPresent: write.value.alreadyPresent,
      skippedRows: legacy.skippedRows,
      duplicateRows,
    }
  }

  return {
    listProjects,
    readProject,
    saveProject,
    updateProjectSelection,
    deleteProject,
    migrateLegacyProjects,
  }
}

const defaultService = createPianoLibraryService()

export const listPianoProjects = defaultService.listProjects
export const readPianoProject = defaultService.readProject
export const savePianoProject = defaultService.saveProject
export const updatePianoProjectSelection = defaultService.updateProjectSelection
export const deletePianoProject = defaultService.deleteProject
export const migrateLegacyMidiProjects = defaultService.migrateLegacyProjects
