# Whisper Hygiene — EARS Requirements

Requirements for filtering zero-length/hallucinated Whisper segments before alignment and skipping Whisper in favor of line-only LRC when Whisper match quality is clearly bad.

Implementation:
- Alignment segment filtering & quality evaluation: `src/lib/transcription-alignment-utils.ts` and `src/lib/pitch-word-alignment.ts`.
- Component wiring: `src/components/StemMixer.tsx` and `src/components/PitchTestingTab.tsx`.

Unit tests (`WSP-*`): `src/lib/pitch-word-alignment.test.ts` and `src/tests/whisper-hygiene.test.ts`.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Whisper Segment Hygiene & Alignment Priority — `WSP-*`

### REQ-WSP-001 — Drop zero-length and negative-duration Whisper segments
**WHEN** Whisper segments are filtered or processed for pitch-word alignment, the system shall drop any segment where the end timestamp is less than or equal to the start timestamp (`timestamp[1] <= timestamp[0]`). Verified by unit tests.

### REQ-WSP-002 — Drop empty and filler Whisper segments
**WHEN** Whisper segments are filtered for alignment, the system shall drop segments with empty text or bracketed/parenthesized filler noise tags (e.g. `[Music]`, `(applause)`, punctuation-only). Verified by unit tests.

### REQ-WSP-003 — Whisper match quality evaluation
**WHEN** Whisper transcription segments are compared against target LRC lyrics lines, the system shall compute a normalized match quality score (0 to 1) based on word overlap and sequence similarity. Verified by unit tests.

### REQ-WSP-004 — Skip Whisper for line-only LRC when Whisper match quality is low
**WHILE** aligning pitch to lyrics for a session with line-only LRC (no word-level timestamps), **IF** the Whisper transcription match quality score is below the minimum threshold (0.25), **THEN** the system shall skip Whisper and use the line-only LRC word estimated segments instead. Verified by unit tests.

### REQ-WSP-005 — Word-timed LRC precedence
**WHILE** aligning pitch to lyrics for a session with word-timed LRC (enhanced/tapped word timestamps), the system shall prioritize word-timed LRC over Whisper segments regardless of Whisper availability. Verified by unit tests.
