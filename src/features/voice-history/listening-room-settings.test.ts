import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'
import { bindListeningRoomSettings } from './listening-room-settings'

describe('listening room settings binding', () => {
  it('subscribes before a playback rack exists', async () => {
    const setSettings = vi.fn<(settings: FxSettings) => void>()
    let activeRack: Pick<FxRack, 'setSettings'> | null = null
    let changeRoom = (_settings: FxSettings): void => undefined
    let dispose = (): void => undefined

    createRoot((rootDispose) => {
      dispose = rootDispose
      const [settings, setSettingsSignal] = createSignal<FxSettings>({
        echo: 0,
        reverb: 0,
        hall: 0,
      })
      changeRoom = setSettingsSignal
      // The binding owns the tracked effect around this accessor.
      // eslint-disable-next-line solid/reactivity
      bindListeningRoomSettings(settings, () => activeRack)
    })
    await Promise.resolve()

    activeRack = { setSettings }
    const nebula = { echo: 18, reverb: 35, hall: 22 }
    changeRoom(nebula)
    await Promise.resolve()

    expect(setSettings).toHaveBeenCalledWith(nebula)
    dispose()
  })
})
