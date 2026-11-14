# Critic report: Opaline Echo Amphora, round 1 (forms and materials)

**Verdict: ONE MORE PASS.** The gates pass and the measured profile is right. The two materials that make up most of the vessel are wrong, though, and the handle tops, cuffs and wave line fall short of the concept.

## Gates

- **Contract (`validate_asset.py`): PASS**, 0 problems.
  - Intact: 7,956 / 8,000 triangles, closed, 0 non-manifold edges, 0 self-intersections, UVs present, height 0.9188 m.
  - Shards: 18, 12,060 / 12,800 triangles, volume ratio 0.9999.
- **Khronos validator: PASS**, 0 errors, 0 warnings.
- **Silhouette at 8 degrees: `forms_pass`.**
  - IoU 0.965.
  - Worst band is 8 at +0.0175, about +17 mm across the handle tops at z 0.80. Every other band is within 0.012.
  - The holes-aware IoU of 0.739 comes mostly from the reference mask losing pale glass at z 0.42-0.62, not from the model.
- **Brief dimensions:** the base ring, foot, stem ring, bands, collar, neck (r 0.1155 at z 0.776), belly (r 0.2827), rim and curl heights are all within 2 mm. The one exception is the body root at z 0.175, which is 5 mm narrow.

## Problems, by cost at gameplay distance

1. **The opal reads as white porcelain and grey glass** (material and game panels, body z 0.16-0.92).
   - Transmission 0.82 at roughness 0.08 makes the body take its colour from whatever is behind it.
   - The upper body clips to white (75th percentile #FFFFFF). The lower body at z 0.17-0.42 goes see-through grey (#7E8F87; the concept is #A5B2A3).
   - The interior and back wall refract through as streaks under the centre curl (z 0.30-0.36) and in the lower bowl.
   - The uniform thin film (imported as 400 nm) shows no colour play. In the same Cycles panel, the shipped Meshy file reads more like opal.
   - **Fix:** set transmission to 0.35 or less and roughness to about 0.2. My Cycles test with those values removed the grey bowl and the streaks, but on its own it gives flat white. Put the concept's lavender, mint and peach patches into a COLOR_0 vertex colour on the shell (no texture needed), and keep the thin film for the edge glint.

2. **The jade reads as mint plastic** (handles, foot).
   - It renders #64EBA8 (hue 150, saturation 0.57). The concept's lit midtone is #5C7E61 (hue 129, saturation 0.27).
   - **Fix:** change baseColor from linear (0.028, 0.205, 0.095) to (0.05, 0.11, 0.06), and clearcoat from 0.6 to 0.3. Tested: it renders #81B68C (hue 132, saturation 0.29).

3. **The handle tops are square and too high** (front view and overlay, z 0.77-0.885).
   - The apex is at z 0.8846; the brief says 0.876.
   - The outer edge stands proud of the concept by 5 mm at z 0.77, 10 mm at 0.81, 16 mm at 0.85 and 20 mm at 0.865:

     | z (m)     | 0.807 | 0.827 | 0.846 | 0.865 |
     | --------- | ----- | ----- | ----- | ----- |
     | Concept r | 0.294 | 0.281 | 0.264 | 0.238 |
     | Model r   | 0.304 | 0.294 | 0.280 | 0.258 |

   - The strap is 66-71 mm across; the concept's is 74-84 mm, swelling to about 87 mm at z 0.65.
   - The loop closes at z 0.647; the concept's closes at about 0.62.
   - **Fix:** lower the apex to 0.876 and move the upper-arc control points to the concept radii above. Widen the strap inward by 8 mm at z 0.70-0.80, with the swell meeting the shoulder at z 0.62.

4. **The cuffs are lumps and the neck straps are missing** (clay and zebra crops, z 0.80-0.89).
   - Each gold root is a swollen knob, flush with the jade, and the zebra stripes on it wobble.
   - In the concept the cuff is a sleeve standing proud with a crisp edge. It continues as a gold strap about 15 mm wide down the neck to the collar (z 0.86 to 0.726). That strap is visible even at 128 px.
   - **Fix:** sweep the cuff as a sleeve 3-4 mm proud of the strap with rolled edges. Add a D-section strap seated on the neck from the cuff to the collar.

5. **The wave line is too fine and faceted** (front crops, z 0.31-0.40).
   - Each stroke is a triangular prism at most 5.9 mm wide, tapering to 1.8 mm, with 24 spans whose chords run 11-48 mm.
   - The curls show as visible polylines with sharp ridges.
   - At 128 px the line is under 1 px wide and reads only as glints.
   - **Fix:** use a rounded ribbon 7-8 mm wide, and move spans from the straight runs to the curls so their chords are 5 mm or less.

6. **The wall is not the brief's even 10 mm** (axial sections).
   - The inner wall's chords are up to 17 cm long.
   - The wall is 6-9 mm thick in the neck (z 0.75-0.88) and about 18 mm in the belly and shoulder.
   - It refracts into view (see item 1) and will show in the shard cut faces.
   - The handle root keeps only 2.8 mm to the neck's inner wall.
   - **Fix:** offset the inner wall 10 mm along the normal, with rings at the outer wall's heights.

The intact triangle budget is 99.5% used (7,956 of 8,000), so every fix needs triangles freed elsewhere. For example, dropping to 48 segments on the base ring, foot and stem ring frees 416.

Against the shipped file, this is already better in form: clean zebra stripes, true symmetry and a measured outline. It is not yet the concept.

## Not judged

- **three.js:** how the transmission and iridescence look against the court background and on phone GPUs, and whether the game uses COLOR_0. That is for the runtime round.
- **Shards:** left for the fracture round. Several shards are made of 2-6 separate mesh pieces.
- **Overlay bottom crescents (z below 0.015):** probably the concept's perspective, not the geometry.

Everything is in `/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/amph/rounds/r1/`:

- `sheet.png`: the full render sheet
- `silhouette/overlay.png`: the silhouette comparison
- `crops/`: sections, close-ups and material tests
