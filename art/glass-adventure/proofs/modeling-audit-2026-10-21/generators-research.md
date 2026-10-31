# Generative 3D vs procedural Blender for Glassworks props (research as of 2026-10-21)

Scope: whether to keep Meshy, switch generator, or model procedurally in Blender with an agent, for a three.js r185 (WebGL2) web + Capacitor game whose assets ship as GLB.

Flags used below. **[V]** I checked it in a primary source: vendor docs, spec, source code or manual. **[S]** It comes from a secondary source: press, aggregator or review. **[U]** It is unverified: anecdotal, vendor marketing, or the sources conflict. **[A]** It is my own analysis or recommendation, not sourced.

---

## 1. Meshy now

### 1.1 Model versions and status

- **[V]** API `ai_model` values for Image-to-3D: `latest` (= **meshy-7.1**), `meshy-7.1`, `meshy-6`, `meshy-6-lite`, `meshy-7` (deprecated). Smart Topology uses `meshy-t2` and **`meshy-t2.5`** (default). `model_type: lowpoly` **retires 2026-10-30** (9 days from today). ([Image-to-3D docs](https://docs.meshy.ai/en/api/image-to-3d))
- **[V]** Changelog dates:
  - meshy-4 retired 2026-03-20; meshy-5 retired 2026-10-10.
  - meshy-7 added 2026-08-12; meshy-7.1 added 2026-09-18, becoming `latest`.
  - Smart Topology `model_type` added 2026-07-13; meshy-t2.5 added 2026-10-15.
  - `symmetry_mode` deprecated 2026-05-11 and "no longer affects output".
  - ([changelog](https://docs.meshy.ai/en/api/changelog))
- **[V]** Meshy 7.1 "Ultra 4K" scales geometry from 2048³ to 4096³. A raw mesh "can contain as many as 80 million triangles". It is single-view only. ([Meshy release notes via releasebot](https://releasebot.io/updates/meshy))
- **[U]** Independent testing of whether 7.1's extra resolution helps is still pending ([All3DP test, summarised in search](https://all3dp.com/1/we-tested-meshy-7-1-does-the-new-ultra-4k-really-improve-3d-prints/)). A competitor argues that 7.x targets alignment and detail, not production topology ([Neural4D](https://blog.neural4d.com/comparisons/meshy-7-release-date-and-alternative/)).
- **[V]** Meshy's own 7 benchmark is vendor-run, alignment-only and unreleased. It admits "surface details" is the weakest metric, thin hair "fuses into thicker clumps", and identical tower floors drift out of line. With four views, Tripo 3.1 and Hi3D 2.1 match or beat it ([Meshy blog](https://www.meshy.ai/blog/meshy-7-image-to-3d-geometry-alignment)).
- **[U]** Conflict: a help article says Meshy 7 has no Text-to-3D ([help](https://help.meshy.ai/en/articles/15697060-meshy-7-vs-meshy-6-vs-meshy-6-lite-which-ai-model-should-you-use)), but the API Text-to-3D docs list `meshy-7.1`/`latest` ([Text-to-3D docs](https://docs.meshy.ai/en/api/text-to-3d)). The API docs are newer.

### 1.2 API endpoints and options [V]

- **Text-to-3D** `POST /openapi/v2/text-to-3d`. ([docs](https://docs.meshy.ai/en/api/text-to-3d))
  - `mode: preview` returns an untextured mesh. `mode: refine` textures an existing preview.
  - Preview takes: `model_type` (standard / smart-topology), `geometry_resolution` (standard / 2k / 4k), `should_remesh`, `topology` (quad / triangle, only when remeshing), `target_polycount`, `decimation_mode` 1–4, `pose_mode` (a-pose / t-pose).
  - Refine takes: `enable_pbr` (adds metallic, roughness, normal), `texture_resolution` (2k / 4k / 8k), `remove_lighting`.
- **Image-to-3D** `POST /openapi/v1/image-to-3d`. ([docs](https://docs.meshy.ai/en/api/image-to-3d))
  - `should_remesh` defaults to **false** except on 6-lite.
  - `topology` defaults to triangle.
  - `target_polycount` is 100–300k for remesh, 100–15k for t2, 100–30k for t2.5.
  - `save_pre_remeshed_model`, `image_enhancement`.
  - `remove_lighting` only takes effect on **meshy-6**; 7.1 and `latest` ignore it.
  - `symmetry_mode` and `surface_mode` are deprecated and have no effect.
  - Smart Topology outputs triangles only (`quad` returns 400) and ignores `should_remesh` and `decimation_mode`.
- **Multi-Image-to-3D** `POST /openapi/v1/multi-image-to-3d`. ([docs](https://docs.meshy.ai/en/api/multi-image-to-3d))
  - Takes 1–4 images; the first image is the front view on 7.1.
  - `geometry_resolution` 4k returns 400 here.
  - There is no Smart Topology on this endpoint ([pricing](https://docs.meshy.ai/en/api/pricing)).
- **Remesh** `POST /openapi/v1/remesh`. ([docs](https://docs.meshy.ai/en/api/remesh))
  - `topology`: quad ("quad-dominant") or triangle ("a decimated triangle mesh").
  - `target_polycount` 100–300k; "The result can differ from the target."
  - Accepts GLB, glTF, OBJ, FBX, STL up to 400 MB.
- **Retexture** `/openapi/v1/retexture`: `enable_original_uv` keeps your own UVs; `latest` here = meshy-7 ([docs](https://docs.meshy.ai/en/api/retexture)).
- **UV Unwrap** `/openapi/v1/uv-unwrap`: 5 credits, accepts at most 40k faces, always outputs triangles ([docs](https://docs.meshy.ai/en/api/uv-unwrap)).
- Rigging costs 5 credits and animation 3 per action ([pricing](https://docs.meshy.ai/en/api/pricing)). Rigging is described as humanoid-only ([Fuser test](https://fuser.studio/articles/best-ai-3d-model-generators), [S]).
- The MCP connector added meshy-t2.5 in v0.6.4 ([release](https://github.com/meshy-dev/meshy-mcp-server/releases/tag/v0.6.4)).

### 1.3 Pricing, credits and licence

**[V] API credits** ([API pricing](https://docs.meshy.ai/en/api/pricing)):

| Task                                        | Credits           |
| ------------------------------------------- | ----------------- |
| Image-to-3D, 7.1 or 6 (mesh / 2K / 4K / 8K) | 20 / 30 / 30 / 35 |
| Ultra 2k/4k geometry (7.1)                  | +5                |
| Smart Topology t2 or t2.5 (mesh / textured) | 5 / 15            |
| Remesh                                      | 5                 |
| Retexture                                   | 10                |
| Text-to-3D preview (7.1)                    | 20                |

**[V] Plans** ([pricing](https://www.meshy.ai/pricing)):

- Pro: $20/mo for 1,000 credits.
- Ultra: $100/mo for 8,000 credits.
- Paid output is "private, customer owned"; free output is CC BY 4.0.
- API assets are kept for only **3 days** on Pro to Ultra.

**[A] Derived per-call cost at Pro rates:** about $0.40 for an untextured Image-to-3D, $0.60 textured, $0.10 per remesh. Third-party resellers charge about $0.80 per Meshy 6 generation ([fal.ai](https://fal.ai/models/fal-ai/meshy/v6/image-to-3d/llms.txt), [S]).

### 1.4 Documented failure modes [V]

- **Glass and transparency:** "Highly transparent or reflective objects (glass, mirrors) are difficult to reconstruct — use opaque references instead" ([help](https://help.meshy.ai/en/articles/15723519-how-to-get-better-image-to-3d-results-in-meshy)).
- **Thin parts:** "Fine details like hair strands or thin wires may not fully reconstruct" (same page).
- **Baked lighting:** "shadows bake into the texture" if the reference has directional light (same page).
- **Input complexity:** the `image_too_complex` error covers lattices, wire meshes, scenes and dense repeats ([errors](https://docs.meshy.ai/en/api/errors)).
- **Remesh limits:** "heavy floating geometry and deep face intersections survive a remesh" ([Meshy low-poly page](https://www.meshy.ai/topics/ai-low-poly-generate-or-decimate)).
- **Decimation damage:** "UV boundaries split and normal seams crack" (same page).
- **PBR output:** metallic, roughness, normal and sometimes emission only. There is no transmission, IOR or volume output in any endpoint ([Text-to-3D docs](https://docs.meshy.ai/en/api/text-to-3d)).

### 1.5 Community-reported failure modes [U]

- Smart Topology output came back "with artifacts and holes. It is too hard to fix". The user fell back to 1M-vertex models plus Decimate 0.05, Smart UV Project and bakes, exactly the recipe that produces "badly modeled" results ([r/aigamedev, 2026-10-21](https://www.reddit.com/r/aigamedev/comments/1xbkvnm/)).
- "a blob of a model … immense amount of cleanup" ([r/3Dmodeling](https://www.reddit.com/r/3Dmodeling/comments/1pzgq78/)); "did not produce usable topology" ([r/3Dmodeling](https://www.reddit.com/r/3Dmodeling/comments/1kxny9c/)); failures "esp around faces or anything thin" ([r/aigamedev](https://www.reddit.com/r/aigamedev/comments/1wq0cro/)).
- Texture passes carry baked-in lighting that fights engine lighting ([Summer Engine](https://www.summerengine.com/blog/ai-3d-game-asset-generator), [S]).
- **[A] Asymmetry** follows from the deprecated `symmetry_mode`: there is no longer any API lever for symmetry. I found no measured study of it.

### 1.6 Is Meshy good at glassware? No.

**[V]** Meshy's own guidance tells you to avoid glass references. **[A]** Three further problems:

- Its outputs are opaque metal/rough PBR with no transmission data.
- Lathe symmetry cannot be enforced.
- Wall thickness, the interior cavity and a rounded lip are inferred from pixels. They will not come out as a clean constant-thickness closed shell.

**[A]** The previous pipeline compounded these problems:

- Triangle remesh (decimated triangle soup) gave no edge loops to edit.
- The Ultra 4K audition (single view, up to 80M triangles) produced detail that is thrown away when decimating to a mobile budget.
- `lowpoly` is about to retire anyway.

---

## 2. Alternatives (late 2026)

### 2.1 Notes per generator

- **Microsoft TRELLIS.2-4B**, released 2025-12-16 ([timeline](https://app.cinevva.com/guides/ai-3d-model-generation-timeline-2026), [S]).
  - [V] O-Voxel at 512³, 1024³ or 1536³; about 60 s per generation at 1536³ on an H100.
  - [V] Needs a GPU with 24 GB or more; tested on Linux only.
  - [V] Supports open surfaces, non-manifold and internal structures.
  - [V] Outputs Base Color, Roughness, Metallic and **Opacity**, but the GLB exports `OPAQUE`.
  - [V] The default GLB export decimates to a target of 1,000,000 faces with 4096 textures.
  - [V] Raw output "may occasionally contain small holes". ([GitHub README](https://github.com/microsoft/TRELLIS.2), [HF card](https://huggingface.co/microsoft/TRELLIS.2-4B))
  - **Licence trap [V]:** TRELLIS.2 itself is MIT. Its `nvdiffrast` dependency is "non-commercially … not for any direct or indirect monetary gain" ([NVlabs licence](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt)). ComfyUI's native port (2026-08-22) is "dependency-free" ([ComfyUI wiki](https://comfyui-wiki.com/en/news/2026-08-22-trellis2-pixal3d-native-comfyui)).
  - Pixal3D (Tencent ARC, MIT, May 2026) is built on a TRELLIS.2 backbone ([HF](https://huggingface.co/TencentARC/Pixal3D)).
  - [U] Practitioners report: about 1M triangles across about 200 shells; simplifiers "destroy thin geometry"; meshoptimizer with about a 5% error bound works; voxel-remesh fallback ([r/aigamedev](https://www.reddit.com/r/aigamedev/comments/1weswib/)). Files are about 35 MB ([r/aigamedev](https://www.reddit.com/r/aigamedev/comments/1v2sxwe/)).
- **Tripo**
  - [V] H-series default is `v3.1-20260211`.
  - [V] Face limit up to 1.5M, or 2M with `geometry_quality: detailed`.
  - [V] `quad` gives up to 150k faces (10k default) and **forces FBX**.
  - [V] `smart_low_poly` gives 500–20k triangles or 500–10k quads; "Complex models may occasionally fail".
  - [V] `generate_parts` requires no texture.
  - [V] `delight` removes baked lighting (texture v3.5).
  - [V] `compress: geometry` gives meshopt output.
  - ([H-series docs](https://developers.tripo3d.com/en/docs/generation-text-to-model/standard.md))
  - [V] H3.1 credits: image-to-3D costs 20 untextured or 30 textured; quad +5, smart low-poly +10, parts +20 ([v3.1 page](https://developers.tripo3d.com/en/models/v3-1)).
  - [V] **P2** (`P2-20260801`, preview): "Native quad topology, built for games". Triangles 48–50k, quads 48–25k. No smart_low_poly or parts on P2. Credit units are unlabeled, 100–130 ([P-series page](https://developers.tripo3d.com/en/models/p1)).
  - [S] P2.0 launched 2026-09-21. Tripo hasn't disclosed what "native" means, and "A mesh can consist overwhelmingly of quads and still be poor production topology" ([Digital Production](https://digitalproduction.com/2026/09/29/tripo-p2-0-put-quad-mesh-generation-to-the-test/)).
  - [S] API costs $0.01 per credit ([Tripo API announcement](https://www.tripo3d.ai/blog/announcement-tripo-openapi-platform-payment-system), [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-hwlbvx7vubh7c)).
  - [U] Free tier is CC BY with no commercial use ([Tripo help](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially)).
  - [S] A third-party test lists Tripo's weak spots as "Photoreal faces, glass, multi-object scenes" ([Fuser](https://fuser.studio/articles/best-ai-3d-model-generators)).
- **Tencent Hunyuan3D**
  - [V] Latest open weights are **2.1** (June 2025, PBR, about 10 GB VRAM for shape and 21 GB for texture; [GitHub](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1)). Its licence **"DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"**, and above 1M MAU you need a separate licence ([LICENSE](https://huggingface.co/tencent/Hunyuan3D-2.1/blob/main/LICENSE)).
  - [S] 2.5, PolyGen (autoregressive "art-grade" low-poly), 3.0 and 3.1 are hosted only ([triposr.org](https://triposr.org/blog/hunyuan3d-versions), [PolyGen issue](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/issues/111)). [U] The 3.1 release date conflicts between sources.
  - [V] Tencent Cloud `GenerateType: LowPoly` with `PolygonType: quadrilateral` gives mixed quads and triangles; it is unavailable on 3.1 ([API doc](https://www.tencentcloud.com/document/api/1284/75540)). Hunyuan3D-Part (P3-SAM plus a "light" X-Part) is open ([GitHub](https://github.com/Tencent-Hunyuan/Hunyuan3D-Part)).
- **Hyper3D Rodin Gen-2.5** (2026-05-26)
  - [V] Tiers from Extreme-Low to Extreme-High (the top tier adds a mesh of up to 10M faces); base cost 0.5 credits ([API](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5)).
  - [S] Quad presets 4K/8K/18K/50K plus Smart Low-Poly ([Scenario help](https://help.scenario.com/articles/3791851266-rodin-hyper3d-gen-2-5-models-the-essentials)). Gen-2 (2025-10) does part-based generation ([timeline](https://app.cinevva.com/guides/ai-3d-model-generation-timeline-2026)).
  - [U] API access needs the $120/mo Business plan; direct credits cost $1.50; the FAQ says exports are licence-free for commercial use ([pricing](https://hyper3d.ai/pricing)).
- **Meta SAM 3D Objects** (2025-11-19)
  - [V] Reconstructs a masked object from a cluttered photo; the example output is a Gaussian splat ([GitHub](https://github.com/facebookresearch/sam-3d-objects)). The SAM License is broad and royalty-free with no explicit commercial ban ([text](https://scancode-licensedb.aboutcode.org/sam-2025-11-19.html)).
  - [S] Mesh output is vertex-coloured, needs 32 GB VRAM, and glass "confuse[s] depth estimation" ([fal guide](https://fal.ai/learn/devs/sam-3d-developer-guide)). The wrong tool for clean props.
- **Others**
  - [S] Stability SPAR3D / SF3D: about 0.7 s, placeholder quality; Community Licence free under $1M revenue ([licence](https://stability.ai/license), [The Decoder](https://the-decoder.com/stability-ais-new-3d-model-aims-for-real-time-generation/)). No 2026 successor found.
  - [U] CSM Cube reportedly added "mesh-parts-based topology" in early 2026 ([apis.io](https://apis.io/providers/csm/)); csm.ai did not resolve during this research.
  - [S] Hi3D v3.0 (2026-08-19): 2048³ voxels and 8K textures, a dense bake source ([press release](https://en.prnasia.com/releases/global/hi3d-v3-0-the-first-commercially-available-ai-3d-model-with-2048-voxel-resolution-launches-with-48-hours-of-free-access-for-everyone-544411.shtml)).
  - [S] Sloyd: parametric templates plus AI styling; "Low Poly" preset about 5k triangles with 512 textures ([Sloyd blog](https://www.sloyd.ai/blog/using-sloyd-for-low-poly-game-assets)).
  - Research only: QuadGPT, native quad-dominant generation, ICLR 2026 ([project](https://hitcslj.github.io/QuadGPT/)); PartCrafter, MIT, multi-part ([HF](https://huggingface.co/wgsxm/PartCrafter-Scene)); PartPacker, NVIDIA non-commercial ([timeline](https://app.cinevva.com/guides/ai-3d-model-generation-timeline-2026), [S]).

### 2.2 Comparison table

| Generator (latest)                  | Access / local               | Commercial licence                        | Topology / low-poly control                                       | Thin parts, symmetry, glass                                    | Indicative cost                                       |
| ----------------------------------- | ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| Meshy 7.1 + Smart Topology t2.5     | API, MCP; not local          | Paid plans: customer-owned                | Remesh quad or triangle, 100–300k; T2.5 triangles ≤30k with parts | Thin wires fail; symmetry lever removed; glass "difficult" [V] | about $0.40–0.70 per gen, $0.10 per remesh at Pro [A] |
| Tripo H3.1 / P2.0 preview           | API; not local               | Paid plans only [U]                       | Smart low-poly 500–20k; P2 quads ≤25k; quad forces FBX            | "glass" is a listed weak spot [S]                              | $0.20–0.60 per H3.1 gen; P2 units unclear [U]         |
| TRELLIS.2-4B                        | Local, 24 GB+; ComfyUI       | MIT, **but nvdiffrast is non-commercial** | None; 1M-face default                                             | Open surfaces supported; holes possible; opacity attribute [V] | GPU time only                                         |
| Hunyuan3D 2.1 (open) / 3.x (hosted) | Local (2.1) or Tencent Cloud | **Excludes EU, UK, KR**; MAU cap          | LowPoly mode on 3.0 only; PolyGen hosted                          | No transmission data                                           | about 25 credits per job [U]                          |
| Rodin Gen-2.5                       | API (Business plan)          | Commercial on paid [U]                    | Quad 4K–50K presets; Smart Low-Poly                               | No glass data found                                            | 0.5 credit base [V]; $ unclear [U]                    |
| SAM 3D Objects                      | Local, 32 GB                 | SAM License                               | Splat plus vertex-colour mesh                                     | Reflective surfaces fail [S]                                   | GPU time                                              |
| SPAR3D / SF3D                       | Local or API                 | Free under $1M revenue                    | UV-unwrapped, low detail                                          | Placeholder grade                                              | Cheap                                                 |
| Sloyd                               | Web                          | In-house templates [S]                    | Parametric, about 5k triangles                                    | Only what templates cover                                      | Subscription                                          |

**Who explicitly targets "game-ready":**

- [V] Meshy Smart Topology ([Meshy](https://www.meshy.ai/topics/ai-low-poly-generate-or-decimate)).
- [V] Tripo P-series ([P-series page](https://developers.tripo3d.com/en/models/p1)).
- [S] Rodin Smart Low-Poly ([Scenario help](https://help.scenario.com/articles/3791851266-rodin-hyper3d-gen-2-5-models-the-essentials)).
- [S] Hunyuan3D Studio ([arXiv 2509.12815](https://arxiv.org/html/2509.12815v1)).
- [S] Sloyd.

**What a quad output actually buys you:**

- **[V]** glTF triangulates everything: "quads and n-gons are automatically converted to triangles when exporting to glTF" ([Blender manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)). So quads only help editing in Blender.
- **[V]** At runtime what counts is triangles plus vertex splits: "Discontinuous UVs and flat-shaded edges may result in moderately higher vertex counts" (same page).

**Benchmarks:**

- **[U]** Leaderboards disagree on the leader:
  - Top3D crowd Elo: Tripo v3.1 1101, Hi3D v3 1095, Rodin 2.5 1076, Meshy 7 1075 ([top3d](https://www.top3d.ai/leaderboard)).
  - Pixazo: Hunyuan Pro first, TRELLIS 2 seventh ([Pixazo](https://www.pixazo.ai/leaderboard/ai-3d-model-generation)).
  - Triposplat (citing 3D Arena): CSM first, TRELLIS 2 second ([Triposplat](https://triposplat.com/blog/best-3d-ai-generators-2026)).
- I found **no independent benchmark** of manifoldness, self-intersection or UV quality across the commercial tools.

---

## 3. When AI generation fits, and the cleanup pipeline

### 3.1 What practitioners report

- **Production pipeline: the generator is a replaceable supplier** ([r/aigamedev MMO "Asset Foundry"](https://www.reddit.com/r/aigamedev/comments/1uxbbts/), [U]).
  - TRELLIS.2, Hunyuan3D and Tripo "compete on each asset", scored for symmetry, watertightness and "expected cleanup cost". Rule: "Blender is the geometry truth".
  - "A component generated alone usually beats the same component extracted from a whole-character generation"; in whole generations "thin materials often become thick or malformed".
  - Base colour has to be de-lit. Shipping steps: weld, meshopt, WebP, then QEM-decimated LODs.
- **Procedural for stylised low-poly** ([3D Asset Pipeline thread](https://www.reddit.com/r/aigamedev/comments/1x12gc8/), [U]).
  - A Claude-written headless Blender script builds from bevelled primitives, exports GLB and compresses with meshopt.
  - "None of the convertors or generators produce clean outputs"; "custom headless Blender workflows. Not AAA, but at least decent low poly."
  - Other routes: Tripo multiview at 25k quads then Tripo retopo to about 2.5k, or Hunyuan 1M-polygon output plus Quad Remesher.
- **Agent-driven Blender drifts toward a "CAD look"** ([thread](https://www.reddit.com/r/aigamedev/comments/1wq0cro/), [U]).
  - The look comes from "perfectly smooth procedural surfaces with no breakup, everything symmetric and evenly spaced", and the fix is style constraints.
  - That is harmless, even desirable, for glass vessels and architecture. It is harmful for organic props.
- **Code-modelling benchmarks**
  - [V] 3DCodeBench (May 2026), 12 VLMs: "Failures mostly arise from API mismatches", and successful renders still had "disconnected or floating 3D components". Better reasoning budgets and multi-turn refinement help ([arXiv 2606.01057](https://arxiv.org/abs/2606.01057)).
  - LL3M is a multi-agent system that writes Blender code ([arXiv 2508.08228](https://arxiv.org/abs/2508.08228)).
- **Vendor framing** [V]
  - Native low-poly suits real-time work, high-poly plus decimation suits print, and manual retopology suits deforming or close-up assets ([Meshy](https://www.meshy.ai/topics/ai-low-poly-generate-or-decimate)).
  - Tripo's GDC 2026 release admits artists "often need to rebuild topology, repair geometry" ([PR Newswire](https://www.prnewswire.com/news-releases/tripo-ai-debuts-production-grade-native-3d-diffusion-at-gdc-2026-302708371.html)).
- **No shipped-game postmortems found.** The closest material:
  - The GDC 2026 Meshy-sponsored talk ([GDC Vault](https://gdcvault.com/play/1035369/AI-Generated-3D-Assets-No)).
  - A tavern built from 52 Meshy objects plus 11 rigged people for about 1,950 credits, roughly $23 ([r/aigamedev](https://www.reddit.com/r/aigamedev/comments/1x7ixme/), [U]).

### 3.2 Decision rule [A]

**Model procedurally when:**

- the shape is defined by a profile, sweep, extrusion, symmetry or repetition;
- dimensions must snap to a kit grid;
- the asset needs a physical volume: glass thickness, KHR volume, fracture;
- a set must match.

This covers vessels, columns, arches, frames and platforms. Meshy's own benchmark shows repetition failing, and its symmetry lever is gone (§1.1).

**Generate with AI when:**

- the shape is irregular or organic;
- the detail is high-frequency;
- likeness to a reference matters more than exact dimensions.

This covers plants, harp ornaments, sculptural reliefs and capital foliage. Treat the result as a **high-poly bake source or base mesh**, never as the shipping mesh.

### 3.3 Typical cleanup pipeline (AI asset → mobile GLB)

1. **Generate isolated components** from multi-view, evenly lit, opaque references, at high resolution.
   - [V] Multi-view is "one of the most effective ways to get clean geometry" ([Meshy help](https://help.meshy.ai/en/articles/15723519-how-to-get-better-image-to-3d-results-in-meshy)).
2. **Audit and repair:** weld or merge by distance first; check manifoldness and floating shells.
   - [U] Generated meshes "often arrive vertex-split" ([MMO thread comment](https://www.reddit.com/r/aigamedev/comments/1uxbbts/)).
3. **Rebuild the surface**, choosing the tool by the problem ([Blender manual](https://docs.blender.org/manual/en/5.0/modeling/meshes/retopology.html), [V]):
   - **Voxel remesh** gives one shell with no self-intersections. Good for cleanup and bake sources; bad for deforming or subdivided meshes.
   - **QuadriFlow** ("Quad") gives better flow but "doesn't clean up intersecting geometry".
   - The manual states "no perfect automatic tools exist" for deforming topology.
   - **Quad Remesher** is a paid add-on: all-quad output to a target count, with hard-edge and material-boundary guides ([user doc](https://www.exoside.com/quadremesherdata/QuadRemesher_1.3_UserDoc.pdf)).
   - **Instant Meshes** is free and field-aligned, with stroke-guided edge flow ([EPFL](https://rgl.epfl.ch/publications/Jakob2015Instant), [GitHub](https://github.com/wjakob/instant-meshes)).
   - For static props, error-bounded meshoptimizer simplify (gltf-transform or gltfpack) often beats Blender's collapse Decimate on thin parts [U].
4. **Hand-build or retopo the low-poly**, then UV it yourself: few islands, seams on hard edges.
5. **Bake high to low** with Cycles "Selected to Active" and a cage or extrusion, producing normal, AO and base colour.
   - [V] "Hard splits … should be avoided because they will lead to non-smooth normals around the edges" ([Cycles baking](https://docs.blender.org/manual/en/5.0/render/cycles/baking.html)).
6. **Re-texture:** de-light the bake (Meshy `remove_lighting` on meshy-6, Tripo `delight`), or retexture onto your UVs (Meshy `enable_original_uv`).
7. **Export, compress and validate** as in §5.

---

## 4. Glass that looks great in three.js r185

### 4.1 How transmission actually works in r185 [V]

From `renderTransmissionPass` in the [r185 source](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js):

- **When it runs:** whenever any transmissive object is visible, the renderer re-renders the background and **all opaque objects** into a per-camera target.
- **The target:** HalfFloat where supported, at least 4× MSAA, mipmapped, sized viewport × `transmissionResolutionScale` (default 1, [docs](https://threejs.org/docs/pages/WebGLRenderer.html)). It then resolves and generates mipmaps.
- **One pass per camera, not per object.** Each `DoubleSide` transmissive object also gets its back faces drawn into the target.
- **Mobile caveat:** that back-face step is **skipped when `WEBGL_multisampled_render_to_texture` exists**. The workaround traces to [#28131](https://github.com/mrdoob/three.js/issues/28131), reported on Oculus Browser on Android.
  - **[A]** So double-sided glass can look different on some devices. Test it in the Android WebView and WKWebView.
- **Glass doesn't see glass:** transmissive objects never appear inside other transmissive objects ([forum](https://discourse.threejs.org/t/objects-with-transmission-not-showing-objects-behind/47113); the [Blender manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html) also warns about this).
  - **[A]** Avoid glass-behind-glass lines of sight in the gallery layout.

From the shader chunk ([transmission_pars_fragment.glsl.js](https://github.com/mrdoob/three.js/blob/r185/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js)):

- **Refraction is a single-interface approximation:** the ray refracts at the surface, is offset by `thickness × modelScale` (`thicknessMap` uses G), and samples the screen-space texture at a mip chosen from roughness and IOR (bicubic, two mips). Beer-Lambert attenuation uses `attenuationColor`/`attenuationDistance` (world units).
- **Dispersion repeats the whole lookup three times**, once each for R, G and B.

### 4.2 Material settings

**[V]** Material docs ([MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)):

- With `transmission` above 0, keep `opacity` at 1.
- `thickness` at 0 means thin-walled.
- `ior` ranges from 1.0 to 2.333 (default 1.5).
- `dispersion` is usually 0–1.
- `iridescence` adds a view-dependent thin film.
- The docs say: "always specify an environment map".

**[A] Starting points:**

- `transmission: 1`, `roughness: 0.03–0.08`, `ior: 1.5`.
- `thickness` about 1–2× the real wall thickness (e.g. 0.004 m), or a baked thickness map for solid feet and stems.
- Tint with `attenuationColor` and an `attenuationDistance` of roughly 0.2–1 m.
- `dispersion`: 0 on mobile, 0.1–0.3 for desktop hero pieces.
- `iridescence`: 0.1–0.3 only for special pieces.
- `transparent: false`.

### 4.3 Mobile cost and mitigations

- **[V]** `transmissionResolutionScale` helps: "Lowering this value can result in significant performance improvements" ([docs](https://threejs.org/docs/pages/WebGLRenderer.html)).
- **[U]** Reported numbers:
  - 20 fps with transmission on versus 40 fps with it paused ([forum](https://discourse.threejs.org/t/transmission-effect-pbr-material-performance/59274)).
  - Draw calls and triangles doubling ([forum](https://discourse.threejs.org/t/draw-call-and-triangles-amount-increases-when-having-a-physical-material-with-transmission/46663)).
  - DPR as a major lever: "Best result by removing the buffer and setting DPR to 1" ([forum](https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566)).
- **[A] Plan:** scale 0.5 (0.33 low-tier), DPR capped about 1.5, DoubleSide only on hero pieces, no dispersion on mobile, a cheap fallback for distant or low-tier vessels. Any glass on screen costs a second opaque render.

### 4.4 Alternatives

- **drei `MeshTransmissionMaterial`** sees other transmissive and transparent objects and adds chromatic aberration and blur.
  - [V] Each extra pass is "a full render": two passes with `backside`, one without ([drei docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material), [forum](https://discourse.threejs.org/t/transmission-effect-pbr-material-performance/59274)).
  - Without React, use the vanilla port `@pmndrs/vanilla` ([jsDelivr](https://www.jsdelivr.com/package/npm/@pmndrs/vanilla)).
- **Fake refraction:** Phong or Lambert materials with `envMap` using `CubeRefractionMapping` and `refractionRatio`, around 1/1.5 ([docs](https://threejs.org/docs/pages/MeshPhongMaterial.html), [V]).
  - Add a fresnel rim and alpha blend ([forum ideas](https://discourse.threejs.org/t/definitive-glass-material/22888), [U]).
  - This adds no extra pass and is the right fallback tier.
- **Two-sided "multiside refraction":** render back-face normals to a buffer first ([Codrops](https://tympanus.net/codrops/?p=44326)).

### 4.5 Blender Principled BSDF → glTF (exporter, Blender 5.2 manual) [V]

| Blender setting                                                         | glTF output                                               | Notes                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Principled **Transmission** above 0 or a texture (R channel)            | `KHR_materials_transmission`                              | Keep blend mode Opaque; roughness gives frosted glass                                             |
| Principled **IOR**                                                      | `KHR_materials_ior`                                       | Exported only alongside transmission, volume or specular, and only if ≠ 1.5                       |
| **Volume Absorption** node → Material Output Volume                     | `KHR_materials_volume`                                    | Needs transmission. Colour → `attenuationColor` (no texture); Density → 1 / `attenuationDistance` |
| **glTF Material Output** group → Thickness socket                       | volume `thickness`                                        | A texture must use the G channel                                                                  |
| glTF Material Output → **Dispersion** socket                            | `KHR_materials_dispersion`                                | Only together with volume                                                                         |
| Thin Film IOR / glTF Material Output iridescence sockets                | `KHR_materials_iridescence`                               | Has its own manual section but is missing from the manual's export list [U]                       |
| Clearcoat, Specular IOR Level/Tint, Sheen, Anisotropy, Emission above 1 | clearcoat, specular, sheen, anisotropy, emissive_strength |                                                                                                   |

**Not exported:** Area lights and World lighting are ignored. The exporter builds materials only "based on the nodes it recognizes", so procedural textures, Subsurface and Glass/Refraction BSDF must be baked or replaced [V, with the last item an inference]. Source: ([manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)).

**[V]** three.js r185's GLTFLoader natively reads transmission, volume, ior, dispersion, iridescence, specular, clearcoat, `KHR_texture_basisu`, EXT and KHR meshopt, Draco and `EXT_mesh_gpu_instancing` ([docs](https://threejs.org/docs/pages/GLTFLoader.html)).

### 4.6 Geometry rules for glass

- **[V]** A volume "must be manifold … closed mesh". Thickness is in mesh space, and baking a thickness map works like AO baking with rays cast against the normal ([KHR_materials_volume](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md)).
- **[V]** Blender's Solidify in Complex mode can "guarantee a manifold output geometry". Simple mode has Even Thickness, High Quality Normals and Rim Fill ([Solidify](https://docs.blender.org/manual/en/5.0/modeling/modifiers/generate/solidify.html)).
- **[V]** Screw has viewport and render steps, Merge (closes the axis with a triangle fan), Stretch UVs and Smooth Shading ([Screw](https://docs.blender.org/manual/en/5.0/modeling/modifiers/generate/screw.html)).
- **[A]** Rules of thumb:
  - Model real inner and outer walls, roughly 2–5 mm at real scale.
  - Round the lip with a two- or three-segment bevel; the bright rim highlight is what reads as glass ([POV-Ray rim discussion](https://news.povray.org/3eadc26a%241%40news.povray.org), [U]).
  - Use smooth normals. Refraction uses the normal, so facets break both refraction and highlights.
  - Use 48–64 radial segments for hero silhouettes and 24–32 for small or distant vessels.
  - No normal maps on clear glass.
  - Use a separate material slot for fracture faces.

### 4.7 Environment and HDRI

- **[V]** The transmission pass renders `scene.background`, so what you see through the glass is the background plus opaque objects (r185 source above).
- **[A]** Reflections from `scene.environment` (PMREM) carry most of the "glass" read. Use an HDRI with bright shapes: windows, softboxes, sky gradient. Add a few thin bright emissive strips in the museum for highlight lines, and tune `envMapIntensity` per tier.

---

## 5. Web and mobile GLB delivery

**Budgets:**

- **[V]** Khronos 3D Commerce guideline mirror, 2020 and "likely to change rapidly": a single-item mobile AR or 3D web view gets 150k triangles, fewer than 20 target and at most 500 draw calls, and 2K textures ([3DC](https://github.com/mlimper/3DC-Asset-Creation/blob/main/asset-creation-guidelines/full-version/sec99_PublishingTargets/PublishingTargets.md)).
- **[S]** Needle's guidance for Quest-class mobile GPUs: about 100–150 draw calls, 200–300k visible triangles, KTX2 over WebP because "WebP is uncompressed in GPU memory" ([Needle](https://engine.needle.tools/docs/how-to-guides/xr/vr-performance)).
- **[A] Per-prop LOD0 targets:**

| Prop         | Triangles                              |
| ------------ | -------------------------------------- |
| Small vessel | 1.5–4k                                 |
| Large urn    | 3–6k                                   |
| Harp         | 8–15k (strings as thin boxes or lines) |
| Column       | 2–6k, with a normal-mapped capital     |
| Arch segment | 1–4k                                   |
| Frame        | 0.5–2k                                 |
| Platform     | 0.5–3k                                 |

Scene total: about 150–300k triangles and 60–100 draw calls.

**Meshopt vs Draco:**

- [V] "Meshopt decoding is considerably faster than Draco", it also handles animation and morph targets, and it needs gzip or brotli for its full gain ([gltf-transform](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression)).
- [S] Draco is somewhat smaller but its decoder is about 10× larger ([guide](https://app.cinevva.com/guides/optimize-glb-for-web)).
- [V] `KHR_meshopt_compression` is still a "Release Candidate" ([spec](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md)). Prefer EXT for compatibility.
- [V] Blender 5.2 can export meshopt directly ([manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)).
- **[A]** In Capacitor bundles there is no HTTP compression at runtime, so use `-cc` or `-cz`.

**Textures:**

- [V] KTX2/Basis gives "less GPU memory consumption than … PNG or JPEG"; use UASTC for normal maps and ETC1S for colour. The CLI needs KTX-Software installed (gltf-transform CLI source, linked below).
- [V] three.js needs `KTX2Loader.setTranscoderPath()` and `detectSupport(renderer)` ([docs](https://threejs.org/docs/pages/KTX2Loader.html)).

**Recipes** [V for flags, from [gltf-transform CLI source v4.5.1](https://github.com/donmccurdy/glTF-Transform/blob/main/packages/cli/src/cli.ts) and [gltfpack README](https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md)]:

```bash
# Kit pieces (instancing wanted). optimize = dedup, instance, palette, flatten, JOIN, weld,
# simplify (error 1e-4 default), resample, prune, sparse, textures (auto, 2048 max), meshopt high
gltf-transform optimize kit.glb kit.opt.glb --compress meshopt --texture-compress ktx2 --texture-size 1024

# Glass vessels and shards: keep nodes and materials, no merging or simplifying
gltf-transform optimize vase.glb vase.opt.glb --join false --flatten false --palette false \
  --simplify false --compress meshopt --texture-compress ktx2
gltfpack -i shards.glb -o shards.opt.glb -cc -tc -kn -km   # -kn keep named nodes, -km keep named materials
gltf-transform simplify lod0.glb lod1.glb --ratio 0.5 --error 0.001   # weld first
gltf-transform validate out.glb && gltf-transform inspect out.glb
```

- **[V]** `optimize` joins distinct and named meshes by default, because `join`'s keepMeshes and keepNamed are both false ([join.ts](https://github.com/donmccurdy/glTF-Transform/blob/main/packages/functions/src/join.ts)). That would merge the 16 shards into one mesh.
- **[V]** gltfpack merges meshes on non-animated nodes by default and does not support Draco.

**Instancing and LOD:**

- [V] `InstancedMesh` covers the same geometry and material; `BatchedMesh` covers different geometries with one material ([InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html), [BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)).
- Use `gltf-transform instance` or `gltfpack -mi` to write `EXT_mesh_gpu_instancing`.
- **[A]** For lathe props, build LODs by lowering Screw steps (64 → 32 → 16) rather than decimating. This keeps symmetry and UVs.

**Validation:**

- [V] Khronos glTF-Validator runs on the web (drag and drop), as the `gltf-validator` npm package, or as a CLI, and writes a JSON report. It covers transmission, volume, ior, dispersion and iridescence ([repo](https://github.com/KhronosGroup/glTF-Validator)).
- Add Blender-side manifold checks before export.

---

## Recommendations

**Overall [A]:**

- Stop using Meshy for anything symmetric, architectural, glass or fractured. The Reddit "TRELLIS.2 or Tripo" advice is right for organic props, including its texture and UV warning, and wrong for this museum's core kit.
- If you keep Meshy for organic props:
  - Use multi-image, `meshy-t2.5` or a high-resolution 7.1 output as a bake source.
  - Switch any `lowpoly` calls before 2026-10-30.
  - Download within 3 days.
- If you need local or offline generation, use TRELLIS.2 through ComfyUI's dependency-free port (licence).
- If you want built-in low-poly and quads, use Tripo H3.1 smart low-poly or P2. Avoid Hunyuan open weights if you distribute in the EU, UK or South Korea.

**For lathe glassware** (amphora, decanter, urn, carafe, bowl) **[A]: fully procedural.**

1. The agent writes or derives a half-profile curve. AI can help here: generate an orthographic silhouette image and trace it, but never the mesh.
2. Screw modifier: 48–64 steps (hero) or 24–32 (small).
3. Solidify for 2–5 mm walls (Simple + Even Thickness + High Quality Normals, or Complex for a guaranteed manifold result).
4. Bevel the lip, then Smooth by Angle or Weighted Normal.
5. Run a manifold check and use Stretch UVs.
6. Principled material: Transmission 1, IOR 1.5, Volume Absorption tint, glTF Material Output thickness.
7. Build LODs by changing steps.
8. In three.js: MeshPhysicalMaterial as in §4.2, `transmissionResolutionScale` 0.5 on mobile, a cheap envMap-refraction fallback tier, and a strong HDRI.

**For architectural kit pieces** (columns, arches, gallery frames, planters, platforms) **[A]: parametric Blender (geometry nodes or Python).**

- Use grid-snapped dimensions, bevels with weighted normals, and shared marble/brass trim-sheet textures in KTX2.
- Ship one GLB per kit, run `optimize` with instancing, and render with `InstancedMesh`.
- Use AI only for ornament detail (acanthus capitals, reliefs, ornate frame corners), generated as isolated components and baked to normal and AO maps on the procedural low-poly.

**For organic or irregular props** (plants, harp ornaments) **[A]: AI as a source, procedural for the structure.**

- Harp: the frame is a procedural curve sweep and the strings are procedural.
- Ornaments, scrolls and finials, and plants: generate each component separately from multi-view, opaque, evenly lit references with Tripo H3.1/P2, Meshy T2.5/7.1, or TRELLIS.2 locally.
- Then run the full §3.3 pipeline: weld/repair → retopo (Quad Remesher, QuadriFlow, Instant Meshes, or meshoptimizer with an error bound) → own UVs → Selected-to-Active bake with a cage → de-lit textures → validate.
- Budget about 2–8k triangles per plant.

**For shatter shards [A]: procedural only. Generators cannot produce consistent fracture sets.**

1. Fracture the final closed LOD0 vessel with **Cell Fracture** (extension 0.2.1, Blender 4.2+; [listing](https://extensions.blender.org/add-ons/cell-fracture/)).
   - [V] It builds convex-hull Voronoi cells and **Boolean-INTERSECTs** each with the object ([source](https://projects.blender.org/extensions/object_fracture_cell)).
   - Options [V]: Source (own verts, particles, annotation), Source Limit (set to 16), Recursion, Margin, Split Islands, interior Material index, Interior VGroup, Recenter.
2. Boolean caveat [V]: "Only Manifold meshes are guaranteed to give proper results", and the Manifold solver "will not work at all on non-manifold meshes" ([Boolean](https://docs.blender.org/manual/en/5.0/modeling/modifiers/generate/booleans.html)). A solidified closed shell is therefore a prerequisite. This alone rules out uncleaned AI meshes.
3. After fracturing:
   - Check that each shard is a single manifold island. Split Islands can raise the count above 16, so re-seed if it does.
   - Assign the fracture-face material.
   - Recenter origins.
   - Name each node.
4. Export as separate nodes in one GLB, using `gltfpack -kn -km`, or `optimize --join false --flatten false`.
5. At runtime, swap the intact vessel for the shards on impact.
   - Shards can use a cheaper glass tier since they are small and moving.
   - `BatchedMesh` can draw all 16 in one call. It is untested with transmission.
