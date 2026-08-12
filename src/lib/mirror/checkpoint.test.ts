import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKPOINT_TTL_MS, clearCheckpoint, isCheckpointHash, loadCheckpoint, saveCheckpoint, } from './checkpoint'
import type { F0Frame, RangeResult } from './metrics'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}

const RANGE: RangeResult = {
  lowMidi: 41,
  highMidi: 73,
  lowNote: 'F2',
  highNote: 'C#5',
  semitones: 32,
  qualifyingMidis: [41, 73],
  voiceHint: 'Baritone',
}

const frames = (n: number): F0Frame[] =>
  Array.from({ length: n }, (_, i) => ({
    t: i * 0.01,
    f0: 110 + i,
    conf: 0.9,
  }))

const INPUT = {
  glides: [frames(3), frames(3)],
  hold: frames(2),
  targets: [60, 62, 64, 65, 67],
  range: RANGE,
}

let storage: Storage
beforeEach(() => {
  storage = memoryStorage()
})

describe('mirror checkpoint', () => {
  it('round-trips everything a resumed run needs', () => {
    saveCheckpoint(storage, INPUT, 1000)
    const loaded = loadCheckpoint(storage, 1000)

    expect(loaded).not.toBeNull()
    expect(loaded?.range).toEqual(RANGE)
    // The same five notes must be asked for again — re-picking them from the
    // range would quietly change the run the person is completing.
    expect(loaded?.targets).toEqual([60, 62, 64, 65, 67])
    expect(loaded?.glides).toHaveLength(2)
    expect(loaded?.hold).toHaveLength(2)
  })

  it('is empty before anything is saved', () => {
    expect(loadCheckpoint(storage)).toBeNull()
  })

  it('clears on demand', () => {
    saveCheckpoint(storage, INPUT)
    clearCheckpoint(storage)
    expect(loadCheckpoint(storage)).toBeNull()
  })

  // A day-old resume would compare its delta against a baseline from another
  // sitting, and nobody is still waiting to sing five notes.
  it('expires past the TTL, and clears itself on that read', () => {
    saveCheckpoint(storage, INPUT, 0)

    expect(loadCheckpoint(storage, CHECKPOINT_TTL_MS - 1)).not.toBeNull()
    expect(loadCheckpoint(storage, CHECKPOINT_TTL_MS + 1)).toBeNull()
    // Cleared, not merely rejected — otherwise it lingers for the next run.
    expect(storage.getItem('mirror.checkpoint.v1')).toBeNull()
  })

  it('rejects malformed or foreign entries instead of throwing', () => {
    storage.setItem('mirror.checkpoint.v1', 'not json')
    expect(loadCheckpoint(storage)).toBeNull()

    storage.setItem('mirror.checkpoint.v1', JSON.stringify({ savedAt: 1 }))
    expect(loadCheckpoint(storage)).toBeNull()

    storage.setItem('mirror.checkpoint.v1', JSON.stringify([1, 2, 3]))
    expect(loadCheckpoint(storage)).toBeNull()
  })

  it('tolerates an entry written before hold frames were carried', () => {
    storage.setItem(
      'mirror.checkpoint.v1',
      JSON.stringify({
        savedAt: Date.now(),
        glides: [[]],
        targets: [60],
        range: RANGE,
      }),
    )

    expect(loadCheckpoint(storage)?.hold).toEqual([])
  })

  // Storage being full must never take the live run down with it: the only
  // thing lost is the ability to recover a reload.
  it('reports failure instead of throwing when storage refuses', () => {
    const full: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }

    expect(() => saveCheckpoint(full, INPUT)).not.toThrow()
    expect(saveCheckpoint(full, INPUT)).toBeNull()
  })

  it('recognises the twin fragment with or without the hash', () => {
    expect(isCheckpointHash('#twin')).toBe(true)
    expect(isCheckpointHash('twin')).toBe(true)
    expect(isCheckpointHash('#take-3')).toBe(false)
    expect(isCheckpointHash('')).toBe(false)
  })
})
