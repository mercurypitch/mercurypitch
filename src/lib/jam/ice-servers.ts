// ── ICE servers ───────────────────────────────────────────────────────
// Where a peer connection is told to look for a path to the other side.
//
// Minted per session by the jam worker (POST /api/jam/ice), which holds the
// Cloudflare TURN key. The browser only ever sees short-lived credentials.
//
// This replaced a hardcoded list that used openrelay.metered.ca, a free
// public relay: no SLA, no capacity guarantee, rate limits shared with
// everyone on the internet using it. It was the fallback carrying media for
// every pair that could not connect directly -- roughly 10-20% of them --
// and when it was saturated the connection simply failed, indistinguishable
// from any other failure. "Works for everyone except one person" was this.

/**
 * Same base as the signaling client, not a hardcoded path.
 *
 * VITE_JAM_SIGNALING_URL can point the jam API at a different host, and a
 * hardcoded '/api/jam/ice' would keep asking the PAGE origin for credentials
 * while signaling talked to the configured one -- a 404 that degrades
 * silently to STUN, so the room would still work and nobody would notice
 * TURN had quietly stopped being used.
 */
const JAM_BASE = import.meta.env.VITE_JAM_SIGNALING_URL ?? '/api/jam'
const ICE_ENDPOINT = `${JAM_BASE.replace(/\/$/, '')}/ice`
/** Long enough for a slow cold start, short enough not to stall a join. */
const FETCH_TIMEOUT_MS = 4000

/**
 * Google's STUN, kept only as the offline fallback.
 *
 * No TURN here on purpose: there is no free relay worth trusting, and a
 * direct-only room that works for most people is a better failure than one
 * that half-works unpredictably for everyone.
 */
export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

let cached: RTCIceServer[] | null = null

/**
 * The room's ICE servers, fetched once per session.
 *
 * Never throws and never leaves a caller without something usable: any
 * failure -- offline, timeout, non-200, malformed body -- falls back to
 * STUN. This endpoint must not be able to stop people jamming, so it is
 * written to degrade rather than to be correct.
 */
export async function getIceServers(
  fetchImpl: typeof fetch = fetch,
): Promise<RTCIceServer[]> {
  if (cached !== null) return cached

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetchImpl(ICE_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) return FALLBACK_ICE_SERVERS
    const body = (await res.json()) as { iceServers?: unknown }
    const servers = body.iceServers
    // The real response carries TWO entries -- a STUN group and a TURN
    // group -- so the whole array is kept. Taking the first would drop
    // every TURN URL and look exactly like TURN not working.
    if (!Array.isArray(servers) || servers.length === 0) {
      return FALLBACK_ICE_SERVERS
    }
    cached = servers as RTCIceServer[]
    return cached
  } catch {
    // Offline, aborted, or a body that would not parse.
    return FALLBACK_ICE_SERVERS
  }
}

/** Drop the cached servers — for leaving a room, and for tests. */
export function resetIceServers(): void {
  cached = null
}
