// ============================================================
// Session pitch analysis — the song's tempo kept with its notes
// ============================================================
//
// The tempo is stored in the analysis record, so a song reopened with its
// notes needs no second estimate, and a tempo the singer typed survives the
// reload. Through the real service, over a store held in memory.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OfflinePitchAnalysisRecord } from '@/db/entities'
import type { MergedNote } from '@/lib/midi-generator'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'
import { loadPitchAnalysisFromDbStrict, savePitchAnalysisToDbStrict, } from './session-pitch-analysis-service'

const store = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('@/db', () => ({ getDb: async () => store.adapter }))

const NOTES: MergedNote[] = [
  { midi: 60, noteName: 'C4', startSec: 0, endSec: 0.4 },
]

beforeEach(() => {
  store.adapter = new InMemoryAdapter()
})

describe('the tempo stored with a pitch analysis', () => {
  it('comes back with the notes', async () => {
    const tempo = { estimate: { bpm: 92, confidence: 0.3 }, typedBpm: 100 }
    await savePitchAnalysisToDbStrict('song', {
      mergedNotes: NOTES,
      segmentedNotes: NOTES,
      pitchHistory: [],
      tempo,
    })

    expect((await loadPitchAnalysisFromDbStrict('song'))?.tempo).toEqual(tempo)
  })

  it('is absent from a record written before tempos were kept', async () => {
    await savePitchAnalysisToDbStrict('song', {
      mergedNotes: NOTES,
      segmentedNotes: NOTES,
      pitchHistory: [],
    })

    const loaded = await loadPitchAnalysisFromDbStrict('song')
    expect(loaded?.segmentedNotes).toEqual(NOTES)
    expect(loaded?.tempo).toBeUndefined()
  })

  it('is dropped when it does not read as a tempo, and the notes still load', async () => {
    const repo = (
      store.adapter as InMemoryAdapter
    ).getRepository<OfflinePitchAnalysisRecord>('offlinePitchAnalysis')
    await repo.create({
      fileHash: 'session:song',
      analysisResultsJson: JSON.stringify(NOTES),
      lrcLinesJson: '[]',
      segmentedNotesJson: JSON.stringify(NOTES),
      tempoJson: '{"typedBpm":"fast"}',
    })

    const loaded = await loadPitchAnalysisFromDbStrict('song')
    expect(loaded?.segmentedNotes).toEqual(NOTES)
    expect(loaded?.tempo).toBeUndefined()
  })
})
