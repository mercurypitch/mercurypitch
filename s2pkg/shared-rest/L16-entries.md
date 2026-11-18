# Lesson 16: shared entries (drafted at the lead's review, 2 November 2026)

Apply in the shared commit (#229) after every in-flight package is committed; re-check each quoted
line against the file as it then stands, and run reanchor plus the findings compare.

## 1. MASTER-PLAN § 11, after Lesson 15's line

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

## 2. CURIOSITY-MOMENTS § 2, a new entry after Lesson 15's

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

## 3. Lesson 15's files, which still describe Lesson 16's old predict (writer's exact replacements)

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

Lead: take items 1 to 3; take item 4's optional rewording too, so all four places say the same.
Re-check the cited Lesson 16 LESSON.md lines (`:115-118`, `:120`, `:123-124`) against the committed
file before writing them.

## 4. SEASON-2 § 5.2 item 10 (Sight-Singing for the lessons): two corrections from Lesson 16

- (a) The fixed phrases come with a link that skips the octave fit, so each voice reads its own
  octave: today `fitPhraseToRange` (`src/App.tsx:794-798`) gives a bass preset G2 to D3, an octave
  under the page's lower line, so with the bass clef a bass would read do on the bottom line, not in
  the top space the page teaches (Lesson 16 FACTS 59, 63).
- (e) Names off needs to hide two displays, the letter and octave under each note and the hold bar's
  name; the other four names sit on the pitch tracker, which already has its own hide (Lesson 16
  FACTS 58, 63).

## 5. SEASON-2 § 3, Lesson 16's card

No change: its "Closes on" line already carries Lesson 17's settled tease.

## 6. The lead's calls at review (for the record)

- The practice card's tracker tip ("Its round button at the top right hides your pitch line...")
  was replaced with "It prints each note's name under it: read the staff, not the names.", since the
  tracker's hide is remembered for every drill (FACTS 58).
- Owner questions answered as recommended: the head title "How to sight-sing a melody from the staff
  | MercuryPitch"; release after Sight-Singing's item 10 (b), (c), (d), (f) and item 21.
