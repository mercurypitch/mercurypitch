# Agent-driven Blender asset creation: research for a Glassworks skill (2026-10-21)

Scope: the tools, skills and recipes that help an agent (Opus 5.5 in Claude Code, often in a headless, GPU-less container) build game props that look made by a skilled artist. **[V]** marks claims I checked myself on Blender 5.2.2 LTS, running headless in this container (4 vCPU, no `/dev/dri`, Mesa llvmpipe). The test scripts are in `/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/research-a-scripts/` and their outputs are in `/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/research-a-out/`. **[U]** marks claims I could not verify.

---

## 1. Blender MCP servers

### 1.1 Official Blender Lab MCP (this is the "Blender connector" Anthropic announced on 2026-04-28)

- **Identity.** Anthropic's "Claude for Creative Work" post (2026-04-28, updated 2026-05-01) says the Blender developers built the connector. The update says Blender took Anthropic's money as a one-time donation, not through the Development Fund. Some press reported a "Corporate Patron" tier; that is out of date. https://www.anthropic.com/news/claude-for-creative-work, https://digitalproduction.com/2026/04/30/anthropic-funds-blender-ships-claude-connector/
- **Architecture.** The MCP client talks stdio to a `blender-mcp` process, which talks TCP to an add-on inside Blender. The default is localhost:9876 (`mcp_to_blender_server.py`). The project calls itself "deliberately small". It is GPL-3.0, maintained by Blender Lab, and the manifest sets `blender_version_min = "5.1.0"`. https://projects.blender.org/lab/blender_mcp (readme.md, addon/blender_mcp_addon/blender_manifest.toml)
  - **Version conflict.** The Claude Academy tutorial says "Blender 4.2 or later", but the manifest and blender.org/lab both say 5.1+. Assume 5.1+. https://academy.claude.com/tutorials/using-the-blender-connector-in-claude
- **Tools (26).** Source: `readme_tools.rst`.
  - Code: `execute_blender_code` and `execute_blender_code_for_cli`.
  - Blend-file summaries: datablocks, missing files, linked libraries, path info, use-case guess. Each has a `_for_cli` variant.
  - Scene summaries: `get_objects_summary`, `get_object_detail_summary`.
  - Screenshots: `get_screenshot_of_area_as_image`, `get_screenshot_of_window_as_image`, `get_screenshot_of_window_as_json`.
  - Navigation: four `jump_to_*` tools.
  - Renders: `render_thumbnail_to_path` (320 px longest side, 16 samples) and `render_viewport_to_path` (a full render with the scene's settings).
  - Docs search over a bundled API reference and manual: `search_api_docs`, `search_manual_docs`, `get_python_api_docs`.
  - It has **no asset-library or 3D-generation integrations**.
- **Headless.**
  - The add-on registers a CLI command (`bpy.utils.register_cli_command("blender_mcp", …)`), so a background server is `blender --background file.blend --command blender_mcp [--host H --port P]` (`addon/.../cli.py`).
  - In background mode requests must finish synchronously; deferred results are rejected (readme).
  - The `_for_cli` tools start `blender --background <file> --python-expr …` themselves. They find the binary through the `BLENDER_PATH` environment variable and time out after 120 s (`mcp/blmcp/tools_helpers/blender_cli.py`).
  - The screenshot tools need a real window. Headless agents must render instead.
- **Install.**
  - Add-on: drag the v1.0.3 zip onto Blender, or **[V]** run `blender --command extension install-file -r user_default -e <zip>`.
  - Server: `git clone https://projects.blender.org/lab/blender_mcp.git`, then configure the MCP client with `uv --directory <clone>/mcp run blender-mcp` (wiki "Setup" page).
  - For Claude Code: `claude mcp add blender -- uv --directory ~/blender_mcp/mcp run blender-mcp`.
- **Gotchas.**
  - Code runs "without any guards". `weak_sandbox.py` describes itself as "not really a sandbox". Blender recommends a VM. https://www.blender.org/lab/mcp-server/
  - **[V]** Even the official toolcode has version drift. On `main`, `render_thumbnail_to_path_toolcode.py` tests `engine == "BLENDER_EEVEE_NEXT"`, which never matches in 5.x, so the EEVEE sample override is silently skipped.
  - `data/prompts.yml` holds good agent rules worth copying: inspect before assuming; set mode, active object and selection explicitly; update the depsgraph before reading results; flush bmesh; return structured data.

### 1.2 "MCP for Blender" (formerly ahujasid/blender-mcp)

- **Rename.** The repo is now `ahujasid/mcp-for-blender` and the PyPI package is `mcp-for-blender`. `uvx blender-mcp` still works. `pyproject` is at v2.2.2. It is MIT-licensed and supports Blender 3.0+. https://github.com/ahujasid/mcp-for-blender
- **Tools in `server.py`.**
  - `execute_blender_code`.
  - `get_scene_info`, with `fields` for placement, contents and **health**: quads/tris/ngons, non-manifold and boundary edges, loose verts, poles.
  - `look`:
    - modes: `viewport`, `camera`, `angles` (default front/right/top/three_quarter, auto-framed, optional `distance`), `frames`;
    - shading: `solid`, `material`, `rendered`, `wireframe`, `xray`;
    - `max_size` defaults to 768.
  - `generate_3d`: Hyper3D Rodin, Hunyuan3D and Meshy with your own keys; Tripo is Premium only.
  - `search_assets` / `import_asset`: Poly Haven (no key), Sketchfab and Poly Pizza.
  - Viewport-app helpers and telemetry controls.
  - Install: `uvx mcp-for-blender install-addon`, then `claude mcp add blender uvx mcp-for-blender`.
- **Headless: not supported.** **[V]** In the add-on source, `start()` prints "cannot start server in background mode (blender -b) … use a virtual display: xvfb-run -a blender" and returns. Xvfb is installed in this container, but I did not test this server under it **[U]**.
  - Viewport capture uses `GPUOffScreen.draw_view3d`, because window grabs come back black when Blender is not in the foreground.
- **Gotchas.**
  - The socket has no authentication.
  - `BLENDER_MCP_SAFE_MODE=1` restricts imports and file, network and subprocess access.
  - Content telemetry is opt-in; `DISABLE_TELEMETRY=true` removes even the anonymous record.
  - Poly Haven downloads freeze Blender, because they run on the main thread.
  - Poly Pizza can fail with a Cloudflare challenge on cloud IPs.
  - Both servers default to **port 9876**. Run one, or pass `--port`.
  - CVE-2026-66004: path traversal in `download_polyhaven_asset`, fixed in commit 30a3308. https://cvefeed.io/vuln/detail/CVE-2026-66004
  - CVE-2026-10688: code injection via `execute_blender_code`. https://nvd.nist.gov/vuln/detail/CVE-2026-10688
- More servers (Blender MCP Pro; StraySpark, 556 tools) appear in a vendor comparison; treat its numbers with caution. https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026

### 1.3 Implication for a headless skill

For CPU containers, the most robust setup is to have Claude Code run **versioned build scripts** (`blender -b --factory-startup --python build/NN_phase.py -- args`) that reopen and save one master `.blend`. Keep MCP optional for live inspection. Both majidmanzarpour's skill (§2.2) and the Reddit OP's "headless until decent, then screenshots" tip follow this pattern. For live targeted edits on a desktop, use the official MCP. Use mcp-for-blender only if you need Poly Haven or generators.

---

## 2. Existing skills and prompt packs (what actually makes them work)

### 2.1 RobLe3/cc-blender-skill (v1.4.0; 30 skills; supports both MCP backends) https://github.com/RobLe3/cc-blender-skill

- **quality-refinement-autoloop.** On a rejected result, run these phases in order:
  1. freeze the baseline;
  2. capture the smallest evidence set;
  3. classify the failure dimension (geometry, multiview depth, UV, coverage, look, animation, export, orchestration);
  4. decide whether a skill is missing;
  5. sanitize the lesson;
  6. patch the skill;
  7. validate;
  8. only then repair the asset.
  - Hard rule: "Do not tune lighting/materials to hide geometry or UV failures." This is the formal version of the OP's "mistakes log".
- **Coordinate contract (orthographic-registration, contour-to-mesh).** Front view = X/Z silhouette, side = Y/Z depth, top = X/Y spread. The back view never rewrites the front. Boundary vertices from the front contour are locked; depth may only move Y.
  - A rotation inside the front plane is a rotation about **Y**. This is a common agent bug.
- **multiview-constraint-solver.** Before fitting, check that the views agree with each other (e.g. side depth/height against top depth/width). If they disagree, pick a canonical policy instead of averaging.
- **multiview-fit-loop gates.** bbox centre drift ≤1.5% of width; size drift ≤3% front and ≤5% other views; exact part count. Compare flat white-on-black silhouettes, not beauty renders.
  - The overlay convention is: reference cyan, render yellow, both green, XOR red.
- **reference-analysis-validator thresholds.** IoU ≥0.90 rigid, ≥0.82–0.85 soft, <0.80 never final. Centroid ≤12 px at 1024 px. SSIM is diagnostic only, used after the masks pass: ≥0.75 early, ≥0.88 near-final.
- **reference-look-calibration:** crop/scale → background → base hue/value → emission → colour management, measuring HSV mean, p95 brightness and hue drift under the object mask.
- **text-to-blender lessons:** look up real dimensions first; reset the world (a stale Environment Texture gives magenta renders); overlap joined parts 5–15 mm; collapse tips and merge verts; coloured glass needs Volume Absorption, Roughness 0.02–0.05 (not 0), Cycles `transmission_bounces` ≈24. Its own candid limit: "functionally correct objects but not well-designed ones" (chair round).
- **Disagreement.** Its modelling skill uses Cube+Bevel+SubSurf, with the stack order "…Bevel→SubSurf→(Boolean)". For game props, use Mirror → Boolean → Bevel → Weighted Normal (EL4CTEO, §2.4), because bevels must run after the cuts.

### 2.2 majidmanzarpour/blender-game-skills, `blender-image-to-3d` (MIT) https://github.com/majidmanzarpour/blender-game-skills

This is the closest match to the Glassworks need.

- **Gated phases.** Phases 0–10: brief, calibration, blockout, forms, topology, UV/bake, rig, secondary motion, animation, export/round trip, acceptance.
  - Rule: "nothing gets detail until its silhouette passes".
  - Every gate is passed with renders from the reference camera **at gameplay pixel size** (default 128 px). "The viewport is not evidence."
- **Brief template.** It requires 8–15 measured proportions, scale evidence, parts in overlap order, 3–5 silhouette features, and an INFERRED list. Every constant in a build script carries a comment naming its source view or `# inferred`.
- **Calibration master.** Collections REF/HIGH/LOW/COLLISION/SOCKETS/EXPORT, a ruler, and reference images as planes at real scale, with the ground line at z=0.
- **Tolerances.** Blockout IoU ≥0.85 with each of 10 height-band widths within 0.05. Forms IoU ≥0.90 with bands within 0.03. Proportions within 5% (blockout) and 2% (forms).
- **`compose_review.py`** uses only Pillow. It writes a comparison sheet plus aspect ratio, widths at 10 height bands, and IoU after aligning bboxes.
- **`world_gate.py`** sets the camera to the exact world window of the matte (metres per pixel, axis column, ground row). Scale and offset errors then lower IoU, whereas a bbox-aligned IoU "cannot see a model that is too short".
- **Construction helpers.**
  - `profile_spin` (lathe, for vases and columns), `profile_extrude` (arches, mouldings), `curve_tube`, `loft`, `skin_chain`.
  - `bevel(width, segments=3, angle 30°, harden=True)`, `solidify`, `boolean(EXACT)`, `shrinkwrap`, `lod_copy`, `smart_uv`.
  - A 4.1+-safe `shade_smooth` that marks sharp edges by angle.
  - Budget: 15–60 primitives for a blockout.
- **Budgets.** Small props: "a few hundred triangles"; architecture modules 0.5–5k per piece with a trim sheet; one texel density per asset family.
- **Blender 5 notes** (beyond §4.1): look nodes up by `type`, not display name; exclude glass and visor shells from bake sources; compare under the Standard view transform, not AgX; match concept colours by the median sRGB of a world-space box.

### 2.3 new-experement/blender-asset-studio (Codex v1.3.1, plus a Claude Code variant) https://github.com/new-experement/blender-asset-studio

- **Maker ≠ reviewer.** The review subagent gets only the brief, the references and fresh renders, never the maker's notes. "A script that ran, a low triangle count or a confident narrative never passes the visual gate."
- **Region observation format.** Each region is written as reference → candidate → difference → repair ID.
- **Executable fixes.** "roof_panel thickness 0.018 → 0.036 m (±0.002)", not "make it thicker". Colours are given with their encoding (sRGB → linear formula). Severity is blocking/major/minor, and "A numeric score cannot cancel a blocking or major defect."
- **Loop rules.**
  - After **two non-improving attempts** on one issue, switch method.
  - Never lower the benchmark to "the best model so far".
  - Source-to-export equality proves the exporter worked, not that the asset is good.
- **Fast tests:** flat silhouette from 2–3 directions; greyscale plus a light blur (value hierarchy); target-size thumbnail; scale dummy; contacts; penetration; wireframe density; neutral, repeatable light.
- **Geometry economy.**
  - Detail smaller than about **4–6 projected pixels** at the closest view should go to a map, decal or bake (heuristic). Pixels per metre = `H/(2·d·tan(vFOV/2))`.
  - 1–2 bevel segments for non-focal edges.
  - Count _evaluated/exported_ triangles.
  - Background-Blender audits cover contacts (BVH), visibility sampling and intersections.

### 2.4 Others worth borrowing from

- **EL4CTEO/blender-skills** (Blender 5.2). https://github.com/EL4CTEO/blender-skills
  - A 4.x→5.2 API table, "verified against 5.2.2" (`skills/blender-core/references/api-changes-5x.md`).
  - The hard-surface stack: Mirror → Booleans → Bevel → Weighted Normal → (Triangulate at export).
  - Bevel width ≈0.5–2% of the part size, kept consistent; `use_clamp_overlap`, `harden_normals`, `MITER_ARC`.
  - Weighted Normal: FACE_AREA, weight 50, keep_sharp.
  - Cylinder sides by on-screen size: 6–8 / 12–16 / 24–32 / 48+, in multiples of 4 or 8.
  - `asset-qa` checks z-fighting within 1 mm, floating islands, back-to-back faces and `ground_z`, and renders "random colour per object" sheets to expose detached parts.
- **viettranx/3dviz-pro-max** (Three.js plus Blender). Its capture helper (Playwright plus Chromium) makes the agent look at frames from the **target renderer**; without capture it exits with code 3 rather than claiming success. https://github.com/viettranx/3dviz-pro-max

### 2.5 The Reddit tips, checked against evidence (thread: https://www.reddit.com/r/ClaudeAI/comments/1xblwzf/)

- **Strict rules, a mistakes log, comparison against references, "why does this part exist".** Matches cc-blender-skill's autoloop, majidmanzarpour's brief/INFERRED lists, and asset-studio's "geometry must earn its cost". Supported.
- **Orchestrator plus 5–7 subagents.**
  - Google's Argon guide uses an orchestrator plus an adversarial critic (§3).
  - LL3M (arXiv 2508.08228) uses planner/retrieval/coder/critic/verifier roles. https://arxiv.org/abs/2508.08228
  - Caveat: parallelise only disjoint write scopes ("Do not parallelize two tasks that both edit the same Blender recipe" — fit-repair-optimizer).
  - Another r/ClaudeCode user had Opus orchestrate GPT-6 Astra and Gemini 4 Argon. Commenters: the outputs "look good at first glance, but are wrong on most details" and "the vision stack has low information rate". https://www.reddit.com/r/ClaudeCode/comments/1x5mnrd/
- **Max effort.** 3DCodeBench found that higher thinking budgets improve results overall, but harnesses mostly fix _executability_, not shape (§5.1). Partly supported.
- **"Never make perfectly cut edges."** Matches standard mid-poly practice: chamfer, then face-weighted normals. https://polycount.com/discussion/comment/2577208/ The vessel test in §4.3 shows the effect.
- **False-colour ID renders with measurements and dots.** The OP's image (`/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/reddit-dl/yss91kmxxtwh1.png`) is a 3×4 grid of multi-angle close-ups with flat colour per part: red eyeball, teal/green iris, blue pupil. I reproduced the technique in §5.2 **[V]**.
- **Multi-agent single-.blend plugins.** **[U]** I found only unvetted repos. LiCinCan/blender-ai-mcp-addon gained 971 stars and 389 forks within 6 days of creation, which is a red flag; Kiet1308/blender-headless-fleet has 0 stars. Safer: one Blender process and one `.blend` per agent and part, assembled by linking or appending.
- **Photogrammetry as a reference layer; ffmpeg frames.** Reasonable but not benchmarked **[U]**. Put scans in REF and use them for proportions and Shrinkwrap. Extract frames with `ffmpeg -i ref.mp4 -vf "fps=2,scale=1024:-1" ref/f_%04d.png`.
- **TRELLIS 2 / Tripo "usually not fit for games".**
  - TRELLIS.2 is 4B parameters, MIT, with 512³–1536³ voxels. It takes about 3–60 s on an H100, and reportedly needs ≥24 GB VRAM, so it is not for CPU containers. Its card gives no polycount or UV data. https://huggingface.co/microsoft/TRELLIS.2-4B
  - Use generated "donors" as REF, bake or Shrinkwrap targets, not as shipping topology.
- **Placeholders first.** Matches majidmanzarpour's greybox lineup. The Godot tycoon dev "rebuilt [models] when they drifted from the sheets", and found taste to be the weakest area. https://www.reddit.com/r/ClaudeAI/comments/1x8ckb4/

---

## 3. "Gemini 4 Argon and Google Antigravity: From 2D concept to 3D cathedral" (OYp5j2RihPE)

- **Metadata.** Google for Developers, 2026-10-13. Speaker Tiago Aragona.
- **Description.** "connect Antigravity directly to Blender via the Model Context Protocol (MCP), leveraging Gemini 4 Argon across **45 iterative agentic loops** to deduce complex architectural geometry, detail column fluting, and set up volumetric lighting". Products: Argon, Antigravity, Blender, MCP, Flow. https://www.youtube.com/watch?v=OYp5j2RihPE
- **Summary.** The concept image came from Flow. "45 iterative rounds comparing its geometry against the reference image", then fluting, floor textures, volumetric fog, camera depth and lighting. https://daily.dev/posts/gemini-4-argon-and-google-antigravity-from-2d-concept-to-3d-cathedral-gp7rb9vb0
- **Google's launch post.**
  - "Starting from a single Nano Banana image in Antigravity, Argon drives Blender MCP in an autonomous loop, aligning camera grids, sculpting Gothic architecture, and staging audio-reactive lighting."
  - The pagoda demo used "multi-agent visual critique loops".
  - Desk-to-game: "modeled and collision-checked using Blender MCP, textured with Nano Banana … wired it for the web in Three.js".
  - https://blog.google/intl/en-in/products/introducing-gemini-4-argon/
- **The loop, from the AI Studio guide.** The page is JavaScript-rendered, so this comes from search snippets and Traictory's summary **[partly U]**. https://aistudio.google.com/learn/building-3d-games-and-worlds-with-gemini-4-argon, https://traictory.com/news/2026-10-15-gemini-4-argon-blender-pagoda
  - **Stack:** "Vite + Three.js + Headless Blender MCP + headless browser screenshots", with an orchestrator and subagents.
  - **Each round, 4 screenshots:** a three-quarter overview, a close-up, a low angle, and a wireframe "to prove clean geometry".
  - **The adversarial critic** lists ≥3 named flaws and gives a score out of 10. "Keep iterating until the Critic rates the scene 9/10 or higher."
  - **Photorealism step:** a 2K Nano Banana target image at the same framing, then upgrade geometry and materials to match it.
  - Blueprints become four reference images.
- **Caveats.** Traictory: no cost or time ledger, no topology or game-readiness data, and human involvement is understated. The Reddit OP says Argon "needs 2-3x the iterations" of Claude.

---

## 4. bpy recipes that stop props looking "primitive-y"

### 4.1 Version traps that break agent-written bpy (cite these in the skill; add a startup assert on `bpy.app.version`)

Sources: https://developer.blender.org/docs/release_notes/4.1/modeling/, …/4.2/python_api/, …/4.5/modeling/, …/5.0/python_api/, and the EL4CTEO table. **[V]** marks items confirmed in 5.2.2.

| Change                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Version |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `Mesh.use_auto_smooth` and `auto_smooth_angle` removed **[V]**. Use `bpy.ops.object.shade_auto_smooth(angle=rad)`, which adds the "Smooth by Angle" Geometry Nodes modifier and **[V]** works in `-b --factory-startup`, or `shade_smooth_by_angle(angle, keep_sharp_edges=True)`, which writes the `sharp_edge` attribute **[V]**. Custom normals no longer need auto smooth.                                                                             | 4.1     |
| EEVEE identifier `BLENDER_EEVEE_NEXT`. `blend_method` → `surface_render_method`. Add-ons become extensions (`blender_manifest.toml`).                                                                                                                                                                                                                                                                                                                      | 4.2     |
| Principled v2 socket names (`Specular IOR Level`, `Transmission Weight`, `Coat Weight`, `Emission Color` …). **[V]** `Weight` and `Subsurface IOR` are `enabled=False`.                                                                                                                                                                                                                                                                                    | 4.0+    |
| Boolean `MANIFOLD` solver (fast; inputs must be manifold).                                                                                                                                                                                                                                                                                                                                                                                                 | 4.5     |
| Engine back to `BLENDER_EEVEE`; `…_NEXT` raises TypeError **[V]**. Boolean `FAST` → `FLOAT` **[V]**. Legacy `action.fcurves` removed **[V]**. `material.use_nodes` and `scene.use_nodes` deprecated; new materials already contain Principled+Output **[V]**. `scene.node_tree` → `compositing_node_group` **[V]**. Render-pass names, `image_settings.media_type`, float32 `mathutils` buffers, `bpy.props` stored apart from ID properties, BGL removed. | 5.0     |
| Python 3.13 **[V]**; user site-packages not auto-loaded.                                                                                                                                                                                                                                                                                                                                                                                                   | 5.1     |
| `gpu.init()` required for `gpu` in background mode **[V]**; GN modifier inputs via `mod.properties.inputs`.                                                                                                                                                                                                                                                                                                                                                | 5.2     |

Other traps:

- Modifier type is `SUBSURF`, never `SUBSURFACE` **[V]**.
- **[V]** `uv.smart_project(angle_limit=…)` takes **radians**; `island_margin` defaults to 0.0.
- **[V]** The 3D-Print Toolbox is no longer bundled; it is now an extension. https://extensions.blender.org/add-ons/print3d-toolbox/
- 3DCodeBench: about 85% of two models' failures were 4.x→5.0 drift (`KeyError "Specular"`, `use_auto_smooth`, `"SUBSURFACE"`, `create_cone(diameter1=…)`). https://arxiv.org/abs/2606.01057

### 4.2 Edges and shading (where "no perfectly cut edges" turns into settings)

Primary docs: https://docs.blender.org/manual/en/5.2/modeling/modifiers/generate/bevel.html, …/normals/weighted_normal.html, …/normals/smooth_by_angle.html

- **Apply scale first.** Bevel, Boolean and Solidify distances are in object space.
- **Bevel modifier settings.**
  - Width is in metres; use ≈0.5–2% of the part size, consistent across the asset family.
  - Starting points for Glassworks: plinth/platform edges 3–6 mm; column fillets and flute edges 1–3 mm; frame mouldings 1–2 mm; glass lips are rounded in the profile itself (§4.3).
  - `segments`: 2–3 for focal edges, 1 for mid-poly.
  - `profile=0.5` is circular. `limit_method='ANGLE'`, `angle_limit` 30°. `use_clamp_overlap=True`. `miter_outer='MITER_ARC'`.
  - `harden_normals=True`. The manual: it "requires custom split normals … a custom_normal attribute will be created" automatically.
  - Use `limit_method='WEIGHT'` with the `bevel_weight_edge` attribute for hand-picked edges.
- **Weighted Normal after Bevel.** `mode='FACE_AREA'`, `weight=50` (uniform), `keep_sharp=True`. Optionally set Bevel `face_strength_mode='FSTR_AFFECTED'` together with WN `use_face_influence=True`. Faces must be smooth-shaded.
- **Stack order for props.** Mirror(clip) → Boolean(s) → Bevel → Weighted Normal → Smooth-by-Angle. Triangulate (`keep_custom_normals`) only at export or bake, and identically for both so normal maps stay in sync.
- **SubSurf.** Only when curvature continuity is needed. Hold edges with support loops at 1–5% of the face width. Creases do not survive engine export.

### 4.3 Vessels (amphorae, decanters, column shafts): lathe a **resampled, closed cross-section** **[V]**

Tested in `vessel_recipe_test.py` (v1) and `vessel_recipe_test_v3.py`. Comparison image: `/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/research-a-out/vessel/compare_v1_v3.png`.

- **v1: 12 hand-typed (r, z) points, spin 48, Solidify 4 mm.**
  - It was manifold and only 3.3k tris, but the silhouette was visibly polygonal. This is the "primitive-y" look, and no shading can fix it.
- **v2: densified profile, still Solidify.**
  - Solidify 4 mm folded inside the 4–8 mm foot ring. My bmesh/BVH validator caught **120 intersecting face pairs and 64 zero-area faces**.
  - Rule: Solidify thickness must stay below half the smallest feature size. Otherwise model the wall explicitly.
- **v3 (passes): 0 non-manifold, 0 boundary, 0 self-intersection, UV layer present, 15.2k tris, 344 KB GLB.**
  1. Interpolate the profile control points with a centripetal Catmull-Rom spline (6 samples per segment), keeping only the design corners sharp (the foot ring).
  2. Offset the outer wall inward along 2D normals by the glass thickness (3.5 mm) to get the inner wall.
  3. Add a thick flat floor (z = 12 mm), with its radius clamped inside the outer wall. An earlier attempt intersected because of this corner.
  4. Close the lip with a half-circle arc, radius = wall/2, for a real rounded rim.
  5. Spin the closed loop with `bmesh.ops.spin(use_merge=True)` and `remove_doubles`.
  6. Mark a seam on one meridian **before** spinning, then `uv.unwrap`.
  7. Run `shade_auto_smooth(35°)`.
- **Triangle budget:** ≈ 2 × radial_steps × profile_points. For mobile, use about 40 steps × 60 points ≈ 5k tris.
- **Screw modifier alternative:** `steps` and `render_steps`, `use_merge_vertices`, `use_normal_calculate`. "Stretch UVs" only works "when UVs are present", and profile edges have none. (manual, …/generate/screw.html)

### 4.4 Handles, frames, arches, booleans

- **Handles.** A Bezier curve with `bevel_depth`, `bevel_resolution`, `resolution_u`, `use_fill_caps`, and taper through per-point `radius`.
  - **[V]** The glTF exporter writes curves as meshes, and `object.convert(target='MESH')` produces a UV map.
  - Sink the ends 2–5 mm into the body, or Boolean-union and then bevel the join.
- **Arches and mouldings.** Extrude the profile (`profile_extrude`) or use a curve with a profile bevel object. Origins go on grid corners so kit pieces snap (majidmanzarpour).
- **Booleans.**
  - Solvers: EXACT is the default and robust; MANIFOLD is fastest but needs manifold inputs; FLOAT is legacy. https://docs.blender.org/manual/en/5.2/modeling/modifiers/generate/booleans.html
  - Put cutters in a hidden collection (`operand_type='COLLECTION'`) and extend them past the surface to avoid coplanar faces.
  - Afterwards: Bevel, merge by distance, `dissolve_degenerate`, triangulate n-gons on curved faces, and run the manifold check.

### 4.5 Mesh validation snippet (bmesh on the **evaluated** mesh) **[V]**

`obj.evaluated_get(depsgraph).to_mesh()` → `bmesh.from_mesh`. Checks:

- `e.is_manifold`, `e.is_boundary` and `e.is_wire` counts;
- loose verts (`not v.link_edges`);
- `f.calc_area() < 1e-10`;
- n-gons;
- self-intersections via `BVHTree.FromBMesh(bm).overlap(itself)`, excluding face pairs that share a vertex;
- `mesh.validate()`.

Hard-fail on intersections (cracked glass) and on non-manifold edges in anything that should be closed. In `validate.py` (majidmanzarpour), negative scale, a broken triangle budget and missing UVs fail; unapplied scale, doubles and ngons warn. Also check dimensions against the brief (§2.2).

### 4.6 UVs, texel density, baking, LODs

- **UVs.**
  - Props and hard surfaces: Smart UV Project at 66° (radians!) with `island_margin` around 0.02.
  - Lathed vessels and hero parts: seams, then unwrap. Follow with `uv.average_islands_scale` and `uv.pack_islands(margin=…)`.
  - Verify with a checker-material render.
- **Texel density.** There is no standard. Maxon's example values: 10.24 px/cm for first person, 5.12 for third person, 2.56 for top-down. Mobile usually goes lower. Pick one value per asset family. https://help.maxon.net/c4d/en-us/Content/html/Texel_Density.html
- **High→low bake, Cycles CPU headless.**
  - Requires a UV map and an active Image Texture node (manual).
  - `use_selected_to_active`, then either `cage_extrusion` (≈0.02 m at character scale; scale it to the asset) or `max_ray_distance`.
  - `margin` 16 px with `margin_type='EXTEND'`; tangent space; samples ≈64 for AO.
  - Colour space: sRGB for base colour, Non-Color for everything else. https://docs.blender.org/manual/en/5.2/render/cycles/baking.html
  - Join the high-poly pieces to save memory; hide renderables that do not take part, except for AO (majidmanzarpour `bake_maps.py`).
  - Exclude glass shells from the bake sources.
- **LODs.** Decimate COLLAPSE, then fix silhouettes by hand. DISSOLVE (planar) works well on architecture. Voxel remesh at about 1/200 of the height fuses organic blockouts. **[V]** QuadriFlow (`object.quadriflow_remesh`, `target_faces`) is available.

### 4.7 glTF for three.js r185 (Capacitor) **[V]** (Blender 5.2.2 exporter, 110 options)

- **`export_apply=True`.** The default is **False**. Without it, Bevel, Weighted Normal, Smooth-by-Angle and Solidify results are not exported.
- **Compression.** `export_draco_mesh_compression_enable` or `export_meshopt_compression_enable` (EXT\_ or KHR_meshopt). Textures: `export_image_format='WEBP'` (options AUTO/JPEG/WEBP/NONE). `export_yup` defaults to True.
- **Double-sided.** **[V]** `material.use_backface_culling=True` makes `doubleSided:false`; the default exported `doubleSided:true`. Closed glass vessels should be single-sided.
- **Glass.** **[V]** Transmission and IOR export as `KHR_materials_transmission` / `_ior`.
- **Glass volume bug.** **[V]** `KHR_materials_volume` did **not** export in my 5.2.2 tests: Volume Absorption plus a "glTF Material Output" Thickness socket, with either a default value or a linked Value node. The manual documents exactly that route (https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).
  - Root cause, traced: the exporter evaluates an inlined copy of the node tree (`InlineShaderNodes`) that no longer contains the group node. `export_volume()` returns the correct dict when called on the raw material.
  - Occlusion through the same group **did** export.
  - Workaround: set `thickness`, `attenuationColor` and `attenuationDistance` on `MeshPhysicalMaterial` after loading (thickness is in mesh space; 0 means thin-walled), or post-process with glTF-Transform. https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- **Loader setup.** GLTFLoader supports Draco, meshopt (EXT and KHR), KTX2/basisu, WebP/AVIF, transmission/volume/ior/dispersion, and GPU instancing, but each decoder must be registered explicitly. https://threejs.org/docs/pages/GLTFLoader.html
  - KTX2 needs glTF-Transform; Blender cannot write it.
- **Cost.** MeshPhysicalMaterial has a "higher performance cost, per pixel". Budget the number of transmissive vessels on screen for mobile.

---

## 5. Render-and-critique QA loops

### 5.1 What the evidence says about the loop

- **3DCodeBench** (DeepMind, Blender 5.0, 12 VLMs). https://arxiv.org/html/2606.01057
  - Failures "mostly arise from API mismatches, while successful renders still suffer from disconnected or floating 3D geometric components".
  - Coding-agent harnesses (including Claude Code) mostly fix executability. Conditional shape quality barely moved (SigLIP −0.010, Chamfer +0.001). "it does not yield … more shape-accurate geometry once a script compiles."
  - **Conclusion:** geometry quality has to come from the validators and the reference loop, not from more autonomy.
- **BlenderGym** (CVPR 2025). Even the best VLM systems struggle where human Blender users find tasks easy. Inference compute should be split deliberately between generation and **verification**. https://arxiv.org/abs/2504.01786
- **VLM verifiers are biased toward accepting (high recall, low precision).** **[secondary, via https://github.com/Ladvien/blended]** That doc also reports refinement saturating after about 3 rounds (Planner-Actor-Critic, arXiv 2601.05016); its abstract does not state that **[U]**.
  - Design implication: numeric gates (IoU, width bands, validators, budgets) decide acceptance. The VLM critic is a wide net, and the skill should cap rounds and then escalate.
- **devtalk (3D-Agent).** "Sending a viewport screenshot back to the model after each operation was the single biggest quality improvement." https://devtalk.blender.org/t/3d-agent-blender-ai-assistant-built-a-multi-agent-system-on-top-of-blenders-mcp-and-python-api-and-sharing-architecture-learnings-for-the-lab-discussion/44260

### 5.2 View set and passes (all scriptable headless)

- **Fixed views.** front, side, back, top, three-quarter, plus the **reference-matched camera** (azimuth, elevation, lens; 0 = orthographic) and a **gameplay-size** render (e.g. 128 px). Add 8-frame clay turntables, and 12-frame material turntables with a moving light (majidmanzarpour `review_render.py`).
  - Lay them out as one contact sheet with Pillow. Images stay in context, so keep them around 384–768 px.
- **Clay/matcap.** Workbench `light='MATCAP'`, `studio_light='clay_studio.exr'`. **[V]** 27 matcaps ship with 5.2, including `hard_surface_grey.exr` and `check_rim_dark.exr`. Use the Standard view transform for comparisons.
- **Silhouette masks.** Transparent film plus alpha, or flat black. Compare like with like: not a wireframe reference against a beauty render (cc-blender-skill).
- **False-colour part IDs** **[V]** (`id_measure_probe.py`; output `/tmp/claude-0/-home-user/09fd91dd-ade6-55af-8845-f2413f485d64/scratchpad/research-a-out/idprobe/id_front_raw_annotated.png`).
  - Workbench `light='FLAT'`, `color_type='OBJECT'`, one hue per part, `display.render_aa='OFF'`, and **`view_transform='Raw'`**. With Standard, (242,36,36) rendered as (249,105,105) and colour lookup failed.
  - Then project landmarks with `bpy_extras.object_utils.world_to_camera_view` to draw dots, and print sizes in millimetres. Per-part pixel coverage gives part-level IoU against SAM-segmented reference parts.
- **Wireframe.** Use a temporary Wireframe modifier (`use_replace`), or mcp-for-blender `look(shading='wireframe')`. Google's critic always includes one.
- **Tests for the reviewer.** Greyscale plus blur (value hierarchy), target-size thumbnail, scale dummy, contacts and penetration (asset-studio).

### 5.3 Metrics

- **IoU.** Bbox-aligned IoU plus **10-band width profile** for shape; **world-registered IoU** for scale and placement (majidmanzarpour). The band profile maps directly onto lathed vessels, columns and decanters.
- **Gates.** See §2.1/§2.2: ≥0.85 blockout / ≥0.90 forms; bbox centre ≤1.5%; bbox size ≤3–5%.
- **DINOv3 / SigLIP-2 similarity** across matched views.
  - In 3DCodeBench, SigLIP-2 view similarity predicts human Elo with Pearson r=0.964, and DINOv3 has the highest rank correlation, Spearman ρ=0.972.
  - These are **model-level** correlations; per-asset reliability is unproven.
  - DINOv3 ViT-S/16 is 21M parameters, gated on Hugging Face under the DINOv3 License. https://huggingface.co/facebook/dinov3-vits16-pretrain-lvd1689m
  - Patch tokens give a similarity heat map that shows _where_ render and reference differ. That use is my proposal and is not validated **[U]**.
- **SAM 3** (Meta, 2025-11-19; text/exemplar "concept" segmentation; SAM 3.1 from 2026-03-27).
  - Ultralytics lists about 474M parameters and a 3.45 GB checkpoint; Voxel51 says about 848M. Weights are gated on Hugging Face.
  - Ultralytics benchmarks it at about 30 ms per image on an H200 and about 2.9 s on an RTX PRO 6000. https://docs.ultralytics.com/models/sam-3
  - CPU speed is unknown **[U]**. Use it once per reference to cut part masks (e.g. "handle", "stopper"). For plain-background concept art, corner-colour thresholding (as in compose_review) is enough.

### 5.4 Keeping it cheap on CPU-only machines **[V]** (4 threads, 512 px, llvmpipe)

| Pass                         | Time                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| Workbench studio             | 1.07 s (first render includes warm-up)                        |
| Workbench matcap             | 2.2 s                                                         |
| Workbench flat/random        | 0.7 s                                                         |
| **4-view 384 px clay sheet** | **0.8–0.97 s total**                                          |
| EEVEE, 16 spp                | 13 s, and it rendered the glass **black** at default settings |
| Cycles CPU, 16 spp + OIDN    | 8.5 s                                                         |
| Cycles CPU, 64 spp           | 20 s                                                          |
| Cycles clay override, 16 spp | 4.2 s                                                         |

- Workbench and EEVEE **do** run in plain `blender -b` without a GPU here, through Mesa llvmpipe (OpenGL 4.5). A container without Mesa/EGL would need Cycles. majidmanzarpour advises `--engine cycles` for GPU-less Linux.
- **Policy:**
  - Workbench for every geometry gate (silhouette, ID, clay, wireframe, turntable).
  - Cycles CPU at 8–32 spp with denoise only for glass and material checks.
  - Skip EEVEE on CPU.
  - Do the final look check in **three.js itself** with headless Chromium (software WebGL), because Cycles glass is not three.js transmission. Asset-studio: renders from another renderer "do not substitute" for in-app evidence.

---

## Flagged or unverified

- I could not get the cathedral video transcript; the loop details come from its description and secondary summaries.
- The AI Studio guide text was only available through search snippets and Traictory.
- Multi-agent single-`.blend` plugins: none vetted.
- mcp-for-blender under Xvfb: not tested.
- SAM 3 on CPU: speed unknown.
- DINOv3 per-asset gating: unvalidated.
- "~3-round saturation" and the verifier-bias numbers: secondary.
- StraySpark tool counts: a vendor's own figures.
- Blender minimum version for the connector: 4.2 per Academy vs 5.1 per the manifest.
- The KHR_materials_volume export failure was reproduced only on 5.2.2. It may be fixed later; re-test.

---

## Top 15 techniques to put in the skill (ranked by expected impact on asset quality)

1. **Reference contract first.** A brief with measured proportions, real scale, parts, 3–5 silhouette features and an INFERRED list. Every constant cites a source view.
2. **Silhouette gate before detail.** Render at the reference camera and at gameplay size. Gate on bbox IoU plus 10-band width profile, and world-registered IoU (≥0.85 blockout, ≥0.90 forms). No detail until it passes.
3. **Build from measured profiles, never raw primitives.** Spline-resample lathe profiles and keep only the designed corners sharp. Lathe closed wall cross-sections (real glass thickness, thick base, rounded lip). Extrude arch and moulding profiles. Use curves for handles.
4. **No perfectly cut edges, with numbers.** Bevel width 0.5–2% of the part (mm-scale), 1–3 segments, ANGLE 30°, clamp overlap, harden normals, then Weighted Normal (FACE_AREA, keep_sharp) and Smooth by Angle. Use the 4.1+ API.
5. **Separate maker and adversarial critic.** The critic sees only the brief, references and fresh renders. Fixed 4–6 view sheet plus wireframe. ≥3 named flaws. Issues recorded as reference → candidate → difference → executable fix with units. A cap on rounds; switch method after 2 non-improving tries.
6. **Numeric validators as hard gates.** On the evaluated mesh: non-manifold, boundary, zero-area, n-gons, BVH self-intersection, floating parts, contacts and penetration, dimensions, triangle budget, UVs. The VLM is never the acceptance gate.
7. **Pinned Blender version plus an API-drift table** (§4.1), asserted at session start. Look nodes up by type; use the official MCP's bundled API search.
8. **Headless, reproducible phase scripts.** Each `build/NN_phase.py` opens the master, rebuilds what it owns and saves, so any phase reruns cleanly. Use MCP or screenshots only for targeted live edits.
9. **False-colour part-ID passes.** Workbench OBJECT colours, Raw view transform, AA off. Project landmark dots and mm labels, compute per-part coverage, and use multi-angle close-ups of the joins.
10. **Cheap CPU render policy.** Workbench for all geometry gates (about 1 s per sheet); Cycles CPU at low spp only for glass; final look check in three.js through headless Chromium.
11. **Mistakes log turned into skill patches** (cc-blender-skill autoloop). Freeze, capture evidence, classify, patch the generic rule, then repair. Never tune lights to hide geometry.
12. **Geometry economy by projected pixels.** Details under 4–6 px at the closest view go to normal or AO bakes. Cylinder sides by screen size. Count exported triangles. Set mobile budgets per asset class.
13. **Correct three.js export.** `export_apply=True`, single-sided glass, WebP plus meshopt or Draco, transmission and IOR checked in the GLB JSON, and volume (thickness/attenuation) set in code until the exporter is fixed. Re-import the GLB and compare against the master renders.
14. **Generated "donors" only as references.** Meshy, TRELLIS or Tripo output goes to the REF layer, Shrinkwrap or bake targets. Rebuild clean topology and UVs. Exclude glass shells from bakes.
15. **Placeholders and kit calibration first.** Greybox lineup at relative scale inside the gameplay scene (columns, arches, platforms on one grid, with a scale ruler) before final art. Look-calibration (colour/HSV) comes last, after geometry and UVs pass.
