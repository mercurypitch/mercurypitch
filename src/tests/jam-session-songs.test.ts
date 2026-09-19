// ── Session songs tests ───────────────────────────────────────────────
// Your own separations, offered to a room. The rules that matter: never
// offer a session that would play silence, never offer one still being
// written, and never let a lyrics hiccup cost you the song.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getStemBlobUrl = vi.fn()
const loadLyricsFromDb = vi.fn()
const loadPitchAnalysisFromDb = vi.fn()

vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: (id: string, stem: string) => getStemBlobUrl(id, stem),
}))
vi.mock('@/db/services/lyrics-db-service', () => ({
  loadLyricsFromDb: (id: string) => loadLyricsFromDb(id),
}))
vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  // `?? null` so a describe that never configures this mock still gets the
  // "never analysed" answer rather than undefined.
  loadPitchAnalysisFromDb: async (id: string) =>
    ((await loadPitchAnalysisFromDb(id)) as unknown) ?? null,
}))

const {
  exampleSong,
  jammableSessions,
  ownSongRows,
  sessionSong,
  sessionSongGuide,
  sessionSongLines,
  sessionSongNotes,
  sessionSongs,
} = await import('@/lib/jam/jam-session-songs')
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

describe('ownSongRows', () => {
  // The Examples library seeds a session row for every published example,
  // so whatever the Example songs shelf serves from a manifest is always in
  // the session list too. Listed under both, it looks like a duplicate.
  const all = [
    session({ sessionId: 'karaoke-night-demo' }),
    session({ sessionId: 'karaoke-night-demo:josephine' }),
    session({ sessionId: 'my-own-song' }),
  ]
  const ids = (shelved: string[]) =>
    ownSongRows(all, new Set(shelved)).map((r) => r.session.sessionId)

  it('drops every song the shelf above already shows', () => {
    expect(ids(['karaoke-night-demo', 'karaoke-night-demo:josephine'])).toEqual(
      ['my-own-song'],
    )
  })

  it('keeps an example the shelf above does not have', () => {
    // A manifest that could not be fetched, or one the studio has parked:
    // the row is still here and sessionSong can still sing it, so this shelf
    // is the only way left to reach it.
    expect(ids(['karaoke-night-demo'])).toEqual([
      'karaoke-night-demo:josephine',
      'my-own-song',
    ])
  })

  it('leaves the visitor own sessions alone', () => {
    expect(ids(['karaoke-night-demo'])).toContain('my-own-song')
  })

  it('still refuses a session that is not finished', () => {
    const pending = [session({ sessionId: 'writing', status: 'finalizing' })]
    expect(ownSongRows(pending, new Set(['karaoke-night-demo']))).toEqual([])
  })

  it('drops nothing when the shelf above is empty', () => {
    // The example list can fail to load; the rows must not vanish with it.
    expect(ids([])).toHaveLength(3)
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

  describe('an example song', () => {
    // An example's library row is metadata only: nothing is ever written to
    // this browser for it, so the blob lookup finds nothing, every time.
    // That used to end in "missing its backing track on this device", and
    // opening the song in Karaoke first could never have helped.
    const example = (over: object = {}) =>
      session({
        sessionId: 'karaoke-night-demo:josephine',
        provider: 'examples',
        originalFile: { name: 'Josh Woodward — Josephine' },
        outputs: {
          vocal: 'https://stems.example/josephine/vocal.m4a',
          instrumental: 'https://stems.example/josephine/instrumental.m4a',
        },
        stemMeta: { instrumental: { duration: 258 } },
        ...over,
      })

    beforeEach(() => {
      getStemBlobUrl.mockResolvedValue(null)
    })

    it('is sung straight from its public stems', async () => {
      const s = await sessionSong(example())
      expect(s?.stems).toEqual({
        instrumental: 'https://stems.example/josephine/instrumental.m4a',
        vocal: 'https://stems.example/josephine/vocal.m4a',
      })
      expect(s?.durationSec).toBe(258)
    })

    it('is a song every peer can fetch, not one only the host holds', async () => {
      // 'local' would make the room wait on a transfer that is not needed.
      expect((await sessionSong(example()))?.origin).toBe('url')
    })

    it('keeps the session id, so its pitch guide is filed where the mixer reads', async () => {
      expect((await sessionSong(example()))?.id).toBe(
        'session:karaoke-night-demo:josephine',
      )
    })

    it('is recognised by its id alone, for a row from before the provider stamp', async () => {
      expect(await sessionSong(example({ provider: undefined }))).not.toBeNull()
    })

    it('is still a song with no guide vocal', async () => {
      const s = await sessionSong(
        example({
          outputs: {
            instrumental: 'https://stems.example/josephine/instrumental.m4a',
          },
        }),
      )
      expect(s?.stems.vocal).toBeUndefined()
      expect(s?.origin).toBe('url')
    })

    it('is refused when its row carries no address at all', async () => {
      expect(await sessionSong(example({ outputs: {} }))).toBeNull()
    })

    it('prefers a copy that IS on this device', async () => {
      getStemBlobUrl.mockImplementation((_id: string, stem: string) =>
        Promise.resolve(`blob:${stem}`),
      )
      const s = await sessionSong(example())
      expect(s?.stems.instrumental).toBe('blob:instrumental')
      expect(s?.origin).toBe('local')
    })
  })

  it('never sings a separation from an address its server left behind', async () => {
    // A separation's outputs can hold a URL too, and that one expires. A
    // room loaded from it would play silence and say nothing.
    getStemBlobUrl.mockResolvedValue(null)
    const stale = session({
      outputs: {
        vocal: 'https://worker.example/out/vocal.wav',
        instrumental: 'https://worker.example/out/instrumental.wav',
      },
    })
    expect(await sessionSong(stale)).toBeNull()
  })
})

describe('exampleSong', () => {
  beforeEach(() => {
    loadPitchAnalysisFromDb.mockReset()
  })

  const manifest = {
    slug: 'josephine',
    title: 'Josephine',
    artist: 'Josh Woodward',
    attribution: { text: '', url: '', license: '', licenseUrl: '' },
    stems: {
      vocal: 'https://stems.example/josephine/vocal.m4a',
      instrumental: 'https://stems.example/josephine/instrumental.m4a',
    },
    lyricsText: '[00:01.00]First line\n[00:04.00]Second line',
    durationSec: 258,
  }

  it('carries its own id, not the original example id', async () => {
    // One shared id filed every example's pitch guide under the first one.
    expect((await exampleSong(manifest))?.id).toBe(
      'karaoke-night-demo:josephine',
    )
  })

  it('reads the words from the manifest, so every peer gets the same lines', async () => {
    const s = await exampleSong(manifest)
    expect(s?.lines.map((l) => l.text)).toEqual(['First line', 'Second line'])
    expect(loadLyricsFromDb).not.toHaveBeenCalledWith(
      'karaoke-night-demo:josephine',
    )
  })

  it('aims at the pitch line saved under its own session', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [],
      segmentedNotes: [{ midi: 60, startSec: 1, endSec: 2 }],
    })
    const s = await exampleSong(manifest)
    expect(loadPitchAnalysisFromDb).toHaveBeenCalledWith(
      'karaoke-night-demo:josephine',
    )
    expect(s?.notes).toEqual([{ midi: 60, startSec: 1, endSec: 2 }])
  })

  it('is still a song when plain text is all the studio published', async () => {
    const s = await exampleSong({ ...manifest, lyricsText: 'no timings here' })
    expect(s?.lines).toEqual([])
    expect(s?.origin).toBe('url')
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

describe('sessionSongNotes', () => {
  // The two stored melodies differ on purpose: segmentedNotes is edit
  // mode's base, mergedNotes is the raw merge. A session whose owner
  // corrected the line in the mixer has that correction in the edit layer
  // and nowhere else.
  const segmentedNotes = [
    { midi: 60, noteName: 'C4', startSec: 0, endSec: 1 },
    { midi: 62, noteName: 'D4', startSec: 2, endSec: 3 },
  ]
  const mergedNotes = [{ midi: 48, noteName: 'C3', startSec: 0, endSec: 6 }]

  beforeEach(() => {
    loadPitchAnalysisFromDb.mockReset()
    loadPitchAnalysisFromDb.mockResolvedValue(null)
  })

  it('sings the melody its owner corrected, not the raw merge', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes,
      segmentedNotes,
      pitchHistory: [],
      // The second note was retuned by hand, a semitone up.
      editLayer: {
        manual: [{ id: 'm-0', startBeat: 2, endBeat: 3, midi: 63 }],
        deleted: [],
        seq: 1,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(await sessionSongNotes('s1')).toEqual([
      { midi: 60, startSec: 0, endSec: 1 },
      { midi: 63, startSec: 2, endSec: 3 },
    ])
  })

  it('keeps a hand-deleted stretch out of the room target line', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes,
      segmentedNotes,
      pitchHistory: [],
      editLayer: {
        manual: [],
        deleted: [{ startBeat: 1.5, endBeat: 3.5 }],
        seq: 0,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(await sessionSongNotes('s1')).toEqual([
      { midi: 60, startSec: 0, endSec: 1 },
    ])
  })

  it('reads the segmentation even when nothing was edited', async () => {
    // No layer at all is the common case, and it must still be the
    // segmentation rather than the merge -- the two are different lines.
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes,
      segmentedNotes,
      pitchHistory: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect((await sessionSongNotes('s1')).map((n) => n.midi)).toEqual([60, 62])
  })

  it('falls back to the merge when the session predates edit mode', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes,
      segmentedNotes: [],
      pitchHistory: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(await sessionSongNotes('s1')).toEqual([
      { midi: 48, startSec: 0, endSec: 6 },
    ])
  })

  it('is empty for a session that was never analysed', async () => {
    // Legal: the room falls back to lyrics and your own trail.
    expect(await sessionSongNotes('s1')).toEqual([])
  })

  it('survives a database hiccup', async () => {
    loadPitchAnalysisFromDb.mockImplementation(async () => {
      throw new Error('db locked')
    })
    expect(await sessionSongNotes('s1')).toEqual([])
  })
})

describe('sessionSongGuide', () => {
  // The same notes as sessionSongNotes, with where they came from. The room
  // says it to the singer, and uses it to spot a line worth replacing.
  beforeEach(() => {
    loadPitchAnalysisFromDb.mockReset()
    getStemBlobUrl.mockReset()
    loadLyricsFromDb.mockReset()
    loadLyricsFromDb.mockResolvedValue(null)
  })

  const SEGMENTED = [{ midi: 60, startSec: 1, endSec: 2 }]

  it('calls an untouched analysis a saved line', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [],
      segmentedNotes: SEGMENTED,
    })
    expect((await sessionSongGuide('s1')).from).toBe('saved')
  })

  it('knows a line its owner corrected by hand', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [],
      segmentedNotes: SEGMENTED,
      editLayer: {
        manual: [{ id: 'm-1', startBeat: 3, endBeat: 4, midi: 64 }],
        deleted: [],
        seq: 1,
      },
    })
    const guide = await sessionSongGuide('s1')
    expect(guide.from).toBe('edited')
    expect(guide.notes.map((n) => n.midi)).toEqual([60, 64])
  })

  it('calls a merge nobody cleaned up what it is', async () => {
    // From before the clean-up pass existed. The room replaces these.
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [{ midi: 61, startSec: 0, endSec: 1 }],
    })
    const guide = await sessionSongGuide('s1')
    expect(guide.from).toBe('raw')
    expect(guide.notes).toHaveLength(1)
  })

  it('has no provenance for no line', async () => {
    loadPitchAnalysisFromDb.mockResolvedValue(null)
    expect(await sessionSongGuide('s1')).toEqual({ notes: [], from: null })
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [],
      segmentedNotes: [],
    })
    expect((await sessionSongGuide('s1')).from).toBeNull()
  })

  it('writes the provenance on the song the room is handed', async () => {
    getStemBlobUrl.mockResolvedValue('blob:x')
    loadPitchAnalysisFromDb.mockResolvedValue({
      mergedNotes: [{ midi: 61, startSec: 0, endSec: 1 }],
    })
    expect((await sessionSong(session()))?.notesFrom).toBe('raw')
  })

  it('writes nothing on a song that has no line', async () => {
    getStemBlobUrl.mockResolvedValue('blob:x')
    loadPitchAnalysisFromDb.mockResolvedValue(null)
    expect(await sessionSong(session())).not.toHaveProperty('notesFrom')
  })
})
