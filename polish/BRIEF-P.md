You are a builder on the MercuryPitch repo. This run makes six small fixes to onboarding, the plan screen, the Map and Home for the 0.9.22 release, from the owner's walk-through and a local browser walk. The lead reviews your work and opens the PR. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/e2e-wav, branch `feat/onboarding-plan-polish`, at origin/main cddefd571. Check `git log --oneline -3` and `git status` first. Work only there.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/polish/P/ (create it). Keep logs small.
- Another builder works at the same time in /home/user/mercurypitch/.claude/worktrees/kit-mic on the lesson pages, the site worker and the room entry documents. Stay out of those; the only shared file is docs/agent/INDEX.md, which you regenerate last.

## Read first
- $S/polish/BUILDER-RULES.md: git, the heavy and light lanes, builds, disk, browser tests, the report. It applies in full.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md, docs/agent/MISTAKES.md.
- The header comment of every file you change: most of these files list the things that are easy to break.
- The walk's screenshots: $S/onb/shots/11-twin.png, 12-keep.png, 17-plan.png, 17-plan-desktop.png, 19-map.png, 19-map-desktop.png (a synthetic steady 220 Hz voice, so the range read is A3 to A3); $S/onb/shots2/02-plan-no-voiceprint.png, 03-plan-foot.png. The walk scripts are $S/onb/walk.cjs and walk2.cjs, if you want to replay a state.

## Scope, in this order, one commit each

1. **A range read that is not clean is not a narrow range** (fix(onboarding)).
   - Today: `pickFirstStop` (src/features/onboarding/first-stop.ts) sends any range under 12 semitones to the range stop, including the 0-semitone read a steady tone gives. The twin already treats that read as unclean: `singerForRange` returns null (no voice type for a zero span), and BeatTwin says "Merc couldn't get a clean read on your range this time". Then the plan says "There's more voice up there than you're using" with the Your voiceprint chip, Keep shows "A3 to A3" (KeepRange), and the twin's stat card shows A3 and A3.
   - Want: one rule for a clean range read, in src/lib/mirror beside `singerForRange`, the same rule the twin uses, and every onboarding surface reads it:
     - `pickFirstStop` reads the range only when the read is clean; an unclean one counts as not measured (both scores solid then gives the strong stop; nothing measured gives the default stop, as today).
     - Keep shows no range card for an unclean read, and the twin's stat card shows no ridge, notes or range cell for it (TwinStatCard already draws "a run with no range" that way).
     - The voiceprint share from the twin (FirstLight's `handleShareVoiceprint`, `summarize`) carries no unclean range. Check what the shared card shows; if the only fix would change the Voice Mirror's own results, history or cards, stop at onboarding and say so.
   - Do not change `computeRange` or the Voice Mirror's own screens.
   - Tests: the rule itself; `pickFirstStop` (a 0-semitone read with solid scores is not the range stop; a clean 5-semitone read still is); Keep and the stat card with an unclean read.

2. **The plan's main button starts the first stop** (feat(plan)).
   - Today: the biggest button on the plan screen (PlanScreen.tsx, the actions row) is "Show me around", which enters Start here with its room's tour where one exists (usePlanFlowController `showMeAround`). "See every room" is the quiet one under it. What the owner agreed to: the biggest button starts the recommended stop, not a tour, and nothing is cut.
   - Want: the primary button opens Start here exactly as its card does (`onOpenStop(plan.start)`, so the same funnel event and the same entry), labelled "Start here" (the card's own kicker, KICKER in plan-copy.ts), with the arrow it has today. "Show me around" stays, as a secondary button, doing what it does now. "See every room" stays as it is. Not now stays in the corner.
   - Layout: at 390 px the primary is the full-width button and the two others sit under it, on one row if they fit at 320 px, else stacked; on a wide screen the three are one row. Both hosts get it: First Light's plan (BeatPlan) and the plan layer over Home (PlanLayer).
   - Tests that name these buttons: PlanScreen.test.tsx, BeatPlan.test.tsx, PlanLayer.ways.test.tsx, FirstLight.plan.test.tsx, src/e2e/onboarding-mic.spec.ts, onboarding-plan-keyboard.spec.ts (Tab order: the plan before the ways on, the primary first among them).

3. **With a voiceprint, Start here keeps its answer** (fix(plan)).
   - Today: when the voiceprint leads (build-plan.ts `voiceprintStart`), the card says the voiceprint's reason and "You said telling if you're getting better is the hard part." and stops. Without a voiceprint the same pick is answered: "Every take lands in Progress, so you can watch the line move." (plan-copy.ts, START.singing.progress).
   - Want: for the 'progress' pick, the voiceprint's card ends with that answer, but only where it is true for the voiceprint's stop. Progress counts voice runs only (plan-copy.ts's own note on run-kinds.ts): check that a run in Exercises, the Ascent and Karaoke Night lands in Progress. Where it does not, leave that stop's card as it is and say so.
   - Read the 'tune' and 'what' picks the same way. Change them only if one reads as unanswered in the same way, using a line plan-copy.ts already has; otherwise report what each says.
   - Words only from plan-copy.ts, pinned in build-plan.test.ts, as plan-copy.ts's header asks.

4. **Home's Lessons link opens the visitor's current lesson** (feat(home)).
   - Today: Home's Lessons link (src/pages/HomePage.tsx, `data-testid="home-lessons"`) goes to /learn/01 for everyone.
   - Want: the first lesson released as built that the visitor has not marked done, and the hub /learn/ once every released lesson is done.
     - Released as built: not in DRAFT_LESSONS (src/features/lessons/kit/drafts.ts) and with a page (kit/season.ts). Never a draft: the app shell does not know the admin console's publish state, so it offers only what every environment serves. Today that is Lessons 1 and 2.
     - Done: the lesson pages' own list, localStorage `fyp-done` (kit/progress.ts), read as tolerantly as progress.ts reads it.
   - One helper in src/lib, used here and by item 5. The crossFeatureImports count (537 on main) must not rise: drafts.ts and season.ts are pure data, and the key and its parse can move into src/lib so that kit/progress.ts imports them from there. If the only way is a new cross-feature import, stop and say so.
   - Native builds: the lessons are web pages. Check how Home keeps its Lessons link out of the native build and keep it so.
   - Tests for the helper: nothing done gives /learn/01; 1 done gives /learn/02; 1 and 2 done gives /learn/; junk or a missing key gives /learn/01; a draft is never returned, even when it is the next number.

5. **The Map shows the lessons** (feat(onboarding)).
   - Today: the Map (src/features/onboarding/beats/BeatMap.tsx, data in rooms.ts) has six rooms and the "And also" doors: Challenges, Guitar, Piano, Voice Mirror. Nothing for the lessons, which lead this release. The owner: "see all rooms opens the chips with rooms but without lessons, we could add lessons link as well in and also section on that page." It is the Map the plan's "See every room" opens, and #/map replays it.
   - Want:
     - **A Lessons door** in "And also": a page door to the current lesson (item 4's helper), with its own funnel event as every other door has (one line in src/lib/funnel-event-catalog.ts; the db-worker's allowlist follows from that file; FirstLight.test.tsx lists each door's event).
     - **A Lessons section** on the Map, in the Map's own style, that names the current lesson by its title and links it. If it has a picture, the lesson's cover (public/learn/lesson-NN-og.jpg carries its title in the picture) shows whole, never cropped. Put it where it reads as part of the Map without pushing the recommended room down, and say why there.
     - Web only: neither shows in a native build.
   - Words: "Lessons" (Home's label), the lesson's title from the season data, and Home's link title "Find Your Pitch: free lessons on notes and singing" if a line is needed. Nothing new beyond that; if the section needs a sentence those do not give, quote what you used in the report.

6. **The Learn card's cover shows whole, and the plan uses a tablet's width** (fix(plan)).
   - Today: a Learn card's picture is the lesson's share image (1200x630, with "What is a note?" written on it). The side cards crop it to 100 px wide on a phone and to clamp(120px, 38%, 170px) from 900 px, with object-fit: cover, so it reads "at is a no" ($S/onb/shots2/03-plan-foot.png). Under 900 px the cards stay in a 440 px column whatever the screen's width.
   - The owner, on a tablet: on the screen after the account, the lessons are offered on the right, and "the lesson image and text on it was squished to narrow component instead of flowing nicely to cover the available space on the right".
   - Want: at 768x1024, 820x1180, 1024x768 and 1180x820 (and still at 390x844 and 1440x900), the plan's cards use the width they have, the Learn card's cover shows its title whole, and no card's words are squeezed. Screenshot every size first and find the cause before changing anything. Room covers (Merc in a room) may still crop. Look at Home after an account at the same sizes too: if a lesson card there squeezes the same way, it is in scope.
   - Screenshots before and after at each size, with and without a voiceprint (the Start here card is bigger with one).

7. **The module map**, regenerated, as your last commit, if a module was added.

## Rules
- BUILDER-RULES.md applies in full.
- Copy: every word on screen already exists in the app (plan-copy.ts, questions.ts, rooms.ts, copy.ts, Home's labels), except where an item above says otherwise. Quote any new words in your report.
- No function above cognitive complexity 15: check your files with `node_modules/.bin/eslint -c eslint.audit.config.js --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' <files>`.
- Keep each commit to its own item.
- The Singing tab's tour and the route "Show me around" takes to it are not in scope: the owner says the Singing page has its tour.

## Gates before you hand back
- `pnpm check`: no errors and no warnings beyond main's 11; fold its rewrites into the right commits.
- Unit: your test files, then `pnpm exec vitest run src/features/onboarding src/features/plan src/features/home src/pages src/lib src/tests` through heavy. A failure outside your files: run that file alone on your branch and on origin/main, and report both.
- `pnpm test:scripts`, `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, `node scripts/plan-cites.mjs check` (no more than before your first change).
- `pnpm build:e2e` (stops at the Glassworks step), then `node scripts/assert-first-paint-budgets.mjs dist`: numbers before and after for the app's entry documents.
- Browser specs, `--retries=0`: onboarding.spec.ts, onboarding-mic.spec.ts, onboarding-plan-keyboard.spec.ts, onboarding-viewports.spec.ts, walkthrough.spec.ts, stage-and-tour-focus.spec.ts, and every spec that names Home's Lessons link, the plan or the Map (grep for `home-lessons`, `See every room`, `Show me around`, `data-beat="map"`).
- Tours: the tour-check skill's walk (scripts/walk-tours.mjs), since Home's tour opens on the plan card.
- Screenshots under $S/polish/P/, at 390x844 and 1440x900 unless said: the twin and Keep with an unclean read; the plan with and without a voiceprint (and item 6's tablet sizes); the Map with the Lessons door and section; Home's head with the Lessons link.
- Mutations, each with the test that catches it: the unclean read sent to the range stop again; the stat card or Keep showing an unclean range; the primary button entering with the tour, or "Show me around" removed; the 'progress' answer dropped; the helper returning a draft, or /learn/01 after Lesson 1 is done; the Lessons door or section shown in a native build; the cover cropped again (pin it in PlanScreen's stylesheet test if there is one, or say how you would catch it).

## Hand back (your final message is your report to the lead)
- Commits in order (sha, subject) and files per commit.
- Every test and gate with its result and log path.
- First paint before and after, and any budget you changed, with its reason.
- Screenshot paths, and the tablet cause you found in item 6.
- The mutation list.
- Any words you added, quoted.
- What you could not do or did not verify, and open questions.
