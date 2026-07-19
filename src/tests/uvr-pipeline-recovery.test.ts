// ============================================================
// UVR pipeline recovery — the anti-stuck machinery around the server poll:
// liveness-aware dedupe (a dead loop must never block a re-attach), bounded
// stem downloads (a stalled body read must not hang the session at
// "finalizing"), and one-loop-per-job ownership.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/uvr-api', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  return {
    ...orig,
    pollForCompletion: vi.fn(),
    getOutputFile: vi.fn(),
    processAudio: vi.fn(),
    deleteSession: vi.fn(),
  }
})
vi.mock('@/db/services/uvr-service', () => ({
  saveStemBlobDurable: vi.fn(),
}))

import { saveStemBlobDurable } from '@/db/services/uvr-service'
import { getOutputFile, pollForCompletion } from '@/lib/uvr-api'
import { isServerPollActive, resumeServerSession, } from '@/lib/uvr-processing-pipeline'
import type { UvrSession } from '@/stores/app-store'
import { saveAllUvrSessions } from '@/stores/app-store'

const mockedPoll = vi.mocked(pollForCompletion)
const mockedGetOutput = vi.mocked(getOutputFile)
const mockedSave = vi.mocked(saveStemBlobDurable)

type PollArgs = Parameters<typeof pollForCompletion>

function seedSession(sessionId: string, apiSessionId: string): void {
  saveAllUvrSessions([
    {
      sessionId,
      apiSessionId,
      status: 'processing',
      progress: 10,
      processingMode: 'server',
      originalFile: { name: 's.mp3', size: 1, mimeType: 'audio/mpeg' },
      createdAt: Date.now(),
    } as unknown as UvrSession,
  ])
}

const noopCallbacks = () => ({
  onProgress: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
})

describe('server poll recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedPoll.mockReset()
    mockedGetOutput.mockReset()
    mockedSave.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a live, ticking poll keeps sole ownership of its job', async () => {
    seedSession('s1', 'rp_gpu_a')
    let tick: PollArgs[1] | null = null
    mockedPoll.mockImplementation((_id, onProgress) => {
      tick = onProgress
      return new Promise(() => {}) // runs "forever"
    })

    void resumeServerSession('s1', 'rp_gpu_a', noopCallbacks())
    await vi.advanceTimersByTimeAsync(10)
    expect(isServerPollActive('rp_gpu_a')).toBe(true)

    // Keep ticking past the liveness window — ownership must hold.
    await vi.advanceTimersByTimeAsync(100_000)
    tick!(50, false, 'processing')
    await vi.advanceTimersByTimeAsync(100_000)
    tick!(60, false, 'processing')
    expect(isServerPollActive('rp_gpu_a')).toBe(true)

    // A second resume while live is a no-op.
    void resumeServerSession('s1', 'rp_gpu_a', noopCallbacks())
    await vi.advanceTimersByTimeAsync(10)
    expect(mockedPoll).toHaveBeenCalledTimes(1)
  })

  it('a dead loop expires and a re-attach takes the job over (the stuck-until-reload state)', async () => {
    seedSession('s2', 'rp_gpu_b')
    mockedPoll.mockImplementation(() => new Promise(() => {})) // hangs, never ticks

    void resumeServerSession('s2', 'rp_gpu_b', noopCallbacks())
    await vi.advanceTimersByTimeAsync(10)
    expect(isServerPollActive('rp_gpu_b')).toBe(true)

    // No ticks for > POLL_LIVENESS_MS: the entry must expire...
    await vi.advanceTimersByTimeAsync(121_000)
    expect(isServerPollActive('rp_gpu_b')).toBe(false)

    // ...so the foreground/online re-kick can actually re-attach.
    void resumeServerSession('s2', 'rp_gpu_b', noopCallbacks())
    await vi.advanceTimersByTimeAsync(10)
    expect(mockedPoll).toHaveBeenCalledTimes(2)
  })

  it('bounds a stalled stem download instead of hanging at finalizing', async () => {
    seedSession('s3', 'rp_gpu_c')
    mockedPoll.mockImplementation(async (_id, _p, onComplete) => {
      await onComplete([
        { stem: 'vocal', path: '/out/v', filename: 'v.wav' },
      ] as never)
    })
    // The response arrives, but the body read stalls forever — it only
    // rejects when the pipeline's download deadline aborts the signal.
    mockedGetOutput.mockImplementation((_s, _p, signal) => {
      return Promise.resolve({
        blob: () =>
          new Promise((_res, rej) => {
            signal?.addEventListener('abort', () =>
              rej(new DOMException('Aborted', 'AbortError')),
            )
          }),
      } as unknown as Response)
    })

    const callbacks = noopCallbacks()
    const run = resumeServerSession('s3', 'rp_gpu_c', callbacks)
    // Past the 120s download deadline: the abort fires, the stem falls back
    // to its server path, and the run finishes with a clear error instead of
    // hanging forever.
    await vi.advanceTimersByTimeAsync(121_000)
    await run
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining('Could not save'),
    )
    expect(isServerPollActive('rp_gpu_c')).toBe(false)
  })

  it('persists downloaded stems and reports completion when downloads succeed', async () => {
    seedSession('s4', 'rp_gpu_d')
    mockedPoll.mockImplementation(async (_id, _p, onComplete) => {
      await onComplete([
        { stem: 'vocal', path: '/out/v', filename: 'v.wav' },
        { stem: 'instrumental', path: '/out/i', filename: 'i.wav' },
      ] as never)
    })
    mockedGetOutput.mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['x'])),
    } as unknown as Response)
    mockedSave.mockResolvedValue({ ok: true, quotaExceeded: false })
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:minted',
      revokeObjectURL: () => {},
    })

    const callbacks = noopCallbacks()
    await resumeServerSession('s4', 'rp_gpu_d', callbacks)
    expect(mockedSave).toHaveBeenCalledTimes(2)
    expect(callbacks.onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        outputs: expect.objectContaining({
          vocal: 'blob:minted',
          instrumental: 'blob:minted',
        }),
      }),
    )
    expect(callbacks.onError).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
