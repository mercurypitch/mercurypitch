// Refinement acceptance uses real IndexedDB transactions, immutable targets and reloadable undo.
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { acceptRecordingScoreRevision, createRecordingScore, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore, GuitarRecording, GuitarRecordingChunk, } from '@/lib/guitar/recording-types'
import type { ApplyGuitarRefinement } from './guitar-recording-refinement'
import { createGuitarRecordingStore } from './guitar-recording-service'

describe('explicit guitar recording refinement', () => {
  let db: DexieAdapter
  let store: ReturnType<typeof createGuitarRecordingStore>
  const recording = (): GuitarRecording => ({
    id: 'refinement-source',
    version: 1,
    detectorVersion: 'original-detector',
    title: 'Original idea',
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    state: 'capturing',
    sampleRate: 48000,
    inputChannel: 0,
    inputKind: 'interface',
    frames: 0,
    chunks: 0,
    audioStartFrame: null,
    clockAnomalies: 0,
    interruption: null,
    amp: null,
    backing: null,
    takeId: null,
    scoreId: null,
  })
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    db = new DexieAdapter()
    store = createGuitarRecordingStore(db)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await db.destroy()
    vi.unstubAllGlobals()
  })
  const prepare = async (): Promise<ApplyGuitarRefinement> => {
    const row = recording()
    const evidence = {
      id: 'original-note',
      midi: 64,
      startFrame: 0,
      endFrame: 8192,
      clarity: 0.88,
      onset: 'attack' as const,
    }
    await store.begin(row)
    await store.checkpoint({
      id: `${row.id}:0`,
      recordingId: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      kind: 'audio',
      sequence: 0,
      firstFrame: 0,
      frames: 8192,
      pcm: new Int16Array(8192).fill(1234).buffer,
      pitches: [{ frame: 512, midi: 64, clarity: 0.88 }],
      attacks: [0],
      notes: [evidence],
      peak: 0.1,
    })
    await store.finish(
      row.id,
      {
        frames: 8192,
        notes: [evidence],
        clockAnomalies: 0,
        interruption: null,
      },
      1024,
    )
    const previousScore = createRecordingScore(
      row,
      [evidence],
      DEFAULT_GUITAR_TUNING,
    )
    const candidate: GuitarPracticeScore = {
      ...previousScore,
      notes: [
        { ...previousScore.notes[0], id: 'refined-e', evidenceId: 'refined-e' },
        {
          ...previousScore.notes[0],
          id: 'refined-c',
          evidenceId: 'refined-c',
          midi: 60,
          string: 2,
          fret: 1,
        },
      ],
      attachment: null,
      refinement: {
        version: 1,
        model: 'basic-pitch',
        modelSha256:
          '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec',
        decoderVersion: 'mp-basic-pitch-hysteresis/1',
        createdAt: '2026-09-08T10:01:00.000Z',
        source: 'recorded-audio',
        confidenceByNoteId: { 'refined-e': 0.91, 'refined-c': 0.72 },
      },
    }
    return {
      candidate,
      previousScore,
      expectedEditableScore: null,
      expectedAcceptedScoreId: null,
      expectedFrames: 8192,
    }
  }
  const reload = () => {
    db.close()
    db = new DexieAdapter()
    store = createGuitarRecordingStore(db)
  }
  const ending = () =>
    db.readByIdStrict<GuitarRecordingChunk>(
      'guitarRecordingChunks',
      'refinement-source:ending',
    )

  it('requires explicit Apply and preserves source audio/evidence and unsaved prior notes across reload and undo', async () => {
    const request = await prepare()
    request.previousScore.title = 'An unsaved name'
    const original = await store.load('refinement-source')
    const originalAudio = await original.blob!.arrayBuffer()
    expect(original.editableScore).toBeUndefined()
    expect(original.refinementBackup).toBeUndefined()
    expect(await store.scores()).toEqual([])

    expect(await store.applyRefinement(request)).toEqual(request.candidate)
    reload()
    const applied = await store.load('refinement-source')
    expect(applied.editableScore).toEqual(request.candidate)
    expect(applied.refinementBackup).toMatchObject({
      version: 1,
      previousScore: request.previousScore,
      appliedScore: request.candidate,
      acceptedScoreId: null,
      frames: 8192,
    })
    expect(applied.notes).toEqual(original.notes)
    expect(await applied.blob!.arrayBuffer()).toEqual(originalAudio)
    expect(applied.recording.detectorVersion).toBe('original-detector')
    expect(applied.recording.scoreId).toBeNull()
    expect(applied.acceptedScore).toBeUndefined()
    expect(await store.scores()).toEqual([])
    expect(await store.restoreRefinement(applied.editableScore!)).toEqual(
      request.previousScore,
    )
    reload()
    const restored = await store.load('refinement-source')
    expect(restored.editableScore).toEqual(request.previousScore)
    expect(restored.refinementBackup).toBeUndefined()
    expect(restored.notes).toEqual(original.notes)
    expect(await restored.blob!.arrayBuffer()).toEqual(originalAudio)
    await expect(
      store.restoreRefinement(request.previousScore),
    ).rejects.toThrow('no previous refinement')
  })

  it('keeps an existing accepted target immutable while refining and restoring a kept recording', async () => {
    const request = await prepare()
    const accepted = acceptRecordingScoreRevision(request.previousScore, 1)
    await store.keep(await store.load('refinement-source'), accepted, accepted)
    const original = await store.load('refinement-source')
    await store.applyRefinement({
      ...request,
      previousScore: accepted,
      expectedEditableScore: accepted,
      expectedAcceptedScoreId: accepted.id,
    })
    reload()
    expect(await store.score(accepted.id)).toEqual(accepted)
    expect((await store.load('refinement-source')).acceptedScore).toEqual(
      accepted,
    )
    expect(await store.restoreRefinement(request.candidate)).toEqual(accepted)
    expect((await store.load('refinement-source')).recording.scoreId).toBe(
      accepted.id,
    )
    expect(
      await (await store.load('refinement-source')).blob!.arrayBuffer(),
    ).toEqual(await original.blob!.arrayBuffer())
    expect(await store.scores()).toEqual([accepted])
  })

  it('preserves undo through audio-only Keep and unchanged correction saves', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    await store.keep(
      await store.load('refinement-source'),
      undefined,
      request.candidate,
    )
    await store.saveCorrections(request.candidate)
    reload()
    expect(
      (await store.load('refinement-source')).refinementBackup?.previousScore,
    ).toEqual(request.previousScore)
    expect(await store.restoreRefinement(request.candidate)).toEqual(
      request.previousScore,
    )
    expect((await store.read('refinement-source')).state).toBe('kept')
  })

  it('refreshes refinement state without fetching PCM or Hear Yourself audio', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    const reads = vi.spyOn(db, 'readByIdStrict')
    const chunkReads = vi.spyOn(db, 'readByIndexStrict')
    const state = await store.readRefinementState('refinement-source')
    expect(state.editableScore).toEqual(request.candidate)
    expect(state.refinementBackup?.previousScore).toEqual(request.previousScore)
    expect(reads.mock.calls.map((call) => call[0])).toEqual([
      'guitarRecordings',
      'guitarRecordingChunks',
    ])
    expect(chunkReads).not.toHaveBeenCalled()
  })

  it('distinguishes an older accepted-only take from a persisted editable draft', async () => {
    const request = await prepare()
    const accepted = acceptRecordingScoreRevision(request.previousScore, 1)
    await store.keep(await store.load('refinement-source'), accepted)
    const state = await store.readRefinementState('refinement-source')
    expect(state.editableScore).toBeNull()
    expect(state.acceptedScoreId).toBe(accepted.id)
    expect(state.acceptedScore).toEqual(accepted)
    await store.applyRefinement({
      ...request,
      previousScore: accepted,
      expectedAcceptedScoreId: accepted.id,
    })
    expect(
      (await store.readRefinementState('refinement-source')).acceptedScore,
    ).toBeUndefined()
  })

  it('stores unresolved fingering for review without silently publishing a practice revision', async () => {
    const request = await prepare()
    request.candidate.notes[1] = {
      ...request.candidate.notes[1],
      string: null,
      fret: null,
    }
    await store.applyRefinement(request)
    expect(
      (await store.load('refinement-source')).editableScore?.notes[1].string,
    ).toBeNull()
    expect(await store.scores()).toEqual([])
  })

  it('can restore an empty prior editable melody when refinement found the first usable notes', async () => {
    const request = await prepare()
    request.previousScore = { ...request.previousScore, notes: [] }
    await store.applyRefinement(request)
    reload()
    expect(await store.restoreRefinement(request.candidate)).toEqual(
      request.previousScore,
    )
    expect(
      (await store.load('refinement-source')).editableScore?.notes,
    ).toEqual([])
  })

  it('snapshots caller intent before awaiting the database', async () => {
    const request = await prepare()
    const expected = structuredClone(request)
    const applied = store.applyRefinement(request)
    request.candidate.notes[0].midi = 65
    request.previousScore.title = 'Changed after clicking Apply'
    expect(await applied).toEqual(expected.candidate)
    expect((await ending())?.refinementBackup?.previousScore).toEqual(
      expected.previousScore,
    )
  })

  it('rejects two concurrent Apply intents after exactly one wins the real transaction', async () => {
    const request = await prepare()
    const secondDb = new DexieAdapter()
    try {
      const second = createGuitarRecordingStore(secondDb)
      const results = await Promise.allSettled([
        store.applyRefinement(request),
        second.applyRefinement({
          ...request,
          candidate: { ...request.candidate, title: 'Other tab' },
        }),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      const failure = results.find((result) => result.status === 'rejected')
      expect(
        failure?.status === 'rejected' && failure.reason.message,
      ).toContain('another tab')
      expect((await ending())?.refinementBackup?.previousScore).toEqual(
        request.previousScore,
      )
    } finally {
      secondDb.close()
    }
  })

  it('rejects applying over a concurrent correction instead of treating the analysis snapshot as current', async () => {
    const request = await prepare()
    const concurrent = {
      ...request.previousScore,
      title: 'Corrected elsewhere',
    }
    await store.saveCorrections(concurrent)
    await expect(store.applyRefinement(request)).rejects.toThrow('another tab')
    expect((await ending())?.editableScore).toEqual(concurrent)
    expect((await ending())?.refinementBackup).toBeUndefined()
  })

  it('rejects stale accepted-target and frame snapshots', async () => {
    const request = await prepare()
    await expect(
      store.applyRefinement({ ...request, expectedFrames: 4096 }),
    ).rejects.toThrow('another tab')
    const accepted = acceptRecordingScoreRevision(request.previousScore, 1)
    await store.keep(await store.load('refinement-source'), accepted)
    await expect(store.applyRefinement(request)).rejects.toThrow('another tab')
    expect(await store.score(accepted.id)).toEqual(accepted)
    expect((await ending())?.refinementBackup).toBeUndefined()
  })

  it('does not restore over manual edits even when the caller supplies the new edited score', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    const manual = { ...request.candidate, title: 'Edited after refinement' }
    await store.saveCorrections(manual)
    await expect(store.restoreRefinement(request.candidate)).rejects.toThrow(
      'another tab',
    )
    await expect(store.restoreRefinement(manual)).rejects.toThrow('another tab')
    expect((await ending())?.editableScore).toEqual(manual)
  })

  it('cannot use undo to overwrite a newly accepted practice revision', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    await store.keep(await store.load('refinement-source'))
    const accepted = acceptRecordingScoreRevision(request.candidate, 1)
    await store.accept(accepted)
    await expect(store.restoreRefinement(accepted)).rejects.toThrow(
      'another tab',
    )
    expect(await store.score(accepted.id)).toEqual(accepted)
    expect((await ending())?.editableScore).toEqual(accepted)
  })

  it('replaces the one-step backup without recursively accumulating earlier snapshots', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    const next = { ...request.candidate, title: 'Second refinement' }
    await store.applyRefinement({
      ...request,
      candidate: next,
      previousScore: request.candidate,
      expectedEditableScore: request.candidate,
    })
    const backup = (await ending())?.refinementBackup
    expect(backup?.previousScore).toEqual(request.candidate)
    expect(backup?.previousScore).not.toHaveProperty('refinementBackup')
    await expect(store.restoreRefinement(request.candidate)).rejects.toThrow(
      'another tab',
    )
    expect(await store.restoreRefinement(next)).toEqual(request.candidate)
    expect((await ending())?.refinementBackup).toBeUndefined()
  })

  it.each([
    'capturing',
    'removed',
    'missing-chunk',
    'missing-kept-audio',
  ] as const)(
    'rejects a %s source without recreating or changing its evidence',
    async (state) => {
      const request = await prepare()
      if (state === 'capturing')
        await db.putStrict('guitarRecordings', {
          ...(await store.read('refinement-source')),
          state: 'capturing',
        })
      if (state === 'removed') await store.remove('refinement-source')
      if (state === 'missing-chunk')
        await db.deleteByIdStrict(
          'guitarRecordingChunks',
          'refinement-source:0',
        )
      if (state === 'missing-kept-audio') {
        await store.keep(await store.load('refinement-source'))
        await db.deleteByIdStrict(
          'voiceTakeAudio',
          'guitar-audio:refinement-source',
        )
      }
      await expect(store.applyRefinement(request)).rejects.toThrow(
        /Stop recording|no longer|missing|incomplete/,
      )
      expect((await ending())?.refinementBackup).toBeUndefined()
      expect(await store.scores()).toEqual([])
    },
  )

  it('rejects undo after source audio was removed', async () => {
    const request = await prepare()
    await store.applyRefinement(request)
    await store.keep(await store.load('refinement-source'))
    await db.deleteByIdStrict(
      'voiceTakeAudio',
      'guitar-audio:refinement-source',
    )
    await expect(store.restoreRefinement(request.candidate)).rejects.toThrow(
      'source recording audio',
    )
    expect((await ending())?.editableScore).toEqual(request.candidate)
  })

  it.each(['apply', 'restore'] as const)(
    'atomically rolls back %s if the catalogue write fails',
    async (action) => {
      const request = await prepare()
      if (action === 'restore') await store.applyRefinement(request)
      const before = await ending()
      const originalPut = db.putStrict.bind(db)
      const write = vi
        .spyOn(db, 'putStrict')
        .mockImplementationOnce(originalPut)
        .mockRejectedValueOnce(new Error('Device write failed'))
      await expect(
        action === 'apply'
          ? store.applyRefinement(request)
          : store.restoreRefinement(request.candidate),
      ).rejects.toThrow('Device write failed')
      write.mockRestore()
      expect(await ending()).toEqual(before)
      expect(await store.scores()).toEqual([])
    },
  )

  it.each(['missing', 'bad-hash', 'bad-confidence', 'wrong-note-id'] as const)(
    'rejects %s model provenance',
    async (kind) => {
      const request = await prepare()
      if (kind === 'missing') delete request.candidate.refinement
      if (kind === 'bad-hash')
        request.candidate.refinement!.modelSha256 = 'unknown'
      if (kind === 'bad-confidence')
        request.candidate.refinement!.confidenceByNoteId['refined-e'] = NaN
      if (kind === 'wrong-note-id')
        request.candidate.refinement!.confidenceByNoteId = { unrelated: 0.8 }
      await expect(store.applyRefinement(request)).rejects.toThrow(
        /provenance|confidence/,
      )
      expect((await ending())?.editableScore).toBeUndefined()
      expect((await ending())?.refinementBackup).toBeUndefined()
    },
  )
})
