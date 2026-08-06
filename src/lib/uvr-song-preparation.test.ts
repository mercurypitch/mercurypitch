// ============================================================
// UVR song preparation tests protect dedupe, durable completion, cancellation, and recovery copy
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'

const workflow = vi.hoisted(() => ({
  sessions: [] as UvrSession[],
  hasRoomFor: vi.fn(),
  findSessionByFileHash: vi.fn(),
  getOriginalFileBlob: vi.fn(),
  saveStemBlobDurable: vi.fn(),
  computeFileHash: vi.fn(),
  runUvrPipeline: vi.fn(),
  cancelUvrPipeline: vi.fn(),
  initSessionStore: vi.fn(),
  persistSessionDurable: vi.fn(),
  saveAllUvrSessions: vi.fn(),
  setCurrentUvrSession: vi.fn(),
  setErrorUvrSession: vi.fn(),
  cancelUvrSession: vi.fn(),
  completeUvrSession: vi.fn(),
  startUvrSession: vi.fn(),
}))

vi.mock('@/db/durable-write', () => ({ hasRoomFor: workflow.hasRoomFor }))
vi.mock('@/db/services/uvr-service', () => ({
  findSessionByFileHash: workflow.findSessionByFileHash,
  getOriginalFileBlob: workflow.getOriginalFileBlob,
  saveStemBlobDurable: workflow.saveStemBlobDurable,
}))
vi.mock('@/lib/file-hash', () => ({
  computeFileHash: workflow.computeFileHash,
}))
vi.mock('@/lib/uvr-processing-pipeline', () => ({
  runUvrPipeline: workflow.runUvrPipeline,
  cancelUvrPipeline: workflow.cancelUvrPipeline,
}))
vi.mock('@/stores/uvr-store', () => ({
  initSessionStore: workflow.initSessionStore,
  persistSessionDurable: workflow.persistSessionDurable,
  getAllUvrSessions: () => workflow.sessions,
  getUvrSession: (sessionId: string) =>
    workflow.sessions.find((session) => session.sessionId === sessionId),
  getUvrSessionByHash: (hash: string) =>
    workflow.sessions.find(
      (session) => session.fileHash === hash && session.status === 'completed',
    ),
  saveAllUvrSessions: workflow.saveAllUvrSessions,
  setCurrentUvrSession: workflow.setCurrentUvrSession,
  setErrorUvrSession: workflow.setErrorUvrSession,
  cancelUvrSession: workflow.cancelUvrSession,
  completeUvrSession: workflow.completeUvrSession,
  startUvrSession: workflow.startUvrSession,
}))

import { prepareUvrSong } from './uvr-song-preparation'

function sourceFile(): File {
  return new File(['audio'], 'velvet.wav', { type: 'audio/wav' })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function session(
  sessionId: string,
  overrides: Partial<UvrSession> = {},
): UvrSession {
  return {
    sessionId,
    status: 'idle',
    progress: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('prepareUvrSong', () => {
  beforeEach(() => {
    workflow.sessions = []
    for (const mock of Object.values(workflow)) {
      if (typeof mock === 'function' && 'mockReset' in mock) mock.mockReset()
    }
    workflow.initSessionStore.mockResolvedValue(undefined)
    workflow.persistSessionDurable.mockResolvedValue(true)
    workflow.computeFileHash.mockResolvedValue('hash-velvet')
    workflow.findSessionByFileHash.mockResolvedValue(null)
    workflow.saveStemBlobDurable.mockResolvedValue({
      ok: true,
      quotaExceeded: false,
    })
    workflow.hasRoomFor.mockResolvedValue(true)
    workflow.startUvrSession.mockImplementation(() => {
      workflow.sessions.push(
        session('session-new', {
          fileHash: 'hash-velvet',
          processingMode: 'local',
        }),
      )
      return 'session-new'
    })
    workflow.saveAllUvrSessions.mockImplementation((sessions: UvrSession[]) => {
      workflow.sessions = sessions
    })
    workflow.setErrorUvrSession.mockImplementation(
      (sessionId: string, message: string) => {
        workflow.sessions = workflow.sessions.map((candidate) =>
          candidate.sessionId === sessionId
            ? { ...candidate, status: 'error', error: message }
            : candidate,
        )
      },
    )
    workflow.cancelUvrSession.mockImplementation((sessionId: string) => {
      workflow.sessions = workflow.sessions.map((candidate) =>
        candidate.sessionId === sessionId
          ? { ...candidate, status: 'cancelled' }
          : candidate,
      )
    })
    workflow.completeUvrSession.mockResolvedValue(true)
  })

  it('reuses completed stems without creating or running another session', async () => {
    workflow.sessions = [
      session('session-existing', {
        status: 'completed',
        fileHash: 'hash-velvet',
      }),
    ]

    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({ status: 'existing', sessionId: 'session-existing' })
    expect(workflow.startUvrSession).not.toHaveBeenCalled()
    expect(workflow.runUvrPipeline).not.toHaveBeenCalled()
  })

  it('reuses a completed durable match even when this tab cache is stale', async () => {
    workflow.findSessionByFileHash.mockResolvedValue({
      sessionId: 'session-other-tab',
      status: 'completed',
      processingMode: 'local',
    })

    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({
      status: 'existing',
      sessionId: 'session-other-tab',
    })
    expect(workflow.startUvrSession).not.toHaveBeenCalled()
  })

  it('protects a recoverable durable server job from duplicate work in another tab', async () => {
    workflow.findSessionByFileHash.mockResolvedValue({
      sessionId: 'session-paid-job',
      status: 'processing',
      processingMode: 'server',
      apiSessionId: 'provider-job',
    })

    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({
      status: 'in-flight',
      sessionId: 'session-paid-job',
      requiresHydration: true,
    })
    expect(workflow.startUvrSession).not.toHaveBeenCalled()
  })

  it('reuses only a recoverable in-flight server job', async () => {
    workflow.sessions = [
      session('session-server', {
        status: 'processing',
        fileHash: 'hash-velvet',
        processingMode: 'server',
        apiSessionId: 'provider-job',
      }),
    ]

    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({ status: 'in-flight', sessionId: 'session-server' })
    expect(workflow.startUvrSession).not.toHaveBeenCalled()
    expect(workflow.runUvrPipeline).not.toHaveBeenCalled()
  })

  it('does not strand a song behind a stale local processing record', async () => {
    workflow.sessions = [
      session('session-stale-local', {
        status: 'processing',
        fileHash: 'hash-velvet',
        processingMode: 'local',
      }),
    ]
    workflow.runUvrPipeline.mockImplementation(
      async (_file, _sessionId, _mode, callbacks) => {
        await callbacks.onComplete({ outputs: {}, stemMeta: {} })
      },
    )

    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({ status: 'completed', sessionId: 'session-new' })
    expect(workflow.startUvrSession).toHaveBeenCalledTimes(1)
  })

  it('retains the source, warns about storage, and durably completes', async () => {
    workflow.hasRoomFor.mockResolvedValue(false)
    workflow.runUvrPipeline.mockImplementation(
      async (_file, _sessionId, _mode, callbacks) => {
        callbacks.onProgress(43)
        await callbacks.onComplete({
          outputs: { instrumental: 'blob:instrumental' },
          stemMeta: { instrumental: { size: 12 } },
        })
      },
    )
    const onUpdate = vi.fn()
    const onWarning = vi.fn()
    const onCompleted = vi.fn()

    await expect(
      prepareUvrSong(sourceFile(), {
        mode: 'local',
        onUpdate,
        onWarning,
        onCompleted,
      }),
    ).resolves.toEqual({ status: 'completed', sessionId: 'session-new' })

    expect(workflow.saveStemBlobDurable).toHaveBeenCalledWith(
      'session-new',
      'original',
      expect.any(File),
      'velvet.wav',
    )
    expect(workflow.hasRoomFor).toHaveBeenCalledWith(sourceFile().size * 12)
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'low-storage' }),
    )
    expect(onUpdate).toHaveBeenCalledWith({
      phase: 'separating',
      progress: 43,
    })
    expect(workflow.completeUvrSession).toHaveBeenCalledWith(
      'session-new',
      { instrumental: 'blob:instrumental' },
      { instrumental: { size: 12 } },
    )
    expect(onCompleted).toHaveBeenCalledWith(
      'session-new',
      expect.objectContaining({
        outputs: { instrumental: 'blob:instrumental' },
      }),
    )
  })

  it('does not report success until a completed library record is durable', async () => {
    workflow.completeUvrSession.mockImplementation(
      async (sessionId: string) => {
        workflow.sessions = workflow.sessions.map((candidate) =>
          candidate.sessionId === sessionId
            ? { ...candidate, status: 'completed' }
            : candidate,
        )
        return false
      },
    )
    workflow.runUvrPipeline.mockImplementation(
      async (_file, _sessionId, _mode, callbacks) => {
        await callbacks.onComplete({ outputs: {}, stemMeta: {} })
      },
    )
    const onWarning = vi.fn()
    const onCompleted = vi.fn()

    const firstAttempt = await prepareUvrSong(sourceFile(), {
      mode: 'local',
      onWarning,
      onCompleted,
    })

    expect(firstAttempt).toMatchObject({
      status: 'error',
      sessionId: 'session-new',
      message: expect.stringContaining('could not save the song record'),
    })
    expect(onWarning).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'session-not-saved' }),
    )
    expect(onCompleted).not.toHaveBeenCalled()

    workflow.persistSessionDurable.mockResolvedValue(true)
    await expect(
      prepareUvrSong(sourceFile(), { mode: 'local' }),
    ).resolves.toEqual({ status: 'existing', sessionId: 'session-new' })
    expect(workflow.runUvrPipeline).toHaveBeenCalledTimes(1)
  })

  it('turns internal failures into actionable on-device copy', async () => {
    workflow.runUvrPipeline.mockImplementation(
      async (_file, _sessionId, _mode, callbacks) => {
        callbacks.onError("TypeError: can't read property 'length'")
      },
    )

    const result = await prepareUvrSong(sourceFile(), { mode: 'local' })

    expect(result).toEqual({
      status: 'error',
      sessionId: 'session-new',
      message:
        'On-device processing hit an unexpected error. Reload and try again.',
    })
    expect(workflow.setErrorUvrSession).toHaveBeenCalledWith(
      'session-new',
      expect.stringContaining('On-device processing'),
    )
  })

  it('cancels the provider and session without accepting a late result', async () => {
    const controller = new AbortController()
    workflow.runUvrPipeline.mockImplementation(
      (_file, _sessionId, _mode, _callbacks, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError')),
          )
        }),
    )

    const preparation = prepareUvrSong(sourceFile(), {
      mode: 'local',
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(workflow.runUvrPipeline).toHaveBeenCalled())
    controller.abort()

    await expect(preparation).resolves.toEqual({
      status: 'cancelled',
      sessionId: 'session-new',
    })
    expect(workflow.cancelUvrPipeline).toHaveBeenCalledTimes(1)
    expect(workflow.cancelUvrPipeline).toHaveBeenCalledWith('local', undefined)
    expect(workflow.cancelUvrSession).toHaveBeenCalledTimes(1)
    expect(workflow.cancelUvrSession).toHaveBeenCalledWith('session-new', false)
    expect(workflow.completeUvrSession).not.toHaveBeenCalled()
  })

  it('keeps completed stems in the library when cancellation races the durable write', async () => {
    const durableCompletion = deferred<boolean>()
    const controller = new AbortController()
    workflow.completeUvrSession.mockReturnValue(durableCompletion.promise)
    workflow.runUvrPipeline.mockImplementation(
      async (_file, _sessionId, _mode, callbacks) => {
        await callbacks.onComplete({ outputs: {}, stemMeta: {} })
      },
    )

    const preparation = prepareUvrSong(sourceFile(), {
      mode: 'local',
      signal: controller.signal,
    })
    await vi.waitFor(() =>
      expect(workflow.completeUvrSession).toHaveBeenCalled(),
    )
    controller.abort()
    durableCompletion.resolve(true)

    await expect(preparation).resolves.toEqual({
      status: 'cancelled',
      sessionId: 'session-new',
    })
    expect(workflow.cancelUvrPipeline).not.toHaveBeenCalled()
    expect(workflow.cancelUvrSession).not.toHaveBeenCalled()
  })
})
