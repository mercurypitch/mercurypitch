# Exercise note tracking — filling the empty "Notes hit" columns

The operator console's Practice sessions table ends in **Notes hit** and
**Total notes**. For a singer whose history is all drills, both columns read
`0` on every row. That is not a reporting bug — it is what the app writes.

## What is true today

Four paths write `sessionRecords`. Three of them hard-code the pair:

| Path                        | `source`    | Writes                            | File                                               |
| --------------------------- | ----------- | --------------------------------- | -------------------------------------------------- |
| Plain drill run             | `exercise`  | `notesHit: 0, notesTotal: 0`      | `src/stores/exercise-history-store.ts:66`          |
| Challenge run               | `challenge` | `notesHit: 0, notesTotal: 0`      | `src/features/challenges/challenge-attempt.ts:220` |
| Weekly challenge run        | `weekly`    | `notesHit: 0, notesTotal: 0`      | `src/features/challenges/weekly-attempt.ts:166`    |
| Multi-item practice session | `practice`  | `results.length` / scheduled runs | `src/stores/practice-session-store.ts:145`         |

So only `source: 'practice'` rows have ever carried a real tally. Everything
else has written a zero since the column existed.

## The constraint that shapes the whole fix

`0001_baseline.sql` declares both columns `INTEGER NOT NULL`. There is today
**no way to say "this run had no note tally"** — the schema forces a number,
and `0` is a lie that reads identically to "sang nothing right".

Every existing row already carries that lie. No backfill can undo it: the
per-note evidence was never captured, so a historical `0` stays ambiguous
forever. The plan below fixes forward only, and makes the ambiguity visible
rather than silently repairing it.

## Which exercises can honestly count notes

Of the 18 `ExerciseType` values, roughly 11 already run a discrete sequence and
can report a real hit/total pair. The rest are continuous — one sustained
pitch, a glide, or a swell — where "notes hit" has no meaning and inventing
one would be worse than leaving it empty.

**Countable (a sequence of discrete targets):**

| Exercise             | Unit today                  | Already emits                             |
| -------------------- | --------------------------- | ----------------------------------------- |
| `pitch-pursuit`      | targets crossed             | `hits`, `misses`, `totalNotes`            |
| `sight-singing`      | notes in the read sequence  | `totalNotes`, `notesAttempted`, `correct` |
| `routine-runner`     | scored segments             | `totalNotes`                              |
| `interval-trainer`   | rounds / interval prompts   | `correct`, `rounds`                       |
| `scale-runner`       | notes in the scale          | `noteIndex` over `sequence`               |
| `arpeggio-jumper`    | notes in the arpeggio       | `noteIndex` over `sequence`               |
| `mirror-melody`      | notes in the phrase         | `noteIndex` over `sequence`               |
| `call-response`      | notes per response × rounds | `rounds`, `steps`                         |
| `staccato-precision` | attacks per round           | `rounds`, `sequence`                      |
| `chord-stacker`      | notes stacked               | `noteIndex`                               |
| `warmup`             | pattern steps               | `steps`, `targets`                        |

**Not countable — leave empty, permanently:** `vibrato`, `slide`, `long-note`,
`pitch-hold`, `drone-intonation`, `siren`, `dynamic-swell`. These are held or
glided pitches scored on stability and cents, not on a note tally.

Challenge and weekly runs inherit whatever the underlying exercise reports —
they are wrappers, not their own scoring model.

## The fix, in order

### 1. Make "not tracked" expressible (migration + types)

Add `workers/db-worker/migrations/NNNN_session_notes_nullable.sql` making both
columns nullable. Do **not** rewrite existing rows.

Then, per the entity nullability rule, `SessionRecord.notesHit` and
`.notesTotal` become `?: number | null` in `src/db/entities.ts`. The drift test
enforces this; skipping it fails CI rather than silently mistyping the column.

`validateWrite` in `workers/db-worker/src/validation.ts` already tolerates the
pair being absent (its guard is `typeof nh === 'number' && typeof nt ===
'number'`), so the server rule needs no change — but add a case to the
validation test pinning that `null`/omitted is accepted, because the evidence
rule has silently 400'd drill saves twice before and that failure mode is
invisible on the client.

### 2. Stop writing the lie

Change the three hard-coded sites to omit the pair entirely rather than send
zeros. `exerciseSessionPayload` is the shared funnel for the plain path; the
challenge and weekly paths build their own payloads and each need the same
edit.

This alone is worth shipping. A blank cell is honest; a `0` is not.

### 3. Plumb the real counts where they exist

`recordExerciseResult` already receives `metrics: Record<string, number>`, and
every countable exercise above puts its tally in there — under a different key
each time. Rather than teach the funnel eleven key names, add one small
resolver beside `exercise-comparability.ts`:

```ts
// src/features/exercises/exercise-note-tally.ts
export function exerciseNoteTally(
  type: ExerciseType,
  metrics: Record<string, number>,
): { notesHit: number; notesTotal: number } | null
```

It returns `null` for the seven continuous exercises and for any run whose
metrics are missing or inconsistent. `exerciseSessionPayload` spreads the
result when it is non-null and omits both fields otherwise.

Two invariants the resolver must hold, both learned the hard way in
`practiceSessionPayload`:

- `notesHit <= notesTotal`, always. The worker rejects the row otherwise and
  `saveSessionRecord` swallows the 400 by design — the run then banks nothing:
  no record, no practice minutes, no streak, no badges.
- The denominator counts _repeats_, not distinct targets. A drill that runs a
  four-note pattern three times has `notesTotal: 12`.

Do the exercises in two batches: the three that already emit an explicit
total (`pitch-pursuit`, `sight-singing`, `routine-runner`) first, since they
need only a key mapping; then the eight that expose `noteIndex`/`sequence`/
`rounds`, each of which needs its controller to bank an explicit hit count on
finish rather than have the resolver infer one.

### 4. Make the console honest about the gap

Two changes in `companyReportViewer/app.js`, in the Practice sessions table
(`userTable(details.sessions, …)`):

- Render `null`/`undefined` as `—`, not `0`.
- For rows with a legacy `0`/`0` pair, render `— (not tracked)`. Any pre-cutover
  row is indistinguishable from a genuine zero, and the table should say so
  rather than imply a measurement that never happened.

`user-insights.mjs:1021` already selects both columns; nothing changes there.

## Verification

- `exercise-record-payload.test.ts` (and its per-path siblings) hold every
  payload against the worker's own `validateWrite` — extend those, do not
  write a new parallel harness. A payload the server rejects is a _silent_
  feature, not a failed one.
- Add one case per countable exercise asserting the tally survives a full run,
  and one asserting each continuous exercise omits the pair.
- After the migration lands on dev, spot-check one drill run per batch in the
  console and confirm the columns populate.

## Scope note

Steps 1, 2 and 4 are a coherent unit and can ship together: after them the
console tells the truth, just with fewer numbers in it. Step 3 is per-exercise
work that can land incrementally, one batch at a time, without any of it
blocking the others.
