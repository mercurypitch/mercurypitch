# Build notes: group F (s14-recap, s15-next, s16-end)

Running notes so a container restart or a usage-limit pause can resume. Builder F owns
`compositions/s14-recap.html`, `s15-next.html`, `s16-end.html` and `lab/s14-recap/`, `lab/s15-next/`,
`lab/s16-end/` only. Clock: Kokoro scratch, 483.73 s (cues.json = tools/board-cues.json today).
Never touch s12/s13 (builder E, in progress).

## Spans

- s14-recap 405.494 to 470.243 (D 64.749); cuts on recap (405.644) 0.15 s early.
- s15-next 470.243 to 478.529 (D 8.286); cuts on next (470.393) 0.15 s early.
- s16-end 478.529 to 483.729 (D 5.200).

## Merc passes (m12-blue, m12-orange; 8,438 frames each, filmStart 343.2, size 520, front view)

- 10:00: both still .part.webm. L.mercGate warns and uses 30 until whole.js lists them (harmless here:
  the drop is in S12, so the gate's frame lies long before S14).
- Celebrate in the pass at pass t 136.2 (film 479.4) to 137.05 (480.25): the hop 479.4 to 480.0.
- S14, S15: L.mercGate, x 110 and 1800, size 300, feet 0.81, floor patch on.
- S16: L.mercGate at the end pose (330 / 1590, 520, floor off); the scene sets each box's transform after
  the gate's draw (scale about the feet + translate) for the grow-and-move, and draws its own floor
  patches that match the gate's at the cut and widen with the Mercs.

## Plan, s14 (anchors by role)

See the scene's anchor table (comments in compositions/s14-recap.html). Hold plan with no Merc in the lab
clip: every gap between counted events under about 0.45 s, the ring timers carrying q1 to q4, larger
events in the card pause (icon pulses that register, then the address once more).

## Log

- 10:00 read everything; plan written.
- 10:25 s14 built (all rows 14a-14g), tags written (merc-tags s14-recap), clock-lint clean. Stills round 1
  (lab/s14-recap/frame-*.png): frame 0 matches E to F; F-recap-1, 14b labels, 14c no-scale at 424.0, D major
  keys at 428.5, F-recap-3 bead on ti, S at 438.1, G at 452.1, ladder 459.0, card 466.0, empty at 470.2.
  Clip rendering (lab/s14-recap/clip.mp4).
- 10:30 s15 built, tags, clock-lint clean, stills lab/s15-next/frame-*.png and sheet-r1.png.
- 10:35 s16 built (Lesson 2's s17 adapted), tags, clock-lint clean, stills lab/s16-end/frame-*.png, sheet-r1.png.
  Text sweep s15 + s16 clean (lab/s15-next/sweep). Ink extents (frame-06-at-5.19s): skip line x 636-1284 and
  the Scale Runner line 680-1239 (HANDOFFS' 636-1284 exactly); address x 356-1567.
  Fixes after round 1: the gate's corner patches carried hard outer edges into frame as the Mercs grew: they
  now hand over to a full room floor (own layer, no drift) over the move; the underline raised to y 449-452 so
  the address keeps 55 / 25 px over the heads.
- Practise card ink (s14 frame-09-at-60.5s): L1 x 436-1484, L2 640-1281, L3 (the 710 line, the widest)
  410-1509 (inside 310-1610 by 100 px each side), L4 683-1236, L5 741-1178, L6 585-1334, its descenders to y 896.
