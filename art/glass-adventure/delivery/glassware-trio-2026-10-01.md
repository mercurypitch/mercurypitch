# Three notes in glass — production receipt

The first small glassware batch contains Sunlit Diadem (G01), Tidal Wave Carafe
(G14), and Aurora Lotus Bowl (G22). Each has its own closed fracture assembly,
glass and gold materials, collision-backed plinth, independent singing target,
and saved completion. The development route is `?layout=glassware-trio`.

## Shape and export

Meshy 7.1 received matte structure references. The dense originals remain in the
owner's creative archive. Blender derivatives preserve the cup cavities, closed
bases, handle opening, and eight lotus lobes. G22's first donor was rejected
because its floor and foot did not match the reference. A corrected reference
produced the accepted second donor. Four generation jobs cost 100 credits.

| Asset                 | Intact triangles | Closed fracture pieces | Runtime bytes | Maximum measured shape deviation            |
| --------------------- | ---------------: | ---------------------: | ------------: | ------------------------------------------- |
| G01 Sunlit Diadem     |          125,000 |                     33 |     4,725,956 | 0.584 mm isolated ornament; 0.136 mm at p99 |
| G14 Tidal Wave Carafe |           93,332 |                     21 |     3,245,184 | 0.178 mm dense-to-body derivative           |
| G22 Aurora Lotus Bowl |          226,756 |                     20 |     7,522,444 | 0.199 mm                                    |

Deviation measurements use the 0.45 m source height. They are production
measurements against the accepted donor, not a claim that generated geometry
exactly matches a reference illustration. Runtime heights are 0.84, 0.80 and
0.48 m respectively. Imported glass thickness and attenuation scale once with
the asset; gold stays opaque. Geometry is shared immutably while each exhibit
owns its materials, charge state and fracture presentation.

The runtime manifest contains exact byte counts, SHA-256 hashes, provider job
IDs and source dimensions:
`apps/beside-cue/public/games/glassware-trio-v1/manifest.json`.
Meshopt compression preserves the reviewed decoded geometry without
quantization, vertex reordering or further simplification.

## Verification

- Fresh GLTFLoader import checks named roots, shard counts, finite geometry,
  assembled bounds, exact materials and independent lifecycle ownership.
- The real movement and pitch core walks to every plinth, breaks only the
  selected exhibit, gates the exit and restores saved progress.
- Three 390 px touch browser tests use PCM microphone input, reject silence,
  complete each exhibit independently, release capture and reload the save.
- Fixed 1280 x 800 and 390 x 844 actual-render captures cover intact, challenge,
  charge and release. These use AMD OpenGL through ANGLE, separate from the
  input tests. The first visual pass exposed neighboring exhibits in the
  cinematic lens; the terrace now spaces its exhibits 6.5 m apart.

The glass remains physically transmissive. Its color depends on the room and
reflection environment; the bright terrace is a review setting, not an exact
match for a studio reference. Owner device performance and final art preference
remain separate acceptance checks.

## Native delivery

The native build excludes two retired bundles that Vite previously copied from
public despite having no current runtime references:

- `games/cloudway-v3/cloudway-platform-kit-v3.glb`
- `games/journey-map-v3/floating-museum-sculpture-kit-v3.glb`

Their source files remain available for historical reviews. The declared asset
inventory and 50 hydrated GLB/glTF files contain no dependency on these bundles.
Tests verify actual Vite output excludes them while preserving the sources and
current replacement assets.

Replacing the reviewed entries in an existing release APK and adding this trio
produces an **unsigned analysis archive of 350,415,622 bytes**. It retains
6,100,218 bytes below the existing 340 MiB cap. No cap was raised. The 1,151
untouched entries retain their CRC, size and compression metadata; all added
payloads match their reviewed files. CI must still measure the newly built
native artifact: this analysis is not a signed release build.

## Preserved masters

Packed Blender projects, dense donors, references, exact export recipes,
geometry and compression proofs, material auditions and actual-runtime images
are retained under:

```text
<creative-archive>/glass-adventure/glassware-audition-v1/shape-comparison-v2/final/{G01,G14,G22}
<creative-archive>/glass-adventure/glassware-audition-v1/shape-comparison-v2/final/runtime-proof
<creative-archive>/glass-adventure/glassware-audition-v1/shape-comparison-v2/final/runtime-proof-spaced
```

The reusable browser and APK proof scripts are in the owner's dotfiles
`personal/besidecue/glass-adventure/production` directory. Public runtime files
contain no API keys, signed provider URLs or private filesystem paths.
