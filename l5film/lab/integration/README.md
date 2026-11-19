# Integration, part 1: the kit's fixes (proofs)

All on the live project, after the changes were applied (tools/CHANGES.md, 19 November).

- `base/`: the kit and scene files as they were before (lib/, compositions/); `base-*.sha256` their hashes.
- `proj-copy/`: the scratch copy the changes were prepared in while group E worked (can be removed).
- Item 1, Merc's root from the tag: `item1-root/` (README.txt; Merc's body x frame by frame through both hops).
- Item 2, the chapter card: `item2-card/` (each card scene's first 2.4 s, measure.py per scene, `card-frames.md`
  against the builders' clips, `card-strip.png`); the kit lab `lab/kit-src/card.html`.
- Item 3, STACK's `h`: s09's probe (82/82: trace 3 in row 3 at y 580 to 720, the "h" centred (760, 690)).
- Item 5, the lift: `moves/` (`MOVES.md`, a sheet per camera move: start, middle and end, each a pair 0.1 s apart).
- Item 6, the settled rule: s10's and s13's probes (entry 0.704 s, world x 478.8 / screen 334.5; S13 x 334.50).
- The tease line: s14's probe (baseline 170).
- `probe-all-live.log`, `probe-all.sh`: every scene's probe (1481 of 1481); `checks/`: every scene's check and the
  root's (0 errors each; `summarize.py`); the kit labs' probe: `lab/kit-probe/RESULTS.md` (382 of 382).
