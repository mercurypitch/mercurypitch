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
- slot 1: L10 K2 builder (kit-run, feat/kit-run-chords), resumed 03:10 25 Oct with rulings 1-5 (split run.test.ts into kit/run-chords.test.ts first), then pnpm check, build + L7 first paint, learn-lesson-07 specs, plan-cites (= its base), pr:validate, map, report.
- FINISHED 03:05-03:08 25 Oct, backed up to origin 03:20: L12 music (feat/lesson-12-music 0577b23f9, 6 commits on 5e08dd4a3, all gates pass; lead rulings on its questions in PAUSED.md); L10 K5/K4 (feat/kit-spiral-owner 0630104f5 on 5e08dd4a3, feat/kit-spiral-rest 14914d46a stacked; all gates pass; L1 +1022 B, L2 +1022 B in all). L12 music reviewed at max 03:45, no findings (l12/review-music/REPORT.md); K5/K4 reviewed at max 03:35 (K4 fix 34649659c by the lead, l10/k4-review/REPORT.md). Each needs a rebase onto main, map regeneration and full gates at PR time.
- slot 2: L10 K3 then K1 builder (kit-movedo), resumed 03:15 25 Oct: soft reset of its WIP into the K3 commit, gates, then K1 on feat/kit-names-modes (separate branch from 5e08dd4a3).
- Queue after these: L12-C2 ((builder), l12-warning). Then no paused builder is left; new builders per the Lesson 10/12 branch lists below, when the owner wants more.
- A1b (l9-rungs) reviewed at max 25 Oct ~02:20: no code findings (l9/review-a1b/REPORT.md). At integration fix d854cf079's "four citations" -> three; two notes for the Lesson 9 page brief (gaps between slots an arc joins; remount the chart on a voice change).
- Lead queue besides the freeze fix: folded and pushed with leases, each tree checked (02:35-02:45 25 Oct): A3 feat/kit-octave-tag 68f7cedb5 (tree 088f2d0e); B0 feat/lessons-no-page-tests d10168b66 (tree 9c074960; origin had only the pre-fixup 33537af37; walk re-run: pages 9, 10, 12, 11, 13 pass 128/128, at 14 the nine fixture tests fail by the helper's message and AdminLessonsPage's planned-lesson test with a TypeError = l9/FOLLOWUPS N4; helper mutation turns the nine red; message says so); A5 feat/e2e-steps-wav c922f08b1 (tree ce19e8d2; rests sentence and fuller test paragraph in the message); A8 feat/kit-mic-hold d0789109d, moved onto feat/kit-run's tip 659265535 (patch-id unchanged; mic-hold + sing + run tests 48/48). All four still sit on 5e08dd4a3 or kit-run: rebase onto main and gates when each goes into its PR.
- Freeze fix: PR #1200 MERGED 02:45 25 Oct (rebase, expectedHeadSha 45db17627): main 9c68c53cc; verify-rebase-merge: subjects, messages, authors and dates, patch-ids 6/6 and tree all the same. Unsubscribed. Build & Deploy for 9c68c53cc succeeded 02:49; dev's sw.js carries 9c68c53cc. Asked the owner for the friend's Windows check on dev (GPUCache, ShaderCache, GrShaderCache cleared or a fresh --user-data-dir; Lesson 1 first). Owner tags v0.9.22 when ready.
- Playwright: the checkouts' @playwright/test 1.60 wants chromium 1223; /opt/pw-browsers has only 1194. Run every e2e with PLAYWRIGHT_BROWSERS_PATH=$S/pw-browsers (the builders' shim). Never `playwright install`.
- Tour (no agent now): rebased onto main 9c68c53cc 02:50 (196caea41 feat, baa41027d docs = a94ae7884, f8f4a964f by range-diff; old map commit dropped, map regenerated as 7b1f710bd: lessons row 41.7k -> 42.3k); old head tagged lead/tour-before-rebase and pushed as a backup to origin feat/lesson-page-tour (f8e319135). plan-cites 157 = main. Gates (03:50): check, index, pr:validate, metrics, lessons unit 133/1243 pass; first-paint assert passes (26 documents); learn e2e 362 passed, 2 skipped, 1 FAILED: learn-explorer.spec.ts:117 iPad mini 1133x631 'a tapped node scrolls its card in' (main button not in view in 5 s; the spec uses helpers/lesson-page, so no tour; run under two builders' load). Next: after gates2 (main build + fp-main), rebuild the tour and re-run that test --repeat-each, and on main if it fails again. Was: Gates running: tour/int/gates.sh -> tour/int/summary.txt (check, index, pr:validate, metrics, lessons unit, build:e2e + first paint vs main built in merc-compile, all 27 learn specs). Then fill tour/pr-body.md (FP_JS, FP_CSS, GATES), push with lease on f8e319135, open the PR and leave it OPEN (owner's polish; merge only on the owner's word). Owner questions in the body: jump vs smooth scroll; replay in the menu foot. Lead decision on the builder's Q1: Lessons 9-14's page builders add `fyp-tour` to their WEB-SPEC Contracts.

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
- Both touch docs/agent/INDEX.md and Lesson 9 FACTS/WEB-SPEC: whichever merges second rebases and regenerates the map. After #1200 (which also touched INDEX.md), both still merge cleanly (merge-tree, 02:50), but rebase each onto main and regenerate the map before its merge.
- Safety-net check-in for #1198/#1199 fired 23:09 UTC: both green, clean, no threads. The 2-hourly check-in covers the PRs from here (no separate re-arm).
