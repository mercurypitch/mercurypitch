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

| Entry                           | What it says                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `page-hidden`, `page-visible`   | Playing or not, the song position, the clock's state and time; on the way back, how long the page was away and how far the clock moved |
| `clock-stuck`                   | After the return the song said it played on a clock that did not move; the first asks for the clock back, the second stops the run     |
| `stream-skip`                   | A stem fell more than a window behind the clock (the page or its decoder was paused) and picked up at the clock                        |
| `stream-retry`, `stream-failed` | A stem's decoder failed and was reopened; `stream-failed` is the one reopening did not fix, and the run stops with a notice            |

Sources: [`playback-return-watch.ts`](../../src/features/stem-mixer/playback-return-watch.ts)
and [`streaming-stem-voice.ts`](../../src/features/stem-mixer/streaming-stem-voice.ts).
