# Floating Museum conservatory V8 source gate

Status: source-prepared only. No V8 Meshy task has been submitted, no credits
have been charged, and no candidate, PBR pass, Blender candidate source, combined
runtime export, or public asset has been produced.

This folder isolates the conservatory repair from the approved V7 connector. The
intended sequence is one receipt-guarded provider remesh, same-camera CPU clay
review, one PBR retexture only after that review, exact Blender normalization,
fresh export/reimport validation, then a V8 combined derivative that preserves the
V7 connector byte-for-byte. Public installation and browser review are outside
this folder.

## Preserved source gate

The original V6 provider task is
`01a0c42e-51f6-77d1-85d5-1167fe7e5324`. Its archived
`pre_remeshed_glb` is preserved as
`meshy/raw/conservatory-pre-remesh-v6.glb`:

- 21,519,992 bytes
- SHA-256 `7f9eefd963e7fdb7b4d9863a4588ad293d3f8a17c27a68fd359306d647b5b6f4`
- 1,201,474 triangles and 591,793 vertices
- normalized review contract: 2.30 x 2.65 x 2.30 metres, ground anchor zero

The V8 copy is byte-identical to the V6 archive and to the hash in the V6 Meshy
receipt. The guide PNG and prompt Markdown in `sources/` are also byte-identical
copies of the V6 source records.

The CPU Cycles proofs show that the dense donor retains the gazebo ribs, roof
bays, garlands, planters, central urn, finial, open colonnade, and circular plinth.
The V6 22,870-triangle result retains only 1.9035% of the source triangles and
visibly collapses the roof relief, foliage, moldings, and column detail.

- `proofs/conservatory-preserved-pre-remesh-front-v8.png`
- `proofs/conservatory-preserved-pre-remesh-angle-v8.png`
- `proofs/conservatory-v6-remesh-front-v8.png`
- `proofs/conservatory-v6-remesh-angle-v8.png`
- `proofs/conservatory-source-audit-v8.json`

Rebuild the read-only source audit from the repository root:

```sh
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/audit_conservatory_source.py
```

## Provider reconciliation and blocked submission

A read-only provider check on 2026-09-23 listed no remesh or retexture task after
the archived V7 work. The newest remesh was
`01a0c93d-d575-745f-9f91-c7206c4bab5d`; the newest retexture was
`01a0c946-928b-70b7-b8e0-7019de0d936e`; both succeeded and already have V7
receipts. The observed balance was 3,880 credits. The interrupted V8 attempt
therefore left no unreceipted provider task.

The prepared V8 request is one triangle remesh at 110,000 target polygons, bottom
origin, GLB output, expected cost 5 credits. The script re-lists provider tasks and
saves a safe reconciliation before it can submit. It writes
`state: submission-unconfirmed` before the charged call, saves the returned task
ID immediately, and never retries a submission. Signed artifact URLs stay in
memory; receipts contain only task state, hashes, byte counts, and credit deltas.

The external command was rejected by automatic approval review before process
creation because sending the preserved conservatory source to Meshy needs a
specific user confirmation. Consequently there is no V8 receipt, task ID, upload,
or charge. Do not retry until that confirmation is present.

After confirmation, run exactly:

```sh
rtk proxy timeout 1200 python3 art/glass-adventure/journey-map/v8/production/run_conservatory_remesh.py
```

The remesh script uses the authenticated Meshy MCP launcher already present on the
machine. It obtains the original task's signed `pre_remeshed_glb` URL in memory,
requires the `assets.meshy.ai` host, and never reads, prints, changes, or stores a
credential or signed URL.

Once the archived remesh exists, render the review gate before any retexture:

```sh
rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/render_conservatory_geometry_comparison.py
```

That comparison script is prepared but has not run because the V8 candidate does
not exist. No runtime packer has been run or V8 export created. Binary formats in
this folder are covered by the local `.gitattributes` Git LFS rules.

## Local finishing preparation — 23 September

`production/finish_conservatory_candidate.py` is a prepared Blender step for a
future archived `conservatory-remesh-110k-retexture-pbr.glb` plus matching remesh
and retexture receipts. It is not evidence that a candidate or bake exists.
It retains the provider normal map and prepares a separate dense-donor normal
and AO bake for side-by-side review, with UV/PBR/export checks and a packed
editable source. Surface registration, cage projection and visible bake quality
must be reviewed on the real inputs before either variant is accepted.

The script parses and Blender 5.2.2 rejects the absent PBR input before producing
anything. The actual bake/export path remains unverified until a candidate
exists. Retexture submission, candidate render review, V7-preserving combined
runtime assembly and public installation are still outstanding.

The remesh producer now writes its returned task ID before checking the new
balance. An offline fault-injection check confirmed that a balance-read failure
retains the ID and a rerun polls that task without submitting another one.
Free-form provider error messages are omitted from archived status fields.

The checked-in normal-transform fixture passes in Blender 5.2.2 for flat and
custom slanted normals under rotated, nonuniform scale. It compares with
Blender's encoded representation of the independently calculated inverse
transpose; stored-normal quantization is about 0.00011 in this fixture. A
singular transform must fail before changing vertices. Run locally with:

```sh
rtk proxy timeout 90 env ALSOFT_DRIVERS=null blender -b --factory-startup --python-exit-code 1 --python art/glass-adventure/journey-map/v8/production/check_conservatory_normals.py
```
