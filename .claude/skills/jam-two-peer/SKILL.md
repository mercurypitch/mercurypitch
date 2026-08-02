---
name: jam-two-peer
description: Drive two real peers into a local jam room with Playwright and screenshot both sides. Use when verifying anything multiplayer in the Jam tab — peer connection, room modes and role assignment, per-peer pitch trails, transport sync — or when tempted to say a jam change "can't be verified without real devices". It can.
---

# Two peers in a jam room, locally

Verifies the multiplayer paths end to end: WebRTC connection, role
assignment, per-peer trails, transport. Two browsers on one machine.

**The trap this exists to kill:** the in-app Browser pane cannot clear the
dev server's self-signed certificate interstitial, which makes the Jam tab
look unverifiable. It is not. Build to plain HTTP and drive it with
Playwright, and the whole thing is testable in about a minute.

## The five things that each cost a run to discover

1. **Plain HTTP, no cert.** Build with `VITE_JAM_SIGNALING_URL` pointed at
   the local worker and serve the `dist` output. No vite dev server, so no
   `basic-ssl`, so no interstitial. `serve dist` does not proxy `/api/jam`,
   which is exactly why the env var is needed.
2. **Run wrangler FROM `workers/jam-worker`.** `npx wrangler dev --cwd
   workers/jam-worker` from the repo root silently starts a *different*
   worker and every `/api/jam/*` call 404s. `cd` in first.
3. **Allow the test origin.** The worker Origin-gates POST and WS upgrades,
   so pass `--var ALLOWED_ORIGINS:http://localhost:3001` or room creation
   and the ICE endpoint both fail with CORS.
4. **Separate browser INSTANCES, not contexts.** Two contexts of one
   Chromium share a network process and the peer connection never
   establishes -- the symptom is a host stuck on "0 peers connected" with
   no error. `chromium.launch()` twice.
5. **Import `@playwright/test`, not `playwright`, and run from the repo
   root.** Under pnpm, `playwright` is a transitive dependency with no
   top-level `node_modules` entry, so a bare `playwright` import fails with
   `ERR_MODULE_NOT_FOUND` *even from the repo root* -- the script location
   is necessary but not sufficient. `@playwright/test` is a direct
   dependency and re-exports `chromium`.

Plus: seed `pitchperfect_welcome_version` via `addInitScript` or the
welcome overlay swallows every click, and launch with
`--use-fake-device-for-media-stream` + `permissions: ['microphone']` so
pitch detection produces a trail.

## Run it

```bash
VITE_API_BASE_URL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
  VITE_JAM_SIGNALING_URL=http://localhost:8787/api/jam npx vite build
```

```bash
npx serve dist -l 3001 &
(cd workers/jam-worker && npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://localhost:3001 &)
```

Wait for `POST /api/jam/rooms/new` to answer `426` (it wants a WS upgrade —
that is success, not a failure), then run `two-peer.mjs` from the repo root.

## Assert on the room, never on a timer

Fixed sleeps make this flaky and, worse, make failures look like passes.
Wait for the condition:

```js
await host.page.waitForFunction(
  () => !/0 peers? connected/i.test(document.body.innerText),
  { timeout: 45000 },
)
```

Console is the best evidence. A healthy connection logs, in order:
`ICE state … connected`, `connection state … connected`, `DataChannel open
to …` on both sides. If DataChannel never opens, it is item 4 above.

## What this proves, and what it does not

**Proves:** peers connect, roles differ per peer and are derived
independently (Harmony Stack hands one singer Root and the other Third
with nothing about roles on the wire), targets render differently, trails
draw, transport syncs, layout at any viewport.

**Does not prove:** that it sounds right. Fake audio devices emit a tone,
so "does a chord actually sound like a chord" and "does latency
compensation land people together" still need real people on real devices.
Say which of the two you did.
