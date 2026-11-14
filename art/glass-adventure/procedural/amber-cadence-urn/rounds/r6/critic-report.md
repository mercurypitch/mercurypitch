# Amber Cadence Urn, round 6 (verification)

**Verdict: ONE MORE PASS.** Gates pass, but in game the body is opaque caramel, further from the concept's hue than the shipped file, and the cabochon is a speck. It beats the shipped file on outline, lobes and shoulder band; it loses on colour and jewel.

## Round 5 items

1. **Glass: STILL PRESENT.** Centre lobe p5/p95 101/133 (concept 65/148); lower-lobe b* 37 (target 48). The thickness map moved p95 by 5; a* fell from 14 to 10 (concept 22).
2. **Glass through cup: FIXED.** No glass below the cup edge, in a ray scan or in game.
3. **Lower band: PARTLY.** Leaves metallic 1.0, roughness 0.25; in-game p5 69 (concept 36), still a braid.
4. **Marble: PARTLY.** Neck a*/b* 2/18 (concept 8.5/27); veins tile as parallel diagonal wiggles; "8" loops remain.
5. **Cabochon height: FIXED, size regressed.** On the band (z 0.583), but shrunk from 64×69 to 48×46 mm.

- Cup corner STILL PRESENT. Fillets FIXED (9–13 mm). Valley zigzag hidden. Lip, segments unchanged.

## Gates

- Contract PASS: intact 9,632/9,800 tris, closed, 0 self-intersections; 16 shards, 15,506/16,000, 0 loose, volume 99.96%.
- Khronos PASS: 0 errors, 0 warnings.
- Silhouette forms_pass: IoU 0.990; worst band +0.016: cup 6–7 mm per side too wide at 0.165–0.18 m.

## Problems, worst first

1. **Body reads as satin butterscotch** (runtime entry): saturation 0.68 (concept 0.81, shipped 0.78). Two passes unmoved: switch method. Fix: roughness 0.4 to 0.12 and an opaque cavity liner graded from (110,45,8) at the creases to (235,160,40) at lobe centres, so transmission refracts a lit interior, not the room. Target centre lobe p5/p95 65/150, a\* 18+.
2. **Cabochon is a speck:** 29 green px (concept 86 at equal width). Fix: upright oval stone 55×70 mm, bezel 65×80 mm, at z 0.575, over both fillets.
3. **Cup is a thin paper crown:** each crease ends on a flat shelf 51 mm deep at z 0.222; cusps rise 30 mm, concept about 85. Fix: peaks to z 0.27, marble filling each crease down into the glass, 4 mm edge round.
4. **Lower band braid:** recess 37 mm (concept 46), two thirds of it leaf. Fix: recess 46 mm, leaves half of it.
5. **Marble stripes, cool in game.** Fix: branching (147,100,49) crackle without loops or visible repeat; warm the base until the in-game neck reads a*/b* 8/27.

## Could not judge

- Glass on a phone GPU.
- Shards in flight; the central shard (foot core, solid glass base 0.112–0.24 m) is 20% of the volume.
- Only the entry shot frames the urn.
- If this is the sixth straight ONE MORE PASS, report the glass as the blocker.

Evidence: runtime-entry-compare.jpg (candidate, shipped file and concept in the game's entry shot), cusp-shelf-clay.jpg (a crease ending on the cup's cusp shelf), game-128-vs-concept.jpg.
