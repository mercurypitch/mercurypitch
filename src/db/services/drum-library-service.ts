// ============================================================
// Drum Library Service — strict device-local projects and takes
// ============================================================
//
// Every read remains failure-bearing and every multi-row mutation is atomic.
// Unknown or corrupt rows are reported as skips and never rewritten by normal
// CRUD; the explicit phase reset is the only operation that clears both stores.

import type { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { durableWrite } from '@/db/durable-write'
import type { DrumProjectRecord, DrumTakeSummaryRecord } from '@/db/entities'
import { getLocalDatabase } from '@/db/local-database'
import type { DrumProject } from '@/features/drum-night/persistence/drum-project'
import { DRUM_PROJECT_LIMIT, DRUM_PROJECT_SOURCE_KIND, DRUM_PROJECT_SOURCE_REF, drumProjectContentFingerprint, validateDrumProject, } from '@/features/drum-night/persistence/drum-project'
import type { DrumTakeSummary } from '@/features/drum-night/persistence/drum-take-summary'
import { DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT, normalizeDrumTakeSummary, validateDrumTakeSummary, } from '@/features/drum-night/persistence/drum-take-summary'

const PROJECT_STORE = 'drumProjects'
const TAKE_STORE = 'drumTakeSummaries'

export type DrumLibraryFailureCode =
  | 'invalid-project'
  | 'invalid-summary'
  | 'not-found'
  | 'conflict'
  | 'project-limit'
  | 'quota-exceeded'
  | 'storage-unavailable'

export type DrumLibraryResult<T> =
  | {
      ok: true
      value: T
      skippedRecords?: number
      futureRecords?: number
    }
  | { ok: false; code: DrumLibraryFailureCode; error?: unknown }

export interface DrumLibraryService {
  listProjects(): Promise<DrumLibraryResult<DrumProject[]>>
  readProject(id: string): Promise<DrumLibraryResult<DrumProject>>
  createProject(project: DrumProject): Promise<DrumLibraryResult<DrumProject>>
  updateProject(
    id: string,
    expectedRevision: number,
    project: DrumProject,
  ): Promise<DrumLibraryResult<DrumProject>>
  deleteProject(id: string): Promise<DrumLibraryResult<void>>
  listTakeSummaries(
    projectId: string,
    limit?: number,
  ): Promise<DrumLibraryResult<DrumTakeSummary[]>>
  appendTakeSummary(
    summary: DrumTakeSummary,
  ): Promise<DrumLibraryResult<DrumTakeSummary>>
  clearTakeSummaries(projectId: string): Promise<DrumLibraryResult<void>>
  /** Privacy reset for Drum Night only; no other settings or stores change. */
  eraseAll(): Promise<DrumLibraryResult<void>>
}

export interface DrumLibraryServiceDependencies {
  readonly database: () => DexieAdapter
  readonly now: () => Date
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => key in value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

function projectRecord(project: DrumProject): DrumProjectRecord<DrumProject> {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceKind: DRUM_PROJECT_SOURCE_KIND,
    sourceRef: DRUM_PROJECT_SOURCE_REF,
    project,
  }
}

function projectFromRecord(record: DrumProjectRecord): DrumProject | null {
  if (
    !hasExactKeys(record, [
      'id',
      'createdAt',
      'updatedAt',
      'sourceKind',
      'sourceRef',
      'project',
    ])
  ) {
    return null
  }
  try {
    const project = validateDrumProject(record.project)
    if (
      record.id !== project.id ||
      record.createdAt !== project.createdAt ||
      record.updatedAt !== project.updatedAt ||
      record.sourceKind !== project.source.kind ||
      record.sourceRef !== DRUM_PROJECT_SOURCE_REF
    ) {
      return null
    }
    return project
  } catch {
    return null
  }
}

function takeRecord(
  summary: DrumTakeSummary,
): DrumTakeSummaryRecord<DrumTakeSummary> {
  return {
    id: summary.id,
    createdAt: summary.completedAt,
    updatedAt: summary.completedAt,
    projectId: summary.projectId,
    completedAt: summary.completedAt,
    summary,
  }
}

function summaryFromRecord(
  record: DrumTakeSummaryRecord,
): DrumTakeSummary | null {
  if (
    !hasExactKeys(record, [
      'id',
      'createdAt',
      'updatedAt',
      'projectId',
      'completedAt',
      'summary',
    ])
  ) {
    return null
  }
  try {
    const summary = validateDrumTakeSummary(record.summary)
    if (
      record.id !== summary.id ||
      record.createdAt !== summary.completedAt ||
      record.updatedAt !== summary.completedAt ||
      record.projectId !== summary.projectId ||
      record.completedAt !== summary.completedAt
    ) {
      return null
    }
    return summary
  } catch {
    return null
  }
}

function failureCode(quotaExceeded: boolean): DrumLibraryFailureCode {
  return quotaExceeded ? 'quota-exceeded' : 'storage-unavailable'
}

function hasFutureSchema(value: unknown, currentVersion: number): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number' &&
    Number.isSafeInteger(value.schemaVersion) &&
    value.schemaVersion > currentVersion
  )
}

function readProjects(records: readonly DrumProjectRecord[]): {
  readonly projects: DrumProject[]
  readonly skipped: number
  readonly future: number
} {
  const projects: DrumProject[] = []
  let skipped = 0
  let future = 0
  for (const record of records) {
    const project = projectFromRecord(record)
    if (project === null) {
      if (hasFutureSchema(record.project, 1)) future += 1
      else skipped += 1
    } else projects.push(project)
  }
  projects.sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  )
  return { projects, skipped, future }
}

function readSummaries(records: readonly DrumTakeSummaryRecord[]): {
  readonly summaries: DrumTakeSummary[]
  readonly skipped: number
  readonly future: number
} {
  const summaries: DrumTakeSummary[] = []
  let skipped = 0
  let future = 0
  for (const record of records) {
    const summary = summaryFromRecord(record)
    if (summary === null) {
      if (hasFutureSchema(record.summary, 1)) future += 1
      else skipped += 1
    } else summaries.push(summary)
  }
  summaries.sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      left.id.localeCompare(right.id),
  )
  return { summaries, skipped, future }
}

function monotonicTimestamp(previous: string, now: Date): string {
  const candidate = now.toISOString()
  return candidate < previous ? previous : candidate
}

function boundedListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT
  }
  return Math.min(
    DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT,
    Math.max(1, Math.trunc(limit)),
  )
}

export function createDrumLibraryService(
  dependencies: DrumLibraryServiceDependencies = {
    database: getLocalDatabase,
    now: () => new Date(),
  },
): DrumLibraryService {
  const listProjects = async (): Promise<DrumLibraryResult<DrumProject[]>> => {
    try {
      const records = await dependencies
        .database()
        .readAllStrict<DrumProjectRecord>(PROJECT_STORE)
      const { projects, skipped, future } = readProjects(records)
      const value = projects.slice(0, DRUM_PROJECT_LIMIT)
      return {
        ok: true,
        value,
        skippedRecords: skipped + projects.length - value.length,
        futureRecords: future,
      }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }
  }

  const readProject = async (
    id: string,
  ): Promise<DrumLibraryResult<DrumProject>> => {
    if (!validId(id)) return { ok: false, code: 'not-found' }
    try {
      const record = await dependencies
        .database()
        .readByIdStrict<DrumProjectRecord>(PROJECT_STORE, id)
      if (record === undefined) return { ok: false, code: 'not-found' }
      const project = projectFromRecord(record)
      return project === null
        ? { ok: false, code: 'invalid-project' }
        : { ok: true, value: project }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }
  }

  const createProject = async (
    untrustedProject: DrumProject,
  ): Promise<DrumLibraryResult<DrumProject>> => {
    let project: DrumProject
    try {
      project = validateDrumProject(untrustedProject)
    } catch (error) {
      return { ok: false, code: 'invalid-project', error }
    }
    if (project.revision !== 0) {
      return { ok: false, code: 'invalid-project' }
    }
    const database = dependencies.database()
    const write = await durableWrite('create Drum Night project', () =>
      database.transaction(async () => {
        const records =
          await database.readAllStrict<DrumProjectRecord>(PROJECT_STORE)
        if (records.some((record) => record.id === project.id)) {
          return { status: 'conflict' as const }
        }
        if (readProjects(records).projects.length >= DRUM_PROJECT_LIMIT) {
          return { status: 'project-limit' as const }
        }
        await database.addStrict(PROJECT_STORE, projectRecord(project))
        return { status: 'created' as const }
      }),
    )
    if (!write.ok || write.value === undefined) {
      return {
        ok: false,
        code: failureCode(write.quotaExceeded),
        error: write.error,
      }
    }
    return write.value.status === 'created'
      ? { ok: true, value: project }
      : { ok: false, code: write.value.status }
  }

  const updateProject = async (
    id: string,
    expectedRevision: number,
    untrustedProject: DrumProject,
  ): Promise<DrumLibraryResult<DrumProject>> => {
    let requested: DrumProject
    try {
      requested = validateDrumProject(untrustedProject)
    } catch (error) {
      return { ok: false, code: 'invalid-project', error }
    }
    if (
      !validId(id) ||
      requested.id !== id ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      requested.revision !== expectedRevision ||
      expectedRevision === Number.MAX_SAFE_INTEGER
    ) {
      return { ok: false, code: 'conflict' }
    }
    const database = dependencies.database()
    const write = await durableWrite('update Drum Night project', () =>
      database.transaction(async () => {
        const record = await database.readByIdStrict<DrumProjectRecord>(
          PROJECT_STORE,
          id,
        )
        if (record === undefined) return { status: 'not-found' as const }
        const current = projectFromRecord(record)
        if (current === null) return { status: 'invalid-project' as const }
        if (current.revision !== expectedRevision) {
          return { status: 'conflict' as const }
        }
        let updated: DrumProject
        try {
          updated = validateDrumProject({
            ...requested,
            id: current.id,
            revision: current.revision + 1,
            createdAt: current.createdAt,
            updatedAt: monotonicTimestamp(
              current.updatedAt,
              dependencies.now(),
            ),
          })
        } catch {
          return { status: 'invalid-project' as const }
        }
        await database.putStrict(PROJECT_STORE, projectRecord(updated))
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
    return write.value.status === 'updated'
      ? { ok: true, value: write.value.project }
      : { ok: false, code: write.value.status }
  }

  const deleteProject = async (
    id: string,
  ): Promise<DrumLibraryResult<void>> => {
    if (!validId(id)) return { ok: false, code: 'not-found' }
    const database = dependencies.database()
    const write = await durableWrite('delete Drum Night project', () =>
      database.transaction(async () => {
        const record = await database.readByIdStrict<DrumProjectRecord>(
          PROJECT_STORE,
          id,
        )
        if (record === undefined) return { status: 'not-found' as const }
        if (projectFromRecord(record) === null) {
          return { status: 'invalid-project' as const }
        }
        const takeRecords =
          await database.readByIndexStrict<DrumTakeSummaryRecord>(
            TAKE_STORE,
            'projectId',
            id,
          )
        await database.deleteByIdStrict(PROJECT_STORE, id)
        for (const takeRecord of takeRecords) {
          await database.deleteByIdStrict(TAKE_STORE, takeRecord.id)
        }
        return { status: 'deleted' as const }
      }),
    )
    if (!write.ok || write.value === undefined) {
      return {
        ok: false,
        code: failureCode(write.quotaExceeded),
        error: write.error,
      }
    }
    return write.value.status === 'deleted'
      ? { ok: true, value: undefined }
      : { ok: false, code: write.value.status }
  }

  const listTakeSummaries = async (
    projectId: string,
    limit?: number,
  ): Promise<DrumLibraryResult<DrumTakeSummary[]>> => {
    if (!validId(projectId)) return { ok: false, code: 'not-found' }
    try {
      const database = dependencies.database()
      const projectRecordValue =
        await database.readByIdStrict<DrumProjectRecord>(
          PROJECT_STORE,
          projectId,
        )
      if (projectRecordValue === undefined) {
        return { ok: false, code: 'not-found' }
      }
      if (projectFromRecord(projectRecordValue) === null) {
        return { ok: false, code: 'invalid-project' }
      }
      const records = await database.readByIndexStrict<DrumTakeSummaryRecord>(
        TAKE_STORE,
        'projectId',
        projectId,
      )
      const { summaries, skipped, future } = readSummaries(records)
      return {
        ok: true,
        value: summaries.slice(0, boundedListLimit(limit)),
        skippedRecords: skipped,
        futureRecords: future,
      }
    } catch (error) {
      return { ok: false, code: 'storage-unavailable', error }
    }
  }

  const appendTakeSummary = async (
    untrustedSummary: DrumTakeSummary,
  ): Promise<DrumLibraryResult<DrumTakeSummary>> => {
    let summary: DrumTakeSummary
    try {
      summary = normalizeDrumTakeSummary(untrustedSummary)
    } catch (error) {
      return { ok: false, code: 'invalid-summary', error }
    }
    const database = dependencies.database()
    const write = await durableWrite('append Drum Night take summary', () =>
      database.transaction(async () => {
        const projectRecordValue =
          await database.readByIdStrict<DrumProjectRecord>(
            PROJECT_STORE,
            summary.projectId,
          )
        if (projectRecordValue === undefined) {
          return { status: 'not-found' as const }
        }
        const project = projectFromRecord(projectRecordValue)
        if (project === null) return { status: 'invalid-project' as const }
        const durationBeats = project.variants[summary.variationId].barCount * 4
        if (
          summary.projectRevision !== project.revision ||
          summary.projectFingerprint !==
            drumProjectContentFingerprint(project) ||
          summary.endBeat > durationBeats
        ) {
          return { status: 'invalid-summary' as const }
        }
        const records = await database.readByIndexStrict<DrumTakeSummaryRecord>(
          TAKE_STORE,
          'projectId',
          summary.projectId,
        )
        if (records.some((record) => record.id === summary.id)) {
          return { status: 'conflict' as const }
        }
        const validRecords = records.filter(
          (record) => summaryFromRecord(record) !== null,
        )
        const nextRecord = takeRecord(summary)
        await database.addStrict(TAKE_STORE, nextRecord)
        const orderedOldest = [...validRecords, nextRecord].sort(
          (left, right) =>
            left.completedAt.localeCompare(right.completedAt) ||
            left.id.localeCompare(right.id),
        )
        const excess = Math.max(
          0,
          orderedOldest.length - DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT,
        )
        for (const obsolete of orderedOldest.slice(0, excess)) {
          await database.deleteByIdStrict(TAKE_STORE, obsolete.id)
        }
        return { status: 'appended' as const }
      }),
    )
    if (!write.ok || write.value === undefined) {
      return {
        ok: false,
        code: failureCode(write.quotaExceeded),
        error: write.error,
      }
    }
    return write.value.status === 'appended'
      ? { ok: true, value: summary }
      : { ok: false, code: write.value.status }
  }

  const clearTakeSummaries = async (
    projectId: string,
  ): Promise<DrumLibraryResult<void>> => {
    if (!validId(projectId)) return { ok: false, code: 'not-found' }
    const database = dependencies.database()
    const write = await durableWrite('clear Drum Night take summaries', () =>
      database.transaction(async () => {
        const projectRecordValue =
          await database.readByIdStrict<DrumProjectRecord>(
            PROJECT_STORE,
            projectId,
          )
        if (projectRecordValue === undefined) {
          return { status: 'not-found' as const, skipped: 0, future: 0 }
        }
        if (projectFromRecord(projectRecordValue) === null) {
          return {
            status: 'invalid-project' as const,
            skipped: 0,
            future: 0,
          }
        }
        const records = await database.readByIndexStrict<DrumTakeSummaryRecord>(
          TAKE_STORE,
          'projectId',
          projectId,
        )
        let skipped = 0
        let future = 0
        for (const record of records) {
          if (summaryFromRecord(record) === null) {
            if (hasFutureSchema(record.summary, 1)) future += 1
            else skipped += 1
          } else await database.deleteByIdStrict(TAKE_STORE, record.id)
        }
        return { status: 'cleared' as const, skipped, future }
      }),
    )
    if (!write.ok || write.value === undefined) {
      return {
        ok: false,
        code: failureCode(write.quotaExceeded),
        error: write.error,
      }
    }
    return write.value.status === 'cleared'
      ? {
          ok: true,
          value: undefined,
          skippedRecords: write.value.skipped,
          futureRecords: write.value.future,
        }
      : { ok: false, code: write.value.status }
  }

  const eraseAll = async (): Promise<DrumLibraryResult<void>> => {
    const database = dependencies.database()
    const write = await durableWrite('erase all Drum Night data', () =>
      database.transaction(async () => {
        await database.clearStrict(TAKE_STORE)
        await database.clearStrict(PROJECT_STORE)
      }),
    )
    return write.ok
      ? { ok: true, value: undefined }
      : {
          ok: false,
          code: failureCode(write.quotaExceeded),
          error: write.error,
        }
  }

  return {
    listProjects,
    readProject,
    createProject,
    updateProject,
    deleteProject,
    listTakeSummaries,
    appendTakeSummary,
    clearTakeSummaries,
    eraseAll,
  }
}
