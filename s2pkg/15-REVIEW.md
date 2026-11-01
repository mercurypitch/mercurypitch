# Lesson 15 review: The staff: where notes sit

Independent review of `docs/plans/find-your-pitch/lessons/15-staff/` (FACTS.md, LESSON.md,
WEB-SPEC.md), against RESEARCH.md, ARTICLE-PLAN.md, BRIEF-15's four answers, SEASON-2 § 1, § 3
(Lesson 15), § 4.3, § 5, § 6 and § 7, the house rules, the model packages (Lessons 12 and 14, with
Lesson 8 where it is the closer precedent) and the app at `c60f0fdcb`. I read the hand-back note
last. The review was read-only. I ran the two node scripts and nothing else, and edited nothing. I
fetched two web pages with WebFetch to check quotes, and downloaded nothing.

**Counts: 1 blocking, 11 should fix, 15 nits.**

Line numbers are the package files' line numbers as they stand.

---

## Blocking

### 1. Step 1's heading gives the predict's answer, "nine", in the masthead menu from the moment the page loads

- **Where:** LESSON.md:164 ("Step 1 of 5: Which nine notes does a staff hold?"); FACTS 1a
  (FACTS.md:47), which checks the title, promise, gate, descriptions, share card, explorer card and
  tease but never the step headings; the hand-back's "Leak check done" line.
- **What is wrong:** the predict asks how many places five lines give a note, with Five and Nine
  as the choices (LESSON.md:113-115). Step headings are not only page text:
  - The step deck reads every step's `h3` as its title (`src/features/lessons/kit/step-deck.ts:104-106`).
  - The masthead's lesson menu lists every step title of this page, including the steps not yet
    reached (`stepsOf`, `src/features/lessons/kit/lesson-menu.ts:143-161`).
  - The menu's top card reads `Lesson ${current} · ${step}` for the step showing
    (`lesson-menu.ts:210-221`). At load that is step 1, so the card reads "Lesson 15 · Which nine
    notes does a staff hold?".
  - On a phone (under 821 px) this menu is the page's only navigation (`lesson-menu.ts:14-16`).
  - The first-visit welcome tour also scrolls to the steps stage, its step "One step at a time"
    (`src/features/lessons/kit/tour-copy.ts:44-46`; `tour.ts:496-514`), so a first visitor is
    taken to Step 1's area before answering.
- **Fix (one word):** take the number out of the heading and keep it a Tavi question, for example
  "Which notes does a staff hold?" or "How do you know which note sits where?". Then add the step
  headings and the menu card to FACTS 1a's list of things checked before the reveal.

---

## Should fix

### 2. FACTS says the hero draws five empty lines before the choice; LESSON and WEB-SPEC say it draws none

- **Where:** FACTS 1a (FACTS.md:47): "the share card and the hero draw five empty lines and no note
  on them". FACTS, Illustrations (FACTS.md:198-199): "The share card and the hero before the choice
  draw five empty lines". Against these: FACTS, Illustrations (FACTS.md:185-188), "Before the cold
  open's choice it shows lanes and the climb's lit notes only, no line, space or clef";
  LESSON.md:100-103, "Nothing else is drawn yet"; WEB-SPEC:262-263, "Nothing else is drawn before a
  choice: no line, space, clef or letter".
- **Why it matters:** the fold, lanes closing into lines, is the answering play (WEB-SPEC:267-272).
  If the hero already showed five lines, there would be nothing to fold. The predict's own words
  have the same problem: "Merc draws five lines." (LESSON.md:113) is in the present tense, but no
  line is on screen.
- **Fix:** in FACTS 1a and the Illustrations bullet, say only the share card draws five empty
  lines. Word the predict for what the learner sees: "Merc will draw five lines. From the bottom
  line to the top line, how many places will there be for a note?" Update FACTS 39 and the
  hand-back's CURIOSITY-MOMENTS entry to match.

### 3. "You just sang five steps up the staff": five notes make four steps, on this page's own count

- **Where:** LESSON.md:294 and :441-442; FACTS 58 (FACTS.md:130), which glosses it as "five notes,
  each one step ... above the last"; preamble :57-59.
- **Evidence:** the page defines a step as the move from one place to the next. Step 1 says "One
  step up is the space above it". Quick check 2 says "[E, F, G] Two steps up the staff, one letter
  each" (LESSON.md:311-312). On that count, G A B C D is four steps. The plan's line had the same
  fencepost slip ("Five notes, five steps").
- **Fix:** "Do, re, mi, fa, so: five notes, one step up the staff each time." Or: "... you just sang
  four steps up the staff." Change FACTS 58 and the coach's list with it.

### 4. "No rest card" departs from SEASON-2 § 1.4 item 4 and from Lesson 8, and misreads Lesson 12

- **Where:** LESSON.md:23, :49-50, :343, :443-445; FACTS 59 (FACTS.md:131); WEB-SPEC:27, :171,
  :336-338.
- **Evidence:**
  - SEASON-2 § 1.4 item 4 carries "a rest card after Effortful" over as a house rule
    (`SEASON-2.md:98-99`). HANDOFF § 5: "Sung lessons keep the comfort check, the rest card and the
    'see a doctor' lines."
  - The closest precedent is Lesson 8, whose drills, like Compose, ask for no voice. Lesson 8 keeps
    a rest card all the same: "Instead, after 'Effortful', 'Uncomfortable' or 'Just listen today':
    'Rest today. This page's sung line will be here when your voice feels comfortable.' Then both
    drills, as above, since neither asks for your voice." (08 LESSON.md:324-326; :418-421).
  - Lesson 12 does not show "the same card after every ending". Its rest card replaces Arpeggio
    Jumper with "Rest today. Arpeggio Jumper will be here ..." and then offers Cadence (12 FACTS 63).
    FACTS 59's "as Lesson 12 keeps offering Cadence" leaves that out.
- **Fix:** keep a rest card in Lesson 8's form: after Effortful, Uncomfortable or Just listen today,
  "Rest today. This page's sung line will be here when your voice feels comfortable." Then Compose,
  as above, since it asks for no voice. This adds about 25 words, and there are 102 under the cap.
  Use the kit's `mountPractiseCard` (`kit/comfort.ts:116-125`). If the writer still argues for no
  card, FACTS 59 must answer § 1.4 item 4 and Lesson 8 by name. Either way, the coach confirms it.

### 5. "Sing the whole line an octave lower" was checked against two presets; for four others it falls below the floor

- **Where:** LESSON.md:283-284 and :432-434; FACTS 56 (FACTS.md:128).
- **Arithmetic** (`VOCAL_RANGES`, `src/stores/settings-store.ts:92-142`):

  | Line taken an octave lower | Preset | Preset floor | Where the line starts |
  | --- | --- | --- | --- |
  | Lower line, G2 to D3 | Bass | E2 | 3 semitones above the floor |
  | Lower line, G2 to D3 | Baritone | G2 | on the floor (0) |
  | Lower line, G2 to D3 | Tenor | C3 | 5 semitones below the floor |
  | Higher line, G3 to D4 | Alto | F3 | 2 semitones above the floor |
  | Higher line, G3 to D4 | Mezzo-soprano | A3 | 2 semitones below the floor |
  | Higher line, G3 to D4 | Soprano | C4 | 5 semitones below the floor |

  FACTS 56 and the coach's list report only the two good rows. The instruction depends on a
  feeling ("If the top feels high"), not on the preset. A beginner soprano who finds D5 high is
  sent to G3, below her preset. Season 1's Move do moved in semitone steps instead.
- **Fix:** give the coach the full table. Offer a gentler wording, for example: "If the top feels
  high, sing with the other voice, or just listen to the top note." Or limit the octave-lower line
  to the lower voice, where the bass row holds. Then let the coach choose.

### 6. The key of G moves the lower voice's line off the bass staff; the package does not say so or teach it

- **Where:** LESSON.md:29-32 and :426-434; FACTS 55 (FACTS.md:127); WEB-SPEC:248-249.
- **What changes:**
  - In G, the lower line G3 A3 B3 C4 D4 is mostly off the staff. G3 sits in the top space, A3 on
    the top line, B3 in the space above, C4 on a ledger line, and D4 above that ledger line.
  - The higher line, G4 to D5, is entirely on the treble staff.
  - In the card's C, the lower line (C3 to G3) sat on the bass staff and reached F3, the clef's
    line. The ledger line went to the higher voice instead.
- **Why it matters:** the swap is the lead's rule carried out correctly (C fails the margins), but
  it changes what each voice reads. The package's only justification is range. Lower voices are
  Merc's clef, and their first sung bass-staff reading is three-fifths above the staff. No step
  shows the notes above the bass staff. Step 3's ledger lines are treble only (LESSON.md:207-210),
  and Step 5 shows only C4 above the bass staff.
- **Fix:**
  - State the trade-off in FACTS 55 and in the coach's and lead's lists.
  - Show B3, C4 and D4 above the bass staff before Sing it. Step 4's toy could play the bass staff
    on to D4, or Step 3's drag could run in the bass clef too.
  - Have Sing it's staff line say it in words, for example "The lower line climbs past the top of
    the bass staff, onto middle C's ledger line."

### 7. The kit's page background draws faint five-line staves on every lesson page; the spec says nothing needs adding

- **Where:** WEB-SPEC Look (:71-76) and What the kit and the app still need, item 7 (:525-526):
  "Nothing to add to the kit; the Season 1 pages keep theirs". FACTS, Illustrations (FACTS.md:203-204),
  "No decorative staff or clef appears anywhere on the page".
- **Evidence:** the kit's `body` background in `src/features/lessons/kit/lesson-base.css:128-157` is
  a repeating gradient of five 1 px lines, 9 px apart (0, 9, 18, 27 and 36 px), every 168 px. That
  is a faint five-line staff tiled down the whole page, separate from the section heads' `.mv-staff`
  (`:397-440`). SEASON-2 § 1.5 item 7 and § 6.2 drop decorative staves in Season 2.
- **Fix:** add a kit item: a Season 2 page drops the body's staff layer, with a class on `body` or
  the season's own stylesheet. Add a page check that the computed `background-image` has no
  repeating staff gradient.

### 8. Step 3's Try, "drag a note", does not work on a phone under the series' touch rule

- **Where:** LESSON.md:212-213; WEB-SPEC:224-228 (state 3).
- **Evidence:** `.viz` sets `touch-action: pan-y` (`kit/lesson-stage.css:810-818`), so a vertical
  swipe scrolls the page. The series keeps it that way on purpose: "on touch the figure keeps
  `touch-action: pan-y`, so a swipe scrolls the page and the buttons slide"
  (`lesson-06/tune-toy.ts:18-21`; `lesson-04/stairs-toy.ts:10-15`). The spec does not say how a
  phone learner moves the note.
- **Fix:**
  - Word the Try for every input: "Move the note above the staff, then below it." The toy line then
    names Step up and Step down.
  - In state 3, say that a mouse or pen drags, touch keeps pan-y and the buttons move the note, and
    a tap on a place above or below the staff jumps the note there.
  - Add it to Edge cases.

### 9. Two of the page's sound sources cannot obey the spec's "one sound at a time" as cited

- **Where:** WEB-SPEC Audio (:393-404: "every source here registers with" `NowPlaying`); Toys 4
  (:170, :293); Toys 7 (:363-365).
- **Evidence:**
  - Lesson 2's `bindQuizPair(host)` takes no sound owner. It plays through `Sound.voice` with its own
    `playing` set (`src/features/lessons/lesson-02/quiz-pair.ts:33-58`). Lesson 15 is the first page
    to import question 2's slot onto a page with one sound at a time (Lesson 4 imports questions 1
    and 3 only).
  - The words strip is cited as `lesson-04/words.ts`, which is Lesson 4's own module. The kit has
    `kit/words-strip.ts`, "promoted so Lesson 7's four words reuse it", and it takes the page's
    owner (`words-strip.ts:5-12`). Lessons 7 to 10 use it.
- **Fix:**
  - Cite `kit/words-strip.ts` with `NowPlaying`.
  - Add a kit item: `bindQuizPair(host, owner?)` claims and releases the owner. Or say that Lesson
    15 wraps it.
  - Add a test that a recall pair play stops the climb, and the climb stops it.

### 10. "Play every note from G2 to F5" plays 21 of the 35 notes in that range

- **Where:** LESSON.md:249; WEB-SPEC:239-240; FACTS 68 (FACTS.md:173).
- **Arithmetic:** MIDI 43 to 77 is 35 keys: 21 white and 14 black. The sweep plays the white keys
  only, the staff's lines and spaces with no sharp, and it sweeps across a keyboard that shows
  every black key.
- **Fix:** label it "Play every line and space from G2 to F5" or "Play the white keys from G2 to
  F5", and change FACTS 68 and Tests 4 to match.

### 11. Lessons 15 and 17 agree on the staff, but Lesson 17 still cites Lesson 15's plan, not its package (for the lead)

Lesson 17 is not mine to review. Where it relies on Lesson 15, the two now differ in three places:

- **The staff positions.** Lesson 17 FACTS 29 (17-note-lengths/FACTS.md:83) cites Lesson 15's
  ARTICLE-PLAN:143-148, which has the sing-along in C, C3 to G3 and C4 to G4. It also says "Lesson
  15's package is not written yet". The package now holds the staff positions (Lesson 15 FACTS 14
  and 16), and its sing-along is in G. Lesson 17's own claim still holds: A3 is the bass staff's top
  line and A4 the treble's second space, both taught in Lesson 15 Steps 1 and 4.
- **The voice buttons.** Lesson 17 FACTS 52 still describes "the plan's clef-naming buttons" as
  pending. Lesson 15 settled it: Season 1's buttons, word for word, which Lesson 17 also uses
  (17 LESSON.md:264-265).
- **The clef line.** Lesson 17's voice choice also sets its staff's clef (17 LESSON.md:410-411), but
  it does not carry Lesson 15's new line, "Your staff follows your choice: the bass clef for the
  lower voice, the treble clef for the higher." The lead should decide whether Lesson 17 carries
  that line word for word, as a shared line from Lesson 15. The hand-back's "Item 10 in Lesson 17's
  list ... can close" is true only of the buttons.

These agree: Lesson 15's short name, "The staff", matches Lesson 17's chip, and the stemless
noteheads are kept for Lesson 17. Lesson 16, not yet written, plans its examples in C at the same
preset floors. FACTS 55 already flags this for its writer.

---

## Nits

1. **FACTS 39** (FACTS.md:105) says "the climb's first and last notes, E4 and E5". The last note is
   F5. Say "the climb's E4 and E5, and its F4 and F5, share letters".
2. **The sweep's length** (FACTS 68, FACTS.md:173; WEB-SPEC Tests 4, :615) is given as 5.25 s,
   "21 × 0.25". The climb is timed as last onset plus length (4.8 + 0.5 = 5.3). On that rule the
   sweep is 20 × 0.25 + 0.22 = 5.22 s. Use one rule for both.
3. **Merc's line** (FACTS 57, FACTS.md:129; WEB-SPEC:319): "each note held 1.2 s and moving to the
   next in 0.05 s" totals 6.6 s only if the glide is inside the 1.2 s. `contourOf` adds holds and
   glides (`kit/sound.ts:289-308`). Write "a 1.15 s hold and a 0.05 s glide, 1.2 s a note".
4. **Workflow words in lesson files.** FACTS 1 and 5 say "the hand-back proposes", and FACTS 39 cites
   "BRIEF answer 3", a scratchpad document that is not in the repository. Say "for the lead" and "the
   lead's answer to ARTICLE-PLAN's open question 3". This is the same nit as the Lesson 17 review's
   item 7.
5. **"so" beside the syllable.** The practice card says "write do, re, mi, fa and so ... so on a
   phone, turn it sideways" (LESSON.md:348-351). Lesson 12, the model, keeps "so" for the syllable
   (12 LESSON.md:26-33). Reword: "Compose is built for a bigger screen: on a phone, turn it
   sideways." The other conjunction uses (:129, :169, :221, :242, :234) are further from the
   syllable but could go the same way.
6. **The tease still never plays** (LESSON.md:373-376; WEB-SPEC:375-383), against "every staff
   example plays" (SEASON-2 § 1.4 item 1). Give the reason once: Lesson 16's opening plays nothing
   until its predict, and playing the phrase here would undo "Tavi has never heard them". This
   matches the Lesson 17 review's item 14.
7. **Copy order, sound before symbol.**
   - Step 2 names "F♯ stays in F's space, B♭ on B's line" (LESSON.md:190-191) with no play before
     it.
   - Step 5 states "Middle C sits on the one ledger line between them" before [Play middle C on
     each staff] (:240-241).
   - Move each [Play] marker ahead of its sentence.
8. **Step 4's grammar** (LESSON.md:221-222): "The bass clef's two dots sit either side of the second
   line from the top, and name it F". The clef names the line, not the dots. Write: "The bass clef
   names the second line from the top F: its two dots sit either side of it."
9. **The pitch-line switch.** SEASON-2 § 1.4 item 1 says every staff toy has it. WEB-SPEC:205 puts
   it "in every step", but four staff drawings lack it: Sing it's staff, quick check 2's slot staff,
   the four words' figures and the tease still. Say which carry it and why the others do not.
10. **Over, beside, beneath.** Step 2's toy is "over the pitch line" (LESSON.md:202), the switch
    draws the pitch line "beside the staff" (WEB-SPEC:206), and the fold shows it "beneath"
    (FACTS.md:190). Pick one.
11. **FACTS 55's "Season 1's margins, at least two semitones at each end (Lesson 14 FACTS 69)".**
    Lesson 14 FACTS 69 shows its phrase with a 2-semitone margin. It sets no rule, and its Move do
    takes the phrase under two presets. Say "Lesson 14's phrase left 2".
12. **Reuse or copy.** WEB-SPEC:9-11 says the page "reuses and never copies: a part that still lives
    in an earlier lesson's module moves into the kit first". Item 6 (:522-524) derives
    `lesson-15/sing-flow.ts` from Lesson 12's. Lesson 17 needs a sing flow too, so either move a
    parametrised flow (Move do and rest card as options) into the kit, or drop the sentence.
13. **WEB-SPEC Toys 7** (:372-373) cites FACTS 5 for "Lesson 16 plans to ask [question 1] ... as its
    recall". FACTS 5 does not say this. Cite Lesson 16's ARTICLE-PLAN, Recall 1.
14. **"SEASON_END, which SEASON-2 § 7 item 9 keeps"** (FACTS 5b; WEB-SPEC:510-511). Item 9 is the
    trailer. The sources are item 8 ("Season 2 ends as Season 1 does") and CURIOSITY-MOMENTS § 2's
    Lesson 14 entry.
15. **Small wording and colour points.**
    - "Merc plays nine white keys" (LESSON.md:107), in the treble, sits awkwardly with SEASON-2
      § 1.5 item 2, "Merc's demonstrations are written in the bass clef". The lead chose the treble,
      and the sound is the soft tone, not Merc's voice, so write "the climb plays nine white keys".
    - Gold on the clef's line (WEB-SPEC:62-64): MASTER-PLAN gives gold to "the fit (things that
      line up, the key relationship)". Say in one line why the clef's named line counts.

---

## Checked and found sound

- **Word count.** `node scripts/lesson-words.mjs`: 2,277 in all, 102 under the cap of 2,379, with
  each step's own text at 118, 118, 98, 111 and 118. Every section total matches WEB-SPEC Length,
  and the run-time arithmetic (2,277 / 238 = 9.57, plus 5.5, gives 15.07) holds.
- **Citations.** `node scripts/plan-cites.mjs check ...15-staff`: 302 read, 0 findings. I read
  about 70 cited lines at `c60f0fdcb` by content, and each says what the package says:
  - Compose: `COMPOSE_VIEWS`, the toast, the desktop "Split" tab, `isNarrow` at 768, the Place
    tool, Clear all notes with its undo step, the seeded C3 scale made current when there is none,
    and `seedDefaultSession` at boot.
  - The clef rule: `chooseClef`'s median.
  - The lesson marker; `stepAsideForLesson`; First Light's × and the `SKIP_COPY` confirm on `sky`
    only; `handleSkip` leaving the tab in place.
  - The takeover: `takeoverSuppressed`, where a tab route is not on the deep-link list, so FACTS 48
    holds.
  - The app-mode bounce: Compose is in the "studio" group, hidden in simple mode and in guitar
    scope.
  - `LESSON_ANSWER_BOUNDS` at [1, 14].
  - `VOCAL_RANGES` lines 92 to 142.
  - The kit: `voice-choice.ts`, `predict.ts` (free play, the hints, cut-short handling), `quiz.ts`
    (`linkAway`, `recallStepHref`, "Right."), Lesson 2's questions and pair (A4 to B4 then B4 to
    C5, 3.25 s), `next-card.ts` (`nextCard`, `next-tease`), `lesson-copy.ts` (`TEASE_MAX`, the
    rules), `season.ts` entries and comments, `drafts.ts`, `COUNT_IN`, `sound.ts`'s tones and
    compressor, `.viz` heights, `key-strip.ts`, `engraveClefs`, `merc-duo.ts`, the storage keys,
    `lesson-pages.test.ts`'s head and minutes checks (with "fifteen" in `MINUTE_WORDS`), the
    planning-text and stage-fit specs.
  - The stats snippet's staff colour and F-clef offset, and the glyph lines.
  - Plan files: SEASON-2's cited lines, CURIOSITY-MOMENTS rules 2, 4 and 6, MERC-BIBLE, Lesson 4's
    Notice, Lesson 16's cold open and predict, and Lessons 2 and 12's copy.
- **Sources re-read.** I fetched E&SJ 1.2 and Wikipedia "Clef" at revision 1377518537. Every
  quotation the package uses is there. The tenor tie rests on Wikipedia ("Tenor voice parts sound
  an octave lower and are often written using an octave clef"), as FACTS 26 says, and E&SJ names no
  voice or instrument. The viola is the encyclopedia's alone, as FACTS 27 says.
- **Music and arithmetic.**
  - Every staff position, line letter and space letter in both clefs.
  - The ledger counts: A5, C6, D4, C4 and A3 in the treble; E2, C2 and E4 in the bass; F3 on the
    treble's third ledger line and G2 on its sixth.
  - The grand staff's 9 + 3 + 9 = 21 white keys; G2 being 17 semitones below middle C.
  - A0 13 letters below G2 and C8 18 above F5; 88, 52 and 36 keys; seven octaves and a minor third.
  - The frequency table, all 27 notes.
  - Every play's length except nit 2.
  - The range table in FACTS 55: both margins for all six presets, the line middles, F's
    4-semitone minimum, and C's two floors.
  - The phone geometry: 234 px, 13 px spacing, 198 px, and 7 or 8 keys.
  - Line contrast: .26 gives about 1.8:1, .42 about 3.0:1, and .5 about 3.6 to 3.7:1 on both
    gradient stops.
  - Every quick-check answer and its feedback, including "two letters" counts and "more than an
    octave".
- **Predict.** Apart from finding 1, nothing before the reveal answers it: not the title, promise,
  gate, meta or og descriptions, share card alt (117), explorer card, or Lesson 14's card, which
  has no tease. The free climb plays nine notes and lights nine lanes, so "Nine" is the count just
  heard. With the predict now about places on five lines, that reads as "will all nine fit?", a fair
  predict, and five stays the intuitive guess after Tavi's "88 lines". The rewording away from the
  plan's "one on each line and in each space" is right.
- **Shared lines,** word for word against Lesson 12's LESSON.md and `learn/12.html`: the comfort
  check and its list, "Just listen today" (adapted as Lesson 12 adapts it), the voice prompt, the
  buttons and the stored-voice line, "Sing at about speaking volume.", the stop line, the guide
  line, the gentle and enough lines, and the doctor lines. The recall is Lesson 2's questions 2 and
  3 word for word, with the kit's "Try Lesson 2, Step N again". The first-visit lines are the
  series' wording plus "then tap "Yes, skip"", which the code bears out.
- **The lead's answers carried out.** Recall 2 is Lesson 2's question 3. The key is decided by the
  range check, G, with the reason in FACTS 55 and the key flagged for the coach (see findings 5 and
  6). The hero's nine notes are in the treble for everyone. WEB-SPEC Tests 13 holds the 390 px
  phone check, plus 360. The four-line staves stay out, with no "invented".
- **Other checks.**
  - The chip names Lesson 2 only, and the edge [2, 15] is right.
  - The head lengths hold: title 56, alternative 60, description 144, og:title 55 (the "·" is one
    character), og:description 115, twitter 69, teases 51 and 36.
  - Copy is British; no emojis, model names, paths or agent ids.
  - Both Tavi lines are sincere guesses or questions; Merc's line claims nothing.
  - Headings are Tavi's questions; finding 1 is about content, not form.

## Hand-back claims

- **Accurate:**
  - the word count, the plan-cites result and the run time;
  - the three "Corrections to the planning record": `LESSON_PAGE` is at `src/lesson-gate.ts:134`,
    the hub's "Season 1" at `learn/index.html:272`, and `COMPOSE_VIEWS` closes at `src/App.tsx:2346`;
  - the season entry, the lesson-copy entry and the team-notes names (`SIGNATURES`, `TEASE_NOTES`;
    `any-note` fits `VARIANT_ID`);
  - the departure list, which matches the preamble's 14 items.
- **Incomplete:**
  - "Leak check done" missed the step headings (finding 1).
  - "Item 10 in Lesson 17's list ... can close" holds for the buttons but not for the new clef line
    or Lesson 17 FACTS 29 and 52 (finding 11).
  - The no-rest-card reasoning leans on Lesson 12 and omits Lesson 8 (finding 4).
  - The vocal-coach list omits the octave-lower rows that fall below a preset (finding 5) and the
    lower voice's off-staff reading (finding 6).
