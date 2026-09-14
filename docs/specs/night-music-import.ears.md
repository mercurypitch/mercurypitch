# Night music import — EARS requirements

Shared in-session import for Guitar, Drum, Piano and Karaoke Night. Room-specific
adapters keep the existing players, parsers, storage and score clocks.

**Source:** `src/features/play-along/useNightMusicImport.ts`,
`src/features/play-along/NightMusicImport.tsx`, room `*-music-actions.ts` adapters.
**Tests:** `NightMusicImport.test.tsx`, `night-music-preparation.test.ts`,
`useSongController.test.tsx`, room/controller tests and
`src/e2e/night-music-import.spec.ts`.

## Intent and access — `NIGHT-IMPORT-*`

- **NIGHT-IMPORT-1** — WHEN an external file enters any supported Night route,
  the room shall show a drop veil without processing, uploading, playing audio
  or requesting input permission.
- **NIGHT-IMPORT-2** — WHEN a file is dropped or chosen using Add music, the
  room shall queue it and present applicable actions before changing staged music,
  unless the player previously opted into automatic audio preparation in this room.
- **NIGHT-IMPORT-3** — IF a drop contains zero, multiple, empty, unsupported or
  oversized files, THEN the sheet shall explain recovery and supported types.
- **NIGHT-IMPORT-4** — Internal timeline, note and slider drags shall retain
  their existing pointer behavior and shall not activate file import.
- **NIGHT-IMPORT-5** — WHILE the action sheet is open, its focus shall be trapped,
  Escape shall close it, and room keyboard/voice transport commands shall not
  operate behind it. Closing shall restore focus when the previous target remains.
- **NIGHT-IMPORT-6** — The sheet shall have an explicit portal skin, visible
  recovery, touch-sized buttons and no horizontal overflow on phone viewports.

## Safety and lifecycle

- **NIGHT-IMPORT-7** — WHILE a temporary take is capturing, processing, saving or
  awaiting keep/discard, replacement shall be blocked with a reason. The selected
  file shall remain pending when the player returns to the session. Piano shall
  offer an explicit stop-and-import action for unfinished practice, explaining
  that it dismisses the unsaved take; an in-progress durable save remains protected.
- **NIGHT-IMPORT-8** — A candidate shall be validated/hydrated before replacing
  the current source. Failure, cancellation and stale completion shall preserve
  the previous staged music and URL and release candidate-owned resources.
- **NIGHT-IMPORT-9** — WHEN a Drum project is staged, its durable save shall
  succeed before the project is detached for imported audio or an arrangement.
- **NIGHT-IMPORT-10** — WHEN full-band separation is selected, the system shall
  reuse saved parts before requiring paid-job admission. A new cloud job shall
  require sign-in, known pricing and a sufficient current balance for every needed
  stage, including the duration multiplier, before either stage starts. Unknown
  billing shall show Retry rather than promise a run. The server remains authoritative.
  A blocked request shall retain its Sign in/Get credits action when available;
  recovery shall not automatically retry a billable job or discard the pending file.
- **NIGHT-IMPORT-11** — Replacement shall never autoplay. Storage warnings shall
  remain visible rather than being overwritten by routine progress.
- **NIGHT-IMPORT-12** — Closing/unmounting during preparation shall cancel its
  intent. Cancellation shall not claim to erase an already durable library item.
- **NIGHT-IMPORT-13** — Parsers, preparation engines and import-only UI shall
  remain lazy; the existing room startup bundle budgets shall not increase.

## Room capabilities

- **NIGHT-IMPORT-14** — Guitar shall offer MIDI/GP rehearsal, or attachment when
  a song is staged. Attachment shall expose existing manual Align controls and
  shall not invent score-to-recording timing.
- **NIGHT-IMPORT-15** — Drum shall import MIDI/GP through its canonical bounded
  worker/GM projection, retaining existing track selection and mixer behavior.
- **NIGHT-IMPORT-16** — Piano shall accept MIDI and reuse its canonical project
  importer and multi-track assignment editor. The current piece shall remain
  until a valid project/track selection is ready.
- **NIGHT-IMPORT-17** — Karaoke shall accept supported audio and reuse durable
  vocal/backing preparation and hydration, without representing scores as audio.
- **NIGHT-IMPORT-18** — Guitar, Drum and Karaoke shall place the saved Local/Cloud
  method before audio actions. Vocals/backing shall support either method; new
  full-band separation shall require Cloud. Unavailable actions shall remain
  visible with reasons and applicable Sign in/Get credits/Retry recovery. Piano
  remains MIDI-only. A staged eligible song shall expose band separation without
  another file pick.
- **NIGHT-IMPORT-19** — Automatic audio preparation shall default off and be an
  explicit per-room preference, using the shared saved processing method and the
  last selected output. An unavailable preferred action shall leave the song
  queued. Reopening, changing a preference, signing in, topping up, or clearing a
  capture blocker shall never retry automatically. Pending files remain in memory.
- **NIGHT-IMPORT-20** — A valid replacement selection shall clear prior validation
  errors. Reopening an empty sheet shall not retain an unsupported-file warning.

## Deliberate boundaries

MP3/WAV/FLAC use the existing audio contract; MIDI and GP use existing extensions
and parser limits. Piano GP/audio playback, original-only audio playback, new
separation models, batch imports, automatic alignment and cross-room navigation
are not added here. “Band” means instrument stems, not cutting a song into time
segments. New buttons do not replace or downgrade the current room players.
