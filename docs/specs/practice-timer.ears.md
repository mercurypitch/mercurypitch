# Practice Timer — EARS Requirements

Requirements for the optional voice-rest clock: how singing time accrues, when
a break is prompted, and what the ambient readout shows.

**Source:** `src/stores/practice-timer-store.ts` — the phase machine and its
persisted settings; `src/features/practice-timer/PracticeTimerPill.tsx` — the
readout; `src/components/SettingsPanel.tsx` — the Practice Aids controls;
`src/lib/mic-manager.ts` — the device-level mic state the clock follows
**Tests:** `src/tests/practice-timer-store.test.ts`,
`src/features/practice-timer/PracticeTimerPill.test.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Enablement — `REQ-PT-001..003`

### REQ-PT-001 — Off by default

**WHEN** no preference has been stored, the practice timer **shall** be
disabled.

### REQ-PT-002 — Inert while disabled

**WHILE** the timer is disabled, it **shall** accrue no time, raise no
reminder, and render no readout.

### REQ-PT-003 — Disabling discards the phase

**WHEN** the user disables the timer, the app **shall** return it to a fresh
practice phase with zero elapsed time.

## Accrual — `REQ-PT-004..006`

### REQ-PT-004 — Practice counts singing, not screen time

**WHILE** the timer is enabled and in its practice phase, elapsed time
**shall** advance only while the microphone device is open.

### REQ-PT-005 — A break counts silence

**WHILE** the timer is in its break phase, elapsed time **shall** advance only
while the microphone device is closed.

### REQ-PT-006 — Device-level, not per-page

The clock **shall** follow the shared microphone device, so moving between mic
surfaces does not restart it.

## Intervals — `REQ-PT-007..009`

### REQ-PT-007 — Configurable

The user **shall** be able to set the practice interval and the break interval
in whole minutes.

### REQ-PT-008 — Defaults

**WHEN** no intervals have been stored, the app **shall** use 20 minutes of
singing and a 5-minute break.

### REQ-PT-009 — Out-of-range values are clamped

**IF** an interval outside 5-120 minutes (practice) or 1-30 minutes (break) is
submitted, **THEN** the app **shall** clamp it to the nearest bound rather than
reject or store it.

## Reminders — `REQ-PT-010..013`

### REQ-PT-010 — Break prompt

**WHEN** the practice interval is reached, the app **shall** enter the break
phase and show a warning notification naming both intervals.

### REQ-PT-011 — Break-over notice

**WHEN** the break interval is served, the app **shall** return to the practice
phase and show a success notification.

### REQ-PT-012 — Reminders never stack

Phase notifications **shall** share one channel, so only the most recent is
ever on screen.

### REQ-PT-013 — Nothing is blocked

A due break **shall not** stop playback, close the microphone, or otherwise
prevent the user from continuing to sing.

## Readout — `REQ-PT-014..017`

### REQ-PT-014 — Ambient only

The readout **shall** be a fixed pill outside the page content, positioned
clear of the notification stack and the mobile tab bar.

### REQ-PT-015 — Appears when there is something to say

The readout **shall** be visible **WHILE** the timer is enabled and either the
phase is a break or at least one second of singing has accrued.

### REQ-PT-016 — Phase can be ended early

The user **shall** be able to end the current phase from the readout — taking
the break early, or resuming from one — without a notification.

### REQ-PT-017 — Not a live region

The readout **shall not** be an ARIA live region; announcing a value that
changes every second would talk over everything else. The phase notifications
(`REQ-PT-010`, `REQ-PT-011`) are the announcement.
