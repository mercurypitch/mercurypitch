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
# It opens the cookie bar on a UTC clock too, so a walk on it presets
# consent: 'denied' or answers the bar (see the cookie bar trap below).
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
(the clock, UTC by default) and `--consent=denied` (answers the cookie bar; a
stub or dev build opens it on UTC too), `--returning=0` (first visit),
`--focus=0`, `--allow=<host>` (never a production host).

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
| Tap target                  | `hitBox(loc)`: the box taps actually land in; it reads at most 60 px either side, see below                                            |
| Text contrast               | `contrastOf(loc)`: WCAG ratio over the composited background; hover then measure again                                                 |
| Layers at the foot          | `rectOf` + `intersect` for overlap, `onTop` for "is it painted above" (handles `pointer-events: none` toasts)                          |
| A toast with no API         | storage `mp:gauthPending` = `{nonce, expiresAt}`, then load `/#gauth_error=access_denied&gauth_nonce=<nonce>`: "Google sign-in failed" |
| Cookie bar                  | dist-stub (or dev): opens on a UTC or European clock; `consent: 'denied'` keeps it out of a shot                                       |
| Unconfirmed account         | storage `mp:authToken` = `fakeToken()`, stub `GET /api/auth/me` with `authProvider: 'password'`, `emailVerified: false`                |
| Launch gift and offer       | stub `GET /api/billing/promo/featured` (body copied from dev's real answer)                                                            |
| A song card                 | `window.__pp.appStore.importUvrSessionDurable({...})` (needs `E2E_TEST_MODE`, which `openContext` sets)                                |
| Community lists             | storage `pp_shared_melodies`, `pp_shared_sessions`                                                                                     |
| First visit, onboarding Map | `returning: false`, load `/`, then `/#/map`                                                                                            |
| Theme                       | `openContext({ theme })` sets `pitchperfect_theme` and the color scheme                                                                |

`hitBox` looks 60 px either side of the centre unless told otherwise, so a hit
of 121 (2 x 60 + 1) means at least 121, not exactly 121. The result carries
`capped: [x, y]`, true for an axis where a side ran into that limit, and
`hitBox(loc, { maxReach: 200 })` looks further. Write a capped number as "at
least". The sweep's own tap-target probe stops at 40 px, so 81 in a sweep line
is a floor too.

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
  the native app builds. WebKit's engine can be walked here (see WebKit);
  Safari itself cannot.
- Audio by ear: playback quality, latency, the separations, Glassworks sound.
- Real microphones: pitch detection on a voice, the onboarding voiceprint, the
  Mirror reading. A fake mic proves the plumbing, not the feel.
- Real accounts and mail: sign-up, Google sign-in, confirm mails in a real
  inbox, payments. Agents use stubs; the real flow is maff's.

## WebKit

Use it when a check depends on WebKit's engine (iOS Safari's scroll padding,
sticky layers, viewport units) and Chromium cannot answer it.

**Playwright's WebKit does not start on this host.** Build 2359
(`~/.cache/ms-playwright/webkit-2359`) is linked against libraries this Arch
machine does not have: `libicu*.so.74` (Arch ships ICU 78), `libxml2.so.2` (it
ships `.so.16`), `libjxl.so.0.8` (it ships 0.12), six `libflite_cmu_*`
libraries (its flite ships others) and `libbacktrace.so.0`. `ldd` on
`minibrowser-gtk/bin/WebKitWebProcess` lists them, and `webkit.launch()` stops
with "Host system is missing dependencies" and an `apt` command that does not
apply here (checked 21 Oct 2026). Try `webkit.launch()` again after a
Playwright upgrade: a build that starts takes the same probes as Chromium and
replaces everything below.

**The system WebKitGTK starts.** `webkit2gtk-4.1` (2.54.1 on 21 Oct 2026, the
GTK 3 port) loads through PyGObject: `gi.require_version('WebKit2', '4.1')`. It
is WebKit's engine, not Safari on iOS: no touch, no safe-area inset, desktop
scrollbars, a device pixel ratio of 1 and a desktop Linux user agent. It
answers "does WebKit lay this out as Chromium does". An old Safari, or anything
iOS only, is CANNOT CHECK in the report and goes to maff's phone.

The 21 Oct 2026 walk of the onboarding questions (Plan 1A, PR 1.2) ran it this
way. Its script held that walk's own checks, so only the pattern is kept here:

- **A private display and bus**, so no window reaches maff's workspace. Choose
  the display number yourself (see the Xvfb trap below) and start only on a
  free one. List `/tmp/.X11-unix` before the run and again once Xvfb has
  exited: the two listings must be identical.

  ```sh
  N=91
  if [ -e /tmp/.X11-unix/X$N ] || [ -e /tmp/.X$N-lock ]; then echo "display :$N is in use"; exit 1; fi
  Xvfb :$N -screen 0 1600x1000x24 -nolisten tcp & XVFB=$!
  env -u WAYLAND_DISPLAY DISPLAY=:$N GDK_BACKEND=x11 NO_AT_BRIDGE=1 \
    timeout 1800 dbus-run-session -- python3 <walk>.py <dist> <out> <port>
  kill $XVFB                    # by PID, never pkill by name
  ```

  The gvfs, accessibility and `MESA-EGL` lines on stderr are noise.

- **The fence.** The context is `WebKit2.WebContext.new_ephemeral()` and its
  proxy is dead for every host but loopback:
  `ctx.get_website_data_manager().set_network_proxy_settings(WebKit2.NetworkProxyMode.CUSTOM, WebKit2.NetworkProxySettings.new('http://127.0.0.1:9', ['127.0.0.1', 'localhost']))`.
  Nothing listens on port 9, so a request to any other host, production or dev,
  fails at once. A `resource-load-started` handler lists every URI that is not
  the local build, and the report ends with that list. A page that fetched an
  `.invalid` host over http and over https had both blocked and both listed
  (checked 22 Oct 2026). This is blunter than `lib.mjs`'s fence: no dev host
  gets through, so a WebKit walk is a local build. Answer `permission-request`
  with `deny()`.
- **The build** on loopback from python's `http.server`
  (`ThreadingHTTPServer(('127.0.0.1', port), partial(SimpleHTTPRequestHandler, directory=dist))`
  in a thread). It has no clean URLs: ask for `/karaoke-night.html`, not
  `/karaoke-night`. Seed storage with a `WebKit2.UserScript` injected at
  document start (`E2E_TEST_MODE`, the theme, and `mp.consent.v1` as `denied`
  on a stub build), as `openContext` does.
- **Driving.** A `Gtk.Window` with `set_default_size(390, 844)` holds the
  `WebKit2.WebView`, and the page then reports 390x844. There is no asyncio:
  spin `GLib.MainContext.default().iteration(True)` until the callback fires.
  Script runs through
  `view.call_async_javascript_function(body, -1, GLib.Variant('a{sv}', {'arg': GLib.Variant('s', json.dumps(x))}), None, None, None, cb)`:
  `body` is an async function body (`await` and `return` work, `arg` is a
  variable) and `cb` reads
  `call_async_javascript_function_finish(res).to_json(0)`. Clicks are
  `el.click()` from script, which `onClick` handlers accept; there are no real
  pointer events. A screenshot is
  `view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE, None, cb)`
  then `view.get_snapshot_finish(res).write_to_png(path)`, after
  `gi.require_foreign('cairo')`. Xvfb has no GPU, so set
  `get_settings().set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.NEVER)`.
  To look like a phone, call `set_user_agent` on the same settings (not tried).
- **One browser at a time.** Never start WebKit beside a Chromium sweep or
  another agent's walk. The machine has no swap, and earlyoom has killed Claude
  sessions when several browsers ran at once (2 Oct 2026). Check `free -m`
  first and wait, with a deadline, while `available` is under 6000 MB:

  ```sh
  end=$((SECONDS+600)); until [ "$(free -m | awk '/^Mem:/{print $7}')" -ge 6000 ]; do
    [ $SECONDS -lt $end ] || { echo TIMEOUT; exit 1; }; sleep 15; done
  ```

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
- Hit-testing honors `border-radius`: a point 4 px in from the corner of a box
  with a 14.4 px radius (the cookie bar) lies outside the box, so a corner
  sample there sees what is behind it and calls a topmost bar covered. `onTop`
  reads each corner's radius and samples inside it; a hand-rolled corner probe
  must do the same.
- Bounding boxes miss pseudo-element hit areas: #908's song menu draws 32x32
  and takes taps across 46x46. Measure by hit-testing.
- `route.abort()` shows up as `net::ERR_FAILED` console errors; those are our
  fence, not app bugs.
- The cookie bar mounts only in a build with a Google tag or the consent
  preview (`isConsentActive()` in `src/lib/consent.ts`), so `build:e2e`,
  `build:tours`, a plain local build and CI never show it. Where it is mounted
  it opens for a clock in the EEA, the UK or Switzerland, for an unknown clock
  and for a placeless one such as UTC (`isRestrictedTimezone`, pinned in
  `src/lib/__tests__/consent.test.ts`). So the stub build opens it on
  `openContext`'s default UTC clock too, not only on `Europe/Zagreb`. Preset
  `consent: 'denied'` (it stores `mp.consent.v1`, which keeps the bar shut) or
  answer the bar before you measure the foot of a phone screen.
- `CONSENT_PREVIEW` needs `--mode development` as well as
  `VITE_CONSENT_PREVIEW=true`.
- Never let Xvfb choose its display. `Xvfb -displayfd` picked `:0` on 22 Oct
  2026, the desktop's own Xwayland display, and the run left
  `/tmp/.X11-unix/X0` missing, so new X11 apps could not connect to the desktop
  until that path was restored. A lock file did not stop it: `/tmp/.X0-lock`
  existed. Name a high number yourself and start only when
  `/tmp/.X11-unix/X<n>` and `/tmp/.X<n>-lock` are both absent.
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
