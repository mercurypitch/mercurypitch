# Brief: group E's fix round after critic E-01 (s13-recap, s14-next, s15-end)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Your scenes went to a fresh critic. Its report is `P/review/critic-E-01/REPORT.md` (verdict ONE
MORE PASS: S13 REVISE, S14 KEEP with minor fixes, S15 KEEP); its crops and measurements are in
that folder. The director's calls on your hand-back are DECISIONS 214, and on the critic's report
215 to 221; where a call differs from the critic's suggested fix, the call holds (above all: the
ten line stays one line, 216). This is the one fix round: no second critic follows; the director
checks your stills and numbers, so prove each fix with them.

## The fixes, in this order
1. **The answer holds before the clean break** (215): the cascade from `break` + 0.2; card 3's
   redraw from "settles" at most 2.4 s, ending 0.5 s or more before the cascade, its speed from the
   clock; the cascade's last element gone before hop 1's apex; "Voice Mirror" 0.4 s after the panel.
2. **The ten line** (216): one line, Inter 30, ink-2, x 270, baseline 820, glyph foot at 828 or
   higher, ending left of x 1110; the card's rows close up 12 px or more so the panel's last foot
   is at y 778 or higher, 16 px or more over the line's cap top. You may change `L.RECAP.VM` in the
   kit for this (s13 is its only user: confirm with a grep first), and log it in
   `tools/CHANGES.md`. Name the new row baselines and feet in your hand-back.
3. **The recap's frame fill** (217): the figure and the traces at about 1.2 times, within x 1100 to
   1690, y 60 to 535, 12 px or more from every label and chip; the band at 20 % while cards 1 and
   2 are up, full again for card 3.
4. **The traces' ILLUSTRATION chip** (218): with the traces while they show, 12 px or more from
   every trace and label, leaving with them; no frame holds the traces and card 3's chip together.
5. **The carried bead** (219): S14's rows and outlines fade in from S14's first frame (about
   0.6 s); the carried bead stays filled until its note lights it, never an outline.
6. **The tease line** (220): its cap top 24 px or more under "NEXT TIME"'s foot (about baseline
   170), still centred over the tune.
7. **Holds** (221): nothing to do; report them again.

## Rules
- Every render and probe through `$S/bin/heavy`, one at a time; group B's leftovers round renders
  S6 and S7 beside you.
- Edit only your three compositions, their lab folders and (for item 2 only) `L.RECAP.VM` in the
  kit. Do not edit other groups' scenes, the passes, HANDOFFS, LAB-CHECKS, DECISIONS or the board.
- Re-render all three clips with the scratch voice mix (S13 in parts, as before); `check` (0
  errors), clock-lint, `merc-tags --check` and your probes after the fixes; measure.py on each clip;
  re-prove the cuts on `recap`, `next` and `end`.

## Hand back
Per item: what changed (file and line), the numbers before and after, and a still or a crop that
shows it, under `P/lab/<sid>/fix-E-01/`. Then the probe counts, `check`'s result, measure.py's holds
and loudness per clip, the cuts, and anything you could not fix and why. Update each
`lab/<sid>/BUILD-NOTES.md`.
