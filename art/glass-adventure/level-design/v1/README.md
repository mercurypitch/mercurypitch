# Cloudway melody route study

25 September 2026. Planning and wireframes only; no playable level is added.

Open `review.html` locally or through the existing development server. It needs
no network libraries, microphone permission or audio. Select Current, A, B, C,
or Platform + wall roles. Click any drawing to open its full-size SVG.

- `route-current.svg`: actual current crescent platform proportions at c4632528.
- `route-thawing-song.svg`: recommended five-note garden crescent.
- `route-switchback.svg`: more pronounced directional changes and screened courts.
- `route-braided.svg`: optional detour after note 3, rejoining before note 4.
- `platform-roles.svg`: mixed platform proportions and an explicit frost barrier.

Only the current footprint is drawn from measured runtime bounds. The proposals
are encounter/pacing schematics; gaps, camera clearance and geometry must be
validated in a selected playable blockout. None is a claim of finished art.

Regenerate the five SVGs from the repository root:

```sh
python3 art/glass-adventure/level-design/v1/build_wireframes.py
```

See the [full proposal](../../plans/MELODY-CLOUDWAY-LEVEL-DESIGN-2026-09-25.md)
for the factual audit, primary research, authoring/persistence contracts and
staged task list. All three proposed routes teach the same five-note phrase;
the optional branch does not bypass a required note or add another one.

Verification: five SVGs parsed; review buttons loaded every drawing in a real
browser; desktop and 390px phone layouts inspected, without horizontal overflow
or page errors. This verifies the design board, not the proposed game's physics.
