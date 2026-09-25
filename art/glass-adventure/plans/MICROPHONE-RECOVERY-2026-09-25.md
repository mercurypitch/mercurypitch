# Microphone startup recovery — September 25

The owner again encountered “Another app or browser outside this Glassworks
session may be using the microphone” without knowing of another active capture.
This is a follow-up inside PR #861, before device acceptance. No new level,
merge, release, OS audio restart or global input change is included.

## Findings

1. `NotReadableError`, `AbortError` and the legacy `TrackStartError` were all
   classified as device contention. Those names indicate startup failures and
   do not establish that another app owns the microphone. Keep the original
   name/message as optional technical details and use neutral recovery advice.
2. The older Beside Cue games apply the remembered microphone before capture;
   Glassworks bypassed that preference. A fresh direct entry therefore opened
   the system default, while visiting another capture surface first could make
   it inherit a different input. The browser regression reproduces this with
   a failing default and a working, saved explicit microphone.
3. `pagehide` removed the cross-tab lock before the capture owner had stopped
   its stream. Ordinary release has a two-second linger. A cached page or
   in-flight acquisition could therefore retain capture after advertising a
   free device. Teardown must precede publishing a free lock.

The local desktop also reported a default input routed to output loopback and
a remembered physical-input profile that no longer existed. No physical mic
capture was present in that snapshot. This is an environment clue, not proof
of which browser exception caused the owner's specific attempt. The automated
hardware probe could not represent that browser and is not a hardware pass.

## Recovery behavior

- Direct entry respects Beside Cue's saved input; the standalone web host has
  its own scoped preference. An unplugged exact input can fall back through
  the existing microphone manager and is forgotten only after successful open.
- After a retryable failure, choose a named input and press **Try again**.
  Choosing does not start capture or take a microphone from another surface.
- A real cooperating app-tab claim still offers **Use it here**. Generic
  browser/device startup failure offers retry, not a promise of OS takeover.
- Browser failure details are local, escaped text, behind **Technical details**.
  Only the original browser error name/message are shown; the application adds
  no audio, device identifiers, constraints or lock records to those details.
- Audio unlock remains in the Start gesture. Cancelled input preparation cannot
  open a late microphone, and every acquired stream retains its owning session.
- Preferred-device changes run inside the manager queue, so an older missing
  device fallback cannot overwrite a newer request. A selection revision also
  protects an explicit A-to-B-to-A choice from an old completion.
- The retry action stays visible on short phones; expanded details scroll within
  the card. Focused input fields own Escape, and releasing a movement key inside
  a field still clears the held direction.

## Verification checkpoint

- Red: direct entry ignored a saved working input and failed the real-browser
  calibration assertion. The startup-failure test also reproduced the old
  misleading copy instead of a named-input recovery path.
- Red: package lifecycle regressions demonstrated capture remaining live after
  pagehide and original browser diagnostics being discarded.
- Red: a queued newer device request was erased by an older exact-device
  fallback; an A-to-B-to-A selection was erased by the old completion. Both
  regressions now pass.
- Red: the retry action extended below a 320-by-568 viewport. The constrained
  card and fixed action now pass at that size and in 844-by-390 landscape.
- Green: 43 focused Glass tests, all 39 pitch-engine tests, and package/app
  TypeScript checks. Scoped ESLint, formatting and diff checks pass.
- Green: four real-browser microphone cases cover saved input on direct entry,
  neutral startup recovery, actual manager tab handoff and preference after
  reload. Three touch Encore cases cover recovery in its dialog, guide/capture
  ordering, and closing/reopening with an older audio fade.
- Inspected 320-by-568 and 390-by-844 phone, 844-by-390 landscape and Encore
  screenshots. Layout assertions also cover tablet and desktop widths. These
  cases use synthetic audio and suppress expensive world draw calls so UI and
  microphone assertions are independent of software-rendered pixels. They do
  not establish physical microphone success or device performance.

Evidence: [microphone recovery proof](../proofs/microphone-recovery-2026-09-25/README.md).
The HTTPS preview must be refreshed for owner retesting; PR #861 remains open.

Reference: [W3C Media Capture and Streams, getUserMedia](https://w3c.github.io/mediacapture-main/#dom-mediadevices-getusermedia).
The hardware-error and abort paths are broader than an external app lock.
