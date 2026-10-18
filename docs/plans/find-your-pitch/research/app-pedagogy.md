# MercuryPitch: what the app already teaches and lets you practise

Research for the premium tutorial series (web lesson page + YouTube explainer per
lesson, hosted by blue Merc and orange Merc). Goal: every lesson ends with a
"practise this now in the app" link that lands on the right drill.

Read-only research on `/home/user/mercurypitch` at `9685d9f` (main, 2026-10-16).
No files in the repo were modified. The public site (mercurypitch.com) was not
fetched; all routes come from the repo.

---

## 0. The decision-relevant findings, first

1. **There is no "open drill X" URL for most of the app.** Clean URLs exist for
   rooms (`/mirror`, `/vocal-range-test`, `/ear-lab`, `/pitch-training`, ...)
   and hash routes exist for tabs (`#/exercises`, `#/path`, ...). Only **four**
   per-drill marketing links exist (`/exercises/<slug>`). No URL opens a
   specific Ear Lab drill, a Zen pitch loop, a warm-up pattern, a scale type, or
   an Ascent week. Lesson links will need a small engineering extension (see
   §2.8). The extension point is designed for it: `src/features/exercises/slug-map.ts`
   says "Add new ones freely".
2. **A first-time visitor who follows any lesson link gets First Light (the
   onboarding intro) first**, unless the route explicitly dismisses it (only
   jam-room, sync, shared-result and `#/map` do). `src/App.tsx:857-860`,
   `src/stores/ui-store.ts:302-321`. Decide whether lesson links should skip it
   (precedent: `src/features/routing/useHashRouter.ts:273-276`).
3. **The web Exercises do not fold octaves.** Lesson 1 (in progress at
   `output/motion/lesson-01/script.json`) tells singers "an octave up or down
   still counts". That holds in Voice Mirror's Match task, Ear Lab sung answers,
   the karaoke Zen ribbon and premium Echo (Learning tier). It does **not** hold
   in the 19 web drills (`src/features/exercises/exercise-scoring-utils.ts:119-165`:
   linear `100 - 1.5 x avg cents`, an octave off scores 0). Lesson 1's CTA
   should point at `/mirror` or the Ear Lab, not at a web drill. Or the drills
   need an octave-fold option.
4. **The premium exercises (Long note lantern, Echo stars, Lip roll, Ng slides)
   are not on the web at all.** They compile only into native test builds
   (`src/lib/native-build.ts:53-68`). They are off in the store build until the
   subscription ships, and the App Store and Play chips say "coming soon".
   Lessons cannot link them. Web stand-ins exist for each (§3.5).
5. **A safety and claims foundation is binding** (`src/lib/guided-voice/claims.ts`,
   `docs/specs/guided-voice-check.ears.md` §3 and §8, `PRODUCT.md`). Lesson copy
   and CTAs must not rate breath support, pathologise registers or glide gaps,
   score SOVT output, reward "hold as long as you can", assess pronunciation,
   or invent a composite voice score. Discomfort always wins. Safety guidance
   is never paid.
6. **The vocabulary is mostly consistent, with a few slips.** The app uses
   scientific pitch notation (C4 = MIDI 60 = middle C), A4 = 440 Hz (fixed, not
   user-settable), sharps-only labels, cents (100 per semitone), movable-do
   solfege with do-based minor, and accuracy bands Perfect/Excellent/Good/Okay.
   But "Perfect pitch" is used to mean "inside the Perfect band". The band
   thresholds quoted in the Learn chapters (10/25/50/75) match no shipped
   preset. One Learn chapter has a factual error (C minor's "relative major (A
   Major)"). Lessons should not copy these. See §5 and §8.
7. **An in-app lesson home already exists.** It is a markdown read-along
   chapter system: Home has a "Learn" button, routes are `#/learn` and
   `#/learn/<chapterId>`, and the chapters live in `src/types/walkthrough.ts`.
   There are already "Understanding Pitch" and "Common Musical Scales" chapters.
   The Ascent's week cards also take curated video links as data
   (`ResourceLink` in `src/features/path/path-content.ts`), so the series'
   videos could slot into Ascent weeks without code.
8. **Zero-code link mechanisms exist, with side effects.** `#/share/<base64>`
   can carry a melody (opens in Compose, with per-note lyric text), an exercise
   (opens and auto-starts; ignores target notes and difficulty), or a routine
   (replaces today's routine and auto-starts). Usable for prototypes. Not ideal
   for a polished CTA (§2.4).
9. **Gaps to plan around** (full table in §7): straw phonation, registers,
   vowels/resonance drills, keyboard geography and note naming, sharps/flats
   spelling and enharmonics, circle of fifths (key picker offers only C G D A E
   B F Bb), sung minor and descending intervals, sung triads in Chord Stacker
   (7th chords only), sung rhythm scoring, solo harmony-line singing, and
   major-vs-minor scale ear ID.

---

## 1. Sources read

| File                                                                                                                                           | Why                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `PRODUCT.md`                                                                                                                                   | Product rules (Zen, Hear Yourself, scoring limits, en-GB, honest metrics) |
| `docs/agent/DOCS-AUDIT.md`                                                                                                                     | Which plans are stale vs live (many "pending" plans shipped)              |
| `docs/agent/INDEX.md`                                                                                                                          | Module map                                                                |
| `CHANGELOG.md` (0.7.x to 0.9.18, 2026-10-15)                                                                                                   | What shipped and when                                                     |
| `src/lib/hash-router.ts`, `src/features/routing/useHashRouter.ts`, `src/features/tabs/constants.ts`                                            | Hash routes and tab ids                                                   |
| `src/seo/entry-pages.ts`, `src/worker.ts`, `public/_redirects`, `public/sitemap.xml`, `public/llms.txt`                                        | Clean-path entry documents                                                |
| `src/features/exercises/slug-map.ts`, `src/App.tsx` (598-646, 932-1023, 2911-2921)                                                             | `/exercises/<slug>` and `#/share/` launches                               |
| `src/features/path/path-content.ts`                                                                                                            | The Ascent                                                                |
| `src/features/exercises/*` (`ExerciseMenu.tsx`, `exercise-help.ts`, each controller, `warmup/warmup-exercises.ts`)                             | Web drills                                                                |
| `src/features/zen/exercise-catalog.ts`, `docs/zen-singing-exercises.md`                                                                        | Zen guided pitch loops                                                    |
| `src/features/premium-exercises/*`, `src/lib/native-build.ts`, `apps/mercurypitch/*`                                                           | Premium exercise gating                                                   |
| `src/lib/ear/{drills,banks,path,phrase,wild,progressions}.ts`, `src/features/ear-lab/{instruments,drill-views}.ts`, `src/pages/EarLabPage.tsx` | Ear Lab                                                                   |
| `src/lib/guided-voice/*`, `docs/specs/guided-voice-check.ears.md`, `src/features/voice-history/GuidedVoiceCheck.tsx`                           | Safety and claims foundation                                              |
| `src/features/mirror/*`, `src/lib/mirror/{metrics,legend-catalog,free-sing}.ts`                                                                | Voice Mirror family                                                       |
| `src/features/onboarding/*`, `docs/plans/onboarding-first-light.md`                                                                            | First Light                                                               |
| `src/features/challenges/*`, `src/components/VocalChallenges.tsx`                                                                              | Challenges and Legends                                                    |
| `src/features/routines/*`, `src/features/practice-intelligence/*`                                                                              | Routines, weakness drills                                                 |
| `src/stores/settings-store.ts`, `src/components/SettingsPanel.tsx`                                                                             | Tiers, bands, voice ranges, tonic anchor                                  |
| `src/lib/scale-data.ts`, `src/lib/note-utils.ts`, `src/features/sidebar/panels/PlaybackSetupPanel.tsx`, `src/stores/melody-store.ts`           | Scales, keys, note naming                                                 |
| `src/types/walkthrough.ts`, `src/types/walkthrough-content-extended.ts`                                                                        | Existing in-app Learn chapters                                            |
| `src/lib/jam/jam-modes.ts`                                                                                                                     | Harmony Stack                                                             |
| `docs/plans/ear-training.md`, `ear-rhythm-drills.md`, `ear-lab-follow-up.md`, `onboarding-first-light.md`, `premium.md`, `backlog.md`          | Pedagogical decisions                                                     |
| `output/motion/lesson-01/script.json` (read only)                                                                                              | What lesson 1 claims, so CTAs match                                       |

---

## 2. How to deep-link into the app

### 2.1 Clean-path entry documents (real crawlable pages, URL kept)

Source of truth: `ENTRY_PAGES` in `src/seo/entry-pages.ts`. Each is a generated
HTML document with a text prelude. The app boots in place on the same URL.
Studio-tab entries set their hash client-side via `bootHash`.

| URL                                                                              | Boots                                      | Lands on                                                                         | What it does                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://mercurypitch.com/mirror` (alias `/free-sing`)                           | `src/features/mirror/main.tsx`             | Voice Mirror                                                                     | Glide up and down (range), Hold (steadiness), Match 5 (accuracy in cents, octave-folded). Then voice type and a "twin" legend. About 60-90 s. `/free-sing` is an open 40 s take (range in use, tessitura, home note, phrase lengths, vibrato). |
| `/vocal-range-test`                                                              | mirror                                     | Voice Mirror, `vocal-range` intent (`src/features/mirror/entry-intent.ts:15-29`) | Glide lowest to highest. Shows both notes, the span in semitones and a voice-type guide                                                                                                                                                        |
| `/voice-type-test`                                                               | mirror                                     | Voice Mirror (same app, voice-type prelude copy)                                 | Shows which of 6 bands (bass to soprano) the range overlaps most. "A guide, not a classification"                                                                                                                                              |
| `/which-singer-has-my-vocal-range`                                               | mirror                                     | Voice Mirror (twin-focused prelude)                                              | Range, then voice type, then a famous singer of that type. Compares notes, not timbre                                                                                                                                                          |
| `/tone-deaf-test`                                                                | 301 to `/mirror` (`public/_redirects`)     |                                                                                  | Deliberately does not diagnose amusia                                                                                                                                                                                                          |
| `/pitch-training`                                                                | `src/index.tsx`, `bootHash: '#/exercises'` | Exercises library                                                                | Pitch-training front door (sustained notes, sirens, slides, intervals, scales, staccato, vibrato)                                                                                                                                              |
| `/ear-lab`                                                                       | `src/index.tsx`, `bootHash: '#/ear-lab'`   | Ear Lab bench                                                                    | Ear training measured in cents, ms and notes                                                                                                                                                                                                   |
| `/jam` (alias `/jam-rooms`)                                                      | `src/index.tsx`, `bootHash: '#/jam'`       | Jam                                                                              | Group singing, Harmony Stack                                                                                                                                                                                                                   |
| `/glass` (aliases `/break-glass-with-your-voice`, `/high-note-test`, `/shatter`) | `src/features/glass/main.tsx`              | Break Glass                                                                      | 60 s challenge: reach a note at the top of your comfortable range and hold it steady                                                                                                                                                           |
| `/karaoke-night` (alias `/karaoke`)                                              | karaoke-night                              | Karaoke Night                                                                    | `?song=josephine` / `goodbye-to-spring` / `nothing-in-the-dark` stages an example song. `&zen=1` opens Zen (CHANGELOG 0.9.17, `src/features/karaoke-night/example-links.ts`)                                                                   |
| `/vocal-remover`                                                                 | karaoke-night                              | Karaoke Night                                                                    | Stem separation                                                                                                                                                                                                                                |
| `/piano-night`, `/guitar-night`, `/drum-night`                                   | own entries                                | Instrument rooms                                                                 | Piano Night has falling notes, a staff and a hands-on-keys view. Drum Night reports timing in ms                                                                                                                                               |
| `/glass-game`                                                                    | glass-adventure                            | Glassworks                                                                       | **Do not link.** Unlisted on production web and owned by Beside Cue (`tools/glassworks-listing.ts`)                                                                                                                                            |

### 2.2 Hash routes (`https://mercurypitch.com/#/...`)

Tab ids are in `src/features/tabs/constants.ts`. The parser is
`src/lib/hash-router.ts` (`parseHash`, tab match at line 362). A query on a tab
hash is ignored, except `?add=` on the leaderboard.

| Hash                                 | Surface                                                                                                                             | Notes                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `#/home`                             | Home: streak, today's generated session, Legend, room cards, **Learn** button (`src/pages/HomePage.tsx:184`)                        | Default tab                                                                                  |
| `#/path`                             | The Ascent (7 themed weeks)                                                                                                         | No per-week hash                                                                             |
| `#/progress`                         | Progress (Resonance Atlas, badges)                                                                                                  |                                                                                              |
| `#/voice-history`                    | Hear Yourself: kept takes, Twin Trails, Guided Voice Check (Pitch Centre)                                                           |                                                                                              |
| `#/singing`                          | Singing tab: live pitch canvas, key/scale picker, metronome, tonic anchor, melodies                                                 |                                                                                              |
| `#/exercises`                        | Exercise library (19 cards) plus "Guided pitch loops" chip into Zen                                                                 | No per-exercise hash                                                                         |
| `#/challenges`                       | Vocal challenges (12 categories, drill-backed)                                                                                      |                                                                                              |
| `#/ear-lab`                          | Ear Lab bench                                                                                                                       | No per-drill hash                                                                            |
| `#/piano`, `#/guitar`                | Piano falling notes, guitar practice                                                                                                |                                                                                              |
| `#/karaoke`, `#/jam`, `#/jam:ROOMID` | Karaoke tab, Jam, a specific room                                                                                                   | Jam room links dismiss First Light                                                           |
| `#/community`, `#/leaderboard`       | Community, leaderboards plus Legends view                                                                                           |                                                                                              |
| `#/compose`, `#/analysis`            | Piano-roll editor, Analysis dashboard (spectrogram, timbre card)                                                                    |                                                                                              |
| `#/settings/practice`                | Settings Practice section: voice range, "Find my voice", full range test, accuracy tier, score window, tonic anchor, accuracy bands | Slugs: account, practice, karaoke, display, sync, credits                                    |
| `#/learn`                            | Learn chapter picker (modal over current tab)                                                                                       |                                                                                              |
| `#/learn/<chapterId>`                | One read-along chapter                                                                                                              | e.g. `#/learn/study-pitch-basics`, `#/learn/study-scale-types`, `#/learn/exercises-overview` |
| `#/guide`, `#/guide/<section>`       | Spotlight tour picker or tour                                                                                                       |                                                                                              |
| `#/map`                              | Replays the First Light Map (dismisses First Light)                                                                                 |                                                                                              |
| `#/voice-constellation`              | Saved Voice Mirror matches                                                                                                          |                                                                                              |
| `#/whats-new`                        | Release page                                                                                                                        |                                                                                              |
| `#/share/<base64url>`                | Melody, exercise or routine payload                                                                                                 | See §2.4                                                                                     |

### 2.3 `/exercises/<slug>` marketing launch intents (the right mechanism for lesson CTAs)

`src/features/exercises/slug-map.ts:47-65` holds the registry. The worker
serves the shell for `^/exercises/[a-z0-9-]+/?$` (`src/worker.ts:105,468`; it
must stay in `wrangler.jsonc assets.run_worker_first`). The app applies the
slug once on boot (`src/App.tsx:2911-2921`, `applyExerciseSlug` at 598-646) and
then cleans the URL to `/`.

Behaviour: it opens the exercise **on its setup screen**, pre-configured. It
**does not auto-start**, on purpose: the mic needs a user gesture
(`src/App.tsx:641-646`). Target notes are re-fitted to the singer's saved voice
range (`fitPhraseToRange(authored, vocalRangePreset())`). Unknown slugs show
"Exercise not found" and fall through.

Existing slugs:

| URL                         | Opens                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| `/exercises/perfect-octave` | Interval Trainer, notes `['C4','C5']` (range-fitted)                           |
| `/exercises/speed-scales`   | Scale Runner on `scale-major-c4`, **difficulty 8 (fast)**. Not a beginner link |
| `/exercises/karaoke-duel`   | Karaoke tab                                                                    |
| `/exercises/jam-relay`      | Jam tab                                                                        |

`Launch` supports `{kind:'exercise', exercise, notes?, scaleId?, difficulty?}`
or `{kind:'tab', tab}`. Adding a slug for any of the 19 web exercises with notes
and difficulty is a **data-only edit**. These are not supported today:
`pattern` (warm-up patterns; the warm-up does read `launchPattern`), scale type
(Scale Runner always opens on Major,
`src/features/exercises/scale-runner/ScaleRunnerExercise.tsx:52`), Ear Lab
drills, Zen loops, Learn chapters.

Seeded melody ids usable as `scaleId` (`src/stores/melody-store.ts:390-486`):
`scale-major-c4`, `scale-major-g4`, `scale-major-c3`, `scale-major-g3`,
`scale-major-c2`, `scale-major-g2`, `scale-chromatic-c4`,
`scale-natural-minor-a4`, `scale-pentatonic-c4`, `scale-dorian-d4`. Each also
comes in `-8b`, `-12b` and `-16b` length variants.

The landing site's Try buttons live in another repo
(`packages/mercurypitch/src/components/Community.astro` is referenced in the
slug-map comment but is not in this repo). The sitemap deliberately leaves out
`/exercises/<slug>` because those paths canonicalise to `/`. That is fine for
lesson CTAs.

### 2.4 `#/share/<base64url(JSON)>` payloads: works today, with caveats

`src/lib/share-codec.ts`: `{v:1, t:'melody'|'exercise'|'routine', n?, d}`.

| Type     | Payload `d`                                                                                | What the app does (`src/App.tsx`)                                                                                                                         | Caveat for lessons                                                                                            |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| melody   | `{n, b (bpm), k?, s?, i: [[midi,startBeat,dur,vel?,effect?,slide?,vib?,lyricText?], ...]}` | Loads into Compose under that name, sets bpm, key and scale (932-963). It becomes the current melody for Singing practice                                 | Good for "sing this tune" CTAs (e.g. a solfege-lyric scale). Lands in Compose, not the singing stage          |
| exercise | `{e, tn?, df?, dr?}`                                                                       | Opens the exercise and sets **autoStart = true** (965-979). **Ignores `tn`, `df` and `dr`**                                                               | Auto-start on a fresh load stalls without a gesture (the app's own comment at 641-646). Not recommended       |
| routine  | `{id, n, desc, seg:[{k,d,c:{exercise?,notes?,pattern?,mode?}}]}`                           | `loadSharedRoutine` **replaces today's routine**, warns if progress existed, auto-starts (981-1022, `src/features/routines/use-daily-routine.ts:300-315`) | The only zero-code way to reach a warm-up pattern (e.g. lip-trill). It overwrites the generated daily session |

### 2.5 In-app Learn chapters (an existing lesson surface)

`src/types/walkthrough.ts` (study set from line 742) and
`src/types/walkthrough-content-extended.ts`. These are markdown chapters with
steps, opened at `#/learn/<id>`. Study chapters: `voice-commands`,
`study-pitch-basics` ("Understanding Pitch"), `study-scale-types` ("Common
Musical Scales"), `study-progress-tracking`, `study-tips-tricks`. There are also
per-tab overviews (e.g. `exercises-overview`, `what-counts-where`). This is the
obvious in-app home for a "lesson explorer". The content needs correcting first
(§8).

### 2.6 What cannot be reached by URL today

| Want                                                   | Exists in-app as                                                                                                         | Current entry                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| A specific Ear Lab drill (Leap, Home, Stack, ...)      | `setPendingEarDrill(id)` then `VIEW_FOR_DRILL` (`src/pages/EarLabPage.tsx:58-67`, `src/features/ear-lab/drill-views.ts`) | Only from Ascent week chips                            |
| A Zen guided pitch loop (NG Five-Tone, Noo Siren, ...) | `singingZenLaunch()` (`src/App.tsx:4304-4320`)                                                                           | Exercises chip "Guided pitch loops", Ascent week cards |
| A warm-up pattern (lip-trill, sirens, ...)             | `launchPattern(EXERCISE_WARMUP)`                                                                                         | Warm-up setup screen, routines                         |
| Scale Runner in minor, pentatonic or chromatic         | setup-screen select                                                                                                      | Manual                                                 |
| An Ascent week                                         | none                                                                                                                     | `#/path` then tap the orb                              |
| Premium exercises                                      | native shell only                                                                                                        | Not on web                                             |

### 2.7 First Light intercepts first visits

`showWelcome` is true until `pitchperfect_welcome_version` is set
(`src/stores/ui-store.ts:302-321`). An effect opens First Light whenever it is
true (`src/App.tsx:857-860`), regardless of the hash or slug, except the voice
constellation. Routes that call `dismissWelcome()` are jam-room, sync-room,
shared-result and onboarding-map (`useHashRouter.ts:213-280`).

Options:

- **(a)** Accept it. First Light is itself a good lesson-1 experience: "Sing one
  note" shows the note name and Hz, then an optional voiceprint, then the Map.
- **(b)** Add a lesson route or slug flag that calls `dismissWelcome()`, like
  jam-room does.

### 2.8 Suggested engineering asks (smallest first)

1. Add data-only slugs to `EXERCISE_SLUGS` for each lesson CTA, e.g.
   `lesson-01-octave` (Interval Trainer, C4 to C5, low difficulty),
   `long-note-c4`, `pitch-hold`, `siren`, `slide`, `drone-fifth`,
   `arpeggio-major`, `sight-singing`.
2. Extend `ExerciseLaunch` with `pattern?: string`, forwarded into
   `setLaunchOverride`. That gives `/exercises/warmup-lip-trill`,
   `/exercises/warmup-sirens` and similar. Add a scale-type field for Scale
   Runner (or read it from `pattern`).
3. New launch kinds:
   - `{kind:'ear-drill', drill:'leap'}`: set the tab to `ear-lab`, then
     `setPendingEarDrill`.
   - `{kind:'zen', exerciseId:'ng-five-tone'}`.
   - `{kind:'learn', chapterId}`.
4. A `?lesson=` marker or dedicated route that dismisses First Light, and could
   log lesson attribution.
5. Optional: an octave-fold option for pitch-matching drills (or an explicit
   lesson note that drills score the written octave).

---

## 3. Inventory of teaching and practice content

### 3.1 The Ascent (`src/features/path/path-content.ts`, route `#/path`)

Seven themed weeks. The orbs light by meeting the daily practice goal. "The
7-theme cycle follows standard vocal pedagogy (SOVT warm-ups first, tone &
vibrato last, a recovery week to close)". Each week carries `focus`,
`coachNote`, `goals`, `exercises` (web drills), optional `earDrills`,
`zenExercises`, `warmupPattern` and `resources` (curated external YouTube links,
`{title,url,author,kind:'video'|'article',minutes}`). **MercuryPitch's own
lesson videos could be added here as data.**

| #   | Theme / title                                                                               | Web drills                                                       | Zen loops                           | Ear Lab              | Warm-up              |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- | -------------------- | -------------------- |
| 1   | Foundations: "Find Your Instrument" (6 s steady note, easy singing)                         | long-note, pitch-hold, siren                                     | ng-five-tone, major-scale-ascending |                      | lip-trill            |
| 2   | Breath: "Breath & Power" (swell soft-loud-soft, steady pitch while volume changes)          | dynamic-swell, long-note, siren                                  | mah-meh-mee-moh-moo                 |                      | sirens               |
| 3   | Range: "Reach New Notes" (visit edges lightly)                                              | siren, arpeggio-jumper, slide                                    | noo-siren, octave-repeat-nay        |                      | sirens               |
| 4   | Ear: "Tuning & Ear" (intervals, drone, echoes; take a Calibration at both ends of the week) | interval-trainer, call-response, drone-intonation, mirror-melody | major-scale-ascending               | hairline, home, leap | ascending-scale      |
| 5   | Agility: "Flexibility & Runs"                                                               | scale-runner, staccato-precision, arpeggio-jumper                | three-note-run                      |                      | five-tone-descending |
| 6   | Tone: "Tone & Vibrato"                                                                      | vibrato, dynamic-swell, long-note                                | mam-arpeggio, descending-nya        |                      | lip-trill            |
| 7   | Recovery: "The Gentle Week"                                                                 | long-note, mirror-melody, sight-singing                          |                                     |                      | lip-trill            |

Note: week 5's `warmupPattern: 'five-tone-descending'` is not one of the six
warm-up pattern ids (`gentle`, `lip-trill`, `sirens`, `ascending-scale`,
`cooldown`, `full`). It also sits in the daily-session rotation
(`src/features/routines/use-daily-routine.ts:99-104`).
`normalizeWarmupPattern` (`src/features/exercises/warmup/warmup-steps.ts:59-75`)
falls through to `'full'`, so that day silently runs the full warm-up.

Content Studio can pin published Zen exercise versions to path/week/day/slot
(`#/admin/ascent`, `docs/zen-singing-exercises.md` "Ascent integration").

### 3.2 Web exercise runners (route `#/exercises`, or `/pitch-training`)

There are 19 cards (`src/features/exercises/ExerciseMenu.tsx:73-236`, count at
`LIBRARY_EXERCISE_COUNT`). Help copy is in
`src/features/exercises/exercise-help.ts`. Intrinsic difficulty comes from
`EXERCISE_DIFFICULTY`. Every drill fits targets to the voice-range preset.
Scoring is not octave-folded. Held drills have timer presets of 5, 10, 15, 30 s
or custom (`timer-preference.ts:24`). Run grades are S, A, B, C, D (95/85/70/50).
Per-note tiers are Perfect, Great, Close, Missed (90/75/50) (`feedback.ts`).

| id                   | Card title             | Diff.  | Trains                                                      | Content specifics (code)                                                                                                                                    | Existing link                    |
| -------------------- | ---------------------- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `warmup`             | Guided Warmup          | easy   | Breath, hums, lip trills, sirens, light scale; "no grades"  | 6 patterns (§3.3)                                                                                                                                           | none (routine share only)        |
| `long-note`          | Long Note              | easy   | Sustain, stability, "breath support" (copy)                 | Scores steadiness, drift, duration                                                                                                                          | none                             |
| `pitch-hold`         | Pitch Hold             | easy   | Stay inside a narrow band; silence counts against           | Guided Voice Check routes here                                                                                                                              | none                             |
| `siren`              | Siren / Range Explorer | easy   | Glides; "seamless register transitions" (copy)              | Rounds of glides to target notes; slide quality, scoops                                                                                                     | none                             |
| `slide`              | Slide In/Out           | medium | Clean transitions, no scoop or overshoot                    | Moving guide dot                                                                                                                                            | none                             |
| `pitch-pursuit`      | Pitch Pursuit          | medium | Game: match falling notes before they reach the target zone |                                                                                                                                                             | none                             |
| `mirror-melody`      | Mirror the Melody      | medium | Listen, then sing back from memory                          | Steps from pool `[-4,-2,0,2,4,7,9]`                                                                                                                         | none                             |
| `interval-trainer`   | Interval Trainer       | medium | Hear two notes, sing them back in order                     | **Ascending only**: M2, M3, P4, P5, M6, P8 (`use-interval-trainer-controller.ts:37-44`). The card says "above and below", which the code does not do        | `/exercises/perfect-octave`      |
| `scale-runner`       | Scale Runner           | medium | Scales in tune                                              | Major, natural minor, major pentatonic, chromatic; up **or** down (`ScaleRunnerExercise.tsx:26-53`)                                                         | `/exercises/speed-scales` (fast) |
| `arpeggio-jumper`    | Arpeggio Jumper        | hard   | Chord-tone leaps; "Note by note" or "Echo the phrase"       | Major, minor, diminished, augmented, 1-3-5-8                                                                                                                | none                             |
| `drone-intonation`   | Drone Intonation       | medium | Tune against a drone, hear beating stop                     | Unison, m3, M3, P4, P5, P8                                                                                                                                  | none                             |
| `call-response`      | Call & Response        | medium | Echo a phrase; copy claims rhythm too                       | 3-4 note random walk, **every note 500 ms**, pitch-only slots                                                                                               | none                             |
| `dynamic-swell`      | Dynamic Swell          | hard   | Messa di voce, steady pitch while volume changes            |                                                                                                                                                             | none                             |
| `chord-stacker`      | Chord Stacker          | hard   | Sing chord tones one at a time                              | **maj7, min7, dom7, dim7, maj6 only**, no triads                                                                                                            | none                             |
| `staccato-precision` | Staccato Precision     | medium | Short, crisp, centred attacks                               |                                                                                                                                                             | none                             |
| `routine-runner`     | Routine Runner         | medium | Chained warm-up sequence                                    |                                                                                                                                                             | none                             |
| `sight-singing`      | Sight-Singing          | hard   | Read a staff, sing at sight, no audio preview               | Treble clef only. 6 notes from the current Singing-tab key and scale, stepwise preference, pass at 60 cents held 450 ms (`use-sight-singing-controller.ts`) | none                             |
| `vibrato`            | Vibrato                | hard   | Controlled oscillation                                      | Styles Slow & Wide (3-5 Hz, 80-180 cents), medium, fast. Healthy reference 5-7 Hz (`vibrato-styles.ts`)                                                     | none                             |

`STARTER_TYPES` (suggested first drills with no history) are long-note, siren,
mirror-melody and pitch-hold (`ExerciseMenu.tsx:293`).

### 3.3 Guided Warmup patterns (`src/features/exercises/warmup/warmup-exercises.ts:346-381`)

Blocks:

- **Breath cycle**: in 4, hold 4, out 8 on "Sssss", with a hiss lane and a
  breathing ring.
- **Gentle hum** (low, high): a falling five-note hum, lips closed.
- **Lip trill** (low, high): up a fifth and back on "brrr".
- **Siren** (up, down): an octave. Safety note: "Shorten the glide if either
  end feels strained."
- **Five-note scale** on "mah".
- **Cool-down**: soft hum down, "Haa" sigh, final exhale.

| Pattern         | Blocks                                            |
| --------------- | ------------------------------------------------- |
| gentle          | breath, hum low, hum high                         |
| lip-trill       | breath, lip trill low and high, hum low and high  |
| sirens          | breath, lip trill low and high, siren up and down |
| ascending-scale | breath, hum low and high, scale low and high      |
| cooldown        | cooldown hum, sigh, final breath                  |
| full            | breath, hums, lip trills, sirens, scales          |

### 3.4 Zen guided pitch loops (`src/features/zen/exercise-catalog.ts`)

Opened from the `#/exercises` "Guided pitch loops" chip or from Ascent cards.
There is no URL. Scoring: pitch accuracy, coverage, steadiness, exact octave.
Cue text never claims pronunciation scoring. Locale is en-GB. Seeds are
provisional and await coach review.

| id                    | Title                 | Category     | Cue      | Intent                              | Safety note                                               |
| --------------------- | --------------------- | ------------ | -------- | ----------------------------------- | --------------------------------------------------------- |
| major-scale-ascending | Major Scale Ascending | scales       | Ah       | One octave, connected vowel         | "Transpose down if the top note needs extra force."       |
| three-note-run        | Three-Note Run        | agility      | Gee      | Compact even movement               |                                                           |
| octave-repeat-nay     | Octave Repeat Nay     | range        | Nay      | Visit the octave lightly            | "Stop or transpose down if the upper note feels pressed." |
| descending-nya        | Descending Nya        | tone         | Nya      | Bright descending line              |                                                           |
| ng-five-tone          | NG Five-Tone          | tone         | NG       | Easy connected resonance (SOVT hum) |                                                           |
| mam-arpeggio          | Mam Arpeggio          | tone         | Mam      | Speech-like chord leaps             |                                                           |
| mah-meh-mee-moh-moo   | Mah Meh Mee Moh Moo   | articulation | 5 vowels | Five vowels on one steady pitch     |                                                           |
| noo-siren             | Noo Siren             | range        | Noo      | Smooth octave glide                 | "Shorten or transpose the glide..."                       |

New loops can be authored without code in Content Studio (`#/admin/exercises`,
owner key). This is a cheap way to ship a lesson-specific drill, such as a
straw-like "oo" glide or a minor-scale loop. It still needs a URL launch kind
before a lesson can link to it.

### 3.5 Premium exercises: availability

`EXERCISE_CATALOGUE` in `src/features/premium-exercises/catalogue.ts`: Long note
(`long-note-lantern`), Echo (`echo-stars`), Lip roll (`lip-roll-bay`), Ng slides
(`ng-slides-bridge`).

Gate: `PREMIUM_EXERCISES = KARAOKE_IMPORT = IS_NATIVE_BUILD && __KARAOKE_IMPORT__`
(`src/lib/native-build.ts:53-68`):

> "They ride the Karaoke subscription (owner, 9 Oct 2026) ... a native test
> build, TestFlight among them, and not the store build until the V1 flip ...
> The flip must bring the exercises' own gate with it (one free run, then the
> paywall)."

| Exercise                                                             | Web | Native store build          | Native test build / TestFlight                      | Dev                                                            | Web stand-in                                               |
| -------------------------------------------------------------------- | --- | --------------------------- | --------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| Long note (lantern fills; steadiness score; tier sets the brim)      | No  | No (folded out, images too) | Yes, currently open to all testers (no paywall yet) | Native dev fixtures (`apps/mercurypitch/src/main.tsx:290-312`) | `long-note`, `pitch-hold`                                  |
| Echo (Merc sings 3-5 notes, sing back; Learning tier counts octaves) | No  | No                          | Yes                                                 | fixtures                                                       | `call-response`, `mirror-melody`, Ear Lab Echo (sing mode) |
| Lip roll (3 waves up an octave and back; "a hum on 'oo' works too")  | No  | No                          | Yes                                                 | fixtures                                                       | Warm-up `lip-trill` pattern                                |
| Ng slides (5 slides up a fifth and back, a semitone apart)           | No  | No                          | Yes                                                 | fixtures                                                       | Zen `ng-five-tone`, `slide`, warm-up hums                  |

The store apps are "coming soon" (CHANGELOG 0.9.17). There is a tension:
`docs/plans/premium.md` says "pitch detection/training ... explicitly never
premium" (web philosophy). The native premium exercises sit on a subscription.
Decide how "premium tutorials" are positioned relative to both.

### 3.6 Ear Lab (route `/ear-lab` or `#/ear-lab`)

The catalogue is `src/lib/ear/drills.ts`. Bench captions are in
`src/features/ear-lab/instruments.ts`. Answer modes are tap, play or sing; Home,
Echo and Span accept singing, octave-folded within 60 cents
(`src/lib/ear/sung-notes.ts`).

There are two rulers:

- **Threshold drills (Ruler A)** use a 2-down-1-up staircase and report in
  physical units.
- **Identification drills (Ruler B)** report an Elo rating (800 is a first
  session, 2000 a working musician).

A sealed **Calibration** (about 3 min) is the only reading that moves the
**Mercury Index** (0-1000). The Ear Report shows the confusion matrix. The Ear
Path (`src/lib/ear/path.ts`) lights milestones and locks nothing.

| Drill id                        | Name        | Faculty                      | Task                                                              | Unit / ruler                | Content                                                                                 |
| ------------------------------- | ----------- | ---------------------------- | ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| hairline                        | Hairline    | Resolution                   | Two tones, which was higher                                       | cents (novice 40, expert 3) | Pitch discrimination                                                                    |
| beat-hunt                       | Beat Hunt   | Resolution                   | Two pairs, which pair was beating                                 | cents detune                | Tuning by beats                                                                         |
| home                            | Home        | Function                     | Cadence plants a key, then one note: name the degree, tap or sing | Elo, 7 choices              | Major-key degrees in solfege                                                            |
| gravity                         | Gravity     | Function                     | One of 12 notes over the key                                      | Elo, 12                     | Chromatic degrees (b3, #4, b7)                                                          |
| the-pull                        | The Pull    | Function                     | Which of two degrees leans harder                                 | Elo, 2                      | Tendency tones                                                                          |
| cadence                         | Cadence     | Function (catalogue: colour) | Progression on guitar, name it in numerals                        | Elo, 4                      | I-IV-V, I-V-vi-IV, ii-V-I, I-vi-IV-V, I-vi-ii-V, I-IV-vi-V and more (`progressions.ts`) |
| bassline                        | Bassline    | Function                     | Four bass roots under a held tonic, tap back                      | Elo, 7                      | Root motion                                                                             |
| the-grid                        | The Grid    | Time                         | Six clicks, which left the lattice                                | ms                          | Onset timing                                                                            |
| drift                           | Drift       | Time                         | Did the tempo hold, gain or lose                                  | % tempo                     | Tempo stability                                                                         |
| leap                            | Leap        | Shape                        | Two notes, name the interval                                      | Elo, 12                     | m2 to P8, ascending or descending at random; framed as the "supporting drill"           |
| stack                           | Stack       | Colour                       | One chord, roving root, name the quality                          | Elo, 6                      | Maj, Min, Dim, Aug, Sus4, Dom7                                                          |
| desk (colour, weight, critique) | The desk    | Colour                       | Boosted EQ band, heavier render, named fault                      | dB                          | Mixing ears, not vocal                                                                  |
| contour                         | Contour     | Shape                        | Up, down or level, fast                                           | Elo, 3                      | Gap tiers 400, 200 ("Whole steps"), 100 ("Half steps"), 50, 25 cents                    |
| echo                            | Echo        | Shape                        | Phrase in a planted key, tap, play or sing back                   | Elo                         | 14 phrases, e.g. "Do Re Mi", "Do Mi Sol", "Sol La Ti Do'"                               |
| span                            | Span        | Shape                        | Phrase grows a note at a time                                     | notes held (3 to 9)         | Melodic memory                                                                          |
| pulse                           | Pulse       | Time                         | A bar of onsets, tap it back (rhythm dictation)                   | Elo                         | Quarters, eighths, triplets, sixteenths, rests, over the barline                        |
| chart                           | The Chart   | Time                         | A written bar over the click, tap at sight                        | Elo                         | Rhythm reading                                                                          |
| subdivide                       | Subdivide   | Time                         | Two bars on the kit, name the metre                               | Elo, 4                      | Metre                                                                                   |
| Wild (Field Book)               | In the Wild | Wild                         | Bassline, Home and Echo on the user's own separated songs         | own tracks                  | Major/minor solfege                                                                     |

Ascent week 4 chips open `hairline`, `home` and `leap` via `setPendingEarDrill`.

### 3.7 Voice Mirror family (`src/features/mirror/*`, `src/lib/mirror/*`)

Flow: landing, mic, **Glide** up and down (range), **Hold** (steadiness:
detrended residual SD, drift separate), **Match 5** (five reference notes picked
inside the range; per-note score 100 at 12 cents or less, 70 at 35, 40 at 60, 0
at 120 or more; octave-folded; scoop/onset ms), then results, voice type and
twin legend.

Voice-type bands (`src/lib/mirror/legend-catalog.ts:41`): Bass E2-E4, Baritone
G2-G4, Tenor C3-C5, Alto F3-F5, Mezzo-soprano and Soprano (same table as
`VOCAL_RANGES` in settings, e.g. Soprano C4-C6, Mezzo A3-A5).

First-stop thresholds (`src/features/onboarding/first-stop.ts`): below 70
steadiness sends to Long Note, below 70 accuracy to Interval Trainer, a range
under 12 semitones to Ascent Range week. Free Sing (`/free-sing`) reports range
in use, tessitura (25th-75th percentile), home note, phrase lengths between
breaths and vibrato.

### 3.8 First Light onboarding (`src/features/onboarding/*`)

Shipped (CHANGELOG 0.9.17), although the plan status line still says "in
review". Beats:

1. Sky
2. **First light**: sing one note, see the note name and Hz
3. Fork
4. Voiceprint: Glide, Hold, Match 5 (about 90 s)
5. Twin
6. **Map** of rooms with your first stop lit (`#/map` replays it)
7. Keep (account)

Voiceprint copy: "Never strain: Merc maps your easy range, not your limit"
(`beats/BeatVoiceprint.tsx:366`).

### 3.9 Challenges and Legends (`#/challenges`, Legends view in `#/leaderboard`)

There are 12 drill-backed categories (`src/components/VocalChallenges.tsx:531-542`,
`src/features/challenges/challenge-drill-generator.ts`):

| Category            | Drill            | Notes                                  |
| ------------------- | ---------------- | -------------------------------------- |
| Basics              | long-note        | C4                                     |
| High Notes          | siren            |                                        |
| Low Notes           | drone-intonation |                                        |
| Speed               | staccato         |                                        |
| **"Perfect Pitch"** | interval-trainer | Under 15 cents. The name is a misnomer |
| Scales              | scale-runner     |                                        |
| Intervals           | interval-trainer |                                        |
| Harmony             | chord-stacker    |                                        |
| Agility             | arpeggio-jumper  |                                        |
| Range               | siren            |                                        |
| Dynamics            | dynamic-swell    |                                        |
| Call & Response     | call-response    |                                        |

The weekly **Legend** is one shared melody sung at written pitch on the Zen
canvas (`ChallengeStage.tsx`), with sight-singing parity scoring and a board.

### 3.10 Routines and Home

Home generates a 5-15 min daily session from routine templates. Segments are
warmup, exercise, challenge-prep and cooldown, each with optional notes,
pattern and reps (`src/features/routines/types.ts`). Routine share links exist
(§2.4).

### 3.11 Practice intelligence (`src/features/practice-intelligence/*`)

The weakness analyzer flags exercises averaging under 65, weak pitches (average
cents per note) and missed intervals. The drill generator builds precision
drills (difficulty minus 2), range drills, interval drills and stamina drills
(long note on weak pitches). These show in the Exercises "WeaknessPanel".
Adaptive difficulty runs 1-10.

### 3.12 Hear Yourself and the Guided Voice Check (`#/voice-history`)

Takes are kept locally. The **Pitch Centre** pilot is three holds at -200, 0
and +200 cents around a comfortable centre. Its outputs are
`complete-landings`, `reinforce-centre` and `refine-centre`, each routed to a
5 s x 3 Pitch Hold dose with stop rule `guided.stop-on-discomfort-v1`
(`src/lib/guided-voice/pitch-centre-assessment-policy.ts`). Before the reading,
the singer reports effort: Easy, Workable, Effortful or Uncomfortable. "Audio
never overrides discomfort" (`GuidedVoiceCheck.tsx:1206-1214`).

### 3.13 Other practice surfaces

- **Singing tab (`#/singing`)**: live pitch trail with note labels, key and
  scale picker, octave buttons, metronome (default 60 bpm, range 40-280), tonic
  anchor tone, once/repeat/session modes, per-note accuracy heatmap.
- **Compose (`#/compose`)**: piano roll with key/scale snap, slides, vibrato,
  staccato, chords, MIDI import and export, melody share links.
- **Piano (`#/piano`) and Piano Night (`/piano-night`)**: falling notes, staff,
  hands on keys, MIDI or on-screen keyboard.
- **Analysis (`#/analysis`)**: per-take spectrogram, TimbreCard (breathiness,
  richness, resonance; "measured ... at ~N Hz"), tuning card, live capture.
- **Jam (`/jam`)**: Unison, **Harmony Stack** (roles Root, Third, Fifth;
  diatonic thirds stacked above the melody; needs 2+ singers) and Relay
  (`src/lib/jam/jam-modes.ts`).
- **Break Glass (`/glass`)**: reach and hold the top of the comfortable range;
  "Rest your voice a moment, steadier beats louder".
- **Practice timer**: a voice-rest clock, off by default, 20 min singing then
  5 min break, counting only while the mic is open
  (`src/stores/practice-timer-store.ts`).

---

## 4. Safety and claims rules the lessons must respect

From `src/lib/guided-voice/claims.ts` (forbidden dynamic copy),
`docs/specs/guided-voice-check.ears.md` and `PRODUCT.md`:

- **Never rate breath support.** The validator rejects any "breath support"
  phrasing in findings or recommendations: "work on your breath support",
  "good breath support" and similar. The Ascent week 2 copy says "Build breath
  support". That is static authored copy, but the spirit applies. Teach breath
  conceptually. Do not claim the app measures it (REQ-GVC-071, REQ-GVC-077: no
  lung capacity, airflow efficiency or respiratory physiology).
- **No health or safety clearance**: no "healthy voice", "safe to sing", or
  "safe/unsafe range". **No medical or tissue inference**: no injury, strain,
  damage, fatigue, fold closure or "heal". Note that even the word "strain" is
  in the dynamic-copy blocklist. Existing static safety notes do say "if ...
  feels strained", which is acceptable as an instruction to the singer.
- **No laryngeal inference**: no laryngeal tension, muscle tension or
  subglottal pressure.
- **No register or passaggio "problem"** (REQ-GVC-073: no pathology from a
  glide gap).
- **No prestige tone claims** ("professional tone").
- **No onset classification** (balanced, breathy or pressed onset;
  REQ-GVC-076).
- **No composite or overall voice score** (REQ-GVC-044, PRODUCT.md
  "never a fabricated composite voice score").
- **Pronunciation is not assessed.** Exercise scoring "must not claim to assess
  pronunciation" (PRODUCT.md). Vowel lessons cannot say "the app checks your
  vowel".
- **SOVT** (lip trill, hum, straw) must be optional, comfortable and short,
  with a stop rule. No pitch-accuracy, fold-closure or health score from an
  occluded-task waveform (REQ-GVC-074, 075). The premium Lip roll and Ng slides
  do score pitch-following on a buzz or hum. That is in tension with 075's
  wording, though 075 is scoped to the Guided Voice Check.
- **Do not reward maximum phonation time** (REQ-GVC-070) or maximal span
  (REQ-GVC-072). Contrast: web Long Note copy says "Hold a steady pitch as long
  as you can". Lessons should teach comfortable fixed holds (the app has 5, 10,
  15 and 30 s timers).
- **Comfort first.** The pre-capture check covers pain, hoarseness, sudden range
  loss, illness and effort (REQ-GVC-020). An "Uncomfortable" report suppresses
  celebration, retakes and any "louder, higher, longer, more often" advice
  (REQ-GVC-023). The singer's report is authoritative (REQ-GVC-024). **Safety,
  stop and referral guidance is never paid** (REQ-GVC-025). That matters for a
  premium series: safety content must stay free.
- The house pattern for safety copy: "Stop immediately if anything feels
  uncomfortable" (`ExerciseShell.tsx:711-713`), "Never strain: Merc maps your
  easy range, not your limit", "Shorten the glide if either end feels
  strained", "Transpose down if the top note needs extra force".
- **No diagnosis**: "not a tone-deafness test" (`public/llms.txt`,
  `_redirects`). Voice type is "a guide, not a verdict". The app "does not
  replace a singing teacher, and does not claim to".
- **Tone**: product language is "direct, calm, and instructional rather than
  competitive or judgmental" (PRODUCT.md). Use UK English for exercise content
  (en-GB locale). Note that the 0.9.18 changelog moved the rest of the app UI
  to American spelling (color, favorite), so the two diverge.

---

## 5. Teaching vocabulary and conventions in the app

| Topic                               | Convention                                                                                                                                                                                      | Where                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Note names                          | 12 names, **sharps only** in UI text: C C# D D# E F F# G G# A A# B                                                                                                                              | `src/lib/note-utils.ts:18-31`, `src/lib/scale-data.ts:7-20`        |
| Flats                               | Only in notation: the VexFlow staff spells flats in flat keys                                                                                                                                   | `src/lib/sheet-music-renderer.ts:115-119,494`                      |
| Octave numbering                    | Scientific pitch: octave = floor(midi/12) - 1, so C4 = MIDI 60 = middle C, A4 = MIDI 69                                                                                                         | `note-utils.ts:37-40`, `src/types/index.ts:51`                     |
| Reference pitch                     | **A4 = 440 Hz, hard-coded** (`A4_FREQ` in scale-data, log-pitch, scoring utils). Not user-settable for voice. The guitar tuner has an unused `concertPitchHz` option                            | `src/lib/scale-data.ts:152`, `src/lib/guitar/tuner.ts:114`         |
| Cents                               | "100 cents = 1 semitone (half step)". Entry pages: "cents, hundredths of a semitone" and "most listeners stop hearing a note as out of tune somewhere under about 20 cents on a sustained tone" | `walkthrough.ts:447,834`, `entry-pages.ts:506`                     |
| Accuracy tiers                      | Learning / Singer (default) / Professional. Exercise "level" reuses them                                                                                                                        | `settings-store.ts:40,762,801-827`, `src/stores/exercise-level.ts` |
| Accuracy bands (cents, at or below) | Labels: Perfect, Excellent, Good, Okay (then miss). Learning 15/30/50/75. Singer 8/15/25/40. Professional 1/3/8/15                                                                              | `settings-store.ts:176-205`, `SettingsPanel.tsx:1084-1145`         |
| Per-note tiers in drills            | Perfect 90 or more, Great 75, Close 50, Missed                                                                                                                                                  | `src/features/exercises/feedback.ts`                               |
| Run grades                          | S, A, B, C, D (95/85/70/50), same as karaoke                                                                                                                                                    | `feedback.ts`                                                      |
| Menu grade badges                   | Elite 90, Great 80, Good 65, Novice 50                                                                                                                                                          | `ExerciseMenu.tsx:241-273`                                         |
| Voice Mirror bands                  | bullseye (15 cents or less), hit (35), close (60), miss                                                                                                                                         | `src/lib/mirror/metrics.ts`                                        |
| Heatmap labels                      | Excellent, Good, Okay, Weak, Needs Work (accuracy %)                                                                                                                                            | `PitchAccuracyHeatmap.tsx`                                         |
| Ear units                           | cents, ms, % tempo, dB, notes held, Elo; Mercury Index 0-1000                                                                                                                                   | `src/lib/ear/drills.ts`                                            |
| Solfege                             | Movable do. Major: Do Re Mi Fa Sol La Ti Do'. Minor is do-based: Do Re Me Fa Sol Le Te. "Sol", not "So". Used **only in Ear Lab**                                                               | `src/lib/ear/phrase.ts:19`, `src/lib/ear/wild.ts:158-159`          |
| Scale degrees and numerals          | 1-7 with solfege. Roman numerals I ii iii IV V vi vii°                                                                                                                                          | `src/lib/ear/progressions.ts`                                      |
| Intervals                           | m2, M2, m3, M3, P4, TT, P5, m6, M6, m7, M7, P8 ("Minor 2nd", ..., "Tritone", "Octave")                                                                                                          | `src/lib/ear/banks.ts`                                             |
| Chord qualities                     | Maj, Min, Dim, Aug, Sus4, 7 (Dominant 7th); maj7, min7, dom7, dim7, maj6 in Chord Stacker                                                                                                       | `banks.ts`, `chord-stacker`                                        |
| Scales (Singing tab)                | major, natural minor, harmonic minor, melodic minor, dorian, mixolydian, phrygian, lydian, major and minor pentatonic, blues, chromatic, plus custom                                            | `PlaybackSetupPanel.tsx:115-127`, `scale-data.ts:79-145`           |
| Keys offered                        | **C, G, D, A, E, B, F, Bb only** (8 of 12)                                                                                                                                                      | `PlaybackSetupPanel.tsx:86-93`                                     |
| Voice types                         | Soprano, Mezzo-Soprano, Alto, Tenor, Baritone, Bass. Each has a two-octave comfortable range and an "anchor" a fourth or so above the bottom                                                    | `settings-store.ts:41-134`                                         |
| Mascot naming                       | "Merc" (Merc sings the demo, Merc's lines)                                                                                                                                                      | premium exercises, onboarding                                      |
| Exercise cue words                  | ng, mam, Nya, Mah, Nay, Gee, Noo, brrr, Sssss, Haa                                                                                                                                              | Zen, warm-up                                                       |

---

## 6. Pedagogical decisions already made (docs)

- **Ear Lab (`docs/plans/ear-training.md`; Phase 0 header stale, it shipped in
  0.9.2):**
  - Percent-correct is a "score treadmill". Use monotonic rulers instead:
    thresholds in real units plus Elo against a frozen bank.
  - **Functional, in-key, scale-degree training is the spine; interval ID is a
    supporting drill.** Context-free intervals do not transfer.
  - A sealed Calibration is the proof of improvement.
  - Ear vs voice diagnostic: answer by tap and by sing to separate perception
    error from production error (§4 of that plan).
  - "In the Wild" bridges drills to real songs.
  - The game frame is the delivery mechanism: the Mercury Column, the "blurred
    to sharp" focus metaphor, the confusion matrix.
- **Rhythm drills (`docs/plans/ear-rhythm-drills.md`, renamed by
  `ear-lab-follow-up.md`):** Pulse is rhythm dictation (tap back). Echo is
  melodic dictation, Span is the growing phrase. "Hold the beat" is not a drill
  (the Tap check covers it). Latency is subtracted honestly with the round-trip
  number. Calibration is disabled when latency is unmeasured.
- **Ascent (`path-content.ts`):** SOVT and easy warm-ups first, breath, range
  ("visit new notes like a guest"), ear, agility ("slow and clean beats fast
  and blurry"), tone and vibrato last ("never something to force"), and a
  recovery week ("rest is training too").
- **First Light (`docs/plans/onboarding-first-light.md`):** value before
  configuration. Do not ask a first-timer "am I a baritone?" Measure instead.
  The twin is the incentive. Account asks only at earned moments. Reasons are
  observations, never verdicts.
- **Zen (`docs/zen-singing-exercises.md`, PRODUCT.md):** pitch, timing and cue
  text are independent. Never present pitch input as pronunciation scoring.
  Example audio is lazy and gesture-gated. "Opening a lesson loads the guide
  but never auto-starts the microphone; Begin remains the required user
  gesture." Exercises transpose to the singer, never assuming one voice type.
- **Premium (`docs/plans/premium.md`):** "MercuryPitch stays free". Charge only
  for features with real per-use cost. Pitch training is "explicitly never
  premium". The native subscription decision of 9 Oct 2026 for the premium
  exercises sits against this.
- **Guided Voice Check spec:** the safety model in §4 above, deterministic
  rules, reviewed copy ids, and no LLM-authored findings.

---

## 7. Concept to feature to deep link to gaps

Legend: **URL** = works today. **In-app** = reachable only by navigation after
the link. **Ask** = needs the engineering item in §2.8.

| Concept                                | Existing feature(s) that practise it                                                                                                                                                                                                  | Deep link today                                                                                                                                   | Gaps / caveats                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitch and frequency (Hz)               | First Light beat 2 (sing one note, see note and Hz; first visit to `/`); Voice Mirror live viz; Singing tab live trail; Analysis live capture (Hz, spectrogram); Ear Lab Hairline (pitch discrimination); Learn "Understanding Pitch" | `https://mercurypitch.com/` (new visitors), `/mirror`, `#/singing`, `#/analysis`, `/ear-lab` then Hairline (in-app), `#/learn/study-pitch-basics` | No dedicated "see your Hz" tuner for voice. No drill linking Hz to note name. The Learn chapter's "85 Hz to 2550 Hz" range line needs checking |
| Octave                                 | Interval Trainer C4 to C5; Ear Lab Leap (P8); Arpeggio Jumper 1-3-5-8; Zen Octave Repeat Nay; Voice Mirror Match (octave-folded)                                                                                                      | `/exercises/perfect-octave`, `/mirror`                                                                                                            | No "same note, different octave?" ear drill. **Web drills don't fold octaves**: they score the written octave (range-fitted)                   |
| Note names (letters, C4, A4)           | Note labels on every pitch canvas; Sight-Singing staff; Compose piano roll; Piano and Piano Night keyboard                                                                                                                            | `#/singing`, `#/compose`, `#/piano`, `/piano-night`                                                                                               | **No note-naming drill** for voice or keyboard (only the guitar `NoteLocatorQuiz`). No absolute note ID by design (Gravity is relative)        |
| Keyboard layout                        | Piano tab falling notes and keyboard; Piano Night (on-screen or MIDI keys, "hands on the keys" view); Compose piano roll                                                                                                              | `#/piano`, `/piano-night`, `#/compose`                                                                                                            | No keyboard-geography lesson or drill (black-key groups, find every C)                                                                         |
| Semitones and whole tones              | Ear Lab Contour tiers 200 cents "Whole steps" and 100 cents "Half steps"; Leap m2 vs M2; Hairline; Scale Runner chromatic; Learn chapter (100 cents = 1 semitone)                                                                     | `/ear-lab` then Contour (in-app); `#/learn/study-pitch-basics`                                                                                    | No sung half-step vs whole-step drill. Interval Trainer has no m2. Ask: ear-drill launch                                                       |
| Sharps and flats                       | Learn chapter's 12-tone list (sharps); Ear Lab Gravity (b3, #4, b7 chromatic degrees); staff spells flats in flat keys                                                                                                                | `#/learn/study-pitch-basics`                                                                                                                      | **UI is sharp-only**. No enharmonics teaching. Key picker has only 8 keys                                                                      |
| Major scale                            | Scale Runner (Major); Zen Major Scale Ascending (Ascent weeks 1 and 4); warm-up five-note "mah" scale; seeded C/G major melodies in Singing; Ear Lab Home (major degrees in solfege); Learn "Common Musical Scales"                   | `/exercises/speed-scales` (fast, difficulty 8, not for beginners); `#/singing`; `#/learn/study-scale-types`                                       | No beginner-tempo major-scale slug (data-only to add). No solfege on vocal drills                                                              |
| Minor scale                            | Scale Runner (Minor = natural); Singing tab natural, harmonic and melodic minor; seeded `scale-natural-minor-a4`; Arpeggio minor; Stack min; Ear Lab Wild minor solfege                                                               | `#/singing` (pick Minor); Scale Runner in-app only                                                                                                | **No link opens Scale Runner in minor** (scale type not launchable). No major-vs-minor scale ear drill (Stack covers chord quality only)       |
| Intervals                              | Interval Trainer (sung ascending M2 M3 P4 P5 M6 P8); Drone Intonation (unison, m3, M3, P4, P5, P8 vs drone); Ear Lab Leap (all 12, ascending or descending, ID)                                                                       | `/exercises/perfect-octave`; `/ear-lab` then Leap (in-app)                                                                                        | No **sung** minor, descending, tritone or 7th intervals. The Interval Trainer card's "above and below" is not true in code                     |
| Pitch matching                         | Voice Mirror Match 5; Pitch Hold; Long Note; Mirror the Melody; Call & Response; Hear Yourself Pitch Centre; Ear Lab Home (sing mode); Break Glass                                                                                    | `/mirror`, `#/voice-history`, `/glass`; drills in-app                                                                                             | Octave-folding differs by surface (§0.3). Ask: slugs for pitch-hold and long-note                                                              |
| Sustaining a note                      | Long Note (5/10/15/30 s); Pitch Hold; Voice Mirror Hold; Break Glass; Zen loops; premium Long note (native only)                                                                                                                      | `/mirror`, `/glass`                                                                                                                               | Avoid "as long as you can" (REQ-GVC-070). Ask: slug with a fixed comfortable duration                                                          |
| Glides and sirens                      | Siren / Range Explorer; Slide; Pitch Pursuit; warm-up sirens; Zen Noo Siren; Mirror glides; premium Ng slides (native)                                                                                                                | `/mirror`, `/vocal-range-test`                                                                                                                    | Ask: siren and slide slugs, Zen launch                                                                                                         |
| SOVT: lip trill                        | Warm-up `lip-trill` and `sirens` patterns; premium Lip roll (native test builds only)                                                                                                                                                 | In-app: `#/exercises`, Guided Warmup, pick "Lip trills". Or routine share link (replaces today's routine)                                         | Ask: `pattern` on slugs. Optional, short, stop rule. No SOVT scoring claims                                                                    |
| SOVT: ng / hum                         | Zen NG Five-Tone; warm-up hums; premium Ng slides (native)                                                                                                                                                                            | In-app (`#/exercises` then "Guided pitch loops")                                                                                                  | Ask: Zen launch                                                                                                                                |
| SOVT: straw                            | **None**                                                                                                                                                                                                                              |                                                                                                                                                   | Gap. Could be authored as a Zen loop in Content Studio. Must stay unscored for pitch (REQ-GVC-075)                                             |
| Breath                                 | Warm-up breath cycle (in 4, hold 4, out 8 on "Sssss" with hiss lane); Dynamic Swell; Long Note; Free Sing phrase lengths; practice timer (voice rest)                                                                                 | `/free-sing`; in-app warm-up                                                                                                                      | **Must not rate breath support** (claims.ts, REQ-GVC-071). No breath drill beyond the warm-up                                                  |
| Range                                  | Vocal Range Test; Voice Type Test; Singer Match; Voice Mirror; Settings voice range ("Find my voice", "Full range test"); Siren; Ascent week 3                                                                                        | `/vocal-range-test`, `/voice-type-test`, `/which-singer-has-my-vocal-range`, `/mirror`, `#/settings/practice`, `#/path`                           | Tessitura via `/free-sing`. Do not reward maximal span (REQ-GVC-072)                                                                           |
| Registers (chest, head, mix, falsetto) | Siren copy "seamless register transitions" (scores smoothness); Learn tips mention chest, head and falsetto                                                                                                                           | (siren in-app)                                                                                                                                    | **No register detection or drill**. Claims forbid register "problems". Teach conceptually and practise via sirens and slides                   |
| Vowels and resonance                   | Zen Mah Meh Mee Moh Moo (pitch-scored only); Descending Nya, Mam Arpeggio; Analysis TimbreCard (breathiness, richness, resonance) and spectrogram                                                                                     | `#/analysis`                                                                                                                                      | **No vowel or formant drill**. The app must not claim vowel or pronunciation assessment                                                        |
| Rhythm, pulse, tempo                   | Ear Lab Time: Pulse (dictation), The Chart (reading), Subdivide (metre), Drift (tempo), The Grid (ms); Singing tab metronome and BPM; Staccato Precision; Drum Night                                                                  | `/ear-lab` (drills in-app), `/drum-night`, `#/singing`                                                                                            | **No sung-rhythm scoring** in vocal drills (Call & Response is even 500 ms, pitch-only). Ask: ear-drill launch                                 |
| Melody and contour                     | Ear Lab Contour, Echo and Span (tap, play or sing); Mirror the Melody; Call & Response; Arpeggio "Echo the phrase" mode; Karaoke Night example songs                                                                                  | `/ear-lab`; `/karaoke-night?song=josephine`                                                                                                       | Fine. Ask: ear-drill launch                                                                                                                    |
| Sight-singing                          | Sight-Singing (treble staff, current key and scale, 6 notes, no preview); weekly Legend; Ear Lab The Chart (rhythm reading)                                                                                                           | `#/challenges`; drill in-app                                                                                                                      | Treble clef only (low voices read treble). No solfege on the staff. Key comes from the Singing tab. Ask: slug                                  |
| Chords and triads                      | Arpeggio Jumper (major, minor, dim, aug arpeggios, sung); Ear Lab Stack (6 qualities, ID), Cadence (numerals), Bassline; Chord Stacker (7th chords, sung)                                                                             | `/ear-lab`; in-app                                                                                                                                | **Chord Stacker has no triads**. Ask: arpeggio slug, Stack launch                                                                              |
| Keys and circle of fifths              | Singing key picker plus scale; tonic anchor; Ear Lab Home and Gravity (cadence plants the key); key detection in Karaoke/analysis; `KEY_SIGNATURES` table                                                                             | `#/singing`, `#/settings/practice`                                                                                                                | **No circle-of-fifths visual or drill. Key picker lacks Eb, Ab, Db, F#/Gb**                                                                    |
| Harmony singing                        | Jam Harmony Stack (root, third, fifth; 2+ singers); Drone Intonation; Chord Stacker; Beat Hunt (beating)                                                                                                                              | `/jam`; drills in-app                                                                                                                             | **No solo "sing a harmony line against a melody" drill**. Harmony Stack needs other people                                                     |
| Solfege and scale degrees (bonus)      | Ear Lab Home, Echo, Span, The Pull, Wild                                                                                                                                                                                              | `/ear-lab`                                                                                                                                        | Solfege appears only in the Ear Lab                                                                                                            |
| Vibrato and dynamics (bonus)           | Vibrato (3 styles); Dynamic Swell; Ascent week 6                                                                                                                                                                                      | `#/path`                                                                                                                                          | Ask: slugs                                                                                                                                     |

---

## 8. Content and consistency issues to fix (or at least not repeat in lessons)

1. **"Perfect pitch" means "inside the Perfect band"** in Settings tier copy
   (`settings-store.ts:810-822`, `SettingsPanel.tsx:673`) and the challenge
   name "Perfect Pitch" (`VocalChallenges.tsx:535`). The tips chapter also
   says "Perfect pitch is a skill that develops with practice, not something
   you're born with" (`walkthrough.ts:1088`), which conflates absolute pitch
   with accuracy. Lessons should distinguish absolute pitch, relative pitch
   and pitch accuracy.
2. **Band thresholds in the Learn copy (10/25/50/75) match no preset**
   (`walkthrough.ts:442-445, 835-837, 983-986`). Learning is 15/30/50/75 and
   Singer (the default tier) is 8/15/25/40. Also `DEFAULT_SETTINGS.bands =
learning` while the default `accuracyTier` is `singer`
   (`settings-store.ts:219,763`). This may be reconciled on first tier apply;
   not verified.
3. **Factual error**: "C Minor ... Uses the same notes as relative major (A
   Major)" (`walkthrough.ts:906`). C minor's relative major is E-flat major.
4. **Card copy vs code**:
   - Interval Trainer: "above and below", but it is ascending only.
   - Call & Response: "rhythmic accuracy", but the rhythm is even and
     unscored.
   - Pitch Pursuit: the menu says falling notes and the help says moving
     target. The code is falling notes.
5. **Three different "Echo"s**: Ear Lab Echo (melodic dictation), premium Echo
   (Merc sings, you light stars), and Arpeggio Jumper "Echo the phrase".
   Lessons should name the exact surface.
6. **Week 5 warm-up pattern id** `five-tone-descending` is not a defined
   pattern. It falls through to the full warm-up (§3.1).
7. **Plan status lines are stale**: `onboarding-first-light.md` ("in review")
   and `ear-training.md` ("Phase 0") both shipped. Trust the CHANGELOG
   (0.9.17, 0.9.2).
8. **Spelling divergence**: exercise locale is en-GB (PRODUCT.md) while the UI
   moved to American spelling in 0.9.18. Pick one for lesson pages.

---

## 9. Recommendations for wiring lesson CTAs

- **Lesson 1 ("What is a note?": pitch, Hz, octave, letters, A4 = 440, C4 =
  middle C).** The terminology matches the app exactly. Primary CTA:
  `https://mercurypitch.com/mirror`. It is octave-folded, which matches the
  script's "an octave still counts", and it lands on Glide, Hold and Match
  with note names and cents. For a brand-new visitor, `https://mercurypitch.com/`
  runs First Light ("Sing one note" shows note and Hz). Secondary:
  `/exercises/perfect-octave`, but warn that drills score the written octave.
  Or add a gentler slug. In-app reading: `#/learn/study-pitch-basics`, after
  correcting it.
- **Lesson 2 (twelve notes, sharps and flats, semitones and whole tones).**
  Ear Lab Contour (100 cents "Half steps", 200 cents "Whole steps") and Leap
  m2/M2. This needs an `ear-drill` launch kind. Until then, `/ear-lab` plus an
  on-page instruction ("tap Contour"). Flag the sharp-only UI so the lesson
  explains why the app writes C#.
- Use **`/exercises/<slug>`** as the CTA format and request a batch of
  data-only slugs per lesson, plus `pattern`, `ear-drill`, `zen` and `learn`
  kinds (§2.8). Ask for a First Light skip on lesson links if desired.
- Put each video into the matching **Ascent week `resources`** (data) and,
  later, a Learn chapter per lesson (`#/learn/<id>`) as the in-app lesson
  explorer entry from Home's "Learn" button.
- Keep every CTA's copy inside the §4 rules: "Stop if anything feels
  uncomfortable", comfortable fixed durations, no breath-support, register,
  pronunciation or health claims, and safety content outside the paywall.
- Do not link Glassworks (`/glass-game`) or the premium exercises from web
  lessons.
