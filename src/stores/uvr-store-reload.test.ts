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
const manifests = vi.hoisted(() => ({
  current: null as DemoSongModule.DemoSongManifest[] | null,
}))

vi.mock('@/features/karaoke-night/demo-song', async (importOriginal) => {
  const actual = await importOriginal<typeof DemoSongModule>()
  return {
    ...actual,
    loadDemoSongs: async () => manifests.current ?? [corpus.example],
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
async function loadPage() {
  vi.resetModules()
  const store = await import('./uvr-store')
  const { seedExamplesLibrary } =
    await import('@/features/karaoke-night/seed-examples')
  void store.initSessionStore()
  void store.initGroupStore()
  await Promise.all([store.initSessionStore(), store.initGroupStore()])
  await seedExamplesLibrary()
  await settle()
  return store
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
  manifests.current = null
  localStorage.clear()
})

describe('restoring a retained web example', () => {
  it('refreshes legacy URLs while preserving edited lyrics, titles, and MIDI metadata', async () => {
    const legacyId = 'karaoke-night-demo'
    const stemMeta = {
      vocal: { duration: 201, size: 1234 },
      instrumental: { duration: 202, size: 2345 },
      vocalMidi: { duration: 203, size: 3456 },
    }
    const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    await repo.create({
      appSessionId: legacyId,
      userId: 'u1',
      status: 'completed',
      progress: 100,
      originalFileName: 'My example title',
      originalFileSize: 4567,
      originalFileType: 'audio/mpeg',
      processingMode: 'server',
      appCreatedAt: Date.UTC(2021, 2, 3),
      stemMetaJson: JSON.stringify(stemMeta),
    })
    const lyrics = await import('@/db/services/lyrics-db-service')
    await lyrics.saveLyricsToDbStrict(legacyId, {
      text: '[00:01.00]My edited words',
      format: 'lrc',
      filename: 'my-edit.lrc',
    })
    manifests.current = [
      {
        ...corpus.example,
        slug: 'karaoke-night',
        lyricsText: '[00:01.00]The published words',
        lyricsRevision: 99,
      },
    ]

    const store = await loadPage()
    const row = store.getUvrSession(legacyId)!
    expect(row.outputs).toEqual(corpus.example.stems)
    store.restoreUvrSessionOutputs(row, { vocalMidi: 'blob:generated-midi' })
    store.setCurrentUvrSession(store.getUvrSession(legacyId)!)

    // Another manifest fetch may correct remote addresses in this page.
    // Runtime URLs must not rewrite the canonical record or its metadata.
    const update = vi.spyOn(repo, 'update')
    const create = vi.spyOn(repo, 'create')
    const corrected = {
      vocal: 'https://r2.example/corrected/vocal.m4a',
      instrumental: 'https://r2.example/corrected/instrumental.m4a',
    }
    manifests.current = [{ ...manifests.current[0], stems: corrected }]
    const seed = await import('@/features/karaoke-night/seed-examples')
    seed.resetExamplesSeedForTests()
    await seed.seedExamplesLibrary()
    await settle()

    const restored = store.getUvrSession(legacyId)
    expect(restored).toMatchObject({
      originalFile: { name: 'My example title', size: 4567 },
      createdAt: Date.UTC(2021, 2, 3),
      stemMeta,
      outputs: { ...corrected, vocalMidi: 'blob:generated-midi' },
    })
    expect(restored?.provider).toBeUndefined()
    expect(store.currentUvrSession()).toEqual(restored)
    expect(update).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect((await lyrics.loadLyricsFromDb(legacyId))?.text).toBe(
      '[00:01.00]My edited words',
    )
  })

  it('uses a locally replaced vocal with the manifest instrumental after reload', async () => {
    await loadPage()
    const { saveStemBlobDurable } = await import('@/db/services/uvr-service')
    await saveStemBlobDurable(
      EXAMPLE_ID,
      'vocal',
      new Blob(['my vocal']),
      'my-vocal.wav',
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:my-local-vocal')

    const store = await loadPage()

    expect(store.getUvrSession(EXAMPLE_ID)?.outputs).toEqual({
      vocal: 'blob:my-local-vocal',
      instrumental: corpus.example.stems.instrumental,
    })
    expect(await onDisk(EXAMPLE_ID)).toBe(true)
  })

  it.each(['inventory', 'local vocal'])(
    'does not replace local work when reading %s fails',
    async (failure) => {
      await loadPage()
      const { saveStemBlobDurable } = await import('@/db/services/uvr-service')
      await saveStemBlobDurable(
        EXAMPLE_ID,
        'vocal',
        new Blob(['my vocal']),
        'my-vocal.wav',
      )
      const stems = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
      const read = stems.findAll.bind(stems)
      const failed = vi
        .spyOn(stems, 'findAll')
        .mockImplementation(async (options) => {
          if (failure === 'inventory' || options?.where?.stemType === 'vocal')
            throw new Error('Storage read failed')
          return read(options)
        })

      const store = await loadPage()

      expect(store.getUvrSession(EXAMPLE_ID)?.outputs).toBeUndefined()
      expect(await onDisk(EXAMPLE_ID)).toBe(true)
      failed.mockRestore()
      expect(await read({ where: { sessionId: EXAMPLE_ID } })).toHaveLength(1)
    },
  )

  it.each(['delete', 'replace stems'])(
    'does not undo a visitor action during hydration: %s',
    async (action) => {
      manifests.current = [{ ...corpus.example, lyricsText: '[00:01.00]Words' }]
      await loadPage()
      const { saveStemBlobDurable } = await import('@/db/services/uvr-service')
      await saveStemBlobDurable(
        EXAMPLE_ID,
        'vocal',
        new Blob(['old vocal']),
        'old-vocal.wav',
      )
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale-vocal')
      const revoke = vi.spyOn(URL, 'revokeObjectURL')
      const stems = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
      const read = stems.findAll.bind(stems)
      let release: (() => void) | undefined
      let delayed = false
      vi.spyOn(stems, 'findAll').mockImplementation(async (options) => {
        const rows = await read(options)
        if (
          !delayed &&
          options?.where?.sessionId === EXAMPLE_ID &&
          options.where.stemType === 'vocal'
        ) {
          delayed = true
          await new Promise<void>((resolve) => {
            release = resolve
          })
        }
        return rows
      })
      const loading = loadPage()
      await vi.waitFor(() => expect(release).toBeDefined())
      const store = await import('./uvr-store')
      const replacement = {
        vocal: 'blob:new-vocal',
        instrumental: 'blob:new-instrumental',
      }
      if (action === 'delete') {
        expect(await store.deleteUvrSession(EXAMPLE_ID)).toBe(true)
      } else {
        expect(await store.completeUvrSession(EXAMPLE_ID, replacement)).toBe(
          true,
        )
      }
      release!()
      await loading
      expect(revoke).toHaveBeenCalledWith('blob:stale-vocal')

      if (action === 'delete') {
        expect(store.getUvrSession(EXAMPLE_ID)).toBeUndefined()
        expect(await onDisk(EXAMPLE_ID)).toBe(false)
        const { loadLyricsFromDb } =
          await import('@/db/services/lyrics-db-service')
        expect(await loadLyricsFromDb(EXAMPLE_ID)).toBeNull()
        expect(
          store.getGroups().flatMap((group) => group.sessionIds),
        ).not.toContain(EXAMPLE_ID)
      } else {
        expect(store.getUvrSession(EXAMPLE_ID)?.outputs).toEqual(replacement)
      }
    },
  )
})

describe.each([
  // Which of the two boot reads lands first decides what the bug looked
  // like: a row missing from disk, or a song missing from the list.
  ['the stem check answers before the song list is read', false],
  ['the song list is read before the stem check answers', true],
])('the shipped example across page loads, when %s', (_order, slowStems) => {
  it('is listed, kept on disk, and playable after every one of four loads', async () => {
    if (slowStems) {
      const stems = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
      const read = stems.findAll.bind(stems)
      vi.spyOn(stems, 'findAll').mockImplementation(async (options) => {
        await turn()
        return read(options)
      })
    }

    const seen: Array<{
      listed: boolean
      onDisk: boolean
      vocal: string | undefined
      instrumental: string | undefined
    }> = []
    for (let load = 0; load < 4; load++) {
      const store = await loadPage()
      const session = store.getUvrSession(EXAMPLE_ID)
      const { ensureSessionHydrated } =
        await import('@/features/stem-mixer/karaoke-playlist-runner')
      const hydrated =
        session === undefined ? undefined : await ensureSessionHydrated(session)
      seen.push({
        listed: session !== undefined,
        onDisk: await onDisk(EXAMPLE_ID),
        vocal: hydrated?.outputs?.vocal,
        instrumental: hydrated?.outputs?.instrumental,
      })
    }

    expect(seen).toEqual(
      Array.from({ length: 4 }, () => ({
        listed: true,
        onDisk: true,
        ...corpus.example.stems,
      })),
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

    const store = await loadPage()
    const listed = store.getAllUvrSessions().map((s) => s.sessionId)

    expect(listed).toContain(EXAMPLE_ID)
    expect(listed).not.toContain('lost-stems')
    expect(await onDisk('lost-stems')).toBe(false)
  })

  it('keeps an example an older build seeded without the provider stamp', async () => {
    // Recognised by its demo session id alone, as the Karaoke features
    // recognise it. Pruned, it would vanish until the next seed.
    const legacyId = 'karaoke-night-demo:older-song'
    await adapter.getRepository<UvrSessionRecord>('uvrSessions').create({
      appSessionId: legacyId,
      userId: 'u1',
      status: 'completed',
      progress: 100,
      originalFileName: 'Someone — Older song',
      originalFileSize: 0,
      originalFileType: 'audio/mpeg',
      processingMode: 'server',
      appCreatedAt: Date.UTC(2020, 0, 1),
    } as never)

    const store = await loadPage()
    const listed = store.getAllUvrSessions().map((s) => s.sessionId)

    expect(listed).toContain(legacyId)
    expect(await onDisk(legacyId)).toBe(true)
  })
})
