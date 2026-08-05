# EARS Specification — Voiceprints (capture, device/cloud sync, sharing)

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.1 | Date: 2026-08-05 | Scope: voiceprint records — where they
> come from, what the device keeps, what an account keeps, and what happens
> when identities change on one device.

**Source:** `src/db/services/voiceprint-service.ts`,
`src/features/mirror/voiceprint-share.ts`,
`src/components/account/VoiceSection.tsx`,
`src/features/onboarding/FirstLight.tsx`, `src/features/mirror/MirrorApp.tsx`,
`src/features/voice-constellation/VoiceConstellationSurface.tsx`,
`src/lib/mirror/legend-catalog.ts`,
`src/lib/mirror/voice-constellation.ts`,
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

### REQ-VPR-006 — Sign-in rescues the account's own takes
**When** a user signs in, device records **tagged to that account** which the
account does not have shall be uploaded exactly once (single-flight guard;
identity = `takenAt`, so retried or overlapping syncs cannot duplicate a
take). Unclaimed records are never auto-uploaded — see REQ-VPR-011.

### REQ-VPR-007 — Listing
**Ubiquitous:** The voiceprint list shall show, newest first: signed out —
every device record, whoever made it; signed in — the account history merged
with the device records **made by this account**, de-duplicated by `takenAt`
(a just-made take shows before its upload lands). Records made anonymously
or under another account stay off the signed-in list.

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

### REQ-VPR-011 — Takes tag who made them (decision D2, 2026-08-01)
**Ubiquitous:** Every record shall carry `madeBy`: the signed-in user's id at
capture, or `'anonymous'` when nobody was signed in. Records from before
tagging (no `madeBy`) count as anonymous. The tag is device-side only and is
never sent to the cloud.

A **real** account decides the tag, not merely a held token. A lazily
provisioned anonymous identity holds a valid token too, and tagging with it
was only safe on the in-place-upgrade path: sign in to an account created
somewhere else and the take matched neither `'anonymous'` (never offered)
nor the account id (never shown) — stranded on the device, invisible
forever. Amended 2026-08-02 after exactly that happened on dev.

### REQ-VPR-014 — Unclaimed takes are offered, never taken
**While** signed in **and** the device holds anonymous/legacy records, the
voiceprint section shall show a notice ("keep these on this account?") with
explicit accept and "Not now" actions. **When** accepted, those records are
retagged to the account and uploaded (retag-first, so a failed upload is
recovered by the next ordinary sync; already-known `takenAt` are skipped).
**When** a password account is REGISTERED on this device, unclaimed records
are adopted automatically — creating the account at the onboarding keep beat
is the consent the notice would ask for; Google and existing-account
sign-ins stay prompt-gated. Records tagged to a **different** account are
never offered and never adopted — their owner sees them by signing in;
everyone sees them signed out.

Records tagged with this **device's own id** are treated as unclaimed: an
anonymous identity's id IS the device id (the worker keys
`/api/auth/anonymous` on it), so they were made here before the device
belonged to anyone. Safe to offer — a device id is per-browser, never
another person's account — and it recovers the takes stranded by the
pre-2026-08-02 tagging. Excluded when the account id equals the device id,
because an in-place upgrade means those takes are already the account's.

### REQ-VPR-015 — "Not now" is quiet, per account
**When** the notice is declined, it shall stay hidden **for that account**
until an unclaimed record newer than the declined set appears; a different
account signing in on the same device is asked independently.

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

## 6. Personal voice constellation

### REQ-VPR-016 — One catalogue drives matching and presentation
**Ubiquitous:** Voice Mirror matching and the personal constellation shall use
the same ordered catalogue of 21 legends and six broad, overlapping voice
bands. The bands are discovery guides; the app shall not present them as
measured per-artist ranges or precise celebrity coordinates.

### REQ-VPR-017 — Saved twins are historical truth
**When** the personal constellation is built, persisted `record.twin` values
shall determine its revealed matches; the app shall not recompute an old twin
from that record's range. The newest record is current, unique older twins are
past matches, null twins are ignored, and names removed from the current
catalogue remain visible as legacy history.

### REQ-VPR-018 — Mystery means not yet matched, not access control
**While** a catalogue legend does not occur in the visible voiceprint history,
the in-app constellation shall show the legend's name and broad band with a
mystery illustration, shall not render or resolve that legend's portrait URL,
and shall describe the state without achievement, completion, or paywall
language. Portrait assets remain public product artwork; mystery presentation
is not a security boundary.

### REQ-VPR-019 — History failures never reveal portraits
**While** voiceprint history is loading, unavailable, or empty, the
constellation shall keep every portrait hidden and show an explicit loading,
error, or first-voiceprint state respectively. A retry shall re-read the
history without replacing it or generating a new match.

### REQ-VPR-020 — One route-backed surface, contextual return
**When** a singer opens the constellation from returning onboarding, Settings,
or their own Profile, the app shall open the same `#/voice-constellation`
surface and preserve the underlying context. Browser Back and the surface's
close control shall return to that context; a directly loaded route shall
close to an in-app tab rather than assuming an external history entry.

### REQ-VPR-021 — Full public reveal is separate
**Ubiquitous:** The personal constellation shall link to the public Voice
Legends gallery for the complete portrait reveal, while keeping saved-match
state and measured range data inside the app.

## 7. End-to-end scenarios (Playwright backlog)

1. Anonymous capture → record visible in settings, survives reload.
2. Anonymous capture → register → record adopts into the new account
   automatically (REQ-VPR-014) and shows on a second signed-in browser
   context; anonymous capture → sign in to an EXISTING account → notice
   shows, accept adopts.
3. Signed-in capture → visible on another device signed into the same account.
4. Delete account → cloud gone (list empty on a fresh context), device copy
   still shown locally when signed out (REQ-VPR-009/010).
5. Two accounts, one device: A's signed-in takes never appear in B's list and
   are never offered to B; anonymous takes are offered to whichever account
   is signed in, once each until declined (REQ-VPR-011/014/015).
6. Thirteen captures anonymous → oldest evicted locally (REQ-VPR-004).
7. Flip card → Share exports the stats variant; front exports the face
   variant (REQ-VPR-012).
8. Open the constellation from returning onboarding, Settings, and Profile →
   the same surface opens; close and browser Back restore each trigger context
   (REQ-VPR-020).
9. Two saved prints with different twins → newest is current, older is past,
   and repeated names appear once; changing the matcher later does not rewrite
   either saved result (REQ-VPR-017).
10. Empty, loading, and failed history → no portrait image requests occur;
    retry reads history again (REQ-VPR-018/019).
11. Direct `#/voice-constellation` load → close lands on an app tab; keyboard
    focus stays trapped while open and returns after close (REQ-VPR-020).
