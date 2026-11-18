# The Google TV app: what it shows, and how it is built

**Status:** parked, 2026-10-25. This is the track's plan, kept on the branch
`feat/android-tv-app` until the work starts. The work starts after the first
official native app release; the iOS second screen and Google Cast come
first (owner, 2026-10-25; decisions 4 and 8 in
[tv-cast-and-google-tv.md](tv-cast-and-google-tv.md)).

**What it is:** the detailed plan for phase P4 of
[tv-cast-and-google-tv.md](tv-cast-and-google-tv.md) ("Google TV app"), and
the answer to the owner's question: does the TV show the whole app?

**Short answer:** no. It is the same app, from the same code, the same
package and the same accounts, but on a TV it opens a TV home with what
works from a sofa with a remote. Karaoke comes first. Other rooms join only
once they have a TV layout and a way to hear the singer on a TV.

---

## 0. What exists, and how this plan uses it

Searched before writing: `docs/plans/` (every TV plan), `docs/specs/`, the
mobile-native plans, and the Android project. Scores are 1 to 5.

| Document                                                                 | Coverage of this track                                                                                                           | Sound | Feasible | Use here                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tv-cast-and-google-tv.md](tv-cast-and-google-tv.md), P4 and section 4.4 | 3: the Play requirements in full (work items 4.1-4.7), why not a native Kotlin app; not what the TV app shows or how it releases | 5     | 4        | **Kept and built on.** This plan details P4; its points (26) are re-estimated in section 6, because P4 assumed the phone's own shell on a D-pad    |
| [tv-karaoke.ears.md](../specs/tv-karaoke.ears.md), `REQ-TV-001..084`     | 4: device class, the remote, the stage, songs, memory, the phone as the mic, and the app's Play requirements                     | 5     | 5        | **Kept.** Section 4 adds `REQ-TV-120..129` for the TV app's own surface, proposed until the work starts                                            |
| [tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md), section 6, phase 3 | 2: manifest and store items; "the native rail and corner tabs by D-pad", that is, the whole phone shell on a TV                  | 4     | 3        | **Superseded on scope** by section 1 here (a TV home, not the phone's rail); its section 3.3 (sync and phone sign-in hidden in native) still holds |
| [tv-and-low-tier-devices.md](tv-and-low-tier-devices.md)                 | 2: the tier work that a 1 GB set needs first                                                                                     | 5     | 5        | **Kept** as a prerequisite                                                                                                                         |
| [search-and-answer-engines.md](search-and-answer-engines.md), section 7  | 2: the TV distribution checklist                                                                                                 | 4     | 5        | **Kept** for the listing (section 5 here)                                                                                                          |
| [mobile-native/README.md](mobile-native/README.md) and its pages         | 1: the phone app this TV app is built from                                                                                       | 5     | 5        | **Kept.** The TV app reuses the native shell's stores, settings and sign-in                                                                        |

Nothing here duplicates those documents: where they already say it, this
plan points to them.

---

## 1. What the TV shows

The phone app has five destinations on its rail (Rooms, Sing or Guitar or
Piano, Ear Lab, Progress, More) and the rooms behind them, most built for a
phone held in one hand with its own microphone close to the mouth
(`apps/mercurypitch/src/shell/shell-navigation.ts`, `premium-rooms.ts`).
On a TV that shape fails in three ways: every screen must work by D-pad in
landscape (Play TV-DP, TV-LO; `REQ-TV-010`, `078`), a room that listens
needs the phone or a USB microphone to hear the singer across the room, and
a 1 GB set holds one light page at a time (`REQ-TV-040`). So the TV app is
the same app with a TV home, and a room joins the TV only with a TV layout
and a microphone path.

### 1.1 Three ways to answer, compared

| Shape                                    | Effort                                                        | Experience                                                               | Maintenance                                  | Review risk on Play's TV track                                                    |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------- |
| The whole phone app on a TV              | Highest: every screen and room to D-pad, landscape, memory    | Uneven: phone-first rooms on a big screen, many needing the phone anyway | High: every phone change needs a TV check    | High: one touch-only control anywhere fails TV-DP                                 |
| **A TV home and the rooms built for it** | Medium: a TV home, karaoke on the stage, a TV settings subset | Focused: sing from the sofa, the phone as the microphone                 | Medium: TV checks only for what the TV shows | Low: a small surface, walked by a D-pad-only test before each release             |
| The stage alone, run from a phone        | Lowest: the stage and a QR                                    | Fine at a party, useless without a phone                                 | Low                                          | Medium: an app that does nothing alone risks Play's minimum-functionality reading |

**Recommended: a TV home and the rooms built for it.**

### 1.2 What the TV app shows, phase by phase

| Area                      | On the phone                                                               | TV phase 1 (TV-1)                                                                                                       | Later                                                                              |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Home                      | The Rooms grid                                                             | A TV home: Sing first, then Songs, Microphone and Settings                                                              | -                                                                                  |
| Karaoke                   | The Karaoke room, the phone's stage                                        | The stage page (decision 7) in host mode: it plays, scores and draws the lyrics, the lane and the trails (`REQ-TV-026`) | Up to about four singers in a jam room on the TV (decision 6, TV-3)                |
| Songs                     | Imports, separation, the library                                           | Demo songs; a song sent from the phone over a direct link (2.8, `REQ-TV-034`); songs already on the TV                  | A queue that guests fill from their phones                                         |
| Microphone                | The phone's own                                                            | The phone as the microphone (P3) or a USB microphone (`REQ-TV-083`); without either, sing with lyrics only              | -                                                                                  |
| Latency                   | The wizard, per route                                                      | The TV's own output delay, measured with the phone as the mic (3.5, `REQ-TV-057`)                                       | -                                                                                  |
| Account                   | Sign-in sheet                                                              | Sign in by scanning a code with the phone (`REQ-TV-082`), on `/link/CODE` (decision 5)                                  | -                                                                                  |
| Subscription              | Subscribe, Restore                                                         | A subscription bought on a phone or the web works after sign-in; "Subscribe on your phone" as a QR                      | Buying on the TV with the remote (`REQ-TV-084`, TV-3)                              |
| Settings                  | The full stack                                                             | Account, Microphone, Display (graphics quality), Storage, About; external pages as a QR (`REQ-TV-073`)                  | -                                                                                  |
| Ear Lab                   | Listening drills; most answer without a microphone, a few have a sing mode | Not in TV-1                                                                                                             | A strong candidate: most drills need no microphone, and their answers suit a D-pad |
| Sing, exercises, Progress | The Sing stage, premium rooms, history                                     | Not on the TV                                                                                                           | One at a time, by evidence, each with a TV layout and the phone as the mic         |
| Guitar, Piano, Drums      | Rooms of their own                                                         | Not on the TV                                                                                                           | Not planned (they need an instrument's input on the TV)                            |
| Separation, imports       | On the phone                                                               | Not on the TV (a 1 GB set cannot run the model, and a TV has no files)                                                  | Never: the phone separates and sends                                               |
| Picture-in-picture        | Enters by itself while a song plays                                        | Only when the user asks, with its usage type (decision 3, `REQ-TV-074`)                                                 | -                                                                                  |
| Developer screen          | Test builds                                                                | Test builds                                                                                                             | -                                                                                  |

### 1.3 The TV home, sketched

```
 +-----------------------------------------------------------------------+
 |  Mercury Pitch                                     [phone connected]  |
 |                                                                       |
 |   [ Sing ]   [ Songs ]   [ Microphone ]   [ Settings ]                |
 |      ^ focus starts here                                              |
 |                                                                       |
 |   Recent:  [song] [song] [song] [song]                                |
 |                                                                       |
 |   Scan to send a song from your phone:  [QR]   code 4K7-Q2M           |
 +-----------------------------------------------------------------------+
```

Sing opens the last song or Songs. A song plays on the stage page, which
replaces the home in the one web view (`REQ-TV-126`); Back returns home.

---

## 2. How it is built

### 2.1 Options, compared

| Option                                    | Effort                                        | Maintenance                                         | Release                                             | Verdict                                                                        |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A. One bundle, TV mode at run time**    | Lowest: the TV is a device class, not a build | One build to test; the TV paths are switches        | The same commit to the phone track and the TV track | **Recommended**                                                                |
| B. A TV build flavour of the same package | Medium: a Gradle flavour and a second CI leg  | Two artifacts per release, drift between them       | Phone bundle to the phone track, TV bundle to TV's  | The fallback, if the TV ever needs native code the phone must not carry        |
| C. A separate TV app (another package)    | Medium-high: a second listing and identity    | Two listings, two review histories, split purchases | Independent                                         | Rejected: the dedicated track gives the same independence without a second app |
| D. A native Kotlin TV app                 | Highest (about 132 points)                    | A second codebase for ever                          | Independent                                         | Rejected (main plan, section 4.4)                                              |

Option A works because the dedicated TV track already separates the two
release streams: Play says that once you opt in, you manage "your Android TV
releases and users separately" from the mobile release, that this cannot be
changed, and that once TVs are served from the TV track, redundant bundles
on the mobile track should go. So the same commit goes to each track on its
own schedule, and a TV review never holds a phone release.

### 2.2 What it means in the code

- **The device class decides.** The Android shell reports a TV from the TV
  UI mode or the `android.software.leanback` feature (`REQ-TV-001`), and its
  real RAM (`REQ-TV-002`, `041`). `data-device-class="tv"` then switches the
  native shell to the TV home, the stage to its TV layout, and the settings
  to the TV subset.
- **One page at a time.** The TV home and the stage page are two entries of
  the same bundle in one web view; starting a song loads the stage, Back
  loads the home (`REQ-TV-126`). The stage has no Capacitor plugins
  (`REQ-TV-027`), so the singing page is the lightest one.
- **The remote.** The focus manager (2.2), Back before navigating (2.1,
  `REQ-TV-013`, `077`), playback and media keys (`REQ-TV-014`, `015`), a
  media session after Home (`REQ-TV-075`).
- **The manifest.** A `LEANBACK_LAUNCHER` entry and a banner; touchscreen,
  faketouch and leanback not required; the microphone stays not required
  (`REQ-TV-070`, `071`). Today the manifest has the phone launcher alone and
  the microphone already optional
  (`apps/mercurypitch/android/app/src/main/AndroidManifest.xml`).
- **Levels.** `minSdkVersion` 29 and `targetSdkVersion` 36
  (`apps/mercurypitch/android/variables.gradle`), above Play's floor for TV
  apps. The bundle has no native libraries, which meets the 64-bit and 16 KB
  rule for TV apps (`REQ-TV-079`).
- **Purchases.** The same purchase package as the phone (RevenueCat over
  Play Billing). Google recommends Play Billing for purchases and
  subscriptions across mobile and TV; buying on the TV waits for TV-3.
- **CI.** The Android job already builds a signed AAB for a manual Play
  upload, since no Play publisher credential exists in CI
  (`.github/workflows/capacitor-app.yml`). TV-2 adds an upload to the TV
  track: the Play Developer API names form-factor tracks with a prefix,
  `tv:` for TV, before the usual track name.

---

## 3. Order of work

Each phase is one or more `feat/` PRs, merged by rebase. The phases sit after
the first official native app release and after P6 (Cast), as decided.

**Prerequisites from the main plan, counted there:** the stage page in host
mode (2.6) with the focus manager and Back keys (2.1, 2.2); the phone as the
microphone (P3); one song from the phone (2.8); the tier work
([tv-and-low-tier-devices.md](tv-and-low-tier-devices.md)).

### TV-0 Groundwork

1. Manifest and assets (4.1): the leanback entry, the 320x180 banner with
   the name, the features not required.
2. The TV detection plugin (4.2): the device class, the low-RAM flag and real
   RAM into the budgets.
3. Test devices: the Philips Google TVs (registered for Cast in P6), a 1 GB
   Android TV emulator image, and `adb` over Wi-Fi notes in
   DEVICE-DEBUGGING.md.

Exit: a debug build installs on the Philips, reports `tv`, and opens.

### TV-1 The TV home and karaoke

1. The TV home and its navigation (`REQ-TV-120`, `121`).
2. Songs on the TV: demo songs, songs on the TV, "send a song from your
   phone" (`REQ-TV-122`).
3. The stage as the TV app's player, one page at a time (`REQ-TV-126`).
4. The microphone chooser: USB, the phone, or lyrics only (`REQ-TV-123`).
5. Sign in with the phone (`REQ-TV-082`) on `/link/CODE`.
6. Settings for a TV (`REQ-TV-127`), external pages as a QR (`REQ-TV-073`).
7. Quality fixes (4.3): no automatic picture-in-picture, no browser
   launches, playback keys, keep-awake only while playing, the media session.
8. Memory (4.5): streamed stems on the TV, a refusal in words past the
   budget, 280 MB measured on a 1 GB set (`REQ-TV-033`, `040`).

Exit: the Play TV quality checks of the traceability table in
[tv-karaoke.ears.md](../specs/tv-karaoke.ears.md) pass on the Philips and
on the 1 GB emulator; a D-pad-only browser walk covers the TV home, Songs,
the stage and Settings; a song sung with the phone as the microphone scores
within the phone's own tolerance.

### TV-2 On the store

1. Listing (4.7): the TV banner, TV screenshots for every store listing
   (Play needs them before the opt-in), the TV description.
2. Reviewer access (`REQ-TV-081`): credentials, a demo song, and a path that
   works without a second phone (a USB microphone or lyrics only).
3. A subscription bought elsewhere works after sign-in; "Subscribe on your
   phone" as a QR (`REQ-TV-124`).
4. The TV track: opt in (permanent), an internal test on the TV track, then
   production; CI uploads to `tv:` tracks once a Play publisher credential
   exists (`REQ-TV-128`).

Exit: the app is live on the TV track, a phone release went out while a TV
review was open and was not held by it.

### TV-3 After launch

1. Buying on the TV with the remote (4.6, `REQ-TV-084`, `REQ-TV-125`).
2. A jam room on the TV, with the singer cap set from measurements (about
   four expected; decision 6, `REQ-TV-129`).
3. Cast Connect (6.5, counted in P6): the Cast button opens the installed TV
   app.

### TV-4 By evidence

Ear Lab on the TV; one singing room at a time with the phone as the mic;
Fire TV with the same build (Amazon's store and billing, tv-apps-and-phone-mic.md
section 6, phase 4). Not estimated.

---

## 4. Requirements (EARS), proposed

Proposed for [tv-karaoke.ears.md](../specs/tv-karaoke.ears.md) when TV-1
starts; until then they live here. They add the TV app's own surface to
`REQ-TV-070..084`, which already cover Play's requirements.

### REQ-TV-120 — A TV home

**WHEN** the app starts on a TV, it shall open the TV home, with focus on
Sing, and Songs, Microphone and Settings reachable by the D-pad's five keys.

### REQ-TV-121 — Only rooms built for a TV

**WHILE** the app runs on a TV, it shall list only the rooms that have a TV
layout and a way to hear the singer on a TV; the others shall not be shown,
rather than shown and refused.

### REQ-TV-122 — Songs a TV can have

The Songs view on a TV shall offer the demo songs, the songs the TV already
holds, and sending a song from a phone (`REQ-TV-034`). **IF** a TV holds no
song but the demos, **THEN** the view shall lead with how to send one.

### REQ-TV-123 — A microphone before the song

**WHEN** a song starts on a TV with no USB microphone and no phone connected,
the TV shall show the phone's QR and code (`REQ-TV-053`) and offer to sing
with lyrics only, before it plays.

### REQ-TV-124 — A subscription from elsewhere

**WHERE** the signed-in account holds a subscription bought on a phone or the
web, the TV app shall honour it with no purchase on the TV. **WHILE**
purchases are not offered on the TV, the paywall shall say to subscribe on a
phone and show a QR to do so.

### REQ-TV-125 — Buying with the remote

**WHERE** purchases are offered on a TV, they shall use Play Billing, and
every control shall work by D-pad (`REQ-TV-084`). **IF** a purchase cannot
complete on the TV, **THEN** the app shall offer to finish it on a phone.

### REQ-TV-126 — One page at a time

**WHILE** a song plays on a TV, the TV home shall not stay loaded beside the
stage: the stage page replaces it, and Back loads the home again.

### REQ-TV-127 — Settings a TV needs

**WHILE** the app runs on a TV, Settings shall offer Account, Microphone,
Display, Storage and About, each operable by D-pad, and shall open no
external page except as a QR (`REQ-TV-073`).

### REQ-TV-128 — Released on the TV track

Each TV release shall go out on Play's dedicated Android TV track, through
its internal test track first, built from the same commit as a phone
release. **WHERE** CI holds a Play publisher credential, it shall upload to
the `tv:` tracks itself.

### REQ-TV-129 — Singers on a TV

**WHERE** a jam room runs on a TV, the number of singers shall be capped at
what the TV holds, measured on a 1 GB set; about four is expected. No cap
shall apply before it is measured.

---

## 5. Releasing on Play

- **Opting in.** Play Console, Test and release, Advanced settings, Form
  factors: add Android TV, then "Use a dedicated release track for Android
  TV". Play needs Android TV screenshots for all store listings first, and
  reviews the app against the Android TV quality guidelines. The choice
  cannot be undone (decision 4 takes it knowingly).
- **What review checks.** The traceability table at the end of
  [tv-karaoke.ears.md](../specs/tv-karaoke.ears.md) maps each Play TV test
  to a requirement; TV-1's exit walks it.
- **Levels.** For new apps and updates, Play's floor for TV apps is lower
  than for phones (API 34, Android 14, from 31 August 2026, as Google's
  requirement page is quoted; an existing TV app needs 33 to stay visible to
  new users), well under the app's 36. From 1 August 2026 a TV app must
  support 64-bit and 16 KB pages; a bundle without native code does.
- **Purchases.** Google lets an app be consumption-only for what was paid
  elsewhere (TV-2), and recommends Play Billing for buying on a TV (TV-3).

---

## 6. Effort

Points as in the main plan (section 6 there): relative size, not time.
Confidence: medium (-20% to +40%).

| Id   | Work item                                             | Pts | Conf. | Requirements      |
| ---- | ----------------------------------------------------- | --- | ----- | ----------------- |
| T0.1 | Manifest and assets (was 4.1)                         | 2   | H     | 070, 071          |
| T0.2 | TV detection plugin (was 4.2)                         | 3   | H     | 001, 002, 041     |
| T0.3 | Test devices and notes                                | 1   | H     | -                 |
| T1.1 | The TV home and its navigation (a new surface)        | 8   | M     | 120, 121          |
| T1.2 | Songs on the TV                                       | 3   | M     | 122               |
| T1.3 | The stage as the player, one page at a time           | 5   | M     | 126, 026          |
| T1.4 | The microphone chooser                                | 3   | M     | 123, 083          |
| T1.5 | Sign in with the phone                                | 3   | M     | 082               |
| T1.6 | Settings for a TV                                     | 3   | M     | 127, 073          |
| T1.7 | Quality fixes (was 4.3)                               | 5   | M     | 014, 015, 073-076 |
| T1.8 | Memory (was 4.5)                                      | 3   | M     | 033, 040          |
| T2.1 | Listing and track (was 4.7)                           | 2   | H     | 079-081           |
| T2.2 | Reviewer access                                       | 2   | H     | 081               |
| T2.3 | A subscription from elsewhere; subscribe on the phone | 2   | M     | 124               |
| T2.4 | CI upload to the `tv:` tracks                         | 2   | M     | 128               |
| T3.1 | Buying on the TV (was 4.6)                            | 3   | L     | 084, 125          |
| T3.2 | A jam room on the TV, with its cap                    | 5   | M     | 066, 129          |

| Phase            | Points                     |
| ---------------- | -------------------------- |
| TV-0 Groundwork  | 6                          |
| TV-1 Karaoke     | 33                         |
| TV-2 Store       | 8                          |
| TV-3 After       | 8 (Cast Connect, in P6: 5) |
| **TV-0 to TV-2** | **47 (38-66)**             |

P4 counted 26. The difference is what P4 left out: P4 put the phone's own
shell on a D-pad (4.4, 8 points), where this plan builds a TV home and the
TV's song, microphone and settings paths (T1.1, T1.2, T1.4 to T1.6: 20
points), and adds reviewer access and CI (T2.2, T2.4). The prerequisites
(2.1, 2.2, 2.6, 2.8, P3) are counted in the main plan.

---

## 7. Risks

| Risk                                                   | Effect                                 | Mitigation                                                                          |
| ------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| A TV review fails on a control the D-pad cannot reach  | The TV release waits; phones do not    | A small TV surface; the D-pad-only walk before each TV release; the dedicated track |
| An old Android TV ships an old WebView                 | No streaming; a song too big to decode | Refuse in words (`REQ-TV-033`); P0's WebView check on the Philips                   |
| 1 GB sets                                              | Low-memory kills mid-song              | One page at a time, the plugin-free stage, measured budgets (`REQ-TV-040`)          |
| The phone as the mic needs the same Wi-Fi or the relay | No scoring on isolated Wi-Fi           | The relay carries pitch frames; a USB microphone; lyrics only, said in words        |
| Buying on a TV fails or confuses                       | Lost subscriptions                     | TV-1 and TV-2 honour what was bought elsewhere; buying on the TV waits for TV-3     |
| The dedicated track is permanent                       | Two release streams for ever           | Decided knowingly (decision 4); one bundle (option A) keeps them close              |

---

## 8. Assumptions

Flagged to check, not trusted.

1. Play accepts the phone's bundle on the TV track, or a build of the same
   commit with its own version code. Checked at the first TV upload (TV-2).
2. RevenueCat's Android SDK works on Android TV as on phones; Play Billing
   itself does. Checked in TV-3.
3. A USB microphone reaches the WebView on Android TV as on a phone. P0's
   0.3 checks it on the Philips.
4. The Philips sets run Android TV 10 or later (the app's floor) with Play
   services and an updatable WebView. P0.
5. The TV app shares the phone app's Play listing and package, so the first
   official native release comes first (decided).

---

## Provenance

- Branch `feat/android-tv-app`, from `main` at `df6eb5b` (2026-10-25), after
  PRs #1185 and #1189 merged.
- Read: [tv-cast-and-google-tv.md](tv-cast-and-google-tv.md) (sections 4.4,
  5, 6, 7, 9), [tv-karaoke.ears.md](../specs/tv-karaoke.ears.md)
  (`REQ-TV-001..084` and the traceability table),
  [tv-apps-and-phone-mic.md](tv-apps-and-phone-mic.md) (sections 3.3, 6, 7),
  [tv-and-low-tier-devices.md](tv-and-low-tier-devices.md),
  [mobile-native/README.md](mobile-native/README.md).
- Code read: `apps/mercurypitch/android/variables.gradle`,
  `apps/mercurypitch/android/app/src/main/AndroidManifest.xml`,
  `apps/mercurypitch/src/shell/shell-navigation.ts`, `premium-rooms.ts`,
  `ShellScreens.tsx`, `apps/mercurypitch/src/shell/settings/`,
  `.github/workflows/capacitor-app.yml`, `mercurypitch-mobile.yml`.

## Sources

Checked on 2026-10-25.

- [Manage different form factor releases on dedicated tracks (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/13295490)
- [Distribute to Android TV (Android Developers)](https://developer.android.com/training/tv/publishing/distribute)
- [Target API level requirements for Google Play apps (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/11926878)
- [APKs and Tracks, form-factor track names (Google Play Developer API)](https://developers.google.com/android-publisher/tracks)
- [Best practices to drive engagement on Google TV: Play Billing (Android Developers)](https://developer.android.com/training/tv/get-started/google-tv)
- [Understanding Google Play's Payments policy: consumption-only apps (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/10281818)
- [TV app quality (Android Developers)](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- The main plan's sources, in [tv-cast-and-google-tv.md](tv-cast-and-google-tv.md).
