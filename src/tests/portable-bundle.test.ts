// A song leaves one device as parts and becomes a playable session on
// another. These run the REAL database path both ways -- the same Strict
// services production uses, against fake-indexeddb -- because the bundle's
// whole promise is that what arrives is what left. Only the AAC encoder is
// mocked: jsdom has no OfflineAudioContext, and the encoder has its own
// coverage.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom's Blob has no arrayBuffer(); both halves of the bundle rely on it
// (real browsers implement it). Same polyfill the other stem tests use.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Blob.prototype as any).arrayBuffer = function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as ArrayBuffer)
      fr.onerror = () => reject(fr.error as Error)
      fr.readAsArrayBuffer(this)
    })
  }
}

import { loadLyricsFromDbStrict, saveLyricsToDbStrict, } from '@/db/services/lyrics-db-service'
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import type * as UvrService from '@/db/services/uvr-service'
import * as uvrService from '@/db/services/uvr-service'
import { getStemBlobStrict, saveStemBlobDurable, sessionStemPresence, } from '@/db/services/uvr-service'
import type * as PortableAudio from '@/lib/portable/portable-audio'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { isReadableManifest, MAX_PART_BYTES, PortablePartCorruptError, } from '@/lib/portable/portable-bundle'
import type { UvrSession } from '@/stores/uvr-store'
import { deleteAllUvrSessions, getUvrSession, getUvrSessionByHash, saveAllUvrSessions, uvrSessionsWipeSettled, } from '@/stores/uvr-store'

// Real uvr-service, with one seam: sessionStemPresence stays the real
// implementation until a test forces the answer the real database will
// not give on demand ('unknown' — the read itself failing).
vi.mock('@/db/services/uvr-service', async (importOriginal) => {
  const actual = await importOriginal<typeof UvrService>()
  return {
    ...actual,
    sessionStemPresence: vi.fn(actual.sessionStemPresence),
  }
})

// Deterministic "encoding": the tier is legible in the bytes, so a test
// can tell what a stem was encoded at without decoding anything.
vi.mock('@/lib/portable/portable-audio', async (importOriginal) => {
  const actual = await importOriginal<typeof PortableAudio>()
  return {
    ...actual,
    encodeStemToAac: vi.fn(
      (_wav: ArrayBuffer, opts?: { tier?: string }): Promise<Uint8Array> =>
        Promise.resolve(
          new TextEncoder().encode(`aac:${opts?.tier ?? 'default'}`),
        ),
    ),
  }
})

const { encodeStemToAac } =
  (await import('@/lib/portable/portable-audio')) as unknown as {
    encodeStemToAac: ReturnType<typeof vi.fn>
  }

const SOURCE_ID = 'source-session'
const HASH = 'hash-of-the-original-file'

function sourceSession(over: Partial<UvrSession> = {}): UvrSession {
  return {
    sessionId: SOURCE_ID,
    status: 'completed',
    progress: 100,
    fileHash: HASH,
    originalFile: { name: 'Ghosts.mp3', size: 5_000, mimeType: 'audio/mpeg' },
    stemMeta: { vocal: { duration: 227.4 }, instrumental: { duration: 227.4 } },
    createdAt: 1,
    ...over,
  }
}

async function seedSourceSong(over: Partial<UvrSession> = {}): Promise<void> {
  saveAllUvrSessions([sourceSession(over)])
  const wav = (label: string) =>
    new Blob([new TextEncoder().encode(`wav:${label}`)], { type: 'audio/wav' })
  await saveStemBlobDurable(SOURCE_ID, 'vocal', wav('vocal'), 'vocal.wav')
  await saveStemBlobDurable(
    SOURCE_ID,
    'instrumental',
    wav('instrumental'),
    'instrumental.wav',
  )
  await saveLyricsToDbStrict(SOURCE_ID, {
    text: '[00:01.00]A line worth keeping',
    format: 'lrc',
    filename: 'ghosts.lrc',
    wordTimings: { 0: [1.0, 1.4] },
  })
}

describe('portable bundle round trip', () => {
  beforeEach(async () => {
    deleteAllUvrSessions()
    // The store wipes IndexedDB in the background; without this fence the
    // wipe can land after the seed below and delete what it just wrote.
    await uvrSessionsWipeSettled()
    encodeStemToAac.mockClear()
  })

  it('carries a prepared song across, at the tier asked for', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID, {
      tier: 'portable-192',
    })

    expect(isReadableManifest(built.manifest)).toBe(true)
    expect(built.manifest.song).toMatchObject({
      fileHash: HASH,
      title: 'Ghosts.mp3',
      quality: 'portable-192',
    })
    expect(built.manifest.song.durationSec).toBeCloseTo(227.4)
    expect([...built.parts.keys()].sort()).toEqual([
      'prep',
      'stem:instrumental',
      'stem:vocal',
    ])

    // The receiving device: nothing in the library.
    deleteAllUvrSessions()
    // The store wipes IndexedDB in the background; without this fence the
    // wipe can land after the seed below and delete what it just wrote.
    await uvrSessionsWipeSettled()

    const pulled: string[] = []
    const result = await importPortableBundle(built.manifest, (info) => {
      pulled.push(info.id)
      return Promise.resolve(built.parts.get(info.id)!)
    })
    expect(result.outcome).toBe('imported')
    // One part at a time, in manifest order -- the property the format
    // exists for.
    expect(pulled).toEqual(built.manifest.parts.map((p) => p.id))

    const arrived = getUvrSession(result.sessionId)
    expect(arrived).toMatchObject({
      status: 'completed',
      fileHash: HASH,
      audioQuality: 'portable-192',
    })
    expect(arrived?.originalFile?.name).toBe('Ghosts.mp3')
    // The original file deliberately did not travel.
    expect(arrived?.originalFile?.size).toBe(0)

    const vocal = await getStemBlobStrict(result.sessionId, 'vocal')
    expect(vocal?.type).toBe('audio/mp4')
    expect(new TextDecoder().decode(await vocal!.arrayBuffer())).toBe(
      'aac:portable-192',
    )

    const lyrics = await loadLyricsFromDbStrict(result.sessionId)
    expect(lyrics?.text).toBe('[00:01.00]A line worth keeping')
    expect(lyrics?.wordTimings).toEqual({ 0: [1.0, 1.4] })
  })

  it('declines a song this device already has, before pulling a byte', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)

    const getPart = vi.fn()
    const result = await importPortableBundle(built.manifest, getPart)
    expect(result).toEqual({
      outcome: 'already-here',
      sessionId: SOURCE_ID,
    })
    expect(getPart).not.toHaveBeenCalled()
  })

  it("REQ-SYNC-028: still declines when the ghost check answers 'unknown'", async () => {
    // 'unknown' means the presence read failed, not that the stems are
    // gone. Clearing the "ghost" on that answer would delete a session
    // that may be perfectly healthy — the import must decline instead.
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)
    vi.mocked(sessionStemPresence).mockResolvedValueOnce('unknown')

    const getPart = vi.fn()
    const result = await importPortableBundle(built.manifest, getPart)

    expect(result).toEqual({
      outcome: 'already-here',
      sessionId: SOURCE_ID,
    })
    expect(getPart).not.toHaveBeenCalled()
    // The maybe-healthy session is untouched.
    expect(getUvrSessionByHash(HASH)?.sessionId).toBe(SOURCE_ID)
    expect(await getStemBlobStrict(SOURCE_ID, 'vocal')).not.toBeNull()
  })

  it('keeps nothing when a part arrives corrupt', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)
    deleteAllUvrSessions()
    // The store wipes IndexedDB in the background; without this fence the
    // wipe can land after the seed below and delete what it just wrote.
    await uvrSessionsWipeSettled()

    await expect(
      importPortableBundle(built.manifest, (info) => {
        const real = built.parts.get(info.id)!
        if (info.id !== 'stem:instrumental') return Promise.resolve(real)
        const bad = real.slice()
        bad[0] = bad[0]! ^ 0xff
        return Promise.resolve(bad)
      }),
    ).rejects.toThrow(PortablePartCorruptError)

    // Rolled back: no session by hash, so a clean retry is possible.
    expect(getUvrSessionByHash(HASH)).toBeUndefined()
    const retry = await importPortableBundle(built.manifest, (info) =>
      Promise.resolve(built.parts.get(info.id)!),
    )
    expect(retry.outcome).toBe('imported')
  })

  it('passes an already-portable copy through without re-encoding it', async () => {
    // A session that itself arrived as a bundle stores AAC. Re-encoding it
    // would spend minutes making a strictly worse copy.
    saveAllUvrSessions([sourceSession({ audioQuality: 'portable-128' })])
    const aac = new Blob([new TextEncoder().encode('aac:already')], {
      type: 'audio/mp4',
    })
    await saveStemBlobDurable(SOURCE_ID, 'instrumental', aac, 'inst.m4a')

    const built = await buildPortableBundle(SOURCE_ID, {
      tier: 'portable-192',
    })
    expect(encodeStemToAac).not.toHaveBeenCalled()
    // The manifest tells the truth about what the copy is, not what was
    // asked for.
    expect(built.manifest.song.quality).toBe('portable-128')
    expect(
      new TextDecoder().decode(built.parts.get('stem:instrumental')!),
    ).toBe('aac:already')
  })

  it('refuses to read a manifest from the future', () => {
    const manifest: PortableBundleManifest = {
      format: 'mercurypitch-song',
      version: 99,
      song: { fileHash: 'h', title: 't', quality: 'portable-192' },
      parts: [{ id: 'prep', bytes: 1, sha256: 'x', mime: 'application/json' }],
    }
    // Misreading a song is worse than declining one.
    expect(isReadableManifest(manifest)).toBe(false)
  })
})

describe('a device with no room left', () => {
  beforeEach(async () => {
    deleteAllUvrSessions()
    // The store wipes IndexedDB in the background; without this fence the
    // wipe can land after the seed below and delete what it just wrote.
    await uvrSessionsWipeSettled()
    vi.restoreAllMocks()
  })

  it('says the device is full, with numbers, instead of naming the stem', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)
    deleteAllUvrSessions()
    // The store wipes IndexedDB in the background; without this fence the
    // wipe can land after the seed below and delete what it just wrote.
    await uvrSessionsWipeSettled()

    // What a full device does: the first stem lands, the second does not.
    // Reported from a real TV, where the message was only "the
    // instrumental stem could not be stored" -- true, useless, and
    // arriving after the whole transfer.
    const real = uvrService.saveStemBlobDurable
    let saves = 0
    vi.spyOn(uvrService, 'saveStemBlobDurable').mockImplementation(
      async (...args: Parameters<typeof real>) => {
        saves += 1
        if (saves === 1) return real(...args)
        return { ok: false, quotaExceeded: true, error: undefined }
      },
    )
    // jsdom has no StorageManager; the numbers are the whole point of the
    // message, so they are supplied rather than skipped.
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: () =>
          Promise.resolve({
            quota: 16 * 1024 * 1024,
            usage: 8 * 1024 * 1024,
          }),
      },
    })

    const error = await importPortableBundle(built.manifest, (info) =>
      Promise.resolve(built.parts.get(info.id)!),
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).toContain('no room on this device')
    // The figures are the point: "could not be stored" gives somebody
    // nothing to act on, and a 16 MB allowance is the actual answer.
    expect(message).toContain('16.0 MB')
    expect(message).toContain('8.0 MB')

    // And a torn import still leaves nothing behind.
    expect(getUvrSessionByHash(HASH)).toBeUndefined()
  })
})

/**
 * A manifest is the one thing a receiver believes before it can verify
 * anything: `receiveBundleOverWire` accumulates chunks against the byte
 * count it announces, and `getPart` asks for each part it lists. So every
 * number in it is an instruction from the far device, and the far device
 * is not necessarily ours -- a paired peer can be a modified client, and
 * an older one can simply be wrong.
 *
 * The counts used to be checked as `typeof === 'number'` only. Against
 * NaN the receiver's two exits both become unreachable: `received +
 * length > NaN` is never true, so "more than you announced" cannot trip,
 * and `received === NaN` is never true, so "that is all of it" cannot
 * pass. Measured before the fix: 5000 chunks accepted, pull never
 * resolved, every chunk retained -- a tab that grows until it dies, with
 * no error anywhere. Infinity behaves the same way, and 500 GB was
 * accepted as a size to start writing to a phone.
 */
describe('a manifest is data from another device, not a type', () => {
  const withParts = (parts: unknown): unknown => ({
    format: 'mercurypitch-song',
    version: 1,
    song: { fileHash: 'h', title: 't', quality: 'portable-192' },
    parts,
  })
  const part = (over: Record<string, unknown> = {}): unknown => ({
    id: 'prep',
    bytes: 1,
    sha256: 'x',
    mime: 'application/json',
    ...over,
  })

  it('accepts the honest shape', () => {
    expect(isReadableManifest(withParts([part()]))).toBe(true)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['fractional', 1.5],
    ['zero', 0],
    ['past the ceiling', MAX_PART_BYTES + 1],
  ])('refuses a part announcing %s bytes', (_label, bytes) => {
    expect(isReadableManifest(withParts([part({ bytes })]))).toBe(false)
  })

  it('accepts a part right at the ceiling', () => {
    // The bound is a ceiling, not an off-by-one trap.
    expect(
      isReadableManifest(withParts([part({ bytes: MAX_PART_BYTES })])),
    ).toBe(true)
  })

  it('refuses a part id that is not one of the three', () => {
    // Otherwise the id is any string, and the count below is unbounded.
    expect(
      isReadableManifest(withParts([part({ id: 'stem:everything' })])),
    ).toBe(false)
  })

  it('refuses more parts than there are part ids', () => {
    const many = Array.from({ length: 100_000 }, () => part())
    expect(isReadableManifest(withParts(many))).toBe(false)
  })

  it('refuses the same part twice', () => {
    // Two 'prep' entries is one part served twice, and a pull loop that
    // asks for the same bytes again for no reason.
    expect(isReadableManifest(withParts([part(), part()]))).toBe(false)
  })

  it('still refuses a manifest with no parts at all', () => {
    expect(isReadableManifest(withParts([]))).toBe(false)
  })
})
