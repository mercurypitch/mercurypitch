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

import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    expect(order).toEqual(['metadata', 'state'])
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
    expect(registered).toEqual(['play', 'pause', 'stop'])
    for (const [options, press] of mediaSession.setActionHandler.mock.calls as [
      { action: string },
      () => void,
    ][]) {
      press()
      expect(handler).toHaveBeenLastCalledWith(options.action)
    }

    mediaSession.setActionHandler.mockClear()
    stop()
    await settle()

    expect(mediaSession.setActionHandler.mock.calls).toEqual([
      [{ action: 'play' }, null],
      [{ action: 'pause' }, null],
      [{ action: 'stop' }, null],
    ])
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
