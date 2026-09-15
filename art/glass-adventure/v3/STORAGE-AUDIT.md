# Storage and asset audit

Snapshot: 2026-09-15T12:45:40.429671+00:00. Read-only audit while authoring continued. No archive, receipt, ledger, Git attribute or ignore rule was modified. The observatory-canopy job had no completed receipt at receipt enumeration and was skipped. Part/temporary files were excluded from receipt checks. Later completed work is outside this snapshot.

## Actual failures requiring replacement

- `art/glass-adventure/v2/meshy/aurora-coupe-01/texture_urls-0-base_color.png`: Truncated File Read
- `art/glass-adventure/v2/meshy/cut-crystal-decanter-01/texture_urls-0-base_color.png`: Truncated File Read
- `art/glass-adventure/v2/meshy/cut-crystal-decanter-01/texture_urls-0-normal.png`: Truncated File Read

These three PNGs match their recorded receipt SHA256 and byte size. Their saved payloads are nevertheless truncated. Pillow12.3.0 `verify()` plus a second open/full pixel decode, with truncated-image acceptance disabled, exposed the failures. A matching hash proves file identity, not image decodability. Root has the exact repair paths. Do not use these external maps for mask authoring until repaired.

The embedded images in their original Meshy GLBs decode successfully, so the intact model archives remain usable. This audit did not extract, replace or silently repair any image.

## Receipt coverage

| Completed receipt       | Referenced files |
| ----------------------- | ---------------: |
| aurora-coupe-01         |               11 |
| cut-crystal-decanter-01 |               11 |
| fluted-carafe-01        |                7 |
| garden-arcade-01        |               11 |
| gilded-column-01        |               11 |
| moon-amphora-01         |               11 |

- 62 referenced files: every SHA256 and byte size matches; no missing files or changes during audit.
- 47 standalone provider images fully decoded successfully;3 additional standalone images failed as listed above. This includes all receipt-listed texture channels and thumbnail images.
- 12 receipt-covered GLBs: magic/version/declared lengths and chunk boundaries passed; JSON chunks parsed. All 15 embedded images fully decoded.
- Additional header-only inventory across `art/glass-adventure` and v2/v3 public runtime directories: 21 GLBs; 21 passed. This additional inventory is not a geometry or finalization acceptance check.

## Git preservation and size

`git check-ignore --no-index -v --stdin` found no ignore rules for the 33 discovered `.blend`/`.blend1`/`.glb` source, donor and runtime files. New v2/v3 binaries are therefore not silently protected from staging by ignore rules. Existing generated Python `__pycache__` files are covered by the repository's `__pycache__/` rule. No new Git/LFS configuration was applied; current `.gitattributes` has no LFS patterns.

No file in the scoped art/runtime inventory exceeded100,000,000 bytes at this snapshot. Several original-import Blender files exceed50MB, and high-detail raw GLBs are approximately35MB each:

- `art/glass-adventure/v3/donors/fluted-carafe-high-source/raw-import.blend`: 55.06 MB
- `art/glass-adventure/v3/donors/moon-amphora-high-source/raw-import.blend`: 54.14 MB
- `art/glass-adventure/v3/donors/cut-crystal-decanter-high-source/raw-import.blend`: 53.43 MB
- `art/glass-adventure/v3/donors/aurora-coupe-high-source/raw-import.blend`: 53.24 MB
- `art/glass-adventure/v2/meshy/fluted-carafe-01/pre-remeshed.glb`: 35.75 MB
- `art/glass-adventure/v2/meshy/moon-amphora-01/pre-remeshed.glb`: 35.29 MB
- `art/glass-adventure/v2/meshy/cut-crystal-decanter-01/pre-remeshed.glb`: 35.24 MB
- `art/glass-adventure/v2/meshy/aurora-coupe-01/pre-remeshed.glb`: 35.12 MB
- `art/glass-adventure/v2/meshy/garden-arcade-01/pre-remeshed.glb`: 35.06 MB
- `art/glass-adventure/v2/meshy/gilded-column-01/pre-remeshed.glb`: 35.05 MB

All scoped art/runtime files together were approximately868.7 MB at inventory time. Repeated raw/model revisions would materially increase ordinary Git history even though no single current file exceeds100MB.

Recommended preservation decision before publication: retain immutable task/raw receipts and hashes; choose either Git LFS for source `.blend`/large raw GLBs or a durable versioned external asset archive with checked-in manifests and restore instructions. Keep only accepted optimized runtime outputs in the application public path. Preserve the original high-detail and textured donors regardless of later optimizations. Do not delete or rewrite historical source artifacts as a storage shortcut. Root/owner should choose the storage policy before any LFS or remote changes.

Detailed per-file machine report: `/home/maff/agent-out/beside-cue/2026-09-15/glass-v2/v3-storage-audit.json`. This document records the original failing snapshot; a later repair requires a targeted decode/hash check and receipt update by the archive owner.

## Repair follow-up — 2026-09-15

Root re-downloaded the three failed external PNGs through verified HTTP ranges. Prior receipts and rejected payloads remain preserved. All seven completed source receipts now cover73files/374,645,417bytes; every recorded byte size/SHA256 and every standalone image full decode passes. See `archive-validation.json`. The original failed snapshot above remains historical evidence, not current readiness.
