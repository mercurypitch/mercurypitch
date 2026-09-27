// ============================================================
// The room's library: songs named as songs, in one list (plan S8 §3, K7)
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type { UvrSession } from '@/stores/uvr-store'

const sources = vi.hoisted(() => ({
  sessions: [] as UvrSession[],
  manifests: [] as DemoSongManifest[],
}))

vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => sources.sessions,
}))

vi.mock('@/features/karaoke-night/seed-examples', () => ({
  exampleManifests: () => sources.manifests,
}))

const hydration = vi.hoisted(() => ({
  ensureSessionHydrated: vi.fn(async (session: UvrSession) =>
    Promise.resolve({
      ...session,
      outputs: {
        vocal: `blob:fresh-${session.sessionId}-vocal`,
        instrumental: `blob:fresh-${session.sessionId}-instrumental`,
      },
    }),
  ),
}))

vi.mock('@/features/stem-mixer/karaoke-playlist-runner', () => hydration)

import { exampleCredit, hydrateSong, roomLibrary } from './karaoke-room-library'

const manifest = (
  slug: string,
  title: string,
  dir: string,
  durationSec: number,
): DemoSongManifest => ({
  slug,
  title,
  artist: 'Josh Woodward',
  attribution: {
    text: `Music: "${title}" by Josh Woodward`,
    url: 'https://example.invalid/song',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  stems: {
    vocal: `/karaoke/examples/${dir}/vocal.m4a`,
    instrumental: `/karaoke/examples/${dir}/instrumental.m4a`,
  },
  durationSec,
})

const GOODBYE = manifest(
  'karaoke-night',
  'Goodbye to Spring',
  'goodbye-to-spring',
  246,
)
const JOSEPHINE = manifest(
  'josephine',
  "I'll Be Right Behind You, Josephine",
  'josephine',
  258,
)

/** The row the seed makes for an example: named as a file, as the web does. */
const seededRow = (sessionId: string, name: string): UvrSession => ({
  sessionId,
  status: 'completed',
  progress: 100,
  originalFile: { name, size: 0, mimeType: 'audio/mpeg' },
  outputs: {
    vocal: 'https://example.invalid/old/vocal.mp3',
    instrumental: 'https://example.invalid/old/instrumental.mp3',
  },
  provider: 'examples',
  createdAt: Date.UTC(2020, 0, 1),
})

const own = (
  sessionId: string,
  name: string,
  createdAt: number,
  over: Partial<UvrSession> = {},
): UvrSession => ({
  sessionId,
  status: 'completed',
  progress: 100,
  originalFile: { name, size: 1, mimeType: 'audio/mpeg' },
  outputs: {
    vocal: `blob:${sessionId}-vocal`,
    instrumental: `blob:${sessionId}-instrumental`,
  },
  stemMeta: { vocal: { duration: 201 } },
  createdAt,
  ...over,
})

beforeEach(() => {
  sources.sessions = []
  sources.manifests = [GOODBYE, JOSEPHINE]
  hydration.ensureSessionHydrated.mockClear()
})

describe('the examples', () => {
  it('are named by title and artist, never the file, and carry their credit', () => {
    sources.sessions = [
      seededRow('karaoke-night-demo', 'Josh Woodward — Goodbye to Spring'),
    ]

    const [first] = roomLibrary()

    expect(first).toEqual({
      sessionId: 'karaoke-night-demo',
      title: 'Goodbye to Spring',
      artist: 'Josh Woodward',
      durationSec: 246,
      credit: 'Josh Woodward · CC BY 4.0',
      kind: 'example',
      stems: {
        vocal: '/karaoke/examples/goodbye-to-spring/vocal.m4a',
        instrumental: '/karaoke/examples/goodbye-to-spring/instrumental.m4a',
      },
    })
  })

  it('are listed once, not again as songs of your own', () => {
    sources.sessions = [
      seededRow('karaoke-night-demo', 'Josh Woodward — Goodbye to Spring'),
      seededRow('karaoke-night-demo:josephine', 'Josh Woodward — Josephine'),
    ]

    expect(roomLibrary().map((song) => song.sessionId)).toEqual([
      'karaoke-night-demo',
      'karaoke-night-demo:josephine',
    ])
  })

  it('leave out one with a stem missing', () => {
    sources.manifests = [
      GOODBYE,
      { ...JOSEPHINE, stems: { vocal: JOSEPHINE.stems.vocal } },
    ]

    expect(roomLibrary().map((song) => song.title)).toEqual([
      'Goodbye to Spring',
    ])
  })

  it('credit the artist alone when there is no licence to name', () => {
    expect(
      exampleCredit({
        ...GOODBYE,
        attribution: { ...GOODBYE.attribution, license: '' },
      }),
    ).toBe('Josh Woodward')
  })
})

describe('your songs', () => {
  it('come first, newest first, then the examples in the bundle order', () => {
    sources.sessions = [
      own('older', 'Older song.mp3', 1_000),
      seededRow('karaoke-night-demo', 'Josh Woodward — Goodbye to Spring'),
      own('newer', 'Newer song.flac', 2_000),
    ]

    expect(roomLibrary().map((song) => song.sessionId)).toEqual([
      'newer',
      'older',
      'karaoke-night-demo',
      'karaoke-night-demo:josephine',
    ])
  })

  it('are titled by the file name without its extension, with their length', () => {
    sources.sessions = [own('mine', 'My Song.mp3', 1_000)]

    const [mine] = roomLibrary()

    expect(mine.title).toBe('My Song')
    expect(mine.artist).toBeNull()
    expect(mine.credit).toBeNull()
    expect(mine.durationSec).toBe(201)
    expect(mine.kind).toBe('yours')
  })

  it('leave out a song still separating, and one that lost a stem', () => {
    sources.sessions = [
      own('separating', 'Busy.mp3', 3_000, {
        status: 'processing',
        progress: 40,
      }),
      own('half', 'Half.mp3', 2_000, {
        outputs: { vocal: 'blob:half-vocal' },
      }),
      own('whole', 'Whole.mp3', 1_000),
    ]

    expect(
      roomLibrary()
        .filter((song) => song.kind === 'yours')
        .map((song) => song.sessionId),
    ).toEqual(['whole'])
  })
})

describe('hydrating a song', () => {
  it("plays an example's packaged files as they are", async () => {
    const [goodbye] = roomLibrary()

    expect(await hydrateSong(goodbye)).toEqual(goodbye.stems)
    expect(hydration.ensureSessionHydrated).not.toHaveBeenCalled()
  })

  it('mints the stems of your own song again', async () => {
    sources.sessions = [own('mine', 'My Song.mp3', 1_000)]
    const [mine] = roomLibrary()

    expect(await hydrateSong(mine)).toEqual({
      vocal: 'blob:fresh-mine-vocal',
      instrumental: 'blob:fresh-mine-instrumental',
    })
  })
})
