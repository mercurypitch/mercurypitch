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

vi.mock('@/features/karaoke-night/demo-song', async (importOriginal) => {
  const actual = await importOriginal<typeof DemoSongModule>()
  return {
    ...actual,
    loadDemoSongs: async () => manifests.current,
    seedDemoLyrics: async (m: { slug?: string }) => {
      seededLyrics.slugs.push(m.slug)
    },
  }
})

import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoSessionId } from '@/features/karaoke-night/demo-song'
import { EXAMPLES_GROUP_NAME } from '@/features/karaoke-night/examples-library'
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
})
