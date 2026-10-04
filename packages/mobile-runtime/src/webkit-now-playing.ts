// ============================================================
// Now Playing on iOS, through WebKit's own media session
// ============================================================
//
// iOS puts a song on the lock screen and in Control Center for the audio
// session that plays it, and here that session is WebKit's: the song is Web
// Audio, rendered in WebKit's GPU process under an AVAudioSession of its own.
// The app's MPNowPlayingInfoCenter, which the media session plugin writes,
// belongs to the app's process and never shows, mixable or not (#922, which
// #923 reverted after a device test).
//
// WebKit publishes Now Playing itself for a media element that plays sound:
// unmuted, with a source longer than 0.95 s, once it has fired 'playing'
// (MediaElementSession::canShowControlsManager). Web Audio alone qualifies
// only when `navigator.audioSession.type` asks for playback, and then the
// lock screen's buttons pause the context instead of reaching the room, so
// that stays unset. What qualifies instead is a carrier: a looping `<audio>`
// of generated silence that plays and pauses with the song, while
// `navigator.mediaSession` names the song, holds its place and length, and
// hears the buttons. WebKit hands a press to a registered handler rather than
// to the carrier.
//
// The carrier holds the playback session, which never mixes. The unlock clip
// in src/lib/audio-unlock.ts took the same session on every play tap before
// it, so a song starting stops another app's sound as it always did. Another
// app taking the sound, or a call, pauses the carrier, and the song pauses
// with it; a call that ends with the system's word to resume plays it again,
// and the song comes back with it. WebKit resumes only an element nothing
// paused during the call, so a carrier that is already paused is left alone.
//
// While the carrier holds the session, the unlock clip stands aside
// (`onCarrierHolding`). WebKit shows on the lock screen whichever element a
// tap played last, sends a headset's press to whichever started last, and,
// once the app is on the lock screen, offers even that 0.1 s clip, which
// would keep the app there after the song has gone.
//
// While the app is in front, WebKit keeps Now Playing out of Control Center
// (`allowsNowPlayingControlsVisibility` is false for a visible page). The
// lock screen, and Control Center over another app, show it.

/** The buttons the room answers, in the Media Session API's names. */
export type WebKitAction = 'play' | 'pause' | 'stop' | 'seekto'

/** What a press carries: a seek's place, in seconds. */
export interface WebKitActionDetails {
  readonly seekTime?: unknown
}

/** A song as the lock screen shows it, clamped by the caller. */
export interface WebKitSong {
  readonly title: string
  readonly artist: string
  /** A URL the WebView can load (a data: URL here), or null for none. */
  readonly artwork: string | null
  readonly playing: boolean
  /** Seconds into the song, inside [0, duration]. */
  readonly position: number
  /** The song's length in seconds: 0 while it is not known. */
  readonly duration: number
  /** How fast it plays. Never 0, which WebKit refuses. */
  readonly rate: number
}

/** The part of an `<audio>` element the carrier needs. A test hands in its own. */
export type Carrier = Pick<
  HTMLAudioElement,
  | 'src'
  | 'loop'
  | 'preload'
  | 'paused'
  | 'disableRemotePlayback'
  | 'play'
  | 'pause'
  | 'load'
  | 'hasAttribute'
  | 'removeAttribute'
  | 'addEventListener'
>

export interface WebKitNowPlayingOptions {
  /** Test seam. Production makes a detached `<audio>` element. */
  readonly createCarrier?: () => Carrier
  /** Test seam. Production makes a blob: URL of generated silence. */
  readonly silence?: () => string
  /** Test seam. Production reads `performance.now()`. */
  readonly now?: () => number
}

/**
 * Seconds of silence the carrier loops: past WebKit's 0.95 s, and long
 * enough that it goes round seldom (see `onCarrierRound`).
 */
const CARRIER_SECONDS = 4

/**
 * The iPhone's own output rate, in stereo, 16-bit. unmute.js, which plays
 * silence beside Web Audio for the same reason, warns that silence of a lower
 * quality can drag Web Audio's output down with it on iOS.
 */
const CARRIER_SAMPLE_RATE = 48_000
const CARRIER_CHANNELS = 2

/** A 16-bit PCM WAV file of silence, `seconds` long. */
export function silentWav(seconds: number, sampleRate: number): ArrayBuffer {
  const blockAlign = CARRIER_CHANNELS * 2
  const dataBytes = Math.round(seconds * sampleRate) * blockAlign
  const wav = new DataView(new ArrayBuffer(44 + dataBytes))
  const text = (at: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      wav.setUint8(at + i, value.charCodeAt(i))
    }
  }
  text(0, 'RIFF')
  wav.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true)
  wav.setUint16(22, CARRIER_CHANNELS, true)
  wav.setUint32(24, sampleRate, true)
  wav.setUint32(28, sampleRate * blockAlign, true)
  wav.setUint16(32, blockAlign, true)
  wav.setUint16(34, 16, true)
  text(36, 'data')
  wav.setUint32(40, dataBytes, true)
  // The samples are the buffer's own zeros.
  return wav.buffer
}

let options: WebKitNowPlayingOptions = {}
let carrier: Carrier | null = null
let silenceUrl: string | null = null

/**
 * What the song last asked of the carrier. The carrier's own pause and play
 * events are read against it: one the song did not ask for is the system's.
 */
let wanted: 'none' | 'paused' | 'playing' = 'none'

/** The last report, and when it came: where the bar goes back to. */
let shown: WebKitSong | null = null
let shownAt = 0

/**
 * The name, artist and picture last handed over. A report that only moves
 * the bar keeps them, so WebKit does not load the picture again.
 */
let named: string | null = null

/** The listener that hears what the system does to the carrier. */
let systemHeard: ((action: 'play' | 'pause') => void) | null = null
let listening: object | null = null

/** Whether the carrier holds the playback session, and who hears it change. */
let holding = false
let holdingHeard: ((holding: boolean) => void) | null = null

function hold(next: boolean): void {
  if (next === holding) return
  holding = next
  holdingHeard?.(next)
}

const now = (): number => options.now?.() ?? performance.now()

/** Whether this WebView has the Media Session API (iOS 15 and later). */
export function webKitNowPlayingAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'mediaSession' in navigator &&
    typeof MediaMetadata === 'function'
  )
}

/**
 * The carrier paused while the song plays. This module says 'paused' or
 * 'none' before it pauses, so this pause is the system's: another app took
 * the sound, or a call came in. The song pauses with it and waits for play.
 *
 * WebKit fires the event a task after the pause. A carrier playing again by
 * then makes it stale: the song paused and played again in between.
 */
function onCarrierPause(): void {
  if (wanted !== 'playing' || carrier?.paused !== true) return
  console.info('[now playing] the system paused the song')
  systemHeard?.('pause')
}

/**
 * The carrier playing while the song is paused: WebKit resuming it after an
 * interruption that ended with the system's word to resume. Stale, as a
 * pause can be, once the carrier is paused again.
 */
function onCarrierPlay(): void {
  if (wanted !== 'paused' || carrier?.paused !== false) return
  console.info('[now playing] the system resumed the song')
  systemHeard?.('play')
}

/**
 * The carrier sounding: from here it holds the playback session, and the
 * unlock clip can stand aside. Not before: muted while the carrier was still
 * loading, the clip would leave the session nothing audible, and WebKit
 * would make it mixable under the song for that moment.
 */
function onCarrierPlaying(): void {
  if (carrier?.hasAttribute('src') === true) hold(true)
}

/**
 * The carrier going round. WebKit answers every seek of the element, a loop
 * included, by moving the session's place to the element's own
 * (MediaElementSession::clientCharacteristicsChanged), which would send the
 * lock screen's bar back to 0:00 every few seconds. The song's place goes
 * straight back.
 */
function onCarrierRound(): void {
  placeBar(placeNow())
}

function theCarrier(): Carrier {
  if (carrier !== null) return carrier
  const made = options.createCarrier?.() ?? document.createElement('audio')
  made.loop = true
  made.preload = 'auto'
  // Silence is of no use to an AirPlay speaker on its own.
  made.disableRemotePlayback = true
  made.addEventListener('pause', onCarrierPause)
  made.addEventListener('play', onCarrierPlay)
  made.addEventListener('playing', onCarrierPlaying)
  made.addEventListener('seeked', onCarrierRound)
  carrier = made
  return made
}

/**
 * Refused (a call in progress) or cut short by a pause, the carrier stays
 * paused and the song plays on. The next report tries again, and so does a
 * press of play (see `listenOnWebKit`).
 */
function playCarrier(element: Carrier): void {
  void element.play().catch((error: unknown) => {
    console.info(
      '[now playing] the carrier would not play:',
      error instanceof Error ? error.name : String(error),
    )
  })
}

function silence(): string {
  silenceUrl ??=
    options.silence?.() ??
    URL.createObjectURL(
      new Blob([silentWav(CARRIER_SECONDS, CARRIER_SAMPLE_RATE)], {
        type: 'audio/wav',
      }),
    )
  return silenceUrl
}

/** Where the song is now: the last report, run on at its speed. */
function placeNow(): number {
  if (shown === null) return 0
  const ran = shown.playing ? ((now() - shownAt) / 1000) * shown.rate : 0
  return Math.min(shown.duration, Math.max(0, shown.position + ran))
}

/** The lock screen's bar: the song's length, a place in it, its speed. */
function placeBar(position: number): void {
  if (shown === null) return
  try {
    navigator.mediaSession.setPositionState({
      duration: shown.duration,
      playbackRate: shown.rate,
      position: Math.min(shown.duration, Math.max(0, position)),
    })
  } catch {
    // A state WebKit will not take: the bar waits for the next report.
  }
}

/** Nothing playing: no name, no bar, and no carrier, so no Now Playing. */
function putAway(session: MediaSession): void {
  wanted = 'none'
  shown = null
  named = null
  session.metadata = null
  session.playbackState = 'none'
  try {
    session.setPositionState()
  } catch {
    // Nothing to clear.
  }
  if (carrier === null || !carrier.hasAttribute('src')) return
  // An element with no source is no session: WebKit takes the song off the
  // lock screen.
  carrier.pause()
  carrier.removeAttribute('src')
  carrier.load()
  hold(false)
}

/**
 * Show a song on the lock screen, playing or paused, or put it away with
 * null. Due on play, pause, a jump or a new length, never per frame: WebKit
 * runs the bar on by itself from the last report.
 *
 * A song that has never played shows nothing yet: the carrier qualifies
 * only once it has played. A paused one stays, with its play button.
 */
export function showOnWebKit(song: WebKitSong | null): void {
  const session = navigator.mediaSession
  if (song === null) {
    putAway(session)
    return
  }
  const name = JSON.stringify([song.title, song.artist, song.artwork])
  if (name !== named) {
    try {
      session.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        artwork: song.artwork === null ? [] : [{ src: song.artwork }],
      })
      named = name
    } catch (error) {
      // A picture WebKit cannot read the address of: the carrier still
      // follows the song, and the next report names it again.
      console.info(
        '[now playing] WebKit would not take the name:',
        error instanceof Error ? error.name : String(error),
      )
    }
  }
  shown = song
  shownAt = now()
  // Before the carrier moves, so its events are read against this report.
  wanted = song.playing ? 'playing' : 'paused'
  session.playbackState = wanted
  placeBar(song.position)
  const element = theCarrier()
  if (!song.playing) {
    // Never a carrier the system has paused already: pausing it again tells
    // WebKit not to resume it when the call ends.
    if (!element.paused) element.pause()
    return
  }
  if (!element.hasAttribute('src')) element.src = silence()
  if (element.paused) playCarrier(element)
}

/**
 * Hear the lock screen's buttons, Control Center's and a headset's, and what
 * the system does to the carrier, all through `deliver`. A button WebKit
 * does not know is skipped; the others still register. The unsubscribe
 * clears what this call registered, unless a newer listener has taken over.
 *
 * Play pressed while the song plays and the carrier does not (its play was
 * refused) plays the carrier again. The lock screen shows that song paused,
 * and the room, already playing, has nothing new to report.
 */
export function listenOnWebKit(
  actions: readonly WebKitAction[],
  deliver: (action: WebKitAction, details: WebKitActionDetails) => void,
): () => void {
  const session = navigator.mediaSession
  const registered: WebKitAction[] = []
  for (const action of actions) {
    try {
      session.setActionHandler(action, (details) => {
        if (
          action === 'play' &&
          wanted === 'playing' &&
          carrier?.paused === true
        ) {
          playCarrier(carrier)
        }
        deliver(action, details)
      })
      registered.push(action)
    } catch {
      // This WebView has no such button.
    }
  }
  const self = {}
  listening = self
  systemHeard = (action) => {
    deliver(action, {})
  }
  return () => {
    if (listening !== self) return
    listening = null
    systemHeard = null
    for (const action of registered) {
      try {
        session.setActionHandler(action, null)
      } catch {
        // Gone with the session; nothing to clear.
      }
    }
  }
}

/**
 * Hear the carrier take the playback session (true), once it first sounds
 * for a song, and give it back (false), when the song is put away. A
 * listener that comes while it holds hears true at once. One listener: a
 * newer one takes over.
 */
export function onCarrierHolding(
  listener: (holding: boolean) => void,
): () => void {
  holdingHeard = listener
  if (holding) listener(true)
  return () => {
    if (holdingHeard === listener) holdingHeard = null
  }
}

/**
 * Forgets the carrier and every report, and sets how the next carrier is
 * made. Tests only.
 */
export function resetWebKitNowPlaying(
  next: WebKitNowPlayingOptions = {},
): void {
  options = next
  carrier = null
  silenceUrl = null
  wanted = 'none'
  shown = null
  shownAt = 0
  named = null
  systemHeard = null
  listening = null
  holding = false
  holdingHeard = null
}
