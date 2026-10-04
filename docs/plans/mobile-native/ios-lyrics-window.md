# iOS lyrics window (picture in picture)

Status: approved (owner, 4 Oct 2026), in TestFlight build 533 (#925). The
fixes from its device test (the song pausing after the swipe home, the window
staying open on a return through the icon) follow in the build after 533.
Builds on #924 (the lock screen's Now Playing through WebKit).

## What it is

The Karaoke room's lyrics window, on iPhone. A singer who swipes home while a
song plays keeps the lyrics in a floating window over other apps, as a video
app's player does. It matches Android's window (`KaraokeLyricsWindow.tsx`):

- the line being sung, big, its words filling from the left as they are sung;
- the next line under it, smaller and dim;
- the song's title above, smallest;
- in a rest, and before the first line, the line coming takes the big place,
  dimmed; a song with no lyrics shows its title there;
- over the Mercury Pitch picture the lock screen already shows
  (`native-only/now-playing.webp`), under the scrim Android's window uses.

The window's own play and pause control the song. Nothing else in it is
interactive. The setting is the one Android uses, "Show lyrics in a small
window" (`karaokePictureInPicture`, on by default); Settings, Karaoke now
shows it on an iPhone too.

On iPhone the window also needs "Keep playing in the background" (on by
default). Leaving the app hides the page, and without that setting the room
pauses the song on the way out, so a window would open on a paused song.

Coming back to the app closes the window, as a video app's does. While the
window is open the app itself stays the room: the window draws its own
frames, so unlike Android's, it is not the page shrunk.

Not in scope: a button that opens the window from inside the app, scrubbing
or skipping from the window, the window anywhere but the Karaoke room, iPad.

## Why it has to be native

iOS puts only video in its floating window. A WebView page cannot be
shrunk into it as Android shrinks the whole app, and the web route fails on
both counts that matter (research, 4 Oct 2026):

- `requestPictureInPicture()` needs a tap, and WebKit opens a window on its
  own only for a playing fullscreen video with sound, never for a silent
  canvas stream.
- A hidden page stops `requestAnimationFrame` and aligns its timers to 1 s,
  so a canvas could not keep the words moving behind another app.

So the window is native: `AVPictureInPictureController` over an
`AVSampleBufferDisplayLayer` (iOS 15+), fed frames that Swift draws from the
song's lyric timing and clock. The page sends the timing once per song and
the clock on every play, pause and jump; native runs the clock on between
reports, as the lock screen does.

## App Review: the decisions

These are rules for this feature and anything built on it later.

**Do**

1. Open the window only the way iOS opens it for video apps: armed with
   `canStartPictureInPictureAutomaticallyFromInline` while a song is audibly
   playing in the Karaoke room with the setting on, and opened by iOS when
   the singer swipes home. A later in-app button may open it from a tap.
2. Show only the playing song in it: its lyrics, title and the Mercury Pitch
   picture.
3. Make the window's play and pause tell the truth and control the song,
   through the same path as the lock screen's buttons.
4. Close the window when the song leaves the room (`stop` when the lyrics
   are taken away), and disarm it when the song pauses or the room goes.
5. Leave iOS's own "Start PiP Automatically" setting in charge: the system
   applies it to automatic starts, and nothing here overrides it.
6. Say it in the App Review notes when it first ships: "In the Karaoke room,
   a playing song's lyrics continue in a Picture in Picture window when you
   swipe home (Settings, Karaoke: Show lyrics in a small window)."

**Do not**

1. Never call `startPictureInPicture()` from code without a tap. Apple's
   AVKit guide: "Only begin PiP playback in response to user interaction and
   never programmatically. The App Store review team rejects apps that fail
   to follow this requirement."
2. Never arm the window while no song plays, or outside the Karaoke room. A
   paused song keeps an open window (paused, as a paused video does) but
   does not arm a new one.
3. Never use a private API or key, such as `controlsStyle` to hide the
   window's buttons.
4. Never put ads, offers, upsells or anything but the song in the window.
5. Never keep the microphone on behind the window. The room already lets it
   go when the window opens; it never takes it back in the background.
6. Never keep the app alive in the background for the window alone: no song
   playing or paused in the room means no window (guideline 2.5.4).
7. Never change the audio session at runtime to make the window open
   (#922 broke playback that way). If iOS refuses the window with the
   current session, the answer is a launch-time setting, decided on device.

## Architecture

### Page (TypeScript)

- `src/lib/lyric-line-at.ts` (new, pure): the rule for which line is being
  sung at a time, moved out of `useStemMixerLyricsController.ts`
  (`updateCurrentLine`), which now calls it.
- `src/lib/lyric-glance.ts` exports the per-line progress it already worked
  out (`lineProgress`).
- `src/lib/lyric-window-script.ts` (new, pure): turns the room's parsed
  lyrics into a script native can draw from. A segment is a run of one line
  being sung (or a rest); inside it, each word's fill is read off the same
  functions the stage uses, every 20 ms, so the window lights the words the
  stage would.

  ```ts
  interface LyricWindowScript {
    title: string
    duration: number // seconds, 0 while unknown
    segments: LyricWindowSegment[] // in time order
  }
  interface LyricWindowSegment {
    at: number // seconds; the segment runs to the next one's `at`
    current: string[] // the words of the line being sung, [] in a rest
    next: string | null // the next line with words
    words: [number, number][] // per word of `current`: [start, end] seconds
  }
  ```

  A word is dim before `start`, fills linearly to `end`, and is lit after
  it. An untimed line has every word at its `at`, all lit, as the stage
  shows it.

- The mixer's room API gains `lyricWindowScript(title)`, built from the
  same memos as `lyricGlance`.
- `NativeDeviceApi` gains `pictureInPictureLyrics(script | null)`. The room
  sends the script when it changes, and null when it leaves.
- `useKaraokePictureInPicture.ts` works on iOS too. On iOS it arms only while
  "Keep playing in the background" is on (`needsBackgroundPlay`).
  `windowShowsThePage` says whether the window shows the page (Android) or
  draws its own frames (iOS); only the first turns the room into the
  window's lyrics view.

### Platform (`packages/mobile-runtime/src/picture-in-picture.ts`, re-exported by `platform.ts`)

- The `PictureInPicture` plugin name is shared with Android. On iOS it has
  `setAutoEnter({ enabled })` as Android does, plus `setLyrics({ json })`
  (the script as JSON, or no `json` to clear it) and
  `setClock({ playing, position, rate, duration })`.
- `setPictureInPictureAutoEnter` and `onPictureInPicture` work on iOS.
- New `setPictureInPictureLyrics(script | null)`, iOS only (Android draws in
  the WebView).
- The iOS Now Playing report (`setNowPlaying`) also sends the clock to the
  plugin, so the window and the lock screen run from one report.
- The window's play and pause arrive as `pictureInPictureAction` and go to
  the `onMediaAction` handlers, as a lock-screen press does. Each carries
  when it was pressed (`at`) and whether another app's sound was playing
  (`otherAudio`). One older than 3 s waited for the app to run again and is
  dropped. A play takes the sound first (`takeTheSound`, see
  [ios-audio-handoff.md](ios-audio-handoff.md)), and is dropped when it
  cannot.
- Native log lines arrive as `pictureInPictureLog` and are written with
  `console.info('[lyrics window] ...')`, so they show in the in-app console.

### Native (Swift, `apps/mercurypitch/ios/App/App/LyricsWindow/`)

- `LyricsWindowPlugin.swift`: the Capacitor plugin (`jsName`
  `PictureInPicture`). Hands calls to the window, events and log lines to the
  page.
- `LyricsWindow.swift`: the layer, the controller and both delegates. A host
  view with the sample-buffer layer sits in the key window behind the
  WebView, a 16:9 band across the middle of the screen, so the window grows
  out of where the lyrics are. Arms automatic start while lyrics are set and
  auto-enter is on; disarms otherwise. Keeps the clock and the layer's
  control timebase. Re-arms after a start that fails (iOS sometimes
  refuses one with `PGPegasusErrorDomain -1003`), for the next swipe home;
  it never starts the window itself. Stops the window when the app comes
  back to the foreground, and again once it is active
  (`didBecomeActive`): iOS can ignore a stop made before then.
- `LyricsWindowScript.swift`: the script, decoded with `Codable`, and the
  lookup of the segment at a time.
- `LyricsWindowRenderer.swift`: draws a frame (640x360 BGRA, from a pixel
  buffer pool) for time t: background picture, the scrim, title, current
  line with the word fill, next line. Shrunk to fit, then truncated.
- A frame pump on a `DispatchSourceTimer`: 15 frames a second while the
  window is open, 2 while armed (so a window opens on a current frame),
  none otherwise.
- `ViewController.swift`: a `CAPBridgeViewController` subclass that registers
  the plugin in `capacitorDidLoad()`. `SceneDelegate` and `Main.storyboard`
  use it.
- `apps/mercurypitch/src/ios-lyrics-window.test.ts` reads the wiring off the
  sources: the registration, the names on both sides of the bridge, the
  Xcode project, and the App Review rule that nothing starts the window.
- The window's play and pause do not turn its clock: the report that
  follows does. Turned at once, a play that could not take the sound from
  the app in front ran the lyrics on in silence (build 539).
- `timeRangeForPlayback` is always finite: the song's length, or one hour
  while it is unknown (an infinite range has cost 100% CPU since iOS 16.1).
  `requiresLinearPlayback` is on, so the window has no skip buttons.

### Clock

The page's Now Playing report (playing, position, rate, duration) is the
clock. Native keeps the report and the time it came, and works out
`t = position + (playing ? elapsed * rate : 0)`, clamped to the song. A
report comes on every play, pause, jump and new length, never per frame.

## Logging

Every line goes to the in-app console with the `[lyrics window]` prefix.
Native sends it as an event; the page writes it.

- the plugin loaded; `isPictureInPictureSupported`;
- lyrics set (segments, duration) and cleared; clock reports (playing,
  position, rate);
- armed and disarmed, with the reason (no lyrics, setting off or paused);
- `isPictureInPicturePossible` changing;
- will start, did start, failed to start (domain, code, message), the retry,
  will stop, did stop, restore to the app;
- play and pause pressed in the window, and on the page, a press dropped
  because it waited while the app slept;
- the audio session when arming and when the window opens: category, mode,
  options, other audio playing, output route;
- renderer trouble: no pixel buffer, no sample buffer, the layer failed
  (status and error), and the flush that follows.

## Testing

- Unit tests (Vitest) for the line rule and the script builder: timed lines,
  per-word timing, untimed lines, rests, the intro, the last line, a song
  with no lyrics.
- Platform tests: the iOS calls (auto-enter, lyrics, clock with each Now
  Playing report), the window's play and pause reaching the media handler,
  log events reaching the console, nothing on the web or Android.
- Room tests: the script sent on load and change, null on leaving; auto-enter
  on iOS only with background play.
- Swift has no local compiler here. The pull request's iOS build compiles
  it; the phone is the only test of what it draws and when iOS opens it.

### On the phone

1. Play a song, swipe home: the window opens, the words fill in time, and
   the song keeps playing.
2. Pause and play from the window: the song follows; so does the lock screen.
3. Leave the window open for a few minutes: still in time, the phone not hot.
4. Tap the window's return button: back in the room, the song playing.
5. Close the window: the song plays on; the lock screen still controls it.
6. Open the app from its icon while the window is up: the window closes,
   and the app shows the room.
7. Pause in the room, swipe home: no window.
8. Turn the setting off, play, swipe home: no window.
9. Leave the room while the window is open: it closes.
10. A call while the window is open: the song pauses; the window shows it.
11. If the window never opens: send the `[lyrics window]` lines.

## Risks

1. The audio session is PlayAndRecord with mixing, set at launch
   (`packages/ios-audio-session`). Apple asks for an active playback session
   for PiP. The logs say what iOS decides; a change, if needed, is made at
   launch.
2. The layer sits behind the WebView. If iOS will not open a window from a
   covered layer, `isPictureInPicturePossible` stays false in the log.
3. The window may go blank when another app starts a call (seen on iOS 18).
4. A start can fail with `-1003`. The window re-arms for the next swipe
   home; it is never started from code.
5. Battery: 15 frames a second while the window is open, 2 while armed.
