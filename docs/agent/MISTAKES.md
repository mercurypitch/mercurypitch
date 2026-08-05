# Agent mistakes — living log

Things that went wrong, and the rule that came out of each. This is the
highest-value document in `docs/agent/` because none of it is recoverable by
reading the code: it is the record of what the code *looks* like it does versus
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
**Cause:** `mic-store`'s `micActive` is a *page-facing indicator*, not device
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
one stretch of a song — judge a *line*, not the whole result.
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
or judges anything — and carries the abort in its *return type*, not a local
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
`authVersion()` first, so it is both synchronous *and* reactive — right on the
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
**Cause:** all three come from the same instinct — build the panel *inside* the
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

## Data and billing

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
**Cause:** the analysis checked which columns each migration *adds* and never
which columns each migration *reads*. `CREATE INDEX IF NOT EXISTS ... ON
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
