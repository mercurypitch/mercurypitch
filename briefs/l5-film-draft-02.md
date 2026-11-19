# Brief: film-draft-02 (the whole film again, after the full-film fix round)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer (read-only)

Every scene group has finished its fix round after critic F-01 (`P/review/critic-F-01/REPORT.md`;
the director's calls are DECISIONS 225 to 237 and on). No builder is editing now. This is part 2
of `$S/briefs/l5-integration.md` again, as you did it for film-draft-01, with new output paths and
a comparison with draft-01. No critic follows: the director checks your numbers and the owner
watches the film.

## Steps
1. If any scene's length changed (compare `assets/scenes.js` with the scene files' lengths),
   `tools/gen-root.py` (read it first; it must leave every scene file as it is). Then
   `merc-tags.py --check` over all scenes and `check` (0 errors).
2. Render the root (`index.html`) at 1920x1080, 30 fps, with the scratch voice mix, through
   `$S/bin/heavy`, to `P/renders/film-draft-02.mp4`. The film must stay 549.465 s (16,484 frames).
3. `python3 SKILL_DIR/scripts/measure.py render` on it, to `P/review/film-02-measure/`.
4. **Every cut**, as `review/film-01/cuts/cuts.md` did, to `P/review/film-02/cuts/` (one table,
   one row a cut, the frames either side).
5. A contact sheet (one frame every 2 s) to `P/review/film-02/contact-sheet.jpg`.
6. **Draft-01 against draft-02**, to `P/review/film-02/COMPARE.md`:
   - holds per 30 s and the longest hold, for the film and for each scene (`assets/scenes.js`),
     both drafts side by side; every hold of 0.3 s or more in draft-02 with its scene and the
     words around it;
   - the events: how many in each draft, and for each draft-01 event whether it is gone, moved or
     still there. Name these by time: 6.27, 10.80, 13.93, 17.80, 19.73, 24.27, 27.87, 33.03, 40.17,
     40.70, 55.27, 55.67, 326.93, 410.13, 411.07, 471.27, 525.23, 526.50, 543.03 (the type steps of
     DECISIONS 233). List every event new in draft-02 with what it is;
   - the critic's four collisions, a crop from each draft at the same frame: '"support"' against
     the band (32.1 to 33.5), S2's title against "A3" and the band (41.5 to 41.6), S4's chips
     against the band's line (65.43 to 65.57), S8's "03" against the parked figure (209.5 to
     210.1); the nearest gap in px in draft-02;
   - Merc through the clean break's two hops (490.31 to 491.62): Merc's box centre on every frame,
     the largest step between frames, and whether any frame jumps against its neighbours;
   - loudness, both drafts.

## Rules
- Every heavy job through `$S/bin/heavy`, one at a time. Never production. No voice, image, video or
  music service. No attribution, emojis or model names in any file. Do not commit or push.
- Edit nothing in the scenes, the kit, the passes or the documents. If something is wrong in a scene,
  name it with its time and a crop; do not fix it.

## Hand back
The film's length, `check`'s result, measure.py's summary (holds per 30 s, the longest, events,
loudness), the cuts table's path and any cut that is not as the board says, the contact sheet's
path, COMPARE.md's main lines, and anything that did not go as written.
