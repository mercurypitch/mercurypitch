import { createSignal } from 'solid-js'

// `micActive`/`micError` reflect the SHARED practice/analysis engine mic
// (singing, guitar, piano, exercises) and are driven by those controllers'
// onMicStateChange callbacks — i.e. "is this page's mic on". They are
// deliberately NOT bridged to the device-level MicManager: separate consumers
// like the stem mixer or jam hold the device under their own ids, and must not
// flip this page-facing indicator (doing so corrupted the Singing mic toggle
// after using the Karaoke stem mixer).
export const [micActive, setMicActive] = createSignal<boolean>(false)
export const [micWaveVisible, setMicWaveVisible] = createSignal<boolean>(true)
export const [micError, setMicError] = createSignal<string | null>(null)

export function toggleMicWaveVisible(): void {
  setMicWaveVisible(!micWaveVisible())
}
