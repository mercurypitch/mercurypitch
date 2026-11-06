# Lesson 22's page (lead-only; agents off until 12 Nov 01:00Z)

Branch feat/lesson-22-page in W (l10-page) from main 57f3d4e83 (L23 merged 18:25; #1376 AirPlay
under it). Spec: lessons/22-vibrato/ (WEB-SPEC 956, LESSON 592, FACTS 212 lines; 2,229 words, cap
2,379; built page ~2,412 -> cut 1: Step 3's Go deeper "Which middle?" (39), then cut 2: Sing it's
opening line, only while the page's own count runs over). Voice lesson: a draft until the coach
signs off (drafts line 22: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)", Lesson 5's form).
Why L22 now: L21/L16/L20 wait on the owner's Lesson 4 staircase answer; L25 builds on L21's page;
L27 on L25; L18 on L16; L24 on L22; L26 on L18+L24.

## Already on main (checked 18:4x)

Seasons in the kit (item 3); lesson marker 01-28 and DB answer bounds page/qLesson 1-28 (item 9);
lesson-14/quiz-questions.ts (item 11, so import l14-q3); kit/hold-flow.ts (204), kit/hold-take.ts
(364), kit/band-chart.ts (374), kit/band-chart-hold.ts (114), lesson-05/sing-hold.ts (66),
lesson-05/hold-flow.ts (57, HOLD_SEC), lesson-05/words.ts (230), kit/sound.ts (645),
src/lib/mirror/metrics.ts (590; wave finding at :496-511). Predict onChoice/onReveal/revealAfter,
tour hold, next-card slot, comfort/voice-choice, PitchLine.

## Engineering (spec "What the kit and the app still need")

4. sound.ts VoiceOptions.vibrato {rate, extent, growIn} | null (absent = today's: Merc ooh 5.5 Hz
   ±14 c over 0.35 s; soft none); handle.setVibrato glides rate+depth over 50 ms; timed note, sung
   line, contour pass it through. Tests: null -> no modulator; 6/50/0.3 -> 6 Hz, 50 c at 0.3 s;
   absent -> Season 1 unchanged; setter within 50 ms, no restart.
5. band-chart.ts states: no centre (no amber line, ticks, note name); Merc's wave from a schedule
   (rate, extent, grow-in, drift) drawn as it sounds + whole as the hero still; the middle line
   (dashed "middle", 0.6 s; amber from schedule, violet from the reader in Sing it only when a
   vibrato was found); Step 2's sweep + swing counter + ruler; Step 3's rising middle (Drift); Step
   4's ribbon panel (src/lib/effect-renderer.ts:214-241, chrome, "the app's mark") beside Merc's
   sung wave ("sung"); no live band state for a take (lit edge, glow, band words off until the end).
6. Centre-line reader: metrics.ts wave finding lifted into one exported function (steadiness calls
   it on the whole trimmed hold; results + Voice Mirror tests unchanged); kit/hold-centre.ts (pure):
   3 s windows every 0.5 s; running mean one swing long where a window found a vibrato; hold read
   on the middle line by the hold reader's rules; returns the middle line, rate (from windows) and
   extent (line less middle). Vibrato line + summary subject option (holdSummary, hold-take.ts
   :330-343). Tests 8-10. The page does not publish without it (lead, 2 Nov).
7. Lesson 5's hold flow into the kit with options: hold lengths (10/15 there, 10/10 here),
   listening notes (10 s + 15 s there, one 10 s here), reader (today's or centre-line), live band
   state (on there, off here), restAfterEffort (off there, on here), Hold 2's button, summary
   subject. Lesson 5 keeps its behaviour; its tests move with the code.
8. lesson-copy tease + variant (69 and 62 chars, TEASE_MAX) + team note; signature line.
10. Head + share card learn/lesson-22-og.jpg + structured data PT15M.
1, 2: host (learn/22.html, sw-runtime STANDALONE_DOCUMENT_PATHS, budgets), drafts line.
12, 13: app's / release-time, not this page.

## Commits (draft order, refine after reading Toys/Tests/Contract)

C0 baseline (main 57f3d4e83 build: fp/mods/css/plan-cites into l22/c0).
C1 shell + registration (+ season-2 entry minutes 15/page, drafts, copy, sw-runtime, budgets,
   og card, tests' shifts, e2e boot).
C2 sound.ts vibrato option + setter.  C3 metrics wave-finding lift + kit/hold-centre.ts.
C4 Lesson 5's hold flow into the kit with options (L5 unchanged).
C5 band chart states (no centre, wave schedule, middle line, sweep/counter/ruler, drift, ribbon).
C6 steps 1-4 + Step 3's predict.  C7 hero + cold open predict.  C8 recall + quick check.
C9 four words.  C10 Sing it (two holds, centre-line reader, vibrato line, middle drawn).
C11 wrap + free play + tease still (Lesson 23's opening).  C12 e2e + phone checks.
C13 chore(seo) /learn/ fingerprint (production vite build + sitemap-lastmod --update) -- DO NOT
    FORGET (L23's CI failed on it).  C14 ceilings, spec as built, plan-cites, INDEX last.
Then at most 2 lead review rounds, PR (no footer), CI green, rebase merge, verify, dev, report.

## Toys, compact (WEB-SPEC lines 186-552; re-read the section before each commit)

1 Hero (186-251): band chart hero state, band ±35 c round Merc's note, no centre/ticks/name, window
  4.5 s; Merc's wave drawn whole as a still at first paint (amber, past both edges). Plays: Play
  Merc's note (`wave`, data-free) A3 3.0 s ooh, 6 Hz ±50 c, grow 0.3 s, redraws as it sounds (16 of
  18 swings past both edges); Play: top / Play: middle, locked till choice: 2.0 s wave, 0.3 s quiet,
  2.0 s straight (top 226.45 Hz = A3+50 c, level line 15 c above the band top; middle 220.00 Hz).
  Predict: choices top/middle, revealOn [top, middle], revealAfter 'all'; hints chosen "Locked in.
  Play both straight notes.", silent, again "Play any of them again.", no next; lock hint "Choose an
  answer to unlock the two straight notes."; guess "You said: the top"/"the middle". onChoice ->
  steps' toy + free play enable, open Step 3's predict; onReveal -> Tavi's quiet celebration + the
  dashed amber "middle" line drawing L->R 0.6 s. No `unlocks` (sliders). Figure name "A band 35
  cents either side of a held note, with no note named"; polite live lines. holdTour until choice.
  Before the choice: every steps'/free-play control disabled under "Choose an answer at the top to
  unlock this figure." and the chart draws only its band; Step 3's choices + six-a-second disabled
  too; the four words stay open; Sing it plays no straight note (Merc's usual ooh only).
2 Steps' chart (253-312), Lesson 5's band chart + level strip on A3, no centre/name, lines from the
  play's schedule (same sine as the voice), controls >= 44 px, image + spoken summary:
  S1 window 4.5 s: Play straight 3.0 s; Play with a wave 6 Hz ±40 grow 0.3 3.0 s; Play a swell 4.0 s
  level 0.5 -> 1.0 at 2.5 s -> 0.5 at 4.0 s (level strip grows, line level). Live lines given.
  S2 window 1 s sweep (redraw from left each second), counter "6 swings a second" pulsing at each
  peak, ruler from dashed middle tick to a swing top "±30 cents"; Rate 5-8 step 0.5, Extent ±10-±60
  step 10, start 6/±30; Play 4.0 s (sliders change sound within 50 ms via setVibrato); Play Merc's
  "ooh" 2.0 s default voice 5.5/±14/0.35 (counter 5.5, ruler ±14, inside band).
  S3 window 3.5 s, ±50 wave with dashed amber middle; Play: six a second (free) 3.0 s; Play: two a
  second ±50 2 Hz grow 0.3 3.0 s; Rate 2-7 whole with Play at this rate 3.0 s; Drift switch: next
  play's middle rises 50 c over 3.0 s, leaves the band at 2.1 s; Rate+Drift wait for Step 3's
  choice; Drift switched during a play stops it. Live lines given.
  S4 two panels (stacked on a phone): Sung window 2.0 s, Play the sung wave 5.5 Hz ±30 grow 0.3 2.0 s
  (11 swings, inside band, "sung"); the app's mark = vibratoShapePath (effect-renderer.ts:214-241)
  in chrome at the note's width; Stretch 120-330 px, swings 5-15 (one per 22 px); live lines given.
  Free play: all four states, every control; holds as the steps: cold-open lock line, and until
  Step 3's choice "Answer Step 3's question first to hear this." on two-a-second, Rate, Drift; a
  return visit holds again. Phone: chart fills the card 344-390 wide, 160 px tall.
3 Step 3's predict (314-343): choices one/moves ("Still one note", "A note that moves up and
  down"); plays six (data-free) + two; revealOn [two], revealAfter 'any'; hints chosen "Locked in.
  Play the slow wave.", again "Play either wave again."; guess "You said: still one note"/"a note
  that moves". Markup: choices + both plays disabled, hint "Choose an answer at the top first.";
  cold open's onChoice sets hint "Choose an answer to unlock the slow wave.", enables choices + six,
  THEN mounts this predict (the kit keeps the hint it finds). reveal = 4 elements (reveal, Tavi's
  line, mix-up card, Try + Notice), Go deeper stays shown. Its onChoice: steps' Rate + Drift, free
  play's slow wave + Rate + Drift, quick check q3's play.
4 Four words (345-361), Lesson 5's word tickets: small band charts, no centre: Vibrato A3 6 Hz ±30
  2.5 s; Rate ±30 at 5 then 7 Hz, 2.0 s each, 0.4 s apart; Extent 6 Hz ±20 then ±60 same timing;
  Straight note D3 straight 2.0 s. Waves grow 0.3 s. Reduced motion: land whole.
5 Recall l05-q3 + l14-q3 (prefix recall-, keys fyp-l22-recall-seed / fyp-l22-recall-v1, no lesson,
  links "Try Lesson 5, Step 4 again" / "Try Lesson 14, Step 3 again" via linkAway). Quick check
  l22-q1..q4, keys fyp-l22-seed / fyp-l22-quiz-v1, lesson 22. Q3's play ±50 2 Hz A3 grow 0.3 3.0 s,
  draws nothing, disabled till Step 3's choice under "Answer Step 3's question first to hear this."
6 Sing it (386-543): Lesson 5's flow in the kit with options; comfort (mountComfort), voice choice
  (fyp-voice, homeOf), Just listen (Play Merc's 10-second note), warm-up with Skip remembered as
  fyp-l22-warmup, the note A with Lower/Higher +-4 semitones (1.0 s taps), briefing box + Start
  (listener consumer id lesson-22; sound off: hint "Sound is off, so nothing played. Turn sound on
  to hear Merc's note, then press Start."), Hold 1 straight (Listen 2.0 s, Breathe 2 s ring, Sing 10
  s frame, take opens 0.4 s after the note, waits 6 s, runs 10 s), NO live band state, after the
  take: centre-line reading, dashed violet middle over 0.6 s only when a vibrato was found, one line
  + octave line + vibrato line ("The note had a wave: about 5.6 swings a second, ±38 cents."), mint
  edge beside an in-band line; feelings with restAfterEffort; Hold 2 floating ("Rest for a few easy
  breaths. Ready when you are."); summary "This time the middle of your line was in the band for X
  of 10 seconds, then Y of 10."; 3 takes a hold; Done for today; no microphone path. Centre-line
  reader algorithm at 486-540 (windows 3.0 s every 0.5 s on the trimmed hold [0.4 s start, 0.2 s
  end]; Voice Mirror's rule per window; one-swing running mean at the nearest finding window's
  rate, time-weighted, not across stalls > 0.12 s or past the ends; hold reader rules on it; rate =
  median of finding windows' rates to 0.1; extent = sqrt2 * RMS(raw - middle) over frames whose
  one-swing RMS reaches 10/sqrt2, whole cents).
7 Tease still: SVG aria-hidden of Lesson 23's opening (upright pitch line, C4 foot, C5 top, "an
  octave: 12 semitones", nothing between), own class, no button, no motion, no sound.

## Audio, Mercs, links, data, tests (WEB-SPEC 553-956, compact)

Audio: one sound at a time (NowPlaying); leaving a step stops it; Sing it off screen 600 ms or page
hidden stops + abandons a take; a cut play never counts as heard; nothing plays during a take (all
play controls disabled Start -> take end); waves = pure sine, depth grown in linearly from 0 over
0.3 s (0.35 for default ooh), phase 0 at start, drawing from the same schedule (extent x grown
share x sin(phase)), nothing analysed from audio; straight note = no modulator; sliders glide 50 ms,
drawing integrates rate (continuous); Drift = pitch contour note -> +50 c over 3.0 s; swell = level
contour; model notes = playTone with default vibrato; lowest sound D3 146.83 Hz.
Mercs: in the hero either side of the band; bubbles from the start; cold open note: Merc sings, Tavi
listens; Tavi celebrates quietly once at the reveal (no sparkles). Sing it: the singing Merc as a
still beside the chart (Merc lower, Tavi higher), sings the model note; both listen in a take;
celebrates after Easy/Workable for a take >= 80 % in band, once a hold.
Practice card: /mirror?lesson=22 (mercurypitch.com/mirror), Lesson 5's form; rest version Lesson 12's
form with Lesson 5's words, "Rest today", no "Ten minutes", no link; no first-visit line.
Season data: n 22 lane voice title/short 'Vibrato' topics ['S19'], minutes 15, page '/learn/22'
under "// A draft until its sign-off (drafts.ts), as Lesson 3 is."; pr.link href /mirror?lesson=22,
addr mercurypitch.com/mirror, label "Voice Mirror", note "its Hold: a vibrato reported, never
scored"; pr.needs "The Vibrato exercise's copy and default (SEASON-2 § 5.2 item 14), before any link
to it"; EDGES [14, 22] (check season-2.ts on main); tease on Lesson 22: "Merc holds one note, and
its line swings past both edges of the band." + teaseAlts [{id 'nudged', text 'Each fifth is nudged
two cents. A held note can move far more.'}] + team note; this page's card = Lesson 23's tease
(already in lesson-copy). Signature line: "Lesson 5's band, zoomed until a held note's wave shows: a
counter and a ruler measure it, a middle line draws itself, and the app's ribbon stands beside it,
labelled a mark." Title decision: "What is vibrato in singing? | MercuryPitch" (recommended).
Unit tests 1-12 (spec 824-902): sounds/freqs (top 226.45 Hz), voice vibrato option, range (F3-C#4 /
F4-C#5 >= 2 semitones inside every VOCAL_RANGES preset), both predicts, nothing answers early, recall
+ quick check (l05-q3 imported, l14-q3 imported; links /learn/05#step-4, /learn/14#step-3; no
feedback starting Right/Yes/Correct), centre-line reader cases (16 ms frames through Voice Mirror's
preprocess, 12 phases: ±50@6 Hz 10 s -> 10.0 [today 6.1-6.4], desc 6 Hz ±40-50; rate 6.0->7.2 last
1.7 s -> >= 9.8; wave from 8 s / 6 s -> >= 9.8; rate drift 5.5->6.5 ±50 -> >= 9.8 desc ±40-50; ±60
5.0->7.0 -> >= 9.8 desc ±45-55; ±60@5.5 -> 10.0 [today 3.9-4.0] desc 5.5 ±45-55; ±40 with middle
0->60 c over 10 s -> 5.6-5.9 (leaves at 5.8 s); ±50@2 Hz not found, as today 4.8-4.9, no line;
straight ±5 noise = today line for line; ±8@6 not found; octave lower same + octave line; stop at
4 s -> >= 3.8 of 4.0 + stopped-early line [today 2.4-2.5]; 0.3 s stall changes <= 0.1 s; trimmed
<= 3.0 s = one window), shared wave finding (Voice Mirror tests unchanged), vibrato line + summary
("about 5.6 swings a second, ±38 cents"; "about 6 swings a second"; summary "This time the middle of
your line was in the band for 9.8 of 10 seconds, then 9.6 of 10."), flow rule with options (L5
unchanged), no live band state + middle + models. Page tests 13-21: head test, no planning text,
stage fit, first-paint budgets, claims validator 0 flagged, tour hold, one sound at a time, no
background staff, locks in a browser.
Contract: storage keys fyp-l22-recall-seed, fyp-l22-recall-v1, fyp-l22-seed, fyp-l22-quiz-v1,
fyp-l22-warmup (+ kit keys); nothing from toys/holds; sliders/Drift/Stretch and both predicts' choices
in memory only (a return visit starts fresh).

## C1 model

L23's shell commit on main = 0063b6384 (24 files: learn/23.html 1775, public/learn/lesson-23-og.jpg,
scripts/assert-first-paint-budgets.mjs, e2e frame-loop/lesson-23 boot/lesson-menu/lesson-tour/
next-card/sound-gate, admin lesson-admin.test, kit drafts/explorer-seasons.test/lesson-copy/
publish.test/season-2.test/season-2.ts/team-notes, lesson-23 css/main/page-dom fixtures/page.test,
sw-runtime, tools/learn-hub.test, LESSON-TOUR.md). Its message is the model for C1's. L22's markup:
learn/23.html's skeleton (head, masthead, hero/stage/predict, recall, words, steps, quick check,
wrap, explorer, footer) + learn/05.html's Sing it (comfort, voice, warm-up, note Lower/Higher,
briefing box, Start, ring Listen/Breathe/Sing, holds, feelings, no-mic) + LESSON.md's copy (read
LESSON.md 75-447 for every line; section headings table at 427-447). Season 1 lesson pages use
Lesson 5's band chart markup (learn/05.html) for the chart figures.

## C1 progress (parts in l22/c1/parts, concatenated into learn/22.html at the end)

- a-head.html: head (title, descriptions, og/twitter, Article + Breadcrumb data PT15M, comments),
  symbols (L23's + L5's i-stop, i-mic, i-halt), skip, masthead "Season 2 · Lesson 22". DONE.
- b-hero.html: hero (kicker, hook, 4 chips incl. /learn/14 link and Microphone optional, promise,
  gate), stage (bubbles, Merc, #heroChart band-chart canvas + data-hero-said, Tavi), plays wave
  (data-free) / top / middle (disabled), predict (top/middle, lock hint, hidden reveal). DONE.
- c-recall-words.html: recall (L23 markup, "of 2") and four word tickets with canvas stubs. DONE.
- NEXT: (was) c-recall-words.html (recall l05-q3 + l14-q3 as L23 recall markup; words as Lesson 5
  word tickets with small band charts), d-steps.html (4 steps + Step 3's predict, mix-up, Go
  deeper; lock line), e-sing.html (from learn/05.html 1318-1726), f-rest.html (quick check, wrap,
  explorer, footer from learn/23.html 1445-1775).
- c-recall-words.html DONE (recall "of 2", four tickets with canvas stubs, ± with sr words).
- d-steps-stage.html DONE (steps header, stage card, #toyChart with panels sung/mark, meters, controls per step data-vib-for 1-4, data-held="step-3" on Step 3 Rate/at-rate/Drift, lock hint data-vib-lock). Stretch default 220 px = 10 swings (one per 22 px). NEXT d-steps-text.html.
- d-steps-text.html DONE (4 steps, Step 3 predict card #predict3 with data-play six/two inside it, data-reveal3 on Tavi/mixup/try/notice, deeper shown).
- e-sing.html DONE (from learn/05.html 1317-1726: copy line, brief box L22 wording, hold cues as brief-how.hold-cue, three example lines, head "Hold 1, straight", data-vibrato-line, one listening note, data-sing="hold2" "Hold 2: floating"). NEXT f-rest.html (quick check, wrap, explorer, footer from learn/23.html 1445-1775).
- f-check.html (quick check "of 4"), g-wrap.html (recap, challenge, practice card L12 form Voice Mirror + rest, next card with L23 tease still svg, plan-back, free play with state seg data-free-state 1-4, data-free-toy host, lock lines data-vib-lock + data-vib-lock3), h-explorer.html (explorer + footer + toast) DONE. NEXT: quick-check q3 play markup? (the kit quiz renders questions; q3 play button is rendered by the page script, check how L23 Q4 play did it). Then concatenate into learn/22.html.
- learn/22.html ASSEMBLED (2,108 lines before prettier; tags balanced; free play = the toy markup copied with free* ids).
- lesson-22/main.ts (shell boot, as L23 shell) WRITTEN.
- lesson-22.css (shell) WRITTEN.
- share card public/learn/lesson-22-og.jpg (35 KB, l22/og/card.html + shoot.mjs) DONE; drafts 22, season-2 entry minutes 15 page, sw-runtime paths, lesson-copy tease 22 + nudged, team-notes TEASE_NOTES 22 DONE.
- lesson-22/page-dom.test-fixtures.ts + page.test.ts (19 tests) WRITTEN; deckNav added to learn/22.html; season-2/admin/hub/explorer/publish tests take L22 in (all pass).
- e2e: learn-lesson-22.spec.ts (boot spec from L23 shell), next-card/menu/tour/sound-gate/frame-loop take L22 in; LESSON-TOUR.md nineteen pages. NEXT: build:e2e -> measure first paint -> budgets entries (JS/CSS ceilings smallest whole KB above; check Lesson 2 and others still under) -> pnpm check -> commit C1.
