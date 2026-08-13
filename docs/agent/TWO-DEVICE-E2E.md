# Two-device end-to-end tests

Everything in `src/e2e` runs one browser against a mocked signaling layer
and no API. The two specs in **`src/e2e-devices`** do not, and that is the
whole point of them: they cross the seams that mocking hides.

| Spec                  | Proves                                                                                          | Needs      |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| `qr-sign-in.spec.ts`  | A television is signed in only after a phone confirms it, and a spent code cannot be replayed   | db-worker  |
| `device-sync.spec.ts` | A song crosses two real `RTCPeerConnection`s, arrives playable, and is declined the second time | jam worker |

Both bugs found by hand on the first two-device run lived exactly here: a
route read before ICE had settled, and a dead device's free-space figure
outliving the device. Neither could have been caught by a test that fakes
the peer, and until these existed every sync test did.

They found a third on their first run: `tooBigForPeer` was declared below
the memos that call it, and `createMemo` runs its body immediately — so the
sync modal threw on any device that had a song to send, and on no device
that did not.

## Not in CI

Four services, two of them `wrangler dev`, and a local D1. `wrangler dev`
falls over from time to time for reasons that have nothing to do with this
app; a required check that does that is a check people learn to ignore.
Run it as a script before merging anything that touches sync or device
linking. Decision S5 in
[device-sync-followups.md](../plans/device-sync-followups.md).

## Running it

Once, to give the local D1 its tables:

```bash
cd workers/db-worker && npx wrangler d1 migrations apply mercurypitch-db --local
```

Build the app against the real workers. This is a different build from the
default e2e one, which disables the API and mocks signaling:

```bash
npx cross-env VITE_API_BASE_URL=http://localhost:8788 VITE_JAM_SIGNALING_URL=http://localhost:8787/api/jam VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= npx vite build
```

Serve it, and start both workers. The two wranglers need **different
inspector ports** — they both default to 9229, and the second one dies
with `Address already in use` before it ever binds its own port:

```bash
npx serve dist -l 3002
```

```bash
cd workers/jam-worker && npx wrangler dev --port 8787 --inspector-port 9230 --var ALLOWED_ORIGINS:http://localhost:3002
```

```bash
cd workers/db-worker && npx wrangler dev --port 8788 --var JWT_SECRET:e2e-local-secret
```

Then:

```bash
npx playwright test -c playwright.devices.config.ts
```

## Things that cost a run to discover

- **Two browser INSTANCES, not two contexts.** Contexts of one Chromium
  share a network process and the peer connection never establishes. The
  symptom is a receiver stuck on "waiting" with nothing in either console.
  `qr-sign-in` uses contexts because nothing there connects peer to peer;
  `device-sync` must not.
- **`ALLOWED_ORIGINS` on the jam worker.** It Origin-gates POST and WS
  upgrades, so without the flag room creation fails as CORS.
- **The app origin must match that flag.** Port 3002 in both places.
- **Sign-in is rate limited, and rightly.** Ten logins per five minutes per
  IP, five registrations. The specs use two fixed accounts and log in
  rather than registering, which costs three logins a run — so three runs
  back to back are fine and a tight loop is not. If a run fails with "no
  account appeared", check the worker log for `429` before suspecting the
  code.
- **`wrangler dev` sometimes exits with an empty error.** `qr-sign-in` has
  a `beforeAll` that says so in as many words rather than letting every
  assertion fail as "no account appeared".

## The seeded song

`device-sync` needs a song with real stem BLOBS behind it — writing
`outputs` alone produces a session that looks complete and refuses to
pack, because `buildPortableBundle` reads the blob store. `src/lib/e2e-song-seed.ts`
registers `window.__ppSongSeed` for that, gated to test and E2E builds by
`exposeForE2E` and imported dynamically so no database service lands in a
production boot's eager graph.

It also reads a session back with its stored stem sizes, which is what
lets the spec assert the song arrived with audio in it rather than merely
arriving. Every layer above the blobs — the list, the status, even the
object URLs — is satisfied by a song with nothing in it.

## What they do not prove

That it sounds right, and that a phone on real Wi-Fi behaves like two
processes on one machine. Both devices here are on loopback, so the direct
route is a foregone conclusion and TURN is never exercised. Say which of
the two you did.
