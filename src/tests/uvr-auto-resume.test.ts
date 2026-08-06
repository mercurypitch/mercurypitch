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
vi.mock('@/stores/uvr-store', () => ({
  resumableServerSessions: vi.fn(),
  setUvrSessionResuming: vi.fn(),
  completeUvrSession: vi.fn(() => Promise.resolve(true)),
  setErrorUvrSession: vi.fn(),
  isSessionStoreReady: vi.fn(() => true),
  getAllUvrSessions: vi.fn(() => []),
  getUvrSession: vi.fn(),
  recordUvrSplitJobStarted: vi.fn(() => Promise.resolve(true)),
  recordUvrSplitTime: vi.fn(() => Promise.resolve(true)),
  clearUvrSplitJob: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('@/lib/uvr-stem-split', async (importOriginal) => ({
  // Keep StemSplitError (and friends) real — the orchestrator branches on
  // instanceof + .recoverable to decide whether a resume marker survives.
  ...(await importOriginal<Record<string, unknown>>()),
  attachToStemSplitJob: vi.fn(() =>
    Promise.resolve({ saved: ['drums'], model: 'demucs-6s' }),
  ),
  isStemSplitActive: vi.fn(() => false),
  runStemSplit: vi.fn(() =>
    Promise.resolve({ saved: ['drums'], model: 'demucs-6s', elapsedMs: 5 }),
  ),
}))

import { autoResumeServerSessions, autoResumeStemSplits, startManagedStemSplit, } from '@/lib/uvr-auto-resume'
import { isServerPollActive, resumeServerSession, } from '@/lib/uvr-processing-pipeline'
import { attachToStemSplitJob, isStemSplitActive, runStemSplit, StemSplitError, } from '@/lib/uvr-stem-split'
import type { UvrSession } from '@/stores/uvr-store'
import { clearUvrSplitJob, completeUvrSession, getAllUvrSessions, recordUvrSplitJobStarted, recordUvrSplitTime, resumableServerSessions, setErrorUvrSession, setUvrSessionResuming, } from '@/stores/uvr-store'

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

// ── Split resume + managed launch ────────────────────────────────

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('autoResumeStemSplits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks keeps implementations — reset the ones tests override.
    vi.mocked(isStemSplitActive).mockReturnValue(false)
    vi.mocked(attachToStemSplitJob).mockResolvedValue({
      saved: ['drums'],
      model: 'demucs-6s',
    })
  })

  const splitSeed = (sessionId: string, splitApiSessionId?: string) =>
    ({ sessionId, splitApiSessionId }) as unknown as UvrSession

  it('re-attaches every session with a persisted split job', async () => {
    vi.mocked(getAllUvrSessions).mockReturnValue([
      splitSeed('s1', 'rp_gpu_split-1'),
      splitSeed('s2'),
    ])
    await autoResumeStemSplits()
    await flush()
    expect(attachToStemSplitJob).toHaveBeenCalledTimes(1)
    expect(attachToStemSplitJob).toHaveBeenCalledWith('s1', 'rp_gpu_split-1')
  })

  it('never double-attaches an already-running split', async () => {
    vi.mocked(getAllUvrSessions).mockReturnValue([
      splitSeed('s1', 'rp_gpu_split-1'),
    ])
    vi.mocked(isStemSplitActive).mockReturnValue(true)
    await autoResumeStemSplits()
    expect(attachToStemSplitJob).not.toHaveBeenCalled()
  })

  it('clears the marker on a definitive dead-job verdict', async () => {
    vi.mocked(getAllUvrSessions).mockReturnValue([
      splitSeed('s1', 'rp_gpu_gone'),
    ])
    vi.mocked(attachToStemSplitJob).mockRejectedValueOnce(
      new StemSplitError('job FAILED server-side', { recoverable: false }),
    )
    await autoResumeStemSplits()
    await flush()
    expect(clearUvrSplitJob).toHaveBeenCalledWith('s1')
  })

  it('keeps the marker through recoverable trouble — the claim ticket survives', async () => {
    vi.mocked(getAllUvrSessions).mockReturnValue([
      splitSeed('s1', 'rp_gpu_alive'),
    ])
    vi.mocked(attachToStemSplitJob).mockRejectedValueOnce(
      new StemSplitError('download hiccup', { recoverable: true }),
    )
    await autoResumeStemSplits()
    await flush()
    expect(clearUvrSplitJob).not.toHaveBeenCalled()
  })

  it('rides along with the main auto-resume triggers', async () => {
    mockedResumable.mockResolvedValue([])
    vi.mocked(getAllUvrSessions).mockReturnValue([])
    await autoResumeServerSessions()
    expect(getAllUvrSessions).toHaveBeenCalled()
  })
})

describe('startManagedStemSplit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists the job id on start and the split time on success', async () => {
    await startManagedStemSplit('s1', { reuseApiSessionId: 'rp_gpu_a' })
    const opts = vi.mocked(runStemSplit).mock.calls[0][1]!
    expect(opts.reuseApiSessionId).toBe('rp_gpu_a')
    await opts.onJobStarted?.('rp_gpu_split-9')
    expect(recordUvrSplitJobStarted).toHaveBeenCalledWith(
      's1',
      'rp_gpu_split-9',
    )
    expect(recordUvrSplitTime).toHaveBeenCalledWith('s1', 5)
  })

  it('clears the resume marker only on a definitive failure', async () => {
    vi.mocked(runStemSplit).mockRejectedValueOnce(
      new StemSplitError('job FAILED', { recoverable: false }),
    )
    await expect(startManagedStemSplit('s1')).rejects.toThrow('job FAILED')
    expect(clearUvrSplitJob).toHaveBeenCalledWith('s1')
    expect(recordUvrSplitTime).not.toHaveBeenCalled()
  })

  it('keeps the marker when the failure is recoverable', async () => {
    vi.mocked(runStemSplit).mockRejectedValueOnce(
      new StemSplitError('worker restarted mid-pickup', { recoverable: true }),
    )
    await expect(startManagedStemSplit('s1')).rejects.toThrow('mid-pickup')
    expect(clearUvrSplitJob).not.toHaveBeenCalled()
  })
})
