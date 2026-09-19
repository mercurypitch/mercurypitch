// ── An example's own lyrics come before a search for them ────────────
//
// An example song ships with authored lyrics, and whoever stages it is
// meant to seed them into the lyrics store first. The song card does. A song
// sheet pick, a playlist step and the in-app mixer open an example by its
// library row instead — and the row can be there before the lyrics are,
// because rows are written first and an author can attach lyrics to a song
// that is already out. The stage then found nothing, went online, and
// offered the singer a search for words that were sitting in the manifest.
//
// This drives the real store and the real controller: the gap was between
// modules that were each correct alone.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import { deleteLyricsFromDb, loadLyricsFromDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { DEMO_SESSION_ID, demoLyricsFilename, demoSessionId, seedDemoLyrics, seedDemoLyricsForSession, } from '@/features/karaoke-night/demo-song'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import type * as LyricsService from '@/lib/lyrics-service'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'

const searchLyricsMulti =
  vi.fn<(q: string, signal?: AbortSignal) => Promise<LyricsSearchMatch[]>>()

vi.mock('@/lib/lyrics-service', async (importOriginal) => {
  const actual = await importOriginal<typeof LyricsService>()
  return {
    ...actual,
    searchLyricsMulti: (q: string, signal?: AbortSignal) =>
      searchLyricsMulti(q, signal),
    searchLyrics: () => Promise.resolve(null),
  }
})

const LYRICS_URL = 'https://r2.test/demo/example/lyrics.lrc'
const AUTHORED = '[00:01.00] Lantern [00:01.60] under\n[00:07.00] Paper boats'

/**
 * One song per test. The controller's version migration is a fire-and-forget
 * write, so a shared session id lets one test's copy land in the next.
 */
let songNumber = 0
let EXAMPLE: DemoSongManifest
let SESSION: string
let STAMP_KEY: string

const BASE: DemoSongManifest = {
  title: 'Paper Boats',
  artist: 'The Build',
  attribution: { text: '', url: '', license: '', licenseUrl: '' },
  stems: {
    vocal: 'https://r2.test/demo/example/vocal.m4a',
    instrumental: 'https://r2.test/demo/example/instrumental.m4a',
  },
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

/**
 * The network as the page sees it: the manifest that ships with the build,
 * and whatever the test puts behind the lyrics URL. Honours an abort the way
 * `fetch` does — by rejecting — because giving up is part of what is tested.
 */
function serve(manifest: DemoSongManifest, lyrics?: Promise<string> | string) {
  const requested: string[] = []
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requested.push(url)
    if (url === '/karaoke-demo-song.json')
      return new Response(JSON.stringify(manifest), { status: 200 })
    if (url === LYRICS_URL && lyrics !== undefined) {
      const aborted = new Promise<never>((_, reject) => {
        const fail = () => reject(new DOMException('Aborted', 'AbortError'))
        if (init?.signal?.aborted === true) fail()
        init?.signal?.addEventListener('abort', fail, { once: true })
      })
      return new Response(await Promise.race([lyrics, aborted]), {
        status: 200,
      })
    }
    return new Response('', { status: 404 })
  })
  vi.stubGlobal('fetch', stub)
  return requested
}

const controllerFor = (sessionId: string, exampleLyricsWaitMs?: number) =>
  useStemMixerLyricsController({
    sessionId,
    songTitle: 'The Build — Paper Boats',
    duration: () => 30,
    playing: () => false,
    elapsed: () => 0,
    seekToWithWindow: () => {},
    exampleLyricsWaitMs,
  })

async function storedRows(sessionId: string): Promise<number> {
  const db = await getDb()
  const rows = await db
    .getRepository('uvrSessionLyrics')
    .findAll({ where: { sessionId } as Record<string, unknown> })
  return rows.length
}

beforeEach(() => {
  localStorage.clear()
  songNumber += 1
  EXAMPLE = { ...BASE, slug: `paper-boats-${songNumber}` }
  SESSION = demoSessionId(EXAMPLE.slug)
  STAMP_KEY = `mercurypitch.demoLyricsSeed.v1.${SESSION}`
  searchLyricsMulti.mockReset()
  searchLyricsMulti.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('an example opened by its row', () => {
  it('gets its own lyrics, and nobody is sent to search for them', async () => {
    serve({ ...EXAMPLE, lyricsText: AUTHORED, lyricsRevision: 4 })

    await createRoot(async (dispose) => {
      const controller = controllerFor(SESSION)
      await controller.loadLyrics()

      expect(controller.lrcLines().map((l) => l.time)).toEqual([1, 7])
      expect(controller.lyricsSource()).toBe('upload')
      expect(controller.lyricsLoading()).toBe(false)
      expect(controller.showSongPicker()).toBe(false)
      expect(searchLyricsMulti).not.toHaveBeenCalled()
      dispose()
    })

    // Seeded like any other door would have: stored, and stamped so a later
    // correction can still reach this copy.
    expect((await loadLyricsFromDb(SESSION))?.text).toBe(AUTHORED)
    expect(JSON.parse(localStorage.getItem(STAMP_KEY) ?? '{}')).toEqual({
      revision: 4,
      text: AUTHORED,
    })
  })

  it('waits for a lyrics file rather than racing it to the search', async () => {
    const file = deferred<string>()
    serve({ ...EXAMPLE, lyrics: LYRICS_URL }, file.promise)

    await createRoot(async (dispose) => {
      const controller = controllerFor(SESSION)
      const loading = controller.loadLyrics()

      await vi.waitFor(() => expect(controller.lyricsLoading()).toBe(true))
      expect(searchLyricsMulti).not.toHaveBeenCalled()

      file.resolve(AUTHORED)
      await loading

      expect(controller.lrcLines()).toHaveLength(2)
      expect(controller.lyricsLoading()).toBe(false)
      expect(searchLyricsMulti).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('stops waiting on a dead connection, and searches as it always did', async () => {
    const never = deferred<string>()
    serve({ ...EXAMPLE, lyrics: LYRICS_URL }, never.promise)

    await createRoot(async (dispose) => {
      const controller = controllerFor(SESSION, 40)
      await controller.loadLyrics()

      expect(searchLyricsMulti).toHaveBeenCalledTimes(1)
      expect(controller.lyricsSource()).toBe('none')
      expect(controller.lyricsLoading()).toBe(false)
      dispose()
    })
    // The abandoned seed wrote nothing behind the singer's back.
    expect(await loadLyricsFromDb(SESSION)).toBeNull()
  })

  it('ends the wait when the singer cancels, and searches for nothing', async () => {
    const never = deferred<string>()
    serve({ ...EXAMPLE, lyrics: LYRICS_URL }, never.promise)

    await createRoot(async (dispose) => {
      const controller = controllerFor(SESSION)
      const loading = controller.loadLyrics()
      await vi.waitFor(() => expect(controller.lyricsLoading()).toBe(true))

      controller.cancelSearch()
      await loading

      expect(controller.lyricsLoading()).toBe(false)
      expect(searchLyricsMulti).not.toHaveBeenCalled()
      dispose()
    })
  })

  it('still searches for an example nobody has written lyrics for', async () => {
    serve(EXAMPLE)

    await createRoot(async (dispose) => {
      const controller = controllerFor(SESSION)
      await controller.loadLyrics()

      expect(searchLyricsMulti).toHaveBeenCalledTimes(1)
      expect(controller.lyricsLoading()).toBe(false)
      dispose()
    })
  })

  it("never asks for the example list on behalf of a singer's own song", async () => {
    const requested = serve({ ...EXAMPLE, lyricsText: AUTHORED })

    await createRoot(async (dispose) => {
      const controller = controllerFor('a-song-of-their-own')
      await controller.loadLyrics()

      expect(requested).toEqual([])
      expect(searchLyricsMulti).toHaveBeenCalledTimes(1)
      dispose()
    })
  })
})

describe('seeding by session id', () => {
  it('finds the manifest the id belongs to', async () => {
    serve({ ...EXAMPLE, lyricsText: AUTHORED })
    await seedDemoLyricsForSession(SESSION)
    expect((await loadLyricsFromDb(SESSION))?.text).toBe(AUTHORED)
  })

  it('does nothing for an id that is not an example, or no longer offered', async () => {
    const requested = serve({ ...EXAMPLE, lyricsText: AUTHORED })
    await seedDemoLyricsForSession('a-song-of-their-own')
    expect(requested).toEqual([])

    await seedDemoLyricsForSession(`${DEMO_SESSION_ID}:parked-yesterday`)
    expect(
      await loadLyricsFromDb(`${DEMO_SESSION_ID}:parked-yesterday`),
    ).toBeNull()
  })
})

describe('two doors asking at once', () => {
  it('fetch once and leave one row', async () => {
    const file = deferred<string>()
    const requested = serve({ ...EXAMPLE, lyrics: LYRICS_URL }, file.promise)
    const manifest = { ...EXAMPLE, lyrics: LYRICS_URL }

    const startup = seedDemoLyrics(manifest)
    const songCard = seedDemoLyrics(manifest)
    await vi.waitFor(() => expect(requested).toContain(LYRICS_URL))
    file.resolve(AUTHORED)
    await Promise.all([startup, songCard])

    expect(requested.filter((url) => url === LYRICS_URL)).toHaveLength(1)
    expect(await storedRows(SESSION)).toBe(1)
  })

  it('seeds again once the first has finished', async () => {
    serve({ ...EXAMPLE, lyricsText: AUTHORED })
    await seedDemoLyrics({ ...EXAMPLE, lyricsText: AUTHORED })
    await deleteLyricsFromDb(SESSION)
    await seedDemoLyrics({ ...EXAMPLE, lyricsText: AUTHORED })
    expect((await loadLyricsFromDb(SESSION))?.text).toBe(AUTHORED)
  })
})

describe('a seed that comes back late', () => {
  it('does not write over what the singer found in the meantime', async () => {
    const file = deferred<string>()
    const requested = serve({ ...EXAMPLE, lyrics: LYRICS_URL }, file.promise)

    const seed = seedDemoLyrics({ ...EXAMPLE, lyrics: LYRICS_URL })
    await vi.waitFor(() => expect(requested).toContain(LYRICS_URL))
    await saveLyricsToDb(SESSION, {
      text: 'found online while the file was on its way',
      format: 'txt',
      filename: 'The Build - Paper Boats.txt',
    })
    file.resolve(AUTHORED)
    await seed

    expect((await loadLyricsFromDb(SESSION))?.text).toBe(
      'found online while the file was on its way',
    )
    // No stamp either: a stamp would claim that text as ours to replace.
    expect(localStorage.getItem(STAMP_KEY)).toBeNull()
  })

  it('writes nothing for a caller that had already given up', async () => {
    // Pasted lyrics need no fetch, so nothing else would stop this one.
    serve({ ...EXAMPLE, lyricsText: AUTHORED })
    const abandon = new AbortController()
    abandon.abort()

    await seedDemoLyrics({ ...EXAMPLE, lyricsText: AUTHORED }, abandon.signal)

    expect(await loadLyricsFromDb(SESSION)).toBeNull()
  })

  it('writes nothing once it has been abandoned', async () => {
    const file = deferred<string>()
    const requested = serve({ ...EXAMPLE, lyrics: LYRICS_URL }, file.promise)
    const abandon = new AbortController()

    const seed = seedDemoLyrics(
      { ...EXAMPLE, lyrics: LYRICS_URL },
      abandon.signal,
    )
    await vi.waitFor(() => expect(requested).toContain(LYRICS_URL))
    abandon.abort()
    await seed

    expect(await loadLyricsFromDb(SESSION)).toBeNull()
    expect(localStorage.getItem(STAMP_KEY)).toBeNull()
  })
})

describe('what a seeded lyric is called', () => {
  it('is named after the artist and the song, like a lyric found online', async () => {
    serve({ ...EXAMPLE, lyricsText: AUTHORED })
    await seedDemoLyrics({ ...EXAMPLE, lyricsText: AUTHORED })
    // Both exports take their name from this record.
    expect((await loadLyricsFromDb(SESSION))?.filename).toBe(
      'The Build - Paper Boats.lrc',
    )
  })

  it('keeps out what a download cannot carry in its name', () => {
    expect(
      demoLyricsFilename({ artist: 'AC/DC', title: 'Who? Me: "Yes"' }, 'lrc'),
    ).toBe('AC DC - Who Me Yes.lrc')
    expect(demoLyricsFilename({ artist: '', title: 'Untitled' }, 'txt')).toBe(
      'Untitled.txt',
    )
    expect(demoLyricsFilename({ artist: ' ', title: '/' }, 'lrc')).toBe(
      'lyrics.lrc',
    )
  })

  it("renames a copy seeded under the bare title, and leaves the singer's words alone", async () => {
    // What every seed wrote before: the title as a slug. The singer has
    // since mapped it, so the text is theirs and the extension moved on.
    await saveLyricsToDb(SESSION, {
      text: 'my own mapping',
      format: 'lrc',
      filename: 'paper-boats.lrc',
      originalText: 'as it was seeded',
      fontSize: 1.8,
    })
    localStorage.setItem(
      STAMP_KEY,
      JSON.stringify({ revision: 1, text: 'as it was seeded' }),
    )
    serve({ ...EXAMPLE, lyricsText: AUTHORED, lyricsRevision: 4 })

    await seedDemoLyrics({
      ...EXAMPLE,
      lyricsText: AUTHORED,
      lyricsRevision: 4,
    })

    const stored = await loadLyricsFromDb(SESSION)
    expect(stored).toMatchObject({
      text: 'my own mapping',
      filename: 'The Build - Paper Boats.lrc',
      originalText: 'as it was seeded',
      fontSize: 1.8,
    })
    expect(await storedRows(SESSION)).toBe(1)
  })

  it('leaves a name the singer chose exactly as it is', async () => {
    await saveLyricsToDb(SESSION, {
      text: 'uploaded by hand',
      format: 'lrc',
      filename: 'my-karaoke-version.lrc',
    })
    serve({ ...EXAMPLE, lyricsText: AUTHORED })

    await seedDemoLyrics({ ...EXAMPLE, lyricsText: AUTHORED })

    expect((await loadLyricsFromDb(SESSION))?.filename).toBe(
      'my-karaoke-version.lrc',
    )
  })
})
