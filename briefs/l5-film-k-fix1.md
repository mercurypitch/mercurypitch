# Brief: the kit's fix round (after critic-kit-01)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

The critic's report: `P/review/critic-kit-01/REPORT.md` (its measurements and crops are in the same
folder). The lead's answers to your seven questions: `$S/leadnotes/l5-kit-answers.md`. Do both.
The rules of your kit brief hold, with one change: for items 6, 7 and 9 below you may edit
HANDOFFS (and LAB-CHECKS line 20), marking each change "[kit-01: n]", with a DECISIONS entry each
(next free number). Merc's passes are still rendering in P: leave `merc/` and `tools/merc-*`
alone; when `assets/merc/roots.js` appears, add it to `scripts.txt` (answer 2).

## The lead's calls on the report

1. **The figure: redraw it.** One continuous side-profile outline facing right, a body and not a
   bottle: the head with a face in profile (brow, nose, lips, chin, so no jaw line crosses the
   head), the neck front and back, the back, chest, belly and hips, and two legs as outlines
   (thigh, knee, calf, foot, both from the hips). Chrome stroke 3 px at k 1 as now, with a faint
   fill (at most 8 % ink) so it reads as a body. Inside it: lungs, ribs and the dome, the dome's
   ends joined to the inner side of the back and of the belly wall at every moment (as the belly
   wall bows out to u 360 and comes back in to u 315, the dome's front end goes with it). Keep the
   figure-units frame and every anchor the board names (head centre, throat point, shoulder, lungs
   centre, dome apex and ends, belly front, hips, knee, soles) at the same figure units, and keep
   each scene's `k`, `x0` and `y0`, so every label, leader and position in HANDOFFS stays right.
   Show it in the lab in all four places (S6 torso, S7 parked, S8 whole, S13 card) and breathing in
   and out.
2. **The gauge**: take all three fixes (opaque backs to the labels the cursor passes, as the
   ground; the readout switches to its "adding" words at the crossing, in the board's own words
   for 6f; "added" lands inside its hatch at the crossing, not under the axis from the start).
3. **The chapter card**: cap its width at 1680 px through the breathing scale, scaling a long title
   down to fit.
4. **The turn**: in the lab, follow board v3: the phase row and its two lines leave up at 422.30 to
   422.60, before the push, so nothing rides the push into the caption band.
5. **The bead pass**: the field breathes (never still over 0.2 s), carries a dither so no band
   shows when the contrast is stretched, and sits at Lesson 2's luma (113 to 122). Add a lab of its
   exit onto the title.
6. **The matched cuts: the room crossfades over 0.3 s** (this replaces DECISIONS 123's plain cut):
   the incoming scene draws the room at the outgoing framing (its `L.FRAMES` state) fading out
   over the room at rest; the carried object holds its pixels throughout. Give the kit one call for
   it, and a lab that holds a carried object across a cut, so LAB-CHECKS 2 is tested.
7. **The push to F-gauge**: keep F-gauge's numbers (no ripple through HANDOFFS). The push runs the
   whole 10 s with no still stretch over 0.5 s at either end (a gentler curve than power2.inOut);
   the cursor carries the beat. LAB-CHECKS 20's pass becomes "the frame keeps moving through the
   10 s (no still stretch over 0.5 s) and the layers part".
8. **The four words**: 12 px between chips.
9. **CU-scoop**: anchor the scoop near x 360 on screen, the wave running right across the frame:
   change CU-scoop's numbers in HANDOFFS § Framings and anything placed at CU-scoop, with the
   clearances re-measured (the "SLOWED · ILLUSTRATION" chip included).
10. **The recap's first frame**: the wave follows the wave rule at the recap frame's scale (no
    cycle narrower than the rule allows), and only Merc's line shows at the cut, as in 12h.
11. **The minor ones**: the line's tail clear of the "0" by 12 px; the mix-up lab shows row 0's
    dashed underline and "?", and row 1's chip; **check against the board which of S1's two pills
    gets the tick** (kit-type 3.90 ticks the first, "Settle, steadier than before"): the lab must
    tick the one the board ticks, and say which in your hand-back; every chip stays inside the frame
    with 16 px to spare at every framing.

## Prove
Re-render the stills and clips the fixes touch; re-run the probe (every check passing, new ones
added for these fixes); root `check` 0 errors; clock-lint silent. The lead looks at the new stills
directly; there is no second kit critic, so look hard at your own.

## Hand back
Each item and what changed where, with the still that shows it; the probe's count; HANDOFFS and
LAB-CHECKS lines you changed; the new DECISIONS numbers; anything you could not do.
