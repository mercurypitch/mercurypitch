# V3 visual review gallery

Open `review.html` through the existing source preview server, or directly as a local HTML file. The page uses local images and links; it has no CDN or application dependencies. It does not activate assets in the game.

Refresh the static page after authoring agents finish writing images/reports:

```sh
rtk proxy python3 /home/maff/.codex/worktrees/00ad/mercurypitch-agent/art/glass-adventure/v3/build_review.py
```

This writes only `review.html` and `review-evidence.json`. The latter records which images/GLBs were actually present in that snapshot. A raw GLB is labelled archived only when its version/header length agrees with the local file size. That check is a download-completeness check, not topology or visual acceptance.

The generator currently lists four vessel families and one column. Generated reference art, raw donor inspection images and Blender-final proof renders are labelled separately. Missing stages stay pending. `not-activated` is intentional until root explicitly integrates an accepted result; the gallery must be updated when that status changes.

Path candidates live in `build_review.py`. Vessel sources follow `donors/<family>/` and staged GLBs follow `exports/` or `staging/`; column sources/reports/proofs follow `architecture/`. If an authoring agent uses a different final proof filename, add its exact path candidate before refreshing. Do not rename another agent's source file to fit the gallery.

The linked raw archives and original-import Blender files remain separate from prepared/finalized files. No artwork, runtime file or v2 gallery is changed by this builder.

## Interactive review, 2026-09-15

`model-viewer.html?asset=<family-id>` opens an actual archived donor or validated
Blender GLB with the local Three.js renderer. No generation credits or external
viewer services are used. It offers mouse/touch orbit and zoom, keyboard arrows
and plus/minus, wireframe and reset, and original/final comparison.

Independent verification passed at 1440 and 390 CSS-pixel widths: real mouse,
keyboard and CDP touch/pinch/cancel inputs, repeated source switching, 44px control
heights, no overflow and no browser/network errors. Pixel comparisons confirmed
orbit/zoom changed the view and reset restored it. Root inspected the actual
column, arcade and pavilion WebGL screenshots; all three loaded correctly. These
are software-browser checks, not physical-device frame-rate acceptance.

Evidence: local agent output `2026-09-15/glass-v3/model-viewer-review/` and
`architecture-viewer-review.json`. The seven-family comparison gallery separately
passed desktop/phone checks: 18 loaded images, seven unique families, three actual
architecture finals.

Glass finals require `donors/<family>/validation.json` with `status: passed` and
`glbSha256` matching the current export before the gallery exposes them. Trial
filenames alone do not make a candidate ready.

## Final glass export browser review — 2026-09-15

All four final Blender glass bundles are now exposed through the checksum-gated gallery, alongside the three architecture candidates. Each glass bundle contains its intact model and 23 independently validated closed fragments. The decanter intact root is a deliberate group containing body and solid stopper. The viewer hides all shard roots for the intact comparison.

The first real GLB review caught white glass silhouettes caused by the viewer's transparent canvas and CSS-only backdrop. Three's transmission pass sampled its white clear fallback. A controlled browser comparison confirmed that a real muted scene background fixes the presentation without altering the GLBs, lighting or exposure. The final viewer uses that background. Original and corrected proofs are retained in the dated final-vessels-browser evidence directory.

These are review candidates, not activated game assets. Calculated delivery and memory costs for the seven final GLBs are 56,472,600 bytes of GLB, about 79 MiB of expanded glass vertex attributes including hidden fragments, and about 48 MiB of decoded architecture textures. The integration pass must measure actual readiness and device performance before adding all candidates to the course. Source fidelity limits remain in each donor's validation and notes.

Owner music intake is available in `../audio/v1/review.html`: all six M cues and all three A cues with both A03 takes. Ten original WAVs are preserved; auditions are locally encoded MP3s. The current game has no new music or ambience playback.
