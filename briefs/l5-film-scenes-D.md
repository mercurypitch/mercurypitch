# Brief: Lesson 5's film, scene group D (s11-sing, s12-your-turn)

Read `$S/briefs/l5-film-scenes-common.md` first (S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad);
its rules, reading list, build, proof and hand-back hold. This brief adds only your group's part.

- **Your scenes**: s11-sing (from the matched cut on `sing`, 364.73) and s12-your-turn (from the
  cut on b38, 402.58, to the matched cut on `recap`, 478.09). Rows: STORYBOARD § "Sing it and your
  turn [D]", and HANDOFFS § The hold frame at the right half, § The turn, § Framings (F-turn) and
  § The cuts (S10 to S11, S11 to S12, S12 to S13). s12 runs about 76 s: prove it in parts.
- **Your first frame** carries 10h's empty hold frame across the matched cut on `sing` from group
  C (still building): draw it from the kit's one definition (`L.CHART.FRAME`), on the pixels
  HANDOFFS § The cuts fixes (x 1000 to 1640, band 210 to 280, Merc's line y 245, no labels), with
  `L.roomCut` for the room's 0.3 s crossfade. Build from that; do not wait for group C. The
  director checks the frame pair once both clips exist.
- **Your last frame** carries the frame on F-turn's pixels (x 928 to 1824, band 104 to 202, line
  153, no labels from 477.60) across the matched cut on `recap` into group E's S13, again with
  `L.roomCut`. The push in 12c (F0 to F-turn, 1.4x, 422.80 to 423.90) does not come back.
- **Signature 3, second half** (12e, STORYBOARD § Signature moments): the viewer's ten seconds.
  The ring is a clock (DECISIONS 104): even fill, a seconds counter, no pulse, the hosts idle, no
  violet line, nothing that reads as listening (LAB-CHECKS 19). Room tone only.
- **The care block is the page's words, word for word** (HANDOFFS § The turn; FACTS 47 to 52):
  the doctor lines, the comfort line, the six reasons, the stop line, the listening line, the
  feel answers and their lines. Never shorten or reword one; the coach signs them off later
  (LAB-CHECKS 22). The icons are `L.icon` (no emoji).
- **Provisional value that is yours to confirm**: Merc's arc reach beside the care block at 300
  (LAB-CHECKS 15: stills at 424.00 and 433.00, "Your turn." 12 px or more from Merc's measured
  arcs). Write what you measure in your hand-back.
- **LAB-CHECKS lines for you**: 2 (both your matched cuts, on `sing` and on `recap`: frame pairs
  either side and measure.py over 0.5 s round each), 3 (12c's push has landed at or before
  `listen` and "Listen" on the voiced clock; the care block's thinning against the stop line), 15,
  19 (12e watched with sound
  off and on: say what you see, the critic judges), 21 for your lines (real font widths), and the
  0.4 s rule over your rows (§ Build checks).
- **Hosts** at 300 in the corners. Both sing `listen` in 12d with arcs on; in 12e both idle,
  turned to the ring, no arcs, never `listen`. Read `merc/PASSES.md` (re-rendered on 18 November:
  a listen holds at most 3 s, then idle with eyes on the speaker; DECISIONS 160 to 163).
- **Decisions to read for your rows**: 104 (the ring), 112 (the push lands before "Listen"), 113
  ("Your turn." stays through the ten seconds), 121 (the doctor lines on the left), 123 (the plain
  matched cut), and the kit's revision, 143 to 159.
- **Rules settled by groups A and B, which hold for you** (DECISIONS 164 to 189):
  - A ring timer stands beside the thing it asks about, never in a corner (175): 12f's small ring
    beside "How did that feel?".
  - A short eased fade of 0.2 to 0.3 s puts its change into two frames, which measure.py flags as a
    pop; make such fades linear or longer (179). The hosts' blinks are expected events.
  - No frame left empty while the camera moves, and nothing flashes: a push or a cut spreads its
    change over its whole length (171, 172). In 12c the block thins before the push, and the frame
    and the ring carry it.
  - A word or a digit that switches in place is a swap, never glyph on glyph: the old out, then the
    new in, within the board's time (183): "Listen" to "Breathe" to "Sing" in the ring, and the
    counter's seconds.
  - A plate behind a label is the text box plus 4 px (`backPadX: 4, backPadY: 4`) and covers no
    stroke (182); the kit's default stays as it is.
  - Where the board holds a thing still for the eye (a hold, a read), it holds on every clock: a
    shorter clock speeds the motion, never shortens the hold (180).
  - The turn stands at F-turn for about 54 s (423.90 to 478.09). Add no camera drift (the matched
    cut's pixels are fixed); measure the holds and report them. Holds in Merc's pauses go to the
    final passes, which give the hosts an idle in every pause over 0.25 s (189).
  - Every clip carries its scratch voice (render with the voice mix; the default `full` mix does
    not exist yet). The ticks and the pad come in the sound round (LAB-CHECKS 16), not now.
- **Finished groups to learn from**: `compositions/s01` to `s07` and their `lab/<sid>/BUILD-NOTES.md`
  (the probe pattern: `lab/s01-cold-open/probe.mjs`, `lab/s05-push/probe.mjs`; the matched cuts:
  `lab/s07-support/`). Reuse them; do not edit them, nor s08 to s10 (group C works on them now).
- **Your other groups**: C ends where you begin; E begins from your last frame on `recap`.
