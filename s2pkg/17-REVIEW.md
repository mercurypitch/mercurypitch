# Lesson 17 review: How long is a note?

Independent review of `docs/plans/find-your-pitch/lessons/17-note-lengths/` (FACTS.md, LESSON.md,
WEB-SPEC.md), against RESEARCH.md, ARTICLE-PLAN.md, SEASON-2 § 1, § 3 (Lesson 17), § 4.3, § 5,
§ 6 and § 7, the house rules, the model packages and the app at `c60f0fdcb`. The hand-back note was
read last. Read-only; the two node scripts were run; nothing else was run or edited.

**Counts: 1 blocking, 13 should fix, 15 nits.**

Line numbers are the package files' as they stand. "08 LESSON" is Lesson 8's LESSON.md.

---

## Blocking

### 1. Tavi's cold-open line voices no misconception, cues the answer and states a sound not yet heard

- **Where:** LESSON.md:82 (the line), :147 (Step 2), :98-100 (the reveal); FACTS.md:66 (fact 18),
  :41 (fact 1a); WEB-SPEC:501-502 (bubbles), :715-716 (Contract departure 3); the hand-back's
  CURIOSITY-MOMENTS entry.
- **What is wrong, three ways:**
  1. *Step 2 answers a guess nobody made.* Tavi says "Each quarter note lasted one second. Is that
     how long a quarter note always lasts?", a question, not a guess. Step 2 opens "Tavi's guess was
     half right." There is no guess to be half right. SEASON-2 § 3's preamble makes the card's
     misconception "Tavi's sincere guess (playbook rule 3)", and playbook rules 1 and 3 have Tavi
     voice the belief so the lesson can refute it. The plan's line did: "A quarter note must be a set
     length of time. Isn't that what the name says?" (ARTICLE-PLAN:31-32). The reveal's "which made
     'the same' a fair guess" also leans on a guess that is never voiced.
  2. *It leans the predict.* A host asking "Is that how long a quarter note **always** lasts?" just
     before "How long does each quarter note last now?" points to "no". That weakens the fair
     choice, "One second, the same". It is also a closed yes/no question, not the why, how or
     what-if MERC-BIBLE § 2 and playbook rule 4 ask of Tavi.
  3. *It states a play's result before the play.* The hero's bubbles are static markup, shown at
     load (Lesson 8's built page: `learn/08.html:372-379`), and the spec never says Tavi's bubble
     waits for the first play. So at load the stage says "one second" before any sound. That breaks
     sound first, and it contradicts FACTS 1a: "Before the first play the stage shows no number at
     all".
- **Fix:** restore a sincere guess that voices the misconception and stands before any play. For
  example, Tavi: "A quarter note must last a set time. Isn't that what makes it a quarter note?", or
  the plan's line. Keep Merc's line. Step 2's "Tavi's guess was half right" then holds. If the line
  must keep reporting the first play, the spec has to show both bubbles only once that play ends
  (Toys 2 and 3, FACTS 1a), and Step 2 still needs a guess to answer. Update FACTS 18, Contract item
  3 and the hand-back's CURIOSITY-MOMENTS entry.

---

## Should fix

### 2. The recall, open under the hero, prints the predict's key fact as an option

- **Where:** LESSON.md:102-114; FACTS.md:41 (1a), :49 (7); WEB-SPEC:129-130.
- **Evidence:** Recall question 1 lists the option "120 beats every minute: two a second". With the
  quarter note on the beat, that is the predict's answer, "Half a second". FACTS 1a accepts it
  because the recall comes after the cold open in page order. But CURIOSITY-MOMENTS § 3.1 measured
  the predict's choices starting below the first screen on every phone page (963 to 2,504 px). The
  recall section starts right after the predict card. A learner who scrolls on before choosing
  reads the cue first. The brief's leak list includes "any toy or label shown before the reveal".
- **Fix (pick one):** ask Lesson 8's question 4 ("Same song, same speed ... What changed?", tempo
  against rhythm) in place of question 1. Step 2 already recalls the fact: "In Lesson 8, 60 BPM
  meant one beat a second and 120 meant two." Or keep the recall closed until the predict has
  revealed. Update FACTS 1a and 7.

### 3. "No woodblock in the kit or the app" is false: the Ear Lab's default click is a woodblock

- **Where:** FACTS.md:128 (62), :153 (75: "no such sound in the kit or the app"); WEB-SPEC:713-714
  (Contract 2: "there is no woodblock in the kit or the app"); LESSON.md:37-38; hand-back departure
  2 ("Neither the kit nor the app has a woodblock").
- **Evidence:** the Ear Lab's click synth has three voices, "a bright tick, a woodblock knock or a
  low, soft tap" (`src/features/ear-lab/click-synth.ts:8-9`; the `wood` voice, :45-52). The Ear
  Lab's default click voice is that woodblock: "so the default is the woodblock and the tick stays a
  choice" (`src/features/ear-lab/ear-sound.ts:7-9`), `'wood'`, "a round woodblock, kind to earbuds"
  (:34-35, :43-44). The Chart's tap tick and Pulse's call use the room's click voice
  (`ChartDrill.tsx:205`, :255; `PulseDrill.tsx:151`). So the drills the practice card sends the
  learner to answer in a woodblock by default. FACTS 62 is true only of the lesson kit and the
  shared drum set (`drum-voices.ts:10-22`).
- **Fix:** state the reason truly. For example: the lesson kit has no woodblock (the Ear Lab's
  lives in its own click synth, wired to `ctx.destination` outside the kit's buses), and the page
  keeps Lesson 8's click for continuity. Or move the `wood` voice into the kit and use it, to match
  The Chart. Correct FACTS 62 and 75, Contract 2, the preamble and the hand-back.

### 4. The dotted quarter is named but never heard or written; the plan's example was dropped

- **Where:** LESSON.md:203-204 ("a dotted quarter one and a half"); WEB-SPEC:242-248 (Dot makes only
  a dotted half); FACTS.md:81 (27), :105 (45); the practice card, LESSON.md:331-332 ("you've met
  every other note it writes").
- **Evidence:** the plan's Step 5 played "dotted half then quarter; dotted quarter, eighth, half;
  a quarter tied over the bar line" (ARTICLE-PLAN:120-121). The package keeps the first and the
  third. Nothing on the page plays or writes a dotted quarter: not the four words, not the toys, not
  the quiz. SEASON-2 § 1.4 item 1 has every idea arrive after its sound. The Chart writes dotted
  quarters in three of its fifteen patterns: "off the beat", "mixed" and "2 bars · and" (re-derived
  by hand from `VALUES` and `pickNote`, `rhythm-notation.ts:57-94`, on `banks.ts:251-306`). So "you've
  met every other note it writes" is true of the dotted quarter only as a sentence. The departure
  is not listed.
- **Fix:** let Dot also turn bar 2's first two quarters into a dotted quarter and an eighth
  (quarter, quarter, half becomes dotted quarter, eighth, half: the plan's example), with the strip
  reading "1.5 s" and "0.5 s". Or give the page a second Dot. Add it to Tests 1 and 3, and list the
  change.

### 5. On the bass staff, A3's stems must point down; the spec leaves stems to "the engraving"

- **Where:** WEB-SPEC:199 ("stems up"), :203-205, :311-315 (the slide), :585-586 ("stems as the
  engraving draws them"); FACTS.md:152 (74: "no source read").
- **Evidence:** Open Music Theory 2e, 1.2 "Notation of Notes, Clefs, and Ledger Lines", section
  "Stems and Beams" (read 1 November 2026): "For notes above the middle line, the stem points
  downward, and for notes below the middle line, stems point upward." A3 is the bass staff's top
  line, above its middle line, D3, so its stems point down. A4, in the treble's second space, sits
  below the middle line, B4, so its stems point up. The one-line drawing has every stem up, and
  SEASON-2 § 6.1 item 1 records the stats snippet's known limit: "a jump across the middle line does
  not flip the stem". The lead's answer asked for C3 and C4 (BRIEF-17, answer 2). Those notes, the
  bass staff's second space and the treble's ledger line, would have kept every stem up. The move
  to A is well argued (FACTS 57), but this consequence goes unweighed.
- **Fix:** the spec says that on the bass staff A3's stems point down, its ties curve above and its
  dots sit in the space above the top line, and that the slide flips the stems; on the treble staff
  A4's stems stay up. FACTS 74 becomes a sourced fact from OMT 1.2. Tests gain the staff engraving
  for each clef.

### 6. Step 5's bars are on the staff before they are heard

- **Where:** WEB-SPEC:311-315 (as the step opens, "the notes slide to A's line or space"), against
  :206-209 ("before its first play a changed beat shows only its pad").
- **Evidence:** Step 5's two bars (half, quarter, quarter; quarter, quarter, half) are new. Step 4
  ends on four quarters. The slide moves written notes onto the staff before Step 5's bars have
  played.
- **Fix:** let the staff draw in empty, or carry Step 4's heard bar across and then replace it.
  Step 5's bars are written by their first play, and Dot and Tie redraw them as they play.

### 7. Rest notation: a half rest on beat 2, and two or four rests in one beat

- **Where:** WEB-SPEC:224-232 (Note · Rest, "A beat that holds eighths or sixteenths turns each of
  them"; the rest strip's "quarter, half rest, quarter").
- **Evidence:** in 4/4, a half rest from beat 2 hides beat 3. A whole silent beat is written as one
  quarter rest. V. Williams, "Adding Rests", My Music Theory (an ABRSM and Trinity Grade 2 page,
  updated 7 November 2025): "Always combine rests that equal TWO, THREE or FOUR beats into longer
  rests, but ONLY if they fall on the strong beat of the bar."; "Rests should make up complete
  beats."; "Write rests that equal ONE BEAT and place them ON the beat"; beat 3 must stay visible in
  4/4. OMT 1.8 and 1.9 give no placement rule (checked). The app's `pickRest`
  (`rhythm-notation.ts:96-110`) only asks a rest that runs through a beat to start on a beat and
  last whole beats, so it would write the same half rest. The kit's model has to carry the rule.
- **Fix:** make the half-rest example "quarter, quarter, half rest, then the next bar's quarter",
  as the whole rest's is. Engrave a silent beat as one quarter rest, whatever it held; the model
  keeps the notes for the toggle back. Optionally, write two silent beats on 1-2 or 3-4 as a half
  rest. Add a FACTS row with the source, and a test.

### 8. Free play's two bars break the 44 px target, and Dot and Tie are undefined there

- **Where:** WEB-SPEC:441-446 (every control "on two bars"); FACTS.md:139 (70); the Contract's
  44 px rule.
- **Evidence:** two bars are eight pads. 356 / 8 = 44.5 px before any gap at 390 px. At 344 px the
  inner width is 310 px, so 38.75 px. FACTS 70's 44 px holds only for four pads. Dot and Tie are
  defined only on Step 5's fixed bars (bar 1's half note, bar 1's last quarter). In free play those
  may not exist.
- **Fix:** on phones, draw a row a bar (the second bar under the first, as Lesson 8's strip does),
  or keep free play to one bar plus Step 5's two-bar staff. Define Dot and Tie on a chosen note,
  with when each is unavailable and its hint. Add both to the layout spec.

### 9. The stopwatch strip cannot fit its readings at sixteenth width

- **Where:** WEB-SPEC:319-325 (one cell per symbol, "each as wide as its symbol's place in the
  bar"); FACTS.md:139.
- **Evidence:** a bar of sixteen sixteenths gives cells of about 22 px at 390 px (356 / 16), and
  less at 344 px. Each would have to read "0.25 s". Step 1 invites exactly that bar.
- **Fix:** give narrow cells a rule. One reading per beat for a run inside a beat ("4 × 0.25 s")
  is one way. Test the strip at 390 and 344 px.

### 10. Play both, and the tie's ticket, are not bars, though the model insists every bar adds to four beats

- **Where:** WEB-SPEC:192-196 ("The values always add up to the bar's four beats"), :238-241 (Play
  both's first row: two eighths and a quarter, two beats), :291-295 (the tie ticket: two beats, a
  pause, two beats).
- **Fix:** make both of Play both's rows full bars. At 60 BPM: two eighths, a quarter, two eighths,
  a quarter (one bar, 4 s). At 120 BPM: two quarters and a half note, twice (two bars, 4 s). The
  strip reads 0.5, 0.5, 1, 0.5, 0.5, 1 under both. The card's claim still holds (LESSON.md:158-160;
  FACTS 17). For the words strip's tickets, say they are figures with no time signature and no bar
  line.

### 11. The proposed season entry would print "The Chart, then tap The Chart"

- **Where:** WEB-SPEC:538-540; the hand-back's `kit/season.ts` block.
- **Evidence:** the explorer prints `${label}, ${note}` (`src/features/lessons/kit/explorer.ts:179-182`).
  Season 1's Ear Lab entries use `label: 'Ear Lab'` with `note: 'then tap Leap'` and the like
  (`season.ts:194-197`, :278-281, :358-361, :388-391).
- **Fix:** `label: 'Ear Lab'`, `note: 'then tap The Chart'`.

### 12. The proposed tease says "Only the click speeds up", which the sound contradicts

- **Where:** FACTS.md:47 (5b); WEB-SPEC:553-555, :610-617.
- **Evidence:** in the 120 BPM play, the notes, which sound with the clicks, come twice as fast too.
  Read literally, "only the click speeds up" points to "One second, the same". FACTS 5b's own gloss
  is "with only the click's tempo changed". A tease must be true (CURIOSITY-MOMENTS § 1 rules 6
  and 7).
- **Fix:** "Same written bar, played twice. Only the tempo changes." (55 characters). It still
  names no length, and the predict itself names 120 BPM.

### 13. Departures the Contract does not list, and gaps in the coach's list

- **Unlisted departures.** LESSON.md:36-43 and WEB-SPEC:708-732 claim to list each departure (the
  hand-back says "all twelve"). Missing:
  - (a) Tavi's line no longer voices the misconception (finding 1).
  - (b) Step 1's five example bars, whole to sixteenths, "each bar played then written"
    (ARTICLE-PLAN:72-73), are replaced by free Halve and Join with no guided sequence. The text names
    flags, two flags and beams that a learner sees only after halving a beat twice. Consider a "Play
    the halvings" demonstration.
  - (c) Step 3's "bar of eighths counted aloud by Merc" (ARTICLE-PLAN:99-101) is gone. Merc never
    counts (WEB-SPEC:503-504), and Step 3's toy holds no bar of eighths, so "1 and 2 and 3 and 4 and"
    is neither heard nor shown there.
  - (d) Count's "fade on second play" (ARTICLE-PLAN:102) is dropped.
  - (e) The dotted quarter example (finding 4).

  List each with its reason, or restore it.
- **Coach's list** (LESSON.md:380-426). Missing items:
  - the adapted Move sentence, "If the note feels high, move it lower; if it feels low, move it
    higher." (LESSON.md:266-267). It is new to the series and has no FACTS row.
  - "Move the note", with its labels and readout (WEB-SPEC:421-424).
  - "Then, if you like, sing it. This part is optional, and nothing listens." (LESSON.md:242).
  - the sung part's status lines, with "Merc's bars" (LESSON.md:283-284; WEB-SPEC:401-407). Lesson
    8's coach list carried its own (08 LESSON:427-433).

  Add them, and add a FACTS row for the Move sentence.

---

## Nits

1. **Join's hint** (WEB-SPEC:220-222). "Join needs a quarter on both beats of the pair." is wrong for
   a half note whose partner half is split, and for a whole note. Give one hint for each case.
2. **The take's line starts with a digit** (WEB-SPEC:374-381; LESSON.md:231-232). "7 of 9 notes got
   a tap." breaks the spec's own rule, "A count that starts a sentence is a word". Exempt N
   explicitly or reword. With N = 0, the "and" clause repeats the count.
3. **FACTS 3's 20.5 s.** FACTS 65's four plays sum to 21 s (8 + 4 + 4 + 2 + 1 + 2). The chip is
   unaffected.
4. **"as The Chart plays its bar back after each round"** (LESSON.md:239-240). The Chart's replay is
   on request at the reveal (`use-identification-controller.ts:349-355`) and sounds clicks on the
   onsets (`ChartDrill.tsx:240-277`). Say "as The Chart lets you hear its bar after you answer".
5. **"the syllables echo North Indian tabla drumming"** (LESSON.md:182-183). The paper's note 10 says
   "similar to those used in North Indian tabla playing" (verified in the musescore.org copy).
   "Echo" can read as descent. FACTS 24's "are like those" is exact; use it.
6. **Clipped numbers** (LESSON.md:136, :149-150). "sixteen sixteenths, with two", "a half note 2",
   "they last half a second and 1": say "two flags", "2 seconds" and "1 second".
7. **Workflow words in lesson files.** "hand-back" (FACTS 1, 5, 5b, 40, 52; WEB-SPEC:533), "the
   brief" (FACTS 73; WEB-SPEC:533). No Season 1 model package uses them. Say "for the lead" and
   "ARTICLE-PLAN.md, Go deeper". Name the simulation script (`sim17.mjs`, no path), as Lesson 12
   names `verify12.py`.
8. **The pitch-line switch** is "every toy's" (WEB-SPEC:90), but Toys 2, 4 and 7 have none. Say
   which toys carry it, and why the checkpoint does not.
9. **The built page will be over the cap.** 2,309 + about 150 for hints and status lines
   (WEB-SPEC:165-168) is about 2,459, roughly 80 over 2,379, and the chip would be about 16. The
   listed cuts total 66 words. Say so plainly.
10. **`STANDALONE_DOCUMENT_PATHS`** (SEARCH § 12 item 3) is missing from WEB-SPEC item 2's release
    list.
11. **Lesson 15's clef line.** Lesson 15's draft now keeps Season 1's voice buttons and adds "Your
    staff follows your choice: the bass clef for the lower voice, the treble clef for the higher."
    (15-staff/LESSON.md:245-247). Lesson 17's voice choice also sets the clef, but FACTS 52 still
    describes the plan's clef-naming buttons. The lead should reconcile them.
12. **"only quarters, halves and eighths"** (LESSON.md:341; WEB-SPEC:539). The proposed subset
    includes dotted quarters and an eighth rest (`c-e-off`, `c-e-across`). Name them, or drop those
    two patterns.
13. **When the 4/4 is drawn.** Step 1's text points at "the top 4" and "the bottom 4", but the spec
    never says when the time signature appears. Look lists it among the notation, but Toys 1 and 2
    are silent.
14. **The tease still** (WEB-SPEC:471-476; LESSON.md:351-354). Its clef and notes are unspecified,
    and it is a staff that never plays. Name the clef (the learner's) and the notes, and either put
    a Play above the card (CURIOSITY-MOMENTS § 3.1 allows one) or say why it is exempt.
15. **Try lines that ask for a play.** LESSON.md:140 and :195 say "and play the bar", but each press
    plays the bar at once (WEB-SPEC:222, :225). Align them.

---

## Checked and found sound

- **Citations.** `node scripts/plan-cites.mjs check …/17-note-lengths`: 124 citations, 0 findings.
  About 60 cited ranges were read at `c60f0fdcb` and say what the package says:
  - the notation module, the take judge, the tap ledger and tap rule, the latency estimator and
    `PULSE_TIMING`;
  - Lesson 8's take judge, quiz questions and quiz play;
  - The Chart, Pulse, `RhythmScore`, the anchored take, the bench entries, the bank and its picker;
  - `pendingEarDrill`, the lesson marker, First Light and the Ear Lab's entry page;
  - the kit's season, lesson-copy, next-card, quiz, voice-choice, move-do, comfort, beat-clock,
    sound-ahead, predict, beat-strip, now-playing, explorer-figures, page-chrome and glyphs;
  - the presets, the drum voices, `llms.txt`, and every plan-file line.

  The writer's catches hold: the stale `PULSE_TIMING` comment against the silent wait
  (`anchored-take.ts:13-15`, :120-126), and "rest on 2" written with no rest.
- **Sources.** The OMT 2e quotes in FACTS 12, 20, 21, 26, 27 and 28 were checked against LibreTexts
  1.8 and 1.9 today, verbatim: dots, ties, rest values, flags, "Beats that are not counted out loud
  are written in parentheses.", "“a” (pronounced “uh”)", held counts, Example 17 and "A Note on
  Ties". The Hoffman, Pelto and White quotes (pp. 8-9, p. 14, note 10) were checked in the cited
  copy. The download was deleted afterwards. Weak sources stay off the page (FACTS 25, 73).
- **Arithmetic.**
  - All fifteen bank patterns' written values were re-derived by hand: they match FACTS 45 and the
    subset list.
  - The checkpoint: nine notes at 0, 1, 2, 4, 4.5, 5, 6, 6.5 and 7 beats; its counts; the take's 20
    beats and 20.95 s; `barMs` 7,380 ms with the judge's filter top at 7,500 ms
    (`rhythm-take.ts:99-101`); lining up on beats 4 to 11; 120 ms under half an eighth's 500 ms.
  - Seconds at 60, 100 and 120 BPM; Play both's seconds; every quick-check answer.
  - FACTS 57's margins (9 to 17, 7 to 15, 9 to 16, 8 to 15, at least 3 after Move); FACTS 61's
    frequencies.
  - A3 is the bass staff's top line and A4 the treble's second space.
  - The head title is 57 characters, the description 159, both teases 57.
- **Shared lines.** The comfort check, "Just listen today", the voice choice and its two forms, the
  stop line, "Sing at about speaking volume.", the four feelings and their lines, the doctor lines
  and the rest card match Lesson 8's LESSON.md and its built `learn/08.html` (lines 1270-1372) word
  for word, apart from the declared adaptations.
- **Leaks.** The title, head title, description, share card, promise, sound gate, the hero before
  the reveal (empty line, no number, polite region), the explorer figure, and Lesson 18's tease
  (which drops the card's "Put the two together") give nothing away. The leaks found are findings
  1, 2 and 12.
- **Length.** `lesson-words.mjs` gives 2,309, 70 under the cap. Steps run 120, 118, 118, 109 and 113.
  FACTS and WEB-SPEC phrase the count as the golden test reads it, so Lesson 17 can join `GOLDEN`.
  Any fix above must be re-counted.
- **Copy.** The British-spelling scan is clean. No emojis. The step headings are Tavi's questions.
  No feedback line starts with "Right", "Yes" or "Correct".
- **Voice safety.** The comfort check comes before singing. Nothing listens and nothing is scored.
  The stop line and doctor lines are in place. The rest card follows Effortful, Uncomfortable or
  Just listen today. At most two guides a visit.
- **Departures.** Departures 1, 4 to 10 and 12 are argued and sound: A3 and A4 for range and
  staff, nine notes not eight, brackets as OMT writes them, Step 4's own rest, Play both, the silent
  wait, Hear the bars only after the take.

## Hand-back claims

- **Hold:** the word count, plan-cites, the stale comment and the nine notes.
- **Do not hold:**
  - "Neither the kit nor the app has a woodblock" (finding 3).
  - "The WEB-SPEC's Contract lists all twelve" (finding 13).
  - The season entry's `label: 'The Chart'` (finding 11).
  - The CURIOSITY-MOMENTS entry, which carries Tavi's line (finding 1).
  - "Leak check done", which missed Tavi's line and the recall (findings 1 and 2).
  - Departure 1 says the staff comes in Step 5 "as the lead's question 2 asked", but that answer
    named C3 and C4 (finding 5).
- **Not run:** the simulation, under this review's rules. Its logic, read in `sim17.mjs`, matches
  WEB-SPEC Toys 7.
