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

The one thing that breaks the elimination is a call site that stops being a
plain `if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true')` — assigning it
to a variable first, or hiding it behind a function, leaves the bundler
unable to prove the branch is dead. The assert is what catches that.

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
