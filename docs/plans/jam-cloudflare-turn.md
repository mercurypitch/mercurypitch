# Jam: Cloudflare TURN, and seeing the connection

**Status:** plan only. Branch `feat/jam-cloudflare-turn`, stacked on
`feat/jam-tab-polish-transparency-55a592` (PR #388). Nothing here is built —
it needs a Cloudflare TURN key first.

## 1. What this does and does not change

The room stays **peer-to-peer**. Worth being precise, because "add a TURN
server" sounds like moving audio onto infrastructure and it is not:

| Piece | Role | Does audio pass through it? |
|---|---|---|
| `jam-worker` Durable Object | Signaling: SDP offers/answers, ICE candidates, who is in the room | **No** |
| STUN | Tells a peer its own public address | **No** |
| **TURN** | Relays media *only when a direct path cannot be built* | Yes, as a dumb relay |
| SFU (not planned) | Receives every stream, forwards to everyone | Yes, and it is no longer P2P |

TURN is the fallback inside WebRTC's normal ICE negotiation. Peers still talk
to each other; the packets take one extra hop. Nothing is decoded, mixed or
stored.

**TURN is not a scale feature.** This is the part worth internalising: it is
needed for a *two-person* room where either side sits behind symmetric NAT —
most corporate networks, a lot of mobile carriers, some consumer routers.
Industry figures put the share of peer pairs that cannot connect directly at
roughly 10–20%. Small rooms do not avoid it. "It works for everyone except
one person" is this, almost every time.

What we have today is `openrelay.metered.ca`, a **free public relay**: no SLA,
no capacity guarantee, rate limits shared with everyone on the internet using
it. When it is saturated the connection simply fails, and from inside the app
that is indistinguishable from any other failure.

The SFU stays out of scope, deliberately. It is the piece that would end P2P,
and it only pays off with large rooms.

## 2. Cost, and the caps

Cloudflare Realtime TURN is **$0.05/GB egress, with 1,000 GB free**. Only
*relayed* traffic counts; a direct P2P pair costs nothing.

Sizing: Opus voice is ~40 kbps, so ~18 MB per hour per direction. A relayed
two-person room burns roughly 36 MB/hour. The free tier is therefore on the
order of **25,000+ relayed room-hours** — and only the minority of sessions
that need a relay at all.

That is comfortable, but the failure mode we care about is abuse: the
credential endpoint is public by necessity, so anyone who can load the app can
mint TURN credentials.

**Controls, cheapest first:**

1. **Short TTL.** Ask for hours, not `86400`. A leaked credential expires on
   its own. The docs suggest sizing to the longest expected session; for us
   that is a few hours, not a day.
2. **Rate-limit the credential endpoint.** Cloudflare's own rate limiting on
   the `/api/jam/ice` route — something like 10 requests/minute/IP. Minting is
   once per session, so a real user never comes close.
3. **Require an active room.** Do not mint for anyone who asks: take the room
   id and only issue credentials for a room the signaling DO says exists.
   That ties TURN spend to actual rooms, which is the tightest control here
   and costs one DO lookup.
4. **A kill switch.** `TURN_ENABLED` as a worker env var. Setting it to `0`
   makes `/api/jam/ice` return STUN-only immediately, without a deploy of the
   frontend. Rooms degrade to direct-only rather than breaking.
5. **A billing alert** on the Cloudflare account, set well below anything
   painful — the point is to hear about it on day one, not at invoice time.
6. **Budget cap.** Cloudflare does not offer a hard per-service spend cap, so
   4 and 5 together are the real protection: alert, then flip the switch.

## 3. What you need to do in Cloudflare

1. Dash → **Realtime** → **TURN** → *Create TURN key*. Name it
   `mercurypitch-jam`.
2. Copy the **Turn Key ID** and the **API token**. The token is shown once.
3. Set them as secrets on the jam worker (not in `wrangler.jsonc`, not in the
   repo — they are long-term secrets that mint unlimited credentials):

```bash
cd workers/jam-worker && npx wrangler secret put TURN_KEY_ID --env dev
```

```bash
cd workers/jam-worker && npx wrangler secret put TURN_KEY_API_TOKEN --env dev
```

4. Repeat with `--env prod` when it is time. Dev first — the whole point of
   the dev worker is that this gets exercised before it is anyone's problem.
5. Dash → **Notifications** → billing alert on the account.
6. After deploy, Dash → **Realtime** → the key shows usage. Check it after the
   first real multi-device session.

## 4. What I build

**Worker** (`workers/jam-worker/src/index.ts`)

- `GET /api/jam/ice?room=<id>`
  - `TURN_ENABLED === '0'` → STUN-only response, 200.
  - Room unknown to the DO → STUN-only, 200. (Not an error: a direct-only
    room still works, and a hard failure here would break joining.)
  - Otherwise POST to
    `https://rtc.live.cloudflare.com/v1/turn/keys/$TURN_KEY_ID/credentials/generate-ice-servers`
    with `{"ttl": <seconds>}` and the bearer token, and return the
    `iceServers` array verbatim.
  - Never log or echo the key.
- Add the route to `assets.run_worker_first` if the asset layer fronts it —
  the Cloudflare asset layer silently swallows unlisted worker routes, which
  has bitten this repo before.

**Client** (`src/lib/jam/service.ts`)

- Fetch `/api/jam/ice` once per session, before the first
  `RTCPeerConnection`.
- **Fall back to the current hardcoded STUN list on any failure** — timeout,
  non-200, malformed body. A direct-only room beats no room, and this endpoint
  must never be able to stop people jamming.
- Keep the response for the session; `setConfiguration()` can refresh if a
  session ever outlives the TTL.

**Tests**

- Worker: kill switch returns STUN-only; unknown room returns STUN-only;
  a successful mint passes `iceServers` through untouched; the key never
  appears in a response.
- Client: a failed/garbage fetch falls back to STUN rather than throwing.

## 5. Seeing the connection

This pairs with TURN rather than standing alone, because "relayed vs direct"
only becomes a meaningful distinction once a relay exists.

`measureLatency` already reads `currentRoundTripTime` from `getStats()`. The
same report carries the **candidate pair type**, which says whether a pair is
`host` (same network), `srflx` (direct through NAT) or `relay` (going through
TURN). Surfacing it turns the most common support question into a self-answer:

- Per peer in the sidebar: RTT, and a quiet "relayed" marker when it applies.
- One line in the room when *your own* connection is relayed — "your network
  is routing through a relay, so there may be extra delay".

Cheap, entirely client-side, and it is the diagnostic that would have made the
local-certificate problem obvious in seconds instead of a log-reading session.

## 6. Order

1. Create the key and set the dev secrets (you).
2. Worker endpoint + kill switch + tests.
3. Client fetch with STUN fallback.
4. Verify on dev with two devices, one deliberately on cellular — that is the
   case which exercises the relay path at all.
5. Connection quality in the UI.
6. Prod secrets, billing alert, and watch the usage on the key for a week.

Steps 2, 3 and 5 are perhaps a day's work together. Step 1 is the blocker and
step 4 is the one that actually proves it.
