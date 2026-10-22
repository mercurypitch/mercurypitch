// ============================================================
// Picture in picture — the small window a phone keeps after the app
// ============================================================
//
// A small floating window the app keeps on screen after the singer leaves
// it, as a video app does. The native half is not an npm plugin: it lives in
// the Mercury Pitch app itself, under one name on both phones, so an app
// without it answers `Unimplemented`, and that is survived like any other
// missing plugin.
//
// Android (PictureInPicturePlugin.java, which MainActivity registers) shrinks
// the whole app into the window, page and all, and the page draws what is in
// it. iOS puts only video in its window, and a page behind another app cannot
// draw: there the app's own plugin (ios/App/App/LyricsWindow/) draws the
// lyrics, from the song's lyric timing (`setPictureInPictureLyrics`) and its
// clock, which rides on every Now Playing report. The window's play and pause
// reach the media handlers as a lock-screen press does, and what the window
// does is written to the console as `[lyrics window] ...`, for a device test.
// The same plugin says what iOS does to the app's sound, as `[audio session]
// ...`: another app's sound starting and stopping, a call, the route.
//
// On iOS the same lyrics and clock also reach a TV connected to the phone by
// AirPlay screen mirroring or a cable (TVLyrics.swift). While a test build's
// switch is on (`setTvLyricsEnabled`), the TV shows them full screen in place
// of the phone, and the room keeps handing them over while it does
// (`onTvLyrics`). Off, the TV mirrors the phone. A second switch puts the
// room's whole stage on the TV instead (`setTvStageEnabled`, TVStage.swift):
// a page of its own draws it there from the messages the room sends
// (`sendTvStage`), and the two switches take each other's place.
//
// The web has no window for a page: inert wrappers, and the plugin is never
// even registered there.

import type { PluginListenerHandle } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'
import type { Unsubscribe } from './native-calls'
import { attempt, finiteOr, isAndroid, isIos, lazyListener, } from './native-calls'

/** What a Now Playing report says of where the song is (platform.ts). */
interface WindowClockReport {
  readonly playing: boolean
  readonly position?: number
  readonly duration?: number
  readonly rate?: number
}

/** Where the song is, as the iOS window keeps it: a Now Playing report. */
interface PictureInPictureClock {
  readonly playing: boolean
  readonly position: number
  readonly rate: number
  readonly duration: number
}

/** The app's own plugin, as MainActivity and the iOS app register it. */
interface PictureInPicturePlugin {
  setAutoEnter(options: { enabled: boolean }): Promise<void>
  /** iOS: the song's lyric timing as JSON, or no `json` to take it away. */
  setLyrics(options: { json?: string }): Promise<void>
  /** iOS: where the song is. */
  setClock(options: PictureInPictureClock): Promise<void>
  /** iOS: the switch for the lyrics on a connected TV. */
  setTvLyrics(options: { enabled: boolean }): Promise<void>
  /** iOS: that switch, and whether a TV is connected and shows the lyrics. */
  getTvLyrics(): Promise<{
    enabled?: unknown
    connected?: unknown
    showing?: unknown
  }>
  /** iOS: the switch for the room's stage on a connected TV. */
  setTvStage(options: { enabled: boolean }): Promise<void>
  /** iOS: that switch, and whether a TV is connected and shows the stage. */
  getTvStage(): Promise<{
    enabled?: unknown
    connected?: unknown
    showing?: unknown
  }>
  /** iOS: one message for the stage, as JSON, and which kind it is. */
  pushTvStage(options: { kind: string; json: string }): Promise<void>
  addListener(
    eventName: 'pictureInPictureChange',
    listener: (state: { inPictureInPicture?: boolean }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'pictureInPictureAction',
    listener: (event: {
      action?: unknown
      /** iOS: when it was pressed, in ms since 1970. */
      at?: unknown
      /** iOS: whether another app's sound was playing as it was pressed. */
      otherAudio?: unknown
    }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'pictureInPictureLog' | 'audioSessionLog',
    listener: (event: { message?: unknown }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'tvLyricsChange' | 'tvStageChange',
    listener: (state: { connected?: unknown; showing?: unknown }) => void,
  ): Promise<PluginListenerHandle>
}

/**
 * What the iOS window draws, and when: the app builds it from the lyrics the
 * stage lights (lyric-window-script.ts). Times are seconds into the song.
 */
export interface PictureInPictureLyrics {
  readonly title: string
  /** The song's length, 0 while it is not known. */
  readonly duration: number
  /** In song order; each runs until the next one's `at`. */
  readonly segments: readonly {
    readonly at: number
    /** The words of the line being sung, none in a rest. */
    readonly current: readonly string[]
    /** The next line with words, or null after the last. */
    readonly next: string | null
    /** Per word of `current`: when it starts to fill, and when it is lit. */
    readonly words: readonly (readonly [number, number])[]
  }[]
}

/** A phone with the window: Android's of the app, iOS's of the lyrics. */
function hasPictureInPicture(): boolean {
  return isAndroid() || isIos()
}

/**
 * Whether the window draws the lyrics itself, from a script the page hands
 * it (`setPictureInPictureLyrics`): iOS. Android's window shows the page.
 */
export function pictureInPictureNeedsLyrics(): boolean {
  return isIos()
}

// Registered on first use, once: Capacitor warns on a second registration.
// A plain variable, never a promise's value. The proxy answers every
// property, `then` included, so resolving a promise with it would hang.
let pictureInPicturePlugin: PictureInPicturePlugin | null = null

function pictureInPicture(): PictureInPicturePlugin {
  pictureInPicturePlugin ??=
    registerPlugin<PictureInPicturePlugin>('PictureInPicture')
  if (isIos()) watchNativeLogs(pictureInPicturePlugin)
  return pictureInPicturePlugin
}

// The iOS plugin's own account of the window and of the app's sound, for as
// long as the app runs. The plugin keeps every line from before this
// listens, so the first ones (the plugin loading, whether the phone has a
// window at all, what was playing elsewhere) are not lost; each carries the
// time iOS said it, to line up against the page's audio record.
let nativeLogsWatched = false

const NATIVE_LOGS = [
  ['pictureInPictureLog', '[lyrics window]'],
  ['audioSessionLog', '[audio session]'],
] as const

function watchNativeLogs(plugin: PictureInPicturePlugin): void {
  if (nativeLogsWatched) return
  nativeLogsWatched = true
  for (const [eventName, prefix] of NATIVE_LOGS) {
    void (async () => {
      try {
        await plugin.addListener(eventName, (event) => {
          if (typeof event.message === 'string') {
            console.info(`${prefix} ${event.message}`)
          }
        })
      } catch {
        // No plugin behind the name in this build: nothing to hear.
      }
    })()
  }
}

/**
 * While on, leaving the app (the home gesture, the recents screen) opens the
 * small window instead of putting the app behind everything. Off by
 * default; the caller turns it on for exactly as long as there is something
 * worth watching.
 */
export async function setPictureInPictureAutoEnter(on: boolean): Promise<void> {
  if (!hasPictureInPicture()) return
  await attempt(async () => {
    await pictureInPicture().setAutoEnter({ enabled: on })
  })
}

/**
 * iOS: what the window draws for the song in the room, or null when the room
 * has none, which also closes a window that is open. Android's window shows
 * the page itself and needs nothing.
 */
export async function setPictureInPictureLyrics(
  lyrics: PictureInPictureLyrics | null,
): Promise<void> {
  if (!isIos()) return
  await attempt(async () => {
    await pictureInPicture().setLyrics(
      lyrics === null ? {} : { json: JSON.stringify(lyrics) },
    )
  })
}

/**
 * iOS: the window's clock, from the Now Playing report the lock screen gets:
 * the window runs on from it as the lock screen's bar does.
 */
export function tellTheWindowTheClock(song: WindowClockReport): void {
  const duration = Math.max(0, finiteOr(song.duration, 0))
  const rate = finiteOr(song.rate, 1)
  void attempt(async () => {
    await pictureInPicture().setClock({
      playing: song.playing,
      position: Math.min(
        duration > 0 ? duration : Number.POSITIVE_INFINITY,
        Math.max(0, finiteOr(song.position, 0)),
      ),
      rate: rate > 0 ? rate : 1,
      duration,
    })
  })
}

/** What iOS said as the window's button was pressed. */
export interface WindowPress {
  /** Another app's sound was playing. */
  readonly otherAudio: boolean
}

/**
 * A press older than this waited for the page: iOS froze the app behind
 * the other one, and the press runs as it comes back. Dropped, it cannot
 * start the song long after it was pressed.
 */
export const WINDOW_PRESS_STALE_MS = 3000

/** iOS: the window's own play and pause, as the media handlers hear them. */
export function listenToTheWindow(
  handler: (action: 'play' | 'pause', press: WindowPress) => void,
): Unsubscribe {
  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await pictureInPicture().addListener(
            'pictureInPictureAction',
            (event) => {
              if (event.action !== 'play' && event.action !== 'pause') return
              const waited =
                typeof event.at === 'number' ? Date.now() - event.at : 0
              if (waited > WINDOW_PRESS_STALE_MS) {
                console.info(
                  `[lyrics window] ${event.action} waited ${Math.round(waited / 1000)} s while the app slept: dropped`,
                )
                return
              }
              handler(event.action, { otherAudio: event.otherAudio === true })
            },
          ),
        )
      } catch {
        // No plugin behind the name in this build: no window, no buttons.
      }
    })()
  })
}

/** The app entering the small window (true) and leaving it (false). */
export function onPictureInPicture(
  handler: (inPictureInPicture: boolean) => void,
): Unsubscribe {
  if (!hasPictureInPicture()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await pictureInPicture().addListener(
            'pictureInPictureChange',
            (state) => {
              handler(state.inPictureInPicture === true)
            },
          ),
        )
      } catch {
        // No plugin behind the name in this build: no window, no events.
      }
    })()
  })
}

/** A TV connected to the iPhone, and what it shows (TVLyrics.swift). */
export interface TvLyricsState {
  /** The test build's switch: on, a connected TV shows the lyrics. */
  readonly enabled: boolean
  /** A TV is connected, by AirPlay screen mirroring or a cable. */
  readonly connected: boolean
  /** It shows the lyrics, not the phone. */
  readonly showing: boolean
}

/**
 * iOS: the switch for the lyrics on a connected TV. Off, a TV mirrors the
 * phone. The plugin keeps it across launches.
 */
export async function setTvLyricsEnabled(on: boolean): Promise<void> {
  if (!isIos()) return
  await attempt(async () => {
    await pictureInPicture().setTvLyrics({ enabled: on })
  })
}

/** iOS: the switch and the TV as they stand, or null where there is none. */
export async function readTvLyrics(): Promise<TvLyricsState | null> {
  if (!isIos()) return null
  try {
    const state = await pictureInPicture().getTvLyrics()
    return {
      enabled: state.enabled === true,
      connected: state.connected === true,
      showing: state.showing === true,
    }
  } catch {
    // No plugin behind the name in this build: no TV.
    return null
  }
}

/** iOS: a TV coming and going, and the lyrics going up on it or down. */
export function onTvLyrics(
  handler: (state: Omit<TvLyricsState, 'enabled'>) => void,
): Unsubscribe {
  if (!isIos()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await pictureInPicture().addListener('tvLyricsChange', (state) => {
            handler({
              connected: state.connected === true,
              showing: state.showing === true,
            })
          }),
        )
      } catch {
        // No plugin behind the name in this build: no TV, no events.
      }
    })()
  })
}

/** A TV connected to the iPhone, and whether it draws the stage (TVStage.swift). */
export type TvStageState = TvLyricsState

/**
 * iOS: the switch for the room's stage on a connected TV, the pitch lane,
 * the lyrics and the score in the TV's own landscape. On, it takes the
 * lyrics' place: a TV shows one or the other. The plugin keeps it across
 * launches.
 */
export async function setTvStageEnabled(on: boolean): Promise<void> {
  if (!isIos()) return
  await attempt(async () => {
    await pictureInPicture().setTvStage({ enabled: on })
  })
}

/** iOS: the stage's switch and the TV as they stand, or null where there is none. */
export async function readTvStage(): Promise<TvStageState | null> {
  if (!isIos()) return null
  try {
    const state = await pictureInPicture().getTvStage()
    return {
      enabled: state.enabled === true,
      connected: state.connected === true,
      showing: state.showing === true,
    }
  } catch {
    // No plugin behind the name in this build, or one without the stage.
    return null
  }
}

/** iOS: a TV coming and going, and the stage going up on it or down. */
export function onTvStage(
  handler: (state: Omit<TvStageState, 'enabled'>) => void,
): Unsubscribe {
  if (!isIos()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        dispose(
          await pictureInPicture().addListener('tvStageChange', (state) => {
            handler({
              connected: state.connected === true,
              showing: state.showing === true,
            })
          }),
        )
      } catch {
        // No plugin behind the name in this build: no TV, no events.
      }
    })()
  })
}

/**
 * iOS: one message for the stage on a connected TV (the app's
 * src/lib/tv-stage/protocol.ts), passed on as JSON. A TV that does not
 * show the stage keeps the last song and frame for when it does.
 */
export async function sendTvStage(message: {
  readonly kind: string
}): Promise<void> {
  if (!isIos()) return
  await attempt(async () => {
    await pictureInPicture().pushTvStage({
      kind: message.kind,
      json: JSON.stringify(message),
    })
  })
}
