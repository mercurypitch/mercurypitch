# Pull edge repair

The room and all settled/token stills are unchanged. Movies are silent,
opaque 720×1280 H.264 High 3.1, 24 fps, yuv420p, BT.709, faststart. No live
keying, blur, masking or new video playback effects were introduced.

## Two independent seams

1. Expansion preparation placed smaller keyed source frames at room X64–116.
   The old entrance correction ended at frame 24, although the actors remained
   cropped by their source's left boundary until frames 30–48. Exit correction
   likewise started after several characters already touched that boundary.
2. The portrait stage used `min(100vw, 56.25dvh)`. A 390×667 browser viewport
   therefore had 7.4-pixel side gutters even for correctly authored movies.

Both first-run and Settings replay use this same media pack and renderer.

## Source-aware repair

`scripts/beside_cue_edge_motion.py` keeps the transformed source boundary
offscreen throughout actual silhouette contact. A 24-frame smoothstep restores
the resting registration only after the entrance clears the source boundary;
the exit completes its corresponding shift before first contact. The motion
does not track noisy per-frame bounding-box coordinates.

Pillow and Kettle's generated exits retain a small final fragment. The offscreen
exit margin includes that fragment's measured width, so the six-frame empty-room
tail cannot make it pop away. Preparation and delivery verification both reject
a nonempty final registered foreground.

Scroll's older alpha derivatives have a separate transparent 21-pixel inset in
their 1080-pixel source. `scripts/prepare-beside-cue-scroll-edge.py` removes only
that empty padding, applies the same edge policy to actor and original shadow,
and restores the exact 14-pixel resting offset at 720-pixel delivery resolution.
Sugarlump and Avoidance already cross their source's actual left edge; their
movies are unchanged. The portrait full-bleed correction applies to all pulls.

New expansion movie URLs use `v0_2`; Scroll uses `v0_3` in this pack. Old cached
URLs therefore cannot silently serve the previous entrance.

## Evidence and reproduction

- `manifest.json`: source hashes, measured contact frames, per-frame offsets,
  output frame counts and matte settings for all 11 expansion pairs.
- `scroll-edge-manifest.json`: hashes and offsets for Scroll's original alphas.
- `edge-delivery-audit.json`: complete decoder checks, encoded endpoint errors,
  source-edge checks and unchanged still/token verification.
- `public/onboarding/pull-expansion-v1/SHA256SUMS`: all 46 delivery files.
- `scripts/beside-cue-edge-motion.test.mjs`: late entry, early exit, transient
  clearance, unchanged uncropped sources and unfinished-tail regressions.
- `e2e/onboarding-edge-framing.e2e.ts`: actual video bounds on short portrait
  viewports, rather than the bounds of its already-full-width outer wrapper.

Private full-frame measurements and visual contact sheets are under
`<user-dotfiles>/besidecue/preparation/2026-09-05/edge-audit` and
`<user-dotfiles>/besidecue/preparation/2026-09-05/pull-edge-safe-v2-proof`.
Original downloaded generations remain untouched.

Generate into a fresh output directory, never over existing reviewed media:

```sh
uv run --no-project --with numpy --with scipy --with pillow python \
  scripts/prepare-beside-cue-pull-expansion.py \
  --sources '<user-dotfiles>/besidecue/assets/main_higgsfield_ref/gemini' \
  --output '<fresh-delivery-directory>' --proof '<fresh-proof-directory>'

uv run --no-project --with numpy --with scipy --with pillow python \
  scripts/prepare-beside-cue-scroll-edge.py \
  --sources '<user-dotfiles>/besidecue/assets/onboarding-video-edit-v2_4/assets/diagnostics/layers' \
  --output '<fresh-scroll-directory>' --proof '<fresh-proof-directory>'

node --test scripts/beside-cue-edge-motion.test.mjs
```

Keep the existing stills/tokens when staging the new movies, verify their hashes
against the generated stills, and refresh the closed-set delivery hashes after
adding Scroll's two files. Physical iOS playback remains the final acceptance
check; desktop browser tests do not prove native hardware behavior.
