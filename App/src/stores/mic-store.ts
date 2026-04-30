import { createSignal } from 'solid-js'

export const [micActive, setMicActive] = createSignal<boolean>(false)
export const [micWaveVisible, setMicWaveVisible] = createSignal<boolean>(true)
export const [micError, setMicError] = createSignal<string | null>(null)

export function toggleMicWaveVisible(): void {
  setMicWaveVisible(!micWaveVisible())
}
