# Museum v2 PBR sources

Retrieved and verified on 2026-09-15. The machine-readable source of truth is
`manifest.json`; each provider asset directory also has a self-contained manifest.
All texture channels are unmodified provider files. No AI image was converted into
a normal, roughness, or metalness map.

| Project role / GLB slot                | Provider asset                                                         | Starting tile size | Provenance                                            |
| -------------------------------------- | ---------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `warm-carrara` / `museum_ivory`        | [ambientCG Marble004](https://ambientcg.com/view?id=Marble004)         | 1.2 m              | Project scale; warm ivory with faint gray/beige veins |
| `verde-marble` / `museum_petrol`       | [ambientCG Marble009](https://ambientcg.com/view?id=Marble009)         | 1.2 m              | Project scale; dark green / teal marble               |
| `cream-limestone` / `museum_limestone` | [ambientCG Travertine001](https://ambientcg.com/view?id=Travertine001) | ~1.2 m             | Provider publishes this approximate physical size     |
| `brushed-brass` / `museum_brass`       | [ambientCG Metal034](https://ambientcg.com/view?id=Metal034)           | 0.25 m             | Project scale; source is smooth satin gold            |

The four materials are provider-authored procedural PBR. They are not photographic
stone or brass scans. Carrara, verde Alpi, and brushed brass describe project roles,
not verified geological or manufacturing provenance. In particular, Metal034 does
not supply a strong directional brushing pattern. Marble004 replaces Marble012
after comparing the actual gameplay capture with the approved museum concept:
its broad ivory areas and restrained veins fit the floor more closely. Marble012
remains in the source archive as a retired reference and has no active runtime
binding. The material names do not claim a photographic or geological origin.

The single lighting environment is [Umhlanga Sunrise by Greg Zaal, Poly Haven](https://polyhaven.com/a/umhlanga_sunrise):
a photographic coastal HDRI with warm light near the horizon and cool open sky.
The provider reports 23 EV dynamic range and 5400 K white balance. Align its sun
direction with the authored key in the real scene; no rotation is asserted here.

## Files and sampling

- `*/1K-PNG/` contains original provider 1024-square runtime-quality channels.
- `*/2K-JPG/` contains original provider 2048-square source masters for Marble009,
  Travertine001, Metal034, and retired Marble012. These are provider JPEG variants,
  not conversions performed by this task. Marble004 currently has only the original
  1K PNG channels; the old Marble012 masters do not represent this replacement.
- Original ZIP archives retain the full provider packages, including unused DX
  normals, displacement, authoring files, and travertine AO. Only selected channels
  are extracted. The ZIP archives and 2K maps stay outside the public bundle.
- `_previews/` contains material preview renders for reference only. They contain
  rendered lighting and must never be used as base-color maps.
- `umhlanga_sunrise/` contains the original 1K and 2K HDR files. Only the 1K
  1024-by-512 version is copied to the runtime as `golden-coast.hdr`.

Runtime base path: `apps/beside-cue/public/games/adventure-v2/`.
The `textures/` directory has `{role}-{basecolor,normal,roughness}.png`, plus
`brushed-brass-metalness.png`. Their asset IDs are their filenames without `.png`.
The environment is `environment/golden-coast.hdr`, with asset ID
`museum-environment-v2`. `textures/CC0-SOURCES.json` carries public provenance.

Use sRGB for base color and no color-space transform for data maps. All normals
are the supplied OpenGL `NormalGL` maps. Grayscale roughness maps work in Three's
green channel; the grayscale metalness map works in blue. The gold metalness map
is uniformly 255: use scalar `metalness = 1` and skip that texture allocation.

The current v2 GLB agreement is **one UV unit per world metre**. Repeat is therefore
`1 / 1.2` for these stones and `4` for the gold. Use the same repeat on all channels.
For textures applied to GLTF geometry use `flipY = false`, repeat wrapping, and an
initial anisotropy of 4. These settings are a renderer integration contract; this
sourcing task did not modify renderer code. Start with restrained normal strength
and review highlights in the scene, especially on polished marble and small gold
trim. Never multiply the data-map values by sRGB color correction. Marble004
roughness already averages approximately 0.114: audition a material multiplier
of 0.8–1.0 before lowering it. The old 0.34 multiplier would reduce that average
to about 0.039, creating a much more mirror-like surface than the provider map.

Share one external map set between kit pieces and vessels instead of embedding
duplicate textures in every GLB. Generate PMREM once and share it. If the source
HDR is not used as the visible background, dispose it after PMREM generation.

## Verification and budget

The 9 source ZIPs pass CRC checks. All 29 selected source maps, including the
retired Marble012 set, decode at the promised dimensions. The active runtime
contains 13 material maps, including the optional constant metalness image. Runtime files are byte-for-byte copies of their provider archive
entries; SHA-256 hashes and archive URLs are recorded in the manifests. Both HDR
headers have the expected 2:1 dimensions. Actual base colors and provider previews
were visually inspected. No runtime scene or device performance claim follows
from these file checks.

Total downloaded binary payload: **122,155,858 bytes**, including preview files,
a 512-byte download probe, and the external Marble004 JPG inspection archive.
This remains below the original 150,000,000-byte task cap. The replacement
candidate batch used **20,395,497 bytes** of its 30,000,000-byte allowance. Runtime
images and HDR total **21,387,409 bytes**, excluding the small provenance JSON.
The selected PNG channels were copied directly; no recompression was performed.

Twelve 1024-square RGBA8 maps with mipmaps are approximately **64 MiB decoded**
when each is shared once. Loading the unnecessary constant metalness texture adds
about 5.33 MiB. HDR/PMREM, Merc, other vessel textures, render targets, driver costs,
and duplicate texture objects are additional. The proposed 80 MiB mobile and
192 MiB desktop texture budgets remain device-verification gates. File compression
does not lower decoded GPU memory. No 2K maps are copied into the public runtime.

## License

All selected assets are **CC0-1.0**. The providers explicitly allow commercial use
and redistribution of the raw asset files; attribution is optional. Provenance is
retained regardless.

- [ambientCG asset and preview license](https://docs.ambientcg.com/license/)
- [Poly Haven asset license](https://polyhaven.com/license)
- [Canonical CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

This license statement covers the downloaded assets. It does not claim that other
provider website copy, logos, or unrelated site material are CC0.
