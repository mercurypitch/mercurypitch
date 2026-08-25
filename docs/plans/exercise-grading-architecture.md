# Exercises, Grading and Achievements — Architecture Spec

Status: **specification** (no code plan here on purpose). This is the
contract document we agreed to write _before_ deciding how to organise data
or where to set limits. It is a 1.0 gate: the grading semantics have to be
settled before achievements are minted against them, because an unlocked
achievement is never revoked (`badge-grant-engine.ts:443`) and a threshold
retune cannot take back a grant made on the wrong ruler.

Companion documents:

- [`exercise-controller-refactor.md`](exercise-controller-refactor.md) — the
  structural refactor. Section 9 below states what this spec adds to it.
- [`exercise-note-tracking.md`](exercise-note-tracking.md) — the shipped
  note-tally work this spec generalises.

---

## 1. The four rulers

Almost every confusion in this area comes from four different measurements
sharing the word "accuracy". Naming them is the core of this spec.

| #     | Ruler                                                | Range   | Whose ruler               | Difficulty-relative?     | Reaches D1?         |
| ----- | ---------------------------------------------------- | ------- | ------------------------- | ------------------------ | ------------------- |
| **A** | Drill **score**                                      | 0–100   | The drill's own           | **Sometimes** (4 drills) | Yes                 |
| **B** | **Note tally** `notesHit / notesTotal`               | count   | Universal, fixed 25 cents | No, never                | Yes                 |
| **C** | **Accuracy tier** (Learning / Singer / Professional) | bands   | The singer's own          | n/a — it _is_ the choice | No                  |
| **D** | Per-drill **metrics** (`rateHz`, `steadyZonePct`, …) | bespoke | The drill's own           | Varies                   | **No — local only** |

**Ruler A (score)** is the drill's opinion of the take, tuned for feel. Its
meaning is stable per drill _type_ until that drill's scoring is redesigned,
which is exactly what `exerciseScoringVersion` in
`exercise-comparability.ts` versions. It is **not** comparable across drills.

**Ruler B (note tally)** is a fact about the take, not an opinion: of the
notes this drill presented, how many landed within 25 cents
(`NOTE_HIT_CENTS = CENTS_EXCELLENT`). It is the only per-note signal that
crosses the network, and the only one that means the same thing on every
drill and every difficulty setting.

**Ruler C (accuracy tier)** shapes what the singer _sees_ — score and
accuracy bands in Practice. Decision already taken: it never touches Ruler B,
because a tier-relative tally would award note achievements faster for
singing worse.

**Ruler D (metrics)** is where all the interesting per-drill detail lives —
and it never leaves the device. See §4.

### 1.1 The rule this spec proposes

> **Achievements bind to Ruler A (as a rate) and Ruler B (as a count). They
> never bind to Ruler C, and they cannot bind to Ruler D until Ruler D is
> persisted.**

Your call on `Consistent` ("Score 80% or better on 50 runs") confirms the
first half: a _rate on a scored ruler_ is a better achievement than a raw
count of runs that scored nothing. That distinction should be explicit
policy, not an accident of which measure was easiest.

---

## 2. Exercise inventory

18 exercises. `warmup` has no controller — it is a routine definition
(`WARMUP_BPM 60`, root MIDI 57), driven by `routine-runner`.

Legend — **Diff** column: `T` = difficulty scales timings only; `K` =
difficulty also divides the cents→score slope; `Z` = difficulty also moves a
hit/zone tolerance.

### 2.1 Sequence family — step through a fixed list of target notes

| Exercise           | Grades                             | Formula / thresholds                                                 | Diff | Tally   |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------- | ---- | ------- |
| `scale-runner`     | per-note pitch match               | `scoreNoteAccuracy` = `100 − cents×1.5`, 2000 ms window              | T    | **yes** |
| `arpeggio-jumper`  | per-note, plus echo mode           | same slope; 2000 ms window, echo slot 1300 ms                        | T    | **yes** |
| `interval-trainer` | per-note slots, 6 rounds × 2 notes | same slope; slot 2500 ms; **`valid.length < 3 → 0`**; scoring **v2** | T    | **yes** |
| `chord-stacker`    | arpeggiated chord tones            | same slope; window 2500 ms base                                      | T    | **yes** |

### 2.2 Round family — N independent rounds of play → listen → score

| Exercise             | Grades                        | Formula / thresholds                                   | Diff  | Tally   |
| -------------------- | ----------------------------- | ------------------------------------------------------ | ----- | ------- |
| `routine-runner`     | per-note across phases        | 2000 ms window, phase rest 500 ms                      | T     | **yes** |
| `staccato-precision` | 8 rounds, one short note each | `100 − cents × (1.5 / factor)`, window 1500 ms         | **K** | **yes** |
| `drone-intonation`   | 6 rounds held against a drone | `100 − cents × (1.5 / factor)`, window 4000 ms         | **K** | no      |
| `siren`              | 6 rounds, glide shape         | slope 1.5 (**not** divided), window 4000 ms, 3 s ready | T     | no      |
| `dynamic-swell`      | 6 rounds, 8 s crescendo hold  | deviation penalty 2.0; silence gate RMS 0.0015         | T     | no      |

### 2.3 Bespoke

| Exercise        | Grades                                        | Formula / thresholds                                                                      | Diff     | Tally   |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- | ------- |
| `call-response` | 5 base rounds, best deviation per phrase note | `100 − best × (1.5 / factor)`, window 3000 ms base                                        | **K**    | **yes** |
| `mirror-melody` | 5-note melody played back                     | accuracy .35 + bestNote .15 + consistency .25 + richness .25; window 2500 ms              | T        | **yes** |
| `sight-singing` | read and sing 6 notes                         | hold ≥ **450 ms within 60 cents** to pass; max 8000 ms/note                               | **none** | **yes** |
| `pitch-pursuit` | falling-note game, 12 notes                   | hitRate .5 + accuracy .3 + combo (max 25, ×3); **hit line 50 cents × factor**             | **Z**    | **yes** |
| `slide`         | portamento between two notes                  | smoothness .3 + arrival .3 + departure .2 + speed .2; `K 0.8 / factor`; optimal 300 ms    | **K**    | no      |
| `long-note`     | one sustained note, 30 s target               | stability .35 + drift .2 + steady .3 + duration .15; steady zone **15 cents**, 3 s window | T        | no      |
| `pitch-hold`    | survival, shrinking zone                      | zone .6 + duration .4; zone **50×factor → 10 cents**, −5 every 5 s, 60 s target           | **Z**    | no      |
| `vibrato`       | rate / depth / consistency                    | rate .4 + depth .3 + consistency .3; 4 s analysis window                                  | T        | no      |

### 2.4 What the table exposes

**Five different "hit" lines coexist.** The stored tally uses 25 cents.
`pitch-pursuit` calls it a hit at **50 cents × difficulty factor**;
`sight-singing` at **60 cents**; `long-note`'s steady zone is **15 cents**;
`pitch-hold` runs **50 → 10**. `pitch-pursuit` already documents the tension
in-code (`use-pitch-pursuit-controller.ts:38`): the game's hit line is right
for combo and feel, wrong for a stored tally. **Consequence to accept or
fix:** the game can say "hit" and the achievement can disagree.

**Four drills make score difficulty-relative.** `call-response`, `slide`,
`drone-intonation` and `staccato-precision` divide their cents slope by
`difficultyFactor` (`= 1 + (5 − level) × 0.08`, floor 0.1). At level 1 the
slope is ÷1.32, at level 10 ÷0.6. So **a score of 80 is a different cents
deviation on those four** depending on the singer's level — which is exactly
why the note tally had to be cents-based and not score-based. It is also why
any future _score-rate_ achievement (`Consistent` and friends) is measuring
something slightly different on those four drills than on the other thirteen.

**`sight-singing` has no difficulty scaling at all.** It is the only
exercise that ignores the level entirely.

**Seven drills report no tally** — `drone-intonation`, `dynamic-swell`,
`long-note`, `pitch-hold`, `siren`, `slide`, `vibrato` — and write `0 / 0`,
which every reader treats as "not measured". For `long-note`, `pitch-hold`,
`vibrato`, `slide` and `siren` that is correct: the unit is a sustained tone
or a glide, not a note. **`drone-intonation` (6 discrete rounds, each with a
target note) and `dynamic-swell` (6 held targets) are discrete enough to
tally and currently do not.** That gap is an open decision, §8.

---

## 3. Where a number is born and where it dies

```
   controller                exercise result            two sinks
   ──────────                ───────────────            ─────────

   per-note cents  ──┬──►  score  (Ruler A)   ──────►  sessionRecords.score   ──►  D1
                     │
                     ├──►  metrics (Ruler D)  ──────►  localStorage           ──►  ✗ never synced
                     │      rateHz, steadyZonePct,      'mercurypitch_exercise_history'
                     │      richnessScore, …            (capped at 100 entries)
                     │
                     └──►  noteDeviations[]   ──────►  notesHit / notesTotal  ──►  D1
                            (Ruler B, 25 cents)         two integers
```

Three facts follow, and they are the architectural heart of this document.

**3.1 The rich metrics never leave the device.** There is no `metrics`
column anywhere in D1 — confirmed against `workers/db-worker/src/tables.ts`.
`ExerciseHistoryEntry.metrics` is persisted by `createPersistedSignal` into
`localStorage` and **trimmed to the last 100 entries**
(`exercise-history-store.ts:93`). Everything a drill measured about a take —
vibrato rate, steady-zone percentage, arrival accuracy, per-chord-quality
averages, HNR trend — is device-local, lost on cache clear, invisible to the
operator console, and gone on a second device.

**3.2 The note tally is the only bridge.** `noteTallyFromMetrics` reads the
local metrics at write time and derives the two integers that cross the
network. That is the _entire_ per-note signal reaching the cloud.

**3.3 There is a per-note channel in the schema, and it is always empty.**
`sessionRecords.results` is a persisted JSON column
(`tables.ts:183 — jsonCols: ['results']`) typed as `PracticeResultRecord[]`,
whose `noteResult: NoteResultRecord[]` carries exactly what the tally
approximates:

```ts
interface NoteResultRecord {
  noteIndex: number
  noteName: string
  octave: number
  midi: number
  cents: number
  hit: boolean
  score: number
  avgCents: number
}
```

`results` is an optional parameter on `saveSessionRecord`
(`session-service.ts:51`), defaulted at line 109 to `[]`. **All four write
paths pass nothing** — `practice-session-store.ts:203`,
`exercise-history-store.ts:140`, `weekly-attempt.ts:164`,
`challenge-attempt.ts:218`. Measured on dev D1: 205 records across all four
sources, `results` length **2 bytes (`[]`) at both average and maximum**.

So the designed per-note evidence layer exists end-to-end and carries nothing.
It is either the right home for this data or it is dead weight to delete —
that is decision D3 in §8.

---

## 4. The storage contract

### 4.1 What reaches D1 per run

| Field                        | Ruler | Written by                | Notes                                               |
| ---------------------------- | ----- | ------------------------- | --------------------------------------------------- |
| `score`, `accuracy`          | A     | all 4 paths               | drill-relative; see §2.4                            |
| `notesHit`, `notesTotal`     | B     | all 4 paths               | `0/0` = not measured                                |
| `durationMs`                 | —     | all 4                     | measured, never backfilled                          |
| `sourceRef`, `sourceVersion` | —     | exercise/challenge/weekly | identity + scoring semantics                        |
| `comparabilityKey`           | —     | exercise/challenge/weekly | `voice:exercise:<type>:v<n>`                        |
| `source`                     | —     | all 4                     | `practice` \| `exercise` \| `challenge` \| `weekly` |
| `results`                    | —     | **nobody**                | always `[]` — see §3.3                              |
| `metrics`                    | D     | **no column exists**      | local only                                          |

### 4.2 The unit inconsistency

`notesTotal` does not mean the same thing across run kinds:

- **Exercise** — one unit per _musical note presented_. A drill is 8–16 units.
- **Practice** — one unit per _scheduled item-repeat_
  (`practice-session-store.ts:138`). `warmup-2min` is 5 items, three of them
  `repeat: 8`, so it banks **24 units** for what is really ~192 sung notes.

Per minute the two rates only differ ~2×, so this is a labelling problem
rather than an order-of-magnitude break — but "Sing 10,000 notes on target"
currently means two different things depending on where you sang them.

### 4.3 The three windows

There are three independent caps on history, none of which reference each
other:

| Window                 | Size            | Set in                                 | Governs                          |
| ---------------------- | --------------- | -------------------------------------- | -------------------------------- |
| Grant context          | **200 records** | `grants.ts:25`, `grant-context.ts:168` | every record-derived achievement |
| Local exercise history | **100 entries** | `exercise-history-store.ts:93`         | per-drill stats, score threads   |
| Progress dashboard     | paginated       | `progress-data.ts`                     | the history UI                   |

The 200 has no stated rationale — its comment reads only _"Matches
loadSessionRecords(200) in session-service.ts"_, and it arrived in a latency
commit (`ea4e5f81`). Measured row cost on dev: **270 bytes full, 74 bytes**
for the seven fields `computeStats` actually reads (`endedAt`, `startedAt`,
`source`, `melodyName`, `notesHit`, `score`, `streak`).

---

## 5. Achievement binding map

Of 59 achievements, **20 are bound to exercise or run grading**. The rest
read the challenge, activity, voiceprint, friends or badge tables and are
outside this spec.

| Bound to                              | Achievements (target)                                                         | Ruler       |
| ------------------------------------- | ----------------------------------------------------------------------------- | ----------- |
| `notesHit` (sum over window)          | Hundred Notes (100), Thousand Notes (1 000), Ten Thousand Notes (10 000)      | **B**       |
| `bySource.exercise` (count in window) | Drill Sergeant (1), Drill Habit (25), Drill Master (100)                      | run count   |
| `bySource.weekly`                     | Legend Attempt (1), Legend Regular (5), Legend Keeper (20)                    | run count   |
| `score ≥ 70`                          | Solid Start (1)                                                               | **A**, rate |
| `score ≥ 80`                          | Dependable (10), Consistent (50)                                              | **A**, rate |
| `score ≥ 95`                          | Immaculate (10)                                                               | **A**, rate |
| `score ≥ 100`                         | Perfect Run                                                                   | **A**       |
| `melodyName` distinct                 | Wide Repertoire (15), Deep Repertoire (50)                                    | identity    |
| `sourcesUsed.size`                    | Well Rounded (4)                                                              | identity    |
| `totalSessions`                       | First Note (1), Warmed Up (3), 10 Notes (10), 50 Sessions (50), Century (100) | run count   |

### 5.1 Nothing binds to Ruler D

**Not one achievement reads a per-exercise metric.** No badge exists for
vibrato rate, steady-zone percentage, slide cleanliness, chord-quality
accuracy or interval-size mastery — the drills measure all of it and throw it
away (§3.1). This is the single biggest gap between what the app _knows_
about a singer and what it can _reward_. It is also why the mastery band is
generic: it can only count runs, days and notes.

### 5.2 Nothing distinguishes drills

`Drill Master` counts any 100 drill runs. 100 runs of `pitch-hold` and 100
runs spread across all 17 are the same achievement. There is no
per-exercise mastery concept at all.

---

## 6. Defects and inconsistencies this spec exposes

Ordered by how much they should block 1.0.

**D-1 — Windowed measures, lifetime wording.** 17 achievements are worded as
lifetime claims and measured over the last 200 runs. Several become _harder
the more and the more variedly you practise_: `Hundred Days` ("Practise on
100 different days") needs 100 distinct days inside 200 runs, so it requires
averaging ≤2 runs/day; `Drill Master` needs drills to be ≥50% of everything
you do; `Deep Repertoire` needs 50 distinct melodies inside 200 runs, so
repeating your favourites works against it. Sticky unlocks mean these are not
strictly impossible — a heavy user can unlock them _by slowing down_, which
is a worse property than impossibility. `Well Rounded` (use all four
surfaces) and `Drill Master` (drills ≥50%) are in direct conflict.

**D-2 — `Ten Thousand Notes` is out of reach on the current window.** It
needs a window sum of 10 000, i.e. 50 landed notes in _every_ one of the last
200 runs. A drill lands 6–11.

**D-3 — The per-note evidence channel is dead.** §3.3.

**D-4 — Rich metrics are unsynced and uncapped in value.** §3.1. A singer who
clears their browser loses every per-drill metric the app ever measured.

**D-5 — Five hit lines.** §2.4. The game and the achievement can disagree
about the same note.

**D-6 — `notesTotal` has two units.** §4.2.

**D-7 — Five names for "how much did you do".** Controllers publish
`roundsCompleted`, `notesCompleted`, `phasesCompleted`, `notesAttempted` and
`totalNotes` for the same concept, and `richnessScore` appears in six
controllers with no shared home.

**D-8 — Score-rate achievements measure a slightly different thing on four
drills.** §2.4. `Consistent` is a fine achievement design (your call, and I
agree); it is just worth knowing that "80%" is difficulty-relative on
`call-response`, `slide`, `drone-intonation` and `staccato-precision`.

---

## 7. API surface

### 7.1 Today

```
GET  /api/me/grant-context      → all grant inputs, sessionRecords LIMIT 200
POST /api/userAchievements/bulk → decided rows, MAX_BULK_ROWS 200
```

Deliberate property, stated in `grants.ts`: **the server evaluates nothing.**
All 59 rules live client-side in `badge-grant-engine.ts`; the endpoints move
raw inputs in and decided outputs out. A second rule implementation on the
server is explicitly what this design avoids.

### 7.2 The constraint that shapes any change

Four measures are computed in **local time** — `distinctDays` via
`localDayKey`, plus `earlyDays` / `lateDays` / `weekendDays` via
`getHours()` / `getDay()`. SQL cannot reproduce these without the client's
UTC offset, and DST makes a stored offset unreliable. This is the same reason
`grants.ts` deliberately does _not_ return a streak.

So the design space splits cleanly:

- **Time-insensitive measures** (`notesHit` sum, per-source counts,
  score-threshold counts, distinct melodies, max streak) — aggregate freely
  in SQL; constant-size response at any history length.
- **Local-time measures** — need either the raw timestamps or a compact
  hour-precision distinct list, reduced on the client.

### 7.3 Shapes worth costing (not a recommendation yet)

| Shape                              | Fixes                           | Cost                                                                                                                                                 |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raise the window                   | D-1, D-2                        | one constant each side; 2 000 slim rows ≈ 148 KB, compresses well; moves the wall rather than removing it                                            |
| Slim projection for the grant path | payload                         | one extra query; must not slim the existing 200 full rows — `progress-data.ts:122` merges them into the dashboard                                    |
| SQL aggregates                     | D-1, D-2 permanently            | ~200-byte response at any history; needs the local-time carve-out in §7.2; the local/offline path must reduce over Dexie                             |
| Denormalised counters              | D-2 only                        | migration + backfill + drift risk; **cannot** express distinct-day or distinct-melody sets, so it leaves `Hundred Days` and `Deep Repertoire` broken |
| Populate `results`                 | D-3, D-4, D-5, and unlocks §5.1 | biggest payload change; makes tallies recomputable and per-drill achievements possible for the first time                                            |

---

## 8. Open decisions

> **Resolved 2026-08-25.** All seven were decided by the owner; the answers
> and the resulting build plan live in
> [`exercise-system-v2.md`](exercise-system-v2.md) §1. The questions stay
> below as the record of what was open and why.

These are product calls, listed so §9 and any later data-layer plan have
something firm to build on.

- **D1 — Hit-line policy.** Keep the universal 25 cents for the stored tally
  and accept that games may celebrate at their own line (status quo,
  documented), or align the game lines to 25?
- **D2 — Tally coverage.** Should `drone-intonation` and `dynamic-swell`
  report a tally? They have discrete targets. The other five sustained drills
  correctly report `0/0`.
- **D3 — `results`: fill it or delete it.** It cannot stay defined-and-empty
  through a 1.0.
- **D4 — Should Ruler D reach the cloud at all?** If yes, per-drill mastery
  achievements (§5.1) become possible and the console can show real drill
  detail. If no, delete the ambition and keep metrics as a local UI feature.
- **D5 — `notesTotal` unit.** Align Practice to musical notes, or rename the
  achievements away from "notes" to something both units satisfy.
- **D6 — Per-drill mastery.** Is `Drill Master` meant to reward _any_ 100
  drills, or mastery of a _particular_ drill? Today only the former is
  expressible.
- **D7 — Rewording vs remeasuring.** For each of the 17 in D-1: does the
  description move to match the window, or the measure move to match the
  description? Your steer so far: `Consistent`-style rate achievements are
  _better_ as recent form, so those should be reworded, not remeasured.

---

## 9. Convergence with the controller refactor

[`exercise-controller-refactor.md`](exercise-controller-refactor.md) is
accurate and still unstarted — verified: no `use-sequence-exercise.ts` or
`use-round-exercise.ts` exists, `scoreNoteAccuracy` still has no `k`
parameter (Phase 3), and 15 files still carry the inline
`12 * Math.log2(...)` conversion (R2).

Its hard constraint — _"no scoring formula, timing constant, metric key or
difficulty curve may change"_ — is exactly right, and this spec does **not**
relax it. What this spec adds:

1. **The refactor's families match the grading families.** §2.1 and §2.2
   reproduce its Sequence/Round split from the scoring side and confirm it.
   `drone-intonation` and `dynamic-swell` sit in the Round family but produce
   no tally (D2), so Phase 2 is the natural moment to settle that.

2. **Phase 3 should converge the hit line, not just the slope.** The plan
   already proposes a `k` parameter on `scoreNoteAccuracy`. The four
   difficulty-divided slopes (§2.4) are the callers that make Ruler A
   difficulty-relative, and they should be visible as such — one named
   concept, not four hand-rolled divisions.

3. **A metric-key vocabulary belongs in the shared runner (D-7).** Once
   Sequence and Round runners own the loop, `roundsCompleted` /
   `notesCompleted` / `phasesCompleted` / `notesAttempted` / `totalNotes`
   should collapse to one key emitted by the runner, with drills keeping only
   genuinely bespoke metrics. This is a metric-key change, so it is a
   deliberate exception to the "no metric key may change" constraint and must
   be sequenced _after_ the mechanical phases, with the `comparabilityKey`
   scoring version bumped for any drill whose stored meaning shifts.

4. **The runner is the natural place to emit `noteDeviations`.** Ten
   controllers now build that array by hand (shipped in
   `exercise-note-tracking.md`). A shared runner that already knows every
   note it presented can produce the tally once, which removes the main way
   a future drill silently reports `0/0`.

5. **Phase 0's golden snapshots should include the tally.** The plan
   snapshots `computeResult()` per exercise. Those snapshots should cover
   `notesHit` / `notesTotal` explicitly, so the refactor cannot quietly break
   Ruler B — a tally that violates `notesHit ≤ notesTotal` is a 400 the client
   swallows, costing the entire run.

**Suggested order.** Settle §8 D1–D3 → refactor Phases 0–2 (mechanical,
unchanged) → Phase 3 including the slope/hit-line convergence → the metric
vocabulary (D-7) with version bumps → only then the data-layer decisions in
§7.3, which depend on knowing whether Ruler D is going to the cloud (D4).
