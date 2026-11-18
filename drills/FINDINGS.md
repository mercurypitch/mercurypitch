# Season 2 drills: audit and native-vs-web study (14 Nov 2026, main c1c9d5626)

Two read-only agents read the code; nothing was run by them. Paths are from the repo root.
EX = src/features/exercises, K = src/components/room-kit, N = apps/mercurypitch.

## A. SEASON-2.md section 5.2, item by item (state on the WEB)

| # | Drill | Lessons | State | What remains |
|---|---|---|---|---|
| 9 | Note-reading drill | 15, 21 | MISSING | whole drill (not in src/lib/domain/exercise-contracts.ts:99-125 nor ear-lab/drill-views.ts:14-37) |
| 10 | Sight-Singing for the lessons | 16, 18, 21, 25 | PARTLY (launch notes replace the random round, EX/sight-singing/SightSingingExercise.tsx:201-206) | phrase slugs without the octave fit; hear do; bass clef; key signature; names off / solfege; octave fold; `key` launch field |
| 11 | Sight-singing in time | 18, 28 | MISSING (notes pass on a 450 ms hold, no beat) | count-in, click, notes on the beat, timing shown |
| 12 | `ear-drill` launch kind, then subsets | 17, 19, 23, 25, 27 | MISSING (launches are exercise or tab, EX/slug-map.ts:51) | launch kind, bank-subset option, five subsets as data |
| 13 | Scale Runner: harmonic, melodic minor, minor pentatonic, scale-type launch field | 20, 25 | MISSING (definitions exist in src/lib/scale-data.ts:90-124) | three types, launch field, slugs |
| 14 | Vibrato exercise copy, default, durationSec | 22 | MISSING | copy, default, duration field |
| 15 | Drone Intonation for Lesson 24 | 24 | PARTLY (score reweighting, launch intervals) | slug for 7, 4, 12; pure-tuning option; a drone with harmonics |
| 16 | Interval Trainer `perfect-intervals` (5, 7, 12) | 23 | MISSING | one registry line |
| 17 | Harmony-line drill | 26, 28 | MISSING (Harmony Stack needs two singers) | whole drill |
| 18 | Chord Stacker chord types, inversions | 27 | PARTLY (two side fixes only) | chord-type launch field, triads, inversions |
| 19 | Cadence-type ear drill | 28 | MISSING (Cadence names eight progressions by numeral) | four-cadence bank and a mode |
| 20 | Twelve keys; sheet-view address | 18, 21 | PARTLY (phone lists every key) | sidebar keys (no E flat, F sharp); an address for the sheet view |
| 21 | Season 2 lesson plumbing | all | SHIPPED (plan stale) | - |
| 22 | Hold read on its middle | 22, 24 | SHIPPED (plan stale) | - |
| 23, 24 | Harmony Stack note names; late joiner | 26 | SHIPPED | - |

Section 5.3 gaps, none planned: G1 rhythm scored while singing (17, 18); G2 a run sung continuously, read note by note (20);
G3 song form (28); G4 vibrato practice scoring neither vibrato nor straightness (22); G5 sung tritones and sevenths (23, 27; data if wanted);
G6 compound-metre reading (19).

Native only, closed to the web and to lesson pages: PREMIUM_EXERCISES is false on the web (src/lib/native-build.ts:53-56, vite.config.ts:940);
rooms open only through the native shell. Harmony room (a third above Merc's line: item 17 in part), Leap (sung fourths and fifths),
Home note, First note, Echo, Long note; their engine src/lib/sequence (octave fold, timed mode); Ear Lab's pair practice.
Page only (the lessons kit): read-in-time.ts, take-in-time.ts, hold-centre.ts: items 11 and 17 can build on them.

Practice cards today (learn/NN.html #practiseCard): 15 Compose sheet; 16 Sight-Singing (states its limits); 17 The Chart, Pulse; 18 Sight-Singing
("reads pitch, not rhythm"), The Chart; 19 Subdivide, Pulse; 20 Scale Runner (choose Pentatonic), Staccato Precision; 21 Compose, Home;
22 Voice Mirror (Vibrato exercise not linked); 23 Ear Lab's Leap (no sung drill); 24 Drone Intonation thirds-on-a-drone, Beat Hunt
(a pure third "scores about 79"); 25 Gravity, Sight-Singing ("a drill on those two alone isn't in the app yet", learn/25.html:1465);
26 Harmony Stack with a friend, thirds-on-a-drone alone; 27 Chord Stacker, Stack ("no triads or inversions yet", :1542; "isn't in the app yet", :1588);
28 Karaoke Night, Cadence.

By what a learner loses: 1 Harmony-line drill (large) 2 Sight-singing in time (large) 3 Sight-Singing lesson mode (medium + data)
4 Note-reading drill (large) 5 ear-drill launch (medium + data) 6 Chord Stacker types (medium) 7 Cadence-type drill (medium)
8 Drone: slug small, pure option medium, harmonics small 9 Scale Runner types (medium) 10 perfect-intervals (small)
11 keys and sheet address (small) 12 Vibrato copy (small).

## B. Native rooms with Merc, and the web's drills

Reach: one src/ tree, two Vite builds. `__NATIVE_BUILD__` false on the web (vite.config.ts:937-940), true in N/vite.config.ts:406,423;
src/lib/native-build.ts derives IS_NATIVE_BUILD, PREMIUM_EXERCISES, EAR_LAB_WITH_MERC, NATIVE_ONBOARDING, folded at compile time: no flag lets a room
into the web bundle. Shell: N/src/main.tsx:471 renders App + NativeShell; N/src/shell/ShellScreens.tsx draws the top pushed screen full-bleed.
IN A DESKTOP BROWSER: `pnpm mercurypitch:dev` (Vite, http://localhost:5173; the first start fetches about 25 MiB of example stems);
390x844 touch; localStorage mp:native-onboarding=done and mp:portableConsole=0, reload; rail Sing ([data-rail-item="stage"]) -> sing-exercise-browse
-> a sing-exercise-card (long-note-room ...), or rail Ear Lab -> ear-rooms-card. Pinned frames (dev server only, N/src/main.tsx:394-469):
/?longNoteFixture=intro|rest|mid-take|demo-off|result ; ?echoFixture= ?lipFixture= ?ngFixture= with intro|mid-take|demo-off|result ;
?warmFixture=start|between|resume|end|done|locked. Probes: N/scripts/probe-bundle.mjs (--exercises-only etc.).

The room system (K/RoomShell.tsx:1-47): root (data-phase, live region, demo layer); head (chip, timer, result card, badge chip); bar end
(level pill Learning / Singer / Professional, "?"); Merc's bubble; dock (mic, then Again / Done). Each room adds a reducer, controller, scene, lines, CSS.
States: Long note intro, starting, listen, hold, result (+ blocked); Echo call, response, between; glide rooms settle, run; Ear rooms band|call, sing,
landed|missed, result. Merc: one WebGL canvas (K/MercView.tsx, src/lib/merc), 13 states, stands in the scene, hops and cheers (K/merc-moves.ts),
sings calls and the answer after a miss in a sampled "ooh" (echo/merc-sampler.ts), speaks opening and result lines (K/merc-speech.ts),
bubble lines never repeat (K/room-lines.ts). First visit plays "How it works": he sings it wrong, then right, with tooltips (src/components/demo-kit).
Visuals: full-bleed dark stage, painted plates (K/RoomPainting.tsx), one voice ribbon cyan on / amber off (K/ribbon.ts), sheets (src/components/mobile/Sheet.tsx),
lit SVG instruments (ear-lab/merc/lit), CelebrationStar; reduced-motion stills. Feedback: the scene fills (lantern, stars, arches, lamps); one paced chip line
(K/chip-pacer.ts); a four-state mic whose ring follows loudness (K/mic-state.ts). Result: one big number, one detail, replayable rows (Ear rooms), Merc's line.
Progress: level pill, bests per level synced. Sound: one bus (K/room-output.ts), tones, organ band, song stems; haptics tapLight per landing, success at the result.

Native rooms: Long note (lantern fills), Echo (sing Merc's phrase back, stars light), Lip roll (three waves), Ng slides (five slides over a glass bridge),
Warm-up (a path of five stops, then a song), Home note (sing the key's home after the band), First note (come in on a song's first note),
Leap (Merc's note, then the named interval), Harmony (a third above his line), Sing room + ExercisePicker, Ear Lab with Merc (19 lit instruments:
ear-lab/merc/MercBench.tsx, MercDrillRoom.tsx), native onboarding. Plans: docs/plans/ear-rooms.md, docs/plans/ear-lab-native-look.md.

Web drills: 18 at EX/<dir>/<Name>Exercise.tsx via EX/ExerciseMenu.tsx, src/pages/ExercisesPage.tsx (#/exercises): warmup, long-note, pitch-hold,
vibrato, slide, siren, pitch-pursuit, mirror-melody, call-response, interval-trainer, scale-runner, arpeggio-jumper, chord-stacker,
drone-intonation, dynamic-swell, staccato-precision, sight-singing, routine-runner. EX/ExerciseShell.tsx:753-1218: header (Back, "?", title, "Lv n",
mic toggle, live percent); idle (recent scores, hint, settings form, timer, Start); active (phase line, generic pitch tracker beside the drill's content,
metric bars, Stop & Score); complete (the idle screen plus a card: grade S to D, percent, New best, summary, contour, Keep / Discard voice take).
Web Ear Lab: bench (EarLabDashboard), EarStage (drill bar, instrument, status line, answer pads, Last call plate, result plate);
ThresholdDrillView (staircases), IdentificationDrillView (rated).

Where the web is weaker (evidence in the agent's report): 1 no Merc 2 a bordered card, not a scene (exercises.css:630-642) 3 setup is a form
(ExerciseShell.tsx:1047-1139) where a room opens on one mic button 4 help is a text panel where rooms demonstrate 5 live feedback is a tracker plus numbers
6 turn-taking is a header mic toggle 7 per-note words and blips in 2 of 18 drills, bare sine blips 8 nobody sings the answer after a miss
9 the result is a letter and percent with a 0.5 s pop; the celebration was removed 10 Keep / Discard crowds the payoff 11 level is an opaque "Lv 1-10"
12 2 keyframes in 2,917 lines of exercises.css 13 synth-only sound 14 haptics only at the score 15 the web Ear Lab keeps its bench by decision
(docs/plans/ear-lab-native-look.md:25-27).

Reusable on the web: already there K/MercPresence.tsx, K/voice-level.ts; as is K/RoomShell, RoomControls, LevelControl, MercView, merc-moves, room-lines,
chip-pacer, ribbon; src/components/demo-kit; engines src/lib/hold, src/lib/sequence, src/lib/glide. Blockers: compile-time folds; OWNER DECISIONS that Ear
rooms stay native (docs/plans/ear-rooms.md:27-28, 63-64) and that rooms ride the paid subscription; Merc's sung and spoken voices are ElevenLabs placeholders
awaiting recordings (echo/merc-voice-set.ts:5-10); Lip roll and Ng slides art are stand-ins; premium art and voice fold out of store builds only in the
native config (the web config has no fold); First note's stems and theatre art ship only from N/native-only.

## C. The web's exercises today, seen (phone, 390 px)

$S/drills/web-mobile/NN-<slug>-{idle,active}.png, sheets sheet-1.png and sheet-2.png. A dark dashboard: a small pitch graph with a cents meter on top,
a note wheel to pick the start, a vertical pitch lane, a blue Start bar, a red Stop circle, text at about 11 to 13 px, the app's five-tab bar under it.
No character, no scene, no demonstration; the same shell for every drill. Tokens (src/styles/app.css:39-64): bg #0d1117 / #161b22 / #21262d, card #1c2128,
border #30363d, text #e6edf3 / #a8b3bf / #868f9a, accent #58a6ff, green #3fb950, red #f85149, yellow #d29922, orange #db6d28, purple #bc8cff, teal #2dd4bf.
