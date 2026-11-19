# Brief: phone and tablet polish, round 2 (after #1469 and #1471)

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
W = /home/user/mercurypitch/.claude/worktrees/modes (your worktree)

You fix eight layout defects found while checking the sideways-phone work on 18 November. Each was
measured in a real browser; each fix is measured again after, at the sizes named, in both themes
where the defect is a colour.

## Setup
- In W: delete `dist/` and `test-results/` if present, then
  `git fetch origin main && git switch -c feat/phone-polish-2 origin/main` and
  `pnpm install --frozen-lockfile --offline`.
- Read the repo's AGENTS.md, docs/agent/CONVENTIONS.md, MISTAKES.md and TESTING.md first, and
  docs/agent/INDEX.md to find things.

## Rules
- Every heavy job (pnpm check, vitest over many files, a build, Playwright) through
  `$S/bin/heavy <command>`, ONE at a time: two `pnpm check` runs at once get OOM-killed (ESLint
  takes about 7 GB). Film renders share the machine.
- Never test against production (mercurypitch.com, api.mercurypitch.com,
  about.mercurypitch.com). Local builds only; the app-check skill's scripts help.
- Commit on your branch with the repo's own git identity (already configured): one commit per
  fix, in the repo's message style. No attribution lines, no emojis, no model names anywhere.
- Do not push, open a PR or merge: the lead does.
- Each fix gets a test that is red before it and green after (unit, or a browser spec where only
  a browser can show it). Every stylesheet condition for a phone on its side is
  `SHORT_TOUCH_LANDSCAPE_QUERY` (src/lib/use-viewport.ts) and is held to it in
  use-viewport.test.ts, as #1469 and #1471 did.
- `pnpm check` must end with 0 errors and the same warnings as main.

## The eight
1. **Upright phone (390x844): the mic notice covers the Singing tab's transport** (notice at
   8,679,382,780). The notice stack stands on `--toast-floor` (src/styles/Notifications.module.css),
   which counts `--page-dock-space`, which a page's docked transport publishes through
   `publishFootSpace` (src/lib/foot-space.ts; StudioTransport does it). The Singing phone stage's
   `TransportBar` (src/components/mobile/SingingMobileStage.tsx) publishes nothing. Make it publish
   its footprint on an upright phone only: on its side the stack stands at the foot's right end,
   beside the stage's left column (#1471), and must not lift. Check every other phone stage that
   uses TransportBar (Piano, Karaoke) for the same overlap.
2. **Light theme: the in-canvas "Your mic is off ..." banner on the Singing notes canvas is near
   invisible** (dark text on the canvas, which stays dark in light theme), desk 1440x900 and phone
   alike. Pre-existing. Make it readable at 4.5:1 or better in both themes.
3. **Tablet 1024x768: Karaoke's header row scrolls 180 px sideways** (the no-song view,
   `.panel-header`; #1471 folded it behind Options on phones). Make it fit at 1024x768 and
   1024x1366 and keep the desk at 1280 and 1440 as it is.
4. **Merc's coach tours pick a step by width** (src/features/tours/room-tour.ts, lines 167 to
   168, `isNarrow`), so at 844x390 "Show me more" has no target. Pick by the layout the screen
   shows, as #1471 did for the Guide's tours (`showsLayout`, the `narrow`/`wide` values where a
   target really switches by width).
5. **A 20 px light strip under a drill at 844x390 in light theme** (below the drill's stage).
   Find what shows through and close it.
6. **The jam room's phone wording names a menu button that does not exist at 641 to 768 px.** Make
   the words match what that width shows.
7. **Tall spotlights flagged WIDE at 844x390 and 932x430** by scripts/walk-tours.mjs (16 and 13
   steps). Read the walker's rule, decide per step whether the spotlight is wrong or the rule is,
   and fix the real ones; report the rest with a reason.
8. **Ear Lab on a phone on its side**: the bench's stations sit far below the art, and Hairline's
   "Your call" sits at the right edge. ONLY after #1467 (the Ear Lab wide window) is on main: the
   lead tells you when. Do 1 to 7 first.

## Prove
- A before/after table per fix with the measured boxes, as #1471's PR body has.
- Screenshots (your own look at each): `$S/polish2/shots/`.
- The walks: `pnpm run build:tours`, serve dist, then `scripts/walk-tours.mjs` at 1440x900,
  MOBILE=1 (390x844) and MOBILE=1 VIEWPORT=844x390: nothing unlit.
- Gates: pnpm check; `node scripts/gen-agent-index.mjs --check`; `node scripts/plan-cites.mjs
  check` (308 findings on main; move any citation your change shifts); `pnpm -s pr:validate`;
  `node scripts/code-metrics.mjs --check`; vitest related to the changed files; the browser specs
  you touched.

## Hand back
Per fix: what was wrong, the change (files), the test, the numbers before and after, the
screenshot. Then the gates' results, the commits (hash and title), anything you could not do and
why, and a draft PR body in `$S/polish2/pr-body.md` in #1471's shape (no attribution).
