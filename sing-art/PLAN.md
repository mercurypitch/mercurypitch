# Sing room covers: plan

Status, 30 Oct 2026: **BLOCKED at generation.** Nothing was generated, no credits were spent, no
branch was made and nothing in the repo changed. Everything below is ready to run once a
Higgsfield generate tool is attached to the session.

## 0. What was checked

- ToolSearch for `+Higgsfield generate` and `image generate`: the Higgsfield connector exposes only
  `balance`, `models_list`, `models_get`, `show_generations`, `list_workspaces`,
  `workspace_select` and `import-claude-motion-from-url`. Its own server instructions say: "This
  connector cannot generate media, upload arbitrary files, or make purchases." No other route is
  allowed (no API keys, no other generator, no web UI), so the brief's stop rule applies.
- Balance: **1,057 credits**, plan "plus" (read 30 Oct 2026, before any generation).
- Model catalog, all three image pages (after 0, 20, 40). `gpt_image_2_5` (GPT Image 2.5) is
  listed: variants flare (default) and sunburst; quality low / medium / high / xhigh / max;
  resolution 1k / 2k / 4k; aspect ratios include 9:16 and 16:9; takes `image_references`.
  `nano_banana_2` (Nano Banana 2) is listed with `mask` media and `is_inpaint`, up to 4k;
  `nano_banana_2_1` (Nano Banana 2.1) is newer, also with mask and inpaint, plus seed.
- Generation history (`show_generations`) shows the 28 Oct harbour session: about 22 GPT Image 2.5
  jobs and two Nano Banana jobs. The listing carries no cost, so the per-image cost still has to be
  measured.
- Film render: `output/motion/lesson-04/renders/film-01.status` still ends in "render start
  film-01 ...", not "done". So no pnpm, builds, tests or browsers yet.
- Disk: about 1.4 GB free on /. The reference copies in `sing-art/ref/` are 1.5 MB.

## 1. Model and settings

- **Generate:** `gpt_image_2_5`, variant `flare`, quality `high`, resolution `4k`, aspect `9:16`
  for portraits and `16:9` for landscapes, no `background` parameter. These are the settings that
  made the latest house paintings (docs/plans/ear-rooms.md, the harbour). Keeping the same model
  and settings keeps the five new covers in the same light and finish as the rest of the library.
  `xhigh` is the fallback only when a `high` take fails on realism and the budget can carry it.
  Alternatives considered: Seedream 4.5 `high` (up to about 6K), Nano Banana Pro 4K and Cinema
  Studio Image 2.5 4K. None has a house track record for these rooms, and mixing generators across
  one picker shows.
- **Landscape twin:** the same model and settings with the kept portrait as an `image_references`
  input, so both orientations show the same room (this is the harbour's method).
- **Masked fixes:** `nano_banana_2` with `is_inpaint: true`, a mask, resolution `4k`. Use it for
  stray lettering or a badge on equipment, a light source that lands in the calm band, or a warped
  vertical. Only the masked region is blended back, with a feathered mask in Pillow, never the
  whole frame. Try `nano_banana_2_1` only if a 2 fix fails.
- First call: read back the output size. If 4K at 16:9 is not exactly 3840 x 2160, or 9:16 is not
  exactly 2160 x 3840, centre-crop to the exact ratio around the focal point, then scale. Any
  upscale goes into the ledger as a finding. Do not run a paid upscaler unless the output is under
  3840 on its long side.

## 2. Budget (200 credits, hard stop)

- Read `balance` before the first generation and after every one. Log each in LEDGER.md as
  before / after / delta.
- **Generation 1 is the cost probe**: Free 1 portrait (Rehearsal Attic, 9:16, high, 4k). Call its
  measured delta `c`.
- Required finals: 2 free rooms x 2 orientations plus 2 premium rooms x 2, which is 8 images. The
  optional third premium room adds 2 more, for 10.
- Allocation by `c`:
  - `c <= 14`: all 10 finals (at most 140), plus up to 4 retakes or fixes within 200.
  - `15 <= c <= 20`: 8 finals (at most 160), plus up to 2 retakes. The third premium room is dropped.
  - `21 <= c <= 25`: 8 finals (at most 200), no retakes. Every prompt has to work first time.
  - `c > 25`: one `medium` 4k probe of the same prompt. If it meets the bar in section 6, use
    medium. Otherwise make the 2 free rooms (4 images) first, then as much of one premium room as
    the rest allows, and report what is unfinished.
- Before every call: `spent + c <= 200`, or stop. A masked fix is costed by its own first measured
  delta, the same way.
- Order, so that a budget stop leaves the most useful set: Free 1 portrait, Free 1 landscape,
  Free 2 portrait, Free 2 landscape, then Premium 1 P/L, Premium 2 P/L, and Premium 3 P/L only if
  allowed.
- Disk: keep the kept masters (PNG, about 15 to 25 MB each) in `sing-art/masters/`, at most about
  250 MB for 10. Delete each rejected download as soon as the ledger records it.

## 3. The reference (what "matching" means)

The shipped cover `sing-retro-analog-studio` (public/sing/):

| File                                       | Size        | Bytes   | Est. WebP q |
| ------------------------------------------ | ----------- | ------- | ----------- |
| retro-analog-studio.webp                   | 2048 x 1152 | 316,076 | about 90    |
| retro-analog-studio-4k.webp                | 3840 x 2160 | 585,886 | about 85    |
| retro-analog-studio-portrait.webp          | 1440 x 2560 | 269,964 | about 90    |
| retro-analog-studio-portrait-2x.webp       | 2160 x 3840 | 321,200 | about 85    |

The quality column comes from re-encoding the decoded files with Pillow (method 6) and matching
sizes. That method reads slightly low, so q90 at 2K and q85 at 4K is the target. All four files
are RGB with no alpha.

The look: a photoreal interior at eye level, warm tungsten practicals against deep brown-black
shadow, low-key and quiet. The middle of the frame is a plain slat wall. The subject (the
console) sits in the lower third, and the only bright point in the band is a pendant outside the
middle 60% of the width. Calm-band luminance at 2K is a mean of 49 (sd 31) in landscape and 34
(sd 25) in portrait. The room lays a 50% black dim scrim over it (`.scrimDim` in
sing-room.module.css), so the covers must be dark rooms, and `treatment` stays the default (dark).

Calm bands (catalog comment): landscape y 0.13 to 0.58, portrait y 0.08 to 0.56. The focal point
is `{ x: 0.5, y: 0.68 }` and the room positions the cover with `background-position: x% y%` and
`background-size: cover`. One focal point serves both files, so each orientation has to put its
light low and central.

## 4. The rooms

The rules for every room: a distinct, believable place to sing, and not a studio. No people, no
Merc, no text or logos, no recognisable real venue, no brand names on anything. A dark room with
warm practical light.

| #    | Access  | id                        | Label             | Description (one line)                                 |
| ---- | ------- | ------------------------- | ----------------- | ------------------------------------------------------ |
| F1   | free    | `sing-rehearsal-attic`    | Rehearsal Attic   | Oak beams, an upright piano, one brass lamp at night   |
| F2   | free    | `sing-choir-room`         | Choir Room        | Empty timber risers in warm light after hours          |
| P1   | premium | `sing-echo-cistern`       | Echo Cistern      | Brick vaults over still water, one lantern on the walk |
| P2   | premium | `sing-snowfall-pavilion`  | Snowfall Pavilion | A glass room in snowy pines at blue hour, a lamp lit   |
| P3   | premium | `sing-ghost-light-stage`  | Ghost Light Stage | An empty stage after the show, one bare bulb burning   |

P3 is optional and depends on the budget (section 2). No new id or label collides with the catalog
(checked against main ccf341148: two piano salons and a jam attic exist, which is why there is no
"salon" or "attic" in a premium name).

## 5. Prompts (one per image)

Every prompt ends with this shared block (call it STYLE):

> Photorealistic interior photograph, eye level, 35 mm lens, natural perspective with straight
> verticals, warm tungsten practical light against deep brown-black shadow, low-key exposure, fine
> film grain, rich but muted colour, quiet and empty, as if a singer has just stepped out. No people,
> no figures, no animals, no characters, no text, no lettering, no numbers, no signage, no logos, no
> brand names or badges on any object, no posters, no screens, no recognisable real place.

The portrait layout sentence (LAYOUT-P):

> Portrait, 9:16. From 8% to 56% down, across the whole width, the frame is plain, evenly and dimly
> lit, with no lamps, windows, frames, shelves or objects in it. The brightest light in the image
> sits low, about 68% down and near the centre. The top tenth and the bottom sixth fall into shadow.

The landscape layout sentence (LAYOUT-L). It goes with the kept portrait as `image_references`:

> Landscape, 16:9: the same room as the reference image, same materials, same light, seen wider.
> From 13% to 58% down, across the whole width, the frame is plain, evenly and dimly lit, with no
> lamps, windows, frames or objects in it; any light source above 58% down stays outside the middle
> 60% of the width. The brightest light sits low, about 68% down and near the centre. The top tenth
> and the bottom sixth fall into shadow.

### F1 Rehearsal Attic

- **F1-P:** "A timber-roofed attic rehearsal room at night. The upper half of the frame is one broad,
  plain wall of warm grey limewashed plaster between two dark oak roof beams that rise at the far
  left and far right edges; the plaster is soft, even and nearly featureless. In the lower third:
  an old dark-walnut upright piano with its lid closed against the wall at the left, a brass floor
  lamp with a cream fabric shade glowing amber at the centre, an empty wooden music stand, a low
  stool with a folded wool throw, and a worn rug on dark floorboards. A small skylight at the very
  top right edge shows deep navy night." + LAYOUT-P + STYLE
- **F1-L:** "The same attic, wider: the plaster wall spans the width between the beams at the far
  edges, the piano left of centre, the lamp just right of centre, the skylight at the top right
  corner." + LAYOUT-L + STYLE

### F2 Choir Room

- **F2-P:** "A small community choir room after hours, lit by two warm brass wall lights low on the
  side walls and a little blue dusk. The upper half of the frame is a broad back wall of matte
  deep-teal painted panelling, dim and even, with no boards, notices, clocks or frames. In the
  lower third: three shallow tiers of pale ash timber risers across the room with a few empty
  wooden chairs on them, a single empty black music stand at the front centre catching the warm
  light, a short stack of plain unmarked folders on one chair, dark parquet floor. A tall window at
  the far right edge shows deep blue dusk." + LAYOUT-P + STYLE
- **F2-L:** "The same choir room, wider: the panelled back wall spans the width, the risers cross the
  lower third, the music stand at the centre, the window at the far right edge." + LAYOUT-L + STYLE

### P1 Echo Cistern (premium)

- **P1-P:** "An old underground brick water cistern at night, a place people come to sing for its
  echo. Repeating brick barrel vaults recede into darkness; the upper half of the frame is the far
  vault's dark, softly textured brick, dim and even, nearly black at the top, with no openings,
  lamps or bright joints. In the lower third a narrow stone walkway with a plain iron railing
  crosses the frame above perfectly still black water; on the walkway at the centre stands one
  hurricane lantern with a warm flame, its glow and its long mirrored reflection on the water the
  brightest part of the image. Faint warm bounce on the nearest brick columns at the left and right
  edges." + LAYOUT-P + STYLE
- **P1-L:** "The same cistern, wider: more vaults to either side fading into black, the walkway across
  the lower third, the lantern at the centre with its reflection below." + LAYOUT-L + STYLE

### P2 Snowfall Pavilion (premium)

- **P2-P:** "A minimal oak-and-glass pavilion in a snowy pine forest at blue hour, seen from inside.
  The upper half of the frame is a tall wall of glass onto softly falling snow and fog, the pines
  beyond only faint blurred shapes in deep blue-grey mist, even and quiet, no lights outside and no
  lamp reflections in that part of the glass. In the lower third, inside: a low oak bench with a
  folded wool blanket, a paper floor lamp glowing warm amber at the centre, its light pooling on a
  pale oak floor, and a plain vintage chrome microphone on a slim stand beside it, unbranded. Snow
  banks along the foot of the glass." + LAYOUT-P + STYLE
- **P2-L:** "The same pavilion, wider: the glass wall spans the width onto mist and pines, the bench,
  lamp and microphone across the lower third." + LAYOUT-L + STYLE
- Check: the mist must stay deep blue-grey (band mean at most 60 at 2K), or the scrim cannot hold
  the trace's contrast.

### P3 Ghost Light Stage (premium, optional)

- **P3-P:** "An empty small theatre stage after the show, seen from the stage itself. The upper half
  of the frame is the plain, deep charcoal back wall of the stage, matte and even, with no rigging,
  lights, ladders or markings. In the lower third, at the centre of worn black stage boards, a
  ghost light: one bare warm bulb in a simple wire cage on a plain stand, the brightest point of
  the image, throwing a soft pool of light on the boards; a single wooden chair and an empty
  microphone stand at the edge of the pool, unbranded. A fold of dark red curtain at the far left
  edge." + LAYOUT-P + STYLE
- **P3-L:** "The same stage, wider: the back wall spans the width, the ghost light at the centre of the
  boards, the chair and the stand nearby, the curtain at the far left edge." + LAYOUT-L + STYLE

## 6. The bar each kept image must pass

The script lives in the scratchpad, Pillow under `python3 -I`, and takes paths as arguments:

1. The size and ratio are exact, or are corrected as in section 1.
2. **Calm band:** the luminance of the band at 2K has a mean of at most 60 and an sd of at most 34
   (the shipped cover is 49 / 31 in landscape and 34 / 25 in portrait). In the middle 60% of the
   width inside the band, at most 0.2% of pixels have L > 200.
3. **Focus low:** the brightest 1% of the pixels has its centroid between y 0.60 and 0.78 and
   between x 0.35 and 0.65.
4. A by-eye pass at 100% crops over the whole frame: no lettering, numbers, badges or logos on any
   object (pianos, stands, microphones, lamps), no people or faces in shadows, no warped verticals.
   A failure gets one masked Nano Banana 2 fix, or a retake if the budget allows.
5. A side-by-side with the shipped cover under a simulated 50% black scrim (a preview JPEG in
   `sing-art/review/`), for realism and light.

## 7. Crop and encode (free covers)

From each kept master:

| Out file                         | Size        | Encoder settings              | Byte target (shipped)   |
| -------------------------------- | ----------- | ----------------------------- | ----------------------- |
| `<room>.webp`                    | 2048 x 1152 | WebP q90, method 6, no meta   | about 316 KB            |
| `<room>-4k.webp`                 | 3840 x 2160 | WebP q85, method 6, no meta   | about 586 KB            |
| `<room>-portrait.webp`           | 1440 x 2560 | WebP q90, method 6, no meta   | about 270 KB            |
| `<room>-portrait-2x.webp`        | 2160 x 3840 | WebP q85, method 6, no meta   | about 321 KB            |

- Resample with Lanczos. Crop only to fix the ratio, with the crop window keeping the measured
  focus at about y 0.68. Then re-run section 6's band check on the encoded 2K files.
- Encoder: Pillow WebP (`quality`, `method=6`, RGB, no exif or icc). cwebp is not installed; ffmpeg
  libwebp is the fallback. Keep every file at 600 KB or under (the bound the Drum file test uses).
  If a 4K file goes over, step q down to 82 rather than shrink it.
- File names: `public/sing/rehearsal-attic{,-4k,-portrait,-portrait-2x}.webp` and
  `public/sing/choir-room{,-4k,-portrait,-portrait-2x}.webp`.
- Premium masters: keep the full-size PNGs in `sing-art/masters/` as
  `<id>-portrait-master.png` and `<id>-landscape-master.png`. Also write Studio-ready variants
  there, because Studio's variants are `landscape-2k`, `landscape-4k` and `portrait-2k`:
  `<id>-landscape-2k.webp` (2048 x 1152), `<id>-landscape-4k.webp` (3840 x 2160) and
  `<id>-portrait-2k.webp` (1440 x 2560), with the same encoder settings. Never under `public/`,
  never in git.

## 8. Code changes (branch `feat/sing-room-covers` from origin/main, worktree `presses`)

Setup, after the film reads "done":

```bash
cd /home/user/mercurypitch/.claude/worktrees/presses
git fetch origin main
git switch -c feat/sing-room-covers origin/main
pnpm install --frozen-lockfile --offline
ls workers/db-worker/migrations | tail -3   # main ends at 0071_lesson_state.sql today
```

### 8.1 `src/lib/backgrounds/background-catalog.ts`

1. `CURRENT_FREE_BACKGROUND_IDS`: after `'sing-retro-analog-studio'` append
   `'sing-rehearsal-attic', 'sing-choir-room'`, and rewrite the comment above it. The Sing room's
   covers are free and public because the native Sing tab IS a room. The Retro Analog Studio stays
   the default (S4), and the two new covers are choices beside it.
2. A new pack constant after `EAR_ROOMS_BACKGROUND_IDS`:
   ```ts
   /** The Sing room's supporter covers: three more places to sing, delivered
    *  from R2 like every other supporter identity. The free covers ship from
    *  `public/sing/`. */
   export const SING_ROOMS_BACKGROUND_IDS = [
     'sing-echo-cistern',
     'sing-snowfall-pavilion',
     'sing-ghost-light-stage', // only if P3 was made
   ] as const
   ```
3. `BACKGROUND_PERK_IDS`: append `...SING_ROOMS_BACKGROUND_IDS` LAST. The catalog test asserts
   that the supporter entries, in catalog order, equal `BACKGROUND_PERK_IDS`.
4. `BackgroundEdition`: add `| 'sing-rooms'`. One shared edition, as with `'ear-rooms'`.
5. Catalog entries, appended after the `sing-retro-analog-studio` entry, at the very end of
   `BACKGROUND_CATALOG`. That order keeps both order assertions true. Fill in the focal points
   from the measured centroids, rounded to 0.01. Both stay near `{ x: 0.5, y: 0.68 }`.
   ```ts
   {
     id: 'sing-rehearsal-attic',
     surface: 'sing',
     label: 'Rehearsal Attic',
     description: 'Oak beams, an upright piano, one brass lamp at night',
     edition: 'core',
     delivery: 'shipped',
     access: { kind: 'free' },
     assetSource: publicSource(
       '/sing/rehearsal-attic.webp',
       '/sing/rehearsal-attic-4k.webp',
       '/sing/rehearsal-attic-portrait.webp',
       '/sing/rehearsal-attic-portrait-2x.webp',
     ),
     // The lamp and the piano sit in the lower third, so the calm band the
     // trace lives in (landscape y 0.13-0.58, portrait y 0.08-0.56) is plain
     // plaster between the beams.
     focalPoint: { x: 0.5, y: 0.68 },
   },
   {
     id: 'sing-choir-room',
     surface: 'sing',
     label: 'Choir Room',
     description: 'Empty timber risers in warm light after hours',
     edition: 'core',
     delivery: 'shipped',
     access: { kind: 'free' },
     assetSource: publicSource(
       '/sing/choir-room.webp',
       '/sing/choir-room-4k.webp',
       '/sing/choir-room-portrait.webp',
       '/sing/choir-room-portrait-2x.webp',
     ),
     // The risers and the lit music stand sit low; the band is the plain
     // panelled back wall.
     focalPoint: { x: 0.5, y: 0.68 },
   },
   {
     id: 'sing-echo-cistern',
     surface: 'sing',
     label: 'Echo Cistern',
     description: 'Brick vaults over still water, one lantern on the walk',
     edition: 'sing-rooms',
     delivery: 'master-ready',
     access: supporterAccess('sing-echo-cistern'),
     assetSource: protectedSource('sing', 'sing-echo-cistern'),
     focalPoint: { x: 0.5, y: 0.7 },
   },
   {
     id: 'sing-snowfall-pavilion',
     surface: 'sing',
     label: 'Snowfall Pavilion',
     description: 'A glass room in snowy pines at blue hour, a lamp lit',
     edition: 'sing-rooms',
     delivery: 'master-ready',
     access: supporterAccess('sing-snowfall-pavilion'),
     assetSource: protectedSource('sing', 'sing-snowfall-pavilion'),
     focalPoint: { x: 0.5, y: 0.68 },
   },
   {
     id: 'sing-ghost-light-stage',
     surface: 'sing',
     label: 'Ghost Light Stage',
     description: 'An empty stage after the show, one bare bulb burning',
     edition: 'sing-rooms',
     delivery: 'master-ready',
     access: supporterAccess('sing-ghost-light-stage'),
     assetSource: protectedSource('sing', 'sing-ghost-light-stage'),
     focalPoint: { x: 0.5, y: 0.68 },
   },
   ```
6. `DEFAULT_BACKGROUND_IDS.sing` stays `'sing-retro-analog-studio'`.

### 8.2 `workers/db-worker/src/premium-background-catalog.ts`

`SURFACE_BY_ID` is a `Record<PremiumBackgroundId, ...>`, so typecheck demands three entries,
after the drum ones: `'sing-echo-cistern': 'sing'`, `'sing-snowfall-pavilion': 'sing'` and
`'sing-ghost-light-stage': 'sing'`.

### 8.3 `workers/db-worker/migrations/0072_sing_rooms_background_pack.sql`

The number is whatever follows main's last migration at branch time. Check open PRs for a
clashing 0072 too. The shape is 0035's: a header comment that says it seeds identities and the
automatic supporter assignment only, and that nothing is runtime-visible until Studio publishes
a complete revision. 0044 already admits `'sing'`, so no table rebuild.

```sql
INSERT OR IGNORE INTO premiumBackgroundAssets
  (id, surface, title, description, status, activeRevisionId, createdAt,
   updatedAt, retiredAt)
VALUES
  ('sing-echo-cistern', 'sing', 'Echo Cistern',
   'Brick vaults over still water, one lantern on the walk.',
   'active', NULL, '<date>T00:00:00.000Z', '<date>T00:00:00.000Z', NULL),
  ('sing-snowfall-pavilion', 'sing', 'Snowfall Pavilion',
   'A glass room in snowy pines at blue hour, a lamp lit.',
   'active', NULL, '<date>T00:00:00.000Z', '<date>T00:00:00.000Z', NULL),
  ('sing-ghost-light-stage', 'sing', 'Ghost Light Stage',
   'An empty stage after the show, one bare bulb burning.',
   'active', NULL, '<date>T00:00:00.000Z', '<date>T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO premiumSupporterGroupPerks
  (groupId, backgroundId, assignedAt, revokedAt)
SELECT g.id, a.id, '<date>T00:00:00.000Z', NULL
  FROM premiumSupporterGroups g
  JOIN premiumBackgroundAssets a
    ON a.id IN ('sing-echo-cistern', 'sing-snowfall-pavilion',
                'sing-ghost-light-stage')
 WHERE g.slug = 'active-supporters'
   AND g.kind = 'automatic'
   AND g.deletedAt IS NULL
   AND a.surface = 'sing';
```

### 8.4 `src/features/backgrounds/PremiumBackgroundPicker.module.css`

Add `.edition_sing-rooms { ... }`, the placeholder wash a locked card and a slow protected preview
start in. Its colours come from the kept premium masters: a warm amber radial on a deep
brown-slate linear, in the same shape as `.edition_ear-rooms`. Put it after the Drum Rooms block
with a one-line comment.

### 8.5 `src/features/admin/AdminPremiumPerksPage.tsx` (needed for the owner)

`BACKGROUND_SURFACE_FILTERS` has no `sing` entry. `assignableBySurface` builds Studio's
per-surface assignment bands from that list, so a Sing supporter room would never appear in a
group-assignment band, and the filter cannot pick it out. Add `{ id: 'sing', label: 'Sing' }`
after Drum Night. `backgroundSurfaceLabel` already handles `'sing'`.

### 8.6 Native packaging (the free covers have to reach the binary)

- `apps/mercurypitch/native-assets.mjs`: the Sing entry's glob is `sing/retro-analog-studio*.webp`.
  Widen it to `sing/*.webp`, which matches the three free covers' 12 files and nothing else
  (premium never sits under public/). Rewrite its comment and reason to say three covers, all four
  variants, chosen in the room's picker.
- `.github/workflows/mercurypitch-mobile.yml`: in `paths:`, change
  `'public/sing/retro-analog-studio*.webp'` to `'public/sing/*.webp'`. In `changed-paths-regex`,
  change `public/sing/retro-analog-studio[^/]*\.webp$` to `public/sing/[^/]*\.webp$`.
- `apps/mercurypitch/scripts/probe-bundle.mjs` (about line 2166): it throws unless the picker
  offers exactly one cover. Make it expect the three free covers in catalog order (Retro Analog
  Studio first), still asserting that the retired B and mock takes are absent and that the current
  cover is a `/sing/retro-analog-studio...` file (the default is unchanged). Update its step text.
- Size: the binary grows by about 3 MB (2 x about 1.49 MB). The download gate warns at 60 MB and
  fails at 150 MB (mercurypitch-mobile.yml). Note the new size from the PR's CI run.

### 8.7 Tests

- `src/lib/backgrounds/background-catalog.test.ts`:
  - `lists only shipped choices ...`: add `listBackgrounds('sing')` equal to the three free ids,
    and `{ includeUnshipped: true }` equal to those plus `...SING_ROOMS_BACKGROUND_IDS`.
  - `defines a shipped free fallback for every surface`: add `'ear'` and `'sing'` to the list
    (both have one today; the test just never named them).
  - A new case, `ships all four real, bounded files for every free Sing cover`: for each of the
    three free sing ids, each of landscape, landscape2x, portrait and portrait2x is defined and
    starts RIFF....WEBP. Each is over 20 KB and at most 600 KB, and `sharp` reads exactly 2048 x
    1152, 3840 x 2160, 1440 x 2560 and 2160 x 3840.
- `src/lib/backgrounds/sing-rooms.test.ts` (new, the same shape as ear-rooms.test.ts): the sing
  surface's free ids are exactly the three, and `SING_ROOMS_BACKGROUND_IDS` is exactly the pack.
  Each pack room is supporter with key `backgrounds/sing/<id>`. The worker source contains
  `'<id>': 'sing'`. The migration contains `('<id>', 'sing', '<label>'`, `premiumSupporterGroupPerks`
  and `g.slug = 'active-supporters'`. The picker CSS contains `.edition_sing-rooms {`. Labels are
  unique across the whole catalog.
- `src/features/sing-room/SingRoomPicker.test.tsx`: swap the invented `sing-fixture-second-cover`
  for the real Rehearsal Attic option and drop the "The surface ships one today" comment. The
  behaviour asserted stays the same.
- Unchanged but run: `src/features/premium-exercises/card-contrast.test.ts` (it reads CSS only),
  `src/lib/backgrounds/premium-background-surface-check.test.ts`, the other background suites,
  `src/features/sing-room/`, `src/components/room-kit/PlateImage.test.tsx`, `plate-loader.test.ts`,
  `apps/mercurypitch/src/alley/` and `workers/db-worker` (premium-backgrounds and
  premium-background-admin tests, node-tests migration test).
- Docs: `docs/specs/supporter-backgrounds.ears.md` BG-CAT-1, BG-CAT-2 and BG-CAT-7 name the
  surfaces only up to Drum. Add the Sing room, and the new migration to its file list.
- Then run `pnpm docs:index` if the new test file changes docs/agent/INDEX.md (CI runs
  `docs:index:check`).

Commands, after the film is done:

```bash
pnpm check
pnpm vitest run src/lib/backgrounds src/features/sing-room src/features/backgrounds \
  src/features/premium-exercises/card-contrast.test.ts src/components/room-kit \
  src/features/admin apps/mercurypitch/src/alley
pnpm test:db
pnpm typecheck:db
pnpm docs:index:check
```

### 8.8 Commits (repo style: `type(scope): Sentence`, the configured identity, no trailers)

1. `feat(sing-room): Two more free covers to sing in, the Rehearsal Attic and the Choir Room`
   (the images, the catalog entries, native-assets, the workflow paths, probe-bundle, and the
   catalog and picker tests).
2. `feat(sing-room): Three supporter rooms for the Sing room, ready for Studio` (the pack
   constant, the worker map, the migration, the CSS wash, the Studio filter, sing-rooms.test.ts
   and the spec).

## 9. The PR (against main, no template in the repo)

**Title:** `feat(sing-room): More covers for the Sing room, two free and three for supporters`

**Body outline:**

- **What:** two new free covers ship in `public/sing/` in the shipped cover's four files and
  sizes. Three supporter rooms join the catalog as `master-ready` identities with their seed
  migration. The Retro Analog Studio stays the default.
- **The free covers:** for each, a link to `public/sing/<room>-portrait.webp` and `<room>.webp`
  on the branch (blob URLs), with the label, the description and the focal point.
- **The supporter rooms:** for each, a prose description, the generation ids of the portrait and
  landscape masters and the settings (resolution, quality, aspect, reference image), and where the
  masters are. Not committed.
- **Credits:** the total spent, from the ledger.
- **For the owner:** publish each supporter room in Premium Studio (filter: Sing) by uploading
  landscape-2k, landscape-4k and portrait-2k, then publishing the revision. Until then the rooms
  are invisible. Apply migration 0072 through the normal deploy.
- **Check on a phone:** each free cover in the picker, upright and on its side. The trace stays
  readable over each band at the default glass and at both ends of the slider. The cards of the
  exercise picker over each cover. The Sing door's open from the alley ends on the chosen cover,
  and the door's own loop still shows the Retro Analog Studio (see open items). The binary's size
  line in CI.
- **Tests:** what passed.

## 10. Open items (for the owner, whatever happens)

- **The generate tool.** The Higgsfield connector in this session reads only. A connector or
  session with Higgsfield generation is needed to run section 2 onwards.
- **The room's name doesn't follow the cover.** `ROOM_NAMES.sing` (src/features/rooms/room-names.ts)
  is fixed at "Retro Analog Studio", and the header chip, the session pill and the alley door all
  say it whatever cover is picked. Showing the picked cover's label there is a separate change.
- **The alley door.** The Sing door plays `rooms/alley/retro-analog-studio-portrait-loop.mp4` and
  carries it into the room. With another cover picked, the handover ends on a different picture
  (alley-entry waits on the room's computed background, so it will not break, but it will cut).
- **A wording clash in the brief.** The brief asks the PR body to list each premium generation's
  model and settings, and also says "no model names in the PR". The reading here: no assistant
  model names or attribution. Give the image model by its Higgsfield id with the generation ids,
  unless the owner says otherwise.
