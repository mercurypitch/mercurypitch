# Amber Cadence Urn, round 1 critic report

**Verdict: ONE MORE PASS.** The gates pass, but at gameplay size this reads as an opaque yellow pumpkin pot, not amber glass set in cream marble and gold.

## Gates

- Contract: **PASS**, 0 problems. Intact 9,740 tris (cap 9,800), closed, 0 self-intersections, 0.7193 m tall. 16 shards, 15,724 tris (cap 16,000), 0 loose pieces, volume kept 99.94%.
- Khronos: **PASS**, 0 errors, 0 warnings.
- Silhouette at 4°: **forms_pass**, IoU 0.9877. Worst band is the foot (0–0.07 m) at +0.0287 against a 0.03 limit. The reference mask's foot includes 1.1 cm of floor shadow.
- Budgets: **PASS**. Textures at most 384 px, GLB 1.61 MB.

## Problems, ranked by cost at gameplay distance

1. **The amber is not glass.** Opaque butterscotch in Cycles and three.js. Body luminance p5/p50/p95 at game size is 65/114/147, against the concept's 48/110/200 (shipped: 77/116/164). `amber_glass` has transmission 0.35, so 65% is diffuse. Fix: transmission at least 0.9, a pale base, amber in attenuation. Tune in `three_preview.mjs` to a p5–p95 spread near 150.
2. **The marble is white.** Runtime saturation is 0.10 on the neck and 0.06 on the foot, against the concept's 0.32 and 0.44. The foot vanishes into the plinth. Fix: albedo about sRGB (225,190,150) with bolder tan veins; target runtime saturation of at least 0.3.
3. **The shoulder band reads dark brown.** Runtime rgb (111,102,72) against the concept's gold (183,132,73). The leaves fill only the middle 50% of the map, on (54,37,21). Fix: leaves about 45 mm long filling 85% of the band, a lighter ground, metallic 1.0 (leaves and `gold_polished` are 0.75).
4. **The marble cup is missing.** The concept has about 2 cm of cream marble at 0.157–0.175 m, rising between the lobe bottoms. Here the amber meets the lower band at 0.172 m. Fix: a marble collar from 0.17 to 0.19 m with the lobes rounding into it.
5. **The lobes are soft.** Creases are 21 mm (7%) at 0.19 m, 44 mm (10%) at 0.36 m and 15 mm (4%) at 0.545 m. Each is a sharp V fading out at both ends, where the concept has full-height rounded valleys. Fix: at least 12% depth, at least 8% at the ends, a 10 mm round in the valley.
6. **The cabochon lies flat and is teal.** On the 22° band it is 68 mm wide but only 43 mm tall in view: 8×3 px at 128 against the concept's 8×9. Hue 136° against the concept's olive 89°. Flanking beads missing. Fix: tilt it within 20° of vertical, bezel breaking both fillets, base about sRGB (60,85,38).
7. **The shoulder-band join is broken.** The lower edge at 0.55 m is ragged all round. Over the creases the plate stands 5–9 mm proud. The 10 mm gold plate pierces the cavity face by up to 0.8 mm near r 0.30 m (z 0.556–0.570), in 25% of samples. Shards show it as a gold sawtooth on the inner glass. Fix: sink at most 8 mm on an unlobed cone, with a proud torus fillet along the lower edge.
8. **Minor issues:**
   - Shoulder radius 7–22 mm proud at 0.56–0.61 m; foot's bottom corner 20 mm proud.
   - Mouth interior is marble where the concept shows amber.
   - Neck sunk 9 of 10 mm into the glass flange.
   - Laurel materials carry transmission 1 with all-zero maps.

**Fracture is sound.** Cut faces are `amber_cut` and show about 1 cm of wall, with no confetti. The four base shards hold 63% of the volume (largest 22.6%).

## Runtime against the shipped file

The proof is of this exact GLB (sha256 ed9b9a8f). Only the entry shot frames both, at about 165 px. Its outline is closer to the concept, but it reads plainer: white foot, dark band, teal dot. The shipped file reads richer, with lobe piping, a collar and proud bands. Not clearly better.

## Could not judge

The candidate's right and tilt shots miss the urn. There is no in-game shatter shot, and raised transmission is untested in three.js and on phone GPUs.

Evidence:

- critic-sheet.jpg
- game-vs-concept.jpg
- explode-pierce.jpg
