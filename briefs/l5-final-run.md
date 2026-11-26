# Brief: Lesson 5's final run: the hosts' final passes, the 60 fps render and the deliverables

The final voices are in. On 26 November the owner said yes to them; all 71 takes were generated,
imported and the film re-timed to 9:29.7 (L5/DECISIONS.md 246 to 256; L5/voice-takes/IMPORT.md).
The owner now has the listening copies and will check them. Your job is the rest of the film's
production on the new clock: the hosts' final passes, the 60 fps final render, its measurement
and the deliverables. If the owner asks for a retake of some line meanwhile, the director will
tell you, so keep each scene's passes able to be redone alone.

S   = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
L5  = $S/l5film (the film's HyperFrames project)
SKILL_DIR = /home/user/mercurypitch/.claude/worktrees/fix/.claude/skills/motion-designer

## Read first
- `L5/lab/passes-proto/final60/plan.md` (the final run: 27 jobs, 63,998 frames, about 4.2 h of
  rendering alone on the machine), and that folder's `PASSES.md` and `final-report.md`.
- `L5/DECISIONS.md` from 240 to the end (245: the accepted final passes profile; 252: the 13
  scene durations gen-root.py must write), and `L5/LEDGER.md`'s last rows.
- The headers of `tools/gen-root.py`, `merc-shots.py`, `merc-queue.py`, `merc-passes.py`,
  `merc-pass.mjs`, `merc-joins.py`, `merc-tags.py`, `merc-sheet.py` and `mix.py`, before you run
  any of them. Read any script before you run it.
- `L5/BUILD-GUIDE.md` on rendering; SKILL_DIR/SKILL.md §§ 10 to 12 (the quality bar and the
  deliverables) and `references/measurement.md`.

## The run
1. `MIX=full python3 tools/gen-root.py`, in place this time: it writes the 13 scenes' root
   `data-duration` values that DECISIONS 252 lists, and nothing else in the scene files. Then
   `npx --yes hyperframes@0.8.97 check` through `$S/bin/heavy`: 0 errors.
2. `merc-shots.py --final` on the new clock, with the accepted profile (DECISIONS 245: a breath
   in 0.15 s after pauses of 0.25 s or more, blinks after the voice stops, the talk cycle at 5.5 a
   second, the cut clear by 0.2 s, 60 fps margins; and the director's additions: a breath in
   before `gauge`, `demo`, `listen` and `twinkle` and in `breathe`, and S14's gates on base 400).
   Say which of these the tool already does and which you added.
3. The 27 jobs at 60 fps as plan.md orders them (`merc-queue.py --order=final`), every one
   through `$S/bin/heavy`. Then the joins (`merc-joins.py`), `merc-tags.py --check` for every
   scene, `roots.js`, and a contact sheet of the passes. Look at it yourself.
4. The final render: 1920x1080 at 60 fps with `MIX=full`, `check` 0 errors first and `--strict`
   on the render, to `L5/renders/film-final-60.mp4`. Frame 0 must be a finished picture; look at
   it, and at a frame from every scene.
5. Measure it: `SKILL_DIR/scripts/measure.py render` (holds per 30 s, the longest, loudness, true
   peak) into `L5/review/final-measure/`, with the holds listed by time and scene.
6. The deliverables (SKILL § 12): the music-only version (a sibling render with the voice and the
   effects hidden, as the skill describes); a contact sheet of the final film; the captions and
   chapters as they stand (regenerated on the new clock already); a row in `LEDGER.md`; and
   `DELIVERY.md`: the licences for music, effects and fonts, the voice generation ledger (the
   owner's two ElevenLabs voices, Eleven v3, one take a line: `voice-takes/ledger.jsonl`), what
   was measured, and what a person should still watch or listen to.

## Rules
- Never call ElevenLabs or any other voice, music, image or video service. Never production. No
  commits or pushes. No attribution, emojis or model names in any file.
- Every heavy job goes through `$S/bin/heavy`, one at a time; Lesson 6's builders render on this
  machine at the same time. Run long jobs in the background and wait for them to finish, rather
  than polling in a loop.
- Disk: about 5.6 GB is free and shared. Keep 2 GB free; if a step would take it lower, stop and
  report it. Never delete anything you did not make to free room.
- Log what you decide in `L5/DECISIONS.md` from 257 on, and keep `L5/lab/final-run/NOTES.md`
  current, so the run can resume if you are stopped part-way.

## Hand back
- What each step did, with its numbers: the shots' changes, the 27 jobs (time each), the joins,
  the render's time and size, frame 0, measure.py's summary (holds per 30 s and the longest,
  loudness, true peak) with any hold over 0.4 s by time.
- The deliverables' paths.
- Anything that departs from the plan, and what still needs a person.
