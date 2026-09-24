# V9 dome tint mask audit

Date: 2026-09-23

Scope: read-only diagnosis of the rejected `444c` browser kit. No tint, mesh, export, or runtime asset was changed.

## Finding

The broad ivory lower dome and speckled colour are caused primarily by the rejected texture mask. The accepted temple mesh already assigns the broad affected panels to the dome partition. Its hard `gold` boolean classifies low-chroma warm ivory as protected gold, so most of those texels receive zero tint.

The geometry split can leave a thin ring at the `Y = 1.65 m` boundary. It cannot explain the broad ivory panels:

- The source has 89,166 triangles: 24,985 dome and 64,181 structure, using triangle-centroid glTF `Y >= 1.65 m`.
- The dome covers `6.819595 m²`. Only 229 threshold-crossing faces are assigned to structure, covering `0.232713 m²`, or 3.4124% of dome area.
- The lower dome band (`1.65 <= centroid Y < 1.85 m`) contains 9,797 dome faces over `3.198942 m²`. Area weighting shows 70.5001% hits the hard `gold` boolean and 77.5390% receives a zero mask.
- Across the full dome, area weighting shows 72.7527% hits `gold` and 80.4976% receives a zero mask.
- The full dome UV footprint covers 388,388 provider-atlas pixels under Pillow's polygon rule. Median chroma is 0.164706, the 75th percentile is 0.200000, and the 90th percentile is 0.423529. The hard rule classifies 73.3800% as `gold` and gives 81.7201% a zero mask.

The lower-dome chroma distribution is mostly the warm neutral population that should receive tint: 84.0406% of its area is below chroma 0.28, while 59.5717% of its area is both warm-low-chroma and classified as `gold`. Hard hue tests therefore create the visible salt-and-pepper boundaries inside otherwise continuous panels.

## Recommended texture-only correction

Use a continuous neutral mask:

```text
neutralWeight = 1 - smoothstep(0.24, 0.42, chroma)
```

Give chroma through 0.24 full tint weight, then fade continuously to zero by 0.42. Remove the absolute bright gate and hard `gold`/`emerald` exclusions, and preserve source luminance in the target-colour shading step. This interval includes the warm-neutral dome panels and protects the saturated accent tail.

Keep the `Y = 1.65 m` split for the next texture-only candidate. Inspect the thin spring-ring edge separately. This colour repair should leave geometry, UVs, normals, and tangents unchanged. Recheck the final 2K WebP because lossy encoding can amplify hard mask edges, although it does not account for the broad untinted area.

## Method and limits

The sampler decodes the accepted GLB `POSITION`, `TEXCOORD_0`, and index accessors. It reproduces the packer's triangle-centroid partition, samples one provider-atlas texel at each face UV centroid, and weights each result by that face's 3D area. This reduces triangle-density bias but does not integrate colour across each UV face.

A second measurement rasterizes the union of all 24,985 dome UV triangles into the 2048 x 2048 provider atlas and counts each covered pixel once. It measures atlas coverage rather than browser screen visibility or minification. Polygon edge inclusion is rasterizer-dependent; a separate edge convention covered 389,038 pixels instead of 388,388 and produced the same material quantiles (median 0.1647, 75th percentile 0.20, 90th percentile about 0.4235).

The partition measurement rules out the Y split as the cause of the broad panels. It does not assert that the boundary is semantically perfect at every crossing face.

## Locked inputs

| Input                           | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Accepted temple candidate GLB   | `b31cdf876f601b510ee8910a144ec9258b592d355f088b0097e5a04fd5770360` |
| Provider base-colour atlas      | `34162564fdc4d6f6b6b9c2a756f7e916a01c763eda2813afd377af11593ab736` |
| Rejected combined kit           | `444c0669ebc8760e25cc70c5a25541203fa18b156ff3d2ab581ae03b4b1b3793` |
| Rejected browser screenshot     | `1c6a8f72817bd7b092b1b106a4a93f4a694c7150dd7945fcc1b6a0cd1f19b31d` |
| Rejected browser review         | `32c10b27c0166be27db937a1ecf05aef83e179a6187cd527cdfa1f8492db6f00` |
| Observed rejected finish script | `fed2242b63e67047fb98fb2fe15533a4e01adb2cee9001b80e062dd2cdcab98f` |
| Rejected amber base atlas       | `fd59af03cc38336446f23d84ee6351d1c02aeef59da538ebccb019a52af241a4` |
| Rejected teal base atlas        | `0e0e99ede27fbebfa089581763cd6c331f7c37e5ece8bbdb1f0f420840eae531` |

The complete machine-readable results and reproduction details are in [`dome-tint-mask-audit-v9.json`](./dome-tint-mask-audit-v9.json). Reproduce them with:

```bash
rtk python3 art/glass-adventure/journey-map/v9/proofs/audit_dome_tint_mask_v9.py
```
