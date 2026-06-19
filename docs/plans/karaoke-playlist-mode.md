# Karaoke Mode Playlist

## Context

The Karaoke tab (`StemMixer`, rendered inside `UvrPanel.tsx` when
`currentView() === 'mixer'`) today plays **one** separated song at a time and,
when a mic is active, shows a per-song score modal (`StemMixerScoreModal`) on
stop. Users who want a karaoke session (a party, a set list) have to manually
open each song one by one.

This feature adds a **playlist** layer on top of the existing session
**groups** (`SessionGroupRecord = { name, sessionIds[] }`). A togglable **left
sidebar** on the StemMixer (mirroring the Jam left pop-out, `JamPanel.tsx`) lets
the user assemble a playlist from whole groups and/or individual sessions,
assign a singer ("who will do this song") per entry, and optionally shuffle the
order (top-level and within each group). Playback then runs the set
automatically: a **top overlay** shows the current song → group/singer →
duration metadata, the user presses **Start**, a **4‑3‑2‑1‑Go countdown** runs,
the instrumental plays for true karaoke while the singer's mic is scored against
the song's vocal pitch, and on finish the score shows and the next song's
overlay appears. After the last song a **final scoreboard** ranks the singers.

### Decisions (confirmed with user)

- **Storage**: persisted, named playlists — new IndexedDB entity, reusable like groups.
- **Singer**: assigned **per playlist entry** (same song can have different singers across playlists).
- **End of playlist**: **final scoreboard** (aggregate recap, ranked) after the per-song scores.
- **Playback default**: **instrumental + mic, auto-score vs the vocal pitch reference** (true karaoke; mic still optional if denied).
- **Thumbnails**: out of scope for v1 — field placeholder only.

## Architecture overview

```
UvrPanel (owns mixer state: mixerStems/mixerSessionId/currentView)
  └─ runner effect: watches karaoke-playlist-store.currentSong()
       → ensureHydrated(session) → instrumental + hidden-vocal-reference stems
       → setCurrentView('mixer'); StemMixer keyed by mixerSessionId (remount per song)

karaoke-playlist-store.ts  (module signals, same style as app-store.ts)
  • persisted: playlists CRUD
  • runtime transport: activePlaylistId, queue[], currentIndex,
    phase ('idle'|'ready'|'countdown'|'playing'|'scoring'|'summary'), perSongScores[]

StemMixer (reads the store; no heavy prop-drilling)
  ├─ KaraokePlaylistSidebar (left, togglable)  — build/edit/select playlist, Start
  ├─ KaraokePlaylistOverlay (top)              — now-playing card + countdown + Start
  ├─ KaraokePlaylistSummary                    — final scoreboard
  ├─ header subtitle (playlist mode)           — Singer · Song · Next: …
  └─ onPlaybackEnded callback into the audio controller's end-of-track branch
```

## Data layer

**`src/db/entities.ts`**

```ts
export interface KaraokePlaylistItem {
  id: string
  kind: 'session' | 'group'
  refId: string                 // UvrSession.sessionId | SessionGroupRecord.id
  singerName?: string           // "who will do this song"
  shuffleWithinGroup?: boolean  // only for kind==='group'
}

export interface KaraokePlaylistRecord extends DbEntity {
  name: string
  items: KaraokePlaylistItem[]  // ordered
  shuffleOrder?: boolean        // shuffle top-level order on play
}
```

**`src/db/adapters/dexie-adapter.ts`** — add `karaokePlaylists: 'id'` to
`STORE_SCHEMAS` and `this.version(3).stores({ karaokePlaylists: 'id' })`
(incremental, like the `version(2)` follows precedent).

## Store — `src/stores/karaoke-playlist-store.ts`

Module signals like `app-store.ts`.

- **CRUD**: `getPlaylistsReactive()`, `createPlaylist`, `renamePlaylist`,
  `deletePlaylist`, `addItem`, `removeItem`, `reorderItems`, `setItemSinger`,
  `setItemShuffleWithinGroup`, `setPlaylistShuffleOrder`.
- **`buildQueue(playlist): QueueEntry[]`** (pure, unit-tested): expand groups to
  their `sessionIds` (shuffle within when flagged), expand sessions singly,
  shuffle top-level order when `shuffleOrder`.
  `QueueEntry = { sessionId, songTitle, groupName?, singerName? }`.
- **Transport**: `activePlaylistId`, `queue`, `currentIndex`, `phase`,
  `perSongScores`. Actions: `startPlaylist`, `beginCountdown`/`beginCurrentSong`,
  `reportSongScore`, `advance` (→ next or `'summary'`), `prev`, `stopPlaylist`.
  `currentSong()` and `nextSong()` memos.

## Orchestration — `src/components/UvrPanel.tsx`

`createEffect` runner reacting to `currentSong()` while a playlist is active:
`ensureHydrated(session)` → `setMixerStems({ vocal, instrumental })`,
`setMixerRequestedStems({ instrumental: true })`,
`setMixerPracticeMode('instrumental')`, `setMixerAutoPlay(false)`,
`setCurrentView('mixer')`. **Remount per song**: render the mixer via
`<Show when={mixerSessionId()} keyed>` (StemMixer loads stems in `onMount`
only — it does not reactively reload on `props.stems`).

## StemMixer integration — `src/components/StemMixer.tsx`

Reuse `.sm-sidebar*` / `.sm-sidebar-toggle*` styling but on the **left** edge;
persist open/closed with `createPersistedSignal`.

New components (co-located CSS modules, like the Jam components):

1. **`KaraokePlaylistSidebar.tsx`** — list playlists (create/rename/delete,
   mirroring `SessionGroupTabs.tsx`); edit the active playlist (add items from a
   picker of groups via `getGroupsReactive()` and sessions via
   `getAllUvrSessionsReactive()`; reorder; per-item singer input; per-group
   shuffle toggle; playlist shuffle-order toggle); **Start**.
2. **`KaraokePlaylistOverlay.tsx`** — top now-playing card (Song → Group/Singer
   → duration, thumbnail slot hidden in v1); `'ready'` shows **Start** (+ optional
   precount toggle), `'countdown'` runs 4‑3‑2‑1‑Go then `beginCurrentSong()`;
   Prev/Skip → `prev()`/`advance()`.
3. **`KaraokePlaylistSummary.tsx`** — ranked scoreboard from `perSongScores`;
   "Play again" / "Close".

**Header subtitle (playlist mode)**: in the StemMixer header, show a dimmed
subtitle line — **`Singer · Song`** for the current entry and **`Next: <song>
— <singer>`** from `nextSong()`. Reuse the existing header area near
`extractTitle(props.songTitle)`; render only when a playlist is active.

**Browser tab title**: while a stem-mixer song is playing, set
`document.title = \`MercuryPitch — \${songName}\`` and restore the base title on
pause/stop/unmount. Implement as a small `createEffect` in StemMixer keyed on
`audio.playing()` + the resolved song title (works for both single-song and
playlist playback). Capture the original `document.title` once and restore it in
`onCleanup`.

**Mic monitoring (hear yourself)**: today the mic graph is
`source → micGainNode → micAnalyserNode` (analyser is a dead-end sink), so the
singer never hears their own voice. Add a monitor branch
`micGainNode → monitorGain → ctx.destination` in
`useStemMixerMicController.ts`, with `micMonitorEnabled` (persisted, **default
off** to avoid speaker feedback) and `micMonitorVolume` controls, surfaced as a
"Hear my voice" toggle + slider near the mic controls (headphones hint, since
capture runs with `echoCancellation: false`). Lets users karaoke without a
second app.

**Auto-advance**: the audio controller stops at end of track in the RAF loop
(`useStemMixerAudioController.ts`, `elapsedTime >= duration()` → `handleStop()`,
which already computes+shows the score when mic is active). Add an optional
`onPlaybackEnded` dep fired **only** in that end-of-track branch (not on manual
stop). Flow: song ends → score modal → on close, if a playlist is active,
`reportSongScore(score)` then `advance()` → next overlay or summary. Mic denied →
no score, still `advance()`.

### Scoring reference fix (instrumental karaoke)

`vocalAnalyser` is tapped **post-gain** today
(`gain.connect(vocalAnalyser)`, `useStemMixerAudioController.ts:379`), so muting
the vocal for true karaoke would also kill the scoring reference. Fix: behind a
new `karaokeReferenceVocal?: boolean` StemMixer prop, tap the vocal **source**
node pre-gain into `vocalAnalyser` and keep the vocal **gain** disconnected from
`mainGain` (silent to speakers, still analysed). Non-karaoke behaviour
unchanged. *Fallback:* low guide-volume vocal sing-along if the graph change is
risky.

## Follow-up: multiple vocalists & dual mic (NOT in this PR)

- **Data**: `KaraokePlaylistItem.singerName?: string` →
  `singers?: { name: string; role: 'lead' | 'backing' }[]` (back vocals).
- **Two mic inputs**: Web Audio supports multiple concurrent
  `getUserMedia({ audio: { deviceId } })` captures from distinct devices → two
  `MediaStreamAudioSourceNode` → two analysers → two pitch detectors → two
  `comparisonData`/score tracks. Needs per-singer device pickers, a second mic
  path in `useStemMixerMicController.ts`, and a 2-singer score UI. Constraints:
  per-device permission, inconsistent multi-input support across browsers,
  clear stream labelling.
- Overlay/scoreboard show per-singer scores; summary ranks across singers.

### Follow-up: quick singer→group assignment

A **group** playlist item already carries one `singerName` that applies to every
song in it (handled in `buildQueue`), so "group songs per person, assign the
singer once" works today by adding the group and setting its singer. Enhancement
to add later: clicking a singer typed on an individual **session** item offers
"apply to the whole group this song belongs to" — propagating that name to all
playlist items referencing sessions in the same `SessionGroupRecord`.

## Files

**New**: `src/stores/karaoke-playlist-store.ts`,
`src/tests/karaoke-playlist-store.test.ts`,
`src/components/KaraokePlaylist{Sidebar,Overlay,Summary}.tsx` (+ `.module.css`),
this doc.

**Modified**: `src/db/entities.ts`, `src/db/adapters/dexie-adapter.ts`,
`src/db/index.ts` (re-exports), `src/components/StemMixer.tsx`,
`src/features/stem-mixer/useStemMixerAudioController.ts`,
`src/components/UvrPanel.tsx`, `src/components/index.ts`, `package.json`,
`CHANGELOG.md`.

## Reuse

`getGroupsReactive()`, `getAllUvrSessionsReactive()`, `ensureHydrated`,
`getStemBlobUrl`, `SessionGroupTabs.tsx` (inline edit pattern), `JamPanel.tsx`
(left sidebar UX), `StemMixerScoreModal.tsx` + `computeScore`/`handleStop`,
`.sm-sidebar*` styles, `createPersistedSignal`, `showNotification`.

## Verification

1. `pnpm check` + `pnpm test` (incl. `karaoke-playlist-store.test.ts`).
2. `pnpm dev`, Karaoke tab: create a playlist; add a group + a session; set
   singers; toggle shuffles; **Start** → overlay (Song → Group/Singer →
   duration) → countdown → instrumental plays (vocal silent), mic active, tab
   title shows `MercuryPitch — <song>`, header subtitle shows Singer · Song ·
   Next; song ends → score modal → next overlay; after last song → scoreboard;
   reload → playlist persists; deny mic → still advances, empty-score summary.
3. Confirm single-song mixer behaviour unchanged (regression).
