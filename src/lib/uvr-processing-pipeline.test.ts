// ============================================================
// Server cancellation — keep a persisted job ID until DELETE succeeds
// ============================================================
//
// The real pipeline, API client and session store run over a stateful storage
// fake. The job has reached storage before the abort; a rejected DELETE must
// not erase the only ID a reload can use to recover it without another submit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
const boundary = vi.hoisted(() => ({
  poll: vi.fn(),
  ensureStorage: vi.fn(),
}))

vi.mock('@/db', () => ({ getDb: async () => adapter }))
vi.mock('@/lib/audio-duration', () => ({
  audioDurationSecs: async () => 200,
}))
vi.mock('@/db/persistent-storage', () => ({
  ensurePersistentStorage: boundary.ensureStorage,
}))
vi.mock('@/lib/uvr-api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  pollForCompletion: boundary.poll,
}))

const API_SESSION = 'rp_gpu_cancel-race'
const file = () => new File(['audio'], 'song.mp3', { type: 'audio/mpeg' })
const callbacks = () => ({
  onProgress: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
})

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await adapter.destroy()
  localStorage.clear()
  boundary.poll.mockReset().mockResolvedValue(undefined)
  boundary.ensureStorage.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function startSession() {
  const store = await import('@/stores/uvr-store')
  const pipeline = await import('@/lib/uvr-processing-pipeline')
  const sessionId = store.startUvrSession(
    'song.mp3',
    5,
    'audio/mpeg',
    'separate',
    'server',
  )
  const session = store.getUvrSession(sessionId)
  if (session === undefined) throw new Error('The test session was not created')
  // Start from a durably created row: this test isolates cancellation from
  // concurrent whole-library and per-session creation writes.
  expect(await store.persistSessionDurable(session)).toBe(true)
  // Both preparation and the native import queue mark the row processing
  // before calling the pipeline. startUvrSession alone leaves it idle.
  const processing = {
    ...session,
    status: 'processing' as const,
    indeterminate: true,
  }
  store.saveAllUvrSessions([processing])
  expect(await store.persistSessionDurable(processing)).toBe(true)
  expect(await savedSession(sessionId)).toHaveLength(1)
  return { store, pipeline, sessionId }
}

function network(cancel: () => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/uvr/process' && init?.method === 'POST') {
      return Promise.resolve(
        Response.json({
          session_id: API_SESSION,
          status: 'processing',
          message: 'Processing started',
          model: 'roformer',
          output_format: 'WAV',
        }),
      )
    }
    if (
      url === `/api/uvr/session/${API_SESSION}` &&
      init?.method === 'DELETE'
    ) {
      return Promise.resolve().then(cancel)
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function savedSession(sessionId: string) {
  return adapter
    .getRepository<UvrSessionRecord>('uvrSessions')
    .findAll({ where: { appSessionId: sessionId } })
}

describe('server abort after accepted submission', () => {
  it.each(['HTTP 502', 'network rejection', 'success'] as const)(
    '%s keeps only recoverable job IDs and preserves AbortError',
    async (outcome) => {
      const { store, pipeline, sessionId } = await startSession()
      const controller = new AbortController()
      const hooks = callbacks()
      const fetchMock = network(() => {
        if (outcome === 'network rejection') {
          throw new TypeError('Cancellation connection lost')
        }
        return outcome === 'HTTP 502'
          ? new Response('Cancellation unavailable', { status: 502 })
          : Response.json({ status: 'success', message: 'Session cancelled' })
      })

      // Hold the awaited durable write after it has stored the provider ID.
      // This puts the abort exactly between submission and the first poll.
      const persisted = Promise.withResolvers<undefined>()
      const release = Promise.withResolvers<undefined>()
      const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
      const update = repo.update.bind(repo)
      const delayed = vi
        .spyOn(repo, 'update')
        .mockImplementation(async (id, data) => {
          const record = await update(id, data)
          if (data.apiSessionId === API_SESSION) {
            persisted.resolve(undefined)
            await release.promise
          }
          return record
        })
      const run = pipeline.runUvrPipeline(file(), sessionId, 'server', hooks, {
        signal: controller.signal,
      })
      const rejected = expect(run).rejects.toMatchObject({ name: 'AbortError' })

      await persisted.promise
      expect((await savedSession(sessionId))[0].apiSessionId).toBe(API_SESSION)
      controller.abort()
      release.resolve(undefined)
      await rejected
      delayed.mockRestore()

      const expectedId = outcome === 'success' ? undefined : API_SESSION
      expect(store.getUvrSession(sessionId)?.apiSessionId).toBe(expectedId)
      // Successful cancellation clears through a queued best-effort write.
      await vi.waitFor(async () => {
        expect((await savedSession(sessionId))[0].apiSessionId).toBe(expectedId)
      })
      expect(
        fetchMock.mock.calls.map(([url, init]) => [url, init?.method]),
      ).toEqual([
        ['/api/uvr/process', 'POST'],
        [`/api/uvr/session/${API_SESSION}`, 'DELETE'],
      ])
      expect(boundary.poll).not.toHaveBeenCalled()
      expect(hooks.onComplete).not.toHaveBeenCalled()
      expect(hooks.onError).not.toHaveBeenCalled()
      expect(boundary.ensureStorage).not.toHaveBeenCalled()

      if (outcome !== 'success') {
        // Fresh store and pipeline, same storage: recovery uses the original
        // job ID and never submits or pays for another job.
        expect(await savedSession(sessionId)).toHaveLength(1)
        expect((await savedSession(sessionId))[0]).toMatchObject({
          status: 'processing',
          processingMode: 'server',
          apiSessionId: API_SESSION,
        })
        vi.resetModules()
        const reloaded = await import('@/stores/uvr-store')
        await reloaded.initSessionStore()
        const restored = reloaded.getUvrSession(sessionId)
        expect([
          restored?.status,
          restored?.processingMode,
          restored?.apiSessionId,
          restored?.error,
        ]).toEqual(['processing', 'server', API_SESSION, undefined])
        const recoverable = await reloaded.resumableServerSessions()
        expect(recoverable.map((session) => session.apiSessionId)).toEqual([
          API_SESSION,
        ])
        const resumed = await import('@/lib/uvr-processing-pipeline')
        await resumed.resumeServerSession(sessionId, API_SESSION, callbacks())
        expect(boundary.poll).toHaveBeenCalledTimes(1)
        expect(boundary.poll.mock.calls[0][0]).toBe(API_SESSION)
        expect(fetchMock).toHaveBeenCalledTimes(2)
      }
    },
  )

  it('polls an accepted non-aborted submission without deleting it', async () => {
    const { store, pipeline, sessionId } = await startSession()
    const fetchMock = network(() => {
      throw new Error('A normal run must not cancel')
    })

    await pipeline.runUvrPipeline(file(), sessionId, 'server', callbacks())

    expect(store.getUvrSession(sessionId)?.apiSessionId).toBe(API_SESSION)
    expect((await savedSession(sessionId))[0].apiSessionId).toBe(API_SESSION)
    expect(boundary.poll).toHaveBeenCalledTimes(1)
    expect(boundary.poll.mock.calls[0][0]).toBe(API_SESSION)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(boundary.ensureStorage).toHaveBeenCalledTimes(1)
  })

  it('does not submit, delete or poll when already aborted', async () => {
    const { store, pipeline, sessionId } = await startSession()
    const fetchMock = network(() => {
      throw new Error('There is no submitted job to cancel')
    })
    const controller = new AbortController()
    controller.abort()

    await expect(
      pipeline.runUvrPipeline(file(), sessionId, 'server', callbacks(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(store.getUvrSession(sessionId)?.apiSessionId).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(boundary.poll).not.toHaveBeenCalled()
    expect(boundary.ensureStorage).not.toHaveBeenCalled()
  })
})
