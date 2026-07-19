// ============================================================
// UVR server-poll flow — locally runnable coverage of the client's
// status-polling contract against a scripted fetch. These are the cases
// field testing keeps hitting: cold-start queues, transient network blips,
// terminal server errors, the 30-minute wall clock.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollForCompletion, TerminalPollError } from '@/lib/uvr-api'

interface ScriptedStatus {
  status?: 'processing' | 'completed' | 'not_started' | 'error'
  message?: string
  progress?: number | null
  files?: { stem: string; path: string; filename: string; size?: number }[]
  error?: string
  /** Reject this poll instead of answering (network blip). */
  reject?: boolean
}

/** Install a fetch mock that answers /status calls from a script; the last
 *  entry repeats once the script runs out. */
function scriptStatuses(script: ScriptedStatus[]): () => number {
  let calls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      const step = script[Math.min(calls, script.length - 1)]
      calls++
      if (step.reject === true) {
        return Promise.reject(new TypeError('network blip'))
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            session_id: 'rp_gpu_job1',
            status: step.status ?? 'processing',
            progress: step.progress ?? null,
            message: step.message,
            files: step.files ?? [],
            error: step.error,
          }),
      })
    }),
  )
  return () => calls
}

interface ProgressTick {
  progress: number
  indeterminate?: boolean
  phase?: 'queued' | 'processing'
}

function runPoll(opts?: { estimatedSecs?: number }) {
  const ticks: ProgressTick[] = []
  const onComplete = vi.fn()
  const onError = vi.fn()
  const promise = pollForCompletion(
    'rp_gpu_job1',
    (progress, indeterminate, phase) =>
      ticks.push({ progress, indeterminate, phase }),
    onComplete,
    onError,
    1000,
    undefined,
    opts?.estimatedSecs,
  )
  // The caller in the pipeline always handles rejection; do the same so a
  // rejecting scenario can't fail the test run as an unhandled rejection.
  promise.catch(() => {})
  return { ticks, onComplete, onError, promise }
}

describe('pollForCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('holds at 0/queued through a cold start instead of burning the estimate', async () => {
    // 15s of queue against a 10s estimate — the old clock would have hit 95%
    // "still separating" before the GPU even started.
    const script: ScriptedStatus[] = [
      ...Array.from({ length: 15 }, () => ({ message: 'Queued' })),
      { message: 'Processing' },
      {
        status: 'completed' as const,
        files: [{ stem: 'vocal', path: '/p/v', filename: 'v.wav' }],
      },
    ]
    scriptStatuses(script)
    const { ticks, onComplete, promise } = runPoll({ estimatedSecs: 10 })

    await vi.advanceTimersByTimeAsync(20_000)
    await promise

    const queuedTicks = ticks.filter((t) => t.phase === 'queued')
    expect(queuedTicks.length).toBeGreaterThanOrEqual(10)
    for (const t of queuedTicks) {
      expect(t.progress).toBe(0)
      expect(t.indeterminate).toBe(true)
    }
    // The estimate clock starts when processing starts: the first processing
    // tick must be near zero, not pinned at 95.
    const firstProcessing = ticks.find((t) => t.phase === 'processing')
    expect(firstProcessing).toBeDefined()
    expect(firstProcessing!.progress).toBeLessThan(30)
    expect(onComplete).toHaveBeenCalledWith([
      { stem: 'vocal', path: '/p/v', filename: 'v.wav' },
    ])
  })

  it('climbs the estimate only while processing and completes', async () => {
    const script: ScriptedStatus[] = [
      { message: 'Processing' },
      { message: 'Processing' },
      { message: 'Processing' },
      { status: 'completed' as const, files: [] },
    ]
    scriptStatuses(script)
    const { ticks, onComplete, promise } = runPoll({ estimatedSecs: 10 })
    await vi.advanceTimersByTimeAsync(5_000)
    await promise
    const progressing = ticks.filter((t) => t.phase === 'processing')
    expect(progressing.length).toBeGreaterThanOrEqual(2)
    expect(progressing[1].progress).toBeGreaterThan(progressing[0].progress)
    expect(onComplete).toHaveBeenCalled()
  })

  it('rides out transient network blips within the grace window', async () => {
    const script: ScriptedStatus[] = [
      { message: 'Processing' },
      { reject: true },
      { reject: true },
      { status: 'completed' as const, files: [] },
    ]
    scriptStatuses(script)
    const { onComplete, onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(15_000)
    await promise
    expect(onError).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalled()
  })

  it('gives up after the grace window is exhausted', async () => {
    const script: ScriptedStatus[] = [
      { message: 'Processing' },
      { reject: true },
    ]
    scriptStatuses(script)
    const { onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(120_000)
    await expect(promise).rejects.toThrow()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('surfaces a first-poll failure immediately', async () => {
    scriptStatuses([{ reject: true }])
    const { onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).rejects.toThrow()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('treats a server-reported error as terminal', async () => {
    scriptStatuses([{ status: 'error' as const, error: 'GPU worker crashed' }])
    const { onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).rejects.toBeInstanceOf(TerminalPollError)
    expect(onError).toHaveBeenCalledWith('GPU worker crashed')
  })

  it('treats not_started (server restart) as terminal', async () => {
    scriptStatuses([{ status: 'not_started' as const }])
    const { onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).rejects.toBeInstanceOf(TerminalPollError)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('a completion-handler failure is terminal, not retried', async () => {
    scriptStatuses([{ status: 'completed' as const, files: [] }])
    const ticks: ProgressTick[] = []
    const onError = vi.fn()
    const promise = pollForCompletion(
      'rp_gpu_job1',
      (p, i, ph) => ticks.push({ progress: p, indeterminate: i, phase: ph }),
      () => {
        throw new Error('IndexedDB is full')
      },
      onError,
      1000,
    )
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(100)
    await expect(promise).rejects.toBeInstanceOf(TerminalPollError)
    expect(onError).toHaveBeenCalledWith('IndexedDB is full')
  })

  it('stops at the 30-minute wall clock', async () => {
    scriptStatuses([{ message: 'Processing' }])
    const { onError, promise } = runPoll()
    await vi.advanceTimersByTimeAsync(31 * 60_000)
    await expect(promise).rejects.toThrow(/timed out/i)
    expect(onError).toHaveBeenCalledWith(
      'Processing timed out after 30 minutes',
    )
  })
})
