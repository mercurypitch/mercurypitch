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
  setLyrics: vi.fn(),
  setClock: vi.fn(),
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

/** A song's lyrics as the iOS window takes them: one line, then a rest. */
const SCRIPT = {
  title: 'Harbour Lights',
  duration: 246,
  segments: [
    { at: 0, current: [], next: 'Hold the rope', words: [] },
    {
      at: 10,
      current: ['Hold', 'the', 'rope'],
      next: null,
      words: [
        [10, 11],
        [11, 12],
        [12, 13],
      ] as [number, number][],
    },
    { at: 14, current: [], next: null, words: [] },
  ],
}

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
    [
      'setPictureInPictureLyrics',
      (p: Platform) => p.setPictureInPictureLyrics(SCRIPT),
    ],
    ['claimNowPlaying', (p: Platform) => p.claimNowPlaying()],
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
    const stopHolding = platform.onNowPlayingHoldsAudio(handler)
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
      stopHolding()
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
    // The position goes first and last. The plugin shows the last position
    // it holds whenever it publishes, so it has to be in place before the
    // metadata and the state go out; the last write was for the plugin's iOS
    // half (see setNowPlaying).
    expect(order).toEqual(['position', 'metadata', 'state', 'position'])
  })

  it('reports a paused song as paused', async () => {
    const platform = await loadPlatform(true)

    await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })

    expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
      playbackState: 'paused',
    })
  })

  it('clears the artist when the next song has none', async () => {
    // The plugin keeps any field a report leaves out, so a song without an
    // artist would show the last song's.
    const platform = await loadPlatform(true)

    await platform.setNowPlaying({
      title: 'Harbour Lights',
      artist: 'The Wharf',
      playing: true,
    })
    await platform.setNowPlaying({ title: 'Low Tide', playing: true })

    expect(mediaSession.setMetadata).toHaveBeenLastCalledWith({
      title: 'Low Tide',
      artist: '',
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

  // The notification's progress bar (Android) draws from the position state
  // alone: the length, where the song is, and how fast it moves. The system runs the bar on from the last report, so a
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

      const bar = { duration: 246, position: 42.5, playbackRate: 1.25 }
      // The same numbers twice: before the writes that show them, and after.
      expect(mediaSession.setPositionState.mock.calls).toEqual([[bar], [bar]])
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
      ).toEqual([42.5, 42.5, 180, 180, 12, 12])
    })

    // The system's player as the plugins drive it. Each keeps the last
    // position it was given and shows it again, stamped now, on every write
    // that publishes: Android on a new state and on a position, iOS on any
    // call at all, since it rewrites its whole Now Playing record each time.
    const watchTheBar = (): number[] => {
      const shown: number[] = []
      let place = 0
      const show = async (): Promise<void> => {
        shown.push(place)
      }
      mediaSession.setMetadata.mockImplementation(show)
      mediaSession.setPlaybackState.mockImplementation(show)
      mediaSession.setPositionState.mockImplementation(
        async (state: { position: number }) => {
          place = state.position
          shown.push(place)
        },
      )
      return shown
    }

    it('pauses the bar where the song stopped, not where it last started', async () => {
      // A run started from a tapped line at 1:18 and played on to 2:01, the
      // system running the bar on from the 1:18 report by itself. Pause in
      // the notification must not put the bar back at 1:18, not for a frame.
      const platform = await loadPlatform(true)
      const shown = watchTheBar()
      const song = { title: 'Harbour Lights', duration: 246 }
      await platform.setNowPlaying({ ...song, playing: true, position: 78 })
      shown.length = 0

      await platform.setNowPlaying({ ...song, playing: false, position: 121 })

      expect(shown).not.toContain(78)
      expect(new Set(shown)).toEqual(new Set([121]))
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
      const unimplemented = new Error('Unimplemented')
      mediaSession.setPositionState
        .mockRejectedValueOnce(unimplemented)
        .mockRejectedValueOnce(unimplemented)

      await expect(
        platform.setNowPlaying({
          title: 'Harbour Lights',
          playing: true,
          position: 1,
          duration: 246,
        }),
      ).resolves.toBeUndefined()
      expect(mediaSession.setPositionState).toHaveBeenCalledTimes(2)
      expect(mediaSession.setMetadata).toHaveBeenCalledWith({
        title: 'Harbour Lights',
        artist: '',
      })
      expect(mediaSession.setPlaybackState).toHaveBeenCalledWith({
        playbackState: 'playing',
      })
    })
  })

  // Android's player draws the picture behind the song. Its native half
  // cannot load an app URL, so it goes as data (to WebKit too, see 'on iOS').
  describe("the song's picture", () => {
    const PICTURE = '/now-playing.webp'
    /** The bytes 1, 2, 3, as iOS serves a bundled file: status 0, a body. */
    const servePicture = (): ReturnType<typeof vi.fn> => {
      const fetch = vi.fn(async () => ({
        ok: false,
        status: 0,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }))
      vi.stubGlobal('fetch', fetch)
      return fetch
    }
    const pictureSent = (call: number): unknown =>
      (mediaSession.setMetadata.mock.calls[call]?.[0] as { artwork?: unknown })
        ?.artwork

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('hands the picture over as data, read once for every report', async () => {
      const platform = await loadPlatform(true)
      const fetch = servePicture()
      const song = { title: 'Harbour Lights', artwork: PICTURE }

      await platform.setNowPlaying({ ...song, playing: true })
      await platform.setNowPlaying({ ...song, playing: false })

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch.mock.calls[0]?.[0]).toBe(PICTURE)
      const data = [{ src: 'data:image/webp;base64,AQID' }]
      expect(pictureSent(0)).toEqual(data)
      expect(pictureSent(1)).toEqual(data)
    })

    it('names the song without a picture it cannot read, and reads it next time', async () => {
      const platform = await loadPlatform(true)
      const fetch = servePicture()
      fetch.mockRejectedValueOnce(new Error('offline'))
      const song = { title: 'Harbour Lights', playing: true, artwork: PICTURE }

      await platform.setNowPlaying(song)
      expect(mediaSession.setMetadata).toHaveBeenLastCalledWith({
        title: 'Harbour Lights',
        artist: '',
      })

      await platform.setNowPlaying(song)
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(pictureSent(1)).toEqual([{ src: 'data:image/webp;base64,AQID' }])
    })

    it('lands reports in the order they were made, however long a picture takes', async () => {
      // A plugin that answers setMetadata only once it has decoded the
      // picture, and its state and position calls at once, must not let a
      // pause reported just before a play land after it.
      const platform = await loadPlatform(true)
      servePicture()
      const song = {
        title: 'Harbour Lights',
        position: 121,
        duration: 246,
        artwork: PICTURE,
      }
      let decoded: (() => void) | undefined
      mediaSession.setMetadata.mockImplementationOnce(
        async () =>
          new Promise<void>((resolve) => {
            decoded = resolve
          }),
      )

      const paused = platform.setNowPlaying({ ...song, playing: false })
      // Play pressed while iOS is still decoding the pause's picture.
      await vi.waitFor(() => {
        expect(decoded).toBeDefined()
      })
      const played = platform.setNowPlaying({ ...song, playing: true })
      await settle()
      decoded?.()
      await Promise.all([paused, played])

      expect(
        mediaSession.setPlaybackState.mock.calls.map(
          ([options]) => (options as { playbackState: string }).playbackState,
        ),
      ).toEqual(['paused', 'playing'])
      expect(mediaSession.setPositionState.mock.calls.at(-1)?.[0]).toEqual({
        duration: 246,
        position: 121,
        playbackRate: 1,
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
    // The lock screen's Now Playing is WebKit's (webkit-now-playing.ts): the
    // song goes to navigator.mediaSession beside a silent carrier, and the
    // plugin, whose MPNowPlayingInfoCenter never shows, is not even loaded.
    // Both stand-ins are the least the platform layer needs; the carrier's
    // own behavior is tested beside it.
    class Carrier extends EventTarget {
      loop = false
      preload = ''
      disableRemotePlayback = false
      paused = true
      private source: string | null = null
      readonly play = vi.fn(async () => {
        this.paused = false
        this.dispatchEvent(new Event('play'))
      })
      readonly pause = vi.fn(() => {
        if (this.paused) return
        this.paused = true
        this.dispatchEvent(new Event('pause'))
      })
      readonly load = vi.fn()
      get src(): string {
        return this.source ?? ''
      }
      set src(value: string) {
        this.source = value
      }
      hasAttribute(name: string): boolean {
        return name === 'src' && this.source !== null
      }
      removeAttribute(name: string): void {
        if (name === 'src') this.source = null
      }
    }
    class Metadata {
      constructor(readonly init: object) {}
    }
    const webKit = {
      metadata: null as Metadata | null,
      playbackState: 'none',
      setPositionState: vi.fn(),
      setActionHandler: vi.fn(),
    }
    let carrier: Carrier

    async function loadOnIos(): Promise<Platform> {
      const platform = await loadPlatform(true, 'ios')
      // The module instance the platform just imported, after the reset.
      const { resetWebKitNowPlaying } = await import('./webkit-now-playing')
      resetWebKitNowPlaying({
        createCarrier: () => carrier as never,
        silence: () => 'blob:silence',
      })
      return platform
    }

    const press = (action: string, details: object): void => {
      const call = webKit.setActionHandler.mock.calls.find(
        ([name]) => name === action,
      )
      ;(call?.[1] as (details: object) => void)(details)
    }

    /** The lyrics window's button, as the plugin sends it. */
    const windowPress = (): ((event: object) => void) => {
      const window = pictureInPicture.addListener.mock.calls.find(
        ([event]) => event === 'pictureInPictureAction',
      )
      return window?.[1] as (event: object) => void
    }

    beforeEach(() => {
      carrier = new Carrier()
      webKit.metadata = null
      webKit.playbackState = 'none'
      vi.stubGlobal('navigator', { mediaSession: webKit })
      vi.stubGlobal('MediaMetadata', Metadata)
      vi.spyOn(console, 'info').mockImplementation(() => undefined)
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('shows the song through WebKit, its picture as data, never through the plugin', async () => {
      const platform = await loadOnIos()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          status: 0,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        })),
      )

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        artist: 'The Wharf',
        artwork: '/now-playing.webp',
        playing: true,
        position: 121,
        duration: 246,
        // WebKit refuses a rate of 0.
        rate: 0,
      })

      expect(webKit.metadata?.init).toEqual({
        title: 'Harbour Lights',
        artist: 'The Wharf',
        artwork: [{ src: 'data:image/webp;base64,AQID' }],
      })
      expect(webKit.playbackState).toBe('playing')
      expect(webKit.setPositionState).toHaveBeenLastCalledWith({
        duration: 246,
        playbackRate: 1,
        position: 121,
      })
      expect(carrier.play).toHaveBeenCalledTimes(1)
      expect(loaded).not.toContain('@capgo/capacitor-media-session')
      expect(mediaSession.setMetadata).not.toHaveBeenCalled()
    })

    it('takes the song away again', async () => {
      const platform = await loadOnIos()
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      expect(webKit.metadata).not.toBeNull()
      expect(carrier.hasAttribute('src')).toBe(true)

      await platform.setNowPlaying(null)

      expect(webKit.metadata).toBeNull()
      expect(webKit.playbackState).toBe('none')
      expect(carrier.hasAttribute('src')).toBe(false)
    })

    it('hears the lock screen through WebKit, seeks and skips included', async () => {
      const platform = await loadOnIos()
      const handler = vi.fn()

      const stop = platform.onMediaAction(handler)
      press('pause', { action: 'pause' })
      press('seekto', { action: 'seekto', seekTime: 61.5 })
      press('play', { action: 'play' })
      press('seekforward', { action: 'seekforward', seekOffset: 15 })
      press('seekbackward', { action: 'seekbackward' })
      // iOS's own buttons say 10 s: a skip with no use of an offset is that.
      press('seekforward', { action: 'seekforward', seekOffset: -5 })

      expect(handler.mock.calls).toEqual([
        ['pause'],
        [{ seekTo: 61.5 }],
        ['play'],
        [{ skipBy: 15 }],
        [{ skipBy: -10 }],
        [{ skipBy: 10 }],
      ])

      stop()
      expect(webKit.setActionHandler).toHaveBeenCalledWith('seekto', null)
      expect(webKit.setActionHandler).toHaveBeenLastCalledWith(
        'seekforward',
        null,
      )
      await settle()
      expect(loaded).not.toContain('@capgo/capacitor-media-session')
    })

    it('pauses the room when the system pauses the song', async () => {
      const platform = await loadOnIos()
      const handler = vi.fn()
      platform.onMediaAction(handler)
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })

      // Another app took the sound: WebKit pauses the carrier.
      carrier.paused = true
      carrier.dispatchEvent(new Event('pause'))

      expect(handler.mock.calls).toEqual([['pause']])
    })

    it('has the carrier take the sound first on a press of play', async () => {
      const platform = await loadOnIos()
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })

      platform.claimNowPlaying()

      expect(carrier.play).toHaveBeenCalledTimes(2)
    })

    it('keeps the system’s pause when the song heard the interruption first', async () => {
      const platform = await loadOnIos()
      const handler = vi.fn()
      platform.onMediaAction(handler)
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })

      // Another app took the sound, and the song's clock said so first.
      carrier.paused = true
      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: false,
        interrupted: true,
      })
      // A call ends with the word to resume: WebKit plays the carrier again.
      carrier.paused = false
      carrier.dispatchEvent(new Event('play'))

      expect(carrier.pause).not.toHaveBeenCalled()
      expect(handler.mock.calls).toEqual([['play']])
    })

    it('tells the app while the carrier holds the playback session', async () => {
      const platform = await loadOnIos()
      const holds = vi.fn()

      const stop = platform.onNowPlayingHoldsAudio(holds)
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      // The carrier sounding is what takes the session, not the report.
      expect(holds).not.toHaveBeenCalled()
      carrier.dispatchEvent(new Event('playing'))
      await platform.setNowPlaying(null)
      stop()
      await platform.setNowPlaying({ title: 'Low Tide', playing: true })
      carrier.dispatchEvent(new Event('playing'))

      expect(holds.mock.calls).toEqual([[true], [false]])
    })

    it('gives the lyrics window the clock with every report', async () => {
      const platform = await loadOnIos()
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        position: 121,
        duration: 246,
        rate: 0,
      })
      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: false,
        position: 300,
        duration: 246,
        rate: 0.75,
      })
      await platform.setNowPlaying({ title: 'Low Tide', playing: true })
      await platform.setNowPlaying(null)

      expect(pictureInPicture.setClock.mock.calls).toEqual([
        [
          {
            playing: true,
            position: 121,
            rate: 1,
            duration: 246,
            interrupted: false,
          },
        ],
        [
          {
            playing: false,
            position: 246,
            rate: 0.75,
            duration: 246,
            interrupted: false,
          },
        ],
        [
          {
            playing: true,
            position: 0,
            rate: 1,
            duration: 0,
            interrupted: false,
          },
        ],
      ])
    })

    it('tells the lyrics window when the system paused the song', async () => {
      // Behind another app's sound the window closes (LyricsWindow.swift).
      const platform = await loadOnIos()
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())
      const interrupted = (): unknown[] =>
        pictureInPicture.setClock.mock.calls.map(
          ([clock]) => (clock as { interrupted: boolean }).interrupted,
        )
      platform.onMediaAction(vi.fn())

      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: false,
        interrupted: true,
      })
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      // The carrier's pause came first: the room heard it as a press.
      carrier.paused = true
      carrier.dispatchEvent(new Event('pause'))
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })
      // The singer's own pause is not the system's.
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })

      expect(interrupted()).toEqual([false, true, false, true, false, false])
    })

    it('never tells the window a playing song was paused by the system', async () => {
      const platform = await loadOnIos()
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())

      await platform.setNowPlaying({
        title: 'Harbour Lights',
        playing: true,
        interrupted: true,
      })

      expect(pictureInPicture.setClock).toHaveBeenLastCalledWith(
        expect.objectContaining({ playing: true, interrupted: false }),
      )
    })

    it("hears the lyrics window's play and pause as a lock-screen press", async () => {
      const platform = await loadOnIos()
      const handle = listenerHandle()
      pictureInPicture.addListener.mockResolvedValue(handle)
      const handler = vi.fn()

      const stop = platform.onMediaAction(handler)
      await settle()
      const window = pictureInPicture.addListener.mock.calls.find(
        ([event]) => event === 'pictureInPictureAction',
      )
      const press = window?.[1] as (event: { action?: unknown }) => void
      press({ action: 'pause' })
      press({ action: 'play' })
      press({ action: 'skip' })
      press({})
      stop()

      expect(handler.mock.calls).toEqual([['pause'], ['play']])
      expect(handle.remove).toHaveBeenCalled()
    })

    it('drops a press of the lyrics window that waited while the app slept', async () => {
      const platform = await loadOnIos()
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())
      const handler = vi.fn()

      platform.onMediaAction(handler)
      await settle()
      windowPress()({ action: 'play', at: Date.now() - 60_000 })
      windowPress()({ action: 'pause', at: Date.now() - 1000 })

      expect(handler.mock.calls).toEqual([['pause']])
      expect(console.info).toHaveBeenCalledWith(
        '[lyrics window] play waited 60 s while the app slept: dropped',
      )
    })

    it("leaves the song paused when the window's play cannot take the sound", async () => {
      const platform = await loadOnIos()
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())
      const handler = vi.fn()
      platform.onMediaAction(handler)
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
      await platform.setNowPlaying({ title: 'Harbour Lights', playing: false })
      await settle()

      // WebKit starts an element inside play(), or not at all.
      carrier.play.mockRejectedValueOnce(
        new DOMException('Not now', 'NotAllowedError'),
      )
      windowPress()({ action: 'play', otherAudio: true })
      expect(handler).not.toHaveBeenCalled()

      windowPress()({ action: 'play', otherAudio: true })
      expect(handler.mock.calls).toEqual([['play']])
      expect(carrier.paused).toBe(false)
    })

    it('shows nothing, and loads nothing, in a WebView without the API', async () => {
      vi.stubGlobal('navigator', {})
      const platform = await loadOnIos()

      await expect(
        platform.setNowPlaying({ title: 'Harbour Lights', playing: true }),
      ).resolves.toBeUndefined()
      platform.onMediaAction(vi.fn())()
      const holds = vi.fn()
      platform.onNowPlayingHoldsAudio(holds)()
      await settle()

      expect(carrier.play).not.toHaveBeenCalled()
      expect(holds).not.toHaveBeenCalled()
      expect(loaded).not.toContain('@capgo/capacitor-media-session')
    })
  })

  it('has no lock-screen carrier on Android, so nothing to hear of one', async () => {
    const platform = await loadPlatform(true)
    const holds = vi.fn()

    const stop = platform.onNowPlayingHoldsAudio(holds)
    await platform.setNowPlaying({ title: 'Harbour Lights', playing: true })
    stop()

    expect(holds).not.toHaveBeenCalled()
  })

  it('registers the buttons a platform has, and clears only those', async () => {
    // A platform may not know every button. One refusal must not cost the
    // others.
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

  it('turns auto-enter on and off on iOS, and writes what the window says to the console', async () => {
    const platform = await loadPlatform(true, 'ios')
    pictureInPicture.addListener.mockResolvedValue(listenerHandle())
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await platform.setPictureInPictureAutoEnter(true)
    await platform.setPictureInPictureAutoEnter(false)
    await settle()

    expect(registerPlugin.mock.calls).toEqual([['PictureInPicture']])
    expect(pictureInPicture.setAutoEnter.mock.calls).toEqual([
      [{ enabled: true }],
      [{ enabled: false }],
    ])
    const logs = pictureInPicture.addListener.mock.calls.filter(
      ([name]) => name === 'pictureInPictureLog',
    )
    expect(logs).toHaveLength(1)
    const say = logs[0]?.[1] as (event: { message?: unknown }) => void
    say({ message: 'armed: a song is playing' })
    say({})

    expect(info.mock.calls).toEqual([
      ['[lyrics window] armed: a song is playing'],
    ])
    info.mockRestore()
  })

  it("writes what iOS does to the app's sound to the console as well", async () => {
    const platform = await loadPlatform(true, 'ios')
    pictureInPicture.addListener.mockResolvedValue(listenerHandle())
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await platform.setPictureInPictureAutoEnter(true)
    await settle()

    const logs = pictureInPicture.addListener.mock.calls.filter(
      ([name]) => name === 'audioSessionLog',
    )
    expect(logs).toHaveLength(1)
    const say = logs[0]?.[1] as (event: { message?: unknown }) => void
    say({ message: "16:20:31.402 another app's sound started" })
    say({ message: 42 })

    expect(info.mock.calls).toEqual([
      ["[audio session] 16:20:31.402 another app's sound started"],
    ])
    info.mockRestore()
  })

  it('hands the iOS window the lyrics as JSON, and takes them away', async () => {
    const platform = await loadPlatform(true, 'ios')
    pictureInPicture.addListener.mockResolvedValue(listenerHandle())

    await platform.setPictureInPictureLyrics(SCRIPT)
    await platform.setPictureInPictureLyrics(null)

    const [given, taken] = pictureInPicture.setLyrics.mock.calls
    expect(JSON.parse((given?.[0] as { json: string }).json)).toEqual(SCRIPT)
    expect(taken).toEqual([{}])
  })

  it('sends no lyrics on Android, whose window shows the page itself', async () => {
    const platform = await loadPlatform(true)

    await platform.setPictureInPictureLyrics(SCRIPT)

    expect(registerPlugin).not.toHaveBeenCalled()
    expect(pictureInPicture.setLyrics).not.toHaveBeenCalled()
  })

  it('survives an iOS build with no plugin behind the name', async () => {
    const platform = await loadPlatform(true, 'ios')
    const missing = new Error(
      '"PictureInPicture" plugin is not implemented on ios',
    )
    pictureInPicture.addListener.mockRejectedValue(missing)
    pictureInPicture.setLyrics.mockRejectedValueOnce(missing)
    pictureInPicture.setAutoEnter.mockRejectedValueOnce(missing)

    await expect(
      platform.setPictureInPictureLyrics(SCRIPT),
    ).resolves.toBeUndefined()
    await expect(
      platform.setPictureInPictureAutoEnter(true),
    ).resolves.toBeUndefined()
    const stop = platform.onPictureInPicture(vi.fn())
    await settle()

    expect(() => {
      stop()
    }).not.toThrow()
    pictureInPicture.addListener.mockReset()
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

  it.each(['android', 'ios'] as const)(
    'reports the window coming and going on %s',
    async (name) => {
      const platform = await loadPlatform(true, name)
      pictureInPicture.addListener.mockResolvedValue(listenerHandle())
      const handler = vi.fn()

      platform.onPictureInPicture(handler)
      await settle()

      const change = pictureInPicture.addListener.mock.calls.find(
        ([event]) => event === 'pictureInPictureChange',
      )
      const emit = change?.[1] as (state: {
        inPictureInPicture?: boolean
      }) => void
      emit({ inPictureInPicture: true })
      emit({ inPictureInPicture: false })
      emit({})

      expect(handler.mock.calls).toEqual([[true], [false], [false]])
    },
  )

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
