# Brief: Lesson 5's board, v3 (the paper fixes after the last storyboard critic)

You edit the storyboard of Lesson 5's film ("Breath and a steady note") on paper. No build, no
render, no voice, image, video or music service, no repository work.

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film

## What you may change
- `P/STORYBOARD.md`, `P/HANDOFFS.md`, `P/DECISIONS.md` (append only), and a new `P/LAB-CHECKS.md`.
- Nothing else. `script.json`, the clock, every scene's start and end, `BRIEF.md` and `FACTS.md`
  stay as they are. If a fix would need one of them, do not make it: say so in your hand-back.
- A builder is setting up the film's tools in `P/tools`, `P/assets` and the project's root, and
  reads the board while you edit it. Leave every other file and folder in P alone.
- No attribution, no emojis, no model names in any file.

## Read
1. `P/review/storyboard-02/REPORT.md`: the last critic's report. Item numbers below are its own.
2. `P/STORYBOARD.md` (v2: its header maps the first critic's items, and changed rows carry
   "[v2: n]"), `P/HANDOFFS.md` (every position; the layers and framings), the last two sections of
   `P/DECISIONS.md`, and `P/BRIEF.md` for the film's rules if you need them.
3. Lesson 4's board is not needed.

## The lead's calls

Mark every row and HANDOFFS paragraph you change "[v3: n]" with the report's item number, and add a
v3 table to the board's header (beside v2's) that maps each item to where it was fixed. Positions
are HANDOFFS arithmetic; type widths by the report's estimates (Outfit about 0.5 em a character;
JetBrains Mono 0.6 em plus .18 em tracking). For every geometry fix, write the clearance you get.

**Fix on paper (the report's "Fix on paper now"):**
1. 6k (172.92-179.40): "less holding back at first" goes back to the v1 slot: x 760, baseline 765,
   with a leader up to (900, 430). Check the slot is free for the whole window.
2. The label-row chips: "LISTEN ONLY" left-aligned at x 1536, centred y 140, right of the plot
   (S1, 21.48-31.30). In S5 the definition goes on its own line at world baseline 200, so the four
   words' row and the "ILLUSTRATION" chip no longer meet it. Chips are one size everywhere: HANDOFFS'
   26 px (see 11 below); recheck the widths at that size.
3. The missing tags, all four as the report says: the gauge's "ILLUSTRATION" inside the frame's top
   right (right-aligned 1630, centred y 320) for 106.20-184.00; "LISTEN ONLY" right-aligned 1600,
   centred y 350 while the catch plays again in `starts` (281.37-303.35); the strip's
   "ILLUSTRATION" chip at centred y 150; and the CU-scoop chip reads "SLOWED · ILLUSTRATION"
   (326.1-333.9) and stays in frame.
4. 12c: the push runs **422.80 to 423.90** (power2.inOut), so it has landed before "Listen"
   (424.04). The care block thins at **422.30 to 422.60**, and the phase row and its two lines under
   the ring leave up fast in the same window. b41's gap stays 0.2: the clock does not change.
   Update every place that times this push or that thinning (the header's map, 12c, 12d if it
   names the landing, HANDOFFS § The turn and § Framings, any summary table).
   **And the report's item 7, now:** "Your turn." (frame-fixed, x 260, baseline 200) does not fade
   at the push. It stays through the viewer's ten seconds and fades with the ring, its word, the
   counter and the playhead (438.60 to 439.00). On the left during the turn: "Your turn.", the stop
   line, the small doctor lines. Check that nothing of the frame's, the hosts' or 12f's meets it
   (Merc's body ends at x 190, his arcs at about x 225; "How did that feel?" lands at x 1000,
   baseline 480, from 439.00).
5. 9a and 10a: the subject leaves from dim; it is not brought back to full before it leaves. The
   chart's fade starts at 303.40. Write the exact times you settle, and check that 303.65-304.10
   no longer pushes onto an empty room (say what is in frame).
6. The floor and its reflections are screen-space, with the hosts, at every framing: never on a
   parting layer. Say it once in HANDOFFS' layer section, and where the F-strip and F-gauge
   framings list what moves.

**Also on paper (small ones from the rest of the report):**
- Previous item 2: correct S10's sentence about empty bands. The floor band (y 700-840) is empty
  from 304.9 to 324.6; it is the floor, and that is accepted.
- Previous item 5: at 342.00 the axis, "A, any octave" and "settled" come back together. Stagger
  them inside the row's own window: the main one first, the others 0.2 to 0.3 s apart.
- Item 9: "can't push air out" is 30 px; write its size. The tall arrow (x 925) and "knees
  unlocked" (right-aligned 950): move the label, not the arrow, to keep 16 px. 5g: point both ends
  of the fork at the peak (x 772-990) and put "louder" where it is not on the strip's fill.
  '"support"': its descenders keep 12 px above Merc's line at its highest mid-pull (32.87); move
  the word, not the line. The Quiet and Loud chips keep at least 12 px from what is next to them.
- Item 11: 7c: "more pressure, not less" lands when it is said (195.55), and "same push: much
  quieter" lands with the strips. 6b: say when Merc's line goes (the row it leaves in, and how).
  The chips: one size, HANDOFFS' 26 px, in the board's codes too.

**Leave for the lab.** Write `P/LAB-CHECKS.md`: one line each, with the row or time, what to look
at in the lab stills or clip, and the pass rule. In it: the report's items 8 and 10; any part of
item 9 you could not settle on paper; every point of its "Not judgeable on paper" list; and this
one: on the voiced clock, the push in 12c still lands before "Listen" is said.

**Record in `P/DECISIONS.md`**, in a new section "## Storyboard v3 (18 November 2026)", numbered
from the next free number: one decision for each item above with a one-line reason. Then the
lead's answers to v2's open questions, as decisions, and mark Q30 to Q32 answered the way v1's
section does:
- Q30: KEEP the small doctor lines on the left through the viewer's turn: the brief keeps them on
  screen to the end of the turn, and safety outweighs a cleaner frame. With them stay the stop line
  and, from v3, "Your turn." (to 438.60).
- Q31: ACCEPTED: Merc's two hops at the recap's clean break (508.85-510.05), on an empty floor; the
  tease's beads stay where they are.
- Q32: KEEP the plain cut: at the three matched cuts the carried object holds its pixels and the
  faint room cuts back to rest, with no second set of room numbers. The lab checks that the near
  layer's snap does not read as a one-frame event (report item 10).
- The length (the report's previous item 10): decision 99 stands. Length is judged on the voiced
  clock.

## Hand back
Each item and what you changed where (row ids, HANDOFFS paragraphs, the clearances you got); what
you could not settle and why; the new decision numbers; the path of LAB-CHECKS.md. Keep it short:
the lead reads the diff against `P/review/storyboard-02/before/`.
