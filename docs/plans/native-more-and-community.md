# The native More sheet as a list, and Together on the phone

Status: slices 1 and 2 merged (the More sheet as a list, #1267; Leagues,
read-only, #1272); slice 3 built (the Legend as a native room); slice 4
planned. Each slice is its own PR.

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

### 4a, the worker (its own PR, first)

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

### 4b, the phone

Report and Block wherever another singer's name appears: a kit sheet from a
long press or a "..." on a board row, a shared result and a melody card.
Report asks for a reason from the fixed list and an optional note; Block
says what it does ("You will not see each other's names or posts") and is
undone from Settings, Blocked singers. The report sheet and Community's foot
carry the contact line: the contact form (About's "Contact us" links
`CONTACT_FORM_URL` today), opened through `contactFormUrl()` with a topic
for reports.

### 4c, Community

Behind `NATIVE_COMMUNITY`: the public results and melodies in the native
kit, your own profile (`ProfileView`'s figures, redrawn), and a shared
result opened from a link (`SharedRunResult`, `shared-run-link.ts`). There
is no public profile of another singer anywhere today, and this slice adds
none. The More row's line comes from what the screen last loaded, cached
like Leagues'. New shell icon: two people, in the house style.

`NATIVE_COMMUNITY` stays off in the store build until 4a is live on the
production worker and 4b ships with it.

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

## Open, for the owner

- **The Terms.** Play asks that terms define objectionable content and are
  accepted before posting, and App Review asks for "no tolerance". The Terms
  live on the landing site, outside this repository; whether they say so is
  unchecked.
- **The word list** for the name filter: which list, in which languages.

## Order

| PR  | What                                            | Switch             |
| --- | ----------------------------------------------- | ------------------ |
| 1   | This plan, and the More sheet as a list (#1267) | none               |
| 2   | Leagues, read-only (#1272)                      | `NATIVE_LEAGUES`   |
| 3   | The Legend as a room                            | `NATIVE_LEAGUES`   |
| 4a  | Reports, blocks, the name filter (worker)       | none (worker)      |
| 4b  | Report and Block on the phone, contact line     | none               |
| 4c  | Community                                       | `NATIVE_COMMUNITY` |

4a does not wait for 2 and 3: it can start beside them.
