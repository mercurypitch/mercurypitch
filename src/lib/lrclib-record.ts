// ============================================================
// One LRCLIB record: asking for it, and saying how that went
// ============================================================
//
// A pick from the lyrics finder's list asks LRCLIB for one record by its id.
// That used to end in the record's lyrics or a bare null, and a null sent the
// stage back to the search box without a word (owner, mp-v0.8.41 on an
// iPhone): nothing said whether LRCLIB had no lyrics, was busy, or could not
// be reached. So each way it can end is told apart here, with the sentence
// the singer is told, and the search's own copy of a record's lyrics is used
// where it has one, which spares the second request and its chance to fail.
//
// The search's result types live here too, and lyrics-service.ts, which
// searches, re-exports them; nothing here imports it.
//
// Tests: src/tests/lrclib-record.test.ts.

export interface LyricsSearchResult {
  text: string
  format: 'txt' | 'lrc'
}

export interface LyricsSearchMatch {
  artist: string
  title: string
  plainLyrics?: string
  syncedLyrics?: string
  id: number
}

/** A signal that aborts after `ms`, or when `externalSignal` does. */
export function createTimeoutSignal(
  ms: number,
  externalSignal?: AbortSignal,
): {
  signal: AbortSignal
  clear: () => void
} {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)

  if (externalSignal) {
    if (externalSignal.aborted) {
      ctrl.abort(externalSignal.reason)
      return { signal: ctrl.signal, clear: () => clearTimeout(id) }
    }
    const onAbort = () => ctrl.abort(externalSignal.reason)
    externalSignal.addEventListener('abort', onAbort, { once: true })
  }

  return { signal: ctrl.signal, clear: () => clearTimeout(id) }
}

/**
 * How a pick of one LRCLIB record ended. A pick that found nothing used to
 * end in a bare null, and the stage went back to the search box without a
 * word (owner, mp-v0.8.41): now each way it can fail is told apart, so the
 * singer can be told which, and the console can say what LRCLIB answered.
 */
export type LyricsByIdOutcome =
  | { readonly kind: 'found'; readonly result: LyricsSearchResult }
  /** The record is there, with no lyrics long enough to use. */
  | { readonly kind: 'empty' }
  /** LRCLIB marks the record instrumental: it has no words. */
  | { readonly kind: 'instrumental' }
  /** LRCLIB answered with an error status. */
  | { readonly kind: 'http'; readonly status: number }
  /** LRCLIB answered with something that is not a lyrics record. */
  | { readonly kind: 'unreadable' }
  /** No answer within the time allowed. */
  | { readonly kind: 'timeout' }
  /** No answer at all: offline, or LRCLIB unreachable. */
  | { readonly kind: 'offline' }
  /** The caller cancelled it. */
  | { readonly kind: 'aborted' }

/** How long one record may take, as long as a search may. */
const LYRICS_BY_ID_TIMEOUT_MS = 25000

/** A record's own words, when they are long enough to be lyrics. */
function lyricsOf(record: {
  syncedLyrics?: unknown
  plainLyrics?: unknown
}): LyricsSearchResult | null {
  if (
    typeof record.syncedLyrics === 'string' &&
    record.syncedLyrics.length > 20
  ) {
    return { text: record.syncedLyrics, format: 'lrc' }
  }
  if (
    typeof record.plainLyrics === 'string' &&
    record.plainLyrics.length > 10
  ) {
    return { text: record.plainLyrics, format: 'txt' }
  }
  return null
}

/**
 * The lyrics a search result already carries. LRCLIB's search answers with
 * each record's lyrics, so a pick from its list needs no second request, and
 * no second chance to fail, when they are there.
 */
export function lyricsFromMatch(
  match: LyricsSearchMatch,
): LyricsSearchResult | null {
  return lyricsOf(match)
}

/** One LRCLIB record by id, and how asking for it went. */
export async function fetchLyricsByIdOutcome(
  id: number,
  signal?: AbortSignal,
): Promise<LyricsByIdOutcome> {
  const timed = createTimeoutSignal(LYRICS_BY_ID_TIMEOUT_MS, signal)
  try {
    const resp = await fetch(`https://lrclib.net/api/get/${id}`, {
      signal: timed.signal,
      headers: {
        'LrcLib-Client': 'MercuryPitch/1.0.0',
      },
    })
    if (!resp.ok) return { kind: 'http', status: resp.status }
    let data: unknown
    try {
      data = await resp.json()
    } catch {
      return { kind: 'unreadable' }
    }
    if (typeof data !== 'object' || data === null) return { kind: 'unreadable' }
    const record = data as {
      syncedLyrics?: unknown
      plainLyrics?: unknown
      instrumental?: unknown
    }
    const result = lyricsOf(record)
    if (result !== null) return { kind: 'found', result }
    return record.instrumental === true
      ? { kind: 'instrumental' }
      : { kind: 'empty' }
  } catch {
    if (signal?.aborted === true) return { kind: 'aborted' }
    if (timed.signal.aborted) return { kind: 'timeout' }
    return { kind: 'offline' }
  } finally {
    timed.clear()
  }
}

/**
 * What the singer is told when a pick from LRCLIB's list brought no lyrics,
 * in words that say which way it failed and what to do next. Null for a
 * pick that found them, or one the caller cancelled.
 */
export function lyricsPickFailureMessage(
  outcome: LyricsByIdOutcome,
  match: Pick<LyricsSearchMatch, 'artist' | 'title'>,
): string | null {
  const song =
    match.artist !== '' && match.artist !== 'Unknown'
      ? `"${match.title}" by ${match.artist}`
      : `"${match.title}"`
  switch (outcome.kind) {
    case 'found':
    case 'aborted':
      return null
    case 'empty':
      return `LRCLIB has no lyrics for ${song}. Pick another version, or add your own.`
    case 'instrumental':
      return `LRCLIB lists ${song} as instrumental, with no lyrics. Pick another version, or add your own.`
    case 'http':
      return `LRCLIB could not send the lyrics for ${song} (error ${outcome.status}). Try again in a moment, or pick another version.`
    case 'unreadable':
      return `LRCLIB sent something that is not lyrics for ${song}. Pick another version, or add your own.`
    case 'timeout':
      return 'LRCLIB took too long to answer. Check the connection, then pick the song again.'
    case 'offline':
      return 'LRCLIB could not be reached. Check the connection, then pick the song again.'
  }
}
