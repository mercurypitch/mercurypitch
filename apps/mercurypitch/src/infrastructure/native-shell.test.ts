// ============================================================
// Native shell wiring — background parks the clock, back does not exit
// ============================================================
//
// The back button is the one worth a test rather than a read-through: a
// handler that registers and then does nothing is worse than no handler at
// all, because registering turns Capacitor's own default off and its default
// is what kept the app alive.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installNativeShell } from './native-shell'

const audio = vi.hoisted(() => ({ suspendSharedAudioContext: vi.fn() }))
const platform = vi.hoisted(() => ({
  minimizeApp: vi.fn(async () => true),
  onAppState: vi.fn(),
  onBackButton: vi.fn(),
}))

vi.mock('@irchiinnuss/audio-io', () => audio)
vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

type AppStateHandler = (state: 'active' | 'background') => void
type BackHandler = (event: { canGoBack: boolean }) => void

function appStateHandler(): AppStateHandler {
  return platform.onAppState.mock.calls[0]?.[0] as AppStateHandler
}

function backHandler(): BackHandler {
  return platform.onBackButton.mock.calls[0]?.[0] as BackHandler
}

beforeEach(() => {
  vi.clearAllMocks()
  platform.onAppState.mockReturnValue(vi.fn())
  platform.onBackButton.mockReturnValue(vi.fn())
})

describe('the app leaving the foreground', () => {
  it('parks the shared clock', () => {
    installNativeShell({ history: null })

    appStateHandler()('background')

    expect(audio.suspendSharedAudioContext).toHaveBeenCalledTimes(1)
  })

  it('does not wake it on the way back in', () => {
    // iOS lifts a suspended context only inside a user gesture, so the next
    // tap does this. A resume from here is one the platform refuses.
    installNativeShell({ history: null })

    appStateHandler()('background')
    appStateHandler()('active')

    expect(audio.suspendSharedAudioContext).toHaveBeenCalledTimes(1)
  })
})

describe('the Android back button', () => {
  it('goes back while the WebView has somewhere to go', () => {
    const history = { length: 3, back: vi.fn() }
    installNativeShell({ history })

    backHandler()({ canGoBack: true })

    expect(history.back).toHaveBeenCalledTimes(1)
    expect(platform.minimizeApp).not.toHaveBeenCalled()
  })

  it('minimizes rather than exiting from the first screen', () => {
    // Capacitor's default here is to exit, which loses whatever the person
    // had open. Minimizing leaves the app where they can come back to it.
    const history = { length: 1, back: vi.fn() }
    installNativeShell({ history })

    backHandler()({ canGoBack: false })

    expect(history.back).not.toHaveBeenCalled()
    expect(platform.minimizeApp).toHaveBeenCalledTimes(1)
  })

  it('minimizes when there is no history object at all', () => {
    installNativeShell({ history: null })

    backHandler()({ canGoBack: false })

    expect(platform.minimizeApp).toHaveBeenCalledTimes(1)
  })
})

describe('teardown', () => {
  it('removes both listeners', () => {
    const stopState = vi.fn()
    const stopBack = vi.fn()
    platform.onAppState.mockReturnValue(stopState)
    platform.onBackButton.mockReturnValue(stopBack)

    installNativeShell({ history: null })()

    expect(stopState).toHaveBeenCalledTimes(1)
    expect(stopBack).toHaveBeenCalledTimes(1)
  })
})
