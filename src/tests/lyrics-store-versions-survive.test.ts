// ── A song's other versions survive the writers that are not the mixer ──
//
// Owner report (2026-09-19): the Original / Edited buttons "disappeared
// completely" after a while. The buttons are a reading of the stored
// versions, so something had stored a record without them.
//
// The store replaces a whole record on every save, and two writers build
// theirs from less than the whole: an authored correction reaching an
// example (it looked only at the active text, so an Edited version kept
// beside an untouched Original went with it), and any two saves that
// overlap (create-then-delete leaves both rows, and a read took whichever
// came first).
//
// Drives the real store: every one of these was a gap between modules that
// were each correct alone.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/db'
import type { UvrSessionLyrics } from '@/db/entities'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import { loadLyricsFromDb, renameLyricsInDb, saveLyricsToDb, } from '@/db/services/lyrics-db-service'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoLyricsFilename, demoSessionId, seedDemoLyrics, } from '@/features/karaoke-night/demo-song'
import { withLrcTimingMetadata } from '@/lib/lrc-timing-metadata'

const SEEDED = '[00:01.00] Lantern under\n[00:07.00] Paper boats'
const CORRECTED = '[00:01.20] Lantern under\n[00:07.10] Paper boats'
const MINE = '[00:01.45] Lantern, under\n[00:07.30] Paper boats'
// An end mark on the first word, the way the studio publishes them.
const CORRECTED_WITH_ENDS = withLrcTimingMetadata(CORRECTED, {
  wordEndTimings: { 0: [1.5] },
  wordSweepTimings: {},
})

const BASE: DemoSongManifest = {
  title: 'Paper Boats',
  artist: 'The Build',
  attribution: { text: '', url: '', license: '', licenseUrl: '' },
  stems: {
    vocal: 'https://r2.test/demo/example/vocal.m4a',
    instrumental: 'https://r2.test/demo/example/instrumental.m4a',
  },
}

/** One song per test: a fire-and-forget write must not land in the next. */
let songNumber = 0
let EXAMPLE: DemoSongManifest
let SESSION: string
let STAMP_KEY: string

async function rows(sessionId: string): Promise<UvrSessionLyrics[]> {
  const db = await getDb()
  return db
    .getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    .findAll({ where: { sessionId } as Record<string, unknown> })
}

const withBoth = (active: 'imported' | 'edited'): LyricsData => ({
  text: active === 'imported' ? SEEDED : MINE,
  format: 'lrc',
  filename: demoLyricsFilename(EXAMPLE, 'lrc'),
  fontSize: 1.7,
  activeVersionKind: active,
  versions: [
    { kind: 'imported', text: SEEDED, createdAt: 1 },
    { kind: 'edited', text: MINE, createdAt: 2 },
  ],
})

beforeEach(() => {
  localStorage.clear()
  songNumber += 1
  EXAMPLE = { ...BASE, slug: `versions-${songNumber}` }
  SESSION = demoSessionId(EXAMPLE.slug)
  STAMP_KEY = `mercurypitch.demoLyricsSeed.v1.${SESSION}`
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('an authored correction reaching an example', () => {
  const seededAt = (revision: number) =>
    localStorage.setItem(STAMP_KEY, JSON.stringify({ revision, text: SEEDED }))

  it('replaces the Original and leaves the Edited version beside it', async () => {
    // The singer corrected the words, then went back to the Original. The
    // active text is what we seeded, so the correction may land -- on the
    // Original. Their Edited version is theirs.
    await saveLyricsToDb(SESSION, withBoth('imported'))
    seededAt(1)

    await seedDemoLyrics({
      ...EXAMPLE,
      lyricsText: CORRECTED,
      lyricsRevision: 2,
    })

    const stored = await loadLyricsFromDb(SESSION)
    expect(stored?.text).toBe(CORRECTED)
    expect(stored?.activeVersionKind).toBe('imported')
    expect(stored?.versions?.map((v) => [v.kind, v.text])).toEqual([
      ['imported', CORRECTED],
      ['edited', MINE],
    ])
    // A preference, not part of the words.
    expect(stored?.fontSize).toBe(1.7)
  })

  it('keeps the end marks the corrected text carries, on the version that is read', async () => {
    // A record with versions is never re-derived on load, so a version
    // written without them has lost them for good.
    await saveLyricsToDb(SESSION, withBoth('imported'))
    seededAt(1)

    await seedDemoLyrics({
      ...EXAMPLE,
      lyricsText: CORRECTED_WITH_ENDS,
      lyricsRevision: 2,
    })

    const original = (await loadLyricsFromDb(SESSION))?.versions?.find(
      (v) => v.kind === 'imported',
    )
    expect(original?.wordEndTimings).toEqual({ 0: [1.5] })
  })

  it('still stays away while the Edited version is the one in use', async () => {
    await saveLyricsToDb(SESSION, withBoth('edited'))
    seededAt(1)

    await seedDemoLyrics({
      ...EXAMPLE,
      lyricsText: CORRECTED,
      lyricsRevision: 2,
    })

    expect(await loadLyricsFromDb(SESSION)).toMatchObject(withBoth('edited'))
  })

  it('writes a plain record when there is nothing else to keep', async () => {
    // The mixer derives the versions of a bare record when it opens it,
    // end marks included. Nothing to carry means nothing to pre-empt.
    await saveLyricsToDb(SESSION, {
      text: SEEDED,
      format: 'lrc',
      filename: demoLyricsFilename(EXAMPLE, 'lrc'),
    })
    seededAt(1)

    await seedDemoLyrics({
      ...EXAMPLE,
      lyricsText: CORRECTED,
      lyricsRevision: 2,
    })

    const stored = await loadLyricsFromDb(SESSION)
    expect(stored?.text).toBe(CORRECTED)
    expect(stored?.versions).toBeUndefined()
  })
})

describe('two saves at once', () => {
  it('leave one row, and it is the later one', async () => {
    await saveLyricsToDb(SESSION, withBoth('imported'))

    await Promise.all([
      saveLyricsToDb(SESSION, { ...withBoth('imported'), fontSize: 2 }),
      saveLyricsToDb(SESSION, { ...withBoth('edited'), fontSize: 3 }),
    ])

    expect(await rows(SESSION)).toHaveLength(1)
    expect((await loadLyricsFromDb(SESSION))?.fontSize).toBe(3)
  })

  it('reads the newest row when an older build left two behind', async () => {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionLyrics>('uvrSessionLyrics')
    const base = {
      sessionId: SESSION,
      format: 'lrc' as const,
      filename: 'x.lrc',
    }
    const newest = await repo.create({ ...base, text: 'newest' })
    const older = await repo.create({ ...base, text: 'older' })
    await repo.update(older.id, {
      createdAt: '2020-01-01T00:00:00.000Z',
    } as never)
    await repo.update(newest.id, {
      createdAt: '2026-01-01T00:00:00.000Z',
    } as never)

    expect((await loadLyricsFromDb(SESSION))?.text).toBe('newest')
  })
})

describe('renaming a stored copy', () => {
  it('changes the name and nothing else', async () => {
    await saveLyricsToDb(SESSION, withBoth('edited'))

    await renameLyricsInDb(SESSION, 'The Build - Paper Boats.lrc')

    expect(await loadLyricsFromDb(SESSION)).toMatchObject({
      ...withBoth('edited'),
      filename: 'The Build - Paper Boats.lrc',
    })
    expect(await rows(SESSION)).toHaveLength(1)
  })

  it('cannot put back words that were saved while it was deciding', async () => {
    // The rename used to re-save a copy it had read earlier. Anything the
    // mixer stored in between -- a new Edited version -- was overwritten.
    await saveLyricsToDb(SESSION, {
      text: SEEDED,
      format: 'lrc',
      filename: 'paper-boats.lrc',
    })

    await Promise.all([
      saveLyricsToDb(SESSION, withBoth('edited')),
      renameLyricsInDb(SESSION, 'The Build - Paper Boats.lrc'),
    ])

    const stored = await loadLyricsFromDb(SESSION)
    expect(stored?.versions?.map((v) => v.kind)).toEqual(['imported', 'edited'])
    expect(stored?.text).toBe(MINE)
  })

  it('does nothing when there is no copy', async () => {
    await renameLyricsInDb(SESSION, 'anything.lrc')
    expect(await rows(SESSION)).toHaveLength(0)
  })
})
