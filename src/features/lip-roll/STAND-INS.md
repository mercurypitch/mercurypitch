# Lip roll: the stand-in art

Every picture the bay room shows is a stand-in today. The paintings are not
chosen yet, so `scripts/sync-lip-art.mjs` makes each plate with
`scripts/lip-art/stand-ins.mjs` from the L0 measures
(`lip-l0/geometry/lip-geometry.json`), at the frame and pixel width the
painting will have. Two of them start from Gemini pictures (L0 report,
section 8); the rest are drawn. `bay-geometry.ts` marks each one
`standIn: true`.

A stand-in is there so the room can be built, tested and timed now, and so
a painting can replace it without a code change. It is not the art: the
bay-back in particular is flat shapes in the measured places.

## The plates

Frames are in W (the screen's width), placed as `bay-art.ts` and
`BayScene.tsx` place them. Widths are pixels a W: 860 for screens up to DPR
2, 1290 for DPR 3.

| Plate       | Files (`art/`)                   | Frame (left, top, width, height)            | The stand-in                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | -------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bay-back    | `bay-back.webp` (645 a W)        | -0.02, -0.14, 1.724, 2.7606                 | Drawn: screen 1's sky bands, thin clouds, rimmed cliff profiles on the horizon, the far sea with the moonlight path. No moon: that is its own plate. Slides with the camera (`bay-sky.ts`: fast through screens 2 and 3, slower after); its horizon moves from screen 1's to the run's with the zoom. 0.14 W of sky over L0's frame for that move.                   |
| Moon        | `bay-moon.webp` (645 a W)        | 0.4074, 0.1607, 0.5386, 0.5386              | Drawn: the halo, then the disc, at screen 1's measured size and colour, centred in the frame, clear around. Drawn in the bay-back's box, so it slides with the sky; over the count-in's zoom it shrinks to screens 2 and 3's size and rises to their mean height (`bay-sky.ts`).                                                                                     |
| Wave, lit   | `bay-wave-lit-{860,1290}.webp`   | -0.5625, -0.04, 1.125, 0.9228 about a crest | Gemini's `lip_wave_lit_a`, scaled to wave B (h 0.3708, a 0.4125), each column pulled up so its painted edge meets the model's 0.0102 W under the dots, its water run on to screen 2's foam line (0.448 W under the root) and graded to screen 2's six lit zones (each within 2.5 CIEDE2000; the sync prints them). Pooled under the wave, faded under the foam line. |
| Wave, unlit | `bay-wave-unlit-{860,1290}.webp` | the same                                    | The lit plate, its colour set by depth under the dots to screen 1's unlit zones (masked grading), its own light kept as texture. Same pixels, same alpha.                                                                                                                                                                                                            |
| Sea-front   | `bay-sea-front-{860,1290}.webp`  | 0, 1.7594, 1, 0.8612, a tile one W wide     | Drawn: #07203e to #030e1c with ripple streaks and a broken foam line; its top fades in over 0.06 W. Drawn over Merc, so he sits in the water.                                                                                                                                                                                                                        |
| Result      | `bay-result-{860,1290}.webp`     | 0, 0, 1, 2.629 (the whole of screen 4)      | Gemini's `lip_result_a` (screen 4 redrawn without the interface), extended above and below with screen 4's own top and bottom colours, its waves graded to the unlit zones.                                                                                                                                                                                          |
| Result, lit | `bay-result-lit-{860,1290}.webp` | 0, 1.0516, 1, 1.2093 (the waves' band)      | The same picture, ungraded, cropped to the band. The room copies in each wave's lit ranges from the take.                                                                                                                                                                                                                                                            |
| Bubble      | `bay-bubble.webp` (64 px)        | drawn at 0.014 to 0.028 W                   | Drawn: a thin bright ring, a faint fill and a highlight. Likely final.                                                                                                                                                                                                                                                                                               |

The files add up to about 550 KB. Every file folds out of a store build
with the room (`apps/mercurypitch/vite.config.ts`, `PREMIUM_IMAGES`; checked
by `premium-images-build.test.ts` and `scripts/assert-bundle.mjs`, which
finds them by their `bay-` names).

The dotted crest, the ribbon, the bubbles' stream, the buzz beside Merc and
the foam's sparkles on a lit crest are drawn in code, not plates.

## Putting a painting in

1. Save the painting in the L0 folder's `plates/`, at each width the table
   lists for it.
2. List it in `plates/lip-plates.json` with its files and its frame:

   ```json
   {
     "wave-lit": {
       "files": { "860": "wave-lit-860.webp", "1290": "wave-lit-1290.webp" },
       "frame": {
         "left": -0.5625,
         "top": -0.04,
         "width": 1.125,
         "height": 0.9228
       }
     },
     "back": {
       "files": { "645": "bay-back-645.webp" },
       "frame": {
         "left": -0.02,
         "top": -0.14,
         "width": 1.724,
         "height": 2.7606
       }
     },
     "moon": {
       "files": { "645": "bay-moon-645.webp" },
       "frame": {
         "left": 0.4074,
         "top": 0.1607,
         "width": 0.5386,
         "height": 0.5386
       }
     },
     "bubble": { "files": { "sprite": "bubble.webp" }, "px": 64 }
   }
   ```

3. Run `node scripts/sync-lip-art.mjs <lip-l0 folder>` from the repo root. It
   copies the painting over the stand-in's file, writes its frame into
   `bay-geometry.ts` with `standIn: false`, and makes the plates still
   missing as before. (Checked on 14 Oct 2026 with a sea-front listed: its
   file was copied byte for byte and its frame written, no code touched.)
4. Check the four fixtures against the storyboard (`?lipFixture=intro`,
   `mid-take`, `demo-off`, `result` on the dev server).

## What a painting must keep

- **Lit and unlit waves line up pixel for pixel, in one frame.** The room
  copies vertical strips of the lit picture over the unlit one at the same
  columns (`bay-waves.ts`), and both are placed by the unlit plate's frame.
  Light never drains: a strip once copied stays.
- **The crest column is the frame's anchor.** Each wave is placed from its
  crest (`crestX(k)`, one period of 0.925 W apart), so a painting keeps the
  measured wave: the edge from `waveG` with h 0.3708, a 0.4125 and f 0.0769
  (`WAVE` in `bay-geometry.ts`), 0.0102 W under the dotted line, the root at
  1.371 W.
- **The water is opaque, drawn normally.** Unlike Ng's glass the waves are
  not added light: they are water, transparent only around the wave and
  under the foam line, where the sea-front takes over.
- **The bay-back's horizon is at 0.8215 W on its frame (screen 1).** The
  room slides the plate down to the run's 0.9277 W with the zoom, so a
  painting needs the sky above its frame's top as L0's frame gives it plus
  0.14 W.
- **The bay-back leaves the moon out.** The moon is its own plate (owner,
  15 Oct 2026: it shrinks a little in the run), centred in its frame and
  clear around its halo. The moonlight path stays on the bay-back's far
  sea, under screen 1's moon (0.6767 W): the moon slides with the sky, so
  it stays over its path. A painted bay-back with a moon in it would show
  two moons in the run.
- **The result picture is screen 4 whole**, waves at their measured places
  (`RESULT_VIEW`); the lit band is its rows 1.0516 to 2.2609 W.
