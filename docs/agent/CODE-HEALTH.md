# Code health audit — MercuryPitch

Audit date: 2026-08-14. Commit: `e45a0c8`.

**Every number in this document is produced by `node scripts/code-metrics.mjs`.**
That is the point of the harness: a report whose claims cannot be re-derived is
a snapshot of one afternoon's opinion, and it starts rotting the moment it is
committed. Run the script and you get today's numbers; run
`pnpm metrics:check` and you find out whether they got worse.

```bash
pnpm metrics          # the table this report is built from
pnpm metrics:check    # ratchet: fails if a tracked number regressed
pnpm arch             # layering violations, by rule
pnpm lint:audit       # complexity and security warnings
pnpm audit:dup        # copy-paste detection
```

---

## 1. Verdict

MercuryPitch is a **250k-line, unusually disciplined codebase with a structural
size problem and one entire layer of unenforced architecture.**

That is not a hedge. The two halves are measured separately and they genuinely
disagree, which is the most useful thing in this report: the things that a
compiler or a linter can enforce are in the top decile, and the things that only
a convention can enforce have drifted badly. The gap between those two numbers
is the actionable finding.

| Signal                                 | Value                                              | Reading                                        |
| -------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| Type coverage                          | **99.78%** (657,612 / 659,040)                     | Excellent — top decile                         |
| Explicit `any` in production           | **7** in 342k lines                                | Excellent                                      |
| `@ts-ignore` / `@ts-nocheck`           | **0**                                              | Excellent                                      |
| `tsc --noEmit`                         | clean                                              | Excellent                                      |
| Code duplication                       | **2.2% lines / 2.41% tokens**                      | Good (industry tolerance is 3–5%)              |
| TODO / FIXME / HACK                    | **4** in 342k lines                                | Excellent                                      |
| Snapshot tests                         | **0**                                              | Deliberate, and correct for a canvas-heavy app |
| Unit tests                             | 7,652 across 645 files                             | Substantial                                    |
| —                                      |                                                    |                                                |
| Layer-boundary violations              | **181**                                            | Poor, and unenforced until today               |
| Cross-feature imports                  | **300**                                            | Poor                                           |
| Import cycles                          | **22**                                             | Poor                                           |
| Functions over cognitive complexity 15 | **306** (8 over 100)                               | Poor                                           |
| Production files over 800 lines        | **78** (26 over 1500)                              | Poor                                           |
| Test coverage                          | **47.3% lines / 44.1% branches / 37.6% functions** | Middling, and misleading — see §5              |

The one-line version: **where the compiler is the referee, this codebase is
exemplary; where a human has to be the referee, it has drifted.** Almost every
finding below is a case of a rule that was written down but never made
executable. The fix pattern is the same each time — turn the convention into a
check.

---

## 2. What is genuinely good

Worth stating plainly, because a list of problems reads as a worse codebase than
this is.

**Type discipline is exceptional.** 7 explicit `any` and zero `@ts-ignore`
across 342,462 lines of production TypeScript is rare at any size. 99.78% type
coverage means the type system is actually load-bearing here, not decoration.

**The DSP core is tested for real, and the tests are load-bearing.** The pitch
detectors synthesize actual signals — sine, square, triangle, sawtooth,
harmonic stacks, DC offset, clipping, NaN — and assert output in cents.
`src/lib/pitch-detector-internals.test.ts:459-511` parameterises 11 frequencies
from E2 (82.41 Hz) to C6 (1046.5 Hz) with per-note budgets of 8–20 cents.
Proof it works: changing `src/lib/pitch-detector.ts:449` from
`sampleRate / betterTau` to `/ (betterTau + 1)` — a ~17-cent error, inaudible to
most listeners — turns **32 tests red across 2 files**.

Tolerances are tight rather than laundered. Of 564 `toBeCloseTo` calls, only
**3 in the whole repo** use negative precision. Nobody is hiding a broken
algorithm behind a wide window.

**Persistence and sync is the strongest area.** `src/tests/sync-protocol.test.ts`
is a genuine vertical slice: store write → real IndexedDB via fake-indexeddb →
portable bundle → simulated WebRTC wire with deliberate chunk corruption →
import → state read back. `src/tests/dexie-adapter.test.ts:187` forces a
unique-index collision inside a real Dexie transaction and asserts the rollback
— a hand-written mock cannot produce that failure at all.

**Real contract tests already exist.** `src/tests/hybrid-adapter.test.ts:290`
parses `workers/db-worker/src/tables.ts` off disk and fails if the client's
`CLOUD_ENTITIES` drifts from the tables the worker serves.

**Worker security testing is adversarial, not ceremonial.**
`workers/db-worker/src/access.test.ts` attacks the JWT verifier properly:
`alg: none`, HS256 confusion with a grafted signature, tampered payload, key not
in JWKS, wrong audience, wrong issuer. The device-link tests assert that a wrong
token and an unknown code return **byte-identical** responses, so polling cannot
be used as an enumeration oracle.

**The agent documentation system is better than most human documentation.**
`docs/agent/INDEX.md` is generated from the filesystem and CI-checked for
staleness; `MISTAKES.md` is a genuine institutional-memory file. This is
infrastructure most codebases do not have.

**Dependency hygiene is clean.** dependency-cruiser reports **zero** errors on
the rules that matter for correctness: no shipped source imports a
devDependency, and no import resolves outside `package.json`.

---

## 3. Architecture

### 3.1 The layering is documented but was never enforced

`docs/agent/INDEX.md` §1 describes a clean layered design. Measured against the
code, that description is **aspirational**:

| Rule                      |                    Violations | What it means                               |
| ------------------------- | ----------------------------: | ------------------------------------------- |
| `components-no-features`  |                           106 | The legacy layer depends on the newer layer |
| `no-cross-feature-import` |                           300 | Features reach into each other's internals  |
| `lib-no-stores`           |                            26 | "Pure" algorithms read global state         |
| `lib-no-features`         |                            20 | The bottom layer depends on the top         |
| `stores-no-features`      |                            16 | State depends on UI                         |
| `db-no-ui`                |                            13 | Persistence depends on screens              |
| `no-circular`             |                            22 | Mutual imports                              |
| **Total**                 | **181 errors + 300 warnings** |                                             |

The `lib-no-stores` number is the one that costs the most day to day.
`src/lib/audio-engine.ts` imports `stores/notifications-store` and
`stores/settings-store`; `src/lib/hash-router.ts` imports `stores/index`. A
function that reaches into a store cannot be called from a test without booting
the store — which is precisely why the cheap-to-test layer is smaller than it
looks.

**Fixed today:** `.dependency-cruiser.cjs` now encodes these rules and `pnpm arch`
runs them. Counts are frozen in `docs/agent/code-metrics.baseline.json` and
`pnpm metrics:check` fails if any of them grows. The rules are `warn` rather than
`error` on purpose — a permanently red check trains people to ignore red checks.
The ratchet is what stops the drift; promote each rule to `error` as it reaches
zero.

### 3.2 The 22 cycles are the tractable part

Cycles are the violations that cause real bugs rather than merely ugly graphs,
because they make module-initialisation order significant. 22 is a number a
person can actually finish. The ones worth doing first are the ones that span
layers:

- `src/db/adapters/hybrid-adapter.ts → services/auth-service.ts → services/grant-flush.ts → db/index.ts →` (length 4)
- `src/lib/session-builder.ts ↔ src/stores/index.ts`
- `src/features/practice-intelligence/weakness-analyzer.ts → stores/exercise-history-store.ts → features/routines/use-daily-routine.ts →` (length 3)
- `src/lib/pitch-detector.ts ↔ src/lib/swift-f0-detector.ts`

Three more are pure barrel-file artefacts (`src/components/index.ts` appears in
two) and are the cheapest to remove.

### 3.3 Size is the dominant structural problem

78 production files exceed 800 lines; 26 exceed 1,500.

| File                            | Lines |
| ------------------------------- | ----: |
| `src/components/StemMixer.tsx`  | 7,721 |
| `src/lib/piano-roll.ts`         | 5,954 |
| `src/App.tsx`                   | 4,183 |
| `src/components/UvrPanel.tsx`   | 3,309 |
| `src/stores/jam-store.ts`       | 2,773 |
| `workers/db-worker/src/auth.ts` | 2,615 |

The function-level picture is worse than the file-level one. The largest single
function is **1,459 lines** (`useStemMixerCanvasController.ts:119`); five more
exceed 900.

### 3.4 Complexity, and what it is actually telling you

306 functions exceed SonarSource's cognitive-complexity limit of 15. The
distribution matters more than the count:

| Cognitive complexity | Functions |
| -------------------- | --------: |
| 16–29                |       214 |
| 30–49                |        62 |
| 50–99                |        22 |
| 100+                 |     **8** |

The worst eight:

| Function                                                                  | Cognitive | Cyclomatic |
| ------------------------------------------------------------------------- | --------: | ---------: |
| `src/components/PitchCanvas.tsx:1055`                                     |   **255** |        153 |
| `src/components/OfflinePitchCanvas.tsx:460`                               |       153 |         63 |
| `src/features/guitar-tab-3d/renderer/canvas2d/Canvas2dTabRenderer.ts:964` |       138 |         48 |
| `src/lib/midi-song.ts:311`                                                |       137 |         61 |
| `src/components/guitar/GuitarFretboardCanvas.tsx:281`                     |       135 |         87 |
| `src/components/guitar/InteractiveGuitarFretboardCanvas.tsx:226`          |       125 |         68 |
| `src/features/stem-mixer/useStemMixerCanvasController.ts:651`             |       116 |         77 |
| `workers/db-worker/src/premium-background-admin.ts:1936`                  |       106 |         79 |

**What the evidence actually supports** — this matters, because complexity
metrics are routinely oversold and routinely dismissed, and both are wrong.
See [METRICS.md](METRICS.md) for the full treatment.

- **Cognitive complexity is validated against comprehension _time_, not defects.** Muñoz Barón, Wyrich & Wagner (ESEM 2020) meta-analysed ~24,000 understandability evaluations and found a weighted mean correlation of **0.54** with time-based comprehension, and **0.65** among the significant correlations. Against _correctness_ of comprehension it is mixed and non-significant. So it predicts how long code takes to read — which is the right thing to care about here.
- **It is not simply a proxy for size at function level.** Landman et al. (2016), over 17.6M Java methods and 6.3M C functions, found method-level R² of only 0.40–0.44 (0.68–0.71 log-transformed) — and, counter-intuitively, the correlation gets _weaker_ for larger subroutines (R² 0.40 → 0.14 as the minimum size rises). At **file** level, though, log-log R² reaches **0.90**: a file-level complexity dashboard really is a LOC dashboard with extra steps.
- **The threshold of 15 is convention, not a finding.** It is hard-coded as `DEFAULT_THRESHOLD = 15` in the `eslint-plugin-sonarjs` already installed here; SonarSource picked it per-language by tolerance, not from defect data.

The honest reading: treat the 306 as a **ranked reading-cost worklist**, not a
quality score, and never as an absolute gate. Track the _count_ as a ratchet —
which is what `pnpm metrics:check` does.

What makes the eight above genuinely worth attention is not the number itself,
it is that they intersect with the coverage gap. `PitchCanvas.draw` at
complexity 255 has **no test at all**. That intersection — high complexity ×
zero tests — is the hotspot signal worth acting on.

### 3.5 Hotspots — where to actually spend the effort

Complexity alone ranks code nobody touches. Churn alone ranks trivial files that
change constantly. The product ranks code that is both hard to read and under
active change, which is where reading time and defect odds both concentrate.
See [METRICS.md](METRICS.md) §2 for the evidence behind this one; it is the
metric on that page with the strongest claim to predicting _where_ bugs land.

Top 12 by `commits × summed cognitive complexity`, over the last 12 months:

|  Score | Commits | Σ cognitive | File                                                                  |
| -----: | ------: | ----------: | --------------------------------------------------------------------- |
| 42,883 |      61 |         703 | `src/lib/piano-roll.ts`                                               |
| 15,660 |      54 |         290 | `src/components/PitchCanvas.tsx`                                      |
| 14,076 |     207 |          68 | `src/App.tsx`                                                         |
| 13,600 |     100 |         136 | `src/components/UvrPanel.tsx`                                         |
| 13,464 |      36 |         374 | `src/features/stem-mixer/useStemMixerCanvasController.ts`             |
|  8,740 |      46 |         190 | `workers/db-worker/src/index.ts`                                      |
|  5,092 |      38 |         134 | `src/features/stem-mixer/useStemMixerAudioController.ts`              |
|  4,087 |      67 |          61 | `src/features/stem-mixer/useStemMixerLyricsController.ts`             |
|  3,979 |     173 |          23 | `src/components/StemMixer.tsx`                                        |
|  2,888 |      38 |          76 | `src/lib/audio-engine.ts`                                             |
|  2,744 |       8 |         343 | `src/features/guitar-tab-3d/renderer/canvas2d/Canvas2dTabRenderer.ts` |
|  2,601 |      17 |         153 | `src/components/OfflinePitchCanvas.tsx`                               |

1,321 production files were touched in the last 12 months; 183 of those also
carry at least one over-threshold function. **`piano-roll.ts` is the single
clearest target in the codebase** — 5,954 lines, 61 commits, and 703 points of
summed cognitive complexity across its functions.

Two entries are worth reading against each other. `StemMixer.tsx` has the second
highest churn in the repo (173 commits) but low measured complexity — its
problem is size and responsibility count, not tangled functions.
`Canvas2dTabRenderer.ts` is the opposite: only 8 commits, but 343 points of
complexity, so it is a comprehension cliff waiting for whoever touches it next
rather than an active fire.

> **This section requires unshallow history.** The container cloned this repo
> shallow — 51 commits, all from a two-day window — which would have produced a
> confident and meaningless ranking. `git fetch --unshallow` brought it to 2,138.
> `scripts/code-metrics.mjs` now detects a shallow clone and reports `skipped`
> instead of guessing.

**The pattern behind it is worth naming, because it points at the fix.**
`renderSheetMusic` has complexity 94 and is thoroughly tested. `PitchCanvas.draw`
has complexity 255 and is untested. The difference is not discipline: the first
returns a `SheetLayout` and the second paints pixels. Where this codebase's
functions return data, they are tested; where they mutate a canvas, they are
not. That is an architecture problem wearing a testing problem's clothes, and it
is fixed by extracting the geometry — not by writing canvas tests.

---

## 4. Bugs found

A dedicated multi-lens hunt ran across asynchrony/lifecycle, DSP/numerics,
worker security, state/persistence, UI/resource leaks, and error handling, with
every candidate put through adversarial verification. Full results in §7.

The one fixed during the audit, because it destroys user data:

### Startup prune could permanently delete paid separations

`src/stores/uvr-store.ts:967` runs `pruneOrphanedCompletedSessions()` on every
app start. It deleted any `completed` session for which
`sessionHasPlayableStems()` returned `false` — and that function returned
`false` on **any** error, including an IndexedDB read failure:

```ts
} catch (err) {
  if (IS_DEV) console.warn('[UvrService] sessionHasPlayableStems failed:', err)
  return false          // "read failed" and "no stems" were the same answer
}
```

A read failure is not the same claim as "this session has no stems", but the
deleter could not tell them apart. The delete is durable and there is no undo,
and each lost session is a separation the user paid for.

**Severity, stated honestly:** this needs a _transient_ failure, not a total
one. Under a total IndexedDB outage the bug is self-limiting, because
`deleteUvrSessionFromDb` reads the same store and bails out too. The dangerous
window is one failed read followed by a working one — which IndexedDB does
produce per-transaction (`TransactionInactiveError`, eviction mid-session, a
timeout under load).

**Fix:** `sessionStemPresence()` returns `'present' | 'absent' | 'unknown'`, and
only `'absent'` authorises a delete. Regression test added at
`src/tests/uvr-session-reconcile.test.ts` and **mutation-verified**: it fails
with `expected 1 to be +0` when the fix is reverted.

---

## 5. Tests

Full analysis in [TESTING.md](TESTING.md). The short version, because the
question asked was specifically _are these proper tests or just poking at UI
elements_:

**Mostly proper tests.** The measured shape does not support the suspicion:

| Signal                                                                                               | Value                         |
| ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| Test blocks                                                                                          | 7,422                         |
| Presence-only blocks (every matcher is `toBeInTheDocument`/`toBeVisible`/`toBeTruthy`/`toBeDefined`) | **159 (2.14%)**               |
| Blocks with no assertion at all                                                                      | 44                            |
| `getByRole` vs `getByTestId`                                                                         | 598 vs 203 — correct priority |
| Snapshot tests                                                                                       | 0                             |

2.14% presence-only is a good number. The concentration matters more than the
rate: 68 of those 159 are in five UVR component files.

**But coverage is 47.3% and, more importantly, coverage is the wrong instrument
here.** Eight deliberate mutations of production code were made during the
audit. **Two were caught, six survived** — and each survivor sits in code that
line coverage reports as fully exercised:

| Mutation                                                    | Effect if shipped                     | Result           |
| ----------------------------------------------------------- | ------------------------------------- | ---------------- |
| `pitch-detector.ts:449` period off-by-one                   | ~17 cents error                       | **32 tests red** |
| `KaraokeRailPanels.tsx` resource source reverted            | rail re-suspends every store tick     | **red**          |
| `vocal-analyzer.ts:293` `computeHNR` replaced by a constant | HNR computation deleted               | 64/64 pass       |
| `audio-engine.ts:2372` RIFF magic → `'XXXX'`                | **every exported WAV unplayable**     | 98/98 pass       |
| `PitchCanvas.tsx:783` skip predicate → `+9999`              | ball skips every note after the first | 96/96 pass       |
| `UvrSessionResult.tsx:130` `formatDate` → `'BROKEN'`        | every date reads BROKEN               | 35/35 pass       |
| `UvrProcessControl.tsx` all status icons → `<Music />`      | every status shows a music note       | 28/28 pass       |
| `SettingsPanel.tsx` strip every `role="tab"`                | tablist gone for screen readers       | 1/1 pass         |

This is why §5 does not recommend a repo-wide coverage threshold. The arc-physics
tests execute every line of `arc-physics.ts` while asserting against a _copy_ of
the logic pasted into the test file; the WAV tests execute every line of the
encoder while asserting only `toBeInstanceOf(Blob)`. An 80% line-coverage gate
would have been green through all three.

### The three specific pockets of theatre

1. **Tests that assert against a copy of the system.**
   `src/tests/arc-physics.test.ts` is 1,458 lines for a 154-line module, and 32
   of its 67 tests run through helpers that transcribe `PitchCanvas.tsx:767-830`
   into the test file. The copy has already drifted from production.
   `src/tests/jam-canvas-math.test.ts` has the same shape — its header claims the
   functions are "extracted and exercised directly"; they are retyped.

2. **Mocks that make output constant.** `audio-engine.test.ts:175` stubs
   `startRendering` to always resolve one second of silence, so
   `renderMelodyToWAV` returns a byte-identical blob for every input.

3. **The Playwright suite.** 488 `waitForTimeout` hard sleeps, and **43
   assertions that cannot fail** — `expect(count).toBeGreaterThanOrEqual(0)` on a
   Playwright locator count, which is a non-negative integer by construction. All
   43 are in `melody-library.spec.ts` (27) and `sessions.spec.ts` (16), the same
   two files holding 189 of the 488 hard waits.

### The suite is not deterministic

Three full runs on the same commit, same machine, gave three different answers:
**2 failed / 0 failed / 1 failed**, in _different files_ each time, every failure
a timeout rather than a wrong value. The suite is CPU-bound (645 files, 4 cores,
~320s) and any test near the 5,000 ms default flips under load.

The diagnosable one is **fixed**: `guitar-synth.test.ts` asserted inside a loop
over a 2.2-second buffer — `expect()` twice per sample, ~194,000 calls in one
test. Scanning first and asserting once took it from a 5,000 ms timeout to
**6 ms**.

Genuine order-dependence existed too, and is **fixed**:
`src/tests/app-store.test.ts` failed under `--sequence.shuffle`. The interesting
part was not the flake — it was that the whole `getBandRating` block had been
asserting against a band table left behind by an earlier test. Six tests were
describing behaviour the app does not have. Now passes under 8 shuffle seeds.

---

## 6. CI and gating

### 6.1 The worker test suites did not gate the workers

`.github/workflows/pr-gate.yml` computes a change scope and routes
`workers/db-worker/*` to `db=true`. The only step gated on `db=true` was
`typecheck:db`. The only step that ran vitest was `pnpm test:run`, gated on
`root=true`.

So a PR touching **only** the DB worker never ran the 2,243-line
`auth.test.ts`, `access.test.ts`, `billing.test.ts`, or the five `node-tests/`
suites that replay all 29 real migrations against SQLite. 23 worker test files —
312 tests — did not gate the code they were written to protect. Same hole for
`workers/jam-worker/*`.

**Fixed:** `test:db` and `test:jam` scripts plus two `pr-gate.yml` steps, gated
on `db`/`jam` while `root` is not, so they run on a worker-only PR without
duplicating work when `root=true` already covers them. Measured cost: **16s**
(19 files / 276 tests) and **4s** (4 files / 36 tests).

### 6.2 What CI does well

Worth noting, because the gap above is an exception rather than the rule. The PR
gate computes a per-surface change scope and runs typecheck, lint, format check,
the full unit suite, an e2e build, `@smoke`-tagged Playwright specs, both worker
typechecks and the whole Beside Cue workspace. Actions are pinned to major
version tags. The generated-index staleness check runs before dependency install,
so the cheapest failure happens first. This is a well-built pipeline.

### 6.3 Remaining gaps

- **No coverage gate of any kind.** `vitest.config.ts` configures reporters but no thresholds. §5 argues against a repo-wide number; a per-glob threshold on extracted pure modules plus a total-lines-covered ratchet is the useful form.
- **The full e2e suite runs only after merge** (push to main / tags), so it is a notification, not a gate. Only 59 `@smoke` tests across 21 files gate a PR.
- **`pnpm arch` is not yet in `check:ci`.** The metrics ratchet covers the counts; wiring `arch` in makes the failure legible at the point of change.
- **No `--sequence.shuffle` job.** A nightly shuffled run is the right vehicle for flushing out the remaining order dependence — not the PR gate, where an intermittent red trains people to ignore CI.

---

## 7. Bug hunt results

Six independent hunts, one per lens, then a full read-back of every
`certain`-confidence candidate. 46 candidates; **19 fixed on this branch**, 13
of them with a mutation-verified regression test.

The findings held up: none was fabricated and the citations were accurate. The
_suggested fixes_ held up less well — three would have introduced a worse defect
than they closed, because the hunt reasoned locally without checking who else
depended on the code. BUGS.md records each one. Full list with file:line, failure scenario
and suggested fix in [BUGS.md](BUGS.md).

The four verified:

| Severity | Finding                                                                                                            | Status                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| critical | Startup prune could permanently delete paid separations on a transient IndexedDB read failure                      | **FIXED**, mutation-verified test                 |
| critical | Anonymous account takeover — the `deviceId` credential is published as `userId` on the unauthenticated leaderboard | **CONFIRMED**, not fixed (needs an auth decision) |
| critical | `realFFT` applies the conjugate twiddle, producing mirrored phantom peaks                                          | **FIXED**, verified against a naive DFT           |
| high     | Frequency-domain pitch fallback divides by `bufferSize/2` — every pitch one octave sharp                           | **FIXED**, mutation-verified test                 |

The account-takeover finding is left unfixed on purpose: every remedy changes an
authentication or wire contract, and that is the owner's call. See BUGS.md §2
for the three options and the recommendation.

---

## 8. Recommended order of work

Ranked by value per hour, not by severity.

1. **Done — make CI run the worker tests.** Highest value in the audit; cost was a five-line YAML change.
2. **Done — freeze the architecture baseline.** `pnpm metrics:check` now fails on any regression in layering, cycles, complexity, file size, type escapes, or test-shape metrics.
3. **Fix the confirmed bugs in [BUGS.md](BUGS.md)**, highest severity first. Each one gets a mutation-verified regression test — a fix without a test that fails without it is not finished.
4. **Kill the 22 cycles.** Tractable, and they are the violations that cause real module-init bugs. Three are barrel-file artefacts.
5. **Extract geometry from the canvases.** `PitchCanvas.tsx` (complexity 255), `GuitarFretboardCanvas.tsx` (135) and `OfflinePitchCanvas.tsx` (153) contain pure coordinate math that is currently untestable because it is welded to a 2D context. Extracting it fixes the complexity number, the coverage number and the arc-physics copy problem in one move.
6. **Repoint the copy-based tests at the real code.** `arc-physics.test.ts` and `jam-canvas-math.test.ts` already contain good reasoning; it points at nothing. Export the functions and delete the transcriptions.
7. **Delete the 43 assertions that cannot fail**, and rewrite `melody-library.spec.ts` and `sessions.spec.ts` on web-first assertions.
8. **Port `auth.test.ts` onto the SQLite harness** that already exists in `workers/db-worker/node-tests/` and is unused by the largest backend test file in the repo.

---

## 9. How to keep this honest

This document is only worth committing if it cannot quietly become false.

- `scripts/code-metrics.mjs` produces every number above. `pnpm metrics` prints them; `pnpm metrics:json` emits the full record including per-violation samples.
- `docs/agent/code-metrics.baseline.json` is the frozen baseline. `pnpm metrics:check` exits non-zero if any tracked number grew, and names which.
- When a regression is deliberate, `pnpm metrics:update` and say why in the commit message. The baseline is a record of agreed debt, not a high-water mark to hide behind.
- The ratchet caught a regression introduced _during this audit_, which is the only real evidence that it works.
