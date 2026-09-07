// Recording placement persists per score revision and song without mutating either source.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { DexieAdapter } from '../adapters/dexie-adapter'
import { createGuitarScoreAttachmentStore, validGuitarRecordingAlignment, } from './guitar-score-attachment-service'

const score: GuitarPracticeScore = {
  id: 'recorded:1',
  recordingId: '1',
  revision: 1,
  title: 'Melody',
  createdAt: '',
  updatedAt: '',
  bpm: 120,
  timeSignature: [4, 4],
  grid: 'display',
  tuning: [64, 59, 55, 50, 45, 40],
  capo: 0,
  notes: [
    {
      id: 'a',
      evidenceId: 'a',
      midi: 64,
      string: 1,
      fret: 0,
      startBeat: 1,
      endBeat: 2,
    },
    {
      id: 'b',
      evidenceId: 'b',
      midi: 64,
      string: 1,
      fret: 0,
      startBeat: 3,
      endBeat: 4,
    },
  ],
  attachment: { backingId: 'song', firstSeconds: 10.5, lastSeconds: 11.5 },
}

describe('recorded song placement', () => {
  let db: DexieAdapter
  beforeEach(async () => {
    db = new DexieAdapter()
    await db.putStrict('guitarPracticeScores', score)
  })
  afterEach(async () => {
    await db.destroy()
  })
  it('uses captured clock anchors only for the recorded backing', async () => {
    const store = createGuitarScoreAttachmentStore(db)
    expect(await store.read(score, 'song')).toEqual({
      source: 'manual',
      anchors: [
        { scoreSeconds: 0.5, audioSeconds: 10.5 },
        { scoreSeconds: 1.5, audioSeconds: 11.5 },
      ],
    })
    expect(await store.read(score, 'another-song')).toBeNull()
  })
  it('reloads manual placement and remembers removal without reviving captured anchors', async () => {
    const alignment = {
      source: 'manual' as const,
      anchors: [{ scoreSeconds: 0.5, audioSeconds: 15 }],
    }
    await createGuitarScoreAttachmentStore(db).save(score.id, 'song', alignment)
    db.close()
    db = new DexieAdapter()
    const store = createGuitarScoreAttachmentStore(db)
    expect(await store.read(score, 'song')).toEqual(alignment)
    expect(await db.readByIdStrict('guitarPracticeScores', score.id)).toEqual(
      score,
    )
    await store.save(score.id, 'song', null)
    expect(
      await createGuitarScoreAttachmentStore(db).read(score, 'song'),
    ).toBeNull()
    expect(
      await store.read({ ...score, id: 'revision-2' }, 'song'),
    ).not.toBeNull()
  })
  it('rejects missing scores, reversed clocks and corrupt stored placement', async () => {
    const store = createGuitarScoreAttachmentStore(db)
    expect(
      validGuitarRecordingAlignment({
        source: 'manual',
        anchors: [
          { scoreSeconds: 1, audioSeconds: 3 },
          { scoreSeconds: 2, audioSeconds: 2 },
        ],
      }),
    ).toBe(false)
    await expect(store.save('missing', 'song', null)).rejects.toThrow(
      'no longer exists',
    )
    await store.save(score.id, 'song', null)
    await db.putStrict('guitarScoreAttachments', {
      id: JSON.stringify([score.id, 'song']),
      scoreId: score.id,
      backingId: 'song',
      createdAt: '',
      updatedAt: '',
      alignment: { source: 'manual', anchors: [] },
    })
    await expect(store.read(score, 'song')).rejects.toThrow('damaged')
  })
})
