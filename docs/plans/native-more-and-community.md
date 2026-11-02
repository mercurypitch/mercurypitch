# The native More sheet as a list, and Together on the phone

Status: slices 1 to 3 merged (the More sheet as a list, #1267; Leagues,
read-only, #1272; the Legend as a native room, and 3b, its light), and 4a
(the worker's reports, blocks and name filter, in v0.9.28); 4b built
(Report and Block on the phone); 4c built (Community on the phone, behind
its own switch). Each slice is its own PR.

The native app's More sheet (`apps/mercurypitch/src/shell/MoreSheet.tsx`) was
six square tiles in a four-column grid: 11 px labels, a third of the sheet
empty, and no room for what comes next. This plan turns it into a list that
can grow, then brings three web surfaces to the phone behind it: Leagues, the
weekly challenge (the Legend), and Community.

Read with: [mobile-kit.md](mobile-native/mobile-kit.md) (the kit),
[native-feel-research.md](mobile-native/native-feel-research.md) (glass and
sheets), and in [MISTAKES.md](../agent/MISTAKES.md): "Do not gate account UI
on a fetch", "A folded branch still runs the modules its imports name",
"Never transpose a weekly challenge to the singer's range" and "A watermark
that names the running week must include it next time".

## What does not move

- **The web.** Every slice reuses the web's services and models
  (`league-service.ts`, `weekly-service.ts`, `challenge-stage-model.ts`, the
  community services) and draws its own screen in the native kit. No web
  component is imported into the shell; `CommunityLeaderboard.tsx` and
  `WeeklyLegendHero.tsx` carry web-only modals, routing and stores.
- **The hooks.** Every `data-more-item` stays, with the same ids
  (`karaoke`, `piano`, `guitar`, `account`, `developer`, `settings`). The
  probes (`apps/mercurypitch/scripts/probe-*.mjs`) and the store shots
  (`shots/store.shots.ts`) tap them by id.
- **The store build.** Each Together row, and everything it opens, is behind
  a build constant that folds: a store build carries no row, no screen and
  no words of it until the owner flips the constant. Held by assert-bundle,
  not by reading the source.
- **The Developer row's ternary.** `{DEVELOPER_AVAILABLE ? <row/> : null}`
  stays a ternary, never a `<Show>`, so the store build keeps only the null
  arm.
- **Karaoke's icon.** The row draws `KaraokeIcon` from `shell/icons.tsx`,
  the Karaoke Night stage (the web's StageCurtains) since 35fc4e55. The
  chip picks the drawing up by import; this work draws no icon of its own
  for Karaoke.

## The build switches

The owner's rule: on in a test build, TestFlight among them, off in the store
build, folded like `KARAOKE_IMPORT` and `EAR_LAB_WITH_MERC`. That is exactly
`KARAOKE_IMPORT`'s truth table, so no new `define` is needed (the
`EAR_LAB_WITH_MERC` recipe, PR #1244):

```ts
// src/lib/native-build.ts
/** Leagues and the weekly challenge on the phone (slices 2 and 3). */
export const NATIVE_LEAGUES: boolean = KARAOKE_IMPORT
/** Community on the phone (slice 4). Never flipped before report, block,
 *  the name filter and the contact line are live (App Store 1.2). */
export const NATIVE_COMMUNITY: boolean = KARAOKE_IMPORT
```

Slices 2 and 3 share one switch, as the brief asks ("behind the same
switch"); Community has its own, because its store gate is the moderation
work, not a product call. Each switch:

1. is read only in a ternary or behind `lazy(import())`, never a `<Show>`;
2. gets STAGE 2 markers in `apps/mercurypitch/scripts/assert-bundle.mjs`
   (present in every importing build, absent in the store build), chosen
   from storage keys, test ids and unique copy. Not from a row's
   `data-more-item`: the More sheet's rows set it from a prop, so Solid
   compiles it to a `setAttribute` call and no `data-more-item=leagues`
   string is ever in the bundle (a static attribute is written unquoted
   into a template, which is the other trap). A row is found by the words
   of its line, as the Developer row's absence is held today
   (`assert-no-portable-console.mjs`, "production server");
3. gets a source fold test like `src/features/ear-lab/merc/fold.test.ts`;
4. lists any statically imported module with module-level state in the
   native config's `moduleSideEffects` set (`KARAOKE_STAGE_2` and its kin in
   `apps/mercurypitch/vite.config.ts`), or imports it dynamically.

A test that needs a switch on mocks each name the code imports: mocking
`KARAOKE_IMPORT` does not flip a constant derived from it inside
`importOriginal()`.

---

## Slice 1: the More sheet as a grouped list (built)

### The anatomy

An inset grouped list on the kit's sheet. Each group is a 13 px uppercase
title over an opaque rounded card of rows. Each row is one button:

| Part    | Spec                                                                      |
| ------- | ------------------------------------------------------------------------- |
| Row     | 56 px tall, the whole row the target; 16 px in from the card              |
| Chip    | 30 px rounded square (8 px radius), the group's tint, white 20 px glyph   |
| Name    | 17/22 px, weight 500, primary ink                                         |
| Line    | 13/18 px, secondary ink, one line, ellipsis                               |
| Dot     | 8 px, accent, before the chevron; "New" to a screen reader; never a count |
| Chevron | `ChevronIcon` at 16 px, muted ink                                         |
| Rule    | 1 px between rows, from the name's edge (58 px), not under the chips      |

Nothing on the sheet is under 13 px. Every row is 56 px, so every target is
past 44. Press feedback is a change of ground, which reduced motion keeps;
nothing in the list animates. Hover lives behind `@media (hover: hover)`.

### The groups

| Group    | Tint                     | Rows                                            |
| -------- | ------------------------ | ----------------------------------------------- |
| Rooms    | violet `#7c4dff` (4.8:1) | Karaoke, Piano, Guitar                          |
| Together | teal `#0e8f7f` (4.0:1)   | Leagues, Legend, Community: each on its switch  |
| You      | slate `#64748b` (4.7:1)  | Account, Developer (test builds), Settings last |

The ratios are the white glyph on the chip (WCAG 1.4.11 asks 3:1). The tints
are fixed rather than themed: a chip is the same thing in the dark. With no
Together switch on, the group is not drawn, so slice 1 ships Rooms and You.

### The lines

Every line is a synchronous read of a store some other part of the app
keeps filled; the sheet never fetches on open. The rows mount only while the
sheet is open (the kit's `Sheet` wraps them in a `Show`), so the reads cost
nothing while it is closed. The wording lives in `shell/more-lines.ts`, pure
and tested.

| Row       | Source                                                                    | Lines                                                                                                                                   |
| --------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Karaoke   | `roomLibrary()`; in a test build `importsInFlight()`, `karaokeNewSongs()` | "3 songs ready"; "2 songs on their way"; "1 new song to sing" with the dot; "Sing along with the words" before the library is read      |
| Piano     | `gameState()`, `selectedSongName()` (falling-notes store)                 | "Paused: Clair de Lune"; else "Play along with falling notes" (a loaded song that is not paused is the first scale, which nobody chose) |
| Guitar    | `savedMidiSongs()`                                                        | "2 songs of yours"; else "Tuner, chords and songs" (the Guitar room's live state is inside App's provider, out of the shell's reach)    |
| Account   | `accountSignedIn()`, `accountCard()`, `accountProviderLine()`             | "Signed in as Maya"; "Signed in with Apple" with no name yet; "Sign in to keep your runs"                                               |
| Developer | `COMMIT_SHA`, `API_BASE_URL`                                              | "Build 1a2b3c4, dev server"                                                                                                             |
| Settings  | `knownInput()`                                                            | "The microphone is off" once refused; else "Microphone, storage, appearance"                                                            |

The one dot today is Karaoke's: a song of the singer's own, separated and
not yet sung, the same thing the library marks New. Settings has no "new"
signal (its alert is a question, not news), so it carries none. A count that
asks nothing of the reader is never a line.

The Stage 2 reads (`importsInFlight`, `karaokeNewSongs`) are behind
`KARAOKE_IMPORT`, as the Karaoke room reads them; the module is already in
the native config's side-effect-free set, and the production-target build
was checked to carry none of it (assert-bundle STAGE 2).

### The detent

The sheet sizes to its list, capped at the large detent under the status bar
(`--sheet-max-h: calc(100dvh - safe-top - 8px)`). With Rooms and You it is
the medium detent: 53 % of a 390 x 844 phone in a test build, 47 % in the
store build. Each group the switches add grows it towards large; a list
taller than that scrolls inside it. There is no snap point to drag between:
the kit's `Sheet` has one, the content.

On a phone held sideways the groups stand in two columns (the whole list in
239 px of a 390 px high screen); an upright tablet centres it at 600 px.

### The glass

The panel is the kit's glass (`--glass-bg`, the blur the sheet already
carried); the cards on it are opaque, because glass is for floating chrome
and never glass on glass. In light the glass is thicker, 92 % rather than
the kit's 72 %: at 72 % a light sheet over a dark room turns a muddy grey,
and the group titles, the one ink drawn on the glass itself, fell to 4.35:1
over a black room. Measured contrast, composited over the worst room behind
the scrim (black and white both tried), at every viewport: at least 5.6:1 in
dark and 4.9:1 in light.

The grounds (sheet, card, press, rule) are tokens on `.mp-shell`, dark and
light, not theme rules on the panel: the sheet takes a snapshot of its
anchor's custom properties as it opens, inks included, and a live theme rule
on the portal would draw the old ink on the new card when the phone flips
its theme with the sheet open (MISTAKES.md).

### Checked

- The app-check viewports, at 3x: 390 x 844, 375 x 667 and 360 x 640; light,
  dark and reduced motion; signed out and signed in; a test build and a
  store-shaped build; and 844 x 390 and 1024 x 1366. No text clipped, nothing
  scrolls sideways, every row 56 px.
- `scripts/assert-no-portable-console.mjs` now fingerprints the Developer
  row by the words of its line ("production server"), which only that row
  says: the production-target build passes `--store-binary`, the test build
  trips it. Before this, nothing held the row's absence to the built bundle.
- assert-bundle on a production-target build and on a test build.

---

## Slice 2: Leagues, read-only (built)

A pushed screen, `'leagues'`, from the Together group's Leagues row
(`apps/mercurypitch/src/shell/leagues/`).

### What it shows

1. **Your rung.** The trophy (`/leagues/lN.webp`, already in the native
   bundle via `native-assets.mjs`), the rung's name, your points this week
   and your place ("4th of 23"), the zones ("The top 10 move up to Skyvox",
   "The bottom 10 drop to Mercling"), and the next cut in words ("Next cut in
   3 days"; never `formatCutCountdown`'s "3d 4h").
2. **This week's standings.** The top 50 the worker sends, with the
   promotion and relegation lines where the web draws them, your row marked
   You. The zone cut lives in one pure module, `src/lib/league-board.ts`,
   mirroring the server's (`league-cut.ts`): only members with points move
   up. The Progress card reads its zone from the same module, so a singer in
   the top ten with no points is in the holding zone on both; before, the
   card called that the promotion zone, which the cut would not honour.
   The web's Leaderboard keeps its own copy of the cut, which agrees.
3. **The ladder.** The seven rungs, yours marked, those above you veiled
   ("Reach Highnova to unveil its trophy"), the mystery rung "Coming soon".

### Its states

| State                                   | Screen                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Not signed in, or an anonymous identity | The ladder, and a card: "Leagues are for registered singers", Sign in (`openSignIn()`)        |
| Signed in, loading                      | The ladder at once, then the rest                                                             |
| Signed in, the fetch failed             | "Could not load your league", Try again (the web has no error state; DevicesScreen's pattern) |
| Signed in, the server refused           | The session is asked to sign in again (`handleCloudSessionRejected`), as the account card is  |
| Signed in, the week turned              | The new week's league is read; the ladder keeps the rungs already unveiled meanwhile          |
| `reason: 'unavailable'`                 | A plain note that leagues are not on this server yet                                          |
| Eligible                                | The three parts above                                                                         |

Signed in is `accountSignedIn()`, never `hasValidToken()`, which is true for
an anonymous identity and hid the web's sign-up for exactly those singers.
The screen reads again when `accountSignedIn()` turns true, so signing in
from its card fills it. Try again stays on screen, `aria-disabled` rather
than `disabled`, while its read is out, and hands focus to the league's
name once one lands: a removed or disabled button drops the focus it has.
`readLeagueMe` (league-service.ts) tells a refused session (a 401, or the
403 a suspended account gets) from no answer, as `readMe` does; any other
403 is no answer, as for every data read, so it signs nobody out.
`fetchLeagueMe` stays the web's passive read.

### Names

Every name on the board is the worker's: `readLeagueMe` already shows a
member's display name only when `leaderboardOptIn` is on, and a weekly
pseudonym ("Singer-3fa2c1") otherwise. The phone adds no name of its own
and keeps none in storage: the kept league drops the standings, which stay
in memory for the screen that showed them. One consent for every board;
slice 2 asks for none, because it publishes nothing.

### The More row's line

`league-store.ts` keeps the last `LeagueMe` for the account the token names
(`currentAccountId()`), with the public ladder: let go when the phone signs
out or changes hands, read again for an account that signs in, filled by
the Leagues screen and on the app's return to the front at most every
quarter of an hour (`LEAGUE_FRESH_MS`), never by the sheet. Asks that
overlap share one read, and a cold start reads once, from the account
watcher's first run. The line: "Sparkwing, 4th of 23"; "Sparkwing, no
points yet this week"; "Sign in to climb"; and "A rung higher every week"
before anything is known. A league kept from an earlier week is not named:
the Monday cut may have moved the singer since. Which week a league is
from is judged by when the phone read it (`leagueReadThisWeek`), on its own
clock at both ends, not against the week the server named: a phone whose
clock is a day out still shows what it read a moment ago.

### The switch and the proof

`NATIVE_LEAGUES` in `native-build.ts`; the screen is a lazy import behind it
in `NativeShell.tsx`, and `pushScreen('leagues')` refuses without it, as it
refuses `'developer'`. STAGE 2 markers: the row's line ("A rung higher
every week"), the screen's test id (`shell-leagues`), its signed-out
heading ("Climb a rung every week") and the store's key (`mp:league-card`).
The store is in the native config's side-effect-free list, the More sheet
reads it only inside its folded Together group, and
`apps/mercurypitch/src/leagues-fold.test.ts` holds the sources to all of
it. New shell icon: none (`TrophyIcon` exists).

### Found while building it

- The Settings stack titles its groups at 11 px; the Leagues screen lifts
  its own to 13, and Settings keeps its.
- The kit's primary button (`.mp-set-button`) set its label in the inverse
  ink, 4.4:1 on the light theme's accent. It is a shell token now
  (`--mp-button-ink`), white in light (5.2:1), for every screen and sheet
  that uses the button.
- DevicesScreen and AccountScreen remove their retry button while its read
  is out, so focus drops to the page; the Leagues screen does not copy
  that. A follow-up for those two, not this slice.

---

## Slice 3: the Legend as a native room (built)

Behind `NATIVE_LEAGUES`, from the Together group's row. Named **Legend**, as
the web names it, and never "This week's challenge": a Legend runs one to
eight weeks and stays open two days past its close
(`challenge-period-neutral.test.ts`), so no copy names a period, and the
close is said as time left.

### The row

"Legend", a calendar chip, and a line from `legend-store.ts` (`mp:legend-card`):
"Ends in 3 days" (rounded to the nearest day or hour, as Leagues' cut now is,
`duration-words.ts`), "Sung, best 82%" once the singer has a take, "Closing"
in the two days' grace, "The next Legend opens soon" with none running, and
"The line everyone sings" before the phone has read anything. The store keeps
the running Legend's id, title and close for anyone, and the singer's own
best for the account that sang it; never a name from the board. It is keyed
on the Legend's id and close, never the running week (MISTAKES.md, "A
watermark that names the running week must include it next time"): read at a
cold start, on a return to the front unless the last read is fresh and its
Legend still open, after every posted take (`weeklyAttemptVersion`), and
again for an account the last read was not made for.

### The room

A full-bleed premium room, `'legend'` (`premium-rooms.ts`): held upright, the
rail away, its own scroller for the door. Back is the bar's, as in every
premium room: it leaves the room, and leaving drops a take and lets its
attempt go. Opening it from More with a run on screen parks the run first
(`parkRun`), and the shell's transport steps aside under any full-bleed room,
as the rail does.

The door is the running Legend: its close, its title and line, Hear the line
(the line played at its written pitch, its first note in the tap), Hear the
original when the Legend links one, Sing it and Practice, the top three and
the singer's standing in words ("Your best 74%, in the top 28% of 18"; never
their rank beside the top rows', which count the Founder), and the past
Legends, each to practise. Out of range, it says so before the take: "This
Legend is written above your baritone range, a feat for another voice. Sing
it anyway if you like: it is scored as written."

### The take (`legend-take.ts`)

- **Never transposed.** No octave shift reaches the session.
- **The same scoring and the same funnel.** A fresh zen session per take
  (`loopLimit: 1`), fed the room's mic frames (`useExerciseCapture`, opened
  in the tap, no audio clock asked for) as the web's practice frames on the
  same clock; `summarizeChallengeRun` scores it; a ranked take goes through
  `recordChallengeStageResult` to the board. The phone has no take
  recorder, so its replay is reported unsupported, which never costs the
  score.
- **One armed attempt counts once.** A ranked take arms in its tap; practice
  clears any armed attempt; the attempt is let go when the singer leaves the
  take, when the mic will not open, at Done, and when the room goes. The
  web's stage keeps one armed after a failed save; the room does not.
- **The room shows its own result.** The attempt names the room as its
  presenter (`presenter: 'native-room'`), so its saving and its result go to
  `roomFinalizing` and `roomChallengeResult` (challenge-result-store.ts),
  which the app's result card never reads: the card cannot draw over the
  room. The result says "Saving your take", then the web's tier headline and
  the score against what the Legend asks, or that it was not posted.

### Consent and the account

A ranked take needs a signed-in account (decision 12). Consent is read ahead,
on each account change, because the mic must open in the tap with no wait
in between. The first ranked take asks, in a kit sheet: "Show my name on
public boards" (`grantBoardConsent`; the next tap starts the take), "Practice
without ranking" (starts practice in that tap), or "Not now". The Account
screen gains "Show my name on public boards" (Leagues, Legends and the
leaderboard), on every build: off, `revokeBoardConsent` takes the name off
every board at once, past podiums included.

### The fold

The room is a lazy chunk behind the switch, `pushScreen('legend')` refuses
without it, `legend-store.ts` is in the native config's side-effect-free list,
and the More sheet reads it only inside the folded group. STAGE 2 markers:
`shell-legend`, "Practice without ranking", `mp:legend-card`, "The line
everyone sings". `legend-fold.test.ts` holds the sources to all of it.

### Found while building it (web, not changed here)

- The web stage clears an armed attempt on leave only when the take did not
  complete, so a failed save leaves it armed and the next sight-singing drill
  posts to the Legend board.
- "Practice in Zen" from the web's result card hands the line to Zen with an
  octave shift, so the replay is transposed.
- The web stage's practice copy names a period ("This week has ended"), and
  `challenge-period-neutral.test.ts` misses it: its JSX-text pattern skips
  text that spans lines.

## Slice 3b: the Legend in the native rooms' light (built)

Slice 3 drew its take with the web's zen canvas (its amber pills) inside the
native room. The owner asked for the native look the Ear Lab took
(`docs/plans/ear-lab-native-look.md`) and approved the mock-ups (the canvas
"Legend Native Room", nine phones). Nothing a take scores changes: the zen
session and `summarizeChallengeRun` stay, unseen, so a phone's 84 % and a
browser's 84 % mean the same on one board. Only the drawing moves.

### The language

The dark stage with the Legend's violet and cyan glow, glass cards and
chips, the filled violet for the one main action and glass outline for the
rest, Inter for every word (`legend.css`). Lit violet is the singer's turn,
teal a lit note and red a miss, and a state is never colour alone: a lit or
missed note carries a check or a cross, and the words beside them count.

### The door

A chip with the line's notes ("8 notes · C4 to G4") over the line itself as
a poster (`LegendPoster.tsx`): a bead at each note's start on its pitch's row,
one lit thread through them held for each note's length. Hear the line lights
each bead as its note sounds (`lineNote` in `legend-take.ts`). Under it the
close, the title and the description, the hear row, three tiles (what the
Legend asks for, the Founder's score, the singer's best), the counts, the
board and the past Legends. Sing it and Practice sit in a dock over the
scroller's foot.

### The take

`LegendLane.tsx` draws `laneView` (`legend-lane.ts`, pure): the line as glass
notes passing a now line, one row to a pitch, the voice a lit ribbon up to
it. The note under the now line is lit violet, brighter as the voice nears
it; a passed note is teal when the web stage's own highlight cleared it and
red when it missed (`challengeTargetHighlights`), so the lane and the score
never disagree. The chip counts the notes lit, with a dot for each note; Merc
gives the first note during the count-in ("Sung as written, for everyone");
the room kit's mic button ends the take.

### The result

As the Ear Lab's plate shows a run: a kicker and a state chip (Saving,
Posted, Not posted, Not ranked), the score at 72 px, the result's headline
and what the Legend asks, the whole take at once (`LegendTrace.tsx`: every
note lit or missed under the voice), "7 of 8 lit" and which way a miss went
("E4 missed, sung flat": the middle of what was sung in the note's window,
`missesOf`), the singer's standing once the board has it, and Merc's word on
a posted take. The saving face keeps the number and the trace where the
posted face has them, so only the words change when the save lands.

### The second way in

The Sing room's exercise picker shows the running Legend above its
exercises, under a heading of its own, its art lit as the room is. The shell
words the card and opens the room (`legend-card-wiring.ts`, the `legend`
member of the native shell API), as it opens an exercise, so the Sing room
carries none of the Legend's copy and a store build none of the card
(`assert-bundle.mjs`, STAGE 2).

---

## Slice 4: Community, moderation first

Before Community ships in the store build, App Store guideline 1.2 asks an
app whose users post content for four things: a filter on what is posted, a
way to report it (and a timely answer), a way to block a user, and published
contact information. Play's user-generated content policy asks the same,
with terms accepted before posting. The worker has admin suspension
(`workers/db-worker/src/moderation.ts`, curl-only) and admin score removal
(`score-visibility.ts`), and nothing a singer can use.

### What a singer can post today

| Content                                             | Checked on the server                               | Seen by others                                      |
| --------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `userProfiles.displayName`                          | Nothing (the client caps it at 40)                  | Leaderboard, weekly board, leagues, friend requests |
| `userProfiles.bio`, `avatarUrl`                     | Nothing (no app UI writes them; the API takes them) | `GET /api/userProfiles/:id`                         |
| `sharedMelodies` name, `author`, `tags`, lyric text | The 256 KiB body cap only                           | The public melody board                             |
| `sharedSessions` name, `author`                     | Nothing (the client's zod only)                     | The public results board, `SharedRunResult`         |

There are no comments, likes or messages in Community. `author` on both
share tables is whatever the client sends, so a singer can post under any
name; it comes from the server in 4a.

**Already true of the shipped app.** A native singer can set a display name
(`AccountNameScreen`), and the web Leaderboard, with names and Add friend,
opens from the Progress league card. So 4a's filter, report and block cover
the boards as well as Community, and they are worth landing before the next
store release whatever happens to slice 4.

### 4a, the worker (its own PR, first; built)

1. **Migration `0072_reports_and_blocks.sql`,** purely additive:
   `contentReports` (`reporterId`, `targetUserId`, `targetKind` in `user`,
   `profile`, `melody`, `session`; `targetId`, `reason` from a fixed list,
   `note` up to 500, `status` in `open`, `actioned`, `dismissed`,
   `resolvedAt`, `resolvedBy`; a partial unique index so one reporter cannot
   open the same report twice) and `userBlocks` (`blockerId`, `blockedId`,
   `createdAt`, primary key on the pair). Both worker-internal, outside the
   CRUD `TABLES`; both erased on account deletion and added to the
   hand-written list in `auth.test.ts` that fails when one is forgotten.
   Reports go in `USER_OWNED_TABLES` by `reporterId`. Blocks must go from
   both sides, and that list holds one column per entry: either two entries
   (`blockerId` and `blockedId`) or a both-sides `DELETE` beside the one
   `follows` gets in the account deletion (`auth.ts`); `follows` itself is
   not in the list.
2. **Routes,** registered after `getAuth` and before the CRUD regex
   (`index.ts`, the `^/api/([A-Za-z]+)` match would answer 404 "Unknown
   entity"): `POST /api/reports`; `GET`, `POST` and `DELETE /api/blocks`;
   admin `GET /api/admin/reports` and `POST /api/admin/reports/:id` to
   resolve; an admin takedown of any share (`canWriteRow` has no admin case
   for `'shared'` today). Each write gets its own `RATE_LIMITS` bucket: a
   bucket that is not in the table always passes.
3. **Blocks applied on the server,** for the blocker: the shared lists, the
   leaderboard, the weekly and league boards, and friend requests refused in
   either direction, with existing `follows` rows deleted on block. The
   phone hides a blocked singer too, for what it has already loaded.
4. **A suspended singer's shares hidden:** the `'shared'` branch of
   `scopeRead` joins `users.suspendedAt IS NULL`.
5. **The name filter,** a pure module (`workers/db-worker/src/name-filter.ts`,
   importable by the app as `validation.ts` is): normalise (case, width,
   look-alike letters, separators), match a word list, cap the length. Called
   from `validateWrite` for every field in the table above, and from the
   three name paths that write SQL directly (register, and the Google and
   Apple name in `auth.ts`). `author` becomes a server column read from the
   profile. Existing rows get a one-off report, not a silent rewrite.
6. **The owner hears of a report** by mail, on the `sendBillingAlert` pattern
   (`email.ts`), so a report is answered within a day.

With unit tests beside each module and node integration tests on the real
migrations (`node-tests/`, the follow-requests suite's helpers), across an
account switch.

**As built** (the requirements are
[`docs/specs/reports-and-blocks.ears.md`](../specs/reports-and-blocks.ears.md)),
with what moved from the list above:

- **A block reads both ways.** 4b's sheet says "You will not see each
  other's names or posts", so the worker hides each singer from the other,
  not only the blocked one from the blocker (`blocks.ts`).
- **A block hides names and never moves a place.** The boards rank in code
  after their query, so each ranks everyone first and drops the hidden rows
  after: the places either side of a gap stay true, and the league cut and the
  weekly podium read the whole field. The leaderboard and the weekly board do
  it with `withoutHidden`, the league standings with a `hidden` column, which
  leaves a pseudonym row alone (hiding it would unmask it). The gap is the
  trade-off: a blocked singer may guess who blocked them from it.
- **`author` is read from the profile as well as written from it.** A share
  is created under the poster's profile name and shown under their current
  one (`share-authors.ts`), so a rename reaches every share and a name stored
  before the filter is never what anyone sees. The stored column stays
  filled: it is `NOT NULL`.
- **The filter has two tiers** (`name-filter-words.ts`): the worst slurs are
  refused everywhere, a melody's lyrics included; everything else only in
  names and titles, because songs carry crude words and some listed words are
  innocent in other languages. Each word is matched on its own, never across
  two ("Push It"), and words that names contain ("Yamashita", "Siriporn")
  only stand alone. A few words stay off the list because a name or title
  carries them innocently ("Moby Dick", "Van Dyke", "Kike" for Enrique).
- **The one-off report is the owner's audit route,**
  `GET /api/admin/name-audit?kind=profiles|melodies|sessions`, a page at a
  time: it lists the rows that fail, and changes none.
- **The owner's mail** goes to `BILLING_ALERT_EMAIL` under
  `[MercuryPitch report]`, for the first open report on a target only.
  Answering one report answers every open report on the same target, and a
  report still open when its reporter deletes their account stays, unsigned.
- **Known limit:** the closed weeks' podiums (the weekly archive) are read
  without an account, so a block does not reach them.

### 4b, the phone

Report and Block wherever another singer's name appears: a kit sheet from a
long press or a "..." on a board row, a shared result and a melody card.
Report asks for a reason from the fixed list and an optional note; Block
says what it does ("You will not see each other's names or posts") and is
undone from Settings, Blocked singers. The report sheet and Community's foot
carry the contact line: the contact form (About's "Contact us" links
`CONTACT_FORM_URL` today), opened through `contactFormUrl()` with a topic
for reports.

**As built** (the worker's half is REQ-RB-040 and REQ-RB-041 in
[`docs/specs/reports-and-blocks.ears.md`](../specs/reports-and-blocks.ears.md)),
with what moved from the paragraph above:

- **Where the phone shows another singer's name, all of it.** In the store
  build, where `NATIVE_LEAGUES` is off, one place: the web Leaderboard,
  which Progress's league card opens ("Open Leaderboard", `#/leaderboard`,
  `progress-view-model.ts`). Verified three ways. The source: the rail's
  Progress is `TAB_PROGRESS`, which App draws in the native build as on the
  web (only Home and Settings are the web's alone there); the card's action
  is a plain hash link; the native tab guard (`appModeBounce`) lets every
  available tab through; no build switch sits anywhere on that path. The
  record: the owner reached it on build 451 (`native-assets.test.ts`), and
  `scripts/probe-progress.mjs` follows the link on the built bundle
  (`walkLeaderboard`). And the walk, on this branch's built native bundle
  (a test build; nothing on the path differs in the store build): the probe's
  `--progress-only` passed at 393 x 852 and 390 x 844, and a one-off walk at
  390 x 844 opened the Leaderboard from the league card, found a 44 px "..."
  on every other singer's row and none on a stand-in or the singer's own,
  opened the sheet over it without the singer card, blocked a singer (the
  table went 1, 2, 4, 5, the podium's bronze said Hidden), and closed the
  sheet with Escape and with the shell's Back, the Leaderboard still up, no
  sideways scroll and no page error. All four of its views name singers:
  League (the standings), Friends and Global (the podium, the table, the
  singer card a row opens, friend requests), and Legends (the live Legend's
  top three, `WeeklyLegendHero`, and the past podiums,
  `PastWeeklyChallenges`). A test build adds the
  Leagues screen's standings, the Legend room's board and its past podiums.
  Not reachable on the phone: Community (shares and their authors, 4c), the
  Jam room, a shared result's page (no link opens the app) and the web
  Home's Legend card (Home is the web's alone). A redeemed friend code says
  "Ana added" in a toast, not a row; Ana is then a row on the Friends board.
- **One sheet, from a "..." on the row.** `src/components/moderation/SingerSheet.tsx`,
  on the kit's `Sheet`, in the app's tokens, drawn by one host per app
  (App.tsx on the web, NativeShell.tsx on the phone; its code loads the
  first time one opens) and opened from a 44 px "..." at the end of a row,
  "More about Ana" (`SingerMoreButton.tsx`). No long press. Panes: the
  choice; Report, with the worker's six reasons (`report-rules.ts`, worded
  plainly), a note counted to 500 and Send; Sent ("Thanks. We read every
  report within a day."); "We have your report already", when the singer's
  report on it is still open and nothing new was sent; Block, saying what
  it does before it does it; Blocked; and a pane for each way it can fail,
  worded from the service's outcome (`moderation-service.ts`), with Try
  again where trying again can help. A suspended account is told so, with
  the contact form and no Sign in; a server that failed (a 5xx, or an
  answer the phone cannot read) says "MercuryPitch could not answer just
  now. Try again in a moment.", apart from no connection. One request at a
  time: a second tap on Send, Block or Try again while one is out asks the
  worker nothing, and a request still out when the sheet closes moves no
  pane and frees nothing in the sheet opened next (a block that lands still
  has its board read again). Escape, the close button and the phone's Back
  (`shell-navigation.ts`) close it, and each pane change hands the focus to
  its title.
- **The focus, back to the board** (WCAG 2.4.3, `sheet-focus.ts`). The
  "..." records its board and its place there as it opens the sheet; a
  close hands the focus back to it, or, when a block took its row away, to
  the "..." now at that place, else the one before it, else the board's
  heading. For a minute after, a board read that draws every row anew puts
  the focus back the same way, and moves it on from the heading once the
  rows are back; it stops when the singer moves the focus or presses on the
  page, or another sheet opens, and waits out a sheet opened over the board
  (the sign-in). Every
  board says which it is (`data-singer-board`, its heading
  `data-singer-board-heading`): on the web the Leaderboard's table, its
  League standings, friend requests, the live Legend's card and the past
  Legends; on the phone the Leagues screen and the Legend room's board and
  past podiums. Two more places where a sign-in took the button the focus
  was on: the phone's Account screen hands it to the account's name, and
  the Leagues screen to the league's name once it is read.
- **The rows.** Leagues and the web's League view: a named row that is not
  the viewer's. The Legend boards: an entry with a `userId` that is not the
  Founder's or the viewer's. The web's Global and Friends tables, in a last
  column of their own that no width hides (the "..." stops its press, so the
  singer card does not open as well), friend requests, and a past podium's
  place, Report and Block. A row without one keeps its room, so the columns
  line up.
- **The past podiums, a place a line.** The archive is read with the
  session, and the worker withholds the names of the singers in a block
  with the reader, either way, places kept (REQ-RB-014); it is read again
  when the account changes (`archiveReader`, keyed by the account, not the
  token) and after a block made from it, and stays on screen while that
  read is out. On the phone's Legend room each past Legend is its name and
  close beside its Practice pill, then a 44 px line a place: the place, the
  name (cut short, never wide), the score and its "..." (`PastPodium`,
  `legend-past.css`). Walked on a test build at 320 x 640 and 360 x 640,
  dark and light, every request to the worker answered by the walk: no
  sideways scroll, each place and its "..." 44 px, the Practice pill 44 px
  high, the archive read with the session and again after a block, and the
  focus on the "..." now at the blocked place's after the read.
- **Without an account,** the sheet opens on "Sign in to report or block",
  with Sign in (the shell's sheet on the phone, the web's dialog on the web)
  and the contact form, and asks the worker nothing (decision 8).
- **The contact line** is on the report, its answer, a failed report and the
  account pane: the contact form on its `support` topic, with a first line
  naming the report ("About a report on Ana (user ...)"). For a suspended
  account, on the sheet and the Blocked singers lists, the same form opens
  "About my suspended account". The form takes only
  `ContactTopic`'s topics, so decision 9's reports topic waits for the
  landing site, outside this repository. Opened as About's Contact us is, a
  link to a new window, which the phone hands to its browser.
- **Hidden at once.** `src/stores/blocked-singers-store.ts` keeps the
  account's blocked ids, in memory only: read from `GET /api/blocks` the
  first time a board or a Blocked singers list asks for the registered
  singer signed in, not at every launch (the worker already leaves a blocked
  singer out of every read after the block, so the ids only matter for what
  a screen loaded before it), changed by every block and unblock made here,
  and never shown to another account. Each board filters them out of what
  it shows, places kept, and reads its data again (the sheet's `onBlocked`).
  The web's Global and Friends boards read again from the top, as deep as
  they were loaded: the worker drops the singer from its ranking, so a Load
  more from the old depth would skip the singer after them, and a page
  asked for before that read is dropped when it lands.
- **Cut by place, not by position.** The phone's league cut
  (`league-board.ts`) zoned each row by its position in the list, so a row
  left out, by the worker's block since 4a or by the phone's, moved every
  row under the gap up a zone. It cuts by `rank` now, and the web
  Leaderboard reads the same module in place of its own copy. Its podium
  reads its three places by rank too (`leaderboard-podium.ts`): a place
  hidden by a block keeps its medal and says Hidden, so silver never goes to
  whoever came third.
- **Blocked singers, in Settings.** On the phone, Account, Blocked singers
  (`'blocked-singers'`, `BlockedSingersScreen.tsx`): each singer with when
  they were blocked and Unblock, loading, an empty list, a failed read with
  Try again, and, in place of the list, nobody signed in, a device with no
  account and a refused session, each with Sign in, and a suspended account,
  with the contact form. The list is the account's: read as it opens and
  again for each account that signs in with it open, as the Leagues screen
  reads its league, and shown to no other. A button whose read or unblock
  is out stays put, `aria-disabled`, and keeps the focus; when it goes with
  what it did, the focus goes to what took its place, and after a sign-in
  from the list to its first row. On the web, the same list in account
  settings (`BlockedSingersList.tsx`, `blocked-list-flow.ts`). Both, the
  sheet and every row but the Leagues and Legend screens' ship in every
  build.
- **The worker,** two additive fields: `named` on each league standings row
  (REQ-RB-040), `userId` on each non-Founder entry of the running Legend's
  board (REQ-RB-041, `weekly-board.ts`). A worker without them sends rows on
  which the phone offers nothing. And the archive read with a session
  withholds the singers in a block with the reader (REQ-RB-014,
  `withholdNames`). Nothing stored that answer before: the worker uses no
  edge cache, its answers say `private`, and the service worker leaves
  `/api/` and every other origin alone (`sw-runtime.ts`). The reader's own
  answer now says `private, no-store`, and every archive answer
  `Vary: Authorization`, so none can stand in for another reader's.

Left for 4c and a device check: the sheet on real phones (the keyboard over
the note, VoiceOver and TalkBack through the panes, Android's Back, the
contact form in the system browser); the landing site's reports topic; and
Community's shares, whose "..." reports a melody or a result (the sheet
already takes `report: { kind, id }`).

### 4c, Community

Behind `NATIVE_COMMUNITY`: the public results and melodies in the native
kit, your own profile (`ProfileView`'s figures, redrawn), and a shared
result opened from a link (`SharedRunResult`, `shared-run-link.ts`). There
is no public profile of another singer anywhere today, and this slice adds
none. The More row's line comes from what the screen last loaded, cached
like Leagues'. New shell icon: two people, in the house style.

`NATIVE_COMMUNITY` stays off in the store build until 4a is live on the
production worker and 4b ships with it.

**As built** (the worker's half is REQ-RB-042 in
[`docs/specs/reports-and-blocks.ears.md`](../specs/reports-and-blocks.ears.md)),
with what moved from the paragraph above:

- **The switch.** `NATIVE_COMMUNITY` in `src/lib/native-build.ts`, equal to
  `KARAOKE_IMPORT`: on in a test build, off in the store build. Two pushed
  screens, `'community'` and `'community-result'`
  (`apps/mercurypitch/src/shell/community/`), each a lazy chunk behind it
  in `NativeShell.tsx`; `pushScreen` refuses both without it.
- **The row.** Community, last in the Together group, on a two-people chip
  (`PeopleIcon`, new in `shell/icons.tsx`). The group is drawn when either
  switch is on, and each row keeps a ternary of its own. The line counts
  what the screen found when it last loaded: "4 melodies, 12 results",
  "2 results", "Nothing shared yet", and "What other singers shared" before
  the first load, each short enough for a 320 px phone.
  `community-store.ts` keeps the two numbers under `mp:community-card`,
  with the account they were counted for, and never a name or a title. Only
  the screen fills it: no read on the return to the front, and none from
  the sheet. When the account signs out or the phone changes hands, they
  go from the phone with everything else kept for it
  (`installCommunityWatch`, as the league the Leagues row names goes); a
  token refreshed for the same account is no change, and reads nothing.
- **The screen.** The singer's profile, then Melodies, then Results, then
  the contact line. The lists are the web's public reads, one page, newest
  first, everyone's, the singer's own marked You. `readSharedMelodies` and
  `readSharedSessions` (`share-service.ts`) reject when the worker does not
  answer, where the web's `load*` answer an empty list
  ([MISTAKES.md](../agent/MISTAKES.md), "Ask a cloud read to throw before
  calling what it returned empty"); the `load*` are wrappers over them now.
  Nothing on a row is cut short: its title wraps, since a melody has no
  screen of its own to read the rest on, and its line (who shared it, how
  many notes or runs, and the day) wraps between those, never inside one.
- **A melody has no Open.** The web opens one in Compose, its piano-roll
  editor, which the phone does not carry. The Sing room is the phone's room
  for a melody, but it sings only the singer's own melodies, picked from its
  own song list in its own tap (its sound starts in that gesture). Opening a
  share there would mean writing it into the singer's library, counted as a
  melody they wrote (`updateMelody` records `melody_created`), and still
  leaving them to find it at the foot of that list. So a melody row says
  what the melody is, and nothing pretends to open it.
- **A shared result** is pushed over the list (`CommunityResultScreen.tsx`):
  SharedRunResult's content, its name, who shared it and when, the average
  at 44 px and each run's score, and "This is a shared result. Viewing it
  does not add a run to your practice history." It is the result the list
  read: nothing is asked of the worker for it. No link opens the app, so it
  is opened from the list alone, and `shared-run-link.ts` stays the web's.
  Back, the bar's or the phone's, leaves it for the list, which is drawn
  anew: the list is put back where it was scrolled to (kept per account),
  the focus goes to the row that opened the result, whole between the bar
  and the dock (`list-place.ts`), and nothing is asked of the worker. The
  next Back leaves Community. Drawn again later (a screen pushed over it,
  then Back), the result says what is true of it now
  (`openedResultState`): still there; its singer blocked, in the sheet's
  own words; gone from the latest read; or opened for an account no longer
  signed in.
- **Your profile.** ProfileView's figures, from the same `run-kinds.ts`:
  the runs (every run the account holds, `loadProgressSessionRecords`, as
  Progress counts them, not ProfileView's last 50), the best, the recent
  average and the streak once there is one; "Member since October 2026";
  and "You shared 2 melodies and 1 result". No runs: "Nothing to show yet.
  Finish a run and your figures start filling in here." The card waits for
  those figures: before them it would name nobody. The trend chart, the
  badges and the voice twin stay on the web. Signed out, a card asks for a
  sign-in ("Sign in to see your runs, your best and your streak here."),
  the lists still show, since anyone may read them, and the screen reads
  again for whoever signs in.
- **The states.** "Loading what singers shared"; "Nothing shared yet. When
  singers share a melody or a result, it shows here."; "Could not load
  Community. Check the connection and try again." with Try again, which
  keeps its focus while its read is out and hands it on once the read
  lands, unless the singer has put it somewhere else meanwhile; and
  offline, where the phone asks
  nothing: "You are offline. Community shows what singers shared once this
  phone is online again.", read again when it is. A signed-in singer whose
  runs could not be read is a failed read too: a profile of no runs would
  be a profile that is wrong. What was loaded before stays on screen.
- **Report and Block.** Every share by another singer ends in a 44 px
  "...": the singer sheet, with the share named in its report,
  `report: { kind: 'melody' | 'session', id }`, and in the button's name,
  "More about Moon River, by Ada", so two of Ada's shares are two buttons
  (`SingerMoreButton`'s `label`; the boards keep "More about Ada"). None on
  the singer's own, none on a share with no `userId`. The worker already sent the poster's
  `userId` on every public share read, so no field was added; REQ-RB-042
  pins it, with a test on the real migrations
  (`community-share-singers-integration.test.ts`). A block takes the
  singer's shares off both lists at once (`blocked-singers-store.ts`) and
  reads them again, a fresh read rather than one already out. Each list is
  a board of its own (`community-melodies`, `community-results`, its title
  the heading), so the focus goes to the "..." now at the blocked share's
  place on that list; with both lists empty, the empty line takes it. A
  read that brings a row back unchanged keeps the object the screen drew,
  so Solid redraws only the rows that changed and the focus stays on the
  rest. Blocked from a result, the result is hidden ("Result hidden", and
  the sheet's "You will not see each other's names or posts...") and the
  focus goes to its heading.
- **The contact line** is the foot of both screens: "Something here that
  should not be?" and Contact us, the contact form on its support topic.
- **Focus.** A pushed screen that asks hands the focus to its title as it
  opens (`PushedScreen`'s `focusTitle`); Community's two ask. The other
  screens keep the focus rules they were built with.
- **The fold.** STAGE 2 markers: `shell-community`, `shell-shared-result`,
  the profile's signed-out line, `mp:community-card`, the row's first line
  and the chip's path data. `community-store.ts` is in the native config's
  side-effect-free list; the More sheet reads it only inside a branch the
  switch folds, and the shell reaches it through `community-entry.ts`,
  whose every call into it is behind the switch. `community-fold.test.ts`
  holds the sources to all of it, the never-a-`<Show>` rule included. What
  a store build does carry, as it carries Leagues' and the Legend's: the
  two screens' ids and their titles in `ShellScreens.tsx`'s table
  ("Community", "Shared result"), which no build can push.

Walked on the native dev build in Chromium at 320 x 640 and 390 x 844,
light and dark, every request to the worker answered by the walk: no
sideways scroll and every target 44 px on the list, a result, the
signed-out card, a failed read and offline; the sheet from a share's "...";
after a block, the singer's shares gone from both lists and the focus on
the next "..."; the focus on each screen's title as it opens; and Back from
a result on its row, the row in view clear of the dock and no request made.
assert-bundle passed on a test build (every STAGE 2 piece, Community's among
them) and on a production-target build, which carries neither screen, the
row, its line, its chip nor the store: of Community, only the two titles
and ids above.

Left: posting and sharing from the phone, which wait on the Terms (open,
below); a melody's Open, until the Sing room can be handed a melody;
another singer's public profile, which nothing has; and the device check
4b left, now with Community's sheets in it.

---

## Decisions, with the recommendation taken

Each is applied as written unless the owner says otherwise.

1. **Leagues and the challenge share `NATIVE_LEAGUES`; Community has
   `NATIVE_COMMUNITY`.** Both derived from `KARAOKE_IMPORT`, no new define.
2. **Light glass at 92 %,** the kit's 72 % kept for dark. 72 % fails AA on
   the group titles over a dark room.
3. **Account, signed out: "Sign in to keep your runs",** the owner's words,
   in `account-copy.ts` with the rest of what an account keeps.
4. **The Leagues and challenge lines come from small caches** filled on the
   foreground and by their screens, never from the sheet.
5. **The challenge is a native room,** not App's stage reused.
6. **Consent is asked once, before the first ranked take,** and can be
   turned off on the Account screen.
7. **Moderation lands before Community, and covers the boards too,**
   because the shipped app already shows other singers' names.
8. **Who may report and block:** registered accounts only, as posting and
   friend requests are. An anonymous identity reads the boards but has no
   name on them to protect; it reaches the contact form instead.
9. **The contact line is the contact form,** with a reports topic. The site
   publishes no address on purpose (`contact-links.ts`). The topic is two
   changes: a member of the closed `ContactTopic` union in
   `src/lib/contact-links.ts` ("anything else is ignored on arrival"), and
   the form on the landing site, outside this repository.
10. **One cut for every surface on the phone** (slice 2):
    `src/lib/league-board.ts`, read by the Leagues screen and the Progress
    card, so the card no longer promises a promotion the cut would not
    make. That changes the web's card too, for the same singers.
11. **The phone keeps no board** (slice 2): the singer's own league and
    place for the More row, never the other members' names.
12. **A ranked Legend take needs a signed-in account** (slice 3), as Leagues
    do; practice is anyone's.
13. **The Legend room presents its own result** (slice 3): the attempt names
    its presenter, and the app's card never sees a native take.
14. **Back leaves the Legend room** (slice 3), as every premium room's does,
    and drops a take in progress; there is no "End the run?" question.
15. **The Legend is a premium room with two ways in** (slice 3b): More's
    Together row and a card over the Sing room's exercises. It is not hosted
    in the Sing room: that room has no score by design and runs on the
    singer's own song and key.
16. **The take keeps the web's scoring and loses its canvas** (slice 3b):
    the zen session scores it, the room draws it.

## Open, for the owner

- **The Terms.** Play asks that terms define objectionable content and are
  accepted before posting, and App Review asks for "no tolerance". The Terms
  live on the landing site, outside this repository; whether they say so is
  unchecked.
- **The word list** for the name filter: 4a ships a starting list in
  English (`workers/db-worker/src/name-filter-words.ts`). Which words to add,
  and which other languages, is the owner's call.

## Order

| PR  | What                                            | Switch             |
| --- | ----------------------------------------------- | ------------------ |
| 1   | This plan, and the More sheet as a list (#1267) | none               |
| 2   | Leagues, read-only (#1272)                      | `NATIVE_LEAGUES`   |
| 3   | The Legend as a room                            | `NATIVE_LEAGUES`   |
| 3b  | The Legend in the native rooms' light           | `NATIVE_LEAGUES`   |
| 4a  | Reports, blocks, the name filter (worker)       | none (worker)      |
| 4b  | Report and Block on the phone, contact line     | none               |
| 4c  | Community                                       | `NATIVE_COMMUNITY` |

4a does not wait for 2 and 3: it can start beside them.
