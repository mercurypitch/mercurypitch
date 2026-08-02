// ── TURN credentials ──────────────────────────────────────────────────
// Mints short-lived Cloudflare Realtime TURN credentials for a jam peer.
//
// TURN is the relay WebRTC falls back to when two peers cannot reach each
// other directly -- symmetric NAT, most corporate networks, a lot of mobile
// carriers. It is not a scale feature: a two-person room needs it if either
// side is behind one, and roughly 10-20% of peer pairs are.
//
// The TURN key is a LONG-TERM secret that mints unlimited credentials, so it
// lives only in the worker's secret store and never reaches a browser. What
// the browser gets back is an iceServers array whose username/credential
// expire on their own.

const MINT_URL = 'https://rtc.live.cloudflare.com/v1/turn/keys'

/**
 * Long enough that no session outlives its credentials, short enough that a
 * leaked one is worthless by the time anyone finds it. Cloudflare suggests
 * sizing to the longest expected session; a jam is an evening, not a day.
 */
export const TURN_TTL_SECONDS = 4 * 60 * 60

/** Cloudflare's own STUN, and what we fall back to with no TURN at all. */
export const STUN_ONLY: RTCIceServerLike[] = [
  {
    urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'],
  },
]

export interface RTCIceServerLike {
  urls: string[]
  username?: string
  credential?: string
}

export interface TurnEnv {
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
  /** '0' disables TURN without a frontend deploy. Any other value enables. */
  TURN_ENABLED?: string
}

/**
 * Mint an iceServers array, or fall back to STUN.
 *
 * Never throws and never returns an error status: every failure degrades to
 * STUN-only. A room that can only connect directly still works for most
 * people, whereas an endpoint that can refuse would be able to stop the whole
 * feature dead the first time Cloudflare has a bad minute.
 */
export async function mintIceServers(
  env: TurnEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<{ iceServers: RTCIceServerLike[]; source: 'turn' | 'stun' }> {
  if (env.TURN_ENABLED === '0') return { iceServers: STUN_ONLY, source: 'stun' }

  const keyId = env.TURN_KEY_ID
  const token = env.TURN_KEY_API_TOKEN
  if (!keyId || !token) return { iceServers: STUN_ONLY, source: 'stun' }

  try {
    const res = await fetchImpl(
      `${MINT_URL}/${keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      },
    )
    if (!res.ok) {
      // Deliberately not echoing the body: it is Cloudflare's error, it can
      // change shape, and it is not worth the risk of relaying anything
      // derived from the key back to a browser.
      console.warn('[jam:turn] mint failed', res.status)
      return { iceServers: STUN_ONLY, source: 'stun' }
    }
    const body = (await res.json()) as { iceServers?: unknown }
    const servers = body.iceServers
    // The real response carries TWO entries -- a STUN group and a TURN group.
    // Anything that took [0] would silently drop every TURN URL and look
    // exactly like TURN not working, so validate the shape and pass the whole
    // array through untouched.
    if (!Array.isArray(servers) || servers.length === 0) {
      console.warn('[jam:turn] mint returned no iceServers')
      return { iceServers: STUN_ONLY, source: 'stun' }
    }
    return { iceServers: servers as RTCIceServerLike[], source: 'turn' }
  } catch (err) {
    console.warn('[jam:turn] mint threw', err)
    return { iceServers: STUN_ONLY, source: 'stun' }
  }
}
