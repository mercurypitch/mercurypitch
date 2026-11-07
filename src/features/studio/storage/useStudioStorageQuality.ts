// Studio storage quality hook — how new audio is kept on this device, as a signal, and the singer's choice from Song options.
import { createSignal, onCleanup } from 'solid-js'
import type { StudioStorageQuality } from '@/lib/studio/audio/storage-quality'
import { chooseStudioStorage, studioStorageQuality, subscribeStudioStorage, } from '@/lib/studio/audio/storage-quality'

export function useStudioStorageQuality() {
  const [quality, setQuality] = createSignal(studioStorageQuality())
  onCleanup(subscribeStudioStorage(setQuality))
  return {
    quality,
    /** A choice made in Song options is remembered on this device. */
    choose: (next: StudioStorageQuality) => chooseStudioStorage(next, true),
  }
}
