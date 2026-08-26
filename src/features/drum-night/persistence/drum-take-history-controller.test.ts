// Drum take history controller tests — lazy storage and stale-completion safety.

import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { DrumLibraryResult } from '@/db/services/drum-library-service'
import type { DrumTakeHistoryService } from './drum-take-history-controller'
import { createDrumTakeHistoryController } from './drum-take-history-controller'
import type { DrumTakeSummary } from './drum-take-summary'

function summary(overrides: Partial<DrumTakeSummary> = {}): DrumTakeSummary {
  return {
    schemaVersion: 1,
    id: 'take-1',
    projectId: 'project-1',
    projectRevision: 2,
    projectFingerprint: 'drum-v1-0123456789abcdef',
    completedAt: '2026-08-26T11:00:00.000Z',
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
    evidenceScope: 'timing-and-dynamics',
    confidence: 0.9,
    targetHitCount: 8,
    capturedHitCount: 7,
    omittedCaptureHitCount: 0,
    matchedHitCount: 6,
    unmatchedTargetCount: 2,
    unmatchedCaptureCount: 1,
    uncertainTimingCount: 1,
    earlyCount: 1,
    centredCount: 3,
    lateCount: 1,
    meanTimingOffsetMs: -2,
    meanAbsoluteTimingOffsetMs: 18,
    meanVelocityOffset: 3,
    meanAbsoluteVelocityOffset: 7,
    recovery: { focus: 'timing', barNumber: 2 },
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function harness(service: DrumTakeHistoryService) {
  return createRoot((disposeRoot) => {
    const loadService = vi.fn(async () => service)
    const controller = createDrumTakeHistoryController({ loadService })
    return {
      controller,
      loadService,
      dispose: () => {
        controller.dispose()
        disposeRoot()
      },
    }
  })
}

function service(overrides: Partial<DrumTakeHistoryService> = {}) {
  const appendTakeSummary = vi.fn(
    async (
      value: DrumTakeSummary,
    ): Promise<DrumLibraryResult<DrumTakeSummary>> => ({
      ok: true,
      value,
    }),
  )
  const listTakeSummaries = vi.fn(
    async (): Promise<DrumLibraryResult<DrumTakeSummary[]>> => ({
      ok: true,
      value: [],
    }),
  )
  return {
    appendTakeSummary,
    listTakeSummaries,
    ...overrides,
  } satisfies DrumTakeHistoryService
}

describe('createDrumTakeHistoryController', () => {
  it('keeps the database module lazy until an explicit finish or history action', async () => {
    const context = harness(service())

    context.controller.setActiveProject('project-1')
    context.controller.invalidatePendingTake()
    expect(context.loadService).not.toHaveBeenCalled()

    await context.controller.loadHistory('project-1')
    expect(context.loadService).toHaveBeenCalledTimes(1)
    context.dispose()
  })

  it('validates and deeply freezes the take before crossing async storage', async () => {
    const appendGate = deferred<DrumLibraryResult<DrumTakeSummary>>()
    let received: DrumTakeSummary | null = null
    const context = harness(
      service({
        appendTakeSummary: vi.fn((value) => {
          received = value
          return appendGate.promise
        }),
      }),
    )
    context.controller.setActiveProject('project-1')
    const input = summary()

    const completion = context.controller.finish(input)
    expect(context.controller.finishState()).toEqual({ kind: 'saving' })
    await vi.waitFor(() => expect(received).not.toBeNull())
    expect(received).not.toBe(input)
    expect(Object.isFrozen(received)).toBe(true)
    expect(Object.isFrozen(received!.evidencePolicy)).toBe(true)
    expect(Object.isFrozen(received!.inputSources)).toBe(true)
    appendGate.resolve({ ok: true, value: received! })
    await expect(completion).resolves.toBe(true)
    context.dispose()
  })

  it('rejects invalid evidence synchronously without loading storage', async () => {
    const context = harness(service())
    context.controller.setActiveProject('project-1')

    const completion = context.controller.finish({
      ...summary(),
      capturedHitCount: 0,
    })

    expect(context.controller.finishState().kind).toBe('error')
    expect(context.loadService).not.toHaveBeenCalled()
    await expect(completion).resolves.toBe(false)
    context.dispose()
  })

  it('deduplicates a double finish submission into one append', async () => {
    const appendGate = deferred<DrumLibraryResult<DrumTakeSummary>>()
    const appendTakeSummary = vi.fn(() => appendGate.promise)
    const context = harness(service({ appendTakeSummary }))
    context.controller.setActiveProject('project-1')
    const take = summary()

    const first = context.controller.finish(take)
    const second = context.controller.finish(take)
    await vi.waitFor(() => expect(appendTakeSummary).toHaveBeenCalledTimes(1))
    appendGate.resolve({ ok: true, value: summary() })

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(appendTakeSummary).toHaveBeenCalledTimes(1)
    context.dispose()
  })

  it('retains the exact failed frozen summary for retry', async () => {
    const received: DrumTakeSummary[] = []
    const appendTakeSummary = vi
      .fn()
      .mockImplementationOnce(async (value: DrumTakeSummary) => {
        received.push(value)
        return { ok: false, code: 'storage-unavailable' as const }
      })
      .mockImplementationOnce(async (value: DrumTakeSummary) => {
        received.push(value)
        return { ok: true, value }
      })
    const context = harness(service({ appendTakeSummary }))
    context.controller.setActiveProject('project-1')

    await expect(context.controller.finish(summary())).resolves.toBe(false)
    expect(context.controller.finishState().kind).toBe('error')
    await expect(context.controller.retryFinish()).resolves.toBe(true)

    expect(received).toHaveLength(2)
    expect(received[1]).toBe(received[0])
    expect(Object.isFrozen(received[0])).toBe(true)
    expect(context.controller.finishState().kind).toBe('saved')
    context.dispose()
  })

  it('keeps a failed retry and loaded history when the active project id is unchanged', async () => {
    const context = harness(
      service({
        appendTakeSummary: vi.fn(async () => ({
          ok: false as const,
          code: 'storage-unavailable' as const,
        })),
        listTakeSummaries: vi.fn(async () => ({
          ok: true as const,
          value: [summary()],
        })),
      }),
    )
    context.controller.setActiveProject('project-1')

    await expect(context.controller.finish(summary())).resolves.toBe(false)
    await expect(context.controller.loadHistory('project-1')).resolves.toBe(
      true,
    )
    context.controller.setActiveProject('project-1')

    expect(context.controller.finishState().kind).toBe('error')
    expect(context.controller.historyState().kind).toBe('ready')
    await expect(context.controller.retryFinish()).resolves.toBe(false)
    context.dispose()
  })

  it('returns false for an invalidated finish completion without clearing evidence', async () => {
    const appendGate = deferred<DrumLibraryResult<DrumTakeSummary>>()
    const appendTakeSummary = vi.fn(() => appendGate.promise)
    const context = harness(service({ appendTakeSummary }))
    context.controller.setActiveProject('project-1')

    const completion = context.controller.finish(summary())
    context.controller.invalidatePendingTake()
    appendGate.resolve({ ok: true, value: summary() })

    await expect(completion).resolves.toBe(false)
    expect(appendTakeSummary).not.toHaveBeenCalled()
    expect(context.controller.finishState()).toEqual({ kind: 'idle' })
    await expect(context.controller.retryFinish()).resolves.toBe(false)
    context.dispose()
  })

  it('ignores stale write and history completions after a project switch', async () => {
    const appendGate = deferred<DrumLibraryResult<DrumTakeSummary>>()
    const historyGate = deferred<DrumLibraryResult<DrumTakeSummary[]>>()
    const context = harness(
      service({
        appendTakeSummary: vi.fn(() => appendGate.promise),
        listTakeSummaries: vi.fn(() => historyGate.promise),
      }),
    )
    context.controller.setActiveProject('project-1')

    const finishCompletion = context.controller.finish(summary())
    const historyCompletion = context.controller.loadHistory('project-1')
    context.controller.setActiveProject('project-2')
    appendGate.resolve({ ok: true, value: summary() })
    historyGate.resolve({ ok: true, value: [summary()] })

    await expect(finishCompletion).resolves.toBe(false)
    await expect(historyCompletion).resolves.toBe(false)
    expect(context.controller.finishState()).toEqual({ kind: 'idle' })
    expect(context.controller.historyState()).toEqual({ kind: 'idle' })
    context.dispose()
  })

  it('loads bounded history metadata and retries a failed list', async () => {
    const listTakeSummaries = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: 'storage-unavailable' as const,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [summary({ id: 'take-2' }), summary()],
        skippedRecords: 2,
        futureRecords: 1,
      })
    const context = harness(service({ listTakeSummaries }))
    context.controller.setActiveProject('project-1')

    await expect(context.controller.loadHistory('project-1')).resolves.toBe(
      false,
    )
    expect(context.controller.historyState().kind).toBe('error')
    await expect(context.controller.retryHistory()).resolves.toBe(true)

    expect(context.controller.historyState()).toMatchObject({
      kind: 'ready',
      skippedRecords: 2,
      futureRecords: 1,
    })
    const ready = context.controller.historyState()
    expect(
      ready.kind === 'ready' && ready.summaries.map((take) => take.id),
    ).toEqual(['take-1', 'take-2'])
    context.dispose()
  })
})
