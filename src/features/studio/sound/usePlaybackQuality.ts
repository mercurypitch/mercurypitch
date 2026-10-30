// Studio playback quality hook — the device's playback tier as a signal, and the listener's choice.
import { createSignal, onCleanup } from 'solid-js'
import type { StudioPlaybackChoice, StudioPlaybackQualityState, } from '@/lib/studio/playback/playback-quality'
import { playbackQualityState, setPlaybackChoice, subscribePlaybackQuality, } from '@/lib/studio/playback/playback-quality'

export interface StudioPlaybackQualityController {
  readonly state: () => StudioPlaybackQualityState
  choose(choice: StudioPlaybackChoice): void
}

export function usePlaybackQuality(): StudioPlaybackQualityController {
  const [state, setState] = createSignal(playbackQualityState())
  onCleanup(subscribePlaybackQuality(setState))
  return { state, choose: setPlaybackChoice }
}
