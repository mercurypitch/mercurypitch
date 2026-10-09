# Google Return Binding — EARS Requirements

Requirements for telling a Google sign-in this browser started from a link
somebody else wrote. The worker hands a Google sign-in back in the URL
fragment (`#gauth=<session>`), and a fragment is a link anyone can write.
Until 2026-10-09 every page that takes a Google return stored any session it
found there: a link holding the sender's own session signed whoever opened it
in to the sender's account (login CSRF), and `gauth_new=1` adopted their
unclaimed takes into it. `#gauth_error=account_suspended` signed people out,
and any other `#gauth_error=` put the link's own words in the failure toast.

**Source:** `src/lib/google-return-nonce.ts` — `beginGoogleReturn()`,
`readGoogleReturn()`; `src/db/services/auth-service.ts` —
`googleSignInUrl()`, `consumeGoogleRedirect()`;
`workers/db-worker/src/auth.ts` — `handleGoogleStart`,
`handleGoogleCallback`, `OAuthState.nonce`
**Tests:** `src/lib/google-return-nonce.test.ts`,
`src/tests/auth-service.test.ts`, `src/tests/device-secret.test.ts`,
`src/lib/room-google-return.test.ts`, `src/features/guitar-night/main.test.tsx`,
`src/features/drum-night/main.test.tsx`,
`workers/db-worker/node-tests/google-return-nonce-integration.test.ts`,
`src/e2e-cloud/google-return-binding.spec.ts`,
`src/e2e-cloud/google-signup-voiceprint-adoption.spec.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Starting a sign-in — `REQ-GRB-001..002`

### REQ-GRB-001 — The browser keeps a nonce for the sign-in it starts

**WHEN** the app starts a Google sign-in, it shall mint a nonce of 256 random
bits, keep it in localStorage for fifteen minutes, and send it in the body of
`POST /api/auth/google/start`. A later start replaces it. **IF** storage
refuses the write, **THEN** the sign-in shall not start, and the singer is told
it could not be reached.

### REQ-GRB-002 — The worker echoes it beside everything it sends back

**WHEN** a start carries a well-formed nonce (16 to 128 base64url
characters), the worker shall sign it into the OAuth state and append it as
`gauth_nonce` to every redirect a verified state produces: the session, the
second-factor ceremony and every error. **IF** the nonce is missing or
malformed, **THEN** the state carries none and the redirects are unchanged, so
an older app keeps working.

## Taking a return — `REQ-GRB-003..006`

### REQ-GRB-003 — Only this browser's return signs anybody in or out

**IF** a return's `gauth_nonce` is not the pending nonce, or no nonce is
pending, or the pending one is older than fifteen minutes, **THEN** the app
shall not store its session, open its second-factor pane, act on its error
code, count a sign-up, mark the account as created, adopt any take, or
remember Google as the way this device signs in.

### REQ-GRB-004 — A return counts once

**WHEN** a return's nonce matches, the app shall spend the pending nonce, so
the same link opened again signs nobody in. A return with a different nonce
leaves the pending one for its own return.

### REQ-GRB-005 — A refused sign-in says so, in the app's words

**WHEN** a refused return carried a session or a ceremony, the app shall
report that the sign-in did not start in this browser and ask the singer to
sign in again from here. A refused error is dropped without a word: no
sentence of the link's choosing reaches the screen.

### REQ-GRB-006 — Two returns stay unbound

`#gauth_error=expired_state` shall be honoured without a nonce, because the
worker could not read the state that would have carried one; it maps to one
fixed sentence. A connect-Drive outcome (`#gdrive=1`, `#gdrive_error=…`)
shall be read as before (`REQ-DRV-*`): it cannot change who is signed in, and
the settings page maps its codes to fixed sentences.

## Every page — `REQ-GRB-007`

### REQ-GRB-007 — One consumer for every page that takes a return

The main app, Karaoke Night, Guitar Night and Drum Night shall each take a
Google return through `consumeGoogleRedirect()`, and every Google sign-in shall
start through `googleSignInUrl()`, so no page can take a return the binding
has not checked. The native app is out of scope: its sheets return a session
in a response body, never in a URL.
