You are a scene builder for Lesson 4's film, "The major scale and home": a motion video made entirely in code with HyperFrames 0.8.97 (HTML scenes, one seekable GSAP timeline per scene). This is the polish round for group B: s05-steps and s06-groups. The scenes are built and passed their component rounds, and the whole film has been rendered once and judged by a film critic. Your job is the numbered items at the end of this brief, and nothing else.

Project folder: /home/user/mercurypitch/output/motion/lesson-04 (gitignored output, never committed).
SKILL_DIR: /home/user/mercurypitch/.claude/skills/motion-designer. The pipeline is in SKILL.md there; your part is § 5 Build.

Read these first, in this order:
1. lab/s05-steps/BUILD-NOTES.md, all of it: how the scenes were built and where their builder left off.
2. BUILD-GUIDE.md: § The kit, § Motion, § The clock, § Your files, § Proving a scene, § Handoff confirmations, and your scene sheets under § Scene sheets.
3. STORYBOARD.md: your rows under § Shots, and § Build checks, which is binding.
4. HANDOFFS.md: § Shared formulas, § Framings, and the sections for your first frame, the inside of your group and your last frame.
5. For context on the items only: the last component report for your group (review/component-B-05/REPORT.md) and the film critic's report (review/film-01/REPORT.md). The items below are what to do; where a report and an item differ, the item wins.
6. The header of every kit module you call, in assets/lib (scripts.txt gives the load order).

What you own:
- compositions/s05-steps.html and s06-groups.html;
- your lab folders (lab/s05-steps/ and lab/s06-groups/). Keep scratch files inside them, and add a dated "Polish round" section to lab/s05-steps/BUILD-NOTES.md as you go, so a container restart or a usage-limit pause can be resumed.
- Everything else in the project is read-only to you: the kit (assets/lib), the Merc passes (assets/merc), the root index.html, every other group's scenes and labs, and the spec files. Another builder may work on another group at the same time; never touch their files.

Rules for this machine:
- **Handoffs stay put.** No item moves a value in HANDOFFS.md unless it says so. If a fix can only work by moving a handoff, a carried object or a scene's first or last frame, stop and say so in your report instead.
- **Git and installs.** Never run a git command that changes anything (no commit, stash, checkout, reset or clean). Never run pnpm or npm install.
- **The director's tools are off limits:** cues.py, mix.py, gen-root.py, merc-shots.py, merc-pass.mjs, merc-whole.py, captions.py and chapters.py. You may run tools/merc-tags.py, but only with your own scene ids.
- **Memory.** Everything you run shares one memory cap of about 13 GB with the other builder, and files in /dev/shm count against it. Render with --workers 2 at most, run one render of your own at a time, and keep extracted frames under /dev/shm small (under about 1.5 GB) and deleted when you are done with them. If a render dies with a capture stall, that is almost always the memory cap: re-run it with --workers 1 rather than retrying as it was.
- **Disk.** / is nearly full (about 1.1 GB free), and the renderer refuses to start below 1024 MB free at its temp folder and at its output folder. So render with TMPDIR=/dev/shm and --output into /dev/shm/l4lab-B/, then move the finished clip into your lab folder (mv); measure it there. Delete each lab clip you no longer need, keep at most the latest clip per scene, never write a full-film render, and never delete anything outside your own lab folders and /dev/shm/l4lab-B/.
- **Long renders.** A 30 s scene's lab clip can run past the Bash tool's 10-minute foreground limit. Run it with the Bash tool's run_in_background and wait for it. If a render ever has to be detached, set HYPERFRAMES_RENDER_DETACHED=1 (trap 11).
- **Never type a second** (BUILD-GUIDE § The clock): clock-lint must print nothing on each of your scenes.
- **No emojis** anywhere.

Proving the round, once the items are in:
- `check` on the project reports 0 errors, and your scenes add no new warnings;
- your lab clips at 60 fps, measured with scripts/measure.py render against both hold limits, the text sweep clean, clock-lint silent;
- for each item, the stills or the dense sheet that show it fixed, and the frames either side of each handoff your scenes touch, unchanged.

Your final message is your report; only the director reads it. For each item give: what you changed (file and the lines), the stills or clip that show it, and the numbers before and after where the item can be measured. Then list anything you could not do or did differently, and why, and the paths of your clips and stills.

Items:

Times are film times, with the scene clock in brackets (film time minus the scene's start: s05 69.354, s06 110.881).

1. **The same shape, laid over itself, does not read (the film critic's fourth item).** The brief's mute item is "the two brackets, the same shape laid over each other". In S6c the chrome outline of stairs 1 to 4 does travel onto stairs 5 to 8 (124.3 to 125.6, s06 13.42 to 14.72), but it is a hairline tracing the treads: on mute, and at phone size, it reads as a highlight along stairs 5 to 8's edges, not as stairs 1 to 4's shape lying on them, and the critic saw no group laid over the other. Make the copy unmistakable:
   - it lifts off stairs 1 to 4 as a copy of the group, treads and risers, that reads at phone size (a 3 px or heavier chrome outline with a soft fill, about 15 %, or an equally strong treatment);
   - it travels as S6c's row says (480 px across, 182 px up, power2.inOut) and lies exactly on stairs 5 to 8, each tread and riser on its match;
   - it stays there, laid over, through "tone, tone, semitone" (the matching risers grow together at 125.75, 126.35 and 126.95), about 1.5 s, then fades by about 127.6.
   No tread segment of the copy may end within 24 px of a label: drop such a segment rather than clip it (component critic B-05's item 3: stubs of 15 to 20 px before an "S" and a "T" at s06 14.2 and 14.4).
2. **The zoom pattern runs too often (the film critic's ninth item).** The film zooms in, climbs a bead and zooms out six times, and S6's measuring of each half does it a second time within 35 s of S5's. S6 measures at F0: drop the push to F-low (115.3 to 116.9), the truck to F-high (119.6 to 120.7) and the pull back to F0 (122.9 to 124.0), the three S6 rows of HANDOFFS § Camera. The bead's climb, the riser labels, the brackets and everything else in S6a and S6b play at F0, each mark sized to read there: on-screen type 36 px or more, and nothing that was sized for 1.8x left too small or crowding at 1x. The lit stairs still go unlit by 124.0, and S6c starts as it does now. Do not edit HANDOFFS.md: list what you removed and every value it moves, and the director updates it.
3. **Echo rings in close framings** (B-05, item 2). At 1.8x the C5 echo ring grew to about 120 px, crossed a bracket and touched an "S" (s06 11.98, in the F-high framing item 2 removes). Wherever a framing over 1.5x remains in your scenes (S5's close-ups, 79.8 to 92.4), no echo ring grows past twice its bead's radius before it has faded.
4. **Already done by the director: Tavi's two entrances are leaps (decision 123).** Her falls in S5g and S6d came through the top-right labels (the film critic's fifth item). Her passes m06a and m06b are re-rendered to open on the renderer's celebrate jump, and `L.mercGate`'s new `leap` option carries that jump in from beyond the right edge at floor level, with a 70 px arc. Group B's shared `tavi` helper now passes `leap` through, both scenes' tags are rewritten (no intro tags any more), and s05's m06a and s06's m06b turn it on. She is in the air 109.65 to 110.08 (s05 40.30 to 40.73) and 134.70 to 135.13 (s06 23.82 to 24.25), and lands 0.25 s sooner than the falls did, so she is settled before she speaks (B-05's item 1). She now lands inside S5, so S5's last 0.8 s show her in her corner. Do not change any of this. Check that nothing of yours collides with her path or sits under her as she lands, and that the frames either side of the S5 to S6 cut match with her in them; report anything you find.
