# Find Your Pitch release review

Lessons, mascot, accessibility, copy and design, plus the wider web release. Reviewed 22 October 2026 on main @ fd2166c (353 commits since v0.9.21).

Every item below has a checkbox, an ID, where it is, a suggested fix, the standard behind it and how it was
found: **BROWSER** (reproduced in Chromium during this review), **CODE** (read in the source), **DESIGN** (seen in
the screenshots) or **DEVICE** (needs a real phone or screen reader to confirm). Items the first fix PR closed
are ticked, and every item that PR touched carries a **Status** line saying what changed, what is left, or where
the review itself was wrong. File and line references are to main @ fd2166c, before the fixes.

**137 items: P0 0 · P1 26 · P2 85 · P3 26.** Behind them sit the reviewers' 365 raw rows, kept with the review rather than in the repo, and the automated results (Appendix A).

## Status after the first fix PR

- **Fixed:** 31 items, S-01, S-02, S-03, S-04, S-05, S-06, S-07, L1-01, L1-02, G-01, G-03, L3-01, L3-02, L3-11, L5-01, L6-01, L7-07, L8-01, L8-02, L8-03, L8-04, S-10, S-19, S-23, L1-03, L2-02, L2-03, L6-07, L8-05, L8-07, W-02.
- **Partly fixed:** S-08, S-17, W-01.
- **Corrected (the review was wrong in part):** S-09, G-02.
- **Decided by the owner:** D-01, D-02; in other PRs, S-24, S-25; in part, L2-07, G-20, G-06, D-04.
- **Also fixed:** axe's one serious result, `target-size` on the stacked footer practise links of Lessons 6 and 8 (Appendix A): footer links are 44 px tall now. axe reports only the moderate landmark notes on each page (S-29).
- **P1 still open:** S-08, S-09, G-04, V-01 (G-02 keeps one owner question; S-08, S-09 and V-01 wait on devices; G-04 is a layout decision).

## Contents

1. [Verdict](#verdict)
2. [Suggested fix order](#suggested-fix-order)
3. [What this release contains](#what-this-release-contains)
4. [Scorecard](#scorecard)
5. [What is working well](#what-is-working-well)
6. [The checklist](#the-checklist)
7. [Device test plan](#device-test-plan)
8. [Method](#method)
9. [Appendix A: automated results](#appendix-a-automated-results)
10. [Appendix B: design tables](#appendix-b-design-tables)

## Verdict

- No release blocker (P0) was found. All five code reviewers recomputed every frequency, ratio, cent, interval, BPM and note name on the eight pages, and all of them match the lessons' FACTS.md. The singing safety and claims rules hold on every voice lesson.
- The pages are built with unusual care for accessibility: a skip link and landmarks, a named control for every button and slider, sliders that speak in musical terms ("A3 plus 1 cent, 220.13 hertz"), 44 px targets nearly everywhere, visible focus on every stop but one, a working Pause animations switch, reduced motion respected, nothing that autoplays or flashes, quiz feedback that moves focus and never says "wrong". axe found nothing above "moderate" on six of the eight pages.
- Most accessibility P1s are about screen-reader and keyboard users getting the same answers and results that sighted mouse users get: predict reveals and toy results that are never announced, focus that drops to the page, spoken names that do not match their visible labels, a spiral that needs a drag, and a Lesson 8 tap pad that ignores assistive technology.
- Design holds together as one listening room across all eight pages, and the Mercs ask and answer in their roles. The weak spots are state and affordance: the answered quiz hides your own pick, sound is spread over three controls, a bare "Pause" reads as an audio control, and on phones each Try line sits a screen away from its toy. Lesson 3's stage prints the answer to its own predict, and Lesson 7's siren line is drawn at about 1.6:1.
- Fifteen of the 26 P1s touch the live Lessons 1 and 2 (nine shared-kit items, two in Lesson 1, four design items). The other eleven sit in the drafts and should be fixed before each one is published from the Content Studio.
- One journey problem: a lesson's only way back to the app was "MercuryPitch home" at the foot of the lesson menu, two taps deep, which matters in the installed app, where there is no back button (S-09, corrected: the review first said there was none; the footer now links home too).
- The wider web release is clean against v0.9.21: the app-check sweep is identical apart from the new 36 px Lessons link, the new 404 page fixed two older landmark issues, and the new karaoke-app page inherits two serious axe findings from the Karaoke Night shell.

## Suggested fix order

1. **Now, live Lessons 1 and 2.** S-01 to S-07, L1-01, L1-02, then the design P1s G-01 to G-04. Most are kit fixes, so every lesson gets them at once.
2. **Now, the journey.** S-09 (the footer link home, done) and the device check S-08 (VoiceOver and TalkBack on the spiral and keyboard).
3. **This week, decisions.** D-01 to D-04 and the TASTE items. The dialect decision gates one copy sweep across all pages and captions.
4. **Before publishing each draft.** Its lesson's P1s: Lesson 3 (L3-01, L3-02, L3-11), Lesson 5 (L5-01), Lesson 6 (L6-01), Lesson 7 (L7-07), Lesson 8 (L8-01 to L8-04), and the microphone device check V-01 for the voice lessons.
5. **Next pass.** The P2s by component: live regions and focus (S-10 to S-14), forced colors (S-16), screen-reader noise (S-17), copy consistency (S-20, S-24), one page template for the design drift (G-05 to G-21), then each lesson's P2s.
6. **Polish.** The P3s, ideally folded into the passes above.

## What this release contains

- **Find Your Pitch lessons (new):** eight lesson pages at /learn/01 to /learn/08, each a hand-written document booted by its own module, over a shared kit of 90 modules (79 scripts and 11 stylesheets); hosts blue and orange Merc. Lessons 1 and 2 go live; Lessons 3 to 8 are drafts that the site worker answers with a 404 on mercurypitch.com until the owner publishes them from the Content Studio, with no release needed.
- **Around the lessons:** the lesson gate in the site worker, the admin Lessons page (publish, unpublish, choose hooks), sitemap and llms.txt entries, lesson links in every entry page's nav and on the 404 page, and Home's new "Lessons" link.
- **Rest of the web release:** a new 404 error scene; a karaoke-app front door and FAQs for Jam Rooms and key changes; Voice Mirror reads Bass-baritone and cushions the range top; Piano Night gets an h1; the Guided Warmup ends without a grade; hold cards stop asking for the longest hold; tour numbering and events; IndexNow.
- **Not covered (native app only):** the native onboarding beats, warm-up rooms, haptics and AirPlay lyrics, and the Glassworks museum (unlisted on mercurypitch.com).

## Scorecard

| Area                                            | P0  | P1  | P2  | P3  | Total |
| ----------------------------------------------- | --- | --- | --- | --- | ----- |
| Every lesson page (shared kit)                  | 0   | 9   | 19  | 6   | 34    |
| Lesson 1, What is a note? (live)                | 0   | 2   | 3   | 3   | 8     |
| Lesson 2, Twelve notes (live)                   | 0   | 0   | 7   | 1   | 8     |
| Design and mascot                               | 0   | 4   | 15  | 2   | 21    |
| Webapp entry and wider web release              | 0   | 0   | 3   | 4   | 7     |
| Voice lessons 3, 5, 7 and 8 (microphone)        | 0   | 1   | 4   | 1   | 6     |
| Lesson 3, Match a note (draft)                  | 0   | 3   | 7   | 1   | 11    |
| Lesson 4, The major scale and home (draft)      | 0   | 0   | 4   | 1   | 5     |
| Lesson 5, Breath and a steady note (draft)      | 0   | 1   | 5   | 1   | 7     |
| Lesson 6, Intervals (draft)                     | 0   | 1   | 6   | 1   | 8     |
| Lesson 7, Slides, sirens and your range (draft) | 0   | 1   | 6   | 1   | 8     |
| Lesson 8, Beat, tempo and the backbeat (draft)  | 0   | 4   | 5   | 1   | 10    |
| Owner decisions                                 | 0   | 0   | 1   | 3   | 4     |
| **All**                                         | 0   | 26  | 85  | 26  | 137   |

How the items were found: BROWSER 37, CODE 73, DESIGN 25, DEVICE 2.

Automated checks per lesson (details in Appendix A):

| Lesson | axe, desktop | axe, phone | Tab stops | Stops with no visible focus | Targets under 44 px (phone) | Content lost at 320 px                     | Reduced motion at load | Still after Pause |
| ------ | ------------ | ---------- | --------- | --------------------------- | --------------------------- | ------------------------------------------ | ---------------------- | ----------------- |
| 01     | 1 moderate   | none       | 45        | 1 (the map node)            | 1                           | 0                                          | pass                   | yes               |
| 02     | 2 moderate   | none       | 75        | 1 (the map node)            | 2                           | 0                                          | pass                   | yes               |
| 03     | 1 moderate   | none       | 63        | 1 (the map node)            | 2                           | 0                                          | pass                   | yes               |
| 04     | 1 moderate   | none       | 94        | 1 (the map node)            | 2                           | 0                                          | pass                   | yes               |
| 05     | 1 moderate   | none       | 63        | 1 (the map node)            | 3                           | 0                                          | pass                   | yes               |
| 06     | 1 serious    | 1 serious  | 125       | 1 (the map node)            | 2                           | 1 (L6-07)                                  | pass                   | yes               |
| 07     | 1 moderate   | none       | 72        | 1 (the map node)            | 2                           | 1 (1 px, L7-06)                            | pass                   | yes               |
| 08     | 1 serious    | 1 serious  | 83        | 1 (the map node)            | 1                           | 0 off-screen; strip syllables clip (L8-07) | pass                   | yes               |

Main app (app-check sweep, 27 screens, phone and desktop, light and dark): 437 PASS, 0 FAIL, 72 WARN on this build;
the same on v0.9.21 except one new WARN, the Home "Lessons" link at 36 px. Entry pages: unchanged from v0.9.21
except the 404 page (two landmark issues fixed) and the new /karaoke-app page (W-03).

## What is working well

- Every music fact on all eight pages checks out against FACTS.md and the reviewers' own arithmetic.
- Safety and claims: no breath rating, no "longest hold" or "widest range" rewards, voice types as labels, breaks called normal, stop and doctor lines present, "Just listen today" on every voice lesson.
- Semantics: skip link, banner, main and contentinfo landmarks, one h1 per page, headings in order, figures with text alternatives, all lesson text in the HTML before any script runs.
- Every control has a name; sliders speak musical values ("Do is D flat 4: D flat major, five black keys", "A sharp 3 plus 6 cents, 233.89 hertz").
- Keyboard: every step toy works by keyboard, the season map takes arrow keys, the spiral explains its keys in a hidden description, the lesson menu is a native modal dialog with Escape and focus return.
- Targets: on phones every control is 44 px or larger apart from one footer link and the prerequisite chips (28 px).
- Reflow and text spacing: no content lost at 320 px or with WCAG text spacing on six of eight pages.
- Motion: nothing autoplays; Pause animations freezes the Mercs, sky, spiral drift and metronome (no pixel changes after pausing); reduced motion pauses everything and says so on the page; no flashing faster than 2.33 a second.
- Quiz feedback moves focus, uses words and icons as well as color, and says "Not quite", never "wrong".
- Contrast: every text token passes 4.5:1 on every surface (lowest 5.32:1); body text samples at 6 to 9:1; the focus ring is 10:1.
- Design: one listening room across all eight pages (the same section rhythm, quiz card, deck and masthead), locked states shown with a lock icon and a sentence, quiz feedback that never relies on red and green, and both Mercs asking and answering in their bible roles.
- Wider web: 437 sweep checks pass with 0 failures on 27 app screens, phone and desktop, light and dark; no regressions against v0.9.21.

## The checklist

### P0: Blocker: wrong fact, safety-rule break, or a task impossible for a keyboard or screen-reader user on a live lesson

None found.

### P1: Fix before release (live lessons) or before publishing the draft it sits in

#### Every lesson page (shared kit)

- [x] **S-01** Predict answers are not announced to screen readers `BROWSER`
  - Each predict reveal is a live region that starts hidden; its text is written and the region unhidden in the same tick, and focus stays on the play button. Screen readers (VoiceOver especially) usually skip a region that appears from display:none, so a blind learner never hears the answer. Lesson 2 step 5 has no live region at all. Lesson 5 step 2 and the Lesson 3 hook already do it right by moving focus to the reveal.
  - Where: kit/predict.ts:120-151; learn/01.html:462; learn/02.html:482, 1138, 1392, 1399; learn/05.html:490; learn/06.html:477, 997
  - Fix: Keep one always-rendered, visually hidden role="status" per predict and write the reveal into it after showing it; or move focus to the reveal (tabindex="-1") as lesson-05/predict-breath.ts:46-47 does. Add the same to Lesson 2 step 5.
  - Standard: WCAG 4.1.3
  - **Status (Fixed):** A new kit status line (kit/announce.ts) speaks each reveal once it shows; the reveals' own hidden live regions are dropped, so nothing is said twice. Lesson 2 step 5 is covered too. Focus stays on the play button. The reveal is read from its words, so ♯ is said as "sharp", "You said" is not spelled out in capitals, and a button's label is not read into it. The status line empties about 5 s after it speaks.
- [x] **S-02** Explorer card buttons drop keyboard focus to the page `BROWSER`
  - "Mark as done" and the "Builds on" / "Opens" lesson buttons rebuild the whole card, destroying the focused button. Reproduced on Lesson 1: after Enter on "Mark as done" and on "02 · Twelve notes", document.activeElement is <body>.
  - Where: kit/explorer.ts:291-303, 315-328, 526
  - Fix: Update the card in place, or after refresh() focus the same control in the new card (or its h3 with tabindex="-1").
  - Standard: WCAG 2.4.3
  - **Status (Fixed):** After a rebuild, focus goes back to the same control (Mark as done, now Done), or to the opened lesson's title after a Builds on / Opens link. After such a link the status line empties rather than also say "card below", since focus is already on the card's title (cc80f3cce).
- [x] **S-03** Tabbing onto the season map shows no focus change `BROWSER`
  - Only the selected lesson node is in the tab order (roving tabindex), and `.node.sel` draws a permanent 2px ink outline that beats the global :focus-visible ring. Tabbing onto the map changes nothing visible. The keyboard walk flagged this node on all 8 pages.
  - Where: kit/lesson-sections.css:648-652 vs kit/lesson-base.css:197-201
  - Fix: `.node.sel:focus-visible { outline-color: var(--aqua); outline-offset: 6px }` or a second ring.
  - Standard: WCAG 2.4.7
  - **Status (Fixed):** The selected node draws a 3 px aqua ring 6 px out when it has keyboard focus.
- [x] **S-04** Lesson menu button: spoken name does not contain the visible label `BROWSER`
  - Visible "Season 1 · Lesson 01" ("Lesson 01" on phones); accessible name "Lesson 1 of 14, What is a note?: all lessons". iOS/macOS Voice Control and Dragon users saying what they see ("tap Season 1 Lesson 01") miss it. On every page.
  - Where: kit/lesson-menu.ts:404-408 (also the menu card "You are here: step 3 of 6", lesson-menu.ts:209-211, 328)
  - Fix: Start the name with the visible words: "Season 1, Lesson 1: What is a note? All lessons". Same for the "You are here" card.
  - Standard: WCAG 2.5.3 (A)
  - **Status (Fixed):** The button's name now starts with its visible label, as the screen shows it at that width: "Season 1 · Lesson 02, Twelve notes. All 14 lessons", or "Lesson 02, ..." at 1020 px and under, where the season prefix is hidden. The "You are here" card reads "Continue. You are here: step 3 of 6, ...".
- [x] **S-05** Segmented toggles hide which option is on, and clip their focus ring `CODE`
  - Sharps / Flats / Both and Spiral / Keyboard / Tiles / Ruler on live Lesson 2 (and Letters / Do-re-mi in the kit) mark the selected segment only with a 16% aqua tint: 1.38:1 against the unselected segment. `.seg { overflow: hidden }` clips the 3px-outset focus outline. In forced colors nothing shows the state.
  - Where: kit/lesson-parts.css:30-50; lesson-02/lesson-02.css:110-128; learn/02.html:852-886, 1795-1862
  - Fix: A 3:1 indicator (solid aqua border, underline or check icon); `outline-offset: -3px` on `.seg .btn` or drop the overflow; a forced-colors rule.
  - Standard: WCAG 1.4.11, 2.4.7
  - **Status (Fixed):** The option that is on wears a 2 px solid aqua ring (about 10:1); overflow: hidden is gone (the end segments round the pill themselves), so focus rings show; forced colours paint it Highlight.
- [x] **S-06** Turning the pitch spiral needs a drag `CODE`
  - The spiral turns only by dragging (or Shift+arrows). The single-pointer alternative, the auto drift with "Resume turning", is switched off whenever animations are paused or reduced motion is on, so a pointer user who cannot drag cannot turn it. Lesson 1 steps 5-6 ask "Turn the spiral, and tap any bead"; Lesson 2 steps 1-3 and free play use it.
  - Where: kit/spiral.ts:205, 258-272, 330-352, 480
  - Fix: Add "Turn left" / "Turn right" buttons (one bead, 30 degrees, per press) beside "Pause turning".
  - Standard: WCAG 2.5.7 (AA)
  - **Status (Fixed):** Turn left and Turn right buttons (one bead, 30 degrees, a press) sit beside Pause turning on Lesson 1's spiral and Lesson 2's two; they hide once the spiral is unrolled.
- [x] **S-07** Quiz: the right answer's spoken name contains raw HTML `BROWSER`
  - The "(the right answer)" name is built from the option's markup. Reproduced on Lesson 4: the names read "D, E, F<span aria-hidden="true">♯</span><span class="sr"> sharp</span>, G, A, B, C<span ...> sharp</span>, D (the right answer)" and "F<span ...>♯</span>... (the right answer)". Any lesson whose options use sign markup is affected.
  - Where: kit/quiz.ts:257; lesson-04/quiz-questions.ts:64, 111
  - Fix: Build the label from the rendered option's textContent, or leave the name alone and append a visually hidden " (the right answer)" span.
  - Standard: WCAG 4.1.2
  - **Status (Fixed):** No name is built from markup any more: answered options end with visible "Right answer" / "Your answer" tags (see G-01), which are part of the name.
- [ ] **S-08** Touch screen readers may play the wrong note on the spiral and keyboard (P0 if confirmed) `DEVICE`
  - Canvas sliders play the bead under the pointer on tap, and the selected bead only on Enter/Space. In Chromium, with 233 Hz selected by keyboard, a tap 60% across the Lesson 1 spiral selected and played the bead under it (466 Hz) instead. VoiceOver and TalkBack double-tap at the element's centre, so a blind learner who picked a note with swipes hears whatever sits at the centre, or nothing. This blocks "tap any bead to hear it" (Lesson 1 step 5) and Lesson 2 step 1.
  - Where: kit/spiral.ts:418-431, 468-471; learn/01.html:1139; learn/02.html:1024
  - Fix: On an activation with no drag that does not land on a bead, play the selected note; or play the selected note on each value change. Then confirm with VoiceOver on an iPhone and TalkBack on Android.
  - Standard: WCAG 2.1.1, 4.1.2; Apple HIG VoiceOver
  - **Status (Partly fixed):** Code fallback in #1177: a click that no pointer made (a screen reader double-tap, a switch, voice control) plays the selected note instead of doing nothing. Still needs VoiceOver on an iPhone and TalkBack on Android (device plan).
- [ ] **S-09** No way back to the app from a lesson; a dead end in the installed app `BROWSER`
  - The new Home "Lessons" link opens /learn/01, a separate document. The masthead's brand link goes to #top; the only links out of the eight pages are each lesson's practise rooms, and they open a new tab. None links to Home (checked on all 8). The manifest is display "standalone", scope "/", so in the installed app on an iPhone there is no back button: a learner who opened Lessons from Home cannot return to MercuryPitch without closing the app.
  - Where: learn/0N.html masthead and footer; src/pages/HomePage.tsx:192-199; public site.webmanifest
  - Fix: Add a visible "MercuryPitch" / "Open the app" link (masthead or lesson menu, and footer). Check the installed app on iOS and Android.
  - Standard: Navigation; Apple HIG (always a way back)
  - **Status (Corrected):** Correction: the lesson menu (the masthead's "Season 1 · Lesson 0N" button) already ends with a "MercuryPitch home" link; the review missed it because the menu is built when it opens. It is two taps deep, so #1177 also puts "MercuryPitch home" in every page's footer. The installed-app check stays in the device plan.

#### Lesson 1, What is a note? (live)

- [x] **L1-01** Steps 3 and 4: the results are shown but never spoken `BROWSER`
  - Step 3's flag "Pitch: unchanged / climbing / falling" is the evidence against the mix-up ("a high note is just a loud note"); it is not in a live region and fades after 1.6 s. Checked in Chromium: moving both sliders produced "Pitch: climbing" with no announcement. Step 4's flags after "Try 1.26", "Back to 2", "Try 3" ("277 Hz · a different note") are silent too. Lesson 3 already makes the same flag live.
  - Where: learn/01.html:726-734, 806-810; kit/loud.ts:138-151; lesson-01/toy-octave.ts:62-85
  - Fix: aria-live="polite" on #loudFlag and #octFlag (as learn/03.html:788-790), written once per change.
  - Standard: WCAG 4.1.3, 1.3.1
  - **Status (Fixed):** Step 3's flag is spoken once per change through the kit status line (Lesson 3's loudness flag too, whose own live region is dropped). Step 4's flag is read out in the ratio slider's value text (aria-valuetext), so the slider says it as it moves; only Try 1.26, Back to 2 and Try 3, which move the slider from elsewhere, speak what it now says through the status line. Found while checking: an arrow key moved "how fast" by under half a hertz, below the flag's bar, so a keyboard never raised "Pitch: climbing" at all; the flag now measures from where it last spoke. Its fix now has unit tests (kit/loud.test.ts, lesson-01/toy-octave.test.ts).
- [x] **L1-02** Step 4 says "slide the ratio and listen", but the slider is silent `BROWSER`
  - Try: "Slide the ratio from 1 to 3 and listen." The ratio slider only retunes a tone that "Play both" started (and that stops after 9 s). Checked in Chromium: no sound starts while the slider moves. Figures 2 and 3 do sound while held, so learners expect it.
  - Where: learn/01.html:1104; lesson-01/toy-octave.ts:107, 127-141
  - Fix: "Press Play both, then slide the ratio from 1 to 3." Or give #ratio the dial's hold-to-play (kit/toy-helpers.ts holdTone).
  - Standard: Instruction must match the UI
  - **Status (Fixed):** Try now reads "Press Play both, then slide the ratio from 1 to 3." (LESSON.md updated).

#### Design and mascot

- [x] **G-01** Answered quiz: your own pick is barely marked, the right answer shouts `DESIGN`
  - After a wrong pick the brightest card in the question is the correct answer (white check disc, bright border, raised fill); the learner's own pick gets a thin "x" in the same grey ring as an unanswered letter, and nothing says "your answer". At a glance the ticked card reads as "what I chose". Every lesson, both live ones included. (Screen readers do get the pressed state and "(the right answer)".)
  - Where: Shots L01-phone-10, L02-phone-11, L02-desktop-09, L04-desktop-10; kit/quiz.ts; kit/lesson-parts.css
  - Fix: Label both cards in words ("Your answer", "Correct answer"); give a wrong pick its own treatment (filled "x" disc, solid border); dim only the option nobody chose.
  - Standard: WCAG 1.3.1 / 1.4.1 risk; feedback clarity
  - **Status (Fixed):** Answered cards say what they are, on a line under the answer: "Your answer" on a miss, "Right answer" on the right one, "Your answer: right" when they are the same. A missed pick is no longer dimmed: solid border and a filled cross. Only the options nobody chose step back.
- [ ] **G-02** Sound is spread over three controls, and Play works while the gate says sound is off `DESIGN`
  - Lesson 1's first screen has the masthead "Sound" switch (its label never says on or off), the "Turn sound on" gate, and a lock line "Choose an answer to unlock the sound". After the predict, the Play buttons are enabled while the gate still says sound is off, so the learner presses Play, hears nothing and gets a 4-second toast. Lessons 2 to 8 repeat the masthead-plus-gate pair.
  - Where: Shots L01-desktop-00, L01-phone-02; kit/page-chrome.ts; kit/sound.ts; learn/0N.html gate
  - Fix: One sound model: the first Play press turns sound on (it is a user gesture) and the gate disappears, or the gate is the only switch and the masthead mirrors it with "Sound on" / "Sound off". Reword the lock as "Choose an answer first".
  - Standard: Usability of the first interaction
  - **Status (Corrected):** Correction: the first Play press already turns sound on when it has not been chosen (kit/sound.ts canPlay), so a first-time learner does hear it; silence and the toast come only after turning sound off. Done in #1177: the lock line now reads "Choose an answer to unlock the play buttons." on every page, or "the play button" where one play is locked (Lessons 2 and 8, L8-09), and the "Sound is off" toast waits for its Turn on (S-19). Still open: whether to fold the masthead switch and the gate into one control (owner).
- [x] **G-03** Below 1240 px the motion switch says only "Pause", right beside the speaker `DESIGN`
  - The masthead's "Pause animations" shortens to "Pause" at 1240 px and narrower (phones, tablets and smaller laptop windows) and sits next to the mute button, so in a sound lesson it reads as pausing audio. The deck also has its own "Pause turning". The accessible name is "Pause animations", but sighted phone users only see "Pause".
  - Where: Shots L01-phone-00 (masthead), L02-phone-05; learn/0N.html #motionSwitch `.mw` span; kit/lesson-base.css
  - Fix: Label it for what it does on every width ("Motion" with the pause glyph, or "Still" / "Moving"), or move it into the lesson menu with a distinct glyph in the bar.
  - Standard: WCAG 2.4.6 (labels describe purpose)
  - **Status (Fixed):** Below 1240 px the switch now reads "Animations" beside its pause icon instead of a bare "Pause"; its name is still "Pause animations". To make room on phones, the lesson menu button's progress ring now gives way under 420 px (it did under 360 px); the menu itself shows the same progress. Checked at 390, 400, 414, 420, 821, 900, 1024, 1240 and 1300 px: the masthead never scrolls sideways. Under 390 px the switch stays icon-only (unchanged).
- [ ] **G-04** Phone deck: each "Try" line sits a full screen below the toy it refers to `DESIGN`
  - On phones the step is one card: figure first, then the step text, "Try" and "Notice". The instruction and its toy are never on screen together, so the learner reads, scrolls up, acts, then scrolls down for "Notice". This breaks the core loop on both live lessons.
  - Where: Shots L02-phone-05 and -06, L01-phone-04 and -05, L04-phone-06 and -07; kit/lesson-stage.css; kit/step-deck.ts
  - Fix: Put the "Try" line inside the deck card next to the figure's controls, or make the figure a compact sticky band while the text scrolls.
  - Standard: Usability on the primary platform (phones)
  - **Status (Open):** Not in #1177: a layout decision for the owner (Try line inside the deck card, or a compact sticky figure).

#### Voice lessons 3, 5, 7 and 8 (microphone)

- [ ] **V-01** Screen-reader speech is spoken into an open microphone take `DEVICE`
  - Status lines are spoken over Merc's 2 s model note, and "...your turn. Sing it back at about speaking volume." (Lesson 3), "Breathe in, then sing..." (Lesson 5), "Breathe, then hum one siren on “ng”..." (Lesson 7) are spoken just as the take opens, with echo cancellation off. A screen reader playing through the speaker can talk over the model and be measured as the singer.
  - Where: lesson-03/sing.ts:190-191, 210-213; lesson-03/sing-take.ts:114-119; lesson-05/sing-hold.ts; lesson-07/sing.ts:64; lesson-08/take.ts
  - Fix: Give the routine once in the briefing (and "use headphones with a screen reader"); per note, announce before Merc sings; open the take only after the line has had time to be spoken; announce nothing while a take is open. Confirm on a phone with VoiceOver and TalkBack.
  - Standard: WCAG 4.1.3 in practice; FACTS 57
  - **Status (Open):** Not in #1177: needs a phone with VoiceOver and TalkBack and a real microphone first (device plan).

#### Lesson 3, Match a note (draft)

- [x] **L3-01** Step 1 Try never says to hold Sing `CODE`
  - Try: "Turn on slow motion, then drag Stretch from slack to tight." The folds open and close (and Swings counts) only while Sing is held, so following the Try shows nothing the Notice describes.
  - Where: learn/03.html:1055-1056; lesson-03/toy-folds.ts:197-205
  - Fix: "Turn on slow motion and hold Sing. Then move Stretch to tight and hold Sing again."
  - Standard: Instruction must match the UI
  - **Status (Fixed):** Try now reads "Turn on slow motion and hold Sing. Then move Stretch to tight and hold Sing again." (LESSON.md updated).
- [x] **L3-02** After "Uncomfortable" the card still sends the learner to sing `CODE`
  - After "Uncomfortable" or "Just listen today" only the body swaps to "Rest today..."; the card keeps the eyebrow "Practise it in MercuryPitch" and stays one big link to Voice Mirror.
  - Where: learn/03.html:1773; lesson-03/wrap.ts:29-31
  - Fix: Swap the eyebrow ("Rest today") and link only the address on the rest card.
  - Standard: FACTS 36 / REQ-GVC-055: nothing after discomfort recommends more singing
  - **Status (Fixed):** After "Uncomfortable" or "Just listen today" the card is no longer a link, its eyebrow says "Rest today" and the address shows only in the rest text. Lessons 5 and 7 had the same card and get the same fix (kit/comfort.ts mountPractiseCard). Lesson 6's rest card now rests as well: it names Interval Trainer for later with no link, and Ear Lab's Leap, which needs no voice, stays. The rest cards no longer say "Rest today" twice: their text starts with the room.
- [x] **L3-11** Lesson 3's stage prints the predict's answer above the question `DESIGN`
  - The hero shows "ASKED 59 % of 1,105" and "TESTED 10-16 % a semitone or more off" right above "PREDICT: ...How many sang a semitone or more off?" with "Most of them" / "About as few as anyone else". The 22 Oct hook change left the stage figures in place, so predict-then-reveal is undone (seen on the current build). Lesson 2's next card repeats the figures (L2-07).
  - Where: learn/03.html hero stage (ASKED / TESTED tiles); shot L03-desktop-00, L03-phone-02
  - Fix: Show only ASKED before the choice; reveal TESTED with the reveal cards.
  - Standard: Predict before reveal (TEACHING-PLAYBOOK, MASTER-PLAN 4.2)
  - **Status (Fixed):** The TESTED tile keeps its place but stays hidden (visibility, so screen readers skip it too) until a choice is in. Its fix now has a unit test (lesson-03/hook.test.ts).

#### Lesson 5, Breath and a steady note (draft)

- [x] **L5-01** Step 1 says "Play the note", but the control is "Hold the note" `CODE`
  - Try: "Play the note, slide Push up and down, then keep it still." Fig. 1 has no Play control.
  - Where: learn/05.html:1058 (button at :717, :1894)
  - Fix: "Press Hold the note, slide Push up and down, then keep it still."
  - Standard: Instruction must name a real control
  - **Status (Fixed):** Try now reads "Press Hold the note, slide Push up and down, then keep it still." (LESSON.md updated).

#### Lesson 6, Intervals (draft)

- [x] **L6-01** Interval brackets: the spoken name does not contain the visible label `CODE`
  - Brackets show "P5 · 7", "M2 · 2", "m2 · 1"; the button over each is named "Play the interval: C 4 up to G 4, a perfect fifth". Voice control "tap P5" matches nothing. Gap buttons ("7 / leap") have the same problem.
  - Where: lesson-06/tune-words.ts:62-70, 150-161; kit/tune-line.ts:395-403
  - Fix: Start the name with the visible text: "P5, 7 semitones: play C 4 up to G 4, a perfect fifth".
  - Standard: WCAG 2.5.3 (A)
  - **Status (Fixed):** Bracket names start with the drawn label ("P5, 7 semitones: play C 4 up to G 4, a perfect fifth"); gap buttons with theirs ("7, leap: gap 2, up 7 semitones").

#### Lesson 7, Slides, sirens and your range (draft)

- [x] **L7-07** Merc's siren, the mark each figure exists to show, is nearly invisible `DESIGN`
  - In Figures 1 and 2 and free play, the idle siren line is a thin dim amber: sampled at (75, 59, 33) on (24, 30, 43), 1.55:1, and 2.1:1 at its brightest pixel. The hatched ends, axis labels and "the ends" all out-read it; on a phone in daylight the hill disappears.
  - Where: Shots L07-phone-05, -06, L07-desktop-05, -06, -11; lesson-07/range-toy.ts and kit/range-chart-draw.ts (siren stroke)
  - Fix: Draw the idle siren at 3:1 or better (for example #f59e0b at 2 to 3 px, or ink-2 dashed until it plays) and keep the bright glow for playback.
  - Standard: WCAG 1.4.11 (graphical object, 3:1)
  - **Status (Fixed):** The idle siren is drawn at 60 % instead of 22 %: about 3.6:1 on the chart (#f59e0b at 0.6 over the #181e2b the review sampled); playback still draws the bright line and glow.

#### Lesson 8, Beat, tempo and the backbeat (draft)

- [x] **L8-01** Tap pad ignores taps from assistive technology `BROWSER`
  - The pad listens only to pointerdown and keydown. Checked in Chromium: a click event alone (what NVDA/JAWS browse mode, VoiceOver on the Mac with VO+Space, and likely Switch and Voice Control send) registers 0 taps; Space registers. Steps 1-2, free play and the backbeat take do nothing for those users, and the take then reports "We couldn't line your taps up...". The module header even says a late click counts.
  - Where: kit/tap-pad.ts:36-47; learn/08.html:698, 1231, 1770
  - Fix: Also accept a click with detail === 0 and no pointer or key tap within 50 ms, timed by its timeStamp (the Ear Lab rule).
  - Standard: WCAG 2.1.1, 4.1.2
  - **Status (Fixed):** The pad also takes a click that no pointer or key made (CLICK_ECHO_MS = 100 after the pad's last pointer up or key). The rule lives in src/lib/ear/tap-rule.ts, so the Ear Lab's pad takes the same clicks. Later in #1177, only Space and Enter time a click's echo, and a pointer's echo has its own window (POINTER_ECHO_MS, 1 s), so a late click on WebKit is not a second tap. The device plan checks both: 20 taps on a slow iPhone, and VO+Space once on a Mac.
- [x] **L8-02** The tap tempo result never reaches a screen reader `BROWSER`
  - "Your taps: N BPM" sits inside the figure's aria-hidden visual layer and is never announced; step 1's taps are silent apart from a flash. After seven Space taps in Chromium the result was in neither the accessibility tree nor a live region. Step 2's Notice ("Tap faster and your number climbs") cannot be done without sight. Same in free play.
  - Where: kit/beat-machine.ts:145-160, 598; learn/08.html:896-905
  - Fix: Move the readout out of the hidden layer, or announce it politely at most every 2 s: "Your taps: 88 beats per minute".
  - Standard: WCAG 1.3.1, 4.1.3
  - **Status (Fixed):** "Your taps: 88 beats per minute" is spoken on the machine's live line at most every 2 s, and once more after the taps change it.
- [x] **L8-03** Free play: March stays unpressed after you press it `BROWSER`
  - Checked in Chromium: after pressing March, aria-pressed is still false on March and true on Rock, while the live line says "March at 120 beats per minute".
  - Where: kit/beat-machine.ts:343-344, 503-512; learn/08.html:1726-1743
  - Fix: Set chosen = name in the free state, or make March and Rock plain "Load" buttons without aria-pressed.
  - Standard: WCAG 4.1.2
  - **Status (Fixed):** Free play presses the pattern it just loaded.
- [x] **L8-04** "I'm comfortable: let's sing" loses focus for a first-time visitor `BROWSER`
  - Focus is sent to the first paragraph of the voice panel, which is hidden for someone with no stored voice. Checked in Chromium: focus ends on <body>. Lesson 7 focuses the panel itself and works.
  - Where: lesson-08/sing.ts:250-253; learn/08.html:1300-1306
  - Fix: Focus [data-panel="voice"] (or its first visible paragraph), as lesson-07/sing.ts:414-415 does.
  - Standard: WCAG 2.4.3
  - **Status (Fixed):** Focus goes to the first line of the shown panel that is itself shown ("Choose a voice to sing with" on a first visit).

### P2: Fix soon: accessibility beyond the minimum, consistency, clearer teaching

#### Every lesson page (shared kit)

- [x] **S-10** Step counter: announces only the number, and fires on every step scrolled past `BROWSER`
  - The polite region wraps "Step <b>1</b> of 6" with no aria-atomic, so most readers say "2" instead of "Step 2 of 6". On desktop the counter follows scrolling: tabbing from the steps to the next section logged five announcements ("Step 2 of 6" ... "Step 6 of 6") in 610 ms.
  - Where: kit/step-deck.ts:142; learn/0N.html `.counter`
  - Fix: aria-atomic="true"; announce only on Next/Previous, not on scroll-driven changes; include the step title.
  - Standard: WCAG 4.1.3
  - **Status (Fixed):** The counter is no live region; Next, Previous, a swipe and a menu jump say "Step 3 of 6: <title>" on the status line. Scrolling past steps says nothing. A swipe past the first or last step says nothing.
- [ ] **S-11** Focus does not follow the content after Next or a menu jump `BROWSER`
  - Phone deck: Next keeps focus on the button; only "Step 2 of 6" is announced, not the new step. Choosing a step or section in the lesson menu returns focus to the menu button in the masthead, so keyboard and screen-reader users start reading from the top.
  - Where: kit/step-deck.ts:163-169; kit/lesson-menu.ts:484-488, 532-534
  - Fix: Move focus to the new step's h3 (tabindex="-1"); after a menu jump, focus the target heading.
  - Standard: WCAG 2.4.3
  - **Status (Open):** #1177 names the step: Next, Previous, a swipe and a menu jump say "Step 3 of 6" and the step's title on the kit status line (S-10). Focus does not follow yet: it stays on Next, and a menu jump hands it back to the menu button.
- [ ] **S-12** Buttons become disabled while focused, dropping focus to the page `CODE`
  - Previous/Next at the deck ends; Lesson 1 "Play Merc's A" and "Play it an octave up" during the 6.4 s ring; feeling buttons after an answer; Lesson 3 hook pair and Match buttons; Lesson 4 Start lower/higher and Move do at their limits; Lesson 7 Start lower/higher; Lesson 8 Move do at plus or minus 4.
  - Where: kit/step-deck.ts:147-154; kit/sing.ts:302-309; kit/comfort.ts:137-140; lesson-03/hook.ts:111-114; lesson-03/toy-match.ts:166-176; lesson-04/stairs-toy.ts:151; lesson-04/sing.ts:95; lesson-07/range-toy.ts:411-414; lesson-08/sing.ts:174-177
  - Fix: Use aria-disabled and ignore the press (kit/ear-game.ts already does), or move focus to a neighbour.
  - Standard: WCAG 2.4.3
- [ ] **S-13** Toggle buttons change their label and aria-pressed together `CODE`
  - Screen readers hear contradictions such as "Roll it back up, toggle button, pressed" or "Done, toggle button, pressed". Lesson 2: Unroll, Straighten, Lift out the five, Look down; Lesson 3: chase Play/Pause; Lesson 5: Play the breath / Play; explorer: "Mark as done" becomes "Done".
  - Where: lesson-02/keys-toy.ts:87-96, 154-156; lesson-02/spiral-copy.ts:237-238; lesson-03/toy-band.ts:163-169; lesson-05/toy-gauge.ts:61-67; lesson-05/toy-hold.ts:137-141; kit/explorer.ts:201-202
  - Fix: Either a fixed label with aria-pressed, or a changing label without aria-pressed (as Lesson 1's Unroll does).
  - Standard: WAI-ARIA APG button; WCAG 4.1.2
- [ ] **S-14** Chatty live regions talk over the sound the learner must hear `CODE`
  - The sing ring re-announces "Hum it back · 4", "· 3", "· 2", "· 1" every second (about six lines in 6 s, over Merc's note and the hum) on Lessons 1, 2 and 4; Lesson 4's ring repeats "Do: D3 · 147 Hz" three times per guide; Lesson 7's held Higher announces every 150 ms (up to 24 lines in 4 s); Lesson 8's take status changes every bar; Lesson 3's Louder/Higher flag speaks on every arrow key.
  - Where: kit/sing.ts:88-92, 183-213; learn/04.html:1337; lesson-07/range-toy.ts:495-506; lesson-08/take.ts:181-184; kit/loud.ts:140-176
  - Fix: Announce phase changes only ("Your turn: 4 seconds", "Done"); hide the per-second count from assistive tech; throttle held buttons to the final value.
  - Standard: WCAG 4.1.3 (quality)
  - **Status (Open):** #1177 quiets one of them: Lesson 3's Louder/Higher flag speaks on the kit status line only when its words change, not on every arrow key. The sing ring's count (Lessons 1, 2 and 4), Lesson 4's ring line, Lesson 7's held Higher and Lesson 8's take status still speak as above.
- [ ] **S-15** Reduced motion is not applied everywhere the page says it is `CODE`
  - The sing ring stops its breathing and ripples only if a page passes `calm: true`; Lessons 1, 2 and 4 do not. Lesson 1's slow-motion ripples and the "Low to high" bead still travel under prefers-reduced-motion although the module header says they do not.
  - Where: kit/sing.ts:142; lesson-01/sing.ts:16; lesson-02/sing.ts:77; lesson-04/sing.ts:74; lesson-01/toy-string.ts:153-166, 290-294; lesson-01/words.ts:174-179
  - Fix: Make calm the default under reduced motion (and when Pause animations is on).
  - Standard: WCAG 2.3.3 (AAA); MASTER-PLAN 4.2 promise
- [ ] **S-16** No forced-colors (Windows High Contrast) styles anywhere in the kit `BROWSER`
  - Text and buttons survive (checked with emulated forced colors), but every state drawn by a tint disappears: pressed choices, segmented toggles, voice and feeling choices, explorer filters, switch knobs and Lesson 8's beat-grid cells look the same on and off.
  - Where: kit/lesson-base.css:583-615; kit/lesson-parts.css:45-49; kit/lesson-stage.css:311-315; kit/lesson-voice.css:181-185, 364-368; kit/lesson-sections.css:516-519; kit/lesson-beat-machine.css:282-284
  - Fix: @media (forced-colors: active): Highlight borders or a check for [aria-pressed=true], CanvasText knobs, a border-style difference on grid cells.
  - Standard: WCAG 1.4.11 in high-contrast modes
- [ ] **S-17** Screen readers hear junk text on every page `BROWSER`
  - Seen in the accessibility trees of all 8 pages: masthead links "I Lesson", "II Explorer" (roman numerals; VoiceOver may say "eye"); map lanes and arcs run together ("Theory 7 lessons Voice 6 lessons + 14 Hear itLessons 1 to 7 Shape itLessons 8 to 14"); node labels repeat each button; an unnamed graph image; label chips run into their text ("Tap an answer one try each", "One-sentence challengeExplain", "Speed 220per s", "You said: two different notes · 440 does sound higherOne after..."); "·" separators; "—" and "–" empty readouts read as "em dash".
  - Where: kit/episode.ts:54-75; kit/explorer-graph.ts:74, 90, 184-197; kit/explorer.ts:166, 367-371; learn/0N.html masthead, quiz eyebrow, readouts
  - Fix: aria-hidden on numerals, lane/arc/node labels and the edges SVG; visually hidden ": " after label chips; commas instead of "·" in spoken text; "none yet" instead of a dash.
  - Standard: WCAG 1.3.1; screen-reader quality
  - **Status (Partly fixed):** Done: the masthead's roman numerals are aria-hidden. Open: lane, arc and node labels, label chips, separators and empty-readout dashes.
- [ ] **S-18** Practise cards: 60 to 120-word link names, and new tabs with no warning `BROWSER`
  - On Lessons 1, 2, 3, 5 and 7 the whole practise card is one <a target="_blank">, so its name is the entire card (Lesson 7's includes the safety line). Lessons 4, 6 and 8 link only the address. Every page has 2 to 5 target="\_blank" links and none says it opens a new tab (the lesson menu's does).
  - Where: learn/01.html:1317-1350; learn/02.html:1723-1774; learn/03.html:1764-1800; learn/05.html:1795-1832; learn/07.html:1689-1730
  - Fix: One pattern: the card is a div with one short link ("Open Voice Mirror") plus visually hidden "(opens in a new tab)".
  - Standard: WCAG 2.4.4 (best practice), 3.2.5 (AAA)
- [x] **S-19** The "Sound is off" toast vanishes before a keyboard user can reach its button `CODE`
  - The toast with its "Turn on" button hides after 4.2 s and sits after the footer in the DOM. At rest its text ("Sound is off.") stays in the accessibility tree because it is hidden only by opacity.
  - Where: kit/toast.ts:15-29; kit/sound.ts:517; kit/lesson-base.css:859-885
  - Fix: Keep it until the next action or a dismiss, or put "Turn on" next to the control that raised it; visibility:hidden and empty text when idle.
  - Standard: WCAG 2.2.1
  - **Status (Fixed):** A toast with a button now stays until it is used, put away with Escape, or a tap elsewhere (or sound comes on); idle, its text is emptied. Escape hands focus to the sound switch, and the idle line is empty from the first paint.
- [ ] **S-20** Device-specific words: "Tap", "Drag", "Hold and drag" `CODE`
  - About 90 visible strings across the 8 pages and the kit assume touch: the sound gate ("Tap to turn it on"), every quiz ("Tap an answer"), Try lines ("Drag the dial", "tap any bead"), practise notes ("then tap Leap"). The gate line also exists in three wordings and promises "nothing plays until you press a play button" although Turn sound on itself plays a soft A3 and A4.
  - Where: kit/page-chrome.ts:36-55; kit/spiral.ts:146-147; kit/season.ts:197, 240, 281, 338; learn/0N.html gate and quiz eyebrow
  - Fix: One kit-owned gate line; "Press", "Choose", "Move" (or "tap or click" where a pointer is meant).
  - Standard: House copy brief; Apple HIG inclusive language
- [ ] **S-21** Slider labels carry the live value and pointer-only instructions `BROWSER`
  - Lesson 1's dial label is "Hold and drag to hear it A3": the name changes as it moves, repeats the value, and tells keyboard users to drag. aria-valuetext says only "220 hertz", so the note is rarely spoken. Same pattern: "How far (amplitude) 50%", "Ratio, orange to blue 2.00", Lesson 3 "Stretch 220 Hz, A3", Lesson 5 "Push 50%", Lesson 8 "Tempo 90 BPM".
  - Where: kit/dial.ts:53-54; learn/01.html:678-690, 736-755, 824-826; learn/03.html:737-811; learn/05.html:722; learn/08.html:703, 819, 1750
  - Fix: Static label ("Frequency", "Push"); value in aria-valuetext ("220 hertz, A3"); aria-hidden on the visible <b> value.
  - Standard: WCAG 4.1.2; verbosity
- [ ] **S-22** Season map: states are not in the names, and arrow keys are undiscoverable `BROWSER`
  - Node names are only "Lesson 2: Twelve notes": ready, coming later and done are drawn (solid, dashed, filled) but not spoken. Arrow keys move along the map (verified) but nothing says so. The dashed "Coming later" ring is 2.8:1.
  - Where: kit/explorer.ts:342-345; kit/explorer-graph.ts:237-242; kit/lesson-sections.css:542-544, 614; kit/lesson-menu.css:322
  - Fix: Add the state to the name ("..., coming later"); a visible hint "Arrow keys move between lessons"; ring at 3:1 or more.
  - Standard: WCAG 1.3.1, 1.4.11
- [x] **S-23** Skip link lands past half the lesson `BROWSER`
  - "Skip to the lesson" goes to #lesson (the steps), past the h1, sound gate, predict, recall and the key words.
  - Where: learn/0N.html `.skip`
  - Fix: Target main (or the h1), or rename it "Skip to the steps".
  - Standard: WCAG 2.4.1 (met, but misleading)
  - **Status (Fixed):** "Skip to the lesson" now lands on main (the h1), not on the steps.
- [ ] **S-24** Five different page-title patterns across eight lessons `BROWSER`
  - Lesson 1 "What is a note? Find Your Pitch, Lesson 1 | MercuryPitch"; 2-3 "Twelve notes: Find Your Pitch, Lesson 2 | ..."; 4-5 "The major scale and home · Find Your Pitch | ..." (no lesson number); 6-7 "Intervals: the distance between notes | MercuryPitch" (no series); 8 "Beat, tempo and the backbeat, explained | ...". og:title separators differ too. The title is the first thing a screen reader announces.
  - Where: learn/0N.html <title>, og:title, twitter:title
  - Fix: One template: "<Title>: Find Your Pitch, Lesson N | MercuryPitch".
  - Standard: WCAG 2.4.2 (met); consistency, SEO
  - **Status (Decided):** Decided 22 Oct: the titles are search-led, not one series template. Each lesson's `<title>` leads with what people search for ("What is a note? Pitch, hertz and the octave | MercuryPitch"); the series name stays in the kicker, the breadcrumb, og:title and the structured data. Another PR carries it out; the template above is not to be applied.
- [ ] **S-25** The admin console can publish hooks the facts do not support `CODE`
  - Hook and tease variants flagged by the team's own notes are selectable. Lesson 11's "Why does your voice flip at roughly the same note every time you slide up?" contradicts its FACTS ("a flip can come at different notes on different slides, or not at all"); Lesson 9 "so much harder", Lesson 12 "hundreds", Lesson 14 "compelling" have no FACTS source. Not shown today; publishing one would put an unsupported claim live.
  - Where: kit/lesson-copy.ts:107-157; kit/team-notes.ts:48-90
  - Fix: Hide or block flagged variants in the console until FACTS supports them.
  - Standard: TEACHING-PLAYBOOK claims rule
  - **Status (Decided):** Decided 22 Oct: the owner dropped the five alternative hooks that make claims no FACTS source supports or use mood labels, `harder` (Lesson 9), `bright-dark` (10), `same-note` (11), `hundreds` (12) and `compelling` (14), which covers every hook named above. Another PR carries it out. The alternatives that stay remain selectable with their notes, so nothing is hidden: Lesson 3's `figures` and `tested` (both notes warn that they give the cold open's answer away), Lesson 5's new `steady`, Lesson 7's `two-questions` and Lesson 14's tease `band`.
- [ ] **S-32** Stage controls lock until the in-step predict is answered, with no reason given `BROWSER`
  - Lesson 2 step 5 (Sharp, Flat, Show the rare ones) and Lesson 8 step 5 (every control: Play, March, Rock, Tempo, all 12 grid cells; checked in Chromium) are `disabled` until a predict in the text column is answered. Tab skips them and the stage never says why, so a keyboard or screen-reader user meets a dead figure.
  - Where: learn/02.html:894-937; lesson-02/steps.ts:142; learn/08.html step 5; lesson-08/steps.ts
  - Fix: aria-disabled plus a described-by line ("Answer the question in step 5 first"), or a visible lock hint on the stage itself.
  - Standard: WCAG 3.3.2, 4.1.2
- [ ] **S-33** With sound off, the answer never appears `CODE`
  - When a learner plays a predict example with sound switched off, the animation runs (and shows the answer) but the written reveal is never shown; on Lesson 6 the mix-up card, Try and Notice stay hidden too. A deaf or hard-of-hearing learner who keeps sound off never gets the text. The hint "Sound is off, so nothing played" also contradicts the toast "you'll see this one but not hear it".
  - Where: kit/predict.ts:146-151; lesson-05/hook.ts:159; lesson-06/cold-open.ts:133; lesson-06/steps.ts:60
  - Fix: After a silent play, reveal anyway (it describes what was shown) or offer "Show the answer"; one consistent sound-off line.
  - Standard: Equivalent for deaf and hard-of-hearing learners
- [ ] **S-34** Season copy that misleads or reads poorly on every map `CODE`
  - Lesson 8's map caption "A metronome, its arm on beats 2 and 4" contradicts step 1 ("one swing a beat"); the trailer is titled "Find your pitch" (series is "Find Your Pitch"); Lessons 1 and 2 cards caption their posters "From the episode: the title card" though no episode is published; topic chips a beginner cannot read ("Diatonic chords, Roman numerals, function", "Onset and offset", "messa di voce"); practise notes "Voice Mirror, its Hold: a comfortable note, held steady", "then tap Leap to name them"; "6 lessons + 14"; "Ready · read".
  - Where: kit/explorer-figures.ts:204-207; kit/season.ts:64-82, 149, 260, 281, 318; kit/explorer-graph.ts:25; kit/explorer.ts:155-166
  - Fix: Rewrite each in plain words (suggestions in the kit review appendix).
  - Standard: Plain language; accuracy

#### Lesson 1, What is a note? (live)

- [x] **L1-03** Ratio slider: arrow keys cannot move it off 2.00 `BROWSER`
  - At 2.00 the octave snap swallows single steps: ArrowRight and ArrowUp leave it at 2.00 (from 1.20 the arrows move normally). Keyboard users must know PageUp/Home/End; a VoiceOver user adjusting by swipe may be stuck at 2.00 (verify on device).
  - Where: learn/01.html:824-836; lesson-01/toy-octave.ts (snap)
  - Fix: Snap only on pointer release, or skip the snap for keyboard and assistive-tech steps.
  - Standard: WCAG 2.1.1 (usability)
  - **Status (Fixed):** The octave detent applies to a pointer drag only; arrow keys and screen-reader swipes step off 2.00. Its fix now has a unit test (lesson-01/toy-octave.test.ts): a key step off 2.00 stays off it, and a drag is still pulled back to the octave.
- [ ] **L1-04** Orange Merc opens with filler: "Ha! Same note." `CODE`
  - The bible limits orange to deep questions, sincere guesses and re-explanations, with no filler. Same line in the film captions.
  - Where: learn/01.html:366; lesson-01/assets/lesson-01.en.vtt:10
  - Fix: Page now: "Same note, surely?"; film at the next re-voice.
  - Standard: MERC-BIBLE section 2
- [ ] **L1-05** Film captions miss the sounds that teach (P1 once the film is published) `CODE`
  - Lesson 1's captions omit the pluck (0:38), the louder and the higher tone that demonstrate "Loud is how far it swings. High is how fast." (1:17, 1:19.5), the 277 Hz drift (2:28) and the run up the keys (3:44). Lesson 2 captions every example. The film is not on the page yet.
  - Where: lesson-01/assets/lesson-01.en.vtt:43-48, 81-85, 154-156, 214-215
  - Fix: Add "[a string is plucked]", "[the tone gets louder]", "[the tone goes higher]", "[220 and 277 Hz drift in and out]", "[a run up the keys]".
  - Standard: WCAG 1.2.2

#### Lesson 2, Twelve notes (live)

- [ ] **L2-01** "A sharp (♯) means one semitone up" reads as the note A sharp `CODE`
  - In a lesson about note names this sentence reads as the notes A♯ and A♭; a screen reader says "A sharp (sharp sign) means one semitone up; a flat (flat sign)...".
  - Where: learn/02.html:1319-1323
  - Fix: "The sharp sign (♯) means one semitone up; the flat sign (♭), one semitone down."
  - Standard: Clarity; screen-reader output
- [x] **L2-02** Quiz Q1 feedback: eight letters plus five notes does not make twelve `CODE`
  - "From A to A there are eight letters, counting both As, but five more notes sit between them: the octave is twelve semitone steps." 8 + 5 = 13 notes; the jump from notes to steps is unexplained.
  - Where: lesson-02/quiz-questions.ts:42
  - Fix: "...eight letters, counting both As, and five notes between them: thirteen notes, so twelve steps."
  - Standard: Teaching accuracy (FACTS 16)
  - **Status (Fixed):** Now "...eight letters, counting both As, and five more notes between them: thirteen notes, so twelve semitone steps." (Lessons 2 and 4 LESSON.md updated).
- [x] **L2-03** Ear game: "Space plays the step again" never works `CODE`
  - The card is not focusable and every focusable child is a button, so Space presses the focused button (after an answer, an aria-disabled one) and the replay branch never runs. Keys 1 and 2 answer only while focus is inside the card, which the line does not say.
  - Where: learn/02.html:1308-1310; lesson-02/ear-game.ts:149-158
  - Fix: tabindex="-1" on #earGame and focus it on "Play a step", or reword the line.
  - Standard: Instruction must match the UI
  - **Status (Fixed):** The line now reads "Keys 1 and 2 answer while you are in the game." The same promise of a Space replay was removed from Lesson 6's two games and Lesson 8's (Lesson 6 WEB-SPEC updated).
- [ ] **L2-04** Ear game: after a miss the explanation is spoken over the replay `CODE`
  - "Here it is again, slower. C to D: a tone, with C♯ between." is announced while the slower replay starts 700 ms later, so speech covers the step the learner must judge. Same in Lesson 6's games.
  - Where: lesson-02/ear-game.ts:73-77, 133-134; kit/ear-game.ts:233-257
  - Fix: Replay after the line (about 2.5 s) or only on a "Hear it again, slower" button.
  - Standard: Audio clarity for screen-reader users
- [ ] **L2-05** Step 5 announces E sharp 4 but not where it lands `CODE`
  - The arrow says "E sharp 4 written on the key it lands on." but not that the key is F4, a white key, which is the predict's answer.
  - Where: lesson-02/keys-toy.ts:141-151
  - Fix: "E sharp 4 lands on F4, a white key."
  - Standard: WCAG 1.1.1, 1.3.1
- [ ] **L2-06** "Start the guide" paces the slide only by a moving line `CODE`
  - Nothing audible or written says when to slide up and come back.
  - Where: learn/02.html:1563-1579; lesson-02/sing.ts:118-130
  - Fix: Add to the note: "Hold a second, slide up, hold a second, slide back"; or soft ticks at the turns.
  - Standard: WCAG 1.3.3
- [ ] **L2-07** The next-lesson card answers Lesson 3's question `CODE`
  - Since Lesson 3's hook changed (22 Oct), Lesson 2's card asks "What happened when researchers tested it?" and prints "TESTED 10-16 % a semitone or more off" beside it. next-card.ts says a card never carries its answer.
  - Where: learn/02.html:1776-1787; kit/next-card.ts:27-29; kit/season.ts:214
  - Fix: Show only "Asked 59 % of 1,105", or pair the figures with the statement hook. Owner check against CURIOSITY-MOMENTS.
  - Standard: CURIOSITY-MOMENTS rules 4 and 6
  - **Status (Open):** Decided 22 Oct, in part: Lesson 3 keeps its default hook, and the `figures` alternative's note warns that it gives the cold open's answer away (another PR carries it out), so pairing the figures with a statement hook is ruled out. Still open: the card's Tested tile beside "What happened when researchers tested it?"; show only "Asked 59 % of 1,105".

#### Design and mascot

- [ ] **G-05** "Start lesson" on the next-lesson card looks like a status label `DESIGN`
  - The main forward action at the end of a lesson is drawn as a small bordered pill with a dot, like the "Ready · read" status pill, while the explorer draws the same action as a full gradient button. The whole card is the link (checked in the accessibility tree), so the target is large; the problem is that it does not look like the way on.
  - Where: Shots L02-phone-13, L03-phone-11, L02-desktop-11; kit/next-card.ts; kit/lesson-sections.css
  - Fix: Draw "Start lesson" as the primary gradient button with a chevron, 44 pt high; keep dot pills for status.
  - Standard: Affordance
- [ ] **G-06** Lesson menu: the progress bar reads as lessons done `DESIGN`
  - Beside "0 of 14 done" the 14-segment bar lights 8 teal segments (the lessons available), so it reads as 8 of 14 completed. Lesson 1 says "Up next" while the learner is in Lesson 2, 3 or 4. When the sheet opens it auto-scrolls to the current lesson and takes its own header with it: the title, "0 of 14 done", the bar and the close button are cut off or gone on Lessons 4, 6, 7 and 8 (desktop and phone).
  - Where: Shots L02-phone-01, L02-desktop-01, L04-phone-01, L06-desktop-01, L07-desktop-01, L08-desktop-01, L05-phone-01, L07-phone-01; kit/lesson-menu.ts; kit/lesson-menu.css
  - Fix: Bar shows done and current only, availability as a dashed tail; "Not finished" on earlier lessons; sticky sheet header and close button.
  - Standard: Clarity of state
  - **Status (Open):** Decided 22 Oct, and carried out in another PR: Lesson 8 comes after Lesson 1, so on Lesson 1's page the menu no longer offers Lesson 8 as Up next. The three problems above stay open.
- [ ] **G-07** Static chips look like buttons, and buttons look like chips `DESIGN`
  - Hero metadata ("10 minutes", "After Lesson 1: ...", "Sound on", "Microphone optional") are bordered pills shaped like the explorer's filter chips; "Sound on" reads as a sound toggle while sound is off. In the explorer card, static topic chips and tappable "Builds on" pills look the same. Lesson 2's "1st" / "2nd" pills look like 27 pt buttons, its practise card's interval grid looks like tappable tiles, and the explorer's topic boxes and Lesson 8's syllable boxes have button borders.
  - Where: Shots L01-phone-00, L03-phone-00, L02-phone-15, L02-phone-09, L02-phone-13
  - Fix: Metadata as plain text with an icon; bordered pills only for things you can press, with a chevron; "Best with sound" for the sound chip; draw the interval grid as a figure.
  - Standard: Affordance
- [ ] **G-08** Series colours used outside their meanings `DESIGN`
  - Blue means blue Merc's note, orange orange Merc's, violet the contrast case, gold only "the fit" (MASTER-PLAN 5). Yet chip dots change colour from lesson to lesson, practise titles are blue (read as links), "Look down" has a gold border, Lesson 1's practise illustration draws the app's target in blue, and Lesson 2's sing guide draws Merc's model dashed grey (the "wrong guess" style). Lesson 4's guide is correctly solid amber.
  - Where: Shots L03-phone-00, L01-phone-07, L02-desktop-06, L02-phone-08, L02-desktop-07, L04-phone-09
  - Fix: Neutral dots or icons for metadata, ink practise titles; on pitch canvases the amber target band and violet singer line; dashed ink-2 only for contrast cases.
  - Standard: MASTER-PLAN 5 colour code
- [ ] **G-09** Play is drawn three ways, and the play triangle marks things that do not play `DESIGN`
  - "Play 220 Hz" has a coloured dot in one place and a triangle in another; "Play it an octave up" an orange dot; the menu's "Sing it" and the reveal lines start with a triangle though nothing plays, and Lesson 7 puts it on "Show" buttons that make no sound.
  - Where: Shots L01-phone-02, -03, L02-phone-07, L02-phone-01, L04-phone-02
  - Fix: Triangle on everything that plays (Merc colour as tint or swatch); a mic or person glyph for "Sing it"; no glyph on the "Locked in" line.
  - Standard: Consistency; affordance
- [ ] **G-10** Small uppercase mono used for instructions and whole sentences `DESIGN`
  - Contrast passes (5.3 to 6.3:1), but real instructions and sentences ("TAP THE STRING TO PLUCK IT", "DRAG TO TURN · TAP A BEAD TO HEAR IT", "ONE TRY EACH, THEN THE REASON", "COMING LATER · AFTER 5, 8, 9, 12") are set in 12 px caps with wide tracking, which removes word shapes for low-vision readers, worse at 1x on desktop. Serif-italic metadata at 14 to 16 px ("Ready · 15 min") has thin strokes.
  - Where: Shots L01-phone-04, L02-phone-05, L02-phone-09, L02-phone-16, L02-phone-13; kit/lesson-base.css mono label rule
  - Fix: Mono caps for one- or two-word kickers only; instructions, statuses and captions in Inter 14 to 16 px, sentence case.
  - Standard: Low-vision readability; Apple HIG typography
- [ ] **G-11** The same blocks sit in different places on different lessons `DESIGN`
  - Practise card inside Sing on Lesson 1 but in Wrap on 2 to 4; next-lesson card beside the recap on 1 and 3, after the practise card on 2 and 4; challenge under or beside the recap; Lesson 4 leads with Play above the gate and its predict is off the first desktop screen; Lesson 3's recall is a collapsed disclosure while 2 and 4 have a full section; Lessons 1 and 2 have no "Sing" nav entry, and the scroll-spy keeps a section lit past its end; the Lesson 4 dialogue is avatar cards, not the stage with bubbles.
  - Where: Shots L01-desktop-09, L02-desktop-10/11, L03-desktop-09, L04-desktop-00/03/12, L03-phone-00, L01-desktop-00 vs L03-desktop-00
  - Fix: One Wrap template (recap, challenge, practise, next lesson last with the primary button); one hero order (gate, then predict); one recall section; nav built from each page's sections; one dialogue component.
  - Standard: Consistency; MASTER-PLAN 4.2 order
- [ ] **G-12** Mascots that decorate instead of act `DESIGN`
  - Lesson 4's hero shows both Mercs idle with no line, and its cold open uses small avatar cards; in the sing ring blue Merc waits idle below the buttons on phones; after a predict no Merc reacts to the guess, and the unchosen option fades to about 3.9:1. The bible says mascots act, they don't decorate.
  - Where: Shots L04-phone-00, L04-phone-02, L04-desktop-03, L01-phone-07, L02-phone-08, L01-phone-02
  - Fix: Give Lesson 4's hero the cold-open lines or remove the Mercs; animate the ring Merc only while he sings and place him by Play; let a Merc react to the guess; keep the unchosen option at 4.5:1.
  - Standard: MERC-BIBLE section 5
- [ ] **G-13** Quiz "Try again" appears after the first answer, even a right one `DESIGN`
  - It sits under "ONE TRY EACH, THEN THE REASON" and does not say whether it resets one question or the whole quiz.
  - Where: Shots L03-phone-09, L02-phone-11, L02-desktop-09; kit/quiz.ts
  - Fix: Show "Start the quiz again" once every question is answered, or a per-question retry on the question.
  - Standard: Clarity
- [ ] **G-14** Disabled steps sit far from their reason `DESIGN`
  - Lesson 2's disabled "Start the guide" has its reason after the health note in a long paragraph; Lesson 4's "Play Merc's scale first" sits below the Move do row. The disabled button is about 3.8:1 and carries the next step.
  - Where: Shots L02-phone-07, L02-desktop-07, L04-phone-09
  - Fix: One line directly under the disabled button ("Play Merc's slide first"); the longer explanation after it.
  - Standard: WCAG 3.3.2 spirit
- [ ] **G-15** Links come in three styles, plus a bold address that is not a link `DESIGN`
  - Teal mono underlined with an arrow, blue underlined Inter in the footer and quiz feedback, and on Lessons 3, 5 and 7 a bold grey URL that is not a link with the real link further down. Blue links also collide with blue Merc's note.
  - Where: Shots L02-phone-15, L02-phone-16, L02-desktop-09, L03-phone-11
  - Fix: One in-content link style; make the bold address the link or drop it.
  - Standard: Consistency
- [ ] **G-16** Phone explorer list cramps every card `DESIGN`
  - The two-lane list uses half-width cards, so titles and statuses break into two or three lines ("What is a / note?", "COMING / LATER · / AFTER 11") while the other lane sits empty.
  - Where: Shots L02-phone-14, L02-phone-16, L03-phone-14, L04-phone-17; kit/explorer.ts phone list
  - Fix: Let a card span both lanes when the other is empty, or one column with a Theory / Voice tag.
  - Standard: Layout on phones
- [ ] **G-17** Lesson 4's Sing it buries the first action under copy `DESIGN`
  - About 650 pt of copy before "Play Merc's scale", with the health check as a small callout; Lesson 3 opens Sing with a clear choice card ("I'm comfortable: let's sing" / "Just listen today").
  - Where: Shots L04-phone-08, L04-phone-09, L03-phone-06
  - Fix: Reuse Lesson 3's check card on every Sing section; two sentences above the buttons, the detail below.
  - Standard: Consistency of the safety pattern
- [ ] **G-19** Copy says "Merc" with two Mercs on screen `DESIGN`
  - "then Merc sings it", "Merc moves the whole tune", "Merc sings the first line", "Merc's siren: E3 up to C#4": with both hosts present the reader cannot tell who sings. On phones from Lesson 6 on the Mercs shrink to about 35 to 45 pt at the edges, bubble tails point at the other bubble or the diagram, and neither appears below the hero, not even at the reveal, the quiz or the sing check.
  - Where: Shots L06-desktop-02, L06-phone-08, L07-phone-05, L05-phone-12, L06/L07/L08-phone-00; lesson-06/words.ts, lesson-07/words.ts
  - Fix: Say "blue Merc" (he sings the model, per the bible) or "orange Merc" every time; point each tail at its Merc; give them a reacting moment later in the page (or record that small-at-the-edge is intended).
  - Standard: MERC-BIBLE sections 2 and 5
- [ ] **G-20** Practise cards are walls of grey text at twice a comfortable measure `DESIGN`
  - Lesson 7's card is a 19-line grey paragraph on a phone; on desktop the practise text runs about 140 to 150 characters a line across the 1240 px card (Lessons 6 and 7). Lessons 5 and 7 print the address twice, once as bold text that is not a link and once as a link, and phone URLs break mid-path ("vocal-range- / test").
  - Where: Shots L07-phone-12, L06-phone-12, L06-desktop-10, -11, L07-desktop-10, L05-phone-13, L08-phone-13
  - Fix: Cap the measure at about 70ch; two or three short lines (what it does, how long, the care note); a named button ("Open the Vocal Range Test") with the address as secondary text.
  - Standard: Readability; WCAG 1.4.8 (AAA) spirit
  - **Status (Open):** Decided 22 Oct, in part: the lessons stay as long as they are and nobody trims them (another PR carries it out), so the card keeps its words. Still open: cap the measure at about 70ch, break the paragraph into short ones and name the button; do not cut it to two or three lines.

#### Webapp entry and wider web release

- [ ] **W-01** Home: "Learn" and "Lessons" sit side by side and open different things `BROWSER`
  - New this release: Home's header has "Learn" (the in-app walkthrough / read-along chapters), "Lessons" (Find Your Pitch, a separate site section) and "What's new". Two near-synonyms for different destinations; "Lessons" always opens Lesson 1 even for a returning learner, and has only a title tooltip to explain it (tooltips do not exist on touch).
  - Where: src/pages/HomePage.tsx:184-205
  - Fix: Rename one (for example "Find Your Pitch" or "Free lessons" for the series, "Tour" for the walkthrough); send returning learners to the lesson they were on.
  - Standard: Information architecture
  - **Status (Partly fixed):** Learn (the read-along chapters about the app) moved back to the sidebar, beside Guide and Tour, where the welcome tour's "Learn & Guide" step points. Home keeps Lessons and What's new. The native bundle probe now checks that Lessons is gone under the shell. Still open: Lessons still opens /learn/01 for everyone, a returning learner too.
- [ ] **W-03** The new karaoke-app page carries the Karaoke Night shell's axe failures `BROWSER`
  - /karaoke-app is new (404 in 0.9.21) and reuses the Karaoke Night shell: nested-interactive (serious: the credits toggle contains focusable elements), target-size (serious: the credits toggle's smallest space is 272 x 5.8 px), and two nav landmarks without unique names. The same three exist, unchanged from 0.9.21, on /karaoke-night, /karaoke and /vocal-remover.
  - Where: .kn-credits-toggle, .kn-topbar-links (Karaoke Night shell)
  - Fix: Make the credits toggle a button that does not wrap links; label the second nav ("Account", "Room links").
  - Standard: WCAG 4.1.2, 2.5.8, 1.3.1
- [ ] **W-04** Older entry-page issues (unchanged since 0.9.21) `BROWSER`
  - Guitar Night: a file input with no label (axe critical). Voice Mirror, Vocal Range Test, Voice Type Test and Singer Match: no main landmark and content outside landmarks (moderate). Drum Night: complementary landmarks inside others. Ear Lab: 19 buttons given role="listitem" (minor). Home exposes two level-1 headings ("MercuryPitch" and "Good afternoon"); the other entry pages correctly hide their prelude h1.
  - Where: Guitar Night .PRSdcG_fileInput; mirror app shell; Drum Night .NhgRsG_phraseCoach, .kQrBFW_coach; Ear Lab drill cards
  - Fix: Label the file input; wrap the Mirror pages in <main>; drop role="listitem" from buttons (wrap them in li).
  - Standard: WCAG 1.3.1, 4.1.2

#### Voice lessons 3, 5, 7 and 8 (microphone)

- [ ] **V-02** Silent takes use up the tries `CODE`
  - A take waits 6 s for a voice; a take with no voice still counts. Lesson 3 allows 3 tries per note, Lesson 5 3 per hold (then only "Done for today"), Lesson 7 3 takes per visit (then singing is closed with no explanation). A slow starter, or a screen-reader user still hearing the status, can lose them all.
  - Where: lesson-03/sing-take.ts:31; kit/take.ts:44; kit/hold-take.ts:40; lesson-05/hold-flow.ts:80, 96; lesson-07/sing-take.ts:42-48; lesson-07/siren-flow.ts:131-139
  - Fix: Do not count a take that heard no voice; wait longer on the first take; say why Start is gone.
  - Standard: WCAG 2.2.1
- [ ] **V-03** Microphone failures all say the same thing, with no retry `CODE`
  - Refused permission, no device, a microphone busy in another tab and a failed load all show "No microphone? Sing along anyway: ..." with no reason, no remedy and no retry; the briefing and Start are gone until reload.
  - Where: lesson-03/sing.ts:105-137, 241-244 (check Lessons 5, 7 and 8 for the same path)
  - Fix: Separate "Your browser didn't share the microphone" (how to allow it) from "No microphone found"; add "Try the microphone again".
  - Standard: WCAG 3.3.3 spirit
- [ ] **V-04** The live chart's description names the wrong note `CODE`
  - Its label stays "Merc's note A3 as a band" when the target moves to G3, B3, A4 or a moved note, and during Hold 2 it still carries Hold 1's reading.
  - Where: lesson-03/sing.ts:126, 296; lesson-03/sing-view.ts:78; lesson-05/sing.ts:190, 382; lesson-05/sing-hold.ts:118
  - Fix: Call chart.describe() with wordName whenever the target changes and when a take starts.
  - Standard: WCAG 1.1.1, 4.1.2
- [ ] **V-05** With sound off, Start plays the model silently and still listens `CODE`
  - Lesson 3: the toast says "Sound is off, so you'll see this one but not hear it." and a take opens for a note never heard.
  - Where: lesson-03/sing-take.ts:97; kit/sound.ts canPlay
  - Fix: Ask to turn sound on before Start, or do not listen until it is on.
  - Standard: Teaching; avoids a meaningless reading

#### Lesson 3, Match a note (draft)

- [ ] **L3-03** Live line grammar: "open and close 1 a second" `CODE`
  - "Singing, slowed 220 times: the folds open and close 1 a second." (also "2 a second", "1.1 a second").
  - Where: lesson-03/toy-folds.ts:99
  - Fix: "once a second" / "twice a second" / "1.1 times a second".
  - Standard: Grammar heard by every screen-reader user
- [ ] **L3-04** Third try still says "Try again" `CODE`
  - On a note's last try no Again is offered, yet the line says "We didn't hear a steady note that time. Try again at about speaking volume."
  - Where: kit/take.ts:64-65, 85; lesson-03/sing.ts:152-160
  - Fix: When no retry is left, end at the measurement or say "Next note when you're ready."
  - Standard: Instruction must match the UI
- [ ] **L3-05** Listen-only mode promises Merc sings all three notes `CODE`
  - "Good call. Merc sings all three notes, and nothing listens." Merc sings only when each button is pressed, and the buttons are named just "A3", "G3", "B3".
  - Where: learn/03.html:1336-1337, 1598-1612
  - Fix: "Press a note to hear Merc sing it."; name the buttons "Play A3" etc.
  - Standard: Clarity; WCAG 2.4.6
- [ ] **L3-06** Hold-only "Sing" is exposed as a toggle `CODE`
  - Sing works only press-and-hold but has aria-pressed. A screen reader's activate starts and stops it at once, and the live line ends on "Breathing: the folds are apart."
  - Where: lesson-03/toy-folds.ts:125-139; learn/03.html:716-725, 1859-1868
  - Fix: Let a click latch Sing on until pressed again; keep hold for pointers.
  - Standard: WCAG 2.1.1, 4.1.2
- [ ] **L3-07** Match and band handles move only by dragging `CODE`
  - No step buttons and no tap-to-set on the track; a tap inside the 64 x 48 handle moves it a few cents.
  - Where: lesson-03/toy-match.ts:82-97; lesson-03/toy-band.ts:110-120; kit/cents-slider.ts:87-95
  - Fix: Lower/Higher buttons, or set the value on a tap anywhere on the stage.
  - Standard: WCAG 2.5.7
- [ ] **L3-08** Cold open has no heading and comes after the recall `CODE`
  - The cold open follows the screen-reader-only "Recall from Lesson 2" h2 in the DOM, so it reads as part of the recall; Lessons 2 and 4 put the cold open first.
  - Where: learn/03.html:386-388 vs 418-556
  - Fix: A visually hidden h2 for the cold open; move the recall after it (MASTER-PLAN 4.2 item 4).
  - Standard: WCAG 1.3.1, 2.4.6
- [ ] **L3-09** Feeling words "Workable" and "Effortful" are hard for beginners `CODE`
  - They drive the safety flow ("Effortful" ends retries). LESSON.md already proposes "Easy / OK / Hard work / Uncomfortable".
  - Where: learn/03.html:1620-1651
  - Fix: Coach to decide the proposal.
  - Standard: Reading level; coach sign-off

#### Lesson 4, The major scale and home (draft)

- [ ] **L4-01** Hint asks for a button that is not there `CODE`
  - "Locked in. Play both, and watch the staircase." Step 3 has no "Play both" (Lesson 3 has one), and "watch" assumes sight.
  - Where: lesson-04/steps.ts:48
  - Fix: "Locked in. Play each one: the white keys from D, then the pattern from D."
  - Standard: Instruction must match the UI
- [ ] **L4-02** Step headings are statements, not orange's questions `CODE`
  - "Count the steps", "Two groups and a joint", "Start anywhere", "Name the stairs", "Ti leans home"; Lessons 2, 3 and 5 use questions.
  - Where: learn/04.html:869, 899, 931, 1057, 1092
  - Fix: "How big is each step?", "What if I start on D?", "Why does ti lean home?"
  - Standard: TEACHING-PLAYBOOK rule 4
- [ ] **L4-03** Move do changes do silently; group names speak the ♯ glyph `CODE`
  - Move do announces nothing and the ring keeps "Do: D3 · 147 Hz" until a scale plays. Group bracket names use the glyph ("Play the first group: D, E, F♯, G"), which some readers skip.
  - Where: lesson-04/sing.ts:90-97, 168-176; lesson-04/stairs-parts.ts:84-89
  - Fix: Announce "Do is E3" politely and relabel the ring; use wordName ("F sharp").
  - Standard: WCAG 4.1.3, 1.1.1
- [ ] **L4-04** Hidden hints are still read through aria-describedby `CODE`
  - "White keys only" always adds "Start on a white key to compare"; "Start the guide" still says "Play Merc's scale first" after it has played. Lesson 6's "Start the guide" does the same ("Play Merc's version first").
  - Where: learn/04.html:805, 1237, 1575; lesson-04/stairs-toy.ts:163; lesson-04/sing.ts:116-117; learn/06.html:1565, 1587; lesson-06/sing.ts:114
  - Fix: Add and remove aria-describedby with each hint's visibility.
  - Standard: WCAG 4.1.2

#### Lesson 5, Breath and a steady note (draft)

- [ ] **L5-02** "Press Play, then Slow" misses what it describes `CODE`
  - The scoop is over by 0.9 s at full speed, before Slow can be pressed (certainly by keyboard).
  - Where: learn/05.html:998, 1275; lesson-05/toy-hold.ts:195
  - Fix: "Press Slow, then Play, and watch the first second."
  - Standard: Confusing instruction
- [ ] **L5-03** The hold ends only when "the ring closes" `CODE`
  - "Sing, and hold the note until the ring closes." Nothing audible marks the end, so a blind singer has to count.
  - Where: lesson-05/sing.ts:71; learn/05.html:1500-1501; kit/hold-take.ts:48-49
  - Fix: "...hold the note for ten seconds, until the ring closes." Same for 15 s.
  - Standard: WCAG 1.3.3
- [ ] **L5-04** Sing it: status lines speak the ♯ glyph `CODE`
  - "Hold 1: ten seconds, on A♯3." and "Merc holds G♯3 for 10 seconds." use signName; holdSummaryFor already uses wordName.
  - Where: lesson-05/sing.ts:285, 385
  - Fix: Use wordName ("A sharp 3").
  - Standard: WCAG 4.1.3; series contract
- [ ] **L5-05** Scrub sliders move 0.01 s per arrow press `CODE`
  - Scrub the breath and Scrub the hold have max 1000 step 1 and no key handler; about ten presses announce the same value.
  - Where: learn/05.html:806-815, 1025-1034, 1976-1985
  - Fix: step="10", or arrows 0.5 s and Page keys 2 s as Push does.
  - Standard: WCAG 2.1.1 (usability)
- [ ] **L5-06** Grammar: "Keep Push still, and so does the line." `CODE`
  - After an imperative, "so does" has no verb to repeat.
  - Where: learn/05.html:1066-1067
  - Fix: "Keep Push still, and the line holds still too."
  - Standard: Grammar

#### Lesson 6, Intervals (draft)

- [ ] **L6-02** Recap says a perfect fifth opens "Twinkle, Twinkle" `CODE`
  - The tune opens on a repeated C; the fifth is its first leap. Step 5 "ask which tune starts that way" has the same problem for the mid-tune anchors. ("Auld Lang Syne" does open on the fourth.)
  - Where: learn/06.html:1064-1065, 1780-1782
  - Fix: "...a perfect fifth is the first leap in “Twinkle, Twinkle”"; "ask which tune leaps that way".
  - Standard: Music accuracy
- [ ] **L6-03** Mix-up card overstates the study `CODE`
  - "Versions with new sizes were recognised less often than ones that kept the sizes too." In Dowling and Fujitani (1971) the best version kept contour plus relative sizes (FACTS 34). The Plantinga and Trainor (2005) citation is an infant study used for an adult claim.
  - Where: learn/06.html:1027-1030, 1381-1385; lesson-06/quiz-questions.ts:121
  - Fix: "...kept which gaps were bigger and which were smaller"; "(as Plantinga and Trainor, 2005, summarize)".
  - Standard: Claims rule (FACTS)
- [ ] **L6-04** The h1 question is ungrammatical `CODE`
  - "Why can you start ‘Twinkle, Twinkle’ on any note and it is still the same tune?" (also in metas and Lesson 5's next card). Single quotes here, double elsewhere.
  - Where: learn/06.html:12, 32, 51, 75-76, 324; kit/season.ts:273; kit/lesson-copy.ts:95
  - Fix: "Why is “Twinkle, Twinkle” still the same tune, whatever note you start it on?"
  - Standard: Grammar; consistency
- [ ] **L6-05** "as do moved with home" reads as the verb `CODE`
  - "Only the letters change, as do moved with home in Lesson 4."
  - Where: learn/06.html:912
  - Fix: "...just as “do” moved with home in Lesson 4."
  - Standard: Beginner reading
- [ ] **L6-06** Ear games and quiz Q3 have no non-audio mode `CODE`
  - Step or leap?, Name it and Q3 ("Listen... a step or a leap?") are audio only, and Q3 counts toward the lesson-done mark. The test exception of WCAG 1.1.1 may cover the games.
  - Where: learn/06.html:838-885, 1303-1371; lesson-06/quiz-questions.ts:84-103
  - Fix: After each answer, draw the pair as two beads on rows; let Q3 show "C4 then F4" on request; do not hinge "done" on an ear-only item.
  - Standard: Deaf and hard-of-hearing learners
- [x] **L6-07** At 320 px the prerequisite chip is cut off `BROWSER`
  - "After Lesson 4: The major scale and home" runs to 327 px on a 320 px viewport and the body clips sideways overflow, so the end of the text is lost (it reaches 410 px with text spacing applied).
  - Where: learn/06.html hero meta chip; kit/lesson-base.css:533-537 (.chip-link) and body overflow-x: clip
  - Fix: Let chip text wrap (white-space: normal) and give .chip-link min-height 44px.
  - Standard: WCAG 1.4.10, 1.4.12
  - **Status (Fixed):** Prerequisite chips wrap (white-space: normal, line-height 1.25).

#### Lesson 7, Slides, sirens and your range (draft)

- [ ] **L7-01** Promise overclaims: "find your comfortable middle" `CODE`
  - The page never finds it: the checkpoint lights "the middle half of your siren", and FACTS 35 says the band is never a claim that anyone's comfort sits there.
  - Where: learn/07.html:32, 352-355
  - Fix: "...and learn where your comfortable middle lies".
  - Standard: FACTS 35, 59
- [ ] **L7-02** Two sentences readers will parse wrongly `CODE`
  - "the span books often give one voice type, such as tenor or alto" (reads "span books"); "Books draw them differently: two put the soprano's top seven semitones apart." (reads "the top seven semitones"; the sources are two Wikipedia articles).
  - Where: learn/07.html:444-446, 934-936, 2005-2006
  - Fix: "...books often give a voice type, such as tenor or alto, a span this size."; "Sources differ: one puts the soprano's top note at C6, another at G6, seven semitones higher."
  - Standard: Plain language; FACTS 40
- [ ] **L7-03** Try says "Slide Twinkle" but the controls are buttons `CODE`
  - "Slide “Twinkle” up and down the column, playing it as you go." The controls are Start lower, Start higher and Play “Twinkle”; drag is off for touch, so a phone user who tries to slide scrolls the page.
  - Where: learn/07.html:1047-1048; lesson-07/range-toy.ts:446-447
  - Fix: "Press Start lower or Start higher, then Play “Twinkle”."
  - Standard: Instruction must match the UI
- [ ] **L7-04** Visual-only cue: "Hum “ng” as the ring turns" `CODE`
  - The ring is visual, and under reduced motion it does not turn.
  - Where: kit/take.ts:189-190; lesson-07/sing-take.ts:19-21, 228-236
  - Fix: "We didn't hear you start that time. Start humming “ng” after you press Start."
  - Standard: WCAG 1.3.3
- [ ] **L7-05** "Show: the column's two ends" says nothing to screen readers `CODE`
  - It lights the ends for 1.8 s and announces nothing (the Types show does).
  - Where: learn/07.html:551-560; lesson-07/words.ts:215-221
  - Fix: Write a line: "The column's bottom end, then its top end: your lowest and highest notes".
  - Standard: WCAG 4.1.3, 1.1.1
- [ ] **L7-08** Lesson 7 marks "selected" in amber; every other lesson uses teal `DESIGN`
  - "Lower voice", "ng" and the free-play "Siren" tab are selected with an amber border, where Lessons 5 and 8, the predict choices and the explorer filters use teal. The tokens reserve amber for Merc's sung model while it plays. Figure labels such as the rotated "middle" (the lesson's key word) and "the ends" render at about 11 px, under the kit's own 12 px floor.
  - Where: Shots L07-phone-05, -06, L07-desktop-06, -11
  - Fix: Teal selected state; amber only for the target while it sounds; set "middle" horizontally at 12 px or more.
  - Standard: MASTER-PLAN 5 colour code; legibility

#### Lesson 8, Beat, tempo and the backbeat (draft)

- [x] **L8-05** Two sets of "Bars of 2 / 3 / 4" buttons in one step `BROWSER`
  - Step 3's stage toggles and its Count the bar answers share the same names but do different things.
  - Where: learn/08.html:737-759, 957-983
  - Fix: Name the answers "Answer: bars of 2" and so on.
  - Standard: WCAG 2.4.6
  - **Status (Fixed):** Count the bar's answers are named "2: answer bars of 2" and so on. Its fix now has a unit test (lesson-08/page.test.ts), which also checks that the answers share no name with the Bars toggles beside them.
- [ ] **L8-06** Teaching copy that the step does not support `CODE`
  - h3 "Why do musicians count to four?" is never answered (the step teaches 2, 3 and 4 equally); "this lesson's bars are 3/4 and 4/4" (it taught 2/4 too); "pad" names the tap button, the beat-row boxes and the grid cells; the hero caption still says the claps are on 1 and 3 after they move.
  - Where: learn/08.html:376-381, 699, 867, 913, 915, 1017, 1614-1616; lesson-08/cold-open.ts
  - Fix: "How do beats group into bars?"; "Of these, this lesson taught 3/4 and 4/4"; "pad" for the tap pad only; rewrite the caption when the claps move.
  - Standard: Playbook rule 4; FACTS 18, 53; WCAG 1.1.1
- [x] **L8-07** At 320 px the hero strip cuts its syllables `BROWSER`
  - Checked at 320 px: the strip's cells are about 21 px wide and clip "Twin", "twin", "How", "won", "what" (overflow hidden, nowrap).
  - Where: kit/lesson-beat-machine.css (.strip-cells .sc); learn/08.html:374-375
  - Fix: Drop the strip's metronome column under 360 px, or let the text shrink or wrap.
  - Standard: WCAG 1.4.10
  - **Status (Fixed):** Under 360 px the hero strip drops its metronome column, giving the beats the width.
- [ ] **L8-08** Timed tapping has no untimed route, and Count the bar is ear-only `CODE`
  - Nobody is locked out (the quiz marks the lesson done), but a learner who cannot tap in time gets only "On 2 and 4: N of 8"; Count the bar and quiz Q2 ("Listen. How many beats are in each bar?") have no visual mode.
  - Where: learn/08.html:944-947, 1015-1038, 1205-1213; lesson-08/quiz-questions.ts:57
  - Fix: "Can't tap in time? Build the backbeat on the grid in Step 4 instead." and a "Show the clicks" option that lights the beat-row boxes.
  - Standard: Motor and deaf/HoH inclusion
- [ ] **L8-10** Lesson 8's reveal button sits above its own predict `DESIGN`
  - Both hero play buttons sit above the predict card (on phones above the sound gate too), so "Locked in. Play with claps on 2 and 4." points back up the page. Lessons 1 and 5 to 7 put the locked reveal inside the card under the options.
  - Where: Shots L08-phone-00, -02, L08-desktop-00, -02; learn/08.html hero
  - Fix: Move the 2-and-4 button into the predict card; keep only the 1-and-3 demo above it.
  - Standard: Consistency; predict flow

#### Owner decisions

- [ ] **D-01** Dialect: the lessons are British, the app is American `CODE`
  - About 150 British forms across the 8 pages, the kit and the captions: "Practise" (card eyebrows and footers, about 30), "towards" (every Merc alt text), synthesised, recognised, analysed, labelled, colour, neighbour(ing), "round", "a GP", "straight away", "Metre and bars", punctuation outside quotes, single quotes, and JSON-LD "inLanguage": "en-GB" on every page. The app moved to American spelling in 0.9.18. lesson-copy.ts:32 and team-notes.ts:22 require British; LESSON.md records British as an owner decision (MASTER-PLAN 12 item 5).
  - Where: learn/0N.html; kit/lesson-copy.ts:32; kit/team-notes.ts:22; lesson-0N/assets/\*.vtt; each lesson's LESSON.md
  - Fix: Owner picks one. If American: one sweep with the film-sync caption test, en-US, and the two rule comments updated. The doctor line is coach-approved wording, so the coach sees any change.
  - Standard: House style (CHANGELOG 0.9.18)
  - **Status (Decided):** Decided 22 Oct: keep British English for now. If it changes later, it is its own PR: about 150 forms across the 8 pages, the kit strings, quiz and words modules, 2 caption files, the LESSON.md notes, the rule comments in kit/lesson-copy.ts and kit/team-notes.ts and the JSON-LD language, plus the film-sync caption tests and the coach for the doctor line.

### P3: Polish

#### Every lesson page (shared kit)

- [ ] **S-26** Pages keep redrawing at 60 frames a second while paused `BROWSER`
  - After "Pause animations" (and under reduced motion) requestAnimationFrame still runs about 60 times a second on every page, although screenshots 1.5 s apart are identical. Drawers without `wants` repaint static canvases: a battery cost on phones.
  - Where: kit/frame-loop.ts (drawers without `wants`)
  - Fix: Give the sky, string, dial and other static drawers a `wants` that is false while paused and unchanged.
  - Standard: Performance
- [ ] **S-27** Type is set in px; no prefers-contrast or reduced-transparency handling `CODE`
  - Zoom works (reflow at 320 px passed on 7 of 8 pages), but the browser's default font-size setting does not scale lesson text. Translucent masthead, bubbles and play disc; hairlines at 1.3 to 1.8:1.
  - Where: kit/lesson-base.css:80-87, 124, 169, 622-624; kit/lesson-stage.css:152-153; kit/lesson-sections.css:294-295
  - Fix: rem tokens; opaque surfaces and stronger hairlines under prefers-reduced-transparency / prefers-contrast: more.
  - Standard: Best practice beyond WCAG 1.4.4
- [ ] **S-28** Number and unit typography drifts `CODE`
  - "Lesson 01" (masthead, kicker, footer: read "Lesson zero one") beside "Lesson 1"; prose uses a narrow no-break space before Hz but buttons and TS strings use a plain space (can wrap "440 / Hz"); mono labels uppercase "Hz" to "HZ" (Lesson 1 "Hertz HZ" ticket, hero rail "440 HZ"); straight vs curly quotes; numerals vs words for measured values.
  - Where: kit/lesson-menu.ts:408; kit/explorer.ts:217-239; lesson-01/hero.ts:231; kit/lesson-base.css:249-288; kit/season.ts:54, 74, 166
  - Fix: One rule each: "Lesson 1" in text and names, U+202F before Hz and %, text-transform:none on unit spans, curly quotes.
  - Standard: SI symbol; consistency
- [ ] **S-29** Footer headings are h4 under h2 sections; arcs are list items `BROWSER`
  - Footer "Practise" and "Credits" are h4 right after h2 sections; the phone list puts arc titles among lessons; the mix-up aside is a complementary landmark inside main (axe: moderate, all pages), and Lesson 2 has two asides with the same name.
  - Where: learn/0N.html footer; kit/explorer.ts:393-410; learn/02.html:1156, 1336
  - Fix: h2 or styled p in the footer; arcs as headings outside the list; mix-up as a section or uniquely named asides.
  - Standard: WCAG 1.3.1 (best practice)
- [ ] **S-30** Pause animations looks the same on and off `BROWSER`
  - The switch never changes icon or word; the paused state is a teal ring (2.8:1 border difference). Under OS reduced motion it is disabled and pressed, which reads as active.
  - Where: kit/lesson-base.css:710-729
  - Fix: Swap to a play icon while paused (keep the fixed name and aria-pressed).
  - Standard: WCAG 1.4.1 risk
- [ ] **S-31** Small kit details `CODE`
  - Trailer node shows "0" but is named "Trailer: Find your pitch" (2.5.3 minor); lane filter changes nothing that is announced and uses aria-pressed for a one-of-three choice; quiz score "0 of 4" updates silently; key-strip tap zones go down to 40 px; bindCentsSlider sets no tabindex or name; the gate's text change is silent; the card's string pluck ignores Pause animations; chapters mark "current" only by class; the beat machine's Stop button shows a pause icon.
  - Where: kit/explorer.ts:341-345, 495-503; kit/quiz.ts:305; kit/key-strip.ts:69-72; kit/cents-slider.ts:53-57; kit/page-chrome.ts:40-46; kit/explorer-figures.ts:218; kit/episode.ts:350-356; kit/beat-machine.ts:386-392
  - Fix: Fix each in passing.
  - Standard: WCAG 2.5.3, 4.1.3, Apple HIG 44 pt

#### Lesson 1, What is a note? (live)

- [ ] **L1-06** Lesson 1 copy and readout polish `CODE`
  - Before any pluck the readout says "Swings 220" and "Time 1.0 s"; step 6 eyebrow "Fig. 6 The spiral, unrolled" shows before Unroll; arc label "A3 to A4: seven white keys" (eight keys; "apart" is missing); "per s" vs "per sec"; the string canvas is named "...Tap it to pluck it." (an image cannot be pressed; Pluck is the way); og and poster alt "Lesson 01, What is a note?, above a glowing five-line staff"; challenge "why a man and a woman singing..." (FACTS says lower and higher voices); transcript "Same letters, different turns" without the picture.
  - Where: lesson-01/toy-string.ts:366-373; lesson-01/toy-spiral.ts:24, 63; learn/01.html:42, 59, 606-610, 1419-1421; lesson-01/assets/lesson-01.en.vtt:210-212
  - Fix: "0" until plucked; "Fig. 6 From spiral to keyboard"; "seven white keys apart"; "a second"; "Press Pluck to pluck it"; "a lower and a higher voice".
  - Standard: Accuracy; inclusive wording
- [ ] **L1-07** Film lines to fix at the next re-voice `CODE`
  - Blue answers orange with a bare "No."; orange's "See you there." is not a question, guess or re-explanation.
  - Where: lesson-01/assets/lesson-01.en.vtt:79, 295
  - Fix: "Not quite." (as Lesson 2); recast the sign-off.
  - Standard: TEACHING-PLAYBOOK rule 3; MERC-BIBLE section 2
- [ ] **L1-08** Credits describe a film that is not on the page `BROWSER`
  - The live footer says "Voices in the episode: ElevenLabs (Eleven v3). Merc's sung notes in the film: stand-ins for now, made with ElevenLabs and retuned." The Watch section is hidden (no film published), and "stand-ins for now" reads unfinished on a public page (MERC-BIBLE: confirm rights before any public release). Same on Lesson 2.
  - Where: learn/01.html footer credits; learn/02.html footer credits
  - Fix: Show the film credits only when the film is published; owner to confirm the wording.
  - Standard: Content accuracy; rights (MASTER-PLAN 12 item 1)

#### Lesson 2, Twelve notes (live)

- [ ] **L2-08** Lesson 2 copy polish `CODE`
  - Description and JSON-LD say "Musicians use seven letters" where the h1 says "only use"; readout "Steps 12 · Hz × 2" is cryptic; "Then play ten rounds of Semitone or tone? below."; true minus on the canvas but hyphen on the monitor; the reveal's "(...one note per gap was a fair guess.)" shows to everyone; the guide ring says "Hum it back" while the page asks for "a hum or an ooh"; captions split "A / sharp 4" and start sentences with numerals; F's spoken value omits "E sharp" once written on it; the hero spiral's empty "NOTE" readout shows "—".
  - Where: learn/02.html:12, 76, 410-411, 487-488, 1246-1247, 982, 2024; lesson-02/keys-layer.ts:348; kit/sing.ts:90; lesson-02/assets/lesson-02.en.vtt:218-265, 331-346; lesson-02/keys-toy.ts:119
  - Fix: Restore "only"; "12 steps · 220 to 440 Hz"; "Then play the ear game below"; one minus; show the fair-guess line only to that guess; pass the "Your turn" ring words.
  - Standard: Consistency; plain words

#### Design and mascot

- [ ] **G-18** Layout and type polish (Lessons 1 to 4) `DESIGN`
  - "STEP 1 OF 6" printed twice; the Next button carries the whole next question and wraps to three lines; the translucent masthead shows content through; the asker's bubble is smaller and further right than the reply, and Lesson 2's tails point at the spiral; Lesson 3's h1 is about 48 px against about 70 px elsewhere; short names drift ("Major scale" / "The major scale and home"); the map legend looks like a radio group; Lesson 4's "S" label collides with the home icon and T/S have no key; footer legal links about 15 pt tall; Lesson 4's predict pill has about 3 pt side padding; long empty stretches between desktop steps (TASTE).
  - Where: Shots L01-phone-04, L02-phone-06, L02-phone-07, L01-desktop-00, L02-desktop-00, L03-desktop-00, L02-phone-14, L04-phone-06, L01-desktop-12, L04-phone-02, L01-desktop-05
  - Fix: See the design table in Appendix B.
  - Standard: Polish; Apple HIG 44 pt
- [ ] **G-21** Layout and type polish (Lessons 5 to 8) `DESIGN`
  - Lesson 5 puts the promise and gate before the stage, so no Merc is in its first paint (6 to 8 put the stage first); Lesson 8's recall hides behind a dashed disclosure that reads as a drop zone; free play has three layouts (inline tabs, a pill grid, none); "Tap / or press Space" is shown on an iPhone; the thin Outfit "1" reads like "]" (TASTE); "lip / trill" splits across lines and Lesson 6's lesson h2 is just "Intervals"; "M2 · 2" and "m2 · 1" differ only by letter case; Lesson 5's "35" has no unit and "IN THE BAND" sits on the band line; explorer edges about 1.4:1 and the selected node's white ring matches the "Done" legend dot; the health question sits apart from its answers on desktop; phone logo button about 27 pt; meta chips wrap raggedly; play-button tints encode who sings with no legend; the hook's size changes with its length (TASTE); about 300 px gaps between desktop steps (TASTE).
  - Where: Shots L05-phone-00, L08-phone-03, L05/L07/L08-desktop-11, L08-phone-05, L07-phone-04, L06-desktop-06, L05-phone-06, L05-L08-desktop-12, L05-L08-desktop-07, L07-phone-00
  - Fix: See the design table in Appendix B.
  - Standard: Polish; Apple HIG 44 pt

#### Webapp entry and wider web release

- [x] **W-02** Home header links are 36 px tall `BROWSER`
  - The new "Lessons" link (80 x 36 on a phone) joins "Learn" and "What's new", which were already under 44 px in 0.9.21. It is the only sweep warning that is new in this release.
  - Where: src/pages/HomePage.module.css (.headAction)
  - Fix: min-height: 44px on the three header actions.
  - Standard: Apple HIG 44 pt (WCAG 2.5.8 passes)
  - **Status (Fixed):** On touch screens the Home header pills and the sidebar's Learn, Guide and Tour are 44 px tall.
- [ ] **W-05** Sweep warnings across the app (unchanged since 0.9.21) `BROWSER`
  - Phone: Piano Night keyboard keys hit at 5 to 21 px wide; info buttons 20 x 20 ("How the streak works", Jam "?"); "Dismiss notification" 24 x 23; the header title 81 x 22; many settings tabs and chips at 30 to 38 px. Arial instead of Inter on Karaoke Night buttons ("Choose a song", "Sign in", "Sing this song", "Hide panel", voice control) and the Mirror's "Privacy: how your audio is handled". Ellipsis on Drum Night "4 beats", Piano Night "bars 1-4 · Afterglow Studio", Guitar "C Major Scale (C4)". Piano Night's phone nav overlaps its drawer. 437 PASS / 0 FAIL / 72 WARN, identical in both builds apart from W-02.
  - Where: the app-check sweep report
  - Fix: Fold into the next polish pass; none is a regression.
  - Standard: WCAG 2.5.8, Apple HIG 44 pt
- [ ] **W-06** Lessons need a network connection even in the installed app `CODE`
  - The service worker deliberately leaves /learn/\* to the network (STANDALONE_DOCUMENT_PATHS), so an installed-app user offline gets the browser's offline page.
  - Where: src/lib/sw-runtime.ts:131-150
  - Fix: Owner decision: precache published lessons, or show an offline note.
  - Standard: Product decision
- [ ] **W-07** 404 page: improved, one wording note `BROWSER`
  - The new error scene fixed the two landmark issues the old 404 had, links Lessons 1 and 2, and passes axe. "404 cents off" is a fun line for musicians but may puzzle a visitor who does not know cents.
  - Where: src/error-kit/
  - Fix: Optional: keep, or add a plain line under it.
  - Standard: Copy (TASTE)

#### Voice lessons 3, 5, 7 and 8 (microphone)

- [ ] **V-06** The only no-sing path is framed as illness `CODE`
  - "Sore, hoarse or unwell today?" leads to "Rest your voice" and the doctor lines; someone who simply cannot sing here (shared room, no voice today) gets illness copy. Shared mic and comfort lines are also copied into each lesson instead of the kit.
  - Where: learn/03.html:1305-1344; lesson-03/sing.ts:57-63; lesson-05/sing.ts:62-68
  - Fix: Coach: a neutral "Not singing today? Listen along" beside the health check; move shared lines into the kit.
  - Standard: Inclusion; one source for safety copy

#### Lesson 3, Match a note (draft)

- [ ] **L3-10** Lesson 3 polish `CODE`
  - "This time, 1 of the 1 note we heard landed in the band."; Notice says the readout shows "in the band" where it shows "right in the middle"; promise tense ("you'll know..., and you can sing"); "Done Lesson 2?"; the rerun "Again" restarts all three notes; "Swings" vs "open and close"; the chase scrub's valuetext does not update while playing; free play repeats the step sliders' names; slider labels contain their values; the recall drops Lesson 2's "1st/2nd" lit chips; free play has no heading.
  - Where: kit/take.ts:162; learn/03.html:362-366, 393, 701-708, 1256-1258, 1675-1679, 1803-1806, 1934-1978; lesson-03/toy-band.ts:217, 261-301; lesson-03/quiz-questions.ts:120
  - Fix: See the Lesson 3 table in the appendix.
  - Standard: Grammar; consistency

#### Lesson 4, The major scale and home (draft)

- [ ] **L4-05** Lesson 4 polish `CODE`
  - Try "Play the scale, then tap each stair" while the button is "Play up"; "Practise it in" vs "Practise in"; footer "tap it in the exercises"; og and twitter descriptions differ; quiz Q3 button named only "Play"; sr heading "Cold open: predict" is production jargon; "Stopped on ti" is announced but "Land on do" is not; free play has no heading.
  - Where: learn/04.html:32, 51, 411, 882, 1423, 1482-1488, 1687; lesson-04/quiz-questions.ts:35-36; lesson-04/cold-open.ts:72-85
  - Fix: See the Lesson 4 table in the appendix.
  - Standard: Label match; consistency

#### Lesson 5, Breath and a steady note (draft)

- [ ] **L5-07** Lesson 5 polish `CODE`
  - "Holds here are a fixed 5, 10 or 15 seconds" (this page offers 10 and 15); "then fifteen if that felt easy" ("Workable" also unlocks it); Voice Mirror card "hold any comfortable note for six seconds" (not a house length; on the coach list); FACTS 45 quotes a line the page no longer has; "Show: the dome flattens" says nothing to screen readers; the trace key omits the gold tick; "Play Merc's 15-second note" cannot be stopped; "Push 50%" label repeats its value.
  - Where: lesson-05/quiz-questions.ts:105; learn/05.html:363-365, 592-599, 722, 933-937, 1317, 1611-1620, 1809; docs FACTS.md:163
  - Fix: See the Lesson 5 table in the appendix.
  - Standard: Accuracy; consistency

#### Lesson 6, Intervals (draft)

- [ ] **L6-08** Lesson 6 polish `CODE`
  - "Lesson 1's two As" (read "two as"); h4 "Five to keep each with the short label Ear Lab uses" needs a comma; "step" is a semitone or tone and also a deck step ("Try Step 2 again"); og:description "Hear it from two notes"; numerals vs words ("up six semitones" vs "up 7 semitones"); "do is D3" vs "Do: D3"; at 1080 px and below Play from C is shown above Turn sound on but follows it in tab order; game and anchor cards are named sections (region landmarks); Name it plays steps only down and leaps only up.
  - Where: learn/06.html:32, 428, 818, 1089-1090, 1271, 1284, 1596, 1651; lesson-06/quiz-questions.ts:95; lesson-06/lesson-06.css:62-65; lesson-06/game-rounds.ts:108-114
  - Fix: See the Lesson 6 table in the appendix.
  - Standard: Consistency; WCAG 2.4.3

#### Lesson 7, Slides, sirens and your range (draft)

- [ ] **L7-06** Lesson 7 polish `CODE`
  - Single quotes in "‘a broad guide, not a verdict’"; stray comma "Play Merc's siren, on “ng”"; missing full stop "Play Merc's siren first"; "on two days a month or two apart"; "a third of the way up" clashes with the interval; quiz "Only if they're the same height" (pitch is height); "the voice type in Settings" (Settings says Singing Voice Range); hero caption omits the "the ends" labels; "Choose a voice to sing with" shown in listen mode; vertical push handle lacks aria-orientation; the in-step reveal is focused and live (read twice); no "microphone is off" after a normal take; two spoken note forms ("E 3" vs "G3"); "Play “Twinkle” on the column" overruns 320 px by 1 px.
  - Where: learn/07.html:404-408, 578, 700-711, 1039, 1086-1088, 1167, 1182-1183, 1304-1311, 1449, 1708; lesson-07/quiz-questions.ts:107; lesson-07/range-data.ts:313-317; lesson-07/sing.ts:271-298
  - Fix: See the Lesson 7 table in the appendix.
  - Standard: Consistency; screen-reader quality

#### Lesson 8, Beat, tempo and the backbeat (draft)

- [ ] **L8-09** Lesson 8 polish `BROWSER`
  - The metronome switch is named "Click" (reads as an instruction); sing-part divs carry aria-labelledby with no role (ignored; axe flags it); the beat-machine summary is read twice and steps 1-3 expose an empty "The beat grid's cells" group; "Tap every beat: bar 1 of 2" lacks a full stop; "every fourth beat, 1 2 3 4." vs "1 2, 1 2."; "All 8 landed" (8 what?); the fourth clap lands on the held "star"; "Rhythm is ... how they group into bars" mixes in metre; "Cadenza: your solo, on the beat" (a cadenza leaves the beat); "Choose an answer to unlock the sound." when only one play is locked; pressing the aria-disabled "Start the guide" does nothing visible; footer practise links are 22 px apart (axe target-size, also Lesson 6).
  - Where: learn/08.html:452, 459, 676-687, 839-845, 1151-1154, 1192, 1204, 1248, 1716-1723, footer; lesson-08/take.ts:45-46; lesson-08/bar-rounds.ts:37; lesson-08/take-judge.ts:45; lesson-08/sing.ts:221-225
  - Fix: See the Lesson 8 table in the appendix.
  - Standard: WCAG 2.4.6, 2.5.8; consistency
  - **Status (Open):** #1177 fixes two of these: the lock line names "the play button" where one play is locked (Lessons 2 and 8; it said "unlock the sound"), and the footer's practise links are 44 px tall (axe's target-size, on Lesson 6 too). The rest stay open.

#### Owner decisions

- [ ] **D-02** Dark-only lesson pages `CODE`
  - "Single dark theme by choice" (lesson-base.css): no light scheme while the app offers both. Some low-vision and astigmatic readers need dark text on light; Apple recommends supporting both appearances.
  - Where: kit/lesson-base.css:7, 13
  - Fix: Owner: keep and document, or add a light token set later.
  - Standard: Apple HIG Dark Mode; a11y preference
  - **Status (Decided):** Decided 22 Oct: keep the pages dark-only for now.
- [ ] **D-03** Italian section kickers on "No theory needed" pages `CODE`
  - "Cadenza: your solo...", "Ripresa: the theme comes back, from memory", "Coda: the closing bars" on every page, unexplained; Lesson 8's "Cadenza: your solo, on the beat" contradicts what a cadenza is.
  - Where: learn/0N.html section kickers
  - Fix: Owner: plain kickers ("Your turn", "From memory", "To keep") or keep as flavour with a gloss.
  - Standard: BRAND voice: never jargon-heavy (TASTE)
- [ ] **D-04** Orange Merc's name, pronouns and the film credits `CODE`
  - MERC-BIBLE section 8: orange Merc's name and pronouns are open, and the sung notes' rights must be confirmed before any public release. The live footer already credits "stand-ins for now" (L1-08).
  - Where: MERC-BIBLE section 8; learn/01.html, learn/02.html footer
  - Fix: Owner: decide before the films publish; until then drop the film credits from the pages.
  - Standard: MASTER-PLAN 12 items 1, 10
  - **Status (Partly decided):** Decided 23 Oct: orange Merc is Tavi, she, which overtakes 22 Oct's unnamed, with no pronoun (#1186 records both). Decided 16 Oct: the owner holds the rights to the voices and Merc's sung notes (MASTER-PLAN § 12 item 1). Still open: the film credits on the live pages (L1-08).

## Device test plan

Everything tagged DEVICE, plus the checks a headless browser cannot make. Each line is one sitting.

- [ ] **VoiceOver on iPhone, Safari.** Lessons 1 and 2 end to end: turn sound on; answer the predict and play it (is the answer read? S-01); swipe through a step on the phone deck and press Next (S-10, S-11); on the spiral and the keyboard, pick a note with swipe up and down, then double-tap: does the chosen note play? (S-08); move the ratio slider at 2.00 with swipe up (L1-03); answer the quiz; open the lesson menu; reach the season map; follow a practise link.
- [ ] **TalkBack on Android, Chrome.** The same walk as above, with the double-tap on the spiral and keyboard (S-08).
- [ ] **VoiceOver on Mac with Safari, and NVDA with Firefox or Chrome.** Lesson 8: press the tap pad with VO+Space (it counts once) and with Enter in browse mode (L8-01); is "Your taps" read? (L8-02). Predict reveals and toy results on Lessons 1 and 2.
- [ ] **Voice Control on iPhone.** Say "Tap Lesson 01" in the masthead (S-04) and "Tap P5" on Lesson 6 (L6-01).
- [ ] **Switch Control.** The tap pad on Lesson 8 and the spiral on Lesson 1.
- [ ] **Installed app on iPhone and Android.** Home, Lessons, then try to get back to the app (S-09).
- [ ] **A slow iPhone, by touch.** Tap the Ear Lab's pad and Lesson 8's pad 20 times each: each counts 20, so a click WebKit sends late is not a second tap (L8-01).
- [ ] **Real microphone with a screen reader on the speaker.** Lessons 3, 5, 7 and 8: does the screen reader's speech start or fill a take? (V-01)
- [ ] **iOS display settings.** Larger Text (Safari page zoom up to 200%), Bold Text, Increase Contrast, Reduce Transparency, Reduce Motion, Smart Invert (the Mercs and canvases should not invert badly), Differentiate Without Color.
- [ ] **Windows High Contrast.** Pressed states on choices, segmented toggles, the season map and Lesson 8's beat grid (S-05, S-16).
- [ ] **By ear.** Tap-pad latency and the beat machine's timing, the spiral and keyboard on touch, the sing ring's cues.

## Method

- Two local builds of main @ fd2166c: production-like (drafts hidden, as mercurypitch.com serves them) and drafts shown (as the dev site serves them), plus v0.9.21 for comparison. Served on loopback; the app-check fence blocked every non-local request, and nothing touched production or dev.
- axe-core 4.10.3 with the WCAG 2.0, 2.1 and 2.2 A and AA rules plus best practice, on all 8 lessons at 390 x 844 and 1440 x 900, and on 19 public entry pages in both builds.
- Playwright with Chromium 140: accessibility-tree snapshots of every lesson (the closest headless stand-in for what VoiceOver reads); a keyboard walk of every Tab stop checking visible focus and whether the stop is painted over; reflow at 320 px; WCAG 1.4.12 text spacing; emulated forced colors; reduced motion; a pause probe (running animations, animation frames, screenshot diffs); every step toy operated by keyboard with audio starts counted; targeted reproductions of every reported P1 that a browser can show.
- The repo's app-check sweep (27 screens, phone and desktop, light and dark) on both builds, diffed.
- Five code reviewers read every lesson page, module, caption file and FACTS / WEB-SPEC / LESSON document (Lessons 1-2, 3-4, 5-6, 7-8 and the shared kit). Two design reviewers looked at 242 section-by-section screenshots of the eight lessons (phone and desktop), sampling colours from the images; the P1 contrast and give-away findings were re-checked by hand.
- Not possible here: real screen readers on real devices, iOS Safari itself, a real microphone, judging audio by ear. Those items carry the DEVICE tag and are listed in the device plan.

## Appendix A: automated results

| Lesson | Page title                                                 | axe desktop | axe phone | contrast to check by hand (gradients) | Tab stops | No visible focus | Under 24 px | Under 44 px | Lost at 320 px                             | Lost with text spacing | Console errors |
| ------ | ---------------------------------------------------------- | ----------- | --------- | ------------------------------------- | --------- | ---------------- | ----------- | ----------- | ------------------------------------------ | ---------------------- | -------------- |
| 01     | What is a note? Find Your Pitch, Lesson 1 \| MercuryPitch  | 1 moderate  | none      | 263                                   | 45        | 1                | 0           | 1           | 0                                          | 0                      | 0              |
| 02     | Twelve notes: Find Your Pitch, Lesson 2 \| MercuryPitch    | 2 moderate  | none      | 370                                   | 75        | 1                | 0           | 2           | 0                                          | 0                      | 0              |
| 03     | Match a note: Find Your Pitch, Lesson 3 \| MercuryPitch    | 1 moderate  | none      | 281                                   | 63        | 1                | 0           | 2           | 0                                          | 0                      | 0              |
| 04     | The major scale and home · Find Your Pitch \| MercuryPitch | 1 moderate  | none      | 328                                   | 94        | 1                | 0           | 2           | 0                                          | 0                      | 0              |
| 05     | Breath and a steady note · Find Your Pitch \| MercuryPitch | 1 moderate  | none      | 284                                   | 63        | 1                | 0           | 3           | 0                                          | 0                      | 0              |
| 06     | Intervals: the distance between notes \| MercuryPitch      | 1 serious   | 1 serious | 320                                   | 125       | 1                | 0           | 2           | 1 (L6-07)                                  | 1                      | 0              |
| 07     | Slides, sirens and your range \| MercuryPitch              | 1 moderate  | none      | 275                                   | 72        | 1                | 0           | 2           | 1 (1 px, L7-06)                            | 0                      | 0              |
| 08     | Beat, tempo and the backbeat, explained \| MercuryPitch    | 1 serious   | 1 serious | 323                                   | 83        | 1                | 0           | 1           | 0 off-screen; strip syllables clip (L8-07) | 0                      | 0              |

Axe "moderate" on every page is `landmark-complementary-is-top-level` (the mix-up aside inside main); Lesson 2 adds
`landmark-unique` (two asides with one name); the "serious" on Lessons 6 and 8 is `target-size` on the footer's
stacked practise links. Every page also reports an incomplete `aria-valid-attr-value` (the lesson menu button's
aria-controls points at a dialog that is not in the DOM until opened). The "contrast to check" counts are text
over gradients that axe cannot measure; the kit reviewer computed every text token instead (lowest 5.32:1).

## Appendix B: design tables

The two design reviewers' tables, which G-18 and G-21 point to. Shot names (L01-phone-04 and so on) are the
review's screenshots, kept with the review; the code reviewers' tables are merged into the checklist above.

### Design review: Find Your Pitch, Lessons 1 to 4 (phone and desktop)

Reviewer scope: every `L01-*` to `L04-*` shot (118 shots), screenshots only. Lessons 1 and 2 are live and weighted most.

#### Verdict

1. The listening room holds together. Section heads, the quiz card, the step deck and the masthead are drawn the same way on all four pages. Colour is almost never the only carrier: the quiz uses icons plus "Right." / "Not quite.", and the explorer uses dashed rings plus text. The grey and coloured labels I sampled pass AA, at roughly 5.3 to 8.8:1.
2. The real weaknesses are how state and affordance are shown. The answered quiz does not mark which answer was yours. "Start lesson" at the end of each lesson is a 27 pt chip that looks like a status label. Sound is spread over three controls. On a phone, the bare "Pause" in the masthead reads as a sound control.
3. On a phone, the step deck puts each "Try:" instruction a full screen below the toy it refers to. That breaks the core loop on both live lessons.
4. Lessons 1 to 4 assemble the same parts differently: where the predict sits, the recall, the Merc dialogue, where the practise and next-lesson cards go, the play icons, and the Sing nav entry. The series colour code also leaks into metadata chips, titles and guide charts. Lesson 3's stage gives away its own predict answer.
5. No P0. There are 6 P1s to fix before release, and 5 of them affect Lessons 1 and 2.

Positions are in image pixels: phone shots are 780x1688 (2x, so divide by 2 for points); desktop shots are 1440x900 CSS px.

#### Findings

| Sev | Category                 | Lesson(s) / shot                                                                                                                                                                                                                                                                                                                                                                                               | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                               | Suggestion                                                                                                                                                                                                                                          |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | States                   | All four. L02-phone-11-check-answered y750-1130; L01-phone-10-check-answered; L02-desktop-09-check-answered x203-1309 y475-531; L04-desktop-10                                                                                                                                                                                                                                                                 | After a wrong pick, the brightest item in the question is the correct answer, which the learner did not choose: filled white check disc, bright border, raised fill. The learner's own pick gets a thin "x" in the same grey ring as an unanswered letter, and its text stays almost full white (sampled #b3b9bf, against #8a9096 for the third, unpicked option). Nothing says "your answer", so a quick glance reads the ticked card as "what I chose". | Tag both cards in text: "Your answer" on the pick and "Correct answer" on the right one. Give the wrong pick its own treatment, such as a filled ink-2 "x" disc with a solid border, and dim only the option nobody chose.                          |
| P1  | Affordance / Layout      | All four. L02-phone-13-wrap-more y1595-1648; L03-phone-11-wrap-more y397-451; L01-phone-11-wrap bottom edge; L02-desktop-11-wrap-more x125-243 y293-321                                                                                                                                                                                                                                                        | "Start lesson" in the Next lesson card is the main forward action at the end of a lesson. It is a roughly 27 pt tall bordered pill with a teal dot, styled like the "Ready · read" status pill, so it reads as a status label and is under the 44 pt target. The same label in the explorer detail is a full gradient button with a chevron (L02-phone-15 y508-596).                                                                                      | Use the gradient primary button with a chevron and a 44 pt minimum height. Keep the dot pill for status only.                                                                                                                                       |
| P1  | Affordance / Platform    | Every phone shot, masthead x478-648 y14-102 (for example L01-phone-00); desktop reads "Pause animations"                                                                                                                                                                                                                                                                                                       | On a phone the motion toggle is labelled just "Pause", and it sits directly beside the muted-speaker button. In a sound lesson that reads as pausing audio, and the toggled label (probably "Play") would read as playing sound. The deck also has its own "Pause turning" (L02-phone-05 y1490-1575).                                                                                                                                                     | Name it for what it does: a "Motion" label with the pause glyph, or "Still" / "Moving". Or move it into the lesson menu and keep a clearly distinct glyph in the bar. Make sure the accessible name is "Pause animations".                          |
| P1  | Hierarchy / States       | L1, live. L01-desktop-00-hero: masthead "Sound" plus muted icon x1241-1340 y8-50; gate "Turn sound on" x450-576 y805-848; lock line "Choose an answer to unlock the sound" x676-958 y795-810. L01-phone-02-predict-answered: "Turn sound on" still shown y433-519 while the Play buttons are already live y897-1090                                                                                            | Sound is spread across three controls and states on the first screen: the masthead toggle (whose label does not say on or off), the gate, and a lock that also talks about "unlock the sound". Once the learner has predicted, the Play buttons are enabled while the gate still says the sound is off, so they cannot tell whether pressing Play will make a sound. Lessons 2 to 4 repeat the masthead-plus-gate pair.                                   | Use one sound model. Either the gate is the only "on" switch and the masthead mirrors it with a state label ("Sound off" / "Sound on"), or the first Play press turns sound on and the gate goes away. Reword the lock as "Choose an answer first". |
| P1  | Layout / Hierarchy       | All four on phone. L02-phone-05-lesson: figure y840-1460. L02-phone-06-lesson-more: "TRY Tap A3, then the bead after it, then B3" at y735-830, with the figure already scrolled off (only "Pause turning" is left at y80-140). Also L01-phone-04/05 and L04-phone-06/07                                                                                                                                        | The deck is a single card on a phone, so the figure comes first and the step text, the "Try:" imperative and "Notice:" follow underneath. The instruction and the toy it refers to are never on screen together, so the learner has to read, scroll up, act, then scroll down for "Notice".                                                                                                                                                               | Put the "Try:" line inside the deck card, directly above or below the figure's controls. Alternatively, make the figure a compact sticky band on phones while the step text scrolls beneath it.                                                     |
| P1  | Hierarchy (pedagogy)     | L3: L03-desktop-00-hero stage tiles "TESTED 10-16% a semitone or more off" x1000-1316 y470-580, above "PREDICT BEFORE YOU SEE THE RESULT ... How many sang a semitone or more off?" y740-880. Phone: same order (L03-phone-02 y0-30 caption, predict y380-760). L2 (live) Next lesson card repeats the tiles (L02-desktop-11 x830-1315 y200-302)                                                               | The stage answers the hook and the predict before the learner commits to a guess, which undoes predict-then-reveal. Lesson 2's teaser for Lesson 3 gives away the same answer.                                                                                                                                                                                                                                                                            | Show only "ASKED 59%" before the predict. Reveal "TESTED" after the choice, as the reveal cards already do. In Lesson 2's card, drop the "TESTED" tile or replace it with a "?".                                                                    |
| P2  | States                   | L02-phone-01-menu-open y258-270 and top right "0 of 14 done"; L04-phone-01; L02-desktop-01 x287-709 y143-147                                                                                                                                                                                                                                                                                                   | The 14-segment bar beside "0 of 14 done" shows 8 teal segments, which is how many lessons are available, so it reads as 8 of 14 completed. Lesson 1 carries "Up next" while the learner is in Lesson 2, 3 or 4.                                                                                                                                                                                                                                           | Have the bar show done/current only, and mark availability with a separate dashed tail. Use "Not finished" or the step count on earlier lessons rather than "Up next".                                                                              |
| P2  | Layout                   | L4: L04-phone-01-menu-open y100-130                                                                                                                                                                                                                                                                                                                                                                            | The sheet opens already scrolled to the current lesson, so its header ("Find Your Pitch", "0 of 14 done") and the close "x" are out of view. "SEASON 1" is half cut under the masthead. Lesson 3's sheet (L03-phone-01) still shows them.                                                                                                                                                                                                                 | Keep the sheet header and close button sticky inside the sheet, and scroll only the list.                                                                                                                                                           |
| P2  | Consistency              | L01-desktop-00 and L02-desktop-00 nav "I Lesson II Explorer"; L03/L04-desktop-00 "I Lesson II Sing III Explorer"; ON THIS PAGE chips L02-phone-01 y350-437 versus L03-phone-01 y330-417; scroll-spy L02-desktop-07 to 11, L03-desktop-07 to 09, L04-desktop-09 to 12                                                                                                                                           | Lessons 1 and 2 have a "Sing it" section but no Sing entry in the nav or menu. On Lessons 1 and 2, "Lesson" stays highlighted through Sing, Quick check and Wrap. On Lessons 3 and 4, "Sing" stays highlighted through Quick check and Wrap.                                                                                                                                                                                                              | Give every page the same nav items, built from its sections. Either add Check and Wrap entries or clear the highlight past the last nav section.                                                                                                    |
| P2  | Affordance               | Hero chips L01-phone-00 y597-652, L03-phone-00 y568-765, L04-phone-00 y598-725; explorer TOPICS chips versus BUILDS ON / OPENS pills (L02-phone-15 y686-1190)                                                                                                                                                                                                                                                  | The static metadata chips ("10 minutes", "After Lesson 1: ...", "Sound on", "Microphone optional") are bordered pills, the same shape as the explorer's interactive filter chips and lesson pills. In the explorer detail, the static topic chips and the tappable prerequisite pills look nearly the same.                                                                                                                                               | Draw metadata as plain text with a leading icon, or as borderless tags. Keep bordered pills for things you can tap, and give the tappable pills a chevron.                                                                                          |
| P2  | Colour                   | Chip dots: L03-phone-00 "After Lesson 1" blue dot y585-620, versus violet on L02-phone-00 and L04-phone-00; L1 "No theory needed" violet; "Sound on" orange everywhere; "Microphone optional" amber. Practise title "Voice Mirror" in blue: L01-phone-07 y905-960, L03-phone-11 y680-735 (white on L02-phone-12 "Ear Lab's Leap"). "Look down" gold border: L02-desktop-06 x948-1096 y570-612                  | The series colours are applied outside their meanings: blue is Merc's note, orange is the other Merc's, violet is contrast, gold is "the fit" only. The same kind of chip changes colour from one lesson to the next, and a blue title reads as a link.                                                                                                                                                                                                   | Use neutral ink dots, or icons, for metadata. Keep practise titles in ink. Reserve the signal colours for diagrams and voice buttons.                                                                                                               |
| P2  | Colour                   | L1 (live) practise illustration L01-phone-07 y1440-1680: Mirror's target drawn blue, singer line white. L2 (live) sing guide L02-phone-08 y440-800 and L02-desktop-07 x815-1340 y198-388: Merc's path drawn dashed grey. L4 guide (L04-phone-09 y1525-1688) is solid amber                                                                                                                                     | MASTER-PLAN section 5: on a pitch canvas the model is the amber target and the singer is violet, and dashed ink-2 means the wrong guess or contrast case. Lesson 2 draws the model in the "wrong guess" style, and Lesson 1 uses blue (blue Merc's note) for an app's tone.                                                                                                                                                                               | Use the canvas set everywhere: amber target band, violet singer line. Save dashed ink-2 for contrast cases.                                                                                                                                         |
| P2  | Consistency / Affordance | L01-phone-02 "Play 220 Hz" and "Play 440 Hz" with coloured dots, "Play both" with a triangle (y897-1090); L01-phone-03 "Play 220 Hz" with a triangle; sing "Play it an octave up" with an orange dot (L02-phone-07 y1130-1240); menu "Sing it" uses a play triangle as its bullet (L02-phone-01 y1576); the reveal lines start with a triangle (L01-phone-02 y1160, L02-phone-02 y1157, L04-phone-02 y1627)    | The same action, playing a sound, is drawn with a dot in one place and a triangle in another. The triangle also marks a nav link and a static sentence, neither of which plays anything.                                                                                                                                                                                                                                                                  | Always put a play triangle on things that play. Show the Merc colour as the button tint or a small swatch next to the triangle. Use a mic or person glyph for "Sing it", and no glyph, or a check, for the "Locked in" line.                        |
| P2  | States                   | All four. L03-phone-09-check-answered "1 OF 4 [Try again]" y300-388 after a correct answer; L02-phone-11 y398-486; L02-desktop-09 x1190-1309 y356-400                                                                                                                                                                                                                                                          | "Try again" appears after the first answer, even a correct one, directly under "ONE TRY EACH, THEN THE REASON". It does not say whether it resets one question or the whole quiz.                                                                                                                                                                                                                                                                         | Show "Start the quiz again" only once every question is answered, or put a per-question retry on the question itself.                                                                                                                               |
| P2  | Affordance / Layout      | L2 (live): L02-phone-09-check y1610-1665; L02-desktop-08 x392-498 y613-638                                                                                                                                                                                                                                                                                                                                     | The "1st" and "2nd" pills beside "Play the two steps" are about 27 pt tall bordered pills. If they are buttons, they are too small. If they only light up as each step plays, they look like buttons.                                                                                                                                                                                                                                                     | If they are interactive, make them 44 pt "Play 1st" / "Play 2nd" buttons. Otherwise drop the borders and show them as a plain playback indicator.                                                                                                   |
| P2  | Affordance               | L2 (live): L02-phone-13-wrap-more y855-1117; L02-desktop-10 x785-1311 y610-732                                                                                                                                                                                                                                                                                                                                 | The interval grid in the practise card (m2 to P8) is drawn as bordered tiles, and m2 and M2 look selected. It reads as a control you can tap, but it is a static illustration (the caption says so in small mono).                                                                                                                                                                                                                                        | Draw it as a framed figure: no tile borders, the highlight as a tint, and the caption above the grid in sentence case.                                                                                                                              |
| P2  | Consistency / Affordance | Teal mono underlined link with an arrow (L02-phone-15 y1290-1330); blue underlined Inter link in the footer (L02-phone-16 y975-1005) and in quiz feedback "Try Step 2 again" (L02-desktop-09 x963-1087 y548-568); a bold grey URL that is not a link (L03-phone-11 y1215-1250), with the real link below at y1455-1490                                                                                         | There are three link styles plus a bold URL that looks like a link and isn't.                                                                                                                                                                                                                                                                                                                                                                             | Pick one in-content link style for all four pages. Remove the bold non-link URL, or make it the link.                                                                                                                                               |
| P2  | States                   | L02-phone-07-sing: disabled "Start the guide" y1268-1378, reason at y1545 onward after the health note; L02-desktop-07 button y583-637, reason y720-790; L04-phone-09 button y628-738, "Play Merc's scale first" y887-917 below the MOVE DO row                                                                                                                                                                | The disabled control and its reason are separated by another block (the health note on Lesson 2, the MOVE DO row on Lesson 4), and on Lesson 2 the reason is a long paragraph. The disabled button measures about 3.8:1.                                                                                                                                                                                                                                  | Put a one-line reason directly under the disabled button ("Play Merc's slide first") and move the longer explanation after it.                                                                                                                      |
| P2  | States                   | L2 (live): hero "NOTE" over a dash, L02-phone-00 y1095-1160 and L02-desktop-00 x830-870 y318-350; deck "LAST NOTE" over a dash, L02-phone-05 y866-930 and L02-desktop-05/06/11                                                                                                                                                                                                                                 | Empty readouts show a lone dash. In the hero it floats under Blue Merc's bubble at first paint and looks like a stray mark.                                                                                                                                                                                                                                                                                                                               | Hide the readout until the first tap, or put a hint in it ("Tap a bead").                                                                                                                                                                           |
| P2  | Hierarchy / Consistency  | L4: L04-phone-00 "Play the scale" y1278-1362 above the sound gate y1398-1688; L04-desktop-00 right column empty x650-1340 y530-900; predict moved to a separate cold section (L04-phone-02, L04-desktop-03)                                                                                                                                                                                                    | Lessons 1 to 3 open with the sound gate and then the predict under the title, as the plan asks. Lesson 4's first screen leads with a Play button above the gate, and the predict is not in the desktop first paint.                                                                                                                                                                                                                                       | Use the Lesson 1 to 3 order: gate, then the cold-open predict straight under the title, with Play locked until a choice is made.                                                                                                                    |
| P2  | Consistency              | L3: recall is a collapsed dashed disclosure in the hero, "Done Lesson 2? Two questions from it" (L03-phone-00 y1455-1568, where "it" wraps onto its own line; L03-desktop-00 x100-593 y757-800). L2 and L4: a full "Recall from Lesson N" section with a quiz card (L02-phone-03, L04-desktop-04)                                                                                                              | The recall check is a different component on Lesson 3. Folded away, it is easy to skip, and the plan wants it straight after the cold open from Lesson 2 on.                                                                                                                                                                                                                                                                                              | Use the Lesson 2 and 4 section on every page from Lesson 2 on.                                                                                                                                                                                      |
| P2  | Mascots / Consistency    | L1 to L3 heroes: full-body Mercs with speech bubbles over the stage (L01-phone-00 y730-1260). L4 cold open: bordered cards with roughly 20 pt avatar icons (L04-phone-02 y867-1200; L04-desktop-03 x742-1311 y227-380). L4 hero: both Mercs stand idle with no line (L04-phone-00 y1110-1220; L04-desktop-00). Sing ring: Blue Merc idle, "READY WHEN YOU ARE" (L01-phone-07 y160-640, L02-phone-08 y910-1365) | The dialogue component changes in Lesson 4, and the hero Mercs there are decoration (the Merc bible, section 5, says "mascots act; they don't decorate"). In the sing ring Merc waits, below the buttons, on phones.                                                                                                                                                                                                                                      | Use one dialogue component, the stage with bubbles. Give the Lesson 4 hero Mercs the cold-open lines or remove them. Animate the ring Merc only while he sings, and place him beside the Play button.                                               |
| P2  | States / Mascots         | L01-phone-02 y750-840; L02-phone-02 y855-942 (unchosen about 3.9:1); L04-phone-02 y1470-1555                                                                                                                                                                                                                                                                                                                   | Once answered, the unchosen option fades to about 3.9:1 and looks disabled. The reveal is a small grey line, and no Merc reacts to the guess, although the cold open is built on the two of them.                                                                                                                                                                                                                                                         | Keep the unchosen option at 4.5:1 or above (it is still information). Let a Merc react in the stage, for example Orange Merc saying "Wait, really?".                                                                                                |
| P2  | Typography               | Instructions in 12 px uppercase, letter-spaced mono: "TAP THE STRING TO PLUCK IT" (L01-phone-04 y1218-1246), "DRAG TO TURN · TAP A BEAD TO HEAR IT" (L02-phone-05 y895-952), "ONE TRY EACH, THEN THE REASON" (L02-phone-09 y545-575), statuses "COMING LATER · AFTER 5, 8, 9, 12" (L02-phone-16 y405-470), whole-sentence captions (L03-phone-04 y1328-1356)                                                   | Contrast passes (about 5.3 to 6.3:1). The problem for low-vision readers is that real instructions and sentences are set in 12 px caps with wide tracking, which removes word shapes, and it is worse on desktop at 1x.                                                                                                                                                                                                                                   | Keep mono caps for one- or two-word kickers. Set instructions, statuses and captions in Inter, 14 to 16 px, sentence case.                                                                                                                          |
| P2  | Layout                   | Explorer, phone: L02-phone-14 y1183-1503 ("What is a / note?", "READY · / AFTER 1"); L02-phone-16 y143-323 ("COMING / LATER · / AFTER 11"); L03-phone-14, L04-phone-17                                                                                                                                                                                                                                         | The two-lane list uses half-width cards, so titles and statuses break into two or three lines while the other lane sits empty beside them.                                                                                                                                                                                                                                                                                                                | Let a card span both lanes when the other lane is empty. Alternatively, use a single column with a Theory/Voice tag.                                                                                                                                |
| P2  | Consistency              | Practise card inside Sing on L1 (L01-phone-07) but in Wrap on L2 to L4. Next lesson card beside the recap on L1 and L3 (L01-desktop-09, L03-desktop-09), but after the practise card on L2 and L4 (L02-desktop-11, L04-desktop-12). Challenge under the recap on L1, to the right on L2 and L4 (L02-desktop-10 x744-1325 y325-400). Free play after Wrap on L2 to L4                                           | The same blocks move around from page to page, so a returning learner cannot predict where "next" or "practise" will be.                                                                                                                                                                                                                                                                                                                                  | Fix one Wrap template: recap, then challenge, then practise, then Next lesson (last, with the primary button). Fix one position for Free play.                                                                                                      |
| P2  | Layout / Hierarchy       | L4: L04-phone-08/09; L3 for comparison: L03-phone-06 y870-1688                                                                                                                                                                                                                                                                                                                                                 | Lesson 4's Sing has about 650 pt of copy before "Play Merc's scale", and its health check is a small callout. Lesson 3 opens Sing with a clear choice card ("I'm comfortable: let's sing" / "Just listen today"). The safety pattern differs between the two singing lessons.                                                                                                                                                                             | Reuse Lesson 3's check card on every sing section. Move Lesson 4's intro detail below the buttons, leaving two sentences above them.                                                                                                                |
| P3  | Layout                   | L01-phone-04 y665 and y1510; L02-desktop-05 x127-230 y414 and x668-770 y436                                                                                                                                                                                                                                                                                                                                    | "STEP 1 OF 6" is printed twice, once in the deck header and once as the step text kicker.                                                                                                                                                                                                                                                                                                                                                                 | Keep the deck counter and drop the kicker, or the reverse.                                                                                                                                                                                          |
| P3  | Layout                   | L02-phone-06 y1120-1275 ("Next: How many / steps until we're / back at A?"); L01-phone-05                                                                                                                                                                                                                                                                                                                      | The Next button carries the whole next question, so it wraps to two or three lines.                                                                                                                                                                                                                                                                                                                                                                       | Use "Next step" plus a short title (two to four words), and show the full question as the next card's heading.                                                                                                                                      |
| P3  | Platform                 | L02-phone-07 y0-140; L03-phone-06 y0-140; L04-desktop-08 behind the nav                                                                                                                                                                                                                                                                                                                                        | The masthead is translucent, so content (a gradient button, text) shows through behind "Pause" and the mute button.                                                                                                                                                                                                                                                                                                                                       | Use a more opaque masthead fill with a blur, or fade the content under it.                                                                                                                                                                          |
| P3  | Mascots                  | L01-desktop-00 and L03-desktop-00: Blue's reply bubble is larger and on the left (x672-987 y196-287), Orange's opening line is small at the far right (x1168-1316 y146-213). L02-desktop-00: bubble tails end about 250 px above the Mercs                                                                                                                                                                     | Who speaks first depends on a 50 px vertical offset. On Lesson 2 the tails point at the spiral, not at the hosts.                                                                                                                                                                                                                                                                                                                                         | Put the asker first in reading order (left or top), and keep each bubble's tail within about 40 px of its Merc.                                                                                                                                     |
| P3  | Typography               | L03-desktop-00 H1 about 46 to 50 px (y165-360), against about 70 px on L01, L02 and L04 desktop; small serif-italic metadata "Ready · 15 min" (L02-phone-13 y1365-1395) and the kicker tails                                                                                                                                                                                                                   | The display size drifts between lessons, and Instrument Serif italic at 14 to 16 px has thin strokes.                                                                                                                                                                                                                                                                                                                                                     | Clamp the hook H1 to a single fluid range. Set metadata smaller than 18 px in Inter.                                                                                                                                                                |
| P3  | Consistency              | Explorer "Major scale" versus menu "The major scale and home" versus L4 H2 "The major scale"; "PRACTISE IT IN MERCURYPITCH" (L03-phone-11) versus "PRACTISE IN MERCURYPITCH"; "Play 220 Hz" (L1) versus "Play: A to A♯" (L2 and L3)                                                                                                                                                                            | Names and label grammar drift from page to page.                                                                                                                                                                                                                                                                                                                                                                                                          | Use one short title per lesson everywhere, one kicker string, and one "Play: x" pattern.                                                                                                                                                            |
| P3  | Affordance               | L02-phone-14 y815-850; L01-desktop-10 x1080-1340 y410-432                                                                                                                                                                                                                                                                                                                                                      | The legend "Ready / Coming later / Done" sits directly under the filter chips and looks like a radio group.                                                                                                                                                                                                                                                                                                                                               | Title it "Key", make it smaller, and move it under the map.                                                                                                                                                                                         |
| P3  | Layout                   | L4: L04-phone-06 x668-716 y1000-1042                                                                                                                                                                                                                                                                                                                                                                           | On the top step, the "S" label collides with the home icon. The "T" and "S" letters have no key inside the figure.                                                                                                                                                                                                                                                                                                                                        | Move the T/S labels under the treads and add a one-line key ("T tone, S semitone").                                                                                                                                                                 |
| P3  | Platform                 | L01-desktop-12 y822-842; L02-phone-16 y1540-1572                                                                                                                                                                                                                                                                                                                                                               | The Privacy, Terms and Imprint links are text-sized hit areas, about 15 pt tall.                                                                                                                                                                                                                                                                                                                                                                          | Pad them to 44 pt.                                                                                                                                                                                                                                  |
| P3  | Layout                   | L4: L04-phone-02-predict-answered y1470-1555                                                                                                                                                                                                                                                                                                                                                                   | The selected option "Yes, still unfinished" fills its pill almost to the edge (text x78-372 inside a pill at x70-380, about 3 pt of side padding). With larger text settings it will clip.                                                                                                                                                                                                                                                                | Let the options stack full width on phones when a label is longer than half the row, or allow two lines with 16 px padding.                                                                                                                         |
| P3  | Layout (TASTE)           | L01-desktop-05 left column y60-320; L04-desktop-07 y100-415                                                                                                                                                                                                                                                                                                                                                    | The scrollytelling deck leaves large empty stretches in the text column between steps.                                                                                                                                                                                                                                                                                                                                                                    | The owner's call. Tighter spacing between steps would cut scrolling.                                                                                                                                                                                |
| P3  | Typography (TASTE)       | Section kickers "Cadenza:", "Ripresa:", "Coda:"; Roman numerals in the nav                                                                                                                                                                                                                                                                                                                                     | These are consistent across the four pages. "Ripresa" may be opaque to beginners.                                                                                                                                                                                                                                                                                                                                                                         | The owner's call. Consider plain tails ("Quick check: from memory").                                                                                                                                                                                |

Counts: P0 0, P1 6, P2 21, P3 12 (2 of them TASTE).

#### Contrast suspects to measure

Colours were sampled from the PNGs (darkest or lightest glyph pixel against the most common background pixel). Anti-aliasing means the true values may be slightly better.

- L02-phone-02-predict-answered x448-668 y880-918: the unchosen option "No, only some", text about #757a81 on about #191e25, about 3.9:1. The same applies to L04-phone-02 x436-676 y1494-1532 "No, only from C" (#73797f on #161b22, about 3.9:1) and L01-phone-02 "Same note" y750-840.
- L02-phone-09-check x68-94 y726-776: outline question numerals 1 to 4, a hairline about #6f757e on #1a1f26, about 3.6:1. Large, but the strokes are about 1 px.
- L02-phone-07-sing x137-389 y1300-1345: disabled "Start the guide", about #6c7278 on #10141a, about 3.8:1. Disabled text is exempt, but it carries the next step.
- L03-phone-04-lesson x452-520 y1432-1462: the 12 px mono "HOLD" inside the gradient "Sing" pill, about #293951 on about #72b1de (blue end), about 5.0:1. Measure again at the violet end of the gradient.
- L02-phone-11-check-answered x178-205: the chosen-wrong option text #b3b9bf, the dimmed option #8a9096 and the unanswered text (ink) differ by luminance only. Check that the three states are distinct, not just compliant.
- L02-phone-09-check x112-148 y968-1000: the quiz letter "A" in its ring, ink-3 #8d97a3 on #1e232a, about 5.3:1. This is the lowest ink-3 pairing I sampled. Re-measure on the raised or hovered option fill (L01-phone-09 and L02-phone-10, Q3 option A, which looks raised before any answer).
- Ink-3 #8d97a3 mono labels on panels #0e131d to #1b2026, about 5.5 to 6.3:1: "LAST NOTE" (L02-phone-05 y866-893), "TAP THE STRING TO PLUCK IT" (L01-phone-04 y1216-1248), "ONE TRY EACH" (L02-phone-09 y545-575), "COMING LATER" (L02-phone-14 y1002-1030). They pass, but check them at 1x on desktop.
- L02-desktop-05/06 x1080-1140 y625-770 and L02-phone-00 x510-560 y1265-1440: the spiral's C5/C4/C3 labels in small grey, overlapping beads and lines.
- L01-desktop-00 x923-1065 y340-425: the "440 HZ" and "220 HZ" mono labels beside the beads, over moving glow lines.
- L04-desktop-06/07 and 12: the staircase axis labels "C5" and "C6" in tiny grey mono (about #8d97a3 on #0f141f, about 6.2:1 on phone, L04-phone-06 x56-88 y994-1020). At 1x on desktop the glyphs are about 9 px tall.
- L02-desktop-10 x785-1311 y640-720: the interval tile sub-labels ("Minor 2nd" and so on) in grey at about 12 px, plus the mono caption at y740-770.
- L01-desktop-11 x1101-1297 y266-296: the episode caption "FROM THE EPISODE: THE TITLE CARD", 12 px mono grey.
- L02-phone-13 y1362-1398: "Ready · 15 min" in serif italic, about #8a97a6 on #1a1f26, about 5.6:1, with thin strokes. The same applies to the grey serif tails in every section kicker (about #8c96a2 on #0d1219, about 6.3:1).
- Health notes in sing sections, grey at about 14 px: L02-phone-07 y1415-1500, L04-phone-09 y1310-1465.

### Design review: Find Your Pitch, Lessons 5 to 8 (phone and desktop)

Reviewer scope: every `L05-*` to `L08-*` shot among the review's screenshots, phone (390 x 844 at 2x) and desktop (1440 x 900), plus `L01-phone-00-hero.png` and `L01-desktop-00-hero.png` as the series reference. Coordinates are image pixels (phone shots are 2x, so divide by 2 for points). Contrast figures were sampled from the PNGs and are approximate.

#### Overall verdict

1. The four pages share one solid kit: a calm dark room, the same section rhythm (serif kicker over an Outfit h2), honest locked states (lock icon plus a sentence), quiz feedback that never relies on red or green, and body text that samples at 6 to 9:1 throughout.
2. The newest lessons hold the best toys and the weakest marks. L07's siren line, the subject of its figure, is about 1.6:1, and L07 uses amber for "selected". L08 is the only lesson whose predict reveal sits outside, and above, its question.
3. The main class of defect is affordance. The lesson's forward action ("Start lesson") is a tag-sized chip identical to static facts, "Pause" and "Sound" in the masthead are ambiguous, and status and prerequisites ride on 12 px tracked mono caps.
4. Consistency drifts in many small ways: hero order (L05), recall (L08 collapsed), wrap order and practise card shape, four link styles, three play-button tints, a play triangle on "Show" buttons and on plain sentences, and lesson-type colours that contradict the series code.
5. The Mercs ask and answer well in the hero bubbles, with roles per the bible, but they stand small and idle at the edges, vanish below the hero, and the copy says "Merc" without saying which. There is no P0; fix the 2 P1s before publishing and take the P2s in the next pass.

#### Findings

| Sev | Category                             | Lesson(s) / shot                                                                                                                                                                                                                                                                   | Observation                                                                                                                                                                                                                                                                                                                                        | Suggestion                                                                                                                                                            |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Colour, non-text contrast            | L07 `phone-05-lesson` (line y 1105-1255), `phone-06`, `desktop-05/-06` (Fig. 1 and Fig. 2), `desktop-11` (Free play)                                                                                                                                                               | Merc's siren, the one mark each figure exists to show, is a thin dim-amber line (about #4b3a1f on #181f2c, roughly 1.6:1). The hatched ends, axis labels and "the ends" all out-read it; on a phone in daylight the hill disappears. WCAG 1.4.11 asks for 3:1.                                                                                     | Draw the idle siren at 3:1 or better (for example #f59e0b at 2 to 3 px, or ink-2 dashed until it plays) and keep the bright glow for playback.                        |
| P1  | Affordance, tap target               | Next-lesson card: L05 `phone-12`, L06 `desktop-11` (118 x 27 px at x 125, y 425), L07 `desktop-10/-11`, L08 `desktop-11` ("See it on the map")                                                                                                                                     | The end-of-lesson forward action "Start lesson" is a dot chip about 27 px tall (about 28 pt on phone). It is the same component as the static hero facts ("15 minutes", "Sound on"), so it reads as a status tag and is well under 44 pt.                                                                                                          | Use the series' real button (gradient primary with chevron, at least 44 pt). Keep dot chips for facts that cannot be tapped.                                          |
| P2  | Affordance, motion (HIG, WCAG 2.2.2) | Every phone masthead (e.g. L07 `phone-00`, top right); desktop masthead                                                                                                                                                                                                            | Phone: a bare "Pause" pill beside the muted-speaker button reads as "pause the sound", not "pause animations". It is the only motion control. Desktop: "Pause animations" is clear, but the sound button reads "Sound" with a struck speaker, so it is unclear whether it shows a state or offers an action.                                       | Phone: label it "Motion" with a pause icon, or move it into the menu. Sound: show state and action the same way on both sizes ("Sound off", with aria-pressed).       |
| P2  | States, affordance                   | Hero chips: L05/L06/L07/L08 `phone-00` and `desktop-00`                                                                                                                                                                                                                            | The requirement chip "Sound on" (orange dot) reads as a status, while the page is muted (masthead icon) and the gate below says "Turn sound on".                                                                                                                                                                                                   | Rename it "Needs sound" with a speaker icon, or drop it since the gate already says so.                                                                               |
| P2  | Hierarchy, next action               | L06/L07/L08 `phone-00` and `phone-02` vs L05 `phone-00`                                                                                                                                                                                                                            | On phone, the first control is a full-width "Play ..." pill above the sound gate, and the gate is below the fold. The obvious first tap is a play button that depends on a gate the reader has not seen. L05 shows the gate first.                                                                                                                 | Pick one order for the series. If a Play tap can unlock audio by itself, fold the gate into it; otherwise put the gate above the first play button.                   |
| P2  | Consistency, flow                    | L08 `phone-00` (y 1525-1688), `phone-02`, `desktop-00`, `desktop-02`                                                                                                                                                                                                               | Lesson 8 puts both reveal buttons above the predict card (on phone, above the sound gate too). The feedback "Locked in. Play with claps on 2 and 4." therefore points back up the page. L05 to L07 (and L01) put the locked reveal inside the card, under the options.                                                                             | Move the 2-and-4 button into the predict card like the other lessons; keep only the 1-and-3 demo above it.                                                            |
| P2  | Colour code                          | Chips in L05/L07 `phone-00` (After Lesson 3 is blue #58a6ff, After Lesson 2 is violet), L08 `phone-00` (Lesson 6 is violet #bc8cff); every `menu-open` shot (THEORY blue, VOICE orange #ff7448)                                                                                    | Lesson type is coloured twice, with opposite meanings: blue marks a voice prerequisite in the chips but Theory in the menu. Orange also marks "Sound on", and amber (#f49d0a) "Microphone optional". In the series code, blue and orange are the Mercs' notes and violet is the contrast case.                                                     | Use neutral dots or icons on chips. If lesson type needs a colour, take one non-signal pair and use it in chips, menu and explorer alike.                             |
| P2  | Colour code, consistency             | L07 `phone-05/-06`, `desktop-06` ("Lower voice", "ng"), `desktop-11` ("Siren" tab)                                                                                                                                                                                                 | Selected segments and the selected Free-play tab are amber (border about #bb7b10; scrub knob #f59e0b). Every other lesson marks selection in teal: L05 "Quiet" and "Push", L08 "Bars 4", the predict choice, the explorer filter. The tokens reserve amber for Merc's sung model while it plays.                                                   | Use the teal selected state; keep amber for the target while it sounds.                                                                                               |
| P2  | Mascots, copy                        | L06 `desktop-02` ("then Merc sings it"), L06 predict ("Merc moves the whole tune"), L06 `phone-08` Q1 ("Merc sings the first line"), L07 `phone-05` ("Merc's siren: E3 up to C#4"), L05 `phone-12` next-lesson line                                                                | With two named hosts on screen, the copy says "Merc" alone, so the reader cannot tell who sings or who moves the tune.                                                                                                                                                                                                                             | Say "blue Merc" (per the bible he sings the model) or "orange Merc" every time.                                                                                       |
| P2  | States, quiz feedback                | L07 `phone-10` (B at y 845-980), L05 `desktop-09`, L06 `phone-10`, L08 `phone-11`                                                                                                                                                                                                  | After a wrong pick, the correct option gets the strongest mark (filled check, bright border). The learner's own choice gets only a thin x in an outline circle, barely distinct from the untouched third option (text #b3b9bf vs #899096).                                                                                                         | Mark "Your answer" explicitly (label, filled x, own border) and keep the check on the right answer.                                                                   |
| P2  | Affordance, labels                   | L06 `desktop-09` ("1 OF 4" plus "Try again" after a right answer), L05 `phone-11`, L07 `phone-10` ("Try again" button plus inline "Try Step 1 again" link)                                                                                                                         | The quiz says "One try each, then the reason", then shows "Try again" next to the score, even after a correct answer. On L07 it sits beside a "Try Step 1 again" link that means something else.                                                                                                                                                   | Rename it "Start over" (or "Reset quiz") and show it only once every question is answered.                                                                            |
| P2  | Navigation, sticky elements          | L06 `desktop-01` (header half cut), L07 `desktop-01` and L08 `desktop-01` (header gone), L05 `phone-01` (tabs cut by the masthead), L07 `phone-01` ("You are here" card under the masthead)                                                                                        | The lesson menu auto-scrolls to the current lesson and takes its own header with it. The title, "0 of 14 done", the progress bar and the close x are cut off or missing on open; only L05 desktop is clean.                                                                                                                                        | Pin the menu header and the "You are here" card, and scroll only the list.                                                                                            |
| P2  | States, progress                     | L05 `desktop-01`, L06 `desktop-01` (x 270-730, y 70-160)                                                                                                                                                                                                                           | "0 of 14 done" sits on a 14-segment bar with 8 teal segments (the current lesson brighter), which reads as 8 of 14 complete.                                                                                                                                                                                                                       | Fill only done segments, draw ready ones as outlines, and make the bar match the number.                                                                              |
| P2  | Typography, low vision               | Explorer `phone-14/-15` ("COMING / LATER · / AFTER 10"); menu "THEORY · LESSON 1"; quiz "ONE TRY EACH, THEN THE REASON"; deck "STEP 1 OF 5" (all four lessons)                                                                                                                     | Status, prerequisites and instructions ride on 12 px uppercase mono with .18em tracking. Contrast is fine (about 5 to 6:1), but caps, tracking and mono at 12 px make this the hardest text on the page, and it wraps to two or three lines in narrow cards.                                                                                       | Keep tracked caps for decorative kickers only. Set status, prerequisite and instruction text in 14 px sentence-case Inter.                                            |
| P2  | Layout, phone                        | Explorer: L05 `phone-14/-15`, L06 `phone-13/-14`, L07 `phone-13/-14/-15`, L08 `phone-14/-15`                                                                                                                                                                                       | The phone explorer alternates half-width cards between two lanes. Titles wrap ("What is a / note?"), status wraps to three lines, and half of every row is empty.                                                                                                                                                                                  | Use one full-width list with a Theory or Voice tag per row; the plan's "two-lane list" can be a tag rather than a column.                                             |
| P2  | Readability, line length             | L07 `phone-12` (19-line grey paragraph), L06 `phone-12`, L06 `desktop-10/-11` and L07 `desktop-10` (about 140 to 150 characters per line across the 1240 px card)                                                                                                                  | The "Practise in MercuryPitch" card is a wall of grey text, and on desktop it runs at about twice a comfortable measure.                                                                                                                                                                                                                           | Cap the measure at about 70ch, split into two or three short lines (what it does, how long, care note), and make the link a button.                                   |
| P2  | Affordance, links                    | L07 `phone-12` and `desktop-10` (bold "mercurypitch.com/vocal-range-test" inside the paragraph, then the same URL as a link), L05 `phone-13`; wrap links teal mono, not underlined; explorer PRACTISE teal mono, underlined; footer and L07 quiz feedback blue #58a6ff, underlined | There are four link treatments. One URL appears twice: once as bold text that does not look like a link, once as a link. Blue is also blue Merc's note. (The practise title is blue on L05/L07 phone and white elsewhere; check whether that is a stuck hover state from the capture.)                                                             | Use one link style (teal, underlined) everywhere and drop the bold duplicate URL.                                                                                     |
| P2  | Icon use, consistency                | L07 `phone-04` and `desktop-04` ("Show: the column's two ends" and "Show the six voice types", both with a play triangle) vs L05 `desktop-04` ("Show: the dome flattens", no icon)                                                                                                 | In L07 the play triangle sits on "Show" buttons that play no sound; in L05 it does not.                                                                                                                                                                                                                                                            | Use the triangle only for sound; give "Show" an eye or diagram icon, or none.                                                                                         |
| P2  | Typography, figure legibility        | L07 `phone-05` (x 126-152, y 1130-1220), `desktop-05/-06`, `desktop-11`                                                                                                                                                                                                            | The lesson's key word, "middle", is a rotated mono label of about 11 px inside the column. "the ends" and the note names are also about 11 px, below the kit's own 12 px floor.                                                                                                                                                                    | Set "middle" horizontally beside the column at 12 px or more (a bracket plus a label); hold every figure label to 12 px minimum.                                      |
| P3  | Consistency, hero order              | L05 `phone-00` vs L06/L07/L08 `phone-00` and L01 `phone-00`                                                                                                                                                                                                                        | L05 puts the promise and the sound gate before the stage, so no Merc appears in its first paint. L06 to L08 (and L01) put the stage first and the promise after the predict card.                                                                                                                                                                  | Choose one order. Prefer stage first, as in L01, with the one-line promise straight under the chips (as in MASTER-PLAN 4.2 item 1).                                   |
| P3  | Mascots (size: TASTE)                | L06/L07/L08 `phone-00` vs L01 `phone-00`; L07 `phone-00` bubble tails                                                                                                                                                                                                              | Phone Mercs shrink from about 150 pt (L01) to about 35-45 pt, idle at the far edges below the bubbles. Bubble tails point at the other bubble or the diagram rather than the speaker (L07: orange tail at x 540, orange Merc at x 640). Neither Merc appears below the hero, not even at the reveal, the quiz or the sing check.                   | Point each tail at its Merc. Give them a reacting moment later (predict reveal, quiz feedback, sing), or record that small-at-the-edge is intended (bible section 5). |
| P3  | Consistency, recall                  | L08 `phone-03` and `desktop-03` vs L05/L06/L07 `-03-recall`                                                                                                                                                                                                                        | L08's recall is collapsed behind a dashed-border disclosure ("Done Lesson 6? Two questions from it", with an orphan "it" on phone). The dashed outline reads as a placeholder or drop zone; the other lessons show the quiz open.                                                                                                                  | Use a solid outline button with a chevron, and say why it is optional ("Optional: from Lesson 6").                                                                    |
| P3  | Consistency, wrap                    | L05 `desktop-10` and `phone-12/-13` vs L06/L07/L08 `-10/-11`                                                                                                                                                                                                                       | L05's wrap pairs three lines and the challenge with the next-lesson card, then practise. L06 to L08 pair three lines with the challenge, then practise, next lesson and free play. Kickers vary ("PRACTISE IN" vs "PRACTISE IT IN"; "FREE PLAY:" vs "FREE PLAY"). Only L05 and L07 include "Ten minutes, gently, most days" and a standalone link. | Use one wrap template and one set of kicker strings.                                                                                                                  |
| P3  | Consistency, free play               | L05 `desktop-11` (inline tabs, teal), L07 `desktop-11` (3 + 2 grid of full-width pills, amber), L08 `desktop-11` (no tabs)                                                                                                                                                         | The same "Free play" component has three layouts.                                                                                                                                                                                                                                                                                                  | Use one segmented tab style with a teal selected state.                                                                                                               |
| P3  | Icon use                             | Every `-02-predict-answered` ("Locked in. ..." with a triangle bullet); every `menu-open` ("Sing it" row)                                                                                                                                                                          | A play triangle bullets a plain sentence and a menu row. In the feedback it looks like a small disabled play button.                                                                                                                                                                                                                               | Use no bullet (or a check or arrow) on text; keep the triangle for sound.                                                                                             |
| P3  | Affordance                           | Explorer cards (TOPICS boxes, L05-L08 `desktop-13`); L08 `phone-00` beat grid (syllable boxes, y 1275-1460)                                                                                                                                                                        | Static topic boxes and syllable boxes have borders and radii like buttons.                                                                                                                                                                                                                                                                         | Remove the border from static items, or make them do something (a syllable could play its beat).                                                                      |
| P3  | TASTE: Typography, numerals          | Step heads ("1 STEP 1 OF 5") and quiz numbers in every `lesson` and `check` shot                                                                                                                                                                                                   | The thin Outfit "1" with its flag reads as a bracket "]" at this size.                                                                                                                                                                                                                                                                             | Use the mono numeral, or a heavier weight.                                                                                                                            |
| P3  | Redundancy                           | Every `phone-*-lesson-more`                                                                                                                                                                                                                                                        | Phone shows "STEP 1 OF 5" twice: in the card header and again in the step head.                                                                                                                                                                                                                                                                    | Keep one counter on phone.                                                                                                                                            |
| P3  | Layout, labels                       | L05 `phone-07` ("Next: So what does my diaphragm actually do?" on three lines), L08 `phone-05/-06` (two lines)                                                                                                                                                                     | The Next button carries the full next-step title and wraps.                                                                                                                                                                                                                                                                                        | Label it "Next step" with the title as a small caption.                                                                                                               |
| P3  | Platform polish                      | L08 `phone-05/-06` ("Tap / or press Space"), `phone-07` ("Tap or press Space")                                                                                                                                                                                                     | A keyboard hint is shown on an iPhone.                                                                                                                                                                                                                                                                                                             | Hide the hint on coarse pointers.                                                                                                                                     |
| P3  | States, empty readout                | L05 `desktop-06` ("NOW" readout showing a lone dash) vs L08 `desktop-06` ("YOUR TAPS / tap four times")                                                                                                                                                                            | L05's empty readout is a dash; L08's is an instruction.                                                                                                                                                                                                                                                                                            | Put an instruction ("Press Play") in every empty readout.                                                                                                             |
| P3  | Typography, headings                 | L07 `phone-04` ("Range, siren, lip / trill, voice type"), L06 `phone-04` (h2 stops at half width), L06 `-05-lesson` h2 "Intervals"                                                                                                                                                 | Balanced wrapping splits the term "lip trill". L06's lesson h2 is one word, where the other lessons use the full title.                                                                                                                                                                                                                            | Put a non-breaking space inside compound terms; use the full title in L06.                                                                                            |
| P3  | Layout, phone                        | L06 `phone-12` ("mercurypitch.com/ / pitch-training"), L07 `phone-12` ("vocal-range- / test"), L08 `phone-13`                                                                                                                                                                      | URLs break mid-path on phone.                                                                                                                                                                                                                                                                                                                      | Name the link ("Open Interval Trainer") and show the URL as secondary text.                                                                                           |
| P3  | Copy, cryptic labels                 | Explorer card chip "Ready · read" (all lessons); explorer `desktop-12` "Voice 6 LESSONS + 14"; L08 `desktop-11` "Click" toggle; L06 `desktop-06` and `-11` (a return-arrow glyph at the line end; "M2 · 2" vs "m2 · 1", major and minor told apart only by letter case)            | Several labels make the reader decode them.                                                                                                                                                                                                                                                                                                        | Use "Ready · not started", "6 lessons, plus Lesson 14", "Metronome click" and "tone / semitone"; drop the arrow glyph or caption it.                                  |
| P3  | Figure clarity                       | L05 `phone-06` (Fig. 1 Push: "IN THE BAND" at y 930-955 sits on the band line; the "LOUDNESS" tab cuts the strip border; two bare "35" labels), `desktop-05`                                                                                                                       | The labels crowd the band, and "35" (cents) has no unit.                                                                                                                                                                                                                                                                                           | Offset the label, inset the tab, and write "plus or minus 35 cents" once.                                                                                             |
| P3  | Colour, non-text                     | Explorer `desktop-12`, all four lessons                                                                                                                                                                                                                                            | Unselected prerequisite edges are about 1.4:1. The selected node uses a white ring, close to the legend's white "Done" dot.                                                                                                                                                                                                                        | Raise the edges to 3:1, or lean on the text ("Builds on"); mark selection in teal.                                                                                    |
| P3  | Layout, sing                         | L05/L06/L07 `desktop-07`, L08 `desktop-07`                                                                                                                                                                                                                                         | "Before you sing: how is your voice today?" sits as a pull quote in the left column, while its two answers are in the right-hand card. L08's sing card leaves the right third of the column empty.                                                                                                                                                 | Make the question the heading of the health card.                                                                                                                     |
| P3  | Polish, masthead                     | L06 `phone-07` and L07 `phone-07` (a gradient button glows behind "Pause"), L06 `desktop-07/-08` (text ghosting under the wordmark)                                                                                                                                                | The translucent masthead lets busy content show through behind its controls.                                                                                                                                                                                                                                                                       | Make the masthead more opaque, or blur it more, under the controls.                                                                                                   |
| P3  | Tap targets                          | Phone masthead logo button (53 x 53 px, so about 27 pt, at x 49-102 in L07 `phone-00`); footer Privacy, Terms and Imprint; inline text links                                                                                                                                       | These look smaller than 44 pt.                                                                                                                                                                                                                                                                                                                     | Give them a 44 pt hit area.                                                                                                                                           |
| P3  | Menu state                           | Every `menu-open` shot                                                                                                                                                                                                                                                             | The "Up next" pill sits on Lesson 1 while the reader is on Lesson 5, 6, 7 or 8.                                                                                                                                                                                                                                                                    | Hide "Up next" while a lesson is in progress.                                                                                                                         |
| P3  | Hierarchy                            | L05 `phone-00` (5 chips over 3 rows, baselines 2-4 px apart), L06 `phone-00` (one chip per row)                                                                                                                                                                                    | The meta chips wrap raggedly.                                                                                                                                                                                                                                                                                                                      | Shorten them ("After Lesson 4") and leave the title to the menu.                                                                                                      |
| P3  | Colour semantics                     | L05 `phone-02` (violet "Play: sung easily"), L06/L07/L08 heroes (blue), L06 `desktop-08` (Q1 blue, Q3 neutral), L05 `desktop-04` (violet and neutral in one section)                                                                                                               | The tints encode who sings (blue for Merc, violet for the singer's line), but with no legend they read as primary vs secondary.                                                                                                                                                                                                                    | Use neutral play buttons with a small dot or label for who sings, or document the rule.                                                                               |
| P3  | Typography, small serif italic       | L06 `desktop-11` ("Ready · 16 min", about 15 px), L08 `desktop-11` ("Coming later"), section kicker tails such as "two questions, asked afresh"                                                                                                                                    | Hairline Instrument Serif italic at 15-16 px in grey (about 5.2:1) carries state ("Coming later").                                                                                                                                                                                                                                                 | Set state in Inter; keep the serif at 18 px or larger.                                                                                                                |
| P3  | TASTE: Type scale                    | L05 `desktop-00` (h1 about 50 px over 4 lines) vs L06/L07/L08 `desktop-00` (about 72 px)                                                                                                                                                                                           | The hook's display size changes with the length of the text.                                                                                                                                                                                                                                                                                       | Fix one size, or accept it as fluid.                                                                                                                                  |
| P3  | TASTE: Rhythm                        | L06 `desktop-06`, L07 `desktop-06`                                                                                                                                                                                                                                                 | The sticky-figure layout leaves about 300 px blank in the text column between steps.                                                                                                                                                                                                                                                               | Tighten the space between steps.                                                                                                                                      |

Counts: P0 0, P1 2, P2 17, P3 26 (three marked TASTE, plus the Merc size point).

#### Contrast suspects to measure

Values were sampled from the screenshots (most common background pixel against the text core) and are approximate; please confirm in the browser.

1. L07 `phone-05-lesson.png` (x 200-725, y 1105-1255), `desktop-05/-06` (x 750-1310), `desktop-11`: the siren line, dim amber about #4b3a1f on about #181f2c, roughly 1.6:1. This is a graphical object needed to understand the figure, so it needs 3:1.
2. L05 to L08 `desktop-12-explorer.png`: unselected prerequisite edges, about #33373e on #171c23, roughly 1.4:1; dashed "coming later" rings are similarly faint.
3. L05 to L08 `-02-predict-answered` (e.g. L07 `phone-02`, x 450-665, y 900-945; L06 `desktop-02`, x 880-1100, y 476-497): the unchosen option after locking in, about #747a81 on #1a1f26, roughly 3.8:1 at 18 px regular. It passes only if it counts as an inactive control.
4. L06 `desktop-00-hero.png` (x 718-818, y 832-853) and L08 `phone-00-hero.png` (x 218-616, y 1648-1688): locked reveal button labels "Play from F#" and "Play with claps on 2 and 4", about #6d7379 on #161e28, roughly 3.4-3.5:1. Exempt while disabled, but this is the next action's label.
5. `-check-answered` phone shots (e.g. L07 `phone-10`, x 100-160, y 1050-1095): letter badges (A, B, C) in dimmed options, about #575f68 on #1c2027, roughly 2.5:1.
6. L07 `phone-05` and `desktop-05`: figure labels "the ends" and C5 to A2, ink-3 #8d97a3 on about #0f1520 (roughly 6:1, passes); "middle", #a8b3bf on hatched #373d48 (roughly 5.1:1). Both render at about 11 px, so check size as well as contrast.
7. L08 `desktop-11-wrap-more.png` (x 442-480, y 632-646): beat-machine row labels KICK, CLAP, HI-HAT and "YOUR TAPS", #8d97a3 on about #101623, roughly 6:1, at about 11 px.
8. L06 `desktop-11` (x 570-657, y 318-335) "Ready · 16 min" and L08 `desktop-11` (x 430-508, y 231-247) "Coming later": grey serif italic, about #8692a2 on #1a1f26, roughly 5.2:1, with hairline strokes at about 15 px.
9. Mono labels across all four lessons ("ONE TRY EACH, THEN THE REASON", "OF 4", menu "LESSON 1", explorer "7 LESSONS" and "COMING LATER · AFTER 10", masthead roman numerals): ink-3 #8d97a3 on card #12171e to #1d2229, roughly 4.9-6.3:1. These pass; the issue is size, caps and tracking, not contrast.
10. L05 `phone-06` pitch canvas: "35" on the amber band, about #9a978e on #2d261c (roughly 5.1:1); the "LOUDNESS" tab, #8d97a3 on #090c13 (roughly 6.6:1). Both pass; re-check while the band glows during playback.
11. Masthead over content: L06 `desktop-07/-08` (ghosted "Before you sing" under the wordmark) and L07 `phone-07` (gradient glow behind "Pause"). Measure "Pause" and the wordmark at the worst scroll frame.
12. For reference, these passed: Merc bubble labels (ORANGE MERC #ff7448 on #261b1e about 6.2:1; BLUE MERC #58a6ff on #141f2e about 6.6:1), bubble text (about 14:1), hero chips and the sound-gate body (about 8:1), quiz feedback link #58a6ff (about 6.7:1), and the selected-state amber border #bb7b10 (which is a colour-code issue, not a contrast one).
