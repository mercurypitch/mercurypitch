// ============================================================
// KaraokeAirPlayHint — Screen Mirroring, for a song started on AirPlay
// ============================================================
//
// On AirPlay alone the room's sound reaches nowhere. The owner took AirPlay
// as iOS offered it at launch, and the LG C2 showed the song's name and a
// timeline; on Play the song's clock ran on the phone, no sound came from
// the TV or the phone, and the TV showed a spinner (an iPhone 13 Pro, 3 Nov
// 2026). Screen Mirroring to the same TV carried the room and its sound,
// the TV stage and the TV lyrics alike: "works great". The clock keeps
// running, so no stall comes to say anything; the room says it as the song
// starts instead, in the stopped-song notice's own words (sound-stopped.ts):
// AirPlay cannot carry the room's sound to a TV, Screen Mirroring can, and
// how.
//
// On AirPlay alone (airplay-suspicion.ts): the route says airplay, or the
// room suspects it, the app's own session being blind to it. Once a launch,
// and never while a screen is connected: a hint that is up goes the moment
// mirroring starts. It closes from its button (44 px) and asks nothing
// else: no focus moves to it, and the song plays on under it.
//
// Like the premium rooms' volume hint (RoomVolumeHint.tsx), its status
// region is always there, empty, so a screen reader hears the hint the
// moment it appears; only the card takes taps. It sits at the top of the
// stage, under the room header, over the song's title line rather than the
// words being sung (KaraokeAirPlayHint.module.css).

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { Tv, X } from '@/components/icons'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { airPlayAlone } from '@/stores/airplay-suspicion'
import styles from './KaraokeAirPlayHint.module.css'
import { AIRPLAY_CANNOT, CLOSE_NOTICE, MIRRORING_CAN } from './sound-stopped'

/** What the hint says, a line each: the notice's own words. */
export const AIRPLAY_HINT_LINES = [AIRPLAY_CANNOT, MIRRORING_CAN] as const

/** Once a launch: this module lives as long as the app does. */
let shownThisLaunch = false

export interface KaraokeAirPlayHintProps {
  /** The mixer on the stage, or null between songs. */
  mixer: Accessor<HostedMixerControls | null>
}

export function KaraokeAirPlayHint(props: KaraokeAirPlayHintProps) {
  const [shown, setShown] = createSignal(false)
  const playing = (): boolean => props.mixer()?.playing() === true
  // A song starting: the guess as it stands then, read and not followed.
  createEffect(
    on(playing, (now) => {
      if (!now || shownThisLaunch || !airPlayAlone()) return
      shownThisLaunch = true
      setShown(true)
    }),
  )
  // Followed while it is up: mirroring starting takes it away.
  const up = (): boolean => shown() && airPlayAlone()
  return (
    <div class={styles.slot} role="status" data-testid="karaoke-airplay-slot">
      <Show when={up()}>
        <div class={styles.hint} data-testid="karaoke-airplay-hint">
          <span class={styles.icon} aria-hidden="true">
            <Tv />
          </span>
          <div class={styles.words}>
            <For each={AIRPLAY_HINT_LINES}>{(line) => <p>{line}</p>}</For>
          </div>
          <button
            type="button"
            class={styles.close}
            aria-label={CLOSE_NOTICE}
            onClick={() => setShown(false)}
          >
            <X />
          </button>
        </div>
      </Show>
    </div>
  )
}

/** Tests only: a new launch, as far as the hint can tell. */
export function resetAirPlayHintForTests(): void {
  shownThisLaunch = false
}
