# Amber Cadence Urn, round 3 (verification)

**Verdict: ONE MORE PASS.** The gates pass, and the outline is clearly closer to the concept than the shipped file's. But in the game the body still reads as milky orange pottery sitting in a thin "paper crown" cup, not as amber glass.

## Round 2 items

1. **Glass: STILL PRESENT.**
   - The median colour now matches the concept.
   - Contrast is too low: body luminance p5/p95 is 78/125, against the concept's 60/186.
   - The lower half is milky: saturation 0.66 against the concept's 0.83.
   - The scalloped line still shows through the body.
   - Transmission is still 0.5; round 2 asked for 0.9.
   - The valley tint goes down to (0.64,0.39,0.22). Rule 11 allows no darker than (0.8,0.65,0.5).
2. **Shoulder band: PARTLY.** a\* is 4.7 against the concept's 10, and the leaves are metallic 0.40.
3. **Cup: STILL PRESENT.**
   - The edge is square, 3.0 mm thick at the crests and 1.8 mm at the valley tips.
   - It stands 4.1 mm off the glass at the crests and 9.0 mm at the valley tips.
4. **Lower band: PARTLY.**
   - There is now one row of leaves, and the fillets stand 4.9 mm proud.
   - The leaves are only about 19 mm long.
   - In the game the band is 6 px tall; the shipped file's is 13 px.
5. **Marble: STILL PRESENT.** The neck's luminance spans 140–165 in the game, against the concept's 120–225.
6. **Valley ends: STILL PRESENT.** The zebra shows closed eyes at 0.25–0.29 m. Up the valley the radius goes 0.356, 0.349, then 0.364 m.
7. **Foot corner: STILL PRESENT**, up to 27 mm too wide per side.
8. **Lobes, cabochon and shoulder join:** still fine.

## Gates

- **Contract: PASS.**
  - Intact: 9,332 of 9,800 tris, closed, 0 self-intersections.
  - Shards: 16, with 15,216 of 16,000 tris, 0 loose, volume 100.15%.
- **Khronos: PASS**, 0 errors.
- **Silhouette: forms_pass**, IoU 0.9869. The shipped file scores 0.9295 and fails.
  - The worst band (+0.0262) is the cup step at 0.165 m, 7–10 mm too wide per side.
  - The shoulder top at 0.59 m is 13–15 mm too wide per side.

## Problems, worst first

1. **Glass body (entry shot).** Through the glass you see the cup's far edge, and the bottoms of the creases show as red V marks. Fix:
   - Set transmission to 0.9 and put the amber in attenuation (distance 0.03 m).
   - Add a 20 mm amber floor, and give the cup an amber face where it sits under the lobes.
   - Keep the valley tint no darker than (0.8,0.65,0.5).
2. **Cup, 0.17–0.235 m.** Fix: a solid cup at least 15 mm thick, with a rounded rim, sunk 2–3 mm into the glass, at 64 segments.
3. **Crease ends, 0.25–0.29 m.** Fix: fade the valley depth steadily to 0 at the cup, with no tint there.
4. **Lower band.** Fix: leaves 32 mm long, metallic 1.0.
5. **Shoulder leaves.** Fix: metallic 1.0, roughness 0.25.
6. **Neck and rim, 0.59–0.72 m (seen when walking up).** It has only 9 rings, each turning 22–31°, and the lip is flat.
   - Fix: at most 12° of turn per ring, and a rolled lip (`rolled_lip`).
   - Pay for the extra rings with the glass hidden inside the lower band.
7. **Marble.** Fix: veins 3–6 mm wide, colour (150,105,60).

## Runtime against the shipped file

- **Candidate:** closer outline and hue. a\* is 21.4, against the shipped 14.7 and the concept's 20.4.
- **Shipped:** bolder bands, and a clean body with no marks.

Not clearly better yet.

## Could not judge

- How the glass renders on a phone GPU.
- The shards in flight.
- Three of the four runtime shots crop the urn.

The brief's lower-band heights (0.07–0.12 m) contradict the mask (0.12–0.17 m); the model follows the mask.

Evidence in this folder: critic-sheet.jpg, runtime-entry-compare.jpg, game-128-vs-concept.jpg,
cup-zebra.jpg (the creases' lower ends), cup-section-crest.jpg, rim-clay.jpg.
