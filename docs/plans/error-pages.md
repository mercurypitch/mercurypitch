# Error pages: one scene for everything that went wrong

**Plan, 2026-10-19; statuses updated the same day, after phase 1.** Nothing
here is built unless marked **[shipped]**. It covers every moment a visitor
does not get what they came for:

- a wrong address;
- a crash;
- an expired or damaged link;
- a lost connection.

It covers the web app and its rooms, the native app, about.mercurypitch.com
and Beside Cue. Today these look different from each other, and some show
nothing at all. The plan gives all of them one scene, one voice and one next
step, built once and shared.

Status keys: **[shipped]**, **[in review]** (an open PR), **[next]** (ready to
build), **[open]** (needs the owner or a decision). File references are to
this repository unless they name disjoint-colliders.

---

## 0. The short version

1. **One scene, five states.** The scene is a night sky over the mercury sea,
   with a stave of light across the horizon. Each state changes the stave, not
   the layout:
   - not found: a note has drifted off the stave;
   - server error: the stave has cracked;
   - offline: the stave fades to one flat line;
   - link gone: the note is an empty ring;
   - crash: the stave stops mid-bar.

   It is CSS and inline SVG over the First Light plate the app already ships,
   so a static page needs no JavaScript.

2. **One kit, every MercuryPitch surface.** `src/error-kit/` renders the
   static pages (404, 500, offline) and the same scene as a Solid component
   inside the app. The about site takes a vendored copy (§5). The other
   landing sites get 404 pages of their own, in their own looks (§4.8, §4.9).
3. **The worst gaps first.**
   - about.mercurypitch.com answered an unknown address with an empty body, so
     the visitor saw a blank white page (§1). **[shipped]**
   - Once the service worker is installed, every unknown address gets the
     app's home screen with a 200, not the 404 page.
   - An unknown in-app route jumps to the current tab without a word.
4. **Direction: Off the stave.** The owner chose it from this plan, so Phase 0's
   mockups were skipped (§8, §9).

---

## 1. What happens today

Mapped on 2026-10-19.

| Situation                                                   | What the visitor gets                                                                                                                                | Status                | Gap                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| Unknown address, first visit                                | `404.html`: the entry prelude with "That page does not exist", room links and legal links. No brand lockup, no JS                                    | 404                   | Plain, but correct. **[shipped]** the scene, #1118          |
| Unknown address, service worker installed                   | The app shell, on Home. `servesShell` in `src/lib/sw-runtime.ts` serves it for any path but the standalone documents and `/api/`                     | 200 (from the worker) | Wrong page, no message, a soft 404                          |
| Unknown hash route (`#/foo`)                                | `parseHash` returns `unknown`, `applyRoute` ignores it, and the URL sync rewrites the hash to the active tab (`useHashRouter.ts`)                    | n/a                   | Silent                                                      |
| `/exercises/<bad-slug>`                                     | The shell, a toast "Exercise not found", the path reset to `/` (`App.tsx`)                                                                           | 200, noindex          | A toast for a whole page that failed                        |
| `/admin/<bad>`                                              | Home, with the bad path left in the address bar (`admin-entry-route.ts`)                                                                             | 200                   | Silent                                                      |
| `/mirror?v=<damaged>`                                       | The ordinary Mirror page (`og-voiceprint-meta.ts`, `MirrorApp.tsx`)                                                                                  | 200                   | Silent                                                      |
| The Worker throws on a page request                         | Cloudflare's default error page. The page branches of `src/worker.ts` have no try/catch                                                              | 500                   | Off-brand, no way back                                      |
| Offline with no cached shell                                | The browser's own offline page                                                                                                                       | n/a                   | No offline page                                             |
| App crash                                                   | `CrashModal`: "Application Error", the message and stack, Reload, Report, Reset                                                                      | n/a                   | Works, but reads like a debugger                            |
| Crash in a standalone room (Mirror, Glass, the four Nights) | Nothing. None of them installs the global error listeners or a boundary                                                                              | n/a                   | The room freezes without a word                             |
| A newer build is live                                       | `StaleBuildRecovery`                                                                                                                                 | n/a                   | Fine                                                        |
| Expired share link, missing playlist                        | Toasts (`App.tsx`, `KaraokeNightRuntime.tsx`)                                                                                                        | n/a                   | Fine for a partial failure, thin for a whole one            |
| Malformed sync code                                         | Home, silently (`room-code.ts` parses it to null)                                                                                                    | n/a                   | Silent                                                      |
| Unknown Jam room code                                       | The visitor becomes host of a new, empty room (`jam-room.ts`)                                                                                        | n/a                   | Possibly right; owner decision (§8)                         |
| Native app: unknown route                                   | The current tab, as on the web                                                                                                                       | n/a                   | Silent                                                      |
| Native app: nothing rendered                                | The red watchdog banner "Mercury Pitch did not start" (`apps/mercurypitch/index.html`)                                                               | n/a                   | Works, off-brand                                            |
| about.mercurypitch.com: unknown address                     | An empty body: a blank white page. Its worker hands the asset layer's miss straight back (disjoint-colliders, `packages/mercurypitch/src/worker.ts`) | 404                   | **No page at all**. **[shipped]** disjoint-colliders #170   |
| about.besidecue.com: unknown address                        | The same blank page (`packages/beside-cue/src/worker.ts`)                                                                                            | 404                   | **No page at all**. **[in review]** disjoint-colliders #177 |

The irchiinnuss landing in the same repository already solved its own case:
`src/pages/404.astro` ("This door isn't in the house"), served by a
`notFound()` step in its worker with status 404. The two sites above can
follow it.

---

## 2. The scene

### 2.1 Layers

1. **Sky.** CSS only: the night gradient, a field of stars from radial
   gradients, and the glow of the mercury horizon. It paints with no image
   bytes, so it works offline and in the other repository.
2. **Plate (optional).** The First Light mercury sea,
   `public/opening/first-light-wide.webp` (2560x1429, 173 KB) and `-tall`
   (1440x2580, 96 KB). `entry-prelude.css` and the app's opening already use
   it, so a returning visitor has it cached. Without it, the sky alone still
   looks finished.
3. **Stave.** Inline SVG, five lines of light across the horizon, under 3 KB
   per state. It is decoration and `aria-hidden`.
4. **Card.** The brand lockup, a small tag, the h1, one line, the actions and,
   on a not-found page, the rooms.

### 2.2 The states

| State        | Stave                                                                           | Tag (draft)     | H1 (draft)                    | Actions                                                           |
| ------------ | ------------------------------------------------------------------------------- | --------------- | ----------------------------- | ----------------------------------------------------------------- |
| not-found    | One note has drifted above the stave and glows, a dotted glide back to its line | `404 cents off` | Nothing plays at this address | Home, the rooms                                                   |
| server-error | The stave cracked like glass (the Glassworks motif)                             | `500`           | Something broke on our side   | Try again, Home                                                   |
| offline      | The lines fade into one flat line                                               | `No signal`     | You're offline                | Try again; the rooms this device has opened before                |
| link-gone    | The note is an empty ring                                                       | `Link expired`  | This link has run its course  | The room it pointed to, Home                                      |
| crash        | The stave stops mid-bar                                                         | none            | MercuryPitch stopped          | Reload, Copy details, Report, Reset (what `CrashModal` has today) |

- **The tag** is a joke for a pitch app: 404 cents is a major third and four
  cents, a wrong note. The page reads fine without getting it. The owner picks
  the tone (§8).
- **Motion.** The drifting note bobs on a slow loop and the glide shimmers.
  With `prefers-reduced-motion`, everything holds still. No state needs
  JavaScript to animate.
- **Voice.** One short line that says what happened without blaming the
  visitor, then the way on.

---

## 3. The kit **[shipped]** for not-found (#1118)

`src/error-kit/`, with no framework in the shared parts. It holds the
not-found state today; each other state is added with its page.

| File                         | What it holds                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error-states.ts`            | Each state's tag, h1, line and actions: the one place the words live                                                                                             |
| `src/styles/error-scene.css` | Sky, stave and card. Colours and type are custom properties, so the about site's copy can recolour it                                                            |
| `staves.ts`                  | The stave SVG for each state, as strings                                                                                                                         |
| `render-error-page.ts`       | A whole static document for a state, as `render-entry-page.ts` renders the entries. The build writes `404.html` from it; `500.html` and `offline.html` come next |
| `ErrorScene.tsx` **[next]**  | The same scene as a Solid component for the in-app states, on the same CSS                                                                                       |

Budget: CSS under 6 KB, each stave under 3 KB, no script on the static pages.
`scripts/assert-first-paint-budgets.mjs` gets an entry for each static page.

---

## 4. Where each state shows

### 4.1 Static pages, main app

- **[shipped]** `404.html` is generated from the kit (#1118). It stays
  `noindex, follow`, with no canonical, no module script and a link to every
  room. `launch-entry-seo.test.ts` pins its stylesheet to the kit's.
- **[next]** `500.html` and `offline.html` are new, `noindex`, and not in the
  sitemap.

### 4.2 The Worker, `src/worker.ts` **[open]**

- The page branches get one try/catch. A throw on a page request answers
  `500.html` with status 500 and `Cache-Control: no-store`, and is logged. The
  APIs keep their JSON errors.
- `/exercises/<slug>` and `/admin/<path>` keep serving the shell, because the
  app is what knows the valid slugs and sections. The app shows the state
  (§4.4).
- Update the comments that still describe the old SPA fallback: `worker.ts`
  above the unmatched-path branch, `App.tsx` at the exercise route,
  `sw-runtime.ts` at the top, and `wrangler.jsonc` at `not_found_handling`.

### 4.3 The service worker, `src/lib/sw-runtime.ts` **[open]**

- Serve the shell only for paths the app routes. That list already exists in
  two halves: the Worker's `run_worker_first` paths and the entry documents.
  Make it one module that both import. Any other path goes to the network,
  which answers with `404.html` and a 404.
- Offline, an unknown path gets the cached `404.html`, and anything else not
  cached gets `offline.html`. Precache both; together they are a few KB.

### 4.4 Inside the app **[open]**

- **Unknown hash route.** A hash that is not empty and does not match shows
  the not-found scene in the content area, and the hash stays in the address
  bar so it can be reported. An empty hash and `#/` still mean Home.
- **`/exercises/<bad-slug>`:** the link-gone scene, linking the exercise list,
  instead of a toast and a reset to `/`.
- **`/admin/<bad>`:** the not-found scene.
- **`/mirror?v=<damaged>`:** a link-gone notice above Mirror: the voiceprint
  link is damaged, and here is Mirror to make one.
- **A whole destination that failed** (an expired `#/s/<id>` share, a playlist
  not on this device, a missing Karaoke Night session) gets the link-gone
  scene. A partial failure keeps its toast.
- **Malformed sync code:** link-gone, saying what a code looks like.
- **Unknown Jam room code:** owner decision (§8).
- The scene moves focus to its h1 when it opens.

### 4.5 Crashes **[open]**

- `CrashModal` keeps every tool it has (Copy, View Logs, Report Bug, Reset App
  Data) but sits on the scene in the crash state, in plain words. The stack
  moves behind a "Details" disclosure.
- The standalone rooms (Mirror, Glass, Karaoke, Piano, Guitar and Drum Night)
  get the same global listeners and a boundary.
- `StaleBuildRecovery` keeps its behaviour and takes the scene's look.

### 4.6 The native app **[open]**

- The same in-app states as §4.4.
- The watchdog banner in `apps/mercurypitch/index.html` becomes the crash
  state as static HTML. It must not depend on the bundle that failed to start.

### 4.7 about.mercurypitch.com **[shipped]** (disjoint-colliders #170)

This is in disjoint-colliders, `packages/mercurypitch`.

- Add `src/pages/404.astro` with the kit's scene, from the vendored copy.
- Answer an unknown page with it, status 404, the way the irchiinnuss
  landing's `notFound()` does. Do not switch the asset layer to
  `not_found_handling: "404-page"`: a miss would then never reach the worker,
  and the contact form's routes live there.
- The sitemap already skips `/404` (`@irchiinnuss/astro-sitemap`).

### 4.8 Beside Cue

- **[in review]** The landing, about.besidecue.com, gets the same worker fix
  as §4.7 but its own page, not this scene in Beside Cue's colours: the owner
  asked for one scene for MercuryPitch and a page of its own for every other
  site. "There is no Side C.", over a pressing that turns in its run-out
  groove with SIDE C on the label (disjoint-colliders #177).
- **[open]** The app, `apps/beside-cue`, has a `load-error` screen; it becomes
  the crash or offline state. This is the last phase.

### 4.9 The other landing sites

All in disjoint-colliders, each with a 404 page in its own look:

| Site                                            | Page                                                                                                                        | Status                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| blog.irchiinnuss.com                            | Its terminal-style `404.astro` existed but was never served; `not_found_handling: "404-page"` now serves it (no API routes) | **[in review]** #176           |
| about.tokencircles.com                          | "This page is off the books.", the hero's orbit with one token knocked out of its ring; a worker `notFound()` step          | **[in review]** #179           |
| irchiinnuss.com, stats.maff.app, honda.maff.app | Already had their own 404 pages                                                                                             | **[shipped]** before this plan |

---

## 5. Sharing across repositories

- The kit's source of truth is this repository. The about site takes a
  vendored copy; the Beside Cue landing no longer does (§4.8):
  - the CSS;
  - the stave SVGs;
  - the state words, as JSON.

  Each file starts with a header naming its source. As shipped in #170, the
  copy is the CSS and the not-found stave, and the words are in the page.

- **[next]** `ERROR_KIT_VERSION` lives in `error-states.ts`. A test records a
  hash of the kit's files, so changing a file without bumping the version
  fails.
- Updating a vendored copy is a checklist step here, in the PR that bumps the
  version.
- Why not a package: two repositories, three consumers, a few KB. Publishing
  and versioning a package would cost more than copying files. Revisit if a
  fourth consumer appears.

---

## 6. Status codes and search

- An unknown address answers 404, never a 200 page that says "not found".
  Search engines call that a soft 404. This includes the service worker
  (§4.3).
- The 404, 500 and offline pages are `noindex, follow`, with no canonical, and
  are never in the sitemap.
- A 500 is `no-store`. A 503 for a dependency that is down carries
  `Retry-After`.
- A removed page that had traffic gets a 301 to the closest page, as
  `/tone-deaf-test` already goes to `/mirror`. Use 410 only for a page that is
  gone for good.
- In-app states need nothing: search engines do not index hash routes as
  separate pages.

---

## 7. Accessibility and performance

- One h1 per state. The stave is `aria-hidden`; the tag is text, never part of
  an image.
- Text contrast is checked over the brightest part of the plate, with a scrim
  as `entry-prelude.css` has.
- `prefers-reduced-motion` stops every animation.
- The static pages carry no JavaScript and get first-paint budgets (§3).
- The plate is a CSS background, so a slow connection shows the sky first and
  loses nothing.

---

## 8. Owner decisions

Decided on 2026-10-19: the direction is **Off the stave**, the drafted
playful copy stands ("404 cents off"), and every site but MercuryPitch gets a
404 page of its own (§4.8, §4.9). Questions 3 to 5 are still **[open]**.

1. **Direction.** Three to mock up in Phase 0:
   - **Off the stave** (recommended, §2): reuses art the app ships, is light,
     and works in every state.
   - **Empty stage:** a spotlight on an empty mic stand, from the night rooms.
     It needs a new, lighter plate; the rooms' heroes are 0.9 to 1.5 MB.
   - **Merc is lost:** the mascot on the mercury sea with a lantern, from the
     Merc stills in `src/features/lessons/lesson-01/assets/`.
2. **Tone.** Playful tags ("404 cents off") or plain ones ("Page not found").
3. **Unknown Jam room code.** Keep "you become the host of a new room", or say
   that no room has that code and offer to start one.
4. **Near-miss addresses.** Should `/karoke` suggest Karaoke Night? It needs a
   few lines of inline script, or a lookup in the Worker.
5. **Cloudflare's own error pages.** When the Worker itself cannot be reached,
   Cloudflare shows its own 5xx page. The dashboard can replace it with a
   custom page; check what the plan allows, and if it can, point it at
   `500.html`.

---

## 9. Phases

| Phase | What                                                                                                                          | Proof                                                                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Skipped: the owner picked Off the stave from the plan                                                                         | n/a                                                                                                                                                                      |
| 1     | **[shipped]** The kit; the static 404 (#1118); the about site's 404 (#170). The landings' own 404s are in review (§4.8, §4.9) | Renderer tests for each state; `launch-entry-seo.test.ts` updated; an about-site component test; `/no-such-page` answers 404 with the scene on both dev hosts            |
| 2     | The Worker's 500; the service worker's unknown paths and offline page                                                         | `worker-entry-routing.test.ts`: a throw answers `500.html`, no-store. Service worker tests: an unknown navigation reaches the network's 404; offline gets `offline.html` |
| 3     | In-app states: unknown hash, bad exercise slug, bad admin path, the link-gone cases                                           | `hash-router.test.ts` and component tests; the app-check skill in a real browser on a phone size                                                                         |
| 4     | Crashes: `CrashModal` on the scene, boundaries for the standalone rooms, the native watchdog                                  | Boundary tests per room; a test that the watchdog's page renders with no bundle loaded                                                                                   |
| 5     | Beside Cue's app                                                                                                              | Its own suite                                                                                                                                                            |

Phase 2 is next: the Worker's 500 page and the service worker's unknown paths
and offline page.
