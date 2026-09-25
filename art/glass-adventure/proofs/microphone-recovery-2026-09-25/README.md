# Microphone recovery verification

The September 25 follow-up fixes misleading startup-error guidance, ignored
saved input, and capture/lock ordering. See the
[implementation record](../../plans/MICROPHONE-RECOVERY-2026-09-25.md).

## Browser evidence

- `glass-adventure-mic-recovery.e2e.ts`: four passing cases. Existing cooperating
  tab handoff and stale-claim retry remain covered. New cases exercise a saved
  named input when the system default fails, recovery selection, retained
  preference after reload, and Escape inside the microphone picker.
- `glass-adventure-encore-examples.e2e.ts`: the phone microphone recovery,
  delayed-example/capture-ordering and close/reopen ownership cases pass.
- Recovery widths/heights: 320×568, 844×390, 320×844, 390×844, 768×844, 1180×844.
  Retry remains in the viewport, controls retain 44-pixel touch targets, the
  recovery card does not overlap Tune, and the document does not overflow.
- Attached screenshots were inspected. On short screens details scroll inside
  the card while the retry button remains outside that scrolling region.

These are Chromium tests with simulated microphone streams. Encore uses touch
input; the adventure recovery matrix uses keyboard/mouse. World draw calls are
suppressed in these focused tests; earlier real-raster world proofs are separate.
An earlier rendered run also passed all four microphone cases. Repeated optional
screenshots at changing viewport sizes stalled software rendering, so the
focused suite now isolates microphone/DOM behavior, like the existing Encore
suite. No microphone assertions were removed.

## Regression evidence

- Direct entry with a stored working input failed before the host applied it.
- Old missing-device fallback erased a newer device request before preference
  changes were serialized with teardown.
- Late fallback erased an explicitly reselected device before revision ownership.
- Page exit could advertise a free lock while capture was live, including an
  acquisition queued before its claim. Teardown and claim-generation cases pass.
- At 320×568, the old retry button ended at 586.375 pixels. The constrained
  layout keeps it visible with details expanded.

Focused results: 43 Glass tests; 39 pitch-engine tests. Relevant TypeScript,
ESLint and formatting checks passed. Generated index is current. Cloud CI on the
pushed PR head remains the complete gate. Physical input and mobile-device
acceptance require the owner's retest.
