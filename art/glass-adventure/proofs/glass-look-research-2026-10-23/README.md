# Glass look research, 2026-10-23

The evidence behind
[`docs/plans/glass-look-system-2026-10-23.md`](../../../../docs/plans/glass-look-system-2026-10-23.md).

| File                                 | What it holds                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `report.md`                          | The synthesis: why the glass reads dull, and how to fix the glass, the exhibit light, breaking and the pipeline               |
| `notes-glass-shading.md`             | three.js r185 transmission mechanics, techniques for luminous coloured and milky glass, extension status, tiers               |
| `notes-lighting-and-presentation.md` | How photographers and museums light glass, the real-time equivalents and their costs, the tone mappers compared               |
| `notes-fracture-and-shatter.md`      | Fracture patterns, what makes a break read as glass, physics and rendering options                                            |
| `notes-pipeline-and-lookdev.md`      | Separating shape from look: material instances, look-development benches, clay references, image-to-3D inputs, material cards |
| `notes-codebase-current-state.md`    | A read-only audit of the game at `e53b8fe`, with file and line references                                                     |
| `tools/tonemap/`                     | A numpy port of three r185's ACES, AgX and Neutral tone mappers, and the scripts behind the report's colour tables            |

How it was made: four online surveys run side by side, a read-only audit of the
code, then one synthesis. Claims about three.js internals were checked against
the installed `three@0.185.1` source. The colour tables are computed with the
port, not measured in the game. Nothing was measured on a phone.

Two facts in the notes describe the separate glass3d chamber game in
`apps/beside-cue/src/games/glass3d/`, not the museum: the exposure of 1.2 in
the lighting note and the shard material in the fracture note. The report and
the audit give the museum's values (ACES at exposure 0.9; shards reuse the
vessel's own materials).

Re-run the tables (numpy only):

```sh
python3 tools/tonemap/tm.py 0.9                          # swatches through each tone mapper
python3 tools/tonemap/backdrop09.py tools/tonemap/tm.py 0.9  # amber over each backdrop
python3 tools/tonemap/wall09.py tools/tonemap/tm.py 0.9      # in-game wall brightness to radiance
```
