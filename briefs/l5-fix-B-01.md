# Brief: group B's fix round after critic B-01 (s05-push, s06-quiet, s07-support)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Your scenes went to a fresh critic. Its report is `P/review/critic-B-01/REPORT.md` (verdict ONE
MORE PASS); its crops and measurements are in that folder. The director's calls on it are
DECISIONS 180 to 189, and where a call differs from the critic's suggested fix, the call holds.
The board (STORYBOARD rows 5c, 5g, 6f, 6i, 7a, 7b, 7e and § Build checks) and HANDOFFS carry
`[B-01: n]` markers where they changed. This is the one fix round: no second critic follows (the
owner's rule); the director checks your stills and numbers, so prove each fix with them.

## The fixes, in this order
1. **S7 evidence 1 holds 0.5 s** (180): the redraw runs faster where the clock is shorter, never
   the hold shorter; row 1 lands 0.4 s or more clear of row 2's first line.
2. **S5's thesis lands on "in a voice,"** (181) and stays to the fade: 2 s or more on screen.
3. **Plates trimmed** (182): `backPadX: 4, backPadY: 4` per label in your scenes (do not change
   the kit's default; groups C to E build against it). No plate covers a stroke: move "what the
   note needs" down until its plate clears the gold line by 4 px or more, and put any label whose
   plate would still cover a stroke on empty ground. The cursor still passes behind them.
4. **The readout swaps** (183): old words out in 0.1 s, then the new in 0.15 s, never glyph on
   glyph, at every switch (about 29.4, 36.45 and 49.4 in S6's clip); "added" lands 0.45 s after
   the switch, once its region shows.
5. **Ghost resting envelope** (184): in S5 from "mainly", in S7 from the chart's reassembly;
   "level" labels the strip at its left, not the slider's row.
6. **S7 ends on its payoff** (185): rows 0 to 3 dim to ink-2 (4.5:1 or better) as row 4 lands;
   row 4 set large in the empty lower right (x 1180 to 1700, one phrase to a line, 12 px or more
   above the floor horizon at y 840). The words stay the page's (the coach signs them off later).
7. **The hosts across the S6 to S7 cut** (186): S7's first host frame continues S6's last. Check
   your tags and offsets first (`assets/merc/roots.js`, PASSES.md). If the passes themselves jump
   there, do not re-render passes: report it with the frame pair, for the passes step.
8. **"ILLUSTRATION" on evidence 2 and its row** (187).
9. **The minor ones** (188): "let it flow out unforced" lands within 0.2 s of "let"; the figure's
   legs 12 px or more from "with your breathing muscles,"; nothing on the floor horizon.
10. **Holds** (189): add no motion for them now. Report S6's and S7's holds again after your fixes,
    so the passes step has the list.

## Rules
- Every render and every probe through `$S/bin/heavy`, one at a time; group C renders beside you.
- Edit only your three compositions, their lab folders, and your rows' lines in HANDOFFS (add a
  `[B-01: n]` marker where you change a number). Do not edit `assets/lib/`, other groups'
  compositions or the passes. If a fix needs a kit change, stop on that item and report it.
- Render every clip with the scratch voice mix, as before. Run `check` (0 errors) and your probes
  after the fixes, and measure.py on each clip.

## Hand back
Per item: what changed (file and line), the numbers before and after (the ones the critic
measured: the hold's length, the thesis's time on screen, the stroke pixels each plate covers,
the frames of overlap at each switch, the eye shift at the cut), and a still or a crop that shows
it, under `P/lab/<sid>/fix-B-01/`. Then the probe counts, `check`'s result, measure.py's holds and
loudness per clip, and anything you could not fix and why. Update each `lab/<sid>/BUILD-NOTES.md`.
