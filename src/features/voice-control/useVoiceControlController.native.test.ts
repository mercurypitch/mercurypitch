// ============================================================
// Voice control does not start by itself in the native app
// ============================================================
//
// The controller opened a recognizer at launch whenever the persisted flag
// was on, on every build. The native app has no place for voice control yet
// (no pill, and no header for one to dock in), so a flag carried over from an
// earlier build, or synced from the web, opened the mic with nothing on
// screen to show it or stop it; on iOS, with no speech-recognition usage
// string in Info.plist, the start most likely failed with a browser-worded
// toast instead.
//
// In the native build nothing opens one by itself: not the flag at launch,
// not the end of a sung take, not an engine switch. The flag is read and
// never written, so the web, and the sync that carries it there, keeps it.
// The web's behaviour is checked alongside, on the same harness.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listeners = vi.hoisted(() => ({
  webspeech: { isSupported: true, start: vi.fn(), stop: vi.fn() },
  local: { isSupported: true, start: vi.fn(), stop: vi.fn() },
}))
const notified = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('./webspeech-listener', () => ({
  createWebSpeechListener: () => listeners.webspeech,
}))
vi.mock('./local-whisper-listener', () => ({
  createLocalWhisperListener: () => listeners.local,
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string) => {
    notified.calls.push(message)
    return 1
  },
  showActionNotification: (message: string) => {
    notified.calls.push(message)
    return 1
  },
  removeNotification: vi.fn(),
}))

/** Where the controller persists "voice control is on". */
const FLAG = 'pitchperfect_voice_control_enabled'

/** Every recognizer start, across both engines. */
const starts = (): number =>
  listeners.webspeech.start.mock.calls.length +
  listeners.local.start.mock.calls.length

let dispose: (() => void) | null = null

/**
 * A controller mounted from a fresh module graph, built as the native app or
 * as the web one: `IS_NATIVE_BUILD` is a build constant, so each case
 * imports the controller again under its own answer.
 */
async function mount(isNative: boolean) {
  vi.resetModules()
  vi.doMock('@/lib/native-build', () => ({
    IS_NATIVE_BUILD: isNative,
    CAN_TAKE_PAYMENT: !isNative,
  }))
  const { createRoot } = await import('solid-js')
  const { useVoiceControlController } =
    await import('./useVoiceControlController')
  const mic = await import('@/stores/mic-store')
  const settings = await import('@/stores/settings-store')
  let controller!: ReturnType<typeof useVoiceControlController>
  createRoot((d) => {
    dispose = d
    controller = useVoiceControlController()
  })
  return { controller, mic, settings }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  notified.calls = []
  for (const listener of [listeners.webspeech, listeners.local]) {
    listener.start.mockClear()
    listener.stop.mockClear()
  }
  // Left on from an earlier session, or synced from the web.
  localStorage.setItem(FLAG, 'true')
})

afterEach(() => {
  dispose?.()
  dispose = null
  vi.doUnmock('@/lib/native-build')
})

describe('voice control in the native app', () => {
  it('opens no recognizer at launch, and leaves the flag on', async () => {
    const { controller } = await mount(true)

    expect(starts()).toBe(0)
    expect(controller.enabled()).toBe(true)
    expect(localStorage.getItem(FLAG)).toBe('true')
    expect(notified.calls).toEqual([])
  })

  it('opens none when a sung take ends', async () => {
    const { mic } = await mount(true)

    mic.setSingingCaptureActive(true)
    mic.setSingingCaptureActive(false)

    expect(starts()).toBe(0)
    expect(localStorage.getItem(FLAG)).toBe('true')
  })

  it('opens none when the engine is switched', async () => {
    const { settings } = await mount(true)

    settings.setVoiceControlEngine('local')

    expect(starts()).toBe(0)
    expect(localStorage.getItem(FLAG)).toBe('true')
    expect(notified.calls).toEqual([])
  })
})

describe('voice control on the web, unchanged', () => {
  it('opens the recognizer at launch when the flag is on', async () => {
    await mount(false)

    expect(listeners.webspeech.start).toHaveBeenCalledTimes(1)
  })

  it('opens it again when a sung take ends', async () => {
    const { mic } = await mount(false)

    mic.setSingingCaptureActive(true)
    mic.setSingingCaptureActive(false)

    expect(listeners.webspeech.start).toHaveBeenCalledTimes(2)
  })

  it('swaps to the new engine when the engine is switched', async () => {
    const { settings } = await mount(false)

    settings.setVoiceControlEngine('local')

    expect(listeners.local.start).toHaveBeenCalledTimes(1)
  })
})
