# Critic round: full film, Lesson 5's film (round F-01)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
P = $S/l5film
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer

Round type: full-film round (the motion-designer skill, § 9), picture and voice. The film's music,
effects and examples come in a later sound step, so judge the picture against the references and
the spec, and the voice only for sync; do not rank the missing sound.

## The artifact
- `P/renders/film-draft-01.mp4`: the whole film, 1920x1080, 30 fps, with the scratch voices.
  Pull your own frames from it.
- The spec it is built to: `P/BRIEF.md`, `P/FACTS.md`, `P/STORYBOARD.md`, `P/HANDOFFS.md` and
  `P/LAB-CHECKS.md`.
- The reference study: `$S/l4film/study/` (RULES.md and the lesson folders).

## Two facts about the clock
- The board's times are on its own frozen clock (`P/tools/board-cues.json`); the film runs on the
  scratch voices' clock (`P/cues.json`), which is shorter and has one beat the board's has not
  (`break`, before b55). Map a board time to the film by the cue or word the board names.
- The scene table (each scene's start and end in film time) is `P/assets/scenes.js`.

## What not to read
Judge from the frames, the spec and your own measurements. Do not read the builders' notes or the
director's: any `BUILD-NOTES.md`, `probe.*`, `checks.js`, `*.log`, `P/DECISIONS.md`, `P/LEDGER.md`,
other folders under `P/review/`, `P/lab/`, `$S/briefs/` or `$S/leadnotes/`.

## Report
A ranked list of problems with film timestamps and your measurements (the quality bar of SKILL.md
§ 10: frozen screen per 30 s and the longest still stretch, frame one, contrast and collisions, a
first-time viewer with the sound off, and whether it would stand next to the references), then SHIP
or ONE MORE PASS. Separate what you measured from what needs a person to watch or listen.

Write it to `P/review/critic-F-01/REPORT.md`, with your crops and measurements in the same folder.
If you cannot write there, return the full text: the director saves it.
