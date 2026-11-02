# Lesson 20 hand-back: Runs and the pentatonic scale

Package: `docs/plans/find-your-pitch/lessons/20-runs-pentatonic/` in `/dev/shm/s2plan`, FACTS.md,
LESSON.md and WEB-SPEC.md (RESEARCH.md and ARTICLE-PLAN.md untouched), copied to `s2pkg/20/` after
the fix pass. The fix pass answers `s2pkg/20-REVIEW.md` with the lead's calls of 2 November 2026.

Checks, run from `/dev/shm/s2plan` on 2 November 2026, after the fix pass:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/20-runs-pentatonic`:
  270 citations read, 0 findings.
- `node scripts/lesson-words.mjs .../20-runs-pentatonic/LESSON.md`: 2,221 words, cap 2,379, 158
  under; steps' own text 119, 111, 120 and 82. WEB-SPEC Length itemises about 151 built-page words
  (near 2,372, 7 under the cap) and names the cuts taken and the next ones in order.
- No pnpm and no downloads in the fix pass. One slip to report: a read-only `git rev-parse` ran
  on the main checkout (`/home/user/mercurypitch`) while I was looking for `learn/04.html`;
  nothing was changed. No other git command ran.
- The writer's arithmetic, `s2pkg/20-tools/verify20.py` (run with `python3 -I`), gained the smaller
  run at every Move do position (section 12), quick check 4 (13), Play it smudged's landings (14)
  and the smaller run's chart window (11).

## The fix pass: what changed

- **B1, voice safety (taken).** Your turn offers a choice of run, "[ The run: up to la ] [ Smaller:
  up to so ]", the smaller run do re mi so mi re do (seven 0.75 s slots, 5.25 s, topping at A3 or
  A4), as Lesson 9 offers its smaller ladder, and adds "If the top feels high, sing the smaller
  run." After the full run, Easy or Workable offers "Again, smaller" beside Again, sharing the one
  Again; once a smaller run is sung the full run goes, as in Lesson 9. FACTS 50, 51, 57, 58 (the
  smaller run's rung labels), 61 and 63; WEB-SPEC Toys 6, the flow rule, the Audio table, Edge
  cases and Tests 2, 4, 5 and 9; the coach's list has the top line, the run choice, the smaller
  run's tops and the dose. Move do keeps one reach for both runs (at Move do's top the smaller run's
  so sits 4 under the bass's and the alto's tops, the nearest).
- **S1 (taken).** The faster pass's Easy or Workable line is "That's the run, faster." (FACTS 63,
  the coach's list).
- **S2 (taken, in the soft tone).** Step 3's run toy has **Play it smudged**: an illustrated
  singer's run at 0.2 s a note, 1.80 s, drawn live as a violet line over Merc's beads, labelled "An
  illustration"; each note glides 0.12 s of its 0.2 s and lands short (re 20 cents flat, mi 50, so
  45, la 60; so 45 and mi 50 sharp coming down, re 25, do 15), five of nine outside their bands.
  The Try plays 0.6, then 0.3, then Play it smudged; the Notice reads "faster, the beads crowd
  closer, each in its band; smudged, notes slip out of their bands, the cue to drop back a notch."
  New FACTS 82a, under "Illustrations without claims", says it is an illustration, not a
  measurement of any singer; FACTS 38 and 92 point to it.
- **S3 (taken, the lead's preference).** Every stair prints its syllable over its letter, through
  `signsHtml`, with no names switch; on the Slide's black-key starts the stairs print the kit's own
  spellings (D♭, E♭, A♭, B♭ major with flats). WEB-SPEC Toys 1 and kit item 4; the Contract's
  printed signs now list the stairs' letters and the tease's F♯ and C♯, and no longer Sing it (N9).
  FACTS 10, 26 and 27.
- **S4 (taken, with "leap").** The Run word reads "quick notes one after another, by step or by
  leap, like Merc's nine." (FACTS 28). The note for Lesson 18's writer is below.
- **S5 (taken).** The mix-up card's better idea is the Wrap's own: "a tempo where every note lands,
  then nudge it up." Step 3's four practice lines (the plan, the Notice, the mix-up card's idea, the
  Wrap) and Arneson's line are all on the coach's list (FACTS 19, 20, 78).
- **S6 (taken).** Tavi: "To sing it fast, you just practise it a lot, don't you?"; the mix-up card
  keeps "Speed comes from practising it fast." (FACTS 13, 1a).
- **S7 (taken).** WEB-SPEC Tests 18 exempts "Play it slowly" and the Run word's "the run, slowly" by
  name and keeps "share", "correct", "accurate" and "how long"; FACTS 1a quotes both labels and says
  why they are tempos to hear, not advice.
- **S8 (taken).** The draft line is `20: "Lessons 5, 9 and 10's pages, and the vocal coach's
  sign-off (MASTER-PLAN § 12 item 8)"` (WEB-SPEC kit item 1, and below).
- **Nits taken:** N1 (quick check 1 reads "Its home, do, and its fifth, so, both stay."; FACTS 74
  says "in the page's own lines"); N2 (the listen path's "Choose a voice: it picks who sings.");
  N3 ("Merc sings it first, or Tavi an octave higher", no "in D"); N4 ("with no count"); N5
  (Staccato Precision "at its starting level, shorter if its level rises", and "shuffled" on the
  card); N6 (FACTS 8); N7 (FACTS 79 adds D5, E5 and "every other note ... is `hz(m)`"); N8 (FACTS
  4 lists every departure, the Contract the same, LESSON.md's preamble the main ones and says so);
  N9; N10 (FACTS 6); N11 (FACTS 1a adds the plans of Lessons 16 and 18); N12 (Decisions: "None
  open"); N13 ("Lesson, Sing and Explorer"); N15 (quick check 4 plays E minor pentatonic, E4 G4 A4
  B4 D5 E5, soft tone, 3.15 s); N16 (kit item 6: `readTake` takes the options too, and
  `readLadder` passes them on); N17 (the coach's list says three sung runs a visit against Lesson
  9's two: 6.75 + 6.75 + 4.05 s at most); N18 (Lesson 4's readout and white-key note hidden on this
  page).
- **For length:** Step 4's line on the staccato dot, the first cut the package named, is cut, with
  the staff's dots; the reveal loses ": this lesson's story"; the take's status is "Start on do when
  you're ready." (Your turn already says "Move on as each bead lights"). The head description is
  unchanged, 148 characters, with "A fifteen-minute lesson".

## Not taken, or taken differently, and why

- **N14 (show only "higher") not taken.** "lower" is the way back after any press of "higher", so
  it is a real control, not one never offered; at D it rests `aria-disabled`, as the kit marks every
  end so the keyboard's place stays on it (`kit/move-do.ts:8-12`), and Lesson 9's flow keeps Move do
  at its ends as the one exception to "absent, never disabled" (`lesson-09/ladder-flow.ts:15-18`).
  FACTS 52 and WEB-SPEC Toys 6 say so.
- **S2 in the soft tone, not Merc's voice.** The series draws an illustrated miss as a singer's
  violet line in the soft tone, never as Merc (Lesson 9 FACTS 99; Lesson 3's reply a semitone off);
  violet means a singer only; and the page's own claim is that Merc's run lands every note (FACTS
  38). Everything else in the call is as asked: 0.2 s a note, drawn where the voice went, the FACTS
  line, the Notice tied to "drop back a notch".
- **S4 "by leap", not "by skip".** "Leap" is the series' defined word (Lesson 9 FACTS 14: a step
  goes to the next letter, a leap skips at least one letter); Lessons 16 and 18 use "skips" only as
  a verb, and no lesson defines "a skip".
- **S1:** the shorter of the two lines, for the word budget; it names the task, never the voice.
- **N15:** E4 to E5 rather than the review's E3 to E4: the same shape a fifth above the Minor
  pentatonic word's A3, away from every other fixed play's start.

## Entries for the shared files (the lead writes them)

**MASTER-PLAN § 11**, after Lesson 19's line:

> - Lesson 20: a written lesson, text only, in
>   [`lessons/20-runs-pentatonic/`](lessons/20-runs-pentatonic/) (research, article plan, facts,
>   copy and page spec). Its sung checkpoint, scored on the page, the run or a smaller one, waits
>   on the vocal coach's sign-off (§ 12 item 8). No page is built yet: it waits on Season 2's kit
>   (seasons and the staff toy with both clefs, SEASON-2 § 6.2 items 1 and 2, with Lesson 4's
>   staircase moved into the kit and given three new states and both names on every stair, Lesson
>   9's scored take and flow moved into the kit, the reader's attack and steady options, and the
>   band chart's bead style with an illustrated singer's line) and on the lesson plumbing for
>   Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the console publishes it, after
>   the coach's sign-off and once `/learn/05`, `/learn/09` and `/learn/10`, the pages its chips and
>   its recall link to, are live.

**CURIOSITY-MOMENTS § 2**, a new entry between Lessons 19 and 21 (the predict and Tavi's line are
LESSON.md's, word for word):

> ### Lesson 20 · Runs and the pentatonic scale · voice; written; no page yet · hook kept
>
> - **Opening:** the pitch line between Merc and Tavi with the run's nine beads on a string, each
>   in its band; Play the run fast (0.2 s a note, five every second) and Play it slowly (0.6 s) both
>   work before the choice. Tavi "To sing it fast, you just practise it a lot, don't you?" Merc
>   "Let's see what one study found." A research predict, as Lesson 3's: "Seventeen piano students
>   practised a hard passage until they felt ready, then played it the next day. Which went with
>   playing it better?" [How long they practised] [What share of their tries came out right]; the
>   reveal comes with the choice (Duke, Simmons and Cash 2009: one small study, a link, not proof).
>   The welcome tour waits for the choice, since Step 3 restates the answer (Lesson 20 FACTS 1a,
>   13, 14, 15).
> - **Visual:** Lesson 4's staircase (moving into the kit) losing fa and ti, a number on each riser
>   and both names on every stair, then the same five from la; the run toy, Merc's run as beads on a
>   string on the kit's band chart, Tempo's five notches drawing the beads closer, each still in its
>   band, beside Play it smudged, an illustrated singer's run whose notes slip out of their bands;
>   Staccato · Legato and See it on the staff (new). **Payoff:** Step 3's plan, a tempo where every
>   note lands, nudged up, said as an inference; Sing it's scored run, or a smaller one, read note
>   by note, then the unscored faster pass.
> - **Tease:** a still of Lesson 21's opening, Lesson 2's ring over Lesson 1's keyboard with D major
>   lit and F♯ and C♯ glowing, silent: "D major: seven notes, two black keys, F♯ and C♯. Now step up
>   a fifth."; the alternative `lesson-4`. Lesson 20's own tease, on Lesson 19's card, is "Merc
>   sings a run of nine notes, five every second.", with the plan's line as the alternative `plan`
>   (Lesson 20 FACTS 5, 5b; settled at the lead's reviews on 1 November 2026).
> - **Facts:** sourced in Lesson 20's FACTS: the pentatonic's degrees, steps and rotations (Open
>   Music Theory 2e, 8.9 and 7.13), the study of 304 recordings (Savage et al. 2015), the pianists'
>   practice (Duke, Simmons and Cash 2009, abstract only), agility and staccato (Arneson's guide for
>   beginning singing teachers); the app at `c60f0fdcb`.

**Lesson 19 FACTS 5**, the exact replacement for its quote of this page's predict. Replace

`what best predicted how well seventeen pianists played a hard passage the next day ("How long they practised" or "How many of their tries came out right")`

with

`which went with playing a hard passage better the next day, in one study of seventeen piano students ("How long they practised" or "What share of their tries came out right")`

and, once Lesson 20's package is committed, rebind that fact's citation of the predict from
`docs/plans/find-your-pitch/lessons/20-runs-pentatonic/ARTICLE-PLAN.md:34-36` to
`docs/plans/find-your-pitch/lessons/20-runs-pentatonic/LESSON.md:123-125`, the cold open's predict
and its two choices. The rest of Lesson 19 FACTS 5 holds: the tease names no practice method and no
tempo to practise at, and the still shows nine beads each in its band, nothing blurred.

**`kit/season.ts`** (Season 2's own module), in Lesson 9's entry form, unchanged:

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

`EDGES` gains `[5, 20]`, `[9, 20]` and `[10, 20]` (SEASON-2 § 4.3). No `fig`. Draft line, in the
form of the voice lessons with a scored checkpoint (Lesson 9's, `kit/drafts.ts:38`):
`20: "Lessons 5, 9 and 10's pages, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.

**`kit/lesson-copy.ts`**, set on Lesson 20 (the tease on Lesson 19's card), unchanged:

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
   line above; head, structured data and llms.txt (WEB-SPEC, Sections 2 and item 11).
2. Seasons in the kit and the staff toy with both clefs (SEASON-2 § 6.2 items 1 and 2), the staff
   asked for stemless noteheads in order and a sharp before a note; no staccato dot.
3. Lesson 4's staircase in the kit (Lesson 21's kit work) with three new states (Leave out fa and
   ti, a number on each riser, Major · Minor with the house moving to la) and two options: both
   names on every stair through `signsHtml`, and the readout and white-key note hidden.
4. Lesson 9's scored take and flow (`lesson-09/sing-take.ts`, `lesson-09/ladder-flow.ts`) moved into
   the kit, with the choice's two exercises (Lesson 9's ladders, this page's runs), slot length,
   reader options, rung labels, the offers after Easy or Workable and Move do's reach as options;
   this page adds Again, faster, an unscored guide with the count-in.
5. The reader's two options: `readTake` takes `attackSec` and `steadySec`, defaulting to today's
   0.3 s and 0.6 s, and `LadderOptions` gains the same two, which `readLadder` passes on; a 0.75 s
   slot cannot hold the kit's 0.9 s, so every note of this run would read "not steady". The page
   proposes 0.15 s and 0.45 s; the lab tunes them on real runs.
6. The band chart's bead style (a bead on each rung and a string between), tempo-following slots
   and an illustrated singer's line drawn from a contour, in `kit/band-chart-rungs.ts`; the run toy
   and Play it smudged's contour in `lesson-20/run-toy.ts`.
7. Season 2 in the app's lesson plumbing (SEASON-2 § 5.2 item 21), above all the lesson marker, so
   `?lesson=20` steps First Light aside.
8. Later: Scale Runner's scale-type launch field and minor pentatonic (§ 5.2 item 13), then a
   beginner slug. **SEASON-2 § 5.3 should add** "a drill that sings a run continuously and reads it
   note by note": no drill in the app or the plan does.

## Departures from ARTICLE-PLAN.md, and why (all argued in FACTS and listed in FACTS 4)

- **Lesson 5 gets its chip**: Lesson 9 needs 3 and 6, not 5, so 5 is a direct prerequisite
  (SEASON-2 § 4.3 lists 5, 9 and 10).
- **Sound gate**: Lesson 9's voice-lesson line with "runs", naming the voice and the microphone.
- **Tavi and Merc**: Tavi voices the first choice's guess, "practise it a lot", where the plan gave
  Tavi the card's misconception, which tested tempo while the predict tests how long and how well;
  the misconception stays in Step 3's mix-up card. Merc's line is "Let's see what one study found."
- **Predict wording**: "Which went with playing it better?" (the study reports correlations), and
  the second choice "What share of their tries came out right": the abstract reports the percentage
  correct, not the number correct. The research predict stays, as the lead decided, with the tour
  held.
- **Merc's fast run is drawn as sung**, each bead in its band, not blurred; the smudging is shown in
  Step 3 as an illustrated singer's run, Play it smudged.
- **Recall**: Lesson 9's question 2 in place of Lesson 4's question 1; the plan allowed it.
- **Run (word)**: without "sung on one breath", and "by step or by leap".
- **Step 1**: Lesson 4's own Slide, a semitone number on each riser, "Leave out fa and ti" for
  "Remove fa and ti", and both names on every stair.
- **Step 3**: the Try is for listening; Lesson 9's slow-singing study sits beside the pianists', the
  plan that joins them is called an inference, and the mix-up card's better idea is the Wrap's, a
  tempo where every note lands, then nudge it up (the plan's "as fast as you can sing it right"
  invited working at the edge).
- **Step 4**: says what Arneson says; its line on the staccato dot is cut for length and the dot is
  left to Lesson 18. Listen-only and short, as the lead decided.
- **The smaller run**, do re mi so mi re do, beside the full one, with "If the top feels high, sing
  the smaller run."
- **Move do higher only**: reach `{ lower: 0, higher: 3 }` (lower voice) and `{ lower: 0, higher:
  4 }` (higher), one reach for both runs; any lower move leaves the tenor or soprano 1 semitone or
  less above the floor; the plan's ±4 breaks four presets.
- **Band 35 cents** (Lessons 3 and 9), not the plan's ±60 (Lesson 16's).
- **The reader's two options**, 0.15 s and 0.45 s, for 0.75 s slots.
- **Sing it's lines**: the kit's count and tricky line replace the plan's "Nine beads, each in its
  band. Next time, one notch faster."; the faster pass listens to nothing, is offered once after
  Easy or Workable, and its Easy or Workable line is "That's the run, faster."
- **Practice card**: says what both drills really do at every level they reach, and asks for the
  voice range in Settings first.
- **Quick check**: reworded where a line used "so" as a conjunction, repeated the right answer
  under a wrong one, or said "predict"; question 4 plays E minor pentatonic.
- **Wrap's third line**: "keep your tries right: a tempo where every note lands, then nudge it up".
- **Go deeper**: two items, "Not everywhere" and "Blues"; the stack of fifths left for Lesson 21;
  the wind players' study cut for length.
- **Next-lesson tease**: Lesson 21's settled line, not the plan's.

## Citations of uncommitted lessons

- **Lesson 18** (not written): FACTS 28 cites its ARTICLE-PLAN.md `:82` ("a run of steps
  (neighbouring lines and spaces)"), and FACTS 30 its Words (`:58`), Step 4 (`:101-108`) and coach
  line (`:175`), by path and line. LESSON.md names it in words in the preamble ("the dot is left to
  Lesson 18") and the coach's list ("Lesson 18's plan expects Lesson 20 to sing staccato");
  WEB-SPEC in words in Length (the cut line) and kit item 3. Rebind to Lesson 18's FACTS and
  LESSON.md when its package is written.
- **Lesson 16** (being drafted): FACTS 54 cites its ARTICLE-PLAN.md (`:204`, the ±60-cent pass
  rule) by path and line, only to say this page does not use it; LESSON.md and FACTS 91 name
  "Lesson 16's 60" in words. FACTS 1a names the plans of Lessons 16 and 18 as searched, in words.

## Notes for other packages

- **Lesson 18's writer** (the lead also puts this in Lesson 18's brief): Lesson 20's Run word is
  "quick notes one after another, by step or by leap, like Merc's nine", and its run leaps from mi
  to so. Always qualify Lesson 18's pattern as "a run of steps" (its plan's Words and Step 3 mostly
  do), never a bare "run", so the two lessons never disagree on the word. And Lesson 20 plays
  staccato but asks no one to sing it, and its staff draws no staccato dot, so the plan's "Lesson 20
  sings staccato." should not be promised.
- **Lesson 19 FACTS 5**: the replacement above.
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

None open. The coach's items, all in LESSON.md's "For the vocal coach": do on D (do on E as the
alternative that gives Move do room both ways), Move do higher only, the smaller run and its top
line, the dose (three sung runs a visit against Lesson 9's two), the faster pass at 0.45 s and its
line, Step 3's four practice lines, Play it smudged, and Step 4. The head title has an alternative
in WEB-SPEC's Decisions.
