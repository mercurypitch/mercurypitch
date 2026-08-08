# Agent mistakes — living log

Things that went wrong, and the rule that came out of each. This is the
highest-value document in `docs/agent/` because none of it is recoverable by
reading the code: it is the record of what the code _looks_ like it does versus
what it actually does.

**Read this before a first change in an unfamiliar area.** Skim the headings;
read the entry only if it touches your area.

---

## How to add an entry

Append when you (agent or human) hit something that cost real time and would
cost the next person the same. One entry, newest at the bottom of its section.

```markdown
### <Short imperative rule — the fix, not the symptom>

**Symptom:** what it looked like when it went wrong.
**Cause:** the actual mechanism.
**Rule:** what to do instead.
**See:** `path/to/file.ts:123`
```

### What qualifies

- A bug that shipped, or nearly shipped, because the code read as correct.
- Time lost to a tool, environment, or framework behaving unlike its docs.
- A repeated correction — if you have been told the same thing twice, it goes here.

### What does not

- Anything the type system or a lint rule already catches. Add the rule instead.
- One-off typos, or a mistake specific to a single ticket.
- Style preferences. Those belong in [CONVENTIONS.md](CONVENTIONS.md).
- Architecture description. That belongs in [INDEX.md](INDEX.md).

### Hygiene

Keep entries under ~8 lines. When an entry is made impossible by a lint rule, a
type, or a test, delete it and note the guard in the commit message — a mistake
that can no longer happen is noise. If this file passes ~400 lines, the oldest
entries have probably become guards; prune rather than append.

---

## Audio and microphone

### Never flip the page mic indicator from a non-page consumer

**Symptom:** after using the Karaoke stem mixer, the Singing tab's mic toggle
was stuck in the wrong state.
**Cause:** `mic-store`'s `micActive` is a _page-facing indicator_, not device
truth. Consumers like the stem mixer and jam hold the device under their own
ids via MicManager; bridging them into `micActive` corrupted the shared flag.
**Rule:** device ownership goes through `@/lib/mic-manager.ts` with your own id.
Only the page's own practice/analysis controller writes `micActive`.
**See:** `src/stores/mic-store.ts`

### Release the mic unconditionally on unmount

**Symptom:** mic stayed hot after navigating away; the OS indicator stayed lit.
**Cause:** release was inside a conditional that did not run on every teardown path.
**Rule:** every surface that acquires the mic calls `registerMicIndicator` and
releases in `onCleanup` with no guard. Ask bug reporters for
`window.__micSentinel.dump()`.
**See:** `src/lib/mic-sentinel.ts`

### Unlock the AudioContext before any playback path

**Symptom:** playback silently did nothing, no error in the console.
**Cause:** browsers keep the AudioContext suspended until a user gesture.
**Rule:** route every start through `activateAudioPlayback`.
**See:** `src/features/playback/usePlaybackController.ts`

### A WhisperSegment is a word, never a lyric line

**Symptom:** the stem mixer's "Transcribe" gave a spot-on word alignment while
"Generate lyrics from vocal" — same hook, same run — filled the editor with
hundreds of one-word lines.
**Cause:** the worker asks for `return_timestamps: 'word'`, so every segment is
a single word. The alignment path knew that; the lyrics path emitted one LRC
line per segment.
**Rule:** group with `groupWhisperWordsIntoLines` before showing segments as
lyrics. Per-transcription hallucination guards do not catch junk confined to
one stretch of a song — judge a _line_, not the whole result.
**See:** `src/lib/whisper-lyrics.ts`

### Compare mic warnings with the detector's real amplitude gate

**Symptom:** a nearly full input meter and working pitch trace appeared behind
an “input too weak” warning.
**Cause:** every audible-but-unpitched frame was labelled weak, the meter used
a visual 4× gain, and the warning lingered after detection recovered.
**Rule:** compare raw RMS with the consumer's active detector gate when it can
expose one, only warn while playback expects singing, and clear immediately
when the evidence recovers. Never guess a gate for another detector.
**See:** `src/features/mic-feedback/useMicInsights.ts`

### A looping stage's lap index cannot come from elapsed time

**Symptom:** the Zen exercise sounded its guide notes on the first pass and
went silent on every pass after it, for the whole session.
**Cause:** the per-lap dedupe key was built from
`floor(elapsedSec / loopDurationSec)`. A looping session resets `elapsedSec` at
each seam, so elapsed never reaches a full lap and that expression is
permanently `0` — lap two reused lap one's keys and found every target already
played. The code reads as if it counts laps; it counts nothing.
**Rule:** take the lap index from the session's own counter
(`loopsCompleted()`), never from a time that is reset per lap. If a signal is
zeroed at the boundary you are trying to detect, it cannot detect it.
**See:** `src/features/zen/note-playback.ts`,
`docs/specs/zen-exercise-playback.ears.md`

### Sample note playback by start crossing, not by "is it active now"

**Symptom:** dense or fast phrases played partially and stopped, as if timing
out.
**Cause:** the scheduler fired a note only when a sample landed inside its
window. The Zen samples come from mic frames throttled to ~33 ms and stall
under load, so whole notes fell between two samples and never sounded — the
same defect `lib/playback-runtime.ts` had fixed for the piano roll.
**Rule:** fire anything whose start lies in `(previousSample, thisSample]`, and
never back-fill across a discontinuity — a lap seam, pause, resume or re-arm
resets the floor. The mirror-image bug is replaying a whole lap at once.
**See:** `src/features/zen/note-playback.ts`, `src/lib/playback-runtime.ts:76`

## Framework

### Do not destructure props

**Symptom:** a prop updated in the parent, the child never re-rendered.
**Cause:** destructuring reads the value once; Solid's reactivity is in the getter.
**Rule:** take `props` and read `props.x` at the use site.

### Read signals synchronously, before going async

**Symptom:** "computations created outside a `createRoot`" warning; stale values.
**Cause:** calling an accessor inside an async callback runs it detached from the owner.
**Rule:** capture the value first, then start the async work.

### `PlaybackRuntime.on('state')` passes an event object, not a state string

**Symptom:** pause detection never fired; the comparison always failed.
**Cause:** the handler argument is the whole event, so `arg === 'paused'` is never true.
**Rule:** use the `isPlaying` / `isPaused` signals from `playback-state-store`.

### Never pin an inline canvas `width`

**Symptom:** canvas rendered at the wrong scale after a resize or DPI change.
**Cause:** a hardcoded attribute fought the size-sync logic.
**Rule:** use `@/lib/canvas-size-sync.ts`.

### Never use `<header>` or `<footer>` for page content

**Symptom:** page content picked up unexpected global styling.
**Cause:** global CSS rules target those tags for app chrome.
**Rule:** use a `div` with a class. Pages inside `.main-content` also need
`flex-shrink: 0`.

### An aborted run is not a result

**Symptom:** a transcription torn down after 2 of 18 chunks reported
"hallucination detected", deleted the session's cached transcription and blamed
the model. The same audio transcribed perfectly a minute later.
**Cause:** the chunk loop set a local `aborted` flag that only one of the exits
read. The truncated prefix fell through to the quality guard, which judged it
as the model's output.
**Rule:** a cancelled or torn-down async run returns before it reports, caches
or judges anything — and carries the abort in its _return type_, not a local
flag every exit has to remember. Teardown must also settle what it cancels:
`worker.terminate()` leaves pending promises hanging forever.
**See:** `runWhisperChunkPlan` in `src/lib/useWhisperTranscription.ts`

### Do not gate account UI on a fetch — the token answers synchronously

**Symptom:** for the first second after load the app behaves as though nobody
is signed in; a signed-in singer gets offered "Create a free account", and the
button leads somewhere with nothing to do.
**Cause:** the component waited on a profile/DB round trip to decide whether an
account exists. It does not need to: the JWT is already in `localStorage` and
decoding it is local work. `hasUpgradedAccount()` in `auth-service.ts` answers
on the very first render, with no network.
**Rule:** use `accountHeld()` (`auth-service.ts`) inside components. It reads
`authVersion()` first, so it is both synchronous _and_ reactive — right on the
first paint, and self-correcting the moment someone signs in or out. Reserve
async profile loads for profile CONTENT (display name, avatar, stats), never
for the yes/no of "are they signed in".
**Related:** put the check at the shared seam, not at each call site.
`shouldShowNudge()` now refuses every account nudge when an account exists —
the one call site that forgets is exactly the one that ships.
**See:** `accountHeld` in `src/db/services/auth-service.ts`,
`shouldShowNudge` in `src/features/onboarding/account-nudge.ts`

### An 'i' or '?' popover needs a portal and three closers

**Symptom:** the info panel stays open after clicking elsewhere and after
navigating to another tab, where it hangs over the new screen; the first card
in a row opens its panel past the container edge and the text is cut in half;
the sidebar draws straight over it.
**Cause:** all three come from the same instinct — build the panel _inside_ the
card it belongs to, with a `<details>` or a boolean signal and absolute
positioning. Inside the card it cannot escape the card's `overflow` (clipping)
or its stacking context (the sidebar wins at `z-index: 200`), and a `<details>`
has no concept of "someone clicked somewhere else".
**Rule:** use `InfoPopover` (`src/components/InfoPopover.tsx`). Do not hand-roll
another one. What it does, and what any replacement must also do:

- **Portal the panel to `<body>`** and position it `fixed` from the trigger's
  `getBoundingClientRect()`. No ancestor can then clip it or bury it.
- **Clamp to the viewport** on both axes, and flip above the trigger when there
  is no room below. Centring on the trigger is not enough — the leftmost card
  in a grid still overflows.
- **Close on all four:** outside `pointerdown` (capture), `Escape`, scroll
  (capture — a panel positioned from a stale rect ends up stranded), and
  unmount. The unmount one is what stops it surviving a tab change.
- **Remove every listener in `onCleanup`.** A document-level listener that
  outlives the component is a leak that fires against a dead signal.
- **Sit below modals.** `z-index: 9000` clears the sidebar and app chrome;
  dialogs and notifications at 10000+ should still win.

**See:** `src/components/InfoPopover.tsx`, and the badge hints in
`VocalChallenges.tsx` for a call site.

## Performance

### Do not iterate an audio buffer per-pixel in `requestAnimationFrame`

**Symptom:** severe frame drops on long files.
**Cause:** `samples.length / width` iterations per pixel, per frame — hundreds
of millions of operations.
**Rule:** precompute a min/max peak mipmap in `Float32Array` blocks at load
time and draw from that. Also avoids the moiré banding that sample-skipping
produces at some zoom levels.

### A `manualChunks` group erases the `await import()` it contains

**Symptom:** 2.16 MB of alphaTab + the WASM AAC encoder shipped on the first
paint of every entry — including the standalone ones built to stay small —
although both were reached only through `await import(...)`, and one said so in
a comment.
**Cause:** naming a chunk merges modules. If _any_ module in the group has a
static importer, Rollup makes the whole chunk a static dependency of the entry
and emits a `<link rel="modulepreload">` for it. The dynamic boundary in the
source stops existing. Same bug hit `vendor-gpu`: `wgpu-matrix`, imported by
the 2D _fallback_ renderer, dragged the whole TypeGPU stack in with it.
**Rule:** a dependency you deliberately load dynamically gets its OWN chunk
name, never a shared one. Verify with `ANALYZE=1 pnpm build` and then
`grep <chunk> dist/*.html` — absent from every entry HTML is the only proof.
**See:** `vite.config.ts` `manualChunks`; `src/lib/jam/stem-encoder.ts:36`.

## Data and billing

### Hydrate a durable job before trying to resume it

**Symptom:** a standalone route found an already-paid in-flight separation but
retry remained stuck forever.
**Cause:** IndexedDB had the provider job id while the tab's app-lifetime cache
was stale; the resume scanner only inspected that cache.
**Rule:** when durable dedupe finds an uncached job, hydrate that exact session
before invoking shared auto-resume.
**See:** `src/features/guitar-night/uvr-preparation-port.ts`

### Do not report terminal success before the record is durable

**Symptom:** separation appeared successful, then immediate catalog refresh
could not open the result.
**Cause:** stem writes completed but the terminal session-record write failed.
**Rule:** retain the completed cache for a cheap persistence retry, but return a
recoverable error and do not run completion handoffs until the record persists.
**See:** `src/lib/uvr-song-preparation.ts`

### Treat hibernated socket attachments as persisted authorization state

**Symptom:** a superseded Jam host could regain background controls only after
an overlapping reconnect and Durable Object hibernation.
**Cause:** host authority was updated in memory but remained true on two
serialized WebSocket attachments, so hydration chose by iteration order.
**Rule:** update memory, storage, attachments, and client signals as one state
transition; test live, overlapping, hibernated, departed, and expired paths,
and fail closed whenever reconstructed authority conflicts.
**See:** `workers/jam-worker/src/jam-room.ts`

### One completion event, one credit

**Symptom:** practice minutes counted twice for a single run.
**Cause:** two call sites both funnelled into the recording path.
**Rule:** `recordExerciseResult` and `endPracticeSession` are commit points —
call each exactly once per run. They fan out to minutes, challenges, routines,
badges and analytics.
**See:** `src/stores/exercise-history-store.ts`

### Every Worker route must be listed in `assets.run_worker_first`

**Symptom:** a production API route returned an empty 405 on POST and the SPA
shell on GET.
**Cause:** the Cloudflare asset layer answers everything not explicitly routed
to the Worker, before the Worker sees it.
**Rule:** adding an endpoint means editing `wrangler.jsonc` too.

### Never edit an applied migration

**Symptom:** a schema change that worked locally did nothing on dev.
**Cause:** editing a migration that had already run — wrangler records applied
files per database, so the edit never executed anywhere.
**Rule:** add the next-numbered `workers/db-worker/migrations/NNNN_<what>.sql`.
Test against a replayed pre-change database, not just a fresh one: a column add
only surfaces on an existing table. The `scripts/migrate-*.sql` files predate
the tracked chain and are legacy-only
([README](../../scripts/README-legacy-migrations.md)) — never add another.

### Replay a migration chain, never reason about it

**Symptom:** a chain analysed statement-by-statement and declared safe failed
on the first file when actually run.
**Cause:** the analysis checked which columns each migration _adds_ and never
which columns each migration _reads_. `CREATE INDEX IF NOT EXISTS ... ON
t(missing_column)` still throws — `IF NOT EXISTS` guards the index, not the
column — and a `CREATE TABLE IF NOT EXISTS` above it is a silent no-op on a
database where the table already exists with an older shape.
**Rule:** rebuild the target database from the schema that environment
actually has (`git show <tag>:workers/db-worker/schema.sql` for anything
predating the tracked chain), then execute every migration against it in
order. A few seconds of SQLite beats any amount of reading. Remember that
columns added by the legacy `scripts/migrate-*.sql` scripts are NOT in
`schema.sql`, so a database's real shape is the schema plus whatever legacy
scripts were hand-run on it.

### Never transpose a weekly challenge to the singer's range

**Symptom:** looks like a bug — a Bass is handed a B4 they cannot reach, and
`voiceTypeSplit` sits there unused as if someone forgot to wire it.
**Cause:** assuming every pitched surface should adapt to the singer, because
almost every other one does.
**Rule:** `WeeklyChallenge.targetItems` is absolute MIDI and is sung at written
pitch. A weekly Legend is a shared feat — everyone attempts the identical
notes, which is the only thing that makes the board comparable and lets "I hit
the B4" mean something. A week being out of reach for some voices is the
accepted cost, and sometimes the point. Author inside G3-C5 for a week most
people can finish; go outside it deliberately.
**See:** `src/features/challenges/weekly-service.ts` (the `targetItems` doc
comment), `scripts/seed-weekly-rotation.mjs` (the TESSITURA note).

### Seeding a row into the session list changes every surface that lists sessions

**Symptom:** three Jam smoke specs failed with "resolved to 2 elements" for a
song nobody had touched, after a change to the Karaoke Night examples.
**Cause:** the Jam picker builds one shelf from the demo manifest and another
from `getAllUvrSessions()`. Those were disjoint only by accident — nothing
said the demo could not also be a session row. Seeding one put the same song
on both shelves. Eight surfaces read that store; the seeder knew about none
of them, and the unit suite tests each in isolation so it saw nothing.
**Rule:** before seeding anything into `uvr-store`, grep
`getAllUvrSessions|getAllUvrSessionsReactive` and check each consumer for a
second, independent route to the same content. A surface that lists sessions
_and_ a catalogue needs an explicit dedupe (`ownSongRows`), not an assumption
that the two sets are disjoint.
**See:** `src/lib/jam/jam-session-songs.ts` (`ownSongRows`),
`src/features/karaoke-night/seed-examples.ts`

## Tooling and environment

### `rg -r` means `--replace`, not recursive

**Symptom:** search output came back garbled and partially rewritten.
**Rule:** never pass `-r` to ripgrep. It is recursive by default.

### The full tour walk is a release gate, not a per-change gate

**Symptom:** 20+ minutes burned running `pnpm test:tours` on an unrelated PR.
**Rule:** per change, verify the affected `targetSelector`s resolve. The full
two-viewport walk runs only in `/prod-upd`.

### Headless preview lies in specific ways

- The welcome overlay covers the page — set `pitchperfect_welcome_version` (and
  the survey key) in `localStorage`, then reload.
- `requestAnimationFrame` is paused, so canvases freeze and screenshots time
  out. Assert via `getImageData` / `toDataURL` and check the DOM for HUD state.
- The dev server is HTTPS-only; `VITE_NO_SSL=1` plus the `app-http` launch
  config gets plain HTTP. Revert before committing.
- `backdrop-filter: none` in headless output is an artifact, not a regression.
- The piano falling-notes game is audio-gated and will not start headless.

### Grep before reading a large file

**Symptom:** a single file read consumed most of the context window.
**Cause:** 25 files exceed 1.2k LOC; `StemMixer.tsx` alone is ~46k tokens.
**Rule:** check the hazard list in [INDEX.md](INDEX.md), grep for the symbol,
read the surrounding range.

### Build-time env vars go on the wrangler step, not on "Build app"

**Symptom:** `VITE_JAM_MOCK_SIGNALING=1` was set on CI's "Build app" step and
the deployed preview behaved as if it had never been set.
**Cause:** CI builds **twice**, on purpose. `wrangler.jsonc` declares
`build.command`, so `wrangler deploy` / `versions upload` runs its own build and
ships THAT bundle; the earlier "Build app" step is a gate that fails the run
before anything reaches Cloudflare, and its output is discarded. Keeping both is
a decision: without the gate, a broken build would surface only as a failed
deploy. Revisit if deploy-time feedback ever gets good enough to stand alone.
**Rule:** anything that must reach the shipped bundle is exported immediately
before the wrangler command. Do not "de-duplicate" the two builds without
moving those vars first.
**See:** `wrangler.jsonc:21` (top level), `:124` dev, `:134` preview;
`.github/workflows/build.yml:90` gate, `:148` preview upload.

### Force Vitest's environment before resolving Solid

**Symptom:** dozens of Solid interaction tests failed locally with detached-root
warnings while the same commit passed on CI.
**Cause:** the host exported `NODE_ENV=production`; Vitest only defaults it to
`test` when unset, so Vite omitted Solid's browser test condition.
**Rule:** set `NODE_ENV=test` in `vitest.config.ts` before defining the config;
do not trust the caller's shell environment.
**See:** `vitest.config.ts`

### A helper extracted "for testability" has to actually be called

**Symptom:** `buildFinalPartialTimes` sat in `lrc-gen-engine.ts` with five
tests covering the whole finish pipeline. Every one passed. Nothing in `src/`
called it — `handleLrcGenFinish` had inlined the same four steps by hand, and
the tests were vouching for a pipeline that never ran in the product.
**Cause:** the extraction landed as a copy rather than a move. Nothing catches
this: the export is used (by tests), so no lint fires, and coverage counts the
tested copy.
**Rule:** after extracting a pure function, grep for its name outside
`src/tests/`. If the only callers are tests, the extraction is not finished.
Prefer moving the body and calling it from the original site in the same
commit, so there is never a moment when two copies exist.
**See:** `src/features/stem-mixer/lrc-gen-engine.ts` (`composeGenResult` now
calls it)

### An explicit `min-height` removes a flex item's min-content floor

**Symptom:** in the mapper's marker mode with the font zoomed up, a lyric line
long enough to wrap onto two rows was drawn over the lines above and below it,
so the timestamps of the neighbouring rows showed through the text.
**Cause:** `.sm-lyrics-gen-lines` is a column flex container, so its rows
default to `flex-shrink: 1`. Normally `min-height: auto` stops a flex item
shrinking past its content — but `.sm-lyrics-gen-line-marker-mode` sets
`min-height: 4rem`, and a specified `min-height` **replaces** that automatic
minimum. The row was then free to be squashed to 4rem while its content needed
more, and the overflow painted over its neighbours.
**Rule:** rows in a scrolling flex column get `flex-shrink: 0`. And treat any
`min-height` on a flex item as also opting out of the min-content floor —
if you set one, set `flex-shrink: 0` too, or the value becomes a maximum in
disguise.
**See:** `src/components/StemMixer.tsx` (`.sm-lyrics-gen-line`)

### A canvas ref is never handed back — Solid does not call it with `null`

**Symptom:** the full-screen mapper registers its own waveform strip with the
canvas controller. Opening and closing the stage repeatedly left the
controller drawing into detached canvases, with the wheel and touch listeners
still attached to each one.
**Cause:** Solid does not invoke a `ref` callback with `null` on teardown, so
a controller whose `setCanvasRef(id)` has a null branch never sees it fire.
**Rule:** when a ref registers something with a longer-lived owner, release it
from an `onCleanup` inside the ref callback. The same fact is why the stage
registers under its own `mapperOverview` id instead of reusing `overview` —
the workspace canvas underneath the overlay is still mounted and still owns
that entry.
**See:** `src/components/lrc-mapper/LrcMapperStage.tsx` (`registerWaveform`)

### Imperative canvas drawing goes stale the moment playback stops

**Symptom:** toggling word ticks, or nudging every timing with the ±100 ms
buttons, changed nothing on the waveform until the user pressed play.
**Cause:** `redrawAll` reads the display accessors but is called from a frame
loop, so while audio runs every change lands on the next frame for free.
Paused, nothing calls it, and no handler queued a redraw itself.
**Rule:** a canvas controller needs one `createEffect` that touches the
display state and queues a redraw — not a `queueCanvasRedraw()` sprinkled
through each handler, which is the same bug waiting for the next toggle. Keep
per-frame data (elapsed, pitch history) out of it: that would queue a redraw
from inside a redraw.
**See:** `src/features/stem-mixer/useStemMixerCanvasController.ts`,
`src/tests/stem-mixer-canvas-redraw.test.ts`

### "First and last" is not the same test as "the edges"

**Symptom:** in the letter editor, right-click and long-press could not clear
a boundary. Both gestures fired; the split stayed.
**Cause:** `removeSplitPoint` protected the word's onset and end by refusing
`at === 0 || at === points.length - 1`. That holds only for a curve that
already carries both edges. A curve authored purely by clicking inside the
word carries neither — so the only split in it was simultaneously index 0 and
index length-1, and the guard refused every clear.
**Rule:** when a position in an array carries meaning (an edge, a sentinel,
an anchor), test the meaning, not the index. Here that is `progress <= 0 ||
progress >= 1`. And when writing the tests, build at least one fixture the
lazy way the product does — every existing case handed in a tidy three-point
curve, which is exactly why this shipped.
**See:** `src/lib/lyric-sweep.ts`, `src/tests/word-letters.test.ts`

### A control that refuses silently looks broken, not inapplicable

**Symptom:** three reports of the same shape in one session — the syllable
suggestion "doesn't seem to do anything on most words", and "Redo line, not
sure what that does, it doesn't seem to do anything".
**Cause:** both returned early on a condition the user could not see. The
suggestion demanded an explicit word end, which the word pass never writes,
so it refused on nearly every word. Redo acts on the line BEHIND the cursor
whenever the cursor sits at word 0, so it edited a row above where the user
was looking.
**Rule:** an early return in a handler needs a matching signal in the UI.
Disable the control and say why in its title when the refusal is a state
(`disabled` + "One syllable — nothing to split"), or name the target when the
action is not where the user is looking ("Clear and replay line 2: ..."). If
neither fits, the early return is probably too strict — check what the
surrounding data actually contains before requiring a field.
**See:** `src/components/lrc-mapper/LrcWordLetters.tsx`,
`src/components/lrc-mapper/LrcMapperToolbar.tsx`,
`src/tests/lrc-gen-redo-line.test.ts`

### A bubbling click on the container makes the whole thing a dismiss target

**Symptom:** the letter editor closed whenever anything inside it was clicked
except the hairline boundaries themselves.
**Cause:** click-to-collapse lived on the word `<span>`, and every glyph
inside the expanded word bubbles to it. The affordance was fine when the word
was one span; opening it into twenty children turned the row into a dismiss
zone with a few safe pixels in it.
**Rule:** when a container gains interactive children, its own click handler
becomes a hazard. Move dismissal to an explicit control, or scope the handler
to `e.target === e.currentTarget`.
**See:** `src/components/lrc-mapper/LrcMapperLineList.tsx`

### `beforeinstallprompt` needs headed, real Chrome, in a persistent profile

**Symptom:** the PWA install button never appeared in any Playwright run, in
either headless Chromium or headed real Chrome, so the install path looked
broken.
**Cause:** three separate gates. Headless Chrome does not run the installability
pipeline at all, and `browser.newContext()` is an incognito-style profile where
Chrome never offers install — only `chromium.launchPersistentContext(dir, {
headless: false, channel: 'chrome' })` fires the event.
**Rule:** do not conclude "the install prompt does not fire" from a normal
Playwright run. The e2e suite can assert the manifest and
`serviceWorker.controller`; the prompt itself has to be checked out-of-band with
a persistent, headed, real-Chrome profile.
**See:** `src/e2e/pwa.spec.ts`, `src/lib/pwa-install.ts`

### Regenerate the agent index last, after formatting and after a rebase

**Symptom:** `pnpm pr:prepare` reports a clean run, and PR Gate then fails on
"docs/agent/INDEX.md is stale" before it has installed a single dependency.

**Cause:** two ways in, both of which make the file stale _after_ it was
checked. `pr:prepare` regenerates the index and only _then_ runs Prettier, so
reformatting any file it just indexed changes that file's line count — and the
index records line counts. Separately, the index covers the whole tree, so a
rebase that pulls in someone else's new module invalidates it even though your
own diff never touched it.

**Rule:** run `node scripts/gen-agent-index.mjs` as the last step before
committing — after `pr:prepare`, and again after any rebase. It is a fast
local command and cheaper than a CI round trip. This bites hardest on a PR that
adds modules, which is exactly when the index matters.

**See:** `scripts/pr-prepare.mjs`, `scripts/gen-agent-index.mjs`

## Process

### Do not commit, push, or open a PR unless asked

**Rule:** write the code, report what changed, stop. The user tests first and
says when to commit. This overrides any "commit after every task" instruction
elsewhere in the repo docs.

### Never add Claude attribution

**Rule:** no `Co-Authored-By`, no "Generated with", in commits, PR bodies, or
any artifact. The user is the sole author. Cloud sessions have historically
authored as `Claude <noreply@anthropic.com>` — verify `%an|%ae` before merging.

### Never test against production

**Rule:** local or dev only (`api-dev`, localhost workers). Prod deploys go
through `/prod-upd`.
