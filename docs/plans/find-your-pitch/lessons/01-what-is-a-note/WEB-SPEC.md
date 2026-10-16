# Lesson 1 web page: spec

One self-contained page that does three jobs: the **web lesson** for Lesson 1 (written steps,
live toys, predict, checkpoint, quiz), the **episode** (the film embedded with chapters and
captions), and the **lesson explorer** for Season 1 (all lessons, Lesson 1 live, the rest as
placeholders). A short **series blueprint** section closes it for the team. Copy is in
[LESSON.md](LESSON.md); the curriculum is [../../CURRICULUM.md](../../CURRICULUM.md).

## Look

The MercuryPitch "listening room", as in the film and the stats site (dev.stats.maff.app):

- Dark-first, single visual world (a deliberate choice): ground Obsidian `#0d1117`, panels
  `#161b22`, hairlines `rgba(195,204,214,.14)`, ink `#e6edf3`, ink-2 `#a8b3bf`. The faint
  five-line staff texture as the page ground (repeating gradient, 3 % chrome), three soft glows.
- Colour code (the series' own): blue `#58a6ff` = blue Merc's note; orange `#ff7448` = orange
  Merc's note; gold `#ffd84d` = the fit, and nothing else (right answers in the quiz get a check
  icon and the ink colour, not gold); violet `#bc8cff` = the contrast note; chrome `#c3ccd6` = any
  other note.
- Type (Google Fonts): Instrument Serif (italic for the big ideas and the hook question), Outfit
  600 (display, numbers), Inter (body), JetBrains Mono 500 uppercase with .18em tracking (kickers,
  readouts). Body 17 to 18 px, running text about 65 characters wide.
- The series wordmark "Find Your Pitch": Outfit 600, "Find Your" in the chrome gradient, "Pitch"
  in the spectrum gradient (blue, aqua, violet), as the stats report's MercuryPitch wordmark.
- Motion: one orchestrated hero moment, then quiet, purposeful reveals; land slowly, leave fast;
  `prefers-reduced-motion` gets final states with no travel. Every section is visible at rest
  (never `opacity: 0` waiting for an observer).

## Sections

1. **Masthead** (sticky, slim): wordmark, "Season 1 · Lesson 01", anchors (Lesson, Watch,
   Explorer, Blueprint), a Sound toggle (off by default; nothing plays without a tap).
2. **Hero, the cold open**: kicker; the hook question as the title (serif italic, large, balanced);
   the two Mercs live (blue left, orange right, about 260 px on desktop, 160 px on phones) on a
   reflective floor line with the living staff vibrating behind; between them a short pitch rail
   with the two beads (A at 220, A at 440). The **predict widget**: "Two different notes, or the
   same one?" with two choices; choosing unlocks Play 220 Hz (blue sings), Play 440 Hz (orange
   sings), Play both; after Play both, the reveal from LESSON.md ("One after the other, 440 sounds
   higher. Played together, they melt into one sound..."), which never tells either choice it was
   wrong.
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
      semitone, A at the front), draggable to rotate (and auto-drifting slowly), letters A to G at
      their angles, the five unnamed notes as dim "?" beads; tap a bead to hear it; the A beads
      stacked on one side. A C seam, as in the film: a hairline across the helix at each C with
      the octave number beside it (C3, C4, C5), and every bead labelled with its letter and number
      on hover or tap, so the number visibly goes up at C, not at A.
   6. _Keyboard_: a button "Unroll the spiral" animates the helix into a keyboard A2 to A5 (low
      notes left), C3, C4, C5 labelled, A3 blue, A4 orange; ticket cards "A4 · 440 Hz · the
      orchestra's A" and "C4 · middle C"; tapping a key plays it.
5. **Sing it**: the checkpoint. A big "Play Merc's A" (A3, 220 Hz, Merc's synthesised "ooh":
   partials 1, .62, .38, .24, .14, .08, .045, .025 over a lowpass near 2.6 kHz, vibrato 5.5 Hz,
   +-14 cents grown in over .35 s) and "Play it an octave up" (A4); a breathing hum-along ring that
   runs for four seconds after the note (unscored: nothing listens); the safety line; then the app
   link card: "Voice Mirror finds your comfortable range, then plays five notes for you to sing
   back, and counts a match in any octave. Free, no account."
   mercurypitch.com/mirror (a real link; show the address as text too). Never say Mirror scores a
   hum or asks for an A: it does neither (`src/lib/mirror/session.ts`, `metrics.ts`).
6. **Quick check**: the four questions from LESSON.md, three answers each in a shuffled order
   (seeded per question, so the order is stable for a viewer), tap to answer, one-line feedback,
   the right answer marked with a check icon, a small score ("3 of 4"), answers remembered in
   localStorage (wrapped in try/catch).
7. **Wrap**: the three recap lines, the one-sentence challenge, and the next lesson's hook ("Seven
   letters, but twelve notes. Where do the other five come from?") on a card that opens Lesson 2
   in the explorer (Planned).
8. **Watch the episode**: the film (see Video below) with a chapter list beside it (clickable,
   highlighting the current chapter), captions on by default (VTT track), and a "Read the
   transcript" disclosure built from the captions.
9. **Lesson explorer**: Season 1 as two lanes, Theory and Voice, plus the trailer; arcs "Hear it"
   (1 to 7) and "Shape it" (8 to 14); prerequisite edges between nodes; Lesson 1 marked "Ready"
   (watch and read), the rest "Planned"; filter by lane; clicking a node opens a card with the
   hook question, the topics, the practise link (or "needs a deep link" where none exists yet),
   and the status. On phones a vertical two-lane list with chips. Remember "done" per lesson in
   localStorage (Lesson 1 marks done when the quiz is finished).
10. **Series blueprint** (for the team, compact): the promise; the format (episode beat sheet and
    page anatomy as two small diagrams); the five teaching rules that matter most; the pipeline in
    eight steps; the phases (0 done, 1 to 5) as a horizontal timeline; links to the plan files on
    the branch (`docs/plans/find-your-pitch/`).
11. **Footer**: practise link; credits (fonts SIL OFL; scratch voices: local Kokoro-82M, Apache
    2.0, to be re-voiced; every musical example synthesised); "Proof episode, October 2026".

## Video

Published beside the page as HLS (`video/lesson-01.m3u8` plus segments) with a poster
(`video/poster.jpg`) and captions (`video/lesson-01.en.vtt`). Play it with the native player where
HLS is native (Safari), else hls.js from cdnjs (pinned version). Chapters come from
`video/chapters.json` (inline them too, as a fallback).

## Mercs

The page loads the film's own Merc bundles, published beside it (`merc-blue.js`,
`merc-orange.js`; each sets `window.MercLib` when loaded, so load one, keep its `mount`, then load
the other). Live mode: `MercLib.mount(el, { transparent: true, quality: 'medium', size, view:
'front', state: 'idle' })`, orange with `m.setLook(MercLib.WARM)`; turn them toward each other
with `setPoseBias({ yaw: +-0.32, lookX: +-0.35 })`. While a tone plays, `setState('sing')` and
`setVoice({ voiced: true, cents: 0, level: 0.75, steady: 0.95, midi: 57 })`; after, back to
`idle` with `setVoice({ voiced: false, ... })`; on the reveal, orange `celebrate` for 1.6 s. One
WebGL context per Merc; pause them (`setPaused(true)`) when the hero is off screen. If WebGL fails
(the mount throws), show the still images (`merc-blue.png`, `merc-orange.png`).

## Contract (the artifact host)

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
- localStorage only for per-viewer conveniences, every access in try/catch.
- The whole page renders correctly with no sound, no WebGL and no storage.
