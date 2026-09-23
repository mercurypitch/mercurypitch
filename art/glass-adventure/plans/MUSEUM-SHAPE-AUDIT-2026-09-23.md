# Museum shape and normals audit — 2026-09-23

## Finding

The temple, statue, cypress, and cliff look low-poly because their geometry was
aggressively reduced before the V4 kit was assembled. A recent runtime normals
pass did not replace or simplify those meshes. The current V4 runtime file is
byte-identical to its art export (`sha256 3c356e39746551ea1afb5d5cdecca784eb9e520acafafe81b31a6aedccad7991`),
has no working-tree diff, and has not changed since commit `cefaa3db` on
2026-09-21.

There is one narrower shading issue: splitting the V3 temple into V4 structure
and dome meshes preserved every triangle position exactly but recomputed some
normals along the new cut. That can add a shading seam near the 1.65 m
partition. It cannot explain the coarse dome outline, statue anatomy, cypress
silhouette, or cliff profile.

## Geometry evidence

Counts below are read from the delivered GLB accessors. `Index / 3` is the
actual stored triangle count after export, which is slightly below the Blender
modifier targets because the exporter removes a few degenerate triangles.

| Asset / stage                | File                                                             | POSITION | NORMAL |     Index | Triangles |
| ---------------------------- | ---------------------------------------------------------------- | -------: | -----: | --------: | --------: |
| Temple dense archive         | `journey-map/v3/meshy/floating-museum-temple-v3-pre-remesh.glb`  |  894,355 | absent | 5,368,050 | 1,789,350 |
| Temple Meshy textured donor  | `journey-map/v3/meshy/floating-museum-temple-v3.glb`             |   36,057 | 36,057 |    65,517 |    21,839 |
| Temple V3 runtime            | `journey-map/v3/exports/floating-museum-sculpture-kit-v3.glb`    |   19,495 | 19,495 |    29,979 |     9,993 |
| Temple V4 structure          | `journey-map/v4/exports/floating-museum-twin-finish-kit-v4.glb`  |   14,118 | 14,118 |    21,708 |     7,236 |
| Temple V4 dome, each colour  | same V4 GLB                                                      |    5,419 |  5,419 |     8,271 |     2,757 |
| Cypress dense archive        | `journey-map/v3/meshy/floating-museum-cypress-v3-pre-remesh.glb` |  331,413 | absent | 1,991,190 |   663,730 |
| Cypress Meshy textured donor | `journey-map/v3/meshy/floating-museum-cypress-v3.glb`            |   12,276 | 12,276 |    21,408 |     7,136 |
| Cypress V3/V4 runtime        | V3/V4 exports above                                              |    3,079 |  3,079 |     3,576 |     1,192 |
| Cliff dense archive          | `journey-map/v3/meshy/floating-museum-cliff-v3-pre-remesh.glb`   |  529,688 | absent | 3,183,828 | 1,061,276 |
| Cliff Meshy textured donor   | `journey-map/v3/meshy/floating-museum-cliff-v3.glb`              |   29,039 | 29,039 |    47,241 |    15,747 |
| Cliff V3/V4 runtime          | V3/V4 exports above                                              |   16,462 | 16,462 |    23,925 |     7,975 |

The first reduction is already severe: the textured Meshy outputs retain only
1.22% of the dense temple triangles, 1.08% of the dense cypress triangles, and
1.48% of the dense cliff triangles. `build_sculpture_kit.py` then reduces the
textured donors again to targets of 10,000, 1,200, and 8,000 triangles. It also
marks every resulting polygon smooth; this was not an accidental flat-shading
export.

The V4 build opens the accepted packed V3 `.blend`, copies the cliff and cypress
meshes, and partitions the already-reduced 10k temple at face-centre Z >= 1.65 m.
An indexed-triangle comparison gives exact V3-to-V4 position parity. Cliff and
cypress also have exact position-plus-normal triangle parity between V3 and V4.

All V4 normal vectors are finite, non-zero, and unit length within floating
point tolerance. The temple partition changes more than one degree at 702 of
29,979 indexed corners (2.34%, maximum 123.72 degrees); the other 29,277 corners
are unchanged beyond 0.01 degrees. A future temple build should preserve the
source split normals through the material partition, or keep one mesh with two
material groups, to remove this secondary seam without smoothing architectural
edges indiscriminately.

## Runtime boundary

`packages/glass-game/src/journey/resources.ts` fetches the GLB and calls
`GLTFLoader.parseAsync` directly. It does not invoke
`packages/glass-game/src/render/asset-geometry.ts`. The latter computes vertex
normals only when a geometry has no `normal` attribute; every V4 primitive has
one. Changing that helper therefore cannot repair these journey sculptures.

The archived V3 and V4 review renders already show the same coarse silhouette:

- `journey-map/v3/proofs/floating-museum-sculpture-kit-front-v3.png`
- `journey-map/v4/proofs/floating-museum-twin-temples-front-v4.png`
- `journey-map/v4/proofs/floating-museum-twin-temples-angle-v4.png`

Those proofs predate the current screenshot and show the faceting before any
recent investigation of normals.

## Repair recommendation

Use the archived dense pre-remesh temple and cypress as the shape authority.
They are useful enough to avoid a new image-to-3D generation, but cannot be
installed directly: each contains positions and indices only, with no normals,
UVs, or material. First render them as smooth clay from the same camera as the
textured donor and current V4 asset. If the dense shapes restore the dome,
statue, and foliage silhouettes, remesh from those exact archives and retexture
the remesh with the accepted guides/material direction.

Suggested first candidates are 80–100k triangles for the temple and 15–25k for
the cypress. Keep amber and teal as shared temple geometry with separate dome
materials/instances. Validate close-camera silhouette, normals, UV/PBR channels,
and browser raster before runtime integration. Keep the cliff as a follow-up
unless the focal temple and cypress repair leaves it visibly dominant.

Do not subdivide the current low-poly meshes or merely recompute their normals.
Both can soften lighting, but neither can recreate the missing outline, statue
features, foliage volume, or rock profile.
