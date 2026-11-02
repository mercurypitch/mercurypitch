# Lesson 16, "Sing what you see": hand-back

Files, in `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/16-sing-what-you-see/` and copied to
`s2pkg/16/`: FACTS.md, LESSON.md, WEB-SPEC.md. RESEARCH.md and ARTICLE-PLAN.md untouched.

- Learner copy: **2,225 words** on `node scripts/lesson-words.mjs` (cap 2,379, 154 under); each
  step's own text 81 to 118. Built page estimated at about 2,375 (WEB-SPEC Length names 42 words of
  cuts if a build runs over).
- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/16-sing-what-you-see`:
  **239 citations read, 0 findings.**
- Key: G, as the lead answered. G does not make any step unteachable for the lower voice: the cost
  (mi and so above the bass staff, fa on middle C's ledger line) is said in Step 1, Step 4 and Your
  turn, and quick check 2 asks the bass staff's top space.
- Quick check 3 kept word for word for Lesson 18's recall ("On the staff, do, mi and so sit...",
  three lines or three spaces in a row; "Try Step 4 again" on the leap step). Its first and third
  feedback lines say "a leap of a third" and "line to line skips one letter".
- R16-16 settled: a link's notes are fitted to the saved range by whole octaves before they reach
  Sight-Singing (`src/App.tsx:794-798`, `fitPhraseToRange`). Consequence for item 10a below.

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
  its own." Predict: "Tavi sings the line with no note to start from. What will you hear?" [Not this
  tune: that takes perfect pitch] [This tune, from a note of her own]. After the choice, two tries:
  with no note first she sings it a step low, from F, each orange note one place under its written
  note; with one note first, G, every note lands on the page. The reveal waits for both. The plan's
  predict, "What does she need to hear first?", was answered by Lesson 9's Step 3 (the Royal
  Conservatory plays do, mi and so, then the first note) and is replaced (Lesson 16 FACTS 31). The
  page's tour waits for the choice.
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
  1993, abstract), relative pitch (Lesson 6, after Wikipedia), the Royal Conservatory's
  sight-singing tests (RCM 2025 via Lesson 9; RCM 2019), audiation (Wikipedia, "Gordon music learning
  theory", revision 1379965924), the imagery study as Lesson 9 says it (Pfordresher and Halpern
  2013), sight-singing (Wikipedia, "Sight-reading", revision 1371524263); the app at `c60f0fdcb`. No
  prevalence for absolute pitch, so no "rare".

**Also in CURIOSITY-MOMENTS, Lesson 15's entry**, its Tease line: "It names no starting note, the
answer to Lesson 16's predict." should become "It says nothing of what Tavi sings with no note to
start from, the answer to Lesson 16's predict." The tease and its still stay true of the new cold
open (five notes, up two places and back down, never heard).

## Lesson 15's files (the lead's to edit; I did not touch them)

- Lesson 15 FACTS 5 gives Lesson 16's predict as the plan's ("What does she need to hear first?"
  (Just its first note)) and the cold open as C4 D4 E4 D4 C4, citing Lesson 16's ARTICLE-PLAN
  (`:29-32`, `:34-35`). Proposed: "Neither says what Tavi sings with no note to start from, the
  answer to Lesson 16's predict, "Tavi sings the line with no note to start from. What will you
  hear?" (This tune, from a note of her own), so neither gives it away", with Lesson 16's cold open
  "G4 A4 B4 A4 G4" and citations to Lesson 16 LESSON.md, Cold open, and FACTS 31.
- Lesson 15 WEB-SPEC, Toys 8 ("It names no note to start from, so it does not answer Lesson 16's
  predict"): still true; it may read "It says nothing of what Tavi sings with no note to start from".

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
10. SEASON-2 § 5.2 item 10 for Sight-Singing, with two additions:
    - **(e) names off must hide five displays**, not one: the letter and octave under each note, the
      hold bar's "Hold G4 to continue", the tracker's target-line label, the next two upcoming notes'
      labels and the live dot's label (`SightSingingExercise.tsx:130-140`, `:349`;
      `PitchOverTimeCanvas.tsx:404-475`, `:553`, `:757-765`). The item lists only the first.
    - **(a) the fixed-phrase slug**: author the two phrases as one ten-note line, G4 A4 B4 A4 G4 G4 D5
      B4 A4 G4 (proposed slug `sing-what-you-see`), so one octave fit moves both: two separate entries
      would be fitted apart, and a bass preset would get the second phrase at G2 (its leap to D makes
      the lower octave sit nearer the bass's middle), an octave under the page's G3. A ten-note line
      needs a phrase break drawn in the drill, or the card says "two phrases, one after the other".
11. Head and share card (`learn/lesson-16-og.jpg`, title, descriptions, structured data with
    `teaches`, llms.txt line on release).
12. Lesson 15's questions as a module, so this page imports `l15-q1`.

## Departures from ARTICLE-PLAN.md, and why

1. **The predict** is "Tavi sings the line with no note to start from. What will you hear?" [Not this
   tune: that takes perfect pitch] [This tune, from a note of her own], with two tries after the
   choice. The plan's "What does she need to hear first?" is answered by Lesson 9's built Step 3
   (`learn/09.html:1091-1098`) and its Words defined both kinds of pitch below the predict.
2. **G everywhere**, the lead's answer: every pitch and place redone in both clefs, the quick check's
   question 2 moved to the bass staff (the treble's do is the recall's G line), the coach's range and
   the six-preset table redone.
3. **The second phrase is do, so, mi, re, do** (G D B A G): the plan's do, mi, so, mi, do equals the
   start note for note, against SEASON-2 § 1.5 item 6. It opens with Lesson 9's leap, a fifth; the
   coach may prefer do, mi, re, mi, do (LESSON.md, For the vocal coach).
4. **Three words, not four**: relative and absolute pitch left out of the Words, which sit below the
   predict and would answer it; the reveal and Step 2 define them in Lesson 6's words.
5. **Step 3's study** said as Lesson 9 says it (four identical pitches, a correlation), and
   "audiation" sourced to an encyclopedia article at a named revision.
6. **No singing in the steps**: Step 2's Try taps re after hearing it inside (plan: sing re); Step 3's
   imagines (plan: hum). So the comfort check comes once, before Sing it.
7. **"Leap", not "skip"** (Lesson 9's word); Step 4's heading is "What about a leap?".
8. **The checkpoint's lines** carry no advice and no count; "How did that feel?" after each phrase;
   the second phrase only after Easy or Workable; the closing line names the task ("Two phrases from
   the page, each found from do."), not what the learner did.
9. **Merc sings the start** (do, then do, mi, so, mi, do), where the plan had the page play it:
   playbook rule 22's voice-like model. The start lights only do on the staff.
10. **Recall order**: Lesson 9's question first, in lesson order, as Lesson 21's recall does.
11. **The practice card**: says the drill picks its own notes in the key its start screen shows (C
    major by default, not G), so the plan's "find do yourself, for example by singing the do you heard
    on this page" is dropped (it would give the wrong do); names five name displays, not three; no
    first-visit line (the page waits on item 21); no slug promised.
12. **No Go deeper** (the plan's three items are sourced but cut for length; kept in FACTS).
13. **The voice choice** keeps Lesson 3's buttons with Lesson 15's clef line under them, where the plan
    put the clefs in the buttons.
14. **The pitch-line switch** is off in every step, not only from Step 3.
15. **Sound gate** in Lesson 9's form; Merc's cold-open line is "Let's hear what the page gives you on
    its own."; Step 2's Tavi line is "So how did I sing it without perfect pitch?"; the promise says
    "hear each note before you sing it".
16. **Range advice**: no Move do and no octave lower (both checked against the six presets); "If so
    feels high, stop after the first phrase." instead. No warm-up (the coach may add Lesson 3's).
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
