# Brief: group D's fix round after critic D-01 (s11-sing, s12-your-turn)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Your scenes went to a fresh critic. Its report is `P/review/critic-D-01/REPORT.md` (verdict ONE
MORE PASS; keep the hold itself, S12 21.4 to 36.6, as it is); its crops and measurements are in
that folder. The director's calls are DECISIONS 202 (your hand-back) and 204 to 210 (the critic's
items); where a call differs from the critic's suggested fix, the call holds. The board and
HANDOFFS carry `[D-01: n]` markers where they changed. This is the one fix round: no second critic
follows; the director checks your stills and numbers, so prove each fix with them.

## The fixes, in this order
1. **The turn's first minute** (204): the ring draws on at 35 % on "ten seconds," (11b), no
   counter; it scales 1.05 on "the ring." (11e); on b38 the six reasons fade, the rest of the
   block stays to the board's thinning.
2. **The end** (205): all four answers light on "Whatever you chose:", then the feel block dims
   to 35 % as the doctor lines rise, to the end fade; the full doctor lines broken by hand at
   phrase ends.
3. **The chart's labels** (206): "0", "10 s", "A3 · Merc" and "A4 · Tavi, an octave up" fade with
   the ring after the close; the band, Merc's line and "Nothing listens" stay.
4. **"Breathe in, low and quiet"** (207): 12 px or more from the ring at its largest breath, on
   the line of "Nothing listens".
5. **The ring's bounds** (208): at rest 8 px or more above the floor horizon (y 840) and 12 px or
   more below "Nothing listens"; at its largest breath it touches neither. Record the radius and
   centre you set (the director moves them into HANDOFFS § The turn).
6. **The feel lines and the phase row** (209): "rest for a few easy breaths" (the page's words),
   left of x 1630; the phase row's unlit words at ink-2 60 %, the lit one at ink with a small
   chrome mark under it.
7. **Holds, the push, the sound** (210): nothing to do now; report the holds again.

## Rules
- Every render and every probe through `$S/bin/heavy`, one at a time; other groups render beside
  you. The passes builder may replace `assets/cues.js`, `assets/scenes.js` and `index.html` by
  rename while you work (only events from b55 on move); if a render fails on a half-read file,
  run it again once.
- Edit only your two compositions and their lab folders. Do not edit `assets/lib/`, other groups'
  scenes, the passes, HANDOFFS, LAB-CHECKS or the board; name in your hand-back any number of yours
  that a document should carry.
- Re-render both clips with the scratch voice mix; `check` (0 errors), clock-lint and your probes
  after the fixes; measure.py on each clip; re-prove the cuts on `sing`, b38 and `recap`.

## Hand back
Per item: what changed (file and line), the numbers before and after, and a still or a crop that
shows it, under `P/lab/<sid>/fix-D-01/`. Then the probe counts, `check`'s result, measure.py's holds
and loudness per clip, the cuts, and anything you could not fix and why. Update each
`lab/<sid>/BUILD-NOTES.md`.
