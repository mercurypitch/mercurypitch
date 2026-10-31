// Studio playback quality hook — the device's playback tier as a signal, and the listener's choice.
import { createSignal, onCleanup } from 'solid-js'
import type { StudioLaneFreezeStatus } from '@/lib/studio/playback/lane-freezer'
import { laneFreezeStatus, subscribeLaneFreezeStatus, } from '@/lib/studio/playback/lane-freezer'
import type { StudioPlaybackChoice, StudioPlaybackQualityState, StudioPlaybackTier, } from '@/lib/studio/playback/playback-quality'
import { autoPlaybackTier, playbackQualityState, setPlaybackChoice, subscribePlaybackQuality, } from '@/lib/studio/playback/playback-quality'
import type { StudioSongShape } from '@/lib/studio/playback/song-load'

export interface StudioPlaybackQualityController {
  readonly state: () => StudioPlaybackQualityState
  /** The tier Auto plays `song` at; tracks the state, so a step down or a benchmark moves it. */
  autoTier(song: StudioSongShape): StudioPlaybackTier
  choose(choice: StudioPlaybackChoice): void
  /** The lanes rendered ahead for this song (lane-freezer.ts). */
  readonly freeze: () => StudioLaneFreezeStatus
}

export function usePlaybackQuality(): StudioPlaybackQualityController {
  const [state, setState] = createSignal(playbackQualityState())
  const [freeze, setFreeze] = createSignal(laneFreezeStatus())
  onCleanup(subscribePlaybackQuality(setState))
  onCleanup(subscribeLaneFreezeStatus(setFreeze))
  return {
    state,
    autoTier: (song) => {
      state()
      return autoPlaybackTier(song)
    },
    choose: setPlaybackChoice,
    freeze,
  }
}
