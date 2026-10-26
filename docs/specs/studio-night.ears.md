# Studio Night — EARS requirements

Delivery is tracked in `docs/plans/studio-v1/README.md`. Requirements below cover
the accepted v1; later-phase requirements are not a claim of shipped behavior.

### REQ-STU-001 — Integrated local projects

**WHEN** a musician opens Studio from Create or `/studio-night`, the system shall
open the same application feature and list browser-local project metadata without
loading audio bytes. Signing in shall not upload these projects.

### REQ-STU-002 — Explicit source ownership

**WHEN** a musician adds a kept take or uploaded audio, Studio shall preserve its
original bytes and versioned 48 kHz canonical PCM as project-owned assets. The
first clip reference and assets shall commit atomically. Deleting the original
take shall not damage the project. Practice metrics and contours shall not enter
Studio assets or backups.

### REQ-STU-003 — Bounded imports

**WHEN** an import fails, exceeds a resource limit, or is cancelled, Studio shall
leave the existing project usable and shall not insert a late clip into another
project. Native decoding shall retain its admission slot until it settles, even
after cancellation. Encoded and decoded limits shall be checked independently.

### REQ-STU-004 — Durable saves and recovery

**WHILE** changes are pending, Studio shall serialize saves and show Saved only
after the latest revision commits. **IF** storage fails, Studio shall retain the
current edits and prepared audio in memory and offer retry, project backup,
copy, or confirmed discard. Navigation shall not silently discard pending work.

### REQ-STU-005 — Exclusive editing

**WHEN** two tabs open a project, only a valid unexpired editor lease shall permit
writes. Every transaction shall compare the stored revision and lease epoch.
Lease loss shall preserve unsaved work. Taking over editing shall not discard
unsaved changes without a separate explicit discard action.

### REQ-STU-006 — Portable project backup

**WHEN** a musician saves a project backup, it shall contain the arrangement and
its selected original and canonical audio. **WHEN** a backup is opened, Studio
shall validate versions, paths, sizes, integrity, effects and references before
writing a separate project with new identities. Invalid archives shall not
partially change storage. Project admission shall preserve backup eligibility.

### REQ-STU-007 — Non-destructive audio edits

**WHEN** a musician moves, trims, splits, duplicates, fades or deletes a clip,
Studio shall change references and frame intervals without changing owned audio.
One gesture shall create one undo step. Cancelled gestures shall restore their
starting state. Clips shall not overlap on one lane; a conflicting duplicate
shall create a new lane within the same undo step.

### REQ-STU-008 — Playback ownership

**WHEN** Play is explicitly chosen, Studio shall use the shared host audio
contract and one audio clock. **WHEN** playback stops, seeks, loses its lease or
leaves Studio, scheduled sound shall stop without closing a borrowed context.
Opening, restoring or returning to a project shall not autoplay.

### REQ-STU-009 — Appearance and access

**WHILE** Studio is visible, it shall follow the app's dark or light appearance.
Desktop and tablet shall offer the agreed arranging commands. Phone shall offer
adding takes, listening, basic mixing and export. Mute shall use a speaker icon
with a slash when muted; Solo shall use a readable S. Both shall have accessible
names, tooltips and pressed states distinguishable without color alone.

### REQ-STU-010 — One live and export signal path

**WHEN** playing or rendering a song, Studio shall apply the same source
preparation, trim, fades, clip gain, lane FX, lane volume, pan, mute, solo and
master settings, with chain latency compensated at the actual context rate.

### REQ-STU-011 — Honest meters and renders

**WHEN** exporting a stereo WAV, Studio shall freeze a project revision, report
render progress and support cancellation. Final loudness and true peak shall be
measured from the encoded output, including tails and processing. An unmet target
shall show the achieved value. Live meters shall not imply final integrated
loudness. Project backups and rendered songs shall remain separate actions.

### REQ-STU-012 — Scope

**Ubiquitous:** v1 shall arrange existing audio and uploads. MIDI editing, tempo
stretching, pitch correction, overdub recording, MP3 export and cloud project
storage shall remain outside this delivery. Existing MIDI tools remain available
elsewhere in the application.
