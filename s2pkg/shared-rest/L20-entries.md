# Lesson 20: shared entries (drafted at the lead's review, 2 November 2026)

Apply in the shared commit (#229) after every in-flight package is committed; re-check each quoted
line against the file as it then stands, and run reanchor plus the findings compare.

## From the writer's hand-back (MASTER-PLAN § 11, CURIOSITY-MOMENTS § 2, kit entries, Lesson 19 FACTS 5)

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

## SEASON-2 § 5.3

From the hand-back's kit list: beginner slug. **SEASON-2 § 5.3 should add** "a drill that sings a run continuously and reads it
   note by note": no drill in the app or the plan does.

## Rebind when Lesson 18 is committed

Lesson 20 FACTS 30 cites Lesson 18's ARTICLE-PLAN (Words `:58`, Step 4 `:101-108`, coach `:175`);
rebind to Lesson 18's FACTS and LESSON.md if they still hold the staccato dot (BRIEF-18 asks it to).

## The lead's calls at review (for the record)

- Fix pass took every call but N14 ("lower" is Move do's way back after "higher"; the kit marks an
  end as aria-disabled, Lesson 9's one exception), S2 made in the soft tone as an illustrated
  singer's violet line (Merc never misses on screen), S4 "by step or by leap" (the series' word).
  All accepted.
- Lead edits: prettier (82a's indent, a "4)" line start, a code span kept on one line, table
  padding); FACTS 54's citation of Lesson 16's plan moved to Lesson 16 FACTS 45 as committed.
