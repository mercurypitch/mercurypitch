You are a builder on the MercuryPitch repo. This run is the 0.9.23 polish pass: layout and touch-target faults found in the 0.9.22 release checks, all in code that shipped before 0.9.22. The lead reviews your work and opens the PR. You never push, open PRs, merge, rebase or use git stash.

## Where

- Worktree: /home/user/mercurypitch/.claude/worktrees/polish23, branch `feat/polish-0923`, at origin/main. Check `git log --oneline -3` and `git status` first. Work only there.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/polish23/out/ (create it). Keep logs small.
- Another builder works at the same time in /home/user/mercurypitch/.claude/worktrees/checkup on a weekly Check-up: Home (HomePage.tsx and its CSS), the Voice Mirror's results (MirrorApp.tsx), onboarding's Keep beat, and a new check-up module. Stay out of those files, with one exception: item 3's font rule may touch the Mirror's stylesheet (src/features/mirror/mirror.css), and only for that rule. The lead is also merging lesson PRs (src/features/lessons, docs/find-your-pitch). Stay out of those until the lead sends you phase 2. The only shared file is docs/agent/INDEX.md, which you regenerate last if you add a module.

## Read first

- $S/polish/BUILDER-RULES.md: git, the heavy and light lanes, builds, disk, browser tests, the report. It applies in full, with two changes: the other heavy users here are the Check-up builder and the lead's gate runs; and about 8 GB of disk is free (still delete your own dist/ and test-results/ when done).
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md, docs/agent/MISTAKES.md.
- The app-check skill (.claude/skills/app-check/SKILL.md). The release sweep that found these: $S/release/appcheck/sweep/report.txt and its screenshots in the same folder. Its scripts needed a scratch copy here to launch the container's browser: $S/release/appcheck/scripts (PW_EXEC=/opt/pw-browsers/chromium). Use that copy, and run the sweep over your build before and after.
- The header comment of every file you change.

## Phase 1: now, one commit per item

1. **The Map's fifth door on phones** (fix(onboarding)). BeatMap.tsx's "And also" row (the label, then its doors; the Lessons door made it five) wraps the fifth door onto a second row by itself on a phone. Make the row read as one set at 320, 360, 390 and 430 px wide: all on one row if they fit, or wrapped into balanced rows (for example two columns of doors under the label), never one door alone. The desktop layout stays as it is. Check the Map in both places it appears (First Light's map beat and the app's #/map) and keep the Map's tests and the tour targets passing.
2. **The phone header's touch targets** (fix(shell)). On every app page at 390 px the header's "Menu" is 42x34, the "MercuryPitch" home link 81x22, "Turn voice control on (V)" 31x31 and "Support MercuryPitch" 34x26. Give each a hit area of at least 44x44 on coarse pointers without changing how the header looks or how tall it is: padding with matching negative margin, or a transparent pseudo-element, the way the repo already does it elsewhere (search for an existing pattern first and reuse it). Nothing may overlap a neighbour's hit area.
3. **Controls not in the app font** (fix(ui)). The sweep found buttons or inputs drawn in Arial: Karaoke Night (6 on a phone, 7 on a desktop), Piano Night (1), the Voice Mirror (1, the privacy button). Find each (the sweep's control-font check names how it finds them) and make it inherit the app font, at the narrowest place that fixes it (one rule for a shared component beats seven per-button rules). Do not change sizes or colours.
4. **Karaoke Night's phone targets** (fix(karaoke-night)). At 390 px: the home mark 22x22, "App" 71x31, "Sign in" 81x29, "Hide panel" 81x28. Same rule as item 2.
5. **Piano Night's phone settings** (fix(piano-night)). At 390 px the mobile nav overlaps the settings drawer's top line (nav.mobileNav over aside#piano-night-settings .drawerTopline, 390x49). Make the drawer start below the nav, or the nav give way while the drawer is open; choose by what the room's header comment says it wants.
6. **Small "?" and "i" buttons** (fix(ui)). The InfoPopover trigger (src/components/InfoPopover.tsx) is 20 px, Jam's "?" is 20 px, and the toast's dismiss is 24x23. Give each at least 24x24, and 44x44 on coarse pointers, keeping the glyph's size.
7. **Text cut with an ellipsis** (review, change only where it is wrong). The sweep flagged: Analysis "Josh Woodward · Goodbye to Spring" (desktop), Drum Night "4 beats" (desktop) and "Built-in groove · 28 hits · 84 BPM" (phone), Guitar "C Major Scale (C4)" (phone), Piano Night "bars 1–4 · Afterglow Studio" (phone). An ellipsis on a long song title in a fixed row is by design. "4 beats" cut on a desktop is not. Fix the ones where the text is short or the meaning is lost; for each one you leave, say why in your report.

Leave Piano Night's keys as they are: a piano key is narrow by nature, and the sweep counts each key as a small target.

## Phase 2: only when the lead's message says the lesson PRs are in

8. **Lesson 6's tune keeps its first width** (fix(lessons), a draft lesson): when the window narrows, the tune's note buttons stay where they were laid out at the first width. They must lay out again on resize (and on a rotation), without losing the step's state.
9. **Lesson 7's hero "Play" is 1 px wider than its card at 320 px** (fix(lessons), a draft lesson).

You will rebase nothing yourself: the lead will tell you which commit to start phase 2 from.

## Tests and checks

- Each fix has a test where one can hold it: a unit or component test for logic, a browser spec with measured boxes for layout (src/e2e has examples that measure boxes; follow docs/agent/TESTING.md: no waitForTimeout, no .count() assertions). Mutation: take each fix out and show a test fails.
- The app-check sweep before (on origin/main) and after (on your branch), phone and desktop, light and dark: report the WARN counts per page before and after, and that FAIL stays 0.
- The tours: item 2 changes the header that tours point at. Run the tour-check skill's walk (desktop and phone) and report its TOTAL line and any MISS.
- Screenshots of each fix before and after, at the sizes named, under $S/polish23/out/shots/. Look at them yourself before you report.
- The repo gates in BUILDER-RULES.md, and first-paint budgets (no budget raised for this).

## Your report (your final message after phase 1, and again after phase 2)

As in BUILDER-RULES.md: commits, files per commit, every gate with its result and log path, the sweep's counts before and after, the tour walk's line, screenshots, the mutation list, what you left and why, and what you did not verify.
