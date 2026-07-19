# Karaoke Night — polish & robustness plan

**Status**: IMPLEMENTED (2026-07-19). All items shipped on
`feat/karaoke-zen-polish`:
- **#1 Desktop zen toggle** — `karaokeZen` opt-in OR'd into the `zenStage`
  gate; "Zen" button in the mixer toolbar; centered-column desktop CSS;
  Back exits zen to the mixer. (`verify-karaoke-zen-desktop` 8/8)
- **#2 Lyrics fallback** — "Add lyrics" in the zen no-lyrics state → kit
  Sheet hosting the existing `LyricsUploader`, routed through the studio's
  `handleLyricsUpload` (parses/syncs/persists, shows in studio too).
- **#3 Stuck-state** — the core hydration/re-pick bug was already fixed on
  main (`34a55e48`); the desktop toggle removes the "request desktop site"
  trick that triggered it; a robustness loop guards repeated flips.
- **#4 Account chip** — truncating label span + local-part display + menu
  email header, so a long email no longer spills off-screen.
- **#5 (added)** Desktop-zen playlist card — glass card in the side gutter
  (now / up next / last-up + score), ≥1280px only.

The original plan text is kept below for reference.

Scope note: everything here lives in the Karaoke Night surface — the
standalone entry `src/features/karaoke-night/**`, the shared
`src/components/StemMixer.tsx`, and `src/components/KaraokeMobileStage.tsx`
(the "zen" stage, now kit-based via `StageShell`). The zen stage today is
gated purely on viewport width:

```ts
// src/components/StemMixer.tsx  (changed earlier this session)
const zenStage = () => isNarrow()
// rendered: <Show when={!zenStage()} fallback={<KaraokeMobileStage …/>}>
```

---

## 1. Desktop "zen mode" toggle

**Ask**: let users opt into the full zen presentation (clean lyrics + minimal
transport, the `KaraokeMobileStage`) **on desktop too**, not just at phone
width.

**Approach**
- Add a persisted UI signal, e.g. `karaokeZenPreferred`
  (`createPersistedSignal<boolean>('kn_zen', false)`) in a leaf store the
  standalone entry can import without dragging `app-store`
  (`ui-store` is already imported by StemMixer; put it there or a small
  `karaoke-ui` leaf).
- Gate: `const zenStage = () => isNarrow() || karaokeZenPreferred()`.
  Keep the `isNarrow()` OR so phones are always zen.
- **Toggle UI**: a "Zen mode" button in the Karaoke Night desktop chrome
  (the stage's top-right control cluster in `StemMixer` studio preset, and/or
  a control on `KaraokeNightApp`'s desktop stage header). On the zen stage
  itself, the existing Back/exit affordance should turn zen **off** on desktop
  (set `karaokeZenPreferred(false)`) rather than only calling `onBack`.
- **CSS work (the real cost)**: `KaraokeMobileStage.module.css` sizes for a
  phone — `100dvh` portal, `clamp()` lyrics tuned to `6.8vw`, bottom bar
  full-width. On a wide desktop it must not stretch edge-to-edge:
  - constrain the lyrics + bottom bar to a centered `max-width` column
    (~720–820px), the rest of the viewport dimmed (backdrop already dark),
  - scale the lyric type off a `min()` of vw and a px cap so it doesn't get
    huge on a 1440px screen,
  - keep the pill / scrubber / transport centered in that column.
  Add these under a `:not(.narrow)` / a `@media (min-width: 769px)` block, or
  a `data-desktop-zen` attribute on the stage root so the phone path is
  untouched.
- **Reactivity caution**: `zenStage` currently flips presentation reactively.
  Adding a user toggle means it can flip **without a viewport change** — make
  sure the swap still keeps the audio engine in setup (it does today) so
  toggling zen never restarts playback. Verify with a running song.

**Verify**: on desktop, toggle zen on/off mid-playback → audio continues,
layout is a centered column (not full-bleed), toggling off restores the studio
mixer. Phone still auto-zen.

---

## 2. Lyrics fallback when none are found (load file / paste text)

**Current**: `KaraokeMobileStage` renders a dead-end when
`parsedLyrics()` is empty: *"No synced lyrics for this song yet. The music
still plays — sing it your way."* No way for the user to supply lyrics.

**Ask**: when lyrics can't be auto-found, let the user **paste text** or
**load a file** (.lrc / .txt) so they get synced (LRC) or at least scrolling
plain lyrics.

**Approach**
- First **confirm the studio path** (implementation step): the app already
  has lyrics tooling — `src/lib/lyrics-service.ts` (LRCLIB / lyrics.ovh fetch),
  an "LRC generator", and the stem-mixer lyrics controller that produces
  `parsedLyrics`. Find how the studio lets a user attach/generate lyrics
  (there is likely an LRC editor in `UvrPanel`/stem-mixer). Reuse its parser +
  persistence rather than writing new LRC parsing.
- **Zen UI**: in the no-lyrics state, add an **"Add lyrics"** button →
  a kit `Sheet` with two paths:
  1. **Paste** — a `<textarea>` accepting LRC (`[mm:ss.xx] line`) or plain
     lines; parse with the existing LRC parser. LRC → synced; plain → evenly
     distributed or just scrollable (no word sweep).
  2. **From file** — a file input (`.lrc,.txt`) → same parser.
- **Persistence**: store the user-supplied lyrics against the session id
  (Dexie lyrics table already exists per the studio LRC flow) so they survive
  a reload and show in the studio too.
- **Wire-through**: the lyrics controller feeding `parsedLyrics` must accept an
  injected/override source. Check whether the controller already reads a
  per-session stored LRC (it likely does — the studio can attach lyrics); if
  so, saving the pasted LRC to that store makes the zen stage pick it up
  reactively with no new plumbing.

**Verify**: play the demo/example (which HAS lyrics) — unchanged. Load a song
with no lyrics → "Add lyrics" → paste an LRC block → lines appear and sync;
paste plain text → lines scroll; reload → lyrics persist.

---

## 3. Stuck-state / stale-reactivity bug (robustness) — highest priority

**Repro (macOS test user)**: on `/karaoke-night`, switch back and forth
between the zen (mobile) view and desktop view (via "Request Desktop Site",
which changes effective width → flips `isNarrow`), and toggle the front-page
song list / library. After a few cycles:
- clicking a song in the library/list stops loading it,
- clicking to load a stem/song in the stem mixer stops working,
- the **same** song won't reload on view switch,
- **a full page reload fixes it** → in-memory stuck state, not persistence.

**What we already know**: a partial trace this session found **Solid Portal
disposal is clean on *normal* view flips** — so a permanently-leaked
full-screen overlay is a weaker (not eliminated) hypothesis. Focus on staging
reactivity and singletons.

**Ranked hypotheses (verify each with file:line before fixing)**

1. **Keyed `<Show>` + `activeSong` — same-session no-op (confirmed shape).**
   `KaraokeNightApp` stages via `<Show when={activeSong()} keyed>` →
   `KaraokeStageHost` → `StemMixer`. Re-picking the **same** `sessionId` leaves
   the key unchanged → no remount → "same song doesn't reload." Related:
   `KaraokeRailPanels` receives `stageBusy={() => activeSong() !== null}` and
   `activeSessionId` — check whether `onSing` **early-returns** when the pick
   equals `activeSessionId` or when `stageBusy` is true. If a rapid view flip
   leaves `activeSong` set to a session whose mixer never finished loading,
   the rail can believe it's "busy on that song" and ignore further clicks.
   → **Fix**: make staging **idempotent and always re-triggerable** — clicking
   a library song should (re)load even if it's the current session. Options:
   key the `<Show>` on `sessionId + a monotonic nonce` bumped on every pick, or
   add an explicit `restage()` that resets the loader. Never gate a pick on
   "same as active".

2. **StemMixer one-time init / audio singletons across remounts.** StemMixer
   seeds controller signals from `preset` **once** at init (documented
   init-time-static reads) and holds the audio engine in setup. Repeated
   remounts (keyed per song) + the zen swap could leave a controller,
   `window.*` audio singleton (e.g. a `pitchCanvasAudioEngine`-style global),
   or the lyrics/stem **load-on-mount effect** in a state where the next
   instance's load is skipped. → **Fix**: audit `onCleanup` in the stem-mixer
   controllers + KaraokeMobileStage; ensure every remount fully tears down and
   re-inits (listeners, audio nodes, `installAudioUnlock`), and that any
   "already loaded/stager ran" flag is instance-scoped, not module-scoped.

3. **Pointer-capture / document-listener leak on mid-gesture unmount.** If a
   view flip unmounts `KaraokeMobileStage` / a `Sheet` / `PillControl` /
   `Scrubber` while a pointer is captured or a document listener is attached,
   cleanup may miss, leaving a handler that swallows subsequent clicks.
   → **Fix**: confirm `onCleanup` releases pointer capture + removes any
   document/window listeners unconditionally.

4. **Leaked fixed overlay (lower probability).** A `Sheet`/backdrop or the
   Portal left mounted after an *abnormal* flip (e.g. flip while a sheet is
   open) would cover the page with `position:fixed` and swallow clicks even
   though normal flips dispose cleanly. → **Fix**: close all sheets/overlays
   on the zen↔desktop swap; assert no stray `position:fixed; inset:0` node
   remains after a flip.

**Recommended robustness work (regardless of exact culprit)**
- Staging is idempotent + always re-triggerable (kills H1 and the
  "same song won't reload" symptom directly).
- The zen↔desktop swap is a clean teardown: close sheets, release captures,
  reset scroll-lock count, dispose the portal (verify count returns to 0).
- Add defensive resets when the stage mounts (clear any stale busy flag).

**Verify (write `scripts/verify-karaoke-robustness.mjs`)**: Playwright script
that loads `/karaoke`, then in a loop (~6×) resizes the viewport between
1280px and 390px, toggles the rail/library, and clicks a library song each
cycle — asserting after every cycle that (a) the clicked session actually
becomes the staged/loaded song, (b) re-clicking the **same** song re-stages,
and (c) `document.elementFromPoint(centre)` is not a stray full-screen fixed
overlay. This should reproduce the stuck state on `main`/current and pass
after the fix.

---

## 4. Account chip truncation on mobile zen (top-right)

**Ask**: a longer profile email/username is cut off / hidden in the top-right
of the mobile zen view, with empty space to its right (the top bar has nothing
else there). Make it best-UX for mobile.

**Approach**
- **Locate** the chip: the Karaoke Night account chip in the top-right (grep
  `HeaderAccount`, `kn-account`, `account`, `email` under
  `src/features/karaoke-night/**` and `src/components/`; the vite manualChunks
  note references "the karaoke account chip"). Fix its CSS (its own module /
  `karaoke-night.css`).
- **Best mobile UX** (pick, in order of preference):
  1. **Avatar/initial only on narrow**, tap to reveal the full email in a
     small popover/sheet — cleanest, most native, zero truncation ambiguity.
  2. If text must show: display the **local part before `@`** (or first N
     chars) with `text-overflow: ellipsis`, and let it use the available
     top-bar width (the bar has free space to the right — allow the chip to
     grow / right-align with `max-width: min(60vw, …)` instead of a fixed
     narrow box that hides overflow behind the edge).
- Ensure the chip sits within `--safe-top` / `--safe-right` and does not
  collide with the stage Back/Songs controls.

**Verify**: with a long email (e.g. `someone.longname.2015@gmail.com`) the chip
either shows an initial (tap → full email) or an ellipsized local-part fully
within the viewport — never clipped off the right edge.

---

## Sequencing (suggested, one reviewable commit each)

1. **Bug first (#3)** — ship the robustness fix + `verify-karaoke-robustness`
   repro; it's the only correctness issue and blocks confidence in the rest.
2. **#4 account chip** — small, self-contained CSS/markup.
3. **#2 lyrics fallback** — reuses studio LRC tooling; medium.
4. **#1 desktop zen toggle** — feature + desktop CSS; largest, do last.

Each PR: `pnpm check`, vitest, and its own browser verify. None of these edit
tour steps, but #1/#4 touch the karaoke chrome — re-run
`scripts/verify-karaoke-stage.mjs` (12 checks) after #1 and #4.

## Related docs
- Kit primitives (Sheet/StageShell/scroll-lock): [mobile-kit.md](mobile-kit.md)
- Notification rework (separate batch): [notifications-rework.md](notifications-rework.md)
