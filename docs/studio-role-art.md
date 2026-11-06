# Studio role pictures

> **Retired on 2026-11-06.** Lane headers now show the Studio's own
> instrument glyphs in family-tinted chips
> ([studio-instrument-glyphs.md](studio-instrument-glyphs.md)), and the
> "Role pictures" setting, `role-pictures.ts`, `role-icons.tsx` and the ten
> WebP files are gone. This page stays as the record of how the pictures were
> made and why they were dropped: at 56 px on a 64 px plate they cost a fifth
> of the header, and at the 20 px a compact lane has they did not read.

One picture per track role for the role plate at the left of each Studio lane
header (`src/features/studio/timeline/StudioLaneHeader.tsx`), also shown in the
phone's Mix sheet. With **Role pictures** off in Track details, the plate shows
the role's line icon instead (`role-icons.tsx`); the choice is kept on the
device (`role-pictures.ts`).

Runtime assets: `public/studio/roles/<role>.webp`, one per role in
`TRACK_ROLES`, each 128 x 128 WebP with alpha. Drawn 56 px tall in a desktop or
tablet lane header and 36 px in the phone Mix sheet. One tier on purpose: a
`srcset` picks its 1x or 2x once, at load, so a page zoomed later would stretch
a 64 px file; 128 px stays sharp to about 230% zoom and is never more than 3.6
times too big. `StudioLaneHeader.test.tsx` fails when a role has no file.

| Role            | Bytes | Role    | Bytes  |
| --------------- | ----- | ------- | ------ |
| voice           | 5,000 | piano   | 7,720  |
| backing-vocals  | 6,818 | keys    | 5,026  |
| acoustic-guitar | 5,176 | drums   | 10,998 |
| electric-guitar | 5,720 | backing | 4,688  |
| bass            | 5,598 | other   | 7,566  |

All ten: 64,310 bytes. A lane loads only its own role's file, and only while
pictures are on.

## How they were made

Generated on 2026-11-04 with the built-in image tool in the Codex CLI
(OpenAI), no reference images. Three sets of the same ten subjects were made:

- **P**, Codex with a neutral studio light.
- **R**, Codex with the rim-light brief below. Shipped.
- **G**, Google's model through the Antigravity CLI, on a magenta ground for
  keying, since it returns no alpha.

Then R's keys and drums were made again with the same brief (subjects below).

### Style brief (set R)

```text
Asset type: a small instrument picture for the track headers of MercuryPitch, a singing and music recording app. It is shown 40 to 48 pixels tall on a softly coloured rounded tile, in both a dark and a light theme, so it must read at that size.
Style: premium tactile near-photoreal 3D product illustration of one unbranded object. Three-quarter view from slightly above. The whole object is centered and fills about 85 percent of a square frame, with a strong, simple silhouette that still reads when shown 40 pixels tall. Natural materials with clear value contrast between parts.
Light: a soft warm key light from the upper left, plus a thin cool rim light from behind that traces the object's outline in the app's colours, shifting from blue to teal to violet along the edge, so even black parts separate from a dark background. The rim stays on the object's own edges: no glow, haze or halo outside the silhouette, no neon. Restrained shadows kept on the object, no cast shadow on any surface.
Background: genuinely transparent background with preserved alpha, not a checkerboard pattern.
Never include: people, hands, text, letters, numbers, logos, brand marks, decals, watermarks, a floor, a backdrop, a frame or badge, extra objects.
```

### Subjects

| Role            | Subject                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| voice           | a classic handheld vocal microphone with a silver ball grille and a matte black handle, lying diagonally with the grille at the upper right                                                                                                                                                                                |
| backing-vocals  | two matching handheld vocal microphones leaning together side by side, silver ball grilles at the top and matte black handles, slightly fanned apart                                                                                                                                                                       |
| acoustic-guitar | a natural spruce-top acoustic guitar with a warm honey-coloured top, a dark rosewood fingerboard and a round sound hole, lying diagonally from lower left to upper right                                                                                                                                                   |
| electric-guitar | a solid-body electric guitar with a glossy cherry-red body of an original shape, a white pickguard, two pickups, a maple neck with a dark fingerboard and six tuning pegs on one side, lying diagonally from lower left to upper right                                                                                     |
| bass            | a four-string electric bass guitar with a glossy deep metallic blue body of an original shape, a black pickguard, a long maple neck with a dark fingerboard and four large tuning pegs, lying diagonally from lower left to upper right, its neck clearly longer than a guitar's                                           |
| piano           | a small black grand piano with its lid propped open and the keyboard facing the viewer, seen three-quarter from the front                                                                                                                                                                                                  |
| keys (re-made)  | a compact synthesizer keyboard with two octaves of white and black keys and a dark grey control panel with a few round knobs and two small sliders, turned about 35 degrees and seen from the front left and above, so its depth shows as clearly as its width, posed like a grand piano seen three-quarter from the front |
| drums (re-made) | a compact drum kit with natural honey walnut wood shells (not black), plain white coated heads with nothing printed on them, chrome hardware, a bass drum whose front head is plain and blank, a snare, one rack tom, a floor tom and two brass cymbals on stands, seen three-quarter from the front                       |
| backing         | a black vinyl record with a plain warm orange centre label, half out of a plain kraft-paper sleeve, both completely blank                                                                                                                                                                                                  |
| other           | a pair of over-ear studio headphones with a padded headband and round ear cups, matte black with silver hinges, seen three-quarter from the front                                                                                                                                                                          |

### From the 1254 px masters to the shipped files

Every master has faint pixels at alpha 1 or 2 scattered over the canvas, which
stop a plain trim. Each file was cleared below alpha 3, trimmed to its object,
centred on a square with a 3% margin, scaled with Lanczos and saved as WebP:

```bash
box=$(magick "$f" -alpha extract -threshold 1.1% -format '%@' info:)
magick "$f" -channel A -fx 'a<0.011?0:a' +channel -crop "$box" +repage \
  -background none -gravity center -extent "${side}x${side}" \
  -filter Lanczos -resize 128x128 \
  -quality 90 -define webp:alpha-quality=100 -define webp:method=6 "$role.webp"
```

`side` is the larger of the box's sides plus 3%. The re-made drums first had a
faint pale halo above the crash cymbal (5,905 pixels more than 3 px outside the
kit lifted the dark plate by up to 28 levels), removed by multiplying the alpha
by the alpha >= 50% shape grown by a 3 px disk.

## Verdict

```text
Verdict 2026-11-04-mp-studio-role-art
Pick: set R (Codex, rim-light brief), its keys and drums re-made in the same brief, the drums' halo cleared
Ranked: R with the re-made keys and drums; R as first made; P
Out on evidence: G: VIS-06, keying its magenta ground left magenta in enclosed gaps and along the edges; the re-made drums as delivered: VIS-06, a halo above the crash, cleared before shipping
Reasons: R meets VIS-18 and UI-14 (the dark theme decides, and on the dark plates its rim lifts the black parts: outline contrast as colour difference, mic 34 against P's 20, two mics 32 against 16, acoustic 28 against 16, piano 24 against 18, headphones 23 against 14), VIS-03 (a warm key and a rim in the app's blue, teal and violet: more light and life) and VIS-19 (one generator for all ten). P is clean and consistent and its drums outlined best (31 against R's 24), but it loses the dark-plate read in six roles of ten. VIS-13 for R's two weak pictures: the keys re-made at a three-quarter angle (56 x 38 in the slot, from 56 x 29), the drums with walnut shells (whole-object contrast on the dark violet plate 58.7, from 39.3).
Confidence: medium. Stated rules decide it, but from other surfaces; the reviewer found the rim a little neon on the light theme, which no rule covers.
Would change the pick: maff finding the rim busy or neon, especially in the light theme; set P, the same subjects in a neutral light, is the ready swap.
```

Reviewed by a separate agent at 512 px on grey and on a checker, at 1:1 on the
risky details (drum heads, record labels, pickguards, headstocks, synth panels),
and in the slot at 56 px and 28 px on each role's dark and light plate. None of
the twenty first pictures had text, logos, people, hands, extra objects, floors
or cast shadows.

## The dark plate's light

On the dark theme's deep plates, the pictures' darkest parts sank: the
microphones' black handles, the bass's navy body, the acoustic's headstock. A
light in the lane's hue now sits behind each picture: 45% of a mix of the hue
and the text colour over the plate ground, flat to 30 px from the centre and
gone by 60 px, so it reaches the corners of the 56 px picture, where the
diagonal instruments end (`StudioLaneHeader.module.css`). The phone Mix sheet's
36 px tile has the same light scaled to 19 and 39 px. The light theme has none.

Measured on the browser's own pixels at 2x, in the dark theme, all ten roles.
Four shots of each plate (as shown, the plate alone, the picture on black and
on white) give every pixel's exact alpha. At each outline point (alpha at
least 0.5 beside a pixel under 0.5) the score is the WCAG contrast between the
picture's opaque pixels within 2 px and the bare plate within 3 px. Dark parts
are outline points where the picture's luminance is under 0.04, light parts
over 0.35. Each cell is the median of the ten roles' medians, or the mean of
their shares under 1.5:1:

| Plate                       | Outline    | Dark parts | Light parts |
| --------------------------- | ---------- | ---------- | ----------- |
| Flat (before)               | 1.30 (66%) | 1.24 (89%) | 5.85 (0%)   |
| Hue light 45%, 30 to 60 px  | 1.85 (18%) | 1.87 (9%)  | 2.28 (0%)   |
| Hue light 55%, 30 to 60 px  | 1.98 (15%) | 2.03 (5%)  | 1.90 (26%)  |
| Grey light 45%, 30 to 60 px | 2.02 (15%) | 2.06 (4%)  | 1.81 (31%)  |
| Grey light 35%, 16 to 38 px | 1.33 (53%) | 1.27 (70%) | 3.11 (0%)   |

Shipped: the 45% hue light. Every role's dark parts improve (the voice
picture's from 98% under 1.5:1 to 17%), and no light part drops under 1.5:1.
At 55% the dark parts gain a little more, but the light parts (white keys,
silver grilles and hinges, drum heads) lose their edge against the paler
plate: 26% of them fall under 1.5:1. A grey light of the same reach greyed the
lane colours (OKLab chroma within 28 px of the centre down 36 to 69%, where
the hue light raises it 20 to 50%), and the small one left the ends of the
diagonal instruments dark.
