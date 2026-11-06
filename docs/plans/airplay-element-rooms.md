# AirPlay alone: the rooms whose sound is a media element

Status: a plan for the owner to approve room by room. Nothing in it is built.
Read from `origin/main` at `57f3d4e83` (6 Nov 2026), which carries PR #1376
(`bb2df9ba3`, the commit tagged `mp-v0.8.56`).

Over plain AirPlay (the TV chosen under AirPlay in Control Center, not Screen
Mirroring) the native iOS app's Karaoke room was silent until PR #1376 kept its
sound Web Audio only there. This plan asks the same question of every other
room: which of them make their sound with an `<audio>` or `<video>` element,
and what is the smallest way to keep each one Web Audio only while
`airPlayAlone()` holds (`src/stores/airplay-suspicion.ts:114`).

Facts carry a `file:line`. What was read from WebKit's source and never tried
on a device, and what was worked out rather than read, says so.

## What is known

The Developer screen's AirPlay sound check
(`apps/mercurypitch/src/shell/airplay-check.ts`, Test 9 in
[tv-device-tests.md](tv-device-tests.md)), on an iPhone 13 and the LG C2,
TestFlight mp-v0.8.56 build 1716, 6 Nov 2026, the TV chosen under AirPlay:

| Button | What plays                                                                  | Heard                                            |
| ------ | --------------------------------------------------------------------------- | ------------------------------------------------ |
| 1      | A plain `<audio>` of a generated WAV (a `blob:` URL), allowed on AirPlay    | Nothing, on the TV or the phone                  |
| 2      | The same element kept local (`keepMediaLocal`, `src/lib/local-media.ts:39`) | Nothing at all                                   |
| 3      | Web Audio alone, a fresh AudioContext                                       | The TV                                           |
| 4      | Web Audio while a silent element kept local plays                           | Never                                            |
| 5      | Web Audio with the mic open                                                 | The TV, every time, three times straight after 4 |

So while an element plays on AirPlay alone, nothing is heard, the element's
own sound included. PR #1376 keeps Karaoke Web Audio only there: the lock
screen's carrier stands aside, paused and muted
(`packages/mobile-runtime/src/carrier-aside.ts:66-70`), and the unlock clip
stays quiet (`src/lib/audio-unlock.ts:119-127`, `:209-213`), both wired
app-wide by `standAsideOnAirPlay()`
(`apps/mercurypitch/src/infrastructure/native-device.ts:174-188`). The owner
heard Karaoke on the TV, the phone quiet, about 2 s late.

Muted as well as paused because `carrier-aside.ts:10-14` reads WebKit's
`MediaSessionManagerCocoa::updateSessionState` as keeping the session in
playback for an element that is audible and has played audibly since the
last interruption, playing or not. **That reading comes from WebKit's source
and has not been verified on a device.** Every "stays around" finding below
leans on it.

A caveat on button 1 (inference): its URL is a `blob:` URL, which a TV could
not fetch if WebKit handed the URL over. Button 2, kept local, played nowhere
either, the phone included, so a fetch the TV could not make does not explain
both.

## What "5 straight after 4" shows

The check cannot overlap itself. The panel disables every button from the tap
until the check has been torn down
(`apps/mercurypitch/src/shell/AirPlayCheckPanel.tsx:32-42`, `:55`). A check
waits for its beeps plus `HOLD_MS`, 3000 ms, and then, in a `finally`, stops
the source, closes its context, lets go of the mic, pauses the element,
removes its `src`, calls `load()` and revokes the URL
(`airplay-check.ts:278-315`). Button 4's element plays a looping WAV of
silence, kept local (`airplay-check.ts:199-207`).

So each time 5 played straight after 4, 4's element had looped its silence
for about 5 s (4's beeps take 2.04 s, `beepSeconds(4)`, then the 3 s hold)
and had then been emptied, and its context closed, before 5 could be pressed.
That shows one thing:

- An element that played (silent samples, unmuted, kept local) and was then
  emptied does not keep a later, fresh Web Audio context off the TV, with the
  mic open.

It does not show:

- What an element does that played and was then paused but **not** emptied.
  That is the state most rooms leave their elements in (see "Elements that
  play and then stay around").
- Whether muting alone is enough.
- Whether 3, without the mic, would have played after 4. Opening the mic
  changes the page's audio session (inference: WebKit moves it to play and
  record), which could reset the route by itself.
- Anything about an element playing at the same time through
  `createMediaElementSource`, which is how every room below plays its
  elements.
- Anything about a context made before AirPlay was chosen. Every check makes
  a fresh one (`airplay-check.ts:136-142`); rooms play on long-lived ones.

## Which rooms the native app can reach

The native app renders the web app's `<App />` beside its own shell
(`apps/mercurypitch/src/main.tsx:453-457`), in **one document**: its build
has two inputs, the app and the TV stage
(`apps/mercurypitch/vite.config.ts:457-478`, read from `HEAD`, outside this
worktree's sparse cone). The standalone pages `/karaoke`, `/piano-night` and
`/guitar-night` are a 404 in the WebView, and the More sheet opens the in-app
tabs instead (`apps/mercurypitch/src/shell/MoreSheet.tsx:33-37`). Glass is a
standalone page too (`src/features/glass/main.tsx`).

The shell's own navigation opens Home (the alley), Sing, Ear Lab, Karaoke and
its studio, Piano, Guitar and Progress (every `goToTab`/`setActiveTab` in
`apps/mercurypitch/src`), and the premium rooms, First Note among them
(`apps/mercurypitch/src/shell/premium-exercise-wiring.ts:56`). Its Guitar is
the in-app Guitar tab (`src/pages/GuitarPage.tsx`), which plays no element
(no element in `src/pages/GuitarPage.tsx`, `src/features/guitar-practice` or
`src/features/session-drummer`). Nothing in the shell opens Jam, Hear Yourself
(Voice History) or the Lab, though all three are in the document; the web's
own ways in (a Jam link, `src/features/routing/useHashRouter.ts:320-323`; a
guided check's return, `src/App.tsx:750`) were not tried in the app.

On the web there is no `airPlayAlone()` worth keying on (inference): the
route and the session's rate it reads come from the native shell
(`airplay-suspicion.ts:5-10`, `src/stores/audio-route-store.ts:45-64`).

## The rooms

| Room                                 | In the native app                                           | Main sound on iOS                                                                                                                                                | AirPlay alone today                                 |
| ------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Karaoke                              | Yes                                                         | Web Audio only                                                                                                                                                   | Fine: the owner heard it on the TV                  |
| First Note                           | Yes, a premium room                                         | Two `<audio>` a run, band and voice, through `createMediaElementSource`                                                                                          | Unknown: check 6 decides                            |
| Preview player: Karaoke Studio stems | Maybe: whether the result list shows natively is unverified | One `<audio>` through `createMediaElementSource`                                                                                                                 | Unknown: check 6                                    |
| Preview player: Zen example cue      | Not traced                                                  | The same                                                                                                                                                         | Unknown: check 6                                    |
| Jam song room                        | In the document, no way in from the shell                   | Instrumental `<audio>` through `createMediaElementSource` once the context runs, plain before; guide vocal decoded; each peer a plain `<audio>` of a MediaStream | Likely silent with a peer (inference), else check 6 |
| Hear Yourself (Voice History)        | In the document, no way in from the shell                   | A decoded AudioBuffer for webm, mp4 and m4a takes; `<audio>` through `createMediaElementSource` otherwise                                                        | Fine for a take recorded on iOS (inference)         |
| Lab, offline pitch canvas            | In the document, hidden                                     | `<audio>` through `createMediaElementSource`                                                                                                                     | Unknown; nobody puts it on a TV                     |
| Guitar Night                         | No: a standalone page                                       | Web only: decoded AudioBuffers, or one `<audio>` a stem through `createMediaElementSource`                                                                       | Not in the app                                      |
| Glass                                | No: a standalone page                                       | Web only: decoded AudioBuffer, element only if the decode fails                                                                                                  | Not in the app                                      |

### First Note

`src/features/first-note/song-player.ts`, made by
`useFirstNoteController.ts:104` for each run.

- One `<audio>` per stem, band and voice, kept local (`:73-78`), routed into
  the room's context through `createMediaElementSource` on first use
  (`:81-90`), started together (`:196`). The lead-in is the band alone and
  the line is both stems (`:14-18`): every note of the song is an element.
- The context is the one the microphone opened (`:27-30`), so the mic is
  open, as with button 5. The sound's position is the band element's clock
  (`:208`).
- Each sound ends with `el.pause()` after its fade (`:166-171`). Between
  rounds both elements keep their `src`, unmuted, until `dispose()` empties
  them (`:222-231`).
- The stems are Karaoke's examples at the app's origin, or the singer's own
  split songs from the phone's store (`first-note-songs.ts:75-76`).
  Karaoke's stems are m4a and mp3 (`src/features/stem-mixer/streaming-stem-voice.ts:28-29`).

### The preview player

`src/lib/preview-player.ts`. One element, kept local, routed through
`createMediaElementSource` into its own context or a caller's graph
(`:283-311`), played at `:409`. Pause and stop only pause it (`:459-488`); its
`src` goes only on `dispose()` (`:552-566`, `:586-589`). Its users:

- Karaoke Studio's separated-stem previews (`src/components/UvrResultViewer.tsx:329`,
  disposed at `:447-450`), inside the `UvrPanel` that Karaoke Studio hosts
  (`src/features/karaoke-room/KaraokeStudio.tsx:158`). In the native build a
  finished split goes straight to the room (`src/components/UvrPanel.tsx:249-255`),
  so whether the result list ever shows there is unverified.
- Zen's example cue, a short spoken clip
  (`src/features/zen/ZenPitchStage.tsx:201-209`, `:449`). The stage's own
  `<audio>` is a preloader that is loaded and never played (`:472-483`,
  `:1092`). Whether the app's Sing tab opens the Zen stage was not traced.
- Guitar Night's take playback (`src/features/guitar-night/useGuitarRecordingPlayback.ts:235-247`):
  not in the app.
- Studio's previews (`src/features/studio/audio/useStudioTransport.ts:260`):
  Studio is off in every native build (`apps/mercurypitch/src/main.tsx:26-31`).

### Jam song room

- The instrumental is the stage's only element, an `<audio>` with
  `disableremoteplayback` and `x-webkit-airplay="deny"`
  (`src/components/jam/JamSongStage.tsx:633-647`). It goes through
  `createMediaElementSource` on the first play that finds the shared engine's
  context running, and plays as a plain element until then
  (`src/lib/jam/jam-song-transport.ts:14-33`, `:151-172`). A pause leaves it
  paused with its `src`; the transport's dispose leaves the element to Solid
  (`:324-336`).
- The guide vocal is a decoded AudioBuffer through a GainNode
  (`src/lib/jam/jam-guide-player.ts:1-15`), fetched when it is first turned up.
- Each peer is a plain `<audio>` with `srcObject` set to the peer's stream,
  autoplay, appended to `<body>`, neither kept local nor routed
  (`src/stores/jam-store.ts:1913-1945`, `:2048-2049`), because Chrome's echo
  canceller hears only a peer connection's own output (`:1916-1921`). It is
  emptied when the peer or the room goes (`:1947-1954`, `:3260`). The room is
  left only by its Leave button (`src/components/jam/JamPanel.tsx:877`, to
  `jam-store.ts:2391-2394`), so a room with a peer keeps those elements
  playing on any tab.

### Hear Yourself (Voice History)

`src/features/voice-history/VoiceHistoryPage.tsx`. A take in webm, mp4 or m4a
is decoded and played as an AudioBuffer
(`decoded-voice-playback.ts:63-79`, `:119`). Any other container, or a decode
that fails, plays as an `<audio>` kept local, through
`createMediaElementSource` into the listening rack
(`VoiceHistoryPage.tsx:1162`, `:656-686`, `:1209`). A take recorded on iOS is
mp4 (inference: what WebKit's MediaRecorder writes), so it decodes. On
dispose the element is paused and dropped, not emptied (`:716-726`).

The page's guided check and free recorder replay a dry take decoded first
(`src/lib/use-dry-voice-capture.ts:349`) and fall back to a plain
`new Audio(url)`, neither kept local nor routed (`:711-716`), paused and
dropped afterwards (`:329-330`). The Legend room shares the challenge take and
has no replay on the phone
(`apps/mercurypitch/src/shell/legend/legend-take.ts:110-114`).

### Lab: the offline pitch canvas

`src/components/OfflinePitchCanvas.tsx`, only in the hidden Lab
(`src/features/lab/LabSurface.tsx:28-31`, `:319`). An `<audio>` kept local
(`:192`), routed through `createMediaElementSource` into a context of its own
on its first play (`:143-166`), emptied on cleanup (`:202-214`).

### Guitar Night and Glass (web only)

For the record, since neither is in the app:

- Guitar Night's song (`src/features/guitar/backing/guitar-backing-transport.ts`,
  on a context of its own, `:311-313`) is decoded into AudioBuffers when its
  estimated PCM fits the decoded budget and the speed is 1x (`:849-864`,
  `:933-937`, `:971`). Otherwise, and the moment the speed leaves 1x, it
  streams: one `<audio>` a stem, kept local, through
  `createMediaElementSource` (`guitar-backing-stream.ts:487-499`, `:572`;
  transport `:1291-1320`). Paused stems keep their `src` until the next load
  or dispose (`guitar-backing-stream.ts:405-407`, `:458-472`). A take played
  back goes through the preview player.
- Glass decodes the take into an AudioBuffer source and plays a `<audio>`
  through `createMediaElementSource` only if that throws
  (`src/features/glass/GlassApp.tsx:1017-1046`).

## Elements that play and then stay around

By the WebKit reading above (from source, **unverified on a device**), each of
these could keep AirPlay silent after it stops, until it is emptied or muted.
Check 7 says whether that matters at all.

| Element                                | Where                                                   | After it stops                                   | Emptied                                      |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| First Note's band and voice            | `song-player.ts:166-171`                                | Paused, `src` kept, unmuted, between every round | On dispose, `:222-231`                       |
| Preview player (studio stems, Zen cue) | `preview-player.ts:459-488`                             | Paused (stop also rewinds), `src` kept           | On dispose only, `:552-566`                  |
| Jam instrumental                       | `JamSongStage.tsx:640`; `jam-song-transport.ts:324-336` | Paused, `src` kept for the song's life           | Never by the app; Solid removes it           |
| Jam peers                              | `jam-store.ts:1927-1945`                                | Never stop while the peer is there               | When the peer or the room goes, `:1947-1954` |
| Voice History's fallback element       | `VoiceHistoryPage.tsx:716-726`                          | Paused and dropped                               | Never (its URL is revoked)                   |
| Dry-take fallback element              | `use-dry-voice-capture.ts:329-330`                      | Paused and dropped                               | Never                                        |
| Guitar Night's streamed stems (web)    | `guitar-backing-stream.ts:405-407`                      | Paused, `src` kept                               | Next load or dispose, `:458-472`             |
| Glass's fallback element (web)         | `GlassApp.tsx:253-254`                                  | Paused and dropped                               | Never (its URL is revoked)                   |

Not on the list, and why:

- The lock screen's carrier and the unlock clip: muted and kept from playing
  on AirPlay alone (`carrier-aside.ts:66-70`; `audio-unlock.ts:119-127`,
  `:209-213`).
- The alley's door clips: muted videos
  (`apps/mercurypitch/src/alley/AlleyDoor.tsx:118-125`, `RoomsAlley.tsx:266-267`,
  `alley-entry.ts:223`), emptied as the door closes (`RoomsAlley.tsx:223-226`,
  `alley-entry.ts:584-586`). The room ambients are a looping AudioBuffer
  (`alley-audio.ts:11-15`). Muted is not audible in the reading.
- Guitar Night's reel artwork: a muted video
  (`src/features/guitar-night/GuitarRecorderArtwork.tsx:16`, `:35`).
- Zen's preloader: loaded, never played.
- `src/lib/audio-duration.ts`: reads metadata, never plays.
- The AirPlay check's own elements: emptied after every check.

## Can anything play an element while Karaoke is open?

**In the app, only the carrier and the unlock clip, both held quiet on
AirPlay alone; beyond them, a Jam room with a peer that was joined through a
link and never left, or a stem previewed in Karaoke Studio, and nothing
else.**

- Jam peers: each is a playing `<audio>` on `<body>` whatever the tab
  (`jam-store.ts:1927-1945`), until the Leave button. The shell has no way
  into Jam, so only a Jam link could start one. The Jam song room ("Karaoke
  in Jam") is a different stage, whose instrumental is an element
  (`JamSongStage.tsx:640`); it is not the Karaoke room.
- Previews: Karaoke Studio is pushed over the room; its stem previews are
  preview-player elements, if the result list shows in the app (unverified).
- Door clips: muted videos. Notifications: the notification store plays no
  sound (`src/stores/notifications-store.ts` has no element and no Web Audio).
  Nothing in the cone uses `speechSynthesis`.

## The options

**(a) Decode to an AudioBuffer.** Web Audio only and sample-locked. Memory is
duration x rate x channels x 4 bytes: about 92 MB for a 4-minute stereo stem
at 48 kHz. iOS killed the app at about 180 MB resident in Karaoke
(`streaming-stem-voice.ts:5-8`), which is why the phone streams. Fine for a
take or a short clip, risky for a whole song of two stems. Engineering cost
is small where a decoded path exists already (`src/lib/audio-buffer-playback.ts`,
Voice History, Glass).

**(b) Stream through AudioDecoder, as Karaoke does.** `stem-stream-source.ts`
demuxes m4a and mp3 and decodes through WebCodecs, and
`streaming-stem-voice.ts` schedules windows of a few seconds on one clock.
Safari has AudioDecoder only from 26.0: on iOS 16 to 18 `canStreamStems()`
answers no (`stem-stream-source.ts:45-60`), and a room needs (a) or (d) there.
WAV stems can stream without it (`src/features/play-along/windowed-stem-voice.ts`).
Engineering cost is medium to large per room: the room's transport (seek,
pause, position) moves from the element's clock to the context's.

**(c) `createMediaElementSource`.** What every room in this plan does already.
Whether WebKit then still counts the element as playing, and keeps AirPlay
silent, is untested: check 6. No cost if 6 plays.

**(d) On AirPlay alone, say in the room that Screen Mirroring carries its
sound,** the way Karaoke's hint says where the song and lyrics go
(`src/features/karaoke-room/KaraokeAirPlayHint.tsx`). Small cost (a line under
the room header, its words, a test), but the room stays silent on AirPlay
alone. Draft words for maff to change: "Over AirPlay this room plays nothing.
Screen Mirroring carries its sound: open Control Center, tap Screen Mirroring,
then choose your TV."

**Whatever the option, the switch is only as good as `airPlayAlone()`.** In a
store build only the shared clock feeds the rate guess
(`native-device.ts:73-79`; `apps/mercurypitch/src/shell/audio-census.ts:157`
runs in test builds only), and a context keeps its rate for life
(`airplay-suspicion.ts:29-33`). A clock made before AirPlay was chosen says
nothing of it, and only the route can (inference: the iPhone 13 Pro's route
never said airplay on 3 Nov, `airplay-suspicion.ts:5-10`). A room that plays
on a context of its own can tell the guess about it with
`notePageAudioContext()` (`airplay-suspicion.ts:141-148`), one line.

## Per room: recommendation and order

The order is how much it matters: how likely someone is to put the room on a
TV, and how sure it is to be silent there.

**Start with what needs no build**, on mp-v0.8.56 (build 1716):

- Test 12B's First Note rounds play two elements kept local, routed through
  Web Audio, with the mic open: check 6 in a real room.
- Test 11B, AirPlay chosen mid-song in Karaoke, asks check 8 of the carrier:
  it played audibly on the phone, then stands aside paused and muted. If the
  TV takes the song, muting is enough.
- 4, then 3 straight after, needs no new button.

Build checks 6 to 8 only for what those leave open. If routed elements play
on the TV, every room below that routes its elements already plays on
AirPlay alone, and the work shrinks to what 7 and 8 say about stopped
elements.

| Order | Room                         | If check 6 plays                             | If check 6 plays nothing                                              | Rough cost                            |
| ----- | ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| 1     | First Note                   | Nothing, or empty/mute between rounds (7, 8) | (b) over Karaoke's streaming voice; (d) where AudioDecoder is missing | (b) about 2 days; (d) half a day      |
| 2     | Karaoke Studio stem previews | Nothing                                      | (d), or nothing until the list is seen in the app                     | Half a day                            |
| 3     | Zen example cue              | Nothing                                      | (a): decode the cue                                                   | Half a day                            |
| 4     | Jam song room                | (d) for peers, if 9 says so                  | (d)                                                                   | Half a day, only if Jam joins the app |
| 5     | Hear Yourself                | Nothing                                      | Nothing: iOS takes decode; empty the fallback on stop if 7 asks       | Minutes                               |
| 6     | Lab                          | Nothing                                      | Nothing                                                               | None                                  |
| n/a   | Guitar Night, Glass          | Not in the app                               | Not in the app                                                        | None for this plan                    |

**1. First Note.** The one room in the app whose song is all elements, and
(judgement) a song game is the next room after Karaoke that people would put
on a TV.
If check 6 fails, the recommendation is (b): a second `SongPlayer` (the
interface at `song-player.ts:48-55`) that opens each stem with
`openStemStream` and plays only from the round's `from` to its `to`, on the
mic's context, with its position from the context's clock instead of the
band element's. First Note already walks stems this way on the phone to read
a song (`src/features/first-note/own-song-read.ts:17-35`). Not (a): two whole
stems decoded is the 180 MB that killed Karaoke. Where `canStreamStems()`
answers no, (d). About two days with tests for (b), half a day for (d) alone.

**2. Karaoke Studio's stem previews.** Few would preview a stem on a TV. If
check 6 fails, (d) in the studio, or nothing until someone sees the result
list in the app. (a) is wrong here: a preview is a whole stem.

**3. Zen's example cue.** A spoken cue of a few seconds. If check 6 fails,
(a): decode the cue and play it through `audio-buffer-playback.ts` while
`airPlayAlone()` holds. Not a preview-player-wide decoded mode: that would
decode the studio's whole stems too.

**4. Jam.** Not reachable from the shell. If it joins the app: (d), because
peers must stay elements for the echo canceller (`jam-store.ts:1913-1921`),
and a decoded instrumental beside the decoded guide is two whole stems.

**5. Hear Yourself, 6. the Lab.** Nothing: iOS takes decode, and the Lab is a
developer surface. If check 7 says stopped elements count, empty Voice
History's fallback element on stop (`VoiceHistoryPage.tsx:716-726`).

**Guitar Night and Glass** are standalone web pages and not in the app. If
Guitar Night ever ships inside it: keep its buffered mode on AirPlay alone
and do not fall back to streaming, (d) for a song that does not fit or a
speed off 1x, decode takes with (a), and tell the guess about its own
context.

## Checks before any room work

New buttons for the AirPlay sound check, described here and not built. Each
beeps its own number, as 1 to 5 do, writes its `[airplay check]` line and is
torn down whole afterwards. Where an element only has to have played, it
plays silence, so the count is the Web Audio's alone.

**6: an element through Web Audio.** A `<audio>` of the beeps WAV, kept
local, routed through `createMediaElementSource` into a fresh AudioContext
resumed in the tap, played in the tap. This is how First Note, the preview
player and Jam's instrumental play.

- The TV plays 6: (c) works. Every room that routes its elements already
  plays on AirPlay alone, and only 7 and 8 are left to answer.
- Nothing anywhere: a routed element still counts as an element. (c) is out,
  and the rooms take (a), (b) or (d) as recommended above.
- The phone plays it and the TV does not: the routed element stays local
  under an AirPlay route. The same plan as nothing.
- If 6 plays nothing, the same with the mic open (as First Note plays) says
  whether First Note differs; button 5 suggests the mic does no harm.

**7: played, then paused and kept.** A kept-local element plays a second of
silence, unmuted, and is paused with its `src` kept, neither muted nor
emptied. Then a fresh context plays the beeps.

- The TV plays 7: a stopped element does not hold AirPlay, and the table of
  elements that stay around is harmless.
- Nothing: every stopped element must be muted or emptied on AirPlay alone.
  8 says which.

**8: played, paused, then muted.** As 7, with the element muted before the
beeps. Test 11B already asks this of the carrier: if the TV takes a song
moved to AirPlay mid-song, the answer is the first one below.

- The TV plays 8: muting is enough, as the carrier and the unlock clip do
  it. One line in each stop path while `airPlayAlone()` holds.
- Nothing: only emptying works (`removeAttribute('src')`, then `load()`).
  The carrier's aside mutes and pauses but does not empty, so a carrier that
  played before AirPlay was chosen (Test 11B) may then keep the room silent.

**9 (only if Jam joins the app): a MediaStream element.** An `<audio>` whose
`srcObject` is a `MediaStreamAudioDestinationNode`'s stream from a second
context, playing silence, beside a fresh context's beeps.

- The TV plays 9: a peer's element does not silence the room.
- Nothing: a Jam room with a peer is silent on AirPlay alone whatever its
  backing does, and Jam takes (d).

**No build needed: 4, then 3.** Press 4, then 3 straight after, three times.
If 3 plays, emptying alone frees the TV and the mic had nothing to do with
it. If 3 stays silent while 5 played, opening the mic is what freed the TV,
and "5 after 4" said nothing about emptying.

## Test 12: rooms with a media element on AirPlay alone (draft for tv-device-tests.md)

Tests 9 and 11 found Web Audio alone on the TV, and nothing at all while an
element plays. Karaoke now plays Web Audio only there. First Note still plays
its song as elements, routed through Web Audio, and so do the preview
player's cues. This test says whether those are silent today, and the new
buttons say which fix each needs (this plan,
[airplay-element-rooms.md](airplay-element-rooms.md)). 12A needs the first
build with buttons 6 to 8; 12B runs on mp-v0.8.56 (build 1716) or later.
Run 12B and step 4 of 12A first: they need no new build, and may leave
nothing for buttons 6 to 8 to answer.

Before each part: Developer, Debug console, "Keep routine logs" on, and Clear
log under Developer, Audio. Ring switch on ring, phone volume up. Choose the
TV under AirPlay in Control Center (not Screen Mirroring).

**12A: the new buttons.** Settings, Developer, "AirPlay sound check":

| Button  | What plays                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------- |
| 6 beeps | An element kept local, played through Web Audio (`createMediaElementSource`), as First Note plays |
| 7 beeps | Web Audio after an element that played, then was paused and kept, unmuted                         |
| 8 beeps | The same, with the element muted first                                                            |

1. Tap 3 and wait for it to end (about five seconds), so AirPlay has
   connected.
2. Tap 6, 7 and 8, each once the one before has ended. Then again in the
   order 8, 7, 6.
3. For each: did the TV play it, the phone, or nothing? How many beeps, and
   how late?
4. Press 4 and then 3 straight after, three times. Say which presses of 3
   the TV played.
5. Copy the `[airplay check] ...` lines into the notes, one a tap.
6. Once on the phone's own speaker, as the control: every button should beep
   on the phone.

| Route          | 6 (element through Web Audio) | 7 (after a paused element) | 8 (after a muted one) | 3 after 4, of three |
| -------------- | ----------------------------- | -------------------------- | --------------------- | ------------------- |
| AirPlay, LG C2 |                               |                            |                       |                     |
| Phone speaker  |                               |                            |                       |                     |

**12B: the rooms.** AirPlay chosen before each room opens. Run each case
with the ring switch on ring; repeat on silent any case the TV played.

1. **Karaoke, the control.** Play a song for 20 s. The TV should play it,
   about 2 s late, as in Test 11A.
2. **First Note, a round.** Open First Note and play one round to its end:
   the lead-in (the band alone), then sing the line (the band and the voice
   come back in). Does the TV play the lead-in? The line? Does the phone?
3. **First Note, the next round.** Straight after, a second round. Its
   lead-in follows a pause of the same two elements, which 7 is about.
4. **A Sing exercise with an example**, if your build shows "Hear an
   example" on one: play it.
5. **Karaoke Studio, a stem preview**, if a finished song in the studio
   shows its stems with a play button: play one.

Copy the console after each case: the `[audio route]` line says whether the
app thinks the sound is on AirPlay.

| Case                  | Ring switch | Sound on the TV? How late? | Phone silent? | `[audio route]` says AirPlay? | Notes |
| --------------------- | ----------- | -------------------------- | ------------- | ----------------------------- | ----- |
| 1 Karaoke (control)   | ring        |                            |               |                               |       |
| 2 First Note, round 1 | ring        |                            |               |                               |       |
| 3 First Note, round 2 | ring        |                            |               |                               |       |
| 4 Sing example        | ring        |                            |               |                               |       |
| 5 Studio stem preview | ring        |                            |               |                               |       |

## Found on the way, outside this plan

- Guitar Night's decoded budget on a phone is 384 MiB
  (`src/lib/audio-memory-budget.ts:96-102`), twice the 180 MB that killed
  Karaoke. The tier comes from `(max-width: 768px)` when the browser gives no
  mobile hint (`:65-91`), and WebKit gives none, so a phone on its side
  (844 px wide on an iPhone 13) gets the desktop tier, 4 GiB.
  `setNativeDeviceMemoryGb` (`:57`) has no caller. Web only today, since
  Guitar Night is not in the app; not tried on a device.
- Karaoke streams its stems only where AudioDecoder exists (Safari 26 and
  later). On iOS 16 to 18 a stem is decoded whole or refused
  (`stem-stream-source.ts:45-60`, `src/features/stem-mixer/stem-load-path.ts:5-8`).
  Still Web Audio, so still fine on AirPlay.
