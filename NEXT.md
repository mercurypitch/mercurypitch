# Next builders, as worktrees free (lead's queue)

Free a worktree only after its agent's report is in. Reuse one by `git worktree move` + `git switch -c <branch> origin/main` + `pnpm install --frozen-lockfile --offline`, and delete its dist/ and test-results/ first. Keep at least 1.2G free.

## Frees soon
- kit-ladder: free once the lead has run A4's last vitest and folded its fixups.
- l9-nopage: B0 folded and pushed (d10168b66); free.
- e2e-wav, kit-mic: A5/A8 folded and pushed; free once their integration is planned (A8 now on feat/kit-run's tip).
- kit-octave: A3 folded and pushed (68f7cedb5); free.
- (app-slug became l12-warning.) l9-flow: after the B11 fixes and its integration (S4 rename at the cherry-pick).

## Policy (owner, 24 Oct)
At most two agents at a time, on two different things. Every builder is spawned at xhigh. No reviewer agents: the lead reviews each PR once, at max.

## Owner decisions, 24 Oct 21:55 UTC
- Tour: the five steps are approved.
- Freeze fix: its own small PR; the lead reviews it once at max and MERGES it for the next release (v0.9.22, not yet tagged; latest tag v0.9.21). The friend then checks on dev with the GPU caches cleared.
- Tour PR: stays open after the lead's review, as the place for the owner's polish items; merge only when the owner says. (The owner offered one PR for both; the lead keeps them apart so the fix is not held by polish, and said so.)
- Usage limit / container sleep (owner said yes, 24 Oct 23:00 UTC: "keep it simple", never clean up the machine):
  - Backup: the 17 local-only branches with commits were pushed to origin (no PRs; pushes to feat/ start no CI). The 5 empty ones (lesson-10-chords, lesson-10-layout-hero, lesson-10-sing-quiz, kit-names-modes, lesson-page-tour) were not. These notes go to the branch feat/lead-notes with bin/push-notes (run it after a material change).
  - Wake-ups: one-shot trig_01UKqXthrKXUhJ9Akm3z2ThY moved to 06:53 UTC 25 Oct (3 min after resetsAt 06:50; it was 01:53); at each wake, arm the next one for the new resetsAt + 3 min. Recurring check-in trig_01JGQdH9F56vCzkd9UvFFRJv every 2 h at :01 (first 00:01 UTC 25 Oct), fires into this session. Disable it (update_trigger enabled=false) once the queue holds only owner decisions.
  - No usage percentage exists (get_session rate_limit_info: status + resetsAt). Start no new agent unless status is "allowed".

## Now (the two slots)
- slot 1: L12 music builder (l12-music), resumed 02:28 25 Oct at P3's mutations (then P4, P8, map, gates, report). A5/A8 finished 02:27: all gates pass; lead checks the fixups, then folds them.
- slot 2: L10 K5 then K4 builder (kit-spiral), resumed 01:53 25 Oct at step 1 of l10/k5k4-handback.md.
- A1b (l9-rungs) reviewed at max 25 Oct ~02:20: no code findings (l9/review-a1b/REPORT.md). At integration fix d854cf079's "four citations" -> three; two notes for the Lesson 9 page brief (gaps between slots an arc joins; remount the chart on a voice change).
- Lead queue besides the freeze fix: folded and pushed with leases, each tree checked (02:35-02:45 25 Oct): A3 feat/kit-octave-tag 68f7cedb5 (tree 088f2d0e); B0 feat/lessons-no-page-tests d10168b66 (tree 9c074960; origin had only the pre-fixup 33537af37; walk re-run: pages 9, 10, 12, 11, 13 pass 128/128, at 14 the nine fixture tests fail by the helper's message and AdminLessonsPage's planned-lesson test with a TypeError = l9/FOLLOWUPS N4; helper mutation turns the nine red; message says so); A5 feat/e2e-steps-wav c922f08b1 (tree ce19e8d2; rests sentence and fuller test paragraph in the message); A8 feat/kit-mic-hold d0789109d, moved onto feat/kit-run's tip 659265535 (patch-id unchanged; mic-hold + sing + run tests 48/48). All four still sit on 5e08dd4a3 or kit-run: rebase onto main and gates when each goes into its PR.
- Lead (no agent): feat/merc-shader-compile is PR #1200 (subscribed). Head 45db17627 = 6 commits on 2bc138b4e (216f3bfe8 A, now with the AlleyGuide test fix folded in and the alley line in its message; a3774604a B; a9ac893ba C; cba63409e D; b48178c95 restore fix; 45db17627 docs). Pushed 02:30 25 Oct with a lease on 677118dc1 (tree 0fe1142d = the pre-squash tree; range-diff: only commit 1 changed). Before it: root pnpm check 0 errors / 11 warnings, native vitest 166 files / 1,847, native check, build and store-binary assertion pass, AlleyGuide 9/9 (repro 2 failed first). Body updated (item 1's alley bullet, Checks' native line). CI on 45db17627: Mercury Pitch passes; the rest running. Next: on green, merge (rebase, expectedHeadSha 45db17627, bin/verify-rebase-merge.sh), unsubscribe, ask the owner for the friend's Windows check on dev with GPUCache, ShaderCache and GrShaderCache cleared (or a fresh --user-data-dir), then the tour.
- Playwright: the checkouts' @playwright/test 1.60 wants chromium 1223; /opt/pw-browsers has only 1194. Run every e2e with PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers (the builders' shim). Never `playwright install`.
- Tour (no agent now): builder finished 00:53 (a94ae7884 feat, f8f4a964f docs, f8e319135 map, on 5e08dd4a3; every gate green; L3 first paint 77 B left once main's films are in, before the freeze fix's -1,387 B). Lead review at max: no findings. Next (lead): once the freeze fix merges, rebase onto main, regenerate the map, gates (check, kit+lessons vitest, all learn e2e, first paint), push, PR left OPEN for the owner's polish. Owner questions for the PR: smooth scroll vs jump between steps; replay in the menu foot. Lead decision on the builder's Q1: Lessons 9-14's page builders add `fyp-tour` to their WEB-SPEC Contracts when they build each page.

## Paused, resume in this order (one per free slot, by SendMessage; each has a WIP/status hand-back coming)
1. L9 A1b successor (l9-rungs): A1a fixups, then A1b.
2. (done) L9 B11: review fixes in and folded (ebab6310b, c15407f66); the lead integrates it onto feat/lesson-09-page with S4 (no agent).
3. L9 fixup rounds: A3 then B0 (one agent), A5 and A8 (one agent). A4 needs no agent: its fixups are in; the lead runs the one vitest left (kit + lesson-03/05/07) at the fold.
4. L10 kit: K5 then K4 (kit-spiral), K2 (kit-run), K3 then K1 (kit-movedo).
5. L12: P1-P4, P8 (l12-music), then L12-C2 (l12-warning).

## Earlier queue
0. (started) feat/lesson-order-warning: L12-C2, in l12-warning.
0b. (started) feat/merc-shader-compile: Merc compile fix for the Windows freeze, in merc-compile.
0c. (started) feat/lesson-page-tour: first-visit tour (tour/PLAN.md), in lesson-tour.

Note: the lanes' memory gate read a stale cgroup path after the 21:00 restart (fixed 21:45: both read /proc/self/cgroup; heavy now waits for 5 GiB free).

## Lesson 10, branches per l10/DECISIONS 16
1. feat/lesson-10-chords: P1 (PLAN 548), P2 (572), P3 (600), P7 (689).
2. feat/lesson-10-sing-quiz: P4 (620), P5 (641), P8 (709); then feat/lesson-10-app-copy: C10-4 (1318) with decision 15.
3. feat/lesson-10-layout-hero: P6 (666), P9 (739), P10 (768; render through heavy, local only).

## Lesson 12, per l12/DECISIONS 16
4. feat/lesson-12-sing-layout: P5 (671), P6 (686), P7 (700).
5. feat/lesson-12-rooms, stacked on feat/lesson-12-music after its P1: P9 (735), P10 (760).

## Integration (lead)
- feat/lesson-09-page (now checked out in the l9-flow worktree; l9-page holds feat/leap-ladder-slug for C1's PR): B3 9bf99c285, B4 47d3f7429, quiz 1c3aa7112, B11 253d7e85c (S4 applied: LadderId type from ./ladder-data, LADDER_ORDER; prettier's re-wrap of one it.each folded in), map 54abcfabb (41.7k -> 43.1k). Gates green: lesson-09 vitest 8 files / 154 tests, word counter 22/22, docs:index current, plan-cites 183, pnpm check 0 errors / 11 warnings. Old head tagged lead/page-before-b11 (ece88ad98). Gates for B11's integration: l9/page-int-b11/. Next: the B-tasks.
- A1a's final branch = A1a's folded commits from the feat/lesson-09-arcs stack (A1b's builder adds A1a's fixups there).

## Open PRs (lead's; subscribed; merges hold for the owner's v0.9.22 tag)
- #1198 C1 /exercises/leap-ladder: feat/leap-ladder-slug 855efc050 on 2bc138b4e (l9-page worktree holds it). Lead review: no findings. CI all green (PR Gate, Build & Deploy, Mobile; 22:33 UTC).
- #1199 A4 kit ladder reader: feat/kit-ladder-reader 228b58e71 on 2bc138b4e (kit-ladder worktree). Lead review: no findings. CI all green.
- Both touch docs/agent/INDEX.md and Lesson 9 FACTS/WEB-SPEC: whichever merges second rebases and regenerates the map.
- Safety-net check-in for #1198/#1199 fired 23:09 UTC: both green, clean, no threads. The 2-hourly check-in covers the PRs from here (no separate re-arm).
