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
// with it. A call that ends with the system's word to resume, while the app
// is in front, plays the carrier again, and the song comes back with it.
// WebKit resumes only an element nothing paused during the call, so a
// carrier that is already paused is left alone.
//
// WebKit also suspends a paused carrier while the app is away, and may play
// it again as the app comes back, after a call that ended meanwhile, or when
// the lock screen played and paused the song in between. The song never
// follows a play like that (`onCarrierPlay`): it would start out loud as the
// phone is unlocked.
//
// While the carrier holds the session, the unlock clip stands aside
// (`onCarrierHolding`). WebKit shows on the lock screen whichever element a
// tap played last, sends a headset's press to whichever started last, and,
// once the app is on the lock screen, offers even that 0.1 s clip, which
// would keep the app there after the song has gone. A press of play then has
// the carrier take the session in the clip's place, ahead of the song's
// clock (`claimCarrier`).
//
// While the app is in front, WebKit keeps Now Playing out of Control Center
// (`allowsNowPlayingControlsVisibility` is false for a visible page). The
// lock screen, and Control Center over another app, show it.
//
// A paused song lets the app sleep, and iOS suspends it a while later. The
// lock screen still shows the song, but a press there waits until the app
// next runs, and arrives then with any others, as the app comes back to the
// front. A press that waited like that is dropped (waited-presses.ts): it
// would start the song, or move it, long after it was pressed.
//
// WebKit lets the lock screen move the song only while the carrier is the
// sound that started last, and the song's clock starts after it. A carrier
// that plays is played again to stay in front (carrier-in-front.ts).

import type { InFrontHost } from './carrier-in-front'
import { keepInFront } from './carrier-in-front'
import type { SilenceKind } from './carrier-silence'
import { silenceBlob } from './carrier-silence'
import { watchTheSamePlace } from './same-place-twice'
import type { PressGuardHost } from './waited-presses'
import { guardPresses } from './waited-presses'

/** The buttons the room answers, in the Media Session API's names. */
export type WebKitAction =
  | 'play'
  | 'pause'
  | 'stop'
  | 'seekto'
  | 'seekbackward'
  | 'seekforward'

/** What a press carries: a seek's place, or a skip's length, in seconds. */
export interface WebKitActionDetails {
  readonly seekTime?: unknown
  readonly seekOffset?: unknown
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
  /**
   * Paused because the system took the sound (another app, a call), not by
   * a press. A carrier the system paused with it is left as it is.
   */
  readonly interrupted?: boolean
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
  | 'canPlayType'
  | 'hasAttribute'
  | 'removeAttribute'
  | 'addEventListener'
>

/** The part of the document the carrier watches: whether the app shows. */
export type Page = Pick<Document, 'visibilityState' | 'addEventListener'>

export interface WebKitNowPlayingOptions {
  /** Test seam. Production watches the document. */
  readonly page?: Page
  /** Test seam. Production makes a detached `<audio>` element. */
  readonly createCarrier?: () => Carrier
  /** Test seam. Production makes a blob: URL of generated silence. */
  readonly silence?: (kind: SilenceKind) => string
  /** Test seam. Production reads `performance.now()`. */
  readonly now?: () => number
}

let options: WebKitNowPlayingOptions = {}
let carrier: Carrier | null = null
const silenceUrls = new Map<SilenceKind, string>()

/**
 * Which silence the carrier has: long once it is known the WebView plays
 * it, and short for good once it would not load (`onCarrierError`).
 */
let carrierKind: SilenceKind = 'short'
let longRefused = false

/**
 * What the song last asked of the carrier. The carrier's own pause and play
 * events are read against it: one the song did not ask for is the system's.
 */
let wanted: 'none' | 'paused' | 'playing' = 'none'

/** The last report, and when it came: where the bar goes back to. */
let shown: WebKitSong | null = null
let shownAt = 0
/** Where the bar was last put: a repeat of it goes a hair on. */
const lastPlace = watchTheSamePlace()

/**
 * The name, artist and picture last handed over. A report that only moves
 * the bar keeps them, so WebKit does not load the picture again.
 */
let named: string | null = null

/** The listener that hears what the system does to the carrier. */
let systemHeard: ((action: 'play' | 'pause') => void) | null = null
let listening: object | null = null

/**
 * Whether the last pause of the carrier was the system's, and the song was
 * told so. Only that pause may be undone by the system playing it again.
 */
let systemPaused = false

/**
 * How long after the app shows a play of the carrier counts as coming with
 * it: WebKit queues that play beside the visibility event, in no set order.
 */
const SHOWING_MS = 1000

/** What the page last said of itself, and when it last came to the front. */
let pageSeen: DocumentVisibilityState = 'visible'
let pageShownAt = Number.NEGATIVE_INFINITY

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
  systemPaused = true
  systemHeard?.('pause')
}

/**
 * The carrier playing while the song is paused. WebKit resuming it after an
 * interruption that ended with the system's word to resume plays the song
 * again too, but only when the system's own pause stopped it, and not as the
 * app comes back: WebKit plays a carrier it suspended for the app being away
 * then, whatever paused the song. Any other play is put back, so the lock
 * screen keeps showing the song paused. Stale, as a pause can be, once the
 * carrier is paused again.
 */
function onCarrierPlay(): void {
  const element = carrier
  if (wanted !== 'paused' || element?.paused !== false) return
  if (systemPaused && !pageJustShown()) {
    systemPaused = false
    console.info('[now playing] the system resumed the song')
    systemHeard?.('play')
    return
  }
  console.info('[now playing] WebKit played the carrier; the song stays paused')
  element.pause()
}

function thePage(): Page | null {
  return options.page ?? (typeof document === 'undefined' ? null : document)
}

/** Follow the app going away and coming back. Once, with the first carrier. */
function watchThePage(): void {
  const page = thePage()
  if (page === null) return
  pageSeen = page.visibilityState
  page.addEventListener('visibilitychange', () => {
    if (page.visibilityState === 'visible' && pageSeen !== 'visible') {
      pageShownAt = now()
    }
    pageSeen = page.visibilityState
    presses.follow()
    // Hiding is when the lock screen and Control Center can show the song;
    // coming back is when the song's clock is cycled (audio-unlock). The
    // clock's resume behind the app reports again (carrier-in-front.ts).
    front.now()
  })
}

// Presses that waited while the app slept (waited-presses.ts).
const pressHost: PressGuardHost = {
  hidden: () => thePage()?.visibilityState === 'hidden',
  songShown: () => shown !== null,
}
let presses = guardPresses(pressHost)

// The carrier ahead of the song's clock, so the bar and skips work
// (carrier-in-front.ts).
const frontHost: InFrontHost = {
  playingCarrier: () =>
    carrier !== null &&
    wanted === 'playing' &&
    !systemPaused &&
    !carrier.paused &&
    carrier.hasAttribute('src')
      ? carrier
      : null,
}
let front = keepInFront(frontHost)

type Deliver = (action: WebKitAction, details: WebKitActionDetails) => void

/**
 * Play takes the sound first (`takeTheSound`), and stays unheard when the
 * sound stays with another app: the song does not start in silence.
 */
function carryOut(
  action: WebKitAction,
  details: WebKitActionDetails,
  deliver: Deliver,
): void {
  if (action === 'play' && !takeTheSound()) return
  deliver(action, details)
}

/**
 * Whether the app is coming to the front: shown already with its event
 * still to come, or shown a moment ago.
 */
function pageJustShown(): boolean {
  const page = thePage()
  if (page === null) return false
  if (page.visibilityState === 'visible' && pageSeen !== 'visible') return true
  return now() - pageShownAt < SHOWING_MS
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
 * (MediaElementSession::clientCharacteristicsChanged), and tells the lock
 * screen so before this puts the song's place back. Most of the time the
 * second word lands; now and then the lock screen keeps the first, and its
 * bar runs on from 0:00 while the song plays where it is. The long carrier
 * goes round once an hour of singing, the short one every four seconds.
 */
function onCarrierRound(): void {
  placeBar(placeNow())
}

/**
 * A carrier this WebView would not load: the long silence gives way to the
 * short one, which every WebView with a media element plays, for the rest
 * of the session, and the carrier plays on if the song does.
 */
function onCarrierError(): void {
  const element = carrier
  if (element === null || carrierKind !== 'long') return
  console.info(
    '[now playing] the long carrier would not load; the short one goes round every few seconds',
  )
  longRefused = true
  carrierKind = 'short'
  element.src = silence('short')
  if (wanted === 'playing') playCarrier(element)
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
  made.addEventListener('error', onCarrierError)
  carrier = made
  watchThePage()
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

function silence(kind: SilenceKind): string {
  const made = silenceUrls.get(kind)
  if (made !== undefined) return made
  const url = options.silence?.(kind) ?? URL.createObjectURL(silenceBlob(kind))
  silenceUrls.set(kind, url)
  return url
}

/** The silence for a carrier about to be given one: long where it can be. */
function silenceFor(element: Carrier): string {
  let flac = ''
  try {
    flac = element.canPlayType('audio/flac')
  } catch {
    // A media element that cannot say plays the short silence.
  }
  carrierKind = !longRefused && flac !== '' ? 'long' : 'short'
  return silence(carrierKind)
}

/** Where the song is now: the last report, run on at its speed. */
function placeNow(): number {
  if (shown === null) return 0
  const ran = shown.playing ? ((now() - shownAt) / 1000) * shown.rate : 0
  return Math.min(shown.duration, Math.max(0, shown.position + ran))
}

/**
 * The lock screen's bar: the song's length, a place in it, its speed. A
 * repeat of the last place goes a hair on, or iOS keeps its counter
 * running (same-place-twice.ts).
 */
function placeBar(position: number): void {
  if (shown === null) return
  const at = now()
  const placing = lastPlace.place({ ...shown, position }, at)
  try {
    navigator.mediaSession.setPositionState({
      duration: shown.duration,
      playbackRate: placing.rate,
      position: placing.position,
    })
  } catch {
    // A state WebKit will not take: the bar waits for the next report.
    return
  }
  lastPlace.took(placing, shown.playing, at)
  if (placing.repeat) {
    console.info(
      `[now playing] the bar is where it was: put on to ${placing.position.toFixed(2)} s, so the lock screen counts from there again`,
    )
  }
}

/** Nothing playing: no name, no bar, and no carrier, so no Now Playing. */
function putAway(session: MediaSession): void {
  wanted = 'none'
  systemPaused = false
  shown = null
  named = null
  lastPlace.forget()
  presses.follow()
  front.stop()
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
  console.info(
    `[now playing] bar at ${song.position.toFixed(1)} s of ${song.duration.toFixed(1)}, ${wanted}`,
  )
  const element = theCarrier()
  presses.follow()
  if (!song.playing) {
    front.stop()
    if (song.interrupted === true && element.paused) {
      // The song heard the interruption before the carrier's pause event
      // came: the pause is still the system's, and a call that ends with the
      // word to resume may still bring the song back (onCarrierPlay).
      systemPaused = true
      return
    }
    // Never a carrier the system has paused already: pausing it again tells
    // WebKit not to resume it when the call ends.
    if (!element.paused) element.pause()
    return
  }
  // The song plays by its own word now; no pause of the system's is left to undo.
  systemPaused = false
  if (!element.hasAttribute('src')) element.src = silenceFor(element)
  // Playing already, the carrier may stand behind a clock that started
  // since: WebKit would refuse the bar (carrier-in-front.ts).
  if (element.paused) playCarrier(element)
  else front.now()
}

/**
 * A press of play, before the song starts: the carrier of a song already on
 * the lock screen plays now, from inside the press, so it holds the playback
 * session before the song's clock resumes (audio-unlock's
 * `unlockForPlayback`). After another app had the sound, that order is what
 * makes WebKit activate its session for real, rather than leave the clock
 * reporting 'running' with no output (docs/plans/mobile-native/
 * ios-audio-handoff.md). A song's first play shows it through the report.
 */
export function claimCarrier(): void {
  const element = carrier
  if (element === null || !element.hasAttribute('src')) return
  // The song's own play, as the report that follows will say.
  wanted = 'playing'
  systemPaused = false
  if (!element.paused) return
  console.info('[now playing] play pressed: the carrier takes the sound first')
  playCarrier(element)
}

/** WebKit's audio session for the page (Safari 16.4), where there is one. */
interface PageAudioSession {
  type: string
  readonly state?: string
}

function pageAudioSession(): PageAudioSession | null {
  const found = (navigator as { audioSession?: PageAudioSession }).audioSession
  return found !== undefined && typeof found.type === 'string' ? found : null
}

/**
 * Ask WebKit for a playback session that does not mix, for the moment a
 * carrier starts, and hand back what puts the page's own word back.
 *
 * After another app took the sound, WebKit's session is ambient, and it
 * activates that before it changes it to playback for the carrier: ambient
 * mixes, so the other app plays on, and the silent switch mutes the song.
 * Asked for, playback is what activates, and iOS either lets the app take
 * the sound, or refuses, which leaves the carrier paused.
 * Left asked for, it would make Web Audio a Now Playing item of its own,
 * whose buttons pause the clock instead of reaching the room (see the
 * header), so it goes back at once.
 */
function askForPlayback(): (() => void) | null {
  const audioSession = pageAudioSession()
  if (audioSession === null) return null
  const before = audioSession.type
  try {
    audioSession.type = 'playback'
  } catch {
    return null
  }
  return () => {
    try {
      audioSession.type = before
    } catch {
      // Left as it is: WebKit drops it for a page that goes away.
    }
  }
}

export interface TakeTheSoundOptions {
  /** iOS's word, at the press, that another app's sound is playing. */
  readonly otherAudio?: boolean
}

/**
 * A press of play from the lock screen, Control Center, a headset or the
 * small window, before the song hears it: the carrier takes the sound
 * first, and false says another app's sound kept it, so the song stays
 * paused rather than play in silence under that app. A carrier refused
 * with no other app's sound playing lets the press go on as it always did:
 * the song plays, and the next report tries the carrier again.
 *
 * With the app behind another one whose sound plays now (the window says
 * so), the answer is no at once. iOS does not let an app in the background
 * take the sound from one that plays (AVAudioSession's
 * cannotInterruptOthers), and WebKit would not say so in time: it asks iOS
 * for the sound only once something of the page already plays
 * (PlatformMediaSessionManager::maybeActivateAudioSession). The carrier's
 * play passed unasked, the song's clock, asking next, was refused, and the
 * window ran the lyrics on in silence (build 549).
 *
 * With the app behind, and the song still paused by the system for another
 * app that has gone quiet since, the carrier asks for a session that does
 * not mix (`askForPlayback`). WebKit starts an element inside play()
 * itself, so a carrier still paused afterwards was refused.
 *
 * True with no song on the lock screen, or a carrier already playing: the
 * press goes on as it always did.
 */
export function takeTheSound(choice: TakeTheSoundOptions = {}): boolean {
  const element = carrier
  if (element === null || !element.hasAttribute('src') || !element.paused) {
    return true
  }
  const behind = thePage()?.visibilityState === 'hidden'
  if (behind && choice.otherAudio === true) {
    console.info(
      '[now playing] play pressed behind another app whose sound plays: iOS keeps the sound there, so the song stays paused',
    )
    return false
  }
  const othersPlaying = choice.otherAudio === true || systemPaused
  const wantedBefore = wanted
  const systemPausedBefore = systemPaused
  const sessionBefore = pageAudioSession()?.state
  const giveBack = behind && othersPlaying ? askForPlayback() : null
  try {
    claimCarrier()
  } finally {
    giveBack?.()
  }
  const sessionAfter = pageAudioSession()?.state
  const sessions =
    sessionBefore === undefined
      ? ''
      : ` (session ${sessionBefore}, then ${sessionAfter ?? 'unknown'})`
  if (!element.paused) {
    if (giveBack !== null) {
      console.info(
        `[now playing] play from behind the app took the sound from another app${sessions}`,
      )
    }
    return true
  }
  // Refused with no other app's sound in the way (playCarrier logs why).
  if (!othersPlaying) return true
  wanted = wantedBefore
  systemPaused = systemPausedBefore
  console.info(
    `[now playing] play pressed, but another app keeps the sound: the song stays paused${sessions}`,
  )
  return false
}

/**
 * Hear the lock screen's buttons, Control Center's and a headset's, and what
 * the system does to the carrier, all through `deliver`. A button WebKit
 * does not know is skipped; the others still register. The unsubscribe
 * clears what this call registered, unless a newer listener has taken over.
 *
 * A press that may have waited while the app slept goes through
 * the guard first (waited-presses.ts). Play takes the sound before it is heard
 * (`takeTheSound`): pressed while the song plays and the carrier does not
 * (its play was refused), it plays the carrier again, and the room, already
 * playing, has nothing new to report.
 */
export function listenOnWebKit(
  actions: readonly WebKitAction[],
  deliver: Deliver,
): () => void {
  const session = navigator.mediaSession
  const registered: WebKitAction[] = []
  for (const action of actions) {
    try {
      session.setActionHandler(action, (details) => {
        presses.hear({
          action,
          carryOut: () => {
            carryOut(action, details, deliver)
          },
        })
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
  silenceUrls.clear()
  carrierKind = 'short'
  longRefused = false
  presses.stop()
  presses = guardPresses(pressHost)
  front.stop()
  front = keepInFront(frontHost)
  wanted = 'none'
  shown = null
  shownAt = 0
  lastPlace.forget()
  named = null
  systemHeard = null
  listening = null
  holding = false
  holdingHeard = null
  systemPaused = false
  pageSeen = 'visible'
  pageShownAt = Number.NEGATIVE_INFINITY
}
