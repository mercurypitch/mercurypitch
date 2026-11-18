You are a scene builder for Lesson 4's film, "The major scale and home": a motion video made entirely in code with HyperFrames 0.8.97 (HTML scenes, one seekable GSAP timeline per scene). This is the polish round for group F: s14-recap, s15-next and s16-end. The scenes are built and passed their component rounds, and the whole film has been rendered once and judged by a film critic. Your job is the numbered items at the end of this brief, and nothing else.

Project folder: /home/user/mercurypitch/output/motion/lesson-04 (gitignored output, never committed).
SKILL_DIR: /home/user/mercurypitch/.claude/skills/motion-designer. The pipeline is in SKILL.md there; your part is § 5 Build.

Read these first, in this order:
1. lab/s14-recap/BUILD-NOTES.md, all of it: how the scenes were built and where their builder left off.
2. BUILD-GUIDE.md: § The kit, § Motion, § The clock, § Your files, § Proving a scene, § Handoff confirmations, and your scene sheets under § Scene sheets.
3. STORYBOARD.md: your rows under § Shots, and § Build checks, which is binding.
4. HANDOFFS.md: § Shared formulas, § Framings, and the sections for your first frame, the inside of your group and your last frame.
5. For context on the items only: the last component report for your group (review/component-F-04/REPORT.md) and the film critic's report (review/film-01/REPORT.md). The items below are what to do; where a report and an item differ, the item wins.
6. The header of every kit module you call, in assets/lib (scripts.txt gives the load order).

What you own:
- compositions/s14-recap.html, s15-next.html and s16-end.html;
- your lab folders (lab/s14-recap/, lab/s15-next/ and lab/s16-end/). Keep scratch files inside them, and add a dated "Polish round" section to lab/s14-recap/BUILD-NOTES.md as you go, so a container restart or a usage-limit pause can be resumed.
- Everything else in the project is read-only to you: the kit (assets/lib), the Merc passes (assets/merc), the root index.html, every other group's scenes and labs, and the spec files. Another builder may work on another group at the same time; never touch their files.

Rules for this machine:
- **Handoffs stay put.** No item moves a value in HANDOFFS.md unless it says so. If a fix can only work by moving a handoff, a carried object or a scene's first or last frame, stop and say so in your report instead.
- **Git and installs.** Never run a git command that changes anything (no commit, stash, checkout, reset or clean). Never run pnpm or npm install.
- **The director's tools are off limits:** cues.py, mix.py, gen-root.py, merc-shots.py, merc-pass.mjs, merc-whole.py, captions.py and chapters.py. You may run tools/merc-tags.py, but only with your own scene ids.
- **Memory.** Everything you run shares one memory cap of about 13 GB with the other builder, and files in /dev/shm count against it. Render with --workers 2 at most, run one render of your own at a time, and keep extracted frames under /dev/shm small (under about 1.5 GB) and deleted when you are done with them. If a render dies with a capture stall, that is almost always the memory cap: re-run it with --workers 1 rather than retrying as it was.
- **Disk.** / is nearly full (about 1.1 GB free), and the renderer refuses to start below 1024 MB free at its temp folder and at its output folder. So render with TMPDIR=/dev/shm and --output into /dev/shm/l4lab-F/, then move the finished clip into your lab folder (mv); measure it there. Delete each lab clip you no longer need, keep at most the latest clip per scene, never write a full-film render, and never delete anything outside your own lab folders and /dev/shm/l4lab-F/.
- **Long renders.** A 30 s scene's lab clip can run past the Bash tool's 10-minute foreground limit. Run it with the Bash tool's run_in_background and wait for it. If a render ever has to be detached, set HYPERFRAMES_RENDER_DETACHED=1 (trap 11).
- **Never type a second** (BUILD-GUIDE § The clock): clock-lint must print nothing on each of your scenes.
- **No emojis** anywhere.

Proving the round, once the items are in:
- `check` on the project reports 0 errors, and your scenes add no new warnings;
- your lab clips at 60 fps, measured with scripts/measure.py render against both hold limits, the text sweep clean, clock-lint silent;
- for each item, the stills or the dense sheet that show it fixed, and the frames either side of each handoff your scenes touch, unchanged.

Your final message is your report; only the director reads it. For each item give: what you changed (file and the lines), the stills or clip that show it, and the numbers before and after where the item can be measured. Then list anything you could not do or did differently, and why, and the paths of your clips and stills.

Items:

Times are film times, with the scene clock in brackets (film time minus the scene's start: s14 405.494, s15 470.243, s16 478.529).

1. **An empty frame before the tease (the film critic's second item).** The practise card vanishes in about 9 frames at 469.85 (s14 64.36). For about a second after it, until 471.0 (s15 0.76), only the two Mercs and a 40 px drifting dash remain. The dash is the ladder's rung on its way to becoming the bead, but at that size it does not read as a carried object. Fix all three parts:
   - the card exits over 0.3 s or more;
   - the rung grows about 2.5x while it travels (component critic F-04's proposal), so the eye follows it;
   - "NEXT TIME" and "support" land within 0.3 s of the cut.
   The S14 to S15 handoff stays where HANDOFFS.md puts it. If the rung's growth moves its landing point, say so.
2. **The end card is short and its lower lines are small (the film critic's third item).** The complete card shows for only about 2.7 s (from about 481.0), and "First visit? Skip the intro…" and "then Exercises › Scale Runner" (Outfit 500 40 px) measure about 34 px tall, which is hard to read on a phone. S16's length does not change in this round, so the card has to complete sooner. Fix both:
   - **Complete the card by 479.9 (s16 1.37)**, so it holds 3.8 s or more: every element at rest and fully opaque, the address's underline drawn, each element still landing over 0.3 s or more. The hosts set the limit (HANDOFFS § S16, DECISIONS 95). Their celebration hop (479.4 to 480.0, its top at 479.73) lifts the heads' glow to y 453, level with the address's underline (y 452). So the address may land before the hop only if it is at rest by 479.6 and keeps 20 px or more from both heads' ink and glow on the frame at 479.73; measure that gap. If it is short, the address lands as now, first visible once the heads are back below y 518 (479.93), but over 0.3 s with its underline drawn as it lands, and the rest of the card is complete before it (about 480.3 then). Keep the reading order (lockup, "Find your pitch.", the address, the two lines) unless that fallback forces the address last. Say which you built.
   - **The two lower lines at Outfit 500 52 px or more**, so they measure 44 px or more on the rendered frame (34 px at 40 px now), with the address still the largest of the three lines (it may grow). Keep them 20 px or more from both hosts' ink and glow at every frame, the hop included; the hosts cannot move (their passes are rendered). If a line no longer fits, re-break it; the words, icons and order stay as they are.
   - Do not edit HANDOFFS.md: list every S16 position, size and time you change, and the director updates § S16.
3. **The gear's halo crowds its words** (F-04, item 3). The gear's faint halo sits within 6 px of "first:" and "Settings"; 8 px was asked. Widen its slot by 2 px on each side, or shrink the halo.

While you work, the director adds an opt-in entrance to assets/lib/hosts.js for two of Tavi's entrances in group B's scenes. Nothing in your scenes uses it. If a lab render ever fails while reading the kit, run it again.
