# Opaline Echo Amphora, round 7

**Verdict: ONE MORE PASS.** Gates pass; form, joins, walls, UVs and fracture are done. The blocker is material-only: the opal (namesake, largest surface) reads too dark in game. Seventh ONE MORE PASS in a row: per the skill, report this blocker to the owner.

## Round 6 items

1. UV shear: **FIXED.** 90 degrees on every part (r6: foot 96-162, rim 116). The foot swirl, rim rope and +X crackle seam are gone.
2. Tail crease: **FIXED.** Clean in clay and zebra; the 37-38 degree edges left are lengthwise strap-section corners.
3. Flat opal: **STILL PRESENT.** L\* std 3.1 (r6 2.6, concept 6.7); lavender 15-16% (r6 13%, concept 22%).
4. Jade: **PARTLY.** New veins, but evenly spaced and parallel; blotches kept.
5. Waves: **STILL PRESENT.** waves_color is about 5 levels darker; same design.
6. Slivers: **PARTLY.** 250 under 2 degrees (r6 269).

Earlier fixes hold: foot L* 50.6, body b* +1.6 to +1.9.

## Gates

- **Contract: PASS.** 7,988/8,000 tris, closed, 0 self-intersections, 0.9188 m. 18 shards, 12,346/12,800, volume 1.00, 0 loose.
- **Khronos: PASS.** 0 errors, 0 warnings; textures at most 512 px; 1.79 MB.
- **Silhouette: forms_pass**, IoU 0.976. Worst band 1 (+0.0088): the foot top is up to 12 mm per side full at z 0.10-0.12. The bar at z 0.45-0.48 is a hole in the concept mask.
- **Runtime:** this file was served (766ec383).

## Problems (entry shot against the concept at in-game width)

1. **Opal too dark and flat.** Body median luminance 164 (p5-p95 151-175), below the wall's 173. The concept's is 208 (181-245), above its backdrop's 187. Jade (122 vs 129) and gold (154 vs 160) match in the same frame, so the material is wrong, not the light. Baseline: 161.
   - Fix: probe in game with glb_recolour/glb_patch: COLOR_0 +12 L\* with more lavender, then transmission 0.35 to 0.15.
   - Exit: median at least 188, spread at least 40, lavender at least 20%.
2. **Neck cream:** b\* +8 to +9, hue 84 (concept +1.3, hue 129). Likely the warm sheen (0.35, 0.32, 0.27).
   - Fix: sheen (0.31, 0.33, 0.32) and mint COLOR_0; b\* at most +3.
3. **Gold satin:** base-ring luminance spread 41 (concept 125); both golds have metallic 0.75.
   - Fix: 1.0 (craft rule 11).
4. **Jade blotches** show as white flecks at 128 px.
   - Fix: halve cloud contrast; vary vein angle and spacing.
5. **Waves, close range:** a thin Vitruvian scroll.
   - Fix: teal bodies from crest to lower band, with 2-3 foam stripes.
6. Slivers and the foot top: cosmetic.

## Not judged

Sides and back in game (walk shots miss it), break in motion, phone GPUs.

Evidence in this folder: critic-sheet.jpg, entry-against-concept.jpg (the body darker than the wall
behind it, where the concept's is lighter than its backdrop), tail-r6-r7.jpg, jade-r6-r7-concept.jpg,
waves-r6-r7-concept.jpg.
