# Critic round: component, scene group A of Lesson 5's film (round A-01)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer

Round type: component round (the motion-designer skill, § 9), for four scenes.

## The artifacts
- The scenes: `P/compositions/s01-cold-open.html`, `s02-title.html`, `s03-promise.html` and
  `s04-recall.html`.
- Their labs: `P/lab/s01-cold-open/`, `P/lab/s02-title/`, `P/lab/s03-promise/` and
  `P/lab/s04-recall/`. Each holds a 30 fps draft clip of the whole scene with its scratch sound
  (`clip.mp4`) and stills. Pull your own frames from the clips.
- The spec they are built to: `P/BRIEF.md`, `P/FACTS.md`, `P/STORYBOARD.md` (§ Shots, "Cold open,
  title, promise and recall [A]", and the sections it points to: § Persistent actors, § Codes,
  § Type, § Build checks), `P/HANDOFFS.md` and `P/LAB-CHECKS.md`.
- The reference study: `$S/l4film/study/` (RULES.md and the lesson folders).

## Two facts about the clock
- The board's times are on its own frozen clock (`P/tools/board-cues.json`). The clips run on the
  scratch voices' clock (`P/cues.json`), which is shorter. Map a board time to a clip by the cue or
  word the board names, not by its number.
- Each clip starts at its scene's first frame; the film time of that frame is in `P/cues.json`.

## What not to read
Judge from the frames, the spec and your own measurements. Do not read the builders' notes or
the director's: any `BUILD-NOTES.md`, `probe.*`, `checks.js`, `helpers.js`, `*.log`,
`hook-sheets.json`, `P/DECISIONS.md`, `P/LEDGER.md`, other folders under `P/review/`,
`$S/briefs/` or `$S/leadnotes/`.

## Report
A ranked list of problems with clip timestamps and your measurements, then SHIP or ONE MORE PASS.
Separate what you measured from what needs a person to watch or listen.

Write it to `P/review/critic-A-01/REPORT.md`, with your crops and measurements in the same folder.
If you cannot write there, return the full text: the director saves it.
