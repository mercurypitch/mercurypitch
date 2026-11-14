# Critic report: Opaline Echo Amphora, round 2 (verification)

**Verdict: ONE MORE PASS.** The form now matches the concept. The texture budget fails and the opal renders flat white.

## Round 1 items

1. Opal: **PARTLY.** Grey bowl and streaks gone; upper body and neck still clip to #FFFFFF on 100% of pixels.
2. Jade: **FIXED.** Hue 137, saturation 0.34 (concept 129, 0.26).
3. Handle tops: **FIXED.** Apex 0.8762, strap 72-85 mm, loop hole z 0.658-0.814 (concept 0.657-0.816).
4. Cuffs, neck straps: **FIXED.** Sleeve 3.3-3.6 mm proud; 13 mm strap from collar to cuff.
5. Wave line: **PARTLY.** Smooth, 8 mm, placed per the brief, legible at 128 px; renders dark bronze.
6. Wall: **FIXED.** 8.3-9.7 mm; handle root 4.4 mm from the cavity.

## Gates

- **Contract: PASS.** Intact 7,976/8,000, closed, 0 self-intersections; shards 18, 12,266/12,800, volume 0.9993.
- **Khronos: PASS**, 0 errors, 0 warnings.
- **Silhouette: forms_pass**, IoU 0.974. Worst band 8 at -0.010: the handle shoulders are 4-6 mm narrow per side at z 0.79-0.85.
- **Brief budget: FAIL.** Five PNGs are embedded (153 KB); the brief says "no textures in this version". The owner amends that line or they go.

## Problems, by cost at gameplay distance

1. **The opal is flat white** (z 0.44-0.90). The concept's upper body is (192, 212, 204); the model's is (255, 255, 255) with no variation. Gold and jade match the concept in this rig.
   - Tested: sheen does nothing.
   - COLOR_0 at 0.4-0.5 of its value, with saturation x2.5, gives (217-231, 227-240, 248-253) and visible mint, lavender and peach. Bias the patches toward mint.
2. **The wave line reads as brown ink**: (91, 70, 60) against gold (196, 159, 95). Tested: stroke roughness 0.55 and metallic 0.7 (packed G 140, B 178) give (167, 131, 92).
3. **The handles read half gold** (front, z 0.60-0.80). The lining shows 16-21 mm and the jade 46-48 mm; the concept shows 65-77 mm of jade. Keep the lining to the inward 90 degrees of the section.
4. **Close range:**
   - All gold is hammered; the concept's cuffs, linings, straps and stem ring are polished.
   - The jade veins are near-white over 13.6% of the area (concept 0.2%).
   - A hairline normal-map seam runs under each spiral; bake the map with wrap-around.
   - The tail leaf is a 7-20 mm blade.
   - The profile turns 17-19 degrees at z 0.181 and 0.876. Add rings at z 0.19, 0.23, 0.63, 0.66 and 0.86 (320 triangles).

## Not judged

- **three.js:** no runtime proof was supplied. Confirm the albedo and stroke targets there.
- **Shards** (fracture round): 11 of 18 are made of 2-4 pieces; 417 triangles are under 2 degrees.

**Files:** /tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/amph/rounds/r2/
