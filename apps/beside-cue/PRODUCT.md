# Beside Cue app

<!-- impeccable:product-schema 1 -->

## Platform

Adaptive SolidJS web application with an Android Capacitor shell. The first public build targets Android internal testing; the web build remains a high-fidelity functional prototype.

## Users

Adults who already know what they want less of and what they would rather do, but sometimes lose that choice in a small moment of autopilot.

## Product purpose

Beside Cue helps someone notice an unhelpful pull and begin one tiny action they chose in advance. Success is a useful turn back toward the person's own life, followed by quiet—not more time spent inside the product.

## v0 product contract

- One active cue in the interface; the domain stores a collection so this limit can grow later.
- A cue pairs private user-authored pull text with one concrete B-side action.
- **Cue me now** completes the whole loop without notification permission.
- One optional daily cue can use a fixed preset or a custom local time. It is
  deliberately gentle, arrives around that wall-clock time, and can be removed
  without removing the active cue.
- Choosing the B-side records one local outcome. **Not now** is neutral.
- Progress shows today's and the trailing seven days' B-side choices without streaks or failure states.
- Cue content and history remain on-device. No account, ads, analytics, payments, or cloud sync.
- The app is not treatment, diagnosis, abstinence monitoring, or a medical device.

## Initial implementation slice

The first slice includes onboarding, starter/custom cue creation, the home
surface, manual and daily cue presentation, local outcome history, progress
reflection, pause/resume, daily scheduling, and reset. Daily intent remains in
the pure domain package; a reusable runtime adapter performs foreground web or
native OS delivery.

## Product principles

1. Replace, do not shame.
2. Ask permission before interrupting.
3. Make the next action tiny and concrete.
4. Let quiet be part of the reward.
5. Earn a place in someone's day, then give the day back.

## Accessibility and privacy

Every action works without sound or motion. Touch targets are at least 48 dp, text remains usable at 200%, focus is visible, and reduced motion removes travel and rotation. Sensitive pull and B-side content never appears on a lock screen by default.
