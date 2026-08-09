# Piano Project Import — EARS Requirements

Approved requirements for the next Piano redesign slice. This phase replaces
the Piano tab's lossy, main-thread MIDI ingestion with a versioned local
project authority while deliberately preserving the current Piano UI,
transport, scoring, and audio runtime.

**Status:** implemented.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Canonical project model — `PP-MODEL-*`

- **REQ-PP-MODEL-001 — Versioned authority:** Every imported Piano project
  shall declare a schema version, stable identity, source identity, created
  and updated timestamps, Standard MIDI File format, and PPQ time base.
- **REQ-PP-MODEL-002 — Integer timing:** MIDI-derived musical timing shall
  remain in non-negative integer ticks at the source PPQ; compatibility
  adapters may derive beats without replacing the authoritative ticks.
- **REQ-PP-MODEL-003 — Expressive events:** The project shall retain the full
  tempo map, time and key signatures, track and instrument names, note-on and
  note-off velocity, control changes, program changes, pitch bend, channel
  pressure, polyphonic aftertouch, and bounded system/meta payloads.
- **REQ-PP-MODEL-004 — Event order:** Events shall retain their source track,
  absolute tick, and deterministic source order so equal-tick events can be
  replayed consistently.
- **REQ-PP-MODEL-005 — Percussion truth:** Channel 10 data shall be retained
  and identified as percussion in the canonical project; it shall not be
  silently discarded by import.
- **REQ-PP-MODEL-006 — Selection state:** A project shall carry a scored-track
  choice and backing-track choices that reference extant playable tracks;
  changes made through the Piano chooser shall update that canonical project.
- **REQ-PP-MODEL-007 — Validation:** Untrusted project or legacy data shall be
  shape-checked and bounded before it becomes library or performance state.

## Bounded Worker import — `PP-IMPORT-*`

- **REQ-PP-IMPORT-001 — Intent-only loading:** The MIDI importer and its Worker
  shall load only after an explicit file-import or drop gesture; Piano Night
  first paint shall not create a Worker or import the parser/database graph.
- **REQ-PP-IMPORT-002 — Worker file read:** The selected `File` shall be sent
  to the Worker, and the Worker shall enforce the byte limit before calling
  `File.arrayBuffer()`.
- **REQ-PP-IMPORT-003 — Supported input:** The importer shall accept Standard
  MIDI File formats 0 and 1 with PPQ division. It shall reject format 2 and
  SMPTE division with an explicit typed error.
- **REQ-PP-IMPORT-004 — Defensive bounds:** Import shall enforce limits for
  file bytes, tracks, events, variable-length quantities, accumulated ticks,
  individual text/blob payloads, and aggregate text/blob bytes before unsafe
  allocation or traversal.
- **REQ-PP-IMPORT-005 — Structural integrity:** IF a header, chunk, declared
  length, event, running status, or payload is malformed or truncated, THEN
  import shall fail without returning or persisting a partial project.
- **REQ-PP-IMPORT-006 — Source hash:** A successful import shall record a
  SHA-256 source hash computed from the source bytes in the Worker.
- **REQ-PP-IMPORT-007 — Cancellation:** WHEN import is aborted, times out,
  fails, or completes, its client promise shall settle exactly once and its
  Worker shall terminate.
- **REQ-PP-IMPORT-008 — No-note truth:** A structurally valid MIDI file without
  playable notes shall return an explicit no-notes error rather than an empty
  successful song.

## Local project library — `PP-LIB-*`

- **REQ-PP-LIB-001 — Device-local persistence:** Piano projects and migration
  markers shall persist in local IndexedDB and shall remain absent from cloud
  entity allowlists.
- **REQ-PP-LIB-002 — Failure-bearing reads:** A project-library read failure
  shall remain distinguishable from an empty library.
- **REQ-PP-LIB-003 — Atomic writes:** A project import or migration marker
  shall not survive without its corresponding project; related writes shall
  commit atomically or roll back together.
- **REQ-PP-LIB-004 — Deterministic ordering:** Project listing shall use a
  deterministic updated-time ordering with a stable identity tie-break.
- **REQ-PP-LIB-005 — Forward migration:** The local database shall add Piano
  stores through a new forward-only schema version without deleting or
  rewriting existing stores.

## Legacy migration and compatibility — `PP-LEGACY-*`

- **REQ-PP-LEGACY-001 — Non-destructive source:** Migration shall read the
  shared `pitchperfect_guitar_songs` value without deleting, renaming, or
  rewriting it; Guitar remains an owner of that legacy key.
- **REQ-PP-LEGACY-002 — Fresh discovery:** WHEN the migration is requested, it
  shall read current storage rather than a module-load snapshot so later
  Guitar imports remain discoverable.
- **REQ-PP-LEGACY-003 — Validated rows:** Invalid legacy roots or rows shall be
  skipped and reported; unchecked JSON casts shall not enter the Piano project
  library.
- **REQ-PP-LEGACY-004 — Stable identity:** Equivalent legacy songs shall hash
  identically despite random legacy IDs, import timestamps, or backing-track
  array order.
- **REQ-PP-LEGACY-005 — Idempotent markers:** A successfully migrated source
  hash shall receive a unique completion marker. Re-running migration shall
  neither duplicate that project nor hide newly added legacy songs.
- **REQ-PP-LEGACY-006 — Retry safety:** IF migration fails, THEN it shall leave
  no completion marker for an uncommitted project and a later retry shall be
  able to complete.
- **REQ-PP-LEGACY-007 — Compatibility projection:** Current Piano loading may
  receive an in-memory `SavedMidiSong`-shaped projection that uses initial
  tempo and beat timing, pairs overlapping equal pitches FIFO, and excludes
  percussion to preserve current behaviour.
- **REQ-PP-LEGACY-008 — No reverse persistence:** The compatibility projection
  of a canonical project shall not be written into the legacy localStorage
  collection.

## Existing Piano continuity — `PP-PIANO-*`

- **REQ-PP-PIANO-001 — Sole runtime owner:** The existing Falling Notes
  controller shall remain the sole Piano transport, audio, input, loop, and
  scoring owner in this slice.
- **REQ-PP-PIANO-002 — Shared picker fallback:** Guitar and other callers that
  do not inject the Piano project importer shall keep the current MIDI parser
  and legacy save behaviour.
- **REQ-PP-PIANO-003 — Existing selection flow:** One-track imports shall load
  immediately and multi-track imports shall use the existing score/backing
  chooser before loading.
- **REQ-PP-PIANO-004 — Honest failure:** IF Worker parsing or canonical
  persistence fails, THEN the current Piano page shall report import failure
  and shall not claim that a song or project was saved.
- **REQ-PP-PIANO-005 — No visual cutover:** This slice shall not redesign the
  existing Piano tab or make the standalone Piano Night preview claim real
  project, input, analysis, or audio state.

## Verification map

| Requirement area        | Minimum evidence                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `PP-MODEL`, `PP-IMPORT` | Expressive MIDI fixtures, malformed/bounds fixtures, projection tests, Worker lifecycle tests                          |
| `PP-LIB`                | Fake-IndexedDB CRUD, ordering, transaction rollback, schema upgrade, and local-routing tests                           |
| `PP-LEGACY`             | Corrupt/mixed storage, stable hash, idempotency, later-row discovery, byte-preservation, and retry tests               |
| `PP-PIANO`              | Injected-picker path, legacy fallback, Falling Notes/seek regressions, and Piano Night bundle/first-paint denial tests |

## Exclusions

This slice does not add a new playback clock, tempo-map-aware scheduler,
sampled piano, custom soundbank installation, arranger, drummer/bass engine,
project editor, cloud sync, project handoff into Piano Night, or final visual
polish. Those remain separate, testable phases over the canonical project
foundation.
