// @vitest-environment jsdom
// ============================================================
// A local voice model that will not load hands over to the browser engine
// ============================================================
//
// On iOS neither whisper-tiny nor Moonshine loads at all, and the answer used
// to be a toast telling the singer to open Settings and change an engine they
// never chose deliberately. Until they did, voice control was simply broken
// on that device. So the failure switches the preference to the browser
// engine, keeps listening, and says what happened.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listeners = vi.hoisted(() => ({
  webspeech: {
    isSupported: true,
    start: vi.fn(),
    stop: vi.fn(),
  },
  local: {
    isSupported: true,
    start: vi.fn(),
    stop: vi.fn(),
  },
  /** The callbacks the controller handed to whichever listener it built. */
  callbacks: null as null | {
    onStateChange: (state: string, detail?: string) => void
  },
}))
const notified = vi.hoisted(() => ({
  calls: [] as string[],
  actions: [] as { label: string; onClick: () => void }[],
}))

vi.mock('./webspeech-listener', () => ({
  createWebSpeechListener: (callbacks: never) => {
    listeners.callbacks = callbacks
    return listeners.webspeech
  },
}))
vi.mock('./local-whisper-listener', () => ({
  createLocalWhisperListener: (callbacks: never) => {
    listeners.callbacks = callbacks
    return listeners.local
  },
}))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string) => {
    notified.calls.push(message)
    return 1
  },
  showActionNotification: (
    message: string,
    _type: string,
    action: { label: string; onClick: () => void },
  ) => {
    notified.calls.push(message)
    notified.actions.push(action)
    return 1
  },
  removeNotification: vi.fn(),
}))

import { setVoiceControlEngine, voiceControlEngine, } from '@/stores/settings-store'
import { armLocalModelAttempt, disarmLocalModelAttempt, } from './local-model-crash-guard'
import { useVoiceControlController } from './useVoiceControlController'

describe('local engine fallback', () => {
  let dispose: (() => void) | null = null

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    disarmLocalModelAttempt()
    notified.calls = []
    notified.actions = []
    listeners.callbacks = null
    listeners.webspeech.isSupported = true
    for (const listener of [listeners.webspeech, listeners.local]) {
      listener.start.mockClear()
      listener.stop.mockClear()
    }
    setVoiceControlEngine('local')
  })

  afterEach(() => {
    dispose?.()
    dispose = null
    setVoiceControlEngine('webspeech')
  })

  const mount = () => {
    let controller!: ReturnType<typeof useVoiceControlController>
    createRoot((d) => {
      dispose = d
      controller = useVoiceControlController()
    })
    return controller
  }

  it('switches the preference to the browser engine and keeps listening', () => {
    const controller = mount()
    controller.toggle()
    expect(listeners.local.start).toHaveBeenCalled()

    listeners.callbacks?.onStateChange('error', 'local-engine-failed')

    expect(voiceControlEngine()).toBe('webspeech')
    expect(listeners.webspeech.start).toHaveBeenCalled()
    expect(controller.enabled()).toBe(true)
    expect(notified.calls.join(' ')).toContain('browser engine')
  })

  it('turns voice control off when there is no browser engine to fall back to', () => {
    listeners.webspeech.isSupported = false
    const controller = mount()
    controller.toggle()

    listeners.callbacks?.onStateChange('error', 'local-engine-failed')

    expect(controller.enabled()).toBe(false)
    expect(listeners.webspeech.start).not.toHaveBeenCalled()
    expect(notified.calls.join(' ')).toContain('no speech engine')
  })
  // ── Coming back from a content-process kill ──────────────────
  //
  // The reload after a jetsam is not an error the listener can report: the
  // document that saw it is gone. All the new one has is a marker left armed
  // by the load that died, and starting the same load again is what turned
  // one reload into a dead tab on maff's iPhone 13.

  it('refuses the on-device engine when the last load killed the document', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()

    const controller = mount()

    expect(listeners.local.start).not.toHaveBeenCalled()
    expect(voiceControlEngine()).toBe('webspeech')
    expect(controller.enabled()).toBe(true)
    expect(notified.calls.join(' ')).toContain('more memory')
    // The whole point of switching rather than turning off: voice control
    // says it is on, so it had better be listening. A guard that stopped at
    // the preference would leave the pill lit over a deaf recognizer.
    expect(listeners.webspeech.start).toHaveBeenCalled()
  })

  it('starts normally when the last load merely failed', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()
    disarmLocalModelAttempt()

    mount()

    expect(listeners.local.start).toHaveBeenCalled()
    expect(voiceControlEngine()).toBe('local')
  })

  it('lets the next mount try again, so Settings can offer a retry', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()

    mount()
    dispose?.()
    dispose = null
    setVoiceControlEngine('local')
    listeners.local.start.mockClear()

    mount()

    expect(listeners.local.start).toHaveBeenCalled()
  })
  // ── The retry after a kill is asked for, not obeyed ──────────
  //
  // maff dismissed the toast, picked Whisper again, and the tab died for
  // good. The guard gave the retry back on purpose; what it must not do is
  // hand it over silently.

  it('asks before loading the model again in a document it already killed', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()
    mount()
    listeners.local.start.mockClear()

    setVoiceControlEngine('local')

    expect(listeners.local.start).not.toHaveBeenCalled()
    // And the preference does not sit there claiming an engine that never ran.
    expect(voiceControlEngine()).toBe('webspeech')
    expect(notified.calls.join(' ')).toContain('closed this tab')
    expect(notified.actions.at(-1)?.label).toBe('Try anyway')
  })

  it('loads the model when the retry is actually accepted', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()
    mount()
    setVoiceControlEngine('local')
    listeners.local.start.mockClear()

    notified.actions.at(-1)?.onClick()

    expect(voiceControlEngine()).toBe('local')
    expect(listeners.local.start).toHaveBeenCalled()
  })

  it('does not ask twice once the retry has been accepted', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    armLocalModelAttempt()
    mount()
    setVoiceControlEngine('local')
    notified.actions.at(-1)?.onClick()

    setVoiceControlEngine('webspeech')
    notified.actions = []
    listeners.local.start.mockClear()
    setVoiceControlEngine('local')

    expect(notified.actions).toHaveLength(0)
    expect(listeners.local.start).toHaveBeenCalled()
  })

  it('never asks in a document that did not see a kill', () => {
    localStorage.setItem('pitchperfect_voice_control_enabled', 'true')
    setVoiceControlEngine('webspeech')
    mount()
    listeners.local.start.mockClear()

    setVoiceControlEngine('local')

    expect(notified.actions).toHaveLength(0)
    expect(listeners.local.start).toHaveBeenCalled()
  })
})
