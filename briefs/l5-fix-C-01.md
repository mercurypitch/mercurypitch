# Brief: group C's fix round after critic C-01 (s08-breathe, s09-onset, s10-steady)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Your scenes went to a fresh critic. Its report is `P/review/critic-C-01/REPORT.md` (verdict ONE
MORE PASS: S8 KEEP with small fixes, S9 and S10 REVISE); its crops and measurements are in that
folder. The director's calls on your hand-back are DECISIONS 191, and on the critic's report 192 to
201; where a call differs from the critic's suggested fix, the call holds. HANDOFFS, LAB-CHECKS and
the board carry `[C: 191]` and `[C-01: n]` markers where they changed. This is the one fix round:
no second critic follows (the owner's rule); the director checks your stills and numbers, so prove
each fix with them.

## The fixes, in this order
1. **S9's long middle** (192): the strip a lit lane (chrome about 6 %, x 700 to 1600, y 320 to
   540); each finished trace stays at 30 % until the next draws over it; the folds box about 1.3 to
   1.4 times about its centre, 60 px or more clear of the lane.
2. **10h's demonstration** (193): the slider from "needs"; one push 50, 75, 50, each leg 0.8 s or
   more, its bump at least twice the vibrato's peak to peak; "a change in the air moves it" on
   "because", at full 2 s or more, a 0.4 s linear fade, gone by the matched cut's 364.60 rule.
3. **S9's labels** (195): "the easy start" off "neither"'s line, reading as row 3's name; the "h"
   readable (row 3's first 200 px at 25 % while it shows, the "h" at about 70 %); "LISTEN ONLY"
   under "A catch" (right-aligned 660, centred y about 495). S10's first frame follows.
4. **Chapter openings** (196): the carried object's move starts as the card starts to leave; S8's
   figure at full from its move's start; S9's folds grow in 0.5 s.
5. **S9's stack in order** (197): the folds shrink first, trace 3 settles, then the names from
   about 34.4 (clip), 0.4 s apart.
6. **"No."** (198): an ink strike on the guess (0.3 s), a 0.4 s hold, then the rest clears in turn,
   0.05 s apart, the chart's labels first and Tavi's line last.
7. **S10's marks** (199): the vibrato bracket as two ink hairlines at crest and trough height
   across about 240 px with end ticks; the "stays" bracket 16 px or more above the mint edge.
8. **S10's push** (200): the hold chart at full strength before the push starts. Do not change the
   kit's bokeh lift; that is looked at once for the whole film.
9. **S8's out-breath** (191): it ends at rest (breath 0, not -1) and rests there across the cut.
10. **Sound and holds** (194, 201): nothing to do now. Report the holds again after your fixes.

## Rules
- Every render and every probe through `$S/bin/heavy`, one at a time; other groups render beside
  you.
- Edit only your three compositions and their lab folders. Do not edit `assets/lib/`, other
  groups' scenes, the passes, HANDOFFS, LAB-CHECKS or the board (the director keeps those; name
  in your hand-back any number of yours that a document should carry).
- Re-render all three clips with the scratch voice mix (the critic judged S8's and S9's clips,
  which were older than your last edits). Run `check` (0 errors), clock-lint and your probes after
  the fixes, and measure.py on each clip; re-prove the joins S7 to S8, S8 to S9 and S9 to S10 and
  the matched cut on `sing` (LAB-CHECKS 2).

## Hand back
Per item: what changed (file and line), the numbers before and after (the empty-frame stretch in
S9 by measure.py's low-motion runs, the label's time at full strength in 10h, the clearances in
S9, the opening frames' fill, the fades' spacing on "No."), and a still or a crop that shows it,
under `P/lab/<sid>/fix-C-01/`. Then the probe counts, `check`'s result, measure.py's holds and
loudness per clip, the joins and the cut, and anything you could not fix and why. Update each
`lab/<sid>/BUILD-NOTES.md`.
