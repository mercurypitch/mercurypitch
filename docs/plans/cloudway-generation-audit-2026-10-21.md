# Cloudway generation and sharing audit

Scope: procedural courses, authored course integration, runtime traversal checks,
and sharing in PR #1087. This pass preserves the Archive and museum changes on
main. It adds no binary assets or native delivery.

## Reproduced problems and repairs

| Priority | Finding                                                                                                                                                   | Repair                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Platform contact rectangles excluded visible artwork. Adjacent Pearl slabs intersected by about 0.168 m; raised and branching pieces could intersect too. | Check measured intact artwork and 3D swept motion as well as contact volumes. Reject unintended intersections and unknown profiles. Report explicitly authored, coplanar Pearl court seams separately as a remaining decorative limitation. |
| P1       | A turning deck let Merc walk around a locked singing gate. The ordinary court was also wider than the stock gate frame.                                   | Move turns beyond the gate and give procedural courts visible side walls with matching collision. Apply the same repair to the authored rise gate after reproducing its side bypass. Verify closed and completed gate traversal separately. |
| P1       | Chunk placement ignored the entry socket transform; optional alcove array order could select the wrong exit platform.                                     | Use explicit entry/exit platform identities, socket position and facing, and rotated motion vectors.                                                                                                                                        |
| P1       | The generator discarded its gap declarations.                                                                                                             | Measure connections from compiled platform geometry and relevant moving/extended states. Send compatible flat gaps through the public compiler; retain elevated and diagonal connections as explicit traversal obligations.                 |
| P1       | Failed generation could silently replace a long melody with a three-station fallback. Search had no work limit.                                           | Bound candidate search, reject exhaustion, require every requested station and the finale, and use the same bounded compiler as studio imports.                                                                                             |
| P1       | A solver accepted a note from the wrong height and called an unreached barrier secure.                                                                    | Use runtime interaction eligibility and continuous input replay. Require a supported downstream landing for a crossing witness. An exhausted finite search is inconclusive, never a security certificate.                                   |
| P1       | Generic floor seam changes allowed a shallow step across a real void or between disjoint convex footprints.                                               | Require actual footprint connectivity while retaining the tested coplanar floor seam fix.                                                                                                                                                   |
| P2       | Four-digit course IDs could mix progress between different recipes. Changing only a title shifted generation; the living-crystal switch was ignored.      | Use a versioned identity derived from the complete normalized recipe, keep author labels independent of random draws, and honor switches.                                                                                                   |
| P2       | Copied links depended on the current host and did not reliably recreate all settings in native builds.                                                    | Add a bounded, versioned course code with strict decoding, explicit import, clipboard fallback and validated recipe persistence. Imported codes cannot override campaign identities.                                                        |
| P2       | Eager default generation ran when the Creator gallery loaded.                                                                                             | Generate only on launch, contain errors, and preserve access to other studies.                                                                                                                                                              |

## Verification boundaries

The regression suites cover rejected inputs, complete lesson construction,
determinism, public-document round trips, platform geometry, continuous runtime
probes, and sharing controls. A generated document passing these checks is not
proof that every route, ferry phase, singing sequence or camera view is playable.
Never turn a finite search with no witness into a `secure` result.

Known decorative Pearl court seams remain visible and are reported as notices.
Their authored contact surfaces stay intact; shrinking the art into a smaller
support footprint would create an invisible ledge. Separate or raised platforms
do not receive this seam exemption.

## Local evidence from this repair

- 384 focused geometry, generation, solver, collision, movement, authored-course
  and fog tests pass. Geometry cases include all chunk variants at four quarter
  turns, standing headroom, swept motion and gate-wing clearance. Eight donor
  assets are checked by byte size, SHA256 and actual renderer-fitted bounds.
- 400 numeric seeds across the four melody lessons generated complete courses
  without geometry errors or search failures. The largest had 207 platforms.
  This Node CPU sample took 14.64 seconds total; the slowest generation was
  350 milliseconds. These timings are not phone measurements.
- 54 Creator gallery and standalone units pass. Four real-host browser cases
  cover 320/390/768-pixel touch layouts, clipboard denial, persistence and course
  identity through import and launch. The initial narrow-layout failure was
  reproduced before fixing the grid sizing.
- The original three later-showcase reachability tests used fabricated spawn
  states without prerequisite progress. Their replacements restore actual saved
  checkpoints and melody identities and successfully start the requested
  encounters after replay. They prove local checkpoint legs, not a full route.
- Two recorded 864-tick walking routes bypassed the authored rise gate without
  singing. Both now stop upstream, grounded, without respawn; a separate control
  still traverses the opened center passage. The unchanged return gate has no
  supported bypass witness in the sampled routes, which remains inconclusive.
- Independent reviews cover the geometry, generator/search, sharing and
  solver/collision changes. No rendering budget or binary asset changes are
  included.
- A real compiled-course capture shows a new stone wing and the court floor.
  Its gate junction is offscreen. Centered captures stalled under software
  rendering and the canvas fallback was blank, so junction alignment is not a
  passed visual check. Temporary render probes were stopped.

A plain Node strip-only solver import still encounters an existing extensionless
import in the shared engine graph. The Vite/package checks above do not establish
standalone Node or native execution of that tooling.

## Next verification and repair priorities

1. Produce continuous spawn-to-exit witnesses for the curated recipes, completing
   singing interactions through the real game state. Cover moving-platform
   departure phases and the timing differences between difficulties.
2. Inspect generated turns, gate approaches and elevated crossings in phone and
   tablet views. A collision-free volume can still block the camera or hide the
   next landing.
3. Replace repeated Pearl decorative seams with a matched continuous-court art
   treatment, preserving visible support and the existing movement contract.
4. Measure generation and traversal on the owner's iPhone. Local CPU timings and
   browser rendering cannot establish native performance or physical usability.
5. Freeze the recipe version before release. Any future change that changes the
   generated route must use a new generator version or retain the old recipe
   interpreter so shared courses and saved progress stay reproducible.

CI is authoritative for the full PR gate. Physical iPhone acceptance is separate.
