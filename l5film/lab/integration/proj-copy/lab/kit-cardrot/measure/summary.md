# Measurement

File: `lab/kit-cardrot/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 4.200 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | none |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 2.1 s (15.0 s per 30 s), longest 0.5 s.
**Final hold:** 0.1 s.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.3 s |  |
| 0.90 s | 0.1 s |  |
| 1.10 s | 0.3 s |  |
| 1.70 s | 0.4 s |  |
| 2.20 s | 0.4 s |  |
| 2.90 s | 0.1 s |  |
| 3.10 s | 0.5 s |  |
| 4.00 s | 0.1 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.4 s | 60 | small element moving |
| 0.70 s | 3.0 s | 73 | small element moving |

1 shorter run(s) totalling 0.1 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 0.867 s | pop | 0.08 | 0.13% |
| 1.467 s | jump | 0.05 | 0.06% |
| 1.533 s | pop | 0.06 | 0.08% |
| 1.633 s | jump | 0.03 | 0.04% |

## Loop seam

From the last frame back to the first: 0.00 on the scale of `frames.csv`, against a median frame change of 0.013, a 95th percentile of 0.46 and a largest of 1.03 at 3.900 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam rejoins like an ordinary frame. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

No audio stream.

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 1 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
