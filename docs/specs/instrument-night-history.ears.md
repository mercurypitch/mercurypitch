# Instrument Night History — EARS Requirements

Requirements for preparing replayable Guitar Night, Piano Night, and Drum
Night performances and explicitly keeping them with their completed result in
Hear Yourself. Each Night stage remains responsible for defining which player
audio and result evidence is canonical.

**Sources:** `src/lib/domain/performance-take.ts`,
`src/lib/performance-take-audio.ts`,
`src/lib/use-performance-take-keep.ts`,
`src/features/voice-history/PerformanceTakeScoreCard.tsx`

**Tests:** `src/lib/domain/performance-take.test.ts`,
`src/lib/performance-take-audio.test.ts`,
`src/lib/use-performance-take-keep.test.ts`,
`src/features/voice-history/PerformanceTakeScoreCard.test.tsx`,
`src/tests/voice-history-playback.test.ts`

### REQ-INH-001 — Keep remains explicit

**WHEN** an eligible Night performance reaches its completed-result boundary,
the system shall prepare its replay in memory and shall not write audio to
local history until the musician chooses **Keep in Hear Yourself**.

### REQ-INH-002 — Capture only the musician's performance

**WHILE** a Night performance is active, the system shall capture or render
only the musician's contribution. The saved replay shall exclude authored
reference parts, backing tracks, metronomes, count-ins, coaching sounds, and
transport pauses.

### REQ-INH-003 — Preserve each Night's result semantics

**WHEN** a Guitar Night or Piano Night replay is kept, the system shall store
the completed score evidence defined by that feature. **WHEN** a Drum Night
replay is kept, the system shall store the completed Drum take summary's
matched-attack, timing, dynamics, confidence, and evidence-scope fields and
shall not invent an accuracy percentage, score, grade, or streak.

### REQ-INH-004 — Keep result and audio boundaries independent

**IF** replay capture, rendering, decoding, or local audio persistence fails,
the Night stage shall preserve its completed result and explain that the replay
could not be prepared or kept. A failed Keep shall retain a valid temporary
replay for a bounded retry while its result view remains open.

### REQ-INH-005 — Discard temporary replay completely

**WHEN** the musician chooses **Not now**, retries the performance, changes its
source or range, or leaves the result without keeping it, the system shall
discard the temporary replay and shall not add a Hear Yourself record.

### REQ-INH-006 — Group compatible performances conservatively

**WHEN** an instrument Night replay is kept, the system shall use a
source-prefixed, versioned comparison key that identifies the authored source,
played part, and practiced range closely enough that incompatible performances
cannot enter the same thread.

### REQ-INH-007 — Provide replay and source-aware evidence

**WHEN** a kept instrument Night take is opened in Hear Yourself, the system
shall show its source label, playable local audio, and source-aware saved result
evidence in **All takes**. Existing replay, export, favourite, and delete
actions shall remain available.

### REQ-INH-008 — Exclude instrument evidence from vocal analysis

**WHEN** a Guitar Night, Piano Night, or Drum Night take is listed, the system
shall not offer Voice Atlas, Voice Room, or Practice Loom analysis for that
take because instrument replay audio has no vocal contour contract.

### REQ-INH-009 — Preserve local privacy

**Ubiquitous:** Instrument Night replay audio, waveform peaks, source context,
and result evidence shall remain in the existing device-local take stores and
shall not enter cloud entities, analytics payloads, project exports, or device
sync through this flow.

### REQ-INH-010 — Keep existing history compatible

**WHEN** the new Night sources are introduced, the system shall continue
reading and replaying existing vocal and Karaoke takes without a destructive
store migration. Corrupt or future-version result metrics shall hide only the
score/evidence card, not the authoritative audio take.
