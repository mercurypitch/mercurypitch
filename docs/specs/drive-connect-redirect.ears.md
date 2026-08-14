# Drive Connect Redirect — EARS Requirements

Requirements for consuming the fragment Google's redirect leaves on the
URL after a connect-Drive pass. A Drive connect rides the same redirect
flow as sign-in but is NOT a sign-in: the worker returns from it before
resolving any account — deliberately, so picking a different Google
account for your Drive cannot change who you are signed in as — which
means the return carries `#gdrive=1` or `#gdrive_error=…` and no `gauth`
token at all.

**Source:** `src/db/services/auth-service.ts` — `consumeGoogleRedirect()`
(runs once at app startup, before the router boots),
`takeDriveConnectResult()`
**Tests:** `src/tests/auth-service.test.ts` (`REQ-DRV-*`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Recording the outcome — `REQ-DRV-001..003`

### REQ-DRV-001 — A Drive-only return is consumed at all

**WHEN** the app starts with a URL fragment beginning `#gdrive`, the
system shall consume it exactly as it consumes a `#gauth` fragment — even
though no sign-in token is present. (The defect this spec exists for:
matching only `#gauth` returned early on every Drive connect, so every
outcome below was silently lost.)

### REQ-DRV-002 — Success and refusal are both recorded

**WHEN** a consumed return carries `gdrive=1`, the system shall record a
Drive outcome of success. **WHEN** it instead carries a non-empty
`gdrive_error`, the system shall record a refusal carrying that reason
verbatim (`declined`, `no_refresh_token`, `store_failed`), so the
settings page can say why rather than silently still reading "not
connected".

### REQ-DRV-003 — The Drive outcome survives a combined pass

**WHERE** a return carries both a sign-in token and a Drive marker (a
combined pass — not produced by the worker today, but the shape the code
must stay correct for), the system shall record the Drive outcome
independently of the sign-in outcome: a succeeded sign-in with a declined
Drive half shall yield both a sign-in result and a Drive refusal.

## Not a sign-in — `REQ-DRV-004`

### REQ-DRV-004 — A Drive return neither signs in nor signs out

**WHEN** a Drive-only return is consumed, the system shall not produce a
sign-in result and shall not modify the stored auth token. **IF** a
Drive return were treated as a sign-in, **THEN** connecting a Drive under
a different Google account could move the person into another account,
taking their library and credits with it.

## The stashed route — `REQ-DRV-005`

### REQ-DRV-005 — Every consumed return restores and clears the stash

**WHEN** any `#gauth` or `#gdrive` return is consumed — success or
refusal alike — the system shall replace the fragment with the route
stashed before the redirect and remove the stash. The stash is one-shot:
left unconsumed it does not merely lose the current route, it waits in
`sessionStorage` and hijacks the next unrelated Google sign-in.

## Leaving everything else alone — `REQ-DRV-006`

### REQ-DRV-006 — Unrelated fragments are untouched

**IF** the fragment at startup is neither `#gauth` nor `#gdrive`, **THEN**
the system shall leave the fragment, the stashed route and the Drive
outcome all untouched.

## One-shot reads — `REQ-DRV-007`

### REQ-DRV-007 — The outcome is read once

**WHEN** `takeDriveConnectResult()` is called, the system shall return
the recorded outcome and clear it, so a second call returns null and a
stale outcome cannot resurface on a later visit to the settings page.
