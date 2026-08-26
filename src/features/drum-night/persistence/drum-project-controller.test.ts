// ============================================================
// Drum project controller tests — lazy intent, atomic restore and save races
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEditableDrumGroove } from '@/features/drum-night/groove/groove-editor'
import { DRUM_KIT_AUTHORED_FAMILIES } from '../runtime/drum-pad-layout'
import { createFirstPocketGroove, FIRST_POCKET_VARIANTS, } from '../session/prepared-grooves'
import type { DrumProjectFamilyMix } from './drum-project'
import { serializeDrumProject, validateDrumProject } from './drum-project'
import type { DrumProjectCapture, DrumProjectController, DrumProjectControllerOptions, DrumProjectLibraryPort, DrumProjectLibraryResult, } from './drum-project-controller'
import { createDrumProjectController } from './drum-project-controller'

const CREATED_AT = '2026-08-26T10:00:00.000Z'
const UPDATED_AT = '2026-08-26T10:01:00.000Z'

const disposers: Array<() => void> = []

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function baseCapture(tempoBpm = 84): DrumProjectCapture {
  const drafts = Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      createEditableDrumGroove(createFirstPocketGroove(variant.id).document),
    ]),
  ) as DrumProjectCapture['drafts']
  const authoredFamilyMix = Object.fromEntries(
    DRUM_KIT_AUTHORED_FAMILIES.map((family) => [
      family,
      { level: 1, muted: false },
    ]),
  ) as DrumProjectFamilyMix
  return {
    selectedVariantId: 'source',
    drafts,
    authoredFamilyMix,
    tempoBpm,
    countInBeats: 4,
    clickEnabled: false,
    loopRange: null,
  }
}

function project(id: string, title = id, tempoBpm = 84, revision = 0) {
  return serializeDrumProject({
    ...baseCapture(tempoBpm),
    id,
    title,
    revision,
    createdAt: CREATED_AT,
    updatedAt: revision === 0 ? CREATED_AT : UPDATED_AT,
  })
}

function ok<T>(value: T): DrumProjectLibraryResult<T> {
  return { ok: true, value }
}

function memoryLibrary(initialProjects = [project('first', 'First Pocket')]) {
  const rows = new Map(
    initialProjects.map((candidate) => [candidate.id, candidate]),
  )
  const library = {
    listProjects: vi.fn(async () => ok([...rows.values()])),
    readProject: vi.fn(async (id: string) => {
      const candidate = rows.get(id)
      return candidate === undefined
        ? ({ ok: false, code: 'not-found' } as const)
        : ok(candidate)
    }),
    createProject: vi.fn(async (candidate) => {
      if (rows.has(candidate.id)) {
        return { ok: false, code: 'conflict' } as const
      }
      rows.set(candidate.id, candidate)
      return ok(candidate)
    }),
    updateProject: vi.fn(async (id, expectedRevision, requested) => {
      const current = rows.get(id)
      if (current === undefined) {
        return { ok: false, code: 'not-found' } as const
      }
      if (current.revision !== expectedRevision) {
        return { ok: false, code: 'conflict' } as const
      }
      const persisted = validateDrumProject({
        ...requested,
        revision: expectedRevision + 1,
        createdAt: current.createdAt,
        updatedAt:
          requested.updatedAt < current.updatedAt
            ? current.updatedAt
            : requested.updatedAt,
      })
      rows.set(id, persisted)
      return ok(persisted)
    }),
    deleteProject: vi.fn(async (id: string) => {
      if (!rows.delete(id)) return { ok: false, code: 'not-found' } as const
      return ok(undefined)
    }),
    eraseAll: vi.fn(async () => {
      rows.clear()
      return ok(undefined)
    }),
  } satisfies DrumProjectLibraryPort
  return { library, rows }
}

function controller(
  options: Omit<DrumProjectControllerOptions, 'capture' | 'apply'> & {
    readonly capture?: DrumProjectControllerOptions['capture']
    readonly apply?: DrumProjectControllerOptions['apply']
  } = {},
): DrumProjectController {
  return createRoot((disposeRoot) => {
    const created = createDrumProjectController({
      capture: options.capture ?? (() => baseCapture()),
      apply: options.apply ?? (() => true),
      ...options,
    })
    disposers.push(() => {
      created.dispose()
      disposeRoot()
    })
    return created
  })
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

describe('createDrumProjectController', () => {
  it('loads the database only for explicit initialize intent and coalesces initialization', async () => {
    const { library } = memoryLibrary()
    const listing =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>[]>>()
    library.listProjects.mockReturnValueOnce(listing.promise)
    const loadService = vi.fn(async () => library)
    const projects = controller({ loadService })

    expect(loadService).not.toHaveBeenCalled()
    expect(library.listProjects).not.toHaveBeenCalled()
    expect(projects.libraryState()).toBe('idle')

    const first = projects.initialize()
    const second = projects.initialize()
    expect(first).toBe(second)
    expect(loadService).toHaveBeenCalledOnce()
    expect(projects.libraryState()).toBe('loading')
    expect(projects.operation()).toBe('initializing')
    await settle()
    expect(library.listProjects).toHaveBeenCalledOnce()

    listing.resolve({
      ok: true,
      value: [project('first', 'First Pocket')],
      skippedRecords: 2,
      futureRecords: 1,
    })
    await expect(first).resolves.toMatchObject({ ok: true })
    expect(projects.libraryState()).toBe('ready')
    expect(projects.operation()).toBe('idle')
    expect(projects.skippedRecords()).toBe(2)
    expect(projects.futureRecords()).toBe(1)
  })

  it('does not apply or claim saved before the first durable create completes', async () => {
    const { library } = memoryLibrary([])
    const writing =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.createProject.mockReturnValueOnce(writing.promise)
    const apply = vi.fn(
      (_project: Parameters<DrumProjectControllerOptions['apply']>[0]) => true,
    )
    const onActiveBoundary = vi.fn()
    const projects = controller({
      loadService: async () => library,
      createId: () => 'new-project',
      now: () => CREATED_AT,
      apply,
      onActiveBoundary,
    })

    const creating = projects.createProject('  My Pocket  ')
    expect(projects.currentProject()).toBeNull()
    expect(projects.saveState()).toBe('saving')
    expect(apply).not.toHaveBeenCalled()
    await settle()
    const requested = library.createProject.mock.calls[0]?.[0]
    expect(requested).toMatchObject({
      id: 'new-project',
      title: 'My Pocket',
      revision: 0,
    })

    writing.resolve(ok(requested!))
    await expect(creating).resolves.toMatchObject({ ok: true })
    expect(projects.currentProject()).toStrictEqual(requested)
    expect(projects.saveState()).toBe('saved')
    expect(projects.dirty()).toBe(false)
    expect(apply).not.toHaveBeenCalled()
    expect(onActiveBoundary).not.toHaveBeenCalled()
  })

  it('hydrates the complete row before host apply and rejects invalid or refused restores', async () => {
    const valid = project('valid', 'Valid Pocket')
    const { library } = memoryLibrary([valid])
    const apply = vi.fn(
      (_project: Parameters<DrumProjectControllerOptions['apply']>[0]) => true,
    )
    const projects = controller({ loadService: async () => library, apply })

    library.readProject.mockResolvedValueOnce(
      ok({ ...valid, tempoBpm: Number.NaN } as unknown as typeof valid),
    )
    await expect(projects.openProject('invalid')).resolves.toMatchObject({
      ok: false,
      code: 'invalid-project',
    })
    expect(apply).not.toHaveBeenCalled()
    expect(projects.currentProject()).toBeNull()

    apply.mockReturnValueOnce(false)
    await expect(projects.openProject('valid')).resolves.toMatchObject({
      ok: false,
      code: 'apply-rejected',
    })
    expect(projects.currentProject()).toBeNull()

    await expect(projects.openProject('valid')).resolves.toMatchObject({
      ok: true,
    })
    expect(apply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        project: valid,
        drafts: expect.objectContaining({ source: expect.any(Object) }),
      }),
    )
    expect(projects.currentProject()).toStrictEqual(valid)
  })

  it('keeps an accepted project authoritative when a host boundary listener fails', async () => {
    const valid = project('valid', 'Valid Pocket')
    const { library } = memoryLibrary([valid])
    const projects = controller({
      loadService: async () => library,
      apply: () => true,
      onActiveBoundary: () => {
        throw new Error('host listener failed')
      },
    })

    await expect(projects.openProject(valid.id)).resolves.toMatchObject({
      ok: true,
      value: valid,
    })
    expect(projects.currentProject()).toStrictEqual(valid)
    expect(projects.operation()).toBe('idle')
  })

  it('serializes host apply so the latest open intent wins even when an older apply is pending', async () => {
    const first = project('first', 'First')
    const second = project('second', 'Second')
    const { library } = memoryLibrary([first, second])
    const firstApply = deferred<boolean>()
    const appliedIds: string[] = []
    const apply = vi.fn(async (hydrated) => {
      if (hydrated.project.id === 'first') await firstApply.promise
      appliedIds.push(hydrated.project.id)
      return true
    })
    const projects = controller({ loadService: async () => library, apply })

    const openingFirst = projects.openProject('first')
    await vi.waitFor(() => expect(apply).toHaveBeenCalledOnce())
    const openingSecond = projects.openProject('second')
    await settle()
    expect(apply).toHaveBeenCalledOnce()

    firstApply.resolve(true)
    await expect(openingFirst).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    await expect(openingSecond).resolves.toMatchObject({ ok: true })
    expect(appliedIds).toEqual(['first', 'second'])
    expect(projects.currentProject()?.id).toBe('second')
  })

  it('invalidates an explicit operation before a newer stage intent continues', async () => {
    const first = project('first', 'First')
    const { library } = memoryLibrary([first])
    const reading =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.readProject.mockReturnValueOnce(reading.promise)
    const apply = vi.fn(() => true)
    const projects = controller({ loadService: async () => library, apply })

    const opening = projects.openProject('first')
    await vi.waitFor(() => expect(library.readProject).toHaveBeenCalledOnce())
    projects.cancelPendingOperation()
    reading.resolve(ok(first))

    await expect(opening).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(apply).not.toHaveBeenCalled()
    expect(projects.currentProject()).toBeNull()
    expect(projects.operation()).toBe('idle')
  })

  it('reconciles a durable delete after its UI intent is superseded', async () => {
    const first = project('first', 'First')
    const second = project('second', 'Second')
    const { library, rows } = memoryLibrary([first, second])
    const deleting = deferred<DrumProjectLibraryResult<undefined>>()
    library.deleteProject.mockReturnValueOnce(deleting.promise)
    const projects = controller({ loadService: async () => library })
    await projects.initialize()

    const result = projects.deleteProject('second')
    await vi.waitFor(() => expect(library.deleteProject).toHaveBeenCalledOnce())
    projects.cancelPendingOperation()
    rows.delete('second')
    deleting.resolve(ok(undefined))

    await expect(result).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(projects.projects().map((candidate) => candidate.id)).toEqual([
      'first',
    ])
    expect(projects.libraryState()).toBe('ready')
    await expect(projects.initialize()).resolves.toMatchObject({
      ok: true,
      value: [expect.objectContaining({ id: 'first' })],
    })
  })

  it('catalogs a durable create without taking over a newer stage intent', async () => {
    const { library, rows } = memoryLibrary([])
    const creating =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.createProject.mockReturnValueOnce(creating.promise)
    const projects = controller({
      loadService: async () => library,
      createId: () => 'late-create',
    })

    const result = projects.createProject('Late Create')
    await vi.waitFor(() => expect(library.createProject).toHaveBeenCalledOnce())
    projects.cancelPendingOperation()
    const persisted = library.createProject.mock.calls[0]?.[0]
    if (persisted === undefined) throw new Error('Expected a captured project.')
    rows.set('late-create', persisted)
    creating.resolve(ok(persisted))

    await expect(result).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(projects.currentProject()).toBeNull()
    expect(projects.projects()).toEqual([
      expect.objectContaining({ id: 'late-create', title: 'Late Create' }),
    ])
    expect(projects.saveState()).toBe('idle')
  })

  it('reconciles a durable privacy erase after its UI intent is superseded', async () => {
    const first = project('first', 'First')
    const second = project('second', 'Second')
    const { library, rows } = memoryLibrary([first, second])
    const erasing = deferred<DrumProjectLibraryResult<undefined>>()
    library.eraseAll.mockReturnValueOnce(erasing.promise)
    const boundary = vi.fn()
    const projects = controller({
      loadService: async () => library,
      onActiveBoundary: boundary,
    })
    await projects.initialize()
    await projects.openProject('first')

    const result = projects.eraseAll()
    await vi.waitFor(() => expect(library.eraseAll).toHaveBeenCalledOnce())
    projects.cancelPendingOperation()
    rows.clear()
    erasing.resolve(ok(undefined))

    await expect(result).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(projects.projects()).toEqual([])
    expect(projects.currentProject()).toBeNull()
    expect(projects.libraryState()).toBe('ready')
    expect(boundary).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'erase', currentProject: null }),
    )
    await expect(projects.initialize()).resolves.toEqual({
      ok: true,
      value: [],
    })
  })

  it('coalesces autosaves through one writer and persists the latest captured change', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    const firstWrite =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    const secondWrite =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.updateProject
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise)
    let tempoBpm = 84
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(tempoBpm),
    })
    await projects.openProject('first')

    tempoBpm = 88
    expect(projects.markDirty()).toEqual({ ok: true, value: undefined })
    await settle()
    expect(library.updateProject).toHaveBeenCalledOnce()
    expect(projects.dirty()).toBe(true)
    expect(projects.saveState()).toBe('saving')

    tempoBpm = 96
    projects.markDirty()
    tempoBpm = 104
    projects.markDirty()
    await settle()
    expect(library.updateProject).toHaveBeenCalledOnce()

    const firstRequested = library.updateProject.mock.calls[0]![2]
    firstWrite.resolve(
      ok(validateDrumProject({ ...firstRequested, revision: 1 })),
    )
    const flushed = projects.flush()
    await vi.waitFor(() =>
      expect(library.updateProject).toHaveBeenCalledTimes(2),
    )
    const secondCall = library.updateProject.mock.calls[1]!
    expect(secondCall[1]).toBe(1)
    expect(secondCall[2].tempoBpm).toBe(104)
    expect(projects.dirty()).toBe(true)
    expect(projects.saveState()).toBe('saving')

    secondWrite.resolve(
      ok(validateDrumProject({ ...secondCall[2], revision: 2 })),
    )
    await expect(flushed).resolves.toBe(true)
    expect(projects.currentProject()).toMatchObject({
      revision: 2,
      tempoBpm: 104,
    })
    expect(projects.dirty()).toBe(false)
    expect(projects.saveState()).toBe('saved')
  })

  it('keeps conflict truth dirty and retries only the latest host capture', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    library.updateProject.mockResolvedValueOnce({
      ok: false,
      code: 'conflict',
    })
    let tempoBpm = 90
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(tempoBpm),
    })
    await projects.openProject('first')

    projects.markDirty()
    await settle()
    await expect(projects.flush()).resolves.toBe(false)
    expect(projects.dirty()).toBe(true)
    expect(projects.saveState()).toBe('conflict')
    expect(projects.failure()).toMatchObject({
      action: 'save',
      code: 'conflict',
    })

    tempoBpm = 118
    await expect(projects.retrySave()).resolves.toMatchObject({ ok: true })
    expect(library.updateProject).toHaveBeenCalledTimes(2)
    expect(library.updateProject.mock.calls[1]?.[2].tempoBpm).toBe(118)
    expect(projects.currentProject()).toMatchObject({
      revision: 1,
      tempoBpm: 118,
    })
    expect(projects.dirty()).toBe(false)
    expect(projects.saveState()).toBe('saved')
  })

  it('ignores an old save completion after a newer project becomes active', async () => {
    const first = project('first', 'First')
    const second = project('second', 'Second')
    const { library } = memoryLibrary([first, second])
    const staleWrite =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.updateProject.mockReturnValueOnce(staleWrite.promise)
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(120),
    })
    await projects.openProject('first')
    projects.markDirty()
    await settle()
    expect(projects.saveState()).toBe('saving')

    await projects.openProject('second')
    expect(projects.currentProject()).toStrictEqual(second)
    expect(projects.saveState()).toBe('saved')
    const oldRequested = library.updateProject.mock.calls[0]![2]
    staleWrite.resolve(
      ok(validateDrumProject({ ...oldRequested, revision: 1 })),
    )
    await settle()

    expect(projects.currentProject()).toStrictEqual(second)
    expect(projects.dirty()).toBe(false)
    expect(projects.saveState()).toBe('saved')
  })

  it('reverts through a fresh validated read and host apply before clearing dirty state', async () => {
    const initial = project('first', 'First', 84)
    const { library } = memoryLibrary([initial])
    library.updateProject.mockResolvedValueOnce({
      ok: false,
      code: 'storage-unavailable',
    })
    const apply = vi.fn(
      (_project: Parameters<DrumProjectControllerOptions['apply']>[0]) => true,
    )
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(140),
      apply,
    })
    await projects.openProject('first')
    apply.mockClear()
    projects.markDirty()
    await vi.waitFor(() =>
      expect(projects.saveState()).toBe('storage-unavailable'),
    )

    await expect(projects.revert()).resolves.toMatchObject({ ok: true })
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0]?.[0].project.tempoBpm).toBe(84)
    expect(projects.currentProject()).toStrictEqual(initial)
    expect(projects.dirty()).toBe(false)
    expect(projects.saveState()).toBe('saved')
  })

  it('routes active rename through autosave and clears identity only after durable delete', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    const deleting = deferred<DrumProjectLibraryResult<undefined>>()
    library.deleteProject.mockReturnValueOnce(deleting.promise)
    const boundaries = vi.fn()
    const projects = controller({
      loadService: async () => library,
      onActiveBoundary: boundaries,
    })
    await projects.openProject('first')
    boundaries.mockClear()

    await expect(
      projects.renameProject('first', '  Better Pocket  '),
    ).resolves.toMatchObject({ ok: true })
    expect(projects.currentProject()).toMatchObject({
      title: 'Better Pocket',
      revision: 1,
    })

    const removing = projects.deleteProject('first')
    await settle()
    expect(projects.currentProject()?.id).toBe('first')
    deleting.resolve(ok(undefined))
    await expect(removing).resolves.toEqual({ ok: true, value: undefined })
    expect(projects.currentProject()).toBeNull()
    expect(projects.saveState()).toBe('idle')
    expect(boundaries).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'delete', currentProject: null }),
    )
  })

  it('prevents an older destructive completion from overwriting a newer erase', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    const deleting = deferred<DrumProjectLibraryResult<undefined>>()
    library.deleteProject.mockReturnValueOnce(deleting.promise)
    const projects = controller({ loadService: async () => library })
    await projects.openProject('first')

    const oldDelete = projects.deleteProject('first')
    await settle()
    await expect(projects.eraseAll()).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    deleting.resolve(ok(undefined))
    await expect(oldDelete).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(projects.projects()).toEqual([])
    expect(projects.currentProject()).toBeNull()
    expect(projects.operation()).toBe('idle')
  })

  it('detaches a clean project without touching its row or current host state', async () => {
    const initial = project('first', 'First')
    const { library, rows } = memoryLibrary([initial])
    const apply = vi.fn(
      (_project: Parameters<DrumProjectControllerOptions['apply']>[0]) => true,
    )
    const boundaries = vi.fn()
    const projects = controller({
      loadService: async () => library,
      apply,
      onActiveBoundary: boundaries,
    })
    await projects.openProject('first')
    apply.mockClear()
    boundaries.mockClear()

    expect(projects.detach()).toEqual({ ok: true, value: undefined })
    expect(projects.currentProject()).toBeNull()
    expect(projects.projects()).toContainEqual(initial)
    expect(rows.get('first')).toBe(initial)
    expect(library.deleteProject).not.toHaveBeenCalled()
    expect(library.eraseAll).not.toHaveBeenCalled()
    expect(apply).not.toHaveBeenCalled()
    expect(boundaries).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'leave', currentProject: null }),
    )
  })

  it('refuses to detach until an accepted host change is durable', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    const writing =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>>>()
    library.updateProject.mockReturnValueOnce(writing.promise)
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(112),
    })
    await projects.openProject('first')
    projects.markDirty()
    await settle()

    expect(projects.detach()).toMatchObject({
      ok: false,
      code: 'conflict',
    })
    expect(projects.currentProject()?.id).toBe('first')
    const requested = library.updateProject.mock.calls[0]![2]
    writing.resolve(ok(validateDrumProject({ ...requested, revision: 1 })))
    await expect(projects.flush()).resolves.toBe(true)
    expect(projects.detach()).toEqual({ ok: true, value: undefined })
  })

  it('finishes a superseded list operation when an autosave refreshes the catalog', async () => {
    const initial = project('first', 'First')
    const { library } = memoryLibrary([initial])
    const listing =
      deferred<DrumProjectLibraryResult<ReturnType<typeof project>[]>>()
    const projects = controller({
      loadService: async () => library,
      capture: () => baseCapture(98),
    })
    await projects.openProject('first')
    library.listProjects.mockReturnValueOnce(listing.promise)

    const staleList = projects.listProjects()
    await settle()
    expect(projects.operation()).toBe('listing')
    projects.markDirty()
    await expect(projects.flush()).resolves.toBe(true)
    listing.resolve(ok([initial]))

    await expect(staleList).resolves.toMatchObject({
      ok: false,
      code: 'superseded',
    })
    expect(projects.operation()).toBe('idle')
    expect(projects.libraryState()).toBe('ready')
    expect(projects.currentProject()).toMatchObject({ tempoBpm: 98 })
  })
})
