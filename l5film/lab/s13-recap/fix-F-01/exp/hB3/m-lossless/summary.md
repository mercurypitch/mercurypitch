# Measurement

File: `lossless.mp4`

| Property | Value |
| --- | --- |
| Duration | 0.667 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | none |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.3 s (13.5 s per 30 s), longest 0.3 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.3 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.3 s | 4 | nothing visible moves |

0 shorter run(s) totalling 0.0 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

None found.

## Loop seam

From the last frame back to the first: 4.85 on the scale of `frames.csv`, against a median frame change of 0.002, a 95th percentile of 1.43 and a largest of 1.43 at 0.600 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

No audio stream.

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 1 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
