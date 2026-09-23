# Meshy 7.1 and Ultra 4K — capability check and platform audition

Checked 23 September 2026. Museum runtime repair remains the delivery priority;
the independent source audition ran while final museum assembly was underway.
The owner requested a higher-detail platform experiment; no new level is needed.

## Verified API support

Meshy's 18 September changelog added `meshy-7.1` for image, multi-image and text
generation. `latest` now resolves to 7.1 for those generation endpoints. Ultra
`geometry_resolution: "4k"` is available for image/text generation, costs five
extra credits, and is not available for multi-image generation.
[Official changelog](https://docs.meshy.ai/en/api/changelog).

Ultra 4K describes the **geometry generation pass**, not a 4,000-polygon model or
only a texture size. The API separately offers `texture_resolution` of 2K, 4K and
8K. Use an explicit `ai_model: "meshy-7.1"` and `geometry_resolution: "4k"` for
a reproducible new single-image trial. Preserve the dense output before choosing
a runtime triangle budget. [Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d).

Retexture has a separate model contract: its current documentation still lists
Meshy 6, Meshy 7 and `latest` (7), rather than an explicit 7.1. It supports 4K/8K
base color. Do not assume geometry-generation model names apply to retexturing.
[Retexture API](https://docs.meshy.ai/en/api/retexture).

## Installed MCP support

The authenticated local launcher pins `@meshy-ai/meshy-mcp-server@0.4.0`.
Inspection of its actual installed `dist/constants.js` and
`dist/schemas/generation.js` found:

- Its model enum contains only `meshy-5`, `meshy-6`, and `latest`.
- Its description saying `latest` means Meshy 6 is stale relative to the API.
- It exposes `hd_texture`, which the API still honors as 4K base color.
- It does not expose `geometry_resolution`, `texture_resolution`, or an explicit
  `meshy-7.1` value. Passing those unsupported fields through this schema is not
  a valid way to select Ultra 4K.

Therefore the API supports 7.1/Ultra 4K, but this installed MCP cannot explicitly
request the full new combination. `latest` should resolve to 7.1 for generation
according to the current API docs; that is not evidence that any archived donor
was generated with 7.1. Current repairs remesh preserved donors and use explicit
Meshy 6 retexturing, whose lighting-removal control is useful for runtime art.

The current published official MCP package, **0.5.2**, was also inspected directly
from the npm registry without installing it. It adds `meshy-7` and explicit
`texture_resolution`, but its model enum still lacks `meshy-7.1`, and its
generation schema still lacks `geometry_resolution`. Updating to that version
alone therefore does not expose the new Ultra 4K geometry control. Its endpoint
descriptions date from 11 August and should not override the newer API contract.
Package tarball SHA-256:
`4a6762c8670b4ddcc6a688f1c17c7d322b182db39a09dbe889687f8035bd881f`.
[Official MCP source](https://github.com/meshy-dev/meshy-mcp-server),
[published package](https://www.npmjs.com/package/@meshy-ai/meshy-mcp-server).

The September 21 platform receipts already request `latest` and `hd_texture:
true`; the marble archive contains a real 4096 x 4096 base-color map. Their
`resolvedSchemaAtSubmission: "Meshy 6"` records the old MCP description, not a
server-confirmed resolved model. Keep those historical receipts unchanged and
do not treat that field as proof of the actual backend model. None records an
Ultra 4K geometry request. Future receipts must distinguish requested model,
documented alias behavior, and a provider-confirmed resolved model if returned.

Use a small direct-API producer with the existing
Proton-injected credential for the trial. Never log credentials, inline image
payloads, or signed output URLs; persist task ID before subsequent calls and
resume an existing task instead of resubmitting it.

## One-platform audition

1. Reuse the accepted marble/greenery platform guide and collider dimensions.
2. Generate one explicit 7.1 Ultra 4K donor. Save the reference hash, exact
   request, task ID, charged credits and original model separately.
3. Compare its silhouette, cutouts, moldings, leaves and underside with the
   current source before texturing. Reject new intersections or fused shapes.
4. Choose runtime topology from actual projected detail; bake normal/AO from
   the donor where registration permits. Keep full-resolution source textures.
5. Audition 2K and 4K runtime texture derivatives with identical camera, lighting,
   geometry and phone/tablet-sized views. Higher input resolution alone is not
   proof of better in-game appearance.
6. Measure download bytes, texture memory, draw calls and triangles. A 4K map
   has four times the texels of a 2K map; use measured benefit to select the
   shipping derivative. Preserve existing platform simulation and saves.

- [x] Verify official API and installed MCP capabilities.
- [ ] Finish current museum asset repair and browser review.
- [x] Generate and archive the single-platform 7.1 Ultra 4K audition.
- [x] Review equal-scale source clay and PBR comparisons against current V3.
- [ ] Prepare a fitted runtime mesh, Blender bake and actual game comparisons before replacement.

## Actual API trial — 23 September

The explicit request succeeded as task `01a0cef2-fffb-726e-8659-b4e06c21149a`,
charged **35 credits**, and left a balance of 3,800 after this isolated job. The
provider response confirms `geometry_resolution: "4k"`; it does not return an
`ai_model` field. Record the explicit 7.1 request without inventing a separately
confirmed model version.

The dense GLB contains 1,256,556 triangles and 702,537 exported vertices, with a
65,096,584-byte source archive. Base color and normal are actually 4096 x 4096;
metallic and roughness are 2048 x 2048. All requested PBR roles are present.
The model, four maps, fixed request and sanitized task/credit receipt are saved
under `art/glass-adventure/platform-trials/v4/meshy/marble-ultra4k/`.

Equal-scale clay/PBR comparison accepts the Ultra result as a high-detail source:
arches, corner blocks, feet, flower medallions, inlay and foliage read more
coherently than V3. The four matching-camera proofs and hash-bound decision are
in `platform-trials/v4/proofs/`. In those images, current V3 is on the left and
Ultra 4K is on the right.

This is not a runtime replacement. At the same 1.801668-metre width, the Ultra
source is 0.970874 metres deep versus V3's 1.400053, and 0.650717 metres high
versus 0.572171. The next mesh must fit the existing landing/collider envelope
before UV, normal/AO and texture-size auditions. The original dense source stays
unchanged. Existing V3 platforms and gameplay are unchanged.
