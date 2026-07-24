import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface RecoverableAudioContext {
  state: AudioContextState
  resume: ReturnType<typeof vi.fn>
  suspend: ReturnType<typeof vi.fn>
}

let playSilent: ReturnType<typeof vi.fn>

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

function createAudioContext(
  initialState: AudioContextState = 'running',
): RecoverableAudioContext {
  const context: RecoverableAudioContext = {
    state: initialState,
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended'
    }),
  }
  return context
}

describe('iOS audio unlock', () => {
  beforeEach(() => {
    vi.resetModules()
    playSilent = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(function MockAudio() {
        return {
          play: playSilent,
          preload: '',
          setAttribute: vi.fn(),
        }
      }),
    )
    setVisibility('visible')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates and unlocks the context inside the playback activation call', async () => {
    const { activateAudioPlayback } = await import('@/lib/audio-unlock')
    let context: RecoverableAudioContext | null = null
    const target = {
      init: vi.fn(() => {
        context = createAudioContext('suspended')
        return Promise.resolve()
      }),
      getAudioContext: vi.fn(() => context as unknown as AudioContext | null),
      resume: vi.fn().mockResolvedValue(undefined),
    }

    await activateAudioPlayback(target)

    expect(target.init).toHaveBeenCalledBefore(target.getAudioContext)
    expect(global.Audio).toHaveBeenCalledOnce()
    expect(context!.resume).toHaveBeenCalledOnce()
    expect(target.resume).toHaveBeenCalledOnce()
  })

  it('recycles a running context after returning from the background', async () => {
    const { installAudioUnlock } = await import('@/lib/audio-unlock')
    const context = createAudioContext()
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
    )

    setVisibility('hidden')
    setVisibility('visible')

    await vi.waitFor(() => {
      expect(context.suspend).toHaveBeenCalledOnce()
      expect(context.resume).toHaveBeenCalledOnce()
    })
    expect(context.suspend).toHaveBeenCalledBefore(context.resume)
    uninstall()
  })

  it('re-primes the playback session on the first gesture after backgrounding', async () => {
    const { installAudioUnlock, unlockAudio } =
      await import('@/lib/audio-unlock')
    const context = createAudioContext()

    unlockAudio(context as unknown as AudioContext)
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
    )

    setVisibility('hidden')
    setVisibility('visible')
    document.dispatchEvent(new Event('pointerup'))

    await vi.waitFor(() => {
      expect(playSilent).toHaveBeenCalledTimes(2)
    })
    uninstall()
  })

  it('does not recycle the context after its listener is removed', async () => {
    const { installAudioUnlock } = await import('@/lib/audio-unlock')
    const context = createAudioContext()
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
    )

    uninstall()
    setVisibility('hidden')
    setVisibility('visible')
    await Promise.resolve()

    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.resume).not.toHaveBeenCalled()
  })
})
