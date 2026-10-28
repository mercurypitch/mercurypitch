# Developer Changelog

Detailed engineering history — PR numbers, plan documents, the reasoning and
the traps. Everything cut from the user-facing notes for length belongs here.

The short, user-facing summary rendered in the app's Changelog modal lives in
[`CHANGELOG.md`](./CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.24] - 2026-10-28

67 commits since `v0.9.23` (d37453987), from 10 PRs: #1234 (31 commits),
#1236 (12), #1242 (12), #1233 (4), #1238 (2, one of them #1239's), #1243 (2:
the coach bubble's fix and these notes), #1235 (1), the two earlier notes
PRs, #1237 and #1241 (1 each), and #1240 (1). All were rebased onto `main`
but #1240, which came in with a merge commit of its own. Every commit came
through a PR.

On the web:

- **Merc's Sing tour shows its note playing, and offers Show me more**
  (#1236).
  - Play the note, a hold-tone step, played A3 for 1.6 s and changed nothing
    on screen, so with the speaker muted nothing said it worked. While the
    note plays, the button reads "Playing A3" and is lit, a mark runs across
    it for the note's length (none under reduced motion), Merc takes his
    singing pose, and a polite line says it is playing. Once it has played, a
    line stays that says how to hear it: the volume, and the device's mute. A
    second tap plays it again from the start, and leaving the step, Skip and
    End tour stop it. Both labels stay in the button, one hidden, so it keeps
    one width. The note's player and its state are
    `src/components/coach/hold-tone.ts`.
  - The coach gains what Show me more needs (`src/lib/coach-types.ts`,
    `CoachLayer.tsx`, `start.ts`). A step can `run` something while it shows:
    it starts as the step shows and stops as the step goes, however it goes,
    while Merc takes its pose, its line is read in the bubble's live region
    and the ring pulses (not under reduced motion). A step can `keepCorner`:
    on a wide screen the bubble keeps the corner the step names, even with a
    ring up. A tour can offer another (`more`) beside Done on its last stop:
    the tap ends this tour done with no hand-over between, loads the other's
    steps and starts it in its place, with the same screen, the same hand-over
    at its end and the same focus to give back. A tab change meanwhile, or
    steps that do not arrive, start nothing and give focus back as before. The
    second Sing tour is tour 19, `'sing-more'` (`src/lib/tour-ids.ts`).
  - Show me more (`src/features/practice/sing-more-tour.ts`, `sing-demo.ts`
    and `sing-demo-host.ts`, one chunk loaded on the tap): Merc sings through
    the Sing tab, as the rooms' demos do. Repeat goes twice round, one note
    sung flat the first time and on it the second, with the ring on the wide
    bar's Repeat or the phone stage's play-mode button. Spaced rest goes once
    through with a half rest after each note, the rests silent, with the ring
    on the wide bar's Spaced rest; it is wide screens only, as the phone stage
    has no Spaced rest to ring or set. He sings the singer's own melody when a
    stop of it lasts 8 to 20 s, else do to sol in their key and octave, about
    a second a note in whole beats at their tempo.
  - The tab's transport plays the demo's melody (`singDemo()`), never the
    library's, which is not written. The practice controller's frame loop
    draws his scripted pitch at the transport's beat in place of the mic's,
    and leaves the mic, its detector, the frame listeners and the recorder
    alone. His voice (`playVoiceContour`, `src/lib/demo-voice.ts`) starts with
    each of the transport's notes on the app's audio context, from the same
    contour, so what is heard is what is drawn.
  - While he sings nothing is kept (`App.tsx` gates each on
    `singDemo() === null`): no note is scored, Stop ends no practice session
    and shows no result, his Play records no activity, the first-run mic offer
    is not spent, the mic hints say nothing, and no karaoke backing plays
    under him. The mic is never asked for; one already on stays on, its line
    paused. When the stop goes, however it goes, or the page is hidden, his
    voice releases, the transport resets as a tab change resets it, and the
    play mode, repeat cycles and round, Spaced rest and A-B loop are put back.
    The tempo is never changed. A wide screen's bubble keeps the top right
    corner, off his line; a phone's docks.
  - Zen is not a stop. Its stage runs its own session, which opens the mic and
    keeps every pass as a take, so it cannot take a scripted voice without a
    larger change.
  - Tests: `CoachLayer.test.tsx` (the playing state, its lines, Merc's pose,
    the restart and the stops), `CoachLayer.run.test.tsx` (a run's life, pose,
    line, pulse and corner, and where Show me more stands), `start.test.ts`
    (the hand-on, a failed load and a tab change during it),
    `sing-demo.test.ts`, `sing-demo-tab.test.ts` and `sing-more-tour.test.ts`.
    In the browser, `sing-show-more.spec.ts` at 390x844 and 1440x900: each
    stop rings and sets its control and draws his line, with no mic hint
    showing; Done, End tour and leaving the tab mid-song silence every source,
    clear the line, put the controls back and keep nothing; no `getUserMedia`
    from the tap on; reduced motion keeps the line and drops the pulse.
    `coach-tours.spec.ts` checks that Play the note shows it is playing.
- **The tour offer floats where it covers nothing** (#1236).
  - A tab's first-visit chip took a row at the top of the main column and
    pushed the page down as it showed. It floats now, from an anchor that
    takes no room: a row of no height in the main column
    (`src/features/tours/TourChipHost.tsx`, in a flex column with no gap) and,
    on Karaoke Night, an anchor out of the page's grid
    (`KaraokeTourChip.tsx`). Showing it and taking it down move nothing.
  - Where it stands is a rule, a pure function
    (`src/components/coach/chip-place.ts`), over what is on screen
    (`chip-room.ts`). Lines of text, controls, canvases and stages are never
    under it; pictures, drawings and cards only where nothing else is free. It
    takes the free room at the top of its column (its first 72 px), whole or
    as Merc and a short line, at the end of the first free row; then the
    nearest free spot further down; then Merc alone at the top; then the top
    bar between its title and its buttons, since a phone's Sing and Piano
    stages leave their column no room at all; then the same over art. It keeps
    clear of the foot stack and a phone's toasts (`src/lib/foot-space.ts`),
    and of layers from elsewhere in the document, found by hit-testing where
    it would go.
  - `chip-float.ts` measures the three forms and places the chip before it is
    drawn, places it again when the window or the column changes size, takes
    the best spot while the page settles in its first two seconds, then keeps
    a spot while it stays clear. A scroll that carries it out of view before
    it was seen, or while the page settles (Path glides to the singer's week
    as it opens), has it placed again where the page comes to rest.
  - The start button keeps the whole line as its name in every form, the short
    words being part of it, so a screen reader hears the same offer. The chip
    stays first in its column's order and takes no focus, and what
    `TourChipHost.test.tsx` pins still holds: one offer per tab, spent once
    seen, the pauses, one chip at a time, the lazy chunk.
  - Tests: `chip-place.test.ts` holds the rule, and `TourChip.float.test.tsx`
    the forms, the names and a kept spot on a page laid out by hand. In the
    browser, `tour-chip-floats.spec.ts` opens every tab with an offer due, and
    Karaoke Night, at 390x844, 1024x768 and 1440x900, and asserts that the
    chip covers no control, canvas, stage or visible text and that nothing
    moves as it goes. The Piano and Karaoke Night chip checks no longer expect
    a row of its own. With no row above it, Jam's room stage is 589 px of 800
    at 1280x800 again, over the 70% of the window the Guide's walk allows a
    spotlight, so the walk names it among its known wide ones
    (`scripts/walk-tours.mjs`).
- **The tour offer keeps off a control's invisible press** (#1238).
  - Under a finger, the phone header's mic draws 30 px and takes a press 44 px
    wide from a transparent `::after` (6d89f65a1) that reaches 6.6 px past its
    left; the menu and the wordmark take theirs the same way. On the Sing,
    Path, Piano, Guitar and Analysis tabs at 390x844 the offer is Merc alone in
    the top bar, and its end stood 4 px short of the mic's drawn box, so on the
    left 3 px of its press: a tap there started the tour instead of voice
    control, and the release's app-check sweep measured the mic's press at 41
    px. `tour-chip-floats.spec.ts` runs without touch, where the press boxes do
    not exist.
  - The room (`src/components/coach/chip-room.ts`) reads a control as far as
    it takes a press: its own box, plus the box of any `::before` or `::after`
    stood in its padding box that draws, takes presses and is only moved, not
    turned or scaled. Chromium reports such a part's used `left`, `top`,
    `width` and `height`, and its translate as a matrix, so the box lands where
    a hit-test finds the press; a layer from elsewhere in the document is read
    the same way. A part with `pointer-events: none`, and a control that
    positions nothing, count as before.
  - Tests: `TourChip.float.test.tsx`, a bar mic whose `::after` reaches 7 px
    past its left: the chip ends 4 px short of the press, at 209 px, where the
    old reader put it at 216 px. `header-touch-targets.spec.ts`, at 390x844
    under touch with the offer in the bar on the five tabs: the menu, the
    wordmark, the mic and the heart each take a 44 px press both ways, and
    every header control owns its box.
- **The coach's bubble keeps its buttons in view while its words scroll**
  (#1243).
  - At 320x568 the Sing tour's bubble docks at the top of the screen, capped
    at 45dvh, and it scrolled as a whole. Once Play the note added its line on
    how to hear the note, 302 px sat in a 254 px box: Back and Skip this step
    showed 8 of their 44 px and the count was hidden. Done showed 6 px at the
    last stop, and 14 and 34 px in Show me more's two rounds. Larger text did
    the same on any phone.
  - The bubble's grid gives the words a row of their own (`1fr auto`,
    `src/components/coach/CoachLayer.module.css`), which takes what the
    buttons leave under the cap and never less than Merc, and the words
    scroll in it instead of the bubble. While some are below the fold their
    foot fades (`data-more`, set from their scroll position in
    `CoachLayer.tsx`), each step starts them at the top, and from the bubble
    the arrow, Page, Home, End and Space keys scroll them. Their box takes
    `tabindex="-1"`, since Chromium makes a scroll box with no control in it
    a Tab stop, and hands a press on it back to the bubble. Only a row of
    buttons taller than the cap still scrolls the whole bubble.
  - Where everything fits, at 375x667, 390x844, 844x390, 1024x768 and
    1440x900, the bubble, its words and its buttons stand where they did at
    all 56 of the tours' moments, to 0.01 px.
  - Tests: `CoachLayer.words.test.tsx`, and a 320x568 touch case in
    `coach-tours.spec.ts` that fails under the old stylesheet: each named
    button, the count and End tour whole inside the bubble and on top at
    their middles, at the note stop after the note, the last stop and Show
    me more.
- **The lesson kit's buttons and step links, on the live Lessons 1 and 2 too**
  (#1236).
  - `.btn.is-on` swapped a primary button's light gradient for the dark lit
    ground and left its dark words, so a lit primary read 1.6:1: Lesson 2's
    "Play a step", and on the drafts the climb, lift, slide and unroll buttons
    while they sound and the ear game's Play on Lessons 6 and 8. A lit primary
    takes the light words every other lit button has (`.btn.primary.is-on` in
    `kit/lesson-base.css`). Lesson 7's `.range-toy .btn:not(.primary).is-on`
    keeps its amber pressed choices, and its lit Plays now read 10:1.
    `learn-lit-button.spec.ts` holds a lit primary to 4.5:1 or better on
    Lesson 2 and on Lesson 6's ear game.
  - A step link (`/learn/NN#step-N`) scrolled with `'auto'`, which takes the
    page's `scroll-behavior: smooth`, so it glided, and focus coming to a
    stage control mid-glide brought that control into view and stopped the
    glide short, with the deck on the linked step beside another step's text.
    The link's scroll, and every reduced-motion scroll, now goes at once
    (`'instant'`, `kit/step-deck.ts`). The deck's unit tests pin it: a
    headless browser does not stop the glide short, so
    `learn-step-link.spec.ts` passes either way.
  - The sound gate's button said "Turn sound on", then "Turn sound off", so it
    changed width as sound came on, and a gate line near a wrap rewrapped. Its
    two labels share one grid cell, as the gate's two lines do, the one not
    current hidden from a screen reader too (`kit/page-chrome.ts`,
    `kit/lesson-stage.css`), so the button keeps the wider label's width and
    the gate its height. Lesson 10's own `min-width` on the button goes.
    `learn-sound-gate.spec.ts` measures the button and the gate before and
    after the tap at 344, 390 and 1440 px on Lessons 1 to 10.
- **Merc's sung voice gets a module of its own** (#1236). `playVoiceContour`
  lived in `src/lib/demo-audio.ts` beside the short demo cues, which the Voice
  Mirror, its three range pages and Glass load with their first paint. Nothing
  in the web build had sung with it, so the bundler had left it out of their
  chunk; once Show me more sang with it, it rode their first paint, 2,714
  bytes of script each that never run there. It moves, unchanged, to
  `src/lib/demo-voice.ts`, on demo-audio's `sound`, now exported, and its
  importers (the room kit, the demo kit, Echo, Lip roll, the phrase voice and
  the Sing tab's demo) and their mocks take it from there. Lesson 2's FACTS,
  its brief, the Merc bible and the production pipeline name the new module.
- **First paint** (#1236), measured on `build:e2e` builds of `main`
  (4a488dc6f) and of the polish head: the main app's five documents gain 1,625
  bytes of script and lose 5 of CSS, and Guitar Night gains 15 bytes of
  script. Glass is 575 bytes lighter, the Voice Mirror and its three range
  pages 101, and Karaoke Night's four documents 12 bytes of CSS. Lessons 1 to
  10 gain 26 bytes of script each (67 on Lesson 7) and 105 to 354 of CSS.
  Every page stays under its ceiling, and no ceiling changes. #1238 moves none
  of it: the room it reads loads only with the offer's own chunk, on demand,
  and Lessons 1 to 10 weigh the same to the byte before and after it.

For the lessons, all drafts that mercurypitch.com holds back:

- **#1234:** Lesson 10's page, `/learn/10`, "Major and minor": the chord beads
  on the stage in each step's state, with 44 px targets at every width; the
  cold open on the hero's spiral and its predict; the recall from Lesson 6 and
  the quick check; the four words, each heard; Steps 1 to 5, with the ear
  games on thirds and on chords, the pattern and the names switch; Sing it,
  with the comfort check, the voice choice, Merc's notes, Move do, the guide
  and "How did that feel?"; and the Wrap, with free play and the next card's
  tease. It waits for Lesson 6's page to go live and for the vocal coach's
  look at Sing it (`kit/drafts.ts`). Three kit changes come with it: the
  spiral's `view: 'top'`, `easeOutExpo` among the canvas curves, and the
  guide's breath word kept on the canvas after a top-row note. Lessons 1 to 9
  gain 248 to 691 bytes of first-paint script, for Lesson 10's season entry
  and drafts line and the kit chunks it shares only in part; Lesson 4's
  ceiling goes from 129 to 130 KB, and Lesson 10's are a quarter over its
  measure (211 KB of script, 111 KB of CSS).
- **#1236:** Lesson 7's listening ring stops with the siren when the page is
  hidden or the Sound switch goes off mid-play, where it listened on to the
  end of a play that was over, and says Ready only for a Start an earlier play
  readied. A sing card's rows of buttons keep 12 px over a shown line, where
  they sat flush: on Lessons 6 and 8, the do readout under the plays while
  only listening, and a feeling's answer under the four feelings.
- **#1242:** Lesson 12's page, `/learn/12`, "Chords and the four-chord
  song", as far as Step 4: the page shell, with every word of the lesson; the
  ring of rooms on the steps' stage, the kit's spiral seen from above with the
  page's rooms painted over it, and its strip of seven chord chips, 44 px at
  every width; Step 1's seven chords a chip at a time, Step 2's key switch, C
  and G, Step 3's Play I, then vi with the names switch, Letters and
  Do-re-mi, and Step 4's loop and roots with Slow. Step 5, the cold open, the
  recall and the quick check, the four words and Sing it are not wired yet.
  It waits for Lesson 10's page to go live and for the vocal coach's look at
  the sung checkpoint (`kit/drafts.ts`). Two helpers move into the kit, the
  step parts (`kit/step-parts.ts`) and the play lights (`kit/play-lights.ts`),
  and `/learn/10` joins the next card's 44 px prerequisite-chip check.
  Lessons 1 to 10 gain 521 to 1,238 bytes of first-paint script, for Lesson
  12's season entry and drafts line and the kit chunks it shares; Lesson 3's
  ceiling goes from 131 to 132 KB, and Lesson 12's are the smallest whole KB
  above its measure (110 KB of script, 87 KB of CSS), to rise as each toy
  joins.

On the native app's test builds only (`PREMIUM_EXERCISES`, off on the web and
in the store build, which `assert-bundle.mjs` holds to carrying none of either
room):

- **#1233: Home note and First note, the first two Ear rooms.**
  - Home note: the band plays a short intro in a key and stops, and the singer
    sings the note the chords lean on, in any octave. The voice draws a trail
    against the lighthouse's beam and lands when it holds in the band of light
    around it; the band then plays home's chord under the voice, and after a
    miss Merc sings home over it. Learning plays I IV V I with Merc singing
    home first (50 cents), Singer I IV V (35 cents) and Professional IV V (25
    cents), in six keys in the singer's window. The best result per level is
    kept on the device (`mp_home_note_bests`).
  - First note: on the three example songs the app ships, the band plays the
    eight seconds before the singer comes in, the vocal muted and the last
    four beats counted down, and stops; the singer sings that first note, in
    any octave, and when the voice holds it the song carries on with its
    singer back in. After a miss Merc sings the note. The entry is judged
    before the note's line shows: at Learning the line shows from the start,
    at Singer once they have come in, at Professional only when they land. Its
    nineteen entries are read once from the stems
    (`apps/mercurypitch/scripts/generate-first-note-entries.mjs`) and pinned
    by each vocal's sha256. The best per level is kept on the device
    (`mp_first_note_bests`).
  - The voice trail and Merc's sung voice move into the room kit
    (`src/components/room-kit/voice-trail.ts`, `round-voice.ts`), and Echo's
    `merc-call` takes the kit's output-latency sum, with no change to what
    Home note or Echo does. `firstSteadyNote`
    (`src/lib/sequence/steady-note.ts`) takes its caller's run gap.
  - Both rooms open from a new Ear heading in the Sing room's picker and from
    a "With Merc" row on the native Ear Lab's bench.

Tests only:

- **#1235:** the DB worker's RevenueCat songs suite ended its subscription
  period at a fixed 2026-10-27T12:00Z, so from that moment the three tests
  that expect a subscriber failed on every branch. The period now ends fifteen
  days after the suite starts.
- **#1238, with #1239's commit:** the stage test in
  `dark-stage-surfaces.spec.ts` fetched the demo song's stems, 10.1 MB, from
  the public R2 bucket, and the lyrics panel it waits for shows only once they
  have loaded, so a slow download outlasted its 15 s wait: it went red on #1237
  and on #1238. It routes the stems to a 4 s local tone and the lyrics to one
  line, as `jam-control-bar.spec.ts` does. #1239 closed as landed with #1238.

Docs only:

- **#1233:** `docs/plans/premium.md` gets a Status line, as the native app now
  sells Mercury Pitch Cloud, which carries the premium Merc rooms.
  `docs/plans/ear-rooms.md` records the owner's answer on the Ear rooms' free
  taste (27 Oct: one run or three, then the paywall; the number, and whether
  the runs count per room or across the rooms, stay open). 64 plan citations
  are re-anchored.
- **#1236:** the lessons' plan citations of the kit, `App.tsx` and the coach
  are re-anchored past the new lines, and the module map is regenerated.
- **#1242:** the lessons' plan citations of the season and of the first-paint
  budget file are re-anchored past the new lines, the lesson tour's plan
  counts eleven pages, and the module map is regenerated.

Repository only:

- **#1240:** `.gitignore` takes `.playwright-mcp/`, the folder the Playwright
  MCP server writes its page snapshots to.

### Release steps

1. **Migrations:** none. Nothing under `workers/db-worker/migrations` changed
   since `v0.9.23`.
2. **Secrets, variables and bindings:** none new. No `wrangler*`, `.env*` or
   workflow file changed.
3. **Worker code:** the site worker's lesson gate reads the season and the
   drafts list, and #1234 gives Lesson 10 its page and its 17 minutes, and
   #1242 Lesson 12 its page and its 15 minutes, both as drafts. On
   mercurypitch.com the gate answers `/learn/10` and `/learn/12` with the 404
   page, and leaves them out of the sitemap and `llms.txt`, until the console
   publishes them, as it does every draft. The DB worker's only change is a
   comment in `mirror-metrics.ts`, which now counts 19 `createQuiz` sites, and
   the Jam worker's graph has none (each traced with esbuild from its
   `wrangler` `main`).
4. **Links into about.mercurypitch.com** (prod-upd step 0c): none new. The
   footers of Lessons 10 and 12 link the landing's Privacy, Terms and Imprint
   pages, as every lesson page does.
5. **Social cards:** `pnpm run og:versions` on this PR stamped the 13 cards it
   reads with no change. Lesson 12's card (`public/learn/lesson-12-og.jpg`,
   #1242) is outside that set, as every lesson's card is, and new, so no
   platform holds an older picture at its address.
6. **What's New** is untouched: 0.9.24 is a patch.
7. **Version files:** `package.json` goes from 0.9.23 to 0.9.24.
8. **Native:** `apps/mercurypitch/src/shell` gains the two Ear rooms' screens
   and their wiring, and `apps/mercurypitch/scripts` the First note entries'
   generator and the bundle assert's new checks (#1233). The native app is not
   released yet.

## [0.9.23] - 2026-10-27

151 commits since `v0.9.22` (a6f839e14) before this notes PR, from 23 PRs, on
148 first-parent entries, up to 3a2e2efe4. 3 PRs came in as merge commits, over
one commit each: #1215, #1220 and #1222. 20 were rebased onto `main`: #1203
(28 commits), #1229 (21), #1225 (17), #1213 (10), #1208 and #1223 (9 each),
#1206 and #1231 (7 each), #1205, #1207 and #1212 (6 each), #1228 (5), #1198
and #1224 (3 each), #1199 and #1226 (2 each), and #1214, #1221 (the release
commit), #1227 and #1230 (1 each). Every commit came through a PR.

On the web:

- **The weekly Check-up** (#1223; spec `docs/specs/weekly-check-up.ears.md`).
  - Home shows a card while the newest voiceprint is 7 days old or more,
    above the streak card and after the plan card. "Not this week" hides it
    for 7 days, the one value this stores, and leaves the focus in
    `#main-content`. Home's tour gains a step that drops out with the card.
  - The card's chunk loads after first paint, into a slot of the card's
    height. Container queries on the slot's width, per wording and with or
    without the account line, matched the card within 0.03 px at 22 widths
    from 320 to 1920 px.
  - `/mirror?checkup=1` is the same guided run with a "Weekly Check-up"
    eyebrow. After any guided run whose history spans 7 days, the results
    show Then and Now in place of the "since" line.
  - Then is the oldest take and the next within 7 days; Now is the newest
    and the one before it within 7 days. Each side keeps the best of its
    takes per metric, and an unclean range read counts for no range. A
    change is named at 2 semitones of span or 5 points of accuracy or
    steadiness, provisional until take-to-take noise is measured.
  - "Share then and now" draws a card with the Progress card's renderer: at
    most three facts, never a change under its threshold, the two dates and
    Merc, and no name. The share text carries the Mirror's tagged link.
  - Signed out, it works in this browser, says the readings are this
    browser's, and offers an account to keep every Check-up. No analytics
    event.
  - Onboarding's Keep row reads "Every weekly Check-up, kept". It said "Your
    voiceprint and range, saved", even after an unclean range read.
  - First paint: Home +1,446 B of JavaScript and +1,152 B of CSS; the Mirror
    and the three range pages that share its bundle +1,027 B, leaving
    6,497 B under 440,320. No ceiling moves.
  - Open with the owner: the words, the thresholds, a sign-up source for the
    Check-up, comparing a shared browser's takes, and the card's place.
- **Merc leads the tours** (#1203).
  - Show me around on the plan runs Merc's showcase (`Showcase.tsx`,
    `start-showcase.ts`, `showcase-stops.ts` in `src/features/tours/coach`):
    Merc stands by each group of the top bar, or on a phone by the rail's
    four tabs and then More, for 2.5 s or until a tap, then Start here opens
    with its room's tour. Nothing hops while the cookie banner waits, Skip
    is there from the start, each stop fades in place under reduced motion,
    and `showcase_done` and `showcase_skipped` are sent (both were already
    in the event catalog).
  - The coach: `src/lib/coach-events.ts` carries what the singer did
    (`mic-on`, `mic-failed`, `pitch-detected`, `song-staged`,
    `score-closed`, `song-unscored`, `stage-left`) as one `mp:coach` window
    event, so the app and Karaoke Night share only that file. A Merc tour is
    at most four steps (show, do, watch); a do-step listens from the moment
    it shows, Skip moves on, and Back to a step already done offers Next.
    The runner, `CoachLayer` and `TourChip` live in `src/components/coach`
    and load with the first tour; `coach-imports.test.ts` holds that the
    coach imports no feature. The tour events carry what the Guide's do.
  - The layer rings a step's target and lets taps through to it. A missing
    target, one under an inert page, or one taller than 70% of the window
    gets no ring, and the bubble stands in a corner. On a phone the bubble
    is a sheet above the foot stack. It sits at z-index 900: over stages and
    sheets, under modals, the toasts and the cookie banner. Keys in the
    bubble never reach the app's shortcuts, Tab reaches the ringed target,
    and focus goes back to the page, or to its main heading the singer can
    see, when a tour ends.
  - The chip: `TourChipHost` replaces `usePageTourOffer` (deleted) and its
    corner toast with a chip at the top of the main column: "Merc can show
    you around, 30 s" for a Merc tour, the toast's line for the Guide's. A
    tab's offer is spent once half the chip has been seen
    (IntersectionObserver), not when it is set (Path restores its scroll
    below the chip), and handed back when the tour's code does not load.
    The chip loads with the first offer: in the first paint it put
    `index.html` 777 B over its allowance. Piano's room gives way to it on a
    wide screen.
  - Sing's tour (`src/features/practice/sing-tour.ts`): Start the mic (it
    waits for the engine's `mic-on`, and says what to do when the mic is
    refused), Sing any note (with a 220 Hz note to copy), what the line is,
    and Hear Yourself for kept takes, with Lesson 1 linked. On a wide screen
    the docked Merc hides while a tour runs, and the bubble stands top
    right, clear of the live marker and the note labels. At the end
    `plan-handoff.ts` offers the plan's next stop ("Next on your plan", Go
    and Later) while Home's plan card would show the plan.
  - Karaoke Night's tour (`src/features/karaoke-night/karaoke-tour.ts`):
    the demo (Sing this song), the mic, a quiet wait through the song that
    draws nothing and ends on `score-closed`, `song-unscored` or
    `stage-left`, and Add a song with the plan card's credits line (now
    `src/components/billing/plan-credits.ts` and `src/lib/credit-facts.ts`).
    On a phone the last stop rings the stage's Back, then Add a song once
    the stage has gone. `/karaoke?tour=first`, an ad's landing, starts it
    once the consent bar is answered; a first visit to an empty stage gets
    the chip, "Sing the demo with Merc", under the top bar. The vocal
    remover's page gets neither.
  - One door for a room's tour, the owner's ruling: the chip, Show me
    around (`enterStop`), First Light and the Map's Take the tour all start
    a room's tour through `room-tour.ts`, reached from the plan and First
    Light through `src/lib/room-tour-door.ts`, which App opens. A tab with a
    Merc tour gets Merc's. Any other gets the app store's room tour, #1225's
    `hasRoomTour` and `startRoomTour` renamed `hasGuideRoomTour` and
    `startGuideRoomTour`. The native build lists no Merc tour, as before.
  - The Guide's walk (`scripts/walk-tours.mjs`) holds every step to
    `scripts/tour-rules.mjs`: a ringed target at most 70% of the window tall,
    and the consent bar on top. A step that breaks one prints WIDE or BAR and
    fails the walk as a MISS does, and Release Tours annotates both. The
    eleven Guide steps already taller, mostly whole pages, are named in
    `WIDE_TARGETS` and print `wide`. New e2e: `showcase.spec.ts`,
    `coach-tours.spec.ts` and `karaoke-tour.spec.ts`;
    `tour-selectors-exist.test.ts` reads the Merc tours' hooks, and
    `small-help-targets.spec.ts` measures a toast's buttons on the mic offer,
    since a tab's tour offer is a chip now. ESLint now parses
    `scripts/tour-rules.mjs`, `scripts/walk-tours.mjs`,
    `scripts/gen-pwa-screenshots.mjs` and the jam two-peer script.
  - Cross-feature imports go from 548 to 550: `showcase-stops.ts` reads the
    tab bar's order, rail and labels from `features/tabs/constants`. The
    rest go through `src/lib` and `src/components`.
  - First paint, measured on this tree against the release commit
    (`build:e2e`, static graph): the main app's documents +5,424 B of
    JavaScript and +72 B of CSS; Karaoke Night's documents and the vocal
    remover +1,910 B and +44 B; Guitar Night +547 B; the Mirror, the range
    pages and Glass +67 B, which leaves the Mirror's bundle 6,430 B under its
    440,320; Piano Night +22 B. Drum Night and the lessons are unchanged, and
    no ceiling moves.
  - Karaoke Night's chip, its first and last stops' lines and two of the
    showcase's are the owner's words. Merc's other lines are drafts for the
    copy pass.
- **Home's plan card comes back, and Settings keeps the plan** (#1231).
  - The card's X stores the date of the plan it hid
    (`mp.plan.card.dismissed.v1`, a JSON string where it was `true`).
    `hidesCard()` in `plan-card-rules.ts` hides that plan, and any later
    record that holds no answers (Not now again, on any device), so only new
    answers bring the card back; `savePlanAnswers` clears the hide. A device
    that stored `true` still hides every plan until it answers again. Home's
    slot, Merc's "Next on your plan" (`plan-handoff.ts`) and Settings read
    the one rule.
  - The X's toast, "Your plan is off Home. Settings and the Guide still
    have it.", offers Undo for 10 s on its own channel (`plan-card-hidden`).
    Undo puts the card back and focuses its X.
  - Change my answers ends the answered card: the plan layer's new `change`
    mode is a review opened on its questions, with the answers given picked.
    Not now goes back to the plan as it was; Done shows the new plan, and
    Home's card follows.
  - Settings, General, after App Mode: `PlanSettings.tsx`, "Your plan". See
    my plan and Change my answers with an answered plan, Show on Home while
    the card is hidden and would otherwise show, and Answer the four
    questions with none (it sends `plan_shown_skipper`, as the skipper
    card's Start does). `SettingsPage` hands it to `SettingsPanel` as a
    prop, so no component imports the plan, and it loads in its own chunk
    through `load-plan-settings.ts`. The native build leaves it out
    (`settings-plan-mount.test.ts`, and `assert-bundle.mjs`'s "the plan is
    not in the bundle").
  - No analytics event or property is added. New e2e:
    `plan-card-comes-back.spec.ts`, 14 cases at 390x844 with touch and at
    1440x900. Five lessons' FACTS files are re-anchored: the section moves
    `SettingsPanel.tsx`'s lines 15 down.
  - First paint (`build:e2e`, static graph) against #1203's head:
    `index.html`, Ear Lab, Jam, Jam's rooms and Pitch Training +868 B of
    JavaScript each, CSS unchanged. No ceiling moves.
  - Open with the owner: the words in `plan-copy.ts`; See my plan, then Not
    now, goes to Home as the Guide's row does, even from Settings; the
    Settings tour has no step for the section.
- **Arpeggio Jumper on its second scoring** (#1213).
  - The grade is the mean of the note scores. Before, it blended the note
    average with the best note (30 %) and a richness read on the wrong scale
    (25 %), so a flawless run could not pass 75 and the level never rose
    above 5.
  - Each note is scored on the frames voiced in its own window, read one
    measured microphone round trip later, with its first 15 % left out. The
    run is scored in the guide's octave or the one above or below, whichever
    gives the least total error, and each note keeps its own target there.
  - A run with no note voiced, or stopped before its end, is not recorded and
    does not move the level. The idle panel says why.
  - Version 1 runs leave the drill's threads, averages, level and weak list:
    the stats, the difficulty EMA and its play count, the weak list and the
    per-drill trends read `exerciseHistoryOnCurrentScoring()`. A Progress
    period that spans the rescore labels the older Skill Thread "(earlier
    scoring)".
  - The help and the menu card say what the grade is.
  - Leaderboard averages that include older Arpeggio Jumper runs mix the two
    scorings.
- **The dead richness term out of four grades** (#1213): Call-Response, Mirror
  Melody, Scale Runner and Drone Intonation added `approximateRichness` (25 %,
  25 %, 20 % and 20 %), which reads the detector's 0-1 clarity as 0-100 and
  so is always 0 or 1. No version bump: each grade moves by at most 0.25
  before rounding.
- **Copy that says what is true** (#1214).
  - Learn's "Common Musical Scales" chapter names Eb Major as C minor's
    relative major (it said A major) and gives minor's mood as a tendency.
  - Drone Intonation's idle line and help say every target is
    equal-tempered, the app's tuning, where they promised just or pure
    intonation.
- **Polish from the 0.9.22 sweep and the onboarding walk** (#1225).
  - Show me around (First Light, Home's plan card, the plan layer's
    `enterStop`) and the Map's Take the tour asked only for a page tour, and
    Singing has none, so a plan starting on Practice got no tour and the Map
    drew no tour link for it. `hasRoomTour` and `startRoomTour` give a room
    its page tour, or for Singing the Guide's 'practice' section under the
    'guide' key. `hasPageTour`, `PAGE_TOURS`, the sidebar and the tour offer
    are unchanged; both are off on the native build. #1203 puts them behind
    its room tour door as `hasGuideRoomTour` and `startGuideRoomTour`.
  - 44 px presses under a coarse pointer from transparent pseudo-elements:
    the phone header's menu (42x34), wordmark (20 px tall), mic (30x30) and
    heart (34x25); Karaoke Night's logo (22x22), App, Sign in and Hide
    panel. InfoPopover's "i" and the Jam page's "?" (20 px) and a toast's
    dismiss (22 px) take 24 px, and 44 px under a finger (WCAG 2.5.8).
  - The rooms that do not load `app.css` set the font family on their form
    controls: Karaoke Night's page, Piano Night's shell fields and the
    Mirror's privacy button. They had fallen back to Arial.
  - Piano Night's closed settings sheet waited inside the nav's band (moved
    down 102 % of its height from the nav's top), an invisible layer over
    the nav. Closed, it now waits wholly below the screen, and the nav
    stacks above it.
  - The Map's "And also" row (five doors with Lessons) wrapped four and one
    at 390 and 430 px. On a phone the label takes its own line and the doors
    wrap with `text-wrap: balance`.
  - Three labels cut beside room they could use: Drum Night's count-in,
    Guitar's song name (a 150 px cap) and Piano Night's line under the
    title.
- **Full presses on a phone, the rest of the sweep's list** (#1228).
  - 44 px presses under a coarse pointer, from transparent pseudo-elements,
    on Exercises' difficulty pills (36 px), "NEW" chip (30) and every card's
    Start (25); Settings' section tabs (34), and on Credits the Product Hunt
    badge (38) and Ko-fi (29); and Jam's Create Room and Join Room (38).
  - Jam's fields: an input has no pseudo-elements, so each field's label
    carries the box over its field, and a press on a label is a press on its
    field. The display name field takes 64 px and the room code field 62.
  - A toast's action ("Start tour") takes 24 px on a desktop, where it drew
    23.7, and 44 px under a finger, inside the toast and 8 px clear of the
    dismiss.
  - The pills' row and the tab strip scroll, and a scroller cuts off what
    reaches past it, so each grows padding for the boxes and gives it back
    in margin. The Exercises tour's spotlit frame keeps its 38 px; the tab
    strip's rule is drawn as a 1 px background where its border was.
  - Left as they are: Piano Night's keys, the two ellipses judged in #1225,
    and two inline links that cannot grow without covering a line of text.
  - First paint: the main app's documents +52 B of JavaScript and +1,775 B
    of CSS; Guitar Night, the karaoke documents and the vocal remover +257 B
    of CSS.
- **`/exercises/leap-ladder`** (#1198): Interval Trainer on Lesson 9's five
  leaps (`[3, 4, 7, 5, 12]`), through a new `intervals` field on exercise
  launches. Without a list Interval Trainer keeps its pool, shuffle and cap.
  Nothing in production links to it yet, as Lesson 9 is a draft.
- **Drone Intonation reads a launch's intervals, and
  `/exercises/thirds-on-a-drone`** (#1224). Of a launch's `intervals`, Drone
  keeps those its pool names and deals them with Interval Trainer's draw,
  now shared in `interval-rounds.ts`: the difficulty's round count, never
  one twice running. Its idle hint said "6 rounds" at every level; it now
  reads `plannedRounds` as `setBase` does and names a launch's intervals.
  The slug, Drone on `[3, 4]`, waits for Lesson 10's page to link it.

For the lessons, all drafts that mercurypitch.com holds back:

- **#1199:** the kit reads a sung ladder a rung at a time, for Lesson 9.
  `readingWords` gives a take's reading without its advice, which
  `readingLine` adds after it; no line changes.
- **#1207:** Lesson 7's stoppable sound runs and its microphone holder move
  into the kit. A sound run ends with its last-ending note, and the kit's
  sound runs play chords, for Lesson 10.
- **#1208:** the band chart paints rungs and Merc's arcs for Lesson 9, with a
  record of what it paints for Lessons 3 and 5. The e2e helper
  `writeStepsWav` makes stepped fake-microphone takes.
- **#1206:**
  - The spiral plays through a page's sound owner, and rests when nothing on
    it moves.
  - Move do keeps focus at its ends, with a reach for each side.
  - The names modes and their syllables move into the kit.
  - Lessons 1 and 2, which are live, pass no sound owner. Lesson 1's spiral
    rests when still, while its sky keeps drawing.
- **#1205:** Lesson 12's music: its chords, rooms, loop and tunes, spoken
  numerals, sounds, lines and quick check.
- **#1225:** phone layouts. Lesson 6's tune lines lay out their
  buttons again on a resize, on screen or off (the page had scrolled 873 px
  sideways after narrowing from 1280 px), and under 342 px its tune figures
  run to the window's edges so the canvas keeps its 308 px floor. The start
  sliders' buttons make room for the slider's note: under 360 px in Lesson 4
  and under 390 px in Lesson 6 they drop their words (still their names),
  and from 390 to 459 px Lesson 6's drop their arrows instead, where "Starts
  on D♭4" had run up to 21 px onto Start higher (measured at 18 widths from
  320 to 1024 px). Lesson 7's "Play 'Twinkle' on the column" wraps inside
  its card.
- **#1229:** Lesson 9's page, `/learn/09`, "Landing a leap": the cold
  open and its predict, the recall and quick check, the four words, Steps 1
  to 5 on the ladder chart, Sing it with a take read a rung at a time by the
  kit's ladder reader, and the Wrap with free play. Sing it waits for the
  vocal coach's sign-off. Two kit changes come with it: the band chart rests
  while its scene stands still, and the folds' vibration and stills move
  into the kit. Lessons 1 to 8 gain 180 to 874 bytes of first-paint script,
  for Lesson 9's season entry and the kit chunks it shares only in part, and
  Lesson 3's ceiling goes from 130 to 131 KB.

The karaoke track (#1215, #1220, #1222), kept out of `CHANGELOG.md` while
the native app is unreleased:

- **#1222:** collecting a separated song from the server completes only once
  both stems are saved on the device. With one missing, a "completed" song
  could not play once the server's copy expired; the collection now fails
  as a save failure and keeps the job id, so the native import queue
  collects it again without separating it again. `pollAndPersistServer` in
  `src/lib/uvr-processing-pipeline.ts` is the server path the web's vocal
  remover, Karaoke Night and the auto-resume use too, so there a server
  separation with a stem that did not save now reports the save failure.
  The on-device separation path is unchanged.
- **#1215:** the native Karaoke room lists the singer's own songs from the
  saved rows, so they stay listed after a restart, and opens their stems
  when a song is cued. A song whose stems are gone offers Download again
  while the server keeps them, Remove after that, and Try again when the
  read itself failed.
- **#1220:** the native karaoke probe expects the room's copy for a song too
  big to decode whole on a phone with no `AudioDecoder`.

Admin only:

- **#1212:** the console's Lessons page asks before it publishes a lesson
  ahead of one the lesson builds on or ahead of the lesson a recall asks,
  and before "Use default" puts a lesson live.

Tests only:

- **#1225:** the beat layout sweeps assert once (about 830,000 `expect`
  calls; 1.9 s to 70 ms), and `EchoDemo.test.tsx` reads each frame from one
  page walk (its slowest case 4.9 s to 1.1 s).
- **#1226:** Drum Night's and Guitar Night's tests import the rooms' lazy
  parts in `beforeAll`, before any case waits for one. Under load the first
  import had run past Testing Library's 1 s wait: Drum Night's sign-in
  dialog took 843 to 1,088 ms and now about 100 ms. Guitar Night's account
  chip is looked for in the room's top bar.
- **#1227:** the 320 px check in `learn-ways.spec.ts` measures Lesson 6's
  trail once the step's toy has finished sliding in. Mid-slide the page is
  up to 18 px wider than the window, and a slow runner measured 1 px.
- **#1230:** `small-help-targets.spec.ts` measures a toast's buttons once
  the toast has finished sliding in. For the first 105 ms of its 0.22 s
  slide it reaches past its stack, and a CI run read the stack as scrolling
  sideways.

### Release steps

1. **Migrations:** none. Nothing under `workers/db-worker/migrations`
   changed since `v0.9.22`.
2. **Secrets, variables and bindings:** none new. No `wrangler*` or `.env*`
   file changed. One workflow did: Release Tours' report annotates the
   walk's new WIDE and BAR lines as it does MISS lines (#1203).
3. **Worker code:** the site worker's lesson gate reads the season and the
   drafts list, and #1229 gives Lesson 9 its page and run time, as a draft.
   On mercurypitch.com the gate answers `/learn/09` with the 404 page, and
   leaves it out of the sitemap and `llms.txt`, until the console publishes
   it, as it does every draft. The DB worker's only change is a comment in
   `mirror-metrics.ts`, and the Jam worker's graph has none (each traced
   with esbuild from its `wrangler` `main`).
4. **Links into about.mercurypitch.com** (prod-upd step 0c): none added.
5. **Social cards:** `pnpm run og:versions` on this PR stamped the cards with
   no change.
6. **What's New** is untouched: 0.9.23 is a patch.
7. **Version files:** `package.json` goes from 0.9.22 to 0.9.23.
8. **Native:** only `apps/mercurypitch/scripts/`, the karaoke probes
   (#1215, #1220). The native app is not released yet.

## [0.9.22] - 2026-10-26

650 commits since `v0.9.21` (bd524160a) before this release PR, from 112 PRs,
on 562 first-parent entries, up to 238ef7115. 23 PRs came in as merge commits:
#1094 (1 commit), #1091 (1), #1095 (3), #1096 (1), #1097 (1), #1099 (1), #1098
(3), #1100 (2), #1101 (3), #1102 (3), #1103 (7), #1104 (1), #1110 (2), #1112
(4), #1113 (3), #1120 (12), #1123 (6), #1128 (1), #1130 (1), #1134 (8), #1166
(2), #1190 (21) and #1194 (1). 77 were rebased onto `main`: #1192 (72), #1048
(62), #1149 (34), #1177 (30), #1193 (21), #1188 (15), #1154 and #1186 (14
each), #1210 (12), #1151 (11), #1172 (10), #1111, #1170 and #1171 (9 each),
#1087, #1138, #1163, #1164, #1169 and #1201 (8 each), #1187 and #1217 (7
each), #1148, #1161, #1167, #1189, #1200 and #1216 (6 each), #1150, #1157,
#1162, #1165, #1191 and #1195 (5 each), #1116, #1158, #1168, #1185 and #1211
(4 each), #1141, #1159, #1173, #1196 and #1209 (3 each), #1108, #1109, #1129,
#1137, #1143, #1144, #1147, #1156 and #1160 (2 each), and #1105, #1107, #1114,
#1115, #1118, #1119, #1122, #1124, #1125, #1126, #1127, #1131, #1132, #1133,
#1136, #1139, #1140, #1142, #1145, #1146, #1152, #1153, #1155 and #1197 (1
each). 12 were squashed into one commit each: #1106 (af0f45eea), #1090
(024c8d828), #1092 (3f1f2f548), #1178 (f7c542aef), #1176 (f86e4ba7b), #1180
(38d94996d), #1184 (dfa820854), #1183 (e42381ffe), #1182 (9df503587), #1179
(f604b1a99), #1181 (0991d274c) and #1175 (921e3bbf1). Every commit came
through a PR: each first-parent entry's committer time matches one PR's merge
time.

On the web, the release is:

- **Find Your Pitch on mercurypitch.com.** Lesson 1, "What is a note?", and
  Lesson 2, "Twelve notes", at `/learn/01` and `/learn/02`, each with its film
  from `media.mercurypitch.com` (#1197), and the season's hub at `/learn/`
  (#1188). Every lesson page has the masthead's lesson menu (#1140), one
  next-lesson card on its Wrap (#1143), a welcome tour on a first visit
  (#1201), hosts named Merc and Tavi (#1191, #1195), plainer words (#1138),
  the release review's accessibility fixes (#1177), anonymous first answers
  from its quick check (#1193), and a trail back to the hub with links to the
  lessons either side (#1216).
- **Publishing at run time.** Every build carries Lessons 1 to 8, and the site
  worker decides per request which are live (#1150), from the state the admin
  console keeps on the DB worker (#1147, #1151, migration 0071). Lessons 3 to
  8 are drafts (`kit/drafts.ts`): held back on mercurypitch.com
  (`LESSON_DRAFTS` "0" in `wrangler.jsonc`'s `env.prod`), shown on the dev
  site, previews and local.
- **Onboarding and the plan.** First Light's four questions and the plan they
  make (#1190), Home's tour on the plan card (#1194), the plan's typed lines
  above a phone's keyboard and the email chip's dismiss (#1209), Space and M
  kept in surveys and confirms and the plan review's follow-ups (#1210), the
  tour, first-value and Map counts (#1134), the router race (#1196), and the
  plan's polish (#1217): Start here as the main button, an unclean range read
  no longer taken for a narrow one, Home's Lessons link and a Lessons door on
  the Map to the visitor's lesson, and a tablet's width.
- **Practice and karaoke.** The Guided Warmup without a grade (#1124), the
  range test's top cushioned (#1125), the hold cards (#1126), Bass-baritone
  (#1128), First Light's held note (#1110), the Siren's glide score and
  Dynamic Swell's copy (#1192), the Zen stage and tour focus (#1165), low tier
  overlays (#1158), the streamed vocal's pitch guide and the lyrics pick
  (#1189), and UVR's cancel and saves (#1178, #1184).
- **Search.** The studio's markup (#1105), `/karaoke-app` (#1106), the
  store-listing signals (#1107), lesson links and markup (#1109), sitemap
  dates (#1122), Bing's findings and IndexNow (#1116), the 404 scene (#1118),
  search-led lesson titles (#1187), and the lesson pages' and room pages'
  links to the lessons in their served HTML (#1216).

Reach was read from the code, not from a production build: no build was made
for these notes. Production as built, before anyone touches the admin console:
`/learn/01` and `/learn/02` are live with their films; `/learn/03` to
`/learn/08` answer the 404 page (status 404, `X-Robots-Tag: noindex`, not
stored); `/learn/` lists every Season 1 lesson, with Lessons 1 and 2 linked
and the rest "Coming"; `/sitemap.xml` and `/llms.txt` list `/learn/`,
`/learn/01` and `/learn/02`; Lessons 9 to 14 have no page in any environment.
The evidence: `src/lesson-gate.ts` (`isPublished` is the console's override,
else live unless the lesson is in `DRAFT_LESSONS` and the environment hides
drafts), `kit/drafts.ts` (3, 4, 5, 6, 7 and 8), `wrangler.jsonc`
(`LESSON_DRAFTS` "0" for prod), and migration 0071, which seeds no rows. The
state is cached 30 s per data centre, read with a 1.5 s timeout, kept
last-good in KV (`SHARE_STORE`), and with neither the site serves as built.

The rest is the native app: its own onboarding (#1098, #1101, #1103, #1110,
#1112, #1120, #1123), the Warm-up (#1096, #1099, #1100, #1102, #1104, #1113,
#1130), the iOS volume read (#1091), "One volume in rooms" off by default
(#1097), the TV work (#1157, #1175, #1179, #1182, and #1189's wizard and
Subscribe fixes), and two refactors (#1094, #1095). Glass (#1087, #1090,
#1092, #1167, #1180, #1183) is Beside Cue's game; the web compiles it only
into the unlisted `/glass-game`. The admin console's Lessons page (#1144,
#1151, #1211) is admin only.

### Release steps (prod)

1. **One migration, `0071_lesson_state.sql`** (#1147, ed6d134b3), the only new
   file under `workers/db-worker/migrations` since `v0.9.21`. It is additive.
   It creates `lesson_state`, one row per lesson (0 to 99): `published` (1, 0,
   or NULL for the code's default), `hook` and `tease` (a variant id, or
   NULL), `updated_at` and `updated_by`. It creates `lesson_state_log`, one
   row per changed field (old and new value, when, by whom), and the index
   `idx_lesson_state_log_lesson`. It seeds no rows, so production starts on
   every lesson's default. The tag's `deploy-db-prod` job ("Prod Jam + DB
   migrations + worker" in `build.yml`, through `deploy-db.yml` with
   environment `prod`) checks the seller details, backs up the prod database,
   reconciles the schema, runs
   `wrangler d1 migrations apply mercurypitch-db --remote --env prod`, then
   deploys the worker. Dev has had it since Deploy DB Worker run 39440215676
   (#1147), green.
2. **New bindings and a variable, no new secret.** Three `wrangler*` files
   changed. `wrangler.jsonc` (#1150): `run_worker_first` gains `/learn/*`,
   `/sitemap.xml` and `/llms.txt`, and a variable `LESSON_DRAFTS`, "0" under
   `env.prod` and "1" at the top level and under `env.dev` and `env.preview`.
   `workers/db-worker/wrangler.jsonc` (#1193): a Cloudflare rate-limit
   binding, `LESSON_EVENT_LIMIT`, 300 per address per 60 s, with a
   `namespace_id` per environment (4101 local, 4102 dev, 4103 prod); a worker
   without it refuses every lesson answer.
   `workers/db-worker/wrangler.pr-preview.template.jsonc` (#1193): the same
   binding, namespace 4104. The `env.*` names read in `workers/`,
   `src/worker.ts` and the gate it calls go from 70 to 73: `LESSON_DRAFTS`,
   `LESSON_EVENT_LIMIT` and `SHARE_STORE`. `SHARE_STORE` is the existing prod
   KV binding that `src/og-card-handler.ts` already read; the gate now also
   keeps the last good lesson state there (`lesson-state:last-good:<api>`).
   `build.yml`'s new Notify IndexNow step (#1116) reads no secret. Two
   committed env files changed: `.env.development` (+10, -0) and
   `.env.production` (+11, -0), in 3774c5668 (#1111) and 07ce2ed75 (#1150).
   Their contents were not opened for these notes.
3. **Worker code.**
   - **Site worker** (`src/worker.ts`, deployed by the tag's
     `build-and-deploy` job): the lesson gate (#1150: `src/lesson-gate.ts`,
     `src/lesson-listings.ts`, `src/lib/lesson-state.ts` and the kit's
     `drafts.ts`, `films.ts`, `lesson-copy.ts`, `publish.ts` and `season.ts`),
     which #1188 extends to the hub; and #1178's UVR cancel
     (`src/lib/runpod-bridge.ts`, `src/lib/runpod.ts`): a cancel the server
     refuses now throws, and the refund after a refused debit still runs.
   - **DB worker** (`deploy-db-prod`): the lesson-state routes (#1147:
     `GET /api/lessons/state`, and the admin routes under
     `/api/admin/lessons/`); `lesson_answer` on `/api/mirror/event`,
     rate-limited by `LESSON_EVENT_LIMIT` and kept with no address or time of
     day (#1193); the funnel catalog's new names (#1134's tours, first values
     and Map rooms; #1190's plan and skip questions; #1193's `lesson_answer`)
     and `mirror-metrics.ts`'s allowlists for their numbers; and the shared
     files #1098, #1120, #1123 and #1128 changed (`native-build.ts`,
     `legend-catalog.ts`, `signup-hint.ts`, `auth.ts`). Dev has run all of it
     since Deploy DB Worker run 40059234793 (bb9d432d1, #1193), green; no file
     in the DB worker's import graph changed after that commit.
   - **Jam worker:** no change.
   - **Order.** `deploy-db-prod` and `build-and-deploy` do not wait for each
     other. If the site lands first, the gate's state read fails and the site
     serves as built (Lessons 1 and 2), and the old DB worker answers the new
     funnel names and `lesson_answer` with a 400 until it is replaced (#1134
     and #1190 ask for the worker with or before the site). A few minutes of
     lost counts, nothing else.
4. **Links into about.mercurypitch.com** (prod-upd step 0c). New in the range:
   the footers of `learn/01.html` to `learn/08.html` and `learn/index.html`
   link `https://about.mercurypitch.com/privacy/`, `/terms/` and `/imprint/`
   (for example `learn/01.html:1620-1622` and `learn/index.html:310-312`).
   These are the paths the app already links; no new path and no query
   parameter. `src/seo/entry-pages.ts` gained only a comment. The landing is
   another repository (disjoint-colliders), which this check could not read,
   so its tags are not listed here; the `mp-v*` tags in this repository are
   the native app's (`mp-v0.8.38` to `mp-v0.8.42` in the range). The owner
   says the landing already carries the new privacy notice. It should cover
   #1190's survey answers and typed lines on the account, and #1193's lesson
   answers with what Cloudflare keeps (request logs with address and time for
   up to 7 days, D1 point-in-time recovery up to 30).
5. **Social cards.** `pnpm run og:versions` ran on this PR: 13 cards stamped,
   no change. The lesson cards (`public/learn/lesson-NN-og.jpg`) are outside
   it (Found while preparing this release).
6. **What's New** is untouched: 0.9.22 is a patch.
7. **Version files.** `package.json` goes from 0.9.21 to 0.9.22, the only file
   besides the two changelogs that the 0.9.21 release commit changed.
   `apps/mercurypitch/package.json` and `apps/beside-cue/package.json` stay at
   0.1.0; the native apps take their version names from their own tags
   (`capacitor-app.yml`, "Resolve release version").
8. **The lessons' release day** (`docs/plans/find-your-pitch/SEARCH.md` § 3.2
   and § 12 step 6, HANDOFF § 2 item 3). In this PR, with the tag day:
   - `learn/01.html`: `"datePublished": "2026-10-26",` in the Article block,
     after line 90 (`"isAccessibleForFree": true,`) and before
     `"position": 1,`. Neither page had one before.
   - `learn/02.html`: the same, before `"position": 2,`.
   - `public/sitemap.xml`: `<lastmod>` on line 97 (`/learn/`), line 101
     (`/learn/01`) and line 105 (`/learn/02`), each moved from 2026-10-20 to
     2026-10-26.
   - The hub takes no `datePublished` (§ 3.2 asks it of a lesson), only its
     sitemap date.
   - No lesson page and not the hub carries a `VideoObject` (§ 3.2: it belongs
     on the watch page). The head comment on lines 61 to 68 of `learn/01.html`
     and `learn/02.html`, which said "no VideoObject until the episode plays
     here", now says so (Found while preparing this release).
   - Lessons 3 to 8 take their dates when the console publishes them (HANDOFF
     § 2 item 8).
9. **The films' host.** Lessons 1 and 2 play from
   `https://media.mercurypitch.com/learn/0N/v1/lesson-0N-1080p.mp4` and
   `-720p.mp4` (`kit/films.ts`), and `public/_headers` adds the host to
   `media-src`. #1197 asked for
   `curl -I https://media.mercurypitch.com/learn/01/v1/lesson-01-720p.mp4` to
   answer 200 before it merged; HANDOFF § 2 item 1 records both pairs on R2 on
   24 October. Not requested from here: dev loads the same files, and the
   owner's test pass plays them.
10. **Walk the tours on `main`** (Release Tours,
    `gh workflow run release-tours.yml --ref main`, prod-upd step 4). The
    baseline is 0 misses. New steps in the range: Home's plan card (#1194),
    which shows only while the card is drawn. The lesson tour (#1201) is the
    lesson pages' own.
11. **Push the tag `v0.9.22`.**
12. **After the tag.**
    - The owner checks production as built (above): `/learn/01` and
      `/learn/02` play, `/learn/03` answers 404, `/learn/` lists two links,
      and `/admin/lessons` loads for an admin.
    - Notify IndexNow runs by itself against `v0.9.21`. The key file is new
      since then, so it sends every listed URL; if the run warns, send them by
      hand from a checkout of `v0.9.22`: `pnpm indexnow --since v0.9.21`.
    - Request indexing for `/learn/`, `/learn/01` and `/learn/02` in Search
      Console, and publish each episode on YouTube with the lesson's link
      first (HANDOFF § 2 item 6).

### Found while preparing this release

None of these is in a PR's notes unless it says so, and none blocks the tag on
its own.

- **The lesson pages' head comment invited a VideoObject.** `learn/01.html`
  and `learn/02.html` lines 61 to 68 said "No datePublished until the release
  that puts the lesson on mercurypitch.com; no VideoObject until the episode
  plays here". Both films now play, and SEARCH.md § 3.2 says no `VideoObject`
  on a lesson page, so the release PR rewrote the comment as `datePublished`
  went in.
- **Sitemap dates.** `/learn/` was created on 23 October (#1188) and is dated
  2026-10-20, and `/learn/01` and `/learn/02` changed after that date. Step 8
  moves all three to the tag day.
- **The tag deploys the site and the DB worker in parallel** (step 3). Safe
  for the gate, which falls back to the site as built; the first minutes' new
  funnel events and lesson answers get a 400.
- **#1210 merged with its body asking for a dev test first** ("Not for merging
  until you have"). It merged on the owner's go; its four checks are in the
  release test.
- **The feedback form writes "Mercury Pitch" as two words** ("Tell us what
  would make Mercury Pitch better. No account needed.",
  `src/components/UserSurveyModal.tsx:133`). 0.9.21 made the mails say
  MercuryPitch as one word. The wording is the owner's open call anyway.
- **First-paint budgets on a production build** (#1144's note): a production
  `dist` went over them for `mirror.html` and `vocal-range-test.html` (442 KB
  of JavaScript against 430, 41 KB of CSS against 40); the check runs on
  `build:e2e` only, where both pass. Not rechecked here.
- **The lesson share cards are outside `og:versions`** (still true from
  #1135): `scripts/gen-og-versions.mjs` stamps `public/*-og.png` and
  `glass/og.*`, not `public/learn/lesson-NN-og.jpg`, and the lesson pages' and
  hub's `og:image` URLs carry no `?v=`.
- **"To your highest" without "comfortable"** is still the voice type test's
  description (`src/seo/entry-pages.ts:584`), as #1135 found.
- **Home's Lessons link opened `/learn/01` for everyone** (#1177's W-01, its
  open half). #1217 makes it the visitor's current lesson, and the hub once
  both released lessons are done.
- **#1200's freeze fix is unverified on Windows**, where the freeze was seen;
  its PR lists the check. The CHANGELOG says only what the code does (the 10 s
  give-up).
- **#1134 loads the shared funnel on Guitar Night's first paint** (a device
  id, the first-party event, GA4 under Consent Mode), and on Piano Night once
  a pass keeps notes. Its PR asks the consent review to cover both.

### Web: the lesson pages

- **#1048, Lesson 1 at `/learn/01`** (62 commits, 46 only docs).
  `learn/01.html` is its own document, every word in the markup;
  `lesson-01/main.ts` adds the sound, five figure toys, the two Mercs, the
  quiz, the episode player and the Season 1 explorer, on parts that start
  `src/features/lessons/kit/`. Served by the asset layer (through the site
  worker's gate since #1150), with `STANDALONE_DOCUMENT_PATHS` keeping the
  service worker off it; no CDN and no Google Fonts; live Mercs only on a real
  GPU (`kit/merc-duo.ts`). Home gains its Lessons link. The first-paint check
  now walks every folder of `dist`.
- **#1111, the shared kit and Lesson 2 at `/learn/02`** (9 commits). Lesson
  1's code moved into the kit, every toy mounting on its own root; Lesson 2,
  "Twelve notes", carries its LESSON.md on the spiral, the keyboard, the
  tiles, the semitone ruler, an ear game, three predicts, Sing it and the
  quick check. It also brought Lesson 3 as a draft and the draft switch
  (below).
- **#1133, lesson cards speak to learners** (1 commit). The explorer's cards
  stop printing planning fields; one state function, `kit/lesson-state.ts`,
  gives every list "Start lesson", "Continue: step N" or "Read again", with
  the furthest step kept in `fyp-pos`.
- **#1131, the Series blueprint leaves Lesson 1** (1 commit). The "For the
  team" section moves unchanged to
  `src/features/admin/lessons/blueprint-data.ts`.
- **#1119, a lesson's `?lesson=` marker opens its room** (1 commit).
  `src/lib/lesson-marker.ts` reads `lesson=01` to `14` from the query string,
  and `stepAsideForLesson` ends First Light for good on that visit, as the ×
  does. Web only (`src/index.tsx`).
- **#1136, Watch shows only a film that can play** (1 commit). A lesson's film
  state follows its sources, so no card, masthead link or player promises a
  film that is not there; "Film coming soon" goes.
- **#1137, the step stage fits a landscape tablet** (2 commits). The figure
  shrinks to the room the window leaves, so the sliders under it stay in reach
  at 1024x640 and on a phone held sideways.
- **#1138, Lessons 1 to 7 say it plainly** (8 commits). A sentence-by-sentence
  plain-language pass, one commit per lesson and one for the kit's shared
  lines; the first-visit line about the intro's × goes.
- **#1139, legal links and addresses on a phone** (1 commit). The footer's
  legal links sit in the gutter, and a long address wraps after its slash.
- **#1140, the season in the masthead and a lesson menu** (1 commit). The
  masthead's "Lesson 0N" opens a menu (a sheet on a phone) with every lesson
  in the season, this lesson's steps and the reader's progress.
- **#1142, the lesson menu's short lines wrap evenly on a phone** (1 commit).
- **#1143, one next-lesson card on every Wrap** (2 commits), drawn from
  `season.ts` and the reader's place, in the explorer's and the menu's words
  ("Start lesson", "Continue: step N", "Read again", "Coming later").
- **#1145, a lesson tapped in the explorer brings its card's button into
  view** (1 commit), with one Tab stop for the list and a live region.
- **#1148, switchable hooks and teases, the cold open first, a season-end
  card** (6 commits). Every wording lives in `kit/lesson-copy.ts`, which the
  console and the site worker pick from.
- **#1160, two kit fixes** (2 commits): a predict's hint waits for a heard
  play, and a black-key note fits one line in every ring. Every lesson page.
- **#1177, the release review's fixes** (30 commits). On every lesson page:
  one status line for what a screen reader must hear, focus kept when the
  explorer card rebuilds, the spiral's Turn left and Turn right, the quiz's
  "Your answer" and "Right answer" tags, "MercuryPitch home" in every footer,
  "Animations" for the motion switch and a skip link that lands. In the app:
  Learn moves from Home to the sidebar beside Guide and Tour, Home's pills and
  those three are 44 px on touch screens, and the Ear Lab's tap rule
  (`src/lib/ear/tap-rule.ts`) takes clicks from screen readers, switches and
  voice control. `docs/plans/find-your-pitch/RELEASE-REVIEW.md` is the
  checklist.
- **#1186, the owner's decisions of 22 and 23 October** (14 commits): five
  hook alternatives go (Lessons 9 to 14), the season gains the edge from
  Lesson 1 to Lesson 8 (Lesson 8's chip reads "After Lesson 1: What is a
  note?"), Lesson 6's recall opens `/learn/04#step-1`, and Lesson 5 gains a
  neutral hook, `steady`, in the console while its default stays live (the
  owner's open choice).
- **#1187, search-led titles** (7 commits), such as "What is a note? Pitch,
  hertz and the octave | MercuryPitch"; the series name moves to the kicker,
  the breadcrumb, the share titles and the structured data.
- **#1188, the season's hub at `/learn/`** (15 commits): who the series is
  for, how a lesson works ("Every lesson asks you to sing along.") and Season
  1 lane by lane. `learn/index.html` is built from `season.ts`
  (`tools/learn-hub.ts`), the site worker unlinks lessons that are not live,
  every lesson names it as its series and the lesson menu links it ("All
  lessons").
- **#1191, the hosts by name** (5 commits): blue Merc is Merc and orange Merc
  is Tavi, on the pages, in the kit and in the living docs.
- **#1192, the handoff's follow-ups** (72 commits). Real run times (Lesson 1 8
  minutes, Lesson 2 13); the sound gate keeps its height; a take opened in a
  hidden tab lets the microphone go; the frame loop rests when nothing moves;
  Lesson 2's step 5 explains its lock; Lesson 7 keeps its card after "Done for
  today". In the app: the Siren's glide part scores each round's own glide
  (`src/lib/glide-coverage.ts`) under a new scoring version, so its Best,
  grade and play count restart and the high-notes and range challenges start
  new attempt threads; Dynamic Swell's card, help, idle screen and two daily
  routines promise only what is measured. Tools: `pnpm plan:cites` and
  `pnpm lesson:words`.
- **#1195, Lesson 7's answer locks after Done for today, and the captions name
  Merc and Tavi** (5 commits): `MERC:` and `TAVI:` in both films' captions.
- **#1197, Lessons 1 and 2 play their films** (1 commit): `kit/films.ts` gives
  both their `v1` sources on `media.mercurypitch.com` (5:35 and 7:19), and
  `public/_headers` adds the host to `media-src`.
- **#1200, Merc's shader compile no longer waits on the page** (6 commits). It
  enables `KHR_parallel_shader_compile` and polls instead of reading status,
  keeps the march a loop for Direct3D (`uZero`), draws Tavi with Merc's own
  shader text, and keeps the stills after 10 s on screen
  (`LIVE_MERC_WAIT_MS`). Lesson pages and the web onboarding; the native
  welcome's Merc starts on his first frame. Pixels unchanged in 672 shots; not
  checked on Windows.
- **#1201, a welcome tour on a first visit to a lesson page** (8 commits):
  five steps, Back, Next, Skip tour and ×, replayed from the "?" or "Tour this
  page"; it waits for Merc and Tavi on Lessons 1 and 2 and says the microphone
  line only where a page listens.
- **#1193, each question's first answer in a visit, anonymously** (21
  commits). `kit/telemetry.ts` sends one `lesson_answer` per quick-check or
  recall question's first answer to `/api/mirror/event`: the shared client id
  `lesson-anonymous`, the page, the question, right or wrong, its number of
  options, the visit (capped at 3) and the consent state. Nothing after a
  decline, nor in the EEA, the UK or Switzerland without a yes (by clock, and
  the worker checks the address); predicts, ear games and sung or tapped
  checks send nothing; only a page the site worker served sends. The worker
  keeps the UTC day and the seven numbers, no address, time of day or device
  id, under a random row id.
- **#1216, lesson pages link the hub and the lessons either side** (6
  commits). A trail under the masthead,
  `MercuryPitch > Find Your Pitch > the lesson`, in a `nav` named
  "Breadcrumb", written at build time from each page's own BreadcrumbList by
  `tools/lesson-ways.ts`. Each page's foot links the lessons before and after
  (`rel="prev"`, `rel="next"`), and a draft's link is taken out per request by
  the site worker and the page's own reading, as every other link to a lesson
  that is not live. The room documents link the released lessons that practise
  in them (`lessonsPractised` in `src/seo/entry-pages.ts`, SEARCH.md § 8):
  `/mirror` and `/vocal-range-test` Lesson 1, `/ear-lab` Lesson 2. The tour's
  "?" ends the masthead's row at every width instead of hanging over the page
  under 1181 px; the logo gives way to it under 561 px and from 821 to 1020
  px, the wordmark from 1021 to 1180 px, and the trail links MercuryPitch at
  every width.

### Web: publishing lessons at run time

- **#1150, the site worker gates the lessons** (5 commits). Every build
  carries every lesson page; `src/lesson-gate.ts` answers `/learn/NN` from the
  console's state, rewrites a live page's hook and its links to lessons that
  are not live, and edits `/sitemap.xml` and `/llms.txt` to match. The
  release-steps entries and the production state above are its.
- **#1156, Lesson 4 goes back to being a draft** (2 commits), so the first
  release launches Lessons 1 and 2 only and no entry page links a lesson that
  answers 404.
- **#1159, Lessons 3 and 5's heads, and every document's head tested** (3
  commits): a draft goes live with the head it was built with, so the head
  checks now cover drafts too.
- **#1170, team notes leave the lesson pages** (9 commits): the signatures and
  variant notes move to `kit/team-notes.ts`, which only the admin console
  imports.

### Web, drafts: live on dev, held back on mercurypitch.com

- **#1111 and #1129, Lessons 3 and 5.** Lesson 3, "Match a note", the first
  page that listens (a take holds the microphone only while open, nothing
  recorded or sent), and Lesson 5, "Breath and a steady note". The build-time
  switch they came with (`VITE_DRAFT_LESSONS`) now only sets the default of a
  page no worker served (#1150).
- **#1127, Lesson 4, "The major scale and home"**, built as released on 20
  October and held back again by #1156.
- **#1149, Lesson 6, "Intervals: the distance between notes"** (34 commits).
  **#1169, Lesson 7, "Slides, sirens and your range"** (8). **#1172, Lesson 8,
  "Beat, tempo and the backbeat"** (10), which also moves the Ear Lab's tap
  rule to `src/lib/ear/tap-rule.ts` and Drum Night's latency estimator to
  `src/lib/timing/input-latency.ts`, unchanged.
- **#1152** (1 commit), Lesson 4's stairs toy stops its queued summary;
  **#1153** (1), Lesson 5's voice line; **#1168** (4), Lessons 3 and 5's
  openings no longer give their predicts away.
- **#1155** (1 commit), Lesson 9's practise link opens Arpeggio Jumper;
  **#1163** and **#1164** (8 each, mostly docs) change Lesson 11's and 14's
  hooks and the S12 topic's name in `season.ts`. These print on every lesson
  page's explorer cards, for lessons that have no page.

### Web: onboarding, the plan and the app

- **#1190, four questions after First Light and the plan they make** (merge
  commit, 21 commits). The instrument, the goal, what gets in the way and what
  was tried, each skippable; a plan of up to three stops (Start here, Learn,
  Play); the plan layer from Guide and `#/plan`, met once by existing users;
  "Your plan" on Home for a week; "Back to your plan" on every lesson page;
  skipping asks first ("Keep going", "Yes, skip"); one takeover per visit; the
  GH #97 survey down to one question; signed-in answers saved to the account
  as one survey row. New funnel names for the plan and the skip questions. Its
  body asks for the privacy policy's purpose list and a consent legal review
  before the tag.
- **#1194, Home's tour opens on the plan card while it is there** (merge
  commit, 1 commit).
- **#1209, the plan's typed lines above a phone's keyboard, and the email
  chip's dismiss in its corner** (3 commits): the studio strip and Karaoke
  Night's pill, with a 44 px tap area.
- **#1210, Space and M stay in the surveys and confirms, and the plan review's
  follow-ups** (12 commits): a focus trap takes a fallen focus back,
  `ConfirmDialog` gains `variant="stay"`, today's session from First Light or
  the plan lands on Home with its first button focused, a plan answered on
  another device is shown rather than asked again, the feedback form says "No
  account needed." instead of "anonymous", and Escape no longer throws away
  typed feedback (cddefd571).
- **#1134, tours, first values and Map picks measured** (merge commit, 8
  commits): `tour_offer`, `tour_start`, `tour_done` and `tour_exit` with
  permanent tour ids (`src/lib/tour-ids.ts`), `first_value_<room>` once per
  device, and `onboarding_map_room_<room>`. Web only; the DB worker's
  allowlist keeps the tour numbers alone.
- **#1196, the address sync waits for a move's hashchange** (3 commits): a
  `#/map` link followed as the app started could be overwritten by `#/home`.
- **#1217, the plan's polish** (7 commits). A range read that is not clean
  (a steady tone reads 0 semitones) counts as not measured: one rule,
  `isCleanRange` beside `singerForRange`, read by `pickFirstStop`, Keep, the
  twin's stat card, the voiceprint share and the twin, so the plan no longer
  sends it to the range stop. The main button is Start here and opens the
  first stop as its card does; Show me around stays beside it, with the
  room's page tour where it has one.
  With a voiceprint, Start here keeps "Every take lands in Progress" where the
  stop's runs land there (Exercises, the Ascent; not Karaoke Night). Home's
  Lessons link opens the first released lesson this browser has not marked
  done, or the hub (`src/lib/current-lesson.ts`; the done list's key and parse
  move to `src/lib/lesson-done.ts`). The Map gains a Lessons door
  (`onboarding_map_door_lessons`) and a section naming the current lesson,
  both web only. A lesson's cover shows whole on the plan's cards, and the
  plan's column is 640 px from 600 px wide.

### Web: karaoke, the studio and UVR

- **#1158, low tier overlays stay transparent** (4 commits): on the low
  performance tier the mixer's tour, Zen's song rows and the Learn scrim no
  longer lose what is behind them, and the mixer's tour shows the stem sidebar
  for its first step.
- **#1165, accessibility audit** (5 commits):
  `docs/accessibility-audit-2026-10.md`, axe-core as a dev dependency with a
  baseline spec, and three fixes: the Zen and phone stage is a named dialog
  that holds the focus, the score card shows above the Zen stage, and the
  spotlight tour is a dialog where Enter moves on.
- **#1189, the 0.8.41 device test's fixes** (6 commits). On the web: a
  streamed vocal now finds its notes, so a separated song gets the pitch guide
  and Find my key on a phone (`streamStems` is any mobile device class,
  `useStemMixerAudioController.ts`), and a failed LRCLIB pick keeps the list
  and says why. The refused-song card, the Subscribe wait and the TV latency
  wizard are native.
- **#1178, UVR cancel and session recovery** (squashed): the client keeps a
  session it could not confirm cancelled, and the worker side is in step 3.
  **#1184, UVR session saves keep their order** (squashed). No visible change
  when nothing fails.

### Web: search

- **#1105** (1 commit), one studio and the site's name in the markup.
  **#1106** (squashed), `/karaoke-app` and FAQs for Jam Rooms and key changes.
  **#1107** (1), the store listings drive the native app signals, which render
  nothing until a listing is live. **#1109** (2), every released lesson linked
  from the entry pages and marked up (Article, BreadcrumbList; no
  VideoObject). **#1122** (1), sitemap dates that say when a page changed.
  **#1116** (4), Piano Night's h1, image alt text, and IndexNow with its
  release step. **#1118** (1), the 404 page's error scene ("Off the stave").

### Web: practice

- **#1124**, the Guided Warmup ends with no grade, score or level (1 commit).
  **#1125**, the range test cushions the top and drops its verdicts (1).
  **#1126**, the hold cards stop asking for the longest hold (1). **#1128**, a
  range that ties Bass and Baritone reads Bass-baritone, in the Voice Mirror,
  on the cards and in the welcome mail (merge commit, 1). **#1110**, First
  Light names a note the voice held, the lower of the two middle values (merge
  commit, 2; its Back fix is native).

### Web, unlisted: Glassworks

- **#1087** (8 commits), Cloudway Studio and traversal checks; **#1090**
  (squashed), the Unbroken Archive and the Hush escape; **#1092** (squashed),
  museum art and the Sun seal (Git LFS art); **#1167** (6), Cloudway recipes
  kept and Pearl courts continuous; **#1180** (squashed), gallery textures on
  phones and loading diagnostics; **#1183** (squashed), retired renderers
  released, with `patches/three@0.185.1.patch`. All change
  `packages/glass-game`, Beside Cue's game (its creator levels are imported
  only by `apps/beside-cue`). The web build compiles the package for
  `/glass-game`, which production serves unlisted
  (`tools/glassworks-listing.ts`: no links, `noindex`); static tracing from
  `GlassCampaign.tsx` reaches files each of the six changed. Not in
  CHANGELOG.md.

### Web, no visible change: shared code the Warm-up moved

- `src/lib/auto-continue.ts` (#1102), `src/lib/platform/index.ts` (#1113: the
  web installs nothing, so haptics keep the vibrate patterns), and
  `settings-progress.ts`'s `PREMIUM_EXERCISES` blocks (#1104). The web build
  has no Warm-up path.

### Admin only

- **#1144** (2 commits), a read-only Lessons page at `/admin/lessons`.
  **#1147** (2), the lesson-state API and migration 0071 (DB worker, step 1).
  **#1151** (11), Publish, Unpublish, "Use default" and the hook and tease
  pickers; the site follows within about 30 s; App's shortcuts pause under the
  Content Studio. **#1211** (4), faster Lessons page tests with their own time
  limits, and the checklist kept across updates (`<Index>`).

### Native: the app's own onboarding

All merge commits, 18 to 20 October, behind `NATIVE_ONBOARDING`
(`src/lib/native-build.ts`, equal to `KARAOKE_IMPORT`): test builds only,
compiled out of the store build, never on the web. Merc's first note (#1098),
the range and the voiceprint (#1101), Keep (#1103), the sung line and the
Cloud offer (#1112), Merc in the alley, the counts and the Warm-up landing
(#1120), and Not now to the Cloud offer, then the alley (#1123). In every
native build: #1098's Sing room arrival fix and #1110's Back closing the
voiceprint ask first.

### Native: the Warm-up

All merge commits, behind `PREMIUM_EXERCISES`: the picker's Pitch and Warm-ups
heads (#1096), warm-up mode in the four rooms (#1099), the routine core
(#1100), the path from Start to Sing a song (#1102), the week's dots and
synced days (#1104), the end's re-pack and iOS haptics (#1113, whose haptics
install reaches every native build), and Merc rising first between stops
(#1130).

### Native: audio and TV

- **#1091**, iOS reads the system volume only while someone listens (merge
  commit, 1; every iOS build). **#1097**, "One volume in rooms" off by default
  (merge commit, 1).
- **#1157**, a TV on AirPlay mirrors the phone, then shows the lyrics (5
  commits): the mirroring fix reaches every iOS build, the store build
  included; the lyrics on the TV are a test build's Developer switch.
  **#1182**, the same mirroring fix in Beside Cue (squashed).
- **#1175**, a TV on AirPlay or HDMI, and Bluetooth, keep a latency offset of
  their own (squashed). `src/stores/audio-route-store.ts` compiles into the
  web through `mic-latency-store.ts`, where it keeps the existing keys, so
  nothing changes there. In the native app no flag guards it
  (`apps/mercurypitch/src/main.tsx`), so the store build has it.
- **#1179**, the Karaoke room's stage on a connected TV, POC-3 (squashed): a
  test build's "Stage on a connected TV".
- **#1189**'s native parts: a song too big to play says why, Subscribe shows
  its wait, and the latency wizard hears a TV (`src/lib/mic-latency-route.ts`,
  used only on a route with a delay of its own; the web and the phone's own
  outputs keep the run they had).

### Refactors (no behavior change)

- **#1094** (merge commit, 1): the developer console is armed from the
  component layer. **#1095** (merge commit, 3): the four exercise rooms share
  one page shell (premium rooms, native).

### Dev tooling, CI and tests

- **#1166** (merge commit, 2): the app-check skill's `onTop` samples inside
  rounded corners, plus notes on the consent bar, the hitBox cap and WebKit.
  **#1176** (squashed): CI's browser setup through
  `scripts/install-ci-browser.mjs`, bounded and on signed sources
  (`pr-gate.yml`, `release-tours.yml`). **#1114** (1): Lesson 3's no-upload
  check leaves Cloudflare's `/cdn-cgi/` posts out. **#1211** is under Admin
  only.

### Docs only

- Find Your Pitch: #1141 (Lesson 7's facts and the specs' line references),
  #1146 (one curiosity moment per lesson), #1154 (Lessons 8 to 10's text
  packages), #1161 (Lesson 13), #1162 (Lesson 12), #1163 and #1164 (Lessons 11
  and 14, with their small code changes above), #1171 (the plan's citations
  re-pointed), #1173 (the Season 1 handoff), #1115 (the YouTube guide and
  which pages are built) and #1132 (minor solfège is do-based). TV: #1181 (the
  TV plan and its EARS requirements) and #1185 (the plan after the merges, and
  the owner's Cast and TV app decisions). Search: #1108 (the search and answer
  engines plan).

### native-mercurypitch

Five `mp-v` tags in the range, each on `main`, each with a green Mercury Pitch
Mobile run: `mp-v0.8.38` (790de6bec, #1120; #1135 lists what it carries),
`mp-v0.8.39` (2ad8e8576, #1130; run 39389902919), `mp-v0.8.40` (3c59c6272,
#1157; run 39823066101), `mp-v0.8.41` (921e3bbf1, #1175; run 39989491403) and
`mp-v0.8.42` (df6eb5be5, #1185; run 40178712684). #1209, #1201, #1211 and
#1210 merged after `mp-v0.8.42`. Unflagged, so in the store build too: #1091,
#1157's mirroring fix, #1175's per-route offsets and #1189's wizard (no flag
on their imports from `main.tsx` and `MicrophoneScreen.tsx`), #1110's Back
fix, #1098's Sing room fix and #1113's haptics install. Test builds only: the
onboarding (`NATIVE_ONBOARDING`), the Warm-up and the premium rooms
(`PREMIUM_EXERCISES`), #1157's TV lyrics and #1179's TV stage (Developer
switches). Not traced for this note: whether #1189's Subscribe wait and
refused-song card reach the store build. The lesson pages and the hub are web
documents and no native entry imports them; #1190's plan renders from
`App.tsx`'s web paths (not traced into the native shell).

### native-besidecue

No `bc-v` tag exists. Glass (#1087, #1090, #1092, #1167, #1180, #1183) and
#1182's external display fix reach Beside Cue's next build. Beside Cue Mobile
on cddefd571 (run 40232609860) is green.

## [0.9.21] - 2026-10-18

38 commits since `v0.9.20` (217047ffe) before this release PR, from 8 PRs, on
24 first-parent entries. 5 PRs came in as merge commits: #1068 (1 commit),
#1083 (3), #1082 (8), #1086 (1) and #1089 (1). The other 3 were rebased onto
`main`: #1084 (6), #1085 (5) and #1088 (8). Every commit came through a PR.

On the web, the release is:

- #1088's mails: the sign-in code, sign-up code, password reset, newsletter
  and account notice mails move onto the welcome mail's layout, and the mails
  name MercuryPitch as one word everywhere but the footer's copyright line.
  The DB worker sends them, so the tag's `deploy-db-prod` ships them.
- #1085's Drum Night fixes: the Take ready card covers nothing in the phrase
  coach column, and below 1040px Finish take sits beside the take cue.
- #1084's copy: no em dash in the visible strings of the Ear Lab, Home, the
  Voice Mirror, the profile page and the karaoke playlist overlay, one verdict
  shape in every Ear Lab drill, and a guard test.
- From #1082, console lines only: the web's `[audio]` diagnostics start with
  the local clock (below).

The rest is the native app. #1068, #1083, #1086 and #1089 change the four
premium rooms, which are compiled in only where `PREMIUM_EXERCISES` is true
(`src/lib/native-build.ts`: it equals `KARAOKE_IMPORT`, which needs
`IS_NATIVE_BUILD`) and mount only from `apps/mercurypitch`. #1082 is the
native shell's room visit and audio record. A `build:tours` web build of
f7f202003 carries none of their lines ("Tap the mic, then hold your note.",
"Take a breath, then sing", "Four times faster", "Merc sings a phrase", "One
volume in rooms", "MercuryPitch audio diagnostics", "Share report",
`play-and-record`, `release-hidden`, `auto-waiting`, `auto-held`), and does
carry #1084's and #1085's ("Two quick tones: up, down or the same?",
"Streak restored: ", "Review and finish.", `phraseCoachScroll`). The web's
older Long note (`src/features/exercises/long-note`) did not change, and
`room-kit/room-mic.ts` is read only by Echo, the premium Long note and the
glide core.

### Release steps (prod)

1. **No migration.** Nothing under `workers/db-worker/migrations`, the
   repository's one migrations folder, changed since `v0.9.20`; the newest
   file is still `0070_natural_keys.sql`. Project memory holds no pending
   prod migration note.
2. **No new secret, variable or binding.** No `wrangler*` file changed since
   `v0.9.20`, and the `env.*` names read in `workers/` and `src/worker.ts`
   are the same 70 at both ends. #1088 reaches the app's origin through
   `requestAppOrigin`, `mailOrigins` and `fallbackAppOrigin` in `auth.ts`,
   whose bodies did not change.
3. **Worker code.** The tag's `deploy-db-prod` job deploys the DB worker with
   #1088's mails. The Jam worker and `src/worker.ts` did not change. The same
   DB worker has run on dev since #1088's merge (Deploy DB Worker run
   39119051435 on f7f202003, green).
4. **No new link into the landing** (prod-upd step 0c). The diff's only new
   about.mercurypitch.com URLs are two test allowlists and the email
   preview's sample legal notice (`/terms/`), which only `EMAIL_PREVIEW`
   serves, and that is set in the dev block alone. The moved mails keep
   `footerHtml`'s About, Terms, Privacy and Contact links, and the purchase
   mail keeps `/terms/#withdrawal`. The live landing, `mp-v0.1.34`
   (disjoint-colliders 10ff9f8d), has `terms.astro` with `id="withdrawal"`,
   `privacy.astro` and `contact.astro`. No new query parameter.
5. **Social cards.** `pnpm run og:versions` on this PR stamped 13 cards with
   no change.
6. **Walk the tours on `main`** before the tag (Release Tours, prod-upd step
   4). The baseline is 0 misses.
7. **Push the tag `v0.9.21`.**
8. **After the tag.** #1088 checked browser renders only (headless Chromium,
   600 and 375 px wide), not the Gmail app, Outlook or Apple Mail. The owner
   answered its four questions on 2026-10-18 (below).

### Web: the code, reset, newsletter and notice mails take the welcome mail's layout (#1088)

Eight commits, one per step, each passing `pnpm typecheck:db` and
`pnpm test:db` on its own. No new art, and nothing was sent: every check is a
render. Only the owner's billing alerts ("[MercuryPitch billing] ...") stay
plain text; they go to the owner alone.

- **Welcome, confirm, fresh link and purchase** (`email-welcome.ts`,
  `email-purchase.ts`) were already on `email-layout.ts`. They named the
  product as two words in 11 places, three subjects among them ("Welcome to
  Mercury Pitch. Let's hear you.", "Confirm your email for Mercury Pitch" and
  "A fresh link to confirm your Mercury Pitch email"). Now it is one word, as
  `docs/branding/BRAND.md` types it.
- **Sign-in code** (`email-code.ts`): was a table fixed at 624 px with the
  code in 34 px blue. Now the letter picture (not a link), a "Sign in"
  eyebrow, and the code in a panel at 36 px teal (#2dd4bf) monospace with "It
  expires in 10 minutes and works once." under it.
- **Sign-up code** (`email-code.ts`; `email-sign-up-code.ts` is removed): the
  same frame with a "Sign up" eyebrow, and no "Hi there," since there is no
  name to greet.
- **Password reset** (`email-password-reset.ts`): the letter picture, the
  "Choose a new password" button, the link to paste, and "It expires in 2
  hours and can be used once." under it.
- **Newsletter** (`email-newsletter.ts`): the first-note stage linked to
  Home, a "What's new" eyebrow, the issue's subject as the headline, each item
  a panel with an arrow link, an "Open MercuryPitch" button and the
  unsubscribe line above the footer.
- **Account notices** (security, legal, account and the test copy;
  `email-notice.ts`): no picture; the notice's label as the eyebrow, its
  subject as the headline, each section a panel, an amber banner on a test
  copy, and "We will never ask for your password by email." on security
  notices only, as before.
- **Every footer's line** now stops at "Learn to sing and play." (it went on
  with "Practice has never been more fun."). `footerHtml` in `email.ts` draws
  every HTML footer and `footerText` in `email-layout.ts` every plain-text
  one, so the line changed once, in its own commit, and the plain-text footer
  names MercuryPitch as one word. The copyright line, "© 2026 Mercury Pitch ·
  AGPL-3.0", is unchanged: at f7f202003 it is the only two-word name left in
  `workers/db-worker/src` outside tests.
- **The layout's new rows**: a code panel, a second body paragraph, item
  panels and a closing row that can carry a link. The mails already on the
  layout render byte for byte as before.
- **Behavior.** The code mails take their links and pictures from the app
  that asked for the code (`requestAppOrigin`, the existing allowlist), as
  the sign-up mails do; a native shell's origin (`capacitor://localhost`,
  `https://localhost`) gets this environment's app. The newsletter's "Open
  MercuryPitch" button now uses `fallbackAppOrigin(env)`: mercurypitch.com
  on prod, as before, and dev.mercurypitch.com on dev, where it used to point
  at prod. `/api/email-preview` lists eight more mails (sign-in-code,
  sign-up-code, password-reset, newsletter, notice-security, notice-legal,
  notice-account and notice-test) with made-up words.
- **Unchanged:** what each subject says (the code still leads the code
  mails' subjects), every link, the send path (triggers, gates and the Resend
  call; List-Unsubscribe headers on the newsletter only), the From name, the
  light-only color scheme (#1010), `<body id="body">`, the auto-link styles
  and the versioned picture names. The notices' wording lock hashes the
  operator's words, not the HTML, so a notice approved before this sends the
  same words after it.
- **Copy.** The code mails' ignore lines now say that whoever asked can't
  finish signing in (or up) without the code, with "Nobody from MercuryPitch
  will ever ask you for this code." under a rule. The reset mail's expiry
  moved under the link as its own sentence, and the notices say "You're
  getting this" where they said "You are getting this".
- **Checks** (#1088's): `pnpm test:db` at every commit, 106 files and 2,124
  tests at the head. The new mail tests failed 35 of 56 against the old
  renderers, and the one-word name and ignore-line tests 17 of 102 against
  the old copy. Every mail was rendered through `handleEmailPreview` and shot
  at 600 and 375 px: the 8 old-look mails were 624 px wide and scrolled
  sideways in all 16 before shots; after, no sideways scroll and no broken
  picture in 40 shots (74 pictures).
- **Decided by the owner** (#1088's "Needs maff", answered 2026-10-18): the
  footer stays at "Learn to sing and play."; the account notices carry no
  picture; the newsletter keeps opening with the first-note stage (a picture
  per issue would need a field in the issue file and new art); and the
  copyright line stays "© 2026 Mercury Pitch · AGPL-3.0".
- **Follow-ups, not in it:** `scripts/newsletter/v0-9-10.json`, the last
  issue's words, has 2 em dashes and "quietly", left as the operator wrote
  them; the withdrawal mail says "cancelled" in its preheader and reason
  line; the reset mail's paste-this-link fallback and `confirmBlock`
  (`email-welcome.ts`) could share a helper; and `src/` still spells the name
  as two words 27 times (among them "Mercury Pitch Cloud" and the karaoke
  import's "Open Mercury Pitch within about a day").

### Web: Drum Night's Take ready card covers nothing (#1085)

- **Why.** The card was `position: sticky; bottom: 0` over the scrolling
  phrase-coach column. Chromium insets a sticky box by its scroller's
  padding, so it stopped 12 px above the column's edge, and the next row
  showed in that strip (at 0.9.20, the top of "Set recovery loop to bar 1").
  As an overlay it also cut whichever coach row ran under it. Below 1040px,
  stacking Finish take under the take cue made the bottom-anchored dock 51 px
  taller and lifted the cue over the photographed kick zone: 27 px of overlap
  at 1024x768 and 17 px at 390x844.
- **Change.** `.phraseCoach` is a flex column with `overflow: hidden`, and
  `.phraseCoachScroll` holds the coach and "Open take history" and scrolls,
  with 12 px of bottom padding so the last row clears the card. The compact
  take history is the footer under it (`flex: none`, a 1 px rule on top),
  flush on the column's edge with its content 12 px in. Where the coach runs
  on past the card, its last line fades into the rule; a scroll-driven
  animation lifts the fade over the last 32 px of scroll, under
  `@supports (animation-timeline: scroll())`, and browsers without it keep a
  plain edge. Below 1040px the dock gets `data-finish`, and
  `.coachCueDock[data-finish='true']` lays the cue and Finish side by side.
  The take cue title uses `text-wrap: balance` ("12 strikes ready ·" /
  "Review and finish.", where "Review" used to end the first line). The
  card's contents and the coach's copy are unchanged.
- **Tests.** New `src/e2e/drum-take-card.spec.ts` (@smoke) plays a
  real-pointer take at six room sizes and walks the column's scroll range in
  13 steps, checking every text node's and control's clipped box against the
  card. It fails on 217047ffe at 1440x900, 1280x800, 1024x768 and 390x844 and
  passes on the branch. `docs/agent/MISTAKES.md` gains "Give a pinned footer
  its own row, not `position: sticky` over the scroller".
- **Not checked:** Safari and Firefox, so the fade is unverified there, and
  the take-saved state below 1040px (Keep in Hear Yourself stacks a row under
  the cue).

### Web: no em dash in the Ear Lab, Home, the Voice Mirror, the profile page and the karaoke playlist overlay (#1084)

- **189 visible strings** (197 em dashes), counted by the guard's own parser
  at 217047ffe: 53 in the first pass (The Grid, Home, the Voice Mirror and
  the karaoke playlist overlay) and 136 in the second (the rest of the Ear
  Lab, its desk fault names and the profile page). Each became a full stop,
  colon, parentheses or a shorter sentence. One change has no dash: the
  Voice Mirror's retry line was a comma splice and is now two sentences.
  Examples: "Right. The third click was late by 40 ms.", "Streak restored:
  12 days", "Next: Song (Ana)", "Elvis Presley (your voice twin)" and the
  share text "My voice, mapped:" before its link.
- **One verdict shape** in every Ear Lab drill: "Right. The …" or "Yes. …"
  for a right answer, "That was …. Listen again." for a wrong one, "Not
  quite: …" for a ragged take, "Clean. Every onset met." and "No take. The
  bar came and went untapped.", and "Provisional: settling for …". After
  "Yes." the drill view capitalizes a reveal name written to follow "That
  was" (Pull's "the first, Ti leaning to Do′").
- **The guard:** `src/tests/visible-copy-em-dash.test.ts` (node project,
  listed in `vitest.node-tests.json`) parses each swept file with the
  TypeScript compiler and fails on any string, template piece or JSX text
  that holds an em dash, so comments are never read. The lone `—` placeholder
  and `console.*` arguments are exempt, and a fixture case pins the scanner.
  Before the copy fix it failed all six swept paths and listed 52 lines.
- **Kept:** the lone `—` that stands in for a missing number (Home's average
  score, the Voice Mirror's range hero, the Ear Lab dials and the stopped
  plate), comments, range en dashes, and every identifier, key and
  machine-readable value.
- **Found while writing these notes:** 17 of the strings are the `answer`
  field of `src/features/ear-lab/instruments.ts`, among them the Contour
  drill's, now "Two quick tones: up, down or level" (4310150bc, the PR's last
  commit). Nothing in `src/` reads that field at f7f202003: the room's rack
  rows (`EarRoomShell.tsx`) and the dashboard (`EarLabDashboard.tsx`) show
  `name` and `measures`. The strings ship in the bundle and show nowhere, so
  CHANGELOG.md leaves them out.
- **Follow-ups, not in it** (#1084's list): "metre" in 25 visible strings,
  where American spelling wants "meter"; the og:title and page-copy em
  dashes in `src/seo/entry-pages.ts` (75 at 217047ffe); and em dashes in
  other features, among them Karaoke Night, Voice History, Path, exercise
  help and the community pages other than the profile.
- **A tooling bug it found, not fixed:** `pnpm check` and `pnpm check:ci`
  run their steps through `run-s` (npm-run-all 4.1.5), which carries on and
  exits 0 when eslint dies of an out-of-memory abort. With a 256 MB heap,
  `pnpm lint` alone exits 134 and `run-s lint docs:index:check` exits 0; on
  the 4 GB default heap `eslint src --fix` ran out inside `pnpm check`, which
  still exited 0. CI is not exposed: `.github/workflows/pr-gate.yml` chains
  `pnpm run typecheck && pnpm run lint && pnpm run fmt`.

### Web, console only: the `[audio]` lines (#1082)

`src/lib/audio-diagnostics.ts` is in the web graph: the stem mixer's
`stem-load-path.ts`, `playback-return-watch.ts` and
`useStemMixerAudioController.ts` import it. Its console lines now start with
the local clock (`21:31:05.120`) instead of the seconds since the first
entry, and carry `[hidden]` only when the page was not visible, with no
`[visible]`. The in-memory ring keeps 1,000 entries instead of 200. Nothing
on screen changes. `scripts/assert-no-portable-console.mjs`, which the web
build also runs, fingerprints #1082's two test-build keys,
`mp:dev-one-volume-in-rooms` and `mp:dev-audio-log`.

### Native: Long note hears only the start that stands (#1068)

- Long note took every mic answer while its screen lived (`lateAnswers: true`
  in `room-kit/room-mic.ts`) and left its machine to drop one for a start that
  no longer stood. The machine dropped the `mic-ready` or `mic-failed`, but
  the room acted on the answer anyway. #1064 found it and left the behavior
  change for its own PR.
- What a late answer did: an open over the demo's listening take ran
  `beginListening` again (the line became "Take a breath, then sing A3.", and
  the take's window, hold, trace and clock started over); a refusal set Merc
  idle, the demo included; an open during the next take opened its window a
  second time (`startWindow` twice); and an open on a hidden page let the
  page check stop the next take.
- Who can reach it: the answer has to come after the singer moved on. A
  browser's permission prompt does not block the page; iOS's is modal. The
  third case also needs a capture that does not queue a second acquisition
  behind the first, which the real one (`useExerciseCapture.ts`) does.
- The fix: every answer is held to `stands()`, as Echo's and the glide
  core's already were. `lateAnswers` and its doc go, since nothing else used
  them, and `onOpen` loses its `phase !== 'listen'` return: `mic-ready` for
  the standing start always moves the machine from `starting` to `listen`.
- Proof: `useLongNoteController.test.ts` (new, 3 tests) mounts the real
  controller on a capture whose mic answers on cue, and all three fail on
  main, each for its own reason. `room-mic.test.ts`'s three `lateAnswers`
  tests now check that the answers are dropped. The #1064 harness ran main
  against the branch and against main with every answer held to `stands()`:
  the branch matches that third side in all 165 Long note scenarios and in
  3,000 random programs, and Echo, Lip roll and Ng slides are identical to
  main.

### Native: one iOS volume for a whole premium room visit, and an audio record to test it with (#1082)

- **Why.** The owner saw iOS turn the volume down to mute in the rooms (17
  Oct). The audit found that nothing in our code lowers it: opening the mic
  makes WebKit move the page's audio session to play-and-record with the
  VideoChat mode, and iOS keeps a separate stored volume for that (WebKit bug
  236219). It also found that the volume notice could claim zero from a stale
  reading.
- **The notice** never claims zero from a stale reading. `audio-output.ts`
  marks each reading's `volumeKnown`: `live` (Android, or the hidden volume
  view once seen to move), `agreed` (the app's session and a settled volume
  view say the same) or `session` (the app's session alone). `volume-hint.ts`
  says "The volume is at zero. Turn it up." only from `live` or `agreed`, and
  otherwise "Turn the volume up to hear the notes.". `RoomVolumeHint.tsx`
  reads again as the mic opens and closes, at once and 1 s later, and
  `AudioOutputPlugin.swift` sends `systemVolumeSettled` and each
  interruption's `appState`.
- **One volume for a visit.** Long note, Echo, Lip roll and Ng slides set
  `navigator.audioSession.type = 'play-and-record'` at the door and give the
  page its type back on the way out (`room-visit.ts`, mounted by
  `ShellScreens` before the room), on iOS only. It is the page API alone,
  with no AVAudioSession change (#923).
  `packages/mobile-runtime/src/page-audio-session.ts` is the type's one owner
  (`claimPageAudioSession`, a stack of claims, each change told to
  listeners). The room visit and Now Playing's brief `'playback'`
  (`askForPlayback` in `webkit-now-playing.ts`) both claim through it, and a
  wiring test keeps every other source from writing the type. A room gives
  its claim back as the page hides (`visibilitychange`, `pagehide`) and
  claims again as it shows, so its context cannot reach the lock screen's Now
  Playing; Control Center and the notification shade keep the claim. More >
  Developer > Audio > "One volume in rooms" is on by default and folded to on
  in a store build.
- **The audio record.** Room enter and leave; session set, restore, kept and
  refused; notice shown and hidden with the deciding reading; the demo's
  turns; and the app's launch, background, foreground, inactive and active,
  each line starting with the phone's clock. The ring holds 1,000 (it held
  200), a test build keeps the newest 500 across a restart
  (`audio-log-store.ts`), and Developer > Audio gains Share report and Clear
  log. The rooms' 100 ms level poll runs only during a room visit, not from
  launch on. `AVAudioSessionInterruptionWasSuspendedKey`, unsupported since
  iOS 14.5, is no longer read.
- **Needs a phone**, per the PR's eleven-scenario TestFlight plan: AirPods go
  hands-free (HFP) for the whole room, the call level's voice processing
  applies to demos too, and the lock screen, Control Center's slider and
  whether a mic indicator shows with the mic off are unchecked.

### Native: a first visit's demo waits while the app is away (#1089)

- **What was wrong.** On a premium room's first visit the demo starts by
  itself 1,200 ms in (`useExerciseDemo.ts`, `AUTO_PLAY_MS`). When Control
  Center came down before that, the shell parked the shared clock
  (`native-shell.ts`, `suspendSharedAudioContext()`), but no clock had been
  built yet, and `suspendSharedAudioContext` asked the leases
  (`prepareToSuspend`) only when one existed. So the room never heard
  app-leave and the demo's timer stayed armed. When it fired, its
  `lease.unlock()` cancelled the shell's intent, built and resumed the clock,
  and the demo played behind Control Center. The lock screen and the app
  switcher also hide the page, where the demo's own `visibilitychange`
  listener already stopped it.
- **The fix.** In `packages/audio-io`, `suspendSharedAudioContext()` asks
  every lease even when no clock exists; a background hold, such as the mic
  permission alert, still stops it from asking. `room-kit/app-leave.ts` adds
  a return word (`onAppReturn`, `announceAppReturn`), which the native shell
  announces when iOS calls the app active; it wakes no clock. The demo kit
  holds a first-visit demo that had not started when the app or the page
  went: no card, no mic hint, no clock. It starts 1,200 ms after the app is
  active and the page shows, while the room is still at its intro and the
  demo unseen; a demo that had started still ends on its play card. A test
  build's audio record writes `demo auto-waiting`, `demo auto-held` and
  `demo auto-starting`.
- **Tests.** `apps/mercurypitch/src/shell/room-demo-away.test.ts` runs the
  real chain (native shell, shared clock, a room's lease, the demo kit) on
  fake timers in 12 cases. The Control Center case failed before the fix, as
  did 9 of the first 11. `LongNoteDemo.test.tsx`'s background test now
  expects the held demo, then the restart on return.
- **Phone test** (the PR's): on a phone that has not seen a room's demo, open
  Echo, Lip roll or Ng slides and pull Control Center down within a second.
  Nothing should play, and about a second after Control Center closes the
  demo starts. The same with the lock button.

### Refactors (no behavior change)

- **#1083**, room refactor step 4 (after #1058, #1061 and #1064), the demo's
  way in. `room-kit/room-script.ts` (`createRoomScript`) holds the terms
  Echo, Long note and the glide core each wrote for when a demo may come in
  and move. `demo-kit/demo-voice.ts`, `demo-segments.ts` and `demo-words.ts`
  hold Merc's demo voice and the 13 demo words (`DEMO_WORDS`, to which Long
  note adds its mic hint and fast-forward pill), and
  `room-kit/glide/glide-demo-take.ts` is one glide take for Lip roll and Ng
  slides. `demo-plan.ts` gains `ONE_CLOCK`. jscpd over the four rooms with
  room-kit and demo-kit: 33 clones and 590 lines before, 24 and 444 after.
  The recorded-world harness found all four rooms byte-identical to main in
  24 named scenarios and 3,000 random programs each, with 41 planted bugs as
  controls. Found, not fixed: the rooms' `demo/tip-targets.ts` files still
  share 7 clones (128 lines).
- **#1086**, step 5: `room-kit/room-lines.ts` (`fillLine`, `createRoomLines`)
  is the one way every room picks and fills Merc's lines.
  `room-kit/line-selector.ts` and `room-kit/glide/glide-lines.ts` are
  deleted, and Echo's own fill pass is now an alias of `fillLine`. A recorder
  drove each room's line API on main and on the branch with 13 random
  sources: 159,111 recorded lines and the four tables are byte-identical. Of
  11 planted bugs, the recorder catches 11 and the repo's tests 10. Step 6
  (RoomShell) follows in its own PR.

### native-mercurypitch

`mp-v0.8.36` (a46652538, the merge of #1082) carries #1068, #1083 and #1082.
#1086, #1084, #1085, #1089 and #1088 merged after it and arrive with the next
`mp-v` tag, apart from #1088's mails, which the DB worker sends to every
build: dev now, prod with this tag. Mercury Pitch Mobile built f7f202003
green (run 39119051445).

Reach, from static import tracing, not from the native bundle's module list:

- #1068, #1083, #1086 and #1089's demo kit change are in the premium rooms,
  which a native test build (TestFlight among them) carries and a store build
  does not (`PREMIUM_EXERCISES`).
- #1082's room visit and #1089's return word run from `apps/mercurypitch`
  (`ShellScreens.tsx`, `native-shell.ts`). #1082's own store-build check
  found the room visit in the store bundle and none of its switch, Share
  report, Clear log or "log restored".
- #1084 and #1085: `apps/mercurypitch/src/main.tsx` mounts `src/App.tsx`,
  which renders `HomePage` only when `IS_NATIVE_BUILD` is false, and
  `EarLabPage` under `TAB_EAR_LAB` with no native guard. Whether the native
  shell opens the Ear Lab, the Voice Mirror, the profile or Drum Night was
  not traced.

### native-besidecue

No file under `apps/beside-cue` or `packages/glass-game` changed since
`v0.9.20`, and no `bc-v` tag exists yet. Three shared packages Beside Cue
depends on changed:

- `packages/audio-io` (#1089): Beside Cue's `app-foreground.ts` calls
  `suspendSharedAudioContext()`, and its `web-audio-output.ts`, with Glass
  Game's `glass-sound.ts` and `merc-narration.ts`, leases with
  `prepareToSuspend`, which now runs even when no clock has been built.
- `packages/mobile-runtime` (#1082): Beside Cue imports
  `@irchiinnuss/mobile-runtime/platform`, which imports
  `webkit-now-playing.ts`, whose `askForPlayback` now claims through the new
  `page-audio-session.ts`. `audio-output.ts` readings gain `volumeKnown`.
- `packages/ios-audio-session`'s `AudioSession.swift`, which both iOS apps
  link, changed only in comments.

Beside Cue Mobile built f7f202003 green (run 39119051444). None of this was
checked against Beside Cue's bundle or on a phone.

## [0.9.20] - 2026-10-18

158 commits since `v0.9.19` (d6f4a945e) before this release PR, from 43 PRs,
on 87 first-parent entries. 25 PRs came in as merge commits: #1037 to #1066
(#1050 11 commits, #1058 8, #1046 5, #1055 4, #1047, #1049 and #1060 3 each,
#1037, #1040, #1051, #1053, #1059, #1061, #1064 and #1066 2 each, and #1038,
#1039, #1041, #1044, #1052, #1054, #1056, #1057 and #1063 1 each) and #1077
(9). The other 18 were rebased onto `main`: #1032 (6), #1042 (4), #1043 (2),
#1045 (1), #1062 (3), #1065 (1), #1067 (13), #1069 (2), #1070 (2), #1071 (2),
#1072 (2), #1073 (5), #1074 (2), #1075 (2), #1076 (2), #1078 (3), #1079 (8)
and #1080 (2). Every commit came through a PR. #1035 and #1036 are in
`v0.9.19`: #1036 is its release commit, and #1035 merged before it.

On the web, the release is:

- #1067's copy fixes: Karaoke Night, Ear Lab's Hairline, Glass and Drum Night
  without em dashes or scheduler words, and a share card that fills its frame.
- #1079's layout fixes: Drum Night's voice pill and kit drawer, and Hairline's
  card, instrument and tour offer.
- #1032's review fixes to the key change, #1042's host-only Jam room messages,
  #1043's install screenshots, #1059's song card menu and #1062's Karaoke
  Night share titles and llms.txt.
- The October security review, #1069 to #1078, with its test scope in #1080.
  Two of the nine change what a person sees: a sync link waits for Connect
  (#1075), and a Google Drive connection is finished in the app on the
  account that started it (#1078). #1072 also changes a rare case: a code
  sign-in that confirms an inbox removes a password, sessions and passkeys
  set on that address before it was proven.
- #1065, the CSP's allowance for Cloudflare's Web Analytics beacon.

The rest is the native app: the four premium rooms (Echo, Long note, Lip roll,
Ng slides), the Cloud offer and the accounts around it, Settings, the native
CSS and #1077's notices. The rooms are compiled in only where
`PREMIUM_EXERCISES` is true (`src/lib/native-build.ts`: it equals
`KARAOKE_IMPORT`, which needs `IS_NATIVE_BUILD`), and they mount only from
`apps/mercurypitch`. A `build:tours` web build of 1d9ca6fd5 carries none of
their lines ("That run stopped when you left", "Start on a note that feels
easy", "Merc sings a phrase"). #1049 and #1053 answer only the app
differently.

### Release steps (prod)

1. **No migration.** Nothing under `workers/db-worker/migrations` changed
   since `v0.9.19`; the newest file is still `0070_natural_keys.sql`. The
   pre-flight in `docs/integration-2026-07-release-handoff.md` section 7 has
   nothing to apply. `auth_ratelimit` rows keyed by a raw IPv6 address
   (before #1073) are never read again and expire within 24 hours.
2. **No Google OAuth secret put** (prod-upd step 6). `GOOGLE_CLIENT_ID` did
   not change in any block of `workers/db-worker/wrangler.jsonc`. The file's
   one change since `v0.9.19` is #1049's: `APP_GIFT_SONGS: "5"` in the dev
   block, and a comment in the prod block saying it is left unset there.
   Nothing changed in the Jam worker's config.
3. **Worker code, no new variable or secret.** The tag's `deploy-db-prod`
   job deploys the DB worker with #1049, #1053, #1072, #1073, #1076 and #1078,
   and the Jam worker with #1074. The app's own worker (`src/worker.ts`)
   carries #1069's UVR bridge change. With `APP_GIFT_SONGS` unset on prod,
   the launch gift is off and `GET /api/billing/promo/featured` answers
   `appGift: null`. `RUNPOD_AUDIO_URL_ALLOWED_HOSTS` stays unset.
   `runpod/handler.py`'s guard reaches RunPod only when its image is rebuilt;
   no workflow here deploys it.
4. **#1076 is a contract change:** `GET /api/userProfiles` (list and count)
   is 401 without a token and returns only the caller's own row with one. A
   profile by id stays public. No reader in this repository uses the
   anonymous list.
5. **Dev walk and tours.** `docs/security-review-2026-10-testing.md`
   section 4 is the dev walk for the nine fixes, and section 6 the gate
   before `/prod-upd`. Then walk the tours on `main` (Release Tours,
   prod-upd step 3b); the baseline is 0 misses.
6. **Push the tag `v0.9.20`.** `pnpm run og:versions` on this PR stamped 13
   cards with no change: #1067 committed `og-image.png` at `?v=fca3ba4d`
   with its stamp, and the other 12 did not move.
7. **After the tag:** the analytics `page_location` check (section 3.2 of
   the security doc) on mercurypitch.com, and `source` on prod's
   `POST /api/jam/ice` for a live room, which must be `turn` where the prod
   TURN key is set. Run the Jam two-peer check before TURN is turned on
   anywhere: the client now fetches ICE as it builds a peer connection.

### Web: plain words in four rooms, and a share card without bands (#1067)

From the 0.9.19 clips on the irchiinnuss room page. One commit per fix, then
eight after review.

- **Karaoke Night.** Title and artist meet at a middle dot: the stage title
  reads `Violet Light · MercuryPitch Demo`, and the tab title while playing
  (the shared `StemMixer`) `Violet Light · MercuryPitch Demo | MercuryPitch`.
  Every em dash on the landing, the rail, the phone stage and the stem
  mixer's toasts became a full stop, colon or comma. Example rows are named
  `${artist} · ${title}`; seeding renames a row only while its name is
  exactly the old `${artist} — ${title}` default, on web and native.
  `parseArtistTitle` (`src/lib/lyrics-service.ts`) now splits at the middle
  dot first, so lyrics lookups for those rows get an artist again.
- **Ear Lab Hairline.** Prompts and verdicts read as sentences ("Right. The
  first was higher by 50.0¢.", "Two tones. Which one was higher?"). The `—`
  placeholder for a reading not taken stays.
- **Glass.** Coach lines, the landing, How it works, results, the share text
  and the card headline ("SHATTERED, FIRST TRY"). The three `—`
  placeholders and two console logs stay.
- **Drum Night.** The session line is `Built-in groove · 29 hits · 84 BPM`;
  the score note is "The score is playing." and names the backup synth only
  when a sampled kit fell back (on Mercury Synth every hit is the synth by
  design); the score subtitle counts hits and the bars the sheet draws
  (`29 hits · 2 bars · 84 BPM`); kit status, coaching, the guide and the
  Play and Stop names lose "take clock", "authored" and "articulations". The
  scheduler's counts moved to `data-diagnostics` on the note.
- **The share card.** `public/og-image.png` was the key visual's 2.4:1 art
  inside its own letterbox, with 65 near-black rows top and bottom.
  `scripts/generate-og-image.mjs` now renders it from
  `assets/og-backdrops/cosmic-terminator.jpg` (the art band, cut losslessly
  from the master) at 1200 x 630 with no band rows: `?v=411005dd` to
  `?v=fca3ba4d`. Its alt text describes what the card shows.
  `src/seo/og-image-frame.test.ts` fails on the old card.
- **Share tags on boot** (`src/lib/og-tags.ts`) use the stamped card,
  index.html's descriptions and the title `MercuryPitch: See Your Voice, Sing
Karaoke, Improve Every Take` (index.html's `og:title` and `twitter:title`
  changed to match). A shared melody's description takes "An" before 8, 11,
  18, 80 and 800.

### Web: Drum Night's voice pill and kit drawer, and Hairline's card, instrument and tour offer (#1079)

- **f. The voice pill clears Kit.** It sat on Drum Night's rail Kit button
  (1554 px² at 1440 x 900). A new `--voice-pill-inset-bottom` in
  `VoiceControlHud.module.css` (0 by default, so no other room moves) lifts
  it 82 px above Kit where the rail shows and the screen is over 520 px tall;
  from 721 to 768 px wide it takes the absent tab bar back out. Still as on
  main: the hi-hat pad on a phone, and Kit on screens 520 px tall or less.
- **g. Hairline's card shows its whole paragraph** where five lines hold it
  (1440 x 900, 1280 x 800), with no More. `descriptionLines` on
  `ThresholdDrillView`, through `EarStage` to `InstrumentCard`'s `lines`;
  three stays the default. The card re-measures on a ResizeObserver and
  after `document.fonts.ready`, where it used to measure once in `onMount`.
- **h. The instrument holds still from question to verdict** (it moved 25.8
  to 44.6 px in a practice run). A run hands `EarStage` a reserve: the
  question line's sentences and a verdict of the run's starting length,
  laid out unseen from a `data-reserve` attribute, so screen readers read
  the console as before. The cost: it moves once, as Practice run starts.
- **i-1. Opening a drill retires the Ear Lab tour offer**, which sat over
  Hairline's pads for about 5 s on a phone.
- **i-2. A kit's name no longer runs into its size** in Drum Night's drawer:
  the name's column is never narrower than its longest word, and the size
  wraps.

### Web: the October security review (#1069 to #1078, #1080)

- **#1069:** the UVR bridge (`src/lib/runpod-bridge.ts`, `runpod.ts`) no
  longer reads a client's `audio_url`, so a signed-in caller cannot make the
  GPU worker fetch a host of their choosing. `runpod/handler.py` refuses
  `audio_url` unless its host is in `RUNPOD_AUDIO_URL_ALLOWED_HOSTS`. Its
  pytest is not in CI.
- **#1070:** gtag's `page_location` is `origin + pathname + search`, so a
  reset token or Google redirect JWT in the hash no longer reaches Ads or
  GA4.
- **#1071:** sign-out clears the content studio's admin key from
  `localStorage`.
- **#1072:** a mailed code that confirms an unverified account clears its
  `passwordHash`, deletes its sessions and passkeys and bumps
  `tokenVersion`. TOTP and recovery codes stay, so a second factor is still
  owed. Open: the confirm-link then Google or Apple variant.
- **#1073:** anonymous rate limits key an IPv6 address by its /64
  (`ipRateLimitKey`), across `rateLimitSubject`, the auth limiters, passkey,
  Apple, newsletter and review access.
- **#1074:** `POST /api/jam/ice` mints TURN only for `?room=<id>` whose
  JamRoom reports a live peer (`/internal/room-active`), and answers STUN
  otherwise. The client asks just before it builds a peer connection.
- **#1075:** a `#/sync:CODE` link fills in the code and waits for Connect,
  and a device that is not receiving drops a pushed song.
- **#1076:** the list and count of an `owner` table (`userProfiles`) are no
  longer public; see release step 4.
- **#1078:** the connect-Drive callback seals the refresh token with the
  starting account (`#gdrive_pending=`, 5 minutes), and
  `POST /api/auth/drive/finish` stores it only for that account. The Drive
  client calls moved to `src/db/services/drive-connect-service.ts`.
- **#1080:** `docs/security-review-2026-10-testing.md`, the test scope and
  release gate. Its PR body carries a tool attribution line; the commits do
  not.

### Web: share titles, llms.txt and the CSP (#1062, #1065)

- **#1062:** Karaoke Night's `og:title` and `twitter:title` read "Karaoke
  Night: Turn any song into karaoke", the approved card's kicker and
  headline. `public/llms.txt` and the Vocal Remover FAQ say Karaoke Night
  ships a few example songs under CC BY 4.0.
- **#1065:** `script-src` in `public/_headers` allows
  `https://static.cloudflareinsights.com`, which Cloudflare's injected
  beacon needs; it reports to `/cdn-cgi/rum` under `connect-src 'self'`.

### Web: review fixes for the key change (#1032)

Five findings from #857's review, one commit each, then the agent index.

- **Set A and Set B in the phone's More keep the focus (row 11).** Each row
  was rebuilt when its point moved, which dropped keyboard and screen-reader
  focus to the page. `KaraokeMoreSheet.tsx` reads the point inside the row's
  text.
- **The voice picker keeps its keys (row 9).** A press on the picker's words
  left the focus on the page, where Space played the song, A, B, L, S and M
  changed the mixer, and focus mode's Escape left focus mode with the picker
  up. `StemMixer.tsx` puts the picker in the keyboard gates beside the score
  dialog, and `VoiceTypePicker.tsx` takes the focus itself
  (`tabindex="-1"`).
- **`use-focus-trap.ts`: the root is not one of its own stops.** From a
  dialog that holds the focus, Tab goes to the first stop and Shift+Tab to the
  last, where Shift+Tab used to leave for the page. That holds for every
  dialog that can take the focus.
- **Find my key keeps a key moved while it worked (row 10).**
  `useStemMixerKeyController.ts` notes the key when a fit is asked for; if it
  moved by the time the fit lands (after the range read or the melody), the
  fit is said, not applied, and a second press moves to it.
- **While a song loads (row 7).** The notes row needs an analysable vocal
  (`analysableVocal()`, the analysis's own test); a tap used to toast "No
  vocal stem loaded". A new `'loading'` result says the song is still loading
  where it will be decoded. Where it streams (`streamsStems`, from
  `useStemMixerAudioController.ts`: a phone, the app's hosted room) the plain
  "cannot be found on this device" comes at once.
- **The app's Karaoke room (row 8)**, native only: `KaraokeRoomOptions.tsx`
  holds Find my key's notices for every song that arrives under the open
  sheet, not only the one it opened on.
- Left for later in #1032: row 13 (the spoken loop range's reply) as #857
  decided. Row 14 is #1042.
- Known limitation: with the focus on the page behind the picker and the key
  panel open under it, the first Escape closes the key panel and the picker
  stays.

### Web: a Jam room's song, drill and transport come only from its host (#1042)

- Row 14 from #857's review, and the same gap in the room's two other
  host-only messages. Every peer adopted any song manifest (the room's key,
  its words and the parts), and every guest followed any guest's drill and
  transport; the host already ignored guests' drill and transport. A modified
  guest client could move everyone's key (clamped to ±6), swap the words and
  parts, or play, pause, seek and stop the song for the other guests.
- `src/lib/jam/service.ts` hands song and drill messages to the store with
  their sender, the peer whose channel they came in on, as pitch, transport
  and song-file messages already were. `jam-store.ts`'s `sentByJamHost`
  compares it with `jamHostPeerId()`, the host the room's Durable Object
  names. `applyRemoteTransport`'s sender is no longer optional.
- No race with a change of host: the Durable Object sends `host-changed`
  before `peer-joined`, and a joining guest learns the host in `room-joined`.
  A room whose host left takes these messages from nobody. What a peer sends
  is unchanged, so older clients are unaffected.
- Tests: `src/tests/jam-room-host-messages.test.ts` and
  `src/lib/jam/service-message-sender.test.ts` (new). Two browsers on a local
  Jam worker with real signaling passed the drill run and a 13-check room-key
  run. Not verified: real phones in a room on dev.

### Web: install screenshots (#1043)

- `public/screenshots/karaoke-narrow.png` re-shot with the phone stage as
  #857 left it, and `home-wide.png` without the version.
  `scripts/gen-pwa-screenshots.mjs` hides the version's button (found by
  `aria-label="Show the changelog"`) as it hides the launch-promo pill, and
  fails a frame whose text still shows `v<version>`.
- The karaoke frame's typeface is the shooting machine's `system-ui` (Inter
  here); pinning it is not done.

### Web: the song card's menu stays inside the card (#1059)

- On `(pointer: coarse)`, the 32 px More button's `::after` (`inset: -8px`)
  ran 7 px past the card's right edge, so `.session-header`, its top row and
  its actions were each 7 px wider than their box. It is now
  `inset: -8px 0 -8px -15px`: the tap area is still 46 x 46 and the button
  still draws at 32 x 32. Measured on the web Karaoke studio at 390 x 844 and
  1440 x 900, both themes.
- `probe-bundle.mjs` on the native bundle went from 305 ok and 4 FAIL to 387
  ok and 0 FAIL, since the karaoke and landscape walks stop at their first
  failure.

### Server: the app's launch gift, off on prod (#1049), and the free song's truth (#1053)

- **#1049.** An account made in the native app while the featured promo runs
  gets `APP_GIFT_SONGS` songs of the app's own: a `creditLedger` row with
  reason `app-gift`, written in the same D1 batch as the promo claim and only
  if the claim lands. `signUpFrom(request)` reads the app's origins
  (`capacitor://localhost`, `https://localhost`) for a sign-up code, Apple,
  Google and Apple's upgrade of the phone's anonymous identity; never a web
  sign-up, a sign-in to an existing account or a typed code. The app spends it
  after the month's free song, the subscription and review access. No schema
  change: `creditLedger.reason` has no CHECK. Open with the owner: whether it
  adds to the web's 5 LAUNCH credits or replaces them, and that the origin is
  the client's word (bounded by the per-address claim, Turnstile, the
  provider tokens and the promo's cap).
- **#1053.** The app's `/api/billing/me` songs answer adds `monthly`
  (`getsFreeSong`, and the free song not switched off), so the app promises
  a next free song only to an account that gets one. The web's answer is
  unchanged.

### Native: the premium rooms

- **#1037:** `RoomVolumeHint` reads the volume again every 500 ms while its
  hint is up and on return to the page; `AudioOutputPlugin.swift` also reads
  the system volume off a hidden `MPVolumeView` and trusts it once it has
  moved. A test build's audio census records the session, both volumes,
  interruptions and route reasons around every mic and context start and
  stop. Not yet run on a phone.
- **#1038:** a soft octave under the rooms' low notes, at the classic
  exercises' curve, moved to `src/lib/low-note-reinforcement.ts`. The classic
  engine (`audio-engine.ts`, on the web) calls the same functions and its
  sound does not change; `reference-tone.ts` and `demo-audio.ts` take it as
  an option, off by default. On a modelled phone speaker it lifts the low
  notes by 0.0 to 0.2 dB, so it is not the fix for #1033's 14 dB.
- **#1040:** each room plays through a stage of its own in front of
  `roomOutput`, cut when the room goes (after its tail) and when a tap starts
  a parked clock, so a note parked by Control Center no longer plays at the
  next tap (-11.8 to -22.0 dB before, nothing above -60 dB after).
- **#1044:** a take or demo ends when Control Center or the notification
  shade comes down, as on a page hide (owner's rule, 16 Oct). The lease passes
  the park on through `room-kit/app-leave.ts`; the first Start's microphone
  prompt holds the clock against a park; `startRoomTone` plays nothing on a
  clock that is not running. iOS only: Android's shade does not park.
- **#1046:** Lip roll's Merc buzzes his lips (`LIP_MOUTH` `'buzz'`) and
  stands with his feet on the voice's line (`MERC_SINK_W`). The shader hash
  in `scene-shader.test.ts` was re-pinned with it.
- **#1056:** on a climb, the next dots show over Merc through a window on his
  front half (`DotsAhead.tsx`).
- **#1063:** the rooms' roots share `room-kit/RoomSurface.module.css` and
  every room picture is `draggable={false}`; the native shell turns off
  selection, the callout and the tap highlight, with fields opted back in.
  Places that keep selection on purpose (the account email, the friend, jam
  invite, sync and two-factor codes, the developer report, the portable
  console) now also spell `-webkit-user-select`. The web's Lightning CSS
  target already added that prefix.

### Native: the Cloud offer, Keep and accounts

- **#1047:** paywall B v2 (`CloudOffer.tsx`), the gate in front of Import a
  song (`import-gate.ts`), and a Mercury Pitch Cloud group in Settings
  (`CloudGroup.tsx`), all behind `KARAOKE_STAGE_2` and `PREMIUM_IMAGES`, so
  the store build carries none of it.
- **#1050:** Keep v2, the free-account offer, replaces the account offer
  sheet, and Settings gets Save your progress; `openKeep` is on the native
  shell API. The gift row reads #1049's `appGift`.
- **#1051:** the free song lines name the confirmed email. **#1053** (client
  half): "Your next free song comes on <day>." only when `monthly` is true or
  absent.
- **#1052:** after a sign-in to an existing account, the app asks before it
  adds this phone's voiceprints (rule D2).
- **#1057:** a subscription bought signed out follows the sign-in with no
  Restore tap (`settleCloudAfterSignIn`, RevenueCat `logIn` and `restore`,
  then its TRANSFER webhook), and never moves another account's. Test builds
  time each subscription step; `scripts/assert-no-portable-console.mjs`, which
  also runs in the web build, now fingerprints that panel and its
  `[subscription]` log.

### Native: Settings and CSS

- **#1054:** Settings' small buttons are 44 px tall.
- **#1060:** Storage keeps its sizes whole, Devices draws a computer
  (`ComputerIcon`) for Mac, Windows, ChromeOS and Linux sessions, and the
  portable console's count reads at 9.32:1 in dark (dev builds only).
- **#1066:** `build.cssTarget: ['safari16', 'ios16']` for the native build
  (`NATIVE_CSS_TARGET`), so 83 glass rules gain `-webkit-backdrop-filter` and
  blur on iOS 16 and 17 (owner accepted the GPU cost, 17 Oct).
  `src/native-css-target.test.ts` fails when the floor in the config, the
  pbxproj and `Package.swift` disagree.

### Native: notices (#1077)

- In the native app, an unlock in a premium room goes to one chip under the
  take's result (`room-kit/UnlockChip.tsx`, `unlock-claims.ts`), and every
  other notice shows as one pill under the status bar
  (`apps/mercurypitch/src/shell/NoticePill.tsx`, placed by
  `notice-pill-place.ts`). `App.tsx` does not mount `<Notifications />` under
  `IS_NATIVE_BUILD`. The web keeps its toasts and their words.

### Refactors (no behaviour change)

- **#1039:** the Echo, Lip roll and Ng slides controllers back under 800
  lines (`size.filesOver800` 136 to 133, baseline re-frozen).
- **#1041:** Ng slides plays through `room-kit/room-tones.ts`;
  `bridge-tones.ts` is deleted.
- **#1055:** one glide-room core for Lip roll and Ng slides,
  `src/components/room-kit/glide/` (`useGlideRoom`).
- **#1058:** the glide rooms' remaining file pairs folded into room-kit and
  `src/stores/glide-room-store.ts`.
- **#1061:** one room life, frame loop and quiet watch for Echo, Long note
  and the glide core (`room-life.ts`, `frame-loop.ts`, `quiet-watch.ts`,
  `room-constants.ts`).
- **#1064:** one mic opening for the three (`room-kit/room-mic.ts`). Found,
  not fixed: Long note takes late mic answers, so a late success can begin
  listening again over the demo's take, and a late refusal sets Merc idle.
  The fix (guard with `stands()`) changes behaviour and belongs in its own PR.

### Tests

- **#1045:** `DrumNightApp.test.tsx` awaits the lazy Drummer Seat kit before
  striking it; 22 tests had flaked on CI. 15 other tests in the file still
  fail when run alone.

## [0.9.19] - 2026-10-16

146 commits since `v0.9.18` (13b4150bd) before this release PR, on 14
first-parent entries: the merges of #857 (116 commits), #1034 (6), #1033 (6),
#1028 (3) and #1035 (1), the squash commits of #1031, #856, #1029 and #1008,
and the commits of #890 (4) and #1030 (1) rebased onto `main`. Every commit
came through a PR.

On the web, the release is the key change and the mixer's playback rail
(#857), a separator that moves to the CPU when the graphics card stops
answering (#1031), Long note's mic states (#1028), a TV remote's D-pad and a
browser with no microphone (#890), and new install screenshots (#856).
#1035 is mostly for the phone app, but on the web it stops Long note's note
when the room is left. #1033 and #1034 change the premium rooms, which reach
no web build, and #1008's mail layout has been live since 15 October.

### Release steps (prod)

1. **No migration, secret or worker variable.** Nothing under
   `workers/db-worker/migrations` and nothing in
   `workers/db-worker/wrangler.jsonc` changed since `v0.9.18`. The one worker
   change is #1008's mail layout (`workers/db-worker/src/email-layout.ts`),
   live in production since run 38778660613 on 15 October; the tag's
   `deploy-db-prod` deploys it again unchanged.
2. **Walk the tours on `main` before the tag** (Release Tours, prod-upd step
   4). The baseline is 0 misses.
3. **Push the tag `v0.9.19`.** `pnpm run og:versions` on this PR stamped 13
   cards with no change.

### Web: change a song's key, and the mixer's playback rail (#857)

- **The key.** A chip beside Speed ("Key +2") opens a stepper: lower, raise,
  Back to original key, and Find my key. The range is -6..+6; the backing
  stays clean within ±4, and beyond that the control warns rather than
  refuses. Signalsmith Stretch (MIT) runs as an AudioWorklet, bundled from
  npm and served from our own origin; its main-thread half loads when a
  song's key first changes.
- **Speed keeps the key, and a key change keeps the speed.** Every stem
  reaches the master through the key graph, key 0 included, and the shifter
  runs at key - 12·log2(speed) (`stem-key-control.ts`). In 0.9.18 the
  sources' `playbackRate` moved the pitch with the speed.
- **Find my key** uses the singer's voiceprint range, else their voice type
  in Settings, and otherwise asks. Asked again once the song fits, it opens
  the voice picker again and offers Back to original key.
- **Remembered** per song on this device, and per playlist entry for that
  entry's singer. The entry's key wins, and entry keys travel in the session
  archive. Drums keep their own pitch by default (Settings > Key Change >
  Leave drums unshifted).
- **Jam song rooms.** Only the host sets the room's key, sent once the host
  stops pressing; every peer shifts its own backing and guide vocal. A
  device that cannot shift says so and plays the original key.
- **Voice control:** "key up", "key down", "original key" and "find my key".
- **The rail** is new components in `src/components/stem-mixer/rail/`
  (`MixerRail`, `MixerCapsule`, `SpeedChip`, `KeyChip`, `MixerTimeline` on
  the shared `LoopRangeRail`), each with its own CSS module and props only.
  `StemMixerTransport.tsx` is a thin adapter, and the rail's CSS left the
  `StemMixer.tsx` template string. No control changes width with its state.
- **The timeline is a range input.** Tab reaches it, the arrow keys seek, it
  reads "0:15 of 0:30", and the A and B marks drag. That closes BUGS.md's
  click-only seek bar.
- **Loops.** B on or before A (closer than 0.1 s) is refused with a reason.
  It used to freeze playback by seeking back to A every frame.
- **One closing rule for floating panels** (`src/lib/use-popover-layer.ts`):
  a press outside, Escape (one layer at a time), a scroll that could move the
  trigger, or a resize.
- **Layout and the sidebar toggle** moved from the rail to the mixer header.
  Below 1000 px of header on a touch screen (600 on a mouse) they fold into
  one View menu.
- **Phones.** A phone held sideways (coarse pointer, landscape, at most 500 px
  tall: `isShortTouchLandscape`) gets the phone stage in two columns. Its More
  sheet (`KaraokeMoreSheet.tsx`) holds text size, the notes over the lyrics,
  autoplay, speed and the A/B loop.
- **The app's Karaoke room.** The key moved into Karaoke options > Playing,
  and "Measure my range" is hidden in the app, which has no Voice Mirror.
- **After the owner's tablet test on 16 October:** Find my key asks again,
  with Back to original key; the key picker is solid; no menu opens on a
  divider; the tour moves to the fixed two-column layout without flashing the
  layout menu; the reason lines under Loop and Hear my voice are solid; a
  file's extension is stripped without cutting "Mr. Brightside" to "Mr"
  (`stripAudioExtension`, `src/lib/audio-file-name.ts`); the lyrics tour
  steps are skipped for a song without lyrics.
- **A narrow rail folds controls into More** (`rail-fold.ts`), one at a time:
  Speed below 860 px of rail on a mouse and 640 on a touch screen, then Key
  below 406 and 574, then Play from the start below 332 and 486. More's Key
  row opens the same panel (`KeyPanel`), hung from More. On an 800 x 1280
  tablet beside the app's sidebar the rail is 466 px, and the controls need
  486 even with Key in More.
- **The app sidebar's collapse button** showed only on hover, so a tablet
  could never put the sidebar away. On a touch screen it is always shown, at
  44 px, and the collapsed sidebar is 52 px wide to hold it.
- **ConfirmDialog stands on a solid ground.** Raised from the mixer it took
  the stage's glass (`#161b22` at 45%), so its text fell to 3.7:1 over a
  bright backdrop. The same colour now sits on `#0d1117`: 8.9:1. Not
  `light-dark()`: Lightning CSS polyfills it for the TV targets (Chrome 79)
  with variables the portal skin's inline `color-scheme` never sets, and the
  dialog came out transparent. `dark-stage-surfaces.spec.ts` now checks the
  ground is opaque, since its contrast helper reads no alpha.
- **Merged with a merge commit.** GitHub refused the rebase merge twice ("This
  branch can't be rebased"), the second time with the branch already on top
  of `main`, where a rebase is a fast-forward. A merge commit keeps the 116
  commits with their branch SHAs.
- **Not verified:** listening on real devices at ±2, ±4 and ±6, and Jam
  between two real devices (PR previews mock Jam signalling).
- **Known limitations:** with the key moved, the melody audition leads what
  is heard by the shifter's latency (about 120-140 ms); a key change made
  while paused leaves the offline contour in the old key until it is sent
  again; the realtime-fallback alignment uses the key at compute time; on a
  phone, where the vocal streams, Find my key names a key only for a song
  with stored notes; TV browsers (Chrome 79) do not compact the rail, which
  has no container queries there.

### Web: the separator moves to the CPU when the graphics card stops answering (#1031)

- Chrome's GPU watchdog ended the owner's GPU process twice on 15 October,
  mid-setup. `vocal-separator.worker.ts` fell back to WASM only when
  `InferenceSession.create` threw. A hang never settled, so the panel sat at
  "Loading the separator..." for good.
- The worker posts `gpu-start` after the download, and hands ORT an adapter
  whose `requestDevice` is wrapped to post `gpu-lost`
  (`ort.env.webgpu.adapter`, in the JSEP build). The main thread allows 60 s
  of GPU setup (`GPU_SETUP_LIMIT_MS`) and limits nothing after it.
- On a loss or the limit it replaces the worker, starts on the CPU and says
  "The graphics card didn't answer in time, so the separator switched to the
  CPU. It's slower, but it will finish."; the page then keeps the CPU
  (`gpuUnavailable`). A loss mid-run waits 20 s for the worker's `provider`
  message (`GPU_LOST_GRACE_MS`), then fails the run with a retry that runs on
  the CPU. Messages from a replaced worker are ignored.
- The notice goes through `showUvrModelNotice` (uvr-store), so lib imports no
  store. Eight tests in `vocal-separator-gpu-fallback.test.ts`.

### Web: the rooms' mic says when it listens (#1028)

- One mic control in the room kit (`MicButton`,
  `src/components/room-kit/mic-state.ts`) with four states: ready (closed; a
  tap starts a take, and the only state that moves by itself), wait (open,
  not your turn), sing (open, your turn; the ring follows the voice) and done
  (closed, at a result). Each room names the state from its own phases.
- On the web this reaches Long note, which waits through the cue note and the
  mic opening and sings while it listens for the note and the hold. Echo, Lip
  roll and Ng slides are premium rooms, which reach no web build.

### Web: a TV remote's D-pad, and a browser with no microphone (#890)

- Up and Down stepped the playback speed on every tab but Karaoke and
  cancelled their default. On a TV they are the remote's D-pad, the only way
  focus moves between rows; there (`isTvDevice()`, or `?device=tv`) the speed
  keys now leave them to the page.
- Where a page has no `navigator.mediaDevices` (an insecure origin, some
  embedded views, some TV browsers), the singer read "Cannot read properties
  of undefined". It is classified as no-device now: "This browser cannot use
  a microphone."
- `docs/plans/tv-apps-and-phone-mic.md` plans store apps, the remote and the
  phone as the microphone, and stale plan and code records were brought up to
  date.

### Web: install screenshots from demo data (#856)

- The PWA install screenshots were regenerated from demo data. Found after the
  merge: the Path screenshot says "Day 3 of 7" on the map and "Day 4 of 7" on
  the card.

### Mail: wordmark v2 (#1008)

- New mail points at `/email/wordmark-v2-2x.png`, which shipped with
  v0.9.18's static deploy. Merged and deployed to the prod mail worker after
  that tag (run 38778660613).

### Tooling: app-check (#1029)

- A skill (`.claude/skills/app-check`) that walks the app in a browser and
  measures what the owner would check by hand: layouts and features, with a
  release's own cases read from `scripts/release-<version>.mjs`.

### Rooms: the clock waits for a room's last note (#1035)

- The four rooms (Echo, Lip roll, Ng slides, Long note) take the app's one
  AudioContext through `useExerciseCapture`. In the phone app, a room gave
  its lease back the moment its screen went, while its sound still faded
  over the house release (180 ms of decay, 60 ms more before the source
  stops). The last lease out parks the clock 120 ms later, so the clock kept
  the rest of the fade for the next room's first tap. The lease now outlives
  the screen by `ROOM_TAIL_MS` (250 ms) and answers `prepareToSuspend` with
  what is left of that tail.
- On the web there is no lease (`nativeDeviceApi` is the native shell's), so
  what changes there is the room's own notes. `playTone` keeps a handle
  (`startReferenceTone` in place of `playReferenceTone`), and `release()`
  (the room left, or a start given up) stops a note still sounding over the
  house release. Before, nothing stopped it, and Long note's note played on
  to its end after the room was left. A note asked for while the clock
  unlocks is dropped when the room was released in the meantime.
- Tests in `useLongNoteCapture.test.ts` and the phone app's
  `premium-rooms-audio.test.tsx`. MISTAKES.md records the trap: a lease's
  `release()` never asks `prepareToSuspend`, so answering it alone fixes
  nothing.

### Native only (#1033, #1034)

- **#1033:** Lip roll's demo buzz at the rooms' loudness, every room sound
  through one output held at gain 1, a hint in the bar while the phone's
  volume is low, and an `AudioOutput` plugin for the Developer screen's Audio
  section. Its web build is byte-identical to its base.
- **#1034:** a light at the point of contact while the voice is on the note
  in Lip roll and Ng slides, each arch's top note named under its crest, a
  stop between arches, and the moon's drift to storyboard screens 2 and 3.

### Repo

- `.github/FUNDING.yml` (#1030).
- This release PR points `docs/plans/tv-apps-and-phone-mic.md` at today's
  lines and closes BUGS.md's seek bar entry.

## [0.9.18] - 2026-10-15

117 commits since `v0.9.17` (543f43c6c) before this release PR: PRs #908,
#1002 to #1007 and #1009 to #1026. Every commit came through a PR; none
reached `main` without one. Of the 62 on `main`'s first-parent line, 15 are
PR merge commits, 44 are the commits #1006 (4), #1007 (19), #1009 (5), #1014
(3), #908 (8), #1004 (2) and #1018 (3) rebased onto `main` instead of
merging, and 3 are the squash commits of #1010, #1019 and #1026. The owner decided
on 15 October to release `main` as it stands: the key change and the mixer
rail (#857) are not in 0.9.18 and go in 0.9.19.

On the web, the release is the launch offer's terms beneath the gift (#1014),
a foot of the screen that stacks instead of hiding under the cookie banner
(#1009), share cards and copy that say only what the tools do, in American
spelling (#1007), mails that stay dark in Gmail on the iPhone (#1010,
#1006), and the compact UI audit's fixes for focus rings, contrast, the
control font and small screens (#908), and page titles that fit a search
result, with snippets that no longer promise where audio goes (#1018).
Release tags now walk the guided
tours in their own workflow instead of running PR Gate (#1004), and PR
Gate's lint step has the memory to finish (#1026). Most of the
commits are the premium exercises, which reach no web build: Echo's art
rounds 5 and 6, its demo and Merc's recorded voice; the glide engine; and Ng
slides and Lip roll, each a room and a demo on stand-in art. The native apps
keep their own versions and tags; what reaches them is listed under
`native-mercurypitch` and `native-besidecue`.

### Release steps (prod)

1. **No migration, secret or worker variable.** Nothing under
   `workers/db-worker/migrations` and nothing in
   `workers/db-worker/wrangler.jsonc` changed since `v0.9.17`. The tag's
   `deploy-db-prod` deploys the worker halves of #1006 and #1010 (the mail
   layout) and #1014 (the featured code's `offer`). The order of the two
   deploys does not matter: an app that lands first gets no `offer` and shows
   the gift alone (`withReadableTerms` in `billing-service.ts` reads a
   missing `offer` as none), and the old app ignores the field.
2. **Walk the tours on `main` before the tag (#1004).** prod-upd step 4
   dispatches Release Tours (`release-tours.yml`) on `main` and stops on a
   red run. The baseline is 0 misses: v0.9.15, v0.9.16 and v0.9.17 each
   walked 144 desktop and 127 phone steps with none. The local `/tour-check`
   walk on `build:tours` is the fallback.
3. **Push the tag `v0.9.18`.** Build & Deploy runs as before, and Release
   Tours walks the tagged commit beside it: a red run there is an alert, not
   a block. PR Gate no longer runs on `v*` tags.
4. **#1008 stays out of this release.** It points new mail at
   `/email/wordmark-v2-2x.png`, which ships with this tag's static deploy
   (#1006). Merge it once
   `curl -sI https://mercurypitch.com/email/wordmark-v2-2x.png` answers 200;
   its change is in the DB worker, so it reaches prod with the next worker
   deploy. Until then every mail keeps wordmark v1.

### Migrations

None.

### Web and API: the launch offer, beneath the gift (#1014)

- `GET /api/billing/promo/featured` gains `offer`: the launch offer's terms
  for a claim of the featured code made today, from `finisherTerms` in
  `offer-rules.ts`, which uses the same window and goal functions as `/me`'s
  tracker. It is `null` while `OFFER_START_AT` is unset or not reached, and
  for a featured code other than `OFFER_PROMO_ID`. A claim on a later day
  (an email confirmed tomorrow) gets a later deadline, never an earlier one.
- The sentence lives once, `offerSentence` in `src/lib/launch-gift-copy.ts`:
  "Use all 5 by 28 October and your next credit pack comes with 30 extra
  credits." The count, the day (through `offerDay`, en-GB, UTC) and the bonus
  come from the terms; nothing is written into the app. The tracker's
  progress line uses the same function with "pack". The line hides once its
  day has passed and whenever the server sends `offer: null`.
- It shows on the Keep screen's gift card, the Map's join and one-tap claim
  lines, Karaoke Night signed out, the Voice Mirror's account ask, Settings ›
  Credits (signed out, and on the claim card until the code is claimed) and
  the password sign-up toast. The Promo pill and the Map's one-tap claim
  toast are unchanged, and the two claim toasts ("5 credits added." and
  "Email confirmed. 5 credits added.") leave the offer out: owner decision,
  14 October (7279a4088).
- Native: `assert-bundle.mjs`'s OFFER check passes, and "extra credits",
  "credit pack" and "Use all" appear 0 times in the native bundle.

### Web: the foot of the screen stacks, and the gift's toasts are seen (#1009)

- **Toasts over the cookie banner.** The owner signed up with Google from the
  onboarding Map on prod (v0.9.17) and saw no word of the gift. The toasts
  were raised; in a production build at 390 px with a European clock, the
  consent banner covered them. The banner only opens in a build with a
  Google tag on a European clock, so `pnpm dev`, `build:e2e` and CI never
  showed it (#1019 now shows it on dev and previews).
- **Every layer at the foot stands on the one below** (`src/lib/foot-space.ts`).
  Each publishes the room it takes on `<html>`: the banner stands on
  `--tabbar-space`, the confirm-email pill on `--consent-banner-space`, and
  the phone toasts on `--verify-banner-space` too. Measured before: the
  banner covered 46 px of the tab bar at 390x844 and 108 px of Karaoke
  Night's confirm pill, Resend and Dismiss included; with no banner a toast
  still covered 56 px of the pill. After: 0 px of overlap in 64 measured
  combinations (main app and Karaoke Night; 320x568, 390x844, 844x390 and
  1440x900; banner, pill and toast each on and off). The voice pill, the
  practice-timer pill, the mixer edit toolbar, the vocal remover's toasts,
  the jam chat bubble and guide dock and Merc's bottom corners stand on the
  banner as well. Desktop toasts sit top right and are unchanged.
- **Guitar Night and Drum Night read the claims.** A Google sign-up started
  in either room comes back with the gift claimed; their account chips now
  hand the account to `syncPromoClaims`, with each room's own line: "5
  credits added. Use them to separate the drums from a song." and "... the
  guitar from a song." Both rooms are web-only entries.
- Tests: `toast-above-consent-banner.spec.ts` (red before: toast bottom 780
  against a banner top of 668), `toast-above-confirm-bar.spec.ts`,
  `foot-space.test.ts` and `foot-stack-css.test.ts`.

### Web: share cards and copy that say what the tools do (#1007)

- **Seven share cards** (jam, karaoke, mirror, pitch-training,
  vocal-range-test, voice-type-test, which-singer) drop lines the about page
  dropped in Komediruzecki/disjoint-colliders#109 and pills the app does not
  back, and are re-stamped (`pnpm run og:versions`). The Jam entry page no
  longer says "one scoreboard for the whole room": a song room has none
  (`JamSongTimeline.tsx`), only drill rooms draw one. The voice type card
  says six voice types (`VOICE_TYPE_BANDS`), Singer Match says 31 singers
  (`legend-catalog.ts`), and the range FAQ says the Mirror measures a glide
  up and a glide down.
- **Voice type, not voice band** (owner). Every visible "voice band" now says
  "voice type", and each claim stays as `singer-match.ts` runs it: the range
  picks the type it overlaps most, the singer comes from that type, and the
  same range always gets the same singer. Nothing says the singer's own
  range was compared with yours. Identifiers and comments keep "band".
- **The intro's promise** reads "Four short tasks map your range and find a
  famous singer of your voice type." It said "Ninety seconds more"; the run
  is four tasks (`VOICEPRINT_STEPS`) with 66 timed seconds and four I'm
  ready gates.
- **"See your voice in 60 seconds"** (owner: fine as a hook though the visit
  takes a few minutes) frames the Mirror's meta and card, and the voice type
  card, Singer Match and a shared voiceprint's unfurl use the same framing.
- **American spelling** in the rest of the visible copy: recognize, colored,
  practiced, practice (verb), color and favorite. Ear Lab's faculty is
  "Color" on screen; every id, key and stored value keeps `colour`, and
  saved readings store only the drill id, so nothing needed mapping.

### Mail: light only, wordmark v2, tiles on phones, no cached misses (#1010, #1006)

- **`color-scheme: light only` (#1010)** in every mail where it said `dark`:
  welcome, confirm, fresh link, purchase, withdrawal, password reset,
  sign-in code, sign-up code, newsletter and account notice. In dark mode,
  Gmail on the iPhone recolored a mail that declares `dark`, and the white
  "Mercury" in the wordmark vanished into the white page; with `light only`
  it shows the mail as drawn (test mails of 14 October on real phones). The
  mails are still drawn dark. Because a client that honors `light only`
  gives uncolored text the light defaults, every picture's alt text now has
  a color, and every head carries `a[x-apple-data-detectors]` and
  `u + #body a` rules for auto-linked dates and addresses, with
  `<body id="body">`. `email-color-scheme.test.ts` renders every mail in
  `PREVIEW_MAIL_IDS` plus the five renderers it does not show.
- **Wordmark v2 (#1006)**: `public/email/wordmark-v2-2x.png`, v1 on a
  rounded plate in the page color `#010409`, made from v1 by
  `scripts/generate-mail-wordmark.mjs`. Nothing references it until #1008
  (release step 4).
- **Room tiles on a phone (#1006).** In the welcome and confirm mails a tile
  stopped at 263 px and left about 90 px of the card empty at 390 px. A head
  `<style>` makes a tile full width below 600 px and splits two evenly from
  600 px; Outlook for Windows gets an `[if mso]` table. A client that drops
  the `<style>` keeps the inline 263 px. `twoUp()` and `COLUMN_CLASS` are in
  `email-layout.ts`.
- **A missing mail picture is never cached (#1006).** `public/_headers`
  gives `/email/*` a year of immutable caching, and the asset layer put it
  on a 404 too. `/email/*` is now in `run_worker_first` (`wrangler.jsonc`),
  and `src/worker.ts` passes the asset layer's answer through with
  `Cache-Control: no-store` on any status from 400 up. Existing files keep
  their immutable 200 and 304. The cost is one Worker invocation per mail
  picture fetch.

### Web: focus rings, MIDI contrast, tab labels, menu target and control font (#908)

From the compact UI audit:

- **Settings selects** wear a 2px accent outline at 2px offset on keyboard
  focus (4.72-8.20:1 against the panel in all nine presets).
  `.settingsRow select` restated the border after `select:focus` turned the
  outline off, which left only a 1.15-1.26:1 glow. The token contract now
  holds `--accent` at 3:1 or more against every app surface.
- **Karaoke's song upload zone** shows a 2px accent ring while its input has
  keyboard focus. The input covers the zone at opacity 0, so its own ring was
  invisible. Enter and Space still open the file picker.
- **The MIDI stem pill** draws its label in a new token, `--stem-midi-fg`
  (#8b5cf6's hue, its lightness moved per preset: `#ac8bf9` dark, `#b090f9`
  Forest, `#5d1cf2` Light): 5.46-6.69:1 at rest and 5.07-6.19:1 on hover,
  where every preset was at 4.16:1 or less before.
- **Form controls in the app font.** The base reset sets
  `font-family: inherit` on button, input, select and textarea (the family
  only: the `font` shorthand would pull the page's size in). Arial controls
  went from 32-87 a view to 0; no control grew more than 7 px wide, and no
  view gained overflow. The CSS contract fails if the rule goes or becomes
  the shorthand.
- **Community's tabs on a phone.** Below 480 px a tab drops its icon, uses a
  narrower count chip and no longer ellipsizes, so "Melodies" and "Sessions"
  stay whole at 320, 360 and 390 px. At 200% text the bar takes a second row.
- **The song card menu** takes taps across 46x46 on a coarse pointer, through
  a transparent box 7 px beyond its 32x32 border. Mouse pointers keep 32x32.
- **The onboarding primary button** keeps the pixel it rose from while lifted
  on hover, so a pointer resting in its bottom pixel no longer makes it
  shake. The app font moved First Light by 1 px into exactly that band.
- `src/e2e/ui-audit-regressions.spec.ts` holds six browser regressions, each
  shown to fail with its CSS fix removed.

### Web: titles that fit a search result, snippets without device claims (#1018)

Three commits from the SEO recheck of 14 October; the owner approved the
titles and snippets on 15 October.

- The prelude logo has `alt="MercuryPitch"` on every entry document and
  `index.html`. Every entry document gets `twitter:image:alt`, the same text
  as its `og:image:alt`, and the shared-voiceprint rewriter swaps it along
  with the image. `/exercises/<slug>` still answers 200, now with
  `X-Robots-Tag: noindex`, since each slug served the home document under
  another URL. Meta keywords are gone and `imageAlt` is required in the
  model. The Organization node takes the landing's `@id`, a PNG logo and the
  landing's YouTube and X accounts. `/glass` declares its card's real size,
  1200x670.
- The home `<title>` and 14 page titles use a colon instead of an em dash and
  fit a search result, 47 to 59 characters. The home title is now
  "MercuryPitch: Free Singing Practice and Karaoke Online". `og:title` and
  `twitter:title` keep their wording, so a shared link still says "See Your
  Voice".
- Ten strings on six pages (4 descriptions, 5 X lines and 1 FAQ answer) no
  longer promise that audio never leaves the device; they end on "Free, in
  your browser." A test rejects that absolute wording in any description,
  card, X line or FAQ answer. The vocal remover's FAQ keeps "the file never
  leaves your machine", which is true of its default local path, and names
  the server option beside it.

### CI: Release Tours on web tags, not PR Gate (#1004)

PR Gate ran on every `v*` tag, against a commit `main` had already gated,
and failed there on Beside Cue's adventure jobs (v0.9.16: 45 failed; v0.9.17:
42 failed) that passed on `main`. `pr-gate.yml` loses its tag trigger. The
new `.github/workflows/release-tours.yml` runs the `/tour-check` walk in CI
(`build:tours` with LFS hydrated, `serve dist`, `scripts/walk-tours.mjs`),
desktop and phone as two parallel jobs, on `v*` tags and by
`workflow_dispatch`. Each missed step becomes an error annotation and a line
in the job summary, and the logs are uploaded as `guided-tours-desktop` and
`guided-tours-mobile`. A walk takes about 5 minutes and a job about 7, so it
runs beside the deploy, not in front of it: the blocking walk is the
dispatch before the tag (release step 2). `mp-v*` and `bc-v*` tags start the
same workflows as before.

### CI: room for ESLint in PR Gate (#1026)

`eslint src` ran out of Node's default heap of about 4 GB in PR Gate's Lint
and typecheck job: on main push runs 38719559931 and 38708038077, and on the
first attempts of #908, #1004 and #1018. On `main`'s tree it peaks at about
6.2 GB. That step now sets `NODE_OPTIONS=--max-old-space-size=8192`; GitHub's
runners for public repositories have 16 GB.

### Web, dev and PR previews only: the cookie bar with no Google tag (#1019)

`build:dev` sets `VITE_CONSENT_PREVIEW=true`, and `CONSENT_PREVIEW` in
`src/lib/defaults.ts` is true only for a development-mode build with it, so
the dev deploy and PR previews show the bar by production's rules, store
`mp.consent.v1` and publish `--consent-banner-space`, with no gtag.js, no
`gtag` and no `dataLayer`. The tag build runs `pnpm run build` and cannot
turn it on, even with the variable in the shell; a build with a tag ignores
the flag. To be asked again on dev, clear `mp.consent.v1` or open Settings ›
About › Cookie settings.

### Shared code: the pitch detector's history (#1024)

`PitchDetector`'s stability filter history (`packages/pitch-engine`) starts
as a list of doubles and is only emptied and refilled in place, including on
a confirmed note change. An empty `[]` changed kind on its first reading, and
V8's compiled YIN pass dropped to the interpreter during a take's first
voiced frames. Output is unchanged: four recordings fed frame by frame
through both detectors gave 0 different frames in 6280 (48 kHz) and 6835
(44.1 kHz). On its own it does not remove the first voiced frame's stall.
This file runs everywhere the detector does: the web, Mercury Pitch and
Beside Cue.

### Premium exercises, native test builds only: Echo, the glide engine, Ng slides, Lip roll and Long note (#1002, #1003, #1005, #1011 to #1013, #1015 to #1017, #1020 to #1025)

None of them reaches the web. `PREMIUM_EXERCISES` is `KARAOKE_IMPORT`, true
only in a native test build (`src/lib/native-build.ts`); the Sing room's
exercise row and picker are lazy imports behind it, and a store build folds
them out (`assert-bundle.mjs` Stage 2). **Ng slides and Lip roll are work in
progress: every one of their 17 plates is a stand-in** (`standIn: true` in
`bridge-geometry.ts` and `bay-geometry.ts`), drawn from the measures until
the paintings exist, and neither has tablet layouts. The owner chose to ship
them in that state for the native test builds. `STAND-INS.md` in each room
says how a painting replaces its stand-in without a code change.

- **Echo.**
  - Art round 5 (#1002): new phone result plates, a lopsided celebration
    star with blotches, 26 sparkles along the chains, per-link ribbon gains,
    and a city light per state that crossfades over 1200 ms.
    `sync-echo-art.mjs` writes every number and stops on a crop or spec it
    cannot follow.
  - Merc's own voice (#1005): ten sustained "ooh" MP3s, F2 to F5 (257,720
    bytes), played by `merc-sampler.ts` (`MERC_CALL`), loaded on entering
    Echo; the synth sings any call the set cannot, or while it loads. These
    are development placeholders. `PREMIUM_VOICES` folds them out of a store
    build.
  - The demo (#1003): two takes through the room's real engine, "Not like
    this" and "Like this", with tooltips that each wait for the engine event
    they explain, then a "Your turn" end card. It plays by itself only on a
    first visit; "?" plays it again.
  - Art round 6 and the result's hitch (#1012): 15 phone files with the
    lamps painted out, a top light per state, and a celebration whose
    ribbon fields build in 4 ms slices between frames. Demo take 2's longest
    frame went from 83 to 100 ms to 16.8 ms; a real run's result still has
    one 33 ms frame from the result's own mount.
  - Pacing (#1016): TestFlight build 807 rushed the demo. Both takes now run
    on one clock with no 4x stretch, take 2 sings back at the call's pace
    (0.9 s a note) and every tooltip stays up at least 1.8 s. Take 1 lost its
    "Slid past it" tooltip; the demo is 19.1 s.
- **The glide engine (#1011, #1021).** `src/lib/glide/` is pure and
  unit-tested: the path (`glide-path.ts`), the fit to the newest voiceprint
  or the kept note (`glide-targets.ts`), `tickGlide` (lag and lead window,
  60 ms smoothing, coverage per arch, breaks, jumps and the Pro top), the
  metrics and `NG_SLIDES_LEVELS` / `LIP_ROLL_LEVELS`. #1021 fixed a
  Learning band of 100 c that equalled the reading clamp, so Lip roll's
  Learning lit any voiced frame: a band of a semitone or more now holds the
  reading to twice the band (`heldForBand`). Every Ng level and Lip's Singer
  and Professional read as before.
- **Merc's hum and ride (#1013, #1020).** `merc.set('hum')` closes his mouth
  and sends rings that follow the voice level; `ride` adds a lean that
  follows the sung pitch's slope (0.8 semitones/s dead band, full lean at
  6). Reduced motion stands him upright. `sim-pinned.test.ts` hashes every
  approved state, and every digest matched after the change. #1020 adds a
  `rings` switch, off in Lip roll.
- **Ng slides (#1015, #1017).** The bridge room: an intro, a count-in on the
  first root's tone, five slides fitted to the singer, the glass lit in
  strips as far as the engine's coverage, and a result that pulls back to
  the whole bridge with the lit share, a jumps chip and the best for the
  level. Stop, Back or leaving drops the take. The demo (#1017) hums two
  slides through the real engine (63.8 % lit, then 100 %), 18.84 s. Dev
  fixtures: `?ngFixture=intro|mid-take|demo-off|result`.
- **Lip roll (#1020, #1022).** The bay room, built as Ng's: three waves
  fitted to the singer, a ribbon that sheds bubbles and buzzes, waves lit
  where the voice followed, and a result with the share lit, a breaks chip,
  jumps when there were any, and the best for the level. The demo (#1022)
  buzzes two waves through the real engine with a 25 Hz level flutter
  (`LIP_FLUTTER`): 48.4 % lit, then 100 %, 22.44 s. Dev fixtures:
  `?lipFixture=intro|mid-take|demo-off|result`.
- **First frames (#1023, #1024).** Lip's first lit strip cost a 167 ms frame
  (both pictures decoded on the main thread in that frame's commit).
  `room-kit/canvas-picture.ts` decodes a canvas's pictures off the main
  thread with `createImageBitmap`, and wave 1's canvas (Ng: arch 1's glass)
  is made hidden before the run: the frame is now at most 50 ms, the
  detector's first voiced frame. `room-kit/result-band.ts` does the same for
  each room's result band, prepared as the last wave or slide begins: Lip's
  result went from 67 to 83 ms to 33 ms.
- **Long note (#1025).** The room takes `controller`, `still` and
  `onSettled` as Lip's and Ng's do, gains
  `?longNoteFixture=intro|rest|mid-take|demo-off|result`, and preloads its
  five lantern plates on the tap that opens it. Nothing visible changes:
  pixels compared SHA-identical before and after. The web's Long note is the
  older `src/features/exercises/long-note` and is untouched.
- Shared kits these PRs grew: the demo kit's take clock (`demo-plan.ts`), a
  `ready` wait and the scripted take; `playVoiceContour` in
  `src/lib/demo-audio.ts` gains `timbre: 'hum'` and `flutter`, both off by
  default, so every existing caller sounds as before. The fixtures are read
  in `apps/mercurypitch/src/main.tsx` behind `import.meta.env.DEV`, and no
  fixture string is in a production bundle (#1025).

### native-mercurypitch

Six tags since `mp-v0.8.22`, each the merge of a premium-exercise PR, and
Mercury Pitch Mobile built every one: `mp-v0.8.23` (34e62d5e4, the merge of
#1003) carries #1002, #1005 and #1003; `mp-v0.8.24` (8422fec07, #1012) adds
#1006, #1010, #1011 and #1012; `mp-v0.8.25` (64bbe1835, #1016) adds #1013,
#1015 and #1016; `mp-v0.8.26` (0991af43a, #1017) adds #1007, #1009, #1014
and #1017; `mp-v0.8.27` (e8f35a07d, #1021) adds #1020 and #1021; and
`mp-v0.8.28` (165be6475, #1023) adds #1022 and #1023. #1019, #1024,
#1025 and #908 merged after it and arrive with the next `mp-v` tag; #1004
changed only CI and the prod-upd skill. #974's own
changes, the 0.9.17 release notes and version, arrived with `mp-v0.8.23`.

These tags were not matched against the native bundle line by line, as
0.9.17's were. What each PR's own checks say:

- **Premium exercises**: Echo's round 5 and 6 art, its voice and demo, Ng
  slides and Lip roll with their demos, and the result bands and Long note's
  preload (#1024, #1025, next tag) are in a test build only. Each PR ran
  `assert-bundle.mjs` on a dev target and a store target
  (`MERCURYPITCH_API_TARGET=production`); the store build carries none of
  them.
- **The launch offer line (#1014)** is not in the native bundle: the OFFER
  check passes and its words appear 0 times. #1009's Guitar Night and Drum
  Night lines are in web-only entries.
- **Mail (#1006, #1010)** reaches every installed build the same way, with
  this release's worker deploy.
- **#1024's detector change** reaches the next tag's build of every room, and
  its output is unchanged.

### native-besidecue

No file under `apps/beside-cue` or `packages/glass-game` changed since
`v0.9.17`. The one change in a package Beside Cue depends on is #1024's
`packages/pitch-engine/src/pitch-detector.ts`, whose output is unchanged
(above); the next Beside Cue build carries it. It was not checked against
Beside Cue's bundle.

## [0.9.17] - 2026-10-14

424 commits since `v0.9.16` before this release PR, #974: PRs #858, #898,
#947, #957 to #973 and #975 to #1001. Every commit came through a PR; none
reached `main` without one. Of the 97 on `main`'s first-parent line, 35 are
PR merge commits, 59 are the commits #947 (5), #898 (15), #991 (5), #993 (2),
#858 (1), #997 (7), #998 (6), #999 (14) and #992 (4) rebased onto `main`
instead of merging, and 3 are the squash commits of #963, #980 and #995.
The release is the launch gift (LAUNCH claimed at email confirmation, 30 extra
credits on the next pack for using all five) and the legal and money
compliance work that has to ship with it: the 14-day withdrawal for credit
packs, refunds and disputes applied exactly once, consent that waits for a yes
in the EEA, retention sweeps, and the legal links. It also brings the
voiceprint-first intro (#977, polished in #981), the compact sign-in sheet
(#979) and the Voice Mirror's account offer and start screen (#978, #983),
so the launch traffic meets all of them. Fixes merged on 13 October ride
along: sessions that stay signed in past their first month (#991), the
Community and Karaoke fixes from the UI audit (#898), time labels that no
longer read 2:60 (#947), a guided exercise that keeps its clip and Zen
steadiness that leaves out a few tracker slips (#994), an unpublish that
works after another device took the share down (#995), and Drum Night's
sign-in sheet with its own type and links (#980). The same day brought three
follow-ups from the database audit: exact column names in the generic API,
weekly leagues that advance past their first cut and hidden league members
kept anonymous (#997); reads that return every row, creates that land once,
and one row per setting and per challenge, enforced by migration 0070
(#998); and sign-in, sign-up, 2FA and weekly races closed, with each singer's
progress kept apart on a shared device (#999). It also brought two small
features: coming-soon store chips on the voiceprint results and the Map
(#963), and Karaoke Night links that name their song (#993). #992 followed
on 14 October: Community's shared-session links open as read-only result
summaries, and a dependency update clears 45 critical and high alerts. The
native apps keep their own versions and tags; what reaches them is listed under
`native-mercurypitch` and `native-besidecue`.

### Release steps (prod)

The order matters. Each step names the PR that asks for it.

1. **Seller details on the prod worker (#968, #976).** Set the `TRADER_NAME`
   and `TRADER_ADDRESS` secrets (full geographic address with country) on the
   prod db-worker with `wrangler secret put --env prod`; since #976 they are
   Worker secrets, not `wrangler.jsonc` vars. `scripts/assert-prod-trader-details.mjs`
   reads `wrangler secret list --env prod` and runs in three places, all for
   prod only: the `check-seller-details` job that opens `deploy-db.yml` (the
   Jam worker job needs it and the DB worker job needs the Jam job), a step of
   the same name in the DB worker job before the D1 backup, and a step in
   `build.yml`'s `build-and-deploy` before the website is built. Until both are
   set, the tag and a prod dispatch of `deploy-db.yml` deploy nothing.
   `TRADER_VAT_ID` may stay unset; it only drops the VAT sentence.
2. **Stripe live mode, Terms of service URL (#968).** Settings › Public
   details › Terms of service URL: `https://about.mercurypitch.com/terms`.
   `consent_collection[terms_of_service]=required` needs it, and without it
   every pack checkout fails with "Could not start checkout". The Terms
   section `#withdrawal` arrives with the landing in step 5.
3. **#970 and #975 merged on 10 October**, so `main` holds every migration
   below.
4. **Run Deploy DB Worker with `environment: prod` from `main`, before the
   tag (#965).** It backs up D1, applies the migrations below, and deploys
   the Jam worker and then the DB worker. On the tag, `deploy-db-prod` and
   the website deploy run side by side; an app that sends the Google return
   nonce before the worker echoes it refuses every Google sign-in until the
   worker lands. A worker deployed first breaks nothing: the old app sends
   no nonce and gets the old redirects. It also lets in the new funnel
   events: `cta_account_click` (#978), the four `onboarding_map_door_*`
   (#981) and #963's six store-chip clicks (`results_app_store_click`,
   `results_google_play_click`, `free_sing_app_store_click`,
   `free_sing_google_play_click`, `onboarding_map_app_store_tap` and
   `onboarding_map_google_play_tap`); a site that lands first loses only
   those beacons (a 400 each).
5. **The landing is already live: `mp-v0.1.32` (disjoint-colliders #99,
   #100 and #104) went out on 13 October, before the worker.** Its Terms
   section `#withdrawal`, which the checkbox, the footnote and both mails
   link, and its privacy notice, whose deletion periods the retention sweep
   (#969) enforces, describe this release until the tag goes out. Its
   example-song links (`?song=`, #993) load their song from this release on;
   the old app opens Karaoke Night without it.
6. **Stripe webhook events (#970), after the worker deploy.** The live
   endpoint must send eight types. Add `charge.dispute.closed`,
   `charge.dispute.funds_withdrawn`, `refund.failed` and `refund.updated`.
   Keep `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `charge.refunded` and
   `charge.dispute.created` (#961 asked for the last three). Do not add `charge.refund.updated`: Stripe deprecated it, and the
   worker acknowledges it without acting. A type the endpoint does not send
   is still applied by the sweep within six hours, with a "Sweep recovered N
   missed event(s)" alert each time. Re-running 0065's `UPDATE` by hand
   right after the deploy is optional (owner decision).
7. **Push the tag `v0.9.17`.** `deploy-db-prod` runs again and finds no
   migration left to apply. Once the site is live,
   `curl -sI 'https://mirror.mercurypitch.com/?v=x'` answers 301 with
   `location: https://mercurypitch.com/mirror?v=x` (#978). The tag's deploys
   are the first prod runs of wrangler 4.150.0 (#992); the dev deploys of the
   app and the DB Worker ran it on 14 October.

If `STRIPE_SECRET_KEY` is a restricted key, it needs read access to Charges,
Refunds, Disputes, Events and PaymentIntents (a withdrawal finds its charge
through the PaymentIntent), on top of the refund writes #968 makes. Without
one, Stripe answers 403: the webhook answers 500 so Stripe retries, the
sweep's "could not apply" alert names the read that failed, and a withdrawal
keeps its price pending.

`BILLING_ALERT_EMAIL` must stay set on prod: nothing is given up, escalated or
handed over until Resend has taken the owner's alert, and the alert goes to
this address. Since #975 a chargeback event answers 500 while it or
`RESEND_API_KEY` is missing, so Stripe keeps sending it until both are set;
both are set on dev and prod (names checked 10 Oct). The promo email
records are keyed with `FREE_SONG_EMAIL_SECRET`; without it, claims stay
bounded per account only.

### Migrations

Prod ran `0055` with `v0.9.16`, so this release brings fifteen. `wrangler d1
migrations apply` runs the files it has not recorded in file-name order:

| Migration                                | PR   | What it does                                                                                                                |
| ---------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `0056_confirm_reminder_sends`            | #960 | `confirmReminderSends (campaign, userId)`: one fresh confirm link per account, ever                                         |
| `0057_promo_email_claims`                | #961 | `promoEmailClaims`: a keyed HMAC of the confirmed address per promo claim, kept after the account goes                      |
| `0058_ledger_payment_intent`             | #961 | `creditLedger.paymentIntentId` and its index, so refunds and disputes find what a payment granted; not back-filled          |
| `0059_offer_unlocks`                     | #961 | `offerUnlocks`: the moment an account earned the launch reward, written once                                                |
| `0060_checkout_consents_and_withdrawals` | #968 | `checkoutConsents` (one row per paid pack) and `withdrawals` (one statement per pack, `purchaseId` UNIQUE)                  |
| `0061_withdrawal_refund_tracking`        | #968 | `withdrawals.refundBasis`, `priceSource`, `stripeRefundStatus`; index of unsent purchase mails                              |
| `0062_withdrawal_sweep_attempts`         | #968 | `refundTriedAt`, `refundEscalatedAt`, `mailAttempts` for the sweep                                                          |
| `0063_retention_sweep_indexes`           | #969 | `createdAt` indexes on `mirrorEvents` and `funnelAcquisition`, `windowStart` on `auth_ratelimit`; changes no rows           |
| `0064_stripe_charges`                    | #970 | `stripeCharges`: what Stripe last said of a charge money went back on, one row per PaymentIntent                            |
| `0065_reapply_money_back_events`         | #970 | renames refund and dispute events v0.9.16 recorded without applying to `reopened:<type>`, so the first sweep applies them   |
| `0066_withdrawal_mail_outcomes`          | #968 | `mailError`, `mailWarnedAt`, `refundHandedOverAt`; partial index `idx_checkoutConsents_open`                                |
| `0067_chargeback_alerts`                 | #970 | `chargebackAlerts`: one row per dispute once its chargeback alert is raised, so a later event does not raise it again       |
| `0068_withdrawal_refund_failure_claims`  | #970 | `withdrawals.refundFailureClaimedAt` and `refundFailureClaimedBy`: the delivery that claims a failed refund tells the owner |
| `0069_chargeback_alert_claims`           | #975 | `chargebackAlertClaims`: the delivery that claims a dispute mails its chargeback alert; deleted once told or refused        |
| `0070_natural_keys`                      | #998 | unique `(userId, key)` on `userSettings` and `(userId, challengeId)` on `challengeProgress`, after merging duplicates       |

Dev applied them in merge order instead (0056; 0057 to 0059; 0063; 0060 to
0062 and 0066; then #970's 0064, 0065, 0067 and 0068; then #975's 0069;
then #998's 0070). #968 checked that 0066 applies cleanly in every order a
D1 can see. The deploy applies the migrations before it deploys the worker,
so 0065 has run when the old worker gets its last events.

0070 sets the rollback order (#998). This release's worker upserts on 0070's
unique indexes and does not run without them: against a database restored to
before 0070, every `userSettings` and `challengeProgress` create answers 400
until the worker goes back. The v0.9.16 worker runs on either schema; with
0070 kept, only a create that meets an existing setting or challenge row
answers 400, and the stored row stays as it was. So roll the worker back
first (Deploy DB Worker on `v0.9.16`, environment prod), then restore the
database if it has to go back. The "Rollback story" comment in
`deploy-db.yml` names only the restore command.

### Web and API: the launch gift and the finish-five reward (#961, #966)

- **Auto-claim.** `claimLaunchGift` runs wherever `emailVerified` becomes 1:
  the confirm link, a mailed code, a sign-up code, the reset link, and a
  Google or Apple create or upgrade. The redeem route's claim moved to
  `promo-claim.ts`, so all three ways of claiming share one batch.
  `/api/billing/me` adds `promoClaims`. The singer hears about it in a toast,
  never by mail.
- **One claim per inbox (#966).** `promoMailbox` keys `promoEmailClaims`:
  plus tags fold at every provider, dots fold at Gmail only, and
  `googlemail.com` reads as `gmail.com`. The same key serves the gift claim
  and the once-per-address `offer-bonus`. The free song's email records keep
  the plain form, so production's rows still match.
- **The reward.** An account that uses all 5 launch credits within
  `OFFER_FINISHER_DAYS` (14) of the claim earns `OFFER_BONUS_CREDITS` (30) on
  its next pack, any pack, with nothing created in Stripe. The moment it is
  earned goes in `offerUnlocks` and is never revoked; the reward has no
  expiry. Checkout
  carries `metadata[offer]`, `metadata[bonusCredits]` and the line "Your
  launch offer adds 30 extra credits to this pack.", and the webhook writes
  an `offer-bonus` ledger row on the same PaymentIntent. The purchase mail
  gets one line when the bonus applied.
- **`OFFER_START_AT`** is `2026-10-09` on dev and `2026-10-12` on prod, read
  as a UTC day. Accounts that claimed earlier count their 14 days from it.
  It must not be later than the day the release goes out, because credits
  spent before it do not count: if the tag moves to Saturday 10 October, set
  `2026-10-10` in the release commit. Keep it set after launch; unset, the
  reward is off, earned ones included.
- **Paid checkouts only.** Credits are granted only when `payment_status` is
  `paid`, and `checkout.session.async_payment_succeeded` grants a delayed
  payment. Grant rows carry the PaymentIntent id (0058). #961's clawback on
  `charge.refunded` and `charge.dispute.created` is replaced by #970's rules.
- **UI.** Keep shows the gift card beside the account ask with one button,
  "Create my free account", and "Not now" at the top right; with no promo
  featured it shows three rows (voiceprint, progress, leaderboard). The
  welcome has one centred "Sing one note", and the only skip is the X at the
  top right (accessible name "Skip the intro", 44 px); `onboarding_skipped`
  fires from the same handler. The Map tags Karaoke "Launch gift" (#977).
  Karaoke Night has a signed-out gift line. The header's Promo pill hides
  once the account has claimed. A progress block ("Launch credits, 2 of 5
  used") shows in Karaoke Night, the Karaoke tab and Settings › Credits, and
  the reward sheet opens once per account in a browser. New events:
  `onboarding_keep_gift`, `onboarding_map_gift_tap`, `karaoke_gift_signup_tap`,
  `promo_claimed`, `offer_progress_view`, `offer_unlocked_view`,
  `offer_packs_tap`.
- **Web only.** The native Vite config drops the gift and offer modules
  (`LAUNCH_OFFER`), and `assert-bundle.mjs` fails a native build that
  carries the offer's words or storage keys. `GiftIcon` sits beside
  `CreditCoin`, out of the shared icon chunk, which kept Drum Night's first
  paint under its 520,000-byte budget.

### API and web: the 14-day withdrawal for credit packs (#968)

- **One switch for new checkouts.** `WITHDRAWAL_MODE` is `refund_unused`
  (the default, also for unset or unknown values) or `waiver`, in both
  blocks. The app reads it from `GET /api/billing/pricing`. Each pack keeps
  the terms its own checkout recorded; a pack with no ticked box on record,
  every pack bought before this release included, is `no_consent`.
- **Checkout** (packs only, never donations) requires the
  `terms_of_service` box, worded per mode in
  `workers/db-worker/src/withdrawal-wording.ts` (version `wd-2026-10-v1`),
  with "Your credits are added as soon as you pay." above the pay button.
  `checkoutConsents` records the session, mode, wording version, what Stripe
  reported of the box, the price paid and the purchase mail's fate. A paid
  pack without the box is granted anyway, logged and alerted once.
- **A consent stands once its mail has gone.** `consentTerms` reads a pack's
  recorded terms only when its purchase mail is `sent`; until then the pack
  is `no_consent` and cancellable for the whole price (CRD Art. 8(7),
  14(4)(b)(iii), 16(m); open for the lawyer). The purchase mail gains a
  "Your right to cancel" panel and a seller line from the `TRADER_*` settings.
- **The function.** `GET /api/billing/withdrawals` lists what can still be
  withdrawn, with its refund and basis (`unused` or `full`); `POST` takes
  `{ purchaseId, name, email }`. Settings › Credits shows it at the top only
  while there is something to show ("Withdraw from contract here", then
  "Confirm withdrawal"). Names with a link or an address in them get 400.
  Rate limit `billing-withdrawal`: 10 per 5 minutes per account.
- **The rule** (`withdrawal-rules.ts`). Only paid credits are refundable.
  Spending counts in the order it happened: free credits first, then paid
  credits oldest pack first, then a pack's bonus. Refund = amount paid x
  unused paid credits / paid credits, rounded down to the cent; `full`
  refunds the whole amount paid. The window is 14 days from the day the
  credits landed, by the calendar in Croatia, plus `WITHDRAWAL_GRACE_WEEKDAYS`
  (3) weekdays, open until the last day has ended at UTC-12. Mails and the
  Terms keep "14 days".
- **The refund** is partial, `reason=requested_by_customer`, with
  `Idempotency-Key: withdrawal-<statement id>`, priced from
  `checkoutConsents` or the PaymentIntent's `amount_received`, never the
  catalogue. Only a definitive 4xx (not 409 or 429) is final and goes to the
  owner to refund by hand; anything else stays `pending` for the cron, which
  looks for the refund by metadata before it asks again. A refund still open
  after 5 days alerts once, and after 11 days is handed to the owner with the
  14th day as its due date.
- **The cron** (`17 */6 * * *`, after the retention sweep) runs five duties
  in batches of 10: unsent acknowledgements, pending refunds, refunds Stripe
  has not finished, refunds to make by hand the owner has not heard of, and
  unsent purchase mails. `mail-answer.ts` tells an unknown outcome (sent
  again under the same key, owner told after 3 days) from a refusal of the
  mail itself (given up once the owner's alert goes).
- **Account deletion waits** (`withdrawal-hold.ts`): `DELETE /api/auth/me`
  answers 409 while a withdrawal still owes a refund or an acknowledgement,
  and every statement of the deletion batch carries the same guard.
- Known limitations and open lawyer points are in #968's body.

### API: refunds and disputes applied exactly once (#970)

- **One handler.** The webhook and the 6-hourly sweep both call
  `applyStripeEvent`, which skips an event `billingEvents` has recorded and
  records it only after it applied. Each event reads what Stripe reports now
  (`GET /v1/charges/:id`, its refunds, its disputes), never the event's copy,
  so late or out-of-order events land on the same answer; the read is kept in
  `stripeCharges`.
- **Settle to a target.** Refunds and disputes hold `floor(granted x gone /
paid)` of a payment's credits, pack and launch bonus together. Each event
  writes one ledger row keyed `clawback:<event id>`; a refund that failed or
  was canceled is keyed `clawback:refund-ended:<refund id>`. A chargeback
  holds its share from the moment it opens; an inquiry holds nothing until
  `charge.dispute.funds_withdrawn`. `won`, `warning_closed` and `prevented`
  give back, `lost` keeps.
- **With withdrawals.** Withdrawal rows count as already taken, a
  whole-price withdrawal settles the payment and keeps what an earlier
  refund took back, and a purchase with no consent on record never loses the
  credits its buyer used. A pack is settled while a
  chargeback holds its money or refunds returned its whole charge. A
  withdrawal never refunds past what the charge still holds, read from
  Stripe before the promise and before every attempt. A withdrawal's own
  refund that fails or is canceled reaches `markWithdrawalRefundFailed`
  through `refund.failed` and `refund.updated`.
- **The sweep** lists events from the last 30 days, up to 10 pages of 100,
  with one `billingEvents` query a page, and applies at most 25 refunds and
  disputes a run. After 0065 it reapplies the reopened events in one
  "Reapplied N event(s) after migration 0065" summary.
- **Alerts.** `charge.dispute.funds_withdrawn` tells the owner of a
  chargeback unless the dispute's `created` event already did
  (`chargebackAlerts`, 0067), so an inquiry that turns into a chargeback is
  no longer silent. A failed withdrawal refund is told once per statement:
  the delivery that claims it sends the alert (0068), and a failed send
  releases the claim and answers 500, so Stripe delivers it again.
- An account's pack list reads its charges with one bound value
  (`json_each`), so it no longer fails past D1's 100 bound parameters.
- Log lines mask email addresses, including those in Resend's and
  Google's error text: any script, every character RFC 5322 allows before
  the `@`, quoted local parts and address literals.
- Other alerts stay best-effort: a send that fails at the wrong moment loses
  that alert, and Stripe's own dispute emails are the backup. #975 makes the
  chargeback alert retry; the rest are follow-ups in #975's body.

### API: chargeback alerts that arrive (#975)

The second review of #970 found four Low defects. This fixes them, and
what #975's own review found.

- **A refused chargeback mail is sent again.** `chargebackAlerts` records a
  dispute only once Resend has taken its mail. A refusal records nothing
  and answers 500, so Stripe delivers the event again. The mail goes when
  there is no row yet, not when the ledger moved, because a redelivery
  finds the ledger already moved.
- **One mail per chargeback.** Stripe sends `charge.dispute.created` and
  `charge.dispute.funds_withdrawn` together for a dispute that opens as a
  chargeback. A delivery claims the dispute in `chargebackAlertClaims`
  (0069) before it mails, as #970's withdrawal claims do: the same event
  answers 500 while its twin holds the claim, another event leaves the mail
  to it, and a claim older than 10 minutes is taken over. The other event
  mails only when its own ledger row moved credits after the alert's row.
- **A claim given back untold is not lost.** A delivery that finds the
  claim released with nobody told answers 500, so Stripe's redelivery
  mails. Before, it answered 200 and the owner never heard. #970's
  failed-refund claim had the same race and gets the same fix.
- **A redelivered alert reports the balance its own row left**, not one a
  later purchase changed.
- **Masking in logs** takes time linear in the text: every measured 50 KB
  text masks in under 8 ms, where main took up to 1.7 s. A local part of
  any length is masked whole, and so are quoted local parts and address
  literals, except two shapes RFC 5321 does not allow: a quoted local part
  over 64 characters with a backslash before its opening quote, and a
  literal over 64 characters with a `[` inside. A symbol or emoji before
  the `@` no longer leaves the address readable, and neither does an
  address glued to the one before it, as in
  `?to=bob@example.org&cc=carol@example.net`.
- Not fixed here, in #975's body: the cron's follow-up of a pending refund
  can race the webhook's failure mail (two mails), F-4 (other alerts are
  lost if anything fails after their ledger row), H-1 (events that fail
  on every run use up the sweep's cap; a chargeback whose mail Resend keeps
  refusing is now one of them), a redelivered alert that can leave out the
  no-consent line or describe a debt a later purchase has already paid, and
  addresses sign-up accepts but RFC 5322 does not
  (`pat<o>@example.com` still shows in logs).

### Web and API: retention (#969)

The privacy notice states these periods, so they ship before it. They are
the privacy plan's defaults; the lawyer sets the final numbers.

| Data                                           | Kept for                             | Var                               |
| ---------------------------------------------- | ------------------------------------ | --------------------------------- |
| `gclid` on `funnelAcquisition` (row kept)      | 90 days                              | `RETENTION_CLICK_ID_DAYS`         |
| `mirrorEvents` and `funnelAcquisition` rows    | 13 calendar months                   | `RETENTION_FUNNEL_MONTHS`         |
| `auth_ratelimit` rows                          | 2 days                               | `RETENTION_RATE_LIMIT_DAYS`       |
| `promoEmailClaims` rows                        | 30 days after the code's `expiresAt` | `RETENTION_PROMO_EMAIL_DAYS`      |
| The browser's stored `gclid`                   | 90 days after capture                | `VITE_RETENTION_CLICK_ID_DAYS`    |
| The browser's funnel id and acquisition record | a new id after 13 months             | `VITE_RETENTION_FUNNEL_ID_MONTHS` |

`sweepFunnelRetention` runs in `scheduled()` in its own try/catch, at most
1,000 rows a statement and 5 statements per rule per tick, oldest first. The
worker vars are set in all three `wrangler.jsonc` blocks, and a node test
fails if they disagree. In the browser, an id or record stored before this
release takes a fixed legacy date: undated click ids are dropped from 6
November 2026, and undated funnel ids renew from 1 August 2027. Change the
privacy notice in the same release as a period.

### Web: consent, fonts and legal links (#962, #967, #971, #972)

- **Only Accept grants (#962).** With no stored choice the app sends no
  consent update, so Google's IP region default decides. Old silent grants
  (`implicit: true`) are removed. `ads_data_redaction` is on from the first
  hit. The banner also shows for EEA time zones outside `Europe/*` and for
  UTC or GMT clocks, and the region list gains AX, GF, GP, MF, MQ, RE and YT.
- **Fonts (#962).** Inter, Outfit and Plus Jakarta Sans come from the
  `@fontsource-variable` packages the native app already bundles;
  `tools/font-aliases.ts` registers them under the plain family names. The
  CSP drops `fonts.googleapis.com` and `fonts.gstatic.com`.
- **Truthful lines (#967).** The banner said "Your voice recordings never
  leave your device", which Jam and Karaoke Night contradict. It now asks
  for Google cookies and says "Pitch detection runs on your device either
  way." The Mirror's result foot reads "Saved on this device." because its
  numbers reach the funnel.
- **Legal links (#971, #972).** Every entry document (the generated
  prelude, `index.html`, `404.html`, `delete-account.html`) ends with
  `<nav aria-label="Legal">`: Privacy, Terms, Imprint (`IMPRINT_URL`,
  `https://about.mercurypitch.com/imprint/`). The shared `LegalLinks` row
  (44 px items) is in Settings › About, the Mirror and Glass, with Cookie
  settings only where the banner is mounted (`canReopenConsent()`). The
  sign-up and social sign-in panes name the Terms and the Privacy Notice.
- **The banner (#972).** Accept and Decline share one style. Decline deletes
  `_ga`, `_ga_*` and `_gcl_*` on the host and every parent domain. Reopened
  from Cookie settings, it states the current choice and its date.
- Not in this release, for the owner or the lawyer: Basic or Advanced
  Consent Mode in the EEA, the `gclid` in GA4's page URL before a choice,
  first-party ids written before consent, and separate analytics and ads
  toggles.

### Web and API: Google sign-in returns bound to their browser (#965)

The `#gauth=` fragment was a login CSRF on the app, Karaoke Night, Guitar
Night and Drum Night: a link carrying an attacker's session signed the reader
in to it, counted a sign-up and adopted their local takes.
`src/lib/google-return-nonce.ts` mints a 256-bit nonce (`mp:gauthPending`,
15 minutes), `POST /api/auth/google/start` signs it into the OAuth state, and
the worker appends `&gauth_nonce=` to every redirect a verified state
produces. A return without the matching nonce stores nothing and says
"Google sign-in failed: that sign-in didn't start in this browser, so it
wasn't used. Sign in again from here." `#gauth_error=expired_state` and the
Drive outcomes stay unbound by design. Native sign-in is unaffected. On an
iOS home-screen web app, a Google sign-in that finishes in Safari is now
refused. Spec: `docs/specs/google-return-binding.ears.md`.

### Web: the voiceprint-first intro (#977)

- **Beats.** Sky (the welcome) → First light (one held note; Merc listens,
  and his glow follows the voice) → Fork ("Which legend has a
  range like yours?", one button, **Find my twin**) → Voiceprint (four
  steps, about 90 seconds: glides, then five matched notes) → Twin (one stat
  card) → Prints → Keep → Map. The words live in
  `src/features/onboarding/copy.ts`.
- **Exits.** Every "Not now" opens the Map. The Fork's sends
  `onboarding_track_short`, the others `onboarding_skipped`. A voiceprint is
  never dropped: it stays in the browser, and sign-up adopts it. Returning
  singers keep "Make another voiceprint", which opens the Voice Mirror.
- **Sound.** `sound-lane.ts` plays one sound at a time. A note scheduled on a
  clock that iOS froze ('interrupted' or 'suspended') is stopped at its own
  start, never left to play on resume.
- **The gift.** "Up to N free song separations" (`giftCount`, "1 free song
  separation" at N=1), shown while the featured promo has credits, the
  browser holds no account and the mic was allowed; never in native builds.
  Like before, it is not gated by `OFFER_START_AT`; from 12 October both
  agree.
- **Art.** New Merc plates for the sky, First light (with a star layer) and
  the Map, and room cards cut at 560 and 800 px, all webp.

### Web: the compact sign-in sheet (#979)

- **Layout.** Google and Phone share a row, then the Terms line, "or use
  email", fields with floating labels, and one link row (Email me a code, Use
  a passkey where the device has one, Forgot password?). At 375x812,
  sign-up went from 21 rows to 12 and sign-in from 17 to 10; both fit
  375x635. Below 340 px the sheet runs edge to edge with 9 px of padding.
  The spectrum is now the dialog's border.
- **Turnstile.** The sheet passes `appearance="interaction-only"` and
  `size="flexible"`; before, it passed no appearance, so Cloudflare drew the
  widget for everyone. The host has zero height until
  `before-interactive-callback` and stays drawn after the click. A submit
  before the token is held ("Checking…", `aria-busy`) and sent when the token
  arrives; a failed check drops it. Karaoke and the reset-password page keep
  the default appearance. The native sign-in sheet also passes
  `interaction-only`: look at it in a native build from `mp-v0.8.18` on.
- **Newsletter.** The sheet's box reads "Email me product updates.
  Unsubscribe anytime." and Settings reads "Email me product updates"; the
  monthly cap is gone from both. `docs/plans/newsletter-registered-users.md`
  §11 records every consent wording with the dates it was shown. The stored
  fields (`newsletterOptIn`, `newsletterOptInAt`, `newsletterSource`) are
  unchanged.
- **Legibility.** Fields are 16 px under `pointer: coarse`, so iOS doesn't
  zoom on focus. Floated labels are 11 px, light-theme links use
  `--accent-text` (5.83:1), and every fallback is the app's dark value, so
  the sheet reads on a page without the theme tokens.

### Web: the Voice Mirror's account offer (#978)

- **Who sees it.** "Create my free account" and the launch gift sit under the
  results for a browser that has never held an account: no real token, no
  last sign-in, no `requiresLogin` flag (`account-known.ts`). An anonymous
  token still sees it. Declining keeps it; a double tap counts once.
- **The dialog.** The app's own `AuthModal`, loaded on the tap or on a Google
  landing (251 KB, 77 KB gzip). It opens a microtask after its host mounts,
  so the focus trap finds its element: focus lands on the first field, Tab
  stays inside, and Escape and X hand focus back to the ask, which is
  `aria-disabled` while it reads "Opening…".
- **Google.** The return lands on the Mirror. `main.tsx` stores the session
  before anything renders, so `#take-N` is back, and a return that created
  the account adopts the browser's voiceprints (REQ-VPR-014). A second
  factor opens on "Enter your code". A cancel at Google reads "Google
  sign-in was canceled."
- **Funnel.** `cta_account_click` counts taps, not accounts, and is not an
  Ads conversion; `results_view` and the Ads sequence are unchanged. The
  ask's views are not counted separately.
- **The subdomain.** `mirror.mercurypitch.com` answers 301 to
  `mercurypitch.com/mirror`: `/` becomes `/mirror`, other paths and the query
  stay (`src/lib/mirror-subdomain.ts`), and the Mirror's entry makes the same
  move for paths the asset layer serves without the worker. Its origin was
  never in the db-worker's `ALLOWED_ORIGINS`, so sign-in and the funnel
  beacons failed there. Voiceprints saved on it stay with that origin.
- **Copy and weight.** The password sign-up toast reads "Confirm your email
  to get up to N free song separations." The Mirror's first-paint JS went
  from 385,719 to 391,225 B; Drum Night's first paint is 519,863 B of its
  520,000.

### Web: onboarding polish (#981)

- **The controls are back on top.** Since #977, Merc's plates painted over
  the welcome's X, the "Not now" pills on First light and the Fork, and the
  progress line (dev only). The rail now stacks above the art.
- **Short screens.** The twin's portrait follows the screen height, and on
  phones the Share and Continue row sticks to the bottom of the frame, so
  Continue stays on screen from 320x640 up. Continue is on the right and
  Share comes first in the DOM, so Tab and the eye agree. The welcome fits
  without scrolling at 320-362 px wide from 588 px tall up.
- **Copy.** Karaoke Night's gift line, the signed-out promo card and the
  Promo pill's title say "up to N free song separations"; account holders
  still count credits, and one credit is singular ("Claim 1 free credit",
  "1 credit added"). `launch-gift-copy.ts` holds the shared words for six
  readers. The twin's eyebrow (5.48:1) and "Your first stop" (6.11:1) pass
  contrast.
- **Funnel.** Four `onboarding_map_door_*` events count the Map's door taps;
  the worker must deploy first (step 4).
- **Tap targets.** Secondary buttons are 44 px tall.

### Web: the Voice Mirror's start screen and count-in (#983)

- **Start screen.** Every door (/mirror, /vocal-range-test,
  /voice-type-test, /which-singer-has-my-vocal-range, /free-sing and ?v=)
  opens on the onboarding's welcome over Merc's sky (`MirrorLanding`,
  `MirrorBackdrop`): the eyebrow, the door's own H1 (word for word) and
  lede, one 54 px pill, "How it works" as a 44 px text button, the privacy
  "i" at the top right, and Break the Glass as a quiet link above the legal
  row. On ?v= the pill pins to the bottom on phones and stands above the
  cookie banner while it is open (`--consent-banner-space`).
- **Plates.** After mount, phones get `merc-sky-tall.webp` (105,684 B) and
  wide windows `merc-sky-wide.webp` (62,200 B); the overview stands on the
  plain sky. The loading screen wears the plate's radial scrim, so the
  handover changes nothing outside the words. The four documents'
  theme-color is #0d1117.
- **Speed.** Lighthouse mobile on /vocal-range-test, median of five: 93 to
  96, LCP 2,924 to 2,328 ms (the lede both times; the phone's loading screen
  no longer fetches `first-light-tall.webp`). Mirror first paint: JS 391,307
  to 392,740 B, CSS 28,108 to 37,466 B of 40,960.
- **Count-in.** Before every take the Mirror shows "Ready…", a plain line
  and the number; "Your turn. Sing it back." (or Slide up, Slide down, Hold
  it) shows only while it records. Durations and events are unchanged, and
  the overview's demo uses the same words.
- **Copy.** The privacy line is "Only you can hear you." The ledes lost
  their em dashes. Fake-mic runs give the same funnel sequence as `main`
  on every door.

### Web: the sign-in sheet's floating labels (#984)

- **A label over filled text.** Every floated rule reached the label as the
  input's next sibling (`.input:focus + .floatLabel`). Proton Pass inserts
  its icon right after the input, so no rule matched and the label went back
  to rest over the text, 7 px of overlap. The floated state now comes from
  the field (`.field:focus-within`, `.field[data-filled='true']`) or from a
  later sibling (`~`, for `:not(:placeholder-shown)`, `:autofill` and
  `:-webkit-autofill`). `data-filled` comes from each field's signal, read
  back from the box on input, change, focus, blur and an autofill
  `animationstart`, so a value written without an input event floats the
  label and is the value the form submits. It covers display name, email,
  password and both code fields.
- **"Email" read as "Emall".** At 11 px, weight 600 and 0.3 px tracking, the
  dot of the "i" all but touched its stem at DPR 1. The floated label is now
  13 px at weight 500 with no tracking, at `top: 6px`, and the gap is clean
  at DPR 1, 1.25 and 1.5. Contrast is 8.89:1 on dark and 6.45:1 on light.
  The sheet keeps its height, and fields stay 16 px under `pointer: coarse`.
- **Where.** `AuthModal` only: the web's sheet and the Voice Mirror's
  account dialog. The native app signs in through the shell's `SignInSheet`.
  A real Proton Pass was not run; `auth-sheet.spec.ts` copies its injection.

### Web: the Keep screen's motion chips (#986)

- **Chips.** Each Keep row leads with a chip (`KeepChips.tsx`) in the twin
  stat card's look instead of a static icon: dark fill, the row's tone for
  outline and tint, the ridge in gold.
  - Voiceprint (teal): the singer's glides from `voiceStrip()` through
    `ridgeShape`, then a check at the ridge's end. Without glides it draws
    `idealStrip(range)`, and without a range a plain low glide.
  - Devices (blue): the ridge lights on a phone, a point of light arcs to
    the laptop, and the laptop's screen lights with the same ridge.
  - Leaderboard (violet, only without the gift): three podium bars rise and
    a gold star lands on the tallest.
- **Motion.** Each chip plays once on mount, from 0.2, 0.65 and 1.2 s, all
  settled by about 2.4 s. No loops and no library: only `stroke-dashoffset`,
  `transform` and `opacity` move. Every element rests in its settled frame,
  so `prefers-reduced-motion` shows the end state from the first frame. The
  chips are `aria-hidden` and the row text is unchanged.
- **Size.** 48x34 (56x40 from 900 px with the gift), and 34x30 at 640 px and
  down, where chip and gap take the 42 px the icon took. Rows sit 8 px apart
  (6 with the gift). From 320 to 1440 px wide no row wraps differently and
  no beat starts to scroll; at 320 to 344 px "Create my free account" moves
  2 to 8 px up. Drum Night's first paint stays 519,863 B.

### Web: legal links with their slash, and the intent pages on home (#987)

- **Slashes.** `TERMS_URL`, `PRIVACY_URL` and `CONTENT_POLICY_URL` (now
  `/terms/#your-content`) in `src/lib/legal-links.ts`, and the raw-HTML legal
  navs in `index.html`, `404.html` and `delete-account.html`, end in a
  slash. The landing answers the bare `/terms` and `/privacy` with a 307.
- **Home.** The prelude nav in `index.html` links Pitch Training, Voice Type
  Test, Vocal Remover and Singer Match after Jam Rooms. The prelude is what
  crawlers and no-JS readers get; the app hides it once it mounts.
- **Tests.** `launch-entry-seo.test.ts` reads its page lists off
  `ENTRY_PAGES`, and `entry-page-model.test.ts` checks that `index.html` and
  `404.html` link every entry by its nav label. That puts the intent pages
  under the 65-character title check: /pitch-training (76), /voice-type-test
  (69) and /vocal-remover (77) sit in `LONG_TITLES` until their new titles
  land (SEO audit P1 item 4).
- **Found, not changed.** `about.mercurypitch.com/imprint/` answers 404 until
  the landing with disjoint-colliders #100 deploys (step 5). With JavaScript
  off the home page cannot scroll, so part of the prelude's nav sits below
  the fold on a 390x664 phone.

### Copy: "center", the American way (#989)

- **Visible copy.** "centre" and "centred" became "center" and "centered" in
  Drum Night (the live-take headline "Find the center.", take history, the
  timing label, "Centered attacks" and the coach's observation), the Guitar
  Night tuner's four lines with their screen-reader text, the Pitch Hold
  intro, the vibrato help, a Path tip, the guided check (the Pitch Center
  heading, canvas, aria-labels, results and notes), Voice History and its
  traits ("Spectral center"), the take card's "Centered" stat, the Drum Night
  entry page (share titles, h1 and lede) and Glassworks (replay coaching,
  "Move to center" and the steering slider's value text).
- **Stored values keep their spelling:** the `'centred'` timing class,
  `centredCount`, `centredWindowMs`, `'tom-centre'`,
  `'pitch-hold.guided-pitch-centre'`, and the guided take title
  `'Pitch Centre'` that `parseGuidedVoiceTakeContext` matches. `shownTakeTitle`
  (`guided-voice-take.ts`) shows the two stored guided titles as "Pitch
  Center" in thread titles, the playback rail and the Atlas traits. A
  freeform take recorded into the thread of unanalyzed takes now saves the
  title it is shown; nothing matches on that field.
- Other British spellings remain ("analysed", "analyse", "theatre").

### API: sessions past their first month, supporter levels and a refund of nothing (#991)

- **Sessions.** The six-hourly cron's `sweepExpiredSessions` deleted
  `authSessions` rows by `createdAt`, and `/refresh` carries the same `sid`
  forward without touching it, so every session was swept about 31 days after
  its sign-in (the 30-day token plus a day of grace), however fresh its token,
  and `getAuth` refused the next request. The sweep has done this since
  `v0.9.2` (275f44a98). It now ages rows by `lastSeenAt`, indexed since 0038.
  `sessionRenewable`, a read, became `renewSession`, an `UPDATE` of
  `lastSeenAt` guarded by the owner and the 180-day cap
  (`SESSION_MAX_AGE_DAYS`), and `/refresh` mints a token only once it has
  changed a row. A failed write answers 500 with no token and the old token
  keeps working; a session signed out between the check and the write is not
  recreated. `getAuth`'s throttled `touchSession` stays best effort. The
  integration tests run the real SQL with the SQL and JWT clocks moved
  together.
- **Supporter levels.** `grantSupporterEntitlement` passed the old grant's
  level to `bestSupporterLevel` even after that grant had run out, so EUR 5
  given months after a lapsed EUR 59 grant still wore Anthem. The old level
  now counts only while its grant runs (`expiresAt` null or in the future), as
  `extendSupporterExpiry` already treats its days.
- **A PaymentIntent that received nothing.** `priceOf`
  (`withdrawal-refund.ts`) read `amount_received: 0` as a price of EUR 0, so a
  withdrawal priced from Stripe refunded nothing and the owner was never told.
  Zero or less is now no price on record, and the owner refunds by hand, as
  the file's header already said.
- No migration, secret or config change. It ships with the worker in step 4.

### Web: Community, Karaoke's examples, the leaderboard and the light theme (#898)

- **Unpublish on your own shares only.** Board rows carry `userId`
  (`SharedMelodyView`, `SharedSessionView`), and a card offers Unpublish only
  when `isOwnShare` holds: the board says `getUserId()` published it, or it is
  in this browser's own list (`pp_shared_melodies`, `pp_shared_sessions`).
  Every card used to offer it. On someone else's, the card left the screen
  while the worker refused the delete (`canWriteRow`), and it came back on the
  next load.
- **Publishing and unpublishing are awaited.** `saveSharedMelody` and
  `saveSharedSession` finish before the local list changes, and the local
  copy keeps the board's id and owner. A failed publish says "Could not
  publish this melody. Try sharing it again." (or "this run"). Unpublish
  deletes on the server first and says "Could not unpublish this share. Try
  again." when it cannot. Each write re-checks the identity (`getUserId`,
  `authVersion`) it captured before its await, and the buttons disable while
  one is in flight. The confirm dialog reads "Remove "…" from your shelf and,
  if published, the Community board.", then "Existing melody links still
  work." for a melody.
- **Published counts.** `loadPublishedShareCounts` counts the owner's public
  rows (`GET /api/sharedMelodies/count?where[userId]=…&where[isPublic]=true`,
  and the same for `sharedSessions`) instead of the merged board, which held
  everyone's shares and stopped at its newest 100. `usePublishedShareCounts`
  keeps an account's last good totals and says "Could not update your
  published totals. Reopen Community to retry." when a read fails. The
  `/count` route predates `v0.9.16`, so there is no deploy order;
  `community-publication-counts-integration.test.ts` holds it past the
  100-row page.
- **Board rows.** `parseMelodyItems` validates current `MelodyItem`s and
  converts the legacy `{ midi, startBeat, duration, freq }` shape. A malformed
  row is skipped instead of emptying the board, and a melody is validated
  before it is published.
- **Copy.** The Sessions note reads "These are setlists the community has
  published for anyone to sing."
- **Karaoke's examples.** `src/lib/example-session.ts` is the one definition
  of an example (`DEMO_SESSION_ID`, `demoSessionId`, `isDemoSessionId`,
  `EXAMPLE_PROVIDER`, `isExampleSession`), re-exported where the old ones
  lived. `pruneOrphanedCompletedSessions` skips examples: their stems stream
  from R2 and never sit in `uvrStemBlobs`, so the boot prune deleted the row
  on one load and the seed put it back on the next. Rows load without their
  runtime URLs, so `seedExamplesLibrary` gives a kept web example its stems
  again (`restoreWebExampleOutputs`, `restoreUvrSessionOutputs`). A stem the
  visitor replaced wins, and a row that a delete or an edit changed during
  the await is left alone. The card drops "Created", which printed the
  seeder's 1 Jan 2020 sort key.
- **Light theme.** `.community-share-tab::before` is hidden (the header's
  subtitle measured 1.3:1 on it). `MercuryCheckbox`'s empty `.box` takes
  `--bg-primary` and `--border-strong`, since it read as ticked. A playlist's
  `.singers` credit takes `--status-warning-fg` (1.3:1 before), and the
  `.view-tab` outlines take `--border-strong`, `--purple` and `--green`.
- **The leaderboard on a phone.** Under 480 px the table (`data-category`)
  keeps rank, player, score and the column the board is ranked by (streak,
  sessions or best), drops the fixed column widths, and lets long names wrap.
- **Found here, fixed in #995.** A melody or setlist published from this
  browser stayed on its shelf after its board row was gone (unpublished on
  another device, say), and could not be removed there: the worker answers
  the delete with 404, `unpublishShared` returned false, and every try said
  "Could not unpublish this share. Try again." Before #898 the card left the
  shelf whatever the server said.

### Web: time labels that round before they split (#947)

- `src/lib/format-time.ts` gains `roundedMinutesSeconds` (round the whole
  seconds, then split off the minutes), `formatSeekTarget` and
  `formatRestDuration`. Rounding after the split is how 179.5 s read "2:60".
  They serve song lengths (`UvrLibraryElsewhere`, `jam-catalog.ts`),
  Analysis's take span (`TakeTrace`), session rests (`SessionEditorTimeline`,
  `SessionMiniTimeline`; the editor showed 500 ms as "5s" and could show "1m
  60s") and the voice "go to" replies (`transport-commands.ts`,
  `stem-mixer-voice-commands.ts`). Those now name the clamped target, so a "go
  to" past the end of a 3-minute song answers "Go to 3:00". `formatClock`,
  for running clocks, still truncates.
- `format-time.test.ts` and `jam-catalog.test.ts` moved beside their modules,
  and the format test sweeps 0 to 7,200 s in tenths of a second.

### Web: coming-soon store chips on the voiceprint results and the Map (#963)

- `StoreChips` (`src/components/shared/StoreChips.tsx`) puts App Store and
  Google Play chips under the Voice Mirror's and Free Sing's results and on
  the Map, first run or a `#/map` replay. They say coming soon until a store
  listing is live, and no store artwork shows before then. The native build
  renders nothing (`() => null`).
- Six funnel events count the clicks, one per screen and store (release step
  4). `mirrorEvents` keeps a name and a client id only, so they count clicks,
  not people.

### Web: Karaoke Night links that name their song (#993)

- `/karaoke-night?song=goodbye-to-spring`, `josephine` or
  `nothing-in-the-dark` opens Karaoke Night with that example loaded
  (`src/lib/karaoke-night-link.ts`: `normalizeSongSlug`,
  `karaokeNightSongUrl`). The old slug `karaoke-night` reads as
  `goodbye-to-spring`, and `?session=` still wins over `?song=`.
- `&zen=1` (or `true`, or the bare key) opens it in Zen on a computer; a
  phone always opens Karaoke Night in Zen. A link that loads an example
  fires the existing `karaoke_example_staged`, which stays first-party and is
  not an Ads conversion.
- `d39d9a930` fixes a race the links exposed: a second caller of the
  examples seed now waits for the first (`webSeed ??= seedWebExamples()` in
  `seed-examples.ts`).
- Spec REQ-SKL-012 and REQ-SKL-013; end to end in
  `src/e2e/karaoke-example-links.spec.ts`. about.mercurypitch.com links its
  example songs this way from `mp-v0.1.32`.

### Web and API: a guided exercise keeps its clip, and Zen scoring (#994)

- **The example clip (worker).** `parseDraftInput`
  (`workers/db-worker/src/guided-exercises.ts`) dropped an exercise's
  `exampleAudio` whenever a publish came without a managed media id. A spec
  with no media id now keeps the clip it was written with; managed media
  still wins, and the editor's Remove takes it out. A clip a row already
  lost is not restored. `node-tests/guided-exercise-example-clip-integration.test.ts`
  runs the real worker and SQL; 2 of its 3 tests failed before the fix.
- **Steadiness.** `scoreZenRun` leaves out frames more than 600 cents from
  the take's median while they are at most 5% of the take; pitch accuracy
  still counts every frame. A held A3 with two octave slips scored 63
  (steadiness 0) and now scores 92 (steadiness 96). Six pinned A3 takes
  score as before.
- **"Gee" on every note of Three-Note Run.** `cueEveryNote` is gone from
  `src/features/zen/exercise-catalog.ts`, and a test pins the cue.
- The settings comment now says the pitch detector defaults to MPM, as it
  has since 2 May.

### Web: unpublishing a share another device took down (#995)

- `unpublishShared` (`src/db/services/share-service.ts`) counts the worker's
  404 as unpublished, so the card leaves this browser's shelf. A refusal
  (403) or a failure is still a failure.
- `community-services.test.ts`: a 404 returns true; a 403, a 500 and a
  network error return false.

### Web: Drum Night's sign-in sheet keeps its own type and links (#980)

- The shared sign-in sheet renders inside the Drum Night shell, whose control
  resets (`.shell button, .shell input { font: inherit }` and
  `.shell button { color: inherit }`, specificity (0,1,1)) beat the sheet's
  own rules. At 375x812 its email field was 14 px, so iOS zoomed on focus, and
  "Create account" and "Forgot password" lost their accent.
- The sheet now sits in a `display: contents` layer (`.authSheet`), and the
  resets skip it with `:not(:where(.authSheet *))`, which adds no
  specificity: the field is 16 px and both links take the accent. Drum
  Night's own controls (50 at 375x812, 44 at 1440x900) are unchanged.
- `src/e2e/drum-night-auth-sheet.spec.ts` fails on the base (14 px) and
  passes with the fix.

### API and web: exact column names, weekly league cuts and refused sessions (#997)

- **Exact column names.** The generic CRUD API accepted differently cased
  SQL column names, and those bypassed the ownership, validation and
  private-column checks. POST and PATCH bodies and list or count filters and
  ordering now need the schema's exact column names. `PRAGMA table_info` is
  cached per isolate and refreshed before a newly added column is refused,
  and a JSON body that is not an object answers 400.
- **Weekly leagues advance again.** They stopped after their first cut; the
  next cut now includes the previous running week, and a second run in the
  same week changes nothing. Weeks older than a stored watermark are not
  replayed.
- **Hidden members stay anonymous.** Standings showed hidden members' account
  ids; their rows and pseudonyms now use the weekly membership UUID. Owners
  and members who opted in keep their names.
- **A refused session asks for sign-in** (the client follow-up to #991),
  an expired account token included, instead of falling back without a word.
  Verification and refresh results are bound to the credential and session
  version that started them.
- No migration. Case variants, ownership attacks, hidden-column queries, the
  schema-cache refresh, the weekly rollover and the session races stay as
  permanent tests; 14 of the new race tests failed before the fix. An
  independent review found it compatible with cached v0.9.16 PWAs and the
  native builds.
- A Beside Cue smoke test's overall budget goes from 90 s to 150 s (two
  software-rendered course loads of 41 s each); each load keeps its 60 s
  limit.

### API and web: reads that return every row, creates that land once (#998)

- **Every row.** A read of the caller's own rows with no limit pages through
  all of them. A failed page fails the read instead of returning part of it,
  and an account change cancels it, so a read-then-create caller cannot
  mistake another account for an empty one. Private tables default to 1,000
  rows a page (public and admin reads stay at 100), and every list orders by
  `rowid` last.
- **Once.** The client mints one UUID per create and keeps it across
  retries; the worker checks it before the insert, returns only the caller's
  own row, and awards a session once.
- **One row per setting and per challenge (0070).** `userSettings` is unique
  on `(userId, key)` and `challengeProgress` on `(userId, challengeId)`.
  0070 keeps the newest setting of each duplicate group and merges a
  challenge's duplicates first: completion, best score, progress and
  attempts take the highest, and the earliest completion date stays. The
  generic create then upserts on the indexes (`naturalKey` in
  `workers/db-worker/src/tables.ts`), so installed clients stop making
  duplicates with no client change. Song manifests gain the upsert on 0025's
  index.
- **A create never undoes a completion.** The review found that the first
  version of the upsert wrote a first attempt over a completed challenge: an
  anonymous web token lapses after 30 days, the next read comes back empty,
  and the attempt creates. `challengeProgress` now merges through
  `upsertMerge` the way 0070 does. Every rule is idempotent, so a replayed
  create cannot inflate `attempts`; the price is that the attempt on that
  lapsed-token path is not counted. Settings and song manifests stay last
  write wins.
- PATCH and DELETE check ownership inside the SQL, the longest streak's
  high-water mark is held in SQL, and a first consent or display name saved
  after anonymous provisioning already made the profile is recovered.
- Tests: three merge cases and a replay case in
  `api-contract-integration.test.ts`, and
  `challenge-progress-client-integration.test.ts`, which drives the real
  challenges service and adapters through a lapsed anonymous token; 4 of
  them failed before the fix. Left for later: a PATCH of challenge progress
  is still last write wins.
- The rollback order changes; see Migrations.

### API and web: sign-in, sign-up, 2FA and weekly races, and shared-device progress (#999)

- **2FA.** A TOTP step is claimed with one guarded `UPDATE` against the exact
  confirmed credential: a code that arrives twice at once is spent once, and
  a proof against a removed or replaced authenticator fails.
- **Sign-in and sign-up.** Two first sign-ins for one device resolve to one
  anonymous account, rechecked for provider, suspension and device proof; a
  row erased in between is refused instead of crashing. A double-submitted
  sign-up answers 409, never 500, and the guarded upgrade cannot bump
  `tokenVersion` twice and sign the winner out. Two concurrent upgrades with
  different emails now make two accounts; before, the second email
  overwrote the first.
- **Weekly challenges.** Encore insertion and queued activation compete for
  one active row, and the rollover first closes every ended active row (up to
  four a request), so a week the old race left with two active rows serves
  the new week on its first load.
- **Progress on a shared device.** Each progress key (the Ascent, Long note
  bests and Echo bests) keeps one copy per owner on the device
  (`mp_sync_progress:<key>`): one per signed-in account and one guest copy.
  Pull, backfill and write-through upload only the current owner's copy, so
  one singer's practice cannot reach another's account. An upload merges the
  owner's copy with the account's row read just before the write and
  replaces the pending snapshot with the merged value, which also closes an
  older race where a flush resent the pre-merge copy. Practice done signed
  out is still adopted once by the account that signs in.
- **Visible change:** signed out, those keys show the guest copy, which is
  empty unless the singer practiced signed out; the account's copy returns on
  sign-in. Other accounts' copies stay on the device until they sign in
  again.
- **Exports and the upgrade notice.** A received song whose original file has
  no bare MIME type exports again (the stored original is untouched), and the
  "waiting on another tab" notice clears once the database upgrade runs.
- Review: the first version lost a best set on another device when a second
  singer's row appeared after their first pull on a shared device. Fixed
  before merge: `settings-shared-device.test.ts` keeps both sequences (its 5
  tests fail on `main`'s settings code before the merge and pass now), and
  `weekly-encore-integration.test.ts` keeps the duplicate active rows. No
  migration. Drum Night's first paint stays under its 520,000-byte budget, at
  519,988 bytes, by null-guarding the new storage hooks.

### Web: Community's shared results, and 45 dependency alerts (#992)

- **Shared results.** A Community session link pointed at a completed run
  record but promised a playable setlist. It now opens a read-only result
  summary (`#/result/...`). A guest's link carries its summary in the link
  itself (base64url, at most 8,192 characters, `v: 1`, checked by a zod
  schema and rendered as text), and opening a result leaves practice history
  as it was. A public link asks for `where[id]` plus `where[isPublic]=true`
  and checks `isPublic` on the row, so an owner never sees a private row
  through one.
- **Old links.** A board link copied by v0.9.16 (`#/share?type=session&id=`)
  opens as a read-only result instead of a "may have expired" toast. A guest
  link copied by v0.9.16 pointed at browser-local ids and shows the
  unavailable page; copying the card again gives a working link. A row
  v0.9.16 wrote that fails the summary contract is left off the board instead
  of emptying the whole Sessions list.
- **Cards and grouping.** Provably identical historical melody cards are
  grouped for display, and no saved record is deleted to do it. A delayed
  board response can no longer turn a local removal into a public deletion,
  and example songs keep their grouping across reloads (twelve probes failed
  before that fix).
- **Dependencies.** The lockfile clears the 45 critical and high GitHub
  alerts inventoried for the PR (`docs/agent/DEPENDENCY-TRIAGE-2026-10-13.md`):
  solid-js 1.9.17, @huggingface/transformers 4.3.1, wrangler 4.150.0,
  @cloudflare/workers-types 5, Capacitor 8.5.3, vite 6.4.4, sharp 0.35.5 and
  @gltf-transform/cli 4.5.1, plus overrides for compression and immutable.
  `pnpm audit` leaves one high, the development-only `braces`, which has no
  patched release. GitHub closes the alerts once it rescans `main`.
- **Budgets.** Solid's store runtime moves to its own `vendor-solid-store`
  chunk, which the five entry documents that use the store load and no
  standalone room does, so the update fits the existing budgets: Drum Night
  516,277 bytes (519,987 before), Piano Night 300,700 (304,405 before), and
  no limit raised.
- Solid 1.9.17 re-suspends `lazy()` for a microtask after a remount, so the
  room tests await the lazy controls, and the Encore test proves the
  microphone is taken while the old audio fades.
- Found, not fixed: in `whisper-worker.ts` and `voice-stt-worker.ts`, a
  failed WebGPU attempt makes the WASM fallback fail too, before this PR and
  after it.

### Tests: the jam-two-peer skill reaches a room again (#858)

- `.claude/skills/jam-two-peer/two-peer.mjs` seeds
  `pitchperfect_whats_new_seen_v2` from `package.json`, so the script is not
  sent to `#/whats-new`; selects by role, name or an attribute the app owns
  (`JamPickerList`'s `[data-variant="popup"]`) instead of CSS-module class
  substrings; and passes `waitForFunction` its options where they apply.
  Tooling only.

### Native shell, test builds only: premium rooms full-bleed and held upright (#996)

- A premium room opens as its own pushed screen: the art fills the screen
  under the status bar, the bar and the home indicator, the bar floats over
  it on the room's dark stage (`mp-dark-stage`) with a scrim behind the title
  alone, and the tab rail and a parked run's pill hide until Back. Long note
  adopts it: `PREMIUM_ROOM_SCREENS` in
  `apps/mercurypitch/src/shell/premium-rooms.ts`.
- A phone holds a premium room in portrait with
  `@capacitor/screen-orientation` 8.0.2, locked on enter and unlocked on
  leave. An iPad keeps turning, and the web does nothing.
- It needs the next `mp-v` tag: the plugin is registered in the Android and
  iOS projects.

### Premium exercises, native test builds only: Long note's levels, Echo and the room kits (#985, #988, #990, #1000, #1001)

None of them reaches the web. `PREMIUM_EXERCISES` is `KARAOKE_IMPORT`, which is
true only in a native test build (`src/lib/native-build.ts`), and the web's
Long note is the older `src/features/exercises/long-note`.

- **Long note (#985).**
  - Going to the background drops the take, as Back already did: no run, no
    best, no history and no practice minutes. The mic closes and the intro
    says "The note stopped when you left. Tap the mic to go again."
  - Steadiness is 100 minus 2 x the standard deviation in cents, as the web
    Long note scores it. Vibrato and shakes cost steadiness, octave slips are
    still dropped, and one measure serves the live check and the result.
  - The level is the Accuracy Tier from Settings
    (`pitchperfect_accuracy_tier`, default Singer), read through
    `src/stores/exercise-level.ts`. A pill at the top left, shown only
    between takes, opens the three levels and calls `applyAccuracyTier`, so
    the mic sensitivity preset, the pitch bands and the score mode change for
    every exercise, as a pick in Settings does. A take keeps the level it
    started at, and the demo plays at Singer.
  - Learning is ±40 c and brims at a steadiness of 35, Singer ±30 c and 70,
    Professional ±20 c and 88. The goal stays 12 s, and the top is judged on
    everything sung since the goal.
  - Merc calls a voice steady only at 80 or more. A take past the goal
    without the brim says to hold longer or hold steadier. The help text says
    a vibrato counts as a wobble and that the Accuracy Tier sets the brim.
  - `assert-bundle.mjs` gains the marker `long-note-level`, so the level
    control must fold out of the store build with the room.
- **Echo (#988)**, the logic only, in `src/lib/sequence/`. `sequence-engine.ts`
  follows a phrase sung back note by note: a note lands at the hold engine's
  lock, misses at its deadline (4, 3 or 2.5 s by level) naming the closest
  steady note, or is skipped when the voice lands the next one first.
  `ECHO_LEVELS` is keyed by the accuracy tier ids. `phrase-bank.ts`,
  `phrase-fit.ts` (`planEchoRun`), `sequence-metrics.ts` (accuracy 100 minus
  1.5 x the mean absolute cents), `phrase-voice.ts` and `steady-note.ts`
  complete it, with 123 tests in nine files. `hold-target.ts` gains
  `latestVoiceprintRange`, split out of `pickHoldTarget` with no change in
  behavior. The room is #1000, below.
- **The room kits (#990)**, a refactor with no change in behavior, so the
  next exercise room can share Long note's parts. `src/components/room-kit/`
  takes the mic capture (`useExerciseCapture`, given its owner and room name),
  the level pill (`LevelControl`, `createLevelPreset`), `RoomHeader`,
  `RoomControls` and the small helpers: Merc's moves and his line selector,
  the chip pacer, the screen kept awake, the focus hand-off and reduced
  motion. `src/components/demo-kit/` takes the demo (`useExerciseDemo`,
  `DemoLayer`, `DemoTakePill`, the plan, the sound, the seen flag and the
  tip placement). Test ids, the `mp_long_note_demo_seen` key, the mic owner
  and every timing are unchanged; the keyframes are renamed `mic-pulse` and
  `mic-nudge` inside their CSS modules. `exercise-level.test.ts` now walks
  both kits as well.
- **The Echo room (#1000).** Merc sings a short phrase, the singer sings it
  back note for note, and each note landed on pitch lights a star over the
  town; a run is five phrases, then the result's constellations. It opens
  from the Sing room's exercise picker (`echo-stars`). The Settings accuracy
  tier sets the notes per phrase, the room each note gets, Merc's tempo and
  whether another octave counts, and the room kit's level pill changes it.
  Merc's calls go through `merc-call.ts`, shaped for a sampler later; Long
  note's voice ribbon moved into `room-kit/ribbon.ts`, so both rooms draw
  with it; `room-kit/plate-loader.ts` starts the sky plate loading on the tap
  and decodes it during the push. `scripts/sync-echo-art.mjs` copies art
  round 3 and writes `echo-geometry.ts`. In headless Chromium at 4x CPU
  slowdown, no frame took over 20 ms.
- **Echo's art round 4 (#1001).** Round 4's world and result plates replace
  round 3's, copied in by `scripts/sync-echo-art.mjs`, and the result plate
  paints a spire under the star. Three thin cyan ribbons follow the dots'
  chains, painted pixel by pixel into one small canvas between the star's
  glow and the star; the starburst gains a cyan mist and four faint diagonal
  rays; dots 16, 17 and 28 move 4 px right, off the lit spire. Nothing else in
  the room changes.

### native-mercurypitch

Found by building the native bundle at this release's head as it stood when
#991 merged, as a test build (`KARAOKE_IMPORT` on) and as a store build, and
matching each PR's changed lines against the source lines Rollup kept.
`mp-v0.8.18` (82bb04d32, the merge of #973) is the first tag whose bundle
carries the changes marked with it, and `mp-v0.8.19` (85b78e48b, the merge
of #985, TestFlight build 706) the ones marked with that. Two more followed
on 13 October, and Mercury Pitch Mobile built both: `mp-v0.8.20`
(ab8ce55ce, the merge of #996) carries #987 to #990, #898, #947, #963 and
#993 to #996, and `mp-v0.8.21` (69051cfc0, the merge of #1000) adds #980 and
#1000. `mp-v0.8.22` (0c5f028b6, the merge of #1001) followed on 14 October
and adds #997 to #999, #992 and #1001, and with them #992's Capacitor 8.5.3
(regenerated native references) and Solid 1.9.17. #974's own changes arrive
with the next native tag. #991 changed only the worker, and the worker
halves of #997 to #999 reach every installed build the same way: with this
release's worker deploy, under the server changes below. The merges after
#991 were not matched against the bundle line by line: #963's chips render
nothing in the native build, #980's app code is all in
`src/features/drum-night`, which was in neither build when #989 was checked,
#994's clip fix is in the worker, #996 has its own section, and #1000 and
#1001 are listed below.

**In the native code**

- **Long note's shell (#973, `mp-v0.8.18`), test builds only.**
  `LongNoteScreen` on the shell's stack, `openExercise` by id
  (`premium-exercise-wiring.ts`), and the rail hidden while an exercise holds
  focus (`run-shell-store.ts`). In the store build
  `installPremiumExercises()` folds to `{}`.
- **Build checks (#961, #973, `mp-v0.8.18`).** `vite.config.ts` drops the
  gift and offer modules (`LAUNCH_OFFER`) and, without the premium
  exercises, resolves the lantern plates to an empty module
  (`PREMIUM_IMAGES`). `assert-bundle.mjs` (OFFER, STAGE 2) holds both
  builds to it; both pass at this head.
- **Long note's level control (#985, `mp-v0.8.19`).** `assert-bundle.mjs`
  STAGE 2 gains the marker `long-note-level`: the test build carries the
  control, and the store build must not. Both builds pass at this head.
- **Echo's screen (#1000, `mp-v0.8.21`), test builds only.** `EchoScreen` on
  the shell's stack, opened by id from the Sing room's exercise picker
  (`premium-exercise-wiring.ts`), with Echo's art behind `vite.config.ts`'s
  premium switch. By the PR's own bundle checks, the dev target's
  `assert-bundle.mjs` STAGE 2 finds Echo's room, its picker card and its
  level control, and the store bundle has no Echo image and none of the
  room's markers; it keeps the id `echo-stars` and Echo's help text, as it
  keeps Long note's. Look at the Echo card in the picker, a run at each
  level, and the result.
- **Echo's art round 4 (#1001, `mp-v0.8.22`), test builds only.** Round 4's
  plates, ribbons and starburst, as in the Echo room's entry above. Look at
  the result's star and the spire under it.
- #962 changed only comments under `apps/mercurypitch`.

**Shared code the native app runs**

- **Long note (#973, `mp-v0.8.18`), test builds only.** The room
  (`src/features/long-note`), the hold engine (`src/lib/hold`), Merc's
  renderer (`src/lib/merc`), and the Sing screen's exercise row, picker and
  options entry (`src/features/premium-exercises`, `SingRoomStage`). The
  store build keeps only inert parts: the id, its help text and difficulty,
  and signals that stay false. Look at the row, the picker, a full run,
  Back and Done. L3, the one free run before the paywall, lands with the V1
  flip.
- **Long note's levels (#985, `mp-v0.8.19`), test builds only.** The level
  pill and sheet (`LongNoteLevel.tsx`), `exercise-level.ts`, the hold
  engine's steadiness and reading, the lantern's ease, Merc's lines, and the
  take dropped on leaving (`useLongNoteController.ts`). The store build keeps
  only the new help text, which no screen there shows. Look at the pill
  between takes, a take at each level (a straight tone brims at all three, a
  wide vibrato only at Learning), leaving the app mid-hold, and Settings'
  Accuracy Tier and mic sensitivity after a pick in the room.
- **Echo's groundwork (#988, `mp-v0.8.20`), test builds only.**
  Only `hold-target.ts` reaches the bundle: `latestVoiceprintRange`, split
  out of `pickHoldTarget` with no change in behavior. `src/lib/sequence` is
  in neither build, so there is nothing to look at.
- **The room kits (#990, `mp-v0.8.20`), test builds only.** Long
  note runs on `src/components/room-kit` and `src/components/demo-kit`, with
  no change in behavior, and the kits' CSS lands in the `LongNoteScreen`
  chunk. The store build keeps none of it. Run Long note once end to end:
  the demo, the level pill between takes, a take, leaving mid-hold, Back and
  Done.
- **"Center" (#989, `mp-v0.8.20`), every build.** Both builds
  keep the changed strings of the guided voice check (the Pitch Center
  heading, results and notes), Voice History (its guidance, "Spectral
  center", and `shownTakeTitle` in thread titles, the playback rail and the
  Atlas traits), the take card's "Centered" stat (`performance-take.ts`), the
  Pitch Hold intro, the vibrato help and a Path tip. The Drum Night, Guitar
  Night tuner and Glassworks files #989 changed are in neither build. Look at
  a guided take kept on an earlier build: Voice History should title it
  "Pitch Center".
- **Legal links (#987, `mp-v0.8.20`), every build.**
  `TERMS_URL`, `PRIVACY_URL` and `CONTENT_POLICY_URL` end in a slash. The
  shell's About screen (`AboutScreen.tsx`) and `SignInSheet` link the first
  two, and so does Karaoke's import box in a test build. Look at Terms and
  Privacy under Settings › About MercuryPitch and in the sign-in sheet: each
  should open its page with no redirect.
- **The UI audit's fixes (#898, `mp-v0.8.20`), every build.**
  Both builds keep the changed lines of `CommunityShare`, `share-service.ts`
  and `usePublishedShareCounts`, but neither the rail nor the More sheet
  opens Community, so a tester can't reach them. The rest can be reached.
  The leaderboard (Progress, then the league card's Open Leaderboard) keeps
  rank, player, score and the ranked column under 480 px. In the Karaoke
  studio (Karaoke, then Manage songs) an example's card has no "Created"
  date, and the view tabs' outlines and a playlist's singer credit follow
  the light theme. Both builds also carry the empty checkbox's light-theme
  surface, and the boot prune (`pruneOrphanedCompletedSessions`) skips
  examples in both. `restoreUvrSessionOutputs` is compiled in with no
  caller: the app takes `seedExamplesLibrary`'s native branch, which seeds
  from the bundle and then the server, and the web branch folds out. Look at
  the leaderboard on a phone, the studio in both themes, and the example
  songs after a few relaunches.
- **Time labels (#947, `mp-v0.8.20`), every build.**
  `format-time.ts` and its callers are in both builds: song lengths in the
  Karaoke studio's list of songs on your other devices
  (`UvrLibraryElsewhere`) and in `jam-catalog.ts`, Analysis's take span
  (`TakeTrace`), rests in the session editor and the voice "go to" replies.
  Voice control has no place in the native chrome yet, so the replies are
  compiled in but never heard. Look at the song lengths in the studio's list
  of songs on your other devices: none should end in ":60".
- **Not in the native app (#984, #986).** None of the lines #984 changed in
  `AuthModal.tsx` survive in either build, and its floating-label classes are
  not in the CSS: the app signs in through `SignInSheet`. The onboarding,
  Keep and its chips included, is in neither build.
- **The sign-in sheet's security check (#979, `mp-v0.8.18`).**
  `SignInSheet` already passed `appearance="interaction-only"`. The shared
  `Turnstile` now takes no height or margin until Cloudflare asks for a
  click, and when a hidden check fails it says "The security check didn't go
  through. Close this and try again." or "This browser can't run the
  security check. Try another browser." Look at the sheet's spacing, and at
  whether "Try another browser" reads right inside the app.
- **Reference notes (#977, `mp-v0.8.18`).** `playReferenceTone` runs on
  `startReferenceTone`: a note whose clock iOS froze is stopped at its own
  start, not played on resume. It reaches the guided voice check and the Zen
  stage; interrupt a voice check (a call, Siri) and resume it.
- **Mic help (#981, `mp-v0.8.18`).** The Challenge stage's troubleshooting
  list reads "If another MercuryPitch tab has the mic, this one offers to
  move it here."
- **Funnel id (#969, `mp-v0.8.18`).** The `app_open` beacon (`analytics.ts`,
  `/api/mirror/event`) now dates its client id and renews it after 13 months
  (undated ids from 1 August 2027), and drops a stored click id after 90
  days.
- **Compiled in, no visible change (#959, #961, #964, `mp-v0.8.18`).** The
  router's `?open=costs` (#959); the header's and banner's gift stubs, and
  `fetchBillingMe` reading `promoClaims` and `offer` (#961); the tour
  offer's pause, which reads `showWelcome` and `flowOpen`, both always false
  natively (#964).
- **The web version (#974).** `APP_VERSION` (root `package.json`, in the
  crash dialog's details) reads 0.9.17 from the first native tag after this
  merges. The app's own version comes from `App.getInfo`.

**Server changes it sees** (with this release's worker deploy, whatever the
native build)

- **Sessions past their first month (#991).** The app renews its token
  through the shared `/api/auth/refresh` (`auth-service.ts`), and the
  six-hourly sweep now ages a session by its last use, not its sign-in. A
  phone that keeps opening the app stays signed in past day 31. A session
  unused for 31 days still ends, as does one at its 180-day cap. Every
  installed build gets this with the worker.
- **LAUNCH on confirmation (#961, #966).** `claimLaunchGift` has no platform
  check: a native sign-up that confirms its email, or a new Apple or Google
  account with a verified address, gets the featured code's credits
  (LAUNCH: 5) in the balance `/api/billing/me` reports. The native app shows
  no toast. One claim per inbox (#966).
- **Deleting an account can wait (#968).** `DELETE /api/auth/me` answers 409
  while a credit-pack withdrawal still owes a refund or its mail (503 if the
  check fails), and Delete account shows the worker's sentence. Only
  accounts with web packs can hit it.
- **Refunds and disputes take credits back (#970).** A refunded or disputed
  web pack lowers the balance the native app reads by the refunded or
  disputed share of that payment's credits.
- **Retention (#969).** `mirrorEvents` rows, the `app_open` beacons
  included, are deleted after 13 months.
- **The finish-five reward counts web separations only (#961).**
  `creditsUsed` (`offer-rules.ts`) adds up `uvr-job` rows, less their
  `uvr-refund`, and `readFinisherOffer` (`launch-finisher.ts`) reads only
  those two reasons. A separation in the app writes `uvr-job-app`
  (`app-songs.ts`) and spends the subscription's songs, never credits, so it
  never counts toward the five.
- **The database audit's follow-ups (#997, #998, #999).** The generic API
  takes exact column names only, which #997's review found compatible with
  the native builds, and hidden league members stay anonymous. A create that meets
  the singer's setting or challenge row updates it instead of adding a second
  (#998, with 0070 merging the duplicates already stored), and a challenge's
  completion and best score never go back. A read of a singer's own rows with
  no limit returns up to 1,000 instead of 100. Two first sign-ins on one
  device get one account, a double-submitted sign-up gets 409, a TOTP code is
  spent once, and one Encore runs per week (#999).

### native-besidecue

Of the PRs merged up to #991, only #989 reaches Beside Cue, and only a
games-on build (`VITE_BESIDE_CUE_GAMES=1`). At this release's head as it
stood then, that build keeps every line #989 changed under
`packages/glass-game`: four replay coaching lines (`replay-profiles.ts`), the
steering slider's "Centered" value text (`RunnerSteeringControls.tsx`) and
the runner's "Move to center" cue (`runner-hud.ts`). They arrive from the
next Beside Cue tag; look at Glassworks' replay coaching and the runner's
cues. The store build (games off) keeps none of them. No other file changed
by then has a line in either bundle, #973's `src/components/icons.tsx` and
every file of #898, #947, #990 and #991 included. The merges after #991 were
not checked against Beside Cue's bundle. #992 is the first PR since
`v0.9.16` to touch `apps/beside-cue`: the next Beside Cue build carries its
Capacitor 8.5.3, with regenerated native references, and Solid 1.9.17.

### Tests: the Jam lyric-row spec (#982)

`jam-room-keys-and-rows.spec.ts` failed in up to a third of runs under load,
before and after this release's changes. Three races, none a user's: the
preview room's fake peers re-render the Parts bar and push the rows 24 px
down, so a drag measured before Ada joined pressed the bar's hint; the routed
stems answered 200, so Chromium could not seek and reset the clock under the
label check; and `writeToneWav` truncated the shared tone file while other
workers read it. The spec now waits for the room to fill, answers ranges
(206), and the helper writes a temp file and renames it into place. A joining
peer still moves the host's rows 24 px; whether to stop that is open.

### Web: Drum Night, the cost guide and the tour offer (#957, #959, #964)

- **Drum Night (#957).** A blocked Separate drums press survives the Google
  round trip through a shared lease store
  (`src/lib/google-separation-intent.ts`: read once, 15 minutes, exact
  rollback). The hook compares the song's fingerprint and runs the room's
  own press, preflight included. Since #965 it resumes only after a bound
  return. The room now mounts `<Notifications />`, lazily.
- **The cost guide (#959).** Karaoke Night links
  `/#/settings/credits?open=costs`. Settings routes accept a query; the
  router sets a one-shot `creditCostGuideRequested` and rewrites the address
  to `#/settings/credits`. `CreditCostGuide` opens and scrolls itself into
  view a frame later. What's New holds its announcement for such a link.
- **The tour offer (#964).** `usePageTourOffer` takes a `paused` accessor;
  `App.tsx` pauses it while First Light is open, and the tab on screen is
  offered a microtask after the flow closes, so Home's one offer is no longer
  spent behind the welcome.

### API and console: fresh confirm links and the mail wordmark (#960, #958)

- **Fresh confirm links (#960)**, for the operator console only:
  `GET /api/confirm-reminders/audience` (counts only) and
  `POST /api/confirm-reminders/send` (a dry run unless `dryRun` is `false`;
  real sends are pages of at most 25, 600 ms apart). One link per account,
  ever, written before it goes (0056), with a Resend `Idempotency-Key` of
  campaign and account. The fresh link lasts 7 days. `PUBLIC_API_ORIGIN` is
  `https://api.mercurypitch.com` on prod, so a link never points at an
  Access-gated host. Nothing sends on its own.
- **The mail wordmark (#958)** is `/email/wordmark-v1-2x.png`: Cloudflare's
  assets answered the `@` name with a 307. The old file stays for mails
  already sent, and a test refuses a mail picture name that needs
  percent-encoding.

## [0.9.16] - 2026-10-09

92 commits since `v0.9.15` (68 on `main`'s first-parent line): PRs #921 to
#931, #933, #936, #950, #951, #953 and #954, plus direct commits for
Glassworks.
The release is for the mail: new sign-up mails and a rebuilt purchase mail,
with Settings › Credits as the one place that states prices. Most of the rest
is the native app, already on TestFlight from `mp-v0.8.8` through
`mp-v0.8.16`, and Glassworks, which production still leaves unlisted.

### Web and API: sign-up mails that can name a twin (#951)

The welcome, confirm and fresh-link mails share one layout
(`workers/db-worker/src/email-layout.ts`): a picture on top with no words on
it, the wordmark, and the Mercury Pitch footer. Welcome mails pick their
picture by context (welcome, a twin, Karaoke Night). The confirm and
fresh-link picture is never a link, so confirming is always a tap on the
button. A code sign-up, Google and Apple send the welcome mail; a password
sign-up sends the confirm mail.

The server cannot see a voiceprint at sign-up (adoption runs after the account
exists), so the client sends a validated hint with the sign-up, only from the
page that adopts the takes, plus `signupSource: 'karaoke'` from Karaoke Night.
Google web sign-ups carry both in the signed OAuth state. With a twin the mail
says "You share a range with {twin}"; without one it is the plain welcome.
`GET /api/email-preview` renders every variant on the dev worker only
(`EMAIL_PREVIEW=1`).

### Web and API: the purchase mail and what a song costs (#953)

- The credit-pack mail is rebuilt on the same layout. It states what the
  Stripe session charged (`amount_total` and `currency`, so a discount and the
  currency are right), with the plan's list price only as a fallback. It names
  no per-song cost and links Settings › Credits instead, because a sent mail
  cannot be corrected.
- Settings › Credits gains a **How credits are spent** chip
  (`CreditCostGuide`). Every number comes from the live `uvrModelCredits` and
  billing-core's length rule: 12 minutes included, each started 6-minute block
  counts again, and the full band is `roformer` plus `demucs-6s`. A test holds
  its worked example to `uvrJobCost`. The guide is web-only: the native app
  never mounts Settings.
- "1 credit per song" is gone. Tier cards, the upload panel and the Karaoke
  Night rail say "from N credit(s)" and point to the guide.
- Migration 0055 renames the tiers to Cloud GPU and Cloud CPU (`UPDATE` by id,
  no schema change). It ran on dev at the merge and runs on prod with this
  tag.
- Phone header: the account group sat absolutely positioned behind a fixed
  128 px reserve, and the promo pill plus Install and voice overflowed it onto
  the wordmark. It now sits in the row with -6 px block margins, keeping the
  50 px band; the wordmark ellipsizes only when every pill shows.

### Web and native: every sign-up that creates an account adopts (#954)

Creating an account adopts the device's unclaimed voiceprint takes
(REQ-VPR-014), and the welcome mail's hint goes wherever adoption follows
(REQ-VPR-022). Until now only password registration and the main app's
Google redirect adopted.

- Native sheets and the mailed sign-up code adopt when the worker answers
  `isNew`; a second factor still owed adopts nothing. `loginWithGoogle`,
  `loginWithApple`, `verifyLoginCode`, `signInWithApple`, `signInWithGoogle`
  and the phone's `createSignInFlow` take an optional `SignupContext`. The
  phone's `SignInSheet` already adopted and now sends the hint too; phones get
  it with the next native tag.
- Guitar Night and Drum Night are separate Vite entries, so a Google sign-in
  from their dialog lands on the room's page. Drum Night's entry never called
  `consumeGoogleRedirect`, so it dropped the `#gauth=` session and came back
  signed out. It now stores the session before rendering and loads
  `auth-service` only when the address carries a Google fragment. Both rooms
  adopt right after, through `src/lib/room-google-return.ts`, and pass
  `adoptsGoogleSignup` so their redirect carries the hint.
- No worker change: `isNew` was already right on all three routes. Karaoke
  Night's standalone account UI and the console's `NativeSignInPanel` still
  send no hint, by design.

### Web: Progress for a signed-out singer (#950)

Signed out, Progress counted only takes tagged `anonymous`, so a device whose
voiceprints Settings listed showed the empty page. One rule,
`visibleDeviceTakes`, now serves Settings and Progress. With a voiceprint and
no practice, Progress leads with a new `voiceprint-reading` moment and offers
a first exercise.

### Web: the karaoke room arrives once (#921)

The room draws its veil and holds the stage at opacity 0, inert, until it
loads (600 ms grace, an error at once), then fades it in over 220 ms.

### Native app (already on TestFlight)

- iOS lock screen: Now Playing through WebKit (#924), after the app-process
  attempt (#922) was reverted (#923); media controls and seeking (#929,
  #930); the repeat counter restarts (#933).
- The Karaoke lyrics window: a picture-in-picture window drawn from lyrics
  worked out ahead (#925), with fixes for the trip to the background and back
  (#928). #936 keeps it up and drops CallKit; it is on `main` but in no native
  tag yet.
- Audio handoff with other apps and YouTube (#926, #931, #933).
- Android: R8 shrinks the Play build (#927, APK 98.7 to 72.7 MB), and the
  download ceiling is 150 MB.

### Glassworks (unlisted on production)

Direct commits from 3 to 8 October in `packages/glass-game`: Singing Current
finishes, runner steering, camera, blockers and a physical slide lesson,
shatter playback at half speed by default, live pitch anchored to the notes,
crystal materials, phone panels, Encore ribbons in short landscape, and failed
graphics or microphone sessions retired safely. The public glass challenge
imports only Glassworks' shatter audio and asset table; the table gained
runner entries and nothing else.

### Tooling

The playtest page serves Android downloads as installable APKs, and the Jam
room browser fixture serves seekable audio.

## [0.9.15] - 2026-10-03

157 commits since `v0.9.14` (82 on `main`'s first-parent line): PRs
#880, #882, #884, #885, #894, #895, #896, #897, #900, #901, #902, #903, #904,
#905, #906, #907, #909, #910, #911, #912, #913, #915, #916, #917, #918 and
#919, plus direct commits for Glassworks, the free monthly song, the native
console and Google sign-in on Android. Most of it is the native app, which a
visitor to mercurypitch.com never runs. The sections below say which build
each change reaches. Reviewed before the tag in three read-only passes
(billing and workers; karaoke, lyrics and Sing; Glass and the native shell),
with every touched test file run on its own under Node 22.

### Web and API: the server names the promo, and LAUNCH runs to New Year (#896, #901)

The web client no longer carries the offered code. Until now it hardcoded
PRODUCT_HUNT and its end date, so the offer vanished from the app on
2026-09-30 whatever the row said. Migration 0054 adds `promoCodes.featured`
with a partial unique index (at most one featured code), and the public
`GET /api/billing/promo/featured` names that code only while it can be
redeemed (60 s browser cache). `src/stores/promo-store.ts` asks once per page
load and does not retry, so a page loaded while the old DB worker still
serves shows no pill until a reload. The header pill (main shell only: `/`,
`/ear-lab`, `/jam`, `/pitch-training`) and the Credits card follow it;
claiming still needs a registered account with a confirmed email.

0054 seeds LAUNCH as `promo-2026-q4`: 5 credits, cap 1000, from 2026-10-02
through 2027-01-01T23:59:59Z, featured. It is an `INSERT OR IGNORE` and
`code` is UNIQUE, so a pre-existing LAUNCH row or id would have left nothing
featured. A read-only check of prod on 2026-10-03 found only `promo-ph-2026`
(expired 2026-09-30, 8 redemptions) and no `featured` column, so the
migration inserts and features LAUNCH. Dates, switch and cap change through
admin `PATCH /api/promoCodes/promo-2026-q4` (validated by
`workers/db-worker/src/promo-rules.ts`) or the report console's Edit codes
card, never by another migration. After the deploy,
`GET https://api.mercurypitch.com/api/billing/promo/featured` must name
LAUNCH.

#896 makes `code` a private column: non-admin reads omit it, and
`?where[code]=` or `orderBy=code` answer 400. Until this deploy every prod
code was publicly readable; prod holds only PRODUCT_HUNT, which was
advertised anyway. A PRODUCT_HUNT claimant can claim LAUNCH as well.

### API: the app's free song, store review and sandbox purchases (#882, #885, 4e451246f)

All three are reached only from the native app; web origins are refused or
never take these paths. Migrations 0051 to 0054 apply on the tag through
`deploy-db.yml` (backup, reconcile, migrate), before the DB worker deploys.

- **Free monthly song once per confirmed email** (4e451246f, f6be41eea,
  migration 0053): an HMAC of the address under `FREE_SONG_EMAIL_SECRET`
  (set on prod) records the month's claim, and no email is stored. A secret
  shorter than 32 bytes falls back to per-account only, with a warning in
  the log. Plus-addressing still gets around it.
- **Play review access** (#882, migration 0051): a review code, checked
  against `REVIEW_ACCESS_CODE_SHA256`, unlocks 3 songs on up to 20 accounts.
  Android origin only; 5 tries an hour per account and 20 per IP.
- **Sandbox purchases on production** (#885, migration 0052): honored only
  while `REVENUECAT_SANDBOX_ON_PRODUCTION=bounded`, which is unset on prod
  and set only for a store review, with a daily cap.

### Web and API: separation (#905, #880)

- #905: a job RunPod will not take answers 503 "The studio is busy right
  now. Try again in a minute." instead of 502. Nothing is spent either way.
  The native import queue retries 502, 503 and 504 every 60 s; the web never
  loads it.
- #880, worker side: a web separation retries its debit once after 250 ms
  when the DB worker marks it retryable (`uvr-metering.ts`). `forApp` is set
  only for native-origin requests. For the few minutes the new main worker
  can meet the old DB worker during the deploy, a native separation would
  spend web credits.

### Web: karaoke on phones, and the lyrics (#909, #913, #915, #917)

- **Streaming stems** (#909; phones with `AudioDecoder`): every start, seek
  and loop fades in over 15 ms; a stem window the clock has already passed is
  dropped instead of playing as a one-frame click; a stream more than 4 s
  behind reopens at the clock; a decode error is retried twice, and a third
  pauses the song with "The music stopped playing. Press play to carry on."
  (v0.9.14 logged it and played on without that stem).
  **Known issue:** a packet that fails in the same place every time is
  retried from that place (`pickUpPoint` in `streaming-stem-voice.ts`), so the
  song pauses each time the decoder nears it, up to two 4 s windows before
  the playhead, and never plays past it or ends. It needs a corrupt or
  truncated stem; reproduced on a synthetic 60 s stem with a bad packet at
  58 s. The fix goes with the stem mixer refactor.
- **Lyrics re-center on resize** (#913): `KaraokeMobileStage` puts the
  current line back in the middle when the sheet changes size, unless the
  singer scrolled in the last 3.5 s. With no synced lyrics the finder shares
  that scroller and a resize scrolls it to the top; whether a soft keyboard
  does that while someone types is unverified on a device.
- **Pause on the audio clock** (#917): `handlePause` calls `catchUpClocks`,
  so pause and resume start from the audio clock rather than the last drawn
  frame. The rest of #917 is native only.
- **The held last word** (#915): for songs with a stored note analysis, a
  line's end and its last word's sweep follow the sung note
  (`lyric-sung-end`) and ignore the next line's early pickup.
- **`.lyricsfile` export** (#915): `lyricsfileInputFromCanonical` puts word
  timings on their own line after a rest, and inline-timed songs (the
  examples) now export `words:` blocks. Serializer and parser are unchanged;
  a file exported by v0.9.14 reads as written, misplaced word timings
  included.

### Web: the Break Glass challenge plays a recorded shatter (d206f9870)

Two sampled takes (`shatter-sounds-v1/large-panel-01` and `-02`, served from
`/glass-game-assets`) replace the synthesized break, at the volume of
Glassworks' museum audio setting. Things to watch: the page waits for the
sounds (up to 5 s) before asking for the microphone; a failed download
leaves that session's breaks silent; the decoded-length cap in
`shatter-buffer-cache.ts` (408,000 samples) rejects both takes on a 192 kHz
output device; a museum mute carries over to `/glass`, which has no control
to undo it. `/glass` now needs `/glass-game-assets` to stay served.

### Web: smaller changes

- 7eace9cf2: asking for a mailed code again shows "Still nothing? Check the
  address and your spam folder, or try again in an hour." Every successful
  sign-in goes through one `signedIn()` helper.
- #897: iPad and tablet wording in the music level tooltip, the
  noise-cancelling hint and the too-big-song message (`device-noun.ts`). An
  Android tablet whose Chrome requests desktop sites still says "phone".
- #884: notifications on a notched phone held sideways keep clear of the
  notch. The rest of #884 is under `:root[data-native-shell]`.
- #911: em dashes out of the Ear Lab copy (Ear Report, field book, regulator).
- #904: every pitch canvas now reads `performance.now()` and an optional
  window accessor per point; the drawing is unchanged on the web.

### Glassworks at `/glass-game`: still unlisted on production (#894 and direct commits)

**Not announced in `CHANGELOG.md`**, which ships inside the web app. The
v0.9.14 hide (#883, `VITE_GLASSWORKS_LISTED`) is unchanged and nothing new
points at `/glass-game` on prod. New on dev: Merc's narration and attentive
idle (57ac846f6); dimensional living crystal studies with renderer gates
(6e3b3805f); results, automatic singing and an optional crystal course
(0754d0e2e); wide exhibits and pause controls that fit a phone, and mobile
asset tiers (1f0298bd0, 0d9d1fba1); pearl currents and progressive Rosebud
shattering (d09995112); living glass through the Thawing Song (d581f76f1);
the Diadem Tide and Lotus exhibits (3d907185c); the Singing Current moving
course (ccdd1b8d9) with live pitch, a gentler configurable pace, museum
scenery, soundtrack controls and authored runner glass (c49cea9bc, 99f3b9522,
7458f8646, fdc5d62d9, d206f9870); singing that starts at visible circle
contact and tiered melody correction (d6f631827, 2b14bb772); corridor camera
and touch fixes (#894 and others). The Resonance Conservatory now starts
locked until earned.

Assets: 236 staged files, 336.4 MiB. 42 new files add 52.45 MiB and 10
recompressed ones save 19.28 MiB; the largest file (25,596,100 B) is
unchanged and under the 25 MiB limit. Each deploy's Git LFS download grew
from 204 MiB to 239 MiB.

### Native app only (not in the web build)

Mercury Pitch Cloud sold in the app, with web credits kept out of it (#880);
Play review access (#882); the status bar and the Ear Lab pill (#884); the
Rooms screen's own picture and the app's own fonts (#895); device names in
the native sheets (#897); the pictures Progress and the Leaderboard draw
(#903); a song that keeps playing in the background (#906); the lyrics in a
small window on Android (#907); the small window, the microphone on return
(#909); store shots and their Ear Lab seed (#910, #911, #912); the lyrics back
in view after picture-in-picture, and a debug console switch (#913); a moving
progress bar in the media notification (#916); seek, a steady pause and
artwork in the system's media player (#917); the last song's artist cleared,
and "Unknown artist" for a song without one (#919); the account-deletion
link in About (b1ff2b23c); the Rooms welcome's door count (5a560d3fc); the
floating developer console out of the store build (830f1fabc, f0703d70b);
Google sign-in on Android (9832ba3f2); the debug APK's name (b62762355); and
the native release packaging heap (50bce9b46). These ship through `mp-v*`
tags; `mp-v0.8.7` (TestFlight 509) carries #915 to #918.

### Tooling and tests

- #900: the motion-designer, motion-critic and agent-team-architect skills.
- #902: the SQLite node-tests are typechecked, and that check now gates the
  prod DB deploy.
- #918: the Glassworks voice test counts Merc's narration by its file, not
  its length, after a recorded shatter of 0.878 s passed for narration.

## [0.9.14] - 2026-09-28

283 commits since `v0.9.13` (73 on `main`'s first-parent line): PRs #859,
#860, #863, #864, #865, #866, #867, #869, #870, #872, #873, #875, #876, #877,
#879, #881 and #883, plus direct commits for the Jam audio work and most of
Glassworks. Most of it is the
native app (`apps/mercurypitch`, and root `src/` code folded in or out by
`IS_NATIVE_BUILD` / `__NATIVE_BUILD__`), which a visitor to mercurypitch.com
never runs. The sections below say which build each change reaches.

### Web: Glassworks is served at `/glass-game`, unlisted on production (3076872d5, #863, #867, #869, #872, #883)

**Not announced in `CHANGELOG.md`.** Glassworks belongs to Beside Cue for
now (owner, 28 Sep). #883 (f17b5649f) keeps the production web build serving
`/glass-game` (entry page, service-worker rule, staged assets) while nothing
points at it: no Home card, no Home tour step, no `sitemap.xml`, `llms.txt`
or prelude link, and the entry page carries `noindex`. The switch is
`VITE_GLASSWORKS_LISTED`, set per Vite mode (`1` in `.env.development` for
`pnpm dev`, `build:dev`, the dev deploy and PR previews; `0` in
`.env.production` for `build`, `build:tours` and the `v*` tag deploy;
`build:e2e` forces `1`). `vite.config.ts` pins it with a `define`, so
`GLASSWORKS_LISTED` (`src/lib/glassworks-listing.ts`) folds and an unlisted
bundle carries no card or tour step. `scripts/assert-glassworks-listing.mjs`
checks every surface on the finished `dist/` of each of those builds.

What follows describes the listed build, which is what dev shows.

A new standalone entry, `src/features/glass-adventure/main.tsx`, mounts the
shared `@irchiinnuss/glass-game` campaign (the same package BesideCue's
games-enabled builds use) behind its own host (`host.ts`: storage prefix
`mercurypitch:glass-adventure`, assets from `/glass-game-assets/`). The entry
paints the accessible prelude first and only then imports the campaign
chunk (2db7aac73), so the Three.js renderer is not in the entry's static
graph; `vite.config.ts` files Three under its own `vendor-three` chunk so the
other standalone rooms do not download it.

Where it surfaces on the web:

- a **Home card** (`DestinationGallery.tsx`, second after live practice,
  `data-tour="home.glassworks"`) and a new **Home tour step** ("A museum that
  listens") in `HOME_TOUR_STEPS`, whose first step lost the "keep an eye on
  the last card" teaser;
- an **entry page** in `src/seo/entry-pages.ts` (slug `glass-game`), a
  `sitemap.xml` URL, an `llms.txt` line and a link in `index.html`'s prelude;
- `STANDALONE_DOCUMENT_PATHS` in `sw-runtime.ts` gains `/glass-game`.

Assets: `tools/glass-game-assets.ts` (`glassGameAssetsPlugin`) stages the
package's assets into `dist/glass-game-assets/` at build time and refuses a
Git LFS pointer. A local build therefore needs the same
`git lfs pull --include="apps/beside-cue/public/games/**,..."` that
`build.yml`'s "Hydrate runtime game assets" step runs. Measured on this
release's `build:tours` output: `dist/` is 469 MiB and 1787 files, of which
`glass-game-assets/` is 331,836,234 bytes. The largest single file is
`journey-map-v10/floating-museum-botanical-kit-v10.glb` at 25,596,100 bytes,
under Workers static assets' 25 MiB (26,214,400 bytes) per-file limit with
about 600 KB to spare. There is no Glassworks-specific social card: the
entry page uses the shared `og-image.png`.

Content across the merges: the floating museum and Cloudway platform trial
(3076872d5), Crystal Promenade and the floating touch pad (#863), tablet
navigation and singing-startup fixes (#867), The Thawing Song teaching a
whole melody (#869), frost courses and shatter variants, creator studies
and course authoring, bounded mobile rendering quality (eaf7eb060), and
mobile playback plus Merc art and song auditions (#872). 3076872d5's own
message records that real mobile play "exposed performance and
interaction-discovery work that remains a dedicated follow-up; this merge is
not release approval". That is why the production build does not list it.

### Web: Jam rooms send an instrument, and measure the connection (direct commits)

- **Capture profiles** (303257373, e30d80cbf). `voice` is the old behaviour;
  `instrument` takes a named input and transmits the raw capture, with no
  processed clone. The capture itself is raw for both, because it also feeds
  the pitch detector and `makeTransmitTrack`'s echo-cancellation guard. What
  the browser actually granted is read back from `getSettings()` and
  reported, including resampling from a 44.1 kHz interface.
  `voiceIsolation: false` is set explicitly. A change of input or profile
  re-captures (new device opened first, mute carried across, `replaceTrack`
  on the live senders, pitch detector restarted); before this, a capture
  could not be replaced short of leaving the room.
- **Inputs** (b600abf8b, da3e3407a, 3e88ae4d7). PulseAudio/PipeWire
  "Monitor of ..." sources sort last as "(playback)" and are never resolved
  to by label (Chromium already hides them; Firefox does not). The remembered
  input is keyed by id, then by label, because a PipeWire profile switch
  changes the id. Capture no longer asks for `channelCount: { ideal: 1 }`,
  matching Guitar Night; unnamed devices read "Device N", not "Input N".
- **The control** (2f1401634, 95c5d8e1c, fb767ded8, 3f930739d, a557dbe08).
  The mute button is a 36 px split control: a press transmits, a corner
  badge, right click or 450 ms long press opens the source menu. The first
  press on a device opens the chooser instead of going live (persisted, asks
  once). Instrument + live + default input turns it red. The menu is
  positioned by measurement (`menuPosition`), portalled to the page root at
  z 9000 with an opaque `--jam-menu` token, capped to the room it has, and
  keyboard-navigable. On state is a filled disc drawn with a literal colour,
  not the alpha-bearing `--bg-primary` a room redefines.
- **Latency readout** (0175ee8ca, 864d7f86b). `service.ts` polls every 3 s
  on one timer, reads the transport's `selectedCandidatePairId` (freshest
  packet on a tie), and adds a DataChannel ping/pong that expires after five
  unanswered rounds. `leaveRoom` now stops the poll and clears pending pings.
- **10 ms Opus frames** (e9199f2b9, e30d80cbf). `jam-sdp.ts` sets
  ptime/maxptime/minptime 10, `usedtx=0`, mono, a bitrate cap via
  `setParameters`, and a 20 ms playout target. The first cut never landed:
  the rewritten SDP gained a blank line libwebrtc stops reading at, and a
  deferred `onnegotiationneeded` was dropped. Both fixed in e30d80cbf;
  whether two real peers now measure 100 packets/s has not been recorded in
  a commit since, so the user notes do not claim it.
- **Diagnostics, not for everyone.** The network panel (`JamNetworkPanel`,
  `jam-diagnostics-store.ts`, markdown and CSV export with `kbps out`,
  `packetsPerSecond`, `frameMs` and a NOT SENDING line) and the per-channel
  input check render only where `IS_DIAGNOSTIC_BUILD` is true **or** the
  browser has opened the app once with `?jamdiag=1` (remembered in
  `mp_jam_diagnostics_unlocked`, cleared by `?jamdiag=0`). That second door
  works on production too; it shows a person their own connection stats. The
  component ships in every bundle and only its render is withheld.

### Web and API: accounts (#864, #865, #870)

- **Federated linking** (#864). `resolveFederatedUser` step 2 adopts an
  existing account by address only when that account's own `emailVerified`
  is 1; otherwise the identity gets a new account without the address
  (e30283018). The first provider's `providerId` is kept on adoption
  (a648b1fa3). Migration **0050_apple_sub.sql** adds `users.appleSub` with a
  unique partial index, written with `UPDATE OR IGNORE` on every Apple
  sign-in, and matched by Apple's step 1 and by the server-to-server
  notification route (6791cf172, c0aace3ab), so consent-revoked and
  account-delete find an account Google linked first.
- **Names** (37d99c487, 71190ed57, f1ea96116, 1cc79178b). Apple's
  first-authorization name fills a default handle (four- or six-character
  form) only; Google no longer renames a returning account; neither
  provider overwrites a name chosen while anonymous (`replaceDefaultHandle`).
- **Apple accounts on the web** (#865, 3eb699769, a36825c93). Four surfaces
  (`AccountSection`, `HeaderAccount`, `DonatePanel`, `ReturningSignIn`)
  allow-listed password and Google, so an Apple account read as anonymous.
  They share `isRegisteredProvider` now. The account card names Apple and,
  for a private-relay address (`apple-relay.ts`, shared with the worker),
  says to keep a note of it. `ReturningSignIn` knows an `apple` last method
  but blocks it where `appleSignInOffered()` is false, which is the web.
- **Email-code sign-up** (#870, 28bdb0327, e490cbd55). `/api/auth/email-code/request`
  accepts `signUp: true` and then mints a sign-up code (`NO_ACCOUNT_YET`
  row) for an address with no account; verifying it creates a confirmed
  account, upgrading the device's anonymous account in place when
  `deviceId`/`deviceSecret` are sent. Only the native sheet sends the flag.
  The web `AuthModal` still calls `requestLoginCode(email, token)` without
  it, so the web behaves as before. Turnstile, rate limits, five attempts,
  ten minutes and single use all still apply. Stale sign-up codes are swept
  on every mint. #879 (737bedc7a) gives sign-up codes their own budget of two
  an hour per address, inside the existing five-an-hour one: a sign-up code
  goes to an address nobody holds, so it is the one mail a stranger could
  have sent to anybody repeatedly (S6 security review, finding 1). Every
  request that asks for a sign-up code spends it, known address or not, and
  the refusal is the same silent decoy ceremony, so it says nothing about
  whether the address has an account. Sign-in codes and the per-IP limit are
  unchanged.
- **A public page for deleting an account** (#876, 6c2242856, 4c530871d).
  Google Play asks for a web address where somebody can have their account
  and data deleted without the app. `/delete-account` is a plain document
  with no script, like `404.html`: a Rollup input, served by the asset
  layer's `html_handling` for its clean path so a signed-out hard load
  answers 200, and skipped by the service worker so a returning visitor is
  not handed the cached studio shell. It names the three ways (Settings in
  the app; Settings, Account, Danger Zone on the web; the contact form with
  the Privacy topic for anyone who cannot sign in), and says what
  `DELETE /api/auth/me` erases (`handleDeleteMe`, `USER_OWNED_TABLES`) and
  what stays: files on the device, songs backed up to the person's own
  Google Drive, Stripe's payment record, share links (60 days) and their
  preview cards (30). The follow-up corrected a claim that practice on the
  device "was never on our servers", which is not true of history and
  voiceprints, which sync. Linked as "Account deletion" in web Settings,
  About (`DELETE_ACCOUNT_URL` in `legal-links.ts`) and from `llms.txt`; not
  in the sitemap, as the other legal pages live on the landing site.
  `entry-page-og.test.ts` leaves it out of the share-card check.
- `readMe()` distinguishes signed-out from unreachable (a3de22c25);
  `fetchMe()` keeps its old null-either-way answer for existing callers.

### Web and API: separation and billing (#873)

- **RunPod blips** (3c2e4dfea). `fetchJobStatus` throws `RunpodJobGoneError`
  for a 404 only; any other failure to answer reports the job as still
  processing, so the client keeps polling inside its 30-minute bound and a
  blip neither expires the song nor refunds it. Reaches the web through the
  pages Worker (`src/worker.ts`).
- **Native separation calls** (fa2033429, 91f3a025b). The pages Worker
  answers CORS preflight for `capacitor://localhost` and `https://localhost`
  only, and serves a finished stem to those origins as bytes from R2 instead
  of a redirect. Every other caller, the web included, gets what it got
  before. Native builds ask the handler for MP3 (`output_format` in
  `uvr-api.ts`); the web still asks for WAV. The RunPod handler is unchanged.
- **The Karaoke songs subscription** (07ee68399, fca02be8c, adc153b04,
  b2509a5a4, a74f417c9, d52625dde, 0c6da9a72). The new route
  `/api/billing/revenuecat` (secret header `REVENUECAT_WEBHOOK_AUTH`, already
  set on prod) grants songs from RevenueCat events, only for the store
  environment named by the new `REVENUECAT_ENVIRONMENT` var (`SANDBOX` on
  dev, `PRODUCTION` on prod). Allowance 20 a period with a rollover cap of
  50 (`SONGS_PER_PERIOD`, `SONGS_ROLLOVER_CAP`, optional, defaults in
  `songs-allowance.ts`); the cap counts subscription songs only; a late event
  never shortens a subscription; a store refund ends the month and takes its
  songs back. `/api/billing/me` gains a `songs` summary the web ignores.
- `StemMixer` gains a `hosted` mode for the native room; the web mixer never
  sets it and is unchanged, including its whole-decode path. The refusal of
  a stem that would have to be decoded whole (6213e39cf) applies only in a
  room that asked to stream. Its limit went from 2 MiB to 12 MiB a stem in
  #877 (473a19f29, owner's call): at 2 MiB it refused every full song on an
  iPhone before iOS 26, which has no `AudioDecoder`.

### Native app only (not in the web build)

- **Round 3 (#859).** The night alley is the Rooms tab and the first-run
  welcome: a plate with six door quads, a door-state reducer, room ambients
  on a looping buffer, the Sing door clip, arrival holds, keyboard and screen
  reader access, reduced-motion crossfade, landscape layout. No First Light
  and no opening curtain in the app; the launch draws the brand mark. The
  Sing room keeps one cover (the -b and -mock takes and their eight
  `public/sing/` files are gone, 9a1784e8a). CI: production reaches only the
  store binaries and only from a tag (e2fd4a4a5); every iOS web bundle is
  checked; the API base reads env files through Vite's loader.
- **Round 4 (#865).** Every screen turns with the phone and keeps inside its
  insets; iOS packaged media answering status 0 is read through a shared
  rule (`@irchiinnuss/mobile-runtime/asset-fetch`, used for the alley, the
  guitar cabinet, stem peaks and stems); voice control and its floating pill
  are off in the app; native Apple sign-in fixes (authorization code,
  scopes, remembered method); an Audio section on the Developer screen.
- **Round 5 (#866).** Alley open/cancel edge cases, the Sing room's pitch
  band on a phone on its side (`pitch-plot-band.ts`: 11 px of trace to
  60 px at 844x390), the first-run coach mark hung from the pitch pill.
- **Phase 6, account and Settings (#870).** Settings is a native screen
  stack; a native sign-in sheet (Turnstile `interaction-only`), the Account
  screen, account deletion, "what the account brought" after sign-in, a
  phone's takes carried into a new account, Storage (with a device-only
  voiceprint clear), a Microphone screen, This phone and About. The web
  Settings panel is folded out of the native bundle.
- **The Karaoke room (#873).** The Karaoke tab is a room (the Broadway
  Theater, free and packaged in the app, still a supporter room on the web)
  hosting the zen player, with three bundled example songs, a library that
  names songs, options behind a gear, a studio pushed from the room, and the
  import queue with checks, sheets and upload progress behind
  `__KARAOKE_IMPORT__` (compiled in for native test builds only; false in
  the web build and the store build). Developer switches for the
  no-streaming path read only with `VITE_PORTABLE_CONSOLE`, which
  `assert-no-portable-console` keeps out of `dist/`.
- **BesideCue games (#860)** in Android and TestFlight testing builds.
- **The store build carries no portable console (#875, 3d11f52cb).** A
  store binary is built with `MERCURYPITCH_API_TARGET=production`, and the
  committed `.env` turned `VITE_PORTABLE_CONSOLE` on, so the App Store build
  carried the console and the Developer screen. `vite.config.ts` forces the
  flag off for a production API target (`portableConsoleFor` in
  `api-base.mjs`), the store workflow sets it false on a production
  dispatch, `verify-assets` runs `assert-no-portable-console` over the store
  `dist` and its synced Android assets, and the assert now also
  fingerprints the Developer screen and each of its sections. The More
  sheet's Developer tile is a ternary so it folds out.
- **A room's own run comes first (#877, 958027093).** The session pill held
  a run parked in one room over the other room's own (TestFlight 0.7.0):
  after Karaoke the pill sat over Sing's note and took its tap; after Sing
  it sat on Karaoke's bar. A room with a run of its own now lets go of a
  run held for another; nothing is ended, and going back brings the parked
  run back paused. `probe-room-handover.mjs` walks both orders, upright and
  on the phone's side.
- **Store screenshots from the store build (#881, d73cad32b).** A local
  Playwright config, never run by PR Gate, builds the native bundle with the
  store's values and captures eight screens at the stores' pixel sizes on an
  iPhone 6.9, an iPad 13, an Android phone and two Android tablets, against
  a seeded phone, a stand-in API and a synthesised voice
  (`apps/mercurypitch/shots/README.md`).
- CI: signed APK downloads separated from Play bundles (899d55ad4); the
  ad-hoc IPA is no longer a public artifact (b21333177); the signing
  certificate's holder name is masked in iOS logs (bbbf95d29).

### Shared code that reaches the web build without a visible change

- Safe-area padding (`max(design, var(--safe-*))`) on the practice toolbar,
  song status bar, UVR header, Ear Lab, Progress and the portable console
  handle. `mobile-kit.css` maps `--safe-*` to `env(safe-area-inset-*)` and
  `index.html` has `viewport-fit=cover`, so an iPhone browser in landscape
  does get the insets; everywhere else they are 0.
- Entry pages' `<noscript>` lines drop "and never uploaded" (e0d9f4762).
- `@irchiinnuss/pitch-engine`'s mic lock stops capture before releasing and
  its errors carry a `diagnostic`; the web's own `src/lib/mic-manager.ts` is
  untouched, so on the web this reaches only the unlisted Glassworks page.
- `public/rooms/alley/` (4.7 MB: the alley plate, two ambients and the Sing
  door loop) is served from the web origin too, unused there and not in the
  service worker's precache.

## [0.9.13] - 2026-09-21

### The PeerPush badge was somewhere their crawler cannot reach (#852)

0.9.12 put the listing's badge under About in Settings, which is the right
place for a person and the wrong one for the verification: PeerPush asks for
the badge, "or just add any plain link to this page instead", and grants the
verified badge once it finds a link back. It looks for that link on the site
the listing points at, which is `https://mercurypitch.com` — the app.

Measured on prod after the 0.9.12 tag: `curl https://mercurypitch.com/` returns
**zero** occurrences of `peerpush`. The badge lives in a JavaScript chunk and
only renders once Settings is open, so a crawler that fetches the document
never sees it, and one that does run JavaScript would still have to open a
panel to find it. `about.mercurypitch.com` does carry it in its HTML, in the
footer, but that is a different host and not the URL on the listing.

So a plain text link goes in `index.html`'s entry prelude, beside the
`about.mercurypitch.com` link that is already there. The prelude is real markup
in the first bytes of the body — it exists because a non-rendering crawler saw
nothing but an empty `#root` before, which is what left four entry pages
"Discovered — currently not indexed" for a month. Whether PeerPush executes
JavaScript stops mattering.

Text rather than the 230x65 badge image: that nav is a row of text links, and
a badge four times the width of everything beside it would wrap awkwardly on a
phone. No `rel="nofollow"` — a backlink check would refuse to count one, and
PeerPush's own snippet carries `rel="noopener"` and nothing else.

The Settings badge stays. One is for people, the other is for the crawler.

`launch-entry-seo.test.ts` asserts the prelude _contains_ every sibling path and
the landing link rather than matching an exact set, so an extra link is inside
the contract it already guards.

## [0.9.12] - 2026-09-21

### A line whose first word carries no stamp is no longer deleted (#841)

`LRC_LINE_RE` in `lyrics-service.ts` requires a leading timestamp, so
`parseLrcFile` skips a body that opens with a bare word outright. The line is
not mistimed — its text is gone. Four builders emit one stamp per word and none
of them guaranteed one at the head: `lyricsfileToLrc`, `buildWordLevelLrc`,
`buildLrcTextFromCanonical` and `plainLineToLrc`. `segmentsToLrc` does not,
because Whisper stamps every word.

The maps are sparse by construction. `parseLyricsfile` fills `starts[wordIdx]`
only for a word carrying `start_ms` and keeps the line's map as soon as _any_
word had one, so a `.lyricsfile` from another tool whose opening word is untimed
lost the whole line on the way in.

One helper, `stampedLrcLine` in `lrc-generator.ts`, is now the only place that
writes a word-stamped line, and it always opens with a stamp:
`starts?.[0] ?? lineTime`. That is not a shortcut — it is the only encoding the
parser reads back. `parseLrcFile` eats the head stamp as the line time and
`parseLrcWordTimings` then reads word 0 as starting with the line, so a first
word that has a start is already fully described by the head; writing it again
would put a second square stamp at the head of the body, which is standard LRC
for a repeated line and which `parseLrcWordTimings` deliberately refuses to read
as a word time. Output is byte-identical wherever the first word was already
stamped.

A line that cannot name a time is not free to claim `0` either — `parseLrcFile`
sorts by time, so a zero head moves it to the front of the file. Callers carry
the previous line's time forward and the sort is stable, so an equal time leaves
the line where it was.

Second bug in the same path: `lyricsfileToLrc` wrote `[time] ` for a line with
no words, and a stamp with nothing after it is dropped just as surely — taking
every following timing key one index out of step. It writes `[time] ~Rest~`
now, which is what the rest of the app already uses for a timed line with
nothing to sing.

Known and deliberately not fixed here: `buildWordLevelLrc` receives no line
times (both call sites in `handleDownloadLrc` pass raw text and a map), so a
line with an untimed opening word reads back at word 1's time. Lossy; the
alternative was losing the line. Threading `lineTimes` through those two call
sites is the real fix.

`src/tests/lrc-leading-stamp-roundtrip.test.ts` round-trips all four builders
through `parseLrcFile` + `parseLrcWordTimings` rather than asserting on the
emitted text — a string assertion passes for any leading stamp, including one
the parser reads as a repeated-line marker. Two of its seven tests passed before
the fix and are regression guards for exactly that.

### The code-health ratchet had never run anywhere (#842, and a fix in #848)

`pnpm metrics:check` was listed in `CODE-HEALTH.md` §8 as "Done — freeze the
architecture baseline". It was in no workflow, no git hook, and this repo has no
husky or lefthook. It was a command a human could choose to type, and in the
five weeks from `ad480455` to today **twelve of the fifteen tracked numbers had
regressed** — `layering.crossFeatureImports` 329 -> 506, `tests.presenceOnlyBlocks`
166 -> 333, `complexity.functionsOverCognitive15` 311 -> 435, `cycles.circular`
22 -> 38.

Re-baselined onto today rather than gated against 2026-08-14, which would fail
every PR on arrival and have the gate switched off inside a day. The baseline is
a record of agreed debt, not a high-water mark.

The `Code health ratchet` job in `pr-gate.yml` is gated on the scope step's
`install` output — true exactly when a source surface is in scope — and is in
the `PR Gate` job's `needs`, so the single required check covers it. Its own job
rather than a step in `lint` because it spends ~100s on a second full
audit-ESLint pass plus dependency-cruiser; alongside the browser shards that
disappears into the existing wall clock.

`--check` also fails now when a tracked metric is _missing_, not only when one
regressed. `currentRatchet()` keeps numbers only and every collector returns
`{ skipped: '...' }` when its tool is absent, and the comparison walked
`current` — so an absent metric was never examined and the ratchet would keep
reporting "No regressions" while covering nine metrics instead of fifteen.

**It caught one the same evening, on `main`.** #847 merged on checks that had
gone green before the job existed, so the ratchet never ran on it, and its
`omits the button when no toggle is supplied` pushed `presenceOnlyBlocks`
333 -> 334. The metric counts a block whose every matcher is one of four weak
ones (`toBeInTheDocument`, `toBeVisible`, `toBeTruthy`, `toBeDefined`), and that
block asserted only `not.toBeInTheDocument()`. Fixed on #848's branch:
`toBeNull()` for the absent button, plus a count of the two unconditional
controls beside it, because an assertion that something is absent passes just as
well when nothing rendered at all.

### `lint:audit`'s errors mean something now (#843, #844)

275 errors, of which **272 were artefacts of the audit config**.
`eslint.audit.config.js` did not load `eslint-plugin-solid`, which
`eslint.config.js:5` does, so every `// eslint-disable-next-line solid/reactivity`
in `src` reported as `Definition for rule ... was not found` — 143 of them, plus
2 for `solid/prefer-for`, and the count grew each time someone correctly
suppressed the rule. It also spread `tseslint.configs.recommended` without the
everyday gate's four `^_` ignore patterns, so `no-unused-vars` fired on 127
deliberately underscore-prefixed names.

Both gaps closed, at the severities `eslint.config.js` already uses. Side effect
worth naming: with the rule actually resolving, the audit now reports the same
11 genuine `solid/reactivity` warnings that `pnpm lint` does, which is the whole
5666 -> 5677 warning delta.

The three surviving errors were real and all in `workers/db-worker/src/auth.ts`:
`endOtherSessions` imported and never called, a `RateLimitBucket` interface
nothing reads, and a `respond` parameter `handleGoogleCallback` never uses
because every exit path there redirects rather than answering with JSON.
Removed rather than renamed to `_respond` — in this codebase `_` is reserved for
a signature an external contract fixes, like Cloudflare's `scheduled()` shape at
`index.ts:2270-2272`. Together: 275 errors -> 0. The 5677 warnings are a
separate pass. Refs #464.

### The first-paint budget weighs CSS too (#845)

`FIRST_PAINT_BUDGETS_KB` was documented as "KB of uncompressed JavaScript", and
a render-blocking `<link rel="stylesheet">` stops the first paint exactly as a
script does. Measured on `608891d7`: `index.html` and the four crawlable doors
that are the main app each block on **1009 KB of CSS**, 871 of it the single
`index-*.css` that `src/index.tsx:10-13` builds by importing `uvr.css`,
`vocal-analysis.css`, `exercises.css` and `app.css` globally. Splitting that is
#379; this makes sure it cannot grow, or quietly land on a standalone page,
without the build saying so.

`documentStylesheetUrls` reads each `<link>` whole rather than matching
positionally, because attribute order inside the tag is Vite's business, and
takes `rel="stylesheet"` only — a `preload` names the same file without blocking
on it. There is no closure to walk: Vite inlines `@import` at build time.

Two tables rather than one sum, because the diagnosis differs — a JS breach
means an import dragged a feature in, a CSS breach means a global sheet grew or
reached a page it should not have. A test asserts the two tables describe the
same set of documents. Both stale-ceiling cases fail: a budget for a page the
build no longer emits, and a budget for a page that still exists and no longer
links any stylesheet.

### The agent docs were 30-44% low (#846)

`REFACTOR-PLAN.md`'s LOC table, re-measured: `StemMixer.tsx` 6,268 -> 8,172,
`App.tsx` 3,286 -> 4,723, `UvrPanel.tsx` 2,641 -> 3,444, `piano-roll.ts`
5,086 -> 5,965. `VocalAnalysis.tsx` was still listed and had been deleted on
2026-08-01 by `591bc095` — the same integration-train commit that last revised
the document.

The churn column read "Commits (last 400)", and 400 commits is fifteen days in
this repo, so that column silently meant something different at every reading.
Replaced with twelve-month churn, the window `scripts/code-metrics.mjs` uses.
§3.5's "low churn" rationale for deferring `piano-roll.ts` was wrong in the
other direction: it is the top hotspot, 61 commits in twelve months and summed
cognitive complexity 687, the highest in the codebase. It still goes last, on
difficulty rather than on safety. §3.3 is repointed at `UvrPanel.tsx`, which
carries 46 `createSignal` calls.

### StemMixer slices D and C1 (#847, #848)

**Slice D** — the melody-audition signal, its playhead-following effect, the
toggle and the synth's disposal move to
`useStemMixerMelodyAuditionController.ts`. The plan said "`melody-synth.ts`
already exists — move the remainder there"; the remainder is a `createSignal`, a
`createEffect` and an `onCleanup`, and folding those into a pure audio graph
with no Solid import would give a leaf module a dependency on both the audio and
the pitch-analysis controller. Same call slice F made (#683).

Worth recording: the original effect reads `elapsed` _before_ deciding whether
to sound anything, and the first explanation written for it — that this is what
subscribes the effect to the playhead so a mid-song toggle follows immediately —
is wrong. `enabled` is tracked, so a toggle re-runs the effect by itself. What
the early read really does is keep the effect subscribed while the feature is
off, waking every frame to re-send silence. A mutation test caught it. The
ordering is preserved exactly; narrowing it is a behaviour change wanting its
own PR.

**Slice C1** — the alignment memo's note-source ladder becomes
`selectAlignmentNotes()` in `transcription-alignment-utils.ts`, beside
`selectAlignmentSegments` and `computeAlignment`. Slice C was three unrelated
things and the plan table now carries them as three rows: C2 (auto word-sync) is
reactive orchestration and belongs in the lyrics controller, and C3 is mis-filed
— it is A/B loop plumbing, not word-sync, and belongs with slice A.

One behaviour-adjacent change, stated plainly: `audio.getPitchHistory()` was
called only when both offline series were empty and is now called on every
recompute. Safe here specifically because it is not reactive —
`useStemMixerAudioController.ts:1819` defines it as `() => pitchHistory`, a plain
closure over a mutable `let`. The expensive part, mapping and merging the
history, still happens only on the rung that needs it, and a spy asserts that.
`canonicalLrcLines()` **is** an `Accessor`, so its read deliberately stays after
the no-notes return: hoisting it would subscribe the memo to every lyric edit
with nothing to align, and each recompute hands downstream a fresh object.

### A quarter less data on the landing page (#850)

Lighthouse 13.5.0, mobile preset, five runs each of `main` and the branch back
to back, because a single run on this app swings the score six points. Page
weight 3049 KB -> **2266 KB**, LCP 17719 ms -> **14858 ms**, score unchanged at
51 — the LCP curve is flat that far out, so the improvement is real for people
on phones and invisible to the number.

- **mediabunny on demand.** `jam-store` imports `StemEncodeAbortedError` from
  `portable-audio`, and a value import drags the module's dependencies with it,
  so every visitor downloaded a 169 KB audio encoder to look at a landing page
  that never encodes anything. Both use sites were already inside `async`
  functions. -133 KiB, and the chunk is no longer requested.
- **Fonts as variable ranges, off the critical path.** The request asked for
  four static cuts per family while the stylesheets ask for 650, 680, 720, 750,
  760, 780 and 800 — every one of which the browser rounded to the nearest cut
  it had. `wght@400..800` renders them as written, in one file per family.
  `display=swap` was already set, so text always drew in the fallback and
  swapped; `media="print"` + `onload` only stops the document waiting for that
  to become possible. -841 ms of render-blocking time. A `noscript` copy covers
  JavaScript being off, and `script-src` already carries `'unsafe-inline'`.
- **Gallery cards at card size.** The cards render at 378 CSS px on a phone and
  434 on a desktop and were handed the rooms' full backgrounds — 1672x941, and
  2048x1143 at 401 KB for the jam stage. Each has an 880w and a ~1100-1320w cut
  now, chosen with `srcset`/`sizes`; the jam card is a CSS background so it uses
  `image-set` with a plain `url()` first, without which a browser lacking
  `image-set` would fall back to the 401 KB original. -597 KiB. The originals
  are untouched — the rooms still load them.

`home-destinations.test.tsx` derives its set of permitted pictures from
`BACKGROUND_CATALOG`, so a cover pointing at a supporter picture fails there
rather than shipping. Rather than loosen that, it strips a cut back to its
source and checks _that_, so a card cut of a supporter picture still fails.

### Every share surface reports, and none of them borrows the Mirror's name

Measured against prod D1 on 2026-09-21: `trackFunnel('link_copied')` had
exactly two call sites, both in `MirrorApp.tsx`. The account page's Copy link
and Share, and First Light's Share on the twin beat, fired nothing at all — so
a share from either was invisible in D1, in GA4 and in the report console, and
the only shares anyone could count were from the standalone Voice Mirror. maff
tested all three on prod after the 0.9.11 deploy and only the Mirror's two
copies landed, which is what surfaced it.

The obvious fix — reuse `card_shared` / `link_copied` — is the wrong one twice
over:

- `card_shared` is a live Google Ads conversion action. Firing it from two more
  surfaces silently changes what a running campaign is bidding on.
- `mirrorEvents` stores `id`, `createdAt`, `clientId`, `event` and a
  `metricsJson` that only `results_view` writes. There is no surface column, so
  two surfaces under one name can never be told apart again — not in a query,
  not retrospectively.

So each surface gets its own name, all three added to
`src/lib/funnel-event-catalog.ts` (which the db-worker builds its ingest
allowlist from, so client and worker cannot drift):

| Name                | Surface                            | Fires on                                         |
| ------------------- | ---------------------------------- | ------------------------------------------------ |
| `voice_share`       | Account -> Voice, Share            | `shared`, `downloaded`, `downloaded-link-copied` |
| `voice_link_copied` | Account -> Voice, Copy link        | a clipboard write that actually succeeded        |
| `onboarding_share`  | First Light, the twin beat's Share | `shared`, `downloaded`, `downloaded-link-copied` |

None of the three is an Ad conversion. `voice_*` go through
`trackEvent` (`src/lib/analytics.ts`) because the account page is the app;
`onboarding_share` goes through `trackOnboarding`
(`src/features/onboarding/funnel.ts`) because First Light has its own funnel.
`dismissed` (the sheet opened and was closed) and `unavailable` (no twin card
to share) count nothing — a share that did not happen is not a share.

**Deploy order.** The worker rejects a name it does not know, and `beacon()`
never reads the response, so an event the worker has not learned yet is dropped
silently. `deploy-db.yml` lists `funnel-event-catalog.ts` in its dev push
filter, so merging to `main` redeploys dev's db-worker; `build.yml`'s
`deploy-db-prod` runs unconditionally on any `v*` tag, so the release tag ships
both halves. The two jobs inside one tag are not ordered against each other, so
a share in the first minute or two after a prod deploy may still be dropped.
Nothing to do about it beyond knowing it.

Tests: `src/components/__tests__/VoiceSection.test.tsx` (both buttons, all five
outcomes) and a new `src/tests/onboarding-share-metric.test.tsx`, which stands
First Light on the twin beat through the store rather than walking the whole
flow. `workers/db-worker/src/funnel-events.test.ts` already iterates every
catalog array, so the three names are covered on the worker side for free.

### PeerPush

`peerpush.com/p/mercurypitch` lists the app, and the listing links back. Their
own badge image (460x130, served at 230 CSS px), under the About links in
Settings rather than inside that row — at 230px it would be four times the
width of every pill beside it. Held at `opacity: .78` until hover: it is an
acknowledgement, not a call to action. No CSP change needed —
`public/_headers` already allows `img-src ... https:`.

The Product Hunt badge stays where it is, on the billing Promo Codes card,
where the launch bonus it refers to lives. The landing gets its own, in the
disjoint-colliders repo.

## [0.9.11] - 2026-09-20

Four things from the owner's tablet pass over 0.9.10 on prod, all in the jam
room -- and then two more from the pass over those: the room's rows, and a
lyric sheet that would not be scrolled.

### The sidebar song list was empty on a tablet

`JamRoomPanel` mounts `JamPickerList` only when the list is on screen, so a
phone does not load a library behind a closed drawer:
`!isMobile() || sidebarOpen()`. `isMobile()` is
`(max-width: 768px), (pointer: coarse)` -- true for ANY touch screen. A tablet
in landscape keeps the sidebar on the page at full width and never opens a
drawer, so `sidebarOpen()` stayed false and the list was never mounted. The
popup picker has no such gate, which is why the songs were there and not here.

The question being asked was "is the sidebar a drawer", and the drawer is
turned on by `AppSidebar.module.css` at `(max-width: 768px)`. That is
`isNarrow()`. The pick handler closes the drawer on the same condition now.
Two unit tests (a touch tablet mounts the list; a pick there leaves the
sidebar alone) were written first and fail on the old panel; a browser spec
runs the room at 1180x820 with `hasTouch`.

### The list sat flush under the listening pill

`AppSidebar` spaces its PANELS (`gap: 10px`), and the room card and the song
list are two `CollapsibleSection`s inside one panel. They get a flex column
with the same gap. The spec measures it.

### The pitch-guide caption is gone; the notices stay

`JamPeerLanes` drew "Pitch guide: saved on this device" (and three siblings)
above the lanes whenever a guide existed -- a row taken for good to say
something once. It is removed along with `GUIDE_CREDIT_TEXT`. The `working`
and `unavailable` notices are untouched, and a guide made in the room is
still announced by the existing "Pitch guide ready" toast. The banner's
`ready` kind keeps its `credit`; nothing draws it.

### The guide vocal has three homes, one at a time

It led the playback row: the first button of the transport and the one thing
in it that is not transport. It now floats over the words, the way the sing
pill does on the karaoke stage.

- `JamSongLyrics` takes `corner?: () => JSX.Element` and owns WHERE: right
  corner for left and centre alignment, left corner for right alignment. The
  right corner has the who-sings column at the trailing edge of every row
  (16px gutter + 20px button), so the control is inset 52px. The scroller
  gets 56px of bottom padding so the last line rests above it, and a song
  with no words (the finder has the panel, and scrolls itself from another
  stylesheet) gets the same room from `data-wordless` on the panel.
- The control is built ONCE per appearance. The stage's song object is
  replaced whenever its words, notes or parts change; an inline builder is a
  new function each time, and the first version rebuilt the pill on every
  such change -- which showed up as one browser test reading a null box, and
  would have dropped a drag mid-song. The stage now passes one stable builder
  behind a memo, and the panel builds untracked behind a boolean `when`.
- Over text the room's glass is wrong (the level track opened with a lyric
  running through it), so `JamGuideVocal` takes `overWords` for a near-solid
  capsule.
- A phone (`max-width: 640px`) keeps the dock above the tab bar. A SHORT
  screen that is not a phone (`max-height: 600px`: a phone on its side, a
  small window) leaves the words a strip a line or two tall, the capsule
  opens 104px upward, and the panel clips what does not fit -- at 844x390
  the control was invisible. There it goes back to the playback row. The
  three media queries are mutually exclusive and a unit test reads both
  stylesheets to keep them in step.

Measured with a throwaway probe at the minimum split share: the expanded
capsule fits at 1180x820, 820x1180, 1024x600 and 1366x640. Not tried on a
real tablet or phone.

### Two rows above the words, not three

Owner report: "our song takes too much space in the third row". A song room
had the header, the playback controls, then `JamSongStage`'s own bar (name,
line count, take, timeline, Original/Edited). The owner's second proposal is
what shipped: `<room name> <song name> <rest>` in the header, and the timeline
after the playback controls.

- **`JamNowSinging`** is the first item of `.roomStrip`. A button: the `title`
  attribute carries the whole name for a hover, a tap toggles `aria-expanded`
  and lets the name wrap where it stands (no popover -- the strip is a sideways
  scroller on a phone and would clip one). It closes for a new song, keyed on a
  MEMO of the id: the song object is replaced whenever the pitch guide lands or
  the words are edited, and `on(() => jamSong()?.id)` re-fires for each. The
  unit test for "stays open through an update to the same song" found that.
- **`JamSongTimeline`** is the old bar minus the name, mounted in
  `.transportRow` as a SIBLING of `.exerciseBar` (on a phone the bar is a
  sideways scroller, and a timeline must not slide out from under the thumb
  dragging it -- so the scroller moved from the row to the bar). It can live
  outside the stage because a seek was already a request the stage answers
  (`jamSongSeekRequest`); the one thing it still needed from the element was
  the file's real length, which the stage now reports through
  `jamSongMediaDurationSec` from `durationchange`. That reset is keyed on a
  memo of the source for the same reason as the chip -- an element whose
  source has not changed never reports its length twice, so forgetting it on
  every song-object update would be for good. A browser test holds the
  timeline at the file's 4 s through the pitch guide landing.
- **Measured, not assumed.** The first cut made things WORSE at the owner's
  size. With the sidebar open an 1180px tablet has 856px of room:
  - the chip (`flex: 0 1 auto`) wrapped the strip and the header went 38px to
    60px. A wrapping row breaks on what an item ASKS for before it shrinks
    anything, so the chip now asks for 6.5rem and grows (`flex: 1 1 6.5rem;
max-width: max-content`), with a floor so it is never squeezed to a note
    and an ellipsis (it was 22px wide at one point);
  - the squeeze then landed on the room's name, which broke over two lines
    (38px to 48px). Above 900px the title does not shrink and the strip does;
  - the timeline wrapped under the buttons whenever Original/Edited was in it:
    a host's bar is 434px, which leaves 410. The picker moved to `JamAssignBar`
    -- the other host-only bar, which already edits the sheet under it -- and
    stays on the timeline only in the phone layout, where that bar is two lines
    with a half-empty first one. One instance at a time, chosen by
    `jamPhoneLayout()` (640px, the stylesheets' number; `isNarrow()` is 768 and
    would disagree with them in between);
  - the row's wrap point is a LENGTH (`flex: 1 1 380px`), not `auto`: the line
    chip becomes "Break · next 12 / 26" and a take score appears mid-song, and a
    row that broke on its content would jump under the singer. A container
    query drops the take's small print under 470px before the timeline loses
    any length.
- **Tablet upright.** Beside a fixed 366px of room buttons there is no row
  left, and the strip was already stacked one pill per line (92px of header for
  a room of one, before this change). 641-900px now gets the phone's answer:
  name and buttons, then the strip on a line of its own. 73px.
- Result at 1180x820, sidebar open, a real host's bar: header 38px, one 44px
  row, words from y=172 instead of about 217; timeline 216px long. At
  1366/1280: 402/316px. A bar crowded past 380px of leftovers wraps the
  timeline under the buttons, which is the old height and no worse. (These
  are the numbers BEFORE the capsule below, which more than doubled them.)

### One capsule, and a More button

Owner, after testing the two rows: the live-pitch toggle "is just sitting in
the middle" between the transport and Unison / Harmony Stack / Relay, and do
those make sense on a karaoke song? Asked for: a container like the
transport's, the basics always there, the rest behind a "..." that can be
left open -- the practice bars' More.

- **They do not make sense on a song, and that is checkable.** The room mode
  is read in two places: `jamMyRole`, which deals out `jamExerciseMelody()`
  through `targetForRole`, and `JamExerciseCanvas`. Nothing under
  `JamSongStage` reads it; a song's parts are dealt line by line in
  `JamAssignBar`. So on a song the picker is not folded away, it is not drawn,
  and neither is More, which would have had nothing behind it. The "You sing:
  Third" badge is gated the same way -- left at Harmony Stack from a drill, it
  named a part on a song that nobody was singing.
- **`JamControlBar`** (new) takes the transport, the tempo, the toggle and the
  mode picker out of `JamPanel` (-110 lines from an oversized file). The
  capsule is the transport's old glass; `JamTransport` draws `bare` inside it
  (`display: contents`, so its buttons are items of the capsule's own row).
  A guest's capsule is the one button that is theirs. On a phone the toggle
  lives in the room menu, so a guest's capsule would be an empty box and is
  hidden.
- **More** is the practice bars' contract -- same labels, `aria-expanded`, the
  active look while open -- with two differences. It is remembered
  (`jamMoreControlsPinned` in `jam-view-prefs`, a validated boolean), because
  a host who sets the tempo between every take should open it once. And what
  it opens is REMOVED when folded rather than squeezed to `max-width: 0`: a
  zero-width control still takes keyboard focus, and still costs a wrapping
  row one of its gaps. `.extras` is `display: contents`, so the tempo and the
  mode wrap one at a time on an upright tablet instead of as a block. The
  entry animation grows in place; the first cut slid in from the left, and a
  control that wraps to the start of the next line began outside the row (the
  browser test measured it 6px out).
- Tempo goes behind More with the mode, as it does in the Compose bar.
- Measured at 1180x820, sidebar open, a real host on a song: the bar is 205px
  (was 434), so the timeline is 627px and its scrubber 445px (was 216). The
  preview room's note no longer wraps the row at that size -- it is within 6px
  of doing so, which is why the tablet test still hides it, and why the
  "wraps when there is no room" test moved to a 1000px window.

### The lyric sheet would not be scrolled

Owner report: "the lyrics when playback is running now stick the current line
into the middle of the panel, and do not allow scroll". `JamSongLyrics`'s
follower read `lineIndexAt(lines, positionSec())` through a plain function, so
it re-ran -- and re-centred -- on every tick of the song's clock. A scroll
lasted a frame.

- `currentIndex` is a memo, so the follower hears about a new LINE and nothing
  else, and carries `{layout, lines, centred}` from run to run.
- `lyrics-hands-off.ts` says when the words are in somebody's hands, from INPUT
  events -- wheel (not ctrl+wheel, that is the size), a one-finger touchmove (not
  two, that is the pinch), scroll keys, a press on the scrollbar -- and never
  from `scroll`, which cannot tell the reader's scroll from the sheet's own
  glide. `scroll` only EXTENDS a hold that input opened, which is how a fling
  is covered. A finger resting on the glass holds for as long as it rests.
- It never stays away: `held()` is tracked, so when the hands go the follower
  runs again and asks where the song is NOW. The first version raised an
  `owed` flag during the hold instead; a pause that settles a hair under a
  line's start and back raised it, nothing could lower it, and a stopped song
  pulled the sheet back to a line it had never left -- the browser spec caught
  that about one run in three.
- One thing is never paid back: a line that changed under the hand on a song
  that is NOT running (`playing`, a new prop). The same spec went on failing
  about one run in six, only on a busy machine, and the cause was the spec's
  own timing making a rare thing common: its wait for the glide to finish is
  1.5 s long, its lines are 1.5 s long, so its pause landed on the END of a
  line every time. A pause fades the audio out, the fade carried the clock
  into the next line after the wheel had already opened a hold, and the
  release paid that line back -- 242px, on a paused song. The line is taken
  as read instead; the next one to start brings the sheet along, and a seek
  with no hand on the words still moves it at once. A probe that logged events
  never reproduced it: its own 50 ms moved the pause off the boundary.
- The run-in (a stop, a scrub to the top) takes the sheet to the top; a break
  between lines leaves it alone. A new layout still re-pins at once, unless the
  hands are on it.
- `jam-lyrics-follow.spec.ts` drives a real wheel and a real CDP finger against
  a playing song. Its tone is served in RANGES: a plain `route.fulfill` makes
  an element that is not seekable at all, and a jump to the middle lands on
  zero -- no other jam spec plays from the middle, so none had noticed.

### The karaoke sheet: what the owner "sometimes saw"

"I saw this sometimes happen on karaoke night and stem mixer components ...
worth auditing." `useLyricsScrollController` had three defects, each with a
test that fails on the old controller:

1. **Scrolling UP switched following off for good.** `isBackOnActiveLine` only
   asked whether the line's top was above the settle line, which is true of a
   line scrolled off the TOP of the panel as well. It is two-sided now.
2. **Nothing ever gave following back.** Only scrolling the sung line into view
   did. `FOLLOW_RESUME_MS` (3.5 s of no scrolling) does now.
3. **One glide's timer unmarked the next.** Each automatic scroll set a
   timeout to clear the "this scroll is mine" mark; a second glide inside that
   window had its mark cleared early, and its own scroll events then read as
   the reader's -- following switched off by itself, mid-song. One timer,
   cleared when a new glide starts, released on `scrollend` where there is one.

### The jam room's words, word by word

Owner: port "our best implementation" of the word highlight into a jam room's
lyrics, reusing it if possible.

- **The arithmetic was already shared, and stays the only copy.**
  `computeActiveWord` (`lyrics-service`) is a pure function that Karaoke
  Night's stage and the mixer's lyric panel both call; the room calls it too,
  through `jam-line-words`. A word starts in a room at the moment it starts
  in Karaoke Night, and a fix to one is a fix to all three. The JSX was NOT
  extracted: the other two carry note glyphs, run-in cues and letters inside
  each word, so a shared component would be a third shape rather than a
  common one. `JamLineWords` is fifteen lines.
- **The data was there and thrown away.** Word starts live INSIDE the LRC text
  (`[mm:ss.xx]` between words); `lrcToSongLines` ran `stripWordTimings` over
  each line so a singer would not read the clock, and kept nothing. It reads
  them first now, with the mixer's own `parseLrcWordTimings`, and keeps
  `words` + `wordStartsSec` on the line. The `<mm:ss.xx>` spelling is respelled
  on the way in -- the app's parser only reads the square one, and
  `stripWordTimings` handling both is the evidence both are in the wild.
- **Word ENDS** (a held note, a word before a breath) are the other half of a
  mapping. They are keyed by the line's index in the FILE, so they are looked
  up before empty lines are dropped. `lrcTextToSongLines` is the one door for
  text: the caller's map if it has one (a stored version does), else the
  `[x-mp-timing:...]` tag the app writes into its exports. Sweep curves are
  not sent -- a nested map per word, and `computeActiveWord` fills linearly
  without them.
- **Nothing on the wire changed shape.** `sendSong` passes `lines` wholesale
  and `songFromWire` copies them wholesale, so optional fields on a line are
  the whole protocol change: an older guest never looks, an older host never
  sends, and either way the words still light up -- a line with no mapping is
  shared out evenly, exactly as the mixer does for a line-timed sheet. What
  arrives is checked before it is trusted (`jamLineWords`): words that add up
  to the text, a finite start for every one, or the mapping is ignored.
- **Cheap on purpose.** Only the CURRENT line is split into spans; every other
  row stays one text node. One memo computes the progress, with an `equals`
  that keeps a paused song or a lit word from waking the line every frame.
  `.word { transition: none }` is load-bearing (Karaoke Night's lesson):
  animating `color` across the swap to a clipped gradient flashes the glyphs
  transparent on every word.
- The version picker can now tell a word-level correction from the original
  by the lines alone (`sameLines` compares word starts), where it used to need
  to remember which button was pressed.
- `jam-word-highlight.spec.ts` samples the fill every frame from INSIDE the
  page: a word fills in a third of a second and then waits lit, so a poll
  from outside sampled the wait and never once saw a fill.

### The shared parser reads `<mm:ss.xx>` itself

The respelling above was a shim in the jam room; Karaoke Night and the mixer
still saw an enhanced (A2) sheet as one with no word times, and showed its
stamps as words.

- **One pattern, both spellings.** `LRC_TS_GLOBAL` (`lyrics-service`) is now
  `\[..\]|<..>` -- two alternatives rather than one class of brackets, so a
  stamp's brackets have to match. `LRC_TS_SPLIT` is gone: a second regex that
  had to agree with the first is how this kind of bug is made.
  `squareWordStamps` is deleted, and the editor's `stripInlineWordStamps` reads
  both as well.
- **Widening the regex was not enough.** The spec's layout opens a line with a
  stamp and closes it with one: `[00:06.47] <00:07.67> And <00:10.28>`. The
  old parser counted non-empty runs of words against stamps, so a stamp with
  no words after it put every later word one stamp EARLY -- through the shim
  too. Runs are now read by position: a run belongs to the stamp it follows.
- **A leading stamp times the first word only in the angle spelling.**
  `[00:12.00][00:45.00]Chorus` is standard LRC for "sung again at", so a
  leading square stamp still leaves the first words on the line start. That
  makes the offset shift keep each stamp's spelling (`shiftInlineLrcTimestamps`):
  respelled, a file would read differently for carrying `[offset:]`.
- **Square-bracket files read as before.** 20,000 generated well-formed lines
  (words, then stamp + words, optional closing stamp -- what every writer in
  the app produces) came out identical to the old parser, to the last float.
  The two differ only where a square stamp has no words after it, and there
  the old answer was the mis-slotted one. Every writer still writes `[..]`;
  none of them comes through this pattern.

### The room's header and corner, after an evening on a tablet

Owner, the day the two rows and the word fill reached dev: four things, "a
polish", then the release.

- **The room code is the button.** The header had a pill with the code and a
  "Copy link" button beside it; the sidebar's room card had the same pair.
  `JamRoomCode` (new) is both: the code is the label, a copy mark at its end
  says what a press does, and a press copies the link. It says "Link copied"
  only when the clipboard took it -- the header's old button flashed "Copied!"
  whatever happened, which the invite dialog had already learned not to do
  (`docs/agent/BUGS.md` had the three of them down as fixed; two were not).
  The confirmation hangs UNDER the pill on its own layer, so the code stays
  readable while it shows and the header does not move (the browser test
  compares the header's box before and after). On a phone the strip clips it
  (`overflow-y: hidden`, it scrolls sideways); the tick and the colour carry it
  there.
- **One link, three hand-outs.** `jamRoomLink()` (new, `jam-room-link.ts`).
  The header had been moved to `/jam#/jam:CODE` so an invite unfurls with the
  Jam card; the sidebar's button and the invite dialog (and so its QR code)
  still built `/#/jam:CODE`. The same room was invited by two addresses and
  only one showed the right picture. The old test read `JamPanel.tsx` for a
  template string; it now asks the function, and scans every hand-out point
  for the old shape.
- **"Only you can hear this" was the room's default.** `JamSongShare` showed
  it whenever a local song was loaded with nobody else there -- true of every
  song loaded alone, so it told nobody anything, and its sentence was what
  wrapped the header at the owner's width. Alone there is now a mark with no
  words; `InfoPopover` (which grew an `icon` slot for it) explains it on a
  hover or a tap: you are the only one here, invite someone and you can send
  it. With somebody in the room nothing changed in substance -- "Send the
  song" the first time, who cannot hear it after that -- but the sentence is
  shorter and the name ellipsises.
- **The chip gives up its words before the strip wraps.** CSS cannot say this:
  a wrapping flex row breaks lines on what each item ASKS for and only then
  shrinks anything, so an item willing to give way is never asked. `row-fit`
  lays the long form out and looks: `fit()` removes `data-compact`, reads the
  row, and puts it back in the same task if the row is no longer one line
  tall (or, on the phone's scrolling strip, has something off its end).
  Nothing paints in between and the answer cannot flap, because it depends on
  the layout and not on the state before it. It watches the strip AND the
  header: the strip is only as wide as what is in it, so a window that grows
  never resizes it. The row is measured against the chip's own height rather
  than by comparing the items' tops, which also catches a child that wrapped
  inside itself (the list of people).
- **The camera tray was hidden on every touch screen.** `showCameras` started
  at `!isMobile()`, and `isMobile()` is `(max-width: 768px), (pointer:
coarse)` -- true of a 1180px tablet. The switch that brings the tray back is
  `.phoneOnlyAction`, drawn under 640px. Hidden by one rule with the way back
  hidden by the other; on a tablet, a camera turned on and nowhere to see
  yourself. The default now reads the stylesheet's own width
  (`CAMERA_SWITCH_QUERY`), and a test holds the two files to the same number.
  This is the second time `isMobile()` has meant "phone" to its caller and
  "touch" to the tablet -- the sidebar list in this same release was the first.
- **And it docked against a chat that was not there.** Its position was worked
  out once from the window's size and then pushed clear of a chat window
  assumed open and 340 by 440. With the chat shut it landed 440px in from the
  corner, over the lanes. "Docked" is a rule now, not a coordinate: left of
  `[data-jam-chat]`'s real box, bottoms level, re-settled when the tray, the
  chat or the window changes size -- so it sits beside the bubble, steps aside
  when the chat opens and comes back when it shuts. A drag turns the rule off;
  where it is let go is where it stays.
- **The touch report: "I could tap it but I couldn't move it".** Once, not
  reproducible: the divider between the words and the lanes could be tapped
  but not dragged, and painting lines onto a singer did nothing either.
  Read, not reproduced:
  - `dragGesture` (the divider, the scrubber, the tray, a dozen surfaces
    outside the room) had one state that matches the divider exactly. It
    refuses a press while `activePointerId` is set, and clears that only on
    `pointerup`, `pointercancel` or `lostpointercapture`. A browser that drops
    a touch without sending any of them -- a system gesture, a dialog opening
    under the finger -- left the id set for good: clicks still work, no drag
    ever starts again until the element is rebuilt. A press that finds the
    element no longer holding the old pointer's capture now ends that drag
    (`onEnd`, `'lostpointercapture'`) and carries on as the new one; a second
    finger during a live drag is still ignored. Test written first, and seen
    to fail.
  - The line painter has no such state. Its two silent refusals are
    deliberate: not the host, and a second finger landing in the sheet (a
    pinch, which abandons the sweep).
  - Nothing is shared between the two, no listener above them takes the
    pointer, and every write they make to storage is guarded. So the one
    cause that explains BOTH at once is outside the code: a second touch
    resting on the glass. The browser cancels every one-finger drag the
    moment it sees a two-finger gesture it may own (taps survive), and the
    sheet abandons a sweep for the same reason. Not provable from here. If it
    comes back: does turning the live pitch off and on (which rebuilds the
    divider) fix the divider alone, or does only a reload fix both?
- **The lyric follower's flaky spec, a third and last time.** `leaves a paused
song where the reader put it` failed once in each of two full jam runs on
  this branch, which touches nothing under the words. A probe that logged
  every `scrollTo`, every resize of the box and every node added to the room
  caught it 13 runs in 24 under four workers: about 4.3 s after the page
  opens the preview room's people arrive, the header re-flows for one layout
  pass (38px, 56px, 38px), the stage under it gives up 18px and takes them
  back, and the follower answered both resizes as "a new layout, find the
  sung line again" -- `behavior: 'auto'`, straight back to the line, on a
  paused song the reader had scrolled away from. On a quiet machine the
  test's two-second wait ends before the people arrive; on a busy one it
  does not. Not a test problem: a friend joining, or a notice taking a row,
  does the same to a real reader. `Followed` gained `parked` -- raised when a
  hand comes off with nothing owed, lowered whenever the song moves the sheet
  itself -- and a layout that shifts under a parked sheet is left alone. The
  next line, a seek and Play's first line move it as before. The jump: 0 runs in 24 after
  (one of the 24 timed out earlier, waiting for the audio to load under four
  workers, before the test proper).
  The two earlier fixes (compare at release, never pay back a paused hold)
  were real paths too; this was the one still open.
- The chat bubble and its close button were drawings with no name; both are
  labelled now.

### A second pass on the room, from the same tablet

Owner, on the preview of the section above: "much improved", and four more.

- **The Jam tab has two tours.** Tour in the sidebar played the lobby's four
  steps inside a room, where a name field, a Create button and a code field do
  not exist: four tooltips about nothing. `JAM_ROOM_TOUR_STEPS` (new, eight
  steps) is the room's: the header, the code, the header's buttons (one step
  per viewport, because a phone folds most of them behind a menu), the roster,
  the song list, the playback capsule, the stage, the chat. `pageTourSteps(tab)`
  picks between the two, and `hasPageTour` / `startPageTour` go through it, so
  the sidebar's Tour, the Guide dialog and the first-visit offer all get the
  right one without knowing there are two. The lobby's last step now says the
  room has a tour of its own.
- **How the tour store knows a room is open.** Not by importing the jam store:
  that brings the peer service, the pitch detector and the song transfer into
  whatever imports it, and the tour store is in every page's first paint.
  `src/lib/jam/jam-room-presence.ts` imports nothing and holds one reader;
  the jam store hands it its own `jamState` signal when it loads. Until
  then there is no store and so no room, which is the right answer too. Asked
  of the STORE and not of the panel on purpose: the panel unmounts on a tab
  switch and the room does not, so a tour started from the Guide on another
  tab still gets the screen the Jam tab is about to show. It reads a signal,
  so the sidebar's `<Show>` follows a room opening and closing.
- **New hooks**: `jam.room-actions`, `jam.stage` (on the song
  stage AND the drill canvases, so "the stage" is whichever is up), `jam.chat`.
  `tour-selectors-exist.test.ts` now checks `reveal` selectors too, and the
  room's tour with the rest. The first step points at the whole header and
  not at the block holding the name and the strip: under 900px that block is
  `display: contents`, which has no box, and the phone walk caught it as a
  step with no spotlight. `jam-room-tour.spec.ts` walks all eight steps on
  a desk, the owner's tablet and a phone and wants a visible spotlight on each
  -- this tour is on the PR gate, not only in the release walk.
  `scripts/walk-tours.mjs` walks it too (it opens the preview room first) and
  grew `ONLY="Jam,Jam (inside a room)"` for walking a few.
- **The lyric header's buttons on a tablet.** Not a bug: every touch screen
  got a phone's 40px targets, 46 with the ring, a 51px row -- next to a lane
  zoom that is 28px on the same screen. A touch screen wider than the room's
  phone block (641px and up) now takes the lane zoom's size for both pills; a
  phone keeps 40. The container steps were a phone's arithmetic, and one of
  them (down to 32px under 276px) would have made a tablet's buttons GROW as
  the column narrowed, so they are split: the old steps under
  `(pointer: coarse) and (max-width: 640px)`, and a tablet's own (264 / 216 /
  172px, from 94 + 108px of controls) beside them.
- **"Link copied" was painted under the playback row.** It hung under the pill
  from inside the header, `position: absolute; z-index: 5`. The header is a
  stacking context and the row below it a later one, so the z-index only
  ordered the note among the header's own children. It is portalled to the
  body now, fixed, on the layer of the app's other floating notes (9000),
  placed from the pill's box and re-placed on scroll and resize, with the
  caller's skin carried over (`createPortalSkinBridge`). The `role="status"`
  stays in the button, visually hidden, so the region exists before the words
  arrive; the visible copy is `aria-hidden`. `MISTAKES.md` already had this
  rule, for popovers; it has this case under it now.
  The browser check makes the note take presses for the length of the
  question, because a hit test skips whatever lets presses through and the
  note does.

#### The touch report, again

"The touch and drag to move the lyrics up/down doesn't work on my tablet",
then: a reload mended it, the divider DID work this time, a desktop wheel is
fine. Not reproduced, for the second time.

What was checked, and is fine:

- One finger scrolls the sheet in a real-touch browser test (CDP touch points,
  1180x820), on this branch.
- Nothing in the room listens for touches above the lyric box. The tour engine
  has no scroll lock; `useScrollLock` sets `overflow: hidden` on the body and
  nothing else, which does not stop an inner scroller.
- The pinch handler cancels a touchmove only with exactly two fingers inside
  the box. One finger is never cancelled, whatever state it was left in.
- The follower never stops a scroll; it can only move the sheet afterwards.

What was found: **an armed brush.** With a singer picked in the Parts bar the
rows are `touch-action: none` and a drag paints. A mouse still has its wheel;
a finger has nothing, so under a finger an armed sheet does not scroll at all,
it stays that way until Done, and with "Everyone" armed over unassigned lines a
drag changes nothing anyone can see. The divider is unaffected and a reload
puts the brush down -- which is the second report exactly. It was not shown to
be what happened.

So, without changing the gesture:

- the sheet says when it is armed (`data-armed`, a ring in the brush's colour):
  a finger has no cursor to turn into a crosshair;
- the Parts bar tells a touch screen "Drag down their lines. Done to scroll
  again." -- INSTEAD of the mouse's sentence, not after it: two sentences put
  Done on a third row of a tablet's lyric column, and a row is 32px of words;
- a sweep in progress cancels the browser's pan from the sheet's own
  non-passive `touchmove`, as well as by the class. The class arrives with the
  brush, and a pan the browser starts anyway cancels the pointer and the sweep
  with it, which is what the FIRST report's "the parts assignment also didn't
  work" would look like. Also unproven; it costs two comparisons.

Left alone: replacing the dynamic `touch-action: none` with the cancel alone.
It would take a stale class out of the picture in both directions, but painting
under a finger works on the owner's tablet today and that swap cannot be tried
on one from here.

If it happens again, the tablet does have logs: Settings has a developer
console switch that works on a deployed build (`src/lib/developer-console.ts`;
an earlier version of this note said a tablet has none, which was wrong). Three
things on the screen tell the causes apart even without it: is a name lit in
Parts, or Done showing;
does the 100% in the words' header change while dragging (the sheet thinks two
fingers are down); does tapping a line still jump the song (the sheet is
getting touches at all).

### A shared voiceprint link, and what it unfurls as (#837, #838)

The Mirror's share card is made about 310 times a month and brought back four
sessions of three seconds each: the share text pointed at the generic
`/mirror`, so someone sent a friend's card arrived at an empty instrument
asking _them_ to sing.

**#837, the link.** It now carries the take: `/mirror?v=<payload>`, the numbers
already printed on the card and nothing else (no audio, no frames, no id, no
timestamp; a name only if one was typed, and no caller passes one today).
Self-contained rather than a short id, because `SHARE_STORE` ids expire in 60
days and a voiceprint is a keepsake. `lib/mirror/shared-voiceprint` is the one
definition of the destination; `SharedVoiceprintWelcome` redraws the sender's
card from the numbers, with a written fallback when there is no twin portrait;
`shared_view` and `shared_start` join the funnel catalog.

**#838, the unfurl.** Crawlers run no JavaScript, so the picture has to exist
as a URL. The app picks a card id itself (a server-assigned one would put a
round trip between the tap and the sheet, which Safari refuses), uploads the
card it already drew to `PUT /api/og/card/:id`, and the worker rewrites the
Mirror document's social tags per request. Stored in the existing
`SHARE_STORE` under an `og:` prefix, 30-day TTL, 1 MB cap, rate limited per
address, never overwritten. **No new Cloudflare resource**: dev, preview and
prod all already bind that namespace.

**What review found before it merged.** #838's base was #837's branch, and
`pr-gate.yml` only fires on PRs based on `main`, so its green tick was one
deploy job and nothing else. Read properly:

- **The rewrite could never run.** Share links are `/mirror?...`, and `/mirror`
  was not in `assets.run_worker_first`: it has a file, so the asset layer
  answered it and the worker never saw the request. The page loads either way,
  so nothing reports it; every link would have unfurled as the stock card.
  Listed now, and pinned in `worker-entry-routing.test.ts` with the reason.
- **Two scores were published as cents.** `ac` and `sd` are the card's 0-100
  scores (higher is better). The recipient's view and the unfurl both printed
  them as `±N¢`, so a take scoring 87 read "accuracy ±87¢": nearly a semitone
  out, the opposite of what it says. Now `87 / 100` and `accuracy 87/100`, and
  the decoder stops at 100.
- **The card was too heavy to be a preview.** The PR put a card at about
  300 KB. Measured over all 31 twins in a real browser, the square twin card
  is 1.8 to 2.3 MB as a PNG (a painted portrait is the worst case for
  lossless): David Bowie's was over the 2 MB cap and would never have stored,
  a month of shares is half a gigabyte rather than "under 100 MB", the upload
  is still running when the first crawler arrives, and WhatsApp skips a
  preview image that large. The unfurl card is now a JPEG (`cardToUnfurlBlob`,
  at most 270 KB); the share sheet still gets the PNG. The store takes JPEG
  only, reads the size from the frame header, and serves `:id.jpg`.
- **A tall card behind square tags.** The data card can be shared as a
  1080x1920 story; the tags declare 1080 square and X crops a `summary` from
  the middle. A story share now draws a second, square card for the unfurl
  only, and the store refuses any picture that is not 1080x1080 (one
  constant, `OG_CARD_SIZE`, for the app, the store and the tags).
- **The card left the device on a plain save.** The upload ran before
  `shareCard`, whose fallback on a browser with no share sheet downloads the
  picture and drops the text. So "Save" uploaded a card for a link nobody was
  given. It is now `shareCard`'s `onSheetOpening`, called synchronously just
  before `navigator.share` and never on the download path.
- **An expired card unfurled as a broken picture,** not the stock one the PR
  described: the tags named the image from the id's shape alone. The rewrite
  now asks the store first (`ogCardExists`, a stream opened and cancelled,
  since KV has no "exists"), treats an unreachable store as "no", and only
  touches a whole 200 HTML response. It also drops the file's `ETag` from a
  page it rewrote: that page changes when the card lands or expires and the
  file does not, so the validator would let a returning crawler be told 304.
- **Anyone can write a link.** `1e999` is valid JSON and parses to Infinity,
  and a note named from it reads `undefinedNaN` under our name. Numbers must be
  finite and in range (MIDI 0-127, scores 0-100, high not below low), names at
  most 80 characters, and a note is named from a rounded number.
- **Staging links went to production.** The base was hard-coded, so a card
  uploaded to dev's store was named by a link to the public site, which has
  neither the card nor (until a release) the code. `voiceprintShareBase()`
  keeps links at home on `dev.mercurypitch.com` and `*.workers.dev`; everywhere
  else is unchanged. Without it this could only be tried on prod.
- The stored card is served `nosniff` with a `default-src 'none'; sandbox` CSP:
  a stranger's bytes under our domain are an image and nothing else.

**Accepted, not fixed.** The store is an unauthenticated upload of a
card-sized JPEG, and `tw`/`n` are free text: a crafted link can unfurl with
someone else's picture and a short title under our name. Bounded by the rate
limit, the size check, the 64-character clip and the 30 days; removing it
means drawing the card server-side. KV is not read-your-writes across
locations, so a crawler far from the sender that arrives within seconds can
still miss the card and show the stock one. The free-sing share still sends
the generic link: its card has a range and could carry one, but the recipient
would land on the guided Mirror under the word "voiceprint", which is a
product call.

**The link had no way out on a desktop (found by the owner on dev, an hour
after the merge).** The payload link lived only in the share sheet's `text`.
Chrome and Firefox on a desktop have no share sheet, so `shareCard` fell back
to saving the PNG and the text went nowhere: from all three doors, "Share"
produced a file and the one thing that brings a friend back never left the
page. Nothing had tested the share path in a browser at all.

- `shareCard` takes the bare `link`. With no share sheet it saves the picture,
  puts the link on the clipboard and returns `'downloaded-link-copied'`;
  `shareOutcomeMessage()` words it, because a link on a clipboard is silent.
  `onSheetOpening` became `onLinkLeaving`: before the sheet opens, or once the
  link is copied, and never for a picture saved on its own. A sheet that
  refuses the data still downloads, but does not hand the link out twice.
- `copyVoiceprintLink()` is the link on its own: the clipboard write starts
  before anything is awaited (Safari), and the card is drawn and stored only
  after the copy succeeded. **Copy link** is on the Mirror's results row, on
  the account page's voiceprint (no twin needed), and, quietly, on the halfway
  twin reveal, where a take is already a voiceprint of range plus twin.
  Onboarding's Twin beat keeps its two buttons and says when the link was
  copied. `link_copied` is its own funnel event: `card_shared` feeds a live Ads
  conversion and goes on meaning what it meant.
- `voiceprint-copy-link.spec.ts` runs the real path in a browser with no share
  sheet: the clipboard holds a link that decodes to the take, the PUT carries a
  JPEG under the id the link names, the link opens on "Someone sent you this",
  and a refused clipboard uploads nothing.

**Three things the owner found testing that on dev.**

- **A toast at 1100 lost to every hand-numbered modal.** Sharing from the
  account page's zoomed voiceprint (`.zoomOverlay`, z 4000) put the reply
  behind it, where the overlay's `backdrop-filter` blurred it as well. The
  scale in `mobile-kit.css` already meant "toasts above everything" -- it was
  written before the modals that ignored it (4000 here, 12000 for the session
  export, 18001 for the night music import). `--z-toast` is 20000: above every
  one of them, below the always-on-top band (2147483000+: consent, database
  notice, portable console). `z-scale.test.ts` reads the stylesheets and fails
  on any new z-index in between, which is how this would have been caught.
- **"A voiceprint" was a placeholder in a headline's clothes.** The unfurl
  said "David Bowie is my voice twin" while the page it opened said "A
  voiceprint" -- the same link, two different things, and the interesting half
  missing from the one a human reads. `sharedVoiceprintTitle` is now the only
  title builder and takes a voice: `'mine'` for a chat, where the sender is
  speaking, `'theirs'` for the page, where the recipient is being told about
  someone ("David Bowie is their voice twin", "Their voiceprint"). The worker's
  `voiceprintTitle` delegates to it after `safeText`. The written fallback lost
  its "Voice twin:" chip, which the heading now says.
- **The status line was 12px of grey.** It is the only thing on screen that
  says a link reached the clipboard. It is a pill now -- 0.95rem, a tick or an
  alert, tinted green or red -- because the outcome carries a tone:
  `ShareStatus { text, tone }`, built by `shareOutcomeStatus` /
  `copyOutcomeStatus`, rendered by one `ShareStatusNote` at all three Mirror
  sites. Onboarding's Twin beat gets the same pill in the onboarding palette
  rather than the 0.75rem footnote it was borrowing.

**What a second review pass changed before the merge.**

- **A share the sheet never took now hands the link over anyway.** `shareCard`
  called `onLinkLeaving` before `navigator.share` and, on any non-abort
  rejection, saved the picture and stopped -- on the reasoning that the sheet
  already had the link. It does not: Chrome rejects with `NotAllowedError`
  when the tap's activation has expired, which drawing two 1080px cards is
  enough to cause on a slow phone, and then no sheet ever opened. That path
  now falls through to the desktop one (save, copy the link), and the store
  callback is fired once whichever way the link leaves.
- **A refused clipboard on the Share path said nothing.** Firefox and Safari
  reject a `writeText` that did not begin inside the tap, so a share on those
  desktops saved a file and left the link unmentioned -- the very gap this
  work set out to close. `shareOutcomeMessage(outcome, carriedLink)` now
  points at Copy link for the callers that passed one; the account page says
  the same in a notice. Free-sing passes no link and its wording is unchanged.
- **Copy link is guarded while it is running.** Every tap mints an id and
  stores a card, and the store allows ten a minute from one address: ten
  impatient taps and the card for the link you actually send is refused.
- **The status line is announced.** It was built with its text already in it,
  which a screen reader does not read out; the live region is now mounted
  empty and filled, with the pill itself `aria-hidden`.
- Also: `SyncTransferChip` still carried the old `var(--z-toast, 11000)`
  fallback, and `z-scale.test.ts` now states what it cannot see (inline
  styles, stylesheets inside a `.tsx`, `var(--x, N)`, `!important`).

Not tested by anything here: `HTMLRewriter` itself (no Workers test pool; a
stand-in records what would be written), and an unfurl in a real chat app.

### Three `manualChunks` rules deleted; every document weighed

The owner's question after the jam room broke Piano Night's audit by importing
a 30-line helper: why does one reusable module pull another, and can the
recursion be fixed rather than pinned again.

**The mechanism.** A module named into a manual chunk takes every static
dependency that has no name of its own with it, transitively (Rollup's
`addStaticDependenciesToManualChunk`). Three rules at the end of
`manualChunks` named whole FEATURES by component name: `community`,
`advanced` (UvrPanel, StemMixer, VocalAnalysis, PitchTestingTab, ...) and
`library`. The first of them to reach a shared helper owned it; a page that
needed the helper loaded the chunk, and the other two, because they import
each other. Each of the ~25 per-module pins above them was this bug patched
once, found by a failing audit or a dead first paint -- and only Piano Night
and Drum Night have audits.

**The fix is deletion.** Without the three rules Rollup places a module by
which entries reach it, which is cycle-free by construction. First-paint
JavaScript per document (uncompressed, `build:e2e`):

| Document                                       | Before             | After        |
| ---------------------------------------------- | ------------------ | ------------ |
| Voice Mirror and the three vocal test pages    | 3149 KB, 42 chunks | 344 KB, 18   |
| Karaoke Night, Vocal Remover                   | 3063 KB, 45        | 352 KB, 36   |
| Glass                                          | 3050 KB, 41        | 331 KB, 19   |
| Guitar Night                                   | 3822 KB, 59        | 1432 KB, 61  |
| Main app (index, jam, ear lab, pitch training) | 4819 KB, 65        | 4669 KB, 96  |
| Piano Night / Drum Night                       | 298 / 507 KB       | 298 / 505 KB |

Zero circular chunks; both room audits pass.

**The cost.** The main app asks for 96 scripts at first paint instead of 65
(249 emitted instead of 212), for slightly fewer bytes. 56 of the 96 are
under 5 KB. Over HTTP/2 that is cheap and not free.
`output.experimentalMinChunkSize` was tried at 10 KB to buy the requests
back and is NOT the answer: it merges by "likely to load together", which put
`pitch-core` into Piano Night (298 to 542 KB, failing its audit), took Drum
Night to 755 KB and Karaoke to 535 KB, and gave the script-free 404 page
256 KB of JavaScript. Cutting the main app's request count is a separate job
(the mixer is still a 562 KB static import of the shell).

**What keeps it fixed.** `scripts/assert-first-paint-budgets.mjs` runs in
`build:e2e` beside the two room audits. It walks each emitted document's own
script tags and then static import edges only, sums the bytes, and holds the
total against a ceiling (measured plus about a quarter). A document with no
ceiling fails, so a new page cannot arrive unweighed; so does a ceiling for a
document that is gone. Run against a build with main's rules it fails nine
documents and names `advanced`, `vendor-media` and `library` as the heaviest.
`src/e2e/every-document-boots.spec.ts` loads every document in the entry
model and fails on a script that did not arrive, a thrown error, or an empty
`#root` -- the one symptom a bad chunk layout has.

The pins stay for now. Each is only needed if a budget says so, and they can
go one at a time; `pitch-core` and `local-song-library` break real cycles and
stay until proven unnecessary.

### The voice-type presets were octaves, and baritone was bass

Owner report: "the baritone selected in settings makes the ascent go from C2
to C3 ... I can't even go to C2". `VOCAL_RANGES` was three octave numbers a
voice. Baritone and bass were the SAME row (octaves 2-4, default 2), which
gave both a comfortable range of C2-B4, a start note of A2, the library scale
`scale-major-c2` (C2-C3) and jam drills transposed two octaves down. An alto's
row started her on C3, under the bottom of her range. Three other tables in
the app (`VOICE_MIDI_RANGES`, `VOICE_TYPE_BANDS`, the selector's tooltips)
already agreed on the textbook ranges; this one disagreed, and it was the one
every exercise read.

- The table is in NOTES now: `lowMidi` / `highMidi` (bass E2-E4, baritone
  G2-G4, tenor C3-C5, alto F3-F5, mezzo A3-A5, soprano C4-C6) and an
  `anchorMidi` where exercises start: A2, C3, E3, A3, C4, E4. Natural notes, a
  fourth or so above the bottom, so a one-octave run up stays clear of both
  ends -- low in the middle rather than dead centre, because a beginner
  strains at the top first. `getComfortableMidiRange` and `getDefaultNote`
  read them; every exercise, the siren's clamp and the challenge "outside your
  range" notice follow.
- `defaultOctave` is now "the octave of C major that sits inside the range":
  3 for bass, baritone and tenor, 4 for alto, mezzo and soprano. C-rooted
  material (the library scales, the jam room's drills, a new melody) can only
  move by octaves, so that ladder has two rungs, not six. Nobody is sent to
  `scale-major-c2` any more -- but it stays in the set the auto-select calls
  its own, or the baritones and basses it was put in front of would keep it
  for good.
- Singing Zen had the opposite fault: every catalogue exercise is authored
  around C4 and that is where everybody sang it (a baritone's major scale ran
  C4-C5). `useZenPitchSession` takes `octaveShiftFor(low, high)`; the app
  answers with `octaveShiftIntoRange`, which is `fitPhraseToRange`'s search
  lifted out to work on MIDI numbers. Left out, the authored root stands --
  a weekly challenge is sung at its written pitch on purpose, and a warm-up
  sets its own root.
- `vocal-range-presets.test.ts` pins the ladder: the table equals
  `VOICE_TYPE_BANDS`, anchors and both ends strictly rise from bass to
  soprano, every one-octave run is inside its range, no preset can reach C2,
  and the C-rooted octave fits inside each voice.
- New default sessions label the three C scales by who they fit. Existing
  ones keep their labels.

## [0.9.10] - 2026-09-19

The 0.9.8 audit follow-ups (#822), the support address coming out of the
bundle (#823), phases 1-3 of the registered-user newsletter (#824), the jam
song room (#826) and the lyric-version fixes that followed it, example songs
that wait for their own lyrics (#828), and account notices (#829).

### Newsletter for registered users (#824)

A checkbox on the register form and in Settings, the column behind both,
and a sender that is run by hand.

Consent lives on `users` (migration 0047), not in a list held by a mail
provider. A mirror would be a second source of truth: unsubscribe from an
email and Settings would go on saying the opposite until something
reconciled them. It also means account erasure already covers it, and that
the switch works on a day the provider does not.

The box is unticked and stays unticked unless a literal `true` arrives with
the register request — a pre-ticked box is not consent under the GDPR, and a
truthy string is not an answer. Google and Apple signups land opted out;
Settings is how they change that.

The unsubscribe link needs no sign-in, as the 2024 Gmail/Yahoo bulk-sender
rules require. It is an HMAC over the user id and the moment they opted in,
signed with `NEWSLETTER_LINK_SECRET` rather than `JWT_SECRET`: a value that
travels through other people's mail servers inside a URL must not be the one
that mints sessions. It survives being clicked twice or prefetched, opting
back in retires every link sent before it, and it answers the same page for a
stranger as for a subscriber — an unsubscribe endpoint that answers
differently is an address oracle.

Phase 3 puts the sending in the worker, behind `X-Admin-Key`:
`GET /api/newsletter/recipients` and `POST /api/newsletter/send`, driven by
`scripts/send-newsletter.mjs`. The operator's machine holds no secrets and
renders nothing; it posts content, and the worker mints the links and calls
Resend. `dryRun` defaults to true, so a send needs `--send` typed on purpose.
Accepted sends are logged per (issue, user) in `newsletterSends`
(migration 0048), so a run that stopped half way is finished by running the
same command again. Recipients are gated on `emailVerified`: an address
nobody confirmed may be a stranger's, and a stranger's complaint is what
costs a sending domain its reputation.

Still no cron, no queue and no trigger. A newsletter that can send itself is
a newsletter sent by accident.

Plan and decisions: `docs/plans/newsletter-registered-users.md`.

### The 0.9.8 audit follow-ups (#822)

- **Jam lanes read the song clock per frame.** Lane notes were positioned
  from `timeupdate`, which fires about four times a second, while the pitch
  trail beside them ran per frame. `timeupdate` is kept and still matters:
  animation frames stop in a hidden tab, and a phone with the room in the
  background has to keep the song moving.
- **Zen's ear-matched visuals moved to the audible clock.** The stage keeps
  two clocks — where the transport is, and where the sound has reached the
  output device. Only the word sweep read the second one. The scrubber and
  the time readout keep the transport's position, which is what they report.
- **Recorded drum hits are placed where they were heard.** A hit is stored at
  the context time it was scheduled for; it leaves the speakers one output
  latency later, and the guitar answering it reaches capture one input delay
  later still. The lane is offset by what the browser reports about the
  route — nothing measured, so an unreported term counts as zero.
- **Session renewal is bounded.** Foregrounding traded a live session for a
  fresh thirty days through the same session id, so a session in use never
  expired. Renewal now stops six months after the sign-in, measured on the
  session row rather than the token, and the session is ended rather than
  merely refused — leaving the row would keep the calling token good for the
  rest of its thirty days. Only the session that asked is ended. Note this
  cannot bite yet: `authSessions.createdAt` arrived 2026-08-31, so the first
  caps fall around 2027-02-27.
- **Drum kit credits come from the licence, not the id.** The notice was
  gated on `muldjord` or `crocell` written into the component; three other
  kits ship a notice and showed nothing. Each option now declares what its
  licence obliges, and a test checks every declaration against the kit
  manifest. The picker's "16 original grooves" is counted now (19).
- **Social card URLs carry a content hash.** Platforms cache an OG image by
  URL, so recutting a card behind the same path changed nothing in links
  already shared. Each URL now carries the first eight hex digits of its
  sha256; the map is generated (`pnpm run og:versions`) and a test recomputes
  the hashes from disk, so a recut card that ships without a regenerated map
  fails CI.

### The support address leaves the bundle (#823)

`CONTACT_EMAIL` is replaced by `CONTACT_FORM_URL`, the landing site's contact
form, which already sits behind Turnstile. Account's "Email us" becomes
"Contact us"; the local-progress notice's "Ask us to move it" opens the form
with the topic set and the message drafted, both device ids included, and the
singer still presses send themselves. `progressHandoffMailto` is now
`progressHandoffUrl`. The billing-delay notification points at Account rather
than naming an address, since a notification cannot carry a link.

Requires the landing on `mp-v0.1.28` or later: earlier builds serve the
contact page but do not read the query string, so a drafted handoff would
arrive as an empty form.

### Jam room: pitch accuracy, a pop-free transport, zoom and split (#826)

The trace shows where the voice is rather than the nearest note, and a note
pill's colour reuses `CENTS_EXCELLENT` / `CENTS_GOOD`, so it agrees with the
score. Starting, stopping and seeking go through a de-click envelope. Lane
zoom, the lyric split, alignment and lyric size are per-device preferences
(`jam-lane-zoom`, `jam-view-prefs`, `JamSplitHandle`, `jam-lyrics-scale`)
and never cross the wire.

The pitch guide: `analyzeVocalSamples` was lifted out of the stem mixer's
controller into `src/lib/pitch-pipeline/analyze-vocal.ts`, with
`VOCAL_ANALYSIS_DEFAULTS` as the one source of defaults and no change in
behaviour. The host analyses once, stores the result under the song's session
id, and re-sends the manifest under the same song id, so peers get `notes`
without a transport restart. `JamSong.notesFrom` (local only) drives the
caption above the lanes; `pitchGuide: 'unavailable'` travels on the manifest
and is optional, so older clients ignore it. A raw `mergedNotes`-only line is
re-analysed and kept on failure; an empty analysis is not stored; a device
that becomes host re-runs provisioning (`resumeHostDuties`). Still on the
main thread; a worker is the follow-up.

Examples: the Songs shelf was `loadDemoSong()`, the first playable one only,
and the rest were metadata-only library rows while `sessionSong()` read
IndexedDB blobs. `exampleSongId(slug)` mirrors `demoSessionId`, an example
row falls back to its public stems (a separation's leftover server address is
never used), and hydration happens on pick. `jam-picker-store` and
`JamPickerList` feed the popup, the phone sheet and the `JamRoomPanel`
section; the rail list is mounted only while a phone drawer is open, because
a closed drawer is off-screen rather than hidden and its buttons stay in the
accessibility tree.

The lyric sheet is `user-select: none` and a seekable row carries
`data-seekable`. Space moved from the song stage to `JamTransport` through
`lib/space-playback`. That import is what made the module need its own
chunk: a module a broad `manualChunks` rule reaches is pulled into that chunk
unless it has a name of its own, and Piano Night's first paint then loads the
broad chunk to reach it. `build:e2e` fails the audit; `vite build` alone does
not.

### Jam room: the Original / Edited buttons and the versions behind them

Reported from a device pass: pressing Original after switching songs put the
previous song's words on the loaded one, and the buttons came and went.

The picker read its list with `createResource(sessionId, ...)`. A resource
whose source goes null keeps its value, and `sessionIdOfSong` is null for
every example, so an example inherited the last song's buttons; any song did
for as long as its own list took to read. `attachJamSongLyrics(lines)` then
attached to whatever was loaded. It takes the song id now and ignores words
for a song the room has left, as `attachJamSongNotes` always did; the finder
had the same hole across its `fetchLyricsById` await. The list is keyed on
the song and carries the song id it was read for. `jamSongSessionId` gives an
example its own versions back, and `exampleSong` opens on the singer's active
version when it is one of theirs, the manifest otherwise. The lit button is
matched on every line; matching the first lit Original for most corrections.

Two writers could store a record without its versions, which is what makes
the buttons disappear. `seedOnce` decides on the active text alone, so a
singer who corrected the words and went back to the Original lost the Edited
version to the next `lyricsRevision`; it now replaces the Original and keeps
the rest, building the Original through `synthesizeVersions` so the
`x-mp-timing` ends are read (a record with versions is never derived again).
And `saveLyricsToDbStrict` is create-then-delete: two overlapping saves each
leave a row, and `loadLyricsFromDb` took `limit: 1` of an unordered pair.
Writes to one session now take turns (`inTurn`), reads believe the newest
row, and the legacy-filename heal from #828 is `renameLyricsInDb`, a field
patch, instead of re-saving a copy read earlier. Per tab only: two tabs can
still overlap, which the newest-row read keeps stable and the next save
tidies.

All four storage defects were reproduced against the old code before the fix.

### Example songs wait for their own lyrics (#828)

Only the song card and a `?session=` restore awaited the lyric seed. The
stage's song sheet, playlist steps and the in-app mixer open an example by its
library row, and `seedExamplesLibrary` writes rows first and lyrics second, so
`loadLyrics` found nothing and went to the online finder. The lyric controller
now waits for an example's own lyrics (bounded at 8 s, cancellable, spinner
up) before searching. The seed is single-flight per session id, abortable, and
re-checks the store right before writing, so a seed that comes back late
cannot overwrite what the singer found meanwhile. Seeded records are named
`Artist - Title.ext`.

### Account notices (#829)

Migration 0049, `workers/db-worker/src/account-notices.ts`, the notice mail in
`email.ts`, and the erasure registry. Legal and service notices go to every
verified account whatever they chose about the newsletter, which is why they
are a separate route, a separate log and a separate confirmation word. Same
shape otherwise: the worker sends, `dryRun` defaults to true, sends are logged
per `(notice, userId)` and skipped on a re-run, 25 per page. Prod answers 404
until a tag ships the worker and the migration.

### Studio: a `.lyricsfile` for an example song, and word ends through every door

`71114e71`: the studio's lyrics drop zone reads a `.lyricsfile` and converts
it to the stored LRC, tag included, through the same `lyricsfileToStoredLrc`
the mixer's import uses. One text is stored and either format derives the
other. A lyrics URL ending in `.lyricsfile` is converted at seed time, and the
format is read off the path so a cache-busting query no longer turns a synced
file into plain text.

`29ea11f1`: the `x-mp-timing` reader accepted only numbers, and a sparse line
serialises its holes as `null`, so any file with a partly marked line lost the
whole tag. Nulls are read back as holes. `synthesizeVersions` reads the tag
for a bare record, which is how a seeded example keeps its word ends.

## [0.9.9] - 2026-09-18

Piano Night's practice controls (#812), and the count-in fix that device
testing found in them (#819).

### Piano Night (#812)

Scrub on the fall stage, draggable A/B loop markers, an opt-in count-in, live
input drawn separately from the project's notes, and a Show/Hide choice for
falling notes on the keybed.

The PR arrived from a lower-tier agent and was reworked before merging. It had
never passed CI — the `Scope` job failed on trailing whitespace in a new test,
so lint, typecheck, unit and browser tests were all skipped — and typecheck and
lint both failed at its head. Underneath that:

- The count-in defaulted to four beats for every existing user and replayed on
  resume from pause; the pre-existing suites had been edited to opt out of it,
  so the shipped default had no coverage at all. It is opt-in now, counts only
  from rest, and the opt-outs are gone.
- `play()` read `commandGeneration` without incrementing it, so a second Start
  ran a second frame loop and scheduled a second click train that nothing held.
  It bumps the generation and holds its oscillators; a press during a count-in
  is a no-op, and Stop cancels.
- The count-in resolved only when `ctx.currentTime` advanced, which a suspended
  context never does — `play()` could hang forever. It checks `ctx.state` and
  carries a wall-clock deadline.
- Scrubbing called `transport.seekToBeat` plus a newly exported
  `setPlayheadBeat`, skipping the controller's take invalidation, sample
  cancellation, scoring discontinuation and A/B handling. It goes through
  `controller.seekToBeat`, and the extra export is gone.
- Marker drags called `configurePracticeLoop` on every pointer frame — a
  scheduler stop, a voice release and a take invalidation each time, discarding
  the recorded take on the first frame. The drag is buffered and committed once
  on release.
- Any press on the stage scrubbed, including a right-click; there is a primary
  button guard and a 6 px dead zone. `.fallStage` went back to
  `pointer-events: none` with a dedicated scrub surface carrying
  `touch-action: none`, so the page still scrolls around it.
- A stray `patch_debug.ts` at the repo root was deleted, and the Keys view now
  honours the hide setting it was ignoring.

A real-mouse `@smoke` spec covers the scrub and the marker drag, and was shown
to fail against the pre-fix behaviour (a 3 px tap seeked; one drag produced 14
commits).

### The guided tours' spotlight (#820)

Pressing Next blanked the spotlight and centred the tooltip for as long as the
next step took to get its target on screen — a tab switch, a `navigate` click,
a `reveal` toggle, a scroll — then flew both back across the 0.34 s glide.

`Walkthrough.tsx` attaches its resize/scroll listeners in a `createEffect` that
also called `reposition()`, and `reposition` reads `currentStep()`: the call was
tracked, so the effect re-ran on every step change, synchronously, before
`prepareAndPosition` had done anything — and re-attached all three listeners
while it was there. It is `untrack`ed now, and a `preparing` flag holds the
spotlight if a scroll or resize lands mid-preparation. A step whose target never
appears still hides it, through the existing `!found` path.

`src/tests/walkthrough-step-change-spotlight.test.tsx` was written red first:
the hold test failed with `expected 'none' not to be 'none'` against the old
code. Its companion pins the give-up behaviour so the hold cannot swallow it.

### The count-in's clock (#819)

On a device the digits skipped — "4, 2, 1" on desktop, out of step with the
beeps on a tablet. Four causes, all of them real:

- The clicks were scheduled from one reading of `ctx.currentTime` and the
  digits timed from a later one, so they never shared an origin.
- The first click was asked for at exactly "now", which the audio thread can
  only honour late.
- The count ran at the score's base tempo rather than
  `effectiveTempoBpmAtBeat`, so practice speed moved the song but not the count.
- The digit carried a one-second looping CSS pop under a value changing at the
  song's tempo; only at 60 bpm did the two agree, and a digit could change
  while shrunk and read as skipped.

`piano-night-count-in.ts` is now a pure plan both halves read: one origin a
hair ahead of the clock, the number on screen is whichever click has sounded,
and a beat shorter than 0.4 s moves the count to half notes (then quarter
notes) so four readable counts still land on a downbeat. Each count renders as
its own element with a single pop sized to the count interval.

## [0.9.8] - 2026-09-18

The Product Hunt launch release. Everything merged after 0.9.7 on 2026-09-10
ships here: the promo code, the native app foundation (which the web build
carries as shared packages), and a release audit that reworked what the
lower-tier agent's PRs claimed and did not do. Beside Cue changes in the same
window ship on their own `bc-v*` tag and are not listed.

### Promo codes (#808, #811, #815)

- `POST /api/billing/promo/redeem`, `promoCodes` + `promoRedemptions`
  (migration `0045`), `PRODUCT_HUNT` seeded at 5 credits, cap 1000. The client
  has a `PromoCodeCard` under Settings > Credits and a header pill.
- #811 fixed the client sending `[object Promise]` as the bearer token.
- The audit (#815) found the grant was three separate statements although
  the PR body said "atomically": a failure between them left a redemption
  the user was then told they had already made, with no credits. It is one
  D1 batch now; the cap is claimed by the slot INSERT itself so two callers
  racing for the last slot cannot both land; the ledger row can only exist
  with its slot. `promoRedemptions` joined `USER_OWNED_TABLES`. The lifecycle
  tests redeemed the seeded row and would have gone red the day it expired;
  they own a test code now and check the seeded window under a fixed clock.
  Migration `0046` moves the expiry from 2026-09-22T23:59:59Z (16:59 Pacific
  on launch day) to 2026-09-30T23:59:59Z; the client reads the same date from
  `launch-promo.ts` and a test keeps the two in step, so the pill and the
  one-click card go away when the campaign does.

### Guitar Night (#805, #810, #817)

- #805 Walnut Studio session drummer: `src/features/session-drummer/`, a
  lookahead scheduler on the audio clock, next-bar changes, three blues
  grooves, the recorded drum lane as an optional `drumTrack` on the ending
  chunk (no Dexie version bump), `OfflineAudioContext` mix export.
- #810 reshaped the take review into Listen / Refine notes / Export.
- #817, from the audit: `load()` validated the drummer lane the way
  `finish()` does and threw, taking the irreplaceable dry audio with it —
  reads now drop a damaged lane and warn; the WAV export carried
  `aria-label="Export audio mix"` under visible text "Download WAV" (WCAG
  2.5.3, unreachable by voice) and is named by its label; "bends are not
  transcribed" was disclosed nowhere after #810 and is back.
- Known follow-ups, not blocking: the recorded drum lane is stamped in the
  output clock while the guitar PCM is the input stream, so replay and export
  put drums ~20–60 ms early on desktop and more on Bluetooth; the picker copy
  says "16 original grooves" while 19 shipped; the CC BY notice is keyed on
  two hard-coded kit ids.

### Rooms and drums (#793, #796)

- #793 Muldjord v1 and Crocell v1.1 recorded kits (111 / 107 strikes),
  authored velocities preserved with -12 dB backing headroom and a -6 dB
  guide trim on scores with authored percussion, the arrangement player
  deferred to keep Drum Night's 520,000-byte startup gate.
- #796 shared in-session music import across Guitar, Drum, Piano and
  Karaoke Night; queued audio with upfront Local / Cloud preparation choices;
  the server still owns admission and billing.

### Jam (#816)

- `JamPeerLanes.tsx` anchored its window with `NOW_AT` and `1 - NOW_AT`
  swapped: `secToX(pos)` landed at 0.25·w while the playhead line and the
  newest live sample sat at 0.75·w, so the note under the line was the one
  four seconds ahead (`LEAD_IN_SEC = 4` masked it). The geometry lives in
  `src/lib/jam/jam-lane-geometry.ts` with a test that failed 6/11 against the
  old formula. `sessionSongNotes` now prefers `segmentedNotes` with the
  stored edit layer applied, the melody Karaoke Night draws, instead of the
  raw merge. Still open: the lane's notes move on `timeupdate` (~4 Hz) while
  the trail moves per frame, and neither path compensates output latency.

### Compose (#814)

- An imported MIDI's tempo reached the transport but not the melody record,
  because the live Import button used a callback without a tempo argument
  while the corrected handler lived in an unused controller. One callback
  carries the file now (issue #813).

### Auth and native foundation (#773–#797, #788)

- #788: Sign in with Apple end to end (RS256-only JWKS verification with a
  bounded negative cache), a Google client-id list so a phone's token is
  accepted, `POST /api/auth/refresh`, the Capacitor origins with an
  entry-wise Turnstile localhost check. Migration `0043` adds
  `users.appleRefreshToken`. Follow-up: refresh has no absolute session cap
  and no rate limit.
- #773–#797: the Mercury Pitch native app package, `packages/mobile-runtime`,
  `packages/purchase-kit`, `packages/pitch-engine` (#784: the root app runs
  the package, not its own detector copy), the native shell and the Sing
  room. Migration `0044` rebuilds the premium-background tables so the Sing
  surface passes the CHECK. None of it changes the web app's behaviour.

### Release process

- The Phase 1 audit report and the fixing brief are in
  `~/agent-out/mercurypitch/2026-09-18/`. Three pending prod migrations ship
  with the tag: `0043`, `0044`, `0045`, `0046`.

## [0.9.7] - 2026-09-10

Two rooms per instrument needed a door, a debounce needed a ledger, and three
defects turned out to be CSS and framework defaults doing exactly what they
are specified to do.

### Added

- **The instrument room door (#763).** Piano and Guitar each open two rooms
  now — the standalone Night page and the in-app workspace — so the tab asks
  once, the first time it is pressed, and then remembers. Answered at
  `handleTabChange`, not in the tab bar: several paths reach a tab (top nav,
  the keyboard's next/prev, a call from another surface) and the question
  belongs to the destination. Hash routing is deliberately NOT intercepted —
  a deep link to `#/piano` is already a statement about where to land.

  Stored as `'ask' | 'night' | 'workspace'`, not a choice plus a remembered
  flag: unticking "remember this" has to leave _nothing_ behind, and a nullable
  choice makes "asked and declined to commit" indistinguishable from "never
  asked". The key is prefixed, so it rides the settings sync — which room
  someone wants is not a per-device fact. A phone is never asked: Night is the
  mobile experience and the workspace is a desktop surface, so both tabs go
  straight there, and in the More sheet they render as doors beside Drum Night
  rather than as tab rows. Settings > Display & Controls changes any of it,
  including back to being asked.

- **`MercuryCheckbox`, and a rebuilt settings switch (#763).** Both use brand
  colours rather than the active theme's accent — eight themes each define
  their own `--accent`, and these are meant to be the same object in all of
  them — and two stops of the spectrum (`#58a6ff` -> `#2dd4bf`), never all
  three, because the full stroke is rationed to one per screen and Settings
  carries twenty-three toggles. The bead is a mirrored sphere: chrome is one
  hard value break at the reflected horizon plus a bright bounce off the ground
  below it, and the environment map is an ellipse anchored _above_ the ball so
  its edge crosses the silhouette in a shallow smile.

- **A card of its own for every entry page (#762).** Six of thirteen entries
  shared the generic `og-image.png`, including `/mirror`, and several described
  artwork that did not exist. Five new cards, one visual language: the page's
  measurement as a flat graphic in the right third, over obsidian, no baked-in
  text. `scripts/generate-entry-og.mjs` is one model-driven generator reading
  `src/seo/entry-pages.ts` rather than a seventh copy of the same composition.

- **Guitar Night's third entry: Free play (#762).** Straight into the room
  without the load-a-song step, with the small link kept on the song screen.

- **Voice diagnostics, readable on the device (#761).** VC-1 says voice control
  dies on iOS after a stretch of silence with no `error` and no `end`, and the
  listener already handles several shapes of that — so the question was never
  "add a watchdog" but "which of the things it already does actually happened".
  A dead recognizer and a live one hearing silence look identical from outside.
  Every transition is now recorded with the few facts that separate them, off
  unless `?voicelog=1` asks for it (remembered, because walking into Karaoke
  Night is a fresh document that would otherwise drop the recording halfway
  through the thing being measured), bounded at 500 entries, and readable three
  ways: `console.info('[voice] …')` which `MP_DEV_LOGS=1` relays to `.dev-logs/`,
  the portable console on the device itself, and `voiceDiagnosticEntries()`.
  No transcript text is ever recorded. The plan asked for
  `MediaStreamTrack.readyState`; for the Web Speech path there is no such track
  to read, so `mic` reports the microphone the APP holds instead — the other
  half of the same question.

- **A command for every night, from one list (#761).** `heard: "Go to guitar
night" -> none`, straight off the device: only Karaoke Night had ever been
  given a phrase. All four rooms have one now, seven ways of asking each, and
  the room you are standing in is left out of its own list.

- **Voice control in Piano Night and Drum Night (#769).** Both registered no
  commands at all, so voice could carry somebody into either room and then had
  nothing that got them out. Added through `DeferredRoomVoiceControl`, which
  renders nothing until the person using the room does something — a pointer
  move, a touch, a key, a scroll, any of them once. `lazy()` alone does not keep
  the rooms' first-paint promise, because Solid starts the import the moment the
  component renders, which is first paint; `assert-piano-night-bundle.mjs` and
  its drum twin fail the build rather than let a room drag the speech stack in.
  The keypress that wakes it is replayed once the child has mounted, so a
  visitor who reaches for V — the one most likely to know the shortcut — does
  not have to press it twice. Room navigation lives in its own module because
  the studio command set opens Dexie, and a room that wanted only "go home" was
  pulling `vendor-db` into its first paint.

- **A developer console on whatever page the bug is on (#770).** The danger-zone
  toggle revealed a log that only existed inside the Settings panel, which is
  never the screen the bug is on, and on a phone there is no second window to
  leave it in. Same buffer, mounted per DOCUMENT — Karaoke Night, the Mirror and
  each Night entry are separate documents with no shared shell — collapsed to a
  small button until asked for, because a debug overlay that opens across the
  screen hides the control you turned it on to watch. Copy says "No clipboard"
  rather than pretending: an insecure origin refuses it outright, and a LAN dev
  server on a phone is exactly that. The host is appended to `<body>` because
  `position: fixed` is captured by any transformed ancestor, which parked an
  earlier overlay 37px above the viewport while `getComputedStyle` still read
  `bottom: 0`. Deliberately NOT the portable console: this wraps nothing
  (`initGlobalErrorHandlers` fills the buffer either way), and
  `scripts/assert-no-portable-console.mjs` still passes on all five builds.

  Two defects in it, both caught reviewing this release and fixed in #772
  before either reached a tag. The key matches `SYNCED_PREFIX`, so switching
  the console on to read what a phone was saying switched it on across every
  signed-in device and wrote a cloud `userSettings` row for a debugging
  affordance; it is device-local by nature and now sits in `EXCLUDED_KEYS`
  beside the usage counters. And the import was not lazy: it ran
  unconditionally in all seven entries, so each of the six standalone
  documents fetched the panel, its stylesheet and its icons and appended a
  host to `<body>` for a control that defaults to off — in rooms that spend
  real effort keeping their first paint empty. `armDeveloperConsole()` reads
  the flag first and loads nothing when it is off; all six are clean of it in
  the built `dist`, and the studio carries it as it always did, through
  Settings' inline log.

  It lives in `src/lib`, not beside the store it reads, because the room
  bundle audits forbid `src/stores/` in a room — the first attempt put it in
  `console-store.ts` and failed all four browser shards at `build:e2e`,
  exactly as designed. So it reads localStorage directly, in the shape
  `createPersistedSignal` writes a boolean, and a test pins that shape because
  a mismatch is the whole feature silently never arming. Reading once is
  enough in a room, which has no Settings panel; in the studio the switch
  mounts the panel itself on the press that turns it on. The audits are
  denylists, which is why CI had nothing to say about the original.

- **A tour, and a Learn chapter, for voice control (#771).** It had neither,
  and the reason was structural: every catalogue in the Guide modal is a list
  of tabs, and voice belongs to no tab — the pill is in every view. So the
  feature that most needs teaching, because using it means knowing what to
  say, was the one nothing taught. Five steps: where the pill is and that
  dimmed means resting rather than broken; the transport and navigation words;
  Mercury Sing, which is the only feature with no button at all, so a tour
  that skipped it would leave it undiscoverable; the command list on Shift+V,
  every row of which is also a button for a room too loud to talk in; and why
  commands start with "Mercury" once a track is playing. Two existing tours
  gained a clause rather than a step.

  The release walk caught four of the five spotlighting nothing on the first
  run: Settings' tabs are a switch, not a scroll, so a step pointing into the
  panel needs `navigate` to open its tab first. `walk-tours.mjs` walks this
  tour now — its targets, unlike the Karaoke mixer's, exist on a cold start —
  and both conditions are pinned in a unit test that needs no browser: every
  Settings step opens its tab, and the pill is spotlighted once per viewport,
  never twice on one. Desktop 136 steps, phone 119, no misses on either.

### Fixed

- **A theme you chose reverted on reload (#763).** Two defects, and only fixing
  both closed it. The push is debounced 1500 ms, so a reload inside that window
  killed the timer and the upload never happened; then the pull applied the
  account's row unconditionally, and that row was the _stale_ one. Being faster
  was the obvious fix and the wrong one — the same loss happens on a crash, a
  closed laptop, or a push that fails offline — so the pull has to be able to
  tell that the local value is newer.

  A local write is now recorded in a localStorage ledger **synchronously,
  before the debounce**; localStorage because the page that owes the upload is
  the page going away. A pull that finds a key there sends it up instead of
  overwriting it, and a failed push keeps its entry for the next pull to retry.
  The ledger is stamped with the identity that wrote it: logout does not clear
  localStorage, so on a shared computer one singer's unsent theme would
  otherwise have been defended against the NEXT singer's account and uploaded
  there — the same hazard `MERGE_OWNER_KEY` already guards for progress.

- **Every settings switch was 160px wide instead of 46 (#763).**
  `.settingsRow label` sets `min-width: 160px` for the text label at the left
  of a row, and `.settingsToggle` is a `<label>` too. The existing
  `width: 46px !important` could never win: `!important` settles a cascade
  fight between the SAME property, and `min-width` clamps the used width
  afterwards whatever `width` said.

- **Dropdowns closed the instant you picked anything (#763).** Binding `value`
  on a `<select>` compiles to an effect that assigns `el.value` on every change
  of the signal — including the change the user just made, writing back a value
  the element already had. Chrome on Linux fires `change` while the popup is
  still open, and assigning `.value` then closes it; the only way through was
  press-drag-release, which fires a single change at the end. `SafeSelect` now
  applies `value` only when it differs. Fixed there rather than at the call
  site: every select in the app was built this way.

- **A gradient under a border painted a flat band at the edges (#763).**
  `background-origin` defaults to `padding-box` while `background-clip`
  defaults to `border-box`, so the gradient is _sized_ to the padding box but
  _painted_ out to the border box; the 1px overhang gets the first stop's flat
  colour along the top and left and the last stop's along the bottom and right,
  on a corner radius a pixel larger than the fill's. It has to be restated
  after every `background` shorthand, which resets it — a declaration in the
  base rule alone is a silent no-op once `:checked` sets `background:` again.

- **The room door outranked the local-save veto (#763).**
  `requestActiveTabChange` is not about tabs: it blocks navigation while a take
  is still saving to this device, and lets Voice History ask before it is left.
  The door intercepted ahead of it, and because the Night answer is a full page
  navigation the in-flight save was abandoned rather than interrupted. The door
  now runs inside the accepted callback, and its own answer re-asks before
  navigating.

- **`/vocal-remover` and five siblings promised artwork they did not have
  (#762).** `imageAlt` described a card that was never generated.

- **The room gallery spent seventeen protected requests to paint four cards
  (#760).** The panel scrolls — 760px over a two-column grid — so most cards are
  below the fold when it opens, and each one is a PROTECTED request for a
  full-size plate against a 120-a-minute budget, which is how the picker
  started answering 429. Each card now waits for an `IntersectionObserver`
  before it asks for anything; the selected room still paints at once because
  it comes from the controller's already-decoded URL. Where the API is missing
  every card counts as visible, which is the old behaviour: correct, just
  eager.

- **Entry documents preloaded 173 KB that nothing painted (#760).** Measured
  serving the real build at `/vocal-range-test`: `first-light-wide.webp`
  fetched in full, `.entry-prelude` computed `display: none`, and the app's
  opening curtain — the only thing that paints that plate — never rendered on
  those pages at all. The preload sat ahead of all 36 module scripts at high
  priority, so the art was competing with the very bundle whose arrival ends
  the prelude. `index.html` keeps its preload, because there the curtain really
  does paint it, and `entry-prelude.css` still carries the plate so a slow boot
  still gets the art while the prelude is up.

- **Forty-one gradients painted a seam of the wrong colour under their border
  (#764).** The same defect the settings switch turned up, swept across the
  codebase. `background-origin` defaults to `padding-box` and `background-clip`
  to `border-box`, so a gradient under a translucent border is SIZED to the
  padding box but PAINTED to the border box: the 1px overhang gets the first
  stop's flat colour along the top and left, the last stop's along the bottom
  and right, at a corner radius 1px larger than the fill. Invisible under an
  opaque border, which is why it survived this long. Every rule restates
  `background-origin: border-box` AFTER its `background` shorthand — the
  shorthand resets it, which is how the first attempt at this fix silently did
  nothing.

- **A 401 on a data read looked like an empty library (#759).** In `request()`,
  `if (res.status === 401) throw new NoIdentityError()` sat above the `!res.ok`
  block that calls `onErrorResponse`, so `handleAuthErrorResponse` never saw the
  one status that means "your auth is the problem". Reads degrade to empty so
  the app still loads, and `getUserId()` mints an anonymous id unconditionally,
  so nothing downstream could tell an expired session from a visitor who had
  never written anything. A new `ServerAdapterConfig.onUnauthorized` seam runs
  before the 401 is swallowed, wired to `handleCloudSessionRejected()`.
  Deliberately not folded into `handleAuthErrorResponse`: on the auth endpoints
  a 401 means "wrong password", and signing someone out for mistyping one would
  be worse than the bug. Gated on `hasUpgradedAccount()`, so an anonymous
  visitor is never signed out, and naturally idempotent — a page-load's worth of
  simultaneous 401s produces one message.

- **A stalled write killed the take after one or two notes (#759).** A capture
  buffer only returns to the worklet once its chunk is durable, so the pool
  doubles as the budget for how long storage may stall. Fixed at 32 x 2048
  frames, that budget was about 1.4 s at 48 kHz — which is what ended recordings
  while the schema deadlock had every write pending. The pool now grows on
  demand to `max(32, ceil(30 * sampleRate / 2048))`, roughly 704 buffers or
  5.8 MB at 48 kHz, and warns once at the ceiling. It does not shrink back; past
  the growth point it recirculates.

- **A superseded or blocked database only explained itself in two rooms
  (#759).** It breaks every surface at once, and a superseded tab has no working
  surface left to read the explanation on. One `DatabaseLifecycleNotice` in the
  shell: superseded is `role="alert"`, never auto-dismisses and carries Reload;
  blocked is `role="status"` with no button, because it clears itself when the
  other tabs go and closing them is not something this page can do.

- **One reload was a stumble, two was a dead tab (#767, #768).** Loading whisper
  on a phone can take the whole content process with it; WebKit reloads the
  document at the same URL, the engine preference and the enable flag are both
  persisted, so the fresh document starts the same load and the SECOND kill is
  the one the user sees. A marker in `sessionStorage` is armed just before the
  load and cleared however it settles, so a document that starts while it is
  still set is a document that came back from a kill. `pagehide` clears it too,
  which is what keeps a deliberate navigation mid-download from looking like a
  crash — a jetsammed process fires no `pagehide`, and that is the line between
  them. The bias is deliberate: a missed marker costs one more attempt, a
  spurious one would refuse an engine that works. Counted rather than flagged,
  because whisper and Moonshine are two listeners over one shared worker and
  whichever load settled first was clearing the marker out from under the other.
  Coming back, the app hands over to the browser engine; picking the on-device
  one again asks first, once, and "Try anyway" is the retry.

- **The worker's reason for a failed load never left the worker (#768).** A
  worker's console reaches no device log, so `Voice model failed to load` was
  the whole of what a phone could report. The detail now rides along in the
  message, and a main-thread `console.info` announces the load before it starts
  — a log that ends there means the device died loading the model, a log that
  reaches the failure means it merely refused. On an iPhone 13 those two were
  indistinguishable until this line existed.

- **Recognition argued with a backgrounded page (#769).** iOS does not let it
  survive being backgrounded, and our own record shows the shape:
  `error code=audio-capture live=true [hidden]` then `visibilitychange`,
  `audioend`, `aborted`, respawn, `not-allowed`, stand-down. The listener now
  stands by on hidden and comes back on visible — a different state from dozing,
  with its own flag, because dozing means the opposite (stay quiet until a
  touch) and sharing one would leave a returning page silent. Desktop keeps its
  session: a background tab there keeps its microphone, and a pianist who
  alt-tabs mid-practice should not lose the ear.

- **The microphone was cold for the first session of a document (#769).** A
  documented WebKit mitigation for precisely the symptom here — the FIRST
  recognition failing while later ones are fine. One `getUserMedia`, stopped in
  the same breath, once per listener, begun rather than awaited so a permission
  prompt nobody answers cannot mean voice control never starts. Neither this nor
  the stand-by above is claimed as the fix for VC-1; both write a line in the
  record so a device run can say which fired.

- **A stutter matched nothing (#761).** "sing sing" is one `sing` said twice —
  how a person speaks when the first attempt did not seem to land, and what a
  recognizer produces from a hesitant start. Runs of the same token collapse,
  but only as a FALLBACK after the tokens as spoken have been tried, so a
  command that legitimately repeats a word keeps working. Numbers are left
  alone: "back two two" may be twenty-two misheard or two separate values, and
  quietly rewriting it would change what happens rather than fail honestly.

- **The command list lost the panel on a phone, and Drum Night's overlay was
  unreadable (#761, #769).** Along with the room log dropping the lines the
  experiment had turned on.

### Changed

- **`practise` -> `practice` throughout (#762)**, except the two British-spelling
  SEO keywords in `src/seo/entry-pages.ts`, which are deliberate. No stored key,
  column, badge id or matcher changed — `condition` in `seed-data.json` is
  display copy the grant engine never reads.

- **Karaoke's card drops "you own" (#762).** The ownership framing belongs in
  the privacy notice and terms, not on a share card.

- **"Pitch" wears the brand spectrum on every card (#762).** The generators set
  a flat `#58a6ff` while the app renders
  `linear-gradient(120deg, #58a6ff 0%, #2dd4bf 50%, #bc8cff 100%)` clipped to
  the text, in both `App.module.css` and `entry-prelude.css`. A card is the
  first frame of the page it links to, so a flat blue "Pitch" read as a
  different brand the moment the page painted.

- **AGENTS.md and CLAUDE.md say rebase, not merge (#763).** The guardrail
  already allowed `--force-with-lease` for rebases, but only in AGENTS.md;
  CLAUDE.md summarised it as "never force-push" with no qualifier, and an agent
  reading the summary concludes a rebase is off the table and merges `main`
  into the branch instead. Squash-vs-rebase is now stated as a judgement about
  what the commits are, not a default.

- **One `GUITAR_NIGHT_PATH`, not five copies of the string (#766).** The literal
  `'/guitar-night'` appeared in five places, one of them the legacy path it
  redirects from. A constant, and the redirect reads as a redirect.

## [0.9.6] - 2026-09-09

The crawlable entries become a data model, four search intents get a page of
their own, and PR Gate stops failing runs in which nothing failed.

### Added

- **Four new entry pages: `/pitch-training`, `/vocal-remover`,
  `/voice-type-test` and `/which-singer-has-my-vocal-range`.** Each is a real
  document at its own URL that hands over to the app in place — no redirect,
  the address a searcher landed on is the address they can share. Verified on
  dev: the path never changes, the canonical is self-referential, and the
  served HTML carries the page's own H1, description and JSON-LD.

### Changed

- **The nine hand-written entry HTML files are one data model.** `src/seo/entry-pages.ts`
  is now the single source of truth for all thirteen entries, and
  `src/seo/render-entry-page.ts` renders one to HTML. It drives four things
  that used to be maintained by hand and drift apart: the document itself, the
  Vite build input, the dev/preview rewrite table, and the cross-links on every
  other page. The generated `<slug>.html` files sit at the project root because
  Cloudflare's asset-layer `html_handling` maps a clean path only to a document
  beside it at the dist root; they are generated and git-ignored, with a Vitest
  `globalSetup` writing them before any suite runs.

### Fixed

- **Five entry pages shipped an empty `<noscript>`.** The extractor's regex did
  not survive Prettier wrapping the closing tag as `</noscript\n>`. The parity
  check that should have caught it ran the same broken extraction on both sides
  and compared empty to empty — a reminder that round-tripping a value through
  the code that produced it cancels the bug out twice.

- **PR Gate failed `main` on a run where 599 files and 7088 tests passed.**
  Three `ReferenceError: localStorage is not defined` unhandled rejections, all
  through one stack: `recordExerciseResult` persists in a fire-and-forget tail,
  and the promise had no owner. In CI the tail outlived the test file that
  started it, jsdom tore down and took `localStorage` with it. It hides locally
  because Node 25 carries a global `localStorage` and CI's Node 22 does not.

  The same missing owner was a real hole in the app: a browser that denies
  storage throws on the first read, and the whole session record went down with
  an unhandled rejection nobody logged. The tail now catches and says what it
  lost, and `flushExerciseHistoryWrites` gives the two tests that record runs a
  way to end where they started.

  Measured under Node 22 with CI's own command: before, `--shard=2/2` failed
  twice with 3 and 30 rejections (the count swings to 70, which is why it read
  as a flake); after, four consecutive runs exit 0 with none.

## [0.9.5] - 2026-09-09

One fix, in what a failed cloud read reports.

### Fixed

- **Every failed cloud read claimed the backend was unreachable, once per
  session, and prescribed dev-only remedies on production.** Found while
  reading the console from the tablet in 0.9.4: under an empty Karaoke
  library sat `[db] cloud backend unreachable — ... Start the dev worker
(pnpm dev:db) or unset VITE_API_BASE_URL`. The connection was fine, and
  neither remedy exists on `mercurypitch.com`.

  A failed cloud read degrades to an empty result so the app still loads.
  That is deliberate offline tolerance and is unchanged here. What it costs
  is evidence: the console line is the only thing distinguishing a library
  that is empty from one that is broken, so the line has to be true. It was
  not — `warnCloudUnreachable` printed the same sentence for a 404 on an
  undeployed route, a 500 that outlived its retries, and a body that would
  not parse, because the only thing it had was an `Error` carrying the status
  inside its message string.

  `request()` now throws a `CloudRequestError` with the status as a field
  (same message, so anything logging it reads the same). `warnCloudReadFailed`
  classifies on that: `http-<status>` when the backend answered, `offline`
  only for a `TypeError` the retry loop already gave up on, `unknown`
  otherwise. It names the entity it was reading, and the dev remedies are
  behind `IS_DEV`.

  The `offlineWarned` latch was module-level and once-ever, so the second
  failure — usually the interesting one, and always the one on a different
  table — never reached the console at all. It is now a set keyed by cause:
  one line per distinct failure, still no spam when the same one repeats.

  A 401 stays silent. Identities are provisioned on the first write, so a
  visitor who has not written anything has no rows and no problem;
  `getUserId()` mints an anonymous id unconditionally, so it cannot
  discriminate an expired session from a fresh visitor. Telling those apart
  needs a signed-in signal the adapter does not have, and is left alone.

  Eight tests in `src/tests/server-adapter.test.ts`. Four of them fail
  against the 0.9.4 behaviour, one per part of the defect: the mislabel, the
  offline classification, the once-ever latch, and the dev advice on prod.
  The production-console one re-imports the module under a mocked `IS_DEV`,
  which is the only honest way to read that branch from a test run whose
  `import.meta.env.DEV` is true. The spy is restored in `afterEach` rather
  than at the end of each body — a spy leaked by a failing assertion is
  adopted by the next `vi.spyOn` along with its recorded calls, which made an
  earlier draft of these tests pass or fail on their order.

## [0.9.4] - 2026-09-09

One fix, in how the local database behaves when an origin has several tabs.

### Fixed

- **A second tab could deadlock the IndexedDB upgrade indefinitely.** Reported
  from prod on a Galaxy Tab S9: Guitar Night and Hear Yourself sat on "opening
  your local library" for over ten minutes, Karaoke showed an empty library,
  and a take stopped a second after it started. All of it was one cause.

  The device's database was at IndexedDB version 80 (Dexie 8) while 0.9.2
  shipped Dexie 12 (IndexedDB 120), because that tablet had mostly been used
  against the dev origin. A versionless open did not return in 15 seconds. Six
  `mercurypitch.com` tabs were open. Closing them made the app work at once,
  and the database then opened in **2 ms** — so the blob re-index everyone
  reaches for as the explanation was never the cost. `uvrStemBlobs` held 45
  rows.

  The cause is not a missing handler. Dexie registers its own `versionchange`
  subscriber, and it closes the connection with `disableAutoOpen: false`, which
  leaves `autoOpen` true. The next query in that tab reopens the database at
  the old version and blocks the upgrade again, so any tab with a live query
  starves the upgrading tab forever. Slow would have finished; this could not.

  `src/db/database-lifecycle.ts` now owns both events. `versionchange` closes
  with `disableAutoOpen: true`, which a reopen cannot undo, and marks the tab
  superseded. `blocked` marks the state so a waiting room can say the true
  thing. The two loading surfaces stop asserting "re-indexing" after four
  seconds regardless of cause, and say either "close the other tabs" or
  "reload to continue" when that is what is actually happening.

  The Guitar Night take that died after one or two seconds was the same cause
  seen from another angle, and is documented in `recording-capture.ts` rather
  than changed: capture buffers return to the pool only once a chunk is durable,
  and the pool is 32 x 2048 frames — about 1.4 seconds at 48 kHz. With every
  write pending behind the wedged upgrade, capture starved in about a second
  and reported "Recording processing fell behind", which reads like a CPU
  problem and is not. Widening the pool would only lengthen the fuse.

### Testing

- `database-lifecycle.test.ts` pins the rule against a fake connection,
  including that `superseded` is terminal so the advice never softens back to
  "close some tabs" when only a reload will do.
- `database-multi-tab-upgrade.spec.ts` drives the real browser primitives. Its
  first draft passed against the unfixed build and proved nothing, because an
  idle tab upgrades fine either way — Dexie's default does close. The spec now
  keeps the tab querying through a bridge probe while another connection
  upgrades, which is the condition that produces the deadlock. Two of its three
  tests fail against the unfixed build.
- The deadlock itself is timing-dependent, so the deterministic guard is the
  reported lifecycle state rather than a race the CI could lose.

## [0.9.3] - 2026-09-09

One fix, in the background picker shared by every room.

### Fixed

- **`BackgroundArtwork` re-fetched every thumbnail whenever the resolved room
  changed.** Its loading effect read `props.controller.resolved()` in order to
  reuse the surface's already-decoded object URL for the selected card. That
  read subscribed _every_ card in the gallery to the current selection, so a
  single pick tore down all of them: `onCleanup` aborted each in-flight request
  and revoked each object URL, then the effect re-ran and issued a fresh
  full-size protected fetch per card.

  Measured against the shipped component: a gallery of the ten Piano premium
  rooms costs 10 requests to open, and three room changes took that to **39**.
  A seventeen-room gallery went from 17 to **67**. The `background-read` bucket
  allows 120 a minute, and protected art is served
  `Cache-Control: private, no-store` by design, so nothing absorbs the repeats.
  Piano Night reached prod with seventeen rooms in 0.9.2 and was the first
  surface wide enough to hit the ceiling; it answered `429` after a couple of
  picks and the gallery stuttered.

  The reuse itself was worth keeping, so it moved to a `createMemo`
  (`sharedUrl`) that tracks the selection for _display only_. The loading
  effect now depends on nothing but the option it renders, and runs once per
  card. The selected card still shows the surface's copy the moment it exists.

  This component is shared: Piano, Guitar, Drum and Karaoke Night, the Karaoke
  mobile stage, the Ear Lab shell, the Jam panel and the stem mixer all mount
  it, so every surface carried the same defect and every surface is fixed by
  the same change.

  Audited alongside it and found correct, so deliberately untouched: the
  surface controller in `background-surface.ts` loads only the selected room
  and already guards with a match check, an in-flight target comparison and a
  generation counter; `useJamRoomBackground` reads `resolved()` in its computed
  but manages a single background, and both its success and failure paths are
  guarded so the re-run is a no-op rather than a retry loop.

### Known, not changed here

- Opening the gallery still costs one protected request per unlocked room,
  because thumbnails are drawn from the `landscape-2k` variant and no smaller
  tier exists. Object URLs are revoked with the popover by deliberate design
  (the file says so), so re-opening pays again. Seven opens a minute would
  still reach the limit. Worth a thumbnail tier or a session cache, but both
  are design decisions rather than a patch.

## [0.9.2] - 2026-09-08

481 commits on `main` that are not in `v0.9.1`, spanning late July to 8
September. The 0.9.1 tag was cut off the mainline around #636, so two rooms
that were built before it — Ear Lab and Drum Night — reach a release for the
first time here. Grouped by arc rather than by commit; the arcs each carry
their own plan document under `docs/plans/`.

### Ear Lab: measurement-first ear training (#647, #661, #685, #723)

Thirteen drills, each on its own stage inside the room, built in phases: the
bench as the Regulator Room, one latency number and the seal as a ritual, the
report in the room, doors and native readiness, the rhythm seam, then the
rooms themselves. Pulse, Echo and Span, Beat Hunt and Drift, Gravity and The
Pull, Cadence and Bassline, Subdivide, The Chart. On top of the catalogue: the
Ear Path (milestones as a going train on the bench), the Daily Sprint with its
own page tour, the mixing desk (Colour, Weight and Critique on an offline
render), and the Field Book, which builds a drill out of a song the user
brings.

Traps worth keeping:

- The room enters with **no AudioContext by design**, which made every
  playback path responsible for waking one inside the gesture. `PlayPad`
  called `unlockAudio` on a context that did not exist yet, and
  `wild-playback.excerpt()` never activated at all. `playExcerpt` schedules
  against `ctx.currentTime` but resolves its promise on a wall clock, so a
  suspended context walks a whole drill in silence with no error. Fixed with
  `activateAudioPlayback(engine)`, which creates the context synchronously
  before its first await.
- A stopped run has to stay stopped, book nothing and go quiet; the first
  three attempts each left one of those three behind (#723).

### Drum Night: a playable room (#628, #656, #690, #714)

A playable kit and e-kit input, four lazily loaded kit flavours, a
session-local groove rack, an idiom pattern library to start from, loops
projected onto the score, the shared song timeline, full-band play-along, and
imported authored drum sessions. The feel engine is taught from measured
performances rather than hand-tuned, and sampled hits vary so a repeated note
stops machine-gunning.

Saved grooves and take history came with the gate that a take summary is
stamped with the project id, revision and fingerprint — so a take is a
comparison against a saved groove, and cannot exist without one. The UI stated
that requirement as a dead end for a long time; it now offers the save that
unblocks it.

### Guitar Night: percussion, then recording (#632, #634, #646, #678, #690, #739, #741)

Imported percussion support and the percussion song timeline, then the scoring
work that measures what the player actually played, then the melody recorder:
Studio amp tones, Studio Lead, live monitoring while recording, and shared song
controls. The amp runs a Lite tone until the cabinet impulse response has been
fetched, checksummed and decoded, then crossfades to Studio — which is a trap
for any test that measures level or tone (#740, and see below).

#741 completed the recorder: Live, Replay and Practice over one stable stage
and the existing input ownership, with Practice reusing the Rehearse scoring
engine, A/B, tempo, count-in, results and Keep. Replay chooses original audio
or synthesized notes, clean or through the current or the saved amp. Exports
gained compact filenames and native GP7 notation, written by a dedicated
`recording-gp7.ts` that repairs the two GPIF metadata fields alphaTab 1.8.3
writes incorrectly. Capture now previews short PCM batches while keeping the
durable checkpoints bounded, and blocked Practice Play opens an actionable
input prompt whose cancellation safely rejects a late device or permission
result. Two ownerless Solid computations were fixed by moving conditional memo
creation out of JSX getters into component-owned memos.

#746 added chord refinement on top of it, deliberately reversible and off the
audible path. A pinned, self-hosted Basic Pitch model and single-threaded ONNX
WASM load lazily into a disposable Worker — about 13 MiB of WASM and a 230 kB
model on first use, no upload and no second microphone. Two independent Session
switches: **Live chords** (off initially), which borrows the selected dry input
through a silent bounded side tap to show simultaneous pitches while playing,
and **Refine after Stop** (on initially), which prepares a Current/Refined
comparison a take can accept or reject, with a one-step restore that survives a
reload. Split, merge, practice, MIDI and GP7 are polyphony-safe without moving
the original performance timing; the captured evidence and accepted practice
revisions are never overwritten.

Left standing: capture-driven browser specs measure real-time frames, and
buffers recycle only after each checkpoint is durable, so they fail under IO
contention (reproduced locally by moving the browser profile off tmpfs) — the
same 1.4 s budget that stops a take with "processing fell behind" on slow
device storage. Chord refinement is a separate follow-up (#746).

### Signing in (#664, #672, #722)

Passkeys, TOTP two-factor with recovery, email-code sign-in, and one row per
signed-in device. #722 closed the three holes the review found: passkeys verify
locally, enabling 2FA revokes legacy tokens, and code guesses burn atomically
so they cannot be raced. #672 makes a returning singer's device offer the way
it already signed in.

### Challenges, badges and Progress (#698, #703, #708, #709, #710, #718, #719, #735)

A challenge closes cleanly, publishes its podium and awards it; a podium that
closed before badges existed can still be awarded after the fact; a closed
challenge cannot be set live again. The podium definitions travel as a
migration rather than a seed. The Legends view took the leaderboard, the
Progress cabinet took every badge and achievement, and the vocal challenges
moved into Practice beside the exercises.

### Storage and playback (#656, #683, #694)

Separated stems move out of the database and into Blobs with windowed
playback, which is what lets a phone open a full-band song at all. Karaoke
streams a song on a phone rather than holding it. The stem mixer's vocal
lyrics generator came out into its own hook (Slice F).

### Voice control (#662, #691, #715, #737, #740)

The pill borrows the header row on a phone and gives it back. Segment offsets
sit on the clock that indexes them. A refused microphone stands down. Then the
0.9.2 retest rounds, which found four separate causes behind one symptom:

- The quiet-session backoff left waits of up to 15 s while the pill still read
  `listening`. Any wait over 900 ms now reports `dozing`, and the ramp caps at
  3 s.
- WebKit drops a session under Siri or a call with no `end` and no `error`,
  leaving `live` true over nothing. Stale-session detection is 12 s where a
  respawn is visible and 45 s on desktop.
- WebKit also ends a session as soon as it delivers a final result, and the
  300 ms respawn ate the start of the next command. A session that heard a
  word now respawns on the next task.
- `go` was in `PLAY_PHRASES` and is the first word of every navigation phrase.
  A recognizer that finalises an utterance in pieces delivers a bare "go",
  which started playback before the rest of the sentence arrived.

Still open on iOS: see `VC-1` in the backlog. Android is unaffected.

### Shell, mobile and the retest rounds (#674, #676, #720, #734, #737, #738, #740)

Phone toast cap of two, the verify-email nudge as an inline strip, the docked
voice pill, Piano Night's one-row phone landscape, Guitar Night's phone rows
returned to the neck and transport, and the drum take strip carrying Finish so
the bottom rail keeps plain play and pause. History handling was rebuilt around
position stamps: a return traversal is known by its stamp and a push by the
absence of `popstate`, because real browsers split those two into different
tasks and jsdom does not.

### Crawlable entry documents (#743, #744, #745, #747, #748, #749)

`mercurypitch.com` held five indexed URLs and appeared for none of the eighteen
keywords we target, because every entry document is a JavaScript shell: `#root`
is empty in the file, so a crawler that does not run the bundle read no
heading, no sentence and no link out, and the nine sitemap-only orphans got the
lowest crawl priority there is. #743 put a prelude after `#root` in all ten
documents — the page's own `h1`, its claim, a link to every sibling room and to
the landing — hidden by `#root:not(:empty) ~ .entry-prelude` the moment the app
mounts. It also made the four `FAQPage` blocks describe something visible,
added `Organization` and `WebApplication` structured data, put `/jam` in the
sitemap, and stopped non-production deploys competing with production: a
build-time Vite plugin writes a disallow-all `robots.txt` and an
`X-Robots-Tag: noindex, nofollow` for `build:dev`, which has to happen at build
time because the Cloudflare asset layer answers most requests without ever
reaching `src/worker.ts`.

#745 took the ten byte-identical inline `<style>` blocks into one
`src/styles/entry-prelude.css`, and made Drum Night a listed page — it shipped
as a `noindex, nofollow` pilot with nothing linking to it, while shipping as a
feature in this very release.

#747 answered what the prelude actually is: the loading screen. The home entry
preloads 55 modules — 4.8 MB of JS — so it holds the screen for the whole boot,
and it was showing left-aligned body copy before the app's own opening curtain
arrived with a plate and a lockup. It now wears the curtain's clothes: the
First Light plate, the brand lockup at the curtain's height, everything
centred, a scrim over the water. The ground paints immediately — delaying it
flashes the body's white through first — while the lockup waits 160 ms and the
copy 620 ms, so a boot that beats them is never interrupted by a word. The
standalone rooms matter most here: they mount their own entry and never show
App.tsx's curtain at all.

Trap worth keeping: clearing `#root` after boot is **not** a way to inspect the
pre-boot paint. The bundle's injected CSS then gives `#root` a 100vh
min-height and pushes the prelude off screen. Strip every stylesheet but the
prelude's own — which is also how the missing `body { margin: 0 }` surfaced.

#744 brought five entry titles inside the roughly 15-to-65-character window
Bing's URL inspection reports on, trimming from the tail so the query stays at
the front, and pinned the bound across all ten documents. The root title stays
at 63: shortening it means choosing what MercuryPitch leads with, which is a
positioning call rather than a length one.

#748 stopped `not_found_handling: "single-page-application"` answering every
unmatched path with `index.html` and a 200 — soft 404s by the infinite supply,
on a site whose actual problem is too few indexed pages. It is `404-page` now,
with a real 404 document built as a Vite input so it shares the prelude
stylesheet, carrying `noindex, follow` and no canonical. `/exercises/<slug>`
was the one path genuinely relying on the fallback and is served on purpose by
`src/worker.ts` with the URL intact. It also ships an `llms.txt`, including a
"what MercuryPitch does not do" section drawn from the claims list, because
GPTBot is the largest crawler on this domain.

#749 closed what that sweep missed, found in review: the six friendly admin
paths in `src/lib/admin-entry-route.ts` had exactly the same shape as the
exercise deep links — no file, normalized to a hash route on boot — and went to
404 with the fallback. The lesson is the one the CRITICAL comment in
`wrangler.jsonc` already states: the asset layer answers every path not listed
in `run_worker_first` **without invoking the Worker**, so every pathname the
client routes on has to be listed there deliberately. A unit test over the
mapping function cannot see this; only a routing test can.

### Testing and CI (#655, #659, #740)

The PR gate is parallel and runs the full browser suite on PRs, sharded four
ways. Each fake-mic tone length got its own file. Two traps are now written
down where they bit:

- A `createMemo` runs **eagerly at creation**, so a memo that reads a signal
  declared below it throws during render. The unit suite cannot see it; only
  the browser suite can.
- Any Guitar Night browser test that measures tone or level has to settle the
  amp first, or it is racing a 172 KB cabinet download. Reproduce by delaying
  `**/*.wav`.

## [0.9.1] - 2026-08-25

### Guitar Night: multi-track reading (#611, #613, #616, #617, #619)

Four phases of `docs/plans/guitar-night-multi-track-reading.md`. Phase 1 put a
track switcher in the room; #613 added the page it switches on — bars, systems
and lanes computed as pure geometry first, with no DOM, no Solid and no canvas,
so two painters can be held to the same layout by assertion rather than by eye.
#616 puts one other part in the corner of the moving views on the same
playhead, and makes the corner offer the part you just left so a second tap
returns rather than cycling. #617 collapses two Standard MIDI decoders into
one: the tick-native, validated Piano Project reader, which keeps the meta
events the compact track-picker scanner threw away — including the time
signatures that bar lines actually come from.

#619 came from three reports against one five-part file, and the third was the
tell: `pause()` keeps a rehearsal take alive so Resume can continue it, and
`takePinsSetup()` counts a paused take as pinned, so with only Play and Pause
on the transport the first take locked the room's setup permanently. The other
two — every other part muted by default, and a disabled Listening toggle with
an unadjustable click — were symptoms of the same missing exit.

`followStem` had always tuned the stage from `stemKind`, so offering the guitar
stem to the note reader alongside bass needed nothing downstream; it had been
withheld on the honest grounds that the stem is often chordal and pitch
detection is monophonic.

### Score-to-recording sync (#618, #620, #622)

All three phases of `docs/plans/score-recording-sync.md`. A written score
counts musical beats; a recording counts seconds and drifts. Phase 1 makes the
map between the two clocks a first-class object — storable, nudgeable, handed
to a view. Phase 2 puts a measured stem transcription and an attached tab on
one page by resolving their clocks against each other. Phase 3 closes the gap
where there is no transcription at all — a live version, a cover, a song whose
stems were never separated — by letting two marked points establish the map by
hand.

### Guitar Night: the rehearsal workspace (#632)

The authored-score mix becomes fully live: persistent master volume, pop-free
per-part mute and solo, tab sound, click and count-in, all reconfigurable
without moving the playhead. A/B loops are direct — completing B jumps to A
with no second count-in, rail markers commit once on drag, Clear continues from
the audible beat, and a close range gets a deliberate precision lens instead of
surprise auto-zoom. The transport reorganizes around Listening, the full-score
rail, compact loop actions, tempo and volume, with an Off to Room mic to Direct
input to MIDI cycle and mobile Session fallbacks. The secondary preview becomes
movable and resizable with real protected geometry and per-view persistence.
Piano Night's fallboard gains an isolated, persisted master volume in the same
slice.

### Device sync between two of your own devices (#534)

REQ-SYNC-030..035 in `docs/specs/device-sync-transfers.ears.md`. A session
outlives the dialog: `SyncHost` mounts the dialog and a corner chip once per
entry (app shell and Karaoke Night), closing a connected session keeps it and
its transfers alive, and Disconnect is the only deliberate end — the backdrop
used to call `stopSync()`. `platform.keepAwake` becomes refcounted so Drive
jobs and sync transfers share one sentinel. The hello carries the far library
by hash (capped at 2000) so the send list can mark what is already over there,
and a dropped pair rebuilds itself at 2s and 8s, twice, with the initiator
chosen by the same glare rule as a fresh join.

A multi-angle audit of the branch found fourteen defects before merge, all the
same shape: an invariant the old close-means-stop provided, never
re-established. The three that mattered — a hidden waiting room stayed
joinable under its old code for ten minutes and auto-accepted the first
stranger with device name, free space and library hashes; the documented
"two tries" reconnect had no counter and scheduled two more on every failure;
and the idle countdown could only see the local dialog, so a peer freeing space
in its own open dialog was cut off at ten minutes. Fixed with one 45s grace
window covering the first two and a `sync-active` keepalive frame for the
third. Transfers are refused over a relayed route on purpose — STUN only, no
TURN, so cross-network pairs cannot connect and are told so.

### One run taxonomy, and drills that count their own notes (#626, #631)

"Session" meant three different things on three adjacent screens, and the
Progress card counted `buildTrend(sessions).length`, which drops any run
without per-note detail — so a history of drills read zero. `run-kinds.ts` is
now the single taxonomy: four kinds, each with one label, colour and ranked
flag, consumed by every counting surface.

Separately, three of the four `sessionRecords` write paths hard-coded
`notesHit`/`totalNotes` to zero, so only a multi-item Practice session ever
banked a real tally. Ten drills run a discrete sequence of sung notes and each
now tallies on ITS OWN measure of a note rather than a second definition
bolted on top — the evidence was already computed and thrown away.

### Cloudflare Turnstile on public forms (#614, #627)

Sign-in, sign-up and contact run Turnstile wherever it is enforced. The CSP in
`public/_headers` allowed Google's hosts and nothing else, so the widget script
was blocked outright; the origin is in both directives now, with a test that
reads `_headers` and fails if it drifts from the origin `Turnstile.tsx`
actually loads. A blocked widget no longer holds a form hostage — the component
reports `turnstileUnavailable()` and the form proceeds.

### Added

- **`--gn-glass`, one token for how much of the Guitar Night room shows.**
  The room art was buried under three separate things and turning any one of
  them down did nothing, so the slider drives all three:
  `--gn-surface-scale` multiplies the alpha of the chrome that floats over
  the room, `--gn-blur-scale` multiplies every `backdrop-filter` radius on
  it, and `--gn-veil-scale` multiplies the two dark gradients `.backdrop`
  lays over its own photograph. Every scale is `1 - glass * k`, so at zero
  each resolves to exactly 1 and every value reduces to the literal it
  replaced — the old room stays reachable, exactly. Menus, scrims and
  full-screen overlays are deliberately excluded: a dropdown you can read the
  room through is the failure this fixes, not a feature of it. Measured in
  Chromium: the entry panel goes from `blur(18px)` over `rgba(22,17,14,0.94)`
  at 0, through `blur(8.9px)` over `rgba(22,17,14,0.60)` at the shipped
  default, to `blur(1.4px)` over `rgba(22,17,14,0.33)` at 1.
- **The slider lives in the Room menu, not the top bar.** Karaoke Night's
  equivalent sits in its top bar and is `display: none` under 900px, so on
  the phone the report came from there is no way to reach it. Guitar Night's
  Room menu is the collapsed drawer at that width, so this one survives.

- **`ProgressMilestoneView` carries the seed's `icon`, and the shelf falls
  back to `iconByName(...)` instead of a blank `<span>`.** `badgeArtSrc` only
  knows the sixteen BADGE icons, each with a `public/badges/<icon>.webp`; the
  59 seeded achievements draw from a much larger vocabulary, so **46 of them**
  resolved to `artUrl: undefined` and rendered as a nameless dark disc. The
  shelf lists only EARNED milestones (`model.ts` skips `unlocked !== true`),
  so that disc never meant "locked" — it meant missing art. `badge-art.ts`
  already promised this fallback in its own header and `ProfileView` and
  `VocalChallenges` honoured it; the Progress shelf did not. No art needed:
  `iconByName` resolves every seeded name, with `IconBadge` as the floor.
  Drawn medallions for the 27 uncovered icons are a separate, optional
  upgrade — prompts are written and waiting.

### Fixed

- **The milestones rail is drawn on a new `.shelfRail` wrapper rather than on
  `.milestoneShelf` itself.** An absolutely positioned child of a scroll
  container resolves `left`/`right` against the padding box — the scrollport
  — not the scrollable content, so the rail was exactly one screenful wide
  and, being inside the scroller, slid away with the badges it was under. On
  the wrapper it spans the visible shelf and stays put while the objects
  slide over it. The scrollbar gutter is a `--shelf-scrollbar` custom
  property, zeroed at the phone breakpoint where the scrollbar is hidden.
  `src/e2e/progress.spec.ts` pins the contract in one line: the element that
  owns the rail must not be the element that scrolls.
- **`StaleBuildRecovery` and both `SyncSettings` check buttons use
  `shared/Spinner`.** All three rotated the `RotateCcw` glyph — the Drive one
  at `-360deg`, deliberately, "because the arrow points counter-clockwise".
  An arrow has an arrowhead, and an arrowhead is a landmark the eye tracks, so
  the whole thing read as a tumbling object. The idle Drive buttons keep the
  arrow: it is correct as an _action_ icon, and only the busy state changed.
  The banner also gains reduced-motion behaviour it did not have — it used to
  set `animation: none`, leaving a motionless refresh arrow on screen for the
  entire reload.
- **`Walkthrough`'s `waitForTarget` poll is cancelled on unmount.** It retried
  `document.querySelector` twenty times at 50ms with nothing tracking the
  timers, so dismissing the guide left up to a second of work scheduled
  against a page on its way out. Pre-existing, and invisible in the app; under
  vitest it surfaced once the suite passed 775 files as an unhandled
  `ReferenceError: document is not defined` thrown after the jsdom environment
  was torn down — every test green and the run still exit 1. Measured: 17
  stray `querySelector` calls after unmount before the fix, none after.

### Changed

- **`createStageGlassPreference` (`src/lib/stage-glass-preference.ts`) now
  holds the clamping and storage handling both rooms need**, and Karaoke
  Night's `stage-transparency.ts` is thirteen lines of numbers on top of it.
  It also fixes a latent bug the shared version exposed: `Number(null)` and
  `Number('')` are both 0, so the old read would have taken an absent
  preference as a deliberate zero for any room whose minimum is 0 — Guitar
  Night's is, because zero has to mean "the room as it shipped". The raw
  string is checked before `Number()` sees it.

### Mixer master headroom + soft clipper

`src/features/stem-mixer/master-headroom.ts` (new). Reported: the backing
track drops when the mic goes live and cannot be turned back up.

Audit result: **the app does no ducking.** No compressor, no sidechain, no
gain move tied to `micActive` anywhere. The attenuation is iOS switching the
page to `playAndRecord`, and jam's `TRANSMIT_CONSTRAINTS` echo cancellation.
Neither is ours to switch off, so the fix is headroom rather than a bug fix.

- `mainGain` was `0.7` hardcoded at two sites with no UI. It is now
  `MUSIC_LEVEL`, a `createClampedPreference` over
  `pitchperfect_mixer_music_level`, default **0.7** (byte-identical to the old
  behaviour on upgrade), range 0.35..2.0 step 0.05. +9.1 dB of headroom over
  the old fixed value, and it goes down as well as up.
- Setting it ramps over 50 ms rather than writing — a step on a live bus is a
  click, and this bus is carrying the song.
- The master now ends in a `WaveShaperNode`, not the raw destination:
  identity below 0.8, `tanh`-shaped above, asymptotic to 1.0, continuous in
  value and slope at the knee. A two-stem mix at 2.0 is 4x full scale and
  would otherwise break up.
- **A shaper, not a `DynamicsCompressorNode`, on purpose.** Chromium's
  compressor carries an internal lookahead; the mixer scores mic pitch against
  reference pitch frame by frame, so added output latency is a silent scoring
  error. A shaper is a per-sample function — `oversample: 'none'`, zero
  latency.
- `src/lib/stage-glass-preference.ts` renamed to `clamped-preference.ts`
  (`createClampedPreference`). A third unrelated consumer made the old name a
  lie; every consumer was still inside the unmerged PR.
- Both `AudioContext` doubles (`src/tests/setup.ts` and the load spec's local
  fake) gained `createWaveShaper` — without it the mixer's load path throws.
- One-shot note when the mic first goes live, pointing at the slider. It says
  phones, not "the app is ducking you", because the app is not.

Validation: `master-headroom.test.ts` 18 tests (100% stmts/branches/funcs/
lines), `src/tests/mixer-music-level.test.ts` 11 wiring tests, and a Chromium
e2e that the control is reachable, bounded by the store and survives a reload.
Six mutations checked red (master pinned back to 0.7, shaper bypassed,
threshold removed, once-ever guard dropped, control moved behind the stage-
settings gate, ramp turned into a step); removing the control entirely turns
the e2e red, which is the original complaint reproduced. Whole
`stem-mixer-controls.spec.ts` 8/8 in Chromium — the real graph still carries
audio.

### Achievement medallions — 27 drawn, and a geometry guard

`public/badges/` goes from 16 files to 43; the 27 new icons are registered in
`BADGE_ART_ICONS`. Art is keyed by the seed's `icon`, not the row id, and
achievements share icons — so 27 files light up all 46 achievements that had
none. Achievements carry no tier (`tier: null` on all 59), so all 27 are gold
where a badge would vary its metal.

**The delivered art did not fit the app, and the diff would never have shown
it.** `ProgressPage.module.css` draws badge art at 132px under
`clip-path: circle(39% at 50% 50%)` — 39% of the _width_, so only the central
78% is ever seen. The batch arrived frame-filling with the rim's outer edge at
r = 0.92; every ring would have been sliced off. Rescaled to r ≈ 0.69, which
is where the existing 16 sit, and composited onto each medallion's own enamel
colour so the annulus between rim and clip edge has no seam.

`src/tests/badge-art-geometry.test.ts` (new) decodes every file with `sharp`
and measures the rim against the file's OWN field luminance — metal-agnostic,
because badges come in bronze and silver too, and two legacy ones sit on a
warm field that a "looks golden" test mistakes for the rim. Asserts 192px,
opaque to the corner, nothing past r = 0.82, and the 27 recipe icons inside a
tight band. Mutation: drop the unscaled `trophy.png` back in → 2 tests red.

Noted and deliberately left: `fire` (0.81) and `rocket` (0.80) already
overflow the clip by a few pixels of outer glow. They are lossy 192px files
with no original, so re-encoding to win 4% of a radius costs more than it buys.

`milestone-art.test.tsx` asserted "most achievements have no medallion" and
that `10 Notes` falls back — both were statements of the bug and are now
false. Rewritten to the new truth, with the fallback still covered so the next
seeded achievement cannot reopen it.

### Guitar fretboard modes collapse on a phone

Eight modes each hang a HUD above the fretboard (`GuitarPage.tsx` 551-894, one
contiguous block). At 390px the stack pushed the fretboard below the fold.

One wrapper and a media query — deliberately not a rebuild, since these go
away when Guitar Night reaches parity. `.gp-mode-hud-dock` collapses under
768px to a 40px labelled row (`GUITAR_MODE_HUD_LABELS` names the active mode);
desktop hides the toggle and never hides the body, so the existing "every
interactive mode renders its HUD" e2e is unchanged and still passes.

In flow rather than fixed to the viewport: the page already docks a control
bar at the bottom on a phone, and a second fixed layer is how two things end
up on top of each other. Open state caps at 45vh with its own scroll.

Validation: `src/tests/guitar-mode-hud-dock.test.ts` 11 tests, 4 mutations red
(starts open, body hidden outside the media query, a HUD drifting out of the
dock, touch target shrunk). e2e `guitar.spec.ts` 10/10 including a new
390x844 test that the toggle is thumb-sized, names the mode, and that the
fretboard is on screen with the controls one tap away.

### Open Graph: the room nobody could share, and the link that missed its card

Two findings from one question — "do we have an OG image for piano-night, and
for jam rooms?"

**Piano Night had no Open Graph tags at all.** Not a missing image: no
`og:title`, no `og:description`, no `og:image`, no Twitter card. Every other
entry page (`index`, `karaoke`, `jam`, `guitar-night`, `mirror`, `glass`) had
a full block. `scripts/generate-piano-night-og.mjs` (new) follows the three
existing generators — Afterglow Studio inlined as a data URI, the brand
lockup, the room list restaged as a panel — in Piano Night's own brass/cyan
palette off `PianoNightApp.module.css`, and in Outfit rather than Guitar
Night's serif, because the room is set in Avenir Next / Inter.

**A shared Jam room link never reached the Jam card.** `jam-og.png` has
existed since the card set was built and `jam.html` wires it correctly, but
`JamPanel`'s copy button produced `${origin}/#/jam:ROOMID` — the ROOT path
with a hash. A fragment is never sent to a server, so every invite was
fetched as `/`, served `index.html`, and unfurled with the generic site
image. Now `${origin}/jam#/jam:ROOMID`: same fragment, so the router is
untouched and links already in chat histories still work, but `/jam` is a
path `vite.config.ts` maps to `jam.html`. `replaceState` deliberately left
alone — the address bar is internal and changing it is routing risk for no
share benefit.

`src/tests/entry-page-og.test.ts` (new) enumerates every root `.html`, and
asserts a complete OG + Twitter block, that the declared 1200x630 is what the
tags claim, that `twitter:image` has not drifted from `og:image`, and that the
file each one points at exists on disk. Plus a generator-per-room check, so a
card nobody can regenerate is also a failure. Mutations red: the original
Piano Night state (block deleted), a missing image file, a drifted
`twitter:image`, and the old jam link shape.

### Challenges: period-neutral, and an admin that does the arithmetic

**The assessment first, because it decided the shape: moving from weekly to
monthly needs no schema change and no migration.** There is no period field
anywhere in the model — `weekly-service.ts` stores `startsAt` and `endsAt` and
nothing else, and "live" is `startsAt <= now < endsAt`. A month-long challenge
is two dates four weeks apart. The only thing that would have gone stale was
the copy.

So the copy stopped saying it. "Legend Attempt" replaces "This Week's Legend"
on the Home card, the challenge stage and its aria-label, and the guided tour
step no longer promises one "every week" — the card's countdown already says
how many days are left, which is the honest answer whatever the period is.
Internal names are deliberately untouched: `WeeklyLegendHero.tsx`,
`weekly-service.ts`, `weekly_attempt`/`weekly_join`, the table. Renaming those
is wide, invisible, and ends in a migration.

`src/features/challenges/challenge-window.ts` (new, 100% coverage) is the
arithmetic: `mondayOf`, ISO `isoWeekNumber`/`isoWeekYear` (the real rule —
the week containing the year's first Thursday — so 2025-12-29 is W1 of 2026
and 2027-01-01 is W53 of 2026), `shiftWeeks`, `weeksBetween`, `windowFrom`,
and `reflowQueue`/`reflowChanges`/`reorder`.

Admin form: the two raw ISO inputs gained a stepper above them — arrows on the
opening week (which carries the closing week with it, so stepping the start is
"run this later", not "make it shorter"), arrows on the closing week (which
change the length, floored at one week — a window that closes before it opens
passes `now < endsAt` the wrong way and is live forever), and one-press
one/two/four/eight week periods. The ISO fields stay for anything the stepper
cannot express.

Admin queue: a new panel lists everything behind the live challenge, drag-
reorderable, with keyboard up/down as well — a drag handle alone is
unreachable without a pointer. "Recompute dates" re-dates them back to back
from the live one's close. **Manual on purpose**: an automatic reflow would
move a live challenge out from under whoever is attempting it, and would make
a mis-drag destructive. `reflowChanges` diffs against what is stored so
unmoved rows are not rewritten, and a partial failure keeps going rather than
leaving a gap mid-queue.

Validation: `challenge-window.test.ts` 30 tests including an 800-day sweep
that no week falls outside 1..53; `admin-challenge-window.test.tsx` 16
render tests over the stepper and the queue; `challenge-period-neutral.test.ts`
9 tests that scan user-facing strings in the challenge surfaces for a period
word. Mutations red: start-step dropping its carry, the closing-week floor
removed, the queue leaving a gap, a reflow wired into the drop handler, and a
drop that ignores direction. The reflow-on-drop mutation initially passed —
the drag path had no test at all, only the keyboard buttons — which is why
there are now three drag tests.

### The music level moved to the surface that needs it

Shipped first in the mixer's header, and the report came straight back: "the
slider is basically only visible on desktop in top of the stem mixer, and is
ugly as hell. So the one place it is needed, can't see it, since stem mixer
isn't visible on mobile small screens, only the zen mode."

Both halves are correct. Under `isNarrow()` `StemMixer` renders
`KaraokeMobileStage` INSTEAD of the mixer — the header the slider lived in is
not on the page at all — and the platform behaviour that turns the backing
track down (iOS switching the page to `playAndRecord` and engaging its own
noise cancelling when a mic opens) is a phone behaviour. The control is now a
`MusicLevelIcon` button in the zen transport's right slot, mirroring the mic
in the left slot, opening a glass sheet with the slider, a percentage read out
against the shipped 0.7 as 100%, and one line saying why it exists. The
desktop header slider is gone; desktop reaches the same control through Zen.

The three props (`musicLevel`, `onMusicLevel`, `musicLevelRange`) are optional
together, so a host that cannot offer a level simply renders no button and the
transport stays symmetrical. The mic hint is gated on `zenStage()` for the
same reason — telling a desktop mixer user about a button that is not on their
screen would also burn the once-ever flag doing it.

The hint's wording was wrong as well: it said the backing track was lost.
Nothing is lost and nothing is muted, so it now names noise cancelling and
points at the button.

Validation: `KaraokeMobileStage.musicLevel.test.tsx` 14 render tests over the
button, the sheet and the slider; `StemMixerZenMusicLevel.test.tsx` 6 tests
that mount the whole mixer at phone width — the exact configuration that was
broken — click the mic and read the note back; `mixer-music-level.test.ts`
rewritten to the new wiring. Mutations red: `hasMusicLevel` checking only the
value, the slider reporting the raw input string, the readout using raw gain,
the sheet ignoring its open state, the hint firing off the zen stage, the old
wording, and the props dropped from the stage.

`MockAnalyser` in `src/tests/setup.ts` gained `connect`/`disconnect`. An
`AnalyserNode` is an `AudioNode`, and the mic controller tears its graph down
with `micAnalyserNode?.disconnect()`; without them the double threw on every
unmount that had opened a mic, which is why no test had ever opened one.

### The room doors say they heard you

Reported: "guitar night and piano night buttons that also go to another page,
I didn't see it showing the spinner for long loading and it was loading
multiple seconds."

Measured first, in a real browser at 390px, before changing anything: a
trusted click DOES set `data-busy` and mount the spinner. The wiring was never
the problem. A 12px ring appended to a chip in the status row at the top of
the screen was, while the eye was on the middle of the screen waiting for a
page. jsdom cannot see any of that — it has no layout, and `fireEvent.click`
on an anchor is not a navigation.

So the acknowledgement is now the size of the thing that was touched:
`.busyLink[data-busy='true']` dims the whole control, and an iconified
`.chipBtn` swaps its glyph for the spinner rather than growing beside it. The
options-sheet door into Piano Night was still a plain `<a>` with no busy state
at all; it is a `BusyLink` now.

Validation: `src/e2e/room-chip-busy.spec.ts`, 4 Playwright tests. Holding the
navigation still is the hard part — the rooms are separate documents, so a
click takes the evidence with it. `route.abort()` swaps in an error page and
`route.fulfill` with a delay makes Playwright's own actionability waits block
on the navigation; `204 No Content` leaves the document exactly as it was,
mid-tap. Mutations red: the dim removed, the icon left beside the ring, and
the options-sheet door reverted to an anchor.

### Admin queue arrows: one SVG cannot be in two places

The move-up/move-down buttons in the challenge queue drew empty circles on
every row but the last. `AdminWeeklyPage` held its glyphs as module-level JSX
values — `const arrowUp = (<svg/>)` — and in Solid that is ONE DOM node.
Rendering it in a `<For>` does not copy it, it MOVES it, so the last row wins
and every earlier row keeps the button's border and loses its arrow. All five
glyphs are functions now.

Validation: two tests in `admin-challenge-window.test.tsx` — that an arrow is
drawn on every row rather than just the last, and that all four stepper
buttons have one. Both red against the shared-value form.

### Guitar Night glass opens further, and starts mid-slider

"the max setting should be a bit more, and around middle by defualt". The
range stayed 0..1 — a clean clarity scale — and the curve got steeper:
`--gn-surface-scale` 0.55 -> 0.65, `--gn-blur-scale` 0.8 -> 0.92,
`--gn-veil-scale` 0.5 -> 0.6, with the default moving 0.35 -> 0.55. The
faceplate carried 12.96px of blur at the old default and carries 8.9px now.
Zero is still the room exactly as it shipped.

### Piano Night and Guitar Night come off noindex

Both rooms shipped as `noindex, nofollow` pilot documents and were absent from
`public/sitemap.xml`. That was right while they were pilots and wrong once they
were not: `/karaoke-night` and `/jam` are indexed, and the two instrument rooms
were the only real entry pages hidden from search.

What actually blocked them was thinner than the robots tag. A page is safe to
put in a sitemap only when it can stand on its own — its own title, a
description worth showing in a result, a self-canonical, and a share card — and
the pilot heads had a bare `Piano Night — MercuryPitch` title and a single line
of description. So this is not a one-word robots flip: both heads gained a real
title, a description, a keyword line and the full favicon set the other entries
carry, and both were added to the sitemap.

Piano Night's Open Graph copy is untouched. It was written two entries above
this one and is better than anything worth replacing it with; only the head
around it changed.

The test that pinned the old behaviour asserted the _pilot_ state — `noindex`,
and absence from the sitemap. Inverting those assertions alone would have
pinned nothing worth pinning, so it now checks the property that matters: a
room in the sitemap is self-canonical, carries a description over 120
characters, a keyword line and an `og:image`. It runs over both rooms from one
table, so Guitar Night is covered too — it never had a test of its own.

## [0.9.0] - 2026-08-18

### Added

- **Guitar Night demo song port.** `createDemoGuitarNightSongPort` reads the
  same `loadDemoSongs()` manifest list Karaoke Night uses and hands its two
  remote stems back as a lease, so a Content Studio swap changes both rooms
  at once and a parked demo disappears from both. Composed with the UVR port
  by `composeGuitarNightSongPorts`, which keeps the two failure modes apart:
  a device library that will not open still rejects (the room's "Your local
  library could not be opened" + Try again is built on that), while an
  unreachable demo costs only the demo. Because it is a port, staging, deep
  links, history, aborts and lease release are unchanged. The list renders
  demos as their own group outside the `Switch` — the empty-library branch is
  the one they exist for — excluded from the "on this device" count and never
  paginated; a `subtitle` stands in for the prepared date, since `createdAt`
  is 0. `GuitarNightBackingLease.source === 'demo'` withholds
  `onSeparateGuitar`: that path calls `refreshUvrSessionFromDb` before
  billing a GPU split, and a demo has no durable record to reconnect to.
  Undeclared durations resolve to `ASSUMED_DEMO_SECONDS` so the transport's
  decode budget errs toward streaming. The composition also bounds the wait:
  the device library opens after `DEMO_CATALOG_WAIT_MS` whether or not the
  demo manifest has answered, so a dead connection cannot hold the visitor's
  own songs shut.

- **`src/lib/song-audio-cache.ts` — a bounded Cache Storage cache for remote
  song audio.** R2 serves the demo stems with an ETag, a Last-Modified and no
  `Cache-Control`, so Safari re-fetched ~8 MB on every open. Cache-first, 96
  MiB budget, 32 MiB per-entry cap, FIFO eviction sized from a written
  `x-mp-cached-bytes` header (recency would mean rewriting a multi-megabyte
  entry per hit). Every failure — no Cache Storage, a refused open, a full
  quota, a truncated entry — resolves to a miss rather than an error. Only
  `http(s)` URLs are eligible: `blob:` stems are IndexedDB audio already on
  the device whose URLs stop resolving with their lease. Wired into
  `loadOne` in the stem-mixer controller (a hit publishes its byte count so
  the bar reads as finished rather than as never started) and into
  `defaultFetchArrayBuffer` in the guitar backing transport. The URL is the
  whole key with no revalidation — re-author a demo by pointing at a new
  object, never by replacing bytes under a live URL.

- **Home gallery: Piano Night and Guitar Night covers.** Two `page`-target
  destinations between Karaoke and Exercises, on their own `span 6` row so
  the existing 7/5 rhythm is untouched. First photographic covers in the
  gallery; both images are free backdrops already shipped by the rooms
  (`piano-afterglow`, `velvet-rehearsal`), and `home-destinations.test.tsx`
  derives the permitted source set from `BACKGROUND_CATALOG` plus
  `GUITAR_NIGHT_BACKDROPS` rather than restating it. Every page-target cover
  now arms `createPendingAction` on a same-page click and swaps its arrow
  for a `Spinner`.

- **A What's New page, announced once per release LINE.** `shouldAnnounce` is a
  pure `major.minor` comparison against `WHATS_NEW_SEEN_KEY`, so a patch never
  interrupts; a first-ever visitor is recorded as caught up rather than
  announced to, which makes their first announcement the next real release. The
  page is route-backed (`#/whats-new`), so it is deep-linkable, Back closes it,
  and the sidebar entry reopens it after it has been waved away. Content lives
  in `whats-new-content.tsx` and is drawn from this release's changelog.

- **`Spinner`, `BusyLink` and `BusyButton` in `components/shared`.** One
  spinner replaces the `.icon-spin` class, the ad-hoc `Loader2` imports and
  the hand-rolled arcs, and the two wrappers make "this is going to take a
  moment" a property of the control. `BusyLink` arms only for the click that
  actually replaces this document (a modified click or `target="_blank"`
  leaves the page alone, so a spinner armed there would never clear), and
  releases on `pageshow` — a back/forward-cache restore hands back a DOM that
  still has the spinner in it — or after 20 s if the navigation never lands.
  `BusyButton` waits for exactly the promise its handler returns, refuses a
  second press meanwhile, and lets go when the work fails. Applied to Guitar
  Night, Karaoke Night, Piano Night, Voice Mirror and Glass entry points,
  plus Settings' "Replay the intro" (timed to the lazily loaded chunk).

- **`sensitivity-scale.ts`: the room presets become stops on a 0-100 line.**
  `sensitivityConfigAt(position)` interpolates piecewise between Quiet (0),
  Home (50) and Noisy (100), returning each preset's own object untouched
  at its stop — piecewise because `sensitivity` runs 7 -> 5 -> 9 and a
  single end-to-end line would read ~7.7 at Home. `SENSITIVITY_PRESETS`
  moved here so the dependency runs one way (the store imports this at
  runtime; this imports the store types only) and is re-exported from
  `settings-store` for existing callers.
  New `applySensitivityPosition` is the single writer of the position, the
  four thresholds and the preset label; `applySensitivityPreset` routes
  through it. `pitchperfect_sensitivity_position` is seeded from the
  persisted thresholds via `sensitivityPositionForConfig`, so an existing
  Noisy user opens at Noisy rather than having their gate rewritten.
- **`MicSensitivitySlider`** replaces the sidebar's segmented Room control
  and the Settings page's `SafeSelect`, which were separate markup that
  only happened to agree. Live half reads `readSignalQuality()` (the
  advisor's existing detector telemetry) at 500ms and reports
  accepted/(accepted+rejected) over the 10s window, suppressed below 12
  frames.
- **`revealSidebarPanel`** + `data-sidebar-panel` on each rendered panel:
  the signal-quality advisor's toast action now reveals the sidebar mic
  panel (opening the mobile drawer when it is closed) and only falls back
  to `openSettings('singing','sensitivity-presets')` when the panel is not
  on the page.
- **Signal-quality advisor** (owner request, 2026-08-17: an "intelligence
  layer" that notices noise-induced pitch blips): `PitchDetector` gains a
  `telemetry: 'live' | 'off'` option (default off); the practice engine's
  detectors publish per-frame stats (RMS, pre-gate confidence, verdict) to a
  new framework-free seam, `src/lib/signal-quality.ts`, modeled on
  `mic-level.ts` — ten one-second buckets, no per-frame allocation. A pure
  classifier calls a window noisy when short accepted runs (blips), a
  rejected-frame RMS floor crowding the gate, and barely-clearing clarity
  line up — speech and silence stay below the bar by construction. One
  app-level advisor (`signal-quality-advisor.ts`, started in EngineContext)
  fires at most one action toast per 10 minutes (two per session):
  "Background noise is triggering false notes", deep-linking to the newly
  anchored Sensitivity Presets control (`data-settings-anchor=
"sensitivity-presets"`). It recommends, never switches the preset itself.
  Offline detector loops (transcription, fingerprinting, benchmarks) stay
  off the seam by default. Plan and phase-2 rollout map (jam, tuner,
  karaoke, mirror): `docs/plans/signal-quality-advisor.md`.

### Changed

- **Voice Control settings copy + button** (owner feedback, 2026-08-17):
  SettingsPanel's section description rewritten (no "Hands-free
  transport"; both discovery routes — Shift+V and the spoken "what can I
  say" — kept, which settings-voice-help.test.tsx pins), the action
  button is now `FileText` icon + "Command list", and
  `.settingsActionRow` gained `margin-bottom: 18px` so it no longer welds
  to the Recognition Engine dropdown. New pin: button text/icon and the
  jargon's absence.

- **Stop is one corner icon button at every viewport** (owner report,
  2026-08-17, Tab S9+ landscape ~800px height): `.exercise-btn-stop` is a
  48px round icon-only button (aria-label + title carry the label) anchored
  bottom-right by `.exercise-active-controls`; the labelled centre pill and
  the two duplicate 54px FAB blocks in short-viewport.css /
  mobile-polish.css are gone, and their 76px reserved strip is the base
  64px everywhere. `.warmup-step-instruction` max-width 420 → 640px so the
  breath step wraps to two rows instead of four — the rows plus the rail
  were what scrolled the "Sssss" cue off a 1280x800 tablet. Pinned by
  "the warmup breath step fits the fold" (exercise-tablet-active.spec.ts:
  no overflow at 1280x800, compact square Stop, two-row instruction) and
  the icon-only contract in exercise-shell-timer.test.tsx.

- **Held-note run length and duration grading** (owner call, 2026-08-17):
  `DEFAULT_PREFERENCE.mode` 5 → 10 in timer-preference.ts (persisted
  choices untouched). Long-note's duration term is now
  `voicedSeconds(history) / (activeTimerSeconds() ?? difficulty target)`
  — `voicedSeconds` (exercise-scoring-utils.ts) sums inter-sample gaps
  ≤ 0.25 s, so pre-onset settling and mid-run silence cost coverage only;
  pitch-quality terms never saw silence (history records voiced frames
  only). Pitch-hold's term uses its post-phonation frame counter
  (`totalFrames / SCORE_UPDATE_HZ`) against the same goal, keeping its
  documented leading-silence forgiveness. A perfect timed run now scores
  100 (was capped ~90 long-note / ~63 pitch-hold). Pinned in
  exercise-long-note.test.ts, exercise-pitch-hold.test.ts,
  timer-preference.test.ts; mutation-checked both ways.

- **Rep-run flow: the shell and ribbon close the multi-rep gap.**
  `ExerciseShell` derives `repRun` from `useDailyRoutine` (current segment
  runs this drill, banked > 0, banked < reps) to relabel the dual-purpose
  button and compact the result card (no `RunTraceCanvas`, no `tier-pop`
  re-animation via `.mid-reps`). `RoutineRibbon` gains `isComplete`/
  `onRunAgain` props and reduces its countdown to a single
  `countdownTarget` memo — segment | 'run' | 'cancel' | null — restarting
  the clock whenever the destination changes, so the interval can never
  fire a stale closure (the prior shape kept a live countdown aimed at a
  target that no longer existed when the last run banked mid-count).

- **Routine segments carry reps, and the session has a five-minute floor.**
  `segment-reps.ts` holds a per-drill table of what one honest run costs
  (30s for held-note drills, 45s for pattern drills, 60s for the long ones),
  derives `reps` from the segment's budget (capped at `MAX_REPS` 6), and makes
  the segment's `durationSec` the reps rather than the guess. `applyReps` then
  tops a session up to `MIN_SESSION_SEC` (300s, the streak's own daily goal),
  always adding to the shortest drill, and only pushes a single drill past the
  comfortable cap to `MAX_REPS_FLOOR` (8) when a focus template has nowhere
  else to put the minutes. Both build paths use it — `buildDailySession` and
  `materializeRoutine` — so generated days, library templates and every length
  clear the floor. `autoAdvanceRoutineSegment` banks runs in
  `PersistedRoutine.segmentRuns` and ticks the segment off only when it has
  what it asked for; `completeSegment` clears the count. `reps` is optional and
  absent reads as one, so a routine persisted or shared before this keeps the
  finish line it started with. The Home card shows "5 x" per drill and "2 of 5"
  for the one in progress; the exercise ribbon shows "Run 2 of 5", which is
  also what stops auto-continue offering the next segment mid-reps.
- **The warmup honors its authored count-in, audibly.** Every warmup block
  always carried `countInBeats: 2` and no runtime read it — steps began the
  frame the previous one ended. `warmup-lead-in.ts` adds `applyLeadIn` (the
  challenge-stage pattern: targets shifted late, loop extended, count-in
  consumed so it cannot double) applied at the session seam, and a pure
  `createLeadInTicker` the component samples per pitch frame to click each
  lead-in beat once — plus the first note's reference tone at beat zero.
  Guide tones during the run come from `createZenNoteScheduler` wired
  through the app AudioEngine (deliberately NOT ZenPitchStage's private
  AudioContext, which connects to the bare destination and closes mid-tone),
  behind a persisted mute (`pitchperfect_warmup_guide_muted`). Steps are
  separated by `WARMUP_STEP_GAP_SECONDS` with a "next:" phase line;
  `melodyTargets` takes an explicit quarter-beat rest instead of the
  implicit 18% duty; the nine-note scales grew to twelve beats; and
  `warmupTotalSeconds` prices lead-ins and gaps instead of the 0.45 s/note
  reference-tone fiction deleted in 7a4821dc.

- **The Lab became a route-backed focused workspace.** The app shell maps five
  hidden Lab routes to task-led tools, removes unrelated app navigation only
  while one of those routes is active, and keeps supporter access fail-closed.
  The desktop tablist uses roving focus with Arrow/Home/End navigation; compact
  layouts use a tool picker. Each tool has its own error boundary, and inactive
  tools unmount so their audio, microphone, timers and global handlers clean up.

- **All five Lab tools now share one responsive instrument vocabulary.** A
  Lab-local palette derives every surface and accent from app theme tokens.
  Workbench, detector, benchmark, transcription and mapping layouts now expose
  one clear primary task, progressive detail, meaningful empty/error states and
  short-height/tablet rules. The four previously unstyled workbench controls
  moved from inline literals to scoped CSS modules. Pane and waveform splitters
  gained real pointer coverage plus keyboard/ARIA semantics.

### Fixed

- **The backing transport publishes `getLoadProgress()`.** `defaultFetch-
ArrayBuffer` reads the body through `body.getReader()` instead of
  `arrayBuffer()`, so a slow link has something to show for itself before the
  last byte; a response with no streaming body falls back to the whole-buffer
  read. Progress is throttled to whole percents — a chunked read fires
  hundreds of times per stem and every emit re-renders the deck — and cleared
  by `setStatus` on any exit from `loading`, so a later spinner cannot inherit
  the last download's number. `totalBytes` is 0 when the server declared no
  `content-length`, and the room turns an indeterminate ring for that rather
  than inventing a percentage.

- **`preview-player` asks for CORS on a cross-origin source.** Every preview
  is routed through a `MediaElementAudioSourceNode`, and a cross-origin
  element without `crossOrigin` is tainted — which feeds that node silence.
  The seeded example rows' `outputs` ARE the R2 URLs. Same-origin and `blob:`
  sources are left alone deliberately: the attribute buys nothing there, and a
  host that sends no `Access-Control-Allow-Origin` would go from silence to a
  failed load.

- **`UvrSessionActions` collapses a one-row menu into a button.** On a
  cloud-separated session `canDownloadOriginal()` and `canRerunHq()` are both
  false, leaving `export-zip` alone behind a `...`. `soleItem()` renders the
  row directly, keeping `data-testid="session-more"` and dropping
  `aria-haspopup`; two or more rows keep `OverflowMenu`.

- **The Karaoke panel header and `.rv-header` stop stacking under their
  breakpoints.** `.panel-header` stays `flex-direction: row` at 600px with the
  title on `min-width: 0`, and a 380px block drops the three controls' labels.
  `.rv-header` does the same at 720px. The results heading is now
  `.section-header-results`: a `.section-back-btn` chevron, the filename pill,
  and a `.section-header-suffix`, left-anchored, replacing the right-aligned
  `.back-btn` whose `ImportFile` glyph read as a download.

- **`composeGuitarNightSongPorts` dedupes the shelf and falls through on any
  device failure.** Karaoke Night's examples seeder writes every demo into
  the session store as an ordinary "Examples" row, under the same id
  `demoSessionId()` gives the demo port — carrying the R2 URLs and no local
  stem blobs. So the composed library listed each demo twice, and neither
  copy opened: the UVR port found the record, read an empty stem manifest
  and answered `missing-local-audio`, which the composition treated as the
  device's answer to keep. `completedSongs()` now drops a device row the
  demo also claims, and `openSession` retries the demo on anything but
  `ok`/`aborted`, keeping the device's own failure code when the demo has
  never heard of the song. The device still wins outright when it can
  deliver — a band-split example has real local part stems for that id.

- **The stem results view has three places to give on a phone.** Measured
  against the built app at 390px and 320px (`karaoke-results-mobile.spec.ts`):
  `.section-header h4` had no `min-width: 0`, so the flex row's floor was the
  filename pill's min-content width and `.back-btn` (`flex-shrink: 0`) was
  pushed past the viewport — a seeded example's name does it every time. The
  pill needed its own `min-width: 0` before `text-overflow: ellipsis` could
  do anything. `.rv-stem-card-top`/`.rv-stem-info` got the same, so a stem
  name ellipsizes instead of shoving the actions out. Under the viewer's
  existing 720px breakpoint `.rv-stem-btn-label` is `display: none` and each
  action becomes a centred 2.5rem square at `gap: 0.5rem`; the labels move
  to `aria-label` on the Play and Download buttons, and Replace keeps its
  `title`. `.rv-parts-header` wraps, which is what hung off 320px last.

- **`platform.keepAwake` is reference counted and re-taken on
  `visibilitychange`; `loadStems` holds it.** One screen lock per page meant
  whichever holder finished first released the other's — a Drive backup and a
  stem download overlap in exactly that way. The platform also revokes a
  screen lock the instant the page is hidden and never returns it, which is
  the case the lock exists for: a phone that locks mid-download comes back to
  a torn-down fetch and `loadedCount === 0`. `enable()`/`disable()` now count
  holders, an in-flight grant that outlives its last holder is released, and
  an unmatched `disable()` cannot take the count negative.

- **A load nobody is waiting on stays quiet.** Leaving mid-download is a
  normal thing to do now that the phone's overlay has a Go back button, and
  the fetch already on the wire still lands — by which time StemMixer's
  cleanup has closed the audio context, so the decode throws, `loadedCount`
  is 0 and the visitor got a warning toast about a song they had walked away
  from, on a page with no mixer on it. `loadStems` checks a disposed flag
  before setting the error or notifying, on both its failure paths.

- **KaraokeMobileStage load and error overlays have actions.** The phone zen
  stage is the whole product — the mixer's card is not behind it — so a
  failed load was a message with no retry and a back chevron buried under
  the overlay's `backdrop-filter`. The error state now carries Try again
  (wired to `loadStems`, the same call the desktop card's Retry makes) and
  Go back; the running download carries Go back. `.stateOverlay` stays
  `pointer-events: none` and the actions opt back in individually, so the
  veil never swallows a tap meant for the stage. The load overlay is also
  gated on `loadError() === ''`: `loadStems` sets the error and clears
  `loading` only in its `finally`, so both were true at once and the phone
  stacked two blurred veils.

- **Streamed backing stems set `crossOrigin` before `src`.** A cross-origin
  element that does not is tainted, and a tainted element feeds a
  `MediaElementAudioSourceNode` silence. No effect on `blob:` or same-origin
  sources; required for the remote demo song's streamed path.

- **Two gutters that resolved to zero.** The phone drawer named
  `padding-left` inside its media block, replacing the base rule's
  `padding: 14px` shorthand outright and leaving `env(safe-area-inset-left)`
  — 0 in portrait — as the whole gutter. The warmup guide toggle is
  absolutely positioned, and `right` on an absolutely positioned child
  resolves against the containing block's PADDING box, so `right: 0` looked
  through the caption row's 12px gutter to the screen edge.
  `mobile-edge-gutters.test.ts` reads both off the stylesheets and asserts
  the pill's offset equals the row's gutter rather than pinning either
  number.

- **Settings tour target: `#preset-select` -> `[data-tour="settings.room-slider"]`.**
  The environment `<select>` became `MicSensitivitySlider`; the walkthrough
  step, its copy, the `walkthrough.ts` tutorial step and three
  `settings.spec.ts` e2e tests all still named the dead id. The e2e ones are
  outside the smoke set, so only the release-time tour walk caught it. New
  `tour-selectors-exist.test.ts` asserts every hook named by
  `WALKTHROUGH_STEPS`, `PAGE_TOURS`, `STEM_MIXER_TOUR_STEPS` and
  `PRACTICE_MODES_TOUR_STEPS` is written somewhere outside the definition
  files; template-built hooks are allowlisted by name.

- **Walkthrough progress readout: unconditional, and ahead of the marks.**
  Dropped `COUNT_FROM = 9`, moved `.walkthroughDotCount` in front of
  `.walkthroughDots`, marked it `aria-hidden` and moved the long form onto
  the marks group's `aria-label` ("Tour steps: step N of M"). The mark
  budget in `walkthrough-progress.test.ts` already reserved the readout's
  width unconditionally, so it is unchanged.

- **Guitar Night streamed playback: the drift servo could never converge.**
  A phone's 192 MiB decode budget puts any full-length song on media elements,
  and `guitar-backing-stream` corrected any stem more than 60 ms from the
  master by assigning `currentTime`. Setting `currentTime` on a PLAYING
  element stalls its output while the pipeline re-primes, so the correction
  landed the stem the seek latency behind where it aimed — more than the
  tolerance — and the next 400 ms tick corrected it again, forever, each one
  an audible hole. Small drift is now closed with a `playbackRate` trim
  (±4% full scale, released back to the base rate inside the tolerance);
  a seek is kept for genuine interruptions past 750 ms.
- **Guitar Night: a seek re-primes the stems instead of seeking them live.**
  `transport.seek` dipped the stems bus for 15 ms and reopened it 18 ms later
  while the elements were still seeking, then let the servo pile corrections
  on clocks that had not settled — the reported "stutters when I seek, then
  works once it loads". A playing streamed seek now runs the same
  pause-seek-play sequence that starts playback, awaits it, and reopens the
  bus anchored at the moment the stems are actually running. Scrubber drags
  are coalesced so one re-prime runs at a time and lands on the last position
  asked for, the playhead follows the finger rather than the stalled element,
  and a pause pressed mid-re-prime outranks the seek already in the air.
- **Guitar Night: an interrupted stem stops the room.** Each stem is its own
  media element and so its own OS media session; iOS's Now Playing control
  paused the one it attached to and left the others playing under a transport
  that still reported `playing`. `onInterrupted` parks the room at the
  stopped stem's position.
- **Guitar Night: the stems bus reopened by interpolating from a past event.**
  `linearRampToValueAtTime` chained onto a dip that had already finished, so
  after a re-prime the gain stepped straight to near-open instead of ramping.
  Anchored at the current time.
- **Guitar Night touch targets on the transport sliders.** The row reserved a
  full touch target of height, but the thumb — the part that answers a drag —
  was 16px on a 3px rail. Coarse pointers get a 1.5rem thumb on an 8px rail.

- **The octave chrome sat on the keys and stayed there.** On a phone keybed the
  range label and the two octave arrows have nowhere to go but on top of the
  outermost white keys, so they have to be quiet about it. The label names the
  two octaves on screen, which is only news when it changes: it shows itself on
  a window change (and when an arrow takes keyboard focus) and fades back out
  after 1.8s. The arrows keep their full 44px target as transparent padding and
  paint a 32px disc inside it at 62% opacity, going full on press or focus.

- **The count-in number rendered off the top of the screen.** `TransportBar`
  set no `position`, so the count badge — authored as
  `position: absolute; top: -10px; left: 50%` against that row — resolved
  against a positioned ancestor near the top of the page and painted half
  above the app header, clipped. `position: relative` on `.bar` gives it the
  containing block it was written for. Same badge, same bug, on both the
  Singing and Piano mobile stages.
- **Piano Night's phone rail carried no state and had no exit.** The bottom
  rail buttons opened their surface and nothing else: a second press reopened
  the same panel instead of closing it, and nothing on the rail showed which
  surface was open — on a phone that rail is the only chrome on screen, so
  there was nothing else to press. `openSettings`/`openMusic`/`openCoach`
  became toggles, `aria-expanded` on Settings stopped claiming the drawer while
  the Music panel owned it, and both rails draw a marker for the pressed
  button. The exit link to the Piano workspace existed only on the side rail,
  which a phone never renders, so Piano Night had no way back to the studio at
  all; the phone rail carries its own copy now (five columns). On a wide screen
  the coach is always visible and has no hidden state, so its rail button
  looked dead — it now moves focus to the coach and marks it for a moment.
- **Guitar Night could not tell anyone it was struggling, and repainted
  without a budget.** Four findings from a playback audit, after a report of
  stuttering on an iPhone 13 Pro.
  `recordAnimationFrame` — the sampler that demotes a device which only looks
  capable, and the only thing that unlocks `performance-mode.css` — was fed
  from nowhere in this room. It is fed from the transport clock now, which is
  the room's one continuous animation frame while a song plays; a loop that
  runs sporadically would report its own idle gaps as missed frames.
  `GuitarTab3DView` repainted once per invalidation, which during playback is
  every display frame, with a full-canvas gradient, `lighter` compositing and a
  `shadowBlur` per near note and no cap at all. `requestPaint` now runs through
  `createAdaptiveFrameRateLimiter(presentationFps)`, so it follows the live
  tier and a mid-song demotion takes effect without rebuilding anything; a
  skipped frame re-requests rather than dropping the paint it owed.
  `Canvas2dTabRenderer` built two `CanvasGradient`s per frame — one spanning
  the whole canvas — for fills that almost never change; both are cached and
  invalidated on resize (and, for the runway, on the camera ends it is drawn
  between).
  `getTrackStates` copied every track on every call, so the room's `<For>`
  destroyed and rebuilt the whole channel strip on each transport event —
  including every `input` of a seek or volume drag, which is where new DOM is
  most visible as jank. Copies are still handed out; a track that did not
  change hands out the same copy.

- **Piano Night's falling notes were measured against a different keyboard
  than the one on screen.** `PianoKeyHorizon` lays keys out by WHITE-KEY index
  and narrows to a two-octave touch window on a phone; `PianoNightStageViews`
  mapped MIDI linearly across all 88 keys (`(midi - 21) / 87`) and read no
  window at all. On a desktop the two agreed to within half a percent. On a
  phone the keybed showed fifteen white keys across the full width while notes
  were still divided by 87 semitones — measured at 390px, a note drifted
  **103px** from its key — and the octave arrows moved the keys while every
  note stayed exactly where it was. New `piano-key-window.ts` owns the window
  as a value and `keyCenterPercent` as the one geometry both sides read;
  `createPianoKeyWindowController` owns it once, in `PianoNightApp`. Notes the
  window cannot reach are pinned to the edge they fell off and marked
  `data-off-window`, so they read as "there is music that way" instead of
  pointing at a key that is not theirs. **The arrows change only which keys
  are on screen — they never transposed anything, and still do not.**

- **Room artwork was clipped by one element and painted by another.**
  `.artwork` in `PremiumBackgroundPicker` sets `overflow: hidden` but is only
  `position: relative` with `z-index: auto`, which does NOT create a stacking
  context. Its `z-index: 2` image resolved into the nearest ancestor that does
  — Piano Night's settings drawer, `transform`ed and `z-index: 90`. On iOS,
  scrolling the drawer let the images slide out of their cards and float over
  the panel while the card copy, which clips itself, stayed put.
  `isolation: isolate` puts the image back inside the box that clips it. The
  e2e walks each image up to its real paint root, which resolved to
  `drawer drawerOpen` before this.
- **Guitar Night's phone chrome cost the fretboard its height.** Six layout
  findings from an iPhone 13 Pro, portrait and landscape. The voice pill was
  the floating `VoiceControlHud`, which clears `--tabbar-total` for a tab bar
  Guitar Night does not have and so landed on "Start count-in"; it takes a
  `placement="docked"` variant now and lives in the header rail, with its
  engine menu opening downward instead of up. The Camera picker is a child of
  `.stageHeader`, which is `position: absolute` with a `z-index` — a stacking
  context — so the popup's own `z-index` only ordered it WITHIN that context
  and it painted under the LEARN card while overflowing the header's top
  corner. Narrow viewports get `Sheet` instead, which portals to
  `document.body` and cannot be trapped by an ancestor at all; the in-place
  `<details>` stays wherever there is room for it. `.channelStrip` cards put
  the stem name on its own line above the icon and state, because "Backing"
  alone overflowed a one-line card. `GuitarNightLoopControls` drops the
  decorative repeat icon and the caption that repeated the heading above it,
  and joins A and B into one segmented control; the icon reappears only when
  it has a real span to label. The backing transport's speed and volume both
  take `minmax(0, 1fr)` — speed was sized by content and ran 132px wider than
  volume at 390px, measured. Landscape phones are 844x390: wide enough to
  escape every `max-width` rule, which is why the wordmark, "Guitar Night" and
  the room name still took a second header row there.
- **The take cue was a banner with no dismiss.** `GuitarNightDoctorCue`
  rendered a full-width card over the stage — "the jam doctor thing that
  cannot really be closed". On a phone, and in landscape, it is now the icon
  alone; the button's `aria-label` still carries the whole sentence, and it
  opens the same dialog.

- **`vite:preloadError` prevention turned a deploy into a `TypeError`.**
  `installChunkLoadRecovery` called `event.preventDefault()`. Vite's
  helper is `baseModule().catch(handlePreloadError)` and rethrows only
  `if (!e.defaultPrevented)`, so preventing it RESOLVED the import with
  `undefined`. `location.reload()` does not halt JS, so in the ~100ms
  before navigation committed, the `lazy(() => import(x).then((m) =>
({ default: m.Thing })))` shape used by all 39 lazy routes
  dereferenced that `undefined` and threw `TypeError: Cannot read
properties of undefined`. `isStaleBuildError` does not match a
  TypeError, so `TabErrorBoundary` rendered `CrashModal` instead of
  `StaleBuildRecovery` — the tablet/Progress report of 2026-08-17,
  crash modal first and auto-update second. PR #583 fixed the adjacent
  cooldown branch; this is the branch that still fired.
  The handler's own reload also moves from `location.reload()` to
  `reloadToLatest()`: a plain reload is answered by the controlling
  worker from the precache of the build whose chunks are gone.
  Pinned by a test that transcribes Vite's helper and asserts the value
  the boundary ends up classifying.
- **Settings sub-tab strip never scrolled the active tab into view.** The
  strip is `overflow-x: auto` and deep links (`#/settings/credits` from the
  header heart) set the section without moving it, so the selected tab sat
  off screen on a phone. Same `createEffect` + `scrollIntoView({ inline:
'center' })` shape `AppNavTabs` already uses for the main tab bar.
- **`sessionRecords` write for multi-item sessions rejected by the worker.**
  `practice-session-store.endPracticeSession` banked one `PracticeResult`
  per item-_repeat_ but set `notesTotal` from `session.items.length`, so
  every built-in template posted `notesHit > notesTotal` (warmup-2min: 24
  against 5). `validateWrite` rejects that, the create returned 400, and
  `saveSessionRecord` swallows a failed create by design (evidence before
  credit) — so the record, practice minutes, streak and badge pass were all
  silently skipped. The denominator now counts repeats and skips rests, and
  the payload moved into an exported `practiceSessionPayload` builder held
  against the production validator, mirroring `exercise-record-payload`
  (CLAUDE-JOURNEY-007), which had pinned only the plain-drill half.
- **Exercise chrome at 390px: header wrap, Start size, staff overflow.**
  (a) `mobile-polish.css` gave `flex: 1 1 0; min-width: 0` to
  `.exercise-title`, which stopped being the flex child when ec9b3f67
  wrapped the `h2` in `.exercise-header-title` to hang an icon beside
  it. With no `flex` of its own the wrapper claimed max-content width,
  and flex line-breaking uses the hypothetical size, so a long name
  pushed `.exercise-header-right` to a second row. Rule moved to the
  wrapper and the row is `flex-wrap: nowrap`.
  (b) `.exercise-idle-start` carried `padding-bottom: calc(13px +
var(--safe-bottom))` — a gap _under_ the button paid inside its own
  box, so on a notched phone the label sat 13px from the top and 47px
  from the bottom. Now `margin-bottom`, plus a 260px `max-width` so it
  no longer inherits the launch column's full 340px.
  (c) `.sight-singing-staff` is an SVG whose width/height attributes
  equal its viewBox, pinning it to 180px tall and overflowing the run
  column; a CSS `height: clamp(88px, 16vh, 132px)` with `width: auto`
  and `min-width: 0` scales the drawing uniformly. The viewBox is left
  uncropped on purpose — content reaches y=167 of 180 (a note a
  seventh below the staff plus ledger lines), so cropping would clip
  exactly the low notes involved.
  Pinned by `src/e2e/exercise-mobile-chrome.spec.ts`, which measures
  geometry rather than asserting classes.
- **The walkthrough e2e spec was clicking the wrong button** (`walkthrough.spec.ts`):
  Learn and What's new moved from the sidebar to Home's header, but the spec
  still clicked the first `.walkthroughControlBtn` — which after the move is
  the **Guide** button — and then waited for a selection overlay nobody had
  opened. Six of its seven tests failed on every push to `main` from
  `46ed37c4` onward. It went unnoticed because PR branches run
  `test:e2e --grep @smoke` while the full suite runs only on pushes to main,
  so the red gate was never in front of a PR. The spec now drives
  `data-testid="home-learn"`, and a new case pins that the sidebar button is
  Guide and does NOT open the walkthrough — the distinction that was missed.

- **The bottom octave carries** (`audio-engine.ts`, owner report 2026-08-17:
  "D2 up to E2 ... really low notes, and barely hearable"): the default voice
  is a bare sine, so at 73 Hz all of its energy sits below what a laptop or
  phone speaker can move, and equal-loudness alone would want ~15 dB more
  there than at 440 Hz — far more than the bus has. Two knobs now fade in
  together below C3 and reach full value at B1: the envelope peak lifts by up
  to 1.3x, and an octave-up sine partial (up to 0.5 relative) joins the voice
  under the same envelope. The octave is the half that reaches the speaker;
  the ear reconstructs the fundamental's pitch from it, so the note reads
  louder rather than higher. Both are exactly 1 and 0 at C3 upward, so
  nothing above the bottom two octaves changes, and the release tail still
  lands under -40 dBFS by the time the source stops. Applies to the default
  sine voice only — piano, organ, strings and synth already have partials.
- **The warmup's run view spends one row where it spent two**
  (`WarmupExercise.tsx`, `exercises.css`): the approach-run announcement
  ("Nice — next: Humming") travelled in the shell's `activePhase` slot at the
  very top of the runner, and the guide-sound toggle was stacked as a fourth
  child of the step column — roughly 70px of a landscape tablet's height for
  two short lines, and the announcement appearing between steps shoved the
  canvas down as it came and went. Both now live in one `.warmup-caption-row`
  immediately above the canvas: the announcement centred, the toggle absolutely
  parked in the right corner, and a `min-height` so the row does not collapse
  when the announcement is absent. Under 760px the toggle keeps its icon and
  accessible name and drops its visible label. Warmup no longer passes
  `activePhase` at all. `warmup-caption-row.test.tsx` pins the arrangement
  (sibling order, toggle's container, no shell phase row); the 1280x800 fold
  e2e gained the same assertions, and the reachability e2e now accepts either
  announcement shape.
- **An expired Google sign-in state comes home instead of rendering JSON**
  (`workers/db-worker/src/auth.ts`, `auth-service.ts`; owner report
  2026-08-17): the OAuth state is a signed value with a ten-minute life, so
  leaving the consent screen open and finishing it later arrives at the
  callback with a state nothing can verify. That was the ONE failure in the
  handler that answered with a body — `{"error":"Invalid or expired state"}`
  rendered as a page on the API origin, with no way back — because the state
  is what carries the return address. It now redirects to the environment's
  own app origin with `#gauth_error=expired_state`, the shape
  `handleVerifyEmail` has always used for the identical problem, and the app
  maps that code to "that sign-in link expired. Please try signing in again."
  Unrecognised codes still pass through verbatim. Fixed alongside: `verifyState`
  decoded the signature outside its try, so a mangled `state` threw past the
  400 into the 500 handler (BUGS.md:917).

- **Detector reconstruction keeps the runtime config** (`practice-engine.ts`):
  both places that rebuild the `PitchDetector` — `startMic()` when the real
  AudioContext sample rate or buffer size differs from the assumed one
  (Android's 48 kHz contexts), and `syncSettings()` on a buffer-size change —
  passed only a subset of options, so `minConfidence`, `minAmplitude` and (in
  the mic path) `algorithm` reverted to `DEFAULT_OPTIONS`. On affected devices
  the user's mic-environment preset (Quiet/Home/Noisy) was silently discarded
  on every mic start, and nothing re-applied it until the next settings
  change. Both sites now carry the previous detector's algorithm and gates
  over; `practice-engine.test.ts` pins both paths.

- **Frequency-aware envelope floors in audio-engine** (owner report,
  2026-08-17: "bassey sort of pop" on dial notes in octaves 2-3): the
  75 ms stopNote release (tau 15 ms) and the sustain envelope's 15 ms
  attack / 50 ms release have sub-period taus below ~C3 (period 15.3 ms
  at C2), moving gain ~63% inside one cycle. New
  `MIN_ENVELOPE_CYCLES = 2` + `releaseSecondsFor(frequency, base)`:
  stopNote (via `ActiveVoice.frequency`) and `_scheduleSustainEnvelope`
  (all four instrument call sites pass `frequency`) stretch attack and
  release to at least two periods of the fundamental; 440 Hz keeps the
  house constants. Also fixes the teardown-before-stop step: the
  disconnect timer fired at release+25 ms while sources stopped at
  release+60 ms slack — a -70 dBFS hard step, now scheduled after the
  stop. Pinned by the "low notes get whole-cycle envelopes" describe
  (6 tests incl. fake-timer teardown ordering and the 440 Hz guard).
- **Jam lyric sweep survives touch** (owner report, 2026-08-17):
  JamSongLyrics grew its range only via per-row `pointerenter`, but a
  touch pointer is implicitly captured by its first row so enter never
  fires elsewhere — the range pinned to line one; with no `touch-action`
  the UA reclaimed the drag as a pan and the unhandled `pointercancel`
  left the anchor wedged. Now: `sweepToPoint` on `pointermove` hit-tests
  `document.elementFromPoint(...).closest('[data-line]')` (Piano Night
  glissando pattern), `.painting` sets `touch-action: none` (armed rows
  only — scrolling is untouched otherwise), and a document
  `pointercancel` abandons the sweep without committing. Pinned by
  jam-lyrics-touch-sweep.test.tsx (capture-retargeted move grows the
  range; cancel wedges nothing; CSS rule).
- **TabErrorBoundary recognises stale-build errors** (owner repro,
  2026-08-17: crash modal on Progress,
  `Failed to fetch dynamically imported module: .../ProgressRoute-*.js`):
  every tab renders inside TabErrorBoundary, so a lazy route rejecting
  after a deploy hit it BEFORE AppErrorBoundary's `isStaleBuildError`
  branch (38c6d2bb) and fell into the crash modal. The tab boundary now
  makes the same check and renders `StaleBuildRecovery` (auto
  `reloadToLatest`, cooldown-guarded). Pinned by
  tab-error-boundary-stale.test.tsx (stale -> recovery + auto reload;
  ordinary crash -> crash modal untouched).
- **CrashModal "Reset App Data" is a hard reset**: it cleared storage but
  left the service worker registered and its precache intact, so the
  follow-up `location.reload()` was answered from the crashing build's
  own cache. New `hardResetAppData` (CrashModal.tsx, injectable seams)
  also deletes every Cache Storage entry and unregisters all service
  workers before reloading; teardown failure still reloads. Pinned in
  CrashModal.test.tsx.
- **Google sign-in buttons show pending state** (owner report,
  2026-08-17, slow connection): `startGoogleSignIn` FETCHES the consent
  URL (device secret rides in a POST body), and that round trip gave no
  feedback. `google-sign-in.ts` now exports a shared
  `googleSignInPending` signal — set before the fetch, kept true after a
  successful start (the page is unloading; re-enabling invites a double
  redirect), cleared on failure; a second call while pending is a no-op.
  All three surfaces (AuthModal, AccountSection, KaraokeAccount) disable
  their button and swap the label to "Opening Google…".
  google-sign-in.test.ts pins the signal lifecycle, the double-click
  swallow, and the three wirings.
- **Home data keys on authVersion** (owner report, 2026-08-17): the
  streak resource and `createDailyGoalProgress` were keyed on
  `sessionRecordVersion` only, and the `syncedWeek` resource had NO
  reactive source (one fetch per mount) — sign-out changed the owner
  behind `mp_practice_ms_<owner>_<day>` and the records API without any
  of them re-running. Streak and week resources now source
  `() => [sessionRecordVersion(), authVersion()]`; the goal memo
  subscribes to `authVersion()` too. Pinned in home-daily-goal.test.ts
  (owner-swap memo case + both wiring regexes).

- **Streak repair window bounds the break, not its detection** (owner
  repro, 2026-08-17): `advanceStreakFrom`'s reset branch stamped
  `streakResetDate = today` and snapshotted `previousStreak`
  unconditionally, so `hasRecordedReset`'s 72h check
  (`daysBetween(streakResetDate, today)`) always measured 0 on the
  detection day — a 63-day-old break (one practice 2026-06-14, next
  2026-08-17) offered "restore streak" and manufactured a streak of 2.
  The reset now snapshots only when `missedDays <= REPAIR_WINDOW_DAYS &&
currentStreak >= 2` (parity with `hasPendingBreak`), and
  `hasRecordedReset` requires `previousStreak >= 2` against legacy rows.
  Pinned by the "repair window bounds the break" describe in
  streak-service.test.ts, including the owner's exact row.
- **AdminContentStudio owns a Suspense boundary for its section body**
  (owner report, 2026-08-17): AdminWeeklyPage is the only section that
  reads a resource during render (`rows` -> `listAllWeekly`), and the
  nearest boundary above it was App.tsx's fallback-less Suspense around
  the whole lazy studio — Solid detached the entire overlay (the visible
  "panel closes and reopens") until `/api/weekly/all` resolved. The
  studio now wraps its section `<Switch>` in
  `<Suspense fallback={sectionLoading spinner}>`, so the chrome stays and
  only the workspace shows the wait. Pinned by
  admin-studio-weekly-suspense.test.tsx (outer boundary never triggers,
  chrome heading stays, `role="status"` announces the load, resolves
  clean).
- **Auth surfaces wait for the first session resolution** (owner report,
  2026-08-17): `me` is null both mid-restore and when truly signed out, so
  AccountSection's `<Match when={true}>` fallback and HeaderAccount's
  `isUpgraded()` fallback asserted "signed out"/"Sign in" during the
  restore round-trip. Both components now hold an `authResolved` signal
  set in a `finally` after `restoreAuth()+fetchMe()`, rendering a
  `role="status"` probe spinner (AccountSection) / neutral probe pill
  (HeaderAccount, `data-testid="header-auth-probe"`) until then. Failed
  fetches still resolve to the signed-out card rather than spinning.
  Pinned by auth-state-probe.test.tsx (4 cases: probe-then-signed-in,
  probe-then-signed-out, both components).

- **HomePage's daily-goal readout was non-reactive**: `getTodayScoredMinutes`
  read once per mount and the streak `createResource` had no dependency on
  `sessionRecordVersion`, so nothing moved until a tab switch remounted the
  page. The readout is now `createDailyGoalProgress()`
  (src/features/home/daily-goal.ts), a memo keyed on the version signal the
  services bump per persisted run, and the streak resource refetches on the
  same key — mirroring what ProgressRoute already did. Pinned by
  home-daily-goal.test.ts (reactivity both ways plus HomePage wiring).

- **Plain-exercise session writes sent `comparabilityKey` without
  `sourceVersion`**, tripping the worker's evidence rule ("comparabilityKey
  requires sourceRef and sourceVersion"): `repo.create` came back 400,
  `saveSessionRecord` swallowed it by design and returned null, and
  `addScoredMs`, `updatePracticeStreak` and `checkAndGrantBadges` never ran
  — signed-in drills credited nothing since the Skill-Threads fix landed.
  The payload is now built by an exported `exerciseSessionPayload` stamped
  with `exerciseScoringVersion`, and `exercise-record-payload.test.ts`
  holds that production payload against the worker's own `validateWrite` —
  closing the gap that let this ship green (every prior test mocked
  `saveSessionRecord`).
- **The running exercise view used plain (unsafe) `center` in three places
  a scroller cannot recover from** — `.exercise-active-content` (stacked
  path) and the short-viewport row layout's stage cross-axis and content
  column. Content overflowing a flex container's START edge is unreachable
  by any scrolling; from ~740px of viewport height the warmup's step text
  left the screen (step name gone by 660). All three are now `safe center`,
  the same cure `.is-idle` received earlier. Pinned by four new
  reachability e2e tests (warmup + interval trainer at 1280x740 and
  1280x660) asserting nothing inside `.exercise-active-stage` sits above
  its start edge — the warmup pair failed pre-fix.
- **Onboarding state did not survive the Google OAuth round-trip.** The
  flow's beats are memory-only signals and the welcome flag is written
  only by `finishOnboarding`, so the full-page redirect rebooted into
  `startOnboarding()` at beat one. `armOnboardingResume()` (called by
  AuthModal's Google button, a no-op outside the flow) persists the beat
  in localStorage — sessionStorage is empty when Android lands the
  redirect in the installed PWA — and `startOrResumeOnboarding()`
  consumes it one-shot, resuming only into the map (the one beat that
  rebuilds from persisted data). The auth return-hash stash
  (`mp:gauthReturnHash`) moved to localStorage for the same
  context-switch reason, and `site.webmanifest` gains
  `launch_handler: navigate-existing` so the WebAPK reuses a window
  instead of spawning a second instance.

- **Home's week strip counted only the device-local mirror
  (CLAUDE-JOURNEY-009).** `weekStats` filtered `exerciseHistory()` — the
  localStorage mirror — so a second device signed into the same account
  reported "0 drills this week" while Progress (reading synced
  `sessionRecords`) showed everything. A new pure seam,
  `weekDrillStats(now, local, synced)` in
  `src/features/home/week-drill-stats.ts`, decides the strip's source:
  'exercise'-source session records are the drills (challenge/weekly
  records reference a challengeId and may not be drills), and the larger
  seven-day count wins — synced normally (every local run is also a
  record), local when the record read fails, lags, or is still loading.
  HomePage feeds it `loadSessionRecords(300)` via a resource. Today's
  minutes ring stays device-local by documented design (the streak is
  the cloud value — see practice-minutes.ts). Pinned by
  `src/tests/week-drill-stats.test.ts`: the second-device case, the
  loading/lag fallbacks, the source filter, the window, and a wiring pin
  that HomePage routes through the seam.
- **SyncSettings promised a phantom export/import control
  (CLAUDE-JOURNEY-024).** The "Your library" note ended "...or export a
  song here and import it there", but no export-to-file or
  import-from-file UI exists anywhere — the portable-bundle machinery
  serves the Drive backup and the Karaoke tab's device-to-device send
  only. The sentence now names exactly those two routes. Pinned by
  `src/tests/sync-settings-copy.test.tsx` (fails against the old copy);
  a practice-data export (CLAUDE-JOURNEY-023) remains a separate,
  larger feature decision.

- **The warmup graded pitch accuracy while promising "no grades"
  (CLAUDE-JOURNEY-015).** `exercise-help.ts` and the idle card both
  promise "the score just reflects that you sang along", but
  `WarmupExercise.advanceStep` banked each step's `score.total` — the
  pitch/coverage/steadiness-weighted Zen grade — and stored it under a
  metric literally named `participation`. A new pure seam,
  `warmupStepScore` in `warmup-steps.ts`, banks the run's `coverage`
  instead: the share of target time the singer voiced, whatever the
  pitch (coverage bins count any voiced sample inside a target window —
  accuracy never enters it). Breath steps still bank nothing. Pinned
  twice: `warmup-participation.test.ts` (the pure seam plus the promise
  copy) and `warmup-banks-participation.test.tsx` (the component walked
  through a full pattern via the session's loop-limit callback — live
  score, final result and metrics all speak coverage; both fail with the
  seam flipped back to `total`).
- **Verified fixed and pinned: the toast stack no longer swallows taps
  (CLAUDE-JOURNEY-012).** The finding predates the 7e10ac84..6946bc56
  toast series; on current main the fixed container computes
  `pointer-events: none` (taps inside the stack region fall through to
  the page) while each toast body is `pointer-events: auto` (its dismiss
  and action buttons work). Re-verified live in Chromium at 390x844: a
  tap inside the container box below the last of three stacked toasts
  lands on page content. The contract is now pinned by
  `src/tests/notifications-hit-through.test.ts` so a stylesheet rework
  cannot silently reintroduce the swallow.

- **`LocalProgressNotice` hard-coded a plural verb (CLAUDE-JOURNEY-016).**
  The sentence template ended "...you did here are still on this device"
  regardless of what `describeLocalProgress` produced, so a single
  exercise read "The 1 exercise you did here are". The verb now derives
  from `localProgressTotal(progress()) === 1` — singular exactly when one
  thing was counted; any compound ("1 exercise and 1 practice session")
  or plural count keeps "are". Pinned in
  `local-progress-notice-render.test.tsx` (singular pin fails against the
  unfixed template; a plural pin guards against overcorrection).
- **Settings pointed at a repository path for the voice-command list
  (CLAUDE-JOURNEY-021).** `SettingsPanel`'s Voice Control description
  referenced `docs/VOICE-COMMANDS.md`, unreachable from the app — and
  ignored that the app has a live command center
  (`VoiceCommandsOverlay`, generated from the registry). The copy now
  names the spoken and keyboard routes, and a "Show all voice commands"
  button runs the registered `nav.voiceHelp` command through
  `activeVoiceCommands()` — the same path the spoken phrase takes, so
  the button cannot drift from the voice pipeline. When no command is
  registered (panel rendered outside App), it falls back to a
  notification naming the routes. Pinned by
  `src/tests/settings-voice-help.test.tsx` (all pins fail against the
  unfixed panel).
- **Exports were still named after a former product
  (CLAUDE-JOURNEY-025).** Four user-facing download sites said
  `pitchperfect-`: the Compose editor's MIDI export
  (`useEditorController`), the piano roll's MIDI and WAV export buttons,
  and `downloadMIDI`'s unnamed-file fallback. A shared
  `exportFilename(ext)` helper in `piano-roll.ts` now produces
  `mercurypitch-<sortable local timestamp>.<ext>` and all four sites use
  it (the fallback is `mercurypitch-melody.mid`). Internal storage
  identifiers — `pitchperfect_*` localStorage keys and the
  `pitchperfect-models` IndexedDB — deliberately keep their names:
  renaming them would orphan every existing user's data. Pinned by
  `src/tests/export-filenames.test.ts`, including a source-content sweep
  over both files (the admin-studio workflow-pin idiom) so the literal
  cannot quietly return.

- **`FirstLight` claimed `aria-modal` without trapping focus
  (CLAUDE-JOURNEY-018).** The onboarding overlay renders `role="dialog"
aria-modal="true"` but never took or fenced focus: the first Tab after
  load landed in the obscured app behind the star field. Wired the house
  `useFocusTrap` (`@/lib/use-focus-trap` — the same primitive every other
  modal uses) onto the overlay ref with `isOpen: () => true` and no
  `onClose`, deliberately: Escape must not skip onboarding. Focus moves in
  on mount, Tab/Shift-Tab cycle, and the previously focused element is
  restored on unmount. Pinned by `src/tests/onboarding-focus.test.tsx`
  (both tests fail with the trap removed) and verified in headless
  Chromium: focus lands on the first button at open and stays inside the
  dialog through a full Tab cycle.
- **The Professional accuracy tier installed an unreachable Perfect band
  (CLAUDE-JOURNEY-020).** Every band table is consumed as
  `avgCents <= threshold` on an absolute deviation, so
  `ACCURACY_PRESETS.professional`'s `{ threshold: 0, band: 100 }` admitted
  only an exact 0.0-cent reading — measure zero on a continuous trace — and
  the Accuracy Bands editor's Perfect field (`min="1"`) sat in `:invalid`
  displaying the 0 the preset had just written. Fixed at every seam the 0
  could come from: the preset is now `threshold: 1` (copy updated in
  `TierSelector` and `getAccuracyTierInfo` to "within 1 cent"); `setBand`
  floors at 1 (the panel's `parseInt(value) || 0` smuggled a 0 in on
  field-clear, and non-finite input now lands on the floor instead of
  storing NaN); the persisted-settings signal gained a deserializer that
  heals scoring bands (`band > 0`) below 1 on load, so users who picked
  Professional before the fix are unstuck without re-clicking the tier; and
  `practice-engine`'s `DEFAULT_BANDS` fallback (the table `centsToBand`
  uses when callers pass none, e.g. `NoteList`) had the same 0-threshold
  row, now `CENTS_PERFECT / 2` to match `centsToRating`'s own perfect line.
  Pinned by `src/tests/settings-accuracy-bands.test.tsx` (7 of the pins
  fail against the unfixed code).

- **Four controllers fed `_setTargetPitch` a MIDI number where the contract is
  Hz (CLAUDE-JOURNEY-005).** `use-base-exercise` records every target change
  into the published run trace as a frequency; Sight-Singing passed
  `sequence[idx].midi`, Long Note and Pitch Hold passed their `setTarget`
  midi, and Mirror Melody's `setMelody` passed `baseMidi` (its per-note path
  three lines later correctly converted). MIDI 69 stored as 69 Hz makes
  `worstMoment` measure the singer against ~B1, so the result card reported
  "Furthest off: ~3200 cents sharp of a note that was never a target" and the
  green target line drew octaves below the contour. All four now convert with
  `midiToFrequency`; one Mirror Melody pin that demanded the raw MIDI number
  (the same tests-enforce-the-bug shape as the audio-envelope pins) is
  flipped, a Hz pin now guards each drill, and the seam documents its unit.
- **Plain drill runs persist a `comparabilityKey`, so repeats thread on the
  Progress page (CLAUDE-JOURNEY-007).** `sessionComparisonKey` deliberately
  trusts only an explicitly persisted key, and only the challenge and weekly
  paths ever wrote one — the `source: 'exercise'` branch of
  `recordExerciseResult` saved keyless records, so `comparableSeries` never
  grouped them, `buildSkillThreads` had nothing to build, and every plain row
  was captioned "cannot be compared like for like". A new
  `exerciseComparabilityKey(type)` (`voice:exercise:<type>:v<scoringVersion>`,
  same family as the challenge keys) is now stamped on that branch. The
  scoring-version table starts the interval trainer at v2 — its August
  scoring redesign means old and new scores share no ruler — and every other
  drill at v1. Pinned at three seams: the key shape, the funnel's persisted
  payload (observed failing pre-fix), and a model test threading two
  drill records under the funnel's real key. Pre-existing keyless rows keep
  their honest "older attempt" caption.

- **Vocal-range fitting at the launch choke points.** New
  `fitPhraseToRange` (whole-phrase octave shift, centred among fitting
  octaves, spill-centred when too wide) and `fitScaleBaseNote` (fold the
  base when base+12 exceeds the ceiling; presets' >= 24-semitone span is
  pinned) in `vocal-range.ts`, applied in App's `pendingDrill` effect and
  the deep-link slug path. `generatePhrase` (call-response) now walks
  direction-aware within the preset range; `generateMelody`
  (mirror-melody) clamps to the preset instead of the C2-C6 constant;
  call-response and sight-singing honour `launchTargetNotes` (previously
  exported with zero consumers) so the authored apply-phrase is sung as
  written. `mountExercise` unifies the forced-remount dance so a menu or
  deep-link launch of the already-open drill re-reads its (cleared)
  override instead of reusing the routine's stale note. Known
  inconsistency left alone: `VOICE_MIDI_RANGES` (analyzer) vs
  `VOCAL_RANGES` (settings) still disagree about preset ceilings.
- **Every audible release follows the pop-free envelope doc, and the tests now
  defend it instead of the bug.** The engine's `stopNote` used a 75 ms LINEAR
  ramp to zero (the documented "squeezed pop" shape) and
  `releaseCurrentTone`/`stopTone` hard-stopped the oscillator at 3τ — a −26 dB
  truncation on every tone end — with both shapes PINNED by
  `audio-engine.test.ts`, which is why each earlier fix regressed. A shared
  `_releaseParam` now anchors the held value BEFORE `cancelScheduledValues`,
  releases via `setTargetAtTime(0, now, len/5)`, and stops the source only at
  `len + 60 ms` slack; sustain/piano/staccato envelopes close the same way, and
  `_rampBusLevel` ramps `setVolume`/`setMetronomeVolume`/`setReverbWetness`
  over 15 ms instead of stepping a live bus. The flipped pins plus a new
  envelope-evaluator net ("every scheduled stop lands below audibility") replay
  the recorded automation per the WebAudio spec and fail any truncation above
  −40 dB. Callers fixed through the same discipline: guitar-backing
  pause/stop/seek-past-end close the bus before stopping voices via one shared
  `haltAudible` (seeks keep their masked 15 ms dips) — and `stopVoices` no
  longer disconnects a scheduled-stop source immediately, which had been
  cutting the material at open gain and silently defeating every fade the
  pause path ever had; `synth-annotation-playback` gains a real attack and
  release, the zen guide tones get a gain bus + limiter and the context now
  outlives the release tail, and the stem-mixer fade-out stops sources after
  the tail rather than at it. The NoteDial preview is throttled to one
  retrigger per 80 ms with a trailing timer (the settled-on note always
  sounds), the dial pulses the seat whose preview is ringing (keyed to the
  post-throttle play, `prefers-reduced-motion` aware), and the face's focus
  ring is suppressed for pointer focus (`:focus:not(:focus-visible)`) — it was
  a keyboard affordance leaking into every click. The rule doc is un-orphaned:
  MISTAKES.md and CONVENTIONS.md 5b now carry it, naming the primitives.

- **The local-progress notice is bounded by the sign-in, not by the stores.**
  `exerciseHistory` and `sessionResults` are one device-wide list each with no
  owner on their rows, so a run finished after signing in landed in the list
  the notice counts. `localProgressNoticeDue()` flipped true mid-session and
  the portalled dialog (`position: fixed`, `z-index: 3200`) painted over the
  auto-continue row — at 390x844, over the "Stay here" button its own sentence
  points at. A per-account first-seen stamp
  (`mercurypitch.localProgressNotice.firstSeen.v1`) now divides the history:
  `summarizeLocalProgress(before)` counts rows by `completedAt` and Ascent
  days by date, excluding the seeded `ENDOWED_DAY` that nobody practiced, and
  the component reads `localProgressAtSignIn()`. The stamp is only written for
  an account that differs from the device id, so being signed out never dates
  the line.

- **The phone header's account corner is a touch target, and sign-out
  confirms.** Measured at 390x844: profile 26x24 and sign-out 31x24, edge to
  edge. The mobile block now gives the account and sign-in pills a 44px
  minimum in both axes, hides the header's sign-out (it keeps its full-size
  home in Settings > Account), and the header reserves 96px with the pinned
  block inset 4px — 4 + 44 fits the 50px band with nothing overhanging.
  Re-measured after the change: 46x46 at x 292, bottom at exactly 50.
  `HeaderAccount` now routes sign-out through `ConfirmDialog`.

- **Practice-engine selectors carry ARIA state.** `TierSelector` (3),
  `VocalRangeSelector` (6), the buffer-size pills in `SettingsPanel`, both
  play-mode segments (`SingingControlBar`, `PianoControlBar`) and the karaoke
  `UvrPanel` processing/stems/device pills became `role="radiogroup"` with
  `role="radio"` + `aria-checked`, matching `SegmentedControl`, which already
  did it right. `LoopControls`' A, B and loop toggle report `aria-pressed` —
  they are independent toggles, not a group.
- **Interval Trainer rebuilt on the echo model.** `evaluateRound` scored both
  targets against the average deviation of one shared 3 s window, so a correct
  performance put ~half the samples ~span cents from each target — anything
  over ~67 cents average scored 0, a perfect Major 2nd scored 0, and the
  drill's ceiling as written was 50. Rounds now follow arpeggio-jumper's echo
  shape: a timer-paced listen phase (never `.then` on `playTone`, which
  resolves at schedule time — the old chain flipped the target to note2 within
  a frame), then one difficulty-scaled singing slot per note scored with
  `scoreNoteInRange`. The round's pair rides the tracker's upcoming-target
  ladder (call-response convention), `ExerciseFeedback`'s response-window bar
  is wired up (`matchWindowMs` + per-slot `phaseStartedMs` restamp), the
  header score is the running mean, the random +12 octave shift on note2 is
  gone, `plannedRounds` caps at the pool so the idle hint stops promising 6
  rounds at every difficulty, and the help copy describes the actual drill.
  Result metric names are unchanged (weakness-analyzer reads them).
- **Stale-build crashes now recover instead of looping.** A lazy import
  failing during render lands in Solid's `ErrorBoundary`, not the window
  listeners, so the stale-build filters in `global-error-handler.ts` never ran
  and a routine deploy showed the CrashModal — whose plain `location.reload()`
  the controlling service worker answered from its own precache, reproducing
  the identical crash on every click (seen on dev: adopting a stale waiting
  worker while the origin had moved on). The boundary now routes stale-chunk
  errors to `StaleBuildRecovery`, which reloads once automatically through the
  new `reloadToLatest()`: adopt the waiting worker if one exists, otherwise
  unregister and reload so the shell comes from the origin (kept, cache and
  all, when offline). A session-stamped cooldown stops reload loops; the crash
  modal's Reload uses the same escape; `announce()` stays quiet once an update
  is accepted, killing the second prompt that raced the swap.
- **The Danger Zone reset is staged, scoped, and cannot hang silently.**
  `handleResetStorage` cleared localStorage first, then awaited
  `indexedDB.deleteDatabase` — which waits indefinitely while any connection
  is open. The app holds three of its own (the db singleton, local-database's
  second adapter, and the model cache's raw connection, which unlike Dexie
  never auto-closes on `versionchange`); another tab holds more. New
  `src/lib/reset-app-data.ts` runs scoped step lists (`settings` |
  `database` | `factory`), closes every owned connection before deleting
  (`close()` added down the adapter stack, `closeDatabase`,
  `closeLocalDatabase`, `closeModelCacheDb`), clears storage only after the
  deletes succeed, relays `onblocked` so the UI can name the other-tab cause,
  and — for factory — also clears CacheStorage and unregisters the service
  worker, which the old reset missed entirely. The `settings` scope preserves
  the `mp:*` identity keys so kept database rows stay owned; the confirm box
  becomes a progress view with a blocked hint while it runs. `resetDatabase`
  (destroy + recreate + reseed right before a reload) is gone.
- **Nav tab icons centred in icon-only mode.** A leftover `.app-tab svg
{ margin-right: 6px }` in `vocal-analysis.css` (the "Tab styles" block
  the class was borrowed from) survived the hidden label in
  `tabs-icon-only` mode and pushed the icon 6px left of centre in the
  active pill — and widened the labelled icon-name gap to 11px against the
  authored 5px flex gap. The rule is gone; icon spacing is owned solely by
  `AppNavTabs.module.css`, pinned by `nav-tab-icon-centering.test.ts`.

- **Lab work no longer survives after its tool is left.** The earlier
  keep-visited-panels-mounted approach left spectral capture, raw microphone
  streams, transcription playback/Space handlers and detector benchmarks alive
  behind `hidden`. Lab now mounts only the active tool. Late microphone grants,
  workbench starts, offline analysis, UVR work and algorithm runs have disposal
  guards so an await cannot restart work after unmount.

- **The redesigned Lab's latent interaction failures are covered.** The
  Transcription Bench now guards every canvas measurement and has empty plus
  populated-result render tests. Pitch Detection's waveform grip now updates a
  reactive height instead of querying an unhashed CSS-module class, restores
  document cursor state on cleanup and works by mouse or keyboard. Algorithm
  accuracy/performance styling uses typed semantic bands rather than missing
  utility-class lookups.

- **The Lab access gate's primary button has guaranteed contrast.** The app
  shell does not define Karaoke Night's `--on-accent`; the gate now uses the
  globally available `--bg-primary` against the active accent.

- **A credit pack offered "Buy" to visitors who cannot check out.**
  `startCheckout` needs a real identity — the db-worker 403s an anonymous or
  absent token, deliberately, since a receipt without an account is useless —
  so the click could only end in a "Checkout failed" toast. `PricingPanel` now
  reads `accountHeld()` (synchronous and reactive: it decodes the stored token
  instead of fetching `/me`, so the label is right on the first paint) and
  labels the button "Create account", opening the auth modal on `register`.
  "Soon" and "Unavailable" still outrank it — neither has a checkout to reach.
- **The supporter tiers' account CTA linked to the panel it was already in.**
  `DonatePanel`'s signed-out fallback was an `<a href="#/settings/account">`,
  which from Settings → Credits reads as a click that did nothing and left the
  visitor to find the sign-in button themselves. It is a button now, opening
  the same shared `AuthModal` on its register pane.
- **The PR-preview Worker environment declared none of its bindings.** A named
  Wrangler environment inherits nothing from the top level, so `env.preview`
  had neither `SHARE_STORE` nor `UVR_INPUT_BUCKET` at runtime. Both now
  reference dev's existing store; a preview deploy still provisions no new
  Cloudflare resource. `SHARE_STORE` is the one with a real effect:
  `share-handler.ts` reads it unguarded, so `/api/share/*` 500s without it,
  and because `tryShortenUrl` returns null on any failure the caller quietly
  fell back to the long URL — a share link that was never shortened rather
  than a visible error, which is why nobody noticed. `UVR_INPUT_BUCKET` is the
  one Wrangler warns about, and declaring it is for the warning plus
  future-proofing: server separation cannot run on a preview at all, since the
  `mercurypitch-preview` Worker holds only `JWT_SECRET` and no RunPod
  credentials. `"r2_buckets": []` does not silence the warning — Wrangler
  compares binding names — and `RUNPOD_STEM_PREFIX` is deliberately left out,
  being read only on the RunPod path.

- **The app is served from a precached shell, one build at a time.** The worker
  (`src/sw.ts`, all rules in `src/lib/sw-runtime.ts`) treats
  `self.__WB_MANIFEST` as an allowlist and caches under a per-build name — an
  FNV-1a hash of the shipped URL set — copying unchanged entries forward from
  the previous build so a deploy costs about one request per changed chunk
  rather than the whole set. A navigation is answered from the shell only when
  the cached HTML's `<script src>` set belongs to this build; a request for
  build output the origin no longer serves posts `mercurypitch:stale-build` to
  the page, which turns into an immediate update check. `install()` refuses to
  finish if the shell is not a document or belongs to another build, but
  tolerates storage failure, and every cache touch on the request path is
  best-effort so a rejection degrades to the network instead of the browser's
  network-error page. Nothing calls `skipWaiting()` on its own: the page asks,
  and only an accepted prompt reloads. `isStaleBuildError` in the global error
  handler and `AppErrorBoundary` classify the failed-dynamic-import and
  HTML-parsed-as-JS shapes as "this build is gone" rather than a crash.

- **The stage-glass slider reaches the canvas-painted lane labels.** The lane
  rails (Vocal, Instrumental, the MONITORING badge) are painted into the
  canvas, so CSS cannot fade them; the canvas controller reads
  `--sm-lane-label-bg` on each redraw instead. Only `karaoke-night.css`
  defined it, so the studio — same slider — held a fixed plate. The token
  moved to `.stem-mixer`, which both hosts inherit (the performance preset
  resolves `--sm-stage-alpha` from `--kn-alpha`), and the studio's slider now
  dispatches `karaoke:stage-glass` so the canvases actually repaint.

- **Two walkthrough steps pointed into Compose's closed phone drawer.** When
  the Compose header became one row, the control bar moved inside the "more"
  sheet; `compose.kind` got the `reveal` that opens it and `#record-btn` and
  `compose.share` did not, so both missed on the mobile release walk. Their
  guard reads the selectors out of `ComposeControlBar` rather than listing
  them, scoped to Compose steps — all four control bars declare `#bpm-input`.

- **`longestStreak` is maintained as a high-water mark.** The column arrived
  `NOT NULL DEFAULT 0` with no semantic backfill, and the client that owned
  streak writes only ever wrote `currentStreak`, so 60 production rows and 13
  on dev stored `currentStreak > longestStreak` — a record the leaderboard
  ranks on and the public board gates on. `0030_streak_high_water.sql`
  backfills every row to `MAX(currentStreak, longestStreak)` and the write path
  now raises it in step.

### Security

- **The anonymous credential is no longer a published identifier.**
  `userProfiles.id` is publicly readable and every leaderboard row carries a
  `userId`, and that id was the entire credential: `POST /api/auth/anonymous`
  returned a session for it and `POST /api/auth/register` took the row over
  permanently from the same value, so the board was a list of working
  credentials. `0029_device_secret.sql` adds `users.deviceSecretHash`, the
  client mints 256 bits per browser (`getDeviceSecret`, stored beside the
  device id so the two are lost together rather than one without the other),
  and `authorizeDeviceSecret` gates `/api/auth/anonymous`, `/api/auth/register`
  and both Google paths — where an unproved deviceId is dropped, so sign-in
  still succeeds into a fresh account instead of absorbing somebody else's. The
  consent URL moved to `POST /api/auth/google/start` so a secret never lands in
  history, logs or a `Referer`. Rows that predate the migration are
  grandfathered trust-on-first-use; the window that leaves is asserted in
  `node-tests/device-secret-integration.test.ts` and written down in
  `docs/agent/BUGS.md` rather than hidden.

- **A follow is a request until the other side accepts it.** The Friends board
  reads a singer's streak, scores, accuracy and session count while skipping
  the public board's opt-in gate and thresholds, and `POST /api/follows` took
  `followedUserId` on trust — so anyone could add anyone and read their record.
  `0028_follow_requests.sql` gives a row a status: `'pending'` grants nothing,
  `'accepted'` requires both rows to exist and agree, and nothing a single
  caller does reaches it. Generic CRUD writes to `follows` answer 405 and name
  the route that owns them (`writeRoute` on the table definition — `serverCols`
  could not express a rule about the shape of a write). Crossed requests settle
  themselves, removal clears both directions, and the friend-code path still
  connects both sides at once because being handed the code is the consent.

## [0.8.1] - 2026-08-08

### Added

- **Guitar Night — the full rehearsal room.** Song preparation runs behind a
  port so the room and the practice host share one performance runtime rather
  than each growing its own: `refactor(guitar): share the room performance
runtime` moved the common half out, and the band-preparation controller owns
  progress, cancellation and exact-session restaging (both pinned by tests).
  Oversized room mixes stream instead of being buffered whole. The Guitar tab
  links into the room, and the prepared-song library pages once it outgrows a
  screenful. The room contract is recorded in
  `src/features/guitar-night/DESIGN.md`.

- **PWA install.** `src/sw.ts` is hand-written rather than generated because
  the caching rules are the risky part: `assets.not_found_handling:
single-page-application` means a deleted chunk answers with index.html and a
  200, so `__WB_MANIFEST` is used as an _allowlist_ — only URLs this build
  shipped may be read from or written to the cache, and nothing is stored
  until its content type matches what its extension claims. Entry HTML is
  network-first without exception, and `activate` prunes every entry the new
  build does not list. Install priming is the shell plus the first-paint
  assets parsed out of the shipped HTML; everything else caches lazily.
  `scripts/gen-pwa-screenshots.mjs` shoots the install-sheet screenshots from
  the real built app, with the per-tab tour offers pre-dismissed.

- **`admin-console` feature perk** in the shared supporter catalog, plus
  `useSupporterFeatures()` — an auth-keyed, stale-guarded, fail-closed wrapper
  over `GET /api/perks/me` for perk-gated links.

- Lyric alignment (left/middle/right) is a shared `LyricsAlignSelect` chip in
  all three workspace layouts, replacing the performance layout's three-button
  strip. Native `SafeSelect` on purpose: the panels are draggable, and a
  hand-rolled popover here is the clipping/stacking mistake MISTAKES.md
  records.

- Theme auto-switch (#455): `themeSource` of `manual` | `system` | `time`, with
  `autoDayTheme`/`autoNightTheme` so all nine presets stay reachable from an
  auto source. `system` watches `prefers-color-scheme`, `time` polls the local
  clock every 60s. Any manual pick drops the source back to `manual`.

- Practice/voice-rest timer (#457): `practice-timer-store` accrues on mic-open
  for the practice phase and on silence for the break phase, so the clock
  measures singing rather than screen time. Off by default, and
  `practiceTimerTick` returns immediately when disabled.

- Mic latency calibration (#459): `mic-latency-store` plus a measuring wizard;
  `PracticeEngine` queues announced note starts and promotes them one round
  trip late, and the stem mixer judges a mic frame against the reference from
  `micLatencySec()` ago. Both paths are inert at the default offset of zero —
  the queue drains on the same call that fills it — so an unmeasured device
  scores exactly as before.

### Changed

- **Mic waveform overlay defaults off.** `micWaveVisible` moved from a
  session `createSignal(true)` to a persisted signal
  (`pitchperfect_mic_wave_visible`, default `false`): the overlay is a
  mic-health check, not something every run needs drawn over the stage, and
  turning it on once now sticks across sessions.

- **Rate limits closed on every gap the 106-route audit confirmed.**
  `POST /api/billing/checkout` and `GET /api/billing/portal` had none at all,
  and each mints a Stripe session object, so a loop was Stripe's bill as much
  as our load; both now share a `billing-checkout` bucket at 10/5min per user.
  Generic CRUD gained a 256 KiB body ceiling enforced from Content-Length
  first and the real byte length second, since the request-count limiter said
  nothing about size. `/api/auth/google/callback` (matched before the auth
  limiter, and able to create a user) and `/api/leaderboard` (the most
  expensive query an anonymous caller can reach) got buckets.
  `resend-verification` gained a per-address tier on top of the per-IP one.
  `friend-code` and `friend-redeem` moved from IP keys to `rateLimitSubject`,
  because both require a token and an IP bucket made a choir or a school lab
  share one budget. The audit's claim that the `logout` bucket was dead config
  was wrong — `handleAuth` buckets by `route` before dispatch.

- **One source for funnel event names.** The worker's ingest allowlist and each
  client surface's union were maintained separately and drifted:
  `donate_view`, `donate_start`, `onboarding_prints`,
  `onboarding_track_gallery` and `onboarding_another_voiceprint` were answered
  400 and dropped, and because `beacon()` never inspects the response the
  donation funnel and the returning-visitor onboarding track recorded nothing
  for as long as both features had shipped. `src/lib/funnel-event-catalog.ts`
  is now the single source, shared across the worker boundary the way
  `supporter-feature-catalog.ts` already was, so a one-sided name is a type
  error. The suite asserts set equality both ways, per-surface coverage, and
  no duplicate names.

- **`POST /api/auth/anonymous` requires a real `deviceId`.** It used to invent
  a UUID when the caller sent none, minting a row nothing could ever sign back
  into — the junk-identity source. The deviceId _is_ the identity, so a
  missing or malformed one is a 400; the bucket also gained a 100/day/IP tier,
  since 30/min sustained is 43k rows a day from one address.

- **Install surface 2.1 MB lighter.** The manifest icons and screenshots are
  bytes Android fetches outside the service worker — the install sheet
  downloads every screenshot, and WebAPK minting fetches the icons — so
  `scripts/optimize-pwa-images.mjs` quantizes them via sharp/libimagequant at
  0.3-0.9% RMSE, and the screenshot generator runs it over everything it
  writes. `warm()` no longer forces a revalidation round-trip for immutable
  hashed assets during priming.

- **Default sensitivity preset: `quiet`, not `home`.** `DEFAULT_SETTINGS` and
  the `pitchperfect_sensitivity_preset` signal both move (they are two halves
  of one choice — a mismatch labels the panel with a preset the numbers do not
  reflect). The failure modes are asymmetric: too strict reads as a dead mic
  with no feedback explaining why — which is what the original `noisy` default
  did — while too forgiving lets a little room noise through, which is visible
  and fixable. Auto-calibrate and the sidebar presets are unchanged, and both
  halves are pinned by `app-store.test.ts`.

### Fixed

- **A dismissed share sheet is not a delivery.** `shareCard`
  (`card-renderer.ts`) returns a third outcome, `'dismissed'`, when
  `navigator.share` rejects with `AbortError` — previously any rejection
  fell through to the download branch, so backing out of the sheet forced a
  file download AND fired `card_shared`/`glass_card_shared`, inflating a
  live Ads conversion. All four share sites (MirrorApp x2, CosmicMode,
  GlassApp) now return early on `'dismissed'`; genuine fallback downloads
  still count. Outcome matrix pinned in `card-share-outcome.test.ts`
  (including "no forced download on dismissal" via an anchor-click spy).

- **Failed sign-in re-arms the password field for autofill.** Password
  managers (Proton Pass and friends) refuse to overwrite a non-empty
  password input, and skip one revealed as `type="text"` — so the AuthModal
  keeping the wrong attempt in the field after a rejected login made every
  retry look like autofill was broken. On a rejected `login` attempt the
  modal now clears the password, resets the reveal toggle and refocuses the
  field (guarded so a retype already in progress is not wiped; `register`
  keeps the typed attempt for fix-ups). The form itself was already
  manager-friendly — real `<form>`, `name` + `autocomplete="username"` /
  `current-password` — and the focus trap only reacts to `focusin`, so it
  was ruled out. Covered in `AuthModal.test.tsx`, probe-verified.

- **Delete account joins the Danger Zone.** The erasure block moved out of
  `AccountSection` into `DeleteAccountRow` (self-contained: restore-only
  `fetchMe` on `authVersion`, failure surfaced via notification), rendered
  as the last row of the Settings Danger Zone card — server-side and most
  permanent, after the two local rows. It reuses `SettingsPanel.module.css`
  row classes deliberately so it reads as one of them; the old
  `dangerZone`/`dangerButton` classes were removed from
  `AccountSection.module.css` (module-scoped, provably unreferenced).

- **The singing-stage grid follows the melody.** Three coordinated changes,
  one invariant: the stage must always label what it shows.
  `gridRowsForBounds` (`src/lib/scale-data.ts`) extends the built scale's
  pitch classes across the melody-fitted `verticalBounds`, and
  `PitchCanvas.draw` now derives lanes, gridlines and right-edge labels from
  those rows instead of iterating `props.scale()` — whose octave window a
  loaded melody could sit entirely outside (the reported "top half of the
  screen has no note lines" after loading the G4 scale over a C3 grid).
  `loadMelody`/`_restoreCurrentMelodyId` align the grid from the melody's own
  key/scaleType/octave metadata via `refreshScale`, and an App effect mirrors
  key/scale type into the app-store signals so the sidebar pickers and share
  links describe the melody actually on stage. Label density thins (every
  2nd row) past 30 rows so huge imports stay readable. Covered by
  `src/tests/playback-grid-sync.test.ts` and new `gridRowsForBounds` cases in
  `src/tests/scale-data.test.ts`; both suites verified to fail with the fix
  pinned off.

- **One octave-shift path for every surface.** The desktop sidebar's octave
  buttons on the singing tab moved only the reference grid ("view-only"), a
  behavior that became invisible when the stage view started fitting itself
  to the melody — the buttons read as dead, and their `refreshScale` rebuilt
  the grid from app-store key/scale signals that a loaded melody never
  updated (stale-C-major grid under a G-major song). New
  `melodyStore.shiftMelodyOctave(delta)` transposes the melody and moves the
  grid together, rebuilt from the store's tracked key/scale type, clamped to
  octaves 1-6; Compose, the desktop sidebar and the mobile options sheet all
  route through it, and the sidebar's displayed octave is now derived from
  `currentScale()` (root row) instead of dead local state.

- **Merged from main, later batch:** the funnel event-name catalog
  (`198a9ed7`, one shared list so ingest cannot reject client events), the
  SEO sweep (#470: real favicon files, complete social cards, honest
  sitemap, extensionless entry rewrites + revert keeping full-quality OG
  images), and the dev redeploy trigger for shared runtime catalogs (#468).

- **Merged from main into this release** (reviewed and landed separately):
  funnel acquisition capture — where a funnel visitor came from, carried on
  every transport (#463); the karaoke staging event split — staging an example
  is no longer the same event as staging your own song, with an id-fallback
  pinned by unit and e2e tests (#465); an internal-traffic flag so GA4 can
  filter our own visits (#466); immutable caching for hashed assets and
  dynamic-only vendors off the first-paint graph (perf pair).

- **Score window modes.** `src/lib/score-window.ts` (new, dependency-free on
  purpose — both `practice-engine` and `settings-store` import it, and a
  definition in either would put a cycle through the stores barrel):
  `scoreWindow(samples, mode)` with `'full' | 'settled' | 'core'`,
  `SCORE_TRIM_FRACTION = 0.15`, floor-based so notes under 7 frames are never
  trimmed and 'core' always keeps at least 70%. `PracticeEngine` applies it in
  `finalizeNoteResult` (default `'settled'`, synced from the new persisted
  `scoreMode` setting through `EngineContext`). Each accuracy tier now implies
  a mode — learning/core, singer/settled, professional/full — applied by
  `applyAccuracyTier`, manual picks override until the next tier change.
  Blast radius audited: the window changes Singing-tab note scores only (live
  score, canvas chips, saved PracticeResults — forward-only). Falling-notes,
  the exercises, zen/challenges and the stem mixer score through their own
  paths (`centsToRating` there is called on already-final cents, no window)
  and are byte-identical. 20 new tests across three files; the four
  engine-mode tests were verified to fail with the windowing pinned off.

- **A rest left the note before it still being scored.** `PracticeEngine`
  closed a note's sample window only when the _next_ note started, and
  `PlaybackRuntime` filters rests out of `noteStart` and `noteEnd` alike — so a
  rest announced nothing and the finished note kept collecting through it. With
  `applySpacedRests` inserting two beats of silence, roughly two thirds of a
  note's samples came from the singer feeling out the coming pitch. Probed with
  a 200-cent prep tone, a perfectly sung note's mean absolute error went from
  ~0 to 133 cents — past `CENTS_GOOD` (50), so `centsToRating` returned `off`
  and `PitchCanvas` forced its chip to 0%. That is the whole reported symptom:
  every note 0% with rests, sane percentages without. New `onNoteEnd()` pushes
  a null boundary through the same latency-deferred queue as a start (frames
  arriving just after the note ended were still sung during it), and App
  subscribes it to the runtime's `noteEnd`. Notes that run back to back are
  untouched — the runtime emits end-then-start on one tick, in that order, so
  the result count and order are exactly what they were. Four tests, each
  failing on its own without the fix.

- **The drawn trace ignored the measured mic delay while scoring applied it,**
  so the picture and the score disagreed by exactly the offset — a trace on the
  note bar that scored as if it were beside it. `sungBeat(beat, offsetMs, bpm)`
  in `@/lib/mic-latency` is now the single definition of that shift, and
  `usePracticeController` puts every trace sample through it. It is a no-op at
  an unmeasured 0 ms. Recording (`processPitchFrame`) still stores arrival
  beats: its pipeline reads `timeSec` only
  for durations (OneEuro dt, hold and gap timers) and `beat` only for
  positions, so shifting the beat alone is internally safe. Now shipped:
  `processPitchFrame` stamps `sungBeat(beat, micLatencyMs(), bpm)` into the
  raw frames and the live pipeline, so takes land where they were sung (a
  no-op at 0 ms). Negative beats near the start are the physical truth —
  frames sung on the count-in — and were already possible before the shift.
  On top of the automatic part, the take review panel gained a Timing slider
  (`shiftTakeFrames`, -200..+200 ms, reset per take, double-click to zero)
  that re-segments the contour through the same `segmentContourToMelody`
  call, plus a note naming the compensation already removed. Nine tests
  drive the real controller end to end (record -> frames -> pending take);
  the three latency tests were verified to fail with the stamping pinned
  off. The stem mixer's own use of `segmentContourToMelody` is untouched —
  the shift happens in the recording controller, not the shared function.

- **Audited the mic-latency measurement itself and found it sound.** The wizard
  times clicks and their return on one `AudioContext` clock and uses the
  scheduled time as the reference, which is right for measuring the device's
  own delay (the contrast with `tap-calibration`, which measures a human
  reaction, is documented in both files). The median over eight clicks, the
  half-interval match window, `MIN_LATENCY_HITS` and `MAX_LATENCY_MS` all hold.
  One inherent limit worth knowing: the capture anchor is
  `currentTime - block/sampleRate` taken inside a `ScriptProcessor` callback,
  which fires on the main thread, so a reading is biased high by however late
  that callback runs — about ±10 ms at the 512-sample block size.

- **Short-viewport layout, two distinct bugs.** A shrinkable flex item floors
  at its container's height while its children shrink below their text, so the
  text _overlaps_ rather than clips — `.exercise-idle-center` needed
  `flex-shrink: 0`. Separately, `justify-content: flex-end` on a scrollable
  strip spills past the unreachable _start_ edge, which is why a tablet could
  not reach the first tabs; `safe flex-end` fixes it. Both pinned by
  `exercise-tablet-landscape.spec.ts` at 660, 560 and 420 CSS pixels.

- **The piano's finished-run card** dropped its Play Again / Close row and, on
  the mobile stage, its full-width bottom dock — which read as a blocking
  modal. Replay needed no new wiring: the transport play button already
  restarts a finished run on both stages. Guitar 3D keeps its buttons; the
  change is an additive `--quiet` variant.

- **The lead-in cue is one language across both surfaces:** a fixed `2.4em`
  bar anchored to the start of the line, `position: absolute` inside a
  `position: relative` line, instead of an inline-block that shoved the first
  word sideways and changed width with it.

- **Stripe price ids no longer ride along in the public pricing read.**

- **A canvas in the Lab** stopped repainting when nothing on it was changing.
- **Lyric lead-in cue ignored the panel's text alignment.**
  `.sm-lyrics-lead-in` was absolute against `.sm-lyrics-line`, which is a
  full-width flex item so the active-line highlight can span the panel. `left`
  therefore resolved against the row edge, correct only for left-aligned
  lyrics: measured offset from the first item in the line was -130px centred
  and -260px right-aligned. Each line's content now sits in a shrink-to-fit
  `.sm-lyrics-line-body` that `text-align` positions, with the cue anchored to
  that — 0px at all three alignments.

- **Karaoke Night rail reloaded the whole library on every song.** Two
  independent causes in `KaraokeRailPanels`. (1) The `partCounts` resource took
  the session-id array as its source; an array literal is a fresh reference per
  source evaluation, so Solid's `!==` check refetched on every session-store
  tick — and staging a song ticks the store (hydration, orphan pruning), so
  each song load re-ran one `listStemTypes` IndexedDB query per library song.
  The source is a joined string key now. (2) Counts were read via
  `partCounts()`, and reading a loading resource inside `<Suspense>`
  re-suspends the boundary, which is what blanked the rail rather than merely
  staling it; now `.latest`, matching `AnalysisDashboard`'s existing note on
  the same trap. The boundary also had no `fallback`, so the genuine first load
  rendered nothing. Both halves are pinned by tests that fail independently.

- **Alignment debug logging is opt-in.** `formatAlignmentDebugLog` printed a
  per-word table plus a single-line JSON dump of every entry on each staged
  song, and `logAlignmentComparison` ran `alignPitchToWords` twice over the
  whole song purely to print two lines. Both now require
  `localStorage.pitchperfect_debug_alignment === '1'`; the one-line summaries
  are unchanged.

- **An auto theme source did not put its preset on the DOM at boot.**
  `initTheme` set `data-theme` only on the `manual` path and left the auto
  sources to `startAutoWatch`; `syncAutoTheme` writes only when the resolved
  preset differs from the stored one, which on a normal reload it does not. No
  attribute was written at all, so `:root`'s dark tokens applied and an auto
  user on a light preset loaded dark every time. Found reviewing #455 before
  merging it; regression test in `theme-store.test.ts`.

- **Lyric wheel-zoom listener declares `passive: false`.** Chrome logged a
  scroll-blocking violation on every mount because the handler was a JSX
  `onWheel` with no stated intent. Moved to the ref callback alongside the
  touch handlers — which also fixes those: they were bound in `onMount`, but
  the list lives inside a `<Show>` keyed on edit / LRC-gen / text-edit mode, so
  it is rebuilt when the user changes mode and the handlers were left on a
  discarded element. Pinch-zoom stopped working after the first trip through
  edit mode.

- **Background picker: a real drawer below the mobile breakpoint.** Three
  parts. (1) `handleScroll` no longer closes the popover when `isNarrow()` —
  the close-on-scroll rule exists so the desktop popover cannot drift from the
  trigger it is anchored to, but the phone panel is viewport-pinned, and a
  one-item gallery has nothing of its own to scroll, so a drag inside it
  chained to the page and dismissed itself. (2) A `.scrim` renders behind the
  panel on narrow viewports with `touch-action: none`, so nothing behind it
  pans, whichever element is the scroller. (3) `DrawerScrollLock` (a
  render-nothing component under the same `<Show>`) holds the counted
  `useScrollLock` for the drawer's lifetime — `useScrollLock` locks for a
  component's lifetime, so a conditional lock has to be a conditional mount.
  The CSS breakpoint also moves 620px → 768px to match `isNarrow()`; the
  window between them got the anchored-popover JS with the drawer's CSS.

- **Analysis take picker: a column on phones, a wrapping rail above 720px.**
  `.takeRail` was a horizontal snap rail at every width, so a second take —
  the first separated song — ran off the right edge. Now `flex-direction:
column` with full-width cards, capped at `46vh` with contained overscroll so
  a large library cannot push the analysis itself off screen; the ≥720px block
  restores `row` + `flex-wrap` + fixed-width cards and drops the cap.

- **Exercise result trace stayed inside the card.** A `<canvas>` carries a
  300px intrinsic width until its draw sizes it, and `.exercise-result-main`
  is a flex item beside the grade badge with the default `min-width: auto` —
  so that 300px became the floor and the plot rendered past the card's right
  padding on a phone. `min-width: 0` on the result column and on
  `RunTraceCanvas`'s wrap/plot, plus `max-width: 100%` on the canvas itself.
  (The live tracker's canvas already had `width: 100%`, which is why only the
  result card was affected.)

- **Map cards auto-reveal on touch.** `BeatMap` now runs one
  `IntersectionObserver` (gated on `matchMedia('(hover: none)')`, threshold
  0.45, one-way — a revealed card unobserves) that stamps `.roomInView` per
  card; `onboarding.module.css` plays the full hover reveal for that class
  inside the existing `(hover: none)` block. Viewport-root intersection
  honours ancestor clipping, so the same code works inside the scrollable
  onboarding modal and on the standalone `#/map`. Reduced-motion keeps its
  instant transition.

- **Voice constellation: vertical grid on small screens.**
  `VoiceConstellationSurface.module.css` ≤820px: the per-band horizontal
  snap-rows (`display: flex` + `overflow-x` + `scroll-snap`) are replaced by
  `repeat(auto-fill, minmax(140px, 1fr))` — two columns on phones, one
  vertical scroll for the whole surface. The ≤430px width overrides went
  with them. The desktop base grid is untouched, and no JS depended on the
  horizontal scroller.

- **Zen vocal pill: drag-to-unmute + legible track.** New pure decision
  `vocalDragUnmutes(muted, level)` in `zen-navigation.ts` (unit-tested):
  a level drag `> 0` on a muted pill toggles the mute off first, so the
  fill and the audio track the finger instead of writing to a bypassed
  gain. `KaraokeMobileStage` routes `PillControl.onLevel` through it. The
  sing pill also pins `--pill-bg` to a near-solid stage plum — the default
  glass let the lyric column shine through the expanded track — and
  `PillControl` now sets `user-select: none` + `-webkit-touch-callout:
none` so iOS never answers the hold with the selection magnifier.

- **Karaoke Night topbar fits an iPhone.** The stage background picker gets
  `iconOnly={isNarrow()}` (its existing visually-hidden-label mode), and
  the brand renders logo + wordmark: `karaoke-night.css` hides the logo on
  desks and swaps the tracked-out wordmark for it under 560px, with an
  `aria-label` keeping the link named.

- **Community page: no sideways pan on phones.** The mobile
  `.community-panel` rule adds `overflow-x: hidden` (its `overflow-y: auto`
  computed the x-axis to auto as well), and the backdrop art's `inset`
  bleed shrinks from the desktop 24px to the phone padding (14/16px) — the
  right-hand overhang past the content edge is what minted the horizontal
  scroll range.

## [0.8.0] - 2026-08-06

### Added

- **Jam song mode — a room can run a whole song on its own timeline.** The
  song timeline is kept deliberately separate from the beat grid, so a room
  running a song and a room running an exercise do not share a clock. The
  stage puts lyrics left and one pitch lane per singer right, with a target
  line drawn on every lane and per-line scoring evaluated as each line
  passes rather than at the end. Count-in dots run through the rests. One
  scoreboard is agreed across the room instead of each peer keeping its own,
  and a room run records as practice through the same path as any other
  session. Rooms can also run exercises, the weekly Legend and the singer's
  Ascent week.

- **Part assignment and multi-part arrangements in Jam.** Lines are handed
  out per person, notes are attributed to their singer, and clicking a lyric
  line takes the part from there. Harmony Stack and Relay are arrangement
  types a single singer cannot complete. Lyric fixes made in the room are
  what the room then sings.

- **Stem transfer over the DataChannel.** A stem is encoded small enough to
  send, then moved in chunks across the peer connection with real progress
  reporting rather than a spinner. The picker gained a Songs shelf plus the
  singer's own separated sessions, and a guide vocal audible only to the
  local singer. TURN credentials are minted from Cloudflare instead of a free
  public relay.

- **The Mercury Rooms** — a native-4K photographic backdrop set, regenerated
  texture-forward to kill colour banding, behind a transparency slider that
  drives blur along with opacity. Room presence announces arrivals, the room
  reports its own activity state with a host override when it desyncs, a host
  can rejoin their own room, and a browser-blocked microphone is reported
  distinctly from a user-denied one.

- **Achievements expansion and authoring** — fifty-two additional goals
  across the groups, a grid layout, badges reworked from toolbar glyphs into
  earned objects surfaced on profiles, and Content Studio pages for
  authoring achievements, exercises, exercise recordings and exercise
  timelines. A timed `.lrc` can be dropped onto the demo song.

- **Leaderboard podium** — three distinct medals for the top three, the medal
  promoted to the full card, and the board ranking the same streak it names.

- **Challenges hub** — its own surface rather than a borrowed one, run-aware
  art, the after-run moment as a full card on the tab instead of a modal, a
  Zen-based challenge performance stage with a melody adapter and parity
  scoring, and the weekly Legend surfaced on the tab.

- **Note dial** replacing the note-pill wall, with the octave on the rim and
  tap-to-audition.

- **Zen loop counts and non-pitch targets** — a session can run a fixed
  number of loops and stand down, and an exercise can ask for loudness or for
  silence rather than only pitch.

- **Cross-tab microphone lock plus an input meter** — one tab owns the
  device, with hand-off, and the level is published for display.

- **Swell surfaces the loudness it already scored**, so the dynamics being
  judged are visible.

- **LRC mapper** — two-pass mapping, line preview and reaction calibration.

- **Personal Voice Constellation** (#428) (`src/features/voice-constellation/`,
  `src/lib/mirror/voice-constellation.ts`, `src/lib/mirror/legend-catalog.ts`).
  A route-backed surface for current and past saved Voice Mirror matches.
  The 21-legend, six-band catalogue is centralised in `legend-catalog.ts` and
  shared by matching, classification and presentation, so the three can no
  longer disagree about a legend's band. Unmatched portraits stay inert
  mystery scenes and never resolve or load their portrait assets — the
  reveal is also a bandwidth boundary. Revealed legends open a focus-trapped
  detail view with full artwork, vocal range, match history and
  previous/next navigation. Entry points from returning onboarding, Settings
  and the signed-in singer profile. `useVoiceConstellationIsolation` scopes
  the surface to the signed-in identity so an account transition cannot leak
  the previous singer's cards.

- **Streak freezes accrue on a rolling clock**
  (`workers/db-worker/migrations/0017_streak_freeze_accrual.sql`,
  `src/db/services/streak-service.ts`). `MAX_FREEZES = 3`,
  `STARTING_FREEZES = 2`, `FREEZE_ACCRUAL_DAYS = 30`. The old
  `earnFreezeIfMilestone` granted at streak multiples of seven, which paid
  forgiveness to whoever least needed it; `accrueFreezes` replaces it and
  runs at the head of `advanceStreak`, `computeStreakState` and
  `applyRepair`, so any read or write brings the balance current. It needs
  its own anchor — `userProfiles.lastFreezeEarnedDate`, added by 0017 —
  because a date derived from practice would only advance for people who
  practice, and an idle month is exactly the case that must accrue. The
  anchor advances by whole `periods * FREEZE_ACCRUAL_DAYS`, never to
  `today`, so partial periods are not silently forfeited. `applyRepair` now
  returns a typed `RepairResult` instead of a bare boolean, and repair is
  suppressed while `freezesProtectStreak` — the two currencies are mutually
  exclusive by construction, not by UI convention. Topping existing accounts
  up to `STARTING_FREEZES` is deliberately NOT in the migration:
  `scripts/grant-starting-freezes.sql` is run by hand from the release
  checklist, because a migration CI applies would hand out currency
  unreviewed against prod at tag time. (Superseded later in this release —
  `accrueFreezes` grants the opening balance itself, so the script is marked
  do-not-run and is off the checklist.)

- **Editable Karaoke Night demo song** (`workers/db-worker/migrations/0016_demo_song.sql`,
  `workers/db-worker/src/demo-song.ts`, `src/features/admin/AdminDemoSongPage.tsx`,
  studio section `#/admin/demo-song`). `GET /api/demo-song` is public and
  unauthenticated — the Karaoke page fetches it before anyone signs in —
  while `PUT` is admin-gated, a split the `TABLES` allowlist cannot
  express, so the route is handled outside the generic CRUD dispatcher.
  Three properties worth keeping:
  - **The shipped manifest is the floor.** `public/karaoke-demo-song.json`
    still loads whenever there is no row, the row is parked
    (`active = 0`), the row is malformed, or the API is unreachable. A
    row also has to be _playable_ (both stem URLs set) to win, so saving
    a title before pasting the stems cannot present an unplayable demo.
    The public `GET` filters on `active = 1` so a parked row is
    indistinguishable from no row; the admin `GET` sees it and reports
    `active: false`, which is why the projection carries the flag at all.
  - **`lyricsRevision` only moves when the lyrics move**
    (`nextLyricsRevision`). It is the client's re-seed cue, so bumping it
    for a title typo would re-seed every visitor for nothing.
  - **Seeding never takes a visitor's work** (`shouldSeedLyrics`). A
    correction replaces a local copy only when a stamp proves we wrote it
    and it is still byte-identical; an edited copy, or one seeded before
    stamps existed, is left alone permanently. Stamp in `localStorage`
    under `mercurypitch.demoLyricsSeed.v1`.

  - **Lyrics files are read, never uploaded** (`readLyricsFile`). A
    dropped or browsed `.lrc`/`.txt` lands in the pasted-lyrics field and
    travels in the row, so a timed lyric reaches a singer with no R2 round
    trip and no new storage surface. The reported format comes from the
    **content**, not the extension — `demoLyricsText` infers sync from
    `[mm:ss` stamps, so a `.lrc` with its timestamps stripped is announced
    as plain text rather than promising a sync that will not happen. Every
    failure returns an error instead of throwing: the author is mid-form,
    and an exception would cost them every other field.

  Covered by `workers/db-worker/src/demo-song.test.ts`,
  `src/tests/demo-song.test.ts` and `src/tests/demo-song-admin.test.ts`
  (40 tests). The revision and seeding decisions fail silently when wrong,
  so both were mutation-checked.

- **More than one Karaoke Night demo song** (`GET /api/demo-songs`,
  `normalizeDemoSlug`, `demoSessionId`). `demoSongs` was already
  slug-keyed, so there is no migration. What matters:
  - **`GET /api/demo-songs`** returns every row in `createdAt ASC` order —
    live rows only for the public, all of them for an admin key, because a
    list that hides what you parked is a list you cannot un-park from.
    Order is by creation, not title, so adding a song never moves the one a
    first-time visitor is meant to sing. The single-row
    `GET /api/demo-song?slug=` is unchanged and an absent slug still
    resolves to `karaoke-night`, so every pre-list client keeps working.
  - **The original demo keeps its historic session id.** `demoSessionId()`
    returns the bare `karaoke-night-demo` for the legacy slug and
    `karaoke-night-demo:<slug>` for anything added later. Every visitor who
    has ever sung the demo has lyrics, pitch analysis and takes in their
    local db keyed by the bare id, so producing a suffixed one would orphan
    all of it — silently, with no error to notice. The lyrics seed stamp is
    namespaced the same way, for the same reason.
  - **Slugs are constrained at both ends** (`normalizeDemoSlug`, in the
    worker and in the studio): lowercase, `[a-z0-9]` with single hyphens,
    64 characters. Binding keeps it out of the SQL but it does not stay in
    the database — the client builds a local-db key and a `?session=` URL
    from it — so anything that would not survive that round trip is a 400
    rather than a row nobody can address. The studio also refuses a new
    slug that collides with an existing one, because `PUT` is an upsert and
    would otherwise overwrite a song silently.
  - **The API list wins whole** (`loadDemoSongs`). One playable row makes
    it the set; mixing the shipped manifest back in would resurrect a song
    an author had deliberately parked, with no way to take it down. An
    empty list, a malformed batch or an outage still lands on the manifest,
    which stays the floor. Malformed rows are filtered individually rather
    than failing the whole batch.
  - **Attribution follows the song on stage** and, when none is, credits
    every song on offer — CC BY is not satisfied by crediting the first of
    two. Deduped by source, and named per song only when there is more than
    one line to tell apart.

  Studio (`AdminDemoSongPage`): a song bar with per-row `Live`/`Draft`/
  `Parked` status, an "Add a song" action, and a link-id field editable
  only before the first save. Switching songs while the form is dirty is
  blocked behind an explicit save or discard rather than dropping the
  edits.

  Rail (`KaraokeNightApp`): the opener keeps a full card — it is the single
  call to action a first-time visitor gets — and every song after it
  becomes a row in a `.kn-library`-shaped list under "Also tonight", with
  the same active state and equalizer the library rows use. One card per
  song reads fine at two and buries the visitor's own library at ten.

  Topbar: the studio link was a bare `<a>`, and a `display: none` under the
  mobile breakpoint (keyed on `a[href='/#/karaoke']`, so it only fired when
  no session was staged) left a phone with no way back to the app. It is
  now a chip with a grid icon, labelled for its destination rather than for
  itself, and the label shortens to "App" under 640px instead of vanishing.
  The accessible name lives on `aria-label` because the visible label is
  two mutually exclusive spans.

  Nine new tests across `workers/db-worker/src/demo-song.test.ts` and
  `src/tests/demo-song.test.ts`. The legacy-session-id case is the one that
  earns its keep: it is the only guard on a failure that produces no error,
  just a page that has forgotten what somebody did.

- **Weekly Legend rotation** (`scripts/seed-weekly-rotation.mjs`, `pnpm
db:seed:weekly`): five consecutive weeks, week one `active` and weeks
  two to five `queued` on Monday-to-Monday windows. No cron — the worker
  resolves the current challenge lazily on every `GET /api/weekly/active`,
  closing a passed week (snapshotting its board into `resultsJson`) and
  promoting the queued row whose window contains now, so consecutive
  windows chain themselves. All five are `evergreen`, so the encore path
  clones a closed one once the queue is spent. Supersedes
  `seed-weekly-sample.mjs`; week one is byte-for-byte its reviewed melody,
  so an already-seeded board keeps its content and scores. `--dry-run`,
  `--no-founder` and `--start <ISO>`; production refuses without
  `MP_ALLOW_PROD=1`.

- **Cloudflare Access verification for admin routes**
  (`workers/db-worker/src/access.ts`, 27 tests): RS256 pinned, signature
  checked against the team JWKS (cached per isolate, re-fetched on an
  unknown `kid`), `aud` matched to the application, `iss` to the team, and
  `exp`/`iat` with 60s skew. Tokens read from `Cf-Access-Jwt-Assertion` or
  the `CF_Authorization` cookie; service tokens accepted by
  `common_name`. `resolveAdmin()` holds a two-stage policy: unconfigured →
  `X-Admin-Key` only; configured → a verified token passes and the key
  still does; `ACCESS_STRICT=1` → token only. Staged because the browser
  studio calls the API cross-origin and cannot carry the Access cookie
  yet, so retiring the key in one move would lock the owner out.
  `isAdmin()` is now async, awaited at all ten call sites. Seed scripts
  send service-token headers via the new `scripts/admin-headers.mjs`.

- **Seven more legend portraits** (`LegendCaricature.tsx`, `singer-match.ts`,
  `public/legends/`): Michael Jackson, Prince, Luciano Pavarotti, Aretha
  Franklin, Louis Armstrong, Nina Simone, Ariana Grande — Style A masters
  (928x1152) plus authored vector fallbacks, and `pnpm assets:legends`
  regenerated `thumbs/`/`mid/` for all 21. Every voice type now has >= 3
  legends (Bass/Alto/Mezzo/Soprano were pairs, Tenor was a pair);
  `singerForVoiceType` seeds off the detected range, so a two-name roster
  made the twin close to a coin flip. `SINGERS_BY_VOICE_TYPE` is now
  exported and `singer-match.test.ts` imports it rather than restating it —
  the old copy meant a roster change passed a suite asserting the old list.
  New assertions: >= 3 per type, no name under two types, every legend
  reachable across consecutive seeds, and a `LEGENDS[name].imageSrc` for
  every roster entry (a missing one silently fell back to the generic bust).
- **`webpSize` reads VP8X and VP8L** (`scripts/gen-legend-tiers.mjs`): a
  master converted without `magick -strip` keeps generator metadata, and
  metadata forces the extended VP8X container — the simple-`VP8 `-only
  reader threw on the new portraits instead of measuring them. All 21
  masters re-encoded stripped, so the repo is uniform, and the parser now
  handles all three variants regardless.
- **Map beat account recovery** (`BeatMap.tsx`, `FirstLight.tsx`): optional
  `onKeep`, passed only when `voiceprint() !== null && !accountHeld()`.
  Deliberately NOT gated on `shouldShowNudge` — the quiet period exists to
  stop the offer re-asking, and this is the way back for somebody who just
  closed the form, which is exactly when a quiet period would hide it.
  `handleReopenAccount` does not `advanceBeat()` (the Map is the last beat),
  and `accountHeld` is reactive so the line disappears on sign-in.
- **Compose drum kit mode**: per-melody `kind: 'melody' | 'drums'`
  (`MelodyData`, absent = melody, legacy-safe) with a header segmented
  control (`data-tour="compose.kind"`). Drum lanes are plain `ScaleDegree`
  rows built from the GM map (`src/lib/drum-lanes.ts`: 12 lanes, descending
  midi 51→36, labels + Path2D-compatible icon paths), so placement, drag
  remap, share codec, `melodyEquals` and sheet music work unchanged; toggling
  never touches `this.melody`. Guitar's 8 drum-machine factories extracted
  verbatim to `src/lib/drum-voices.ts` with a `destination` param
  (+ new sidestick/clap/pedal-hat/ride recipes); `drum-machine.ts` keeps
  byte-identical behavior via thin adapters. `audioEngine` gained a
  `drumGain → mainGain` bus (volume slider + note-bus limiter apply),
  `playDrum(voice)`, and a drums branch in `renderMelodyToWAV` /
  `downloadMelodyAsWAV`; `noteStart` routing, ruler scrub, and MIDI export
  (channel 10) all follow the kind; record button disabled in drum mode.
  Share links carry `dk?: 1` (tolerant decoder, old links unaffected).
- **Playable left keyboard** in the piano roll: black/white key lanes
  (falling-notes palette) drawn on `pianoCanvas`, Pointer Events with
  capture — press auditions (`previewNote` / `playDrum`), drag retriggers
  across lanes, pressed-lane accent, `touch-action: none`; status-bar hint
  names the hovered lane.
- **Hover hints**: `pitchperfect_compose_hints` persisted setting, View-group
  toggle (`#roll-hint-toggle`), cursor-anchored tip in the grid layer showing
  note name / drum icon + name; drum mode auditions once per note-enter
  while stopped.
- Walkthrough steps for the preset toggle, playable keys, and hints; new
  vitest suites (`compose-drum-mode`, `drum-voices`, share `dk` round-trip)
  and a real-mouse Playwright spec (`src/e2e/compose-drums.spec.ts`, @smoke).
- **Sheet Edit/Scrub toggle**: persisted `pitchperfect_sheet_mode` setting +
  header segmented control; scrub mode routes clicks/drags through a shared
  `seekAt` (note start, else nearest bar beat — the read-only path), hides
  the ghost, disables right-click delete, and drag-scrubs via mousedown
  tracking. e2e: scrub click seeks without placing.
- **Playback**: rAF loop back-fills notes that start inside a frame gap
  (≤1-beat cap; seeks/stop/resume reset the tick cursor) so high-tempo
  sixteenths survive slow frames; `start()` on a paused runtime resumes
  instead of no-op (the "stuck skipping" state). Regression suite in
  playback-runtime.test.ts.
- **Space transport**: global hook stands down on TAB_EXERCISES,
  ExerciseShell accepts button-focused Space (single-fire via
  preventDefault), and the zen stage binds Space itself (start/pause/
  resume). exercise-stop-flow.spec's stop-button selector was stale
  (`.exercise-btn-secondary` — the suite passed vacuously) and now drives
  `.exercise-btn-stop`; new fake-mic `zen-space.spec.ts`.
- **Sheet ghost preview**: hover in the score's edit mode renders a dashed
  note (duration-shaped glyph + name label) at the exact snap position a
  click would place. One `placementAt` routine feeds both the hover ghost
  and `handleClick`, so preview and placement cannot diverge; new
  `midiToStaffY` inverse in `sheet-music-renderer.ts` (round-trip tested
  against `staffYToMidi`).
- **Scale-state sync**: the roll toolbar's mode select now routes through
  `melodyStore.refreshScale` (the canonical `_scaleKey/_scaleType` write),
  so Rows±/octave rebuilds keep the chosen type instead of reverting to C
  major; the editor adopts store scale-type changes via `syncScaleType`
  (select stays honest, optimistic rebuilds match the store); row changes
  that leave notes off-grid announce the count in the status bar
  (notes themselves are never mutated by view changes — only Shift±
  transposes, as a single undoable step). Regression coverage:
  `compose-scale-sync.test.ts` + an e2e that flips harmonic minor and
  clicks Rows +.

- **Guided exercise schema v2** (`validate-exercise.ts`, migration `0014`):
  targets gain a `kind` — absent means pitch (all of v1), `amplitude` scores
  coverage above the noise floor plus level steadiness, `breath` scores
  nothing and draws an expanding ring. v1 stays frozen and `.strict()`, so a
  historical Ascent assignment cannot acquire a meaning it was never published
  with; `parseZenExerciseVersion` dispatches on the stored `schemaVersion` and
  rejects anything else. `0014` rebuilds `guidedExerciseVersions` to widen
  `CHECK (schemaVersion = 1)` to `IN (1, 2)` — SQLite cannot alter a CHECK in
  place — using `defer_foreign_keys` rather than `foreign_keys`, because D1
  runs a migration inside a transaction where toggling enforcement is a no-op.
  `createExercise`/`cloneDraft` write `ZEN_EXERCISE_SCHEMA_VERSION` instead of
  a hardcoded 1.
- **Zen step boundary** (`useZenPitchSession.ts`): `loopLimit` +
  `onLoopLimitReached` let a session run a fixed number of loops and stand
  down without closing the mic; `exerciseDefinitions` lets `selectExercise`
  resolve every step of a sequence rather than only the one it launched with.
- **The shell owns the pitch tracker** (`ExerciseShell.tsx`): six exercises
  each mounted `ExercisePitchTracker` with slightly different props, one of
  them wrong. Exercises now describe what they want tracked.
- **Upcoming targets** (`PitchOverTimeCanvas.tsx`) and **run trace**
  (`RunTraceCanvas.tsx`, `run-trace-view.ts`).
- **`timer-preference.ts`**: module-scope persisted signal —
  `createPersistedSignal` keys its cross-tab listener by storage key, so one
  signal per mounted shell would fight over it. Keyed
  `pitchperfect_exercise_timer`: `settings-service` syncs exactly the
  `pitchperfect_`-prefixed keys, and the prefix is now pinned by a test.
- **`routine-mic-hold.ts`** + `BACKGROUND_HOLD_IDS` in `mic-manager.ts`: the
  sentinel's live-without-ui check skips a hold whose whole job is to keep the
  device open between surfaces. A phantom hold on a dead stream is still
  reported — that check is about the hold, not the UI.
- **`auto-continue.ts`**: absent preference reads as on, since every existing
  install has no key and reading that as off would silently opt everybody out.
  The toggle lives on the populated routine card, not with the Focus/Length
  selects, which only render in the empty state.

### Changed

- **`Sheet` portals to `document.body`** (`src/components/mobile/Sheet.tsx`).
  It rendered in place, justified in its own header by "a `position: fixed`
  box escapes to the viewport anyway — StageShell has no transform/filter".
  Verified against one caller, false for the rest: `position: fixed` is
  viewport-relative only while no ancestor creates a containing block or clip,
  and `transform` / `filter` / `backdrop-filter` / `will-change` / `contain` /
  `overflow` all can. JamPanel is blurred glass over a photographic room
  inside `.mainArea { overflow: hidden }`, so the song picker opened as a
  squashed, uninteractable band pinned to `.transportRow` on a phone. Fixing
  the class rather than the instance: portalling makes it immune to all of
  those triggers, so a stage growing a `filter` later cannot silently break
  sheets. The `--sheet-*` cascade is preserved by an in-place anchor whose
  resolved values are copied onto the portalled backdrop on open — including
  `--sheet-max-h`, which `.sheetSplitStrip` overloads for the sheet-MUSIC
  strip, so forwarding reproduces today's inheritance rather than changing it.
  New spec asserts the dialog is in `document.body` and absent from the
  caller's subtree, and was confirmed to fail with the portal removed.

- **`deploy-db.yml` reconciles the target schema before applying the chain**
  (`scripts/reconcile-d1-schema.mjs`, new Reconcile step before
  **Apply D1 migrations**). `CREATE TABLE IF NOT EXISTS` does not compare
  shapes, so every column `0001_baseline.sql` declares on a table predating
  it never reached a `schema.sql`-era database — production, built by
  `d1 execute schema.sql` at v0.7.22. Where the baseline indexes such a
  column the first migration fails outright; where it does not, the chain
  reports success while the app writes to columns that are not there, which
  is how prod lacked six `userProfiles` streak columns for months at one D1
  error per write.

  The step derives the gap rather than carrying a list: apply **only** 0001
  to a throwaway local database, read the target's real shape, add what is
  missing from tables both have with the reference's own type, NOT NULL flag
  and default. A baseline-only reference is what makes it safe — a column a
  _later_ migration adds by ALTER is absent from it, so it is never
  pre-added and that migration still finds the column missing and succeeds.
  A hand-maintained list got exactly this wrong first time by including
  `userProfiles.lastFreezeEarnedDate`, which `0017` adds; pre-adding it
  would have failed 0017 on duplicate column and taken the chain down.

  Runs for dev as well as prod on purpose: a step that only executes during
  a release is a step nobody has tested. Verified against remote dev
  (no-op), a chain-built replica (no-op), and a `v0.7.22:schema.sql` replica
  (exactly seven columns); then reconcile that replica, replay all 17
  migrations, and diff against a from-scratch database — 373 columns, 59
  indexes, byte-identical. Re-running is a no-op. Limits: columns only, so
  type changes, drops and renames still need a hand-written rebuild, and a
  missing NOT NULL column with no default exits 1 rather than guessing what
  existing rows should hold. Supersedes and deletes the print-only
  `gen-column-patch-sql.mjs`.

- **`WeeklyChallenge.targetItems` documented as absolute, untransposed
  MIDI** (`weekly-service.ts`, `MISTAKES.md`): a weekly Legend is a shared
  feat, so everyone attempts the identical notes and the board stays
  comparable. `voiceTypeSplit` is the unbuilt hook for per-type variants
  and is read by nothing. Written down because it reads as a bug — a Bass
  handed a B4 — and an agent would otherwise "fix" it.

- **Migration guidance: replay, do not reason** (`MISTAKES.md`). A chain
  analysed statement-by-statement and called safe fails on `0001` against
  the real prod baseline: `CREATE INDEX IF NOT EXISTS ... ON
sessionRecords(weeklyChallengeId)` throws where the column is absent,
  because `IF NOT EXISTS` guards the index and not the column, and the
  `CREATE TABLE IF NOT EXISTS` above it is a no-op on an existing table.
  The rule is now to rebuild the target database from the schema that
  environment actually has and execute every migration against it.

- Piano-roll canvases draw from a CSS-variable palette (`--roll-*` in
  `PianoRollEditor.css`, dark values as fallbacks) instead of hardcoded hex;
  toolbar a11y: labeled selects, `aria-pressed` on toggles, duration
  radiogroup, `aria-live` status hint.

- `WelcomeScreen.tsx`/`.module.css`, `BeatSky.tsx` and `e2e/onboarding.spec.ts`
  deleted. Consequence worth knowing: First Light now auto-opens for a
  first-time visitor, and every E2E spec is one, so three ribbon specs started
  timing out behind the modal. `dismissOverlays` matched overlays by class
  name and the flow's class is a CSS-module build hash, which nothing outside
  the file can select — the flow root carries `data-onboarding-flow` now, and
  the helper seeds `pitchperfect_onboarding_done`.
- `probe()` separates `quiet` from `silent`. Treating a quiet room as a denial
  marked the mic denied, which made every beat but the Map inapplicable — the
  whole "it skipped the voiceprint step" report.
- `StarField.tsx`: `arcBand(width)` + `arcY()` move the contour to a shallow
  band (`top: 0.02`, `scale: 0.3`) below 640px. Proven arithmetically rather
  than visually, since the canvas cannot render headless: on an 844px viewport
  the desk arc spans y=235..414 with the eyebrow at 299 and the headline at
  331; the phone band puts it at y=88..141, clearing the copy by 158px.

### Removed

- Four `src/e2e/debug-*.spec.ts` scratch specs (`debug-appstore`,
  `debug-layout`, `debug-proto`, `debug-reactivity`) — 223 lines asserting
  nothing anybody relies on, costing time on every E2E run. Kept in git
  history for the next similar hunt.
- `scripts/gen-column-patch-sql.mjs` — the print-only column patcher with a
  hand-maintained expected-column list, superseded by
  `scripts/reconcile-d1-schema.mjs`, which derives the same set from the
  baseline and cannot go stale.
- Dead code: unreachable internal playback animation loop (+ its
  `playStartTime`/`editorBeat`/`startedNoteIds` machinery), `#roll-octave-value`
  queries, `#roll-delete-selected-btn` handler, `'='` scale-name check,
  `_trackIndex`, never-dispatched `presetSaved`/`presetLoaded` and
  `pitchperfect:gridToggle` subscriptions, `MelodyEngine` (unused wrapper,
  all-stub BPM/speed API) and the inert Speed select on the Compose bar.

### Fixed

- **PR Gate no longer dies on whitespace in files a PR never touched.**
  The gate runs `git diff --check base..merge` under `set -e`, and the
  `pull_request` payload's `base.sha` is the base tip at PR creation —
  stale. Any PR opened before the vendored Gradle wrapper landed diffed a
  range containing `apps/beside-cue/android/gradlew.bat`, whose 94 CRLF
  lines each read as trailing whitespace, so the gate failed in 21 seconds
  under an `UNKNOWN STEP` label. Fixed with a `.gitattributes` opting
  `*.bat` out of whitespace checks plus the only two genuine nits in the
  whole `v0.7.22..HEAD` range (a trailing space in beside-cue's
  `build.gradle`, a blank line at EOF in a spec doc).

- **Five guided-tour steps spotlighted nothing.** Home's "Your week at a
  glance" targeted `.home-progress`, a card deleted when this week's
  numbers folded into the streak card; its sentence moved into "Keep your
  streak". The Leaderboard's last four steps target board-view elements,
  but the page now opens on League where none of them render — they now
  `navigate` to Global first. The podium and full-table steps additionally
  need a cloud-populated board, which a `build:tours` bundle never has, so
  `walk-tours.mjs` records those two as reasoned skips (the same exclusion
  the Karaoke mixer tour already has). Desktop and mobile walks: 0 misses.

- **Session export/import was rebuilt around a validating codec**
  (`src/db/services/session-archive-codec.ts`, `session-export-service.ts`,
  merged to main as `4e307666` + `023ffbc0`). The bug it closes:
  `prepareSessionFilesForZip` looped a hardcoded `['vocal', 'instrumental']`,
  so a `bandSplit` session exported without drums, bass, guitar, piano or
  other — nothing threw, the cards were simply absent after a re-import.
  The replacement is broader than the fix: `SessionExportStemType` is
  `Exclude<UvrStemType, 'original'>` so 'original' cannot be written as a stem
  by construction; `listSessionExportStems` reads IndexedDB in a deterministic
  order because part stems are never copied into `outputs`;
  `isSessionExportStem` gates every name arriving from an untrusted archive;
  `sanitizeArchiveEntryName` strips traversal and control characters from ZIP
  entry names; and a session with no restorable core stem is refused rather
  than exported empty. Stem selection is per session, so a batch of classic
  and full-band sessions intersects instead of failing whole.

  NOTE for this branch: an independent narrower fix for the same defect was
  written here first (`listStemTypes` + an import allowlist, four tests) and
  was DROPPED during the rebase rather than merged — every one of its
  assertions is covered by the main-side tests, and keeping both would have
  meant two implementations of one rule. Recorded because the branch history
  shows the commit and its absence should not read as an oversight.

- **New migrations 0018 and 0019** (`premium_background_studio`,
  `supporter_feature_perks`) take the chain from 17 files to 20 (0016 is used
  twice — `demo_song` and `user_suspension` — which is fine, wrangler orders
  lexicographically, but it means file count and migration number no longer
  agree). Both land on `DB`; `PERKS_DB` is untouched by them. The prod
  reconcile verification recorded earlier in this release was done against the
  17-file chain and must be re-run before tagging.

- **New R2 binding `PREMIUM_BACKGROUNDS_BUCKET`** in
  `workers/db-worker/wrangler.jsonc` for all three environments; prod points at
  `mercurypitch-premium-backgrounds-prod`. A deploy against a bucket that does
  not exist fails at bind time, so its existence is a pre-tag check, not a
  post-tag discovery.

- **`STARTING_FREEZES` was never granted to a real account**
  (`src/db/services/streak-service.ts`): `streakFieldsOf` spelled the grant
  `p?.streakFreezes ?? STARTING_FREEZES`, but `userProfiles.streakFreezes` is
  `INTEGER NOT NULL DEFAULT 0` — every stored profile therefore holds a
  literal `0`, and `0 ?? 2` is `0`. The default only ever fired for
  `streakFieldsOf(undefined)`, which is exactly the case the unit test
  asserted, so the test passed while no account on dev or prod had ever
  received a freeze. The grant moved into `accrueFreezes`' null-anchor branch,
  where it is a one-time opening balance: it fires only when
  `lastFreezeEarnedDate` is unset (so it cannot repeat), is skipped when
  `lastFreezeUsedDate` is set (so it cannot re-gift to someone who already
  spent theirs), and uses `Math.max` (so it cannot claw back a larger balance
  earned by accrual). `streakFieldsOf` now mirrors the column default with
  `?? 0`. Four tests cover the four cases; the base fixture is anchored at a
  date so the opening balance is not silently seeded into every other test.
  Existing accounts self-heal on next read, which makes
  `scripts/grant-starting-freezes.sql` redundant.
- **Freeze pips were unreadable** (`src/pages/HomePage.tsx`, `.module.css`):
  held and unheld differed by colour alone (`--accent` vs `--border`), so
  three empty sockets read as three banked freezes — the owner reported the
  honest "no freezes left" warning as the bug because of it. The count is now
  stated numerically, a held freeze is a lit disc (white plus a glow, with the
  accent substituted under `[data-theme='light']` where white would vanish),
  and an unheld one is a dashed empty socket. Shape carries the reading;
  colour reinforces it.
- **Circular chunk `vendor -> pitch-core -> vendor`** (`vite.config.ts`):
  `manualChunks` had no rule for Vite's own virtual modules, so
  `vite/preload-helper` — the module that defines `__vitePreload`, and
  which every chunk containing a dynamic import therefore imports — fell
  through to `pitch-core`. `pitch-core` imports `vendor` for real, closing
  the cycle. Rollup emits both halves of a cycle rather than failing, and
  the failure mode is the one already recorded in `MISTAKES.md`: a
  production build that dies at first paint on "Cannot access 'X' before
  initialization", invisible to `pnpm check` and to dev. Virtual Vite
  helpers now get their own `vite-helpers` chunk, placed above every other
  rule; it imports nothing, so nothing can point back through it.
  Verified on the built output: `vite-helpers-*.js` (1.8K) has no imports,
  `vendor-*.js` imports only `vite-helpers`, and the warning is gone.

- **Piano-roll viewport** (`piano-roll.ts`, `PianoRollEditor.css`): grid/ruler
  canvases were sized to the whole song — a 267-bar import is 51,240 CSS px =
  ~102,480 device px at DPR 2, past Chrome's 65,535 dimension cap, so the
  canvas silently failed to allocate (blank grid). `.roll-grid-container` also
  had **no CSS rule anywhere**, so it was never a scroll container: every
  `scrollLeft` write was a no-op and the ruler's `translateX` sync never fired.
  Canvases are now viewport-sized and positioned at the scroll offset inside a
  full-width spacer layer; draws shift into content space via one
  `ctx.translate(-scrollX)` (so existing `beat * beatWidth` math is unchanged)
  and pointer handlers add the offset back. Grid lines, note blocks and preview
  notes cull to the visible window; the ruler no longer draws twice per frame;
  the ball playhead (viewport-sized but drawn in song space, hence invisible
  past one viewport) takes the same shift and clears in CSS px. New
  `MAX_CANVAS_PX` DPR clamp makes over-allocation impossible to reintroduce.
  Navigation: `goToBar`/`pageView` + a bar box in the View group, and
  `followPlayhead` (recording forward-only, playback re-centres).
- **Row auto-fit** (`_fitRowsToMelody`): the old auto-grow raised the octave
  COUNT but never moved the window's bottom octave, so imports reaching below
  the start octave rendered hatched off-grid. Now derives start + count from
  `melodyMidiRange`, and only fires when notes would actually be off-grid so
  melodies that already fit keep the user's rows. (Note: this brings effect
  notes on-scale that previously drew as off-scale blocks, which is why the
  playback test's canvas mock needed `bezierCurveTo`.)
- **Melody identity**: `SheetMusicView` gains a `melodyName` prop (key/scale
  demoted to the kicker; `.scoreTitleName` opts out of `text-transform:
capitalize`), passed at all three call sites; Compose header gains an
  identity row inside a new `.editorLeft` column-1 wrapper so `.composeToolbar`
  keeps exactly three grid children and `data-tour="compose.editor"` stays on
  the tablist.
- **Tempo on load** (pre-existing, not a regression — `git log -S setBpm`
  confirms the loader never had it): `handleSingingSongLoaded` wrote
  `bpm: songBpm` onto the MelodyData but never called `setBpm`, so the
  transport kept its previous/default BPM while the notes came from a song
  written at another tempo. (The sidebar's `loadAndPlayMelodyForSession` and
  `useSessionSequencer` both _do_ apply it — only the Songs picker / import
  path didn't.) Both branches now apply it. Additionally
  `importMelodyFromMIDI` skips all meta events, so Compose's own import
  discarded the file's tempo entirely: new `readMidiTempoBpm(data)` scans for
  the Set Tempo meta (0xFF 0x51, µs/quarter) with a 20-400 BPM sanity gate,
  wired through a new `onTempoImport` editor option and the file-menu import.
- **Import naming**: new `melodyStore.loadImportedMelody(items, name, extra)`
  reuses a same-named melody or creates one, replacing `setMelody` in the
  Compose MIDI import (`useEditorController`), the roll toolbar's import (new
  `onMelodyImport` option → `PianoRollCanvas` → App) and shared-link import,
  all of which previously kept the _current_ melody's name.

- Piano-roll bug sweep (`src/lib/piano-roll.ts`): zoom applied twice to the
  canvas width (and `fitToView` both double-zoomed and subtracted the piano
  column from a viewport that never contained it); `destroy()` leaked every
  document/window listener — editors stacked per tab switch (now one
  `AbortController` severs all, with a regression test); `Ctrl+A/Z/±`
  intercepted before the `isTyping` guard, hijacking text inputs app-wide;
  left column mis-sized on HiDPI (`style.width` never pinned); ball playhead
  dead after the first Stop; multi-note resize collapsed every selected note
  onto one end beat (now anchor-delta per note); resize/placement/drag snap
  now follows note length down to 0.25 so 1/16 notes are usable; stopped-state
  click at x<10 seeked instead of placing; `_rebuildScale` read the never-set
  `window.pitchPerfectApp.key` (rebuilds silently reverted to C) — key/octave
  now sync from every store scale push; pitch-track `ctx.scale(dpr)`
  compounded across resizes; grid-toggle button and settings signal could
  disagree (toolbar now round-trips the persisted setting); status-bar note
  count refreshed only on Bars±; library saves debounced (was a full-library
  `JSON.stringify` + localStorage write per drag mousemove) with flush on
  hide/unload; "Melody saved!" toast spam removed.
- `roll-toolbar-disabled` finally has CSS — browse-mode "disabled" toolbar
  groups were fully interactive.

- Pitch scoring filters to pitch targets, or a hiss counts as a missed note;
  the blend collapses to the old number when nothing is unpitched, pinned by a
  test. The gap-marker dedupe was collapsing every frame of a hiss into one
  silent point, because a hiss is unpitched.
- `use-warmup-controller` deleted: reference playback is replaced by the Zen
  stage sounding each target as the playhead reaches it, and window scoring by
  the run scorer. A step that finalizes without a score (the breathing cycle)
  is left out of the average rather than counted as a zero.
- Siren (`use-siren-controller.ts`): a counted `READY` phase (3s, `READY_SEC`)
  replaces a 400ms gap and a 600ms inter-round rest. `sirenGuideMidi(from, to,
sinceGlideStart)` is extracted and unit-tested — the guide dot was phased off
  `elapsedMs`, so its position when the window opened depended on how long
  everything before it had taken. Phase numbers were bare literals compared
  across two files; now `SIREN_PHASE_LISTEN|GLIDE|READY`.

- Community (`vocal-analysis.css`): omitted from the
  `height: 100%; overflow-y: auto` rule Challenges and Leaderboard share, so it
  rendered as an inset inner scroller. The ~600px dead band was a second bug —
  an older rule turns the header into a column, at which point
  `flex: 1 1 320px` stops being a width basis and becomes a height one.
- `UvrPanel.tsx`: the `header-actions` block renders into the mobile kit's
  `OptionsSheet` below the breakpoint, behind one `data-testid`ed button.
  Guide, Settings and the credits hint close the sheet first, so a phone never
  stacks two dismissible layers.
- `JamPanel.tsx`: the picker was an absolutely-positioned popover inside an
  `overflow: hidden` column — not the iOS `<select>` bug, there is no
  `<select>`. Extracted to `pickerBody()` and rendered into a `Sheet` when
  `isNarrow()`; the tap-outside handler early-returns on narrow so the sheet's
  own backdrop owns dismissal.
- The three new viewport branches use `isNarrow`
  (`(max-width: 768px)`), not `isMobile`
  (`(max-width: 768px), (pointer: coarse)`) — a touchscreen laptop would have
  been given the phone layout while every CSS rule beside it stayed on the desk
  one.
- `RoutineRibbon.module.css`: the mobile one-row block puts the `1 0 100%`
  basis on `.nextRow`, not `.next` — the auto-continue work wrapped the button
  with Stay and the opt-out, so the wrapper is the ribbon's flex child now.
- `AuthModal.module.css`: `100dvh` caps plus a `max-height: 700px` block for a
  phone with the keyboard up. Measured: the modal does NOT overflow at 390x664
  (sign-in 419px, register 489px) — what looked cut off was the flow's own CTA
  under Safari's bar, which is the `100dvh` + safe-area fix in
  `onboarding.module.css`.

## [0.7.23] - 2026-07-31

### Added

- **Weekly leagues** (#361): seven seeded rungs (`l1`–`l7`, `l7` flagged
  `isMystery`) with per-rung trophy + enamel-badge art in `public/leagues/`;
  server-side points engine (`league-points.ts`, config-driven via the
  single-row `leaguePointsConfig` table: exercise/challenge/weekly bases,
  score bonus, daily-variety, once-per-day goal-met, streak milestones);
  awards hook `handleCreate` on `source`-carrying sessionRecords and
  `handleUpdate` on streak raises; weekly promotion/relegation cut
  (`league-cut.ts`, pure + tested) runs off the existing 6-hourly cron with a
  `leagueMeta.lastCutWeekStart` once-per-week guard; `/api/league/me` returns
  `{eligible:false}` for anonymous users and never 500s on a pre-league DB.
  Client: Duolingo-style League tab — trophy rail (current rung spotlit,
  auto-centered, sideways-scroll on phones), typographic hero, standings cut
  into promotion/safe/relegation zones with labelled dividers.
- **Friend codes** (#361): `userProfiles.friendCode` (Crockford base32,
  I/L/O/U-free), add-by-code endpoint gated to registered accounts, friends
  leaderboard view.
- **Account erasure** (#361): `DELETE /api/auth/me` removes the user's rows
  across all cloud tables; client type-to-confirm modal, local identity reset
  (`resetUserId()` + token clear) after deletion.
- **Dev league seeder** (#361): `pnpm dev:seed` populates a LOCAL-only D1
  cast across rungs (l3 sized so zone dividers actually render); batches all
  writes into one `wrangler d1 execute` call and refuses up front when the
  dev worker holds the sqlite lock.

### Changed

- **Anonymous identities provision lazily** (#361): `restoreAuth()` (silent
  resume) split from `requireAuth()` (provision-on-first-write); page loads
  no longer mint cloud users. `findOwnProfile` lost its cloud-mode `findAll`
  fallback that could return a stranger's profile.
- **Leaderboards rank fixed tasks only** (#361): sessionRecords carry
  `source` ('practice' | 'exercise' | 'challenge' | 'weekly'); ranking,
  publication opt-in (`leaderboardOptIn` + display name), registered-only
  eligibility and the sticky `longestStreak` threshold are driven by the new
  `leaderboardConfig` row. Streak category is friends-only (400 otherwise).
- **Tracked D1 migrations replace schema.sql** (#361): numbered files in
  `workers/db-worker/migrations/` (0001 = old schema verbatim, no-op on
  existing DBs) applied via `wrangler d1 migrations apply` in deploy-db.yml
  before the worker deploy; `schema.sql` and the ad-hoc
  `scripts/migrate-*.sql` are deleted. Every `d1_databases` block carries
  `migrations_dir`.

## [0.7.18] - 2026-07-19

### Changed

- **Karaoke Night "demo" → "opener" copy** (#285): the ready-to-sing track on `/karaoke-night` is user-facing framed as "Tonight's opener" with a **Sing this song** CTA instead of "Sing the demo" / "Demo mix" — "demo" wrongly implied reduced functionality on a page the vocal-remover ad traffic lands on (Campaign E lost 16% of impressions to Ad Rank, higher than A/B/C — message-match matters). Copy-only in `src/features/karaoke-night/KaraokeNightApp.tsx` + one comment in `main.tsx`; the internal funnel event names (`karaoke_demo_start`/`karaoke_demo_complete`) and the `kn-card--demo` CSS class are unchanged. Pairs with the live Campaign E RSA description reword ("Try the demo mix." → ready-to-sing wording).

## [0.7.17] - 2026-07-19

### Added

- **`karaoke_song_staged` Google Ads conversion** (#280): Campaign E (Karaoke Any Song, Max Clicks) buys vocal-remover search intent ("remove vocals from song", "voice isolator") — and the first-party funnel shows that traffic brings its OWN song (`karaoke_song_staged` 6 visitors / 29 events) far more than it plays the sing-along demo (`karaoke_demo_complete` 2 events, both internal testing). So `karaoke_demo_complete` was the wrong bid goal for E. Created a new secondary Ads conversion action `karaoke_song_staged` (id `7690367223`, `send_to=AW-18321142458/yMwyCPfhhtMcELrlmaBE`, DEFAULT / secondary / ONE_PER_CLICK — kept out of the account-default goal so it can't pollute A/B/C's `mirror_complete` optimization) and wired it in `src/lib/consent.ts` (`AD_CONVERSIONS`) + `src/features/karaoke-night/funnel.ts`. New `fireAdConversionOncePerDevice` guard: `karaoke_song_staged` beacons on every stage for a rich first-party count, but its Ads conversion fires at most once per device (localStorage `kn.funnel.adSent.*`; Ads' ONE_PER_CLICK dedups per click regardless). Inert until a prod build ships the tag (`VITE_GOOGLE_ADS_TAG_ID`). Next: once E banks ~15 of these, switch E from Max Clicks → Maximize Conversions with a campaign-level goal on `karaoke_song_staged`. Conversion map + campaign playbook updated in the campaigns repo / dotfiles.

## [0.7.16] - 2026-07-19

### Added

- **Pitch compare engine** (#275): `src/lib/pitch-compare-engine.ts` — pure frame-driven mic-vs-reference scoring core. Octave-agnostic cents folding (`foldCentsToOctave`, [-600,600]); ~130ms reference-stability grace re-armed on >1-semitone moves (covers transition latency + onset scrapes); reference segments ≥150ms become melody notes with hit/miss verdicts (hit = ≥50% of judged frames in tolerance; unsung notes count as misses; sub-150ms blips never judge anyone); `mark()`/`pointsSinceMark()` scope loop iterations. 15 unit tests.
- **HQ re-run from the session card** (#274): completed browser-processed sessions get an amber HQ menu — upgrade in place (stamps `processingMode: 'server'` BEFORE the job so mid-run reloads re-attach via `handleResumeServer`; drops the stale cached pitch analysis) or spawn a sibling session (same fileHash) for A/B. Feeds the original from IndexedDB; gated on auth, single-running-job, stored original, and `SERVER_MAX_UPLOAD_BYTES`.
- **Download original** (#274): result-card button returning the exact uploaded mix from `getOriginalFileBlob` (persisted since the retry-path feature, never pruned).
- **Auto pitch detection** (#272): 'auto' default in the stem-mixer analysis panel runs YIN and MPM over the same frames and keeps the run with more cleaned-note coverage (YIN returned 2.3s of pitch across the loud final 100s of the reference track; MPM tracked 56.7s).
- **`useConfirm` + `confirmIcon`** (#274): controller hook driving one `ConfirmDialog` from many call sites; dialog accepts a non-delete icon (AlertTriangle added).
- **Canvas size sync** (#276): `src/lib/canvas-size-sync.ts` — CSS owns canvas layout size, JS only maintains device-pixel backing stores; zero-size measures skipped; legacy inline pins self-heal; rAF-coalesced redraw scheduler; re-arming devicePixelRatio watcher. 11 unit tests.

### Changed

- **Mic scoring semantics** (#275): comparison judged by the engine (octave-agnostic, transition-graced); per-run scores (Stop materializes the modal then clears); loop metrics bar shows the current iteration only; stem AND mic RAF detection pass through a 3-tap median + shared octave corrector (reset on play/seek/stop + 250ms silence); canvas diff bars use folded cents and default OFF behind a persisted 'Diff Bars' toolbar toggle; score modal redesigned (karaoke-summary gradient card + Voice Mirror pills: grade medallion, verdict, large accuracy, melody-notes-hit pill) and labels frames honestly as samples.
- **Word-note alignment source priority** (#272): word-timed LRC (taps / enhanced LRC) > whisper > line-timed LRC; word windows capped at 2× syllable-estimated sung duration; untimed lines laid out by syllable weight (15%→83% words mapped on the Dear Hunter reference session).
- **Perceptual volume** (#272): `sliderToGain(p)=p²` applied at every GainNode write (stem strips, source creation, mic monitor); slider position stays stored.
- **Native dialogs migrated** (#274): StemMixer paste-overwrite + auto word-sync, SessionLibraryModal delete, LibraryModal melody/playlist deletes → styled ConfirmDialog; melody-library e2e drives the modal (cancel path asserted).

### Fixed

- **Worker-first routing for /api/\* + mirror host**: Cloudflare's asset layer with `not_found_handling: single-page-application` answers every path not in `assets.run_worker_first` WITHOUT invoking the Worker — `POST /api/uvr/process` died as an empty-body 405 (server separation broken with a blank error), `GET /api/*` returned cached index.html, and `mirror.mercurypitch.com` served the SPA shell instead of mirror.html. `run_worker_first` now lists `/api/*` and `/` alongside the glass aliases. Client hardening: `uvr-api` names the HTTP status when an error response has no body (HTTP/2 has no statusText).
- **Stem-mixer canvas staleness** (#276): `syncCanvasSizes` pinned inline pixel width/height, overriding `.sm-canvas { width:100% }` and silencing the ResizeObserver — canvases froze at first measure across sidebar/layout/zoom/HMR changes. Observers now follow Show-block canvas swaps; DPR changes resync.

## [0.7.15] - 2026-07-19

### Fixed

- **Stripe webhook outage recovery + self-healing billing** (#273): PR #219's custom-domain routes implicitly disabled the db-worker's workers.dev hosts, 404ing BOTH Stripe webhook endpoints (live + test) from 2026-07-08 — paid checkouts stopped granting credits (webhook is the sole credit writer). Endpoints repointed to `api[-dev].mercurypitch.com`; missed grants restored idempotently (`evt:<id>` ledger keys; the pending live event pre-marked in `billingEvents` so redelivery can't double-credit).
- **Webhook idempotency ordering** (#273): `billingEvents` is recorded AFTER the grant instead of before — previously a mid-grant failure (500) made Stripe's retry read as "duplicate" and the credits were permanently lost. Concurrent double delivery stays safe via the ledger's UNIQUE idempotencyKey.

### Added

- **Billing reconciliation cron** (#273): `reconcileBilling` (db-worker `scheduled`, `17 */6 * * *`, all envs) sweeps Stripe's last 30 days of `checkout.session.completed` and processes any event `billingEvents` has never seen through the exact webhook grant path; emails `BILLING_ALERT_EMAIL` (new optional secret) on every recovery — a recovery means webhook delivery is broken. Verified locally: first sweep recovered all 4 historical test-mode events, second recovered 0.
- **Post-checkout grant watch** (#273): `stashExpectedCredits`/`takeExpectedCredits` (sessionStorage, 2h TTL, one-shot) capture `balanceBefore + credits` at buy time; on `#/billing/success` `waitForCreditGrant` polls `/api/billing/me` (~90s schedule, `GRANT_POLL_DELAYS_MS`) bumping `balanceVersion` each pass — confirming "Credits added" or explicitly warning with the support address on timeout (15s toast via new `showNotification` `durationMs` option, `billing-return` channel). Unit-tested (stash round-trip/TTL/malformed; watch success/timeout/null-backend).
- **workers_dev pinned off** (#273): explicit `workers_dev: false` + warning comment in `workers/db-worker/wrangler.jsonc` (top-level and both envs) — nothing may ever point at workers.dev hosts again.

## [0.7.13] - 2026-07-17

### Added

- **Zen mobile karaoke stage** (#265): `KaraokeMobileStage` replaces the mixer tree on phone-width viewports (`isNarrow` gate, performance preset only) — Portal-mounted on `<body>` (a filtered ancestor was capturing `position:fixed`), `100dvh` sizing + body-scroll lock, safe-area padding, auto-centering lyrics with word-level gradient sweep, tap-to-seek, scrubber + transport bottom bar, collapsible vocal pill (tap = mute via `toggleMute('Vocal')`, drag = `setTrackVolume`, pointercancel-safe, keyboard-activatable), in-stage song sheet (uvr-store library + playlist start, hydration via `KaraokeStageHost.pickSession`). Demo staging passes `autoPlay` through `KaraokeSong`.
- **Auto word-sync v1** (#265): `src/lib/vocal-onsets.ts` (log-energy flux onset detection on the vocal stem, no model) + `src/lib/word-sync.ts` (syllable-weighted layout, onset snapping, strict monotonic within-span clamping; unit-tested) + `applyAutoWordSync` in the lyrics controller persisting word-level LRC through the gen-finish path. Button in the Fixed/Grid lyrics headers with an overwrite confirm. Research + roadmap in `docs/plans/lyrics-word-sync.md`.
- **Highlight algorithm** (#265): `computeActiveWord` caps a word's sweep at its syllable-estimated sung duration (150ms floor), then dwells fully lit — held notes/rests no longer smear; returns continuous `fraction` for gradient renderers. Gen-mode taps subtract 180ms audio→motor latency (`TAP_LATENCY_SEC` const, calibration UI later).
- **iOS audio unlock** (#265): `src/lib/audio-unlock.ts` — synthesized-silent-clip session promotion past the ring/silent switch (ambient→playback), gesture-scoped `resume()`, visibilitychange re-resume; installed by the audio controller and the karaoke entry.
- **Email verification (soft gate)** (#265): `emailVerifications` table (hash-stored single-use 24h tokens; `scripts/migrate-add-emailVerifications.sql`), verify/resend endpoints (rate-limited, `#everified` redirect mirroring the Google flow), combined verify+welcome email, floating `VerifyEmailBanner` (authStamp-reactive), `karaoke_playlist_start` funnel event allowlisted.
- **Password UX** (#265): policy relaxed to 8+ chars with letter+number (server + `src/lib/password-policy.ts` mirror — browser generators always pass), live `PasswordRequirements` checklist + `aria-invalid` red borders, proper autocomplete attrs; Karaoke Night sign-in modal de-upselled.
- **KN mobile layout + playlists rail** (#265): no-overflow topbar (safe-area, truncating chip), hamburger collapsed rail, playlists card (`startPlaylist` one-tap), focus-mode transport restyled to the ControlOverlay glass recipe + focus toggle beside the stage-transparency slider, "our servers" copy sweep.

### Fixed

- Word-boundary black flash (transition-vs-class-swap on the gradient sweep), restart now glides the lyrics sheet to top (idx<0 handling + explicit scroll), demo stems CORS on LAN/https origins (mercury-pitch-models bucket → wildcard GET/HEAD), `snapToOnsets` strict monotonicity when capped at line end.
- **KN rail**: `uploadSessionId`/`uploadError` hoisted to module scope — collapsing the rail unmounts the component and dropped a running separation's progress UI (the pipeline itself lives in the store). Library rows: on-stage accent + animated equalizer, count pill in the kicker, click stages with `autoPlay` (explicit picks only — the background auto-open stays silent); sheet picks autoplay too. Credits chip: label/style follow the STORED mode and it is never disabled — out-of-credits used to show the effective fallback label while disabling the very toggle the warning told users to click.

## [0.7.12] - 2026-07-16

### Added

- **Karaoke Night standalone entry** (#259, #261, #262): `karaoke.html` as a second Vite entry served at `/karaoke-night` (+ `/karaoke` alias, both emitted as real HTML files per the SPA-fallback-beats-worker lesson from #250). Theatre backdrop (generated still + plum scrim), stage-glass transparency (one `--kn-alpha` variable drives `--bg-primary/secondary/tertiary`, `--sm-canvas-bg` and the opaque `--on-accent` ink token), StemMixer `preset='performance'` (big centered 2.4rem lyrics, page-local layout/alignment prefs, no edit/analysis/tour chrome, whisper init skipped), demo-song manifest `public/karaoke-demo-song.json` (CC BY 4.0 stems + word-synced LRC on the public R2 bucket; seed-once lyrics under a stable session id), guest local-ONNX upload with warming/percent/queued progress states + cancel, collapsible icon rail, account sign-in chip + modal (direct `auth-service`: password + Google — `returnTo` round-trips the page; `consumeGoogleRedirect()` at boot), signed-in server-mode toggle with live credit balance (shared `setUvrProcessingMode` pref), and studio links: a UvrPanel-header Karaoke Night view-tab (new `StageCurtains` icon) plus per-playlist stage buttons → `/karaoke-night?playlist=<id>`, consumed at boot by the always-mounted `KaraokeNightRuntime`.
- **uvr-store extraction + StemMixer decoupling** (#259): the whole UVR domain (settings, model status, session/group caches, persistence) moved from `app-store` into `src/stores/uvr-store.ts` (app-store re-exports for back-compat); StemMixer's tour became an injected `onOfferTour` prop; the karaoke playlist runner + session hydration extracted to `features/stem-mixer/karaoke-playlist-runner.ts`, shared by UvrPanel and the night page.

### Fixed

- **Playlist song-skip race** (#260): the playback RAF end-detector treated `elapsedTime >= duration()` as a natural end while `duration()` was still `0` (stems not yet decoded), instantly "finishing" freshly armed playlist songs. End detection now short-circuits at zero duration and the playlist play effect waits for a real duration.
- **Standalone entries statically dragged ~2.7 MB** (#259): `lib/legal-links` co-located into the `advanced` chunk made ConsentBanner pull `advanced → library → vendor` into BOTH the mirror (the live ad landing page) and karaoke first paints. Shared leaf modules (legal-links, storage, analytics, consent, notifications-store, auth/user/billing services) are pinned to the `pitch-core` chunk — mirror 145 KB, karaoke 90 KB static JS.
- **Studio theme regressions caught in review** (#259): accent-control ink switched to `var(--on-accent)` (defaults to `var(--bg-primary)`, so every theme renders as before; the night page overrides it opaque), and canvases paint via `--sm-canvas-bg` (opaque dark in the studio across all themes, translucent on the night page).
- **Mixer tour vs. workspace layouts** (#259): several `mixer.*` targets exist only in the fixed-2col workspace; the tour now navigates to it up front via a `mixer.layout-fixed` hook.
- Firefox scrollbars (`scrollbar-width`/`scrollbar-color` — the app only styled `::-webkit-scrollbar`), karaoke focus-mode chrome moved from app.css into `mixer-shared.css` (loaded by both entries, specificity-hardened), Karaoke Night topbar baseline alignment (#262).

## [0.6.8] - 2026-07-08

### Changed

- **Branded OAuth domain** (#219, #220): the db-worker now serves on dedicated custom subdomains — `api.mercurypitch.com` (prod) / `api-dev.mercurypitch.com` (dev) — via wrangler `custom_domain` routes (auto-created on deploy), alongside the existing workers.dev URLs. A dedicated host avoids shadowing the main worker's `/api/uvr/*` + `/api/share/*`. `VITE_API_BASE_URL` points the frontend at them, so the Google consent screen + the OAuth `redirect_uri` (derived from the request origin, no `auth.ts` change) show a `mercurypitch.com` host instead of `komediruzecki-2015.workers.dev`. No session loss — auth is a client-side Bearer JWT, not a worker-domain cookie.

### Fixed

- **Transactional emails render dark-only** (#218): the purchase thank-you + signup welcome `<head>` declared `color-scheme` / `supported-color-schemes` as `"dark light"`, so a light-mode client tried a light rendering and, with no light styles, fell back to a white background. Declared `"dark"` only so clients render the dark design regardless of the recipient's mode.

## [0.6.7] - 2026-07-07

### Added

- **Guitar tuner reference tone** (#210): clicking a string button in `GuitarTuner` now plays that string's target pitch via a new optional `onPlayNote` prop, wired from `GuitarPage` to `audioEngine.previewNote(freq, 900)` (short, reduced-gain preview) — tune by ear alongside the needle. Still toggles the manual per-string target.

### Changed

- **Singing A-B loop: loop-on-B + draggable markers** (#212): `handleSetLoopB` now arms the loop immediately (`setLoopEnabled(true)` + clears the escape flag), matching the stem-mixer. `SingingStatusBar` gains draggable A/B markers on the seek rail — pointer-capture drag, a 0.25-beat min-gap clamp via new `handleMoveLoopA/B` in `App.tsx`, and a one-shot guard so a drag's pointer-up doesn't also seek. A reads `--accent` (blue), B reads `--red`, on both the markers and the control-bar `IconLoopPoint` buttons (`.loopBtnB`). Reuses the existing `ab-loop` math + RAF seek-back unchanged.
- **Welcome / changelog / sidebar polish** (#205, #206): compacted first-run welcome (Voice Mirror-first, mirror-before-consent, 50/50 mobile actions, version pill → the What's New modal), branded `ChangelogModal` restyle, sidebar Playback Setup collapsed by default, smaller 3D next-note target ring, round tour-dots fix, `.getStartedBtn` hover on the settings "Getting started" buttons, two-tone email wordmark + colourful sign-up cards. Version bump to 0.6.7.

### Fixed

- **Track switch preserves the playhead + transport** (#208): switching the scored track of an imported multi-track MIDI ran the full load path (`stopGame` / `setPlayheadBeat(0)`), rewinding to 0:00 and stalling the play button. New `changeScoreTrack()` on the guitar and piano (falling-notes) controllers rebuilds the notes/backing and resets the score but keeps the playhead + transport (keeps playing if playing; Play/Space resume from the current beat; notes before the playhead are marked passed so they don't all fire at once). The shared song picker gains an `onScoreTrackChange` hand-off (falls back to `onSongLoaded`).
- **Local/WebGPU separation retry no longer crashes when Cloud mode is active** (#209): `getSeparator()`'s `setUvrModelStatus('loading')` write synchronously re-ran `UvrPanel`'s server-mode cleanup effect (it read `uvrModelStatus()`), which called `destroyPipeline()` and nulled the module `separator` mid-init → "can't access property initialize, … is null". Gated that effect on the mode signal only (`on(uvrProcessingMode)` + `untrack` for the status), hardened `getSeparator` to hold a local reference across the store writes, and added `humanizeProcessingError` so no raw JS crash reaches a session card.
- **Singing song-change refreshes the canvas + timeline** (#215): `handleSingingSongLoaded` now calls `resetPlaybackState()` before loading the new melody. While playing/paused the playback controller holds a _frozen_ `playbackDisplayMelody` / `playbackDisplayBeats` for the in-progress run (its auto-clear effect only fires when stopped), so switching songs mid/after a run — e.g. during A-B loop testing — left the previous song frozen on the canvas + timeline. Also clears the old A-B loop, whose beats belonged to the previous song.
- **Focus mode scrolls instead of squishing long songs** (#215): `FocusMode` passed `isScrolling={() => false}` to `PitchCanvas`, forcing the fit-whole-song `beatToX` branch (divide by the whole range, not the visible window); now `true`, so short melodies still render whole (`rangeBeats <= visibleBeatWindow`) but long songs scroll a fixed window like normal mode.
- **e2e** (#213): expand the (now collapsed-by-default) sidebar Playback Setup section before asserting on its scale controls — new idempotent `openPlaybackSetup` helper; fixes 6 specs across `app` / `critical-flows` / `css-audit`.

## [0.6.6] - 2026-07-07

### Added

- **A-B loop on the Singing tab** (#200): mark A then B on the melody and loop that section. The loop math is extracted to a pure, unit-tested `src/lib/ab-loop.ts` (`shouldLoopBack`, `isSeekOutsideLoop`, `loopRegionPct`, `clampLoopB`) mirroring the stem-mixer's half-open `[A, B)` semantics and its `seekedOutsideLoop` escape flag — so a manual seek past B is no longer instantly reverted. `App.tsx` owns the signals + the auto-seek-back effect (gated on `beat < totalBeats()` to avoid racing the runtime's natural-end); `SingingStatusBar` draws a reactive loop-region overlay (no stale IIFE); `SingingControlBar` reuses the existing `IconRepeat` for the toggle and a single consolidated `IconLoopPoint`. `.loopRegionActive` uses `var(--green)` (no hardcoded hex). 21 loop-math tests.
- **Guitar tuner + riff tracker** (#199): `src/lib/guitar/tuner.ts` `classifyPitch(frequency, clarity, targets, names)` classifies against the _selected_ tuning, so presets (Standard / Drop D / Half Step Down / Open G / DADGAD) actually retune instead of only relabeling; the previously-dead `isTuningSignal` ±50-cent gate is wired in so off-string noise can't read "in tune" (manual per-string mode bypasses the gate so a far-off/fresh string still shows deviation). Open G frequencies corrected. `GuitarTuner`/`GuitarRiffTracker` components + a headless `RiffTrackerState` factory (record → timeline → score against a target melody). Riff capture is driven off a new reactive `articulationId` signal on `useGuitarPracticeController` (a lockstep mirror of the non-reactive scoring counter) so repeated same-pitch attacks aren't de-duplicated away by `detectedMidi`. Reuses `frequencyToMidi` / `computeCentsDeviation` / `noteToMidi` (the last now parses flats + multi-digit octaves); glyphs replaced with SVG icons. 33 tuner + riff tests.
- **Transactional emails** (#202): purchase thank-you email + account sign-up welcome email.

### Fixed

- **Server (RunPod) stem separation now survives a reload / iOS app-switch, with no double charge** (#201, #203): the RunPod job id is persisted to IndexedDB, and the client auto-resumes an in-flight job on load / `visibilitychange` / `online` with **no new debit** (`resumeServerSession`, `activeServerPolls` guard). `pollForCompletion` rides through transient failures for a 90s grace window after first contact, and `getProcessStatus` / `getOutputFile` gained per-request timeouts, so a half-open socket can't freeze the poll. A server-confirmed dead job rejects with `TerminalPollError` and clears its persisted id. The worker bridge serves stems straight from R2 (`<RUNPOD_STEM_PREFIX>/<jobId>/`, new per-env var) for the ~24 h the objects live after RunPod forgets the job (~30 min), and returns a terminal "expired" otherwise. Removed the `beforeunload` handler that cancelled in-flight jobs on reload, and stopped `cleanupStaleUvrSessions` from erroring a recoverable session. "Fetch my stems" recovery button + friendlier "warming up" copy. New R2-fallback + terminal-error + reconcile tests.

### Changed

- CI: bump GitHub Actions to Node 24 (#204).

## [0.6.5] - 2026-07-07

### Added

- Voice Mirror results/share card pairs the singer's vocal range with a legendary singer whose range overlaps — two legends per voice type (e.g. tenors get Freddie Mercury or Bruce Dickinson) for a varied match.

### Changed

- Voiceprint download filenames are dated (`voiceprint-YYYY-MM-DD.png`) so a folder sorts by day.

## [0.6.4] - 2026-07-07

### Fixed

- Cloud-separated stems no longer go missing after a reload (#uvr durability): stems are persisted durably to IndexedDB _before_ a session is marked done, always reopened from the local copy, and never depend on the server's temporary links. Added a `beforeunload` guard during the finalize/save window, orphan-DB cleanup + reconcile-on-load, and serialized per-session DB writes; added durability + reconciliation test suites.

### Added

- Storage pre-flight warning before a paid separation. Voice Mirror: "Sing the Universe" cosmic-mode deep link + copy-image button, and a warmer piano-like reference tone with a "your turn" count-in before the Match step. Succinct karaoke upload-rights notice.

## [0.6.3] - 2026-07-06

### Fixed

- Added the missing `og-image.png` so social / Open Graph link previews render the MercuryPitch card.

### Changed

- Removed the header website icon (redundant with the About link).

## [0.6.2] - 2026-07-06

### Added

- New Pitch-orb brand logo (favicon + About icon) and orb favicons. Website link in Settings → About and the header. Canonical Terms & Privacy links at consent touchpoints, pointed at about.mercurypitch.com.

### Changed

- Practice accuracy heatmap scores on absolute cents deviation and is decoupled from the session shape (PR #187 review follow-ups).

## [0.6.1] - 2026-07-06

### Added

- Server-side model registry (#178): `runpod/handler.py` + `uvr-api/api.py` resolve quality-tier names (`roformer` | `mdx` | `karaoke` | `ensemble`) to exact weight files and reject everything else — the old `.onnx`-append logic could not load `.ckpt`/`.yaml` models at all, and the Cloudflare bridge previously forwarded any client `model` string (billable arbitrary-weight downloads). Legacy `UVR-MDX-NET-Inst_HQ_3` maps to `mdx`. Bridge allowlist `RUNPOD_ALLOWED_MODELS` 400s unknown names before submit/debit.
- BS-RoFormer (`model_bs_roformer_ep_317_sdr_12.9755.ckpt`, vocals SDR ~12.9 vs ~10 for MDX) is the server default; MDXC params honor each checkpoint's trained segment size (`override_model_segment_size: false`, `mdxc_overlap` knob). Images: `v0.2.0` bakes all four checkpoints; `v0.2.1` adds the min-duration guard and bakes models before the handler COPY so handler-only edits stop re-downloading ~2.5 GB. audio-separator's built-in ensemble is wired (`ensemble` = BS-RoFormer + Mel-Band Kim, `avg_wave`) but not user-exposed.
- Per-model credit metering: debit carries the job's model; db-worker prices `tier base x multiplier` (billing-core `UVR_MODEL_CREDIT_MULTIPLIERS`), refunds repay the exact ledger delta, `/api/billing/pricing` exposes `uvrModelCredits`, and `fetchPricing` derives the field client-side against backends that predate it (PR previews hit the prod db-worker).
- Settings -> Credits processing picker (#184): the tier cards are the control — real `<button>`s with Selected tag, accent ring and `aria-pressed`; Server (CPU) stays a disabled "coming soon" card. Karaoke's credits pill and Server tooltip read live per-song cost from pricing.

### Changed

- Single server quality at 1 credit per song (#188): the 2026-07-06 apples-to-apples cost runs (same 11-song folder, same v0.2.1 image) measured RoFormer at $0.0054/28.0 s handler avg vs MDX $0.0064/33.5 s — better, faster AND cheaper, so the Basic/HQ selectors were removed, multipliers collapsed to 1x for all user-facing models (`ensemble` keeps 2x), and the `uvrQualityModel` signal was deleted (`runUvrPipeline`'s `model` option remains for future tiers). Roformer ETA divisor tightened to the measured speed (2.5 -> 8x realtime, cap 300 s).
- The Server (GPU) surfaces carry an HQ mark (tier card + Karaoke mode toggle) naming the studio-quality model.

### Fixed

- Handler rejects sub-12 s inputs up front (`UVR_MIN_INPUT_SECONDS`, mirrored in the CPU container): RoFormer processes ~11 s windows and audio-separator 0.44.2 dies mid-separation with an opaque tensor-size error on shorter audio.
- FastAPI status contract: pydantic serialized Optional fields as explicit JSON `null`s that failed the app's zod validation on every container status poll (`response_model_exclude_none` server-side; the client schema now treats null as absent).
- `api.py` read `model`/`output_format`/`cpu_profile` as query params while the app sends multipart form fields — client values were silently ignored (masked while defaults matched). Now `Form()` fields.
- A misrouted `/api/uvr` (e.g. the local vite proxy port occupied by an unrelated service) no longer dumps a whole HTML 404 page into the failure panel — markup bodies get a short actionable message, plain-text bodies are capped.

## [0.6.0] - 2026-07-05

### Added

- Karaoke server-mode enablement (#157): the processing toggle's Server option is live — sends the `X-UVR-Provider: runpod` opt-in from `processAudio`, restores `'server'` from localStorage again, shows a "1 credit / song" hint pill, and turns the metering 402 / auth 401 into actionable messages. Server mode is GPU-only by design: with RunPod unconfigured the worker returns a clear 503 instead of silently falling back to the unmetered CPU container (`rejectUnconfiguredRunpod`).
- Server-job cost guards (#172): the handler probes input duration right after download and rejects songs over `UVR_MAX_INPUT_MINUTES` (default 12) before the expensive separation — the job errors cheaply and the worker auto-refunds; the probe fails open. The upload pill + client validation are mode-aware (100 MB local / 50 MB server).
- Large server uploads via R2 (#173): >7 MB files (the RunPod `/run` inline base64 ceiling) stream from the worker to R2 under `input/<uuid>` via a new per-env `UVR_INPUT_BUCKET` binding and reach the handler as `audio_s3_key`, downloaded with the handler's own S3 creds — the source audio never gets a public URL (key validated traversal-safe; precedence `audio_s3_key` > `audio_url` > `audio_base64`). Hard cap 50 MB (413); ≤7 MB keeps the inline fast path; 1-day R2 lifecycle rules expire staged inputs.
- Settings deep links + credit shortcuts (#174): the Settings sub-tab signal moved into `ui-store` (`openSettingsSection`); `#/settings/{account,practice,credits,display}` parse and sync both ways; checkout returns land on Settings → Credits; billing/auth failures carry a Get credits / Sign in button on both the toast and the persistent failed-session card; upload validation uses app notifications instead of native `alert()`.
- Credit metering for server-side UVR jobs (the `docs/plans/premium.md` "Metering paid jobs" design): db-worker `POST /api/billing/debit` (user JWT; tier cost read from the `pricingPlans` tier rows' `credits` column; the balance check and debit are one atomic conditional INSERT so concurrent jobs can't overdraw; idempotent per `uvr:<rp_<tier>_<id>>` ledger key; 402 `{ required, balance }` when short; no-ops while a tier's cost is unset) and `POST /api/billing/refund` (service-to-service only via `X-Service-Key` = `BILLING_SERVICE_KEY`, constant-time compare; at most one refund per jobRef). Main worker: `src/lib/uvr-metering.ts` — fail-open on transport errors (a billing outage degrades to unmetered jobs), fail-closed on an explicit 402 (cancels the just-submitted RunPod job); refunds fire on error status polls and on DELETE of an unfinished session, but not when deleting a completed one. Dormant in layers: no `DB_API_URL` var → no metering; tier credits NULL/0 → debits no-op; no service key → refunds skipped.
- Stripe checkout return UX: `#/billing/success` / `#/pricing` (the db-worker checkout session's success/cancel URLs) parse as a `billing-return` hash route that lands on Settings → Account with a toast, then cleans the one-shot hash to `#/settings` via `replaceState` so a reload can't re-fire it. New "Your credits" chip in `PricingPanel` fed by `/api/billing/me`, keyed on the new `billing-store` `balanceVersion` signal with staggered refreshes (0/3/10 s) to absorb webhook lag; hidden when logged out or without a cloud API.
- Separated stems keep a sanitized version of the uploaded filename (`_safe_name_stem`: basename-only so `../` dies, S3-key/shell-hostile characters stripped while readable ones survive, 60-char cap, `input` fallback) — output filenames, R2 object keys and user downloads read `<song>_(Vocals)_<model>.flac` instead of the anonymous `input_(Vocals)_…`.
- Shared song-status-bar primitives (`src/components/shared/status-bar/`, `SegmentedControl`, `src/lib/use-file-drop-zone.ts`): a glass strip in normal flow above each practice canvas with the song picker, seek scrubber, compact multi-column track dock and import actions. Replaces the per-page `FallingNotesSongPicker` / `GuitarPracticeSongPicker` / `MidiTrackMixer` / `SingingStatusChip` (all deleted). Guitar's view/sound switches and the sidebar mic-preset rows become `SegmentedControl` pills; the guitar transport becomes a floating dockable `ControlOverlay`. Canvas-wide drag-drop for `.mid`/`.midi` (all three pages) and Guitar Pro (guitar); the whole `useMidiSongPicker` flow gains `importMidiFile` + `skipAutoLoad`.
- Singing scores a chosen MIDI track, not a flatten of all tracks: drop/import opens the track picker (`hideBacking` variant — no backing audio column), the picked track becomes the practice melody, upserted into the melody library by name. The old flatten buried the melody under 10k+ notes and tanked FPS.
- Singing song timeline: the bar's seek rail drives `playbackRuntime.seekTo` while playing/paused; a stopped-state seek is recorded as `pendingStartBeat` and consumed by the next `start()` (mirrors the Piano/Guitar `pendingStartBeat` seek-then-play added earlier this cycle), cleared by `stop()` and song-switch (`clearPendingStart`).
- Polyphonic play-along audio: the piano game moved from the mono `playTone` slot to per-note `playNote` voices (the guitar game already used it); `AudioEngine.playNote` gains a 24-voice steal-oldest cap (`MAX_POLY_VOICES`). Both games flush voices (`stopAllNotes`) on pause/stop/seek/song-load. The `SessionPlayer` green banner folded into the singing status bar (test ids preserved).

### Fixed

- Null-session render crash in the karaoke error card (#174, #175): Delete & New cleared the current-session signal while handlers/render props still read `session()!` — first the handlers (`.sessionId`), then the render props (`.status`) behind a non-reactive `session() && (...)` guard. Handlers capture the session once; both session-prop blocks (`UvrProcessControl`, `UvrResultViewer`) use the `<Show when>` callback form whose accessor stays truthy-narrowed through teardown.
- runpod image: ubuntu 22.04's `python3-pip` targets the distro python 3.10 while the image symlinked `python` → 3.11, so every dependency installed into an interpreter the handler never ran — the model bake failed with `ModuleNotFoundError: audio_separator` on the first real build. Use the distro python consistently via `python -m pip`.
- runpod handler: audio-separator's model architecture snapshots `output_dir`/`output_format` at `load_model()` time, so a warm worker kept writing stems into the eager-load `_init` directory and every job failed with "Separation produced no output stems" despite a clean GPU separation in the logs. Sync the live `model_instance` per job and additionally trust `separate()`'s returned file list.
- Stem classification substring-matched the whole filename, so with real song names preserved a track called e.g. "Vocal Coach.mp3" would tag its instrumental stem as `vocal` — match audio-separator's `_(Stem)_` marker first, substring only as fallback.
- RunPod deploy runbook corrections from the first real GPU deploys (`docs/claude/RUNPOD.md`, `runpod/README.md`): container disk 20 GB (the CUDA + torch image is ~10 GB unpacked; the documented 5–10 GB fails at worker start), pinned version tags instead of `latest` (bumping the tag on the endpoint is the controlled release), endpoint type Queue.
- First tab switch after load escaped audio cleanup: the tab-leave cleanup was a `createEffect(on(activeTab, …, { defer: true }))`, and defer skips the initial run so `on` never recorded a previous input — the first change fired with `prevTab === undefined` and returned early, leaving the previous tab's audio running (e.g. singing playback under the piano tab). Refactored to a synchronous tab-transition listener at the `setActiveTab` choke point in `ui-store` (`onTabTransition`), which cannot miss a transition; `setActiveTab` is now a plain-value setter.
- Status bar occluded canvas HUD (piano score corners, guitar 3D chip, singing accuracy panel): the bar now sits in normal flow above the canvas instead of absolutely overlaying its top edge.
- `PitchCanvas` froze (~1 FPS) on large imports: the ball physics rebuilt the playable-note list every rAF frame (now a `createMemo`), and the note draw loop had no culling (now off-screen-culled, with a flat-fill fast path when the visible window holds >120 notes). ~1 → 60 FPS on a single track.
- Tab revisits clobbered the loaded song (the picker's mount auto-load overrode the app-wide controller — fixed with `skipAutoLoad`); the karaoke upload-zone highlight flickered off mid-drag (enter/leave depth counter, as in `useFileDropZone`); the stems time pill's Clock icon overflowed (24px intrinsic size in a 14px box). Phantom `--fg-primary/-secondary/-tertiary` CSS vars (and `--border-color` family) aliased in `:root`.

## [0.5.3] - 2026-07-02

### Added

- Voice Mirror standalone entry (`mirror.html` + `src/features/mirror/`): a second Vite input with its own tiny Solid tree (~25 kB gzipped incl. solid + pitch-core chunks, no ONNX/model weights, enforced via `manualChunks`). Served at `/mirror`, `/vocal-range-test`, `/tone-deaf-test` and the `mirror.*` subdomain root by the worker, with a matching dev/preview rewrite plugin in `vite.config.ts`.
- Pure metrics core (`src/lib/mirror/metrics.ts`, synthetic-track tests): §3 preprocessing (confidence gate, gap-aware 5-frame median filter, MIDI-cents), semitone-bin range with 150 ms dwell + percentile guard rails (±1 semitone margin), octave-folded match scoring with 150 ms/3-frame lock and post-lock windows, OLS drift + detrended wobble, onset/scoop (§4.4), vibrato via the existing `vocal-analyzer` FFT detector with sinusoid-variance exclusion from wobble (v1.1).
- Session reducer (`src/lib/mirror/session.ts`): pure guided-flow state machine (idle → mic → glides → hold → match×5 → results) with range-relative target picking and one free retry on unvoiced takes.
- Free Sing analysis (`src/lib/mirror/free-sing.ts`): dwell histogram → home note + tessitura quantiles, breath-gap phrase stats, debounced note-change agility, vibrato on the longest run.
- Sing the Universe (`src/lib/mirror/cosmic-melodies.ts` + `CosmicMode.tsx`): melodies from Gaia/Hipparcos declinations, ATNF pulsar spin rates (octave-folded) and the Perseus B♭ (pitch-class-pinned root), fitted into the detected range and scored by the match engine.
- F0 stream adapter (`f0-stream.ts`): AnalyserNode + rAF polling over the shared `MicManager`, YIN-only, detection gated to active takes, per-take detector history reset, RMS level tracking; silent-mic probe with automatic AudioContext rebuild (iOS WebKit sample-rate silence) and a live input-level meter.
- Share card renderer (`card-renderer.ts`): star-arc trace + steadiness pulsar on canvas, 1080×1920 / 1080×1080 PNG, Web Share API Level 2 with download fallback, brand-gradient wordmark, delta badge and title headline with shrink-to-fit.
- Client-side baseline (`baseline.ts`, localStorage, derived numbers only) with return-visit delta on the results screen and card.
- Anonymous funnel: `trackFunnel` beacons (sendBeacon/keepalive-fetch) keyed by a random clientId to the db-worker's new rate-limited `POST /api/mirror/event` → `mirrorEvents` D1 table (event allowlist, metrics only on `results_view`; not exposed via the generic CRUD).
- WelcomeScreen: brand-gradient "Mirror your voice" pill CTA linking to `/mirror`.
- Research + roadmap: `docs/plans/voice-mirror-phase2.md`.

### Changed

- Renumbered the previous release 0.6.0 → 0.5.2 (patch-scale update, wrong minor bump).
- `manualChunks`: new `vendor-solid` and `pitch-core` chunks so the mirror entry never pulls the app vendor bundle.

## [0.5.2] - 2026-07-01

### Added

- Shared pitch-denoise pipeline (`src/lib/pitch-pipeline/`): a reusable engine that turns a raw pitch contour into logical notes. Stages: log-domain fractional-MIDI conversion (`log-pitch.ts`), a running median (`running-median.ts`), a One-Euro filter (`one-euro.ts`), a temporal-continuity octave corrector that snaps octave jumps back to the melodic line (`octave-corrector.ts`), and a hysteresis (Schmitt-trigger) note state machine (`note-state-machine.ts`). Exposed as a live streaming pipeline (`live-pitch-pipeline.ts`) and an offline re-segmenter (`offline-segment.ts`, with a `segmentSecondsContourToMelody` seconds-native wrapper and a `pipeline` options override for coarse-hop callers). Fully unit-tested, incl. the C3→C4→C5→D3 octave-jump regression.
- Compose live tracking + open-ended recording (`useRecordingController.ts`, `piano-roll.ts`, `playback-runtime.ts`): the recorder feeds the live pipeline and exposes `provisionalNote`/`liveMidi`; the piano roll draws provisional dashed notes and a live pitch needle (`setPreviewNotes`/`setLiveMidi`/`drawPreviewNotes`/`drawLiveNeedle`) and grows to follow the playhead; `setOpenEnded` skips the auto-stop at arrangement end so recording runs until the user stops.
- Compose take review (`ComposeTakeReview.tsx`): on stop the raw contour is held as a pending take; an "As sung ↔ Clean" slider re-segments it (key-snap + merge + quantize scaled by the amount) with live preview and Keep/Discard, instead of auto-committing.
- Recorded take as a single undo step (`piano-roll.ts` `applyMelody`/`installMelody`, `PianoRollCanvas` `onEditorReady` bridge): committing a take routes through an injected `applyTake` that `pushHistory()` before replacing the melody, so one undo restores the previous melody; `melodyEquals` compares by value so the store round-trip is a no-op and history survives.
- Stem-mixer vocal-pitch cleanup (`useStemMixerPitchAnalysisController.ts`): analysis now captures a real per-frame contour (true frequency + clarity, including unvoiced frames) and re-segments it via the shared pipeline at a chosen cleanup amount (100ms coarse-hop tuning); slider/key/scale/tempo changes re-segment live without re-decoding audio. Panel gains a Cleanup section, disabled until a contour exists.
- Two-stage pitch-edit model (`pitch-edit-model.ts`): effective melody = `applyEditLayer(base, layer)` where `base` is the cleanup output and the layer holds manual notes + deleted regions keyed by region (not base id), so edits survive a cleanup-slider regen. Ops: `editNote` (move/resize/retune, suppresses the original span), `deleteNote`, `splitNote`, `mergeNotes`. Wired into the canvas (`useStemMixerCanvasController.ts`): hit-testing, click-to-select, drag body to move/retune within the octave, drag edges to resize, one undo step per drag.
- Edit persistence + views (`db/entities.ts`, `session-pitch-analysis-service.ts`): the original (algorithm) notes and the user edit layer are persisted separately (new optional `editLayerJson` column, no Dexie schema bump) and restored on reload; an Original / Edited / Both view toggle (Both ghosts the original behind the edited notes).
- Floating edit toolbar (`StemMixerEditToolbar.tsx` + `.module.css`): entering edit mode collapses the analysis panel and shows a compact bottom-centre glass toolbar (view segment, delete/split/merge, undo, reset, done); Escape exits. New `Split`/`Merge` SVG icons (`icons.tsx`).
- Krumhansl-Schmuckler key detection (`src/lib/key-detection/`): a duration-weighted 12-bin pitch-class histogram correlated against the 24 rotated key templates → argmax gives tonic + mode + confidence margin (`key-detector.ts`, `key-profiles.ts`). Per-region detection slides a window over the note timeline and merges consecutive same-key windows, so a modulating song yields a key per part. Wired into the vocal analysis: adopts the detected global key for cleanup snapping (user-overridable), persists the per-region keys (`keyRegionsJson`, no schema bump), restores them on reload, and shows "Detected key: X". Research plan in `docs/plans/key-detection.md`.
- Melody audition synth (`melody-synth.ts`): a lazily-created monophonic oscillator/gain (its own `AudioContext`, resumed on the toggle gesture) that glides to and fades in/out the active note. A "Melody" toggle in the Vocal Pitch canvas toolbar (`PitchCanvasToolbar`) drives it from the playhead, sounding whatever the pitch view shows.
- Scale/quantize helpers: `scaleDegreeSet`/`snapMidiToScale` (`scale-data.ts`) and `quantizeBeat` (`quantize.ts`), both tested.

### Changed

- Compose record-stop now routes through the full editor stop path so the take-review handoff and live-preview teardown are consistent.
- Analysis panel (`StemMixerPitchAnalysisPanel.tsx`): compact, `max-height` + scrollable with a translucent blurred sticky header sitting flush at the top (padding moved off the scroll container onto header/body), an X close icon that stays visible, and Escape-to-close. The tempo (BPM) number input is styled to match the app's dark inputs (`app.css`).

### Fixed

- Off-scale (accidental) notes on the piano roll are drawn at their true interpolated pitch (`midiToY`) and made hittable, instead of being pinned to the top row.
- Shared melodies decoded from the compact format carried `freq: 0` (the format stores only midi/startBeat/duration); the guitar pluck synth computed `sampleRate/freq` and built a `Float32Array` of length Infinity, throwing "Invalid typed array length: Infinity" and crashing playback. `share-codec` now reconstructs `note.freq` via `midiToFreq(midi)` on decode, and `renderPluckWaveform` returns a silent buffer for any non-finite / ≤ 0 frequency (`guitar-synth.ts`).
- Vocal pitch lane labels were drawn one row below the pills (a natural A appeared in the row labelled "A#"); the label row offset is corrected.

## [0.5.1] - 2026-07-01

### Added

- Reactive viewport hook (`src/lib/use-viewport.ts`): app-lifetime `isMobile`/`isNarrow` matchMedia singletons replace the scattered, non-reactive `prefersTopDock`/`isSmallScreen` checks (`ControlOverlay`, `Tab3DHud`, `GuitarPage`, `Walkthrough`) so small-screen/touch state updates on resize and rotation.
- Live on-canvas pitch marker (`PitchCanvas` `livePitch` prop, fed `currentPitch` from `App`): a left-anchored marker + dashed guide line driven by the mic whenever a note is detected, independent of playback (`pitchHistory` only fills during playback). The throttled rAF loop repaints on live-frequency change and once more on silence.
- Mobile singing HUD toggle (`singingHudMobileOpen` in settings-store; `SingingCanvasHud` button): the accuracy/sessions/pitch cards are hidden by default when `isNarrow()` and revealed via a persisted opt-in toggle; desktop behaviour is unchanged.
- Spotlight tour: desktop keyboard navigation (→/Enter advance, ← back, Esc close; ignores key-repeat, skips form fields/contenteditable, defers Enter to a focused button), clickable progress dots (`goToDot`), and a "continue to next section" button on a section's final step (`isLastInSection`/`goToNextSection`).
- Tour `reveal` field — expands a collapsed control group (`aria-expanded`) before a step and collapses it again on exit; all four control bars expose `[data-testid="{singing,piano,guitar,compose}-more-toggle"]`.
- Tour content: Effects section expanded (3 → 7 steps with per-effect `#roll-action-*` targets); the Settings spotlight split into three per-tab tours (`settings-general`/`settings-practice`/`settings-display`) anchored to full-width `.settingsSection` cards via `data-tour`; added editor + piano steps; enabled `#/guide/effects`. New Learn tutorials: Note Effects (compose), Display & Controls and General & Your Data (settings).

### Changed

- Spotlight tooltip redesign (`Walkthrough.module.css`): icon-only action buttons, a close (×) control, progress dots, and mobile breakpoints. `prepareAndPosition` now runs an immediate `updateHighlight()`/`updateTooltip()` before the rAF so steps anchor without waiting on a frame.
- `ControlOverlay`: centre-anchored default with an `inline`-mode max-width fix so the inlined Compose control bar doesn't squeeze the mic icon.

### Fixed

- Mic lifecycle: leaving the Singing/Compose tab now calls `practiceEngine.stopMic()` so `micActive` doesn't stay stuck on — previously the mic button looked active and reacted to playback on the next visit (`App.tsx`).
- Mic button icon no longer collapses to 0 width on a tight control bar (`flex-shrink: 0` on `.ctrlBtn` + svg, `MicButton.module.css`).
- `VALID_GUIDE_SECTIONS` (`hash-router.ts`) kept in sync with `GUIDE_SECTIONS`: added the missing `effects` id and replaced `settings` with the three per-tab ids.

## [0.5.0] - 2026-06-30

### Added

- Singing practice reworked into a canvas-overlay layout mirroring the 3D guitar view: pitch score + live mic monitor float as glass HUD cards (`SingingCanvasHud`, `SingingStatusChip`), a dockable/hideable glass control bar (`SingingControlBar` inside the generalized `ControlOverlay`), a top-left status chip (scale/melody + tempo + position), a top-right session scoreboard, melody-fit pitch viewport with explicit note-name labels, side-by-side HUD cards, and playback-time decluttering wired to the live `isPlaying` controller signal.
- Shared glass control-bar system: extracted reusable primitives (`control-bar/icons`, `NumberStepper`) and a generic dockable `ControlOverlay` (`static` + `inline` modes), then migrated Piano (`PianoControlBar`), Guitar (`GuitarControlBar`) and Compose (`ComposeControlBar`) onto bespoke bars; removed `SharedControlToolbar`.
- Header practice-context pill on Singing/Piano/Guitar and a dynamic header sub-title showing the loaded melody + character.
- Compose editor view switch reworked into a settings-style tab strip (`editorTab`/`editorTabActive`) with the control bar inlined in the same row via `ControlOverlay`'s new `inline` mode.
- Reusable `ConfirmDialog` (reuses the `.delete-confirm-*` styles + `useFocusTrap`); wired into karaoke playlist delete from both the gallery and sidebar. Karaoke empty states use a compact variant (`empty-state-compact`).
- Tabbed Settings (General / Practice / Display & Controls) with a polished account card; header account pill (username + sign-out) and a version + Ko-fi support double-pill.
- **Settings → Danger Zone: "Clear Karaoke & Vocal Separation Data"** — a button that deletes only UVR/karaoke data (separated songs, stems, lyrics, fingerprints, whisper transcriptions, session groups, and saved playlists) while keeping melodies, practice history, and settings. (`SettingsPanel`, `deleteAllSessionGroups`, `deleteAllPlaylists`, `deleteAllTranscriptionsFromDb`)
- DB-driven pricing with Stripe checkout/portal/webhook and animated pricing cards; RunPod serverless GPU + CPU separation tiers via an extracted, testable request bridge.
- Guitar Pro let-ring honored in tab playback (`applyLetRing` in `gp-to-midi-song`, `letRing` on `MidiSongNote`).
- `/exercises/<slug>` marketing deep-links that land on the exercise setup screen.

### Changed

- Sidebar reordered into collapsible sections.

### Fixed

- Backend-unreachable now degrades gracefully instead of crashing: cloud reads return empty, `fetchMe`/billing return null, and the global error handler downgrades network errors to warnings (warn-once).
- Deep-link routing uses an absolute asset base so first-load assets resolve (no SPA-shell fallback), and exercise deep-links no longer auto-start.
- **Singing guide tour: broken "Play / Pause / Stop" step.** The step targeted `[data-tour="transport.essential"]`, which existed on no element after recent relayouts, so the spotlight failed to highlight and the tooltip floated centred. Added the hook to the transport control group. (`SingingControlBar`)
- **Settings guide tour broken by the sub-tab relayout.** Settings is now split into General / Practice / Display sub-tabs, but five guide steps (Pitch Detection, Practice Aids, Accuracy Bands, Theme & Appearance, Reverb & ADSR) target controls under a non-default sub-tab; the tour only switched to the Settings tab (which opens on General), so the targets weren't in the DOM. Each step now uses `navigate[]` to open the correct sub-tab first. (`WALKTHROUGH_STEPS`)
- **Per-page "take a tour" toasts stacked.** A first-time user switching tabs piled up one offer toast per page. All tour-offer toasts now share a single notification channel — a new offer replaces the previous one, and leaving a tab retires the standing offer, so only the latest is shown. (`notifications-store`, `usePageTourOffer`, `offerTourOnce`)
- **"Reset to Factory Defaults" left state behind.** It only cleared `pitchperfect_*` localStorage keys, leaving sidebar collapse state (`sidebar-*`), karaoke UI prefs (`km-*`), the anonymous identity/auth token (`mp:*`), and the dev pitch-test flag. It now clears all localStorage + sessionStorage (alongside the model cache and IndexedDB) for a true factory wipe. (`SettingsPanel`)
- **Clearing all UVR sessions orphaned IndexedDB rows.** `deleteAllUvrSessions()` deleted only session records + lyrics, leaving stem audio blobs, fingerprints, and whisper transcriptions behind. It now wipes those too, so the existing in-app "clear storage" action no longer leaks rows. (`app-store`)
- **Mobile: "Choose your character!" guide step pointed off-screen.** The step targets `#character-icons`, which lives in the off-canvas sidebar, but lacked `inSidebar: true`, so the drawer never opened on mobile. Added the flag. (`WALKTHROUGH_STEPS`)
- **Mobile/narrow: toolbar guide steps could highlight an off-screen control.** The control bar scrolls horizontally, but the tour only scrolled targets into view vertically, so BPM / Volume / Play-mode (and Compose Record) steps could sit off to the side. The spotlight now also scrolls horizontally-clipped targets into view. (`Walkthrough`)
- **Mobile: spotlight tooltip action row could overflow at ≤360px.** The four controls now wrap. (`Walkthrough.module.css`)

## [0.4.9] - 2026-06-28

### Added

- HUD rail toggles in the 3D guitar view for the input-signal monitor ("Signal") and the orientation gizmo ("Axes"); both overlays are now user-controllable rather than the monitor being dev-only and the gizmo always on. Each toggle persists per device. Defaults: gizmo on (desktop) / off (small/touch); input monitor on in dev-desktop, off for players and on small/touch screens. (`Tab3DHud`, `Tab3DInputMonitor`, `GuitarTab3DView`)

### Changed

- The 3D control bar is raised above the other 3D-view overlays (input monitor, score card, nav gizmo) so it is never covered, hovered or not. (`Tab3DHud`)
- The 3D tab HUD dock now defaults to top on small/touch screens (bottom on desktop) and persists the user's choice locally (`gp-tab3d-hud-dock`). On small/touch screens the rail, top bar and loop popover lay out as a single horizontally-scrollable row so the bottom dock no longer wraps tall enough to cover the canvas. (`Tab3DHud`, `guitar-practice.css`)

### Fixed

- Unified tab order across the nav (covered by `tab-order.test.ts`), added touch gestures (orbit/pan/zoom) to the 3D view, and removed horizontal scroll on mobile. Community and leaderboard layouts are now phone-friendly. (`AppNavTabs`, `App`, `GuitarTab3DView`, `vocal-analysis.css`, `restored-legacy.css`)

## [0.4.8] - 2026-06-27

### Added

- Live input scoring surfaced in the 3D guitar view. The scoring engine already ran in any view (it scores mic/MIDI input against the falling notes while playing); this wires it into the 3D HUD: a Score/Combo readout + detected-note name while a run is playing, alongside the existing end-of-run corner card. (`Tab3DHud`, `GuitarPage`)
- In-scene scored-hit feedback: each successful hit flashes an additive ring on its cell coloured by accuracy (perfect/great/good), fading over `HIT_FLASH_MS`. Recent non-miss `hitResults` (Date.now timestamps) are mapped to cells in `buildScene` (`fret = midiNote - openMidi[string]`) and drawn in `Canvas2dTabRenderer.drawHits`. (`TabScene.hits`)
- Detected-note marker on the neck: the player's current input pitch is placed on its cell — snapped to a hittable target of the same pitch-class near the hit line (green), else approximated to the lowest playable string (neutral) — pulsing, alpha by detection clarity. Computed in `buildScene`, drawn in `Canvas2dTabRenderer.drawDetected`. (`TabScene.detected`)
- Mic + MIDI input toggles in the 3D control rail, so scoring is reachable with the shared transport bar hidden. (`Tab3DHud`, wired to `isMicActive`/`startMic`/`stopMic` and `midiConnected`/`midiConnect`/`midiDisconnect`)
- Dev-only input-signal monitor (`Tab3DInputMonitor`, gated on `import.meta.env.DEV`): shows input mode, your detected note vs the nearest target note, whether they match (same rule the scorer uses — exact MIDI / pitch-class mic), the last hit timing, an input level bar, and a live mic waveform. Added `getInputTimeData` to the controller for the waveform.
- Audio I/O device selection (`AudioDeviceSettings`, Guitar page "Devices" panel). `MicManager` gains `setPreferredDevice`/`getPreferredDevice` and applies `deviceId: { exact }` in its capture constraints, so capture can target an interface's instrument input instead of the OS default; the controller's `setInputDevice` restarts the mic so the engine re-wires onto the new device. Output routing via `AudioContext.setSinkId` (`audioEngine.setOutputDevice`/`outputDeviceSupported`, feature-detected). Selections persist (`mp.guitarInputDevice` / `mp.guitarOutputDevice`). `listAudioInputs`/`listAudioOutputs` enumerate devices (labels appear after mic permission).

## [0.4.7] - 2026-06-27

### Fixed

- 3D view default framing: `DEFAULT_CAMERA` reframed (radius 18→19, target y 1→-0.4) so the fixed-width neck plus the fret numbers sit above the bottom HUD with margin. The reset button uses the same constant, so it restores this framing. (`renderer/camera.ts`)
- Transpose now applies to ALL guitar sources, not just imported (`currentSong`-backed) songs. The re-voicing previously lived inside the combine `createEffect` gated on `currentSong()`, so app melodies loaded via `loadSong` with `songObj = null` (which set `fallingNotes` directly) were never transposed. Refactor: a new `baseNotes` signal holds the untransposed notes (set by both `loadSong` and the combine effect), and a dedicated effect derives `fallingNotes = revoiceNotes(baseNotes(), transpose())` and recomputes `transposeBounds`. The transpose helpers (`deriveOpenTuning`, `computeTransposeBounds`, `revoiceNotes`) were extracted to pure, non-mutating module functions (clone-on-shift), so the source melody/import is never altered and resetting transpose to 0 returns the exact original notes. (`useGuitarPracticeController.ts`)

## [0.4.6] - 2026-06-27

### Added

- 3D guitar tab playback view (`src/features/guitar-tab-3d/`). Backend-agnostic `TabRenderer` seam with a Canvas2D perspective backend (`Canvas2dTabRenderer`, `wgpu-matrix` lookAt/perspective): an upright fretboard wall on Z=0, a highway receding into −Z, notes flying down each (string, fret) lane onto their exact cell. WebGPU/TypeGPU backend scaffolding (`renderer/webgpu/`) sits behind the same interface for later. Surfaced as a new `'3d'` guitar view in `GuitarPage` via `GuitarTab3DView`, fed the same `guitar.fallingNotes`/`playheadBeat` as the 2D view.
- Readability layer in the renderer: imminence grading (near notes grow + glow, far fade to outlines, past fade out), chord spines binding notes within 1/16 beat, additive strike flash on landing, a "next to play" pulse on the nearest upcoming cell, decluttered per-cell labels, and luminance-adaptive label ink.
- Guitar Pro import (`src/lib/tab/gp-import.ts`, `gp-to-midi-song.ts`): `.gp/.gp3/.gp4/.gp5/.gpx` via `@coderline/alphatab` (MPL-2.0), dynamically imported / code-split. `scoreToMidiSong` preserves `stringIndex` (convention-agnostic `tuning.indexOf(realValue-fret)`), fret and MIDI; drops percussion.
- Orbit camera (`renderer/camera.ts`: yaw/pitch/radius/target, `cameraEye`/`cameraBasis`/`clampCamera`) driving the renderer via `setCamera`, plus a corner `NavGizmo` (axis cross drag-to-orbit, pan toggle, zoom, reset). Direct canvas control too: drag to orbit, shift/right-drag to pan, wheel to zoom.
- Glass HUD overlay (`ui/Tab3DHud.tsx`): dockable top (after the song name) or bottom-centre via a grip handle (click flips, drag snaps); transport, speed stepper + 0.5/0.75/1x presets + effective BPM, display toggles, and a practice-loop popover (A/B markers + speed ramp). `GuitarPage` gains a Hide/Show toggle that collapses the shared `SharedControlToolbar`.
- Transpose in `useGuitarPracticeController`: shifts every note's pitch by N semitones and re-voices it onto the neck (same string when in [0,24], else the nearest string that can host the pitch), affecting both synthesized audio (`targetFreq` scaled / backing freq × ratio) and the tab. Bounds computed from the instrument's reach so the whole song stays playable; octave = ±12; resets on song load. Exposed as `transpose`/`setTranspose`/`transposeBounds`.
- End-of-run score as a non-blocking corner card in the 3D view (`Tab3DHud`), matching the Exercises score-history chip (latest % + grade + notes/combo + recent runs), with Play again / Dismiss. In-session recent-scores list recorded in `GuitarPage`.

### Changed

- `.gp-tab3d-container` is now `height: 100%` so it fills `#guitar-fretboard-container` and scales with the window (was a fixed `min(62vh, 560px)` that left the parent background showing). Default camera radius 21.6 → 18 so the scene fills ~80% width / the lower two-thirds.
- The finished-run score modal (`.gp-score-overlay`) is suppressed for the `'3d'` view (still shown for the 2D/interactive views), replaced there by the corner card.

## [0.4.5] - 2026-06-26

### Added

- `ExerciseShell` (`src/features/exercises/ExerciseShell.tsx`): shared chrome for all 18 exercise components — header with a top-left "?" help toggle + collapsible panel, idle area with the Start button placed beneath the description/settings, a single result action (one "Try Again" in the overlay; "Change Target" in the controls), and an optional auto-score timer. All 18 `XxxExercise.tsx` components migrated to it; per-exercise canvas/metrics/idle content passed via slots. Celebration `createEffect`, controllers, autoStart, and `onCleanup` preserved per component.
- `exercise-help.ts`: `Record<ExerciseType, { summary; body }>` beginner help text; `IconQuestion` added to `exercise-icons.tsx`.
- Timed auto-score mode for the continuous-hold drills (long-note, vibrato, pitch-hold) via the shell's `autoTimer` prop (presets 5/15/30s). The timer arms only on the `active` transition so the `autoStart` path and the transient `count-in` state never trigger a premature stop.
- Moving target guide in `PitchOverTimeCanvas` (`movingTarget?: () => number | null`, forwarded through `ExercisePitchTracker`): an amber guide line + glowing dot that moves vertically. Driven by `SlideExercise` as a looping triangle-wave glide between the from/to notes.
- Vibrato styles + guide: new `vibrato/vibrato-styles.ts` (slow/medium/fast presets with research-backed rate/depth windows + sine-guide params). `useVibratoController` gains `setStyle(id)` and scores against the chosen style's windows. `VibratoExercise` adds a target-note line (`targetNoteMidi`), a sine `movingTarget` the singer traces (style rate/depth, toggle via "Show the wave"), and a style picker. Help text updated; added a style-scoring regression test.
- Exercise mic toggle: `ExerciseShell` renders the shared `MicButton` (via `EngineContext`, read with `useContext` so it no-ops without a provider in tests) to start/stop the mic and show input level.
- Recent-scores chip enlarged: `ExerciseScoreHistory` now features the latest score prominently with the previous few + Best.
- Target-note line on every exercise: `targetNoteMidi` is now wired into `ExercisePitchTracker` for all remaining exercises (interval-trainer, scale-runner, arpeggio-jumper, drone-intonation, call-response, mirror-melody, chord-stacker, staccato-precision, dynamic-swell, routine-runner via `() => base.state().metrics.currentMidi || undefined`; pitch-hold via its selected note). Previously only long-note/vibrato/slide/siren/sight-singing drew it.

### Changed

- Exercise completion flow: removed the per-exercise `showCelebration(...)` modal and the `ExerciseShell` result overlay. A finished run now returns to the idle (selector + Start) state — `complete` is treated as idle-like and the Start button calls `onTryAgain` (reset + start). Recent scores render via a new `ExerciseScoreHistory` chip (top-right of the canvas, reads `exerciseHistory()`/`getExerciseStats()`), most-recent highlighted, with Best. `recordExerciseResult`/`updateDifficultyFromEma` still run in each component's result effect.
- Exercise idle layout: Start + note pills + timer toggle moved into a centred `.exercise-idle-center` beneath the description (was a bottom strip). Added a spacebar shortcut in `ExerciseShell` (start when idle, stop when active, try-again when complete; ignored while a form control/button is focused).
- Readability: lifted dark-theme `--text-secondary` (`#8b949e → #a8b3bf`) and `--text-muted` (`#484f58 → #6e7681`); bumped tiny font sizes and set explicit colors on `.badge-tier`/`.badge-name`/`.achievement-desc`/`.achievement-points`.
- Auto-zoom (`PitchOverTimeCanvas`): when the sung range is small, the view now targets ~1 octave + ~4 semitones headroom (floored at 0.5 oct half-range) instead of forcing 2 octaves, with exponential smoothing of the log bounds between frames to avoid jumpiness.
- Nav grouping (`AppNavTabs.tsx`): moved the Exercises tab from the Social group into the Practice group, positioned before Karaoke (Karaoke remains last). No logic change — button markup relocated only.
- Top-bar navigation UX (`AppNavTabs.tsx` + `app.css`, desktop ≥769px): (1) mouse-wheel `deltaY` now pans the tab bar horizontally (passive:false wheel handler, only when it overflows); (2) click-drag panning via pointer events (mouse only, 6px threshold, `setPointerCapture`, a capture-phase click swallow so a drag never activates a tab, `dragging`/`tabs-scrollable` classes drive the grab/grabbing cursor); (3) each group label is now a button that collapses its group down to the active tab — spacing switched from flex `gap` to animatable `margin`, non-active tabs transition `max-width`/opacity to 0, and the group re-expands on `:hover` or `:has(.app-tab:focus)` (the `:has` excludes the label so a collapsing click doesn't immediately re-expand via focus). Collapsed state persists via `createPersistedSignal('mp.navCollapsedGroups')`. Listeners and the ResizeObserver are torn down in `onCleanup`.
- Pre-merge review fixes: (1) **call-response** had the same absolute-clock window bug as interval-trainer/dynamic-swell (`performance.now()` vs relative `sample.time`) → always scored 0; now uses `base._getElapsed()`, and its happy-path test was rewritten as a true epoch lock (large absolute clock offset so a regression fails). (2) `mirror-melody` and `long-note` empty-result branches aligned to the populated metric shape (`consistency`/`richnessScore`; `volumeConsistency` consistent at 0). (3) staccato result label "Best Note" → "Best Round" (value was already `bestRound`). (4) long-note Stability bar now uses `fillClass(...)` instead of a hardcoded `good` color; removed a double `untrack`. (5) `ExerciseMenu` `gradeClass` returns `''` below 50 to match the empty `gradeLabel`; `IconCircleFill` is now a solid disc (was identical to `IconCircleEmpty`). (6) `scoreNoteAccuracy` now reuses `trailingSamplesByTime` (DRY).

### Fixed

- `detectVibrato` (`src/lib/vocal-analyzer.ts`): the FFT assumed uniformly-spaced samples, but the live pitch stream is non-uniform (samples emitted only on confident frames at variable rAF timing), so vibrato was mis-rated or undetected. It now resamples MIDI onto a uniform time grid via the `time` field, applies a Hann window, and derives `binWidth` from the resampled rate. The vibrato controller analyzes a trailing ~4s window. Added a non-uniform/lossy-sampling regression test.
- Time-window scoring bug across controllers: `siren`, `drone-intonation`, `staccato-precision`, `routine-runner` selected the recent window via `slice(-floor(windowMs/50))` (a wrong 50ms/sample assumption). Replaced with a shared `trailingSamplesByTime(history, windowMs)` helper that filters by the `time` field. `interval-trainer` now averages cents deviation via `freqToExactMidi` (was custom MIDI math + single best sample); `pitch-hold` uses `freqToExactMidi`; `sight-singing` scores each note over its real on-screen window (recorded `_getElapsed()` boundaries) instead of an assumed `i * 2000ms` grid.
- Siren note generation: `generateSirens` previously used spans up to 32 semitones with one-sided clamps (`Math.max(36,start)` / `Math.min(84,end)`), so wide descending glides produced sub-audible/negative MIDI (the "G0"). Now exported + parameterized by `[rangeMin, rangeMax]` (from `getComfortableMidiRange`), with singable spans (≤12, ≤range) shifted into range as a pair without distortion. `SirenExercise` shows the end note as a target line + a triangle-wave glide guide (`movingTarget`) and labels start→end. Added a range-safety regression test.
- `PitchOverTimeCanvas`: the latest-dot note label now falls back to deriving the name from the dot's frequency (exercise samples carry no `noteName`), and `drawYAxisLabels` draws per-note gridlines/labels when zoomed to ≤ ~2.6 octaves (every semitone ≤1.4 oct, else every 2nd) instead of only octave Cs.
- `.exercise-card-grade` is now `inline-flex` + `align-items: center` so the grade icon centers with its label.
- Exercise difficulty badge + filter (`ExerciseMenu.tsx`): added a curated intrinsic `EXERCISE_DIFFICULTY: Record<ExerciseType, 'easy'|'medium'|'hard'>` shown as a badge on every card, plus All/Easy/Medium/Hard filter pills (`visibleCards` memo). Replaced the per-card adaptive `DifficultyIndicator` (which hid itself at the default level 5, so it only appeared on practiced exercises and read as a fixed rating) — the adaptive level still drives scoring via `launchDifficulty`/`difficulty-store`, it's just no longer the card badge. `DifficultyIndicator.tsx` is now unused.
- Sight-Singing rewrite (`use-sight-singing-controller.ts` + `SightSingingExercise.tsx`): `setScale(scale, rangeMin, rangeMax)` generates notes only within `getComfortableMidiRange(preset)` (pitch-classes from the current scale), preferring stepwise motion. Replaced the fixed 2s `setInterval` auto-advance with a pitch-driven poll (`HOLD_TO_PASS_MS` in-tolerance hold, `MAX_NOTE_MS` timeout fallback) that scores each note at advance and emits live metrics (`holdPct`, `detectedMidi`, `centsOff`, `matched`). Staff now maps by diatonic step (lines E4-G4-B4-D5-F5), draws ledger lines + ♯ accidentals + a real treble clef glyph, and highlights the active note; added a hold bar and a DEV-only (`import.meta.env.DEV`) detected/target/hold readout.
- Interval Trainer & Dynamic Swell scored ~0 regardless of performance: `evaluateRound()` set its window start (`matchStartTime`/`holdStartTime`) and bound from absolute `performance.now()`, but pitch samples store `time` as exercise-relative (`elapsed/1000`). The predicate `p.time*1000 >= start-100` was therefore always false → the window selected zero samples → score 0. Both now use `base._getElapsed()` (same relative epoch) for the window start and the upper bound. Added driven happy-path regression tests for both (the interval-trainer happy path was previously un-assertable for this exact reason).
- Routine Runner score could exceed 100: `fatigueScore = fatigued ? max(0, 100 + hnrTrend*2) : 100` was unclamped, so a positive `hnrTrend` pushed the 30%-weighted term past 100. Now `min(100, max(0, …))`.
- Stable exercise metric shapes: the empty/zero-result branches of `arpeggio-jumper` and `call-response` (missing `richnessScore`) and `dynamic-swell` (missing `dynamicRangeDb`/`avgDb`/`peakDb`) now emit the same key set as their populated branches (zeroed), so consumers see a consistent shape.

### Tests

- New controller unit tests (deterministic, via a shared `createMockBase`): `interval-trainer`, `scale-runner`, `arpeggio-jumper`, `drone-intonation`, `call-response`, `chord-stacker`, `staccato-precision`, `routine-runner`, `dynamic-swell`, `sight-singing`. Each covers the empty-history floor (score 0 + real metric keys), setup/generation (targets/sequences within the requested range and scale), and a synthetic happy path (fake-timer driven where a poll loop is involved). The sight-singing range test locks the "notes within `[rangeMin, rangeMax]`" regression; the interval-trainer/dynamic-swell happy paths lock the relative-clock window fix.

## [0.4.4] - 2026-06-26

### Fixed

- Display-name save failed on cloud accounts with `404 Unknown entity: leaderboardEntries`. `AccountSection.saveDisplayName` still client-wrote the `leaderboardEntries` table, but the db-worker no longer exposes it (`workers/db-worker/src/tables.ts`) — the leaderboard is server-derived from `sessionRecords` and reads names from `userProfiles` (`COALESCE(p."displayName", ...)`). Dropped the dead leaderboard-rename block and the unused `LeaderboardEntry` import; updating `userProfiles.displayName` is sufficient. Only surfaced on cloud accounts (the local Dexie table is directly writable). Added a regression test asserting the leaderboard repo is not written.

## [0.4.3] - 2026-06-26

### Fixed

- Cloud accounts unavailable on mercurypitch.com ("no API configured"): the prod build (`vite build`) had no `VITE_API_BASE_URL` — only `.env.development` set it. Added `.env.production` pointing the prod build at the prod db-worker (`mercury-pitch-db.komediruzecki-2015.workers.dev`), mirroring `.env.development`.

### Changed

- Bumped `wrangler` to 4.105.0 and `@cloudflare/workers-types` to 4.20260625.1 (peer).

## [0.4.2] - 2026-06-25

### Fixed

- Shazam Sing view: the shared icon components render at a fixed 24px, which dwarfed the small button labels after the icon migration. Scoped icon sizing + inline-flex alignment in `ShazamListen.module.css` (13px on the Speech/Debug toggles, 16px on Stop & Match / Cancel / Try Again, 14px on the "Upload audio instead" link).

## [0.4.1] - 2026-06-25

### Added

- **Navigation-aware spotlight tour engine** (`Walkthrough.tsx`): steps can switch tabs (`requiredTab`), click through sub-tabs/sub-views/dropdowns to reveal a target (`navigate[]`, generation-token guarded), and open the off-canvas mobile sidebar (`inSidebar`, store-backed `sidebarOpen`). Springy glide + pulsing accent ring with a `prefers-reduced-motion` opt-out; tall targets scroll to their top; a listener-leak fix. Per-page tours for every tab via `PAGE_TOURS` + `PAGE_TOUR_CATALOG`, all listed in the Guide modal; stale legacy selectors refreshed onto a stable `data-tour` layer; crammed steps split into focused substeps.
- **Learn tutorials for every feature** (`src/types/walkthrough-content-extended.ts`, spread into `WALKTHROUGHS`; `WALKTHROUGH_TABS` extended): one read-along guide per remaining tab, plus a per-tutorial "Take the interactive tour" bridge in `WalkthroughModal` (per-id overrides, e.g. "Understanding Practice Modes" -> a focused practice-modes tour).
- **Shared mic-insights engine** (`useMicInsights`): debounced `none` / `no-input` / `too-quiet` state machine with a readable min-display hold, a reactive `insight()` and an `onChange` callback; tab-agnostic `MicInsightHint`. Ported to Singing, Karaoke, Piano, Guitar and Jam via a shared `rmsOfTimeData`/`rmsOfAnalyser` helper (per-tab `getInputLevel`).
- **StemMixer Vocal Pitch**: togglable live mic pitch line (red) and sung-note labels on the red user outlines; the mic hint now lives in the Vocal Pitch panel header; lyric-tool tour steps scoped to individual buttons.
- **Find My Voice** (`VoiceTypeDetectorModal`): auto-requests the mic and starts listening on open, waits for a strong sustained "Ah", scratches an abandoned take, with a live hearing/singing indicator and a permission-error retry.

### Changed

- **Exercises**: compact card redesign (badge icons, pill tags, centered gallery, centered Start); practice-intel reorg (suggestions + recent sessions up top, always-shown "Get started" fallback via a `WeaknessPanel` `fallback` prop).
- **Karaoke share link** gated behind a new `PREMIUM_FEATURES` flag (`src/lib/defaults.ts`, off by default; `VITE_PREMIUM_FEATURES=true` to enable) since sessions are local IndexedDB only; the session-id pill now shows the song duration.

### Fixed

- Self-review pass: per-frame `Float32Array` allocation removed from `rmsOfAnalyser`; Guitar count-in no longer trips "can't hear you"; `useMicInsights` `now()` falls back to `Date.now()`; the tour prepare-effect tracks `tourSteps()`; `GuideSelection` keydown listener moved to an `isOpen`-keyed effect with cleanup; the Karaoke/StemMixer tour is guarded on a loaded mixer (both Guide modal and Learn bridge).
- `.fn-btn` is `inline-flex` (score-card icon/label alignment); `.sm-session-id` fits its content; tab-name drift fixed in tours and Learn guides ("Practice Tab" -> "Singing", "Editor tab" -> "Compose").
- Resolved the outstanding `solid/reactivity` warnings in `GuitarPage`/`PianoPage`.

### Tests

- Re-runnable, gitignored Playwright control scripts in `assets/local/playwright/`: page-tours (35/35), guide-modal (16/16), learn-modal (20/20), legacy selectors (25/25), mobile tour (28/28). Full suite stays at 2053 passing.

## [0.4.0] - 2026-06-24

### Added

- **Practice Intelligence**: adaptive-difficulty engine (per-exercise EMA with hysteresis), weakness analyzer + targeted micro-drills, and a trends dashboard with a calendar heatmap and sparklines. Difficulty is wired into all 16 exercise controllers (scoring tolerance / counts / timing scale with the level; level 5 reproduces prior behaviour), and weak-pitch drills seed the target note for long-note and scale-runner.
- **Pitch accuracy heatmap**: per-note accuracy heatmap below the pitch canvas with click-to-seek to the note.
- **Onboarding survey**: optional post-welcome survey (deployed builds only, signed-in users), persisted to the cloud via a new `userSurveyResponses` entity.
- **Loading skeletons**: shimmer placeholders for lazy-loaded tabs.
- **Transition animations**: sidebar/backdrop/score-card/tab animations, reduced-motion aware.
- **Accessibility baseline (WCAG 2.2 AA)**: skip link, focus-visible, focus trap + dialog semantics for modals, labelled auth inputs, larger hit targets, reduced-motion reset, and a labelled falling-notes canvas.

### Changed

- **Server-authoritative leaderboard**: `GET /api/leaderboard` derives rankings from `sessionRecords` (per-user aggregates + server-computed streak; global/friends, all-time/weekly). The client-writable `leaderboardEntries` path was removed; old rows are wiped via `scripts/wipe-leaderboard-entries.sql`.
- **Backend hardening**: per-IP CRUD write rate limiting, score validation, fail-closed auth, constant-time login, security headers/CSP, and a top-level db-worker error boundary (CORS-bearing 500s instead of opaque "Failed to fetch").

### Fixed

- Survey is only shown to signed-in users (a signed-out submit hit the user-scoped write guard).
- Login email/password inputs get `name` + `autocomplete="username"`/`current-password` so password managers can fill the saved credential.
- UI icon-migration regressions: WebGPU/CPU badge icon no longer overflows its pill, library modal Cancel/Create button icons centered/sized, dead Session Editor collapse chevron wired up, and a dedicated Playlists tab icon.
- Performance: memoized falling-notes MIDI range and per-frame judgment indexing.

### Tests

- DexieAdapter query engine covered via fake-indexeddb; ServerAdapter retry/response handling; practice-intelligence engine modules.

## [0.3.14] - 2026-06-19

### Added

- **Karaoke Playlist Mode**: Build saved, reusable set lists from session groups and/or individual sessions in a new togglable left sidebar on the Stem Mixer (Karaoke tab). Per-entry singer assignment ("who will do this song"), optional shuffle of the overall order and of songs within a group, and persistent storage in IndexedDB (`karaokePlaylists`).
- **Guided Playback Flow**: A top "get ready" overlay shows the current song → group/singer → duration with a 4‑3‑2‑1‑Go countdown; the instrumental plays for true karaoke while the vocal stem is kept silent but tapped as the pitch reference for scoring. After each song the score modal appears, then the next song's overlay; a final ranked scoreboard recaps every singer at the end.
- **Mic Monitoring ("Hear my voice")**: Optional toggle + volume to route the mic to the speakers/headphones so singers hear themselves over the backing track — no second app required (off by default to avoid feedback; best with headphones).
- **Now-Playing Tab Title & Header**: The browser tab shows `MercuryPitch — <song>` during playback, and the Stem Mixer header gains a dimmed subtitle (Singer · Song · Next) while a playlist is running.
- **Playlist Gallery**: A collapsible gallery of saved playlists above the session list in the Karaoke upload view, each card showing song/singer counts with quick Play, Export, Rename and Delete actions. The session list is collapsible too.
- **Quick-start & countdown polish**: Each playlist row (sidebar and gallery) has an immediate Play button, and the countdown overlay greets the singer with an "Are you ready, <singer>?" pill.
- **Export/Import Karaoke**: Export a playlist to a ZIP containing its songs plus a manifest of the playlist structure, groups and singer assignments; importing a karaoke ZIP recreates the sessions, groups and playlists with remapped ids.
- **In-playback playlist transport**: Prev / Skip / Stop controls in the Stem Mixer header subtitle so you can skip the current song mid-play (previously the playlist only advanced when a song finished).
- **Mic monitor mixer**: A "Hear myself" toggle + volume fader in the Stem Mixer right sidebar (next to the stem faders) to set self-monitoring loudness during karaoke.
- **Playlist builder pill view**: Add songs/groups via click-to-toggle pill badges (or classic dropdowns), with a compact items view, collapsible add list, and bounded/scrollable lists so the editor stays reachable.
- **Round-robin "turns" mode**: A play mode where each group takes one song per round (like players taking turns) until every song has played; a standalone session counts as a one-song group, and shuffle re-randomises the turn order each round.
- **Reusable playlist editor**: The same editor is available in the Stem Mixer sidebar and inline via an "Edit" button on each gallery card in the upload view. Add songs into a playlist group by selecting the group item, then clicking song pills.
- **Focus-mode now-playing bar**: In karaoke focus mode (header hidden), a slim top bar shows Singer · Song · Next plus Prev/Skip/Stop controls; the playlist sidebar auto-closes once a song starts.
- **Search sessions by song**: A fuzzy search box (substring + subsequence) in the Karaoke session library filters songs by name across all groups.
- **Upload pre-separated stems**: Add a session from an uploaded vocal and/or instrumental (no separation). Add the missing stem later, or replace a stem with a better file — from the session card's stem list or the stem results view.

### Fixed

- **Playlist song loading**: Fixed a keyed-remount race where the Stem Mixer could show one song but play another, and stopped the URL-hash sync from re-triggering session loads (which made the mixer reload songs) during playlist playback.
- **Karaoke vocal muting**: The reference vocal is now silenced via the track's mute flag (so the mute button and waveform reflect it) while still driving the pitch reference.
- **Add-song/group dropdowns**: The placeholder is no longer auto-skipped to the first option, so the only/first item can actually be selected; the dropdown resets after each add.
- **Quieter karaoke**: The lyrics/transcription alignment-accuracy warning is suppressed during playlist playback (still shown for single sessions).
- **Skip/advance reliability**: The mixer now remounts per song via a load token bumped only after the new song's stems are in place, with a stale-load guard and current-song gating — fixing songs that "ended immediately" or got stuck when skipping/going to the previous song.
- **Previous/next replay after reload**: Revisiting a playlist song now persists its freshly-hydrated stem URLs to the session cache, so going to the previous song no longer fails on dead (post-reload) blob URLs.
- **Group song resolution**: A group's songs resolve to existing sessions only (merging `group.sessionIds` with `session.groupId`), so stale ids no longer cascade the playlist straight to the summary.
- **Karaoke import**: Round-robin play mode is preserved when importing a karaoke playlist (previously reverted to sequential).

- **Session cards**: Removed the redundant "UVR Session" heading; cards now show the band/group above the song title with hover tooltips for long names, and the action buttons (delete/export/share) sit as smaller, right-aligned controls in the top row so the title spans the full width.
- **Group singer default**: Adding a group to a playlist pre-fills its singer with the group's name (editable afterwards).

## [0.3.13] - 2026-06-13

### Added

- **Guide Character Voice Improvements**: Introduced the new **Harmony** character voice option that plays the target note with a major third (+4 semitones) on top, **Echo** (quiet voice playing at `0.3x` volume), and boosted the **Aria** volume to `1.3x`.
- **New Character Voices**: Added two new guide character voices to support diverse singing practices:
  - **Nova (Octave Anchor)**: Plays a sub-octave double (-12 semitones) using the strings instrument to ground lower registers.
  - **Spark (Percussive Tap)**: Plays short, staccato plucked synth notes to assist with rhythmic timing and precise pitch onset.
- **Detailed Character Descriptions**: Added rich tooltips to the character selector in the sidebar, providing clear explanations of each guide voice's role and how it helps the user practice.
- **Display Name Integration**: Integrated character display names (`Aria`, `Harmony`, `Nova`, `Spark`, etc.) into the sidebar indicator pill and SettingsPanel explanation text.
- **Character SVG Icons**: Designed and created custom SVG assets (`harmony_idle.svg`, `nova_idle.svg`, and `spark_idle.svg`) representing the respective character identities.
- **Unit Test Coverage**: Added detailed assertions verifying correct instrument selection, oscillator counts, and effects for the new character voices in the test suite.

## [0.3.12] - 2026-06-12

### Added

- **Cloud Accounts & Sync**: Anonymous-first cloud accounts — everyone gets a silent anonymous identity, upgradeable to email/password or Google without losing progress. Challenges, scores, badges, streaks and leaderboard entries sync across devices; karaoke/UVR audio stays on-device.
- **Google Sign-In (redirect flow)**: COOP-safe full-page OAuth redirect through the db-worker, replacing the Google popup flow that failed in Firefox/Safari (`window.opener is null` under cross-origin isolation).
- **Account Section**: Create account, sign in/out, and an editable display name that propagates to existing leaderboard entries.
- **Cloud Database Worker**: D1-backed REST API (db-worker) with JWT auth, per-user scoped CRUD, separate dev/prod environments and CI deploy workflow; the app picks cloud vs. local storage per entity via a hybrid adapter.
- **Undo Toast Notifications**: Destructive operations (e.g. session delete) show an undo toast; undone session items return to their original position.

### Fixed

- **Profile Save Conflict**: Saving a profile no longer 409s — cloud profile ids derive from the JWT identity.
- **Signed-Out State**: After signing out of an upgraded account the app stays quietly signed out instead of retrying a doomed anonymous handshake; data refetches on auth changes.
- **Notification Layering**: Toasts render above modals.
- **Console Log Memory**: Captured warn/info logs capped at 500 entries to prevent unbounded memory growth.

## [0.3.11] - 2026-06-09

### Added

- **Singing Exercises (16 new)**: Full exercise system with base exercise framework (`use-base-exercise.ts`), reusable pitch tracker, and note selector components. Exercises include: Long Note, Vibrato, Slide, Pitch Pursuit, Mirror Melody, Pitch Hold, Interval Trainer, Scale Runner, Arpeggio Jumper, Drone Intonation, Siren, Call & Response, Dynamic Swell, Chord Stacker, Staccato Precision, and Routine Runner.
- **Exercise Menu**: Card-based exercise browser with per-exercise stats (best score, play count, grade badges), tag categorization, and quick-start buttons.
- **Exercise History Store**: Persistent localStorage-backed history of completed exercises (last 100), with per-type stats (best/avg score, total plays) and automatic leaderboard and streak updates.
- **Session Celebration Modal**: Post-exercise score overlay with grade coloring and best-window highlights.
- **Daily Practice Routines**: Collapsible routine panel with segment-by-segment progress tracking, auto-advance on exercise completion, shareable routine links, and random routine generation from curated templates.
- **Routine Templates**: Library of predefined warm-up routines with configurable segments (warmup, exercise, challenge-prep, cooldown).
- **Karaoke Looping (A/B Loop)**: Audio loop state machine, transport controls for loop toggle, waveform loop region visualization on overview canvas with draggable A/B markers, loop count tracking, loop metrics bar, and keyboard shortcuts.
- **Karaoke Focus Mode**: Full-screen stem mixer mode with transport bar toggles, hidden headers, and compact controls.
- **Touch Pan/Zoom**: One-finger horizontal pan, two-finger pinch-to-zoom on all canvases, vertical pinch for panel resize, dampened sensitivity, and natural scrolling direction.
- **Pinch-to-Zoom Lyrics**: Font size scaling on lyrics panel via pinch gesture (max 3rem), context menu disabled on lyrics.
- **Session Grouping**: Group tabs with context menu, assignment dropdown, CSS styling, and group CRUD operations backed by IndexedDB. Sessions can be assigned/removed from groups.
- **Self-Contained Shareable URLs**: Base64url encoding for melodies, exercises, and routines. Compact tuple format for melody items. URL shortener backed by Cloudflare KV with 60-day TTL. Copy-to-clipboard with fallback.
- **Responsive Walkthrough Tooltips**: Mobile-responsive tooltip positioning with media queries for the guided tour.
- **SVG Icon Migration**: New exercise-specific icon set (`exercise-icons.tsx`), SVG icons added to text-only buttons (Shazam, ScaleBuilder, App, CommunityShare, CommunityLeaderboard), and enhanced toggle/mode button icons (Metronome, UvrPanel).
- **Streak Calendar Component**: Visual practice streak tracking.
- **Vocal Range Utilities**: `vocal-range.ts` for note option generation and default note selection based on voice type presets.
- **Frequency-to-Note Utilities**: Bidirectional MIDI/frequency/note-name conversion (`frequency-to-note.ts`).
- **New Note Effects**: Tremolo, Trill, and Staccato effects for the piano roll and practice sessions.
- **Whisper Language Selection**: EN/HR language dropdown in StemMixer and PitchTestingTab, threaded through worker/service/hook.
- **Whisper Warm-up (opt-in)**: Optional silent warm-up inference after model load to pre-compile shaders.
- **Mixer Deep-Link Fix**: Reloading `#/karaoke/session/{id}/mixer` correctly loads the mixer view with populated stems.
- **Keyboard Loop Shortcuts**: Keyboard shortcuts for loop toggle and loop boundary controls.
- **Challenge Drill Generator**: Auto-generates exercise drills from challenge definitions.

### Changed

- **Toolbar Icon Standardization**: All toolbar icons normalized to 16px (down from 18px).
- **Waveform Icon**: Replaced mushy waveform icon with clean stroke-based vertical lines.
- **Note Labels Icon**: Replaced note labels icon with music eighth note SVG across lyrics panel and mixer.
- **Panel Heights**: Updated default panel heights for better layout balance.
- **Whisper Chunk Timeout**: Increased per-chunk timeout from 120s to 200s for Firefox compatibility.
- **Export All Progress**: Toast styling keeps progress notifications visible until completion.
- **Hash Router**: Extended to support `#/share/{payload}`, `#/s/{shortId}`, exercise, and routine share routes.
- **Dexie Adapter**: Improved error handling, group cleanup on delete-all, and session deduplication.
- **Piano Roll**: Major enhancements — 900+ lines of changes for new note effects rendering, arc physics, and improved seek behavior.
- **Effect Renderer**: Extended with tremolo, trill, and staccato effect rendering logic.
- **Audio Engine**: Added tone playback API for exercises (`playTone`, `stopTone`).

### Fixed

- **SolidJS Reactivity Warnings**: Extracted reactive values synchronously before async `.then()` callbacks per SolidJS best practices (multiple locations).
- **Karaoke Looping**: Fixed RAF tick dying after first loop iteration; converted `loopCount` to reactive signal.
- **Focus Mode Panel Toggles**: Wired up all focus mode panel toggles; show all controls in focus toolbar; restored original icon-only toggle buttons.
- **Kebab Menu**: Replaced broken kebab menu with hover X button; fixed clear-all modal not closing.
- **Cache Persistence**: Fixed cache persistence on delete-all; cleaned up group DB records properly.
- **Prop Type / Test Mocks**: Fixed prop type issue, `deleteAll` group cleanup, test mock, and `CheckSmall` icon typo.
- **UvrPanel Merge Conflicts**: Resolved UvrPanel.tsx conflict to use main's version with export group support.
- **Page Zoom Prevention**: Prevented page zoom on lyrics pinch and disabled context menu on lyrics panel.
- **Touch Pan Direction**: Flipped touch pan direction to match natural scrolling convention.
- **Touch Sensitivity**: Dampened touch pan/zoom sensitivity and rounded `windowDuration` display.
- **E2E Tests**: Fixed e2e test selectors after icon migration and CSS module changes.
- **Lint/Formatting**: Various lint error boundary fixes, spacing, and reformatting.
- **Mixer Deep-Link Race Condition**: Fixed `handleSessionView` unconditionally overwriting the mixer view from URL hash.
- **Whisper Progress Bar**: Fixed erratic progress bar behavior with per-file monotonic aggregate reporting.

## [0.3.10] - 2026-06-02

### Added

- **Session Import/Export**: Added the ability to export all sessions to a ZIP file and import sessions from a ZIP file to easily backup and migrate data. Includes visual progress rings during export extraction and generation.

### Changed

- **Karaoke UI**: Re-styled the Karaoke Settings modal to be more compact, removed redundant title, and fixed oversized SVG icons. Added a styled "filename pill" with truncation and hover tooltip to the audio processing view and the results view.
- **Routing**: Renamed the URL hash from `#/uvr/...` to `#/karaoke/...` for better consistency with the Karaoke tab, while maintaining backwards compatibility for old links.
- **Database Migration**: Moved lyrics and session storage from `localStorage` to IndexedDB for improved reliability and storage capacity. _(Note: Users may need to clear/reset data via the "Clear All Data" button for the app to function stably after this migration)._
- **UI Consolidation**: Replaced duplicate delete buttons with a single unified "Clear All Data" wipe button to completely remove cached songs and session history.

### Fixed

- **UI / Modal**: The Escape key now properly closes the Karaoke Settings modal.
- **Whisper Transcription**: Fixed a crash (`serviceRef is null`) during transcription caused by component unmounting or HMR during a transcription loop.
- **Session Data**: Fixed a bug where identical sessions were duplicated in the "Recent Sessions" list upon page reload, and deleting one deleted both (fixed state duplication during IndexedDB load/save).
- **LRC Lyrics Sync**: Fixed actual word timings matching in LRC files ensuring that only the specific user-mapped lines are modified and correctly synchronized.
- **Deep Linking**: Fixed an issue where hard-reloading on a specific session URL (`#/karaoke/session/...`) would fail to load the session data.
- **Session Loading Performance**: Optimized `ensureHydrated` to cache loaded IndexedDB Blobs per page session, significantly speeding up "View Results" and "Play" navigation.
- **Whisper Transcription**: Increased processing timeout from 180s to 300s to prevent valid large files from failing. Added toast notifications to warn users of poor transcription accuracy (<25%).
- **Clipboard Access**: Added a dedicated "Paste" button to the lyrics headers and a global `Ctrl+V` listener to seamlessly load lyrics directly from the clipboard.

## [0.3.9] - 2026-05-30

### Added

- **Word-to-Pitch Alignment**: New alignment algorithm (`pitch-word-alignment.ts`) maps whisper-transcribed words to detected pitch notes via temporal overlap. Includes multi-word segment splitting, per-word confidence scoring, and raw-vs-denoised comparison logging.
- **Whisper Transcription**: Manual "Transcribe" button on both StemMixer and Vocal Analysis tabs. Long audio is chunked into 30s segments with 5s overlap, processed sequentially, and deduplicated. Progress feedback with elapsed timer during transcription and model download.
- **Shared Transcription Module**: Centralized whisper lifecycle (`useWhisperTranscription.ts`) and alignment utilities (`transcription-alignment-utils.ts`) shared between StemMixer and PitchTestingTab, ensuring consistent behavior across both views.
- **Pitch Pill Labels**: Note name labels render on pitch canvas pills (toggleable via PitchCanvasToolbar). Aligned lyric words appear below note names when alignment data is available.
- **LRC Word Timings Fallback**: When whisper transcription is unavailable, LRC files with per-word timestamps are used as the word source for pitch alignment.
- **PitchCanvasToolbar**: Compact toggle bar for pitch canvas display options (note labels, lyric labels).
- **LRC Generator Improvements**: Can now start LRC generation from any clicked line. Cancel search restores previous lyrics source. Improved loading UI with cancel/upload support during LRC search.

### Changed

- **Pitch Detection Accuracy**:
  - Added FFT confidence gate to filter out low-confidence pitch detections.
  - Replaced FFT `pseudoClarity` with SNR-based confidence scoring.
  - Standardized Autocorr frequency range from 60--2000 Hz to 65--2100 Hz.
  - Segmenter improvements: minimum note duration enforcement, singleton note filter, dropout bridging for short gaps.
  - Aligned segmenter/merger grouping tolerance to +/-0.5 semitones.
- **Canvas Word Labels**: Whisper per-word labels take priority over LRC line-level text when both are available. Word labels auto-hide when zoomed out (< 6 px/sec) to prevent unreadable text density.
- **Refactoring**: Extracted `canonical-lrc.ts`, consolidated LRC text building into `lrc-generator.ts`, replaced per-controller seekTo/duration signals with shared `seekTo` abstraction, renamed `rawText` to `originalText` across lyrics controller and LRC panel.

### Fixed

- **Show Mixer Button**: Now shows active/accent state when sidebar is visible, neutral when hidden.
- **LRC Generator**: Fixed index mismatch corruption when finishing LRC generation.
- **LRC Player**: Fixed highlighting stretching across long gaps between lines.
- **Shazam Debug Logs**: Gated debug `console.log` calls behind `IS_DEV` flag.

## [0.3.8] - 2026-05-22

### Added

- **Analysis Tab / Vocal Analysis**: Completely revamped the Pitch Testing UI to include a new "Session Gallery" feature, allowing users to browse previously analyzed vocal tracks.
- **Pitch Segmentation**: Built a new intelligent note segmentation algorithm (`note-segmenter.ts`) that extracts discrete, denoised musical notes from raw pitch sample arrays.
- **Lyrics Support**: Integrated `.lrc` lyric files sync support directly into the Pitch Testing Tab (`lyrics-service.ts`) with interactive, synchronized UI highlighting.
- **Offline Pitch Canvas**: Added a new interactive timeline viewer (`OfflinePitchCanvas.tsx`) for analyzing historical vocal performances with drag-to-seek, zooming, and scrolling capabilities.
- **Persistent Analysis**: Added Dexie DB integration (`pitch-analysis-service.ts`) to ensure offline analysis results (pitch data and segmented notes) survive page reloads.

### Changed

- **Mobile Navigation**: Updated mobile swipe gestures to correctly skip hidden/advanced UI tabs instead of getting stuck.
- **Performance**: Shifted heavy Pitch Canvas calculations to an `OffscreenCanvas` caching architecture to optimize rendering loops.

### Fixed

- **Analysis Tab**: Rewrote offline Pitch Canvas renderer to use `OffscreenCanvas` caching, resolving extreme frame drops and lag during waveform playback.
- **Analysis Tab**: Fixed caching bug causing multi-second delays when swapping between vocal tracks or toggling the "Denoised Melody" overlay.
- **Analysis Tab**: Fixed "Cancel Separation" button doing nothing by properly injecting the session ID to abort the background UVR worker.
- **UI & Reactivity**: Transitioned gallery components to strict CSS modules and resolved SolidJS reactivity warnings ("computations created outside a createRoot") in the `PitchTestingTab`.

## [0.3.7] - 2026-05-21

### Added

- **Appearance Settings**: Added a new Font Family selector in Settings allowing users to choose between Inter, Outfit, Plus Jakarta Sans, and System Default fonts.

### Changed

- **Session Library**: Unified library melody lists on all locations.

### Fixed

- **Settings UI**: Fixed font dropdown layout issues and adjusted unit spacing for better readability (e.g., "100 ms" instead of "100ms").
- **Welcome Screen**: Adjusted title styling to correctly inherit CSS variables and sizes from the global app title.

## [0.3.6] - 2026-05-21

### Added

- **Shazam Sing**: Debug panel is now visible by default for all users to aid in troubleshooting

### Changed

- **Karaoke Tab**: Redesigned tab icon to feature a clean, centered stem waveform
- **Karaoke UI**: Centered the main content area with a bounded width for better readability on large screens, and expanded the primary dark background color to cover the entire page
- **UI / Styling**: Replaced the plain header border in the Karaoke tab with a stylish `FancyDivider` component
- **Onboarding**: Moved the "Start Singing" and "Take a Tour" buttons to the top of the Welcome modal to prioritize primary actions
- **Navigation**: The "Analysis" advanced tab is now unblocked and available to all users by default

### Fixed

- **Global Error Handling**: Upgraded `TabErrorBoundary` to utilize the styled `CrashModal` overlay, ensuring tab crashes display proper stack traces and recovery buttons instead of unstyled placeholders
- **Linting & Code Quality**: Resolved strict boolean expression warnings in `AppErrorBoundary` and fixed incorrect HTML comments inside JSX blocks in `AppNavTabs`

## [0.3.5] - 2026-05-19

### Added

- **Jam Session -- Session Persistence**: room ID and display name stored in `sessionStorage`; page reloads auto-rejoin the same room
- **Jam Session -- Server-side Host Tracking**: `ownerName` persisted in Durable Object `ctx.storage`; reconnecting with the original display name restores host privileges
- **Jam Session -- Activity Scoreboard**: per-user scoreboard overlay on the exercise canvas showing exercise name, timestamp, and individual accuracy badges
- **Jam Session -- Exercise History Persistence**: completed exercise scores survive page reloads via `sessionStorage`
- **Voice Type Detector**: vocal range analysis modal for determining singer classification (soprano, alto, tenor, bass)
- **Vocal Range Presets**: predefined singing range presets that auto-configure default octave and exercise selection
- **Mobile UI**: Drawer-based navigation for mobile devices and compact icon-only control toolbar

### Changed

- **Jam Session -- Default Camera Off**: video disabled by default to reduce WebRTC handshake latency on room join
- **Jam Session -- Random Codenames**: users who join without a display name receive a thematic one-word codename
- **Jam Session -- Camera Widget**: repositioned to bottom-right horizontal row layout alongside chat widget
- **Jam Session -- Signaling Protocol**: `room-created` and `room-joined` messages now include `isHost` flag from the server
- **Jam Session -- Badges**: Added beautiful glowing pill badges for peers next to the room title
- **Compose Tab**: removed melody count badge for cleaner, consistent navigation
- **Jam Panel**: replaced inspirational quote branding; cleaned up display name input UI

### Fixed

- **Jam Session**: WebRTC video stream renegotiation to ensure camera streams connect reliably
- **Jam Session**: Fixed "Cam off" state sync when joining a room by broadcasting video state over the WebRTC datachannel
- **Jam Session**: Prevented remote audio source duplication causing volume overlap
- **StemMixer Lyrics**: Prevented auto-loading incorrect lyrics for generic filenames; close picker after manual upload
- **UI**: Visual improvements to UVR Guide modal and restored fancy gradient divider in sidebar
- **Shazam**: processing spinner and error state display on stop/match flow
- **Shazam**: melody matching algorithm accuracy improvements
- **Pitch Canvas**: scroll mode rendering after CSS module refactor
- **Durable Object Hibernation**: `ownerName` lost after DO eviction -- now persisted in `ctx.storage`
- **UI / Mobile Layout**: Resolved overly large toolbar buttons by implementing strict CSS modules for consistent `.ctrlBtn` sizing across all controls
- **UI / Header**: Fixed mobile responsive navigation layout to properly wrap onto two compact rows instead of creating extra vertical space
- **UI / Sidebar**: Fixed missing "Expand sidebar" arrow button when sidebar is collapsed by removing a conflicting global rule and scoping CSS modules correctly
- **E2E Test**: removed assertion on deleted `.tab-badge` element

## [0.3.4] - 2026-05-19

### Added

- **Shazam Sing**: Real-time microphone listening for audio fingerprinting and identifying songs
- Speech Recognition real-time feedback in ShazamListen component
- E2E Test configuration allowing dynamic playwright timeouts via `.env.local`

### Changed

- Massive CSS Modules Refactoring (`.module.css`): transitioned global CSS legacy styles into isolated component-level styles
- Rebased branch workflow to perfectly stabilize features into main branch

### Fixed

- Playwright UI test suite timeout failures resulting from CSS module class hashing (fixed 100+ failing tests)
- Missing Walkthrough Tour markdown styles (restored correct kebab-case mapping for `:global()` classes)
- Pause and Stop button interaction desyncs in transport controls and test environments
- Playhead teleportation, starting position bugs, and audio quality scrub issues
- Dynamic vs static import Vite build warnings for `uvr-service` and Shazam components

## [0.3.3] - 2026-05-17

### Added

- **Jam Session (new feature)**: real-time P2P music practice rooms powered by WebRTC and a Cloudflare Worker signaling server
  - Create or join a room via room code; shareable `#/jam:ROOMID` deep links auto-join on load
  - Shared melody exercise canvas with scrolling piano-roll, peer pitch trails, and a live scoreboard
  - Live pitch monitor strip showing all participants' pitch over time with per-peer color coding
  - Video and audio streaming with per-peer camera thumbnails (expandable, draggable tray)
  - In-room text chat widget
  - Host transport controls: Play, Pause, Resume, Stop, Loop, exercise picker, and live BPM override
  - TURN server support for NAT traversal
  - Auto-preloads first melody when room becomes active
- **Vocal Analysis**: offline pitch tracking panel with denoised pitch data and a toggleable offline/real-time mode
- **Practice Mode**: click-to-play and trill feature (GH #230)
- **StemMixer**: fully modularized — main component reduced from 8,500 to 776 lines via 5 controllers and 5 sub-components

### Fixed

- **LRC / Lyrics**: canonical line ordering mismatches causing incorrect active-line tracking, LRC download timings, and lyric-click seeking
- **LRC / Lyrics**: per-word timing interpolation regex and `parseLrcWordTimings` integration fixed
- **MIDI Synthesis**: progress stall at 100% — added yielding loop to `synthesizeMidiBuffer` to avoid UI hang
- **Piano Roll**: drag/move behavior corrected
- **Pitch Debug Panel**: missing CSS causing layout collapse

### Changed

- Default workspace layout is now fixed 2-column
- StemMixer SolidJS reactivity warnings resolved across all controllers

## [0.3.2] - 2026-05-15

### Added

- Precount and Anchor Tone toggles directly inside the Focus Mode toolbar
- Dynamic negative-space runway rendering in PitchCanvas to visually support count-in phases

### Fixed

- Focus Mode playhead tracking sync and trajectory easing during count-in
- "Teleport-back" physics glitches in PitchCanvas ball animation
- Desynchronization of Focus Mode playhead speed when increasing melody size beyond screen constraints
- Double playhead rendering bug in Focus Mode by fully deferring to the standard PitchCanvas playhead
- Merge conflicts and duplicate unused logic in the StemMixer Lyrics controller

## [0.3.1] - 2026-05-13

### Fixed

- Piano practice precount synchronization and "teleporting" notes effect
- Analysis tab UI layout collapse and component shrinking
- Karaoke tab WAV file upload validation across different browsers
- Vocal separator state persistence and worker re-initialization during tab navigation
- E2E test reliability by switching to hash-based navigation
- Various lint and typecheck errors across the codebase

### Changed

- Production deployments now trigger only on git tags (`v*`) instead of every push to main
- Optimized vocal separator recovery after cancellation to avoid model reloads

## [0.3.0] - 2026-05-11

### Added

- Database abstraction layer for persistent storage using Dexie.js
- Dexie-based stem persistence for UVR results, ensuring separated audio survives page reloads
- Support for WASM-based ONNX inference as fallback for Firefox (WebGPU compatibility)
- Local browser-side processing mode as the default for UVR separation

### Fixed

- Lyric service stability and fallback handling for missing data
- Vocal stem instrumental bleed in client-side UVR using STFT-domain subtraction
- Audio playback issues in stem mixer when switching sessions
- Mic sensitivity option persistence in settings
- Playwright E2E test reliability and GitHub Actions workflow configuration
- Unit test failure for UVR session status display

### Changed

- Redesigned UVR user interface with better processing status indicators and progress bars
- Improved stem mixer MIDI integration for practice sessions
- Optimized local UVR processing pipeline for better performance

## [0.2.0] - 2026-05-09

### Added

- Basic piano practice mode with black key visual feedback
- UVR (Ultimate Vocal Remover) integration for audio separation
- SwiftF0 integration for pitch detection improvements
- Developer console log component
- Changelog modal with "What's New" button
- Score modal optional setting

### Changed

- Optimized piano-roll move loop for better performance

### Fixed

- BPM safe setter and audio timing at keyboard
- Dropdown reactivity and visual visibility for judged notes
- whiteIndexToMidi octave offset
- Serving of ONNX Runtime WASM backend and dev mode MIME type
- Memory leak in useSessionSequencer (setTimeout cleanup)
- Safari error handling
- Silent errors and removed dead code
- Metronome icon alignment and duplicate divider removed

## [0.1.2] - 2026-05-06

### Added

- Perfect pitch deviance presets
- McLeod pitch detection algorithm and settings

### Changed

- Redesigned the note and accuracy score displays

### Fixed

- Yin algorithm failure when McLeod is set to 4K buffer size
- Playback and stop behavior on ESC key
- Session play issues and sequence REST getting stuck
- Per-note accuracy percentage display
- UI styles for dropdowns, sidebar, and header

## [0.1.1] - 2026-05-03

### Added

- Initial MercuryPitch voice practice application release
- Extend BPM range to 280
- Organize sidebar notes by melody and add accuracy color-coding
- Support 1-3 octaves in piano roll based on available vertical space
- Multi-select and vocal technique effects
- Scrollable playhead with drag-to-seek and timeline
- Shareable preset URLs and scale modes
- Instrument sounds (piano, organ, strings, synth)
- Settings tab with configurable pitch detection parameters and adjustable accuracy bands
- Pitch track canvas overlay on piano roll editor
- Pitch accuracy heatmap to piano roll
- Copy/cut/paste notes for piano roll editor
- Snap-to-grid toggle for piano roll editor
- Dark/light theme toggle with localStorage persistence
- Playback speed control

### Changed

- Playhead drag resumes from position with audio effects (vibrato LFO, slides, ease)
- Sync layout, instrument sounds, octave/rows/mode controls, and effects
- Extract AppHeader and AppSidebar for shared layout shell

### Fixed

- Default melody initialization in piano roll editor
- Clip pitch trail to visible canvas area during auto-scroll
- z-index layering so grid stacks correctly and piano keys are positioned properly
- Apply saved volume and default volume on app start
- Stretch piano roll to fill viewport width and synchronize playhead triangle with grid line
- Reset playhead to beat 0 on Reset to fix playhead getting stuck
- Initialize audioCtx to fix editor playback having no sound
- Prevent flash of unstyled content on load
- Preset system saves, loading scale data, and reactivity
