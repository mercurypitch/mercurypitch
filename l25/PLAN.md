# Lesson 25 page plan (lead-only), branch feat/lesson-25-page on feat/lesson-20-page (faec4e576)

Stacked: L16 (#1406) -> L18 (#1407) -> L20 (#1408) -> L25. Every PR to main is held by the same CI
install problem (#1406, owner's pin answer pending), and stacking avoids conflicts in the shared
registration files (budgets, season-2.ts, drafts.ts, sw-runtime, LESSON-TOUR, tour spec, sitemap).
Baseline = L20's final gates: $S/l20/g/r1a (fp.txt, css-NN.txt), cites 301, units 5474.

Package: docs/plans/find-your-pitch/lessons/25-minor-properly/{LESSON,FACTS,WEB-SPEC,ARTICLE-PLAN}.md.
"Minor, properly": natural, harmonic, melodic minor; relative keys. Text-only (no Watch). Masthead
Lesson, Sing, Explorer. Built like Lesson 23's page (sing flow, voice line, predict lock) on Lesson 21's
key signatures. One object: Lesson 10's minor staircase on A (do re me fa so le te do) with its chord
column (chord on so: E G B -> E G# B), beside the learner's staff.

## Spec read so far (WEB-SPEC lines)
- 1-133 intro, Look, Sections; 172-267 Toys table, Toy 1 (steps' toy), Toy 2 (hero).
- 537-628 kit needs (items 1-12, read 1-12 partly).
- TO READ: Length 134-171, Toys 3-8 (269-399), Audio 400-437, Merc and Tavi 438-455, Practice links
  456-497, Explorer 498-536, Decisions 629-637, Edge cases 638-701, Tests 702-770, Contract 771-822.

## Key facts from the spec
- Title "Harmonic and melodic minor, relative keys | MercuryPitch" (56). og "Minor, properly · Find Your
  Pitch, Lesson 25". Chips: 15 minutes; After Lesson 10 / 21 / 23 (links); Sound on. Five chips.
- Hero: staircase A3-A4 alone, no staff. Plays: Play the tune, twice (free, 17.0 s, 2nd ending G#4 lifts
  te->ti then settles); Play ending 1, with chords / ending 2, with chords (locked until choice, 4.0 s each;
  chord column draws in as the chord before home sounds; ending 2 slides the middle bead up if ending 1's
  column is drawn). Predict: revealAfter 'all', unlocks, onChoice, several reveal elements; tour holds.
- Toy 1 per step: Lesson 10's chord beads in the kit, scale state (staircase) + chord state (column) side
  by side; staff toy in learner's clef (bass A2-A3 lower / treble A3-A4 higher), house on do, Clef switch,
  pitch-line switch. Bar per figure (no natural signs). spellScale spelling.
  - Step 1: natural minor; chord on so column (E G B, gaps 3 4, "E minor"); Raise te switch (te->ti, middle
    bead G->G#, "E major"). Plays: so,te,do / so,ti,do (2.4 s each); text play "the chord on so, then home"
    (2.4 s). Before the choice: no column, Raise te disabled, line "Choose an answer at the top to unlock the
    rest of this figure."; Step 1's chord paragraph hidden behind "Choose an answer at the top, then hear both
    endings, to unlock this paragraph." until the predict's onReveal.
  - Step 2: harmonic minor, le-to-ti stair outlined with "3". Plays: A harmonic minor up and down (5.95 s);
    le to te, then le to ti (L6 pairs, 3.6 s, semitones "2" then "3").
  - Step 3: harmonic minor + Raise le switch (off) = melodic minor (up: le->la, te->ti; down settle back).
    Plays: A melodic minor up and down (5.95 s, switches Raise le on); A major, then melodic minor going up
    (6.8 s, staircase redrawn as A major then back); the toy's Play the scale. Staff writes up with F# G#,
    then down as its own figure.
  - Step 4: staff with key signature + house; small other-clef staff with the signature only; staircase.
    Plays: C major, then A minor (6.8 s; redraw on the same white keys, house glides C->A, syllables change);
    C minor (3.15 s; Eb Ab Bb written with signs, then moved into the signature B-flat, E-flat, A-flat on both
    staves at FACTS 27's places, house back on C). Never past three flats.
  - Free play (Wrap): all four states on one card, Raise te, Raise le, chord column, every play, Clef switch;
    holds Raise te, Raise le, chord play and the column until the cold open's choice (as Lesson 22's).
- Live region lines: "Te raised to ti: G sharp 3", "E, G sharp, B: 4 and 3 semitones, E major",
  "Key signature: three flats, B flat, E flat, A flat".
- Motion: stair slides 0.4 s; column draws in 0.4 s; house glide 0.6 s; flats move 0.6 s; reduced motion
  lands at once. No gold, no band, no violet, no mint. No decorative staff.

## Kit work (spec items)
4 Lesson 10's chord beads + staircase into the kit (chord-beads.ts, chord-beads-draw.ts, chord-layout.ts):
  roots/window per page (L25 white-key roots A2..B4, window A2..C5; L10 keeps C4..B4, C4..F#5); scale + chord
  states side by side; chord column on another degree (so); Raise te / Raise le (le up only), wait for a
  predict; widened stair outline + "3"; redraw C major -> A minor (house glides, syllables change); pure
  helpers + tests; layout test side by side 344-390 px.
5 staff toy: three flats per FACTS 27 in both clefs; written signs moving into the signature (0.6 s); a
  small signature-only staff in the other clef; a bar per figure.
6 Lesson 12's chord levels (NOTE_GAIN, CHORD_GAIN, UNDER_GAIN, MERC_GAIN) into the kit's sound module, chords
  under "ooh" on one clock; Lesson 12 imports them.
7 Lesson 6's pair: already in kit (kit/pair.ts) from Lesson 23.
9 sing flow in the kit (Lesson 23's): check what main has; this page passes no Move do, the staff toy's sing
  state with two bars, a count-in on so.
11 Lesson 21's questions as objects: check lesson-21/quiz-questions.ts exports.

## Commits (planned)
- C1 shell + registrations (learn/25.html, og card, main.ts, css, page test, e2e shell spec, drafts 25 line,
  season-2 entry, sw-runtime, budgets placeholder, menu/tour/sound-gate/frame-loop/next-card specs,
  unit registrations, LESSON-TOUR counts).
- C2 kit: Lesson 10's chord beads, drawing and layout into the kit (refactor; L10 unchanged, its tests pass).
- C3 kit: roots/window per page; scale + chord side by side; chord on so; Raise te / Raise le; outline "3";
  C major -> A minor redraw; helpers + tests.
- C4 kit: Lesson 12's chord levels into the kit sound module.
- C5 kit: staff signature moves, signature-only small staff, three flats placement.
- C6 L25 steps (Toy 1, four states + free play state), sounds.ts with every timing.
- C7 L25 cold open + predict + tour hold; four words; recall + quick check.
- C8 L25 Sing it (Lesson 23's on the kit flow; so-te-do / so-ti-do in A minor; count-in on so).
- C9 L25 Wrap (practice card, next card with Lesson 26's still, free play with the hold).
- C10 e2e, tour FIRST_CHOICE, LESSON-TOUR. C11 sitemap. C12 docs As built, Length, ceilings, cites.
- <=2 review rounds (browser walk + fresh critic), PR on base feat/lesson-20-page.

## Toys 3-8 (read 269-399)
- Predict: kit predict.ts; choices "It turns major" / "It stays minor"; plays tune (data-free), end1, end2;
  revealOn ['end1','end2'], revealAfter 'all'; hints chosen "Locked in. Play both endings.", silent "Sound is
  off: nothing played. Turn sound on, then play it again.", again "Play any of them again.", no next; lock
  hint "Choose an answer to unlock the two endings with their chords."; guess "You said: it turns major" /
  "...stays minor"; unlocks: Step 1's Raise te + free play's Raise te, Raise le, chord-on-so play; onChoice
  tells Step 1 + free play to draw the column and drop the lock line; reveal = [hero .reveal, Step 1's chord
  paragraph]; onReveal hides Step 1's held line + Tavi celebrates. holdTour until choice (no limit).
- Words: kit words-strip; four small staircases (Toy 1 drawing) in learner's octave: Natural minor (A nat up),
  Harmonic minor (te lifts before it sounds), Melodic minor (up and down), Relative keys (C major up then A
  minor up, house glides C->A). No chords.
- Sing it: Lesson 23's (kit/sing-flow.ts): comfort, voice choice + Lesson 15's line; staff in A minor, empty
  signature, so te do | so ti do (E3 G3 A3 | E3 G#3 A3 bass; E4 G4 A4 | E4 G#4 A4 treble), house on do,
  pitch-line switch; stop line; Play Merc's notes (contours: so 1.15 s + 0.05 glide, te same, do 1.8 s; 1.0 s
  quiet; so ti do; 9.4 s); Start the guide after Merc heard (hintFor), count-in on so (0.8 s at 0.065 + 0.2 s
  quiet), chrome sweep 9.4 s, no voice; feelings (Effortful/Uncomfortable put the guide away, rest ending);
  Just listen today; rest version of the practice card (Gravity, then Lesson 12's rest line naming
  Sight-Singing). No microphone ever.
- Go deeper: Step 4, "Do or la?" text only.
- Recall: L10 q4 + L21 q2 (filter by id; ids l10-q4 and L21's 2nd), prefix recall-, keys fyp-l25-recall-seed /
  fyp-l25-recall-v1, no lesson; step links "Try Lesson 10, Step 5 again" /learn/10#step-5, "Try Lesson 21,
  Step 4 again" /learn/21#step-4 (away recallStepHref). Quick check: l25-q1..q4, keys fyp-l25-seed /
  fyp-l25-quiz-v1, lesson 25; q1 Step 3, q2 Step 1, q3 Step 4, q4 Step 3; q4 Play = A melodic minor up, 3.15 s
  (Lesson 10's quiz-play form).
- Tease stills: next card holds Lesson 26's still (aria-hidden SVG); this page's opening still (for Lesson 24's
  card) = hero stage at rest, no column, no G#, own class.

## Main's kit check (22:3x)
- kit has: sing-flow.ts (L23), pair.ts, predict.ts, tour-gate.ts, words-strip.ts, home-glyph.ts; L21 exports
  QUIZ_QUESTIONS / RECALL_QUESTIONS in lesson-21/quiz-questions.ts.
- NOT in kit: Lesson 10's chord-beads.ts, chord-beads-draw.ts, chord-layout.ts, chords.ts (lesson-10/), and
  Lesson 12's chord levels (lesson-12/sounds.ts NOTE_GAIN etc.; L10 and L24 have their own too).

## Audio (read 400-437)
- Sound rules: one sound at a time (NowPlaying); leaving a step stops its sound; Sing it off screen 600 ms or
  page hidden stops; a cut play never counts as heard (predict, Sing it's gate).
- Answering plays: Merc's "ooh" at 0.2 over three soft voices at 0.05 each (UNDER_GAIN), on one clock (allOf,
  kit/run.ts). Chord alone (Step 1's chord on so + home, free play's): three voices at 0.075 (CHORD_GAIN), one
  timer task (playNotes).
- Scales: soft tone 0.13, a note every 0.4 s, each 0.35 s. Interval = Lesson 6's PAIR (0.6 s, 0.15 quiet, 0.8 s).
- Sing it line: one voice along a contour (playContour), Tavi an octave up.
- Lowest note A2 110 Hz.

## Shell approach (C1)
- Template: learn/23.html (Lesson 23 wiring: no Watch, cold open before recall, recall of other lessons'
  questions, sing-along with no microphone) + Lesson 10's staircase/beads figure markup; L20's shell was
  written as parts in $S/l20/c1/part*.html and concatenated; og card via $S/l20/og (card.html -> render).
- Lesson 10's chord beads module (lesson-10/chord-beads.ts 721 lines, chord-beads-draw.ts 308,
  chord-layout.ts 272, chords.ts 157) is Lesson 10-specific (states: third, stacked, root slide, pattern,
  spread, free); moving it to the kit (C2) is a git mv + imports; generalising (C3) adds roots/window per
  page, scale+chord side by side, chord on so, Raise te/le, outline "3", C major -> A minor redraw.
  chord-beads.ts is near 800 lines: split before adding (size ratchet: filesOver800 must not rise).
