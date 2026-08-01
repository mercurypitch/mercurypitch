# Docs audit — 2026-07-28

**Executed.** The reorganisation proposed below was carried out on
2026-07-28; see §8 for exactly what moved. Everything removed from this repo
lives in `<user-dotfiles>/mercurypitch/`, plus a private pre-change backup
zip (28 MB, 356 files).

Cross-check of every spec and plan against the code, using the module map in
[INDEX.md](INDEX.md). Method: extract each doc's code references and test them
against the filesystem, then verify each plan's deliverables against shipped
symbols.

Headline: **the plans understate what has shipped, not the reverse.** Nothing
described as done was found missing. Several things described as pending are
fully built.

---

## 1. The big one — Vocal Analysis phases

`docs/plans/va/README.md` says *"Planning — awaiting approval per phase."*
Across the five phase files, **44 checklist items are unchecked.**

All five phases are shipped.

| Phase | Deliverables | Evidence |
|---|---|---|
| 1 Spectrogram polish | colour maps, peak bins, window controls | `src/lib/colour-maps.ts` |
| 2 Annotation system | store, layer, controls, VA integration | `src/stores/annotation-store.ts`, `AnnotationLayer.tsx`, `AnnotationControls.tsx` |
| 3 Multi-pane views | pane system, layout persistence, renderers | `MultiPaneView.tsx`, `src/components/panes/`, `pane-layout-store.ts` |
| 4 Analysis tools | onset, key, DTW | `onset-detector.ts`, `key-detection/`, `dtw-aligner.ts`, `src/workers/onset-worker.ts`, `align-worker.ts` |
| 5 Advanced | chords, SSM segmentation, transforms | `chord-detector.ts`, `segmenter.ts` (SSM + novelty + checkerboard), `transform-registry.ts`, `TransformRunner.tsx` |

Only genuinely absent from Phase 5: dedicated `chord-worker.ts` /
`segment-worker.ts` (the work runs through the existing worker set), and a file
literally named `transform-interface.ts` — the registry covers it.

`VocalAnalysis.tsx` even carries `// ── Phase 4: Analysis Tools state` and
`// ── Phase 5: Advanced feature handlers` banners. The plans were never ticked.

**Action: mark all five phases complete, or archive the directory.** As-is it
tells any agent that the largest feature in the app is unbuilt.

## 2. Feature proposals — 12 of 15 shipped

`docs/plans/feature-proposals.md` (June 2026), verified individually:

| Shipped | Still open |
|---|---|
| 1 adaptive difficulty, 2 weakness drills, 3 trends, 4 formant viz, 6 accuracy heatmap, 7 jam chat, 8 routine share URL, 9 leaderboard filtering, 10 keyboard shortcuts, 11 voice-type onboarding, 14 rhythm exercise, 15 sight-singing | **5** mic *latency* calibration wizard, **12** practice timer / break reminders, **13** theme auto-switch |

Note on #5: `src/features/mic-feedback/auto-calibrate.ts` calibrates mic
*sensitivity*, not latency. The latency wizard is genuinely unbuilt.

**Action: reduce to the three open items, or fold them into the backlog and
archive the file.**

## 3. Plans whose stated status is stale

| Plan | Says | Reality |
|---|---|---|
| `key-detection.md` | "Status: proposal" | Shipped — `src/lib/key-detection/{key-detector,key-profiles}.ts` |
| `db-integration-next-plan.md` | 3 open items | All done — `.github/workflows/deploy-db.yml` exists, PR #91 merged |
| `db-migration-plan.md` | 3 open items | All done — `HybridAdapter` in `src/db/index.ts`, auth UI in `src/components/account/` |
| `voice-mirror-phase2.md` | "implemented on `feat/voice-mirror`" | Merged; branch reference is now misleading |
| `exercise-controller-refactor.md` | "proposed (not started)" | Accurate — `use-sequence-exercise.ts` absent, but `ExerciseShell.tsx` shipped and may have superseded it |

## 4. Plans that are accurate and still live

Leave these alone:

- `glass-handoff-2026-07-17.md` — 5 open items, all genuinely open (ad-spend
  decisions, FX tuning by ear, phase-2 greenlight)
- `voice-mirror-handoff-2026-07-09.md` — 10 open items, mostly awaiting user
  judgement on generated portraits
- `lyrics-word-sync.md`, `advanced-lyric-marker-mapping.md` — forward-looking,
  match the current lyrics code
- `premium.md`, `karaoke-night.md`, `karaoke-playlist-mode.md` — shipped
  features, but the docs read as design rationale rather than open work
- `mobile-native/` — three files carry explicit honest status lines
  (`IMPLEMENTED (2026-07-19)`, `planned`, `light fix shipped`). This is the
  format the other plan dirs should copy.

Two dead references: `src/features/practice/SingingPanel.tsx`
(`mobile-native/README.md`, `page-singing.md`) and
`scripts/verify-karaoke-robustness.mjs` (`karaoke-night-polish.md`).

## 5. Specs — now consistent

`docs/specs` was 13 files; `tests/ears` was 13 more in a different format that
called itself EARS but used tabular `| ID | "X shall Y" | Priority |` rows with
no EARS triggers and no links to code or tests.

Now: **27 specs, all `docs/specs/*.ears.md`** (25 from the merge, plus two loose EARS files relocated from `docs/`). `tests/` is removed — Playwright
reads `src/e2e`, so nothing broke.

Every spec points at its code and its tests, but under inconsistent labels: 14
use `Source:` / `Tests:` blocks, the other 11 use `Implementation:` or inline
prose. The information is present in all 25; only the heading varies. Worth
normalising on `Source:` / `Tests:` in a follow-up pass — it is what makes the
block greppable — but nothing is missing today.

Stale claims caught during conversion and corrected rather than carried over:

- Default BPM documented as **120**; actual default is **60**
  (`transport-store.ts`).
- "switch between dark and light themes" — there are **nine** presets.
- `PracticeTabHeader` referenced as the mode selector — that component no
  longer exists.
- A global volume setting with an 80% default was specified; there is no
  volume store at all (volume is set on `AudioEngine` directly). Recorded as
  explicitly unspecified rather than invented.
- `tests/ears/README.md` used emoji status markers, against the repo rule.

All 13 original `docs/specs` files were already clean — 0 missing code
references across 41 references checked.

## 6. Correction to the new agent docs — since superseded

The guardrail written on 2026-07-28 claiming schema changes are numbered
migrations in `workers/db-worker/migrations/` was wrong **at the time**: no
such directory existed, only six ad-hoc `scripts/migrate-*.sql` files plus
`workers/db-worker/schema.sql`.

**2026-08-01: the tracked chain is now real.** The 2026-07 integration train
(#374) introduced `workers/db-worker/migrations/0001…` applied via
`wrangler d1 migrations apply`; the legacy scripts survive only as the
pre-adoption record (`scripts/README-legacy-migrations.md`).
[QUESTIONNAIRE.md](QUESTIONNAIRE.md) Q8 is settled; the remaining doc
touch-ups are tracked in issue #380.

---

## Proposal

### Remove

| What | Why |
|---|---|
| `docs/archive/reports/` (25 files) | 16 are compliance reports against specs that have now been rewritten; they audit code from May-June 2026 |
| `docs/archive/plans/` (48 files) | Superseded by shipped code; git history preserves them |
| `docs/plans/va/` (6 files) | Entirely shipped — see §1. Archive or delete |
| `docs/plans/feature-proposals.md` | 12/15 shipped; keep only the 3 open items elsewhere |
| `docs/plans/db-migration-plan.md`, `db-integration-next-plan.md`, `users-auth-plan.md` | All items shipped |
| `docs/plans/key-detection.md` (30 KB) | Shipped; it is a design essay, not open work |
| `docs/plans/prototypes/glass-shatter-prototype.html` (45 KB) | Prototype superseded by `src/lib/glass/fracture.ts` |

That is ~85 files and roughly 700 KB of docs that currently read as live.

### Update

| What | Change |
|---|---|
| `docs/plans/voice-mirror-phase2.md` | Drop the "on `feat/voice-mirror`" branch reference — it merged |
| `docs/plans/mobile-native/README.md`, `page-singing.md` | `SingingPanel.tsx` no longer exists |
| `docs/plans/mobile-native/karaoke-night-polish.md` | `scripts/verify-karaoke-robustness.mjs` no longer exists |
| `docs/plans/exercise-controller-refactor.md` | Confirm whether `ExerciseShell.tsx` superseded it; if so, close |
| Every remaining plan | Add a `**Status:**` line in the `mobile-native/` style. It is the single cheapest fix — three of those files already do it and they were the only ones I could assess without reading the code |

### Organize

1. **Split `docs/plans/` by state** — `docs/plans/` for open work only,
   `docs/archive/plans/` for done. A plan with no status line and no open items
   is indistinguishable from a live one, which is how §1 happened.
2. **Require a status line.** `**Status:** proposed | in progress | shipped
   <date> | superseded by <x>` at the top of every plan. Add it to
   [CONVENTIONS.md](CONVENTIONS.md) once agreed.
3. **`docs/branding/` is 29 MB of the repo** — 72 PNGs, 44 SVGs, 11 Python
   scripts. Worth deciding whether generated brand assets belong in the app
   repo or in the dotfiles/asset store alongside the other private material.
4. **Fold `docs/reports/` and `docs/postmortems/`** (3 files) into
   [MISTAKES.md](MISTAKES.md) where they yield a rule, and delete the rest.
   `docs/postmortems/mic-state-desync.md` is already represented there.
5. **`docs/skills/github-workflow.md`** (11 KB) duplicates `.claude/skills/` —
   pick one home.

### Do not touch

`docs/specs/` (now consistent), `docs/plans/backlog.md`, `docs/agent/`, `docs/claude/{DEPLOY,RUNPOD,DEV_TOOLS}.md`,
`glass-handoff`, `voice-mirror-handoff`, `lyrics-word-sync`,
`advanced-lyric-marker-mapping`, `mobile-native/`.

---

## 8. What was executed — 2026-07-28

### Branding: 29 MB to 2.1 MB

A correction to §7's proposal: `docs/branding/scripts/` was described as the
live pipeline for shipped assets. On closer reading, all five "meniscus"
scripts read from `docs/branding/logo/explorations/` — they are exploration
tooling whose inputs were themselves exploration rounds. Keeping them while
moving their inputs would have left a broken pipeline, so the whole `scripts/`
tree moved with the material it consumes.

**Kept** (masters for what ships, plus reference):
`logo/meniscus2/`, `favicon/meniscus2/`, the three top-level logo SVGs,
`BRAND.md`, `MASCOT.md`, `TRADEMARK.md`.

`public/favicon.svg` and `public/og-image.png` are byte-identical to
`logo/meniscus2/` — that is why this set stays.

**Moved** to `<user-dotfiles>/mercurypitch/branding/`:
`mascot/` (22 MB look-dev), `logo/soundglobe/` and `favicon/soundglobe/` (the
rejected direction), `logo/explorations/`, `favicon/{v1,v2,v6}/`, `imagery/`,
`review/`, the four HTML boards, `CRITIQUE.md`, `HANDOFF.md`, and all 11
generation scripts with their fonts and templates.

Two source comments updated to point at the new location:
`src/components/Mascot.tsx`, `index.html`.

### Plans: 34 files to 18

Archived to `<user-dotfiles>/mercurypitch/archive-2026-07/plans/`:
`va/` (all five phases shipped), `key-detection.md`, `db-migration-plan.md`,
`db-integration-next-plan.md`, `users-auth-plan.md`, `karaoke-night.md`,
`karaoke-playlist-mode.md`, `premium.md`, `voice-mirror-phase2.md`,
`feature-proposals.md`, `mobile-native/karaoke-night-polish.md`,
`prototypes/`.

The three unshipped items from `feature-proposals.md` were extracted to
[../plans/backlog.md](../plans/backlog.md) rather than archived with it.

**Every remaining plan now carries a `**Status:**` line.** This was the
cheapest fix identified in §7 and is what would have prevented the `va/`
situation.

One correction to §3: `exercise-controller-refactor.md` is not untouched.
`ExerciseShell.tsx` is its Phase 4, shipped out of order; Phases 1-3 remain
open. Its status line says so.

### Archive and reports

`docs/archive/` (88 files), `docs/reports/` (2), `docs/postmortems/` (1) moved
to `<user-dotfiles>/mercurypitch/archive-2026-07/`. Moved rather than
deleted so they stay browsable without `git log`. The one rule worth keeping
from `postmortems/mic-state-desync.md` was already in
[MISTAKES.md](MISTAKES.md).

### Loose files

- `docs/ears-guitar-practice-spec.md` → `docs/specs/guitar-practice.ears.md`
- `docs/ears-og-tags.md` → `docs/specs/og-tags.ears.md`
- `docs/guitar-practice-features.md` → `docs/plans/` (+ status line)
- `docs/skills/github-workflow.md` → `.claude/skills/` (it is an agent SOP, and
  no such skill existed — it was not the duplicate §7 assumed)

### Result

`docs/` is now `agent/` (6), `branding/` (2.1 MB), `claude/` (4), `plans/`
(18, all with status), `specs/` (27, all `.ears.md`).

## 9. Post-conversion regression review

Requirement IDs dropped from 380 to 234 across the 11 rewritten specs. Most of
that is legitimate merging — the tabular originals frequently split one
behaviour across several rows (`SED-TIMELINE-01` and `-05` both said "ordered
by startBeat"; `MET-VIS-01..05` were one requirement about the beat indicator).

Checked by mapping every original ID to its replacement. One real loss found
and restored:

- **`session-editor`** had an entire *Timeline Navigation* section with no
  counterpart — wheel scrolling, piano-roll scroll sync, and drag scrolling.
  Restored as `REQ-SED-027..029`, plus the header chrome requirements as
  `REQ-SED-030..031`.

Section-level coverage on the other ten is complete. Two apparent gaps were
false positives: "Favorites" versus "Favourites", and "Mode-Independent
Behavior" renamed to "Shared settings".

One over-correction also fixed: `melody-library` requirements had been
generalised from `localStorage` to "storage" on the assumption that melodies
had moved to Dexie. They have not — `src/stores/melody-store.ts` still uses
`localStorage` under `STORAGE_KEY_LIBRARY`. The specific mechanism is back in
`REQ-MEL-007` and `REQ-MEL-019`.
