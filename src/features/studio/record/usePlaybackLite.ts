// ============================================================
// usePlaybackLite — what live playback's tier keeps only the lookahead of in the song now, as a signal for the input monitor
// ============================================================
//
// A monitored lane plays its effects as the lane's clips play them, and
// live playback's tier decides how (playback-quality.ts): on Light a lane's
// de-esser and dynamic EQ keep only their lookahead and never cut, so the
// monitor passes them uncut too (input-monitor.ts). The tier is read where
// playback reads it and weighed as the Sound panel weighs it: the
// listener's choice, Auto's measure of this device and the song's frozen
// lanes, each followed as it changes.
import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { StudioProject } from '@/lib/studio/model/types'
import { laneFreezeStatus, subscribeLaneFreezeStatus, } from '@/lib/studio/playback/lane-freezer'
import { livePlaybackProfile, playbackQualityState, subscribePlaybackQuality, } from '@/lib/studio/playback/playback-quality'
import type { StudioLiteEffect } from '@/lib/studio-fx/fx-profile'

const NO_LITE: readonly StudioLiteEffect[] = []

/** What live playback's tier keeps only the lookahead of in `project` now: Light's de-esser and dynamic EQ; nothing on Best or Balanced, or with no song open. */
export function usePlaybackLite(
  project: Accessor<StudioProject | null>,
): Accessor<readonly StudioLiteEffect[]> {
  const [quality, setQuality] = createSignal(playbackQualityState())
  onCleanup(subscribePlaybackQuality(setQuality))
  const [freeze, setFreeze] = createSignal(laneFreezeStatus())
  onCleanup(subscribeLaneFreezeStatus(setFreeze))
  const lite = createMemo(() => {
    quality()
    const song = project()
    return song === null
      ? NO_LITE
      : livePlaybackProfile({ ...song, frozen: freeze().frozen }).lite
  })
  return lite
}
