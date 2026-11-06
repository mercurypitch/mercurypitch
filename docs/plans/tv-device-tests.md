# TV device checks: what to try, what to write down

For phase P0 and the proofs of concept of
[tv-cast-and-google-tv.md](tv-cast-and-google-tv.md); requirement ids are in
[../specs/tv-karaoke.ears.md](../specs/tv-karaoke.ears.md). Tests 1 to 3 need
no new build: use the current TestFlight build on the iPhone and the current
app on an Android phone. Tests 4 to 12 need the build named in each. Fill in
the tables; that is all that needs to come back.

**Run Tests 4B, 5, 6 and 8 on TestFlight mp-v0.8.52 (3 Nov 2026) or later.**
It carries the wizard that hears a TV (PR #1189, in TestFlight since
mp-v0.8.42) and PR #1321, which keeps the app's silent media off AirPlay,
says each audio route and the clock's state in the console, and stops a
Karaoke song whose clock stands still, saying why. **Test 6 needs the first
build with the TV chooser** (branch `feat/tv-choice`): the phone asks what a
TV shows as it connects. Test 7 is Beside Cue's, which `mp-v*` tags do not
build. **Run Test 9, then Test 8 again, on the
first build with the AirPlay guide** (branch `feat/airplay-guide`): the
AirPlay sound check, the AirPlay hint and the report the room writes.
**Run Test 11 on the first build with branch `feat/airplay-room-sound`**:
the app's session allows AirPlay, and on AirPlay alone the lock screen's
carrier and the unlock clip stand aside, so the room's Web Audio plays
alone, as Test 9's button 3 did. **Test 12A's buttons need the first build
tagged after branch `feat/airplay-element-rooms` merges**; 12B, and 12A's
"4, then 3", run on mp-v0.8.56 (build 1716) or later.

## Before you start

- Phone and TV on the same Wi-Fi, not a guest network (guest networks often
  block AirPlay and Cast discovery).
- **LG C2:** Settings, Support, Software Update shows the webOS version.
  Write it down: 22, 23 or 24. Version 24 adds Chromecast. AirPlay is the
  Apple tile in the inputs, or Home, AirPlay.
- **Samsung:** Settings, General, Apple AirPlay Settings: turn AirPlay on.
  Write down the model year if you can see it (Settings, Support, About
  This TV).
- Which phones you used: iPhone model and iOS version; the Android phone's
  brand (Pixel or other stock Android casts with "Screen Cast"; Samsung uses
  "Smart View").

## Test 1: iPhone, AirPlay Screen Mirroring (LG and Samsung)

1. Control Center, Screen Mirroring, pick the TV. Play any video in Safari.
   Does the sound come from the TV? This is the baseline.
2. Open Mercury Pitch while mirroring. What does the TV show:
   - the phone's screen, following what you do, or
   - a separate Mercury Pitch start screen that does not follow the phone?
     The second is the bug the first proof of concept fixes. Either answer is
     useful.
3. Open a karaoke song and play it. Does the sound come from the TV or from
   the phone?
4. Settings, Developer, audio report: which output does it list? Look for
   AirPlay.
5. Settings, Microphone, Latency: run it on the phone's speaker first and
   write down the result and its spread. Then run it while mirroring and
   write that down too. In mp-v0.8.40 and earlier the run while mirroring
   replaces the speaker's number (one number per microphone); PR #1175 keeps
   one per route (Test 5).
6. Sing a song you know well while mirroring. Does the score feel right, or
   does it mark you late?
7. Settings, Developer, Audio: copy the "Output" line (0.8.40 shows "Other"
   and the TV's name for AirPlay) and the "Phone audio" line's `out ... ms`
   (what iOS reports as the output latency), once on the speaker and once
   while mirroring.

## Test 2: Android phone, screen casting

- **Pixel or stock Android:** Quick Settings, Screen Cast (or Google Home,
  your TV, Cast my screen). Try the Philips, and the LG if it is on webOS 24.
- **Samsung phone:** Quick Settings, Smart View. Try the Samsung TV and the LG.

For each, repeat steps 3, 5 and 6 above. There is no second-copy bug on
Android.

## Test 3 (optional): the TV's own browser

On the LG and the Samsung, open mercurypitch.com in the TV's browser.

- Settings, Display & Controls, Graphics Quality: what does it say was
  detected?
- Can the remote reach every button you need?
- Does a karaoke song play without stutter?

## Test 4: TestFlight mp-v0.8.40 (PR #1157: mirroring fix, lyrics on the TV)

PR #1157 is merged, and the owner tagged main mp-v0.8.40 on 2026-10-22. A
tag push uploads a dev build to TestFlight, and dev builds carry the
Developer screen. A store build (a production dispatch on a tag) has
neither the Developer screen nor the switch, so its TV always mirrors.

**A. Mirroring (the fix).** **Passed on the LG C2, 2026-10-22:** before the
fix the TV showed a second copy of the app on the Rooms start screen while
the sound played on the TV; with 0.8.40 the TV mirrors the phone in portrait
and landscape, the pitch lane draws, the frame rate holds and the
picture-in-picture lyrics work. Still to run on the Samsung.

1. Start Screen Mirroring, then open the app. The TV should show the phone
   and follow it, with no separate start screen.
2. Open the app first, then start mirroring. You should get the same result.
3. Repeat steps 3 to 6 of Test 1 (sound, audio report, latency, score).

**B. Lyrics on the TV (the switch).** Not reported yet; run it on
mp-v0.8.52 or later. On a build with the TV chooser (Test 6) the phone asks
first as the TV connects: pick Lyrics there, and keep the switch for trying
a view by hand.

1. Settings, Developer, TV: turn on "Lyrics on a connected TV". With
   mirroring on, "TV" should read connected, "It shows" should read the
   lyrics, and the TV should show "Mercury Pitch".
2. Play a karaoke song with "Keep playing in the background" on (the
   default). The TV should show the title, the line being sung with its
   words filling, and the next line.
3. Do the words fill in time with the sound you hear? Where does the sound
   play, TV or phone? If the words run early or late, roughly by how much?
4. Pause, drag the scrubber, press Next: does the TV follow each within a
   moment?
5. From the sofa: is the text easy to read? Is anything cut off at the
   edges of the TV?
6. Turn "Keep playing in the background" off and play. The words are
   expected to stand still in this proof of concept; note what you see.
7. Turn the switch off. The TV should go back to mirroring the phone at once.
8. With the switch on, stop mirroring and start it again: the lyrics should
   come back. Close and reopen the app while mirroring: the lyrics should
   come back too, because the switch is remembered.
9. Copy the console's `[lyrics window] TV: ...` lines into the notes. They
   include the TV's size as iOS reports it.

| TV      | Mirrors, no second copy? | Lyrics shown? | In time with the sound? (early or late, by how much) | Sound from | Pause, seek, Next follow? | Readable, nothing cut off? | Switch off mirrors again? | Back after reconnecting? | TV size from the log |
| ------- | ------------------------ | ------------- | ---------------------------------------------------- | ---------- | ------------------------- | -------------------------- | ------------------------- | ------------------------ | -------------------- |
| LG C2   | Yes, both orientations   |               |                                                      | TV         |                           |                            |                           |                          |                      |
| Samsung |                          |               |                                                      |            |                           |                            |                           |                          |                      |

## Test 5: per-route latency (PR #1175, TestFlight mp-v0.8.52 or later)

1. On the phone's speaker: Settings, Microphone. Note the Latency and the
   day under it.
2. Start mirroring. Settings, Developer, Audio: "Output" should read AirPlay.
   Back in Settings, Microphone, the row should show the speaker's number
   with "Not yet measured on AirPlay" under it, and the button should read
   "Measure latency for AirPlay".
3. Measure. The wizard should say "not yet measured on AirPlay" before the
   run, and offer no Clear offset. Write down the result and its spread:
   that is the TV's number.
4. Stop mirroring: the speaker's number and day should be back. Start again:
   the TV's number should be back.
5. Sing the same song on the speaker and while mirroring: does the score
   feel the same?
6. While mirroring, Clear offset in the wizard: only the TV's number should
   go; the speaker's stays.

**Run on the LG C2, 2026-10-23** (mp-v0.8.41, build 1321, iPhone 13 Pro on
iOS 27): the phone's speaker measured 113 ms (91 ms before). Over AirPlay
the wizard found no number: the first click came out of the TV loud and the
rest quieter, even at TV volume 100, and too few clicks were heard. The
likely cause is the wizard's detection rather than the route: it holds every
click to a quarter of the loudest, credits no reply later than 375 ms and
keeps no number over 500 ms; the fix (PR #1189, `REQ-TV-096`) is in
TestFlight since mp-v0.8.42. On an older build a run may succeed with
the TV's automatic volume and sound processing off (on the LG, for example
Auto Volume and AI Sound Pro; names vary by model) and the phone held near
the TV's speaker. Without a number the TV borrows the speaker's, which is
probably 100 to 300 ms short of a mirrored round trip (the plan's section
2.3 figures), so a song may score late.

**Again with PR #1189**, on mp-v0.8.52 or later:

1. Mirror to the LG C2. Settings, Microphone, Measure latency for AirPlay.
   Before the run the wizard should say to hold the phone near the TV's
   speaker and to turn off the TV's automatic volume.
2. Start. The run takes about 11 seconds, with clicks at uneven gaps. Write
   down the number and the spread.
3. If the TV has Auto Volume, run once with it on and once with it off: does
   the number change, or only the spread?
4. If a run fails, copy its sentence into the notes. A delay over a second
   is named rather than kept.
5. Sing a song you know while mirroring: does the score feel right now?

| Route                | Latency, result and spread                                                      | Score feels right? | Notes                                        |
| -------------------- | ------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- |
| Phone speaker        | 113 ms (91 ms before)                                                           |                    |                                              |
| AirPlay to the LG C2 | No number: first click loud, the rest quieter even at volume 100; too few heard |                    | The wizard's detection; plan 1.6, REQ-TV-096 |
| LG C2, after #1189   |                                                                                 |                    |                                              |
| AirPlay to Samsung   |                                                                                 |                    |                                              |

## Test 6: the TV chooser and the stage on the TV (PR #1179; the chooser on `feat/tv-choice`)

The phone stays the room and the microphone, held upright; the TV draws the
stage in its own landscape (POC-3). The stage first shipped in mp-v0.8.41
(build 1321), behind the Developer switch. Run this on the first build with
the TV chooser (`REQ-TV-106`), which asks what a TV shows as it connects, in
every build, and carries #1175 too, so step 6 can use the TV's own latency
number from Test 5, and #1321, so a song that stops on AirPlay says why
(Test 8). The chooser's `[tv]` lines show in the console by default.

1. With the app open, start Screen Mirroring. Within about two seconds the
   phone should ask "Show on the TV": Stage, marked Recommended, and Lyrics,
   a ticked box "Remember for" and the TV's name ("this TV" where the phone
   hears no name), and "Keep mirroring my phone". The TV should mirror the
   phone, question and all. Write down how the box names the TV, then leave
   it ticked and tap Stage. The TV should show "Mercury Pitch" and "Choose a
   song on your phone", and Settings, Developer, TV, "It shows" should read
   the stage.
2. Open Karaoke and play a song, phone upright. The TV should show the
   title, the lane with the song's notes running right to left past the
   playhead, and the lyrics, the line being sung filling word by word with
   the next line under it. Turn the mic on and sing: your line should trail
   behind the playhead, and a score should appear top right after a few
   seconds. The TV's notes should be the ones the phone's lane shows with
   the mic on; for a song with no notes yet, they should appear on the TV
   as the phone finishes reading them.
3. Where does the sound play, TV or phone? Do the words and notes land on
   the beat you hear? If not, Settings, Developer, TV, "Stage picture":
   press Earlier (picture behind the sound) or Later (picture ahead) until
   they do, and write down where you stopped.
4. Pause, drag the scrubber, press Next, change the key: does the TV follow
   each within a moment? After a key change the notes should move.
5. From the sofa: is the text easy to read? Is anything cut off at the edges?
   Does the lane move smoothly? Is the phone warm after a whole song?
6. With the TV measured (Test 5): does the score feel the same as on the
   phone's speaker?
7. Stop mirroring and start again: the stage should come back with no
   question. Close and reopen the app while mirroring: the stage should come
   back too, with no question.
8. To see the question again: Settings, Karaoke, TV should list the TV with
   Stage checked. Tap Lyrics: the TV should switch to the lyrics at once.
   Tap Forget, then stop mirroring and start again: the question should come
   back. This time untick the box and tap Lyrics: the TV shows the lyrics,
   and the next time it connects the question comes back. Tap Not now: the
   TV should mirror the phone, and the question comes back the next time
   too. With a second TV (the Samsung), the question should come with its
   own name, whatever the first TV keeps.
9. Settings, Developer, TV: turning a switch should change what the TV shows
   now, and "What each TV shows when it connects" should count the TVs kept
   and not change with the switches.
10. Copy the console's `[tv] ...` lines (each says how long the TV's name
    took, or that none came) and `[lyrics window] TV stage: ...` lines into
    the notes.

| TV      | Asked? How the box named it | Stage shown? | Sound from | In step? (Stage picture setting) | Pause, seek, Next, key follow? | Readable, nothing cut off? | Smooth? Phone warm? | Back after reconnecting, unasked? | Asked again after Forget, untick, Not now? |
| ------- | --------------------------- | ------------ | ---------- | -------------------------------- | ------------------------------ | -------------------------- | ------------------- | --------------------------------- | ------------------------------------------ |
| LG C2   |                             |              |            |                                  |                                |                            |                     |                                   |                                            |
| Samsung |                             |              |            |                                  |                                |                            |                     |                                   |                                            |

## Test 7: Beside Cue on a TV (PR #1182, TestFlight build 1198 or later)

Beside Cue had Mercury Pitch's second-copy bug, and #1182 ports the fix.
Until 30 Oct 2026 main uploaded a Beside Cue TestFlight build on every push
that touched it (build 1202 on 2026-10-23). Since then only a `bc-v*` tag
uploads one, and none has been pushed yet, so use the newest build main
uploaded before that: every build from 1198 on carries the fix.

1. Start Screen Mirroring, then open Beside Cue. The TV should show the phone
   and follow it, with no separate copy of the app on its first screen.
2. Open Beside Cue first, then start mirroring. You should get the same
   result.
3. Play a game with sound: does the sound come from the TV?

| TV      | Mirrors, no second copy? | Same when mirroring starts second? | Sound from |
| ------- | ------------------------ | ---------------------------------- | ---------- |
| LG C2   |                          |                                    |            |
| Samsung |                          |                                    |            |

## Test 8: a Karaoke song on AirPlay, and its lines (PR #1321, TestFlight mp-v0.8.52)

The owner's case of 1 and 2 Nov: AirPlay offered as the app opened, taken,
and the Karaoke song stood still with no error. #1321 keeps the app's silent
media off AirPlay and says in the console where the sound goes and what the
song's clock does. How to set the console up, what each line means and how
to read a run are in
[DEVICE-DEBUGGING.md](../agent/DEVICE-DEBUGGING.md), "A song that sticks with
its sound on a TV (AirPlay)"; follow its setup, then:

1. Open the app. Does AirPlay still pop up as it opens?
2. Take AirPlay to the TV, as the sound alone and then as Screen Mirroring,
   and play a song in the Karaoke room each way. Does the song play, and is
   its sound on the TV?
3. If it stops: what does the room's notice say?
4. Choose the phone in Control Center: does the notice turn into Play
   again, and does that play on the phone?
5. Copy the console into the notes: the `[audio route]`, `[audio clock]` and
   `karaoke clock-...` lines. After a stop, also Developer, Audio, Copy
   report.

| TV      | AirPlay offered on opening? | Song plays, sound alone?                                              | Song plays, mirroring?               | Stopped? The notice's words | Phone chosen: Play again plays? |
| ------- | --------------------------- | --------------------------------------------------------------------- | ------------------------------------ | --------------------------- | ------------------------------- |
| LG C2   | Yes: iOS's own suggestion   | Clock runs, no sound from the phone or the TV; the TV shows a spinner | Yes, "works great", lyrics and stage | No stall, so no notice      | Not run                         |
| Samsung |                             |                                                                       |                                      |                             |                                 |

**Run on the LG C2, 3 Nov 2026** (mp-v0.8.52, iPhone 13 Pro):

1. AirPlay still pops up as the app opens. The app goes inactive 1.7 s
   after launch, before anything plays, so it is iOS's AirPlay suggestion,
   not the app's media.
2. Sound alone: the TV shows the song's title, "Unknown artist" and a
   timeline. On Play the song runs on the phone, but no sound comes from
   the phone or the TV, and the TV shows a spinner; stopping the song
   brings the timeline back. The song also paused 1 to 2 s after Play
   several times with no reason logged; some of those were the owner's own
   presses. Screen Mirroring, with the TV lyrics and with the TV stage,
   "works great": the TV shows the lyrics or the stage, never a mirror of
   the phone.
3. No stall: the clock kept moving, so the watch said nothing and no
   notice came. Its AirPlay words could not have come either: every
   `[audio route]` line said the speaker.
4. Not run.
5. The audio record: every route the app's session reported was the
   speaker at 48 kHz, before and after the TV was connected, and the
   page's contexts made after connecting ran at 44.1 kHz
   (`census context-made n=2 ... rate=44100`). The app's session hears
   WebKit's playback as another app's (`otherAudioPlaying=true`): WebKit
   plays from a session of its own, which the app's cannot see. What
   follows is in [tv-cast-and-google-tv.md](tv-cast-and-google-tv.md), P1.

**Run again on the LG OLED48C2, 3 Nov 2026** (mp-v0.8.52, iPhone 11 on
iOS 18.7). Here the app's own session does see AirPlay:
`output ... route=airplay outputs=AirPlay ... outputLatency=0.07 sampleRate=44100 category=AVAudioSessionCategoryPlayAndRecord options=mixWithOthers,defaultToSpeaker,allowBluetoothA2DP otherAudioPlaying=true silenceHint=true pageSession=auto`,
and the page's contexts run at 44.1 kHz too
(`census context-made n=2 state=suspended rate=44100 latency=interactive`).
The room plays as on the speaker: the song streams (`song-path path=stream
stems=2`), its clock runs (one song from 0 to its end at 330 s), no watch
line, and every Play says `[now playing] play pressed: the carrier takes
the sound first`. The TV shows the Now Playing card ("09 Shadow Of The
Gods", "Unknown artist", its timeline running, no spinner), but no sound
comes from the TV or the phone, at system volumes from 0.08 to 0.23. After
the mic opened and closed (Practice), the session's rate went from 44.1 to
48 kHz, still on AirPlay. So the room says AirPlay where the route says it,
or where the page's rate says it, whether or not the clock moves.

**Again with the AirPlay guide** (branch `feat/airplay-guide`, on the next
build). Run Test 9 first. Then keep routine logs on as above, Clear log,
take AirPlay as iOS offers it, and:

1. Open Karaoke and press Play. The room should say, under its header:
   "AirPlay cannot carry the room's sound to a TV." and "Screen Mirroring
   can: open Control Center, tap Screen Mirroring, then choose your TV."
   It shows once a launch, and Close takes it away. The console should
   have, by default,
   `[audio] ... karaoke play by=button clockWas=... position=0`; on the
   iPhone 13 Pro, whose route says the speaker, also
   `[audio route] the page plays at 44100 Hz, the phone's session at 48000 Hz on Speaker: the sound is likely on AirPlay`.
   Right after, the whole Developer audio report follows in parts,
   `[audio report 1/n] a song started on AirPlay` and on: copy the console
   from the room, with no trip to Settings.
2. Pause and play from the room, then from the lock screen and from the
   TV's remote if it has play and pause. Each should write a line naming
   who: `karaoke pause by=button position=...`,
   `karaoke pause by=media-session(pause) position=...`. A song that pauses
   by itself should name its cause the same way; copy any
   `by=unknown`.
3. Start Screen Mirroring. The hint, if up, should go at once, and the
   console should say
   `[audio route] a screen is connected (Screen Mirroring or a cable): AirPlay no longer suspected`.
   With mirroring on, a song started should show no hint.
4. On the phone's speaker with no AirPlay, play a song: no hint, and no
   `the sound is likely on AirPlay` line. If one appears, copy the console:
   that is a false alarm to fix.

| TV      | Hint on Play, on AirPlay? | Each pause named? Any `by=unknown`? | Hint gone with mirroring? | No hint on the speaker? |
| ------- | ------------------------- | ----------------------------------- | ------------------------- | ----------------------- |
| LG C2   |                           |                                     |                           |                         |
| Samsung |                           |                                     |                           |                         |

## Test 9: the AirPlay sound check (branch `feat/airplay-guide`, next build)

The decisive test: which way of making sound a TV over AirPlay plays at
all. It needs no Karaoke. Settings, Developer, "AirPlay sound check" has
five buttons. Each plays a short tone a number of times, its own number,
so you can tell which one you heard:

| Button  | What plays                                                                                |
| ------- | ----------------------------------------------------------------------------------------- |
| 1 beep  | A plain media element (`<audio>`), allowed on AirPlay                                     |
| 2 beeps | The same element kept off AirPlay, as the lock screen's carrier is                        |
| 3 beeps | Web Audio alone, on a fresh AudioContext                                                  |
| 4 beeps | Web Audio while a silent element kept local plays, as the Karaoke room plays              |
| 5 beeps | Web Audio with the microphone open, as when singing is scored (iOS asks for the mic once) |

1. Ring switch on ring, phone volume up. Choose the TV under AirPlay in
   Control Center (not Screen Mirroring).
2. Settings, Developer, "AirPlay sound check". Tap 1 and wait for it to
   end (about five seconds: the TV plays AirPlay about two seconds late);
   then 2, 3, 4 and 5 the same way.
3. For each: did the TV play it? The phone? How many beeps, and how late?
4. Copy the console's `[airplay check] ...` lines into the notes, one a
   tap: each says the route, the session's rate, the context's rate, the
   page's session type and the context's state, and whether the element
   played (`element=playing`) and the mic opened (`mic=open`).
5. Do it again with Screen Mirroring instead of AirPlay, and once on the
   phone's own speaker, as the control.

| Route                      | 1 (element)                     | 2 (kept local)                  | 3 (Web Audio)  | 4 (beside a silent element) | 5 (with the mic)                                         |
| -------------------------- | ------------------------------- | ------------------------------- | -------------- | --------------------------- | -------------------------------------------------------- |
| AirPlay, LG C2, mp-v0.8.55 | not reported                    | not reported                    | Yes, on the TV | No                          | Yes, on the TV; sometimes not                            |
| AirPlay, LG C2, mp-v0.8.56 | Nothing, on the TV or the phone | Nothing, on the TV or the phone | Yes, on the TV | Never                       | Yes, on the TV, every time; three times straight after 4 |
| Mirroring, LG C2           | not reported                    | not reported                    | not reported   | not reported                | not reported                                             |
| Phone speaker              | not reported                    | not reported                    | not reported   | not reported                | not reported                                             |

**Run on the LG C2, 6 Nov 2026 at about 17:55** (mp-v0.8.55, TestFlight
build 1714), the TV chosen under AirPlay in Control Center. Pressing 1
through 5 in turn, the owner heard button 3 (Web Audio alone, on a fresh
AudioContext) on the TV, and button 5 (Web Audio with the mic open) too,
though not every time. Once AirPlay had connected, 3 and then 5 both
played. The owner's guesses for the misses: AirPlay not yet in sync, or
something left over from the buttons before it. The second fits how WebKit
keeps a session in playback for an element that has played audibly, and
buttons 1, 2 and 4 each play an element that stays up for 3 s after its
beeps; nothing has told the two apart yet (Test 11 ends with the presses
that do). Button 4, Web Audio while a silent element kept local plays, was
not among those heard. Button 4 is how the Karaoke room plays: Web Audio
beside the lock screen's carrier. Buttons 1 and 2 were not named either
way, and the `[airplay check]` lines and the Screen Mirroring and speaker
rows were not reported. What follows is Test 11.

**Run again on 6 Nov 2026** (mp-v0.8.56, TestFlight build 1716, an iPhone 13
and the LG C2), with the presses Test 11 ends with. 4 never played. 5 played
every time, three times straight after 4 as well. 3, then 5: both played.
1 and 2 played nothing at all, on the TV or the phone. So a 4 that has been
emptied leaves nothing behind that keeps 5 off the TV, and the misses on
mp-v0.8.55 fit AirPlay not yet in sync better (inference). 5 opens the mic,
which may reset the route by itself: whether 3, without the mic, plays
straight after 4 is Test 12A's "4, then 3". The `[airplay check]` lines and
the Screen Mirroring and speaker rows were not reported.

## Test 10: the Cast receiver spike (branch `feat/cast-receiver`, once a Google TV is registered)

Before any sender of ours exists, Google's own tool can start the receiver on
a TV and talk to it. This needs two things:

- a Cast test device registered in the Cast SDK Developer Console
  ([tv-cast-and-google-tv.md](tv-cast-and-google-tv.md), P6, step 0);
- the dev site serving `/cast-receiver`, which it does once the branch is
  merged.

1. Register the Philips Google TV, or a Chromecast with Google TV, in the
   Cast SDK Developer Console by its Cast serial number. Registration can
   take about 15 minutes; restart the TV after it.
2. On a computer on the TV's Wi-Fi, open Google's Cast Command and Control
   tool in Chrome: https://casttool.appspot.com/cactool/. Enter the dev
   receiver's application ID, `01A75FA0`, press Set App ID, then press the
   Cast icon and choose the TV.
3. The TV shows "Mercury Pitch" and "Choose a song on your phone".
4. In the tool's custom message tab, with the namespace
   `urn:x-cast:com.mercurypitch.stage`, send these in turn:
   - `{"v":1,"kind":"diagnostics","on":true}`: a panel appears top left.
   - `{"v":1,"kind":"demo"}`: the demo song plays on the stage, with no
     sound: the lane, the singer's trail, the lyrics and a score.
5. After two minutes, photograph the panel. Then send
   `{"v":1,"kind":"probe"}` and copy the reply from the tool's log.
6. Stop casting in the tool: the receiver closes, and the TV goes back to
   where it was. (A phone that drops off the Wi-Fi instead leaves the idle
   screen up for five minutes; that waits for a sender of ours.)

**The spike's stop sign:** the stage cannot hold its frame rate, or runs out
of memory, on the older Chromecast with Google TV.

| Device                            | fps | p95 ms | late | heap MB, of limit | output latency | data channel |
| --------------------------------- | --- | ------ | ---- | ----------------- | -------------- | ------------ |
| Philips Google TV                 |     |        |      |                   |                |              |
| Chromecast with Google TV (older) |     |        |      |                   |                |              |
| Google TV Streamer                |     |        |      |                   |                |              |

## Test 11: the Karaoke room on AirPlay alone (branch `feat/airplay-room-sound`, next build)

Test 9 found Web Audio alone on the TV, and not Web Audio beside a silent
element. This build plays the room that way on AirPlay alone: the lock
screen's carrier stands aside (paused and muted) and the unlock clip keeps
quiet, until the sound leaves AirPlay. The app's own session now allows
AirPlay too, so its route should say airplay, on the iPhone 13 Pro as well.
How to read the console is in
[DEVICE-DEBUGGING.md](../agent/DEVICE-DEBUGGING.md), "A song that sticks
with its sound on a TV (AirPlay)".

Before each case: Developer, Debug console, "Keep routine logs" on, and
Clear log under Developer, Audio. Phone volume up. Run each case twice:
ring switch on ring, then on silent.

**11A: AirPlay chosen before the room opens.**

1. Choose the TV under AirPlay in Control Center (not Screen Mirroring).
2. Open Karaoke and play a song.
3. The TV should play the song, about 2 s after Play, and the phone stay
   quiet. The lyrics follow the page's own output clock, and no route
   offset moves them for AirPlay, so they may run ahead of the TV's sound
   by up to that delay; how far depends on whether WebKit counts AirPlay's
   delay in that clock, which nothing has measured. Say how far ahead
   they feel. Sing a line too: with the mic open, as with Test 9's button
   5, does the TV keep playing?
4. Under the room header, once a launch: "The song is playing on LG C2
   over AirPlay." (the TV by the name the phone gives it; "The song is
   playing over AirPlay." where only the page's rate says AirPlay), "The
   lyrics stay on this phone." and "Screen Mirroring puts the stage on the
   TV: open Control Center, tap Screen Mirroring, then choose your TV."
5. The lock screen should show no song from the app while the sound is on
   AirPlay, and the TV no "Unknown artist" card with a spinner. Write down
   what each shows.
6. The console should have
   `[audio route] airplay, ...`,
   `[now playing] the sound is on AirPlay: the carrier stands aside, so the room's sound plays alone`
   and
   `[audio unlock] the sound is on AirPlay: the unlock clip stays quiet, so the room's sound plays alone`,
   each once.
7. With the song playing, choose this phone in Control Center. The sound
   should come back to the phone, the console should say
   `[now playing] the sound has left AirPlay: the carrier takes its place again, and the lock screen shows the song`,
   and the lock screen should show the song again once the phone is locked.

**11B: AirPlay chosen mid-song.**

1. Play a song on the phone's speaker. Lock the phone for a moment: the
   lock screen shows the song.
2. Unlock, and while it plays, choose the TV under AirPlay in Control
   Center.
3. Does the TV play the song, and after how long? If it stays silent,
   pause and play once in the room, and say whether that brings it.
4. The lock screen and the TV should show as in 11A, step 5, and the
   console the same two `stands aside` and `stays quiet` lines.
5. Choose this phone again, as in 11A, step 7.

If a song stops by itself on AirPlay, the room should say "The sound went
to LG C2 over AirPlay and stopped." and "To hear it here, choose this phone
under AirPlay in Control Center.", with Play again. Copy the console then,
and Developer, Audio, Copy report.

Then Test 9 once more, on AirPlay, to tell apart the two guesses for
button 5's misses. Press 4 and then 5 straight after, three times; then 3,
wait 5 s, and 5, three times. Say which presses of 5 the TV played, and
where 1 and 2 play: the TV, the phone, or nowhere.

| Case | Ring switch | Sound on the TV? How late?                                                  | Phone silent? | Lyrics ahead by                            | Lock screen shows | TV shows | Hint words right? | Back on the phone: sound, lock screen |
| ---- | ----------- | --------------------------------------------------------------------------- | ------------- | ------------------------------------------ | ----------------- | -------- | ----------------- | ------------------------------------- |
| 11A  | ring        | Yes, about 2 s late; play, pause and seeks each reach the TV about 2 s late | Yes           | "Maybe a bit" off; to be checked in detail |                   |          |                   |                                       |
| 11A  | silent      |                                                                             |               |                                            |                   |          |                   |                                       |
| 11B  | ring        | Yes                                                                         |               |                                            |                   |          |                   | Sound: yes                            |
| 11B  | silent      |                                                                             |               |                                            |                   |          |                   |                                       |

**Run on 6 Nov 2026** (mp-v0.8.56, TestFlight build 1716, an iPhone 13 and
the LG C2). 11A: the song played on the TV and the phone stayed silent. Play,
pause and seeking each took about 2 s to reach the TV: "not ideal, but it
works". The lyrics felt "maybe a bit" off; the owner will check them in
detail. 11B (filed under ring; the switch was not noted): moving the song
to AirPlay while it played on the phone, and back again, both worked
("there and back no problems"). So the carrier, which had played audibly
on the phone and then stood aside paused and muted, did not keep the song
off the TV. Not reported yet: the ring switch on silent, the lock screen,
what the TV shows and the hint's words.

## Test 12: rooms with a media element on AirPlay alone (branch `feat/airplay-element-rooms`, first build tagged after it merges)

Tests 9 and 11 found Web Audio alone on the TV, and nothing at all while an
element plays. Karaoke now plays Web Audio only there. First Note still plays
its song as elements, routed through Web Audio, and so do the preview
player's cues. This test says whether those are silent today, and the new
buttons say which fix each needs
([airplay-element-rooms.md](airplay-element-rooms.md)). 12A's buttons 6 and
7 need the first build tagged after branch `feat/airplay-element-rooms`
merges; 12B, and 12A's step 4, run on mp-v0.8.56 (build 1716) or later. Run
those first: they need no new build, and may leave nothing for buttons 6
and 7 to answer.

Before each part: Developer, Debug console, "Keep routine logs" on, and Clear
log under Developer, Audio. Ring switch on ring, phone volume up. Choose the
TV under AirPlay in Control Center (not Screen Mirroring).

**12A: the new buttons.** Settings, Developer, "AirPlay sound check":

| Button  | What plays                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------- |
| 6 beeps | An element kept local, played through Web Audio (`createMediaElementSource`), as First Note plays |
| 7 beeps | Web Audio after an element that played, then was paused and kept, unmuted                         |

1. Tap 3 and wait for it to end (about five seconds), so AirPlay has
   connected.
2. Tap 6, then 7 once 6 has ended. Then again in the order 7, 6.
3. For each: did the TV play it, the phone, or nothing? How many beeps, and
   how late?
4. No new build needed: press 4 and then 3 straight after, three times. Say
   which presses of 3 the TV played.
5. Copy the `[airplay check] ...` lines into the notes, one a tap.
6. Once on the phone's own speaker, as the control: every button should beep
   on the phone.

| Route          | 6 (element through Web Audio) | 7 (after a paused element) | 3 after 4, of three |
| -------------- | ----------------------------- | -------------------------- | ------------------- |
| AirPlay, LG C2 |                               |                            |                     |
| Phone speaker  |                               |                            |                     |

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

## Aside: a TestFlight Subscribe asks for the password

In a TestFlight build Apple's purchase sheet asks for the Apple Account
password every time, because TestFlight purchases run in Apple's sandbox,
where Face ID does not authorise them. A password manager's AutoFill may not
work in that prompt (its keyboard does not come up): an iOS limit that the
App Store app shows too, not the app's bug. Type the password, or copy it
from the password manager before pressing Subscribe. An App Store build uses
Face ID as usual.

## Results

| Route                              | TV      | Sound on the TV?                                     | Second copy on the TV?             | Latency, result and spread | Score feels right? | Notes                                                                          |
| ---------------------------------- | ------- | ---------------------------------------------------- | ---------------------------------- | -------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| iPhone, AirPlay mirroring          | LG C2   | Yes                                                  | Before 0.8.40 yes; fixed in 0.8.40 | None in 0.8.41 (Test 5)    |                    | TV lyrics and TV stage "work great" (3 Nov, Test 8)                            |
| iPhone, AirPlay sound alone        | LG C2   | Yes from mp-v0.8.56 (6 Nov, Test 11), about 2 s late | n/a                                |                            |                    | Before it the clock ran with no sound from the TV or the phone (3 Nov, Test 8) |
| iPhone, AirPlay mirroring          | Samsung |                                                      |                                    |                            |                    |                                                                                |
| iPhone, phone speaker only         | none    | n/a                                                  | n/a                                | 113 ms in 0.8.41 (Test 5)  |                    |                                                                                |
| Android, Screen Cast               | Philips |                                                      | n/a                                |                            |                    |                                                                                |
| Android, Screen Cast or Smart View | LG      |                                                      | n/a                                |                            |                    |                                                                                |
| Samsung phone, Smart View          | Samsung |                                                      | n/a                                |                            |                    |                                                                                |

Also: LG webOS version: \_\_\_ ; Samsung model year: \_\_\_ ; phones: \_\_\_ .
