# EARS Specification — The weekly Check-up

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-10-26 | Scope: what a Check-up is, when one is
> due, how two weeks of them compare, where the comparison is said and
> shared, and what an account adds to it.

**Why:** nothing in the app showed a singer that they were improving. The
Voice Mirror's guided run (glide up, glide down, hold, match five notes;
about ninety seconds) already saved a dated voiceprint every time,
onboarding already ran the same three tasks on day 1, and Settings already
listed the voiceprints. The Check-up is a reason to come back on day 7, an
honest then-and-now of what moved, and the account's headline benefit
(owner, 26 Oct 2026: "adding the 7 day checkup and offering that as create
account feature"). Never a lock: nothing in the app is held behind an
account (`src/features/onboarding/account-nudge.ts`), and the Check-up and
its comparison work without one, in this browser.

**Source:** `src/lib/check-up/due.ts`, `src/lib/check-up/then-and-now.ts`
(the model), `src/features/check-up/HomeCheckupCard.tsx`,
`src/pages/HomeCheckupCardMount.tsx`, `src/pages/HomePage.tsx`,
`src/features/mirror/entry-intent.ts` (`isCheckupVisit`),
`src/features/mirror/MirrorLanding.tsx`, `src/features/mirror/MirrorApp.tsx`,
`src/features/mirror/ThenAndNowPanel.tsx`,
`src/features/progress/then-and-now-card.ts`,
`src/features/progress/share-card.ts`,
`src/features/onboarding/beats/BeatKeep.tsx`, `src/assets/merc/merc-blue.png`
**Tests:** unit — `src/lib/check-up/due.test.ts`,
`src/lib/check-up/then-and-now.test.ts`,
`src/features/check-up/HomeCheckupCard.test.tsx`,
`src/pages/HomeCheckupCardMount.test.ts`,
`src/features/mirror/ThenAndNowPanel.test.tsx`,
`src/features/mirror/MirrorApp.check-up.test.tsx`,
`src/features/progress/then-and-now-card.test.ts`,
`src/features/progress/share-card.test.ts`,
`src/features/onboarding/beats/BeatKeep.test.tsx`; end-to-end —
`src/e2e/weekly-check-up.spec.ts`
**Related:** `docs/specs/voiceprints.ears.md` (REQ-VPR-001, 004, 007, 011,
014, 023), `docs/specs/guided-voice-check.ears.md` §7 (REQ-GVC-060 to 066)

---

## 1. What a Check-up is

### REQ-WCU-001 — A Check-up is a guided voiceprint

**Ubiquitous:** Every saved voiceprint shall be a Check-up reading: the
onboarding voiceprint and every guided Voice Mirror run (REQ-VPR-001). Free
Sing saves none, so it is never one. The readings compare because they are
the same tasks scored by the same maths (`computeMirrorResult`): the
identical retake protocol of REQ-GVC-060. The Check-up shall not change the
Mirror's tasks, timings or scoring, and adds no voiceprint source:
`VoiceprintSource` and the cloud rows stay as they are.

### REQ-WCU-002 — The history

**Ubiquitous:** A Check-up's history shall be what `listVoiceprints` shows
the viewer (REQ-VPR-007): signed in, the account's takes; signed out, this
browser's, whoever made them.

## 2. When one is due

### REQ-WCU-010 — Seven days after the newest take

**While** the newest take in the history is 7 or more days old, a Check-up
shall be due (`checkupDue`). **While** the history holds no take, none shall
be due: there is nothing to compare yet.

## 3. Then and now

### REQ-WCU-020 — No claim before the data exists

**Ubiquitous:** A then-and-now comparison shall exist only when the newest
take is at least 7 days after the oldest (`thenAndNow` returns null
otherwise).

### REQ-WCU-021 — The two sides

**Ubiquitous:** Then shall be the oldest take and, when there is one, the
next take within 7 days of it. Now shall be the newest take and, when there
is one, the take before it within 7 days of it, unless that take is already
Then's. Each side is at most two takes; takes in between are not read.

### REQ-WCU-022 — The best of two

**Ubiquitous:** Each side's reading shall be the best of its takes, per
metric: the widest clean range (one take's low and high notes together), the
highest accuracy and the highest steadiness (`bestOf`). People improve at a
task just by knowing it, so a single first take undersells where they
started; the latest week gets the same allowance.

### REQ-WCU-023 — An unclean range is no range

**If** a take's range read is not clean (`isCleanRange` false, or no range),
**then** it shall not count for range; its accuracy and steadiness still
count. A side with no clean range shows none, and the range is not compared.

### REQ-WCU-024 — Thresholds

**Ubiquitous:** A change shall be named only when it reaches its threshold:
2 semitones of span, 5 points of accuracy, 5 points of steadiness
(`CHECKUP_THRESHOLDS`). The numbers are provisional until there is data on
take-to-take noise; none is validated yet (REQ-GVC-065).

### REQ-WCU-025 — The words

**If** a change is under its threshold, **then** it shall be said as "About
the same" with both values, and no arrow, sign or praise word (REQ-GVC-066).
**When** it reaches its threshold, it shall be said as what it is: "3
semitones wider", "accuracy up 9", "down 6". A fall shall be said as plainly
as a rise. "Wider" describes the span; it is not a reward for range
(REQ-GVC-072).

### REQ-WCU-026 — Practice in between

**Ubiquitous:** The comparison shall count the practice sessions saved
between Then's last take and Now's first (`practiceBetween`), read with
`loadProgressSessionRecords`, the reader Progress counts its sessions with:
every saved session of this identity, by its end, else its start, else when
it was saved, each once. **While** that count is 1 or more it shall be shown
("9 practice sessions in between"); at none, or when the read fails, nothing
is said.

### REQ-WCU-027 — This browser's readings

**While** no real account is signed in, every view of the comparison shall
say that the readings are this browser's (`THIS_BROWSER_NOTE`): several
people can sing on one (REQ-VPR-007's reason).

## 4. Home's card

### REQ-WCU-030 — Shown when due

**While** a Check-up is due and the card was not sent away this week, Home
shall show the Check-up card at the top of its grid, above the streak card.
The plan card (`HomePlanCardMount`) keeps the grid's first place, so in the
week after onboarding the Check-up card follows it.

### REQ-WCU-031 — Its words

**Ubiquitous:** The card shall say, plainly: eyebrow "Weekly Check-up";
heading "A week since your last Check-up"; line "Sing the same 90 seconds as
on 19 October, and see what moved." with the newest take's day. **When** the
newest take is two weeks old or more, the heading shall be "Your last
Check-up was on 5 October." and the line "Sing the same 90 seconds again,
and see what moved."

### REQ-WCU-032 — Start, or not this week

**When** "Start my Check-up" is tapped, the Voice Mirror shall open in
Check-up mode (`/mirror?checkup=1`, REQ-WCU-040). **When** "Not this week" is
tapped, the card shall go and stay away for 7 days, and the focus the button
had shall go to the page's main region (`#main-content`) without scrolling,
as the plan card's X does. The dismissal is the one thing the Check-up
stores (`mercurypitch.checkup.notThisWeek.v1`, an epoch millisecond count),
read by a pure predicate with the clock passed in.

### REQ-WCU-033 — The account line

**While** no real account is signed in (`accountHeld`), one quiet line under
the buttons shall say "Your Check-ups stay in this browser. A free account
keeps every one, on every device." with "Create a free account" as a text
button that opens the account dialog on its sign-up pane
(`openAuthModal('register')`). **While** signed in, there shall be no account
line. Every one is true: this browser keeps the latest twelve voiceprints
(`LOCAL_CAP`, REQ-VPR-004), an account all of them on every device it signs
in on.

### REQ-WCU-034 — Reading the history

**Ubiquitous:** The card shall read the history once as it draws and again
when the auth version moves, as the streak card does. **If** the read fails,
**then** no card shall show and no error shall be said.

### REQ-WCU-035 — Home's first paint

**Ubiquitous:** The card shall be a chunk of its own, reached through
`HomeCheckupCardMount`, so it adds about a kilobyte at most to Home's first
paint. Until the chunk and the history are in, the mount shall keep the
card's frame as a slot when this browser's own takes say a Check-up is due,
so the streak card does not move when the card lands. The slot shall be the
card's height at the card's own width, which Home's sidebar narrows at
tablet widths: for the card's wording (REQ-WCU-031) and with or without the
account line (REQ-WCU-033).

### REQ-WCU-036 — Not in the native app

**Ubiquitous:** The native build shall carry no Check-up card: its bundle
has one document and no Voice Mirror to open. The mount's constant renders
nothing there before `lazy()` is written, as the plan card's does.

## 5. Check-up mode in the Voice Mirror

### REQ-WCU-040 — The landing says it is the Check-up

**When** the Mirror opens with `?checkup=1`, its landing's eyebrow shall say
"Weekly Check-up" (`isCheckupVisit`). Everything else is the same run. A
shared voiceprint's `?v=` link shall open the card it carries as before,
with or without the flag.

## 6. Then and now on the Mirror's results

### REQ-WCU-050 — After any guided run

**When** a guided run lands (Check-up mode or not) and REQ-WCU-020 gives a
comparison with the take just saved included, the results shall show the
then-and-now panel in place of the change line (`deltaLine`). **Where** there
is no comparison, the results shall be exactly as before. A saved take
restored from `#take-N` is not a run, and shows no panel.

### REQ-WCU-051 — What the panel shows

**Ubiquitous:** The panel shall set Then and Now side by side, each with its
dates, its range as notes ("G2 to C4"), its accuracy and its steadiness; each
change worded per REQ-WCU-025; the practice line of REQ-WCU-026; and,
signed out, the note of REQ-WCU-027.

### REQ-WCU-052 — Sing it once more

**When** "Sing it once more" is tapped, the guided run shall start again,
with the line "Your Check-up keeps the better of your last two takes this
week." beside it, which REQ-WCU-021 and 022 make true.

### REQ-WCU-053 — The account line on the results

**While** this browser has never met a real account (`accountKnownHere`, the
Mirror ask's own test), the panel's last line shall be REQ-WCU-033's line,
opening the same account dialog. It records no funnel event. The Mirror's
own ask under the share row stays as REQ-VPR-023 sets it.

## 7. The then-and-now card

### REQ-WCU-060 — Honest as the Progress card is

**When** "Share then and now" is tapped, the app shall share a card drawn by
the Progress share card's renderer (`renderProgressShareCard`), delivered
the same way (`exportProgressShareCard`: the Web Share sheet, or a saved PNG
where there is none). It shall carry:

- the claim "My Check-up, then and now";
- facts that are only measured values and the changes REQ-WCU-025 names
  (`thenAndNowFacts`), at most three: the named changes first, then the
  practice count, then Now's own readings of the metrics that did not move
  past their thresholds ("72, steadiness now"); never a change under its
  threshold, not even as "About the same", since a change inside the noise
  is not a result to share (REQ-GVC-065, 066);
- the two dates, from Then's first take to Now's last;
- Merc, the blue still, drawn between the claim and the facts;
- no name, handle or email;
- on its face the Mirror's bare address, and in the share text the Mirror's
  tagged share link (`MIRROR_SHARE_URL`; `card-renderer.ts` says why the two
  differ).

The card is drawn in the shape the Mirror's card options have chosen, square
or story, once the panel is on screen, so the share begins inside the tap.

## 8. The account ask in onboarding

### REQ-WCU-070 — Keep offers the Check-up

**Ubiquitous:** Keep's first row (BeatKeep) shall say "Every weekly
Check-up, kept", with its chip as before. It names no range, so it claims
nothing after a range read that was not clean.

## 9. Privacy

### REQ-WCU-080 — Nothing new collected

**Ubiquitous:** The Check-up shall add no analytics event and no storage
beyond the card's dismissal (REQ-WCU-032). It reads only what the app
already keeps: the voiceprints and the practice sessions.

## 10. Scenarios

1. Two takes 8 days apart on this browser, the newest over a week old: Home
   shows the card; "Start my Check-up" opens the Mirror saying "Weekly
   Check-up"; after the run the panel compares the oldest take with the one
   just sung (`src/e2e/weekly-check-up.spec.ts`).
2. One take sung today: Home shows no card (same spec).
3. "Not this week": the card goes and the focus stays in the main region;
   no card for 7 days, then the card again (`HomeCheckupCard.test.tsx`).
4. Signed in: no account line on the card or the panel; signed out: both,
   and the panel says the readings are this browser's.
5. A change under its threshold: "About the same" with both values on the
   panel, and not on the card, which gives Now's reading of it alone.
