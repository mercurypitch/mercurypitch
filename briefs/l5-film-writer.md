# Brief: Lesson 5's film, pre-production (brief, facts, script)

You write the first draft of the film for Find Your Pitch, Lesson 5, "Breath and a
steady note": its brief, its facts, its script. The lead directs; fresh critics read
your draft after you hand it back; the owner and a vocal coach sign off later. This
round is TEXT ONLY.

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
R = /home/user/mercurypitch/.claude/worktrees/fix (a read-only checkout of main; read files there, change nothing in it)

## Where you work
- The film's working folder is `$S/l5film/` (create it). Every file you write goes there.
  Never write in R or in any other worktree. Never run pnpm, npm installs, builds,
  renders, browsers or anything heavy: two builders share this 4-core machine.
- Do NOT call any voice, image, video or music service (ElevenLabs, Higgsfield and the
  like): they spend the owner's credits. Voices come in a later round.
- No attribution of any kind in any file (no model names, no "generated with"), no emojis.

## Read first (in this order)
1. The skill this film follows: `R/.claude/skills/motion-designer/SKILL.md`, its
   `BRIEF-TEMPLATE.md` and `references/house-rules.md`.
2. The series: `R/docs/plans/find-your-pitch/MASTER-PLAN.md` (§ 1 to 3 and the decisions
   D1 to D15), `PRODUCTION-PIPELINE.md` (§ 2 steps 2 and 3, § 3, § 4's traps),
   `MERC-BIBLE.md` (the hosts: Merc teaches, Tavi voices the guess most people make),
   `TEACHING-PLAYBOOK.md` (the 25 rules; the claims and safety rules above all),
   `CURIOSITY-MOMENTS.md` (Lesson 5's hook and the tease into Lesson 6), and
   `CURRICULUM.md`'s card for Lesson 5.
3. The lesson the film is for: `R/docs/plans/find-your-pitch/lessons/05-breath-steady-note/`
   `LESSON.md`, `FACTS.md` and `WEB-SPEC.md`. The film teaches what the page teaches, in
   the film's own form; it never claims more than this FACTS.md supports.
4. How the earlier films were written: Lessons 1 and 2 in the repo
   (`R/docs/plans/find-your-pitch/lessons/01-what-is-a-note/` and `02-twelve-notes/`:
   BRIEF, SCRIPT, script.json, DECISIONS, LEDGER), and Lesson 4's, backed up in
   `$S/l4film/` (BRIEF.md, SCRIPT.md, script.json, FACTS.md, DECISIONS.md; its
   `tools/script-draft.py` and `tools/gen-root.py` make SCRIPT-DRAFT.md from script.json).
   Lesson 4's film ran 9:11 and passed six film critic rounds; its DELIVERY.md and
   LEDGER.md say what critics found, so you do not repeat those mistakes on paper.

## What to write
1. `BRIEF.md`: in Lesson 4's form (front matter, Intent, what must read with the sound
   off, what must never appear). Length: 6 to 9 minutes at the voiced pace (Merc about
   2.32 and Tavi about 3.08 words a second); the owner allows up to 10.
2. `FACTS.md`: the film's facts, each one carried from Lesson 5's FACTS.md by number
   (or from an earlier lesson's, by lesson and number), with the line of the film that
   uses it. Nothing goes on screen or in a line that is not here. Lines the lesson marks
   for the vocal coach are marked `[coach]` here too, word for word.
3. `script.json`: Lesson 4's schema (title, voices, gap, events), every line with its
   host, its cue id and the sounds it needs (synthesised at exact pitch, no licensed
   music). Then adapt `script-draft.py` and `gen-root.py` (copy them into
   `$S/l5film/tools/`, change only what Lesson 5 needs) and generate `SCRIPT-DRAFT.md`.
4. `DECISIONS.md`: every choice you made and why, numbered, short.

## What the film must do
- Open on the lesson's own cold open and its predict, so the page and the film ask the
  same question; voice the misconception through Tavi and refute it with something the
  viewer hears or sees, not with a lecture.
- Carry Lesson 3 as the recall the page carries, the page's five steps as chapters
  (why pushing moves the note; what the diaphragm does; breathing in; starting a note;
  what a steady note looks like), the viewer's own turn (hold one note: say plainly
  what to do, give a count-in, leave the room to sing), the quick check as the recap,
  the practise card as the page words it, and the tease into Lesson 6.
- The care line and every safety line stand as the lesson words them. No health promise,
  no method the facts do not hold, no claim about anyone's body beyond the facts.
- Every idea must read with the sound off and captions on; the bottom 17 % of the frame
  stays clear for captions; name what the picture shows in a short PICTURE line for each
  scene, as Lesson 4's script-draft does, so the storyboard round can start from it.

## Hand back
A short report: where the files are, the estimated length, the scene list with each
scene's purpose in one line, the facts you could not find support for (and so left
out), the lines marked [coach], and the questions the lead must decide.
