# Cloudway court presentation

This follows the recipe-compatibility work on a separate branch. PR #1087
remains open on its reviewed head; this presentation pass does not change its
generator, compiler, level contracts, saved recipes or collision.

## Gate wings

Generated stone court wings now have a tapered return extending 0.65 m below
the floor datum. The return connects to an actual persistent Pearl slab rather
than appearing to float beside it. Above-floor geometry stays identical to the
original box. Each wing retains one mesh and material and adds four triangles.
Moving, conditional, polygonal and parented candidate supports retain the
ordinary box presentation.

The visual-clearance test covers 400 mixed seeds and the 16 fixed v1 recipes,
each rotated through four cardinal headings. It checks the complete added
below-floor envelope against intact platform-art bounds and moving swept bounds. Only the
actual supporting slab is exempted for the intentional structural join. No
foreign intersection was found in those 1,664 layout orientations. These are
bounded generated examples, not a proof for every possible recipe.

## Pearl court joins

Full-edge, coplanar, permanently static Pearl neighbors now trim only their
overlapping donor overhang. Exterior endcaps and original vertex attributes are
retained; cut vertices interpolate UVs, normals and tangents. The adapter does
not shrink the donor or cover seams with an overlay. Fifteen downward rays
across the actual fitted donor's contact area find the same top surface before
and after clipping.

Each observed edge mask uses one indexed instanced draw. Variants share one
extended attribute pool, with explicit cleanup on failed installation and
repeated renderer teardown. Bounds are conservative, and the existing culling
and original platform definitions remain in use.

This removes geometric overlap, not the repeated gold rows or medallions baked
into the artwork. A continuous court artwork variant remains a later visual
improvement; changing v1 routes to hide the repetition would break compatibility.

## Measured cost and verification

Matched AMD RX 9070 XT captures use the actual compiled `shared-pearl` course,
test fixtures with a saved checkpoint and completed prior exhibits, and
automatic cameras at two gates.
Phone 390×844, tablet 768×1024 and landscape 844×390 all render without GL or
page errors. Additional underside cameras inspect the returns; those diagnostic
views are not player camera behavior. Checkpoint seeding is not a full playthrough.

In these six matched player views, normal scene draw calls increase by six
(65→71 at gate one on phone, 61→67 at gate two). Submitted triangles decrease
from 9,820,906→8,393,782 and 4,430,980→2,355,156 respectively. Shadow-pass frames
are recorded separately in the receipt. Whole-scene resident CPU geometry array
bytes increase from 103,849,796 to 108,625,392 (+4,775,596 bytes, about 4.6 MiB);
this is not a VRAM measurement. Resident geometry count changes 448→451 and
texture count stays 51. Desktop frame pacing does not establish iPhone GPU cost.

The normal emitted production app also passes an actual Games → Little
discoveries → Launch expedition check in all three viewports: AMD renderer,
expected saved checkpoint, zero GL/page errors, failed asset requests or
horizontal overflow. The build retains production diagnostics boundaries and
serves unchanged public assets read-only without copying them. No development
route or forced development emission is used.

Focused geometry, real-donor, batching, lifecycle and compatibility tests pass;
the existing camera, resource-budget, culling and geometry suites pass 206 tests.
The 16 fixed raw and compiled v1 signatures remain unchanged. Independent source
review and its 43-test rerun have no remaining findings. The affected workspace
typecheck, preparation and code-health ratchet pass without changing the metrics
baseline. Physical iPhone appearance and performance remain owner checks.

Evidence is in the registered `cloudway-gate-court-visuals` agent-out run for
2026-10-22. Its receipts distinguish the matched diagnostic capture, normal
production host and synthetic clearance proof. No asset files were added or
changed, and this work is not a native delivery or merge of PR #1087.
