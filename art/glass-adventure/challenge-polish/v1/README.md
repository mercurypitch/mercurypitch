# Singing camera and beginner sway — verification pack

Reviewed runtime: `44d2ad5c` (final short-copy pass), following camera/shatter
review `2fe9f8f5`, initial camera `1bf1c952` and sway fix `ba1e1dcb`.
The final-copy production bundle hashes for both hosts are in `proofs/build-receipt.json`;
`proofs/shatter/build-receipt.json` identifies the earlier runtime used for the desktop
shard capture. The final copy changes do not alter camera or shatter behavior.
This batch belongs to draft PR #807. No merge or release. The source plan is
[`CHALLENGE-CAMERA-AND-SWAY-POLISH.md`](../../plans/CHALLENGE-CAMERA-AND-SWAY-POLISH.md).

## Reproduce the visual checks

`production/capture-runtime.mjs` enters the actual compiled campaign host. It
loads a legitimate earlier checkpoint, approaches through keyboard movement,
then starts with F on desktop or a real tap on touch contexts. Silent PCM opens
the actual microphone graph; for Conservatory views a steady generated tone
settles the first step through YIN, exposing the longer wave-step instructions.
It never directly writes a successful result for the target being inspected.

The default cases are desktop goblet, tablet fern, phone finale portrait at
390 × 844 and narrow finale portrait at 320 × 640. Each compares projected Merc
and exhibit bounds with the **actual instruction panel bounding box**, not only
the camera's own safe-area setting. It captures the singing view and cancellation
return. The separate shatter mode completes a held-note exhibit with actual PCM
and captures fragments before the automatic exploration return. It primes a
harness-only animation clock before real PCM completion, advances presentation
exactly 0.2 seconds after the break, freezes that pose for the full-raster image,
then restores the native clock. This is deterministic appearance evidence; core,
vessel and camera tests separately establish the complete 2.3-second lifecycle.

Camera JSON includes `mode`, lifecycle `progress` and `settled`. A held camera
can still be easing toward a replacement plan after the panel or viewport
changes, so screenshot tooling waits for `mode === "holding"` **and**
`settled === true`; `holding` alone is only the lifecycle state.

After assets and the checkpoint are ready, the approach temporarily omits WebGL2
draw/clear calls because software rendering makes controls-based traversal slow.
The scene graph, input and simulation still run. The original method descriptors
and full viewport/drawing buffer are restored before camera checks and screenshots.
The tablet appearance capture uses reduced motion to reach a stable composition;
the normal animated lifecycle has separate browser coverage. These
SwiftShader images establish runtime appearance; they do not establish physical
phone/tablet frame rate, heat, microphone quality or comfortable vocal effort.

Build a games-enabled BesideCue snapshot, then run a local HTTPS preview. The
script defaults to `https://127.0.0.1:5298/glass-game/?campaign=1` and refuses
non-localhost URLs. Options:

- `CHALLENGE_PROOF_URL`: local compiled campaign URL.
- `CHALLENGE_PROOF_CASE`: `all`, `desktop-goblet`, `tablet-fern`, `phone-portrait`
  or `narrow-phone-portrait`.
- `CHALLENGE_PROOF_OUTPUT_URL`: absolute `file:///.../` directory, with trailing slash.
- `CHALLENGE_PROOF_SHATTER=1`: desktop goblet shatter capture instead of cancellation.

From the repository root:

```bash
rtk proxy env PATH=/home/maff/.nvm/versions/node/v22.22.2/bin:/home/maff/.local/bin:/usr/local/bin:/usr/bin:/bin timeout 900 node art/glass-adventure/challenge-polish/v1/production/capture-runtime.mjs
```

## Reviewed capture sets

| Set                                                  | Viewport           | Source     | Evidence                                                                                                                          |
| ---------------------------------------------------- | ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `proofs/shatter/`                                    | Desktop 1440 × 900 | `2fe9f8f5` | Actual PCM completion, visible airborne fragments at controlled 0.2-second presentation, camera holding, then exploration return. |
| `proofs/runtime/manifest-narrow-phone-portrait.json` | Phone 320 × 640    | `44d2ad5c` | Real tap, initial step settled through PCM, wave view, expanded help, actual panel clearance and cancellation return.             |
| `proofs/runtime/manifest-phone-portrait.json`        | Phone 390 × 844    | `44d2ad5c` | Real tap, actual portrait face composition, wave view and cancellation return.                                                    |
| `proofs/runtime/manifest-tablet-fern.json`           | Tablet 1024 × 768  | `44d2ad5c` | Real tap, fern exhibit wave view and return; reduced-motion appearance capture.                                                   |

The manifests identify capture times, actual panel bounds, camera state, files and
browser errors. `proofs/final-artifacts.json` records current image/build-receipt
hashes and the reproduction harness hash. `proofs/before-final-copy/` preserves
superseded views and failed attempts; those are **not** final-copy acceptance.
The desktop source precedes the short-copy-only commit; camera and shatter code
are identical between the two recorded source revisions.

## Retained failures and corrections

- `proofs/phone-framing-before.json`: 390px portrait was clipped horizontally
  by the room-constrained side shot. More oblique candidates and a bounded wider
  portrait lens corrected it. Panel replans use the stable exploration lens,
  preventing repeated widening.
- `proofs/narrow-panel-before.json`: the 320px wave card occupied too much of the
  screen. A capped safe-area value did not represent the actual card boundary.
  Compact small-screen spacing, shorter headings and optional detailed help
  preserve the full up/down/centre guidance while leaving room for the shot. The joined voice browser test
  compares against the actual panel top at both 390px and 320px.
- `proofs/portrait-reframe-before.png`: a fitted portrait looked edge-on during a
  live panel reframe. Planning now considers the actual portrait face normal and
  preserves a feasible established side. Captures wait for actual position, target
  and lens convergence (`settled`), rather than just the `holding` state.
- `proofs/before-shatter-timing/`: the first alleged shard shot was actually a late
  post-break return view. Review found that the core released ownership after 1.4
  seconds, while normal vessel presentation lasted 2.3 seconds. A shared pure
  timing contract now keeps input and camera ownership through the full flight.
  The old capture is not evidence of visible fragments.
- Early full-raster traversal timed out in software WebGL. Only approach raster
  cost is omitted by the current harness; final captures restore drawing methods
  and full dimensions. `proofs/tablet-raster-timeout.json` retains the slow normal-
  motion software-rendering failure; it is not described as a passing tablet test.

## Automated behavior evidence

- Focused camera/director/planner/renderer/Merc tests pass, including full
  shatter hold, pause, exact stationary return, return while Merc moves, bounded
  portrait lens across repeated replans, and real model presentation turning.
- Two camera browser smoke tests pass: F/tap entry, phone composition, mouse drag
  and wheel lock, hidden movement controls, cancel, actual PCM completion and
  holding → restoring → exploration. The explicit PR CI matrix includes this file.
  These are behavioral tests: CI omits unasserted raster draws while retaining the
  actual scene bounds, DOM measurement, camera, input and PCM. Runtime screenshots
  separately verify pixels. Earlier CI raster starvation and a source formatting
  failure were diagnosed; final revision results belong in the handoff receipt.
- Conservatory PCM/YIN browser regression passes: real settled first step, 390px
  and 320px panel comparison, whole-tone alternating sways, short dropout, centre
  finish, stopped microphone and saved completion.
- Focused browser scenarios pass across relevant runs: camera entry/cancel
  and full break/return, mouse and touch artwork interaction, Conservatory help and
  completion, Twin pair replay, comfortable-note finding/reference/hold, and 320px high-note finding. Help preserves the
  current attempt, reference count and focus; normal-size actions fit one line
  with 44px hit targets. Text may wrap when enlarged rather than being clipped.
- All 503 glass-game tests in 70 files passed at the reviewed camera/shatter
  revision, including the actual core/vessel/camera boundary and reduced-motion
  shard visibility. The final copy-only pass separately passed 16 controller tests
  and three Chromium hold/pair/Conservatory flows with 320px measurements across
  finding, reference and singing. Shared/mobile typechecking, scoped source
  lint/format and `pnpm pr:validate` passed; both hosts rebuilt successfully from
  the frozen final-copy source.

The standalone art proof harness passes `node --check`, formatting and its four
completed runtime cases. It is outside the repository ESLint project-service
configuration and the existing changed-source lint candidate set; a direct ESLint
invocation rejects that path before parsing. No lint configuration was relaxed.

## Practical limitations

Shot endpoints and subject sight rays are constrained by authored rooms and
occluders. The spherical interpolation path is not swept against walls on every
frame; unusual starting orbits in tight corners still need playtest attention.
The saved orbit and zoom return after the complete shatter or cancellation.
Physical-microphone Conservatory fairness and device camera acceptance are pending.
Reduced motion retains a short, restrained 0.45-second fragment presentation while
the shared gameplay lock still uses the normal 2.3-second lifecycle.

Final capture manifests, image hashes and reviewed views are stored under
`proofs/`; the checkpoint plan records their completion and the final PR revision.
