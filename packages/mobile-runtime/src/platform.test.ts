// ============================================================
// Platform sibling tests — the web loads nothing, the phone degrades
// ============================================================
//
// Two claims are worth a test rather than a comment. First: on the web not
// one plugin module is even evaluated, which is why a browser bundle carries
// no plugin registration code. The module registry is reset per test and the
// mock factories record themselves, so "never loaded" is measured rather than
// assumed. Second: a plugin whose native half is missing answers with
// Capacitor's `Unimplemented`, and every wrapper has to survive that — which
// is the whole reason these wrappers exist instead of direct plugin calls.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PlatformModule from './platform'

const loaded = vi.hoisted(() => [] as string[])

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
}))
const haptics = vi.hoisted(() => ({ impact: vi.fn(), notification: vi.fn() }))
const keepAwakePlugin = vi.hoisted(() => ({
  keepAwake: vi.fn(),
  allowSleep: vi.fn(),
}))
const statusBar = vi.hoisted(() => ({ setStyle: vi.fn() }))
const keyboard = vi.hoisted(() => ({ hide: vi.fn() }))
const share = vi.hoisted(() => ({ share: vi.fn() }))
const nativeSettings = vi.hoisted(() => ({ open: vi.fn() }))
const appPlugin = vi.hoisted(() => ({
  addListener: vi.fn(),
  minimizeApp: vi.fn(),
  exitApp: vi.fn(),
}))
const mediaSession = vi.hoisted(() => ({
  setMetadata: vi.fn(),
  setPlaybackState: vi.fn(),
  setActionHandler: vi.fn(),
  setPositionState: vi.fn(),
  // Not in the plugin's typings: iOS's native half reports presses here.
  addListener: vi.fn(),
}))

// The app's own picture-in-picture plugin, reached through registerPlugin
// rather than a module, so "registered" is what stands for "loaded" there.
const pictureInPicture = vi.hoisted(() => ({
  setAutoEnter: vi.fn(),
  addListener: vi.fn(),
}))
const registerPlugin = vi.hoisted(() =>
  vi.fn((_name: string) => pictureInPicture),
)

vi.mock('@capacitor/core', () => ({ Capacitor: capacitor, registerPlugin }))

vi.mock('@capacitor/haptics', () => {
  loaded.push('@capacitor/haptics')
  return {
    Haptics: haptics,
    ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
    NotificationType: {
      Success: 'SUCCESS',
      Warning: 'WARNING',
      Error: 'ERROR',
    },
  }
})

vi.mock('@capacitor-community/keep-awake', () => {
  loaded.push('@capacitor-community/keep-awake')
  return { KeepAwake: keepAwakePlugin }
})

vi.mock('@capacitor/status-bar', () => {
  loaded.push('@capacitor/status-bar')
  return { StatusBar: statusBar, Style: { Dark: 'DARK', Light: 'LIGHT' } }
})

vi.mock('@capacitor/keyboard', () => {
  loaded.push('@capacitor/keyboard')
  return { Keyboard: keyboard }
})

vi.mock('@capacitor/share', () => {
  loaded.push('@capacitor/share')
  return { Share: share }
})

vi.mock('capacitor-native-settings', () => {
  loaded.push('capacitor-native-settings')
  return {
    NativeSettings: nativeSettings,
    AndroidSettings: { ApplicationDetails: 'application_details' },
    IOSSettings: { App: 'app' },
  }
})

vi.mock('@capacitor/app', () => {
  loaded.push('@capacitor/app')
  return { App: appPlugin }
})

vi.mock('@capgo/capacitor-media-session', () => {
  loaded.push('@capgo/capacitor-media-session')
  return { MediaSession: mediaSession }
})

type Platform = typeof PlatformModule

/** A fresh module graph per test, so "was it loaded" means this test. */
async function loadPlatform(
  native: boolean,
  name: 'android' | 'ios' = 'android',
): Promise<Platform> {
  capacitor.isNativePlatform.mockReturnValue(native)
  capacitor.getPlatform.mockReturnValue(native ? name : 'web')
  vi.resetModules()
  loaded.length = 0
  return import('./platform')
}

function listenerHandle(): { remove: ReturnType<typeof vi.fn> } {
  return { remove: vi.fn(async () => undefined) }
}

/**
 * The registration is async; the caller's unsubscribe is not. A macrotask,
 * not a microtask: the plugin arrives through a dynamic import, and resolving
 * one is not something a chain of `Promise.resolve()` is guaranteed to flush.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('on the web', () => {
  it.each([
    ['hapticTap', (p: Platform) => p.hapticTap()],
    ['hapticSuccess', (p: Platform) => p.hapticSuccess()],
    ['hapticWarning', (p: Platform) => p.hapticWarning()],
    ['keepAwake', (p: Platform) => p.keepAwake(true)],
    ['setStatusBar', (p: Platform) => p.setStatusBar('dark')],
    ['hideKeyboardOnNativeOnly', (p: Platform) => p.hideKeyboardOnNativeOnly()],
    ['sharePayload', (p: Platform) => p.sharePayload({ text: 'hi' })],
    ['openAppSettings', (p: Platform) => p.openAppSettings()],
    ['minimizeApp', (p: Platform) => p.minimizeApp()],
    [
      'setNowPlaying',
      (p: Platform) => p.setNowPlaying({ title: 'Song', playing: true }),
    ],
    [
      'setPictureInPictureAutoEnter',
      (p: Platform) => p.setPictureInPictureAutoEnter(true),
    ],
  ])('%s evaluates no plugin module at all', async (_name, call) => {
    const platform = await loadPlatform(false)

    await call(platform)

    expect(loaded).toEqual([])
    expect(registerPlugin).not.toHaveBeenCalled()
  })

  it('reports a share and a Settings trip as not taken', async () => {
    const platform = await loadPlatform(false)

    await expect(platform.sharePayload({ text: 'hi' })).resolves.toBe(false)
    await expect(platform.openAppSettings()).resolves.toBe(false)
    await expect(platform.minimizeApp()).resolves.toBe(false)
  })

  it('hands back inert unsubscribes rather than nothing', async () => {
    const platform = await loadPlatform(false)
    const handler = vi.fn()

    const stopBack = platform.onBackButton(handler)
    const stopState = platform.onAppState(handler)
    const stopMedia = platform.onMediaAction(handler)
    const stopWindow = platform.onPictureInPicture(handler)
    await settle()

    expect(loaded).toEqual([])
    expect(appPlugin.addListener).not.toHaveBeenCalled()
    expect(mediaSession.setActionHandler).not.toHaveBeenCalled()
    expect(registerPlugin).not.toHaveBeenCalled()
    expect(() => {
      stopBack()
      stopState()
      stopMedia()
      stopWindow()
    }).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('on a phone', () => {
  it('taps with the lightest impact the device has', async () => {
    const platform = await loadPlatform(true)

    await platform.hapticTap()

    expect(haptics.impact).toHaveBeenCalledWith({ style: 'LIGHT' })
  })

  it.each([
    ['hapticSuccess', 'SUCCESS'],
    ['hapticWarning', 'WARNING'],
  ] as const)('maps %s to the %s notification', async (name, type) => {
    const platform = await loadPlatform(true)

    await platform[name]()

    expect(haptics.notification).toHaveBeenCalledWith({ type })
  })

  it('holds the screen awake and lets it go again', async () => {
    const platform = await loadPlatform(true)

    await platform.keepAwake(true)
    expect(keepAwakePlugin.keepAwake).toHaveBeenCalledTimes(1)
    expect(keepAwakePlugin.allowSleep).not.toHaveBeenCalled()

    await platform.keepAwake(false)
    expect(keepAwakePlugin.allowSleep).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['dark', 'DARK'],
    ['light', 'LIGHT'],
  ] as const)('sets the %s status bar style', async (style, native) => {
    const platform = await loadPlatform(true)

    await platform.setStatusBar(style)

    expect(statusBar.setStyle).toHaveBeenCalledWith({ style: native })
  })

  it('hides the keyboard', async () => {
    const platform = await loadPlatform(true)

    await platform.hideKeyboardOnNativeOnly()

    expect(keyboard.hide).toHaveBeenCalledTimes(1)
  })

  it('passes only the parts of a share payload that were given', async () => {
    const platform = await loadPlatform(true)

    await expect(
      platform.sharePayload({ text: 'a take', files: ['file:///take.webm'] }),
    ).resolves.toBe(true)

    expect(share.share).toHaveBeenCalledWith({
      text: 'a take',
      files: ['file:///take.webm'],
    })
  })

  it('opens this app’s own row in Settings, and nothing else', async () => {
    const platform = await loadPlatform(true)

    await expect(platform.openAppSettings()).resolves.toBe(true)

    expect(nativeSettings.open).toHaveBeenCalledWith({
      optionAndroid: 'application_details',
      optionIOS: 'app',
    })
  })

  it('counts a sheet the person dismissed as one that was presented', async () => {
    // Both native halves reject a dismissal, with these exact words:
    // SharePlugin.swift on a share that did not complete, SharePlugin.java on
    // Activity.RESULT_CANCELED. Reporting that as a failure would send the
    // caller down the fallback the person just declined.
    const platform = await loadPlatform(true)
    share.share.mockRejectedValueOnce(new Error('Share canceled'))

    await expect(platform.sharePayload({ text: 'a take' })).resolves.toBe(true)
  })

  it('reports a share the platform refused, rather than throwing', async () => {
    const platform = await loadPlatform(true)
    share.share.mockRejectedValueOnce(
      new Error('Must provide at least url, text or files'),
    )

    await expect(platform.sharePayload({ text: 'a take' })).resolves.toBe(false)
  })

  it('survives a plugin with no native half behind it', async () => {
    const platform = await loadPlatform(true)
    const unimplemented = Object.assign(new Error('not implemented'), {
      code: 'UNIMPLEMENTED',
    })
    haptics.impact.mockRejectedValueOnce(unimplemented)

    await expect(platform.hapticTap()).resolves.toBeUndefined()
  })

  it('reports the back button with what the WebView knows', async () => {
    const platform = await loadPlatform(true)
    const handle = listenerHandle()
    appPlugin.addListener.mockResolvedValue(handle)
    const handler = vi.fn()

    const stop = platform.onBackButton(handler)
    await settle()

    expect(appPlugin.addListener).toHaveBeenCalledWith(
      'backButton',
      expect.any(Function),
    )
    const emit = appPlugin.addListener.mock.calls[0]?.[1] as (event: {
      canGoBack: boolean
    }) => void
    emit({ canGoBack: true })
    expect(handler).toHaveBeenCalledWith({ canGoBack: true })

    stop()
    expect(handle.remove).toHaveBeenCalledTimes(1)
  })

  it('translates app state into active and background', async () => {
    const platform = await loadPlatform(true)
    appPlugin.addListener.mockResolvedValue(listenerHandle())
    const handler = vi.fn()

    platform.onAppState(handler)
    await settle()

    const emit = appPlugin.addListener.mock.calls[0]?.[1] as (state: {
      isActive: boolean
    }) => void
    emit({ isActive: false })
    emit({ isActive: true })

    expect(handler.mock.calls).toEqual([['background'], ['active']])
  })

  it('removes a listener unsubscribed before its handle arrived', async () => {
    // A screen that unmounts during its own registration would otherwise
    // leave a listener behind with nothing to remove it.
    const platform = await loadPlatform(true)
    const handle = listenerHandle()
    appPlugin.addListener.mockResolvedValue(handle)

    const stop = platform.onAppState(vi.fn())
    stop()
    await settle()
    await settle()

    expect(handle.remove).toHaveBeenCalledTimes(1)
  })

  it('minimizes, and never reaches for exitApp', async () => {
    const platform = await loadPlatform(true)

    await expect(platform.minimizeApp()).resolves.toBe(true)
    expect(appPlugin.minimizeApp).toHaveBeenCalledTimes(1)
    expect(appPlugin.exitApp).not.toHaveBeenCalled()
  })

  it('reports a refused minimize rather than falling through to exit', async () => {
    // iOS answers both calls with unimplemented(), so a second attempt could
    // only trade one refusal for another; Android, the only platform that
    // fires the back button, always has moveTaskToBack.
    const platform = await loadPlatform(true)
    appPlugin.minimizeApp.mockRejectedValue(new Error('Unimplemented'))

    await expect(platform.minimizeApp()).resolves.toBe(false)
    expect(appPlugin.exitApp).not.toHaveBeenCalled()
  })

  it('names the song before it says it is playing', async () => {
    // Android starts its media foreground service on the state change, and
    // the service's first notification shows whatever metadata it has.
    const platform = await loadPlatform(true)
    const order: string[] = []
    mediaSession.setMetadata.mockImplementation(async () => {
      order.push('metadata')
    })
    mediaSession.setPlaybackState.mockImplementation(async () => {
      order.push('state')
    })
    mediaSession.setPositionState.mockImplementation(async () => {
      order.push('position')
    })

    await platform.setNowPlaying({
      title: 'Harbour Lights',
      artist: 'The Wharf',
      playing: true,
    })

    expect(mediaSession.setMetadata).toHaveBeenCalledWith({
      title: 'Harbour Lights',
      artist: 'The Wharf',
    })
    expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
      playbackState: 'playing',
    })
    // The position goes last. iOS re-anchors its lock-screen clock to the
    // stored elapsed time on every write, and its state change sets the rate
    // to 1, so anything written after the position would undo it.
    expect(order).toEqual(['metadata', 'state', 'position'])
  })

  it('reports a paused song as paused, and leaves out an unknown artist', async () => {
    const platform = await loadPlatform(true)

    await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })

    expect(mediaSession.setMetadata).toHaveBeenCalledWith({
      title: 'Harbour Lights',
    })
    expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
      playbackState: 'paused',
    })
  })

  it('clears what is playing without naming anything', async () => {
    const platform = await loadPlatform(true)

    await platform.setNowPlaying(null)

    expect(mediaSession.setMetadata).not.toHaveBeenCalled()
    expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
      playbackState: 'none',
    })
  })

  // The notification's progress bar (Android) and the lock screen's (iOS)
  // draw from the position state alone: the length, where the song is, and
  // how fast it moves. The system runs the bar on from the last report, so a
  // report is due on a change, never on a frame.
  describe('the progress bar', () => {
    const lastPosition = (): unknown =>
      mediaSession.setPositionState.mock.calls.at(-1)?.[0]

    it('gives a playing song its length, its place and its speed', async () => {
      const platform = await loadPlatform(true)

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 42.5,
        duration: 246,
        rate: 1.25,
      })

      expect(mediaSession.setPositionState).toHaveBeenCalledTimes(1)
      expect(lastPosition()).toEqual({
        duration: 246,
        position: 42.5,
        playbackRate: 1.25,
      })
    })

    it('plays at normal speed when the caller names no rate', async () => {
      const platform = await loadPlatform(true)

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 3,
        duration: 246,
      })

      expect(lastPosition()).toEqual({
        duration: 246,
        position: 3,
        playbackRate: 1,
      })
    })

    it('holds the bar still on a paused song', async () => {
      // Rate 0: iOS stops its clock on it. Android keeps a paused state still
      // whatever the rate, and reads 0 as 1 for when play comes back.
      const platform = await loadPlatform(true)

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: false,
        position: 97.25,
        duration: 246,
        rate: 1.25,
      })

      expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
        playbackState: 'paused',
      })
      expect(lastPosition()).toEqual({
        duration: 246,
        position: 97.25,
        playbackRate: 0,
      })
    })

    it('moves the bar to wherever a seek lands', async () => {
      const platform = await loadPlatform(true)
      const song = { title: 'Harbour Lights', playing: true, duration: 246 }

      await platform.setNowPlaying({ ...song, position: 42.5 })
      await platform.setNowPlaying({ ...song, position: 180 })
      await platform.setNowPlaying({ ...song, position: 12 })

      expect(
        mediaSession.setPositionState.mock.calls.map(
          ([options]) => (options as { position: number }).position,
        ),
      ).toEqual([42.5, 180, 12])
    })

    it('swaps in the next song’s length, and shows none while it is unknown', async () => {
      const platform = await loadPlatform(true)

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 200,
        duration: 246,
      })
      // The next song is on the stage and still loading: no length yet.
      await platform.setNowPlaying({ title: 'Low Tide', playing: false })
      expect(lastPosition()).toEqual({
        duration: 0,
        position: 0,
        playbackRate: 0,
      })

      await platform.setNowPlaying({
        title: 'Low Tide',
        playing: true,
        position: 0,
        duration: 181.5,
      })
      expect(lastPosition()).toEqual({
        duration: 181.5,
        position: 0,
        playbackRate: 1,
      })
    })

    it('keeps the place inside the song', async () => {
      // iOS clamps the elapsed time to the length itself; Android draws a
      // thumb past the end. Neither gets a negative or a NaN.
      const platform = await loadPlatform(true)

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 250,
        duration: 246,
      })
      expect(lastPosition()).toMatchObject({ position: 246 })

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: -0.02,
        duration: 246,
      })
      expect(lastPosition()).toMatchObject({ position: 0 })

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: Number.NaN,
        duration: Number.NaN,
        rate: Number.NaN,
      })
      expect(lastPosition()).toEqual({
        duration: 0,
        position: 0,
        playbackRate: 1,
      })
    })

    it('empties the bar when the session ends', async () => {
      // Android stops its service on 'none' but keeps the numbers, and hands
      // them to the next session's first notification.
      const platform = await loadPlatform(true)
      const order: string[] = []
      mediaSession.setPlaybackState.mockImplementation(async () => {
        order.push('state')
      })
      mediaSession.setPositionState.mockImplementation(async () => {
        order.push('position')
      })

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 42.5,
        duration: 246,
      })
      order.length = 0
      await platform.setNowPlaying(null)

      expect(lastPosition()).toEqual({
        duration: 0,
        position: 0,
        playbackRate: 0,
      })
      expect(order).toEqual(['state', 'position'])
    })

    it('still names the song on a phone whose plugin has no position', async () => {
      const platform = await loadPlatform(true)
      mediaSession.setPositionState.mockRejectedValueOnce(
        new Error('Unimplemented'),
      )

      await expect(
        platform.setNowPlaying({
          title: 'Harbour Lights',
          playing: true,
          position: 1,
          duration: 246,
        }),
      ).resolves.toBeUndefined()
      expect(mediaSession.setPositionState).toHaveBeenCalledTimes(1)
      expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
        playbackState: 'playing',
      })
    })
  })

  it('survives a phone with no media session behind the plugin', async () => {
    const platform = await loadPlatform(true)
    mediaSession.setMetadata.mockRejectedValueOnce(
      new Error('Media Session API not available in this browser.'),
    )

    await expect(
      platform.setNowPlaying({ title: 'Harbour Lights', playing: true }),
    ).resolves.toBeUndefined()
  })

  it('passes each media button to the handler, and clears them all on stop', async () => {
    const platform = await loadPlatform(true)
    const handler = vi.fn()

    const stop = platform.onMediaAction(handler)
    await settle()

    const registered = mediaSession.setActionHandler.mock.calls.map(
      ([options]) => (options as { action: string }).action,
    )
    expect(registered).toEqual(['play', 'pause', 'stop', 'seekto'])
    for (const [options, press] of mediaSession.setActionHandler.mock.calls as [
      { action: string },
      (details: { action: string }) => void,
    ][]) {
      if (options.action === 'seekto') continue
      // Android's half resolves the kept call with the action's own name.
      press({ action: options.action })
      expect(handler).toHaveBeenLastCalledWith(options.action)
    }

    mediaSession.setActionHandler.mockClear()
    stop()
    await settle()

    expect(mediaSession.setActionHandler.mock.calls).toEqual([
      [{ action: 'play' }, null],
      [{ action: 'pause' }, null],
      [{ action: 'stop' }, null],
      [{ action: 'seekto' }, null],
    ])
  })

  describe('the progress bar, dragged', () => {
    /** The callback the room's 'seekto' registration handed the plugin. */
    const seekCallback = () =>
      mediaSession.setActionHandler.mock.calls.find(
        ([options]) => (options as { action: string }).action === 'seekto',
      )?.[1] as (details: unknown) => void

    it('hands the handler where the bar was let go', async () => {
      // Android's MediaSessionCallback.onSeekTo reports milliseconds as
      // seconds: { action: 'seekto', seekTime: pos / 1000 }. Registering
      // the handler is what puts ACTION_SEEK_TO in the session's actions,
      // the one thing that makes the bar draggable.
      const platform = await loadPlatform(true)
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      seekCallback()({ action: 'seekto', seekTime: 97.25 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ seekTo: 97.25 })
      // The callback is Android's answer; its half fires no event.
      expect(mediaSession.addListener).not.toHaveBeenCalled()
    })

    it('passes the place on as the platform gave it, for the room to clamp', async () => {
      const platform = await loadPlatform(true)
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      seekCallback()({ action: 'seekto', seekTime: 312 })
      seekCallback()({ action: 'seekto', seekTime: -0.5 })

      expect(handler.mock.calls).toEqual([
        [{ seekTo: 312 }],
        [{ seekTo: -0.5 }],
      ])
    })

    it('ignores a seek that names no place', async () => {
      const platform = await loadPlatform(true)
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      seekCallback()({ action: 'seekto' })
      seekCallback()({ action: 'seekto', seekTime: null })
      seekCallback()({ action: 'seekto', seekTime: Number.NaN })
      // The bridge hands an error back as (null, error).
      seekCallback()(null)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('on iOS', () => {
    // iOS's native half registers each command on MPRemoteCommandCenter and
    // reports a press through the plugin's 'actionHandler' event. It never
    // calls the handler setActionHandler was given (the bridge drops a
    // promise method's second argument), and it never removes a command
    // target, so a press arrives once for every setActionHandler call ever
    // made for that button, clears included.
    const emitter = () =>
      mediaSession.addListener.mock.calls.find(
        ([event]) => event === 'actionHandler',
      )?.[1] as (details: unknown) => void

    beforeEach(() => {
      mediaSession.addListener.mockResolvedValue(listenerHandle())
    })
    afterEach(() => {
      mediaSession.addListener.mockReset()
      vi.restoreAllMocks()
    })

    it('hears the lock screen through the plugin event, seeks included', async () => {
      const platform = await loadPlatform(true, 'ios')
      const handle = listenerHandle()
      mediaSession.addListener.mockResolvedValue(handle)
      const handler = vi.fn()

      const stop = platform.onMediaAction(handler)
      await settle()
      emitter()({ action: 'pause' })
      emitter()({ action: 'seekto', seekTime: 61.5 })
      emitter()({ action: 'play' })

      expect(handler.mock.calls).toEqual([
        ['pause'],
        [{ seekTo: 61.5 }],
        ['play'],
      ])

      stop()
      await settle()
      expect(handle.remove).toHaveBeenCalledTimes(1)
    })

    it('hears one press once, however many copies arrive', async () => {
      const platform = await loadPlatform(true, 'ios')
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      for (let copy = 0; copy < 3; copy += 1) {
        emitter()({ action: 'seekto', seekTime: 42 })
      }
      for (let copy = 0; copy < 3; copy += 1) {
        emitter()({ action: 'pause' })
      }
      // Something else is a new press, even straight after.
      emitter()({ action: 'seekto', seekTime: 50 })

      expect(handler.mock.calls).toEqual([
        [{ seekTo: 42 }],
        ['pause'],
        [{ seekTo: 50 }],
      ])
    })

    it('hears the same button again once its copies are past', async () => {
      const platform = await loadPlatform(true, 'ios')
      const now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      emitter()({ action: 'pause' })
      now.mockReturnValue(10_600)
      emitter()({ action: 'pause' })

      expect(handler.mock.calls).toEqual([['pause'], ['pause']])
    })

    it('ignores an event for a button it never registered', async () => {
      const platform = await loadPlatform(true, 'ios')
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      emitter()({ action: 'nexttrack' })
      emitter()(undefined)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  it('registers the buttons a platform has, and clears only those', async () => {
    // iOS answers through the WebView's media session, which may not know
    // every button. One refusal must not cost the others.
    const platform = await loadPlatform(true)
    mediaSession.setActionHandler.mockImplementation(
      async ({ action }: { action: string }, handler: unknown) => {
        if (action === 'stop' && handler !== null) {
          throw new TypeError('stop is not a supported action')
        }
      },
    )
    const handler = vi.fn()

    const stop = platform.onMediaAction(handler)
    await settle()
    const press = mediaSession.setActionHandler.mock.calls.find(
      ([options]) => (options as { action: string }).action === 'pause',
    )?.[1] as () => void
    press()
    expect(handler).toHaveBeenCalledWith('pause')

    mediaSession.setActionHandler.mockClear()
    stop()
    await settle()

    expect(mediaSession.setActionHandler.mock.calls).toEqual([
      [{ action: 'play' }, null],
      [{ action: 'pause' }, null],
      [{ action: 'seekto' }, null],
    ])
    mediaSession.setActionHandler.mockReset()
  })

  it('takes a callback id from Android rather than a promise', async () => {
    // Capacitor's bridge answers a callback method with the callback's id.
    const platform = await loadPlatform(true)
    mediaSession.setActionHandler.mockImplementation(() => '7')

    const stop = platform.onMediaAction(vi.fn())
    await settle()
    stop()
    await settle()

    expect(mediaSession.setActionHandler).toHaveBeenCalledWith(
      { action: 'stop' },
      null,
    )
    mediaSession.setActionHandler.mockReset()
  })
})

describe('picture in picture', () => {
  it('turns auto-enter on and off on Android, registering the plugin once', async () => {
    const platform = await loadPlatform(true)

    await platform.setPictureInPictureAutoEnter(true)
    await platform.setPictureInPictureAutoEnter(false)

    expect(registerPlugin.mock.calls).toEqual([['PictureInPicture']])
    expect(pictureInPicture.setAutoEnter.mock.calls).toEqual([
      [{ enabled: true }],
      [{ enabled: false }],
    ])
  })

  it('does nothing on iOS, where the window is for video only', async () => {
    const platform = await loadPlatform(true, 'ios')
    const handler = vi.fn()

    await platform.setPictureInPictureAutoEnter(true)
    const stop = platform.onPictureInPicture(handler)
    await settle()
    stop()

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(pictureInPicture.setAutoEnter).not.toHaveBeenCalled()
    expect(pictureInPicture.addListener).not.toHaveBeenCalled()
  })

  it('survives a build with no plugin behind the name', async () => {
    const platform = await loadPlatform(true)
    pictureInPicture.setAutoEnter.mockRejectedValueOnce(
      new Error('"PictureInPicture" plugin is not implemented on android'),
    )
    pictureInPicture.addListener.mockRejectedValueOnce(
      new Error('"PictureInPicture" plugin is not implemented on android'),
    )
    const handler = vi.fn()

    await expect(
      platform.setPictureInPictureAutoEnter(true),
    ).resolves.toBeUndefined()
    const stop = platform.onPictureInPicture(handler)
    await settle()

    expect(() => {
      stop()
    }).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('reports the window coming and going', async () => {
    const platform = await loadPlatform(true)
    pictureInPicture.addListener.mockResolvedValue(listenerHandle())
    const handler = vi.fn()

    platform.onPictureInPicture(handler)
    await settle()

    expect(pictureInPicture.addListener.mock.calls[0]?.[0]).toBe(
      'pictureInPictureChange',
    )
    const emit = pictureInPicture.addListener.mock.calls[0]?.[1] as (state: {
      inPictureInPicture?: boolean
    }) => void
    emit({ inPictureInPicture: true })
    emit({ inPictureInPicture: false })
    emit({})

    expect(handler.mock.calls).toEqual([[true], [false], [false]])
  })

  it('removes a listener unsubscribed before its handle arrived', async () => {
    const platform = await loadPlatform(true)
    const handle = listenerHandle()
    pictureInPicture.addListener.mockResolvedValue(handle)

    const stop = platform.onPictureInPicture(vi.fn())
    stop()
    await settle()
    await settle()

    expect(handle.remove).toHaveBeenCalledTimes(1)
  })
})
