# Component review B-01: s05-steps, s06-groups

**Verdicts: s05-steps REVISE. s06-groups REVISE. Group: REVISE.**

I did not read any builder notes, ledger or source. The caller gave me no opinions to set aside.

## Shots as read (clip time, film time in brackets)
- **s05:**
  - 0–10.45: WS F0, static camera. The strip rises, the letters switch in, "a major scale" fades in, then the bead run.
  - 10.45–11.95: push to CU-A. It reads as a zoom: the room glows do not move at all, and only the dust scales.
  - 11.95–17.25: static CU, C–D measured.
  - 17.25–18.85: 480 px pan. The graphic match at riser x 436 works.
  - 18.85–21.45: CU-B on E–F.
  - 21.45–23.05: pull out to F0.
  - 23.05–41.53: static WS for the measured run.
- **s06:**
  - 0–4.4: WS. Tavi appears, then the brackets.
  - 4.4–6.0: push to F-low.
  - 8.7–9.8: truck to F-high.
  - 12.0–13.1: pull out.
  - 13.1–35.2: static WS: the outline glides across, T switches to 2, the sum builds, then the octave bracket.

## Problems, ranked
1. **s05 21.45–23.1 (film 90.8–92.5), riser at x 436.** The gold fill and "S" land at 21.53, after the pull has started (21.45). Both demo risers are reset by 22.3. So the semitone payoff is never seen settled, and the legend (23.1–23.7) then defines T and S while neither is on screen. Fix: hold CU-B until 91.5, keep the demo T and S through the pull, and reset them as the bead drops (93.3).
2. **Gold reads only as a sliver at F0.** The semitone bars are 6×26 px, about 1.5 px wide at phone width (`crops/s05-last-phone.png`). That breaks the brief's mute item "the two semitones gold". Fix: fill the whole 8 px gap and add a short gold segment on the upper tread's corner. Check it at 480 px wide.
3. **Tavi, bottom right.**
   - She is absent at the end of S5. HANDOFFS has her on screen from 110.78.
   - In s06 she fades in place over 3 frames (0.03–0.13 and 25.10–25.17), and both times after her line has started (110.88, 135.93). It reads as a pop.
   - Fix: a real drop-in that ends at least 0.3 s before each line, and render it in s05.
4. **s06 27.5–33.5 (film 138.4–144.4) is nearly dead.** From 29.0 to 30.0, on "Exactly", no pixel changes by more than 16 (a 0.7 s hold is counted). The riser growth on "Seven steps" is invisible. Fix: light the seven stairs in turn, and grow the octave bracket up the 12 rows, reusing the row sweep from 20.6.
5. **s06 4.2–12.0, lower bracket.** Its right tick sits 3–5 px above the F–G "T", so the two read as one hooked shape. In F-low the bracket line (y 167, from x 535) also runs on from the legend's first line. Fix: raise both brackets by 24 world px, take the legend out before the push, and bring it back at 124.0.
6. **s06 22–35, the sum.** The digit spacing makes "221 · 2 · 221 = 12" read as numbers. Fix: gaps of at least 0.5 em between digits.
7. **s06 33.73–34.77.** "= 1 octave" is fully visible for about 1.0 s, then fades with everything else while Tavi exits. Fix: hold it to 145.9 and have Tavi leave after.
8. **s06 13.4–14.9, ghost outline.** It crosses the T and S labels in flight, and on landing it washes the B–C gold riser out to pale yellow. Fix: draw it under the labels and risers, with its semitone segment in gold.
9. **Composition.**
   - Film 92.4–115.3: 23 s of the same WS, with x 1200–1920 empty. Fix: a "T T S T T T S" tally in the right lane on b11.
   - Tavi's guess in o4 is voiced with nobody on screen.
10. **Minor.**
    - Old and new stair names overlap mid-switch (s05 2.6).
    - The row field ends in a hard edge (x 160 in CU-A, x 496 in F-low).

## Measured
| | s05 | s06 |
|---|---|---|
| Length | 41.53 s, 30 fps | 35.23 s, 30 fps |
| Holds | 0.1 s total | 1.6 s (1.4 per 30 s), longest 0.7 s at 29.2 |
| Single-frame events | 4.83 and 4.90 (1 px snaps as "a major scale" settles), 12.07, 24.30 | 6.40, 13.43 |
| Loudness | −15.8 LUFS, LRA 2.7, true peak −1.8 dBTP | −15.7 LUFS, LRA 3.0, true peak −1.7 dBTP |

- Every single-frame event has a cause.
- The s05/s06 seam matches: only 32 px change by more than 24, and the largest change is 33.
- **Contrast:** lit stair names 5.3:1, legend 8.0:1, key letters 9.6:1, C♯ 5.7:1, sum 16.1:1.
- **Sync:** bead landings match the tone onsets (audio 26.70, picture 26.73).
- **Claims:** all on-screen text is covered by FACTS 71–74.

## Could not judge
- Anything at 60 fps, since the clips are 30 fps.
- Effects against the bed, since there is no music-only render.
- The tone level (−14.8 dB RMS, level with the voice) on phone speakers.
- Whether there is an act-1 whoosh: only a 0.3 s tail is in the clip.

I did not write `REPORT.md`, because my instructions forbid report files; please save this text there. Measurements, crops and sheets are in /home/user/mercurypitch/output/motion/lesson-04/review/component-B-01/ (`s05/`, `s06/`, `crops/`, `diff/`).
