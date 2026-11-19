# DECISIONS 225: Merc's root on the frame the renderer shows, in the film

film-draft-01 showed Merc 49.6 px off for one frame at 490.933 s (film frame 14728) and 4 px behind
in the air on both recap hops (`../film-01-hops/hops-film-01.txt`). The cause was
`assets/lib/hosts.js` line 151 (now 176). In the film, s13 starts at 462.370 s, which is film frame
13871.1. The gate read the root on `floor((t - ds + ms) x 30)`, one pass frame after the one the
renderer shows.

## The fix (assets/lib/hosts.js, applied by atomic rename)

- **Before**, line 151:
  `const i = Math.floor((rootFromTag ? t - ds + ms : S0 + t - root.t0) * (root.fps || 30) + 1e-6)`
- **After**, line 176:
  `const i = rootFromTag ? L.passFrame(t, ds, ms, root.fps || 30) : Math.floor((S0 + t - root.t0) * (root.fps || 30) + 1e-6)`
- **New**, lines 90 to 99:
  ```js
  L.passFrame = (t, ds, ms, pf = 30) => {
    const cfg = window.__HF_EXPORT_RENDER_SEEK_CONFIG
    const F = cfg && Number(cfg.fps) > 0 ? Number(cfg.fps) : pf
    const k = Math.floor((t - ds) * F + 1e-3)
    const lim = 1000 * ms + 0.5 + (1000 * k) / F + 1e-6
    let i = Math.floor((lim / 1000) * pf) + 1
    while (i > 0 && Math.round((i * 1000) / pf) > lim) i--
    return i
  }
  ```
- **Docs**: the header's `root` entry is at lines 43 to 47, and `L.passFrame`'s entry at lines 50 to 61.
- **Copies**: the file before is `base/hosts.js` (sha256 in `base/hosts.js.sha256`), the file after
  is `hosts.js.new` (sha256 in `after-hosts.js.sha256`).

## How the renderer picks a pass frame (HyperFrames 0.8.97)

The source is `dist/chunk-H7EMX7GA.js`:

- **The cut.** `extractVideoFramesRange` cuts each pass once, at the render's fps F, with
  `-noaccurate_seek -ss <data-media-start> -i pass.webm` and the filters `settb=intb/2`,
  `setpts=PTS-lte(TB\,0.001)` (0.5 ms earlier) and `fps=F:start_time=0:round=up`.
- **The lookup.** `getFrameIndexAtTime` shows cut frame `floor((T - videoStart) x F + 1e-9)`.
- **The frame time.** The capture loop's T is `i x den / num`, so it is exact.
- **The page's time.** The runtime gives the page its time rounded to the microsecond.
  `debug-gate.js` shows it: (t - ds) x 60 lands on n - 2e-5, n or n + 2e-5, and at 30 fps on
  n +- 1e-5.
- **The extraction start** is the tag's `data-media-start`. It does not move for a render window
  (`resolveTimelineExtractionWindow`), and renders do not use the media proxy.
- **The pass's own frames** sit on whole milliseconds: m-blue-s13 has 1953 frames, every pts equals
  `round(1000 i / 30)`.

`ffmpeg-model/` runs that exact ffmpeg command on a synthetic 30 fps webm whose frame i is a gray of
3i + 16. The model in `L.passFrame` matches every cut frame at 30 fps (72 frames) and at 60 fps
(144 frames). See `model.txt`.

### The proposed index

The proposal was `floor(ms x fps + 1e-6) + floor((t - ds) x fps + 1e-6)`. It is exact for a 30 fps
render in exact arithmetic, but it fails two ways:

- **At 60 fps** it reads the pass at 30 fps, so it is one frame early on every odd render frame:
  151 of 301 frames of the film window.
- **On the lab's grid.** With the page's microsecond-rounded time, its 1e-6 margin drops a whole
  frame on a third of the frames of a scene rendered alone: 650 of 1951 at 30 fps.

`L.passFrame` takes F from the render (`window.__HF_EXPORT_RENDER_SEEK_CONFIG.fps`, which the
producer injects) and gives k a 1e-3 frame margin. A start in whole milliseconds puts (t - ds) x F
either on a whole frame or at least F / 1000 frames off one.

`passframe-check.mjs` (output in `passframe-check.txt`) counts the frames each reading gets wrong:

| Case                     | Frames | L.passFrame | Before | Proposal |
| ------------------------ | ------ | ----------- | ------ | -------- |
| Film, 488 to 493 s, 30 fps | 151    | 0           | 151    | 0        |
| Film, 488 to 493 s, 60 fps | 301    | 0           | 0      | 151      |
| s13 alone, 30 fps        | 1951   | 0           | 0      | 650      |
| s13 alone, 60 fps        | 3901   | 0           | 650    | 2600     |

The page's time is rounded to the microsecond in every case. With no render config (a probe or a
preview), `L.passFrame` reads what a 30 fps render shows.

## The film's own frames, 488 to 496 s

`window.mjs` renders film frames 14640 to 14879 at 30 fps and 29280 to 29759 at 60 fps.

- **How.** It makes the producer's own plan of the whole root and captures only the chunk at 488 s,
  using HyperFrames' distributed plan and `renderChunk` (the same stages as `hyperframes render`).
- **The project.** `make-proj.sh` builds it: the film's root `index.html` with only s13's host left,
  still at 462.370 s. No other scene is on screen from 462.370 to 527.395 s. The live assets are
  linked in, with `hosts.js` taken from `base/` (before) or the live file (after).
- **Faithful to the film.** `film-before-30.mp4` reproduces `hops-film-01.txt` to 0.1 px: 750.8 at
  14728, 1299.6 at 14750, 103.6 at 14713.
- **Faithful to the CLI.** A `hyperframes render` of a root with s13 moved 456 s earlier
  (`proj-shift-after/`, `shift-after-60.mp4`) matches the 60 fps window to 0.2 px on every hop frame
  (`cmp-window-cli-60.txt`).
- **Reproducible.** The plain renders are deterministic. The 60 fps window rendered three times
  (before, after, after again) and once more with only the debug wrapper gave the same sha256,
  8487ace3… (`window-film-*-60*.log`).

`track.py` tracks Merc frame by frame, using hops-film-01's measure: cx is the mean x of his bright
pixels. The maxima below are over pass frames 842 to 900.

- **30 fps** (`hops-30.txt`, `hops-film-fix.png`):
  - **Before**: the gate is off on 44 of the 59 hop frames, by up to 49.6 px.
  - **After**: it is off on no frame.
  - **Before against after**: the measured move is the index's predicted move to 0.2 px on every
    frame: +4.0 px through both carries, -49.6 px at 14728, -0.4 to -9.6 px at 14748 to 14758 (the ease back after hop 2).
  - **Landings**: the box holds 650.38 while the pass's root is 0.38 (the body at 700) and 700.00 once
    the pass recentres; it holds 1240.38 (the body at 1290) after hop 2. The pixels read 702.6, 701.9,
    701.2, 705.3 (the pass's landing squash) and 1293.5, 1292.1, 1290.9, 1290.2, 1289.9, 1290.0, 1290.4.
- **60 fps** (`hops-60.txt`): in the film's timing the old reading already matched the renderer on
  every frame, since s13's start falls 0.2 of a frame off the grid. The before and after renders are
  byte-identical (sha256 8487ace3…). There is no jump, and the body lands at 701 to 702 and 1290.
- **Debug renders** (`debug-gate.js`, `decode-dbg.py`, `which-frame.py`) paint the page's time, both
  readings and the gate's box in the frame's corner.
  - **The shown frame.** Merc's pixels sit on the box plus the pose of the modelled shown frame to
    1.3 px or better on 89 of 98 hop frames at 60 fps (`film-dbg-after-60.txt`) and 43 of 49 at
    30 fps. The plain 60 fps render, read against the debug render's box, does so on 88 of 98. The
    others are frames where neighbouring poses are alike, or the chart's fade frame.
  - **The kit's frame** equals the shown frame on every frame.

### The lab at 60 fps: DECISIONS 224's "9 px after hop 2"

This was not the film's fault but the page's time. In s13 alone at 60 fps, (t - ds) x 60 lands
2e-5 frames short of n on every frame with n mod 6 = 5. The old 1e-6 margin then read one pass
frame early wherever (t + 0.05) x 30 is whole: 650 frames, which show in the ease-back after hop 2.

| Frame       | Before                | After                     |
| ----------- | --------------------- | ------------------------- |
| 1757 (29.283) | read 879, cx 1280.8 | `L.passFrame` 880, cx 1290.3 |
| 1763 (29.383) | read 882, cx 1282.5 | 883, cx 1288.5            |

The shown frames are 880 and 883 (`alone-dbg-before-60.txt`, `alone-dbg-after-60.txt`). At 30 fps
alone, nothing changes: every frame reads the same before and after (`alone-dbg-after-30.txt`).

### 30 fps against 60 fps

At the same film time the 60 fps render shows the pass frame one after the 30 fps render's, since
k comes from a different grid. With Merc's root cancelled right in both, their cx differ only by the
pose between neighbouring pass frames (`pass-pose.txt`: at most 4.7 px). `cross-30-60.txt` measures
this over the hops: the largest difference is 45.5 px before and 4.1 px after.

`track.py` reads a 1500 x 330 crop. A 4:2:0 crop keeps an even height: the first draft asked for
331 rows and read each later frame one row further into the next one. That briefly looked like
Merc running ahead in the air at 60 fps. It was the measure, not the render: every table here is
from the corrected crop.

## Checks

- **Probes.** Every scene's probe passes 1556 of 1556, s13 229 of 229 (`probe-all.txt`,
  `probe-all-live.log`). The kit probe passes 382 of 382 (`kit-probe.txt`).
- **`check`.** Every scene at its times, and the root: 0 errors each, with the same warnings as
  part 1 (lint only; the root 23). Results in `checks/`, summary in `checks/SUMMARY.txt`. s08, s09
  and s10 were being edited by their groups for the F-01 round while this ran; the checks read the
  live files.
- **clock-lint.** Silent (`clock-lint.txt`).
