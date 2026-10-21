# Cloudway generation and sharing audit

Scope: procedural courses, authored course integration, runtime traversal checks,
and sharing in PR #1087. This pass preserves the Archive and museum changes on
main. It adds no binary assets or native delivery.

## Reproduced problems and repairs

| Priority | Finding                                                                                                                                                                    | Repair                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Platform contact rectangles excluded visible artwork. Adjacent Pearl slabs intersected by about 0.168 m; raised and branching pieces could intersect too.                  | Check measured intact artwork and 3D swept motion as well as contact volumes. Reject unintended intersections and unknown profiles. Report explicitly authored, coplanar Pearl court seams separately as a remaining decorative limitation. |
| P1       | A turning deck let Merc walk around a locked singing gate. The ordinary court was also wider than the stock gate frame.                                                    | Move turns beyond the gate and give procedural courts visible side walls with matching collision. Apply the same repair to the authored rise gate after reproducing its side bypass. Verify closed and completed gate traversal separately. |
| P1       | Chunk placement ignored the entry socket transform; optional alcove array order could select the wrong exit platform.                                                      | Use explicit entry/exit platform identities, socket position and facing, and rotated motion vectors.                                                                                                                                        |
| P1       | The generator discarded its gap declarations.                                                                                                                              | Measure connections from compiled platform geometry and relevant moving/extended states. Send compatible flat gaps through the public compiler; retain elevated and diagonal connections as explicit traversal obligations.                 |
| P1       | Failed generation could silently replace a long melody with a three-station fallback. Search had no work limit.                                                            | Bound candidate search, reject exhaustion, require every requested station and the finale, and use the same bounded compiler as studio imports.                                                                                             |
| P1       | A solver accepted a note from the wrong height and called an unreached barrier secure.                                                                                     | Use runtime interaction eligibility and continuous input replay. Require a supported downstream landing for a crossing witness. An exhausted finite search is inconclusive, never a security certificate.                                   |
| P1       | Generic floor seam changes allowed a shallow step across a real void or between disjoint convex footprints.                                                                | Require actual footprint connectivity while retaining the tested coplanar floor seam fix.                                                                                                                                                   |
| P2       | Four-digit course IDs could mix progress between different recipes. Changing only a title shifted generation; the living-crystal switch was ignored.                       | Use a versioned identity derived from the complete normalized recipe, keep author labels independent of random draws, and honor switches.                                                                                                   |
| P2       | Copied links depended on the current host and did not reliably recreate all settings in native builds.                                                                     | Add a bounded, versioned course code with strict decoding, explicit import, clipboard fallback and validated recipe persistence. Imported codes cannot override campaign identities.                                                        |
| P2       | Eager default generation ran when the Creator gallery loaded.                                                                                                              | Generate only on launch, contain errors, and preserve access to other studies.                                                                                                                                                              |
| P1       | The twin-ferry midpoint started collapsing before the second ferry returned. A late departure could succeed, but an ordinary arrival or missed cycle became a timing trap. | Replace that midpoint with the existing stable Frost Lily landing. Preserve ferry paths, periods and movement physics. Verify arrival phases and a complete missed-cycle wait with recorded input replay.                                   |
| P2       | A restored checkpoint initially faced the level entrance direction; long generated titles and ten-note markers crowded the camera controls.                                | Initialize the camera from its first supported route section, preserving manual orbit and later landing dwell. Contain long titles and reserve separate header, melody and camera rows at phone and tablet sizes.                           |
| P2       | A simple saved-checkpoint finale approach repeatedly replayed branching search prefixes and timed out in CI.                                                               | Try a bounded direct walk through the real game before branching. Debit all attempted ticks from the existing allowance; a failed walk remains inconclusive.                                                                                |

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
- The later rendered pass uses actual AMD OpenGL and inspects generated courts
  on phone and tablet, including the previously unseen gate junction. Pane and
  wing seams are continuous, the restored court faces the camera on its first
  ready frame, and Merc and action controls remain contained. These are saved
  checkpoint browser inspections, not continuous browser playthroughs. The stone
  wings visibly overhang the court floor; this remains an art follow-up. Their
  visible collision protects the gate, so shrinking them would undo the repair.

## Continuous playthrough and timing follow-up

- Continuous simulations start from an unsaved spawn and use ordinary movement,
  encounter-start and pitch-observation APIs through every required note, the
  finale and the actual exit portal. The matrix covers all four lessons at three
  difficulties for `shared-pearl`, plus `continuous-a` and `continuous-b` for each
  lesson: 20 generated courses, all completing without a respawn. A further test
  records movement, encounter starts and pitch observations and independently
  replays them in a fresh game, matching the final player and saved progress.
- 52 local mechanism cases cover five ferry variants at six entry delays,
  elevator boarding, a complete missed twin-ferry cycle, scroll extension,
  difficulty-minimum crackle warnings, and the fork's frost momentum route.
  Waiting advances the actual clock; no platform, checkpoint or completion state
  is injected. The fork needs a retained straight run-up and a later jump; a
  failed early diagonal controller attempt was not evidence of impossible content.
- Responsive browser regressions check 320×740, 390×844, 844×390 and 768×1024
  layouts. Header buttons, title, ten-note progress and camera controls stay
  separated. Raster output is suppressed only in these DOM geometry cases;
  separate hardware-rendered captures inspect the actual scene.
- The direct-walk solver probe reduced the reproduced local finale approach from
  about 2.15 seconds to 44 milliseconds on this machine, with a replayed positive
  witness. It respects zero-expansion, trajectory and total-simulation limits,
  including the combined walk-plus-branching allowance. No existing search or
  test timeout was enlarged.
- Independent reviews cover the continuous witnesses, mechanism fixtures,
  midpoint repair, camera startup and solver allowance. Synthetic pitch and
  controller-observed platform phases are deterministic runtime evidence; they
  do not establish microphone quality, human timing or native-device usability.
- The prior-head island-paths browser check still expected nine Art studies after
  this PR added Celestial Promenade. It now requires ten and explicitly checks
  that study. The original focused case passes with responsive layout, study
  loading, selection and return-navigation checks retained.
- The prior-head Journey browser job exceeded its 17-minute step budget after
  retries: two cases passed initially and four eventually passed. This is not
  classified as a dependency-only failure or a reproduced Cloudway traversal
  defect. Its full browser gate remains required on the updated commit; no job
  budget, assertion or retry allowance is enlarged.

A plain Node strip-only solver import still encounters an existing extensionless
import in the shared engine graph. The Vite/package checks above do not establish
standalone Node or native execution of that tooling.

## Next verification and repair priorities

1. Extend the finite seed and phase samples as new generator variants are added;
   the existing positive witnesses do not certify every generated recipe.
2. Replace repeated Pearl decorative seams with a matched continuous-court art
   treatment, preserving visible support and the existing movement contract.
   Add visual support detail under the gate wings without new walkable shelves.
3. Measure generation and traversal on the owner's iPhone. Local CPU timings and
   browser rendering cannot establish native performance or physical usability.
4. Freeze the recipe version before release. Any future change that changes the
   generated route must use a new generator version or retain the old recipe
   interpreter so shared courses and saved progress stay reproducible.

CI is authoritative for the full PR gate. Physical iPhone acceptance is separate.
