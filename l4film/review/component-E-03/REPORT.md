# Component E-03: s12-sing and s13-your-turn (round 3, verification)

**Verdict: S12 KEEP. S13 KEEP.** Neither scene has a blocker. The one item still open is a 1 px twitch, and it only shows frame by frame.

I did not write this report to disk, because my harness forbids subagents from writing report files. Please save it to `/home/user/mercurypitch/output/motion/lesson-04/review/component-E-03/REPORT.md`.

You gave me no view on what was fixed. I used HANDOFFS as the spec and did not treat its "As built" notes as evidence. I did not read DECISIONS or LEDGER. Times are clip times: add 341.242 for S12 and 372.917 for S13.

**Previous items**
1. **S13 lane names staying lit: FIXED.**
   - The bottom "do" is lit 10.75–11.35 and the top "do" 12.25–12.85. Both return to ink-2.
   - No name or segment stays lit through the viewer's turn (22.32–30.92).
   - Every segment highlight between 1.0 and 21.0 eases back within 0.8 s.
2. **Small type stepping by whole pixels: PARTLY.**
   - Fixed: the S13 doctor lines now fade in place (1.02–1.20) and their centroid moves less than 0.3 px. The S12 "wait" landing (5.2–5.87) and the chip (21.13–21.27) settle with no step.
   - Still present: every scale pulse jumps about 1 px vertically, two or three times as it shrinks back, and also during some scale-ups (S12 11.78–11.83 and 12.78–12.83).
     - S12 "wait": 12.03 / 12.20 / 12.35, 13.03 / 13.20 / 13.35, 17.67 / 17.83 / 17.97, 27.57 / 27.72 / 27.87.
     - S13 "wait on ti": 27.42 / 27.57 / 27.72.
     - S13 "at about speaking volume": 10.17.
3. **S12 arrow tail under Tavi's bead (29.45–29.85): FIXED.** At 29.45 the tail ends about 8 px above the bead's rim. At 29.8 it sits 16 px to the bead's left.

**Shots as read** (the same as round 2, and they match rows 12a–13d)
- **S12**
  - 0–2.25: chapter card. The staircase dims (0.17–0.35), the strip leaves (0.4–0.96) and the Mercs drop in (1.3–2.2).
  - From 2.35: kicker "4 · SING IT".
  - 2.46–4.26: morph in a static wide shot.
  - 4.3–31.68: static wide shot. Merc's bead is on screen 6.83–20.28, Tavi's from 22.37 to the end.
- **S13**
  - 0.08–0.98: object move.
  - The title lands at 0.67 and the first care line at 1.0.
  - 1.15–20.97: static two-column wide shot.
  - 21.03–22.25: count-in bead.
  - 22.32–30.92: cursor sweep.
  - 31.03–32.23: reverse morph, then 0.3 s still before the cut.

**Problems, ranked**
1. **Pulse jumps (the rest of item 2), at the regions and times above.** A 40 px word twitches 1 px while it scales. You can see it at 4× zoom, frame by frame. Cosmetic.
   - Fix: give each pulsing label its own compositing layer (`will-change: transform`), so the browser scales one bitmap instead of re-snapping the glyphs to the pixel grid.
   - Or put the transform origin on the baseline (`center bottom` for "wait", `left bottom` for "wait on ti").
2. **S13 9.45–9.57, "at about speaking volume".** The "swell" reaches full size in 0.12 s from rest. The biggest change is in its first frames (mean box change 19.5, then 16.8). It reads as a punch on the line asking for a moderate voice. Optional: rise over about 0.3 s with an ease-in-out.

**Regressions:** none found.
- The tool's "pop" at S12 0.25 is the steepest frame of the staircase's 0.18 s eased dim. Strip luma falls steadily from 128.7 to 45.5 between 0.167 and 0.35, with no glitch.
- The S12 jumps at 17.667 and 17.833 are item 2.

**Measured**
- **S12**
  - Holds: 0.3 s in total, longest 0.2 s (under the card).
  - Loudness: −17.6 LUFS, −1.9 dBTP.
  - Bead lane entries against the sung onsets: Merc +0, +5, −18, +5, +5, +5 ms; Tavi +7, +7, −13, +7, +6, +7 ms.
  - Both landings are within about 30 ms, read from frame-exact crops. The beads park with their centres at x 1416 and 1414.
- **S13**
  - Holds: 0.5 s in total, longest 0.1 s; the final still is 0.3 s.
  - Loudness: −16.4 LUFS, −1.4 dBTP.
  - Count-in: 146.9 Hz (D3) from 21.33 to 22.11, and the bead lands at 21.33.
  - The viewer's turn is room tone at −52 LUFS short-term.
- **Seam (S12 last frame to S13 first):** 0.07 % of pixels change by more than 24, all from the Mercs' idle and the bead and house area.
- **Contrast (sampled):** kicker 9.1:1, lane names 9.6–10.5:1, doctor lines 10.3:1, care lines 18.2:1, chip 16.8:1.
- **Facts:** every on-screen line matches FACTS 83 (D3 and D4 per 52 and 63), and the doctor lines are word for word.

**Not judged**
- How the mix sounds on phone speakers, and the level of the sung runs against the narration.
- TTS quality.
- Whether 8.6 s of room tone reads as an invitation to sing.
- The 30 px doctor lines on a portrait phone.
- How the two scenes play inside the full cut, and the act whoosh against the bed (a component round has no music-only render).

My scratch frames, dumps and helper scripts in `/dev/shm/critE03` and the scratchpad are deleted.
