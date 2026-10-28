# A painting per station

Every drill at a station sits in that station's painting (`stationPainting`,
`../stations.ts`), a portrait named `station-` and the faculty's id, so
`assert-bundle.mjs` can find one by name:

| File                      | Station    | Room                                 |
| ------------------------- | ---------- | ------------------------------------ |
| `station-resolution.webp` | Resolution | The Regulator Room, its desk cleared |
| `station-function.webp`   | Function   | An organ loft                        |
| `station-shape.webp`      | Shape      | An observatory study                 |
| `station-colour.webp`     | Colour     | A stained-glass studio               |
| `station-time.webp`       | Time       | A clock tower's workroom             |

Wild keeps the glasshouse (`public/ear-lab/glasshouse-bench-portrait.webp`).
A drill at no station, Calibration among them, sits at Resolution's cleared
desk, so no painted loupe or fork ever stands behind a drawn instrument.

The files ride the Ear Lab with Merc's chunk. A build without
`EAR_LAB_WITH_MERC` resolves them to nothing (`PREMIUM_IMAGES`,
`apps/mercurypitch/vite.config.ts`), and `assert-bundle.mjs` STAGE 2 fails a
store build that carries one.

## What the room expects of one

All five keep the Regulator Room's frame, so the room's crop and its lamp hold
for each:

- Portrait, 9:16, 1440 x 2560 like `public/ear-lab/regulator-room-portrait.webp`.
- The same camera, desk and lamp: the pool of lamp light on the desk at 57% of
  the height, centred, where the room puts the instrument and its contact
  shadow, and the bulb where the room dims it.
- The wall behind the instrument plain and dark; the room's character high on
  the walls, behind the lamp, and at the right edge.
- A dark top fifth for the header and a dark bottom third for Merc's console.
- WebP, under about 400 KB. Portraits only: the room has no landscape crop.

## Where they came from

Made on Higgsfield on 28 Oct 2026 with GPT Image 2.5 (high, 4K), with the
cleared Regulator Room as the composition reference. The desk was cleared
with a masked Nano Banana 2 edit, and only the desk was blended back into the
original painting.

Every prompt shared this beginning:

> Repaint this room as a different room of the same ear laboratory, keeping the reference image's exact camera, framing and composition: the same bare wooden desk in the foreground at exactly the same size and position, its top edge at the same height and its right corner in the same place; the same brass desk lamp on the left of the desk with its glowing shade at the same spot, casting the same warm pool of light onto the desk; the same dark, moody, painterly-realistic style with deep shadows, cool dark blue-grey walls and warm brass highlights. The desk stays completely bare. Most important: exactly as in the reference, the stretch of back wall directly behind the right half of the desk, from just right of the lamp to about four-fifths across and from the lamp's height down to the desk, stays plain, dark and empty, because an instrument will stand on the desk in front of it. The room's character lives only high on the walls above that stretch, on the far left behind the lamp, and at the far right edge. The room is

and this end:

> No people, no text, no labels, no logos, no frame.

and named its room in between:

- `station-resolution.webp`: the Regulator Room itself (`public/ear-lab/regulator-room-portrait.webp`) with its desk cleared; no new room.
- `station-function.webp`: "an old organ loft: the tops of tall organ pipes in graded heights rise high along the upper wall and disappear into the dark rafters; a carved organ console with ivory keys sits in deep shadow at the far right edge; a small rack of brass tuning forks in graded sizes hangs on the far left wall behind the lamp."
- `station-shape.webp`: "a small observatory study: a large brass arc-shaped scale hangs high on the upper wall, a sextant on the far left wall behind the lamp, and an armillary sphere on a stand waits in shadow at the far right edge beside a narrow arched window showing a deep blue night sky with a few stars."
- `station-colour.webp`: "a stained-glass studio: a tall leaded stained-glass window in deep jewel colours stands at the far right edge, glowing softly with moonlight, and casts a faint, soft spectrum of coloured light high across the upper wall; small glass prisms and jars of coloured glass stand on a high shelf at the far left behind the lamp."
- `station-time.webp`: "a clock tower's workroom: great brass gear wheels and an escapement turn high on the upper wall, half lost in the dark rafters; a long pendulum hangs in shadow at the far right edge; a small snare drum and a wooden metronome stand on a high shelf at the far left behind the lamp."
