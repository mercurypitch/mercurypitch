# PR Gate Hardening Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> Every task ends with a verification step whose output must be pasted or
> observed before the commit. No task is "done" on reasoning alone.

**Goal:** Make the PR Gate catch what it currently misses (full browser
coverage before merge, not after) while cutting wall-clock time from ~15.5
minutes to ~7, by splitting one serial job into independent parallel jobs.

**Architecture:** Three moves, in order. First fix two product/test defects
the gate's logs exposed. Second, remove the duplicated e2e build so the
bundle that gets asserted is the bundle that gets tested. Third, split the
single `gate` job into independent jobs — lint, units (sharded), e2e
(sharded), workers, beside-cue — that share no build artifacts, and let the
full e2e run on pull requests instead of only after merge.

**Tech Stack:** GitHub Actions, pnpm 11.12.0, Node 22, Vitest 4.1.6,
Playwright 1.60.0, jsdom 25, Vite 6, SolidJS 1.9.

**Spec:** This plan is its own spec; the measurements it argues from are in
"Measured Baseline" below and were taken from runs `33339789532`,
`33336165766`, `33326527530` (green) and `33327129497` (red `main`).

## Measured Baseline

Single serial job `gate`, ~15.5-17 min. Step timings from run `33339789532`:

| Step                              | Time |
| --------------------------------- | ---- |
| Checkout + scope + install        | 32s  |
| `pr:validate` + `pr:prepare:test` | 13s  |
| typecheck + lint + fmt            | 168s |
| unit tests                        | 412s |
| `build:e2e`                       | 48s  |
| Install Chromium                  | 21s  |
| e2e `--grep @smoke`               | 240s |
| workers typecheck                 | 4s   |
| beside-cue check/test/build       | ~50s |

Vitest self-report: **921 files, 10,989 tests, 412.39s** — `transform 52.76s,
setup 142.27s, import 140.43s, tests 212.28s, environment 555.82s`.

Playwright: **120 tests / 4.0m** at `--grep @smoke`; **626 tests / 14.4m**
for the full suite (`main` only), both at 4 workers.

## Global Constraints

- **Never push to `main`, never force-push.** Branch prefix `feat/`.
- **No Claude attribution** in commits, PR bodies, or any artifact. No
  `Co-Authored-By` trailer.
- **No emojis** anywhere in code, UI, logs, or commit messages.
- `pnpm check` does not cover `workers/` or `docs/`. Before pushing run
  `pnpm run pr:validate` and `node scripts/gen-agent-index.mjs --check`.
- **This worktree has no working `pnpm install`** — sharp@0.34.5's postinstall
  fails and aborts bin-linking. Install was done with
  `pnpm install --frozen-lockfile --ignore-scripts`, which links all bins
  correctly. Invoke tools as `node_modules/.bin/<tool>`, never `pnpm run`,
  because pnpm re-runs a failing install before every script.
- Prettier formats `src` only. Workflow YAML and `docs/` are checked by
  `pr:validate`, so run it on every touched file.
- Runner is `ubuntu-latest`, 4 cores. Playwright `workers: 4` and Vitest's
  default pool are both sized against that.

## File Structure

| File                                                       | Responsibility                                               | Tasks            |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| `src/lib/useWhisperTranscription.ts`                       | Whisper lifecycle; must not report teardown as failure       | 1                |
| `src/lib/useWhisperTranscription.test.ts`                  | _(new)_ proves teardown is silent                            | 1                |
| `src/tests/setup.ts`                                       | Global test doubles; gains the network guard                 | 2                |
| `src/components/__tests__/StemMixerZenMusicLevel.test.tsx` | Stubs its own stem fetches                                   | 2                |
| `package.json`                                             | `build:e2e` env parity; `serve` devDependency; shard scripts | 3, 7             |
| `playwright.config.ts`                                     | Serve the prebuilt `dist`, stop rebuilding                   | 3                |
| `.github/workflows/pr-gate.yml`                            | Job split, sharding, caching, concurrency                    | 4, 5, 6, 7, 8, 9 |
| `vitest.config.ts`                                         | `projects`: node for logic, jsdom for DOM                    | 6                |
| `docs/agent/TESTING.md`                                    | Records which environment a new test lands in                | 6                |

## Task Order and Rationale

Tasks 1-3 are product/test correctness and are independent of the workflow
rewrite; they land first so the job split is not debugging two things at
once. Task 4 (scope leak) is a one-line data-driven fix. Tasks 5-9 rewrite
the workflow and must land as one reviewable unit per concern.

---

### Task 1: Whisper teardown must not report a connection failure

**The defect:** `serviceRef.destroy()` rejects every pending `init()` with
`new Error(WHISPER_SERVICE_DESTROYED_MESSAGE)` (`src/lib/whisper-service.ts:173`).
That is deliberate and correct — it releases callers instead of leaving them
awaiting a reply that can never come. But the `init()` caller treats _any_
rejection as a load failure: it logs `console.error` and sets the user-facing
message "Whisper failed to load. Check your connection and try again."

A user who opens the Stem Mixer and navigates away before Whisper finishes
loading therefore gets a spurious `console.error` in real telemetry and a
false connection-error state on a component that is already gone. CI shows
this 13 times in a single green run.

**Files:**

- Modify: `src/lib/useWhisperTranscription.ts:422-437`
- Create: `src/lib/useWhisperTranscription.test.ts`

**Interfaces:**

- Consumes: `WHISPER_SERVICE_DESTROYED_MESSAGE` from `src/lib/whisper-service.ts:23`
  (already exported; value `'Whisper service destroyed'`).
- Produces: no new exports. Behaviour change only.

- [ ] **Step 1: Read the current catch block and the surrounding hook**

Run: `sed -n '400,450p' src/lib/useWhisperTranscription.ts`

Note the exact shape of `setStatus`, `setErrorMessage`, and `pendingStart`
before editing — the fix must leave the genuine-failure path byte-identical.

- [ ] **Step 2: Write the failing test**

Create `src/lib/useWhisperTranscription.test.ts`. The hook owns a worker and
a service, so drive it through the exported service sentinel rather than
mounting the whole Stem Mixer.

```ts
import { describe, expect, it, vi } from 'vitest'
import { WHISPER_SERVICE_DESTROYED_MESSAGE } from './whisper-service'

/**
 * The teardown rejection is a lifecycle signal, not a load failure. This
 * asserts the discrimination directly: the predicate the catch block uses
 * must accept the destroy sentinel and reject everything else.
 */
describe('whisper init rejection handling', () => {
  it('treats the destroy sentinel as teardown, not failure', () => {
    const err = new Error(WHISPER_SERVICE_DESTROYED_MESSAGE)
    expect(isTeardownRejection(err)).toBe(true)
  })

  it('treats a real load failure as a failure', () => {
    expect(isTeardownRejection(new Error('fetch failed'))).toBe(false)
    expect(isTeardownRejection('some string')).toBe(false)
    expect(isTeardownRejection(undefined)).toBe(false)
  })
})
```

Import `isTeardownRejection` from `./useWhisperTranscription` at the top of
the file once Step 4 exports it.

- [ ] **Step 3: Run the test and confirm it fails for the right reason**

Run: `node_modules/.bin/vitest run src/lib/useWhisperTranscription.test.ts`

Expected: fails with `isTeardownRejection is not defined` (or a Vitest
import error naming that symbol). A failure with any other message means the
test is wrong, not the implementation.

- [ ] **Step 4: Implement**

In `src/lib/useWhisperTranscription.ts`, add the exported predicate near the
other module-level helpers:

```ts
/**
 * `destroy()` rejects pending inits with a sentinel so callers are released
 * rather than left awaiting a worker that has been terminated. That is an
 * unmount, not a load failure, and must not reach the user as one.
 */
export function isTeardownRejection(err: unknown): boolean {
  return (
    err instanceof Error && err.message === WHISPER_SERVICE_DESTROYED_MESSAGE
  )
}
```

Add the import for `WHISPER_SERVICE_DESTROYED_MESSAGE` to the existing
`./whisper-service` import. Then change the catch block at line 431:

```ts
      .catch((err) => {
        // An unmount mid-init lands here. Nothing is wrong and nobody is
        // left to read a message, so say nothing.
        if (isTeardownRejection(err)) return
        console.error(`[${tag()}] Whisper init failed:`, err)
        pendingStart = false
        setErrorMessage(
          'Whisper failed to load. Check your connection and try again.',
        )
```

Leave every line after `setErrorMessage(` untouched.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node_modules/.bin/vitest run src/lib/useWhisperTranscription.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Confirm the real path is fixed, not just the predicate**

The predicate passing does not prove the catch block calls it. Run the Stem
Mixer suite, which is what produced the CI log line:

Run: `node_modules/.bin/vitest run src/components/__tests__/StemMixer 2>&1 | grep -c "Whisper init failed"`
Expected: `0`.

Then confirm the genuine-failure path still reports, by checking no other
test regressed:

Run: `node_modules/.bin/vitest run src/lib/whisper-service.test.ts`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/useWhisperTranscription.ts src/lib/useWhisperTranscription.test.ts
git commit -m "fix(whisper): stop reporting unmount as a load failure"
```

---

### Task 2: A test that reaches the network must fail loudly

**The defect:** `src/tests/setup.ts` doubles AudioContext, Worker,
ResizeObserver, localStorage and `URL.createObjectURL` — but never `fetch`.
jsdom provides no `fetch`, so unstubbed calls fall through to Node's undici
and make **real outbound requests**.

`StemMixerZenMusicLevel.test.tsx:75` passes `stems={{ vocal: 'blob:vocal',
instrumental: 'blob:instrumental' }}` — strings never minted by
`URL.createObjectURL`. undici's `resolveObjectURL` returns undefined, so the
scheme handler returns `invalid method`, surfacing as
`TypeError: fetch failed`. Verified directly:

```
$ node -e "fetch('blob:vocal').catch(e=>console.log(e.message,'|',e.cause.message))"
fetch failed | invalid method
```

This is a fixture artifact, not a product bug — it appears 16 times in a
_green_ run. But note the timing: it does **not** reproduce locally, because
the process exits before the rejection lands. It only surfaces on CI's
slower runner. That is async work escaping the test's lifetime, which is a
flake vector regardless of the noise.

The sibling `StemMixerStemUrls.test.tsx:52` already does this correctly with
a `wavResponse()` stub. Copy that; then make the omission impossible to
repeat.

**Files:**

- Modify: `src/tests/setup.ts` (append)
- Modify: `src/components/__tests__/StemMixerZenMusicLevel.test.tsx`

**Interfaces:**

- Produces: an unstubbed `fetch` in any test now throws
  `Error: Unexpected network request: <url>. Stub fetch in this test.`
  Tests that legitimately want network behaviour keep using
  `vi.stubGlobal('fetch', ...)`, which overrides the guard.

- [ ] **Step 1: Add the guard to setup.ts and observe what it catches**

This step is deliberately ordered before the fixture fix — the guard is the
instrument that proves which tests reach the network. Append to
`src/tests/setup.ts`:

```ts
// jsdom provides no fetch, so an unstubbed call reaches Node's undici and
// makes a real outbound request. That is how blob: fixtures in the Stem
// Mixer suite ended up logging `TypeError: fetch failed` on CI and nowhere
// else. A test that wants network behaviour stubs it; anything else is a
// bug in the test, and should say so at the call site rather than as an
// unattributed warning after teardown.
global.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : String(input)
  return Promise.reject(
    new Error(`Unexpected network request: ${url}. Stub fetch in this test.`),
  )
}) as unknown as typeof fetch
```

- [ ] **Step 2: Run the whole suite to find every test that relied on real fetch**

Run: `node_modules/.bin/vitest run 2>&1 | tail -40`

Expected: this is a discovery step, not a pass/fail gate. Record the list of
failing files. If the count is zero, the guard is still worth keeping.
If tests fail, each one is a test that was making a real network request —
triage individually in Step 3; do not weaken the guard to make them pass.

- [ ] **Step 3: Fix the Stem Mixer fixture**

In `src/components/__tests__/StemMixerZenMusicLevel.test.tsx`, add above
`function mountPhone()`:

```ts
/**
 * The mixer loads its stems on mount. The URLs here are fixtures, not real
 * object URLs, so the loader must be given a Response rather than allowed
 * to reach the network — `blob:vocal` is not a registered object URL and
 * undici rejects it with `invalid method` after the test has already ended.
 * `body: null` takes fetch-progress's atomic-read path.
 */
beforeEach(() => {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
})
```

Merge this into the existing `beforeEach` at line 61 rather than adding a
second block, and add `vi.unstubAllGlobals()` to the existing `afterEach`.

- [ ] **Step 4: Verify the fixture fix in isolation**

Run: `node_modules/.bin/vitest run src/components/__tests__/StemMixerZenMusicLevel.test.tsx 2>&1 | grep -E "Unexpected network|Failed to load|Test Files"`

Expected: `Test Files 1 passed (1)` and **no** `Unexpected network request`
and **no** `Failed to load`.

- [ ] **Step 5: Verify the whole suite is green**

Run: `node_modules/.bin/vitest run 2>&1 | tail -20`
Expected: `Test Files 922 passed (922)` (921 plus the new Task 1 file), zero
failed. Paste the summary line before committing.

- [ ] **Step 6: Commit**

```bash
git add src/tests/setup.ts src/components/__tests__/StemMixerZenMusicLevel.test.tsx
git commit -m "test: fail loudly on unstubbed network requests"
```

---

### Task 3: The bundle that is asserted must be the bundle that is tested

**The defect:** CI runs `pnpm run build:e2e`, which builds `dist` and then
runs `node scripts/assert-piano-night-bundle.mjs dist`. Playwright's
`webServer.command` then runs `pnpm run build` **again**, into the same
`dist`, with different env (`VITE_E2E_LAB_ACCESS=1`,
`VITE_JAM_MOCK_SIGNALING=1`). Confirmed in the run log:

```
2026-08-30T22:52:12Z [WebServer] $ vite build
2026-08-30T22:53:00Z [WebServer] Packages: +85
```

Two consequences. The 48s CI build is discarded before a single test runs.
And the Piano Night bundle audit describes a build that is never served —
the assertion does not constrain what e2e actually exercises.

Separately, `webServer.command` ends in `pnpm dlx serve dist`, and `serve`
is not a dependency (`node -e "..."` confirms `false`). CI downloads 85
packages mid-test-run on every gate: latency plus a network flake vector.

**Files:**

- Modify: `package.json` (`build:e2e` script; add `serve` devDependency)
- Modify: `playwright.config.ts` (`webServer.command`)

**Interfaces:**

- Produces: `pnpm run build:e2e` becomes the single authoritative e2e build.
  `webServer` only serves. Tasks 7-8 rely on this: a shard job builds once
  and every shard serves the same `dist`.

- [ ] **Step 1: Give `build:e2e` the env the served build actually uses**

In `package.json`, change:

```
"build:e2e": "cross-env VITE_API_BASE_URL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= vite build && node scripts/assert-piano-night-bundle.mjs dist",
```

to:

```
"build:e2e": "cross-env VITE_API_BASE_URL= VITE_E2E_LAB_ACCESS=1 VITE_JAM_MOCK_SIGNALING=1 VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= vite build && node scripts/assert-piano-night-bundle.mjs dist",
```

The two added flags are copied verbatim from the current
`webServer.command`, so the served bundle is unchanged; only who builds it
moves.

- [ ] **Step 2: Add `serve` as a devDependency**

Run: `node_modules/.bin/pnpm --version 2>/dev/null || echo "use npx"`

Add `"serve": "^14.2.4"` to `devDependencies` in `package.json` by hand and
regenerate the lockfile:

Run: `npx --yes pnpm@11.12.0 install --lockfile-only --ignore-scripts`

Then install it locally so the config can be verified:

Run: `npx --yes pnpm@11.12.0 install --frozen-lockfile --ignore-scripts`

- [ ] **Step 3: Stop the rebuild in playwright.config.ts**

Replace the `webServer` block's `command` with a serve-only command, and
keep every other field:

```ts
  webServer: {
    // The build is `pnpm run build:e2e`, run once by the caller — CI does it
    // in its own job and shares `dist` with every shard, and locally it is
    // the documented prerequisite. Rebuilding here silently overwrote that
    // bundle with a differently-configured one, so the Piano Night bundle
    // audit was asserting a build nobody ever served.
    command: `pnpm exec serve dist -l ${e2ePort} --no-clipboard --single`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: true,
    timeout: numericEnv(process.env.VITE_E2E_WEBSERVER_TIMEOUT, 120000),
  },
```

- [ ] **Step 4: Verify `serve` reproduces the routing `pnpm dlx serve` gave**

`serve` defaults differ between versions, and the app has multiple HTML
entry points (`karaoke.html`, `piano-night.html`, `jam.html`, ...). `--single`
rewrites everything to `index.html`, which would break them. Check first:

Run: `node -e "const{readdirSync}=require('fs');console.log(readdirSync('dist').filter(f=>f.endsWith('.html')))"`

If more than one HTML file is listed, **drop `--single`** from the command —
the multi-entry app needs `serve`'s default static resolution. Record which
form you used and why.

- [ ] **Step 5: Build once, then run a small e2e slice against it**

Run:

```bash
node_modules/.bin/cross-env VITE_API_BASE_URL= VITE_E2E_LAB_ACCESS=1 VITE_JAM_MOCK_SIGNALING=1 VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= node_modules/.bin/vite build && node scripts/assert-piano-night-bundle.mjs dist
```

Expected: build succeeds and the bundle audit passes.

Then:

```bash
timeout 900 node_modules/.bin/playwright test src/e2e/metronome.spec.ts --reporter=line
```

Expected: passes, and the output contains **no** `[WebServer] $ vite build`
line. That absence is the whole point of the task — confirm it explicitly.

- [ ] **Step 6: Verify a non-index entry point still resolves**

Run: `timeout 900 node_modules/.bin/playwright test src/e2e/piano-night.spec.ts --reporter=line 2>&1 | tail -20`

Expected: passes. If it 404s, `--single` is wrong for this app; remove it
and rerun. This step exists because Step 4's file listing predicts the
answer but does not prove it.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts
git commit -m "fix(e2e): serve the asserted bundle instead of rebuilding it"
```

---

### Task 4: Close the scope leak that drags root into beside-cue-only PRs

**The finding:** the user's question was whether beside-cue work only runs
beside-cue jobs. Measured answer: **the beside-cue arm is already correct** —
`apps/beside-cue/*|packages/beside-cue-core/*|packages/mobile-runtime/*` sets
`beside=true` and nothing else. beside-cue is also genuinely independent: its
`@` alias resolves to `apps/beside-cue/src`, not root `src`
(`apps/beside-cue/vitest.config.ts`), so it shares no build artifacts with
the root app.

The leak runs the other way. PR #653 (`feat/beside-cue-v2-shell`) touched 27
files, 26 of them under `apps/beside-cue/`, plus
`scripts/prepare-beside-cue-v2-scroll-media.mjs`. That last path matches no
`case` arm, so the catch-all `*)` set `root=true` — and the PR paid for a
full MercuryPitch typecheck, 921 unit test files and 120 smoke e2e tests,
about 11 minutes, for a script that only prepares Beside Cue media.

Classifying every path touched in the last 400 commits on `main` against the
case statement shows the catch-all is otherwise doing the right thing —
`public/**` (44), config files, `*.html` entry points all genuinely affect
the root build. **Do not weaken the catch-all.** Add one precise arm.

**Files:**

- Modify: `.github/workflows/pr-gate.yml` (the `case` in `Resolve validation scope`)

- [ ] **Step 1: Reproduce the classification locally**

Write `/tmp/scope-classify.sh` mirroring the workflow's `case` statement
exactly, then run it over the PR's file list:

```bash
gh pr view 653 --repo mercurypitch/mercurypitch --json files -q '.files[].path' | /tmp/scope-classify.sh | sort | uniq -c
```

Expected: 26 `BESIDE`, 1 `CATCHALL`
(`scripts/prepare-beside-cue-v2-scroll-media.mjs`).

- [ ] **Step 2: Add the arm**

In `.github/workflows/pr-gate.yml`, insert **above** the existing
`apps/beside-cue/*` arm so it wins the match:

```bash
                  scripts/*beside-cue*)
                    # A Beside Cue media/prep script cannot affect the
                    # MercuryPitch build: the app resolves `@` to its own
                    # src and shares no artifacts. Without this arm the
                    # catch-all below sets root=true and a beside-cue-only
                    # PR pays for the full MercuryPitch gate (PR #653:
                    # 26 of 27 files under apps/beside-cue, ~11 min spent).
                    beside=true
                    ;;
```

- [ ] **Step 3: Verify the new classification, including that nothing else moved**

Update `/tmp/scope-classify.sh` with the new arm, then re-run over PR #653
**and** over the last 400 commits of `main` to confirm no other path changed
category:

```bash
gh pr view 653 --repo mercurypitch/mercurypitch --json files -q '.files[].path' | /tmp/scope-classify.sh | sort | uniq -c
git -C /home/maff/foss/mercurypitch log --name-only --pretty=format: -n 400 main | sort -u | /tmp/scope-classify.sh | grep -c '^CATCHALL'
```

Expected: PR #653 → 27 `BESIDE`, 0 `CATCHALL`. The `main` catch-all count
drops by exactly the number of `scripts/*beside-cue*` files (verify the
delta matches; any other movement means the arm is too broad).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pr-gate.yml
git commit -m "ci: keep beside-cue prep scripts out of the MercuryPitch scope"
```

---

### Task 5: Stop cancelling in-progress runs on main

**The defect:** `concurrency.cancel-in-progress: true` applies to every
event. The group key is
`pr-gate-${{ github.event.pull_request.number || github.ref }}`, so all
pushes to `main` share one group. `main`'s run is the only place the full
e2e suite executes today (14.4 min), and merging a second PR within that
window kills the first run before it finishes. Five `main` pushes landed
within 30 minutes on 2026-08-30, which is exactly the pattern that hides a
regression.

Cancelling redundant _PR_ runs is still right — a new push supersedes the
old one.

**Files:**

- Modify: `.github/workflows/pr-gate.yml` (`concurrency` block)

- [ ] **Step 1: Make the cancellation conditional**

```yaml
concurrency:
  group: pr-gate-${{ github.event.pull_request.number || github.ref }}
  # Superseding a PR push is free — the newer commit is what matters. A push
  # to main is not: every main run is a distinct commit whose result is the
  # record for that commit, and cancelling one loses coverage for it
  # permanently. Five main pushes landed inside 30 minutes on 2026-08-30.
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

- [ ] **Step 2: Verify the expression is valid YAML and a valid Actions expression**

Run: `node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/workflows/pr-gate.yml','utf8'));console.log(JSON.stringify(d.concurrency,null,1))"`

Expected: prints the group and the `${{ ... }}` string intact. If `js-yaml`
is not installed, use `npx --yes js-yaml .github/workflows/pr-gate.yml | head -20`.

GitHub evaluates `cancel-in-progress` expressions to a boolean; a string
`"true"`/`"false"` from the expression is coerced. Confirm the rendered
behaviour after the PR is open by checking that a second push to the PR
cancels the first run (Step 3).

- [ ] **Step 3: Commit (behavioural verification happens on the open PR)**

```bash
git add .github/workflows/pr-gate.yml
git commit -m "ci: keep main runs alive when the next merge lands"
```

Record in the PR description that this needs confirming live: push twice to
the PR and check the first run shows `cancelled`.

---

### Task 6: Split the unit run into node and jsdom projects

**The opportunity:** Vitest's own report for the 412s unit step is
`environment 555.82s, setup 142.27s, import 140.43s, transform 52.76s,
tests 212.28s`. More CPU goes into constructing 921 jsdom instances and
re-running `setup.ts` than into running tests.

Measured migration surface: of 920 test files, **453 `.test.ts` files
reference no DOM global** (`document`, `window`, `localStorage`,
`sessionStorage`, `HTMLElement`, `navigator`, `matchMedia`) and **zero
`.test.ts` files import `@testing-library` or `@solidjs/testing-library`.**
Seven touch `indexedDB`/Dexie, which `fake-indexeddb/auto` supports in node.

Vitest 4 removed `environmentMatchGlobs`; the replacement is `test.projects`.

**Files:**

- Modify: `vitest.config.ts`
- Create: `src/tests/setup-node.ts`
- Modify: `docs/agent/TESTING.md`

**Interfaces:**

- Produces: two Vitest projects, `node` and `jsdom`. `pnpm run test:run`
  still runs both. Task 7 relies on `--project` being selectable.

- [ ] **Step 1: Generate the candidate list and store it**

```bash
find src workers tools -name '*.test.ts' \
  | xargs grep -LE '\b(document|window|localStorage|sessionStorage|HTMLElement|navigator|matchMedia)\b' \
  | sort > /tmp/node-candidates.txt
wc -l /tmp/node-candidates.txt
```

Expected: 453 files. This list is data for Step 3, not a guess.

- [ ] **Step 2: Create the node setup file**

`src/tests/setup.ts` assigns DOM globals unconditionally and will throw
under the node environment. Create `src/tests/setup-node.ts` with only what
a non-DOM test needs:

```ts
// The node project runs tests that touch no DOM. It still needs the
// IndexedDB double (Dexie-backed stores are plain logic) and the network
// guard, but nothing that assumes a document.
import 'fake-indexeddb/auto'

global.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : String(input)
  return Promise.reject(
    new Error(`Unexpected network request: ${url}. Stub fetch in this test.`),
  )
}) as unknown as typeof fetch
```

- [ ] **Step 3: Convert vitest.config.ts to projects**

Replace the single `test` block's `environment`/`setupFiles`/`include` with
`projects`, keeping `exclude`, `env`, `globals` and `coverage` at the top
level. Both projects inherit the root `plugins` and `resolve.alias`.

```ts
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['./src/tests/setup-node.ts'],
          include: ['<the 453 paths, as globs where they collapse cleanly>'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/tests/setup.ts'],
          include: [
            'tools/**/*.test.ts',
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
            'workers/db-worker/**/*.test.ts',
            'workers/jam-worker/src/**/*.test.ts',
          ],
          exclude: ['<the same node paths>'],
        },
      },
    ],
```

**Do not hand-write the glob list from intuition.** Derive it from
`/tmp/node-candidates.txt` and keep the two `include`/`exclude` sets exactly
complementary, so no file runs twice and none is dropped.

- [ ] **Step 4: Prove no file was gained or lost**

The dangerous failure here is silent — a test that runs in neither project
reports nothing and cannot fail. Compare file counts against the baseline:

```bash
node_modules/.bin/vitest run --reporter=json --outputFile=/tmp/after.json
node -e "const r=require('/tmp/after.json');console.log('files',r.numTotalTestSuites,'tests',r.numTotalTests)"
```

Expected: **922 files** (921 baseline + Task 1's new file) and **10,990+
tests**. A lower number means the include/exclude sets are not
complementary. Do not proceed until the counts match.

- [ ] **Step 5: Measure the win**

Run: `node_modules/.bin/vitest run 2>&1 | grep Duration`

Record the new `environment` figure against the 555.82s baseline. If it has
not dropped substantially, the node project is not actually running in node —
check `--project node` in isolation:

Run: `node_modules/.bin/vitest run --project node 2>&1 | tail -5`

- [ ] **Step 6: Document where a new test lands**

Add a short section to `docs/agent/TESTING.md` stating that a test touching
no DOM global belongs in the `node` project, that the split is enforced by
complementary include/exclude lists in `vitest.config.ts`, and that adding a
DOM-touching test to the node list produces a `document is not defined`
failure rather than a silent skip.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/tests/setup-node.ts docs/agent/TESTING.md
git commit -m "test: run DOM-free suites in node instead of jsdom"
```

---

### Task 7: Split the gate into independent parallel jobs

**The opportunity:** the gate is one serial job. Its steps have no ordering
dependency beyond the shared `pnpm install`, and beside-cue shares no build
artifacts with the root app at all (verified in Task 4). The critical path is
the sum of everything; it should be the longest single job.

**Job graph** (all jobs run `Checkout` + `Setup` + `pnpm install`; the scope
job runs first and gates the rest):

| Job          | Runs when                 | Contains                            | Est.  |
| ------------ | ------------------------- | ----------------------------------- | ----- |
| `scope`      | always                    | agent index check, resolve scope    | ~15s  |
| `validate`   | `install`                 | `pr:validate`, `pr:prepare:test`    | ~45s  |
| `lint`       | `root`                    | typecheck, lint, fmt                | ~3.5m |
| `units`      | `root`                    | unit tests, sharded (Task 8)        | ~2m   |
| `e2e-build`  | `root`                    | `build:e2e`, upload `dist` artifact | ~1.5m |
| `e2e`        | `root`, needs `e2e-build` | download `dist`, shard (Task 8)     | ~4m   |
| `workers`    | `db`/`jam`                | typechecks + worker suites          | ~30s  |
| `beside-cue` | `beside`                  | check, test, build                  | ~1.5m |

Critical path: `scope` → `e2e-build` → `e2e` ≈ 6 min, against 15.5 today.

**Files:**

- Modify: `.github/workflows/pr-gate.yml` (full restructure)

**Interfaces:**

- Consumes: `steps.scope.outputs.{root,beside,db,jam,install,diff_base}` —
  the existing scope step's contract is unchanged, it just becomes a job
  output instead of a step output.
- Produces: a `dist` artifact named `e2e-dist`, consumed by every `e2e` shard.

- [ ] **Step 1: Promote the scope step's outputs to job outputs**

Keep the `Resolve validation scope` script byte-identical. Wrap it in a job:

```yaml
jobs:
  scope:
    name: Scope
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      root: ${{ steps.scope.outputs.root }}
      beside: ${{ steps.scope.outputs.beside }}
      db: ${{ steps.scope.outputs.db }}
      jam: ${{ steps.scope.outputs.jam }}
      install: ${{ steps.scope.outputs.install }}
      diff_base: ${{ steps.scope.outputs.diff_base }}
```

It needs `fetch-depth: 0` for the `git diff`, and the agent index check runs
here because it needs no install.

- [ ] **Step 2: Factor the repeated setup into a composite action**

Create `.github/actions/setup/action.yml` so the five install-needing jobs do
not each repeat four steps:

```yaml
name: Setup
description: Checkout, pnpm, Node 22, install
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
      with:
        version: 11.12.0
    - uses: actions/setup-node@v6
      with:
        node-version: '22'
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```

Checkout stays in each job (it must precede the composite action).

- [ ] **Step 3: Write the jobs**

Each job gets `needs: scope` and an `if:` on the relevant scope output — for
example `if: needs.scope.outputs.root == 'true'`. Copy each job's `run:`
lines verbatim from the current steps; this task moves work, it does not
change any command.

`e2e-build` uploads `dist`:

```yaml
- run: pnpm run build:e2e
- uses: actions/upload-artifact@v4
  with:
    name: e2e-dist
    path: dist
    retention-days: 1
```

`e2e` downloads it instead of rebuilding — which is only correct because
Task 3 made `webServer` serve rather than build.

- [ ] **Step 4: Add a required-checks aggregator**

Branch protection cannot list a matrix's individual jobs stably, and a
skipped job reports `skipped`, not `success`. Add a final gate:

```yaml
gate:
  name: PR Gate
  if: always()
  runs-on: ubuntu-latest
  needs: [scope, validate, lint, units, e2e, workers, beside-cue]
  steps:
    - name: Fail if any required job failed
      run: |
        set -euo pipefail
        # A skipped job is a pass: the scope step decided that surface was
        # not touched. Only failure and cancellation are failures.
        results='${{ join(needs.*.result, " ") }}'
        echo "Job results: $results"
        for r in $results; do
          case "$r" in
            success|skipped) ;;
            *) echo "::error::a required job reported $r"; exit 1 ;;
          esac
        done
```

- [ ] **Step 5: Lint the workflow before pushing**

Run: `npx --yes js-yaml .github/workflows/pr-gate.yml > /dev/null && echo "YAML OK"`

Then run `actionlint`, which catches invalid `needs` references, bad
expressions and unknown contexts that YAML parsing cannot:

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color` — or if
Docker is unavailable: `npx --yes @action-validator/cli .github/workflows/pr-gate.yml`

Expected: no errors. Fix anything reported before pushing.

- [ ] **Step 6: Verify on the open PR, not locally**

A workflow restructure cannot be fully verified offline. Push the branch and
confirm on the run page: every expected job appears, the skipped ones match
the scope table in the job summary, and `gate` reports success. Record the
run URL and the wall-clock time in the PR description. **If any job fails,
fix and re-push before moving to Task 8.**

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/pr-gate.yml .github/actions/setup/action.yml
git commit -m "ci: split the gate into independent parallel jobs"
```

---

### Task 8: Shard the units and run the full e2e on pull requests

**The change that fixes the worst correctness hole.** Today
`Test all MercuryPitch browser paths` is gated on
`github.event_name != 'pull_request'`, so 626 tests / 14.4 min run **only
after merge**. Run `33327129497` is the proof: `main` went red on
`exercise-idle-layout.spec.ts:196` — four drill cards overflowing by 7px —
from a change PR Gate had passed. `main` is red as of this plan.

The reason it was smoke-only is wall time, and sharding removes that reason.
626 tests at 14.4 min on 4 workers is ~58 worker-minutes. Four shard jobs at
4 workers each is 16 workers: roughly 3.6 min of test time plus ~1 min of
job overhead. **Full coverage lands in less wall time than today's
smoke-only step (4.0 min).** The cost is runner-minutes, not latency.

**Files:**

- Modify: `.github/workflows/pr-gate.yml`

- [ ] **Step 1: Shard the unit job**

```yaml
units:
  needs: scope
  if: needs.scope.outputs.root == 'true'
  strategy:
    fail-fast: false
    matrix:
      shard: [1, 2]
  steps:
    - uses: actions/checkout@v7
    - uses: ./.github/actions/setup
    - run: pnpm run test:run -- --shard=${{ matrix.shard }}/2
```

Two shards, not four: after Task 6 the unit step should be ~2 min, and job
overhead (~40s) would dominate beyond that. Revisit if Task 6's measured win
is smaller than expected.

- [ ] **Step 2: Replace the smoke/full split with a sharded full run**

Delete both `Test MercuryPitch smoke paths` and
`Test all MercuryPitch browser paths`. One job, no event condition:

```yaml
e2e:
  needs: [scope, e2e-build]
  if: needs.scope.outputs.root == 'true'
  strategy:
    fail-fast: false
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - uses: actions/checkout@v7
    - uses: ./.github/actions/setup
    - uses: actions/download-artifact@v4
      with:
        name: e2e-dist
        path: dist
    - run: pnpm exec playwright install --with-deps chromium
    - run: pnpm run test:e2e -- --shard=${{ matrix.shard }}/4
```

The `@smoke` tags stay in the specs — they remain useful locally
(`pnpm run test:e2e --grep @smoke`); CI just no longer uses them to decide
coverage.

- [ ] **Step 3: Verify sharding actually partitions, locally**

Playwright shards by file by default, so an uneven file-size distribution
can leave one shard carrying `guitar-night.spec.ts` (121KB) alone. Check the
partition before trusting the estimate:

```bash
for i in 1 2 3 4; do
  echo -n "shard $i: "
  node_modules/.bin/playwright test --shard=$i/4 --list 2>/dev/null | tail -1
done
```

Expected: four non-empty shards with roughly comparable test counts. If one
shard holds a large majority, note it in the PR — the fix is
`fullyParallel` (already on) plus possibly splitting the largest spec file,
which is out of scope here.

- [ ] **Step 4: Verify the unit shards sum to the whole**

```bash
node_modules/.bin/vitest run --shard=1/2 --reporter=json --outputFile=/tmp/s1.json
node_modules/.bin/vitest run --shard=2/2 --reporter=json --outputFile=/tmp/s2.json
node -e "const a=require('/tmp/s1.json'),b=require('/tmp/s2.json');console.log(a.numTotalTests+b.numTotalTests)"
```

Expected: the same total as Task 6 Step 4. A shortfall means shards are
dropping files.

- [ ] **Step 5: Verify on the open PR**

Confirm on the run page that all four e2e shards ran, that their combined
test count matches the 626 baseline, and record the wall-clock time. This is
the number that decides whether full-on-PR was worth it — if the e2e job
exceeds ~6 min, raise the shard count to 6 and re-measure.

**This step must also confirm the `exercise-idle-layout` regression is now
caught pre-merge.** That spec is in the full suite but not in smoke; the PR
run should either fail on it (proving the gate now catches what broke `main`)
or pass because it has since been fixed. Either outcome is informative —
record which, and if it fails, fix the 7px overflow as part of this PR or
open a follow-up.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/pr-gate.yml
git commit -m "ci: run the full browser suite on pull requests, sharded"
```

---

### Task 9: Cache the Playwright browser download

**The opportunity:** `pnpm exec playwright install --with-deps chromium`
costs 21s per run today, and after Task 8 it runs on four shard jobs — 84s
of runner time per gate.

**Files:**

- Modify: `.github/workflows/pr-gate.yml` (`e2e` job)

- [ ] **Step 1: Add the cache, keyed on the resolved Playwright version**

Insert before the install step in the `e2e` job:

```yaml
- name: Resolve Playwright version
  id: pw
  run: echo "version=$(node -p "require('@playwright/test/package.json').version")" >> "$GITHUB_OUTPUT"
- uses: actions/cache@v4
  id: pw-cache
  with:
    path: ~/.cache/ms-playwright
    key: pw-${{ runner.os }}-${{ steps.pw.outputs.version }}
- name: Install Chromium
  # --with-deps installs OS packages that the cache cannot hold, so it
  # still runs on a hit; only the browser download is skipped.
  run: pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Verify the version resolves to the installed build, not the range**

Run: `node -p "require('@playwright/test/package.json').version"`

Expected: `1.60.0` — the resolved version, not `^1.59.1`. Keying on the range
would serve a stale browser after a lockfile bump.

- [ ] **Step 3: Verify on the open PR**

A cache is unverifiable on its first run. Confirm across two pushes: the
first shows `Cache not found`, the second shows a cache hit and a shorter
install step. Record both.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pr-gate.yml
git commit -m "ci: cache the Playwright browser download"
```

---

## Final Verification Before Opening the PR

- [ ] `node scripts/gen-agent-index.mjs --check` passes.
- [ ] `node_modules/.bin/tsc --noEmit` passes.
- [ ] `node_modules/.bin/eslint --no-warn-ignored -- <changed src files>` passes.
- [ ] `node_modules/.bin/prettier --check --ignore-unknown -- <every changed file, including YAML and this plan>` passes.
- [ ] Full unit suite green, with the file and test counts matching the
      baseline (922 files / 10,990+ tests).
- [ ] Workflow passes `actionlint`.
- [ ] The PR description records: the measured before/after wall-clock, the
      four items that can only be confirmed live (Task 5 cancellation, Task 7
      job graph, Task 8 shard balance and full-suite count, Task 9 cache hit),
      and the `exercise-idle-layout` outcome from Task 8 Step 5.

## Self-Review Notes

**Coverage:** all nine items from the agreed list have a task — 1 whisper,
2 fetch guard, 3 e2e build dedup, 4 scope leak (the "make it so" check), 5
concurrency, 6 node/jsdom split, 7 parallel jobs, 8 sharding + full e2e on
PRs, 9 caching.

**Sequencing risk:** Task 8 depends on Task 3 (no rebuild in `webServer`) and
Task 7 (the `dist` artifact). Task 7's `e2e` job cannot be written before
Task 3 lands or every shard would rebuild. Order is therefore fixed: 3 → 7 → 8.

**Known unverifiable-offline items:** Tasks 5, 7, 8, 9 each end in a
live-run verification step, because workflow behaviour, cache hits, shard
balance under CI load and concurrency cancellation cannot be observed from
the worktree. Each names the specific observation required.

---

## Outcomes and deviations from the plan as written

Recorded during execution. Where the plan was wrong, the measurement is given.

**Task 1 — the predicate test was not enough.** A passing `isTeardownRejection`
test proves the predicate is correct, not that the catch block consults it. The
plan's Step 6 (grep the Stem Mixer suite for the log line) verifies nothing
locally, because the rejection never lands there before the process exits. A
hook-level test was added that drives `useWhisperTranscription` with a mocked
service and asserts `console.error` is not called. It was checked against the
unfixed code: with the guard removed it fails, with the guard present it passes.

**Task 2 — no test was relying on real network access.** The guard was added
first, as an instrument, and the full suite stayed green: 921 files / 10,987
tests. So the only offender was the Stem Mixer fixture. The guard was separately
proved live with a throwaway probe asserting both an `https:` URL and
`blob:vocal` are intercepted, and the fixture stub was proved to be consumed by
asserting the loader actually called it.

**Task 3 — `--single` would have been wrong.** The app emits ten HTML entry
points, and specs navigate to them extensionlessly (`goto('/piano-night')`).
`serve` resolves clean URLs by default; all ten return 200. The command is
therefore flag-free, matching the previous `pnpm dlx serve` behaviour exactly.

**Task 6 — a static scan cannot produce the node list.** The grep put 470 files
in the `node` project; **26 failed**, reaching `Audio`, `window` or a canvas
through their imports. Four of those did not fail their file at all — they threw
unhandled rejections that only showed up as an `Errors` line. The list was
narrowed empirically to **444**. `--project node` and `--project jsdom` were
confirmed to sum to exactly 921 files with no duplicates and no dangling paths.
No generator script was written; the config comment says so.

Measured: `environment` fell from **447.53s to 209.75s** locally with an
identical 921-file / 10,987-test result.

**Tasks 7-9 — no `dist` artifact.** `dist` is 69 MB. Publishing it once and
pulling it into four shards costs more wall-clock than four parallel builds and
puts a barrier in front of a fan-out that otherwise has none. Each `e2e` shard
runs `build:e2e` itself. The `e2e-build` job in the plan does not exist.

**Task 8 — the plan's shard invocation was broken.** `pnpm run test:run --
--shard=1/2` forwards a bare `--`, which Vitest reads as a filter: it ran **all
921 files**, so both shards would have run the whole suite for no speedup. The
Playwright equivalent exited 1. The correct form omits `--`, as the pre-existing
`test:e2e --grep @smoke` step already did. Verified: `--shard=2/2` runs 460
files, `--shard=3/4 --list` reports 156 tests.

Shard balance was measured, not assumed. Playwright partitions by test count:
157/157/156/156 across four shards, totalling the 626 baseline. Vitest: 461+460
= 921 files, 5544+5443 = 10,987 tests.

**Task 7 — one behaviour change was caught and reverted.** Moving
`pr:prepare:test` into the `validate` job silently gave it that job's
`diff_base != ''` condition, so a tag or `workflow_dispatch` run would have
stopped exercising it. It is back under a root-only condition, in `lint`.

**The gate aggregator was tested under bash, not the local shell.** zsh does not
word-split unquoted variables, so the loop appeared to fail on every input. Under
`bash`, which is what Actions runs, it passes on `success`/`skipped` and fails on
`failure`/`cancelled`.

## Pre-existing issue found, not fixed here

`pnpm run typecheck` fails locally on
`src/features/guitar-night/useGuitarNightReferenceController.test.tsx` — six uses
of `Promise.withResolvers`, which needs `lib: ES2024`, against a tsconfig pinned
to `ES2023`.

It is not caused by anything in this branch. Verified by typechecking the
pristine base commit `067b5062` in a detached worktree with a lockfile-faithful
install: it fails identically. Ruled out as causes: every file changed here, the
added `serve` dependency (purely additive to the lockfile, zero version
changes), the Node version (fails under 22 and 25 alike), `--ignore-scripts`
(the repo has no postinstall and no patches), and the TypeScript and
`@types/node` versions (both match the lockfile pins).

**CI does hit it, and it is fixed here.** This section originally recorded the
opposite, on the strength of run `33339789532` — a run on a _different branch_ —
typechecking the identical file in 38s and passing. That sampling was wrong.
This branch's own run `33343251285` failed its `Lint and typecheck` job on
exactly `error TS2550: Property 'withResolvers' does not exist on type
'PromiseConstructor'`, and typechecking `origin/main` directly in a detached
worktree under Node 22 reproduces it. `main` is red on this.

Fixed by raising `lib` to `ES2024` in tsconfig.json. `target` stays `ES2023`, so
emitted code is unchanged, and the API is test-only — zero uses in product code
— so nothing ships against a newer runtime. The tradeoff: a higher `lib` also
lets other ES2024 APIs into shipped code unchallenged. The alternative, if that
safety net is wanted back, is replacing the six test usages with a local helper.

Why main's CI passed this step while main fails it locally is still unexplained.
Ruled out: Node version (fails under 22 and 25), `--ignore-scripts`, the
TypeScript and `@types/node` versions (both match the lockfile pins), and the
added `serve` dependency (purely additive to the lockfile, zero version
changes).

## Second pre-existing breakage found, and fixed here

Running the full browser suite on pull requests — Task 8 — is what surfaced
this. `src/e2e/exercise-idle-layout.spec.ts` failed on two of its four
viewports, on `main` as much as on this branch, and neither failure was caused
by anything in this branch.

### Why `main` looked green

It was never running the spec. Run `33326451351` (push to `main`,
`a7f1dc93`, reported success) is 77KB of log containing zero Playwright output:
the old serial gate ran the unit projects and stopped. The first `main` run to
fail on this spec, `33327129497`, differs from it by two beside-cue commits that
touch nothing outside `apps/beside-cue/**` and one script. The layout was
already broken at both; only the second run looked.

That is the same class of blind spot Task 8 set out to close, arriving as
evidence for it rather than against it.

### Failure 1 — 21px at 1400x806 (tablet-landscape)

`Dynamic Swell`, `Chord Stacker` and `Staccato Precision` overflowed their card
by 21px, putting Start under the fold — the exact regression the spec was
written to catch, on the exact device the original report came from.

Cause: PR #364 ("feat: add Hear Yourself voice history and guided analysis")
added `.exercise-capture-note` to `.exercise-idle-launch`. Measured, the note is
35px and its gap 14px, so it costs a stacked panel 49px:

|                                 | before #364 | after #364 |
| ------------------------------- | ----------- | ---------- |
| `.exercise-idle-launch`         | 36          | 85         |
| `.exercise-idle-body` (stacked) | 451         | 500        |
| `.exercise-idle-center`         | 580         | 629        |
| card `clientHeight`             | 608         | 608        |

The stack existed because `exercises.css` gated the side-by-side split on
`:has(.exercise-timer-field)`. That gate's stated reasoning was two-part: a
timerless launch column holds one button, so a row looks unbalanced, _and_ the
stack is "already short". #364 falsified the second half without touching the
first, and the drills that carry no timer are exactly the ones that stack.

The timer was only ever a proxy for "is this column worth a row of its own".
`short-viewport.css` had already rejected that proxy for screens under 720px
tall — "the split happens whether or not there is a timer" — but a landscape
tablet at 806px sits above that line and reached none of it.

**Fixed in the code, not the test.** The split is now unconditional at
`min-width: 700px`; the timer decides only how the row divides, exactly as
`short-viewport.css` already had it. Beside the dial the same content costs the
taller column rather than the sum: 401px, and the card closes at 530 of 608 —
78px of headroom, not a shaved pixel. The two breakpoints now agree instead of
one overriding the other.

### Failure 2 — 7px at 1024x560 (short-laptop)

A separate mechanism on the same four drills, and this one is about width.

Here the row split was already in place via `short-viewport.css`, and the tall
column is the dial, not launch. With a timer, launch takes a fixed
`min(260px, 30vw)`. Without one it is content-sized, and its widest child is the
capture note, whose `max-width: 46ch` resolves to 344px — so the column with
_less_ in it claimed _more_ room than the column with more:

|                               | Long Note (timer) | Chord Stacker (none) |
| ----------------------------- | ----------------- | -------------------- |
| `.exercise-idle-launch` width | 260               | 344                  |
| `.exercise-idle-setup` width  | 368               | 284                  |
| dial max-content width        | 303               | 303                  |
| `.readout` height             | 19 (one line)     | 38 (two)             |
| `.exercise-idle-setup` height | 291               | 310                  |

The row's available width is 650px. 284 + 22 + 344 = 650: the dial absorbed the
entire 19px shortfall, dropping below its 303px max-content, which wrapped
`NoteDial`'s readout onto a second line. Nineteen pixels of width bought
nineteen pixels of height, and the panel finished 7px over.

**Fixed in the code.** `.exercise-idle-launch` now carries a `max-width` equal
to the width the timer version gets — 330px wide, 260px short — so it can never
out-claim the dial. The note is prose and wraps for free; the readout wrapping
costs the panel its fit, so the note is the one that gives. All four drills come
back to a 291px setup and 13px of headroom.

### Verification

All 18 tests in `exercise-idle-layout.spec.ts` pass at all four viewports, and
the full browser suite is green. Measured margins after the fix, on the two
viewports that were failing:

| viewport | worst drill   | was   | now   |
| -------- | ------------- | ----- | ----- |
| 1400x806 | Chord Stacker | −21px | +78px |
| 1024x560 | Chord Stacker | −7px  | +13px |

## Task 5 verified live, on PR #658

Task 5 shipped with its behavioural check outstanding: every run on the
original PR finished before the next push landed, so nothing was ever
superseded. Confirmed afterwards by pushing twice to PR #658 eight seconds
apart, on the `feat/docs-refresh-ci-gating` branch.

| Time (UTC) | Commit     | Run         | Result        |
| ---------- | ---------- | ----------- | ------------- |
| 13:47:37   | `34d1f276` | 33398914277 | success       |
| 13:48:24   | `7858e988` | 33398986848 | success       |
| 13:50:20   | `8aedda39` | 33399170622 | **cancelled** |
| 13:50:28   | `e3dff38b` | 33399184067 | success       |

The third run was killed by the fourth. The first two were 47 seconds apart and
both survived, which is the same mechanism seen from the other side: the first
run had already finished, so there was nothing in progress to cancel.

### What does not exercise it, and why that is deliberate

The concurrency group is
`pr-gate-${{ github.event.pull_request.number || github.ref }}`, so:

- **A merge train on `main` cancels nothing.** `cancel-in-progress` is
  `${{ github.event_name == 'pull_request' }}`, false for a push. That is the
  Task 5 fix itself — every `main` commit's coverage is distinct, and
  cancelling one loses it permanently.
- **A train of separate PRs cancels nothing.** Different PR numbers land in
  different groups and never contend.

Only repeated pushes to the _same_ PR supersede anything. Worth knowing before
planning a test around it, since the obvious experiment — merge several PRs and
watch — proves nothing either way.

## A docs-only PR now costs 47 seconds

Also measured on run `33398914277`. The scope job resolved `root=false`, so six
of the eight jobs skipped:

| Job                    | Result  |
| ---------------------- | ------- |
| Scope                  | success |
| PR Gate (aggregator)   | success |
| Lint and typecheck     | skipped |
| Unit tests (1-2/2)     | skipped |
| Browser tests (1-4/4)  | skipped |
| Workers                | skipped |
| Validate changed files | skipped |
| Beside Cue             | skipped |

The aggregator treats a scope-skipped job as a pass, which is what makes this
safe rather than a hole — a job that was _required_ and did not succeed still
fails the gate. Against 386s for a full source PR and ~930s for the old serial
gate, a docs change is now effectively free.
