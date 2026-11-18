# Lesson 22 hand-back: "Vibrato"

Files: `docs/plans/find-your-pitch/lessons/22-vibrato/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/22/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 18's
folder was not touched, and Lesson 18 is not cited. This note is updated for the fix pass of 2
November 2026, after the independent review (`s2pkg/22-REVIEW.md`) and the lead's calls.

Checks, run from `/dev/shm/s2plan` after the fix pass:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/22-vibrato`: 311 citations
  read, **0 findings**.
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/22-vibrato`: **2,229 words**, cap
  2,379 (150 under); steps' own text 89, 114, 109, 117 (inside 50 to 120).
- Built page, estimated: 2,229 + about 150 of hints and status lines (Lesson 8's reckoning) + 33 for
  this page's four lock lines = about 2,412, some 33 over the cap. It prints the reading's example
  lines, as Lesson 5's page does (the first pass's 47-word saving was wrong and is gone). WEB-SPEC
  Length names the cuts a build makes while its count runs over: Go deeper's drawer (39 words, to
  about 2,373), then "Your turn: one note, ten seconds, twice." (7).
- Chip: **15 minutes** (9.37 of reading at 238 a minute + 6.09 of sound and tasks = 15.46), as the
  plan's "about 15"; head description 153 characters with "A fifteen-minute lesson"; the head test
  has the word (`src/tests/lesson-pages.test.ts:83`); `timeRequired` `PT15M`.
- The claims validator's 28 patterns (`src/lib/guided-voice/claims.ts`), applied by hand over
  LESSON.md and WEB-SPEC.md, line by line: no matches. The validator itself was not run (no pnpm).
  No emoji (the only symbols are ♯), no model name, no scratch path in the three files.

Process notes: no git, no pnpm, no downloads, no shared file or code touched. Only the two node
scripts ran. The arithmetic and both hold readers' models are `s2pkg/22-tools/verify22.py` (run with
`python3 -I`, about 6 s), sections 10 to 12 new in this pass; the fix scripts are in
`s2pkg/22-tools/fix/`.

## 0. The fix pass: what changed

- **B1, locks.** Every play that answers a predict waits for its choice, wherever it sits: quick
  check 3's play (Step 3's slow wave) is disabled under "Answer Step 3's question first to hear
  this."; the Wrap's free play waits for the cold open's choice under the steps' lock line, and its
  slow wave, Rate and Drift for Step 3's. So that no straight note on A sounds before the cold open's
  choice anywhere, Sing it's model notes are Merc's usual "ooh" before both holds (the coach's
  alternative, a straight model before Hold 1, would have to wait for that choice), and the
  listening path is Lesson 5's own, now one "Play Merc's 10-second note". The five places that
  said nothing plays, and Test 6, are corrected; Tests 5, 6 and 21 and the edge cases cover the
  locks. No quick-check question needed changing: none prints its answer before it is answered.
- **B2, today's reader.** Recomputed through Voice Mirror's `preprocess` (5-frame median) on 16 ms
  frames over twelve phases: ±50 at 6/s reads 6.1 to 6.4 of 10 (4.0 to 9.9 at 60 frames a second),
  ±60 at 5.5/s 3.9 to 4.0, ±40 at 6/s 9.9 to 10.0, ±50 at 2/s 4.8 to 4.9. FACTS 43, WEB-SPEC item 6, Tests 8
  and the SEASON-2 item below carry these. The coach's list says a real vibrato is reported about 10
  to 30 % below its sung extent, here and in Voice Mirror (FACTS 46).
- **S1, the reader.** The vibrato is now found window by window (3 s windows every 0.5 s, each by
  Voice Mirror's own rule, through one shared function), taken out only where windows found it, and
  described from the line less its middle (√2 × RMS), with the rate the median of the windows'.
  Tests for a late vibrato (from 6 s and from 8 s) and wandering rates (5.5 to 6.5, 5 to 7) are in
  Test 8; all read at least 9.8 on the model. "Never disagree" is gone for the rate and extent; the
  score stays the time on the centre line only.
- **S2 to S9**: "a vibrato's wave" in "What this does"; "on this page" and the band's 35 cents in the
  restated rule, now also in the cold open's reveal; the hero draws Merc's line as a still from the
  first paint; Step 4's wave is "sung", not "measured"; the coach's list gains quick check 4, the
  Wrap's third line, the challenge, the restated rule, "Hold 2: floating", the amber waves and the
  low extent; Merc's lines are amber, violet only the learner's (MASTER-PLAN § 5, SEASON-2 § 6.1
  item 5); Step 3's hint reads "Choose an answer at the top first." until the cold open's choice,
  and its predict mounts at that choice, since the kit keeps the hint it finds at mount; the
  built-page count is redone.
- **Nits**: "swing after swing" and "Its peaks rose above the band" (16 of 18 swings cross, with the
  grow-in); chip 15; FACTS 36 says the analyser's depth is 2 × RMS; the ribbon "swings"; Merc sings
  every example on A3 for every learner (so the tease and Go deeper hold for everyone); Step 2's
  range reads "usually under ±100 cents, a semitone either way"; every wave's grow-in is stated
  (0.3 s, the "ooh" 0.35 s); the dashed middle draws only when the reader found a vibrato; the 3.5
  floor and the omitted 10-cent floor are on the coach's list. Not taken: nit 11 (Step 4's example
  "5.6 Hz, ±38" beside a played 5.5 at ±30); the reviewer allowed keeping it, and "say," marks it
  as an example, Voice Mirror's own.

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
  cents marked, and across it from the first paint Merc's line as a still, swinging past both edges,
  as Lesson 21's card drew it. Play Merc's note works before the choice: A3 for every learner, 3 s,
  six swings a second at ±50 cents, his amber line redrawn past both edges swing after swing. Tavi
  "It peaks above the band, swing after swing. Won't the peaks be what I hear?" Merc "Listen, then
  match it." Predict: "Merc's note swings 50 cents up and 50 cents down, six times a second. Which
  straight note, with no wave, sounds the same?" [The top of the swing] [The middle of the swing].
  Each answering play sets the wave beside a straight note, the top (A3 and 50 cents) or the middle
  (A3); the reveal waits for both, says a wave this wide doesn't fit inside the band but its middle
  does, and a dashed amber line labelled "middle" draws itself. Nothing on the page plays a straight
  note on A before the choice: the steps' toy and free play wait, the four words' straight note
  plays D, Sing it's notes are Merc's "ooh", and the first-visit tour waits too (Lesson 22 FACTS 1a,
  24, 41). Step 3 has a second predict, as the lead allowed: the same wave at two swings a second,
  [Still one note] [A note that moves up and down]. Until the cold open's choice its hint reads
  "Choose an answer at the top first."; its slow play, Rate and Drift, quick check 3's play and free
  play's slow wave all wait for its choice, and the step's text under the predict shows with its
  reveal.
- **Visual:** Lesson 5's band chart (exists), with new states: no centre, Merc's wave in amber drawn
  from its play's schedule and as a still, a dashed middle, a one-second sweep with a swing counter
  and a ruler, Drift, and the app's own vibrato ribbon (`vibratoShapePath`) beside Merc's sung wave.
  **Payoff:** Step 3's slow wave heard moving, and Drift's middle leaving the band; Step 4's ribbon
  gaining swings as it widens while the sung line keeps its 11; Sing it's two holds, each line drawn,
  then, where a vibrato was found, its middle, read on the middle, with the vibrato described and
  never scored.
- **Tease:** this lesson's, on Lesson 21's card: "Merc holds one note, and its line swings past both
  edges of the band." (69), alternative `nudged`, "Each fifth is nudged two cents. A held note can
  move far more." (62). On this lesson's card, Lesson 23's: "One note, swinging. Now two notes
  together: one pair wants to move." (67), alternative `hold` (66), with Lesson 23's opening as the
  still. Both pairs as settled at the lead's review on 1 November 2026, and checked true of this page:
  Merc holds the cold open's note for every learner.
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
  minutes: 15, // once the page is built
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

## 5. SEASON-2 § 5 entries (the lead's answer 1, with the review's corrections)

- **§ 5.2, a new item 22, proposed:** "22. **A hold read on its middle** (kit code with tests, small):
  the kit's hold reader counts frames inside the band (`src/features/lessons/kit/hold-take.ts:285-291`),
  on frames that Voice Mirror's preprocessing has median-filtered over 5 frames. On the kit's 16 ms
  frames a held vibrato of ±50 cents at six swings a second reads about 6.1 to 6.4 of 10 seconds in
  the band, by how the frames fall on the wave, and ±60 at 5.5 a second about 4, although its middle
  never leaves the band. Voice Mirror's wave finding (`src/lib/mirror/metrics.ts:496-511`) moves into
  one exported function, which its steadiness calls once on the whole trimmed hold, as now, and the
  new reader calls on 3-second windows every half second, so a vibrato that comes late or whose rate
  wanders is found too. Where a window finds one, the reader takes it out with a running mean one
  swing long, reads the hold on that middle line by the hold reader's own rules, and describes the
  vibrato's rate from its windows and its extent from the line less its middle (√2 × RMS); the score
  stays the time on the middle line, and nothing scores the vibrato. Both this reader and Voice
  Mirror report a real vibrato about 10 to 30 % below its sung extent, since the median and the
  analysis buffer trim its peaks. The hold summary takes its subject as an option. Lesson 22's page
  ships only with it (Lesson 22 WEB-SPEC, What the kit and the app still need, item 6, with Tests 8
  to 10). Lesson 22."
- **§ 5.1, row 22**, "Waits for": unchanged for the practise link (item 14); if the table should say
  what the page waits on too, add "the page: a hold read on its middle (item 22, code)".
- **§ 6.1 item 6 and § 6.2 item 6** are now specified for this page: the voice's vibrato option and
  setter (WEB-SPEC item 4); the band chart's states and the reader's middle line and vibrato line
  (items 5 and 6). § 6.1 item 6 calls the trace beside the ribbon "the measured wave"; on Lesson 22's
  page it is Merc's synthesised wave, labelled "sung" (FACTS 68), so the item could say "a sung or
  measured wave".
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
5. **New**: the band chart's states: no centre; Merc's wave in amber from a play's schedule, and the
   hero's still; the dashed middle line (amber on Merc's waves, violet on the learner's, only when a
   vibrato was found); the sweep, counter and ruler; the rising middle; the ribbon panel beside the
   sung wave; no live band state during a take. The page also holds the steps' toy, free play, Step
   3 and quick check 3's play behind the two choices (WEB-SPEC Toys 1 to 5).
6. **New**: the centre-line reader (section 5 above), with its tests (WEB-SPEC Tests 8 to 10).
7. Lesson 5's hold flow moved into the kit with options (hold lengths, the listening notes, reader,
   live band state, `restAfterEffort`, Hold 2's button, the summary's subject), Lesson 5's page
   unchanged. Both holds here take Lesson 5's model note, so no model option is needed.
8. The lesson copy (section 4) and the signature line.
9. SEASON-2 § 5.2 item 21 (the marker's range and the lesson-answer bounds).
10. The head, the structured data (`PT15M`), the share card `learn/lesson-22-og.jpg` and the llms.txt
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
2. **Merc sings every example, on A3, for every learner**, where the plan gave a stored higher voice
   Tavi on A4: both predicts and Lesson 21's tease name Merc, and the examples are for listening. The
   stored voice picks only who sings with the learner in Sing it (FACTS 8).
3. **Merc's lines are amber**, his colour on a pitch canvas (MASTER-PLAN § 5), and violet is only
   the learner's line (SEASON-2 § 6.1 item 5), as the lead decided; the first pass drew the waves
   violet, as Lesson 5's hook draws takes (FACTS 38).
4. **Words.** "Straight note", not "straight tone": a tone is two semitones in this series. "Swing"
   counts a vibrato's cycles, and the ribbon's, the hook's word and Lesson 1's ("swings per
   second"), and "wave" names the vibrato as a whole, Lesson 5's word; the plan counted "waves". The
   predict and quick check 2 ask for a "straight" note, not a "steady" one, since Lesson 5's steady
   note can carry a small vibrato (FACTS 10).
5. **Tavi's cold-open line** argues for the top, a sincere guess, about the line the hero shows: "It
   peaks above the band, swing after swing. Won't the peaks be what I hear?". The plan's "Isn't it
   out of tune half the time?" argued for neither choice; that worry is Step 3's, where Tavi now
   asks it (FACTS 40).
6. **The answering plays** set the wave beside each straight note (wave 2 s, quiet 0.3 s, straight
   2 s), so the ear compares them as a matching test does; the plan played the wave and two straight
   notes apart (FACTS 41).
7. **Nothing before a choice plays its answer, anywhere on the page.** The four words' straight note
   plays D, not A3; the Extent word names no centre; the steps' toy and free play wait for the cold
   open's choice; Sing it plays no straight note; Step 2's Rate starts at 5 (the plan's 4 is "clearly
   undulating") and Extent stops at ±60 (the plan's ±80); Step 3's slow play, Rate and Drift, quick
   check 3's play and free play's slow wave wait for Step 3's choice, and Step 3's reveal, Tavi's
   line, the mix-up card, Try and Notice show only with its reveal. Free play locks, unlike Season
   1's, because a learner can scroll to it before either choice (FACTS 1a, 24, 71).
8. **Step 1's heading** is "What exactly is waving?", not "What makes a held note wave?", which asks
   how a vibrato is made, a question the page does not answer (FACTS 27). Step 1 plays Lesson 14's
   swell beside the wave, so "not loudness" is heard, and drops the zoom drag (Step 2's window is the
   zoom).
9. **Step 2** has Rate and Extent sliders with Play in place of three fixed examples, and keeps
   Merc's "ooh" as its own play.
10. **Lesson 5's rule is restated where it stops being enough**, in the cold open's reveal ("a wave
    this wide doesn't fit inside it, but its middle does") and in Step 3's mix-up card, with the
    band's 35 cents and "on this page", since only this page's holds read the middle (FACTS 22).
11. **Drift** lifts the middle 50 cents, out of the band; the plan's 20 stayed inside it, so "the note
    drifts" was neither seen nor heard against the band (FACTS 23).
12. **Go deeper** keeps one item of four, for length, and says "almost the same" where the plan said
    "too close to hear": no source read gives a hearing threshold (FACTS 3, 19; Unsupported, not
    used).
13. **Step 4** labels its wave "sung", where the plan and SEASON-2 § 6.1 item 6 say "measured": it is
    synthesised (FACTS 68). Step 4 and quick check 4 say what the review supports: "Choir experts'
    views range from a free vibrato, like a soloist's, to a minimal one or none, and singers can
    change theirs." The plan's "soloists often sing with one" and "change theirs to fit a group" go
    further than the review, which calls how singers adjust unclear (FACTS 25).
14. **Sing it:**
    - Hold 1's cue is "ten seconds on your note, as level as feels easy", not "straight, as in Lesson
      5", which could ask a voice with a vibrato of its own to work at holding it back; the plan's
      wording is the coach's alternative (FACTS 54).
    - Hold 2 is offered only after Easy or Workable on Hold 1, as Lesson 5 offers its longer hold.
    - Merc's model note is his usual "ooh" before both holds, as in Lesson 5; a straight model
      before Hold 1, the coach's alternative, would have to wait for the cold open's choice (FACTS
      56).
    - No live band state during a take: a wave wider than the band would flicker it (FACTS 57).
    - Lesson 5's optional warm-up is kept, since the holds are Lesson 5's exercise (FACTS 50).
    - "Just listen today" is Lesson 5's line word for word, with one "Play Merc's 10-second note";
      the plan proposed "two holds, one straight and one that floats" (FACTS 48).
    - The vibrato line reads "The note had a wave: about 5.6 swings a second, ±38 cents.", in the
      page's words and Voice Mirror's own example numbers, for the plan's "A wave about 5.5 times a
      second, about 30 cents either side of its centre." (FACTS 46).
    - "What this does" says it "takes a vibrato's wave out" and "A vibrato doesn't count against
      you", for the card's "a vibrato inside the band counts in full": with the reader, a vibrato
      wider than the band, or one that comes late, counts in full too (FACTS 52).
    - The dashed middle draws only after a hold in which the reader found a vibrato.
    - The summary after Hold 2 says "the middle of your line" (FACTS 45).
    - The rest card shows after Effortful too, as SEASON-2 § 1.4 item 4 asks, through
      `restAfterEffort`; Lesson 5's own card shows it only after Uncomfortable or Just listen today
      (FACTS 59).
15. **The practice card** has no first-visit line: Voice Mirror is its own document and never meets
    First Light, where the plan expected Lesson 1's line once item 21 shipped (FACTS 34). Its vibrato
    sentence reads "it gives its rate and extent and doesn't count it against you".
16. **The Wrap's third line** drops the plan's "and the app scores neither": the page does score the
    holds' time in the band, so the clause would mislead.

## 8. Citations of uncommitted lessons, made in words

None. Every lesson package cited (1, 3, 5, 8, 12, 14, 16, 21 and 23) is cited by path and line at
the branch head, and Lesson 10's free play by its code; Lesson 18 is not cited.

## 9. Questions for the owner, and notes for the lead

- **For the owner: the page's title** (WEB-SPEC, Decisions for the owner, 1). Recommended "What is
  vibrato in singing? | MercuryPitch" (42); alternative "Vibrato: rate, extent and the note you hear
  | MercuryPitch" (58).
- **Lesson 21's FACTS 5** describes Lesson 22's opening as "Merc holds A3 (Tavi A4)" and its predict
  as asking "which steady note sounds the same". This page now has Merc hold A3 for every learner
  (departure 2) and asks for a "straight" note (departure 4). The tease and the choices it quotes are
  unchanged, so nothing on Lesson 21's page changes, but those two phrases in its FACTS are stale.
  Lesson 21's still names no colour for the line; if its spec draws it, Merc's amber now matches this
  page.
- App notes for SEASON-2 § 5.2 item 14's review: the Vibrato drill's style comments cite unnamed
  sources for "healthy" rates and a method (`src/features/exercises/vibrato/vibrato-styles.ts:5-10`);
  the shared analyser labels a vibrato "slow-operatic", "natural", "nervous" or "wide"
  (`src/lib/vocal-analyzer.ts:741-752`), evaluative words that any surface showing them would need to
  check against the house rules, and its depth is 2 × RMS though its comment says peak to peak
  (`src/lib/vocal-analyzer.ts:792-794`); and Long Note's help still opens "Hold a steady pitch as
  long as you can" (`src/features/exercises/exercise-help.ts:30`), against the series' fixed holds.
- Voice Mirror's own whole-hold fit misses a vibrato that starts in a hold's last 2 s and reports
  ±15 to ±17 for a ±50 vibrato that starts late or wanders (Lesson 22 FACTS 44, 46). The proposed
  shared function leaves Voice Mirror's results as they are; whether Voice Mirror should take the
  windows too is the app's call.
