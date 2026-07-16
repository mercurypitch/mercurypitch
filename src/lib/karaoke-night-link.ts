// Links from the studio app to the standalone Karaoke Night page. Kept as a
// tiny pure leaf so both studio components and the night page's runtime can
// share the deep-link format.

export const KARAOKE_NIGHT_PATH = '/karaoke-night'

/** Deep-link that opens Karaoke Night with this playlist armed (the page
 *  consumes the param at boot and starts the playlist's ready overlay). */
export function karaokeNightPlaylistUrl(playlistId: string): string {
  return `${KARAOKE_NIGHT_PATH}?playlist=${encodeURIComponent(playlistId)}`
}
