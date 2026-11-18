**Verdict: SHIP to the build, once items 1 to 3 are edited.** They are small edits. The component rounds for S6 to S8, S10 and S14 can check them on pixels, so a fourth storyboard round is not needed.

I did not write the report file, because this harness does not allow report files. Please save this text to `/home/user/mercurypitch/output/motion/lesson-04/review/storyboard-03/REPORT.md`. You passed on no opinions, so there were none to ignore. I did not read DECISIONS, LEDGER or any composition source. Times are on the scratch clock (483.73 s).

**Previous report (storyboard-02)**

1. Contrast: **FIXED.** Lit chrome is now 40 %. Ink measures 4.88:1 on a lit stair and 5.24:1 on a lit black key.
2. "Your turn." over the moving guide: **FIXED.** When it lands at 373.55, the top "do" name has moved to x 857, 46 px clear of the title (x 360 to 811).
3. Tavi's bead path: **FIXED.** The bead now drops onto stair 1 (14.79 to 14.99).
4. S14 strip: **PARTLY.** 14d and 14e now follow the staircase, but 14c does not (item 1).
5. Ring timer during the viewer's turn: **FIXED.**
6. Push that stops and restarts: **FIXED.** The Hermite leg starts at 0.0246/s, matching the first leg's 0.0245/s, and ox and oy also match.
7. Smaller items: **FIXED, all six.**

**Shots as read**

- 0 to 32.8: WS, F-cold, drift only. Then a push through the house into the field, and the title.
- 37.6 to 46.9: WS, F-cold, then a pull and pan to F0.
- F0 is broken by push and pull pairs to:
  - CU-A, then a 480 px pan
  - F-low, then a truck
  - F-white
  - CU-D, then a crane down
  - F-near and F-names: one 14 s push, then a truck and a pull
  - CU-C, F-chart, F-recap-1 and F-recap-3
- 343.7 to 405.4: the guide, with a static camera.
- Then the ladder and card, a type card, and the end card.

It reads as the board says.

**Problems, ranked**

1. **Card 2 shows the misconception (422.3 to 427.22, the keyboard strip).** The staircase slides to D, but C major's eight keys stay lit. Stairs 3 and 7 stand over lit F4 and C5, while F♯4 and C♯5 are dark. Through the question and q2, the picture says "the white keys".
   - Fix: at 421.4, fade the eight lit keys to 45 % with the rest. Light D major's keys at 427.22.
2. **Beads touch the riser labels (S6b 118.1 to 123.5; S7e 171.8 to 175.8; S8b and S8c 209.0 to 216.0).**
   - At rest: a "T" spans the column centre +22 to +47, and a resting bead (r 22) ends at +22. That leaves 0 to 3 px.
   - In flight: each hop's take-off crosses the label's top-left corner for 2 to 3 frames. The overlap is up to 4 px on a tone and 7 px on a semitone.
   - That is 28 hops, which breaks the board's own bead rule.
   - Fix: right-align each label 2 px left of the riser bar (centre +55), and put each hop's x on sine.inOut so the bead rises before it travels. That gives 8 px at rest and at least 2 px in flight.
3. **Merc's S10b arc has no apex (283.27 to 283.57).** The straight line from (130, 715) to (298, 642) passes 2 px from stair 1's corner (242, 664).
   - Fix: give the arc an apex at least 40 px above the chord.
4. **The ladder shows a run no preset plays (453.9 to 469.7).** "A4", "B4" and "C5" place it on G4, but the preset anchors in FACTS 44 are A2, C3, E3, A3, C4 and E4. The app also draws the target line and rungs green (`PitchOverTimeCanvas.tsx:442`, `:546` at `b803c7d43`).
   - Fix: add a facts line saying G4 is an example start, or tip the staircase from C4.
5. **Smaller items.**
   - "Your turn." (373.55) and the first care line (373.57) land together, and the doctor lines follow at 373.9. Land the care lines at 373.85.
   - The fill of S11b's diatonic chips is not specified, and the chips sit over the staircase dimmed to 20 %.
   - HANDOFFS says "do" clears x 831 at 373.50. It is actually at 812.
   - In 12a the rows "widen", but they narrow.
   - 1g's "holds for a beat" does not match: the lines leave 0.07 s after the question ends.
   - White-key letters measure 9.3:1, not 11:1.

**Numbers**

- All 152 quoted word times match `cues.json`. The only flag is "ti", which the voice spells "tee".
- Text widths come from the project fonts. The doctor lines measure 495, 555, 542, 533 and 363 px, so the widest ends at x 915. "Your turn." is 451 px. "still hanging?" sits 65 px from its ring.
- Contrast is WCAG contrast on the mixes HANDOFFS gives: blue 5.67:1, orange 6.10:1.
- The hops are modelled with HANDOFFS' radius and apex, and x linear in time.

**Could not judge**

- Frozen time, and whether a stair lit to 40 % reads as a change.
- The provisional curves for the stand-up, the tips and the breath.
- The doctor lines and tab icons on a phone.
- The chimes, the count-in and the pad.
- The vocal coach's sign-off.
- Lesson 3's last frames.
