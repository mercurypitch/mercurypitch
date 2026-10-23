# Karaoke on a Television — EARS Requirements

Requirements for singing with a television as the stage: in a TV browser, in
the Google TV / Android TV app, over AirPlay or Android screen mirroring, on
an iOS second screen, and through a Google Cast receiver. The phone is the
microphone wherever the TV has none. Rationale, options, effort and order of
work are in [../plans/tv-cast-and-google-tv.md](../plans/tv-cast-and-google-tv.md);
the platform research and the phone-mic design are in
[../plans/tv-apps-and-phone-mic.md](../plans/tv-apps-and-phone-mic.md).

**Status:** proposed, 2026-10-21. Each requirement carries **[shipped]**,
**[next]** or **[open]**, as in the TV plans. Planned sources and tests are
named so the first PR that builds a requirement knows where it goes; a path
marked _(planned)_ does not exist yet. Updated 2026-10-22: `REQ-TV-090` is
done; `092` and `095` are in review (PR #1175); POC-3 (PR #1179) builds
view-mode slices of `020`-`022`, `026`, `027`, `091` and `100`-`102`, and
adds `104` and `105`, behind a test build's switch. Updated 2026-10-23:
`034` is added and `115` corrected. The server keeps no songs, so a TV that
plays a song gets it from the phone (plan section 2.9).

**Source (existing):** `src/lib/device-tier.ts` — device class and tier;
`src/styles/performance-mode.css` — the TV focus ring;
`src/features/keyboard/useKeyboardShortcuts.ts` — arrow keys on a TV;
`src/lib/file-picker.ts` — dead-picker detection;
`src/lib/mic-manager.ts` — capture and the no-device case;
`src/stores/mic-latency-store.ts` and
`src/features/mic-feedback/MicLatencyWizard.tsx` — latency offsets;
`src/lib/audio-memory-budget.ts` and
`src/features/stem-mixer/stem-stream-source.ts` — memory and streaming;
`src/stores/jam-store.ts`, `workers/jam-worker/src/jam-room.ts` — pitch
frames and the room relay;
`apps/mercurypitch/android/app/src/main/AndroidManifest.xml`,
`apps/mercurypitch/android/app/src/main/java/com/irchiinnuss/mercurypitch/*.java`,
`apps/mercurypitch/ios/App/App/{AppDelegate,SceneDelegate}.swift`,
`apps/mercurypitch/src/infrastructure/native-shell.ts`,
`packages/mobile-runtime/src/audio-output.ts`
**Source (POC-3, in review, PR #1179):** `apps/mercurypitch/stage.html` and
`apps/mercurypitch/src/stage/main.ts` — the stage page; `src/lib/tv-stage/`
— its protocol, model, renderer and feed;
`apps/mercurypitch/ios/App/App/LyricsWindow/TVStage.swift` — the window on
the external display; `src/features/karaoke-room/useKaraokeTvStage.ts` —
what the room sends; `src/stores/live-mic-store.ts`,
`src/stores/tv-stage-store.ts`
**Source (planned):** `src/features/tv-stage/` — the stage entry in host
mode, which may grow out of `src/lib/tv-stage/`;
`src/lib/remote-pitch/` — the frame protocol and pitch source;
`apps/mercurypitch/android/.../TvModePlugin.java`;
`apps/mercurypitch/ios/App/App/ExternalDisplaySceneDelegate.swift`;
`cast-receiver/` — the Custom Web Receiver
**Tests:** mapped per requirement below. Cross-device behaviour is crossed by
the jam-two-peer harness (`.claude/skills/jam-two-peer/`) and
`docs/agent/TWO-DEVICE-E2E.md`; native wiring is pinned the way
`apps/mercurypitch/src/android-main-activity.test.ts` pins `MainActivity`.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").
"The TV" means the device showing the stage; "the phone" means the device in
the singer's hand. Play test ids (TV-DP, TV-IE...) refer to Google's
[TV app quality](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
checklist.

---

## Device class and capability — `REQ-TV-001..006`

### REQ-TV-001 — The Android shell says it is a TV **[next]**

**WHERE** the app runs in the Android shell, the system shall classify the
device as `tv` **WHEN** Android reports the television UI mode or the
`android.software.leanback` feature, whatever the user agent says. The
user-agent heuristic stays as the web fallback (`REQ-TV-003`).
_Tests:_ `apps/mercurypitch/src/android-tv-mode.test.ts` _(planned)_ — "a
leanback device is a tv even with a phone user agent".

### REQ-TV-002 — The Android shell reports a low-RAM TV **[next]**

**WHERE** the Android shell reports the low-RAM flag and the device's total
RAM, the system shall pass the RAM to `setNativeDeviceMemoryGb` and apply the
low-RAM TV budget (`REQ-TV-040`).
_Tests:_ `src/lib/audio-memory-budget.test.ts` — extend with "a low-RAM tv
takes the tv budget" _(planned case)_.

### REQ-TV-003 — Web detection **[shipped]**

The system shall classify a device as `tv` from explicit TV tokens, the `tv`
media type, or Android without the `Mobile` token and with no touch points.
_Tests:_ `src/lib/device-tier.test.ts`.

### REQ-TV-004 — Overrides **[shipped]**

The system shall honour `?device=tv` and `?perf=low`, and the Settings,
Display & Controls, Graphics Quality override, so TV behaviour can be tested
without a TV.
_Tests:_ `src/lib/device-tier.test.ts`.

### REQ-TV-005 — Verdict before first paint **[shipped]**

The system shall publish `data-device-class` and `data-perf-tier` on `<html>`
before first paint from every entry point, including the stage entry
(`REQ-TV-026`).
_Tests:_ `src/lib/device-tier.test.ts`; the stage entry adds its own
_(planned)_.

### REQ-TV-006 — No microphone API is a sentence **[shipped]**

**IF** the browser has no `navigator.mediaDevices`, **THEN** the system shall
report "This browser cannot use a microphone." as `no-device`, never a
TypeError, and a TV shall offer the phone as the microphone (`REQ-TV-053`).
_Tests:_ `src/tests/mic-manager.test.ts` (shipped part); the phone offer
_(planned)_.

---

## The remote — `REQ-TV-010..017`

### REQ-TV-010 — Five keys reach everything **[next]**

**WHILE** the device class is `tv`, every control on the stage, the library,
the sync and sign-in dialogs and the settings reachable on a TV shall be
operable with Up, Down, Left, Right, Select and Back alone, and none shall
need a Menu key (Play TV-DP, TV-DM).
_Tests:_ `src/e2e/tv-dpad-walk.spec.ts` _(planned)_ — a keyboard-only walk at
1920x1080 with `?device=tv`, failing on any control focus cannot reach.

### REQ-TV-011 — Visible focus **[shipped]**

**WHILE** the device class is `tv`, the focused element shall show the strong
`:focus-visible` ring and hover transforms shall be suppressed.
_Tests:_ `src/styles/performance-mode.css`; checked by the app-check skill.

### REQ-TV-012 — Arrow keys belong to focus **[shipped]**

**WHILE** the device class is `tv`, Up and Down shall not change the playback
speed and shall not be cancelled, so focus can leave its row.
_Tests:_ `src/features/keyboard/useKeyboardShortcuts.tv.test.ts`.

### REQ-TV-013 — Back closes before it navigates **[next]**

**WHEN** Back arrives (Escape, Android Back, webOS keyCode 461, Tizen keyCode
10009), the system shall close the topmost open layer. **IF** none is open,
**THEN** it shall navigate back. **IF** the app is at its root, **THEN** the
Android app shall return to the TV home (`REQ-TV-077`) and a packaged Tizen
app shall exit itself.
_Tests:_ `src/features/keyboard/tv-back.test.ts` _(planned)_.

### REQ-TV-014 — Playback keys on the stage **[next]**

**WHILE** a song plays on the stage and focus rests on the stage rather than a
control, **WHEN** Select is pressed, the system shall pause or resume; **WHEN**
Left or Right is pressed, it shall rewind or fast-forward by a fixed step
(Play TV-PC). Arrow keys on a focused control keep moving focus.
_Tests:_ `src/features/tv-stage/stage-keys.test.ts` _(planned)_.

### REQ-TV-015 — Media keys **[next]**

**WHEN** a play, pause or play-pause media key arrives during playback, the
system shall toggle playback accordingly (Play TV-PP).
_Tests:_ `src/features/tv-stage/stage-keys.test.ts` _(planned)_; a device
check on the Philips Google TV.

### REQ-TV-016 — Nothing depends on hover **[next]**

No control on a TV path shall be reachable or explained only by hover.
_Tests:_ `src/e2e/tv-dpad-walk.spec.ts` _(planned)_.

### REQ-TV-017 — Focus comes home **[next]**

**WHEN** a dialog, sheet or menu closes, focus shall return to the element
that opened it.
_Tests:_ `src/e2e/tv-dpad-walk.spec.ts` _(planned)_.

---

## The TV stage — `REQ-TV-020..027`

### REQ-TV-020 — Inside the safe area **[next; POC in review, PR #1179]**

The stage shall keep all text and controls inside an overscan-safe inset of
at least 5% of each edge (Play TV-OV).
_Tests:_ `src/lib/tv-stage/renderer.test.ts` ("keeps everything inside a 5%
margin on every side", the POC stage); `src/features/tv-stage/layout.test.ts`
_(planned)_; app-check at 1920x1080.

### REQ-TV-021 — Landscape, full screen, opaque **[next; POC in review, PR #1179]**

The stage shall fill a landscape screen with an opaque background and no
letterboxing (Play TV-LO, TV-TR).
_Tests:_ app-check at 1920x1080 and 3840x2160 _(planned)_. The POC stage
draws an opaque canvas at the screen's own pixels; headless renders at
1920x1080 checked by hand.

### REQ-TV-022 — Legible from the sofa **[next]**

The current lyric line shall render at no less than 32 CSS px at a 1080-line
viewport, scaling with viewport height. _Assumption:_ legible from 3 m; to
confirm on hardware in phase P0.
_Tests:_ `src/features/tv-stage/layout.test.ts` _(planned)_. The POC stage
draws the line at 72 px at 1080 lines, but shrinks a very long line to fit
the width, which can take it under 32 px; the production stage wraps it
instead.

### REQ-TV-023 — Frame caps on a TV **[shipped]**

**WHILE** the device class is `tv`, per-frame drawing shall be capped at the
tier's presentation rate, and canvases at the tier's render scale.
_Tests:_ `src/tests/stem-mixer-frame-scheduler.test.ts`; the stage reuses the
scheduler _(planned)_.

### REQ-TV-024 — A QR a room can scan **[next]**

**WHEN** the stage shows a pairing or sync QR, it shall render dark on light
with a quiet zone, whatever the theme, at 30-40% of the viewport height.
_Tests:_ `src/components/__tests__/QrCode.test.tsx` _(planned)_.

### REQ-TV-025 — The code under the QR **[next]**

The stage shall print the pairing code as text under the QR, from an alphabet
without `0`, `O`, `1` or `I`.
_Tests:_ as `REQ-TV-024`.

### REQ-TV-026 — Host and view modes **[next; view mode in review, PR #1179]**

The stage shall draw from one model in two modes: **host**, where it owns
playback and scoring (TV browser, Google TV app, Cast receiver), and **view**,
where it draws snapshots from a controller that owns them (iOS second screen).
_Tests:_ `src/features/tv-stage/stage-model.test.ts` _(planned)_. View mode
as built in POC-3: `src/lib/tv-stage/model.test.ts`.

### REQ-TV-027 — A light entry with no native plugins **[next; POC in review, PR #1179]**

The stage shall be its own entry, shall register no Capacitor plugins, and
shall load no module outside its own chunk at first paint.
_Tests:_ `apps/mercurypitch/scripts/assert-bundle.mjs` _(planned check)_;
`ANALYZE=1 pnpm build` shows the stage chunk absent from other entries.
The POC entry: `apps/mercurypitch/src/ios-tv-stage.test.ts` ("loads its own
script and nothing of the app", "reaches only the stage's own modules"). It
does not meet the last clause yet: Rollup puts the protocol module, which the
room imports too, in a small chunk the two entries share.

---

## Songs on the TV — `REQ-TV-030..034`

### REQ-TV-030 — Never a dead upload button **[shipped notice, next action]**

**WHILE** the device class is `tv`, the upload view shall lead with a notice
that the TV cannot open files **[shipped]**, and the notice shall carry an
action that opens "receive from your phone" **[next]**.
_Tests:_ `src/components/__tests__/UvrPanel.test.tsx` (notice);
action _(planned case)_.

### REQ-TV-031 — Receive by default **[next]**

**WHEN** the sync dialog opens on a TV, it shall open on Receive.
_Tests:_ `src/components/__tests__/SyncDevicesModal.test.tsx` _(planned case)_.

### REQ-TV-032 — The TV app can get songs and sign in **[next]**

**WHILE** the Android app runs on a TV, it shall show device sync and the
"sign in with your phone" row, both hidden from the native phone build today.
_Tests:_ `src/components/__tests__/UvrPanel.native.test.tsx`,
`apps/mercurypitch/src/shell/settings/SignInSheet.test.tsx` _(planned cases)_.

### REQ-TV-033 — Stream, or refuse in words **[next]**

**WHILE** the device class is `tv`, **WHERE** `AudioDecoder` exists, the
system shall stream stems. **IF** it does not and the song's decoded size
exceeds the TV budget, **THEN** the system shall refuse the song with a
sentence that says why and what works instead, and shall not attempt a full
decode.
_Tests:_ `src/features/stem-mixer/stem-stream-source.test.ts` _(planned
case)_.

### REQ-TV-034 — One song from the phone, through no server **[next]**

**WHEN** the phone sends a song to a TV that plays it (the TV browser, the
Google TV app or a Cast receiver), the audio shall cross only a direct peer
connection between the two, and the TV shall be able to play the song without
saving it. **IF** only a relayed connection is possible, **THEN** the phone
shall not send the song and shall say why. Demo songs are exempt: the TV
fetches them from their public URL.
_Tests:_ `src/lib/sync/sync-protocol.test.ts` _(planned case: play without
keeping)_; the relay refusal as `src/tests/sync-store.test.ts` pins it for
sync today; a two-device run on the jam-two-peer harness.

---

## Memory — `REQ-TV-040..041`

### REQ-TV-040 — Within 280 MB on a 1 GB TV **[next]**

**WHILE** the app runs on a low-RAM TV, its total memory (anonymous and swap,
graphics, file) during a streamed song shall stay within 280 MB (Play TV-ME).
_Tests:_ a device check with `dumpsys meminfo`, recorded in the plan; a 1 GB
emulator run before each TV release.

### REQ-TV-041 — Budgets from real RAM **[next]**

**WHERE** a native shell can read the device's RAM, every audio budget shall
use it rather than `navigator.deviceMemory`.
_Tests:_ `src/lib/audio-memory-budget.test.ts` _(planned case)_.

---

## The phone as the microphone — `REQ-TV-050..069`

### REQ-TV-050 — Pitch, never audio **[next]**

The phone shall send pitch frames only. It shall never send audio samples, and
the TV shall never request them.
_Tests:_ `src/lib/remote-pitch/protocol.test.ts` _(planned)_ — the message
schema has no audio field and the relay rejects unknown fields.

### REQ-TV-051 — What a frame carries **[next]**

Each frame shall carry the session id, a sequence number, the phone's capture
time in milliseconds on its own clock, the frequency, cents, clarity and MIDI
note, and the room beat when a song plays.
_Tests:_ `src/lib/remote-pitch/protocol.test.ts` _(planned)_.

### REQ-TV-052 — Rate and batching **[next]**

**WHILE** the singer is voiced, the phone shall produce frames at 20 Hz or
more. It may batch frames into one message, adding no more than 100 ms of
delay to the oldest frame in a batch.
_Tests:_ `src/lib/remote-pitch/sender.test.ts` _(planned)_.

### REQ-TV-053 — Pairing on the TV **[next]**

**WHEN** the TV starts phone-mic mode, it shall show a QR of
`https://mercurypitch.com/mic/<CODE>` and the code as text (`REQ-TV-024`,
`REQ-TV-025`).
_Tests:_ `src/features/tv-stage/pairing.test.ts` _(planned)_.

### REQ-TV-054 — The link opens the app where it can **[next]**

**WHERE** the native app is installed and the `/mic/*` path is verified for
it (`assetlinks.json`, apple-app-site-association), **WHEN** the phone opens the
link, the native app shall open in mic mode; otherwise the web app shall. The
web shall also answer the hash form for old links.
_Tests:_ `src/tests/hash-router.test.ts` _(planned case)_;
`apps/mercurypitch/src/app-url-open.test.ts` _(planned)_.

### REQ-TV-055 — One confirmation **[next]**

The phone shall need at most one confirmation to become the microphone after
opening the link, plus the microphone permission the first time.
_Tests:_ two-device end-to-end, `src/e2e-devices/phone-mic.spec.ts`
_(planned)_.

### REQ-TV-056 — Clock offset **[next]**

**WHILE** a phone is paired, the TV shall estimate the offset between the
phone's clock and its own by ping and pong at least every 10 s and map each
frame's capture time onto its song clock.
_Tests:_ `src/lib/remote-pitch/clock-sync.test.ts` _(planned)_ — a simulated
skewed and drifting clock stays within 10 ms.

### REQ-TV-057 — The TV's output delay **[next]**

**WHEN** a TV has no stored output delay for its current output route, the TV
shall offer a click calibration measured by the phone's microphone, using the
Mic Latency wizard's method, and store the result per TV and route.
_Tests:_ `src/lib/mic-latency.test.ts` _(planned cases)_.

### REQ-TV-058 — Score at capture time **[next]**

The TV shall score each frame at its corrected capture time, never at its
arrival time.
_Tests:_ `src/lib/remote-pitch/pitch-source.test.ts` _(planned)_ — the same
frames delivered with 0 ms and 300 ms of delay score the same.

### REQ-TV-059 — Late frames **[next]**

**IF** a frame arrives after the note it belongs to has closed, **THEN** the
TV shall drop it from scoring, count it, and still draw it on the trail.
_Tests:_ `src/lib/remote-pitch/pitch-source.test.ts` _(planned)_.

### REQ-TV-060 — A gap is not a wrong note **[next]**

**IF** no frame arrives for more than 1 s while a song plays, **THEN** the TV
shall show "phone mic paused" and score that interval as no data, not as
missed singing.
_Tests:_ `src/lib/remote-pitch/pitch-source.test.ts` _(planned)_.

### REQ-TV-061 — The TV's own sound **[next]**

The phone shall drop frames below clarity 0.2 (`MIN_SUNG_CLARITY`). **WHERE**
the TV sends the reference pitch, the phone shall also drop frames that match
the backing track's pitch while the singer's lane is silent.
_Tests:_ `src/lib/remote-pitch/sender.test.ts` _(planned)_.

### REQ-TV-062 — The phone stays awake **[next]**

**WHILE** in mic mode, the phone shall hold a wake lock (the native keep-awake
plugin, or the Screen Wake Lock API). **WHERE** the phone is iOS Safari, it
shall say that locking the screen stops the microphone.
_Tests:_ `src/features/phone-mic/PhoneMicScreen.test.tsx` _(planned)_.

### REQ-TV-063 — The phone's screen **[next]**

**WHILE** in mic mode, the phone shall show its input level, a mute control,
the current lyric line and the connection state.
_Tests:_ `src/features/phone-mic/PhoneMicScreen.test.tsx` _(planned)_.

### REQ-TV-064 — Transport **[next]**

Frames shall travel through the jam worker's Durable Object over WebSocket.
**WHERE** both ends support it, the system may use an unordered WebRTC data
channel with no retransmits instead.
_Tests:_ `workers/jam-worker/src/jam-room.test.ts` _(planned cases)_ — a
`pitch` message reaches the room's display and no one else.

### REQ-TV-065 — Reconnect without pairing again **[next]**

**WHEN** the connection drops, both ends shall reconnect with backoff and
resume the same session for at least 5 minutes without a new QR.
_Tests:_ `src/e2e-devices/phone-mic.spec.ts` _(planned)_.

### REQ-TV-066 — More than one singer **[open]**

**WHERE** more than one phone joins, each shall get its own lane and colour, up
to the room's limit.
_Tests:_ two-device end-to-end with three peers _(planned)_.

### REQ-TV-067 — Who is connected **[next]**

The TV shall list the connected phones and let the user remove one.
_Tests:_ `src/features/tv-stage/connected-phones.test.tsx` _(planned)_.

### REQ-TV-068 — Latency shown as an estimate **[next]**

**WHERE** diagnostics are shown, the TV shall break the delay into network,
clock-offset uncertainty and output delay, label unmeasured terms as
estimates, and follow `src/lib/jam/jam-latency-budget.ts`.
_Tests:_ `src/lib/remote-pitch/latency-budget.test.ts` _(planned)_.

### REQ-TV-069 — Codes expire **[next]**

**IF** a pairing code is unused for 10 minutes, **THEN** it shall expire, and a
phone opening it shall be told to scan again.
_Tests:_ `workers/jam-worker/src/jam-room.test.ts` _(planned case)_.

---

## The Google TV / Android TV app — `REQ-TV-070..084`

### REQ-TV-070 — Launcher entries **[next]**

The manifest shall declare a `MAIN` / `LEANBACK_LAUNCHER` activity and an
`android:banner` (320x180 at xhdpi, containing the app's name) beside an icon
of at least 160x160 at xhdpi (Play TV-LM, TV-LB, TV-BN, TV-ML).
_Tests:_ `apps/mercurypitch/src/android-tv-manifest.test.ts` _(planned)_.

### REQ-TV-071 — No hardware a TV lacks **[next]**

The manifest shall declare `android.hardware.touchscreen`,
`android.hardware.faketouch` and `android.software.leanback` as not required,
and keep `android.hardware.microphone` not required (Play TV-MT).
_Tests:_ `apps/mercurypitch/src/android-tv-manifest.test.ts` _(planned)_.

### REQ-TV-072 — Minimum SDK **[shipped]**

`minSdkVersion` shall stay at 31 or lower (Play TV-PS). It is 29.
_Tests:_ `apps/mercurypitch/src/android-tv-manifest.test.ts` _(planned)_ reads
`variables.gradle`.

### REQ-TV-073 — No browser launches on a TV **[next]**

**WHILE** the app runs on a TV, it shall not launch a browser app. Terms,
privacy, about and other external pages shall open inside the app or as a QR
to read on a phone (Play TV-WB).
_Tests:_ `apps/mercurypitch/src/shell/settings/external-links.test.tsx`
_(planned)_ — no `target="_blank"` and no `window.open` on the TV path.

### REQ-TV-074 — No automatic picture-in-picture **[next]**

**WHILE** the app runs on a TV, it shall not enter picture-in-picture by
itself: auto-enter shall be off and `onUserLeaveHint` shall not enter. **WHERE**
picture-in-picture is offered on a TV, entering it shall be an explicit user
action and it shall declare its usage type, title and subtitle (Play TV-IE,
TV-IC).
_Tests:_ `apps/mercurypitch/src/android-picture-in-picture.test.ts` _(planned
case)_.

### REQ-TV-075 — Media controls after Home **[next]**

**WHILE** a song keeps playing after the user presses Home, the system shall
show the TV's media controls, and choosing them shall open a screen that can
pause (Play TV-NP, TV-PA).
_Tests:_ a device check on the Philips Google TV.

### REQ-TV-076 — Ambient Mode allowed when idle **[next]**

The app shall hold the keep-awake lock only while a song plays, and shall
release it on pause, stop and leaving the room (Play TV-BY, TV-BA).
_Tests:_ `packages/mobile-runtime/src/platform.test.ts` _(planned case)_ and
the room's own test.

### REQ-TV-077 — Back from the root **[shipped, verify on TV]**

**WHEN** Back reaches the app's root, the app shall minimise, returning the
user to the TV home (Play TV-DB).
_Tests:_ `apps/mercurypitch/src/infrastructure/native-shell.test.ts`; a device
check.

### REQ-TV-078 — The TV layout **[next]**

**WHILE** the app runs on a TV, the native shell shall use a landscape layout
whose rail, tabs and sheets are reachable by D-pad, with no portrait-only
screen.
_Tests:_ `apps/mercurypitch/src/shell/ShellRoot.test.tsx` _(planned cases)_.

### REQ-TV-079 — Native libraries **[next]**

The release bundle shall contain no native libraries. **IF** a dependency adds
one, **THEN** CI shall require both `armeabi-v7a` and `arm64-v8a` builds aligned
for 16 KB pages before upload (Play TV-G6).
_Tests:_ a CI step listing `lib/*.so` in the AAB _(planned)_.

### REQ-TV-080 — A track of its own **[next]**

The app shall reach TVs through Play's dedicated Android TV release track, so
a TV review result cannot hold a phone release.
_Tests:_ release checklist in the plan.

### REQ-TV-081 — What review needs **[next]**

Each TV submission shall include at least one unaltered TV screenshot and,
**WHERE** sign-in gates features, reviewer credentials (Play TV-G4, TV-G5).
_Tests:_ release checklist.

### REQ-TV-082 — Sign in with the phone **[next]**

**WHILE** the app runs on a TV, signing in shall not require typing a password
on the remote; the sheet shall offer sign-in by scanning a code with a phone
(Play TV-LI).
_Tests:_ `apps/mercurypitch/src/shell/settings/SignInSheet.test.tsx`
_(planned case)_.

### REQ-TV-083 — A USB microphone **[next]**

**WHERE** a USB audio input is connected to the TV, the app shall offer it as
the local microphone. **IF** there is none, **THEN** it shall offer the phone
(`REQ-TV-053`).
_Tests:_ a device check with a USB microphone.

### REQ-TV-084 — Paying with the remote **[next]**

**WHERE** purchases are offered on a TV, every paywall control shall be
operable by D-pad (Play TV-DP).
_Tests:_ a device check; `src/e2e/tv-dpad-walk.spec.ts` covers the web
paywall _(planned)_.

---

## Mirroring — `REQ-TV-090..095`

### REQ-TV-090 — An external display mirrors by default **[done]**

**WHEN** iOS connects a scene with an external-display role (AirPlay screen
mirroring, or a cable), **WHERE** the second-screen stage is not enabled, the
iOS app shall create no window and no web view for that scene, so iOS mirrors
the device screen. See ionic-team/capacitor#8648.
_Tests:_ `apps/mercurypitch/src/ios-external-display.test.ts` (merged in
PR #1157) — pins that `configurationForConnecting` gives `SceneDelegate` only
to the application role; Simulator check (I/O, External Displays) shows one
`Loading app at`. Device check passed 2026-10-22 on an LG C2 over AirPlay
(TestFlight mp-v0.8.40): the TV mirrors the phone in both orientations.

### REQ-TV-091 — One bridge **[next; POC in review, PR #1179]**

The iOS app shall run one Capacitor bridge per process. The second-screen
stage (`REQ-TV-100`) is not a bridge and registers no plugins.
_Tests:_ as `REQ-TV-090`; `apps/mercurypitch/src/ios-tv-stage.test.ts`
("shows a plain web view: no bridge of its own, no plugins").

### REQ-TV-092 — Offsets per input and output **[in review, PR #1175]**

The latency offset shall be stored per input device, and per output route
for the routes that add a delay of their own (Bluetooth, AirPlay, HDMI).
**WHEN** the output route changes, the system shall apply the offset stored
for the new pair. **WHILE** such a route has no offset of its own, it shall
borrow the input's offset and report no spread for it, so it compensates but
makes no early or late claim. The phone's own outputs (speaker, earpiece,
wired headphones) and the web, which cannot name its route, shall share the
input's existing offset, so offsets saved before this keep working
unchanged. Cast joins the list with the Cast sender (P6), which knows when
it casts; it is not an operating-system audio route.
_Tests:_ `src/tests/mic-latency-store.test.ts` ("per output route");
`src/tests/audio-route-store.test.ts`;
`packages/mobile-runtime/src/audio-output.test.ts` (the route kinds,
`onAudioRoute`); `apps/mercurypitch/src/ios-audio-output.test.ts` and
`android-audio-output.test.ts` (the route event, and no volume polling for
it on iOS).

### REQ-TV-093 — A new route asks first **[next]**

**WHEN** the output route becomes AirPlay, HDMI or cast and no offset is
stored for it, the system shall offer a calibration before scoring. **IF**
the calibration's spread exceeds the scoring tolerance, **THEN** the system
shall offer to sing with lyrics only and say why.
_Tests:_ `src/features/mic-feedback/MicLatencyWizard.test.tsx` _(planned)_.

### REQ-TV-094 — A big-screen layout under mirroring **[next]**

**WHERE** the native app detects an external or mirrored display, the singing
room shall offer a landscape layout sized for the TV. **WHERE** the app runs on
the web, the same layout shall be available as a manual choice.
_Tests:_ app-check at 1920x1080 _(planned)_.

### REQ-TV-095 — The screens say which number is in use **[in review, PR #1175]**

**WHILE** the output route is one with a delay of its own, the latency
wizard and the native Microphone screen shall say whether the offset in use
was measured on that route or is borrowed, and shall name the route.
**WHILE** the route borrows, the system shall offer to measure for the route
and shall not offer to clear an offset it would not clear. The day a
measurement was made shall be kept per route as its number is, so a run on
one route leaves another route's day alone.
_Tests:_ `src/tests/mic-latency-wizard.test.tsx` ("the route the number is
for"); `apps/mercurypitch/src/shell/settings/MicrophoneScreen.test.tsx` and
`latency-measured.test.ts` (the AirPlay cases).

---

## iOS second screen — `REQ-TV-100..105`

POC-3 (PR #1179) builds `100`-`102` and `104`-`105` behind a test build's
"Stage on a connected TV" switch, which starts off; a store build carries no
stage page, so its TV mirrors (`REQ-TV-090`, `104`).

### REQ-TV-100 — The stage on the external display **[open; POC in review, PR #1179]**

**WHERE** the second-screen stage is enabled, **WHEN** an external-display
scene connects, the iOS app shall show the stage in view mode
(`REQ-TV-026`) in a separate web view that registers no plugins, while the
phone keeps its controls and microphone.
_Tests:_ `apps/mercurypitch/src/ios-tv-stage.test.ts` (the POC: an external
display's scene and no other, only with the switch on); a device check with
an Apple TV and an AirPlay 2 TV.

### REQ-TV-101 — Fed only by the bridge **[open; POC in review, PR #1179]**

The stage web view shall receive state only from the main web view, through a
native message bridge, and shall read no storage of its own.
_Tests:_ `src/features/tv-stage/view-mode.test.ts` _(planned)_. The POC:
`src/lib/tv-stage/protocol.test.ts` (what the stage takes and drops),
`src/features/karaoke-room/useKaraokeTvStage.test.ts` (what the room sends,
and when), `apps/mercurypitch/src/ios-tv-stage.test.ts` (each message reaches
the page; the newest song and frame wait for a page still loading).

### REQ-TV-102 — Released on disconnect **[open; POC in review, PR #1179]**

**WHEN** the external display disconnects, the iOS app shall tear down and
release the stage web view, leaving one web view running.
_Tests:_ device check (Safari, Develop menu lists one page after disconnect);
`apps/mercurypitch/src/ios-tv-stage.test.ts` pins that a disconnect hides the
window and drops the web view.

### REQ-TV-103 — The sound's route is known **[open]**

**WHILE** the second-screen stage is shown, the system shall know whether the
song plays on the TV or the phone, and shall apply the offset for that route
(`REQ-TV-092`).
_Tests:_ device check, recorded in the plan.

### REQ-TV-104 — No stage page, no window **[open; POC in review, PR #1179]**

**IF** the app's bundle has no stage page, or the stage page fails to load,
**THEN** the iOS app shall take no window, or take its window down, so the
TV mirrors the phone. A load cancelled by the next one is not a failure.
_Tests:_ `apps/mercurypitch/src/ios-tv-stage.test.ts` ("finds no page where
the bundle has none", "gives the TV back to the mirror when the page does not
load"). A store build installed over a test build that left the switch on is
the case this covers: TestFlight and the App Store share the app's settings.

### REQ-TV-105 — The picture can be moved to meet the sound **[open; POC in review, PR #1179]**

**WHILE** the second-screen stage is shown, the system shall let the singer
move the stage's picture earlier or later than the room's clock, in steps,
within a limit, and shall keep the setting on the device. _POC:_ a test
build's Developer screen, 50 ms steps, up to 1.5 s either way, until the
TV's own delay is measured per route (`REQ-TV-092`).
_Tests:_ `src/stores/tv-stage-store.test.ts`;
`src/features/karaoke-room/useKaraokeTvStage.test.ts` ("moves the picture by
the Developer screen's offset");
`apps/mercurypitch/src/shell/TvLyricsPanel.test.tsx`.

---

## Google Cast — `REQ-TV-110..117`

### REQ-TV-110 — The receiver is the stage **[open]**

**WHERE** Cast is enabled, the Custom Web Receiver shall run the stage in host
mode and take commands and frames on its own `urn:x-cast:` namespace.
_Tests:_ `cast-receiver/receiver.test.ts` _(planned)_; the Cast Command and
Control tool against a registered device.

### REQ-TV-111 — Small messages **[open]**

Each message on the custom namespace shall stay under the 64 KB point-to-point
limit.
_Tests:_ `src/lib/remote-pitch/protocol.test.ts` _(planned)_.

### REQ-TV-112 — Senders and the Cast button **[open]**

Chrome on desktop and Android shall send through the Web Sender SDK; the
Android and iOS apps shall send through the native Cast SDKs. The Cast button
shall show only while a Cast device is available.
_Tests:_ sender plugin tests _(planned)_; device checks per platform.

### REQ-TV-113 — iOS local network **[open]**

The iOS app shall declare `NSLocalNetworkUsageDescription` and the Bonjour
services `_googlecast._tcp` and the receiver's own service before it
discovers Cast devices.
_Tests:_ `apps/mercurypitch/src/ios-info-plist.test.ts` _(planned)_.

### REQ-TV-114 — Cast Connect **[open]**

**WHERE** the Google TV app is installed on the Cast target, **WHEN** a sender
starts a session, the Google TV app shall open instead of the web receiver.
**IF** the app declines the launch, **THEN** the web receiver shall load.
_Tests:_ a device check with a Play-installed build.

### REQ-TV-115 — No server copy of a private song **[open]**

The receiver shall load a demo song from its public URL, and any other song
only from the sender over a direct peer connection (`REQ-TV-034`). It shall
not require the user's audio to be placed on a server, not even for a moment.
_Tests:_ `cast-receiver/song-source.test.ts` _(planned)_.

### REQ-TV-116 — Session end **[open]**

**WHEN** the last sender disconnects, the receiver shall stop the song and show
an idle screen.
_Tests:_ `cast-receiver/receiver.test.ts` _(planned)_.

### REQ-TV-117 — Older receivers **[open]**

**IF** the receiver lacks `AudioContext.outputLatency` or another Web Audio
API the stage uses, **THEN** it shall fall back to the stored per-device
calibration rather than fail.
_Tests:_ `cast-receiver/capabilities.test.ts` _(planned)_.

---

## Traceability — Play TV tests to requirements

| Play test                  | Requirement         |
| -------------------------- | ------------------- |
| TV-LM, TV-LB, TV-BN, TV-ML | `REQ-TV-070`        |
| TV-MT                      | `REQ-TV-071`        |
| TV-PS                      | `REQ-TV-072`        |
| TV-LO, TV-TR               | `REQ-TV-021`, `078` |
| TV-OV                      | `REQ-TV-020`        |
| TV-DP, TV-DM               | `REQ-TV-010`, `084` |
| TV-DB                      | `REQ-TV-013`, `077` |
| TV-WB                      | `REQ-TV-073`        |
| TV-NP, TV-PA               | `REQ-TV-075`        |
| TV-PC                      | `REQ-TV-014`        |
| TV-PP                      | `REQ-TV-015`        |
| TV-BY, TV-BA               | `REQ-TV-076`        |
| TV-IE, TV-IC               | `REQ-TV-074`        |
| TV-ME                      | `REQ-TV-040`        |
| TV-G6                      | `REQ-TV-079`        |
| TV-G4, TV-G5               | `REQ-TV-081`        |
| TV-LI (tier 2)             | `REQ-TV-082`        |
| TV-CT (tier 2)             | `REQ-TV-114`        |
