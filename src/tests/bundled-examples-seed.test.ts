// ============================================================
// The native app's first launch, with no network (audit K3)
// ============================================================
//
// The web app finds its examples on the server, so a phone that opened the
// Karaoke room for the first time on a plane had an empty library. The
// native app carries three songs in its bundle now (plan S8 §8, D13 A). This
// drives the real seed against a real session store and a real lyrics store,
// with a network that is not there and a bundle that answers the way a
// packaged file answers inside the iOS WebView: status 0, ok false, bytes.
// Then it goes online, and checks what the server may and may not change.
//
// Each test gets a fresh database and fresh modules: the stores are module
// singletons, and what a first launch sees is exactly the point.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const db = vi.hoisted(() => ({ adapter: null as unknown }))

vi.mock('@/db', () => ({
  getDb: async () => db.adapter,
}))

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_NATIVE_BUILD: true,
}))

vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  API_BASE_URL: 'https://api.example',
}))

interface BundledSong {
  slug: string
  title: string
  lyricsText: string
  durationSec: number
  stems: { vocal: string; instrumental: string }
}

const bundleBytes = readFileSync(
  resolve(
    process.cwd(),
    'apps/mercurypitch/native-only/karaoke/examples/manifest.json',
  ),
)
const bundle = JSON.parse(bundleBytes.toString('utf8')) as {
  songs: BundledSong[]
}

const net = {
  online: false,
  songs: [] as unknown[],
  asked: [] as string[],
}

/** What a packaged file looks like to `fetch` inside the iOS WebView. */
function packaged(bytes: Buffer) {
  return {
    ok: false,
    status: 0,
    headers: new Headers(),
    body: null,
    arrayBuffer: async () =>
      Promise.resolve(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
  }
}

const IDS = [
  'karaoke-night-demo',
  'karaoke-night-demo:josephine',
  'karaoke-night-demo:nothing-in-the-dark',
]

async function freshApp() {
  db.adapter = new InMemoryAdapter()
  vi.resetModules()
  const store = await import('@/stores/uvr-store')
  const seed = await import('@/features/karaoke-night/seed-examples')
  const demo = await import('@/features/karaoke-night/demo-song')
  const lyrics = await import('@/db/services/lyrics-db-service')
  await store.initGroupStore()
  await store.initSessionStore()
  const examples = () =>
    store
      .getAllUvrSessions()
      .filter((s) => s.sessionId.startsWith('karaoke-night-demo'))
      .sort((a, b) => a.createdAt - b.createdAt)
  return { store, seed, demo, lyrics, examples }
}

beforeEach(() => {
  localStorage.clear()
  net.online = false
  net.songs = []
  net.asked = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      net.asked.push(url)
      if (url === '/karaoke/examples/manifest.json') {
        return Promise.resolve(packaged(bundleBytes))
      }
      if (!net.online) throw new TypeError('Failed to fetch')
      if (url === 'https://api.example/api/demo-songs') {
        return Promise.resolve(
          new Response(JSON.stringify({ songs: net.songs }), { status: 200 }),
        )
      }
      return Promise.resolve(new Response('', { status: 404 }))
    }),
  )
})

describe('a first launch with no network', () => {
  it('has the three examples, playing from the bundle', async () => {
    const { seed, examples } = await freshApp()
    await seed.seedExamplesLibrary()

    const rows = examples()
    expect(rows.map((row) => row.sessionId)).toEqual(IDS)
    for (const [index, row] of rows.entries()) {
      const song = bundle.songs[index]
      expect(row.status).toBe('completed')
      expect(row.outputs?.vocal).toBe(song.stems.vocal)
      expect(row.outputs?.instrumental).toBe(song.stems.instrumental)
      expect(row.stemMeta?.vocal?.duration).toBe(song.durationSec)
    }
    // Nothing reached for R2: the only answers were the bundle's.
    expect(net.asked.filter((url) => url.includes('r2'))).toEqual([])
  })

  it('files them under Examples, each with its credit', async () => {
    const { seed, store } = await freshApp()
    await seed.seedExamplesLibrary()

    const group = store.getGroups().find((g) => g.name === 'Examples')
    expect([...(group?.sessionIds ?? [])].sort()).toEqual([...IDS].sort())
    const credit = seed.exampleCreditFor('karaoke-night-demo')
    expect(credit?.text).toBe('Music: "Goodbye to Spring" by Josh Woodward')
    expect(credit?.license).toBe('CC BY 4.0')
  })

  it('has their words', async () => {
    const { seed, lyrics } = await freshApp()
    await seed.seedExamplesLibrary()

    for (const [index, id] of IDS.entries()) {
      const stored = await lyrics.loadLyricsFromDb(id)
      expect(stored?.text, id).toBe(bundle.songs[index].lyricsText)
    }
  })

  it("finds a song's words in the bundle when the song is opened before the seed ran", async () => {
    // The stage asks by row id (`seedDemoLyricsForSession`); on the web that
    // asks the server, which here is not there.
    const { demo, lyrics } = await freshApp()
    await demo.seedDemoLyricsForSession('karaoke-night-demo:josephine')

    const stored = await lyrics.loadLyricsFromDb('karaoke-night-demo:josephine')
    expect(stored?.text).toBe(bundle.songs[1].lyricsText)
    expect(net.asked).not.toContain('https://api.example/api/demo-songs')
  })

  it('points a row an earlier build seeded with the R2 stems at the bundle', async () => {
    const { seed, store, examples } = await freshApp()
    await store.importUvrSessionDurable({
      sessionId: 'karaoke-night-demo:nothing-in-the-dark',
      status: 'completed',
      progress: 100,
      outputs: {
        vocal: 'https://r2.example/demo/nothing-in-the-dark/vocal.m4a',
        instrumental:
          'https://r2.example/demo/nothing-in-the-dark/instrumental.m4a',
      },
      provider: 'examples',
      createdAt: Date.UTC(2020, 0, 3),
    })
    await seed.seedExamplesLibrary()

    const row = examples().find(
      (s) => s.sessionId === 'karaoke-night-demo:nothing-in-the-dark',
    )
    expect(row?.outputs?.vocal).toBe(bundle.songs[2].stems.vocal)
    expect(row?.outputs?.instrumental).toBe(bundle.songs[2].stems.instrumental)
  })

  it("leaves a visitor's own song alone, even one with the same file names", async () => {
    const { seed, store } = await freshApp()
    await store.importUvrSessionDurable({
      sessionId: 'my-own-song',
      status: 'completed',
      progress: 100,
      outputs: { vocal: 'blob:mine-vocal', instrumental: 'blob:mine-inst' },
      createdAt: Date.now(),
    })
    await seed.seedExamplesLibrary()

    const mine = store.getUvrSession('my-own-song')
    expect(mine?.outputs?.vocal).toBe('blob:mine-vocal')
  })
})

describe('going online later', () => {
  const corrected = '[00:01.00] Corrected [00:02.00] words'

  function serverList() {
    return [
      {
        slug: 'karaoke-night',
        title: 'Goodbye to Spring',
        artist: 'Josh Woodward',
        attribution: {
          text: 'Music: "Goodbye to Spring" by Josh Woodward (corrected)',
          url: 'https://www.joshwoodward.com/song/GoodbyeToSpring',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
        stems: {
          vocal: 'https://r2.example/demo/goodbye-to-spring/vocal.m4a',
          instrumental:
            'https://r2.example/demo/goodbye-to-spring/instrumental.m4a',
        },
        lyricsRevision: 3,
        lyricsText: corrected,
      },
      {
        slug: 'brand-new',
        title: 'Brand New',
        artist: 'Josh Woodward',
        attribution: {
          text: 'Music: "Brand New" by Josh Woodward',
          url: 'https://www.joshwoodward.com/',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
        stems: {
          vocal: 'https://r2.example/demo/brand-new/vocal.m4a',
          instrumental: 'https://r2.example/demo/brand-new/instrumental.m4a',
        },
        lyricsRevision: 1,
        lyricsText: '[00:01.00] Brand new words',
      },
    ]
  }

  it('takes a correction and a new song, and keeps the stems in the bundle', async () => {
    const { seed, lyrics, examples, store } = await freshApp()
    await seed.seedExamplesLibrary()

    net.online = true
    net.songs = serverList()
    seed.resetExamplesSeedForTests()
    await seed.seedExamplesLibrary()

    const rows = examples()
    expect(rows.map((row) => row.sessionId)).toEqual([
      ...IDS,
      'karaoke-night-demo:brand-new',
    ])
    expect(rows[0].outputs?.vocal).toBe(bundle.songs[0].stems.vocal)
    expect(rows[3].outputs?.vocal).toBe(
      'https://r2.example/demo/brand-new/vocal.m4a',
    )
    expect((await lyrics.loadLyricsFromDb('karaoke-night-demo'))?.text).toBe(
      corrected,
    )
    expect(seed.exampleCreditFor('karaoke-night-demo')?.text).toBe(
      'Music: "Goodbye to Spring" by Josh Woodward (corrected)',
    )
    const group = store.getGroups().find((g) => g.name === 'Examples')
    expect(group?.sessionIds).toContain('karaoke-night-demo:brand-new')
  })

  it('seeds from the bundle first, even when the server answers', async () => {
    // The first launch is often online. The bundle still goes first, so the
    // library never waits on the network to have something in it.
    net.online = true
    net.songs = serverList()
    const { seed, examples } = await freshApp()
    await seed.seedExamplesLibrary()

    expect(net.asked.indexOf('/karaoke/examples/manifest.json')).toBeLessThan(
      net.asked.indexOf('https://api.example/api/demo-songs'),
    )
    expect(examples()[0].outputs?.vocal).toBe(bundle.songs[0].stems.vocal)
  })
})
