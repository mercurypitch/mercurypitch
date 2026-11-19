# Brief: the leftovers round before integration (s01-cold-open, s06-diaphragm, s07-support)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

Two small items were left when the director accepted groups A's and B's fix rounds. Each is one
change, one render and its proof; no critic follows (the owner's rule), the director checks your
stills and numbers. Part 1 is group A's (s01), part 2 is group B's (s06 and s07). If you are given
only one part, do only that part.

## Part 1, group A: Merc's amber line through the softening bead (DECISIONS 178)
- In S1, Merc's amber line shows through the bead's disc as the disc softens (38.30 to 38.53),
  drawn over the bead. It fades out by `hook` + 0.65, before the disc softens, as 1h always meant
  ("fades under the glow"). Key it off the clock (`L.at('hook')`), never a typed second.
- Prove it: frames every 1/30 s through the bead's softening (from `hook` + 0.5 to the cut on
  `title`) with no amber pixel inside the disc after the fade; the fade itself linear or longer
  than 0.3 s (DECISIONS 179: a short eased fade is a pop); the S1 to S2 join and the bead's flight
  unchanged (re-run your cut probe); measure.py on the new clip.

## Part 2, group B: "never your throat" off the floor horizon (DECISIONS 203, the rule of 188)
- In S6 the two lines under the figure ("with your breathing muscles," world baseline 800 and
  "never your throat" 838, x 260) sit on the floor horizon at F-gauge: the horizon (screen y 840)
  runs through "never your throat"'s x-height from 34.87 to 48.20. No type comes within 12 px of
  the floor horizon on any frame it shows: move both lines up (your measure: 27 px) and shorten
  the legs further (your measure: 18 px more), keeping the legs' end at least 20 px clear of the
  first line, as now. S7's first frame carries the figure on F-gauge's pixels, so make the same
  change there; the S6 to S7 cut must still match to 2 px on the carried figure and labels.
- Prove it: the lines' screen boxes against y 840 on every framing they show in (F0 and F-gauge,
  and through the push), the legs' end against the first line, the S5 to S6 join (S6's first frame
  should be unchanged: say if it is not), the S6 to S7 cut with frame pairs either side, S7's last
  frame unchanged for group C's S8; your probes, `check` (0 errors), clock-lint, measure.py on
  both clips.
- Name the new baselines and the legs' mask in your hand-back: the director moves them into
  HANDOFFS § The breath figure (S6).

## Rules
- Every render and probe through `$S/bin/heavy`, one at a time; other groups render beside you.
- Edit only the named compositions and their lab folders. Do not edit `assets/lib/`, other
  groups' scenes, the passes, HANDOFFS, LAB-CHECKS, DECISIONS or the board.
- Render with the scratch voice mix. No voice, image, video or music service; never production;
  no attribution, emojis or model names in any file; do not commit or push.

## Hand back
Per part: what changed (file and line), the numbers before and after, a still or crop that shows
it under `P/lab/<sid>/leftovers/`, the joins and the cut, `check`'s result, the probe counts and
measure.py's holds and loudness per clip. Add a "Leftovers round" table to each
`lab/<sid>/BUILD-NOTES.md`.
