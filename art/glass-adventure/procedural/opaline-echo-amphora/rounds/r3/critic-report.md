# Opaline Echo Amphora, round 3

**Verdict: ONE MORE PASS.** Gates pass; form, gold and handles are near ship. In the game the opal body, the largest surface, reads as yellow-green ceramic, further from the concept than the shipped body.

## Round 2 items

1. Flat white opal: **PARTLY.** Unclipped but overshot (problem 1).
2. Brown wave line: **FIXED.** Stroke (168,140,78), concept (171,140,86).
3. Half-gold handles: **FIXED.** Jade 63-76 mm, gold 7-10 mm per side at z 0.66-0.80.
4. Close range:
   - polished gold: **FIXED**
   - white veins: **FIXED** (0%)
   - spiral seam: **FIXED**
   - tail blade: **FIXED** (104 x 54 mm, seated)
   - kinks: **PARTLY** (z 0.876 now 8 degrees; problem 2)

- Texture budget: **PASS** under the amended brief (at most 512 px, 1.71 MB). Owner to confirm.
- Shards: **STILL PRESENT.** 410 triangles under 2 degrees (was 417). No confetti; 11 multi-shell, 0 loose.

## Gates

- **Contract: PASS.** Intact 7,912/8,000, closed, 0 self-intersections. Shards 18, 12,528/12,800, volume 0.9999.
- **Khronos: PASS.** 0 errors, 0 warnings.
- **Silhouette: forms_pass**, IoU 0.974.
  - Worst band 8 (-0.0088): handle crowns up to 7 mm narrow per side, z 0.79-0.86.
  - Magenta bar at z 0.45-0.47: a concept-mask hole.

## Problems

1. **The opal is yellow-green at runtime** (entry and face, z 0.44-0.90).
   - Candidate: 72-93% of upper-body pixels at hue 60-130, saturation 0.25, 0-2% neutral.
   - Concept: 37% mint-cyan, 21% milky neutral, 10% lavender, saturation 0.12.
   - Shipped file: 73-87% mint-cyan.
   - Cause: glass_shell COLOR_0 (mean 0.45,0.67,0.54); without it three.js renders white.
   - Tested in three_preview: a 15% blend toward (0.86,0.91,0.93), with blue raised to R+0.2 where green leads, gives 0% yellow-green, 38% mint-cyan, 55% neutral, saturation 0.08. Shipped file: 63%, 0.07. Blends of 35% or more go flat white. File: experiment/m15l20.glb. Confirm at runtime.
   - Patches: three broad zones; the concept shows a dozen.
2. **Close-range creases.**
   - 31 degrees at z 0.176: a 17 mm shelf above the stem ring reads as a corner.
   - 27 degrees at z 0.736.
   - 11-13 degrees per ring at z 0.60-0.67.
   - Fix: spline through the brief's r 0.101 at 0.167, 0.118 at 0.175 and 0.143 at 0.20, with rings at z 0.171, 0.183, 0.615, 0.640 and 0.731. Rings cost 60 triangles and 88 are free: take them from the hidden inner wall.
3. **The jade lacks light patches.** 18-28% of the concept's handle pixels exceed luminance 170; the texture peaks at 134, so the handles read dark bottle-green (55,91,69) at runtime. Paint pale mint patches over about 20%. The neck straps are 12 mm (brief 15 mm).

## Not judged

- No shot above 120 px or of the break; walk-tilt misses the amphora.
- Phone GPU.

Files: this folder. `sheet.png` (25 panels), `silhouette/overlay.png`, `runtime_crops.png` (concept, candidate and shipped file side by side), `three/toggles.png` (each material feature switched off in turn), `experiment/compare_fix.png` (concept, current file, patched variants and shipped file).
