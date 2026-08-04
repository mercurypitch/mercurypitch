# Voice Atlas Traits — EARS Requirements

Requirements for adding neutral voice facets to Hear Yourself without creating
a second vocal-analysis stack or turning private comparisons into scores.

**Source:** `src/features/voice-history/VoiceAtlasTraits.tsx`,
`src/lib/voice-trait-analysis.ts`, `src/lib/take-analysis.ts`,
`src/lib/vocal-analyzer.ts`, `src/lib/decode-audio-to-mono.ts`

**Tests:** `src/lib/voice-trait-analysis.test.ts`,
`src/lib/decode-audio-to-mono.test.ts`,
`src/tests/vocal-analyzer.test.ts`, `src/e2e/voice-history-studio.spec.ts`

### REQ-VAT-001 — Reuse the Vocal Analysis algorithms

**Ubiquitous:** Voice Atlas tone traits shall use the same take-analysis worker,
HNR, harmonic-richness, resonance, vibrato, and pitch-stability algorithms as
Vocal Analysis; it shall not maintain parallel implementations of those
measurements.

### REQ-VAT-002 — Keep spectral analysis explicit

**WHEN** a singer chooses **Map tone traits**, the system shall decode and
analyse only the selected local take or comparison pair and shall show progress
while the spectral work runs. Selecting a take alone shall not start the
expensive audio pass.

### REQ-VAT-003 — Measure held regions rather than whole melodies

**WHEN** Voice Atlas derives vibrato or held-centre motion from a stored pitch
contour, the system shall separate low-confidence gaps, timing gaps, and note
changes before applying the shared Vocal Analysis algorithms.

### REQ-VAT-004 — Compare without ranking

**WHEN** two takes are visible, the system shall present their traits as equal,
independently measured facets and shall not label either take as better,
improved, winning, or losing.

### REQ-VAT-005 — Name unavailable evidence honestly

**IF** a take has no contour, too little held pitch, no voiced spectrum, missing
audio, or audio the browser cannot decode, the system shall name that missing
evidence and shall not substitute a proxy trait.

### REQ-VAT-006 — Explain device sensitivity

**Ubiquitous:** The traits surface shall explain that microphone, distance, and
room can change spectral readings; tone values shall not be presented as
calibrated measurements across devices.

### REQ-VAT-007 — Preserve local privacy

**WHILE** traits are mapped, the system shall keep audio and derived results on
the current device, shall not upload the recording, and shall not modify the
saved dry take.

### REQ-VAT-008 — Use the app mobile drawer

**WHEN** Reflection or Room tools open on a narrow screen, the system shall use
the shared draggable bottom sheet with backdrop dismissal, focus trapping,
Escape handling, and safe-area padding. Desktop shall retain the contextual
inspector rail.
