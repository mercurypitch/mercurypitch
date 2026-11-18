# Film round 1: film-01.mp4

**Verdict: ONE MORE PASS**

I did not read STORYBOARD.md, HANDOFFS.md or any builder notes, so the shot reading below is my own. Compare it with the storyboard yourself. I did not write REPORT.md: my instructions forbid report files, so please save this text to `/home/user/mercurypitch/output/motion/lesson-04/review/film-01/REPORT.md`.

## Shots as read

- **0:00–0:33, cold open.** Wide, eye level, static. The staircase sits between Merc (left) and Tavi (right). The blue bead climbs and stops on ti. The staircase rises 62 px (2 rows) at 0:10.4–0:10.9. The orange bead climbs, then lands and lights the house (0:23.5).
- **0:33.1–0:34.5, into the title.** Push into the house; the Mercs truck out. A through-object field holds about 0.35 s (mean colour #707780, which matches Lesson 2's level). The field lands as a note head on the title staff.
- **0:36.8–0:47, staff to staircase.** The staff transforms into the bare staircase, which carries the four promise labels.
- **0:47–1:00, the recall.** A dissolve through a dim ghost frame to Lesson 2's tiles. The tiles squeeze, rotate 90°, stack, then stretch into the semitone rows.
- **1:01–2:26, measuring.** A wide master with the keyboard. Uniform-scale zoom-ins (no parallax, so they read as zooms, not dollies) at 1:20, 1:55, 2:43, 3:06, 4:05 and 4:31. Each is followed by a bead climbing during a truck right, then a zoom out.
- **2:26, 3:50 and 5:41, chapter cards.** Fade-ins over the dimmed diagram.
- **3:28–3:45, the key slides.** Lateral slides to G and E; the labels leave and come back.
- **5:07–5:23, tiers.** The stair labels rise into tiers, then settle back.
- **5:43, into the guide.** The staircase flattens into the guide's lanes.
- **6:13–6:45, your turn.** "Your turn." and the care block; a chrome playhead sweeps the guide.
- **6:44, out of the guide.** The guide rebuilds into the staircase for the recap.
- **7:34, to Scale Runner.** The staircase collapses into the ladder card.
- **7:50–7:59, next-time tease.** Then the end card from 7:59.9.

## Problems, ranked

1. **0:46.8–0:47.7, centre: the recall replaces the object instead of carrying it.**
   - The staircase fades to a ghost; nothing moves for 0.3 s.
   - Then the tiles pop on at about 25 % opacity in one frame (47.617 s, 12.8 % of pixels changed, the film's largest single-frame event).
   - This is the only place where the staircase hands over by a plain fade.
   - Fix: fold the stairs down into the tile row. At minimum, start the tiles' fade at 0 and ease it over 8 frames or more.
2. **7:49.85–7:51.0, whole frame: an empty frame before the tease lands.**
   - The practise card vanishes in about 9 frames.
   - For about 1 s only the two Mercs and a 40 px drifting dash remain. The dash (the ladder's rung becoming the bead) is too small to read as a carried object.
   - Fix: exit the card over 0.3 s or more, scale the rung up while it travels, and land "NEXT TIME" and "support" within 0.3 s.
3. **7:59.9–8:03.7, end card: too short and too small.**
   - The full card shows for about 2.7 s.
   - "First visit? Skip the intro…" and "then Exercises › Scale Runner" are about 34 px tall, unreadable at phone size.
   - Fix: hold the complete card for 5 s or more, and set the lower lines at 44 px or more.
4. **2:04–2:12, the brackets: a mute item from the brief is missing.**
   - The brief lists "the two brackets, the same shape laid over each other". The film shows hairline brackets and paired highlights (D/A, E/B, F/C); no group is ever laid over the other.
   - Fix: lift the C–F group and set it over G–C (shared position) for about 1 s.
5. **Same entrance repeated.** Tavi drops from the top of the frame and squashes at 1:02, 1:50, 2:15 and 3:18; Merc does it at 4:42, and both at 5:43.
   - At 1:50 and 2:15 Tavi falls through the top-right label area.
   - Fix: vary the entrances, using the references' floor-level hops and sinks.
6. **2:38–2:43, about (620, 440): the predict countdown ring floats over the grid**, detached from the pills. Fix: dock it at the pills' right end, as the recap cards do.
7. **3:37.3–3:39: tangled outlines.** Ghost outlines overlap the E staircase and run past it to x≈1590, y≈197. On mute they read as stray lines. Fix: show one offset ghost with a "same shape" label, or cut it.
8. **0:58.8–0:59.7: small subject in an empty frame.** The tile stack fills about 8 % of the frame on the left. Fix: rotate at a larger scale, or start the stretch earlier.
9. **Monotony.** The zoom-in, bead climb, zoom-out pattern happens six times. Vary at least one; for example, measure at wide size.
10. **0:10.4–0:10.9: the tone rise is easy to miss.** It is a 62 px rise with no marker; "from D?" alone carries it. Fix: a brief 2-row tick beside do.

## What passes

- **Frame one** is a finished composition.
- **Claims:** every on-screen claim I checked is in FACTS.md, including the tier order (lesson fact 24) and the credits. The ladder shows 6 rungs (B4, C5 and four unlabelled), with the dashed target stopping at the playhead.
- **Care block:** it ends at y≈790, and the doctor lines are carried whole.
- **Text:** no text collisions on any dense sheet. The 4:06–4:08 label swap is a clean in-place crossfade.

## Numbers

- **Holds:** 11.4 s in total (0.7 s per 30 s); the longest is 0.5 s (4:30.2); no final hold.
- **Single-frame events:** pops at 47.617, 110.30, 135.15, 198.60, 282.40 and 374.0 s. All except 47.617 are character landings or quick fades.
- **Loudness:** −16.0 LUFS integrated, LRA 5.2 LU, true peak −1.5 dBTP. The stereo sample peak is 0.839 and nothing clips.
- **Pad:** sounds only in transitions and pauses (34–36, 52–54, 146–148, 159–162, 229–231, 341–343, 404–406, 411–413, 425–427, 447–449, 466–470 and 479–481 s). It never sits under voice except at the whooshes.
- **Whooshes:** at 69.1, 145.8, 229.0, 341.0 and 405.2 s, in 640–1550 Hz.
  - In their own band they sit +25 to +27 dB over the pad, because the pad has nothing there; sample peak is +6 to +10 dB.
  - In full band they sit about 2–3 dB over the pad and about 5 dB under the voice median.
  - `audio.md`'s "harsh" flags are not usable: the music-only render holds only the pad, so all narration counts as "effects".
- **Sung pitches**, spot-tracked: stop-c C4–B4 at 0.45 s, within 4 cents; stop-d and land-d D4–C♯5–D5; sing-a D3–C♯4 at 0.8 s; sing-b from D4. All within about 9 cents.

## For a human

- **Viewer's turn silence:** 6:38–6:45 is about 7 s at −52 LUFS, room tone only, as the brief intends. Does it read as a broken video on YouTube?
- **Whooshes by ear:** they sit over silence in their own band.
- **Phone speakers:** Merc's D3 count-in, and the mix in general.
- **Voices:** they are still the Kokoro scratch takes, so the timing will move when they are re-voiced.
- **Captions** are not in the render; check that they do not overlap anything.

Files are in `/home/user/mercurypitch/output/motion/lesson-04/review/film-01/`:
- `measure/summary.md`
- `measure/audio.md`
- `exact/dense-047.62s-60fps.jpg` (the item 1 pop)
- `dense/dense-469.90s-20fps.jpg` (the item 2 exit)
- `ov/ov-01.jpg` to `ov-20.jpg` (1 s overview sheets)
