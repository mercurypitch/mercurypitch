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

  it('lets a local-buffer consumer replace a context that WebKit left silent', async () => {
    const { installAudioUnlock } = await import('@/lib/audio-unlock')
    const context = createAudioContext()
    const rebuild = vi.fn()
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
      { onBackgroundReturn: rebuild },
    )

    setVisibility('hidden')
    setVisibility('visible')

    expect(rebuild).toHaveBeenCalledOnce()
    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.resume).not.toHaveBeenCalled()
    uninstall()
  })

  it('keeps the clip off AirPlay, whose offer of it greeted the app opening', async () => {
    const { unlockAudio } = await import('@/lib/audio-unlock')

    unlockAudio(null)

    const clip = vi.mocked(Audio).mock.results[0]?.value as {
      disableRemotePlayback?: boolean
      setAttribute: ReturnType<typeof vi.fn>
    }
    expect(clip.disableRemotePlayback).toBe(true)
    expect(clip.setAttribute).toHaveBeenCalledWith('x-webkit-airplay', 'deny')
    expect(playSilent).toHaveBeenCalledOnce()
  })

  it('stands the clip aside while another element holds the session', async () => {
    const { standUnlockClipAside, unlockAudio } =
      await import('@/lib/audio-unlock')
    const context = createAudioContext('suspended')
    unlockAudio(context as unknown as AudioContext)
    const clip = vi.mocked(Audio).mock.results[0]?.value as { muted?: boolean }
    expect(clip.muted).toBe(false)

    standUnlockClipAside(true)
    context.state = 'suspended'
    unlockAudio(context as unknown as AudioContext)

    // Muted, WebKit never offers it to the lock screen, and it is not played.
    expect(clip.muted).toBe(true)
    expect(playSilent).toHaveBeenCalledOnce()
    // The context still wakes inside the gesture.
    expect(context.resume).toHaveBeenCalledTimes(2)
  })

  it('brings the clip back muted, to play again at the next tap', async () => {
    const { installAudioUnlock, standUnlockClipAside, unlockAudio } =
      await import('@/lib/audio-unlock')
    const context = createAudioContext()
    unlockAudio(context as unknown as AudioContext)
    const clip = vi.mocked(Audio).mock.results[0]?.value as { muted?: boolean }
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
    )
    standUnlockClipAside(true)

    standUnlockClipAside(false)
    // Unmuted at once, it would keep the app on the lock screen.
    expect(clip.muted).toBe(true)

    document.dispatchEvent(new Event('pointerup'))

    expect(clip.muted).toBe(false)
    expect(playSilent).toHaveBeenCalledTimes(2)
    uninstall()
  })

  it('takes the session with the clip before the clock, for a press of play', async () => {
    const { unlockForPlayback } = await import('@/lib/audio-unlock')
    const context = createAudioContext('suspended')
    const ensure = vi.fn(() => context as unknown as AudioContext)

    expect(unlockForPlayback(ensure)).toBe(context)

    expect(playSilent).toHaveBeenCalledBefore(ensure)
    expect(ensure).toHaveBeenCalledBefore(context.resume)
  })

  it('has the carrier take the session while the clip stands aside', async () => {
    const { standUnlockClipAside, unlockForPlayback } =
      await import('@/lib/audio-unlock')
    const context = createAudioContext('interrupted' as AudioContextState)
    const take = vi.fn()
    standUnlockClipAside(true, take)

    unlockForPlayback(() => context as unknown as AudioContext)

    expect(take).toHaveBeenCalledBefore(context.resume)
    expect(playSilent).not.toHaveBeenCalled()
  })

  it('never has the carrier take the session for a tap that is not play', async () => {
    const { installAudioUnlock, standUnlockClipAside, unlockAudio } =
      await import('@/lib/audio-unlock')
    const context = createAudioContext('suspended')
    const take = vi.fn()
    standUnlockClipAside(true, take)
    const uninstall = installAudioUnlock(
      () => context as unknown as AudioContext,
    )

    unlockAudio(context as unknown as AudioContext)
    document.dispatchEvent(new Event('pointerup'))

    expect(take).not.toHaveBeenCalled()
    uninstall()
  })

  it('forgets the carrier once the clip is back', async () => {
    const { standUnlockClipAside, unlockForPlayback } =
      await import('@/lib/audio-unlock')
    const take = vi.fn()
    standUnlockClipAside(true, take)
    standUnlockClipAside(false)

    unlockForPlayback(() => null)

    expect(take).not.toHaveBeenCalled()
    expect(playSilent).toHaveBeenCalledOnce()
  })

  it.each(['a tap', 'the page coming back'])(
    'leaves a context another app interrupted alone on %s',
    async (event) => {
      const { installAudioUnlock } = await import('@/lib/audio-unlock')
      const context = createAudioContext('interrupted' as AudioContextState)
      const uninstall = installAudioUnlock(
        () => context as unknown as AudioContext,
      )

      if (event === 'a tap') {
        document.dispatchEvent(new Event('pointerup'))
      } else {
        setVisibility('hidden')
        setVisibility('visible')
      }
      await Promise.resolve()

      // A resume here would take the sound back from the other app.
      expect(context.resume).not.toHaveBeenCalled()
      expect(context.suspend).not.toHaveBeenCalled()
      expect(playSilent).not.toHaveBeenCalled()
      uninstall()
    },
  )

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

  // Over AirPlay, Web Audio reached the TV only with no element playing
  // beside it (the AirPlay sound check, 6 Nov 2026).
  describe('on AirPlay alone', () => {
    it('neither plays nor sounds the clip on a tap, and still wakes the clock', async () => {
      const { keepUnlockClipQuiet, unlockAudio } =
        await import('@/lib/audio-unlock')
      const context = createAudioContext('suspended')
      unlockAudio(context as unknown as AudioContext)
      const clip = vi.mocked(Audio).mock.results[0]?.value as {
        muted?: boolean
      }
      vi.spyOn(console, 'info').mockImplementation(() => undefined)

      keepUnlockClipQuiet(true)
      context.state = 'suspended'
      unlockAudio(context as unknown as AudioContext)

      expect(clip.muted).toBe(true)
      expect(playSilent).toHaveBeenCalledOnce()
      expect(context.resume).toHaveBeenCalledTimes(2)
    })

    it('starts only the clock for a press of play', async () => {
      const { keepUnlockClipQuiet, unlockForPlayback } =
        await import('@/lib/audio-unlock')
      const context = createAudioContext('suspended')
      vi.spyOn(console, 'info').mockImplementation(() => undefined)
      keepUnlockClipQuiet(true)

      expect(unlockForPlayback(() => context as unknown as AudioContext)).toBe(
        context,
      )

      expect(playSilent).not.toHaveBeenCalled()
      expect(context.resume).toHaveBeenCalledOnce()
    })

    it('plays the clip again at the next tap once the sound leaves AirPlay', async () => {
      const { installAudioUnlock, keepUnlockClipQuiet, unlockAudio } =
        await import('@/lib/audio-unlock')
      const context = createAudioContext()
      vi.spyOn(console, 'info').mockImplementation(() => undefined)
      keepUnlockClipQuiet(true)
      unlockAudio(context as unknown as AudioContext)
      const uninstall = installAudioUnlock(
        () => context as unknown as AudioContext,
      )
      document.dispatchEvent(new Event('pointerup'))
      expect(playSilent).not.toHaveBeenCalled()

      keepUnlockClipQuiet(false)
      document.dispatchEvent(new Event('pointerup'))

      expect(playSilent).toHaveBeenCalledOnce()
      uninstall()
    })

    it('says each change once in the console', async () => {
      const { keepUnlockClipQuiet } = await import('@/lib/audio-unlock')
      const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

      keepUnlockClipQuiet(true)
      keepUnlockClipQuiet(true)
      keepUnlockClipQuiet(false)
      keepUnlockClipQuiet(false)

      expect(info.mock.calls.map(([line]) => String(line))).toEqual([
        "[audio unlock] the sound is on AirPlay: the unlock clip stays quiet, so the room's sound plays alone",
        '[audio unlock] the sound has left AirPlay: the next tap plays the unlock clip again',
      ])
    })
  })
})
