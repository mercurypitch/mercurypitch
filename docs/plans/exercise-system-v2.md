# Exercise System v2 — Decisions, Architecture and Build Plan

Status: **decided plan** (owner decisions taken 2026-08-25). This is the
execution companion to
[`exercise-grading-architecture.md`](exercise-grading-architecture.md) — the
spec named the rulers and posed seven open decisions; this document records
the answers and lays out the build. The structural work continues to follow
[`exercise-controller-refactor.md`](exercise-controller-refactor.md), whose
phases are folded into the sequencing below rather than duplicated.

Ordering constraint from the owner: **one more release ships first** on the
current architecture, then the refactor lands as a programme targeting 1.0.
Grading semantics, achievements, storage and docs must all be settled inside
that programme, because unlocked achievements are never revoked
(`badge-grant-engine.ts:443`) and user-facing scoring docs freeze whatever
vocabulary they describe.

---

## 1. Decisions (D1–D7, resolved)

| #      | Decision           | Owner call, sharpened by findings                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Hit line           | **25 cents, universal**, for every stored tally. Games keep their own feel lines (pitch-pursuit 50×factor, sight-singing 60) but the _stored_ fact is one ruler. The four coexisting grading vocabularies (§4) must be reconciled before any user docs quote a number.                                                                                                                                                                                                              |
| **D2** | Tally coverage     | **drone-intonation and dynamic-swell join the tally.** Both run discrete rounds against a known target and already compute per-round deviations; they will push `noteDeviations` like the ten that do today (§7 item 2). The five continuous drills (`long-note`, `pitch-hold`, `vibrato`, `slide`, `siren`) stay `0/0` = not measured.                                                                                                                                             |
| **D3** | `results` channel  | **Keep it and make it real** (§3). Verified truly dead today: one existence-only reader (`run-kinds.ts:149 hasNoteDetail` — designed as the switch point), zero field consumers anywhere, no validation, and it ships as parsed-empty-array baggage on every grant pass. The dead `PracticeResultRecord`/`NoteResultRecord` twins are **replaced**, not populated — the column is JSON and always `[]`, so the shape is ours to redefine without migration.                         |
| **D4** | Ruler D to cloud   | **Yes, for signed-in (incl. anonymous) users.** Per-note evidence AND the drill's bespoke metrics (`rateHz`, `steadyZonePct`, …) ride the results envelope (§3); per-drill aggregates come through grant-context v2 (§5) — so metric-bound badges become possible and a cache clear stops erasing the drill history of signed-in users (the spec's issue D-4). Signed-out users keep local-only history; per-drill mastery achievements may end up cloud-only and that is accepted. |
| **D5** | Practice unit      | **Practice aligns to musical notes** (§6). The data already exists at payload time (`PracticeResult.noteResult`, `types/index.ts:219`); the payload simply never opened it. New practice rows are marked `sourceVersion: 2` so the two rulers are distinguishable forever.                                                                                                                                                                                                          |
| **D6** | Drill mastery      | **Generic first, specific ready.** One "master a curated set of N drills" achievement now; the data model (per-drill lifetime counts keyed by `sourceRef`) is built so per-drill definitions are a seed edit later.                                                                                                                                                                                                                                                                 |
| **D7** | Wording vs measure | **Reword, don't remeasure — but only where the window is the point.** Grant-context v2 turns most lifetime-worded measures into true lifetime counts (§5), which fixes the wording honestly. The ones intentionally kept as recent form (`Consistent`, `Dependable`, `Immaculate`, `Solid Start`) get reworded to say so.                                                                                                                                                           |

---

## 2. What the research verified (inputs to everything below)

Findings from the 2026-08-25 code audit, each with a file anchor:

1. **`results` has exactly one reader and it never opens an element.**
   `run-kinds.ts:149` checks `Array.isArray && length > 0`; its comment
   designates it as the intended one-line switch. All nine
   `PracticeResultRecord` fields and all eight `NoteResultRecord` fields are
   unread anywhere. The worker validates nothing about the column — a create
   may carry up to `MAX_WRITE_BYTES = 256 KB` (`index.ts:141`) of arbitrary
   JSON in it today.
2. **Grant-context ships the dead column.** `grants.ts:67` does `SELECT *`,
   so 200 rows × a serialized-then-parsed `[]` go to the client on every
   pass. Any future non-empty content would ride along unprojected.
3. **Practice retains per-note verdicts until the cloud boundary.**
   `PracticeEngine.calculatePracticeResult` (`practice-engine.ts:610`) keeps
   `noteResult: NoteResult[]` per item-run; `practiceSessionPayload` discards
   it. The seeded `scale-major-c4-8b` holds **7** notes, not 8
   (`melody-store.ts:477`), so `warmup-2min` is 3 × 8 × 7 = **168 musical
   notes** banked today as 24 units.
4. **⚠ Open runtime question:** the only non-null writer of the
   `practiceResult` signal is guarded by `!wasInSession`
   (`usePlaybackController.ts:492`), so per-item banking during a multi-item
   session may never fire with real data. **Verify at runtime before
   building on banked `noteResult`** (task V1, §8).
5. **Per-drill identity is already persisted.** Plain drill runs write
   `sourceRef = '<exercise-type>'`, `sourceVersion`, and
   `comparabilityKey = 'voice:exercise:<type>:v<n>'`
   (`exercise-history-store.ts:75-85`), and `sourceRef` survives both
   grant-context paths. Trap: a drill launched from a challenge/weekly writes
   `sourceRef = challengeId` (`challenge-attempt.ts:229`) — v1 per-drill
   counts deliberately cover plain runs only.
6. **The 200-record window binds everything record-derived.** 17 achievements
   are worded lifetime, measured windowed; per-drill "100 runs of X" targets
   are practically unreachable — and regressable — inside 200 records shared by 18 drills (only a user who concentrates on a single drill could hold 100 of its runs in the window). The bulk-write
   cap is NOT the constraint (59 + 51 tiered definitions = 110 < 200).
7. **Precedent for server-computed inputs already exists.** Grant-context
   already returns `voiceprintCount`, `followingCount`, `sharesPosted` as
   server-side counts — adding aggregate sums keeps the "server measures,
   client rules" contract intact. No second rule implementation.
8. **Definition shipping is manual at release.** New achievement definitions
   reach prod only via `pnpm db:seed` with the admin key
   (`seed-remote-db.mjs`); `gen-prod-content-sql.mjs` without
   `--no-definitions` duplicates prod rows. This step joins the release
   checklist.
9. **Four grading vocabularies coexist** at four threshold sets: per-note
   Perfect/Great/Close/Missed 90/75/50 (`feedback.ts:20`), run grades
   S/A/B/C/D 95/85/70/50 (`feedback.ts:35`), menu Elite/Great/Good/Novice
   90/80/65/50 (`ExerciseMenu.tsx:234`), history chips good/ok/poor 80/50.
   "Great" means ≥75 per note but ≥80 on the menu. No legend exists anywhere.
10. **Difficulty silently changes the ruler.** Four drills divide their
    scoring slope by the adaptive level's factor; the Lv chip's only
    explanation is a hover tooltip, the level cannot be set manually
    (`setDifficulty` exists unused, `difficulty-store.ts:45`), and nothing
    tells the user their scores re-scaled after "Level up!".
11. **Storage is safe for what v2 adds.** Exercise history is ~12–30 KB at
    its 100-entry cap; the real consumers are UVR stem blobs (unbounded, no
    eviction) and the ONNX model cache — neither touched by this plan.
    Budget: the capped histories together stay well under ~150 KB of the
    ~5 MB localStorage quota. Unbounded keys scheduled for Phase 3:
    `pitchperfect_library` (silent-fail write — surface the failure),
    `pitchperfect_annotations` (add a cap), local-mode `sessionRecords`
    (add pruning).

### 2.1 Data residency (before and after v2)

The neutral map this programme changes. "Survives clear" = a browser
cache/site-data clear on that device.

| Data                       | Store today                     | Survives clear | Reaches cloud today       | After v2 (signed-in)          |
| -------------------------- | ------------------------------- | -------------- | ------------------------- | ----------------------------- |
| Run records (score, tally) | Dexie local-mode / D1 cloud     | no / yes       | yes (17-entity allowlist) | unchanged                     |
| Per-note evidence          | discarded at the cloud boundary | —              | no (`results` = `[]`)     | yes — results v2              |
| Drill metrics (Ruler D)    | localStorage, 100-entry cap     | no             | no                        | yes — envelope `metrics`      |
| Per-drill run counts       | derivable, nowhere stored       | —              | no                        | yes — `runsByDrill` aggregate |
| Practice per-note detail   | localStorage (50 sessions)      | no             | no                        | summarized into results v2    |
| Achievements/badges state  | D1 (cloud) / Dexie (local mode) | yes / no       | yes                       | unchanged                     |
| Audio (stems, uploads)     | Dexie blobs, unbounded          | no             | never (by design)         | unchanged                     |

Where the sync/backup product decision gets taken is recorded outside this
repo; this table is its input.

---

## 3. The results channel, v2

The column stays; the dead twin types go. New shape (versioned envelope, no
migration needed — the column is JSON and every existing row is `[]`):

```ts
/** sessionRecords.results, v2. Old rows: [] (v1, empty forever). */
interface RunNoteEvidence {
  v: 2
  /** The drill's published metrics (Ruler D), so they survive the device.
      Validated: ≤ 32 keys, finite numbers. Absent on practice rows. */
  metrics?: Record<string, number>
  /** One entry per note PRESENTED, same order the drill presented them. */
  notes: Array<{
    midi: number
    /** Mean |cents| for the note's window; null = nothing voiced. */
    cents: number | null
    /** cents !== null && cents <= 25 — precomputed so readers need no rule. */
    hit: boolean
  }>
}
```

- **Writers:** the shared runner (§7) emits it for every tally-capable drill;
  `practiceSessionPayload` builds it from `noteResult` (after V1 verifies the
  signal fires). Challenge/weekly attempts reuse the drill path.
- **Worker validation (new):** `validateWrite` gains a results rule — array
  or `{v:2, notes:[…]}`, ≤ **1024** notes (vocal-5min presents ~396 musical
  notes and the 15-repeat templates more — 256 would trip §6's own
  silent-total-loss shape), each entry shape-checked, and
  `notes.filter(hit).length === notesHit` when both present. Today's
  256 KB-of-anything hole closes. **The writer degrades, the worker
  rejects**: a run past the cap drops the per-note list and keeps the tally,
  so an oversized session can never cost the whole record.
- **Projection (new):** grant-context stops `SELECT *` for sessionRecords and
  names its columns — the engine reads 7 fields (`badge-grant-engine.ts`
  `computeStats`); results never ships on a grant pass. The CRUD list path
  keeps returning it for Progress detail views.
- **Readers (both change):** `run-kinds.ts:149` is `Array.isArray(...)` —
  false for the v2 object — so it is rewritten to recognise the envelope
  (`results?.v === 2 && results.notes.length > 0`, array check kept for
  legacy `[]` rows), and `SessionRecord.results` is retyped to the union.
  Then the Progress
  run detail gains a per-note breakdown view (the #7 UX gap: today the user
  gets one worst moment and 900 ms tier flashes that vanish).
- **Size:** ~30 bytes/note ≈ 0.5–5 KB per run. Trivial beside the 256 KB
  write cap; kept off the grant path by the projection.

Delete with it: `PracticeResultRecord` / `NoteResultRecord` in
`entities.ts` and the never-supplied `results?` parameter shape in
`saveSessionRecord` (replaced by the v2 type).

---

## 4. One grading vocabulary

Before any user-facing doc can exist, the four scales become one table,
defined in a single module (extending `feedback.ts`) that every surface
imports:

| Concept          | Canonical scale                                                                                                   | Consumers                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Per-note tier    | Perfect / Great / Close / Missed at 90/75/50                                                                      | live flashes, new per-note breakdown         |
| Run grade        | S/A/B/C/D at 95/85/70/50                                                                                          | result card, karaoke (already shared)        |
| History coloring | derived from run grade bands — the menu's fourth scale (90/80/65/50) and the chips' third (80/50) are **retired** | menu cards, history chips                    |
| Note hit         | 25 cents, fixed                                                                                                   | tally, Progress "N of M notes", achievements |

Plus the two changes that make difficulty honest:

- **Name the two difficulties apart.** Intrinsic Easy/Medium/Hard stays
  "difficulty"; the adaptive 1–10 becomes "Level" everywhere, with a
  tap-friendly explainer (the tooltip is dead on touch) and a manual setter —
  `setDifficulty` already exists unused.
- **Say when the ruler moves.** The four slope-divided drills
  (`call-response`, `slide`, `drone-intonation`, `staccato-precision`) show
  "scored at Lv N" on the result card, and the level-up toast says scoring
  tightened.

### User-facing docs (the owner's ask)

One source, three surfaces — the `what-counts-copy.ts` pattern, proven:

1. **A "How scoring works" module** (copy written once): the vocabulary
   table, the 25-cent line, what Level changes, what the tally means — and
   which drills have no note tally at all (the five continuous ones), shown
   as a dash, never as "0 of 0".
2. Rendered as a **Learn chapter** (the existing `exercises-overview`
   chapter has zero scoring content) and linked from every drill's `?` panel.
3. **Repo README section** (public, user-facing) summarizing the same
   contract; `docs/agent/` keeps the internal spec. The three Learn chapters
   that present the _adjustable practice bands_ as if app-wide
   (`walkthrough.ts:438` et al.) get a disambiguating line: practice bands
   are yours to tune; the exercise tally is fixed.
4. The exercises **page tour grows past the menu** — 4 steps today, none
   inside a run. New steps cover live score, Level chip, the response window
   and the result card (then `tour-check` walks it).

---

## 5. Grant-context v2 — lifetime measures without a second rule engine

The 200-row window stops being the measuring stick. The endpoint keeps its
philosophy (raw inputs in, decided outputs out) and grows **measurements**,
exactly like the counts it already returns:

```
GET /api/me/grant-context  (v2 additions)
  aggregates: {
    notesHitTotal, notesTotalTotal,          // SUM over ALL rows
    runsBySource: {practice, exercise, challenge, weekly},
    runsByDrill:  {"scale-runner": n, ...},  // source='exercise' GROUP BY sourceRef
    distinctMelodies,                        // COUNT(DISTINCT melodyName)
    scoreCounts: {ge70, ge80, ge95, ge100},  // lifetime rate measures
    maxStreak
  }
  sessionRecords: last 200 rows, named columns (no results)   // local-time measures + Progress merge
```

- All aggregates are timezone-free SQL over indexed columns
  (`idx_sessionRecords_user_ended`, migration `0013`). Constant payload at
  any history length.
- **Local-time measures stay windowed** (`distinctDays`, `earlyDays`,
  `lateDays`, `weekendDays` need the client's clock). Two get honest fixes:
  - New rows stamp a **`localDay`** column (client-computed `YYYY-MM-DD` at
    write). Once stamped, `COUNT(DISTINCT localDay)` makes `Hundred
Days`/`Fifty Days`/`Regular` true lifetime counts going forward; until
    enough history accumulates the engine takes
    `max(windowed, aggregate)` so nobody regresses.
  - `Early Bird` / `Night Owl` / `Weekend Voice` (targets of 5) are easily
    satisfied inside any active window — kept windowed, reworded per D7.
- **Pure-local mode** (no `API_BASE_URL`, DexieAdapter) computes the same
  aggregates over its full Dexie `sessionRecords` table — one rules module,
  honoring the "no second implementation" rule that shaped this endpoint.
  **Offline cloud-mode is different**: Dexie holds no sessionRecords copy
  there, the context comes back empty, and the grant pass is already a safe
  no-op — it stays one.
- The engine maps measures to aggregates where lifetime is meant, and to the
  window where recent form is meant (D7). `Ten Thousand Notes` becomes
  genuinely earnable for the first time; the note ladder can then extend
  (1k / 10k / 50k / 100k as discussed) as a seed edit.

---

## 6. Practice on musical notes (D5)

`practiceSessionPayload` v2, marked `sourceVersion: 2` on every new row:

- `notesTotal` = Σ over non-rest items of
  `buildSessionItemMelody(item).length × (item.repeat ?? 1)` — the schedule
  side, counting real melody items (the 7-note scale trap: count
  `items.length`, never `beats`).
- `notesHit` = banked `noteResult` entries with `isNoteHit(|avgCents|)` —
  the evidence side, same 25-cent line as everywhere.
- **Both fields switch in the same release** or the worker's
  `notesHit ≤ notesTotal` rule rejects the row and the client swallows the
  loss — the CLAUDE-JOURNEY-007 shape. A round-trip test against the
  production validator gates this.
- **Minutes credit decouples from the unit.** Credit today is
  `max(90s, notesTotal × 2.5s)` (`session-service.ts:117`); on musical notes
  warmup-2min would jump 90 s → ~420 s of streak credit as a silent side
  effect. Practice starts passing **measured `durationMs`** (it has real
  wall-clock), so credit reflects time actually practised and the formula's
  note branch becomes the fallback it was meant to be.
- Evidence for big templates fits the §3 cap (vocal-5min ≈ 396 notes vs
  1024), and past it the writer keeps the tally and drops the list — never
  the record.
- Old rows: not backfillable (`results` is `[]` on every existing row) and
  not relabelled. `sourceVersion` null vs 2 marks the ruler split; the
  console and Progress read them as-is. Achievement sums mix the two units
  inside the lifetime aggregate — accepted (the drift is ~7× on _practice_
  rows only, and thresholds are being retuned in the same programme).

---

## 7. Extensible controllers (the refactor, converged)

[`exercise-controller-refactor.md`](exercise-controller-refactor.md) stands:
Phase 0 safety net → sequence runner → round runner → scoring convergence,
mechanical, one controller per commit, zero assertion edits. This plan adds
its v2 duties, in its Phase 3+ where behavior may deliberately change
(each with a `SCORING_VERSION` bump where stored meaning shifts):

1. **The runner owns the tally and the evidence.** `noteDeviations` and the
   `RunNoteEvidence` envelope are emitted by the shared runner, not by ten
   hand-rolled arrays — a new drill cannot silently ship `0/0`.
2. **D2 lands in the round runner**: drone-intonation and dynamic-swell get
   tallies as round-runner adopters.
3. **One metric vocabulary**: `roundsCompleted`/`notesCompleted`/
   `phasesCompleted`/`notesAttempted`/`totalNotes` collapse to
   runner-emitted keys; drills keep only bespoke metrics (`rateHz`,
   `steadyZonePct`, …).
4. **Dead surface sweep**: the unreachable `onChangeTarget` props
   (`ExerciseShell.tsx:135` — no button renders them), raw type slugs in
   Recent Sessions, the below-50 empty grade, icon-only Stop.
5. Golden snapshots from Phase 0 **include `notesHit`/`notesTotal`** so the
   migration cannot bend Ruler B.

New drills after this: a controller = target list/round recipe + bespoke
metrics + help copy. Tally, evidence, feedback, comparability key and
difficulty wiring all come from the shell.

---

## 8. Per-drill mastery (D6)

- `computeStats` gains `byDrill` from `aggregates.runsByDrill` — lifetime in
  cloud and pure-local modes alike (§5); offline cloud-mode passes stay the
  empty-context no-op they already are.
- **Now:** one generic **"Drill Set Master"** — complete every drill in a
  curated set (the tally-capable twelve) at least N times. Seed edit +
  one measure entry.
- **Ready for later:** per-drill definitions (`Scale Runner Adept/Master`,
  …) become seed edits against `runsByDrill['scale-runner']`. Before
  shipping 17–51 more cards, the Challenges shelf needs collapse/grouping —
  the component renders every definition unconditionally and three shelves ×
  ~110 cards is a wall (`VocalChallenges.tsx:304` says so itself). Icons:
  reuse existing medallions first (new icon = SVG + 192 px webp +
  `badge-art` registry + pinned-count bump).
- Challenge-launched drill runs keep counting as challenge work, not drill
  mastery (v1 scope; `sourceRef` there is the challengeId).
- **Release checklist gains:** "new definitions → `pnpm db:seed` against
  prod with the admin key; never `gen-prod-content-sql` without
  `--no-definitions`."

---

## 9. Sequencing

| Phase                       | Contents                                                                                                                                                                                                                                                                                                                                                                                                        | Gate                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **R — release first**       | Next release = PR #631 (note tallies, **merged 2026-08-25**) + PR #632 (guitar polish, owner finalizing); cut on the owner's go. The v0.9.x line then carries this programme plus the queued theme PRs. No v2 work rides in the release itself.                                                                                                                                                                 | CI + owner test                                                   |
| **V — verify**              | V1: runtime-verify the `practiceResult` signal fires per item in real multi-item sessions (`usePlaybackController.ts:492` guard). V2: golden snapshots incl. tallies (refactor Phase 0). V3: reconcile the four grading scales into the §4 table (decision, then code constants).                                                                                                                               | findings written down                                             |
| **1 — mechanical refactor** | Sequence + round runners, one controller per commit, behavior frozen (refactor Phases 1–2).                                                                                                                                                                                                                                                                                                                     | every exercise test green, zero assertion edits                   |
| **2 — grading v2**          | §4 vocabulary module + Level transparency; §7 items 1–4 (runner-owned tally/evidence, D2 drills, metric vocabulary, dead-surface sweep) with `SCORING_VERSION` bumps where meaning shifts.                                                                                                                                                                                                                      | snapshots move only where a bump says so                          |
| **3 — data v2**             | §3 results channel (writers, validation, projection); §5 grant-context aggregates + `localDay`; §6 practice unit + `durationMs`. One migration (`localDay` — applied before or atomically with the client change, old rows read `localDay?: string \| null` per the nullability rule), one validator change, both sides of every unit switch in the same release; plus the three storage fixes from §2 item 11. | round-trip tests vs production validator; mixed-ruler window test |
| **4 — achievements v2**     | Lifetime/recent-form measure split; note ladder retune; Drill Set Master; D7 rewording; Challenges shelf grouping; release-checklist seed step.                                                                                                                                                                                                                                                                 | `achievement-set.test.ts` both directions; UI review              |
| **5 — docs**                | §4 user-facing scoring doc (Learn chapter + `?` panels + README), tour extension + `tour-check`, internal docs refresh (`docs/agent/`).                                                                                                                                                                                                                                                                         | docs quote only §4 canonical numbers                              |

Phases 2–4 are the 1.0 gate the owner named: exercises fair and well made,
database robust, everything documented. Phase 5 must trail 2–4 — docs written
earlier would freeze the very inconsistencies being removed.

## 10. Testing (the owner's "flawless" bar)

- **Golden run snapshots** per drill (Phase V), covering score, metrics,
  tally — the refactor's regression net.
- **Reset-mid-run and double-start tests** per controller (bug #22 class),
  owned by the shared runner once, inherited by all.
- **Validator round-trips**: every payload builder (exercise, practice v2,
  challenge, weekly) held against the production `validateWrite`, including
  the new results rule — the silent-total-loss shape stays pinned.
- **Aggregate parity test**: SQL aggregates vs the client fallback over the
  same fixture rows — the one-rules-module guarantee, executable.
- **Mixed-ruler test**: v1 + v2 practice rows in one window; sums, minutes
  and Progress rendering all defined.
- **Edge pins**: legacy `[]` rows rendered beside v2 envelopes in the
  per-note view; the exact 25.0-cent boundary and `cents: null` through
  `isNoteHit` and the validator; the `max(windowed, aggregate)` `localDay`
  transition; challenge-launched drill runs excluded from `runsByDrill`;
  quota-exhaustion behavior for the localStorage writers §2 item 11 fixes.
- **E2E**: one full drill run and one multi-item practice session banking
  real records (oscillator mic shim), asserting record, tally, evidence
  envelope, minutes and grant pass.
