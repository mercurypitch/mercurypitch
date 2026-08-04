# Karaoke Voice History — EARS Requirements

Requirements for preparing a scored karaoke microphone replay and explicitly
keeping it in Hear Yourself. Source songs and separated stems are never part of
the saved voice take.

**Source:** `src/features/stem-mixer/useKaraokeVoiceCaptureController.ts`,
`src/features/stem-mixer/karaoke-voice-take.ts`,
`src/components/StemMixerScoreModal.tsx`

**Tests:** `src/features/stem-mixer/karaoke-voice-take.test.ts`,
`src/features/stem-mixer/useKaraokeVoiceCaptureController.test.ts`,
`src/components/__tests__/StemMixerScoreModal.test.tsx`

### REQ-KVH-001 — Capture only during scored playback

**WHILE** karaoke playback and the scoring microphone are both active, the
system shall prepare a dry microphone recording without mixing in the song,
vocal stem, instrumental stem, or monitoring output.

### REQ-KVH-002 — Follow transport pauses

**WHEN** karaoke playback pauses and later resumes, the temporary microphone
recording shall pause and resume so the transport break is not added to the
kept take.

### REQ-KVH-003 — Keep remains explicit

**WHEN** a scored karaoke run opens the shared score card, the system shall
prepare the replay in memory and shall not write voice audio to local history
until the singer chooses **Keep in Hear Yourself**.

### REQ-KVH-004 — Discard is complete

**WHEN** the singer closes the score without keeping the replay, or a run ends
without a score, the system shall discard the temporary recording and contour.

### REQ-KVH-005 — Group by local song session

**WHEN** a karaoke replay is kept, the system shall save it with source
`karaoke`, the local song session's stable comparison key, a song-title
snapshot, the pitch score metrics, and its microphone pitch/energy contour.
Repeated takes from the same local song session shall enter the same Hear
Yourself thread.

### REQ-KVH-006 — Preserve local privacy

**Ubiquitous:** Karaoke voice takes shall use the local-only voice-take service.
The system shall not upload the audio, source-song identity, title, waveform,
or score as part of this flow.

### REQ-KVH-007 — Explain capture failures without losing the score

**IF** the browser cannot record or decode the temporary microphone replay,
the score card shall keep showing the completed pitch score and shall explain
that the replay could not be prepared.
