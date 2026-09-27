# Pearl ribbon lantern optional exhibit v1

This package finishes the reviewed dense Meshy donor as a static gallery prop.
The immutable dense donor and review master remain in the Cloudway Laboratory v1
source archive. A separate packed authoring master, two bounded runtime LODs,
matched Blender proofs, fresh-import checks, and WebGL proof live under the
ignored `source-assets` mount in Proton Drive. Only LOD1 ships with the game;
the comparison-only LOD0 remains in the creative archive and is exposed solely
by the dedicated local proof server.

Runtime coordinates are metres with +Y up. The root node is
`Cloudway_PearlRibbonLantern_OptionalExhibitV1`; its child render node is
`PearlRibbonLanternGeometry`, and `PearlRibbonLanternLightAnchor` marks the
centre of the pearl chamber. The asset is decorative and has no walkable
surface. Root extras carry the measured resting-base support and conservative
cylindrical obstacle proxy. Its `centreXZ` is expressed in declared glTF
coordinates and is validated against the decoded support-anchor translation.

The gallery selects LOD1: 36,000 triangles, one opaque PBR primitive, one
material, and 1024-pixel WebP textures. Its measured base is 0.513 by 0.513
metres. The collision proxy is a non-walkable cylinder with 0.351-metre radius
and 1.400-metre height. The archived LOD0 preserves a 120,000-triangle,
2048-pixel comparison source without adding its 2.7 MB to app builds.

The actual creator-gallery capture installs the root at `[3.51, 0, 9.55]` on
`thaw-alcove-beacon-rest`. The support anchor resolves to platform height,
all 35,253 runtime normals are valid, and the one primitive adds three native
high-quality frame draws (108,000 submitted triangles) across the live colour
and shadow passes. See `proof-manifest.json` for portable hashes and the
ignored creative-archive proof paths.

Rebuild in an isolated headless Blender process:

```sh
rtk proxy timeout 7200 flock -w 7200 /tmp/glass-pearl-ribbon-lantern.lock env ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 --python art/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern/produce_pearl_ribbon_lantern.py
```
