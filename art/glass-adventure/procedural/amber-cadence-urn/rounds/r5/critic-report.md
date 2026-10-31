# Amber Cadence Urn, round 5 (verification)

**Verdict: ONE MORE PASS.** Gates pass and the form is right. In the game the body still reads as opaque caramel, not amber glass, and glass now shows through the marble cup. Not clearly better than the shipped file.

## Round 4 items

1. **Glass: PARTLY.**
   - Wainscot band gone; hue 31–33° (concept 30–32°).
   - Centre lobe flat: p5/p95 95/131 (concept 56/199).
   - Lower lobe L*a*b\* 45/14/34 (concept 49/23/49).
2. **Shoulder colour: FIXED.** a\* 7.5 (concept 9.5).
3. **Cup: PARTLY.** Flush at the crests (−0.7 to +1.2 mm); the corner is still a hard 90° step.
4. **Lower band: PARTLY.** In-game p5 66–73 (concept 45). Leaves still metallic 0.6, roughness 0.4.
5. **Marble: PARTLY, overshot.** Neck p5/p95 152/178 (concept 119/202), a*/b* 3/17 (concept 8/27).
6. **Valley ends: FIXED.** A zigzag remains at 0.20–0.235 m, half hidden by the cup.
7. **Foot corner: FIXED.** 2–3 mm normal to the edge.
8. **Lobes: FIXED.** Creases 43–57 mm deep from 0.214 m up.

- **Neck rings: FIXED.**
- **Lip: PARTLY.** 21–35° per segment, but it shades smooth.
- **Fillets: PARTLY.** 6.0/4.5 mm.
- **Segments:** 32, not 40. Not visible.

## Gates

- **Contract: PASS.**
  - Intact: 9,248/9,800 tris, closed, 0 self-intersections.
  - Shards: 16, 15,006/16,000 tris, 0 loose, volume 99.97%.
- **Khronos: PASS.** 0 errors.
- **Silhouette: forms_pass.** IoU 0.990.
  - Worst band +0.016: +5–7 mm per side at 0.17 m.
  - Body within ±2 mm from 0.19 to 0.53 m.

## Problems, worst first

1. **The glass reads as satin caramel** (critic/side-3x.png). The vertex tint is already at rule 11's limit. Fix: add a volume thickness texture, 0.03 m at the lobe centres and 0.15 m in the creases and each lobe's outer fifth. Target centre-lobe p5/p95 60/190 and lower-lobe b\* 48.
2. **Glass pierces the cup** on both flanks of every scallop peak at 0.19 m (13×7 mm), with slivers at 0.17 m. In the game: orange specks at (616,194) and (662,194). Fix: push the cup's outer wall 3 mm out from 0.17 to 0.21 m.
3. **The lower band reads as pale braid.** Fix: leaves metallic 1.0, roughness 0.25; recess (25,18,10).
4. **The marble is pale and cool**, and its looped veins read as scribbles on the foot. Fix: base (240,212,172) and branching veins.
5. **The cabochon sits too high.** Its centre is 29 mm above the band face, half over the neck. Fix: lower it 25 mm onto the band.

## Runtime against shipped

- **Candidate:** truer outline, eight lobes, better shoulder band.
- **Shipped:** brighter body (lower lobe L\* 52.5 against 45) and a darker lower band.

## Could not judge

- The glass on a phone GPU.
- The shards in flight.
- Only the entry shot frames the urn.

Evidence: concept-candidate-shipped.jpg (the concept, this build and the shipped file at the size the game draws them), glass-through-cup.jpg (material ids: amber showing through the cup on each scallop's flanks), runtime-entry.jpg.
