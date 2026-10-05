// ============================================================
// Platform sibling — thin device wrappers that no-op on the web
// ============================================================
//
// One import surface for the handful of things a phone can do and a browser
// tab cannot: a tap you can feel, a screen that stays lit, a status bar that
// reads against the page behind it, the system share sheet, the app's own row
// in Settings, the Android back button, the app going away and coming back,
// and the picture-in-picture window (picture-in-picture.ts, re-exported
// here).
//
// THE RULE THAT SHAPES EVERY FUNCTION BELOW. A plugin module is reached only
// from inside a `Capacitor.isNativePlatform()` branch, through `await
// import()`. Nothing here is imported at module scope, so:
//
//   - A browser build never evaluates a plugin. The dynamic imports become
//     their own chunks and the guard means the chunk is never fetched, so the
//     web bundle carries no plugin registration code.
//   - An app that installs only some of these still builds and still runs.
//     This is hazard 3 from the native plan: `./capacitor` composes every
//     capability at once and statically imports all four of its plugins, so
//     an app that installs three of them ships a module it cannot honour.
//     These wrappers make the opposite promise — call any of them from any
//     app, and one whose native half is absent reports that rather than
//     throwing through the bridge.
//
// Every call is wrapped so a missing native implementation degrades instead
// of rejecting: Capacitor answers an unregistered plugin with an
// `Unimplemented` exception, and a haptic tap is never worth an unhandled
// rejection. Where the caller genuinely needs to know — the share sheet and
// the Settings row, which must not silently do nothing (plan task G3) — the
// wrapper returns a boolean instead of swallowing the answer.
//
// What does NOT belong here: policy. `keepAwake(true)` is a single switch on
// purpose; the reference counting and the `visibilitychange` re-acquire that
// plan task G1 calls for live in the app's platform seam, where the app knows
// how many rooms are open. This file only knows how to reach the device.

import type { MediaSessionPlugin, MetadataOptions, } from '@capgo/capacitor-media-session'
import { artworkDataUrl } from './artwork-data'
import type { Unsubscribe } from './native-calls'
import { attempt, finiteOr, isIos, isNative, lazyListener, } from './native-calls'
import { listenToTheWindow, tellTheWindowTheClock } from './picture-in-picture'
import { claimCarrier, listenOnWebKit, onCarrierHolding, showOnWebKit, systemPausedTheSong, takeTheSound, webKitNowPlayingAvailable, } from './webkit-now-playing'

export type { Unsubscribe } from './native-calls'
export type { PictureInPictureLyrics } from './picture-in-picture'
export {
  onPictureInPicture,
  pictureInPictureNeedsLyrics,
  setPictureInPictureAutoEnter,
  setPictureInPictureLyrics,
} from './picture-in-picture'

/**
 * Which way the status bar's own text should read. The names are the
 * plugin's, deliberately: `'light'` is the LIGHT bar (dark text, for a light
 * page) and `'dark'` is the DARK bar (light text, for a dark page). Inventing
 * an inversion here would mean two vocabularies for one switch.
 */
export type StatusBarStyle = 'light' | 'dark'

/** Foreground or not. Everything else the OS distinguishes is not ours. */
export type AppLifecycleState = 'active' | 'background'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
  /** `file://` URLs. iOS and Android only; the web share sheet ignores them. */
  files?: readonly string[]
}

export interface BackButtonEvent {
  /** What the WebView thinks: true when its own history can go back. */
  readonly canGoBack: boolean
}

export type BackButtonHandler = (event: BackButtonEvent) => void

export type AppLifecycleHandler = (state: AppLifecycleState) => void

// ------------------------------------------------------------
// Haptics
// ------------------------------------------------------------
//
// Three named moments rather than the plugin's full palette. A product that
// needs to pick an impact style is describing physics; these describe events,
// which is what a UI actually knows.

/** The confirmation under a press. The smallest one the device has. */
export async function hapticTap(): Promise<void> {
  await attempt(async () => {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  })
}

/** Something completed: a take saved, a streak kept. */
export async function hapticSuccess(): Promise<void> {
  await attempt(async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  })
}

/** Something needs attention before it can continue — not a failure. */
export async function hapticWarning(): Promise<void> {
  await attempt(async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Warning })
  })
}

// ------------------------------------------------------------
// Screen, status bar, keyboard
// ------------------------------------------------------------

/**
 * Hold the screen awake, or let it sleep again.
 *
 * One switch, no counting: see the header. A singing room that dims the
 * screen mid-phrase is the bug this exists for, and the browser's answer is
 * nothing at all — a Wake Lock needs its own permission story and belongs in
 * the web app's own seam, not in a native wrapper's fallback.
 */
export async function keepAwake(on: boolean): Promise<void> {
  await attempt(async () => {
    const { KeepAwake } = await import('@capacitor-community/keep-awake')
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
  })
}

/**
 * Point the status bar's text at the page behind it.
 *
 * Only the style. The splash and the bar's initial appearance are native
 * resources (plan task G4) precisely so the first frame does not depend on
 * JavaScript having run; this is the runtime switch for a screen that changes
 * its own background afterwards.
 */
export async function setStatusBar(style: StatusBarStyle): Promise<void> {
  await attempt(async () => {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({
      style: style === 'dark' ? Style.Dark : Style.Light,
    })
  })
}

// ------------------------------------------------------------
// What is playing, and the system's media buttons
// ------------------------------------------------------------
//
// A song that keeps playing behind another app needs the system to know about
// it. On Android that is not optional: a backgrounded app with no foreground
// service is frozen within seconds, WebView and song with it, and the media
// session plugin is what runs one (type mediaPlayback) while a song is playing
// or paused, with its notification and its play and pause buttons. On iOS the
// audio background mode keeps the app going by itself, and the lock screen's
// Now Playing has to come from WebKit, whose session plays the song: the
// plugin's MPNowPlayingInfoCenter belongs to the app's own process and never
// shows (see webkit-now-playing.ts). The plugin is Android's alone.

/** A song the system's media controls can name. */
export interface NowPlaying {
  readonly title: string
  readonly artist?: string
  /**
   * The picture the system shows with the song, by a URL the app can fetch:
   * behind it in Android's media player, beside it on the lock screen.
   */
  readonly artwork?: string
  readonly playing: boolean
  /** Seconds into the song. Absent reads as the start. */
  readonly position?: number
  /** The song's length in seconds. Absent or 0 while it is not known. */
  readonly duration?: number
  /** How fast it plays while playing: 1 is as written. Absent reads as 1. */
  readonly rate?: number
  /**
   * iOS: paused because the system took the sound (another app, a call),
   * not by a press. The lock screen's carrier is left as the system left it,
   * so a call that ends with the word to resume brings the song back.
   */
  readonly interrupted?: boolean
}

/**
 * The system's progress bar let go at a place in the song: the notification's
 * and the shade's on Android, the lock screen's on both.
 */
export interface MediaSeek {
  /** Seconds into the song, as the platform reported them: not clamped. */
  readonly seekTo: number
}

/**
 * iOS: the lock screen's skip back or forward, which it draws as 10 s, from
 * wherever the song is now. Negative goes back.
 */
export interface MediaSkip {
  readonly skipBy: number
}

/**
 * What the system's media controls ask of a song: a button (the
 * notification, the lock screen, a headset), a seek, or a skip.
 */
export type MediaAction = 'play' | 'pause' | 'stop' | MediaSeek | MediaSkip

/**
 * What is registered, in the plugin's names, which are the Media Session
 * API's too: the three buttons, and the bar. Registering 'seekto' is what
 * lets the bar be dragged: Android adds ACTION_SEEK_TO to the session's
 * actions for it, and on iOS WebKit hands the bar to the handler instead of
 * seeking the carrier.
 */
const MEDIA_ACTIONS = ['play', 'pause', 'stop', 'seekto'] as const

/**
 * iOS adds the skips its lock screen and Control Center already draw.
 * Unregistered, WebKit hands them to the carrier, which skips its own
 * silence and leaves the song where it was. Android leaves them out: its
 * notification would grow two buttons nobody asked for.
 */
const WEBKIT_ACTIONS = [
  ...MEDIA_ACTIONS,
  'seekbackward',
  'seekforward',
] as const

type RegisteredAction = (typeof WEBKIT_ACTIONS)[number]

/** How far a skip goes when the press does not say: the lock screen's 10 s. */
const SKIP_SECONDS = 10

/** What a platform reports with an action: its name, a seek's target, a skip's length. */
interface ActionDetails {
  readonly action?: unknown
  readonly seekTime?: unknown
  readonly seekOffset?: unknown
}

/**
 * An action as the handler hears it. A seek carries where the bar was let go
 * (`seekTime`, in seconds on both platforms), and one with no usable place
 * in it is no seek at all. A skip carries how far (`seekOffset`), or goes
 * the lock screen's 10 s.
 */
function heard(
  action: RegisteredAction,
  details: ActionDetails | null | undefined,
): MediaAction | null {
  if (action === 'seekbackward' || action === 'seekforward') {
    const offset = details?.seekOffset
    const seconds =
      typeof offset === 'number' && Number.isFinite(offset) && offset > 0
        ? offset
        : SKIP_SECONDS
    return { skipBy: action === 'seekforward' ? seconds : -seconds }
  }
  if (action !== 'seekto') return action
  const seconds = details?.seekTime
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? { seekTo: seconds }
    : null
}

/** The progress bar's numbers, in the plugin's own shape. */
interface PositionState {
  readonly duration: number
  readonly position: number
  readonly playbackRate: number
}

/** An empty bar: no length, nothing played, standing still. */
const NO_POSITION: PositionState = { duration: 0, position: 0, playbackRate: 0 }

/**
 * The progress bar for a song, as the plugin takes it. A paused song gets
 * rate 0, which the plugin's iOS half needed to stop its clock; Android keeps
 * a paused state still whatever the rate, and reads 0 as 1.
 */
function positionOf(song: NowPlaying): PositionState {
  const duration = Math.max(0, finiteOr(song.duration, 0))
  const position = Math.min(duration, Math.max(0, finiteOr(song.position, 0)))
  const rate = finiteOr(song.rate, 1)
  return {
    duration,
    position,
    playbackRate: song.playing ? (rate > 0 ? rate : 1) : 0,
  }
}

/** The last report asked for; the next one starts once it is done. */
let reportsInFlight: Promise<void> = Promise.resolve()

/**
 * Tell the system what is playing, or null when nothing is.
 *
 * On iOS that goes to WebKit's own Now Playing (`showThroughWebKit`). On
 * Android it goes to the plugin, where null is 'none', which stops the
 * foreground service and takes its notification away. The metadata goes
 * before the state, so the service's first notification already names the
 * song.
 *
 * Android draws the notification's bar from the position (the length reaches
 * the session's metadata through this call, not through setMetadata) and runs
 * the bar on from the last report at the rate given, so a report is due on
 * play, pause, a seek or a new length, never on a frame. WebKit runs the lock
 * screen's bar the same way.
 *
 * The position goes first and last. The plugin keeps the last one it was
 * given and shows it again, stamped now, whenever it publishes: Android on a
 * new state. Written after the state, a pause showed the bar for a frame at
 * the last report's place (where the song started or last jumped to). The
 * last write was for the plugin's iOS half, which needed it to keep a slowed
 * song's rate and no longer runs; on Android it repeats the first.
 *
 * Null empties the bar as well, because Android keeps the numbers across a
 * stopped session and shows them in the next one's notification.
 *
 * One report at a time, in the order they were made: each waits for the
 * song's picture to be read, and on Android for the plugin's answers, so a
 * pause reported just before a play could otherwise land last.
 */
export async function setNowPlaying(song: NowPlaying | null): Promise<void> {
  const report = reportsInFlight.then(async () => writeNowPlaying(song))
  reportsInFlight = report.catch(() => undefined)
  await report
}

/**
 * The song's name and artist, and its picture when it has one that could be
 * read. The artist always goes, empty for a song without one: the plugin
 * keeps any field a report leaves out, so the last song's would stay on.
 */
async function metadataOf(song: NowPlaying): Promise<MetadataOptions> {
  const artwork =
    song.artwork === undefined ? null : await artworkDataUrl(song.artwork)
  return {
    title: song.title,
    artist: song.artist ?? '',
    ...(artwork === null ? {} : { artwork: [{ src: artwork }] }),
  }
}

async function writeNowPlaying(song: NowPlaying | null): Promise<void> {
  if (isIos()) {
    if (song !== null) {
      // The room hears the system's pause of the carrier as a press, so its
      // report may not say it was the system's.
      tellTheWindowTheClock({
        ...song,
        interrupted: song.interrupted === true || systemPausedTheSong(),
      })
    }
    await showThroughWebKit(song)
    return
  }
  await attempt(async () => {
    const { MediaSession } = await import('@capgo/capacitor-media-session')
    if (song === null) {
      await MediaSession.setPlaybackState({ playbackState: 'none' })
      await MediaSession.setPositionState(NO_POSITION)
      return
    }
    const metadata = await metadataOf(song)
    const position = positionOf(song)
    try {
      await MediaSession.setPositionState(position)
    } catch {
      // A plugin with no position must still name the song. The last write
      // fails the same way and ends the report there.
    }
    await MediaSession.setMetadata(metadata)
    await MediaSession.setPlaybackState({
      playbackState: song.playing ? 'playing' : 'paused',
    })
    await MediaSession.setPositionState(position)
  })
}

/**
 * iOS: the song on the lock screen through WebKit (see webkit-now-playing.ts),
 * named and placed as the plugin's reports are. WebKit refuses a rate of 0,
 * so a paused song keeps its speed and the paused state stops the bar. A
 * WebView without the Media Session API shows nothing, as the plugin did.
 */
async function showThroughWebKit(song: NowPlaying | null): Promise<void> {
  if (!webKitNowPlayingAvailable()) return
  if (song === null) {
    showOnWebKit(null)
    return
  }
  const artwork =
    song.artwork === undefined ? null : await artworkDataUrl(song.artwork)
  const duration = Math.max(0, finiteOr(song.duration, 0))
  const rate = finiteOr(song.rate, 1)
  showOnWebKit({
    title: song.title,
    artist: song.artist ?? '',
    artwork,
    playing: song.playing,
    position: Math.min(duration, Math.max(0, finiteOr(song.position, 0))),
    duration,
    rate: rate > 0 ? rate : 1,
    interrupted: song.interrupted === true,
  })
}

/**
 * The system's media buttons and its progress bar, all through one handler.
 * The unsubscribe clears the handlers again, so a room that is gone is never
 * asked to play.
 *
 * Each action is registered on its own: a platform that refuses one must not
 * leave the others unregistered or uncleared. Android answers through the
 * handler given here. On iOS the buttons reach WebKit's media session
 * instead, and with them the system pausing the song for another app or a
 * call (see webkit-now-playing.ts); the lyrics window's play and pause come
 * from the app's own plugin. A play from either takes the sound before the
 * handler hears it, and one that cannot is never heard: the song stays
 * paused rather than play in silence under another app (`takeTheSound`).
 */
export function onMediaAction(
  handler: (action: MediaAction) => void,
): Unsubscribe {
  if (!isNative()) return () => undefined

  const deliver = (
    action: RegisteredAction,
    details: ActionDetails | null | undefined,
  ): void => {
    const asked = heard(action, details)
    if (asked !== null) handler(asked)
  }

  if (isIos()) {
    const withWebKit = webKitNowPlayingAvailable()
    const fromWebKit = withWebKit
      ? listenOnWebKit(WEBKIT_ACTIONS, deliver)
      : () => undefined
    const fromTheWindow = listenToTheWindow((action, press) => {
      if (
        action === 'play' &&
        withWebKit &&
        !takeTheSound({ otherAudio: press.otherAudio })
      ) {
        return
      }
      handler(action)
    })
    return () => {
      fromWebKit()
      fromTheWindow()
    }
  }

  return lazyListener((dispose) => {
    void (async () => {
      let session: MediaSessionPlugin
      try {
        session = (await import('@capgo/capacitor-media-session')).MediaSession
      } catch {
        // No media-session plugin in this build: the system's buttons do
        // nothing, as they always did.
        return
      }
      const registered: RegisteredAction[] = []
      for (const action of MEDIA_ACTIONS) {
        try {
          await session.setActionHandler({ action }, (details) => {
            deliver(action, details)
          })
          registered.push(action)
        } catch {
          // This platform has no such button.
        }
      }
      dispose({
        remove: async () => {
          for (const action of registered) {
            // Android hands back a callback id here, not a promise: await
            // it, never chain on it.
            try {
              await session.setActionHandler({ action }, null)
            } catch {
              // Gone with the plugin; nothing left to clear.
            }
          }
        },
      })
    })()
  })
}

/**
 * iOS: hears WebKit's lock-screen carrier take the playback session (true)
 * and give it back (false), so the app's own unlock clip can stand aside
 * meanwhile (see webkit-now-playing.ts). Nothing on Android or the web.
 */
export function onNowPlayingHoldsAudio(
  listener: (holds: boolean) => void,
): Unsubscribe {
  if (!isIos() || !webKitNowPlayingAvailable()) return () => undefined
  return onCarrierHolding(listener)
}

/**
 * iOS: a press of play is about to start the song on the lock screen. Its
 * carrier plays now, from inside the press, ahead of the song's clock (see
 * webkit-now-playing.ts, `claimCarrier`). Nothing on Android or the web.
 */
export function claimNowPlaying(): void {
  if (!isIos() || !webKitNowPlayingAvailable()) return
  claimCarrier()
}

/**
 * Whether the microphone coming on takes the sound from another app, as a
 * song starting does: on iOS, where WebKit's session for recording never
 * mixes. Android's microphone leaves another app's sound alone.
 */
export function micStopsOtherApps(): boolean {
  return isIos()
}

/**
 * Dismiss the software keyboard, on a phone only.
 *
 * The name says `NativeOnly` because a browser has no such control and a
 * caller that expected one would be waiting for something that cannot happen:
 * blurring the focused element is the web's answer, and that is the caller's
 * decision, not this wrapper's.
 */
export async function hideKeyboardOnNativeOnly(): Promise<void> {
  await attempt(async () => {
    const { Keyboard } = await import('@capacitor/keyboard')
    await Keyboard.hide()
  })
}

// ------------------------------------------------------------
// Share and Settings
// ------------------------------------------------------------

/**
 * Whether a rejection is a person dismissing the sheet rather than a failure
 * to present one.
 *
 * Both native halves answer a dismissal by REJECTING, and both with the same
 * words: `SharePlugin.swift` calls `call.reject('Share canceled')` when the
 * activity controller reports the share was not completed, and
 * `SharePlugin.java` does the same on `Activity.RESULT_CANCELED`. A
 * rejection is therefore not evidence of anything on its own — the message
 * is the only thing separating the two outcomes, so the message is what is
 * read. Everything else the plugin can reject with (`Unimplemented`, 'Must
 * provide at least url, text or files', 'Can't share while sharing is in
 * progress') is a genuine failure and stays one.
 */
function readsAsCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel/i.test(message)
}

/**
 * Hand a payload to the system share sheet.
 *
 * Returns false when no sheet was presented — on the web, or when the plugin
 * is not installed, or when the platform refused. A share that silently does
 * nothing is the failure plan task G3 names, so the answer is returned rather
 * than swallowed and the caller keeps its own fallback.
 *
 * A cancelled sheet counts as presented and answers TRUE. That is why this
 * one call cannot go through `attempt()`: a dismissal reaches us as a
 * rejection like any other, and mapping every rejection to false would send
 * the caller down the fallback the person just declined.
 */
export async function sharePayload(payload: SharePayload): Promise<boolean> {
  if (!isNative()) return false

  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      ...(payload.title === undefined ? {} : { title: payload.title }),
      ...(payload.text === undefined ? {} : { text: payload.text }),
      ...(payload.url === undefined ? {} : { url: payload.url }),
      ...(payload.files === undefined ? {} : { files: [...payload.files] }),
    })
    return true
  } catch (error) {
    return readsAsCancellation(error)
  }
}

/**
 * Open this app's own page in the system Settings.
 *
 * The one screen a mic-denied state can send someone to: once a permission
 * has been refused, neither platform will prompt again, and the only way back
 * is the app's own row in Settings. Returns false when that could not be
 * reached, so the screen can fall back to telling the person the path.
 */
export async function openAppSettings(): Promise<boolean> {
  return attempt(async () => {
    const { AndroidSettings, IOSSettings, NativeSettings } =
      await import('capacitor-native-settings')
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      // The only settings screen Apple supports opening. Any other is a
      // review risk, and this is the only one the mic-denied state needs.
      optionIOS: IOSSettings.App,
    })
  })
}

/**
 * Android's hardware back button.
 *
 * Registering one of these turns off Capacitor's own default, which is to
 * exit the app — so a handler that does nothing strands the user. iOS has no
 * such button and the browser has the gesture instead, so on both this is a
 * no-op and the returned unsubscribe is inert.
 */
export function onBackButton(handler: BackButtonHandler): Unsubscribe {
  if (!isNative()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        dispose(
          await App.addListener('backButton', (event) => {
            handler({ canGoBack: event.canGoBack })
          }),
        )
      } catch {
        // No @capacitor/app in this build. The platform's own back handling
        // stays in charge, which is the safe half of this trade.
      }
    })()
  })
}

/**
 * The app leaving the foreground and coming back.
 *
 * This is NOT `visibilitychange`. A WebView's visibility event is the browser
 * answering a question about the document; `appStateChange` is the OS
 * answering one about the app, and the two disagree exactly where it matters
 * — a call arriving, the app switcher, a screen lock. The browser has only
 * the first, so on the web this is a no-op and whatever needs the document's
 * visibility listens for it directly.
 */
export function onAppState(handler: AppLifecycleHandler): Unsubscribe {
  if (!isNative()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        dispose(
          await App.addListener('appStateChange', (state) => {
            handler(state.isActive ? 'active' : 'background')
          }),
        )
      } catch {
        // No @capacitor/app in this build; nothing will be reported.
      }
    })()
  })
}

// ------------------------------------------------------------
// Leaving the app
// ------------------------------------------------------------

/**
 * Put the app in the background, as the back button does from a home screen.
 *
 * One call, with no second attempt behind it, because there is no platform a
 * second attempt could help. Android's `minimizeApp` is `moveTaskToBack(true)`
 * and is always available — and Android is the only platform that fires the
 * back button this exists to answer. iOS has no such call at all: an app may
 * not send itself to the background, Apple rejects builds that try, and the
 * plugin's iOS half answers `minimizeApp` with `unimplemented()` — as it does
 * `exitApp`, so falling through to that would only trade one refusal for
 * another. A refusal is reported rather than thrown: the caller is usually a
 * back handler, which then simply leaves the screen as it is.
 */
export async function minimizeApp(): Promise<boolean> {
  return attempt(async () => {
    const { App } = await import('@capacitor/app')
    await App.minimizeApp()
  })
}
