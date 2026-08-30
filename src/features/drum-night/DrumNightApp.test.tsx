// ============================================================
// Drum Night app tests — silent entry and real gesture-owned room controls
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayAlongBandPreparationPort } from '@/features/play-along/band-preparation-port'
import type { PlayAlongBackingSource, PlayAlongSongSourcePort, } from '@/features/play-along/song-port'
import { premiumBackgroundCatalogStore } from '@/lib/backgrounds/background-catalog-store'
import type { CloudSplitBlocker } from '@/lib/uvr-cloud-preflight'
import type { DrumKitId, DrumKitPlayer, DrumKitPlayerOptions, DrumKitPlayerSnapshot, } from './audio'
import { drumKitManifest } from './audio'
import type { DrumNightAudioSession } from './drum-night-audio-session'
import type { DrumNightClickController, DrumNightClickControllerOptions, DrumNightClickSnapshot, } from './drum-night-click'
import { DrumNightApp } from './DrumNightApp'
import { DEFAULT_DRUM_FEEL_SETTINGS, DRUM_FEEL_STORAGE_KEY, readDrumFeelSettings, writeDrumFeelSettings, } from './groove'
import type { DrumTakeFinishState } from './persistence/drum-persistence-ui'
import type { DrumProject, HydratedDrumProject, } from './persistence/drum-project'
import { hydrateDrumProject, serializeDrumProject, } from './persistence/drum-project'
import type { DrumProjectCapture, DrumProjectController, DrumProjectControllerFailure, DrumProjectControllerOperation, DrumProjectControllerOptions, DrumProjectLibraryState, DrumProjectSaveState, } from './persistence/drum-project-controller'
import type { DrumTakeHistoryController, DrumTakeHistoryControllerState, } from './persistence/drum-take-history-controller'
import type { DrumTakeSummary } from './persistence/drum-take-summary'
import type * as DrumStemPlayAlongModule from './play-along/drum-stem-play-along'
import type { DrumMidiAccessPort, DrumMidiInputPort, DrumMidiMessageLike, DrumRuntimeClock, } from './runtime'
import type { DrumScoreIndex, DrumSessionImportController, DrumSessionImportState, } from './session'
import { createDrumScoreIndex, IDLE_DRUM_SESSION } from './session'
import { drumSongFixture, percussionTrackFixture, readySessionFixture, } from './session/drum-session.test-fixtures'

const takeSummaryBuilderLoad = vi.hoisted(() => ({
  entered: vi.fn(),
  gate: null as Promise<undefined> | null,
}))
const stemConfigureFailure = vi.hoisted(() => ({ next: false }))

vi.mock('./play-along/drum-stem-play-along', async (importOriginal) => {
  const actual = await importOriginal<typeof DrumStemPlayAlongModule>()
  return {
    ...actual,
    createDrumStemPlayAlongController: (
      options: Parameters<typeof actual.createDrumStemPlayAlongController>[0],
    ) => {
      const controller = actual.createDrumStemPlayAlongController(options)
      return {
        ...controller,
        configure: (
          source: Parameters<typeof controller.configure>[0],
        ): void => {
          if (stemConfigureFailure.next) {
            stemConfigureFailure.next = false
            throw new Error('stem graph refused release')
          }
          controller.configure(source)
        },
      }
    },
  }
})

vi.mock('./persistence/drum-take-summary-builder', async (importOriginal) => {
  takeSummaryBuilderLoad.entered()
  if (takeSummaryBuilderLoad.gate !== null) {
    await takeSummaryBuilderLoad.gate
  }
  return importOriginal()
})

class TestClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId
    this.nextFrameId += 1
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advanceTo(timestampMs: number): void {
    this.timestampMs = timestampMs
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }
}

class FakeMidiInput implements DrumMidiInputPort {
  readonly id: string
  readonly name: string
  readonly state: MIDIPortDeviceState = 'connected'
  onmidimessage: ((event: DrumMidiMessageLike) => void) | null = null
  private listeners = new Set<(event: DrumMidiMessageLike) => void>()

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  addEventListener(
    _type: 'midimessage',
    listener: (event: DrumMidiMessageLike) => void,
  ): void {
    this.listeners.add(listener)
  }

  removeEventListener(
    _type: 'midimessage',
    listener: (event: DrumMidiMessageLike) => void,
  ): void {
    this.listeners.delete(listener)
  }

  emit(data: readonly number[], timeStamp = performance.now()): void {
    const event = { data: new Uint8Array(data), timeStamp }
    this.onmidimessage?.(event)
    for (const listener of this.listeners) listener(event)
  }
}

function midiAccess(inputs: readonly FakeMidiInput[]): DrumMidiAccessPort {
  return {
    inputs: { values: () => inputs[Symbol.iterator]() },
    onstatechange: null,
  }
}

function dispatchPointerDown(
  target: Element,
  init: {
    readonly button: number
    readonly isPrimary: boolean
    readonly pressure: number
  },
): void {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: init.button },
    isPrimary: { value: init.isPrimary },
    pressure: { value: init.pressure },
  })
  fireEvent(target, event)
}

function deferred<T>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

async function settleMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function openDrummerSeatKit(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Drummer Seat view' }))
  return screen.getByRole('group', {
    name: 'Playable photographed drum kit',
  })
}

function sessionHarness(mapperAvailable = true) {
  let activated = false
  const activeContextValue = { currentTime: 0 } as AudioContext
  const contextForGesture = vi.fn(() => {
    activated = true
    return activeContextValue
  })
  const outputForGesture = vi.fn(() => {
    activated = true
    return {} as AudioNode
  })
  const activeContext = vi.fn(() => (activated ? activeContextValue : null))
  const activeOutput = vi.fn(() => (activated ? ({} as AudioNode) : null))
  const performanceTimestampToContextTime = vi.fn((timestampMs: number) =>
    activated && mapperAvailable ? timestampMs / 1000 : null,
  )
  const dispose = vi.fn(async () => undefined)
  const session = {
    activeContext,
    activeOutput,
    contextForGesture,
    outputForGesture,
    performanceTimestampToContextTime,
    dispose,
  } satisfies DrumNightAudioSession
  return {
    activeContext,
    activeOutput,
    contextForGesture,
    dispose,
    outputForGesture,
    performanceTimestampToContextTime,
    session,
  }
}

function clickHarness() {
  const listeners = new Set<() => void>()
  let current: DrumNightClickSnapshot = {
    status: 'disabled',
    enabled: false,
    level: 0.5,
    transportRevision: 0,
    scheduledClickCount: 0,
    lateOmittedClickCount: 0,
    dedupeLedgerSize: 0,
    activeVoiceCount: 0,
    lastClick: null,
    error: null,
  }
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const enable = vi.fn((enabled: boolean) => {
    current = {
      ...current,
      enabled,
      status: enabled ? 'waiting-for-audio' : 'disabled',
    }
    emit()
  })
  const setLevel = vi.fn((level: number) => {
    current = { ...current, level }
    emit()
  })
  const dispose = vi.fn()
  const controller: DrumNightClickController = {
    snapshot: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    enable,
    setLevel,
    dispose,
  }
  const createClickController = vi.fn(
    (_options: DrumNightClickControllerOptions) => controller,
  )
  return { controller, createClickController, dispose, enable, setLevel }
}

function importSessionHarness(
  initialState: DrumSessionImportState = IDLE_DRUM_SESSION,
  options: { readonly beforeApply?: () => Promise<void> } = {},
) {
  let state = initialState
  let generation = 0
  let disposed = false
  let nextResult: DrumSessionImportState = initialState
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const setState = (nextState: DrumSessionImportState): void => {
    state = nextState
    emit()
  }
  const importFile = vi.fn(async (file: File) => {
    const attemptGeneration = ++generation
    setState({ status: 'loading', fileName: file.name })
    await options.beforeApply?.()
    await Promise.resolve()
    if (disposed || attemptGeneration !== generation) {
      return {
        status: 'stale' as const,
        generation: attemptGeneration,
        state: nextResult,
      }
    }
    setState(nextResult)
    return {
      status: 'applied' as const,
      generation: attemptGeneration,
      state: nextResult,
    }
  })
  const cancel = vi.fn(() => {
    generation += 1
    setState(IDLE_DRUM_SESSION)
  })
  const dispose = vi.fn(() => {
    disposed = true
    generation += 1
    listeners.clear()
  })
  const controller = {
    state: () => state,
    generation: () => generation,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    importFile,
    cancel,
    dispose,
  } satisfies DrumSessionImportController
  return {
    cancel,
    controller,
    dispose,
    importFile,
    listenerCount: () => listeners.size,
    setNextResult(nextState: DrumSessionImportState) {
      nextResult = nextState
    },
    setState,
  }
}

function playerHarness(
  initialKitId: DrumKitId = 'mercury-synth',
  activationResults: readonly boolean[] = [true],
) {
  let options: DrumKitPlayerOptions | null = null
  let snapshot: DrumKitPlayerSnapshot = {
    selectedKitId: initialKitId,
    status: 'idle',
    fallbackReady: false,
    sampledReady: false,
    loadedSamples: 0,
    preparedSamples: 0,
    plannedSamples: 0,
    decodedBytes: 0,
    publishedEncodedBytes: drumKitManifest(initialKitId).publishedEncodedBytes,
    error: null,
  }
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const updateSnapshot = (patch: Partial<DrumKitPlayerSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    emit()
  }
  let activationAttempt = 0
  const activate = vi.fn(async () => {
    options?.getAudioContext()
    options?.getOutput()
    const activated =
      activationResults[
        Math.min(activationAttempt, activationResults.length - 1)
      ] ?? true
    activationAttempt += 1
    if (!activated) {
      updateSnapshot({
        status: 'error',
        fallbackReady: false,
        sampledReady: false,
        error: 'Drum audio context is unavailable.',
      })
      return false
    }
    const sampled = snapshot.selectedKitId !== 'mercury-synth'
    updateSnapshot({
      status: sampled ? 'loading' : 'ready',
      fallbackReady: true,
      plannedSamples: sampled ? 5 : 0,
      preparedSamples: 0,
      error: null,
    })
    return true
  })
  const trigger = vi.fn<DrumKitPlayer['trigger']>(() => 'synth-fallback')
  const panic = vi.fn()
  const dispose = vi.fn(() => listeners.clear())
  const selectKit = vi.fn<DrumKitPlayer['selectKit']>(async (kitId) => {
    const sampled = kitId !== 'mercury-synth'
    updateSnapshot({
      selectedKitId: kitId,
      status: snapshot.fallbackReady && sampled ? 'loading' : 'idle',
      sampledReady: false,
      loadedSamples: 0,
      preparedSamples: 0,
      plannedSamples: snapshot.fallbackReady && sampled ? 5 : 0,
      publishedEncodedBytes: drumKitManifest(kitId).publishedEncodedBytes,
      error: null,
    })
  })
  const retry = vi.fn<DrumKitPlayer['retry']>(async () => {
    updateSnapshot({
      status: snapshot.selectedKitId === 'mercury-synth' ? 'ready' : 'loading',
      error: null,
    })
  })
  const setLaneVolume = vi.fn<NonNullable<DrumKitPlayer['setLaneVolume']>>()
  const setAuthoredFamilyVolume =
    vi.fn<NonNullable<DrumKitPlayer['setAuthoredFamilyVolume']>>()
  const player = {
    activate,
    trigger,
    panic,
    dispose,
    selectedKit: () => drumKitManifest(snapshot.selectedKitId),
    selectKit,
    retry,
    prewarm: vi.fn(async () => undefined),
    choke: vi.fn(),
    setVolume: vi.fn(),
    setLaneVolume,
    setAuthoredFamilyVolume,
    snapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } satisfies DrumKitPlayer
  const createPlayer = vi.fn((nextOptions: DrumKitPlayerOptions) => {
    options = nextOptions
    const nextKitId = nextOptions.initialKitId ?? initialKitId
    snapshot = {
      ...snapshot,
      selectedKitId: nextKitId,
      publishedEncodedBytes: drumKitManifest(nextKitId).publishedEncodedBytes,
    }
    return player
  })
  return {
    activate,
    createPlayer,
    dispose,
    listenerCount: () => listeners.size,
    player,
    retry,
    selectKit,
    setAuthoredFamilyVolume,
    setLaneVolume,
    trigger,
    updateSnapshot,
  }
}

function preparedBackingHarness(options: {
  readonly sessionId: string
  readonly title: string
  readonly kind: 'two-stem' | 'parts'
}) {
  const stemKinds =
    options.kind === 'parts'
      ? (['vocal', 'drums', 'bass', 'guitar', 'piano', 'other'] as const)
      : (['vocal', 'instrumental'] as const)
  const plannedMix: PlayAlongBackingSource<'drums'>['plannedMix'] =
    options.kind === 'parts'
      ? { kind: 'parts', audible: stemKinds, muted: [] }
      : {
          kind: 'mixed-instrumental',
          audible: ['vocal', 'instrumental'],
          muted: [],
        }
  const load = vi.fn<PlayAlongBackingSource<'drums'>['load']>(async () => ({
    ok: false,
    code: 'missing-local-audio',
  }))
  const release = vi.fn()
  const source = {
    sessionId: options.sessionId,
    title: options.title,
    stemKinds,
    plannedMix,
    durationSeconds: 210,
    source: 'device',
    load,
    release,
  } satisfies PlayAlongBackingSource<'drums'>
  return { load, release, source }
}

function songPortHarness(
  sources: readonly ReturnType<typeof preparedBackingHarness>[],
) {
  const initialize = vi.fn(async () => undefined)
  const completedSongs = vi.fn(() =>
    sources.map(({ source }, index) => ({
      sessionId: source.sessionId,
      title: source.title,
      createdAt: Date.UTC(2026, 7, 24 - index),
      source: 'device' as const,
      subtitle: source.plannedMix.kind === 'parts' ? 'Full parts' : 'Two stems',
    })),
  )
  const openSession = vi.fn<PlayAlongSongSourcePort<'drums'>['openSession']>(
    async (sessionId, signal) => {
      if (signal.aborted) return { ok: false, code: 'aborted' }
      const match = sources.find(({ source }) => source.sessionId === sessionId)
      return match === undefined
        ? { ok: false, code: 'not-found' }
        : { ok: true, lease: match.source }
    },
  )
  const port = {
    initialize,
    completedSongs,
    openSession,
  } satisfies PlayAlongSongSourcePort<'drums'>
  const loadSongPort = vi.fn(async () => port)
  return { completedSongs, initialize, loadSongPort, openSession, port }
}

function projectFromCapture(
  capture: DrumProjectCapture,
  options: {
    readonly id?: string
    readonly title?: string
    readonly revision?: number
    readonly updatedAt?: string
    readonly transform?: (capture: DrumProjectCapture) => DrumProjectCapture
  } = {},
): DrumProject {
  const createdAt = '2026-08-26T08:00:00.000Z'
  const transformed = options.transform?.(capture) ?? capture
  return serializeDrumProject({
    ...transformed,
    id: options.id ?? 'project-first-pocket',
    title: options.title ?? 'First Pocket Project',
    revision: options.revision ?? 0,
    createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  })
}

/* eslint-disable solid/reactivity -- controller fakes intentionally sample injected accessors per command */
function projectHarness(
  options: {
    readonly projects?: (capture: DrumProjectCapture) => readonly DrumProject[]
    readonly flush?: boolean | Promise<boolean>
    readonly beforeOpen?: () => Promise<void>
    readonly dirtyOnMutation?: boolean
  } = {},
) {
  const [libraryState, setLibraryState] =
    createSignal<DrumProjectLibraryState>('idle')
  const [projects, setProjects] = createSignal<readonly DrumProject[]>([])
  const [currentProject, setCurrentProject] = createSignal<DrumProject | null>(
    null,
  )
  const [dirty, setDirty] = createSignal(false)
  const [saveState, setSaveState] = createSignal<DrumProjectSaveState>('idle')
  const [operation, setOperation] =
    createSignal<DrumProjectControllerOperation>('idle')
  const [failure, setFailure] =
    createSignal<DrumProjectControllerFailure | null>(null)
  let controllerOptions: DrumProjectControllerOptions | null = null
  let flushResult: boolean | Promise<boolean> = options.flush ?? true
  let operationGeneration = 0
  let createOrdinal = 0
  const captures: DrumProjectCapture[] = []
  const appliedProjects: HydratedDrumProject[] = []

  const initialize = vi.fn<DrumProjectController['initialize']>(async () => {
    setLibraryState('loading')
    await Promise.resolve()
    setLibraryState('ready')
    return { ok: true, value: projects() }
  })
  const listProjects = vi.fn<DrumProjectController['listProjects']>(
    async () => {
      setLibraryState('ready')
      return { ok: true, value: projects() }
    },
  )
  const createProject = vi.fn<DrumProjectController['createProject']>(
    async (title) => {
      if (controllerOptions === null) {
        return { ok: false, code: 'storage-unavailable' }
      }
      const previousProject = currentProject()
      const capture = controllerOptions.capture()
      createOrdinal += 1
      const project = projectFromCapture(capture, {
        id: `created-project-${createOrdinal}`,
        title,
      })
      setProjects((current) => [
        project,
        ...current.filter((candidate) => candidate.id !== project.id),
      ])
      setCurrentProject(project)
      setDirty(false)
      setSaveState('saved')
      setLibraryState('ready')
      controllerOptions.onActiveBoundary?.({
        reason: 'create',
        previousProject,
        currentProject: project,
      })
      return { ok: true, value: project }
    },
  )
  const openProject = vi.fn<DrumProjectController['openProject']>(
    async (projectId) => {
      if (controllerOptions === null) {
        return { ok: false, code: 'storage-unavailable' }
      }
      const project = projects().find((candidate) => candidate.id === projectId)
      if (project === undefined) return { ok: false, code: 'not-found' }
      const generation = ++operationGeneration
      setOperation('opening')
      await options.beforeOpen?.()
      if (generation !== operationGeneration) {
        setOperation('idle')
        return { ok: false, code: 'superseded' }
      }
      const hydrated = hydrateDrumProject(project)
      appliedProjects.push(hydrated)
      const accepted = await controllerOptions.apply(hydrated)
      setOperation('idle')
      if (!accepted) return { ok: false, code: 'apply-rejected' }
      const previousProject = currentProject()
      setCurrentProject(project)
      setDirty(false)
      setSaveState('saved')
      controllerOptions.onActiveBoundary?.({
        reason: 'open',
        previousProject,
        currentProject: project,
      })
      return { ok: true, value: project }
    },
  )
  const renameProject = vi.fn<DrumProjectController['renameProject']>(
    async (projectId, title) => {
      const project = projects().find((candidate) => candidate.id === projectId)
      if (project === undefined) return { ok: false, code: 'not-found' }
      const renamed = Object.freeze({ ...project, title })
      setProjects((current) =>
        current.map((candidate) =>
          candidate.id === projectId ? renamed : candidate,
        ),
      )
      if (currentProject()?.id === projectId) setCurrentProject(renamed)
      return { ok: true, value: renamed }
    },
  )
  const deleteProject = vi.fn<DrumProjectController['deleteProject']>(
    async (projectId) => {
      const previousProject = currentProject()
      setProjects((current) =>
        current.filter((candidate) => candidate.id !== projectId),
      )
      if (previousProject?.id === projectId) {
        setCurrentProject(null)
        controllerOptions?.onActiveBoundary?.({
          reason: 'delete',
          previousProject,
          currentProject: null,
        })
      }
      return { ok: true, value: undefined }
    },
  )
  const eraseAll = vi.fn<DrumProjectController['eraseAll']>(async () => {
    const previousProject = currentProject()
    setProjects([])
    setCurrentProject(null)
    controllerOptions?.onActiveBoundary?.({
      reason: 'erase',
      previousProject,
      currentProject: null,
    })
    return { ok: true, value: undefined }
  })
  const cancelPendingOperation = vi.fn(() => {
    operationGeneration += 1
    setOperation('idle')
  })
  const detach = vi.fn<DrumProjectController['detach']>(() => {
    const previousProject = currentProject()
    setCurrentProject(null)
    setDirty(false)
    setSaveState('idle')
    controllerOptions?.onActiveBoundary?.({
      reason: 'leave',
      previousProject,
      currentProject: null,
    })
    return { ok: true, value: undefined }
  })
  const markDirty = vi.fn<DrumProjectController['markDirty']>(() => {
    if (controllerOptions === null || currentProject() === null) {
      return { ok: false, code: 'not-found' }
    }
    captures.push(controllerOptions.capture())
    if (options.dirtyOnMutation === true) {
      setDirty(true)
      setSaveState('dirty')
    }
    return { ok: true, value: undefined }
  })
  const retrySave = vi.fn<DrumProjectController['retrySave']>(async () => {
    const project = currentProject()
    if (project === null) return { ok: false, code: 'not-found' }
    setDirty(false)
    setSaveState('saved')
    return { ok: true, value: project }
  })
  const revert = vi.fn<DrumProjectController['revert']>(async () => {
    const project = currentProject()
    if (project === null) return { ok: false, code: 'not-found' }
    if (controllerOptions === null) {
      return { ok: false, code: 'storage-unavailable' }
    }
    const accepted = await controllerOptions.apply(hydrateDrumProject(project))
    if (!accepted) return { ok: false, code: 'apply-rejected' }
    setDirty(false)
    setSaveState('saved')
    return { ok: true, value: project }
  })
  const flush = vi.fn<DrumProjectController['flush']>(async () => flushResult)
  const dispose = vi.fn()
  const controller = {
    libraryState,
    projects,
    skippedRecords: () => 0,
    futureRecords: () => 0,
    currentProject,
    dirty,
    saveState,
    operation,
    failure,
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
  } satisfies DrumProjectController
  const createProjectController = vi.fn(
    (nextOptions: DrumProjectControllerOptions) => {
      controllerOptions = nextOptions
      const seeded = options.projects?.(nextOptions.capture()) ?? []
      setProjects(seeded)
      return controller
    },
  )
  return {
    appliedProjects,
    cancelPendingOperation,
    captures,
    controller,
    createProjectController,
    createProject,
    detach,
    flush,
    initialize,
    markDirty,
    openProject,
    options: () => controllerOptions,
    setFailure,
    setFlushResult(next: boolean | Promise<boolean>) {
      flushResult = next
    },
  }
}
/* eslint-enable solid/reactivity */

function takeHistoryHarness(
  options: {
    readonly finish?: readonly (boolean | Promise<boolean>)[]
    readonly retry?: readonly (boolean | Promise<boolean>)[]
  } = {},
) {
  const [finishState, setFinishState] = createSignal<DrumTakeFinishState>({
    kind: 'idle',
  })
  const [historyState, setHistoryState] =
    createSignal<DrumTakeHistoryControllerState>({ kind: 'idle' })
  const finishResults = [...(options.finish ?? [true])]
  const retryResults = [...(options.retry ?? [true])]
  let activeProjectId: string | null = null
  const summaries: DrumTakeSummary[] = []
  const finish = vi.fn<DrumTakeHistoryController['finish']>(async (summary) => {
    summaries.push(summary)
    setFinishState({ kind: 'saving' })
    const saved = await (finishResults.shift() ?? true)
    setFinishState(
      saved
        ? { kind: 'saved', message: 'Compact summary saved.' }
        : { kind: 'error', message: 'Local write failed.' },
    )
    return saved
  })
  const retryFinish = vi.fn<DrumTakeHistoryController['retryFinish']>(
    async () => {
      setFinishState({ kind: 'saving' })
      const saved = await (retryResults.shift() ?? true)
      setFinishState(
        saved
          ? { kind: 'saved', message: 'Compact summary saved.' }
          : { kind: 'error', message: 'Local write failed.' },
      )
      return saved
    },
  )
  const loadHistory = vi.fn<DrumTakeHistoryController['loadHistory']>(
    async (projectId) => {
      setHistoryState({
        kind: 'ready',
        summaries: summaries.filter(
          (summary) => summary.projectId === projectId,
        ),
        skippedRecords: 0,
        futureRecords: 0,
      })
      return true
    },
  )
  const retryHistory = vi.fn<DrumTakeHistoryController['retryHistory']>(
    async () => true,
  )
  const setActiveProject = vi.fn<DrumTakeHistoryController['setActiveProject']>(
    (projectId) => {
      activeProjectId = projectId
    },
  )
  const invalidatePendingTake = vi.fn(() => setFinishState({ kind: 'idle' }))
  const dispose = vi.fn()
  const controller = {
    finishState,
    historyState,
    finish,
    retryFinish,
    loadHistory,
    retryHistory,
    setActiveProject,
    invalidatePendingTake,
    dispose,
  } satisfies DrumTakeHistoryController
  const createTakeHistoryController = vi.fn(() => controller)
  return {
    activeProjectId: () => activeProjectId,
    controller,
    createTakeHistoryController,
    finish,
    invalidatePendingTake,
    retryFinish,
    summaries,
  }
}

function renderRoom(options?: {
  readonly access?: DrumMidiAccessPort
  readonly activationResults?: readonly boolean[]
  readonly clock?: DrumRuntimeClock
  readonly click?: ReturnType<typeof clickHarness>
  readonly createScoreIndex?: (
    document: Extract<DrumSessionImportState, { status: 'ready' }>['document'],
  ) => DrumScoreIndex
  readonly importSession?: ReturnType<typeof importSessionHarness>
  readonly loadSongPort?: () => Promise<PlayAlongSongSourcePort<'drums'>>
  readonly loadBandPreparationPort?: () => Promise<PlayAlongBandPreparationPort>
  readonly checkBandPreflight?: (
    sessionId: string,
  ) => CloudSplitBlocker | null | Promise<CloudSplitBlocker | null>
  readonly onReadySessionChange?: (
    document:
      | Extract<DrumSessionImportState, { status: 'ready' }>['document']
      | null,
  ) => void
  readonly requestAccess?: () => Promise<DrumMidiAccessPort>
  readonly schedulerAudioReady?: boolean
  readonly maxRecordedHits?: number
  readonly project?: ReturnType<typeof projectHarness>
  readonly takeHistory?: ReturnType<typeof takeHistoryHarness>
}) {
  const session = sessionHarness(options?.schedulerAudioReady)
  const player = playerHarness('mercury-synth', options?.activationResults)
  const importSession = options?.importSession ?? importSessionHarness()
  const requestAccess =
    options?.requestAccess ??
    vi.fn(async () => options?.access ?? midiAccess([]))
  const mounted = render(() => (
    <DrumNightApp
      createAudioSession={() => session.session}
      createClickController={options?.click?.createClickController}
      createPlayer={player.createPlayer}
      createScoreIndex={options?.createScoreIndex}
      createSessionController={() => importSession.controller}
      createProjectController={options?.project?.createProjectController}
      createTakeHistoryController={
        options?.takeHistory?.createTakeHistoryController
      }
      loadSongPort={options?.loadSongPort}
      loadBandPreparationPort={options?.loadBandPreparationPort}
      checkBandPreflight={options?.checkBandPreflight}
      onReadySessionChange={options?.onReadySessionChange}
      runtimeOptions={{
        clock: options?.clock,
        maxRecordedHits: options?.maxRecordedHits,
        midiEnvironment: {
          requestAccess,
          nowMs: options?.clock?.nowMs ?? (() => performance.now()),
          timeOriginMs: () => performance.timeOrigin,
        },
      }}
    />
  ))
  return { ...mounted, importSession, player, requestAccess, session }
}

async function openGrooveDrawer(): Promise<HTMLElement> {
  fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
  const drawer = screen.getByRole('region', { name: 'Shape the groove' })
  await within(drawer).findByTestId('drum-groove-editor')
  return drawer
}

async function saveCurrentGroove(name: string): Promise<void> {
  const drawer = await openGrooveDrawer()
  fireEvent.click(within(drawer).getByRole('button', { name: 'Save project' }))
  const library = await screen.findByTestId('drum-project-library')
  const nameInput = within(library).getByRole('textbox', {
    name: 'Project name',
  })
  await waitFor(() => expect(nameInput).toHaveFocus())
  fireEvent.input(nameInput, { target: { value: name } })
  fireEvent.click(
    within(library).getByRole('button', { name: 'Save on this device' }),
  )
  await waitFor(() =>
    expect(within(library).getByText('Saved on this device')).toBeVisible(),
  )
}

function singleFileList(file: File): FileList {
  return {
    0: file,
    length: 1,
    item: () => file,
  } as unknown as FileList
}

async function recordOnePreparedHit(clock: TestClock): Promise<void> {
  fireEvent.click(
    screen.getByRole('button', { name: 'Count-in: 4 audible beats' }),
  )
  fireEvent.click(
    screen.getAllByRole('button', {
      name: 'Play First Pocket take clock',
    })[0],
  )
  await waitFor(() =>
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-playing',
      'true',
    ),
  )
  clock.advanceTo(clock.nowMs() + 250)
  dispatchPointerDown(
    within(openDrummerSeatKit()).getByRole('button', {
      name: /Play Acoustic snare/i,
    }),
    { button: 0, isPrimary: true, pressure: 0.7 },
  )
  await waitFor(() =>
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '1 hits',
    ),
  )
}

let createAudioContext: ReturnType<typeof vi.fn>
let createWorker: ReturnType<typeof vi.fn>
let fetchRequest: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

beforeEach(() => {
  window.history.replaceState({}, '', '/drum-night')
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1280,
  })
  localStorage.clear()
  createAudioContext = vi.fn()
  createWorker = vi.fn()
  fetchRequest = vi.fn()
  getUserMedia = vi.fn()
  vi.stubGlobal('AudioContext', createAudioContext)
  vi.stubGlobal('fetch', fetchRequest)
  vi.stubGlobal('Worker', createWorker)
  originalGetUserMedia = navigator.mediaDevices.getUserMedia
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: getUserMedia,
  })
})

afterEach(() => {
  stemConfigureFailure.next = false
  takeSummaryBuilderLoad.gate = null
  takeSummaryBuilderLoad.entered.mockClear()
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: originalGetUserMedia,
  })
})

describe('DrumNightApp', () => {
  it('mounts without Web Audio, samples, MIDI, workers, or microphone work', () => {
    const room = renderRoom()

    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-view',
      'pocket',
    )
    expect(
      screen.getByText(/Audio, samples, and MIDI stay off/i),
    ).toBeInTheDocument()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
    expect(room.requestAccess).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()
    expect(fetchRequest).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.queryByText('EARLY')).not.toBeInTheDocument()
    expect(screen.queryByText('ON')).not.toBeInTheDocument()
    expect(screen.queryByText('LATE')).not.toBeInTheDocument()
  })

  it('keeps Projects dormant until explicit intent and contextual to the four-tab Groove rack', async () => {
    const project = projectHarness()
    renderRoom({ project })

    expect(project.createProjectController).not.toHaveBeenCalled()
    const drawer = await openGrooveDrawer()
    expect(project.createProjectController).not.toHaveBeenCalled()
    const tabs = within(drawer).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Groove',
      'Kit',
      'Mix',
      'Room',
    ])
    expect(within(drawer).queryByRole('tab', { name: 'Projects' })).toBeNull()

    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    const library = await screen.findByTestId('drum-project-library')
    await waitFor(() => expect(project.initialize).toHaveBeenCalledOnce())
    expect(project.createProjectController).toHaveBeenCalledOnce()
    expect(window.location.search).toBe('?drawer=projects')
    expect(
      within(
        screen.getByRole('complementary', { name: 'Drum Night sections' }),
      ).getByRole('button', { name: 'Groove' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(within(library).getByText('No saved grooves yet')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Rack controls' })).toBeVisible()
    expect(
      screen.getByRole('navigation', { name: 'Drum Night navigation' }),
    ).not.toHaveTextContent('Projects')

    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    expect(
      screen.getByRole('region', { name: 'Shape the groove' }),
    ).toBeVisible()
    expect(window.location.search).toBe('?drawer=groove')
  })

  it('keeps save-recovery focus on Projects Retry after the drawer handoff settles', async () => {
    const project = projectHarness()
    renderRoom({ project })
    let drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    await screen.findByTestId('drum-project-library')
    await waitFor(() => expect(project.initialize).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    drawer = screen.getByRole('region', { name: 'Shape the groove' })
    await settleMicrotasks()
    project.setFailure({ action: 'save', code: 'storage-unavailable' })
    const projects = within(drawer).getByRole('button', { name: 'Projects' })
    projects.focus()
    fireEvent.click(projects)

    const retry = await screen.findByRole('button', {
      name: 'Try save again',
    })
    await settleMicrotasks()
    expect(retry).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Rack controls' }),
    ).not.toHaveFocus()
  })

  it('creates and initializes Projects from Save without applying, resetting, playing, or activating audio', async () => {
    const project = projectHarness()
    const room = renderRoom({ project })
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    )

    await saveCurrentGroove('Studio Pocket')

    expect(project.createProjectController).toHaveBeenCalledOnce()
    expect(project.initialize).toHaveBeenCalled()
    expect(project.createProject).toHaveBeenCalledWith('Studio Pocket')
    expect(project.appliedProjects).toHaveLength(0)
    expect(timeline).toHaveAttribute('data-loop-state', 'active')
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-playing',
      'false',
    )
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
  })

  it('plays Learn from the active project without resetting or autosaving its current state', async () => {
    const project = projectHarness()
    renderRoom({ project })

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }))
    expect(
      screen.getByRole('button', { name: 'Play First Pocket at 84 BPM' }),
    ).toBeVisible()

    await saveCurrentGroove('Learn Pocket')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    await waitFor(() => expect(project.markDirty).toHaveBeenCalled())
    project.markDirty.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play Learn Pocket' }))

    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    expect(project.createProject).toHaveBeenCalledOnce()
    expect(project.controller.currentProject()?.title).toBe('Learn Pocket')
    expect(
      within(screen.getByLabelText('Authored tempo')).getByText('86'),
    ).toBeVisible()
    expect(project.markDirty).not.toHaveBeenCalled()
  })

  it('protects navigation only for a dirty active project', async () => {
    const project = projectHarness({ dirtyOnMutation: true })
    renderRoom({ project })
    const dispatchBeforeUnload = (): BeforeUnloadEvent => {
      const event = new Event('beforeunload', {
        bubbles: false,
        cancelable: true,
      }) as BeforeUnloadEvent
      window.dispatchEvent(event)
      return event
    }

    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    expect(project.createProjectController).not.toHaveBeenCalled()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    await saveCurrentGroove('Navigation Guard Pocket')
    expect(project.controller.dirty()).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    await waitFor(() => expect(project.controller.dirty()).toBe(true))
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
  })

  it('queues the latest saved-project groove, family, tempo, count-in, click, and A B mutations', async () => {
    const click = clickHarness()
    const project = projectHarness()
    renderRoom({ click, project })
    await saveCurrentGroove('Mutable Pocket')

    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    const drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const editor = within(drawer).getByTestId('drum-groove-editor')
    fireEvent.click(
      within(editor).getByRole('button', {
        name: 'Add Hi-Mid Tom at bar 1, beat 1 e',
      }),
    )
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Mix' }))
    const kickLevel = await within(drawer).findByRole('slider', {
      name: 'Kick authored level',
    })
    fireEvent.input(kickLevel, { target: { value: '55' } })
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Mute authored Kick' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Count-in: 4 audible beats' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Playback click: off' }))
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    )

    await waitFor(() => {
      const latest = project.captures.at(-1)
      expect(latest?.drafts.source.revision).toBeGreaterThan(0)
      expect(latest?.authoredFamilyMix.kick).toEqual({
        level: 0.55,
        muted: true,
      })
      expect(latest?.tempoBpm).toBe(86)
      expect(latest?.countInBeats).toBe(0)
      expect(latest?.clickEnabled).toBe(true)
      expect(latest?.loopRange).toEqual(
        expect.objectContaining({ startBeat: 0 }),
      )
      expect(latest?.loopRange?.endBeat).toBeGreaterThan(0)
    })
    expect(project.markDirty).toHaveBeenCalled()
  })

  it('opens a hydrated same-variation project as a silent hard boundary', async () => {
    const clock = new TestClock()
    const click = clickHarness()
    const project = projectHarness({
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'hydrated-source-pocket',
          title: 'Hydrated Pocket',
          transform: (current) => ({
            ...current,
            drafts: {
              ...current.drafts,
              source: {
                ...current.drafts.source,
                revision: 11,
                swing: 0.5,
                density: 0.55,
              },
            },
            authoredFamilyMix: {
              ...current.authoredFamilyMix,
              kick: { level: 0.42, muted: true },
            },
            tempoBpm: 110,
            countInBeats: 4,
            clickEnabled: true,
            loopRange: null,
          }),
        }),
      ],
    })
    const room = renderRoom({ click, clock, project })
    await recordOnePreparedHit(clock)
    const activationCount = room.player.activate.mock.calls.length
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    )
    expect(timeline).toHaveAttribute('data-loop-state', 'active')

    const grooveDrawer = await openGrooveDrawer()
    fireEvent.click(
      within(grooveDrawer).getByRole('button', { name: 'Projects' }),
    )
    const library = await screen.findByTestId('drum-project-library')
    fireEvent.click(
      await within(library).findByRole('button', { name: 'Open' }),
    )
    fireEvent.click(
      within(library).getByRole('button', { name: 'Discard and open' }),
    )

    await waitFor(() =>
      expect(project.openProject).toHaveBeenCalledWith(
        'hydrated-source-pocket',
      ),
    )
    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(project.appliedProjects).toHaveLength(1)
    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-playing',
      'false',
    )
    expect(
      screen.getByRole('button', { name: 'Count-in: 4 audible beats' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Playback click: on' }),
    ).toBeVisible()
    expect(
      within(screen.getByLabelText('Authored tempo')).getByText('110'),
    ).toBeVisible()
    expect(room.player.setAuthoredFamilyVolume).toHaveBeenCalledWith('kick', 0)
    expect(room.player.activate).toHaveBeenCalledTimes(activationCount)
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    const reopenedDrawer = screen.getByRole('region', {
      name: 'Shape the groove',
    })
    const editor =
      await within(reopenedDrawer).findByTestId('drum-groove-editor')
    expect(
      within(editor).getByRole('button', { name: 'Soft' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(editor).getByRole('button', { name: 'Essential' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the authored scheduler subscribed after a saved project apply', async () => {
    const clock = new TestClock()
    const project = projectHarness({
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'scheduler-project',
          title: 'Scheduler Pocket',
        }),
      ],
    })
    const room = renderRoom({ clock, project })
    const drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    const library = await screen.findByTestId('drum-project-library')
    fireEvent.click(
      await within(library).findByRole('button', { name: 'Open' }),
    )
    await waitFor(() =>
      expect(project.controller.currentProject()?.id).toBe('scheduler-project'),
    )

    const editor = await screen.findByTestId('drum-groove-editor')
    fireEvent.click(
      within(editor).getByRole('button', {
        name: 'Add Hi-Mid Tom at bar 1, beat 1',
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByText(/Built-in groove · 29 mapped hits/),
      ).toBeVisible(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close rack drawer' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Count-in: 4 audible beats' }),
    )
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )

    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          gmKey: 48,
          sourceId: expect.stringMatching(/^authored:/),
        }),
      ),
    )
  })

  it('commits a validated project atomically and surfaces degraded playback truth when a collaborator throws', async () => {
    const clock = new TestClock()
    const project = projectHarness({
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'fallible-target',
          title: 'Fallible Half-time',
          transform: (current) => ({
            ...current,
            selectedVariantId: 'half-time',
            drafts: {
              ...current.drafts,
              'half-time': {
                ...current.drafts['half-time'],
                revision: 17,
                swing: 1,
                density: 1,
              },
            },
            authoredFamilyMix: {
              ...current.authoredFamilyMix,
              kick: { level: 0.2, muted: true },
            },
            tempoBpm: 112,
          }),
        }),
      ],
    })
    const room = renderRoom({ clock, project })
    await saveCurrentGroove('Original Classic')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    let editor = screen.getByTestId('drum-groove-editor')
    fireEvent.click(within(editor).getByRole('button', { name: 'Soft' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    await recordOnePreparedHit(clock)

    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    )
    expect(timeline).toHaveAttribute('data-loop-state', 'active')

    const drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    const library = await screen.findByTestId('drum-project-library')
    const targetRow = (
      await within(library).findByText('Fallible Half-time')
    ).closest('article')!
    const failingFamilyVolume = vi.fn(() => {
      throw new Error('family mixer unavailable')
    })
    Object.assign(room.player.player, {
      setAuthoredFamilyVolume: failingFamilyVolume,
    })
    fireEvent.click(within(targetRow).getByRole('button', { name: 'Open' }))

    await waitFor(() =>
      expect(project.openProject).toHaveBeenCalledWith('fallible-target'),
    )
    await expect(project.openProject.mock.results[0]?.value).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    )
    expect(failingFamilyVolume).toHaveBeenCalled()
    expect(project.controller.currentProject()).toEqual(
      expect.objectContaining({
        id: 'fallible-target',
        title: 'Fallible Half-time',
      }),
    )
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '0 hits',
    )
    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(
      screen.getByRole('button', {
        name: /First Pocket — Half-time Built-in groove/,
      }),
    ).toBeVisible()
    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'false',
      ),
    )
    expect(
      screen.getByText(
        'Fallible Half-time is on stage, but one playback service needs retry.',
      ),
    ).toBeVisible()

    editor = await screen.findByTestId('drum-groove-editor')
    expect(editor).toHaveAttribute('aria-label', 'Half-time groove editor')
    expect(
      within(editor).getByRole('button', { name: 'Triplet' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(editor).getByRole('button', { name: 'All hits' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('detaches a selected song and activates the project when backing release collaborators throw', async () => {
    const backing = preparedBackingHarness({
      sessionId: 'fragile-backing',
      title: 'Fragile Backing',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([backing])
    const project = projectHarness({
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'detached-project',
          title: 'Detached Project',
        }),
      ],
    })
    renderRoom({ loadSongPort: catalog.loadSongPort, project })
    let drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    await screen.findByTestId('drum-project-library')
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.click(
      await within(drawer).findByRole('button', {
        name: /Fragile Backing.*Two stems.*Load backing/i,
      }),
    )
    await within(drawer).findByText('Backing with drums inside')
    expect(new URLSearchParams(window.location.search).get('song')).toBe(
      'fragile-backing',
    )

    const projectsUrl = new URL(window.location.href)
    projectsUrl.searchParams.set('drawer', 'projects')
    window.history.pushState({}, '', projectsUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
    const library = await screen.findByTestId('drum-project-library')
    backing.release.mockImplementationOnce(() => {
      throw new Error('object URL release failed')
    })
    stemConfigureFailure.next = true
    fireEvent.click(
      await within(library).findByRole('button', { name: 'Open' }),
    )
    fireEvent.click(
      await within(library).findByRole('button', {
        name: 'Discard and open',
      }),
    )

    await waitFor(() =>
      expect(project.openProject).toHaveBeenCalledWith('detached-project'),
    )
    await expect(project.openProject.mock.results[0]?.value).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    )
    await waitFor(() =>
      expect(project.controller.currentProject()?.id).toBe('detached-project'),
    )
    expect(stemConfigureFailure.next).toBe(false)
    expect(backing.release).toHaveBeenCalledOnce()
    expect(new URLSearchParams(window.location.search).get('song')).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /First Pocket.*Built-in groove/,
      }),
    ).toBeVisible()

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    expect(await within(drawer).findByText('No backing selected')).toBeVisible()
  })

  it('blocks a source switch on failed project flush and detaches before a successful import', async () => {
    const project = projectHarness({ flush: false })
    const importSession = importSessionHarness()
    renderRoom({ importSession, project })
    await saveCurrentGroove('Source Guard Pocket')
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    let drawer = screen.getByRole('region', { name: 'Bring a song' })
    const file = new File([new Uint8Array([1, 2, 3])], 'guard.mid', {
      type: 'audio/midi',
    })
    fireEvent.change(
      await within(drawer).findByTestId('drum-play-along-file-drop-input'),
      { target: { files: singleFileList(file) } },
    )

    await waitFor(() => expect(project.flush).toHaveBeenCalledOnce())
    expect(project.detach).not.toHaveBeenCalled()
    expect(importSession.importFile).not.toHaveBeenCalled()
    expect(
      screen.getByRole('region', { name: 'Saved drum projects' }),
    ).toBeVisible()

    project.setFlushResult(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.change(
      await within(drawer).findByTestId('drum-play-along-file-drop-input'),
      { target: { files: singleFileList(file) } },
    )

    await waitFor(() =>
      expect(importSession.importFile).toHaveBeenCalledWith(file),
    )
    expect(project.flush).toHaveBeenCalledTimes(2)
    expect(project.detach).toHaveBeenCalledOnce()
    expect(project.flush.mock.invocationCallOrder[1]).toBeLessThan(
      project.detach.mock.invocationCallOrder[0],
    )
    expect(project.detach.mock.invocationCallOrder[0]).toBeLessThan(
      importSession.importFile.mock.invocationCallOrder[0],
    )
  })

  it('does not let an older source flush detach or import over a newer opened project', async () => {
    const flushGate = deferred<boolean>()
    const project = projectHarness({
      flush: flushGate.promise,
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'newer-project',
          title: 'Newer Pocket',
        }),
      ],
    })
    const importSession = importSessionHarness()
    renderRoom({ importSession, project })
    await saveCurrentGroove('Older Pocket')

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    let drawer = screen.getByRole('region', { name: 'Bring a song' })
    const file = new File([new Uint8Array([7])], 'older-intent.mid')
    fireEvent.change(
      await within(drawer).findByTestId('drum-play-along-file-drop-input'),
      { target: { files: singleFileList(file) } },
    )
    await waitFor(() => expect(project.flush).toHaveBeenCalledOnce())

    drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    const library = await screen.findByTestId('drum-project-library')
    const targetRow = (
      await within(library).findByText('Newer Pocket')
    ).closest('article')!
    fireEvent.click(within(targetRow).getByRole('button', { name: 'Open' }))
    await waitFor(() =>
      expect(project.openProject).toHaveBeenCalledWith('newer-project'),
    )
    await waitFor(() =>
      expect(project.controller.currentProject()?.id).toBe('newer-project'),
    )

    flushGate.resolve(true)
    await settleMicrotasks()
    expect(project.detach).not.toHaveBeenCalled()
    expect(importSession.importFile).not.toHaveBeenCalled()
    expect(project.controller.currentProject()?.id).toBe('newer-project')
  })

  it('does not apply an older pending project read after a newer authored-file import', async () => {
    const openGate = deferred<undefined>()
    const project = projectHarness({
      beforeOpen: () => openGate.promise,
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'older-project',
          title: 'Older Pocket',
        }),
      ],
    })
    const ready = readySessionFixture({ title: 'Newer Imported Pocket' })
    const importSession = importSessionHarness()
    importSession.setNextResult(ready)
    renderRoom({ importSession, project })
    let drawer = await openGrooveDrawer()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
    const library = await screen.findByTestId('drum-project-library')
    fireEvent.click(
      await within(library).findByRole('button', { name: 'Open' }),
    )
    await waitFor(() =>
      expect(project.openProject).toHaveBeenCalledWith('older-project'),
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    const file = new File([new Uint8Array([9])], 'newer-intent.mid')
    fireEvent.change(
      await within(drawer).findByTestId('drum-play-along-file-drop-input'),
      { target: { files: singleFileList(file) } },
    )
    await waitFor(() =>
      expect(importSession.importFile).toHaveBeenCalledWith(file),
    )
    openGate.resolve(undefined)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Newer Imported Pocket' }),
      ).toBeVisible(),
    )
    expect(project.cancelPendingOperation).toHaveBeenCalled()
    expect(project.appliedProjects).toHaveLength(0)
    expect(project.controller.currentProject()).toBeNull()
  })

  it('abandons a Finish paused in lazy preparation when a newer project takes the stage', async () => {
    const builderGate = deferred<undefined>()
    takeSummaryBuilderLoad.gate = builderGate.promise
    const clock = new TestClock()
    const project = projectHarness({
      projects: (capture) => [
        projectFromCapture(capture, {
          id: 'new-finish-stage',
          title: 'New Finish Stage',
          transform: (current) => ({
            ...current,
            selectedVariantId: 'half-time',
          }),
        }),
      ],
    })
    const takeHistory = takeHistoryHarness()
    renderRoom({ clock, project, takeHistory })
    await saveCurrentGroove('Old Finish Stage')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close rack drawer' }))
    await recordOnePreparedHit(clock)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish take' }))

    try {
      await waitFor(() =>
        expect(takeSummaryBuilderLoad.entered).toHaveBeenCalledOnce(),
      )
      expect(screen.getByRole('button', { name: 'Saving take' })).toBeDisabled()

      const drawer = await openGrooveDrawer()
      fireEvent.click(within(drawer).getByRole('button', { name: 'Projects' }))
      const library = await screen.findByTestId('drum-project-library')
      const targetRow = (
        await within(library).findByText('New Finish Stage')
      ).closest('article')!
      fireEvent.click(within(targetRow).getByRole('button', { name: 'Open' }))
      await waitFor(() =>
        expect(project.controller.currentProject()?.id).toBe(
          'new-finish-stage',
        ),
      )
    } finally {
      takeSummaryBuilderLoad.gate = null
      builderGate.resolve(undefined)
    }

    await settleMicrotasks()
    expect(takeHistory.finish).not.toHaveBeenCalled()
    expect(project.controller.currentProject()?.id).toBe('new-finish-stage')
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '0 hits',
    )
    expect(screen.queryByRole('button', { name: 'Saving take' })).toBeNull()
    expect(
      screen.queryByText(/take could not be saved|Local write failed/i),
    ).toBeNull()
  })

  it('starts only one Finish pipeline when the control is activated twice rapidly', async () => {
    const flushGate = deferred<boolean>()
    const clock = new TestClock()
    const project = projectHarness({ flush: flushGate.promise })
    const takeHistory = takeHistoryHarness()
    renderRoom({ clock, project, takeHistory })
    await recordOnePreparedHit(clock)
    await saveCurrentGroove('Single Finish Pocket')
    const finish = await screen.findByRole('button', { name: 'Finish take' })

    fireEvent.click(finish)
    fireEvent.click(finish)

    await waitFor(() => expect(project.flush).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Saving take' })).toBeDisabled()
    expect(takeHistory.finish).not.toHaveBeenCalled()
    flushGate.resolve(true)

    await waitFor(() => expect(takeHistory.finish).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(takeHistory.summaries).toHaveLength(1)
  })

  it('offers Finish only after saving and clears evidence only after a successful commit before re-arming next Play', async () => {
    const clock = new TestClock()
    const finishGate = deferred<boolean>()
    const project = projectHarness()
    const takeHistory = takeHistoryHarness({
      finish: [finishGate.promise, true],
    })
    const room = renderRoom({ clock, project, takeHistory })
    await recordOnePreparedHit(clock)

    expect(takeHistory.createTakeHistoryController).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Finish take' })).toBeNull()
    await saveCurrentGroove('Finished Pocket')
    const finish = await screen.findByRole('button', { name: 'Finish take' })
    expect(takeHistory.createTakeHistoryController).not.toHaveBeenCalled()
    fireEvent.click(finish)

    await waitFor(() => expect(takeHistory.finish).toHaveBeenCalledOnce())
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '1 hits',
    )
    expect(screen.getByRole('button', { name: 'Saving take' })).toBeDisabled()
    finishGate.resolve(true)

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(takeHistory.summaries).toHaveLength(1)
    expect(takeHistory.summaries[0]).toEqual(
      expect.objectContaining({ projectId: 'created-project-1' }),
    )
    const takeEvents = screen.getByText('Take events').closest('button')!
    expect(takeEvents).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const audibleCountIn = screen.queryByRole('button', {
      name: /Count-in: \d+ audible beats/,
    })
    if (audibleCountIn !== null) fireEvent.click(audibleCountIn)
    expect(screen.getByRole('button', { name: 'Count-in: off' })).toBeVisible()
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(takeEvents).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(takeHistory.invalidatePendingTake).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    clock.advanceTo(clock.nowMs() + 250)
    dispatchPointerDown(
      within(openDrummerSeatKit()).getByRole('button', {
        name: /Play Acoustic snare/i,
      }),
      { button: 0, isPrimary: true, pressure: 0.8 },
    )
    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenLastCalledWith(
        expect.objectContaining({ gmKey: 38 }),
      ),
    )
    await waitFor(() => expect(takeEvents).toHaveTextContent('1 hits'))
    fireEvent.click(await screen.findByRole('button', { name: 'Finish take' }))
    await waitFor(() => expect(takeHistory.finish).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(takeEvents).toHaveTextContent('0 hits'))
    expect(takeHistory.summaries).toHaveLength(2)
  })

  it('keeps failed evidence owned by Retry and blocks re-arming until it saves', async () => {
    const clock = new TestClock()
    const retryGate = deferred<boolean>()
    const project = projectHarness()
    const takeHistory = takeHistoryHarness({
      finish: [false],
      retry: [retryGate.promise],
    })
    const room = renderRoom({ clock, project, takeHistory })
    await saveCurrentGroove('Retry Pocket')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    await recordOnePreparedHit(clock)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish take' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your captured evidence is still here',
      ),
    )
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '1 hits',
    )
    const takeEvents = screen.getByText('Take events').closest('button')!
    expect(takeEvents).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(takeEvents)
    expect(takeEvents).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    clock.advanceTo(clock.nowMs() + 250)
    dispatchPointerDown(
      within(openDrummerSeatKit()).getByRole('button', {
        name: /Play Acoustic snare/i,
      }),
      { button: 0, isPrimary: true, pressure: 0.8 },
    )
    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenLastCalledWith(
        expect.objectContaining({ gmKey: 38 }),
      ),
    )
    expect(takeEvents).toHaveTextContent('1 hits')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your captured evidence is still here',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(takeHistory.retryFinish).toHaveBeenCalledOnce())
    retryGate.resolve(true)

    await waitFor(() => expect(takeEvents).toHaveTextContent('0 hits'))
    expect(takeHistory.invalidatePendingTake).not.toHaveBeenCalled()
    expect(screen.getByText('Compact summary saved.')).toBeVisible()
  })

  it('keeps a failed take through the first discard step and clears it only after confirmation', async () => {
    const clock = new TestClock()
    const project = projectHarness()
    const takeHistory = takeHistoryHarness({ finish: [false] })
    renderRoom({ clock, project, takeHistory })
    await saveCurrentGroove('Discard Pocket')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    await recordOnePreparedHit(clock)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish take' }))
    const discard = await screen.findByRole('button', { name: 'Discard take' })

    fireEvent.click(discard)
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '1 hits',
    )
    expect(screen.getByRole('button', { name: 'Yes, discard' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Keep evidence' }))
    expect(screen.getByText('Take events').closest('button')).toHaveTextContent(
      '1 hits',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discard take' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, discard' }))
    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(takeHistory.invalidatePendingTake).toHaveBeenCalled()
  })

  it('clears already-saved raw evidence when only project context changes during the Finish write', async () => {
    const clock = new TestClock()
    const finishGate = deferred<boolean>()
    const project = projectHarness()
    const takeHistory = takeHistoryHarness({ finish: [finishGate.promise] })
    renderRoom({ clock, project, takeHistory })
    await saveCurrentGroove('Context Pocket')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    await recordOnePreparedHit(clock)
    fireEvent.click(await screen.findByRole('button', { name: 'Finish take' }))
    await waitFor(() => expect(takeHistory.finish).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    const timeline = screen.getByTestId('drum-night-timeline')
    fireEvent.click(
      within(timeline).getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    finishGate.resolve(true)

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(takeHistory.finish).toHaveBeenCalledOnce()
  })

  it('changes only the visual room and keeps premium metadata behind Room', async () => {
    const retainBackgroundCatalog = vi.spyOn(
      premiumBackgroundCatalogStore,
      'retain',
    )
    fetchRequest.mockResolvedValue({
      ok: true,
      json: async () => ({
        assets: [],
        access: {
          authenticated: false,
          activeSupporter: false,
          backgroundIds: [],
          expiresAt: null,
        },
        generatedAt: '2026-08-21T00:00:00.000Z',
      }),
    })
    const room = renderRoom()
    const shell = screen.getByTestId('drum-night-shell')

    expect(shell.style.getPropertyValue('--mp-stage-image')).toContain(
      '/drum-night/pocket-console-landscape.webp',
    )
    expect(fetchRequest).not.toHaveBeenCalled()
    expect(retainBackgroundCatalog).not.toHaveBeenCalled()
    const kitSelectionsBefore = room.player.selectKit.mock.calls.length

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change room, Pocket Console selected',
      }),
    )
    const drawer = screen.getByRole('region', { name: 'Choose the room' })
    const gallery = await within(drawer).findByRole('region', {
      name: 'Choose your Drum Night room',
    })
    await waitFor(() => expect(retainBackgroundCatalog).toHaveBeenCalledOnce())
    expect(within(gallery).getAllByRole('button')).toHaveLength(4)

    fireEvent.click(within(gallery).getByRole('button', { name: /Tape Room/i }))
    expect(shell.style.getPropertyValue('--mp-stage-image')).toContain(
      '/drum-night/tape-room-landscape.webp',
    )
    expect(localStorage.getItem('pitchperfect_drum_background')).toBe(
      'drum-tape-room',
    )
    expect(room.player.selectKit).toHaveBeenCalledTimes(kitSelectionsBefore)
    expect(
      screen.getByText('Tape Room selected. Drum sound unchanged.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Drummer Seat view' }))
    expect(screen.getByTestId('drummer-seat-backdrop')).toBeInTheDocument()

    // Leave the shared controller in its shipped default for later unit cases.
    fireEvent.click(
      within(gallery).getByRole('button', { name: /Pocket Console/i }),
    )
  })

  it('starts sound from pointer and keyboard strikes and uses Space for one transport', async () => {
    const room = renderRoom()
    const touchKit = openDrummerSeatKit()
    const snare = within(touchKit).getByRole('button', {
      name: /Play Acoustic snare/i,
    })

    dispatchPointerDown(snare, {
      button: 2,
      isPrimary: true,
      pressure: 0.5,
    })
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: false,
      pressure: 0.5,
    })
    expect(room.player.trigger).not.toHaveBeenCalled()

    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.5,
    })
    await waitFor(() => expect(room.player.trigger).toHaveBeenCalledTimes(1))
    expect(room.player.activate).toHaveBeenCalledOnce()
    expect(room.session.contextForGesture).toHaveBeenCalledOnce()
    expect(room.session.outputForGesture).toHaveBeenCalledOnce()
    expect(room.player.trigger).toHaveBeenLastCalledWith(
      expect.objectContaining({ gmKey: 38, sourceId: 'snare' }),
    )

    fireEvent.keyDown(window, { code: 'Digit3' })
    await waitFor(() => expect(room.player.trigger).toHaveBeenCalledTimes(2))
    expect(room.player.trigger).toHaveBeenLastCalledWith(
      expect.objectContaining({ gmKey: 36, sourceId: 'Digit3' }),
    )

    fireEvent.keyDown(window, { code: 'Space' })
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause First Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )
    expect(
      screen.getByText(
        'First Pocket is starting on the shared take clock with take events armed.',
      ),
    ).toHaveAttribute('data-visible', 'false')
    expect(room.requestAccess).not.toHaveBeenCalled()
  })

  it('persists all four kit choices and exposes loading fallback, attribution, and retry', async () => {
    const room = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Kit' })[0])
    const drawer = screen.getByRole('region', { name: 'Choose the kit' })
    const kitGroup = within(drawer).getByRole('radiogroup', {
      name: 'Drum sound',
    })

    fireEvent.click(within(kitGroup).getByRole('radio', { name: /Live/i }))
    expect(room.player.selectKit).toHaveBeenCalledWith('live')
    expect(localStorage.getItem('mp.drumNight.kit.v1')).toBe('live')
    expect(within(drawer).getByText(/Vincent/)).toBeVisible()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()

    room.player.updateSnapshot({
      status: 'loading',
      fallbackReady: true,
      plannedSamples: 5,
      preparedSamples: 2,
    })
    expect(
      within(drawer).getByText(/Loading 2 of 5 core samples/i),
    ).toBeVisible()

    room.player.updateSnapshot({
      status: 'error',
      error: 'warm-up failed',
    })
    expect(
      within(drawer).getByText(
        /2 of 5 core samples ready · sample warm-up stopped/i,
      ),
    ).toBeVisible()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Retry Live' }))
    await waitFor(() => expect(room.player.retry).toHaveBeenCalledOnce())

    room.unmount()
    const restored = renderRoom()
    expect(
      within(screen.getByRole('region', { name: 'Choose the kit' })).getByRole(
        'radio',
        { name: /Live/i },
      ),
    ).toHaveAttribute('aria-checked', 'true')
    expect(restored.player.createPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ initialKitId: 'live' }),
    )
  })

  it('connects explicitly, switches inputs, and learns an unmapped note by strike', async () => {
    const first = new FakeMidiInput('a', 'Practice Pad')
    const second = new FakeMidiInput('b', 'Stage E-kit')
    const room = renderRoom({ access: midiAccess([first, second]) })

    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    expect(room.requestAccess).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))
    await waitFor(() => expect(room.requestAccess).toHaveBeenCalledOnce())
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', {
        name: /Practice Pad, press Play once for sound/i,
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
    ).toHaveValue('a')

    fireEvent.click(screen.getByRole('button', { name: 'Close input details' }))
    fireEvent.click(screen.getByRole('button', { name: /Practice Pad/i }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Disconnect MIDI' }),
      ).toHaveFocus(),
    )
    expect(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
    ).not.toHaveFocus()

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
      { target: { value: 'b' } },
    )
    expect(screen.getByRole('button', { name: /Stage E-kit/i })).toBeVisible()
    second.emit([0x99, 20, 115])
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', {
        name: /Stage E-kit, strikes seen · press Play for sound/i,
      }),
    ).toBeVisible()
    expect(screen.getByText(/Raw note 20 on channel 10 needs/i)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review sound and mapping' }),
    )

    const drawer = screen.getByRole('region', { name: 'Choose the kit' })
    const snareLabel = within(drawer).getByText('Acoustic snare')
    const snareRow = snareLabel.parentElement
    expect(snareRow).not.toBeNull()
    expect(
      within(drawer).getByText(/Raw note 20 on channel 10 is not mapped/i),
    ).toBeVisible()
    fireEvent.click(
      within(snareRow as HTMLElement).getByRole('button', { name: 'Learn' }),
    )
    second.emit([0x99, 20, 115])

    await waitFor(() =>
      expect(within(snareRow as HTMLElement).getByText('Raw 20')).toBeVisible(),
    )
    expect(
      within(drawer).queryByText(/Raw note 20 on channel 10 is not mapped/i),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )
    await waitFor(() => expect(room.player.activate).toHaveBeenCalledOnce())
    second.emit([0x99, 20, 115])
    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenCalledWith(
        expect.objectContaining({ gmKey: 38, velocity: 115, sourceId: 'b' }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Stage E-kit/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect MIDI' }))
    expect(
      screen.getByRole('button', { name: /MIDI disconnected/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Scan for MIDI input' }),
    ).toBeEnabled()
  })

  it('distinguishes a granted connection with no visible MIDI inputs', async () => {
    const room = renderRoom({ access: midiAccess([]) })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))

    const inputDialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(inputDialog).getByText('No MIDI inputs found'),
      ).toBeVisible(),
    )
    expect(
      within(inputDialog).getByText(/Permission was granted/i),
    ).toBeVisible()
    expect(room.requestAccess).toHaveBeenCalledOnce()
  })

  it('shows permission denial with a recovery path', async () => {
    const requestAccess = vi.fn(async () => {
      throw new DOMException('blocked', 'NotAllowedError')
    })
    const room = renderRoom({ requestAccess })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))

    const inputDialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(inputDialog).getByText('MIDI permission blocked'),
      ).toBeVisible(),
    )
    expect(
      within(inputDialog).getByText(/browser site settings/i),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Scan for MIDI input' }),
    ).toBeEnabled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
  })

  it('collects and applies five MIDI strikes on the shared performance timeline', async () => {
    vi.useFakeTimers()
    const input = new FakeMidiInput('kit', 'Calibration Kit')
    renderRoom({ access: midiAccess([input]) })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))
    await vi.runAllTicks()
    await Promise.resolve()
    expect(screen.getByText('Five-strike latency check')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Start five strikes' }))
    for (let strike = 1; strike <= 5; strike += 1) {
      await vi.advanceTimersByTimeAsync(strike === 1 ? 700 : 650)
      expect(screen.getByText(`Strike ${strike}`)).toBeVisible()
      if (strike === 1) {
        input.emit([0x99, 38, 100], performance.now() + 24)
        expect(screen.getByText('0/5')).toBeVisible()
      }
      await vi.advanceTimersToNextTimerAsync()
      input.emit([0x99, 38, 100], performance.now() + 24)
      await Promise.resolve()
    }

    expect(screen.getByText('5/5')).toBeVisible()
    expect(screen.getByText(/ms estimate/)).toHaveTextContent('24 ms estimate')
    expect(
      screen.getByText(/5 of 5 strikes consistent · 0 ms spread/i),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Apply estimate' }))
    expect(screen.getByText(/Applied: 24 ms/i)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Close input details' }))
    fireEvent.click(screen.getByRole('button', { name: /Calibration Kit/i }))
    expect(screen.getByText(/Applied: 24 ms/i)).toBeVisible()
  })

  it('cancels an unseen latency cue when the Input dialog closes', async () => {
    vi.useFakeTimers()
    const input = new FakeMidiInput('kit', 'Calibration Kit')
    renderRoom({ access: midiAccess([input]) })
    const inputTrigger = screen.getByRole('button', {
      name: /MIDI not connected/i,
    })
    fireEvent.click(inputTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))
    await vi.runAllTicks()
    await Promise.resolve()

    fireEvent.click(screen.getByRole('button', { name: 'Start five strikes' }))
    await vi.advanceTimersByTimeAsync(700)
    expect(screen.getByText('Strike 1')).toBeVisible()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Drum input' }), {
      key: 'Escape',
    })
    await vi.advanceTimersByTimeAsync(800)
    input.emit([0x99, 38, 100], performance.now() + 24)

    expect(screen.queryByRole('dialog', { name: 'Drum input' })).toBeNull()

    fireEvent.click(inputTrigger)
    expect(screen.getByText('0/5')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Start five strikes' }),
    ).toBeEnabled()
  })

  it('restores drawer focus and releases player and route audio on cleanup', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    const room = renderRoom()
    const grooveButton = screen.getAllByRole('button', { name: 'Groove' })[0]
    grooveButton.focus()
    fireEvent.click(grooveButton)
    const drawer = screen.getByRole('dialog')
    await waitFor(() =>
      expect(within(drawer).getByRole('tab', { name: 'Groove' })).toHaveFocus(),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(grooveButton).toHaveFocus())

    room.unmount()
    expect(room.player.dispose).toHaveBeenCalledOnce()
    expect(room.player.listenerCount()).toBe(0)
    expect(room.session.dispose).toHaveBeenCalledOnce()
    expect(room.importSession.dispose).toHaveBeenCalledOnce()
    expect(room.importSession.listenerCount()).toBe(0)
  })

  it('traps input focus and restores its trigger after every close path', async () => {
    renderRoom()
    const inputTrigger = screen.getByRole('button', {
      name: /MIDI not connected/i,
    })
    inputTrigger.focus()
    fireEvent.click(inputTrigger)

    let dialog = screen.getByRole('dialog', { name: 'Drum input' })
    const connect = within(dialog).getByRole('button', {
      name: 'Connect MIDI input',
    })
    await waitFor(() => expect(connect).toHaveFocus())
    const close = within(dialog).getByRole('button', {
      name: 'Close input details',
    })
    const review = within(dialog).getByRole('button', {
      name: 'Review sound and mapping',
    })

    review.focus()
    fireEvent.keyDown(review, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(review).toHaveFocus()
    fireEvent.keyDown(review, { key: 'Escape' })
    await waitFor(() => expect(inputTrigger).toHaveFocus())
    expect(
      screen.queryByRole('dialog', { name: 'Drum input' }),
    ).not.toBeInTheDocument()

    fireEvent.click(inputTrigger)
    dialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Connect MIDI input' }),
      ).toHaveFocus(),
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close input details' }),
    )
    await waitFor(() => expect(inputTrigger).toHaveFocus())

    fireEvent.click(inputTrigger)
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog', { name: 'Drum input' })).getByRole(
          'button',
          { name: 'Connect MIDI input' },
        ),
      ).toHaveFocus(),
    )
    fireEvent.pointerDown(document.body, { button: 0, isPrimary: true })
    await waitFor(() => expect(inputTrigger).toHaveFocus())
    expect(
      screen.queryByRole('dialog', { name: 'Drum input' }),
    ).not.toBeInTheDocument()
  })

  it('makes the phone rack a truthful modal and releases the stage on close', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    renderRoom()
    const shell = screen.getByTestId('drum-night-shell')
    const skipLink = screen.getByText('Skip to the drum stage')
    const sessionBar = shell.querySelector('header')
    const backgroundPads = shell.querySelector<HTMLElement>(
      '[aria-label="Touch drum pads"]',
    )
    expect(sessionBar).not.toBeNull()
    expect(backgroundPads).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Shape the groove' })
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(skipLink).toHaveAttribute('aria-hidden', 'true')
    expect(backgroundPads!.inert).toBe(true)

    const sourceVariation = await within(drawer).findByRole('button', {
      name: 'Classic Editing',
    })
    expect(sourceVariation).toHaveAttribute('aria-pressed', 'true')
    expect(within(sourceVariation).getByText('Editing')).toBeVisible()

    fireEvent.click(within(drawer).getByRole('tab', { name: 'Kit' }))
    const selectedKit = within(drawer).getByRole('radio', {
      name: /Mercury Synth/i,
    })
    expect(selectedKit).toHaveAttribute('aria-checked', 'true')
    expect(within(selectedKit).getByText('Selected')).toBeVisible()

    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    expect(skipLink).toHaveAttribute('aria-hidden', 'false')
    expect(backgroundPads!.inert).toBe(false)
    const hiddenScrim = shell.querySelector<HTMLElement>(
      'button[aria-label="Close rack drawer"][tabindex="-1"]',
    )
    expect(hiddenScrim).toHaveAttribute('aria-hidden', 'true')
  })

  it('switches desktop rail workspaces in one named region and closes the active section', async () => {
    renderRoom()
    const rail = screen.getByRole('complementary', {
      name: 'Drum Night sections',
    })
    const pocket = within(rail).getByRole('button', { name: 'Pocket' })
    const learn = within(rail).getByRole('button', { name: 'Learn' })
    const songs = within(rail).getByRole('button', { name: 'Songs' })

    expect(pocket).toHaveAttribute('aria-current', 'page')
    fireEvent.click(learn)

    const workbench = screen.getByRole('region', {
      name: 'Build the first pocket',
    })
    expect(workbench).not.toHaveAttribute('aria-modal')
    expect(learn).toHaveAttribute('aria-expanded', 'true')
    expect(songs).toHaveAttribute('aria-expanded', 'false')
    expect(window.location.search).toBe('?drawer=learn')

    fireEvent.click(songs)

    expect(screen.getByRole('region', { name: 'Bring a song' })).toBe(workbench)
    expect(learn).toHaveAttribute('aria-expanded', 'false')
    expect(songs).toHaveAttribute('aria-expanded', 'true')
    expect(window.location.search).toBe('?drawer=songs')

    fireEvent.click(songs)

    expect(
      screen.queryByRole('region', { name: 'Bring a song' }),
    ).not.toBeInTheDocument()
    expect(songs).toHaveAttribute('aria-expanded', 'false')
    expect(pocket).toHaveAttribute('aria-current', 'page')
    expect(window.location.search).toBe('')

    learn.focus()
    fireEvent.click(learn)
    const reopenedWorkbench = screen.getByRole('region', {
      name: 'Build the first pocket',
    })
    fireEvent.keyDown(reopenedWorkbench, { key: 'Escape' })

    await waitFor(() => expect(learn).toHaveFocus())
    expect(
      screen.queryByRole('region', { name: 'Build the first pocket' }),
    ).not.toBeInTheDocument()
    expect(learn).toHaveAttribute('aria-expanded', 'false')
    expect(window.location.search).toBe('')
  })

  it('keeps contextual drawer controls keyboard reachable without an invalid tablist', async () => {
    renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    expect(within(drawer).queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      within(drawer).getByRole('button', { name: 'Rack controls' }),
    ).toBeEnabled()
    expect(
      await within(drawer).findByTestId('drum-play-along-file-drop-input'),
    ).toHaveAttribute('tabindex', '-1')
    expect(
      within(drawer).getByRole('button', {
        name: 'Choose MIDI or Guitar Pro',
      }),
    ).toBeEnabled()
  })

  it('opens the prepared-song catalog lazily and keeps two-stem metadata audio-inert until Play', async () => {
    const backing = preparedBackingHarness({
      sessionId: 'two-stem-night-drive',
      title: 'Night Drive',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([backing])
    const room = renderRoom({ loadSongPort: catalog.loadSongPort })

    expect(catalog.loadSongPort).not.toHaveBeenCalled()
    expect(catalog.initialize).not.toHaveBeenCalled()
    expect(catalog.openSession).not.toHaveBeenCalled()
    expect(backing.load).not.toHaveBeenCalled()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    await waitFor(() => expect(catalog.loadSongPort).toHaveBeenCalledOnce())
    expect(catalog.initialize).toHaveBeenCalledOnce()

    const song = await within(drawer).findByRole('button', {
      name: /Night Drive.*Two stems.*Load backing/i,
    })
    fireEvent.click(song)

    await waitFor(() =>
      expect(catalog.openSession).toHaveBeenCalledWith(
        backing.source.sessionId,
        expect.any(AbortSignal),
      ),
    )
    expect(within(drawer).getByText('Backing with drums inside')).toBeVisible()
    expect(backing.load).not.toHaveBeenCalled()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
    expect(room.session.outputForGesture).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()

    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'Open the play-along mixer',
      }),
    )
    const mixer = await screen.findByTestId('drum-play-along-mixer')
    expect(screen.queryByText('Bring the band in.')).not.toBeInTheDocument()
    expect(mixer).toHaveAttribute('data-source-kind', 'two-stem-audio')
    expect(
      within(mixer).getByRole('slider', { name: 'Source Drums level' }),
    ).toBeDisabled()
    expect(
      within(mixer).getByRole('button', { name: 'Mute Source Drums' }),
    ).toBeDisabled()
    expect(
      within(mixer).getByRole('slider', { name: 'Backing level' }),
    ).toBeEnabled()
    expect(
      within(mixer).getByRole('slider', { name: 'You level' }),
    ).toBeEnabled()

    fireEvent.click(within(mixer).getByRole('button', { name: 'Mute You' }))
    expect(room.player.setLaneVolume).toHaveBeenLastCalledWith('live', 0)
    expect(backing.load).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Night Drive song clock',
      })[0],
    )

    await waitFor(() => expect(backing.load).toHaveBeenCalledOnce())
    expect(room.player.activate).toHaveBeenCalledOnce()
    expect(room.session.contextForGesture).toHaveBeenCalledOnce()
    expect(room.session.outputForGesture).toHaveBeenCalledOnce()
    expect(room.player.activate.mock.invocationCallOrder[0]).toBeLessThan(
      backing.load.mock.invocationCallOrder[0],
    )
  })

  it('exposes independently mixable Source Drums, Backing, and You for full separated parts', async () => {
    const backing = preparedBackingHarness({
      sessionId: 'full-band-parts',
      title: 'Full Band Rehearsal',
      kind: 'parts',
    })
    const catalog = songPortHarness([backing])
    const room = renderRoom({ loadSongPort: catalog.loadSongPort })

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    const song = await within(drawer).findByRole('button', {
      name: /Full Band Rehearsal.*Full parts.*Load backing/i,
    })
    fireEvent.click(song)

    await waitFor(() =>
      expect(within(drawer).getByText('Full mix ready')).toBeVisible(),
    )
    expect(backing.load).not.toHaveBeenCalled()
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'Open the play-along mixer',
      }),
    )

    const mixer = await screen.findByTestId('drum-play-along-mixer')
    const sourceDrumsLevel = within(mixer).getByRole('slider', {
      name: 'Source Drums level',
    })
    const backingLevel = within(mixer).getByRole('slider', {
      name: 'Backing level',
    })
    const youLevel = within(mixer).getByRole('slider', { name: 'You level' })
    expect(mixer).toHaveAttribute('data-source-kind', 'separated-audio')
    expect(sourceDrumsLevel).toBeEnabled()
    expect(backingLevel).toBeEnabled()
    expect(youLevel).toBeEnabled()

    const liveWritesBeforeSourceMute =
      room.player.setLaneVolume.mock.calls.length
    fireEvent.click(
      within(mixer).getByRole('button', { name: 'Mute Source Drums' }),
    )
    expect(
      within(mixer).getByRole('button', { name: 'Unmute Source Drums' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(room.player.setLaneVolume).toHaveBeenCalledTimes(
      liveWritesBeforeSourceMute,
    )

    fireEvent.click(within(mixer).getByRole('button', { name: 'Mute You' }))
    expect(room.player.setLaneVolume).toHaveBeenLastCalledWith('live', 0)
    expect(
      within(mixer).getByRole('button', { name: 'Unmute You' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(backing.load).not.toHaveBeenCalled()
  })

  it('opens the in-room sign-in modal for a blocked separation instead of navigating', async () => {
    const backing = preparedBackingHarness({
      sessionId: 'two-stem-blocked-song',
      title: 'Prepared Session A',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([backing])
    const blocker: CloudSplitBlocker = {
      reason: 'signed-out',
      message: 'Sign in before separating the band.',
      cta: { label: 'Sign in', section: 'account' },
    }
    const prepareBand = vi.fn<PlayAlongBandPreparationPort['prepareBand']>()
    const loadBandPreparationPort = vi.fn(async () => ({ prepareBand }))
    renderRoom({
      checkBandPreflight: () => blocker,
      loadBandPreparationPort,
      loadSongPort: catalog.loadSongPort,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.click(
      await within(drawer).findByRole('button', {
        name: /Prepared Session A.*Two stems.*Load backing/i,
      }),
    )
    await within(drawer).findByText('Backing with drums inside')
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Separate drums' }),
    )

    await within(drawer).findByText('Sign in before separating the band.')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Sign in' }))

    // The shared AuthModal opens over the room in its drum flavor; the page
    // never navigates to settings and no billable job starts.
    const overlay = await screen.findByRole('dialog')
    expect(overlay.closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'drum-night',
    )
    expect(screen.getByTestId('drum-night-shell')).toBeInTheDocument()
    expect(prepareBand).not.toHaveBeenCalled()

    fireEvent.click(within(overlay).getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps a newer authored file when an older separation finishes late', async () => {
    const backing = preparedBackingHarness({
      sessionId: 'session-a',
      title: 'Prepared Session A',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([backing])
    const separation = deferred<{ saved: readonly string[] }>()
    const prepareBand = vi.fn<PlayAlongBandPreparationPort['prepareBand']>(
      () => separation.promise,
    )
    const reusePreparedBand = vi.fn<
      NonNullable<PlayAlongBandPreparationPort['reusePreparedBand']>
    >(async () => null)
    const loadBandPreparationPort = vi.fn(async () => ({
      prepareBand,
      reusePreparedBand,
    }))
    const authored = readySessionFixture({ title: 'Authored File B' })
    const importSession = importSessionHarness()
    const onReadySessionChange = vi.fn()
    importSession.setNextResult(authored)
    renderRoom({
      checkBandPreflight: () => null,
      importSession,
      loadBandPreparationPort,
      loadSongPort: catalog.loadSongPort,
      onReadySessionChange,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    let drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.click(
      await within(drawer).findByRole('button', {
        name: /Prepared Session A.*Two stems.*Load backing/i,
      }),
    )
    await within(drawer).findByText('Backing with drums inside')
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Separate drums' }),
    )
    await waitFor(() => expect(prepareBand).toHaveBeenCalledOnce())
    const separationSignal = prepareBand.mock.calls[0]?.[1].signal
    expect(separationSignal).toBeDefined()
    expect(separationSignal?.aborted).toBe(false)

    const file = new File([new Uint8Array([1, 2, 3])], 'authored-b.mid', {
      type: 'audio/midi',
    })
    const files = {
      0: file,
      length: 1,
      item: () => file,
    } as unknown as FileList
    fireEvent.change(
      within(drawer).getByTestId('drum-play-along-file-drop-input'),
      { target: { files } },
    )

    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-view',
        'score',
      ),
    )
    expect(separationSignal?.aborted).toBe(true)
    expect(onReadySessionChange).toHaveBeenLastCalledWith(authored.document)
    expect(new URLSearchParams(window.location.search).get('song')).toBeNull()

    const lateAttempt = prepareBand.mock.results[0]?.value
    separation.resolve({ saved: ['drums', 'instrumental'] })
    await lateAttempt
    await settleMicrotasks()

    expect(catalog.openSession).toHaveBeenCalledTimes(1)
    expect(new URLSearchParams(window.location.search).get('song')).toBeNull()
    expect(onReadySessionChange).toHaveBeenLastCalledWith(authored.document)

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    expect(within(drawer).getByText('Authored File B')).toBeVisible()
    expect(within(drawer).getByText('No backing selected')).toBeVisible()
  })

  it('keeps a selected saved session when an older authored import finishes late', async () => {
    const savedBacking = preparedBackingHarness({
      sessionId: 'saved-session-b',
      title: 'Saved Session B',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([savedBacking])
    const parser = deferred<undefined>()
    const authored = readySessionFixture({ title: 'Authored File A' })
    const importSession = importSessionHarness(IDLE_DRUM_SESSION, {
      beforeApply: () => parser.promise,
    })
    const onReadySessionChange = vi.fn()
    importSession.setNextResult(authored)
    renderRoom({
      importSession,
      loadSongPort: catalog.loadSongPort,
      onReadySessionChange,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    const file = new File([new Uint8Array([4, 5, 6])], 'authored-a.mid', {
      type: 'audio/midi',
    })
    const files = {
      0: file,
      length: 1,
      item: () => file,
    } as unknown as FileList
    fireEvent.change(
      within(drawer).getByTestId('drum-play-along-file-drop-input'),
      { target: { files } },
    )
    await within(drawer).findByText('Reading authored-a.mid…')
    const importAttempt = importSession.importFile.mock.results[0]?.value

    fireEvent.click(
      await within(drawer).findByRole('button', {
        name: /Saved Session B.*Two stems.*Load backing/i,
      }),
    )
    await within(drawer).findByText('Backing with drums inside')
    expect(new URLSearchParams(window.location.search).get('song')).toBe(
      'saved-session-b',
    )

    parser.resolve(undefined)
    await importAttempt
    await settleMicrotasks()

    expect(catalog.openSession).toHaveBeenCalledTimes(1)
    expect(new URLSearchParams(window.location.search).get('song')).toBe(
      'saved-session-b',
    )
    expect(within(drawer).getByText('Backing with drums inside')).toBeVisible()
    expect(
      within(drawer).queryByText('Authored File A'),
    ).not.toBeInTheDocument()
    expect(onReadySessionChange).not.toHaveBeenCalledWith(authored.document)
  })

  it('ignores a late separation retry for session A after session B becomes current', async () => {
    const sessionA = preparedBackingHarness({
      sessionId: 'retry-session-a',
      title: 'Retry Session A',
      kind: 'two-stem',
    })
    const sessionB = preparedBackingHarness({
      sessionId: 'current-session-b',
      title: 'Current Session B',
      kind: 'two-stem',
    })
    const catalog = songPortHarness([sessionA, sessionB])
    const retryCompletion = deferred<{ saved: readonly string[] }>()
    let preparationAttempt = 0
    const prepareBand = vi.fn<PlayAlongBandPreparationPort['prepareBand']>(
      () => {
        preparationAttempt += 1
        if (preparationAttempt === 1) {
          return Promise.reject(new Error('Session A separation failed.'))
        }
        return retryCompletion.promise
      },
    )
    const loadBandPreparationPort = vi.fn(async () => ({ prepareBand }))
    renderRoom({
      checkBandPreflight: () => null,
      loadBandPreparationPort,
      loadSongPort: catalog.loadSongPort,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.click(
      await within(drawer).findByRole('button', {
        name: /Retry Session A.*Two stems.*Load backing/i,
      }),
    )
    await within(drawer).findByText('Backing with drums inside')
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Separate drums' }),
    )

    const retry = await within(drawer).findByRole('button', {
      name: 'Try again',
    })
    fireEvent.click(retry)
    await waitFor(() => expect(prepareBand).toHaveBeenCalledTimes(2))
    const retrySignal = prepareBand.mock.calls[1]?.[1].signal
    const retryAttempt = prepareBand.mock.results[1]?.value
    expect(retrySignal?.aborted).toBe(false)

    window.history.pushState(
      {},
      '',
      '/drum-night?drawer=songs&song=current-session-b',
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() =>
      expect(catalog.openSession).toHaveBeenLastCalledWith(
        'current-session-b',
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() =>
      expect(
        within(drawer).getByRole('button', {
          name: /Current Session B.*Two stems.*Selected/i,
        }),
      ).toHaveAttribute('aria-current', 'true'),
    )
    expect(retrySignal?.aborted).toBe(true)

    retryCompletion.resolve({ saved: ['drums', 'instrumental'] })
    await retryAttempt
    await settleMicrotasks()

    expect(catalog.openSession).toHaveBeenCalledTimes(2)
    expect(new URLSearchParams(window.location.search).get('song')).toBe(
      'current-session-b',
    )
    expect(
      within(drawer).getByRole('button', {
        name: /Current Session B.*Two stems.*Selected/i,
      }),
    ).toHaveAttribute('aria-current', 'true')
  })

  it('supports complete arrow-key behavior for workbench tabs and kit radios', () => {
    const room = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const grooveTab = within(drawer).getByRole('tab', { name: 'Groove' })
    grooveTab.focus()

    fireEvent.keyDown(grooveTab, { key: 'ArrowRight' })
    const kitTab = within(drawer).getByRole('tab', { name: 'Kit' })
    expect(kitTab).toHaveFocus()
    expect(kitTab).toHaveAttribute('aria-selected', 'true')
    expect(within(drawer).getByRole('tabpanel', { name: 'Kit' })).toBeVisible()

    const synth = within(drawer).getByRole('radio', {
      name: /Mercury Synth/i,
    })
    synth.focus()
    fireEvent.keyDown(synth, { key: 'ArrowRight' })
    const classic = within(drawer).getByRole('radio', { name: /Classic GM/i })
    expect(classic).toHaveFocus()
    expect(classic).toHaveAttribute('aria-checked', 'true')
    expect(room.player.selectKit).toHaveBeenLastCalledWith('classic-gm')

    fireEvent.keyDown(classic, { key: 'End' })
    const live = within(drawer).getByRole('radio', { name: /Live/i })
    expect(live).toHaveFocus()
    expect(live).toHaveAttribute('aria-checked', 'true')
    expect(room.player.selectKit).toHaveBeenLastCalledWith('live')

    fireEvent.keyDown(kitTab, { key: 'End' })
    const roomTab = within(drawer).getByRole('tab', { name: 'Room' })
    expect(roomTab).toHaveFocus()
    expect(roomTab).toHaveAttribute('aria-selected', 'true')
  })

  it('restores the workbench opener after an internal Escape or close action', async () => {
    renderRoom()
    const rail = screen.getByRole('complementary', {
      name: 'Drum Night sections',
    })
    const grooveLauncher = within(rail).getByRole('button', { name: 'Groove' })

    grooveLauncher.focus()
    fireEvent.click(grooveLauncher)
    let drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const mixTab = within(drawer).getByRole('tab', { name: 'Mix' })
    mixTab.focus()
    fireEvent.click(mixTab)
    fireEvent.keyDown(mixTab, { key: 'Escape' })

    await waitFor(() => expect(grooveLauncher).toHaveFocus())
    expect(
      screen.queryByRole('region', { name: 'Balance the room' }),
    ).not.toBeInTheDocument()

    fireEvent.click(grooveLauncher)
    drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const close = within(drawer).getByRole('button', {
      name: 'Close rack drawer',
    })
    close.focus()
    fireEvent.click(close)

    await waitFor(() => expect(grooveLauncher).toHaveFocus())
    expect(
      screen.queryByRole('region', { name: 'Shape the groove' }),
    ).not.toBeInTheDocument()
  })

  it('reconciles URL drawer history with the selected and focused rack tab', async () => {
    renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const grooveTab = within(drawer).getByRole('tab', { name: 'Groove' })
    grooveTab.focus()

    const kitTab = within(drawer).getByRole('tab', { name: 'Kit' })
    kitTab.focus()
    fireEvent.click(kitTab)
    expect(window.location.search).toBe('?drawer=kit')
    expect(kitTab).toHaveFocus()

    window.history.replaceState({}, '', '/drum-night?drawer=groove')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(grooveTab).toHaveFocus())
    expect(grooveTab).toHaveAttribute('aria-selected', 'true')
    expect(kitTab).toHaveAttribute('aria-selected', 'false')
    expect(
      within(drawer).getByRole('tabpanel', { name: 'Groove' }),
    ).toBeVisible()
  })

  it('shows the bounded authored bar count for the prepared first pocket', () => {
    renderRoom()

    expect(
      screen.getByLabelText('Current bar 1, 2 authored bars'),
    ).toBeVisible()
    expect(screen.getAllByText('Bar 1')).not.toHaveLength(0)
    expect(screen.getByText('2 authored bars')).toBeVisible()
    expect(screen.queryByText(/of 16/i)).not.toBeInTheDocument()
  })

  it('hot-applies a prepared groove edit without resetting playback or its A B range', async () => {
    const clock = new TestClock()
    const room = renderRoom({ clock })
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    const markA = timelineControls.getByRole('button', {
      name: 'Set loop start A at the playhead',
    })
    const markB = timelineControls.getByRole('button', {
      name: 'Set loop end B at the playhead',
    })
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })

    fireEvent.click(markA)
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(markB)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause First Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )
    clock.advanceTo(240)
    const positionBeforeEdit = (seek as HTMLInputElement).value

    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('region', { name: 'Shape the groove' })
    const editor = await within(drawer).findByTestId('drum-groove-editor')
    fireEvent.click(
      within(editor).getByRole('button', {
        name: 'Add Hi-Mid Tom at bar 1, beat 1 e',
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByText(/Built-in groove · 29 mapped hits/),
      ).toBeVisible(),
    )
    expect(editor).toHaveAttribute('data-dirty', 'true')
    expect(timeline).toHaveAttribute('data-loop-state', 'active')
    expect(seek).toHaveValue(positionBeforeEdit)
    expect(
      screen.getAllByRole('button', {
        name: 'Pause First Pocket take clock',
      }),
    ).not.toHaveLength(0)
    expect(room.session.contextForGesture).toHaveBeenCalledTimes(1)

    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    const scoreViewport = await screen.findByLabelText(
      'Windowed percussion score',
    )
    expect(scoreViewport.querySelector('desc')).toHaveTextContent(
      '29 indexed authored percussion hits',
    )
  })

  it('reactivates audio before retrying an initial graph failure', async () => {
    const room = renderRoom({ activationResults: [false, true] })
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play First Pocket take clock',
      })[0],
    )

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText(/audio context is unavailable/i),
    ).toBeVisible()
    fireEvent.click(
      within(alert).getByRole('button', { name: 'Try audio again' }),
    )

    await waitFor(() => expect(room.player.activate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(room.player.retry).toHaveBeenCalledOnce())
    expect(room.player.activate.mock.invocationCallOrder[1]).toBeLessThan(
      room.player.retry.mock.invocationCallOrder[0],
    )
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })

  it('keeps the authored Source Drums, You, and off-by-default click independently operable', async () => {
    const click = clickHarness()
    const room = renderRoom({ click })
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('region', { name: 'Shape the groove' })
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Mix' }))
    const mixer = within(drawer).getByTestId('drum-play-along-mixer')
    const sourceDrumsLevel = within(mixer).getByRole('slider', {
      name: 'Source Drums level',
    })
    const backingLevel = within(mixer).getByRole('slider', {
      name: 'Backing level',
    })
    const youLevel = within(mixer).getByRole('slider', { name: 'You level' })
    const clickToggle = within(mixer).getByRole('button', {
      name: 'Unmute Click',
    })
    const clickLevel = within(drawer).getByRole('slider', {
      name: 'Click level',
    })
    const authoredKickLevel = within(drawer).getByRole('slider', {
      name: 'Kick authored level',
    })
    const authoredKickMute = within(drawer).getByRole('button', {
      name: 'Mute authored Kick',
    })

    expect(mixer).toHaveAttribute('data-source-kind', 'authored-arrangement')
    expect(sourceDrumsLevel).toBeEnabled()
    expect(backingLevel).toBeDisabled()
    expect(youLevel).toBeEnabled()
    expect(clickToggle).toHaveAttribute('aria-pressed', 'true')
    expect(clickLevel).toBeEnabled()
    expect(authoredKickLevel).toBeEnabled()
    expect(
      within(drawer).getByText(/live hits stay independent/i),
    ).toBeVisible()

    fireEvent.click(clickToggle)
    expect(click.enable).toHaveBeenCalledWith(true)
    expect(
      within(mixer).getByRole('button', { name: 'Mute Click' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(drawer).getByText('Press Play to arm audio')).toBeVisible()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()

    fireEvent.input(clickLevel, { target: { value: '63' } })

    fireEvent.input(youLevel, { target: { value: '64' } })
    fireEvent.input(authoredKickLevel, { target: { value: '55' } })

    expect(click.setLevel).toHaveBeenLastCalledWith(0.63)
    expect(room.player.setLaneVolume).toHaveBeenLastCalledWith('live', 0.64)
    expect(room.player.setAuthoredFamilyVolume).toHaveBeenLastCalledWith(
      'kick',
      0.55,
    )

    fireEvent.click(authoredKickMute)
    expect(room.player.setAuthoredFamilyVolume).toHaveBeenLastCalledWith(
      'kick',
      0,
    )
    expect(room.player.setLaneVolume).toHaveBeenLastCalledWith('live', 0.64)
    expect(youLevel).toBeEnabled()
  })

  it('bypasses prepared family balance for imported parts and restores it on return', async () => {
    const importSession = importSessionHarness()
    const room = renderRoom({ importSession })
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    let drawer = screen.getByRole('region', { name: 'Shape the groove' })
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Mix' }))
    fireEvent.input(
      within(drawer).getByRole('slider', { name: 'Kick authored level' }),
      { target: { value: '55' } },
    )
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Mute authored Kick' }),
    )
    expect(room.player.setAuthoredFamilyVolume).toHaveBeenLastCalledWith(
      'kick',
      0,
    )

    room.player.setAuthoredFamilyVolume.mockClear()
    importSession.setState(readySessionFixture({ title: 'Imported Pocket' }))

    await waitFor(() =>
      expect(room.player.setAuthoredFamilyVolume).toHaveBeenCalledWith(
        'kick',
        1,
      ),
    )
    expect(
      within(drawer).queryByRole('slider', { name: 'Kick authored level' }),
    ).not.toBeInTheDocument()

    room.player.setAuthoredFamilyVolume.mockClear()
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    fireEvent.click(within(drawer).getByRole('button', { name: /^Unload / }))

    await waitFor(() =>
      expect(room.player.setAuthoredFamilyVolume).toHaveBeenCalledWith(
        'kick',
        0,
      ),
    )
  })

  it('keeps the playable groove active through honest import states and promotes a ready part', () => {
    const importSession = importSessionHarness()
    renderRoom({ importSession })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))

    expect(screen.getByRole('heading', { name: 'First Pocket' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    const drawer = screen.getByRole('region', { name: 'Bring a song' })

    const states: readonly [DrumSessionImportState, string][] = [
      [{ status: 'loading', fileName: 'take.mid' }, 'Reading take.mid…'],
      [
        { status: 'empty', fileName: 'empty.mid' },
        'Export the part again with at least one drum event, then retry.',
      ],
      [
        {
          status: 'too-large',
          fileName: 'large.gp',
          actualBytes: 24 * 1024 * 1024,
          maximumBytes: 20 * 1024 * 1024,
        },
        'Choose a file smaller than 20 MB. This file is 24 MB.',
      ],
      [
        {
          status: 'unsupported',
          fileName: 'part.pdf',
          reason: 'file-type',
          droppedHitCount: 0,
        },
        'Choose a MIDI, GP, GP3, GP4, GP5, or GPX file.',
      ],
      [
        {
          status: 'unsupported',
          fileName: 'unknown.gpx',
          reason: 'drum-mapping',
          droppedHitCount: 3,
        },
        '3 source events were reported as unsupported. Drum Night will not guess a substitute sound.',
      ],
      [
        { status: 'no-drums', fileName: 'piano.mid', pitchedTrackCount: 2 },
        '2 pitched parts were found, but Drum Night needs a percussion track.',
      ],
      [
        {
          status: 'error',
          fileName: 'damaged.gp5',
          message: 'The parser could not read this score.',
        },
        'The parser could not read this score.',
      ],
    ]

    for (const [state, expectedCopy] of states) {
      importSession.setState(state)
      expect(within(drawer).getByText(expectedCopy)).toBeVisible()
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-session-status',
        'ready',
      )
    }

    importSession.setState(readySessionFixture({ title: 'Percussion Study' }))
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Percussion Study' }),
    ).toBeVisible()
    expect(screen.getByText('Percussion score')).toBeVisible()
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-session-status',
      'ready',
    )
  })

  it('serializes authored-file replacement and keeps cancellation available while importing', () => {
    const importSession = importSessionHarness({
      status: 'loading',
      fileName: 'long-take.mid',
    })
    renderRoom({ importSession })
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('region', { name: 'Bring a song' })

    expect(
      within(drawer).getByRole('button', {
        name: 'Choose MIDI or Guitar Pro',
      }),
    ).toBeDisabled()
    expect(within(drawer).getByText('Reading long-take.mid…')).toBeVisible()
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: 'Cancel authored-file import',
      }),
    )

    expect(importSession.cancel).toHaveBeenCalledOnce()
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-import-status',
      'idle',
    )
    expect(
      screen.getByText(
        'Drum part import cancelled. Nothing was partially loaded.',
      ),
    ).toBeVisible()
    expect(
      within(drawer).getByRole('button', {
        name: 'Choose MIDI or Guitar Pro',
      }),
    ).toBeEnabled()
  })

  it('imports from the picker and drop zone, ignores stale UI attempts, and keeps recovery visible', async () => {
    const ready = readySessionFixture({ title: 'Pocket From File' })
    const importSession = importSessionHarness()
    const onReadySessionChange = vi.fn()
    importSession.setNextResult(ready)
    renderRoom({ importSession, onReadySessionChange })

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    let drawer = screen.getByRole('region', { name: 'Bring a song' })
    const file = new File([new Uint8Array([1, 2, 3])], 'pocket.mid', {
      type: 'audio/midi',
    })
    const fileList = {
      0: file,
      length: 1,
      item: () => file,
    } as unknown as FileList
    fireEvent.change(
      within(drawer).getByTestId('drum-play-along-file-drop-input'),
      { target: { files: fileList } },
    )

    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-view',
        'score',
      ),
    )
    expect(importSession.importFile).toHaveBeenCalledWith(file)
    expect(window.location.search).toBe('?view=score')
    expect(onReadySessionChange).toHaveBeenLastCalledWith(ready.document)

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    drawer = screen.getByRole('region', { name: 'Bring a song' })
    expect(within(drawer).getByText('Pocket From File')).toBeVisible()
    expect(
      within(drawer).getByText('4 authored drum hits · 0 backing tracks'),
    ).toBeVisible()

    const damaged = new File([new Uint8Array([4])], 'damaged.gpx')
    importSession.setNextResult({
      status: 'error',
      fileName: damaged.name,
      message: 'Guitar Pro data ended unexpectedly.',
    })
    const damagedFiles = {
      0: damaged,
      length: 1,
      item: () => damaged,
    } as unknown as FileList
    fireEvent.drop(within(drawer).getByTestId('drum-play-along-file-drop'), {
      dataTransfer: {
        types: ['Files'],
        files: damagedFiles,
      },
    })
    await waitFor(() =>
      expect(within(drawer).getByRole('alert')).toHaveTextContent(
        'Guitar Pro data ended unexpectedly.',
      ),
    )
    expect(onReadySessionChange).toHaveBeenLastCalledWith(ready.document)
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-session-status',
      'ready',
    )
    expect(
      within(drawer).getByRole('button', {
        name: 'Choose MIDI or Guitar Pro',
      }),
    ).toBeEnabled()
  })

  it('reuses one score index across Seat, Score, and Coach and restores the view from the URL', () => {
    window.history.replaceState({}, '', '/drum-night?view=seat')
    const ready = readySessionFixture({ title: 'Seat Map Study' })
    const importSession = importSessionHarness(ready)
    const createScoreIndex = vi.fn((document: typeof ready.document) =>
      createDrumScoreIndex(document),
    )
    renderRoom({ createScoreIndex, importSession })

    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-view',
      'seat',
    )
    const backdrop = screen.getByTestId('drummer-seat-backdrop')
    expect(backdrop.querySelector('img')).toHaveAttribute(
      'src',
      '/drum-night/drummer-seat-landscape.webp',
    )
    expect(backdrop.querySelector('source')).toHaveAttribute(
      'srcset',
      '/drum-night/drummer-seat-portrait.webp',
    )
    expect(
      screen.getByRole('heading', { name: 'Playable drummer’s seat' }),
    ).toBeInTheDocument()
    expect(createScoreIndex).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    expect(screen.getByText('Percussion score')).toBeVisible()
    expect(window.location.search).toBe('?view=score')
    expect(createScoreIndex).toHaveBeenCalledOnce()

    fireEvent.click(
      screen.getByRole('button', { name: 'Open live take monitor' }),
    )
    expect(
      within(
        screen.getByRole('region', { name: 'Recover the backbeat' }),
      ).getByRole('heading', { name: 'Phrase coach' }),
    ).toBeVisible()
    expect(createScoreIndex).toHaveBeenCalledOnce()
  })

  it('keeps durable take history reachable from the persistent desktop coach without current evidence', async () => {
    const project = projectHarness()
    const takeHistory = takeHistoryHarness()
    renderRoom({ project, takeHistory })

    expect(
      screen.queryByRole('button', { name: 'Open take history' }),
    ).toBeNull()
    await saveCurrentGroove('History Pocket')
    fireEvent.click(screen.getByRole('button', { name: 'Rack controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close rack drawer' }))

    const persistentCoach = screen.getByLabelText('Session phrase coach')
    expect(
      within(persistentCoach).queryByTestId('drum-take-history'),
    ).toBeNull()
    const openHistory = within(persistentCoach).getByRole('button', {
      name: 'Open take history',
    })
    expect(openHistory).toBeVisible()
    fireEvent.click(openHistory)

    const coachWorkspace = await screen.findByRole('region', {
      name: 'Recover the backbeat',
    })
    expect(
      await within(coachWorkspace).findByRole('heading', {
        name: 'Recent takes',
      }),
    ).toBeVisible()
    await waitFor(() =>
      expect(takeHistory.controller.loadHistory).toHaveBeenCalledWith(
        'created-project-1',
      ),
    )
  })

  it('keeps a late indexed phrase visible after the bounded score projection', async () => {
    const clock = new TestClock()
    const earlyHits = Array.from({ length: 2_050 }, (_, index) => ({
      id: `early-${index}`,
      gmKey: 42,
      startBeat: index * 0.25,
      velocity: 72,
    }))
    const ready = readySessionFixture({
      title: 'Long Form Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyHits,
              {
                id: 'late-kick',
                gmKey: 36,
                startBeat: 12_000,
                velocity: 112,
              },
              {
                id: 'tail-hat',
                gmKey: 42,
                startBeat: 12_008,
                velocity: 72,
              },
            ],
          }),
        ],
      }),
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Long Form Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Long Form Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )

    clock.advanceTo(12_000 * 500)

    expect(screen.getByText('Now: Bass Drum 1')).toBeVisible()
    expect(screen.getAllByText(/Bar 3001/)).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Pocket view' }))
    const latePocketGuide = screen.getByRole('region', {
      name: 'Pocket guide',
    })
    expect(
      within(latePocketGuide).getByText('Bar 3001 · 4/4 · beat 1'),
    ).toBeVisible()
    expect(
      within(latePocketGuide).getByText(
        'Long Form Pocket · 1 authored attacks',
      ),
    ).toBeVisible()
  })

  it('uses authored 6/8 bars in the top session map', async () => {
    const clock = new TestClock()
    const baseSong = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            { id: 'kick-1', gmKey: 36, startBeat: 0, velocity: 96 },
            { id: 'kick-2', gmKey: 36, startBeat: 8.5, velocity: 96 },
          ],
        }),
      ],
    })
    const ready = readySessionFixture({
      title: 'Six Eight Study',
      song: {
        ...baseSong,
        timeSignatures: [{ beat: 0, numerator: 6, denominator: 8 }],
      },
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Six Eight Study take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Six Eight Study take clock',
        }),
      ).not.toHaveLength(0),
    )

    clock.advanceTo(1_600)

    expect(
      screen.getByLabelText('Current bar 2, 3 authored bars'),
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Pocket guide' })).getByText(
        'Bar 2 · 6/8 · beat 1',
      ),
    ).toBeVisible()
  })

  it('schedules authored drums only after Play and discloses bounded routing truth', async () => {
    const clock = new TestClock()
    const simultaneousHits = Array.from({ length: 50 }, (_, index) => ({
      id: `stack-${index}`,
      gmKey: 38,
      startBeat: 0,
      velocity: 90,
    }))
    const denseHits = Array.from({ length: 260 }, (_, index) => ({
      id: `dense-${index}`,
      gmKey: 42,
      startBeat: 0.01 + index * 0.0003,
      velocity: 68,
    }))
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [...simultaneousHits, ...denseHits],
          droppedHitCount: 2,
        }),
      ],
    })
    const ready = readySessionFixture({
      title: 'Dense Scheduler Truth',
      song: {
        ...song,
        tempoChanges: Array.from({ length: 200 }, (_, index) => ({
          beat: index,
          usPerBeat: index === 0 ? 1 : 500_000,
        })),
      },
    })
    const room = renderRoom({
      clock,
      importSession: importSessionHarness(ready),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))

    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.player.trigger).not.toHaveBeenCalled()
    expect(
      room.session.performanceTimestampToContextTime,
    ).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Dense Scheduler Truth take clock',
      })[0],
    )

    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: expect.stringMatching(/^authored:/),
        }),
      ),
    )
    const playbackTruth = screen.getByRole('note')
    expect(playbackTruth).toHaveTextContent(
      '2 unsupported source hits stay silent',
    )
    expect(playbackTruth).toHaveTextContent('2 simultaneous hits are silent')
    expect(playbackTruth).toHaveTextContent(/in-range hits are waiting/i)
    expect(playbackTruth).toHaveTextContent(
      /source tempo changes were omitted from the bounded playback map/i,
    )
    expect(playbackTruth).toHaveTextContent(
      /source tempo value was clamped to the supported 40–280 BPM range/i,
    )
    expect(playbackTruth).toHaveTextContent(/attacks are using synth fallback/i)
    expect(
      screen.getByText(
        'Dense Scheduler Truth is starting on the shared take clock with take events armed.',
      ),
    ).toBeInTheDocument()

    clock.advanceTo(500)
    await waitFor(() =>
      expect(playbackTruth).toHaveTextContent(
        /delayed hits missed the bounded scheduling window and stayed silent/i,
      ),
    )
  })

  it('moves the shared timeline from full song through A waiting, active, and clear', () => {
    renderRoom()
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    const markA = timelineControls.getByRole('button', {
      name: 'Set loop start A at the playhead',
    })
    const markB = timelineControls.getByRole('button', {
      name: 'Set loop end B at the playhead',
    })

    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(timelineControls.getByText('Full song')).toBeVisible()
    expect(markA).toHaveAttribute('aria-pressed', 'false')
    expect(markB).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(markA)
    expect(timeline).toHaveAttribute('data-loop-state', 'waiting')
    expect(timelineControls.getByText('Set B to finish the loop')).toBeVisible()
    expect(markA).toHaveAttribute('aria-pressed', 'true')
    expect(markB).toHaveAttribute('aria-pressed', 'false')
    expect(
      timelineControls.getByRole('slider', { name: 'Loop start marker' }),
    ).toHaveAttribute('aria-valuenow', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    expect(
      screen.getByRole('status', { name: 'Practice loop in score' }),
    ).toHaveTextContent('A · Beat 1')

    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    expect(seek).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('Beat 1'),
    )
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(markB)

    expect(timeline).toHaveAttribute('data-loop-state', 'active')
    expect(markA).toHaveAttribute('aria-pressed', 'true')
    expect(markB).toHaveAttribute('aria-pressed', 'true')
    expect(
      timelineControls.getByRole('slider', { name: 'Loop end marker' }),
    ).toBeVisible()
    expect(timelineControls.getByText(/Beat 1 – Beat/)).toBeVisible()
    expect(screen.getByText(/A–B loop set from beat 1 to beat /)).toBeVisible()
    expect(
      screen.getByRole('status', { name: 'Practice loop in score' }),
    ).toHaveTextContent(/A · Beat 1 → B · Beat/)

    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Clear A B practice loop',
      }),
    )
    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(timelineControls.getByText('Full song')).toBeVisible()
    expect(markA).toHaveAttribute('aria-pressed', 'false')
    expect(markB).toHaveAttribute('aria-pressed', 'false')
    expect(
      timelineControls.queryByRole('slider', { name: /Loop .* marker/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('status', { name: 'Practice loop in score' }),
    ).not.toBeInTheDocument()
  })

  it('resets take evidence and an active authored loop when the document changes', async () => {
    const clock = new TestClock()
    const first = readySessionFixture({
      title: 'First Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'first', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 8, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    const second = readySessionFixture({
      title: 'Second Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'second', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 8, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    const importSession = importSessionHarness(first)
    renderRoom({ clock, importSession })

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Play First Pocket at 84 BPM' }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    )
    const seek = timelineControls.getByRole('slider', {
      name: 'Drum part position',
    })
    fireEvent.input(seek, {
      target: { value: String(Number(seek.getAttribute('max')) / 2) },
    })
    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    )
    expect(timeline).toHaveAttribute('data-loop-state', 'active')
    expect(
      timelineControls.getByRole('button', {
        name: 'Clear A B practice loop',
      }),
    ).toBeVisible()
    clock.advanceTo(4_000)
    dispatchPointerDown(
      within(openDrummerSeatKit()).getByRole('button', {
        name: /Play Acoustic snare/i,
      }),
      { button: 0, isPrimary: true, pressure: 0.7 },
    )
    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('1 hits'),
    )
    importSession.setState(second)

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(
      screen.getByText('Press Play, then answer the phrase.'),
    ).toBeVisible()
    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(timelineControls.getByText('Full song')).toBeVisible()
    expect(
      timelineControls.queryByRole('button', {
        name: 'Clear A B practice loop',
      }),
    ).not.toBeInTheDocument()
    expect(
      timelineControls.queryByRole('slider', { name: /Loop .* marker/ }),
    ).not.toBeInTheDocument()
  })

  it('starts First Pocket after leaving an imported document', async () => {
    const imported = readySessionFixture({ title: 'Imported Break' })
    renderRoom({ importSession: importSessionHarness(imported) })

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Play First Pocket at 84 BPM' }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-playing',
        'true',
      ),
    )
    const timeline = screen.getByTestId('drum-night-timeline')
    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(within(timeline).getByText('Full song')).toBeVisible()
    expect(
      within(timeline).queryByRole('button', {
        name: 'Clear A B practice loop',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', {
        name: 'Pause First Pocket take clock',
      }),
    ).not.toHaveLength(0)
  })

  it('discloses older take events discarded by the bounded evidence window', async () => {
    const clock = new TestClock()
    renderRoom({ clock, maxRecordedHits: 3 })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(screen.getByText('Take events').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Play .* take clock/i })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /Pause .* take clock/i }),
      ).not.toHaveLength(0),
    )

    const snare = within(openDrummerSeatKit()).getByRole('button', {
      name: /Play Acoustic snare/i,
    })
    for (let index = 1; index <= 5; index += 1) {
      clock.advanceTo(index * 10)
      dispatchPointerDown(snare, {
        button: 0,
        isPrimary: true,
        pressure: 0.7,
      })
    }

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('3 hits · 2 older not retained'),
    )
  })

  it('shows a truthful waiting-for-audio scheduler state', async () => {
    const clock = new TestClock()
    const ready = readySessionFixture({ title: 'Waiting Pocket' })
    renderRoom({
      clock,
      importSession: importSessionHarness(ready),
      schedulerAudioReady: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Waiting Pocket take clock',
      })[0],
    )

    await waitFor(() =>
      expect(screen.getByRole('note')).toHaveTextContent(
        'Authored playback is waiting for active drum audio',
      ),
    )
  })

  it('sets a measured recovery bar on the shared loop at 70 percent', async () => {
    const clock = new TestClock()
    const ready = readySessionFixture({
      title: 'Recovery Study',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'snare-1', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'snare-2', gmKey: 38, startBeat: 2, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 3.5, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(screen.getByText('Take events').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Recovery Study take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Recovery Study take clock',
        }),
      ).not.toHaveLength(0),
    )

    const snare = within(openDrummerSeatKit()).getByRole('button', {
      name: /Play Acoustic snare/i,
    })
    clock.advanceTo(550)
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.7,
    })
    clock.advanceTo(1_050)
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.7,
    })

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Set recovery loop to bar 1',
      }),
    )

    const timeline = screen.getByTestId('drum-night-timeline')
    const timelineControls = within(timeline)
    expect(timeline).toHaveAttribute('data-loop-state', 'active')
    expect(
      timelineControls.getByRole('button', {
        name: 'Set loop start A at the playhead',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      timelineControls.getByRole('button', {
        name: 'Set loop end B at the playhead',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      timelineControls.getByRole('slider', { name: 'Loop start marker' }),
    ).toHaveAttribute('aria-valuenow', '0')
    expect(
      timelineControls.getByRole('slider', { name: 'Loop end marker' }),
    ).toHaveAttribute('aria-valuenow', '3.5')
    expect(timelineControls.getByText('Beat 1 – Beat 4.5')).toBeVisible()
    expect(screen.getByText(/Recovery loop set to bar 1 at 70%/i)).toBeVisible()

    fireEvent.click(
      timelineControls.getByRole('button', {
        name: 'Clear A B practice loop',
      }),
    )

    expect(timeline).toHaveAttribute('data-loop-state', 'full')
    expect(timelineControls.getByText('Full song')).toBeVisible()
    expect(
      timelineControls.queryByRole('slider', { name: /Loop .* marker/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Recovery loop cleared.*tempo returned to 100%/i),
    ).toBeVisible()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Set recovery loop to bar 1',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increase tempo' }))
    expect(
      within(screen.getByLabelText('Authored tempo')).getByText('122'),
    ).toBeVisible()
    expect(screen.getByText('Tempo set to 122 BPM.')).toBeVisible()
  })

  it('keeps all six live pads available on a phone in Score and Drummer Seat views', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    const ready = readySessionFixture({ title: 'Phone Pocket' })
    renderRoom({ importSession: importSessionHarness(ready) })
    const touchKit = screen.getByLabelText('Touch drum pads')

    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    expect(within(touchKit).getAllByRole('button')).toHaveLength(6)
    for (const pad of within(touchKit).getAllByRole('button')) {
      expect(pad).toBeEnabled()
      expect(pad).toHaveAttribute('aria-keyshortcuts')
    }

    fireEvent.click(screen.getByRole('button', { name: 'Drummer Seat view' }))
    expect(screen.getByTestId('drummer-seat-backdrop')).toBeInTheDocument()
    expect(within(touchKit).getAllByRole('button')).toHaveLength(6)
  })
})

describe('Drum Night feel controls', () => {
  beforeEach(() => {
    localStorage.removeItem(DRUM_FEEL_STORAGE_KEY)
  })

  it('starts off so the grid plays exactly as written', () => {
    renderRoom()
    const toggle = screen.getByRole('button', { name: 'Feel: off' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(within(toggle).getByText('Off')).toBeInTheDocument()
    expect(localStorage.getItem(DRUM_FEEL_STORAGE_KEY)).toBeNull()
  })

  it('toggles from the console and remembers the choice', () => {
    renderRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Feel: off' }))

    const enabled = screen.getByRole('button', { name: 'Feel: on' })
    expect(enabled).toHaveAttribute('aria-pressed', 'true')
    expect(within(enabled).getByText('Rock')).toBeInTheDocument()
    expect(readDrumFeelSettings(localStorage)).toMatchObject({
      enabled: true,
      style: 'rock',
      intensity: 0.6,
      applyToImported: false,
    })
  })

  it('restores a stored preference on the next visit', () => {
    writeDrumFeelSettings(localStorage, {
      ...DEFAULT_DRUM_FEEL_SETTINGS,
      enabled: true,
      style: 'jazz',
      intensity: 0.8,
    })
    renderRoom()
    const toggle = screen.getByRole('button', { name: 'Feel: on' })
    expect(within(toggle).getByText('Jazz')).toBeInTheDocument()
  })

  it('picks a style and an intensity from the groove workspace', async () => {
    renderRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Feel: off' }))
    const drawer = await openGrooveDrawer()
    // The pattern library carries its own style rail, so scope to Feel's group.
    const feelStyles = within(
      within(drawer).getByRole('group', { name: 'Feel style' }),
    )

    fireEvent.click(feelStyles.getByRole('button', { name: 'Funk' }))
    expect(feelStyles.getByRole('button', { name: 'Funk' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const slider = within(drawer).getByRole('slider', { name: /Intensity/ })
    fireEvent.input(slider, { target: { value: '25' } })
    expect(readDrumFeelSettings(localStorage)).toMatchObject({
      style: 'funk',
      intensity: 0.25,
    })
    expect(within(drawer).getByText('Barely there')).toBeInTheDocument()
  })

  it('keeps the style controls inert until feel is switched on', async () => {
    renderRoom()
    const drawer = await openGrooveDrawer()
    expect(
      within(
        within(drawer).getByRole('group', { name: 'Feel style' }),
      ).getByRole('button', { name: 'Jazz' }),
    ).toBeDisabled()
    expect(
      within(drawer).getByRole('slider', { name: /Intensity/ }),
    ).toBeDisabled()
    expect(
      within(drawer).getByText('Off. The grid plays exactly as written.'),
    ).toBeInTheDocument()
  })

  it('leaves imported parts untouched unless explicitly asked', () => {
    renderRoom()
    fireEvent.click(screen.getByRole('button', { name: 'Feel: off' }))
    expect(readDrumFeelSettings(localStorage).applyToImported).toBe(false)
  })
})

describe('Drum Night pattern library', () => {
  it('replaces the open variation with a library groove and can undo it', async () => {
    renderRoom()
    const drawer = await openGrooveDrawer()
    const picker = await within(drawer).findByTestId('drum-pattern-picker')

    fireEvent.click(within(picker).getByRole('button', { name: 'Latin' }))
    const bossa = within(picker)
      .getByText('Bossa Nova')
      .closest('li') as HTMLElement
    fireEvent.click(
      within(bossa).getByRole('button', { name: 'Start from this' }),
    )
    fireEvent.click(within(bossa).getByRole('button', { name: 'Replace hits' }))

    const editor = within(drawer).getByTestId('drum-groove-editor')
    await waitFor(() => {
      expect(within(picker).getByText('Loaded')).toBeVisible()
      expect(editor).toHaveAttribute('data-dirty', 'true')
    })

    const undo = within(drawer).getByRole('button', { name: /^Undo/ })
    expect(undo).toBeEnabled()
    fireEvent.click(undo)

    // One undo restores the whole groove; the "Loaded" mark is a session-local
    // note about where the draft came from, so it deliberately stays put.
    await waitFor(() => expect(editor).toHaveAttribute('data-dirty', 'false'))
    expect(within(picker).getByText('Loaded')).toBeVisible()
  })

  it('offers the library beside the editor in the groove workspace', async () => {
    renderRoom()
    const drawer = await openGrooveDrawer()

    expect(
      within(drawer).getByRole('group', { name: 'Pattern style' }),
    ).toBeVisible()
    expect(
      within(drawer).getByRole('heading', { name: 'Start from a pattern' }),
    ).toBeVisible()
  })
})
