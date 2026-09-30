# Measurement

Numbers turn taste arguments into fixable items. They never replace a critic
watching the frames: a video that passes every number can still be dull.

## Render

```bash
python3 scripts/measure.py render renders/<name>.mp4 --out review/<round>
python3 scripts/measure.py dense renders/<name>.mp4 --out review/<round> --at 2.4,7.0,11.35
python3 scripts/measure.py color renders/<name>.mp4 --at 4.0 --box 1700,980,120,60
```

`render` writes `summary.md`, `motion.csv`, `loudness.csv`, `frame-0.png` and
timestamped contact sheets (one frame every 0.2 s, 25 to a sheet). `dense` makes
one sheet per time at 20 fps across one second, for every transition. `color`
prints the mean colour of a box, for brand-colour checks.

| Check                   | Target                                                                                  | Source                                                     |
| ----------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Hard holds              | At most ~1 s per 30 s in total; none longer than ~0.5 s except the final call to action | `summary.md`, change below `--freeze` (0.1)                |
| Low motion              | Every run listed is looked at by a critic; not an automatic fail                        | `summary.md`, change below `--low` (0.35)                  |
| Frame one               | A finished composition                                                                  | `frame-0.png`                                              |
| Text contrast           | At least 4.5:1 on settled text                                                          | `check` contrast audit; critic for text over footage       |
| Collisions, fly-through | None, including mid-transition                                                          | `check` layout audit; critic on the dense sheets           |
| Brand colour            | Within about 3 per channel of the token                                                 | `measure.py color` on a background box                     |
| Loudness                | About -14 LUFS punchy, -16 to -19 LUFS calm; true peak at most -1 dBFS                  | `summary.md`                                               |
| Effects against music   | About +3 to +4 dB in the effect's own band; 2-8 kHz lift at most ~4 dB                  | `kit/business-motion-film/references/audio.md`             |
| Determinism             | Two renders give identical frames                                                       | `ffmpeg -i <file> -map 0:v -f framemd5 -` on both, compare |

## Reading frozen time

The change value is the mean absolute luma difference between samples 0.1 s
apart, on a 0 to 255 scale, at 320 px wide. How much a slow move registers
depends on the palette. Measured on the MercuryPitch smoke test: a pixel-static
frame reads about 0.04; a 3.5 per cent push over 2.2 s on the Obsidian stage
reads 0.2 to 0.6; a fly-through transition reads 8 to 17. The kit's 0.35
threshold was set on bright, cream-coloured films, so on a dark stage it flags
slow pushes that are genuinely moving. That is why `summary.md` reports two
thresholds. Hard holds below 0.1 fail the bar; low-motion runs go to the critic,
who decides whether they read as dead.

If a brand has an unusual palette, calibrate once: render one second held still
and one second of the slowest move you would accept, and set `--low` between
their readings.

## Reading loudness

Short-term loudness needs a full 3-second window, so the first seconds of
`loudness.csv` read -120.7 (silence) by definition. Integrated loudness, range
and true peak come from FFmpeg's `ebur128` summary.

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
- `solve-sfx-gains.py` returns its 0.005 floor when the music is sparse in the
  effect's band (seen against a sine pad). That means "no reliable answer", not
  "almost silent". `offline-mix.py` has per-event floors for this case but is
  hard-coded to one 40-second film; see the deviations in `SKILL.md`.
- `sfx-candidates.py` worked as documented.
