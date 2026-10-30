# Component review B-05 (verification): s05-steps, s06-groups

**Verdicts: s05-steps KEEP. s06-groups KEEP. Group: KEEP.** Three of the four open problems are fixed. What remains is cosmetic. One cheap timing shift is still recommended (problem 1).

I worked from STORYBOARD rows 5–6, HANDOFFS, BRIEF and FACTS 70–74, and read nothing the builder wrote. The caller sent no opinions, so I had nothing to set aside. The rule against writing report files stopped me saving this to REPORT.md, so it is returned here for you to save.

## Previous items (B-04)
1. **Stair names blink out mid-move (s06): FIXED.** No frame shows a gap in the row.
   - Push: stair 8's "C" leaves past the right edge by 5.43, then "B" fades over 5.50–5.62 as the outermost name.
   - Truck: "C" leaves past the left edge by 9.42, then "D" fades over 9.50–9.58.
   - Pull: "D" returns over 12.30–12.45, before "C" comes in at 12.50.
2. **Tavi talks straight out of her rebound: STILL PRESENT.** Neither landing has changed by more than a frame.
   - s05: she falls 40.55–41.00 and holds her squash flat 41.03–41.22 (12 frames). She rebounds 26 px above rest at 41.40 and is 6 px below rest at the cut. Her line starts at s06 0.03.
   - s06: she falls 24.07–24.50 and holds flat 24.53–24.73. She peaks 28 px over rest at 24.88 and is 12 px under it at 25.03–25.10. Her line starts at 25.06, and she is at rest only at 25.20.
3. **Upper bracket at the top edge (s06 F-high): FIXED.** Its line is at screen y 51–56. The bead's top clears it by about 22 px at the 7→8 hop (11.13).
4. **Tavi drops past the tally (s05 40.73–40.85): STILL PRESENT, unchanged.** Her body passes 67 px from the last "S" and falls through the tally's band (y 214–260). HANDOFFS now records this as built, so I no longer rank it.
5. **Ghost outline strikes through riser labels (s06 13.4–14.7): FIXED.** Its tread lines now stop short of every "T" and "S". The fix leaves stray stubs (new problem 3).
- **Carried item 9 (o4 voiced with no Merc on screen, s05 17.1–21.4): STILL PRESENT.** The storyboard frames it that way.
- **Gold risers: FIXED in the documentation.** HANDOFFS § World now describes the 56 px run along the upper tread.

## Shots as read
- **s05:**
  - 0–10.45: WS, F0, static. The strip slides up 0.2–1.1, "a major scale" lands at 4.6 and the bead runs 5.7–10.2.
  - 10.45–12.05: push to CU-A.
  - 12.05–17.25: static CU.
  - 17.25–18.85: 480 px pan to CU-B.
  - 18.85–22.45: static CU-B.
  - 22.45–23.4: pull to F0.
  - 23.4–41.53: static WS. The run's tone onsets come every 0.80 s from 24.30, with the bead landing on each. The tally builds 31.5–35.0 and Tavi drops in from 40.55.
- **s06:**
  - 0–4.4: static WS. Tavi hops out 3.4–3.75 and the brackets draw 3.65–4.0.
  - 4.4–6.0: push to F-low (MS).
  - 6.0–8.75: static.
  - 8.75–9.85: truck up and right to F-high. The bead lands on G4 at 9.96, against a tone onset at 9.94.
  - 9.85–12.0: static.
  - 12.0–13.1: pull out to WS.
  - 13.1–35.22: static WS. The ghost outline travels 13.4–14.7, T switches to 2 at 20.2 and the sum builds 22.0–24.3. Tavi drops in at 24.07 and hops out 34.35–34.6. The labels are gone by 35.2.

## Problems, ranked
1. **Tavi's landings, bottom right (s05 41.0 to s06 0.1, and s06 24.5–25.2; item 2).** This no longer blocks the scenes: only 6–12 px of drift remains under her first syllable. It has now been raised three times, though.
   - Fix: start both falls 0.25 s earlier (s05 40.30, s06 23.82) with the curve unchanged. Each landing then settles about 0.15 s before her line.
2. **The echo ring in F-high runs into the bracket and the "S" (s06 11.75–12.2, top centre; new to these reports).** At 1.8x the C5 ring grows to about 120 px radius. It crosses the bracket line, touches the right edge of the "S" at 11.98 and comes within about 20 px of the top of the frame.
   - Fix: in framings above s 1.5, cap the ring at twice the bead's radius, or have it finish fading by that size.
3. **Stray stubs in front of labels (s06 14.2 and 14.4; side effect of item 5).** The masking leaves 15–20 px stubs of the ghost's treads floating just before an "S" and a "T".
   - Fix: drop any tread segment that would end within 24 px of a label, instead of clipping it at the label's box.

## Measured
| | s05 | s06 |
|---|---|---|
| Length | 41.53 s, 60 fps | 35.22 s, 60 fps |
| Holds | 0.4 s (0.3 s per 30 s), longest 0.1 s | 0.6 s (0.5 s per 30 s), longest 0.2 s |
| Loudness | −15.8 LUFS, LRA 2.7, −1.8 dBTP | −15.7 LUFS, LRA 3.0, −1.7 dBTP |

- **Single-frame events, all explained, no glitch frames:**
  - s05 4.68–4.90: "a major scale" finishing its rise in 1 px steps, which is not visible.
  - The rest are as in B-04: s05 12.05, 16.92, 19.37–19.93 and 38.13–38.42; s06 1.40, 6.78 and 25.58–32.38.
- **Contrast:** the lowest is a lit stair name in F-high at 5.8:1. The legend's dim brackets measure 9.4:1.
- **The s05/s06 cut:** outside Tavi, 328 pixels change by more than 24 (the largest change is 61). All of them are on the edges of "S" glyphs, and side-by-side crops look identical.
- **Handoffs:** s05's frame 0 matches § A to B and s06's last frame matches § B to C.
- **Clearance:** the semitone hop at 11.13 passes 12 px above the "S".
- **Claims:** all on-screen text is within FACTS 70–74.
- **Rows glow (20.5–21.6):** it reads as a soft band climbing, not as twelve countable rows. The sum carries the count with the sound off.

## Could not judge
- **Effects against the bed.** There is no music-only render. The voice band drops to about −56 dB before both of Tavi's lines, so both landings play in near-silence.
- **The mix on phone speakers.**
- **Parallax in the push and the truck.** I did not re-measure it.
- **Captions in F-high.** I cannot tell how captions read over the bright strip there (y 918 and below).

Files are in /home/user/mercurypitch/output/motion/lesson-04/review/component-B-05/crops/:
- s06-push-names.jpg
- s06-truck-names.jpg
- s06-pull-names.jpg
- ghost-grid.jpg
- ring3.jpg
- s06-semi-hop.jpg
- s05-summary.txt and s06-summary.txt (the measurement summaries)

I deleted the temporary frames from /dev/shm.
