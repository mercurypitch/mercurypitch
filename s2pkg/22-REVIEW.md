# Lesson 22, "Vibrato": independent review

Package: `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/22-vibrato/` (FACTS.md 209 lines,
LESSON.md 555, WEB-SPEC.md 847), identical to the scratch copies in `s2pkg/22/`. App claims checked
against the worktree's `src/`, which is the app at `c60f0fdcb`. I ran only the two node scripts and
my own `python3 -I` simulations (in `s2pkg/22-rev/`, scratch only). The hand-back was read last.

Counts: **2 blocking, 9 should fix, 11 nits.**

---

## Blocking

### B1. The slow wave is not locked: quick check 3 and the Wrap's free play sound it before Step 3's choice

- **Where:** LESSON.md:49-52 (preamble, "Nothing before a choice plays its answer ... Step 3's slow
  wave waits for Step 3's choice"); FACTS 1a (FACTS.md:46) and 24 (FACTS.md:77); WEB-SPEC.md:304-308
  ("no other source on the page plays a wave slower than five swings a second before it"), Test 6
  (WEB-SPEC.md:765-768), page QA (WEB-SPEC.md:843). The lead's answer 5 (BRIEF-22) makes a locked slow
  wave the condition for a second predict.
- **What is wrong:** two sources on the page play it with no lock.
  1. **Quick check 3's play** is the slow wave itself: "±50 cents at two swings a second on A3 (or
     A4), 3.0 s, the sound Step 3's reveal names" (FACTS 71, FACTS.md:146), the same as Step 3's
     `two` play (FACTS 67). WEB-SPEC Toys 5 (WEB-SPEC.md:342-344) gives it no lock. The quick check is
     a scroll away from Step 3 on every layout.
  2. **The Wrap's free play** is "Every state above, with every control, Step 3's slow wave, Rate and
     Drift included, and no predict attached" (WEB-SPEC.md:282-283). Season 1's free play is never
     locked (`src/features/lessons/lesson-10/wrap.ts:11-12`, "nothing locked, since the guided steps
     come first on the page"), and Lesson 23 says outright that its free play "offers everything"
     before a choice (`lessons/23-perfect-tritone/WEB-SPEC.md:263-266`, `:647-649`). Free play's Step
     1 state (a straight note and a wave on the same note) also answers the cold open, which FACTS 1a
     says only the locked steps' toy could do.
- **Fix:** disable quick check 3's Play, and free play's two-a-second play, its Rate below 5 and its
  Drift, until Step 3's choice (Step 3's `onChoice` already exists for Rate and Drift). Give each a
  lock line, for example "Answer Step 3's question first to hear this." Hold free play's Step 1
  state until the cold open's choice, or say plainly, as Lesson 23 does, that free play is left open
  and why. Add both to Edge cases and to Tests 5 and 6, and correct the five places that say nothing
  plays a slow wave.

### B2. Today's hold-reader figures and three of the reader's tests leave out Voice Mirror's median filter, so they are wrong

- **Where:** FACTS 43 (FACTS.md:108: "±50 ... would read about 4.9 of 10 seconds ... ±40 about
  6.8"); WEB-SPEC item 6, last bullet (WEB-SPEC.md:661-663); Tests 8a, 8d and 8g
  (WEB-SPEC.md:773-774, :778, :781); the hand-back's proposed SEASON-2 § 5.2 item 22, which repeats
  the 4.9.
- **What is wrong:** both readers take their frames from Voice Mirror's `preprocess`
  (`src/features/lessons/kit/hold-take.ts:270`, `src/lib/mirror/metrics.ts:464`). That function
  median-filters each voiced run over 5 frames (`MEDIAN_WINDOW = 5`,
  `src/lib/pitch-measurements/f0.ts:34`; `preprocessF0Frames`, `:112-170`). The stream sends frames on
  animation frames, about 16 ms apart (`src/lib/pitch-f0-stream.ts:5-7`; the kit's own tests use
  `HOP = 0.016`, `src/features/lessons/kit/hold-take.test.ts:17`). A 5-frame median spans about
  65 ms, which is two-fifths of a 6 Hz cycle, so it flattens a vibrato's peaks. FACTS 43's figures
  are `(2/π) × arcsin(35/E)` on an ideal continuous sine (verify22.py, line 27), with no filter and no
  frames. I simulated `readHold`'s band test and Voice Mirror's fit through the 5-frame median on
  synthetic frames:

  | Wave | Hop | Today's in-band (FACTS says) | Fitted extent (Voice Mirror's function) |
  | --- | --- | --- | --- |
  | ±50 at 6/s | 16.0 ms | 6.1 to 6.4 s (4.9) | ±42 |
  | ±50 at 6/s | 16.7 ms | 4.0 to 10.0 s, by phase | ±36 to ±46 |
  | ±40 at 6/s | 16 to 16.7 ms | 10.0 s (6.8) | ±29 to ±36 |
  | ±60 at 5.5/s | 16.0 ms | 3.9 to 4.0 s | ±52 to ±53 (Test 8g says ±60) |
  | ±50 at 2/s | 16.0 ms | 4.8 or 4.9 s, by phase (Test 8d says 4.9) | n/a |

  So Test 8a's "where today's reader gives 4.9" fails. Test 8g's "described as ±60" cannot pass,
  because the spec requires the wave-finding function to be shared with Voice Mirror "so the two can
  never disagree" (WEB-SPEC.md:453-455). Test 8d's 4.9 depends on how the frames fall on the wave.
  The page's case still stands: the centre-line reader reads 10.0 for ±50 and ±60, and today's reader
  scores ±50 and wider as partly out. Only the numbers are wrong, and they are on their way into a
  shared plan file.

  A second consequence matters for the coach. For a real voice, Voice Mirror's extent, and so the
  page's vibrato line, reads low: about 0.85 of the sung extent at 5.5/s and 0.72 to 0.9 at 6/s from
  the median alone. The detector's 2048-sample analysis buffer (`FFT_SIZE`,
  `src/lib/pitch-f0-stream.ts:21`, about 43 ms) lowers it again. Voice Mirror's own test accepts 18
  to 40 for a ±30 wave, "allowing for windowing losses" (`src/lib/mirror/metrics.test.ts:531-533`).
- **Fix:**
  - Recompute FACTS 43 through `preprocess` at the kit's 16 ms hop, and say that today's reading of a
    ±50 wave depends on how the frames fall (about 6 of 10 at 16 ms; anywhere from 4 to 10 at 60 fps),
    while ±60 and wider stay well out.
  - Rewrite Tests 8a, 8d and 8g to expect what the shared function gives at the stated hop. For
    example, 8g: "described as Voice Mirror describes the same frames, ±52 to ±53 at a 16 ms hop".
    Or state the expected values as ranges.
  - Correct WEB-SPEC item 6 and the proposed SEASON-2 item.
  - Add to the coach's list that the line gives Voice Mirror's measured extent, which reads below
    the sung one.

---

## Should fix

### S1. The reader's gate and its extent both rest on one sine fitted to the whole hold, which FACTS 44 itself rejects

- **Where:** WEB-SPEC Toys 6, the reader (WEB-SPEC.md:449-476); FACTS 44 (FACTS.md:109); Tests 8.
- **What is wrong:** the running mean is applied only when `bestSinusoidFit` over the whole trimmed
  hold reaches 10 cents (`src/lib/mirror/metrics.ts:506-507`). The vibrato line then reports that
  fit's amplitude. FACTS 44 rejects the whole-hold sine for removing the wave because "a single sine
  fitted to the whole hold would slip out of phase as the rate wanders", but the gate and the
  description use exactly that sine. Hold 2's cue, "If a wave comes, let it", invites a vibrato that
  arrives partway through. My simulations, at a 16 ms hop:
  - ±50 at 6/s in the last 2 s only: fit 8.1, not found, read raw, **9.2 of 10**, so it counts
    against the singer.
  - ±50 at 6/s from 6 s on: found, reads 10.0, but **described as ±17**.
  - ±50 whose rate drifts from 5.5 to 6.5/s over the hold: found, reads 10.0, but **described as
    ±18**.
  - ±60 drifting from 5.0 to 7.0/s: described as ±15.

  The middle is read well; the description of the sound is not. The season's card asks for a line
  that "reports what was measured" (`docs/plans/find-your-pitch/SEASON-2.md:473-475`).
- **Fix:** add tests for a wave in only part of the hold, and for a wandering rate. Then choose one:
  - (a) gate on the detector's peak alone, or on a fit over a sliding window (for example the last
    3 s or any 3-s window), and take the extent from the residual, the raw line minus the middle
    line (√2 × its RMS, or half the median peak-to-trough). That number would differ from Voice
    Mirror's, so drop the "never disagree" promise for the extent.
  - (b) keep Voice Mirror's number and tell the coach it reads low for a wave that comes late or
    wanders.

  Either way, "a vibrato counts in full" needs a test for the late wave.

### S2. "Takes any wave out" claims more than the reader does

- **Where:** "What this does", LESSON.md:288-289 (and the coach's list, LESSON.md:525); FACTS 52.
- **What is wrong:** the reader takes out only a wave between 3.5 and 8.5/s whose whole-hold fit
  reaches 10 cents (WEB-SPEC.md:449-452, :727-728). A slow swing, a fast flutter and a late or
  irregular vibrato (S1) are read frame by frame.
- **Fix:** "it draws your line, takes a vibrato's wave out to find its middle, and measures how
  long that middle stays in Merc's band". Keep "A vibrato doesn't count against you" only once S1's
  late-wave case passes.

### S3. "From here the band holds the middle of the line" promises more than this page can

- **Where:** the mix-up card, LESSON.md:219-221; FACTS 22 (FACTS.md:75); preamble, LESSON.md:40-42.
- **What is wrong:** only this page's holds read the middle. Lesson 5's page, which a learner can
  revisit, counts raw frames (`hold-take.ts:285-291`). Voice Mirror counts a wave only out of its
  wobble figure. No later lesson is bound to the new reader. "From here" reads as a rule for the
  series. The restatement also says "a wider one" with no number, and it shows only with Step 3's
  reveal (LESSON.md:207). A learner who never answers Step 3 never meets the point where Lesson 5's
  rule stops being enough, although the cold open's ±50 wave has already broken it.
- **Fix:** "Lesson 5 said a small vibrato can sit inside the band. One wider than the band's 35
  cents swings past its edges, so on this page the band holds the middle of the line." Consider one
  clause in the cold open's reveal too, for example "...the band's own note: a wave this wide
  doesn't fit inside the band, but its middle does."

### S4. Tavi's bubble talks about a line the hero has not drawn, and the hero does not match the tease's still

- **Where:** LESSON.md:92-103; WEB-SPEC Toys 1 (WEB-SPEC.md:175-183).
- **What is wrong:** at first paint the band is empty ("no line at its centre"; the line draws only
  as the play sounds). Yet the bubbles "show from the start", and Tavi says "It peaks above the band
  on every swing." That is a comment on a wave nobody has seen or heard, against sound first. A
  learner arriving from Lesson 21's card has just seen a still of "Lesson 5's band, with a pitch line
  waving across both its edges" (`lessons/21-keys-circle/LESSON.md:378-381`), and the share card
  draws one too (WEB-SPEC.md:95-98), but the hero they land on shows an empty band.
- **Fix:** draw the wave's line on the hero at first paint, as a still with no centre (as the share
  card does), and redraw it as the play sounds. Or show Tavi's bubble only after the first play is
  heard.

### S5. A synthesised wave is labelled "measured"

- **Where:** LESSON.md:243, 247-251; WEB-SPEC.md:25, 56, 229, 273-281, 645; FACTS 68.
- **What is wrong:** Step 4's "measured wave" is the page's own sine, 5.5/s at ±30. FACTS, under
  Illustrations, says Merc's waves "are synthesised for the lesson and are nobody's measured voice"
  (FACTS.md:161-163), and the footer says every sound is synthesised. "Play the measured wave" tells a
  learner that a voice was measured.
- **Fix:** label the two panels "the voice's line" (or "the sung line") and "the app's mark". In
  the copy: "Play the sung wave", and "the sung line keeps its 11 swings".

### S6. The coach's list misses lines about vibrato and style

- **Where:** LESSON.md:435-547.
- **What is wrong:** the list gives "Step 4, every sentence", but these lines carry the same claims
  and are missing:
  - quick check 4's correct answer and its three feedback lines (LESSON.md:351-357);
  - the Wrap's third line (LESSON.md:365);
  - the one-sentence challenge, "why a note that swings 50 cents either way can still be in tune"
    (LESSON.md:367-368);
  - the mix-up card's restatement of Lesson 5's rule (S3);
  - the "Hold 2: floating" button label (LESSON.md:316).

  The hand-back's last note leaves the violet sung waves "for the coach to confirm", but the list
  does not carry them either. B2's low extent should join it too.
- **Fix:** add each, with the FACTS row it rests on.

### S7. Merc's sung note is drawn violet, a colour-code departure nobody has decided

- **Where:** WEB-SPEC Look (WEB-SPEC.md:44-49); LESSON.md:100-101.
- **What is wrong:** MASTER-PLAN § 5 says "Merc's sung model note on a pitch canvas is the amber
  target band" (`MASTER-PLAN.md:203-208`). SEASON-2 § 6.1 item 5 keeps "violet still means only the
  singer" (`SEASON-2.md:946-948`). Lesson 5's violet hook takes "belong to no Merc" (Lesson 5
  WEB-SPEC:116). Here Merc visibly sings (`mercSing`) while a violet line draws, and Lesson 21's tease
  calls it "its line", Merc's. In Sing it, violet is the learner's line and Merc's "ooh" is amber and
  steady, so on one page violet means two voices. The spec argues for its choice, but neither the
  departures nor Decisions for the owner list it.
- **Fix:** list it as a departure from MASTER-PLAN § 5, with the reason, under Decisions for the
  owner (and on the coach's list, as the hand-back intends). The alternative is to draw the waves as
  Lesson 5's hook does, with no Merc singing during them.

### S8. Step 3's lock hint tells the learner to choose while its choices are disabled

- **Where:** LESSON.md:201; WEB-SPEC.md:295-297, :304-306.
- **What is wrong:** until the cold open's choice, Step 3's choices are disabled in the markup, but
  its hint reads "Choose an answer to unlock the slow wave." On a phone, Step 3 is two Nexts into the
  deck, and the learner gets an instruction they cannot follow.
- **Fix:** until the cold open's choice, Step 3's hint reads like the steps' toy line, "Choose an
  answer at the top first."; it becomes "Choose an answer to unlock the slow wave." when its choices
  enable. Add this to Edge cases and Test 5.

### S9. The built page does print the reading's example lines

- **Where:** WEB-SPEC Length (WEB-SPEC.md:149-151); FACTS 3 (FACTS.md:48); hand-back.
- **What is wrong:** the spec says the three example lines (47 words) "are not printed on the built
  page, since it prints the learner's own", which would bring the built page to about 2,331 words.
  Lesson 5's built page prints its examples in the briefing, before any take
  (`learn/05.html:1513-1521`, "After each hold, one line, such as: ..."). The built page is then about
  2,378 words, 1 under the cap, on an estimate of "about 150".
- **Fix:** drop the 47-word claim and state the margin as about 1 word. Make the first named cut
  (Go deeper, 39 words) the default if the built count comes in over.

---

## Nits

1. **"On every swing" is not quite true.** LESSON.md:101 and :103, the reveal at :124-125 ("Every
   peak rose above the band"), FACTS 39 and 5b, and WEB-SPEC.md:209 and :842 all say the line crosses
   on every swing. With the 0.3 s grow-in at phase 0, the first swing's peak is 6.9 cents and its
   trough 20.8. The second peak is 34.7 cents, still inside the 35-cent band. So 16 of 18 swings
   cross. Fix: "Its peaks rose above the band" and "past both edges, swing after swing".
2. **The run time rests on rounding up.** FACTS 3's parts add up to 6.09 minutes (20 + 13.3 + 22 +
   32 + 35 + 15 s, + 2.8 min + 1.0 min), not "about 6.2". 9.36 + 6.09 = 15.45, which rounds to 15.
   Either show where the extra 0.1 minute comes from, or note that the chip and "A sixteen-minute
   lesson" may become 15 once the run is timed.
3. **FACTS 36 repeats a code comment, not the behaviour.** It says the analyser measures depth
   "peak to peak". `measureVibratoDepth` returns 2 × the mean windowed RMS
   (`src/lib/vocal-analyzer.ts:792-794`), which is √2 × the swing for a sine. Its comment says peak
   to peak, and `metrics.ts:492-494` calls it "2×RMS of the WHOLE signal". The detector's
   `depthCents > 10` therefore passes from about ±7. Fix: say "2 × RMS, which its comment calls peak
   to peak".
4. **"Wave" also counts the ribbon's cycles**, against FACTS 10's rule that "swing" counts cycles
   and "wave" is the vibrato as a whole: "its waves follow how wide the note is drawn"
   (LESSON.md:245), "the ribbon gains waves" (:248), and the live line "The ribbon now has 10 waves"
   (WEB-SPEC.md:281). Fix: "the ribbon gains swings" and "now swings 10 times".
5. **Go deeper's numbers assume the lower voice.** "For Merc's wave, 220 Hz, A3 exactly"
   (LESSON.md:234): a learner with the higher voice stored heard Tavi's wave on A4. Fix: "for Merc's
   wave on A3, 220 Hz exactly (440 Hz for Tavi's on A4)".
6. **Step 2's range parses two ways.** "Usually under a semitone, ±100 cents" (LESSON.md:185) can
   read as "usually ±100". Fix: "with an extent usually under ±100 cents, a semitone each way".
7. **Test 1 asks for grow-ins FACTS does not give.** It wants every play's grow-in "as FACTS 64 to
   71 give them" (WEB-SPEC.md:751-753). FACTS gives one only for the cold open, Merc's "ooh" and
   Step 1's wave. State one for every wave: the four words, Step 2, Step 3's two a second, Step 4 and
   quick check 3. At two a second, 0.3 s is 0.6 of the first swing.
8. **The no-wave case of the dashed middle is unspecified.** "After each hold, its middle draws
   itself as a dashed line" (LESSON.md:306; WEB-SPEC.md:393-396), but the reader returns a middle
   line only when it finds a wave (WEB-SPEC.md:456, :471-472). Say what Hold 1's straight take draws:
   no dashed line, or none.
9. **The reader's 3.5/s floor sits under the page's own source.** Sundberg says "for rates near 4 Hz
   and lower, the pitch is clearly undulating" (R7), yet the reader counts a 3.5 to 4/s wave in full
   as one note. Step 4's "reports a wave of 3.5 to 8.5 swings a second" (LESSON.md:243) also leaves
   out the 10-cent floor. Put it on the coach's list; no change needed if accepted.
10. **The tease names Merc, but the higher voice gets Tavi.** Lesson 21's settled tease, "Merc
    holds one note...", is false for a learner with the higher voice stored, for whom Tavi holds it
    (LESSON.md:99). Either Merc always sings the cold open (it is listening only), or note it as a
    known gap in FACTS 5b.
11. **Step 4's example numbers differ from its own play.** The example "Vibrato 5.6 Hz, ±38 cents"
    (LESSON.md:244) sits beside a played wave of 5.5/s at ±30. That is honest ("say,"), but the
    different numbers side by side invite a question. Consider "say, 'Vibrato 5.5 Hz, ±30 cents...'",
    or keep it and add nothing.

---

## Checked and found sound

- **Citations:** `node scripts/plan-cites.mjs check ...22-vibrato` reports 281 citations and 0
  findings. I read these cited lines by hand at the worktree's `src/`, and they say what the package
  says:
  - the hold reader: `hold-take.ts` 13-25, 39-49, 231-259, 285-291 and 330-343;
  - Voice Mirror: `MirrorApp.tsx` 65-69, 81-84, 143-148 and 2183-2199 (the report renders "Vibrato
    5.6 Hz, ±38 cents. That's a feature, not scored against you."); `metrics.ts` 66-74, 91-116,
    118-136, 424-428 and 496-511 (the 3.5 to 8.5 test is on the detector's rate, the fit at 10
    cents and the wobble share); `vocal-analyzer.ts` 707-710, 725-726, 738-752;
  - the voices: `demo-voice.ts` 33-37 and 293-311 (a sine on detune, phase 0 at start, linear
    grow-in per onset); kit `sound.ts` 30-46, 188-199, 321-347 and 561-584;
  - the predict and page chrome: `predict.ts` 12-17, 48-71, 113-131 and 158-174; `step-deck.ts`
    5-8 and 104-106; `lesson-menu.ts` 14-16, 111, 143 and 218; `tour-copy.ts` 44-46; `tour-gate.ts`
    29 and 36-69; `band-chart.ts` 5-12 (its default axis is ±150 cents, room for Drift's +100);
    `quiz.ts` 186-212 and 315; `comfort.ts` 14-21, 51-82, 101-114, 126-149, 159 and 175;
  - Lesson 5's code: `hold-flow.ts` 28-37; `sing-hold.ts` 5-20, 40-42, 60-88 and 106; `sing.ts`
    53-56; `quiz-questions.ts` 68-108;
  - the drills and the room: `effect-renderer.ts` 214-241 and 226; `piano-roll.ts` 5255-5257;
    `PitchCanvas.tsx` 1632-1638 (through `drawVibratoShape`); `exercise-help.ts` 28-45 and 91-98;
    `vibrato-styles.ts` 54-71; `use-vibrato-controller.ts` 12-14; `entry-pages.ts` 154-157 and
    176-177; `lesson-marker.ts` 11-19; `mirror-metrics.ts` 57-62; `match-bands.ts` 22;
  - the rest: `settings-store.ts` 91-152; `lesson-pages.test.ts` 84 and 154-210; `drafts.ts`
    31-41; `season.ts` 102-103, 408 and 452-457; `lesson-01/predict.ts` 19 (Merc's "ooh" is heard
    from Lesson 1).
- **Words:** `lesson-words.mjs` gives 2,228, as stated, with steps' own text of 89, 112, 109 and 117.
- **Lengths:**
  - the head: description 153 characters with "A sixteen-minute lesson" (the head test wants "A",
    not "An", for sixteen); og description 93; alt 136; titles 42 and 58; og:title 36;
  - the teases: 69 and 62 on Lesson 21's card; 67 and 66 on this one; all within `TEASE_MAX` 70.
- **Arithmetic:**
  - the notes: A3 ±50 gives 213.74 and 226.45 Hz, a geometric mean of 220.00, a plain average of
    220.09 and 0.72 cents between them; A4 + 50 cents is 452.89 Hz;
  - the shares: 0.506 of a ±50 wave's time is outside the band, 0.322 of a ±40 wave's (ideal
    sines); Drift leaves the band at 2.1 s;
  - the reader's leftover: 0.156 × 50 = ±7.8 cents at 7.2/s in a window for 6/s;
  - the counts: the ribbon has 5 waves at 120 px and 15 at 330 px; 5.5 × 2 = 11 swings; 3 × 6 = 18;
    3 × 2 = 6;
  - the range table matches `VOCAL_RANGES` (bass 40-64 ... soprano 60-84), with the least room 3.
  - Tests 8b and 8c pass in my simulation through `preprocess`: 10.0 and 5.8.
- **Shared lines, word for word against `learn/05.html`:** the comfort check (1341-1360), the listen
  line and doctor lines (1367-1375), the voice choice (1384-1421), the warm-up (1436-1471), the note
  line (1479-1480), the box's last two sentences (1500-1503), the briefing (1506-1511), the feelings
  lines (1676-1692), and the practice card with its one changed sentence (1821-1839). The rest card
  takes Lesson 12's "Rest today." form (`learn/12.html:1763-1765`). The recall's `l05-q3` and Lesson
  14's question 3 (its LESSON.md:294-300) match.
- **Leaks above the cold open's choices:** none. The title, the promise, the sound gate, the
  description, the share card and its alt, the step headings in the lesson menu, the recall, the
  Words (Extent names no middle; the straight note is on D), the explorer row and both teases name no
  middle, centre or average. The steps' toy is locked and the tour is held. Step 3's heading leans
  towards the wrong answer, which is acceptable.
- **Sources:** carried with their grades. The Shonle and Horan claim stays "near the middle" (the
  abstract only); "in one experiment" for R6; "choir experts' views range ..." for R11. Mitchell and
  Kenny, Nix, and Timmers and Desain are kept off the page. R13 and R14 are out and listed for the
  coach. RESEARCH's correction that the card's Long Note line is Lantern's is carried.
- **House rules:** British English; no emojis; headings are Tavi's questions; Tavi's lines are
  sincere guesses or questions; the reveals call the other choice a fair guess; no "Now play the
  other one" (no `next` hint); the rest card after Effortful (`restAfterEffort`); no health,
  anatomy or method line; nothing asks for a vibrato.
