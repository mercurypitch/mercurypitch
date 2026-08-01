# EARS Specification — Voiceprints (capture, device/cloud sync, sharing)

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-08-01 | Scope: voiceprint records — where they
> come from, what the device keeps, what an account keeps, and what happens
> when identities change on one device.

**Source:** `src/db/services/voiceprint-service.ts`,
`src/features/mirror/voiceprint-share.ts`,
`src/components/account/VoiceSection.tsx`,
`src/features/onboarding/FirstLight.tsx`, `src/features/mirror/MirrorApp.tsx`,
`workers/db-worker/migrations/0010_voiceprints.sql`,
`workers/db-worker/src/auth.ts` (`USER_OWNED_TABLES`)
**Tests:** unit — `src/tests/` (service-level pending); end-to-end — the
scenarios in §6 are the intended Playwright suite (not yet written).

---

## 1. Capture

### REQ-VPR-001 — Every measured voice becomes a record
**When** a Voice Mirror run completes, or the onboarding voiceprint beat
completes, the app shall save a voiceprint record
`{ id, summary, twin, source, takenAt }` with `source` `'mirror'` or
`'onboarding'` respectively.

### REQ-VPR-002 — Derived numbers only
**Ubiquitous:** A voiceprint record shall contain derived summary numbers and
the twin's name only — no audio and no pitch frames. (Open decision D1 below
proposes an optional small downsampled trace for card art.)

## 2. Device storage

### REQ-VPR-003 — Local first, never lost
**Ubiquitous:** Saving shall write the device copy first (localStorage,
newest-first); a failed or unavailable cloud write shall not lose the take or
surface an error at the moment of capture.

### REQ-VPR-004 — Device cap
**Ubiquitous:** The device shall keep at most 12 records (`LOCAL_CAP`),
evicting the oldest; the uncapped history lives on the account.

## 3. Account sync

### REQ-VPR-005 — Signed-in saves reach the account
**While** signed in with a configured API, a save shall also create a cloud
row keyed to the signed-in user.

### REQ-VPR-006 — Sign-in rescues device takes
**When** a user signs in, device records the account does not have shall be
uploaded exactly once (single-flight guard; identity = `takenAt`, so retried
or overlapping syncs cannot duplicate a take).

### REQ-VPR-007 — Listing
**Ubiquitous:** The voiceprint list shall show, newest first: signed out —
the device records; signed in — the account history merged with device
records, de-duplicated by `takenAt` (a just-made take shows before its upload
lands).

### REQ-VPR-008 — Cross-boundary identity
**Ubiquitous:** `takenAt` is the identity of a take across the device/cloud
boundary (row ids differ per side and shall not be used for de-duplication).

## 4. Erasure and identity changes on one device

### REQ-VPR-009 — Account erasure is complete server-side
**When** an account is deleted, every cloud voiceprint row of that user shall
be erased (voiceprints is in `USER_OWNED_TABLES`).

### REQ-VPR-010 — Device copies are device data
**Ubiquitous:** Account deletion shall not delete the device's local records —
they were made on this device and belong to whoever is holding it. (This is
why a freshly deleted account followed by another sign-in still shows the
device's latest print.)

### Open decision D2 — who may adopt a device take
Today, REQ-VPR-006 uploads device records into **whichever** account signs in
next. On a shared or multi-account device that can move singer A's take into
singer B's account. Options:

1. Current: adopt-all (device = one singer, simplest; what shipped).
2. Tag each record at capture with the identity that made it (anonymous or
   user id); sign-in adopts only anonymous-made and own records, and shows a
   one-time "keep these on this account?" prompt when foreign-tagged records
   exist.
3. Always prompt before adopting anything.

Owner decision pending; once made, this section becomes REQ-VPR-011.

## 5. Sharing and the settings card

### REQ-VPR-012 — The flip is the export
**Ubiquitous:** The settings voiceprint card shall show the twin portrait on
its front and the stats card (portrait + range/accuracy/steadiness — the same
canvas the share path exports) on its back; the Share control shall export
whichever side is visible.

### REQ-VPR-013 — Share fallback
**Ubiquitous:** Sharing shall use the Web Share API where available, fall
back to a PNG download otherwise, and report "unavailable" only when the
record has no twin portrait to build a card from.

## 6. End-to-end scenarios (Playwright backlog)

1. Anonymous capture → record visible in settings, survives reload.
2. Anonymous capture → register → record appears in the account (REQ-VPR-006)
   and on a second signed-in browser context.
3. Signed-in capture → visible on another device signed into the same account.
4. Delete account → cloud gone (list empty on a fresh context), device copy
   still shown locally (REQ-VPR-009/010).
5. Delete account → sign in with a different account on the same device →
   behavior per the D2 decision.
6. Thirteen captures anonymous → oldest evicted locally (REQ-VPR-004).
7. Flip card → Share exports the stats variant; front exports the face
   variant (REQ-VPR-012).
