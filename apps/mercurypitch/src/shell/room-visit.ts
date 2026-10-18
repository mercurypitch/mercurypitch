// ============================================================
// Room visit: one iOS volume from a premium room's door to its way out
// ============================================================
//
// iOS keeps a stored volume for each kind of audio session, and WebKit
// moves a page between two of them by what the page does: playing only, it
// is a media session at the media level; the moment the mic opens it
// becomes play-and-record with VideoChat, at the call level, and back again
// when the mic closes (WebKit bug 236219). A premium room opens and closes
// the mic for every take, so the side buttons set one level during a take
// and another between takes, and a level left at zero in either one made
// the room fall silent with nobody touching the volume (owner, 17 Oct).
//
// So a room asks WebKit for play-and-record at the door, through the page's
// own API (page-audio-session.ts in packages/mobile-runtime), and gives the
// page its type back on the way out. WebKit's engineer suggests exactly
// this in that bug: "To make sure "play-and-record" is consistently being
// used, you can set navigator.audioSession.type" (Youenn Fablet, 1 Mar
// 2023). The switch now happens once, at the door, and the singer sets the
// level once. The app's own AVAudioSession is not touched (#923).
//
// NOT WHILE THE PAGE IS AWAY. WebKit counts play-and-record as a playback
// session for Web Audio (AudioContext.cpp, hasPlayBackAudioSession): the
// room's context may show on the lock screen, take its buttons, and play
// on as the app goes behind. So the visit gives the type back as the page
// hides (`visibilitychange`, `pagehide`), and asks again as it shows
// (`visibilitychange`, `pageshow`, or the app back in front), while the
// room is still open. A room left while the page is away asks nothing
// more.
//
// Control Center and the notification shade keep the type (18 Oct). The
// page stays visible under them; the room's take and demo end there and
// the shell parks the clock by script (room-kit app-leave.ts,
// native-shell.ts), and WebKit offers no context suspended by script to
// Now Playing (AudioContext::isNowPlayingEligible). Kept, the type lets
// Control Center's slider move the level the room plays at. Given back,
// the page's session would leave play-and-record while Control Center is
// open, the slider would move another of iOS's stored levels, and the
// change would be lost as the room asked again.
//
// What it still costs, from the audit (REPORT option A): AirPods are
// hands-free for the whole visit, and the call level's voice processing
// applies to the demos too, which made the rooms too quiet (owner, 18 Oct
// 2026). So the Developer screen's "One volume in rooms" turns it on for a
// tester (room-volume-switch.ts); it is off by default, and a store build
// always has it off. Only iOS asks: Capacitor's platform says so, and the page must
// have an audio session, so an Android WebView that ships the API one day
// still asks for nothing.
//
// ShellScreens mounts a RoomVisit with each premium room, before the room,
// so the session is asked for before the room's first sound, and given back
// after the room has torn down. Each step is handed to `onRoomVisit`
// listeners: a test build's audio census writes it into the audio record.

import { Capacitor } from '@capacitor/core'
import { claimPageAudioSession, pageAudioSessionType, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import type { AppLifecycleHandler } from '@irchiinnuss/mobile-runtime/platform'
import { onAppState } from '@irchiinnuss/mobile-runtime/platform'
import { onCleanup } from 'solid-js'
import { oneVolumeInRooms } from './room-volume-switch'

/**
 * A visit's steps: in at the door, the type given back as the page goes
 * away, asked for again as it comes back, and out.
 */
export type RoomVisitMoment =
  | 'enter'
  | 'release-hidden'
  | 'reclaim-visible'
  | 'leave'

/** A room entered, hidden, shown or left, as the audio record words it. */
export interface RoomVisitStep {
  /** The room's screen: 'long-note', 'echo', 'lip-roll', 'ng-slides'. */
  readonly room: string
  readonly moment: RoomVisitMoment
  /** "One volume in rooms", as the visit found it at the door. */
  readonly oneVolume: boolean
  /** Whether the visit asks WebKit for play-and-record. */
  readonly asks: boolean
  /**
   * What moved the type, for a release or a reclaim: 'visibilitychange' or
   * 'pagehide' as the page goes; 'visibilitychange', 'pageshow' or
   * 'app-active' as it comes back.
   */
  readonly on?: string
  /** On the way out: how long the visit lasted, in ms. */
  readonly ms?: number
}

export interface RoomVisitOptions {
  /** The switch; the Developer screen's when not given. */
  readonly oneVolume?: () => boolean
  /** Capacitor's platform; only 'ios' asks. */
  readonly platform?: () => string
  /** The page whose hiding gives the type back; this one when not given. */
  readonly win?: Window
  /** The app in front or behind, as the OS says; the platform's when not given. */
  readonly appState?: (handler: AppLifecycleHandler) => () => void
}

type Listener = (step: RoomVisitStep) => void

const listeners = new Set<Listener>()

function tell(step: RoomVisitStep): void {
  for (const listener of [...listeners]) {
    try {
      listener(step)
    } catch {
      // A record that broke must not keep a room from opening or closing.
    }
  }
}

/** Every room entered and left. Returns the unsubscribe. */
export function onRoomVisit(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const capacitorPlatform = (): string => Capacitor.getPlatform()

/**
 * The visit to `room` begins: play-and-record is asked for on iOS, where
 * the switch is on and the page has an audio session, for as long as the
 * page shows. Returns what ends it (safe to call twice).
 */
export function beginRoomVisit(
  room: string,
  options: RoomVisitOptions = {},
): () => void {
  const oneVolume = (options.oneVolume ?? oneVolumeInRooms)()
  const asks =
    oneVolume &&
    (options.platform ?? capacitorPlatform)() === 'ios' &&
    pageAudioSessionType() !== null
  const started = Date.now()
  const visit = { room, oneVolume, asks }
  tell({ ...visit, moment: 'enter' })

  const unlisten: (() => void)[] = []
  let giveBack: (() => void) | null = null
  let open = true
  let away = false

  if (asks) {
    const win = options.win ?? window
    const doc = win.document
    const hidden = (): boolean => doc.visibilityState === 'hidden'
    const ask = (): void => {
      giveBack = claimPageAudioSession(`room ${room}`, 'play-and-record')
    }
    const goAway = (on: string): void => {
      if (!open || away) return
      away = true
      tell({ ...visit, moment: 'release-hidden', on })
      const release = giveBack
      giveBack = null
      release?.()
    }
    const comeBack = (on: string): void => {
      if (!open || !away || hidden()) return
      away = false
      tell({ ...visit, moment: 'reclaim-visible', on })
      ask()
    }

    const visibility = (): void => {
      if (hidden()) goAway('visibilitychange')
      else comeBack('visibilitychange')
    }
    const pageHide = (): void => goAway('pagehide')
    const pageShow = (): void => comeBack('pageshow')
    doc.addEventListener('visibilitychange', visibility)
    win.addEventListener('pagehide', pageHide)
    win.addEventListener('pageshow', pageShow)
    unlisten.push(
      () => doc.removeEventListener('visibilitychange', visibility),
      () => win.removeEventListener('pagehide', pageHide),
      () => win.removeEventListener('pageshow', pageShow),
      (options.appState ?? onAppState)((state) => {
        if (state === 'active') comeBack('app-active')
      }),
    )

    // A room opened behind the app asks once the page shows.
    if (hidden()) away = true
    else ask()
  }

  return () => {
    if (!open) return
    open = false
    for (const stop of unlisten.splice(0)) stop()
    tell({ ...visit, moment: 'leave', ms: Date.now() - started })
    const release = giveBack
    giveBack = null
    release?.()
  }
}

/** One premium room's visit, for as long as it is mounted. Draws nothing. */
export function RoomVisit(props: { room: string }): null {
  // eslint-disable-next-line solid/reactivity -- read once: keyed on the screen
  onCleanup(beginRoomVisit(props.room))
  return null
}
