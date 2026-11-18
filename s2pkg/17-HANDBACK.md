# Lesson 17 hand-back: How long is a note?

For the lead. The package is in the worktree at
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/17-note-lengths/`, with copies of the three files
in `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/17/`.
This note was rewritten after the fix pass; its last section answers the review finding by finding.

## Files and checks

- `FACTS.md` (facts 1 to 78, with 1a, 5a, 5b, 26a and 57a), `LESSON.md` and `WEB-SPEC.md`.
  RESEARCH.md and ARTICLE-PLAN.md are untouched. No shared file and no code was edited.
- Word count (`node scripts/lesson-words.mjs`): **2,309 words, 70 under the cap of 2,379.** Each
  step's own text: 118, 120, 119, 107 and 110 words. The chip now reads **16 minutes** (FACTS 3).
  The new plays add about 7 s to the estimate: Play the halvings, Step 3's second bar and the longer
  Play both. That moves it from 15.47 minutes to 9.70 + 5.88 = 15.58, which rounds to 16.
- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/17-note-lengths`: **146
  citations read, 0 findings.**
- App claims were checked again at `c60f0fdcb`, now including the Ear Lab's click synth, its default
  click voice, The Chart's replay and the explorer's practise line.
- Leak check redone for the title, the head title and description, the share card, the promise, the
  sound gate line, the hero's bubbles, the recall, the explorer card and figure, and both teases
  (FACTS 1a).
- The checkpoint's judge figures come from a simulation that imports the app's own modules
  (`readRhythm`, `judgeTake`, `toleranceFor`, `estimateDrumInputLatency`) and runs them on seeded
  takes. It now prints the new line format. A reviewer can re-run it with
  `node --experimental-strip-types /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/17-tools/sim17.mjs`
  from `/dev/shm/s2plan`. The lesson files name it `sim17.mjs` and give no path.

## Entries for the shared files

### MASTER-PLAN § 11

- Lesson 17: a written lesson, text only, reviewed once and fixed, in
  [`lessons/17-note-lengths/`](lessons/17-note-lengths/) (research, article plan, facts, copy and
  page spec). Its optional sing-along waits on the vocal coach (§ 12 item 8). No page is built yet.
  It waits on Season 2's kit: seasons, the staff toy with the F clef, rhythm on the staff, the tap
  take in the kit and the Ear Lab's woodblock as a kit sound (SEASON-2 § 6.2 items 1 to 3), and the
  lesson plumbing for 15 to 28 (SEASON-2 § 5.2 item 21). It goes live when the console publishes it,
  after the coach's sign-off and once `/learn/08`, the page its chip and its recall link to, is live.

### CURIOSITY-MOMENTS

```markdown
### Lesson 17 · How long is a note? · theory; written; no page yet · hook kept

- **Opening:** an empty line over Lesson 8's four beat pads. Tavi "A quarter note must be a set
  length of time. Isn't that what the name says?" Merc "Same bar, faster click. Watch the
  stopwatch." The first play, at 60 BPM over a woodblock click, writes four quarter notes as they
  sound, and a stopwatch strip reads "1 s" under each. Predict: "Merc plays the same written bar
  again, with the click at 120 BPM. How long does each quarter note last now?" [One second, the
  same] [Half a second].
- **Visual:** the rhythm bar on one line, then on the staff, and the stopwatch strip (new, SEASON-2
  § 6.2 items 2 and 3); Lesson 8's pads (exist); the Ear Lab's woodblock (exists, moves into the
  kit). **Payoff:** Step 2's tempo slider and Play both; the checkpoint, two written bars tapped on
  the pad after two bars of beat taps.
- **Tease:** a still of Lesson 18's opening line on the staff over a beat grid, with no cursor or
  bracket, which does not play: "Now you can read when each note comes, and where it sits."
- **Facts:** sourced in Lesson 17's FACTS: note values, rests, dots, ties and counting (Open Music
  Theory 2e, 1.2, 1.8 and 1.9), where rests go (Williams 2025), where dots and ties go (Wikipedia,
  after Read 1969), Takadimi (Hoffman, Pelto and White 1996), the British names and the lesson's
  scope (ABRSM 2023, RCM 2019); the app at `c60f0fdcb`.
```

Lesson 16's entry, when it is written, carries this lesson's tease as its **Tease** line (below).

### `kit/season.ts` (Season 2's module, once SEASON-2 § 6.2 item 1 makes one)

```ts
{
  n: 17,
  lane: 'theory',
  title: 'How long is a note?',
  short: 'Note lengths',
  topics: ['T07'],
  minutes: 16,
  page: '/learn/17',
  hook: 'Why is a quarter note not a quarter of a second?',
  pr: {
    needs: 'The Chart without triplets or sixteenths (an ear-drill link)',
    link: {
      href: '/ear-lab?lesson=17',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap The Chart',
    },
  },
  // fig: 'rhythm', once the kit draws it (WEB-SPEC, What the kit and the app still need, item 12)
},
```

- `TOPICS` gains `T07: 'Note values, rests, dots, ties, subdivision'` (SEASON-2 § 4.1).
- `EDGES` gains `[8, 17]`. Lesson 15 helps but is no edge (SEASON-2 § 4.3).
- The explorer's line above its heading reads "Season 2 · Lesson 17", as decided.

### `kit/lesson-copy.ts`

```ts
17: {
  tease: 'Same written bar, played twice. Only the tempo changes.',
  teaseAlts: [
    { id: 'shapes', text: 'Same five notes, twice as fast: the note shapes change.' },
  ],
},
18: { tease: 'Now you can read when each note comes, and where it sits.' },
```

Lesson 17's tease and its alternative are 55 characters each, and Lesson 18's is 57. Lesson 17's
shows on Lesson 16's card, and the lead settles the two at review. The alternative is the season
plan's line cut to 70 characters or fewer, with "noteheads" made "note shapes" (FACTS 5b). Lesson
18's own writer may propose a different tease for 18. No hook alternatives.

### `kit/team-notes.ts`

- `SIGNATURES[17]`: "Lesson 8's beat pads grow noteheads and stems, halve into eighths, join into half notes, and lift onto one line, then the staff."
- `TEASE_NOTES[17].shapes`: "The season plan's tease, from Lesson 16's article plan, cut to fit a card and made true: it sets up Step 2's same seconds written two ways rather than the cold open, and quarter and eighth notes share a filled head, so it says note shapes, not noteheads."

### `kit/drafts.ts`

- `learn/17.html` once a page exists. Nothing now.

## Kit and app work the page waits for

WEB-SPEC, "What the kit and the app still need", items 1 to 12. The main ones:

1. Seasons in the kit.
2. The head. Proposed title: "Note values: whole, half and quarter notes | MercuryPitch" (57
   characters). Proposed description: 159 characters, saying nothing about tempo or seconds. On
   release, the head also needs the sitemap, `llms.txt`, `STANDALONE_DOCUMENT_PATHS` and the
   first-paint budget.
3. Rhythm on the staff, including:
   - rests placed by the 4/4 rules;
   - flags that join into a beam as the beat's last note sounds;
   - the stopwatch strip and its rule for narrow cells.
4. The staff toy with the F clef. On the bass staff, A3 takes stems down, ties above and its dot
   above the top line.
5. The tap take in the kit.
6. The rhythm bar's controls.
7. Move the note.
8. The pitch-line view of a rhythm.
9. The lesson plumbing for 17.
10. The voice-choice words shared with Lesson 15.
11. **The woodblock in the kit.** This is the Ear Lab's `wood` voice. The Ear Lab sends it straight
    to the output; the kit must book it on a run's bus instead.
12. **The `'rhythm'` explorer figure.**

Also:

- The `ear-drill` launch kind (SEASON-2 § 5.2 item 12), then a subset of The Chart: `c-q3`, `c-q4`,
  `c-q-rest`, `c-e-and`, `c-e-one`, `c-e-off`, `c-e-run` and `c-e-across`. Every value in it is one
  this page plays and writes.
- App content, for the Ear Lab's owner:
  - The `PULSE_TIMING` comment in `src/lib/ear/timing.ts` (lines 127 to 128) still says a soft rail
    ticks while the take waits. In fact the anchored take is silent there.
  - The Chart writes its "rest on 2" pattern as a half note, with no rest (FACTS 44).

## Corrections to the planning record (not edited; noted in FACTS)

- RESEARCH R17-15 says soft rail ticks play while The Chart waits for the first tap. At
  `c60f0fdcb` the wait is silent (FACTS 40).
- ARTICLE-PLAN's coach note (line 179) says "eight onsets". The two bars hold nine notes (FACTS 36).

## Departures from ARTICLE-PLAN.md, and why

The WEB-SPEC's Contract lists all fourteen, and each is argued in FACTS:

1. **A3 or A4, not C3 or C4.** The voice buttons name A3 and A4, which sit well inside every preset
   and both staves. The cost is that A3's stems point down on the bass staff, and the spec draws
   them so.
2. **The cold open's first play writes its bar.**
3. **The recall asks Lesson 8's questions 2 and 4.** Question 1's right answer would answer the
   predict.
4. **Step 3's counts light up; Merc does not say them.** The page plays no speech.
5. **The checkpoint lines up the taps** from two bars of beat taps, with Lesson 8's 120 ms window.
   Its line counts the notes met, and ticks show early and late.
6. **Nine notes, not eight.**
7. **Brackets for held and silent beats**, as in Open Music Theory.
8. **Step 4 writes its own rests**, placed by the 4/4 rules.
9. **Step 2 adds Play both**, now as whole bars.
10. **The practice card** describes the silent wait and says that only triplets come later.
11. **Go deeper keeps Takadimi and "1 e and a".** The British names stay in Step 1; the semibreve
    item and the counting-study item are out.
12. **A new tease**, with the plan's line as the alternative.
13. **Hear the bars**, offered after a take.
14. **The pitch-line switch** is on the rhythm bar only. It is not on the hero, the words or the
    checkpoint.

Now as the plan has them: the woodblock, Step 1's five bars played then written, Step 3's bar of
eighths with its fading count, and Step 5's dotted quarter.

## Open questions

- **Lead:**
  - Lesson 17's tease, or its alternative.
  - Whether this page adds Lesson 15's line "Your staff follows your choice: the bass clef for the
    lower voice, the treble clef for the higher." under its voice buttons. It costs 17 words, and
    there is room for them.
  - The two cuts the build needs. It counts the hints and status lines, about 150 words, so it would
    otherwise run about 80 words over the cap. The cuts: the Go deeper drawer (70 words) and the
    mix-up card's second piece of evidence (32 words).
- **Coach:**
  - A3 and A4 as the sung notes, and how the presets are grouped.
  - A breath inside the bars, at the end of bar 1's half note.
  - "doo" as the syllable.
  - The new lines: Your turn's sentence on moving the note, and "Then, if you like, sing it. This
    part is optional, and nothing listens."
  - Move the note's readout.
- **Owner:** none.

## Review response

The review is `17-REVIEW.md`. Everything was fixed; no finding was kept unchanged.

### Blocking

1. **Fixed.** Tavi now says the plan's sincere guess, word for word: "A quarter note must be a set
   length of time. Isn't that what the name says?" The guess voices the misconception and holds no
   number. The bubbles show from the start and come before the play button. Step 2's "Tavi's guess
   was half right" and the reveal's "a fair guess" are now true. Updated: FACTS 1a and 18, WEB-SPEC
   Toys 2 and Merc and Tavi, the Contract, and the CURIOSITY-MOMENTS entry above.

### Should fix

2. **Fixed.** The recall now asks Lesson 8's question 4 in place of question 1, so it asks 2 and 4.
   Neither says how long a beat lasts, and Lesson 2's opening order is unchanged. Updated: FACTS 1a
   and 7, and WEB-SPEC Sections and Toys 9.
3. **Fixed, as the lead decided.** The click is now the Ear Lab's woodblock, its default `wood`
   voice. Beat 1 is pitched higher at 1,575 Hz, Lesson 8's ratio of 1.5; this is a spec choice, set
   by ear on a phone. The kit takes the voice onto a run's bus (kit item 11). Updated: FACTS 62, and
   FACTS 75 is replaced. The Contract no longer lists the woodblock as a departure. The preamble,
   Audio and this note are corrected.
4. **Fixed.** Dot now also turns bar 2's two quarters into a dotted quarter and an eighth, the
   plan's example; the strip reads "1.5 s" and "0.5 s". Tie with Dot on makes a sound of "2.5 s".
   Added to Tests 1 and 3 and to FACTS 45 and 66.
5. **Fixed.** On the bass staff A3's stems point down, its ties curve above and its dot sits above
   the top line. On the treble A4's stems point up and its ties curve below. The stems come from Open
   Music Theory 1.2; the ties and dots from Wikipedia's "Tie (music)", after Read 1969, and "Dotted
   note". All three are cited in FACTS 29, which also covers the stems flipping on the slide. FACTS
   74 is replaced, the Contract weighs the cost of A3, and Tests 2 gains the engraving.
6. **Fixed.** Step 5 carries only Step 4's heard bar onto the staff. Its own two bars are written by
   their first play, whether that is Play, Dot or Tie (Toys 5).
7. **Fixed.** FACTS 26a adds Williams's rules for rests. The half-rest example now stands on beat 3,
   followed by the next bar's quarter. A silent beat is one quarter rest, and the model keeps its
   notes. A half rest comes only from beat 1 or 3, and beats 2 and 3 never share one. Added to Tests
   1 and 2.
8. **Fixed.** Free play is now one bar of pads, with Step 5's staff under it. In two-bar figures the
   beats only light, with no buttons, so every target is at least 44 px. Dot and Tie keep their fixed
   places. Updated: FACTS 70.
9. **Fixed.** Narrow cells now have a rule (Toys 6):
   - a run of equal notes inside a beat reads once, for example "4 × 0.25 s";
   - a lone narrow note reads on a second row;
   - in the rest examples, only the rest's cell reads.

   Tests 3 checks it at 390 and 344 px.
10. **Fixed.** Play both is now one bar at 60 BPM and two bars at 120, 4 s each, on one time axis;
    both strips read 0.5, 0.5, 1, 0.5, 0.5 and 1 s. The words' tickets are now said to have no time
    signature and no bar line (Toys 4, FACTS 65).
11. **Fixed.** The entry is now `label: 'Ear Lab'`, `note: 'then tap The Chart'`, citing
    `practiseMarkup`.
12. **Fixed.** The tease is now "Same written bar, played twice. Only the tempo changes."
13. **Fixed.**
    - Departures: the Contract now lists fourteen. (a) and (e) are resolved by restoring the plan.
      For (b), Step 1 gains Play the halvings, the plan's five bars played then written, and flags
      visibly join into beams. For (c), Step 3 plays a bar of eighths before its own bar, with the
      counts lit rather than spoken (FACTS 75). For (d), the fade on the second play is restored.
    - The coach's list gains the opening line of the sung part, the adapted sentence on moving the
      note (new FACTS 57a), Move the note's buttons and readout, and the sung part's status lines.

### Nits

1. **Fixed.** Each case Join cannot handle has its own hint.
2. **Fixed** in Lesson 8's form, "Notes with a tap: 7 of 9.", so no sentence starts with a digit.
   The two clauses about the notes on "and" are skipped when no note got a tap. The simulation was
   re-run and FACTS 35 updated.
3. **Fixed.** The figure is 21 s.
4. **Fixed.** The text now says "as The Chart lets you hear its bar after you answer". FACTS 40 says
   the replay comes only on request, after the answer, and sounds clicks.
5. **Fixed.** "are like those of North Indian tabla playing".
6. **Fixed.** The text now says "two flags", "2 seconds" and "1 second". "as in Lesson 8" was
   dropped to keep Step 1 within 120 words.
7. **Fixed.** No "hand-back" or "brief" is left in the lesson files, and the script is named
   `sim17.mjs`.
8. **Fixed.** The spec now says which toys carry the pitch-line switch and why the checkpoint has
   none.
9. **Fixed.** The over-count is now stated plainly: as built, the page would be about 2,460 words,
   with two cuts of about 100 words named (WEB-SPEC Length, FACTS 3).
10. **Fixed.** `STANDALONE_DOCUMENT_PATHS` is added to item 2.
11. **Fixed** for now. FACTS 52 now describes Lesson 15's draft, and the lead reconciles the two
    (open question above).
12. **Fixed.** The text now names the values: quarters, halves, eighths and dotted quarters, with
    quarter and eighth rests. All of them are now played on the page.
13. **Fixed.** The 4/4 is written with the first note heard (Toys 1 and 2, the cold open, FACTS 64).
14. **Fixed.** The clef and notes are now named: Lesson 18's opening line, in the learner's clef.
    The still does not play, because Lesson 18 sounds that line only after its own predict, so a
    play here would give a clue. This is stated in Toys 11, the Wrap and FACTS 5.
15. **Fixed.** The Try lines in Steps 4 and 5 now say "listen", and Step 1's Try asks only for
    presses.
