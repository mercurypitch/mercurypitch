You are a scene builder for Lesson 4's film, "The major scale and home": a motion video made entirely in code with HyperFrames 0.8.97 (HTML scenes, one seekable GSAP timeline per scene). This is the polish round for group D: s09-names, s10-ti and s11-why. The scenes are built and passed their component rounds, and the whole film has been rendered once and judged by a film critic. Your job is the numbered items at the end of this brief, and nothing else.

Project folder: /home/user/mercurypitch/output/motion/lesson-04 (gitignored output, never committed).
SKILL_DIR: /home/user/mercurypitch/.claude/skills/motion-designer. The pipeline is in SKILL.md there; your part is § 5 Build.

Read these first, in this order:
1. lab/s09-names/BUILD-NOTES.md, all of it: how the scenes were built and where their builder left off.
2. BUILD-GUIDE.md: § The kit, § Motion, § The clock, § Your files, § Proving a scene, § Handoff confirmations, and your scene sheets under § Scene sheets.
3. STORYBOARD.md: your rows under § Shots, and § Build checks, which is binding.
4. HANDOFFS.md: § Shared formulas, § Framings, and the sections for your first frame, the inside of your group and your last frame.
5. For context on the items only: the last component report for your group (review/component-D-04/REPORT.md) and the film critic's report (review/film-01/REPORT.md). The items below are what to do; where a report and an item differ, the item wins.
6. The header of every kit module you call, in assets/lib (scripts.txt gives the load order).

What you own:
- compositions/s09-names.html, s10-ti.html and s11-why.html;
- your lab folders (lab/s09-names/, lab/s10-ti/ and lab/s11-why/). Keep scratch files inside them, and add a dated "Polish round" section to lab/s09-names/BUILD-NOTES.md as you go, so a container restart or a usage-limit pause can be resumed.
- Everything else in the project is read-only to you: the kit (assets/lib), the Merc passes (assets/merc), the root index.html, every other group's scenes and labs, and the spec files. Another builder may work on another group at the same time; never touch their files.

Rules for this machine:
- **Handoffs stay put.** No item moves a value in HANDOFFS.md unless it says so. If a fix can only work by moving a handoff, a carried object or a scene's first or last frame, stop and say so in your report instead.
- **Git and installs.** Never run a git command that changes anything (no commit, stash, checkout, reset or clean). Never run pnpm or npm install.
- **The director's tools are off limits:** cues.py, mix.py, gen-root.py, merc-shots.py, merc-pass.mjs, merc-whole.py, captions.py and chapters.py. You may run tools/merc-tags.py, but only with your own scene ids.
- **Memory.** Everything you run shares one memory cap of about 13 GB with the other builder, and files in /dev/shm count against it. Render with --workers 2 at most, run one render of your own at a time, and keep extracted frames under /dev/shm small (under about 1.5 GB) and deleted when you are done with them. If a render dies with a capture stall, that is almost always the memory cap: re-run it with --workers 1 rather than retrying as it was.
- **Disk.** / is nearly full (about 1.1 GB free), and the renderer refuses to start below 1024 MB free at its temp folder and at its output folder. So render with TMPDIR=/dev/shm and --output into /dev/shm/l4lab-D/, then move the finished clip into your lab folder (mv); measure it there. Delete each lab clip you no longer need, keep at most the latest clip per scene, never write a full-film render, and never delete anything outside your own lab folders and /dev/shm/l4lab-D/.
- **Long renders.** A 30 s scene's lab clip can run past the Bash tool's 10-minute foreground limit. Run it with the Bash tool's run_in_background and wait for it. If a render ever has to be detached, set HYPERFRAMES_RENDER_DETACHED=1 (trap 11).
- **Never type a second** (BUILD-GUIDE § The clock): clock-lint must print nothing on each of your scenes.
- **No emojis** anywhere.

Proving the round, once the items are in:
- `check` on the project reports 0 errors, and your scenes add no new warnings;
- your lab clips at 60 fps, measured with scripts/measure.py render against both hold limits, the text sweep clean, clock-lint silent;
- for each item, the stills or the dense sheet that show it fixed, and the frames either side of each handoff your scenes touch, unchanged.

Your final message is your report; only the director reads it. For each item give: what you changed (file and the lines), the stills or clip that show it, and the numbers before and after where the item can be measured. Then list anything you could not do or did differently, and why, and the paths of your clips and stills.

Items:

Times are film times, with the scene clock in brackets (film time minus the scene's start: s09 229.240, s10 270.634, s11 295.936). The film critic named nothing in your scenes; these are component critic D-04's held items (decision 107).

1. **S10's "do re mi" arrive after their stairs.** In S10's pull, the stair names fade in only at 281.98 (s10 11.35), after their stairs have arrived. Fade each name in as its column clears the left edge in the pull, all of them by about 281.5 (s10 10.87).
2. **S11's sharps are still moving when the pull starts.** The sharps are still lifted at 320.39 (s11 24.45). Bring them to rest by 320.23 (s11 24.29), when the pull starts.
3. **S9's pill shows empty while it widens.** From 255.82 to 256.04 (s09 26.58 to 26.80) the pill widens before "fixed do: do = C" is inside it. Let the text ride inside the pill as it widens, clipped by the pill's edge, so the pill is never empty on screen.
