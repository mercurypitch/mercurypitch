# Lesson 22 hand-back: "Vibrato"

Files: `docs/plans/find-your-pitch/lessons/22-vibrato/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/22/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 18's
folder was not touched, and Lesson 18 is not cited.

Checks, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/22-vibrato`: 281 citations
  read, **0 findings**.
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/22-vibrato`: **2,228 words**, cap
  2,379 (151 under); steps' own text 89, 112, 109, 117 (inside 50 to 120). A built page is about
  2,378 with hints and status lines, about 2,331 once the reading's three example lines (47 words)
  give way to the learner's own; two cuts are named in WEB-SPEC Length (46 words). Chip: 16 minutes
  (9.36 of reading at 238 a minute, about 6.2 of sound and tasks).
- The claims validator's 28 patterns (`src/lib/guided-voice/claims.ts`), applied by hand with
  python over LESSON.md and WEB-SPEC.md, line by line and whole: no matches. The validator itself was
  not run (no pnpm).
- Head description: 153 characters, with "A sixteen-minute lesson"; the head test has a word for
  sixteen (`src/tests/lesson-pages.test.ts:84`).

Process notes: no git, no pnpm, no downloads, no shared file or code touched. Only the two node
scripts ran; plan-cites also ran on a scratch file in `s2pkg/22-tools/citetest/` (since deleted), to
learn how it attaches quotes. The arithmetic is `s2pkg/22-tools/verify22.py` (run with `python3 -I`).

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 21's)

- Lesson 22: a written lesson, text only, in [`lessons/22-vibrato/`](lessons/22-vibrato/)
  (research, article plan, facts, copy and page spec). Its scored checkpoint, two ten-second holds
  read on the middle of the learner's line, waits on the vocal coach's sign-off (§ 12 item 8). No
  page is built yet: it waits on Season 2's kit (seasons, SEASON-2 § 6.2 item 1; Merc's voice with
  its vibrato as a parameter, § 6.1 item 6; new band chart states; Lesson 5's hold flow moved into
  the kit), on a centre-line hold reader, without which it does not ship (SEASON-2 § 5.2, proposed
  item 22), and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live
  when the console publishes it, after the coach's sign-off and once `/learn/05` and `/learn/14`,
  the pages its chip and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry)

### Lesson 22 · Vibrato · voice; written; no page yet · hook kept

- **Opening:** Lesson 5's band between Merc and Tavi, with no centre line, no note named and no
  cents marked. Play Merc's note works before the choice: A3 (Tavi A4), 3 s, six swings a second at
  ±50 cents, its violet line past both edges of the band on every swing. Tavi "It peaks above the
  band on every swing. Won't the peaks be what I hear?" Merc "Listen, then match it." Predict:
  "Merc's note swings 50 cents up and 50 cents down, six times a second. Which straight note, with
  no wave, sounds the same?" [The top of the swing] [The middle of the swing]. Each answering play
  sets the wave beside a straight note, the top (A3 and 50 cents) or the middle (A3); the reveal
  waits for both, then a dashed violet line labelled "middle" draws itself. Every step toy waits for
  the choice, the four words' straight note plays on D, and the first-visit tour waits too (Lesson 22
  FACTS 1a, 24, 41). Step 3 has a second predict, as the lead allowed: the same wave at two swings a
  second, [Still one note] [A note that moves up and down]; its slow play, Rate and Drift wait for
  its choice, and the step's text under the predict shows with its reveal.
- **Visual:** Lesson 5's band chart (exists), with new states: no centre, a sung wave drawn from its
  play's schedule, a dashed middle, a one-second sweep with a swing counter and a ruler, Drift, and
  the app's own vibrato ribbon (`vibratoShapePath`) beside a measured wave. **Payoff:** Step 3's
  slow wave heard moving, and Drift's middle leaving the band; Step 4's ribbon gaining waves as it
  widens while the measured line keeps its 11 swings; Sing it's two holds, each line drawn, then its
  middle, read on the middle, with a vibrato described and never scored.
- **Tease:** this lesson's, on Lesson 21's card: "Merc holds one note, and its line swings past both
  edges of the band." (69), alternative `nudged`, "Each fifth is nudged two cents. A held note can
  move far more." (62). On this lesson's card, Lesson 23's: "One note, swinging. Now two notes
  together: one pair wants to move." (67), alternative `hold` (66), with Lesson 23's opening as the
  still. Both pairs as settled at the lead's review on 1 November 2026, and checked true of this page.
- **Facts:** sourced in Lesson 22's FACTS: rate and extent, the measured ranges and averages, slow
  rates heard moving and pitch judged as well with a vibrato (Sundberg 1994, read in full); the heard
  pitch near the geometric mean (Shonle and Horan 1980, abstract, and d'Alessandro and Castellengo
  1994, read in full); 6.1 swings a second across ten singers (Prame 1992, abstract); choir views and
  singers' adjustment (Acosta Martínez and Daffern 2025, read in full); the app at `c60f0fdcb`.
  Nothing is said about how a vibrato is made, whether it can be trained, or health.

## 3. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 22,
  lane: 'voice',
  title: 'Vibrato',
  short: 'Vibrato',
  topics: ['S19'],
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 16, // once the page is built
  page: '/learn/22', // once the page is built
  hook: "If a singer's held note swings up and down six times a second, why do we still hear one note?",
  pr: {
    needs: "The Vibrato exercise's copy and default (SEASON-2 § 5.2 item 14), before any link to it",
    link: {
      href: '/mirror?lesson=22',
      addr: 'mercurypitch.com/mirror',
      label: 'Voice Mirror',
      note: 'its Hold: a vibrato reported, never scored',
    },
  },
}
```

- `EDGES` gains `[14, 22]` (SEASON-2 § 4.3 row 22); `PREREQ[22]` is then `[14]`.
- `drafts.ts`: `22: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.
- `team-notes.ts` `SIGNATURES[22]`: "Lesson 5's band, zoomed until a held note's wave shows: a counter
  and a ruler measure it, a middle line draws itself, and the app's ribbon stands beside it,
  labelled a mark."

## 4. `kit/lesson-copy.ts` (hook and teases, settled at the lead's review on 1 November 2026)

- Lesson 22 (set on Lesson 22, drawn on Lesson 21's card): no hook alternatives; the default hook is
  the season's.
  - `tease`: "Merc holds one note, and its line swings past both edges of the band." (69).
  - `teaseAlts`: `[{ id: 'nudged', text: 'Each fifth is nudged two cents. A held note can move far
    more.' }]` (62).
  - `TEASE_NOTES[22].nudged`: "The plan's line from Lesson 21, cut to fit. It ties Lesson 21's
    two-cent nudge to this lesson's swing of 50 cents, and sets up the hook more than the opening."
- Lesson 23's tease, on this page's card, is set on Lesson 23 as its hand-back gives it; nothing new
  from this lesson.

## 5. SEASON-2 § 5 entries (the lead's answer 1)

- **§ 5.2, a new item 22, proposed:** "22. **A hold read on its middle** (kit code with tests, small):
  the kit's hold reader counts frames inside the band (`src/features/lessons/kit/hold-take.ts:285-291`),
  so a held vibrato of ±50 cents reads about 4.9 of 10 seconds in the band although its middle never
  leaves it. Voice Mirror's wave finding (`src/lib/mirror/metrics.ts:496-511`) moves into one
  exported function that its steadiness and the new reader both call; the reader takes out a wave
  it finds with a running mean one swing long and reads the hold on that middle line by the hold
  reader's own rules; the hold summary takes its subject as an option. Lesson 22's page ships only
  with it (Lesson 22 WEB-SPEC, What the kit and the app still need, item 6, with its tests). Lesson
  22."
- **§ 5.1, row 22**, "Waits for": unchanged for the practise link (item 14); if the table should say
  what the page waits on too, add "the page: a hold read on its middle (item 22, code)".
- **§ 6.1 item 6 and § 6.2 item 6** are now specified for this page: the voice's vibrato option and
  setter (WEB-SPEC item 4); the band chart's states and the reader's middle line and vibrato line
  (items 5 and 6).
- **§ 3, Lesson 22's card, checkpoint** (`SEASON-2.md:471-472`): "a vibrato inside the band counts
  in full" can become "a vibrato counts in full", since the reader reads the middle whatever the
  extent (the lead's answer 3); the page says "A vibrato doesn't count against you".

## 6. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host: `learn/22.html`, `STANDALONE_DOCUMENT_PATHS`, the first-paint budgets.
2. The draft line (above).
3. Seasons in the kit (SEASON-2 § 6.2 item 1).
4. **New**: Merc's voice with its vibrato as a parameter: a `vibrato` option on `VoiceOptions`
   (rate, extent, grow-in, or null for a straight note), in the demo voice's form, Season 1's plays
   unchanged without it; a setter that glides rate and depth over 50 ms for the sliders; tests.
5. **New**: the band chart's states: no centre; a sung line from a play's schedule; the dashed
   middle line; the sweep, counter and ruler; the rising middle; the ribbon panel; no live band
   state during a take.
6. **New**: the centre-line reader (section 5 above), with its tests (WEB-SPEC Tests 8 to 10).
7. Lesson 5's hold flow moved into the kit with options (hold lengths, model voices, reader, live
   band state, `restAfterEffort`, Hold 2's button, the summary's subject), Lesson 5's page
   unchanged.
8. The lesson copy (section 4) and the signature line.
9. SEASON-2 § 5.2 item 21 (the marker's range and the lesson-answer bounds).
10. The head, the structured data (`PT16M`), the share card `learn/lesson-22-og.jpg` and the llms.txt
    line on release.
11. Lesson 14's questions as a module, so the recall imports `l14-q3`.
12. Later, the app's: SEASON-2 § 5.2 item 14 (the Vibrato exercise's copy and default), before the
    coach decides on any link to it.
13. Optional, at release: SEARCH § 8's `/mirror` row and Voice Mirror's `lessonsPractised`
    (`src/seo/entry-pages.ts:177`) gain 22.

## 7. Departures from ARTICLE-PLAN.md, and why

1. **The recall** asks Lesson 5's question 3, then Lesson 14's question 3, in lesson order. The plan
   asked Lesson 5's question 4, whose feedback ("a small vibrato can sit inside the band") would sit
   one scroll under the cold open's choices and lean to the middle; Lesson 14's recall had already
   asked questions 2 and 4 (FACTS 1a, 7).
2. **Words.** "Straight note", not "straight tone": a tone is two semitones in this series. "Swing"
   counts a vibrato's cycles, the hook's word and Lesson 1's ("swings per second"), and "wave" names
   the vibrato as a whole, Lesson 5's word; the plan counted "waves". The predict and quick check 2
   ask for a "straight" note, not a "steady" one, since Lesson 5's steady note can carry a small
   vibrato (FACTS 10).
3. **Tavi's cold-open line** argues for the top, a sincere guess at a choice: "Won't the peaks be what
   I hear?". The plan's "Isn't it out of tune half the time?" argued for neither choice; that worry
   is Step 3's, where Tavi now asks it (FACTS 40).
4. **The answering plays** set the wave beside each straight note (wave 2 s, quiet 0.3 s, straight
   2 s), so the ear compares them as a matching test does; the plan played the wave and two straight
   notes apart (FACTS 41).
5. **Nothing before a choice plays its answer.** The four words' straight note plays D, not A3; the
   Extent word names no centre; every step toy waits for the cold open's choice; Step 2's Rate starts
   at 5 (the plan's 4 is "clearly undulating") and Extent stops at ±60 (the plan's ±80); Step 3's slow
   play, Rate and Drift wait for Step 3's choice, and its reveal, Tavi's line, the mix-up card, Try
   and Notice show only with its reveal (FACTS 1a, 24).
6. **Step 1's heading** is "What exactly is waving?", not "What makes a held note wave?", which asks
   how a vibrato is made, a question the page does not answer (FACTS 27). Step 1 plays Lesson 14's
   swell beside the wave, so "not loudness" is heard, and drops the zoom drag (Step 2's window is the
   zoom).
7. **Step 2** has Rate and Extent sliders with Play in place of three fixed examples, and keeps
   Merc's "ooh" as its own play.
8. **Lesson 5's rule is restated where it stops being enough**, in Step 3's mix-up card (the lead's
   answer 2); the cold open's reveal stays short (FACTS 22).
9. **Drift** lifts the middle 50 cents, out of the band; the plan's 20 stayed inside it, so "the note
   drifts" was neither seen nor heard against the band (FACTS 23).
10. **Go deeper** keeps one item of four, for length, and says "almost the same" where the plan said
    "too close to hear": no source read gives a hearing threshold (FACTS 3, 19; Unsupported, not
    used).
11. **Step 4 and quick check 4** say what the review supports: "Choir experts' views range from a
    free vibrato, like a soloist's, to a minimal one or none, and singers can change theirs." The
    plan's "soloists often sing with one" and "change theirs to fit a group" go further than the
    review, which calls how singers adjust unclear (FACTS 25).
12. **Sing it:**
    - Hold 1's cue is "ten seconds on your note, as level as feels easy", not "straight, as in Lesson
      5", which could ask a voice with a vibrato of its own to work at holding it back; the plan's
      wording is the coach's alternative (FACTS 54).
    - Hold 2 is offered only after Easy or Workable on Hold 1, as Lesson 5 offers its longer hold.
    - Merc's model note is straight before Hold 1 and his usual "ooh" before Hold 2 (FACTS 56).
    - No live band state during a take: a wave wider than the band would flicker it (FACTS 57).
    - Lesson 5's optional warm-up is kept, since the holds are Lesson 5's exercise (FACTS 50).
    - "Just listen today" adds "twice" to Lesson 5's line, where the plan proposed "two holds, one
      straight and one that floats" (FACTS 48).
    - The vibrato line reads "The note had a wave: about 5.6 swings a second, ±38 cents.", in the
      page's words and Voice Mirror's own example numbers, for the plan's "A wave about 5.5 times a
      second, about 30 cents either side of its centre." (FACTS 46).
    - "What this does" says "A vibrato doesn't count against you", for the card's "a vibrato inside
      the band counts in full": with the reader, a vibrato wider than the band counts in full too
      (FACTS 52).
    - The summary after Hold 2 says "the middle of your line" (FACTS 45).
    - The rest card shows after Effortful too, as SEASON-2 § 1.4 item 4 asks, through
      `restAfterEffort`; Lesson 5's own card shows it only after Uncomfortable or Just listen today
      (FACTS 59).
13. **The practice card** has no first-visit line: Voice Mirror is its own document and never meets
    First Light, where the plan expected Lesson 1's line once item 21 shipped (FACTS 34). Its vibrato
    sentence reads "it gives its rate and extent and doesn't count it against you".
14. **The Wrap's third line** drops the plan's "and the app scores neither": the page does score the
    holds' time in the band, so the clause would mislead.

## 8. Citations of uncommitted lessons, made in words

None. Every lesson cited (1, 3, 5, 8, 12, 14, 16, 21 and 23) is cited by path and line at the branch
head; Lesson 18 is not cited.

## 9. Questions for the owner, and notes for the lead

- **For the owner: the page's title** (WEB-SPEC, Decisions for the owner, 1). Recommended "What is
  vibrato in singing? | MercuryPitch" (42); alternative "Vibrato: rate, extent and the note you hear
  | MercuryPitch" (58).
- Lesson 21's FACTS 5 describes Lesson 22's predict as asking "which steady note sounds the same";
  this page now asks for a "straight" note (departure 2). The choices it quotes are unchanged, so
  nothing on Lesson 21's page changes, but its FACTS wording is stale.
- App notes for SEASON-2 § 5.2 item 14's review: the Vibrato drill's style comments cite unnamed
  sources for "healthy" rates and a method (`src/features/exercises/vibrato/vibrato-styles.ts:5-10`);
  the shared analyser labels a vibrato "slow-operatic", "natural", "nervous" or "wide"
  (`src/lib/vocal-analyzer.ts:741-752`), evaluative words that any surface showing them would need to
  check against the house rules; and Long Note's help still opens "Hold a steady pitch as long as
  you can" (`src/features/exercises/exercise-help.ts:30`), against the series' fixed holds.
- The kit's band chart leaves Merc's vibrato out of his line "so the wobble is never read ... as
  something to copy" (`src/features/lessons/kit/band-chart.ts:5-12`). Lesson 22's figures draw waves
  on purpose, as sung lines for listening, and keep the steady amber line in Sing it; WEB-SPEC Look
  says so, for the coach to confirm with the rest.
