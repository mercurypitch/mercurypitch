# iOS voice control — VC-1, VC-2, VC-3

Status: **Step 0 is ready to run on a device.** This document exists because
the obvious next step — instrument the listener and take it to a device lab —
is probably the wrong one, and it would cost days to find that out.

The instrumentation described under "If it is not the doze" is now built, so
Step 0 comes back with a record rather than an impression. Turn it on with
`?voicelog=1`; see [Reading it off the device](#reading-it-off-the-device).

The reports are in the backlog (`TASKS.md`, third device pass, 2026-09-07/08).
Repeated here so this reads on its own:

- **VC-1 (P1)** — voice control dies on iOS after roughly a minute of silence.
  Retested on dev 2026-09-08 across Safari, Chrome and Firefox on one iPhone
  (iOS 27 beta). The first command after a fresh page load lands, **then the
  pill dims and nothing is heard again**. Android is flawless on the same
  build. The failure is silent: no `error`, no `end`.
- **VC-2 (P2)** — Chrome on iOS repeatedly shows its "microphone is on" popup.
- **VC-3 (P3)** — the iPhone sometimes recovers on its own after being left to
  rest.

## Read this before planning any work

The backlog entries propose instrumenting the listener, adding a watchdog for
sessions that die without `end`, and stopping the microphone being re-acquired
on every respawn. **All three already exist**, and every one of them shipped
_before_ the retest that reported the bug:

| Backlog proposal                                                 | Already in the code                                                                                            | Landed                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Watchdog for a session that fires no event                       | `STALE_SESSION_MS` (45 s), `VISIBLE_STALE_SESSION_MS` (12 s on phones), `GESTURE_STALE_MS` (10 s)              | `db81f296`, 2026-09-07 |
| Stop re-acquiring the mic on every respawn                       | quiet-session backoff doubling to `QUIET_RESPAWN_MAX_MS`, then `QUIET_ROLLOVER_LIMIT` (3) and doze             | `655e551c`, 2026-09-07 |
| Test: a session with neither `end` nor `error` must be respawned | `webspeech-listener.test.ts:606`, "replaces a confirmed session that has been silent for 45 s, without a word" | 2026-09-07             |

The last commit to `webspeech-listener.ts` is **2026-09-07**. The retest is
**2026-09-08**. So the hardening was in the build that failed, and rebuilding
it will not help.

`webspeech-listener.ts` is 698 lines whose header already documents four
distinct iOS behaviours it works around. Read that header first. Anyone
starting from the backlog entry alone will re-derive it.

## The leading hypothesis: VC-1 is the doze, seen from outside

This is cheap to test and, if right, removes most of the work.

On a device where a respawn is visible — every phone — the listener
deliberately stops respawning after three consecutive sessions that heard
nothing, and waits to be woken by a touch. That is the doze, and it was added
on 2026-09-07 to fix **VC-2**: WebKit ends a session after a few seconds of
silence, so a flat 300 ms respawn meant Chrome's microphone bubble every few
seconds.

Now line up the doze against the VC-1 report:

| VC-1 says                               | The doze does                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| "the pill dims"                         | `.dozing { opacity: 0.55 }` — `VoiceControlHud.module.css:99`, comment: "the pulse is gone and the glyph dims"      |
| "nothing is heard again"                | the timed respawn stops; only a touch starts a session                                                              |
| no `error`, no `end`                    | correct — there is no session to end, and nothing failed                                                            |
| "after roughly a minute of silence"     | three quiet WebKit sessions plus backoff, which is seconds, not a minute — **the one number that does not line up** |
| Android is flawless                     | Android's Chrome ends sessions on ~60 s silence, not seconds, so it rarely reaches three quiet sessions             |
| VC-3: recovers after being left to rest | picking the phone up is a touch, and a touch is exactly what wakes it                                               |

Six of seven fit without strain. And the state is close to invisible: when
dozing the pill renders a dimmed `<Mic />` whose only explanation —
"Voice paused — tap to resume" (`VoiceControlHud.tsx:152`) — lives in `title`
and `aria-label`. **A touch device never shows a tooltip.** So on an iPhone
the designed, recoverable, correct state is presented as a dimmed icon and no
words at all.

If that is what happened, VC-1 is not a platform bug. It is the doze being
mistaken for a death because the app does not say which it is on the one class
of device where the doze can happen.

The number that does not fit — "roughly a minute" — is the reason this is a
hypothesis rather than a conclusion. It may be recall rather than measurement,
or the ramp may be slower on a real device than the constants suggest. Step 0
settles it.

## Step 0 — falsify it, before anything else (about an hour, no lab)

On the iPhone, on dev, with voice control on:

1. Give one command so a session is confirmed live.
2. Stay silent until the pill dims. **Time it.** Seconds means the doze;
   a minute means something else.
3. With the pill dim, **touch anywhere in the app** — not the pill, not a text
   field — and speak a command.

The outcomes are exhaustive:

- **Recovers on a touch.** It is the doze. Go to "If it is the doze". No
  instrumentation, no second device.
- **Does not recover on a touch, but recovers on tapping the pill.** The wake
  path is broken, not the recognizer: look at the gesture listener and
  `EDITABLE_SELECTOR`, not at WebKit.
- **Recovers on neither.** A genuine silent death that the existing watchdogs
  do not catch. Go to "If it is not the doze".

Record which of the three it is, plus the time to dim, in the backlog entry.
That single line is worth more than everything below it.

## If it is the doze — a presentation problem

The doze is a real trade-off and should stay: the alternative is Chrome's
microphone bubble every few seconds, which is VC-2. What has to change is that
a phone never explains it.

Options, roughly increasing in cost:

1. **Say it on the pill.** The dimmed glyph gains a short visible label or a
   "tap to resume" affordance when `dozing` and the device is touch. Smallest
   change; removes the ambiguity entirely. Note the pill is deliberately small
   and docked — check `hud-placement.ts` before widening it.
2. **Wake on more than a touch.** A touch is currently the only wake. Page
   visibility already replaces sessions; consider whether returning to the tab,
   or any transport interaction, should also wake the ear.
3. **Tune the ramp for WebKit.** `QUIET_ROLLOVER_LIMIT = 3` was chosen so "the
   ambiguous ramp is a couple of seconds rather than most of a minute". If
   WebKit's silence-end is as short as the header says, three sessions is a
   very short fuse for someone who simply paused between commands. Raising it
   trades toward VC-2, so measure the bubble before and after.

Whichever is chosen, the test belongs next to the existing doze tests in
`webspeech-listener.test.ts` ("a room that stays quiet", line 396) and the HUD
assertion in `VoiceControlHud.test.tsx`. Assert the visible state on a touch
device, not the tooltip — the tooltip is the thing that failed.

## If it is not the doze — then instrument

Only worth doing once Step 0 has ruled the doze out.

**What to log.** The backlog is right that the current logs cannot tell a dead
recognizer from a live one hearing silence. Every `start` / `end` / `error` /
`result`, each stamped with:

- `AudioContext.state`
- `MediaStreamTrack.readyState` and `.muted` for any live track
- `document.visibilityState`
- which session id it belongs to, so a phantom and its replacement are not
  confused for one session

If the track goes `muted`, the fix is to watch `track.onmute` and re-acquire
rather than trust the recognizer — that is a real finding and worth the trip.

**How to read it off an iPhone from Arch Linux.** Safari Web Inspector needs
macOS, which we do not have, so the Android `adb forward` recipe has no direct
equivalent. Route 2 was built; `ios-webkit-debug-proxy` over `libimobiledevice`
remains the fallback if a CDP endpoint is ever genuinely needed, with the
caveat that iOS 27 is a beta and it is fiddly across releases.

## Reading it off the device

`?voicelog=1` turns the recording on and remembers it — which matters, because
Karaoke Night is a separate document and walking into it is a fresh page load.
`?voicelog=0` turns it off, as does **Stop** in the panel. Off for everyone
else, always.

Three ways to read the same record:

1. **On the device.** A bar appears at the bottom showing the last thing the
   ear did; tapping it opens the whole log, with **Copy** for pasting it back.
   It passes taps through everywhere except its own controls, and **Move up**
   flips it to the other edge — the pill it is used to watch lives in the
   header on a phone and in the bottom HUD elsewhere, so it will sometimes be
   in the way wherever it starts.
2. **On the dev server.** `MP_DEV_LOGS=1 pnpm run dev:host` relays every line
   to `.dev-logs/<date>.log`, which is the LAN case and needs nothing on the
   phone. Note the dev server is HTTPS with a self-signed certificate, and
   Web Speech needs a secure context, so the phone has to accept the warning
   once.
3. **`voiceDiagnosticEntries()`** from a console or a test.

What a line looks like:

```
0.00s s1 spin-up visibleRespawn=true hasBeenLive=false [visible mic:idle]
0.01s s1 error code=not-allowed live=false [visible mic:idle]
```

Elapsed seconds, the session number, the event, its detail, then the document
visibility and what the APP's microphone was doing. Session numbers matter: a
phantom and the session that replaced it are different numbers, and reading
them as one session is how this gets misread.

**What to look for**, in the order the outcomes above are written:

- `doze quiet=3 limit=3` — the doze. VC-1 is a presentation problem.
- `spin-up` with no `start` after it, then `stillborn` — the session never
  existed. Look at what `mic:` says on that line.
- `stale-replace` — a confirmed session went silent and was replaced.
- `gesture-wake` — the touch that brought it back, which is the VC-3 answer.
- Nothing at all after a healthy `start` — a shape none of the current
  watchdogs catch, and the one case that would justify the device lab.

**One correction to the list above.** It asks for `MediaStreamTrack.readyState`
and `.muted`. For the Web Speech path there is no such track to read: capture
happens inside the browser's recognizer and never through MicManager. The
`mic:` field reports the microphone the APP holds instead, which is the other
half of the same question — one documented failure shape is another consumer
taking the microphone.

**Get a second iOS device on a shipping OS.** The one device runs iOS 27 beta,
so "iOS is broken" and "this beta is broken" are currently the same
observation. This matters less if Step 0 says doze, which is our own code on
any OS.

## What not to do

- Do not add another watchdog. There are three, with distinct timeouts and
  reasons, and they are tested.
- Do not remove the doze to fix VC-1 without measuring VC-2 afterwards. They
  are two ends of one trade-off; the doze **is** the VC-2 mitigation.
- Do not treat VC-2 as separate work until VC-1 is settled. If VC-1 is the
  doze, VC-2 is already mitigated and the question is only whether the ramp is
  tuned right.
- Do not start from the backlog entry. Start from the header comment in
  `webspeech-listener.ts`.

## Files

| Path                                                      | What it holds                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/features/voice-control/webspeech-listener.ts`        | The ear. Header documents the four iOS behaviours; constants and their reasoning at lines 108-200. |
| `src/features/voice-control/webspeech-listener.test.ts`   | 902 lines, including the doze ("a room that stays quiet") and silent-death cases.                  |
| `src/features/voice-control/VoiceControlHud.tsx`          | The pill. `dozing()` at 126, its copy at 152 and 186.                                              |
| `src/features/voice-control/VoiceControlHud.module.css`   | `.dozing` at 99 — the dimming the report describes.                                                |
| `src/features/voice-control/useVoiceControlController.ts` | Where `dozing` is grouped with `idle` and `error` (482).                                           |
| `docs/plans/voice-control.md`                             | The feature's own plan; phases and architecture.                                                   |
