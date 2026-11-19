# Brief: Lesson 5's film, scene group E (s13-recap, s14-next, s15-end)

Read `$S/briefs/l5-film-scenes-common.md` first (S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad);
its rules, reading list, build, proof and hand-back hold. This brief adds only your group's part.

- **Your scenes**: s13-recap (from the matched cut on `recap` to the cut on `next`), s14-next (to
  the cut on `end`) and s15-end (to the film's end). Rows: STORYBOARD § "Recap, practise, next
  time, end [E]"; HANDOFFS § Recap and practise, § The tease and the end card, § The breath figure
  (S13), § The cuts (S12 to S13, S13 to S14, S14 to S15). s13 runs about 64 s: prove it in parts.
- **Your first frame** carries the frame on F-turn's pixels (x 928 to 1824, band 104 to 202,
  Merc's line 153, no labels) across the matched cut on `recap` from group D, with `L.roomCut` for
  the room's 0.3 s crossfade. Draw it from the kit's one definition and HANDOFFS § The cuts; do not
  wait for group D. Group D has finished: its last frame is `lab/s12-your-turn/clip-still-76.75.png`,
  and its cut probe is `lab/s11-sing/cutprobe.mjs recap`. At the cut draw the frame's edges as
  F-turn showed them (2.8 px on screen) and ease them to 2 px through the slide (DECISIONS 202),
  so the frame matches to its fringe rows. Then **the frame moves, not the camera** (13a).
- **Merc's hops are back at the recap's clean break** (DECISIONS 190, which amends 160; read both):
  a silent beat, `break`, now stands between b54 and b55. The recap leaves up fast on the beat's
  start (not on "Practise it."), Merc hops twice across the empty floor in it, and the Voice
  Mirror card builds after he lands at (1290, 840), where he stays to the end. The `card` pause is
  the board's again: both cards drift and are read whole, the hosts idle. Key the clean break and
  the hops off the `break` cue (`L.at('break')`), never a typed second. The passes for s13 to s15
  are rendered for this and accepted (DECISIONS 211): `break` is 489.71 to 491.61 (film time),
  hop 1 starts at 490.310 (in the air 490.430 to 490.840, landing at 700), hop 2 at 490.960 (in
  the air 491.080 to 491.490, landing at 1290), the hop state ends at 491.620 and b55 starts at
  491.910; the renderer's root settles until 492.23 and `assets/merc/roots.js` cancels it, so
  place Merc as `merc/PASSES.md` says and he stays put. The lead's frame sheet of the hops, placed
  as a scene places them, is `review/merc/hops-190.png`. Scenes: s13 462.37 to 527.395, s14 to
  543.265, s15 to 549.465 (the film is 549.465 s). SCRIPT.md is regenerated and shows `break`.
- **Every card line is the page's, word for word** (DECISIONS 100; FACTS 54, 58 to 60, 78, 88, 89):
  the recap questions and answers, the Voice Mirror card, its readout, the rest card, the two
  closing lines, the tease line and Lesson 6's hook. Never shorten or reword one; the `[coach]`
  lines wait for the coach (LAB-CHECKS 22).
- **The bead crosses the cut on `next`** on one curve both scenes compute from film time (HANDOFFS
  § S13 to S14), and **the tease figure crosses the cut on `end`** the same way (§ S14 to S15):
  prove each with frame pairs either side, within 2 px. The tune's beads light on `twinkle`'s note
  onsets (FACTS 99); the dashed copy six rows up is never played.
- **The end card** (s15): the lockup's wipe, the address, the clear zone (x 80 to 1100, y 460 to
  880: nothing drawn and no glow, for YouTube's next-video element and Subscribe; DECISIONS 106),
  the 3 % push, Merc growing to 400 in place and Tavi's hop 190 px left. Complete for the last
  4.86 s, the hosts idling past the last frame.
- **Provisional values that are yours to confirm**, each with a lab still: the "settled" flag's
  place and time in card 3 (x 332, the line's 0.69 s, computed from FACTS 80's points by the page's
  rule; group C confirmed that rule for S10 at the page's own 16 ms readings (entry 0.704 s into
  the take, the flag at 1.204 s; DECISIONS 191, HANDOFFS § Provisional values): use the same rule
  and its settled-time code in `compositions/s10-steady.html`, without editing that file); the hop height, which is the pass's (measure it on the rendered frames; the floor is
  empty by then, so any height clears; say what it is).
- **LAB-CHECKS lines for you**: 21 for your lines (real font widths), 22 (the card lines, the
  coach), and the 0.4 s rule over your rows (§ Build checks); 2's wording for your matched cut on
  `recap` (the carried frame under 2 px, the room's crossfade with no spike).
- **Hosts** at 300 in the corners until the hops; Tavi asks q4 (o14a) and o15 from her corner;
  Merc sings `twinkle` (arcs on) standing under the tune's right end. Read `merc/PASSES.md`.
- **Decisions to read for your rows**: 99 and 100 (the cards), 106 (the end card), 122 and 190
  (the hops), 123 (the plain matched cut), and the kit's revision, 143 to 159.
- **Rules settled by groups A and B, which hold for you** (DECISIONS 164 to 189):
  - A ring timer stands beside the thing it asks about, never in a corner (175): the recap's ring
    timers in the panel, beside each question.
  - A short eased fade of 0.2 to 0.3 s puts its change into two frames, which measure.py flags as a
    pop; make such fades linear or longer (179). The hosts' blinks are expected events.
  - No frame left empty while something moves, and nothing flashes (171, 172): in the clean break
    the recap leaves up in turn and Merc's hops are the subject.
  - A word that switches in place is a swap, never glyph on glyph (183): the panel's questions.
  - A plate behind a label is the text box plus 4 px (`backPadX: 4, backPadY: 4`) and covers no
    stroke (182); the kit's default stays as it is.
  - Where the board holds a thing still for the eye, it holds on every clock (180): the cards'
    read in the `card` pause and the end card.
  - Holds in Merc's pauses go to the final passes (189): measure the holds and report them; add no
    motion for them now.
  - Every clip carries its scratch voice (render with the voice mix; the default `full` mix does
    not exist yet). The pad, the chimes and the end chimes come in the sound round.
- **Finished groups to learn from**: `compositions/s01` to `s07` and their `lab/<sid>/BUILD-NOTES.md`
  (the probe pattern: `lab/s01-cold-open/probe.mjs`, `lab/s05-push/probe.mjs`; a matched cut:
  `lab/s07-support/`; the bead's flight across a cut: `lab/s02-title/` and `lab/s03-promise/`).
  Reuse them; do not edit them, nor groups C's and D's scenes.
- **Your other group**: D ends where you begin.
