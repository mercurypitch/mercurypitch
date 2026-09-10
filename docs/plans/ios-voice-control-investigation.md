# iOS voice control — VC-1, VC-2, VC-3

Status: **Step 0 has run, and the leading hypothesis below is wrong.** VC-1 is
not the doze. The recognizer starts successfully every time and then receives
no audio at all; the doze is what happens at the end of that, not its cause.
See [Step 0 came back](#step-0-came-back) — that section supersedes the two
that follow it.

The hypothesis section is kept rather than deleted because the reasoning that
made it plausible is still the reason not to book a device lab, and because
what falsified it took one evening with a phone.

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

## Step 0 came back

Run on 2026-09-10 by maff, on an iPhone, with `?voicelog=1`. The record, not
an impression:

**A healthy session first.** `start afterMs=1430`, `first-result
sinceStart=2895`, then a run of commands that all landed, ending with "go to
karaoke".

**Karaoke Night: nothing.** Zero voice lines for the whole document. Not a
finding about the app — an instrumentation gap. Karaoke Night is a separate
entry point and the recorder was only wired into the main one. All seven
entries are wired now.

**Walking back is where it dies.** One document, three sessions, no audio:

```
s1  start  afterMs=72     ...  sinceLastEvent=12001  ->  stale-replace
s2  start  afterMs=67     ...  sinceLastEvent=12001  ->  stale-replace
s3  start  afterMs=31     ...  sinceLastEvent=12001  ->  doze quiet=3 limit=3
```

Read that carefully, because it is the opposite of what everyone assumed.

- **The recognizer is not dead.** `start` fires in 31-72 ms, three times. On
  the healthy session it took 1430 ms. Starting is not the problem; starting
  is suspiciously _fast_.
- **It hears nothing whatsoever.** `sinceLastEvent=12001` means no event of
  any kind for twelve seconds — no result, no interim, no `error`, no `end`,
  no `nomatch`. A live session over silence.
- **The watchdogs work.** `stale-replace` fires exactly as designed, twice.
  It does not help, because the replacement is equally deaf.
- **The doze is the end state, not the cause.** `quiet=3 limit=3` is the
  listener correctly concluding that three sessions in a row heard nothing.

So this is Step 0's third outcome — recovers on neither — but with a
correction the outcome list did not anticipate: it is not a _silent death_.
It is a silent birth. Every session is born deaf.

### The likely cause: somebody else has the microphone

maff saw Firefox say **"microphone is used in another tab"** during the same
run, and mentioned old localhost tabs still open. That fits every line above:
`start()` resolves because the recognizer was constructed fine, and it then
gets an audio session that belongs to someone else, so no audio ever arrives
and no error is ever raised.

Our own capture is not the contender: `mic:idle` on every entry means
`MicManager` was holding nothing at the time.

This is why `probeMicrophone()` now runs on the `stale-replace` path and
records a `mic-probe` line. A `NotReadableError` or `AbortError` there names
the culprit outright; `free` means the microphone was available and the
recognizer refused to use it, which is a genuine WebKit bug and _then_ worth a
device lab.

### The retest, and the actual cause

A second device run on 2026-09-10, with every entry instrumented and
`audiostart` logged, contradicts the section above and settles it.

`mic-probe` came back **`free` every single time**. The microphone was never
held by anyone, so contention is out and the "used in another tab" message
was a red herring. `audiostart` **fired on every deaf session**, so the
browser claimed audio was flowing while none was.

What separates the sessions that worked from the ones that did not is neither
timing nor the microphone. It is **who started them**:

| `start-requested` at   | what started it                   | outcome                                    |
| ---------------------- | --------------------------------- | ------------------------------------------ |
| 3.63s, 11.28s          | a person tapping                  | `speechstart`, `first-result`, command ran |
| 0.00-0.03s (six loads) | the saved preference, during boot | `audiostart`, then nothing, ever           |

iOS hands a recognizer to a page the visitor has not touched, reports `start`
and `audiostart`, and then delivers no audio for the life of that session —
no `error`, no `end`. Voice control is a **remembered** preference and every
room here is its own document, so from the second page onward every session
was of the second kind. That is VC-1.

The fix is to decline to start into a document nobody has touched yet. The
gesture seam was already armed for other reasons, so with nothing running the
first touch takes the `recognition === null` path and starts a session the
platform will actually feed. Desktop keeps starting immediately: activation
is not a requirement there.

A second change landed with it, from the same record: the listener was
leaving a **live recognizer inside a frozen document**
(`pagehide persisted=true live=true`). It hands it back now and a thawed page
brings it up again. That one is not proven to matter on its own — the
activation gate may be the whole story — but a session running in a document
that is not on screen is wrong regardless.

Both are candidates until a device says otherwise. What to look for:
`awaiting-activation` on load, then `gesture-wake` on the first touch, then a
`start` followed by `speechstart` and `first-result`.

### Third run: the discriminator is the previous document

A longer device run on 2026-09-10 (179 lines, several rooms, both directions)
separates the sessions cleanly, and it is neither timing, nor the microphone,
nor who started the session:

| the document before this one                   | how this one opened | outcome            |
| ---------------------------------------------- | ------------------- | ------------------ |
| destroyed (`pagehide persisted=false`) or none | `how=reload`        | **worked, 3 of 3** |
| frozen (`pagehide persisted=true`)             | `how=navigate`      | **deaf, 5 of 5**   |

Two of the three that worked were started automatically at boot, from the
saved preference, with no user gesture at all. So **the activation hypothesis
is dead too** — it was tried, shipped, and the same run disproves it. A
`gesture-wake` session after a navigation was equally deaf, which is the same
point from the other side.

`mic-probe` said `free` on every single deaf session, so nothing else holds
the microphone. `audiostart` fired on every deaf session, so the browser
believed audio was flowing.

That leaves one story standing: **a frozen document goes on owning the
platform's speech recognition.** Every room here is a separate document, so a
navigation always leaves one behind; a reload destroys it and the next
document is fine.

The listener already hands the recognizer back on `pagehide` — that shipped
before this run and did not help. `abort()` at freeze time is evidently not
enough: the document stops executing before the platform finishes tearing the
session down.

**The next experiment, and it is one experiment, not a third guess.** Release
the recognizer _before_ the navigation starts rather than as the document
freezes, so the teardown has time to complete. Voice commands navigate through
`leaveForPage`, which is a single choke point. If the far side then hears
speech, the mechanism is confirmed and the remaining work is to cover
navigations we do not initiate. If it is still deaf, the frozen document is
innocent and the next suspect is the navigation itself.

### Fourth run: it is a race, and the start time gives it away

The navigate/reload split from the third run broke on the fourth: a session
that arrived by navigation **worked** — spoke, matched a command, executed it
— and then went deaf a few seconds later. So the frozen document is not the
rule either.

Counting every session in one day's relay, 90 of them, one number separates
them almost perfectly:

| `start afterMs` | heard audio | deaf   |
| --------------- | ----------- | ------ |
| under 400 ms    | 2           | **61** |
| 400 ms or more  | 11          | 16     |

Every session that ever heard speech started in **321 ms to 2.4 s**, most of
them over a second. Every deaf one clusters at **9 to 44 ms**.

That is the shape of a race, not a rule. Standing up an audio pipeline takes
the platform real time; when it hands one back in nine milliseconds it has
not done the work, and the session that follows fires `start` and
`audiostart` and then delivers nothing, forever, with no error. Sometimes the
platform is ready and the same navigation works — which is exactly why three
hypotheses in a row each held until the next run.

It also explains why nothing recovered. The stale timer waits twelve seconds,
then replaces the session **immediately** — and an immediate replacement is
precisely the one that comes back hollow. Three of those, thirty-six seconds,
and then the doze. The retry was feeding the failure.

**What changed.** A start under `HOLLOW_START_MS` (400 ms) is now put on
probation for `HOLLOW_GRACE_MS` (2.5 s). Any real sound clears it —
`audiostart` does not count, since a hollow session fires that too. Otherwise
it is logged as `hollow-start`, dropped, and respawned **through the quiet
backoff** rather than at once, which is the gap the healthy sessions all had.
Both the stale path and the hollow path now go through that backoff. Mobile
only: on desktop a fast start is a healthy one.

Detection goes from thirty-six seconds to under three, and the respawn stops
hammering a platform that is still busy.

**Fifth run: the detector works, the backoff was too short.** The record came
back with `hollow-start afterMs=81`, then `61`, then `4` — the detector firing
exactly as intended, in under three seconds each time instead of twelve. But
the replacements were hollow too:

```
hollow  ->  wait  600 ms  ->  start afterMs=61   ->  hollow
hollow  ->  wait 1200 ms  ->  start afterMs=4    ->  hollow
doze    ->  (about 4 s of nothing, then voice toggled off and on by hand)
                          ->  start afterMs=845  ->  speechstart, worked
```

So the wait is the remedy and it has to be measured in seconds, not
milliseconds. The quiet ladder (300 ms doubling) is far too short for this.
Hollow respawns now start at **3 s** and grow to a **9 s** cap, and a touch
does **not** cut that wait short — every other wait here is a politeness a
touch may end, this one is the fix itself.

Two more things the same record forced:

- **Hollow rollovers are counted apart from quiet ones.** They are different
  failures: a quiet rollover means the room said nothing, a hollow one means
  the platform never opened the microphone. Sharing a counter meant a touch
  after a hollow doze reset the quiet ladder too, turning "one session per
  touch in a silent room" into an endless respawn.
- **A touch after the doze restarts the hollow ladder.** Otherwise the first
  hollow session after waking pushes the count straight past the limit and
  dozes again with no retry — a dead end whose only exit is turning voice
  control off and on, which is precisely what the record shows someone doing.

What to look for next: `hollow-start` followed by a `restart-scheduled
delay=3000`, and then a `start afterMs` back **over 400 ms**. That is the
platform having caught up, and it is the whole hypothesis in one line.

### Sixth run: waiting is not the cure either, and the detector had a bug

The experiment the last section set up returned a clean **no**:

```
document-open how=navigate path=/guitar-night
  s1 hollow-start afterMs=220        ->  restart-scheduled delay=3000
  gesture-held (the touch was correctly held for the full wait)
  s2 start afterMs=9                 ->  hollow again
```

Three seconds of nothing running, and the next session still opened in nine
milliseconds. Leaving the platform alone is not what it wants, so that thread
is closed: 600 ms, 1200 ms and 3000 ms all fail the same way.

**The detector also had a false positive, and it was mine.** Killing a
session after 2.5 s of silence assumed a healthy one speaks sooner. In the
same day's relay healthy sessions reached `speechstart` at 1428, 1478, 2341,
2413, 2429, 2747, 3326, 3831, 3849, 3958, 4200 and **4938** ms — half of them
past the deadline. In a silent room there is no deadline at all: a good
session produces nothing for as long as nobody speaks. Any window short
enough to be useful kills sessions that were fine, which is what the phone
was showing — "paused, tap to enable" a second after entering a room, on a
session that had done nothing wrong. The invited tap was then held by the
backoff guard, so it did nothing either.

So the remedy is gone and `hollow-start` is **diagnostic only**. It writes
the line down and leaves the session alone; the stale timer keeps its old
job. The start-time signal is still real and still worth recording — 61 of 63
fast starts heard nothing — it is simply not something to act on without a
second condition nobody can bound.

### What is actually known, after six runs

- **Not the doze**, not another tab holding the microphone (`mic-probe` says
  `free`, every time), not a missing user gesture, not the frozen previous
  document on its own, and not a too-short wait.
- **`audiostart` fires on deaf sessions**, so the browser believes audio is
  flowing while none arrives.
- **Start time predicts it**: under 400 ms is hollow 97% of the time.
- **A full page reload always recovers it.** That is the only intervention in
  six runs with a perfect record.

### Replan: stop reasoning from first principles, start from what WebKit is known to need

Six runs of my own hypotheses produced four cures and no fix. The reason is
visible in hindsight: every one was reasoned from our own logs outwards,
when the failure is a documented platform quirk with documented workarounds.
Reading what other people have already learned about the Web Speech API on
iOS turns up **four concrete things this listener does that WebKit is known
to dislike** — and none of them is a guess about mechanism, they are just
things to stop doing.

| What we do now                                 | What the platform wants                                                                                                                                              | Where            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `new SpeechRecognition()` on **every** respawn | **One instance, reused.** Repeated construction is the specific thing reported to break iOS recognition                                                              | `spinUp()`       |
| `continuous = true`                            | `continuous = false` plus a restart on `onend`, unless push-to-talk. Continuous is reported to clog the buffer                                                       | `spinUp()`       |
| Nothing until the recognizer is started        | A `getUserMedia({audio:true})` **warm-up**, stopped immediately, on the first interaction — reported to fix exactly "the first recognition fails"                    | first gesture    |
| Keep the session while hidden                  | **Stop on `visibilitychange` to hidden.** Recognition dies when backgrounded, and our own record shows `error code=audio-capture` arriving the moment the page hides | `onVisibility()` |

The AudioContext unlock the same sources recommend is already in place
(`installAudioUnlock` at every entry).

The respawn count makes the first row the most suspicious by far. A quiet
room here can build dozens of `SpeechRecognition` objects in a minute —
every stale-replace, every quiet rollover, every gesture-wake — and the runs
where it worked are the ones where the FIRST object of a fresh document was
used. That is also why a reload always recovers: a reload is the only thing
that guarantees a first object.

**Order to try them, cheapest and most likely first:**

1. **Reuse one instance per listener.** Keep the object, call `start()` and
   `abort()` on it, and rebuild only when the platform actually rejects it.
   This is a real change to `spinUp`/`discard` and needs care around the
   handler nulling, which currently doubles as the identity check.
2. **Stop on hidden.** Small, obviously correct, and removes the
   `audio-capture` error our own record already shows.
3. **Warm the microphone once** on the first gesture, then release it.
4. **`continuous = false` with a restart on `onend`** — the largest behaviour
   change, and the one most likely to cost responsiveness, so last.

Each is independently testable on the device with the record we now have:
`start afterMs` back over 400 ms, followed by `speechstart`, is the pass.

**What NOT to do again.** No more remedies invented from our own logs alone.
The four above come from outside; if all four fail, the next step is a second
device on a different iOS version, not a fifth theory.

### Seventh run: item 2 done, item 3 not actually tried

Shipped together on 2026-09-10: **stand-by on hidden** (item 2) and a
**microphone warm-up** (item 3). The device log settles both, and only one of
them the way it looks.

| What the record showed                                                 | Reading                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Studio: `start afterMs=1494`, `audiostart 1935`, `speechstart 6682`    | A healthy session, and the pass condition met                      |
| Karaoke: `41.32s warm-up` and `41.32s spin-up` on the SAME millisecond | The recognizer went first. The warm-up had not finished — or begun |
| Karaoke: `start afterMs=36`, `audiostart 37`, then `hollow-start`      | Deaf, exactly as before                                            |

So **item 2 is done and did not fix VC-1** — the room still goes deaf after a
walk into it — and **item 3 was never tested**. The warm-up was written
fire-and-forget on the reasoning that a permission prompt nobody answers must
not stop voice control from starting. That reasoning is sound and the
implementation was worthless: the whole mitigation is that the microphone is
awake _before_ the recognizer asks, and starting them together tests nothing.

The warm-up now holds the first session back until `getUserMedia` returns,
with a `WARM_UP_TIMEOUT_MS` (1.5 s) ceiling so an unanswered prompt still
ends in a session. The line to read is **`warm-up-over afterMs=…`**: it is
proof the wait happened, and its value is how long the hardware took. A
`spin-up` on the same millisecond as `warm-up` means the build is old.

Item 3 is therefore still open, and item 1 — one reused `SpeechRecognition`
per listener — remains the most suspicious of the four.

### Two structural experiments, if the four above fail

1. **Destroy the previous document instead of freezing it.** Every deaf run
   followed `pagehide persisted=true`; every clean start followed a reload,
   which destroys. If the frozen document cannot finish tearing its
   recognizer down — it is not running, so its teardown callbacks never fire
   — that is consistent with everything above, including why waiting in the
   NEW document does nothing. Opt a document holding a live recognizer out of
   the back/forward cache and see. Costs back-navigation performance, so it
   is worth measuring before it is worth keeping.
2. **Offer the reload as the recovery.** When the deaf state is reached, the
   pill could offer to reload rather than pretend another session will help.
   Heavy-handed, and it loses whatever is in flight, so it needs the owner's
   call — but it is the one thing known to work.

### What is now worth doing, in order

1. **Reproduce with `mic-probe` in the record**, on the same device, with
   every other tab closed. One line decides between contention and WebKit.
2. **If it is contention** — the app cannot take a microphone away from
   another tab, but it can stop pretending to listen. A session that starts
   and hears nothing for twelve seconds is a state we can detect today; it
   should say "another app or tab is using the microphone" rather than dim a
   pill. That is a real fix regardless of what else is true.
3. **Only then consider WebKit.** And note the platform: the record says
   **iOS 18.7, FxiOS 155** — a shipping OS, not the iOS 27 beta the backlog
   entry assumed. The "retest on a device that is not running a beta OS"
   follow-up is answered; the bug is not a beta artifact.

Everything below predates this section.

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
`?voicelog=0` turns it off. Off for everyone else, always.

Each entry is also written as a `console.info` line, which is what makes the
record readable without a cable. Three ways to read the same thing:

1. **On the device.** `pnpm run dev:portable` shows the portable console, and
   the voice record lands in it along with everything else the page logged —
   which is how the mystery below got solved rather than guessed at. Tap it
   open, **Copy**, paste it back. See
   [DEVICE-DEBUGGING.md](../agent/DEVICE-DEBUGGING.md).
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
- Nothing at all after a healthy `start` — **this is what actually happens**;
  see [Step 0 came back](#step-0-came-back).
- `mic-probe result=...` — fired when a session is replaced for hearing
  nothing, and the single most useful line in the file. `NotReadableError` or
  `AbortError` means another tab or app holds the microphone. `free` means it
  was there for the taking and the recognizer would not use it, which is the
  one case that justifies a device lab.

**One correction to the list above.** It asks for `MediaStreamTrack.readyState`
and `.muted`. For the Web Speech path there is no such track to read: capture
happens inside the browser's recognizer and never through MicManager. The
`mic:` field reports the microphone the APP holds instead, which is the other
half of the same question — one documented failure shape is another consumer
taking the microphone.

**A second iOS device is no longer the priority.** That follow-up existed
because the one device ran an iOS 27 beta, making "iOS is broken" and "this
beta is broken" the same observation. The Step 0 record settles it: the
failure reproduced on **iOS 18.7 / FxiOS 155**, a shipping OS. Reproducing it
with every other tab closed is the cheaper and more decisive next step.

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
