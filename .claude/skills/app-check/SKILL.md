---
name: app-check
description: Drive the MercuryPitch web app in a real headless browser and check it the way maff would by hand. It sweeps every main screen at phone (390x844) and desktop (1440x900) in light and dark for sideways scroll, clipped text, overlapping layers, small tap targets, form-control fonts and keyboard focus, and it runs per-release checks of the visible changes, with a screenshot behind every verdict. Use it before a release, after a UI change, when walking a dev test checklist ("check the layouts", "test the new features", "is 0.9.x OK on a phone?"), or whenever you are about to ask maff to look at something a browser can measure. It leaves maff only taste, real devices and audio by ear.
---

# app-check: test the web app yourself, leave maff the taste calls

maff wants to spend testing time on taste and design, not on whether a
label is cut off. This skill is how an agent proves the rest: build the commit
under test, serve it locally, drive it with Playwright, measure, screenshot,
and write a pass/fail report with evidence paths.

It complements the existing skills and does not replace them:

- `tour-check` walks the guided tours (`pnpm run test:tours`);
- `mobile-ui-check` audits the exercise chrome (`pnpm run audit:mobile`);
- `jam-two-peer` drives two peers into a jam room;
- the Playwright suite in `src/e2e` is the regression gate. When app-check finds
  a bug, the fix PR adds a spec there (red before, green after); app-check is
  the walk, not the gate.

## Hard rules

1. Never test against production: mercurypitch.com, api.mercurypitch.com,
   about.mercurypitch.com. Local builds or dev.mercurypitch.com only.
   `lib.mjs` refuses a production base URL and aborts every production
   request; a report row `production-requests FAIL` means the build under test
   points at production. Stop and rebuild.
2. Never create accounts or sign in with real credentials. Signed-in states are
   simulated: a fake unsigned token (`fakeToken()`) plus an API answered from a
   table inside the browser (`stubApi()`), on a build whose API base is
   http://127.0.0.1:59999, where nothing listens. No request leaves the machine.
   Test values only (`app-check@example.test`), never real data.
3. Headless by default. `HEADED=1` launches with `--class=agent-browser` so
   Hyprland tucks the window away. Never reveal the workspace yourself.
4. Stop only what you started. The scripts spawn `serve` detached, kill its
   process group, escalate to SIGKILL and print whether the port is free. They
   refuse a port that already answers and skip 4398, 8780 and the other
   reserved ports in `RESERVED_PORTS`. Never `pkill` by name.
5. Wrap every long command in `timeout` (builds 900, a sweep 1800).
6. Never open or grep `.env*` files or anything holding secrets. Build-time
   values go on the command line (`VITE_API_BASE_URL=`), which beats the env
   files without reading them.
7. No emojis anywhere, including reports.

## 1. A checkout of the commit under test

Test the exact commit, in its own scratch worktree, so you never disturb
someone else's checkout:

```sh
S=<your scratch dir>/app-check            # never the scratchpad root
git fetch origin main
git worktree add --detach $S/mp origin/main      # or a tag, or a PR head
cd $S/mp
timeout 300 pnpm install --frozen-lockfile --offline
# Glassworks assets are Git LFS files; git-lfs lives in ~/.local/bin and the
# repo has no lfs filter configured, so pass the filter per command:
PATH=$HOME/.local/bin:$PATH timeout 300 git -c filter.lfs.smudge='git-lfs smudge -- %f' \
  -c filter.lfs.process='git-lfs filter-process' -c filter.lfs.clean='git-lfs clean -- %f' \
  -c filter.lfs.required=true lfs checkout apps/beside-cue/public/games
```

## 2. Two builds

Build into `dist`, then rename: `--outDir` breaks the PWA and Glassworks
plugins, which hard-code `dist`.

```sh
# dist-local: local mode, no API (the build:tours env). Most screens.
timeout 900 env VITE_API_BASE_URL= VITE_OVERRIDE_ONNX_MODEL= VITE_JAM_MOCK_SIGNALING=1 \
  VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= pnpm exec vite build && mv dist dist-local
# dist-stub: the dev build (cookie bar preview) with the API on a dead local
# port, answered by stubApi(). Cookie bar, confirm-email bar, launch gift.
timeout 900 env VITE_API_BASE_URL=http://127.0.0.1:59999 VITE_CONSENT_PREVIEW=true \
  VITE_OVERRIDE_ONNX_MODEL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
  pnpm exec vite build --mode development && mv dist dist-stub
```

Each build takes about 90 s here. Never test a plain `pnpm run build`: it
bakes in api.mercurypitch.com.

For an older version (no `VITE_CONSENT_PREVIEW`, before #1019), show the cookie
bar with a fake tag instead: `VITE_GOOGLE_ADS_TAG_ID=AW-000000000` in a
production-mode build. The tag script is blocked, the bar still opens.

## 3. Prove the probes fire

Run once per session, from the checkout (all scripts resolve Playwright and
`serve` from the current directory's node_modules):

```sh
timeout 120 node <skill>/scripts/selftest.mjs
```

It plants one defect per probe on a test page and expects each caught, then
expects silence on a clean page. Anything but `SELFTEST PASSED` means the
probes are not to be trusted today.

## 4. The sweep

```sh
timeout 1800 node <skill>/scripts/sweep.mjs --dist=dist-local --out=<out>/sweep
node <skill>/scripts/summarize.mjs <out>/sweep/report.json
```

Every screen in `SCREENS` (the tabs, the Settings sections, Karaoke, Guitar,
Drum and Piano Night, the Mirror) at phone and desktop, light and dark: 27
screens, 108 views, about 8 minutes. Per view:

| Check                   | Verdict                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| sideways-scroll         | FAIL when the page is wider than the layout viewport                                                                |
| clipped-text            | WARN per text cut by ellipsis, overflow or line clamp                                                               |
| overlap                 | WARN when two fixed or sticky layers intersect                                                                      |
| tap-targets (phone)     | WARN under 24 px (WCAG 2.5.8), INFO under 44 px (HIG). Measured by hit-testing, so a pseudo-element hit area counts |
| control-font            | WARN for a button, input or select in Arial or a UA default                                                         |
| focus-visible (desktop) | WARN for a Tab stop with no visible change                                                                          |
| errors                  | WARN for page errors and console errors (our own blocks excluded)                                                   |
| blocked-requests        | INFO: hosts the fence aborted                                                                                       |

`summarize.mjs` folds 100+ WARN rows into one line per distinct finding with
the screens it shows on. Read that, not the raw list.

Options: `--screens=home,community`, `--vps=phone`, `--themes=dark`,
`--base=https://dev.mercurypitch.com` (instead of `--dist`), `--tz=Europe/Zagreb`
and `--consent=denied` (cookie bar on or answered), `--returning=0` (first
visit), `--focus=0`, `--allow=<host>` (never a production host).

## 5. Release and feature checks

Copy `scripts/release-0.9.18.mjs` to `release-<version>.mjs` and replace its
cases with this release's visible changes. One case per claim in the
changelog, each at the viewports and themes where it matters, each with a
screenshot. Run it on the new build and on the previous release's build: every
case should FAIL on the old build and PASS on the new one. A case that passes
on both proves nothing about the change.

Recipes that already work (see the 0.9.18 file):

| Need                        | How                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard focus ring         | `keyboardFocus(page, loc)` (Shift+Tab, Tab, so `:focus-visible` matches), then `ringOf(loc)`                                           |
| Tap target                  | `hitBox(loc)`: the box taps actually land in                                                                                           |
| Text contrast               | `contrastOf(loc)`: WCAG ratio over the composited background; hover then measure again                                                 |
| Layers at the foot          | `rectOf` + `intersect` for overlap, `onTop` for "is it painted above" (handles `pointer-events: none` toasts)                          |
| A toast with no API         | storage `mp:gauthPending` = `{nonce, expiresAt}`, then load `/#gauth_error=access_denied&gauth_nonce=<nonce>`: "Google sign-in failed" |
| Cookie bar                  | dist-stub (or dev) with `timezoneId: 'Europe/Zagreb'`; `consent: 'denied'` to keep it out of a shot                                    |
| Unconfirmed account         | storage `mp:authToken` = `fakeToken()`, stub `GET /api/auth/me` with `authProvider: 'password'`, `emailVerified: false`                |
| Launch gift and offer       | stub `GET /api/billing/promo/featured` (body copied from dev's real answer)                                                            |
| A song card                 | `window.__pp.appStore.importUvrSessionDurable({...})` (needs `E2E_TEST_MODE`, which `openContext` sets)                                |
| Community lists             | storage `pp_shared_melodies`, `pp_shared_sessions`                                                                                     |
| First visit, onboarding Map | `returning: false`, load `/`, then `/#/map`                                                                                            |
| Theme                       | `openContext({ theme })` sets `pitchperfect_theme` and the color scheme                                                                |

The e2e specs in `src/e2e` are the best source of further recipes: grep them
for the surface before inventing a way in.

## 6. Dev

dev.mercurypitch.com builds from main. Before testing there, read what it
serves: the `runtime-config-*.js` chunk carries the version and the commit.

```sh
RC=$(curl -s https://dev.mercurypitch.com/ | grep -oE '/assets/runtime-config-[A-Za-z0-9_-]+\.js' | head -1)
curl -s https://dev.mercurypitch.com$RC | grep -oE 'const A="[0-9.]+"|C="[0-9a-f]{9}"'
```

The version only changes when the release commit lands; the commit tells you
what code is live. Use dev for what needs its real API, signed out and read
only (`--dev=https://dev.mercurypitch.com` in the release file, `--base=` in
the sweep). A visit may create an anonymous device user in the dev database;
that is dev's purpose. Local builds stay the default: they are reproducible and
cost nobody anything.

## 7. Read the results honestly

- FAIL on a release case is a finding. Re-run that case alone (`--only=<group>`)
  before reporting it; then report it with steps to reproduce and the shot.
- WARN means look. Most WARN rows are pre-existing; tell new from old by
  running the sweep on the previous release build and diffing the summaries.
- Look at the screenshots, but not in a long session: an image read stays in
  context and is re-billed on every later call. Hand the shot paths to a short
  sub-agent and keep its written description.
- A check that reports zero problems on a busy screen deserves suspicion: run
  the self-test, or plant the defect once and watch the check catch it.

## 8. The report

Write `<out>/report.txt` in plain text: what was built (commit, builds,
ports), the self-test result, each check with PASS/FAIL/WARN and its evidence
path, failures with steps to reproduce, then the human list below. Screenshots
and the JSON reports stay beside it in `~/agent-out/mercurypitch/<date>/`.

## 9. What still needs maff

- Taste: whether a layout, color, spacing or line of copy is right, not just
  unbroken. Send maff the few shots that carry a design decision.
- Real devices: iOS Safari and Android Chrome rendering, safe areas and
  notches, the soft keyboard over inputs, real touch scrolling, PWA install,
  the native app builds.
- Audio by ear: playback quality, latency, the separations, Glassworks sound.
- Real microphones: pitch detection on a voice, the onboarding voiceprint, the
  Mirror reading. A fake mic proves the plumbing, not the feel.
- Real accounts and mail: sign-up, Google sign-in, confirm mails in a real
  inbox, payments. Agents use stubs; the real flow is maff's.

## Traps learned building this (2026-10-15)

- `--outDir` breaks the build: the PWA and Glassworks plugins read `dist`.
- A fresh worktree has Git LFS pointer files and the build stops on them;
  git-lfs is in ~/.local/bin, not on PATH, and the repo has no lfs filter
  configured. Use the `git -c filter.lfs...` line above.
- A phone context with `isMobile` zooms out to fit an overflowing page, and
  `innerWidth` grows to match. Measure against
  `document.documentElement.clientWidth`, or sideways scroll never shows.
- `elementFromPoint` skips `pointer-events: none`, which the toasts use, so a
  toast always looks covered. `onTop` lends the element hit-testing first.
- Bounding boxes miss pseudo-element hit areas: #908's song menu draws 32x32
  and takes taps across 46x46. Measure by hit-testing.
- `route.abort()` shows up as `net::ERR_FAILED` console errors; those are our
  fence, not app bugs.
- The cookie bar opens only on a European clock and only in a build with a tag
  or the consent preview; `build:e2e`, `build:tours` and CI (UTC) never show it.
- `CONSENT_PREVIEW` needs `--mode development` as well as
  `VITE_CONSENT_PREVIEW=true`.
- `E2E_TEST_MODE` hides the ambient popups (What's new), but the per-page tour
  offer toast still appears and sits in phone shots.
- The RTK hook compacts `git show` and `git diff` output; for a real diff use
  `/usr/bin/git ... > file` and read the file.
- Never reuse a server you did not start: a port that answers may be another
  checkout's build (the e2e suite once reported 71 false failures that way).
- Re-run a red case alone before believing it; a loaded machine invents
  timeouts (Token Circles, MercuryPitch TESTING.md 3.8).
- A phone viewport without a phone user agent is half a phone: Settings >
  Display said "Detected: desktop" at 390 px. `VIEWPORTS.phone` now carries an
  Android Chrome user agent.
- The probes pass pages a person would flag. On 0.9.18 the sweep was clean
  while the visual pass found page text showing through the translucent phone
  tab bar, Settings tab strips cut at the edge with no scroll hint (a scroller,
  so not "clipped"), the tour toast covering Ear Lab's main button, and
  1.25:1 gold-on-white on Ear Lab in light. Always pair the sweep with a
  visual pass in a sub-agent, and measure what it reports before you repeat it.
- `contrastOf` composes ancestor backgrounds only. Text over a sibling image
  or a backdrop-filter card can be wrong either way; check the shot.
- The fence causes its own artifacts: the blocked peerpush badge shows as a
  broken image in Settings > Credits, and Karaoke Night's demo lyrics come from
  an r2.dev bucket. Name them as artifacts, not bugs.
- The #908 font fix moved control heights by up to 2 px (Arial to Inter).
  Size-based checks that compare builds will see that; it is not a regression.
- A rect check can pass a line the user never sees: the onboarding Map's offer
  line sits at y 1470 on an 844 px phone. Compare positions to the fold when
  "visible" matters.

## Cleanup

The scripts stop their own servers. When done: `git worktree remove --force
$S/mp` for each scratch worktree, and confirm with `ss -ltn` that none of your
ports still listens.
