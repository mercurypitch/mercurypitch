# Opaline Echo Amphora, round 6

**Verdict: ONE MORE PASS.** Gates pass and round 5's colour faults are fixed. Two cheap fixes block it:

- a UV fault seams and swirls the jade foot and twists the rim's hammering into rope;
- the tail crease remains.

## Round 5 items

1. Grey wave band: **FIXED.** Saturation 0.18-0.19, body 0.15-0.19 (r5 0.10-0.11).
2. Pale foot: **FIXED.** L 45-47 (concept 48), hue 126-131 (137). Chroma is 28 against 20, slightly hot.
3. Cool body: **FIXED.** b\* +1.8 to +3.0 (concept +0.7), cyan-blue 10% (5%; r5 28-37%).
4. Matte glass: **STILL PRESENT.** Clearcoat added, but L std is still 2.9-3.3 (concept 6.7).
5. Close range:
   - Rope: **STILL PRESENT** (problem 1).
   - Sleeves: **FIXED**, 16 sides.
   - Tail crease: **STILL PRESENT**, 34.6-39.6 degrees at z 0.632-0.648.
   - Neck needles: **FIXED**.
   - Handle arc: **FIXED**.
6. Shard slivers: **PARTLY**, 269 under 2 degrees (was 468).

## Gates

- **Contract: PASS.** Intact 7,764/8,000, closed, 0 self-intersections, 0.9188 m. 18 shards, 11,698/12,800, volume 0.9999, 0 loose.
- **Khronos: PASS.** 0 errors, 0 warnings.
- **Silhouette: forms_pass**, IoU 0.976. Worst band 1 (+0.0088): the foot top is 7-11 mm per side too full at z 0.105-0.115.
- **Runtime proof:** served this file (sha256 d8bbf997).

## Problems

1. **u = 16.7 x r x azimuth, per vertex.**
   - Where the radius changes along the profile, u spirals and snaps back at +X.
   - On the foot, shear goes from 96 to 162 degrees around the vessel.
   - From the gameplay camera's 35 degrees, the foot reads as twisted candy with a hard seam under the +X handle (in r5 too).
   - The rim and collar get a herringbone rope; the lower-body crackle gets a seam.
   - Fix: per part, u = azimuth/360 x round(16.7 x 2pi x r_max).
2. **Tail crease:** a pinched line in clay. Fix: fillet the last three jade rings into the tail, at most 12 degrees per ring.
3. **Flat opal, short on lavender** (12-18% of chromatic pixels; concept 22%). Fix: widen COLOR_0 lightness by about 8 L\*, turn a tenth of the mint patches lavender, and target L std of 5.
4. **Jade up close:** cloud blotches read as camouflage; the concept has fine veins. Fix: thin veins at 4x the frequency.
5. **Waves up close** read as a Vitruvian scroll, not breaking crests with thick teal bodies; at game size they match. Fix: repaint waves_color and waves_normal so the teal fills down to the lower band.

## Not judged

- The break in motion (exploded render: clean walls, no confetti).
- Sides and back in game: the walk shots miss it, and "View artwork" covers a handle.
- Phone GPUs.

Evidence in this folder: critic-sheet.jpg, foot-and-rim-35deg.jpg (the foot swirl and the rope rim
from the gameplay camera's 35 degrees, candidate and shipped file), tail-crease.jpg, entry-pair.jpg
(the concept at game size, the candidate and the shipped file in the game), silhouette-overlay.jpg.
