# MercuryPitch — Security & Architecture Audit

| | |
|---|---|
| **Application** | MercuryPitch (`mercury-pitch` v0.3.14) |
| **Audited revision** | `c09c356` (branch `claude/sleepy-robinson-de2c8a`) |
| **Audit date** | 2026-06-23 |
| **Auditor role** | Principal Security Architect / Senior Full-Stack Engineer |
| **Standards** | OWASP Top 10 (2025), WCAG 2.2 AA |
| **Scope** | SolidJS/TypeScript frontend (`src/`, ~136k LOC), Cloudflare Workers backend (`workers/db-worker`, `workers/jam-worker`, `src/worker.ts`), Python UVR container API (`uvr-api/api.py`), D1 SQL schema |

---

## Executive Summary

MercuryPitch is a client-heavy SolidJS web app backed by three distinct server surfaces: a **generic CRUD/auth worker over Cloudflare D1** (`db-worker`), a **WebSocket signaling worker** for peer-to-peer "jam" sessions (`jam-worker`), and a **Python FastAPI container** for UVR audio stem separation, fronted by a main Cloudflare Worker that proxies and serves static assets.

The headline conclusion is nuanced and largely **positive on the part of the system most people get wrong**: the `db-worker` CRUD/auth layer is genuinely well-built. It uses a table allowlist, validates every SQL identifier against a strict regex, fully parameterizes all values, **forces `userId` scoping from the verified JWT rather than the request body** (the single most common source of BOLA/IDOR), supports token revocation via `tokenVersion`, hashes passwords with PBKDF2 + a constant-time comparison, rate-limits auth endpoints, and HMAC-signs OAuth `state` with a TTL and a redirect allowlist. SQL injection and broken object-level authorization — the two risks the brief prioritized — are **not present in the database worker**.

The real risk has migrated to the **edges that were not built to the same standard**:

- The **UVR container API is unauthenticated and internet-reachable** (the main worker proxies `/api/uvr/*` straight through), and its file-download endpoint is vulnerable to **path traversal / arbitrary file read** — the one High-severity finding in this audit.
- The **jam signaling worker has no authentication**: room IDs are short and generated with `Math.random()`, anyone can join, and **host privileges are granted to any peer whose display name matches the creator's** — a Broken Function Level Authorization flaw.
- The **share-link endpoint accepts unbounded, unauthenticated writes** to KV.
- There is **no Content-Security-Policy or any security response header** anywhere, while a 30-day bearer JWT is stored in `localStorage`.

On **architecture**, the codebase is better-factored than most: a clean Repository + Adapter + Factory data layer, real composable decomposition of large components, and correct use of `on()`-scoped effects in places. The findings are targeted — async fetches that should be `createResource`, a hand-rolled "version-counter" cache-invalidation pattern, two parallel pitch-detection hierarchies where a Strategy registry already exists but is unused in production, and a couple of god-modules.

On **accessibility**, the app has real WCAG 2.2 AA gaps concentrated in **keyboard operability** (mouse-only `<canvas>` editors and a `<div>` seek bar), **modal focus management** (no focus trap or restoration across most modals), **form labelling** (placeholder-only auth inputs, unassociated errors), and **target sizing** (multiple sub-24px controls). A claimed skip-link was never actually shipped.

On **testing**, unit coverage of the pitch DSP and client services is strong, but the **entire backend has zero tests** — including the security-critical `auth.ts` and the CRUD access-control logic — and the local Dexie query engine cannot even be integration-tested today (`fake-indexeddb` is not installed).

### Findings at a glance

| Domain | Critical | High | Medium | Low / Info |
|---|---|---|---|---|
| Security (OWASP 2025) | 0 | 1 | 6 | 8 |
| Architecture & Design | — | 3 | 5 | 2 |
| Accessibility (WCAG 2.2) | 0 | 5 | 5 | 4 |
| Testing & Coverage | 1 (gap) | 3 (gaps) | 4 (gaps) | — |

### Top 3 priorities

1. **Fix the UVR path-traversal (High)** and put the entire UVR container behind authentication + rate limiting + upload caps — it is currently an unauthenticated, internet-exposed compute and file-read surface.
2. **Authenticate the jam signaling worker** and replace display-name-based host election with a server-issued owner secret.
3. **Stand up a backend test harness** for `db-worker/src/auth.ts` and `index.ts` access control — today the security boundary has no automated coverage.

---

## Table of Contents

- [1. Security Vulnerability Assessment (OWASP Top 10 2025)](#1-security-vulnerability-assessment-owasp-top-10-2025)
  - [1.0 Verified-secure (what is done right)](#10-verified-secure-what-is-done-right)
  - [1.1 A01 — Broken Access Control (incl. SSRF)](#11-a01--broken-access-control-incl-ssrf)
  - [1.2 A02 — Security Misconfiguration](#12-a02--security-misconfiguration)
  - [1.3 A05 — Injection](#13-a05--injection)
  - [1.4 A07 — Authentication Failures](#14-a07--authentication-failures)
  - [1.5 A09 — Logging & Alerting / Information Disclosure](#15-a09--logging--alerting--information-disclosure)
- [2. Architecture & Design Pattern Inspection](#2-architecture--design-pattern-inspection)
  - [2.1 Reactive Anti-Patterns](#21-reactive-anti-patterns)
  - [2.2 Separation of Concerns](#22-separation-of-concerns)
  - [2.3 Missed Design Patterns](#23-missed-design-patterns)
  - [2.4 What is well-designed](#24-what-is-well-designed)
- [3. Accessibility (WCAG 2.2 AA)](#3-accessibility-wcag-22-aa)
  - [3.1 Semantic & ARIA](#31-semantic--aria)
  - [3.2 Keyboard & Focus](#32-keyboard--focus)
  - [3.3 WCAG 2.2 New Criteria](#33-wcag-22-new-criteria)
  - [3.4 Forms](#34-forms)
- [4. Testing & Code Coverage](#4-testing--code-coverage)
  - [4.1 Test Inventory](#41-test-inventory)
  - [4.2 High-Risk Coverage Gaps](#42-high-risk-coverage-gaps)
  - [4.3 Edge-Case Scenarios](#43-edge-case-scenarios)
- [5. Prioritized Remediation Roadmap](#5-prioritized-remediation-roadmap)

---

## 1. Security Vulnerability Assessment (OWASP Top 10 2025)

Methodology: every backend file (`workers/db-worker/src/{auth,index,tables}.ts`, `workers/db-worker/schema.sql`, `src/worker.ts`, `src/share-handler.ts`, `workers/jam-worker/src/{index,jam-room}.ts`, `uvr-api/api.py`) was read in full. Frontend XSS sinks, token storage, and security headers were grep-audited and the candidate sink (`renderMarkdownToHtml`) was read to confirm it escapes HTML. Findings below cite exact files and lines; claims were verified against the actual code rather than assumed from the stack.

### 1.0 Verified-secure (what is done right)

So the report is not read as "everything is broken," these were specifically checked and found sound — do **not** spend remediation effort here:

- **SQL injection (A05):** In `workers/db-worker/src/index.ts`, entity names are constrained to keys of the `TABLES` allowlist (`index.ts:481`), every column identifier is validated against `IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/` before interpolation (`index.ts:109,114,288,337`), and **all values are bound parameters** (`.bind(...)`), never string-concatenated. `auth.ts` uses parameterized queries throughout.
- **BOLA / IDOR (A01) on the DB worker:** `scopeRead` strips any client-supplied `userId` filter and replaces it with the JWT's `userId` for `user`-access tables (`index.ts:150-151`); `handleGetById` re-checks ownership (`index.ts:241-246`); `canWriteRow` gates updates/deletes (`index.ts:164-173`); `handleUpdate` deletes `body.userId` so ownership is immutable (`index.ts:331`). The `users` table is deliberately excluded from the CRUD allowlist (`tables.ts:5`).
- **SSRF (A01):** Assessed and **not present.** The UVR proxy targets a *fixed* container service binding (`env.UVR_SERVICE.getByName('uvr-instance')`, `worker.ts:33`), not a user-supplied URL; Google endpoints are hard-coded; no user-controlled `fetch(url)` exists on any server path.
- **Auth crypto (A04/A07):** PBKDF2-SHA256 @ 100k iterations with per-password salt (`auth.ts:180-184`), **constant-time** hash comparison (`auth.ts:191-194`), HS256 JWT verified before use, `tokenVersion` revocation on logout (`auth.ts:153-158,726-730`), OAuth `state` HMAC-signed with a 10-minute TTL and an origin allowlist (`auth.ts:567-611`), Google ID tokens verified server-side with `aud` check (`auth.ts:208-219`).
- **Stored-XSS via markdown (A03):** `renderMarkdownToHtml` HTML-escapes `& < >` before any transformation (`render-markdown.ts:19`), and its only caller feeds it the **static bundled** `WALKTHROUGHS` constant — not user input. The `innerHTML` at `WalkthroughModal.tsx:245` is therefore safe as written.

---

### 1.1 A01 — Broken Access Control (incl. SSRF)

#### [H1] UVR API — path traversal / arbitrary file read in the output endpoint

- **Location:** `uvr-api/api.py:481`
  ```python
  @app.get("/output/{session_id}/{path:path}")
  async def get_output_file(session_id: str, path: str):
      """Serve processed output file"""
      file_path = os.path.join(OUTPUT_DIR, session_id, path)
      if not os.path.exists(file_path):
          raise HTTPException(status_code=404, detail="File not found")
      ...
      return FileResponse(file_path, media_type=media_type, filename=path)
  ```
- **Risk / Pattern:** **High** — OWASP **A01 (Broken Access Control / Path Traversal, LFI)**. Both `session_id` and the `{path:path}` segment are interpolated into a filesystem path with **no validation and no containment check**. The `:path` converter captures `/` and `..`, so `os.path.join("/app/output", session_id, "../../../../etc/passwd")` resolves outside `OUTPUT_DIR` and `FileResponse` streams it back. The main worker proxies `/api/uvr/*` to this container with **no authentication** (`src/worker.ts:27-38`), so this is reachable from the public internet, e.g. `GET https://mercurypitch.com/api/uvr/output/<uuid>/../../../../etc/passwd`.
- **The Fix:** Validate the session id and enforce that the *resolved* path stays inside the session directory.
  ```python
  import re

  _UUID_RE = re.compile(
      r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
  )

  @app.get("/output/{session_id}/{path:path}")
  async def get_output_file(session_id: str, path: str) -> FileResponse:
      if not _UUID_RE.match(session_id):
          raise HTTPException(status_code=400, detail="Invalid session id")

      base = os.path.realpath(os.path.join(OUTPUT_DIR, session_id))
      target = os.path.realpath(os.path.join(base, path))

      # Containment: the resolved target must live under the session dir.
      if os.path.commonpath([base, target]) != base or not os.path.isfile(target):
          raise HTTPException(status_code=404, detail="File not found")

      ext = os.path.splitext(target)[1].lower()
      media_type = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".flac": "audio/flac"}.get(
          ext, "application/octet-stream"
      )
      return FileResponse(target, media_type=media_type, filename=os.path.basename(target))
  ```
- **The "Why":** `os.path.realpath` collapses `..` and symlinks, and `os.path.commonpath` guarantees the final path is inside the per-session sandbox, so traversal payloads resolve to a path that fails the containment check and 404s. The UUID gate also blocks abuse of the `session_id` segment. Relying on the framework to "probably" strip `..` is not acceptable for a `FileResponse` sink fed by raw URL input.

#### [M1] UVR API — unauthenticated compute & arbitrary session deletion (IDOR)

- **Location:** `src/worker.ts:27-38` (proxy, no auth) and `uvr-api/api.py:505`
  ```python
  @app.delete("/session/{session_id}")
  async def delete_session(session_id: str):
      session_output_dir = os.path.join(OUTPUT_DIR, session_id)
      session_upload_dir = os.path.join(UPLOAD_DIR, session_id)
      if os.path.exists(session_output_dir):
          shutil.rmtree(session_output_dir)      # unauthenticated, unvalidated id
      if os.path.exists(session_upload_dir):
          shutil.rmtree(session_upload_dir)
  ```
- **Risk / Pattern:** **Medium** — OWASP **A01 (BFLA / IDOR)**. The whole UVR API has no auth and is internet-proxied. Anyone can (a) POST `/api/uvr/process` to launch an expensive CPU/GPU separation job (resource/cost DoS), and (b) `DELETE /api/uvr/session/{id}` to remove **any** session's files — there is no ownership model. `session_id` is unvalidated here too, so a bare `..` segment risks `rmtree` climbing out of `OUTPUT_DIR`.
- **The Fix:** Gate `/api/uvr/*` at the proxy behind the app's existing JWT, and validate the id in the handler. Minimal proxy gate (main worker):
  ```ts
  // src/worker.ts — verify a Bearer JWT before proxying to the container.
  // Share the same JWT_SECRET the db-worker signs with (wrangler secret).
  import { getAuth } from '../workers/db-worker/src/auth' // or a shared module

  if (url.pathname.startsWith('/api/uvr/')) {
    const auth = await getAuth(request, env as unknown as { JWT_SECRET?: string; DB: D1Database })
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }
    // ...existing proxy logic, optionally tagging files with auth.userId...
  }
  ```
  And in `api.py`, reuse the `_UUID_RE` guard from [H1] before any `rmtree`.
- **The "Why":** The container is stateless about identity, so authorization must happen at the only choke point that has identity — the worker proxy. Requiring a valid JWT removes anonymous compute abuse and arbitrary deletion in one move; the UUID guard removes the traversal-in-`rmtree` risk.

#### [M3] Jam signaling — host takeover via display-name match (BFLA)

- **Location:** `workers/jam-worker/src/jam-room.ts:153`
  ```ts
  const isHost = this.ownerName !== null && msg.displayName === this.ownerName
  if (isHost) this.ownerId = peerId
  ```
- **Risk / Pattern:** **Medium** — OWASP **A01 / A07 (Broken Function Level Authorization)**. Host status is granted to *any* joiner whose `displayName` equals the creator's. Display names are not secret — they are broadcast to every peer in `peer-joined` (`jam-room.ts:166-169`) and returned in the `peers` array on join (`jam-room.ts:156-162`). So any participant can read the host's name, reconnect with that name, and be promoted to host.
- **The Fix:** Issue a server-generated owner secret at room creation and require it (not the display name) to reclaim host.
  ```ts
  // On create:
  private async handleCreateRoom(ws: WebSocket, msg: { displayName: string }): Promise<void> {
    const peerId = crypto.randomUUID()
    const ownerToken = crypto.randomUUID()          // secret, returned once
    this.ownerId = peerId
    await this.ctx.storage.put('ownerToken', ownerToken)
    ws.serializeAttachment({ peerId, displayName: msg.displayName, roomId: this.roomId, ownerToken })
    // ...
    this.send(ws, { type: 'room-created', roomId: this.roomId, peerId, isHost: true, ownerToken })
  }

  // On join: host only if the client presents the matching secret.
  private async handleJoinRoom(ws: WebSocket, msg: { displayName: string; ownerToken?: string }): Promise<void> {
    const stored = await this.ctx.storage.get<string>('ownerToken')
    const isHost = !!msg.ownerToken && msg.ownerToken === stored
    if (isHost) this.ownerId = crypto.randomUUID()
    // ...
  }
  ```
- **The "Why":** Authorization must be bound to an unguessable secret, not to a public attribute. The client persists `ownerToken` (e.g. in `sessionStorage`) and replays it on reconnect, so legitimate host hand-off after a Durable Object hibernation still works while impersonation does not.

#### [M4] Jam signaling — unauthenticated join + predictable room IDs

- **Location:** `workers/jam-worker/src/index.ts:47` and `:73`
  ```ts
  const roomId = Math.random().toString(36).substring(2, 6).toUpperCase() // 4 chars, ~1.6M space
  ```
- **Risk / Pattern:** **Medium** — OWASP **A01 / A02**. Room IDs are 4 base-36 characters generated with the non-cryptographic `Math.random()`, and joining requires no credential. The space is small enough to enumerate, and `GET /api/jam/rooms/:id` unconditionally returns `{ exists: true }` (`index.ts:80-82`). A joiner immediately receives the peer roster (display names) and all relayed WebRTC SDP/ICE. There is also no per-room peer cap and no message rate limit, so a single client can exhaust a room or flood relays.
- **The Fix:** Use a CSPRNG and a larger id, and cap room occupancy.
  ```ts
  function newRoomId(): string {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
    return Array.from(bytes, (b) => A[b % A.length]).join('') // 8 chars, ~1.1e12 space
  }
  ```
  In `JamRoom.handleJoinRoom`, reject when `this.peers.size >= MAX_PEERS`, and drop or throttle peers exceeding a messages-per-second budget in `webSocketMessage`.
- **The "Why":** A cryptographically random, longer id removes practical enumeration; an occupancy cap and message throttle bound the resource cost of an unauthenticated channel. (If jam rooms should be private, also require the app JWT on the WS upgrade.)

#### [M5] Share-link shortener — unauthenticated, unbounded KV writes

- **Location:** `src/share-handler.ts:52-72`
  ```ts
  const body = (await request.json()) as Record<string, unknown>
  if (body == null || typeof body.payload !== 'string' || body.payload.length === 0) {
    return respond({ error: 'Missing payload' }, { status: 400 })
  }
  // ...no size limit, no auth, no rate limit...
  await env.SHARE_STORE.put(id, body.payload, { expirationTtl: SIXTY_DAYS })
  ```
- **Risk / Pattern:** **Medium** — OWASP **A01 / A02 (missing access control + insecure default)**. Anyone can write arbitrary strings of arbitrary length into the shared KV namespace, with no authentication and no rate limit, persisting for 60 days. This is a storage- and cost-abuse vector (KV write/storage billing) and lets an attacker mint unlimited share links.
- **The Fix:** Cap payload size, require the app JWT (or at least rate-limit per IP), and validate the payload shape.
  ```ts
  const MAX_PAYLOAD_BYTES = 64 * 1024 // 64 KB is ample for a share blob
  if (typeof body.payload !== 'string' || body.payload.length === 0) {
    return respond({ error: 'Missing payload' }, { status: 400 })
  }
  if (new TextEncoder().encode(body.payload).length > MAX_PAYLOAD_BYTES) {
    return respond({ error: 'Payload too large' }, { status: 413 })
  }
  // Optional but recommended: require Authorization and/or a per-IP KV rate-limit
  // bucket keyed on request.headers.get('CF-Connecting-IP').
  ```
- **The "Why":** A hard byte cap plus identity/rate-limiting turns an open write endpoint into a bounded, attributable one, eliminating the unlimited-storage abuse while preserving the legitimate share flow.

#### [L4] `SELECT *` on public/owner tables auto-exposes future columns

- **Location:** `workers/db-worker/src/index.ts:214` (`SELECT * FROM "${entity}"...`) and `:228`
- **Risk / Pattern:** **Low** — OWASP **A01 (defense-in-depth)**. `userProfiles` (`owner`) and `leaderboardEntries` (`public-user`) are world-readable by design, and `handleList`/`handleGetById` return `SELECT *`. Today the columns are benign (`displayName`, `avatarUrl`, `bio`, `currentStreak`), but any future sensitive column added to these tables would be silently exposed to anonymous reads.
- **The Fix:** Add an optional `publicCols` projection to `TableDef` and select only those for non-owner reads.
  ```ts
  export interface TableDef {
    access: TableAccess
    boolCols?: string[]
    jsonCols?: string[]
    /** Columns exposed on public reads; defaults to '*' for backward-compat. */
    publicCols?: string[]
  }
  // in handleList/handleGetById, when the requester is not the owner:
  const cols = def.publicCols ? def.publicCols.map((c) => `"${c}"`).join(', ') : '*'
  let sql = `SELECT ${cols} FROM "${entity}"${where}`
  ```
- **The "Why":** Explicit column allowlists make data exposure a deliberate, reviewable decision instead of a side effect of `ALTER TABLE`, closing the "accidentally public" class of leaks before it can occur.

---

### 1.2 A02 — Security Misconfiguration

#### [M6] No Content-Security-Policy or security response headers (with a 30-day JWT in `localStorage`)

- **Location:** `index.html:1-45` (no CSP `<meta>`), `src/worker.ts:60` (`env.ASSETS.fetch(request)` returns assets with default headers), and `src/db/services/user-service.ts:77`
  ```ts
  // user-service.ts — long-lived bearer token in localStorage, XSS-reachable
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  ```
  A repo-wide grep for `content-security-policy|x-frame-options|x-content-type-options|strict-transport-security|referrer-policy|frame-ancestors` returns **zero** matches.
- **Risk / Pattern:** **Medium** — OWASP **A02 (Security Misconfiguration)**. There is no CSP, no `X-Content-Type-Options: nosniff`, no `frame-ancestors`/`X-Frame-Options` (clickjacking), no `Referrer-Policy`, and no HSTS. The 30-day JWT (`auth.ts:49`) lives in `localStorage`, so any script-injection — including via a future dependency or feature — yields full account-token theft with no CSP backstop. No live XSS sink was found today (see §1.0), so this is defense-in-depth, but the blast radius if one appears is account takeover.
- **The Fix:** Wrap asset responses in the main worker with a security-header layer. CSP must be tuned to the app's real sources (Google Fonts, ONNX WASM under COEP, the API/worker origins).
  ```ts
  // src/worker.ts
  function withSecurityHeaders(resp: Response): Response {
    const h = new Headers(resp.headers)
    h.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.mercurypitch.com https://www.googleapis.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
    )
    h.set('X-Content-Type-Options', 'nosniff')
    h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h })
  }
  // return withSecurityHeaders(await env.ASSETS.fetch(request))
  ```
  As a follow-up, consider moving the token to a `Secure; HttpOnly; SameSite=Strict` cookie (requires the API to read it from the cookie) so it is not script-reachable at all.
- **The "Why":** CSP `script-src 'self'` neutralizes injected inline/remote scripts, `frame-ancestors 'none'` prevents clickjacking, and `nosniff` blocks MIME-confusion attacks — collectively shrinking the impact of any future XSS from "account takeover" to "contained." The header layer is additive and does not change app logic.

#### [L3] CORS `Access-Control-Allow-Origin: *` on authenticated APIs

- **Location:** `workers/db-worker/src/index.ts:22-28`, `src/share-handler.ts:4-8`, `workers/jam-worker/src/index.ts:17-21`
- **Risk / Pattern:** **Low** — OWASP **A02**. All three workers send `Access-Control-Allow-Origin: *`. Because auth is via the `Authorization` header (not cookies), the browser will not auto-attach credentials cross-origin, so this does not directly leak per-user data — but it does let any website read the public endpoints (leaderboard, public profiles, shared content) and script the API.
- **The Fix:** Reflect an allowlisted origin instead of wildcarding.
  ```ts
  const ALLOWED = new Set([
    'https://mercurypitch.com', 'https://dev.mercurypitch.com', 'http://localhost:3000',
  ])
  function corsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('Origin') ?? ''
    return {
      'Access-Control-Allow-Origin': ALLOWED.has(origin) ? origin : 'https://mercurypitch.com',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Key',
    }
  }
  ```
- **The "Why":** An origin allowlist limits which sites can script the API in a browser context, which is the right default unless a genuinely public, embeddable API is intended.

#### [L7] UVR API runs uvicorn with `reload=True`; prod `returnTo` allowlist includes localhost

- **Location:** `uvr-api/api.py:543-547` and `workers/db-worker/src/auth.ts:560-565`
  ```python
  uvicorn.run("api:app", host=..., port=..., reload=True)   # auto-reload in production
  ```
  ```ts
  const DEFAULT_APP_ORIGINS = [
    'https://mercurypitch.com', 'https://dev.mercurypitch.com',
    'https://localhost:3000', 'http://localhost:3000',     // present in prod
  ]
  ```
- **Risk / Pattern:** **Low** — OWASP **A02**. `reload=True` is a development setting (file-watcher, extra worker process, instability) that should never run in production. Shipping `localhost` in the production OAuth `returnTo` allowlist is a smell — it is not remotely exploitable (the attacker would need to control the victim's localhost) but widens the trust list unnecessarily.
- **The Fix:** Drive reload from an env flag and scope origins per environment.
  ```python
  uvicorn.run("api:app", host=..., port=..., reload=os.getenv("UVR_DEV") == "1")
  ```
  ```ts
  const DEFAULT_APP_ORIGINS =
    env.ENVIRONMENT === 'prod'
      ? ['https://mercurypitch.com']
      : ['https://dev.mercurypitch.com', 'http://localhost:3000', 'https://localhost:3000']
  ```
- **The "Why":** Production should run a fixed, optimized process and accept redirects only to the origins that actually exist in that environment, following the principle of least privilege for configuration.

---

### 1.3 A05 — Injection

No SQL, command, or template injection was found on any server path. The relevant code paths were specifically verified:

- **D1 SQL:** identifier allowlisting + full parameterization (see §1.0). No dynamic SQL is built from unvalidated input.
- **Python `subprocess`:** every `subprocess.run` uses a fixed argument **list**, never `shell=True` and never string interpolation of user input (`uvr-api/api.py:86-90,206-211`). `ffprobe`/`audio-separator` are invoked with controlled arguments.
- One residual hardening note (Low, A05-adjacent): the `model` query parameter on `/process` is concatenated into a model filename and passed to `separator.load_model` (`api.py:311-316`) without an allowlist. It is not a shell or SQL sink, but it should be validated against the known model set to avoid unexpected file resolution.
  ```python
  ALLOWED_MODELS = {"UVR-MDX-NET-Inst_HQ_3", "UVR-MDX-NET-Voc_FT", ...}
  if model not in ALLOWED_MODELS:
      raise HTTPException(status_code=400, detail="Unknown model")
  ```

---

### 1.4 A07 — Authentication Failures

#### [M2] UVR API — no upload size or content-type limit (DoS)

- **Location:** `uvr-api/api.py:272-274`
  ```python
  with open(input_path, "wb") as buffer:
      shutil.copyfileobj(file.file, buffer)   # no size cap, no content-type check
  ```
- **Risk / Pattern:** **Medium** — OWASP **A02/A06 (resource exhaustion / insecure design)**. An unauthenticated client (via the proxy) can stream an arbitrarily large file to disk, exhausting container storage, and can submit non-audio content that wastes a full separation job. Combined with [M1] there is no rate limit either.
- **The Fix:** Enforce a streaming size cap and a content-type allowlist while copying.
  ```python
  MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
  if file.content_type not in {"audio/wav", "audio/mpeg", "audio/flac", "audio/x-wav"}:
      raise HTTPException(status_code=415, detail="Unsupported media type")

  written = 0
  with open(input_path, "wb") as buffer:
      while chunk := await file.read(1024 * 1024):
          written += len(chunk)
          if written > MAX_UPLOAD_BYTES:
              buffer.close(); os.remove(input_path)
              raise HTTPException(status_code=413, detail="File too large")
          buffer.write(chunk)
  ```
- **The "Why":** A streaming byte counter rejects oversized uploads before they fill the disk, and the MIME allowlist rejects payloads that could never separate successfully — bounding the cost of each anonymous request.

#### [L2] Deleted/nonexistent user's JWT still authenticates; `v == null` skips revocation

- **Location:** `workers/db-worker/src/auth.ts:153-160`
  ```ts
  if (payload.v != null) {
    const user = await env.DB.prepare('SELECT tokenVersion FROM users WHERE id = ?')
      .bind(payload.sub).first<{ tokenVersion: number }>()
    if (user && user.tokenVersion > payload.v) return null   // user==null → check skipped
  }
  return { userId: payload.sub, provider: payload.provider }
```
- **Risk / Pattern:** **Low** — OWASP **A07**. If the user row is absent (account deleted, or DB divergence) the `if (user && …)` guard is skipped and the token is accepted for up to its 30-day TTL. Tokens minted before the `v` claim existed (`payload.v == null`) skip the revocation check entirely. No account-deletion endpoint exists today, so impact is currently theoretical — but the auth primitive should fail closed.
- **The Fix:** Require the user to exist and treat a missing version as version 0.
  ```ts
  const user = await env.DB.prepare('SELECT tokenVersion FROM users WHERE id = ?')
    .bind(payload.sub).first<{ tokenVersion: number }>()
  if (!user) return null                       // fail closed: no row → no auth
  if (user.tokenVersion > (payload.v ?? 0)) return null
  return { userId: payload.sub, provider: payload.provider }
  ```
- **The "Why":** Authentication should fail closed when the principal no longer exists, and a token without a version claim should be treated as the lowest version so a single `tokenVersion` bump can revoke legacy tokens too.

#### [L5] Email enumeration via registration response and login timing

- **Location:** `workers/db-worker/src/auth.ts:434-435` and `:462-471`
  ```ts
  if (await findUserByEmail(env.DB, email)) {
    return respond({ error: 'Email already registered' }, { status: 409 })  // confirms existence
  }
  // login: returns fast when email is unknown (no PBKDF2 performed)
  ```
- **Risk / Pattern:** **Low** — OWASP **A07**. The distinct `409 Email already registered` lets an attacker enumerate which emails have accounts; login also leaks existence via timing, since PBKDF2 only runs when a row with a hash is found.
- **The Fix:** Keep the 409 only if product needs it; otherwise return a generic "check your email to continue" and always perform a dummy PBKDF2 on login when the user is missing.
  ```ts
  // login: equalize timing
  const row = await findUserByEmail(env.DB, email)
  const hash = row?.passwordHash ?? DUMMY_PBKDF2_HASH   // constant, never matches
  const ok = await verifyPassword(body.password, hash)
  if (!row || !ok) return respond({ error: 'Invalid email or password' }, { status: 401 })
  ```
- **The "Why":** Performing the hash comparison unconditionally removes the timing oracle; a generic registration message removes the explicit existence confirmation. (This is a privacy hardening trade-off, not a critical hole.)

#### [L6] Non-atomic rate-limit counter

- **Location:** `workers/db-worker/src/auth.ts:332-356`
- **Risk / Pattern:** **Low** — OWASP **A07**. `checkRateLimit` does a `SELECT` then a separate `UPDATE`/`INSERT`. Concurrent requests can read the same count and both pass, slightly exceeding the limit under a burst. D1's limited write concurrency makes the practical window small.
- **The Fix:** Make the increment atomic with a conditional upsert that also resets expired windows in one statement.
  ```sql
  INSERT INTO auth_ratelimit (ip, endpoint, count, windowStart) VALUES (?1, ?2, 1, ?3)
  ON CONFLICT(ip, endpoint) DO UPDATE SET
    count = CASE WHEN ?3 - windowStart > ?4 THEN 1 ELSE count + 1 END,
    windowStart = CASE WHEN ?3 - windowStart > ?4 THEN ?3 ELSE windowStart END
  RETURNING count, windowStart;
  ```
  Then compare the returned `count` against `limit.max` in code.
- **The "Why":** A single atomic upsert eliminates the read-then-write race so the counter cannot be undercounted by concurrent requests.

#### [L8] Long-lived (30-day) bearer tokens, no rotation

- **Location:** `workers/db-worker/src/auth.ts:49` (`TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60`)
- **Risk / Pattern:** **Low** — OWASP **A07**. A single 30-day token with no refresh/rotation means a stolen token is valid for a month (mitigated only by an explicit logout, which bumps `tokenVersion`).
- **The Fix:** Issue a short-lived (e.g. 1-hour) access token plus a rotating refresh token, or at minimum shorten the TTL and re-issue on activity. Pair with the cookie storage suggested in [M6].
- **The "Why":** Shorter-lived credentials bound the value of a stolen token; rotation lets the server detect and revoke replay.

---

### 1.5 A09 — Logging & Alerting / Information Disclosure

#### [L1] Verbose database error messages returned to clients

- **Location:** `workers/db-worker/src/index.ts:300` and `:348`
  ```ts
  } catch (err) {
    return respond({ error: `Insert failed: ${String(err)}` }, { status: 400 })
  }
  // ...
  } catch (err) {
    return respond({ error: `Update failed: ${String(err)}` }, { status: 400 })
  }
  ```
- **Risk / Pattern:** **Low** — OWASP **A09 / A02**. Raw D1/SQLite error text (constraint names, column hints, type errors) is reflected to the client, aiding schema reconnaissance. The Python API similarly returns `detail=str(e)` (`api.py:220,520`).
- **The Fix:** Log the detail server-side, return a generic message to the client.
  ```ts
  } catch (err) {
    console.error('[create] insert failed', entity, err)
    return respond({ error: 'Could not create record' }, { status: 400 })
  }
  ```
- **The "Why":** The operator still gets the full error in logs for debugging, while the client gets a stable, non-revealing message — removing a reconnaissance aid without losing diagnosability.

---

## 2. Architecture & Design Pattern Inspection

The codebase is, on the whole, well-layered: the data layer is a clean Repository + Adapter + Factory stack, most services consistently route through `getRepository<T>()`, prop-drilling is largely absent, and several large components correctly delegate to focused controller composables. The findings below are the highest-signal real issues, each verified against the cited code.

### 2.1 Reactive Anti-Patterns

#### Async data fetching in `createEffect` instead of `createResource`
- **Location:** `src/components/CommunityLeaderboard.tsx:399` (also `:406`, `src/components/VocalAnalysis.tsx:259`)
  ```tsx
  createEffect(() => {
    authVersion(); activeCategory(); activeView()
    void loadPage(0)
  })
  ```
- **Pattern:** Anti-Pattern: async fetch in `createEffect` that writes a signal. The effect manually tracks deps, fires an untracked async IIFE, and writes a separate signal — exactly the case `createResource` exists for, giving up loading/error state, request cancellation, and double-render avoidance.
- **The Fix:**
  ```tsx
  const [leaderboard] = createResource(
    () => ({ cat: activeCategory(), view: activeView(), v: authVersion() }),
    ({ cat, view }) =>
      loadLeaderboardPage({ category: cat as DBLeaderboardCategory, view, limit: PAGE_SIZE, offset: 0 }),
  )
  // usage: leaderboard()?.users ?? []  ;  leaderboard.loading
  ```
- **The "Why":** `createResource` re-fetches when its source changes, exposes `.loading`/`.error`, and discards stale in-flight responses — the manual effect-plus-setSignal pattern silently races and double-renders on every change.

#### Manual "version counter" cache invalidation reimplements reactivity
- **Location:** `src/stores/app-store.ts:204` (also `:194`, `src/stores/karaoke-playlist-store.ts:137`)
  ```tsx
  const [groupsVersion, setGroupsVersion] = createSignal(0)
  function bumpGroups() { setGroupsVersion((v) => v + 1) }
  export function getGroupsReactive(): SessionGroupRecord[] {
    groupsVersion()                 // read solely to create a dependency
    return _groupsCache()
  }
  ```
- **Pattern:** Anti-Pattern: "version signal" cache invalidation — a dummy counter read purely to force re-tracking after every mutation. A hand-rolled, forget-prone substitute for a reactive store.
- **The Fix:**
  ```tsx
  const [groups, setGroups] = createStore<{ list: SessionGroupRecord[] }>({ list: [] })
  export const getGroupsReactive = () => groups.list            // no version read
  // mutations: setGroups('list', (l) => [...l, group])          // reactivity automatic
  ```
- **The "Why":** A store notifies subscribers on write; the parallel `groupsVersion` counter must be bumped by hand after every mutation, and any forgotten `bumpGroups()` produces a stale UI with no compiler help.

#### Cross-tab derived state computed in an unscoped effect
- **Location:** `src/App.tsx:287`
  ```tsx
  createEffect(() => {
    const drill = pendingDrill()
    if (drill && activeTab() === TAB_EXERCISES) setSelectedExercise(drill.exercise)
  })
  ```
- **Pattern:** Anti-Pattern: effect-writes-signal. `selectedExercise` is a derivation of `pendingDrill` + `activeTab`, but it is set inside an effect that re-fires on every `activeTab` tick and makes the signal writable from two places.
- **The Fix:**
  ```tsx
  createEffect(on(pendingDrill, (drill) => {
    if (drill && activeTab() === TAB_EXERCISES) setSelectedExercise(drill.exercise)
  }, { defer: true }))
  ```
- **The "Why":** Narrowing the tracked source to `pendingDrill` stops re-runs on unrelated tab switches and documents the real trigger. (Note: `App.tsx:709` already uses `on([deps], fn)` correctly — this is the inconsistent sibling.)

#### Reactive read inside a per-frame loop with O(N²) lookup
- **Location:** `src/components/FallingNotesCanvas.tsx:504`
  ```tsx
  for (const note of notes) {
    const results = props.hitResults()                      // signal read per note, every frame
    const judgment = results.find((r) => r.itemIndex === note.id)   // O(N) per note → O(N²)
  ```
- **Pattern:** Anti-Pattern: reactive read in a hot `requestAnimationFrame` loop + quadratic lookup.
- **The Fix:**
  ```tsx
  const results = props.hitResults()
  const judgmentById = new Map(results.map((r) => [r.itemIndex, r]))
  for (const note of notes) {
    const judgment = judgmentById.get(note.id)
  }
  ```
- **The "Why":** One read and an O(1) map lookup per note turn a per-frame O(N²) pass into O(N) — inside a 60fps loop that is the whole frame budget for large songs. (The rAF loop itself is correctly torn down via `onCleanup` at `:309` — that part is well done.)

#### Per-frame layout recomputation that should be memoized
- **Location:** `src/components/FallingNotesCanvas.tsx:465`
  ```tsx
  const minMidi = Math.min(...notes.map((n) => n.midi))
  const maxMidi = Math.max(...notes.map((n) => n.midi))
  ```
- **Pattern:** Anti-Pattern: derived value recomputed every frame. `notes` only changes when a song loads, yet this map+min/max scan runs on every `draw()` and is duplicated in `spawnHitParticles`/`hitTestKeyboard`.
- **The Fix:**
  ```tsx
  const midiRange = createMemo(() => {
    const ns = props.songNotes()
    return ns.length
      ? { min: Math.min(...ns.map((n) => n.midi)), max: Math.max(...ns.map((n) => n.midi)) }
      : { min: 60, max: 72 }
  })
  // in draw(): const { min: minMidi, max: maxMidi } = midiRange()
  ```
- **The "Why":** `createMemo` recomputes only when `songNotes()` changes, so the keyboard-layout math runs once per song instead of ~60×/second, and the three call sites share one cached value.

### 2.2 Separation of Concerns

#### UI store performs raw Repository CRUD; one entity's persistence is split across two modules
- **Location:** `src/stores/app-store.ts:211` (and `src/db/services/uvr-service.ts:361` touches the same `sessionGroups` repo)
  ```tsx
  export async function createGroup(name: string): Promise<SessionGroupRecord> {
    const db = await getDb()
    const repo = db.getRepository<SessionGroupRecord>('sessionGroups')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = await repo.create({ name, sessionIds: [] } as any)
    _setGroupsCache((prev) => [...prev, group]); bumpGroups()
    return group
  }
  ```
- **Pattern:** Missed Pattern: Repository/Service boundary violation. The project has a clean `src/db/services/*` layer, but `sessionGroups` persistence (create/delete/rename, `:211-290`) lives in the UI store and is duplicated in `uvr-service.ts`; the `as any` leaks because the store bypasses a typed service.
- **The Fix:** Extract `src/db/services/session-group-service.ts` owning all `sessionGroups` access; the store keeps only cache state.
  ```tsx
  // src/db/services/session-group-service.ts
  export async function createGroup(name: string): Promise<SessionGroupRecord> {
    const repo = (await getDb()).getRepository<SessionGroupRecord>('sessionGroups')
    return repo.create({ name, sessionIds: [] } as Omit<SessionGroupRecord, 'id' | 'createdAt' | 'updatedAt'>)
  }
  // app-store.ts: const g = await groupService.createGroup(name); setGroups('list', (l) => [...l, g])
  ```
- **The "Why":** Centralizing entity persistence in one service is the pattern the rest of `src/db/services` already follows; splitting it across a store and `uvr-service` means two places to keep the cache, the `as any`, and the schema knowledge in sync.

#### State store imports the DB factory, DB services, and the audio engine
- **Location:** `src/stores/app-store.ts:1` (1454-line module)
  ```tsx
  import { getDb } from '@/db'
  import { deleteAllLyricsFromDb, deleteLyricsFromDb } from '@/db/services/lyrics-db-service'
  import { AudioEngine } from '@/lib/audio-engine'
  import { getCompletedCount, getRemainingWalkthroughs } from '@/stores/walkthrough-store'
  ```
- **Pattern:** God-object / mixed concerns. One store spans music settings (`:14`), UVR separation settings (`:20-180`), UVR session + group persistence (`:191-760`), and audio-engine wiring (`:880`).
- **The Fix:** Split along domains.
  ```tsx
  // src/stores/music-settings-store.ts   → keyName, scaleType, instrument
  // src/stores/uvr-settings-store.ts     → uvr mode/intensities/processing mode
  // src/stores/uvr-session-store.ts      → sessions + groups (via session-group-service)
  ```
- **The "Why":** Every consumer currently transitively imports the audio engine and DB layer just to read `keyName()`; domain-scoped stores shrink the dependency surface and co-locate UVR session logic with its service.

#### 2004-line controller composable bundling four lyric subsystems
- **Location:** `src/features/stem-mixer/useStemMixerLyricsController.ts` (33 `createSignal` declarations, ~`:245-283`)
- **Pattern:** God-object (composable). Unlike `StemMixer.tsx` — which cleanly splits into six controllers (`StemMixer.tsx:7-12`) — this composable bundles lyric loading/search, manual timing edit, LRC generation, and block management.
- **The Fix:**
  ```tsx
  const loader = useLyricsLoader({ session })      // load/search/source
  const editor = useLyricsTimingEditor(loader)     // editMode, wordTimings
  const lrcGen = useLrcGenerator(loader)           // lrcGen* state machine
  const blocks = useLyricsBlocks(loader)           // block marking/instances
  ```
- **The "Why":** The four subsystems share almost no state; isolating them makes the LRC-generation state machine and block editor independently testable and removes the 33-signal catch-all surface.

#### Side-effect re-subscription driven by tracking-only reads + `setTimeout`
- **Location:** `src/features/stem-mixer/useStemMixerLyricsController.ts:1788`
  ```tsx
  createEffect(() => {
    const _lyrics = lyricsSource(); const _edit = editMode(); const _lrcGen = lrcGenMode()
    void _lyrics; void _edit; void _lrcGen
    setTimeout(() => attachScrollListener(), 0)
  })
  ```
- **Pattern:** Anti-Pattern: deps read purely for tracking + a 0ms timer to dodge ref timing.
- **The Fix:** Bind via a ref callback so element timing is deterministic.
  ```tsx
  const setLyricsContainerRef = (el: HTMLElement) => {
    lyricsScrollContainer?.removeEventListener('scroll', onLyricsScroll)
    lyricsScrollContainer = el
    el.addEventListener('scroll', onLyricsScroll, { passive: true })
  }
  onCleanup(() => lyricsScrollContainer?.removeEventListener('scroll', onLyricsScroll))
  // JSX: <div ref={setLyricsContainerRef}>
  ```
- **The "Why":** A ref callback fires exactly when the element mounts, eliminating the `setTimeout` race and the three `void _x` reads whose only purpose is to satisfy the reactivity linter.

### 2.3 Missed Design Patterns

#### Two parallel pitch-detection hierarchies; the clean Strategy abstraction is unused in production
- **Location:** `src/lib/pitch-detector.ts:159` (production) vs. `src/lib/pitch-algorithms/index.ts` (Strategy framework)
  ```tsx
  // pitch-detector.ts — hard-coded dispatch
  const result = this.algorithm === 'mpm' ? this.analyzeMPM(buf) : this.analyzeYIN(buf)
  ```
  Two divergent types also exist: `'yin' | 'mpm' | 'swift'` (`pitch-detector.ts:13`) vs `'yin' | 'fft' | 'autocorr' | 'mpm' | 'pyin' | 'swift' | null` (`types/pitch-algorithms.ts:6`). The polymorphic `IPitchDetector` strategies are imported only by `PitchTestingTab.tsx` and tests — never by the production `PracticeEngine`/`VocalAnalysis`.
- **Pattern:** Missed Pattern: Strategy + Registry (already built, not wired up).
- **The Fix:**
  ```tsx
  const DETECTOR_REGISTRY: Record<PitchAlgorithm, () => IPitchDetector> = {
    yin: () => new YINDetector(),
    fft: () => new FFTDetector(),
    autocorr: () => new AutocorrelatorDetector(),
    swift: () => new SwiftF0Adapter(),
    // mpm, pyin...
  }
  class PitchDetector {
    private strategy: IPitchDetector
    setAlgorithm(a: PitchAlgorithm) { this.strategy = DETECTOR_REGISTRY[a]() }
    detect(buf: Float32Array) { return this.strategy.detect(buf) }
  }
  ```
- **The "Why":** Two type systems and two dispatch mechanisms for one concept mean each new algorithm must be added twice and the production path can never use the already-tested FFT/autocorrelation strategies; a single registry collapses both into one extensible Strategy.

#### Detector strategies hand-instantiated in component state
- **Location:** `src/components/PitchTestingTab.tsx:132`
  ```tsx
  const [detectors] = createSignal([
    new YINDetector(), new FFTDetector(), new AutocorrelatorDetector(), new SwiftF0Adapter(),
  ])
  ```
- **Pattern:** Missed Pattern: Factory/Registry — the only consumer builds the list with manual `new` calls in a UI component.
- **The Fix:**
  ```tsx
  const detectors = () =>
    (Object.keys(DETECTOR_REGISTRY) as PitchAlgorithm[]).map((a) => DETECTOR_REGISTRY[a]())
  ```
- **The "Why":** Centralizing construction means adding an algorithm updates one map and both the tester and production engine pick it up automatically.

### 2.4 What is well-designed

Called out so remediation effort is not wasted "fixing" healthy code:

- **DB layer (`src/db/`):** Clean Repository + Adapter + Factory. `DatabaseAdapter`/`Repository<T>` interfaces, a Factory with environment-based adapter resolution and a lazy singleton (`index.ts:23-61`), and a Hybrid/Server/Dexie adapter trio. Services consistently go through `getRepository<T>()`.
- **Prop drilling:** Largely absent. App.tsx → AppSidebar → leaves are 2-3 layers but each leaf consumes the props it receives; `EngineProvider`/`useEngines` injects audio/playback engines via context.
- **`EngineContext.tsx`:** Effects at `:46,:61,:76` are legitimate side-effects bridging reactive settings into the imperative `AudioEngine`, with proper `onCleanup` (`:116`).
- **`StemMixer.tsx`:** Despite 4530 lines it holds no direct DB/fetch/DSP access and delegates to six single-responsibility controllers — the size is JSX, not tangled logic.

---

## 3. Accessibility (WCAG 2.2 AA)

Recent commits added some aria-labels, a modal `role="dialog"` on two modals, and *claimed* a skip link; current state was verified rather than assumed. Findings are concentrated in keyboard operability, modal focus management, and form labelling.

### 3.1 Semantic & ARIA

#### Skip-to-main-content link is missing despite being claimed as shipped
- **Location:** `src/App.tsx:1257` (render root — no skip link); commit `a4fcfb8`'s message claims one was added, but its diff only touched `CrashModal.tsx`/`SharedControlToolbar.tsx`. Repo-wide grep finds only "Skip to next song" media buttons.
- **Risk:** Medium — **WCAG 2.2 — 2.4.1 Bypass Blocks (Level A)**
- **The Fix:** Add as the first focusable element inside `#app`, targeting the existing `<main class="main-content">` (give it an id):
  ```tsx
  <div id="app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    {/* ... */}
    <main class="main-content" id="main-content" tabindex="-1">
  ```
  ```css
  .skip-link { position: absolute; left: 8px; top: -100px; z-index: 1000; padding: 8px 12px;
    background: var(--accent); color: var(--bg-primary); border-radius: 6px; transition: top .15s ease; }
  .skip-link:focus { top: 8px; }
  ```
- **The "Why":** Keyboard and screen-reader users must be able to jump past the header/nav to content; the team believes this shipped, but it never landed.

#### Toggle buttons signal state only via CSS class (missing `aria-pressed`)
- **Location:** `src/components/shared/SharedControlToolbar.tsx:239` (mic-wave toggle; same at `:168`), and `src/components/MicButton.tsx:16` (primary mic toggle)
  ```tsx
  <button classList={{ [styles.active]: micWaveVisible() }} onClick={toggleMicWaveVisible}
    title="Toggle mic waveform view" aria-label="Toggle mic waveform view">
  ```
- **Risk:** Medium — **WCAG 2.2 — 4.1.2 Name, Role, Value (Level A)**
- **The Fix:** Expose pressed state programmatically:
  ```tsx
  <button classList={{ [styles.active]: micWaveVisible() }} onClick={toggleMicWaveVisible}
    aria-pressed={micWaveVisible()} aria-label="Toggle mic waveform view">
  ```
  For MicButton: `aria-pressed={props.active}` plus the existing dynamic `aria-label`.
- **The "Why":** Sighted users see the active highlight; screen-reader users get no indication the control is a toggle or whether it is on. `aria-pressed` conveys both.

#### Active navigation tab not exposed (`aria-current` missing)
- **Location:** `src/components/AppNavTabs.tsx:35` (repeats for all 11 tab buttons)
  ```tsx
  <button class={`app-tab ${props.activeTab() === TAB_SINGING ? 'active' : ''}`}
    onClick={() => void props.handleTabChange(TAB_SINGING)} aria-label="Singing practice">
  ```
- **Risk:** Medium — **WCAG 2.2 — 4.1.2 Name, Role, Value (Level A)**
- **The Fix:**
  ```tsx
  <button class={`app-tab ${props.activeTab() === TAB_SINGING ? 'active' : ''}`}
    onClick={() => void props.handleTabChange(TAB_SINGING)}
    aria-current={props.activeTab() === TAB_SINGING ? 'page' : undefined}
    aria-label="Singing practice">
  ```
- **The "Why":** The selected tab is shown only via the `.active` class; screen-reader users cannot tell which of the eleven sections they are in.

#### Results dialog: unlabeled close button + no dialog semantics
- **Location:** `src/components/SessionCelebration.tsx:42`
  ```tsx
  <div class="celebration-backdrop" onClick={() => props.onClose?.()}>
    <div class="celebration-modal" onClick={(e) => e.stopPropagation()}>
      <button class="celebration-close" onClick={() => props.onClose?.()}>
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41 ..." /></svg>
      </button>
  ```
- **Risk:** High — **WCAG 2.2 — 4.1.2 Name, Role, Value (Level A)** (icon-only button has no name) + **1.3.1 Info and Relationships (Level A)** (no dialog role)
- **The Fix:**
  ```tsx
  <div class="celebration-modal" role="dialog" aria-modal="true"
    aria-labelledby="celebration-score-label" onClick={(e) => e.stopPropagation()}>
    <button class="celebration-close" aria-label="Close results" onClick={() => props.onClose?.()}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M19 6.41 ..." /></svg>
    </button>
    {/* give the score heading id="celebration-score-label" */}
  ```
- **The "Why":** This modal is the payoff of a practice run; its close control announces nothing and the score has no dialog context, so a screen-reader user lands on an unnamed button in an unannounced overlay.

### 3.2 Keyboard & Focus

#### Modals do not trap or restore focus; most lack `role="dialog"`
- **Location:** `src/components/LibraryModal.tsx:561` (representative; same shape in `SessionLibraryModal.tsx:130`, `ChangelogModal.tsx:110`, `VoiceTypeDetectorModal.tsx:137`, `WalkthroughModal.tsx`, `KaraokePlaylistOverlay.tsx`). Only `KeyboardShortcutOverlay.tsx:52` and `CrashModal.tsx:110` carry `role="dialog"`; none implement a focus trap or restoration, and several lack an Escape handler.
- **Risk:** High — **WCAG 2.2 — 2.4.3 Focus Order (Level A)** + **4.1.2 (Level A)**
- **The Fix:** Add dialog semantics and a reusable focus-trap effect:
  ```tsx
  let dialogRef: HTMLDivElement | undefined
  let lastFocused: HTMLElement | null = null
  createEffect(() => {
    if (!props.isOpen) return
    lastFocused = document.activeElement as HTMLElement | null
    const root = dialogRef; if (!root) return
    const sel = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
    const nodes = () => Array.from(root.querySelectorAll<HTMLElement>(sel))
    nodes()[0]?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') return props.close()
      if (e.key !== 'Tab') return
      const f = nodes(); if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    root.addEventListener('keydown', onKey)
    onCleanup(() => { root.removeEventListener('keydown', onKey); lastFocused?.focus() })
  })
  // <div class="library-modal" ref={dialogRef} role="dialog" aria-modal="true"
  //      aria-labelledby="library-modal-title" onClick={(e) => e.stopPropagation()}>
  ```
- **The "Why":** Without a trap, Tab walks straight out of the open dialog into the obscured page behind it; without restoration the user is dumped at the top of the document on close. This is the single most impactful keyboard defect in the app.

#### Pitch melody canvas: mouse-only, no keyboard alternative or name
- **Location:** `src/components/PitchCanvas.tsx:1822` (handlers wired at `:188-209` — click/dblclick/mousedown-seek)
- **Risk:** High — **WCAG 2.2 — 2.1.1 Keyboard (Level A)** + **1.1.1 Non-text Content (Level A)**
- **The Fix:** Provide a keyboard-operable, labeled wrapper driving selection from the existing `melodyStore.items()`:
  ```tsx
  <canvas ref={canvasRef} role="application" tabindex="0"
    aria-label="Melody editor. Arrow keys move between notes, Enter plays the selected note, brackets seek."
    onKeyDown={(e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); selectNextNote() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); selectPrevNote() }
      else if (e.key === 'Enter') { e.preventDefault(); playSelectedNote() }
      else if (e.key === '[') { e.preventDefault(); seekBy(-0.5) }
      else if (e.key === ']') { e.preventDefault(); seekBy(0.5) }
    }}
    style={{ display: 'block', width: '100%', height: '100%' }} />
  ```
- **The "Why":** Selecting, playing, and scrubbing notes are mouse-only; a keyboard user cannot operate the core editing surface at all, and the canvas announces nothing.

#### Falling-notes piano canvas: pointer-only, no name/role
- **Location:** `src/components/FallingNotesCanvas.tsx:1170` (pointer handlers at `:264-267`)
- **Risk:** High — **WCAG 2.2 — 2.1.1 Keyboard (Level A)** + **4.1.2 (Level A)**
- **The Fix:** Expose the existing MIDI/keyboard path as the documented alternative and label the canvas; add a visually-hidden live region announcing hit/miss outcomes.
  ```tsx
  <canvas ref={canvasRef} id="falling-notes-canvas" role="img"
    aria-label="Falling-notes piano. Connect a MIDI keyboard or use the on-screen keys; press P to play/pause." />
  ```
- **The "Why":** The on-canvas piano keys respond to pointer events only; there is no key-by-key operation and no text alternative describing game state.

#### Stem-mixer progress bar: `<div>` seek control, not keyboard-operable
- **Location:** `src/components/StemMixerTransport.tsx:494`
  ```tsx
  <div class="sm-progress-bar" onClick={(e) => props.onSeek(e)}>
    <div class="sm-progress-fill" style={{ width: `${...}%` }} />
  ```
- **Risk:** High — **WCAG 2.2 — 2.1.1 Keyboard (Level A)** + **4.1.2 (Level A)**
- **The Fix:** Promote to a slider role with keyboard seeking (or use `<input type="range">`):
  ```tsx
  <div class="sm-progress-bar" role="slider" tabindex="0" aria-label="Seek"
    aria-valuemin={0} aria-valuemax={Math.round(props.duration())} aria-valuenow={Math.round(props.elapsed())}
    aria-valuetext={`${props.formatTime(props.elapsed())} of ${props.formatTime(props.duration())}`}
    onClick={(e) => props.onSeek(e)}
    onKeyDown={(e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); props.onSeekTo?.(props.elapsed() + 5) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); props.onSeekTo?.(props.elapsed() - 5) }
    }}>
  ```
- **The "Why":** Scrubbing playback position is a primary transport action available only by mouse-clicking a bare div; keyboard users have no way to seek.

#### No visible-focus styling and no `prefers-reduced-motion` support
- **Location:** repo-wide — `grep "prefers-reduced-motion"` over `src/**` returns zero matches, despite continuous `requestAnimationFrame` motion in `PitchCanvas.tsx` and `FallingNotesCanvas.tsx`.
- **Risk:** Medium — **WCAG 2.2 — 2.2.2 Pause, Stop, Hide (Level A)** (continuous motion) + **2.4.7 Focus Visible (Level AA)**
- **The Fix:** Global baseline in `src/index.css`, and gate the rAF loops on the query:
  ```css
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important; animation-iteration-count: 1 !important;
      transition-duration: .001ms !important; scroll-behavior: auto !important;
    }
  }
  ```
  ```ts
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) requestAnimationFrame(loop) // else draw a single static frame
  ```
- **The "Why":** Users with a reduced-motion preference get no relief from constantly animating note streams (a vestibular trigger), and there is no app-wide focus indicator, so keyboard focus is invisible on many custom controls.

### 3.3 WCAG 2.2 New Criteria

#### 2.5.8 Target Size — multiple interactive controls under 24×24 CSS px
- **Location:** `src/components/NoteList.module.css:65` (`.octaveBtn { width:20px; height:20px }`), `src/components/HeaderControls.module.css:372` (`.rollZoomBtn` 20×20), `src/components/LibraryTab.module.css:330` (`.pillActionBtn` 20×20), and the ~5.6px-tall `.sm-progress-bar` (`StemMixer.tsx:3928`).
- **Risk:** Medium — **WCAG 2.2 — 2.5.8 Target Size (Minimum) (Level AA)**
- **The Fix:** Bring each interactive target to ≥24×24 CSS px (the visible glyph can stay small via transparent padding / a pseudo-element hit area):
  ```css
  .octaveBtn, .rollZoomBtn, .pillActionBtn { width: 24px; height: 24px; }
  .sm-progress-bar { height: 24px; background: transparent; display: flex; align-items: center; }
  .sm-progress-bar::before { content: ''; height: .35rem; width: 100%; background: var(--bg-tertiary); border-radius: .2rem; }
  ```
- **The "Why":** These 20×20 controls (and the thin seek bar) fall below the 24×24 minimum and are hard to hit for users with motor or pointer-precision limitations; none qualify for the inline/spacing/essential exceptions.

#### 3.3.8 Accessible Authentication — verified compliant (no action needed)
- **Location:** `src/components/account/AccountSection.tsx:296`
- **Risk:** Low — **WCAG 2.2 — 3.3.8 (Level AA)** — **no violation.** There is no CAPTCHA, puzzle, or memorization test; Google SSO is offered; standard email/password is exempt. Recommended supporting tweak: add `autocomplete="email"` / `autocomplete="current-password"|"new-password"` so password managers work (the spirit of the criterion).

#### 3.3.7 Redundant Entry — verified compliant (no action needed)
- **Location:** `src/components/account/AccountSection.tsx:284` — the auth flow is single-step and never re-asks previously entered information. **No violation.** Noted so the criterion is explicitly cleared rather than silently skipped.

### 3.4 Forms

#### Auth inputs have no `<label>`, no error association, no `aria-invalid`
- **Location:** `src/components/account/AccountSection.tsx:296` (email/password) + the error node at `:319`
  ```tsx
  <input class={styles.authInput} type="email" placeholder="Email" required
    value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
  <input class={styles.authInput} type="password" placeholder={/* ... */} required
    value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
  <Show when={error() !== ''}><p class={styles.errorNote}>{error()}</p></Show>
  ```
- **Risk:** High — **WCAG 2.2 — 1.3.1 / 3.3.2 Labels or Instructions (Level A)** + **3.3.1 Error Identification (Level A)**
- **The Fix:** Real (optionally visually-hidden) labels, an associated live error region, and validity state:
  ```tsx
  <label class="sr-only" for="auth-email">Email</label>
  <input id="auth-email" class={styles.authInput} type="email" autocomplete="email" required
    value={email()} onInput={(e) => setEmail(e.currentTarget.value)}
    aria-invalid={error() !== '' ? 'true' : undefined}
    aria-describedby={error() !== '' ? 'auth-error' : undefined} />

  <label class="sr-only" for="auth-password">Password</label>
  <input id="auth-password" class={styles.authInput} type="password"
    autocomplete={mode() === 'register' ? 'new-password' : 'current-password'} required
    value={password()} onInput={(e) => setPassword(e.currentTarget.value)}
    aria-invalid={error() !== '' ? 'true' : undefined}
    aria-describedby={error() !== '' ? 'auth-error' : undefined} />

  <Show when={error() !== ''}>
    <p id="auth-error" role="alert" class={styles.errorNote}>{error()}</p>
  </Show>
  ```
  (The display-name input at `:180` and registration name at `:287` need the same treatment.)
- **The "Why":** `placeholder` is not an accessible label (it disappears on input and many AT ignore it), the error is a detached `<p>` so screen-reader users get no notification and no field association, and no field is marked invalid.

---

## 4. Testing & Code Coverage

### 4.1 Test Inventory

A mature three-layer setup. **Vitest** (jsdom, globals, `src/tests/setup.ts` mocking `AudioContext`/`worker_threads`) runs ~70 unit/integration specs under `src/tests/**`, `src/lib/**`, `src/components/__tests__/**`; coverage is configured for `src/lib`, `src/stores`, `src/components`, `src/db`. **Playwright** (`src/e2e/**`, chromium-only, against the production build on port 3001, gated by `E2E_TEST_MODE` + `window.__pp` hooks and `data-testid` selectors) covers ~30 user-flow specs. **EARS** specs live in `tests/ears/` and `docs/specs/`.

- **Well-covered (do not flag):** pitch algorithms have thorough edge-case suites (`src/lib/pitch-algorithms/__tests__/*` test silence, pure noise, near-zero amplitude, sub-FFT buffers, harmonics, NaN). Client auth-token shim (`src/tests/auth-service.test.ts`), hybrid-adapter routing, community services, and the karaoke playlist export→import happy path are covered.
- **Conventions:** `vi.mock` for module stubs, `vi.stubGlobal('fetch', …)` for network, hand-built base64url mock JWTs; Playwright seeds state via `page.evaluate(() => window.__pp…)`.
- **Structural note:** pitch-algorithm tests are duplicated — both `src/lib/pitch-algorithms/*.test.ts` and `…/__tests__/*.test.ts` match the vitest `include` glob, so they run twice. De-duplicate.

### 4.2 High-Risk Coverage Gaps

#### Backend db-worker auth & access control — zero tests (Critical gap)
- **Location:** `workers/db-worker/src/auth.ts` (794 lines), `workers/db-worker/src/index.ts` (502 lines). **No test file exists under `workers/`.** `src/tests/auth-service.test.ts` covers only the *client* token shim, not the server that mints/verifies tokens or enforces ownership.
- **Risk:** **Critical (Integration).** This is the entire security boundary — the same logic this audit flags in §1.1/§1.4. Untested: HS256 sign/verify, `tokenVersion` revocation, PBKDF2 constant-time compare, anonymous→password/Google in-place upgrade, Google email auto-linking, OAuth `state` HMAC+TTL + `isAllowedReturnTo`, per-IP rate limiting; and in `index.ts` the `scopeRead`/`canWriteRow` userId-forcing, the `IDENT` SQL-injection guard, and the list-limit ceilings.
- **The Fix:** Stand up a worker harness (a fake `D1Database` suffices for pure JWT/password logic; `@cloudflare/vitest-pool-workers` or `wrangler unstable_dev` for full routing). Priority cases:
  - JWT round-trip; reject tampered signature, expired `exp`, wrong secret, malformed (≠3 parts).
  - A token issued before logout is rejected after `tokenVersion` increments; a deleted-user token is rejected (see [L2]).
  - Access control: user A cannot GET/PATCH/DELETE user B's `sessionRecords` (404/403); a body-supplied `userId` is overwritten by the JWT on create; `owner` writes require `row.id === auth.userId`.
  - SQL-guard: `where[bad;col]` and a body key like `"x); DROP"` → 400 `Invalid column`.
  - `isAllowedReturnTo` rejects an off-origin `returnTo`; expired OAuth state (>10 min) rejected.
  - The (N+1)th `login` in the window returns 429 with `Retry-After`.
  ```ts
  // workers/db-worker/src/auth.test.ts
  import { describe, expect, it } from 'vitest'
  import { getAuth } from './auth'
  function fakeDb(tokenVersion: number) {
    return { prepare: () => ({ bind: () => ({ first: async () => ({ tokenVersion }) }) }) } as unknown as D1Database
  }
  describe('getAuth — tokenVersion revocation', () => {
    it('rejects a JWT whose version is below the stored tokenVersion', async () => {
      const env = { JWT_SECRET: 'test-secret', DB: fakeDb(2) } as any
      const stale = await signTestJwt({ sub: 'user-1', provider: 'password', v: 1 }, 'test-secret')
      const req = new Request('https://x/api/auth/me', { headers: { Authorization: `Bearer ${stale}` } })
      expect(await getAuth(req, env)).toBeNull()
    })
  })
  ```
- **The "Why":** The highest-risk file in the codebase has no direct tests; a regression in token verification, ownership scoping, or the SQL allowlist is a silent path to cross-tenant data exposure.

#### Jam WebSocket relay / Durable Object lifecycle — no tests (High gap)
- **Location:** `workers/jam-worker/src/jam-room.ts` (244 lines), `…/index.ts`. **No test exists.**
- **Risk:** **High (Integration/Unit).** Untested: host re-grant after hibernation (`:149-155` — the source of finding [M3]), `relayToPeer` forwarding only to `readyState === 1` peers and stamping `from` (`:190-201`), `peer-left` broadcast excluding the leaver, the 5-minute `scheduleDelete`/`cancelDelete` grace timer (`:225-243`).
- **The Fix:** Extract the relay/host logic from socket I/O and unit-test it (or use `vitest-pool-workers` for the DO). Cases: create assigns host + emits `room-created{isHost:true}`; a joiner with the wrong secret is **not** host (post-[M3] fix); `relayToPeer` to an unknown/closed target is a no-op; on close the leaver is removed and others get `peer-left`; rejoin within grace cancels deletion.
  ```ts
  it('relays only to the targeted peer, stamping the sender id', () => {
    const room = newTestRoom()
    const a = fakeWs(), b = fakeWs()
    room._addPeer('A', a); room._addPeer('B', b)
    room._relay(a, { type: 'offer', target: 'B', sdp: '...' })
    expect(JSON.parse(b.sent[0])).toMatchObject({ type: 'offer', from: 'A' })
    expect(a.sent).toHaveLength(0)
  })
  ```
- **The "Why":** Signaling correctness and host-handoff-after-hibernation are stateful and impossible to validate by reading; a silent relay bug breaks every multi-user jam with no test to catch it.

#### DexieAdapter query engine — untestable today (High gap)
- **Location:** `src/db/adapters/dexie-adapter.ts:75-200`. No direct test, and **`fake-indexeddb` is not installed**, so no integration test can run. The `findAll` has three branches plus two in-memory sort blocks (`:152-182`) and slice-based pagination; its `catch` returns `[]` silently (`:193-199`).
- **Risk:** **High (Integration).** This is the local persistence query layer for all karaoke/UVR/session-group data; sort/filter/pagination bugs surface as quietly missing user sessions, not errors.
- **The Fix:** Add `fake-indexeddb` to devDeps, import `fake-indexeddb/auto` in `setup.ts`, then test: indexed WHERE + non-indexed filter both applied; non-indexed `orderBy` asc/desc fully sorted; indexed-WHERE + indexed-orderBy re-sort (`:171-182`); `offset`+`limit` window, `limit: 0`, offset past end → `[]`; `update` on missing id throws; `update` preserves `id`/`createdAt`, bumps `updatedAt`.
  ```ts
  import 'fake-indexeddb/auto'
  it('orders by a non-indexed field descending with where-filtering', async () => {
    const repo = new DexieAdapter().getRepository('sessionRecords')
    await repo.create({ userId: 'u1', score: 10 } as any)
    await repo.create({ userId: 'u1', score: 30 } as any)
    const rows = await repo.findAll({ where: { userId: 'u1' }, orderBy: 'score', orderDir: 'desc' } as any)
    expect(rows.map((r: any) => r.score)).toEqual([30, 10])
  })
  ```
- **The "Why":** The hand-rolled index-vs-in-memory logic is the most complex untested code in `src/db`, and its silent `catch → []` hides regressions as missing data.

#### ServerAdapter retry semantics — no tests (Medium gap)
- **Location:** `src/db/adapters/server-adapter.ts:49-100`. No test exists.
- **Risk:** **Medium (Unit).** Untested exponential backoff on 5xx/429, retry on `TypeError` (offline) only, `findById` swallowing to `null` vs `create`/`update` propagating, 204→`undefined`. A bug means either hammering the server or surfacing transient blips as hard failures.
- **The Fix:** `vi.stubGlobal('fetch')` + `vi.useFakeTimers()`: 500-then-200 retries once; 500×3 throws; 429 retried, 403 not; `TypeError` retried, other throws not; `findById` 404 → null; `delete` 204 → undefined; query-string serialization.

#### Session export/import — only happy-path tested (Medium-High gap)
- **Location:** `src/db/services/session-export-service.ts` (630 lines). `src/tests/karaoke-playlist-import.test.ts` covers only the metadata happy-path with no real stems and asserts nothing about corrupt input.
- **Risk:** **Medium-High (Integration).** `importSessionsFromZip` ingests untrusted ZIPs (`:548`). Untested: corrupt/truncated archive, missing `session.json` (throws, `:561`), `version !== 1` skipped per-entry, multi-session id remapping, real stem-blob round-trip (`:435-460`).
- **The Fix:** Cases — corrupt bytes reject without crashing; missing `session.json` throws; mixed valid/`version:2` returns count 1; full round-trip with a real `Blob` stem asserts bytes match and the session id is remapped; karaoke manifest referencing an absent `sessionId` degrades gracefully.
  ```ts
  it('rejects a corrupt ZIP without crashing', async () => {
    const garbage = new Blob([new Uint8Array([1, 2, 3, 4, 5])])
    await expect(importSessionsFromZip(garbage)).rejects.toBeTruthy()
  })
  ```

#### Untested DB services (Medium gap)
- **Location:** `src/db/services/{settings,session,pitch-analysis,session-pitch-analysis,lyrics-db,uvr,manual-stem,whisper-transcription-db}-service.ts`. No test files. `session-pitch-analysis-service` feeds the export path yet has no round-trip test.
- **Risk:** **Medium (Integration).** These persist user settings, session metadata, pitch analysis, and stem blobs; silent serialization bugs corrupt saved practice data.
- **The Fix:** A save→load deep-equality round-trip per service + load-missing → null/empty + overwrite semantics. Highest priority: `session-pitch-analysis-service` and `settings-service`.

### 4.3 Edge-Case Scenarios

**DB transactions / sync routing**
- **Cross-store "transaction" is not atomic** — `HybridAdapter.transaction` (`hybrid-adapter.ts:120`) and `ServerAdapter.transaction` (`server-adapter.ts:174`) just call `fn(this)`; only Dexie wraps a real `rw`. Test that a cloud-write failure after a local write leaves the local write committed (documents the no-rollback reality).
- **Signed-out → signed-in** — `SignedOutAwareRepository` reads resolve `[]`/`null`/`0`, writes throw `Signed out` (`hybrid-adapter.ts:56-90`). Verify a `findAll` returning `[]` while signed out returns real rows immediately after `isAuthed()` flips true.
- **Worker scoping under forged userId** — supplying `where[userId]=<victim>` still returns only the caller's rows (`index.ts:150-152`).
- **`shared` visibility** — `isPublic = 0` row 404s for a non-owner, 200 for the owner; signed-out sees only `isPublic = 1`.
- **List-limit ceilings** — no `limit` → 100; `limit=999999` → capped 1000; `limit=0`/negative/NaN → default.
- **`coerceQueryValue`** — `where[score]=10` binds a number; a 16+ digit id string stays a string (`index.ts:56`); `where[x]=null` → `IS NULL`.
- **Concurrent same-id writes** — two Dexie `update()`s race to `put`; last-write-wins, no version check — assert final `updatedAt` is the later one (documents lost-update risk).
- **Anonymous-upgrade collision** — register with a `deviceId` belonging to an already-upgraded account must not overwrite it (`auth.ts:444`); an already-taken email → 409 even with a valid `deviceId`.
- **Dexie schema upgrade** — opening a v1 DB after `follows` (v2) and `karaokePlaylists` (v3) upgrades in place without data loss (`dexie-adapter.ts:44-49`).

**UI / real-time (E2E)**
- **Interrupted recording** — navigate away / reload mid-capture; assert no orphaned `MediaRecorder` and partial data is saved or cleanly discarded.
- **Playback transport races** — rapid Play→Pause→Resume→Stop; double-click Play; Stop before audio loads.
- **Playlist boundaries** — next on last item, prev on first (guard the `36ce944` prev/next replay fix); single-item and empty playlists.
- **Offline→online during a cloud write** — go offline, create a `sessionRecords` row (ServerAdapter retries on `TypeError`), reconnect, assert eventual success or a clear error.
- **Jam host reload mid-session** — host refreshes (DO hibernates), rejoins and is re-granted host (post-[M3] via owner token); an ungraceful peer disconnect still triggers `peer-left` via `webSocketClose`.
- **Export with no/huge stems** — metadata-only session and large-blob session; progress callback completes and the ZIP is valid.

---

## 5. Prioritized Remediation Roadmap

| # | Finding | Severity | Effort | Area |
|---|---------|----------|--------|------|
| 1 | [H1] UVR path traversal / arbitrary file read | High | S | `uvr-api/api.py` |
| 2 | [M1] Authenticate the UVR proxy; validate session ids | Medium | M | `src/worker.ts`, `api.py` |
| 3 | [M2] UVR upload size/type caps | Medium | S | `api.py` |
| 4 | [M3] Jam host takeover → owner-token | Medium | M | `jam-room.ts` |
| 5 | [M4] Jam CSPRNG room ids + occupancy/throttle | Medium | S | `jam-worker` |
| 6 | [M5] Share endpoint payload cap + auth/rate-limit | Medium | S | `share-handler.ts` |
| 7 | [M6] CSP + security headers | Medium | M | `src/worker.ts` |
| 8 | Backend test harness (auth + access control) | Critical gap | L | `workers/db-worker` |
| 9 | Modal focus trap/restore (shared utility) | High (a11y) | M | `src/components/*Modal*` |
| 10 | Keyboard alternatives for canvas/seek controls | High (a11y) | L | `PitchCanvas`, `FallingNotesCanvas`, `StemMixerTransport` |
| 11 | Auth form labels + error association | High (a11y) | S | `AccountSection.tsx` |
| 12 | `fake-indexeddb` + DexieAdapter/service tests | High gap | M | `src/db`, `setup.ts` |
| 13 | [L1] Generic client error messages | Low | S | `index.ts` |
| 14 | [L2] Auth fails closed on missing user / null `v` | Low | S | `auth.ts` |
| 15 | 2.5.8 target sizes; reduced-motion + focus-visible | Medium (a11y) | S | CSS |
| 16 | [L3]–[L8] CORS allowlist, enum, rate-limit atomicity, token TTL, prod config | Low | S–M | various |

*Effort: S ≈ <½ day, M ≈ 1–2 days, L ≈ 3+ days.*

> **Audit integrity note:** Backend security findings were derived from full reads of every server file; the candidate stored-XSS sink and the markdown renderer were read and confirmed safe, so no fabricated vulnerability is included. Frontend architecture and accessibility findings cite exact files and line numbers verified against the working tree at revision `c09c356`.
