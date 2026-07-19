// ============================================================
// Shared background auto-resume — the recovery that re-attaches orphaned
// server (RunPod) separations on load, app-wide and on the standalone Karaoke
// Night page. Verifies it resumes what it should, never double-polls an active
// job (which would risk a wasted credit), and wires the store callbacks.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/uvr-processing-pipeline', () => ({
  isServerPollActive: vi.fn(),
  resumeServerSession: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/stores/app-store', () => ({
  resumableServerSessions: vi.fn(),
  setUvrSessionResuming: vi.fn(),
  completeUvrSession: vi.fn(() => Promise.resolve(true)),
  setErrorUvrSession: vi.fn(),
  isSessionStoreReady: vi.fn(() => true),
}))

import { autoResumeServerSessions } from '@/lib/uvr-auto-resume'
import { isServerPollActive, resumeServerSession, } from '@/lib/uvr-processing-pipeline'
import type { UvrSession } from '@/stores/app-store'
import { completeUvrSession, resumableServerSessions, setErrorUvrSession, setUvrSessionResuming, } from '@/stores/app-store'

const mockedResumable = vi.mocked(resumableServerSessions)
const mockedActive = vi.mocked(isServerPollActive)
const mockedResume = vi.mocked(resumeServerSession)
const mockedResuming = vi.mocked(setUvrSessionResuming)

const seed = (sessionId: string, apiSessionId: string): UvrSession =>
  ({
    sessionId,
    apiSessionId,
    status: 'processing',
    processingMode: 'server',
    progress: 40,
    createdAt: 1,
  }) as unknown as UvrSession

describe('autoResumeServerSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedActive.mockReturnValue(false)
  })
  afterEach(() => vi.restoreAllMocks())

  it('resumes every recoverable job that is not already polling', async () => {
    mockedResumable.mockResolvedValue([
      seed('s1', 'rp_gpu_a'),
      seed('s2', 'rp_gpu_b'),
    ])

    await autoResumeServerSessions()

    expect(mockedResume).toHaveBeenCalledTimes(2)
    expect(mockedResume).toHaveBeenCalledWith(
      's1',
      'rp_gpu_a',
      expect.anything(),
    )
    expect(mockedResume).toHaveBeenCalledWith(
      's2',
      'rp_gpu_b',
      expect.anything(),
    )
    expect(mockedResuming).toHaveBeenCalledWith('s1')
    expect(mockedResuming).toHaveBeenCalledWith('s2')
  })

  it('skips a job whose poll is already live (no double-poll, no re-charge)', async () => {
    mockedResumable.mockResolvedValue([seed('s1', 'rp_gpu_a')])
    mockedActive.mockReturnValue(true)

    await autoResumeServerSessions()

    expect(mockedResume).not.toHaveBeenCalled()
    expect(mockedResuming).not.toHaveBeenCalled()
  })

  it('skips a session missing its RunPod job id', async () => {
    mockedResumable.mockResolvedValue([seed('s1', '')])

    await autoResumeServerSessions()

    expect(mockedResume).not.toHaveBeenCalled()
  })

  it('is a no-op when nothing is recoverable', async () => {
    mockedResumable.mockResolvedValue([])

    await autoResumeServerSessions()

    expect(mockedResume).not.toHaveBeenCalled()
  })

  it('completion callback persists the result and pings the credits hook', async () => {
    mockedResumable.mockResolvedValue([seed('s1', 'rp_gpu_a')])
    const onCreditsMaybeChanged = vi.fn()

    await autoResumeServerSessions({ onCreditsMaybeChanged })

    // Drive the background callbacks the pipeline would have invoked.
    const callbacks = mockedResume.mock.calls[0][2]
    await callbacks.onComplete({
      outputs: { vocals: 'blob:x' },
      stemMeta: {},
    } as never)

    expect(vi.mocked(completeUvrSession)).toHaveBeenCalledWith(
      's1',
      { vocals: 'blob:x' },
      {},
    )
    expect(onCreditsMaybeChanged).toHaveBeenCalledTimes(1)
  })

  it('error callback records the error and pings the credits hook', async () => {
    mockedResumable.mockResolvedValue([seed('s1', 'rp_gpu_a')])
    const onCreditsMaybeChanged = vi.fn()

    await autoResumeServerSessions({ onCreditsMaybeChanged })

    const callbacks = mockedResume.mock.calls[0][2]
    callbacks.onError('server exploded')

    expect(vi.mocked(setErrorUvrSession)).toHaveBeenCalledWith(
      's1',
      'server exploded',
    )
    expect(onCreditsMaybeChanged).toHaveBeenCalledTimes(1)
  })
})
