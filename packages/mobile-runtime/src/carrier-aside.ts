// ============================================================
// The carrier aside: nothing beside the song's Web Audio on AirPlay alone
// ============================================================
//
// Over AirPlay to an LG C2, Web Audio alone reached the TV, and Web Audio
// beside a silent element kept local did not (the Developer screen's AirPlay
// sound check, 6 Nov 2026): the TV showed the carrier's Now Playing and a
// spinner, and played nothing. So while the app takes the sound to go to
// AirPlay alone, the lock screen's carrier stands aside: paused, by a pause
// of ours that the song never hears as the system's, and muted. Paused alone
// it may still count: WebKit keeps its session in playback, on the long-form
// route, for an element that is audible and has played audibly since the
// last interruption, playing or not
// (MediaSessionManagerCocoa::updateSessionState). Nothing plays it again
// meanwhile (webkit-now-playing.ts asks `now()` before each play), and the
// lock screen loses the song.
//
// When the sound leaves AirPlay with the song playing, the carrier is
// unmuted and takes its place again, and the lock screen shows the song.
// The unlock clip keeps quiet the same way (audio-unlock.ts in the app).
// Each change is one line in the console.

/** The part of the carrier that standing aside touches. */
export type AsideCarrier = Pick<HTMLMediaElement, 'paused' | 'muted' | 'pause'>

/** What standing aside asks of the Now Playing module. */
export interface AsideHost<C extends AsideCarrier = AsideCarrier> {
  /** The carrier, once there is one. */
  readonly carrier: () => C | null
  /** Whether the song plays by its own word, so the carrier would too. */
  readonly songPlays: () => boolean
  /** Stop keeping the carrier in front, and give the playback session back. */
  readonly letGo: () => void
  /** Give the carrier its silence if it has none, and play it. */
  readonly play: (element: C) => void
}

export interface Aside {
  /** Whether the carrier stands aside now. */
  readonly now: () => boolean
  /** Stand aside (true) or come back (false). */
  readonly set: (aside: boolean) => void
  /**
   * Pause a carrier that plays. The song never hears the pause: the carrier's
   * pause events say nothing while it stands aside.
   */
  readonly pause: (element: AsideCarrier) => void
  /**
   * A play of WebKit's own: while aside, put it back, say so, and answer
   * true. False otherwise, and the play is left alone.
   */
  readonly putBack: (element: AsideCarrier) => boolean
}

export function keepAside<C extends AsideCarrier>(host: AsideHost<C>): Aside {
  let aside = false

  const pause = (element: AsideCarrier): void => {
    if (!element.paused) element.pause()
  }

  const set = (next: boolean): void => {
    if (next === aside) return
    aside = next
    const element = host.carrier()
    if (next) {
      if (element !== null) {
        element.muted = true
        pause(element)
      }
      host.letGo()
      console.info(
        "[now playing] the sound is on AirPlay: the carrier stands aside, so the room's sound plays alone",
      )
      return
    }
    if (element !== null) element.muted = false
    if (element === null || !host.songPlays()) {
      console.info(
        '[now playing] the sound has left AirPlay: the carrier plays again with the song',
      )
      return
    }
    console.info(
      '[now playing] the sound has left AirPlay: the carrier takes its place again, and the lock screen shows the song',
    )
    host.play(element)
  }

  return {
    now: () => aside,
    set,
    pause,
    putBack: (element) => {
      if (!aside) return false
      console.info(
        '[now playing] WebKit played the carrier; it stays aside while the sound is on AirPlay',
      )
      pause(element)
      return true
    },
  }
}
