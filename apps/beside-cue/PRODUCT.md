# Beside Cue app

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adults who already know what they want less of and what they would rather do, but sometimes lose that choice in a small moment of autopilot.

## Product purpose

Beside Cue helps someone notice an unhelpful pull and begin one tiny action they chose in advance. Success is a useful turn back toward the person's own life, followed by quiet—not more time spent inside the product.

## v0 product contract

- One active plan in the interface; the domain currently stores it as a `Cue`
  so the collection can grow later without a migration in this release.
- A plan pairs private Side A text with one concrete Side B action.
- **Cue me now** completes the whole loop without notification permission.
- One optional daily cue can use a fixed preset or a custom local time. It is
  deliberately gentle, arrives around that wall-clock time, and can be removed
  without removing the active plan.
- Choosing Side B records one local outcome. **Not now** is neutral.
- Progress shows today's and the trailing seven days' Side B choices without streaks or failure states.
- Plan content and history remain on-device. No account, ads, analytics, or cloud sync.
- An optional **BeSideCue Pro** purchase supports the work. It gates nothing:
  every part of the plan-and-cue loop stays free, and the app never asks for a purchase
  outside Settings. Entitlements are held by the store, not by this device.
- The app is not treatment, diagnosis, abstinence monitoring, or a medical device.

## Initial implementation slice

The first slice includes onboarding, starter/custom plan creation, the home
surface, manual and daily cue presentation, local outcome history, progress
reflection, pause/resume, daily scheduling, and reset. Daily intent remains in
the pure domain package; a reusable runtime adapter performs foreground web or
native OS delivery.

The shared SolidJS web interface ships inside Android and iOS Capacitor shells.
The first public build targets Android internal testing; the browser build
remains the high-fidelity development and functional prototype surface.

## Public vocabulary

- A **Pull** is a recurring urge or autopilot habit someone wants to notice
  sooner.
- **The Scroll** is the character that personifies the endless-scrolling Pull.
  It is never a cue.
- **Side A** is how the Pull usually plays out.
- **Side B** is one small, concrete action chosen instead.
- A **plan** is the saved Side A and Side B pair. The current internal domain
  type remains `Cue` for data compatibility.
- A **cue** is a signal that brings the plan back into view: a context,
  **Cue me now**, or an optional reminder.
- A **reminder** is an optional scheduled cue.

Operational controls, errors, permissions, and scheduling use literal
language. Record metaphors belong in Corky dialogue and brand headlines.

## Product principles

1. Replace, do not shame.
2. Ask permission before interrupting.
3. Make the next action tiny and concrete.
4. Let quiet be part of the reward.
5. Earn a place in someone's day, then give the day back.

## Accessibility and privacy

Every action works without sound or motion. Touch targets are at least 48 dp, text remains usable at 200%, focus is visible, and reduced motion removes travel and rotation. Sensitive Pull and Side B content never appears on a lock screen by default.
