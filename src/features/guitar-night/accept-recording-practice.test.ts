// Practice admission exercises the real recording store and immutable revisions over IndexedDB.
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createRecordingScore } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore, GuitarRecording, } from '@/lib/guitar/recording-types'
import { acceptRecordingPractice, sameRecordingPractice, } from './accept-recording-practice'

describe('recorded melody practice admission', () => {
  let db: DexieAdapter
  let store: ReturnType<typeof createGuitarRecordingStore>
  let draft: GuitarRecordingDraft
  let corrections: GuitarPracticeScore
  beforeEach(async () => {
    vi.stubGlobal('Blob', NodeBlob)
    db = new DexieAdapter()
    store = createGuitarRecordingStore(db)
    const recording: GuitarRecording = {
      id: 'idea',
      version: 1,
      detectorVersion: 'test',
      title: 'My melody',
      createdAt: '2026-09-08T10:00:00Z',
      updatedAt: '2026-09-08T10:00:00Z',
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
    }
    const notes = [
      {
        id: 'first',
        midi: 64,
        startFrame: 400,
        endFrame: 1800,
        clarity: 0.9,
        onset: 'attack' as const,
      },
      {
        id: 'second',
        midi: 65,
        startFrame: 2200,
        endFrame: 4200,
        clarity: 0.9,
        onset: 'attack' as const,
      },
    ]
    await store.begin(recording)
    await store.checkpoint({
      id: 'idea:0',
      recordingId: 'idea',
      sequence: 0,
      kind: 'audio',
      createdAt: recording.createdAt,
      updatedAt: recording.updatedAt,
      firstFrame: 0,
      frames: 4800,
      pcm: new ArrayBuffer(9600),
      pitches: [],
      attacks: [],
      notes: [],
      peak: 0.2,
    })
    await store.finish(
      'idea',
      { frames: 4800, notes, clockAnomalies: 0, interruption: null },
      480000,
    )
    draft = await store.load('idea')
    corrections = createRecordingScore(
      draft.recording,
      draft.notes,
      DEFAULT_GUITAR_TUNING,
    )
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('keeps a draft with one accepted target and original audio/evidence, then reuses it from the stale draft', async () => {
    const original = structuredClone(corrections)
    const bytes = await draft.blob!.arrayBuffer()
    const first = await acceptRecordingPractice(draft, corrections, store)

    const reused = await acceptRecordingPractice(
      draft,
      { ...corrections, id: 'editor-copy', revision: 8, updatedAt: 'later' },
      store,
    )

    expect(reused).toEqual(first)
    expect(corrections).toEqual(original)
    expect(await store.scores()).toEqual([first])
    const loaded = await store.load('idea')
    expect(loaded.recording.state).toBe('kept')
    expect(loaded.acceptedScore).toEqual(first)
    expect(loaded.editableScore).toEqual(corrections)
    expect(loaded.notes).toEqual(draft.notes)
    expect(await loaded.blob!.arrayBuffer()).toEqual(bytes)
    expect(await db.getRepository('voiceTakes').count()).toBe(1)
    expect(await db.getRepository('voiceTakeAudio').count()).toBe(1)
  })

  it('accepts notes for already-kept audio without creating another Hear Yourself entry', async () => {
    await store.keep(draft)

    const accepted = await acceptRecordingPractice(draft, corrections, store)

    expect(accepted.revision).toBe(1)
    expect((await store.load('idea')).acceptedScore).toEqual(accepted)
    expect(await db.getRepository('voiceTakes').count()).toBe(1)
    expect(await db.getRepository('voiceTakeAudio').count()).toBe(1)
  })

  it('creates a new immutable revision for changed notes without altering prior targets or raw evidence', async () => {
    const first = await acceptRecordingPractice(draft, corrections, store)
    const loaded = await store.load('idea')
    const changed = {
      ...first,
      notes: [{ ...first.notes[0], midi: 66, fret: 2 }, first.notes[1]],
    }

    const second = await acceptRecordingPractice(loaded, changed, store)

    expect(second.id).not.toBe(first.id)
    expect(second.revision).toBe(2)
    expect(second.notes[0].midi).toBe(66)
    expect(await store.score(first.id)).toEqual(first)
    expect((await store.load('idea')).acceptedScore).toEqual(second)
    expect((await store.load('idea')).notes).toEqual(draft.notes)
  })

  it('refuses a stale editor when another tab has accepted different notes', async () => {
    const first = await acceptRecordingPractice(draft, corrections, store)
    const stale = await store.load('idea')
    const second = await acceptRecordingPractice(
      stale,
      { ...first, title: 'Another tab' },
      store,
    )

    await expect(
      acceptRecordingPractice(
        stale,
        { ...first, title: 'Stale overwrite' },
        store,
      ),
    ).rejects.toThrow('another tab')

    expect((await store.load('idea')).acceptedScore).toEqual(second)
    expect(await store.scores()).toHaveLength(2)
  })

  it('admits only one of two concurrent conflicting first revisions', async () => {
    await store.keep(draft)

    const results = await Promise.allSettled([
      acceptRecordingPractice(draft, corrections, store),
      acceptRecordingPractice(
        draft,
        { ...corrections, title: 'Other tab' },
        store,
      ),
    ])

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    expect(await store.scores()).toHaveLength(1)
    expect(await db.getRepository('voiceTakes').count()).toBe(1)
  })

  it.each(['empty', 'unplayable', 'overlap', 'other recording'] as const)(
    'does not keep audio or silently remove notes for %s targets',
    async (problem) => {
      const invalid = structuredClone(corrections)
      if (problem === 'empty') invalid.notes = []
      if (problem === 'unplayable') invalid.notes[0].string = null
      if (problem === 'overlap')
        invalid.notes[1].startBeat = invalid.notes[0].startBeat
      if (problem === 'other recording') invalid.recordingId = 'other'
      const original = structuredClone(invalid)

      await expect(
        acceptRecordingPractice(draft, invalid, store),
      ).rejects.toThrow()

      expect(invalid).toEqual(original)
      expect(await store.scores()).toEqual([])
      expect((await store.load('idea')).recording.state).toBe('draft')
      expect((await store.load('idea')).notes).toEqual(draft.notes)
      expect(await db.readAllStrict('voiceTakes')).toEqual([])
      expect(await db.readAllStrict('voiceTakeAudio')).toEqual([])
    },
  )

  it('treats accepted sorting and property order as unchanged musical content', async () => {
    const reordered = {
      ...corrections,
      notes: [...corrections.notes].reverse().map((note) => ({
        fret: note.fret,
        string: note.string,
        endBeat: note.endBeat,
        startBeat: note.startBeat,
        midi: note.midi,
        evidenceId: note.evidenceId,
        id: note.id,
      })),
    }
    const first = await acceptRecordingPractice(draft, reordered, store)

    const second = await acceptRecordingPractice(draft, corrections, store)

    expect(second.id).toBe(first.id)
    expect(sameRecordingPractice(first, reordered)).toBe(true)
    expect(await store.scores()).toHaveLength(1)
  })
})
