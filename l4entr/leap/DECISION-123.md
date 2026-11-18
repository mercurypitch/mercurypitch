123. **Tavi's entrances in S5g and S6d are leaps in from the right edge at floor level (critic FILM1
     item 5, in part; component critic B-05's held item 1).** FILM1 saw the same fall six times and,
     at 1:50 and 2:15, Tavi falling through the top-right labels. These two become the film's
     floor-level entrances; the other four falls stay (m04 at 1:02, m07 at 3:18, Merc's m10 at 4:42
     and both Mercs at 5:43).
     - The passes. m06a-orange and m06b-orange open on one cycle of the renderer's celebrate jump in
       place (CEL in src/lib/merc/sim-choreo.ts: a crouch of 0.15 s, 0.43 s in the air, a landing
       squash with its small splash, settled by 0.8 s), started LEAP (1.38 s) before her first word
       (o5, o6), so she lands 0.80 s before it, 0.25 s sooner than the drop's splat, and is settled
       0.58 s before she speaks: in the air 109.65 to 110.08 and 134.70 to 135.13 (s05 40.30, s06
       23.82, as B-05 asked). No tall intro: a leap starts whole. `tools/merc-shots.py` gives them
       `enter=('celebrate', ...)` with the entrance's length as `drop` (LEAP_LEN 0.8).
     - The kit. `L.mercGate(..., { leap: true })` holds the box 300 px off her corner, the whole
       box beyond the right edge, through the crouch, and carries her in while she is in the air: straight across,
       as a ballistic leap is, with 70 px of arc on top of the renderer's own (about 33 px at 300),
       so it reads as a leap and not a skim. The reflection, which rides inside the box, is lowered
       twice the lift, so it stays a mirror image about the floor; the floor patch comes up as she
       lands. Every other pass ignores the option. Group B's shared `tavi` helper passes it through,
       and s05's m06a and s06's m06b turn it on.
     - So Tavi now lands inside S5 (110.08), and S5's last 0.8 s show her in her corner: HANDOFFS
       § S5 to S6 has her landed and settled at the cut, not dropping in.
     - The renders: the repo's node_modules is gone from this container, so both passes were
       rendered with the container's Playwright 1.56.1 (PLAYWRIGHT_MODULE) driving the same Chromium
       1194 and the same prebuilt Merc bundle (assets/merc-lib) as every other pass.
     - Seen on lab stills (lab/entrances/s05-m06a-leap.jpg, s06-m06b-leap.jpg): she is off frame
       through the crouch, comes in at the top of her arc about 0.18 s into the jump, lands with the
       squash and its small gold splash, and her eyes open again about 0.3 s later; on screen for
       about 0.25 s. The carry was 360 px first; 300 shows more of the arc's top. Left for the film
       critic: the renderer's floor light rides up with the box's extra lift (up to 70 px, for about
       0.2 s) and reads as her own glow; if it reads as a floating light, the long fall's mask is the
       fix. The S5 to S6 cut is two consecutive pass frames (mean difference 0.08).

