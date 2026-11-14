# Amber Cadence Urn, round 2 (verification)

**Verdict: ONE MORE PASS.** The gates pass and the form is close to the concept. But it still reads as glazed pottery, not amber glass and gold.

## Round 1 items

1. Glass: **STILL PRESENT**.
   - Transmission is still 0.35 on an orange base.
   - The runtime body measures 47/109/142 against the concept's 52/112/188.
   - The dark end is painted into the vertex colours: white at the crests, 5% in the valleys. That breaks craft rule 11.
2. Marble: **PARTLY**. Saturation is fixed (0.38 neck, 0.36 foot), but the veins vanish: neck luminance 148–165 against 113–182.
3. Shoulder band: **PARTLY**. It measures (152,135,92) at a* 0 against the concept's (176,130,77) at a* 10. Leaf metallic is 0.30 and gold is 0.75.

4–7.

- Cup: **PARTLY** (problem 3).
- Lobes: **FIXED**, 13–15% deep from 0.28 to 0.51 m.
- Cabochon: **FIXED**. Green, 64×69 mm, beads present, tilted 35°.
- Shoulder join: **FIXED**. The cavity is clear.

8. Minor items:
   - Mouth, neck sink (now 4 mm), laurel transmission and shoulder outline: **FIXED**.
   - Foot corner, 30 mm proud per side: **STILL PRESENT**.

## Gates

- Contract: **PASS**.
  - Intact: 9,396 of 9,800 tris, closed, 0 self-intersections.
  - Shards: 16, with 15,250 of 16,000 tris, 0 loose, volume 100.02%.
- Khronos: **PASS**, 0 errors, 0 warnings.
- Silhouette: **forms_pass**, IoU 0.9895.
  - Worst band +0.0212 at 0.17 m (the cup), about 8 mm per side.
  - Foot band +0.020.

## Problems, by cost at gameplay distance

1. **Glass, body (entry shot).**
   - It reads opaque. The lower quarter is milky: saturation 0.66 against 0.87.
   - The far edge of the cup shows through as a scalloped line.
   - Fix: transmission 0.9, with the amber in attenuation (distance 0.07 → 0.02 m, thickness 0.03). Tune in three.js until body p95 is near 180.
2. **Shoulder band, 0.55–0.60 m (all views).**
   - It reads as ivory on bronze, not gold.
   - Fix: leaves metallic 1.0, roughness 0.25; ground (60,40,20); `gold_polished` metallic 1.0.
3. **Cup, 0.17–0.22 m (1100 px front).**
   - It is a 5 mm skirt standing 3–13.5 mm off the glass: 6 mm slots at the crests, 5 mm in the valleys. It reads as a paper crown.
   - Fix: a solid cup at least 15 mm thick with a rounded rim, its inner face sunk 2–3 mm into the glass.
4. **Lower band, 0.13–0.165 m.**
   - At 128 px it is a thin dark strip: two rows of small leaves in a 4 mm recess.
   - Fix: one row of 32 mm leaves running out from the bead, fillets 5 mm proud.
5. **Marble, neck and foot (all views).**
   - The crack-like veins read as crackle glaze.
   - Fix: soft tan veins 3–6 mm wide, about (190,140,80).
6. **Valley ends (zebra), 0.24 and 0.50 m.**
   - Closed eyes. At the lower end the valley radius runs 0.349, 0.342, 0.354 m, with turns of 59° and 37°.
   - Fix: fade the valley depth steadily into the cup.

## Runtime against the shipped file

Only the entry shot frames the urn, at about 170 px.

- Candidate: closer outline, lobes and cabochon.
- Shipped: more saturated body (b\* 42 against 35; concept 44) and lobe piping.

Not clearly better.

## Could not judge

- The right and tilt shots miss the urn.
- There is no shatter shot.
- I could not check how the glass reads on a phone GPU.

Fracture is sound: 97% of the amber_cut faces lie inside the glass, and the largest shard is 23.3% of the volume.

Evidence in this folder: critic-sheet.jpg, game-size-compare.jpg, material-front.jpg,
cup-section-crest.jpg and cup-section-valley.jpg (the cup's slot behind its 5 mm skirt),
runtime-entry.jpg.
