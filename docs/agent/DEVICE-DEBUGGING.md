# Debugging on a device you cannot plug in

Some bugs only exist on a phone. Voice control, `getUserMedia`, the page
transitions between this app's separate documents, iOS Safari's own
lifecycle — none of them reproduce on a desktop browser, and reaching
Safari's inspector means a cable, a Mac, and a page that is still alive when
you get there.

Three tools, in order of how far they reach. Use the smallest one that can
see the bug.

| Tool                              | Reaches                                  | You read it            |
| --------------------------------- | ---------------------------------------- | ---------------------- |
| `pnpm dev`                        | This machine                             | Devtools               |
| `MP_DEV_LOGS=1 pnpm run dev:host` | A device on the same network             | `.dev-logs/<date>.log` |
| `pnpm run dev:portable`           | Any device, anywhere, including deployed | A panel on the device  |

## The portable console

`pnpm run dev:portable` is `dev:host` plus `VITE_PORTABLE_CONSOLE=true`,
which puts a panel on the page itself: one line collapsed (the newest
entry), the whole capture when tapped, with a filter and a Copy button.
The tester pastes it back to you.

It captures `console.log/info/warn/error/debug`, `window.onerror` and
unhandled rejections, each stamped with milliseconds since the first line.

**It survives page loads.** Several rooms here are separate documents —
walking into Karaoke Night is a full page load — so the capture is mirrored
into `sessionStorage` and the elapsed clock continues from where the last
document left it. A log spanning three documents reads as one timeline,
which is the only way to see what a transition did. Without this the buffer
is empty on the far side of the one transition worth watching; that is not
hypothetical, it is what a phone reported on 2026-09-10.

`?console=0` hides the panel for the rest of the session (`?console=1`
brings it back), for when it is standing in front of the thing being
tested. Hiding it does not stop the capture.

Minimised still leaves a dot on every screen. A native test build has a
switch for that: Developer → Debug console → "Show the debug console".
Off draws nothing at all, which is what a screen recording for a store needs
(the picture-in-picture window, background playback); the capture goes on,
and turning it back on returns the panel with everything it saw. It is
remembered across launches (`mp:portableConsole:onScreen`).

The panel deliberately passes taps through everywhere except its own
controls, and flips between the top and bottom edge in one tap. Both
placement traps that forced this are written up in the header of
[`src/components/PortableConsole.tsx`](../../src/components/PortableConsole.tsx)
— read it before moving the thing.

## Why it cannot reach a visitor

The gate is a **build** flag, not a runtime one. Vite substitutes
`import.meta.env.VITE_PORTABLE_CONSOLE` at build time, so an entry writes

```ts
if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')
  void import('@/components/PortableConsole').then(...)
```

and a normal build folds that to `if (false)`, drops the branch, and never
pulls the module into the graph. There is nothing to leak, and no wrapped
`console` in a visitor's tab.

A runtime guard would not do: it still ships the code.

**Read the flag inline; do not lift it into `lib/defaults.ts`.** That is the
obvious tidy-up and it costs a room its first paint: `defaults` is pinned
into the `pitch-core` chunk, so importing one boolean from it drags that
whole chunk — the notifications store included — into every standalone
entry's static graph, and `assert-piano-night-bundle.mjs` fails on it.

`scripts/assert-no-portable-console.mjs` greps `dist` for the module's
fingerprints and fails the build if it finds them. Every script that writes
`dist` runs it — `build`, `build:dev`, `build:tours`, `build:e2e`,
`build:e2e:devices`. **A new build script must run it too.**

The native app is the one exception, on purpose. `apps/mercurypitch/.env`
turns the console on, so every test build (TestFlight, the debug APK, a
laptop build) carries it and the Developer screen behind it. The store build
carries neither: `MERCURYPITCH_API_TARGET=production` compiles them out
whatever the env says (`portableConsoleFor` in `apps/mercurypitch/api-base.mjs`),
and `mercurypitch-mobile.yml` runs the same assert over that store binary,
with `--store-binary` (below).

The one thing that breaks the elimination is a call site that stops being a
plain `if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')` — assigning it
to a variable first, or hiding it behind a function, leaves the bundler
unable to prove the branch is dead. The assert is what catches that.

## Which console is in which build

Three consoles and a screen, easy to confuse. Only the inline log ships
everywhere.

| What                                                      | Web                                   | Native test build | Native store build |
| --------------------------------------------------------- | ------------------------------------- | ----------------- | ------------------ |
| Portable console (`PortableConsole.tsx`)                  | `pnpm run dev:portable` only          | yes               | no                 |
| Developer screen (`DeveloperScreen.tsx`)                  | no                                    | yes               | no                 |
| Floating developer console (`FloatingConsole.tsx`)        | yes, armed from its switch            | yes               | no                 |
| Inline log (`ConsoleLog.tsx`), the crash card's View Logs | yes, and in Settings under the switch | yes               | yes                |

The floating console's switch is `pitchperfect_developer_console`, turned on
in Settings' developer tools (a development build) and read by
`armDeveloperConsole()` on every web entry. The native entry arms it only
inside its `VITE_PORTABLE_CONSOLE` branch, with a dynamic import, like the
Developer screen's sections. The native app's own Settings has no switch for
it, so on a test build it is not mounted unless the key is set by hand.

The web ships the floating console, so the default assert cannot name it.
`assert-no-portable-console.mjs --store-binary` adds its fingerprints (its
test id, its `<body>` host, the switch's key), and the store binary's CI step
passes that flag. Four things keep it green; each one was needed:
`ConsoleLog.tsx` must not import `FloatingConsole.tsx`, since the crash card
brings it into every build; the switch lives in its own store, apart from
the log the error handler feeds; settings sync names the key only where the
panel exists; and the native Vite config declares the panel and its switch
free of side effects, because `App.tsx` folds the web Settings panel out of
the native build but a folded import still runs the module it names.

## Serving over plain HTTP

The dev server is HTTPS with a self-signed certificate, because Web Speech
and `getUserMedia` need a secure context. A human can accept the warning
once; an automated browser cannot click through it. `MP_DEV_HTTP=1` exists
for that case only, and disables exactly the APIs you probably came for.

## Feature-specific recorders

The portable console shows what was logged. When a feature needs structured
evidence instead — every state change of one subsystem, in order, with the
environment at each step — it gets its own recorder. `?voicelog=1` turns on
[`voice-diagnostics`](../../src/features/voice-control/voice-diagnostics.ts),
which records what the speech recognizer did without ever recording what the
singer said. That one is off by default and remembered across page loads;
copy the shape if you build another.

The audio record ([`audio-diagnostics`](../../src/lib/audio-diagnostics.ts))
is always on: one `[audio]` console line per step a sound takes, and the
Developer screen's Audio section copies the lot. For a Karaoke song kept
playing behind another app, its `karaoke` entries say what the way back
looked like:

| Entry                           | What it says                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-hidden`, `page-visible`   | Playing or not, the song position, the clock's state and time; on the way back, how long the page was away and how far the clock moved                                                                                                                          |
| `play`                          | A press of play: the clock's state before it (`clockWas`) and the song position                                                                                                                                                                                 |
| `statechange`                   | The clock changed state while the room watched it, and whether the page was hidden; on iOS `interrupted` means a call, Siri, another app or the trip to the background took the sound, and a playing song pauses with it unless it keeps playing behind the app |
| `background-resume`             | The interruption that comes with the app going to the background, resumed for a song that keeps playing there; `hiddenForMs` is how long the page had been hidden                                                                                               |
| `suspend-fade`                  | The shared clock was about to stop (the app leaving with nothing to keep the song playing), so the playing song paused with its fade first                                                                                                                      |
| `clock-stuck`                   | The clock did not move after a press of play (700 ms) or after the return; the first restarts the clock, the second stops the run with a notice                                                                                                                 |
| `clock-restart`                 | The clock was suspended and resumed (or resumed from stopped) to bring its sound back                                                                                                                                                                           |
| `stream-skip`                   | A stem fell more than a window behind the clock (the page or its decoder was paused) and picked up at the clock                                                                                                                                                 |
| `stream-retry`, `stream-failed` | A stem's decoder failed and was reopened; `stream-failed` is the one reopening did not fix, and the run stops with a notice                                                                                                                                     |

Sources: [`playback-return-watch.ts`](../../src/features/stem-mixer/playback-return-watch.ts),
[`useStemMixerAudioController.ts`](../../src/features/stem-mixer/useStemMixerAudioController.ts)
and [`streaming-stem-voice.ts`](../../src/features/stem-mixer/streaming-stem-voice.ts). On iOS the
app's own plugin adds `[audio session]` lines beside them: another app's sound
starting and stopping, interruptions and routes, each with the time iOS said it
([`ios-audio-handoff.md`](../plans/mobile-native/ios-audio-handoff.md)). WebKit
plays in its own process, so "another app's sound" right after a play or a
pause of ours is the song itself.

A test build adds what a premium room's sound goes through, so the owner can
walk a scenario (a room, the mic, AirPods, a call, the lock screen) and send
the report: More > Developer > Audio, then Copy report or Share report, and
Clear log before the next scenario. Each line starts with the phone's clock
(the report says the day), the newest 1000 are kept in memory and the newest
500 across a restart ([`audio-log-store.ts`](../../apps/mercurypitch/src/shell/audio-log-store.ts)),
and the report opens with the app's version and build, the phone, iOS, the
app's session, the outputs, the page's session type and "One volume in
rooms". Sources: [`audio-census.ts`](../../apps/mercurypitch/src/shell/audio-census.ts)
and [`audio-record.ts`](../../apps/mercurypitch/src/shell/audio-record.ts).

| Source    | Lines                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room`    | `enter`, `leave`: the room, the switch (`oneVolume`) and what the visit asked WebKit for (`asks`), and on leaving how long it lasted. `release-hidden`, `reclaim-visible`: the type given back as the page went away and asked for again as it came back, and what moved it (`on=visibilitychange`, `pagehide`, `pageshow` or `app-active`). Control Center and the notification shade give nothing back: the page stays in front under them |
| `session` | `set`, `restore`, `kept`, `refused`: every change to `navigator.audioSession.type`, who asked, from and to, what WebKit kept where that differs (`reads`), and who holds it after. `state`: WebKit's word on the page's session, as it gives one                                                                                                                                                                                             |
| `census`  | `mic-opened`, `mic-stopped`, `mic-ended`, `context-made`, `context-state`, and `room-sound` with each sound's peak and RMS (`cut=true`: still sounding as the room closed)                                                                                                                                                                                                                                                                   |
| `output`  | `read at=...`, now and once `settled` a second later, at each mic, context, room, app and session step; `change reason=...` for a key, a route (`routeReason`, `previousOutputs`) or an interruption (`lastInterruption`, `appState`)                                                                                                                                                                                                        |
| `notice`  | `shown`, `hidden`: the words, the cause, and the reading that decided it (`volume`, `known`, `system`, `live`, `settled`, `session`)                                                                                                                                                                                                                                                                                                         |
| `demo`    | `card`, `playing`, `end`, `idle`: each turn of the open room's demo                                                                                                                                                                                                                                                                                                                                                                          |
| `app`     | `launch`. `background`, `foreground`: the page going behind and coming back. `inactive`, `active`: iOS's word on the app. An `inactive` with no `background` after it is Control Center or the notification shade pulled over the app                                                                                                                                                                                                        |
| `log`     | `restored`: where the last launch's lines end. `cleared`: Clear log                                                                                                                                                                                                                                                                                                                                                                          |

Reading one: a `systemVolume` that differs between an `output read` and its
`settled` line, beside a `session set` or a `mic-opened`, is WebKit moving the
sound to another of iOS's stored volumes. `known=session` means the volume was
the app's session alone, which the notice never calls zero
([`volume-hint.ts`](../../apps/mercurypitch/src/shell/volume-hint.ts)).

The iOS lock screen's carrier
([`webkit-now-playing.ts`](../../packages/mobile-runtime/src/webkit-now-playing.ts))
writes `[now playing]` lines, and the lyrics window `[lyrics window]` ones:

| Line                                                                   | What it says                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `bar at 61.5 s of 246.0, playing`                                      | The place each report gave the lock screen's bar. A bar seen at 0:00 with no line at 0 was moved by WebKit, not the room |
| `play waited while the app slept: dropped`                             | A press iOS held while the app was frozen, let go as the app came back                                                   |
| `play came as the app woke behind another app: carried out`            | A press that may have waited, but the app stayed behind: it was the singer's                                             |
| `play from behind the app took the sound from another app`             | A play from the window or the lock screen took the sound from the app in front                                           |
| `play pressed, but another app keeps the sound: the song stays paused` | iOS refused it: the song stays paused rather than play in silence                                                        |
| `play pressed behind another app whose sound plays: ...`               | A play from the window behind that app's sound, refused at once: iOS would refuse it                                     |
| `the bar is where it was: put on to 0.25 s, ...`                       | A jump to where the bar already was, moved a hair so the lock screen's counter starts again                              |
| `the long carrier would not load; ...`                                 | This WebView refused the hour of FLAC silence, so the bar may jump to 0:00 again                                         |
| `[lyrics window] play waited 12 s while the app slept: dropped`        | The same as the first, for the window's buttons                                                                          |

The two about the sound end with WebKit's own session state before and after
the press, as `(session inactive, then active)`.

A drag of the lock screen's bar that springs back, or a 10 s button that does
nothing, leaves no line: WebKit refused it before the page heard anything,
because the carrier was not the sound that started last
([`carrier-in-front.ts`](../../packages/mobile-runtime/src/carrier-in-front.ts)).
A press the room did hear moves the bar, and the next `bar at` line says where.

The Cloud subscription keeps its own record on a test build
([`subscription-timing.ts`](../../apps/mercurypitch/src/shell/subscription-timing.ts)):
every Subscribe, Restore purchase and carry after a sign-in, timed by store
step (`initialize`, `identify`, `logIn`, `getOfferings`, `getCustomer`,
`purchase`, `restore`), then how long after the store's yes the app heard
that the server had the songs. Each flow is one `[subscription]` line, and
the Developer screen's Cloud subscription section lists the last eight, with
Copy timings. "no songs ... after the store's yes" means the app stopped
asking (about half a minute of asking) before RevenueCat's webhook reached
the server, and Settings says Not subscribed until something asks again. A
store build carries none of it (`assert-no-portable-console.mjs
--store-binary`).

## A TestFlight Subscribe that asks for the password

A Subscribe or a Restore purchase in a TestFlight build ends in Apple's
purchase sheet, and there it asks for the Apple Account password every time.
TestFlight purchases run against Apple's sandbox, where Face ID and Touch ID
do not authorise a purchase (Apple's answers on the developer forums,
[thread 96990](https://developer.apple.com/forums/thread/96990) and
[thread 49940](https://developer.apple.com/forums/thread/49940)). The same
build from the App Store takes Face ID as usual, so a singer rarely sees the
prompt at all.

The sheet and its prompt are drawn by iOS, in a process of its own. The app
hands RevenueCat the purchase and waits (the `purchase` step in the timings
above); nothing in the web view, the Keyboard plugin or the native shell can
reach the prompt. A password manager's AutoFill can fail inside it: its
keyboard never comes up, or its Face ID does not answer. The owner hit it on
TestFlight mp-v0.8.40 (2026-10-22). The App Store app's own Get button does
the same ([bitwarden/ios#3093](https://github.com/bitwarden/ios/issues/3093)),
so it is an iOS limit, not this app's bug.

For a tester: type the password, or copy it from the password manager before
pressing Subscribe and paste it into the prompt.

## A crash only in a Play build

The Android build Play installs is shrunk and renamed by R8
(`apps/mercurypitch/android/app/build.gradle`); the debug APK is not. A crash,
or a plugin call that does nothing, in a Play build and never in the debug APK
is most likely code R8 removed or renamed because only reflection reached it.
Play Console's crash reports show the real names: the bundle carries R8's
mapping. The fix is a keep rule in
`apps/mercurypitch/android/app/proguard-rules.pro`; the rules each plugin
brings itself are in its `android/` folder (`consumerProguardFiles`).

To try a release build on a phone, install it from Play's internal testing
track. Sideloading the release APK means uninstalling the debug build first
(they are signed with different keys), and that deletes what the app keeps on
the phone.

## Beside Cue game test builds

Beside Cue now reuses `src/components/PortableConsole.tsx` and its capture library.
The native games profile enables it for iOS/Android testing; release tags force it
out, and the Vite build checks the emitted bundle with
`assert-no-portable-console.mjs --store-binary` whenever capture is disabled.
The stable `glass-playtest.ts` LAN server enables it too. Its literal import gates
in the app and standalone museum entry preserve dead-code elimination.

The small bottom-corner handle opens the same filter, Copy, Clear, Move and
Minimise controls. Native test captures retain the bounded log on this device
across WebView restarts; browser previews keep each tab's session log. Clear
removes the retained capture. No report is uploaded automatically. Reports include
Beside Cue's baked build stamp and graphics context events. Renderer failures
report bounded scene/stage information, and narration failures report a fixed
cue/stage/reason without recording microphone input.

A terminated iOS process cannot execute a final JavaScript callback. Reopen the
app and copy the retained log; the last recorded error can help diagnosis, but
absence of an error does not rule out an OS memory termination. App Store crash
and device memory logs remain separate evidence.
