// Guitar recording persistence tests exercise real local transactions and reloadable audio.
import { Dexie } from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createGuitarRecordingAnalysis } from '@/lib/guitar/recording-analysis'
import { acceptRecordingScoreRevision, createRecordingScore, } from '@/lib/guitar/recording-score'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { DexieAdapter } from '../adapters/dexie-adapter'
import { CLOUD_ENTITIES } from '../adapters/hybrid-adapter'
import type { VoiceTakeAudioRecord, VoiceTakeRecord } from '../entities'
import { createGuitarRecordingStore } from './guitar-recording-service'
import { createGuitarScoreAttachmentStore } from './guitar-score-attachment-service'
import { deleteVoiceTake, deleteVoiceThread, wipeVoiceTakes, } from './voice-take-service'

const database = vi.hoisted(() => ({ getDb: vi.fn() }))
vi.mock('@/db', () => ({
  getDb: database.getDb,
  ensurePersistentStorage: vi.fn(),
}))

describe('local guitar recordings', () => {
  let db: DexieAdapter
  let store: ReturnType<typeof createGuitarRecordingStore>
  const row = (id = 'idea'): GuitarRecording => ({
    id,
    version: 1,
    detectorVersion: 'test',
    title: 'My melody',
    createdAt: '2026-09-07T10:00:00.000Z',
    updatedAt: '2026-09-07T10:00:00.000Z',
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
    database.getDb.mockResolvedValue(db)
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })
  const capture = async (): Promise<void> => {
    await store.begin(row())
    const analysis = createGuitarRecordingAnalysis('idea', 48000)
    const pcm = new Float32Array(8192).fill(0.25)
    await store.checkpoint(analysis.process(pcm, pcm.length, 0, 0))
    await store.finish(
      'idea',
      { ...analysis.finish(), clockAnomalies: 0, interruption: null },
      54321,
    )
  }
  it('reloads exactly the recorded duration and dry audio without any song or grade', async () => {
    await capture()
    db.close()
    db = new DexieAdapter()
    store = createGuitarRecordingStore(db)
    const draft = await store.load('idea')
    expect(draft.recording.frames).toBe(8192)
    expect(draft.blob?.size).toBe(44 + 8192 * 2)
    expect(draft.notes).toEqual([])
    expect(draft.recording.audioStartFrame).toBe(54321)
    expect(await db.readAllStrict('voiceTakes')).toEqual([])
  })
  it('atomically keeps once, reuses Hear Yourself and removes only staged PCM', async () => {
    await capture()
    const draft = await store.load('idea')
    const [first, second] = await Promise.all([
      store.keep(draft),
      store.keep(draft),
    ])
    expect(first.id).toBe(second.id)
    expect(first.source).toBe('guitar-night')
    expect(JSON.parse(first.contextJson)).toMatchObject({
      kind: 'guitar-recording',
      recordingLabel: 'Dry input',
    })
    expect(await db.getRepository<VoiceTakeRecord>('voiceTakes').count()).toBe(
      1,
    )
    const audio = await db.readAllStrict<VoiceTakeAudioRecord>('voiceTakeAudio')
    expect(audio).toHaveLength(1)
    expect(new DataView(audio[0].data).getInt16(44, true)).toBe(8192)
    const kept = await store.load('idea')
    expect(kept.blob?.size).toBe(draft.blob?.size)
    expect(kept.recording.state).toBe('kept')
    expect(await db.readAllStrict('voiceTakeContours')).toEqual([])
  })
  it('rolls back all Keep writes on a uniqueness failure and leaves the draft retryable', async () => {
    await capture()
    await db.addStrict<VoiceTakeAudioRecord>('voiceTakeAudio', {
      id: 'occupied',
      createdAt: '',
      updatedAt: '',
      takeId: 'guitar-take:idea',
      mimeType: 'audio/wav',
      size: 1,
      data: new ArrayBuffer(1),
    })
    const draft = await store.load('idea')
    await expect(store.keep(draft)).rejects.toThrow()
    expect(await db.readAllStrict('voiceTakes')).toEqual([])
    expect((await store.load('idea')).recording.state).toBe('draft')
    expect((await store.load('idea')).blob?.size).toBe(16428)
    await db.deleteByIdStrict('voiceTakeAudio', 'occupied')
    expect((await store.keep(draft)).id).toBe('guitar-take:idea')
  })
  it('preserves checkpointed audio after interruption and rejects noncontiguous chunks', async () => {
    await store.begin(row())
    const analysis = createGuitarRecordingAnalysis('idea', 48000)
    const chunk = analysis.process(new Float32Array(8192), 8192, 0, 0)
    await store.checkpoint(chunk)
    await store.checkpoint(chunk)
    expect((await store.read('idea')).frames).toBe(8192)
    await expect(
      store.checkpoint({ ...chunk, id: 'idea:3', sequence: 3 }),
    ).rejects.toThrow('out of order')
    expect((await store.load('idea')).blob?.size).toBe(16428)
    await store.finish(
      'idea',
      {
        frames: 9000,
        notes: [],
        clockAnomalies: 1,
        interruption: 'Input lost',
      },
      44,
    )
    expect((await store.read('idea')).interruption).toContain('durably saved')
    await store.discard('idea')
    expect(await store.list()).toEqual([])
    expect(await db.readAllStrict('guitarRecordingChunks')).toEqual([])
  })
  const score = () =>
    acceptRecordingScoreRevision(
      createRecordingScore(
        row(),
        [
          {
            id: 'note-0',
            midi: 57,
            startFrame: 0,
            endFrame: 8192,
            clarity: 0.9,
            onset: 'attack',
          },
        ],
        DEFAULT_GUITAR_TUNING,
      ),
      1,
    )
  it('publishes an accepted revision even if a concurrent audio-only Keep wins first', async () => {
    await capture()
    const draft = await store.load('idea')
    const accepted = score()
    await Promise.all([store.keep(draft), store.keep(draft, accepted)])
    expect((await store.score(accepted.id))?.notes).toEqual(accepted.notes)
    expect((await store.read('idea')).scoreId).toBe(accepted.id)
    await expect(
      store.accept({ ...accepted, id: 'different' }),
    ).rejects.toThrow('another tab')
    expect(await db.getRepository('voiceTakeAudio').count()).toBe(1)
  })
  it('keeps correction drafts distinct from immutable accepted targets and raw evidence', async () => {
    await capture()
    const accepted = score()
    await store.keep(await store.load('idea'), accepted, accepted)
    await store.saveCorrections({
      ...accepted,
      notes: [{ ...accepted.notes[0], midi: 58, fret: 1 }],
    })
    const reopened = await store.load('idea')
    expect(reopened.editableScore?.notes[0].midi).toBe(58)
    expect(reopened.acceptedScore?.notes[0].midi).toBe(57)
    expect(reopened.notes).toEqual([])
  })
  it('restores the final held note from checkpointed pitch evidence after a crash', async () => {
    await store.begin(row())
    const analysis = createGuitarRecordingAnalysis('idea', 48000)
    for (let sequence = 0; sequence < 3; sequence++) {
      const pcm = Float32Array.from(
        { length: 8192 },
        (_, index) =>
          0.2 *
          Math.sin(((sequence * 8192 + index) / 48000) * 2 * Math.PI * 220),
      )
      await store.checkpoint(
        analysis.process(pcm, pcm.length, sequence, sequence * 8192),
      )
    }
    const recovered = await store.load('idea')
    expect(recovered.notes).toHaveLength(1)
    expect(recovered.notes[0].midi).toBe(57)
    expect(recovered.notes[0].endFrame).toBe(24576)
  })
  it('retains other recordings and removes only this recording, its scores, audio and placements', async () => {
    await capture()
    const accepted = score()
    await store.keep(await store.load('idea'), accepted)
    await createGuitarScoreAttachmentStore(db).save(accepted.id, 'song', {
      source: 'manual',
      anchors: [{ scoreSeconds: 0, audioSeconds: 3 }],
    })
    await store.begin(row('other'))
    await store.remove('idea')
    expect((await store.list()).map((item) => item.id)).toEqual(['other'])
    for (const table of [
      'guitarPracticeScores',
      'guitarRecordingChunks',
      'guitarScoreAttachments',
      'voiceTakes',
      'voiceTakeAudio',
    ])
      expect(await db.readAllStrict(table)).toEqual([])
  })
  it('rejects damaged chunks instead of returning shortened audio as a complete take', async () => {
    await capture()
    await db.deleteByIdStrict('guitarRecordingChunks', 'idea:0')
    await expect(store.load('idea')).rejects.toThrow('incomplete')
    expect(await db.readAllStrict('voiceTakes')).toEqual([])
  })
  it.each(['take', 'thread', 'all'] as const)(
    'removing %s Hear Yourself audio preserves the melody and its accepted target',
    async (scope) => {
      await capture()
      const accepted = score()
      await store.keep(await store.load('idea'), accepted)
      const removed =
        scope === 'take'
          ? await deleteVoiceTake('guitar-take:idea')
          : scope === 'thread'
            ? await deleteVoiceThread('guitar-recording:idea')
            : await wipeVoiceTakes()
      expect(removed).toBe(true)
      const remaining = await store.load('idea')
      expect(remaining.blob).toBeNull()
      expect(remaining.recording.takeId).toBeNull()
      expect(remaining.acceptedScore).toEqual(accepted)
      expect(
        await db.getRepository('guitarRecordingChunks').count(),
      ).toBeGreaterThan(0)
      expect(await db.readAllStrict('voiceTakeAudio')).toEqual([])
    },
  )
  it('rejects a full-storage Keep without discarding evidence and can retry after space is freed', async () => {
    await capture()
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'storage')
    const estimate = vi.fn().mockResolvedValue({ quota: 1000, usage: 999 })
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate },
    })
    try {
      await expect(store.keep(await store.load('idea'))).rejects.toThrow(
        'storage',
      )
      expect((await store.load('idea')).recording.state).toBe('draft')
      expect(await db.readAllStrict('voiceTakes')).toEqual([])
      estimate.mockResolvedValue({ quota: 1_000_000_000, usage: 0 })
      expect((await store.keep(await store.load('idea'))).id).toBe(
        'guitar-take:idea',
      )
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'storage', descriptor)
      else Reflect.deleteProperty(navigator, 'storage')
    }
  })
  it('never rolls the current target back when an old acceptance is retried', async () => {
    await capture()
    const first = score()
    await store.keep(await store.load('idea'), first)
    const second = acceptRecordingScoreRevision(first, 2)
    await store.accept(second)
    await expect(store.accept(first)).rejects.toThrow('another tab')
    expect((await store.read('idea')).scoreId).toBe(second.id)
  })
  it('upgrades v11 without losing old night takes, projects, sessions or audio', async () => {
    const previous = new Dexie('MercuryPitchDB')
    previous.version(11).stores({
      voiceTakes: 'id, createdAt, capturedAt, source, comparisonKey',
      voiceTakeAudio: 'id, &takeId',
      pianoProjects: 'id, updatedAt, sourceKind, sourceRef',
      drumProjects: 'id, updatedAt, sourceKind, sourceRef',
      uvrSessions: 'id, appSessionId',
    })
    await previous.open()
    for (const table of [
      'voiceTakes',
      'pianoProjects',
      'drumProjects',
      'uvrSessions',
    ])
      await previous.table(table).put({ id: 'existing', marker: table })
    await previous.table('voiceTakeAudio').put({
      id: 'old-audio',
      takeId: 'existing',
      data: new Uint8Array([1, 2, 3]).buffer,
    })
    previous.close()
    for (const table of [
      'voiceTakes',
      'pianoProjects',
      'drumProjects',
      'uvrSessions',
    ])
      expect(await db.readByIdStrict(table, 'existing')).toMatchObject({
        marker: table,
      })
    expect(
      new Uint8Array(
        (await db.readByIdStrict<VoiceTakeAudioRecord>(
          'voiceTakeAudio',
          'old-audio',
        ))!.data,
      ),
    ).toEqual(new Uint8Array([1, 2, 3]))
    for (const table of [
      'guitarRecordings',
      'guitarRecordingChunks',
      'guitarPracticeScores',
      'guitarScoreAttachments',
    ]) {
      expect(await db.readAllStrict(table)).toEqual([])
      expect(CLOUD_ENTITIES.has(table)).toBe(false)
    }
  })
})
