# Ng slides: the stand-in art

Every picture the bridge room shows is a stand-in today. The paintings are
not made yet (the image generator is out until 20 October 2026), so
`scripts/sync-ng-art.mjs` draws each plate from the N0 measures
(`ng-n0/geometry/ng-geometry.json`) with `scripts/ng-art/stand-ins.mjs`, at
the frame and pixel width the painting will have. `bridge-geometry.ts`
marks each one `standIn: true`.

A stand-in is honest about what it is: flat shapes in the measured places,
the storyboard's colours, no painted detail. It is there so the room can be
built, tested and timed now, and so a painting can replace it without a
code change.

## The plates

Frames are in W (the screen's width), placed as `bridge-art.ts` and
`BridgeScene.tsx` place them. Widths are pixels a W: 860 for screens up to
DPR 2, 1290 for DPR 3 (a 430 px wide phone at 2x and 3x).

| Plate                     | Files (`art/`)                                 | Frame (left, top, width, height)                | The stand-in draws                                                                                                       |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| River-back                | `bridge-riverback.webp` (645 a W)              | 0, 0.089, 2.64, 2.4                             | The far bank, the town's lights and the far bridge's arches as bands and dots. Scrolls at a third of the bridge's speed. |
| Glass, unlit              | `bridge-glass-unlit-{860,1290}.webp`           | -0.4257, 0.9522, 0.8514, 0.6027 about the apex  | The arch's glass from `archG` (screen 1's arch): a faint fill under a pale rim. Opaque, black where there is no glass.   |
| Glass, lit                | `bridge-glass-lit-{860,1290}.webp`             | the same                                        | The same glass, lit cyan with a violet edge. Copied over the unlit glass in strips as the voice follows the line.        |
| Reflection, unlit and lit | `bridge-reflection-{unlit,lit}.webp` (430 a W) | -0.4257, 1.6567, 0.8514, 0.6895 about the apex  | Each glass flipped about the waterline, streaked and rippled. Half resolution.                                           |
| Landing                   | `bridge-landing-{860,1290}.webp`               | 0.2602, 1.3812, 0.371, 0.2515 from the apex     | The stone between two arches: the deck block and the pedestals down to the water. Transparent around it.                 |
| Pier                      | `bridge-pier-{860,1290}.webp`                  | -1.26, 1.3812, 0.9998, 0.2515 from the apex     | The pier the first arch starts from, where Merc waits at the intro.                                                      |
| Near bank, left and right | `bridge-near-{left,right}-{860,1290}.webp`     | 0.42 x 1.0 and 1.0 x 0.4, on the screen's edges | Dark foliage over the corners, fixed to the screen (F2), never scrolled.                                                 |
| Result                    | `bridge-result-{860,1290}.webp`                | 0, 0, 1, 2.578 (the whole of screen 4)          | The pulled-back view: five arches unlit at screen 4's places, the river, the banks.                                      |
| Result, lit               | `bridge-result-lit-{860,1290}.webp`            | 0, 1.2935, 1, 0.4512 (the arches' band)         | The same band with every arch lit. The room copies in each arch's lit ranges from the take.                              |
| Shimmer                   | `bridge-shimmer.webp` (a 640 x 200 tile)       | repeated sideways over the water                | Soft horizontal light streaks. Drifts with CSS; still under reduced motion.                                              |

The sizes add up to about 260 KB. Every file folds out of a store build
with the room (`apps/mercurypitch/vite.config.ts`, `PREMIUM_IMAGES`; checked by
`premium-images-build.test.ts` and `scripts/assert-bundle.mjs`).

## Putting a painting in

1. Save the painting in the N0 folder's `plates/`, at each width the table
   lists for it.
2. List it in `plates/ng-plates.json` with its files and its frame:

   ```json
   {
     "glass-lit": {
       "files": { "860": "glass-lit-860.webp", "1290": "glass-lit-1290.webp" },
       "frame": {
         "left": -0.4257,
         "top": 0.9522,
         "width": 0.8514,
         "height": 0.6027
       }
     },
     "shimmer": {
       "files": { "tile": "shimmer.webp" },
       "px": { "width": 640, "height": 200 }
     }
   }
   ```

3. Run `node scripts/sync-ng-art.mjs <ng-n0 folder>` from the repo root. It
   copies the painting over the stand-in's file, writes its frame into
   `bridge-geometry.ts` with `standIn: false`, and draws the plates still
   missing as before.
4. Check the four fixtures against the storyboard (`?ngFixture=intro`,
   `mid-take`, `demo-off`, `result` on the dev server).

## What a painting must keep

- **The glass is light.** The glass plates and their reflections are added
  over the river (`mix-blend-mode: plus-lighter`), so they are opaque and
  black wherever there is no glass. A grey haze in the black shows as a
  haze over the river.
- **Lit and unlit glass line up pixel for pixel.** The room copies vertical
  strips of the lit picture over the unlit one at the same columns, so the
  two share one frame, one size and one drawing. Light never drains: a
  strip once copied stays.
- **The apex column is the frame's anchor.** The glass, its reflection, the
  landing and the pier are placed from each arch's apex (`apexX(k)`), so a
  painting keeps the measured arch: the rim from `archG` with h 0.3932, a
  0.3957 and f 0.1429 (`ARCH` in `bridge-geometry.ts`), the deck at 1.3932
  and the water at 1.6267.
- **The reflection is the glass flipped about the waterline**, at half the
  resolution, so the strips copied into it line up with the glass above.
- **The near bank is a frame**, fixed to the screen's corners: it may hide
  the bridge's ends, never the arch under the playhead (0.35 W).
