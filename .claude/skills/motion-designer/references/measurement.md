# Measurement

Numbers turn taste arguments into fixable items. They never replace a critic
watching the frames: a video that passes every number can still be dull.

## Render

```bash
python3 scripts/measure.py render renders/<name>.mp4 --out review/<round>
python3 scripts/measure.py dense renders/<name>.mp4 --out review/<round> --at 2.4,7.0,11.35
python3 scripts/measure.py dense renders/<name>.mp4 --out review/<round> --at 2.4 --window 0.5 --fps 60
python3 scripts/measure.py audio renders/<name>.mp4 --music-only <music-only render> --out review/<round>
python3 scripts/measure.py color renders/<name>.mp4 --at 4.0 --box 1700,980,120,60
```

`render` writes `summary.md`, `motion.csv`, `frames.csv`, `loudness.csv`,
`frame-0.png` and timestamped contact sheets (one frame every 0.2 s, 25 to a
sheet). `dense` makes one sheet per time: by default one second at 20 fps; with
`--window 0.5 --fps <film fps>` every frame, which is how a one-frame defect is
seen. `audio` compares the mix with the music-only render. `color` prints the
mean colour of a box, for brand-colour checks.

| Check                   | Target                                                                            | Source                                                       |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Holds                   | At most ~1 s per 30 s in total; none longer than ~0.5 s; the final hold is exempt | `summary.md` § Holds                                         |
| Low motion              | Every run listed is looked at by a critic; not an automatic fail                  | `summary.md` § Low motion                                    |
| Single-frame events     | Every pop explained; jumps are cuts or acceptable snaps                           | `summary.md` § Single-frame events, then a frame-exact sheet |
| Frame one               | A finished composition                                                            | `frame-0.png`                                                |
| Text contrast           | At least 4.5:1 on settled text                                                    | `check` contrast audit; critic for text over footage         |
| Collisions, fly-through | None, including mid-transition                                                    | `check` layout audit (text only); critic on the dense sheets |
| Brand colour            | Within about 3 per channel of the token                                           | `measure.py color` on a background box                       |
| Loudness                | About -14 LUFS punchy, -16 to -19 LUFS calm; true peak at most -1 dBTP            | `summary.md` § Loudness                                      |
| Effects against music   | Audible but a few dB over the music; at most ~4 dB of lift in 2-8 kHz             | `measure.py audio`                                           |
| Determinism             | Two renders give identical frames                                                 | `ffmpeg -i <file> -map 0:v -f framemd5 -` on both, compare   |

The `check` layout audit only compares text with text: in the first smoke test
it missed the title flying across the logo mark, an image. Critics catch those.

## Reading holds and low motion

Each 0.1 s sample carries two numbers: the mean absolute luma change and the
largest change of any pixel, on a 0 to 255 scale at 320 px wide. A hold needs
both to be small (mean below 0.1, largest below 16), because the mean alone
misses small things moving. Measured on the MercuryPitch smoke test: a static
frame changes no pixel by more than 1 or 2; slowly drifting type reaches 9 to
29; a thin pitch curve being drawn reads only 0.15 to 0.6 on the mean but 87 to
174 on the largest change; a fly-through reads 8 to 17 on the mean.

Low-motion runs (mean below 0.35) are listed with their largest change. The
kit's 0.35 threshold was set on bright, cream-coloured films, so on a dark stage
it also catches slow moves that are genuinely visible; "small element moving" in
the table says something is. The critic decides whether a run reads as dead.

A hold that runs to the end of the film is the final call to action, reported
separately and left out of the per-30-seconds figure. If a brand has an unusual
palette, calibrate once: render one second held still and one second of the
slowest move you would accept, and set `--low` between their readings.

## Single-frame events

`render` also reads every frame at the film's own rate. A jump changes once and
stays: a large one is a cut, a small one is usually a slow move snapping a whole
pixel. A pop differs from both neighbours: a flash, a missing element, a
one-frame glitch. Validated on a synthetic clip with hard cuts at 2.000 s and
4.000 s (both found, nothing else). On the smoke test it flagged three
whole-pixel snaps in the slow drift, one of them (4.567 s) among the three a
critic had found by hand; treat the list as places to look, not a complete one.

## Reading loudness

Momentary loudness needs a 400 ms window and short-term loudness a 3 s window,
so the first samples of `loudness.csv` read -120.7 by definition. Integrated
loudness, the loudness range and true peak (in dBTP) come from FFmpeg's
`ebur128` summary. Ignore the loudness range on clips shorter than about 10 s.

## Effects against music

`measure.py audio` subtracts the music-only render's momentary loudness from the
mix's, every 0.1 s, in full band and in 2-8 kHz, with the music floored at
-50 LUFS so a sparse bed still gives a number. Each stretch more than 0.5 LU
over the music is an effect event, flagged when its 2-8 kHz lift passes 4 dB or
its full-band lift passes 6 LU. Momentary windows average 400 ms, so a 50 ms
click reads lower here than its peak; the kit's `solve-sfx-gains.py` and
`offline-mix.py` work at 50 ms when an effect needs exact levelling. Measured on
the first smoke test: a whoosh over a sine pad with nothing above 500 Hz lifted
2-8 kHz by 11.8 dB, the effect a critic had measured as sitting on top of the
music.

## Reference study

```bash
python3 scripts/reference_pass.py <reference.mp4> --out study/<name>
```

It reads every frame at 320 px: change from the previous frame, brightness,
edge strength, and FFmpeg's scene-change score. Cuts are frames scoring at
least 10 (`--cut`). Fast moments are the largest non-cut changes that stand out
from the film's own resting level (at least 2.0 and four times the median).
Validated on a synthetic clip with hard cuts at 2.000 s and 4.000 s: both found,
and the fly-through found at 4.70 s.

## Known problems in the kit's own scripts

Use `scripts/measure.py` instead of these; the kit's versions stay unmodified in
`kit/` for reference.

- `frozen-time.sh` reads values with `grep -o "YAVG=[0-9.]*"`. FFmpeg prints
  values below 1e-4 in scientific notation, so `5.20833e-05` is read as
  `5.20833` and a nearly frozen stretch where only a few pixels change counts as
  motion. It under-reports frozen time exactly when a render is almost still.
- `loudness.sh` splits on whitespace, but FFmpeg prints `S:-120.7` with no
  space when the value is six characters wide, so silent or not-yet-measured
  seconds come out blank, and it samples at x.1 s because of float drift.
- `contact-sheet.sh` writes one sheet only (`-frames:v 1`), without timestamps;
  anything past cols x rows frames is dropped.
- `quality-bar.md` and `gauntlet.md` point to these scripts; read them as
  pointing to `measure.py`.
- `solve-sfx-gains.py` returns its 0.005 floor when the music is sparse in the
  effect's band (seen against a sine pad). That means "no reliable answer", not
  "almost silent". `offline-mix.py` has per-event floors for this case but is
  hard-coded to one 40-second film; see the deviations in `SKILL.md`.
- `sfx-candidates.py` worked as documented.
