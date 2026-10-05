// ============================================================
// The carrier in front: the lock screen's bar and skips
// ============================================================
//
// iOS asks WebKit whether the song on the lock screen can be moved, and
// WebKit answers for one sound only: the one that started last
// (PlatformMediaSessionManager::computeSupportsSeeking asks its current
// session). A Web Audio clock never can (AudioContext::supportsSeeking), and
// every clock that starts becomes that sound: the song's own as it plays,
// again as it is resumed when the app goes behind another one, and on every
// resume() at all, even of a clock that already runs
// (AudioContext::resumeRendering). From then on WebKit refuses the bar and
// both skips (RemoteCommandListenerCocoa answers CommandFailed), and the lock
// screen puts the bar back where it was.
//
// Playing a carrier that already plays starts nothing, but WebKit counts it
// as a start all the same (HTMLMediaElement::playInternal), and the carrier
// is the sound that started last again. So while the song plays, the carrier
// is played again at the moments of ours that can start a clock: each
// report, the page hiding or showing, and the song's clock starting (the
// room reports again when it does). At once, and once more a moment later
// for a clock that starts with the same moment. Never a paused one: that
// would take the sound from another app.
//
// Never on a timer of its own. Build 546 played the carrier once a second,
// and a play that lands just after another app takes the sound takes it
// back. WebKit's GPU process hears of the interruption before the page does
// and marks the page's session interrupted; every play asks it to activate
// the session (PlatformMediaSessionManager::maybeActivateAudioSession), and
// with no active session left uninterrupted it does, for real
// (RemoteAudioSessionProxyManager::tryToSetActiveForProcess). YouTube
// started, then stopped (docs/plans/mobile-native/ios-audio-handoff.md).
// Our own moments are safe: another app does not start at the same instant.
//
// A paused song is not kept in front. Its carrier pauses while the song's
// clock still runs, and WebKit moves a pausing sound behind every one still
// playing (PlatformMediaSessionManager::sessionWillEndPlayback), so the bar
// and skips of a paused song can still be refused.

/** How long after a moment of ours the carrier is put in front once more. */
export const ONCE_MORE_MS = 250

/** What keeping the carrier in front asks of the Now Playing module. */
export interface InFrontHost {
  /**
   * The carrier, while it plays for a song that plays: the one to keep in
   * front. Null otherwise.
   */
  readonly playingCarrier: () => Pick<HTMLMediaElement, 'play'> | null
}

export interface InFront {
  /**
   * Put a carrier that plays for a song that plays in front: now, and once
   * more a moment later. Moments close together share one once more, after
   * the last of them.
   */
  now: () => void
  /** Forget a once more still to come. */
  stop: () => void
}

export function keepInFront(host: InFrontHost): InFront {
  let onceMore: ReturnType<typeof setTimeout> | undefined

  const stop = (): void => {
    clearTimeout(onceMore)
    onceMore = undefined
  }

  /** Play the carrier again, if it plays. */
  const again = (): void => {
    const element = host.playingCarrier()
    if (element === null) return
    try {
      // Refused, or cut short by a pause: it plays on as it was.
      void Promise.resolve(element.play()).catch(() => undefined)
    } catch {
      // Refused at once: the next moment of ours asks again.
    }
  }

  return {
    now: () => {
      again()
      stop()
      onceMore = setTimeout(() => {
        onceMore = undefined
        again()
      }, ONCE_MORE_MS)
    },
    stop,
  }
}
