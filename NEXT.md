# Next builders, as worktrees free (lead's queue)

Free a worktree only after its agent's report is in. Reuse one by `git worktree move` + `git switch -c <branch> origin/main` + `pnpm install --frozen-lockfile --offline`, and delete its dist/ and test-results/ first. Keep at least 1.2G free.

## Frees soon
- kit-ladder: free once the lead has run A4's last vitest and folded its fixups.
- l9-nopage: after the B0 review.
- e2e-wav, kit-mic: after the A5/A8 review; A8 rebase onto feat/kit-run's tip first (in kit-mic).
- kit-octave: after the A3 review and its fixes.
- (app-slug became l12-warning.) l9-flow: after the B11 fixes and its integration (S4 rename at the cherry-pick).

## Policy (owner, 24 Oct)
At most two agents at a time, on two different things. Every builder is spawned at xhigh. No reviewer agents: the lead reviews each PR once, at max.

## Owner decisions, 24 Oct 21:55 UTC
- Tour: the five steps are approved.
- Freeze fix: its own small PR; the lead reviews it once at max and MERGES it for the next release (v0.9.22, not yet tagged; latest tag v0.9.21). The friend then checks on dev with the GPU caches cleared.
- Tour PR: stays open after the lead's review, as the place for the owner's polish items; merge only when the owner says. (The owner offered one PR for both; the lead keeps them apart so the fix is not held by polish, and said so.)
- Usage limit / container sleep (owner said yes, 24 Oct 23:00 UTC: "keep it simple", never clean up the machine):
  - Backup: the 17 local-only branches with commits were pushed to origin (no PRs; pushes to feat/ start no CI). The 5 empty ones (lesson-10-chords, lesson-10-layout-hero, lesson-10-sing-quiz, kit-names-modes, lesson-page-tour) were not. These notes go to the branch feat/lead-notes with bin/push-notes (run it after a material change).
  - Wake-ups: one-shot trig_01UKqXthrKXUhJ9Akm3z2ThY at 01:53 UTC 25 Oct (3 min after resetsAt 01:50); at each wake, arm the next one for the new resetsAt + 3 min. Recurring check-in trig_01JGQdH9F56vCzkd9UvFFRJv every 2 h at :01 (first 00:01 UTC 25 Oct), fires into this session. Disable it (update_trigger enabled=false) once the queue holds only owner decisions.
  - No usage percentage exists (get_session rate_limit_info: status + resetsAt). Start no new agent unless status is "allowed".

## Now (the two slots)
- slot 1: feat/merc-shader-compile (Merc compile fix), then its PR review.
- slot 2: feat/lesson-page-tour, then its PR review.

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
