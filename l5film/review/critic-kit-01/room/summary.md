# Measurement

File: `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/l5film/lab/kit-room/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 41.500 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | none |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 10.7 s (7.7 s per 30 s), longest 1.4 s.
**Final hold:** 0.5 s.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.3 s |  |
| 0.40 s | 0.8 s | longer than 0.5 s |
| 2.70 s | 0.4 s |  |
| 3.20 s | 0.1 s |  |
| 3.40 s | 0.3 s |  |
| 6.80 s | 0.3 s |  |
| 8.20 s | 0.1 s |  |
| 8.40 s | 0.1 s |  |
| 12.60 s | 0.3 s |  |
| 14.40 s | 0.3 s |  |
| 16.30 s | 0.3 s |  |
| 16.70 s | 1.3 s | longer than 0.5 s |
| 18.10 s | 0.6 s | longer than 0.5 s |
| 18.80 s | 0.4 s |  |
| 19.50 s | 0.1 s |  |
| 24.60 s | 0.3 s |  |
| 25.00 s | 0.1 s |  |
| 25.20 s | 1.4 s | longer than 0.5 s |
| 26.70 s | 0.3 s |  |
| 27.10 s | 0.3 s |  |
| 29.00 s | 0.3 s |  |
| 30.90 s | 0.3 s |  |
| 33.40 s | 0.2 s |  |
| 35.20 s | 0.3 s |  |
| 35.60 s | 0.3 s |  |
| 37.10 s | 0.3 s |  |
| 37.50 s | 0.3 s |  |
| 37.90 s | 0.2 s |  |
| 38.20 s | 0.1 s |  |
| 40.50 s | 0.3 s |  |
| 40.90 s | 0.5 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 4.0 s | 106 | small element moving |
| 6.60 s | 0.6 s | 99 | small element moving |
| 7.80 s | 0.3 s | 21 |  |
| 8.20 s | 0.7 s | 103 | small element moving |
| 12.20 s | 0.8 s | 113 | small element moving |
| 14.30 s | 0.5 s | 115 | small element moving |
| 16.20 s | 0.4 s | 109 | small element moving |
| 16.70 s | 10.3 s | 108 | small element moving |
| 27.10 s | 0.5 s | 98 | small element moving |
| 28.90 s | 0.5 s | 98 | small element moving |
| 30.80 s | 0.4 s | 72 | small element moving |
| 33.30 s | 0.4 s | 77 | small element moving |
| 35.00 s | 0.5 s | 98 | small element moving |
| 35.60 s | 0.4 s | 98 | small element moving |
| 37.00 s | 0.4 s | 98 | small element moving |
| 37.50 s | 3.9 s | 95 | small element moving, runs to the end |

0 shorter run(s) totalling 0.0 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 0.400 s | jump | 0.24 | 0.23% |
| 3.400 s | jump | 0.18 | 0.16% |
| 3.800 s | jump | 0.09 | 0.10% |
| 7.200 s | jump | 0.21 | 0.20% |
| 8.167 s | jump | 8.03 | 6.00% |
| 8.567 s | jump | 0.17 | 0.16% |
| 12.567 s | jump | 0.18 | 0.15% |
| 12.967 s | jump | 0.23 | 0.24% |
| 14.367 s | jump | 0.20 | 0.17% |
| 14.767 s | jump | 0.17 | 0.17% |
| 16.267 s | jump | 0.18 | 0.14% |
| 16.667 s | jump | 0.39 | 0.19% |
| 26.667 s | jump | 0.16 | 0.14% |
| 27.067 s | jump | 3.19 | 3.96% |
| 27.467 s | jump | 0.10 | 0.09% |
| 29.367 s | jump | 0.11 | 0.10% |
| 35.533 s | jump | 10.71 | 13.41% |
| 37.433 s | jump | 9.22 | 13.71% |
| 37.833 s | jump | 0.17 | 0.16% |
| 40.833 s | jump | 0.15 | 0.13% |

42 weaker event(s) are in `events.csv`.

## Loop seam

From the last frame back to the first: 4.67 on the scale of `frames.csv`, against a median frame change of 0.068, a 95th percentile of 4.09 and a largest of 10.71 at 35.533 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam rejoins like an ordinary frame. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

No audio stream.

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 9 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`, `sheet-09.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
