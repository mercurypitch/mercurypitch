# Test Strategy — MercuryPitch

Audience: contributors. Scope: the whole test estate (645 vitest files / 7652
tests, 53 Playwright specs after the deletions below, 2 Cloudflare workers).

Derived from a file-by-file audit of 195 test files across four areas,
**including 8 deliberate mutations of production code** — the only honest way to
answer "would this test go red if the feature broke". Where this document states
a number, `node scripts/code-metrics.mjs` re-derives it.

## Already landed from this document

These were applied during the audit; the rest is a backlog.

| Item                                              | Status                                                   |
| ------------------------------------------------- | -------------------------------------------------------- |
| §5.0 CI runs the worker suites                    | done — `test:db` / `test:jam` steps in `pr-gate.yml`     |
| §5.1 dependency-cruiser config + `pnpm arch`      | done — `.dependency-cruiser.cjs`, baseline frozen at 464 |
| Backlog 13 — `app-store.test.ts` order dependence | done — passes under 8 shuffle seeds                      |
| Deletions — the 6 assertion-free e2e specs        | done                                                     |
| Metrics ratchet                                   | done — `pnpm metrics:check`                              |

---

## 1. Honest verdict: proper tests, or UI poking?

**Mostly proper tests, with three specific pockets of theatre and one structural failure in CI that is worse than any of them.**

That is not a diplomatic answer. Here is the evidence in both directions.

### What is genuinely good — name it

**The DSP core is real, and it is mutation-resistant.** The pitch detectors, vocal analyzer, key detector, MIDI parser and transcription scorer synthesize actual signals — Float32Array sine/square/triangle/sawtooth, harmonic stacks, DC offset, clipping, NaN/Infinity — and assert numeric output in cents. `src/lib/pitch-detector-internals.test.ts:459-511` parameterises 11 frequencies from E2 (82.41 Hz) to C6 (1046.5 Hz) with per-note budgets of 8-20 cents. Proof it is load-bearing: changing one line in `src/lib/pitch-detector.ts:449` from `this.sampleRate / betterTau` to `/ (betterTau + 1)` — a ~17-cent shift, inaudible to most people — turned **32 tests red across 2 files**.

**Tolerances are tight, not laundered.** Of 564 `toBeCloseTo` calls repo-wide: 120 at precision 5, 90 at precision 6, 106 at precision 1, 147 default (2dp), 40 at 0, 27 at 2, and **only 3 in the entire repo at negative precision**. At 440 Hz, precision 1 is ±0.05 Hz = 0.33 cents. Nobody is hiding a broken algorithm behind a wide window.

**Persistence and sync is the strongest area in the repo.** `src/tests/sync-protocol.test.ts:176` is a full vertical slice: store write → real IndexedDB (fake-indexeddb, nothing under `@/db` mocked) → portable bundle → simulated WebRTC wire with deliberate chunk corruption → import → state read back through `getUvrSessionByHash`. `src/tests/dexie-adapter.test.ts:187` forces a unique-index collision inside a real Dexie transaction and asserts _both_ the project and its migration markers rolled back — a hand-written mock cannot produce that failure at all. In this area only **27 of 935 tests (2.9%)** assert exclusively on a mock.

**There are real contract tests.** `src/tests/hybrid-adapter.test.ts:290` parses `workers/db-worker/src/tables.ts` off disk and fails if the client's `CLOUD_ENTITIES` drifts from the tables the worker serves — with a header comment recording the bug it exists for (voiceprints missing from `CLOUD_ENTITIES`, every cloud call falling through to a nonexistent Dexie store, the error swallowed by a network-failure catch). Two more exist worker-side (`funnel-events.test.ts`, `premium-backgrounds.test.ts`).

**Security testing in the workers is genuinely adversarial.** `workers/db-worker/src/access.test.ts` attacks the JWT verifier the way an attacker would: `alg: none` (:169), HS256 confusion with a real signature grafted on (:179), tampered payload (:188), key not in JWKS (:197), wrong audience (:143), wrong issuer (:150). The device-link block in `auth.test.ts:1823-2090` asserts that a wrong token and an unknown code return **byte-identical** JSON so polling cannot be used as an oracle (:1938) — and that a failed theft does not consume the approval, so the naive fix that converts theft into denial-of-service also fails (:1918).

**Several component tests are excellent.** `src/features/piano-night/PianoNightApp.test.tsx:246` asserts negative space: no `AudioContext`, no `getUserMedia`, no IndexedDB, no Worker before the user clicks Play — then after Play, accessible name flips Play→Pause, `aria-pressed` flips, the live region reads the right sentence, real oscillator nodes exist, and MIDI/mic/DB are _still_ untouched. A second click asserts `createAudioContext` was called exactly once. `src/features/karaoke-night/KaraokeRailPanels.test.tsx:95` was mutation-verified: reverting the production fix turned it red with "expected 2 times, but got 4 times".

**Zero snapshot tests is a strength here, not a gap.** `toMatchSnapshot` = 0 across 17466 assertions. In a canvas- and audio-heavy codebase, snapshots would have industrialised the presence-only problem described below.

### What is weak — with proof

Eight production mutations were made across the audit. **Two were caught. Six survived.** These were adversarially chosen, so this is not a mutation score — but each survivor is a specific, named hole:

| Mutation                                                                                    | Effect if shipped                     | Result                |
| ------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------- |
| `pitch-detector.ts:449` period off-by-one                                                   | ~17 cents error                       | 32 tests RED — caught |
| `KaraokeRailPanels.tsx` resource source reverted                                            | rail re-suspends on every store tick  | RED — caught          |
| `vocal-analyzer.ts:293` computeHNR → `return {hnrDb:17, quality:'resonant', efficiency:60}` | HNR computation deleted               | 64/64 PASS            |
| `audio-engine.ts:2372/2382` RIFF magic → `'XXXX'`, byte-rate → `12345`                      | every exported WAV unplayable         | 98/98 PASS            |
| `PitchCanvas.tsx:783` skip predicate `endBeat - 0.001` → `+ 9999`                           | ball skips every note after the first | 96/96 PASS            |
| `UvrSessionResult.tsx:130` formatDate → `return 'BROKEN'`                                   | every date in UI reads BROKEN         | 35/35 PASS            |
| `UvrProcessControl.tsx` all status icons → `<Music />`                                      | every status shows a music note       | 28/28 PASS            |
| `SettingsPanel.tsx` strip all six `role="tab"` + every `aria-selected`                      | tablist gone for screen readers       | 1/1 PASS              |

**Aggregate weak-test count.** Across the 2265 vitest tests classified in detail (29.6% of 7652): **160 presence-only** (87 DSP, 62 component, 11 store) and **80 over-mocked** — 240 tests, 10.6%, that assert nothing a break would change. Inside DSP the honest figure is higher: 20 tests with zero `expect()`, 37 whose only assertion is `not.toThrow()`, 30 whose assertions live inside an `if (result !== null)` guard, plus the arc-physics and WAV clusters — roughly **140 of 738 (19%)** that cannot fail for a wrong answer.

**The four named pockets:**

1. **The UVR component family.** 48 of the area's 62 presence-only tests live in five files (`UvrSessionResult` 17/35, `UvrProcessControl` 15/28, `UvrResultViewer` 8/28, `UvrPanel` 5/10, `UvrUploadQueue` 3/8). `UvrProcessControl.test.tsx:330` sits in a describe block literally titled "Status Icons" and asserts `getByText('Processing Complete')` — a duplicate of line 54. Not one of its three tests observes an icon.

2. **Tests that reimplement the system and then assert on the copy.** `src/tests/arc-physics.test.ts` is 1458 lines for a 154-line module. 32 of its 67 tests run through `simulateMelody` (:335) and `simulateWithPositions` (:783), which transcribe the advance block from `PitchCanvas.tsx:767-830`. The copy has already drifted — production sets `arcState.isRest = nextItem.isRest === true`, the test copy hardcodes `isRest: false`. Same pattern in `src/tests/jam-canvas-math.test.ts`, whose header claims the functions are "extracted and exercised directly" — they are retyped at lines 10-27, and changing `PLAYHEAD_PCT` from 0.6 to 0.5 in the real component leaves the file green.

3. **Mocks that make the output constant.** `src/tests/audio-engine.test.ts:175` stubs `startRendering` to always resolve one second of silence, so `renderMelodyToWAV` returns a byte-identical blob for every BPM — and the sole assertion across ~14 "edge cases - WAV export" tests is `expect(blob).toBeInstanceOf(Blob)`. Sixteen of that file's 96 tests contain no `expect()` at all.

4. **The Playwright suite.** 493 `waitForTimeout` calls (melody-library 119, comprehensive 94, critical-flows 75, sessions 70) — hard sleeps, not web-first assertions. **50 occurrences of `expect(count).toBeGreaterThanOrEqual(0)`**, an assertion with no reachable failure state; `sessions.spec.ts` has ~14 in a row (:235-:448). Four committed scratch specs with zero `expect()` (`debug.spec.ts`, `debug-click.spec.ts`, `test-load.spec.ts`, `recursion-test.spec.ts`) — `test-load.spec.ts` calls `page.evaluate` before any `page.goto`, so it runs against `about:blank`. Test names that do not match their assertions: "settings panel closes when clicking outside" never clicks outside.

### The structural failure that outweighs all of it

**Worker tests did not gate the workers.** `.github/workflows/pr-gate.yml` routed `workers/db-worker/*` changes to `db=true`, and the only step gated on `db=true` was `pnpm run typecheck:db`. The only step that ran vitest was `pnpm run test:run`, gated on `root=true`. So a PR touching only the DB worker **never ran** the 2243-line `auth.test.ts`, `access.test.ts`, `billing.test.ts`, or any of the five `node-tests/` SQLite integration tests. Same for `workers/jam-worker/*` → `typecheck:jam` only. **Fixed** by §5.0's `test:db` / `test:jam` steps, which now sit in a `Workers` job of their own.

**Architecture rules are comments.** `pnpm arch` exists and is in neither `pnpm check` (`run-s typecheck lint:fix fmt:write`) nor CI. Running it: **464 violations, 0 errors, 464 warnings** — 273 `no-cross-feature-import`, 99 `components-no-features`, 26 `lib-no-stores`, **22 `no-circular`**, 18 `lib-no-features`, 13 `stores-no-ui`, 10 `db-no-ui`, 3 `no-orphans`. Confirmed in `.dependency-cruiser.cjs`: every layering rule that fires is `severity: 'warn'`. Only `lib-no-components`, `no-deprecated-core`, `not-to-dev-dep` and `no-non-package-json` are errors, and none of them report violations.

**The production adapter is never under test.** `vitest.config.ts` pins `env: { VITE_API_BASE_URL: '' }`, so `getDb()` always returns `DexieAdapter`. `HybridAdapter` — what ships — is the adapter under test in zero store tests. `src/tests/hybrid-adapter.test.ts:163-172` documents the consequence in its own words: a signed-out-write guard discarded every session, streak and badge a new user earned, and "Local mode never reproduces it: DexieAdapter is unguarded, which is why the suite stayed green while prod would not have saved a thing."

### The one-sentence answer for the owner

You are writing proper tests where the code returns data, and poking where the code paints pixels or crosses a process boundary — `renderSheetMusic` (complexity 94) is thoroughly tested because it returns a `SheetLayout`; `PitchCanvas.draw` (complexity 255) has no test at all because it only paints. That is an architecture problem wearing a testing problem's clothes, and it is fixable by moving code, not by writing more tests.

---

## 2. Test taxonomy for this repo

### Shape: a trophy with a DSP spike, not a pyramid

The classic pyramid assumes the expensive-to-test layer is thin glue over a rich domain model. Here the opposite is partly true and partly false:

- **The domain core is pure math** (pitch detection, key detection, MIDI parsing, sheet layout, scoring, billing arithmetic). Pure unit tests there are cheap, fast, deterministic and — as the 32-red mutation proved — genuinely diagnostic. That argues for a fat base, pyramid-style.
- **Every surviving mutation was at a seam**, not inside a function. The WAV encoder, the arc state machine, the audio-graph wiring, the checkout grant routing. Seams need _sociable_ tests: real collaborators, fakes only at the true edge. That argues for a fat middle, trophy-style.
- **The backend is small and stateless-ish** (2 workers, D1, R2, Durable Objects) and already has a real SQL harness in `workers/db-worker/node-tests/` using `node:sqlite` and replaying all 29 real migration files. Backend integration is _cheap_ here in a way it is not for a typical service estate. Buy more of it.
- **E2E is expensive and now gates.** It used to run only `test:e2e --grep @smoke` on `pull_request` — 59 tagged tests across 21 of the then-56 files, with the rest deferred to push-on-main, where a failure is a notification and not a gate. Since the gate became a job graph the whole suite runs on every PR, sharded four ways alongside the other jobs, and the four shards finish inside the wall clock the serial gate spent on a fraction of them. So the old advice — keep the suite small enough to be worth its cost as a notification — no longer applies; the constraint is now the slowest shard, which is what sharding is there to hold down. `@smoke` still tags 153 tests across 42 of 70 files and is a good local pre-push filter, but it no longer selects what CI runs.

So: **trophy overall, with a deliberately over-weighted pure-unit base for `src/lib`.**

### The six levels

| Level                           | Target |        Today (est.) | What belongs here                                                                                                                                                                                      | Non-negotiable rule                                                                                                                   |
| ------------------------------- | -----: | ------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Pure unit**                   |    45% |                ~40% | Anything deterministic in, deterministic out: `src/lib/**` algorithms, geometry, parsers, formatters, `billing-core.ts`, scoring, reducers. No DOM, no timers, no mocks.                               | **Zero `vi.mock`.** If you need one, the unit is not pure — move it down a row.                                                       |
| **Sociable unit / integration** |    30% |                ~25% | Stores + real `DexieAdapter` over fake-indexeddb; services + real repositories; worker handlers + `node:sqlite` D1; controllers + stateful fakes for hardware. Fakes only at the browser/network edge. | The unit under test is **never** mocked, and never reimplemented in the test file.                                                    |
| **Component**                   |    15% |                ~20% | Solid components via `@solidjs/testing-library`. Accessibility contracts, state transitions, negative space (what must _not_ happen), prop-callback contracts.                                         | Query by role and accessible name. `getByTestId` requires a one-line comment saying why role is impossible.                           |
| **Contract**                    |     5% |                 <1% | Client↔worker symbol parity, catalog parity, route→auth tables, adapter↔worker table registry. Read the other side's source off disk and assert agreement.                                             | Must fail loudly if the _parser_ stops matching (see `hybrid-adapter.test.ts:290`'s `expect(served.size).toBeGreaterThan(10)` guard). |
| **Property**                    |     3% |                  0% | Round-trips, monotonicity, invariants over generated input: `hitTestFret(center(s,f)) === {s,f}`, `xToBeat(beatToX(b)) === b`, MIDI serialise→parse, scale-dot pitch-class membership.                 | Every property must have at least one hand-written example alongside it, so a failure is debuggable.                                  |
| **E2E (Playwright)**            |     2% | ~5%, and now gating | Only what a real browser can answer: service worker offline, IndexedDB across reload, `getUserMedia` with a real WAV, multi-tab jam, install/update handshake.                                         | Zero `waitForTimeout`. Zero `.count()` assertions. Every spec earns its shard time or is deleted.                                     |

**Why the shares.** 45% pure unit reflects that ~250k LOC of `src/lib` is where the product's correctness actually lives and where tests are effectively free (the pitch-detector suite runs in seconds). 30% sociable is the growth area — six of eight surviving mutations sit there. 15% component is a _reduction_ from today, because roughly 160 presence-only tests are component tests that should be deleted rather than replaced. 2% e2e reflects that 56 specs at ~15k lines produce one uniquely valuable spec (`db-abstraction.spec.ts` seed idempotency across reload) and one uniquely valuable helper (`e2e/helpers/tone-wav.ts` feeding a real 220 Hz WAV into Chromium via `--use-file-for-fake-audio-capture`, asserted as "A3" at `onboarding-mic.spec.ts:99`).

**Total test count is not a target.** 7652 is already high, and ~240 of the 2265 audited are dead weight. The next 500 tests should come with roughly 200 deletions.

---

## 3. Conventions

### 3.1 Where a test lives — colocation wins

Measured today: `src/tests/` 387 test files, `src/features/` 107, `src/lib/` 88, `src/components/__tests__/` 39, `workers/` 23.

**Decision: colocate.** `foo.ts` → `foo.test.ts` in the same directory.

Be honest about why, because the quality data does _not_ split cleanly by location — the best store tests are in `src/tests/`, and the worst component tests are colocated-ish in `src/components/__tests__/`. The correlation is with age, not path. Colocation is chosen for three mechanical reasons:

1. A reviewer sees the test in the same diff hunk as the change. `arc-physics.test.ts` drifted from `PitchCanvas.tsx` partly because they are 2 directories apart.
2. Deleting a feature deletes its tests. `src/tests/` accumulates orphans (`pitch-canvas-toolbar.test.ts` tests a component named after a different one).
3. A 391-file / 79k-line central folder is not navigable, and "put it in src/tests" is why nobody notices there are already three files aimed at the same module.

**Exception — one folder survives:** `src/tests/integration/` for suites that genuinely span layers and belong to no single module: `sync-protocol.test.ts`, `dexie-adapter.test.ts`, `settings-sync-merge.test.ts`, `hybrid-adapter.test.ts`, contract tests, plus `src/tests/setup.ts` and `src/tests/utils/`.

**Migration path (no big-bang):**

1. **Now:** every new test colocates. No exceptions, enforced in review.
2. **Now:** add `'src/**/*.test.{ts,tsx}'` to `vitest.config.ts`'s `include` alongside the existing enumerated globs, so a colocated test anywhere is picked up.
3. **Opportunistic:** when you modify a module that has a test in `src/tests/`, `git mv` that test file next to it in the same PR. Path fixes only — **no content changes in a move commit**, so the diff reads as a rename.
4. **Ratchet:** a CI step fails if the count of `src/tests/*.test.ts*` at the top level increased versus the merge base. Cheap (`find | wc -l` comparison), and it makes the folder monotonically shrink.
5. **When empty:** collapse `vitest.config.ts` `include` to `['src/**/*.test.{ts,tsx}', 'workers/**/*.test.ts', 'tools/**/*.test.ts']` and delete `src/components/__tests__/`.

Rename `src/components/__tests__/Foo.test.tsx` → `src/components/Foo.test.tsx` as part of step 3.

### 3.2 File naming

- Unit / integration / component: `<module>.test.ts` / `.test.tsx`, adjacent to `<module>.ts`.
- Contract: `<subject>.contract.test.ts` (e.g. `cloud-entities.contract.test.ts`). Distinct suffix because these are the only tests that read another package's source off disk, and reviewers should recognise them instantly.
- Property: no separate file; a `describe('properties', ...)` block inside the module's `.test.ts`.
- Worker SQL integration: stays in `workers/db-worker/node-tests/*.test.ts` (different runtime — `node:sqlite`).
- E2E: `src/e2e/<feature>.spec.ts`. One feature per file. No `debug*`, no `test-*`, no `*-test.spec.ts`.

### 3.2b Which environment a test runs in

`vitest.config.ts` defines two projects. A test lands in one or the other; it
never runs in both, and the include/exclude sets are exact complements, so
`--project node` and `--project jsdom` must sum to the full file count.

- **`jsdom`** — the default, and where a new test goes unless someone moves it.
  Setup is `src/tests/setup.ts` (the shared doubles plus
  `@testing-library/jest-dom`).
- **`node`** — the files listed in `vitest.node-tests.json`. Setup is
  `src/tests/setup-node.ts` (shared doubles only). No document, no DOM matchers.

Both load `src/tests/setup-common.ts`, which is where a new global double
belongs unless it genuinely needs a document.

Why bother: a single-project run reported `environment 555.82s` against
`tests 212.28s` — over half the CPU spent building a document per file, most of
them for suites that never touch one.

Moving a file into the `node` list is an optimisation, not a requirement, and
it has to be **verified by running it**, not by reading it. A static scan for
DOM globals put 470 files on the list; 26 of them reached `Audio`, `window` or
a canvas _through their imports_ and failed. Add the path, run
`pnpm run test:run -- --project node`, and check both the exit code and that no
"Errors" line appears — an unhandled rejection does not fail the file on its
own.

Every way this can be wrong is safe: a new file is absent from the list and
gets jsdom (the superset); a listed file that grows a DOM dependency fails
loudly under `node`; a deleted file leaves a glob matching nothing.

### 3.3 Test naming — a behaviour sentence, not a label

`it(...)` completes the sentence "it ...". The name must state an outcome that could be false.

Good, all real, all from this repo:

- `never treats a cleanup retry alarm as a proof deadline after partial deletion` (`jam-room.test.ts`)
- `will not hand a session to somebody who only read the code` (`auth.test.ts:1918`)
- `answers a wrong token exactly as it answers an unknown code` (`auth.test.ts:1938`)
- `does not re-query stems when the store ticks with the same songs` (`KaraokeRailPanels.test.tsx:95`)
- `does not start if initialization resolves after unmount` (`DrumMachinePanel.test.tsx:118`)
- `keeps every tempo change, not only the first` (`midi-song.test.ts:244`)

Banned, all real:

- `renders vocal stem pill` — states existence, not behaviour
- `shows check circle for completed` — promises an icon, asserts text
- `Session history panel exists in DOM` — "exists" is not an outcome
- `can play a note` — "can" is unfalsifiable; the body has no `expect()`
- `handles very high BPM for export` — "handles" hides that the assertion is `toBeInstanceOf(Blob)`

Rule of thumb: if the name contains **renders**, **exists**, **works**, **handles**, or **can**, rewrite it. If you cannot phrase an outcome, you do not yet know what you are testing.

### 3.4 Arrange–Act–Assert

Three visually separated blocks, one Act per test. If you need a second Act, you need a second test — that is what makes `sessions.spec.ts:255` and the four `UvrSessionResult` stem-pill tests unfixable in place.

```ts
it('admits a same-pitch coarse restrike after the debounce', () => {
  // Arrange
  const harness = createListeningHarness({ debounceMs: 40 })
  harness.script([
    { t: 1.0, hz: 220, amp: 0.8 },
    { t: 1.02, hz: 220, amp: 0.1 },
    { t: 1.05, hz: 220, amp: 0.9 },
    { t: 1.07, hz: 220, amp: 0.2 },
  ])

  // Act
  harness.runFrames()

  // Assert
  expect(harness.attacks()).toHaveLength(2)
})
```

Shared setup goes in `beforeEach` only when it is genuinely shared and genuinely resets (see 3.6). Fixture builders (`completedWith({...})`, `makeToken(ttl, provider)`) beat copy-pasted object literals — the four `UvrSessionResult` stem tests duplicate an 11-line seed to vary nothing.

### 3.5 Size limits

- **Soft cap 400 lines, hard cap 600** per test file. Over 600 requires a comment at the top saying why.
- **Ratio guard:** if a test file exceeds 4x the source LOC of its subject, that is a signal you are testing a copy, not the system. `arc-physics.test.ts` is 1458 lines for a 154-line module — 9.5x — and 32 of its 67 tests assert on logic that exists only in the test file.
- Current offenders to split: `auth.test.ts` (2243 lines), `arc-physics.test.ts` (1458), `audio-engine.test.ts` (96 tests, 16 with no assertion), `comprehensive.spec.ts` (94 `waitForTimeout`).
- A `describe` block of 20-30 short cohesive tests is **fine** and is not a "700-line function" — `PianoNightApp.test.tsx:217`, `guitar-night-song-library.test.tsx:149` and `useGuitarListeningController.test.tsx:243` were flagged by a line-counting heuristic and are, on reading, among the best suites in the repo.

### 3.7 Timeouts — fix the cost, do not raise the ceiling

The global default is Vitest's 5s; `vitest.config.ts` deliberately sets no
`testTimeout`. Do not raise it. It is the only thing that reports a genuine
hang, and lifting it globally delays that report for all 11,838 tests to buy
headroom for the twenty that need it.

**A timeout failure on CI and not locally is a measurement, not a flake.**
Before touching any number, find out which kind of slow the test is:

- **Accidental cost — remove it.** Work the test never needed. The premium
  background migration fixture fsynced every commit in its chain to a real
  file: ~2s per Drum case on CI, 12ms locally, three timeouts. `PRAGMA
synchronous = OFF` on the fixture connections took the file from 9.99s to
  284ms. Raising its timeout would have preserved a 350x waste.
- **Inherent cost — give that file an explicit timeout and say why.** Spawning
  a real process, `vi.resetModules()` plus a re-import, a DSP roundtrip, a
  deliberate performance benchmark. `admin-studio-responsive-preview.test.ts`
  spawns Node per case; that is the point of the file.

**This machine hides the problem.** Local `/tmp` is a tmpfs and CI's is a real
disk, so any fixture writing real files runs orders of magnitude faster here.
Reproduce CI's cost before concluding anything:

```
TMPDIR=<path-on-a-real-disk> pnpm exec vitest run <file> --reporter=verbose
```

**Headroom rule: aim for 5x, never ship under 3x.** A shared CI runner is two
to three times slower than a developer box, and slower still when loaded. A
test measured at 2.5s under a 5s ceiling has already failed; it just has not
happened yet.

To find what is exposed, measure the whole suite and compare each duration
against its file's ceiling:

```
pnpm exec vitest run --reporter=json --outputFile=/tmp/timing.json
```

Guard with `vi.setConfig({ testTimeout: N })` at the top of the file when the
whole file is slow, or `it(name, { timeout: N }, fn)` for a single case. Both
carry a comment naming the work being paid for — a bare number is unreviewable.

### 3.8 Browser specs on a machine that is running more than one checkout

Several agents test in parallel here, each in its own worktree. Two things
about `pnpm test:e2e` are worth knowing before you trust a red result.

**The server it talks to may not be yours.** `webServer.reuseExistingServer` is
true, and it decides by asking whether the port answers — not whose build is
behind it. The default port is now derived from the checkout path
(`checkoutPort()` in `playwright.config.ts`), so each worktree gets its own and
this cannot happen silently. Before that fix a sibling worktree's leftover
`serve dist` answered first and the suite reported **71 failures across specs
the branch had never touched**; every "page" in the traces was a directory
listing. If you ever see failures clustered in unrelated specs, look at one
trace's page snapshot before reading a line of source.

**A red spec may just be the machine.** Playwright's local worker default is
half the logical cores, chosen per run and blind to the other runs. Specs with
real deadlines in them — mic capture, decode, animation — fail on contention
first. Two rules keep this cheap:

- Before calling anything a regression, re-run the spec alone. Compare
  like with like: an isolated pass against a full-suite failure proves nothing.
- If it passes alone and fails in the suite, dial the run down further rather
  than chasing it. The local default is already a quarter of the cores;
  `VITE_E2E_WORKERS=2 pnpm test:e2e` goes lower, and the same variable raises it
  again when you are the only one testing.

The control that settles it is the same suite on `origin/main`, run the same
way. CI runners are not shared and retry twice, so a contention flake here is
usually green there — but confirm it, do not assume it (see
[MISTAKES.md](MISTAKES.md), "A CI-only test timeout is a measurement").

### 3.6 When a mock is allowed, and when it is banned

**Allowed — the true edge only:**

- Browser APIs jsdom cannot provide: WebGL, WebRTC, `getUserMedia`, `AudioContext` (see caveat), `navigator.storage`.
- Network: `fetch` at an external host boundary (Stripe, the DB worker from the client).
- Non-determinism: `vi.useFakeTimers()`, seeded RNG, a fixed clock.
- Expensive-but-correctness-irrelevant collaborators, **only if the fake is stateful and honest**. `createUninitializedDrumMachine` in `DrumMachinePanel.test.tsx` with real init/start/trigger semantics: good. `vi.fn()` returning `undefined`: not a fake, an absence.

**Banned:**

1. **Never mock the module under test.** If the file name is `foo.test.ts`, `vi.mock('./foo')` is a defect.
2. **Never reimplement production logic in a test file.** `simulateMelody` (`arc-physics.test.ts:335`), the retyped `beatToX` (`jam-canvas-math.test.ts:10-27`), the inline YIN CMN loop (`pitch-detector-internals.test.ts:304`). If the logic is not exported, **export it** — that is the fix, not a copy.
3. **Never mock a collaborator into producing constant output and then assert only the output's type.** `startRendering` → 44100 zeros + `expect(blob).toBeInstanceOf(Blob)` is how the RIFF-magic mutation survived.
4. **Never mock a local pure module with no browser dependency.** `UvrSessionResult.test.tsx:11-38` stubs 22 icon components — two of which collide on `data-testid="x-icon"` — and asserts on none of them, while removing the ability to test icon selection.
5. **A `toHaveBeenCalled` on a `vi.mock`'d module symbol is not an assertion about the system.** It is allowed only when the call _is_ the observable output — a prop callback (`onConfirm`, `onToggleTrace`) or a true external boundary (a persisted payload via `toHaveBeenCalledWith`, as `session-service-progress.test.ts:62` does correctly). `expect(getAllUvrSessions).toHaveBeenCalled()` (`uvr-auto-resume.test.ts:216`) is not.

**Two global mocks that need fixing, not obeying:**

- `src/tests/setup.ts:113` — `getFloatTimeDomainData(data) { data.fill(0) }` and `:107` `getFloatFrequencyData(data) { data.fill(-100) }`. No signal can reach a detector through a real audio graph anywhere in vitest. Make `MockAnalyser` programmable (`__setSignal(buf)`, a small DFT for the frequency data, a settable `currentTime`) so graph-to-algorithm wiring becomes testable.
- `src/tests/setup.ts:174` assigns a plain object literal to `global.localStorage`, so it is not a `Storage` instance. `vi.spyOn(Storage.prototype, 'getItem')` is never consulted — which silently voids `persistent-storage.test.ts:76` ("still requests persistence when localStorage access is blocked": the SecurityError branch is never entered) and `internal-traffic.test.ts:66`. Install a real `Storage`-backed mock so prototype spies behave as authors expect.

---

## 4. The 30-second "is this test worth writing?" checklist

Answer in order. A **no** at 1, 2 or 3 means stop and change the test.

1. **If I broke the feature, would this go red?** Name the one-line change you would make to the production file. If you cannot name one, the test asserts nothing. _(This is the decisive question. Six of eight audit mutations survived.)_
2. **Is the thing under test the real thing?** Not a `vi.mock` of it, not a copy of it pasted into the test file, not a stub whose output is constant regardless of input.
3. **Is the assertion on an outcome, or on plumbing?** A value, a persisted row, a rendered string, an accessible state, a count, a graph topology — not "a function was called" and not "an element exists".
4. **Would the opposite also pass?** Check your bands do not overlap: `hnrDb > 15` (positive case) and `hnrDb < 20` (negative case) means the constant 17 passes both — which is exactly why deleting `computeHNR` left 64/64 green.
5. **Does the name state the outcome I assert?** If the name says "icon" and the body asserts text, one of the two is a lie.
6. **Does an assertion escape?** `if (result !== null) { expect(...) }`, `not.toThrow()` as the only assertion, `expect(count).toBeGreaterThanOrEqual(0)`, `arrayContaining` where an exact multiset is knowable, `expect(a || b).toBe(true)`. All present in this repo; all unfalsifiable or nearly so.
7. **Is this the cheapest level that can answer the question?** If a unit test can answer it, do not write a Playwright spec. `toHaveClass(/active/)` after a tab click costs ~100x its unit equivalent.

---

## 5. Infrastructure to add

Ordered by return per hour. Costs are engineering effort, not runtime.

### 5.0 — Fix CI gating (P0) — DONE

`pr-gate.yml` routed `workers/db-worker/*` changes to `db=true`, and the only
step gated on `db=true` was `typecheck:db`. The only step running vitest was
`pnpm test:run`, gated on `root=true`. So a PR touching only the DB worker never
ran the 2243-line `auth.test.ts`, the five `node-tests/` SQLite suites, or
`access.test.ts`'s JWT attack battery. Same hole for `workers/jam-worker/*`.

Fixed: `test:db` and `test:jam` scripts, plus two `pr-gate.yml` steps gated on
`db`/`jam` being true while `root` is not — so the worker suites run on a
worker-only PR without running twice when `root=true` already covers them.
Cost measured: 19 files / 276 tests in 16s (db), 4 files / 36 tests in 4s (jam).

### 5.1 — Architecture fitness via dependency-cruiser — CONFIG DONE, PAYDOWN OPEN

`dependency-cruiser` is now a devDependency, `.dependency-cruiser.cjs` encodes
the layering rules from INDEX.md §1, and `pnpm arch` runs them. Remaining:

- Add `pnpm arch` to `check:ci` and to the `root=true` CI branch.
- Convert layering rules from `warn` to `error` as each reaches zero. The counts are already ratcheted by `pnpm metrics:check`, which fails when any of them grows — that is the mechanism that stops the drift, and it is live now.

Baseline to freeze: 464 total (273 `no-cross-feature-import`, 99 `components-no-features`, 26 `lib-no-stores`, 22 `no-circular`, 18 `lib-no-features`, 13 `stores-no-ui`, 10 `db-no-ui`, 3 `no-orphans`).

Prioritise the 22 `no-circular` — cycles are the ones that cause real module-init-order bugs, and 22 is a tractable number.

Cost: low. Value: this is the only mechanism that stops the drift that produced the 464 in the first place.

### 5.2 — fast-check for property tests (~2 hours setup, then per-test)

`fast-check` is **not currently a dependency** (verified). Add as a devDependency.

Where it pays immediately, all round-trips or invariants that hand-written cases cannot cover:

- `hitTestFret(center(stringIndex, fret)) === {stringIndex, fret}` over 6 strings x 25 frets, plus `midi === OPEN_MIDI[s] + f` — the entire correctness claim of the interactive fretboard, currently covered by `expect(container).toBeVisible()`.
- `xToBeat(beatToX(b)) === b`; `beatToX(b1) - beatToX(b2)` depends only on `(b1 - b2)`.
- `midiToStaffY` / `staffYToMidi` round-trip (currently enumerated over 19 naturals x 2 clefs — a property generalises it for free).
- MIDI serialise→parse round-trip, which reaches VLQ deltas beyond 2^14 that the hand-written `varLen` helper cannot produce.
- `detectChords`: output times strictly increasing; no two adjacent entries share root+quality (this is the post-condition the untested merge branch at `chord-detector.ts:216-236` is supposed to guarantee).
- Scale dots: every emitted dot's `midi % 12` is in the scale's pitch-class set.

Rule: pair every property with one hand-written example. Cost: low. Value: high, because these are exactly the geometry/parser modules the extraction work below creates.

### 5.3 — DSP fixture helpers (~half a day)

`fixtures/` currently holds 3 files: two `.lrc` lyric files and a README. No audio, no golden spectra, no reference F0 tracks. Every DSP input is synthesized in-test, and 11 of 31 DSP files each roll their own generator.

Add `src/lib/testing/signal.ts`:

```ts
export function sine(
  hz: number,
  opts?: {
    sampleRate?: number
    seconds?: number
    amp?: number
    phase?: number
  },
): Float32Array
export function harmonicStack(
  f0: number,
  partials: number[],
  opts?,
): Float32Array // partials as relative amplitudes
export function noise(seed: number, opts?): Float32Array // deterministic
export function vibrato(
  f0: number,
  rateHz: number,
  depthCents: number,
  opts?,
): Float32Array
export function withJitter(
  frames: PitchFrame[],
  seed: number,
  dropEvery?: number,
): PitchFrame[]
export function errCents(actual: number, expected: number): number // 1200 * log2(a/e)
export function decodeWav(blob: Blob): Promise<{
  riff: string
  wave: string
  sampleRate: number
  byteRate: number
  dataBytes: number
  samples: Int16Array
}>
```

`decodeWav` is the piece that would have killed the RIFF-magic mutation. `errCents` standardises the assertion the best tests already write by hand. Deterministic seeding matters: `vocal-analyzer.test.ts:485`'s jitter test is valuable precisely because it is reproducible.

Also add `src/lib/testing/recording-canvas.ts` — a Proxy 2D context that **records** `fillRect`/`strokeRect`/`fillText`/`stroke` with coordinates and styles, rather than the current silent no-op Proxy in `piano-roll-placement.test.ts` that makes 97 points of `drawNoteBlocks` complexity execute with zero assertions.

Cost: low. Value: high, and it is a prerequisite for backlog items 5 and 6.

### 5.4 — Store reset helper (~2 hours)

`src/tests/utils/store-reset.ts`:

```ts
// Simulates a page reload for module-init singletons.
export async function reloadStore<T>(
  specifier: string,
  seed?: () => void,
): Promise<T> {
  vi.resetModules()
  localStorage.clear()
  seed?.()
  return import(specifier)
}
```

The pattern already exists and works in `karaoke-settings-store.test.ts` (`vi.resetModules()` + dynamic re-import). It is absent from `app-store.test.ts`, whose `beforeEach` does `localStorage.removeItem('pitchperfect_settings')` — which resets nothing, because `appStore.settings()` is a module-level Solid signal resolved once at import. Proven: `vitest run src/tests/app-store.test.ts --sequence.shuffle --sequence.seed=7` fails with `expected 10 to be 7`.

Also add `--sequence.shuffle` to a nightly job (not the PR gate — a shuffled suite that fails intermittently teaches people to ignore CI). A 14-file shuffle at seed 42 found exactly 1 broken test of 163, so the coupling is contained and worth flushing out once.

Cost: very low. Value: prevents an entire class of false green and false red.

### 5.5 — Contract tests on the worker boundary (~1 day for the first three)

Three good ones exist (`CLOUD_ENTITIES` vs worker `TABLES`; worker funnel-events vs `src/lib/funnel-event-catalog`; premium-backgrounds vs `background-catalog`). Extend the pattern:

- **Route→auth ratchet.** Extract the `/api/...` route literals from `workers/db-worker/src/index.ts` and assert every one has an entry in a test table stating its expected unauthenticated status. Only 6 of 20 routes appear anywhere in db-worker tests today. A route added without a table entry fails the suite — that turns the table into a ratchet instead of a snapshot.
- **Port `auth.test.ts` onto the SQLite harness.** `auth.test.ts` runs against a hand-rolled `AuthStatement` that dispatches on exact SQL _strings_ and throws `Unexpected first() SQL: ${this.sql}` on anything unrecognised. It cannot catch a bad JOIN, a constraint violation or a D1 dialect issue. The right substrate is already in the repo and unused by that file: `workers/db-worker/node-tests/score-visibility-integration.test.ts:1-62` builds a real `SqliteD1Database` on `node:sqlite` and replays all 29 real migration files. Move the highest-value describes (device link, session issuance, account erasure) across.
- **Client↔worker auth-provider contract.** Assert the worker 403s an anonymous bootstrap carrying a real account's id and does not overwrite `authProvider` — the "junk population" incident the source comment at `auth.ts:1051-1056` records.

Cost: moderate. Value: high — this is the seam class where six of eight mutations survived.

### 5.6 — Coverage thresholds, as a scoped ratchet only (~half a day)

`@vitest/coverage-v8` is installed; `vitest.config.ts` configures reporters and an `include` list but **no thresholds**.

Be blunt about the limits here. Line coverage would have been _actively misleading_ on this codebase: the arc-physics "integration" tests execute every line of `arc-physics.ts` while asserting on a copy; the WAV tests execute every line of the encoder while asserting `toBeInstanceOf(Blob)`; `drawNoteBlocks` (complexity 97) runs fully under a no-op Proxy context with zero assertions. A repo-wide 80% gate would have been green through all three.

Therefore:

- **Do not** set a repo-wide threshold. It buys nothing and will be gamed.
- **Do** set per-glob thresholds on the pure modules that get extracted (see backlog): `src/lib/pitch-canvas-geometry.ts`, `src/lib/guitar/fretboard-geometry.ts`, `src/lib/arc-physics.ts`, `src/components/jam/jam-canvas-math.ts`, `workers/db-worker/src/billing-core.ts` — at 95% lines/branches. These are pure, small, and there is no honest reason to miss a branch.
- **Do** add a ratchet on the whole repo: fail if total covered lines _decreases_ against the merge base. That catches deletion-of-tests without setting an absolute number anyone argues about.

Cost: low. Value: moderate, and only in the narrow scope. Say out loud in the config comment why the repo-wide threshold is deliberately absent.

### 5.7 — Mutation testing: honest verdict — buy a small one, not a big one

**Do not run Stryker repo-wide.** The full vitest suite is 320s for 7652 tests. Stryker runs the relevant test subset once per surviving mutant; over ~250k LOC of `src` that is a multi-hour-to-multi-day job even with per-mutant test filtering, on a codebase where the `include` list already spans 645 files. The cost is not justified when 240 known-dead tests are sitting uncollected — hand mutation found six real holes in one afternoon at zero tooling cost.

**Do configure a scoped `stryker.conf.json`** over roughly 8 pure modules where the tests are already strong and a mutation score is therefore a _grade_ rather than a to-do list:

```
src/lib/pitch-detector.ts, src/lib/pitch-algorithms/**, src/lib/pitch-measurements/**,
src/lib/frequency-to-note.ts, src/lib/key-detection/**, src/lib/transcription/**,
src/lib/midi-song.ts, workers/db-worker/src/billing-core.ts
```

Run it nightly or weekly, never in the PR gate. Target: 85% mutation score on that set. If it comes back at 85%+, the DSP verdict above is confirmed quantitatively and you can stop worrying about that area permanently — which is worth the setup on its own.

**Meanwhile, adopt hand-mutation as a review practice**, which costs nothing: when reviewing a new test, ask the author which one-line production change they verified turns it red. That single question is what separated the two caught mutations from the six survivors.

### 5.8 — Lint rules that make the known antipatterns unwriteable (~half a day)

Add to `eslint.config.js`, scoped to test globs:

| Rule                                                                         | Blocks                                                            | Evidence                                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `no-restricted-syntax` on `expect(...).toBeGreaterThanOrEqual(0)`            | tautological count assertions                                     | 50 occurrences in `src/e2e`                                                                           |
| `no-restricted-syntax` on `page.waitForTimeout`                              | hard sleeps                                                       | 493 occurrences                                                                                       |
| custom: `it`/`test` body must contain ≥1 `expect`                            | zero-assertion tests                                              | 20 in DSP alone, 16 in `audio-engine.test.ts`                                                         |
| `no-restricted-syntax` on `it.skip` older than N days without a linked issue | 4 skipped tests in `recursion-test.spec.ts` for a removed feature |                                                                                                       |
| warn on `getByTestId` in `src/features/**`                                   | testid habit where role exists                                    | `src/features` is already 319 `getByRole` vs 52 `getByTestId`; `src/components` inverts it, 89 vs 111 |

Also adopt `@testing-library/user-event`: **0 of 74 component files use it**, all 48 that interact use `fireEvent`. `fireEvent.click` skips the pointerdown/focus/keyboard sequence, so focus-trap and pointer-capture bugs slip through.

---

## 6. Prioritized backlog — the first 15 tests

Prerequisite: **do 5.0 (CI gating) first.** Items 1-4 and 15 do not gate anything until it lands.

| #   | Test file                                                 | Behaviour asserted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Why it is first                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `workers/db-worker/src/billing.test.ts`                   | A signed `checkout.session.completed` with `metadata: { userId:'u1', credits:40, planId:'pack-40' }` leaves u1's `creditBalance` at 40 with a ledger row `reason:'purchase'`, `idempotencyKey:'evt:<id>'`. A **donation** (`kind:'donation'`, `entitlementDays:30`) creates an `entitlements` row `feature:'supporter'`, `source:'donation:anthem'`, delta 0 — and a second donation **stacks** expiry to ~60d rather than resetting. `metadata:{userId:''}` grants nothing.                                                                | `grep 'checkout.session.completed' **/*.test.ts` returns zero hits. All four webhook tests use `payment_intent.succeeded`, which never enters the grant branch. Invert the donation/credits routing at `billing.ts:363` and nothing goes red. This is the money path.                                                                                                                                                                                           |
| 2   | `workers/db-worker/src/billing.test.ts`                   | With a `creditLedger` row pre-inserted at `idempotencyKey:'evt:evt_race'`, POSTing that event returns `{received:true, duplicate:true}` **and `billingEvents` does not contain `evt_race`**. After deleting the claim row, re-POST grants normally.                                                                                                                                                                                                                                                                                         | `billing.ts:936-941`'s own comment: recording the event on the loser's behalf makes "every retry and sweep skip it forever: paid, no grant, no trace." Guard is unexercised; failure is silent revenue loss.                                                                                                                                                                                                                                                    |
| 3   | `workers/db-worker/src/reconcile.test.ts` (new)           | With `stripeGet` stubbed to two pages of `checkout.session.completed` and one id pre-seeded in `billingEvents`: the seeded event produces no new ledger row, the other three do, page 1's `has_more` triggers a second request carrying `starting_after=<last id>`, and the alert email body lists exactly the 3 recovered ids. Second case: a poisoned middle event throws — events either side still grant, and the poisoned id is absent from `billingEvents` so the next sweep retries it.                                              | `grep -rn reconcileBilling` returns 3 hits: definition, import, call site. No test. Its header comment says it exists because "the endpoints pointed at a dead host for 10 days" — a real incident with no regression test.                                                                                                                                                                                                                                     |
| 4   | `workers/db-worker/src/auth.test.ts`                      | Add a `rateLimited: string \| null` switch to the fake DB (the pattern already in `billing.test.ts:43-44`). For each bucket in `RATE_LIMITS` (`auth.ts:539-549`), the corresponding endpoint returns **429 with a non-null `Retry-After`**; a fresh window resets the count.                                                                                                                                                                                                                                                                | `auth.test.ts:54-59` hardcodes `{count: 1}` for every `auth_ratelimit` insert, and `auth.ts:682` only trips on `count > max`. Delete every `checkRateLimit` call and ~120 tests stay green. Includes `anonymous-day: 100/day`, added after a real 2026-08-08 incident.                                                                                                                                                                                          |
| 5   | `src/lib/audio-engine.test.ts` (colocated)                | Using `decodeWav` from 5.3: exported blob has `RIFF` at bytes 0-4, `WAVE` at 8-12, `sampleRate` 44100 at offset 24, `byteRate === 44100 * channels * 2` at 28, and `dataChunkSize === totalBytes - 44` at 40. Plus: the same melody at BPM 20 yields a data chunk ~50x longer than at BPM 1000.                                                                                                                                                                                                                                             | The RIFF-magic + byte-rate mutation left 98/98 green. Every exported file would be unplayable. Replaces ~14 tests whose only assertion is `toBeInstanceOf(Blob)`.                                                                                                                                                                                                                                                                                               |
| 6   | `src/lib/arc-physics.test.ts`                             | **Refactor first:** extract `PitchCanvas.tsx:767-830` into `export const advanceArc = (state, playable, beat, targetYFor, bpm): ArcState`. Then repoint the existing 32 tests at the real function and delete `simulateMelody`/`simulateWithPositions`. Assertion text is unchanged.                                                                                                                                                                                                                                                        | Changing the skip predicate at `PitchCanvas.tsx:783` to `endBeat + 9999` — the ball skips every note after the first — left 96/96 green across `arc-physics.test.ts` and all five PitchCanvas consumers. The copy has already drifted on `isRest` and `initialized`.                                                                                                                                                                                            |
| 7   | `src/db/services/auth-service.test.ts` (moved/colocated)  | `pollDeviceLink` on 200 `{status:'linked', token: makeToken(3600,'password')}` makes `getAuthToken()` return that token and `hasValidToken()` true. 200 `{status:'linked'}` with **no** token returns `'expired'` and leaves the token null. Status **429 maps to `'offline'`, not `'expired'`**. `approveDeviceLink` with no stored token returns `'signed-out'` without calling fetch.                                                                                                                                                    | The worker half is excellent; the client half is `vi.fn()` in every test that touches it. Delete `setAuthToken(data.token)` at `auth-service.ts:735` and QR sign-in silently never signs anyone in, with the suite green. The 429 mapping has a comment explaining it: "A 429 is this device polling too eagerly, not a dead code."                                                                                                                             |
| 8   | `src/lib/vocal-analyzer.test.ts`                          | The 60 dB constructed spectrum yields `hnrDb > 30` **and** `quality === 'resonant'`; the flat-noise spectrum yields `hnrDb < 6` **and** `quality === 'breathy'`. Plus a monotonicity sweep over harmonic:floor ratios 10:0.01, 10:0.1, 10:1, 10:10 asserting `hnrDb` strictly decreases at each step.                                                                                                                                                                                                                                       | Current bands overlap: `>15` and `<20`, so 17 passes both. Replacing the entire `computeHNR` body with a constant left 64/64 green. The monotonicity sweep alone kills every constant-return stub. Same overlap exists in `approximateBreathiness` (30/60/30).                                                                                                                                                                                                  |
| 9   | `src/lib/jam/signaling.test.ts` (new, colocated)          | With a fake WebSocket via `vi.stubGlobal`: (a) after `room-created` with `ownerToken:'secret'`, an `onclose` + timer advance reconnects and the new socket's first `join-room` frame carries `ownerToken:'secret'`; (b) an `error` frame received **before** any admission means **no reconnect is ever scheduled**; (c) an error **after** `room-joined` does reconnect, with delay doubling per attempt up to `RECONNECT_MAX_ATTEMPTS`; (d) `connect()` resets `reconnectAttempts` to 0.                                                  | 489 lines with zero real-client tests. The `admitted` flag's own comment: the 13th person opening an invite to a full room "was bounced to an idle lobby with no Leave button while their tab hammered that room's Durable Object ~30 times a minute." Losing `currentOwnerToken` across a hibernation reconnect means the room permanently loses its host.                                                                                                     |
| 10  | `src/stores/jam-store-peer-left.test.ts` (new)            | Mock `@/lib/jam/service` to capture the callbacks, call `initJam()`, arrange two peers with lines assigned to B, `jamAssignBrush('peer-b')`, pitch history and a songHaves entry for B. Fire `onPeerLeft('peer-b')` and assert **each of eight** state transitions: peer removed, `jamPitchHistory` has no `'peer-b'`, `jamRemoteStreams` has no `'peer-b'`, `jamSongHaves` has no `'peer-b'`, `jamAssignBrush()` is null, and B's lines are re-homed to a remaining peer. Second case: `onPitchMessage` from an unknown peerId is dropped. | `grep 'initJam' **/*.test.ts` returns zero hits — none of the callbacks wired at `jam-store.ts:1719-1830` is ever invoked by a test. Tests call `setJamPeers([...])` directly, bypassing the handler. The rehome comment: a part falling silent "is indistinguishable, from inside the room, from the song being broken."                                                                                                                                       |
| 11  | `src/e2e/pwa.spec.ts`                                     | With the worker in control: `context.setOffline(true)` then `page.reload()` renders the app shell (`page.locator('[id^="tab-"]').first()` visible), not the browser error page. Offline navigation to a `STANDALONE_DOCUMENT_PATHS` entry does **not** get served the SPA shell. Posting `{type:'mercurypitch:skip-waiting'}` to `registration.waiting` fires `controllerchange`. A bogus `/assets/gone-Deadbeef.js` cache entry is gone after activate while `/` survives.                                                                 | `grep -rn offline src/e2e/*.spec.ts` returns one hit and it is a code comment. No test ever calls `setOffline(true)`. The update handshake is the only way a user leaves a stale worker — and a stale worker is the one thing you cannot hotfix.                                                                                                                                                                                                                |
| 12  | `src/lib/guitar/fretboard-geometry.test.ts` (new)         | **Extract first:** `computeFretboardLayout(w,h)` and `hitTestFret(px,py,layout)`. Then a fast-check property: for every `stringIndex` 0-5 and `fret` 0-24, `hitTestFret(center(s,f))` returns exactly `{stringIndex:s, fret:f, midi: OPEN_MIDI[s] + f}`. Plus boundaries: a click on a fret wire, above high E, below low E (all `null`, never clamped), fret 0 vs the nut.                                                                                                                                                                 | `grep -rln GuitarFretboard src` returns five files, all source, zero tests. This is not drawing — it decides which note the user played, feeding quiz mode, ear training, CAGED and sing-to-fretboard. Only coverage: `expect(page.locator('#guitar-fretboard-container')).toBeVisible()`. One property covers 150 cells.                                                                                                                                       |
| 13  | `src/tests/app-store.test.ts` — **DONE**                  | The fresh-browser cases re-import after `vi.resetModules()`; the `getBandRating` block sets the band table it asserts against. Now passes under shuffle seeds 7, 42, 1, 99, 123, 555, 2024 and 31337.                                                                                                                                                                                                                                                                                                                                       | Was order-dependent two ways. `expected 10 to be 7` because a sibling's `setSettings` leaks into a module-init signal that `localStorage.removeItem` does not reset. Worse, the whole `getBandRating` block was asserting against a band table left behind by the `loads from localStorage if present` case — cents 5 scores 100 against the shipped `learning` table, not the 90 those tests claim. Six tests were describing behaviour the app does not have. |
| 14  | `src/components/jam/jam-canvas-math.test.ts`              | **No new assertions.** Export `beatToX`/`midiToY`/`freqToY`/`sampleToX` from a new `src/components/jam/jam-canvas-math.ts`, import them in the existing test, delete the ~60 retyped lines. Then add the inverse property `xToBeat(beatToX(b)) === b`.                                                                                                                                                                                                                                                                                      | The file's header claims the functions are "extracted and exercised directly" — they are retyped at lines 10-27. Change `PLAYHEAD_PCT` from 0.6 to 0.5 in `JamExerciseCanvas.tsx` and all 217 lines stay green while the jam playhead visibly moves. The reasoning in these tests is good; it points at nothing.                                                                                                                                                |
| 15  | `workers/db-worker/src/route-auth.contract.test.ts` (new) | A table of all 20 `/api/...` routes from `index.ts`, each with `{method, path, expectedUnauthedStatus}`. For each: an unauthenticated request returns 401/403 — never 200, never 500. An unknown `/api/` path returns 404, not a fall-through. The table is generated from the route list so a route without an entry **fails the suite**.                                                                                                                                                                                                  | Only 6 of 20 routes appear in any db-worker test. `handleRequest` (complexity 95) is where auth gating, CORS and method checks live — a mis-ordered `startsWith` prefix or a route added below a `return` is exactly the bug only a dispatcher-level test catches.                                                                                                                                                                                              |

### Runners-up (16-20), for the same sprint if there is room

16. `src/lib/pitch-canvas-geometry.test.ts` — extract `freqToY`/`beatToX`/`verticalBounds` from `PitchCanvas.tsx` (complexity 255) **and** the byte-identical duplicate `freqToY` in `OfflinePitchCanvas.tsx:436`; assert the current beat lands at `w * WINDOW_FILL_RATIO`, `freqToY` is strictly monotonic and maps bounds to `h`/`0`, and 220 Hz vs 440 Hz are exactly one octave apart in y for any height.
17. `src/features/keyboard/useKeyboardShortcuts.test.ts` — table over `(activeTab, code, isTyping, playbackState)`; four cases that encode shipped bugs: Space on `TAB_EXERCISES` must **not** `preventDefault`; Space on `TAB_KARAOKE` calls nothing; Escape with a modal dismisses only the modal; Escape while playing calls `stop()` **and** `seekToStart()`. The current file has exactly one test and exercises line 90 only.
18. `src/lib/piano-roll.test.ts` — put a real `<input>` in the container, focus it, dispatch Ctrl+A, assert the editor selection stays **empty**. The `isTyping` guard's comment names the app-wide bug ("Ctrl+A in an unrelated text input selected piano-roll notes"); nothing guards it.
19. Rewrite the five UVR component files as `it.each` tables asserting `data-icon` on a single `process-icon` testid and the formatted date value via the label's `nextElementSibling`. 48 of the area's 62 presence-only tests live here; this is 77% of the dead weight in one place.
20. `src/tests/setup.ts` — make `MockAnalyser` programmable and install a real `Storage`-backed `localStorage`; then add one integration test pushing a 440 Hz buffer through the real capture chain and asserting "A4" reaches the store.

### Deletions to land in the same sprint

Negative work, and cheaper than any test above:

- **DONE** — deleted `src/e2e/debug.spec.ts`, `debug-click.spec.ts`, `debug-store.spec.ts`, `test-load.spec.ts`, `live.spec.ts`, `recursion-test.spec.ts` (56 specs → 47 counting the earlier three). Zero or one `expect()` between them; `test-load.spec.ts` ran `page.evaluate` before any `goto`, i.e. against `about:blank`; `recursion-test.spec.ts` tested a removed feature and its one live assertion was `expect(count).toBeGreaterThanOrEqual(0)`; `debug-store.spec.ts`'s single real assertion (`#settings-panel` visible) is already covered twice in `comprehensive.spec.ts` and once in `critical-flows.spec.ts`. `live.spec.ts` additionally pointed at `https://mercurypitch.com/`, which the guardrail in AGENTS.md §1 forbids.
- `src/tests/piano-roll-playback.test.ts:397-520` — 12 tests including `expect(-1 < 0).toBe(true)` and `expect(valid || from === to).toBe(true)`. The block never imports `PianoRollCanvas`; it would pass with the piano roll deleted. Replace with one test asserting `updatePlaybackPosition` is called for beat 2 and not for beat -1.
- The 50 `expect(count).toBeGreaterThanOrEqual(0)` assertions in `src/e2e`, and the ~14 consecutive ones in `sessions.spec.ts:235-448`. Delete `#session-history-panel` from the app entirely and every one of them still passes.
- `src/lib/pitch-algorithms/test-data.ts` and its `index.ts:16` re-export — 292 lines of "reference" data that no test imports, wrong by a full octave throughout `OCTAVE_JUMPS` (55.0 Hz labelled A2/MIDI 45; correct is A1/33), sitting exactly where a future contributor building a detector benchmark would reach for it.
- The 16 zero-assertion tests in `src/lib/audio-engine.test.ts` — replace with graph assertions on the already-instrumented mock context, or delete.

### The suite is not deterministic — and the cause is not what it looks like

Three consecutive full runs on the same commit and the same machine gave three
different answers:

| Run | Result                     | Failing file                                                             |
| --- | -------------------------- | ------------------------------------------------------------------------ |
| 1   | 2 failed / 7649 passed     | `src/features/piano-night/PianoNightApp.test.tsx` (`findByRole` timeout) |
| 2   | **0 failed** / 7651 passed | —                                                                        |
| 3   | 1 failed / 7650 passed     | `src/tests/guitar-synth.test.ts` (`Test timed out in 5000ms`)            |

The tempting diagnosis is cross-file state pollution. It is not: the failures
land in different files each run, and each is a **timeout**, not a wrong value.
The suite is CPU-bound (645 files, 4 cores, ~320s wall) and any test that sits
close to the 5000ms default will flip under load.

The `guitar-synth` case was the diagnosable one and is now **fixed**. It asserted
inside a loop over a 2.2-second buffer — `expect()` twice per sample, ~194,000
calls in one test. Scanning first and asserting once took it from a 5000ms
timeout to **6ms**. Look for that shape before reaching for a timeout bump:
`node scripts/code-metrics.mjs --json` reports the remaining hot-loop sites.

Genuine order dependence exists too, but it is contained and separate — see
backlog item 13, already fixed. A permanently or randomly red suite trains
everyone to ignore the signal, so treat a flake as a defect with a cause, not as
noise to retry.

---

## Appendix: the one-line summary of the whole document

Where mercurypitch's code returns data, its tests are good enough that a 17-cent pitch error turns 32 of them red. Where its code paints pixels or crosses a process boundary, six deliberate breakages out of eight went undetected. Extract the pure logic out of the canvases and the seams, point the existing tests at the real functions instead of their copies, and make CI actually run the worker tests — those three moves close most of the gap without writing much that is new.
