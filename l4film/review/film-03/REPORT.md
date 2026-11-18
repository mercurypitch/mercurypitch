# Film round 3 (verification): film-03.mp4

**Verdict: ONE MORE PASS.** The pass is short: the floor box under the Mercs, the 5:42.7 double drop, and 1 s more on the end card. Nothing broke this round.

**What I read.** You gave me no opinions to ignore. I left out STORYBOARD.md and HANDOFFS.md so that my reading of the shots stays independent. My instructions forbid writing report files, so I did not write REPORT.md. Please save this text to `/home/user/mercurypitch/output/motion/lesson-04/review/film-03/REPORT.md`.

## Previous items

1. **Recall: PARTLY (unchanged).** The staircase is still replaced, not carried. The 0.3 s hold at 0:46.9 remains.
2. **Empty frame before the tease: FIXED (unchanged).**
3. **End card: STILL PRESENT.** It is complete from 7:59.6, which leaves 4.1 s.
4. **Brackets laid over each other: FIXED.** It still works at the new scale, 2:04.9–2:07.4.
5. **Same entrance repeated: PARTLY.**
   - Now floor-level leaps: 3:18.3, 4:42.5, 5:20.8 and 5:21.4.
   - Still dropping from the top: 1:01.6, 2:27.6, 5:42.7, and 4:09.2, which round 2 missed.
   - At 5:42.7 the two Mercs start 3 frames apart, so no stagger is visible.
6. **Countdown ring: FIXED.**
7. **Tangled outlines: FIXED.**
8. **Small tile stack: FIXED.**
9. **Monotony: PARTLY.**
   - Five uniform zoom-ins remain, at 1:20.2, 2:03.6 (new), 3:06.0, 4:05.0 and 4:31.4.
   - Each runs 0.4–0.6 s, then zooms back out.
10. **Tone rise: FIXED.**

**Round 2's other problems:**
- **Tease to end card: FIXED.** The bead leaves the dash at 7:58.45 and glides into the end card's blue bead; an orange bead rises from Tavi.
- **Small subject: FIXED.** The camera zooms to about 1.35x over 2:03.6–2:04.1 and back out over 2:10.3–2:10.85. The legend stays in screen space. The diagram now fills about 70% of the width and 80% of the height.
- **4:16 pill: PARTLY.** The pill now grows first, then the text rolls. For 6 frames (4:16.03–4:16.13) both labels show cut in half, and the outgoing one rides over the pill's top border.
- **0:34.5 title blur: STILL PRESENT.**

## Shots as read

- **0:00–0:33.2:** wide, eye level, static; frame one is a finished picture.
- **0:33.3–0:34.5:** a pass-through into the title staff.
- **0:37–1:00:** wide with no Mercs; the staircase is replaced by tiles, which turn into the semitone rows.
- **Zooms:** 1:20.2–1:32.2, 2:03.6–2:10.85, 3:06.0–3:10.4, 4:05.0–4:09.35 and 4:31.4–4:41.8. All are uniform scale, so they read as zooms.
- **Chapter cards:** at 2:26.4, 3:49.4 and 5:41.5.
- **5:07.2–5:08.6:** the staircase regroups into tiers. **5:20.4–5:22.7:** it rebuilds as the keyboard rises.
- **5:43.6–5:45:** the staircase tips into the guide lanes. "Your turn" starts at 6:13.4.
- **6:44.3:** the recap. **7:34.4:** the ladder. **7:50:** the tease. **7:58.75–7:59.65:** the end card builds over a slow push.

## Problems, ranked

1. **5:44–6:42, bottom corners: a hard-edged rectangle in the floor glow under each Merc.**
   - Its edges sit at x≈130 and x≈1820, and its top at y≈840, the feet line.
   - It is 4–11 luma levels brighter than the floor: faint at 1x, plain when enlarged. It reads as a clipped layer.
   - The end card's full-width floor does not show it.
   - Fix: feather the reflection/glow mask, or extend it past the frame edge. Re-measure until the step is under 2 levels.
2. **Top-of-frame drops at 1:01.6, 2:27.6, 4:09.2 and 5:42.7.**
   - Fix: at 5:42.7, stagger the Mercs by 0.3 s or more, or sink one in. Use the hop at 2:27.6 and 4:09.2.
   - The side leap now appears six times, so alternate leap, hop and sink.
3. **7:59.6–8:03.7, end card: complete for 4.1 s.** That passes the kit's 1.5 s CTA bar, but not the 5 s asked last round. Fix: extend the tail by 1 s.
4. **0:46.8–0:47.8, recall:** a replacement plus a 0.3 s hold.
5. **4:16.03–4:16.13, pill roll:** clip the roll to the pill's inner box.
6. **Cosmetic:**
   - 7:58.45–7:58.75: 0.3 s of only the Mercs and a bead. It is acceptable now that the bead carries over.
   - 0:34.5: the title's blur-to-sharp.

## Numbers

- **Holds:** 11.6 s in total (0.7 s per 30 s); the longest is 0.5 s at 4:30.3; no final hold.
- **New single-frame events:** 198.45–198.5, 282.65–282.8 and 321.05 s are the fast frames of the new leaps. I checked each frame by frame, and none pops.
- **Changed since film-02** (`motion.csv` compared sample by sample):
  - Large changes only at 2:03.6–2:04.3, 2:10.3–2:10.9, 3:18.3–3:19.7, 4:15.8–4:16.2, 4:42.4–4:43.3, 5:20.7–5:22.1 and 7:58.4–7:59.0.
  - Everything else is idle-phase noise (mean difference 0.28 or less).
- **Loudness:** −16.0 LUFS integrated, LRA 5.2 LU, true peak −1.5 dBTP.
- **Mix unchanged:** `audio.csv` is byte-identical to round 2.
- **Whooshes:** at 69.1, 145.8, 229.0, 341.0 and 405.2 s.
  - They sit +24 to +27 dB in band over a silent pad, so the kit's targets do not apply.
  - In absolute terms they are quiet: their loudest 50 ms is −24 to −26.5 dBFS against narration at −10 to −12, and at 2–8 kHz −34 to −36 against −18.5 to −24.
- **Contrast:** the smallest text (the phone line, ILLUSTRATION, the doctor lines) measures about 9.1–9.3:1.
- **Claims:** no new text this round. The experiment credits, care lines, practise card, ladder (A4 as re, six rungs) and end card are all in FACTS (81, 83, 85, 88, 89).
- **Loop seam:** 21.75; ignored, since the film does not loop.

## For a human

- Look at the floor box on an OLED phone and after YouTube's encoding.
- Listen to the whooshes, and to the viewer's turn silence.
- Check the mix on phone speakers.
- The voices are still the scratch takes.
- Captions are not in the render.

## Files

In `/home/user/mercurypitch/output/motion/lesson-04/review/film-03/`:
- `measure/` (`summary.md`, `audio.md`, sheets)
- `dense/` (20 fps sheets)
- `exact/` (frame-exact sheets)

My scratch files in `/dev/shm` are deleted. A separate `measure.py` run you started on the same film, writing to `review/measure-film-03`, is still running; I left it alone.
