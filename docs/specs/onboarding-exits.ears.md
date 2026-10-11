# Onboarding exits: EARS Requirements

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-10-11 | Scope: every way out of the First Light
> onboarding, where each one lands, and what each one counts

---

**Source:** `src/features/onboarding/FirstLight.tsx` (the rail and its
handlers: `handleSkip`, `handleNotNow`, `handleForkNotNow`,
`handleDismissAccount`, `handleMicDenied`, `handleAnotherVoiceprint`);
`src/features/onboarding/beats/BeatFirstLight.tsx` ("Continue without the
mic"); `src/features/onboarding/beats/BeatFork.tsx` and
`src/features/onboarding/beats/BeatPrints.tsx` ("Make another voiceprint");
`src/stores/onboarding-store.ts` (`openBeat`, `advanceBeat`, `markMicDenied`)
**Tests:** `src/features/onboarding/FirstLight.test.tsx`,
`src/features/onboarding/beats/BeatFork.test.tsx`,
`src/tests/onboarding-launch-gift-flow.test.tsx`,
`src/e2e/onboarding.spec.ts`, `src/e2e/onboarding-mic.spec.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Background: the owner's decisions of 10 and 11 October 2026, numbered as in
the onboarding plan. V1 and V8: one way out, and skipping takes a deliberate
tap. V3: skipping lands on the Map without a voiceprint. V6: the welcome's
way out is a close button. V9: every "Not now" lands on the Map. V10:
"Continue without the mic" stays. V12: returning singers keep "Make another
voiceprint". The event names are the funnel's (`src/lib/funnel-event-catalog.ts`).

## One way out: `EX-001` to `EX-002`

### REQ-EX-001: One skip per beat, at the top

**Ubiquitous:** Every beat except the Map shall offer exactly one skip, a
control that declines the rest of the beat's path, in the rail at the top of
the frame, and no skip inside the beat ("Skip", "Not now" or "Take me in").
The Map offers none: its rooms and its own button are the way on. Buttons
that take a returning singer somewhere specific (REQ-EX-010, and the prints'
"Explore your voice constellation") are destinations, not skips. Verified by
"one way out on every beat" in `FirstLight.test.tsx`.

### REQ-EX-002: The way out comes after the beat for the keyboard

**WHEN** the beat changes, focus shall move to the new beat's heading, and
the rail shall follow the beat in the DOM, so Tab reaches the beat's own
controls before the way out, while the rail still shows at the top right.
Verified by "focus on a beat change" in `FirstLight.test.tsx`.

## Where each exit lands: `EX-003` to `EX-008`

### REQ-EX-003: The welcome's close button leaves the intro

**WHEN** the visitor closes the welcome (the X, "Skip the intro"), the flow
shall send `onboarding_skipped` and finish, and the intro shall not open
again on reload. Verified by "carries one button, and the way out is a close
button at the top" in `onboarding-launch-gift-flow.test.tsx` and "skipping
at beat 1 sticks across a reload" in `onboarding.spec.ts`.

### REQ-EX-004: "Not now" lands on the Map

**WHEN** the visitor taps "Not now" on First light, the voiceprint, the
twin or the prints, the flow shall open the Map, stay open, and send
`onboarding_skipped`, never `onboarding_track_short`. Verified by "takes
the %s beat to the Map, counted as a skip, with the flow still open" in
`FirstLight.test.tsx`.

### REQ-EX-005: Nothing is measured on the way out

**IF** the visitor leaves the voiceprint before it finishes **THEN** the
flow shall land on the Map with no voiceprint recorded. Verified by "makes
no voiceprint on the way: leaving the voiceprint mid-run lands with none" in
`FirstLight.test.tsx`.

### REQ-EX-006: Leaving the twin keeps the finished voiceprint

**WHEN** the visitor taps "Not now" on the twin, the voiceprint they just
finished shall stay in this browser, the account ask (Keep) shall be
skipped without sending `onboarding_keep`, and the Map shall say the
voiceprint is saved in this browser only and offer to save it, with the
launch gift while one is featured. Verified by "leaves the twin by "Not now"
for a Map that offers to keep the voiceprint, with the gift" in
`onboarding-launch-gift-flow.test.tsx`.

### REQ-EX-007: The Fork's "Not now" is the short track

**WHEN** the visitor taps "Not now" on the Fork, the flow shall land on the
Map with nothing measured and send `onboarding_track_short`, the event of
the "Take me in" card it replaced, never `onboarding_skipped`. Verified by
""Not now" takes the Fork to the Map with nothing measured, counted as the
short track" in `FirstLight.test.tsx` and "the Fork asks one question, and
"Not now" reaches the Map without a voiceprint" in `onboarding-mic.spec.ts`.

### REQ-EX-008: Keep's "Not now" declines the account

**WHEN** the visitor taps "Not now" on Keep, the flow shall send
`onboarding_account_dismissed`, quiet the account ask, and move on to the
Map. Verified by ""Not now" sits in the rail, moves on to the Map and quiets
the ask" in `onboarding-launch-gift-flow.test.tsx`.

## Without a microphone: `EX-009`

### REQ-EX-009: "Continue without the mic" lands on the Map

**IF** First light cannot hear a working microphone (access blocked, the
take failed, or nothing heard by the nudge) **THEN** it shall offer
"Continue without the mic", which sends `onboarding_mic_denied`, marks the
microphone declined and lands on the Map with the flow open. The Fork shall
not be offered, and the Map shall offer no launch gift. Verified by "a
silent input is not treated as a working microphone" in `onboarding.spec.ts`
and "offers nothing in onboarding to a visitor who declined the microphone"
in `onboarding-launch-gift-flow.test.tsx`.

## Returning singers: `EX-010`

### REQ-EX-010: "Make another voiceprint" opens the Voice Mirror

**WHERE** a voiceprint is already on this device, the returning Fork and
the prints shall offer "Make another voiceprint" as a second button, which
sends `onboarding_another_voiceprint`, leaves the intro and opens
`/mirror`. The first-run Fork shall not offer it. Verified by "opens the
Voice Mirror from the %s beat, counted as another voiceprint" in
`FirstLight.test.tsx`, and by "offers a fresh voiceprint second (owner
decision V12)" and "offers exactly one button, and it starts the
voiceprint" in `BeatFork.test.tsx`.
