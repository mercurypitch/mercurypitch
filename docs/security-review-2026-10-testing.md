# Security review 2026-10: test scope and release gate

Prepared 2026-10-17 for the nine fixes that came out of the October security
review (PRs #1069 to #1078). Audience: whoever verifies the fixes on
dev.mercurypitch.com before the next `/prod-upd`.

For every finding this document records what was wrong, what changed, the
behaviour before and after, the edge cases that were considered, the automated
test that pins each of them (file and test name, so a reader can open it), and
the manual check on the dev domain where one is possible. The last sections give
the order to run the dev walk in, the merge order, and what has to be true before
the release tag.

Nothing in here runs against production. The dev hosts are:

| Host                               | What it is                                                          | Deployed by                                                                                |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `https://dev.mercurypitch.com`     | the app, the UVR proxy at `/api/uvr`, the jam worker at `/api/jam*` | `build.yml` on every push to `main`; `deploy-jam.yml` when `workers/jam-worker/**` changed |
| `https://api-dev.mercurypitch.com` | the DB worker (accounts, profiles, rate limits, Drive)              | `deploy-db.yml` on a push to `main` that touched `workers/db-worker/**`                    |

Before testing, read what dev serves (the commit in the runtime-config chunk):

```sh
RC=$(curl -s https://dev.mercurypitch.com/ | grep -oE '/assets/runtime-config-[A-Za-z0-9_-]+\.js' | head -1)
curl -s https://dev.mercurypitch.com$RC | grep -oE 'const A="[0-9.]+"|C="[0-9a-f]{9}"'
```

The commit must be at or after the last of the nine merges.

## 1. The findings at a glance

| #   | PR    | Branch                                           | Area                 | Exposure before the fix                                                                         | Automated coverage                                                                                                                                       | Dev check                       |
| --- | ----- | ------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | #1069 | `feat/uvr-no-client-fetch-url`                   | stem separation      | a signed-in caller could make the GPU worker fetch a host of their choosing (SSRF)              | `runpod-bridge.test.ts`, `runpod.test.ts`, `runpod/test_url_guard.py` (pytest, not in CI)                                                                | partial                         |
| 2   | #1070 | `feat/analytics-no-url-fragment`                 | analytics            | a password-reset token or Google redirect JWT in the URL hash reached Google as `page_location` | `consent-page-location.test.ts`, `consent-preview-build.test.ts`                                                                                         | no (local build or after prod)  |
| 3   | #1071 | `feat/clear-admin-key-on-logout`                 | content studio       | the studio admin key stayed in localStorage after sign-out                                      | `auth-service.test.ts` (logout)                                                                                                                          | yes                             |
| 4   | #1072 | `feat/email-code-verify-revokes-presignin-creds` | accounts             | credentials set on an unverified account survived the real owner's first sign-in                | `pre-account-takeover-integration.test.ts`, `login-codes-integration.test.ts`, `passkey-integration.test.ts`                                             | yes                             |
| 5   | #1073 | `feat/ratelimit-ipv6-bucketing`                  | rate limits          | an IPv6 tenant had a fresh anonymous budget per address, including for sign-in and sign-up      | `ip-rate-limit-key.test.ts`, `ratelimit-ipv6-integration.test.ts`                                                                                        | optional (needs an IPv6 client) |
| 6   | #1074 | `feat/jam-ice-requires-active-room`              | jam (WebRTC)         | anyone on the site could mint Cloudflare TURN credentials, spending relay budget                | `room-activity.test.ts`, `jam-room.test.ts`, `index.test.ts` (jam worker), `jam-ice-servers.test.ts`, `service-message-sender.test.ts`                   | yes                             |
| 7   | #1075 | `feat/sync-link-requires-tap`                    | device sync          | opening a sync link joined a room on its own and the device accepted pushed songs               | `SyncDevicesModal.test.tsx`, `sync-store.test.ts`                                                                                                        | yes                             |
| 8   | #1076 | `feat/profiles-not-publicly-listable`            | profiles API         | every user profile was listable and countable without an account                                | `query-oracle-integration.test.ts`, `league-integration.test.ts`                                                                                         | yes                             |
| 9   | #1078 | `feat/drive-connect-finalize-binding`            | Google Drive connect | a connect-Drive grant was stored for the account named in the link, not the one finishing it    | `auth.test.ts` (db worker), `drive-connect-finalize-integration.test.ts`, `google-return-nonce.test.ts`, `auth-service.test.ts`, `SyncSettings.test.tsx` | yes (live Google round trip)    |

"Exposure" is written for a defender: who could do what, and under which
precondition. It is not a reproduction recipe.

## 2. Running the automated coverage

```sh
pnpm test:db                 # DB worker: unit + SQLite integration (100 files, 2057 tests)
pnpm test:jam                # jam worker (6 files, 52 tests)
pnpm exec vitest run <file>  # any single file named below
python3 -m pytest runpod/test_url_guard.py runpod/test_billing_gate.py   # handler guard; CI has no Python job
pnpm typecheck && pnpm typecheck:db && pnpm typecheck:jam
pnpm metrics:check           # the code-health ratchet, as CI runs it
```

CI (`pr-gate.yml`) runs every vitest project, lint and typecheck, the ratchet and
the browser suites on each PR and on every push to `main`. The Python test is
the one piece of coverage CI does not run; run it by hand when `runpod/handler.py`
changes.

Integration tests in `workers/db-worker/node-tests/` drive the real worker
(`worker.fetch`) over HTTP against SQLite with the real migrations applied. A
status code or a row count asserted there is the same one the dev worker answers.

## 3. Per finding

### 3.1 Stem separation: the GPU worker fetched a caller-chosen URL (PR #1069)

**What was wrong.** `POST /api/uvr/process` accepted an `audio_url` form field and
forwarded it as `input.audio_url`; the RunPod handler then downloaded it with
`requests.get` and no host check. The app never sends that field (uploads travel
as inline base64 or an R2 key), so it was pure attack surface, and a failed job
was refunded, so probing cost nothing.

**What changed.**

- `src/lib/runpod-bridge.ts`, `src/lib/runpod.ts`: the field is no longer read,
  and `audio_url` is gone from `RunpodJobInput` and `buildJobInput`, so the type
  checker refuses any reintroduction. Only an uploaded file (inline when at most
  7 MB, else streamed to R2 as `audio_s3_key`) or a reused R2 key reaches the
  handler.
- `runpod/handler.py` (`_materialize_input`): defence in depth. `audio_url` is
  refused with `ValueError("audio_url is not permitted")` unless the scheme is
  `https` and the host is in `RUNPOD_AUDIO_URL_ALLOWED_HOSTS` (comma separated,
  trimmed, case-insensitive). The variable is unset everywhere, so the answer is
  always "refused". The refusal happens before any network call.

| Case                                                       | Before                                  | After                                               |
| ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| form carries a file and `audio_url`                        | URL forwarded, file ignored             | file inlined, `audio_url` absent from the job input |
| form carries `audio_url` and no file                       | URL forwarded                           | 400 (no file)                                       |
| file over 7 MB                                             | R2 key                                  | R2 key (unchanged)                                  |
| handler receives `audio_url`, no allowlist                 | fetched                                 | refused before any request                          |
| handler receives `audio_url`, host not listed or not https | fetched                                 | refused before any request                          |
| handler receives `audio_url`, listed https host            | fetched                                 | fetched and written                                 |
| handler receives empty or missing `audio_url`              | "requires audio_base64 or audio_s3_key" | same error, unchanged                               |

**Automated tests.**

- `src/tests/runpod-bridge.test.ts`
  - `ignores a client-supplied audio_url and inlines the file (no SSRF)`: the
    job body sent to RunPod has no `audio_url` and does have `audio_base64`.
  - `400s when no file is provided` and `streams a >7 MB file to R2 and passes audio_s3_key (not base64)`
    (pre-existing): the two transports that remain.
- `src/tests/runpod.test.ts`, describe `buildJobInput`: `applies defaults`,
  `prefers an S3 key over base64` and the other builder cases, now without a URL
  transport.
- `runpod/test_url_guard.py` (pytest; loads the handler with a stubbed `runpod`
  module and a fake `requests.get` that records calls and never touches the
  network)
  - `test_refused_by_default_with_no_allowlist`: refused, no request, nothing written.
  - `test_refused_when_host_is_not_allowlisted`: `evil.example.com` against an allowlist of `cdn.example.com`.
  - `test_refused_when_scheme_is_not_https`: `http://cdn.example.com/a.mp3` refused.
  - `test_allowlisted_https_host_is_fetched_and_written`: `" cdn.example.com , other.example "` with `https://CDN.Example.com/a.mp3` is fetched once and the bytes land in the job directory.
  - `test_missing_or_empty_audio_url_falls_through`: `''` and absent both raise the existing "requires" error, with no request.

**Dev check.** Upload a song in Karaoke and split it; the job must complete as
before (dev routes `/api/uvr` to the container by default; the RunPod path is an
opt-in by header or query). Negative, from a shell:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://dev.mercurypitch.com/api/uvr/process \
  -H 'x-uvr-provider: runpod' -F model=roformer -F audio_url=https://example.com/x.mp3
```

Expected `400` (no file; the URL is not a transport). A `401` means the route
wanted a session first, which is also a refusal.

### 3.2 Analytics: the URL fragment reached Google as `page_location` (PR #1070)

**What was wrong.** The app is hash-routed, so a one-time credential can sit in
`location.hash` while gtag.js loads: the password-reset link lands on
`#/reset-password?token=...` and the Google sign-in redirect returns with
`#gauth=...`. gtag's default `page_location` is the full `href`, and the `config`
call for Ads and for GA4 would carry the fragment to Google.

**What changed.** `src/lib/consent.ts` exports `locationWithoutFragment()`
(`origin + pathname + search`) and passes it as `page_location` on both `config`
pushes (Google Ads and GA4). Routes are tracked as GA4 events, so the fragment
carried no analytics value.

| Case                                        | Before                          | After                                  |
| ------------------------------------------- | ------------------------------- | -------------------------------------- |
| `#/reset-password?token=SECRET`             | `dl` carries the token          | `dl` is `origin/path?search`, no token |
| `#gauth=JWT&gauth_nonce=n`                  | `dl` carries the JWT            | no fragment                            |
| no hash                                     | full href                       | identical (nothing to strip)           |
| Ads tag only, GA4 only, both                | default `page_location` on each | `page_location` set on each `config`   |
| dev / PR preview builds (`CONSENT_PREVIEW`) | gtag never loads                | unchanged, gtag never loads            |

**Automated tests.** `src/lib/consent-page-location.test.ts` (jsdom)

- `drops a reset-password token carried in the hash, keeps the search`
- `drops the Google redirect JWT carried in the hash`
- `returns origin, path and search unchanged when there is no hash`
- `carry page_location without the fragment, for Ads and GA4 alike`: runs the real
  `initConsent()` with `IS_TEST` off and both tag ids set (the defaults module is
  mocked for those four values only) and inspects `window.dataLayer`: exactly two
  `config` pushes, each with `page_location` equal to the helper's result,
  containing neither `#` nor the token.
- `never puts the raw href, and so the token, anywhere on the dataLayer`: the
  serialised dataLayer contains neither `JWT.VALUE` nor `#gauth`, and the gtag
  script tag was appended, which proves the real `loadTag` path ran.

`src/tests/consent-preview-build.test.ts` (pre-existing, 5 tests) still pins
that a preview build never loads the tag.

**Dev check.** Not observable on dev: `build:dev` sets `CONSENT_PREVIEW`, so the
tag never loads there. Two ways to see it live:

1. Local production build: `pnpm build && pnpm preview`, open
   `http://localhost:4173/?mp_internal=1#/reset-password?token=TEST`, accept the
   cookie bar, filter the Network panel on `collect`. The request to
   `google-analytics.com/g/collect` must carry `dl=http://localhost:4173/?mp_internal=1`
   with no `%23`, no `reset-password` and no `TEST`. (`mp_internal=1` marks the
   browser as internal traffic so the hit is filtered out of reports.)
2. After `/prod-upd`, the same on `https://mercurypitch.com/#/reset-password?token=TEST`.

### 3.3 Content studio: the admin key survived sign-out (PR #1071)

**What was wrong.** Unlocking the studio (`#/admin`) stores the organisation-wide
admin key under `pitchperfect_admin_key` in localStorage. Nothing cleared it on
sign-out, so the next person on a shared browser, or any script on the origin,
still held it and the studio re-unlocked on mount.

**What changed.** `logout()` in `src/db/services/auth-service.ts` lazily imports
`@/features/challenges/weekly-service` and calls `setAdminKey('')`, which removes
the key. The import is lazy so the studio stays out of first paint; the key is
gone one tick after sign-out.

| Case                               | Before    | After                                |
| ---------------------------------- | --------- | ------------------------------------ |
| sign out with the studio unlocked  | key kept  | key removed, `getAdminKey()` is `''` |
| sign out with nobody signed in     | key kept  | key removed, nothing throws          |
| other `pitchperfect_*` preferences | untouched | untouched                            |

**Automated tests.** `src/tests/auth-service.test.ts`, describe `logout`

- `forgets the content-studio admin key`: key and an unrelated `pitchperfect_theme`
  set, a session held; after `logout()` and the lazy import settles, the key is
  `null`, the real `getAdminKey()` returns `''`, the theme is still `dusk`.
- `clears it even when nobody was signed in`: no token, `logout()` does not throw,
  the key is removed.

**Dev check.** Sign in on dev, open `https://dev.mercurypitch.com/#/admin`, enter
the dev `ADMIN_KEY`, confirm the studio unlocks. DevTools, Application, Local
Storage: `pitchperfect_admin_key` is present. Settings, Sign out. The key is gone;
reopening `#/admin` asks for it again.

### 3.4 Accounts: credentials set before the inbox was proven survived the owner's first sign-in (PR #1072)

**What was wrong.** Anyone can register an address they do not own; the account
stays unverified. When the real owner later signs in with a mailed code, the
account becomes theirs, but the stranger's password, session and any passkey they
had registered kept working on it.

**What changed.** `handleEmailCodeVerify` in `workers/db-worker/src/auth.ts`: on
the first inbox proof of an unverified account (the `emailVerified` 0 to 1
transition) it sets `passwordHash = NULL`, bumps `tokenVersion` (every JWT minted
before stops verifying), deletes every row in `authSessions` and
`webauthnCredentials` for the user, then issues the owner's fresh session. TOTP
and recovery codes are kept on purpose: a mailed code is one factor, and the
second factor is still challenged rather than silently removed.

| Case                                            | Before                           | After                                                                                           |
| ----------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| stranger's token after the owner's code sign-in | `/api/auth/me` 200               | 401                                                                                             |
| stranger's password after it                    | login 200                        | login 401, `passwordHash` is NULL                                                               |
| stranger's passkey after it                     | still usable                     | row deleted                                                                                     |
| `tokenVersion`                                  | unchanged                        | exactly +1                                                                                      |
| already-verified account signs in by code       | nothing revoked                  | nothing revoked (password, other sessions, `tokenVersion` kept)                                 |
| unverified account with TOTP enrolled           | code sign-in challenged for TOTP | still challenged (`twofaRequired: true`, no token), TOTP and recovery codes kept, password NULL |

**Automated tests.** `workers/db-worker/node-tests/pre-account-takeover-integration.test.ts`

- `revokes the pre-sign-in password and session`
- `also drops any passkey registered before the proof` (also pins the single `tokenVersion` bump)
- `a verified account signing in by code keeps its password and other sessions`
- `a second-factor account is still challenged, not reset`

Related, unchanged and still green: `login-codes-integration.test.ts` (the mailed
code ceremony, including `is one factor, so a 2FA account still owes a code`) and
`passkey-integration.test.ts`.

**Dev check.** Needs an inbox you own and two browsers.

1. Browser A (private window): Sign up with that address and a password. Do not
   open the confirmation mail. You are signed in, unverified.
2. Browser B: Sign in, "Email me a code", same address, enter the mailed code.
   Signed in; the address now shows as verified.
3. Browser A: reload. You are signed out. Signing in with the password from step
   1 is refused.
4. Browser B keeps working. The sessions list under Settings shows only B.

If no mail arrives, dev's `RESEND_API_KEY` is not set; `wrangler tail --env dev`
on the DB worker prints the code as `sign-in code (email skipped...)`.

### 3.5 Rate limits: one IPv6 address was one budget (PR #1073)

**What was wrong.** Every anonymous limiter keyed on the full `CF-Connecting-IP`.
A single IPv6 allocation is a `/64`, so a tenant could take a fresh budget per
request by walking its own range. That defeated the per-address limits on the
generic writes and the boards, and on the sign-in, sign-up, mailed-code, passkey
and Apple routes, which are the limits that exist to stop guessing and junk
accounts.

**What changed.** `ipRateLimitKey()` in `workers/db-worker/src/auth.ts` buckets an
IPv6 address to its `/64` (`v6:<four hextets>::/64`), leaves IPv4 unchanged,
handles `::` compression and zone ids, and keeps the `127.0.0.1` fallback for a
missing header. Every address-keyed limiter goes through it:

- `rateLimitSubject()`: generic CRUD writes, friend-code and redeem, leaderboard,
  achievements, weekly board, demo song (anonymous callers; a signed-in caller is
  keyed by user as before);
- the `mirror-event` beacon limiter in `index.ts`;
- the auth routes in `auth.ts`: register, login, the mailed-code routes, anonymous
  provisioning and its daily tier, google-callback, verify-email, reset-password,
  sessions, device-pending, delete-account; the check/clear pairs (a correct login
  clears `login`, a verified code clears `email-code/verify`) use the same key;
- the module-level limiters: passkey options and verify (`passkey-routes.ts`),
  Apple sign-in and notifications (`apple-routes.ts`), newsletter preference and
  unsubscribe (`newsletter.ts`), review access by address (`review-access.ts`).

Not changed, on purpose: Turnstile's `remoteip` (it is what Cloudflare verifies)
and the address stored on a session row for the sessions list. Neither is a
limiter key.

| Case                                                             | Before                    | After                                  |
| ---------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| 60 mirror beacons from `2001:db8:1:2::1`, then one from `::ffff` | 201 for the sibling       | 429 with `Retry-After` for the sibling |
| the same, then `2001:db8:1:3::1` (next /64)                      | 201                       | 201                                    |
| IPv4 `203.0.113.7` exhausted, then `.8`                          | 201                       | 201 (per address, unchanged)           |
| 120 anonymous writes from one address, sibling address           | reaches the handler (401) | 429                                    |
| 10 wrong logins from one address, sibling address                | reaches the handler (401) | 429; the next /64 still reaches it     |
| 5 sign-ups from one address, sibling address                     | account created           | 429, no account created                |
| 20 refused passkey verifies from one address, sibling            | reaches the handler (401) | 429                                    |
| `fe80::1%eth0`, `2001:db8::1`, `2001:0db8:0:0:0:0:0:1`           | distinct keys             | one key per /64                        |

**Automated tests.**

- `workers/db-worker/src/ip-rate-limit-key.test.ts`: `leaves IPv4 and the fallback untouched`,
  `buckets every address in one /64 to a single key`, `keeps different /64s apart`,
  `handles compressed and zone-id forms`.
- `workers/db-worker/node-tests/ratelimit-ipv6-integration.test.ts` (real HTTP surface)
  - `the mirror event limiter`: `shares one budget across a /64`, `gives a different /64 its own budget`, `keeps IPv4 per address`
  - `the generic write limiter (rateLimitSubject)`: `shares one budget across a /64 for anonymous writes`
  - `the auth route limiters`: `login shares one budget across a /64`, `register shares one budget across a /64`
    (the refused sign-up creates no `users` row), `passkey sign-in shares one budget across a /64 (own module, same key)`

The limits these rely on, from `auth.ts`: `mirror-event` 60/min, `crud-write`
120/min, `login` 10 per 5 min, `register` 5 per 5 min, `passkey-verify` 20 per 5
min.

**Dev check (optional, needs an IPv6 client).**

```sh
for i in $(seq 61); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://api-dev.mercurypitch.com/api/mirror/event \
    -H 'Content-Type: application/json' -d '{"clientId":"client-aaaaaaaa","event":"mirror_view"}'
done
```

Sixty `201`, then `429`. A second address in the same /64 (a privacy extension
address on the same machine, for instance) answers `429` at once; the budget
returns after a minute. There is no reliable single-machine check for the
cross-address part, which is why it is pinned over HTTP in the integration test.

### 3.6 Jam: TURN credentials for anyone who could POST (PR #1074)

**What was wrong.** `POST /api/jam/ice` minted Cloudflare TURN credentials for any
same-origin POST. No room was needed, so anyone on the site could run up relay
spend billed to the TURN key.

**What changed.**

- `workers/jam-worker/src/index.ts`: the route takes `?room=<id>` and asks that
  room's Durable Object (`/internal/room-active`, new in `jam-room.ts`,
  `room-activity-core.ts`) whether at least one established peer is in it. Only
  then does it mint; otherwise it answers STUN only (`source: 'stun'`). A missing,
  empty or malformed room id, or a Durable Object that errors or answers badly,
  degrades to STUN rather than an error, so the endpoint can never stop people
  jamming.
- `src/lib/jam/ice-servers.ts`: the client names the room and caches only a
  `source: 'turn'` answer, so a STUN answer before the room is live does not stick
  for the session.
- `src/lib/jam/service.ts`: ICE servers are fetched just in time, when a peer
  connection is built (after the local peer is in the room). `handleOffer` builds
  through `ensurePeerConnection`, which reports whether the connection already
  existed, so glare handling still runs only on a pre-existing connection.

| Case                                     | Before      | After                                          |
| ---------------------------------------- | ----------- | ---------------------------------------------- |
| POST with no `?room=`                    | TURN minted | STUN, no Durable Object contacted, no mint     |
| `?room=NOT-A-ROOM`                       | TURN minted | STUN, no Durable Object contacted              |
| room exists but is empty                 | TURN minted | STUN, room asked, no mint                      |
| room with a live peer                    | TURN minted | TURN minted once                               |
| room whose only socket has departed      | TURN minted | inactive, STUN                                 |
| socket that never completed its join     | counted     | not counted                                    |
| Durable Object unreachable or non-OK     | n/a         | STUN (fails closed)                            |
| foreign `Origin`                         | 403         | 403, before any lookup                         |
| `TURN_KEY_ID` unset (dormant deployment) | STUN        | STUN                                           |
| client: STUN answer                      | cached      | not cached; a later attempt can still get TURN |

**Automated tests.**

- `workers/jam-worker/src/room-activity.test.ts`: `asks exactly the named room and reports it active`,
  `reports an empty room inactive`, `fails closed (inactive) when the DO errors or is unreachable`.
- `workers/jam-worker/src/jam-room.test.ts`, describe `/internal/room-active`:
  `reports an empty room as inactive` (200, `Cache-Control: private, no-store`,
  `{active:false, peers:0}`), `counts the established peers`,
  `does not count a socket that has departed`, `does not count a socket that never got a peer id`.
- `workers/jam-worker/src/index.test.ts`, describe `POST /api/jam/ice` (drives the
  worker's own fetch with a fake room namespace and a stubbed Cloudflare mint):
  `mints TURN for a room its Durable Object reports as live` (minted exactly once at
  the Cloudflare URL), `answers STUN only, and mints nothing, for a room with nobody in it`,
  `answers STUN only, without touching any room, when no room is named`,
  `answers STUN only, without touching any room, for a malformed room id`,
  `refuses a caller from another origin before looking at anything`.
- `src/tests/jam-ice-servers.test.ts`: `passes the whole array through, not just the first entry`,
  `names the room so the worker can mint for a live room only`, the four STUN
  fallbacks (non-200, rejected fetch, unexpected body, unparsable body),
  `ships no TURN of its own in the fallback`, `caches a relay result once per session and reuses it`,
  `does not cache a STUN result, so a later attempt can still get TURN`,
  `does not cache a fallback, so a later attempt can still get TURN`.
- `src/lib/jam/service-message-sender.test.ts`: the signalling stub now answers
  `getRoomId` and the suite waits for the just-in-time build; the sender tests
  pin that messaging still works after the change.

**Dev check.** Two devices or two browsers, both on dev.

1. Device 1 creates a jam room; device 2 joins with the code. Both connect and
   audio flows, as before.
2. On either device, DevTools, Network: `POST /api/jam/ice?room=<CODE>` answers 200. If dev has `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` set, `source` is `turn`
   and the list carries `turn:` entries; without them it is `stun` (the dormant
   state, which is also what prod did before this change).
3. From a shell, the three refusals:

```sh
curl -s -X POST 'https://dev.mercurypitch.com/api/jam/ice' -H 'Origin: https://dev.mercurypitch.com'                    # no room: "source":"stun"
curl -s -X POST 'https://dev.mercurypitch.com/api/jam/ice?room=ZZZZZZZZ' -H 'Origin: https://dev.mercurypitch.com'      # unknown room: "source":"stun"
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://dev.mercurypitch.com/api/jam/ice' -H 'Origin: https://evil.test'  # 403
```

### 3.7 Device sync: a link joined a room on its own (PR #1075)

**What was wrong.** Opening `#/sync:CODE` (the QR a receiving device shows, also a
plain link) joined the room without a tap. Joining announces the device's label,
free space and the hashes of its songs to the room, and `handleIncomingOffer` did
not check the device's role, so a peer could push a song into a device that only
meant to send.

**What changed.**

- `src/components/sync/SyncDevicesModal.tsx`: a code from a link or QR pre-fills
  the field and lands on the send screen; Connect needs a deliberate tap.
- `src/stores/sync-store.ts`: `handleIncomingOffer` returns before anything is
  imported unless `syncRole() === 'receive'`. A legitimate transfer only ever
  offers to the receiver, so this never fires in one.

| Case                                                     | Before                | After                                                            |
| -------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| open `#/sync:ABCD2345`                                   | joined the room       | code pre-filled, Connect enabled, nothing joined                 |
| open `#/sync:ABC` (incomplete)                           | refused by the parser | refused; field shows it, Connect disabled                        |
| tap Connect                                              | n/a                   | joins (`startSyncSend` with the code)                            |
| scanned code while a session is live                     | switched rooms        | no room switch (pre-existing guard)                              |
| sending device receives `sync-preparing` + `sync-offer`  | import started        | no import, no row advances, nothing sent back, role still `send` |
| sending device receives a bare `sync-offer`              | import started        | no transfer row at all                                           |
| device with no role (after `stopSync`) receives an offer | n/a                   | nothing imported, nothing thrown                                 |
| receiving device receives the same frames                | import                | import (unchanged)                                               |

**Automated tests.**

- `src/components/__tests__/SyncDevicesModal.test.tsx`:
  `a code from a link waits for a tap, then connects`, `a code from a link pre-fills the field, with Connect ready to press`
  (and `startSyncSend` not called on render), `an incomplete code keeps Connect disabled`
  (a click does nothing), `a scanned code does not switch rooms under a live session`.
- `src/tests/sync-store.test.ts`, describe `a song pushed at a device that is not receiving`:
  `a sending device drops a song pushed at it`, `the offer alone leaves nothing behind on a sending device`,
  `a device with no role drops it too`. The allowed branch is the pre-existing
  `replaces that row with the transfer rather than adding a second` under
  `telling the receiver a song is being packed`. With the role guard removed the
  two send-role tests fail, which was checked by mutation before the tests were
  committed.

**Dev check.** Two devices.

1. Device A: Karaoke, Sync devices, Receive. It shows a code and a QR.
2. Device B: open `https://dev.mercurypitch.com/#/sync:<CODE>` in the browser (or
   scan the QR). Karaoke opens with the dialog on the send screen, the code filled
   in, Connect enabled. Device A still shows no connected device.
3. Tap Connect on B. A shows B; send a song from B to A; it arrives.

### 3.8 Profiles: every user profile was listable without an account (PR #1076)

**What was wrong.** `GET /api/userProfiles` and `/api/userProfiles/count` answered
anyone, with every filter and sort the generic list supports. Federated sign-up
seeds a person's real name and photo into those columns, so the list was a
directory of every account, including people who never joined a public surface.
This reverses the documented "profiles are public" contract on purpose; the
single-profile read by id stays public because community cards need it.

**What changed.** `scopeRead` in `workers/db-worker/src/index.ts` gained an `owner`
case (`userProfiles` is the only `access: 'owner'` table): an admin lists freely;
an anonymous caller gets 401 on list and count; a signed-in caller has any
`where[id]` dropped and `id = <caller>` forced, so a list or count is only ever
their own row. `handleGetById` is unchanged: a single profile by id is still
served to anyone, masked to public identity. The hidden-column oracle guard still
applies to signed-in callers on this table.

| Request                                         | Before                 | After                            |
| ----------------------------------------------- | ---------------------- | -------------------------------- |
| anonymous `GET /api/userProfiles?limit=1000`    | every profile          | 401                              |
| anonymous list with any `where` or `sort`       | filtered directory     | 401                              |
| anonymous `GET /api/userProfiles/count`         | the number of users    | 401                              |
| anonymous `GET /api/userProfiles/<id>`          | public columns         | public columns (unchanged)       |
| signed-in `GET /api/userProfiles`               | every profile          | own row only                     |
| signed-in `?where[id]=<someone else>`           | that profile           | own row only                     |
| signed-in `/count`, with or without `where[id]` | the number of users    | 1                                |
| signed-in `?where[currentStreak]=9`             | 400 (oracle guard)     | 400 (unchanged)                  |
| `X-Admin-Key: wrong`                            | public list            | 401                              |
| admin (`X-Admin-Key` correct)                   | full list, any filter  | unchanged                        |
| league standings for a cohort-mate              | names opted-in members | unchanged, never the hidden user |

In-app readers of this table are the account section (`findById` and `update` of
the caller's own row), community profile cards (single read by id) and the league
and leaderboard endpoints, which are server-side. None of them lists.

**Automated tests.** `workers/db-worker/node-tests/query-oracle-integration.test.ts`

- describe `a profile is not a public directory`:
  `refuses an unauthenticated list, however it is filtered or sorted`,
  `refuses an unauthenticated count the same way`,
  `still keeps stripePriceId unprobeable on a table that IS public`.
- describe `the reads that must keep working`:
  `serves a single profile by id to anyone, masked to public identity`,
  `still lets the studio list and sort the whole table`,
  `lets a signed-in singer list only their own row`,
  `cannot be widened back to another user with where[id]`,
  `counts only itself`,
  `a hidden column still cannot be filtered on by a signed-in caller`,
  `an admin key with a bad value is not an admin`,
  `lets an admin filter on anything, having nothing hidden to probe`,
  `leaves a singer free to search their own private rows`.

`workers/db-worker/node-tests/league-integration.test.ts`,
`never leads back to someone who did not opt in`: the anonymous list is 401 and
the same list as the signed-in cohort-mate returns only their own id, never the
hidden user's.

**Dev check.**

```sh
curl -s -o /dev/null -w '%{http_code}\n' 'https://api-dev.mercurypitch.com/api/userProfiles?limit=1000'   # 401
curl -s -o /dev/null -w '%{http_code}\n' 'https://api-dev.mercurypitch.com/api/userProfiles/count'       # 401
TOKEN=<value of localStorage "mp:authToken" on dev.mercurypitch.com while signed in>
curl -s -H "Authorization: Bearer $TOKEN" 'https://api-dev.mercurypitch.com/api/userProfiles?limit=1000' # one row, yours
curl -s 'https://api-dev.mercurypitch.com/api/userProfiles/<your id>'                                     # 200, public columns
```

In the app: your own profile and display name still load and save (Settings,
Account), a community profile card still opens, the league standings still list
the cohort.

### 3.9 Google Drive: a connect-Drive grant was stored for the account named in the link (PR #1078)

**What was wrong.** The Google callback stored the Drive refresh token for the
user id carried in the signed `state`, then redirected with `#gdrive=1`. A
connect link started by one account and completed in a browser signed into
another (or into nothing) therefore bound the finishing person's Drive to the
starting account. Connecting a different Google account than the one used to sign
in is allowed and stays allowed; what must hold is that the grant lands on the
account that is actually signed in where the flow finishes.

**What changed.**

- `workers/db-worker/src/auth.ts`: the callback stores nothing. It seals the grant
  (`{ v: 1, uid, refresh, scope, email, exp }`, AES-GCM, 5 minute TTL) and
  redirects with `#gdrive_pending=<sealed>`. New `POST /api/auth/drive/finish`
  (Bearer) opens the blob and stores the token only when `payload.uid` equals the
  caller's `auth.userId`: 401 without a session, 400 for a missing, malformed,
  tampered or expired blob, 403 for another account.
- `src/lib/google-return-nonce.ts`: the return reader yields `{ pending }`.
- `src/db/services/auth-service.ts` (the one-shot stash of the return) and
  `src/db/services/drive-connect-service.ts` (`finishDriveConnect`, posting the
  blob with the bearer token; `startDriveConnect`, status, access token and
  disconnect moved there unchanged).
- `src/components/SyncSettings.tsx`: on mount, a pending result is finished before
  the Drive status is refreshed; a refusal shows "Google Drive could not be
  connected."

| Case                                               | Before                       | After                                          |
| -------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| callback for a drive-scoped consent                | token stored for `state.uid` | nothing stored; sealed blob in the return URL  |
| finish by the account that started                 | n/a                          | 200, token stored sealed, status connected     |
| finish by another signed-in account                | grant already on the starter | 403, nothing stored for anyone                 |
| finish while signed out                            | grant already on the starter | 401 (client reports `signed_out`)              |
| finish after 5 minutes                             | n/a                          | 400, nothing stored                            |
| tampered or malformed blob                         | n/a                          | 400, nothing stored                            |
| consent declined / no refresh token / store failed | `gdrive_error=<reason>`      | unchanged reasons, shown in the settings panel |
| the return is read twice                           | one-shot                     | one-shot (the stash is cleared on first read)  |
| a plain Google sign-in                             | never asks for Drive         | unchanged                                      |
| account deletion                                   | grant revoked at Google      | unchanged                                      |

**Automated tests.**

- `workers/db-worker/src/auth.test.ts`: `keeps the refresh token from a drive-scoped redirect, sealed`
  (through `/drive/finish`), `refuses to commit a grant for a different account` (403),
  `reports declined when the user unticks the Drive box`, `connecting a Drive never changes who you are signed in as`,
  `refuses to start a Drive connect for nobody`, `names a missing refresh token instead of pretending`,
  `answers status, mints access tokens, and disconnects`, `drops the row and says reconnect when Google revokes the grant`,
  `a plain sign-in never asks Google for Drive`, `hands the Drive grant back to Google when the account is deleted`.
- `workers/db-worker/node-tests/drive-connect-finalize-integration.test.ts` (register,
  start, a stubbed Google token exchange, finish):
  `stores nothing in the callback, and binds finish to the starter`,
  `refuses an unauthenticated or empty finish`,
  `refuses a grant older than DRIVE_PENDING_TTL_MS` (only the clock moves, six
  minutes past consent: 400 naming expiry, no row stored),
  `refuses a tampered grant and stores nothing` (one ciphertext character
  flipped: 400 and no row; the untouched grant still finishes with 200, so the
  refusal was the tamper and not a grant that was never good).
- `src/lib/google-return-nonce.test.ts`, `reads a connect-Drive outcome, which carries no nonce`:
  `#gdrive=1`, `#gdrive_error=declined` and `#gdrive_pending=SEALED.blob` are read as
  `{ ok: true }`, `{ ok: false, error: 'declined' }` and `{ pending: 'SEALED.blob' }`.
- `src/tests/auth-service.test.ts`:
  `records a pending grant from a #gdrive_pending return, one-shot` (the stash
  yields `{ pending }` once, no sign-in result is produced, the stashed route is
  restored); describe `finishDriveConnect`: `does not call the worker while signed out`,
  `commits the grant with an authenticated POST to /drive/finish` (URL, method,
  bearer header and `{ pending }` body asserted), `reports a grant the worker refuses as finish_failed`,
  `reports a network failure as offline`.
- `src/components/__tests__/SyncSettings.test.tsx`:
  `finishes a pending Drive grant before deciding what to show` (finish called
  once with the blob and before the status read; a fresh connect re-scans past a
  held comparison), `shows the refusal when finishing the grant fails` ("Google
  Drive could not be connected." rendered, status still refreshed, no scan),
  `does not take a failed finish for a fresh connect`,
  `names a declined consent, with no grant to finish`. The Drive function mocks
  in `drive-sync-store.test.ts` and `sync-settings-copy.test.tsx` follow the
  module move.

**Dev check (the live Google round trip; nothing in CI can do this).**

1. Signed in on dev, Settings, Sync, "Connect Google Drive". Consent at Google
   (any Google account). Back in the app the panel shows the Drive as connected
   and the scan runs. DevTools, Network: `POST /api/auth/drive/finish` answered
   200, and the return URL briefly carried `#gdrive_pending=`.
2. Cross-account refusal: start the flow again, and on the Google consent page
   copy nothing yet; after consent, before the app consumes it, copy the full
   return URL from the address bar (it contains `#gdrive_pending=...`; the redirect
   chain is also visible under Network with "Preserve log"). Open that URL in a
   browser signed into a different dev account. Expected: "Google Drive could not
   be connected." and that account's Drive stays disconnected.
3. Expiry: open the same URL in the starting account more than five minutes after
   the consent. Expected: the same refusal.
4. Disconnect, then reconnect once more to confirm the ordinary path still works.

The Google OAuth client's redirect URI for the dev worker is unchanged by this
PR; no console change is needed.

## 4. The dev walk, in order

Expected time: about forty minutes with two devices and an inbox at hand.

1. Confirm what dev serves (the command at the top) is at or after the last merge.
2. 3.8 Profiles: the four `curl` lines (two minutes).
3. 3.3 Admin key: unlock, sign out, key gone.
4. 3.4 Pre-account reclaim: two browsers, one inbox.
5. 3.7 Sync link: two devices.
6. 3.6 Jam ICE: two devices, then the three `curl` refusals.
7. 3.9 Drive connect: the live round trip and the cross-account refusal.
8. 3.1 Split a song; optionally the `curl` negative.
9. 3.5 Rate limits: optional, only with an IPv6 client.
10. 3.2 Analytics: not on dev; local production build now, or on prod right after
    the release.

Record for each step: pass, or what was seen. A failed step blocks the release
until it is understood; the automated test for that step names the exact
behaviour that was expected.

## 5. Merge order

Each PR is rebased onto `main` before it merges, CI must be green on the rebased
head, and the nine merge one at a time in this order:

1. #1069 stem separation (worker edge and handler; no overlap with the rest)
2. #1070 analytics fragment (`consent.ts` only)
3. #1075 sync link (sync modal and store)
4. #1073 rate limits (`auth.ts` limiters, `index.ts` mirror event, four modules)
5. #1076 profiles (`index.ts` scopeRead; rebased over #1073's `index.ts` change)
6. #1072 pre-account reclaim (`auth.ts` email-code verify; rebased over #1073)
7. #1074 jam TURN gate (jam worker, jam client, `docs/agent/INDEX.md`)
8. #1078 Drive finalize (`auth.ts` Drive routes; moves the Drive client calls out
   of `auth-service.ts`, which is what brings that file back under the 1500-line
   ratchet)
9. #1071 admin key on logout (`auth-service.ts`; must follow #1078, or the ratchet
   stays red on file size)
10. this document

The commits are authored by the repository owner and carry no tool attribution.

## 6. Before `/prod-upd`

- All nine PRs merged; the `pr-gate` run on `main` for the last merge is green.
- The dev walk above done, with step 2 to 7 passing; step 8 passing or the
  RunPod path confirmed unused on dev; steps 9 and 10 noted as optional or
  deferred.
- Release notes: user-visible behaviour changed in two places. A sync link or QR
  now needs a tap on Connect (#1075). Connecting Google Drive finishes inside the
  app after the Google consent (#1078). Everything else is invisible to a user.
- No database migration. No new secret. `RUNPOD_AUDIO_URL_ALLOWED_HOSTS` stays
  unset. The jam worker's TURN secrets are unchanged; where they are absent the
  ICE route answers STUN as it always did.
- Rows in `auth_ratelimit` keyed by a raw IPv6 address linger until their window
  expires (at most 24 hours for `anonymous-day`); they are never read again and
  need no cleanup.

After the tag: the analytics `dl` check (3.2) on mercurypitch.com, and `source` on
the prod `POST /api/jam/ice` for a live room, which must be `turn` where the prod
TURN key is configured.

## 7. Residual risk and what is deliberately out of scope

- The Python guard test is not in CI. A change to `runpod/handler.py` must be
  accompanied by a local pytest run.
- Rate limiting by `/64` is coarser for a household that shares one allocation:
  one person's ten failed logins hold the sign-in budget for everyone on that
  line for five minutes, and one person's correct login clears it. That is the
  same trade every per-address limit already made, moved to the unit an IPv6
  tenant actually controls.
- Turnstile's `remoteip` is reported to Cloudflare raw by design.
- #1076 is a contract reversal: any external consumer of the public profile list
  breaks. None exists in this repository; the in-app readers are listed in 3.8.
- Connecting a different Google account than the sign-in account is intended and
  unchanged.
- Nothing here changes the Capacitor shells; the native builds in CI run against
  the same worker surface.
