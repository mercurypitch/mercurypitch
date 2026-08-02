# Whisper Hygiene — EARS Requirements

Requirements for filtering zero-length/hallucinated Whisper segments before alignment, skipping Whisper in favor of line-only LRC when Whisper match quality is clearly bad, and turning Whisper's word segments into a readable lyric draft.

**Source:** `src/lib/transcription-alignment-utils.ts` and `src/lib/pitch-word-alignment.ts` — alignment segment filtering & quality evaluation; `src/lib/whisper-lyrics.ts` — "From vocal" lyric draft; `src/components/StemMixer.tsx` and `src/components/PitchTestingTab.tsx` — component wiring
**Tests:** `src/lib/pitch-word-alignment.test.ts`, `src/tests/whisper-hygiene.test.ts` (`WSP-*`) and `src/tests/whisper-lyrics.test.ts`

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

### REQ-WSP-006 — Lyric drafts are phrases, not one line per Whisper segment
**WHEN** a Whisper transcription is turned into a "From vocal" lyric draft, the system shall group the segments into sung phrases — breaking on a silence longer than the phrase gap, on sentence-final punctuation, or at the per-line word and duration caps — and emit one LRC line per phrase carrying its words' inline timestamps. A Whisper segment is a single word (`return_timestamps: 'word'`), so one line per segment would be one line per word. Verified by unit tests.

### REQ-WSP-007 — Discard lyric lines that carry no sung voice
**WHEN** a "From vocal" lyric draft is built, **IF** a phrase's words total less than the minimum voiced duration (0.15s), **THEN** the system shall drop that line. Whisper loops the decoder over instrumental passages and emits single-frame words seconds apart; the per-transcription hallucination guard cannot see junk confined to one stretch of a song. Verified by unit tests.
