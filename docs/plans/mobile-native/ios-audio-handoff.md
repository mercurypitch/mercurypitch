# iOS: handing the sound to another app and taking it back

**Status:** shipped in the TestFlight build after 527. **Date:** 2026-10-04.

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
   or the singer's next press of play does.
2. **On play, take the session first, then the clock.** The unlock clip
   plays first, or, while the lock screen's carrier holds the session, the
   carrier plays. The clock resumes after it, so the second call is the
   explicit activation WebKit wants (`unlockForPlayback`).
3. **Check that play made sound.** 700 ms after a press in the room, a clock
   that has not moved is restarted once (suspend, then resume). One that
   still does not move stops, and the singer reads
   "The song didn't start. Press play to try again."
4. **Pause with the interruption.** An `'interrupted'` clock pauses the
   transport, so the button tells the truth.
5. **Say whose pause it was.** The Now Playing report carries
   `interrupted`, so the carrier keeps a pause the system made and plays
   again when a call ends with the word to resume.

## Where it lives

| File                                                                  | What it does                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/audio-io/src/shared-audio-context.ts`                       | No resume on `statechange`, or for an interrupted context         |
| `src/lib/audio-unlock.ts`                                             | `unlockForPlayback`: the session first, then the clock            |
| `packages/mobile-runtime/src/webkit-now-playing.ts`                   | `claimCarrier`, and a pause the system made                       |
| `src/features/stem-mixer/useStemMixerAudioController.ts`              | The interrupted pause, `restartClock`, the start check            |
| `src/features/stem-mixer/playback-return-watch.ts`                    | `watchClockMoves`, shared by the start check and the return watch |
| `src/features/karaoke-room/KaraokeRoomStage.tsx`                      | `interrupted` in the Now Playing report                           |
| `apps/mercurypitch/ios/App/App/LyricsWindow/LyricsWindowPlugin.swift` | `AudioSessionWatch`: the `[audio session]` log                    |

## Reading a device log

The portable console in a TestFlight build has all of it:

- `[audio]` lines from the mixer: `play` (with `clockWas`), `statechange`,
  `clock-stuck` (with `attempt`), `clock-restart`.
- `[now playing]` lines from the carrier, including "play pressed: the
  carrier takes the sound first".
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
- Press play in our app straight after: the song plays, YouTube stops,
  no flip back to paused.
- Repeat the switch quickly, five times each way: no silent "playing".
- A call during the song: the song pauses, and comes back on its own when
  the call ends (with background play on).

## Open

- With the mic on, coming back to the room reopens the mic after 500 ms,
  and capture changes WebKit's category, which silences YouTube even when
  the song is paused. Waiting for play would break the 2 Oct rule that a
  song paused on the way out comes back to an open mic. The owner decides.
- With background play off there is no carrier, so after a call the song
  stays paused until play.
