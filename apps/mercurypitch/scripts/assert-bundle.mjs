// The properties a Mercury Pitch store binary has to have, asserted in one
// place so both CI paths assert the same ones.
//
//   node scripts/assert-bundle.mjs <distDir> [--android-assets <dir>]
//
// Three checks, and each of them is a bug that already happened:
//
//   PRESENT  The wasm runtime and the SwiftF0 model are in the bundle.
//            scripts/sync-ort-assets.mjs vendors them; when it was an npm
//            `prebuild` hook, `pnpm exec vite build` -- how CI builds -- never
//            ran it and the bundle shipped with neither.
//
//   USED     Something in dist/assets actually names `/ort/`. This is the
//            check the old shell version did not have, and the reason it is
//            here: the app vendored the files and then did not use them.
//            `configurePitchEngineAssets` configured a package nothing in the
//            running graph imports, so the engine resolved its wasm base from
//            VITE_ONNX_WASM_BASE_URL (apps/mercurypitch/.env) and, unset, fell
//            back to a CDN on the first tap that starts the microphone -- the
//            one moment an offline-first app must not need a network. Both CI
//            jobs were green on that build.
//
//   MANIFEST Every entry in ../native-assets.mjs resolved to at least one
//            file in the bundle, and every file it resolved to in the web
//            app's public/ tree arrived. The native dist is index.html +
//            assets/ + models/ + ort/ by design, and the pictures the V1-1
//            surfaces reference by absolute URL live in public/ -- so the
//            first TestFlight build (mp-v0.1.0) came up with no twin
//            portrait, no character art and no room covers, and nothing
//            anywhere said so. A glob that matches nothing is the shape that
//            failure takes now, and it is a red check rather than a blank
//            screen on a phone.
//
//   EXAMPLES The Karaoke room's example songs arrived whole: the manifest the
//            room seeds its library from is in the bundle, and every stem it
//            names is there with the size and sha256 it was pinned at
//            (fetch-karaoke-examples.mjs). They are what a first launch with
//            no network sings, so a missing or truncated stem is a room that
//            opens on a song it cannot play -- and on the phone, a packaged
//            file that is not there answers status 0 with no body, which
//            looks like silence rather than an error.
//
//   WORKER   The built JS names exactly the db-worker this build asked for
//            (../api-base.mjs): the dev one unless MERCURYPITCH_API_TARGET=
//            production was set on purpose, and never the other one. The
//            native bundle used to compile VITE_API_BASE_URL in as undefined,
//            so every sign-in on a phone failed with "not configured" and
//            nothing in CI noticed; a test build carrying the production
//            worker would be the same silence the other way round.
//
//   UNSOLD   No built file offers a way to pay. The web app sells credit
//            packs through Stripe and links out to Ko-fi and Sponsors, and
//            `@` aliases to that same source tree; App Store guideline 3.1.1
//            and Play's billing policy each reject a binary carrying any of
//            it. The guard is a build constant (src/lib/native-build.ts) and
//            this is what proves the constant did its job in the bundle
//            rather than only in the UI.
//
//            One literal was not enough. `ko-fi.com` alone passed a bundle
//            whose Settings -> About still read "Buy credit packs (€5 / €10 /
//            €20 / €40) through Stripe's secure checkout" -- the changelog
//            is imported as raw markdown, so the prose describing the panels
//            outlived the guard on the panels. A check that names one string
//            asserts one string, not the property in its header.
//
//   NATIVE   The web Settings panel is not in the binary. The native app has
//            its own Settings, pushed by the shell; the web panel it used to
//            push instead carried links out to web-only pages, install hints
//            for a browser, a directory badge and an admin link (S6 audit,
//            D3 to D8). The panel is folded out behind IS_NATIVE_BUILD in
//            two places, and one static import anywhere would bring every
//            line of it back without a visible change on the web.
//
//   STAGE 2  The Karaoke room imports a singer's own songs in exactly the
//            builds the owner chose (27 Sep): every build that is not the
//            store build. The switch is a build constant (KARAOKE_IMPORT,
//            src/lib/native-build.ts) that api-base.mjs's karaokeImportFor
//            decides from the same target as the worker, so a store build
//            must carry none of the import, its queue, its paywall, the
//            store SDK it buys through, or its Settings rows -- absent, not
//            hidden -- and every other build must carry all of them. Play's
//            review access is Stage 2 in an Android build only, so a store
//            build is held to carrying none of it and no build to having it.
//
//   OFFER    The launch offer is not in the binary. It is the web's (owner,
//            9 Oct): the gift of credits at sign-up, the toasts that say it
//            arrived, and the extra credits on the next pack for using them
//            all, which ride on a Stripe Checkout session. Every reference
//            the native bundle can reach is folded out behind IS_NATIVE_BUILD
//            and its modules are dropped whole (LAUNCH_OFFER in
//            vite.config.ts), so no native build carries any of it.
//
//   PLAN     The plan is not in the binary. The four questions, the plan they
//            make and the layer that hosts them (src/features/plan) are the
//            web's: the native app has its own first run. Every reference the
//            native bundle can reach is folded out behind IS_NATIVE_BUILD
//            (App.tsx, GuideSelection.tsx), and the plan's store is imported
//            only by the importer App builds for the web, so no native build
//            carries a word of it. PLAN_WORDS are words only the plan has;
//            "See every room" is not one of them, First Light's Map says it
//            too.
//
// Every check runs against every bundle root it is given, `--android-assets`
// included. Those are the bytes that reach the APK, `cap sync` copies webDir
// wholesale, and a sync that did not overwrite the previous build leaves a
// tree that is stale rather than absent -- which the PRESENT checks alone
// cannot tell apart from a good one.
//
// It needs only Node and `vite` (through ../api-base.mjs, which reads the env
// files with Vite's own loader): every job that runs it -- the PR gate and
// the reusable Capacitor workflow, which knows nothing about this app -- has
// installed the workspace first.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { API_BASES, karaokeImportFor, readEnvFiles, resolveApiBase, } from '../api-base.mjs'
import { resolveNativeAssets, resolveNativeAssetSources, totalBytes, } from '../native-assets.mjs'
import { KARAOKE_EXAMPLE_PINS, NATIVE_ONLY_DIR, } from './fetch-karaoke-examples.mjs'

/** The examples manifest, relative to a bundle root. */
const EXAMPLES_MANIFEST = 'karaoke/examples/manifest.json'

/** The files sync-ort-assets.mjs vendors, relative to a bundle root. */
const VENDORED = [
  'ort/ort-wasm-simd-threaded.mjs',
  'ort/ort-wasm-simd-threaded.wasm',
  'models/swiftf0.onnx',
]

/**
 * The web app's public/ tree: where the manifest tier is copied FROM.
 *
 * Resolved from this file rather than the working directory, because the
 * reusable Capacitor workflow calls this script from the repository root and
 * the PR gate calls it from wherever it happens to be.
 */
const WEB_PUBLIC = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../public',
)

/** This app's own directory, where the env files the build read live. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Must appear in the bundle: the wasm base the engine really reads. */
const WASM_BASE = '/ort/'

/**
 * Must NOT appear in the bundle, each with what it is when it does.
 *
 * `Stripe` is capitalised on purpose: the brand in prose is the thing that
 * sells, while a lowercase `stripe` is as likely to be a CSS comment about a
 * progress bar. `stripe.com` catches every host -- checkout, buy links, the
 * SDK -- whatever case they are written in.
 */
const FORBIDDEN = [
  ['ko-fi.com', 'the Ko-fi donation link-out that DonatePanel renders'],
  ['github.com/sponsors', 'the GitHub Sponsors link-out from the same panel'],
  ['stripe.com', 'a Stripe host: checkout, a buy link, or their SDK'],
  ['Stripe', 'Stripe named in prose, which is how the changelog sold packs'],
  ['credit packs', 'the credit-pack copy'],
]

/**
 * Present in the web SettingsPanel and nowhere else the native bundle has any
 * business reaching. Each is what the panel is, when it shows up.
 */
const WEB_SETTINGS = [
  ['peerpush.com', 'the web Settings panel (SettingsPanel, its About badge)'],
]

/**
 * Present in the web sign-in dialog and nowhere else. The phone signs in
 * through its own sheet (apps/mercurypitch/src/shell/settings/SignInSheet),
 * which has no television row (audit D2).
 */
const WEB_SIGN_IN = [
  [
    'Sign in with your phone',
    'the web sign-in dialog (AuthModal, its television phone row)',
  ],
]

/**
 * The launch offer, in no native build at all. Each is the piece it is, when
 * it shows up.
 */
const LAUNCH_OFFER = [
  ['mp.launchGift', 'the launch gift store (src/stores/launch-gift-store.ts)'],
  ['Try one in Karaoke Night', "the launch gift's claim toast"],
  ['Karaoke Night credits', 'the launch gift on the Keep and Map screens'],
  ['mp.launchOffer', 'the launch offer (src/lib/launch-offer.ts)'],
  ['extra credits', "the launch offer's progress line and reward sheet"],
]

/**
 * The plan, in no native build at all. Each is a word only the plan has, so a
 * native bundle that holds one holds some of the plan. build-plan.test.ts holds
 * the list to that: each word is in the plan's own sources, and in nothing
 * outside them.
 */
const PLAN_WORDS = [
  [
    'mp.plan.text.v1',
    "the plan's typed lines (src/features/plan/plan-keys.ts)",
  ],
  ['Change my answers', "the way back to the plan's questions (PlanScreen)"],
  ['Four quick questions', "Merc's opening line on the first question"],
  // The questions' own copy, which comes with any value import of
  // plan-record.ts (it reads its ids from them), not only with the screens.
  [
    'start you where you can hear yourself',
    "Merc's answer to Singing on the first question (questions.ts)",
  ],
]

/**
 * Present in a build that imports songs, and in no other: each is a piece of
 * Stage 2 a store build must not carry.
 */
const KARAOKE_STAGE_2 = [
  ['Import a song', "the Karaoke room's Import button"],
  ['Sing your own songs', 'the Cloud offer'],
  [
    'Sign up and confirm your email for 1 free song a month',
    "the Cloud offer's free account",
  ],
  // The offer's art, found by file name: it folds with the premium rooms'
  // pictures (vite.config.ts, PREMIUM_IMAGES).
  [/\/paywall-two-lights-[\w-]{8}\.webp$/u, "the Cloud offer's art"],
  ['karaoke-room-imports', 'the import queue'],
  ['Remove imported songs', 'Settings and Storage for imported songs'],
  ['Songs this month', 'the songs left, in the room and in Settings'],
  ['See the plan', "Settings' Mercury Pitch Cloud group"],
  ['RevenueCatUI', "the store's paywall and subscription pages (RevenueCat)"],
  // A purchase made signed out goes to the account signed in to after it,
  // by the note the phone keeps of it, and the Cloud offer says so when the
  // store's subscription is another account's (karaoke-subscription.ts,
  // TestFlight build 919).
  ['mp:cloud-signed-out-purchase', 'the note of a purchase made signed out'],
  [
    'subscription is on this account now',
    'the line a subscription carried to the account gets',
  ],
  [
    'Tap Restore purchase to move it here',
    "the Cloud offer's line for another account's subscription",
  ],
  // The premium exercises ride the same subscription and the same switch
  // (PREMIUM_EXERCISES, src/lib/native-build.ts): in every build that
  // imports songs, and not in the store build until the V1 flip.
  ['long-note-room', 'the premium Long note exercise'],
  // Found by file name, not by what a file says: nothing in a store build
  // names the Long note lantern's plates, and they were in it anyway until
  // the native config folded the room's pictures (vite.config.ts,
  // PREMIUM_IMAGES).
  [/\/lantern-[a-z-]+-[\w-]{8}\.webp$/u, "the Long note lantern's plates"],
  // The same for every premium exercise painted after it: each plate and
  // sprite is named for its room (echo-, bridge-, bay-, warm- for the
  // Warm-up's night and orbs, and harbour- for Home note's painting), and
  // the folders they sit in fold with Long note's (vite.config.ts,
  // PREMIUM_IMAGES).
  [
    /\/(?:echo|bridge|bay|warm|harbour)-[a-z0-9-]+-[\w-]{8}\.webp$/u,
    "the premium exercises' plates",
  ],
  // Merc's voice for Echo's calls, found by file name the same way: the ten
  // sung "ooh" notes fold with the room's pictures (vite.config.ts,
  // PREMIUM_VOICES).
  [
    /\/echo-merc-ooh-\d+-[A-Za-z0-9]+-[\w-]{8}\.mp3$/u,
    "Merc's voice for Echo's calls",
  ],
  // The Sing room's way in to them: its exercise row, the picker, the
  // options' row and the record of the last one opened. The row and the
  // picker are lazy islands and the options' section a ternary, all on
  // PREMIUM_EXERCISES (SingRoomStage.tsx, SingRoomOptions.tsx).
  ['sing-exercise-row', "the Sing room's exercise row"],
  ['sing-exercise-picker', 'the exercise picker'],
  ['sing-options-exercises', "the Sing options' exercises row"],
  ['mp_last_exercise', 'the last exercise opened'],
  // The catalogue's own words. The four above are the way in; this is the
  // catalogue (catalogue.ts), the head of the chain into Long note's entry,
  // its remembered note, its bests and its demo's record, each a persisted
  // signal built at import. A static import of the catalogue from the store
  // graph carries none of the four, and this line with it (review C of
  // PR 973, minor 1).
  [
    'Hold one note and fill the lantern with light',
    "the exercise picker's Long note card",
  ],
  // Long note's control for the level the premium exercises are at: built
  // with the room and folded away with it. The level itself is the
  // accuracy tier from Settings (src/stores/exercise-level.ts), which every
  // build carries, so its key is no marker; this control is.
  ['long-note-level', "Long note's level control"],
  // Echo, the second premium exercise: its room, its card in the picker
  // and its level control, built and folded exactly as Long note's.
  ['echo-room', 'the premium Echo exercise'],
  [
    'Merc sings a phrase. Sing it back and light the stars',
    "the exercise picker's Echo card",
  ],
  ['echo-level', "Echo's level control"],
  // Its demo rides with the room: its take pill and its record of being
  // seen.
  ['echo-demo-take', "Echo's demo"],
  ['mp_echo_demo_seen', "Echo's demo record"],
  // Ng slides, the third: its room, its card in the picker and its level
  // control, built and folded exactly as Echo's. Its plates are the
  // bridge- files above. The level control is found by its Pro line: its
  // test id is too short to be a safe marker.
  ['ng-slides-room', 'the premium Ng slides exercise'],
  [
    'Hum five slides up a fifth and back, and light the bridge',
    "the exercise picker's Ng slides card",
  ],
  [
    'Quick slides, close to the line, and no notes in the breaths',
    "Ng slides' level control",
  ],
  // Its demo rides with the room, as Echo's does: its take pill and its
  // record of being seen.
  ['ng-demo-take', "Ng slides' demo"],
  ['mp_ng_demo_seen', "Ng slides' demo record"],
  // Lip roll, the fourth: its room, its card in the picker and its level
  // control, built and folded exactly as Ng slides'. Its plates are the
  // bay- files above.
  ['lip-roll-room', 'the premium Lip roll exercise'],
  [
    'Buzz your lips over three waves and light the bay',
    "the exercise picker's Lip roll card",
  ],
  [
    'Quick waves, close to the dots, and no notes in the breaths',
    "Lip roll's level control",
  ],
  // Its demo rides with the room, as Ng slides' does: its take pill and
  // its record of being seen.
  ['lip-demo-take', "Lip roll's demo"],
  ['mp_lip_demo_seen', "Lip roll's demo record"],
  // The Warm-up, the fifth: its path (the screen's test id, which is also
  // its id), its card in the picker, its level lines and its run of the
  // day, built and folded exactly as the rooms are. Its night and orbs are
  // the warm- files above.
  ['warm-up-path', 'the premium Warm-up and its path'],
  [
    'Four stops, about three minutes, then a song',
    "the exercise picker's Warm-up card",
  ],
  [
    'Slow waves and slides with plenty of room',
    "the Warm-up path's level lines",
  ],
  ['mp_warm_up_today', "the Warm-up's run of the day"],
  ['mp_warm_up_opened', "the Warm-up path's first open of the day"],
  // Home note, the first Ear room: its room, its card in the picker, its
  // level lines and its bests, built and folded exactly as the rooms are.
  // Its harbour painting is found by file name with the plates above. The
  // Ear Lab's way in to it (EarMercRow.tsx) is a lazy
  // island on the same switch (EarLabPage.tsx).
  ['home-note-room', 'the premium Home note exercise'],
  [
    'The band plays an intro. Sing the note that feels like home',
    "the exercise picker's Home note card",
  ],
  ['Two chords only, and less room around home', "Home note's level control"],
  ['mp_home_note_bests', "Home note's bests"],
  ['ear-merc-row', "the Ear Lab's way in to the Ear rooms"],
  // First note, the second Ear room: its room, its card, its level lines,
  // its result and its bests, on the same switch. Its theatre and songs are
  // the Karaoke room's, which every build ships.
  ['first-note-room', 'the premium First note exercise'],
  [
    'A song plays up to the singer. Come in on their first note',
    "the exercise picker's First note card",
  ],
  [
    'No line until you land, and less room around the note',
    "First note's level control",
  ],
  ['Came in on the note', "First note's result"],
  ['mp_first_note_bests', "First note's bests"],
  // Leap, the third Ear room: its room, its card, its level lines, its
  // result and its bests, on the same switch. Its cliffs are drawn.
  ['leap-room', 'the premium Leap exercise'],
  [
    'Merc sings a note and names a leap. Sing his note, then leap',
    "the exercise picker's Leap card",
  ],
  [
    'Thirds to the octave, up and down, named by the interval alone',
    "Leap's level control",
  ],
  ['Leaps landed at', "Leap's result"],
  ['mp_leap_bests', "Leap's bests"],
  // Its songs (the singer's own, read on the phone), its words hint and
  // its way on to the Karaoke room (owner, 28 Oct 2026), in the same lazy
  // chunk: the Songs sheet, the reads it keeps, the hint's switch and Sing
  // on. The read itself is a chunk of its own that only the room imports.
  ['first-note-songs-sheet', "First note's Songs sheet"],
  ['mp_first_note_own_entries', "First note's reads of the singer's songs"],
  ['mp_first_note_words', "First note's words hint"],
  ['Sing on in Karaoke', "First note's way on to the Karaoke room"],
  // The days warmed up, the week's dots, synced with the account: its key
  // and its pull merge (settings-progress.ts) fold with the rest.
  ['pitchperfect_warm_up_days', "the Warm-up's days warmed up"],
  // The native onboarding ships with the offer screens, on the same switch
  // (NATIVE_ONBOARDING, src/lib/native-build.ts): its flag, which the shell
  // imports statically (vite.config.ts lists it), and its layer, a lazy
  // chunk behind the switch.
  ['mp:native-onboarding', 'the native onboarding flag'],
  ['onboarding-not-now', "the native onboarding's Not now"],
  ["Hi, I'm Merc.", "the native onboarding's first line"],
  // Its range and reveal, in the same lazy chunk. The range also opens from
  // Keep, but only once the layer registered it (onboarding-layer.ts).
  ['onboarding-see-voice', "the native onboarding's See my voice"],
  [
    "That's your voiceprint. It changes as you practice.",
    "the native onboarding's reveal",
  ],
  // Beat 7, Keep over the layer (KeepView.tsx), and the first note's ways on
  // for a range this phone already keeps (saved-range.ts), in the same lazy
  // chunk. Keep's own sheet ships in every build, so it marks nothing here.
  ['onboarding-keep', "the native onboarding's Keep beat"],
  [
    'onboarding-see-saved',
    "the native onboarding's See my voice, a range kept",
  ],
  ['Find my range again', "the native onboarding's Find my range again"],
  // Beat 8, the sung line (useLine.ts, LineView.tsx), and beat 9's rules
  // for the Cloud offer (onboarding-offer.ts), in the same lazy chunk. The
  // offer's sheet is the import's (CloudOffer.tsx), marked above with it.
  ['Sing this line with me.', "the native onboarding's sung line"],
  ['onboarding-sung-line', "the native onboarding's sung line beat"],
  [
    'mp:onboarding-offer-group',
    "the native onboarding's Cloud offer holdout group",
  ],
  [
    'mp:onboarding-cloud-offer',
    "the native onboarding's Cloud offer, once an install",
  ],
  // Part 5: beat 1, Merc's welcome in the alley (AlleyGuide.tsx, a lazy
  // chunk of its own behind the switch), the beats giving way by a View
  // Transition (beat-swap.ts), the one way on from a refused mic, and Merc
  // by the Cloud offer's art. The onboarding's counts and the Cloud offer's
  // and the import gate's (S7b §7) go with what they count.
  ['alley-guide', "beat 1, Merc's welcome in the alley"],
  ['mp-beat-swap', "the native onboarding's beats giving way"],
  [
    'onboarding-without-mic',
    "the native onboarding's Continue without the mic",
  ],
  ['cloud-offer-guest', "Merc by the Cloud offer's art"],
  ['native_onboarding_', "the native onboarding's counts"],
  ['cloud_view_', "the Cloud offer's counts"],
  ['import_tap_', "the import gate's counts"],
  // Part 6: the Cloud offer the onboarding's own Not now opens, counted
  // apart from the one at its end (owner, 20 Oct 2026).
  [
    'cloud_view_onboarding_exit',
    "the Cloud offer from the native onboarding's Not now",
  ],
  // The Ear Lab with Merc, on the same switch until the owner flips it
  // (EAR_LAB_WITH_MERC, src/lib/native-build.ts): the tab and the drill
  // room are one lazy chunk behind it (EarStage.tsx, EarLabPage.tsx), and
  // the Ear rooms' row on its tab rides PREMIUM_EXERCISES. Crimson Pro,
  // Merc's serif, is imported by that chunk alone and found by file name.
  ['merc-bench', "the Ear Lab with Merc's tab"],
  ['data-merc-room', "the Ear Lab with Merc's drill room"],
  ["New here? Start with today's three.", "Merc's line on a first visit"],
  [
    'Nothing from this run is kept, and Today stays as it was.',
    "the drill room's End the run",
  ],
  ['mercurypitch_ear_merc_today', "the day's moves, kept for its close"],
  [
    'The microphone is off for Mercury Pitch, so nothing started.',
    "the drill room's refused microphone",
  ],
  ['ear-rooms-row', "the Ear Lab with Merc's Ear rooms row"],
  // The day's close's reminder switch, and what the phone shows each
  // morning (merc/reminder.ts): the words that set one, which fold with
  // the room, and with them the bridge that schedules it (native-device.ts).
  ['Remind me tomorrow at 8:30', "the day's close's reminder switch"],
  ["Today's three are waiting in the Ear Lab.", "Merc's morning reminder"],
  // Hairline's loupe as the room draws it, upright (merc/RoomLoupe.tsx).
  ['upright-loupe', "the room's upright loupe for Hairline"],
  [
    /\/crimson-pro-latin-wght-normal-[\w-]{8}\.woff2$/u,
    "Merc's serif (Crimson Pro)",
  ],
  // His stills there, imported by the chunk at the size it shows them:
  // the coach's own live in the web's public/, which no native build lists.
  // And the Wild's glasshouse at night, behind the Field Book.
  [
    /\/(?:merc-(?:point|listen|celebrate)|glasshouse-night)-[\w-]{8}\.webp$/u,
    "Merc's stills and the Wild's glasshouse in the Ear Lab with Merc",
  ],
  // Leagues on the phone, on the same switch until the owner flips it
  // (NATIVE_LEAGUES, src/lib/native-build.ts): the screen is a lazy chunk
  // behind it (NativeShell.tsx), the league the More sheet's row names is
  // free of side effects in the native config, and the row's line is
  // worked out inside the More sheet's folded Together group. A row is
  // found by its words, never by `data-more-item`: the sheet sets that
  // from a prop, so no bundle spells it out.
  ['shell-leagues', 'the Leagues screen'],
  ['Climb a rung every week', "the Leagues screen's way in, signed out"],
  ['mp:league-card', "the league the More sheet's row names"],
  ['A rung higher every week', "the More sheet's Leagues row"],
  // The Legend room (slice 3), on the same switch: its screen is a lazy
  // chunk behind it, the store its More row reads is free of side effects,
  // and the row's line is worked out inside the same folded group.
  ['shell-legend', 'the Legend room'],
  ['Practice without ranking', "the Legend room's ask before a ranked take"],
  ['mp:legend-card', "the Legend the More sheet's row names"],
  ['The line everyone sings', "the More sheet's Legend row"],
  // The Sing room's card over its exercises is worded by the shell
  // (legend-card-wiring.ts), so a store build carries none of its words.
  ['Everyone sings the same notes', "the Sing room's Legend card"],
]

/**
 * Stage 2 as well, but only in a build not made for iOS: an iOS build folds it
 * away on purpose (KaraokeReviewAccess.tsx, IN_A_PLAY_BUILD). So a store build
 * carries none of it, an importing iOS build none either, and any other
 * importing build all of it (review of PR 882, nit 10).
 */
const KARAOKE_STAGE_2_ANDROID = [
  ['api/billing/review-access', "Play's review access (Settings, Android)"],
]

/**
 * The env var a native build is told its platform in (capacitor-app.yml
 * exports it to each verify step as to the build); unset in a local build and
 * in the PR gate's.
 */
const NATIVE_PLATFORM_ENV = 'VITE_MERCURYPITCH_NATIVE_PLATFORM'

/** The platform this build was made for, read the way the build read it: the
 *  process first, then the env files for mode production. '' when unset. */
function nativePlatform() {
  return (readEnvFiles(APP_DIR, 'production')[NATIVE_PLATFORM_ENV] ?? '').trim()
}

const failures = []

/** One line per check, whichever way it went. */
function record(ok, label, fix) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok) failures.push(`${label}\n        ${fix}`)
}

/** Every file under `dir`, recursively. Missing directory means no files. */
function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/**
 * Read as bytes, not text. dist/assets holds fonts and images alongside the
 * chunks, and decoding those as UTF-8 would be wasted work at best.
 */
function contains(file, needle) {
  return readFileSync(file).includes(needle)
}

function main(argv) {
  const args = argv.slice(2)
  let distDir
  let androidAssetsDir

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--android-assets') {
      androidAssetsDir = args[i + 1]
      i += 1
    } else if (distDir === undefined) {
      distDir = args[i]
    } else {
      console.error(`assert-bundle: unexpected argument ${args[i]}`)
      return 1
    }
  }

  if (
    distDir === undefined ||
    (androidAssetsDir !== undefined && androidAssetsDir === '')
  ) {
    console.error(
      'usage: node scripts/assert-bundle.mjs <distDir> [--android-assets <dir>]',
    )
    return 1
  }

  console.log(`assert-bundle: ${distDir}`)

  // WORKER -- what this build ASKED for, resolved the way vite.config.ts
  // resolved it: the same env files for mode production, the same process.
  let api
  try {
    api = resolveApiBase(readEnvFiles(APP_DIR, 'production'), process.env)
    console.log(
      `      API base requested: ${api.base === '' ? '(none)' : api.base} [${api.target}; ${api.source}]`,
    )
  } catch (error) {
    record(
      false,
      'the requested API base resolves',
      error instanceof Error ? error.message : String(error),
    )
  }
  const platform = nativePlatform()
  console.log(
    `      Native platform: ${platform === '' ? '(unset)' : platform} [${NATIVE_PLATFORM_ENV}]`,
  )

  // Every root gets every check. The Android copy is what `cap sync` left
  // behind, and a sync that did not overwrite the previous build leaves the
  // last bundle sitting there -- present, complete, and wrong.
  const roots = [
    ['dist', distDir],
    ...(androidAssetsDir === undefined
      ? []
      : [['android assets', androidAssetsDir]]),
  ]

  for (const [label, root] of roots) {
    const synced = label !== 'dist'

    // PRESENT -- a file missing from only the Android copy means cap sync
    // did not copy it, which is a different fix from the build not
    // producing it.
    for (const file of VENDORED) {
      record(
        existsSync(join(root, file)),
        `${label}: ${file} is present`,
        `Run scripts/sync-ort-assets.mjs (the vite.config.ts plugin runs it for every build) and rebuild${synced ? ', then cap sync' : ''}.`,
      )
    }

    const assets = walk(join(root, 'assets'))
    record(
      assets.length > 0,
      `${label}: ${join(root, 'assets')} holds built files`,
      `${synced ? 'cap sync copied no bundle here' : 'The build produced no assets directory'}. Nothing below this line means anything until it does.`,
    )

    // USED
    record(
      assets.some((file) => contains(file, WASM_BASE)),
      `${label}: a built chunk names ${WASM_BASE}`,
      `No chunk references ${WASM_BASE}, so the engine will resolve its wasm base to the CDN fallback at runtime. Check that VITE_ONNX_WASM_BASE_URL is set in apps/mercurypitch/.env and that the build read it.`,
    )

    // MANIFEST -- resolve the same globs against this bundle root that
    // sync-native-assets.mjs resolved against public/ and native-only/ on the
    // way in. An entry that matched four files there and none here is a
    // publicDir that was not copied; an entry that matches nothing in either
    // is a rename, and the staging step has already refused to build.
    const staged = resolveNativeAssetSources({
      public: WEB_PUBLIC,
      native: NATIVE_ONLY_DIR,
    })
    const bundled = resolveNativeAssets(root)

    for (const entry of bundled.entries) {
      record(
        entry.files.length > 0,
        `${label}: ${entry.glob} resolves (${entry.files.length} file${entry.files.length === 1 ? '' : 's'})`,
        `Nothing in ${root} matches this manifest entry. ${entry.reason} ${
          synced
            ? 'cap sync did not copy the publicDir, or this is a stale bundle.'
            : 'Check that vite.config.ts still points publicDir at the staged directory scripts/sync-native-assets.mjs fills.'
        }`,
      )
    }

    // Every file the manifest resolves to in its source trees has to be here
    // too. The per-entry check above passes on a partial copy; this one does
    // not.
    const absent = staged.files
      .map((file) => file.path)
      .filter((file) => !existsSync(join(root, file)))
    record(
      staged.files.length > 0 && absent.length === 0,
      `${label}: all ${staged.files.length} manifest files were copied`,
      staged.files.length === 0
        ? `The manifest resolved to no files at all under ${WEB_PUBLIC} or ${NATIVE_ONLY_DIR}. Either a source tree is missing from this checkout or every glob in native-assets.mjs is stale.`
        : `Missing here: ${absent.slice(0, 8).join(', ')}${absent.length > 8 ? ` (+${absent.length - 8} more)` : ''}. Rebuild${synced ? ', then cap sync' : ''}.`,
    )

    // EXAMPLES -- the songs a first launch with no network sings.
    const examplesFile = join(root, EXAMPLES_MANIFEST)
    /** @type {string[]} */
    let named = []
    try {
      const examples = JSON.parse(readFileSync(examplesFile, 'utf8'))
      named = examples.songs.flatMap((song) => [
        song.stems.vocal,
        song.stems.instrumental,
      ])
    } catch (error) {
      named = []
      record(
        false,
        `${label}: ${EXAMPLES_MANIFEST} is readable`,
        `${error instanceof Error ? error.message : String(error)}. The Karaoke room seeds its example songs from this file.`,
      )
    }
    const wrong = named.flatMap((url) => {
      const path = String(url).replace(/^\//u, '')
      const pin = KARAOKE_EXAMPLE_PINS.find(
        (candidate) => candidate.path === path,
      )
      const file = join(root, path)
      if (pin === undefined) return [`${path} (no pin)`]
      if (!existsSync(file)) return [`${path} (missing)`]
      const bytes = readFileSync(file)
      const hash = createHash('sha256').update(bytes).digest('hex')
      return bytes.byteLength === pin.bytes && hash === pin.sha256
        ? []
        : [`${path} (${bytes.byteLength} bytes, sha256 ${hash.slice(0, 12)})`]
    })
    record(
      named.length > 0 && wrong.length === 0,
      `${label}: the ${named.length} example stems the Karaoke room names are here, as pinned`,
      named.length === 0
        ? `${EXAMPLES_MANIFEST} names no stems.`
        : `Wrong or missing: ${wrong.join(', ')}. The build stages them from native-only/ after scripts/fetch-karaoke-examples.mjs verified them${synced ? '; cap sync did not copy them, or this is a stale bundle' : ''}.`,
    )

    const manifestBytes = totalBytes(root, bundled.files)
    console.log(
      `      manifest tier: ${bundled.files.length} files, ${manifestBytes} bytes (${(manifestBytes / 1024 / 1024).toFixed(2)} MiB)`,
    )
    if (!synced) {
      for (const entry of bundled.entries) {
        console.log(
          `        ${String(totalBytes(root, entry.files)).padStart(9)} B  ${entry.glob}`,
        )
      }
    }

    // WORKER -- the requested base is in the JS, and no other known one is.
    if (api !== undefined) {
      const chunks = assets.filter((file) => file.endsWith('.js'))
      const named = (needle) => chunks.some((file) => contains(file, needle))
      if (api.base === '') {
        console.log(
          `warn  ${label}: no API base compiled in -- a local-only build, sign-in and sync are off (apps/mercurypitch/.env names the dev worker; see .env.example)`,
        )
      } else {
        record(
          named(api.base),
          `${label}: the built JS names the requested API base ${api.base}`,
          `No chunk carries ${api.base}, so auth-service throws "VITE_API_BASE_URL is not configured" on the phone. Check that vite.config.ts still compiles api-base.mjs's answer in through \`define\`${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}.`,
        )
      }
      const others = Object.values(API_BASES).filter(
        (base) => base !== api.base && named(base),
      )
      record(
        others.length === 0,
        `${label}: no other db-worker is compiled in`,
        `Found ${others.join(', ')} beside the requested ${api.base === '' ? '(none)' : api.base}. A test build must not carry the production worker, and a store build must not carry the dev one${synced ? '; or this is a stale bundle' : ''}.`,
      )
    }

    // UNSOLD
    const selling = []
    for (const file of assets) {
      for (const [needle, what] of FORBIDDEN) {
        if (contains(file, needle))
          selling.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      selling.length === 0,
      `${label}: no built file offers a way to pay`,
      `Found ${selling.join('; ')}. Something reaches a paid surface from a path CAN_TAKE_PAYMENT does not guard (src/lib/native-build.ts)${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. A store binary that carries a payment page, its link or its prose is rejected, not warned.`,
    )

    // NATIVE
    const webSettings = []
    for (const file of assets) {
      for (const [needle, what] of WEB_SETTINGS) {
        if (contains(file, needle))
          webSettings.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      webSettings.length === 0,
      `${label}: the web Settings panel is not in the bundle`,
      `Found ${webSettings.join('; ')}. Something imports the web SettingsPanel without the IS_NATIVE_BUILD fold (src/App.tsx) or reaches it from the shell${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The native Settings is apps/mercurypitch/src/shell/settings.`,
    )

    // STAGE 2 -- decided from the same answer as WORKER, so it can only be
    // asked once the requested base resolved.
    if (api !== undefined) {
      const importing = karaokeImportFor(api)
      const ios = platform === 'ios'
      const expected = importing
        ? [...KARAOKE_STAGE_2, ...(ios ? [] : KARAOKE_STAGE_2_ANDROID)]
        : []
      const carried = [...KARAOKE_STAGE_2, ...KARAOKE_STAGE_2_ANDROID].filter(
        ([needle]) =>
          assets.some((file) =>
            needle instanceof RegExp
              ? needle.test(file.replace(/\\/gu, '/'))
              : contains(file, needle),
          ),
      )
      const missing = expected.filter((piece) => !carried.includes(piece))
      const extra = carried.filter((piece) => !expected.includes(piece))
      const pieces = (list) =>
        list.map(([needle, what]) => `${needle} (${what})`).join('; ')
      const problems = []
      if (missing.length > 0) {
        problems.push(
          `Missing: ${pieces(missing)}. A ${api.target} build compiles KARAOKE_IMPORT in as true (vite.config.ts, api-base.mjs karaokeImportFor), and only an iOS build folds Play's review access away (KaraokeReviewAccess.tsx)${synced ? '; or this is a stale bundle' : ''}.`,
        )
      }
      if (extra.length > 0) {
        problems.push(
          importing
            ? `Found ${pieces(extra)} in a build for ${platform}. An iOS build folds Play's review access away (KaraokeReviewAccess.tsx, ${NATIVE_PLATFORM_ENV}=ios)${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}.`
            : `Found ${pieces(extra)}. Something reaches Stage 2 from a path KARAOKE_IMPORT does not fold away (src/lib/native-build.ts)${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}.`,
        )
      }
      record(
        problems.length === 0,
        importing
          ? `${label}: the Karaoke room imports songs in this ${api.target} build for ${platform === '' ? 'no named platform' : platform} (${expected.length} pieces)`
          : `${label}: the store build carries no Karaoke import`,
        problems.join(' '),
      )
    }

    const webSignIn = []
    for (const file of assets) {
      for (const [needle, what] of WEB_SIGN_IN) {
        if (contains(file, needle))
          webSignIn.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      webSignIn.length === 0,
      `${label}: the web sign-in dialog is not in the bundle`,
      `Found ${webSignIn.join('; ')}. Something renders the web AuthModal without the IS_NATIVE_BUILD fold (src/App.tsx) or reaches it from the shell${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The native way in is the shell's sign-in sheet; openAuthModal routes to it.`,
    )

    // OFFER
    const launchOffer = []
    for (const file of assets) {
      for (const [needle, what] of LAUNCH_OFFER) {
        if (contains(file, needle))
          launchOffer.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      launchOffer.length === 0,
      `${label}: the launch offer is not in the bundle`,
      `Found ${launchOffer.join('; ')}. Something reaches the launch gift or the offer from a path the IS_NATIVE_BUILD fold does not guard, or one of its modules is missing from LAUNCH_OFFER in vite.config.ts${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The offer is the web's; its bonus rides on Stripe Checkout.`,
    )

    // PLAN
    const planWords = []
    for (const file of assets) {
      for (const [needle, what] of PLAN_WORDS) {
        if (contains(file, needle))
          planWords.push(`${needle} (${what}) in ${file}`)
      }
    }
    record(
      planWords.length === 0,
      `${label}: the plan is not in the bundle`,
      `Found ${planWords.join('; ')}. Something reaches the plan from a path the IS_NATIVE_BUILD fold does not guard (src/App.tsx, src/components/GuideSelection.tsx), or imports one of its modules statically${synced ? ', or this is a stale bundle cap sync did not overwrite' : ''}. The plan is the web's.`,
    )
  }

  if (failures.length > 0) {
    console.error(`\nassert-bundle: ${failures.length} check(s) failed.`)
    for (const failure of failures) console.error(`  - ${failure}`)
    return 1
  }

  console.log('\nassert-bundle: every check passed.')
  return 0
}

process.exit(main(process.argv))
