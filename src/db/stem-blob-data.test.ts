// ============================================================
// Stem data seam tests — both row shapes through every helper
// ============================================================

import { describe, expect, it } from 'vitest'
import { stemDataBlob, stemDataBytes, stemDataFile, stemDataSize, stemHeaderBytes, } from './stem-blob-data'

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

const AB = bytes(1, 2, 3, 4, 5, 6, 7, 8)
const BLOB = new Blob([bytes(1, 2, 3, 4, 5, 6, 7, 8)], { type: 'audio/wav' })

describe('stemDataSize', () => {
  it('reads both shapes without touching payload bytes', () => {
    expect(stemDataSize(AB)).toBe(8)
    expect(stemDataSize(BLOB)).toBe(8)
  })
})

describe('stemDataBlob', () => {
  it('passes a Blob row through untouched — the whole point', () => {
    expect(stemDataBlob(BLOB, 'audio/wav')).toBe(BLOB)
  })

  it('wraps a legacy ArrayBuffer row', () => {
    const blob = stemDataBlob(AB, 'audio/wav')
    expect(blob.size).toBe(8)
    expect(blob.type).toBe('audio/wav')
  })
})

describe('stemDataFile', () => {
  it('builds a named File from either shape', () => {
    for (const data of [AB, BLOB] as const) {
      const file = stemDataFile(data, 'stem.wav', 'audio/wav')
      expect(file.name).toBe('stem.wav')
      expect(file.size).toBe(8)
      expect(file.type).toBe('audio/wav')
    }
  })
})

describe('stemHeaderBytes', () => {
  it('returns the leading bytes of both shapes', async () => {
    for (const data of [AB, BLOB] as const) {
      const head = new Uint8Array(await stemHeaderBytes(data, 4))
      expect([...head]).toEqual([1, 2, 3, 4])
    }
  })

  it('caps at the payload length', async () => {
    expect((await stemHeaderBytes(AB, 4096)).byteLength).toBe(8)
    expect((await stemHeaderBytes(BLOB, 4096)).byteLength).toBe(8)
  })
})

describe('stemDataBytes', () => {
  it('returns a caller-owned copy so decode cannot detach the row', async () => {
    const copy = await stemDataBytes(AB)
    expect(copy).not.toBe(AB)
    expect([...new Uint8Array(copy)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('reads full bytes from a Blob row', async () => {
    expect([...new Uint8Array(await stemDataBytes(BLOB))]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })
})
