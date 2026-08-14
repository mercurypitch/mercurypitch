# Wire Studio <-> Karaoke Night — EARS Requirements

Requirements for bidirectional linking and session URL state synchronization between the main MercuryPitch studio app and the standalone Karaoke Night stage (`/karaoke-night`).

**Source:** `src/lib/karaoke-night-link.ts` — deep link helpers (`karaokeNightSessionUrl`, `studioSessionUrl`); `src/features/karaoke-night/KaraokeNightApp.tsx` — Karaoke Night URL state sync & restoration; `src/components/UvrPanel.tsx` — studio topbar link and the phone signpost; `src/features/karaoke-night/KaraokeRailPanels.tsx` — the rail's sync door
**Tests:** `src/tests/karaoke-night-link.test.ts` (`SK-LINK-*`); `src/components/__tests__/UvrPanel.test.tsx` and `src/features/karaoke-night/KaraokeRailPanels.test.tsx` (`REQ-SKL-007..009`)

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

The sync modal's module graph shall not import `@/stores/app-store`. **IF**
it did, **THEN** opening the sync door on the standalone Karaoke Night page
would pull the app ENTRY chunk in, whose evaluation renders the entire app
into that page's `#root` — the app's tab bar stacked under the karaoke
stage, which is how it shipped (found on a real phone, 2026-08-14; the
group list comes from `uvr-store`, where it is defined, and app-store only
re-exports it). Verified by "never reaches for the app shell" in
`SyncDevicesModal.test.tsx`.

### REQ-SKL-011 — The stage page catches its own scanned link

**WHEN** the Karaoke Night page opens with `#/sync:CODE` in the URL — the QR
its own receive screen shows links back to this page, and the page has no
hash router — the system shall stash the code and open the sync door itself,
so the scan joins unprompted (the studio half is REQ-SYNC-026). Verified by
`REQ-SKL-011` in `KaraokeRailPanels.test.tsx`.
