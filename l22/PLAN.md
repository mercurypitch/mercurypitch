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
