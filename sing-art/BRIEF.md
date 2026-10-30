# Sing room artwork: more free and premium covers for the native app's Sing page, and a PR

The owner asked for "more artwork for the free and premium native app sing page, so we have a few
more", generated with the best Higgsfield image model, at most 200 credits in total, and a PR.

## What exists (main, read before planning)

- The Sing tab IS a room with a painting behind the pitch trace. Its one cover today is free:
  `sing-retro-analog-studio` in src/lib/backgrounds/background-catalog.ts (search the id), shipped
  from public/sing/ in four files: retro-analog-studio.webp (landscape), -4k.webp, -portrait.webp,
  -portrait-2x.webp. Read that entry's comments: the calm band the trace lives in (landscape y 0.13
  to 0.58, portrait y 0.08 to 0.56) must stay quiet, low-detail wall, and the focus sits low
  (focalPoint y 0.68). Look at the four files themselves for size, quality and look.
- How the room shows it: src/features/sing-room/ (SingRoomStage.tsx, SingRoomPicker.tsx and its
  test, sing-room.module.css), the room kit's plates (src/components/room-kit/PlateImage.tsx,
  plate-loader.ts), and src/features/premium-exercises/ (the picker's cards sit over the painting;
  card-contrast.test.ts guards their contrast).
- Free and premium rooms: the catalog's free list (CURRENT_FREE_BACKGROUND_IDS, `publicSource`,
  `delivery: 'shipped'`) against supporter rooms (`supporterAccess(id)`, `protectedSource(surface,
  id)`, `delivery: 'master-ready'`). Premium artwork never ships under public/ and never goes into
  git: it is published through the protected Premium Studio by the owner (read
  docs/specs/supporter-backgrounds.ears.md, especially BG-CAT-2 to BG-CAT-8, and look at how the
  Ear Lab's and Drum Night's supporter packs were added: their catalog entries, tests and any pack
  migration under workers/db-worker/migrations/; 0044_sing_background_surface.sql already admits
  the 'sing' surface). Find every test that lists ids or counts rooms (background-catalog.test.ts,
  the picker's tests) before changing anything.
- House rules for art: docs/plans/mobile-native/mobile-kit.md § 4 (generated art is for decorative
  imagery; chrome icons stay SVG), docs/branding/ (the brand), docs/plans/ear-rooms.md (the latest
  Higgsfield-made paintings: model, settings, cropping to a focal point, masked edits).

## What to make

- A small set, sized to the budget: at least two new free covers and two or three premium covers,
  each a distinct, believable place to sing (not another analog studio), each with a portrait and a
  landscape that keep the calm band clear and the focus low, matching the shipped cover's realism
  and light. No people, no Merc, no text or logos, no recognisable real venue or brand, no
  instruments' brand names. Write the room ideas, one prompt per image and the crop plan in
  .../scratchpad/sing-art/PLAN.md first.
- Free covers: the same four files as the shipped one (sizes and WebP quality matched to it), in
  public/sing/, with catalog entries (label, one-line description, focalPoint) and the free list.
- Premium covers: catalog entries as supporter rooms (`master-ready`), plus whatever the pattern
  requires (pack migration, tests). The masters stay out of git: keep them in
  .../scratchpad/sing-art/masters/ and list, in the PR body, each premium room's Higgsfield
  generation (model, settings, job or generation id) so the owner can publish it through Premium
  Studio.

## Generating (Higgsfield)

- Only through a Higgsfield MCP generate tool. Look for it with ToolSearch (for example the query
  "+Higgsfield generate"); this session's connector could only read the catalog and the balance
  when this brief was written. IF THERE IS NO GENERATE TOOL: finish PLAN.md (rooms, prompts, crop
  plan, the exact catalog entries, files and tests you will add, the PR's outline), make no code
  change, and stop with a report saying generation is blocked. Never route around it: no API keys,
  no other generator, no web UI.
- Model: the best Higgsfield image model for photoreal interiors at 4K; check models_list (both
  pages) and models_get. GPT Image 2.5 at high quality and 4K made the latest paintings
  (docs/plans/ear-rooms.md) if it is listed; otherwise choose and say why. Nano Banana 2 (or a newer
  edit model) for masked fixes.
- Budget: 200 credits in total, hard stop. Read the balance before the first generation and after
  every one, keep a ledger in .../scratchpad/sing-art/LEDGER.md (model, settings, prompt, cost,
  generation id, kept or not), and stop generating at 200 spent even if a room is unfinished.
  Measure one generation's cost first and plan the rest from it.

## The machine (shared with a film render)

- Memory is capped and a film render is using most of it until its status file's last line,
  /home/user/mercurypitch/output/motion/lesson-04/renders/film-01.status, reads "... done". Until
  then: no pnpm, npm, build, tests, browsers or Playwright; generation, downloads and image work
  (ffmpeg, cwebp, python3 -I with Pillow) are fine.
- Disk on / has about 1.2 GB free. Keep masters and working files under 300 MB in total, and delete
  rejected images once the ledger records them.

## The PR

- Worktree: reuse .claude/worktrees/presses (clean; its branch feat/coach-bubble-foot is merged).
  Fetch origin main, create the branch feat/sing-room-covers from origin/main there, then
  `pnpm install --frozen-lockfile --offline` after the film is done. Never touch the other
  worktrees (rel23, l10-page, rd, polish23) or the main checkout's branch.
- Follow AGENTS.md and docs/agent/CONVENTIONS.md: conventional commit subjects in the repo's style,
  the repo's configured git identity as author, no Claude attribution or co-author lines anywhere,
  no emojis, no model names in commits or the PR. Run `pnpm check` and the affected tests (catalog,
  picker, sing room, card contrast) and say what passed.
- Open the PR against main with a body that says what was added, shows each cover (link the
  committed free images; describe the premium ones and list their generation ids), the credits
  spent, what the owner must do (publish the premium masters in Premium Studio), and what a person
  should still check on a phone. Use the repo's PR template if it has one.
- Report back: the PR number and URL, the covers made, credits spent, test results, open items.
