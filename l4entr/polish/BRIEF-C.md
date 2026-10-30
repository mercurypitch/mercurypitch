You are a scene builder for Lesson 4's film, "The major scale and home": a motion video made entirely in code with HyperFrames 0.8.97 (HTML scenes, one seekable GSAP timeline per scene). This is the polish round for group C: s07-predict and s08-anywhere. The scenes are built and passed their component rounds, and the whole film has been rendered once and judged by a film critic. Your job is the numbered items at the end of this brief, and nothing else.

Project folder: /home/user/mercurypitch/output/motion/lesson-04 (gitignored output, never committed).
SKILL_DIR: /home/user/mercurypitch/.claude/skills/motion-designer. The pipeline is in SKILL.md there; your part is § 5 Build.

Read these first, in this order:
1. lab/s07-predict/BUILD-NOTES.md, all of it: how the scenes were built and where their builder left off.
2. BUILD-GUIDE.md: § The kit, § Motion, § The clock, § Your files, § Proving a scene, § Handoff confirmations, and your scene sheets under § Scene sheets.
3. STORYBOARD.md: your rows under § Shots, and § Build checks, which is binding.
4. HANDOFFS.md: § Shared formulas, § Framings, and the sections for your first frame, the inside of your group and your last frame.
5. For context on the items only: the last component report for your group (review/component-C-03/REPORT.md) and the film critic's report (review/film-01/REPORT.md). The items below are what to do; where a report and an item differ, the item wins.
6. The header of every kit module you call, in assets/lib (scripts.txt gives the load order).

What you own:
- compositions/s07-predict.html and s08-anywhere.html;
- your lab folders (lab/s07-predict/ and lab/s08-anywhere/). Keep scratch files inside them, and add a dated "Polish round" section to lab/s07-predict/BUILD-NOTES.md as you go, so a container restart or a usage-limit pause can be resumed.
- Everything else in the project is read-only to you: the kit (assets/lib), the Merc passes (assets/merc), the root index.html, every other group's scenes and labs, and the spec files. Another builder may work on another group at the same time; never touch their files.

Rules for this machine:
- **Handoffs stay put.** No item moves a value in HANDOFFS.md unless it says so. If a fix can only work by moving a handoff, a carried object or a scene's first or last frame, stop and say so in your report instead.
- **Git and installs.** Never run a git command that changes anything (no commit, stash, checkout, reset or clean). Never run pnpm or npm install.
- **The director's tools are off limits:** cues.py, mix.py, gen-root.py, merc-shots.py, merc-pass.mjs, merc-whole.py, captions.py and chapters.py. You may run tools/merc-tags.py, but only with your own scene ids.
- **Memory.** Everything you run shares one memory cap of about 13 GB with the other builder, and files in /dev/shm count against it. Render with --workers 2 at most, run one render of your own at a time, and keep extracted frames under /dev/shm small (under about 1.5 GB) and deleted when you are done with them. If a render dies with a capture stall, that is almost always the memory cap: re-run it with --workers 1 rather than retrying as it was.
- **Disk.** / is nearly full (about 1.1 GB free), and the renderer refuses to start below 1024 MB free at its temp folder and at its output folder. So render with TMPDIR=/dev/shm and --output into /dev/shm/l4lab-C/, then move the finished clip into your lab folder (mv); measure it there. Delete each lab clip you no longer need, keep at most the latest clip per scene, never write a full-film render, and never delete anything outside your own lab folders and /dev/shm/l4lab-C/.
- **Long renders.** A 30 s scene's lab clip can run past the Bash tool's 10-minute foreground limit. Run it with the Bash tool's run_in_background and wait for it. If a render ever has to be detached, set HYPERFRAMES_RENDER_DETACHED=1 (trap 11).
- **Never type a second** (BUILD-GUIDE § The clock): clock-lint must print nothing on each of your scenes.
- **No emojis** anywhere.

Proving the round, once the items are in:
- `check` on the project reports 0 errors, and your scenes add no new warnings;
- your lab clips at 60 fps, measured with scripts/measure.py render against both hold limits, the text sweep clean, clock-lint silent;
- for each item, the stills or the dense sheet that show it fixed, and the frames either side of each handoff your scenes touch, unchanged.

Your final message is your report; only the director reads it. For each item give: what you changed (file and the lines), the stills or clip that show it, and the numbers before and after where the item can be measured. Then list anything you could not do or did differently, and why, and the paths of your clips and stills.

Items:

Times are film times, with the scene clock in brackets (film time minus the scene's start: s07 146.097, s08 199.360).

1. **The predict ring floats over the grid (the film critic's sixth item).** From 158 to 163 (s07 11.90 to 16.90) the predict's ring timer sits at (620, 440), radius 24, over the grid and detached from the two pills under "Predict." ("Yes: same keys" and "No: it changes", x 140, baselines 400 and 480). Dock it at the pills' right end, as the recap cards dock theirs at the right end of their panel: it reads as part of the question, 16 px or more clear of the pills' text, and still 28 px or more from every dashed stair while it is up (HANDOFFS § S7). This replaces component critic C-03's item 3 (the ring 18 px from dashed stair 3's corner). List the ring's new centre; the director updates HANDOFFS.
2. **Tangled ghost outlines (the film critic's seventh item).** From 217.3 to 219.0 (s08 17.94 to 19.64) ghost outlines overlap the E staircase and run past it to about (1590, 197); on mute they read as stray lines. Show one offset ghost, clearly a copy of the shape it repeats, with a "same shape" label (the lesson's own words in S6c), or cut the ghosts. Keep every label 24 px or more from the ghost's ink.
3. **The top "S" leaves too early** (C-03, item 1). The top "S" (the C♯-D riser's label) fades before the crane (s07 43.55, 189.65) and returns late (s07 50.15, 196.25). It stays on and rides out of frame with the world, as decision 116 did for S6.
4. **F-keys-D crops stairs 7 and 8** (C-03, item 2). Move F-keys-D's oy from -528 to about -440, so the top "S" sits near y 40 and the black-key names at baseline 873, above the caption band. This item moves a value in HANDOFFS § Framings (F-keys-D) on purpose: list the value you settle on and every handoff point in your scenes it moves; the director updates HANDOFFS.
5. **Two labels settle in whole-pixel steps** (C-03, item 4). "Predict." (s07 7.12 to 7.55, 153.22 to 153.65) and "D major" (s07 50.62 to 51.02, 196.72 to 197.12) settle their last 8 px in visible whole-pixel steps. Give them less travel, or fade them in place (decision 104).
