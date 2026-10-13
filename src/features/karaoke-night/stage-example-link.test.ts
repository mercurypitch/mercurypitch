// ============================================================
// Staging an example from a song link — against a real store
// ============================================================
//
// REQ-SKL-012. Each "page" is a fresh module graph over one database, the
// way a visitor's IndexedDB outlives every load (same harness as
// uvr-store-reload.test.ts). Karaoke Night never seeds the examples on its
// own, so a first visit has no row: the link has to wait for the seed it
// starts, then stage what a manual pick of that row would stage.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
// Type-only, so it is erased and cannot fight vi.mock's hoisting.
import type * as DemoSongModule from '@/features/karaoke-night/demo-song'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({ getDb: async () => adapter }))

const corpus = vi.hoisted(() => ({
  example: {
    slug: 'nothing-in-the-dark',
    title: 'Nothing in the Dark',
    artist: 'Josh Woodward',
    attribution: {
      text: 'Josh Woodward, CC BY 4.0',
      url: 'https://www.joshwoodward.com/',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    stems: {
      vocal: 'https://r2.example/demo/nothing-in-the-dark/vocal.m4a',
      instrumental:
        'https://r2.example/demo/nothing-in-the-dark/instrumental.m4a',
    },
    lyricsText: '[00:01.00]The published words',
    lyricsRevision: 1,
  },
}))

vi.mock('@/features/karaoke-night/demo-song', async (importOriginal) => {
  const actual = await importOriginal<typeof DemoSongModule>()
  return { ...actual, loadDemoSongs: async () => [corpus.example] }
})

const EXAMPLE_ID = 'karaoke-night-demo:nothing-in-the-dark'
const NO_LAUNCH = { autoplay: false, startAtSec: null }

/** A fresh page: new modules, same disk. Nothing seeded, as on Karaoke Night. */
async function freshPage() {
  vi.resetModules()
  const store = await import('@/stores/uvr-store')
  const { exampleSongFromLink } = await import('./stage-example-link')
  return { store, exampleSongFromLink }
}

/** A page of the studio, which seeds the examples at boot. */
async function studioVisit() {
  vi.resetModules()
  const store = await import('@/stores/uvr-store')
  const { seedExamplesLibrary } = await import('./seed-examples')
  await Promise.all([store.initSessionStore(), store.initGroupStore()])
  await seedExamplesLibrary()
  return store
}

async function rowOnDisk(): Promise<boolean> {
  const rows = await adapter
    .getRepository<UvrSessionRecord>('uvrSessions')
    .findAll({ where: { appSessionId: EXAMPLE_ID } })
  return rows.length > 0
}

beforeEach(async () => {
  await adapter.destroy()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('exampleSongFromLink', () => {
  it('stages the example on a first visit, once the seed has written its row', async () => {
    expect(await rowOnDisk()).toBe(false)
    const { store, exampleSongFromLink } = await freshPage()

    const song = await exampleSongFromLink(corpus.example, NO_LAUNCH)

    expect(song).toEqual({
      sessionId: EXAMPLE_ID,
      title: 'Josh Woodward — Nothing in the Dark',
      stems: corpus.example.stems,
      autoPlay: false,
      initialSeekSec: undefined,
    })
    // The row the song came from is real, so the next pick finds it too.
    expect(store.getUvrSession(EXAMPLE_ID)?.provider).toBe('examples')
    expect(await rowOnDisk()).toBe(true)
  })

  it('stages a replaced vocal rather than the published one', async () => {
    await studioVisit()
    const { saveStemBlobDurable } = await import('@/db/services/uvr-service')
    await saveStemBlobDurable(
      EXAMPLE_ID,
      'vocal',
      new Blob(['my vocal']),
      'my-vocal.wav',
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:my-local-vocal')

    const { exampleSongFromLink } = await freshPage()
    const song = await exampleSongFromLink(corpus.example, NO_LAUNCH)

    expect(song.stems).toEqual({
      vocal: 'blob:my-local-vocal',
      instrumental: corpus.example.stems.instrumental,
    })
  })

  it('keeps edited lyrics and an edited title', async () => {
    await studioVisit()
    const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    const [record] = await repo.findAll({
      where: { appSessionId: EXAMPLE_ID },
    })
    await repo.update(record.id, { originalFileName: 'My night song' })
    const lyrics = await import('@/db/services/lyrics-db-service')
    await lyrics.saveLyricsToDbStrict(EXAMPLE_ID, {
      text: '[00:01.00]My own words',
      format: 'lrc',
      filename: 'mine.lrc',
    })

    const { exampleSongFromLink } = await freshPage()
    const song = await exampleSongFromLink(corpus.example, NO_LAUNCH)

    expect(song.title).toBe('My night song')
    expect((await lyrics.loadLyricsFromDb(EXAMPLE_ID))?.text).toBe(
      '[00:01.00]My own words',
    )
  })

  it('brings back an example the visitor deleted, as the studio does', async () => {
    const studio = await studioVisit()
    expect(await studio.deleteUvrSession(EXAMPLE_ID)).toBe(true)
    expect(await rowOnDisk()).toBe(false)

    const { exampleSongFromLink } = await freshPage()
    const song = await exampleSongFromLink(corpus.example, NO_LAUNCH)

    expect(song.sessionId).toBe(EXAMPLE_ID)
    expect(song.stems).toEqual(corpus.example.stems)
    expect(await rowOnDisk()).toBe(true)
  })

  it('falls back to the published stems when no row can be written', async () => {
    // A private window or a full disk: the seed fails quietly, the link
    // must still sing.
    vi.spyOn(
      adapter.getRepository<UvrSessionRecord>('uvrSessions'),
      'create',
    ).mockRejectedValue(new Error('QuotaExceededError'))
    const { exampleSongFromLink } = await freshPage()

    const song = await exampleSongFromLink(corpus.example, NO_LAUNCH)

    expect(song).toEqual({
      sessionId: EXAMPLE_ID,
      title: 'Nothing in the Dark — Josh Woodward',
      stems: corpus.example.stems,
      autoPlay: false,
      initialSeekSec: undefined,
    })
  })

  it('carries the start position and autoplay of the launch contract', async () => {
    const { exampleSongFromLink } = await freshPage()
    const song = await exampleSongFromLink(corpus.example, {
      autoplay: true,
      startAtSec: 42,
    })
    expect(song.autoPlay).toBe(true)
    expect(song.initialSeekSec).toBe(42)
  })
})
