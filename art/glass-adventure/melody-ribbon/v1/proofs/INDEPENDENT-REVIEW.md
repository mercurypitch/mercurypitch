# Melody ribbon v1 — independent review

Reviewed 2026-09-23 against `README.md` and
`../../plans/MELODY-RIBBON-LEARNING-SPEC.md` as a reference-only listening
audition. No unresolved blocking issue remains in the reviewed files.

## Source findings

- SVG geometry and oscillator automation consume the same compiled pitch
  contour. Pace scales both timelines, starting note transposes only the audio,
  and the two phrases in **Two windows** share the same explicit silent breath
  interval used by the visible gap and playback status.
- Anchors now carry `completedAt`, the end of their landing. Gold marker state
  therefore represents a completed landing rather than arrival at its start.
- Playback cancellation is generation-scoped. A stale rejection cannot cancel
  a newer attempt, and a delayed `resume()` that resolves while hidden suspends
  its captured context without suspending a newer visible attempt.
- The melody picker exposes one radiogroup with roving focus and radio state.
  Arrow keys wrap, and Home/End select and focus the first/last phrase.
- The target and completed prefix now differ by stroke shape and width as well
  as colour. Each stroke measures at least 3.88:1 against both endpoints of the
  exhibit background.

## Local browser evidence

Checked through the QA server's `/@fs/` URL on port 5341.

- Play, explicit stop, restart, natural completion, and restart after completion
  all returned the expected button and status state.
- Changing phrase during playback stopped and reset the old reference.
- **Two windows** hid the cursor and announced **Take a breath** during its
  silent 0.85-second gap, then resumed the second phrase.
- Navigation away/back stopped playback, preserved a paused presentation, and
  allowed a fresh reference to start without a console warning or error.
- The first anchor remained unpassed during preroll and through the first
  landing sample; it changed only on a later render after the 0.4-second
  landing completed.
- A temporary delayed-`resume()` test shim held the promise pending, dispatched
  the hidden-page transition, and then released it. The result was one suspend
  call, `AudioContext.state === "suspended"`, **Hear melody**, and **Paused while
  away**. The page was reloaded afterward to restore the native environment.
- At the phone-width check there was no horizontal overflow, compact markers
  measured about 10 px, and all controls remained within the content width.
  Home/End keyboard checks updated focus, `aria-checked`, and the visible phrase
  together.

The final browser console contained no warnings or errors during the ordinary
interaction and history-restoration checks.
