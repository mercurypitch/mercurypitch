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

The initial pass removed geometric overlap, but left repeated gold rows and
medallions baked into the artwork. The subsequent artwork pass below replaces
those inboard surfaces without changing v1 routes.

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

## Continuous court artwork

Joined Pearl contacts now replace their inboard upper shell, including raised
medallions, with a flat marble surface at the original walking datum. A 20 mm
closure meets the retained shell. Exposed donor rims, terminal gold borders,
sidewalls and underside remain; isolated planks retain their complete original
artwork. Moving, conditional and polygonal platforms still use the original
presentation. Source GLB data and all raw/compiled v1 compatibility fixtures
remain unchanged.

The surface borrows the game's already loaded Warm Carrara maps. World-space
coordinates keep grain continuous across row boundaries and cardinal rotations;
vertical closure faces use their own face projection to keep valid normal-map
derivatives. Only the cloned material is newly owned. Texture objects stay with
their existing owner, and paired surface/shell geometry is released on failure
and renderer teardown. No new asset, LFS object or native download payload is
introduced.

Matched actual AMD captures compare head `28e23ada3` with this artwork at both
gates, phone, tablet and landscape. All six views have zero GL/page/console
errors and retain the automatic player camera. Relative to that baseline,
normal submitted calls increase by six, while triangles decrease by 127,916
at gate one and 165,028 at gate two. Resident CPU geometry arrays decrease by
145,452 bytes to 108,479,940; geometry count is 454 and texture count remains 51.
The added calls are explicit; desktop captures do not establish iPhone performance.

Focused coverage checks actual-donor row and medallion removal, source
immutability, exact clipping area, all four joins under all four rotations,
paired batching/visibility and material ownership. Normal emitted-production
main-host captures cover phone, tablet and landscape. Local WebKit could not
start because its required ICU library is unavailable, so it is not counted as
verification. Physical iPhone appearance and performance remain owner checks.
The registered `cloudway-continuous-pearl-art` run contains the matched images,
measurements and final review receipts.

The initial focused seven-file pass covered 46 cases. After independent review
added a failure after one completed shell/surface pair, the final five-file
ownership and renderer pass covered 23 cases. Both passed, as did preparation,
the Beside Cue workspace typecheck and metrics without baseline adjustment.
These case counts overlap and are not a combined total. Independent final
source and captured-runtime review found no blocking issue.
