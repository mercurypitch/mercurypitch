// Guitar Night session links preserve independent score and backing selections.
// ============================================================

const MAX_SESSION_ID_LENGTH = 256

/** `song` selects the score reference; `session` selects the backing audio. */
const SCORE_PARAM = 'song'
const BACKING_PARAM = 'session'

function readParam(search: string, key: string): string | null {
  const value = new URLSearchParams(search).get(key)?.trim() ?? ''
  if (value === '' || value.length > MAX_SESSION_ID_LENGTH) return null
  return value
}

function currentSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search
}

/**
 * Rewrite one axis while leaving the other untouched: a score and a backing
 * session are independent selections that may be used alone or together.
 */
function withParam(
  currentHref: string,
  key: string,
  identifier: string | null,
): string {
  const url = new URL(currentHref, 'https://mercurypitch.local')
  url.pathname = '/guitar-night'
  url.hash = ''

  const normalized = identifier?.trim() ?? ''
  if (normalized === '' || normalized.length > MAX_SESSION_ID_LENGTH) {
    url.searchParams.delete(key)
  } else {
    url.searchParams.set(key, normalized)
  }

  return `${url.pathname}${url.search}`
}

export function readGuitarNightSession(
  search = currentSearch(),
): string | null {
  return readParam(search, BACKING_PARAM)
}

export function withGuitarNightSession(
  currentHref: string,
  sessionId: string | null,
): string {
  return withParam(currentHref, BACKING_PARAM, sessionId)
}

export function readGuitarNightScore(search = currentSearch()): string | null {
  return readParam(search, SCORE_PARAM)
}

export function withGuitarNightScore(
  currentHref: string,
  songId: string | null,
): string {
  return withParam(currentHref, SCORE_PARAM, songId)
}
