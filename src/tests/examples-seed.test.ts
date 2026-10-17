// ============================================================
// Seeding the Examples library — the write half
// ============================================================
//
// `examples-library.test.ts` covers the decisions. This covers what happens
// when they are carried out against a real store: that a second startup adds
// nothing, that a visitor's own sessions are untouched, and that the group
// ends up holding exactly the examples.

import { beforeEach, describe, expect, it, vi } from 'vitest'
// Type-only, so it is erased and cannot fight vi.mock's hoisting.
import type * as DemoSongModule from '@/features/karaoke-night/demo-song'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

const manifests = vi.hoisted(() => ({ current: [] as unknown[] }))
const seededLyrics = vi.hoisted(() => ({ slugs: [] as (string | undefined)[] }))
// Holds the manifest fetch open, so a test can call the seed while it runs.
const manifestGate = vi.hoisted(() => ({
  current: Promise.resolve() as Promise<void>,
}))

vi.mock('@/features/karaoke-night/demo-song', async (importOriginal) => {
  const actual = await importOriginal<typeof DemoSongModule>()
  return {
    ...actual,
    loadDemoSongs: async () => {
      await manifestGate.current
      return manifests.current
    },
    seedDemoLyrics: async (m: { slug?: string }) => {
      seededLyrics.slugs.push(m.slug)
    },
  }
})

import type { UvrSessionRecord } from '@/db/entities'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoSessionId } from '@/features/karaoke-night/demo-song'
import { EXAMPLES_GROUP_NAME, exampleSessionFrom, } from '@/features/karaoke-night/examples-library'
import { exampleCreditFor, resetExamplesSeedForTests, seedExamplesLibrary, } from '@/features/karaoke-night/seed-examples'
import { getAllUvrSessions, getGroups, importUvrSessionDurable, initGroupStore, initSessionStore, } from '@/stores/uvr-store'

function manifest(slug: string, over: Partial<DemoSongManifest> = {}) {
  return {
    slug,
    title: slug,
    artist: 'Josh Woodward',
    attribution: {
      text: 'Josh Woodward — CC BY 4.0',
      url: 'https://www.joshwoodward.com/',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    },
    stems: {
      vocal: `https://r2.example/demo/${slug}/vocal.m4a`,
      instrumental: `https://r2.example/demo/${slug}/instrumental.m4a`,
    },
    ...over,
  } satisfies DemoSongManifest
}

const exampleIds = () =>
  getAllUvrSessions()
    .map((s) => s.sessionId)
    .filter((id) => id.startsWith('karaoke-night-demo'))
    .sort()

describe('seedExamplesLibrary', () => {
  beforeEach(async () => {
    resetExamplesSeedForTests()
    seededLyrics.slugs = []
    manifests.current = [manifest('josephine'), manifest('karaoke-night')]
    await initGroupStore()
    await initSessionStore()
  })

  it('puts every published example in the session list', async () => {
    await seedExamplesLibrary()
    expect(exampleIds()).toEqual(
      [demoSessionId('josephine'), demoSessionId('karaoke-night')].sort(),
    )
  })

  it('points the rows at the R2 stems rather than downloading anything', async () => {
    await seedExamplesLibrary()
    const row = getAllUvrSessions().find(
      (s) => s.sessionId === demoSessionId('josephine'),
    )
    expect(row?.outputs?.vocal).toBe(
      'https://r2.example/demo/josephine/vocal.m4a',
    )
    expect(row?.status).toBe('completed')
  })

  it('collects them under one Examples group', async () => {
    await seedExamplesLibrary()
    const group = getGroups().find((g) => g.name === EXAMPLES_GROUP_NAME)
    expect(group?.sessionIds.sort()).toEqual(
      [demoSessionId('josephine'), demoSessionId('karaoke-night')].sort(),
    )
  })

  it('adds nothing the second time it runs', async () => {
    await seedExamplesLibrary()
    const before = exampleIds()
    const groupsBefore = getGroups().length

    resetExamplesSeedForTests()
    manifests.current = [manifest('josephine'), manifest('karaoke-night')]
    await seedExamplesLibrary()

    expect(exampleIds()).toEqual(before)
    expect(getGroups().length).toBe(groupsBefore)
    expect(
      getGroups().find((g) => g.name === EXAMPLES_GROUP_NAME)?.sessionIds,
    ).toHaveLength(2)
  })

  it('makes a second caller wait for the seed already running', async () => {
    // A song link stages the example's row, so it must not look before the
    // seed that creates the row has finished. The early-return this replaced
    // resolved the second call at once, with the row not yet written.
    manifests.current = [manifest('late-song')]
    let open!: () => void
    manifestGate.current = new Promise<void>((resolve) => {
      open = resolve
    })
    try {
      const first = seedExamplesLibrary()
      let secondDone = false
      const second = seedExamplesLibrary().then(() => {
        secondDone = true
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(secondDone).toBe(false)

      expect(exampleIds()).not.toContain(demoSessionId('late-song'))

      open()
      await second
      expect(exampleIds()).toContain(demoSessionId('late-song'))
      await first
    } finally {
      manifestGate.current = Promise.resolve()
    }
  })

  it('leaves sessions the visitor made themselves where they are', async () => {
    await importUvrSessionDurable({
      sessionId: 'my-own-song',
      status: 'completed',
      progress: 100,
      createdAt: Date.now(),
    })
    await seedExamplesLibrary()

    const mine = getAllUvrSessions().find((s) => s.sessionId === 'my-own-song')
    expect(mine?.groupId).toBeUndefined()
    expect(
      getGroups().find((g) => g.name === EXAMPLES_GROUP_NAME)?.sessionIds,
    ).not.toContain('my-own-song')
  })

  describe('rows named before the middle dot', () => {
    const nameOf = (id: string) =>
      getAllUvrSessions().find((s) => s.sessionId === id)?.originalFile?.name
    const storedName = async (id: string) => {
      const records = await adapter
        .getRepository<UvrSessionRecord>('uvrSessions')
        .findAll({})
      return records.find((r) => r.appSessionId === id)?.originalFileName
    }
    const seedRowNamed = async (slug: string, name: string) => {
      const song = manifest(slug)
      manifests.current = [song]
      const row = exampleSessionFrom(song, 0)
      await importUvrSessionDurable({
        ...row,
        originalFile: { ...row.originalFile!, name },
      })
      return demoSessionId(slug)
    }

    it('renames a row that still has the old default name, on disk too', async () => {
      const id = await seedRowNamed(
        'old-default',
        'Josh Woodward — old-default',
      )
      await seedExamplesLibrary()

      expect(nameOf(id)).toBe('Josh Woodward · old-default')
      await vi.waitFor(async () =>
        expect(await storedName(id)).toBe('Josh Woodward · old-default'),
      )
    })

    it('never renames a row the visitor gave a name of their own', async () => {
      const id = await seedRowNamed('their-name', 'Their favourite')
      await seedExamplesLibrary()

      expect(nameOf(id)).toBe('Their favourite')
      expect(await storedName(id)).toBe('Their favourite')
    })
  })

  it('seeds the lyrics through the path that protects an edited copy', async () => {
    await seedExamplesLibrary()
    expect(seededLyrics.slugs.sort()).toEqual(['josephine', 'karaoke-night'])
  })

  it('creates nothing when the studio has published nothing', async () => {
    // Measured as a delta: the store is a module singleton, so rows seeded by
    // the tests above are still here. What matters is that an empty list adds
    // no row and reaches no group creation — an outage must not manufacture an
    // empty Examples group on a fresh device.
    const rowsBefore = exampleIds()
    const groupsBefore = getGroups().length
    manifests.current = []
    await seedExamplesLibrary()

    expect(exampleIds()).toEqual(rowsBefore)
    expect(getGroups().length).toBe(groupsBefore)
  })

  it('exposes the credit each seeded song has to carry', async () => {
    await seedExamplesLibrary()
    expect(exampleCreditFor(demoSessionId('josephine'))?.license).toBe(
      'CC BY 4.0',
    )
    // A session that is not an example has no credit to show.
    expect(exampleCreditFor('my-own-song')).toBeNull()
  })

  it('never reads the native bundle on the web', async () => {
    // The native app seeds from the examples its bundle carries
    // (bundled-examples.ts); the web has no such file and must not ask.
    const asked: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        asked.push(String(input))
        return Promise.resolve(new Response('', { status: 404 }))
      }),
    )
    try {
      resetExamplesSeedForTests()
      await seedExamplesLibrary()
      expect(asked).not.toContain('/karaoke/examples/manifest.json')
      expect(exampleIds().length).toBeGreaterThan(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
