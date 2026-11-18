# Lesson 28 page plan, branch feat/lesson-28-page on feat/lesson-26-page (2e57b6efd)

Stack: main a1d447152 -> L16 -> L18 -> L20 -> L25 -> L27 -> L26 (137 commits) -> L28; PR base feat/lesson-26-page.
Read-only baselines: `plan-cites check` 301 findings (9 in L28's package); `lesson-words` L28 2,062 of 2,379; nothing
built or tested. Cites: L123 LESSON.md line, WS123 WEB-SPEC.md line, F123 FACTS.md line [fact no.]; code path:line
at 2e57b6efd, kit/ = src/features/lessons/kit/. Package read in full (LESSON 703, FACTS 191, WEB-SPEC 975 lines).

## The page
- Head (WS102-134): title "Types of cadence and song form | MercuryPitch" (WS111); description "How can a song sound
  as if it's ending, then keep going? A nineteen-minute lesson with sound toys and a song in two parts to sing."
  (WS113-114; 'nineteen' in MINUTE_WORDS, src/tests/lesson-pages.test.ts:87); og/twitter title "Cadences, form and a
  song in two parts · Find Your Pitch, Lesson 28", description = hook; learn/lesson-28-og.jpg 1200x630, alt WS121-123;
  Article PT19M, position 28, teaches WS126-128; llms.txt line at release (WS128-131).
- Masthead initMasthead(.., {lesson: 28, deck}) (kit/page-chrome.ts:127): "Season 2 · Lesson 28", Lesson/Sing/Explorer,
  no Watch; menu card "Lesson 28 · What makes a phrase sound finished?" (WS96-101). Kicker L134, h1 L135; chips L136-137
  (F41[2]): 19 minutes; "After Lesson 18: Read and sing a whole line" /learn/18; "After Lesson 26: A second voice"
  /learn/26 (plain where not live, kit/page-state.ts:68-69); Sound on; Microphone optional; Headphones optional.
  Promise L138-139, sound gate L149-150, section lines and headings L550-558, footer L538-543.
- Hero (L154-192, WS237-271, F93-99[40-46]): bubbles L166-167; song strip, 10 numbered boxes x 2 rows, Tavi's orange
  above, Merc's blue below, labelled, no note. "Play the song" [data-free], the song as it kept going, 33.33 s, bars lit,
  never G4 over G3. Stem L169-170, choices Tavi's part / Merc's part; lock L173 "Choose an answer to unlock both ways.";
  chosen "Locked in. Play both ways.", silent "Sound is off: nothing played. Turn sound on, then play it again.", again
  "Play either again.", no next (L175-182); "You said: Tavi's part" / "You said: Merc's part". "Play the ending" / "Play
  it going on", revealOn both, revealAfter 'all' (kit/predict.ts:59): bars 7-8, 6.67 s, written on a treble/bass pair
  with the sharp as they sound, the ending's pair above (WS252-257). Reveal L185-189 = [hero .reveal, Step 2's held
  words] (kit/predict.ts:71); onReveal hides Step 2's held line, rings Merc's bar-8 G3 and E3, numerals V I / V vi
  (L191-192), Tavi's "oh", no sparkles. onChoice opens the steps, Sing it, q4, free play; holdTour (kit/tour-gate.ts:63).
- Recall (L194-214, WS324-327, F48[7]): l18-q2 (lesson-18/quiz-questions.ts:75-95), l26-q2 (lesson-26/quiz-questions.ts
  :74-96); prefix recall-, keys fyp-l28-recall-seed / fyp-l28-recall-v1; recallStepHref (kit/quiz.ts:152), new tab,
  "Try Lesson 18, Step 2 again" from linkAway (kit/quiz.ts:201).
- Words (L216-225, WS316-320, F103[47]): Cadence L218 [Play: bars 3 and 4] 6.67 s on a small strip; Section L220, no
  play; Form L221 [Show the letters], four A A B A blocks, silent. None waits for the choice.
- Steps (L227-317, WS273-305; toyFor 1): treble over bass, brace, system bar lines, sharp after each clef, 4/4, bar
  numbers, house on both, breath commas after bars 2, 4, 6, cursor at 72 BPM, notes lit as they sound; "See it on the
  pitch line" = two bands, orange and blue. Before the choice: the strip's empty bars, all plays disabled under "Choose
  an answer at the top to unlock this figure." (L246-247). 1: [Play bars 1 to 4] L230-231, [Play bars 5 to 8] L232,
  13.33 s; tags "Imperfect: on V" over 4, "Perfect: V to I" over 8, numerals V / V I. 2: from bar 7, "Perfect ·
  Interrupted · Plagal" 6.67 / 13.33 (7-10) / 13.33 s (7-8 + tag, "A-" "men" under the Gs, IV I under the bars); end
  tags "Perfect: V to I", "Interrupted: V to vi", "Plagal: IV to I"; [Play bars 7 to 10] L254, [Play the ending, then the
  Amen] L257; text, mix-up L259-263, Try/Notice under "Hear both ways at the top to unlock this step." (L269) until the
  reveal. 3: form strip, block outlined and letter faded in as it plays, B written as it plays; [Play B, then A] L284,
  bars 17-32, 53.33 s; a block 26.67 s. 4: tap a staff = its part 26.67 s, Play both; [Play Tavi's part] [Play Merc's
  part] L302. Free play L531-534: every state, switch 1-4, same lock, held again on a return visit.
- Sing it (L319-436, WS339-488, F112-128[53-69]): bars 1-8 of the learner's part from the staff, on syllables or "ooh":
  lower voice Merc's (D3-B3, bass clef, do G3), higher Tavi's (F#4-D5, treble, do G4); no Move do, no octave (F127[68]).
  Microphone from Start only, MicHold('lesson-28') (kit/mic-hold.ts:22); the take is recorded in memory and read note by
  note, no count, no timing score (L354-359). Comfort L321-326 -> "Just listen today"
  L328-331 (Play the song, bars 1-8, 26.67 s; rest) | voice L337-343, line L340 -> headphones L350-352 -> briefing
  L354-383 -> [Start] (sound off: "Sound is off, so nothing played. Turn sound on to hear do, then press Start."
  WS376-377). Headphones: quiet check L370-375 on the other part's first 2.0 s, fails on a voiced run >= 0.3 s
  (kit/quiet-check.ts:29), before every run. Run: do 1.0 s (Merc G3 / Tavi G4), 0.4 s, a woodblock bar, "Counting in:
  one bar."; take opens 1/2 beat before bar 1 (kit/take-in-time.ts:55), recorder on; other part from bar 1, one contour
  voice, chrome; learner's notes amber; "Your turn: sing in time with the cursor." No headphones: [Hear Tavi's part
  first] (L363-368; nothing read or recorded) before each run, no check, silence, no `other`. +0.5 s: violet pitch line
  (kit/pitch-line.ts:69), lines L393-397; no voice L399 + [Start again]; voice: [Hear it with Tavi's part] [Delete your
  take], "The song ends V to I: a perfect cadence." (L402-409). Feelings L411-418 (kit/comfort.ts:56, :175,
  restAfterEffort); tricky line under 7 of 14 in band; 3 takes a visit (kit/take.ts:66). Sing-along L423-429 (again
  once); can't-record L431. Before the choice: staffs = strip, four plays under "Choose an answer at the top to sing or
  listen here." (L435). Higher voice swaps Merc and Tavi (L346-348). Reader (kit/read-in-time.ts:63-78): anchor =
  first voiced run >= 0.15 s in -0.25..+2 beats; windows +-0.25 beat; 60 c folded; heard 0.45 s; own beats after
  0.15 s, >= 0.3 s; other part, then neighbours 2; band 35 c; bar 8's G is own (F89[39]). Playback WS462-478: F-B =
  anchor shift, O = that run in the buffer, start(P, O-(F-B)) or start(P+(F-B)-O, 0).
- Quick check (L438-469, WS328-337, F142-145[77-80]): l28-q1..q4, fyp-l28-seed / fyp-l28-quiz-v1, lesson 28, three
  shuffled answers, "Right." / "Not quite.": q1 L448 "A phrase ends on V. Which cadence is it?" (Imperfect); q2 L452
  "Which cadence is called the Amen cadence?" (Plagal); q3 L456 "In A A B A form, what is B?" (The bridge, a contrasting
  section); q4 L461 "Listen. [Play] How does this phrase end?" (Interrupted), its Play reading "Play", bars 5-8 kept
  going, 13.33 s; q4 held under "Choose an answer at the top to try this." (kit/quiz.ts:66, :398).
- Wrap: L473-479; card L485-497, /karaoke-night?lesson=28 then /ear-lab?lesson=28, rest L495-497 "Rest today", second
  drill stays; Season 2's close; free play.

## Plays (F88[38], F149-151[81-83], WS524-580)
- 72 BPM: beat 0.833, half 1.667, whole = bar 3.333; 2/4/8/10/16 bars 6.67/13.33/26.67/33.33/53.33 s; song 106.67;
  breath 0.417 from the note before (bar 4's whole 2.92); count-in 3.33; run 31.4, 33.4 with check. MIDI/Hz: D3 50
  146.83, E3 52 164.81, F#3 54 185.00, G3 55 196.00, A3 57 220.00, B3 59 246.94, F#4 66 369.99, G4 67 392.00, A4 69 440,
  B4 71 493.88, C5 72 523.25, D5 74 587.33; tag C3 48 130.81, C4 60 261.63, D4 62 293.66, E4 64 329.63.
- A (L25-31, F79[29]): T B4 A4|G4 B4|C5 B4|A4w|B4 C5|D5 B4|A4 F#4|G4w; M G3 F#3|E3 G3|A3 G3|D3w|G3 A3|B3 G3|D3 D3|G3w.
  Kept going (F83[33]): 1-7, bar 8 E3w under G4w, 9-10 = 1-2. B (L41-44, F86[36]): T G4 A4 B4 C5|D5 C5 B4 A4|B4 C5 D5
  B4|C5h A4h|G4 A4 B4 G4|A4 B4 C5 A4|C5h B4h|A4w; M E3 F#3 G3 A3|B3 A3 G3 F#3|G3 A3 B3 G3|A3h F#3h|E3 F#3 G3 E3|F#3 G3
  A3 F#3|A3h G3h|D3w. Tag (F85[35]): G4w G4w over G3w G3w, soft IV C3 C4 E4 then I B3 D4.
- Hero 33.33; ending / going on 6.67 (T A4 F#4|G4, M D3 D3|G3 or E3); word 6.67; Step 1 2 x 13.33; Step 2 6.67/13.33/
  13.33; Step 3 53.33, block 26.67; Step 4 26.67 x 3; q4 13.33 (T B4 C5|D5 B4|A4 F#4|G4, M G3 A3|B3 G3|D3 D3|E3); listen,
  first turn, take, playback, sing-along 26.67; check 2.0 (B4 + A4, or G3 + F#3); do 1.0 + 0.4; 4 clicks 0.833 apart.
- Levels: each part "ooh" 0.2 (kit/sound.ts:62), tag 0.13 a voice (:54), do 0.2. Unset: run part and check (lab; L26
  0.1, lesson-26/sing-sounds.ts:29), woodblock (L26 0.1), playback (peak 0.5, kit/record.ts:42). Contour: glide 0.05
  (kit/part-contour.ts:28), D3 D3 dip 0.25 x 0.08 s (:31), breath dip 0.25 x 0.42 s (new).

## Kit inventory against needs
- Have (kit/): predict.ts:80 (:59, :67, :71); tour-gate.ts:63; quiz.ts `held` :66, release :398; words-strip.ts:54;
  step-deck.ts:105; now-playing.ts:39; sound.ts contourVoice :409, `at` :84, hush keep :667; run.ts:46-49 per-note
  kind/gain; woodblock.ts:37; beat-clock.ts:212; comfort.ts:56-175 (feelings, VisitEnding, practise card);
  voice-choice.ts:20; headphones.ts:40; quiet-check.ts:56, quiet-words.ts:13-21; listen.ts:43 `media`;
  take-in-time.ts:167 (`other`, `whose`); read-in-time.ts:267; read-along.ts:205; pitch-line.ts:69 (band chart);
  part-contour.ts:43 (repeated-note dip); record.ts:51-156 (playback alone); hold-flow.ts:120-138 (optional);
  lesson-copy.ts:232-234 tease; team-notes.ts:60; season-2.ts:396-397 edges; src/lib/lesson-marker.ts:11-20 and
  workers/db-worker/src/mirror-metrics.ts:62-63 (01-28). Not needed: tune line, chord beads, staircase, ring of rooms.
- G1, biggest, new: the song on two staffs. Staff toy: grand staff and brace (kit/staff-draw.ts:406), no stems, bars or
  metre (:17), no key on the grand staff (:207). Rhythm bar (kit/rhythm-bar.ts:420, -layout, -engrave, -draw): stems,
  bars, 4/4, halves, wholes, rows on one time axis, but one clef a scene (kit/rhythm-layout.ts:46), no key, no
  accidentals. read-marks (kit/read-marks.ts:407; house, breath :368, cursor, tags, dots): one row (:144). Needs a clef
  a row, keyPlaces (kit/staff-key.ts:66), brace, system bar lines, marks per staff, a cursor through both, bar numbers,
  tags over bars, numerals, words under notes, a ring, coloured lights, a two-part pitch-line view. Touches L16
  (tease.ts), L17, L18, L19 (rhythm-*), L18 (read-marks). rhythm-bar 756, read-marks 719, staff-draw 798 lines: add
  modules, none past 800 (docs/agent/METRICS.md:148).
- G2 song strip, form strip: new page code; the close's figure and L27's still are markup.
- G3 part under a take, count-in: L26 page code (lesson-26/sing-sounds.ts: startCountIn :72, bookPart :103, PART_GAIN
  :29, QUIET_GAP_SEC :33, CHECK_SEC :35) moves to the kit over bpm and beats; breath dips new. Touches L26 only.
- G4 runTake hands back F-B (anchor shift, or the first run unanchored); the page starts the recorder first, as
  lesson-14/sing-take.ts:214-241. Additive; touches L18, L26.
- G5 playback with a part, new in kit/record.ts: the buffer's first voiced run with the listener's YIN and 2048 window
  (src/lib/pitch-f0-stream.ts:21), loaded on Start; buffer and contour voice booked as one sound. L14 untouched.
- G6 small: fail line's second half (kit/quiet-words.ts:20-21 vs L374-375; L24, L26 write theirs in markup); recall
  drops l26-q2's `held` and TRY_SLOT (lesson-26/quiz-questions.ts:78-79); Sing it's lock (L26 had none).

## Next-lesson card and the tease still
- L28's card is Season 2's close; no Season 3 exists (kit/seasons.ts:19). The kit draws it: createNextCard(28,
  VisitEnding) -> `current === season.last` (kit/next-card.ts:116): "End of Season 2", "You've read a song in two
  parts. Now sing a whole song.", Karaoke Night /karaoke-night?lesson=28 in a new tab, See the season map; rest "You've
  read a song in two parts." and the map, redrawn on the ending (kit/season-2.ts:407-424, kit/next-card.ts:167-228,
  tests kit/next-card.test.ts:127-140, :506-523). Pass VisitEnding as lesson-14/wrap.ts:32. Slot figure WS500-502.
- L27's still (learn/27.html:1606-1645, lesson-27.css:332-361, lesson-27/wrap.test.ts:142-154): aria-hidden, class
  .l27-tease, 2 rows x 10 empty boxes, "Tavi's part" orange above, "Merc's part" blue below, Merc left, Tavi right, no
  bubbles, note or button: as WS516-522, F46[5b]. Disagreement: L28's strip numbers its bars (L155, WS68), the still
  has none. Add 1-10 to L27's still and test, or accept a miniature: the lead's call.

## Commits (L26's order)
C1 shell and registration as d52cad037 (24 files): learn/28.html (all held, Sing it panels, close mark and figure),
  public/learn/lesson-28-og.jpg, lesson-28/{main, lesson-28.css, page.test, page-dom.test-fixtures}, e2e shell;
  learn-next-card (L27 "Ready · 19 min" /learn/28; L28 closes Season 2), learn-lesson-menu (:288-291), learn-lesson-tour
  (:58-59, :549-552), learn-sound-gate (:45-46), learn-frame-loop; kit/drafts.ts 28, kit/season-2.ts (minutes 19, page),
  kit/{season-2, explorer-seasons, next-card, publish}.test.ts, lesson-admin.test.ts, tools/learn-hub.test.ts,
  src/lib/sw-runtime.ts, first-paint budgets, LESSON-TOUR.md, INDEX.
C2 refactor G3, L26 green. C3 kit: breath dips (Tests 9), runTake's onset (G4), reader at 72 BPM (Tests 7). C4 kit: G1,
  L16-19 tests untouched. C5 kit: G5 (Tests 10). C6 kit: fail line (Tests 8). C7 song.ts, sounds.ts (Tests 1-3).
C8 strip, form strip, steps' toy, free play (Tests 4-5). C9 cold open, rings, tour. C10 words, recall, check (Tests 6).
C11 Sing it: sing, -plan, -sounds, -view, each < 800 (Tests 7, 8, 11, 12). C12 wrap, close figure (Tests 13). C13 e2e.
C14 sitemap fingerprint (as af1cf694f). C15 As built, Length, ceilings, the 9 citations by hand, reanchor, INDEX.

## Browser tests (WS851-924, QA WS955-975)
- src/e2e/learn-lesson-28.spec.ts: 200, boot with no AudioContext, studio visitor (@smoke); 390x844 and 1440x900, 44 px,
  no sideways scroll at 344/390 (WS846-847); no staff for show (WS79-80); Tests 4, 5-6 with reload, 12 (listening, first
  turn, refused-mic sing-along), 13; one sound at a time; no mic before Start; own keys only.
- src/e2e/learn-lesson-28-sing.spec.ts (fake mic, helpers/tone-wav.ts writeStepsWav, as learn-lesson-18-sing, -14-sing):
  quiet check passes in silence, fails on a tone; run, lines, playback, Delete; Again to the third take; alone path;
  Effortful -> rest card and close; take in memory only (Tests 8, 10-12).
- Shared: learn-no-planning-text (T22, T31; finds learn/28, :49), learn-lesson-tour (hold), learn-next-card (L14 keeps
  Season 1's close), menu, sound gate, frame loop; build:e2e's first-paint budgets.

## Length
No Length in LESSON.md: WS155-179, F42[3] give 2,062 (confirmed; steps 100/104/109/116, Sing it 595, Wrap 251). Cap
2,379 (HANDOFF.md:267-272; scripts/lesson-words.mjs:181-194). L26 2,044+150+168 = 2,362, built ~2,360; L27 2,177, built
~2,395, 16 over, uncut. L28 2,062+150+159 = 2,371, 8 under (WS178; list WS163-175). Not in it: Start's sound-off hint
(15), "Locked in. Play both ways." (5), "Play either again." (3), Sing it's prompts and statuses (L26 ~154), first
turn and playback lines. Expect over; next cuts the can't-record line (16), then L413 (8) (WS214-217).

## Risks, open questions, spec vs kit
1 G1 is most of the work; B's 32 quarters a staff over 8 bars cannot fit one system at 344 px (WS846): two systems or
  a scroll is unspecified; the hero draws two pairs of staffs.
2 Spec vs kit: q4's answers "passed to unlocks" (WS332-335, F99[46]) fails, the quiz re-renders them; use held +
  release (lesson-26/recall.ts:107-108). l26-q2 "imported unchanged" sits held under L26's line: drop held and slot.
3 Spec vs kit: "Lesson 18's sing flow, as its spec moves it into the kit" (WS341) never moved; L18's and L26's flows are
  page code (lesson-18/sing-flow.ts, lesson-26/sing-plan.ts); only take and reader moved (680d0c6a1).
4 Spec vs kit: two-part plays as playNotes runs (WS550-556); the rhythm bar books on the beat clock
  (kit/rhythm-bar.ts:17-27). Choose per figure.
5 Clock: frames use performance.now (src/lib/pitch-f0-stream.ts:121, :151), not the audio clock F121[62] says; F-B is
  page-relative, fine; O needs the same window; MediaRecorder starts late; no round-trip correction: lab.
6 Spec conflict: the close's figure has a staff with no note (WS500-502, F159[85]) against "No decorative staff or
  clef anywhere" (WS79-80, L542-543) and L26's checks (lesson-26/page.test.ts:433, learn-lesson-26.spec.ts:150).
7 Draft line WS680 names only the coach; L123-128 also waits on L18, L26 live and the lab: word it as L26's.
8 Breaths: only the take's part dips (WS566-569); whether plays shorten the note before a mark (L18's do) is unsaid;
  the marks are the coach's call (WS791-794).
9 Levels: 0.2 a part (WS573-575), where L26's built listening play uses 0.13 a part; run, woodblock, playback: lab.
10 Unspecified: Section's figure (L223); one pitch axis or two rows (WS278-279); Sing it loads after first paint, so
  the choice can come first: hand it a chosen promise.
11 Stale package: WEB-SPEC items 3, 11-13, item 8's recorder and Listener.media and F137[75]'s plumbing have shipped,
  so WS505-514 and F44[5] describe an old kit. Citations: entry-pages quotes (F132, F138), LESSON_PAGE now
  src/lesson-gate.ts:142-143 (F137, WS678), micLatencySec :203-206 (F121), CURIOSITY and MASTER-PLAN off by one (F44, F45).
12 Stylesheet order: the recall's question modules reach others (18 -> 16, 17; 16 -> 9, 15; 15 -> 2's quiz-pair;
  9 -> 6 -> 4; 17 -> 8; 26 -> 12, 24 -> 10, 23); compare dist/learn/NN.html links with main (MISTAKES.md:1094-1102).
13 Owner: Season 2's closing words (WS787-790, already kit/season-2.ts:407-413). Coach: breath marks, D3 for lower
  voices (L625-627), alone path, playback, cues, feeling labels (L698-703). Lab (WS739-756): silence over the part from
  speakers, reader at 72 BPM, playback timing, levels, C3/D3 on a phone, chip timing, 344-390 px. Scored runs wait as
  a draft (L3-6).
