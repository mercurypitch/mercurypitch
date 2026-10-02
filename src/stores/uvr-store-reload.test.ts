// The shipped example song stays in the library from one page load to the next.
//
// Each load runs the boot prune, which deletes a completed session whose stems
// are not on disk. An example never has its stems on disk: they stream from
// R2. So a load that found the example pruned it, the next load seeded it
// again, and it came and went on alternate reloads. One load cannot show that;
// a run of them, over one database, can.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord, UvrStemBlob } from '@/db/entities'
// Type-only, so it is erased and cannot fight vi.mock's hoisting.
import type * as DemoSongModule from '@/features/karaoke-night/demo-song'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

// The database outlives every load, as IndexedDB outlives a page.
const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({ getDb: async () => adapter }))

const corpus = vi.hoisted(() => ({
  example: {
    slug: 'josephine',
    title: 'Josephine',
    artist: 'Josh Woodward',
    attribution: {
      text: 'Josh Woodward, CC BY 4.0',
      url: 'https://www.joshwoodward.com/',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    stems: {
      vocal: 'https://r2.example/demo/josephine/vocal.m4a',
      instrumental: 'https://r2.example/demo/josephine/instrumental.m4a',
    },
  },
}))

vi.mock('@/features/karaoke-night/demo-song', async (importOriginal) => {
  const actual = await importOriginal<typeof DemoSongModule>()
  return {
    ...actual,
    loadDemoSongs: async () => [corpus.example],
    seedDemoLyrics: async () => {},
  }
})

const EXAMPLE_ID = 'karaoke-night-demo:josephine'

/** A zero-length timer: one turn of the event loop. */
const turn = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/** Lets boot work nothing awaits (the prune) run to completion. Every delay
 *  in play is a zero-length timer, so a few turns drain them all. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await turn()
}

/** One page load, booted the way App.tsx boots: fresh modules, same disk. */
async function loadPage(): Promise<string[]> {
  vi.resetModules()
  const store = await import('./uvr-store')
  const { seedExamplesLibrary } =
    await import('@/features/karaoke-night/seed-examples')
  void store.initSessionStore()
  void store.initGroupStore()
  await Promise.all([store.initSessionStore(), store.initGroupStore()])
  await seedExamplesLibrary()
  await settle()
  return store.getAllUvrSessions().map((s) => s.sessionId)
}

async function onDisk(sessionId: string): Promise<boolean> {
  const rows = await adapter
    .getRepository<UvrSessionRecord>('uvrSessions')
    .findAll({ where: { appSessionId: sessionId } })
  return rows.length > 0
}

beforeEach(async () => {
  await adapter.destroy()
  vi.restoreAllMocks()
})

describe.each([
  // Which of the two boot reads lands first decides what the bug looked
  // like: a row missing from disk, or a song missing from the list.
  ['the stem check answers before the song list is read', false],
  ['the song list is read before the stem check answers', true],
])('the shipped example across page loads, when %s', (_order, slowStems) => {
  it('is listed, and kept on disk, after every one of four loads', async () => {
    if (slowStems) {
      const stems = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
      const read = stems.findAll.bind(stems)
      vi.spyOn(stems, 'findAll').mockImplementation(async (options) => {
        await turn()
        return read(options)
      })
    }

    const seen: Array<{ listed: boolean; onDisk: boolean }> = []
    for (let load = 0; load < 4; load++) {
      const listed = (await loadPage()).includes(EXAMPLE_ID)
      seen.push({ listed, onDisk: await onDisk(EXAMPLE_ID) })
    }

    expect(seen).toEqual(
      Array.from({ length: 4 }, () => ({ listed: true, onDisk: true })),
    )
  })
})

describe('the boot prune, with the example kept', () => {
  it('still removes a song of the visitor whose stems were lost', async () => {
    // Everything that is not an example, the prune is right about: a
    // completed separation with nothing on disk can never open.
    await adapter.getRepository<UvrSessionRecord>('uvrSessions').create({
      appSessionId: 'lost-stems',
      userId: 'u1',
      status: 'completed',
      progress: 100,
      originalFileName: 'mine.mp3',
      originalFileSize: 1024,
      originalFileType: 'audio/mpeg',
      processingMode: 'server',
      appCreatedAt: Date.parse('2026-09-01T10:00:00.000Z'),
    } as never)

    const listed = await loadPage()

    expect(listed).toContain(EXAMPLE_ID)
    expect(listed).not.toContain('lost-stems')
    expect(await onDisk('lost-stems')).toBe(false)
  })
})
