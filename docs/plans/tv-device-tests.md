# TV device checks: what to try, what to write down

For phase P0 and the proofs of concept of
[tv-cast-and-google-tv.md](tv-cast-and-google-tv.md); requirement ids are in
[../specs/tv-karaoke.ears.md](../specs/tv-karaoke.ears.md). Tests 1 to 3 need
no new build: use the current TestFlight build on the iPhone and the current
app on an Android phone. Tests 4 to 7 need the build named in each. Fill in
the tables; that is all that needs to come back.

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

**B. Lyrics on the TV (the switch).**

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

## Test 5: per-route latency (PR #1175, TestFlight mp-v0.8.41, build 1321)

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

| Route                | Latency, result and spread | Score feels right? | Notes |
| -------------------- | -------------------------- | ------------------ | ----- |
| Phone speaker        |                            |                    |       |
| AirPlay to the LG C2 |                            |                    |       |
| AirPlay to Samsung   |                            |                    |       |

## Test 6: the stage on the TV (PR #1179, TestFlight mp-v0.8.41, build 1321)

The phone stays the room and the microphone, held upright; the TV draws the
stage in its own landscape (POC-3). mp-v0.8.41 carries #1175 as well, so
step 6 can use the TV's own latency number from Test 5.

1. Start Screen Mirroring. Settings, Developer, TV: turn on "Stage on a
   connected TV". "It shows" should read the stage, "Lyrics on a connected
   TV" should turn itself off, and the TV should show "Mercury Pitch" and
   "Choose a song on your phone".
2. Open Karaoke and play a song, phone upright. The TV should show the
   title, the lane with the song's notes running right to left past the
   playhead, and the lyrics, the line being sung filling word by word with
   the next line under it. Turn the mic on and sing: your line should trail
   behind the playhead, and a score should appear top right after a few
   seconds.
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

Beside Cue had Mercury Pitch's second-copy bug, and #1182 ports the fix. Main
uploads a Beside Cue TestFlight build on every push that touches it; the
newest of 2026-10-23 is build 1202.

1. Start Screen Mirroring, then open Beside Cue. The TV should show the phone
   and follow it, with no separate copy of the app on its first screen.
2. Open Beside Cue first, then start mirroring. You should get the same
   result.
3. Play a game with sound: does the sound come from the TV?

| TV      | Mirrors, no second copy? | Same when mirroring starts second? | Sound from |
| ------- | ------------------------ | ---------------------------------- | ---------- |
| LG C2   |                          |                                    |            |
| Samsung |                          |                                    |            |

## Aside: a TestFlight Subscribe asks for the password

In a TestFlight build Apple's purchase sheet asks for the Apple Account
password every time, because TestFlight purchases run in Apple's sandbox,
where Face ID does not authorise them. A password manager's AutoFill may not
work in that prompt (its keyboard does not come up): an iOS limit that the
App Store app shows too, not the app's bug. Type the password, or copy it
from the password manager before pressing Subscribe. An App Store build uses
Face ID as usual.

## Results

| Route                              | TV      | Sound on the TV? | Second copy on the TV?             | Latency, result and spread | Score feels right? | Notes |
| ---------------------------------- | ------- | ---------------- | ---------------------------------- | -------------------------- | ------------------ | ----- |
| iPhone, AirPlay mirroring          | LG C2   | Yes              | Before 0.8.40 yes; fixed in 0.8.40 |                            |                    |       |
| iPhone, AirPlay mirroring          | Samsung |                  |                                    |                            |                    |       |
| iPhone, phone speaker only         | none    | n/a              | n/a                                |                            |                    |       |
| Android, Screen Cast               | Philips |                  | n/a                                |                            |                    |       |
| Android, Screen Cast or Smart View | LG      |                  | n/a                                |                            |                    |       |
| Samsung phone, Smart View          | Samsung |                  | n/a                                |                            |                    |       |

Also: LG webOS version: \_\_\_ ; Samsung model year: \_\_\_ ; phones: \_\_\_ .
