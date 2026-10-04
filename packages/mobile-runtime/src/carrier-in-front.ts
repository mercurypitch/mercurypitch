// ============================================================
// The carrier in front: the lock screen's bar and skips
// ============================================================
//
// iOS asks WebKit whether the song on the lock screen can be moved, and
// WebKit answers for one sound only: the one that started last
// (PlatformMediaSessionManager::computeSupportsSeeking asks its current
// session). A Web Audio clock never can (AudioContext::supportsSeeking), and
// every clock that starts becomes that sound: the song's own as it plays,
// again as it is resumed when the app goes behind another one, and the
// microphone's. From then on WebKit refuses the bar and both skips
// (RemoteCommandListenerCocoa answers CommandFailed), and the lock screen
// puts the bar back where it was.
//
// Playing a carrier that already plays starts nothing, but WebKit counts it
// as a start all the same (HTMLMediaElement::playInternal), and the carrier
// is the sound that started last again. So while the song plays, the carrier
// is played again on each report, as the page hides or shows, and once a
// second. Never a paused one: that would take the sound from another app.
//
// Build 539's carrier did this without being asked: four seconds of silence,
// started again each time it went round. The hour-long carrier goes round
// once an hour.
//
// A paused song is not kept in front. Its carrier pauses while the song's
// clock still runs, and WebKit moves a pausing sound behind every one still
// playing (PlatformMediaSessionManager::sessionWillEndPlayback), so the bar
// and skips of a paused song can still be refused.

/** How often a carrier that plays is played again. */
const AGAIN_MS = 1000

/** What keeping the carrier in front asks of the Now Playing module. */
export interface InFrontHost {
  /**
   * The carrier, while it plays for a song that plays: the one to keep in
   * front. Null otherwise.
   */
  readonly playingCarrier: () => Pick<HTMLMediaElement, 'play'> | null
}

export interface InFront {
  /** Put a carrier that plays for a song that plays in front, now. */
  now: () => void
  /**
   * Put it in front again once a second for as long as it plays: started by
   * a report of the song playing, ended by the first beat that finds no
   * carrier playing.
   */
  follow: () => void
  /** Stop the beat. */
  stop: () => void
}

export function keepInFront(host: InFrontHost): InFront {
  let beating: ReturnType<typeof setInterval> | undefined

  const stop = (): void => {
    clearInterval(beating)
    beating = undefined
  }

  /** Play the carrier again, if it plays: false when none does. */
  const again = (): boolean => {
    const element = host.playingCarrier()
    if (element === null) return false
    try {
      // Refused, or cut short by a pause: it plays on as it was.
      void Promise.resolve(element.play()).catch(() => undefined)
    } catch {
      // Refused at once: the next beat asks again.
    }
    return true
  }

  return {
    now: () => {
      again()
    },
    follow: () => {
      if (host.playingCarrier() === null) {
        stop()
        return
      }
      beating ??= setInterval(() => {
        if (!again()) stop()
      }, AGAIN_MS)
    },
    stop,
  }
}
