# Beside Cue: Home Play, The Cue, lip sync for every line, and smarter cues

**Date:** 2026-09-23 · **Status:** proposal with mocks and a working lip-sync
spike. No app code, content or media is changed by this document.

**Mocks:** [`home-play/index.html`](home-play/index.html) in this folder. It
loads the approved art and recordings from `apps/beside-cue/public/` by
relative path, so open it through any static server rooted at the repository
or the app, for example `python3 -m http.server -d apps/beside-cue` and then
`/docs/home-play/`. A copy with bundled assets is published as a private
artifact: <https://claude.ai/artifact/DSQ2e1NaT1pHAwNFC8jWrg>. The page plays
all eight scenes and the reel, all 67 English lines with their real lip-sync
tracks, the ten Cue forms with their chimes, and the smart-cue screens.

## 0. Summary

Home V1 is one still picture: the deck bitmap, the SVG record and Corky's rest
still. The record turns on **Cue me now** and settles once after a Side B.
Nothing else moves, and Corky never speaks on Home.

This plan turns that picture into a small stage, the **Home Play**. Corky, the
plan's Pull and a new character, **The Cue**, act short scenes of 6 to 12
seconds. The app picks a scene from context: time of day, what happened last,
how long the person was away, and whether a cue is near. Every spoken line is
lip-synced. Every scene ends in quiet, and then Home stays still until
something real happens.

Four pieces make it work:

1. **A scene director.** Scenes are data (beats, lines, poses, the final
   still). A pure selection function decides which one plays. It plays once
   for each occasion.
2. **Lip sync for every recorded line.** Mouths change at runtime, driven by
   viseme tracks generated offline from the recordings and bound to each
   recording's hash. The spike in this branch ran over all 67 English lines.
3. **The Cue as a character.** It is faceless and made of light. Its form
   follows the kind of cue (time, place, feeling, scent, thought, device,
   people, between things, or a reminder). It never speaks. It chimes.
4. **Smarter cues, all on the device.** Spotting a Pull in one tap, a
   forecast of when the Pull tends to visit, a reminder that moves earlier
   only with consent, and a smaller Side B when the current one keeps being
   too big.

Scope: English voice only. Spanish and German interfaces already play the
English recordings under translated captions (`SPOKEN_AUDIO_LOCALES`), and the
lip-sync tracks follow the audio, so every locale gets correct mouths from the
same data.

## 1. What exists today

| Area               | Where                                                               | State                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home stage         | `components/HomeScene.tsx`, `HomeRecord.tsx`, `HomeCompanion.tsx`   | Deck at 76% width, Corky at 56% front-right. The record is `still`, `spin` (680 ms handoff) or `settle`. `HomeCompanion` already accepts a looping video in `CORKY_HOME_ART`; the L01 living-rest clip was never delivered.                                             |
| Cast               | `content/pack.ts`, `premium-pulls.ts`                               | Corky has `rest`, `notice` and `quiet` stills. `turn` reuses `rest`. The 14 Pulls each have one approved Nano Banana token. A custom Pull has no creature, by rule.                                                                                                     |
| Moments            | `content/moments.ts`                                                | `cue.open`, `turn.b-side`, `turn.a-side`, `return` and `reminder.set`, with deterministic line rotation. This is the seed for the scene director.                                                                                                                       |
| Lines              | `content/voice-lines.ts`                                            | 67 canonical English lines. Corky has 25: onboarding 8, cue-open 3, side-b 3, not-now 3, return 3, reminder-set 2 and pressing 3. Each Pull has meet, present and recede. All 67 are recorded (4.9 MB, AAC, 48 kHz mono) and bound by caption SHA-256.                  |
| Where lines play   | `App.tsx`                                                           | Cue me now plays a cue-open line. The quiet screen plays side-b or not-now. The picker plays a Pull's meet line. Pull present and recede lines play only in onboarding. **Eight recorded Corky lines never play anywhere:** return ×3, reminder-set ×2 and pressing ×3. |
| Audio              | `audio/web-audio-output.ts`, `audio-session.ts`, `content/voice.ts` | One `AudioBufferSourceNode` per line, started at `context.currentTime`. The start time is not exposed, and lip sync needs it (section 5.4). One voice at a time, cancelled on mute, hide, route exit and replacement.                                                   |
| Onboarding picture | `onboarding/*`, `docs/corky-motion-refresh-2026-09-05.md`           | The greeting has lip sync baked into the Kling video. The refresh doc records that Flow cannot bind a mouth to an imported WAV, and that per-language mouths need separate performances. Runtime lip sync removes both limits for everything outside the hero shots.    |
| Domain             | `packages/beside-cue-core/src/types.ts`                             | A plan (`Cue`) has `pullCategoryId` and `cueContextSuggestionId` or `cueContextText`. Occurrences are manual or scheduled, with outcome `b_side` or `not_now`, `openedAt`, `outcomeAt` and `outcomeLocalDate`. Settings include `motion` and `voiceEnabled`.            |
| Cue kinds          | `content/pulls.ts`, `PullAnchorKind`                                | `device`, `place`, `routine`, `time` and `transition`. All 24 premium anchors are typed `transition`, including ones that are really feelings, people or thoughts (section 4.3).                                                                                        |

Today's Home, rendered from this branch with `?devSeed`, is the left phone in
the mocks.

## 2. Principles for a Home that feels like a film and still gives the day back

The product exists to return attention to a person's life. A Home that plays
like a small Pixar short has to keep that promise. These rules are part of
the design, not polish for later:

1. **Every scene ends.** Scenes are 6 to 12 seconds with a final still. There
   is no looping dialogue and no autoplaying next scene. After 20 seconds
   without input, Corky dozes (the quiet still) and only blinks remain.
2. **One occasion, one scene.** A scene plays once per occasion (section 3.3).
   The person can replay it on purpose with a tap on the stage.
3. **No Pull pitch without an answer.** A Pull's `present` line (its case for
   Side A) plays only in the Cue Moment, where Side B is on screen. On Home a
   Pull may peek, recede or react to being spotted. It never sells.
4. **The Cue shows the signal, never the temptation.** It is light, not the
   object of the habit. The mocks show no food, feed or device content.
5. **Sound waits for consent.** Nothing speaks before the first gesture of a
   session, or while Home is muted or voice is off. Without sound, the scene
   still plays with captions and silent lip movement.
6. **Captions always.** Every line shows its exact caption and is announced
   once to screen readers through a polite live region.
7. **Reduced motion keeps meaning.** It removes travel, rotation, parallax
   and camera moves. Characters appear in their settled pose. Mouths and
   blinks stay, because they carry speech and life without vestibular load.
   This matches `DESIGN.md`.
8. **Literal controls, metaphor in dialogue.** Buttons and rows keep their
   current literal copy. Record metaphors stay in Corky's lines.
9. **No new scores.** Scenes never mention counts, streaks or misses.

## 3. The Home Play

### 3.1 Stage

The stage replaces `HomeScene` in the same slot above the plan text. It is a
diorama with these layers, back to front:

| Layer           | Content                                                                                                                                                                      | Motion                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Backdrop plate  | The approved cream sweep (from `p02-table-ready`, empty region)                                                                                                              | None                                                                    |
| Light           | A continuous time-of-day grade, from the device clock: dawn gold, day neutral, dusk amber, night blue with a lamp pool. Later replaced by four generated plates (section 6). | Cross-fades over minutes. Never animated during a scene.                |
| Atmosphere      | Dust in the window beam (day), lamp glow (night)                                                                                                                             | Slow drift. Off in reduced motion.                                      |
| Deck and record | Current `DECK_ART` and `HomeRecord`                                                                                                                                          | Existing `still`, `spin`, `settle`, plus a label glint                  |
| Actors          | Corky (right), the plan's Pull (enters from the wings or peeks from behind the deck), The Cue (air)                                                                          | Puppet rig (section 5.6): breath, blink, pose swap, hop, lean, lip sync |
| Captions        | Film subtitles at the stage's lower edge: speaker name in Saira Condensed, the caption in Gabarito                                                                           | Words brighten as they are spoken                                       |
| Replay          | A 48 dp button, "Play the scene again", shown after a scene ends                                                                                                             | None                                                                    |

The plan text, **Cue me now** and the rows stay HTML below the stage, exactly
as today. The stage is decorative (`aria-hidden`), apart from the replay
button and the caption live region.

### 3.2 Scene library

Existing lines are used wherever one fits. **New** marks a line that needs
recording (section 8). Timings are at 24 fps and relative to scene start.
Speech beats hold the timeline until the line ends.

| Id  | Scene               | Plays when                                                                      | Beats                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Morning             | First open between 05:00 and 11:00, plan active                                 | 00:00 dawn grade rises, dust in the beam. 00:14 Corky wakes: quiet to rest with a stretch (squash 0.96, stretch 1.04, settle), two blinks. 01:10 Corky says `corky.home.morning.01` "Morning. The record's warm." (**new**; before it is recorded, `corky.return.03` "Right where we left the sleeve."). Then a glance at the record, a label glint, and the settle.                                                                |
| S2  | The Cue arrives     | A scheduled cue is within 45 min, or the forecast window is within 30 min (4.1) | 00:00 the grade tints toward the cue. 00:10 The Cue enters in its form (4.2) with its chime. 01:14 Corky notices (notice still, a tilt of 3°) and says `corky.cue-open.01` "Needle's hovering. No rush." 03:20 the plan's Pull peeks from behind the deck, silent, 40% visible, with one blink. 04:12 The Cue hovers over the record and a bubble shows the person's own cue text. Then the settle and one soft ring on Cue me now. |
| S3  | Cue me now (bridge) | Tap on Cue me now                                                               | The Cue drops onto the groove like a stylus while the record spins up (the existing 680 ms handoff). The Cue Moment opens. There, the Pull steps forward and says its `present` line, and Corky answers with a cue-open line while Side B is on screen.                                                                                                                                                                             |
| S4  | After Side B        | Return to Home after a `b_side` outcome                                         | 00:00 the record's existing slowing revolution, turquoise label. 00:12 Corky in the turn pose says a `side-b` line (existing rotation). 02:10 the Pull says its `recede` line (existing) and hops off stage left. The Cue fades out. 05:12 the grade softens, Corky goes to the quiet still, and the screen goes quiet.                                                                                                             |
| S5  | After Not now       | Return to Home after a `not_now` outcome                                        | The record stays still. Corky nods once and says a `not-now` line (existing). The Pull stays in the wings, silent, with no gloating. The Cue fades. Then quiet.                                                                                                                                                                                                                                                                     |
| S6  | Night               | 21:00 to 05:00, or inside quiet hours                                           | Night grade and lamp pool. Corky in the quiet still, slow breath, no sound. A tap on Corky plays `corky.home.night.01` "Quiet hours. I'll keep the deck warm." (**new**; before that, `corky.return.02` "Records wait. It's one of their best features.").                                                                                                                                                                          |
| S7  | Welcome back        | First open after 3 or more days away                                            | Corky looks up (notice) and says `corky.return.01` "There you are. The turntable kept your place." A glint runs across the record. No mention of time away.                                                                                                                                                                                                                                                                         |
| S8  | No plan yet         | No plan on the deck, once per session                                           | Empty platter. Corky says `corky.cue-open.03` "Quick spin with me?" The six free Pulls cross the back of the table in soft focus, each hopping once, in picker order. Then **Start a plan** takes focus.                                                                                                                                                                                                                            |
| S9  | A pressing          | First open of a month with at least one Side B the month before                 | Corky presents the month's pressing (7.6) and says `corky.pressing.01` "That's a pressing. Hold it up to the light." A tap opens the pressing view, which rotates `pressing.02` and `pressing.03`.                                                                                                                                                                                                                                  |
| S10 | Reminder set        | Return to Home after setting or changing the daily reminder                     | The Cue, in its time form, shows the chosen hour on a small ring. Corky says `corky.reminder-set.01` or `.02` (existing).                                                                                                                                                                                                                                                                                                           |
| S11 | Spotted             | After a Spotted tap (7.2)                                                       | The Pull pops up beside the deck, says its `spotted` line (**new**), and bows out. Corky gives one approving blink.                                                                                                                                                                                                                                                                                                                 |
| S0  | Living rest         | Anything else                                                                   | Breath every 3.2 s, a blink every 3 to 6 s (randomized), no sound. Corky dozes after 20 s without input.                                                                                                                                                                                                                                                                                                                            |

Paused plans get S0 with the record off the platter and a muted grade. There
is no speech while paused.

The existing moments engine already guarantees deterministic rotation. The
director reuses `itemAt` rotation for every line list, so a test can assert
the exact caption for a given state.

### 3.3 Selection

A pure function, `selectHomeScene(input)`, in
`apps/beside-cue/src/home-play/scene-selection.ts`. Its input:

```ts
interface HomeSceneInput {
  readonly now: LocalDateTime // wall clock, same rules as reminders
  readonly plan: 'none' | 'active' | 'paused'
  readonly pendingEvent?: 'b-side' | 'not-now' | 'reminder-set' | 'spotted'
  readonly lastOpenedAt?: Instant
  readonly nextScheduledCueAt?: Instant
  readonly forecastWindow?: { start: LocalTime; end: LocalTime } // section 7.1
  readonly quietHours?: { start: LocalTime; end: LocalTime }
  readonly monthlyPressingDue: boolean
  readonly played: ReadonlySet<string> // occasion keys already played
}
```

Priority, first match wins:

1. `pendingEvent`: S4, S5, S10 or S11. The occasion key is the event's id.
2. `monthlyPressingDue`: S9. Key `pressing:YYYY-MM`.
3. `plan === 'none'`: S8. Key `no-plan:<session>`.
4. `plan === 'paused'`: paused S0.
5. Cue window open: S2. Key `cue:<date>:<window start>`.
6. Away 3 or more days: S7. Key `return:<date>`.
7. Time slot greeting: S1 or S6, plus a gentle day and evening variant
   later. Key `slot:<date>:<slot>`. Slots are morning 05:00 to 11:00, day
   11:00 to 17:00, evening 17:00 to 21:00 and night 21:00 to 05:00. Quiet
   hours, when enabled, move the night slot.
8. Otherwise S0.

`played` lives in memory for the session plus one small persisted record of
the last played key per family. That record is presentation state, not
domain state, so it lives in the app's preference storage beside
`cinematic-onboarding-preference.ts`, not in `BesideCueStateV1`. The truth
table becomes a unit test file.

### 3.4 Scene data

Scenes are content, in `apps/beside-cue/src/content/home-scenes.ts`:

```ts
type ActorId = 'corky' | 'pull' | 'cue'

type Beat =
  | { readonly wait: number } // ms
  | { readonly actor: ActorId; readonly pose: PoseId }
  | {
      readonly actor: ActorId
      readonly move: 'enter' | 'exit' | 'hop' | 'peek' | 'nod' | 'stretch'
      readonly edge?: 'left' | 'right' | 'deck'
    }
  | { readonly actor: ActorId; readonly say: readonly string[] } // line ids, rotated
  | { readonly cue: 'arrive' | 'hover' | 'land' | 'fade' }
  | {
      readonly stage:
        | 'glint'
        | 'grade-up'
        | 'grade-soft'
        | 'ring-cue-button'
        | 'show-cue-bubble'
    }

interface HomeScene {
  readonly id: HomeSceneId
  readonly beats: readonly Beat[]
  /** The frame the scene ends on. It is also the reduced-motion frame. */
  readonly settle: StageFrame
}
```

`say` beats resolve when the line ends: audio `ended`, or a caption dwell of
55 ms per character plus 800 ms, clamped to 1.6 to 6 s, when silent. The
director is a small interpreter over this list. It is cancellable with one
token and stops on route exit, `visibilitychange` to hidden, mute and
teardown, using the same generations the audio session already has.

### 3.5 Camera, sound and craft

- **Camera.** A slow push-in of 1.00 to 1.04 over a scene, then a hold. A
  pointer or tilt parallax of up to 6 px between plate, deck and actors.
  Reduced motion removes both.
- **Animation principles used sparingly.** Anticipation before a hop, squash
  on landing, follow-through on Corky's limbs (later clips), a 2 to 4 frame
  lead of the eyes before a head turn, and settle on every end pose.
- **Sound.** Dialogue uses the existing lane. The Cue's chime and short
  Foley (felt thump for Pulls, wood tock, vinyl crackle on the needle drop)
  use the Foley lane. Music ducks under dialogue as it does today.
- **Budget.** At most three actors and The Cue. Idle motion is CSS
  transform-only. JavaScript runs per frame only while someone speaks.
  Everything pauses while the document is hidden. Stage stills are 768 px on
  phones. The whole Home Play v1 adds 6 MB or less to the app.

## 4. The Cue

### 4.1 Who it is

The product says a cue is "what brings the Pull into view: a time, a place, a
feeling, or a reminder" (Corky's `onboarding.cue-context` line), and that a
Pull character is never the cue. The Cue character keeps that line clear:

- **Pulls are things. The Cue is light.** Pulls are tactile objects with
  faces and feet. The Cue is a marble-sized glow of warm custard light
  (`#f2c84b` with a white core) and a short comet tail. It has no face.
- **It arrives, points and fades.** It never stays on Home and never
  follows the person around the app.
- **It never speaks.** Its voice is a two or three note chime in the score's
  key. Its glow pulses with the chime's loudness, driven by the same audio
  clock as the mouths.
- **It carries the person's words.** When it hovers, a small bubble can show
  the plan's own cue text, such as "When I get into bed with my phone." It
  never invents context.
- **Pixar reference, used honestly.** Like Luxo Jr., it acts through light
  and motion alone. Like the flavor swirls in Ratatouille, it makes a sense
  visible.

### 4.2 Forms

| Kind         | Form        | What it does on stage                                                                                                   | Chime                        |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `time`       | Clock-light | Enters through the window beam with a thin ring and one sweeping hand. The grade shifts slightly toward the cue's hour. | Two soft bell tones          |
| `place`      | Doorway     | Draws a door frame of light in the air, then steps through it.                                                          | Three rising notes           |
| `routine`    | Loop        | Traces one loop of a groove in the air and ends where it began.                                                         | A repeated two-note figure   |
| `transition` | Page        | A card of light flips over once, between two tasks.                                                                     | A paper swish and one note   |
| `feeling`    | Pulse       | A slow ripple crosses the stage and tints it: warm when restless, lavender when tired, rose when tense.                 | A low heartbeat under a pad  |
| `sense`      | Wisp        | A ribbon of steam curls up and beckons, like a scent trail.                                                             | A rising glissando           |
| `thought`    | Bubble      | A soap-film bubble inflates beside the deck with a soft silhouette of the Pull, then pops.                              | A bubble note                |
| `device`     | Glow        | A phone-shaped rectangle of cool light blinks on the table with two buzz rings. No screen content.                      | Two muted buzzes             |
| `people`     | Echo        | Two overlapping rings, like two voices.                                                                                 | Two alternating tones        |
| reminder     | Needle      | Lands on the record's groove like a stylus drop. This form is used when a scheduled reminder opens the app, and in S3.  | Vinyl crackle, then one note |

Rendering: procedural (SVG, CSS and a small Canvas2D particle trail),
because light should be crisp at every size, cheap and reactive. Generated
concept sheets (section 6) set the look. They are not shipped as bitmaps.

### 4.3 Kinds in the data

- Extend `PullAnchorKind` with `feeling`, `sense`, `thought` and `people`.
- Re-kind anchors whose current kind hides what they are:

| Anchor                                                           | Now          | Proposed                            |
| ---------------------------------------------------------------- | ------------ | ----------------------------------- |
| `anchor.two-minute-pause.tense-moment`                           | `routine`    | `feeling`                           |
| `anchor.snacking.see-food`                                       | `routine`    | `sense`                             |
| the-thimble: feedback · defensive · difficult conversation       | `transition` | `people` · `feeling` · `people`     |
| the-tab: another tab · switch tasks · start of work session      | `transition` | `device` · `transition` · `routine` |
| the-bookmark: stopping point · one more minute · time to move on | `transition` | `transition` · `thought` · `time`   |
| the-match: skip a break · several at once · new idea             | `transition` | `routine` · `routine` · `thought`   |
| the-pillow: phone to bed · tired · last thing tonight            | `transition` | `device` · `feeling` · `time`       |
| the-kettle: urgent message · answer now · plans change           | `transition` | `device` · `feeling` · `transition` |
| the-ticker: check the time · between tasks · behind schedule     | `transition` | `time` · `transition` · `feeling`   |
| the-tape: problem returns · fix everything · temporary fix       | `transition` | `routine` · `thought` · `thought`   |

- A custom cue gets an optional chip row, "What brings it on?", with Time,
  Place, Feeling, A sense, A thought, A device, People and Between things.
  The chosen kind is stored as `cueContextKind?: CueKind` on the plan. This
  is an optional field, so `state-validation.ts` must accept it. With no
  kind, The Cue appears as a plain glint.

## 5. Lip sync for every line

### 5.1 Choice

| Option                                            | Every line | Correct for later lines | Weight                                             | Reactive | Verdict                                                        |
| ------------------------------------------------- | ---------- | ----------------------- | -------------------------------------------------- | -------- | -------------------------------------------------------------- |
| Baked video lip sync (Kling, Seedance, Flow)      | 67 clips   | Re-render each time     | 20 to 60 MB                                        | No       | Only for hero shots (section 6)                                |
| Real-time 3D with blend shapes                    | Yes        | Yes                     | Model plus runtime                                 | Yes      | No. Blender and Meshy renders of Corky are banned (`pack.ts`). |
| Rive rig with a viseme input                      | Yes        | Yes                     | Rive runtime, about 200 KB of wasm                 | Yes      | Good upgrade path if an animator joins                         |
| **Runtime replacement mouths on approved stills** | **Yes**    | **Yes**                 | **About 30 KB per character plus 11 KB of tracks** | **Yes**  | **Recommended**                                                |

Replacement mouths are also what stop-motion studios use: a set of sculpted
mouths swapped per sound. That suits a cast made of cork, felt, wood and
clay.

### 5.2 The spike (this branch)

[Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) 1.14.0
(MIT) ran on every registered English recording. It used the PocketSphinx
recognizer with the exact caption as dialog text and the extended shapes
G, H and X.

| Measure       | Result                                                             |
| ------------- | ------------------------------------------------------------------ |
| Lines         | 67 of 67 (Corky 25, 14 Pulls × 3)                                  |
| Audio         | 312.6 s                                                            |
| Mouth cues    | 1,640 (5.25 per second)                                            |
| Shape counts  | B 520 · C 355 · X 188 · A 151 · F 136 · E 120 · D 71 · G 52 · H 47 |
| Wall time     | 3 min 12 s on 8 threads                                            |
| Size, compact | 10.8 KB for all 67 lines (161 bytes per line on average)           |

Compact format, one entry per recording:

```json
{
  "v": "XCBCBXDBCAEBX",
  "t": [0, 5, 17, 31, 45, 59, 103, 116, 123, 158, 166, 190, 232],
  "d": 266
}
```

`v` holds one shape letter per cue, `t` the start of each cue in
centiseconds, and `d` the duration. That entry is Corky's greeting, "Hi there,
I am Corky." The mocks play every line with these real tracks.

### 5.3 Pipeline

1. **Generate.** `apps/beside-cue/scripts/lipsync/generate-tracks.mjs` reads
   the registered English dialogue assets
   (`selected-character-voice-recordings.ts`). For each one it decodes the
   AAC to 16 kHz mono WAV with ffmpeg and writes the canonical caption as
   dialog text, with typographic apostrophes and dashes normalized. It runs
   `rhubarb -f json --extendedShapes GHX -d caption.txt`, then
   post-processes: merge cues shorter than 40 ms, force `X` at both ends, and
   clamp to the duration. The Rhubarb version is pinned in the script and
   written into the generated header.
2. **Bind.** The output is a generated module,
   `src/content/lip-sync-tracks.ts`, keyed by dialogue asset id and carrying
   the recording's byte `sha256`.
3. **Guard.** `lip-sync-tracks.test.ts` fails when a registered English
   dialogue asset has no track or a track with a different `sha256`, when
   cues are unsorted or overrun the duration, or when a track names an
   unknown shape. This is the same drift protection the caption hashes
   already give. CI does not need Rhubarb, because it only checks bindings.
4. **Correct.** A dev probe page, `lipsync-probe.html` (beside the existing
   `merc-probe.html` and `mic-probe.html`), scrubs a line against its
   waveform and lets a person nudge cue boundaries. Corrections are saved as
   overrides that the generator applies on the next run.

### 5.4 Runtime clock

- `AudioOutputPlayback` gains `mediaTime(): number | undefined`, defined as
  `context.currentTime - startedAt - (context.outputLatency || context.baseLatency || 0)`
  and clamped at 0. `web-audio-output.ts` already knows `startedAt`: it is
  the `now` it passes to `source.start`.
- `VoicePlayer` exposes the active line as a signal:
  `{ lineId, assetId, mediaTime() }`.
- The puppet samples `mediaTime()` in `requestAnimationFrame` only while a
  line is active. The target is that sound never leads the mouth by more than
  45 ms and never lags it by more than 125 ms, the detectability thresholds
  of ITU-R BT.1359. When unsure, the mouth runs one frame early.
- **No sound** (muted, voice off, or before the session's first gesture): the
  same track runs on `performance.now()` while the caption shows, so the
  scene still reads.
- **No track yet** (a new recording before the generator runs): an
  `AnalyserNode` on the dialogue lane maps loudness to three shapes (closed,
  mid, open).

### 5.5 Mouth art

- Nine frames per character: A (M, B, P), B (K, S, T, EE), C (EH, AE),
  D (AA), E (AO, ER), F (UW, OW, W), G (F, V), H (L) and X (rest). **X is the
  untouched approved mouth**, so a silent character is pixel-identical to
  today's art.
- Frames are painted by masked inpainting on the approved still, using Nano
  Banana 2 on Higgsfield with `is_inpaint`. Only the mouth region changes, in
  the character's own material and light. Corky is painted once per pose
  (rest, notice, quiet). The 14 Pulls start with their single token.
- Each frame is cropped to the mouth region plus feather and packed into a 3
  by 3 atlas, `public/art/rig/<id>/mouths.webp`, of about 20 to 40 KB.
- Characters with tiny mouths (The Usual, The Scroll, The Tape) may alias to
  four shapes: closed (A, X), small (B, C, E, G, H), open (D) and round (F).
- The mocks draw mouths as vector shapes over a patch of the character's own
  texture. That is the placeholder until the inpainted atlases exist.

### 5.6 Puppet

`apps/beside-cue/src/home-play/Puppet.tsx` takes the base still for the pose,
plus the lid patches for blinks and the mouth atlas at the face anchor. It
applies transform-only motion: breath (scaleY 1.000 to 1.012 from the feet,
3.2 s), a talk bob tied to mouth openness, hop, lean and peek. The face
anchors below were measured on the approved files for the mocks. Mouth
positions are the centre of the mouth in that file's pixels.

| Character    | File size | Mouth x, y, width | Eyes x, y, r                 |
| ------------ | --------- | ----------------- | ---------------------------- |
| Corky        | 1024²     | 521, 560, 70      | 435, 478, 48 · 605, 478, 50  |
| The Scroll   | 512²      | 265, 184, 16      | 231, 169, 14 · 296, 169, 14  |
| Sugarlump    | 512²      | 291, 173, 38      | 259, 129, 15 · 321, 129, 15  |
| The Usual    | 512²      | 223, 221, 14      | dot eyes 198, 204 · 247, 200 |
| Ember        | 512²      | 299, 183, 22      | 263, 161, 20 · 337, 165, 20  |
| Dinger       | 512²      | 325, 296, 46      | 262, 266, 25 · 370, 266, 25  |
| The Fog      | 512²      | 325, 298, 28      | half-closed, no blink        |
| The Thimble  | 343 × 512 | 102, 297, 42      |                              |
| The Tab      | 414 × 512 | 159, 305, 34      |                              |
| The Bookmark | 232 × 512 | 143, 244, 26      |                              |
| The Match    | 179 × 512 | 59, 305, 24       |                              |
| The Pillow   | 400 × 512 | 292, 274, 26      |                              |
| The Kettle   | 461 × 512 | 172, 379, 22      |                              |
| The Ticker   | 442 × 512 | 174, 333, 50      |                              |
| The Tape     | 512 × 496 | 184, 102, 16      |                              |

The anchors move to `src/content/face-anchors.ts` as fractions of each
file's size, so a re-export at another resolution keeps working.

## 6. Making the art and motion

Three tiers, each used for what it does best:

1. **Runtime puppet (everyday Home).** Approved stills, inpainted mouths and
   lids, CSS transforms and procedural light. It handles every line, reacts
   to taps, and is light.
2. **Performance clips (life between lines).** Short loops and moves:
   Corky's living rest (the L01 slot), a Pull hop in and out, a peek. Loops
   are generated with the approved still as both the start and end frame, so
   they close by construction. Sound is off, and the mouth is kept still in
   the prompt. Delivery is a WebP sprite sheet with alpha, never alpha video,
   which protects the iOS path that `corky-motion-refresh-2026-09-05.md`
   warns about. A talking beat on top of a clip uses a per-frame face track
   exported offline, so the mouth atlas follows the head.
3. **Hero cinematics (rare, baked).** The onboarding greeting redo, a Pull's
   first meeting, seasonal scenes. These are audio-driven: the approved WAV
   is passed as the audio reference, so the mouth is locked to the recorded
   take. The output is opaque MP4 in the existing onboarding media pipeline.

| Asset                                             | Primary tool                                                                              | Why                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| The Cue concept sheets                            | Midjourney v7 with `--sref` from the cast renders                                         | Fast, wide exploration of a new look. Not shipped.  |
| Time-of-day plates (morning, day, evening, night) | Nano Banana Pro, image to image from the approved `p02` plate                             | Keeps the approved set. Only the light changes.     |
| Replacement mouths and blink lids                 | Nano Banana 2 inpaint with a mask                                                         | Paints inside the mask only, on the approved pixels |
| Missing poses (Corky turn and wave, Pull peek)    | Nano Banana Pro edit, same canvas framing                                                 | Fills `turn`, which reuses `rest` today             |
| Idle loops                                        | Kling 3.0 or Gemini Omni Flash 1.1, start frame = end frame = approved still              | The loop closes by construction                     |
| Hops and entrances with alpha                     | Higgsfield AutoSprite, custom animation, background removed                               | Sprite sheet with alpha, so no alpha video on iOS   |
| Hero lines, audio-locked                          | Seedance 2.5 `omni_reference` with the WAV as `audio_references`, or Wan 2.7              | The mouth follows the approved recording            |
| Trailers and store video                          | Google Flow, Gemini Omni Flash 1.1, with the saved Corky character and record-player prop | Multi-shot storytelling with saved ingredients      |

The full prompt library is in the mocks (section "Making of") and in the
appendix below. Nothing in this plan authorizes paid generation. Each batch
starts with the owner.

## 7. Smarter cues, all on the device

Everything below is computed on the device, from data the app already keeps
or from one new record type. Nothing leaves the phone. Every change to
reminders needs the person's yes.

### 7.1 Cue Forecast

- **What.** It learns when the Pull tends to show up and draws it as a soft
  arc on a 24-hour ring in Reflection, in the punched-dial style.
- **Data.** Resolved occurrences (`openedAt`, both outcomes), Spotted records
  (7.2) and manual cues, in local wall-clock minutes. Weekdays and weekends
  are split once each has 6 events. Before that they are pooled.
- **Math.** A circular kernel density over minutes of the day: a von Mises
  kernel with κ of 24 (about ±47 minutes), weighted by recency with a 21-day
  half-life. A window is reported only when the effective sample size is at
  least 5 and the peak is at least 1.8 times the uniform density. At most
  two windows are reported.
- **Voice.** Corky says it once: "I've noticed when the Pull tends to visit.
  Want the cue a little earlier?" (**new**). The time is in the caption, not
  the voice, because recorded lines never interpolate.
- **Where.** `packages/beside-cue-core/src/cue-forecast.ts`: pure, with a
  seeded test suite.

### 7.2 Spotted

- **What.** Noticing is the skill this app teaches, so noticing gets one tap:
  "I noticed it". There is no outcome to choose.
- **Entry points.** A long press on the stage's Pull or record, an action on
  the daily reminder notification, an app shortcut, and later a Quick
  Settings tile.
- **Data.** `PullSighting { id, cueId, at, localDate, source }` as a new
  collection in `BesideCueStateV1`. This needs a migration step and
  `state-validation.ts` support. It is private, never a score, and shown in
  Reflection only as "noticed", beside Side B choices.
- **Scene.** S11, with a `spotted` line per Pull (**new**, 14 lines).

### 7.3 A cue that moves earlier, with consent

When a forecast window exists and the daily reminder falls inside it or
after it, Corky offers to move the reminder to 15 minutes before the window,
rounded to 5 minutes. A move is limited to 30 minutes per week and happens
only on "Yes". Declining silences the offer for 14 days. The OS notification
stays generic, as it is today.

### 7.4 A smaller Side B

When two of the plan's last three outcomes within 7 days are `not_now`,
Corky offers: "Want a smaller B-side? Small still counts." (**new**). Every
built-in action gets an authored smaller variant, for example:

| Action                 | Smaller variant                        |
| ---------------------- | -------------------------------------- |
| `bside.street-walk`    | Step outside the door for one minute.  |
| `bside.guitar-riff`    | Pick up the guitar and play one chord. |
| `bside.make-tea`       | Fill the kettle.                       |
| `bside.six-breaths`    | Take one slow breath.                  |
| `bside.quiet-work`     | Work for one quiet minute.             |
| `bside.open-file-line` | Open the file.                         |

Accepting uses the existing replace flow, so history stays. Declining
silences the offer for 14 days. This follows the product rule "make the next
action tiny and concrete".

### 7.5 Let it play out

This is an optional path in the Cue Moment: a 90-second pause while the
record plays the score's calm loop and the Pull slowly shrinks and fades. It
ends on a `side-b` line. It borrows the idea of urge surfing (urges rise and
fall) and presents it as a pause, not therapy, in line with `PRODUCT.md`.

### 7.6 The monthly pressing

On the first open of a month, the Side B choices from the month before
become a record. Each turn is one groove: the radius comes from the day of
the month, the arc from the time of day, and the tint from the action's
theme. The label is the Pull, turned toward Side B. No numbers appear on it.
Tilting the phone moves a sheen across the grooves. This is where Corky's
three recorded `pressing` lines finally play. The image can be exported
through the share sheet, and it carries no text.

### 7.7 Cues from anywhere

- **iOS:** App Intents "Cue me now" and "I noticed it", through a small
  Capacitor plugin, so Shortcuts personal automations can run them, for
  example "When I open a feed app". A `besidecue://cue` URL is the
  fallback.
- **Android:** static app shortcuts for the same two actions, a Quick
  Settings tile, and intents that automation apps can fire.
- **Privacy.** The OS decides when to fire. Beside Cue never reads app usage.

### 7.8 Later: on-device language help (research)

With opt-in and on-device only (Apple Foundation Models on iOS 26, Gemini
Nano on Android), the app could suggest a concrete, tiny rewrite of a custom
Side B. Templates stay the fallback. This is not scheduled.

### 7.9 Priority

| Feature                 | Value                | Effort | Depends on                      |
| ----------------------- | -------------------- | ------ | ------------------------------- |
| Spotted                 | High: the core skill | M      | Migration, 14 new lines         |
| Cue Forecast            | High                 | M      | Spotted helps, but not required |
| Earlier cue, consented  | High                 | S      | Forecast                        |
| Smaller Side B          | Medium               | S      | Content only                    |
| Monthly pressing        | Medium (delight)     | M      | Lines already recorded          |
| Let it play out         | Medium               | S      | Score loop exists               |
| Cues from anywhere      | High for some people | M to L | Native plugins                  |
| On-device language help | Unknown              | L      | Research                        |

## 8. New lines to record (English)

Same delivery contract as `media-source/audio/character-voices-v1/README.md`:
mono AAC-LC, 48 kHz, 128 kbps, peaks at or below -2 dBTP, exact captions,
Corky in the selected J2 voice, and each Pull in its selected voice. The
lip-sync generator runs after registration.

| Id                       | Speaker   | Caption                                                                                                                                           | Direction                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `corky.home.morning.01`  | Corky     | Morning. The record's warm.                                                                                                                       | Just awake, friendly, unhurried            |
| `corky.home.morning.02`  | Corky     | Early light. Good for listening.                                                                                                                  | Soft, a small smile                        |
| `corky.home.day.01`      | Corky     | Middle of the day. Needle's resting.                                                                                                              | Relaxed, matter-of-fact                    |
| `corky.home.evening.01`  | Corky     | The light's gone amber. No rush.                                                                                                                  | Warm, slower                               |
| `corky.home.night.01`    | Corky     | Quiet hours. I'll keep the deck warm.                                                                                                             | Low, close, never a whisper                |
| `corky.home.night.02`    | Corky     | Late one. The record can wait for morning.                                                                                                        | Gentle, no instruction to sleep            |
| `corky.cue-arrives.01`   | Corky     | There's your cue. I see it too.                                                                                                                   | Noticing, side by side                     |
| `corky.cue-arrives.02`   | Corky     | Something's cueing up.                                                                                                                            | Curious, light                             |
| `corky.forecast.01`      | Corky     | I've noticed when the Pull tends to visit. Want the cue a little earlier?                                                                         | An offer, easy to decline                  |
| `corky.smaller.01`       | Corky     | Want a smaller B-side? Small still counts.                                                                                                        | Encouraging, never disappointed            |
| `corky.tap.01` to `.03`  | Corky     | Still here. · Just minding the record. · Mm-hm?                                                                                                   | Short replies to a tap                     |
| `pull.<id>.spotted` (14) | Each Pull | For example, The Scroll: "Oh. You saw me start." Sugarlump: "Caught me reaching." Dinger: "Ding. Noticed." The Fog: "You can see me. That helps." | Yield with good grace, no defeat or praise |

The 14 `spotted` captions need a script pass with the voice notes in
`pack.ts` before any recording.

## 9. Engineering plan

### 9.1 New and changed modules

| Path                                                             | Change                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/beside-cue/src/audio/web-audio-output.ts`                  | `mediaTime()` on playback (5.4)                                                |
| `apps/beside-cue/src/content/voice.ts`                           | Active-line signal with `mediaTime`                                            |
| `apps/beside-cue/scripts/lipsync/generate-tracks.mjs`            | New generator (5.3)                                                            |
| `apps/beside-cue/src/content/lip-sync-tracks.ts` (+ test)        | Generated, hash-bound tracks                                                   |
| `apps/beside-cue/src/lip-sync/track.ts` (+ test)                 | Decode compact track, `shapeAt(t)` with a 60 ms minimum hold and a 30 ms blend |
| `apps/beside-cue/src/content/face-anchors.ts` (+ test)           | Anchors as fractions of each file's size (5.6)                                 |
| `apps/beside-cue/src/home-play/Puppet.tsx`                       | Character rig                                                                  |
| `apps/beside-cue/src/home-play/CueLight.tsx`                     | The Cue, ten forms (4.2)                                                       |
| `apps/beside-cue/src/home-play/HomeStage.tsx`                    | Diorama, replaces `HomeScene` in `HomeScreen`                                  |
| `apps/beside-cue/src/home-play/scene-director.ts` (+ test)       | Beat interpreter with cancellation (3.4)                                       |
| `apps/beside-cue/src/home-play/scene-selection.ts` (+ test)      | Pure selection and truth table (3.3)                                           |
| `apps/beside-cue/src/content/home-scenes.ts` (+ test)            | Scene data; every line id must exist in the pack                               |
| `apps/beside-cue/src/content/pulls.ts`, `premium-pulls.ts`       | New anchor kinds, re-kinded anchors (4.3)                                      |
| `packages/beside-cue-core/src/types.ts`, `state-validation.ts`   | `cueContextKind`, `PullSighting` collection, migration                         |
| `packages/beside-cue-core/src/cue-forecast.ts` (+ test)          | Forecast (7.1)                                                                 |
| `apps/beside-cue/src/screens/CueMomentScreen.tsx`                | Puppet with lip sync, the Pull's `present` line then Corky's answer            |
| `apps/beside-cue/src/screens/ChoosePullScreen.tsx`               | Meet lines with lip sync in the picker                                         |
| `apps/beside-cue/lipsync-probe.html`, `src/dev/lipsync-probe.ts` | Sync lab (5.3), dev only                                                       |

No new runtime dependency is needed. New modules get banner headers so
`docs/agent/INDEX.md` picks them up, and `pnpm beside-cue:typecheck` runs once
before the first PR push, per `AGENTS.md`.

### 9.2 Tests that prove it

- Selection truth table: every row of 3.3, time zone and DST safe.
- Director: exactly-once lines, cancellation on hidden, mute and route exit,
  stale tokens ignored, reduced motion lands on `settle` with no travel.
- Lip sync: tracks bound to asset hashes; `shapeAt` boundaries; silent clock
  when muted; analyser fallback when a track is missing.
- Content: every scene line exists and is recorded; no Pull `present` line in
  a Home scene (principle 3 as a test).
- E2E (Playwright, `e2e/home-play.e2e.ts`): S1, S4 and S8 render and settle;
  the replay button works; captions match; reduced motion; a phone-width
  screenshot check with `pnpm audit:mobile`-style assertions.
- Device: mouth versus audio on a Pixel and an iPhone with the probe page,
  wired and Bluetooth, recorded in the PR.

## 10. Roadmap

| Phase | Scope                                                                                                                                                | Done when                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | This plan, the mocks and the lip-sync spike                                                                                                          | The owner has reviewed the direction                                                                                                        |
| 1     | Lip-sync foundation: clock, generator, tracks, anchors, Corky's three poses and the six free Pulls' atlases, Puppet in the Cue Moment and the picker | Every registered English line has a bound track, the mouth is within the sync window on two devices, and there is no new runtime dependency |
| 2     | Home Play v1: HomeStage, director, selection, S0, S1, S4, S5, S6, S7 and S8, a CSS time-of-day grade, captions and replay                            | The truth table and director tests pass, low-end Android holds 60 fps at idle and 30 fps while speaking, and the size budget holds          |
| 3     | The Cue: kinds, re-kinded anchors, ten procedural forms, chimes, S2 and S3                                                                           | Every form renders in reduced motion as its settled frame, and chimes duck correctly                                                        |
| 4     | Smarter cues: Spotted (with the migration and 14 lines), Forecast, earlier cue with consent, smaller Side B, S10 and S11                             | Forecast tests are seeded and deterministic, and no reminder changes without a yes                                                          |
| 5     | Delight and reach: the pressing (S9), let it play out, OS automations, generated plates, performance clips and hero cinematics                       | Each item ships behind its own review                                                                                                       |

## 11. Open questions for the owner

1. Should Home ever voice a Pull's `present` line outside the Cue Moment?
   This plan says no.
2. Is The Cue faceless light (this plan), or a paper cue card with a face?
   The mocks show the light.
3. With sound on, should the first scene of a session speak after the first
   tap, or only when the stage itself is tapped?
4. How often may a greeting play: once per time slot (up to four a day), or
   once a day plus event scenes?
5. Do Deluxe Pulls act on Home only when the plan uses them? This plan
   assumes yes.
6. Should Spotted appear in Reflection, or stay private to the forecast?
7. What is the generation budget for mouths, lids, plates and loops (section
   6)? Is a Rive animator a later option?

## 12. Risks

| Risk                                                                   | Mitigation                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Mouth patches do not match a pose's light                              | Inpaint per pose; contact-sheet QA per character and line                              |
| Rhubarb mistimes stylized reads (The Fog's 12.9 s meet, "Ding—unrung") | Override file edited in the probe page                                                 |
| Bluetooth output latency; `outputLatency` support differs by browser   | Measure on devices; allow a per-route offset; the mouth runs early rather than late    |
| Decoded bitmap memory on low-end Android                               | 768 px stage stills, three actors at most, pause while hidden                          |
| Home becomes something to watch                                        | Principles 1 and 2, the doze after 20 s, no autoplay after a scene, and tests for both |
| Showing a Pull prompts the urge                                        | Principles 3 and 4, enforced by a content test                                         |
| App size                                                               | 6 MB budget for Home Play v1; sprite sheets only where a clip earns its place          |

## Appendix A. Prompt library

The prompts use the approved renders as references. Replace `<ref:…>` with
the uploaded approved file. Keep every prompt's constraints. Do not paste a
private path into a prompt.

**The Cue concept sheet (Midjourney v7):**

```text
character design sheet of a tiny faceless being made of warm light: a marble-sized custard-gold glow with a white-hot core and a short soft comet tail, drifting above a cream paper miniature tabletop set; nine small studies of the same light taking different forms: a thin clock ring with one sweeping hand, a curl of steam shaped like a beckoning finger, a soap-film thought bubble holding a soft silhouette, a slow heartbeat ripple of light, a glowing doorway outline drawn in the air, a phone-shaped rectangle of cool glow on a table, a flipping card of light, two overlapping sound rings, a spark landing on a vinyl record groove like a stylus; tactile stop-motion miniature photography, macro lens, soft window light, warm cream backdrop, no face, no eyes, no text --ar 3:2 --sref <ref:cast-lineup> --v 7 --style raw
```

**Time-of-day plate (Nano Banana Pro, image to image from the approved plate):**

```text
Same miniature set, same camera, same cream paper sweep and texture. Remove nothing else. Change only the light to early morning: a pale gold sun beam enters from the upper left through an unseen window, soft long shadows to the right, a few floating dust motes in the beam. Keep the colours of the set. No new objects, no text. Portrait 9:16.
```

Evening: "a low amber-rose dusk light from the left, deeper shadows".
Night: "the room in deep blue ambient light with one small warm lamp pool on
the right of the table".

**Replacement mouth (Nano Banana 2 inpaint, one per shape):**

```text
Edit only inside the mask. Same character, same material, same light, same camera. Paint the mouth as shape D: wide open as when saying "ah", a dark warm interior, a hint of tongue at the bottom, soft rounded edges that match the sculpted smile. Everything outside the mask must stay pixel-identical.
```

Shape phrases: A "lips pressed together as for m, b, p"; B "slightly parted,
teeth just visible, as for s and t"; C "open, relaxed, as in 'eh'"; E "a
medium rounded opening, as in 'or'"; F "small round pucker, as in 'oo'";
G "upper teeth resting on the lower lip, as for f and v"; H "open with the
tongue tip raised behind the upper teeth, as for l".

**Blink lids (Nano Banana 2 inpaint):**

```text
Edit only inside the mask over both eyes. Same character and light. Close the upper lids fully over the eyes, made of the same material as the lids now, with the same soft rim; no lashes. Everything outside the mask must stay pixel-identical.
```

**Idle loop (Kling 3.0 or Gemini Omni Flash 1.1, start frame = end frame = approved still, sound off, 5 s):**

```text
Corky, the rose-plum cork character with eight tubular limbs, stands beside the record player and breathes gently; his limbs sway a few millimetres out of phase; one slow blink at two seconds; mouth closed and still; camera locked; light unchanged; the final frame matches the first frame exactly.
```

**Pull hop in (Higgsfield AutoSprite, `kind: custom`, background removed, 25 frames, 384 px):**

```text
The Scroll, a pale blue rolled-scroll character with small curled feet, hops in from the left with a small anticipation crouch, one soft landing with a slight squash, then settles facing three-quarter right; mouth closed.
```

**Hero line, audio-locked (Seedance 2.5 `omni_reference`, image references: approved Corky still and deck, audio reference: the approved WAV, `generate_audio: false`, 9:16):**

```text
Corky greets the viewer and speaks exactly the supplied audio; the mouth follows the audio; a small upward stretch on the first word; warm eyes; camera locked medium shot; cream paper set; tactile stop-motion look; no other characters.
```

**Trailer shot (Google Flow, Gemini Omni Flash 1.1, saved Corky character and record-player prop):**

```text
Morning on the cream paper set. Dust drifts in a pale gold beam. Corky wakes beside the record player and stretches his eight limbs. A small warm light drifts in through the beam and settles over the record's groove. Corky notices it and smiles. Slow push-in, 8 seconds, no dialogue.
```

## Appendix B. Reproducing the spike

```sh
# From apps/beside-cue, with Rhubarb 1.14.0 and ffmpeg on PATH.
ffmpeg -i public/audio/voice/en/corky/en__corky__onboarding-greeting__v1_02.m4a -ac 1 -ar 16000 greeting.wav
printf "Hi there, I am Corky.\n" > greeting.txt
rhubarb -f json --extendedShapes GHX -d greeting.txt -o greeting.json greeting.wav
```

Running over every registered English recording with eight parallel jobs took
3 min 12 s. The generator in section 5.3 wraps the same command.
