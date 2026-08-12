import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const OFFERED_KEY = 'pitchperfect_mic_practice_offered'

/** The persisted flag is read at import time, so each case reloads the module. */
const loadNudge = async () => {
  vi.resetModules()
  return await import('@/features/mic-feedback/usePlaybackMicNudge')
}

interface Harness {
  setPlaying: (value: boolean) => void
  setMic: (value: boolean) => void
  onEnableMic: ReturnType<typeof vi.fn>
  dispose: () => void
}

type UsePlaybackMicNudge = Awaited<
  ReturnType<typeof loadNudge>
>['usePlaybackMicNudge']

const mount = (useNudge: UsePlaybackMicNudge): Harness => {
  const [playing, setPlaying] = createSignal(false)
  const [mic, setMic] = createSignal(false)
  const onEnableMic = vi.fn()
  const dispose = createRoot((dispose) => {
    useNudge({
      isPlaying: playing,
      micActive: mic,
      isRelevantTab: () => true,
      onEnableMic,
    })
    return dispose
  })
  return { setPlaying, setMic, onEnableMic, dispose }
}

const liveToastCount = async (): Promise<number> => {
  const { getNotifications } = await import('@/stores/notifications-store')
  return getNotifications()().length
}

const clearToasts = async (): Promise<void> => {
  const { getNotifications, removeNotification } =
    await import('@/stores/notifications-store')
  for (const toast of getNotifications()()) removeNotification(toast.id)
}

describe('usePlaybackMicNudge', () => {
  beforeEach(async () => {
    localStorage.clear()
    await clearToasts()
  })

  it('offers the mic the first time practice starts without it', async () => {
    const { usePlaybackMicNudge } = await loadNudge()
    const harness = mount(usePlaybackMicNudge)

    expect(await liveToastCount()).toBe(0)
    harness.setPlaying(true)
    expect(await liveToastCount()).toBe(1)
    expect(localStorage.getItem(OFFERED_KEY)).toBe('true')
    harness.dispose()
  })

  it('stays quiet when the mic is already on', async () => {
    const { usePlaybackMicNudge } = await loadNudge()
    const harness = mount(usePlaybackMicNudge)

    harness.setMic(true)
    harness.setPlaying(true)
    expect(await liveToastCount()).toBe(0)
    expect(localStorage.getItem(OFFERED_KEY)).toBeNull()
    harness.dispose()
  })

  it('never offers again once it has been offered — across sessions', async () => {
    localStorage.setItem(OFFERED_KEY, 'true')
    const { usePlaybackMicNudge } = await loadNudge()
    const harness = mount(usePlaybackMicNudge)

    harness.setPlaying(true)
    expect(await liveToastCount()).toBe(0)
    harness.dispose()
  })

  it('does not repeat within the session either', async () => {
    const { usePlaybackMicNudge } = await loadNudge()
    const harness = mount(usePlaybackMicNudge)

    harness.setPlaying(true)
    await clearToasts()
    harness.setPlaying(false)
    harness.setPlaying(true)
    expect(await liveToastCount()).toBe(0)
    harness.dispose()
  })

  it('enables the mic through the offered action', async () => {
    const { usePlaybackMicNudge } = await loadNudge()
    const harness = mount(usePlaybackMicNudge)

    harness.setPlaying(true)
    const { getNotifications } = await import('@/stores/notifications-store')
    const toast = getNotifications()()[0]
    toast.action?.onClick()
    expect(harness.onEnableMic).toHaveBeenCalledTimes(1)
    expect(await liveToastCount()).toBe(0)
    harness.dispose()
  })
})
