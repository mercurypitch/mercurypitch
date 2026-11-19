# Brief: the full-film fix round after critic F-01 (every scene group)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

The whole film was rendered (`P/renders/film-draft-01.mp4`, 9:09.47) and read by a fresh critic. Its
report is `P/review/critic-F-01/REPORT.md` (verdict ONE MORE PASS: the long beats are a thin strip or
a block of small type in a dark frame, too many frozen frames, blocks that only change when a line
lands, four collisions, the cold open's guess); its crops and sheets are in that folder. The
director's calls are DECISIONS 225 to 233; where a call differs from the critic's suggested fix,
the call holds. This is the film's last critic round: no critic follows your fixes; the director
checks your stills and numbers, and then the owner looks at the film. Times below are film times
(the scene table is `P/assets/scenes.js`); map them to your scene's clock by its start.

Do only your group's section. Every fix keys off the clock (cues and words), never a typed second.

## Group A (s01-cold-open, s02-title, s03-promise, s04-recall)
1. **The cold open's guess reads** (230): the take dims to 50 % while the guess shows (8.4 to
   26.6), as the board says; the dash drawn at 4 px.
2. **Collisions** (229), 12 px or more on every frame: '"support"' clear of the band's fill and
   edge through the pull (32.1 to 33.5, `crops/c032.6-support.png`); S2's title gone before "A3"
   and the band land (41.5 to 41.6); S4's four chips clear of the band's line through the crane up
   (65.43 to 65.57).
3. **S3 and S4 fill their lower half** (226): the strip and the swatches at about 1.5 times, set
   lower, clear of the hosts' keep-outs.
4. **Type that steps a pixel in slow moves** (233): s01's "in the band" (6.27, 10.80, 13.93, 19.73,
   24.27), its chip (17.80, 27.87) and the "support" row (33.03); s02's title and staff (40.17,
   40.70); s04's swatch labels (55.27, 55.67). Move them sub-pixel, as the kit's chapter card now
   does (a composited layer, `marks.js`), and show the events gone.
5. **Holds inside words** (227).
6. Re-prove the joins S1 to S2 (the bead), S2 to S3, S3 to S4 and S4 to S5.

## Group B (s05-push, s06-diaphragm, s07-support)
1. **Blocks light as said** (228): S7's mix-up rows, where shown whole, light line by line; S6's
   gauge labels pulse when the voice names them again (the gauge holds one layout for 46 s).
2. **Holds inside words** (227): S7 has 2.9 s and S6 2.2 s per 30 s; the longest hold in the film is
   0.6 s at 160.9 to 161.5, inside Tavi's o7 (S6).
3. Re-prove S5 to S6, the S6 to S7 cut and S7 to S8.

## Group C (s08-breathe, s09-onset, s10-steady)
1. **S10's hold chart is the lead subject** (226): from the push in (10b) to "No." (10g) the band
   stands 220 px or more tall and the plot spans 1150 px or more at F-hold; the close-ups keep the
   band's edges in frame; the chart's cents scale may grow (the take, its vibrato and its scoop with
   it); every label re-places, 12 px from every stroke; 10h's slide shrinks the frame into the hold
   frame at the right half, so the cut on `sing` is unchanged. Name the new numbers for HANDOFFS.
2. **S9's trace box** appears with its first trace (about 243.6), not before (233.0 to 243.9).
3. **S8's "03" clears the parked figure** (229; 209.5 to 210.1) by 12 px; S8's kicker leaves over
   0.2 s or more, linear (233; 219.93); s10's type step at 326.93 (233).
4. **Holds inside words** (227): S8 3.8 s and S9 2.9 s per 30 s.
5. Re-prove S7 to S8, S8 to S9, S9 to S10 and the cut on `sing`.

## Group D (s11-sing, s12-your-turn)
1. **Blocks light as said** (228): the care block's reasons, where shown whole, and the full doctor
   lines (they rise whole) light line by line as said, staying lit; the underlines on their words
   stay as they are.
2. **The band after the hold** (226): it dims to 50 % while the feel block and the doctor lines are
   the subject (about 422 to 462), and is back at full 0.5 s or more before the cut on `recap`.
3. **The dimmed feel block keeps 4.5:1** (231): about 50 %, measured on "How did that feel?" and the
   capsules' lines.
4. **Type steps** (233): s12's ring and "Breathe" at 410.13 and 411.07. **Holds inside words** (227):
   S11 2.6 s per 30 s.
5. Re-prove the cuts on `sing`, b38 and `recap`.

## Group E (s13-recap, s14-next, s15-end)
1. **Blocks light as said** (228): the practise card's readout, and any of its rows shown whole,
   light line by line as said.
2. **Type steps** (233): s13's drift at 471.27 and the cards at 525.23 and 526.50; s14's hook
   starting to rise at 543.03. **Holds inside words** (227).
3. Your lab check `lab/s13-recap/checks.js` (`mercSeen`) reads Merc's root with the old index; switch it
   to the kit's `L.passFrame` (DECISIONS 234).
4. Re-prove the cuts on `recap`, `next` and `end`.

## Rules (every group)
- Every render and probe through `$S/bin/heavy`, one at a time; other groups render beside you.
- Edit only your compositions and their lab folders. Do not edit `assets/lib/`, other groups' scenes,
  the passes, HANDOFFS, LAB-CHECKS, DECISIONS or the board; name the numbers a document should carry.
- The kit's `L.mercGate` now reads the root on `L.passFrame` (DECISIONS 234); it changed only Merc's
  place in s13's hops.
- Re-render your clips with the scratch voice mix; `check` (0 errors), clock-lint, `merc-tags
  --check` and your probes after the fixes; measure.py on each clip (holds per 30 s, the longest,
  the events).

## Hand back
Per item: what changed (file and line), the numbers before and after, and a still or a crop under
`P/lab/<sid>/fix-F-01/`. Then the probe counts, `check`'s result, measure.py's holds and events per
clip, the joins and cuts, anything you could not fix and why, and the numbers HANDOFFS should carry.
Add a "Fix round F-01" section to each `lab/<sid>/BUILD-NOTES.md`.
