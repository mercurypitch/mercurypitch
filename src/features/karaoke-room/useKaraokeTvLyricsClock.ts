// ============================================================
// The Karaoke room's lyrics on a connected TV: the clock they run on
// ============================================================
//
// A TV that shows the lyrics (the TV chooser's Lyrics, TVLyrics.swift) draws
// them from the lyrics window's script and runs on from the clock the lock
// screen's Now Playing reports carry (packages/mobile-runtime platform.ts).
// With "Keep playing in the background" off the room tells the lock screen
// nothing, and the TV's lyrics stood on the song's first line. So while the
// reports are off and the TV shows the lyrics, the room tells the TV the
// clock itself, read as a report reads it (karaoke-clock-report.ts) and on
// the same moments: play, pause, a jump, the song's clock starting, a new
// speed or a length arriving. Never per frame: the TV runs on by itself
// from the last one.
//
// Tests: KaraokeRoomStage.test.tsx, "a TV showing the lyrics".

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { karaokeClockReport } from './karaoke-clock-report'

export interface KaraokeTvLyricsClockOptions {
  readonly device: NativeDeviceApi | null
  readonly mixer: Accessor<HostedMixerControls | null>
  /** The lock screen's reports carry the clock now, so the TV has it. */
  readonly reported: Accessor<boolean>
  /** A song is on the stage and the run has started, playing or paused. */
  readonly runOn: Accessor<boolean>
}

export function useKaraokeTvLyricsClock(
  options: KaraokeTvLyricsClockOptions,
): void {
  const tell = options.device?.tvLyricsClock
  const watch = options.device?.onTvLyrics
  if (tell === undefined || watch === undefined) return
  const [showing, setShowing] = createSignal(false)
  onCleanup(watch(setShowing))

  createEffect(() => {
    const controls = options.mixer()
    if (options.reported() || !showing() || !options.runOn()) return
    if (controls === null) return
    tell(karaokeClockReport(controls))
  })
}
