// ============================================================
// Drum take history controller — explicit, generation-safe local evidence
// ============================================================
//
// Finishing is the only write boundary. The host keeps ownership of runtime
// evidence and clears it only when finish returns true; stale completions can
// therefore never erase a newer take. Storage remains dynamically loaded until
// the musician explicitly finishes a take or opens history.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DrumLibraryService } from '@/db/services/drum-library-service'
import type { DrumTakeFinishState } from './drum-persistence-ui'
import type { DrumTakeSummary } from './drum-take-summary'
import { DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT, validateDrumTakeSummary, } from './drum-take-summary'

export type DrumTakeHistoryService = Pick<
  DrumLibraryService,
  'appendTakeSummary' | 'listTakeSummaries'
>

export type DrumTakeHistoryControllerState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message?: string }
  | {
      readonly kind: 'ready'
      readonly summaries: readonly DrumTakeSummary[]
      readonly skippedRecords: number
      readonly futureRecords: number
    }

export interface DrumTakeHistoryControllerOptions {
  readonly loadService?: () => Promise<DrumTakeHistoryService>
}

export interface DrumTakeHistoryController {
  readonly finishState: Accessor<DrumTakeFinishState>
  readonly historyState: Accessor<DrumTakeHistoryControllerState>
  /** Validate and freeze before queuing the one durable append. */
  readonly finish: (summary: DrumTakeSummary) => Promise<boolean>
  /** Retry the exact frozen summary retained after the last write failure. */
  readonly retryFinish: () => Promise<boolean>
  readonly loadHistory: (projectId: string) => Promise<boolean>
  readonly retryHistory: () => Promise<boolean>
  /** Establish a hard project boundary and invalidate every older completion. */
  readonly setActiveProject: (projectId: string | null) => void
  /** Invalidate a finish without touching runtime evidence or durable rows. */
  readonly invalidatePendingTake: () => void
  readonly dispose: () => void
}

interface PendingFinish {
  readonly generation: number
  readonly summaryId: string
  readonly promise: Promise<boolean>
}

interface PendingHistory {
  readonly generation: number
  readonly projectId: string
  readonly promise: Promise<boolean>
}

async function defaultLoadService(): Promise<DrumTakeHistoryService> {
  const module = await import('@/db/services/drum-library-service')
  return module.createDrumLibraryService()
}

function finishFailureMessage(code?: string): string {
  if (code === 'quota-exceeded' || code === 'project-limit') {
    return 'This device does not have room for another take.'
  }
  if (code === 'conflict') {
    return 'This take was already saved.'
  }
  if (code === 'not-found' || code === 'invalid-project') {
    return 'The saved project is no longer available.'
  }
  if (code === 'invalid-summary') {
    return 'This take no longer matches the saved project.'
  }
  return 'The take could not be saved on this device.'
}

function historyFailureMessage(code?: string): string {
  if (code === 'not-found' || code === 'invalid-project') {
    return 'The saved project is no longer available.'
  }
  return 'Take history could not be opened on this device.'
}

function orderedUniqueSummaries(
  summaries: readonly DrumTakeSummary[],
): readonly DrumTakeSummary[] {
  const byId = new Map<string, DrumTakeSummary>()
  for (const summary of summaries) {
    if (!byId.has(summary.id)) byId.set(summary.id, summary)
  }
  return Object.freeze(
    [...byId.values()]
      .sort(
        (left, right) =>
          right.completedAt.localeCompare(left.completedAt) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT),
  )
}

export function createDrumTakeHistoryController(
  options: DrumTakeHistoryControllerOptions = {},
): DrumTakeHistoryController {
  const loadService = options.loadService ?? defaultLoadService
  const [finishState, setFinishStateSignal] = createSignal<DrumTakeFinishState>(
    { kind: 'idle' },
  )
  const [historyState, setHistoryStateSignal] =
    createSignal<DrumTakeHistoryControllerState>({ kind: 'idle' })

  let disposed = false
  let activeProjectId: string | null = null
  let finishGeneration = 0
  let historyGeneration = 0
  let servicePromise: Promise<DrumTakeHistoryService> | null = null
  let appendTail: Promise<void> = Promise.resolve()
  let pendingFinish: PendingFinish | null = null
  let pendingHistory: PendingHistory | null = null
  let failedSummary: DrumTakeSummary | null = null
  let retryHistoryProjectId: string | null = null
  let loadedHistoryProjectId: string | null = null
  let historySnapshot: DrumTakeHistoryControllerState = { kind: 'idle' }

  const setFinishState = (state: DrumTakeFinishState): void => {
    setFinishStateSignal(state)
  }

  const setHistoryState = (state: DrumTakeHistoryControllerState): void => {
    historySnapshot = state
    setHistoryStateSignal(state)
  }

  const getService = (): Promise<DrumTakeHistoryService> => {
    if (servicePromise === null) {
      const retryable = loadService().catch((error: unknown) => {
        servicePromise = null
        throw error
      })
      servicePromise = retryable
    }
    return servicePromise
  }

  const isCurrentFinish = (generation: number, projectId: string): boolean =>
    !disposed &&
    generation === finishGeneration &&
    activeProjectId === projectId

  const isCurrentHistory = (generation: number, projectId: string): boolean =>
    !disposed &&
    generation === historyGeneration &&
    activeProjectId === projectId

  const queueAppend = (
    summary: DrumTakeSummary,
    generation: number,
    projectId: string,
  ) => {
    const operation = appendTail.then(async () => {
      if (!isCurrentFinish(generation, projectId)) return null
      const service = await getService()
      if (!isCurrentFinish(generation, projectId)) return null
      return service.appendTakeSummary(summary)
    })
    appendTail = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }

  const beginFinish = (summary: DrumTakeSummary): Promise<boolean> => {
    if (disposed || activeProjectId !== summary.projectId) {
      failedSummary = null
      setFinishState({
        kind: 'error',
        message: 'Finish a take inside its active saved project.',
      })
      return Promise.resolve(false)
    }

    const currentPending = pendingFinish
    if (currentPending?.generation === finishGeneration) {
      return currentPending.summaryId === summary.id
        ? currentPending.promise
        : Promise.resolve(false)
    }

    const generation = finishGeneration
    const projectId = summary.projectId
    failedSummary = null
    setFinishState({ kind: 'saving' })

    const promise = (async (): Promise<boolean> => {
      try {
        const result = await queueAppend(summary, generation, projectId)
        if (result === null) return false
        if (!isCurrentFinish(generation, projectId)) return false
        if (!result.ok) {
          failedSummary = summary
          setFinishState({
            kind: 'error',
            message: finishFailureMessage(result.code),
          })
          return false
        }

        failedSummary = null
        setFinishState({
          kind: 'saved',
          message: 'Take saved on this device.',
        })
        if (
          loadedHistoryProjectId === projectId &&
          historySnapshot.kind === 'ready'
        ) {
          setHistoryState({
            ...historySnapshot,
            summaries: orderedUniqueSummaries([
              result.value,
              ...historySnapshot.summaries,
            ]),
          })
        }
        return true
      } catch {
        if (!isCurrentFinish(generation, projectId)) return false
        failedSummary = summary
        setFinishState({
          kind: 'error',
          message: finishFailureMessage(),
        })
        return false
      }
    })()

    const pending: PendingFinish = {
      generation,
      summaryId: summary.id,
      promise,
    }
    pendingFinish = pending
    void promise.finally(() => {
      if (pendingFinish === pending) pendingFinish = null
    })
    return promise
  }

  const finish = (untrustedSummary: DrumTakeSummary): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    let summary: DrumTakeSummary
    try {
      // Deliberately synchronous: mutations after this call cannot alter the
      // scalar row that crosses the async storage boundary.
      summary = validateDrumTakeSummary(untrustedSummary)
    } catch {
      failedSummary = null
      setFinishState({
        kind: 'error',
        message: 'This take could not be prepared for saving.',
      })
      return Promise.resolve(false)
    }
    return beginFinish(summary)
  }

  const retryFinish = (): Promise<boolean> => {
    if (disposed || failedSummary === null) return Promise.resolve(false)
    return beginFinish(failedSummary)
  }

  const loadHistory = (projectId: string): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    if (projectId.length === 0 || activeProjectId !== projectId) {
      retryHistoryProjectId = null
      loadedHistoryProjectId = null
      setHistoryState({
        kind: 'error',
        message: 'Open the saved project before viewing its take history.',
      })
      return Promise.resolve(false)
    }

    const currentPending = pendingHistory
    if (
      currentPending?.generation === historyGeneration &&
      currentPending.projectId === projectId
    ) {
      return currentPending.promise
    }

    const generation = ++historyGeneration
    retryHistoryProjectId = projectId
    loadedHistoryProjectId = null
    setHistoryState({ kind: 'loading' })

    const promise = (async (): Promise<boolean> => {
      try {
        if (!isCurrentHistory(generation, projectId)) return false
        const service = await getService()
        if (!isCurrentHistory(generation, projectId)) return false
        const result = await service.listTakeSummaries(projectId)
        if (!isCurrentHistory(generation, projectId)) return false
        if (!result.ok) {
          setHistoryState({
            kind: 'error',
            message: historyFailureMessage(result.code),
          })
          return false
        }
        retryHistoryProjectId = null
        loadedHistoryProjectId = projectId
        setHistoryState({
          kind: 'ready',
          summaries: orderedUniqueSummaries(result.value),
          skippedRecords: result.skippedRecords ?? 0,
          futureRecords: result.futureRecords ?? 0,
        })
        return true
      } catch {
        if (!isCurrentHistory(generation, projectId)) return false
        setHistoryState({
          kind: 'error',
          message: historyFailureMessage(),
        })
        return false
      }
    })()

    const pending: PendingHistory = { generation, projectId, promise }
    pendingHistory = pending
    void promise.finally(() => {
      if (pendingHistory === pending) pendingHistory = null
    })
    return promise
  }

  const retryHistory = (): Promise<boolean> => {
    if (disposed || retryHistoryProjectId === null) {
      return Promise.resolve(false)
    }
    return loadHistory(retryHistoryProjectId)
  }

  const setActiveProject = (projectId: string | null): void => {
    if (disposed) return
    if (activeProjectId === projectId) return
    activeProjectId = projectId
    finishGeneration += 1
    historyGeneration += 1
    failedSummary = null
    retryHistoryProjectId = null
    loadedHistoryProjectId = null
    setFinishState({ kind: 'idle' })
    setHistoryState({ kind: 'idle' })
  }

  const invalidatePendingTake = (): void => {
    if (disposed) return
    finishGeneration += 1
    failedSummary = null
    setFinishState({ kind: 'idle' })
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    finishGeneration += 1
    historyGeneration += 1
    failedSummary = null
    retryHistoryProjectId = null
    loadedHistoryProjectId = null
    setFinishState({ kind: 'idle' })
    setHistoryState({ kind: 'idle' })
  }

  return {
    finishState,
    historyState,
    finish,
    retryFinish,
    loadHistory,
    retryHistory,
    setActiveProject,
    invalidatePendingTake,
    dispose,
  }
}
