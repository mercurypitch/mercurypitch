// ============================================================
// The Karaoke room's example songs, as the bundle carries them
// ============================================================
//
// Three songs by Josh Woodward ship inside the app (plan S8 §8, decision
// D13 A): a manifest with their titles, credits and lyrics, committed, and
// six stems fetched from R2 and pinned by sha256 (they are 25 MiB, and do
// not belong in git or in the web deploy). What can drift is the join
// between those halves — a stem the manifest names that nothing fetches,
// or a pin nothing names — and the fetch itself, which must refuse a file
// that is not the one that was reviewed.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error -- a plain .mjs build script with no types, read as is.
import { globToRegExp, NATIVE_ASSETS } from '../native-assets.mjs'
// @ts-expect-error -- as above.
import { checkKaraokeExamples, ensureKaraokeExamples, KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from '../scripts/fetch-karaoke-examples.mjs'

interface Pin {
  path: string
  url: string
  bytes: number
  sha256: string
}

interface Entry {
  glob: string
  reason: string
  root?: 'native'
}

interface BundledSong {
  slug: string
  notes: string
  title: string
  artist: string
  attribution: {
    text: string
    url: string
    license: string
    licenseUrl: string
  }
  durationSec: number
  lyricsRevision: number
  lyricsText: string
  stems: { vocal: string; instrumental: string }
}

const pins = KARAOKE_EXAMPLE_PINS as readonly Pin[]
const root = NATIVE_ONLY_DIR as string
const manifest = JSON.parse(
  readFileSync(join(root, 'karaoke/examples/manifest.json'), 'utf8'),
) as { version: number; songs: BundledSong[] }

describe('the example songs the room ships', () => {
  it('pins every stem the manifest names, and nothing it does not', () => {
    const named = manifest.songs
      .flatMap((song) => [song.stems.vocal, song.stems.instrumental])
      .map((url) => url.replace(/^\//u, ''))
      .sort()
    expect(pins.map((pin) => pin.path).sort()).toEqual(named)
  })

  it('pins each file by a real hash and size, from the public R2 objects', () => {
    for (const pin of pins) {
      expect(pin.sha256, pin.path).toMatch(/^[0-9a-f]{64}$/u)
      expect(pin.bytes, pin.path).toBeGreaterThan(1_000_000)
      expect(pin.url, pin.path).toMatch(
        /^https:\/\/pub-[0-9a-f]+\.r2\.dev\/demo\/[a-z-]+\/(vocal|instrumental)\.m4a$/u,
      )
      expect(pin.path, pin.path).toMatch(/\.m4a$/u)
    }
    // 25.45 MiB of audio: the plan's 25.46 MiB counted the two .lrc files
    // as well, and their text travels inside the manifest here.
    const total = pins.reduce((sum, pin) => sum + pin.bytes, 0)
    expect(total).toBe(26_691_088)
  })

  it('is three Josh Woodward songs, each carrying its CC BY 4.0 credit', () => {
    expect(manifest.version).toBe(1)
    expect(manifest.songs.map((song) => song.title)).toEqual([
      'Goodbye to Spring',
      "I'll Be Right Behind You, Josephine",
      'Nothing in the Dark',
    ])
    for (const song of manifest.songs) {
      expect(song.artist).toBe('Josh Woodward')
      expect(song.attribution.license).toBe('CC BY 4.0')
      expect(song.attribution.licenseUrl).toBe(
        'https://creativecommons.org/licenses/by/4.0/',
      )
      expect(song.lyricsText.length, song.slug).toBeGreaterThan(1000)
      expect(song.durationSec).toBeGreaterThan(200)
    }
  })

  it('names them by the slugs the server uses, so going online finds them', () => {
    // `demoSessionId(slug)` makes the session id; the same slug from the
    // bundle and from /api/demo-songs has to land on the same row.
    expect(manifest.songs.map((song) => song.slug)).toEqual([
      'karaoke-night',
      'josephine',
      'nothing-in-the-dark',
    ])
  })
})

describe('their notes (audit K1)', () => {
  // A phone cannot analyse a streamed vocal, so the examples carry the notes
  // the mixer would have computed (scripts/generate-karaoke-example-notes.mjs)
  // and the seed stores them where the mixer looks.
  interface Notes {
    version: number
    vocalSha256: string
    segmentedNotes: Array<{ midi: number; startSec: number; endSec: number }>
    mergedNotes: unknown[]
    keyRegions: unknown[]
  }

  it.each(manifest.songs.map((song) => [song.slug, song] as const))(
    '%s: beside its vocal, from the vocal it ships',
    (_, song) => {
      const vocal = song.stems.vocal.replace(/^\//u, '')
      expect(song.notes).toBe(
        `/${vocal.slice(0, vocal.lastIndexOf('/'))}/notes.json`,
      )
      const notes = JSON.parse(
        readFileSync(join(root, song.notes.slice(1)), 'utf8'),
      ) as Notes
      expect(notes.version).toBe(1)
      // A stem whose pin changed needs its notes generated again.
      expect(notes.vocalSha256).toBe(
        pins.find((pin) => pin.path === vocal)?.sha256,
      )
      expect(notes.segmentedNotes.length).toBeGreaterThan(100)
      expect(notes.mergedNotes.length).toBeGreaterThanOrEqual(
        notes.segmentedNotes.length,
      )
      expect(notes.keyRegions.length).toBeGreaterThan(0)
      let previous = 0
      for (const note of notes.segmentedNotes) {
        expect(note.startSec).toBeGreaterThanOrEqual(previous)
        expect(note.endSec).toBeGreaterThan(note.startSec)
        expect(note.endSec).toBeLessThanOrEqual(song.durationSec)
        expect(note.midi).toBeGreaterThan(30)
        expect(note.midi).toBeLessThan(96)
        previous = note.startSec
      }
    },
  )
})

describe('fetching them', () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  const pin: Pin = {
    path: 'karaoke/examples/test/vocal.m4a',
    url: 'https://pub-0.r2.dev/demo/test/vocal.m4a',
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
  const answer = (body: Uint8Array<ArrayBuffer>) =>
    vi.fn(async () => Promise.resolve(new Response(body, { status: 200 })))

  it('writes a pinned file that is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const fetchImpl = answer(bytes)
    const result = (await ensureKaraokeExamples({
      root: dir,
      pins: [pin],
      fetchImpl,
    })) as { fetched: string[]; kept: string[] }
    expect(result.fetched).toEqual([pin.path])
    expect([...readFileSync(join(dir, pin.path))]).toEqual([...bytes])
  })

  it('refuses a download that is not the pinned file, and writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    await expect(
      ensureKaraokeExamples({
        root: dir,
        pins: [pin],
        fetchImpl: answer(new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9])),
      }),
    ).rejects.toThrow(/sha256/u)
    expect(existsSync(join(dir, pin.path))).toBe(false)
    expect(existsSync(join(dir, `${pin.path}.part`))).toBe(false)
  })

  it('fetches nothing that is already here and exact', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    mkdirSync(join(dir, 'karaoke/examples/test'), { recursive: true })
    writeFileSync(join(dir, pin.path), bytes)
    const fetchImpl = answer(bytes)
    const result = (await ensureKaraokeExamples({
      root: dir,
      pins: [pin],
      fetchImpl,
    })) as { fetched: string[]; kept: string[] }
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.kept).toEqual([pin.path])
  })

  it('replaces a file that is here but is not the pinned one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    mkdirSync(join(dir, 'karaoke/examples/test'), { recursive: true })
    writeFileSync(join(dir, pin.path), new Uint8Array([0]))
    const result = (await ensureKaraokeExamples({
      root: dir,
      pins: [pin],
      fetchImpl: answer(bytes),
    })) as { fetched: string[]; kept: string[] }
    expect(result.fetched).toEqual([pin.path])
  })

  it('reports a missing file without the network', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    expect(checkKaraokeExamples(dir, [pin])).toEqual([pin.path])
  })
})

describe('the native asset manifest carries them', () => {
  const entries = NATIVE_ASSETS as readonly Entry[]
  const native = entries.filter((entry) => entry.root === 'native')

  it('ships every pinned stem, from the native-only root', () => {
    const globs = native.map((entry) => globToRegExp(entry.glob) as RegExp)
    for (const pinned of pins) {
      expect(
        globs.some((glob) => glob.test(pinned.path)),
        pinned.path,
      ).toBe(true)
    }
  })

  it('ships the notes', () => {
    const globs = native.map((entry) => globToRegExp(entry.glob) as RegExp)
    for (const song of manifest.songs) {
      expect(
        globs.some((glob) => glob.test(song.notes.slice(1))),
        song.notes,
      ).toBe(true)
    }
  })

  it('ships the manifest the room seeds its library from', () => {
    const globs = native.map((entry) => globToRegExp(entry.glob) as RegExp)
    expect(
      globs.some((glob) => glob.test('karaoke/examples/manifest.json')),
    ).toBe(true)
  })
})
