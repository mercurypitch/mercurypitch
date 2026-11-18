# Opaline Echo Amphora, round 4

**Verdict: ONE MORE PASS.** All gates pass, and the form, gold and joins are at ship level. The opal is now the right average colour, but it has lost its play of colour. In the game's renderer the body is an almost neutral pearl. The shipped file it replaces carries the concept's iridescence better.

## Round 3 items

1. **Yellow-green opal: PARTLY.**
   - Fixed: yellow-green pixels went from 92% to 0% (the concept has 23%).
   - The runtime average colour is a*/b* -7.9/-2.7 against the concept's -6.1/+1.2. That is closer than the shipped file (-14.1/+3.4).
   - Not fixed: there are now about a dozen colour patches, but they are too faint to read (problem 1).
2. **Close-range creases:**
   - z 0.176: **PARTLY**. 31 degrees is now 15.6 (the rule is about 12).
   - z 0.736: **STILL PRESENT**. 26.9 degrees at z 0.733.
   - z 0.60-0.67: **FIXED**. Now 10.1-10.4 degrees.
3. **Jade: PARTLY** (problem 3). Neck straps: **FIXED**, now 16 mm.

- **Texture budget: PASS.** Largest texture 512 px, GLB 1.67 MB.
- **Shard slivers: STILL PRESENT.** 407 triangles under 2 degrees (was 410).

## Gates

- **Contract: PASS.** Intact 7,972/8,000 triangles, closed, 0 self-intersections. 18 shards, 12,168/12,800 triangles, volume kept at 0.9998, 0 loose pieces.
- **Khronos: PASS.** 0 errors, 0 warnings.
- **Silhouette: forms_pass**, IoU 0.974. Worst band is 8 (-0.0088): the handle crowns are 3-5 mm too narrow per side at z 0.79-0.85.
- **Runtime proof:** it served this exact file (sha256 ebe5d34a).

## Problems

1. **The opal has no play of colour** (whole body). The measure is how widely the upper body's colour varies (Lab chroma spread):

   | Source       | three_preview | Runtime |
   | ------------ | ------------- | ------- |
   | Concept      | 10.4          | 10.4    |
   | Shipped file | 9.1           | 6.6-8.5 |
   | Candidate    | 3.6           | 5.4-5.8 |
   - At runtime there are no lavender or warm patches. a* peaks at +0.4 (concept +8) and b* at +3 (concept +12).
   - Cause: the body's vertex colours (glass_shell COLOR_0) span only sRGB 0.73-0.93.
   - Fix: keep the average and push each patch about 2.5 times further from it. Push saturation, not lightness; round 3 found that lightening goes flat white. Include lavender (a* +6 to +8), cream (b* +8 to +12) and mint (a\* -12) patches. Target a spread of at least 9 in three_preview.

2. **The wave register reads as a mint stripe** (z 0.26-0.42).
   - At runtime the band's saturation is 0.24 against the body's 0.16. In the concept the band matches the body (0.12 against 0.11) and is only 15% mint.
   - `waves_color` is a flat (166,203,169) with no wave bodies painted in, so only the gold line survives at gameplay size.
   - Fix: tint the band with the body's average colour. Paint each wave body teal under its stroke, grading to a milky crest.
3. **The jade is too dark.**
   - The texture's median luminance is 111, and 3.8% of its pixels are above 170 (concept 18-28%).
   - Runtime handles are (62,97,73); the concept's are (91,125,98) to (119,157,123).
   - Fix: raise the median to about 135 and cover about 20% with pale mint.
4. **Close range only.**
   - Add rings at z 0.729 and 0.738 to round off the z 0.733 crease, and one ring at z 0.171.
   - A body ring costs 60 triangles and only 28 are free. Take them from the stem ring (504) or the base ring's hidden underside (448).
   - The handle sleeves have 12 sides, and the facets show within about 1 m.

## Not judged

- The break: no shot shows it.
- Walk-tilt misses the amphora. In the face shot the "View artwork" button hides the candidate's left handle and neck, and the camera sits about 45 px off the baseline's. Only the entry pair is a like-for-like comparison.
- How it looks on a phone GPU.

Files are in this folder: gameplay_size.png (concept, r4, shipped file and r3 side by side at in-game size), three/cand_big.png, three/base_big.png, sheet.png, silhouette/overlay.png.
