# Lesson 19 spec digest (lead's reading notes; the spec is lessons/19-threes-offbeats/WEB-SPEC.md)

Branch feat/lesson-19-page in W (l10-page) from main 4f8c9b3ec (Lesson 17 merged). Lead-only
(rate limit allowed_warning until 12 Nov 01:00Z). Pattern: Lesson 17's page (#1366) for everything
shared; l17/PLAN-B.md for the step shape.

## Intro and checkpoint (spec lines 1-61)
- "Threes, offbeats and syncopation". Text-only: no film, no Watch; masthead anchors Lesson, Tap the
  beat, Explorer. NOTHING IS SUNG on the page (no #sing; tour copy item 13).
- One object: Lesson 8's pads, SIX in a row. Hero: six even notes, then grouped in threes and in
  twos. Step 1: the six written as a bar of 6/8 or 3/4. Step 2: two tunes in those metres on the
  learner's staff with counts. Step 3: one beat of a 4/4 bar splits in three (triplet). Step 4: a
  note leaves beat 3 for the "and" before it (syncopation). Card signature (FACTS 4).
- learn/19.html + src/features/lessons/lesson-19/, wired as Lesson 8's/17's. drafts.ts in its first
  commit; publishes only after /learn/17 is live (chip + recall link there); nothing waits on the
  vocal coach (FACTS 51). L18's card shows this lesson's tease; this page's card shows L20's tease
  (season data, never in markup; FACTS 5, 5b).
- Checkpoint (FACTS 31-36, 69): TAPPED, on Lesson 17's take, no mic. Two tunes (6/8 then 3/4), EACH
  PLAYS TWICE: pass 1 click on every beat, learner taps with it (lines taps up); pass 2 the click
  stops, learner keeps the beat alone, JUDGED. Estimator: Drum Night's, 0-250 ms, needs 5 taps,
  median offset of pass 1 applied to pass 2 taps. Window 120 ms (TOLERANCE_MS.quarters); beats 1 s
  or 0.67 s apart. Ear Lab judgeTake imported. Line: counts beats that got a tap and taps between
  them, and NAMES THE OTHER METRE'S BEATS when most extra taps fell there. Early/late drawn as ticks
  (pass 2 taps) not said; strip aria-hidden, the line speaks. Everything on the audio clock via the
  beat clock.
- Kit needs (spec 391-431): rhythm model past 4/4 (6/8, 3/4, 2/4; beams by beat; dotted quarters
  and halves; beamed triplet with its 3; tie at beat 3; bracketed counts); six-pad row + arcs in the
  kit beat row; six cells/bar in kit/beat-strip.ts (hero); Subdivide's drums through the beat
  clock; tap take generalised (any backing, click that stops for the judged pass, beats as onsets,
  other-metre clause); merc-hop (lead 0.6 s, HOP_MS early); lesson plumbing for 19 (answer bounds,
  admin console); tour body for a page with nothing sung (a list like LISTENING_LESSONS; body e.g.
  "They teach every lesson. Listen along, then try each idea yourself."; optional "Your turn to tap"
  stop on #tap). No owner decisions open; lead picks this lesson's tease (+ alt) on L18's card and
  L20's tease (+ plan line as alt) at review (FACTS 5, 5b).

## Look, Sections, Length (spec 62-148)
- Look = Lesson 17's. Notation ink #e6edf3 on chrome #c3ccd6 incl. triplet's 3 and 6/8, 3/4, 2/4,
  4/4; lit note blue #58a6ff on bass staff, orange #ff7448 on treble (FACTS 10). GROUPS = an ARC under
  each group of pads, ink-2 #a8b3bf, drawn as each group starts (two arcs of three, or three of two);
  no arc before a choice (FACTS 1a). Gold #ffd84d only for a tick whose tap met its beat. Counts
  ink-2, lit ink as the note sounds; bracketed count stays ink-2 (FACTS 28). No decorative
  staves/clefs. No target band, no singer violet, no mint. Reduced motion / Pause animations: no idle
  or hop; arcs and notes appear at once; sound still plays.
- Sections (Lesson 2's order, FACTS 5a): 1 masthead "Season 2 · Lesson 19" anchors Lesson / Tap the
  beat / Explorer, menu card "Lesson 19 · What do the numbers in 6/8 mean?"; 2 hook (kicker, h1.hook#hook,
  three chips, promise); 3 stage (Tavi + Merc bubbles, six pads between them, Toys 2); 4 sound gate;
  5 #predict under the stage (Toys 3); 6 section#recall from Lesson 17 (Toys 9); 7 four words:
  accent, offbeat, triplet, syncopation (Toys 4); 8 steps "N of 4" on one toy (Toys 6), Step 1 holds
  the mix-up card, Step 2 the Go deeper drawer (Toys 10); 9 #tap "Tap the beat": two takes (Toys 7);
  10 quick check (4 Qs); 11 Wrap: 3 recap lines, challenge, practice card, free play (Toys 8),
  next-lesson card + tease still (Toys 11); 12 explorer (current node 19, Season 2 tab); 13 footer
  "Season 2 · Lesson 19 · Threes, offbeats and syncopation", practice link, "Every sound on this page
  is synthesised in your browser." Headings and kickers in LESSON.md ("Section headings").
- Length: 1,780 words (lesson-words.mjs), cap 2,379; built ~1,930 with hints. ~12 min (chip). No cut.
- Toys table: 1 rhythm bar (L17's + six pads/arcs, 6/8 3/4 2/4 beamed by beat, triplet 3, tie at
  beat 3, three switches); 2 hero six pads in compact strip (kit/beat-strip.ts) + kit/merc-hop.ts,
  three plays + arcs; 3 predict (kit/predict.ts, free play before choice, revealOn, revealAfter 'all',
  tour hold kit/tour-gate.ts); 4 four words (kit/words-strip.ts; figures: accent on pads, three written
  as they play); 5 Step 2's staff (staff toy both clefs; L17 Count + Clef; two tunes 6/8 and 3/4);
  6 step states (four states of Toy 1); 7 checkpoint (L17 take in the kit; two tunes as backing,
  click stopped for the judged pass, beats as onsets, its lines); 8 free play (Toy 1 in a card);
  9 recall + quick check (kit/quiz.ts; L17 question objects imported; QC2's play); 10 Go deeper
  (details, three items); 11 tease still (kit/next-card.ts; NINE BEADS ON THE PITCH LINE).

## Toys 1-6 (spec 150-255)
- Toy 1 rhythm bar = L17's plus: SIX PADS a bar (one per eighth, numbered 1-6, same size, lit as
  each note sounds; phone: six columns >= 44 px, FACTS 70; NEW in kit, L8's row draws at most 4,
  FACTS 54); Steps 3-4 keep L17's four pads. ARCS under each group as the group's first note sounds,
  stay until replayed/regrouped (6/8: two arcs of three; 3/4: three of two). Written bar on one line
  (Steps 1, 3, 4) or staff (Step 2): time sigs 6/8, 3/4, 2/4, 4/4; beams by beat (3+3 in 6/8, 2+2+2
  in 3/4, by quarter in 4/4 and 2/4); dotted quarters + dotted halves; eighth TRIPLET beamed with a 3
  over the beam, no bracket; Step 4's eighth tied to a quarter at beat 3 (FACTS 15, 41, 43, 52).
  Written as it first sounds. COUNT: "1 and a 2 and a" (6/8), "1 and 2 and 3 and" (3/4), "1, 2 and,
  3 trip-let, 4" (Step 3), held beats in brackets never lit; written, never spoken (FACTS 22, 24,
  28, 40, 75). SWITCHES (pairs of aria-pressed buttons, keyboard; FACTS 44): 6/8 · 3/4 regroups the
  same six notes, beams, arcs and drums, plays nothing until Play; Eighths · Triplet; On 3 · On 2 and.
  Pitch-line view only on Step 2's staff. DRUMS (Subdivide's): Step 1 6/8 = kick, hh, hh, snare, hh,
  hh; 3/4 = kick, hh, snare, hh, snare, hh; first hit of each bar full, rest 0.7; eighth = 1/3 s; one
  bar 2 s (FACTS 18, 65).
- Toy 2 hero: Toy 1's six pads in the compact strip under Merc and Tavi; no written bar; no arcs
  until a grouping plays. Three plays, each TWO bars, 4 s (FACTS 64). Play six notes starts 0.1 s
  after press; groupings start 0.6 s after (L8 lead), each hop booked HOP_MS before its kick/snare
  (hop lands in 530 ms) (FACTS 57). Play six notes (before and after choice): 12 closed hi-hats 1/3 s
  apart at 0.7, pads light, no arc, no hop. Play in threes (after choice): kick pad 1, snare pad 4,
  hh rest; two arcs of three; hop on kick and snare (2/bar). Play in twos: kick pad 1, snare pads 3
  and 5, hh between; three arcs of two; hop 3/bar. Starting a play stops the one sounding. After
  reveal the plays stay; the last grouping's arcs stay. Share card: six pads ungrouped + title.
- Toy 3 predict: choices "In threes" / "In twos". Play six notes free before choice; threes/twos
  revealOn ['threes','twos'], revealAfter 'all' (FACTS 59). Hints: "Choose an answer to unlock the
  two groupings." -> "Locked in. Play both groupings, and watch Merc." (no "Now play the other one.")
  -> L17's silent-play hint when sound off -> "Play either grouping again." after reveal. Cut-short
  play changes nothing. Reveal = LESSON.md word for word, closing line only on "In twos". TOUR: Step
  1 states the answer, so holdTour with the predict's choice in the same task as the masthead start
  (FACTS 60); menu lists step headings (none names a grouping). Tour first stop needs the
  nothing-sung body (kit item 13); "Your turn to sing" drops out (no #sing); the solo is #tap.
- Toy 4 words (kit words strip, written as it plays, left written; FACTS 66): Accent = six pads,
  first hh full, rest 0.7, first pad lit larger, nothing written; Offbeat = 4/4 at 60 BPM over the
  click, clap on each "and", written eighth rest + eighth per beat, 4 s; Triplet = 2/4 at 60 BPM, two
  eighths on beat 1, triplet on beat 2, on A3 or A4, 2 s; Syncopation = Step 4's bar with the note on
  "2 and", 4 s.
- Toy 5 Step 2's staff: staff toy in learner's clef (fyp-voice; lower when none), Clef shows other for
  the visit (FACTS 10). One tune at a time: 4 bars on one system where wide, 2 systems of 2 bars on a
  phone; 6/8 · 3/4 picks the 6/8 tune or the 3/4 tune of FACTS 30, in C, at C3 (bass) / C4 (treble),
  each 8 s, beats lit under the staff without a click, Count as Toy 1. Stems per FACTS 30. Play plays
  the shown tune; a switch during a play stops it. Written as it first sounds, stays written for the
  visit; before its first play only clef + time sig. Pitch-line view: amber bands, as L17.
- Toy 6 step captions: 1 "Fig. 1 · The same six eighths, written as 6/8 or 3/4" (six eighths on one
  line, 6/8 · 3/4, 6/8 first, Play); 2 "Fig. 2 · A tune in 6/8 and a tune in 3/4, on your staff";
  3 "Fig. 3 · Beat 3 split in two, or in three" (4/4 at 60 over four pads: quarter, two eighths, beat
  3, quarter; Eighths · Triplet; Count; Play); 4 "Fig. 4 · The note on 3, or moved to "2 and"" (On 3
  = four quarters; On 2 and = quarter, eighth, eighth tied to quarter, quarter; Count; Play).

## Toys 7-11, Audio, Merc and Tavi, Practice, Explorer (spec 256-390)
- Toy 7 checkpoint (#tap): L17's take in the kit + this page's frame and lines. TWO Start buttons
  "Start: the 6/8 tune" / "Start: the 3/4 tune"; the pressed one becomes Stop; either reruns anytime.
  Take (FACTS 36): 0.6 s lead; one bar counted in on the woodblock, beat 1 high (6/8: two clicks 1 s
  apart; 3/4: three 0.67 s apart); tune WITH click on every beat 8 s; tune again NO click 8 s;
  0.35 s; the line. 18.95 s either. FRAME in beats from the first count-in click: 6/8 count-in 0-1,
  line-up 2-9, judge 10-17; 3/4 count-in 0-2, line-up 3-14, judge 15-26 (FACTS 32, 33). Line-up: tap
  nearest a line-up beat gives a sample (tap - beat); estimateDrumInputLatency; ready with >= 5
  inliers (L8 lineUp). Judge: taps - estimate, from the first judged beat, to judgeTake with the
  judged beats as onsets, 120 ms window, bar 7.5 beats (6/8) / 11.5 beats (3/4) less the window.
  LINE (first that applies, FACTS 34): not lined up; lined up but no pass-2 tap; all beats met, no tap
  over; else "Beats with a tap: N of 8." (or 12) + when taps matched no beat: other-metre clause or
  "N taps fell between the beats." Other-metre clause when >= 4 unmatched taps and >= 2/3 of them
  within 120 ms of the other metre's beats: 6/8 tune -> 666.67 and 1333.33 ms after each beat 1, "N
  taps fell where 3/4's beats would be."; 3/4 tune -> 1000 ms after each beat 1, "N taps fell where
  6/8's second beat would be." Count starting a sentence: word up to nine, figure from 10, "One tap"
  (L8 tapsWord). Ticks: each pass-2 tap (lined up) on the strip, gold if met; aria-hidden. Status
  lines (FACTS 37, one live region above the line): "Press a Start button when you're ready to
  tap.", "Counting in: one bar.", "Tap with the click: bar N of 4", "Now on your own: bar N of 4", the
  line; Stop -> "Stopped. Press a Start button to tap again."; sound off -> "Sound is off, so the take
  didn't start. Turn sound on, then press a Start button." Pad: press, Space or Enter (L17's); each
  tap = clap at 0.7 at once; Space auto-repeat ignored.
- Toy 8 free play: Toy 1 in a Wrap card, L17's: Step 1's six pads with 6/8 · 3/4, and Step 2's staff
  with both tunes.
- Toy 9: recall imports L17's quick-check questions 3 and 2 (in that order), never copies, try-again
  lines name L17 and link its steps in a new tab (kit recall step address + link-away, FACTS 7);
  neither plays. Quick check: LESSON.md's 4 Qs, 3 answers each, shuffled; Q2's "Play" plays
  Subdivide's second 6/8 pattern for two bars at this page's speed, 4 s (FACTS 68, 69).
- Toy 10 Go deeper: L2's details drawer in Step 2, closed, LESSON.md's three items (FACTS 25-27).
- Toy 11 tease still: next-lesson card for L20 (tease above hook; FACTS 5); slot = still of L20's
  stage: pitch line with NINE BEADS on a string, do re mi so la so mi re do, each in its band, nothing
  lit/blurred; plays nothing; card one link; "Coming later" + "See it on the map" until L20 is live.
- Audio: kit sound gate. Beat clock books all: plays start 0.1 s after press; threes/twos 0.6 s with
  hops HOP_MS early (first hop lands on first kick); a take starts 0.6 s after Start (FACTS 36, 57,
  64). Drums: app's drum voices (kick, snare, closed hh, sidestick) via triggerDrumVoice into the kit
  output, 1 accent / 0.7 otherwise (FACTS 18, 63). Click: Ear Lab woodblock (kit, L17). Notes: kit's
  soft voice via bookNote, written length less a short gap, tied pair once (FACTS 63); nothing in
  Merc's sung voice. Clap on each tap at 0.7 (FACTS 31). One sound at a time everywhere; Start stops
  every play.
- Merc and Tavi: floor line either side of the six pads (L8's page), bubbles from the start: Tavi
  "Group six notes in twos and you'll feel two beats, surely?"; Merc "Let's group them both ways and
  listen." (FACTS 58). Hop on kick + snare via kit mercHop (as L8, L9), L8's 0.6 s lead (FACTS 57).
  Tavi's Step 1 line "Six on top means six beats a bar, doesn't it?" heads Step 1 (as L15's Step 2).
  No sung part, no voice button.
- Practice: Ear Lab printed mercurypitch.com/ear-lab, linked /ear-lab?lesson=19, "then tap
  Subdivide", Pulse second (FACTS 46, 48, 49); card text says what Subdivide plays at c60f0fdcb (two
  bars on a drum kit, kick on beat 1, four pads out of five metres, 6/8 six hits in two groups of
  three, 3/4 three hits, each bar 1.5 s, a miss replayed slower; Pulse plays a bar as clicks, tapped
  back, some bars a triplet or a note on an "and"). ear-drill launch kind + Subdivide subset =
  engineering later (card text changes then). Lesson marker 15-28 ALREADY DONE on main (01-28).
- Explorer/season data: season entry n 19, lane 'theory', title 'Threes, offbeats and syncopation',
  short 'Threes and offbeats', topics ['T08'], minutes 12, page '/learn/19', hook 'Six notes in a bar,
  grouped two ways: why does one feel like two beats and the other like three?', pr.link {href
  '/ear-lab?lesson=19', addr 'mercurypitch.com/ear-lab', label 'Ear Lab', note 'then tap Subdivide'},
  pr.needs 'Subdivide with only 3/4 and 6/8 (an ear-drill link)'; edge [17, 19]; topic T08 "Simple and
  compound metre; triplets; syncopation". CHECK what main's season-2.ts already has for 19 (may exist
  from the packages' shared entries). FIG: six pads in a row, ungrouped, nothing written: new fig
  kind 'pads' or L17's 'rhythm' with an ungrouped option (L17 shipped fig 'rhythm' via
  kit/season-2-figures.ts) -> add an ungrouped six-pad variant there. team-notes signature: "Lesson
  8's six pads, regrouped: 3 + 3 makes two beats, 2 + 2 + 2 makes three; then a beat splits in three
  and a note leaves beat 3 for the and." lesson-copy: L19 tease "Same six notes, same speed. Only
  the accents move." + teaseAlts id 'written' "Every bar written this season has had four beats.";
  L20 tease "Merc sings a run of nine notes, five every second." + teaseAlts id 'plan' "Squeeze three
  notes into a beat, then four, then more."; TEASE_NOTES; <= 70 chars (TEASE_MAX). No hook alt.
  Explorer: Season 2 tab, "Season 2 · Lesson 19" (FACTS 6); card shows only Ready / Coming later /
  Done. NOTE: L17's page currently carries L18's tease; L18's card must show L19's tease (season data).

## Edge cases, Tests, Contract (spec 440-end)
- Edge: sound off (plays draw silently; predict waits for a heard play and says so; Start says the
  take didn't start). Device delay: line-up cancels up to 250 ms; simulated 6/8 reads clean to 350 ms,
  3/4 to 300 ms (FACTS 35; edge-case tests). No pass-1 taps -> not lined up (asks for taps with the
  click); no pass-2 taps -> own line. Count-in taps count for nothing; taps after pass 2's window
  ignored. Stop mid-take: sound stops, nothing judged, "Stopped. Press a Start button to tap again."
  A play during a take stops the take; a Start during another take stops it and starts its own.
  Hidden tab: take stops as Stop; play stops. Tour on first visit waits for the predict's choice;
  never chooses -> tour from the masthead's "?". Reduced motion: no hops/idles; arcs, notes, counts
  at once. Screen readers: pads, arcs, ticks hidden; each figure named ("Six notes, grouped in
  threes" / "... in twos"); status lines and line speak. Narrow: six pads >= 44 px from 344 px
  (FACTS 70); Step 2's staff wraps to two systems.
- Tests: 1 model/writing (6/8 and 3/4 beams 3+3 and 2+2+2; tunes per FACTS 30; triplet with 3, no
  bracket; Step 4 eighth tied to quarter at beat 3; held counts bracketed); 2 drums (threes, twos,
  Step 1 bars strike FACTS 18/64 voices + levels at their times; QC2 plays metre:6-8:b's voices); 3
  take judge (every line of Toys 7 from seeded takes, both tunes, delay limits); 4 predict (six notes
  before choice never reveals; reveal waits both groupings to their end; cut play counts nothing; tour
  waits for choice); 5 words (LESSON.md lines, hints, statuses, quiz word for word; recall imports);
  6 season (entry, edge [17, 19], both teases + alts <= TEASE_MAX).
- Contract: Lesson 1's (no CDN, self-hosted fonts, Web Animations, practice links ?lesson=19 before
  any hash); 16 px gutters, no sideways scroll at 390, min-width 0, targets >= 44 px no overlap,
  focus visible, single dark theme tokens + explicit body bg, sound only after a tap, localStorage
  try/catch only conveniences; stores quiz seeds/records, fyp-done, fyp-voice (read), fyp-motion,
  fyp-pos, fyp-tour; nothing from toys/take. Departures 1-12 from ARTICLE-PLAN (all argued in FACTS).
