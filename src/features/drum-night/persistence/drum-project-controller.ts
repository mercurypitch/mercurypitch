// ============================================================
// Drum project controller — lazy local library and truthful autosave
// ============================================================
//
// The route owns live musical state. This controller crosses the local-storage
// boundary only after an explicit project action, validates every restore
// before host application, and serializes active-project writes so an older
// completion can never mark newer state saved.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DrumProject, DrumProjectSerializationInput, HydratedDrumProject, } from './drum-project'
import { drumProjectContentFingerprint, hydrateDrumProject, serializeDrumProject, validateDrumProject, } from './drum-project'

export type DrumProjectCapture = Omit<
  DrumProjectSerializationInput,
  'id' | 'title' | 'revision' | 'createdAt' | 'updatedAt'
>

export type DrumProjectLibraryFailureCode =
  | 'invalid-project'
  | 'invalid-summary'
  | 'not-found'
  | 'conflict'
  | 'project-limit'
  | 'quota-exceeded'
  | 'storage-unavailable'

export type DrumProjectLibraryResult<T> =
  | {
      readonly ok: true
      readonly value: T
      readonly skippedRecords?: number
      readonly futureRecords?: number
    }
  | {
      readonly ok: false
      readonly code: DrumProjectLibraryFailureCode
      readonly error?: unknown
    }

/** Project-only structural port; the take-history service stays out of here. */
export interface DrumProjectLibraryPort {
  listProjects(): Promise<DrumProjectLibraryResult<DrumProject[]>>
  readProject(id: string): Promise<DrumProjectLibraryResult<DrumProject>>
  createProject(
    project: DrumProject,
  ): Promise<DrumProjectLibraryResult<DrumProject>>
  updateProject(
    id: string,
    expectedRevision: number,
    project: DrumProject,
  ): Promise<DrumProjectLibraryResult<DrumProject>>
  deleteProject(id: string): Promise<DrumProjectLibraryResult<void>>
  eraseAll(): Promise<DrumProjectLibraryResult<void>>
}

export type DrumProjectControllerFailureCode =
  | DrumProjectLibraryFailureCode
  | 'apply-rejected'
  | 'superseded'

export type DrumProjectControllerAction =
  | 'initialize'
  | 'list'
  | 'create'
  | 'open'
  | 'rename'
  | 'delete'
  | 'erase'
  | 'detach'
  | 'save'
  | 'revert'

export interface DrumProjectControllerFailure {
  readonly action: DrumProjectControllerAction
  readonly code: DrumProjectControllerFailureCode
  readonly error?: unknown
}

export type DrumProjectControllerResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly code: DrumProjectControllerFailureCode
      readonly error?: unknown
    }

type DrumProjectControllerFailureResult = Extract<
  DrumProjectControllerResult<unknown>,
  { readonly ok: false }
>

export type DrumProjectLibraryState = 'idle' | 'loading' | 'ready' | 'error'

export type DrumProjectSaveState =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'conflict'
  | 'storage-full'
  | 'storage-unavailable'
  | 'error'

export type DrumProjectControllerOperation =
  | 'idle'
  | 'initializing'
  | 'listing'
  | 'creating'
  | 'opening'
  | 'renaming'
  | 'deleting'
  | 'erasing'
  | 'reverting'

export type DrumProjectBoundaryReason =
  | 'create'
  | 'open'
  | 'delete'
  | 'erase'
  | 'leave'
  | 'revert'

export interface DrumProjectBoundaryChange {
  readonly reason: DrumProjectBoundaryReason
  readonly previousProject: DrumProject | null
  readonly currentProject: DrumProject | null
}

export interface DrumProjectControllerOptions {
  /** Read synchronously before any async work; metadata is controller-owned. */
  readonly capture: () => DrumProjectCapture
  /** Must replace route state atomically and return false without partial apply. */
  readonly apply: (project: HydratedDrumProject) => boolean | Promise<boolean>
  readonly loadService?: () => Promise<DrumProjectLibraryPort>
  readonly createId?: () => string
  readonly now?: () => string
  readonly onActiveBoundary?: (change: DrumProjectBoundaryChange) => void
}

export interface DrumProjectController {
  readonly libraryState: Accessor<DrumProjectLibraryState>
  readonly projects: Accessor<readonly DrumProject[]>
  readonly skippedRecords: Accessor<number>
  readonly futureRecords: Accessor<number>
  readonly currentProject: Accessor<DrumProject | null>
  readonly dirty: Accessor<boolean>
  readonly saveState: Accessor<DrumProjectSaveState>
  readonly operation: Accessor<DrumProjectControllerOperation>
  readonly failure: Accessor<DrumProjectControllerFailure | null>
  readonly initialize: () => Promise<
    DrumProjectControllerResult<readonly DrumProject[]>
  >
  readonly listProjects: () => Promise<
    DrumProjectControllerResult<readonly DrumProject[]>
  >
  readonly createProject: (
    title: string,
  ) => Promise<DrumProjectControllerResult<DrumProject>>
  readonly openProject: (
    id: string,
  ) => Promise<DrumProjectControllerResult<DrumProject>>
  readonly renameProject: (
    id: string,
    title: string,
  ) => Promise<DrumProjectControllerResult<DrumProject>>
  readonly deleteProject: (
    id: string,
  ) => Promise<DrumProjectControllerResult<void>>
  readonly eraseAll: () => Promise<DrumProjectControllerResult<void>>
  /** Invalidate an explicit create/open/rename/delete/revert completion. */
  readonly cancelPendingOperation: () => void
  /** Release autosave identity after the host has successfully flushed. */
  readonly detach: () => DrumProjectControllerResult<void>
  /** Capture and queue the latest accepted host mutation for autosave. */
  readonly markDirty: () => DrumProjectControllerResult<void>
  readonly retrySave: () => Promise<DrumProjectControllerResult<DrumProject>>
  readonly revert: () => Promise<DrumProjectControllerResult<DrumProject>>
  /** Wait until the current local revision is durable, or report false. */
  readonly flush: () => Promise<boolean>
  readonly dispose: () => void
}

interface PendingSave {
  readonly epoch: number
  readonly localRevision: number
  readonly capture: DrumProjectCapture
  readonly title: string
}

const success = <T>(value: T): DrumProjectControllerResult<T> => ({
  ok: true,
  value,
})

function failure(
  code: DrumProjectControllerFailureCode,
  error?: unknown,
): DrumProjectControllerFailureResult {
  return error === undefined ? { ok: false, code } : { ok: false, code, error }
}

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `drum-project-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function defaultNow(): string {
  return new Date().toISOString()
}

async function defaultLoadService(): Promise<DrumProjectLibraryPort> {
  const module = await import('@/db/services/drum-library-service')
  return module.createDrumLibraryService()
}

function orderedProjects(
  projects: readonly DrumProject[],
): readonly DrumProject[] {
  return [...projects].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  )
}

function saveFailureState(
  code: DrumProjectLibraryFailureCode,
): DrumProjectSaveState {
  if (code === 'conflict') return 'conflict'
  if (code === 'quota-exceeded' || code === 'project-limit') {
    return 'storage-full'
  }
  if (code === 'storage-unavailable') return 'storage-unavailable'
  return 'error'
}

export function createDrumProjectController(
  options: DrumProjectControllerOptions,
): DrumProjectController {
  const loadService = options.loadService ?? defaultLoadService
  const createId = options.createId ?? defaultCreateId
  const now = options.now ?? defaultNow
  const [libraryState, setLibraryState] =
    createSignal<DrumProjectLibraryState>('idle')
  const [projects, setProjects] = createSignal<readonly DrumProject[]>([])
  const [skippedRecords, setSkippedRecords] = createSignal(0)
  const [futureRecords, setFutureRecords] = createSignal(0)
  const [currentProject, setCurrentProject] = createSignal<DrumProject | null>(
    null,
  )
  const [dirty, setDirty] = createSignal(false)
  const [saveState, setSaveState] = createSignal<DrumProjectSaveState>('idle')
  const [operation, setOperation] =
    createSignal<DrumProjectControllerOperation>('idle')
  const [controllerFailure, setControllerFailure] =
    createSignal<DrumProjectControllerFailure | null>(null)

  let disposed = false
  let servicePromise: Promise<DrumProjectLibraryPort> | null = null
  let initializePromise: Promise<
    DrumProjectControllerResult<readonly DrumProject[]>
  > | null = null
  let operationGeneration = 0
  let catalogGeneration = 0
  let activeEpoch = 0
  let localRevision = 0
  let durableLocalRevision = 0
  let desiredTitle = ''
  let pendingSave: PendingSave | null = null
  let saveBlocked = false
  let saveLoop: Promise<void> | null = null
  let applyTail: Promise<void> = Promise.resolve()

  function isCurrentOperation(generation: number): boolean {
    return !disposed && generation === operationGeneration
  }

  function beginOperation(next: DrumProjectControllerOperation): number {
    const generation = ++operationGeneration
    setOperation(next)
    setControllerFailure(null)
    return generation
  }

  function finishOperation(generation: number): void {
    if (isCurrentOperation(generation)) setOperation('idle')
  }

  function reportFailure(
    action: DrumProjectControllerAction,
    result: {
      readonly code: DrumProjectControllerFailureCode
      readonly error?: unknown
    },
    generation?: number,
  ): void {
    if (
      disposed ||
      (generation !== undefined && !isCurrentOperation(generation))
    ) {
      return
    }
    setControllerFailure({
      action,
      code: result.code,
      ...(result.error === undefined ? {} : { error: result.error }),
    })
  }

  function superseded<T>(): DrumProjectControllerResult<T> {
    return failure('superseded')
  }

  async function service(): Promise<DrumProjectLibraryPort> {
    if (servicePromise === null) {
      servicePromise = loadService().catch((error: unknown) => {
        servicePromise = null
        throw error
      })
    }
    return servicePromise
  }

  async function serviceFor(
    action: DrumProjectControllerAction,
    generation?: number,
  ): Promise<
    | { readonly ok: true; readonly value: DrumProjectLibraryPort }
    | {
        readonly ok: false
        readonly result: DrumProjectControllerResult<never>
      }
  > {
    try {
      return { ok: true, value: await service() }
    } catch (error) {
      const result = failure('storage-unavailable', error)
      reportFailure(action, result, generation)
      return { ok: false, result }
    }
  }

  function updateCatalog(project: DrumProject): void {
    catalogGeneration += 1
    setProjects((current) =>
      orderedProjects([
        project,
        ...current.filter((candidate) => candidate.id !== project.id),
      ]),
    )
    setLibraryState('ready')
  }

  function removeFromCatalog(id: string): void {
    catalogGeneration += 1
    setProjects((current) => current.filter((candidate) => candidate.id !== id))
    setLibraryState('ready')
  }

  function invalidatePendingSave(): void {
    activeEpoch += 1
    pendingSave = null
    saveBlocked = false
  }

  function notifyBoundary(
    reason: DrumProjectBoundaryReason,
    previousProject: DrumProject | null,
    nextProject: DrumProject | null,
  ): void {
    try {
      options.onActiveBoundary?.({
        reason,
        previousProject,
        currentProject: nextProject,
      })
    } catch {
      // Host notification follows the authoritative controller commit. A
      // listener failure cannot roll back or reject the durable identity.
    }
  }

  function commitActiveProject(
    project: DrumProject,
    reason: Exclude<DrumProjectBoundaryReason, 'delete' | 'erase'>,
    notify = true,
  ): void {
    const previousProject = currentProject()
    invalidatePendingSave()
    localRevision = 0
    durableLocalRevision = 0
    desiredTitle = project.title
    setCurrentProject(project)
    setDirty(false)
    setSaveState('saved')
    updateCatalog(project)
    if (notify) notifyBoundary(reason, previousProject, project)
  }

  function clearActiveProject(reason: 'delete' | 'erase' | 'leave'): void {
    const previousProject = currentProject()
    invalidatePendingSave()
    localRevision = 0
    durableLocalRevision = 0
    desiredTitle = ''
    setCurrentProject(null)
    setDirty(false)
    setSaveState('idle')
    notifyBoundary(reason, previousProject, null)
  }

  function capturedProject(
    capture: DrumProjectCapture,
    project: DrumProject,
    title: string,
    timestamp: string,
  ): DrumProject {
    return serializeDrumProject({
      ...capture,
      id: project.id,
      title,
      revision: project.revision,
      createdAt: project.createdAt,
      updatedAt: timestamp < project.updatedAt ? project.updatedAt : timestamp,
    })
  }

  function captureSave(
    title: string,
  ): DrumProjectControllerResult<PendingSave> {
    const project = currentProject()
    if (project === null) return failure('not-found')
    try {
      const capture = options.capture()
      capturedProject(capture, project, title, now())
      const next: PendingSave = {
        epoch: activeEpoch,
        localRevision: localRevision + 1,
        capture,
        title,
      }
      localRevision = next.localRevision
      return success(next)
    } catch (error) {
      return failure('invalid-project', error)
    }
  }

  function setSaveFailure(result: {
    readonly code: DrumProjectLibraryFailureCode
    readonly error?: unknown
  }): void {
    saveBlocked = true
    setDirty(true)
    setSaveState(saveFailureState(result.code))
    reportFailure('save', result)
  }

  async function drainSaves(epoch: number): Promise<void> {
    while (!disposed && epoch === activeEpoch) {
      const pending = pendingSave
      const project = currentProject()
      if (
        pending === null ||
        pending.epoch !== epoch ||
        project === null ||
        saveBlocked
      ) {
        return
      }
      pendingSave = null

      let requested: DrumProject
      try {
        requested = capturedProject(
          pending.capture,
          project,
          pending.title,
          now(),
        )
      } catch (error) {
        if (epoch !== activeEpoch || disposed) return
        pendingSave = pendingSave ?? pending
        setSaveFailure({ code: 'invalid-project', error })
        return
      }

      setSaveState('saving')
      const loaded = await serviceFor('save')
      if (epoch !== activeEpoch || disposed) return
      if (!loaded.ok) {
        pendingSave = pendingSave ?? pending
        setSaveFailure({
          code: 'storage-unavailable',
          ...(loaded.result.ok || loaded.result.error === undefined
            ? {}
            : { error: loaded.result.error }),
        })
        return
      }

      const write = await loaded.value.updateProject(
        project.id,
        project.revision,
        requested,
      )
      if (epoch !== activeEpoch || disposed) return
      if (!write.ok) {
        pendingSave = pendingSave ?? pending
        setSaveFailure(write)
        return
      }

      let persisted: DrumProject
      try {
        persisted = validateDrumProject(write.value)
      } catch (error) {
        pendingSave = pendingSave ?? pending
        setSaveFailure({ code: 'invalid-project', error })
        return
      }
      if (
        persisted.id !== project.id ||
        persisted.revision !== project.revision + 1 ||
        persisted.title !== requested.title ||
        drumProjectContentFingerprint(persisted) !==
          drumProjectContentFingerprint(requested)
      ) {
        pendingSave = pendingSave ?? pending
        setSaveFailure({ code: 'conflict' })
        return
      }

      durableLocalRevision = Math.max(
        durableLocalRevision,
        pending.localRevision,
      )
      setCurrentProject(persisted)
      updateCatalog(persisted)
      if (pendingSave === null && durableLocalRevision === localRevision) {
        desiredTitle = persisted.title
        setDirty(false)
        setSaveState('saved')
        setControllerFailure((current) =>
          current?.action === 'save' ? null : current,
        )
      } else {
        setDirty(true)
        setSaveState('saving')
      }
    }
  }

  function startSaveLoop(): void {
    if (disposed || saveBlocked || pendingSave === null || saveLoop !== null) {
      return
    }
    const epoch = activeEpoch
    const running = drainSaves(epoch)
    saveLoop = running
    void running.finally(() => {
      if (saveLoop !== running) return
      saveLoop = null
      if (
        !disposed &&
        !saveBlocked &&
        pendingSave !== null &&
        pendingSave.epoch === activeEpoch
      ) {
        startSaveLoop()
      }
    })
  }

  function enqueueSave(title: string): DrumProjectControllerResult<void> {
    const captured = captureSave(title)
    if (!captured.ok) {
      setDirty(true)
      setSaveState('error')
      reportFailure('save', captured)
      return captured
    }
    desiredTitle = title
    pendingSave = captured.value
    setDirty(true)
    if (!saveBlocked) {
      setSaveState('dirty')
      startSaveLoop()
    }
    return success(undefined)
  }

  async function applyHydrated(
    generation: number,
    hydrated: HydratedDrumProject,
  ): Promise<DrumProjectControllerResult<void>> {
    let resolveResult!: (result: DrumProjectControllerResult<void>) => void
    const result = new Promise<DrumProjectControllerResult<void>>((resolve) => {
      resolveResult = resolve
    })
    applyTail = applyTail.then(async () => {
      if (!isCurrentOperation(generation)) {
        resolveResult(superseded())
        return
      }
      try {
        const outcome = options.apply(hydrated)
        const accepted = typeof outcome === 'boolean' ? outcome : await outcome
        if (!accepted) {
          resolveResult(failure('apply-rejected'))
          return
        }
      } catch (error) {
        resolveResult(failure('apply-rejected', error))
        return
      }
      resolveResult(
        isCurrentOperation(generation) ? success(undefined) : superseded(),
      )
    })
    return result
  }

  async function loadProjects(
    nextOperation: 'initializing' | 'listing',
    action: 'initialize' | 'list',
  ): Promise<DrumProjectControllerResult<readonly DrumProject[]>> {
    const generation = beginOperation(nextOperation)
    const catalogRequest = ++catalogGeneration
    setLibraryState('loading')
    const loaded = await serviceFor(action, generation)
    if (!isCurrentOperation(generation)) {
      return superseded()
    }
    if (catalogRequest !== catalogGeneration) {
      finishOperation(generation)
      return superseded()
    }
    if (!loaded.ok) {
      setLibraryState('error')
      finishOperation(generation)
      return loaded.result
    }
    const result = await loaded.value.listProjects()
    if (!isCurrentOperation(generation)) {
      return superseded()
    }
    if (catalogRequest !== catalogGeneration) {
      finishOperation(generation)
      return superseded()
    }
    if (!result.ok) {
      setLibraryState('error')
      reportFailure(action, result, generation)
      finishOperation(generation)
      return result
    }
    try {
      const validated = result.value.map(validateDrumProject)
      const ordered = orderedProjects(validated)
      setProjects(ordered)
      setSkippedRecords(result.skippedRecords ?? 0)
      setFutureRecords(result.futureRecords ?? 0)
      setLibraryState('ready')
      finishOperation(generation)
      return success(ordered)
    } catch (error) {
      const invalid = failure('invalid-project', error)
      setLibraryState('error')
      reportFailure(action, invalid, generation)
      finishOperation(generation)
      return invalid
    }
  }

  function listProjects(): Promise<
    DrumProjectControllerResult<readonly DrumProject[]>
  > {
    return loadProjects('listing', 'list')
  }

  function initialize(): Promise<
    DrumProjectControllerResult<readonly DrumProject[]>
  > {
    if (libraryState() === 'ready') return Promise.resolve(success(projects()))
    if (initializePromise !== null) return initializePromise
    const running = loadProjects('initializing', 'initialize')
    initializePromise = running
    void running.finally(() => {
      if (initializePromise === running) initializePromise = null
    })
    return running
  }

  async function createProject(
    requestedTitle: string,
  ): Promise<DrumProjectControllerResult<DrumProject>> {
    const title = requestedTitle.trim()
    let serialized: DrumProject
    try {
      const timestamp = now()
      serialized = serializeDrumProject({
        ...options.capture(),
        id: createId(),
        title,
        revision: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    } catch (error) {
      const invalid = failure('invalid-project', error)
      reportFailure('create', invalid)
      return invalid
    }

    const generation = beginOperation('creating')
    setSaveState('saving')
    const loaded = await serviceFor('create', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      setSaveState(saveFailureState('storage-unavailable'))
      finishOperation(generation)
      return loaded.result
    }
    const write = await loaded.value.createProject(serialized)
    if (disposed) return superseded()
    if (!write.ok) {
      if (!isCurrentOperation(generation)) return superseded()
      setSaveState(saveFailureState(write.code))
      reportFailure('create', write, generation)
      finishOperation(generation)
      return write
    }

    let persisted: DrumProject
    try {
      persisted = validateDrumProject(write.value)
    } catch (error) {
      if (!isCurrentOperation(generation)) {
        setLibraryState('idle')
        return superseded()
      }
      const invalid = failure('invalid-project', error)
      setSaveState('error')
      reportFailure('create', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    if (
      persisted.id !== serialized.id ||
      persisted.revision !== 0 ||
      persisted.title !== serialized.title ||
      drumProjectContentFingerprint(persisted) !==
        drumProjectContentFingerprint(serialized)
    ) {
      if (!isCurrentOperation(generation)) {
        setLibraryState('idle')
        return superseded()
      }
      const conflict = failure('conflict')
      setSaveState('conflict')
      reportFailure('create', conflict, generation)
      finishOperation(generation)
      return conflict
    }
    if (!isCurrentOperation(generation)) {
      // The durable create already committed. Keep the local catalog honest,
      // but do not make an older Save intent own a stage that has moved on.
      updateCatalog(persisted)
      if (operation() === 'idle' && currentProject() === null) {
        setSaveState('idle')
      }
      return superseded()
    }
    commitActiveProject(persisted, 'create', false)
    finishOperation(generation)
    return success(persisted)
  }

  async function openProject(
    id: string,
  ): Promise<DrumProjectControllerResult<DrumProject>> {
    const generation = beginOperation('opening')
    const loaded = await serviceFor('open', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      finishOperation(generation)
      return loaded.result
    }
    const read = await loaded.value.readProject(id)
    if (!isCurrentOperation(generation)) return superseded()
    if (!read.ok) {
      reportFailure('open', read, generation)
      finishOperation(generation)
      return read
    }

    let hydrated: HydratedDrumProject
    try {
      hydrated = hydrateDrumProject(validateDrumProject(read.value))
    } catch (error) {
      const invalid = failure('invalid-project', error)
      reportFailure('open', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    if (hydrated.project.id !== id) {
      const invalid = failure('invalid-project')
      reportFailure('open', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    const applied = await applyHydrated(generation, hydrated)
    if (!applied.ok) {
      if (applied.code !== 'superseded') {
        reportFailure('open', applied, generation)
        finishOperation(generation)
      }
      return applied
    }
    if (!isCurrentOperation(generation)) return superseded()
    commitActiveProject(hydrated.project, 'open')
    finishOperation(generation)
    return success(hydrated.project)
  }

  async function renameProject(
    id: string,
    requestedTitle: string,
  ): Promise<DrumProjectControllerResult<DrumProject>> {
    const title = requestedTitle.trim()
    const active = currentProject()
    if (active?.id === id) {
      const generation = beginOperation('renaming')
      const queued = enqueueSave(title)
      if (!queued.ok) {
        finishOperation(generation)
        return queued
      }
      const flushed = await flush()
      if (!isCurrentOperation(generation)) return superseded()
      const renamed = currentProject()
      if (flushed && renamed?.id === id) {
        finishOperation(generation)
        return success(renamed)
      }
      const latestFailure = controllerFailure()
      const result: DrumProjectControllerResult<DrumProject> =
        latestFailure === null
          ? superseded<DrumProject>()
          : failure(latestFailure.code, latestFailure.error)
      finishOperation(generation)
      return result
    }

    const generation = beginOperation('renaming')
    const loaded = await serviceFor('rename', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      finishOperation(generation)
      return loaded.result
    }
    const read = await loaded.value.readProject(id)
    if (!isCurrentOperation(generation)) return superseded()
    if (!read.ok) {
      reportFailure('rename', read, generation)
      finishOperation(generation)
      return read
    }

    let requested: DrumProject
    try {
      const timestamp = now()
      requested = validateDrumProject({
        ...read.value,
        title,
        updatedAt:
          timestamp < read.value.updatedAt ? read.value.updatedAt : timestamp,
      })
    } catch (error) {
      const invalid = failure('invalid-project', error)
      reportFailure('rename', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    const write = await loaded.value.updateProject(
      requested.id,
      requested.revision,
      requested,
    )
    if (disposed) return superseded()
    if (!write.ok) {
      if (!isCurrentOperation(generation)) return superseded()
      reportFailure('rename', write, generation)
      finishOperation(generation)
      return write
    }
    let persisted: DrumProject
    try {
      persisted = validateDrumProject(write.value)
    } catch (error) {
      if (!isCurrentOperation(generation)) {
        setLibraryState('idle')
        return superseded()
      }
      const invalid = failure('invalid-project', error)
      reportFailure('rename', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    if (
      persisted.id !== requested.id ||
      persisted.revision !== requested.revision + 1 ||
      persisted.title !== title ||
      drumProjectContentFingerprint(persisted) !==
        drumProjectContentFingerprint(requested)
    ) {
      if (!isCurrentOperation(generation)) {
        setLibraryState('idle')
        return superseded()
      }
      const conflict = failure('conflict')
      reportFailure('rename', conflict, generation)
      finishOperation(generation)
      return conflict
    }
    updateCatalog(persisted)
    if (!isCurrentOperation(generation)) return superseded()
    finishOperation(generation)
    return success(persisted)
  }

  async function deleteProject(
    id: string,
  ): Promise<DrumProjectControllerResult<void>> {
    const generation = beginOperation('deleting')
    const loaded = await serviceFor('delete', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      finishOperation(generation)
      return loaded.result
    }
    const result = await loaded.value.deleteProject(id)
    if (disposed) return superseded()
    if (!result.ok) {
      if (!isCurrentOperation(generation)) return superseded()
      reportFailure('delete', result, generation)
      finishOperation(generation)
      return result
    }
    removeFromCatalog(id)
    if (currentProject()?.id === id) clearActiveProject('delete')
    if (!isCurrentOperation(generation)) return superseded()
    finishOperation(generation)
    return success(undefined)
  }

  async function eraseAll(): Promise<DrumProjectControllerResult<void>> {
    const generation = beginOperation('erasing')
    const loaded = await serviceFor('erase', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      finishOperation(generation)
      return loaded.result
    }
    const result = await loaded.value.eraseAll()
    if (disposed) return superseded()
    if (!result.ok) {
      if (!isCurrentOperation(generation)) return superseded()
      reportFailure('erase', result, generation)
      finishOperation(generation)
      return result
    }
    catalogGeneration += 1
    setProjects([])
    setSkippedRecords(0)
    setFutureRecords(0)
    setLibraryState('ready')
    clearActiveProject('erase')
    if (!isCurrentOperation(generation)) return superseded()
    finishOperation(generation)
    return success(undefined)
  }

  function cancelPendingOperation(): void {
    if (disposed) return
    operationGeneration += 1
    setOperation('idle')
    setControllerFailure(null)
  }

  function detach(): DrumProjectControllerResult<void> {
    if (currentProject() === null) return success(undefined)
    if (dirty() || pendingSave !== null || saveLoop !== null) {
      const result = failure('conflict')
      reportFailure('detach', result)
      return result
    }
    clearActiveProject('leave')
    return success(undefined)
  }

  function markDirty(): DrumProjectControllerResult<void> {
    const project = currentProject()
    const title = desiredTitle !== '' ? desiredTitle : (project?.title ?? '')
    return enqueueSave(title)
  }

  async function flush(): Promise<boolean> {
    const project = currentProject()
    if (disposed || project === null) return false
    const id = project.id
    const epoch = activeEpoch
    while (!disposed && epoch === activeEpoch && currentProject()?.id === id) {
      if (saveBlocked) return false
      startSaveLoop()
      const running = saveLoop
      if (running === null) {
        return !dirty() && durableLocalRevision === localRevision
      }
      await running
    }
    return false
  }

  async function retrySave(): Promise<
    DrumProjectControllerResult<DrumProject>
  > {
    const project = currentProject()
    if (project === null) return failure('not-found')
    saveBlocked = false
    setControllerFailure((current) =>
      current?.action === 'save' ? null : current,
    )
    const queued = enqueueSave(
      desiredTitle !== '' ? desiredTitle : project.title,
    )
    if (!queued.ok) return queued
    const flushed = await flush()
    const persisted = currentProject()
    if (flushed && persisted !== null) return success(persisted)
    const latestFailure = controllerFailure()
    return latestFailure === null
      ? superseded()
      : failure(latestFailure.code, latestFailure.error)
  }

  async function revert(): Promise<DrumProjectControllerResult<DrumProject>> {
    const project = currentProject()
    if (project === null) return failure('not-found')
    const generation = beginOperation('reverting')
    invalidatePendingSave()
    const priorSave = saveLoop
    if (priorSave !== null) await priorSave
    if (!isCurrentOperation(generation)) return superseded()

    const loaded = await serviceFor('revert', generation)
    if (!isCurrentOperation(generation)) return superseded()
    if (!loaded.ok) {
      setDirty(true)
      setSaveState('error')
      finishOperation(generation)
      return loaded.result
    }
    const read = await loaded.value.readProject(project.id)
    if (!isCurrentOperation(generation)) return superseded()
    if (!read.ok) {
      setDirty(true)
      setSaveState(saveFailureState(read.code))
      reportFailure('revert', read, generation)
      finishOperation(generation)
      return read
    }
    let hydrated: HydratedDrumProject
    try {
      hydrated = hydrateDrumProject(validateDrumProject(read.value))
    } catch (error) {
      const invalid = failure('invalid-project', error)
      setDirty(true)
      setSaveState('error')
      reportFailure('revert', invalid, generation)
      finishOperation(generation)
      return invalid
    }
    const applied = await applyHydrated(generation, hydrated)
    if (!applied.ok) {
      if (applied.code !== 'superseded') {
        setDirty(true)
        setSaveState('error')
        reportFailure('revert', applied, generation)
        finishOperation(generation)
      }
      return applied
    }
    if (!isCurrentOperation(generation)) return superseded()
    commitActiveProject(hydrated.project, 'revert')
    finishOperation(generation)
    return success(hydrated.project)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    operationGeneration += 1
    catalogGeneration += 1
    invalidatePendingSave()
    setOperation('idle')
  }

  return {
    libraryState,
    projects,
    skippedRecords,
    futureRecords,
    currentProject,
    dirty,
    saveState,
    operation,
    failure: controllerFailure,
    initialize,
    listProjects,
    createProject,
    openProject,
    renameProject,
    deleteProject,
    eraseAll,
    cancelPendingOperation,
    detach,
    markDirty,
    retrySave,
    revert,
    flush,
    dispose,
  }
}
