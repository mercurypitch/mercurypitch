// Links from the studio app to the standalone Karaoke Night page. Kept as a
// tiny pure leaf so both studio components and the night page's runtime can
// share the deep-link format.

import { DEMO_SESSION_ID, isDemoSessionId, LEGACY_SLUG, } from '@/lib/example-session'
import { parseSyncLinkHash } from '@/lib/room-code'

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
  url += startParam(options?.startAtSec)
  if (options?.autoplay === true) url += '&autoplay=1'
  return url
}

/** `&t=` for a start position, or nothing when there is none to give. */
function startParam(startAtSec: number | undefined): string {
  if (startAtSec === undefined || !Number.isFinite(startAtSec)) return ''
  // Tenth-of-a-second resolution: plenty for "meet the singer", short
  // enough to keep the URL tidy.
  const rounded = Math.round(Math.max(0, startAtSec) * 10) / 10
  return `&t=${String(rounded)}`
}

/**
 * Where the studio mixer's "Open in Karaoke Night" goes: the song in the
 * mixer, on the stage, paused at `startAtSec` (never autoplay, which a
 * browser may refuse after a page load). The top of the song needs no
 * position.
 *
 * An example goes by its song link (`?song=`), which stages the visitor's
 * own copy of it: a vocal or lyrics they replaced come along. Any other song
 * goes by its session id. The original demo's id names its legacy slug,
 * which the page reads and rewrites to the song's link slug.
 */
export function mixerKaraokeNightUrl(
  sessionId: string,
  options: { startAtSec?: number } = {},
): string {
  const at = options.startAtSec
  const start = at !== undefined && at > 0 ? startParam(at) : ''
  if (!isDemoSessionId(sessionId)) {
    return `${karaokeNightSessionUrl(sessionId)}${start}`
  }
  const slug =
    sessionId === DEMO_SESSION_ID
      ? LEGACY_SLUG
      : sessionId.slice(DEMO_SESSION_ID.length + 1)
  return `${karaokeNightSongUrl(slug)}${start}`
}

/**
 * A song slug as the studio stores one, or null.
 *
 * The same rule the db worker applies when an author saves a slug
 * (`normalizeDemoSlug`): lowercase letters and digits in hyphen-joined runs,
 * at most 64 characters. Case and padding are forgiven because people type
 * these links by hand; anything else is not a slug and names no song.
 */
export function normalizeSongSlug(
  raw: string | null | undefined,
): string | null {
  const slug = (raw ?? '').trim().toLowerCase()
  if (slug === '' || slug.length > 64) return null
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

export interface KaraokeNightSongLinkOptions {
  /** Open the zen stage on a desktop (phones always get it). */
  zen?: boolean
}

/**
 * The readable link to one of the example songs:
 * `/karaoke-night?song=nothing-in-the-dark`, plus `&zen=1` when asked.
 *
 * The slug is the example's link slug (`exampleLinkSlug`), not a session id.
 * A query parameter rather than a path segment because `/karaoke-night` is
 * matched exactly by the Worker, the service worker and the SEO entry list,
 * and a query needs none of them to change.
 */
export function karaokeNightSongUrl(
  slug: string,
  options?: KaraokeNightSongLinkOptions,
): string {
  const url = `${KARAOKE_NIGHT_PATH}?song=${encodeURIComponent(slug)}`
  return options?.zen === true ? `${url}&zen=1` : url
}

export interface KaraokeNightLaunchParams {
  sessionId: string | null
  /** Parsed `t` in seconds; null when absent or malformed. */
  startAtSec: number | null
  autoplay: boolean
  /** An example's link slug from `?song=`, normalized; null when absent or
   *  not a slug. `session` wins when a link carries both. */
  song: string | null
  /** `zen=1`, `zen=true` or a bare `zen`: open the zen stage. */
  zen: boolean
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
  const zenRaw = params.get('zen')
  return {
    sessionId: params.get('session'),
    startAtSec: Number.isFinite(t) && t >= 0 ? t : null,
    autoplay: autoplayRaw === '1' || autoplayRaw === 'true',
    song: normalizeSongSlug(params.get('song')),
    zen: zenRaw === '' || zenRaw === '1' || zenRaw === 'true',
  }
}

/**
 * Catch a scanned `#/sync:CODE` link at page boot: parse it, CONSUME it,
 * and hand the code back — or null when the hash is no such link.
 *
 * Consuming (rewriting the URL without the hash) is the load-bearing
 * half: the page has no hash router to do it, and a hash that survives
 * means every reload, tab restore, or rail collapse/expand would re-join
 * a session the person already finished — the same one-shot contract the
 * app side gets from its router rewriting to `#/karaoke` after dispatch.
 */
export function takeScannedSyncLink(): string | null {
  const scanned = parseSyncLinkHash(window.location.hash)
  if (scanned === null) return null
  try {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  } catch {
    /* history unavailable — worst case the hash survives a reload */
  }
  return scanned
}

/** Deep-link from Karaoke Night back to the main studio app for a loaded session. */
export function studioSessionUrl(sessionId?: string | null): string {
  if (sessionId === undefined || sessionId === null || sessionId === '') {
    return '/#/karaoke'
  }
  return `/#/karaoke/session/${encodeURIComponent(sessionId)}/mixer`
}
