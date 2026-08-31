# Passkeys, TOTP 2FA and email-code sign-in

**Status:** design approved 2026-08-31, implementation not started
**Worker:** `mercury-pitch-db` (`workers/db-worker`)
**Shape:** one PR, four commits (sessions → 2FA → email-code → passkeys)

Ported from the Token Circles implementation (PRs #500–#503 in that repo).
The architecture is taken; the code is not — the two apps differ in session
transport, id type and CORS policy, and each of those differences forces a
real adaptation. This document records what carries over, what changes and
why.

---

## 1. Why these three, and what they are worth

Mercurypitch today offers password, Google, anonymous-device, and TV device
linking. Every one of those ends in a 30-day Bearer JWT in `localStorage`.
There is no second factor available to anyone who wants one, and no way to
sign in without either a password or Google.

| Feature                   | What it adds                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| TOTP 2FA + recovery codes | A second factor for accounts that want one. Standard authenticator apps, no SMS.                        |
| Email-code sign-in        | Sign in with a 6-digit code mailed to the address on file. No password to remember, no reset dance.     |
| Passkeys (WebAuthn)       | One-tap sign-in that is phishing-resistant and already two factors (possession + device biometric/PIN). |

A per-device session table lands first because two of the three depend on it,
and because it fixes a shipped bug on its own (§3).

---

## 2. What changes from the Token Circles design, and why

### 2.1. Ceremony state moves from a cookie to the response body

Token Circles keeps mid-ceremony state in a short-lived, HMAC-signed,
`httpOnly` cookie (`fm_2fa`, `fm_logincode`, `fm_webauthn`). The server stays
stateless between "here is your challenge" and "here is my answer".

That is not available here. `workers/db-worker/src/index.ts` answers every
request with `Access-Control-Allow-Origin: *`, and the CORS spec forbids
credentialed requests against a wildcard origin. Making cookies work would
mean replacing the wildcard with a reflected-origin allowlist across the whole
worker, then adding `credentials: 'include'` to every client call — a change to
every endpoint in the app in service of three new ones.

So the same signed blob travels in the JSON body instead:

```
ceremony = b64url(JSON{purpose, exp, …claims}) . b64url(HMAC-SHA256(payload, JWT_SECRET))
```

The server mints it, returns it in the response, and the client echoes it back
in the next request body. The HMAC is what makes it unforgeable; the `exp` is
what makes it short-lived; the `purpose` is what stops a challenge minted for
one ceremony being spent on another. Compared with the cookie version it loses
exactly one property: it is readable by JavaScript. Since the session JWT that
a completed ceremony produces already lives in `localStorage`, script running
in the page can already do everything a stolen ceremony token would allow. No
new exposure.

It gains one property worth naming: no ambient authority, so none of these
endpoints has a CSRF surface.

Four purposes, each with its own claims and TTL:

| `purpose`       | Minted by                                   | Claims                | TTL    |
| --------------- | ------------------------------------------- | --------------------- | ------ |
| `2fa`           | login / email-code verify / Google callback | `userId`, `provider`  | 5 min  |
| `logincode`     | `email-code/request`                        | `codeId`, `email`     | 10 min |
| `webauthn-reg`  | `passkeys/register/options`                 | `challenge`, `userId` | 5 min  |
| `webauthn-auth` | `passkeys/login/options`                    | `challenge`           | 5 min  |

A verifier always asserts the expected `purpose`. A token for one ceremony
presented to another is refused before its claims are read.

### 2.2. String ids, not integers

`users.id` is a UUID string. Every foreign key below is `TEXT`.

### 2.3. camelCase schema

Existing tables are `sessionRecords`, `passwordResets`, `emailVerifications`,
`deviceLinkCodes`. New tables follow: `authSessions`, `totpCredentials`,
`recoveryCodes`, `loginCodes`, `webauthnCredentials`.

### 2.4. A dedicated key for TOTP secrets at rest

Token Circles HKDF-derives its TOTP encryption key from `JWT_SECRET`, and
documents the consequence: rotating `JWT_SECRET` orphans every TOTP secret.

This repo has already made the opposite call once — `BACKGROUND_CAPABILITY_SECRET`
carries an explicit "do not reuse JWT_SECRET" instruction in `wrangler.jsonc`.
Follow it. `TOTP_KEK` is a new per-environment secret; the AES-256-GCM content
key is HKDF-derived from it with an info label, so the stored secret is never
used as a key directly.

**Already provisioned** (2026-08-31): 48 random bytes as 64 base64url
characters, in the Proton Pass `dev` vault as `MP_TOTP_KEK_DEV` and
`MP_TOTP_KEK_PROD`. The dev value is in `workers/db-worker/.dev.vars`. Both
still need `wrangler secret put` per environment:

```bash
pass-cli item view --vault-name dev --item-title MP_TOTP_KEK_DEV --field password \
  | pnpm exec wrangler secret put TOTP_KEK --config workers/db-worker/wrangler.jsonc --env dev
```

With `TOTP_KEK` unset the 2FA routes answer 503 and say so. They must never
throw, and nothing else in the worker may notice its absence.

### 2.5. Rate limiting uses the limiter this repo already has

`checkRateLimit(db, subject, endpoint)` with a `RATE_LIMITS` table keyed by
route name. Two consequences for this work:

- **Every new route needs a `RATE_LIMITS` entry.** An unlisted endpoint returns
  `{ allowed: true }` unconditionally — omitting one is a silent hole, not a
  default.
- **`clearRateLimit` does not exist yet and must be added** (§7.1).

---

## 3. Migration 0038 — `authSessions`

0038–0041 are unused on every branch in the repository as of 2026-08-31.

```sql
CREATE TABLE IF NOT EXISTS authSessions (
  id TEXT PRIMARY KEY,          -- random uuid, carried in the JWT as `sid`
  userId TEXT NOT NULL,
  provider TEXT,                -- 'password' | 'google' | 'email' | 'passkey' | 'anonymous'
  userAgent TEXT,               -- verbatim; the readable label is derived at render time
  ip TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  lastSeenAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_authSessions_user ON authSessions(userId);
CREATE INDEX IF NOT EXISTS idx_authSessions_lastSeen ON authSessions(lastSeenAt);
```

### Why this is first, and not optional

`handleLogout` currently does this:

```sql
UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ?
```

That is the only revocation mechanism there is, and it revokes _everything_.
Signing out on a phone signs out the laptop and the television. There is no
way to end one session, and no way to show anyone where they are signed in.

It also blocks the single most important thing 2FA enrollment must do. When
someone turns on 2FA, every session that predates enrollment got in on one
factor — including, in the case this feature exists for, an intruder's. Token
Circles kills every _other_ session at enrollment and keeps the enrolling one.
Without a session table the only available choices are "sign out nobody" or
"sign out everybody including the person mid-setup", and neither is right.

### How it works

`sid` is added to the JWT payload. `getAuth` gains a lookup: a token whose
`sid` names a row that no longer exists is refused with a distinct reason
(`session_ended`) — the device was signed out. Tokens minted before this
migration carry no `sid` and keep working unchanged; `tokenVersion` remains
as the blunt "sign out everywhere" instrument, and is the only thing that can
revoke a `sid`-less legacy token.

`lastSeenAt` is touched at most once per 5 minutes per session, not per
request — otherwise every authenticated call pays for a D1 write to a column
nobody reads more precisely than "today". Fire-and-forget: a failed touch must
never fail the request.

Expired rows are swept in the existing 6-hourly `scheduled` handler, with a
day of slack past the token TTL so no row is ever removed while its token
still verifies. Without a sweep the table grows by a row per sign-in forever
and the session list fills with dead entries that "sign out this device"
cannot remove, because there is nothing left to revoke.

### Route changes

| Route                           | Change                                                                    |
| ------------------------------- | ------------------------------------------------------------------------- |
| `POST /api/auth/logout`         | Deletes this session's row. `tokenVersion` untouched.                     |
| `POST /api/auth/logout-all`     | New. Bumps `tokenVersion` — the old logout behaviour, now named honestly. |
| `GET /api/auth/sessions`        | New. This account's devices, current one flagged.                         |
| `DELETE /api/auth/sessions/:id` | New. End one device.                                                      |

---

## 4. Migration 0039 — TOTP 2FA

```sql
CREATE TABLE IF NOT EXISTS totpCredentials (
  userId TEXT PRIMARY KEY,
  secretEnc TEXT NOT NULL,      -- base32 secret, AES-256-GCM under a TOTP_KEK-derived key
  keyVersion INTEGER NOT NULL DEFAULT 1,
  lastUsedStep INTEGER,         -- RFC 6238 anti-replay high-water mark
  confirmedAt TEXT,             -- NULL between "show the QR" and "a valid code was typed"
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recoveryCodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  codeHash TEXT NOT NULL,       -- SHA-256; the raw code exists only on the user's copy
  usedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recoveryCodes_user ON recoveryCodes(userId);
```

### Design points

- **SHA-1 / 6 digits / 30 s.** Not a preference — it is what Google
  Authenticator, Aegis and 1Password assume when scanning an `otpauth://` URI.
  RFC 6238's HMAC construction is unaffected by SHA-1 collision attacks.
- **`confirmedAt IS NULL` means enrollment was abandoned.** Only a confirmed
  row makes login demand a second factor. An abandoned setup must never lock
  anyone out.
- **`lastUsedStep` makes each code single-use.** Verification passes
  `minStep = lastUsedStep + 1`, so shoulder-surfing a code that was just used
  buys nothing inside its 30-second window.
- **Verification compares every candidate in the drift window with no early
  exit,** and compares digit strings in constant time. A leaked mismatch
  position must not narrow the guess space.
- **Recovery codes are hashed, not encrypted.** They therefore survive a
  `TOTP_KEK` rotation, which is the fallback path if one ever happens.
  Normalised on input (case and separators ignored) because people retype
  these off paper.
- **Enrollment replaces any previous batch of recovery codes.** Old sheets
  stop working the moment new ones exist.

### Login becomes two steps, for MFA accounts only

```
POST /api/auth/login  --password ok-->  confirmed TOTP?  --no-->  { token, userId, user }
                                             |yes
                                             v
                                       { twofaRequired: true, ceremony }     <- no token
POST /api/auth/2fa/verify { ceremony, code }  -->  { token, userId, user }
```

`code` is either a 6-digit TOTP code or a recovery code; the shape decides
which. The same fork happens after email-code verify (§5). Google's redirect
callback hands back `#gauth_2fa=<ceremony>` instead of `#gauth=<token>` — the
same URL-fragment channel the token already uses, so the same exposure
profile, and the client opens the 2FA pane instead of storing a session.

### Routes

| Route                        | Auth     | Notes                                                                            |
| ---------------------------- | -------- | -------------------------------------------------------------------------------- |
| `GET /api/auth/2fa/status`   | Bearer   | `{ enabled, recoveryCodesLeft }`                                                 |
| `POST /api/auth/2fa/setup`   | Bearer   | Returns secret + `otpauth://` URI. 409 if already enabled.                       |
| `POST /api/auth/2fa/enable`  | Bearer   | Confirms a code, returns the recovery codes **once**, kills every other session. |
| `POST /api/auth/2fa/disable` | Bearer   | Requires a current code or a recovery code.                                      |
| `POST /api/auth/2fa/verify`  | ceremony | Pre-session. Trades a code for a token.                                          |

`/2fa/disable` shares `/2fa/verify`'s rate-limit bucket (`2fa:<userId>`) on
purpose: both accept the same proof, so an attacker must not get a fresh
guessing budget by attacking the disable path instead of the challenge.

Spending a recovery code during a _disable_ attempt is deliberate — a code
shown to a shoulder-surfer must not remain valid for a later login.

---

## 5. Migration 0040 — email-code sign-in

```sql
CREATE TABLE IF NOT EXISTS loginCodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,          -- kept alongside userId: a code is minted for one ADDRESS
  codeHash TEXT NOT NULL,       -- SHA-256; the raw code exists only in the email
  attempts INTEGER NOT NULL DEFAULT 0,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loginCodes_email ON loginCodes(email);
CREATE INDEX IF NOT EXISTS idx_loginCodes_user  ON loginCodes(userId);
```

### Making a 10^6 code space defensible

The hash is not what makes a 6-digit code safe. These four layers are:

1. **The ceremony token addresses exactly one row.** Verification is not "does
   this code match any live code for this address" — it is "does this code
   match the row this browser was told about". A third party who fires
   `/request` for someone else's address gets a token for a code they cannot
   read, and no surface at all to guess at the victim's own code.
2. **Per-row attempt burn.** Five wrong guesses and the row stops matching
   forever.
3. **Ten-minute TTL and single use.** The claiming `UPDATE` is the atomic gate,
   so a double submit cannot sign in twice.
4. **Layered rate limits** (§7.1).

A new `/request` does **not** invalidate codes already in flight — that would
let anyone kill the code a user is busy typing just by firing `/request` for
their address. Instead the live set is capped at 3, oldest pruned first.

### Anti-enumeration

`/request` answers identically for a registered and an unregistered address.
The unknown branch mints a decoy code, hashes it (equal CPU), and signs a
ceremony token addressed to row id 0, which never matches. The two branches
differ by one `INSERT`, not by crypto or by mail latency.

The mail send goes through `ctx.waitUntil` rather than being awaited. An
awaited Resend round-trip is 100–400 ms of timing oracle separating known
addresses from unknown ones, and its failures leak the same way a 500 does.
This mirrors what `handleForgotPassword` already does in this worker.

### One free consequence

Typing a mailed code is proof of inbox control — the same proof the
verification link asks for. So a successful `/verify` sets `emailVerified = 1`,
resolving any pending "confirm your address" state.

### Second factor still applies

An email code proves the inbox. That is one factor, not two. If the account
has confirmed TOTP, `/verify` returns `{ twofaRequired: true, ceremony }`
exactly as password login does.

---

## 6. Migration 0041 — passkeys (WebAuthn)

```sql
CREATE TABLE IF NOT EXISTS webauthnCredentials (
  id TEXT PRIMARY KEY,          -- the authenticator's credential id (base64url)
  userId TEXT NOT NULL,
  publicKey TEXT NOT NULL,      -- COSE key bytes, base64url. Only the PUBLIC half ever exists here.
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  deviceName TEXT,
  backedUp INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  lastUsedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_webauthnCredentials_user ON webauthnCredentials(userId);
```

### Dependency

`@simplewebauthn/server` — the db-worker's first runtime npm dependency. It
handles CBOR/COSE parsing, attestation and authenticator quirks. Hand-rolling
attestation parsing is the wrong place to save a dependency.

### Relying-party identity

A passkey is minted for the domain the user sees, never for the API host.
`PASSKEY_RP_ID` is a new per-environment `vars` entry — `mercurypitch.com`
(prod), `dev.mercurypitch.com` (dev), `localhost` (local). `expectedOrigin` is
the environment's existing `ALLOWED_ORIGINS` list.

Falling back to the request URL when unconfigured is forbidden: it would mint
credentials bound to `api.mercurypitch.com` that every sign-in from the app
origin then fails against, silently. No configured RP id means the passkey
routes answer 503.

**Accepted limitation:** passkeys will not work on `*.workers.dev` PR
previews. `workers.dev` is a public suffix, so no RP id can be minted for it.
2FA and email-code sign-in work everywhere. This is a property of WebAuthn,
not of the implementation.

### User verification is REQUIRED on both ceremonies

Not "preferred". A user-verified passkey is possession (the device) plus
inherence (the biometric or PIN) in a single gesture, which is why passkey
login deliberately does **not** trigger the TOTP challenge — it already is
MFA. `residentKey: 'required'` too, so the sign-in button works with no
username typed first.

Registration and login must agree: a credential registered without user
verification would register fine and then never be able to sign in.

### Sudo mode on registration

Adding a passkey mints a credential that skips the TOTP challenge and survives
password resets. That is stronger than anything a bare session cookie proves,
so a session younger than 10 minutes (the post-login nudge) may add one
directly; anything older must re-present the password or a 2FA code. This is
GitHub's sudo-mode rule.

### Other details worth keeping

- **10 passkeys per account.** Unbounded rows eventually overflow
  authenticators' `excludeCredentials` limits and break the legitimate owner's
  own "add" button.
- **A double-submitted registration answers 409,** not a leaked D1 UNIQUE
  error string. The ceremony lives 300 s and browsers do double-submit.
- **A signature counter that runs backwards is logged distinctly.** It is the
  one signal that a credential may have been cloned, and must be
  distinguishable from an ordinary bad signature.
- **The options endpoint gets a roomier bucket than verify.** Conditional UI
  fires one options call per login-screen load, so an office behind one
  address burns those without anyone clicking anything.

---

## 7. Cross-cutting changes

### 7.1. `clearRateLimit` — a bug fix that arrives with this work

The limiter has no way to forget a bucket. `login` is capped at 10 per 5
minutes per IP, and **successful** logins count against it. One person with a
phone, a tablet and a laptop, or a household behind one address, can lock
themselves out of their own password by signing in correctly.

Add `clearRateLimit(db, subject, endpoint)` and call it after every successful
sign-in, on every path. Failures still accumulate exactly as before, so a run
of wrong passwords is refused unchanged.

### 7.2. Layered buckets

Per-IP is a flood guard on a key that is not a person — a household, a school
music lab and an entire mobile carrier behind CGNAT all share one. The
per-account bucket is what actually stops guessing at a specific account. Both
are needed; both clear on success. The limiter's subject column is already
used for non-IP keys (`rateLimitSubject` returns `user:<id>`), so
`email:<address>` needs no schema change.

New `RATE_LIMITS` entries: `2fa` (shared verify/disable), `2fa-setup`,
`login-email`, `logincode-request-ip`, `logincode-request-email`,
`logincode-verify`, `passkey-reg`, `passkey-options`, `passkey-verify`,
`sessions-write`.

### 7.3. Account deletion

All four new tables go into `USER_OWNED_TABLES` in `auth.ts`. Without those
lines, deleting an account leaves that person's TOTP secret, recovery codes
and passkeys in D1 under an id that no longer belongs to anyone. They stay out
of `tables.ts`, matching the `passwordResets` / `googleDriveTokens` precedent
for worker-internal tables.

### 7.4. Which accounts can use what

Anonymous device identities get none of these. Passkeys, 2FA and email-code
sign-in require an account with `authProvider` of `password` or `google`, and
email-code additionally requires an address on file.

### 7.5. Auth logging — explicitly out of scope

Token Circles' `auth_logs` table is good and this worker would benefit, but it
is a separate concern with its own retention story. Denials in this work use
structured `console.warn` lines (captured by Workers Observability) with the
reason attached. A D1 audit trail can follow later.

---

## 8. Module layout

`workers/db-worker/src/auth.ts` is 2857 lines. Nothing large goes into it.

| New module             | Contents                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| `src/auth-ceremony.ts` | Mint/verify the signed ceremony token. Shared by all three features.              |
| `src/auth-sessions.ts` | `authSessions` CRUD, `sid` issuance, throttled touch, expiry sweep.               |
| `src/totp.ts`          | RFC 6238 + RFC 4648 base32. Pure, no DB, no env.                                  |
| `src/twofa.ts`         | Secret encryption under `TOTP_KEK`, recovery codes, status, `verifySecondFactor`. |
| `src/login-codes.ts`   | 6-digit mint/verify, attempt burn, live-set cap.                                  |
| `src/passkeys.ts`      | `@simplewebauthn/server` wrappers, credential rows, sudo-mode check.              |

`handleAuth` stays the single `/api/auth/*` router and delegates to these.
Each new module gets the banner header comment the generated index harvests.

### Client

| New / changed                                  | Contents                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/webauthn.ts`                          | base64url ↔ ArrayBuffer, both ceremonies as single calls, conditional-UI autofill, abort handling. |
| `src/db/services/auth-mfa-service.ts`          | Client for the new endpoints. `auth-service.ts` is already 40 KB.                                  |
| `src/components/account/AuthModal.tsx`         | New `'twofa'` and `'email-code'` panes; a passkey button on the login pane.                        |
| `src/components/account/TwoFactorSettings.tsx` | QR, confirm, recovery-code sheet, disable.                                                         |
| `src/components/account/PasskeySettings.tsx`   | List, add, remove, reauth prompt.                                                                  |
| `src/components/account/SessionList.tsx`       | Devices, current one flagged, end-one and end-all.                                                 |

Conversions in `webauthn.ts` are hand-rolled rather than using
`PublicKeyCredential.parseCreationOptionsFromJSON`: that static only reached
Safari recently and sign-in must not break there.

Browsers blur cancel, no-credential and config-mismatch into a single
`NotAllowedError` on purpose. A `console.warn` with the raw error is the only
diagnostic a misconfigured deployment ever gets — keep it. A user pressing
Escape is not an error worth red text.

---

## 9. Testing

**Worker units** (`vitest`, `pnpm test:db`)

- `totp.test.ts` — RFC 6238 published test vectors; base32 round-trip; drift
  window; `minStep` replay rejection; constant-time compare.
- `twofa.test.ts` — encrypt/decrypt round-trip; wrong-key fails closed;
  recovery-code normalisation; a code consumes exactly once under double
  submit; enrollment replaces the previous batch.
- `login-codes.test.ts` — attempt burn; expiry; single use; live-set cap does
  not invalidate an in-flight code.
- `passkeys.test.ts` — a software authenticator helper drives real
  registration and assertion; counter regression rejected; unknown credential
  rejected; UV-absent credential rejected.
- `auth-sessions.test.ts` — `sid` revocation; legacy `sid`-less token still
  verifies; touch throttle; sweep leaves live rows.
- `auth-ceremony.test.ts` — tampered payload, tampered MAC, expired, and
  wrong-`purpose` tokens all refused.

**Integration** (`node-tests/`, real SQLite via `node-tests/sqlite-d1.ts`)

- Migrations apply cleanly on a fresh DB and on one already at 0037.
- Full login → 2FA-challenge → verify path issues exactly one session.
- Enabling 2FA leaves exactly one session standing.
- Account deletion removes every row from all four new tables.

**Client** (`vitest` + solid-testing-library) — the two new AuthModal panes,
the settings components, and the base64url conversions in `webauthn.ts`.

**E2E** (Playwright) — `twofa-login.spec.ts`, `email-code-login.spec.ts`,
`passkeys.spec.ts`, the last using Chrome's CDP virtual authenticator. Pass
`VITE_E2E_PORT` to avoid the port-3001 collision with other agents.

---

## 10. Risks

| Risk                                                                                                                                                    | Handling                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `node_modules` in this worktree, and `pnpm install` has died on sharp/node-gyp here before. Adding `@simplewebauthn/server` needs a lockfile update. | **Step 0** of implementation: prove `pnpm install --ignore-scripts` works before writing anything. If it does not, the WebAuthn dependency decision has to be revisited before the passkey commit. |
| `TOTP_KEK` unset in an environment.                                                                                                                     | Routes answer 503 with a clear message; nothing else in the worker notices. Never throw.                                                                                                           |
| Migration number collision with a sibling branch.                                                                                                       | 0038–0041 verified free across all branches on 2026-08-31. Re-check before pushing — the shared preview D1 carries other branches' migrations.                                                     |
| `pnpm check` does not cover worker files.                                                                                                               | Run `pnpm typecheck:db` and prettier on worker files explicitly, or the deploy breaks.                                                                                                             |
| Google-callback 2FA fork is the least-tested path.                                                                                                      | Covered by an integration test, not only e2e — the redirect flow is awkward to drive in a browser.                                                                                                 |

---

## 11. Commit plan

| #   | Commit                                                           | Contents                                                                                            |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `feat(auth): one row per signed-in device`                       | 0038, `auth-sessions.ts`, `sid` in JWT, logout/logout-all/sessions routes, `clearRateLimit`, tests. |
| 2   | `feat(auth): TOTP two-factor authentication with recovery codes` | 0039, `totp.ts`, `twofa.ts`, `auth-ceremony.ts`, the login fork, settings UI, tests.                |
| 3   | `feat(auth): email-code sign-in`                                 | 0040, `login-codes.ts`, mail template, the request/verify pair, AuthModal pane, tests.              |
| 4   | `feat(auth): passkey sign-in and registration (WebAuthn)`        | 0041, `passkeys.ts`, `src/lib/webauthn.ts`, dependency, settings UI, sudo mode, tests.              |

One PR. Commit 1 is a prerequisite for 2; 3 and 4 both depend on 2's ceremony
primitive.
