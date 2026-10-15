# Wire Studio <-> Karaoke Night — EARS Requirements

Requirements for bidirectional linking and session URL state synchronization between the main MercuryPitch studio app and the standalone Karaoke Night stage (`/karaoke-night`).

**Source:** `src/lib/karaoke-night-link.ts` — deep link helpers (`karaokeNightSessionUrl`, `studioSessionUrl`); `src/features/karaoke-night/KaraokeNightApp.tsx` — Karaoke Night URL state sync & restoration; `src/components/UvrPanel.tsx` — studio topbar link and the phone signpost; `src/features/karaoke-night/KaraokeRailPanels.tsx` — the rail's sync door; `src/components/stem-mixer/header/MixerHeader.tsx` and `karaoke-night.ts` — the mixer's Open in Karaoke Night (`mixerKaraokeNightUrl`)
**Tests:** `src/tests/karaoke-night-link.test.ts` (`SK-LINK-*`); `src/components/__tests__/UvrPanel.test.tsx` and `src/features/karaoke-night/KaraokeRailPanels.test.tsx` (`REQ-SKL-007..009`); `src/features/karaoke-night/example-links.test.ts`, `stage-example-link.test.ts`, `KaraokeNightApp.test.tsx` and `src/e2e/karaoke-example-links.spec.ts` (`REQ-SKL-012..013`); `src/tests/karaoke-night-link.test.ts`, `src/components/__tests__/StemMixerHeader.test.tsx`, `src/components/stem-mixer/header/MixerHeader.test.tsx` and `karaoke-night.test.ts` (`REQ-SKL-014`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Session URL & Bidirectional Linking — `SK-LINK-*`

### REQ-SKL-001 — Session URL reflect on stage change

**WHEN** a song is loaded onto stage in Karaoke Night (via demo button, library selection, or playlist runner), the system shall update the browser URL search parameters to include `?session=<sessionId>`. Verified by `SK-LINK-1`.

### REQ-SKL-002 — Session URL cleared on exit

**WHEN** the stage is closed or exited on Karaoke Night, the system shall remove the `session` search parameter from the URL. Verified by `SK-LINK-2`.

### REQ-SKL-003 — Session restoration on reload and boot

**WHEN** Karaoke Night is opened or reloaded with `?session=<sessionId>` in the URL, the system shall automatically restore and stage that song (for either the demo song or a stored library session). Verified by `SK-LINK-3`.

### REQ-SKL-004 — History navigation (back/forward)

**WHEN** the visitor navigates using browser back or forward buttons (`popstate`), the system shall update the staged song state to match the session ID in the updated URL. Verified by `SK-LINK-4`.

### REQ-SKL-005 — Topbar studio link targeting loaded song

**WHILE** a song is currently loaded on stage in Karaoke Night, the top "Open studio" link shall point directly to `/#/karaoke/session/<sessionId>/mixer` for that song. **IF** no song is staged, **THEN** it shall point to `/#/karaoke`. Verified by `SK-LINK-5`.

### REQ-SKL-006 — Studio link targeting loaded session

**WHILE** a separation session is active in the studio stem mixer (`UvrPanel`), the "Karaoke Night" view tab link shall point to `/karaoke-night?session=<sessionId>`. Verified by `SK-LINK-6`.

### REQ-SKL-007 — The studio signposts the stage on a phone

**WHILE** the studio upload view is shown on a narrow viewport that is not a
television, the system shall show a signpost naming the difference between the
two surfaces ("you're in the studio; Karaoke Night is the stage") with a link
to `KARAOKE_NIGHT_PATH`. **IF** the viewport is wide, or the device is a TV
(which has its own note), **THEN** no signpost shall be shown. Verified by
`REQ-SKL-007` tests in `UvrPanel.test.tsx`.

### REQ-SKL-008 — Karaoke Night offers device sync without songs

**WHEN** the Karaoke Night rail renders, the system shall offer the device
sync door ("send or receive a song") even when the library is empty — the
device most in need of receiving is the one with nothing on it yet. Verified
by `REQ-SKL-008` in `KaraokeRailPanels.test.tsx`.

### REQ-SKL-009 — The sync machinery loads only when the door opens

**WHILE** the sync door has not been opened, the system shall not load the
sync chunk (WebRTC signaling, portable-bundle machinery); the rail's first
paint never pays for it. Verified by `REQ-SKL-009` in
`KaraokeRailPanels.test.tsx`.

### REQ-SKL-010 — The sync modal must not carry the app shell

The sync modal's import closure shall never reach the app ENTRY chunk.
**IF** it does, **THEN** opening the sync door on the standalone Karaoke
Night page executes that entry, whose evaluation renders the entire app
into the page's `#root` — the app's tab bar stacked under the karaoke
stage, which is how it shipped (found on a real phone, 2026-08-14; on
that build the entry residents in the modal's closure were `sync-store`
and `QrCode`, since re-colored by importing the group list from
`uvr-store` where it is defined and pinning `QrCode` its own chunk).
The source-level tripwire — the modal must not import the app shell's
own stores — is "never reaches for the app shell" in
`SyncDevicesModal.test.tsx`; the chunk graph itself is the truth, so a
new modal import of anything app-shaped deserves a build and a look at
what the modal chunk pulls in.

### REQ-SKL-011 — The stage page catches its own scanned link

**WHEN** the Karaoke Night page opens with `#/sync:CODE` in the URL — the QR
its own receive screen shows links back to this page, and the page has no
hash router — the PAGE shall parse the link, CONSUME it from the URL, show
the rail even when collapsed (the door lives there, and collapsed is a
persisted preference), and hand the code to the rail exactly once; the rail
stashes it and opens the sync door, so the scan joins unprompted (the
studio half is REQ-SYNC-026). **IF** the hash survived, **THEN** every
reload, tab restore, or rail collapse/expand would silently re-join the
scanned session. Verified by `takeScannedSyncLink` tests in
`karaoke-night-link.test.ts` and `REQ-SKL-011` in
`KaraokeRailPanels.test.tsx`.

### REQ-SKL-012 — A song link stages an example by name

**WHEN** Karaoke Night opens with `?song=<slug>` and no `session`, and the
slug names a playable example, the system shall stage that example's
library row, waiting for the examples seed to write it on a first visit,
and shall count it as `karaoke_example_staged`. The link slug is the
manifest slug, except the original demo (manifest slug `karaoke-night`),
whose link slug is `goodbye-to-spring`; both spellings resolve, and the URL
is rewritten to the link slug. The row keeps the visitor's own changes: a
replaced stem plays instead of the published one, and edited lyrics and an
edited title stay. **IF** no row can be written, **THEN** the published
stems shall be staged instead. **IF** the slug names nothing playable,
**THEN** the page shall open as it does with no song, show no error, and
drop `song` from the URL. **WHILE** the linked song stays on stage, `song`
shall stay in the URL; staging anything else replaces it with `session`
(REQ-SKL-001), and closing the stage removes it (REQ-SKL-002). **IF** a
link carries both `session` and `song`, **THEN** `session` shall decide and
`song` shall be dropped. A visitor's pick while the seed runs shall never
be replaced by the linked song. Verified by `example-links.test.ts`,
`stage-example-link.test.ts`, `karaoke-night-link.test.ts` and
`karaoke-example-links.spec.ts`.

### REQ-SKL-013 — zen=1 opens the zen stage on a desktop

**WHEN** Karaoke Night opens with `zen=1` (also `zen=true` or a bare
`zen`) on a wide viewport, the system shall turn on the zen stage, so any
song staged there opens in it. **WHILE** the viewport is narrow, the
parameter shall change nothing: a phone always gets the zen stage. Without
the parameter nothing shall change. `zen` shall stay in the URL while zen is
on and shall be removed when the visitor leaves zen. It combines with
`song` and with `session`. Verified by `KaraokeNightApp.test.tsx`,
`karaoke-night-link.test.ts` and `karaoke-example-links.spec.ts`.

### REQ-SKL-014 — The mixer opens its song on the stage

**WHEN** the singer presses Open in Karaoke Night in the studio mixer's
header, the system shall open Karaoke Night on the song in the mixer:
`?session=<sessionId>`, or `?song=<slug>` for an example, so a vocal or
lyrics the visitor replaced come along (REQ-SKL-012). The link shall carry
`&t=<seconds>` at the playhead when the playhead is past the start, and
shall never carry `autoplay`: the stage opens paused. The mixer's song
shall pause with its fade as the page leaves. **WHILE** a take is saving, a
song is separating or uploading in this tab, or a playlist is running, the
link shall not navigate and shall say why in words when pressed, hovered or
focused (in that order of priority; a playlist opens in Karaoke Night from
Songs). **WHERE** the mixer runs in the native app, in the Karaoke room,
on the Karaoke Night stage itself or in the performance preset, the link
shall not be drawn. Verified by `REQ-SKL-014` in `karaoke-night-link.test.ts`,
and by `StemMixerHeader.test.tsx`, `MixerHeader.test.tsx` and
`karaoke-night.test.ts`.
