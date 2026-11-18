# Amber Cadence Urn, round 4 (verification)

**Verdict: ONE MORE PASS.** The geometry improved, but the glass got worse. In the game the lower body shows the black wainscot behind it as a brown band (0.22–0.36 m in the entry shot), and the cup's edge shows inside that band.

## Round 3 items

1. **Glass: STILL PRESENT.**
   - Transmission is now 0.9, but attenuation distance went from 0.10 to 0.15 m (0.03 was asked).
   - Lower lobe L*a*b\* is 33/9/21; the concept's is 48/23/48.
   - Upper half luminance p5/p95 is 106/125; the concept's is 56/196.
   - The valley tint, sRGB (0.82, 0.66, 0.50), is within rule 11. Round 3 compared the linear value with the sRGB limit.
2. **Shoulder band: PARTLY.** Leaf metallic went from 0.40 to 0.60, but a\* is still 4.7 (concept 10.3).
3. **Cup: PARTLY.**
   - Now 12–13 mm thick and sunk into the glass at the crests.
   - Still 4–6 mm proud of the glass at the scallop peaks (0.21–0.23 m).
   - The rim is faceted, not rounded.
4. **Lower band: PARTLY.** Leaves are 30 mm and the band is 12–14 px tall in the game, but metallic is 0.6 and the recess is too light (p5 82, concept 38).
5. **Marble: STILL PRESENT.**
   - Neck luminance p5/p95 is 130/159 (concept 115/188).
   - The foot is hue 41° and L\* 64 (concept 32° and 77).
   - The veins are fixed.
6. **Valley ends: PARTLY.** The dip is gone, but the valley slope halves at 0.245 m and the zebra shows closed eyes at 0.245–0.265 m.
7. **Foot corner: PARTLY.** 22 mm too wide per side (was 27).
8. **Lobes, cabochon and shoulder join:** still fine.

- **Neck rings: FIXED** (at most 13.6° per ring).
- **Lip: PARTLY.** It is rolled, but in 6 segments that each turn 32–44°.

## Gates

- **Contract: PASS.**
  - Intact: 9,112 of 9,800 tris, closed, 0 self-intersections.
  - Shards: 16, with 15,406 of 16,000 tris, 0 loose pieces, volume 99.99%.
- **Khronos: PASS**, 0 errors.
- **Silhouette: forms_pass**, IoU 0.9886. The worst band (+0.0287) is the cup: +8 mm per side at 0.18 m and −8 mm at 0.21 m.

## Problems, worst first

1. **Glass body (entry shot).** I patched the materials in a probe and ran it in the game:
   - roughness 0.4;
   - clearcoat 1.0 at coat roughness 0.03;
   - thickness and attenuation distance both 0.08.

   The band and the lines disappear, and a* is 22 (concept 21). It is still too red: hue 23° against 30°, and b* 30 against 45. Fix: raise the green in the attenuation colour.

2. **Lobes read as soft bumps at 128 px.** The creases are only 14–19 mm deep at 0.22–0.24 m. Fix: keep them at least 35 mm deep all the way down to the cup.
3. **Both gold bands are dull.** Fix:
   - leaves metallic 1.0, roughness 0.25;
   - recess no lighter than (35,25,15);
   - shoulder fillets 6 mm proud (now 3–4 mm).
4. **Foot, neck and lower band dropped from 32 to 28 segments.** Their outlines look polygonal in the three-quarter view. Fix: 40 segments (about +1,100 tris). Pay for them with the 688 spare tris and about 300 hidden glass tris below 0.20 m.
5. **Cup rim.** Fix: sink it 2 mm into the glass at the scallop peaks, and round it.
6. **Marble.** Fix: move the texture base from (220,177,121) to (236,222,200).

## Runtime against the shipped file

- **Candidate:** a truer outline (the shipped file fails the silhouette gate at IoU 0.93).
- **Shipped:** clean, bold lobes.

The candidate is not better yet.

## Could not judge

- How the glass renders on a phone GPU.
- The shards in flight.
- Only the entry shot frames the urn.

Evidence: runtime-entry-compare.jpg, glass-probes.jpg (left the build; middle and right the critic's probes a and b), lower-compare.jpg, concept-cusps.jpg.
