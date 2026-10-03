# Televisions: store apps, remotes, and the phone as the microphone

**Plan, 2026-09-29.** Nothing here is built unless marked **[shipped]**. It
continues [tv-and-low-tier-devices.md](tv-and-low-tier-devices.md) (the TV
browser audit, tracked in issue #489) and the song handoff in
[tv-qr-handoff.md](tv-qr-handoff.md) and [device-sync.md](device-sync.md).

Status keys as in the TV audit: **[shipped]**, **[next]** planned, **[open]**
needs a decision or hardware.

Three questions:

1. Which TVs can install the app, and what does each TV platform take?
2. What is left of issue #489, and what did it miss?
3. How does a TV hear the singer?

The answer to the third decides the plan: on most TVs an app cannot hear a
microphone at all, so the phone becomes the microphone.

---

## 1. The platforms

Researched 2026-09-29; sources at the end. "Mic" means continuous capture by a
third-party app, which is what singing needs.

| Platform                                      | Store                                                                                                                  | App format                                              | Web engine                                          | Mic                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google TV / Android TV**                    | Google Play: the **same listing** as the phone app, opted in to the TV form factor and reviewed separately             | the existing Capacitor AAB, with TV manifest entries    | Android WebView, updated through Play               | **USB mics, device by device**: standard Android audio and `getUserMedia` in a WebView. The remote's mic is voice search only; Bluetooth mics are too laggy to sing into                       |
| **LG webOS**                                  | LG Content Store (Seller Lounge). Individual sellers accepted, no fee, a QA of about three weeks with several rounds   | a web app packaged as `.ipk` (`ares` CLI). No Capacitor | Chromium 79 (webOS 6, 2021) to 132 (webOS 26)       | **None.** LG staff: "webOS TV apps cannot access audio"; WebRTC only for contracted partners. Web Audio carries ~500 ms of latency, no `createMediaElementSource()`, one audio element per app |
| **Samsung (Tizen, not Android)**              | Samsung Apps TV (Seller Office). A public seller can launch **in the US only**; anywhere else needs a partner contract | a web app packaged as `.wgt` (Tizen Studio or CLI)      | Chromium 85 (2022) to 130 (2026). WebRTC since 2020 | **On paper.** `getUserMedia` is listed under a privilege as "partial", and a 2025 field report shows it failing on Tizen 7. Samsung's own karaoke mics (phone and USB) work with Stingray only |
| **Fire TV, Fire OS** (most current devices)   | Amazon Appstore: APK or AAB, no Google services                                                                        | the Android build                                       | Android WebView                                     | Remote: no. USB: undocumented                                                                                                                                                                  |
| **Fire TV, Vega OS** (every new stick, 2025+) | Amazon Appstore, no sideloading                                                                                        | React Native, or web in Vega WebView. Not Android       | Chromium 144                                        | An audio-record API exists; no evidence of a usable mic                                                                                                                                        |

Two more:

- **Philips** (TP Vision, Europe) ships Google TV only on the OLED950 and
  OLED910 in 2025, and Titan OS on almost everything in 2026. Titan OS, like
  Hisense's VIDAA, is its own web platform and was not researched.
- **Apple TV** gives apps no web view, so Capacitor cannot reach it. tvOS 17+
  does let apps use an iPhone's microphone (Continuity Camera). Out of scope.

**The conclusion.** On every platform the remote's microphone belongs to the
system's voice search. Mainstream TV karaoke gets the voice from a phone
(Samsung with Stingray, Let's Sing's companion app, Apple Music Sing on tvOS
26, SingStar's mic app) or from certified hardware. A phone is the only
microphone that works on every TV; a USB mic on Android TV is a bonus.

---

## 2. Issue #489, item by item

| Item                            | Where it stands                                                                                                                                                       | Next                                                                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview waveform cache         | Not started. `drawOverviewInto` redraws every column of every lane each frame (`useStemMixerCanvasController.ts:283-524`)                                             | **[open]** only if the TV test in §5 shows the mixer overview stutters. Split the waveform layer from the playhead and markers; build a strip per lane keyed on buffer and revision, px-per-second, height and `renderScale()`; keep `overview-mapping.ts`'s exact column mapping. Its own PR      |
| Static stage backgrounds on low | Moot: both stages are already static photos                                                                                                                           | **[next]** drop Guitar Night's `.roomGlow` (a full-viewport `mix-blend-mode: screen` layer the low tier stops animating but keeps) and `roomSettle` on `low`; pass a tier-capped ratio to `background-surface.ts`, which picks 2x and 4K art from the raw `devicePixelRatio` even on a low-tier TV |
| TV performance check            | Not recorded                                                                                                                                                          | **[next]** §5, and it decides the first item                                                                                                                                                                                                                                                       |
| `color-mix()` fallbacks         | **[shipped]** for `.css` files                                                                                                                                        | **[next]** the Karaoke mixer's styles are a runtime string (`StemMixerStyles`, `src/components/StemMixer.tsx:3246-8200`); see §3.2                                                                                                                                                                 |
| Mic on TV                       | `mic-manager.ts` asks `getUserMedia` with no TV case                                                                                                                  | **[shipped]** a browser with no `navigator.mediaDevices` now reads "This browser cannot use a microphone." instead of a TypeError. **[next]** TV copy once §5 says what the TV browsers do; the phone as the mic, §4                                                                               |
| Phone-to-TV song handoff        | **[shipped]**, mostly: P2P sync with a QR of `#/sync:CODE` (PR #501), TV sign-in by phone (`#/link:CODE`), the account's song list (PR #490), Drive restore (PR #498) | **[next]** an action on the TV upload notice (`UvrPanel.tsx`, gated on `isTvDevice()`); a QR sized for a room (it renders at 168 px; aim for 30–40% of the viewport height); the sync modal opening on Receive on a TV; stream-one-song                                                            |
| Per-tab sidebar                 | **[shipped]** in PR #495, the day #489 was filed                                                                                                                      | Done for #489. Its remaining steps are not TV work: [sidebar-per-tab.md](sidebar-per-tab.md)                                                                                                                                                                                                       |
| Native Android TV shell         | Not started                                                                                                                                                           | **[next]** §6, phase 3. The Capacitor app now exists, so this is the cheapest native route                                                                                                                                                                                                         |

---

## 3. What #489 did not list

### 3.1 The remote

- **[shipped]** Up and Down set the playback speed on every tab but Karaoke
  and cancelled their default (`useKeyboardShortcuts.ts`), which on a TV is
  the D-pad: a remote could not leave its row. On a TV they are now left to
  the page (`useKeyboardShortcuts.tv.test.ts`).
- **[next]** Back. LG's remote sends keyCode 461 and Samsung's 10009; a
  packaged Tizen app must exit itself at the root. Back should close what is
  open (as Escape does) before it navigates.
- **[next]** Focus movement. Android's WebView switches on Chromium's own
  spatial navigation on devices without a touchscreen, which may carry the
  basics in the Android TV app. The TV browsers vary. Any surface that needs
  more gets a small focus grid, not a library-wide engine.
- **[next]** Targets a D-pad cannot reach: click-only elements, such as the
  mixer's transport seek bar ([BUGS.md](../agent/BUGS.md)).
- **[open]** Overscan margins, Media Session keys (play and pause on the
  remote), and Titan OS detection (there is no token or test for it yet).

### 3.2 The Karaoke mixer's stylesheet

`StemMixerStyles` is a template string of about 4,950 lines, injected at
runtime by `App.tsx` and `KaraokeStageHost.tsx`. Neither the fallback transform
(`tools/css-legacy-fallbacks.ts`, which only matches `.css` ids) nor Lightning
CSS ever sees it. It holds 24 `color-mix()` lines without a fallback, one
`:is()`, one `@container` and three `:has()` rules. The TV audit's review of
`:has()` and `@container` (its §5.3) lists no mixer rule: this string was
outside it. `LyricsUploaderStyles` takes the same path.

**[next]** Move both into `.css` files imported with `?inline`: the string is
then built by the same pipeline as every stylesheet. Its one `${}`
interpolation becomes a custom property. Then read what `:has()` and
`@container` drop on Chromium 79–94, the TV engines that lack them.

### 3.3 Four smaller things

- **[next]** Colour tokens set from JS without `colorTokenVars`:
  `--stem-color`, `--block-color`, `--loom-color`.
- **[next]** The TV "sign in with your phone" row is deliberately left out of
  the native sign-in sheet (`apps/mercurypitch/src/shell/settings/SignInSheet.tsx`);
  a native app on a TV needs it back.
- **[next]** Sync is hidden in native builds (`UvrPanel.tsx`), and a TV has no
  file picker, so a native app on a TV has no way to get songs.
- **[open]** The device-link poll compares token hashes with `!==`
  ([BUGS.md](../agent/BUGS.md), `workers/db-worker/src/auth.ts:3298`).

---

## 4. The phone as the microphone

### 4.1 Shape

The TV is the stage: backing track, lyrics, pitch lane, score. The phone is
the microphone: it captures, detects pitch with the same pipeline it uses
today, and sends **pitch frames, never audio**. A frame is about a hundred
bytes at 20–50 a second, so it survives Wi-Fi jitter that would break an
audio stream, and scoring needs only pitch.

Most of it exists. Jam already detects pitch on the sender's raw capture and
broadcasts frames (frequency, cents, clarity, MIDI, timestamp) about every
50 ms (`src/stores/jam-store.ts`), mints codes with no `0`/`O`/`1`/`I`, and
has TURN. `QrCode.tsx` renders the pairing code.

### 4.2 Pairing

The TV shows a QR of a new deep link (for example `/#/mic:CODE`) with the code
as text. The phone opens it in the native app (an app link) or the browser,
and one tap makes it the microphone for that TV.

### 4.3 Transport

A **relay through the jam worker's Durable Object**, over WebSocket. It is the
one transport that works everywhere: in any TV browser, and in an LG app,
where WebRTC is reserved for partners. The Durable Object relays signalling
today; it gains a `pitch` message it forwards to the room's display. A WebRTC
data channel (unordered, no retransmits) is a later optimization where both
ends support it. Durable Object billing counts WebSocket messages: measure the
cost at 20–50 frames a second per singer before fixing the rate.

### 4.4 Timing

The TV scores against its own song clock, and the frames arrive late and
jittered. Two corrections:

1. **Clock offset.** Ping and pong (jam has both) give the offset between the
   phone's clock and the TV's. Each frame carries the phone's capture time,
   which the TV maps onto its own.
2. **The TV's output latency.** The singer hears the backing track late and
   sings late by the same amount. LG warns of ~500 ms. Calibrate once per TV:
   the TV plays clicks, the phone hears them (the method `MicLatencyWizard`
   already uses), and the result is kept per TV the way `mic-latency-store`
   keeps one per input device.

### 4.5 Where the TV reads pitch

Every singing surface takes MicManager's local capture today
(`useStemMixerMicController.ts`, `SingRoomStage.tsx`). A pitch-source seam
chooses, per session, between the local microphone and frames from a phone.
Karaoke scoring and the Sing room first; exercises and the night rooms after.

### 4.6 The phone's screen

A small "you are the microphone" screen, native and web: level meter, mute,
the current lyric line, keep-awake (the native app has the plugin; iOS Safari
stops capturing when the screen locks, and must say so), and a battery note.

### 4.7 Risks

- **Bleed.** The phone hears the TV's speakers, so in the singer's silences it
  can detect the backing track's pitch. A clarity gate (jam uses 0.2) and
  holding the phone close handle most of it. Later, the TV can send its
  reference pitch so the phone rejects frames that match it.
- **One media pipeline.** A TV gives its media pipeline to one element at a
  time ([MISTAKES.md](../agent/MISTAKES.md)). Remote pitch carries no audio,
  so the TV plays nothing extra and the rule is not at stake here. It is in
  the Jam prototype (§5): Jam plays each peer through its own `<audio>`, so
  with a backing track playing on the TV, the phone's voice may pause it.

---

## 5. Try first (hardware, about a day)

Record results here.

1. **The LG TV's browser.** Open mercurypitch.com. Settings → Display &
   Controls → Graphics Quality says what was detected. Try the D-pad (before
   this change ships, Up and Down change the speed on most tabs), and a USB
   microphone if one is to hand: the browser may do what an LG app cannot.
2. **Jam as a phone-mic prototype, with no code.** Host a Jam room in the TV
   browser (a room opens with an empty stream, so the TV needs no mic) and
   join from the phone. Sing: does the TV draw the phone's pitch trail
   smoothly, and how late? It also shows whether that browser has WebRTC.
   Leave the TV's own playback off: Jam plays the phone's voice through a
   second media element (§4.7).
3. **The Philips Google TV.** Sideload the latest debug APK and launch it with
   `adb shell am start -n com.irchiinnuss.mercurypitch/.MainActivity` (there
   is no launcher tile before phase 3). Drive it with the remote; plug in a
   USB microphone and sing in Karaoke.
4. **The TV's storage.** Whether 16 MB is the quota once persistence is
   granted ([device-sync.md](device-sync.md)).

---

## 6. Order of work

Rough, focused-work estimates; store review is calendar time on top.

| Phase | What                                                                                                                                                                                                                                                                                                                                                                                        | Size                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0     | §5, on the TVs in the house                                                                                                                                                                                                                                                                                                                                                                 | a day                                  |
| 1     | TV-browser foundations, which every later phase inherits: Back and focus (§3.1), the mixer's stylesheet (§3.2), mic copy from phase 0's results, art capped by tier and the glow off on low, the rest of the handoff (§2), and the overview cache only if phase 0 asks for it                                                                                                               | ~2 weeks                               |
| 2     | The phone as the microphone (§4), on Karaoke and the Sing room                                                                                                                                                                                                                                                                                                                              | ~3 weeks                               |
| 3     | **Google Play for TV.** Manifest: a `LEANBACK_LAUNCHER` intent filter, `android.software.leanback` and `android.hardware.touchscreen` as `required="false"` (the microphone already is), a 320×180 `android:banner`. Store: a 1280×720 TV banner and TV screenshots. The native rail and corner tabs by D-pad; sync and phone sign-in back in native (§3.3); 64-bit and 16 KB pages         | ~1.5 weeks, plus 1–3 weeks review      |
| 4     | By audience. **Fire OS**: days on top of phase 3; no Google services (phone sign-in, Amazon billing in RevenueCat), and minSdk 29 leaves out Fire OS 7. **LG**: a packaged web build, Back 461, pointer and 5-way input, Chromium 79 as the floor; needs phase 2. **Samsung**: the same, plus a partner contract outside the US; needs phase 2. **Vega, Apple TV**: new shells, not planned | LG or Samsung ~2–3 weeks each, plus QA |

---

## 7. Open questions

1. **Payments on LG and Samsung.** Their stores take their own payments. Can a
   TV app honour a Mercury Pitch Cloud subscription bought elsewhere (sign in,
   use what you have)? Check each store's rules before building.
2. **Samsung's partner contract.** Only worth it with an audience outside the
   US that asks for it.
3. **Fire OS 7.** Lower minSdk to 28 for it, or leave those devices out?
4. **LG's Re:New upgrades.** Does an upgraded TV also get the newer web
   engine?
5. **Where the phone's microphone mode lives.** A mode of the Sing room, or
   a screen of its own?

---

## Sources

- Android TV distribution — <https://developer.android.com/training/tv/publishing/distribute>
- TV app manifest — <https://developer.android.com/training/tv/get-started/create>
- TV app quality — <https://developer.android.com/docs/quality-guidelines/tv-app-quality>
- `uses-feature` and implied features — <https://developer.android.com/guide/topics/manifest/uses-feature-element>
- Google Meet on Android TV, USB microphones — <https://support.google.com/androidtv/answer/10079968>
- Android USB audio — <https://source.android.com/docs/core/audio/usb>
- LG: apps cannot access audio — <https://forum.webostv.developer.lge.com/t/accessing-audio-data-stream/9355>
- LG: WebRTC for partner apps only — <https://forum.webostv.developer.lge.com/t/webrtc-getusermedia-webos-24/27587>
- LG web engines — <https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine>
- LG multi-sound playback — <https://webostv.developer.lge.com/develop/guides/multi-sound-playback>
- LG app approval — <https://webostv.developer.lge.com/distribute/app-approval-process>
- Samsung Seller Office membership — <https://developer.samsung.com/tv-seller-office/guides/membership/becoming-seller-office-member.html>
- Samsung web engines — <https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html>
- Samsung karaoke, Stingray only — <https://www.samsung.com/us/support/answer/ANS10007264/>
- Tizen 7 `getUserMedia` report — <https://forum.developer.samsung.com/t/tizen-7-webrtc-getusermedia-could-not-start-audio-source/41859>
- Fire OS overview — <https://developer.amazon.com/docs/fire-tv/fire-os-overview.html>
- Vega OS — <https://developer.amazon.com/apps-and-games/blogs/2025/09/announcing-vega-os>
- Philips 2026 line-up — <https://www.flatpanelshd.com/news.php?subaction=showfull&id=1775813562>
- Let's Sing companion app — <https://play.google.com/store/apps/details?id=com.voxler.letssingcompanionapp>
- Apple Music Sing, iPhone as microphone — <https://www.macrumors.com/2025/06/10/tvos-26-iphone-karaoke-mic-apple-music-sing/>
