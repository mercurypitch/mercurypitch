# EARS Specification — Lyrics & LRC Generator

## PURPOSE

Document all requirements for the lyrics panel in StemMixer: lyrics loading (API/upload), LRC timed display with word-level highlighting, LRC timestamp generation (manual tap-along), block/chord marking with instance auto-detection, and LRC editing/download.

## SCOPE

**Covered:** LRC parsing, text lyrics parsing, canonical entry construction with synthetic rests, LRC↔canonical index mapping, LRC gen mode (marker and tap input, start/next-line/next-word/finish/reset), block marking with instance detection, edit mode with word timestamp editor, word-level progressive highlighting, output-aligned playback, auto-scroll during playback, lyrics persistence via localStorage.

**Excluded:** Whisper/WebSpeech transcription (separate spec), pitch-to-word alignment (separate spec), MIDI generation from lyrics.

## DEFINITIONS

| Term                    | Definition                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **LRC**                 | Lyrics file format with `[mm:ss.xx]` timestamps per line                                                                |
| **Word-level LRC**      | LRC with per-word timestamps: `[02:30.60]Amigos [02:32.00]no [02:32.37]more`                                            |
| **Canonical entry**     | Display entry derived from LRC lines, with synthetic `~Rest~` inserted for gaps > 20s                                   |
| **Canonical index**     | Sequential index in the canonical entries array (0, 1, 2, ...)                                                          |
| **LRC index**           | Original index in the parsed LRC lines array. `-1` for synthetic rests.                                                 |
| **Synthetic ~Rest~**    | Auto-inserted rest marker for temporal gaps > 20s between LRC lines                                                     |
| **Explicit ~Rest~**     | `~Rest~` marker that exists in the source LRC data                                                                      |
| **Gen mode**            | Interactive mode where user taps Next Line/Next Word to record timestamps                                               |
| **Marker mode**         | Direct manipulation mode where dragging through lyric text records word onsets, ends, and intra-word highlight progress |
| **Reaction correction** | Configurable time subtracted from an input event to compensate for the mapper's response delay                          |
| **Touched lines**       | Set of canonical indices the user explicitly timestamped during gen mode                                                |
| **Block**               | Marked section of lyrics (e.g., "Chorus", "Bridge") with repeat count and auto-detected instances                       |
| **Edit buffer**         | In-memory word timing edits before save                                                                                 |

## BEHAVIOR REQUIREMENTS

### Lyrics Loading

| ID         | Description                                                                | Priority |
| ---------- | -------------------------------------------------------------------------- | -------- |
| REQ-UV-025 | System SHALL attempt to load persisted lyrics from localStorage on mount   | High     |
| REQ-UV-026 | System SHALL auto-search for lyrics via API when no persisted lyrics exist | High     |
| REQ-UV-027 | System SHALL provide manual search (force search) and cancel options       | High     |
| REQ-UV-028 | System SHALL accept .txt and .lrc file uploads and parse them correctly    | High     |
| REQ-UV-036 | System SHALL show a loading indicator during API search                    | Medium   |
| REQ-UV-037 | When multiple search results are found, system SHALL show a song picker    | Medium   |
| REQ-UV-038 | System SHALL support canceling a search in progress                        | Medium   |

### LRC Parsing & Canonical Entry Construction

| ID         | Description                                                                                                                                       | Priority |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| REQ-UV-029 | System SHALL parse LRC files, extracting line times, text, and per-word timestamps when present                                                   | High     |
| REQ-UV-030 | System SHALL parse plain text lyrics files into lines                                                                                             | High     |
| REQ-UV-031 | System SHALL construct canonical entries from LRC lines, inserting synthetic `~Rest~` entries for gaps > 20 seconds                               | High     |
| REQ-UV-032 | System SHALL NOT insert synthetic `~Rest~` for gaps ≤ 20 seconds                                                                                  | High     |
| REQ-UV-033 | System SHALL support word-level progressive highlighting using per-word timestamps when available, falling back to even-division of line duration | High     |
| REQ-UV-034 | System SHALL map between LRC indices and canonical indices for all operations that cross the boundary                                             | High     |
| REQ-UV-035 | Synthesized `~Rest~` entries SHALL have `lrcIndex = -1` and be excluded from LRC output generation                                                | High     |

### LRC Gen Mode

| ID          | Description                                                                                                                                  | Priority |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| REQ-UV-039  | `startLrcGen` SHALL seed gen state from existing wordTimings, mapping LRC-indexed keys to correct canonical positions                        | High     |
| REQ-UV-040  | `startLrcGen` SHALL restore saved progress from localStorage when available (lineIdx, wordIdx, lineTimes, wordTimings)                       | Medium   |
| REQ-UV-041  | System SHALL allow resuming gen mode by clicking any lyric line to set it as the current position                                            | Medium   |
| REQ-UV-042  | `handleLrcGenFinish` SHALL produce LRC output with timestamps at correct LRC indices, skipping synthetic rests                               | High     |
| REQ-UV-043  | On partial gen (not all lines touched), untouched lines SHALL retain their pre-gen timestamps                                                | High     |
| REQ-UV-044  | `handleLrcGenReset` (Cancel) SHALL restore all pre-gen state (wordTimings, lrcLines, rawLyricsText, lyricsLines, lyricsSource)               | High     |
| REQ-UV-045  | System SHALL handle edge cases: empty LRC, single line, all rests, gap exactly at threshold, very large gaps                                 | High     |
| REQ-LYR-001 | WHEN the marker first enters the current word, the system SHALL record that instant as the word's first audible onset                        | High     |
| REQ-LYR-002 | WHILE the marker remains at the same position during playback, the system SHALL preserve the dwell as part of the intra-word curve           | High     |
| REQ-LYR-003 | WHEN the marker crosses into the next word or is released, the system SHALL close the previous word's audible interval                       | High     |
| REQ-LYR-004 | WHEN the final word is released, the system SHALL close its interval and finish or advance without requiring a synthetic next-word event     | High     |
| REQ-LYR-005 | The system SHALL prevent backwards pointer motion from reversing an authored karaoke sweep                                                   | High     |
| REQ-LYR-006 | The system SHALL expose a 0–500 ms reaction correction and apply it consistently to marker and tap inputs                                    | Medium   |
| REQ-LYR-007 | The system SHALL retain Tap mode and its keyboard controls as an alternative to pointer mapping                                              | Medium   |
| REQ-LYR-008 | The system SHALL preserve explicit word ends and marker curves when saving, switching versions, exporting, and re-importing MercuryPitch LRC | High     |

### Block Management

| ID         | Description                                                                        | Priority |
| ---------- | ---------------------------------------------------------------------------------- | -------- |
| REQ-UV-046 | System SHALL support marking lyric blocks with a label and repeat count            | Medium   |
| REQ-UV-047 | System SHALL auto-detect repeated instances of a marked block in the lyrics        | Medium   |
| REQ-UV-048 | System SHALL auto-fill timestamps for non-template block instances during gen mode | Medium   |
| REQ-UV-049 | System SHALL support unlinking instances and deleting blocks                       | Medium   |

### Edit Mode & LRC Download

| ID         | Description                                                                     | Priority |
| ---------- | ------------------------------------------------------------------------------- | -------- |
| REQ-UV-050 | System SHALL provide an edit mode for adjusting word timestamps inline          | Medium   |
| REQ-UV-051 | System SHALL support downloading lyrics as .lrc file with word-level timestamps | Low      |
| REQ-UV-052 | System SHALL persist lyrics to localStorage after edits and LRC gen             | High     |

### Playback & Display

| ID          | Description                                                                                                                                     | Priority |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| REQ-UV-053  | System SHALL highlight the current line during playback based on elapsed time                                                                   | High     |
| REQ-UV-054  | System SHALL auto-scroll lyrics to follow current line during playback                                                                          | High     |
| REQ-UV-055  | User manual scrolling SHALL pause auto-scroll; auto-scroll SHALL resume when the active line is in view                                         | Medium   |
| REQ-UV-056  | Clicking a lyric line SHALL seek playback to that line's timestamp                                                                              | Medium   |
| REQ-UV-057  | System SHALL support adjusting lyrics font size and column layout                                                                               | Low      |
| REQ-LYR-009 | WHILE audio is playing, lyric highlighting SHALL use the output-device-aligned audio clock when available and fall back safely when unavailable | High     |
| REQ-LYR-010 | WHEN explicit word ends and marker curves exist, playback SHALL use them instead of an inferred syllable duration                               | High     |

## SUCCESS CRITERIA

1. All unit tests in `canonical-lrc-gen.test.ts`, `lrc-generator.test.ts`, `lyrics-service.test.ts`, and `lyrics-scroll.test.ts` pass
2. Can parse LRC files, text files, and word-level LRC files
3. Canonical entries correctly insert `~Rest~` only for gaps > 20s
4. LRC↔canonical index mapping is correct in both directions
5. LRC gen Finish produces correct output with no duplicate/missing lines
6. Partial gen preserves untouched line timestamps
7. Cancel fully restores pre-gen state
8. Auto-scroll follows playback and pauses on user scroll
9. Blocks auto-detect instances and auto-fill in gen mode
10. A marker sweep can encode a long held vowel without stretching a following pause
11. Download and re-import preserve the exact marker curve
12. Lyric visuals follow the audible output clock without changing scoring or transport timing

## NON-FUNCTIONAL REQUIREMENTS

- LRC parsing must handle up to 2000 lines without noticeable delay
- localStorage persistence must handle full lyrics payloads
- Auto-scroll must use `scrollTo({ behavior: 'smooth' })` and not cause jank
- Word-level highlighting must update at 60fps during playback

## ASSUMPTIONS

- LRC timestamps follow standard `[mm:ss.xx]` or `[mm:ss.xxx]` format
- Lines without timestamps are treated as non-LRC text
- `~Rest~` is the canonical marker for silent/missing sections
- localStorage is available (graceful fallback if not)

## CHANGE HISTORY

| Version | Date       | Changes                                                                                                                      |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1.1     | 2026-07-23 | Added direct marker mapping, exact word intervals, intra-word dwell curves, reaction correction, and output-aligned playback |
| 1.0     | 2025-05-29 | Initial spec created during LRC gen audit                                                                                    |

## TEST COVERAGE

| Test File                             | Tests | REQs Covered                                                                                                           |
| ------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/tests/lyrics-service.test.ts`    | 82    | REQ-UV-029, REQ-UV-030, REQ-UV-033                                                                                     |
| `src/tests/lrc-generator.test.ts`     | 30    | REQ-UV-042, REQ-UV-043                                                                                                 |
| `src/tests/canonical-lrc-gen.test.ts` | 34    | REQ-UV-028, REQ-UV-031, REQ-UV-032, REQ-UV-034, REQ-UV-035, REQ-UV-039, REQ-UV-040, REQ-UV-042, REQ-UV-043, REQ-UV-045 |
| `src/tests/lyrics-scroll.test.ts`     | 10    | REQ-UV-053, REQ-UV-054, REQ-UV-055                                                                                     |
| `src/tests/lyric-sweep.test.ts`       | 4     | REQ-LYR-002, REQ-LYR-005, REQ-LYR-008                                                                                  |
