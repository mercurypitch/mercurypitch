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
import type { ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
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

  const noWait = () => vi.fn(async () => Promise.resolve())

  it('tries a file again when its fetch fails, a few seconds later, and writes it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(bytes, { status: 200 }))
    const wait = noWait()
    const lines: string[] = []
    const result = (await ensureKaraokeExamples({
      root: dir,
      pins: [pin],
      fetchImpl,
      wait,
      log: (line: string) => lines.push(line),
    })) as { fetched: string[]; kept: string[] }
    expect(result.fetched).toEqual([pin.path])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(wait.mock.calls).toEqual([[5000]])
    expect(lines).toContain(
      `[karaoke-examples] ${pin.path}: try 1 of 3 failed (fetch failed); trying again`,
    )
    expect([...readFileSync(join(dir, pin.path))]).toEqual([...bytes])
  })

  it('tries a file again when its transfer drops part-way', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const dropped = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 2))
        controller.error(new TypeError('terminated'))
      },
    })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(dropped, { status: 200 }))
      .mockResolvedValueOnce(new Response(bytes, { status: 200 }))
    const result = (await ensureKaraokeExamples({
      root: dir,
      pins: [pin],
      fetchImpl,
      wait: noWait(),
    })) as { fetched: string[]; kept: string[] }
    expect(result.fetched).toEqual([pin.path])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('tries a file again when the server fails, but not when it refuses the file', async () => {
    const busy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(bytes, { status: 200 }))
    const refused = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }))
    const wait = noWait()
    const fetched = (await ensureKaraokeExamples({
      root: mkdtempSync(join(tmpdir(), 'mp-examples-')),
      pins: [pin],
      fetchImpl: busy,
      wait,
    })) as { fetched: string[]; kept: string[] }
    expect(fetched.fetched).toEqual([pin.path])
    expect(busy).toHaveBeenCalledTimes(2)
    await expect(
      ensureKaraokeExamples({
        root: mkdtempSync(join(tmpdir(), 'mp-examples-')),
        pins: [pin],
        fetchImpl: refused,
        wait,
      }),
    ).rejects.toThrow(/answered 404\.$/u)
    expect(refused).toHaveBeenCalledTimes(1)
    expect(wait).toHaveBeenCalledTimes(1)
  })

  it('stops after three tries, saying so, and writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const unreachable = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const failing = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }))
    const wait = noWait()
    await expect(
      ensureKaraokeExamples({
        root: dir,
        pins: [pin],
        fetchImpl: unreachable,
        wait,
      }),
    ).rejects.toThrow(/could not fetch \S+ in 3 tries \(fetch failed\)/u)
    expect(unreachable).toHaveBeenCalledTimes(3)
    expect(wait.mock.calls).toEqual([[5000], [10000]])
    await expect(
      ensureKaraokeExamples({
        root: dir,
        pins: [pin],
        fetchImpl: failing,
        wait,
      }),
    ).rejects.toThrow(/answered 503 on try 3 of 3\.$/u)
    expect(failing).toHaveBeenCalledTimes(3)
    expect(existsSync(join(dir, pin.path))).toBe(false)
    expect(existsSync(join(dir, `${pin.path}.part`))).toBe(false)
  })

  /** A server on this machine that answers each request, numbered from 1, as `send` writes it. */
  async function serving(
    send: (request: number, response: ServerResponse) => void,
  ) {
    let requests = 0
    const server = createServer((_request, response) => {
      requests += 1
      send(requests, response)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    return {
      url: `http://127.0.0.1:${port}/vocal.m4a`,
      requests: () => requests,
      close: async () => {
        server.closeAllConnections()
        await new Promise((resolve) => server.close(resolve))
      },
    }
  }

  it('abandons a transfer once nothing has arrived for a while, and tries again', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const server = await serving((request, response) => {
      response.writeHead(200, { 'content-length': String(bytes.byteLength) })
      // The first answer sends two bytes and then nothing more.
      if (request === 1) response.write(bytes.subarray(0, 2))
      else response.end(bytes)
    })
    try {
      const result = (await ensureKaraokeExamples({
        root: dir,
        pins: [{ ...pin, url: server.url }],
        wait: noWait(),
        stallMs: 300,
      })) as { fetched: string[]; kept: string[] }
      expect(result.fetched).toEqual([pin.path])
      expect(server.requests()).toBe(2)
    } finally {
      await server.close()
    }
  })

  it('never cuts off a transfer that is slow but moving', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-examples-'))
    const server = await serving((_request, response) => {
      response.writeHead(200, { 'content-length': String(bytes.byteLength) })
      // A byte every 100 ms: 800 ms in all, well past the 300 ms below.
      let sent = 0
      const timer = setInterval(() => {
        response.write(bytes.subarray(sent, sent + 1))
        sent += 1
        if (sent === bytes.byteLength) {
          clearInterval(timer)
          response.end()
        }
      }, 100)
    })
    try {
      const result = (await ensureKaraokeExamples({
        root: dir,
        pins: [{ ...pin, url: server.url }],
        wait: noWait(),
        stallMs: 300,
      })) as { fetched: string[]; kept: string[] }
      expect(result.fetched).toEqual([pin.path])
      expect(server.requests()).toBe(1)
      expect([...readFileSync(join(dir, pin.path))]).toEqual([...bytes])
    } finally {
      await server.close()
    }
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
