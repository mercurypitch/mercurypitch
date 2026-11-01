# Lesson 19 hand-back: Threes, offbeats and syncopation

For the lead. The package is in the worktree at
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/19-threes-offbeats/`, with copies of the three
files in `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/19/`.
This note was rewritten after the fix pass; its last section answers the review finding by finding.

## Files and checks

- `FACTS.md` (facts 1 to 79, with 1a, 5a and 5b), `LESSON.md` and `WEB-SPEC.md`. RESEARCH.md and
  ARTICLE-PLAN.md are untouched. No shared file and no code was edited. No git, no pnpm.
- Word count (`node scripts/lesson-words.mjs`): **1,780 words, 599 under the cap of 2,379.** Each
  step's own text: 119, 120, 94 and 115 words. A built page adds about 150 (hints and status lines),
  so about 1,930, under the 2,230 aim; no cut is needed. The chip reads **12 minutes**: 7.48 minutes
  of reading and about 4.98 of sound and tasks (FACTS 3).
- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/19-threes-offbeats`: **149
  citations read, 0 findings.**
- App claims read again at `c60f0fdcb`: Subdivide's ten patterns, its voices, accent levels (1 and
  0.7), timing (a 6/8 and a 3/4 bar both 1.5 s; the replay 1.86 s), four pads and lattice; the Pulse
  bank and its picker; the notation's four-beat bars, beamed triplets with no bracket and no ties;
  Lesson 8's take judge, the estimator and the 120 ms window; Lesson 8's cold-open lead (0.6 s) and
  the beat clock's default (0.1 s); the marker (01 to 14 only); the kit's predict, tour copy and
  tour hold, menu, next card, lesson copy and hop.
- Leak check (FACTS 1a): the title, the lesson's name, the head title and description, the share
  card, the promise, the sound gate, the hero's bubbles and its one open play, the recall, the four
  words and the triplet word's figure, the step headings and the menu card, the checkpoint's "two
  taps a bar" line, the tour (held with `holdTour`, since Step 1 states the answer), the explorer
  card, both teases and the still on Lesson 18's card.
- The judge figures come from a simulation that imports the app's own modules (`METRE_PATTERNS`,
  `SUBDIVIDE_TIMING`, `PULSE_BANK`, `readRhythm`, `judgeTake`, `estimateDrumInputLatency`) and runs
  them on Subdivide's patterns, the bank, the page's bars and tunes and seeded takes. A reviewer can
  re-run it with
  `node --experimental-strip-types /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/19-tools/sim19.mjs`
  from `/dev/shm/s2plan`. The lesson files name it `sim19.mjs` and give no path.
- Sources read on 1 November 2026 beyond RESEARCH: Open Music Theory 2e 1.10 and 1.11 again
  (compound meter, the 8 as the division, beaming, tuplets, the triplet count "1-la-li", syncopation)
  and 1.2 (stems); Sharkey 7.2.03 (the beat number, then "triplet" in two syllables, which supports
  "1 trip-let"); Williams 2023, "Tied Notes" (beat 3 kept visible in 4/4); Wikipedia "Stem (music)"
  (beamed stems); and the 1881 _Franklin Square Song Collection_, p. 69, read as the Internet
  Archive's page image: "Row Your Boat (Round.)", E. O. Lyte, in 6/8. Downloads went to
  `/dev/shm/s2dl/19/` and were deleted.

## Entries for the shared files

### MASTER-PLAN § 11

- Lesson 19: a written lesson, text only, reviewed once and fixed, in
  [`lessons/19-threes-offbeats/`](lessons/19-threes-offbeats/) (research, article plan, facts, copy
  and page spec). Nothing on it is sung, so it waits on no vocal coach. No page is built yet. It waits
  on Season 2's kit: seasons, the staff toy with both clefs, rhythm on the staff in 6/8, 3/4 and 2/4
  with triplets and ties, a row of six pads, the tap take in the kit with a click that can stop,
  Subdivide's drums and the Ear Lab's woodblock as kit sounds (SEASON-2 § 6.2 items 1 to 3), a tour
  line for a page with nothing sung, and the lesson plumbing for 15 to 28 (SEASON-2 § 5.2 item 21).
  It goes live when the console publishes it, once `/learn/17`, the page its chip and its recall link
  to, is live.

### CURIOSITY-MOMENTS

```markdown
### Lesson 19 · Threes, offbeats and syncopation · theory; written; no page yet · hook kept

- **Opening:** six of Lesson 8's pads in a row, ungrouped. Tavi "Group six notes in twos and
  you'll feel two beats, surely?" Merc "Let's group them both ways and listen." Play six notes
  sounds twelve even hi-hats a third of a second apart. Predict: "Merc groups the six two ways: in
  threes, 3 + 3, and in twos, 2 + 2 + 2. Which way will feel like two beats?" [In threes] [In twos];
  the two groupings play on Subdivide's drums, and the reveal waits for both.
- **Visual:** the six pads with arcs drawn as each group starts, and the bar written as 6/8 or 3/4
  above them (new: SEASON-2 § 6.2 item 3, generalised past four beats); Merc and Tavi hop on the kick
  and the snare (exists). **Payoff:** the reveal, then Step 1's 6/8 · 3/4 switch; the checkpoint,
  the beat tapped under a 6/8 tune and a 3/4 tune, the second time without the click.
- **Tease:** a still of Lesson 20's stage, nine beads on the pitch line, nothing lit, which does not
  play: "Merc sings a run of nine notes, five every second."
- **Facts:** sourced in Lesson 19's FACTS: simple and compound metre, beaming, triplets and
  syncopation (Open Music Theory 2e, 1.9 to 1.11), counts (Musical U; Sharkey; Takadimi, Hoffman,
  Pelto and White 1996), the 6/8 print of "Row, row, row your boat" (Franklin Square Song
  Collection, 1881, p. 69), ties at beat 3 (Williams 2023), the exam grades (ABRSM 2023); the app at
  `c60f0fdcb`.
```

Lesson 18's entry, when it is written, carries this lesson's tease as its **Tease** line, with its
still: six pads, ungrouped, no arcs, nothing written, as on the share card, which does not play.

### `kit/season.ts` (Season 2's module, once SEASON-2 § 6.2 item 1 makes one)

```ts
{
  n: 19,
  lane: 'theory',
  title: 'Threes, offbeats and syncopation',
  short: 'Threes and offbeats',
  topics: ['T08'],
  minutes: 12,
  page: '/learn/19',
  hook: 'Six notes in a bar, grouped two ways: why does one feel like two beats and the other like three?',
  pr: {
    needs: 'Subdivide with only 3/4 and 6/8 (an ear-drill link)',
    link: {
      href: '/ear-lab?lesson=19',
      addr: 'mercurypitch.com/ear-lab',
      label: 'Ear Lab',
      note: 'then tap Subdivide',
    },
  },
  // fig: six ungrouped pads, once the kit draws a pads or rhythm figure (WEB-SPEC, Explorer)
},
```

- `TOPICS` gains `T08: 'Simple and compound metre; triplets; syncopation'` (SEASON-2 § 4.1).
- `EDGES` gains `[17, 19]` (SEASON-2 § 4.3: Lesson 17 only; Lesson 8 through it).
- The explorer's line above its heading reads "Season 2 · Lesson 19", as decided.

### `kit/lesson-copy.ts`

```ts
19: {
  tease: 'Same six notes, same speed. Only the accents move.',
  teaseAlts: [{ id: 'written', text: 'Every bar written this season has had four beats.' }],
},
20: {
  tease: 'Merc sings a run of nine notes, five every second.',
  teaseAlts: [{ id: 'plan', text: 'Squeeze three notes into a beat, then four, then more.' }],
},
```

Characters: 50 and 49 for Lesson 19's, 50 and 54 for Lesson 20's, inside `TEASE_MAX` (70). Lesson
19's shows on Lesson 18's card; Lesson 20's on this page's. Lesson 20's own writer may propose
another. No hook alternatives. The lead settles both at review.

### `kit/team-notes.ts`

- `SIGNATURES[19]`: "Lesson 8's six pads, regrouped: 3 + 3 makes two beats, 2 + 2 + 2 makes three; then a beat splits in three and a note leaves beat 3 for the and."
- `TEASE_NOTES[19].written`: "Lesson 18's planned tease, 'Every bar so far has walked in twos and fours.', is false: Lesson 8 played bars of 2, 3 and 4, and Lesson 17's recall plays bars of three again. This line claims only what Season 2 has written: Lessons 15 and 16 write no bars, and Lessons 17 and 18 write only 4/4."
- `TEASE_NOTES[20].plan`: "The season plan's tease: it fits and leaks nothing, but it sets up subdivision rather than Lesson 20's opening, a run sung fast and slow."

### `kit/drafts.ts`

- `learn/19.html` once a page exists. Nothing now.

## Kit and app work the page waits for

1. Seasons in the kit (SEASON-2 § 6.2 item 1).
2. The head: title, description (158 characters, with "with sound toys") and share card (WEB-SPEC,
   What the kit and the app still need, item 2).
3. Rhythm on the staff generalised past four-beat bars: 6/8, 3/4 and 2/4, beams by beat, dotted
   quarters and halves, a beamed triplet with its 3, a tie at beat 3, counts with brackets. The app's
   `readRhythm` writes only four-beat bars and no tie (FACTS 52, 56).
4. The staff toy with both clefs, for Step 2's tunes.
5. A six-pad row with arcs in the kit's beat row (Lesson 8's row has four pads), and six cells to a
   bar in the compact strip, `kit/beat-strip.ts`, for the hero.
6. Subdivide's drums in the kit, booked through the beat clock.
7. The tap take in the kit, as Lesson 17 moves it there, generalised: any backing sound, a click that
   stops for the judged pass, beats as onsets, and the other-metre clause (WEB-SPEC, Toys 7).
8. The Ear Lab's woodblock in the kit (Lesson 17's item).
9. The hop: the page imports `kit/merc-hop.ts` and books the two groupings with Lesson 8's lead of
   0.6 s and their hops `HOP_MS` early (`lesson-08/cold-open.ts:163-165`), so the first hop lands on
   the first kick (FACTS 57).
10. **New:** the tour's first stop on a page with nothing sung (`kit/tour-copy.ts:38-42`, spec only):
    a second body, chosen by a list of such lessons as `LISTENING_LESSONS` chooses the microphone
    line, with 19 in it, for example "They teach every lesson. Listen along, then try each idea
    yourself." Optional: a "Your turn to tap" stop lighting `#tap` (WEB-SPEC, What the kit and the
    app still need, item 13). Lesson 21's page may need the same.
11. The lesson plumbing for 15 to 28 (SEASON-2 § 5.2 item 21), the marker's reach to 19 among it.
12. Lesson 17's page, for the recall's two imported questions and the chip's link.
13. Later: the `ear-drill` launch kind (SEASON-2 § 5.2 item 12) and Subdivide's subset,
    `metre:3-4:a`, `metre:3-4:b`, `metre:6-8:a` and `metre:6-8:b`; a `fig` kind for the explorer.

## Departures from ARTICLE-PLAN.md, and why

1. **Sound gate**: "how notes are grouped", not "how beats are split", which leans towards the
   answer's reasoning (FACTS 1a).
2. **Four words**: accent, offbeat, triplet, syncopation. The plan's simple and compound metre
   definitions answer the predict and sit where a learner reads them before choosing; Step 1 names
   both after their sounds (FACTS 20).
3. **Recall**: Lesson 17's questions 3 and 2. The plan's second question, Lesson 8's question 2, is
   one Lesson 17's own recall already asks; Lesson 17's question 1 is Lesson 18's recall, and its
   question 4 leans towards the predict (FACTS 7).
4. **Cold open**: hi-hats for the ungrouped play; Subdivide's 6/8 drums for in threes (snare on 4,
   the lead's answer 2) and the same rule for in twos; Merc and Tavi hop where the plan has Merc's
   foot tap; Merc says "listen", not "tap along", since the hero takes no taps (FACTS 18, 58, 64).
5. **Tavi voices the misconception in Step 1** ("Six on top means six beats a bar, doesn't it?"),
   since the cold open's guess is about grouping (FACTS 19).
6. **Step 2**: heading "How do you count 6/8?" (Tavi asking Merc); the 3/4 tune's third bar is six
   eighths in pairs, the 6/8 tune's third bar regrouped, so the 3/4 tune holds the eighths its "and"s
   count (FACTS 30); "1 la li" named in the step, Takadimi in Go deeper (FACTS 23, 25); the round
   "Row, row, row your boat" named, not played, after reading its 6/8 print (FACTS 29); counts light,
   Merc does not speak them (FACTS 75).
7. **Steps 3 and 4 at 60 BPM, not 80**: a triplet's notes then come a third of a second apart, the
   6/8 tune's eighths (FACTS 38).
8. **Step 3**: the triplet carries a 3 and no bracket, as beamed triplets are written; the plan's
   second example, Pulse's "triplet on 1", is left to the practice card (FACTS 41).
9. **Step 4**: the held note is an eighth tied to a quarter (beat 3 visible; the plan had it the other
   way round); a note moved by a switch, not a clap dragged, since a clap cannot be held and a drag
   scrolls a phone; the offbeat claps move to the four words; "the bar leans forward" is dropped, no
   source (FACTS 43, 44, 66, 74).
10. **Checkpoint**: each tune plays twice, with the click and then without; the first pass lines the
    taps up, the second is judged; the line counts beats met and taps between, and names the other
    metre's beats when most extra taps fall there (FACTS 31 to 37).
11. **Quick check**: question 1 asks what a bar of 6/8 holds, not what "most listeners feel" (no
    source); question 2 plays Subdivide's second 6/8 pattern, so the sound is the drill's and the
    answer 6/8; questions 3 and 4 reworded (FACTS 69, 76).
12. **Teases**: both new (below). **Chip**: 12 minutes, not 13.

## Corrections to the planning record

- **R19-13** says none of Pulse's patterns holds a note across a beat. True of the clicks Pulse
  plays; but The Chart writes "mixed" with a note on "3 and" held over beat 4 (FACTS 53).
- **R19-14**'s metre is now verified from the 1881 print; "first printed" is still not claimed
  (FACTS 29, 73).
- **The card's signature** asks for a triplet "with the bracket drawn over them"; a beamed triplet
  takes its 3 and no bracket, as the app draws it (FACTS 41).
- **Lesson 18's planned tease** for this lesson, "Every bar so far has walked in twos and fours.", is
  false: Lesson 8's bars were of 2, 3 and 4, and Lesson 17's recall plays bars of three (FACTS 5b).

## Questions

For the owner: none open. For the lead at review, the two teases:

- This lesson's, on Lesson 18's card: "Same six notes, same speed. Only the accents move."
  Alternative: "Every bar written this season has had four beats."
- Lesson 20's, on this page's card: "Merc sings a run of nine notes, five every second."
  Alternative, the plan's: "Squeeze three notes into a beat, then four, then more."

## Review response

The review (`19-REVIEW.md`) had 0 blocking findings, 5 should-fix and 16 nits. All five should-fix
findings are fixed, on the lead's calls, and all sixteen nits are taken, nit 15 by its second
option. Nothing is left.

1. **S1, the 8 in 6/8.** Fixed on the lead's call 1. Step 1 now opens with Lesson 17's rule, kept
   true for 4/4: "In 4/4 the top number counts beats and the bottom names the beat's note." Then, in
   Open Music Theory's terms: "In 6/8 both numbers are about eighth notes: six of them, in two groups
   of three. Each group is a beat, a dotted quarter split in three, so the 8 names the split, not the
   beat." To keep Step 1's own text at 119 words, "three eighths long" went, and "dotted crotchet"
   moved into Step 1's mix-up card, "each a dotted quarter (in Britain, a dotted crotchet)", still
   named once in the step that introduces it. FACTS 12 cites OMT 1.10 ("the bottom number (8) means
   that the eighth note is the division.") and Lesson 17's rule (`17-note-lengths/LESSON.md:144-145`);
   FACTS 8 moved with the British name.
2. **S2, the false alternative tease.** Fixed on the lead's call 2. The alternative is now "Every bar
   written this season has had four beats." (49 characters, `teaseAlts` id `written`). I checked it:
   Lessons 15 and 16 write no bars, and Lessons 17 and 18 write only 4/4 (Lesson 18's plan, line 7;
   Lesson 17 FACTS 65 and 66). FACTS 5b, the LESSON preamble, WEB-SPEC (Explorer and season data,
   Decisions) and the team note are corrected; both teases stay in this note for the lead.
3. **S3, the tour's opening line.** Fixed on the lead's call 3, as spec only. I read
   `kit/tour-copy.ts` at `c60f0fdcb`: its first stop says "Listen to them sing, then sing along with
   them when it's your turn." (:41), false on this page. WEB-SPEC adds kit item 13: a second body for
   a lesson with nothing sung, chosen by a list as `LISTENING_LESSONS` chooses the microphone line,
   with 19 in it, for example "They teach every lesson. Listen along, then try each idea yourself.";
   the "Your turn to sing" stop already drops out, since the page has `#tap`, not `#sing` (:6-8); an
   optional "Your turn to tap" stop for `#tap`. FACTS 60, WEB-SPEC Toys 3 and the kit list here say
   so.
4. **S4, the hero's first hop.** Fixed on the lead's call 4. Play in threes and Play in twos now
   start 0.6 s after the press, Lesson 8's lead, with their hops booked `HOP_MS` early
   (`lesson-08/cold-open.ts:163-165`; the beat clock's default lead is 0.1 s, `kit/beat-clock.ts:188`):
   the first hop starts 0.07 s after the press and lands on the first kick at 0.6 s. Play six notes,
   which has no hop, keeps 0.1 s. The hops are at least 0.67 s apart, longer than a 530 ms hop.
   Rechecked: each grouping now ends 4.6 s after the press, Play six notes 4.1 s; the cold open's
   share of the run time moves from 34 to 36 s, and the recall lost its 4 s play (point 6), so the
   total stays 299 s and the chip 12 minutes. FACTS 3, 57 and 64, WEB-SPEC Toys 2, Audio, Merc and
   Tavi and kit item 9 are updated.
5. **S5, Colley.** Fixed on the lead's call 5. The page says "young schoolchildren taught a count that
   told twos from threes improved more at recognising rhythms than children taught one that didn't",
   a comparison of gains, as the abstract says. FACTS 26 keeps the grade, Weak to Moderate, abstract
   only.
6. **Nit 1, "Row" counts and title.** Taken. Step 2 now says "prints the round "Row, row, row your
   boat" in 6/8: each "mer-ri-ly" fills one beat, "1 and a", then "2 and a"", quoting the lyric, not a
   title the book does not use. To keep Step 2 at 120 words, "Now two tunes" became "Two tunes".
   FACTS 29 updated.
7. **Nit 2, the Tavi line precedent.** Taken: WEB-SPEC now cites Lesson 15's Step 2, which a Tavi line
   heads, in place of Lesson 17, which has none.
8. **Nit 3, quick check 3's figure.** Taken: deleted from FACTS 61.
9. **Nit 4, the pitch-line view.** Taken: only Step 2's staff has it, as SEASON-2 § 1.4 item 1 asks of
   staff toys; Steps 1, 3 and 4 show their pads. WEB-SPEC Toy 1 now agrees with the step states and
   LESSON's toy lines.
10. **Nit 5, when Step 2's tunes are written.** Taken: each tune is written as it first sounds and
    stays written for the visit; until it has played, its staff shows only the clef and time
    signature (WEB-SPEC Toys 5).
11. **Nit 6, status lines with two Start buttons.** Taken: "Stopped. Press a Start button to tap
    again." and "Turn sound on, then press a Start button." (LESSON, WEB-SPEC Toys 7 and Edge cases,
    FACTS 37).
12. **Nit 7, quick check 2's new cue.** Taken by its second option: FACTS 69 says the cue is new on
    purpose, a 6/8 bar the learner has not heard, marked by a second kick, as Subdivide will play it.
    The page itself is unchanged.
13. **Nit 8, the first line's condition.** Taken: FACTS 34 now says "not lined up, fewer than five
    taps from the first time through agreeing within the estimator's radius".
14. **Nit 9, the two delay limits.** Taken: FACTS 35 and WEB-SPEC Edge cases now give the two causes,
    the 250 ms cap plus the 120 ms window for 6/8, and half of 3/4's beat, 333 ms.
15. **Nit 10, the head description.** Taken: "Six notes in a bar, grouped two ways: why does one feel
    like two beats, the other three? A 12-minute lesson on 6/8, triplets and syncopation, with sound
    toys." (158 characters), in WEB-SPEC item 2 and FACTS 1a.
16. **Nit 11, the still on Lesson 18's card.** Taken: six pads, ungrouped, no arcs, nothing written,
    as on the share card, not playing; in FACTS 1a and 5b and in this note (CURIOSITY-MOMENTS).
17. **Nit 12, the recall.** Taken on the lead's call 6. The recall is now Lesson 17's questions 3 and
    2, the dotted half and a quarter note's length at 120 BPM, both imported, with "Try Lesson 17,
    Step 5 again" and "Try Lesson 17, Step 2 again". Question 2 sets up Step 3's tempo-to-seconds
    sentence. Left out: Lesson 8's question 2, which Lesson 17's recall asks; Lesson 17's question 1,
    which is Lesson 18's recall; and its question 4, whose feedback, "1 and 2: two short notes, then
    a longer one.", shows two notes filling a beat and leans towards the predict's answer. Neither
    chosen question says how notes group into beats (FACTS 1a, 7). The section is now "Recall from
    Lesson 17"; the LESSON preamble, WEB-SPEC Sections, Toys 9 and Contract are updated.
18. **Nit 13, the order of the groupings.** Taken: the stage direction says "in threes, two groups of
    three; in twos, three groups of two" and "twice a bar in threes and three times in twos".
19. **Nit 14, two more items read before the choice.** Taken: FACTS 1a lists the triplet word's
    written figure, which answers the predict only if a group of three is known to be a beat, said
    first in the reveal; and Tap the beat's "two taps a bar in the 6/8 tune and three in the 3/4
    tune", which needs to know that 6/8 groups its eighths in threes, said first in Step 1.
20. **Nit 15, the dotted half.** Taken by its second option: Step 2 is at 120 words, so FACTS 13's
    "where used" now says the tunes' dotted halves are shown by their counts, "1 (2)" and "1 (2 3)",
    and the copy does not give their length in words.
21. **Nit 16, the kit list.** Taken: this note's kit list and WEB-SPEC now carry the tour line (item
    10 here, 13 there), the groupings' 0.6 s lead (item 9) and six cells to a bar in
    `kit/beat-strip.ts` (item 5).

Also fixed on the way: three facts (30, 41 and 53) held a `|` inside quoted text, which broke the
table's columns; their quotes now use other separators.
