// Links from the studio app to the standalone Karaoke Night page. Kept as a
// tiny pure leaf so both studio components and the night page's runtime can
// share the deep-link format.

export const KARAOKE_NIGHT_PATH = '/karaoke-night'

/** Deep-link that opens Karaoke Night with this playlist armed (the page
 *  consumes the param at boot and starts the playlist's ready overlay). */
export function karaokeNightPlaylistUrl(playlistId: string): string {
  return `${KARAOKE_NIGHT_PATH}?playlist=${encodeURIComponent(playlistId)}`
}

/** Deep-link that opens Karaoke Night with a specific session armed on stage. */
export function karaokeNightSessionUrl(sessionId: string): string {
  return `${KARAOKE_NIGHT_PATH}?session=${encodeURIComponent(sessionId)}`
}

/** Deep-link from Karaoke Night back to the main studio app for a loaded session. */
export function studioSessionUrl(sessionId?: string | null): string {
  if (sessionId === undefined || sessionId === null || sessionId === '') {
    return '/#/karaoke'
  }
  return `/#/karaoke/session/${encodeURIComponent(sessionId)}/mixer`
}
