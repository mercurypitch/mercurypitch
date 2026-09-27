// ============================================================
// The singer's own songs on this phone, counted and removed together
// ============================================================
//
// Settings, Karaoke and Storage both say how many there are and how much of
// the phone their voice and music take, and both remove them all (plan S8
// §9, §10). The examples are part of the app: never counted, never removed.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type { UvrSession } from '@/stores/uvr-store'

const sources = vi.hoisted(() => ({
  sessions: [] as UvrSession[],
  manifests: [] as DemoSongManifest[],
  removed: [] as string[],
  stuck: new Set<string>(),
}))

vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => sources.sessions,
}))
vi.mock('@/features/karaoke-night/seed-examples', () => ({
  exampleManifests: () => sources.manifests,
}))
vi.mock('@/features/stem-mixer/karaoke-playlist-runner', () => ({
  ensureSessionHydrated: vi.fn(),
}))
vi.mock('./karaoke-import-queue', () => ({
  removeImportedSong: vi.fn(async (id: string) => {
    sources.removed.push(id)
    return Promise.resolve(!sources.stuck.has(id))
  }),
}))

import { importedSongs, removeAllImportedSongs } from './karaoke-imported-songs'

const GOODBYE: DemoSongManifest = {
  slug: 'karaoke-night',
  title: 'Goodbye to Spring',
  artist: 'Josh Woodward',
  attribution: {
    text: 'Music: "Goodbye to Spring" by Josh Woodward',
    url: 'https://example.invalid/song',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  stems: {
    vocal: '/karaoke/examples/goodbye-to-spring/vocal.m4a',
    instrumental: '/karaoke/examples/goodbye-to-spring/instrumental.m4a',
  },
  durationSec: 246,
}

const example: UvrSession = {
  sessionId: 'karaoke-night-demo',
  status: 'completed',
  progress: 100,
  originalFile: {
    name: 'Goodbye to Spring.mp3',
    size: 0,
    mimeType: 'audio/mpeg',
  },
  outputs: { vocal: '/v.m4a', instrumental: '/i.m4a' },
  stemMeta: { vocal: { size: 5_000_000 }, instrumental: { size: 5_000_000 } },
  provider: 'examples',
  createdAt: 1,
}

const own = (
  sessionId: string,
  stems: [number | undefined, number | undefined],
  over: Partial<UvrSession> = {},
): UvrSession => ({
  sessionId,
  status: 'completed',
  progress: 100,
  // The original's size is what was sent. It left the phone once the song
  // was ready, so it is never counted.
  originalFile: {
    name: `${sessionId}.mp3`,
    size: 8_000_000,
    mimeType: 'audio/mpeg',
  },
  outputs: {
    vocal: `blob:${sessionId}-v`,
    instrumental: `blob:${sessionId}-i`,
  },
  stemMeta: {
    vocal: { duration: 200, size: stems[0] },
    instrumental: { duration: 200, size: stems[1] },
  },
  createdAt: 10,
  ...over,
})

beforeEach(() => {
  sources.sessions = []
  sources.manifests = [GOODBYE]
  sources.removed = []
  sources.stuck = new Set()
})

describe('the songs of your own on this phone', () => {
  it('are counted with the size of their voice and music, the examples left out', () => {
    sources.sessions = [
      example,
      own('harbour', [4_200_000, 6_100_000]),
      own('salt', [3_900_000, 5_800_000]),
      // On its way, not yet a song.
      own('long', [undefined, undefined], {
        status: 'processing',
        outputs: {},
      }),
    ]

    expect(importedSongs()).toEqual({ count: 2, bytes: 20_000_000 })
  })

  it('say nothing of a size one of them never recorded, rather than a smaller one', () => {
    sources.sessions = [
      own('harbour', [4_200_000, 6_100_000]),
      own('salt', [3_900_000, undefined]),
    ]

    expect(importedSongs()).toEqual({ count: 2, bytes: null })
  })

  it('are none on a phone with only the examples', () => {
    sources.sessions = [example]

    expect(importedSongs()).toEqual({ count: 0, bytes: 0 })
  })

  it('are removed together, and the examples stay', async () => {
    sources.sessions = [
      example,
      own('harbour', [4_200_000, 6_100_000]),
      own('salt', [3_900_000, 5_800_000]),
    ]

    const stuck = await removeAllImportedSongs()

    expect(sources.removed.sort()).toEqual(['harbour', 'salt'])
    expect(stuck).toBe(0)
  })

  it('say how many could not be removed', async () => {
    sources.sessions = [
      own('harbour', [4_200_000, 6_100_000]),
      own('salt', [3_900_000, 5_800_000]),
    ]
    sources.stuck = new Set(['salt'])

    expect(await removeAllImportedSongs()).toBe(1)
  })
})
