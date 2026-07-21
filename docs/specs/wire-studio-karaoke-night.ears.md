# Wire Studio <-> Karaoke Night — EARS Requirements

Requirements for bidirectional linking and session URL state synchronization between the main MercuryPitch studio app and the standalone Karaoke Night stage (`/karaoke-night`).

Implementation:
- Deep link helpers: `src/lib/karaoke-night-link.ts` (`karaokeNightSessionUrl`, `studioSessionUrl`).
- Karaoke Night URL state sync & restoration: `src/features/karaoke-night/KaraokeNightApp.tsx`.
- Studio topbar link: `src/components/UvrPanel.tsx`.

Unit tests (`SK-LINK-*`): `src/tests/karaoke-night-link.test.ts`.

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
