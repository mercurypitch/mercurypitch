# Television: casting, mirroring and Google TV, with effort and order of work

**Status:** proposed, 2026-10-21; the owner's decisions of the same day are in
section 9, and section 7 follows them. Updated 2026-10-22 after the first
device test (POC-1 confirmed on the LG C2), with 1.2 in review (PR #1175)
and POC-3, the stage on the TV, in review (PR #1179). Nothing here is built
unless marked
**[shipped]**. It continues [tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md),
which stays the record for the TV platforms, the issue #489 items and the
phone-as-microphone design. Requirements are in
[../specs/tv-karaoke.ears.md](../specs/tv-karaoke.ears.md) (`REQ-TV-*`).

Status keys as in the TV audit: **[shipped]**, **[next]** planned, **[open]**
needs a decision or hardware.

What this adds to the plans already in the repo:

1. Casting and mirroring, which no plan covers: AirPlay, Google Cast, Miracast,
   the Presentation and Remote Playback APIs, and a second screen from the
   iOS app.
2. A live iOS bug that breaks AirPlay mirroring today (section 2.1).
3. The Google Play TV quality items the plans do not list yet (section 2.2).
4. A cost for the phone-mic relay, computed from Cloudflare's pricing.
5. Effort in relative points per work item and per option, and one order of
   work across all of it.

---

## 0. The short version

- **Build on the existing TV plans, do not replace them.** They are accurate
  against the code (section 1). Their gap is casting and mirroring.
- **Do now (small):** fix the iOS scene bug that turns AirPlay mirroring into a
  second copy of the app, and make latency calibration per output route, so
  mirroring a phone to a TV scores correctly. That is the near-term "karaoke on
  the TV" for iPhone, Pixel and Samsung owners, with no TV app at all.
  **Progress, 2026-10-22:** the scene fix is merged (PR #1157) and confirmed
  on the owner's LG C2; per-route calibration is in review (PR #1175); the
  third proof of concept, the whole stage on the TV while the phone stays in
  portrait, is in review (POC-3, PR #1179, section 7).
- **Then the core:** one light **TV stage** surface plus the **phone as the
  microphone** (tv-apps-and-phone-mic.md section 4). Every later route
  reuses both: the TV browser, the Google TV app, an iOS second screen over
  AirPlay, and a Google Cast receiver.
- **Google TV through the existing Capacitor app**, on a dedicated Android TV
  release track, after four review blockers are fixed: auto-entering
  picture-in-picture, links that open a browser, playback keys on the D-pad,
  and memory on 1 GB TVs.
- **Later, by evidence:** an iOS second screen over AirPlay (Apple TV and
  AirPlay 2 TVs), then a Google Cast receiver (spike first).
- **Not recommended:** a separate native Android TV app. It doubles the
  codebase for a gain the Capacitor app gets most of.

---

## 1. What already exists, and how good it is

Searched: `docs/` (plans, specs, agent docs), `todo.md`, `CHANGELOG.md`,
`dev-changelog.md`, the code, the 42 remote branches, open issues and PRs.
Scores are 1 (poor) to 5 (strong).

| Record                                                                 | Coverage | Soundness | Feasibility | Verdict                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | -------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [tv-and-low-tier-devices.md](tv-and-low-tier-devices.md) (audit)       | 4        | 5         | 5           | Keep. The TV browser layer: device tier, frame caps, `color-mix()` fallbacks, file-picker detection. Mostly **[shipped]** with tests. Native apps and casting are out of its scope by design.                                                    |
| [tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md) (plan)            | 4        | 4         | 4           | Keep as the base. Its claims hold against the code (checked below). Gaps: no casting or mirroring; Play TV items beyond the manifest; effort only per phase; one inconsistency (a hash-route deep link for the phone mic cannot be an App Link). |
| [tv-qr-handoff.md](tv-qr-handoff.md)                                   | 2        | 4         | 5           | History. The pairing shipped by another route (PR #501); its open items already live in tv-apps-and-phone-mic.md section 2.                                                                                                                      |
| [search-and-answer-engines.md](search-and-answer-engines.md) section 7 | 3        | 4         | 5           | Keep. Newest TV distribution checklist (2026-10-19). One refinement: a bundle with no native code meets the 64-bit and 16 KB rule automatically (section 2.2).                                                                                   |
| Issue #489                                                             | 3        | 4         | n/a         | The live checklist, refreshed 2026-09-29. Gains the items in section 11.                                                                                                                                                                         |
| Branch `claude/mercurypitch-tv-audit-mmr6cm`                           | n/a      | n/a       | n/a         | Stale: the pre-squash copy of PR #485, whose content is on `main`. Nothing to salvage.                                                                                                                                                           |

Claims in tv-apps-and-phone-mic.md checked against `main` at `02682a1`:

- Jam sends pitch frames at about 20 Hz with a clarity gate of 0.2
  (`src/stores/jam-store.ts`, `MIN_SUNG_CLARITY`, the `pitchNetworkInterval`
  loop). True.
- The jam Durable Object relays signalling only: `create-room`, `join-room`,
  `offer`, `answer`, `ice-candidate`, `set-background`, `leave-room`
  (`workers/jam-worker/src/jam-room.ts`). True; a `pitch` message would be new.
- The Android manifest has no `LEANBACK_LAUNCHER`, no banner and no
  `touchscreen required="false"`; the microphone is already optional
  (`apps/mercurypitch/android/app/src/main/AndroidManifest.xml`). True.
- The native sign-in sheet has no TV row
  (`apps/mercurypitch/src/shell/settings/SignInSheet.tsx`). True.
- Latency offsets are kept per input device (`src/stores/mic-latency-store.ts`,
  keyed by the resolved device id). True, and it matters for casting: the
  offset also depends on the output route (section 2.6).
- "Android's WebView switches on Chromium's own spatial navigation". Partly:
  WebView enabled the spatial-navigation flag for D-pad input, and Chromium
  tracks an Android TV WebView focus-trap bug. Plan an explicit focus manager
  on the stage, not only the engine's.

What could not be read: the native plan of record lives in the owner's
dotfiles (`native-v1-1-implementation-plan-2026-09-10.md`, cited by
`docs/plans/mobile-native/capacitor-readiness.md`). Decisions there may
override parts of this plan.

---

## 2. What this pass found

### 2.1 AirPlay mirroring from the iOS app starts a second app **[shipped]**

**Confirmed and fixed, 2026-10-22.** On the owner's LG C2 (webOS), a build
before the fix showed a second copy of the app on the TV, stuck on the Rooms
start screen, while the song's sound played on the TV. TestFlight mp-v0.8.40
(main with PR #1157) mirrors the phone in portrait and landscape: the pitch
lane draws, the frame rate holds, and picture-in-picture lyrics work. The
analysis below is kept as the record of why.

Capacitor's 8.5 iOS template returns `SceneDelegate` for every scene role, and
`SceneDelegate` builds a new bridge for every window scene. When iOS connects
an external display (AirPlay screen mirroring, or a cable), it asks for a scene
with the external-display role even though multiple scenes are off. The app
then starts a second, independent web app on the TV instead of mirroring:
it sits on the start page, shares storage with the first, and initialises
every plugin twice. Reported upstream as ionic-team/capacitor#8648 (open,
filed 2026-10-08). The same report notes that `@capacitor/screen-orientation`
8.0.2 holds the bridge strongly, so a disconnected display's web view keeps
running.

This app has exactly that code:

- `apps/mercurypitch/ios/App/App/AppDelegate.swift`,
  `configurationForConnecting`: sets `delegateClass = SceneDelegate.self` for
  any `connectingSceneSession.role`.
- `apps/mercurypitch/ios/App/App/SceneDelegate.swift`: creates a `UIWindow`
  and a new `ViewController()` (the app's bridge, which registers
  `LyricsWindowPlugin` and `AudioOutputPlugin`) for every scene.
- `@capacitor/screen-orientation` `^8.0.2` is a dependency.

So the cheapest route to "karaoke on the TV" for iPhone owners, mirroring, is
very likely broken in the iOS build until the role guard lands: the code
matches the reported pattern line for line, though it has not been reproduced
on a device here. The fix is a few lines: give `SceneDelegate` only to
`.windowApplication` (`REQ-TV-090`). Reproduce first in the Simulator (I/O,
External Displays): a second `Loading app at capacitor://localhost` in the
console confirms it.

### 2.2 Google Play TV items the plans do not list **[next]**

From the TV app quality page (updated 2026-06-29) and the distribution docs.
Section 7 of search-and-answer-engines.md already covers the launcher
intent, banner, `leanback` and `touchscreen` entries, TV screenshots and the
64-bit date.

| Play test      | Rule                                                                                     | This app today                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TV-IE          | No automatic picture-in-picture unless in a call; entry is an explicit user action       | **Fails.** `PictureInPicturePlugin.java` sets `setAutoEnterEnabled(true)` while a song plays, and below API 31 `MainActivity.onUserLeaveHint` enters by hand                                                            |
| TV-IC          | PiP declares a permitted usage type, title and subtitle                                  | Not set                                                                                                                                                                                                                 |
| TV-WB          | Web content only in a WebView; never launch a browser app                                | **Fails.** Native settings and sign-in use `target="_blank"` for terms, privacy and about (`SignInSheet.tsx`, `AccountOffer.tsx`, `SettingsList.tsx`); `openExternal` calls `window.open` (`src/lib/platform/index.ts`) |
| TV-PC          | During playback, D-pad centre pauses and resumes; left and right rewind and fast-forward | Not handled; arrows are free for focus on a TV since #890                                                                                                                                                               |
| TV-PP          | Play/pause media keys toggle playback                                                    | Likely via the media-session plugin; verify on TV                                                                                                                                                                       |
| TV-NP, TV-PA   | Audio that continues after Home shows system media controls that lead to a pause screen  | The media-session plugin runs a foreground service with a notification; verify the TV card                                                                                                                              |
| TV-BY, TV-BA   | Do not block Ambient Mode when nothing plays                                             | `keepAwake` is a single switch (`packages/mobile-runtime/src/platform.ts`); confirm it is released on pause and stop                                                                                                    |
| TV-DB          | Back from the root returns to the TV home                                                | Passes by design: the root's Back minimises (`apps/mercurypitch/src/infrastructure/native-shell.ts`); verify                                                                                                            |
| TV-PS          | `minSdkVersion` 31 or lower                                                              | Passes: 29                                                                                                                                                                                                              |
| TV-ME          | On 1 GB low-RAM devices, total app memory stays within 280 MB                            | Unknown. Fully decoded stems can exceed it alone; the TV must take the streaming path (section 2.7)                                                                                                                     |
| TV-G6          | From 1 Aug 2026, 32- and 64-bit and 16 KB pages                                          | Met automatically without native code. The plugin set is Java and Kotlin, so likely no `.so`; assert it in CI                                                                                                           |
| TV-G4, TV-G5   | A real TV screenshot; reviewer credentials when sign-in is needed                        | To do with the listing                                                                                                                                                                                                  |
| TV-CT (tier 2) | If the phone app supports Cast, the TV app should integrate Cast Connect                 | Becomes relevant only with phase P6                                                                                                                                                                                     |

Two process rules matter as much as the tests:

- **A TV rejection can hold the phone app.** Updates to a listing publish only
  when every change is approved. Play's tracks (internal, closed and open
  testing, production) normally carry one release to phones, tablets and TVs
  together. Opting in to Android TV offers a **dedicated Android TV release
  track**: TV copies of each track (`tv:production` and so on in the API) that
  only TVs receive, so a phone release never waits on a TV review. It is
  optional, recommended, and permanent once chosen. The cost is one more
  upload or promotion per release; the listing, package, ratings and
  purchases stay one app. Use it.
- **The 64-bit rule is about native code.** The TV checklist states it for
  every TV app, but the developer blog scopes the work to apps that include
  native code, and the page size guide checks only shared libraries: a bundle
  with none meets both automatically. Updates that
  do not support 16 KB pages are refused for every form factor from
  1 February 2027.

The target API floor for TV (34) is well below this app's 36.

### 2.3 The casting landscape, in one place

| Route                                        | What crosses to the TV                     | Senders                                                                           | Receivers                                                                                                                      | Fit for this app                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AirPlay screen mirroring                     | The phone's encoded screen and sound       | iPhone, iPad, Mac                                                                 | Apple TV; AirPlay 2 TVs (Samsung, LG, Sony, Vizio from 2018)                                                                   | Near-term. Works with any app. With `playAndRecord`, only mirrored AirPlay carries sound unless `.allowAirPlay` is set; this app's session omits it, which suits mirroring |
| iOS external display (second screen)         | A different screen drawn by the app        | The iOS app                                                                       | Same as above, or a cable                                                                                                      | Strong for iPhone owners: TV shows the stage, the phone stays mic and controller. Needs the 2.1 fix first, then a deliberate second web view                               |
| Android "Cast screen"                        | The phone's screen and sound               | Pixel and near-stock Android                                                      | Google Cast devices only (Google TV, Chromecast built-in)                                                                      | Near-term, but third parties report the highest mirroring lag of the three                                                                                                 |
| Miracast (Samsung Smart View and others)     | The phone's screen and sound, Wi-Fi Direct | Samsung and many other Android phones, Windows; not Pixel since Android 6         | Many Samsung, LG, Roku, Fire TV sets                                                                                           | Near-term for Samsung owners. No app work beyond calibration                                                                                                               |
| Google Cast, Custom Web Receiver             | Commands and data; the TV runs a web app   | Chrome (desktop, Android) via the Web Sender SDK; Android and iOS via native SDKs | Google TV devices, Chromecast, Cast built-in TVs, LG from webOS 24 (Chromecast added; custom receivers to verify); not Samsung | The best Cast-device experience: tap Cast, the TV runs the stage. Needs a receiver, three senders, registration and publishing                                             |
| Cast Connect                                 | A launch into an installed Android TV app  | Cast senders                                                                      | Android TV apps that register their package                                                                                    | Only with the Google TV app (P4); then the Cast button opens the real app                                                                                                  |
| Remote Playback API / Default Media Receiver | One media URL; the TV fetches it           | Safari (AirPlay), Chrome Android (Cast)                                           | Same                                                                                                                           | **Rejected.** The song is a Web Audio mix of local stems; no lyrics, lane or score crosses                                                                                 |
| W3C Presentation API                         | A page on the remote display               | Chrome only                                                                       | Chromecast loads a `cast:` page but does not implement the receiver API                                                        | **Rejected.** No message channel to a Chromecast; the Cast SDK covers the same ground                                                                                      |
| Cast Remote Display, Android `Presentation`  | A second Android display                   | Android                                                                           | Cast remote display is deprecated; `Presentation` needs a secondary display                                                    | **Rejected.** No reach worth the native work                                                                                                                               |

Mirroring latency is not a fixed figure: capture, encode, transport, decode
and display each add delay. Third-party measurements put Chromecast screen
mirroring at 300-600 ms, AirPlay at 100-200 ms and Miracast at 20-100 ms.
Treat these as indicative only; phase P0 measures them on the devices in the
house.

### 2.4 What mirroring does to scoring, and why calibration fixes it

During mirroring the TV plays the backing track `L` ms after the phone renders
it. The singer follows the TV, so the voice reaches the phone's microphone `L`
late against the phone's song clock. The Mic Latency wizard
(`src/features/mic-feedback/MicLatencyWizard.tsx`) measures the full round
trip from a scheduled click to its captured onset, through whatever output is
active. Run while mirroring, it measures `L` plus the TV's own output delay.
That is exactly the offset scoring needs.

Two limits remain:

- **The live trail lags.** The singer's pitch is drawn on the phone and then
  mirrored, so on the TV it trails the playhead by about `L`. Lyrics stay in
  step with the sound, because picture and sound share the mirror stream (an
  assumption to verify in P0). Acceptable at AirPlay or Miracast lag; poor at
  Chromecast lag.
- **Jitter.** One offset only works if `L` is steady. The wizard already
  reports a spread (`REQ-ML-007`); above a threshold, sing with lyrics only and
  say why (`REQ-TV-093`).

### 2.5 The phone-mic relay costs next to nothing

Cloudflare bills incoming WebSocket messages to a Durable Object at 20 to 1,
outgoing messages are free, and an object is billed for duration while it
is active and cannot hibernate. Requests are $0.15 per million beyond the
included million. The pricing page's worked example bills $12.50 for a
rounded-up million GB-s beyond the included 400,000 GB-s.

One singer for a 3.5-minute song at 20 frames per second:

- 4,200 incoming messages, billed as 210 requests;
- 210 s of a 128 MB object: 26.25 GB-s, never hibernating while frames flow.

Ten thousand such songs a month come to about 2.1 million billed requests
(about $0.15 to $0.30 beyond the allowance) and 262,500 GB-s (inside the
included 400,000). Jam rooms share both allowances. Cloudflare recommends
batching high-frequency messages every 50-100 ms; three frames a message
cuts requests by three with no audible cost. The account is on Workers Paid
($5 a month, confirmed by the owner on 2026-10-21), and the jam worker's
Durable Object already uses the key-value backend, which exists only on that
plan. A community report about raw message counting concerns the Free plan.

### 2.6 Calibration must be per output route **[in review, PR #1175]**

`mic-latency-store` keys offsets by the input device. The same phone mic sees
about 0 ms of extra delay on its speaker, more on Bluetooth, and `L` during
AirPlay or Cast mirroring. Key the offset by input and output route. The
output route is already read by the `AudioOutput` plugin
(`packages/mobile-runtime/src/audio-output.ts`); its `ROUTES` table needs
AirPlay, HDMI and the Android remote or cast routes added.

As built in PR #1175: AirPlay and HDMI are route kinds of their own; both
plugins send a route-only `audioRouteChange` event that costs nothing
between changes; `src/stores/audio-route-store.ts` follows the route from
launch; Bluetooth, AirPlay and HDMI keep their own offsets per input under
new keys (`route:device`), and borrow the input's offset with no spread
until measured. The phone's own outputs and the web keep the old keys, so
no migration was needed. The wizard and the Microphone screen say which
number is in use and offer to measure for the route. Casting is not an
audio route on either phone, so cast routes wait for the Cast sender (P6).
The 0.8.40 device test is why: a wizard run while mirroring replaced the
speaker's number.

### 2.7 Memory on a 1 GB TV **[next]**

Google allows Android TV 14 sets with 1 GB of RAM (1080p) when they declare
themselves low-RAM, and holds a foreground app on such a set to 280 MB in
total. Four stereo stems decoded to Float32 for a 3.5-minute song are about
300 MB on their own. So on a TV:

- stream stems (`canStreamStems()`, `src/features/stem-mixer/stem-stream-source.ts`),
  which needs WebCodecs' `AudioDecoder` (Chromium 94+). An updated WebView
  has it; TV browsers frozen at Chromium 79-90 do not;
- where streaming is impossible, the decode guard refuses with a sentence
  (`REQ-TV-033`), never an out-of-memory kill;
- the native shell passes real RAM and the low-RAM flag through the existing
  seam (`setNativeDeviceMemoryGb`, `src/lib/audio-memory-budget.ts`).

### 2.8 The phone-mic link must be a path, not a hash **[next]**

tv-apps-and-phone-mic.md section 4.2 proposes `/#/mic:CODE`, opened "in the
native app (an app link)". App Links and universal links match the path, so a
hash route cannot open the app (search-and-answer-engines.md section 6.2
says the same of `#/link:` and `#/sync:`). Use `/mic/CODE`, answered by the web
too, and claim `/mic/*`, `/link/*` and `/sync/*` in one `assetlinks.json` and
AASA change.

---

## 3. The options

| Id         | Option                                                 | One line                                                                                                                                       |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **M**      | Mirroring done right                                   | No TV app. Fix 2.1, calibrate per route, add a big-screen layout and a help page. The phone mirrors over AirPlay, Cast screen or Smart View    |
| **W**      | TV browser plus phone as the mic                       | tv-apps-and-phone-mic.md phases 1-2: the TV opens the site, shows the stage and a QR; the phone becomes the mic                                |
| **G**      | Google TV / Android TV through Capacitor               | The same AAB, opted in to TV on a dedicated track, with a TV shell and the quality fixes in 2.2. Mic: USB on the TV, or the phone (W's pieces) |
| **N**      | Native Android TV app                                  | Kotlin and Compose for TV, with a native audio engine, lyrics, lane and scoring                                                                |
| **S**      | iOS second screen over AirPlay                         | The iOS app draws the stage in a second, plugin-free web view on the external display; the phone keeps controls and mic                        |
| **C**      | Google Cast receiver                                   | The stage as a Custom Web Receiver; senders in Chrome, Android and iOS; Cast Connect into G when it is installed                               |
| (rejected) | Remote Playback, Presentation API, Cast Remote Display | See 2.3                                                                                                                                        |

---

## 4. Tradeoffs

### 4.1 Summary

Effort is in points (section 6), including each option's prerequisites, with
the range from its confidence. UX is scored 1-5 on five axes: stage quality,
live-trail lag, setup friction, phone freedom and robustness.

| Option | Effort (points)                      | UX  | UX notes                                                                                           | Maintenance                                                      | Platform reach                                                                                                                        | Store exposure                                  |
| ------ | ------------------------------------ | --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **M**  | 16 (13-19), high conf.               | 2.6 | Phone layout on a big screen unless the landscape layout is chosen; phone tied up; lag by protocol | Low                                                              | Widest: any TV the phone can mirror to. iPhone to AirPlay; Pixel to Cast devices; Samsung to Miracast TVs; laptops by Chrome Cast tab | None beyond a normal iOS update                 |
| **W**  | 61 (49-85), medium                   | 3.6 | Real TV layout; phone free; setup is "open the TV browser, scan"; browser engines vary             | Medium: frozen TV engines                                        | Any TV with a capable browser (Chromium 79+; streaming needs 94+)                                                                     | None                                            |
| **G**  | 87 (70-122), medium; +26 on top of W | 4.2 | Installed app with a launcher tile, remote and media keys; USB mic or phone                        | Medium: one codebase, a TV shell, a TV review per TV release     | Google TV and Android TV sets and boxes; Fire OS later with the same build                                                            | Play TV review, isolated by the dedicated track |
| **N**  | about 132 (92-264), low              | 4.4 | Best possible feel and audio path                                                                  | High: a second codebase, feature parity drift for ever           | Same as G                                                                                                                             | Play TV review                                  |
| **S**  | 28 (22-39), medium                   | 3.8 | TV layout from Control Center mirroring; phone is the controller; AirPlay lag on the trail         | Medium: native iOS scene code and a second web entry             | Apple TV and AirPlay 2 TVs, iPhone and iPad senders                                                                                   | Normal App Review                               |
| **C**  | 47 (33-94), low                      | 4.2 | One tap on Cast; the TV plays and scores locally; fragile on guest or isolated Wi-Fi               | Medium-high: a hosted receiver, three sender SDKs, device spread | Google TV devices, Chromecast, Cast built-in TVs (Sony, TCL, Hisense, Philips Google TV), LG from webOS 24 (to verify); not Samsung   | Cast receiver publishing, plus both app stores  |

UX axes behind the scores:

| Option | Stage | Lag | Setup | Phone freedom | Robustness |
| ------ | ----- | --- | ----- | ------------- | ---------- |
| M      | 2     | 2   | 4     | 1             | 4          |
| W      | 4     | 4   | 2     | 5             | 3          |
| G      | 5     | 4   | 3     | 5             | 4          |
| N      | 5     | 5   | 3     | 5             | 4          |
| S      | 4     | 3   | 4     | 4             | 4          |
| C      | 4     | 4   | 5     | 5             | 3          |

### 4.2 Reach: which TV works with which route

"Phone mic" means the TV gets the voice from a phone, the only microphone that
works on every TV (tv-apps-and-phone-mic.md section 1).

| Big screen                                             | M (iPhone)              | M (Pixel)                        | M (Samsung phone) | W (TV browser)                               | G (Google TV app) | S (iOS 2nd screen) | C (Cast receiver)   |
| ------------------------------------------------------ | ----------------------- | -------------------------------- | ----------------- | -------------------------------------------- | ----------------- | ------------------ | ------------------- |
| Apple TV                                               | yes                     | no                               | no                | no browser                                   | no                | yes                | no                  |
| Samsung TV (Tizen)                                     | yes, AirPlay 2          | no                               | yes, Smart View   | browser, untested                            | no                | yes                | no                  |
| LG TV (webOS)                                          | yes, AirPlay 2          | webOS 24: yes (Chromecast added) | yes, Miracast     | browser, to test (P0)                        | no                | yes                | webOS 24: to verify |
| Google TV / Android TV (Sony, TCL, Philips OLED9xx...) | yes on Sony (AirPlay 2) | yes                              | depends on set    | with a browser app (Philips audited 2026-08) | yes               | Sony only          | yes                 |
| Google TV Streamer, Chromecast with Google TV          | no                      | yes                              | no                | with a browser app                           | yes               | no                 | yes                 |
| Fire TV                                                | no                      | no                               | yes, Miracast     | Silk, untested                               | Fire OS later     | no                 | no                  |

### 4.3 Latency and scoring

| Route                       | Who plays the song | Who scores   | What corrects timing                                      | Live trail on the TV                   |
| --------------------------- | ------------------ | ------------ | --------------------------------------------------------- | -------------------------------------- |
| M, S (AirPlay, Cast screen) | The phone          | The phone    | Per-route offset from the wizard (2.4, 2.6)               | About `L` behind the playhead          |
| W, G with phone mic         | The TV             | The TV       | Clock offset by ping and pong, plus TV output calibration | Network delay only (relay: tens of ms) |
| G with USB mic              | The TV             | The TV       | Per-device offset, as today                               | Local                                  |
| C                           | The receiver       | The receiver | As W, over the Cast channel on the LAN                    | LAN delay only                         |

### 4.4 Why not a native Android TV app

- It rebuilds the audio engine (stem mix, tempo and key change), lyrics, the
  pitch lane, pitch detection and scoring in Kotlin, then keeps two scoring
  paths equal for ever. The audit's section 2.5 still holds: a native port that
  kept the same visual design would stutter the same way; the tier work is the
  fix, and the WebView already inherits it.
- The Capacitor route already gives a launcher tile, the remote, media keys,
  a USB microphone, Play billing and Cast Connect (an Android TV receiver is
  any TV app with the library and an intent filter).
- Revisit only if P0 or P4 shows the WebView cannot hold 30 Hz and clean audio
  on the target sets after the tier caps.

### 4.5 What each option leaves out

- **M** cannot free the phone, and Chromecast-lag mirroring is lyrics-only.
- **W** needs a TV browser; Google TV ships none by default.
- **G** reaches no Samsung or LG set.
- **S** reaches no Google TV box except Sony sets with AirPlay.
- **C** reaches no Samsung set, LG only from webOS 24, and fails where the Wi-Fi isolates
  clients; W's internet relay does not.

The combination **M now, W + G next, then S and C** covers every row of the
reach table.

---

## 5. One architecture under every option

Build two things once, and give each route a thin adapter.

```
 phone (app or browser)                          big screen
 +----------------------------+   frames    +-------------------------------+
 | mic -> pitch engine        | ----------> | PitchSource (remote)          |
 |   -> PitchFrame batches    |   commands  | TV stage, host mode:          |
 | controls -> StageCommand   | ----------> |   plays, scores, draws        |
 | lyric line, level <------- | <---------- |   state at a few Hz           |
 +----------------------------+   state     +-------------------------------+

 transports: DO WebSocket relay (W, G) | WebRTC data channel (later, W, G)
             Cast custom channel (C)   | native in-process bridge (S)

 S is the one route where the phone plays and scores: the stage runs in view
 mode and draws snapshots the phone sends.
```

- **TV stage** (`REQ-TV-020..027`): a light entry, separate from the main app,
  that draws lyrics, the reference lane, singer trails and the score from a
  model. **Host mode** owns playback and scoring (W, G, C). **View mode**
  draws snapshots (S). One entry serves the TV browser, the Google TV app's
  stage, the Cast receiver and the iOS second screen. No Capacitor plugins in
  it, so it is safe as a second web view and small on a 1 GB set.
- **Remote pitch protocol** (`REQ-TV-050..069`): frames, never audio. Each
  frame carries a session id, a sequence number, the phone's capture time,
  frequency, cents, clarity, MIDI and the room beat when known. Ping and pong
  give the clock offset. The existing jam frame shape is the starting point.
- **Pitch-source seam** (tv-apps-and-phone-mic.md section 4.5): each singing
  surface reads either MicManager's local capture or remote frames. Karaoke and
  the Sing room first.

---

## 6. Effort

Points are relative size, not time. They compare options and let the owner
schedule; the team's own pace turns them into dates. External gates (Play TV
review, Cast receiver publishing, App Review) are outside the team's control
and not in the points.

| Points | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| 1      | One file or a config change; unit-testable; no device needed                |
| 2      | One subsystem; unit tests plus one device check                             |
| 3      | Two subsystems, or one native file; needs a real device                     |
| 5      | A new module, protocol or single-platform native plugin; a device matrix    |
| 8      | A cross-device feature, a new UI surface, or native work on two platforms   |
| 13     | Reserved for a new app surface with outside review; spike before committing |

Confidence ranges on totals: high is -20% to +20%, medium -20% to +40%, low
-30% to +100%.

### 6.1 Per work item

| Id  | Work item                                                                                                                                                                               | Pts | Conf. | Requirements            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- | ----------------------- |
| 0.1 | TV browser on the LG and the Philips: engine version, D-pad, USB mic, storage quota (tv-apps-and-phone-mic.md 5.1, 5.4)                                                                 | 1   | H     | -                       |
| 0.2 | Jam as a phone-mic prototype in the TV browser (5.2)                                                                                                                                    | 1   | H     | -                       |
| 0.3 | Debug APK on the Philips Google TV: remote, USB mic, WebView version, `AudioDecoder` present (5.3)                                                                                      | 2   | H     | -                       |
| 0.4 | Mirroring matrix: iPhone to Apple TV or an AirPlay TV, Pixel to Google TV, Samsung phone to Samsung TV, Chrome Cast tab. Sound on the TV? Wizard median and spread; trail lag by eye    | 2   | H     | 092, 093                |
| 0.5 | Reproduce #8648 in the Simulator and on a device                                                                                                                                        | 1   | H     | 090                     |
| 0.6 | Memory of a streamed song on a 1 GB TV (`dumpsys meminfo`)                                                                                                                              | 2   | M     | 040                     |
| 1.1 | iOS scene role guard, pinned by a test like `android-main-activity.test.ts`                                                                                                             | 1   | H     | 090, 091                |
| 1.2 | Offsets keyed by input and output route (built without a migration: the old keys stay the phone's own); AirPlay and HDMI routes on both platforms; the screens name the route. PR #1175 | 5   | M     | 092, 095                |
| 1.3 | Prompt to calibrate on a new route; spread guard falls back to lyrics only                                                                                                              | 3   | M     | 093                     |
| 1.4 | Landscape big-screen sing layout under mirroring; native external-display detection; manual toggle on the web                                                                           | 3   | M     | 094                     |
| 1.5 | Help: "Sing on your TV today"; the karaoke page FAQ                                                                                                                                     | 1   | H     | -                       |
| 2.1 | Back keys (Escape, Android Back, webOS 461, Tizen 10009): close before navigating                                                                                                       | 2   | H     | 013                     |
| 2.2 | Focus manager for the stage, the library and dialogs, independent of engine spatial navigation                                                                                          | 5   | M     | 010, 016, 017           |
| 2.3 | The mixer's stylesheet as `.css?inline` (tv-apps-and-phone-mic.md 3.2)                                                                                                                  | 3   | M     | -                       |
| 2.4 | Background art capped by tier; Guitar Night glow off on low                                                                                                                             | 2   | H     | -                       |
| 2.5 | Handoff remainder: action on the TV notice, room-sized QR, Receive by default                                                                                                           | 3   | H     | 024, 025, 030, 031      |
| 2.6 | TV stage entry, host and view modes, overscan-safe, legible at 3 m                                                                                                                      | 8   | M     | 020-027                 |
| 2.7 | Overview waveform cache, only if 0.1 or 0.3 shows the stutter (conditional)                                                                                                             | 5   | L     | -                       |
| 3.1 | Pitch-source seam in Karaoke and the Sing room                                                                                                                                          | 5   | M     | 058                     |
| 3.2 | Frame protocol, a batched `pitch` message on the jam Durable Object, roles                                                                                                              | 5   | M     | 050-052, 064            |
| 3.3 | Pairing: `/mic/CODE` path and hash fallback, QR on the TV, `assetlinks.json` and AASA, `appUrlOpen` routing                                                                             | 5   | M     | 006, 053-055, 067, 069  |
| 3.4 | Phone mic screen: level, mute, lyric line, keep-awake, connection                                                                                                                       | 3   | H     | 062, 063                |
| 3.5 | Clock offset and TV output calibration, stored per TV and route                                                                                                                         | 5   | M     | 056, 057, 068           |
| 3.6 | Bleed gate: clarity, then optional reference rejection                                                                                                                                  | 3   | M     | 061                     |
| 3.7 | Two-device end-to-end test for mic mode on the jam-two-peer harness                                                                                                                     | 3   | M     | 059, 060, 065           |
| 4.1 | Manifest and assets: launcher intent, xhdpi banner with the name, `uses-feature` set to not required                                                                                    | 2   | H     | 070, 071                |
| 4.2 | TV detection plugin: TV UI mode or leanback, low-RAM flag, real RAM into `setNativeDeviceMemoryGb`                                                                                      | 3   | H     | 001, 002, 041           |
| 4.3 | Quality fixes: no auto PiP on TV, no browser launches, D-pad playback keys, keep-awake only while playing, media controls                                                               | 5   | M     | 014, 015, 073-076       |
| 4.4 | Native shell on the D-pad, landscape TV layout, phone sign-in row, sync shown                                                                                                           | 8   | M     | 032, 077, 078, 082, 083 |
| 4.5 | Streaming stems on TV; refusal past the budget; 280 MB measured                                                                                                                         | 3   | M     | 033, 040                |
| 4.6 | Paywall operable by D-pad, or the web paywall on TV                                                                                                                                     | 3   | L     | 084                     |
| 4.7 | Listing and track: TV screenshots and banner, dedicated TV track, reviewer access, CI check for native libraries                                                                        | 2   | H     | 079-081                 |
| 5.1 | External-display scene with a plugin-free web view loading the stage                                                                                                                    | 5   | M     | 100                     |
| 5.2 | Native bridge from the main web view to the stage (snapshots and commands)                                                                                                              | 5   | M     | 101                     |
| 5.3 | Connect and disconnect, release on disconnect, overscan; a missing or failed stage page leaves the TV mirroring                                                                         | 2   | M     | 102, 104                |
| 5.4 | Verify the audio route on device; reuse per-route offsets; the picture offset until then                                                                                                | 2   | M     | 103, 105                |
| 6.0 | Spike: the stage as a Custom Web Receiver on a Google TV Streamer, an older Chromecast with Google TV and a Cast built-in TV: Web Audio, memory, WebSocket, WebRTC                      | 5   | L     | -                       |
| 6.1 | Receiver: Cast framework wrapper, namespace, song delivery, idle and teardown, registration, publishing                                                                                 | 8   | L     | 110, 111, 115-117       |
| 6.2 | Web sender in Chrome                                                                                                                                                                    | 3   | M     | 112                     |
| 6.3 | Android sender plugin with a custom channel                                                                                                                                             | 5   | M     | 112                     |
| 6.4 | iOS sender plugin with a custom channel and the local-network keys                                                                                                                      | 5   | M     | 112, 113                |
| 6.5 | Cast Connect in the Google TV app                                                                                                                                                       | 5   | L     | 114                     |
| 6.6 | Cast design checklist pass                                                                                                                                                              | 3   | M     | -                       |

### 6.2 Per phase and per option

| Phase                               | Points              |
| ----------------------------------- | ------------------- |
| P0 Device checks                    | 9                   |
| P1 Mirroring done right             | 13                  |
| P2 TV stage and browser foundations | 23 (+5 conditional) |
| P3 Phone as the mic                 | 29                  |
| P4 Google TV app                    | 26                  |
| P5 iOS second screen                | 14                  |
| P6 Google Cast                      | 34                  |
| **All of P0-P6**                    | **148 (+5)**        |

| Option          | Made of                                   | Points | Marginal on top of earlier phases |
| --------------- | ----------------------------------------- | ------ | --------------------------------- |
| M               | 0.4, 0.5, P1                              | 16     | -                                 |
| W               | P0, P2, P3                                | 61     | -                                 |
| G               | P0, P2 without 2.7, P3, P4                | 87     | 26 (P4) after W                   |
| G, USB mic only | P0, P2 without 2.7, P4                    | 58     | -                                 |
| S               | 1.1, 1.2, 2.6, P5                         | 28     | 14 (P5) after M and the stage     |
| C               | 2.6, 3.2, P6                              | 47     | 34 (P6) after W; 6.5 also needs G |
| N               | a native rewrite, P0, and P3's phone side | ~132   | not recommended                   |

N's estimate, for comparison only: shell and library 13, audio engine 21,
lyrics and lane 13, pitch detection 8, scoring parity harness 13, accounts and
sync 13, payments 8, phone-mic client 5, TV quality 5 (99 in all), plus P0 (9)
and the phone side of P3 (24: all of P3 but the web pitch-source seam).

---

## 7. Order of work

Each phase is one or more `feat/*` PRs against `main`. Exit criteria are what
"done" means; the requirement ids say what is verified. Tracks marked
parallel do not depend on each other.

**Owner decision, 2026-10-21: iOS first.** The owner's own TVs, an LG C2
(2022, webOS 22) and a Samsung on Tizen, are AirPlay 2 sets; the Philips
Android TVs in other houses are the only ones the iOS route misses. So the
order is P0, P1, P5 (proofs of concept first, below), then P2 and P3, P4,
and P6. P5's production stage still needs 2.6, which moves up with it.

### Proofs of concept, iOS first

| POC                           | What the owner tries                                                                                                                                      | Change                                                                                                                                                                                                                        | State                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POC-1, mirroring that mirrors | iPhone to the LG and the Samsung by Screen Mirroring: the TV shows the phone, not a second copy; where the sound goes; the latency wizard while mirroring | The role guard (1.1) and its test, and a MISTAKES.md entry                                                                                                                                                                    | Merged in PR #1157 (main 6f6208a). **Confirmed on the LG C2, 2026-10-22** (mp-v0.8.40): the TV mirrors the phone in portrait and landscape, the pitch lane draws, the frame rate holds, PiP lyrics work. The MISTAKES.md entry is drafted and waits to be appended (section 11)                                                   |
| POC-2, lyrics on the TV       | Mirroring on, the TV shows the karaoke lyrics full screen, in the iOS lyrics window's design, while the phone stays the room                              | An external-display scene that draws `LyricsWindowRenderer` at TV size, fed by the lyrics and clock the page already sends the iOS lyrics window; the room also sends lyrics while a TV shows them; a Developer-screen switch | Merged in PR #1157 (main 474986c, 9e72b0d, 50685e8, 3c59c62), green on all CI checks. In mp-v0.8.40; the Developer switch's device test is not reported yet ([tv-device-tests.md](tv-device-tests.md), Test 4). Known limits: the words move only with "Keep playing in the background" on; the switch exists in dev builds alone |
| POC-3, the full stage         | Phone in portrait as the room and the mic; the TV in landscape shows the pitch lane, the lyrics and the score                                             | A stage page of its own in a plain web view on the external-display scene, fed by messages from the room (slices of 2.6, 5.1, 5.2)                                                                                            | In review, PR #1179 (branch `feat/tv-stage-poc`); as built below, "POC-3 in detail". Device test pending ([tv-device-tests.md](tv-device-tests.md), Test 6). Answers the owner's "lock this mode while mirroring" ask (2026-10-22)                                                                                                |

Delivery: CI compiles the iOS code and builds a debug APK on every pull
request. Neither a pull request nor a push to main uploads to TestFlight:
the iPhone gets a build from an `mp-v*` tag (annotated, on main by
convention; the owner pushes it, and the last is mp-v0.8.40 of 2026-10-22)
or from Xcode. A tag push builds a dev
binary, which carries the Developer screen and so the TV switch; a store
binary (a production dispatch on a tag) carries neither. What to try is in
[tv-device-tests.md](tv-device-tests.md), Tests 4 to 6.

#### Owner ask, 2026-10-22: phone in portrait, TV in landscape

Plain mirroring copies the phone's screen, so the TV shows whatever shape
the phone has: portrait letterboxed, or landscape full screen. No app can
make a mirrored picture landscape while the phone stays portrait, and a
landscape lock while mirroring would turn the phone too. The way to get
both is for the app to draw its own picture on the TV's external-display
scene, which iOS then shows in place of the mirror, in the TV's own
landscape, whatever the phone does. POC-2 does that for the lyrics; POC-3
does it for the whole stage.

#### POC-3 in detail: the stage on the TV, the room on the phone

What the owner tries: mirroring on, the Developer TV switch on "Stage"; the
phone stays in portrait as the room and the microphone; the TV shows the
pitch lane, the lyrics and the score in landscape, in step with the TV's
sound; switch off or stop mirroring and the TV mirrors again.

| Step | Change                                                                                                                                                                                                                                                                                                                                              | Pts | Conf. | Requirements  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- | ------------- |
| 3a   | A stage entry in `apps/mercurypitch` (`stage.html`), view mode only: pitch lane, lyric lines, score, at 1920x1080 with overscan margins, no Capacitor plugins. The lane's drawing comes out of `useStemMixerCanvasController.ts` behind a data seam (notes, pitch frames, position), so the stage draws what the room draws without its audio graph | 5   | M     | 020, 021, 027 |
| 3b   | The snapshot protocol: a versioned TypeScript type; the song's static part (notes, lyrics, duration) once per song, then position with a timestamp, the latest pitch frames and the score at about 20 to 30 a second; the stage interpolates position on its own clock and draws at the display's rate                                              | 3   | M     | 101           |
| 3c   | `TVStage.swift`, next to `TVLyrics.swift` and on the same scene notifications: a window with a plain `WKWebView` (no Capacitor bridge) on the external-display scene, loading the bundled stage. Snapshots arrive through a plugin method and go to the stage with `callAsyncJavaScript`. The Developer switch becomes Mirror, Lyrics or Stage      | 3   | M     | 100, 102      |
| 3d   | The Karaoke room publishes snapshots while the TV shows the stage, and stops when it does not                                                                                                                                                                                                                                                       | 2   | M     | 101           |
| 3e   | Device test on the LG C2 and the Samsung: smoothness, the phone's warmth over a whole song, sound still on the TV, the lane in step with the TV's sound, disconnect leaves one web view                                                                                                                                                             | 1   | H     | 103           |
|      | **POC-3 total**                                                                                                                                                                                                                                                                                                                                     | 14  | M-L   |               |

Of these, 3a is a slice of 2.6 and 3b to 3d are slices of 5.1 and 5.2, so
POC-3 is P5's first half done early, not extra work; P5 then adds the
production lifecycle and polish.

**As built, PR #1179 (2026-10-22).** Where it differs from the proposal:

- 3a: the stage draws with a small canvas renderer of its own
  (`src/lib/tv-stage/renderer.ts`), not a slice cut out of
  `useStemMixerCanvasController.ts`. A library module cannot import a
  feature, and the stage page must load nothing of the app; the renderer
  restates the lane's colours and folds notes to pitch classes as the
  phone's lane does during a song. A 5% overscan margin, type sized from the
  screen's height. The page is `apps/mercurypitch/stage.html`, in test
  builds only.
- 3b: as proposed. Version 1 of the protocol has three messages: `song`
  (title, length, notes, lyrics), `frame` (position read at a wall-clock
  time, playing, rate, the singer's readings since the last frame, the
  score) at 20 a second, and `idle` (`src/lib/tv-stage/protocol.ts`). The
  stage runs the position on by the wall clock between frames.
- 3c: the stage is served through the bridge's own scheme handler, which
  answers the first "to verify" item below. The Developer screen has two
  switches, "Lyrics on a connected TV" and "Stage on a connected TV", and
  each turns the other off, rather than one three-way control. Where the
  bundle has no stage page (a store build) or the page does not load, the
  TV mirrors.
- 3d: the notes come from the song's stored pitch analysis, moved into the
  key being heard; notes edited in Pitch Studio are not on the TV yet. The
  singer's readings come from `src/stores/live-mic-store.ts`, moved back by
  the measured round trip as scoring does. Because the TV's own delay is
  unknown until 3e, the Developer screen can move the picture earlier or
  later in 50 ms steps (`src/stores/tv-stage-store.ts`).
- 3e: not yet. [tv-device-tests.md](tv-device-tests.md), Test 6.

To verify, not assume:

1. A plain `WKWebView` loading ES module scripts from `file://` is
   unreliable, so the stage is served by a small `WKURLSchemeHandler` over
   the bundle's public folder, or built as one inlined HTML file. Decided in
   3c: the bridge's own scheme handler serves it (PR #1179).
2. The sound stays on AirPlay when the app puts its own window on the
   external-display scene. POC-2's device test answers this before 3c.
3. AirPlay keeps the TV's picture and sound in step, so the stage needs no
   delay of its own; the phone's screen runs ahead of the TV by the AirPlay
   delay, which is fine for a phone the singer is not watching. Scoring is
   corrected by the per-route offset (section 2.6, PR #1175).
4. A second web content process costs memory on the phone; measure it in 3e.

### P0 Device checks (9) **[next]**

Steps: 0.1-0.6. Record results in tv-apps-and-phone-mic.md section 5 and in
the table in section 2.3 here. The owner's devices: an LG C2 (2022, shipped
with webOS 22 and its Chromium 87 browser; LG has since offered webOS 23 and
24, and 24 adds Chromecast), a Samsung on Tizen, and Philips Android TVs.

Exit: for each mirroring route, the median and spread of the wizard's
latency, whether sound reaches the TV, and a yes or no on scoring; the
WebView version and `AudioDecoder` on the Google TV; peak memory of a
streamed song on a 1 GB set; #8648 reproduced or ruled out (done: reproduced
on the LG C2 before the fix and gone with mp-v0.8.40, 2026-10-22).

### P1 Mirroring done right (13) **[in progress]**, parallel with P0

1. The iOS role guard (1.1). **Done**: merged in PR #1157, confirmed on the
   LG C2 with mp-v0.8.40 (2026-10-22).
2. Per-route offsets (1.2): **in review, PR #1175** (branch
   `feat/latency-per-output-route`). Bluetooth, AirPlay and HDMI keep their
   own offsets per input; until measured, a route borrows the input's offset
   and claims no spread; a route-only plugin event keeps the route current
   without the volume polling; the wizard and the Microphone screen say
   which number is in use. Then the route prompt with the spread guard
   (1.3), whose tolerance the P0 latency spreads decide.
3. The landscape layout under mirroring (1.4) and the help page (1.5), which
   says what P0 found works.

Exit: `REQ-TV-090..095` pass; on an AirPlay TV a song scores within the same
tolerance as on the phone's speaker once calibrated; at Chromecast-like
spread the app offers lyrics only and says why.

### P2 TV stage and browser foundations (23) **[next]**

1. Back keys and the focus manager (2.1, 2.2).
2. The mixer stylesheet and tier-capped art (2.3, 2.4).
3. The TV stage entry in both modes (2.6). Keep it free of Capacitor plugins,
   and give any new dependency its own chunk (MISTAKES.md on `manualChunks`).
4. The handoff remainder (2.5). The waveform cache (2.7) only if P0 asks.

Exit: `REQ-TV-010..013`, `016..027`, `030..031`; the app-check skill passes the stage at
1920x1080 with the D-pad only; every tour step on touched pages still resolves.

### P3 Phone as the mic (29) **[next]**

1. The pitch-source seam (3.1), then the protocol and relay (3.2).
2. Pairing by path link and QR (3.3), the phone screen (3.4).
3. Clock offset and TV calibration (3.5), the bleed gate (3.6).
4. The two-device test (3.7).

Exit: `REQ-TV-050..065`, `067..069` (`066` once decision 6 is made); a TV
browser scores a phone-sung song within the
tolerance of a local mic after calibration; frames lost for a second show
"phone mic paused", not wrong notes. Then the "karaoke on your TV" page
(search-and-answer-engines.md section 7.3) can go live.

### P4 Google TV app (26) **[next]**; 4.1-4.3 can run parallel with P2-P3

1. Manifest, detection plugin and quality fixes (4.1-4.3).
2. The native shell on the D-pad (4.4), memory (4.5), paywall (4.6).
3. Listing and dedicated track (4.7). Opt in to Android TV only after P3, so
   the listing can promise the phone mic.

Exit: `REQ-TV-001..002`, `014..015`, `032..033`, `040..041`, `070..084`;
the app passes the Tier 3 checklist on the Philips and on a 1 GB emulator; a
TV review cannot hold a phone release.

### P5 iOS second screen (14) **[open]**, needs P1 and 2.6

POC-3 (PR #1179) built a first slice of 5.1 and 5.2 behind a test build's
switch; P5 makes it the product.

1. External-display scene and bridge (5.1, 5.2).
2. Lifecycle and audio route (5.3, 5.4).

Exit: `REQ-TV-100..105`; with mirroring on, the TV shows the stage while the
phone shows its controls; disconnecting leaves one web view.

### P6 Google Cast (34) **[open]**, gated by the 6.0 spike

1. Spike (6.0). Stop here if the stage cannot hold its frame cap or its memory
   on the older Chromecast with Google TV.
2. Receiver (6.1), then senders (6.2-6.4), then Cast Connect into G (6.5) and
   the checklist (6.6).

Exit: `REQ-TV-110..117`; from Chrome, the Android app and the iOS app, one tap
starts the stage on a Cast device, and the Google TV app opens instead when it
is installed.

### P7 Other TV stores

LG, Samsung and Fire OS stay as tv-apps-and-phone-mic.md section 6, phase 4.
Not re-estimated here.

---

## 8. Risks

| Risk                                             | Effect                                 | Mitigation                                                                     |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------ |
| A TV review rejection                            | Holds phone releases on a shared track | Dedicated Android TV track (4.7)                                               |
| 1 GB TVs                                         | Low-memory kills mid-song              | Streaming stems, a plugin-free stage, measured budgets (2.7, 4.5)              |
| WebView focus traps                              | Remote stuck on a row                  | Own focus manager on stage and dialogs; a D-pad-only Playwright walk (2.2)     |
| The TV's sound in the phone's mic                | False pitch in the singer's silences   | Clarity gate 0.2, then reference rejection; coach "hold the phone close" (3.6) |
| Mirroring jitter                                 | Unscorable                             | Spread guard and lyrics-only mode (1.3)                                        |
| An upstream Capacitor fix for #8648              | Merge conflict on upgrade              | Pin the role guard with a test; re-check on each Capacitor bump                |
| Community Cast plugins expose media loading only | No custom channel                      | Own small sender plugins (6.3, 6.4)                                            |
| Guest or isolated Wi-Fi                          | No Cast or AirPlay discovery           | W's internet relay still works; say so in help                                 |

---

## 9. Decisions for the owner

1. **Order:** decided 2026-10-21, iOS first: P5 before P3, P4 and P6
   (section 7).
2. **Cast receiver songs:** cloud-library songs only at first, or peer to peer
   from the phone too? Cloud-only is simpler, but this app's pitch is private
   karaoke separated on the device.
3. **Picture-in-picture:** decided 2026-10-21, keep it. Phones go on entering
   it by themselves while a song plays; on a TV it opens only when the user
   asks, with its usage metadata (TV-IE, TV-IC; `REQ-TV-074`).
4. **Dedicated TV track:** explained 2026-10-21; decide at P4. Recommended,
   and the choice is permanent.
5. **Path links:** move `#/link:` and `#/sync:` to path forms in the same
   change as `/mic/`?
6. **Singers per TV:** jam allows twelve lanes; is that the TV's cap too?
7. **The stage as its own entry:** recommended (memory, no plugins, one
   surface for four routes).

---

## 10. Assumptions

Flagged so they are checked, not trusted.

1. Updated Android System WebView on target Google TV devices is Chromium 94
   or newer. Checked in P0 (0.3).
2. AirPlay mirroring carries the app's sound to the TV in step with picture
   under `playAndRecord`. Apple documents mirrored AirPlay as supported for
   that category; verify in P0 (0.4).
3. Android "Cast screen" carries the app's sound. Verify in P0.
4. Mirroring lag is steady enough for one offset per route. Third-party
   figures are indicative only.
5. Custom Web Receivers on current Google TV hardware support Web Audio and
   WebSocket. Some older Cast devices lack `AudioContext.outputLatency`, and
   newer audio-only Cast devices lack the Web Audio APIs. WebRTC on receivers
   is unknown. Spike 6.0.
6. The account is on Workers Paid: confirmed by the owner, 2026-10-21.
7. The Android bundle contains no native libraries. Verify with `unzip -l` on
   the AAB in CI (4.7).
8. A current lyric line of at least 32 CSS px at 1080p is legible from 3 m.
   A proposal to confirm on hardware.
9. Credential Manager on TV covers saved passwords and passkeys; Google
   sign-in on a TV is not assumed. Phone sign-in (`#/link:`) is the TV route.
10. The private native plan of record may override parts of this plan.

---

## 11. Records to update

- **Issue #489**, new items:
  - iOS: AirPlay mirroring starts a second app (#8648), the role guard.
  - Play TV: no auto PiP on TV (TV-IE), no browser launches (TV-WB), D-pad
    playback keys (TV-PC), 280 MB on low-RAM sets (TV-ME), dedicated track.
  - Latency offsets per output route.
  - Phone-mic link as a path (`/mic/CODE`).
- **tv-apps-and-phone-mic.md:** section 4.2's link becomes `/mic/CODE`; section 4.3's
  cost question is answered by section 2.5 here; section 6 points here for
  phases P1, P5 and P6.
- **search-and-answer-engines.md section 7.1:** note that the 64-bit and
  16 KB line is met automatically by a bundle without native code, and that
  CI should prove the bundle has none.
- **docs/agent/MISTAKES.md**, once 1.1 lands: the Capacitor 8.5 scene template
  and external displays. 1.1 is merged and device-confirmed (2026-10-22). The
  entry is drafted and waits to be appended (the file is too large for the
  tooling that wrote this plan to rewrite safely).
- **Beside Cue** has the same template bug:
  `apps/beside-cue/ios/App/App/AppDelegate.swift` gives `SceneDelegate` to
  every role and `SceneDelegate` has no role guard. Port the 1.1 fix and its
  test when the owner says so.
- **docs/agent/DEVICE-DEBUGGING.md:** a TestFlight Subscribe asks for the
  Apple Account password every time (sandbox purchases do not take Face ID),
  and a password manager's AutoFill can fail in that system prompt; a known
  iOS limit, reproducible in the App Store app, not this app's bug. Added
  with this plan.

---

## Provenance

- Repository `mercurypitch/mercurypitch`, branch `main` at `02682a1`
  (2026-10-21). Branch `claude/mercurypitch-tv-audit-mmr6cm` inspected:
  stale. Updated against `main` at `1308fd2` (2026-10-22), with PR #1157
  merged and PR #1175 (`feat/latency-per-output-route`) open, and again at
  `f86e4ba` with PR #1179 (`feat/tv-stage-poc`) open.
- Device test, 2026-10-22: the owner's iPhone with TestFlight mp-v0.8.40 and
  an LG C2 over AirPlay screen mirroring.
- Plans and specs read: `docs/plans/tv-and-low-tier-devices.md`,
  `tv-apps-and-phone-mic.md`, `tv-qr-handoff.md`,
  `search-and-answer-engines.md`, `device-sync.md` (TV section),
  `mobile-native/README.md`, `mobile-native/capacitor-readiness.md`,
  `docs/specs/device-sync-transfers.ears.md`, `docs/specs/mic-latency.ears.md`,
  `docs/agent/DOCS-AUDIT.md`, `AGENTS.md`, `CLAUDE.md`.
- Code read: `apps/mercurypitch/android/` (manifest, `variables.gradle`,
  `build.gradle`, `MainActivity.java`, `PictureInPicturePlugin.java`,
  `AudioOutputPlugin.java`), `apps/mercurypitch/ios/App/App/`
  (`AppDelegate.swift`, `SceneDelegate.swift`, `ViewController.swift`,
  `Info.plist`),
  `apps/mercurypitch/capacitor.config.ts`, `apps/mercurypitch/package.json`,
  `apps/mercurypitch/src/infrastructure/native-shell.ts`,
  `packages/mobile-runtime/src/audio-output.ts`, `platform.ts`,
  `packages/ios-audio-session/Sources/AudioSessionKit/AudioSession.swift`,
  `src/lib/device-tier.ts`, `src/lib/platform/index.ts`,
  `src/lib/audio-memory-budget.ts`, `src/stores/jam-store.ts`,
  `src/stores/mic-latency-store.ts`,
  `src/features/stem-mixer/stream-switches.ts`,
  `workers/jam-worker/src/jam-room.ts`,
  `.github/workflows/mercurypitch-mobile.yml`, `capacitor-app.yml`.
- Code read for the 2026-10-22 update:
  `apps/mercurypitch/ios/App/App/LyricsWindow/TVLyrics.swift`,
  `apps/mercurypitch/ios/App/App/AudioOutputPlugin.swift`,
  `src/features/mic-feedback/MicLatencyWizard.tsx`,
  `apps/mercurypitch/src/shell/settings/MicrophoneScreen.tsx`,
  `src/features/stem-mixer/useStemMixerMicController.ts`,
  `src/features/karaoke-room/KaraokeRoomStage.tsx`,
  `apps/beside-cue/ios/App/App/AppDelegate.swift`.
- GitHub: issue #489; PRs #485, #488, #501, #890, #1108, #1157, #1175, #1179.

## Sources

Checked on 2026-10-21.

- Google Play and Android TV:
  [TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality),
  [Distribute to Android TV](https://developer.android.com/training/tv/publishing/distribute),
  [Dedicated form factor tracks](https://support.google.com/googleplay/android-developer/answer/13295490),
  [Create and run a TV app](https://developer.android.com/training/tv/get-started/create),
  [Handle TV hardware](https://developer.android.com/training/tv/get-started/hardware),
  [TV apps checklist](https://developer.android.com/training/tv/publishing/checklist),
  [Manage TV controllers](https://developer.android.com/training/tv/get-started/controllers),
  [Optimize memory usage on TV](https://developer.android.com/training/tv/playback/memory),
  [64-bit for Google TV and Android TV](https://android-developers.googleblog.com/2025/08/64-bit-app-compatibility-for-google-tv-android-tv.html),
  [16 KB page sizes](https://developer.android.com/guide/practices/page-sizes),
  [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878),
  [Play Developer API tracks](https://developers.google.com/android-publisher/tracks),
  [Android TV 1 GB RAM certification](https://www.androidauthority.com/android-tv-minimum-ram-3497217/),
  [Google system services release notes (TV Credential Manager)](https://support.google.com/product-documentation/answer/14343500).
- WebView and Capacitor:
  [WebView spatial navigation change](https://codereview.chromium.org/23619024),
  [Android TV WebView focus trap](https://issues.chromium.org/issues/40275154),
  [Capacitor: Android TV support discussion](https://github.com/ionic-team/capacitor/discussions/3225),
  [Capacitor community proposal: Android TV](https://github.com/capacitor-community/proposals/issues/45),
  [Capacitor #8648: second web app on external display](https://github.com/ionic-team/capacitor/issues/8648),
  [capacitor-chromecast plugin](https://github.com/marioshtika/capacitor-chromecast).
- Google Cast:
  [Overview](https://developers.google.com/cast/docs/overview),
  [Web Sender setup](https://developers.google.com/cast/docs/web_sender),
  [Web Receiver overview](https://developers.google.com/cast/docs/web_receiver),
  [Custom Web Receiver core features](https://developers.google.com/cast/docs/web_receiver/core_features),
  [Registration](https://developers.google.com/cast/docs/registration),
  [Android TV receiver (Cast Connect)](https://developers.google.com/cast/docs/android_tv_receiver),
  [Cast Connect core features](https://developers.google.com/cast/docs/android_tv_receiver/core_features),
  [Cast Connect codelab](https://developers.google.com/cast/codelabs/cast-connect-atv),
  [Presentation API with Cast sample](https://googlechrome.github.io/samples/presentation-api/cast.html),
  [Cast receivers and Web Audio APIs (Music Assistant)](https://github.com/music-assistant/support/issues/5297).
- AirPlay and iOS:
  [Presenting content on an external display](https://developer.apple.com/library/archive/documentation/WindowsViews/Conceptual/WindowAndScreenGuide/UsingExternalDisplay/UsingExternalDisplay.html),
  [QA1803: audio session category and AirPlay](https://developer.apple.com/library/archive/qa/qa1803/_index.html),
  [Configuring an audio session](https://developer.apple.com/library/archive/documentation/Audio/Conceptual/AudioSessionProgrammingGuide/AudioSessionBasics/AudioSessionBasics.html),
  [allowAirPlay](https://developer.apple.com/documentation/avfoundation/avaudiosession/categoryoptions/1771736-allowairplay),
  [Remote Playback API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Remote_Playback_API).
- TestFlight purchases and AutoFill (checked 2026-10-22):
  [Bitwarden iOS #3093: no keyboard in the App Store purchase password prompt](https://github.com/bitwarden/ios/issues/3093),
  [Apple Developer Forums: Face ID in TestFlight](https://developer.apple.com/forums/thread/96990),
  [Apple Developer Forums: Touch ID and TestFlight purchases (Apple DTS)](https://developer.apple.com/forums/thread/49940),
  [RevenueCat: the app does not choose the purchase prompt](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store).
- Miracast and mirroring:
  [Pixel and Miracast (Android Authority)](https://www.androidauthority.com/google-pixel-rear-screens-not-compatible-3650053/),
  [Android features Google dropped (How-To Geek)](https://www.howtogeek.com/android-features-google-abandoned-and-why-were-worse-off-for-it/),
  [Mirroring latency by protocol (1001TVs, indicative)](https://www.1001tvs.com/how-to-play-mobile-games-on-tv-with-low-latency-2026-guide/),
  [Protocol comparison (MirrorScreen)](https://mirrorscreen.tv/reviews/miracast-vs-airplay-vs-chromecast-complete-technical-comparison),
  [AirPlay 2 TV makers (SmartTVs.org)](https://smarttvs.org/how-to-mirror-your-android-phone-to-tv/).
- Cloudflare:
  [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
  [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
  [Durable Objects and WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
  [Free-plan WebSocket counting report](https://community.cloudflare.com/t/durable-objects-free-quota-block-below-100k-after-websocket-20-1-adjustment/967650).
