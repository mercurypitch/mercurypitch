# Guitar free form: Live, Replay and Practice

Owner-approved 2026-09-08. Implementation extends the existing Guitar Night
recorder; the separate Rehearse the tab layout remains unchanged.

## Interaction contract

- **Live** shows current input at NOW with six seconds of bounded history.
  Default for an empty session. No automatic input permission, monitoring,
  recording worker or saved history. Listening and the You monitor stay explicit.
- **Replay** follows the selected original recording or synthesized notes,
  without scoring. Frozen recorded history remains available separately from
  timeline audition. Keep the existing amp/source choices.
- **Practice** uses an explicitly accepted immutable melody revision and the
  existing Rehearse scheduler, scoring controller, results and development panel.
  The optional synthesized guide follows the same clock as the targets.
- Record is a separate explicit action. Settle a prior practice attempt before
  admitting capture; Stop preserves review/Keep. No implicit note exclusions.
- Live hides, but does not delete/unload, the selected melody. Preserve its
  position and edits. Input selection never hijacks an active mode. Retain the
  user's DI channel/amp/monitor through mode changes, release on Off/exit.
- Keep one stable stage/camera, the independent Listening column and two-row
  rail. Route buttons, Space and voice through the same active transport.
- Group Live/Replay/Practice with the session title in the header, left aligned;
  keep My melodies, Tune and Session on the right. At narrow widths the mode
  controls wrap within the same header rather than taking a separate stage strip.
- Room mic Practice retains audible-mix consent. Direct input has no irrelevant
  room-feedback warning. Pending operations cannot revive after cancellation,
  source changes, device loss or leaving the session.
- Practice speed retimes guide and targets together, not the saved revision.
  A recording editor's display BPM remains a separate operation.

## Phases and gates

- [x] M0: review and confirm modes, ownership and timing scope.
- [x] M1: tested mode coordinator; borrowed scheduler graph; opt-in retained DI
      route with a separately drained/finalized scoring take. Old host defaults
      remain unchanged.
- [x] M2: read-only existing-detector observations; bounded live-history collector
      and stage adapter; empty default and visible mode selection.
- [x] M3: direct Practice admission, shared accepted-target validation, score
      controller/results/dev dock and Keep; A/B, tempo/count-in/guide controls.
- [x] M4: transitions, source recovery/deletion, permission/device failures,
      keyboard/voice, mobile/desktop browser and audio continuity verification.
      Focused tests and local browser verification complete. Same draft PR;
      fresh cloud gates and owner audition remain required before ready/merge.

## Local verification — 2026-09-08

- Session/Practice: 45 tests, including partial-result repeat, stale Stop and
  cancellation, actual Keep/IndexedDB admission, and the real scoring controller.
- Additional focused suites cover the collector, input-route retention, borrowed
  graph disposal, accepted revisions, results, voice, decks and shared consent.
  Existing Room/Rehearse/recording replay regressions were checked as well.
- New Chromium modes suite: seven cases pass in one run. Real rendered monitor
  PCM survives completed Practice → Live → active Replay → Practice with one
  input request. The real scorer grades six targets against an immutable revision.
- Real-mouse seek/A–B and 320/390/1440px hit targets pass. Separate existing
  recorder transport checks cover Notes seeking and desktop/phone Replay layout.
- Independent review caught and fixed partial-result repeat identity, saved-take
  admission, asynchronous restart, Listening overlap and the mobile debug dock.

These checks use isolated fixture storage and synthetic input. They do not prove
physical-interface latency, native speech recognition or new chord accuracy.

Header follow-up: the seven-case Chromium suite passes with additional
320/390/1440px assertions that all three modes belong to the session header,
remain pointer-accessible at 44px or larger, and sit between the title and room
tools on desktop. Desktop/phone screenshots were inspected. The Room component's
37 existing tests also pass. This is a layout relocation, not chord integration.

## Verification requirements

Test real state transitions and evidence: no audio/storage from merely selecting
Live; silence/held notes/restrikes/MIDI releases; hard retention bounds; capture
and score boundaries never overlap; matching revisions reused; late starts and
consent rejected; same score fixtures yield identical results through both hosts.
Cover real-mouse timeline/A-B, camera persistence, popup stacking, focus, mobile
targets, and live/offline clock distinctions. Browser probes do not establish
physical interface latency; the owner verifies that by playing.

## Deferred deliberately

Synchronized original-audio accompaniment in Practice needs a separate scheduled
media clock and timing-compatibility policy after corrections. Both existing
Replay sources remain supported. No new live chord-transcription claim, drum/amp
tuning, editor or animation work. Live audio recognition remains monophonic;
actual polyphonic MIDI events remain distinct.
