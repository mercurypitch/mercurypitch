# Critic A-01: component round, S1 to S4

Saved by the director from the critic's returned text (the critic could not write files). Its
crops, measurements and frame sheets are in this folder.

**Verdict: ONE MORE PASS.** S1 REVISE, S2 KEEP (sting missing), S3 KEEP with one fix, S4 REVISE.

Times are clip times. Film time is the same for S1. Add 38.81 s for S2, 42.41 s for S3 and 52.88 s for S4. I judged `lab/s01-cold-open/clip.mp4`, not the board-form alternative.

## Shots as I read them

- **S1, 0 to 30.5:** medium wide two-shot at eye level, centre symmetry. It reads as a static frame, because the 0.90 to 0.92 drift cannot be seen.
- **S1, 30.5 to 33.6:** a pull out. It reads as a zoom out of a single line, because the chart has gone by 32.03.
- **S1, 33.6 to 38.2:** a static hook frame.
- **S1, 38.23 to 38.53:** through the bead into a chrome field. This is fast, about 0.3 s.
- **S2:** the field shrinks to the bead (0 to 0.33). Then full-frame type with a 2.3 % slow zoom out (title 1239 to 1210 px wide). The title exits up at 2.65 to 2.80, and the bead flies over a frame that is close to empty.
- **S3:** wide shot with no hosts. The truck reads as a slow drift of content to the left. Tavi leaps in at 9.4 to 9.9.
- **S4:** crane down with a push in at 0.43 to 1.43; the bokeh parallax is visible. Medium shot on the strip. Merc leaps in at 6.4 to 6.8. Crane up at 12.2 to 13.3.

## Problems, by impact

1. **The sound cannot be checked (S1, S2, S4).**
   - What is wrong: S1's `clip.mp4` has no audio stream. S2's track is digital silence, so there is no title sting. S4's `q0` (5.0 to 7.2) is digital silence, so there is no pad. No clip has room tone. Signature moment 1 ("heard and seen together"), the predict pad and the chimes against the five note hops cannot be judged.
   - Fix: render S1 with its scratch mix (`easy`, `pushed`, the voices, the pad under `predict` and `hook`), S2 with the sting and S4 with the `q0` pad. Also deliver a music-only render, so that `measure.py audio` can run.
2. **Tavi's dashed guess does not read (S1, 8.3 to 26.9, the band's centre line).**
   - What is wrong: the dashes lie on Merc's dimmed amber line, under the violet wave's crossings. At full frame it looks as if Merc's line simply went pale. Only the "?" reads. The brief lists this on its mute list. See `guess-draw-8.0-9.0.png` and `crop-guess-9.5.png`.
   - Fix: take Merc's line to 0 % rather than 50 % while the guess shows. Dim the easy take to about 50 % while the guess draws (8.3 to about 10.0), then bring it back. Draw the guess with a visible travelling head.
3. **The pass into the bead is too fast (S1, 38.23 to 38.53).**
   - What is wrong: the bead goes from r 22 to the full field in about 0.3 s. Peak mean change is 28.8 per 1/30 s, and `measure.py` flags it as a pop at 38.467 (41.6 % of pixels). The board allows 0.55 s and Lesson 2's reference approach takes 0.75 s. Both host slides (38.20 to 38.40) and the fade of the two hook lines (38.30 to 38.40) overlap the start of the approach. It reads as a flash, not a pass through.
   - Fix: clear the type and the hosts by about 37.95. Then run the approach for 0.55 to 0.75 s on power3.in.
4. **The crane up starts on an empty frame (S4, 11.85 to 12.35).**
   - What is wrong: the swatches, hairline, heading and strip all fade before the crane starts. For about 0.45 s only "level", the words in flight and the hosts remain, and the crane travels over nothing until the band's foot enters at the top (`s04-crane-11.6-12.77.png`). The board fades the swatches during the crane.
   - Fix: start the fade on "right", together with the crane. Keep the strip until the band is in frame.
5. **The pull out has no subject (S1, 31.63 to 33.6).**
   - What is wrong: the whole chart dissolves in 0.4 s (31.63 to 32.03). For the remaining 1.6 s, the only thing moving is a thin line shrinking, with parallax only in faint bokeh. This is the zoom cousin of a pull.
   - Fix: hold the band's fill and edges, and "A3", for about the first 70 % of the pull, and fade them over its last third.
6. **Two labels in S3 have misaligned left edges.**
   - What is wrong: "what your diaphragm does" starts 38 px right of "level" (x 512 against 474 at 2.0; 368 against 329 at 8.6). The two read as one indented caption, not as the strip's own label.
   - Fix: align it to x 400 (world), or centre it inside the strip outline.
7. **The `q0` prompt is too small (S4, 5.15 to 6.95).**
   - What is wrong: the only cue to answer is a ring of about 18 px radius at (180, 187), in the corner. On mute, with no caption during the pause, it reads as a spinner.
   - Fix: give each swatch one counted pulse (1.08) during `q0`, or put the ring beside the swatch row.
8. **The frame is nearly empty at the end of S2 (2.73 to 3.0).** The title and staff have gone and the chart is under 30 % of full, so only the flying bead is on screen. Fix: start the chart's fade-up 0.2 s earlier.

These pass: frame 0, the joins, the S2 to S3 bead flight, the takes and the tags, the wave rule, the climb's timing, the clearance of '"support"', contrast and keep-out.

## Measured

- **S1 holds:** 0.7 s in total (0.5 s per 30 s); the longest is 0.1 s. Other events (22.9, 28.1, 36.73) are host animation or the line drawing, at 0.27 mean change or less.
- **S1 sync against the cue arithmetic:**
  - The band edge goes dark at 24.00 to 24.13 (expected 23.96).
  - "above the band" lands at 24.67 (expected 24.66).
  - The easy take ghosts over 21.10 to 21.37.
- **S2:** no holds; audio reads -70 LUFS with true peak -inf.
- **S3:** longest hold 0.1 s; -21.5 LUFS; true peak -1.5 dBTP.
- **S4:** holds 0.5 s in total (1.1 s per 30 s); -19.9 LUFS; loudness range 7.7 LU; true peak -3.6 dBTP. The flagged pops at 6.03 and 9.60 are Tavi's idle and the four-words heading landing over about 4 frames.
- **Joins:** mean luma difference 0.24 (S1 to S2), 0.25 (S2 to S3) and 0.19 (S3 to S4), with at most 0.04 % of pixels changing by more than 24.
- **Wave at F-cold:** about 46 px a cycle and 63.5 px peak to peak (spec 45.8 and 63.0); ratio 1.38.
- **'"support"' clearance:** the descenders sit 20 px over the line at landing and 65 px once settled; the line is at y 518 to 521.
- **Chips:** 15 px between the two chips, and 13 px between the chips and the pill above them.
- **Contrast:** every settled label sampled is between 9.7:1 and 17.9:1.
- **Field:** luma 113 to 115, ramping from 41 over 6 frames.
- **Facts:** every on-screen string is in FACTS or the brief.

## For a person to watch or listen to

- All of the sync and the mix (problem 1).
- Whether the ±14-cent wave, 40 % of the band's height at k 2.5, reads as "small" or as a wobble.
- The hosts' animation, which is being re-rendered.
- One-frame defects at 60 fps: the clips are 30 fps.
