// ============================================================
// uvr-service — the *Strict readers must actually be strict
// ============================================================
//
// The Strict variants exist so archive and data-integrity paths can tell "this
// session has no stems" apart from "the database did not answer". Their own
// docblock promises exactly that: "storage failures reject so callers cannot
// mistake an unread database for a session with no stems."
//
// They did not. Each one called repo.findAll() without `throwOnError`, and
// DexieAdapter.findAll swallows a failure and returns [] unless that flag is
// set (src/db/adapters/dexie-adapter.ts:209-215). So an export written while
// IndexedDB was refusing reads produced a cheerful archive containing nothing.
//
// This runs against the REAL DexieAdapter over fake-indexeddb rather than the
// hand-written InMemoryAdapter, because the swallow-or-throw decision lives in
// DexieAdapter. A double would answer however it was written to, and the test
// would pass with or without the fix.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'

const adapter = new DexieAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { getOriginalFileBlobStrict, getStemBlobStrict, getStemFingerprintDataStrict, listStemTypes, listStemTypesStrict, saveStemBlobDurable, } from '@/db/services/uvr-service'

if (
  typeof window !== 'undefined' &&
  (window.crypto === undefined ||
    typeof window.crypto.randomUUID !== 'function')
) {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
    configurable: true,
  })
}

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error)
      fr.readAsArrayBuffer(this)
    })
  }
}

const wav = (bytes: number[]): Blob =>
  new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })

/**
 * Make the underlying Dexie table fail, NOT the repository's findAll.
 *
 * Spying on findAll itself would replace the very method under test: the
 * swallow-or-rethrow decision lives inside its catch block, so a stubbed
 * findAll rejects regardless of `throwOnError` and the test would pass with or
 * without the fix. Breaking the table one layer down makes the real findAll
 * body throw inside its try, which is what actually exercises the flag.
 */
function breakTable(entity: string) {
  // The Dexie table is private on the repository; reaching it is the point of
  // the exercise, so the cast is deliberate and narrow.
  const repo = adapter.getRepository(entity) as unknown as {
    table: Record<'where' | 'toCollection', () => unknown>
  }
  const boom = (): never => {
    throw new Error('UnknownError: the database is not readable')
  }
  const spies = [
    vi.spyOn(repo.table, 'where').mockImplementation(boom),
    vi.spyOn(repo.table, 'toCollection').mockImplementation(boom),
  ]
  return { restore: () => spies.forEach((s) => s.mockRestore()) }
}

const breakStemReads = () => breakTable('uvrStemBlobs')

describe('uvr-service strict readers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('listStemTypesStrict rejects instead of reporting an empty session', async () => {
    const broken = breakStemReads()
    await expect(listStemTypesStrict('s1')).rejects.toThrow(/not readable/)
    broken.restore()
  })

  it('getStemBlobStrict rejects instead of reporting a missing stem', async () => {
    const broken = breakStemReads()
    await expect(getStemBlobStrict('s1', 'vocal')).rejects.toThrow(
      /not readable/,
    )
    broken.restore()
  })

  it('getOriginalFileBlobStrict rejects instead of reporting no original', async () => {
    const broken = breakStemReads()
    await expect(getOriginalFileBlobStrict('s1')).rejects.toThrow(
      /not readable/,
    )
    broken.restore()
  })

  it('getStemFingerprintDataStrict rejects instead of reporting no fingerprint', async () => {
    const broken = breakTable('uvrStemFingerprints')
    await expect(getStemFingerprintDataStrict('s1')).rejects.toThrow(
      /not readable/,
    )
    broken.restore()
  })

  it('keeps the UI-safe wrapper forgiving, which is the point of having both', async () => {
    // listStemTypes is the non-strict twin: a screen that cannot list stems
    // should render empty rather than throw. If this ever starts rejecting,
    // the split has collapsed and the strict flag went on the wrong function.
    const broken = breakStemReads()
    await expect(listStemTypes('s1')).resolves.toEqual([])
    broken.restore()
  })

  it('still returns real data when the database is healthy', async () => {
    // The negative control: a reader that always rejected would satisfy every
    // case above.
    const saved = await saveStemBlobDurable(
      'healthy-session',
      'vocal',
      wav([1, 2, 3]),
      'v.wav',
    )
    expect(saved.ok).toBe(true)

    await expect(listStemTypesStrict('healthy-session')).resolves.toEqual([
      'vocal',
    ])
  })
})
