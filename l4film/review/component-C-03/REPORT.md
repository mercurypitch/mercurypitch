# Component C-03 (verification): s07-predict and s08-anywhere

**s07-predict: KEEP. s08-anywhere: KEEP.** All six C-02 items are fixed, and both clips now run at a true 60 fps. Only cosmetic problems are left.

All times below are clip seconds. To get film time, add 146.097 in S07 and 199.360 in S08. Your message contained no opinions to set aside. This harness bars report files, so please save this text to `/home/user/mercurypitch/output/motion/lesson-04/review/component-C-03/REPORT.md`. The working files were kept in /dev/shm and I deleted them afterwards.

## Previous items
- **N1, the cut at S07 53.25 to S08 0.00: FIXED.**
  - Over S07's last six frames Tavi's top edge moves 646 → 678, then 680 and 682 after the cut. That is a 2 px step on a curve that is still easing.
  - What is left of the landing ring in S07's last frame is 26 px changed by more than 24 (max 48), gone one frame later.
  - Outside Tavi's box the only change is scattered encoder noise.
- **N2, one-frame snaps: FIXED.**
  - The F♯4 key rises over 9 frames (46.10–46.25) and C♯5 over 46.50–46.63.
  - S08's three rim flashes each rise over 8 frames (17.98, 18.48, 18.97).
- **N3, the lone arrow: FIXED.** Both arrows leave at 43.2–43.35. None are left in F-keys-D.
- **N4, echo ring over the "S": FIXED.** At its largest (29.75) the ring stays about 12 px clear of the "S".
- **N5, card over an undimmed strip: FIXED.** The strip dims 0.20–0.40 and the card arrives from 0.47.
- **N6, bead glow on the pill: FIXED.** The glow still lifts the pill's right cap by up to 22 levels at 18.45–18.85, far fainter than in C-02.
- **Frame rate: FIXED.** 60.00 fps, with no duplicated frames during the slides.
- **Differences from the board:**
  - The "?" and the tally now match HANDOFFS.
  - S08 still lights stairs and keys where rows 8a–8b say "scale". That is still a difference from the board.

## Shots as read
- **S07:**
  - 0–0.47: wide shot at F0, static; the staircase and strip dim.
  - 0.47–2.3: full-frame chapter card. Tavi drops in 1.35–2.0.
  - 2.3–12.9: wide shot, static. The dashed staircase draws 3.5–4.6, Tavi leaves 6.6–7.1, "Predict." lands at 6.95, the stairs fill 7.6–10.4, the pills land 10.7–11.3, and the ring timer starts at 12.7.
  - 12.9–17.2: slow push to F-white. It still reads as a slow zoom; only the near bokeh separates.
  - 17.2–23.2: medium shot, static.
  - 23.2–24.2: pull to F0, then the slide C to D at 24.85–25.35.
  - 25.35–39.5: wide shot, static.
  - 39.5–40.5: push to CU-D.
  - 43.5–44.4: the "crane" reads as a tilt down plus a pull-back.
  - 44.4–49.6: F-keys-D, static.
  - 49.6–50.5: pull to F0, "D major" lands at 50.5, and Tavi drops in 52.2–53.0.
  - Out: a match cut.
- **S08:** locked wide shot throughout.
  - Slides at 8.68–9.5, 13.0–13.33 and 25.95–26.75.
  - Ghost outlines at 17.3–19.5.

## New problems, ranked (all cosmetic)
1. **S07 43.55–50.15, top right: the top "S" label is missing.**
   - The "S" on the C♯–D gold riser fades just before the crane and only returns partway through the pull.
   - So at 43.65–44.0 and 49.75–50.1 that gold step has no label, while the F♯–G step keeps its "S".
   - Fix: leave the label on. Let the crane carry it out through the top edge and the pull bring it back.
2. **S07 44.4–49.6, top edge: F-keys-D crops stairs 7 and 8.** This framing is unchanged since C-02.
   - The real stair-7 tread sits at y ≈ −6, so stair 7's "one row low" and the C♯–D gold riser are out of frame while C♯ is being named.
   - Fix: change F-keys-D's oy from −528 to about −440. The top "S" then lands near y 40, and the black-key names sit at baseline 873, still above the caption band.
3. **S07 15.5–15.89, around (620, 440): the ring timer gets too close to the stairs.**
   - The ring stays fixed to the frame while the push enlarges the world. It ends up about 18 px from dashed stair 3's corner; HANDOFFS asks for 28.
   - Fix: end the ring at 15.6, or move it to (600, 425).
4. **S07 7.12–7.55 and 50.62–51.02, top left: titles settle in whole-pixel steps.**
   - "Predict." and "D major" cover their last ~8 px one pixel at a time. About 3,000 px change every 1–3 frames, with nothing changing in between; measure.py lists these as jumps.
   - Fix: give the rise less travel, or move the title with a sub-pixel transform (translate3d or will-change).

## Measured
- **S07:** holds 0.8 s per 30 s, longest 0.2 s. Loudness −16.0 LUFS, loudness range 2.7 LU, true peak −1.8 dBTP.
- **S08:** holds 0.7 s per 30 s, longest 0.1 s. Loudness −16.1 LUFS, loudness range 2.2 LU, true peak −1.8 dBTP. The whole-frame flicker at 4.167 is the encoder's keyframe (frame 250), not content.
- **Contrast in F-keys-D:** F♯ key name 5.8:1, C♯ key name 5.8:1, the glowing C♯ stair name 6.8:1.
- **Sync:** S07's note onsets fall 0.45 s apart, and the bead lands 2 frames after each.
- **Handoffs:**
  - S07's first frame matches B-to-C (riser labels 2 2 1 2 2 2 1).
  - S08's last frame matches C-to-D (T T S T T T S, no tally, no Mercs).

## Not judged
- Effects against the bed: there is no music-only render. Also not judged: the 2–8 kHz content of Tavi's landing effect, and the voice's sibilants.
- Whether item 4's stepping shows at speed on a phone.
- The cut at speed in the joined film.
- Captions over CU-D's names (baseline 880).
