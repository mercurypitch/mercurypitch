# Lesson page tour: plan (lead, 24 October 2026)

The owner's ask: on a learner's first lesson page, a short welcome tour. It opens on the stage where Merc and Tavi drop in, spotlit, then a few steps through the page, with an X and a Skip in the corner for people who know their way around. One small PR: `feat/lesson-page-tour`.

## When it starts
- On the first lesson page (any /learn/NN) this browser opens. Not on the hub (/learn/) in this PR.
- Step 1 should show the drop: start just before Merc and Tavi's entrance, or hold the entrance until step 1 is up, if the page's entrance allows it (lesson-01/entrance.ts and the kit's hero). If the entrance cannot wait, step 1 opens on them once they have landed. Never wait on the live renderer: the stills are there when there is no live Merc (reduced motion, no GPU, a slow compile).
- Only when the page opened at the top with no hash. A deep link (/learn/03#sing, a share, a practice link back) skips it this time; the next lesson page opened at the top offers it.
- Not over another layer (the consent banner, the lesson menu, a microphone prompt, the film): it waits until that closes.
- Offered once. Closing it any way (Done, Skip, X, Escape) records it in localStorage, versioned (for example `mp.learn.tour` = `1`) so a future tour can ask again. Every storage call is in try/catch; with no storage the tour does not start, so it can never nag.

## Steps
Each is skipped when its target is missing or hidden on that page, so one list serves every lesson.
1. `#heroStage`: "Meet Merc and Tavi". They teach every lesson: they show each idea and sing it with you.
2. `#lesson` (the steps deck): the lesson goes step by step; each step has something to try, at your own pace.
3. `#sing`: your turn to sing; it listens through your microphone and shows how close you are.
4. `#explorer`: "The season, mapped": every lesson and how they build on each other; pick one to see what it covers.
5. `#mastNav`: jump to any part of this lesson, or to another lesson, from here.

The words above are drafts. Check every claim against what the page really does (what a tap on Merc does, what the deck's buttons are called, what Sing it asks for) and keep to the lessons' plain-language style. Name the hosts Merc and Tavi. All copy lives in one kit file, so the owner can change it in one place.

## Look and behaviour
- A spotlight: the page dims around a rounded cutout over the target (one element with a large box-shadow, placed from the target's rect, following resize and scroll).
- A small card beside the target: title, one or two sentences, "1 of 5", Back, Next (Done on the last step), "Skip tour", and an X in its top corner (an SVG icon, accessible name "Close tour").
- On phones (narrow screens) the card docks at the bottom, and the target scrolls into view above it. No sideways scroll at 390 px.
- Each target scrolls into view: smooth, or instant under reduced motion.
- Merc and Tavi keep moving under step 1's spotlight; that is its point.
- The dimmed page and the cutout take no clicks during the tour; only the card does.
- Keyboard:
  - focus moves into the card, and Tab stays inside it;
  - Enter or Next goes forward, Back goes back, and Escape closes (the same as Skip);
  - focus returns to where it was.
- Screen readers: the card is a dialog (role="dialog", aria-modal="true", labelled by its title, described by its text), and each new step is announced.
- Reduced motion: the spotlight and the card jump; nothing glides.
- The lessons' own tokens, light and dark. The app's tour (src/features/... Walkthrough.tsx) is a reference for the feel, but it is Solid and must not be imported.

## Replay
"Tour this page" in the mast's menu restarts it at step 1. If the menu has no sensible room, put it in the footer, and say why.

## Code and bytes
- No lesson's first paint may break its ceiling, and no ceiling rises. Lesson 3 has the least room. Only a tiny trigger goes in first paint, in a kit module every lesson page already loads. The tour and its CSS are their own chunk, loaded when it starts. Report first paint before and after for Lessons 1 to 8.
- Do not edit merc-duo.ts or src/lib/merc/: another branch is changing them now (the Windows compile fix). Hook into the page's entrance and stage state instead.

## Tests
- Unit tests:
  - the first-visit rule: storage absent, present and throwing;
  - the hash and scroll rule;
  - steps skipped when their targets are missing or hidden;
  - Escape and Tab wrap;
  - focus return;
  - the record written on every way of closing.
- A new e2e spec:
  - a first visit opens step 1 on the stage;
  - Next goes through every step;
  - Skip and X close it, and a reload does not bring it back;
  - replay from the menu works;
  - at 390x844 and at 1440x900;
  - under reduced motion;
  - no sideways scroll.
- The existing lesson specs must never meet the tour. Seed the record in their shared setup, following how the app's e2e seeds its own tour offers (src/e2e/helpers/mixer-song.ts:101-104). Only the tour spec starts clean.
- The PR carries phone and desktop screenshots, light and dark (the app-check skill's approach).

## Not in this PR (follow-ups)
- Anonymous, consent-gated tour events (finished, or skipped at step n).
- A tour on the /learn/ hub.
- Lesson-specific extra steps (Lesson 9's ladder, for example).

## For the owner
- The copy (one file) and the number of steps (5 by default).
- Where the replay link sits.
