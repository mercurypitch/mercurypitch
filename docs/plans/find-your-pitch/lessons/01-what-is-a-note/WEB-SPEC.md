# Lesson 1 web page: spec

One self-contained page that does three jobs: the **web lesson** for Lesson 1 (written steps,
live toys, predict, checkpoint, quiz), the **episode** (the film embedded with chapters and
captions), and the **lesson explorer** for Season 1 (all lessons, Lesson 1 live, the rest as
placeholders). The team's **series blueprint** is not on it: planning stays off a learner's
page, and the blueprint is kept for the Content Studio's Lessons page (item 10). Copy is in
[LESSON.md](LESSON.md); the curriculum is [../../CURRICULUM.md](../../CURRICULUM.md).

It was built first as a private preview page, which is the **proof preview** only (MASTER-PLAN
§ 11). Its public home is the app's `mercurypitch.com/learn/01` (MASTER-PLAN § 12 item 9), built
in the Phase 1 Lesson host track.

## Look

The MercuryPitch "listening room", as in the film and the stats site (dev.stats.maff.app):

- Dark-first, single visual world (a deliberate choice): ground Obsidian `#0d1117`, panels
  `#161b22`, hairlines `rgba(195,204,214,.14)`, ink `#e6edf3`, ink-2 `#a8b3bf`. The faint
  five-line staff texture as the page ground (repeating gradient, 3 % chrome), three soft glows.
- Colour code (the series' own, for explanatory diagrams: MASTER-PLAN § 5): blue `#58a6ff` = blue
  Merc's note; orange `#ff7448` = Tavi's note; gold `#ffd84d` = the fit, and nothing else
  (right answers in the quiz get a check icon and the ink colour, not gold); violet = the contrast
  note, drawn as a dashed wave or bead in the darker `#8957e5` (L\* 49, so it separates from blue's
  L\* 67 for protan and deutan viewers; 3.7:1 on the panels), with its text labels in `#bc8cff`
  for text contrast above 4.5:1; chrome `#c3ccd6` = any other note. The signal colours govern
  marks, labels and glows, not Merc and Tavi's bodies: Tavi's gold base is body colour, never a
  signal. Pitch-canvas scenes (the app's pitch line) take the app's canvas set instead; this page
  has none.
- Type (Google Fonts): Instrument Serif (italic for the big ideas and the hook question), Outfit
  600 (display, numbers), Inter (body), JetBrains Mono 500 uppercase with .18em tracking (kickers,
  readouts). Body 17 to 18 px, running text about 65 characters wide.
- The series wordmark "Find Your Pitch": Outfit 600, "Find Your" in the chrome gradient, "Pitch"
  in the spectrum gradient (blue, aqua, violet), as the stats report's MercuryPitch wordmark.
- Motion: one orchestrated hero moment, then quiet, purposeful reveals; land slowly, leave fast.
  Every section is visible at rest (never `opacity: 0` waiting for an observer). Three things move
  on their own: the two Merc idle loops, the staff vibration behind the hero and the spiral's
  drift. Under `prefers-reduced-motion` all three stop, always: the setting wins over the
  masthead's toggle and over any stored choice (Merc and Tavi hold a still frame: see Merc and Tavi
  below). Every transition, the unroll included, lands in its final state with no travel; what the
  viewer starts (a pluck, a tone, the hum-along ring) still plays, without travel. For everyone
  else, the masthead's **Pause animations** toggle stops the same three (WCAG 2.2.2: motion that
  starts by itself, lasts over 5 s and sits beside content needs a pause control).

## Sections

The order follows the page anatomy (MASTER-PLAN § 4.2), with these departures (§ 4.2 records only
the first two): the step toys double as the Playground (item 9); the Wrap comes before the
episode; the "Common mix-up" card (item 6) sits inside step 3, beside the toy that refutes it,
rather than after the steps; "Three words you'll meet" is an extra section before the steps; and
the practise link (item 11) sits in the Sing it card and the footer, not in the Wrap, whose copy
in LESSON.md has none. The recall check (item 4) starts with Lesson 2.

1. **Masthead** (sticky, slim): wordmark, the lesson menu's button (below), anchors (Lesson,
   Watch, Explorer), a Sound toggle (off by default; nothing plays without a tap), and a
   **Pause animations** toggle for everyone (an SVG icon with a text label, `aria-pressed`, at
   least 44 px). On, it freezes the Merc idle loops, the staff vibration and the spiral drift.
   Without reduced motion it starts off, and the viewer's choice is remembered in localStorage.
   Under `prefers-reduced-motion` it is shown on and locked (`aria-pressed="true"`,
   `aria-disabled="true"`, still focusable, with the visible hint "Paused by your reduced-motion
   setting"): a click changes nothing, and a stored choice is ignored until the setting is off
   again. A `change` listener on the media query applies either state at once. Under 1021 px the
   logo stands for the wordmark; under 821 px the anchors move into the lesson menu; under 390 px
   Pause shows its icon alone, its name kept in `aria-label`, as Sound's is under 821 px.

   **The lesson menu** (`kit/lesson-menu.ts`, set up by every page's `initMasthead` call):
   "Season 1 · Lesson 01" is a button at every width ("Lesson 01" under 1021 px), with a ring that
   fills as the viewer moves through the steps, and a chevron. It opens the season in a native
   modal `<dialog>`: a dropdown under the button from 821 px, and below that a sheet under the
   masthead, which also carries the page's anchors ("On this page"), so a page has one menu. It
   shows how many lessons are done, a bar a lesson, where the viewer is on this page (with
   Continue), and every lesson under its arc with its state: Done, the step reached, Up next,
   Ready, or Coming later, which is no link (as a draft hidden in production reads). This lesson
   opens to its steps by their titles, or as 44 px chips on a screen under 900 px tall. Focus goes
   to this lesson's row, and back to the button however the menu closes: Escape, a tap beside it,
   a link or its close button. It fades in over 160 ms, at once under reduced motion. The states
   are `kit/lesson-state.ts`'s, from `fyp-done` and each lesson's furthest step
   (`kit/position.ts`).

2. **Hero, the cold open**: kicker; the hook question as the title (serif italic, large, balanced);
   LESSON.md's meta as three chips (10 minutes, No theory needed, Sound on) and its one-line
   promise; Merc and Tavi live (Merc left, Tavi right, about 260 px on desktop, 160 px on phones)
   on a reflective floor line with the living staff vibrating behind (still under reduced motion
   or with Pause animations on); between them a short pitch rail with the two beads (A at 220, A
   at 440). The **predict widget**: Tavi's guess and Merc's reply from LESSON.md in speech
   bubbles, then "Two different notes, or the same one?" with two choices;
   choosing unlocks Play 220 Hz (Merc sings), Play 440 Hz (Tavi sings), Play both; after Play
   both, the reveal from LESSON.md ("One after the other, 440 sounds higher. Played together, they
   melt into one sound..."), which never tells either choice it was wrong.
3. **Three words you'll meet**: pitch, hertz, octave, each with a one-line definition and a play
   button.
4. **The steps**: a sticky visual stage (desktop: stage left or right, step text scrolling beside
   it; phone: stage above, text below, swipe or Next) with an "N of 6" counter and Previous / Next.
   Each step: heading, 50 to 120 words, one bold "Try:", one "Notice:" line, its toy:
   1. _String_: tap to pluck; a slow-motion toggle (220x: one swing a second) with a swing counter.
   2. _Dial_: a log slider 110 to 880 Hz: the wave squeezes, a chrome bead climbs a rail, a mono
      Hz readout, the tone plays while held (Web Audio, soft triangle-ish tone, gentle envelope).
   3. _Loud is not high_: two sliders, "how far" (amplitude) and "how fast" (frequency); only
      "how fast" moves the bead. The "Common mix-up" card sits in this step.
   4. _Twice as fast_: two overlaid waves (blue 220, orange from 220 to 660 by a ratio slider
      1.00 to 3.00 with a soft detent at 2.00, a marker at 1.26 = 277 Hz and a marker at 3.00);
      gold ticks wherever peaks meet within 3 % of a cycle; a label that reads "octave: 2 : 1" only
      at 2.00, and "3 : 1 fits too: a different note (E5)" at 3.00, so the toy never implies that
      meeting on every slow peak is unique to the octave. Play both. Below it a mini ladder 110,
      220, 440, 880 with play buttons.
   5. _Spiral_: a 3D helix (canvas 2D, projected, depth-sorted, 3 turns A2 to A5, 30 degrees per
      semitone, A at the front), draggable to rotate (and drifting slowly on its own, except under
      reduced motion or with Pause animations on), letters A to G at their angles, the five
      unnamed notes as dim "?" beads; tap a bead to hear it; the A beads stacked on one side. A C
      seam, as in the film: a hairline across the helix at each C with the octave number beside
      it (C3, C4, C5), and every bead labelled with its letter and number on hover or tap, so the
      number visibly goes up at C, not at A.
   6. _Keyboard_: a button "Unroll the spiral" animates the helix into a keyboard A2 to A5 (low
      notes left), C3, C4, C5 labelled, A3 blue, A4 orange; ticket cards "A4 · 440 Hz · the
      orchestra's A" and "C4 · middle C"; tapping a key plays it.
5. **Sing it**: the checkpoint. A big "Play Merc's A" (A3, 220 Hz, Merc's synthesised "ooh":
   partials 1, .62, .38, .24, .14, .08, .045, .025 over a lowpass near 2.6 kHz, vibrato 5.5 Hz,
   +-14 cents grown in over .35 s) and "Play it an octave up" (A4); a breathing hum-along ring that
   runs for four seconds after the note (unscored: nothing listens); the safety line; then the app
   link card: "Want a score? Try MercuryPitch's Voice Mirror. It finds your comfortable range, then
   plays five notes for you to sing back on "ooh", and counts a match in any octave. Free, no
   account." mercurypitch.com/mirror (a real link; show the address as text too; on the public host
   it carries `?lesson=01`, as every Lesson 1 CTA does: this card, the footer's practise link and
   Lesson 1's explorer card; MASTER-PLAN Phase 1 Lesson host). Never say Mirror scores a hum or asks
   for an A: it does neither (`src/lib/mirror/session.ts`, `metrics.ts`).
6. **Quick check**: the four questions from LESSON.md, three answers each in a shuffled order
   (seeded per question, so the order is stable for a viewer), tap to answer, one-line feedback,
   the right answer marked with a check icon, a small score ("3 of 4"), answers remembered in
   localStorage (wrapped in try/catch). On a return visit the questions are asked afresh, not
   shown with their stored answers, so the page measures delayed retrieval (MASTER-PLAN § 9);
   Lesson 2's page asks two of them again (§ 4.2 item 4). In the preview nothing leaves the
   browser; on the public host each answer also goes out as a Lesson telemetry event (MASTER-PLAN
   Phase 1, § 12 item 11), behind the viewer's consent.
7. **Wrap**: the three recap lines, the one-sentence challenge, and the next lesson's hook from
   LESSON.md ("Musicians only use seven letters, so where do the other five notes come from?") on
   the kit's next-lesson card (`kit/next-card.ts`), which takes Lesson 2's state from the season in
   the explorer's words: "Start lesson" to its page ("Continue: step N" once begun, "Read again"
   once done). A lesson not live yet, as a draft a production build hides, reads "Coming later" and
   opens the explorer on it ("See it on the map"), never its page.
8. **Watch the episode**: the film (see Video below) with a chapter list beside it (clickable,
   highlighting the current chapter), captions on by default (VTT track), and a "Read the
   transcript" disclosure built from the captions.
9. **Lesson explorer**: Season 1 as two lanes, Theory and Voice, plus the trailer; arcs "Hear it"
   (1 to 7) and "Shape it" (8 to 14); prerequisite edges between nodes, from CURRICULUM § 3.3's
   lesson prerequisite table. Each lesson says what a learner can do with it (`kit/lesson-state.ts`,
   the legend's three words): "Ready" once its page is live ("Ready · watch and read" once its film
   is published, "Ready · read" until then), "Coming later" until then, "Done" once marked; filter
   by lane; clicking a node opens a card with the hook question and, under it, the lesson's one
   action ("Start lesson" at its page's top, "Continue: step N" at the furthest step the viewer
   reached, or "Read again"), with "Watch the episode" beside it once the film is published; then
   the topics by name, what it builds on and opens, the practise link where one exists, as its
   CURRICULUM card gives it, and its reading time ("10 min", with the film's running time once the
   film plays). The season's planning fields (the signature image, the link a drill still needs, a
   film made but not published) stay in `kit/season.ts` for the team and the admin console, never
   on a card. On phones a vertical two-lane list with chips. Remember "done" per lesson in
   localStorage (Lesson 1 marks done when the quiz is finished; on the public host it syncs on
   sign-in, MASTER-PLAN § 4.3), and each lesson's furthest step, on this device only
   (`kit/position.ts`).
10. **No series blueprint.** The page closed with one for the team until October 2026: the
    promise; the episode beat sheet and the page anatomy; the five teaching rules that matter
    most; the pipeline in eight steps; the phases 0 to 5; links to the plan files
    (`docs/plans/find-your-pitch/`). It is planning, which no learner's page carries, so it moved
    word for word to `src/features/admin/lessons/blueprint-data.ts`, which the Content Studio's
    Lessons page (`/admin/lessons`) shows. Change it there.
11. **Footer**: practise link (Voice Mirror, `mercurypitch.com/mirror`, with `?lesson=01` on the
    public host, as in the Sing it card); credits (fonts SIL OFL; scratch voices: local
    Kokoro-82M, Apache 2.0, to be re-voiced; every musical example synthesised; "Merc's sung notes
    in the film: stand-ins for now, made with ElevenLabs and retuned"). No dateline: a footer says
    nothing a learner cannot use.
    The owner holds those sung notes' rights (`src/features/echo/merc-voice-set.ts`; MASTER-PLAN
    § 12 item 1); a voice actor replaces them later.

## Video

On the public page (`/learn/01`) the episode is an MP4 on R2 (MASTER-PLAN § 12 item 7): 1080p, and
a 720p copy below 900 px, both cut from the delivery master. They are served from R2's custom
domain (planned: `media.mercurypitch.com`, which `media-src` must list first), not `r2.dev`. Once
the episode is on YouTube, the section adds a "Watch on YouTube" link; there is no YouTube embed. Their URLs are Lesson 1's
entry in the kit's film list (`src/features/lessons/kit/films.ts`), which the page's
`lesson-01/film.ts` and the season map (`kit/season.ts`) both read. Until the files are uploaded
the entry is null and the page offers nothing to watch: the section, its masthead link and the
card's "Watch the episode" are gone, and the masthead numbers its other links without a gap.
The markup ships the section and its link hidden, so the page paints without them, and
`kit/episode.ts` shows them once the entry is set: setting it is the whole change that puts the
film on the page.
Captions are the same-origin VTT in a `<track>`; the transcript is built from the same VTT text,
and the chapters from the film's generated `chapters.json`, both copied beside the page module
(`lesson-01/assets/`, from this folder's `captions/`). Captions and chapters travel with the film: a
re-cut that re-times it changes both copies in the same commit as the MP4s (`film-sync.test.ts`
holds the copies equal). A chapter or transcript jump while playing dips the
element's volume around the seek, so it does not click (iOS ignores element volume).

The proof preview on the artifact host used HLS (`video/lesson-01.m3u8` plus segments) with hls.js,
because the artifact host caps a file at 15 MB.

## Merc and Tavi

On the public page Merc and Tavi are the app's own renderer (`src/lib/merc/renderer.ts`), loaded as
its own chunk after first paint so the page reads and plays before it arrives: Merc as shipped,
Tavi with the warm look and the warm light (`src/features/lessons/kit/merc-warm.ts`: a gradient
through `setLook`, and the shader's cool light constants swapped for amber through the renderer's
`fragmentPatch`, so the approved shader text never changes). (The proof preview loaded the film's
bundles, `merc-blue.js` and `merc-orange.js`, built by the film's `tools/build-merc.mjs` with the
same swaps.) Live mode: `mount(el, { transparent: true, quality: 'medium', size, view: 'front',
state: 'idle' })`, Tavi with `m.setLook(WARM_LOOK)`; turn them toward each other
with `setPoseBias({ yaw: +-0.32, lookX: +-0.35 })`. While a tone plays, `setState('sing')` and
`setVoice({ voiced: true, cents: 0, level: 0.75, steady: 0.95, midi: 57 })`; after, back to
`idle` with `setVoice({ voiced: false, ... })`; on the reveal, Tavi `celebrate` for 1.6 s. One
WebGL context per Merc; pause them (`setPaused(true)`) when the hero is off screen. Under
`prefers-reduced-motion` (always) or while Pause animations is on, each Merc holds a still frame
(`setPaused(true)` once its first frame has drawn) and skips the sing and celebrate reactions; the
play buttons and the reveal carry the moment alone. (The bundle's `setStill` is not enough: it
calms only the `hum` and `ride` states, not `idle`.) If WebGL fails (the mount throws), show the
still images (`merc-blue.png`, `merc-orange.png`). Show them too, without loading the renderer,
when WebGL2 would run on the CPU: the browser reports a major performance caveat, or the renderer
names itself as SwiftShader, llvmpipe, softpipe or the Basic Render Driver. Merc and Tavi drawn
there held the main thread for about 11 s after load, and the page under them stopped answering.

## Contract (the proof preview on its preview host)

The preview page is the proof preview only. Its host rules (the wrapper tags, the
script and stylesheet sources, no iframes) bind only the preview. The layout, accessibility,
sound, motion and storage rules bind the page wherever it lives, and carry into the Phase 1 toy
kit's contract.

## On the app

The public page is `learn/01.html`, a hand-written document like `delete-account.html`, served at
`/learn/01` (`LESSON_01_PATH` in `vite.config.ts`; the service worker leaves it alone, and it is in
the sitemap and `llms.txt`). Its module is `src/features/lessons/lesson-01/main.ts`; the parts
every lesson shares are in `src/features/lessons/kit/` (the start of the Phase 1 toy kit). What
changed from the preview, because the app's security policy allows scripts, styles and fonts from
its own origin only, and because loading fonts from Google would hand every visitor's IP address
to Google before any consent (`src/lib/self-hosted-fonts.ts`): no CDN at all; Inter and Outfit
from the app's `@fontsource-variable` packages; Instrument Serif and JetBrains Mono as Latin WOFF2
subsets beside the kit (`src/features/lessons/fonts/`, with their OFL texts); GSAP and
ScrollTrigger replaced by Web Animations and IntersectionObserver with the same curves
(`kit/reveal.ts`); the synthesised examples follow the house envelope rules
(`.claude/memory/audio-pop-free-playback.md`). Its practise links carry `?lesson=01`.

- No `<!doctype>`, `<html>`, `<head>`, `<body>` tags: the file is wrapped at publish. Start with
  `<title>Find Your Pitch</title>`, `<meta name="claude:viewport-fit-sides" content="cover">`, then
  `<style>`.
- External scripts only from cdnjs (preferred), jsdelivr `/npm/`, unpkg; pinned exact versions at
  least two weeks old (for example `gsap/3.12.5`, `hls.js/1.5.13` on cdnjs). Stylesheets only from
  Google Fonts. Everything else inline or published beside the page.
- No iframes (no YouTube), no `alert`/`confirm`/`prompt`, no `window.print`, no autoplaying sound
  (sound only after a tap; muted autoplay video is fine but do not autoplay the episode).
- Side gutter `padding-left: max(16px, env(safe-area-inset-left, 0px))` and the same on the right;
  works at 390 px with no sideways scroll; `min-width: 0` on flex and grid children with text;
  touch targets at least 44 px; visible keyboard focus.
- Single dark theme by choice: set `color-scheme: dark` on `:root`, define every colour as a token,
  and give `body` an explicit background.
- Motion as in Look: under `prefers-reduced-motion` the Merc idle loops, the staff vibration and
  the spiral drift always stop, whatever the toggle or a stored choice says, and the masthead's
  Pause animations toggle is shown on and locked; for everyone else the toggle stops the same
  three (WCAG 2.2.2).
- localStorage only for per-viewer conveniences, every access in try/catch.
- The whole page renders correctly with no sound, no WebGL and no storage.
- Page QA before publishing (PRODUCTION-PIPELINE § 5) includes motion: with reduced motion
  emulated, no Merc, staff or spiral moves on its own, even with a stored choice to keep them
  running and after a click on the toggle, which announces itself pressed and unavailable; turning
  the emulation on with the page open freezes all three at once; with Pause animations on, the
  same holds for a default viewer; the toggle is reachable by keyboard and announces its state.
