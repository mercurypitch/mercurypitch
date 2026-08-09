# Ear Lab — Handoff (2026-08-09)

**Status:** Phases 0-3 built, rebased onto `main`, open as
**[PR #404](https://github.com/mercurypitch/mercurypitch/pull/404)** (1 commit,
54 files, +8962/-3). Phase 4 (habit) starts next. One known measurement bug
(§3) that does not corrupt anything currently recorded.

Plan and research: [`ear-training.md`](ear-training.md) — the single source of
truth; §10 is the decision log. Hardware script:
[`../ear-lab-testing.md`](../ear-lab-testing.md).

---

## 0. How to continue in a fresh environment

```bash
git fetch origin
git worktree add ../mercurypitch-ear-lab feat/ear-lab
cd ../mercurypitch-ear-lab && pnpm install
pnpm dev            # or pnpm dev:host to test from a phone over LAN
```

Then open the **Ear Lab** tab. Read [`ear-training.md`](ear-training.md) §7-§10
before touching measurement code — the invariants in §4 below are the ones that
are easy to break without noticing.

The branch is one squashed commit on top of `main`. The pre-rebase history is
preserved locally as branch `backup/ear-lab-pre-rebase` and tag
`ear-lab-pre-rebase` — not pushed, so it only exists on the machine that did
the rebase (2026-08-09). Nothing depends on it; it is a safety net.

---

## 1. What just happened (2026-08-09)

- **Squashed** the 9 Phase 0-3 commits into one. `main` had moved 516 commits
  since the branch point, so squashing meant resolving conflicts once instead
  of nine times.
- **Rebased** onto `origin/main`. All three conflicts were the same shape — an
  import list in `App.tsx`, `AppNavTabs.tsx` and `hash-router.ts` where `main`
  had added `TAB_LAB` / `TAB_PITCH_ALGO` / `TAB_PITCH_TEST` and we had added
  `TAB_EAR_LAB`. Resolved as unions.
- **Verified lossless**: every Ear Lab-owned file is byte-identical to the
  pre-rebase backup (they do not exist on `main`, so the rebase must not touch
  them), same 54 files, nothing dropped.
- `pnpm check` clean; full suite **521 files, 6218 passed, 1 skipped, 0 failed**.
- Pushed with `--force-with-lease` (allowed for rebases per `AGENTS.md` §2;
  plain `--force` is not). PR #404 updated in place.

---

## 2. What `main` gained that intersects the Ear Lab

The branch point predates a lot. The pieces that matter here:

| On `main` | Why it matters |
| --- | --- |
| `src/lib/mic-latency.ts`, `src/stores/mic-latency-store.ts`, `src/features/mic-feedback/MicLatencyWizard.tsx` | A second latency wizard measuring the **same** physical quantity as the Ear Lab's. See §3. |
| [`docs/specs/mic-latency.ears.md`](../specs/mic-latency.ears.md) | EARS spec for it, `REQ-ML-001..011`. Binding. |
| `src/lib/calibration-stats.ts` | Shared statistics (median + spread), also used by tap calibration. The Ear Lab has its own copy of this maths in `aggregateLatency`. |
| `src/lib/tap-calibration.ts`, `TapCalibrationPanel.tsx` | Reaction-time calibration — deliberately the *opposite* convention (it **adds** `outputLatency`). Do not conflate with round trip. |
| [`AGENTS.md`](../../AGENTS.md), [`docs/agent/INDEX.md`](../agent/INDEX.md) | New agent conventions. `CLAUDE.md` is now only a pointer. Read `INDEX.md` before exploring — it is generated and CI-checked. |
| `docs/specs/` (32 EARS specs) | If a change alters spec'd behaviour, the spec updates in the same PR. |

---

## 3. Known bug: the Ear Lab's latency wizard over-reads by a constant

**Symptom (hardware, 2026-08-09):** the Ear Lab wizard reads **274 ms ± 1.2**
where `main`'s `MicLatencyWizard` reads **~150 ms** on the same machine and
audio path. The spread is tight, so this is a constant offset, not noise.

**Diagnosis.** Both wizards define the round trip identically — scheduled click
time to observed click time on one `AudioContext` clock, with no
`outputLatency` added (`REQ-ML-001`, `REQ-ML-003`). They differ only in how
they anchor the *capture* buffer to the clock:

```js
// main — src/features/mic-feedback/MicLatencyWizard.tsx
captureStartSec ??= audio.currentTime - input.length / audio.sampleRate

// Ear Lab — src/features/ear-lab/LatencyWizard.tsx (captureUntil)
const at = event.playbackTime > 0 ? event.playbackTime : ...
```

`AudioProcessingEvent.playbackTime` is *the time the audio will be played* —
an output-side reference scheduled ahead of `currentTime`. Using it as the
capture-side origin shifts every detected onset later by roughly one buffer
plus the output latency, and that shift lands whole on the reported round
trip. At 4096 samples / 48 kHz the buffer alone is 85 ms; add output latency
and ~124 ms is exactly the observed gap.

**Nothing currently recorded is corrupted.** The Grid is perception-only —
clicks are scheduled sample-accurately and the user never taps, so no drill
consumes the latency number yet. The wizard's only present job is to *unlock*
ms drills, and it does unlock at any plausible value.

**Fix (recommended, deferred by decision on 2026-08-09):** delete the Ear Lab's
wizard and consume `mic-latency-store` instead, so one number serves the whole
app. That removes `LatencyWizard.tsx`, `LatencyWizard.module.css`,
`src/lib/ear/latency.ts` and its tests, and replaces the dashboard's Timing
calibration card with a link to the existing wizard. `docs/ear-lab-testing.md`
§1 then folds into main's flow. Do this **before** any drill actually consumes
the number (Pulse, tap-response timing), which is Phase 5 territory.

---

## 4. Invariants — the things that are easy to break

1. **Progress is never percent-correct.** Ruler A is a threshold in physical
   units; Ruler B is Elo. A percentage on screen is a bug.
2. **Only Calibration marks the Mercury Column.** `completeCalibrationRun` in
   `src/stores/ear-lab-store.ts` is the sole writer of column marks. Practice
   renders a lighter meniscus and must not etch.
3. **Mic answers never update item difficulties.** `recordIdentificationAnswer`
   takes `updateItem`; sung answers pass `false` and rate under a separate
   `home-sing` track with no guess floor. Items stay tap-calibrated yardsticks
   — that separation *is* the ear-vs-voice diagnostic.
4. **Item difficulties freeze at 200 attempts** (`CALIBRATION_ATTEMPTS`). A
   yardstick that keeps moving measures nothing.
5. **Pacing lives in one file.** `src/lib/ear/timing.ts` holds every note
   length and gap. It is presentation only — changing it never changes what a
   drill measures, but a big change warrants a fresh calibration because longer
   gaps make a task genuinely easier.
6. **Stop cancels the run, not just its timer.** A scheduled oscillator is
   committed to the audio clock and cannot be un-scheduled by clearing a
   `setTimeout`. Every engine sets its cancel flag *before* finishing, exposes
   a cancel handle, and registers `onCleanup`. Guarded by
   `src/tests/ear-threshold-run.test.ts`.
7. **Ear Lab drills are not in the vocal `ExerciseType` union.** The Ear Lab
   owns its own catalogue (`src/lib/ear/drills.ts`) and page. Ear Lab CSS is
   separate from `exercises.css` so it never trips the mobile exercise audit.

---

## 5. Map

**Pure logic** — `src/lib/ear/` (headless, 148 tests, colocated):
`staircase` · `elo` · `calibration` · `drills` · `mercury-index` ·
`item-bank` · `banks` · `grid-pattern` · `latency` · `degree-detect` ·
`confusion-report` · `timing` · `test-rng`

**UI** — `src/features/ear-lab/`. Two shared engines; drills are thin specs:

- `use-threshold-run.ts` + `ThresholdDrillView.tsx` → Hairline, The Grid
- `use-identification-controller.ts` + `IdentificationDrillView.tsx` → Leap,
  Stack, Contour
- `use-home-controller.ts` + `HomeDrill.tsx` → bespoke (cadence + mic)

**Adding a drill** means a `drills.ts` entry, a bank, and a thin view on one of
the two engines. If you find yourself writing new machinery, check the engine
first.

**State** — `src/stores/ear-lab-store.ts` (persisted signals, local-first).
**Page** — `src/pages/EarLabPage.tsx`, a view switch over 9 views.

---

## 6. Outstanding

**Hardware (owner: Komediruzecki).** Phase 1 passed. Phases 2-3 partly passed
on 2026-08-09 — drills themselves reported fine; the latency reading is §3.
Still unrun: `docs/ear-lab-testing.md` §2 (Home sing mode end card and the
ear-vs-voice line), §2d (Ear Report), §3b (stop behaviour on every drill).

**Deferred by decision, not forgotten:**

- §3's wizard deduplication.
- The 0-1000 Mercury Index anchors are authored from the JND literature, not
  fitted to users. The index is correctly *ordered*; its absolute value is an
  estimate (plan §9.4).
- All thresholds are measured on synthetic tones; transfer to guitar and piano
  timbres is unverified (plan §9.5).
- Contour's confusion section shows counts, not rates — its answers are
  directions, not bank items, so there is no per-item denominator.
- No page tour yet. It lands with Phase 4. Note `AGENTS.md` now makes
  `pnpm test:tours` a **release gate, not a per-change gate** (20+ min) — even
  when editing tour steps, the per-PR check is only that the affected
  `targetSelector`s resolve.

---

## 7. Phase 4 — habit

Per plan §8. Retention layer on top of a working measurement engine.

**Built (2026-08-09):**

1. **Daily sprint** — `src/lib/ear/sprint.ts` (pure, 14 tests) plus
   `SprintCard.tsx` on the dashboard. Two need slots (unmeasured first, then
   weakest) and one rotation slot keyed to the day index. Every segment shows
   *why* it was picked.
2. **Streak integration** — no second streak. Each drill run already calls
   `creditEarSession`, which feeds the app-wide streak and practice minutes;
   `completeSprint` only records the day. The card shows a sprint-day count
   derived from that history.
3. **Page tour** — `PAGE_TOURS[TAB_EAR_LAB]`, 8 steps, plus an entry in
   `PAGE_TOUR_CATALOG`. Hooks are `data-tour="ear.*"` on the dashboard.

4. **The Ascent Week 4** — a new optional `earDrills?: string[]` on `PathWeek`,
   kept separate from `exercises` because that array is typed `ExerciseType[]`
   and invariant §4.7 keeps Ear Lab drills out of that union. Week 4 points at
   Hairline, Home and Leap; the week card renders them as their own chips and
   `startEarDrill()` (in `ui-store`, mirroring `startExercise`) opens the drill
   itself rather than dropping you on the dashboard. Guarded by
   `src/tests/path-ear-drills.test.ts`.

Phase 4 is therefore complete, pending the hardware pass
(`docs/ear-lab-testing.md` §2e-§2g). Phases 5 (real-song items from UVR stems)
and 6 (producer pack) stay out.

**Where Phase 5 would start:** `SPRINT_DRILL_IDS` in `src/lib/ear/sprint.ts` is
the list of drills that have a view — it is what both the sprint and the path
test treat as "playable", so a new drill joins the habit loop by landing there.
