# TV device checks: what to try, what to write down

For phase P0 and the proofs of concept of
[tv-cast-and-google-tv.md](tv-cast-and-google-tv.md); requirement ids are in
[../specs/tv-karaoke.ears.md](../specs/tv-karaoke.ears.md). Tests 1 to 3 need
no new build: use the current TestFlight build on the iPhone and the current
app on an Android phone. Tests 4 to 9 need the build named in each. Fill in
the tables; that is all that needs to come back.

**Run Tests 4B, 5, 6 and 8 on TestFlight mp-v0.8.52 (3 Nov 2026) or later.**
It carries the wizard that hears a TV (PR #1189, in TestFlight since
mp-v0.8.42) and PR #1321, which keeps the app's silent media off AirPlay,
says each audio route and the clock's state in the console, and stops a
Karaoke song whose clock stands still, saying why. Test 7 is Beside Cue's,
which `mp-v*` tags do not build. **Run Test 9, then Test 8 again, on the
first build with the AirPlay guide** (branch `feat/airplay-guide`): the
AirPlay sound check, the AirPlay hint and the report the room writes.

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
mp-v0.8.52 or later.

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

## Test 6: the stage on the TV (PR #1179, TestFlight mp-v0.8.52 or later)

The phone stays the room and the microphone, held upright; the TV draws the
stage in its own landscape (POC-3). The stage first shipped in mp-v0.8.41
(build 1321); run it on mp-v0.8.52 or later, which carries #1175 too, so
step 6 can use the TV's own latency number from Test 5, and #1321, so a
song that stops on AirPlay says why (Test 8).

1. Start Screen Mirroring. Settings, Developer, TV: turn on "Stage on a
   connected TV". "It shows" should read the stage, "Lyrics on a connected
   TV" should turn itself off, and the TV should show "Mercury Pitch" and
   "Choose a song on your phone".
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
7. Turn the switch off: the TV should mirror the phone again at once. Turn it
   on, stop mirroring and start again: the stage should come back. Close and
   reopen the app while mirroring: the stage should come back too.
8. Copy the console's `[lyrics window] TV stage: ...` lines into the notes.

| TV      | Stage shown? | Sound from | In step? (Stage picture setting) | Pause, seek, Next, key follow? | Readable, nothing cut off? | Smooth? Phone warm? | Switch off mirrors again? | Back after reconnecting? |
| ------- | ------------ | ---------- | -------------------------------- | ------------------------------ | -------------------------- | ------------------- | ------------------------- | ------------------------ |
| LG C2   |              |            |                                  |                                |                            |                     |                           |                          |
| Samsung |              |            |                                  |                                |                            |                     |                           |                          |

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

| Route            | 1 (element) | 2 (kept local) | 3 (Web Audio) | 4 (beside a silent element) | 5 (with the mic) |
| ---------------- | ----------- | -------------- | ------------- | --------------------------- | ---------------- |
| AirPlay, LG C2   |             |                |               |                             |                  |
| Mirroring, LG C2 |             |                |               |                             |                  |
| Phone speaker    |             |                |               |                             |                  |

## Aside: a TestFlight Subscribe asks for the password

In a TestFlight build Apple's purchase sheet asks for the Apple Account
password every time, because TestFlight purchases run in Apple's sandbox,
where Face ID does not authorise them. A password manager's AutoFill may not
work in that prompt (its keyboard does not come up): an iOS limit that the
App Store app shows too, not the app's bug. Type the password, or copy it
from the password manager before pressing Subscribe. An App Store build uses
Face ID as usual.

## Results

| Route                              | TV      | Sound on the TV?                                                      | Second copy on the TV?             | Latency, result and spread | Score feels right? | Notes                                               |
| ---------------------------------- | ------- | --------------------------------------------------------------------- | ---------------------------------- | -------------------------- | ------------------ | --------------------------------------------------- |
| iPhone, AirPlay mirroring          | LG C2   | Yes                                                                   | Before 0.8.40 yes; fixed in 0.8.40 | None in 0.8.41 (Test 5)    |                    | TV lyrics and TV stage "work great" (3 Nov, Test 8) |
| iPhone, AirPlay sound alone        | LG C2   | No: the clock runs, no sound from the TV or the phone (3 Nov, Test 8) | n/a                                |                            |                    |                                                     |
| iPhone, AirPlay mirroring          | Samsung |                                                                       |                                    |                            |                    |                                                     |
| iPhone, phone speaker only         | none    | n/a                                                                   | n/a                                | 113 ms in 0.8.41 (Test 5)  |                    |                                                     |
| Android, Screen Cast               | Philips |                                                                       | n/a                                |                            |                    |                                                     |
| Android, Screen Cast or Smart View | LG      |                                                                       | n/a                                |                            |                    |                                                     |
| Samsung phone, Smart View          | Samsung |                                                                       | n/a                                |                            |                    |                                                     |

Also: LG webOS version: \_\_\_ ; Samsung model year: \_\_\_ ; phones: \_\_\_ .
