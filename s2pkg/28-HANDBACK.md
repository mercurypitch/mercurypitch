# Lesson 28, Cadences, form and a song in two parts: hand-back

Package: `docs/plans/find-your-pitch/lessons/28-cadences-form/` in the worktree `/dev/shm/s2plan`:
FACTS.md, LESSON.md and WEB-SPEC.md. RESEARCH.md and ARTICLE-PLAN.md are untouched. Each file is
copied to the scratch folder `s2pkg/28/`. No shared file, no code and no other lesson's file was
touched. No git and no pnpm were run, only the two node scripts. The arithmetic is in
`/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/28-tools/verify28.py`
(run with `python3 -I verify28.py`), sections 1 to 11; the package cites it by name only.

## Counts

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/28-cadences-form`: 0
  findings, 312 citations read.
- `node scripts/lesson-words.mjs`: 2,051 words, under the cap of 2,379 by 328 and inside the 2,230
  aim. The steps' own text is 100, 107, 109 and 117 words, inside 50 to 120.
- Built page: 2,051 + the brief's 150 + 151 words of this page's own lines (lock, held, status and
  fail lines, the "You said" lines, the toys' labels and tags, the close's rest line) = 2,352, 27
  under the cap. The section lines above the headings and the kit's own hints sit inside the 150,
  as Lessons 24 and 26 count them; WEB-SPEC Length lists every added line.
- Chip: 19 minutes: 2,352 / 238 = 9.88 min of reading, plus 539 s (8.98 min) of sound, toys and
  tasks, 18.87 in all. The text's count alone gives 17.60. The song's plays are long at 72 beats a
  minute (eight bars 26.7 s), which is where the time goes.
- Head: the title "Types of cadence and song form | MercuryPitch" (45 characters); the description
  "How can a song sound as if it's ending, then keep going? A nineteen-minute lesson with sound toys
  and a song in two parts to sing." (130).

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 27's)

- Lesson 28: a written lesson, text only, in
  [`lessons/28-cadences-form/`](lessons/28-cadences-form/) (research, article plan, facts, copy and
  page spec). Season 2's last lesson, voice and theory: the four cadences, song form as letters,
  and a scored checkpoint in which the learner reads and sings one part of a song in two parts,
  written for the lesson, in G, in their own clef, with the other part in the headphones, recorded
  on the device and played back with the other part; without headphones the learner sings alone
  and hears the two together afterwards; an unscored sing-along without a microphone. Both gates
  of the vocal coach bind it (§ 12 item 8). No page is built yet: it waits on Season 2's kit
  (seasons, and a season's close per season, which it needs before it is built), the staff toy with
  two staffs and key signatures, rhythm on the staff, Lesson 18's in-time reader and count-in,
  Lesson 24's headphones and quiet checks, Lesson 26's part under a take, Lesson 14's recorder, its
  own kit work (the song strip, the form strip, the tags, the playback with a part), a lab test and
  the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the lab test passes, its
  Sing it ships as the sing-along only. It closes the season on its own answer and teases nothing.
  It goes live after the coach's sign-off and once `/learn/18` and `/learn/26`, the pages its chips
  and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry; the predict and choices word for word)

### Lesson 28 · Cadences, form and a song in two parts · voice and theory; written; no page yet · hook kept

- **Opening:** a song in two parts written for the lesson, drawn as ten empty bars in two rows
  between Merc and Tavi, Tavi's part above in orange and Merc's below in blue, no notes; Play the
  song plays it as it kept going, ten bars, and works before the choice. Tavi: "At bar 8 I thought
  we'd finished. But it went on, so I can't have landed on do, can I?" Merc: "Let's sing bars 7 and
  8 both ways." Predict: "Merc and Tavi sing bars 7 and 8 two ways: the way the song ends, and the
  way it kept going. Which part changes its note at bar 8?" [ Tavi's part ] [ Merc's part ]. The two
  answering plays, unlocked by the choice, write bars 7 and 8 on two staffs as they sound; the
  reveal, "Merc's part.", waits for both, and Step 2's words show with it.
- **Visual:** the song on two staffs, treble over bass; tags at each phrase's end naming its
  cadence (the signature); bars 7 and 8 three ways, perfect, interrupted and plagal; form letters
  gathering over four blocks, A A B A; each part a tune of its own; at the close the season's
  objects along the song's sections. **Payoff:** the reveal (to end, Merc's part leaps from D to G,
  V to I; to keep going, it steps to E, V to vi, an interrupted cadence); Step 2 (it seems to end,
  then keeps going); Sing it, one part read and sung in time, then heard with the other part.
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

1. **SEASON-2 § 3, card 28, Misconception** (`SEASON-2.md:692-695`): "A perfect cadence does sound
   final, and songs usually end on one" has no source; RESEARCH's first disagreement says so, and
   OMT says many recordings fade out. Proposed: "(Shown half right. A perfect cadence does sound
   final, as Lesson 14's perfect and imperfect cadences show (lessons/14-phrasing-whole-song/LESSON.md:181-184);
   but cadences end phrases all through a song, and the interrupted cadence, V to vi, seems to end,
   then keeps going.)". The card's "Facts to check" (`:711`) asks for "a song usually ends on a
   perfect cadence"; mark it not found.
2. **SEASON-2 § 3, card 28, Practise** (`:705-711`) and **§ 5.1, row 28** (`:844`): Jam's Harmony
   Stack is not on the page (Lesson 28 FACTS 74). Proposed row: "Karaoke Night; Ear Lab: Cadence |
   Cadence-type drill (item 19, data and code); harmony-line drill (item 17)", with a note that
   Harmony Stack is Lesson 26's card.
3. **SEASON-2 § 6.2 item 7** (`:985-990`): Lesson 28 takes the turn-taking fallback, sing alone,
   then hear the take with the other part, because it records; Lesson 26 sings along. A clause:
   "Lesson 28's alone path records the take and plays it back with the other part; Lesson 26, which
   records nothing, sings along."
4. **SEASON-2 § 6.2 item 1** (`:964-973`): the season's end card per season is required before
   Lesson 28 is built, and the season must know its last lesson, or Lesson 14's page draws Lesson
   15's card (Lesson 15 WEB-SPEC item 3) and Lesson 28's draws none (Lesson 28 WEB-SPEC Toys 7).
5. **SEASON-2 § 3, card 27, Closes on** (`:682-683`): "the strongest way home, and songs use it to
   end" is still unsupported, as Lesson 27 FACTS 5 says; Lesson 28 does not repeat it. No change
   from this package beyond Lesson 27's entry.
6. **SEARCH § 8** (`SEARCH.md:370`, `:373`): at release, `/karaoke-night` and `/ear-lab` gain 28.
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
- Season 2's close, beside `SEASON_END` (proposed shape, one per season): eyebrow `'End of Season
  2'`; line `"You've read a song in two parts. Now sing a whole song."`; rest line `"You've read a song
  in two parts."`; song `{ label: 'Karaoke Night', path: '/karaoke-night' }`; map `{ label: 'See
  the season map', href: '#explorer' }`. Season 1's needs its rest line too, Lesson 14's kit item 12:
  `"You've seen every note you sing."`.
- `SIGNATURES[28]`: "A song in two parts on two staffs, Merc's lower part blue and Tavi's upper part
  orange; a tag names each phrase's cadence, and form letters gather above the sections."
- No `TEASE_NOTES` entry (no alternative tease).

## 6. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host, `learn/28.html`, in `STANDALONE_DOCUMENT_PATHS`; the draft line.
2. Seasons in the kit, with a close per season, a season that knows its last lesson, the rest-aware
   close (Lesson 14's item 12) and the masthead's season (item 3). Required before the build.
3. Lesson 18's items 4, 5, 7, 8 and 16, and this page's staff-toy additions: two staffs in one
   figure with a brace, part labels, bar numbers, tags, numerals under chosen bars, words under
   notes, the lock that draws ten empty bars, the pitch-line view in two colours (item 4).
4. Lesson 24's checks with Lesson 26's options and this page's fail line (item 5).
5. Lesson 26's part under a take, with a breath dip added to its repeated-note dip (item 6).
6. Lesson 26's reader rule, for fourteen notes of two and four beats at 72 BPM; tests on this
   page's synthetic takes (item 7).
7. Lesson 14's `kit/record.ts`, whichever page builds it first, and the playback of a take with the
   other part's contour voice on one audio-clock time (item 8).
8. The lab test on a phone: silence over the other part, the reader on real takes, the playback's
   timing against the part on each device's round trip, levels, the staffs at 344 to 390 px, and the
   chip's timing (item 9).
9. The head and share card, `PT19M` (the head test already has "nineteen"); Lessons 18 and 26's
   question modules; the lesson copy; Season 2's plumbing (§ 5.2 item 21); the cadence-type drill
   (item 19) and the harmony-line drill (item 17), the app's; at release, SEARCH § 8 and Karaoke
   Night's `lessonsPractised` (`src/seo/entry-pages.ts:272`) gain 28.

## 7. Departures from ARTICLE-PLAN.md, and why

1. **The predict's stem and choices**: "Which part changes its note at bar 8?" [Tavi's part] [Merc's
   part]. The plan's stem said the top part reached do "just as it does when the song ends", which
   answered it (Lesson 27's finding, the brief); its choices become the two named parts (FACTS 42).
2. **The reveal**: Merc's part leaps up from D to G to end, where the plan said it "fell to G"
   (D3 to G3 rises five semitones); quick check 4's "stepped up, not down to the root" is dropped
   for the same reason (FACTS 34, 80).
3. **Tavi's bubble** is a sincere guess for the wrong part; the plan's was the misconception, which
   Step 2's card answers. Merc's line names no part (FACTS 41).
4. **The hero draws ten empty bars**, not the song on its staff, whose bar 8 would answer before the
   choice; the staffs are written by the answering plays (FACTS 40, 43).
5. **The recall** asks Lesson 18's question 2, not question 1, whose "What does this lesson
   suggest?" would point at Lesson 28; Lesson 14's question 4 is not asked: it leans on the predict
   and the page is near its cap (FACTS 7).
6. **Three words**: Cadence (Lesson 14's), Section and Form. The plan's Interrupted cadence word
   ("V going to vi") and Cadence's "bars 7 and 8" play answered the predict from below it; Plagal
   moves into Step 2 (FACTS 47).
7. **Locks**: the steps' figure, every play that sounds the song's ending (Steps 1, 3 and 4, Sing
   it) and free play wait for the choice; Step 2's text is a second reveal element under a held
   line; the tour waits (FACTS 1a, 46). Steps 1, 3 and 4's text stays open, argued in 1a.
8. **Step 2's wording**: "seems to end, then keeps going" and "considered weak, for its "hanging"
   feeling", where the plan had "sounds like an ending and swerves", which is stronger than the
   source; the plagal tag sings "ooh" with "A-men" written under it, since the kit sings no words;
   the mix-up card drops "and songs usually end on one" (FACTS 13, 15, 35, 49).
9. **Step 3** has no predict and no Go deeper (the Beatles song): the card's "if long" rule makes
   AABA the first cut, so AABA stays at one example and its predict goes (FACTS 50).
10. **Step 4** explains the key signature in a sentence, since Lesson 21 is not a prerequisite
    (FACTS 51).
11. **Step 1** drops the fade-out Go deeper and the "imperfect authentic" warning; the American
    names are said once (FACTS 20, 21, 48).
12. **Sing it**: the other part plays under the take with headphones (Lesson 26's part under a
    take); the take is recorded and played back with the other part (Lesson 14's recorder); after
    No headphones the learner sings alone and hears the two together afterwards, the season's
    turn-taking fallback, where Lesson 26 sings along (Lesson 26 FACTS 62), because a recording
    lets the two parts meet without playing into the microphone; with no microphone, a sing-along.
    Do then the count-in, as Lesson 18, with no model run (eight bars would double the run). Breath
    marks after bars 2, 4 and 6, where the plan had 4 and 8 (bar 8 is the end; four bars at 72 is
    13.3 s in one breath). No Move do: a moved do changes the key the learner reads (FACTS 58 to 68).
13. **Quick check 2** asks for the Amen cadence, so all four cadences are asked (question 4 asks for
    the interrupted by ear), where the plan asked again what V to vi is called (FACTS 78).
14. **The practice card**: Karaoke Night (Lesson 14's lines, without its "Ten minutes" line, cut for
    length) and Ear Lab's Cadence (Lesson 12's line, plus "five of its eight stop on V"); Harmony
    Stack is left out: it needs a friend, sings a scale's chord tones, not a song in two parts, and
    Lesson 26's card already carries it and its two open app items (FACTS 70 to 74).
15. **The chips** name both prerequisites and read 19 minutes, from the built page; the promise says
    "four cadences", the card's objective, not "four ways a phrase can end", which plagal and
    interrupted are not in the article's classification (FACTS 2, 3, 17).
16. **The close**: Season 2's words, proposed, since the kit has only Season 1's (FACTS 5).

## 8. Citations of other lessons' work

None uncommitted: Lessons 14, 18, 24, 26 and 27, and every other cited lesson, are cited by path and
line at the branch head. Lesson 27's card holds this page's still; this package specifies it
(WEB-SPEC Toys 8: the ten empty bars between Merc and Tavi, no bubbles, no note), which Lesson 27's
spec leaves to Lesson 28 (`27-sevenths-inversions/WEB-SPEC.md:314-317`).

## 9. Questions for the lead and the owner

1. **Season 2's closing words** (WEB-SPEC, Decisions 1): "End of Season 2"; "You've read a song in
   two parts. Now sing a whole song."; rest line "You've read a song in two parts." The Season 2
   trailer is not written; if its question changes, the line follows it.
2. **The alone path** (departure 12): this package takes the season's turn-taking fallback, where
   Lesson 26 sings along. If the lead wants Lesson 26's way instead, Sing it's headphones line, the
   alone state and its tests go, and the sing-along opens after No headphones.
3. **The breath marks** (the coach): after bars 2, 4 and 6, or only bar 4's.
4. **The chip**: 19 minutes until the lab; the steps' plays are long at 72 beats a minute, so the
   lab may move it to 20, which the head test also has a word for.
