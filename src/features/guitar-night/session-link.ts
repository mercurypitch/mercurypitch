// Guitar Night session links preserve independent score and backing selections.
// ============================================================

import { GUITAR_NIGHT_PATH } from './route'

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
  url.pathname = GUITAR_NIGHT_PATH
  url.hash = ''
  // Choosing a score/backing exits a saved-take review deep link.
  url.searchParams.delete('recording')

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

/** A saved-take link opens its review, never an audio device or playback. */
export function readGuitarNightRecording(
  search = currentSearch(),
): string | null {
  return readParam(search, 'recording')
}

export function withGuitarNightScore(
  currentHref: string,
  songId: string | null,
): string {
  return withParam(currentHref, SCORE_PARAM, songId)
}
