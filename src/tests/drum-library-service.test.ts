// Drum Library Service tests — strict local CRUD, bounds and privacy resets.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { DrumProjectRecord, DrumTakeSummaryRecord } from '@/db/entities'
import { createDrumLibraryService } from '@/db/services/drum-library-service'
import type { DbEntity } from '@/db/types'
import { createEditableDrumGroove } from '@/features/drum-night/groove/groove-editor'
import type { DrumProject, DrumProjectSerializationInput, } from '@/features/drum-night/persistence/drum-project'
import { DRUM_PROJECT_SOURCE_KIND, DRUM_PROJECT_SOURCE_REF, drumProjectContentFingerprint, serializeDrumProject, validateDrumProject, } from '@/features/drum-night/persistence/drum-project'
import type { DrumTakeSummary } from '@/features/drum-night/persistence/drum-take-summary'
import type { FirstPocketVariantId } from '@/features/drum-night/session/prepared-grooves'
import { createFirstPocketGroove, FIRST_POCKET_VARIANTS, } from '@/features/drum-night/session/prepared-grooves'

function projectInput(
  id: string,
  overrides: Partial<DrumProjectSerializationInput> = {},
): DrumProjectSerializationInput {
  const drafts = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      createEditableDrumGroove(createFirstPocketGroove(variant.id).document),
    ]),
  ) as Record<FirstPocketVariantId, ReturnType<typeof createEditableDrumGroove>>
  return {
    id,
    title: id,
    revision: 0,
    createdAt: '2026-08-26T10:00:00.000Z',
    updatedAt: '2026-08-26T10:00:00.000Z',
    selectedVariantId: 'source',
    drafts,
    authoredFamilyMix: {
      kick: { level: 1, muted: false },
      snare: { level: 1, muted: false },
      hats: { level: 1, muted: false },
      toms: { level: 1, muted: false },
      cymbals: { level: 1, muted: false },
    },
    tempoBpm: 84,
    countInBeats: 4,
    clickEnabled: true,
    loopRange: null,
    ...overrides,
  }
}

function project(id = 'project-1'): DrumProject {
  return serializeDrumProject(projectInput(id))
}

function summary(
  value: DrumProject,
  index = 0,
  overrides: Partial<DrumTakeSummary> = {},
): DrumTakeSummary {
  return {
    schemaVersion: 1,
    id: `take-${String(index).padStart(3, '0')}`,
    projectId: value.id,
    projectRevision: value.revision,
    projectFingerprint: drumProjectContentFingerprint(value),
    completedAt: new Date(
      Date.parse('2026-08-26T11:00:00.000Z') + index * 1_000,
    ).toISOString(),
    variationId: 'source',
    startBeat: 0,
    endBeat: 8,
    tempoBpm: 84,
    speedScale: 1,
    inputSources: ['keyboard'],
    evidencePolicy: {
      version: 1,
      matchWindowMs: 120,
      centredWindowMs: 30,
      minimumConfidence: 0.55,
      minimumMatchedHits: 2,
    },
    status: 'ready',
    evidenceScope: 'timing-only',
    confidence: 0.9,
    targetHitCount: 2,
    capturedHitCount: 2,
    omittedCaptureHitCount: 0,
    matchedHitCount: 2,
    unmatchedTargetCount: 0,
    unmatchedCaptureCount: 0,
    uncertainTimingCount: 0,
    earlyCount: 0,
    centredCount: 2,
    lateCount: 0,
    meanTimingOffsetMs: 0,
    meanAbsoluteTimingOffsetMs: 0,
    meanVelocityOffset: null,
    meanAbsoluteVelocityOffset: null,
    recovery: null,
    ...overrides,
  }
}

function takeRecord(
  value: DrumTakeSummary,
): DrumTakeSummaryRecord<DrumTakeSummary> {
  return {
    id: value.id,
    createdAt: value.completedAt,
    updatedAt: value.completedAt,
    projectId: value.projectId,
    completedAt: value.completedAt,
    summary: value,
  }
}

describe('Drum Library Service', () => {
  let adapter: DexieAdapter
  let service: ReturnType<typeof createDrumLibraryService>

  beforeEach(() => {
    adapter = new DexieAdapter()
    service = createDrumLibraryService({
      database: () => adapter,
      now: () => new Date('2026-08-26T12:00:00.000Z'),
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await adapter.destroy()
  })

  it('creates, orders, reads and revision-checks project updates', async () => {
    const beta = project('beta')
    const alpha = project('alpha')
    expect(await service.createProject(beta)).toMatchObject({ ok: true })
    expect(await service.createProject(alpha)).toMatchObject({ ok: true })
    expect(await service.createProject(alpha)).toEqual({
      ok: false,
      code: 'conflict',
    })

    const listed = await service.listProjects()
    expect(listed.ok && listed.value.map((item) => item.id)).toEqual([
      'alpha',
      'beta',
    ])
    const requested = validateDrumProject({ ...alpha, title: 'Alpha edit' })
    const updated = await service.updateProject(
      alpha.id,
      alpha.revision,
      requested,
    )
    expect(updated).toMatchObject({
      ok: true,
      value: {
        title: 'Alpha edit',
        revision: 1,
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
    })
    expect(
      await service.updateProject(alpha.id, alpha.revision, requested),
    ).toEqual({ ok: false, code: 'conflict' })
    expect(await service.readProject(alpha.id)).toEqual(updated)
  })

  it('discloses corrupt and future project rows separately without touching them', async () => {
    const valid = project()
    await service.createProject(valid)
    await adapter.putStrict<DrumProjectRecord>('drumProjects', {
      id: 'corrupt',
      createdAt: valid.createdAt,
      updatedAt: valid.updatedAt,
      sourceKind: DRUM_PROJECT_SOURCE_KIND,
      sourceRef: DRUM_PROJECT_SOURCE_REF,
      project: { broken: true },
    })
    await adapter.putStrict<DrumProjectRecord>('drumProjects', {
      id: 'future',
      createdAt: valid.createdAt,
      updatedAt: valid.updatedAt,
      sourceKind: DRUM_PROJECT_SOURCE_KIND,
      sourceRef: DRUM_PROJECT_SOURCE_REF,
      project: { ...valid, id: 'future', schemaVersion: 2 },
    })

    expect(await service.listProjects()).toMatchObject({
      ok: true,
      value: [{ id: valid.id }],
      skippedRecords: 1,
      futureRecords: 1,
    })
    expect(
      await adapter.readAllStrict<DrumProjectRecord>('drumProjects'),
    ).toHaveLength(3)
  })

  it('enforces the 32-project cap without deleting existing projects', async () => {
    for (let index = 0; index < 32; index += 1) {
      expect(
        await service.createProject(project(`bounded-${index}`)),
      ).toMatchObject({ ok: true })
    }
    expect(await service.createProject(project('one-too-many'))).toEqual({
      ok: false,
      code: 'project-limit',
    })
    expect(
      await adapter.readAllStrict<DrumProjectRecord>('drumProjects'),
    ).toHaveLength(32)
  })

  it('appends newest summaries, prunes oldest, and discloses bad rows', async () => {
    const saved = project()
    await service.createProject(saved)
    for (let index = 0; index < 100; index += 1) {
      const value = summary(saved, index)
      await adapter.putStrict('drumTakeSummaries', takeRecord(value))
    }
    expect(await service.appendTakeSummary(summary(saved, 100))).toMatchObject({
      ok: true,
    })
    expect(
      await adapter.readByIdStrict('drumTakeSummaries', 'take-000'),
    ).toBeUndefined()

    const corruptAt = '2026-08-26T13:00:00.000Z'
    await adapter.putStrict<DrumTakeSummaryRecord>('drumTakeSummaries', {
      id: 'corrupt-take',
      createdAt: corruptAt,
      updatedAt: corruptAt,
      projectId: saved.id,
      completedAt: corruptAt,
      summary: { rawHits: [{ midi: 38 }] },
    })
    await adapter.putStrict<DrumTakeSummaryRecord>('drumTakeSummaries', {
      id: 'future-take',
      createdAt: corruptAt,
      updatedAt: corruptAt,
      projectId: saved.id,
      completedAt: corruptAt,
      summary: { ...summary(saved, 101), id: 'future-take', schemaVersion: 2 },
    })
    const listed = await service.listTakeSummaries(saved.id)
    expect(listed).toMatchObject({
      ok: true,
      skippedRecords: 1,
      futureRecords: 1,
    })
    expect(listed.ok && listed.value).toHaveLength(100)
    expect(listed.ok && listed.value[0]?.id).toBe('take-100')
    expect(
      await adapter.readAllStrict<DrumTakeSummaryRecord>('drumTakeSummaries'),
    ).toHaveLength(102)
  })

  it('deletes a project and every indexed child, including corrupt/future rows', async () => {
    const saved = project()
    await service.createProject(saved)
    const valid = summary(saved)
    const completedAt = valid.completedAt
    await adapter.putStrict('drumTakeSummaries', takeRecord(valid))
    await adapter.putStrict<DrumTakeSummaryRecord>('drumTakeSummaries', {
      id: 'corrupt-child',
      createdAt: completedAt,
      updatedAt: completedAt,
      projectId: saved.id,
      completedAt,
      summary: { broken: true },
    })
    await adapter.putStrict<DrumTakeSummaryRecord>('drumTakeSummaries', {
      id: 'future-child',
      createdAt: completedAt,
      updatedAt: completedAt,
      projectId: saved.id,
      completedAt,
      summary: { ...valid, id: 'future-child', schemaVersion: 2 },
    })

    expect(await service.deleteProject(saved.id)).toEqual({
      ok: true,
      value: undefined,
    })
    expect(
      await adapter.readByIndexStrict(
        'drumTakeSummaries',
        'projectId',
        saved.id,
      ),
    ).toEqual([])
  })

  it('keeps bad summaries on normal clear but erases only Drum stores on reset', async () => {
    const saved = project()
    await service.createProject(saved)
    const valid = summary(saved)
    await adapter.putStrict('drumTakeSummaries', takeRecord(valid))
    await adapter.putStrict<DrumTakeSummaryRecord>('drumTakeSummaries', {
      id: 'future-child',
      createdAt: valid.completedAt,
      updatedAt: valid.completedAt,
      projectId: saved.id,
      completedAt: valid.completedAt,
      summary: { ...valid, id: 'future-child', schemaVersion: 2 },
    })
    const cleared = await service.clearTakeSummaries(saved.id)
    expect(cleared).toMatchObject({
      ok: true,
      skippedRecords: 0,
      futureRecords: 1,
    })
    expect(
      await adapter.readAllStrict<DrumTakeSummaryRecord>('drumTakeSummaries'),
    ).toHaveLength(1)

    const other: DbEntity = {
      id: 'unrelated-row',
      createdAt: valid.completedAt,
      updatedAt: valid.completedAt,
    }
    await adapter.putStrict('sessionRecords', other)
    expect(await service.eraseAll()).toEqual({ ok: true, value: undefined })
    expect(await adapter.readAllStrict('drumProjects')).toEqual([])
    expect(await adapter.readAllStrict('drumTakeSummaries')).toEqual([])
    expect(
      await adapter.readByIdStrict<DbEntity>('sessionRecords', other.id),
    ).toEqual(other)
  })

  it('reports quota failure without retrying or leaving a project', async () => {
    const add = vi
      .spyOn(adapter, 'addStrict')
      .mockRejectedValue(new DOMException('full', 'QuotaExceededError'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await service.createProject(project())).toMatchObject({
      ok: false,
      code: 'quota-exceeded',
    })
    expect(add).toHaveBeenCalledTimes(1)
    expect(await adapter.readAllStrict('drumProjects')).toEqual([])
  })
})
