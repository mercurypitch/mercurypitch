// ============================================================
// The room's library after the app starts again
// ============================================================
//
// maff, 25 Oct 2026, on a phone: songs separated in the Karaoke room played
// until the app restarted or was updated. Then only the examples were
// listed, and importing one of the songs again said it was already in the
// library, with no way to open it.
//
// A song's stem URLs are object URLs, minted by the page that saved the
// stems. The session's row on disk does not keep them (uvr-store's
// sessionToDbRecord has no `outputs`), so every launch reads its sessions
// back without URLs, while the stems themselves are still on disk. One
// launch cannot show that; two launches over one database can.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

// The database outlives every launch, as IndexedDB outlives the app.
const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({ getDb: async () => adapter }))

// The singer's own songs are what this is about: no examples.
vi.mock('@/features/karaoke-night/seed-examples', () => ({
  exampleManifests: () => [],
}))

// The send itself is not under test, and the real pipeline loads the
// separator's model code.
vi.mock('@/lib/uvr-processing-pipeline', () => ({
  resumeServerSession: vi.fn(),
  runUvrPipeline: vi.fn(),
}))

const SIZE = 1024

/** A zero-length timer: one turn of the event loop. */
const turn = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/** One launch of the app: fresh modules, the same disk. Waits out the boot
 *  work nothing awaits (the prune of songs whose stems are gone). */
async function launch() {
  vi.resetModules()
  const store = await import('@/stores/uvr-store')
  await store.initSessionStore()
  for (let i = 0; i < 10; i++) await turn()
  const library = await import('./karaoke-room-library')
  const queue = await import('./karaoke-import-queue')
  const service = await import('@/db/services/uvr-service')
  return { store, library, queue, service }
}

type Launch = Awaited<ReturnType<typeof launch>>

/** A song the server separated and the phone saved, as the import queue
 *  leaves it: a job id, both stems on disk, then completed. */
async function separate(app: Launch, name: string): Promise<string> {
  const id = app.store.startUvrSession(
    name,
    SIZE,
    'audio/mpeg',
    'separate',
    'server',
    undefined,
    false,
  )
  await app.store.setUvrSessionApiIdDurable(id, `job-${name}`)
  const vocal = new Blob(['vocal'], { type: 'audio/mp4' })
  const music = new Blob(['music'], { type: 'audio/mp4' })
  await app.service.saveStemBlobDurable(id, 'vocal', vocal, 'vocal.m4a')
  await app.service.saveStemBlobDurable(id, 'instrumental', music, 'music.m4a')
  await app.store.completeUvrSession(
    id,
    {
      vocal: URL.createObjectURL(vocal),
      instrumental: URL.createObjectURL(music),
    },
    { vocal: { duration: 201 }, instrumental: { duration: 201 } },
  )
  return id
}

const yours = (app: Launch): string[] =>
  app.library
    .roomLibrary()
    .filter((song) => song.kind === 'yours')
    .map((song) => song.sessionId)

beforeEach(async () => {
  await adapter.destroy()
  localStorage.clear()
})

describe('a song separated on this phone, after the app starts again', () => {
  it('is still in the library', async () => {
    const first = await launch()
    const id = await separate(first, 'My Song.mp3')
    expect(yours(first)).toEqual([id])

    const second = await launch()

    expect(yours(second)).toEqual([id])
    expect(second.library.roomLibrary()[0]).toMatchObject({
      title: 'My Song',
      durationSec: 201,
    })
  })

  it('plays from the stems on this phone', async () => {
    const first = await launch()
    await separate(first, 'My Song.mp3')

    const second = await launch()
    const [song] = second.library.roomLibrary()
    const stems = await second.library.hydrateSong(song)

    expect(stems.vocal).not.toBe('')
    expect(stems.instrumental).not.toBe('')
  })

  it('is the song Import calls already yours', async () => {
    const first = await launch()
    const id = await separate(first, 'My Song.mp3')

    const second = await launch()
    const again = new File([new Uint8Array(SIZE)], 'My Song.mp3', {
      type: 'audio/mpeg',
    })

    expect(second.queue.duplicateOf(again)?.title).toBe(
      'My Song is already in your songs',
    )
    expect(yours(second)).toEqual([id])
  })
})
