// ============================================================
// runStemSplit — the client flow that splits an instrumental
// ============================================================
// Locks the contract: only requested part stems are saved (with
// provenance), the near-silent vocal the server may return is ignored,
// failures surface as StemSplitError, and the server-side session is
// cleaned up once stems are safely in IndexedDB.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutputFile } from '@/lib/uvr-api'

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

import { runStemSplit, SPLIT_PART_STEMS, StemSplitError, } from '@/lib/uvr-stem-split'

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
        serverFiles(['drums', 'bass', 'guitar', 'other', 'vocal']),
      )
    },
  )
})

describe('runStemSplit', () => {
  it('saves exactly the requested parts, with provenance', async () => {
    const result = await runStemSplit('session-1')

    expect(result.saved.sort()).toEqual(['bass', 'drums', 'guitar', 'other'])
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
    expect(request.drop_stems).toEqual(['vocal', 'piano'])
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
})
