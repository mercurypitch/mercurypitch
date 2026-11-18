You are a builder on the MercuryPitch repo. This run builds the weekly Check-up for 0.9.23: a reason to come back on day 7, an honest then-and-now view of what moved, a share card with Merc on it, and an account ask built on it. The lead reviews your work and opens the PR. You never push, open PRs, merge, rebase or use git stash.

## Why (the owner agreed this on 26 October)

MercuryPitch has many rooms, but nothing proves to a singer that they are improving. The Voice Mirror's guided run (glide up, glide down, hold, match five notes; about 90 seconds) already saves a dated voiceprint every time, onboarding runs the same three tasks on day 1, and Settings already lists the voiceprints with their changes. What is missing:

1. a Home card on day 7 that offers the next take;
2. a then-and-now view after a take, with numbers only where they are real;
3. a shareable then-and-now card with Merc on it;
4. the account ask said in those terms: an account keeps every Check-up, on every device.

The owner's words: "adding the 7 day checkup and offering that as create account feature". Read that as the account's headline benefit, not a lock: nothing in the app is ever locked behind an account (src/features/onboarding/account-nudge.ts says why), and the Check-up and its then-and-now work without one, in this browser.

## Where

- Worktree: /home/user/mercurypitch/.claude/worktrees/checkup, branch `feat/weekly-check-up`, at origin/main. Check `git log --oneline -3` and `git status` first. Work only there.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/checkup/out/ (create it). Keep logs small.
- The lead is merging lesson PRs into main while you work (src/features/lessons, docs/find-your-pitch, docs/agent/INDEX.md). Stay out of those; the only shared file is docs/agent/INDEX.md, which you regenerate last.

## Read first

- $S/polish/BUILDER-RULES.md: git, the heavy and light lanes, builds, disk, browser tests, the report. It applies in full, with two changes: one other heavy user here is the lead's gate runs, not a second builder; and about 8 GB of disk is free (still delete your own dist/ and test-results/ when done).
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md, docs/agent/MISTAKES.md.
- docs/specs/voiceprints.ears.md (REQ-VPR-001, 007, 011, 014, 023) and docs/specs/guided-voice-check.ears.md section 7 (REQ-GVC-060 to 066: identical retake protocol, no improvement claim inside the noise, neutral wording for small changes).
- The code you build on, header comments first: src/db/services/voiceprint-service.ts (listVoiceprints, latestVoiceprint, LOCAL_CAP, the made-by rule), src/lib/mirror/metrics.ts (MirrorSummary, computeDelta), src/lib/mirror/baseline.ts (the Mirror's existing "since" line), src/lib/mirror/singer-match.ts (isCleanRange, cleanRange), src/features/mirror/MirrorApp.tsx (Results, deltaLine, MirrorAccountAsk), src/features/mirror/entry-intent.ts, src/components/account/VoiceSection.tsx, src/features/progress/share-card.ts and progress-share-model.ts (an honest share card that already exists: claim plus measured facts), src/pages/HomePage.tsx and HomePage.module.css, src/features/onboarding/account-nudge.ts, src/features/onboarding/beats/BeatKeep.tsx, src/db/services/session-service.ts.

## The rules (write them as docs/specs/weekly-check-up.ears.md, REQ-WCU-nnn, in the style of the other specs)

1. **A Check-up is a guided voiceprint.** Every saved voiceprint (onboarding's and every guided Mirror run's; Free Sing saves none) is a Check-up reading: same tasks, same maths (`computeMirrorResult`), so readings compare (REQ-GVC-060). Do not change the Mirror's tasks, timings or scoring, and do not add a voiceprint source: `VoiceprintSource` and the cloud rows stay as they are.
2. **The history** is what `listVoiceprints` gives the viewer (REQ-VPR-007): signed in, the account's takes; signed out, this browser's.
3. **Due.** A Check-up is due when the newest take in the history is 7 or more days old. With no take it is never due: there is nothing to compare yet.
4. **Then and now** exists only when the newest take is at least 7 days after the oldest. No claim before the data exists.
   - Then: the oldest take and, if there is one, the next take within 7 days of it. Now: the newest take and, if there is one, the take before it within 7 days of it, unless that take is already in Then. So each side is at most two takes.
   - Each side's reading is the best of its takes, per metric: the widest clean range (that take's low and high notes together), the highest accuracy, the highest steadiness. That is the best-of-two rule: people improve just by knowing the task, so a single first take undersells where they started.
   - A range read that is not clean (`isCleanRange` false, or no range) never counts for range; its accuracy and steadiness still count.
   - A change is named only when it reaches its threshold: range 2 semitones, accuracy 5 points, steadiness 5 points, one exported constant with a comment saying these are provisional until there is data on take-to-take noise. Under it the wording is neutral ("About the same"), with the two values and no arrow, sign or praise word (REQ-GVC-066). Over it: "3 semitones wider", "accuracy up 9", or "down 6"; a fall is said as plainly as a rise.
   - Practice in between: the number of practice sessions saved between Then's last take and Now's first take (session-service; check which reader counts what Progress counts, and say which you used). Shown only when it is 1 or more: "9 practice sessions in between".
   - Signed out, the view says the readings are this browser's (several people can share one: REQ-VPR-007's reason).
5. **The Home card** (web; check whether the native shell can open the Mirror, and leave the card out of the native build if it cannot).
   - Shown when a Check-up is due, at the top of Home's grid, above the streak card.
   - Words, plain and short, for example: eyebrow "Weekly Check-up"; heading "A week since your last Check-up"; line "Sing the same 90 seconds as on 19 October, and see what moved." (the newest take's date). For two weeks or more, say "Your last Check-up was on 5 October."
   - Primary button "Start my Check-up": opens the Voice Mirror in Check-up mode (rule 6). Secondary "Not this week": the card stays away for 7 days (a stored dismissal, like account-nudge.ts; pure predicate with the clock passed in).
   - Signed out, one quiet line under the buttons: "Your Check-ups stay in this browser. A free account keeps every one, on every device." with "Create a free account" as a text button that opens the sign-up pane (`openAuthModal('register')`). Signed in, no account line.
   - Reads the history once on mount and again when the auth version changes, like the streak card. A failed read shows no card and no error.
   - Its code must not grow Home's first paint by more than about 1 KB: the share renderer and anything heavy load only when used.
6. **Check-up mode in the Voice Mirror.** The Home card opens the Mirror with a flag (for example `/mirror?checkup=1`; check how the Mirror's entry reads its URL and what the share link `?v=` path does, and keep both working). In Check-up mode the Mirror's landing says it is the weekly Check-up (an eyebrow or title line; not a new flow), and everything else is the same run.
7. **The then-and-now panel** shows on the Mirror's results after any guided run (Check-up mode or not) whenever rule 4 gives a comparison, with the take just saved included. It replaces the Mirror's "since" line (deltaLine) while it shows; without a comparison, the results are exactly as today.
   - Then and Now side by side, each with its dates: range as notes ("G2 to C4"), accuracy, steadiness, each change worded per rule 4, and the practice line.
   - "Sing it once more" restarts the run, with the line "Your Check-up keeps the better of your last two takes this week."
   - "Share then and now" (rule 8).
   - Signed out and with no account ever met on this browser (the Mirror ask's own test, `accountKnownHere`), the panel's last line is the account line from rule 5. The Mirror's own ask under the share row stays as it is (REQ-VPR-023 fixes its words).
8. **The then-and-now card.** Built on src/features/progress/share-card.ts (`renderProgressShareCard`, `exportProgressShareCard`: Web Share with a download fallback), so it is honest in the same way:
   - claim: plain and true, for example "My Check-up, then and now";
   - facts: only measured values and the changes rule 4 names, for example "G2–C4 → F2–E4", "3 semitones wider", "accuracy 64 → 78", "9 practice sessions"; never a change under its threshold;
   - period: the two dates;
   - Merc on the card: the blue Merc still (src/features/lessons/lesson-01/assets/merc-blue.png, 512x512 with transparency) drawn on the card. Do not import it from the lessons feature (the cross-feature import count must not rise): copy it where a shared asset belongs, or move it there with Lesson 1 reading it from its new place, and say which you did;
   - no name, handle or email on the card;
   - share text carries the Mirror's tagged share URL (see card-renderer.ts on why the card face and the share text carry different strings).
9. **The account ask in onboarding.** Keep's first row (BeatKeep.tsx, "Your voiceprint and range, saved") becomes the Check-up, said truthfully: an account keeps every Check-up (no 12-take device cap, LOCAL_CAP) on every device. For example "Every weekly Check-up, kept". Keep the row's chip as it is. This also retires the old line's claim of a saved range after a read that was not clean.
10. **No new analytics events and no new storage beyond the card's dismissal.** If you think an event is needed, say so in your report instead of adding it; the owner reviews privacy.

## Commits, one concern each, in this order

1. `feat(check-up): then and now from the voiceprint history` (the pure model in a new module, with its tests)
2. `docs(specs): the weekly Check-up` (the spec, citing the model)
3. `feat(home): the weekly Check-up card`
4. `feat(mirror): Check-up mode and the then-and-now panel`
5. `feat(check-up): the then-and-now share card with Merc`
6. `feat(onboarding): Keep offers the weekly Check-up`
7. `test(e2e): from Home's Check-up card to then and now`
8. `docs(agent): regenerate the module map`

Fold any `pnpm check` rewrite into the commit it belongs to. Commit messages say what and why.

## Tests

- The model (table tests): due and not due at 6 days 23 hours and 7 days; no history; one take; two takes 6 days apart (no comparison) and 7 days apart; best of two on each side; a third take in the first week ignored; an unclean range on one side; each threshold at its edge (1 and 2 semitones, 4 and 5 points) both ways; a fall worded plainly; the practice count between the sides; signed-out wording.
- The Home card: due and shown, not due, dismissed and back after 7 days, signed out with the account line, signed in without it, a failed history read showing nothing.
- The Mirror: the panel with a comparison, none without one (results unchanged, deltaLine still shown), Check-up mode's landing words, the `?v=` share path unaffected.
- The share card: its facts never include a change under its threshold; no handle; Merc drawn (test the draw call through the renderer's seams, as share-card.test.ts does).
- Keep: the new first row, with a clean and an unclean read.
- One browser spec: seed this browser with two takes 8 days apart (localStorage, the service's own key and shape), open Home, see the card, follow it to the Mirror in Check-up mode, and check the panel (seed or stub a finished run if driving the microphone is out of reach; the e2e helpers have a fake microphone, src/e2e/helpers/tone-wav.ts). Also the card's absence with one fresh take.
- Mutations: for each rule, take it out and show a test fails (threshold ignored, best-of-two dropped, unclean range counted, the 7-day due rule, the dismissal, the account line shown signed in, a sub-threshold change on the card).

## Gates before you report

The repo gates in BUILDER-RULES.md, plus:
- First paint: build once before and once after, run `node scripts/assert-first-paint-budgets.mjs dist`, and report Home's and the Mirror's numbers before and after. No budget may be raised for this.
- Screenshots of the Home card (390x844 and 1440x900, light and dark), the Mirror panel (both sizes), and the share card's square and story renders, saved under $S/checkup/out/shots/. Look at them yourself before you report: text that clips, a button under 44 px on a phone, or the card crowding the streak card are yours to fix.
- The tours: if Home's layout change moves a spotlight target, run the tour-check skill's walk for Home (desktop and phone) and report its line.

## Your report (your final message)

As in BUILDER-RULES.md: commits, files per commit, every gate with its result and log path, first-paint numbers, screenshots, the mutation list, what you did not verify, and open questions for the owner (words, the thresholds, anything that touched privacy).
