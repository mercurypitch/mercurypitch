# Lesson 20 hand-back: Runs and the pentatonic scale

Package: `docs/plans/find-your-pitch/lessons/20-runs-pentatonic/` in `/dev/shm/s2plan`, FACTS.md,
LESSON.md and WEB-SPEC.md (RESEARCH.md and ARTICLE-PLAN.md untouched), copied to `s2pkg/20/`.

Checks, run from `/dev/shm/s2plan` on 2 November 2026:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/20-runs-pentatonic`:
  246 citations read, 0 findings.
- `node scripts/lesson-words.mjs .../20-runs-pentatonic/LESSON.md`: 2,230 words, cap 2,379, 149
  under; steps' own text 119, 111, 120 and 97. WEB-SPEC Length itemises about 140 built-page words
  (near 2,370) and names the cut if the built page runs over: Step 4, its last sentence first.
- No git, no pnpm. Downloads in `/dev/shm/s2dl/20/` deleted.

## Entries for the shared files (the lead writes them)

**MASTER-PLAN § 11**, after Lesson 19's line:

> - Lesson 20: a written lesson, text only, in
>   [`lessons/20-runs-pentatonic/`](lessons/20-runs-pentatonic/) (research, article plan, facts,
>   copy and page spec). Its sung checkpoint, scored on the page, waits on the vocal coach's
>   sign-off (§ 12 item 8). No page is built yet: it waits on Season 2's kit (seasons and the staff
>   toy with both clefs, SEASON-2 § 6.2 items 1 and 2, with Lesson 4's staircase moved into the kit
>   and given three new states, Lesson 9's scored take and flow moved into the kit, the ladder
>   reader's attack and steady options, and the band chart's bead style) and on the lesson plumbing
>   for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the console publishes it, after
>   the coach's sign-off and once `/learn/05`, `/learn/09` and `/learn/10`, the pages its chips and
>   its recall link to, are live.

**CURIOSITY-MOMENTS § 2**, a new entry between Lessons 19 and 21:

> ### Lesson 20 · Runs and the pentatonic scale · voice; written; no page yet · hook kept
>
> - **Opening:** the pitch line between Merc and Tavi with the run's nine beads on a string, each
>   in its band; Play the run fast (0.2 s a note, five every second) and Play it slowly (0.6 s) both
>   work before the choice. Tavi "To sing it fast, you just practise it fast, don't you?" Merc
>   "Let's see what one study found." A research predict, as Lesson 3's: "Seventeen piano students
>   practised a hard passage until they felt ready, then played it the next day. Which went with
>   playing it better?" [How long they practised] [What share of their tries came out right]; the
>   reveal comes with the choice (Duke, Simmons and Cash 2009: one small study, a link, not proof).
>   The welcome tour waits for the choice, since Step 3 restates the answer (Lesson 20 FACTS 1a, 14,
>   15).
> - **Visual:** Lesson 4's staircase (moving into the kit) losing fa and ti, a number on each riser,
>   then the same five from la; the run toy, Merc's run as beads on a string on the kit's band
>   chart, Tempo's five notches drawing the beads closer, each still in its band, Staccato · Legato
>   and See it on the staff (new). **Payoff:** Step 3's plan, a tempo where every note lands, nudged
>   up, said as an inference; Sing it's scored run, read note by note, then the unscored faster
>   pass.
> - **Tease:** a still of Lesson 21's opening, Lesson 2's ring over Lesson 1's keyboard with D major
>   lit and F♯ and C♯ glowing, silent: "D major: seven notes, two black keys, F♯ and C♯. Now step up
>   a fifth."; the alternative `lesson-4`. Lesson 20's own tease, on Lesson 19's card, is "Merc
>   sings a run of nine notes, five every second.", with the plan's line as the alternative `plan`
>   (Lesson 20 FACTS 5, 5b; settled at the lead's reviews on 1 November 2026).
> - **Facts:** sourced in Lesson 20's FACTS: the pentatonic's degrees, steps and rotations (Open
>   Music Theory 2e, 8.9 and 7.13), the study of 304 recordings (Savage et al. 2015), the pianists'
>   practice (Duke, Simmons and Cash 2009, abstract only), agility and staccato (Arneson's guide for
>   beginning singing teachers); the app at `c60f0fdcb`.

**`kit/season.ts`** (Season 2's own module), in Lesson 9's entry form:

```ts
{
  n: 20,
  lane: 'voice',
  title: 'Runs and the pentatonic scale',
  short: 'Runs',
  topics: ['S18', 'T16'],
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 15,
  page: '/learn/20',
  hook: 'How do singers sing a fast run without the notes smudging together?',
  pr: {
    needs: "Scale Runner's Pentatonic by launch, and a drill that sings a run continuously",
    link: {
      href: '/pitch-training?lesson=20',
      addr: 'mercurypitch.com/pitch-training',
      label: 'Exercises',
      note: 'then tap Scale Runner',
    },
  },
},
```

`EDGES` gains `[5, 20]`, `[9, 20]` and `[10, 20]` (SEASON-2 § 4.3). No `fig`. Draft line:
`20: "Lessons 5, 9 and 10's pages, and the vocal coach's look at the sung checkpoint"`.

**`kit/lesson-copy.ts`**, set on Lesson 20 (the tease on Lesson 19's card):

```ts
20: {
  tease: 'Merc sings a run of nine notes, five every second.',
  teaseAlts: [
    { id: 'plan', text: 'Squeeze three notes into a beat, then four, then more.' },
  ],
},
```

50 and 54 characters. **`kit/team-notes.ts`**: a `TEASE_NOTES` line for `plan` ("The plan's line:
it sets up subdivision rather than Lesson 20's opening; kept as the alternative.") and the
signature: "Lesson 4's staircase loses fa and ti, and both semitone risers go with them; what is left
climbs 2, 2, 3, 2 and 3; then the run is beads on a string, drawn closer as the tempo rises, each
bead still in its band." Lesson 21's tease and its `lesson-4` alternative are Lesson 21's package's
to set (Lesson 21 WEB-SPEC, Explorer and season data); this page's card draws them.

## Kit and app work the page waits for

1. The lesson host: `learn/20.html`, `STANDALONE_DOCUMENT_PATHS`, first-paint budgets, the draft
   line; head, structured data and llms.txt (WEB-SPEC, Sections 2 and item 11).
2. Seasons in the kit and the staff toy with both clefs (SEASON-2 § 6.2 items 1 and 2), with the
   staff asked for stemless noteheads, a sharp before a note and a staccato dot.
3. Lesson 4's staircase in the kit (Lesson 21's kit work) with three new states: Leave out fa and
   ti, a number on each riser in place of T and S, and Major · Minor with the house moving to la.
4. Lesson 9's scored take and flow (`lesson-09/sing-take.ts`, `lesson-09/ladder-flow.ts`) moved into
   the kit, with slot length, reader options, rung labels, the offers after Easy or Workable and
   Move do's reach as options; this page adds Again, faster, an unscored guide with the count-in.
5. `readLadder`'s two options, `attackSec` and `steadySec`, defaulting to today's 0.3 s and 0.6 s:
   a 0.75 s slot cannot hold the kit's 0.9 s, so every note of this run would read "not steady".
   The page proposes 0.15 s and 0.45 s; the lab tunes them on real runs.
6. The band chart's bead style (a bead on each rung and a string between) and tempo-following slots
   in `kit/band-chart-rungs.ts`; the run toy itself in `lesson-20/run-toy.ts`.
7. Season 2 in the app's lesson plumbing (SEASON-2 § 5.2 item 21), above all the lesson marker, so
   `?lesson=20` steps First Light aside.
8. Later: Scale Runner's scale-type launch field and minor pentatonic (§ 5.2 item 13), then a
   beginner slug. **SEASON-2 § 5.3 should add** "a drill that sings a run continuously and reads it
   note by note": no drill in the app or the plan does.

## Departures from ARTICLE-PLAN.md, and why (all in FACTS 4 and LESSON.md's preamble)

- **Lesson 5 gets its chip**: Lesson 9 needs 3 and 6, not 5, so 5 is a direct prerequisite
  (SEASON-2 § 4.3 lists 5, 9 and 10).
- **Sound gate**: Lesson 9's voice-lesson line with "runs", naming the voice and the microphone.
- **Predict wording**: "Which went with playing it better?" (the study reports correlations), and
  the second choice "What share of their tries came out right": the abstract reports the
  percentage correct, not the number correct. Merc's line shortened to "Let's see what one study
  found." The research predict stays, as the lead decided, with the tour held.
- **Merc's fast run is drawn as sung**, each bead in its band, not blurred: the synthesised run
  lands every note, and a drawing must match its sound.
- **Recall**: Lesson 9's question 2 in place of Lesson 4's question 1, since a recall of a
  non-prerequisite needs an admin `RECALLS` line; the plan allowed it.
- **Run (word)**: "quick notes one after another, like Merc's nine" without "sung on one breath".
- **Step 1**: Lesson 4's own Slide and a semitone number on each riser (a riser of 3 is neither T
  nor S); "Leave out fa and ti" for "Remove fa and ti".
- **Step 3**: the Try is for listening (the plan's asked learners to judge their own singing in a
  step that asks for no voice); Lesson 9's slow-singing study sits beside the pianists', and the
  plan that joins them is called an inference ("though no study here tested it on singers").
- **Step 4**: says what Arneson says (staccato is legato without sustaining between notes;
  staccato exercises develop onset); the plan's "one way teachers make the notes distinct" has no
  source. Listen-only and short, as the lead decided.
- **Move do higher only**: reach `{ lower: 0, higher: 3 }` (lower voice) and `{ lower: 0, higher:
  4 }` (higher); any lower move leaves the tenor or soprano 1 semitone or less above the floor; the
  plan's ±4 breaks four presets.
- **Band 35 cents** (Lessons 3 and 9), not the plan's ±60 (Lesson 16's), so "in the band" keeps one
  meaning.
- **Sing it's lines**: the kit's count and tricky line replace the plan's "Nine beads, each in its
  band. Next time, one notch faster.", which would claim every bead landed; the faster pass
  listens to nothing, is offered once after Easy or Workable, and its Easy or Workable line is "That's
  the next notch up."
- **Practice card**: says what both drills really do at every level they reach (Scale Runner's
  window 2 s or more; Staccato Precision eight notes at its start, fewer if it eases).
- **Quick check**: the plan's questions and answers, reworded where a line used "so" as a
  conjunction, repeated the right answer under a wrong one, or said "predict".
- **Go deeper**: two items, "Not everywhere" (Savage, read for this package, with the plan's
  "interval shape" item folded in) and "Blues" as MercuryPitch's; the stack of fifths left for
  Lesson 21; the wind players' study cut for length.
- **Wrap's third line**: "keep your tries right: a tempo where every note lands, then nudge it up".
- **Next-lesson tease**: Lesson 21's settled line, not the plan's.

## Citations of uncommitted lessons

- **Lesson 18** (not written): LESSON.md Step 4 names it in words, "(Lesson 18)". FACTS 30 cites
  its ARTICLE-PLAN.md by path and line, as the brief asked: its Words (`:58`), its Step 4
  (`:101-108`) and its coach line (`:175`); WEB-SPEC's kit item 3 names "Lesson 18's staff marks"
  in words. Rebind to Lesson 18's FACTS and LESSON.md when its package is written.
- **Lesson 16** (being drafted): FACTS 54 cites its ARTICLE-PLAN.md (`:204`, the ±60-cent pass rule)
  by path and line, only to say this page does not use it. Rebind if the lead prefers its FACTS.

## Notes for other packages

- **Lesson 19 FACTS 5** quotes this page's predict as the plan wrote it ("what best predicted",
  "How many of their tries came out right"). The page now asks "Which went with playing it
  better?" with "What share of their tries came out right". Its tease is unaffected.
- **Lesson 18's plan** says "Lesson 20 sings staccato." This page plays staccato and asks no one to
  sing it; Lesson 18's writer should not promise more.
- **Lesson 21's WEB-SPEC** proposes the description "... A 15-minute lesson on keys and the circle
  of fifths."; the head test wants the minutes as a word, "A fifteen-minute lesson"
  (`src/tests/lesson-pages.test.ts:201-209`). Found in passing; not mine to change.

## App notes, for the app's own list (not linked or repeated on the page)

- Staccato Precision's help says it "scores the precision and timing of your short notes"
  (`src/features/exercises/exercise-help.ts:206`); the controller scores pitch and attack pitch, not
  timing.
- Scale Runner's grade is at most 80 since richness left it without a reweighting
  (`use-scale-runner-controller.ts:198-204`), while a level rises only at an average of 90
  (`adaptive-difficulty.ts:12-13`): Scale Runner can ease but never level up.
- Scale Runner's menu line, "Move smoothly up and down scales." (`ExerciseMenu.tsx:151`), and its
  help, "ascending and/or descending" (`exercise-help.ts:144`), describe a run; it echoes one note
  at a time, one direction a run.

## Questions for the owner

None open. The coach's items, all listed in LESSON.md's "For the vocal coach": do on D (with do on
E as the alternative that gives Move do room both ways), Move do higher only, whether a smaller run
is wanted, the faster pass at 0.45 s, and Step 4 (the first cut if the built page runs over). The
head title has an alternative in WEB-SPEC's Decisions.
