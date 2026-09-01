# V2 Scroll media source manifest

Status: superseded by the integrated `corky-v2.4` delivery pack. The four
runtime files documented below are retired; this record and its preparation
script remain only as reproducibility history.

Locked deterministic delivery set for the Beside Cue V2 onboarding Scroll
entrance and exit. Generated on 2026-08-30 with FFmpeg n9.0.1 and Node
v25.8.2 by `scripts/prepare-beside-cue-v2-scroll-media.mjs` (SHA-256
`18b8852e3be6230c24ba3ed9227f33b79945b7b67fa20ba5834271e46c22eed2`).

## Locked sources

| Role           | Provenance                                                                                                                    | Locked source filename                                     | SHA-256                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Present motion | Approved Google Flow Omni 1.1 Flash download; 720x1280, 24 fps, 96 video frames, 4.010 s, generated AAC removed from delivery | `Scroll_gliding_across_magenta_ba…_202608301143.mp4`       | `b08cc31e98a1ceaf2eba7135c458d540719fce97a6ca7c40c6130752c3f0c2c2` |
| Recede motion  | Approved Google Flow Omni 1.1 Flash download; 720x1280, 24 fps, 96 video frames, 4.010 s, generated AAC removed from delivery | `Scrolling_character_exiting_fram…_202608301404.mp4`       | `995bd8354cbc085bd33396a2ec7c07617586dbc94880eb06ce94c67c6567964a` |
| P02 scene base | Stage-A table-ready production candidate v0.16; 1080x1920 PNG                                                                 | `p02-table-ready-1080x1920-production-candidate-v0_16.png` | `e259a2225b78b1a4883b92da5d0fb061a64fcdfdbbd4c80fb26950d4043d2546` |

The adjacent Veo 3.1 comparison file is not an input to this delivery set.
The preparation script refuses any replacement source whose SHA-256 differs
from the hashes above.

## Delivered files

Only the four runtime assets live under
`apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/`. The QA proof
and this manifest live under the non-public
`apps/beside-cue/media-source/onboarding/corky-v2-preview/scrolling/` tree.

| File                                                   | Location   |   Bytes | SHA-256                                                            | Contract                                                                                                |
| ------------------------------------------------------ | ---------- | ------: | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `b03-scrolling-present-v0_1.mp4`                       | Public     | 647,287 | `e444e6d47f021c12035735803c9f1a64516152441bd74c00a2344ef70a637193` | H.264 High 3.1, yuv420p BT.709 limited-range, 720x1280, 24 fps CFR, exactly 96 frames / 4.000 s, silent |
| `b05-scrolling-recede-v0_1.mp4`                        | Public     | 659,434 | `43150faf00d54094ff170a07d24e1060c8a5249ff4689bc344643f88f1ac1ced` | H.264 High 3.1, yuv420p BT.709 limited-range, 720x1280, 24 fps CFR, exactly 96 frames / 4.000 s, silent |
| `p02-table-ready-v0_1.webp`                            | Public     | 648,158 | `9dbe36ff7d47bc4ef79be1918f3a3ef72ac4c6362ebc49c2518f147986e13df8` | Lossless WebP, 720x1280; canonical empty/table-ready endpoint                                           |
| `p03-scrolling-settled-v0_1.webp`                      | Public     | 648,748 | `e1d8758fd375dcc5601dc2cb70e3e08777b7d407930861f47e329c755671abb1` | Lossless WebP, 720x1280; canonical shared settled Scroll endpoint                                       |
| `qa-contact-sheet-present-top-recede-bottom-v0_1.webp` | Non-public |  38,452 | `a3296a0638703704c522b3ce0b0d76e3e0de21b108c69f9d02f745253495d712` | 720x640 review proof: Present f0/f24/f48/f72 on top, Recede f0/f16/f32/f42 below                        |

## Normalization and edit contract

- P02 is Lanczos-downsampled once from 1080x1920 to 720x1280 and stored as
  lossless WebP.
- P03 uses frame 72 of the locked Present source. Its saturated-magenta matte,
  magenta edge spill, and darker generated magenta floor shadow are removed by
  the chroma-geometry alpha rule embedded in the preparation script.
- The keyed 720x1280 source plate is registered as a 452x804 layer at
  `(x=14, y=396)`. Against P02, Scroll's blue silhouette is approximately
  `184x312+148+658`, with its feet around y=969. This deliberately matches
  V1's staging relationship: Scroll overlaps the player in the foreground,
  lands below the player/Corky floor line, and remains clear of Corky.
- A restrained contact shadow is derived from the keyed alpha on every frame,
  compressed onto the same floor plane, and composited below Scroll. It follows
  the walking character and disappears with it; it is not a fixed ellipse or a
  retained part of the generated magenta background. Including that shadow,
  P03's exact 5% difference bounds against P02 are `186x320+147+657`.
- Present is exact P02 for frames 0-11, the approved Present motion retimed
  across frames 12-71, and the delivered P03 endpoint for frames 72-95. The
  last motion frame and endpoint derive from the same source frame, avoiding a
  handle pop.
- Recede is the same delivered P03 endpoint for frames 0-7. Frame 8 is also
  P03; frames 9-10 make a two-frame blend into the normalized Recede source.
  Approved source frames 0-47 are retimed across delivery frames 8-41. Scroll
  is fully absent by frame 41; frames 42-95 are exact P02.
- All source audio is discarded with an explicit video-only map and `-an`.

## Reproduction command

Run from the repository root:

```sh
rtk node scripts/prepare-beside-cue-v2-scroll-media.mjs \
  --present '<locked-source-dir>/Scroll_gliding_across_magenta_ba…_202608301143.mp4' \
  --recede '<locked-source-dir>/Scrolling_character_exiting_fram…_202608301404.mp4' \
  --base '<locked-source-dir>/p02-table-ready-1080x1920-production-candidate-v0_16.png' \
  --output-dir apps/beside-cue/public/onboarding/corky-v2-preview/scrolling \
  --proof-dir apps/beside-cue/media-source/onboarding/corky-v2-preview/scrolling
```

The script contains the complete FFmpeg filter graphs and delivery codec
arguments. A second clean-directory execution produced byte-identical SHA-256
hashes for all five delivered files.

## Validation commands

```sh
rtk ffprobe -v error \
  -show_entries format=filename,duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames \
  -of default=noprint_wrappers=1 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b03-scrolling-present-v0_1.mp4

rtk ffprobe -v error \
  -show_entries format=filename,duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames \
  -of default=noprint_wrappers=1 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b05-scrolling-recede-v0_1.mp4

rtk ffprobe -v error -select_streams a \
  -show_entries stream=index \
  -of csv=p=0 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b03-scrolling-present-v0_1.mp4

rtk ffprobe -v error -select_streams a \
  -show_entries stream=index \
  -of csv=p=0 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b05-scrolling-recede-v0_1.mp4

rtk sha256sum \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b03-scrolling-present-v0_1.mp4 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/b05-scrolling-recede-v0_1.mp4 \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/p02-table-ready-v0_1.webp \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/p03-scrolling-settled-v0_1.webp \
  apps/beside-cue/media-source/onboarding/corky-v2-preview/scrolling/qa-contact-sheet-present-top-recede-bottom-v0_1.webp

rtk magick \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/p02-table-ready-v0_1.webp \
  apps/beside-cue/public/onboarding/corky-v2-preview/scrolling/p03-scrolling-settled-v0_1.webp \
  -compose difference -composite -threshold 5% -trim \
  -format '%wx%h%O\n' info:
```

The two audio-stream probes must print no rows. The geometry probe must print
`186x320+147+657`.
