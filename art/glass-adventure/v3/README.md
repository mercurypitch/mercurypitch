# Glass museum: Meshy production wave

The owner restored the existing Proton Pass CLI connection on 2026-09-15 and
requested Meshy source models, with Blender used for finalization. These are
versioned candidates. The running game retains v2 artwork while the owner tests;
the separately requested Merc jump animation fix is live in source previews.

## Durable sources

- `../v2/references/`: approved image references and reconstruction guides,
  manifests, exact prompts and SHA-256 checksums. The opaque guides communicate
  shape and gold regions; their clay finish is not the intended glass material.
- `../v2/meshy-ledger.json`: logical jobs, provider IDs, generation parameters,
  reference hashes, quoted costs and observed credit changes. This remains the
  single spending ledger; v3 does not duplicate it.
- `../v2/meshy/<job>/`: untouched remeshed `donor.glb`, high-detail
  `pre-remeshed.glb`, original PBR maps, provider thumbnails, redacted provider
  metadata and `archive.json` with file hashes. A receipt is complete only when
  all provider outputs selected for archiving are saved. Signed URLs are never
  treated as storage. Interrupted `.incomplete` files are diagnostic remnants,
  not accepted sources.
- Per-vessel directories here: packed raw-import Blender projects, inspection
  reports, repaired/final projects, candidate GLBs and actual render proofs.
- `architecture/`: architecture intake, immutable source copies, packed Blender
  projects, candidate exports and inspection evidence.
- `review.html`: a separate source / Meshy / Blender review gallery. Missing or
  rejected stages must be labeled; rendered previews are not integration proof.
- `model-viewer.html?asset=gilded-column`: local interactive inspection of actual
  archived GLBs, using the installed Three.js package and the museum environment.
  Orbit, zoom, reset, wireframe and original/final selection do not modify assets.
  Serve through the existing BesideCue Vite preview using its `/@fs/` path. It is
  an authoring tool, not a production application route.

Keep raw geometry and editable Blender files in this project alongside the game
that owns them. Dotfiles contains the plan and task ledger at
`personal/besidecue/glass-adventure/`; it links here rather than duplicating large
binary assets. These files are currently saved on disk, not committed or pushed.
Before a future authorized commit, check the file sizes and use repository large
file storage if any source exceeds the host's per-file limit; do not drop the
only editable source to make a push work.

## Intake and acceptance

1. Confirm a successful provider task and download the complete GLB atomically.
2. Preserve the raw Blender import and source hashes before any edits.
3. Inspect front, three-quarter, top and close detail views. Check mouth/cavity,
   actual surface connectivity, UVs, material regions, normals and proportions.
4. Repair the donor in Blender while preserving its silhouette and ornament.
   Do not substitute a procedural lathe or primitive model for Meshy output.
5. For glass, assign optical glass/gold materials and prepare matching closed
   fracture pieces. Preserve exterior UVs and material assignments. Export at
   most 24 numbered fragment assemblies with explicit counts in the manifest.
6. For architecture, optimize only after a side-by-side render inspection and
   retain the original. Pack all image dependencies in the editable project.
7. Validate exports, archive hashes, dependencies, canonical scale/pivot and
   actual Blender proof images. Only accepted candidates can be integrated.
8. Integration keeps encounter IDs, voice rules, course layout and current Merc.
   Game verification must follow any subsequent runtime changes.

## Reproducible archive

`archive_meshy.py <logical-job-name>` calls the existing Meshy MCP launcher for
read-only task data, then downloads the returned files without exposing signed
URLs. It never generates a model or mutates the credit ledger. Use a bounded
command, for example `rtk proxy timeout 600 python3 archive_meshy.py JOB` from
this directory. Existing archived hashes are checked before reuse. A network
failure can be retried without spending credits; a charged generation must
never be retried without reconciling its recorded provider task.

All seven generations succeeded: four glass families, column, arcade and pavilion.
This wave used 200 credits from a verified balance of 4,660; last balance 4,460.
All 73 selected provider outputs (374,645,417 bytes) are archived and independently
checked against their hashes, GLB lengths and complete image decoding. See
`archive-validation.json` and the single generation ledger for the exact record.
