# Lesson 16, "Sing what you see": hand-back (after the fix pass)

Files, in `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/16-sing-what-you-see/` and copied to
`s2pkg/16/`: FACTS.md, LESSON.md, WEB-SPEC.md. RESEARCH.md and ARTICLE-PLAN.md untouched; no shared
file, no other lesson's file and no code touched.

- Learner copy: **2,226 words** on `node scripts/lesson-words.mjs` (cap 2,379, 153 under). Each
  step's own text: Step 1 118, Step 2 118, Step 3 93, Step 4 116, Step 5 78. Built page estimated
  at about 2,376, or about 2,341 without the reading's four example lines (35 words), which a built
  page does not print. WEB-SPEC Length names 49 words of cuts if a build still runs over (Step 2's
  dated finding, 20; Step 3's study sentence with its hedge, 29).
- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/16-sing-what-you-see`:
  **256 citations read, 0 findings.**
- The head description is unchanged, 142 characters, with "A fifteen-minute lesson".

## The fix pass: what changed

- **Blocking 1, the predict.** The choices are now [ A jumble: with no note, she can't read it ]
  [ The tune, from a note of her own ]: they turn on what is heard, name no perfect pitch, and the
  first is false of what the stage shows (Tavi keeps the steps, from F). I kept the review's pair:
  it is short (41 and 32 characters) and I found no wording that is plainer. The reveal is new
  ("The tune, from a note of her own. ... that's what the note is for. ... (She missed every written
  note, so a jumble was a fair guess.)"). The thesis is now what the one note is for, landing on the
  written notes: Step 2 ("To land on the written notes, a reader needs one note to start from, not
  a stored one."), quick check 1 ("What does a singer need to sing a new tune on its written
  notes?"), the Wrap ("To sing a tune on its written notes, you need one note to start from, not
  absolute pitch: hear do, then count the steps from it."). FACTS 31 cites Lesson 6's mix-up card
  (`learn/06.html:1042-1043`) and its sing-along close (`learn/06.html:1707`) and records that "the
  tune" means the tune at any pitch. FACTS 22 says how the season card's objective is now said.
- **Should fix 1.** Step 2's Tavi line is "So what did that one note give me?". FACTS 1a says
  plainly that Step 2 points to the answer before the choice (wide screen: the steps further down
  the page; phone: one Next from Step 1), that the tour is held for the choice, and that a learner
  who goes there unasked has passed the predict, citing Lesson 21 FACTS 1a.
- **Should fix 2.** The Words' Sight-singing play gives do in the soft tone, 0.4 s of quiet, then
  the voice (4.4 s): FACTS 67, FACTS 3, WEB-SPEC Toys 4 and test 4. FACTS 42 says Merc's start is
  the page's reference, as the examiner's playing is.
- **Should fix 3.** [ Play the start ] on the no-microphone path (do, then do, mi, so, mi, do, no
  phrase), the line reworded ("No microphone? Play the start, read and sing anyway, then play
  Merc's phrases to check. Nothing listens."), with an edge case and test 8.
- **Should fix 4.** One-line authoring kept; FACTS 59 and WEB-SPEC say what today's fit does (bass
  G2 to D3, do on the bass staff's bottom line once the bass clef ships; the bass-octave writing
  still gives G2) and ask item 10a for a fixed-phrase link that skips the fit. Corrected below.
- **Should fix 5.** Six name displays (the tracker's side labels added), and the tracker's own hide
  (round button, top right, "Hide pitch tracker"; "Show Tracker" brings it back). The card says:
  "Its round button at the top right hides your pitch line; the names under the notes and on the
  hold bar stay." Found on the way: the hide is stored under one key that the drills' shared shell
  reads, so hiding it in Sight-Singing hides it in every drill on that device until Show Tracker
  (FACTS 58, WEB-SPEC edge case). The card does not say this, for words.
- **Should fix 6.** The example reads "Re · In the band: 20 cents below the written note."; FACTS 47
  cites the 15, 35 and 60 cent edges; "Right in the middle" is on the coach's list.
- **Should fix 7.** Step 4: "Do to so, two lines or two spaces up, is Lesson 9's leap, a fifth."
  One step further than the call: SEASON-2 § 1.4 item 1 actually reads "every staff idea arrives
  after the sound it writes down" (the review paraphrased it), and nothing on the page played do
  to so as a leap, so Step 4's second play is now "Play do, mi, then do, so" (2.7 s) in place of
  "Play do, re, mi, then do, mi", heard just before the sentence. The phrase stays do, so, mi, re,
  do. FACTS 14, 43 and 68, WEB-SPEC Toys 2 and test 4 updated.
- **Should fix 8.** FACTS 62 now backs "Practise it free" and "Sight-Singing is free." (the menu
  card, always available; `PREMIUM_EXERCISES`; premium.md:57; Lesson 9 FACTS 54, Lesson 23 FACTS
  59).
- **Nits, all taken:** 1 quick check 3 (below); 2 FACTS 3 counts six questions (about 5.1 minutes of
  activity, about 14.5 in all); 3 Step 2 dates the finding ("A 1993 review found the evidence points
  to it being learned early, up to about age 6"), quick check 1 drops the claim, and the 2019 paper
  is in FACTS Unsupported (I checked its PubMed record: PMID 31550277); 4 "The Royal Conservatory's
  exams give that note first."; 5 FACTS 24 "its lead and its Audiation section"; 6 FACTS 13 and the
  preamble give quick check 2's reason (the higher voice meeting the bass do only in Step 1 is left
  as is, as the review allowed); 7 WEB-SPEC Length rewritten with new cuts and counts; 8 "once
  you've held near it for about half a second"; 9 "the tune Tavi sang at the top of the page"; 10
  [ Stop here ] beside the second phrase's offer: it ends the singing, keeps the practice card and
  shows Play Merc's phrases (FACTS 49, WEB-SPEC Toys 6, flow rule, test 8); 11 Toys references
  fixed; 12 FACTS 1a names the Sight-singing play's note first; 13 this hand-back.
- `verify16.py` (in `s2pkg/16-tools/`): section 5 adds the ten-note line and its bass-octave
  writing; section 6 the Sight-singing word, Play the start and the new Step 4 play; section 7 the
  new choices. Its Merc's-phrases line printed 11.8 s (soft-tone timing by mistake); it now agrees
  with FACTS 70's 12.0 s.
- Nothing in the lead's calls was left untaken.

## Quick check 3, final text (Lesson 18's recall asks it word for word)

3. On the staff, do, mi and so sit...
   - On three lines in a row, or three spaces in a row **[correct]** · Feedback: "Each skips one
     letter: a leap of a third."
   - On three neighbouring places, like line, space, line · Feedback: "Neighbouring places are
     steps, like do, re, mi. Try Step 4 again."
   - Anywhere: the staff doesn't show leaps · Feedback: "It does: line to line skips one letter."

Changed from the plan's: "positions" became "places", "skips" became "leaps" (Lesson 9's word), the
second answer gained "like" so it holds in the bass clef (do, re, mi are space, line, space there),
and each feedback line is reworded (the first extended with "a leap of a third"). The question and the right answer are the plan's word for word, as
Lesson 18's plan quotes them.

## MASTER-PLAN § 11 line

- Lesson 16: a written lesson, text only, in
  [`lessons/16-sing-what-you-see/`](lessons/16-sing-what-you-see/) (research, article plan, facts,
  copy and page spec). Its scored checkpoint waits on the vocal coach's sign-off (§ 12 item 8). No
  page is built yet: it waits on Season 2's kit (seasons, the staff toy with both clefs and the house,
  Lesson 4's staircase moved into the kit, and Lesson 12's sing flow moved into the kit with a scored
  take that reads along written notes, SEASON-2 § 6.2 items 1 and 2), on the lesson plumbing for
  Lessons 15 to 28 (SEASON-2 § 5.2 item 21), and, as the season orders it, on Sight-Singing's "hear
  do" start, bass clef, key signature and octave folding (§ 5.2 item 10, § 8.2 item 4). It goes live
  when the console publishes it, after the coach's sign-off and once `/learn/09` and `/learn/15`, the
  pages its chips and its recall link to, are live, with Lesson 15 and the trailer (SEASON-2 § 7 item
  6).

## CURIOSITY-MOMENTS entry (new, after Lesson 15's)

### Lesson 16 · Sing what you see · voice; written; no page yet · hook kept

- **Opening:** a treble staff with five plain notes, G4 A4 B4 A4 G4, up two places and back down,
  between Merc and Tavi, nothing lit and nothing played. Tavi "I've never heard this tune. Don't I
  need perfect pitch to sing it straight off the page?" Merc "Let's hear what the page gives you on
  its own." Predict: "Tavi sings the line with no note to start from. What will you hear?" [A jumble:
  with no note, she can't read it] [The tune, from a note of her own]. After the choice, two tries:
  with no note first she sings the tune a step low, from F, each orange note one place under its
  written note; with one note first, G, every note lands on the page. The reveal waits for both:
  "The tune, from a note of her own", the tune at any pitch, as Lesson 6 has it; the one note is
  what lands it on the written notes. The plan's predict, "What does she need to hear first?", was
  answered by Lesson 9's Step 3 (the Royal Conservatory plays do, mi and so, then the first note)
  and is replaced (Lesson 16 FACTS 31). The page's tour waits for the choice, since Step 2 points to
  the answer.
- **Visual:** the staff toy in the learner's clef with the house on do (Lesson 15's, new to the kit),
  Lesson 4's staircase turning into it (new), Hear it inside and Names on · off (new), Tavi's sung
  notes drawn on the staff (new), and the learner's pitch line drawn after each phrase (new).
  **Payoff:** Step 5, the names gone and only the house left; the checkpoint, two phrases read from
  the learner's own staff after Merc sings do and the tonic triad, the second a line nobody has
  played, read note by note, octave-folded, with the pitch line shown only after.
- **Tease:** a still of Lesson 17's stage before its first play (Lesson 8's four beat pads, an empty
  line, an empty stopwatch strip), which plays nothing: "Same written bar, played twice. Only the
  tempo changes.", alternative `shapes` (Lesson 17 FACTS 5b).
- **Facts:** sourced in Lesson 16's FACTS: absolute pitch and early learning (Takeuchi and Hulse
  1993, abstract, dated on the page), relative pitch (Lesson 6, after Wikipedia), the Royal
  Conservatory's sight-singing tests (RCM 2025 via Lesson 9; RCM 2019), audiation (Wikipedia,
  "Gordon music learning theory", revision 1379965924), the imagery study as Lesson 9 says it
  (Pfordresher and Halpern 2013), sight-singing (Wikipedia, "Sight-reading", revision 1371524263);
  the app at `c60f0fdcb`. No prevalence for absolute pitch, so no "rare".

## Lesson 15's files and entry, which still describe the old predict (the lead's to edit)

I did not touch them. Exact replacements:

1. **CURIOSITY-MOMENTS, Lesson 15's entry, its Tease line.** Replace the sentence

   > It names no starting note, the answer to Lesson 16's predict.

   with

   > It says nothing of what Tavi sings with no note to start from, the answer to Lesson 16's
   > predict.

   The rest of the line stays true of the new cold open (five plain notes, up two places and back
   down, never heard).

2. **Lesson 15 FACTS 5, the claim cell.** Replace

   > Neither names a starting note, which is the answer to Lesson 16's predict, "What does she need
   > to hear first?" (Just its first note), so neither gives it away

   with

   > Neither says what Tavi sings with no note to start from, the answer to Lesson 16's predict,
   > "Tavi sings the line with no note to start from. What will you hear?" (The tune, from a note of
   > her own), so neither gives it away

3. **Lesson 15 FACTS 5, the source cell.** Replace

   > Lesson 16's cold open, a phrase of five notes, C4 D4 E4 D4 C4, that "Nothing plays", and
   > Tavi's "I've never heard this tune." (`lessons/16-sing-what-you-see/ARTICLE-PLAN.md:29-32`),
   > and its predict (`:34-35`);

   with

   > Lesson 16's cold open, five notes, G4 A4 B4 A4 G4: "Nothing plays them before a choice."
   > (`docs/plans/find-your-pitch/lessons/16-sing-what-you-see/LESSON.md:115-118`); Tavi's "I've
   > never heard this tune." (`:120`); and its predict (`:123-124`; Lesson 16 FACTS 31);

   Those line numbers are LESSON.md as handed back. I ran this cell through plan-cites in a scratch
   folder: both quotes are found on their cited lines, 0 findings.

4. **Lesson 15 WEB-SPEC, Toys 8** ("It names no note to start from, so it does not answer Lesson
   16's predict"): still true; optionally "It says nothing of what Tavi sings with no note to start
   from, so it does not answer Lesson 16's predict".

## `kit/season.ts` entry and prerequisites (Season 2's module)

- `n: 16`, `lane: 'voice'`, `title: 'Sing what you see'`, `short: 'Sight-singing'`, `topics:
  ['S11a']`, `minutes: 15`, `page: '/learn/16'` (once built, under the drafts' comment),
  `hook: "Can you sing a tune you've never heard, just by reading it?"`.
- `pr.link`: `{ href: '/pitch-training?lesson=16', addr: 'mercurypitch.com/pitch-training', label:
  'Exercises', note: 'then tap Sight-Singing' }`.
- `pr.needs`: "Sight-Singing for the lessons: fixed phrases, a hear-do start, the bass clef, names off
  and octave-folded scoring (SEASON-2 § 5.2 item 10)".
- `EDGES` gains `[9, 16]` (cross-season) and `[15, 16]`; `PREREQ[16]` is `[9, 15]`.
- Signature line for the team notes: "Lesson 4's staircase turns into the staff with the house on
  do; each note lights a beat before it sounds, and the names fade until only the house is left."
- Draft line: `16: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.

## Hook and tease for `kit/lesson-copy.ts`

- Lesson 16's hook: the season's, on the entry (no `hookAlts` proposed).
- Set on Lesson 16 (shown on Lesson 15's card): `tease: 'Five notes on the staff. Tavi has never heard
  them.'` (51), `teaseAlts: [{ id: 'any-note', text: 'Now you can see where any note sits.' }]` (36),
  with the variant's team note (its reason: the plan's line, the card's own close; it sums up Lesson
  15 rather than setting up Lesson 16).
- This page's next card shows Lesson 17's tease, set on Lesson 17 as Lesson 17's package settles it:
  "Same written bar, played twice. Only the tempo changes." (55), alternative `shapes`, "Same five
  notes, twice as fast: the note shapes change." (55).

## Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. Lesson host: `learn/16.html`, `STANDALONE_DOCUMENT_PATHS`, first-paint budgets.
2. Draft line (above).
3. Seasons in the kit (SEASON-2 § 6.2 item 1).
4. The staff toy (Lesson 15's item 4) with this page's options: the Clef switch on the stored voice
   (bass when none); Hear it inside (each note lit 1.0 s before its onset); Names on · off (hides
   syllables, keeps the house); notes drawn at a sung pitch in a colour (Tavi's tries, orange); a
   fixed, untappable state (hero, Sing it); the take's pitch line drawn after a take.
5. Lesson 4's staircase in the kit (Lesson 21's item 6) with a turn into the staff (0.8 s), from G3 or
   G4.
6. The sing flow in the kit (Lesson 15's item 6) plus a scored take that reads along written notes:
   - `kit/read-along.ts`, new and pure: the cursor reader (octave-folded, ±60 cents, 0.45 s hold,
     outside takes back half, 8 s per note, 8 s wait; per-note readings);
   - `TakeOptions.until` in `kit/listen.ts`, so a take can end with its frames as its last note passes
     (today a take ends only by `run`, `quiet` or a cancel that keeps nothing);
   - `rungLine` and `readingWords` in `kit/take.ts` take whose note it is, passed to `gapWords`, which
     already takes it, so lines say "the written note";
   - the start sung before each take, in the chosen voice.
7. No decorative staff (Lesson 15's item 7).
8. The lesson copy (above).
9. SEASON-2 § 5.2 item 21: the lesson marker's range (so `?lesson=16` steps First Light aside) and
   the lesson-answer bounds (Lesson 16's answers are refused whole today).
10. SEASON-2 § 5.2 item 10 for Sight-Singing, with two corrections to the item (corrected here
    from the first hand-back):
    - **(a) a fixed-phrase link that skips the octave fit.** Author the two phrases as one ten-note
      line, G4 A4 B4 A4 G4 G4 D5 B4 A4 G4 (proposed slug `sing-what-you-see`), so both phrases stay in
      one octave. Today a link's notes are fitted to the saved range by whole octaves
      (`src/App.tsx:794-798`, `fitPhraseToRange`), which gives the baritone and tenor presets G3 to
      D4, the alto, mezzo-soprano and soprano presets G4 to D5, and the **bass preset G2 to D3**, an
      octave under the page's lower line (the lower octave's middle sits 5.5 semitones from the
      bass's, the page's octave 6.5). Writing the line in the bass octave does not help: the bass
      still goes to G2. Octave-folded scoring (f) would make that harmless for the score, but with
      the bass clef (c) a bass would read do on the bass staff's bottom line, not in the top space
      the page and quick check 2 teach. So the item should give a fixed-phrase link that skips the
      fit and writes the line in the octave of the singer's voice: G3 to D4 for a lower preset, G4
      to D5 for a higher one. A ten-note line also needs a phrase break drawn in the drill, or the
      card says "two phrases, one after the other".
    - **(e) names off needs to hide two displays, not one:** the letter and octave under each note
      (`SightSingingExercise.tsx:130-140`) and the hold bar's "Hold G4 to continue" (`:349`). The
      drill names notes in six places; the other four (the tracker's target-line label, the next two
      upcoming notes' labels, the live dot's label and the side labels, `PitchOverTimeCanvas.tsx`
      `:404-475`, `:553`, `:757-765`, `:305-349`) sit on the pitch tracker, which already has its
      own hide (`ExercisePitchTracker.tsx:25-28`, `:38-41`). The item lists only the first.
11. Head and share card (`learn/lesson-16-og.jpg`, title, descriptions, structured data with
    `teaches`, llms.txt line on release).
12. Lesson 15's questions as a module, so this page imports `l15-q1`.

## Departures from ARTICLE-PLAN.md, and why

1. **The predict** is "Tavi sings the line with no note to start from. What will you hear?" [A jumble:
   with no note, she can't read it] [The tune, from a note of her own], with two tries after the
   choice. The plan's "What does she need to hear first?" is answered by Lesson 9's built Step 3
   (`learn/09.html:1091-1098`) and its Words defined both kinds of pitch below the predict. The
   choices turn on what is heard, not on perfect pitch, so the page states its point as what the one
   note is for, landing on the written notes (Step 2, quick check 1, the Wrap), where the season
   card's objective says reading "needs a starting note and relative pitch, not perfect pitch".
2. **G everywhere**, the lead's answer: every pitch and place redone in both clefs, the quick check's
   question 2 moved to the bass staff (the treble's do is the recall's G line), the coach's range and
   the six-preset table redone.
3. **The second phrase is do, so, mi, re, do** (G D B A G): the plan's do, mi, so, mi, do equals the
   start note for note, against SEASON-2 § 1.5 item 6. It opens with Lesson 9's leap, a fifth, which
   Step 4 now plays (do, mi, then do, so, where the plan's Step 4 had no such play) and then shows on
   the staff, two lines or two spaces up; the coach may prefer do, mi, re, mi, do (LESSON.md, For
   the vocal coach).
4. **Three words, not four**: relative and absolute pitch left out of the Words, which sit below the
   predict and would answer it; the reveal and Step 2 define them in Lesson 6's words.
5. **Step 3's study** said as Lesson 9 says it (four identical pitches, a correlation), and
   "audiation" sourced to an encyclopedia article at a named revision.
6. **No singing in the steps**: Step 2's Try taps re after hearing it inside (plan: sing re); Step 3's
   imagines (plan: hum). So the comfort check comes once, before Sing it.
7. **"Leap", not "skip"** (Lesson 9's word); Step 4's heading is "What about a leap?".
8. **The checkpoint's lines** carry no advice and no count; "How did that feel?" after each phrase;
   the second phrase only after Easy or Workable, with [ Stop here ] beside the offer, which ends the
   singing and keeps the practice card; the closing line names the task ("Two phrases from the page,
   each found from do."), not what the learner did. With no microphone, [ Play the start ] gives do
   and the triad before the learner reads.
9. **Merc sings the start** (do, then do, mi, so, mi, do), where the plan had the page play it:
   playbook rule 22's voice-like model. The start lights only do on the staff. Every other sung
   reading on the page has its note first, the Words' Sight-singing play included (do in the soft
   tone, then the voice).
10. **Recall order**: Lesson 9's question first, in lesson order, as Lesson 21's recall does.
11. **The practice card**: says the drill picks its own notes in the key its start screen shows (C
    major by default, not G), so the plan's "find do yourself, for example by singing the do you heard
    on this page" is dropped (it would give the wrong do); asks the learner to set their range
    first; says the round button at the top right hides the pitch line while the names under the
    notes and on the hold bar stay (six name displays, not the plan's three); no first-visit line
    (the page waits on item 21); no slug promised.
12. **No Go deeper** (the plan's three items are sourced but cut for length; kept in FACTS).
13. **The voice choice** keeps Lesson 3's buttons with Lesson 15's clef line under them, where the plan
    put the clefs in the buttons.
14. **The pitch-line switch** is off in every step, not only from Step 3.
15. **Sound gate** in Lesson 9's form; Merc's cold-open line is "Let's hear what the page gives you on
    its own."; Step 2's Tavi line is "So what did that one note give me?"; the promise says "hear
    each note before you sing it".
16. **Range advice**: no Move do and no octave lower (both checked against the six presets); "If so
    feels high, stop after the first phrase." instead, with [ Stop here ] behind it. No warm-up (the
    coach may add Lesson 3's).
17. **Lesson 17's tease** is the settled one; the plan's tease is its alternative, cut to fit.

## Citations of uncommitted lessons made in words

None. Lessons 15, 17, 21 and 23 are committed and cited by path; Lesson 18 is cited only by its
committed plan file (`lessons/18-read-a-line/ARTICLE-PLAN.md:45-50`); Lesson 20 is not cited.

## Questions for the owner

1. **The page's title**: recommended "How to sight-sing a melody from the staff | MercuryPitch" (56);
   alternative "Sight-singing for beginners | MercuryPitch" (42).
2. **Release order**: recommended as the season orders it, after Sight-Singing's item 10 (b), (c),
   (d) and (f) and item 21. Both practice cards are written (today's, with the drill's limits, and
   the shrunk one for after item 10).
3. For the coach (listed in LESSON.md, For the vocal coach): the pass rule (±60 cents, 0.45 s,
   octave-folded), the pitch line hidden during a take, the second phrase's opening leap, and the rest
   card's wording.
4. Not a question, a flag: the card tells learners how to hide Sight-Singing's pitch tracker, and
   that choice is stored once for every drill on the device (FACTS 58). If the owner would rather
   the card not send learners to a setting that follows them into other drills, its tracker
   sentence (22 words) can go; names off (item 10e) would then carry the reading-without-names
   advice when it ships.
