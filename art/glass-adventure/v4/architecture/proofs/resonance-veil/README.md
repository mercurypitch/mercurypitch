# Resonance Veil inspection — 2026-09-20

`capture.mjs` renders the actual chamber assets and renderer at fixed inspection
poses from `poses.json`, at 800×600 and 390×740. These are visual inspections,
not evidence of earning encounters or walking the route. Set `GLASS_PROOF_BASE`
to a local games-enabled Vite origin (default `https://localhost:5187`), then run
the script with Node. `manifest.json` records the poses, scene metrics and errors.

Locked, open and mid-release views were inspected. The brass rim and translucent
iridescent surface align to the authored exit. Release points stay bounded in
front of the aperture. No asset/page errors were reported. The final veil uses
alpha/clearcoat/iridescence without screen-space transmission and uses a single
pass for the flat surface. This preserves the look with less scene rendering.

The separate 390px caption image comes from the real game host after calibrated
PCM earns the first goblet. It shows exact cue/caption text and separate route
guidance. It is layout evidence, not physical-device performance acceptance.

Behavior evidence is separate: the real-controls chamber route passed both
gates, continuous floor joins and walking completion; pure tests cover airborne,
reverse, rotated and locked crossings, one-shot effects, reduced motion, and
saved-finish restoration. A real-PCM/reload browser test passed, including exact
caption text and clearing on Pause. An earlier software-rendered run stalled
during reference playback; the rerun passed. This is not proof that every
software-raster stall or the owner's system-wide GPU mosaic is resolved.
