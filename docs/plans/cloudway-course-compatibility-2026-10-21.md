# Cloudway course compatibility

PR #1087 is green on `e36501be662048c1a3ddcc6ac67d95ddeba97fec`:
77 successful checks, one intentional production-deploy skip, and the required
PR Gate passed. Owner review and physical iPhone acceptance remain separate.
This follow-up uses a separate branch and preserves that PR head.

## Compatibility contract

A v1 code stores the recipe, not the generated level. Its identity includes the
normalized settings, while generation uses the current chunk library, melody
profiles and compiler. Comparing two runs of the current generator only proves
same-build determinism. It does not catch an old shared code silently producing
a different route after an update.

The fixed v1 fixture was captured from the reviewed PR head. It contains 16
literal codes and identities, raw document and compiled-level SHA256 signatures,
and platform/checkpoint counts. Coverage includes all four lessons at three
difficulties, numeric and string seeds, Unicode, and disabled optional content.
Signatures ignore object property ordering but preserve array order and exact
numeric values. Compiled signatures include support, motion, challenge, camera
and profile defaults in addition to the raw generator output.

These fixtures are compatibility evidence for those recipes, not exhaustive
generation or playability proof. They freeze serialized course output, not
external asset bytes or global runtime physics. They must not be refreshed to approve a route
change under v1. A future v2 needs explicit version dispatch and retained v1
behavior, or a deliberately designed compatibility path for existing codes and
progress. Merely increasing the prefix would reject old codes.

## Stored recipe preservation

The Studio previously caught a stored-code decoding failure, showed default
settings, then immediately saved those defaults over the unreadable code. This
also affected future-version codes when opening an older build. The follow-up
preserves that original stored value until a deliberate valid settings change
or successful import replaces it. Passive visits, study navigation, copy/launch,
failed imports and incomplete edits do not replace it. Storage failures remain
contained so studies and the current course can still be played.

## Verification

- The fixed-code, earned-save and existing option suites pass 62 tests. A
  temporary in-memory walk-speed mutation fails all 16 route signatures;
  generator sources and fixture expectations were not changed for that check.
- The save regression earns progress from an unsaved course through ordinary
  input, independently replays the recorded inputs, and checks JSON restoration
  of its checkpoint, support, completed challenges and melody attempt. Numeric
  and string seed variants and changed difficulty reject that save. This is a
  current-build save round trip, not an archived old-build save migration.
- The Studio component suite passes 21 tests, including six preservation cases
  that failed before the fix. The Games-host browser suite passes 11 cases;
  the three new 320px, 768px and 1280px cases also pass with the longer
  clipboard-denied notice explicitly awaited before measuring containment.
- The emitted production app passes storage and notice checks in its actual
  Games host at 320×740, 768×1024 and 1280×900, with zero page errors, failed
  requests or horizontal overflow. First-run data came from an isolated test
  fixture; unchanged public assets were served read-only without copying.
  Selected screenshots were inspected. Normal scrolling reveals all notice
  text; the existing fixed CI stamp can overlap the bottom line at some scroll
  positions and does not block interaction. This is UI proof, not gameplay or
  native-device proof.
- The affected Beside Cue workspace typecheck, eight-file validation and code
  health ratchet pass without adjusting the metrics baseline. Independent
  source and final browser-test reviews have no remaining findings.

PR #1087 remains unchanged on the reviewed green head. This local follow-up
does not represent new CI, a native build or physical-device acceptance.

## Next visual pass

The gate wings need an underside support treatment while retaining their exact
above-floor collision. A tapered stone return can share the existing mesh and
material, but needs explicit presentation data, visual-clearance validation and
matched render inspection. Extra triangles and shadow coverage must be measured.

Repeated Pearl court ornament needs a dedicated continuous-court adapter.
Shrinking the donor art would expose unsupported-looking contact edges; opaque
seam strips would only conceal the overlap. Preserve the outer endcaps,
walkable faces, UVs and batching when developing that treatment. Neither visual
change is part of this compatibility follow-up.
