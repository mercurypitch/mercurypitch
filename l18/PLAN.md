# Lesson 18 "Read and sing a whole line" - plan skeleton (refine after L16 merges)

Package: docs/plans/find-your-pitch/lessons/18-read-a-line (WEB-SPEC 930+ lines; LESSON, FACTS, RESEARCH).
Branch: feat/lesson-18-page from main AFTER PR #1406 (L16) merges (it needs L16's staff kit: syllables,
Names, read-along, lit score plays) and L17's rhythm kit (merged #13xx). Worktree: reuse l10-page.

What the page needs (WEB-SPEC "What the kit and the app still need" items 1-16):
1 host learn/18.html, SW paths, budgets; 2 draft line `18: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`
  (+ name L16/L17 pages if drafts, as L16/L21 did); 3 seasons (done); 4 READING STAFF (kit): any pitch
  G3-D4 / G4-D5 quarters+halves with stems by side of middle line; beat grid (8 pads, drawn never pressed)
  under a 2-bar figure + count-in strip (4 dots); short figures (no time sig/bar line/grid) for the words;
  cursor at tempo (jumps per beat under reduced motion); names over notes on the beat + lag tags after
  Step 1's note-by-note read; gold brackets with labels ("a run of steps", "a repeated note", "do-mi-so"),
  fade 0.2 s, a button once drawn; MARKS p/f (Noto Music dynP/dynF), hairpins (paths), staccato dot,
  slur, breath mark (paths) above staff, each written as it sounds, a button once drawn; LOCK until the
  predict's choice (step + free play), none once done; loudness as brightness.
5 woodblock in kit (L17 item 11 - check if done) + COUNT-IN: one bar of click, beat 1 higher, strip lights.
6 tap pad tempo readout "Your taps: 60 BPM" (createTapTempo in kit/tap-pad.ts).
7 sing flow + TAKE READ IN TIME: do start then count-in on the audio clock; frames from half a beat before
  bar 1 to last note's window (anchor-moved) via `until` (L16 added it) + `wait`; kit/read-in-time.ts NEW
  pure (anchored on first note, as ear-lab/anchored-take.ts); silent cursor+grid during take; pitch line
  after on the bars' time axis (L17 item 8 pitch-line view of a rhythm).
8 runs: level per note, staccato (shorter sounding), slur (no gap), breath (silence from end) on beat clock.
13 head + share card learn/lesson-18-og.jpg (check how L16/L21 did og: $S/l16/og exists).
14 L16/L17 quiz-questions modules (l16-q3, l17-q1) - L16's exists; check L17's.
Sections: hero cold open (bass staff, Merc reads note by note vs beat, then his way with brackets),
recall L16+L17, four words (Count-in, Dynamics, Staccato, Slur), 4 steps, Sing it (2 tunes in time),
quick check 4, wrap (practice card versions, next card L19 still, free play locked till choice), explorer.

Process as L16: C0 baseline -> C1 shell -> kit commits -> page parts -> e2e -> sitemap -> As built/Length/
ceilings -> rebase -> 2 review rounds -> PR -> merge. Length: count open text with EVERY take-line form
(L16 lesson: missed forms), and check the spec's Length for named cuts.

Kit inventory (12 Nov, on the L16 branch = main + L16): HAVE woodblock.ts, beat-clock.ts, beat-strip.ts,
rhythm-bar.ts (count-in mentioned), rhythm-draw/engrave/glyphs/layout/model/words, tap-pad.ts (createTapTempo),
tap-judge.ts, lesson-17/quiz-questions.ts (l17-q1 importable), lesson-16/quiz-questions.ts (l16-q3).
Rhythm engraving today = one pitch (A3/A4); L18 needs any pitch G3-D4/G4-D5 with stems by middle line ->
the core kit task (merge staff.ts places + rhythm-engrave). Check move-do.ts (count-in?) and rhythm-bar's
count-in before writing a new one.

## Toys digest (WEB-SPEC 177-330), for building
T1 hero: bass staff fixed, 4/4 two bars G3 A3 B3 A3 | G3 B3 D4(half), house top space, beat grid under; no taps.
  predict choices "All seven notes, each a beat late" / "Only the first four"; play `read` "Watch Merc read";
  revealOn ['read']; hints chosen "Locked in. Watch Merc read." silent "Sound is off: nothing played. Turn sound on,
  then play it again." again "Play it again."; lock hint "Choose an answer to unlock Merc's read."; guess "You said:
  all seven"/"You said: only four"; onChoice -> unlock Step 1 toy + tour hold (holdTour). READ: do G3 soft 1.0 s
  (house lit), 0.4 s quiet, count-in 4 woodblock clicks 60 BPM (beat 1 higher) + 4-dot strip, then bars over click:
  cursor from bar 1 beat 1, pads light; beats 1,3,5,7 syllable appears over next note (name), beats 2,4,6,8 Merc sings
  it "ooh" amber -> do,re,mi,re sound 1..4 beats late; bar 2 ends -> cursor at final barline, do mi so unlit; 13.4 s;
  names stay till next play. Reveal play "Read Merc's way": count-in then tune on beat, gold brackets fade in
  "a run of steps" (bar 1 four notes) and "do-mi-so" (bar 2), 12.0 s, not answering, own sound owner.
  aria "Bass staff, two bars of 4/4: G, A, B, A, then G, B and a long D"; live lines (WEB-SPEC 233-236).
T2 steps staff: learner's clef (fyp-voice; bass default), Clef seg, Names on/off (off), pitch-line switch; two-bar
  figures 60 BPM over woodblock, cursor, pads; tap note 0.8 s "B3, mi, a quarter note". States:
  1 Step 1 (LOCKED until choice): Read note by note (tags "1 beat late".."4 beats late", 12.0 s) + Read Merc's way
    (brackets) 12.0 s; live lines. 2 Step 2: Play tune A (do re mi fa | so(h) so(h)) / tune B (so(h) mi do | re re
    do(h)) 8.0 s; brackets "a run of steps"/"a repeated note"/"do-mi-so"; drawn bracket = button (>=44 px hit),
    named "a run of steps: G, A, B, C", plays its notes. 3 Step 3: tune C (do re mi do | re(h) do(h)), Count on
    ("1 2 3 4" / "1 (2) 3 (4)"), Play with the count-in 12.0 s; tap pad 64 px "Tap"/"or press Space", from 4th tap
    "Your taps: 60 BPM" (createTapTempo), never scores. 4 Step 4 marks, 5 buttons, short figures (no time sig/bar/
    grid): "p, then f" (mi re do at 0.3 level, p; beat; same at 1.0, f; 7.0 s), "Hairpins" (so half, 0.3->1.0 1 s
    cresc hairpin opens, back 1 s closes; 2.0 s), "Staccato" (do mi so 0.15 s each, dots; 3.0 s), "Slur" (do re mi
    joined, curve draws; 3.0 s), "Breath mark" (tune C over click, last do of bar 1 0.6 s + 0.4 s silence, comma at
    barline; 8.0 s); drawn mark = button replays. 5 free play: all states, Step 1 locked till choice. LOCK line
    "Choose an answer at the top of the page to unlock this."; unlocked if Done.has(18). Figure .viz.tall.
T3 four words (words strip): Count-in (4 pads + clicks), Dynamics (mi re do p, beat, f), Staccato, Slur; small staff
  in learner's clef, quarters, no time sig; no pitch-line switch.
T4 recall: l16-q3 + l17-q1 imported by id (prefix recall-, keys fyp-l18-recall-seed/-v1, no lesson; away links
  "Try Lesson 16, Step 4 again"/"Try Lesson 17, Step 1 again" via recallStepHref/linkAway). Quick check l18-q1..q4,
  keys fyp-l18-seed/fyp-l18-quiz-v1, lesson 18; q4 slot play "Play": so fa mi LOUD, beat, same quiet, quarters 60 BPM,
  learner's octave, 7.0 s, drawn as nothing.
T5 Sing it: comfort -> voice (+L15 line) -> listen path (Play Merc's tunes) | Your turn + stop line + What this does +
  learner's staff tune 1 = do re mi so | so mi do(half) with BREATH MARK at barline, house, beat grid, count-in strip,
  Names seg (off), no taps, no pitch-line switch; Start (listen('lesson-18', ctx)). START: voice sings do 1.0 s ooh,
  0.4 s quiet, count-in 4 clicks + strip, status "Counting in: one bar."; sound off -> hint "Sound is off, so nothing
  played. Turn sound on to hear the start, then press Start." TAKE from bar 1 beat 1, frames kept from half a beat
  before (0.5 s after last click starts); silent cursor + pads, status "Your turn: sing in time with the cursor.";
  nothing plays; ends a quarter beat after bar 2 end moved by the anchor (<= 2.25 s past barline). AFTER (0.5 s):
  pitch line under staff on bars' time axis (bands as long as notes, lane a semitone, octave tag), lines per note;
  no voice -> "We didn't hear you start that time. Come in on do after the count-in." + Start again (<3 takes).
  Feelings: after tune 1 Easy/Workable "Now another tune you've never heard." + tune 2 = do do mi mi | so(h) do(h)
  + Start tune 2 + Stop here; after tune 2 "Two tunes, read in time from the page." + Play Merc's tunes; Effortful/
  Uncomfortable as L16. No mic: both tunes drawn, each with Play the start (do + count-in + silent cursor, 13.4 s).
  Play Merc's tunes 26.4 s (do, count-in, tune 1, 1.0 s, count-in, tune 2). Max 3 takes. sing-flow.ts pure rule.
READ-IN-TIME (kit/read-in-time.ts): anchor = first voiced run >= 0.15 s starting in [-0.25 beat, +2 beats] of bar 1
  beat 1 -> shift all notes; window = note +-0.25 beat (anchored); heard = 0.45 s within 60 c (fold), outside/no
  voice takes back half; line "In the band" only within 35 c (!); not heard: own beats after 0.15 s attack: <0.3 s ->
  not steady; median >60 c & within 60 c of a written note +-2 places -> not steady; no anchor -> not steady; else gap.
  rungLine(label, r, 'the written note'). No voice when no window has a voiced frame. Synthetic cases listed (spec
  ~490-497) -> unit tests. Phone: 344-390 fit, pads >= 40 px, pitch line 160 px.
T6 tease: SVG, L19's stage: six L8 pads 1..6 in a row, no grouping/arcs, nothing lit; own class.

## Kit inventory result (12 Nov 09:0x)
HAVE (kit/rhythm-bar.ts + rhythm-draw/engrave/model, from L17/L19): staff rows with per-note pitches (`row.notes`),
stems by middle line, beams, ties, count-in on the click (metre's beats), woodblock beat 1 higher, pads lit per beat,
counts lit in turn, stopwatch strip, pitch-line view of a rhythm, `light`/`ticks` outside a play, NowPlaying owner,
sound off -> silent drawing. tap-pad.ts with createTapTempo. L17 checkpoint "sung bars" (lesson-17/checkpoint.ts,
take.ts, take-judge.ts) = prior art for a sung take in time; L19 take-judge too.
NEW for L18 (kit unless noted): (a) cursor line at tempo (jumps per beat under reduced motion); (b) count-in STRIP of
4 dots before bar 1 (check if rhythm-draw has one); (c) names over notes on a beat + lag tags under notes;
(d) gold brackets with labels, fade 0.2 s, buttons once drawn (hit >= 44 px); (e) marks: p/f glyphs (Noto Music
dynP/dynF via rhythm-glyphs?), hairpins (paths), staccato dot, slur, breath comma - written as they sound, buttons;
(f) runs with level per note (brightness), staccato length, slur join, breath silence; (g) lock state + line;
(h) kit/read-in-time.ts (pure) + take frames window (listen `until`/`wait`); (i) silent cursor during a take;
(j) tap tempo readout "Your taps: N BPM". Page-level: hero read with names/lag, sing-flow.ts, words, quizzes, wrap.
