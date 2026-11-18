# Lesson 28, Cadences, form and a song in two parts: hand-back (after the fix pass)

Package: `docs/plans/find-your-pitch/lessons/28-cadences-form/` in the worktree `/dev/shm/s2plan`:
FACTS.md, LESSON.md and WEB-SPEC.md. RESEARCH.md and ARTICLE-PLAN.md are untouched. Each file is
copied to the scratch folder `s2pkg/28/`. No shared file, no code and no other lesson's file was
touched. No git and no pnpm were run, only the two node scripts. The arithmetic is in
`/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/28-tools/verify28.py`
(run with `python3 -I verify28.py`), sections 1 to 11; the package cites it by name only. This
version follows the fix pass on the independent review (1 blocking, 9 should fix, 13 nits) and the
lead's calls; § 0 says what changed.

## Counts

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/28-cadences-form`: 0
  findings, 332 citations read.
- `node scripts/lesson-words.mjs`: 2,062 words, under the cap of 2,379 by 317 and inside the 2,230
  aim. The steps' own text is 100, 104, 109 and 116 words, inside 50 to 120.
- Built page: 2,062 + the brief's 150 + 159 words of this page's own lines = 2,371, 8 under the
  cap. The 159 are the first pass's 151, less 2 for the answering plays' shorter labels, plus 1 for
  Sing it's new lock line and 9 for quick check 4's lock line (WEB-SPEC Length lists every one;
  `verify28.py`, section 11). The section lines above the headings and the kit's own hints sit inside
  the 150, as Lessons 24 and 26 count them. This pass's named cut: Step 4's "The parts sit mostly a
  tenth apart, as in Lesson 26." (10), to keep the step inside 120 with the breath sentence. The
  next cuts, named: the can't-record line (16) and the Easy or Workable line (8).
- Chip: 19 minutes: 2,371 / 238 = 9.96 min of reading (Brysbaert 2019, as Lesson 3 FACTS 61 reads
  it), plus 538.8 s (8.98 min) of sound, toys and tasks, 18.94 in all. The text's count alone gives
  17.64. Free play and the alone path's optional first turn (26.7 s) are not timed.
- Head: unchanged. The title "Types of cadence and song form | MercuryPitch" (45 characters); the
  description "How can a song sound as if it's ending, then keep going? A nineteen-minute lesson
  with sound toys and a song in two parts to sing." (130).

## 0. The fix pass: what changed

- **B1, route (a).** The hero's Play the song is still the song as it kept going, ten bars, 33.3 s,
  but bars 9 and 10 are now bars 1 and 2 of A again, B4 A4 | G4 B4 over G3 F♯3 | E3 G3 (verticals
  16, 15, 15, 16), and the play stops at bar 10's end. G4 over G3 sounds nowhere in it
  (`verify28.py` section 3, re-run: "G4 over G3 anywhere in the ten bars: False"). Changed with it:
  Step 2's sentence, "Bars 9 and 10 start A again." and its Interrupted play (bars 7 to 10); FACTS
  33 (with the plan's bars 9 and 10 named as the departure and why), 1a, 5b, 40 and 49; the hero's
  stage direction and LESSON.md's preamble (what the hero plays and why that answers nothing);
  WEB-SPEC Toys 1 and 2, the hero's spoken summaries, Audio rule 5, Tests 2 and 5, Edge cases and
  Page QA. Audio rule 5, Edge cases and Page QA now say that two sources sound before the choice,
  Cadence's play of bars 3 and 4 and the hero's free play, since "the only sound" would be false.
- **S1.** The stem: "Merc and Tavi sing bars 7 and 8 two ways: ending the song there, and going on,
  as you heard. At bar 8, whose note is different the second way?" [ Tavi's part ] [ Merc's part ].
  The answering plays are now Play the ending and Play it going on. Checked against route (a)'s
  hero (the second way is the one it plays) and the bound tease (no part named). FACTS 42, 43, 86;
  WEB-SPEC Toys 1 and Sections 2.
- **S2.** Sing it's staffs draw the hero's empty bars until the choice (LESSON.md's lock note,
  WEB-SPEC Toys 6, Edge cases, FACTS 1a, 46). Quick check 4, its Play and its three answers, waits
  for the choice under "Choose an answer at the top to try this.", Lesson 26's held-question line,
  and its right feedback is now true of its own play: "V went to vi, not I: it seems to end, but it
  isn't home." The Wrap's first line now says "interrupted seems to end, then keeps going", with no
  numerals (the choice I took; why in "Choices" below). FACTS 1a's chain paragraph is rewritten
  plainly: it names Lesson 12's "From V to vi, all three notes move up a step", says the first
  version gave bar 8's chord and the parts' notes before the choice and that its defence was wrong
  about the staffs, and says which links now wait.
- **S3.** The coach's list quotes the page's "Your part, read in time from the page.", and the
  voice-choice line, "Lower voices sing Merc's part, in the bass clef; higher voices sing Tavi's, in
  the treble.", sits beside the voice choice.
- **S4.** All five fixed: the reveal "and both parts landed on do"; Step 3 "ends on V, unfinished.
  Then A comes back."; quick check 1 "It stops on V and sounds unfinished."; quick check 3 "Here it
  ends on V, and A comes back."; Tavi's bubble "At bar 8 I thought we'd finished. But it went on. I
  must have missed do." A sixth, beyond the review: Tavi's Step 4 line drops the plan's opening
  "So", which also meant "therefore". FACTS 10, 41, 44, 50, 77, 79.
- **S5.** The breath marks after bars 2, 4 and 6 stay the default. Step 4, where the marks are first
  read, now says: "Breathe at the breath marks: at this slow tempo, each phrase takes a quick breath
  halfway." (116 words with the tenth sentence cut). FACTS 67 and the coach's question give the
  conflict with Lessons 14 and 18 and bar 4's mark alone as the alternative (bars 1 to 4 then 12.9 s
  on one breath); WEB-SPEC Decisions 2 says the same.
- **S6.** The alone path gains an optional first turn, [ Hear Tavi's part first ] (Merc's for the
  higher voice): the other part alone, bars 1 to 8, 26.7 s, before each run, outside any take, not
  timed. The order is § 6.2 item 7's, the page plays, then the learner sings; a learner without
  headphones hears the harmony afterwards, from the recording. FACTS 63, the preamble, the coach's
  list, WEB-SPEC Toys 6 state 8, Audio, Edge cases and Tests 12; § 3 item 3 below.
- **S7.** The playback aligns on a moment both clocks see: the take's first run of voice at least
  0.15 s long (Lesson 18's anchor) is found in the listener's frames at F, against bar 1's first beat
  B, and in the decoded buffer at offset O by the same detector; the part starts from bar 1 at P and
  the buffer is booked so O plays at P + (F - B). A late entry plays back late. The synthetic test
  (a recording that starts at a random offset before bar 1 still plays back aligned, within one
  analysis frame) is in kit item 8 and Tests 10; the lab's round-trip item stays. FACTS 62 and 38,
  WEB-SPEC Toys 6 and Audio. Nit 6 settles with it: the playback is 26.7 s from bar 1 everywhere
  (`verify28.py` section 8 changed with it).
- **S8.** "The better idea: a perfect cadence is a full stop. It ends a sentence, not always the
  story." FACTS 49 matches.
- **S9.** WEB-SPEC item 15 and § 3 item 6 below: the row splits, and Ear Lab's `lessonsPractised`
  gains 28.
- **Nits.** All thirteen taken. 1: § 3 item 1 below, in the reviewer's words. 2: Harmony Stack's
  parts are "the room's tune moved up a third or a fifth, not a written part" (LESSON.md's note,
  FACTS 74 with `targetForRole`, WEB-SPEC Practice links, § 7 item 14 below). 3: the answering plays'
  summaries give Tavi's A 4, F sharp 4, then G 4. 4: the plagal chords are "with" the held G, not
  "under" them (LESSON.md :36-37 and Step 2's toy, and the lab item; the preamble's report of answer
  1 too). 5: C3 to E4. 6: with S7. 7: "each of the first three two-bar spans is 6.25 s", bars 7 and 8
  6.67 s. 8: Brysbaert 2019 in Sources and FACTS 3, as Lessons 20 to 26 cite it. 9: `Listener.media`
  in kit item 8. 10: the fair guess now says its step, "a song that went on seems to have missed do",
  which also answers Tavi's bubble. 11: the voice choice is not asked after "Just listen today"
  (LESSON.md, the coach's list, FACTS 55, WEB-SPEC Toys 6 states 2 and 3, Edge cases, Tests 12). 12:
  the coach's list names bar 4's whole note on D3, held 2.9 s, beside the D3 question. 13: Sing it's
  lock line is "Choose an answer at the top to sing or listen here."
- **Choices inside the lead's options.** The Wrap's line is worded without numerals rather than
  held: holding it would put a lock line among "Three lines to keep" (or leave two lines under that
  heading), its lock line would cost about 10 built words against an 8-word margin, and the line
  with its numerals hands the one-sentence challenge its answer; the reveal, Step 2, its toy's tag
  and quick check 4's feedback carry V to vi. The breath sentence went into Step 4, where
  the marks are first read, with a named cut, not into Sing it. Tavi's bubble is "I must have missed
  do." rather than the review's "Did I miss do?": MERC-BIBLE gives Tavi "deep questions", "sincere
  guesses" or re-explanations, and the statement is the guess, for the wrong part, where the yes-no
  question is neither. The stem keeps the review's "the second way", which pins the comparison.
- **Not taken.** Nothing.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 27's)

- Lesson 28: a written lesson, text only, in
  [`lessons/28-cadences-form/`](lessons/28-cadences-form/) (research, article plan, facts, copy and
  page spec). Season 2's last lesson, voice and theory: the four cadences, song form as letters,
  and a scored checkpoint in which the learner reads and sings one part of a song in two parts,
  written for the lesson, in G, in their own clef, with the other part in the headphones, recorded
  on the device and played back with the other part; without headphones the page can play the other
  part first, then the learner sings alone and hears the two together afterwards, from the
  recording; an unscored sing-along without a microphone. Both gates of the vocal coach bind it
  (§ 12 item 8). No page is built yet: it waits on Season 2's kit (seasons, and a season's close per
  season, which it needs before it is built), the staff toy with two staffs and key signatures,
  rhythm on the staff, Lesson 18's in-time reader and count-in, Lesson 24's headphones and quiet
  checks, Lesson 26's part under a take, Lesson 14's recorder with the listener's stream, its own kit
  work (the song strip, the form strip, the tags, the playback aligned on the take's first sung
  note), a lab test and the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the
  lab test passes, its Sing it ships as the sing-along only. It closes the season on its own answer
  and teases nothing. It goes live after the coach's sign-off and once `/learn/18` and `/learn/26`,
  the pages its chips and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry; the predict and choices word for word)

### Lesson 28 · Cadences, form and a song in two parts · voice and theory; written; no page yet · hook kept

- **Opening:** a song in two parts written for the lesson, drawn as ten empty bars in two rows
  between Merc and Tavi, Tavi's part above in orange and Merc's below in blue, no notes; Play the
  song plays it as it kept going, ten bars, bar 8 on vi and bars 9 and 10 starting A again, where it
  stops, and works before the choice; the ending's G over G is not in it. Tavi: "At bar 8 I thought
  we'd finished. But it went on. I must have missed do." Merc: "Let's sing bars 7 and 8 both ways."
  Predict: "Merc and Tavi sing bars 7 and 8 two ways: ending the song there, and going on, as you
  heard. At bar 8, whose note is different the second way?" [ Tavi's part ] [ Merc's part ]. The two
  answering plays, Play the ending and Play it going on, unlocked by the choice, write bars 7 and 8
  on two staffs as they sound; the reveal, "Merc's part.", waits for both, and Step 2's words show
  with it.
- **Visual:** the song on two staffs, treble over bass; tags at each phrase's end naming its
  cadence (the signature); bars 7 and 8 three ways, perfect, interrupted and plagal; form letters
  gathering over four blocks, A A B A; each part a tune of its own; at the close the season's
  objects along the song's sections. **Payoff:** the reveal (to end, Merc's part leaps from D to G,
  V to I; to keep going, it steps to E, V to vi, an interrupted cadence); Step 2 (it seems to end,
  then keeps going); Sing it, one part read and sung in time, then heard with the other part (without
  headphones, after an optional turn that plays the other part first).
- **Tease:** none. The season's close: "End of Season 2", "You've read a song in two parts. Now sing
  a whole song.", Karaoke Night and the season map; after Effortful, Uncomfortable or Just listen
  today, "You've read a song in two parts." and the map alone. Lesson 28's own tease, on Lesson
  27's card, is "A song in two parts. At bar 8 it seems to end, then keeps going." (the lead's,
  bound; Lesson 28 FACTS 5b).
- **Facts:** sourced in Lesson 28's FACTS: the four cadences and their names (Wikipedia, Cadence,
  rev. 1373604555; OMT 2e 4.01), song form, AABA, the bridge, verse and chorus (OMT 2e 7.4 to 7.6);
  the song's arithmetic and ranges (`verify28.py`); the app at `c60f0fdcb` (Karaoke Night, Ear Lab's
  Cadence, the kit's close).

## 3. Shared-file entries for the lead

1. **SEASON-2 § 3, card 28, Misconception** (`SEASON-2.md:692-695`): "and songs usually end on one"
   has no source; RESEARCH's first disagreement says so, and OMT says many recordings fade out.
   Proposed, in the review's words, which keep the half of the belief that is right: "(Shown half
   right. A perfect cadence does sound final, and a song can end on one, as 'Twinkle' does in
   Lesson 14 (lessons/14-phrasing-whole-song/LESSON.md:182-184); but cadences end phrases all
   through a song, and the interrupted cadence, V to vi, seems to end, then keeps going.)". The
   card's "Facts to check" (`:711`) asks for "a song usually ends on a perfect cadence"; mark it not
   found. The lead writes it in the shared commit (answer 4).
2. **SEASON-2 § 3, card 28, Practise** (`:705-711`) and **§ 5.1, row 28** (`:844`): Jam's Harmony
   Stack is not on the page (Lesson 28 FACTS 74). Proposed row: "Karaoke Night; Ear Lab: Cadence |
   Cadence-type drill (item 19, data and code); harmony-line drill (item 17)", with a note that
   Harmony Stack is Lesson 26's card.
3. **SEASON-2 § 6.2 item 7** (`:985-990`): Lesson 28's alone path keeps the item's order, the page
   playing, then the learner singing, and adds the recording. A clause: "Lesson 28's alone path
   offers the other part first, an optional turn, then the learner sings alone and the take plays
   back with the other part, so a learner without headphones hears the harmony afterwards, from the
   recording; Lesson 26, which records nothing, sings along."
4. **SEASON-2 § 6.2 item 1** (`:964-973`): the season's end card per season is required before
   Lesson 28 is built, and the season must know its last lesson, or Lesson 14's page draws Lesson
   15's card (Lesson 15 WEB-SPEC item 3) and Lesson 28's draws none (Lesson 28 WEB-SPEC Toys 7).
5. **SEASON-2 § 3, card 27, Closes on** (`:682-683`): "the strongest way home, and songs use it to
   end" is still unsupported, as Lesson 27 FACTS 5 says; Lesson 28 does not repeat it. No change
   from this package beyond Lesson 27's entry.
6. **SEARCH § 8** (`SEARCH.md:370`, `:373`), at release: the shared row "`/karaoke-night`, `/jam` |
   14" splits into "`/karaoke-night` | 14, 28" and "`/jam` | 14" (26 too, once Lesson 26's entry
   lands, which touches the same row), and the `/ear-lab` row gains 28. The entry test
   (`src/tests/entry-page-model.test.ts:497-529`) holds the table equal to the entry pages'
   `lessonsPractised` room by room, so the same change gives Karaoke Night's entry (`src/seo/entry-pages.ts:272`)
   28 beside 14 and Ear Lab's (`src/seo/entry-pages.ts:503`, `[2, 6, 10]`) 28, and leaves Jam's
   (`src/seo/entry-pages.ts:537`) at `[14]`.
7. **The Season 2 trailer's card** (`SEASON-2.md:719-722`): the season's close line answers its
   question, "What if you could read a song you've never heard, then sing a harmony to it?", with
   "You've read a song in two parts."; if the trailer's question changes, so does the line.

## 4. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 28,
  lane: 'both',
  title: 'Cadences, form and a song in two parts',
  short: 'Cadences',
  topics: ['T22', 'T31'],
  hook: "How can a song sound as if it's ending, then keep going?",
  minutes: 19,
  // page: '/learn/28' once built; a draft until its sign-off (drafts.ts)
  pr: {
    link: {
      href: '/karaoke-night?lesson=28',
      addr: 'mercurypitch.com/karaoke-night',
      label: 'Karaoke Night',
    },
    needs:
      'A cadence-type ear drill (SEASON-2 § 5.2 item 19); the harmony-line drill (item 17)',
  },
}
```

`EDGES` gains `[18, 28]` and `[26, 28]`; `PREREQ[28]` is then `[18, 26]`. Lesson 28 is Season 2's
last lesson: the season's data must say so, so `nextCard` draws Season 2's close on it and Season
1's on Lesson 14.

## 5. `kit/lesson-copy.ts` and `kit/team-notes.ts`

- `LESSON_COPY[28]`: `{ tease: 'A song in two parts. At bar 8 it seems to end, then keeps going.' }`
  (64 characters), no `teaseAlts`, as the lead bound it on Lesson 27's review.
- Season 2's close, beside `SEASON_END` (proposed shape, one per season; the lead's answer 1 takes
  these lines, with the kit item that a close per season is required before the build): eyebrow
  `'End of Season 2'`; line `"You've read a song in two parts. Now sing a whole song."`; rest line
  `"You've read a song in two parts."`; song `{ label: 'Karaoke Night', path: '/karaoke-night' }`;
  map `{ label: 'See the season map', href: '#explorer' }`. Season 1's needs its rest line too,
  Lesson 14's kit item 12: `"You've seen every note you sing."`.
- `SIGNATURES[28]`: "A song in two parts on two staffs, Merc's lower part blue and Tavi's upper part
  orange; a tag names each phrase's cadence, and form letters gather above the sections."
- No `TEASE_NOTES` entry (no alternative tease).

## 6. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host, `learn/28.html`, in `STANDALONE_DOCUMENT_PATHS`; the draft line.
2. Seasons in the kit, with a close per season, a season that knows its last lesson, the rest-aware
   close (Lesson 14's item 12) and the masthead's season (item 3). Required before the build.
3. Lesson 18's items 4, 5, 7, 8 and 16, and this page's staff-toy additions: two staffs in one
   figure with a brace, part labels, bar numbers, tags, numerals under chosen bars, words under
   notes, the lock that draws ten empty bars in the steps' figure, free play and Sing it's staffs,
   the pitch-line view in two colours (item 4).
4. Lesson 24's checks with Lesson 26's options and this page's fail line (item 5).
5. Lesson 26's part under a take, with a breath dip added to its repeated-note dip (item 6).
6. Lesson 26's reader rule, for fourteen notes of two and four beats at 72 BPM; tests on this
   page's synthetic takes (item 7).
7. Lesson 14's `kit/record.ts`, whichever page builds it first; `Listener.media`, the listener's
   stream, which the kit's `Listener` does not expose today (`holding`, `latest`, `release`,
   `releaseNow`, `src/features/lessons/kit/listen.ts:36-45`) and Lesson 14's spec does not list;
   and the playback of a take with the other part, aligned on a moment both clocks see: the take's
   first run of voice at least 0.15 s long (Lesson 18's anchor), found in the decoded buffer by the
   listener's detector, set to the audio-clock time of the listener's first voiced frame, the part
   from bar 1 on that clock, so a late entry plays back late. The recorder gives no audio-clock time
   for its first sample (`TakeRecorder`, `src/lib/voice-capture.ts:10-22`), which is why. Tests: a
   synthetic take whose recording starts at a random offset, 0 to 3 s before bar 1, plays back with
   its first sung note where it was sung against the part, within one analysis frame; a take sung
   half a beat late plays back half a beat late; the take kept in memory only; no playback for a
   take with no voice (item 8).
8. The lab test on a phone: silence over the other part, the reader on real takes, whether real
   takes play back where they were sung and how far each device's round trip puts the voice behind
   the part, levels, the staffs at 344 to 390 px, and the chip's timing (item 9).
9. The head and share card, `PT19M` (the head test already has "nineteen"); Lessons 18 and 26's
   question modules; the lesson copy; Season 2's plumbing (§ 5.2 item 21); the cadence-type drill
   (item 19) and the harmony-line drill (item 17), the app's; at release, SEARCH § 8's split row
   and the entry pages' lists, as § 3 item 6 gives them (item 15).

## 7. Departures from ARTICLE-PLAN.md, and why

1. **The predict's stem and choices**: "Merc and Tavi sing bars 7 and 8 two ways: ending the song
   there, and going on, as you heard. At bar 8, whose note is different the second way?" [Tavi's
   part] [Merc's part]. The plan's stem said the top part reached do "just as it does when the song
   ends", which answered it (Lesson 27's finding, the brief); its choices become the two named parts
   (FACTS 42). The first version's "Which part changes its note at bar 8?" had a second reading with
   no right answer (the review's S1).
2. **The reveal**: Merc's part leaps up from D to G to end, where the plan said it "fell to G"
   (D3 to G3 rises five semitones); quick check 4's "stepped up, not down to the root" is dropped
   for the same reason (FACTS 34, 80).
3. **Tavi's bubble**, "At bar 8 I thought we'd finished. But it went on. I must have missed do.", is
   a sincere guess for the wrong part; the plan's was the misconception, which Step 2's card
   answers. Merc's line names no part (FACTS 41).
4. **The hero draws ten empty bars**, not the song on its staff, whose bar 8 would answer before the
   choice; the staffs are written by the answering plays. Its free play's bars 9 and 10 start A
   again, where the plan's sang the ending's bars 7 and 8, which put both ways in the one play that
   sounds before the choice (FACTS 33, 40, 43).
5. **The recall** asks Lesson 18's question 2, not question 1, whose "What does this lesson
   suggest?" would point at Lesson 28; Lesson 14's question 4 is not asked: it leans on the predict
   and the page is near its cap (FACTS 7).
6. **Three words**: Cadence (Lesson 14's), Section and Form. The plan's Interrupted cadence word
   ("V going to vi") and Cadence's "bars 7 and 8" play answered the predict from below it; Plagal
   moves into Step 2 (FACTS 47).
7. **Locks**: the steps' figure, Sing it's staffs, every play that sounds the song's ending (Steps 1,
   3 and 4, Sing it), quick check 4 and free play wait for the choice; Step 2's text is a second
   reveal element under a held line; the tour waits; the Wrap names the interrupted cadence without
   its chords (FACTS 1a, 46, 80). Steps 1, 3 and 4's text stays open, argued in 1a.
8. **Step 2's wording**: "seems to end, then keeps going" and "considered weak, for its "hanging"
   feeling", where the plan had "sounds like an ending and swerves", which is stronger than the
   source; bars 9 and 10 "start A again"; the plagal tag sings "ooh" with "A-men" written under it,
   since the kit sings no words; the mix-up card drops "and songs usually end on one", and its better
   idea is "a perfect cadence is a full stop", since an imperfect cadence is none (FACTS 13, 15, 35,
   49).
9. **Step 3** has no predict and no Go deeper (the Beatles song): the card's "if long" rule makes
   AABA the first cut, so AABA stays at one example and its predict goes (FACTS 50).
10. **Step 4** explains the key signature in a sentence, since Lesson 21 is not a prerequisite, and
    says why two breath marks sit inside a phrase; its line on the tenths is cut for length (FACTS
    51, 67).
11. **Step 1** drops the fade-out Go deeper and the "imperfect authentic" warning; the American
    names are said once (FACTS 20, 21, 48).
12. **Sing it**: the other part plays under the take with headphones (Lesson 26's part under a
    take); the take is recorded and played back with the other part, aligned on the take's first
    sung note (Lesson 14's recorder); after No headphones, an optional first turn plays the other
    part, the plan's "plays the other part once", then the learner sings alone and hears the two
    together afterwards, the season's turn-taking order, where Lesson 26 sings along (Lesson 26
    FACTS 62), because a recording lets the two parts meet without playing into the microphone;
    with no microphone, a sing-along. Do then the count-in, as Lesson 18, with no model run (eight
    bars would double the run). Breath marks after bars 2, 4 and 6, where the plan had 4 and 8 (bar
    8 is the end; four bars at 72 is 13.3 s in one breath), with Step 4's sentence. No Move do: a
    moved do changes the key the learner reads. The voice choice is not asked on the listening path
    (FACTS 55, 58 to 68).
13. **The quick check**: question 2 asks for the Amen cadence, so all four cadences are asked
    (question 4 asks for the interrupted by ear), where the plan asked again what V to vi is called;
    question 4 waits for the choice, as Lesson 26's question 2 does, and its feedback is true of its
    own play (FACTS 78, 80).
14. **The practice card**: Karaoke Night (Lesson 14's lines, without its "Ten minutes" line, cut for
    length) and Ear Lab's Cadence (Lesson 12's line, plus "five of its eight stop on V"); Harmony
    Stack is left out: it needs a friend, its parts are the room's tune moved up a third or a fifth,
    not a written part, and Lesson 26's card already carries it and its two open app items (FACTS 70
    to 74).
15. **The chips** name both prerequisites and read 19 minutes, from the built page; the promise says
    "four cadences", the card's objective, not "four ways a phrase can end", which plagal and
    interrupted are not in the article's classification (FACTS 2, 3, 17).
16. **The close**: Season 2's words, taken by the lead, since the kit has only Season 1's (FACTS 5).

## 8. Citations of other lessons' work

None uncommitted: Lessons 12, 14, 18, 24, 26 and 27, and every other cited lesson, are cited by path
and line at the branch head. Lesson 27's card holds this page's still; this package specifies it
(WEB-SPEC Toys 8: the ten empty bars between Merc and Tavi, no bubbles, no note), which Lesson 27's
spec leaves to Lesson 28 (`27-sevenths-inversions/WEB-SPEC.md:314-317`).

## 9. Questions: answered, and what stays open

Answered by the lead: Season 2's close takes this package's lines, with the kit item (answer 1); the
alone path stays, with the first turn (answer 2); the breath marks stay after bars 2, 4 and 6, said
on the page, with bar 4 alone as the coach's alternative (answer 3); card 28's misconception takes
the fix with the review's wording, which the lead writes (answer 4).

Open, for the coach at the script gate (LESSON.md, For the vocal coach): the breath marks, all three
with Step 4's sentence or bar 4's alone; whether a lower voice for whom D3 feels low, bar 4's whole
note held 2.9 s two semitones above the tenor's floor, is better left to listen; and the first turn
and the playback lines, which are new. The chip is 19 until the lab times the staffs' plays and the
runs; the lab may move it to 20, for which the head test also has a word.
