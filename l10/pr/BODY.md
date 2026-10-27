Lesson 10's interactive page, /learn/10, "Major and minor", built from its LESSON.md word for word. It ships as a draft until Lesson 6's page is live and the vocal coach has looked at its Sing it (`kit/drafts.ts`).

The kit parts it needed have already merged:
- the ear game for any number of answers, and the guide's breath mark, with Lesson 6's page (#1149);
- Move do and its count-in (#1192);
- the names modes, Move do's ends as `aria-disabled`, the spiral resting when nothing on it moves, and the spiral's own notes through a page's sound owner (#1206);
- chords on the kit's runs (#1207);
- the scales chapter and Drone Intonation's tuning promise, as this lesson's facts cite them (#1214), and `/exercises/thirds-on-a-drone` (#1224).

This PR adds the page, three small kit changes and the page's browser specs:
- the spiral takes `view: 'top'`, so the hero's copy looks down its axis from the first frame (`kit/spiral.ts`);
- `easeOutExpo` joins the kit's canvas curves, for the beads' spread and fold (`kit/reveal.ts`);
- the guide's breath word stays on the canvas when its mark comes after a top-row note: it stands beside its tick, where a word above it would leave the canvas (`kit/slide-guide.ts`). Lesson 6's mark is unchanged.

While Lesson 10 is a draft it stays out of the sitemap and llms.txt.

## What to read first

1. `docs/plans/find-your-pitch/lessons/10-major-minor/WEB-SPEC.md`: Toys 1 (the chord beads), then Toys 6 (Sing it).
2. `src/features/lessons/lesson-10/chord-beads.ts` and `chord-layout.ts`: one figure in each step's state, with 44 px targets at every width.
3. `lesson-10/sing-flow.ts`, then `sing.ts`: the Sing it rule, every branch unit-tested, and the card that draws it.
4. `lesson-10/steps.ts`, then `wrap.ts`: the steps' controls, and free play, which reuses them.

## Commits

Oldest first. The first ten are modules with their own tests and no page; the shell (11) puts every word on the page, and 12 to 24 wire it, one part at a time. 25 sets the final first-paint ceilings, 26 to 30 bring the docs up to the page, and 31 regenerates the module map.

@@COMMITS@@

Each message says what its commit does and why, with its tests and its first-paint numbers.

## Review fixes

The lead reviews' findings, folded into the commits they fix:

- **The rest card linked to a singing drill.** After "Just listen today", "Effortful" or "Uncomfortable", the Wrap's rest card kept Drone Intonation as a live link, though nothing may send the learner to sing then (REQ-GVC-055). Its address is now words, as on every other lesson's rest card, and Stack is the card's one link. A unit test and End to end 10 assert it (21, 24).
- **Free play's Major · Minor stopped a playing pattern**, where Step 4's switches act from the next quaver and the pattern plays on (WEB-SPEC, Toys 1). A run the page builds now plays through a change of quality; a play of the chord or the scale still stops. Two tests, each failing under its own mutant (23).
- **The guide's breath word was drawn off the canvas.** Lesson 10's breath mark comes as *so*, the guide's top row, ends, and the word went above the canvas's top edge: the tick showed with no "breathe" (FACTS 66). Fixed in the kit, with a unit test that fails without it (22).
- **A cold open test compared two real-clock readings exactly**, and failed once on 1600.0000000000005. It now compares to 6 places, as its sibling does (13).
- **Docs brought up to the page**: where Play the chord sits on a phone, and why it stays there (16); the stuck stage's measured heights, the games' eight roots and the level of two notes together (29); Lesson 11's current hook in the next-lesson line, and two of the Length's word counts (26); the spec reads main, not Lesson 6's branch, and HANDOFF records #1206 and #1207 (28); six citations read again (27).

## First paint (build:e2e, bytes)

@@TABLE@@

@@TABLENOTE@@

## Checks

@@CHECKS@@

## Left open

- **Release order.** Lesson 6's page goes live first, since this page's recall asks Lesson 6's questions and its prerequisite chip links Lesson 6; and the vocal coach looks at Sing it ("For the vocal coach" in LESSON.md). Both are in `kit/drafts.ts`.
- **The practice card and `/exercises/thirds-on-a-drone`.** The slug is built (#1224), and LESSON.md's editorial note moves the card, the rest card and the footer to it once this page is live. A page goes live from the console, with no release, so that switch needs a decision before Lesson 10 is published.
- **Copy the docs do not word yet.** The page uses these, and the spec records each where it describes the part, waiting on the copy pass:
  - the five figure labels;
  - the ear games' play labels, "Play a pair" and "Play a chord", which have no ask line yet;
  - the spiral's screen-reader description;
  - free play's opening line and its four group labels;
  - the ring's state words and the status lines Sing it takes from Lessons 6 and 8.
- **Kit fixes coming in 0.9.24 that this page shows too:**
  - a lit primary button's dark words (free play's Play, Play the pattern, the ear games' Play);
  - the sound gate's button width: this page's `.l10-hero .gate .btn` works around it, and goes when the kit's fix lands;
  - after "Effortful", the status line sits flush under the feeling buttons, and the do readout under Play Merc's notes.
- **The trail's links are 24 px**, the kit's target size for every lesson's trail (WCAG 2.5.8), where the series' Contract asks 44 px of every target. A question for the series, not for this page.
- **On a device, by ear and eye**: the chord's three notes balance and none drowns the others; the glide is smooth, with no click where it starts; a live WebGL Merc under reduced motion.
- **Headroom.** @@HEADROOM@@
