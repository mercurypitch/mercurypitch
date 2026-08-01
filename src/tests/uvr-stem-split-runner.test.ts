// ============================================================
// runStemSplit — the client flow that splits an instrumental
// ============================================================
// Locks the contract: only requested part stems are saved (with
// provenance), the near-silent vocal the server may return is ignored,
// failures surface as StemSplitError, and the server-side session is
// cleaned up once stems are safely in IndexedDB.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutputFile } from '@/lib/uvr-api'
import { KEEP_POLLING, TerminalPollError } from '@/lib/uvr-api'

const api = vi.hoisted(() => ({
  processAudio: vi.fn(),
  pollForCompletion: vi.fn(),
  getOutputFile: vi.fn(),
  deleteSession: vi.fn(),
}))
const db = vi.hoisted(() => ({
  getStemBlob: vi.fn(),
  saveStemBlobDurable: vi.fn(),
  deleteStemBlobs: vi.fn(),
}))

vi.mock('@/lib/uvr-api', async (importOriginal) => ({
  // Keep buildStemSplitRequest / splitStemsFor real — the point is that
  // runStemSplit obeys the real request contract.
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}))
vi.mock('@/db/services/uvr-service', () => db)

import { decideSplitParts, EMPTY_SPLIT_LISTING_PATIENCE_MS, runStemSplit, SPLIT_PART_STEMS, StemSplitError, } from '@/lib/uvr-stem-split'

const serverFiles = (stems: string[]): OutputFile[] =>
  stems.map((stem) => ({
    stem,
    filename: `input_(${stem})_htdemucs_6s.wav`,
    path: `/api/uvr/output/srv-1/input_(${stem})_htdemucs_6s.wav`,
  }))

beforeEach(() => {
  vi.clearAllMocks()
  db.getStemBlob.mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' }))
  db.saveStemBlobDurable.mockResolvedValue({ ok: true, value: 'blob-id' })
  db.deleteStemBlobs.mockResolvedValue(undefined)
  api.processAudio.mockResolvedValue({ session_id: 'srv-1' })
  api.getOutputFile.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['stem'], { type: 'audio/wav' })),
  })
  api.deleteSession.mockResolvedValue({ status: 'success', message: '' })
  api.pollForCompletion.mockImplementation(
    async (
      _sid: string,
      onProgress: (pct: number) => void,
      onComplete: (files: OutputFile[]) => void | Promise<void>,
    ) => {
      onProgress(50)
      await onComplete(
        serverFiles(['drums', 'bass', 'guitar', 'piano', 'other', 'vocal']),
      )
    },
  )
})

describe('runStemSplit', () => {
  it('saves exactly the requested parts, with provenance', async () => {
    const result = await runStemSplit('session-1')

    expect(result.saved.sort()).toEqual([
      'bass',
      'drums',
      'guitar',
      'other',
      'piano',
    ])
    expect(result.model).toBe('demucs-6s')
    // The stray vocal the server returned is never persisted.
    const savedTypes = db.saveStemBlobDurable.mock.calls.map((c) => c[1])
    expect(savedTypes).not.toContain('vocal')
    for (const call of db.saveStemBlobDurable.mock.calls) {
      expect(call[0]).toBe('session-1')
      expect(call[4]).toEqual({
        derivedFrom: 'instrumental',
        producedBy: 'demucs-6s',
      })
    }
  })

  it('replaces prior parts and cleans up the server session', async () => {
    await runStemSplit('session-1')
    // A re-run must not accumulate blob rows.
    expect(db.deleteStemBlobs).toHaveBeenCalledTimes(SPLIT_PART_STEMS.length)
    expect(api.deleteSession).toHaveBeenCalledWith('srv-1')
  })

  it('sends the instrumental as the source stem', async () => {
    await runStemSplit('session-1')
    const [file, request] = api.processAudio.mock.calls[0]
    expect((file as File).name).toBe('instrumental.wav')
    expect(request.source_stem).toBe('instrumental')
    expect(request.reconcile_residual).toBe(true)
    expect(request.drop_stems).toEqual(['vocal'])
    // Splits are server jobs — without a tier the worker rejects with 400.
    expect(request.provider).toBe('runpod')
  })

  it('never reports progress moving backwards within a phase', async () => {
    // Server status snapshots race at job start (queued vs processing) and
    // the raw pct sequence can flap 0,1,0,1,2 — the clamp keeps the UI
    // monotonic.
    api.pollForCompletion.mockImplementation(
      async (
        _sid: string,
        onProgress: (pct: number) => void,
        onComplete: (files: OutputFile[]) => void | Promise<void>,
      ) => {
        for (const pct of [0, 1, 0, 1, 2]) onProgress(pct)
        await onComplete(serverFiles(['drums', 'bass', 'guitar', 'other']))
      },
    )
    const seen: { phase: string; pct: number }[] = []
    await runStemSplit('session-1', { onProgress: (p) => seen.push(p) })
    const processing = seen
      .filter((p) => p.phase === 'processing')
      .map((p) => p.pct)
    for (let i = 1; i < processing.length; i++) {
      expect(processing[i]).toBeGreaterThanOrEqual(processing[i - 1])
    }
    expect(processing.at(-1)).toBe(2)
  })

  it('reports progress phases in order', async () => {
    const phases: string[] = []
    await runStemSplit('session-1', {
      onProgress: (p) => {
        if (phases.at(-1) !== p.phase) phases.push(p.phase)
      },
    })
    expect(phases).toEqual(['uploading', 'processing', 'saving'])
  })

  it('splits in place via the server-held R2 stem when a session is reusable', async () => {
    await runStemSplit('session-1', {
      reuseApiSessionId: 'rp_gpu_prev-job',
      durationSeconds: 1080,
    })
    // No blob leaves the browser: the stored instrumental is never read.
    expect(db.getStemBlob).not.toHaveBeenCalled()
    const [file, request] = api.processAudio.mock.calls[0]
    expect(file).toBeNull()
    expect(request.reuse_session).toBe('rp_gpu_prev-job')
    expect(request.duration_seconds).toBe(1080)
  })

  it('falls back to uploading the stored blob when the R2 stem expired', async () => {
    const expired = Object.assign(new Error('stem expired'), { status: 410 })
    api.processAudio
      .mockRejectedValueOnce(expired)
      .mockResolvedValueOnce({ session_id: 'srv-2' })
    const result = await runStemSplit('session-1', {
      reuseApiSessionId: 'rp_gpu_prev-job',
    })
    expect(result.saved.length).toBeGreaterThan(0)
    expect(api.processAudio).toHaveBeenCalledTimes(2)
    // Second attempt is the classic upload of the stored instrumental.
    const [file] = api.processAudio.mock.calls[1]
    expect((file as File).name).toBe('instrumental.wav')
    expect(db.getStemBlob).toHaveBeenCalledWith('session-1', 'instrumental')
  })

  it('surfaces a non-expiry reuse failure instead of silently re-uploading', async () => {
    const denied = Object.assign(new Error('Not enough credits'), {
      status: 402,
    })
    api.processAudio.mockRejectedValueOnce(denied)
    await expect(
      runStemSplit('session-1', { reuseApiSessionId: 'rp_gpu_prev-job' }),
    ).rejects.toThrow(/Not enough credits/)
    expect(api.processAudio).toHaveBeenCalledTimes(1)
  })

  it('throws a readable error when no instrumental is stored', async () => {
    db.getStemBlob.mockResolvedValue(null)
    await expect(runStemSplit('session-1')).rejects.toThrow(StemSplitError)
    expect(api.processAudio).not.toHaveBeenCalled()
  })

  it('surfaces a failed save as StemSplitError', async () => {
    db.saveStemBlobDurable.mockResolvedValue({ ok: false })
    await expect(runStemSplit('session-1')).rejects.toThrow(
      /Saving the .* stem failed/,
    )
  })

  it('wraps poll failures with the split context', async () => {
    api.pollForCompletion.mockRejectedValue(new Error('GPU exploded'))
    await expect(runStemSplit('session-1')).rejects.toThrow(
      /Splitting the instrumental failed: GPU exploded/,
    )
  })

  it('marks a network-style poll death recoverable — the job may be fine', async () => {
    api.pollForCompletion.mockRejectedValue(new TypeError('fetch failed'))
    const err = await runStemSplit('session-1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StemSplitError)
    expect((err as StemSplitError).recoverable).toBe(true)
  })

  it('marks a server verdict non-recoverable — the job is dead and refunded', async () => {
    api.pollForCompletion.mockRejectedValue(
      new TerminalPollError('executionTimeout exceeded'),
    )
    const err = await runStemSplit('session-1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StemSplitError)
    expect((err as StemSplitError).recoverable).toBe(false)
  })

  it('marks a failed part save recoverable — the stems still live server-side', async () => {
    db.saveStemBlobDurable.mockResolvedValue({ ok: false })
    const err = await runStemSplit('session-1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StemSplitError)
    expect((err as StemSplitError).recoverable).toBe(true)
  })

  // ── Part-less / partial "completed" listings ───────────────────
  // The worker's R2 recovery fallback synthesizes 'completed' from
  // whatever stem files have landed in the bucket, so a listing without
  // (all of) the parts can just mean "still uploading".

  it('treats a part-less completed listing as still-processing, then saves', async () => {
    const verdicts: unknown[] = []
    api.pollForCompletion.mockImplementation(
      async (
        _sid: string,
        _onProgress: (pct: number) => void,
        onComplete: (files: OutputFile[]) => Promise<unknown>,
      ) => {
        // Mid-upload snapshots: only non-part stems, then nothing at all.
        verdicts.push(await onComplete(serverFiles(['instrumental'])))
        verdicts.push(await onComplete([]))
        await onComplete(
          serverFiles(['drums', 'bass', 'guitar', 'piano', 'other']),
        )
      },
    )
    const result = await runStemSplit('session-1')
    expect(verdicts).toEqual([KEEP_POLLING, KEEP_POLLING])
    expect(result.saved.sort()).toEqual([
      'bass',
      'drums',
      'guitar',
      'other',
      'piano',
    ])
  })

  it('accepts a partial part set instead of failing all-or-nothing', async () => {
    api.pollForCompletion.mockImplementation(
      async (
        _sid: string,
        _onProgress: (pct: number) => void,
        onComplete: (files: OutputFile[]) => Promise<unknown>,
      ) => {
        // Piano missing (plus the stray vocal the server may return).
        await onComplete(
          serverFiles(['drums', 'bass', 'guitar', 'other', 'vocal']),
        )
      },
    )
    const result = await runStemSplit('session-1')
    expect(result.saved.sort()).toEqual(['bass', 'drums', 'guitar', 'other'])
  })

  it('gives up recoverably once part-less completions outlast the patience window', async () => {
    vi.useFakeTimers()
    try {
      api.pollForCompletion.mockImplementation(
        async (
          _sid: string,
          _onProgress: (pct: number) => void,
          onComplete: (files: OutputFile[]) => Promise<unknown>,
        ) => {
          expect(await onComplete(serverFiles(['instrumental']))).toBe(
            KEEP_POLLING,
          )
          vi.setSystemTime(Date.now() + EMPTY_SPLIT_LISTING_PATIENCE_MS + 1000)
          await onComplete(serverFiles(['instrumental']))
        },
      )
      const err = await runStemSplit('session-1').catch((e: unknown) => e)
      expect(err).toBeInstanceOf(StemSplitError)
      // Retryable: the job is done but re-splitting is perfectly viable.
      expect((err as StemSplitError).recoverable).toBe(true)
      // The message names what the server DID return.
      expect((err as StemSplitError).message).toContain('instrumental')
      expect(db.saveStemBlobDurable).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarts the patience window when the job reports itself alive again', async () => {
    vi.useFakeTimers()
    try {
      api.pollForCompletion.mockImplementation(
        async (
          _sid: string,
          onProgress: (pct: number) => void,
          onComplete: (files: OutputFile[]) => Promise<unknown>,
        ) => {
          expect(await onComplete(serverFiles(['instrumental']))).toBe(
            KEEP_POLLING,
          )
          // RunPod answers IN_PROGRESS again — the empty streak resets.
          onProgress(60)
          vi.setSystemTime(Date.now() + EMPTY_SPLIT_LISTING_PATIENCE_MS + 1000)
          expect(await onComplete(serverFiles(['instrumental']))).toBe(
            KEEP_POLLING,
          )
          await onComplete(
            serverFiles(['drums', 'bass', 'guitar', 'piano', 'other']),
          )
        },
      )
      const result = await runStemSplit('session-1')
      expect(result.saved).toContain('drums')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── decideSplitParts (pure) ──────────────────────────────────────
// The three-way call on a 'completed' listing: save what matches, wait
// while a part-less listing may still be an upload in progress, give up
// (recoverably) once it has outstayed the patience window.

describe('decideSplitParts', () => {
  const WANTED = ['drums', 'bass', 'guitar', 'piano', 'other'] as const

  it('saves every matching part and closes the empty streak', () => {
    const { decision, emptySince } = decideSplitParts({
      files: serverFiles(['drums', 'bass', 'guitar', 'piano', 'other']),
      wanted: WANTED,
      emptySince: 1_000,
      now: 5_000,
    })
    expect(decision.action).toBe('save')
    if (decision.action === 'save') {
      expect(decision.parts.map((p) => p.stem).sort()).toEqual([
        'bass',
        'drums',
        'guitar',
        'other',
        'piano',
      ])
    }
    expect(emptySince).toBeNull()
  })

  it('saves a subset — and never the stray non-part stems', () => {
    const { decision } = decideSplitParts({
      files: serverFiles(['drums', 'vocal', 'instrumental']),
      wanted: WANTED,
      emptySince: null,
      now: 0,
    })
    expect(decision.action).toBe('save')
    if (decision.action === 'save') {
      expect(decision.parts.map((p) => p.stem)).toEqual(['drums'])
    }
  })

  it('waits on the first part-less listing and opens the streak', () => {
    const { decision, emptySince } = decideSplitParts({
      files: serverFiles(['instrumental']),
      wanted: WANTED,
      emptySince: null,
      now: 10_000,
    })
    expect(decision).toEqual({ action: 'wait' })
    expect(emptySince).toBe(10_000)
  })

  it('keeps the original streak start while waiting', () => {
    const { decision, emptySince } = decideSplitParts({
      files: [],
      wanted: WANTED,
      emptySince: 10_000,
      now: 10_000 + EMPTY_SPLIT_LISTING_PATIENCE_MS - 1,
    })
    expect(decision).toEqual({ action: 'wait' })
    expect(emptySince).toBe(10_000)
  })

  it('gives up after the patience window, naming what WAS returned', () => {
    const { decision, emptySince } = decideSplitParts({
      files: serverFiles(['vocal', 'instrumental', 'instrumental']),
      wanted: WANTED,
      emptySince: 10_000,
      now: 10_000 + EMPTY_SPLIT_LISTING_PATIENCE_MS,
    })
    expect(decision).toEqual({
      action: 'give-up',
      returned: ['vocal', 'instrumental'],
    })
    expect(emptySince).toBeNull()
  })

  it('gives up on a persistently empty listing with nothing to name', () => {
    const { decision } = decideSplitParts({
      files: [],
      wanted: WANTED,
      emptySince: 0,
      now: EMPTY_SPLIT_LISTING_PATIENCE_MS,
    })
    expect(decision).toEqual({ action: 'give-up', returned: [] })
  })

  it('honours a caller-supplied patience for tests and tuning', () => {
    const { decision } = decideSplitParts({
      files: [],
      wanted: WANTED,
      emptySince: 0,
      now: 50,
      patienceMs: 50,
    })
    expect(decision.action).toBe('give-up')
  })
})
