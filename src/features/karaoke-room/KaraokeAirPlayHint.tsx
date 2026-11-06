// ============================================================
// KaraokeAirPlayHint — where the song and the lyrics are, on AirPlay
// ============================================================
//
// On AirPlay alone the song plays on the TV and nothing else does. AirPlay
// carries sound only: iOS gives an app a second screen with Screen
// Mirroring or a cable, never with AirPlay alone, so the lyrics stay on
// the phone. So as a song starts there, the room says where the song plays
// (the receiver by the name the route gives it, and none where AirPlay is
// only suspected), that the lyrics stay on this phone, and that Screen
// Mirroring puts the stage on the TV, and how.
//
// Until mp-v0.8.55 it said AirPlay could not carry the room's sound to a
// TV: on the owner's LG C2 the TV showed the song's name and a spinner, and
// no sound came from the TV or the phone. The Developer screen's AirPlay
// sound check (6 Nov 2026) found Web Audio alone on the TV, and not Web
// Audio beside a silent element, so the lock screen's carrier and the
// unlock clip now stand aside on AirPlay (native-device.ts in the app).
//
// On AirPlay alone (airplay-suspicion.ts): the route says airplay, or the
// room suspects it. Once a launch, and never while a screen is connected:
// a hint that is up goes the moment mirroring starts. It closes from its
// button (44 px) and asks nothing else: no focus moves to it, and the song
// plays on under it.
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
import { thisDeviceLower } from '@/lib/device-noun'
import { airPlayAlone } from '@/stores/airplay-suspicion'
import { audioRoute, audioRoutePort } from '@/stores/audio-route-store'
import styles from './KaraokeAirPlayHint.module.css'
import { CLOSE_NOTICE } from './sound-stopped'

/** Where the stage goes, and how: Screen Mirroring, from Control Center. */
export const MIRRORING_STAGE =
  'Screen Mirroring puts the stage on the TV: open Control Center, tap Screen Mirroring, then choose your TV.'

/**
 * What the hint says, a line each: where the song plays, by the name the
 * route gives the receiver (null where AirPlay is only suspected), where
 * the lyrics are, and what Screen Mirroring adds.
 */
export function airPlayHintLines(receiver: string | null): readonly string[] {
  const where =
    receiver === null || receiver.trim() === ''
      ? 'The song is playing over AirPlay.'
      : `The song is playing on ${receiver} over AirPlay.`
  return [where, `The lyrics stay on ${thisDeviceLower()}.`, MIRRORING_STAGE]
}

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
  // Only a route that says airplay names the receiver: suspected, the port
  // the app's session gives is its own speaker.
  const lines = (): readonly string[] =>
    airPlayHintLines(audioRoute() === 'airplay' ? audioRoutePort() : null)
  return (
    <div class={styles.slot} role="status" data-testid="karaoke-airplay-slot">
      <Show when={up()}>
        <div class={styles.hint} data-testid="karaoke-airplay-hint">
          <span class={styles.icon} aria-hidden="true">
            <Tv />
          </span>
          <div class={styles.words}>
            <For each={lines()}>{(line) => <p>{line}</p>}</For>
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
