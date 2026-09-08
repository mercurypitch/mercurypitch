# Guitar recorder voice controls

Status: implemented and locally verified, 2026-09-08. Publishing to draft PR
741; cloud CI and owner microphone audition remain the final checks.

## Scope and decisions

Free form and Play along keep their existing UI and audio owners. Extend the
room's shared voice-command factory; do not introduce another speech listener,
recorder, playback graph or automatic microphone permission request.

- Free form transport commands address the selected Recording/Notes audition,
  including its Current amp/Clean/Saved amp choice. Play along transport commands
  continue addressing the backing song.
- Play/Resume starts playback, Pause retains position, Stop rewinds playback,
  From the top rewinds and plays, and Go to start rewinds without playing.
  Forward/Back defaults to ten seconds; spoken amounts use the existing grammar
  and clamp to the current source's bounds.
- Record, Record a melody, Record idea and Start recording invoke the existing
  explicit recorder start action. Repeating Record never toggles it off.
- During preparation, Stop/Stop recording cancels the start. During capture,
  those commands finish the take and open its normal review. They do not discard
  it or stop existing monitoring. Stop recording does not stop an idle audition.
- Recording cannot be paused or sought. Other transport commands explain that
  capture must finish first. Saving cannot be restarted or finalized twice.
- Empty free form explains that a melody must first be recorded/opened. Missing
  selected audio/notes, MIDI-only input and pending playback get honest feedback.
  Unsupported audition speed/stem controls are not offered as working commands.
- Focused sheets, route changes, tuning/calibration and suspended rooms preserve
  their input guards. No commands remain registered after leaving the room.
- Wake-word playback detection includes recorded audio and synthesized notes.
  Voice control remains opt-in and retains the shared recognizer/settings.

## Tasks and verification

- [x] Cover aliases, exact matching, bounds, empty-source feedback, pending Play,
      capture/preparation/saving and unsupported capabilities in focused unit tests.
- [x] Connect free-form transport and recording to the existing room registry.
- [x] Exercise registration, overlay suspension and cleanup through the mounted
      room, not just a duplicate transport fixture.
- [x] Run a local-browser regression using real recording/audition controllers
      and injected speech results (no physical microphone or cloud speech required).
- [x] Update the recorder spec/testing notes and verify discoverability in the
      existing voice-command browser. This standalone room has no spotlight tour;
      the main app's separate Guitar tour does not own these controls.
- [x] Run scoped formatting/lint and tests and inspect the diff.
- [ ] Publish to draft PR 741 and verify fresh cloud CI. Full affected-workspace
      CI remains authoritative; do not merge this PR here.

Browser evidence: `src/e2e/guitar-recorder-voice.spec.ts` covers selected
Recording and Notes transport, no input acquisition on audition, and explicit
voice capture through the real worklet, worker, IndexedDB and review drawer.
Speech-service results and guitar input are synthetic; these tests do not claim
physical speech recognition accuracy or hardware round-trip latency.

The previous PR Gate run 34252164591 failed the separate live-history test:
capture safely ended with "Recording processing fell behind" during page
screenshots, one of which took 1.92 seconds. That exceeds the 65,536-sample
buffer budget at usual audio rates. The test now attaches the already-painted
canvas bitmap while capturing and takes a full-page screenshot after Stop.
It still requires six seconds of active capture, visible sustained note ink,
desktop/phone geometry and the moving-tab NOW marker. Capture limits and
processing are unchanged. The four relevant browser cases pass concurrently
locally; the affected CI shard must verify the constrained-runner result.

## Limits

This adds command routing, not polyphonic transcription or animation. Voice
recognition is separate from the guitar DI path: a speech-capable microphone
must hear the words. Browser permission/autoplay restrictions still apply.
