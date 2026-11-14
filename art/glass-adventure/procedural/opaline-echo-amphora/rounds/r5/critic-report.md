# Opaline Echo Amphora, round 5

**Verdict: ONE MORE PASS.** Every gate passes, and the opal now has play of colour. Three material faults still show at gameplay size, and each is a cheap fix.

The entry shot is the only like-for-like runtime pair. In it, the candidate beats the shipped file on outline, gold, the scroll and colour spread. The shipped file keeps more of the concept's mint and greener jade.

## Round 4 items

1. Opal play of colour: **FIXED.** Chroma spread is 11.2 in three_preview (concept 10.3, shipped 9.1) and 12.8-13.8 at runtime (shipped 6.0-7.5).
2. Mint wave band: **PARTLY.** The mint is gone and the wave bodies are painted, but the band has gone grey (problem 1).
3. Dark jade: **FIXED** on the handles.
   - Texture median luminance is 142, and 15.7% of pixels are above 170.
   - Runtime handles are (92,133,111) and (83,123,100); the concept's are (99,132,105) to (102,141,105).
4. Close range:
   - The z 0.733 crease: **FIXED.**
   - z 0.171: **FIXED** (10.5 and 11.9 degrees).
   - Sleeves: **STILL PRESENT.** The geometry is unchanged, and they have 10 sides, not 12.

- Shard slivers: **STILL PRESENT**, 468 triangles under 2 degrees (was 407).

## Gates

- **Contract: PASS.** Intact 7,984/8,000 triangles, closed, 0 self-intersections, height 0.9188 m. 18 shards, 12,580/12,800 triangles, volume kept at 0.9997, 0 loose pieces.
- **Khronos: PASS.** 0 errors, 0 warnings.
- **Silhouette: forms_pass**, IoU 0.975.
  - The worst band is 8 (-0.010): the handle arcs are 3-7 mm too narrow per side at z 0.78-0.86.
  - The magenta at z 0.46-0.48 is a hole in the concept's mask, not the model.
- **Runtime proof:** it served this exact file (sha256 643289dc).

## Problems

1. **Grey wave band** (z 0.26-0.42).
   - Runtime saturation is 0.11 against the body's 0.21. In the concept they are equal (0.12 against 0.11).
   - Cause: glass_waves COLOR_0 is 1.0 everywhere, and waves_color has saturation 0.06.
   - Fix: paint the body's patch colours into the waves_color ground, until the band's chroma is within 2 of the body's.
2. **Pale, teal jade foot** (z 0.07-0.13).
   - Runtime L is 57-60 against the concept's 48.
   - The jade hue is 143-148 degrees; the concept's is 114-131.
   - Fix: shift jade_veins about 15 degrees toward yellow-green, and set the foot's COLOR_0 to about 0.75.
3. **The body goes cool in the game.**
   - b\* is -4.4 at entry and -7.2 in the face shot. The concept is +1.0, the shipped file +0.7, and three_preview gives +1.9.
   - Cyan-blue is 23-44% of the chromatic pixels (concept 7%).
   - The cream patches vanish: b\* 95th percentile +3 to +5, concept +12.
   - Likely cause: the lavender sheen (#5b4c71 at 1.0) and transmission 0.35.
   - Fix: neutralise the sheen, warm the vertex-colour average by about +4 b\*, and re-measure in the runtime proof.
4. **Matte glass.**
   - Lightness spread is 1.9 against the concept's 6.6; glints are 0.5% against 7.9%.
   - The shipped file is no better.
   - Fix: add a clearcoat of about 0.8 at roughness 0.04.
5. **Close range:**
   - The hammered normal map reads as rope on the rim and collar, and as cobbles on the base ring. Square the UV tiles and halve normalScale.
   - Give the sleeves 16 sides.
   - Blend out the 34-40 degree crease where the jade meets the gold tail (z 0.63-0.65).
   - Merge the two inner-neck rings at z 0.73 that sit 0.19 mm apart (60 needle triangles).
   - Widen the handle arc by about 5 mm at z 0.78-0.86.

## Not judged

- The break: no shot shows it.
- Walk-tilt misses the amphora.
- In the face shot, the "View artwork" button hides the left handle, and the camera is offset from the baseline's.
- Phone GPUs are untested.

Files in this folder: entry_pair.png (concept at in-game size, candidate and shipped file), cmp_three_r4_r5_ship.png, game_vs_concept.png, sheet.png, silhouette/overlay.png, hires/crop_rhandle_pair.png.
