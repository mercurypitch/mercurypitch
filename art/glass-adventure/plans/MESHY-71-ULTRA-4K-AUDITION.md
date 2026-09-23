# Meshy 7.1 and Ultra 4K — capability check and platform audition

Checked 23 September 2026. Finish the current V8/V9 museum repairs first.
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

Use a verified newer MCP or a small direct-API producer with the existing
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
- [ ] Generate and archive the single-platform 7.1 Ultra 4K audition.
- [ ] Review source, Blender bake and actual game comparisons before replacement.
