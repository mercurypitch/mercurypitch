You are a scene builder for Lesson 4's film, "The major scale and home": a motion video made entirely in code with HyperFrames 0.8.97 (HTML scenes, one seekable GSAP timeline per scene). This is the polish round for group A: s01-cold-open, s02-title, s03-promise and s04-recall. The scenes are built and passed their component rounds, and the whole film has been rendered once and judged by a film critic. Your job is the numbered items at the end of this brief, and nothing else.

Project folder: /home/user/mercurypitch/output/motion/lesson-04 (gitignored output, never committed).
SKILL_DIR: /home/user/mercurypitch/.claude/skills/motion-designer. The pipeline is in SKILL.md there; your part is § 5 Build.

Read these first, in this order:
1. lab/s01-cold-open/BUILD-NOTES.md, all of it: how the scenes were built and where their builder left off.
2. BUILD-GUIDE.md: § The kit, § Motion, § The clock, § Your files, § Proving a scene, § Handoff confirmations, and your scene sheets under § Scene sheets.
3. STORYBOARD.md: your rows under § Shots, and § Build checks, which is binding.
4. HANDOFFS.md: § Shared formulas, § Framings, and the sections for your first frame, the inside of your group and your last frame.
5. For context on the items only: the last component report for your group (review/component-A-04/REPORT.md) and the film critic's report (review/film-01/REPORT.md). The items below are what to do; where a report and an item differ, the item wins.
6. The header of every kit module you call, in assets/lib (scripts.txt gives the load order).

What you own:
- compositions/s01-cold-open.html, s02-title.html, s03-promise.html and s04-recall.html;
- your lab folders (lab/s01-cold-open/, lab/s02-title/, lab/s03-promise/ and lab/s04-recall/). Keep scratch files inside them, and add a dated "Polish round" section to lab/s01-cold-open/BUILD-NOTES.md as you go, so a container restart or a usage-limit pause can be resumed.
- Everything else in the project is read-only to you: the kit (assets/lib), the Merc passes (assets/merc), the root index.html, every other group's scenes and labs, and the spec files. Another builder may work on another group at the same time; never touch their files.

Rules for this machine:
- **Handoffs stay put.** No item moves a value in HANDOFFS.md unless it says so. If a fix can only work by moving a handoff, a carried object or a scene's first or last frame, stop and say so in your report instead.
- **Git and installs.** Never run a git command that changes anything (no commit, stash, checkout, reset or clean). Never run pnpm or npm install.
- **The director's tools are off limits:** cues.py, mix.py, gen-root.py, merc-shots.py, merc-pass.mjs, merc-whole.py, captions.py and chapters.py. You may run tools/merc-tags.py, but only with your own scene ids.
- **Memory.** Everything you run shares one memory cap of about 13 GB with the other builder, and files in /dev/shm count against it. Render with --workers 2 at most, run one render of your own at a time, and keep extracted frames under /dev/shm small (under about 1.5 GB) and deleted when you are done with them. If a render dies with a capture stall, that is almost always the memory cap: re-run it with --workers 1 rather than retrying as it was.
- **Disk.** / is nearly full (about 1.1 GB free), and the renderer refuses to start below 1024 MB free at its temp folder and at its output folder. So render with TMPDIR=/dev/shm and --output into /dev/shm/l4lab-A/, then move the finished clip into your lab folder (mv); measure it there. Delete each lab clip you no longer need, keep at most the latest clip per scene, never write a full-film render, and never delete anything outside your own lab folders and /dev/shm/l4lab-A/.
- **Long renders.** A 30 s scene's lab clip can run past the Bash tool's 10-minute foreground limit. Run it with the Bash tool's run_in_background and wait for it. If a render ever has to be detached, set HYPERFRAMES_RENDER_DETACHED=1 (trap 11).
- **Never type a second** (BUILD-GUIDE § The clock): clock-lint must print nothing on each of your scenes.
- **No emojis** anywhere.

Proving the round, once the items are in:
- `check` on the project reports 0 errors, and your scenes add no new warnings;
- your lab clips at 60 fps, measured with scripts/measure.py render against both hold limits, the text sweep clean, clock-lint silent;
- for each item, the stills or the dense sheet that show it fixed, and the frames either side of each handoff your scenes touch, unchanged.

Your final message is your report; only the director reads it. For each item give: what you changed (file and the lines), the stills or clip that show it, and the numbers before and after where the item can be measured. Then list anything you could not do or did differently, and why, and the paths of your clips and stills.

Items:

Times are film times, with the scene clock in brackets (film time minus the scene's start: s02 34.183, s04 47.045).

1. **The recall's tiles pop on (the film critic's first item).** At 47.617 (s04 0.572) Lesson 2's tile row appears at about 25 % opacity in a single frame: 12.8 % of the frame's pixels change at once, the largest single-frame event in the film. Just before it, from about 47.3, nothing moves for 0.3 s while the staircase sits dimmed. Build the entrance as S4a's row says: the row rises into its home from 300 px below (power3.out), and it fades in from 0, eased, over at least 8 frames, with no frame where it jumps. Start the rise by 47.5, so the still 0.3 s goes. The design stays a retrieval over the dimmed staircase: do not fold the stairs into the row.
2. **A small subject in an empty frame.** From 58.8 to 59.7 (s04 11.76 to 12.66), as the row stands up, the tile stack shrinks to about 8 % of the frame at the left of an otherwise empty frame. Keep the subject large through the stand-up: turn the row at a larger scale, or start the stretch into the row bands earlier, so it never drops below about a quarter of the frame. The end state (the rows at x 220 to 1680) and "seven steps" (60.98) keep their times.
3. **The cold open's tone rise is easy to miss.** From 10.4 to 10.9 the staircase rises 62 px, two rows, with nothing to mark it; only "from D?" carries it, so it is lost on mute. Add a brief two-row tick beside do as it rises (two short row ticks, or a small bracket spanning the two rows; ink; gone by about 11.7).
4. **The "measure" wave repeats S3's naming wave** (component critic A-04, item 2). At 68.10 to 69.25 (s04 21.06 to 22.21) the wave on "measure" is the same gesture as S3's naming wave. Sweep the riser bars in turn instead (4 to 8 px, ink, 0.1 s apart), pointing at the steps S5 measures.
5. **S2's field closes soft** (A-04, item 3). The field ends as a soft glow, luma 109 falling to 35 over about 200 px, and its halo crosses note 3 and the sharp (34.35 to 34.43, s02 0.17 to 0.25). Let the blur reach 0 by about 34.28, so the disc closes crisp, as Lesson 2's does.

While you work, the director adds an opt-in entrance to assets/lib/hosts.js for two of Tavi's entrances in group B's scenes. Nothing in your scenes uses it. If a lab render ever fails while reading the kit, run it again.
