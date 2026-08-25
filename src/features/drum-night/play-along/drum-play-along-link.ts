// ============================================================
// Drum play-along link — one optional saved-session URL parameter
// ============================================================
//
// View and workbench state already live in the Drum Night query string. The
// prepared-song identity is deliberately independent so selecting a room,
// view, or drawer never drops the leased UVR session from browser history.

export const DRUM_PLAY_ALONG_SESSION_PARAMETER = 'song'

export function readDrumPlayAlongSession(
  href = window.location.href,
): string | null {
  const sessionId = new URL(href).searchParams
    .get(DRUM_PLAY_ALONG_SESSION_PARAMETER)
    ?.trim()
  return sessionId === undefined || sessionId === '' ? null : sessionId
}

export function withDrumPlayAlongSession(
  href: string,
  sessionId: string | null,
): string {
  const url = new URL(href)
  const normalized = sessionId?.trim() ?? ''
  if (normalized === '') {
    url.searchParams.delete(DRUM_PLAY_ALONG_SESSION_PARAMETER)
  } else {
    url.searchParams.set(DRUM_PLAY_ALONG_SESSION_PARAMETER, normalized)
  }
  return `${url.pathname}${url.search}${url.hash}`
}
