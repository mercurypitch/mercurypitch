# MercuryPitch — Remediation Implementation Plan

Companion to [`security_and_architecture_audit.md`](./security_and_architecture_audit.md). Turns the audit findings into four independent, reviewable PRs.

| | |
|---|---|
| **Base branch** | `main` |
| **Packaging** | Four PRs, one per domain (Security, Accessibility, Architecture, Tests) |
| **Scope of pass 1** | Safe + medium changes, **plus** the accessibility items that need browser verification (you run those checks). Large *structural* refactors stay deferred to the [Backlog](#deferred-backlog-documented-follow-ups) — deferred for size/risk, not testability. |
| **Verification** | I run `pnpm check` (typecheck + eslint --fix + prettier), `pnpm typecheck:db`, `pnpm test:run`, and `python -m py_compile uvr-api/api.py` on every relevant commit. You run the short, per-PR **browser checklist** below. |
| **Commit author** | `Komediruzecki <komediruzecki.2015@gmail.com>`, no `Co-Authored-By` trailer. Conventional-commit prefixes (`fix:`, `feat:`, `perf:`, `test:`, `refactor:`, `docs:`). |

> The audit + this plan are currently untracked. They land as the first commit of **PR 1** (`docs:`), so review context ships with the first change.

---

## Execution order & dependencies

```
main
 ├─ PR 1  Security            (independent)            ← merge first
 ├─ PR 2  Accessibility       (independent)            ← any time
 ├─ PR 3  Architecture        (independent)            ← any time
 └─ PR 4  Tests               (depends on PR 1)         ← branch/rebase after PR 1 merges
```

- **PR 1, 2, 3 are mutually independent** — they touch disjoint files (workers/python vs frontend a11y vs frontend reactivity) and can be opened in parallel.
- **PR 4 depends on PR 1**: several tests assert *post-fix* behavior (owner-token host election, fail-closed auth, blocked path traversal, upload caps). Branch PR 4 off PR 1's branch (stacked) or rebase it onto `main` after PR 1 merges.
- Recommended merge sequence: **1 → 4**, with **2** and **3** slotting in whenever reviewed.

---

## PR 1 — Security hardening (OWASP 2025)

- **Branch:** `sec/backend-hardening`
- **Surface:** `uvr-api/api.py`, `src/worker.ts`, `src/share-handler.ts`, `workers/jam-worker/src/*`, `workers/db-worker/src/*`, `wrangler.jsonc`
- **Risk:** Low–Medium. All changes are server-side and fully typecheckable. Two ops/verification flags below.
- **Verification:** `pnpm check`, `pnpm typecheck:db`. Python: `python -m py_compile uvr-api/api.py` (no runtime test). Manual review of the CSP and proxy-auth commits before merge.

| Commit | Type | Findings | Files | Change |
|---|---|---|---|---|
| 1 | `docs:` | — | `docs/audits/*` | Commit the audit + this plan. |
| 2 | `fix:` | **H1**, L1(py) | `uvr-api/api.py` | Add `_UUID_RE`; validate `session_id`; in `/output/{session_id}/{path}` resolve with `os.path.realpath` + `os.path.commonpath` containment check before `FileResponse`; reuse the guard in `delete_session`. Replace `detail=str(e)` with generic messages (log full error). |
| 3 | `fix:` | **M2**, A05(model) | `uvr-api/api.py` | Streaming upload size cap (`MAX_UPLOAD_BYTES`, reject >100 MB mid-copy), `content_type` allowlist (415), `ALLOWED_MODELS` allowlist for the `model` param (400 on unknown). |
| 4 | `feat:` | **M1**, L7(uvicorn) | `src/worker.ts`, new `src/lib/verify-jwt.ts` | Gate `/api/uvr/*`: verify a Bearer JWT (HS256 signature + `exp`) at the proxy before forwarding; 401 otherwise. Drive uvicorn `reload` off `UVR_DEV` env. **Design decision (below).** |
| 5 | `fix:` | **M3**, **M4** | `workers/jam-worker/src/{index,jam-room}.ts` | Replace display-name host election with a server-issued `ownerToken` (stored in DO storage, returned once, required on rejoin). CSPRNG 8-char room ids (`crypto.getRandomValues`). Per-room occupancy cap + per-peer message throttle. |
| 6 | `fix:` | **M5** | `src/share-handler.ts` | 64 KB payload byte cap (413); per-IP KV rate-limit bucket keyed on `CF-Connecting-IP`. |
| 7 | `feat:` | **M6** | `src/worker.ts` | `withSecurityHeaders()` wrapper on asset responses: `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` enforced; **CSP shipped as `Content-Security-Policy-Report-Only` first** (see flag). |
| 8a | `fix:` | L2, L5, L6 | `workers/db-worker/src/auth.ts`, `schema.sql` | `getAuth` fails closed (user must exist; `v ?? 0`). Constant-time login (dummy PBKDF2 when user absent). Atomic rate-limit upsert (`ON CONFLICT … RETURNING`) + add the missing `auth_ratelimit` table to the schema. |
| 8b | `fix:` | L1 | `workers/db-worker/src/index.ts` | Generic client error messages (detail logged server-side). |

**Design decision — UVR proxy auth (commit 4):** The main worker has **no D1 binding**, so it cannot do the `tokenVersion` revocation lookup. Decision: validate **signature + `exp` only** at the proxy (no DB call). This closes the anonymous-compute / arbitrary-read hole; full revocation isn't needed to gate compute. Extract a dependency-free `verifyJwt(token, secret)` into `src/lib/verify-jwt.ts` (mirrors `auth.ts:120-141`).
**Ops flag:** requires `wrangler secret put JWT_SECRET` on the main worker (`prod` + `dev`) — the same secret the db-worker signs with. Document in `BUILD.md`.
**Review flag (commit 7):** CSP ships **Report-Only** first so a mis-scoped directive can't break Google Fonts / ONNX WASM. **Browser check (you):** load the app and confirm no CSP violations in the console. Once confirmed, I flip it to enforcing `Content-Security-Policy` within this PR before merge.

**Deferred from this PR:** L3 (origin-allowlist CORS), L4 (`publicCols` projection), L7-origins (per-env `returnTo`), and L8 (token rotation / cookie storage). Each needs cross-origin / prod / runtime verification disproportionate to its Low severity, or is a larger change — implementing them blind risks breaking the cloud API the user explicitly wants to merge carefully. See Backlog.

---

## PR 2 — Accessibility (WCAG 2.2 AA)

- **Branch:** `a11y/wcag-2.2-aa`
- **Surface:** `src/App.tsx`, `src/index.css`, `src/components/{AppNavTabs,MicButton,SessionCelebration}.tsx`, `src/components/shared/SharedControlToolbar.tsx`, `src/components/account/AccountSection.tsx`, modal components, several `*.module.css`, new `src/lib/use-focus-trap.ts`
- **Risk:** Low–Medium. ARIA/labels/CSS are additive; the focus-trap, canvas keyboard nav, and reduced-motion changes alter interaction/visual behavior and rely on your browser pass.
- **Verification:** I run `pnpm check`. **Browser checklist (you):** (1) Tab through each modal — focus stays trapped, Escape closes, focus returns to the opener; (2) keyboard-drive the melody canvas, falling-notes piano, and stem-mixer seek bar; (3) toggle OS reduced-motion and confirm the canvases settle to a static frame; (4) screen-reader spot-check the auth form + results dialog.

| Commit | Type | Findings | Files | Change |
|---|---|---|---|---|
| 1 | `feat:` | 2.4.1, 2.4.7, 2.2.2 | `src/App.tsx`, `src/index.css` | Add `.skip-link` as first child of `#app` targeting `<main id="main-content" tabindex="-1">`. Global `.sr-only`, `:focus-visible` outline, and `@media (prefers-reduced-motion: reduce)` baseline (CSS transitions/animations only — **not** the rAF loops; those are deferred). **[browser-review]** |
| 2 | `fix:` | 4.1.2 | `SharedControlToolbar.tsx`, `MicButton.tsx`, `AppNavTabs.tsx` | `aria-pressed` on the mic-wave + MIDI toggles and the mic button; `aria-current="page"` on the active nav tab. |
| 3 | `fix:` | 4.1.2, 1.3.1 | `SessionCelebration.tsx` | `role="dialog"` + `aria-modal` + `aria-labelledby` on the results modal; `aria-label` on the icon-only close button; `aria-hidden` on its SVG. |
| 4 | `feat:` | 2.4.3, 4.1.2 | new `src/lib/use-focus-trap.ts`; `LibraryModal.tsx`, `SessionLibraryModal.tsx`, `ChangelogModal.tsx`, `VoiceTypeDetectorModal.tsx`, `KaraokePlaylistOverlay.tsx` | Reusable `useFocusTrap(ref, { isOpen, onClose })` primitive: initial focus, Tab/Shift+Tab wrap, Escape-to-close, focus restoration on close. Add `role="dialog"`/`aria-modal`/`aria-labelledby` to each modal. **[browser-review]** |
| 5 | `fix:` | 1.3.1, 3.3.1, 3.3.2 | `AccountSection.tsx` | Real (`.sr-only`) `<label>`s for email/password/display-name; `aria-invalid` + `aria-describedby` wired to a `role="alert"` error region; `autocomplete` (`email` / `current-password` / `new-password`). |
| 6 | `fix:` | 2.5.8 | `NoteList.module.css`, `HeaderControls.module.css`, `LibraryTab.module.css` | Bring `.octaveBtn`, `.rollZoomBtn`, `.pillActionBtn` to ≥24×24 px hit targets (glyph stays small via box/padding). |
| 7 | `feat:` | 2.1.1, 1.1.1 | `PitchCanvas.tsx` | Keyboard-operable wrapper: `role="application"`, `tabindex="0"`, `aria-label`; arrow keys select prev/next note, Enter plays, `[`/`]` seek — routed through `melodyStore`. **[you: browser-verify]** |
| 8 | `feat:` | 2.1.1, 4.1.2 | `FallingNotesCanvas.tsx` | `role="img"` + `aria-label` documenting the MIDI/keyboard input path; visually-hidden `aria-live` region announcing hit/miss outcomes. **[you: browser-verify]** |
| 9 | `feat:` | 2.1.1, 4.1.2, 2.5.8 | `StemMixerTransport.tsx`, StemMixer CSS | Seek bar → `role="slider"` + `aria-valuenow/min/max/valuetext` + arrow-key seeking; ≥24 px target. **[you: browser-verify]** |
| 10 | `perf:` | 2.2.2 | `PitchCanvas.tsx`, `FallingNotesCanvas.tsx` | Gate the rAF draw loops on `prefers-reduced-motion` (single static frame when set). **[you: browser-verify]** |

**Deferred from this PR:** none — with your browser pass available, the canvas/transport keyboard work and rAF gating are now included (commits 7–10).

---

## PR 3 — Architecture (reactive hygiene + perf)

- **Branch:** `arch/reactive-and-perf`
- **Surface:** `src/components/FallingNotesCanvas.tsx`, `src/components/CommunityLeaderboard.tsx`, `src/components/VocalAnalysis.tsx`, `src/App.tsx`, `src/features/stem-mixer/useStemMixerLyricsController.ts`
- **Risk:** Low–Medium. Contained, typecheckable changes. `createResource` migration changes data-loading control flow — flagged for review.
- **Verification:** `pnpm check`. Review the `createResource` commit's loading/error rendering.

| Commit | Type | Findings | Files | Change |
|---|---|---|---|---|
| 1 | `perf:` | §2.1 (canvas) | `FallingNotesCanvas.tsx` | `createMemo` for the MIDI range (replace per-frame `Math.min/max` scans at the 3 call sites); build a `Map<id, judgment>` once per frame instead of `.find()` per note (O(N²)→O(N)). Pure perf, no behavior change. |
| 2 | `refactor:` | §2.1 (resource) | `CommunityLeaderboard.tsx`, `VocalAnalysis.tsx` | Replace the fetch-in-`createEffect`+setSignal blocks with `createResource` keyed on `{category, view, authVersion}`; consume `.loading`/`.error`. **[review]** |
| 3 | `refactor:` | §2.1 (effects) | `App.tsx`, `useStemMixerLyricsController.ts` | Scope the `pendingDrill` effect with `on(pendingDrill, …, { defer: true })` (App.tsx:287). Replace the `setTimeout(attachScrollListener, 0)` + tracking-only reads with a ref-callback binding + `onCleanup`. |

**Deferred from this PR:** version-counter→store cache invalidation, `session-group-service` extraction + `app-store` god-object split, `useStemMixerLyricsController` split, and the pitch-detector Strategy-registry unification (`PitchTestingTab` factory). All are larger structural refactors with cross-cutting regression risk best validated in a browser. See Backlog.

---

## PR 4 — Tests & coverage  *(depends on PR 1)*

- **Branch:** `test/backend-and-db-coverage` (stacked on `sec/backend-hardening`, or rebased onto `main` after PR 1 merges)
- **Surface:** `package.json` (devDep), `src/tests/setup.ts`, new `*.test.ts` under `src/tests`, `workers/db-worker/src`, `workers/jam-worker/src`
- **Risk:** Low — additive. New tests only; no production code changes (beyond possibly exporting a couple of pure helpers for testability).
- **Verification:** `pnpm test:run` (new suites green), `pnpm check`.

| Commit | Type | Findings | Change |
|---|---|---|---|
| 1 | `test:` | §4.2 (Dexie) | Add `fake-indexeddb` devDep; import `fake-indexeddb/auto` in `setup.ts`. `DexieAdapter.findAll` tests: indexed+non-indexed filters, non-indexed `orderBy` asc/desc, indexed-WHERE+orderBy re-sort, offset/limit windows, `limit:0`, offset-past-end; `update` preserves `id`/`createdAt`, bumps `updatedAt`, throws on missing id. |
| 2 | `test:` | §4.2 (ServerAdapter) | Retry/backoff via `vi.stubGlobal('fetch')` + fake timers: 500→200 retries once; 500×3 throws; 429 retried, 403 not; `TypeError` retried; `findById` 404→null; `delete` 204→undefined; query-string serialization. |
| 3 | `test:` | §4.2 (**Critical** — auth + access control) | Worker harness (fake `D1Database` for pure logic). `auth.ts`: JWT round-trip + reject tampered/expired/wrong-secret/malformed; `tokenVersion` revocation **incl. fail-closed on missing user** (asserts PR 1 commit 8); PBKDF2 verify; rate-limit 429; OAuth `state` HMAC+TTL + `isAllowedReturnTo`. `index.ts`: A cannot read/write B's `sessionRecords`; body `userId` overridden by JWT; `IDENT` SQL-guard 400; list-limit ceilings. |
| 4 | `test:` | §4.2 (jam) | Extract relay/host logic from socket I/O; test create assigns host + `room-created{isHost:true}`; **wrong/absent `ownerToken` ⇒ not host** (asserts PR 1 commit 5); `relayToPeer` no-ops on unknown/closed target and stamps `from`; close removes leaver + broadcasts `peer-left`; rejoin within grace cancels deletion. |
| 5 | `test:` | §4.2 (export/services) | `importSessionsFromZip`: corrupt bytes reject; missing `session.json` throws; mixed valid/`version:2` ⇒ count 1; real `Blob` stem round-trip + id remap. Round-trip tests for `session-pitch-analysis-service` and `settings-service`. |
| 6 | `test:` | §4.1 (cleanup) | De-duplicate the pitch-algorithm tests that currently run twice (`src/lib/pitch-algorithms/*.test.ts` vs `…/__tests__/*.test.ts`). |

---

## Deferred backlog (documented follow-ups)

Tracked here so nothing is silently dropped. Each is a candidate for a later PR once browser verification is available.

**Security**
- **L8** — short-lived access token + refresh-token rotation; migrate token storage from `localStorage` to a `Secure; HttpOnly; SameSite=Strict` cookie (requires API + client changes).
- **L3** — origin-allowlist CORS on the workers (reflect an allowlisted Origin + `Vary: Origin`) instead of `*`. Low because auth is Bearer-token, not cookies; needs cross-origin verification (the db-worker is served from a different origin than the app, so a wrong allowlist breaks cloud sync).
- **L4** — `publicCols` projection on `TableDef` so public reads (`userProfiles`, `leaderboardEntries`) can't auto-expose a future column; needs a runtime check that no field the UI consumes gets dropped.
- **L7-origins** — drop `localhost` from the prod `returnTo` allowlist (needs an `ENVIRONMENT` signal wired into the db-worker; not remotely exploitable today).
- **L8** — short-lived access token + refresh-token rotation; migrate token storage from `localStorage` to a `Secure; HttpOnly; SameSite=Strict` cookie.
- The CSP enforce-flip is handled within PR 1 after your browser check — not a separate item.

**Architecture (large structural refactors)**
- Replace the `groupsVersion`/`bumpGroups` "version counter" cache with a reactive `createStore` (`app-store.ts`, `karaoke-playlist-store.ts`).
- Extract `src/db/services/session-group-service.ts` and split the `app-store.ts` god-object into music-settings / uvr-settings / uvr-session stores.
- Split `useStemMixerLyricsController.ts` (2004 LOC, 33 signals) into loader / timing-editor / lrc-generator / blocks composables.
- Unify the two pitch-detection hierarchies behind a single `DETECTOR_REGISTRY` Strategy and one `PitchAlgorithm` type; wire the production engine to it; drive `PitchTestingTab` from the registry.

---

## What happens on your "go"

For each PR, in order (1, then 2/3 in parallel, then 4):
1. `git checkout main && git pull`, create the branch.
2. Implement commits as listed; run `pnpm check` (and `pnpm test:run` for PR 4) after each.
3. Push the branch to `origin`.
4. Open the PR with `gh` (body summarizing the commits + linking the audit + flagging the review/ops items above).

No code is written until you confirm. Tell me to start (all four, or a specific PR first).
