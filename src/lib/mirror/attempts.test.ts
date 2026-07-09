import { beforeEach, describe, expect, it } from 'vitest'
import { attemptByTake, loadAttempts, MAX_ATTEMPTS, parseTakeHash, saveAttempt, takeHash, } from './attempts'
import type { MirrorResult } from './metrics'

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

const RESULT: MirrorResult = {
  range: {
    lowMidi: 41,
    highMidi: 73,
    lowNote: 'F2',
    highNote: 'C#5',
    semitones: 32,
    qualifyingMidis: [41, 73],
    voiceHint: 'Baritone',
  },
  accuracy: { score: 66, takes: [], scoopMedianMs: null },
  steadiness: {
    referenceCents: 5700,
    referenceNote: 'A3',
    driftCentsPerSec: -4,
    wobbleSdCents: 4,
    vibrato: null,
    score: 98,
    voicedSeconds: 5,
  },
}

const GLIDES = [
  [{ t: 0.0161239, f0: 220.12345, conf: 0.91234 }],
  [{ t: 0.032, f0: 440.5, conf: 0.9 }],
]

describe('mirror attempts store', () => {
  let storage: Storage
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('saves and restores a take round-trip', () => {
    const saved = saveAttempt(storage, {
      result: RESULT,
      glides: GLIDES,
      deltaLine: '',
    })
    expect(saved?.n).toBe(1)
    const restored = attemptByTake(storage, 1)
    expect(restored?.result.range?.lowNote).toBe('F2')
    expect(restored?.glides).toHaveLength(2)
  })

  it('rounds stored frames (storage stays lean, trace unaffected)', () => {
    saveAttempt(storage, { result: RESULT, glides: GLIDES, deltaLine: '' })
    const frame = attemptByTake(storage, 1)?.glides[0][0]
    expect(frame).toEqual({ t: 0.016, f0: 220.12, conf: 0.912 })
  })

  it('numbers takes sequentially and keeps numbering after pruning', () => {
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
      saveAttempt(storage, { result: RESULT, glides: [], deltaLine: `d${i}` })
    }
    const attempts = loadAttempts(storage)
    expect(attempts).toHaveLength(MAX_ATTEMPTS)
    // Oldest pruned: take 1..3 gone, numbering continued to 15.
    expect(attempts[0].n).toBe(4)
    expect(attempts[attempts.length - 1].n).toBe(MAX_ATTEMPTS + 3)
    expect(attemptByTake(storage, 1)).toBeNull()
  })

  it('keeps the delta line that was shown when the take finished', () => {
    saveAttempt(storage, {
      result: RESULT,
      glides: [],
      deltaLine: 'up 2 semitones since 9 Jul',
    })
    expect(attemptByTake(storage, 1)?.deltaLine).toBe(
      'up 2 semitones since 9 Jul',
    )
  })

  it('parses take fragments strictly', () => {
    expect(parseTakeHash('#take-3')).toBe(3)
    expect(parseTakeHash('take-12')).toBe(12)
    expect(parseTakeHash('#take-0')).toBeNull()
    expect(parseTakeHash('#take-abc')).toBeNull()
    expect(parseTakeHash('#freddie')).toBeNull()
    expect(parseTakeHash('#sing-the-universe')).toBeNull()
    expect(parseTakeHash(takeHash(7))).toBe(7)
  })

  it('survives corrupted storage', () => {
    storage.setItem('mirror.attempts.v1', '{not json')
    expect(loadAttempts(storage)).toEqual([])
    expect(
      saveAttempt(storage, { result: RESULT, glides: [], deltaLine: '' })?.n,
    ).toBe(1)
  })
})
