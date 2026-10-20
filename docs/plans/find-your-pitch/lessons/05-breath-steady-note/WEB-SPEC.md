# Lesson 5 web page: spec

The Lesson 5 page is the web lesson for "Breath and a steady note": written steps, live toys, two
predicts, a sung checkpoint of two fixed-length holds, and a quiz. There is no episode yet, so this
is a text-only page. Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It
is the second page with a microphone, so it runs on the kit parts Lesson 3's spec adds (the band
chart, the listener, the take reader and the comfort check: [Lesson 3
WEB-SPEC](../03-match-a-note/WEB-SPEC.md), Toys 6 and 7, as committed at `4d5891ac0`) and extends
them for holds. Where a part still lives in Lesson 1's or Lesson 3's page module, it is promoted
into the kit (`src/features/lessons/kit/`), never copied; if the page that owns it has not
promoted it first, this page does. Where this page shares a behaviour with Lesson 3's checkpoint
(the comfort check, the warm-up, the voice choice, "How did that feel?" and the rest card), it is
Lesson 3's, unchanged unless this spec says otherwise.

Its public home is `mercurypitch.com/learn/05` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/05.html` with its module in `src/features/lessons/lesson-05/`, served the way Lesson 1's page
is. It publishes only after three things: the vocal coach's sign-off, because it is a voice lesson
(MASTER-PLAN § 7, day 6; § 12 item 8), and the pages of Lessons 2 and 3 at `/learn/02` and
`/learn/03`, because its prerequisite chips link to both, its recall check links to Lesson 3's page,
and the recall needs the quiz changes Lesson 2's page brings (Toys, 7).

## Look

Lesson 1's, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and its motion rules. The pitch-canvas toys (the hook stage, Push, the hold demo and the
checkpoint) take the app's canvas set: target amber `#f59e0b` for Merc's band and line, singer
violet `#a78bfa` for a voice, and in-tune mint `#80ffca` for the band's lit edge, always beside the
words "in the band" (FACTS 69). There is no "off" colour. Violet means a singer only, so the page
draws no contrast case in violet. On every band chart Merc's amber line is steady at the band's
centre, as on Lesson 3's (its Toys 6): Merc's "ooh" carries a vibrato (FACTS 42), but the chart
leaves it out, so the wave is never read as part of the band or as something to copy; a singer's
violet line shows whatever wave the voice has. Loudness is never drawn on the pitch axis: where a
toy shows it, it is the height of a level strip under the chart (playbook rule 20).

The two diagrams (the breath toy and the three starts) use the series code: chrome marks, ink
labels, and gold `#ffd84d` twice only, for the fit: the gauge's "what the note needs" line and the
"together" start's tick.

Only the two Merc idle loops move on their own. Everything else moves because the viewer started
it. Under `prefers-reduced-motion` the Mercs hold a still frame, every transition lands in its end
state, no chart scrolls, and what the viewer starts still sounds. For everyone else the masthead's
Pause animations toggle stops the Merc loops (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 and 3's departures kept: the step toys double
as the Playground, the mix-up card sits in the step whose toy refutes it, the practice card is in
the Wrap, and there is no Watch section until a film exists. Each section's heading, and the line
above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's, with "Season 1 · Lesson 05" and the anchors Lesson, Sing and Explorer.
2. **Hero**: kicker, title, LESSON.md's meta as chips ("17 minutes", FACTS 2; "After Lesson 2:
   Twelve notes" and "After Lesson 3: Match a note", the prerequisite chips, links to `/learn/02`
   and `/learn/03`; Sound on; Microphone optional), the promise, and the two Mercs either side of a
   still of the hold demo (Toys, 5): a violet line settling into Merc's band, the signature.
3. **Recall from Lesson 3**, shown to everyone, because Lesson 3 is a prerequisite (CURRICULUM
   § 3.3; Toys, 7).
4. **Cold open: predict**: the bubbles, the two takes, the predict and the reveal (Toys, 1).
5. **Four words you'll meet**: Air pressure plays Push's note at 50, then at 70 (Toys, 2);
   Diaphragm shows the breath figure breathing in (Toys, 3); Onset plays the "together" start
   (Toys, 4); Support has no button.
6. **The steps**: Lesson 1's sticky stage and step deck (`kit/step-deck.ts`, "N of 5"), each step
   with its heading, text, "Try:", "Notice:" and toy: 1, Push (Toys, 2); 2, the breath gauge, the
   second predict, orange Merc's line after its reveal (a bubble with orange's still, as the cold
   open's bubbles have) and the mix-up card (Toys, 3); 3, the breath figure, the care line and the
   comfort line, and the Go deeper drawer (Toys, 3 and 8); 4, three starts (Toys, 4); 5, the hold
   demo (Toys, 5).
7. **Sing it**: the checkpoint (Toys, 6).
8. **Quick check** (Toys, 7).
9. **Wrap**: the recap, the challenge, the practice card in the version the checkpoint's ending
   picks (Toys, 6: the Voice Mirror card with "Ten minutes, gently, most days", or Lesson 3's rest
   card without it), and the next hook on a card that opens Lesson 6 in the explorer. Free play
   unlocks here: Push, the gauge and the three starts on one stage (playbook rule 17).
10. **Lesson explorer**: the kit's, with Lesson 5 current (Explorer and season data, below).
11. **Footer**: LESSON.md's ("Footer"): "Season 1 · Lesson 05 · Breath and a steady note"; the
    practice link, printed `mercurypitch.com/mirror` and linking `/mirror?lesson=05`, with "Voice
    Mirror is free, with no account"; Lesson 1's fonts line and "Every sound on this page is
    synthesised in your browser" (FACTS, Labels). With no film there are no voices to credit.

## Length

The learner copy is 2,351 words by the review's count (FACTS 2), under Lesson 3's 2,361 on the
same count, and the page runs about 17 minutes, past MASTER-PLAN § 4.2's 8
to 12 minutes of active time, as Lesson 3's 15 minutes do; the holds, the warm-up and the six
questions take about 4 of them. Steps 1 and 5 sit inside § 4.2's 50 to 120 words a step (about 98
and 89). Three run longer, for these reasons:

- **Step 2, about 234 words.** Its own text is 62 words; the rest is the lesson's second predict
  and its reveal (with orange Merc's one-line re-explanation, about 92 words) and the mix-up card
  (about 80), which sits in the step whose toy refutes it, as in Lessons 2 to 4.
- **Step 3, about 235 words.** Its text, Try and Notice come to about 98 words; it also carries the
  care line and the comfort line, which must come before Step 4's first sung "hoo" (FACTS 48), and
  the Go deeper drawer (about 110 words), closed by default.
- **Step 4, about 121 words.** Its Try is the page's first sung exercise and must say the whole of
  it.

## Toys: what each reuses, and what is new

| Toy                | Reuses                                                                                                                                                         | New in Lesson 5                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Hook stage      | The band chart (`kit/band-chart.ts`, Lesson 3); Lesson 1's predict widget (`lesson-01/predict.ts`, promoted); `kit/sound.ts`                                   | A level strip under the chart; two takes that follow a contour of pitch and level       |
| 2. Push            | The band chart; Lesson 1's loudness toy (`lesson-01/toy-loud.ts`, promoted by Lesson 3 with label options); `holdToPlay` (`kit/toy-helpers.ts`); `Sound.voice` | One slider that moves level and pitch together; a Hold the note toggle for the keyboard |
| 3. Breath          | Lesson 1's breathing ring (`lesson-01/sing.ts`), promoted into the kit, as Lesson 3's checkpoint also uses it; the step deck                                   | All new, one component in two views: the gauge (Step 2) and the figure (Step 3)         |
| 4. Three starts    | Lesson 3's vocal folds (its Toys 2), promoted as `kit/folds.ts`; `kit/sound.ts`                                                                                | Three synthesised starts, a trace strip, a noise source in the kit                      |
| 5. Hold demo       | The band chart                                                                                                                                                 | A fixed-frame hold mode with a settled marker and readouts                              |
| 6. Sing it         | Lesson 3's checkpoint: `kit/comfort.ts`, `kit/listen.ts`, `kit/take.ts`, its warm-up, its voice choice (`fyp-voice`), the ring, the rest card                  | Two holds of a fixed length, Lower and Higher, a rest state, a hold reader, a flow rule |
| 7. Recall and quiz | `kit/quiz.ts` with Lesson 2's three changes; Lesson 3's questions 3 and 4                                                                                      | Ids (`l03-q3`, `l03-q4`, `l05-q1` to `l05-q4`) and this page's storage keys             |
| 8. Go deeper       | The `details` drawer of Lessons 2 to 4                                                                                                                         | Three items                                                                             |

### 1. Hook stage

- The band chart with Merc's amber band at A3 (±35 cents) and Merc's line steady at its centre, a
  4-second window and, under it, a level strip (a waveform envelope whose height is the take's
  level). Two takes in the kit's "ooh", drawn as violet lines that belong to no Merc (FACTS 72):
  **Play: sung easily** is live from the start (sound before the predict); **Play: pushing
  harder** unlocks after a choice.
- The predict widget: orange's bubble and blue's reply, then two choices. The reveal appears after
  the pushed take has sounded (with sound off it waits, and the hint says so: Lesson 1's rule that
  the reveal describes what was heard), then the small print and the kind line. It never calls a
  choice wrong.
- States: waiting; a take playing; choice made; revealed.
- Accessible text: the chart's label reads "Merc's note A3 as a band; the easy take settles into
  it" or "the pushed take gets louder and climbs above the band"; the reveal is text.

### 2. Push

- The band chart (Merc's band at A3) with the level strip and a held voice, drawn violet. One
  slider, **Push**, 0 to 100, starting at 50, moves the voice's level and pitch together through
  the kit's `setGain` and `setFreq` (`sound.ts:148-155`): ±6 dB and ±60 cents at the ends (FACTS
  73). The line draws in a scrolling 4-second window while the note sounds.
- Sounding the note: `holdToPlay` sounds it while a pointer holds the slider, or for 0.7 s after
  the last arrow key (`kit/toy-helpers.ts:17-63`); it handles no Space or Enter, so on its own a
  keyboard could not keep Push still while the note sounds. So the toy adds **Hold the note**, a
  button with `aria-pressed`: pressed (by pointer, Space or Enter), it sounds the note until it is
  pressed again, for at most 20 s, and while it sounds the slider's keys move the voice without
  stopping it. LESSON.md's "play the note" means either way.
- Readouts: "Push 70 %", "louder" or "quieter" against 50, and the band state in words ("in the
  band", "above the band", "below the band").
- States: silent; sounding (held or toggled); Push moving; Push still.
- Keyboard: Push is `role="slider"` (arrows 5, Page Up and Page Down 20) with `aria-valuetext` such
  as "Push 70 percent: louder; the note above the middle, still in the band"; Hold the note is a
  real button. A polite live region says when the line leaves the band and when it comes back.
- Under reduced motion the window does not scroll: the line's head moves only with the slider.

### 3. Breath: the gauge and the figure

One component, two views, so the breathing object is one object on the page.

- **Gauge** (Step 2): one 10-second note across, and up the side an axis labelled "push of air
  (not pitch)", with no scale, so the falling line is never read as a pitch line; drawn after
  Sundberg's Fig. 4 (FACTS 18 to 20, 74). A falling chrome line, "the lungs' own push"; a flat gold
  line, "what the note needs"; between them, two hatched regions in different patterns with labels:
  "held back" (above the gold line) and "added" (below it). **Quiet** and **Loud** (two buttons with
  `aria-pressed`) move the gold line, so the crossing falls at 7 s or 3 s. **Play the breath** runs
  a cursor across while Merc's "ooh" holds A3 unchanged, because the point is that the note does not
  change while the balance does; a readout says "Now: holding back" or "Now: adding". A scrub bar
  and Slow, as every animation has (MASTER-PLAN § 4.2 item 5).
- **Figure** (Step 3, and the four words' Diaphragm): a schematic side view, chrome on the dark
  room: the lungs, the diaphragm's dome under them, the belly wall, labelled "diaphragm" and
  "belly". **Breathe in** is one tap (pointer, Space or Enter), not a press and hold: the dome
  flattens and lowers and the belly moves out over a fixed 2 s, and then at once the dome rises and
  the belly returns over 5 s while the breathing ring counts the "sss", with Merc's still at its
  centre and the cue "sss ... and stop". There is no hold between breathing in and out, and nothing
  the viewer does can keep the dome flat (FACTS 33, 65). The figure plays no sound. Beside it, the
  care line and the comfort line in bold (LESSON.md, Step 3), with an icon from the app's SVG set
  (no emoji).
- States: gauge idle, playing, scrubbed, Quiet or Loud; figure resting, breathing in, breathing out.
- Accessible text: the gauge's summary, "Quiet note: for the first 7 of 10 seconds the lungs push
  harder than the note needs, so the body holds back; after that it adds", and Loud's at 3 seconds;
  the cursor's readout in a polite live region; the figure's state in words, "Breathing in: the
  diaphragm flattens and the belly moves out", then "Breathing out on sss". Under reduced motion the
  gauge shows its end state with both phases listed, and the figure two still frames.

### 4. Three starts

- Lesson 3's vocal folds seen from above (its Toys 2), promoted as `kit/folds.ts`, beside a trace
  strip 1.6 s wide: the height of the wave is the level; a layer of fine dots is air with no note; a
  short mark is the catch.
- Three buttons, each playing its start on A3 (FACTS 75): **Air first** (the folds apart with an
  arrow of air, the dots for 0.35 s, then the wave grows as the folds close into vibration); **A
  catch** (the folds drawn pressed shut with a heavier stroke, a short silence, the mark at the
  click, then the wave at full height at once); **Together** (the folds close to a slit as the wave
  starts and grows smoothly, with the gold tick where air and sound begin at once).
- Nothing listens, and the page never asks the viewer to make a catch.
- States: idle; a start playing.
- Accessible text: each button names what it plays ("Air first: a puff of air, then the note"); a
  polite line repeats it after it plays; the trace has a text summary.

### 5. Hold demo

The signature: a held note's line settling from a wobble into the band.

- The band chart in a fixed-frame hold mode: 0 to 10 s across, the first hold's length, cents −150
  to +150 up the side, Merc's band ±35 cents with Merc's amber line steady at its centre (Look).
  **Play**, **Slow** (half speed) and a scrub bar, with sound: the violet line of FACTS 76 scoops
  up from 60 cents low, wavers, enters the band and stays, with a small, regular wave, the vibrato
  Step 5 names (FACTS 42). A "settled" marker appears where it stays in the band; readouts give
  the settled time and the time in the band out of 10 seconds, computed by the checkpoint's own
  reader (Toys, 6), so the demo shows exactly what a take will read.
- States: idle (Merc's band and line); playing; paused; scrubbed.
- Keyboard: Play and Slow are buttons; the scrub bar is a slider whose `aria-valuetext` reads, for
  example, "1.2 seconds of 10: in the band". Under reduced motion it lands in its end state with
  its readouts beside it.

### 6. Sing it: two holds

Lesson 3's checkpoint (its Toys 7) with holds in place of three short notes. Every state has a
visible status line, also announced (`aria-live="polite"`). Each hold allows up to three takes in a
visit (a "try"), as Lesson 3 caps tries at three: Hutchins and Peretz (2012) found that singers
don't improve over repeated sung tries, so more would add singing, not learning (FACTS 52). Every
take is followed by "How did that feel?", and only the answer offers more singing.

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's comfort line,
   its list naming all six of REQ-GVC-020's conditions, and its two buttons (FACTS 48, 49). "Just
   listen today" opens listen-only mode: **Play Merc's 10-second note** and
   **Play Merc's 15-second note**, a tap each, in the stored voice (if none is stored, the voice
   choice comes first, since it picks the Merc who sings); the chart shows Merc's band and line;
   nothing listens; LESSON.md's rest line and the doctor lines show (REQ-GVC-021; FACTS 51); and
   the Wrap shows the rest card.
2. **Voice choice**, if none is stored, before the warm-up so that its demonstrations are in the
   chosen voice, as in Lesson 3: Lesson 3's two buttons, "Lower: sing with blue Merc, around A3"
   and "Higher: sing with orange Merc, around A4" (`aria-pressed`, at least 44 px), read from and
   written to `fyp-voice`, the key Lesson 3's page writes and later voice lessons share (Lesson 3
   WEB-SPEC, Toys 5 and Contract; FACTS 5). Its reading and writing move into the kit as
   `kit/voice-choice.ts` if Lesson 3's page has not moved them, with the same key; there is no
   second key.
3. **Warm-up**, optional, with Skip: Lesson 3's two cards and words, with "Follow the shape, not
   Merc's notes" and the stop line (FACTS 53, 77). Nothing listens and nothing is scored.
4. **Note**: Merc's A in the chosen voice, with **Lower** and **Higher** (a semitone a tap, up to
   four either way, F3 to C♯4 or F4 to C♯5: FACTS 55); each tap plays the note for 1 s. The move
   lasts for the visit and is not stored. It comes before Start: finding the note needs no
   microphone.
5. **Briefing**: the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026) and
   **Start**, the only control that asks for the microphone (MASTER-PLAN § 4.2 item 2).
6. **Hold 1**, the ten-second hold, in three phases shown on the ring as **Listen · Breathe ·
   Sing**. Listen: Merc's note, 2.0 s, the singing Merc in `sing`. Breathe: the ring breathes once
   over 2 s from the end of Merc's note, with "Breathe in, low and quiet"; nothing counts down.
   Sing: the ring turns, with "Sing, and hold the note until the ring closes", and closes over the
   hold; the violet line draws on a fixed 10-second frame; both Mercs `listen`. The take opens
   0.4 s after Merc's note ends, during the Breathe ring, so a voice that starts as the breath
   turns is caught and nobody sits holding a breath for a cue (FACTS 56, 65). It waits up to 6 s
   from opening for the first voiced frame, then runs exactly 10 s from it, whatever happens;
   nothing on the page extends it. The microphone is released when the take ends.
7. **Reading**: one line from the reader (below). If no voice came within 6 s, the line asks again
   ("We didn't hear you start that time. Breathe in, then sing as the ring turns.") with **Again**
   (while the hold has had fewer than three takes; the take counts as one) and **Done for today**,
   and no feeling question, since nothing was sung. Otherwise **How did that feel?** follows at
   once (REQ-GVC-022).
8. **How did that feel?** after a ten-second take:
   - Easy or Workable: Merc `celebrate`s if the take was in the band for at least 80 % of its
     length; rule 15's line ("If that felt tricky, good: that's learning.") if it was in the band
     for less than half; then **Rest** with **Hold for 15 seconds** (only when hold 1 has a take
     with a reading), **Again** (while hold 1 has had fewer than three takes) and **Done for
     today**.
   - Effortful: the reading, no celebration, no Again and no longer hold (a report of effort
     suppresses immediate-repeat encouragement: REQ-GVC-021, REQ-GVC-055; Lesson 3 shows its count
     and no Again); the status reads "Keep it gentle: rest before you sing again.", and only **Done
     for today** follows.
   - Uncomfortable: no celebration, no Again and no more holds (REQ-GVC-021, REQ-GVC-023,
     REQ-GVC-024); LESSON.md's line and the doctor lines; the microphone stays off; the Wrap shows
     the rest card.
9. **Rest**: "Rest for a few easy breaths. Ready when you are." after Easy or Workable; no timer,
   so the singer ends the rest, and the buttons of state 8. **Done for
   today** ends the checkpoint with the status "Done for today." and leaves the Voice Mirror card
   in the Wrap.
10. **Hold 2**, the fifteen-second hold: as 6 and 7, for 15 s on a 15-second frame.
11. **How did that feel?** after a fifteen-second take:
    - Easy or Workable: the two readings, "This time your line was in the band for X of 10
      seconds, then Y of 15.", from each hold's counted take (below), or the first alone, "This
      time your line was in the band for X of 10 seconds.", while the fifteen-second hold has no
      take with a reading; rule 15's line if either was in the band for less than half its length;
      Merc `celebrate`s if the fifteen-second take was in the band for at least 80 % of it; then
      **Again** (while hold 2 has had fewer than three takes) and **Done**.
    - Effortful: as in 8: the readings, no celebration, no Again and no further hold, only **Done
      for today**.
    - Uncomfortable: as in 8.
12. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
    LESSON.md's line.

Merc's celebration (state 8 and 11) comes only after an Easy or Workable answer, at most once a
hold, never after Effortful or Uncomfortable, and never because a hold was longer. The singer's
answer outranks the reading (REQ-GVC-024). The page keeps the checkpoint's ending in memory for the
visit, never in storage: after "Uncomfortable" or "Just listen today" the Wrap shows the rest card,
"Rest today. Voice Mirror will be here when your voice feels comfortable", without "Ten minutes,
gently, most days" (FACTS 54); otherwise, and when Sing it is skipped, the Voice Mirror card.

The flow is a pure rule (`lesson-05/hold-flow.ts`): from the hold, the take's reading, the answer
and the takes so far, it gives the next state, the buttons and whether Merc celebrates, so every
branch above is unit-tested without a microphone.

Reading a hold (`kit/take.ts`, extended; pure and unit-tested):

- Input: the take's raw frames, Merc's MIDI note and the hold's length L (10 or 15 s). Voiced
  frames come from Voice Mirror's `preprocess`; the deviation d is `foldCents(cents − target)`, and
  the octave count comes from the median of the unfolded difference, rounded to whole octaves, as
  in Lesson 3's reader.
- No voice: no voiced frame within 6 s of the take opening gives the "didn't hear you start" line
  (state 7).
- Too little: under 0.6 s of voiced frames gives "We didn't hear a steady note that time. Try again
  at about speaking volume.", never a low reading (REQ-GVC-031).
- Ended early: if the voice stops for more than 1.0 s before L, the take ends, and the sung length S
  runs from the first voiced frame to the last.
- In the band: X, the total time of voiced frames with |d| ≤ 35 cents (`HIT_TOLERANCE_CENTS`),
  rounded down to 0.1 s, out of L (or out of S when the take ended early). Rounding down means X
  never reads L when any frame was outside.
- Settled: the first moment from which |d| ≤ 35 for 0.5 s without a break, to 0.1 s; left out when
  it never happens.
- Lines, in this order:
  - ended early: "You stopped after about S seconds, in the band for X of them. Stopping early is
    fine.";
  - every voiced frame in the band: "In the band for all L seconds.";
  - settled: "In the band for X of the L seconds. It settled after about T seconds.";
  - never settled, with the median d after the first 0.3 s within 35 cents: "In the band for X of
    the L seconds, in short stretches.";
  - never settled and the median beyond 35 cents: Lesson 3's distance lines by that median, 60
    cents or less "Your note sat about N cents below Merc's, close to the band. Listen again, then
    aim a touch higher." (or above and lower), beyond that the size in semitones with "nearer a
    different note", as "About two semitones below, nearer a different note. Listen again, then
    slide up to the band.";
  - added to any of these when the octave count is not zero and the median d is within 50 cents,
    where the nearest note is still Merc's: "You sang it an octave lower: same note." (or higher).
    Between 51 and 60 cents there is no octave line, so a different note is never called the same
    one (FACTS 43).
- Which take counts: each hold counts its latest take with a reading; a later one replaces it, and
  a take without a reading replaces nothing, as Lesson 3 counts its notes.
- The reader reports nothing about length beyond the hold: no longest hold, no best, no "longer
  than last time" (REQ-GVC-070).
- Every template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface
  `finding`) in a unit test, as Lesson 3's do: no breath, airflow, lung, tiredness or health label
  (REQ-GVC-071), and nothing that names the kind of start (REQ-GVC-076).

Listening: Lesson 3's `kit/listen.ts` unchanged: `micManager.acquire('lesson-05')` for each take,
released when the take ends, on leaving the section, on `pagehide` and when the tab is hidden; the
YIN-only F0 stream; one AudioContext through `Sound.context()`; nothing plays while a take is open;
nothing is recorded or kept, and nothing leaves the device (FACTS 57). At most a count-only
"checkpoint finished" event, once the Lesson telemetry track exists (REQ-GVC-090).

Accessibility and motion: the band state is words plus the mint edge, never colour alone
(REQ-GVC-082); after each take the chart's text summary reads, for example, "Merc's note A3; your
line in the band for 8.4 of 10 seconds, settled after 0.5 seconds" (REQ-GVC-085). Start, Again,
Lower, Higher, Hold for 15 seconds, Again, Done for today, the comfort buttons and
the four feelings are real buttons of at least 44 px in a keyboard order that follows the flow; a
button the flow does not offer is absent, not disabled; Space never starts a take by itself
(REQ-GVC-080). Under reduced motion the ring shows the phase and the seconds as words and a number,
and the Mercs skip their reactions (REQ-GVC-083).

Tests:

- Unit, the hold reader on synthetic frames: a steady A3 for 10 s reads "In the band for all 10
  seconds."; the same with one 0.05 s stretch outside the band reads "In the band for 9.9 of the 10
  seconds", never "all"; a take that starts 80 cents low and stays in the band from 0.6 s gives the
  settled line with 0.6; a take whose median sits in the band but never stays 0.5 s gives "in short
  stretches"; a steady take 45 cents low gives the "close" line; a voice that stops at 3.0 s of a
  15-second hold gives the stopped line with 3; an octave below and 20 cents high adds the octave
  line; an octave below and 55 cents high gives the "close" line with no octave line; 0.4 s of
  voice gives no steady note; no voiced frame in 6 s gives the "didn't hear you start" line. Plus
  the claims check on every template.
- Unit, the flow rule: after a ten-second take, Easy and Workable offer Hold for 15 seconds, Again
  and Done for today; Effortful offers only Done for today, with no Again and no
  celebration; Uncomfortable offers no hold and picks the rest card; Hold for 15 seconds is absent
  while hold 1 has no take with a reading; Again is absent after a hold's
  third take; after a fifteen-second take, Easy gives both readings from the counted takes; Merc
  celebrates only after Easy or Workable and at least 80 % in the band.
- End to end, with the fake microphone's steady A3 (`src/e2e/helpers/tone-wav.ts`,
  `writeToneWav(220, 20)`, `fakeMicArgs`; 20 s rather than the helper's default of 5,
  `tone-wav.ts:29`, so one file outlasts a whole fifteen-second take without relying on the fake
  device's loop, as `src/e2e/guided-voice-check.spec.ts:17-20` does): the lower voice on A reads
  "In the band for all 10 seconds" and asks "How did that feel?" before any longer hold; "Easy"
  shows Rest with Hold for 15 seconds, Again and Done for today; the fifteen-second hold reads
  "In the band for all 15 seconds", and "Easy" shows both readings and, in the Wrap, the Voice
  Mirror card with "Ten minutes, gently, most days"; moved Higher by one, the same input reads
  "About a semitone below…"; the higher voice adds the octave line. "Effortful" after the first
  hold shows no Hold for 15 seconds and no Again, only Done for today, and no celebration; after
  the third take of a hold, Again is gone. "Uncomfortable" shows no further hold and the doctor
  lines, and the Wrap shows the rest card with no "Ten minutes" line. "Just listen today" requests
  no microphone and leaves the same rest card. The microphone stops listening at the end of each
  hold.

### 7. Recall and quick check

- **Recall**: the kit's quiz at the top of the page with Lesson 3's questions 3 and 4 as committed,
  word for word, under Lesson 3's ids `l03-q3` and `l03-q4` (FACTS 3), shown to everyone because
  Lesson 3 is a prerequisite (CURRICULUM § 3.3). It is reshuffled from a seed of its own (keys
  `fyp-l05-recall-seed` and `fyp-l05-recall-v1`), and earlier answers are never shown, so the
  answers measure delayed retrieval (MASTER-PLAN § 9). "Try Lesson 3, Step 4 again" and "Try Lesson
  3, Step 5 again" are plain links to Lesson 3's steps, `/learn/03#lesson`, opening in a new tab so
  the viewer keeps their place here, as Lesson 4's recall links Lesson 2's (its Toys 5); never
  `data-goto-step`, which would move this page's own deck. It takes no `lesson`, so it marks
  nothing done. Neither question plays a sound.
- **Quick check**: LESSON.md's four questions, three answers each, shuffled per viewer from a stored
  seed, ids `l05-q1` to `l05-q4`, keys `fyp-l05-seed` and `fyp-l05-quiz-v1`, and `lesson: 5`, so
  answering all four marks Lesson 5 done in the explorer; a check icon and ink (not gold) on the
  right answer, and feedback that links back to Steps 1, 2, 4 and 5 (`data-goto-step`). No feedback
  line starts with "Right", "Yes" or "Correct": the kit prints "Right." or "Not quite." itself
  (`kit/quiz.ts:167`). Answers stay in localStorage until the Lesson telemetry track exists.
- Two quizzes on one page need the three changes to `kit/quiz.ts` that Lesson 2's spec lists (a
  root per quiz, `lesson` optional, a question `id`); Lesson 2's page brings them, and this page
  publishes after it.

### 8. Go deeper

- A `details` drawer, closed by default, under Step 3's toy: what singers say and do (FACTS 16),
  belly in or out (FACTS 30, 31), and the name for holding back (FACTS 21, 23).

## Audio

Every tone is synthesised in the page through `kit/sound.ts` at the frequencies in FACTS 71, with
the house envelope rules, started only by a tap. Merc's notes and every voice use the kit's "ooh"
(vibrato 5.5 Hz, ±14 cents), which every band chart draws as a steady line at the note's centre
(Look). Two additions to the kit: a noise source (band-passed, for the air-first start's "h", and a
3 ms burst for the catch), and a voice that follows a contour of pitch and level over time, for the
hook's takes and the hold demo (Lesson 2's spec asks for pitch contours; this page adds level).
Push's Hold the note stops itself after 20 s. Nothing autoplays, there is no music bed, and nothing
plays while a take is open.

## Mercs

Lesson 1's setup (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer, loaded after first
paint, one WebGL context each, stills when WebGL fails or would run on the CPU. Reactions: both
`listen` to the cold open's takes; blue `sing`s the note for the lower voice and orange for the
higher, while the other `listen`s; both `listen` during a hold; the singing Merc `celebrate`s once,
with no sparkles, only after an Easy or Workable answer for a take in the band for at least 80 % of
its length (Toys, 6), never after Effortful or Uncomfortable, and never because a hold was longer.
Orange's line in Step 2 is a bubble with orange's still, as the cold open's bubbles are. Under
reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today: Voice Mirror**, `mercurypitch.com/mirror?lesson=05`, in the two versions the checkpoint
  picks (Toys, 6). Its second task is the hold the lesson teaches: any comfortable note, a fixed 6 s
  with "I'm done" after 2 s, and a result in cents for the drift (a rate, in cents a second) and the
  wobble that sets a vibrato apart; its third task plays five notes to sing back (FACTS 59). It is
  its own document, so a first-time visitor meets no First Light (FACTS 61). The `?lesson=` marker
  records nothing until CURRICULUM § 4 item 6 ships. Small app content, as Lesson 3's spec notes:
  the first glide's "to your highest" would read better as "to your highest comfortable note"
  (FACTS 60).
- **Long Note, needed before the lesson links it** (the card's drill; CURRICULUM § 4 items 1, 2, 6
  and 7; FACTS 62 to 64 and 66):
  1. A slug, proposed `/exercises/steady-note`, registered in `EXERCISE_SLUGS` as
     `{ kind: 'exercise', exercise: EXERCISE_LONG_NOTE, durationSec: 10 }`, with no notes, so the
     target is the preset's anchor, and a line in `src/tests/slug-map.test.ts`. It opens at ten
     seconds, as the owner decided on 19 October 2026 (LESSON.md; FACTS 63).
  2. The `durationSec` launch field: on `ExerciseLaunch` and the launch override (beside
     `difficulty`), passed by `applyExerciseSlug` (`src/App.tsx:592-636`); read by `ExerciseShell`
     as guided length, then launch length, then saved timer (`effectiveTimerSeconds`,
     `ExerciseShell.tsx:524-526`); shown selected on the timer toggle without writing the saved
     preference, and dropped if the viewer picks another length. Pitch Hold shares the field
     (Lesson 3's spec).
  3. Long Note's duration score reads that same effective length, not `activeTimerSeconds()`
     (`use-long-note-controller.ts:163`). Without this, a ten-second launch on a device that saved
     30 s scores ten seconds of coverage out of thirty.
  4. App content: the card's two sentences and its "Breath Control" tag (`ExerciseMenu.tsx:83-90`;
     FACTS 62), the help's summary and its "and how long you hold it" (`exercise-help.ts:28-36`),
     and the setup screen's "The longer and steadier, the better." (`LongNoteExercise.tsx:106`)
     invite the longest hold, and the card's second sentence promises what the claims rules forbid
     (REQ-GVC-070, REQ-GVC-071). Proposed: "Hold one comfortable note, steady, for a length you
     choose.", tags "Stability" and "Steady note", and a help line naming what is scored:
     steadiness, drift and time in the zone over the chosen length. A slug opens past the card, but
     the library still shows it.
  5. The octave: Long Note scores its drift and steady zone in raw cents against the written target
     (an octave away is 1,200 cents) and takes its targets from the saved voice preset (tenor by
     default). Until the octave-folded option ships (§ 4 item 7), LESSON.md's editorial copy sends
     the viewer to Settings first, as Lesson 4 does for Scale Runner. Long Note belongs on item 7's
     list beside Pitch Hold and Scale Runner.
  6. The `?lesson=05` marker, because a slug boots the main app, where First Light opens on a first
     visit.
  - One more for the App content track to weigh: Long Note's Stability counts vibrato as wobble
    (FACTS 64), while Voice Mirror sets it apart and this lesson says a small vibrato can sit
    inside the band.
- **No Ascent link** until weeks 2 and 3 are rewritten (§ 4 item 8). Week 2, "Breath & Power",
  still promises in its focus what the claims rules forbid, lists "Longer, calmer exhales day by
  day" among its goals, and has two videos whose titles promise the same (FACTS 68).
- **Not linked: the Guided Warmup's breath cycle**, in 4, hold 4, out 8 (FACTS 65): the lesson asks
  for no breath hold.
- When the slug ships, LESSON.md's editorial note gives the copy, and the explorer card's note
  changes to the link.

## Explorer and season data

- **Season data**: Lesson 5's entry in `kit/season.ts` (`:173-181`) gains today's link, `href`
  `/mirror?lesson=05`, `addr` `mercurypitch.com/mirror`, `label` "Voice Mirror" and `note` "its
  Hold: a comfortable note, held steady" (a note is printed on the card, so it speaks to the
  learner), and `minutes: 17` (FACTS 2, 70), and keeps its `needs` until the slug ships, with the
  owner's lengths: "Long Note with a fixed 10 or 15 s length (durationSec)" (FACTS 63, 70), for
  the team and the admin console, never drawn on the card. Its `sig` already reads the signature.
- **A text-only lesson**: the "Ready · read" state Lesson 4's spec proposes (no Watch button, the
  card's length from `minutes`), and cards for other lessons linking to their own `/learn/NN`.

## New engineering, in one list

1. The lesson host: `learn/05.html` at `/learn/05`, wired as `/learn/01` is (`vite.config.ts`, the
   worker and service worker's standalone paths, the sitemap, `llms.txt`), with
   `src/features/lessons/lesson-05/`.
2. Kit parts from Lesson 3's spec, if not built by then: `band-chart.ts`, `listen.ts`, `take.ts`,
   `comfort.ts` and `Sound.context()`; promoted from Lesson 3's page, `folds.ts` and the voice
   choice on `fyp-voice`; promoted from Lesson 1's, the predict widget, the loudness toy and the
   breathing ring.
3. Kit extensions for this page: the band chart's fixed-frame hold mode (10 or 15 s), level strip
   and settled marker; the hold reader in `take.ts`; in `sound.ts`, a noise source and contours of
   pitch and level.
4. The page's own toys and rules in `lesson-05/`: Push with Hold the note, Breath (gauge and
   figure), Three starts, and the hold flow (`hold-flow.ts`).
5. Quiz ids and keys (the Lesson telemetry track; the recall needs Lesson 3's ids), and the tests in
   Toys 6.
6. For the Long Note link: the slug, `durationSec`, Long Note's effective length, its new copy, the
   octave note or option, and the `?lesson=` marker (Practice links).
7. The season entry's link, `minutes` and `needs`, and the explorer's text-only state.

## Contract and page QA

Lesson 1's contract, unchanged and binding, with its changes for the app (Lesson 1 WEB-SPEC, "On
the app"): no CDN, self-hosted fonts, Web Animations in place of GSAP, practice links carrying
`?lesson=05`, 16 px gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px, visible focus, a single dark theme with every colour a token and an
explicit body background, sound only after a tap, localStorage only for per-viewer conveniences
inside try/catch, and the whole page usable with no sound, no WebGL, no storage and no microphone.
Storage holds only the voice choice (`fyp-voice`, Lesson 3's key), the warm-up's Skip
(`fyp-l05-warmup`) and the two quizzes' seeds and answers (`fyp-l05-recall-seed`,
`fyp-l05-recall-v1`, `fyp-l05-seed`, `fyp-l05-quiz-v1`): no take, no reading, no answer to "How did
that feel?" and no checkpoint ending.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The microphone is requested only by Start; "Just listen today" and a refused permission never
  open it; the browser's microphone indicator goes off at the end of each hold, on leaving the page
  and when the tab is hidden.
- Each hold stops listening at exactly its length from the first voiced frame; no control lengthens
  a hold, and nothing shows a best or longest time.
- "How did that feel?" follows every take; neither the fifteen-second hold nor Again is offered
  after "Effortful" or "Uncomfortable"; Again is gone after a hold's third take; Merc never
  celebrates after "Effortful" or "Uncomfortable".
- The Wrap shows the rest card after "Uncomfortable" and after "Just listen today", and the Voice
  Mirror card otherwise.
- The network panel shows nothing sent while the microphone is open, and storage holds nothing but
  the keys above.
- The whole checkpoint, Push (with Hold the note), the gauge, the figure and the three starts run by
  keyboard alone, and a screen reader hears every state and reading.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The app-check sweep at phone and desktop width, with the checkpoint open in each state.
