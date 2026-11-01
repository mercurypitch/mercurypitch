# Season 2 lesson packages: the reviewer's brief

You review one Season 2 lesson package of Find Your Pitch, MercuryPitch's music theory and singing
series: FACTS.md, LESSON.md (the web lesson's copy) and WEB-SPEC.md (the page's spec), in
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/<NN-slug>/`. You have not seen it before and you
did not write it. A writer drafted it from that folder's RESEARCH.md and ARTICLE-PLAN.md; after you,
the writer does a fix pass from your report, then the lead. In Season 1 nearly every finding came
from this review, not from the writer's own checks, so be thorough and concrete.

The writer's hand-back note is `.../scratchpad/s2pkg/<NN>-HANDBACK.md`. Read it last, after forming
your own view, and only to check its claims.

## Context to read

- The lesson's RESEARCH.md and ARTICLE-PLAN.md (the inputs), its card in
  `docs/plans/find-your-pitch/SEASON-2.md` § 3, and SEASON-2 § 1, § 4.3, § 5, § 6 and § 7 (decided
  on 1 November 2026: every recommendation taken).
- The house rules: `TEACHING-PLAYBOOK.md`, `MERC-BIBLE.md`, `CURIOSITY-MOMENTS.md` (§ 3, § 5),
  `HANDOFF.md` § 5 and § 6, `SEARCH.md` § 12, and the copy rules in the header of
  `src/features/lessons/kit/lesson-copy.ts`.
- The model packages: `lessons/12-chords-four-chord-song/` and `lessons/14-phrasing-whole-song/`,
  and Season 2's reviewed ones on the branch: `lessons/15-staff/`, `lessons/17-note-lengths/`,
  `lessons/19-threes-offbeats/` and `lessons/21-keys-circle/`. The writer's shared brief,
  `.../scratchpad/s2pkg/BRIEF-writer-common.md`, lists what their reviews caught: check each.
- The app at `c60f0fdcb` (the branch's base; `docs/agent/INDEX.md` is the module map) for every app
  claim the package makes.

## What to check, most common findings first

1. **The predict's answer leaks**: check the title, the meta and share descriptions, the promise, the
   sound gate's line, the hero, any toy or label shown before the reveal, the explorer card and the
   previous lesson's tease against the predict and its answer.
2. **Citations**: run `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/<NN-slug>`
   from `/dev/shm/s2plan`, then read a good sample of the cited lines yourself at `c60f0fdcb`: do
   they say what the package says they do? A drill's name is not its behaviour.
3. **Claims without a source**, or stronger than the source (a Weak study stated as fact, an
   abstract read as a full text).
4. **Musical correctness**: every note, octave number, clef position, interval, rhythm, count,
   tempo and duration in the copy and the toys. Work the arithmetic yourself.
5. **Sound first**: each idea is heard before it is written; every staff or rhythm example plays.
6. **Shared lines**: lines shared with Season 1 (comfort check, "Just listen today", the stop line,
   the rest card, the doctor lines) match their current text word for word.
7. **Voice safety**: the house rules (no diagnosis, no score for what the voice cannot be scored on,
   the stop and rest lines); every line the vocal coach must sign off is listed for the coach.
8. **Copy**: British English, plain short sentences, no marketing or superlatives, no emojis, no
   model names, paths or agent ids in lesson files; headings are Tavi's questions; Tavi's lines are
   sincere questions or guesses (MERC-BIBLE).
9. **Length**: `node scripts/lesson-words.mjs` agrees with the count the package states, and it is
   under the series' cap.
10. **The spec can be built**: what WEB-SPEC says the kit already does, it does at `c60f0fdcb`;
    what is new is listed as new; tests and edge cases cover what the page promises.
11. **Departures** from ARTICLE-PLAN.md are justified, and the three files agree with each other.

## Rules

- Read-only: do not edit the package or any file in the worktree. No git, pnpm, npm, builds or
  browsers; the two node scripts above are fine. Disk on / is short: download nothing you do not
  need, and put anything you do in `/dev/shm/s2dl/review-<NN>/`, deleted after.
- Write your report to `.../scratchpad/s2pkg/<NN>-REVIEW.md`: findings numbered and ranked
  (blocking, should fix, nit), each with the package file and line, what is wrong, the evidence
  (a quote, a cited line, the arithmetic) and a concrete fix. Note what you checked and found
  sound, briefly, so the lead knows the coverage.
- Your final message: under 250 words, with the counts by rank and the three most important
  findings.
