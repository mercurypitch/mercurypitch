# Glass material artwork v2

These 13 WebPs are full-canvas derivatives of the selected generated PNG masters. The original image content, including the gray backdrop, is preserved. Conversion uses ImageMagick Lanczos downscaling and WebP quality 88, method 6. There is no crop, painting, color adjustment, or background removal.

The files total **325,674 bytes**. Their combined decoded RGBA size is **37,740,800 bytes** if all 13 images are decoded simultaneously; this is an inventory size, not a measured runtime allocation.

| Artwork              | Original PNG | WebP     |  Bytes |
| -------------------- | ------------ | -------- | -----: |
| `c3-console-master`  | 1983×793     | 1600×640 | 22,684 |
| `c3-settings-master` | 1681×936     | 1600×891 | 29,418 |
| `b1-console-master`  | 2172×724     | 1600×533 | 28,696 |
| `b1-settings-master` | 1683×935     | 1600×889 | 36,394 |
| `b1-museum-tile`     | 1254×1254    | 512×512  | 19,832 |
| `c3-museum-tile`     | 1254×1254    | 512×512  | 20,192 |
| `b1-note-lens`       | 1254×1254    | 512×512  | 23,316 |
| `c3-note-lens`       | 1254×1254    | 512×512  | 26,828 |
| `b1-action-pill`     | 2172×724     | 768×256  | 15,480 |
| `c3-action-pill`     | 2172×724     | 768×256  |  7,666 |
| `b1-museum-plaque`   | 2172×724     | 768×256  | 13,274 |
| `b1-portrait-master` | 971×1619     | 960×1600 | 34,820 |
| `c3-portrait-master` | 971×1619     | 960×1600 | 47,074 |

## Geometry and clipping

[`../../game-material-art.ts`](../../game-material-art.ts) records each image URL, original source dimensions, artwork bounds, silhouette path, and recommended corner slices. All geometry uses original PNG pixels. Slices are measured inward from the artwork bounds, rather than from the full canvas. Lens artwork has zero slices and should scale uniformly.

SVG images should use the original source dimensions and `preserveAspectRatio="none"` so integer rounding during downscaling does not shift the source-coordinate clipping path. The silhouette must clip the image at runtime; the WebP itself is RGB and retains its gray background.

The contours follow the measured outer colored, light, or dark rim against the neutral backdrop. Pixel-center row envelopes are simplified to at most 100 points. Antialiasing makes the original edge uncertain by roughly 1–2 source pixels. These paths are measured clipping geometry, not original alpha mattes. Natural-aspect clipped previews were inspected; consumer layout and nine-slice rendering need their own runtime verification.

## Provenance

[`provenance.json`](provenance.json) records exact source and output SHA-256 hashes, byte sizes, dimensions, contour points, and conversion details for every asset. The original PNGs are archived unchanged in the creative asset archive at:

`/home/maff/Documents/root/5-Creative/besidecue/assets/glass-adventure/ui-layout-audition-v1/material-v2/originals/`

The 22-image catalog includes the rejected extraction studies and all candidate masters. Its `material-v2-manifest.json` retains source prompts, reference links, hashes, and review status. Including an image in this runtime inventory does not assert a measured percentage match to the locked reference artwork.
