# iOS: handing the sound to another app and taking it back

**Status:** the handoff shipped in TestFlight build 533 (#926). The trip to
the background below follows in the build after 533. **Date:** 2026-10-04.

What the Karaoke room does when another app (YouTube's picture-in-picture,
a call, Siri) takes the sound, and when the singer takes it back.

## What the phone showed (build 527)

1. YouTube in picture-in-picture, then our app, then play: sometimes the
   song did not start. Leaving the room and coming back fixed it.
2. Our app open with YouTube's window on screen, play pressed in that
   window: YouTube played, then stopped about half a second later and its
   button went back to paused. A second press played normally.
3. Back in our app, play pressed quickly: the button flipped to playing and
   back, or stayed on playing in silence while YouTube went quiet. Swiping
   home and back, then play, worked.

## Why

WebKit (safari-7621-branch) decides who has the sound, not the page:

- `PlatformMediaSessionManager::sessionWillBeginPlayback` activates the
  audio session, then ends any interruption for every session on the page:
  `if (m_currentInterruption) endInterruption(PlatformMediaSession::EndInterruptionFlags::NoFlags);`
- `AudioSession::beginInterruption` ignores a second interruption while the
  first is still marked: `if (m_isInterrupted) { RELEASE_LOG_ERROR(... "already interrupted!"); return; }`.
  The mark clears only on iOS's "ended" notification, or when an explicit
  `setActive(true)` succeeds, which ends the interruption and resumes every
  session that was playing before it.
- Web Audio alone plays as AmbientSound (mixable), an audible media element
  as MediaPlayback (not mixable). WebKit never asks to mix with others, and
  its GPU process keeps its own audio session, apart from the app's.

The page fought that. The shared audio context resumed itself on
`statechange` when iOS moved it to `'interrupted'`, and a tap or the page
coming back resumed it too. Each resume was playback starting, so:

- it ended WebKit's interruption and took the sound straight back, which
  is YouTube stopping half a second after it started (2);
- when the resume came before iOS's "ended", the session stayed marked as
  interrupted, so YouTube's next take-over was dropped and our clock said
  `'running'` with no output (1 and 3). Leaving the room suspended and
  resumed the clock, which is why that fixed it.

## The rules

1. **Never resume what the system interrupted.** Not on `statechange`, not
   on a tap, not when the page comes back. The system ends an interruption,
   or the singer's next press of play does. The one exception is the trip
   to the background, below: an interruption WebKit makes itself, for a
   song the singer asked to keep.
2. **On play, take the session first, then the clock.** The unlock clip
   plays first, or, while the lock screen's carrier holds the session, the
   carrier plays. The clock resumes after it, so the second call is the
   explicit activation WebKit wants (`unlockForPlayback`).
3. **Check that play made sound.** 700 ms after a press in the room, a clock
   that has not moved is restarted once (suspend, then resume). One that
   still does not move stops, and the singer reads
   "The song didn't start. Press play to try again."
4. **Pause with the interruption.** An `'interrupted'` clock pauses the
   transport, so the button tells the truth (the trip to the background
   excepted).
5. **Say whose pause it was.** The Now Playing report carries
   `interrupted`, so the carrier keeps a pause the system made and plays
   again when a call ends with the word to resume.

## The trip to the background (build 533)

What the phone showed, with YouTube no longer fighting the room:

1. Background play on, a song playing, swipe home: the lyrics window
   opened, and about half a second later the song paused.
2. The window open, the app opened from its icon: the window stayed, and
   the room showed lyrics frames over its background until the window was
   closed by hand. The window's own return button worked.
3. Background play off: a loud buzz on leaving the app, and sometimes on
   coming back, as if a note were cut off.

Why:

1. WebKit keeps Web Audio out of the background on its own.
   `MediaSessionManageriOS::resetRestrictions` gives Web Audio
   `BackgroundProcessPlaybackRestricted`, so
   `applicationDidEnterBackground` begins an `EnteringBackground`
   interruption: the clock goes `'interrupted'` on every trip home, and
   `applicationWillEnterForeground` ends it with `MayResumePlaying`. A resume
   in the background is allowed (`sessionWillBeginPlayback` checks nothing
   about the background for Web Audio). Before #926 the shared context
   resumed it on `statechange`, which is how background play worked in 527. Rule 1 took that away, and rule 4 paused the song.
2. The window was asked to stop on `willEnterForeground`, before the app is
   active, and iOS can ignore that. Meanwhile the page showed Android's
   lyrics overlay: on Android the window is the page, shrunk, but on an
   iPhone the window draws its own frames.
3. The shell parks the shared clock when the app stops being active
   (Capacitor's `appStateChange`, on `willResignActive`). The room asked
   for no time first, so the clock stopped in the middle of the waveform:
   that cut is the buzz. The fade the room's own pause scheduled then ran
   on the parked clock, so it played out on the way back.

What changed:

- A room that keeps playing behind other apps (`keepsPlayingHidden`:
  background play on, or the window open) resumes the clock when the
  interruption is the trip home. That is one that lands within 1.5 s after
  the page hides (`ENTERING_BACKGROUND_MS`), or one that lands first, while
  the page is still visible, when the page hides within 0.7 s
  (`LEAVE_WAIT_MS`). Any other interruption still pauses the song, so with
  background play on, one in front pauses 0.7 s late.
- Before the shell parks the clock, a playing song pauses with its fade,
  and the clock waits for it (`prepareToSuspend`, 80 ms). A fade already
  running, from a pause just before or a second request, gets the rest of
  its time. With background play off, Control Center and the notification
  center now pause the song cleanly.
- The window stops again once the app is active (`didBecomeActive`), and on
  an iPhone the page stays the room while the window is open
  (`windowShowsThePage`).

## Build 539

What the phone showed:

1. Our lyrics window open, YouTube or YouTube Music playing: play in our
   window ran the lyrics on, but the song stayed silent and YouTube played
   on.
2. Control Center's and the lock screen's bar now and then jumped to 0:00
   and ran on from there, while the song played where it was. Leaving the
   app and coming back put it right.
3. Locked for a while with the song paused, play on the lock screen did
   nothing. Opened later, the app was playing the song from somewhere.
4. The 10 s back and forward buttons did nothing to the song.
5. Once, a pop leaving Karaoke Night for the rooms.
6. Coming back to the room with the mic on stopped YouTube, the song paused.

Why:

1. The window turned its own clock to playing on the press, before the page
   said anything. Behind YouTube, WebKit activates the page's session as
   ambient before it makes it playback, so the carrier started under a
   session that mixes: YouTube played on and nobody heard the song.
2. WebKit moves the session's place to the element's own on every seek of
   any media element, a loop included
   (`MediaElementSession::clientCharacteristicsChanged`), and tells the lock
   screen later, from a task. The four-second carrier went round 15 times a
   minute, so each round sent 0:00 and then our correction, and now and then
   the lock screen kept the first.
3. A paused song lets iOS suspend the app. The press waits in WebKit until
   the app runs again, and plays the song then.
4. With no handler for `seekforward` and `seekbackward`, WebKit skips the
   element it plays: the carrier.
5. The hosted mixer let its graph go at once on the way out, in the middle
   of its own fade, and the shared clock parked as soon as the last lease
   went.
6. Capture changes WebKit's category: the 2 Oct rule.

What changed:

- The window's play and pause no longer turn its clock: the page's report
  does. A play from the window, the lock screen or a headset takes the
  sound first (`takeTheSound`). Behind another app whose sound plays (the
  window says so with `isOtherAudioPlaying`, or the system paused the song),
  the page asks WebKit for a `playback` session for the moment the carrier
  starts (`navigator.audioSession.type`), then gives the page its own type
  back. A carrier still paused after `play()` was refused, and the press is
  dropped: the song stays paused, and so does the window.
- The carrier is an hour of FLAC silence (673 KB, built in about 10 ms)
  where the WebView takes FLAC, so it goes round once an hour. The
  four-second WAV stays for a WebView that says no, or will not load it.
- A press that waited while the app slept is dropped. While the page is
  hidden with a song on the lock screen it beats once a second; a press
  after a long gap, or within 1.5 s of one ending, is held 400 ms and
  dropped if the app comes to the front in that time. The window's presses
  carry the time they were pressed, and one older than 3 s is dropped.
- iOS registers `seekforward` and `seekbackward`, and the room skips from
  where the audio clock is (`positionNow`). Android is unchanged.
- The hosted mixer waits for its fade (`releaseLeft`) before it lets the
  graph go, and the shared clock parks 120 ms after the last lease goes
  (`RELEASE_GRACE_MS`), unless a new lease came in that time.
- Decided by the owner on 4 Oct: on iOS the mic comes back with the room
  only while the song plays. A paused song keeps it for the next press of
  play, so whatever plays meanwhile keeps playing. Android is unchanged.

What iOS still decides: whether an app behind another one may take the
sound. When it refuses, the press does nothing you can see, and the log
says so.

## Build 543

What the phone showed: the bar in Control Center and on the lock screen
could be dragged, but it went straight back to where the song was, and
the song did not move. The 10 s buttons did nothing. Everything else from
539 held.

Why: iOS asks WebKit whether the song can be moved, and WebKit answers for
one sound only, the one that started last
(`PlatformMediaSessionManager::computeSupportsSeeking` asks its current
session). A Web Audio clock always says no (`AudioContext::supportsSeeking`),
and every clock that starts becomes that sound: the song's own as it plays,
the resume as the app goes behind another one, the microphone's. WebKit
then answers the bar and both skips with `CommandFailed`
(`RemoteCommandListenerCocoa`), and the lock screen puts the bar back. In
539 the four-second carrier started again each time it went round, so
within four seconds of a clock starting it was in front again. The hour of
FLAC goes round once an hour.

What changed: playing a carrier that already plays starts nothing, but
WebKit counts it as a start (`HTMLMediaElement::playInternal`). While the
song plays, the carrier is played again on each report, as the page hides
or shows, and once a second (`carrier-in-front.ts`; Build 546 took the
once a second out again). A paused carrier never is: that would take the
sound from another app.

What it does not fix: a paused song. Its carrier pauses while the song's
clock still runs, and WebKit moves a pausing sound behind every one still
playing (`PlatformMediaSessionManager::sessionWillEndPlayback`), so the bar
and the skips of a paused song can still go back where they were.

## Build 546

What the phone showed: the bar and the 10 s buttons on the lock screen and
in Control Center moved the song. But with the song playing behind the
lyrics window, starting YouTube sometimes played it for a moment and
stopped it again, and then neither app played.

Why: 543's fix played the carrier once a second, and a play can take the
sound back from an app that has just taken it. WebKit's GPU process hears
of the interruption first and marks the page's session interrupted
(`RemoteAudioSessionProxy::beginInterruption`), then tells the page. Until
the page hears, the carrier still plays as far as the page knows, so a
play can land in between. Every play asks for the session to be activated
(`PlatformMediaSessionManager::maybeActivateAudioSession`, a synchronous
call on iOS 18 and 26), and with no active session left uninterrupted the
GPU process activates it for real
(`RemoteAudioSessionProxyManager::tryToSetActiveForProcess`). Our session
does not mix, so iOS interrupts YouTube. Then the page hears of its own
interruption and pauses too. Builds 533 to 543 had no play on a timer and
could not do this.

What changed: no timer. The carrier is played again only at moments of
ours: each report, the page hiding or showing, and the song's clock
starting while it plays (the mixer's `clockStarts`, on which the room
reports again). Each time at once, and once more 250 ms later for a clock
that starts with the same moment (`ONCE_MORE_MS`). Another app does not
start at the same instant as one of ours. The resume on the trip to the
background and the clock cycled on the way back both start the clock, so
both put the carrier back in front.

What it does not fix: a moment of ours can still land in that gap.
Leaving the app and starting YouTube within about two seconds meets the
trip's own resume and the plays that follow it. The resume was already
there in 533.

## Where it lives

| File                                                                  | What it does                                                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/audio-io/src/shared-audio-context.ts`                       | No resume on `statechange`, or for an interrupted context; parks 120 ms after the last lease                                                             |
| `src/lib/audio-unlock.ts`                                             | `unlockForPlayback`: the session first, then the clock                                                                                                   |
| `packages/mobile-runtime/src/webkit-now-playing.ts`                   | `claimCarrier`, a pause the system made, `takeTheSound`, which silence the carrier plays                                                                 |
| `packages/mobile-runtime/src/carrier-silence.ts`                      | The silence: an hour of FLAC, four seconds of WAV                                                                                                        |
| `packages/mobile-runtime/src/waited-presses.ts`                       | Presses that waited while the app slept                                                                                                                  |
| `packages/mobile-runtime/src/carrier-in-front.ts`                     | The carrier played again at moments of ours while it plays, never on a timer, so WebKit lets the bar and skips move the song                             |
| `packages/mobile-runtime/src/picture-in-picture.ts`                   | The window's presses: their stamp and `otherAudio`, stale ones dropped                                                                                   |
| `packages/mobile-runtime/src/platform.ts`                             | The 10 s skips (`skipBy`), `micStopsOtherApps`                                                                                                           |
| `src/features/stem-mixer/useStemMixerAudioController.ts`              | The interrupted pause, `restartClock`, the start check, the trip home, the fade before a suspend, `clockStarts`                                          |
| `src/features/stem-mixer/playback-return-watch.ts`                    | `watchClockMoves`, shared by the start check and the return watch                                                                                        |
| `src/features/karaoke-room/KaraokeRoomStage.tsx`                      | `interrupted` in the Now Playing report, a report on each clock start, `keepsPlayingHidden`, the lease's `prepareToSuspend`, the iOS mic rule, the skips |
| `src/components/StemMixer.tsx`                                        | The hosted mixer lets its graph go after its fade                                                                                                        |
| `apps/mercurypitch/ios/App/App/LyricsWindow/LyricsWindowPlugin.swift` | `AudioSessionWatch`: the `[audio session]` log; each window press's `at` and `otherAudio`                                                                |
| `apps/mercurypitch/ios/App/App/LyricsWindow/LyricsWindow.swift`       | The window's play and pause wait for the page's report                                                                                                   |

## Reading a device log

The portable console in a TestFlight build has all of it:

- `[audio]` lines from the mixer: `play` (with `clockWas`), `statechange`
  (with `hidden`), `background-resume` (with `hiddenForMs`), `suspend-fade`,
  `clock-stuck` (with `attempt`), `clock-restart`.
- `[now playing]` lines from the carrier, including "play pressed: the
  carrier takes the sound first", where the bar was put on each report, a
  press dropped because it waited while the app slept, and whether a play
  from behind the app took the sound
  ([DEVICE-DEBUGGING.md](../../agent/DEVICE-DEBUGGING.md) lists them).
- `[audio session]` lines from the app's own session, each with the time
  iOS said it: another app's sound starting and stopping, interruptions,
  route changes, and what played elsewhere as the app came and went. These
  are the app's session, not WebKit's, but the other app's start and stop
  land at the same moment for both.

## Phone checks

Each with YouTube's picture-in-picture open and the song loaded:

- Play YouTube, switch to our app, press play once: the song plays and
  YouTube stops.
- In our app, press play in YouTube's window: YouTube plays and keeps
  playing; our button shows paused.
- With the song playing in the app or behind our window, start YouTube,
  ten times over a few minutes and once straight after leaving the app:
  YouTube keeps playing every time, and the song pauses.
- Press play in our app straight after: the song plays, YouTube stops,
  no flip back to paused.
- Repeat the switch quickly, five times each way: no silent "playing".
- A call during the song: the song pauses, and comes back on its own when
  the call ends (with background play on).
- Our window open, YouTube playing, play in our window: the song plays and
  YouTube stops, or, if iOS refuses, the window stays paused. Never lyrics
  running in silence.

Without YouTube:

- Background play on, play, swipe home: the song keeps playing and the
  window opens.
- With the window open, open the app from its icon: the window closes and
  the room is there.
- Background play off, play, swipe home: the song stops without a buzz,
  and coming back is quiet too.
- Background play off, play, open Control Center: the song pauses.
- Scrub the bar in Control Center and on the lock screen a dozen times over
  a few minutes: it never jumps to 0:00.
- Play, lock the phone, and at once drag the bar on the lock screen: the
  song moves there. Again a few seconds later, and again over Control
  Center with another app open.
- The 10 s buttons move the song 10 s while it plays, stop at its start,
  and at its end go where dragging the bar to the end goes.
- The bar and the 10 s buttons, at once and again a minute later, after
  each of: play in the app then lock; play from the lock screen; play from
  our window; leave the app while it plays; the mic on, then lock. The song
  moves every time.
- Pause, lock the phone for ten minutes, press play: it plays, or nothing
  happens; opening the app later never finds the song playing on its own.
- Mic on, pause, leave, play YouTube, come back: YouTube keeps playing until
  play; then the song plays and the mic comes back.

## Open

- Whether iOS lets a play from behind the app take the sound from the app
  in front. The window and the lock screen now say so either way; the log
  of a device test tells which.
- With background play off there is no carrier, so after a call the song
  stays paused until play.
- The bar and the skips of a paused song (Build 543). Keeping its carrier
  in front would mean pausing the carrier only after the song's clock has
  parked, which the carrier does not know today.
- A `resume()` of a clock that already runs puts it in front of the
  carrier and changes no state, so nothing answers it until the next
  report or page turn (Build 546). Nothing does that today:
  `audio-unlock.ts` resumes only a clock that is not running. A new
  caller would take the bar and skips away while the song plays on.
