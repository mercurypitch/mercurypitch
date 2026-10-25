# Onboarding exits: EARS Requirements

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.2 | Date: 2026-10-25 | Scope: every way out of the First Light
> onboarding, where each one lands, what each one counts, and when one asks
> first

---

**Source:** `src/features/onboarding/FirstLight.tsx` (the rail and its
handlers: `handleSkip`, `handleNotNow`, `handleForkNotNow`,
`handleDismissAccount`, `handleMicDenied`, `handleAnotherVoiceprint`,
`handleEnterStop`, and `afterFirstLight`, where every "Not now" before the
Map lands); `src/features/onboarding/skip-confirm.tsx` (the question asked
before a skip); `src/features/onboarding/beats/BeatFirstLight.tsx`
("Continue without the mic"); `src/features/onboarding/beats/BeatFork.tsx`
and `src/features/onboarding/beats/BeatPrints.tsx` ("Make another
voiceprint"); `src/features/plan/BeatPlan.tsx` and
`src/features/plan/usePlanFlowController.ts` (the four questions and the
plan); `src/stores/onboarding-store.ts` (`openBeat`, `advanceBeat`,
`markMicDenied`)
**Tests:** `src/features/onboarding/FirstLight.test.tsx`,
`src/features/onboarding/FirstLight.skip.test.tsx`,
`src/features/onboarding/beats/BeatFork.test.tsx`,
`src/features/onboarding/beats/BeatMap.test.tsx`,
`src/features/plan/BeatPlan.test.tsx`,
`src/features/plan/usePlanFlowController.test.ts`,
`src/pages/HomePlanCardMount.test.ts`,
`src/tests/onboarding-launch-gift-flow.test.tsx`,
`src/e2e/onboarding.spec.ts`, `src/e2e/onboarding-mic.spec.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Background: the owner's decisions of 10 and 11 October 2026, numbered as in
the onboarding plan. V1 and V8: one way out, and skipping takes a deliberate
tap. V3: skipping lands past the walk without a voiceprint. V6: the
welcome's way out is a close button. V9: every "Not now" lands past the
walk. V10: "Continue without the mic" stays. V12: returning singers keep
"Make another voiceprint". Since 23 October the four questions sit between
the account ask (Keep) and the Map, so "past the walk" is the questions
while the plan is due (neither answered nor turned down) and the Map once it
is not. The same day the owner asked for the three skips that cost the most
to ask "are you sure?" first (REQ-EX-015). The event names are the funnel's
(`src/lib/funnel-event-catalog.ts`).

## One way out: `EX-001` to `EX-002`

### REQ-EX-001: One skip per beat, at the top

**Ubiquitous:** Every beat except the questions and the Map shall offer
exactly one skip, a control that declines the rest of the beat's path, in
the rail at the top of the frame, and no skip inside the beat ("Skip", "Not
now" or "Take me in"). The questions and the plan carry their own Not now in
the corner of their own box, so the rail adds none. The Map offers none: its
rooms and its own button are the way on. Buttons that take a returning
singer somewhere specific (REQ-EX-010, and the prints' "Explore your voice
constellation") are destinations, not skips. Verified by "one way out on
every beat" in `FirstLight.test.tsx`.

### REQ-EX-002: The way out comes after the beat for the keyboard

**WHEN** the beat changes, focus shall move to the new beat's heading, and
the rail shall follow the beat in the DOM, so Tab reaches the beat's own
controls before the way out, while the rail still shows at the top right.
Verified by "focus on a beat change" in `FirstLight.test.tsx`.

## Where each exit lands: `EX-003` to `EX-008`

### REQ-EX-003: The welcome's close button leaves the intro

**WHEN** the visitor closes the welcome (the X, "Skip the intro") and says
"Yes, skip" where they are asked (REQ-EX-015), the flow shall send
`onboarding_skipped`, mark the plan as shown (`welcome-skip`), so no plan
takeover follows in the app, and finish, and the intro shall not open again
on reload.
Verified by "leaves on Yes, skip, and the plan is never offered again" in
`FirstLight.skip.test.tsx`, "carries one button, and the way out is a close
button at the top" in `onboarding-launch-gift-flow.test.tsx` and "skipping
at beat 1 sticks across a reload" in `onboarding.spec.ts`.

### REQ-EX-004: "Not now" lands past the walk

**WHEN** the visitor taps "Not now" on First light, the voiceprint, the
twin or the prints, the flow shall stay open, send `onboarding_skipped`,
never `onboarding_track_short`, and land on the four questions while the
plan is due, and on the Map once it is answered or turned down. Verified by
"takes the %s beat to the questions, counted as a skip, with the flow still
open" and "takes a beat to the Map once the plan is answered, counted as a
skip" in `FirstLight.test.tsx`.

### REQ-EX-005: Nothing is measured on the way out

**IF** the visitor leaves the voiceprint before it finishes **THEN** the
flow shall land past the walk with no voiceprint recorded. Verified by
"makes no voiceprint on the way: leaving the voiceprint mid-run lands with
none" in `FirstLight.test.tsx`.

### REQ-EX-006: Leaving the twin keeps the finished voiceprint

**WHEN** the visitor taps "Not now" on the twin, the voiceprint they just
finished shall stay in this browser, the account ask (Keep) shall be
skipped without sending `onboarding_keep`, and the flow shall land past the
walk without asking first. Once the plan is answered that is the Map, which
shall say the voiceprint is saved in this browser only and offer to save
it, with the launch gift while one is featured. Verified by "goes straight
to the questions from the twin, with no confirm" in
`FirstLight.skip.test.tsx` and "leaves the twin by "Not now" for a Map that
offers to keep the voiceprint, with the gift" in
`onboarding-launch-gift-flow.test.tsx`.

### REQ-EX-007: The Fork's "Not now" is the short track

**WHEN** the visitor taps "Not now" on the Fork and says "Yes, skip" where
they are asked, the flow shall land past the walk with nothing measured and
send `onboarding_track_short`, the event of the "Take me in" card it
replaced, never `onboarding_skipped`. Verified by "asks the questions after
the short track's Not now, with nothing measured, counted as the short
track" in `FirstLight.test.tsx`, "asks on the Fork, and Yes, skip takes the
short track" in `FirstLight.skip.test.tsx` and "the Fork asks one question,
and "Not now" reaches the four questions and then the Map without a
voiceprint" in `onboarding-mic.spec.ts`.

### REQ-EX-008: Keep's "Not now" declines the account

**WHEN** the visitor taps "Not now" on Keep, the flow shall send
`onboarding_account_dismissed`, quiet the account ask, and move on to the
next beat, the questions while the plan is due, without asking first.
Verified by ""Not now" sits in the rail, moves on to the questions and
quiets the ask" in `onboarding-launch-gift-flow.test.tsx`.

## Without a microphone: `EX-009`

### REQ-EX-009: "Continue without the mic" lands past the walk

**IF** First light cannot hear a working microphone (access blocked, the
take failed, or nothing heard by the nudge) **THEN** it shall offer
"Continue without the mic", which sends `onboarding_mic_denied`, marks the
microphone declined and lands on the next beat that needs no microphone,
the questions while the plan is due and the Map otherwise, with the flow
open. The Fork shall not be offered, and neither the plan nor the Map shall
offer the launch gift. Verified by "a silent input is not treated as a
working microphone" in `onboarding.spec.ts`, and by "offers nothing in
onboarding to a visitor who declined the microphone" and "names no gift on
the plan to a visitor who declined the microphone, as the Map does not" in
`onboarding-launch-gift-flow.test.tsx`.

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

## The Map's side doors: `EX-011`

### REQ-EX-011: Four side doors, one row on a phone

**Ubiquitous:** Under the room cards the Map shall offer four side doors
after "And also": Challenges, Guitar, Piano and the Voice Mirror, each
opening its room. Eight wrapped to three rows on a phone (owner testing,
11 Oct 2026). The Voice Mirror stays by the owner's call; the other three
are the rooms the welcome mail names under "Also waiting for you", because
no tap on a door is counted per door. On a phone each door shall be a 44 px
tap target, and the four shall sit in one row from a 360 px screen up.
Verified by "offers four doors, the Voice Mirror among them, each opening
its room" and "gives every door a 44 px tap target on a phone" in
`BeatMap.test.tsx`; the one row was measured at 360, 375, 390 and 430 px.

## The four questions and the plan: `EX-012` to `EX-014`

### REQ-EX-012: A question's "Not now" turns the plan down

**WHEN** the visitor taps "Not now" on one of the four questions and says
"Yes, skip" (REQ-EX-015), the plan shall be turned down, the funnel told
which question it came on, and the flow shall leave First Light for the
app. Verified by "hands Home to First Light from Not now on a question, and
turns the plan down" in `BeatPlan.test.tsx` and "asks first, and turns the
plan down on Yes, skip" in `FirstLight.skip.test.tsx`.

### REQ-EX-013: The plan's ways on

**Ubiquitous:** The plan shall offer its stops, "Show me around", "See
every room" and its own "Not now", none of which asks first. "Not now"
leaves First Light for the app with the answers kept. "See every room"
opens the Map. A stop opens its room, a tab or a page, and closes First
Light; "Show me around" opens Start here with its room's tour where the room
has one. **WHEN** the visitor opens today's session, Home's own, from its
card, Home shall build the session if there is none, bring its card into
view and put the cursor on its first button, as Home's own plan card does;
"Show me around" leaves that to Home's tour. Verified by "hands Home
from the plan's Not now, with the answers kept", "opens the Map from See
every room", "hands Start here on, with its tour, from Show me around" and
"hands the %s card on without a tour when it is tapped" in
`BeatPlan.test.tsx`, "asks Home for today's session when the stop is Home's
own, which the host only switches to" in `usePlanFlowController.test.ts`,
and "answers with what Home does for its own session, once" in
`HomePlanCardMount.test.ts`.

### REQ-EX-014: A plan answered on another device is shown, not asked again

**WHILE** the four questions are open and the visitor has not started
answering (no pick, no move past the first question), **WHEN** an answered
plan arrives from the account, the beat shall show that plan, as a review
of it does, instead of asking the questions again, and shall tell the
funnel nothing for its answers. It shall build that plan from the
voiceprint finding the record kept, not from one made in this run, so
Home's card shows the same plan. Once the visitor has started, their own
answers replace it. The same holds for a plan that arrived after First
Light read the plan as due but before the beat opened. Verified by "is
shown in place of the questions when the account sends it before the first
pick" and "leaves the questions to a singer who has started answering" in
`BeatPlan.test.tsx`, and by "when an answered plan comes from the account"
in `usePlanFlowController.test.ts`.

## Asking before a skip: `EX-015` to `EX-018`

### REQ-EX-015: Three skips ask first

**WHEN** the visitor taps one of three ways out, the flow shall ask "are
you sure?" in the owner's words before it runs: the welcome's close, while
staying still gets something (a voiceprint, the plan or a launch gift, each
listed only while it applies); "Not now" on First light, the Fork and the
voiceprint run, while the voiceprint is due (none made in this run, none
saved on this device, the microphone not refused); and a question's "Not
now". Every other way out, and every way out of a replay, shall leave at
once. Opening the question shall send `onboarding_skip_asked_intro`,
`_voiceprint` or `_plan`; "Keep going" shall send the matching
`onboarding_skip_kept_*` and leave the visitor where they were; "Yes, skip"
shall run the way out, whose own events are sent only then. Verified by
"the welcome's close", "Not now before the voiceprint", "the questions' Not
now in First Light" and "says exactly what maff wrote, on each of the three
confirms" in `FirstLight.skip.test.tsx`.

### REQ-EX-016: A question that is no longer true closes by itself

**IF** the beat it was asked on moves on underneath an open question (the
voiceprint finished, the microphone was refused) **THEN** it shall close by
itself, counted as neither kept nor skipped, and the focus shall land on
the new beat's heading. Verified by "closes by itself when the voiceprint
finishes underneath, counted as neither" and "leaves the focus on the twin's
heading when it closes by itself" in `FirstLight.skip.test.tsx`.

### REQ-EX-017: The beat goes on under the question

**WHILE** the question is open, the beat underneath shall stay live: a
first note can still land, the voiceprint run keeps counting and keeps the
microphone, and only one question is open at a time, whatever is tapped
under it. Escape and the backdrop shall count as "Keep going". Verified by
"hands back a working beat: a note heard under it, then the beat goes on",
"keeps the microphone while it asks, and lets it go on Yes, skip during the
voiceprint run", "asks once while a confirm is open, whatever is tapped
under it" and "keeps going on Escape and on the backdrop, counted each
time" in `FirstLight.skip.test.tsx`.

### REQ-EX-018: The question keeps its keys

**WHILE** the question is open, Space, M and Escape pressed in it shall not
reach the app behind it, also after a press on its words. Verified by
"keeps its keys from the app behind" and "keeps its keys after a press on
the confirm's words, and Escape still keeps going" in
`FirstLight.skip.test.tsx`.
