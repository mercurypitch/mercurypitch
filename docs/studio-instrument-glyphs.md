# Studio instrument glyphs

Each Studio lane shows its instrument as a glyph in a small chip tinted by the
instrument's family: in the lane header, in the phone's Mix sheet and in the
Instrument picker in Track details. The pack is the app's own, drawn on the
grid and stroke of its Lucide-style system icons so the two sit together. It
replaced the role pictures on 2026-11-06 ([studio-role-art.md](studio-role-art.md)
is their history).

| Where                    | What                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Drawings                 | `src/features/studio/instruments/glyph-drawings.ts`, one SVG body per glyph           |
| Glyph and chip           | `InstrumentGlyph.tsx` and `InstrumentGlyph.module.css` beside it                      |
| Families, glyphs, labels | `src/lib/studio/instruments/glyph-catalog.ts`                                         |
| What a track says        | `import-sources.ts` (GM programs, kits, keys, stems, roles), `name-rules.ts`          |
| The resolver             | `resolve.ts`: `resolveInstrument`, and `studioLaneInstrument` for a lane              |
| Contact sheet and check  | `node scripts/instrument-glyph-sheet.mjs --out=sheet.png --themes=dark,light --check` |

## Drawing rules

- `viewBox="0 0 24 24"`, stroke 2 in `currentColor`, round caps and joins,
  `fill="none"` on the root. Ink stays 1 unit clear of every edge and its box
  is centred on (12, 12) within half a unit; `--check` measures both.
- Parallel strokes keep 2 units apart (4 centre to centre). A part whose
  counter would close below 2 units is drawn solid: black keys, a scroll, valve
  buttons, the flute's tube.
- A part that passes behind another is knocked out with a mask whose shapes
  set `stroke="none"` or an explicit black stroke; a shape without one inherits
  the root's stroke and fills every hole on a dark theme. Masks are named
  `$k`, made unique per instance by the component.
- Guitars, basses, the banjo, the lute and the flute lie on the 45 degree
  diagonal, head to the upper right. Bowed strings stand upright. Brass bells
  open to the right, the tuba's upward.
- No letters, numbers, brand shapes or real models. Mark fine detail
  `data-fine`: it drops out at 16 px.
- One drawing serves every size. The size class sets the stroke: 2.25 units at
  16 px (1.5 px on screen), 2 at 20 and 24, 1.5 at 32 and up.

### What the drawings had to avoid

A glyph that reads as a UI symbol at 20 px is worse than a plain one. The
review rounds found: a bow across a violin reads as "disabled", a whole drum
kit as a face, a round coil with a bell as a magnifier or a fish, a kettle on
legs as a grill, three dots in a round body as a face, four dots in a bar as a
password field, a bell as notifications, a keypad with a display as a
calculator, a block with a stick as a radio, drawbars as candles, sparkles as
the app's own magic, and a closed head cut open at the foot as an omega. The
comment over each drawing says which trap it was drawn around.

Weakest today, at 20 px: Claps, Bagpipes, Wood block and the French horn read
as their instruments mostly through their colour and the lane's name.

## Chips and colour

| Place               | Chip  | Glyph |
| ------------------- | ----- | ----- |
| Desktop lane header | 28 px | 20 px |
| Tablet lane header  | 32 px | 24 px |
| Phone lane header   | none  | 16 px |
| Phone Mix sheet     | 32 px | 24 px |
| Instrument picker   | 40 px | 24 px |

Ground `color-mix(hue 20%, --studio-bar)` and ink `color-mix(hue 62%,
--studio-text)` in the dark themes, 14% and 70% in light. Glyph ink on chip
ground measures 6.3 to 7.2 : 1 dark and 4.6 to 5.7 : 1 light for every hue,
above the 3 : 1 of WCAG 1.4.11. Every dark preset mixes with its own bar and
text. A silent lane's chip goes neutral; under forced colours the chip keeps a
1 px `CanvasText` border.

Colour follows the part a track plays, not how its sound is made:

| Hue           | Families                                                     |
| ------------- | ------------------------------------------------------------ |
| rose          | Voice                                                        |
| teal          | Keys                                                         |
| amber         | Plucked strings (the electric guitar moved here from orange) |
| orange        | Bass                                                         |
| violet        | Drum kit, hand and auxiliary percussion, pitched percussion  |
| green         | Backing and mix                                              |
| sky (new)     | Bowed strings                                                |
| lime (new)    | Brass, woodwinds                                             |
| fuchsia (new) | Synths and electronic                                        |
| slate (new)   | FX and other                                                 |

A lane takes its instrument's family hue. A lane nothing describes (an
`other` lane whose name no rule reads) keeps the rotation of the six lane
hues, so neighbours still differ.

## Which glyph a lane draws

`resolve.ts`, first answer wins:

1. the instrument the singer picked (`StudioTrack.instrument`);
2. import evidence: a GM percussion key, drum kit or program, or a stem;
3. the lane's name, when the rule's family fits the lane's role, or the role
   is `other`;
4. the role's own glyph;
5. plain audio.

An explicit role beats a stale name: a voice lane named "Guitar take 3" keeps
the microphone. A Studio lane carries no MIDI or stem data yet, so its
evidence is its pick, its name and its role. The name is the file's name, as
an import names its lane.

`instrument` is saved only when the singer picks one, so a song nobody picked
for stays readable by a Studio from before the field. A song with a pick does
not open in such an older Studio: its strict validation refuses a field it
does not know (`record` in `src/lib/studio/model/validation-values.ts`), as it
refuses a lane's lines or a loop take's passes. A well-formed glyph id this
build does not draw is kept and passed over, so a song from a newer Studio with
more glyphs opens, keeps its pick, and shows what its name and role say.

## Adding a glyph

1. Add the id, family, label and search words to `glyph-catalog.ts`. An id is
   saved in songs: never rename or reuse one.
2. Draw it in `glyph-drawings.ts` with a comment saying what it draws and what
   it was drawn to avoid reading as.
3. Map it from `import-sources.ts` or `name-rules.ts` where it applies.
4. Run the sheet with `--check` and attach the sheet to the pull request.
   `InstrumentGlyph.test.tsx` lints the markup and `resolve.test.ts` the map.
