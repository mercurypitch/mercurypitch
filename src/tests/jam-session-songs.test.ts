// ── Session songs tests ───────────────────────────────────────────────
// Your own separations, offered to a room. The rules that matter: never
// offer a session that would play silence, never offer one still being
// written, and never let a lyrics hiccup cost you the song.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getStemBlobUrl = vi.fn()
const loadLyricsFromDb = vi.fn()

vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: (id: string, stem: string) => getStemBlobUrl(id, stem),
}))
vi.mock('@/db/services/lyrics-db-service', () => ({
  loadLyricsFromDb: (id: string) => loadLyricsFromDb(id),
}))

const { jammableSessions, sessionSong, sessionSongLines, sessionSongs } =
  await import('@/lib/jam/jam-session-songs')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const session = (over: any = {}) =>
  ({
    sessionId: 's1',
    status: 'completed',
    progress: 100,
    originalFile: { name: 'My Song.mp3' },
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

describe('jammableSessions', () => {
  it('offers only completed separations', () => {
    // 'finalizing' means the stems are still being written to IndexedDB;
    // offering it would hand the room a half-written blob.
    const all = [
      session({ sessionId: 'done' }),
      session({ sessionId: 'writing', status: 'finalizing' }),
      session({ sessionId: 'broken', status: 'error' }),
      session({ sessionId: 'busy', status: 'processing' }),
    ]
    expect(jammableSessions(all).map((s) => s.sessionId)).toEqual(['done'])
  })
})

describe('sessionSong', () => {
  beforeEach(() => {
    getStemBlobUrl.mockReset()
    loadLyricsFromDb.mockReset()
    loadLyricsFromDb.mockResolvedValue(null)
  })

  it('builds a local song from the stored stems', async () => {
    getStemBlobUrl.mockImplementation((_id: string, stem: string) =>
      Promise.resolve(`blob:${stem}`),
    )
    const s = await sessionSong(session())
    expect(s?.origin).toBe('local')
    expect(s?.stems.instrumental).toBe('blob:instrumental')
    expect(s?.stems.vocal).toBe('blob:vocal')
  })

  it('names it from the file, without the extension', async () => {
    // Otherwise the shelf reads "My Song.mp3".
    getStemBlobUrl.mockResolvedValue('blob:x')
    expect((await sessionSong(session()))?.title).toBe('My Song')
  })

  it('refuses a session with no instrumental', async () => {
    // Separated badly, or the blobs were evicted. An entry that plays
    // silence is worse than an entry that is not there.
    getStemBlobUrl.mockImplementation((_id: string, stem: string) =>
      Promise.resolve(stem === 'instrumental' ? null : 'blob:vocal'),
    )
    expect(await sessionSong(session())).toBeNull()
  })

  it('is still a song with no guide vocal', async () => {
    getStemBlobUrl.mockImplementation((_id: string, stem: string) =>
      Promise.resolve(stem === 'instrumental' ? 'blob:inst' : null),
    )
    const s = await sessionSong(session())
    expect(s).not.toBeNull()
    expect(s?.stems.vocal).toBeUndefined()
  })
})

describe('sessionSongLines', () => {
  // Block body, not an expression: mockReset() RETURNS the mock, and
  // vitest treats a function returned from beforeEach as a teardown hook
  // -- so it called the throwing mock during cleanup and failed the test
  // from outside the test.
  beforeEach(() => {
    loadLyricsFromDb.mockReset()
  })

  it('reads timings out of an LRC', async () => {
    loadLyricsFromDb.mockResolvedValue({
      format: 'lrc',
      text: '[00:01.00]first\n[00:05.00]second',
    })
    const lines = await sessionSongLines('s1')
    expect(lines.map((l) => l.text)).toEqual(['first', 'second'])
    expect(lines[0]!.startSec).toBeCloseTo(1)
  })

  it('treats plain text as no lyrics', async () => {
    // Real words, but nothing to scroll by. A static wall pretending to
    // follow the song is worse than saying there are none.
    loadLyricsFromDb.mockResolvedValue({ format: 'txt', text: 'some words' })
    expect(await sessionSongLines('s1')).toEqual([])
  })

  it('survives a database hiccup', async () => {
    // Lyrics are a nicety; losing them must not cost you the song.
    // mockImplementation rather than mockRejectedValue: the latter builds
    // the rejected promise eagerly, which vitest sees as unhandled before
    // the code under test ever gets to catch it.
    loadLyricsFromDb.mockImplementation(async () => {
      throw new Error('db locked')
    })
    expect(await sessionSongLines('s1')).toEqual([])
  })
})

describe('sessionSongs', () => {
  it('drops the unbuildable ones rather than listing dead rows', async () => {
    loadLyricsFromDb.mockResolvedValue(null)
    getStemBlobUrl.mockImplementation((id: string, stem: string) =>
      Promise.resolve(
        id === 'ok' && stem === 'instrumental' ? 'blob:inst' : null,
      ),
    )
    const out = await sessionSongs([
      session({ sessionId: 'ok' }),
      session({ sessionId: 'gone' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('session:ok')
  })
})
