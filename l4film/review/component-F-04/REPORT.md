# Component F-04 (verification): S14 recap, S15 next, S16 end

**Verdicts:** S14 KEEP · S15 KEEP · S16 KEEP. Group: KEEP. Only cosmetic items remain.

I have not written the report file, because my instructions say to return reports instead. Please save this to `/home/user/mercurypitch/output/motion/lesson-04/review/component-F-04/REPORT.md`.

Times are clip (film). I measured everything myself and did not rely on the "as built" notes in HANDOFFS. The caller gave no opinion on what was fixed. S16's render matches round 3 exactly (same loudness, same frames).

## Previous items
1. **S15 empty frame: FIXED.**
   - "NEXT TIME" and '"support"' now fade in together at S15 0.47-0.65 (470.71-470.89).
   - The near-empty span shrank from 2.2 s to 0.77 s (S14 64.45 to S15 0.47).
   - A small leftover is listed as problem 2.
2. **Empty card panels: FIXED.** Each card's first line now arrives 2-3 frames before its panel:
   - Card 1: text 2.00 (407.49), panel 2.04.
   - Card 2: text 14.78 (420.27), panel 14.83.
   - Card 3: text 24.02 (429.51).
   - Card 4: text 38.07 (443.56).
3. **Gold risers running along the upper tread: STILL PRESENT** (problem 1).
4. **Icon glows crowding the type: FIXED.** Gaps at each glow's peak:
   - ×: 14 px.
   - Exercises: 10-11 px.
   - More: 8-9 px.
   - Gear: 9 px at its core, but its faint halo comes within 6 px (problem 3).
5. **Older items:**
   - Stairs lighting on cue words: still there, still deliberate.
   - The short Mercs-only opening into S16 (0.37 s): unchanged, acceptable.

## Shots as read
- **S14**
  - 0-5.5: wide shot (F0). Kicker at 0.15, card 1 at 2.0, the one ripple at 3.2-3.7, ring timer at 5.0-7.6.
  - 5.5-7.1: push in with parallax to the medium shot (F-recap-1). The strip sinks.
    - Riser labels land 7.9-10.8.
    - Card 1 leaves line by line, 11.7-11.9.
    - Brackets at 12.05 and 12.3.
  - 14.2-15.2: pull out to F0. Card 2 lands, the staircase slides to D (15.9-16.8), and F♯ and C♯ appear (21.7-22.4).
  - 24.0: card 3. Slide back to C, then push in to F-recap-3 (25.2-26.4).
    - The bead hops into the house at 28.2-28.5, "S" lands at 32.0, the arrow draws at 36.9-37.3.
    - Pull out 37.6-38.6.
  - 38.07: card 4. Slide to G at 44.0-44.8.
  - 48.6-49.8: the staircase becomes the ladder, which eases into its card-time box at 53.9-54.5.
  - 54.5-60.3: the card builds. Glows and underlines run in turn, 60.7-63.5. The card fades fast at 64.33-64.45 and the rung starts its glide.
- **S15:** static wide shot.
  - The rung comes down the right side, then the kicker and word fade in at 0.47.
  - The rung runs left along y 520 and becomes the bead by about 1.66.
  - Then the word swells (about 2.9), the long line draws (3.9-5.2) and wavers (6.1-6.7), and the question lands (6.95-7.1).
  - The type leaves upwards at 8.15-8.27.
- **S16:** unchanged. The Mercs grow, the wordmark is wiped in, one hop, the address rises.

## Problems, ranked
1. **Gold semitone markers look half-drawn (S14).**
   - Where: mi-fa and ti-do at 9.2-14.2 (414.7-419.7); ti-do at 32.0-37.6 (437.5-443.1).
   - What: the gold runs 72-92 px along the upper tread and stops with a rounded end.
   - Fix: end the stroke at the top corner of the riser. If the L-shape is intended, run it the full width of the tread instead.
2. **Near-empty frame across the cut, S14 64.45 to S15 0.47 (469.94-470.71), 0.77 s.**
   - What: only the 56 × 4 px rung and the Mercs are on screen.
   - Fix: scale the rung to about 2.5× while it travels, so it reads as an object.
3. **Gear halo is tight (S14 61.2-61.9, 466.7-467.4).**
   - What: the faint halo (pixels brighter than luma 30) comes 6 px from the colon in "first:" and 6 px from "S" in "Settings", against the 8 px target.
   - Fix: widen the gear's slot by 2 px on each side, or shrink the halo.

## Measured
- **Holds:**
  - S14: 0.5 s in total (0.2 s per 30 s), longest 0.1 s.
  - S15: 0.2 s. S16: 0.1 s.
- **Join S14 to S15:** the rung's centre is at (1479.0, 248.7) on S14's last frame and (1478.2, 251.5) on S15's first, 2.9 px apart. It moves 2.6 px a frame before the cut and 6.5 px after, so the motion continues and accelerates.
- **Rung and '"support"':** the rung comes no closer than 64 px to the word's ink.
- **"Singing Voice Range" swell:** "S" stays 12 px clear of the "›" before it; peak right edge x 1581 at 56.2.
- **Underlines:** each ends at its line's last letter, and the Settings underline clears the descenders by about 5 px.
- **Join S15 to S16:** the Mercs and background match.
- **Single-frame events:** S14 11.72, 55.30, 57.30, 60.43; S15 0.67, 7.00. All are type settling with whole-pixel snaps. None is a glitch.
- **Contrast:**
  - F♯ 5.8:1, C♯ 5.9:1, "ti" on its lit stair 7.7:1.
  - Phone line 9.8:1, B4 and C5 9.8:1, "NEXT TIME" 8.4:1.
- **Loudness:**
  - S14: -15.9 LUFS, -1.9 dBTP, loudness range 7.3 LU.
  - S15: -15.2 LUFS, -2.0 dBTP.
  - S16: -23.6 LUFS, -12.4 dBTP.
- **Facts:** every line on screen matches FACTS 84-86, 88 and 89.

## Not judged
- **Audio:** the S14 to S15 audio join, the end chime on phone speakers, and effects against music (no music-only render).
- **Captions:** how they sit over the card and the S15 type.

All my working files in /dev/shm/f4 and the scratchpad scripts have been deleted.
