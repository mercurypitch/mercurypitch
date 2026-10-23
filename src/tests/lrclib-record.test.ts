/**
 * One LRCLIB record, and how asking for it went (src/lib/lrclib-record.ts).
 */
import { describe, expect, it, vi } from 'vitest'
import { fetchLyricsByIdOutcome, lyricsFromMatch, lyricsPickFailureMessage, } from '@/lib/lrclib-record'
import { fetchLyricsById } from '@/lib/lyrics-service'

// ── A pick from LRCLIB's list ─────────────────────────────────
//
// A pick that brought nothing went back to the search box without a word
// (owner, mp-v0.8.41). Each way it can end is now told apart, so the singer
// hears which, and the search's own copy of the lyrics spares a request.

const SYNCED = '[00:05.00]Line one\n[00:10.00]Line two\n[00:15.00]Line three\n'

function answer(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('lyricsFromMatch', () => {
  it('uses the synced lyrics a search result carries, then its plain ones', () => {
    const match = { id: 1, artist: 'A', title: 'T' }
    expect(lyricsFromMatch({ ...match, syncedLyrics: SYNCED })).toEqual({
      text: SYNCED,
      format: 'lrc',
    })
    expect(
      lyricsFromMatch({ ...match, plainLyrics: 'Line one\nLine two' }),
    ).toEqual({ text: 'Line one\nLine two', format: 'txt' })
  })

  it('has nothing for a result whose lyrics are missing or too short', () => {
    expect(lyricsFromMatch({ id: 1, artist: 'A', title: 'T' })).toBeNull()
    expect(
      lyricsFromMatch({ id: 1, artist: 'A', title: 'T', plainLyrics: 'la' }),
    ).toBeNull()
  })
})

describe('fetchLyricsByIdOutcome', () => {
  it('finds a record with lyrics', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      answer({ id: 7, syncedLyrics: SYNCED }),
    )
    expect(await fetchLyricsByIdOutcome(7)).toEqual({
      kind: 'found',
      result: { text: SYNCED, format: 'lrc' },
    })
  })

  it('tells an instrumental record from one with no lyrics', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      answer({ id: 7, instrumental: true, syncedLyrics: null }),
    )
    expect(await fetchLyricsByIdOutcome(7)).toEqual({ kind: 'instrumental' })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      answer({ id: 7, plainLyrics: '' }),
    )
    expect(await fetchLyricsByIdOutcome(7)).toEqual({ kind: 'empty' })
  })

  it('carries the status of an error answer', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(answer({}, 503))
    expect(await fetchLyricsByIdOutcome(7)).toEqual({
      kind: 'http',
      status: 503,
    })
  })

  it('says offline when there is no answer at all', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    expect(await fetchLyricsByIdOutcome(7)).toEqual({ kind: 'offline' })
  })

  it('says aborted when the caller cancelled it', async () => {
    const controller = new AbortController()
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    expect(await fetchLyricsByIdOutcome(7, controller.signal)).toEqual({
      kind: 'aborted',
    })
  })

  it('says timeout when LRCLIB takes longer than it may', async () => {
    vi.useFakeTimers()
    try {
      vi.spyOn(global, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      )
      const pending = fetchLyricsByIdOutcome(7)
      await vi.advanceTimersByTimeAsync(25_000)
      expect(await pending).toEqual({ kind: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves fetchLyricsById its plain answer', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(answer({}, 404))
    expect(await fetchLyricsById(7)).toBeNull()
  })
})

describe('lyricsPickFailureMessage', () => {
  const match = { artist: 'Bastille', title: 'Pompeii' }

  it('names the song and says what to do, for each way a pick fails', () => {
    expect(lyricsPickFailureMessage({ kind: 'empty' }, match)).toBe(
      'LRCLIB has no lyrics for "Pompeii" by Bastille. Pick another version, or add your own.',
    )
    expect(lyricsPickFailureMessage({ kind: 'instrumental' }, match)).toBe(
      'LRCLIB lists "Pompeii" by Bastille as instrumental, with no lyrics. Pick another version, or add your own.',
    )
    expect(lyricsPickFailureMessage({ kind: 'http', status: 429 }, match)).toBe(
      'LRCLIB could not send the lyrics for "Pompeii" by Bastille (error 429). Try again in a moment, or pick another version.',
    )
    expect(lyricsPickFailureMessage({ kind: 'offline' }, match)).toBe(
      'LRCLIB could not be reached. Check the connection, then pick the song again.',
    )
    expect(lyricsPickFailureMessage({ kind: 'timeout' }, match)).toBe(
      'LRCLIB took too long to answer. Check the connection, then pick the song again.',
    )
  })

  it('leaves out an artist LRCLIB does not name', () => {
    expect(
      lyricsPickFailureMessage(
        { kind: 'empty' },
        { artist: 'Unknown', title: 'Pompeii' },
      ),
    ).toBe(
      'LRCLIB has no lyrics for "Pompeii". Pick another version, or add your own.',
    )
  })

  it('says nothing for a pick that worked or was cancelled', () => {
    expect(lyricsPickFailureMessage({ kind: 'aborted' }, match)).toBeNull()
    expect(
      lyricsPickFailureMessage(
        { kind: 'found', result: { text: SYNCED, format: 'lrc' } },
        match,
      ),
    ).toBeNull()
  })
})
