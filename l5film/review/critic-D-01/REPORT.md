# Critic D-01: S11 "Sing it" and S12 "Your turn" (component round)

Saved by the director from the critic's returned text (the critic could not write files). Its
crops and measurements are in this folder.

**Verdict: REVISE (ONE MORE PASS).** Keep the hold itself (S12 21.4 to 36.6) as it is.

## Shots as read (clip times)
**S11**
- 0 to 0.37: static wide shot of the empty hold frame, matched to S10 (band x 1000 to 1640, line y 245).
- 0.37 to 2.17: full-frame type card "Sing it", which leaves up fast.
- 2.4 to 39.2: static medium-wide shot in two columns: the care block builds on the left, a small frame sits top right. The ring draws on at 35.4 to 36.0.

**S12**
- 0 to 19.9: the same layout.
- 19.93 to 20.13: the care block thins.
- 20.37 to 21.37: push to F-turn.
- 21.4 to 36.6: the hold, with ring, counter and playhead.
- 36.6 to 76.3: static, with the feel block. The doctor lines regrow at 58.4 to 58.8.

## Problems, worst first
1. **S11 2.4 to 39.2 and S12 0 to 19.9 read as a page of text, not a picture.**
   - The only drawing is a 640 x 70 band, about 2 % of the frame.
   - The strip from y 420 to 620 is empty across the full width until 35.4.
   - By S12 17.5 there are about 22 lines of type, mostly 30 px.
   - Fix: draw the ring at 35 % on "ten seconds" (S11 5.67). Fade the comfort line and the reasons on b38 (S12 0.0).
2. **S12 58.8 to 76.0: the doctor lines crowd the feel block.**
   - At Inter 40 the lines end at x 955; the question and the capsules start at x 1000. A 45 px gap lets the eye read straight across.
   - The line breaks split "(a | GP", and "away." sits alone on the last line.
   - Fix: dim the feel block to 35 % during b46a, and break the lines by hand at phrase ends.
3. **S12 36.6 to 76.0: chart labels left on screen with nothing to do.**
   - "0", "10 s", "A3 · Merc" and "A4 · Tavi, an octave up" stay for 40 s after the hold.
   - The top left is empty from 36.6 to 58.4.
   - Fix: fade those four labels with the ring at 36.2. Keep the band, Merc's line and "Nothing listens".
4. **S12 24.1 to 25.8: near-collision.**
   - When the ring breathes (worst at 24.5), its 12 o'clock tick comes 5 px below the baseline of "Breathe in, low and quiet", 12 px left of the "B".
   - Fix: raise the label's baseline 12 px, or start the label at x 1420 or later.
5. **Holds are over the target.**
   - S11: 3.5 s of holds in 39.2 s, about 2.7 s per 30 s (target about 1). The longest is 0.5 s at 19.5, while Merc talks with his mouth and arcs not moving.
   - S12: 4.3 s, about 1.7 s per 30 s.
   - S12 64.5 to 74.4: 9.9 s with no visual event.
   - Fix: make Merc's talk cycle follow his voice. Underline "a GP" (65.44) and "breathing or swallowing" (71.64).
6. **S12 20.37 to 21.37: the push reads as the right-hand group zooming.** Only a few bokeh discs shift.
   - Fix: let the staves and bokeh part visibly.
7. **The clip has voices only.**
   - The model note is silent while both hosts are shown singing (21.55 to 23.55).
   - The ticks at 25.69 and 35.79 are missing.
   - 24.6 to 36.6 is digital silence (-180 dBFS), with no room tone. LAB-CHECK 16 cannot be run on this clip.
8. **Minor.**
   - "rest a few easy breaths" drops the page's "for".
   - The phase row's lighting barely registers (peak luma 192 to 252).
   - The ring's bottom crosses the floor line (its stroke runs y 840 to 860).

## What was measured
- **Push:** lasts 1.0 s and lands 0.18 s before `listen`. The thinning starts after the stop line has landed. Both pass.
- **Hold:** the arc fills evenly from 12 o'clock. The counter shows 0 at 26.1 and 10 at 35.8. At 30.0 the playhead is at x 1305, which matches 4.2 s.
- **Joins:** S11 to S12 changes 158 pixels by more than 24 (host blinks), so the join is seamless. S12's last frame has the band at x 928 to 1824 and the line at y 153.
- **Contrast:** 9.8:1 or better wherever sampled.
- **Single-frame events:** 12, each 0.3 % of pixels or less. They are host blinks and the card's sub-pixel settle; none is visible.
- **Loudness (voices only):** S11 -20.0 LUFS and -1.2 dBTP; S12 -19.8 LUFS and -1.3 dBTP.
- **Words:** the doctor lines match b46a word for word. Nothing on screen is outside FACTS.

## Needs a person
- Whether the playhead reads as "listening" (LAB-CHECK 19).
- The note and the ticks, once they are in the mix.
- Whether the 30 px care lines read at phone size.
- The coach's sign-off.

Crops and stills: `stills/`. Measure output: `m11/`, `m12/`. Dense sheets: `d11/`, `d12/`, `d12x/`.
