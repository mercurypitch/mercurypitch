# Play-along Presets — EARS Requirements

Requirements for role-based Stem Mixer launch presets.

**Source:** `src/features/stem-mixer/play-along.ts`,
`src/components/PlayAlongSelect.tsx`, `src/components/UvrPanel.tsx`
**Tests:** `src/features/stem-mixer/play-along.test.ts`,
`src/components/__tests__/KaraokePlaylistSidebar.test.tsx`,
`src/e2e/stem-mixer-controls.spec.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behavior), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Preset availability and composition — `PLAY-ALONG-*`

- **PLAY-ALONG-1** — WHERE Vocal and Instrumental stems exist without isolated full-band parts, the system shall offer “I sing” and “I play” roles.
- **PLAY-ALONG-2** — WHEN “I sing” launches, the system shall load Vocal and the available backing, mute Vocal initially, and begin playback.
- **PLAY-ALONG-3** — WHEN the two-stem “I play” role launches, the system shall load Vocal and Instrumental, mute Instrumental initially, and begin playback.
- **PLAY-ALONG-4** — WHERE an isolated Drums, Bass, Guitar, or Piano stem exists, the system shall offer a matching performer role.
- **PLAY-ALONG-5** — WHEN an isolated-instrument role launches, the system shall load Vocal and every available isolated part, omit the original Instrumental mix, mute only the selected instrument initially, and begin playback.
- **PLAY-ALONG-6** — The system shall include the residual Other stem in reconstructed backing but shall not expose Other as a performer role.
- **PLAY-ALONG-7** — IF a requested role's muted stem is unavailable when loading completes, THEN the system shall not open a misleading partial mix and shall report that the mix is unavailable.
- **PLAY-ALONG-8** — WHILE a requested song or role is hydrating stored stems, the system shall keep the current surface intact, block conflicting interaction, and show labelled preparation progress with an explicit cancel action.
- **PLAY-ALONG-9** — IF preparation is cancelled or superseded by a newer request, THEN the system shall not commit the stale mix and shall release any object URLs it created.
