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
import * as uvrService from '@/db/services/uvr-service'
import { getStemBlobStrict, saveStemBlobDurable, } from '@/db/services/uvr-service'
import type * as PortableAudio from '@/lib/portable/portable-audio'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { isReadableManifest, PortablePartCorruptError, } from '@/lib/portable/portable-bundle'
import type { UvrSession } from '@/stores/uvr-store'
import { deleteAllUvrSessions, getUvrSession, getUvrSessionByHash, saveAllUvrSessions, } from '@/stores/uvr-store'

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
  beforeEach(() => {
    deleteAllUvrSessions()
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

  it('keeps nothing when a part arrives corrupt', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)
    deleteAllUvrSessions()

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
  beforeEach(() => {
    deleteAllUvrSessions()
    vi.restoreAllMocks()
  })

  it('says the device is full, with numbers, instead of naming the stem', async () => {
    await seedSourceSong()
    const built = await buildPortableBundle(SOURCE_ID)
    deleteAllUvrSessions()

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
