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
