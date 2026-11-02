# Lesson 24 hand-back: "Harmony against a drone" (after the fix pass)

Files: `docs/plans/find-your-pitch/lessons/24-drone-harmony/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/24/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 25's
folder was not touched; Lesson 25 is cited in words only, since its writer is mid fix pass.

Checks, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/24-drone-harmony`: **305
  citations read, 0 findings**.
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/24-drone-harmony`: **2,137
  words**, cap 2,379 (242 under), under the lead's 2,230; steps' own text 104, 120, 95, 82.
- Built page, estimated as before: 2,137 + about 150 (Lesson 8 FACTS 4) + 89 for this page's nine
  lock, held and status lines = **about 2,376, 3 under the cap**. The nine lines and their counts are
  in WEB-SPEC Length and `verify24.py` section 12. Next cut, if a build's own count runs over:
  Step 3's quintet sentence (16 words).
- Chip: **16 minutes** (8.98 of reading + 7.08 of sound and tasks = 16.06); description 136
  characters with "A sixteen-minute lesson"; `timeRequired` `PT16M`; head title "How to sing in tune
  with a drone | MercuryPitch" (47).
- Claims validator's patterns (`claims_check.py`) over LESSON.md and WEB-SPEC.md: no matches. No
  emoji (only ♯ and ♭), no model name, no scratch path in the three files.

Process: no git, no pnpm, no downloads, no shared file or code touched; only the two node scripts
ran. Arithmetic: `s2pkg/24-tools/verify24.py` (`python3 -I verify24.py 2137`), now with section 13:
216 Hz's cents, the slide's end phase, a snap's loss at 180°, Step 4's envelope (J0 and a 400 s
numerical envelope, in hertz and in cents), Move do's drones, rates and rooms, Beat Hunt's rove.

## 0. What changed in the fix pass

Blocking:

- **B1.** Step 3's Tavi line (now without "So"), text with its two plays, Try and Notice are Step 2's
  predict's second reveal element, under the held line "Hear Step 2's two intervals to unlock this
  step." until that reveal; `onReveal` hides it. WEB-SPEC Toys 3, Edge cases, Tests 5 and 6, the
  preamble, FACTS 46 and 48 say so; FACTS 1a's Step 3 line is rewritten.
- **B2.** Step 4 plays Lesson 22's cold-open wave (±50 cents at six a second, grown in over 0.3 s),
  not Merc's usual one. Text: "A singer's wide wave swings the top note's harmonics past the drone's:
  the even throb weakens under a flutter." Notice: "straight, the throb is even. With the wave, it's
  much fainter and harder to follow." Never "gone" or "lost". FACTS 38 is rewritten from the envelope
  with the lead's figures (0.361; 0.281, 78 %; 0.061; 0.117, about a third; null near beta 2.4, about
  ±34 cents) as arithmetic for steady harmonic tones. **One refinement, worth your eye**: the lead's
  figures treat the swing as even in hertz. The kit's wave moves the oscillator's detune in cents
  (`kit/sound.ts:188-199`), which also lifts the harmonic's mean by F(I0(kappa) − 1), 0.14 Hz at ±50
  cents, so under the wave the slow beat runs at about **0.61 a second, with 0.113 (31 %)**, still
  about a third; the numerical envelope over 400 s confirms both models to the third decimal. The
  flutter is mostly at twice the wave's rate (components of 0.17 near 12 Hz, 0.10 near 6 Hz). So
  Tests 1's case reads "the envelope's strongest component under 2 Hz, from the play's schedule over
  400 s, is at most 40 % of the straight play's at 0.745 Hz", not "at the beat rate", which would
  pass trivially at 0.745. Sundberg's line stays in FACTS 37, about sung vibrato, and out of the copy.
  Step 4 now draws no band (the wave swings past both edges): the top note's chrome line over a
  "piano" tick, the drone pinned below.

Should fix:

- **S1.** Step 1's text, its two plays, Try and Notice are the cold open's second reveal element,
  under "Hear the slide at the top to unlock this step."; the toy still unlocks on the choice. FACTS
  1a now lists the mix-up card, Sing it's cue, the Wrap's lines, quick check 1's third feedback and
  quick check 2's options, with the tour-hold argument in Lesson 22's way (Step 4 three Nexts from
  Step 1 on a phone; the tour waits; a learner who goes there unasked has passed the predict).
- **S2.** Step 2's heading "Do two different notes throb too?"; Step 2's predict now asks "Which
  throbs faster?", so nothing near the top says "beat" before the cold open's reveal; FACTS 12 and 48
  rewritten.
- **S3.** The quiet check fails on any voiced run of 0.3 s or more at any pitch; its line is "The
  microphone heard a note during the drone. Check your headphones, then press Start again and stay
  quiet." (no "so"; says what it heard and what to do). Tests: a voiced run at an unrelated pitch (a
  tritone from do) fails. It runs before every set, Again's included.
- **S4.** Lab: stop at 2 s on do, at the holds' level and full volume, must give the stopped-early
  line; Bluetooth earbuds (profile switch, drone to the loudspeaker); the fifth over D4 in the timbre
  test; plus Move do's highest drones, G3 and G4, in both tests.
- **S5.** Every note set against the drone starts on the drone's audio time. Corrected arithmetic:
  the glide holds **11.96** beats, not 11.92, so the slide ends **13°** from in phase (pair within 0.2
  dB of in phase), not 29°. On a snap, Step 1's drag **restarts the top note in phase** (on a whole
  drone period from the drone's start, old voice released over 0.05 s). Why not a few dB under: at
  180° a top note 3 to 6 dB under still loses 10 to 15 dB of its fundamental, so the still unison
  would still change colour by chance. Both in Tests 1.
- **S6.** "If do feels low, move it higher." with Lesson 20's control, reach five higher and none
  lower, the drone, Merc's notes and the band moving together; every position keeps every preset 2
  inside (least room 2, the bass's top, with do on G3). The coach's question on the reach is kept.
- **S7.** The set's rules in Toys 6, tested in Tests 10. I took the lead's defaults with **one
  addition**: when a hold hears no voice in 6 s, the set ends with the no-start line, and if a hold of
  the set was sung before it, "How did that feel?" follows (Easy or Workable then offers Again while
  takes remain, never the next set). Reason: Lesson 5's own rule asks the question whenever anything
  was sung (`afterTake`, `lesson-05/hold-flow.ts:84-97`), and a singer who stops partway may have
  stopped for discomfort, which the answer reports. With nothing sung it is the lead's default:
  Again or Done for today, no question. The summary names an unread hold ("there was no reading on
  mi"); the celebration needs every hold read and at least 80 %.
- **S8.** The card's timbre sentence is gone; "Headphones help here too: its drone plays while it
  listens." takes its place; the editorial and FACTS 60 and 66 follow.
- **S9.** Step 2's `unlocks` (taps, Piano · Pure, Play all three) and `onChoice` (Steps 3 and 4's
  plays and drag, free play's states 2 to 4, "Just listen today"'s play) named in Toys 3.
- **S10.** FACTS 5b checks both lines against Lesson 25's final predict (raise G to G♯: "It turns
  major" or "It stays minor"): the lead's line answers nothing; `plan` leans softly ("a major chord"
  above "another change"), as Lesson 25's FACTS 5b also says. The lead's line is the default.
- **S11.** Lesson 22's reader, items 4 to 7 (item 5 added) and the straight-note and summary lines
  are cited by path and line, not restated; three tests at five seconds added (Tests 11).
- **S12.** Coach list: Step 4's lines, a headphone volume line (now in the copy: "Put on headphones
  to keep the drone out of the microphone, with the volume low enough to hear yourself."), the
  4-second wait ("To look at"), and "Sing along again" **once a visit, Season 1's cap** (Lesson 8
  WEB-SPEC:633, "the guide once more, once a visit"; `kit/comfort.ts:41`).

Nits: all taken. N1 31.8; N2 Play all three "the drone, do, with mi and so"; N3 six "so"s gone from
learner copy (cold open, Step 2's text, Tavi, headphones line, quick check 2, the card; the card's
range line is Lesson 10's and keeps its own); N4 "plain tone" gone with the sentence; N5 "the beats
between you"; N6 Pure "tuned to an exact ratio of small whole numbers"; N7 llms.txt line in the
file's form; N8 "Tuned pure"; N9 the drone waits until Merc's note has ended; N10 "Just listen
today"'s notes straight; N11 no headphones check, Move do, Start or sing-along after it, tested; N12
Lesson 22's vibrato line does not show; N13 the colour change worded and spoken; N14 drag rings 4 s;
N15 rove to 311 Hz, D♯4; N16 the other instrument setters; N17 editorial and FACTS 66 follow; N18
the S20a row below; N19 mix-up card "in Step 4, whose question it answers"; N20 "under 0.1 in
relative luminance"; N21 43 px throughout.

Lead's answers applied: head title "How to sing in tune with a drone | MercuryPitch" (FACTS 1a,
WEB-SPEC Sections 2; Decisions for the owner now "None open"); Drone Intonation's 80 ceiling is an
app fix in "What the kit and the app still need" (item 14 and Practice links), and the card's
editorial says "about 79 a round" is a round's score; the named cuts are made (formula drawer, the
card's timbre sentence, the sound gate's clause) plus shorter wording; Lesson 22 citations bound.

Not taken, or taken differently: only the two points above (S7's feelings question after a
partly sung set; B2's test worded on the strongest slow component, because the kit's cents wave
moves the slow beat to 0.61 a second). Nothing else was declined.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 23's)

- Lesson 24: a written lesson, text only, in
  [`lessons/24-drone-harmony/`](lessons/24-drone-harmony/) (research, article plan, facts, copy and
  page spec). A voice lesson with a scored checkpoint, three holds over a drone with headphones, and
  an unscored sing-along without them; both gates of the vocal coach bind it (§ 12 item 8). No page
  is built yet: it waits on Season 2's kit (seasons), on Lesson 22's four kit pieces (Merc's voice
  with its vibrato as a parameter, the band chart's new states, the centre-line reader, Lesson 5's
  hold flow in the kit), on its own (the drone chart's states, a drone under a take, the headphones
  check and the quiet check), on two lab tests (silence over a speaker drone; the drone's timbre) and
  on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the first lab test
  passes, its Sing it ships as the sing-along only. It goes live after the coach's sign-off and once
  `/learn/05`, `/learn/10` and `/learn/23`, the pages its chips and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry; the predicts and choices word for word)

### Lesson 24 · Harmony against a drone · voice; written; no page yet · hook kept

- **Opening:** Lesson 5's band chart between Merc and Tavi, a wide amber band at A3 named "drone ·
  A3" and a thin chrome line just above it, still, as Lesson 23's card drew them; Play the drone and
  the top note works before the choice, 220 Hz with 224 Hz, throbbing four times a second. Tavi:
  "They're nearly the same note. Push them closer: won't they clash even more?" Merc: "Hear them
  together first. Then I'll slide the top note down." Predict: "Merc slides the top note down,
  slowly, until it matches the drone. What happens to the throbbing as it arrives?" [ It slows, then
  stops ] [ It speeds up ]. The slide holds 224 for 1.5 s, glides to 220 over 6 s and holds 220 for
  2.5 s; the reveal waits for its end, and Step 1's words show with it. The plan's Beats word is
  replaced by Harmonic; every play of the steps, the Pure word's play, quick check 4's play, Step
  2's predict and the tour wait for the choice (Lesson 24 FACTS 1a, 40 to 47, 71). Lesson 3's closed
  Go deeper said the answer once, as the season's card intends.
- **Second predict (Step 2):** "Merc plays the piano's fifth above the drone, then its major third.
  Which throbs faster?" [ The fifth ] [ The major third ]. Its reveal, "The major third, much faster.
  (The fifth is the wider interval, which made it a fair guess.)", waits for both plays; Step 2's
  text and Step 3's words show with it.
- **Visual:** the drone chart, Lesson 5's band chart with a drone under it, the throb drawn as
  brightness from the harmonics' envelope, under 0.1 in relative luminance, never a flash: the drag
  and the octave, Lesson 10's beads with Piano · Pure, Lesson 5's band on mi with the piano's tick
  and the pure one, a singer's wide wave on the fifth. **Payoff:** the cold open's reveal (two close
  notes beat as fast as their difference, and stop in tune); Step 2's reveal, the piano's major third
  beating much faster than its fifth, and the pure chord ringing still; Sing it, do, so and mi held
  over a drone on do, with headphones, read on the middle of the line.
- **Tease:** a still of Lesson 25's opening as Lesson 25's package draws it, silent: "A minor tune,
  played twice. The second ending changes one note." (the lead's line), with the plan's line as the
  alternative `plan`, "Do, mi and so made a major chord. Minor keys hide another change.", true of
  this page but leaning softly on Lesson 25's predict. Lesson 24's own tease, on Lesson 23's card,
  is "A drone, and a second note just above it, almost in tune.", with the alternative `fifths`
  (Lesson 24 FACTS 5, 5b).
- **Facts:** sourced in Lesson 24's FACTS: beats (Wolfe, UNSW, both pages), harmonics and pure
  intervals, the piano's fifth and third against a drone and a wave's effect on the throb
  (arithmetic for steady harmonic tones), singers in pairs (Dai & Dixon 2019) and a quintet's thirds
  (D'Amario et al. 2020), sung vibrato hiding beats (Sundberg 1994, as RESEARCH reads it); the app at
  `c60f0fdcb`. Kodály's part singing is not verified and not used.

## 3. Shared-file entries for the lead

1. **SEASON-2 § 4.1, the S20a row** (`SEASON-2.md:754`). Step 2 plays do, mi and so together over the
   drone, so "not yet a chord" is no longer true. Proposed row:

   `| S20a | Hold a part against a drone; beats | S06, T13, T14 | 24 | **New**, the first half of S20; T19 replaced by T14: against a drone the third and fifth are heard as intervals, and do, mi and so together as T14's major triad by ear |`

2. **Lesson 23 FACTS 5** (`lessons/23-perfect-tritone/FACTS.md:54`). Replace, in its claim
   column, `what happens to the throbbing as the top note arrives ("It slows down, then stops" or "It
   speeds up")` with:

   `what happens to the throbbing as the top note arrives ("It slows, then stops" or "It speeds up")`

   and add to its source column, after the plan's predict, `; Lesson 24's predict as its page words it
   (`docs/plans/find-your-pitch/lessons/24-drone-harmony/LESSON.md:152-154`)`. (Lesson 24's LESSON.md
   lines 152 to 154 hold the predict and its two choices as the package is handed back.)

3. **SEASON-2 § 5.2, Drone Intonation's app work** (beside item 15, if the lead takes them): a drone
   with harmonics up to at least the sixth, whatever the app's instrument, so its fifths and thirds
   can beat; and the run score reweighted so a full score reads 100: today
   `round(accuracy × 0.4 + best round × 0.15 + stability × 0.25)` tops out at 80 since richness left
   the grade on 25 October (`use-drone-intonation-controller.ts:284-292`), and the level rises only
   at an average of 90 (`adaptive-difficulty.ts:12-13`), so the drill can never level up.

## 4. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 24,
  lane: 'voice',
  title: 'Harmony against a drone',
  short: 'Drone harmony',
  topics: ['S20a'], // "Hold a part against a drone; beats"
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 16, // once the page is built
  page: '/learn/24', // once the page is built
  hook: 'Hold a note against a drone: how can you hear when the two are in tune?',
  pr: {
    needs:
      'The fifth, third and octave slug and a pure-tuning option (SEASON-2 § 5.2 item 15); a drone with harmonics; the run score reweighted',
    link: {
      href: '/exercises/thirds-on-a-drone?lesson=24',
      addr: 'mercurypitch.com/exercises/thirds-on-a-drone',
      label: 'Drone Intonation',
      note: 'the two thirds',
    },
  },
}
```

- `EDGES` gains `[5, 24]`, `[10, 24]` and `[23, 24]`; `PREREQ[24]` is then `[5, 10, 23]`.
- `drafts.ts`: `24: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.
- `team-notes.ts` `SIGNATURES[24]`: "Lesson 5's band with a drone under it: a top note sinks into it
  and its throb stills, the beads stand over it tuned two ways, and a wave smears the fifth's slow
  beat."

## 5. `kit/lesson-copy.ts`

- Lesson 24 (set on Lesson 24): no hook alternatives; `tease` "A drone, and a second note just above
  it, almost in tune." (57); `teaseAlts` `[{ id: 'fifths', text: 'Fifths count as settled, tritones
  lean. Next, a note against a drone.' }]` (69); `TEASE_NOTES[24].fifths` as Lesson 23's hand-back
  proposed it.
- Lesson 25 (set on Lesson 25, its writer's): the lead's line, "A minor tune, played twice. The second
  ending changes one note." (63), default, with `plan`, "Do, mi and so made a major chord. Minor keys
  hide another change." (65), true of this page, soft lean on Lesson 25's predict noted in both
  packages' FACTS 5b.

## 6. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host, the draft line, seasons in the kit (items 1 to 3).
2. Lesson 22's four pieces (item 4), cited by path and line: item 4 (`vibrato`, null here; Lesson
   22's cold-open wave for Step 4), item 5 (no live band state, violet middle line), item 6 (the
   centre-line reader), item 7 (Lesson 5's hold flow in the kit).
3. A drone under a take (item 5).
4. The headphones check and the quiet check in the kit (item 6): fails on a voiced run of 0.3 s or
   more at any pitch; tested with an unrelated pitch.
5. Two lab tests (item 7): silence over a speaker drone (D3, D4, G3, G4; holds' level and full
   volume), a voice stopping 2 s into do, closed, open-back and Bluetooth headphones; the timbre (the
   fifth over A3, D3, D4; the third over A3, D3, D4; both over G3 and G4; Step 4's wave by ear).
6. The hold flow's options (item 8): 5-second holds, sets of three then two with the set's rules,
   Move do's reach (five higher, none lower) moving the drone, per-note summary with an unread hold
   named.
7. The drone chart's states (item 9): the brightness from the harmonics' envelope, the wave, the
   spoken line when the colour changes.
8. The lesson copy, the plumbing (SEASON-2 § 5.2 item 21), the head and share card, Lesson 23's
   questions as a module (items 10 to 13).
9. The app (item 14): Drone Intonation's slug and pure-tuning option (SEASON-2 § 5.2 item 15); a
   drone with harmonics; the run score reweighted (section 3, item 3).

## 7. Departures from ARTICLE-PLAN.md

As in LESSON.md's preamble and FACTS 4: the four words (Harmonic for Beats; Pure's play locked); the
hero is Lesson 23's still; Tavi's line; the slide's holds; the locks, and Steps 1 and 3's words held
for the predicts' reveals; Step 2's chord, its formula drawer cut for length; Step 3's heading; Step
4 a singer's wide wave against straight, no band, no Go deeper, no quintet rehearsals; Sing it's
quiet check, Merc's straight notes, the middle-line reader, feelings after each set, Move do higher
only, the sing-along in its own words with Sing along again once a visit; chips and a sound gate
without the headphones clause; the quick check's feedback; the practice card (headphones line, round
score only); the tease with the plan's line as `plan`; "over one" in the promise; chrome beads and a
dashed ink "pure" tick.

## 8. Citations in words

- **Lesson 25**: its predict, FACTS 5b, tease and still, in words (its writer is mid fix pass).
- Lesson 22 is now bound by path and line throughout.

## 9. For the lead

1. **Step 4's arithmetic** (section 0, B2): the cents-versus-hertz refinement; the page's words hold
   either way.
2. **S7's addition**: the feelings question after a partly sung set; say if you want the plain default.
3. **The coach**: Move do's reach, the volume line, the 4-second wait, Step 4's lines and "Sing along
   again" once a visit are all flagged in LESSON.md, For the vocal coach.
4. **Lesson 26**: its recall imports `l24-q1` unchanged; it reuses the headphones check (now with the
   volume half), the quiet check (any voiced run) and the drone from the kit.
