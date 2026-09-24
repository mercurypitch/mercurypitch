# Pre-merge microphone recovery UI proof

Captured from the actual shared game in the BesideCue development host by
`glass-adventure-mic-recovery.e2e.ts`. These are Chromium desktop and emulated
phone viewports, not physical-device performance evidence. The test uses an
explicit synthetic microphone source and real shared microphone ownership.

- `glassworks-mic-handoff-desktop.png`: actionable same-origin ownership error.
- `glassworks-mic-handoff-phone.png`: 44px handoff action, legible computed
  colors, no horizontal overflow and no collision with camera tuning controls.

The test checks that the other tab's track stops before this tab captures.
A second case verifies that an expired claim cannot impersonate an active owner,
and that an OS-style NotReadableError offers retry rather than a false promise
of force-unlocking another application. No user microphone audio was recorded.

The graphics reproduction, limits and full review receipt are in
`../../plans/PR807-PREMERGE-REVIEW-2026-09-24.md`.

## Narrow phone controls

`phone-controls.png` and `phone-tuning-panel.png` capture the actual rendered
scene and development tuning panel at 320 x 740 in Chromium touch emulation.
The regression first reproduced a 12px overlap between Tune and Help; the fixed
shared rail keeps at least 8px clear at widths 320, 390, 768 and 1180. Real taps
open both Help and Tune, a mouse drag selects no control text, the movement
context menu is prevented, and native CDP touch still jumps. The existing
three-finger movement/orbit/jump/cancellation case also passes. Safari-prefixed
selection and callout rules are included; physical iPhone acceptance remains
with the owner.

Proof screenshot capture can be repeated with `GLASS_MIC_RECOVERY_PROOF=1`
for the mic spec or `GLASS_CONTROLS_PROOF=1` for the controls spec. CI still
asserts layout, styling and actual interactions; screenshot readback is optional
because it stalled on shared CI GPU runners.
