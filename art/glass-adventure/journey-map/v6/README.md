# Floating Museum V6 — connected halls and botanical conservatory

This batch follows the accepted actual-Merc loading screen. Scope and acceptance
checklist: [museum polish batch 4](../../plans/FLOATING-MUSEUM-POLISH-BATCH-4.md).
The three-island composition, routes, labels, saved stars/portraits and water are
retained. New architecture uses original ChatGPT guides, Meshy models and Blender
finishing; the game shares the same asset IDs across web and native hosts.

## Source archive

- `sources/*guide*.png` and matching prompt Markdown: original guides. The opaque
  connector guide is the Meshy input; its earlier transparent rendition is retained.
- `meshy/*-final.glb`: original compact textured Meshy outputs.
- `meshy/*-pre-remesh.glb`: original high-resolution sources, preserved separately.
- `meshy/*-receipt.json` and `meshy/tasks.json`: task IDs, hashes and actual charges.
- `sources/floating-museum-architecture-kit-v6.blend`: packed editable production
  project. Production textures are retained under `sources/textures/` as well.
- `exports/floating-museum-architecture-kit-v6.{glb,json}`: normalized runtime kit
  and fresh-reimport audit. The public game copy must match the recorded SHA-256.
- `production/`: reproducible archive, source audit, Blender build/render and
  compiled-browser capture scripts.

The two image-to-3D tasks cost **60 credits total** (30 each), leaving **4,000**
after this batch. No rigging was required for these static map buildings. The
Conservatory native download stalled with incomplete bytes; bounded artifact
range downloads recovered the existing output without another generation. No
credentials or signed artifact URLs are retained.

## Runtime review

Runtime screenshots, rendering counters and visual acceptance are recorded in
`proofs/runtime/`. The 5,628,320-byte runtime kit adds 41,129 source triangles;
its public copy matches the export SHA-256
`32143c948457c0c8acef7c9b6a9f977874e131c59dd3b19bcc7d6f71ff23e5be`. Isolated Blender renders
and geometry audits establish source quality, not appearance inside the game or
physical-device frame rate. Software-renderer timings are not a phone/tablet
performance claim.

## Rebuild and inspect

Run the production scripts from the repository root with a bounded timeout:

```sh
rtk proxy timeout 300 python3 art/glass-adventure/journey-map/v6/production/archive_meshy_tasks.py
rtk proxy timeout 300 blender -b --factory-startup --python art/glass-adventure/journey-map/v6/production/build_architecture_kit.py
rtk proxy timeout 600 blender -b --factory-startup --python art/glass-adventure/journey-map/v6/production/render_architecture_proofs.py
```

The archive command reads the existing authenticated Meshy MCP launcher; it does
not create or charge for new work. Browser capture supports `JOURNEY_PROOF_URL`,
`JOURNEY_PROOF_CASE` and `JOURNEY_PROOF_OUTPUT_URL`. Its default is the separate
V6 localhost HTTPS preview on port 5297. Port 5296 is the previous stable snapshot.

## Cost comparison

| View                        | V5 draws / rendered triangles | V6 draws / rendered triangles |
| --------------------------- | ----------------------------: | ----------------------------: |
| Desktop and tablet overview |                 196 / 383,855 |                 264 / 614,327 |
| Narrow First Light phone    |                 151 / 338,180 |                 137 / 337,237 |

The new physical canopy transmission contributes an opaque-scene render pass.
These counters include render passes; they do not measure unique geometry or
physical-device FPS. The phone view culls the Conservatory. Sustained full-map
and close-canopy tablet performance remains an owner acceptance check.

## Verification and owner test

Twelve compiled views passed with no page/console errors or horizontal overflow:
four destinations, tablet, phone, earned desktop/phone, and both buildings from
front and oblique inspection angles. The initial long-lived capture browser
exited after nine views; its protocol/context failure record is preserved in
`proofs/runtime/attempts/long-session.json`. The remaining three cases passed
individually in fresh browser processes. `proofs/runtime/manifest.json` combines
only successful, hash-verified captures and links each retry record.

Focused runtime/resource tests, shared/mobile typechecks and both host builds
passed. Both staged host assets match the production hash. Independent review
accepted the open apertures, facade placement, portrait/route clearance and
Merc grounding. Physical-device performance remains separate.

The campaign browser load contract was updated to include the V6 lobby model;
it still rejects premature level-asset loads. All four campaign tests passed
after the strict allowlist correction discovered by CI.

Test the HTTPS campaign on port 5297: select all destinations, zoom/orbit the
Twin connector and Conservatory, inspect the ivory marble and Merc's medallion
placement, then enter a level through the animated loader. Source and runtime
checkpoints are `3f1354ad` and `87677aea` in PR #807. No HMR is enabled.
