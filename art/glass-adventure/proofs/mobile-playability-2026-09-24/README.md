# Mobile playability proof — 24 September 2026

Branch: `feat/glass-mobile-playability`, based on merged PR860 (`ff7eae76`).

## Exit and approach presentation

`exit-sealed-desktop.png`, `exit-open-desktop.png` and the corresponding phone
images show the actual Cloudway renderer at the final recovery checkpoint.
The locked state has two completed exhibits, a frosted aperture and three
small required-exhibit diamonds. The restored open state has all three complete.
The next portrait has a wider gold approach ring; completed markers disappear.

Reproduce from this checkout:

```sh
GLASS_EXIT_RENDER_PROOF=1 BESIDE_CUE_E2E_PORT=5613 pnpm --filter @irchiinnuss/beside-cue-app exec playwright test glass-adventure-exit-seal.e2e.ts --project=chromium-adventure --output=test-results-exit-proof
```

These are real SwiftShader-rendered frames from the game, using validated saved
progress to select the final checkpoint. Raster calls are temporarily suppressed
while advancing the loading/camera clock, then restored before capture. These
images establish appearance, not physical Android frame rate or microphone input.
The fake clock advances additional frames after viewport resize so the image is
not a cleared drawing buffer.

Portal unit tests cover locked/partial/ready transitions, restored readiness,
reduced motion, rim floor clearance, orientation and one-shot completion.
The existing shared portal geometry remains authoritative for collision and
completion; the visual seal uses the same nonoptional prerequisite closure as the game.

## Touch and portrait verification

The six `glass-adventure-mobile-flow.e2e.ts` cases passed at 320×740,
390×844, 844×390, 768×1024 and 1180×800, plus a zero-break finale restore.
A real CDP touch contact moves away from the first singing station, releases,
then approaches again and taps Sing. Every movement sample remains on the
arrival deck without falling or respawning. The test checks a 44px action,
no overlap with movement/Jump, one-line exhibit count and no keyboard-only
hints on coarse-pointer devices. `sing-*.png` captures those host layouts with
raster calls suppressed; they establish touch/UI layout, not rendered art.

The final Journey portrait is separately rendered in `portrait-tablet.png`.
Its source image was upright; the separate native geometry needed a different
texture-upload orientation from imported glTF faces. The regression checks
both conventions. See [the audit](camera-portrait-audit.md) for the camera
findings and portrait fracture options.

The mandatory local `pnpm pr:prepare` and `pnpm beside-cue:typecheck` passed.
Focused simulation, portal/pad and vessel regressions passed. CI additionally
runs the mobile-flow and platform-kit files as named adventure jobs.

## Remaining device acceptance

- Compare sustained native performance on the owner's Android tablet.
- Discover Sing, deny/retry microphone permission, and complete all required glass.
- Confirm that a locked exit is understandable and opens after the final break.
- Check the corrected final Journey portrait orientation on device.
- Camera diagonal steering and the preferred portrait fracture design remain
  separate follow-ups described in the master plan; this pass does not claim
  those design decisions are settled.
