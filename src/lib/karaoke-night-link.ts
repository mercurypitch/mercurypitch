// Links from the studio app to the standalone Karaoke Night page. Kept as a
// tiny pure leaf so both studio components and the night page's runtime can
// share the deep-link format.

export const KARAOKE_NIGHT_PATH = '/karaoke-night'

/** Deep-link that opens Karaoke Night with this playlist armed (the page
 *  consumes the param at boot and starts the playlist's ready overlay). */
export function karaokeNightPlaylistUrl(playlistId: string): string {
  return `${KARAOKE_NIGHT_PATH}?playlist=${encodeURIComponent(playlistId)}`
}

export interface KaraokeNightLaunchOptions {
  /** Start position in seconds — lands in the mixer's `initialSeekSec`. */
  startAtSec?: number
  /** Start playback as soon as the stems load. */
  autoplay?: boolean
}

/**
 * Deep-link that opens Karaoke Night with a specific session armed on stage.
 * With options, the link also carries WHERE to start and whether to roll
 * immediately — the launch contract shared by Mercury Sing, Shazam and any
 * future "the band meets you" launcher. The page consumes `t`/`autoplay`
 * once at boot and strips them from the URL, so a refresh or share of the
 * resulting page does not replay the launch.
 */
export function karaokeNightSessionUrl(
  sessionId: string,
  options?: KaraokeNightLaunchOptions,
): string {
  let url = `${KARAOKE_NIGHT_PATH}?session=${encodeURIComponent(sessionId)}`
  const startAtSec = options?.startAtSec
  if (startAtSec !== undefined && Number.isFinite(startAtSec)) {
    // Tenth-of-a-second resolution: plenty for "meet the singer", short
    // enough to keep the URL tidy.
    const rounded = Math.round(Math.max(0, startAtSec) * 10) / 10
    url += `&t=${String(rounded)}`
  }
  if (options?.autoplay === true) url += '&autoplay=1'
  return url
}

export interface KaraokeNightLaunchParams {
  sessionId: string | null
  /** Parsed `t` in seconds; null when absent or malformed. */
  startAtSec: number | null
  autoplay: boolean
}

/** Parse the boot side of the launch contract from a query string. */
export function parseKaraokeNightLaunch(
  search: string | URLSearchParams,
): KaraokeNightLaunchParams {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search
  const rawT = params.get('t')
  const t = rawT === null || rawT === '' ? Number.NaN : Number(rawT)
  const autoplayRaw = params.get('autoplay')
  return {
    sessionId: params.get('session'),
    startAtSec: Number.isFinite(t) && t >= 0 ? t : null,
    autoplay: autoplayRaw === '1' || autoplayRaw === 'true',
  }
}

/** Deep-link from Karaoke Night back to the main studio app for a loaded session. */
export function studioSessionUrl(sessionId?: string | null): string {
  if (sessionId === undefined || sessionId === null || sessionId === '') {
    return '/#/karaoke'
  }
  return `/#/karaoke/session/${encodeURIComponent(sessionId)}/mixer`
}
