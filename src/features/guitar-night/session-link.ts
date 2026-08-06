// Guitar Night session links preserve independent score and backing selections.
// ============================================================

const MAX_SESSION_ID_LENGTH = 256

export function readGuitarNightSession(
  search = typeof window === 'undefined' ? '' : window.location.search,
): string | null {
  const value = new URLSearchParams(search).get('session')?.trim() ?? ''
  if (value === '' || value.length > MAX_SESSION_ID_LENGTH) return null
  return value
}

export function withGuitarNightSession(
  currentHref: string,
  sessionId: string | null,
): string {
  const url = new URL(currentHref, 'https://mercurypitch.local')
  url.pathname = '/guitar-night'
  url.hash = ''

  const normalized = sessionId?.trim() ?? ''
  if (normalized === '' || normalized.length > MAX_SESSION_ID_LENGTH) {
    url.searchParams.delete('session')
  } else {
    url.searchParams.set('session', normalized)
  }

  return `${url.pathname}${url.search}`
}
