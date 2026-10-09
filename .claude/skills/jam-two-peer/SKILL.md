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
3. **The test origin.** The worker Origin-gates POST and WS upgrades, but
   it waves through any request whose host is `localhost` or `127.0.0.1`
   (`isLocalHost` in `workers/jam-worker/src/index.ts`), so on this
   machine the gate is open whatever the page's origin. The recipe still
   passes `--var ALLOWED_ORIGINS:http://localhost:3001`. It costs nothing,
   and it is what saves you when the worker is reached by any other name,
   such as a LAN address from a phone. Then a missing entry is a `403`.
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

And seed `pitchperfect_whats_new_seen_v2` with the current release line
(`0.9` for 0.9.13). Seeding the welcome key makes the browser a returning
visitor, and a returning visitor who has not seen this line is sent to
`#/whats-new` instead of `#/jam`, so Create Room never appears. The script
reads the line from `package.json`, so it does not go stale at the next
release.

No timezone pin is needed. The consent banner is shown under `Europe/*`
timezones, but it is mounted only when the build ships a Google tag
(`setupConsent` in `src/components/ConsentBanner.tsx`), and the build
below blanks both. Both runs pass under `Europe/Zagreb`.

## Run it

Build. Not `pnpm build:e2e`: it sets `VITE_JAM_MOCK_SIGNALING=1`, the
peers are invented, and a real guest never receives the song.

```bash
VITE_API_BASE_URL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
  VITE_JAM_SIGNALING_URL=http://localhost:8787/api/jam timeout 900 npx vite build
```

Check the two ports are free. If either is taken, it is someone else's
server: stop and ask, do not kill it. Ports 4317-4320 are maff's own
servers and nothing here may touch them.

```bash
ss -ltn | grep -E ':(3001|8787)\b' || echo 'both free'
```

Start both servers from the repo root, each bounded by `timeout` and each
with its PID captured. `exec` turns the subshell into `timeout` itself, so
`$!` is the PID that stops wrangler; the old `( ... &)` form hid it.

Keep the `< /dev/null`. If stdin is left on the terminal of an
interactive shell, the backgrounded wrangler tree stops (`ps` state `T`)
and the worker never answers. Measured on 2026-09-23 in an interactive
zsh: without it, no answer after 30 s; with it, `426` after 3 s.

```bash
timeout 10800 npx serve dist -l 3001 < /dev/null &
SERVE_PID=$!
(cd workers/jam-worker && exec timeout 10800 npx wrangler dev --port 8787 \
  --var ALLOWED_ORIGINS:http://localhost:3001 < /dev/null) &
WRANGLER_PID=$!
echo "$SERVE_PID $WRANGLER_PID" > "${TMPDIR:-/tmp}/jam-two-peer.pids"
```

The variables live only in the shell that set them. A tool that starts a
new shell per command must keep the PIDs from that file.

Wait until the app answers `200` and room creation answers `426`. A `426`
means the worker wants a WebSocket upgrade, so it is success, not a
failure. The poll matches on status codes, never on a tool's formatted
output. Each probe carries its own limit (`-m 5`). Without one, a server
that accepts the connection and never answers holds `curl` and the loop
past the deadline.

```bash
http_code() { curl -s -m 5 -o /dev/null -w '%{http_code}' "$@"; }
end=$((SECONDS+120))
until [ "$(http_code http://localhost:3001/)" = 200 ] &&
  [ "$(http_code -X POST http://localhost:8787/api/jam/rooms/new)" = 426 ]; do
  [ $SECONDS -lt $end ] || { echo TIMEOUT; break; }
  sleep 2
done
```

Then run the script from the repo root, bounded too. The argument is
where the screenshots go. Keep them out of the repo:

```bash
SHOTS=~/agent-out/mercurypitch/$(date +%F)/jam-two-peer
timeout 300 node .claude/skills/jam-two-peer/two-peer.mjs "$SHOTS/drill"
JAM_SONG=1 timeout 300 node .claude/skills/jam-two-peer/two-peer.mjs "$SHOTS/song"
```

A healthy drill run prints the room code, `connected: host sees "1 peer
connected"` and the same for the guest, then a different `You sing:` on
each side, then `page scroll`. If the two peers are dealt the same part,
the script fails. A song run adds `picked:`, both
`Now singing:` headers, and `guest follows:` with the guest's backing
track paused before Start, then playing and advancing.

## Stop it

By the PIDs you captured, wrangler first, never by process name: no
`pkill`, no `killall`, no `pkill -f`. Those match other people's servers
too.

```bash
read SERVE_PID WRANGLER_PID < "${TMPDIR:-/tmp}/jam-two-peer.pids"
kill "$WRANGLER_PID" "$SERVE_PID"
```

`timeout` passes the signal to its whole process group, so this reaches
npx, wrangler, esbuild and both `workerd` processes together. They all
share the group of the PID in `$WRANGLER_PID`.

**The respawn trap.** `fuser -k 8787/tcp` kills `workerd`, the process
that holds the port, but a still-running wrangler starts a new one and
the port is back within seconds. When measured, a new `workerd` held
8787 one second after the kill, and kept it. So a port kill is never how
to stop wrangler. Stop the wrangler job by its PID first. After that, a
port kill is only a sweep for a leftover. `fuser -k 3001/tcp` on its own
is fine for `serve`.

Then check both ports are closed and STAY closed. Look again after about
5 s, so a respawn has time to show:

```bash
sleep 5
ss -ltn | grep -E ':(3001|8787)\b' || echo 'both closed'
```

## Assert on the room, never on a timer

Fixed sleeps make this flaky and, worse, make failures look like passes.
Wait for the condition, and wait for what IS on screen. "Not 0 peers"
also passes on a page that never showed the room.

```js
await host.page.waitForFunction(
  () => /\b[1-9]\d* peers? connected/i.test(document.body.innerText),
  undefined, // the page function's argument
  { timeout: 45000 },
)
```

The signature is `waitForFunction(fn, arg, options)`. Pass the options
second and they become `arg`: the timeout is silently ignored and the
default 30 s applies. A related trap is `.catch(() => {})` on a locator
action. A click on a control that is not there does not fail fast: it
waits out the whole 30 s default first, and the catch then hides the
failure. The old role lines lost 90 s that way while printing `(none)`
for both roles.

Console is the best evidence. A healthy connection logs, in order:
`ICE state … connected`, `connection state … connected`, `DataChannel open
to …` on both sides. If DataChannel never opens, it is item 4 above.

## What the script checks, and where things are

Select by role and name, or by a `data-*` attribute the app owns. Never
by a CSS-module class substring: `[class*="pickItem"]` silently stopped
matching when the picker was rewritten.

- **Roles.** The room mode is the host's, behind **More controls**, and
  only in a drill room. A song has no mode, so the script sets Harmony
  Stack before it loads a song. Each peer then shows its own
  `You sing: …`, for example Root on one and Third on the other.
- **The picker.** The host's **Choose a drill or a song** button opens
  `JamPickerList` as `#jam-panel [data-variant="popup"]`. The sidebar
  holds a second copy (`rail`), which is why the scope matters. Example
  songs are the first shelf, but they are fetched when the room goes
  live. Wait for the list's `role="status"` line to go, or the first row
  is a drill.
- **The song arriving.** Both peers' `jam-now-singing` chips name it.
- **The guest following.** The host presses **Start playback for everyone
  here**. The guest's backing track (`#jam-panel audio`) was paused before
  that, and afterwards it un-pauses and its `currentTime` advances. Scope
  it to `#jam-panel`: every peer's voice is its own `<audio>` appended to
  `<body>`.
- **Screenshots.** `host.png` and `guest.png` show the whole viewport, and
  `host-header.png` the room header (`jam-room-header`). `#jam-panel` is
  the whole stage, not the header. On a failure the script writes
  `host-error.png` and `guest-error.png` instead.

Beyond localhost, a song run reaches exactly two places. One is the page's
Google Fonts. The other is the public R2 bucket that the shipped manifest
(`public/karaoke-demo-song.json`) names for the example's stems. Nothing
reaches mercurypitch.com or its API, because the build blanks
`VITE_API_BASE_URL`. That was measured by logging every request host on
2026-09-23.

## What this proves, and what it does not

**Proves:** peers connect, roles differ per peer and are derived
independently (Harmony Stack hands one singer Root and the other Third
with nothing about roles on the wire), targets render differently, trails
draw, transport syncs, layout at any viewport.

**Does not prove:** that it sounds right. Fake audio devices emit a tone,
so "does a chord actually sound like a chord" and "does latency
compensation land people together" still need real people on real devices.
Say which of the two you did.
