# Exercise note tracking — how "Notes hit" was filled in

**Status: shipped.** This started as a plan and is kept as the record of what
was decided and why, because two of its original premises turned out to be
wrong and the reasons are worth not rediscovering.

The operator console's Practice sessions table ends in **Notes hit** and
**Total notes**. For a singer whose history was all drills, both columns read
`0` on every row. The console was innocent: three of the four `sessionRecords`
write paths hard-coded the pair.

## What the first draft got wrong

**"The columns are `NOT NULL`, so there is no way to say a run had no tally."**
There is: `notesTotal === 0`. A run with a real tally always has
`notesTotal > 0`, and a drill that presented no notes banks no result at all.
The app had been spelling it that way all along — see the `notesTotal > 0`
guards in `progress-view-model.ts` and `progress-share-model.ts`, which
already skip the notes line entirely rather than print `0 of 0`. **No
migration was needed, and no historical row was touched.**

**"Each drill already publishes its tally in `metrics`; add a resolver that
maps the key names."** They do not. Every controller publishes only
aggregates — `notesCompleted`, `avgAccuracy`, `bestNote`, `roundsCompleted` —
and **discards the per-note score arrays** that hold the evidence. So each
drill had to compute and publish its own tally before anything could read it.

## The threshold, and why it is cents

A note counts as hit at **25 cents or better** — `CENTS_EXCELLENT`, the line
`centsToRating` already draws between 'good' and 'okay'.

It is a **cents** line, not a score line, and that is not a detail.
`staccato-precision` and `call-response` divide their cents-to-score slope by
a difficulty factor, so one score means a different deviation per drill _and_
per difficulty. A score threshold would have made "hit" quietly easier on an
easy setting.

It is also **not read from the singer's accuracy tier** (Learning / Singer /
Professional). Owner decision, 2026-08-22: the tier is the singer's own ruler
and belongs on score and accuracy, which are theirs to calibrate. Exercises
exist to make people better, so their ruler stays fixed. The tally is a fact
about the take, and it feeds the Hundred/Thousand/Ten Thousand Notes badges —
a tier-relative count would award those faster for singing worse.

The same line applies to all four run kinds. `Practice` rows previously wrote
`results.length` — every note _reached_, whatever was sung — so a run
performed entirely flat posted a perfect count. That is now the same
landed-notes rule as everything else.

## What counts, and what does not

Ten of the eighteen drills run a discrete sequence of sung notes and now
publish a tally: `scale-runner`, `mirror-melody`, `arpeggio-jumper` (both its
call-and-answer and echo paths), `chord-stacker`, `interval-trainer`,
`call-response`, `staccato-precision`, `sight-singing`, `pitch-pursuit`,
`routine-runner`.

Each tallies on **its own** measure of a note, rather than a second definition
bolted on top: `call-response` judges a note by its best deviation across a
freely-sung phrase, `sight-singing` by the average of its best 30%,
`pitch-pursuit` by the deviation at the strike moment. Only the 25-cent line
is shared.

Eight report `0 / 0`, permanently and on purpose:

- **Seven have no notes** — `vibrato`, `slide`, `long-note`, `pitch-hold`,
  `drone-intonation`, `siren`, `dynamic-swell` are sustained pitches, glides
  and swells, scored on steadiness and cents.
- **`warmup` is scored per step**, not per note. There is no per-note evidence
  in it to count, and inventing one would be the same category error this
  work set out to fix.

`Challenge` and `Weekly` runs inherit whatever the underlying drill published —
they are wrappers around an exercise, not their own scoring model.

## The invariant that makes this dangerous

`notesHit <= notesTotal` is enforced by the worker's `validateWrite`, and
`saveSessionRecord` swallows the resulting 400 **by design**. A payload that
breaks it does not fail loudly — the whole run banks nothing: no record, no
practice minutes, no streak, no badges. That is the CLAUDE-JOURNEY-007 shape,
and it has cost a release twice.

So `noteTallyFromMetrics` validates defensively and degrades an unusable tally
to `0 / 0`. A drill that publishes nonsense costs its own tally, never the
singer's run. `exercise-note-tally.test.ts` holds that against the production
validator, as do the two payload-builder suites.

Two further traps the tally functions encode:

- A note that captured no voiced audio is a **miss, not an absence**. It stays
  in the denominator, or a singer who went quiet for half a run finishes at
  100%.
- `chord-stacker` clears its per-note scores on every new chord, so its
  deviations accumulate at run level. A per-round array would have reported
  only the last chord.

## Console

`companyReportViewer/app.js` renders a `notesTotal === 0` row as **Not
tracked** rather than `0`. That is the whole honesty fix: the number was never
wrong, it was unlabelled, and a literal `0` read as a singer who hit nothing.
