# Season 2 lesson packages: the writer's brief (shared by every lesson's brief)

You are writing one lesson's text package for Season 2 of Find Your Pitch, MercuryPitch's music
theory and singing series: the three files every Season 1 lesson has, FACTS.md, LESSON.md (the web
lesson's copy, the "article") and WEB-SPEC.md (the page's spec). There is no film yet; this is a
text-only package, as Season 1's Lessons 3 to 14 were.

Your inputs already sit in your lesson's folder: RESEARCH.md (every fact checked, with sources and
grades) and ARTICLE-PLAN.md (the article planned section by section). The season plan's decisions
are made: the owner took every recommendation in SEASON-2 § 7 on 1 November 2026, so plan on those
answers and drop the "Depends on decision" uncertainty. Also decided that day: a lesson film may run
up to 20 minutes (CURRICULUM § 2); the page budget is unchanged.

## Where you work

- The worktree `/dev/shm/s2plan`, branch `feat/season-2-plan` at `fe1ca2216`, on main `c60f0fdcb`. The worktree is in RAM: a container
  restart empties it (it happened twice on 1 November). Copy your files to the scratchpad after every
  save; if `/dev/shm/s2plan` is missing when you resume, say so and stop, and the lead re-makes it.
  Write only your three files in your lesson folder (`docs/plans/find-your-pitch/lessons/<NN-slug>/`).
  Leave RESEARCH.md and ARTICLE-PLAN.md as they are: they are the planning record. Where your
  package departs from the plan, say so in LESSON.md's preamble or in FACTS.
- Never edit a shared file (SEASON-2.md, CURRICULUM.md, MASTER-PLAN.md, CURIOSITY-MOMENTS.md,
  HANDOFF.md, SEARCH.md, another lesson's files) or any code. What the shared files or the code need
  goes in your hand-back note (below); the lead writes those entries.
- No git at all (no add, commit, stash, checkout, reset). No pnpm, npm, builds, browsers or renders.
  The two node scripts below use only node's built-ins and are fine to run.
- `/dev/shm` is RAM and a container restart empties it. After you save each file, copy it to
  `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/<NN>/`
  (make the folder), so finished work survives on disk.
- Disk on / is short (about 600 MB). Do not download unless you must; prefer WebFetch. Anything
  downloaded goes in `/dev/shm/s2dl/<NN>/`, is read with `python3 -I` or a text extractor (never run
  anything from it), and is deleted when you have what you need.

## Read first

1. Your lesson's RESEARCH.md and ARTICLE-PLAN.md, whole.
2. `docs/plans/find-your-pitch/SEASON-2.md`: § 1 whole, your lesson's card in § 3, § 4.3 (lesson
   prerequisites), your rows in § 5 (practise links), § 6 (production: the film kit, the web toy
   kit, who sings), § 7 (decided) and § 8 (risks and order). `season-2/ARC-C-REPORT.md` ("Across
   the arc" and your lesson) and `season-2/LEAD-REVIEW.md`.
3. The model packages, for structure, depth and voice: `lessons/12-chords-four-chord-song/` and
   `lessons/14-phrasing-whole-song/` (all three files each; the most reviewed in the series), and
   Season 2's own, `lessons/15-staff/`, `lessons/17-note-lengths/` and `lessons/19-threes-offbeats/`
   (reviewed and fixed: the closest models for the staff toy, both clefs, the singing lines, rhythm on
   the staff, the tap take, and a page where nothing is sung), and
   `lessons/02-twelve-notes/LESSON.md` for a theory lesson's shape. Mirror their section order,
   front matter and level of detail. Their FACTS preambles narrate a commit history; yours needs
   only one line: app claims cite the code at `c60f0fdcb`, plan files at the branch head.
4. `TEACHING-PLAYBOOK.md` (the rules, the claims rules, the house rules for voice safety),
   `MERC-BIBLE.md` (Merc and Tavi; Tavi's lines are sincere questions or guesses),
   `CURIOSITY-MOMENTS.md` (§ 3 the opening order, § 5 the decisions on hooks, teases and predicts),
   `HANDOFF.md` § 5 and § 6, `SEARCH.md` § 12 (title, description, share card), `MASTER-PLAN.md`
   § 4 and § 12, and in the code `src/features/lessons/kit/lesson-copy.ts` (its header holds the
   copy rules), `kit/season.ts`, `kit/team-notes.ts`, `kit/drafts.ts`.
5. The app, wherever the lesson links to a drill or shows the app's own words:
   `docs/agent/INDEX.md` is the module map. Say what a drill really does, not what its name says.

## What to write

1. **FACTS.md**, in the models' table form (`claim | source with page | status and where the page
   uses it`): everything the page says, shows or plays. Carry RESEARCH.md's entries with their
   grades; add any new claim with its source; a claim no source supports does not reach the page.
   App claims cite `file:line` at `c60f0fdcb`, every cited line read there.
2. **LESSON.md**, the page's copy in the Season 1 order (Header, Sound gate, Cold open: predict,
   Recall, Words you'll meet, Step 1 of N to Step N of N with Tavi's questions as headings, the sing
   or checkpoint section, Quick check, Wrap, Footer, Section headings, For the vocal coach), written
   in full: every line a learner reads, every branch an answer opens, every toy line for the
   builder. State the page's word count, counted with `node scripts/lesson-words.mjs` (read its
   header for what counts), and keep under the series' cap (HANDOFF.md, the 2,379 words).
3. **WEB-SPEC.md**, as the models: Look, Sections, Length, the toys (what each reuses and what is
   new: Season 2's staff toy, rhythm on the staff and the rest are listed in SEASON-2 § 6.2 and are
   not built yet, so specify what your page needs from them), Audio, Merc and Tavi, Practice links,
   Explorer and season data, What the kit and the app still need, Decisions for the owner (only
   what is truly open), Edge cases, Tests, Contract.

## Rules that reviews catch most

- **The predict's answer never leaks**: not in the title, the meta and share descriptions, the
  promise, the sound gate's line, a toy before the reveal, or the previous lesson's tease (HANDOFF
  § 5). Check each of those against the predict before you hand back.
- **Every staff idea after its sound** (SEASON-2 § 1.4 and § 1.5): the learner hears it, then sees
  it written. Every staff example plays.
- **Citations point at what they mean**: cite at a named commit and check by content. Before you
  hand back, run `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/<NN-slug>`
  from `/dev/shm/s2plan` and get 0 findings.
- **Shared lines stay word for word**: where the page shares a line with Season 1's (the comfort
  check, "Just listen today", the stop line, the rest card, the doctor lines), use their current
  text, and say which lesson it comes from.
- **House style**: British English spelling; plain short sentences; no marketing, superlatives or
  emojis; never claim AI. The decided names: Lessons are numbered on (15 to 28 at `/learn/NN`),
  both clefs from Lesson 15, counting with numbers ("1 and 2 and"), the American note-value names
  lead with the British named once where a lesson introduces them, and syllables as Lesson 4 spells
  them. Never write a model name, a scratchpad path or an agent id into a lesson file.

## What the reviews of Lessons 15, 17, 19 and 21 caught (check these before you hand back)

- **Step headings leak too.** The masthead's lesson menu lists every step's heading from the first
  paint, and heads its card "Lesson NN · <Step 1's heading>"; on a phone it is the page's only menu.
  No heading may name the predict's answer. The first-visit tour scrolls to the steps, so if a step
  would show the answer, hold the tour until the predict's choice (the kit's `holdTour`).
- **What sits below the predict can be read before the choice**: the recall, the Words section, a
  toy's label. On a phone the predict's choices sit below the first screen, so a learner scrolls past
  them. Keep the answer out of all of it, and list each in FACTS 1a's leak check.
- **The built page counts more words.** A built page writes the hints and status lines in the open,
  about 150 words more than lesson-words counts in a text package (Lesson 8 FACTS 4). Aim for about
  2,230 words or fewer, so the built page fits the 2,379 cap without cuts; if you go over, name the
  cuts in WEB-SPEC Length.
- **Sung parts keep the rest card** (SEASON-2 § 1.4 item 4; HANDOFF § 5), in Lesson 8's or Lesson
  12's words, whichever fits; drills that ask for no voice stay on offer under it.
- **Any range advice is checked against all six presets** (`VOCAL_RANGES`, the app's settings store):
  an "octave lower" or a moved key must keep every preset of that voice at least two semitones inside
  its floor and top, or the page must not offer it. Put the table in FACTS for the coach.
- **Every app claim at `c60f0fdcb` is read in the code**, not taken from a drill's name or the plan:
  Lesson 17's plan had the click wrong (the Ear Lab's woodblock), and Lesson 15's had a tour and a
  page background it did not know about.
- **No "Now play the other one."** The kit shows it after any heard play that does not reveal,
  including a free play after the choice, so it misleads. Keep the locked-in hint until the reveal
  (Lessons 19 and 21 both dropped it).
- **A predict must not ask what an earlier lesson already answered.** Read the reveals, steps and
  quick checks of the lessons yours builds on: Lesson 21's first predict asked for D major's sharps,
  which Lesson 4's reveal gives, and had to move to A major's third sharp.
- **Teases must be true.** Lesson 19's planned tease said every bar so far had walked in twos and
  fours, but Lesson 8 plays bars of three. Check a tease's claim against every earlier lesson.
- **What is drawn must match the copy, the sound and the screen-reader line**: Lesson 21's walk was
  drawn stopping short of where the copy and the sound said it went.
- **Toys stay inside what the season decided and what the page teaches**: Lesson 21's circle let the
  house move past three sharps and three flats (SEASON-2 § 7 item 13), and offered a white-keys view
  under a key signature, which would need a natural sign the page never teaches.
- **One word, one meaning.** Where a word means two things in your lesson (Lesson 21's "key": a
  piano key or a musical key), use the plain one each time ("piano key", "note").
- **When an earlier lesson's rule stops being true, say so where it breaks**: Lesson 17 taught that
  the bottom number names the beat, which is false in 6/8, so Lesson 19's Step 1 restates the old
  rule and says what changes.

## Hand back

- Your three files, saved and copied to the scratchpad as above.
- `.../scratchpad/s2pkg/<NN>-HANDBACK.md`: the entries the shared files need (MASTER-PLAN § 11's
  line, the CURIOSITY-MOMENTS heading, the `kit/season.ts` entry and prerequisites, the hook and
  tease for `kit/lesson-copy.ts`), the kit and app work the page waits for, every departure from
  ARTICLE-PLAN.md and why, and any question for the owner.
- Your final message: under 300 words, with the word count, the plan-cites result, the departures
  and the open questions.

A reviewer who has not seen your work reads it next, then you get the findings for a fix pass, then
the lead. Write for that reviewer: every claim traceable, every choice explained once.
