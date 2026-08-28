# Ear Lab retest — findings and the fix plan

Founder retest of PR #647 on 2026-08-28, plus an in-depth review of every
stage against the same complaints. Findings first (what was reported, what
the code and a Chromium probe say), then the plan in the order to fix, then
the decisions — taken and open.

The fixes land on `feat/ear-lab-catalogue` (PR #647) as stacked commits,
one per plan item, before the PR merges.

Probe: `dist` served locally, onboarding seeded away the way the audit does
it, Hairline and Echo driven by keyboard; captures under
`~/agent-out/mercurypitch/2026-08-28/retest-probe/`.

## 1. What was reported

### 1a. "I cannot type 1/2 to answer" — resolved: Vimium

The keys are wired and they work: `ThresholdDrillView` hands `keys` to
`EarStage`, which listens on `document`
(`src/features/ear-lab/EarStage.tsx:121`), and the first armed pad takes
focus (`EarStage.tsx:141`). In the probe, `1` pressed in the answer phase
produced the verdict at once. The founder found the cause: Vimium binds the
digits as count prefixes and swallows the keydown before the page sees it;
excluding the site fixes it. No bug — but see 2g for making the swallow
visible, and the two things that made it _feel_ broken are real:

- **The pads arm before the second tone has sounded.** `playTone` resolves
  when the note is _scheduled_, not when it ends, and it is single-voice — a
  new note replaces the previous one with an 80 ms release
  (`src/lib/audio-engine.ts`, `playTone`). Hairline does
  `playTone(first) → wait(gap 220) → playTone(second)` and returns
  (`src/features/ear-lab/HairlineDrill.tsx:57`), so the first tone is cut at
  220 ms of its 500, the second plays in full, and the answer phase opens
  ~240 ms into a 1.2 s stimulus. The probe pressed `1` at 400 ms and got a
  verdict. A key pressed while the second tone is still sounding is
  accepted as an answer, and the verdict flashes while the tone is still in
  the air.
- **The verdict lives 420 ms** (`REVEAL_TIMING.thresholdMs`,
  `src/lib/ear/timing.ts:78`; timer at
  `src/features/ear-lab/use-threshold-run.ts:197`), then the status line
  goes back to "Listen…" and the next pair sounds. Press, blink, next —
  nothing acknowledges the key long enough to read.

### 1b. Wrong answer: the red text vanishes; auto-advance; a persistent "last run"

Confirmed, and it is the same 420 ms (threshold) / 650 ms right, 1500 ms
wrong (identification, `timing.ts:79-81`). There is no auto-advance setting
anywhere; every run advances itself. The verdict is carried only by the
stage's status line (`EarStage.module.css:148`, 1.08rem in the bar), and
`setLastCorrect(null)` wipes it when the next round starts.

### 1c. Calibration "takes forever", the reversal count jumps

Calibration interleaves **three** staircases, shuffled trial by trial and
pooled (`createCalibrationTracks`, `use-threshold-run.ts`), 8 reversals
each. The bar shows the **active track's** count — "Track B · reversal 3 of
8" — so it reads 1, 4, 2, 5… as the tracks take turns
(`ThresholdDrillView.tsx`, `progress()`), and the three pendulums that
would explain it are hidden on a phone (`!compact()`). Nothing resets on a
mistake; it is a different track each trial.

The words, since they were never said on screen:

- A **trial** is one question — a pair of tones and your answer, about
  three seconds.
- The staircase makes the gap smaller after two right answers in a row and
  bigger after one miss. A **reversal** ("turn") is the moment it changes
  direction — from getting harder to getting easier, or back. Every turn
  happens near the edge of what you can hear, so the reading is the average
  of the last few turns. A track stops at its turn count.
- `maxTrials` is only a safety cap per track (a track that never settles
  stops there); it is not a target.

Length today: 8 turns per track under 2-down-1-up is typically 25–35
trials, so 75–105 questions at ~3 s — four to five minutes, not the "about
3 min" the pad promises; a track that never settles can run to 60, all three
to 180. It does end, but nothing on screen says how far along the whole
thing is. Most of a track's first ten trials are spent walking down from
the wide starting gap (50¢) to the region that matters.

### 1d. "Abandon"

`ThresholdDrillView.tsx:168`. Long, and it reads as a reproach. Decision
taken: the stop control is the stop square, icon only, in both modes.

### 1e. Sing mode on Echo: no sign the mic hears, "wrong" every time

The scorer judges each expected note **inside a fixed window on the grid
the phrase was played on**: note _i_ must be sung between
`250 + i·500 ms` and `+380 ms` after the answer phase opens
(`EchoDrill.tsx:185`, `noteWindows` in `src/lib/ear/phrase-score.ts`). There
is no count-in, no click, no moving cue — the singer cannot know where the
grid is, so nearly every note lands outside its window and reads as
unvoiced or wrong. "Press when you are done" judges the same fixed windows
early. The auto-judge timer (`EchoDrill.tsx:215`) fires at
`250 + n·500 + 450 ms` — for five notes, 3.2 s after the prompt — then the
1.5 s reveal, then the next trial: "blazingly fast".

Nothing on the console shows input either: no level, no recognised note,
so a singer cannot tell a dead mic from a bad take. (Home's sing mode has
the listening ring and a 2.6 s window for one note; that is why Home works
and Echo does not.)

Span in sing mode: identical (`SpanDrill.tsx:140`, `:165`).

### 1f. Tap mode on Echo: "what am I tapping?"

The ladder is eight rungs, 1–7 and 1′, each with its solfège word, and the
answer is the phrase's **notes** in order — the strip shows "n of N" and
"Take one back" (`PhraseConsole.tsx`). The rungs are **silent**
(`PhraseConsole.tsx:61`), so tapping gives no sound and the pads do not
read as notes; the only instruction is the answerHint in the small status
line. Tapping "anything" fails because the judge wants the exact degrees in
order (`judgePhrase`).

### 1g. Span: "I can click multiple notes for an answer"

By design — the answer is the whole phrase, one rung per note, judged when
the count is reached — but nothing makes that obvious beyond "n of N". Same
fix as Echo's console.

### 1h. The description sits badly beside the play pads

The paragraph under Practice / Calibration (`ConsoleNote`, e.g. Bassline's
"The tonic chord rings on the guitar while four bass roots walk under it…")
is a wall of text where the console's controls should be. It moves to an
info card (3.6) and the console keeps only the pads and the question.

## 2. Found in the review (not reported)

### 2a. A miss's slow replay overlaps the next trial

Identification drills replay the item slowly on a miss, fire-and-forget:
`void trial.replayOnWrong()` at `use-identification-controller.ts:170`, and
the next round starts on a 1500 ms timer (`:180`). The next trial's `play()`
sets its own `cancelled = false` and starts the cadence while the replay
loop is still running — two sequences fighting over one voice. Replays
longer than 1.5 s: Echo 2.2–4.4 s, Span up to 12 s, Leap 1.8 s, Stack ~2 s,
Bassline 3.8 s, Cadence 4.9 s, Subdivide 8.7 s, Critique 3.2 s, the wild
drills ~2–3 s. Only Contour (1.46 s) and The Pull (0.9 s) finish in time.
This is the "continues blazingly fast" on a miss, everywhere.

### 2b. First tone cut short — Hairline, Contour, Leap

The pattern in 1a: `playTone → wait(gap) → playTone`. Hairline's first tone
plays 220 ms of 500 (`HairlineDrill.tsx:57`); Contour's 110 of 330
(`ContourDrill.tsx:54`) — a blip, on a drill whose top tier is quarter-tone
moves; Leap's 140 of 550 (`LeapDrill.tsx:48`). The second tone is always
the long one. Home, The Pull, Echo, Span, Gravity wait the note length
themselves and are right; Grid, Beat Hunt, Drift, Pulse, Subdivide,
Cadence, Bassline, the wild drills and the desk schedule on the audio clock
and are right.

### 2c. Stack's broken-chord replay collapses

`StackDrill.tsx:54-60` awaits `playTone` per note with no wait between, so
every broken note is scheduled at once and each replaces the last within
80 ms; what sounds is a flick and the block chord.

### 2d. The question is the smallest thing on the stage

During the answer phase the question sits in the bar's status line at
1.08rem while the console's lead pad says "Your call · Resolution · cents"
— the measure, not the question. The pads carry the choices, the
instrument fills the middle, and the actual ask is a caption. The
founder's "bigger font, more obvious" is right.

### 2e. Arming has no cue

The lead pad's lamp changes from "Listening" to "Your call" — a colour on a
disabled pad. No sound, no motion; on a phone the pads simply become
tappable. With 2b fixed the moment is real, so it deserves a cue.

### 2f. Calibration on a phone has no track view

The three pendulums hide when compact; the per-track text is all that is
left (1c).

### 2g. A swallowed key is invisible

When an extension takes a keydown (Vimium's digit counts, a Vim-style
navigator), the page sees nothing and the keycaps on the pads quietly lie.
The `keyup` usually still arrives: a keyup for a registered key with no
keydown in the previous 300 ms is the signature. Also: `event.key` only —
`event.code` (`Digit1` / `Numpad1`) would make the digits layout- and
Num-Lock-proof.

### 2h. Echo/Span reveal copy

On a miss the status says "That was Do Mi Sol Mi Do — listen again." while
the chain colours the notes; nothing says what _you_ tapped or where the
first slip was, and it is gone in 1.5 s.

## 3. The plan

Stacked commits on `feat/ear-lab-catalogue`, in this order. Each commit:
unit tests, the testing doc's section, the audit walk, `pnpm check`,
`pr:validate`, and the full unit suite before the push.

### P0 — mechanics that make the drills wrong or unusable

1. **Sound what the design says.** A `playToneFor(freq, ms)` helper on the
   Ear Lab's engine seam that schedules and then waits `ms`; Hairline,
   Contour, Leap and Stack's replay use it. Pads arm only after the last
   tone ends (plus `tailMs`). Test: a fake engine records scheduling times;
   the answer phase opens at tone + gap + tone.
2. **A miss's replay finishes before anything else starts.** The controller
   awaits `replayOnWrong` (with the Last call plate saying "replaying,
   slower…") and only then starts the hold. Stop still cuts it. Test: a
   trial whose replay takes 2 s; the next `play()` is not called before
   it resolves.
3. **The verdict stays; auto-advance is a switch; the hold is a setting.**
   - A **Last call** plate under the pads: the mark (brass check / garnet
     cross), the verdict sentence, the consequence ("the gap narrows to
     9.5¢" / "rating 612 → 618"), what you answered on a miss. It persists
     until the next verdict; the pads keep their right/wrong colouring
     until the next trial arms. On a phone: one line and the mark, the
     explanation on a second line, between the pads and the plate.
   - **Auto-advance** in the stage bar next to the stop square — a small
     labelled switch, **on by default**, persisted (`ear-lab-store`,
     `autoAdvance`). On: the verdict holds for the setting below, then the
     next trial sounds. Off: the run parks on the verdict and a **Next**
     pad (Space) starts the next trial. One rule everywhere — a
     calibration run pauses the same way; a pause between trials does not
     bias a threshold.
   - **Hold length** in the rack's Sound panel, beside the switch: a slider
     from 1 to 10 s, default 1.5 s (`revealHoldMs`). Identification drills
     count it from the end of the replay.
   - Tests on both views; the audit checks the plate persists across a
     trial and that the switch is in the bar.
4. **Sing mode that can be sung.** Replace the fixed grid with free-time
   scoring:
   - `src/lib/ear/sung-notes.ts`: `segmentSungNotes(frames)` — voiced runs
     ≥ 120 ms, split on a pitch step > 70 cents, the median MIDI of each
     run names the note; pure, tested on synthetic frames.
   - `scorePhraseFree(sung, expected, rootMidi)`: position by position, in
     order, within 60 cents octave-folded, `firstMiss`; extra and missing
     notes are misses, never a crash.
   - The console while the window is open: the same strip tapping uses
     fills **live** with the recognised notes' solfège, the mic lamp glows
     with input level, and the lead pad reads **Done** (Space). Auto-judge
     after 1.2 s of silence once at least one note is in, or at a generous
     ceiling (twice the phrase's length + 3 s). No count-in needed.
   - Echo, Span and Echo in the Wild share it; Home keeps its ring.
   - `noteWindows` and the grid scorer go, with their tests.
5. **Calibration you can see the end of.**
   - Progress as the whole run: "Turns 9 of 18 · Track B · 12.0¢", a
     three-segment mini strip that also fits a phone, and "about N
     questions left" from the turns still needed at the run's own pace.
   - Shorter, without touching the protocol: 6 turns per track (18 in all)
     and a **warm start** — each track opens at 1.5× the latest reading
     (practice or sealed) instead of the catalogue's wide start, so the
     first ten trials are no longer spent walking down from 50¢. Safety
     cap 40 trials per track. Expected length: 15–20 questions per track,
     45–60 in all, about two and a half minutes. The pooled reading keeps
     its ±spread and the three tracks.
   - The Begin pad and the idle line say it in these words: "three short
     staircases, shuffled and pooled — about 50 questions".
   - The stop control is the stop square, icon only, in practice and in
     calibration; the end plate already says nothing was marked.

### P1 — the presentation the founder asked for

6. **The instrument card, top left.** An engraved plate under the bar, at
   the stage's top left: the instrument's icon, its name, what it measures,
   and a two-to-three-line description; "More" unfolds the full text (the
   paragraph that sits under the play pads today). On a phone it collapses
   to one row — "About Bassline" with a chevron — and unfolds over the
   instrument; folded by default, remembered per drill. The console loses
   the paragraph and keeps the lead pads, the question and the answer pads.
7. **The question as the headline.** The answer hint moves into the console
   above the pads in the stage serif (1.35rem, 1.2rem on a phone), with
   the keycap hint under it ("1 · 2 on the keyboard"); during the stimulus
   the headline is the listen hint with the step lamps. The bar's status
   line keeps the mode and the running level. The lead pad says the phase
   word only.
8. **The ladder sounds and says what it wants.** Tapped rungs play their
   note (short, the drill's own voice); the console label reads "Tap the 5
   notes back · 2 of 5"; a hint line explains 1′. Same for Span, Bassline
   and the wild ladders.
9. **Arming cue.** A brass tick on the Last call plate's rail and a soft
   mechanical click when the pads arm (through the click voice, so the
   volume slider governs it).
10. **Reveal copy per drill.** Echo/Span: "Do Mi Sol Mi Do — you tapped Do
    Do Do Do Do; first slip at note 2". Cadence/Bassline: the numerals both
    ways. Desk: the band and the dB. Threshold drills: the level move.
11. **Keys by `event.code`** as well as `event.key`; numpad digits count.

### P2 — polish

12. **Swallowed keys say so.** A keyup with no keydown for a registered key
    shows a one-time note in the console: "The browser took that key — an
    extension such as Vimium binds the digits; exclude mercurypitch.com in
    it, or tap the pads."
13. The Pull, Beat Hunt, Weight: the "first / second" pads show the two
    stimuli as lamps that light as each sounds, so "which was…" has a
    referent on screen.
14. Span's idle line says the length in notes the staircase will start at.

## 4. Decisions

Taken by the founder, 2026-08-28:

| Decision                             | Taken                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Auto-advance default                 | On, once the Last call plate exists; the switch in the stage bar        |
| Hold length                          | 1–2 s by default; a 1–10 s slider in a settings panel for longer breaks |
| "Abandon"                            | The stop square, icon only                                              |
| The description beside the play pads | Moves to a top-left info card, collapsible on a phone                   |
| The digit keys                       | Not a bug (Vimium); detect the swallow and say so                       |

Also taken by the founder, 2026-08-28 (the recommendations, confirmed):

| Decision                            | Recommendation                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Does Calibration honour the switch? | Yes — one rule everywhere; a pause between trials does not bias a threshold                                                 |
| Calibration length                  | 6 turns per track with a warm start from the latest reading; safety cap 40 trials per track                                 |
| Sing mode scoring                   | Free-time (segment the sung notes, compare in order); drop the grid                                                         |
| The ladder sounds when tapped       | Yes — melodic dictation on a keyboard always sounds; the item bank's tap difficulties were set silent, so re-seed them once |
| An audible arming click             | Yes, on the click voice, so the volume slider governs it                                                                    |

## 5. Not touched

The staircase rule, the Elo, the Column and the index weights, the rooms,
the Field Book's reading, the desk's renders, the Ear Path. The fixes above
change pacing, feedback, the stage's layout and scoring for the sung modes
only.

## Log

| Date       | Item                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-28 | P0.1 — every tone sounds whole (`playToneFor`); Hairline, Contour, Leap and Stack's replay wait their tones out; the pads arm after the last one.                                                                                                                                                                                                                                                                     |
| 2026-08-28 | P0.2 — the identification controller awaits a miss's replay (`replaying()`), the hold counts from its end; Stop still cuts it.                                                                                                                                                                                                                                                                                        |
| 2026-08-28 | Home — the Ear Lab cover had no span class and collapsed to one twelfth of the gallery; it is a row of its own after the night rooms, and a test guards every cover's class.                                                                                                                                                                                                                                          |
| 2026-08-28 | P0.3 — the Last call plate under the pads (verdict, consequence, what was named); the auto-advance switch in every stage bar and the rack (`autoAdvance`, on by default); the hold slider 1–10 s (`revealHoldMs`, 1.5 s) in the rack's Sound panel; one `createRevealPacer` behind the three engines, with Next (Space) when parked; the stop control is the square alone.                                            |
| 2026-08-28 | P0.4 — sing mode in free time: `segmentSungNotes` + `scorePhraseFree` (`src/lib/ear/sung-notes.ts`) replace the count-in grid; `useSungAnswer` polls the open window, fills the strip live with a mic lamp, closes on 1.2 s of silence, at the ceiling, or on Done (Space); Echo, Span and Echo in the Wild share it (Wild's sung runs under `wild-echo-sing`); `noteWindows`/`scorePhrase` and their tests are gone. |
| 2026-08-28 | P0.5 — `CALIBRATION_STAIRCASE` (6 turns a track, the last 4 averaged, 40 trials at most) and `calibrationConfig`'s warm start at 1.5× the latest reading; the bar shows the whole run ("Turns 9 of 18 · Track B · 12.0¢ · about N questions left") with a three-bar `TurnsStrip`; "about 50 questions" on the amber control, the Begin pad and the idle line; practice says "turns".                                  |
| 2026-08-28 | P1.6 — the instrument card: the caption and the paragraph hang on the stage's top left (`InstrumentCard`: three lines then More on a desk; one row "About Hairline" on a phone, unfolding over the instrument; per drill in `earInfoOpen`); `INSTRUMENT_ICON` moves to `instrument-icons.ts` with `iconForDrill`; the console keeps the pads and the question.                                                        |
| 2026-08-28 | P1.7 — the question is the console's headline (`.headline`/`.question`, 1.35rem, 1.2rem on a phone) with the answer keys named under it by `formatKeyHint` (`key-hint.ts`: "1 · 2 on the keyboard", "1–7" past three); the figure's caption is gone; the lead pads say the phase word only.                                                                                                                           |
| 2026-08-28 | P1.8 — the ladder sounds: `soundRung` (`ladder-voice.ts`, `LADDER_TIMING.tapMs`) under every tapped rung in Echo, Span and the wild Echo, Bassline's rungs strum their root; the pads read "Tap the N notes back"; the top rung explained; Echo's and Bassline's silent-ladder item difficulties re-seeded once (`reseedSilentLadderItems`).                                                                          |
| 2026-08-28 | P1.9 — the arming cue: `useArmingCue` (`arming-cue.ts`) clicks the room's click voice at `ARMING_CUE_GAIN` under the bench volume each time the pads arm; the Last call plate's rail ticks brass (`armed` on `EarStage`, `data-armed`); the audit waits for the tick.                                                                                                                                                 |
| 2026-08-28 | P1.10 — the reveal says both ways: `IdentificationDrillView` takes `answerVerb` and `slipNote` ("You tapped Do Re Sol · first slip at note 3") from Echo, the wild Echo and Bassline; Span's slip line names the tapped phrase too.                                                                                                                                                                                   |
| 2026-08-28 | P1.11 — `keyMatches` (`key-hint.ts`): a stage key matches `event.key` or the digit in `event.code` (`Digit1`, `Numpad1`), so numpads, shifted digits and moved rows answer.                                                                                                                                                                                                                                           |
