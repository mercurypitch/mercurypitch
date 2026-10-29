# Brief: plan Season 2 of Find Your Pitch

You are planning Season 2 of "Find Your Pitch", MercuryPitch's music theory and singing series (a
YouTube film plus an interactive web lesson per lesson, hosted by Merc, who explains, and Tavi, who
voices the sincere wrong guess). Season 1 (14 lessons, sound-first, no staff notation) is fully
planned and written; its plan is the model for depth, format and voice. Season 2 exists only as a
one-paragraph outline. Your job: turn that outline into a plan at Season 1's depth.

## Read first (all paths in the repo at /home/user/mercurypitch/.claude/worktrees/l10-page, which is
main at b803c7d43; read-only)

- docs/plans/find-your-pitch/CURRICULUM.md: the whole file. Its § 2 (lesson table and cards) is the
  format to match. Its § 3 (topic graph, the T and S topic tables, the lesson prerequisites table)
  and § 4 (practise links) are what you extend. § 5 is the Season 2 outline you expand.
- docs/plans/find-your-pitch/MASTER-PLAN.md: decisions D1 to D15, formats (§ 4), visual and sound
  language (§ 5), Phase 5, and § 12 (owner decisions; item 4 says 4K is looked at again for Season
  2; item 12 says Season 2's sight-singing inherits the do-based minor).
- docs/plans/find-your-pitch/TEACHING-PLAYBOOK.md (the 25 rules, claims rules, house rules for
  voice safety), MERC-BIBLE.md (the hosts), CURIOSITY-MOMENTS.md (§ 5 item 4: the season's end),
  HANDOFF.md § 4.5 (Season 2 notes: mixed voice as a candidate, sight-singing's minor, no tease).
- docs/plans/find-your-pitch/research/curriculum-benchmark.md: the topic map (T01 to T31, S01 to
  S22) with sources, and the "Season 2 seed"; research/pedagogy-research.md and
  research/app-pedagogy.md for evidence and the app's existing teaching content.
- Lessons 10, 12 and 14 in docs/plans/find-your-pitch/lessons/ (LESSON.md and FACTS.md): Season 1's
  minor, chords and close, which Season 2 builds on. Skim the others' LESSON.md openings so you know
  every Season 1 hook and what each lesson actually teaches.
- docs/plans/find-your-pitch/youtube/YOUTUBE.md for how titles and hooks are written.
- docs/agent/INDEX.md (module map) to find app features. Season 2 practise links can only point at
  what the app really has: check the code. Starting points: src/features/exercises/slug-map.ts and
  the exercise registry, src/lib/ear/banks.ts and item-bank.ts (Ear Lab banks, MINOR_SOLFEGE),
  src/lib/sheet-music-renderer.ts (VexFlow notation already in the app), src/lib/effect-renderer.ts
  (vibrato drawing), the drum, piano and karaoke rooms, Chord Stacker, Drone Intonation, Interval
  Trainer, Scale Runner, Arpeggio Jumper, src/features/lessons/kit/ (the web lessons' shared kit,
  including season.ts). Cite what you rely on as file:line and say what each drill really does,
  not what its name suggests.

## What to write

One file, /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2/SEASON-2.md,
in the house style of CURRICULUM.md (British English, plain sentences, no marketing, no emojis,
tables where they help). Sections:

1. **The promise and the shape.** What a learner can read, hear and sing by the end of Season 2.
   Its arcs (two, as Season 1 has "Hear it" and "Shape it"), 12 to 14 lessons, target lengths.
   Which Season 1 principles carry over unchanged (sound before symbol still holds: every staff
   idea arrives after the sound it writes down), and what changes now that the staff arrives.
2. **The lesson table:** number, track (Theory, Voice, or both), title, topics (the benchmark's
   IDs; add new IDs where the map lacks one, and say so), and the hook question (the cold open).
   Keep the alternation of theory and voice, and make each lesson's closing question the next
   lesson's cold open (CURRICULUM § 1 principle 3). Lesson 14 teases nothing, so Season 2's first
   lesson must open on its own question.
3. **A card per lesson** in Season 1's card format: objectives; misconception (Tavi's sincere wrong
   guess, and what refutes it or shows it half right); signature (the persistent object and its
   transformation); checkpoint (the sung moment, with the voice-safety rules: comfortable, never
   push, octave counts, the comfort check before anything beyond a comfortable hum, hold lengths
   5, 10 or 15 s); practise (a real app link, or "needs building" with what exactly); facts to
   check (the claims the lesson will make and where each will be checked: standards, primary
   research, the app's code). A theory lesson may have an unscored sing-along instead of a scored
   checkpoint, as Season 1 allows.
4. **Topic graph and prerequisites:** the Season 2 topics and their edges (a mermaid graph like
   CURRICULUM § 3's), and a lesson prerequisites table for the explorer in § 3.3's form, where a
   Season 2 lesson may need Season 1 lessons.
5. **Practise links:** what the app opens today for each lesson, and what needs building (new
   launch fields, drills, banks), estimated honestly as code with tests or as data, as CURRICULUM
   § 4 does. Name the gaps.
6. **Production:** what the film kit and the web toy kit need that Season 1 did not have (an
   engraved staff and jumping notes exist as stats-site snippets in research/stats-snippets/;
   rhythm notation, a circle of fifths, two simultaneous voices for harmony, vibrato drawn as the
   app draws it). How harmony lessons get a second singing voice, given MASTER-PLAN § 12 item 1 and
   the hosts (Tavi sings an octave above Merc). The 4K question (§ 12 item 4) with a
   recommendation.
7. **Decisions the owner needs to make**, each proposed with a recommendation and its reason, in
   MASTER-PLAN § 12's style: for example lesson numbering and URLs (continue /learn/15 onward, or
   something else), treble only or bass clef too, the rhythm-counting system, how much of
   Season 1 a Season 2 viewer is assumed to know, release cadence, whether mixed voice gets a
   lesson.
8. **Risks** and a **production order** (which lessons first, and why).

Also write /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2/CURRICULUM-s5.md:
the replacement text for CURRICULUM.md § 5, a short summary that points to SEASON-2.md, and keeps
Season 3's outline.

## Rules

- Write only those two files. Do not edit, commit or push anything in the repository; do not open
  PRs. Do not run pnpm or builds (reading code and git commands are fine). Never run anything in
  the worktree named rel23. Never contact production (mercurypitch.com, the R2 bucket).
- Every claim about music, the voice or learning carries its source (as the research reports do);
  every claim about the app carries file:line from main. If you cannot check a claim, say so
  rather than state it.
- The playbook's language rules hold: no "tone deaf", wrong, bad or failed for a singer; feedback
  describes the sound, never the singer; no claims about breath "support" or "extending range".
- No emojis anywhere. No AI or model names in the documents.
- Use web research where the repo's research does not cover a Season 2 topic (sight-singing
  method, rhythm syllables, vibrato pedagogy and safety, harmony singing pedagogy), and cite it.

## When you are done

Reply with: the lesson table (as in the file), the five decisions you most need the owner to
make, anything you could not verify, and the two file paths. Keep the reply under 600 words; the
files carry the detail.
